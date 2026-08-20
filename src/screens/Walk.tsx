import { useCallback, useEffect, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  Canvas,
  Group,
  Image as SkImage,
  Rect,
  useImage,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withDecay,
  type SharedValue,
} from 'react-native-reanimated';

import { PAPER, PEACH_RED, SOOT } from '../palette';
import {
  DISTRICT_START,
  PLANES,
  planeRect,
  scaledWidth,
  slotCount,
  slotX,
  type Plane,
} from '../engine/parallax';
import {
  beginFirstWatch,
  currentCall,
  drainAmount,
  lookBack,
  reflection,
  setLooking,
  tick,
  watchmanCalling,
  type WalkState,
} from '../engine/walk';

/**
 * 一更 - one walkable minute of the first watch.
 *
 * THE WALK NEVER TOUCHES REACT. walkX is a reanimated shared value that
 * the gesture writes and Skia reads on the UI thread; a first version
 * kept it in useState and re-rendered the whole tree every frame, which
 * is exactly as smooth as it sounds. React state here holds only things
 * that change a few times a minute - the fires, the watch, whether she
 * is leaning over the water.
 *
 * Each plane owns a FIXED set of tile nodes (slotCount) whose x is a
 * derived value. Nothing is created or destroyed while she walks.
 */

const LIVE = {
  far: require('../../assets/plates-alpha/canal-far-pair.png'),
  mid: require('../../assets/plates-alpha/canal-mid.png'),
  kerb: require('../../assets/plates-alpha/canal-near-kerb.png'),
} as const;

const DEAD = {
  far: require('../../assets/plates-drained/canal-far-pair.png'),
  mid: require('../../assets/plates-drained/canal-mid.png'),
  kerb: require('../../assets/plates-drained/canal-near-kerb.png'),
} as const;

function PlaneLayer({
  plane, walkX, screenW, screenH, drain,
}: {
  plane: Plane;
  walkX: SharedValue<number>;
  screenW: number;
  screenH: number;
  drain: number;
}) {
  const live = useImage(LIVE[plane.id]);
  const dead = useImage(DEAD[plane.id]);
  const band = planeRect(plane, screenH);

  const tileW = live
    ? scaledWidth(plane, live.width(), live.height(), screenH)
    : 0;
  const slots = slotCount(tileW, screenW);

  if (!live || slots === 0) return null;

  return (
    <Group>
      {Array.from({ length: slots }, (_, k) => (
        <Slot
          key={`${plane.id}:${k}`}
          plane={plane}
          slot={k}
          walkX={walkX}
          tileW={tileW}
          band={band}
          live={live}
          dead={dead}
          drain={drain}
        />
      ))}
    </Group>
  );
}

function Slot({
  plane, slot, walkX, tileW, band, live, dead, drain,
}: {
  plane: Plane;
  slot: number;
  walkX: SharedValue<number>;
  tileW: number;
  band: { y: number; height: number };
  live: ReturnType<typeof useImage>;
  dead: ReturnType<typeof useImage>;
  drain: number;
}) {
  const transform = useDerivedValue(
    () => [{ translateX: slotX(plane, walkX.value, tileW, slot) }],
    [plane, tileW, slot],
  );
  if (!live) return null;
  return (
    <Group transform={transform}>
      <SkImage image={live} x={0} y={band.y} width={tileW} height={band.height} fit="fill" />
      {dead && drain > 0 ? (
        <SkImage
          image={dead}
          x={0}
          y={band.y}
          width={tileW}
          height={band.height}
          fit="fill"
          opacity={drain}
        />
      ) : null}
    </Group>
  );
}

/**
 * DECISIONS 67. The flames are counted in the canal, never in a HUD.
 * At zero fires there is no reflection at all - the screen shows the
 * water and nothing in it, and says nothing about why.
 */
