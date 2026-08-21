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
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PAPER, PEACH_RED, SOOT } from '../palette';
import {
  WALKWAY_BAND,
  planeRect,
  planesFor,
  scaledWidth,
  slotCount,
  slotX,
  type Plane,
} from '../engine/parallax';
import { layoutFor, clampTo, strip as stripById } from '../engine/town';
import { LIVE, DEAD, isPlate, type PlateName } from '../plates';
import {
  applyCrossing,
  applyDepth,
  arriveAt,
  atWater,
  beginFirstWatch,
  currentCall,
  drainAmount,
  lookBack,
  reflection,
  tick,
  watchmanCalling,
  type WalkState,
} from '../engine/walk';

/**
 * 一更, walked. DECISIONS 107 and 108.
 *
 * THE WALKWAY IS AUTHORED SEGMENTS: a sequence of plates, each scaled so
 * its measured embankment band lands on WALKWAY_BAND. A bridge is a
 * segment with a bridge in it - runtime object compositing died at 97b.
 *
 * THE DEPTH VERB: swipe down steps toward the water - the outermost
 * step IS the reflection, where the flames show. Swipe up steps inland
 * (a lane, where the art shows a mouth). The transition dips through
 * paper rather than cutting - a first, deliberately simple version of
 * the layers-parting feel 108 requires.
 *
 * The walk itself never touches the JS thread.
 */

function PlaneLayer({
  plane, plate, walkX, screenW, screenH, drain,
}: {
  plane: Plane;
  plate: PlateName;
  walkX: SharedValue<number>;
  screenW: number;
  screenH: number;
  drain: number;
}) {
  const live = useImage(LIVE[plate]);
  const dead = useImage(DEAD[plate]);
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
          key={`${plate}:${plane.id}:${k}`}
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
  live: NonNullable<ReturnType<typeof useImage>>;
  dead: ReturnType<typeof useImage>;
  drain: number;
}) {
  const transform = useDerivedValue(
    () => [{ translateX: slotX(plane, walkX.value, tileW, slot) }],
    [plane, tileW, slot],
  );
  return (
    <Group transform={transform}>
      <SkImage image={live} x={0} y={band.y} width={tileW} height={band.height} fit="fill" />
      {dead && drain > 0 ? (
        <SkImage image={dead} x={0} y={band.y} width={tileW} height={band.height} fit="fill" opacity={drain} />
      ) : null}
    </Group>
  );
}

/**
 * The walkway: each plate drawn once at its laid-out position, at
 * speed 1 - she walks ON this. Fixed nodes, animated x, nothing
 * created or destroyed mid-walk.
 */
function Walkway({
  stripId, walkX, screenH, drain,
}: {
  stripId: string;
  walkX: SharedValue<number>;
  screenH: number;
  drain: number;
}) {
  const bandH = WALKWAY_BAND.height * screenH;
  const bandY = WALKWAY_BAND.top * screenH;
  const layout = layoutFor(stripId, bandH);
  if (!layout) return null;
  return (
    <Group>
      {layout.plates.map((p, i) => (
        <WalkwayPlate
          key={`${p.plate}:${i}`}
          plate={p.plate as PlateName}
          x={p.x}
          y={bandY + p.drawTopOffset}
          w={p.width}
          h={p.drawH}
          walkX={walkX}
          drain={drain}
        />
      ))}
    </Group>
  );
}

function WalkwayPlate({
  plate, x, y, w, h, walkX, drain,
}: {
  plate: PlateName; x: number; y: number; w: number; h: number;
  walkX: SharedValue<number>; drain: number;
}) {
  const live = useImage(LIVE[plate]);
  const dead = useImage(DEAD[plate]);
  const transform = useDerivedValue(
    () => [{ translateX: x - walkX.value }],
    [x],
  );
  if (!live) return null;
  return (
    <Group transform={transform}>
      <SkImage image={live} x={0} y={y} width={w} height={h} fit="fill" />
      {dead && drain > 0 ? (
        <SkImage image={dead} x={0} y={y} width={w} height={h} fit="fill" opacity={drain} />
      ) : null}
    </Group>
  );
}

/** DECISIONS 67/108: flames in the water, nothing at zero. */
function Flames({ state, screenH }: { state: WalkState; screenH: number }) {
  const r = reflection(state);
  if (!atWater(state) || !r.visible) return null;
  return (
    <View style={[styles.water, { top: screenH * 0.62 }]} pointerEvents="none">
      <View style={styles.flames}>
        {Array.from({ length: r.flames }).map((_, i) => (
          <View key={i} style={styles.flame} />
        ))}
      </View>
    </View>
  );
}

