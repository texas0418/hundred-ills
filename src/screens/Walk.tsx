import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
  Easing,
  runOnJS,
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
 * THE DEPTH TRANSITION IS LAYERS PARTING, Year Walk fashion. During a
 * step, BOTH strips render: the scene she is leaving slides apart -
 * each plane at a rate set by its depth, kerb sweeping fastest, far
 * bank barely moving - while the scene she is entering settles in
 * from the opposite direction. Nothing recedes and nothing scales;
 * flat layers move apart like stage flats, which is all Year Walk
 * ever did. The paper veil this replaces was a crossfade with a
 * costume on.
 *
 * Phase plumbing: 'settled' scenes ignore the progress value entirely;
 * an 'out' scene reads it forward, an 'in' scene reads it inverted.
 * The out scene's walk position is FROZEN at the moment the step began
 * (outX), because gameplay has already switched strips and the live
 * walkX belongs to the destination.
 */

type Phase = 'settled' | 'in' | 'out';

/** How far each plane travels in a transition, as a fraction of screen
 *  height. Depth-ordered: the near layer parts first and furthest. */
const PART = { far: 0.10, mid: 0.34, kerb: 0.62 } as const;

function partOffset(
  phase: Phase,
  prog: number,
  dir: number,
  factor: number,
  screenH: number,
): number {
  'worklet';
  if (phase === 'out') return prog * dir * factor * screenH;
  if (phase === 'in') return -(1 - prog) * dir * factor * screenH * 0.35;
  return 0;
}

function PlaneLayer({
  plane, plate, xSrc, screenW, screenH, drain, phase, prog, dir,
}: {
  plane: Plane;
  plate: PlateName;
  xSrc: SharedValue<number>;
  screenW: number;
  screenH: number;
  drain: number;
  phase: Phase;
  prog: SharedValue<number>;
  dir: number;
}) {
  const live = useImage(LIVE[plate]);
  const dead = useImage(DEAD[plate]);
  const band = planeRect(plane, screenH);
  const tileW = live
    ? scaledWidth(plane, live.width(), live.height(), screenH)
    : 0;
  const slots = slotCount(tileW, screenW);
  if (!live || slots === 0) return null;
  const factor = PART[plane.id];
  return (
    <Group>
      {Array.from({ length: slots }, (_, k) => (
        <Slot
          key={`${plate}:${plane.id}:${k}`}
          plane={plane}
          slot={k}
          xSrc={xSrc}
          tileW={tileW}
          band={band}
          live={live}
          dead={dead}
          drain={drain}
          phase={phase}
          prog={prog}
          dir={dir}
          factor={factor}
          screenH={screenH}
        />
      ))}
    </Group>
  );
}

function Slot({
  plane, slot, xSrc, tileW, band, live, dead, drain,
  phase, prog, dir, factor, screenH,
}: {
  plane: Plane;
  slot: number;
  xSrc: SharedValue<number>;
  tileW: number;
  band: { y: number; height: number };
  live: NonNullable<ReturnType<typeof useImage>>;
  dead: ReturnType<typeof useImage>;
  drain: number;
  phase: Phase;
  prog: SharedValue<number>;
  dir: number;
  factor: number;
  screenH: number;
}) {
  const transform = useDerivedValue(
    () => [
      { translateX: slotX(plane, xSrc.value, tileW, slot) },
      { translateY: partOffset(phase, prog.value, dir, factor, screenH) },
    ],
    [plane, tileW, slot, phase, dir, factor, screenH],
  );
  const opLive = useDerivedValue(
    () => (phase === 'out' ? 1 - prog.value : phase === 'in' ? prog.value : 1),
    [phase],
  );
  const opDead = useDerivedValue(() => opLive.value * drain, [drain]);
  return (
    <Group transform={transform}>
      <SkImage
        image={live}
        x={0}
        y={band.y}
        width={tileW}
        height={band.height}
        fit="fill"
        opacity={opLive}
      />
      {dead && drain > 0 ? (
        <SkImage
          image={dead}
          x={0}
          y={band.y}
          width={tileW}
          height={band.height}
          fit="fill"
          opacity={opDead}
        />
      ) : null}
    </Group>
  );
}

