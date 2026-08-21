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
  withSequence,
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
import * as Haptics from 'expo-haptics';

import {
  applyCrossing,
  applyDepth,
  applyWarmth,
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
 * THE DEPTH TRANSITION IS LAYERS PARTING, Year Walk fashion - and the
 * whole town is MOUNTED ONCE. All three strips live in the canvas from
 * launch; which one is visible, which is parting, and how far, is
 * decided per-frame on the UI thread from four shared values (curIdx,
 * fromIdx, prog, dir). A depth swipe touches React only for gameplay
 * state. The first version mounted the incoming strip AT the swipe -
 * image decode and scene build landed exactly where the animation
 * started, which is why it hitched.
 *
 * The departing strip's walk position is FROZEN at the moment the step
 * begins (outX): gameplay has already switched strips and the live
 * walkX belongs to the destination.
 */

/** Every strip in the scene graph, in a fixed order. Index is identity
 *  for the shared values. */
const STRIPS = ['water-north', 'north', 'lane-a'] as const;

function stripIdx(id: string): number {
  return STRIPS.indexOf(id as (typeof STRIPS)[number]);
}

/** How far each plane travels in a transition, as a fraction of screen
 *  height. Depth-ordered: the near layer parts first and furthest. */
const PART = { far: 0.10, mid: 0.34, kerb: 0.62 } as const;

/**
 * Per-frame phase for a strip: settled current, arriving, departing, or
 * hidden - all read from shared values, never from React.
 */
function stripPart(
  idx: number,
  cur: number,
  from: number,
  prog: number,
  dir: number,
  factor: number,
  screenH: number,
): { dy: number; opacity: number } {
  'worklet';
  if (idx === cur) {
    if (from < 0) return { dy: 0, opacity: 1 };
    return {
      dy: -(1 - prog) * dir * factor * screenH * 0.35,
      opacity: prog,
    };
  }
  if (idx === from) {
    return { dy: prog * dir * factor * screenH, opacity: 1 - prog };
  }
  return { dy: 0, opacity: 0 };
}

interface Depth {
  idx: number;
  curIdx: SharedValue<number>;
  fromIdx: SharedValue<number>;
  prog: SharedValue<number>;
  dir: SharedValue<number>;
  walkX: SharedValue<number>;
  outX: SharedValue<number>;
}

function PlaneLayer({
  plane, plate, screenW, screenH, drain, depth,
}: {
  plane: Plane;
  plate: PlateName;
  screenW: number;
  screenH: number;
  drain: number;
  depth: Depth;
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
          tileW={tileW}
          band={band}
          live={live}
          dead={dead}
          drain={drain}
          depth={depth}
          factor={factor}
          screenH={screenH}
        />
      ))}
    </Group>
  );
}

function Slot({
  plane, slot, tileW, band, live, dead, drain, depth, factor, screenH,
}: {
  plane: Plane;
  slot: number;
  tileW: number;
  band: { y: number; height: number };
  live: NonNullable<ReturnType<typeof useImage>>;
  dead: ReturnType<typeof useImage>;
  drain: number;
  depth: Depth;
  factor: number;
  screenH: number;
}) {
  const transform = useDerivedValue(() => {
    const x = depth.idx === depth.curIdx.value ? depth.walkX.value : depth.outX.value;
    const part = stripPart(
      depth.idx, depth.curIdx.value, depth.fromIdx.value,
      depth.prog.value, depth.dir.value, factor, screenH,
    );
    return [
      { translateX: slotX(plane, x, tileW, slot) },
      { translateY: part.dy },
    ];
  }, [plane, tileW, slot, factor, screenH, depth]);
  const opLive = useDerivedValue(
    () => stripPart(
      depth.idx, depth.curIdx.value, depth.fromIdx.value,
      depth.prog.value, depth.dir.value, factor, screenH,
    ).opacity,
    [factor, screenH, depth],
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
  stripId, screenH, drain, depth,
}: {
  stripId: string;
  screenH: number;
  drain: number;
  depth: Depth;
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
          drain={drain}
          depth={depth}
          screenH={screenH}
        />
      ))}
    </Group>
  );
}