const Scene = memo(function Scene({
  walkX, width, height, drain, stripId,
}: {
  walkX: SharedValue<number>; width: number; height: number;
  drain: number; stripId: string;
}) {
  const here = stripById(stripId);
  const planes = planesFor(here.kind);
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height} color={PAPER} />
      {planes.map((p) => {
        const name = here.plates[p.id === 'kerb' ? 'kerb' : p.id];
        return isPlate(name) ? (
          <PlaneLayer
            key={p.id}
            plane={p}
            plate={name}
            walkX={walkX}
            screenW={width}
            screenH={height}
            drain={drain}
          />
        ) : null;
      })}
      {here.kind === 'bank' ? (
        <Walkway stripId={stripId} walkX={walkX} screenH={height} drain={drain} />
      ) : null}
    </Canvas>
  );
});

export function Walk() {
  const { width, height } = useWindowDimensions();
  const walkX = useSharedValue(0);
  const stripMax = useSharedValue(0);
  // 1 = fully visible. The depth step dips this to 0 and back - the
  // simple first version of the layers-parting transition 108 requires.
  const veil = useSharedValue(1);
  const [state, setState] = useState<WalkState>(beginFirstWatch);
  const bandH = WALKWAY_BAND.height * height;

  useEffect(() => {
    const id = setInterval(
      () => setState((s) => arriveAt(tick(s, 100), walkX.value, bandH)),
      100,
    );
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandH]);

  const depth = useCallback(
    (dir: 'outward' | 'inward') => {
      setState((s) => {
        // A mouth is a two-way door: inward from the bank, outward from
        // inside the lane. Try the link first in whichever direction
        // makes sense for the strip she is on; fall back to the depth
        // map (bank -> water, water -> bank).
        const kind = stripById(s.pos.strip).kind;
        const linkWay = dir === 'inward' ? kind === 'bank' : kind === 'lane';
        if (linkWay) {
          const throughMouth = applyCrossing(s, s.x);
          if (throughMouth !== s) return throughMouth;
        }
        return applyDepth(s, dir);
      });
    },
    [],
  );

  const depthFromGesture = useCallback(
    (ty: number) => {
      // Dip through paper; switch strips at the bottom of the dip.
      veil.value = withTiming(0, { duration: 220 }, (done) => {
        'worklet';
        if (done) {
          runOnJS(depth)(ty > 0 ? 'outward' : 'inward');
          veil.value = withTiming(1, { duration: 260 });
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [depth],
  );

  const [pan] = useState(() =>
    Gesture.Pan()
      .onChange((e) => {
        'worklet';
        if (Math.abs(e.translationY) > 56
            && Math.abs(e.translationY) > Math.abs(e.translationX) * 1.4) {
          return; // vertical intent - handled at release
        }
        walkX.value = clampTo(walkX.value - e.changeX, stripMax.value);
      })
      .onFinalize((e) => {
        'worklet';
        if (Math.abs(e.translationY) > 56
            && Math.abs(e.translationY) > Math.abs(e.translationX) * 1.4) {
          runOnJS(depthFromGesture)(e.translationY);
          return;
        }
        walkX.value = withDecay({
          velocity: -e.velocityX,
          deceleration: 0.996,
          clamp: [0, stripMax.value],
        });
      }),
  );

  const veilOpacity = useDerivedValue(() => 1 - veil.value, []);

  const crossings = state.pos.crossed.length;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    stripMax.value = (() => {
      const lay = layoutFor(state.pos.strip, bandH);
      return lay ? lay.length : stripById(state.pos.strip).length;
    })();
    // eslint-disable-next-line react-hooks/immutability
    walkX.value = state.x;
    // Deliberately keyed on the crossing and the strip, not on x.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossings, state.pos.strip, bandH]);

  const onLookBack = useCallback(() => setState(lookBack), []);
  const call = currentCall(state);
  const drain = drainAmount(state);

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill}>
          <Scene
            walkX={walkX}
            width={width}
            height={height}
            drain={drain}
            stripId={state.pos.strip}
          />
          <VeilOverlay opacity={veilOpacity} />
        </View>
      </GestureDetector>

      <Flames state={state} screenH={height} />

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
      <Text style={styles.stamp}>b35</Text>
    </GestureHandlerRootView>
  );
}

function VeilOverlay({ opacity }: { opacity: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: PAPER }, style]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: PAPER },
  water: { position: 'absolute', left: 0, right: 0, height: 90, alignItems: 'center' },
  flames: { flexDirection: 'row', gap: 26 },
  flame: {
    width: 7, height: 14, borderRadius: 4,
    backgroundColor: PEACH_RED, opacity: 0.8,
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
  stamp: {
    position: 'absolute', bottom: 34, left: 22,
    color: SOOT, opacity: 0.25, fontSize: 11, letterSpacing: 1,
  },
});