function Walkway({
  stripId, xSrc, screenH, drain, phase, prog, dir,
}: {
  stripId: string;
  xSrc: SharedValue<number>;
  screenH: number;
  drain: number;
  phase: Phase;
  prog: SharedValue<number>;
  dir: number;
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
          xSrc={xSrc}
          drain={drain}
          phase={phase}
          prog={prog}
          dir={dir}
          screenH={screenH}
        />
      ))}
    </Group>
  );
}

function WalkwayPlate({
  plate, x, y, w, h, xSrc, drain, phase, prog, dir, screenH,
}: {
  plate: PlateName; x: number; y: number; w: number; h: number;
  xSrc: SharedValue<number>; drain: number;
  phase: Phase; prog: SharedValue<number>; dir: number; screenH: number;
}) {
  const live = useImage(LIVE[plate]);
  const dead = useImage(DEAD[plate]);
  const transform = useDerivedValue(
    () => [
      { translateX: x - xSrc.value },
      { translateY: partOffset(phase, prog.value, dir, PART.mid, screenH) },
    ],
    [x, phase, dir, screenH],
  );
  const opLive = useDerivedValue(
    () => (phase === 'out' ? 1 - prog.value : phase === 'in' ? prog.value : 1),
    [phase],
  );
  const opDead = useDerivedValue(() => opLive.value * drain, [drain]);
  if (!live) return null;
  return (
    <Group transform={transform}>
      <SkImage image={live} x={0} y={y} width={w} height={h} fit="fill" opacity={opLive} />
      {dead && drain > 0 ? (
        <SkImage image={dead} x={0} y={y} width={w} height={h} fit="fill" opacity={opDead} />
      ) : null}
    </Group>
  );
}

function StripLayers({
  stripId, xSrc, width, height, drain, phase, prog, dir,
}: {
  stripId: string;
  xSrc: SharedValue<number>;
  width: number;
  height: number;
  drain: number;
  phase: Phase;
  prog: SharedValue<number>;
  dir: number;
}) {
  const here = stripById(stripId);
  const planes = planesFor(here.kind);
  return (
    <Group>
      {planes.map((p) => {
        const name = here.plates[p.id === 'kerb' ? 'kerb' : p.id];
        return isPlate(name) ? (
          <PlaneLayer
            key={p.id}
            plane={p}
            plate={name}
            xSrc={xSrc}
            screenW={width}
            screenH={height}
            drain={drain}
            phase={phase}
            prog={prog}
            dir={dir}
          />
        ) : null;
      })}
      {here.kind === 'bank' ? (
        <Walkway
          stripId={stripId}
          xSrc={xSrc}
          screenH={height}
          drain={drain}
          phase={phase}
          prog={prog}
          dir={dir}
        />
      ) : null}
    </Group>
  );
}

const Scene = memo(function Scene({
  walkX, outX, width, height, drain, stripId, fromStrip, dir, prog,
}: {
  walkX: SharedValue<number>;
  outX: SharedValue<number>;
  width: number;
  height: number;
  drain: number;
  stripId: string;
  fromStrip: string | null;
  dir: number;
  prog: SharedValue<number>;
}) {
  const inScene = (
    <StripLayers
      stripId={stripId}
      xSrc={walkX}
      width={width}
      height={height}
      drain={drain}
      phase={fromStrip ? 'in' : 'settled'}
      prog={prog}
      dir={dir}
    />
  );
  const outScene = fromStrip ? (
    <StripLayers
      stripId={fromStrip}
      xSrc={outX}
      width={width}
      height={height}
      drain={drain}
      phase="out"
      prog={prog}
      dir={dir}
    />
  ) : null;
  // Going deeper she passes THROUGH the old scene, so it parts on top;
  // stepping outward the new scene arrives from the viewer's side.
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height} color={PAPER} />
      {dir >= 0 ? inScene : outScene}
      {dir >= 0 ? outScene : inScene}
    </Canvas>
  );
});