function WalkwayPlate({
  plate, x, y, w, h, drain, depth, screenH,
}: {
  plate: PlateName; x: number; y: number; w: number; h: number;
  drain: number; depth: Depth; screenH: number;
}) {
  const live = useImage(LIVE[plate]);
  const dead = useImage(DEAD[plate]);
  const transform = useDerivedValue(() => {
    const xv = depth.idx === depth.curIdx.value ? depth.walkX.value : depth.outX.value;
    const part = stripPart(
      depth.idx, depth.curIdx.value, depth.fromIdx.value,
      depth.prog.value, depth.dir.value, PART.mid, screenH,
    );
    return [{ translateX: x - xv }, { translateY: part.dy }];
  }, [x, screenH, depth]);
  const opLive = useDerivedValue(
    () => stripPart(
      depth.idx, depth.curIdx.value, depth.fromIdx.value,
      depth.prog.value, depth.dir.value, PART.mid, screenH,
    ).opacity,
    [screenH, depth],
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

/**
 * 水鬼. DECISIONS 84: at zero fires the dead stop hiding. The drowned
 * stands in the water - always mounted, per this file's one rule, and
 * visible only when she is fully out. No sting, no text: step to the
 * water with no flames left, and someone is there.
 */
function Drowned({
  depth, screenH, visible,
}: {
  depth: Depth; screenH: number; visible: boolean;
}) {
  const image = useImage(LIVE['shuigui']);
  const h = screenH * 0.22;
  const w = image ? (h * image.width()) / image.height() : 0;
  const worldX = 1240;
  const transform = useDerivedValue(
    () => [{ translateX: worldX - depth.walkX.value - w / 2 }],
    [w, depth],
  );
  const op = useDerivedValue(() => {
    const part = stripPart(
      depth.idx, depth.curIdx.value, depth.fromIdx.value,
      depth.prog.value, depth.dir.value, PART.kerb, screenH,
    );
    return visible ? part.opacity : 0;
  }, [visible, screenH, depth]);
  if (!image) return null;
  return (
    <Group transform={transform}>
      <SkImage
        image={image}
        x={0}
        y={screenH * 0.56}
        width={w}
        height={h}
        fit="fill"
        opacity={op}
      />
    </Group>
  );
}

function StripLayers({
  stripId, width, height, drain, depth, drowned,
}: {
  stripId: string;
  width: number;
  height: number;
  drain: number;
  depth: Depth;
  drowned: boolean;
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
            screenW={width}
            screenH={height}
            drain={drain}
            depth={depth}
          />
        ) : null;
      })}
      {here.kind === 'bank' ? (
        <Walkway stripId={stripId} screenH={height} drain={drain} depth={depth} />
      ) : null}
      {here.kind === 'water' ? (
        <Drowned depth={depth} screenH={height} visible={drowned} />
      ) : null}
    </Group>
  );
}

const Scene = memo(function Scene({
  width, height, drain, depthBase, drowned,
}: {
  width: number;
  height: number;
  drain: number;
  depthBase: Omit<Depth, 'idx'>;
  drowned: boolean;
}) {
  // Every strip, mounted once, for the app's whole life. Which is
  // visible is a per-frame decision on the UI thread - a depth swipe
  // never mounts, never decodes, never re-renders this tree.
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height} color={PAPER} />
      {STRIPS.map((id, i) => (
        <StripLayers
          key={id}
          stripId={id}
          width={width}
          height={height}
          drain={drain}
          depth={{ ...depthBase, idx: i }}
          drowned={drowned}
        />
      ))}
    </Canvas>
  );
});

export function Walk() {
  const { width, height } = useWindowDimensions();
  const walkX = useSharedValue(0);
  const outX = useSharedValue(0);
  const stripMax = useSharedValue(0);
  const prog = useSharedValue(1);
  const curIdx = useSharedValue(stripIdx('north'));
  const fromIdx = useSharedValue(-1);
  const dirSv = useSharedValue(1);
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
      () => setState((s) =>
        applyWarmth(arriveAt(tick(s, 100), walkX.value, bandH), 100, bandH),
      ),
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
      // Everything the canvas needs is in shared values - React state
      // below is gameplay and overlay gating only.
      outX.value = walkX.value;
      const dir = dirWord === 'inward' ? 1 : -1;
      dirSv.value = dir;
      fromIdx.value = stripIdx(s.pos.strip);
      curIdx.value = stripIdx(next.pos.strip);
      setTrans({ from: s.pos.strip, dir });
      setState(next);
      prog.value = 0;
      prog.value = withTiming(
        1,
        { duration: 520, easing: Easing.inOut(Easing.cubic) },
        (done) => {
          'worklet';
          if (done) {
            fromIdx.value = -1;
            runOnJS(clearTrans)();
          }
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearTrans],
  );

  const doLookBack = useCallback(() => {
    const s = stateRef.current;
    if (transRef.current || s.fires === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState(lookBack);
    // She turns: the world sways back the way she came, and settles.
    const here = walkX.value;
    // eslint-disable-next-line react-hooks/immutability
    walkX.value = withSequence(
      withTiming(Math.max(0, here - 64), { duration: 170, easing: Easing.out(Easing.quad) }),
      withTiming(here, { duration: 340, easing: Easing.inOut(Easing.quad) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The initializer runs during render but the handlers it builds run
  // only on touches, long after - the refs `depth` reads through this
  // closure are never read during a render. Same false-positive class
  // as useSharedValue writes.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    Gesture.Race(
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(260)
        .onEnd(() => {
          'worklet';
          runOnJS(doLookBack)();
        }),
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
    ),
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

  const call = currentCall(state);
  const drain = drainAmount(state);

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill}>
          <Scene
            width={width}
            height={height}
            drain={drain}
            depthBase={{ curIdx, fromIdx, prog, dir: dirSv, walkX, outX }}
            drowned={state.fires === 0}
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

      <Text style={styles.stamp}>b39</Text>
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
  stamp: {
    position: 'absolute', bottom: 34, left: 22,
    color: SOOT, opacity: 0.25, fontSize: 11, letterSpacing: 1,
  },
});