function Reflection({ state, screenH }: { state: WalkState; screenH: number }) {
  const r = reflection(state);
  if (!state.looking) return null;
  return (
    <View style={[styles.water, { top: screenH * 0.66 }]} pointerEvents="none">
      {r.visible ? (
        <View style={styles.flames}>
          {Array.from({ length: r.flames }).map((_, i) => (
            <View key={i} style={styles.flame} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Walk() {
  const { width, height } = useWindowDimensions();
  const walkX = useSharedValue(0);
  const [state, setState] = useState<WalkState>(beginFirstWatch);

  // The night runs whether or not she moves. Once every 100ms, not
  // once a frame - the watch is the only thing here that needs React.
  useEffect(() => {
    const id = setInterval(() => setState((s) => tick(s, 100)), 100);
    return () => clearInterval(id);
  }, []);

  // Where the walk was when the thumb went down. A shared value rather
  // than a closure variable so the gesture can read and write it without
  // reassigning across renders.
  const from = useSharedValue(0);

  // Built once, via a state initializer rather than useMemo: the shared
  // values are captured from the closure instead of being passed into a
  // hook, which is what lets the handlers write to them.
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        from.value = walkX.value;
      },
      onPanResponderMove: (_e, g) => {
        if (g.dy > 40 && Math.abs(g.dy) > Math.abs(g.dx)) {
          setState((s) => (s.looking ? s : setLooking(s, true)));
          return;
        }
        walkX.value = Math.max(DISTRICT_START, from.value - g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        setState((s) => (s.looking ? setLooking(s, false) : s));
        // Let go and she keeps going, slowing down. Without this the
        // walk stops dead the instant your thumb lifts, which is what
        // made it feel like dragging a picture rather than walking.
        walkX.value = withDecay({
          velocity: -g.vx * 1000,
          deceleration: 0.997,
          clamp: [DISTRICT_START, Number.MAX_SAFE_INTEGER],
        });
      },
      onPanResponderTerminate: () => setState((s) => setLooking(s, false)),
    }),
  );

  const onLookBack = useCallback(() => setState(lookBack), []);
  const call = currentCall(state);
  const drain = drainAmount(state);

  return (
    <View style={styles.fill} {...pan.panHandlers}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height} color={PAPER} />
        {PLANES.map((p) => (
          <PlaneLayer
            key={p.id}
            plane={p}
            walkX={walkX}
            screenW={width}
            screenH={height}
            drain={drain}
          />
        ))}
      </Canvas>

      <Reflection state={state} screenH={height} />

      {watchmanCalling(state) ? (
        <View style={styles.call} pointerEvents="none">
          <Text style={styles.callLabel}>{call.label}</Text>
          <View style={styles.strikes}>
            {Array.from({ length: call.slow }).map((_, i) => (
              <View key={`s${i}`} style={styles.slow} />
            ))}
            <View style={styles.gap} />
            {Array.from({ length: call.quick }).map((_, i) => (
              <View key={`q${i}`} style={styles.quick} />
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.lookBack} onPress={onLookBack}>
        look back
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: PAPER },
  water: { position: 'absolute', left: 0, right: 0, height: 90, alignItems: 'center' },
  flames: { flexDirection: 'row', gap: 26 },
  flame: {
    width: 7, height: 12, borderRadius: 4,
    backgroundColor: PEACH_RED, opacity: 0.75,
  },
  call: { position: 'absolute', top: 54, left: 0, right: 0, alignItems: 'center' },
  callLabel: { color: SOOT, fontSize: 26, letterSpacing: 6, opacity: 0.75 },
  strikes: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 7 },
  slow: { width: 9, height: 9, borderRadius: 5, backgroundColor: SOOT, opacity: 0.65 },
  quick: { width: 5, height: 5, borderRadius: 3, backgroundColor: SOOT, opacity: 0.45 },
  gap: { width: 16 },
  lookBack: {
    position: 'absolute', bottom: 34, right: 22,
    color: SOOT, opacity: 0.3, fontSize: 12, letterSpacing: 2,
  },
});