export function Walk() {
  const { width, height } = useWindowDimensions();
  const walkX = useSharedValue(0);
  const outX = useSharedValue(0);
  const stripMax = useSharedValue(0);
  const prog = useSharedValue(1);
  const [state, setState] = useState<WalkState>(beginFirstWatch);
  const [trans, setTrans] = useState<{ from: string; dir: number } | null>(null);
  const bandH = WALKWAY_BAND.height * height;

  const stateRef = useRef(state);
  const transRef = useRef(trans);
  useEffect(() => {
    stateRef.current = state;
    transRef.current = trans;
  }, [state, trans]);

  useEffect(() => {
    const id = setInterval(
      () => setState((s) => arriveAt(tick(s, 100), walkX.value, bandH)),
      100,
    );
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandH]);

  const clearTrans = useCallback(() => setTrans(null), []);

  const depth = useCallback(
    (dirWord: 'outward' | 'inward') => {
      if (transRef.current) return; // one step at a time
      const s = stateRef.current;
      const kind = stripById(s.pos.strip).kind;
      const linkWay = dirWord === 'inward' ? kind === 'bank' : kind === 'lane';
      let next = s;
      if (linkWay) {
        const m = applyCrossing({ ...s, x: walkX.value }, walkX.value);
        if (m !== s) next = m;
      }
      if (next === s) next = applyDepth(s, dirWord);
      if (next === s || next.pos.strip === s.pos.strip) return;

      // Freeze the departing scene where it stood; gameplay moves on.
      outX.value = walkX.value;
      const dir = dirWord === 'inward' ? 1 : -1;
      setTrans({ from: s.pos.strip, dir });
      setState(next);
      prog.value = 0;
      prog.value = withTiming(
        1,
        { duration: 520, easing: Easing.inOut(Easing.cubic) },
        (done) => {
          'worklet';
          if (done) runOnJS(clearTrans)();
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearTrans],
  );

  // The initializer runs during render but the handlers it builds run
  // only on touches, long after - the refs `depth` reads through this
  // closure are never read during a render. Same false-positive class
  // as useSharedValue writes.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    Gesture.Pan()
      .onChange((e) => {
        'worklet';
        if (Math.abs(e.translationY) > 56
            && Math.abs(e.translationY) > Math.abs(e.translationX) * 1.4) {
          return;
        }
        walkX.value = clampTo(walkX.value - e.changeX, stripMax.value);
      })
      .onFinalize((e) => {
        'worklet';
        if (Math.abs(e.translationY) > 56
            && Math.abs(e.translationY) > Math.abs(e.translationX) * 1.4) {
          runOnJS(depth)(e.translationY > 0 ? 'outward' : 'inward');
          return;
        }
        walkX.value = withDecay({
          velocity: -e.velocityX,
          deceleration: 0.996,
          clamp: [0, stripMax.value],
        });
      }),
  );

  const crossings = state.pos.crossed.length;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    stripMax.value = (() => {
      const lay = layoutFor(state.pos.strip, bandH);
      return lay ? lay.length : stripById(state.pos.strip).length;
    })();
    // eslint-disable-next-line react-hooks/immutability
    walkX.value = state.x;
    // Keyed on the crossing and the strip, never on x.
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
            outX={outX}
            width={width}
            height={height}
            drain={drain}
            stripId={state.pos.strip}
            fromStrip={trans?.from ?? null}
            dir={trans?.dir ?? 1}
            prog={prog}
          />
        </View>
      </GestureDetector>

      {!trans && atWater(state) && reflection(state).visible ? (
        <View style={[styles.water, { top: height * 0.62 }]} pointerEvents="none">
          <View style={styles.flames}>
            {Array.from({ length: reflection(state).flames }).map((_, i) => (
              <View key={i} style={styles.flame} />
            ))}
          </View>
        </View>
      ) : null}

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
      <Text style={styles.stamp}>b37</Text>
    </GestureHandlerRootView>
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
