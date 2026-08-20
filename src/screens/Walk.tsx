import { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {
  Canvas,
  Group,
  Image as SkImage,
  Rect,
  useImage,
} from '@shopify/react-native-skia';
import {
  runOnJS,
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
 * THE WALK NEVER TOUCHES THE JS THREAD. Three versions of this got
 * progressively less wrong and the reasons are worth keeping:
 *
 *  1. walkX in useState        - re-rendered the whole tree every frame.
 *  2. shared value + PanResponder - better, but PanResponder is a JS
 *     handler, so every touch event still had to cross the bridge
 *     before anything could move.
 *  3. shared value + a gesture-handler worklet - the finger and the
 *     picture are now on the same thread and never involve JS at all.
 *
 * The remaining trap is React: the watch ticks ten times a second, and
 * if that re-rendered the canvas it would undo all of the above. Scene
 * is memoised on values that change a few times a MINUTE, so the ticks
 * touch only the overlay.
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

const Scene = memo(function Scene({
  walkX, width, height, drain,
}: {
  walkX: SharedValue<number>; width: number; height: number; drain: number;
}) {
  return (
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
  );
});

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

  const setLook = useCallback(
    (on: boolean) => setState((s) => (s.looking === on ? s : setLooking(s, on))),
    [],
  );

  // Runs entirely on the UI thread. onChange gives the delta since the
  // last event, so there is no start-position to track and nothing to
  // reassign across renders.
  const [pan] = useState(() =>
    Gesture.Pan()
      .onChange((e) => {
        'worklet';
        if (Math.abs(e.translationY) > 40
            && Math.abs(e.translationY) > Math.abs(e.translationX)) {
          runOnJS(setLook)(true);
          return;
        }
        walkX.value = Math.max(DISTRICT_START, walkX.value - e.changeX);
      })
      .onFinalize((e) => {
        'worklet';
        runOnJS(setLook)(false);
        // Let go and she keeps going, slowing down. Without this the walk
        // stops dead the instant your thumb lifts, which is most of what
        // made it feel like dragging a picture rather than walking.
        walkX.value = withDecay({
          velocity: -e.velocityX,
          deceleration: 0.996,
          clamp: [DISTRICT_START, Number.MAX_SAFE_INTEGER],
        });
      }),
  );

  const onLookBack = useCallback(() => setState(lookBack), []);
  const call = currentCall(state);
  const drain = drainAmount(state);

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill}>
          <Scene walkX={walkX} width={width} height={height} drain={drain} />
        </View>
      </GestureDetector>

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
    </GestureHandlerRootView>
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
