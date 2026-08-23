import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Image as RNImage, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { PAPER, PEACH_RED, SOOT, XUAN } from '../palette';
import {
  beginNight,
  call as watchCall,
  drainAmount,
  lookBack,
  move as moveNode,
  node as nodeOf,
  pointIndex,
  relight,
  takeBlocks,
  tick as tickNight,
  watchmanCalling,
  type TownState,
  type Way,
} from '../engine/nodes';
import { OVERLAYS, targetAt, type Act, type OverlayId } from '../content/targets';
import { castAt } from '../content/asks';
import { CHAR_MS, holdMs, linesFor, revealMs, type Line, type Trigger } from '../content/lines';
import { useSoundscape } from './useSoundscape';

/** Ink with a glowing paper outline: a wide soft halo underneath,
 *  four offset paper copies forming a true outline, and the soot
 *  glyph on top. Shadows alone were not enough against the paintings
 *  (Simon, b50 and b51). Font scaling is capped: at Simon's max text
 *  size the uncapped lines ran off the page - these are painted
 *  words on art, not body text, so they grow a little and no more. */
const OUTLINE = [
  { x: -1.5, y: 0 }, { x: 1.5, y: 0 }, { x: 0, y: -1.5 }, { x: 0, y: 1.5 },
];
function GlowText({ text, base, cap }: { text: string; base: object; cap: number }) {
  return (
    <View>
      <Text style={[base, styles.glowWide]} maxFontSizeMultiplier={cap}>
        {text}
      </Text>
      {OUTLINE.map((o) => (
        <Text
          key={`${o.x},${o.y}`}
          style={[base, styles.outline, styles.stacked,
            { transform: [{ translateX: o.x }, { translateY: o.y }] }]}
          maxFontSizeMultiplier={cap}
        >
          {text}
        </Text>
      ))}
      <Text style={[base, styles.inkTop, styles.stacked]} maxFontSizeMultiplier={cap}>
        {text}
      </Text>
    </View>
  );
}

/** A spoken line: the characters settle one by one like a brush
 *  laying them down, then the English breathes in beneath. */
function LineView({ line, top }: { line: Line; top: number }) {
  const chars = line.zh.split('');
  return (
    <Animated.View
      key={line.id}
      exiting={FadeOut.duration(400)}
      style={[styles.line, { top }]}
      pointerEvents="none"
    >
      <View style={styles.lineZhRow}>
        {chars.map((ch, i) => (
          <Animated.View
            key={`${line.id}-${i}`}
            entering={FadeIn.delay(i * CHAR_MS).duration(560)}
          >
            <GlowText text={ch} base={styles.lineZh} cap={1.2} />
          </Animated.View>
        ))}
      </View>
      <Animated.View
        entering={FadeIn.delay(chars.length * CHAR_MS + 320).duration(800)}
      >
        <GlowText text={line.en} base={styles.lineEn} cap={1.35} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * DECISIONS 109, the proof. The world is discrete screens: each place
 * is ONE complete painting, and moving PHASES to the neighbouring one.
 * Nothing tiles, nothing abuts, nothing repeats - so nothing can seam.
 *
 * Everything is mounted once and driven by shared values, per this
 * app's standing rule: nothing mounts or decodes during a gesture.
 *
 * The verdict came back yes, so the systems live here now: fires, the
 * watches, the rite, warmth, the drain. src/engine/nodes.ts owns the
 * meaning; this file owns touches and pixels.
 */

/** Paintings by node id. The GRAPH lives in src/engine/nodes.ts; this
 *  is only where the files are. Index order is the identity the shared
 *  values use. */
const SCREENS = [
  {
    id: 'gate',
    live: require('../../assets/screens/gate.png'),
    dead: require('../../assets/screens-drained/gate.png'),
  },
  {
    id: 'gatelane',
    live: require('../../assets/screens/gatelane.png'),
    dead: require('../../assets/screens-drained/gatelane.png'),
  },
  {
    id: 'mooring',
    live: require('../../assets/screens/mooring.png'),
    dead: require('../../assets/screens-drained/mooring.png'),
  },
  {
    id: 'water',
    live: require('../../assets/screens/water.png'),
    dead: require('../../assets/screens-drained/water.png'),
  },
  {
    id: 'bridge',
    live: require('../../assets/screens/bridge.png'),
    dead: require('../../assets/screens-drained/bridge.png'),
  },
  {
    id: 'bank-east',
    live: require('../../assets/screens/bank-east.png'),
    dead: require('../../assets/screens-drained/bank-east.png'),
  },
  {
    id: 'east-water',
    live: require('../../assets/screens/east-water.png'),
    dead: require('../../assets/screens-drained/east-water.png'),
  },
  {
    id: 'bridge-b',
    live: require('../../assets/screens/bridge-b.png'),
    dead: require('../../assets/screens-drained/bridge-b.png'),
  },
  {
    id: 'bank-end',
    live: require('../../assets/screens/bank-end.png'),
    dead: require('../../assets/screens-drained/bank-end.png'),
  },
  {
    id: 'alley',
    live: require('../../assets/screens/alley.png'),
    dead: require('../../assets/screens-drained/alley.png'),
  },
  {
    id: 'alley-deep',
    live: require('../../assets/screens/alley-deep.png'),
    dead: require('../../assets/screens-drained/alley-deep.png'),
  },
  {
    id: 'junction',
    live: require('../../assets/screens/junction.png'),
    dead: require('../../assets/screens-drained/junction.png'),
  },
  {
    id: 'lantern',
    live: require('../../assets/screens/lantern.png'),
    dead: require('../../assets/screens-drained/lantern.png'),
  },
  {
    id: 'house-lamp',
    live: require('../../assets/screens/house-lamp.png'),
    dead: require('../../assets/screens-drained/house-lamp.png'),
  },
  {
    id: 'neighbours-wall',
    live: require('../../assets/screens/neighbours-wall.png'),
    dead: require('../../assets/screens-drained/neighbours-wall.png'),
  },
  {
    id: 'inland-west',
    live: require('../../assets/screens/inland-west.png'),
    dead: require('../../assets/screens-drained/inland-west.png'),
  },
  {
    id: 'inland-east',
    live: require('../../assets/screens/inland-east.png'),
    dead: require('../../assets/screens-drained/inland-east.png'),
  },
  {
    id: 'inland-water',
    live: require('../../assets/screens/inland-water.png'),
    dead: require('../../assets/screens-drained/inland-water.png'),
  },
] as const;

const IDX: Record<string, number> = Object.fromEntries(
  SCREENS.map((s2, i) => [s2.id, i]),
);

/** The graph flattened for the UI thread: EXITS[idx][way] is the
 *  destination index or -1; FORK[idx] marks a touch-chosen fork.
 *  Plain arrays, captured by the gesture worklet. */
const WAYS: Way[] = ['left', 'right', 'up', 'down'];
const EXITS: number[][] = SCREENS.map((s2) =>
  WAYS.map((w) => {
    const to = nodeOf(s2.id).exits[w];
    return to && IDX[to] !== undefined ? IDX[to] : -1;
  }),
);
const FORK: boolean[] = SCREENS.map((s2) => !!nodeOf(s2.id).fork);
/** LEAN[idx] is true where the down exit goes to the water's edge:
 *  her feet are the bottom edge of every painting, and on a bank that
 *  edge is water, so stepping back is impossible - going to the water
 *  is a LEAN (DECISIONS 67/110), chosen by touching the water, and a
 *  swipe down refuses. */
const LEAN: boolean[] = SCREENS.map((s2) => {
  const to = nodeOf(s2.id).exits.down;
  return !!to && !!nodeOf(to).water;
});

/** The paintings' pixel sizes, from the asset registry, so touch
 *  targets and overlays authored in PAINTING fractions can be placed
 *  on the phone under the width-fit / bottom-anchor rule. */
const PAINT_SIZE: { w: number; h: number }[] = SCREENS.map((s2) => {
  const src = RNImage.resolveAssetSource(s2.live);
  return { w: src?.width ?? 1000, h: src?.height ?? 2048 };
});
function paintGeo(idx: number, width: number, height: number) {
  const { w, h } = PAINT_SIZE[idx];
  const s = width / w;
  const ph = h * s;
  return { s, ph, top: height - ph };
}

const PLATES: Record<OverlayId, number> = {
  jiaobei: require('../../assets/figures/jiaobei.png'),
};

/** One plate composited on one screen, in the painting's own
 *  proportions. Drawn at full opacity only while that screen is the
 *  current one and not phasing. */
function PlateLayer({
  plate, nodeIdx, x, y, w, phase, width, height, show,
}: {
  plate: OverlayId; nodeIdx: number; x: number; y: number; w: number;
  phase: {
    curIdx: SharedValue<number>; fromIdx: SharedValue<number>;
    prog: SharedValue<number>; dir: SharedValue<number>; axis: SharedValue<number>;
  };
  width: number; height: number;
  /** Optional extra gate (the thrown blocks). */
  show?: SharedValue<number>;
}) {
  const img = useImage(PLATES[plate]);
  const geo = paintGeo(nodeIdx, width, height);
  const pw = width * w;
  const ph = img ? pw * (img.height() / img.width()) : pw;
  const px = width * x - pw / 2;
  const py = geo.top + geo.ph * y - ph;
  const { transform, opacity: phaseOpacity } = usePhase(
    nodeIdx, phase.curIdx, phase.fromIdx, phase.prog, phase.dir, phase.axis, width, height,
  );
  const opacity = useDerivedValue(
    () => phaseOpacity.value * (show ? show.value : 1),
    [],
  );
  if (!img) return null;
  return (
    <Group transform={transform}>
      <SkImage image={img} x={px} y={py} width={pw} height={ph} fit="fill" opacity={opacity} />
    </Group>
  );
}

/** What she sees when she looks back: the screen she came from,
 *  DRAINED, over everything, for the length of the turn. */
function GlanceLayer({
  src, glance, width, height,
}: {
  src: number | null; glance: SharedValue<number>; width: number; height: number;
}) {
  const img = useImage(src);
  const opacity = useDerivedValue(() => glance.value, []);
  if (!img || src === null) return null;
  const s = width / img.width();
  const h = img.height() * s;
  return <SkImage image={img} x={0} y={height - h} width={width} height={h} fit="fill" opacity={opacity} />;
}

/** One real minute per point in the demo; ships at 1. */
const DEMO_TIME_SCALE = 60;

/** The phase: leaving drifts a quarter-screen and thins; arriving
 *  comes the last sixth of the way and solidifies. Both directions on
 *  the UI thread, 640ms, eased both ends. */
const PHASE_MS = 640;

/** The phase choreography for whatever is drawn as part of screen idx:
 *  the painting itself and any plate composited onto it move and fade
 *  as one. ONE verb (Simon, b56): every move is a step into the next
 *  place - the arriving picture grows from within while the leaving one
 *  swells past and thins; only stepping BACK (down) reverses it. */
function usePhase(
  idx: number,
  curIdx: SharedValue<number>, fromIdx: SharedValue<number>,
  prog: SharedValue<number>, dir: SharedValue<number>, axis: SharedValue<number>,
  width: number, height: number,
) {
  const transform = useDerivedValue(() => {
    const isCur = idx === curIdx.value && fromIdx.value >= 0;
    const isFrom = idx === fromIdx.value;
    if (!isCur && !isFrom) return [];
    const p = prog.value;
    const back = axis.value === 1 && dir.value > 0;
    let sc: number;
    if (!back) sc = isCur ? 0.88 + 0.12 * p : 1 + 0.18 * p;
    else sc = isCur ? 1.14 - 0.14 * p : 1 - 0.12 * p;
    const cx = width / 2;
    const cy = height / 2;
    return [
      { translateX: cx }, { translateY: cy }, { scale: sc },
      { translateX: -cx }, { translateY: -cy },
    ];
  }, [idx, width, height]);
  const opacity = useDerivedValue(() => {
    const p = prog.value;
    if (idx === curIdx.value) return fromIdx.value < 0 ? 1 : p;
    if (idx === fromIdx.value) return 1 - p;
    return 0;
  }, [idx]);
  return { transform, opacity };
}

function ScreenLayer({
  idx, src, deadSrc, drain, curIdx, fromIdx, prog, dir, axis, width, height,
}: {
  idx: number;
  src: number;
  deadSrc: number;
  drain: number;
  curIdx: SharedValue<number>;
  fromIdx: SharedValue<number>;
  prog: SharedValue<number>;
  dir: SharedValue<number>;
  /** 0 = horizontal phase, 1 = vertical (the depth step). */
  axis: SharedValue<number>;
  width: number;
  height: number;
}) {
  const image = useImage(src);
  const deadImage = useImage(deadSrc);
  // DECISIONS 110: the whole painting, always. Fit the WIDTH so the
  // arrivals at the left and right edges are never cropped away, and
  // anchor the BOTTOM so the ground she stands on is kept; a painting
  // shorter than the phone leaves bare xuan paper above it, which is
  // 留白 and the medium's own habit. A taller one loses only mist.
  const dims = image
    ? (() => {
        const s = width / image.width();
        const w = width;
        const h = image.height() * s;
        return { w, h, x: 0, y: height - h };
      })()
    : null;

  const { transform, opacity } = usePhase(idx, curIdx, fromIdx, prog, dir, axis, width, height);

  const deadOpacity = useDerivedValue(() => opacity.value * drain, [drain]);
  if (!image || !dims) return null;
  return (
    <Group transform={transform}>
      <SkImage
        image={image}
        x={dims.x}
        y={dims.y}
        width={dims.w}
        height={dims.h}
        fit="fill"
        opacity={opacity}
      />
      {deadImage && drain > 0 ? (
        <SkImage
          image={deadImage}
          x={dims.x}
          y={dims.y}
          width={dims.w}
          height={dims.h}
          fit="fill"
          opacity={deadOpacity}
        />
      ) : null}
    </Group>
  );
}

/** The watchman crossing the mooring (OPENING beat 5, DECISIONS 89).
 *  walk runs 0..1 once: he comes in from the right along the bank,
 *  greets her mid-way, and at the foot of the alley steps goes up the
 *  way she came, thinning into the mist. Drawn only on the mooring.
 *  Figure scale is relative to the painting, so the plate sits in the
 *  town's own proportions however the phone frames it. */
const WATCHMAN = require('../../assets/figures/watchman.png');
const MOORING_IDX = IDX.mooring;
function WatchmanLayer({
  walk, curIdx, width, height,
}: {
  walk: SharedValue<number>;
  curIdx: SharedValue<number>;
  width: number;
  height: number;
}) {
  const fig = useImage(WATCHMAN);
  const painting = useImage(SCREENS[MOORING_IDX].live);
  const geo = painting
    ? (() => {
        const s = width / painting.width();
        const ph = painting.height() * s;
        const top = height - ph;
        const fh = ph * 0.085;                 // a man against the town
        const fw = fig ? fh * (fig.width() / fig.height()) : fh * 0.7;
        return { top, ph, fh, fw };
      })()
    : null;
  const transform = useDerivedValue(() => {
    if (!geo) return [];
    const w = walk.value;
    const along = Math.min(w / 0.7, 1);
    const up = Math.max(0, (w - 0.7) / 0.3);
    const x = width * (0.98 - 0.50 * along);
    const feet = geo.top + geo.ph * 0.80 - geo.ph * 0.05 * up;
    const sc = 1 - 0.45 * up;
    return [
      { translateX: x }, { translateY: feet },
      { scale: sc },
      { translateX: -geo.fw / 2 }, { translateY: -geo.fh },
    ];
  }, [geo, width]);
  const opacity = useDerivedValue(() => {
    const w = walk.value;
    if (curIdx.value !== MOORING_IDX || w <= 0 || w >= 1) return 0;
    return w < 0.7 ? 1 : 1 - (w - 0.7) / 0.3;
  }, []);
  if (!fig || !geo) return null;
  return (
    <Group transform={transform}>
      <SkImage image={fig} x={0} y={0} width={geo.fw} height={geo.fh}
        fit="fill" opacity={opacity} />
    </Group>
  );
}

const TownCanvas = memo(function TownCanvas({
  width, height, drain, shared, cast, glanceSrc,
}: {
  width: number;
  height: number;
  drain: number;
  shared: {
    curIdx: SharedValue<number>;
    fromIdx: SharedValue<number>;
    prog: SharedValue<number>;
    dir: SharedValue<number>;
    axis: SharedValue<number>;
    walk: SharedValue<number>;
    castShow: SharedValue<number>;
    glance: SharedValue<number>;
  };
  cast: { idx: number } | null;
  glanceSrc: number | null;
}) {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height} color={XUAN} />
      {SCREENS.map((s, i) => (
        <ScreenLayer
          key={s.id}
          idx={i}
          src={s.live}
          deadSrc={s.dead}
          drain={drain}
          curIdx={shared.curIdx}
          fromIdx={shared.fromIdx}
          prog={shared.prog}
          dir={shared.dir}
          axis={shared.axis}
          width={width}
          height={height}
        />
      ))}
      {OVERLAYS.map((o) => (
        <PlateLayer
          key={`${o.node}-${o.plate}`}
          plate={o.plate} nodeIdx={IDX[o.node]} x={o.x} y={o.y} w={o.w}
          phase={shared} width={width} height={height}
        />
      ))}
      {cast ? (
        <PlateLayer
          plate="jiaobei" nodeIdx={cast.idx} x={0.5} y={0.985} w={0.2}
          phase={shared} width={width} height={height}
          show={shared.castShow}
        />
      ) : null}
      <WatchmanLayer walk={shared.walk} curIdx={shared.curIdx} width={width} height={height} />
      <GlanceLayer src={glanceSrc} glance={shared.glance} width={width} height={height} />
    </Canvas>
  );
});

/** Which way a drag is going, once it is clearly going somewhere.
 *  THE FINGER'S DIRECTION IS HER DIRECTION on both axes (Simon, b57):
 *  swipe left, she goes left; swipe up, she goes deeper. Nothing
 *  slides under the finger any more, so the scrolling convention
 *  (drag the world left to go right) had nothing left to justify it. */
function wayFrom(tx: number, ty: number): number {
  'worklet';
  const ax = Math.abs(tx);
  const ay = Math.abs(ty);
  if (Math.max(ax, ay) < 14) return -1;
  if (ay > ax * 1.2) return ty < 0 ? 2 : 3;
  if (ax > ay * 1.2) return tx < 0 ? 0 : 1;
  return -1;
}

/** How far the finger has travelled ALONG the chosen way. */
function alongWay(w: number, tx: number, ty: number): number {
  'worklet';
  if (w === 0) return -tx;
  if (w === 1) return tx;
  if (w === 2) return -ty;
  return ty;
}

/** A flick along the way commits even from a short drag. */
function flungAlong(w: number, vx: number, vy: number): boolean {
  'worklet';
  return (w === 0 && vx < -600) || (w === 1 && vx > 600)
    || (w === 2 && vy < -600) || (w === 3 && vy > 600);
}

/** Her voice: one line at a time, queued, once-lines kept for the
 *  night. The content lives in src/content/lines.ts; this is only the
 *  throat. holdUntilSV is the gesture's gate - while a line prints,
 *  she does not walk. */
function useHerVoice() {
  const holdUntilSV = useSharedValue(0);
  const [line, setLine] = useState<Line | null>(null);
  const seen = useRef(new Set<string>());
  const lineQueue = useRef<Line[]>([]);
  const speaking = useRef(false);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNext = useCallback(function show() {
    const next = lineQueue.current.shift() ?? null;
    setLine(next);
    if (next) {
      // A once-line counts as heard when it is SHOWN, not when it is
      // queued - a line swept away by a move can still play later.
      if (next.once) seen.current.add(next.id);
      // While the line prints, she does not walk (Simon, b52).
      holdUntilSV.value = Date.now() + revealMs(next);
      lineTimer.current = setTimeout(show, holdMs(next));
    } else {
      speaking.current = false;
    }
  }, []);

  const speak = useCallback(
    (nodeId: string, trigger: Trigger) => {
      const pending = new Set(lineQueue.current.map((l) => l.id));
      const due = linesFor(nodeId, trigger, seen.current).filter(
        (l) => !pending.has(l.id),
      );
      if (!due.length) return;
      lineQueue.current.push(...due);
      if (!speaking.current) {
        speaking.current = true;
        showNext();
      }
    },
    [showNext],
  );

  // Her thoughts belong to the place she is standing. Moving sweeps
  // the current line and everything queued - the wall's line must
  // never play over the house (Simon, b51).
  const hushOnMove = useCallback(() => {
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineQueue.current = [];
    speaking.current = false;
    holdUntilSV.value = 0;
    setLine(null);
  }, []);

  useEffect(
    () => () => {
      if (lineTimer.current) clearTimeout(lineTimer.current);
    },
    [],
  );

  return { line, speak, hush: hushOnMove, holdUntilSV };
}

/** LOOK BACK as a HOLD (FIRST-WATCH question 1, ratified): she stops
 *  and turns; the screen she came from shows DRAINED behind her for
 *  the length of the turn - the dead town is what you see when you
 *  look behind you - and a flame is out. Let go early and she only
 *  began to turn: no cost. */
function useGlance({
  busySV, refuse, stateRef, setState,
}: {
  busySV: SharedValue<number>;
  refuse: () => void;
  stateRef: React.MutableRefObject<TownState>;
  setState: React.Dispatch<React.SetStateAction<TownState>>;
}) {
  const glance = useSharedValue(0);
  const [glanceSrc, setGlanceSrc] = useState<number | null>(null);
  const glanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const glanceStart = useCallback(() => {
    const st = stateRef.current;
    if (busySV.value || !st.prevNodeId || st.fires === 0) { refuse(); return; }
    setGlanceSrc(SCREENS[IDX[st.prevNodeId]].dead);
    // eslint-disable-next-line react-hooks/immutability
    glance.value = withTiming(0.9, { duration: 380 });
    glanceTimer.current = setTimeout(() => {
      glanceTimer.current = null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setState(lookBack);
      glance.value = withTiming(0, { duration: 420 }, (done) => {
        'worklet';
        if (done) runOnJS(setGlanceSrc)(null);
      });
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refuse]);

  const glanceEnd = useCallback(() => {
    if (glanceTimer.current) {
      clearTimeout(glanceTimer.current);
      glanceTimer.current = null;
      // eslint-disable-next-line react-hooks/immutability
      glance.value = withTiming(0, { duration: 220 }, (done) => {
        'worklet';
        if (done) runOnJS(setGlanceSrc)(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { glance, glanceSrc, glanceStart, glanceEnd };
}

/** What her hands do to the things in the paintings (FIRST-WATCH):
 *  the touchable things, and the blocks thrown at her feet. */
function useActs({
  speak, soundscape, setState, stateRef, castShow, setCast,
}: {
  speak: (node: string, trigger: Trigger) => void;
  soundscape: { touch(): void; clatter(): void };
  setState: React.Dispatch<React.SetStateAction<TownState>>;
  stateRef: React.MutableRefObject<TownState>;
  castShow: SharedValue<number>;
  setCast: (c: { idx: number } | null) => void;
}) {
  /** 擲筊: the blocks clatter and land at her feet; the world names
   *  the cast. The question is always "this way?" of where she stands.
   *  (castShow is a shared value, mutable by Reanimated's contract.) */
  // eslint-disable-next-line react-hooks/immutability
  const throwBlocks = useCallback(() => {
    const id = stateRef.current.nodeId;
    soundscape.clatter();
    setCast({ idx: IDX[id] });
    // eslint-disable-next-line react-hooks/immutability
    castShow.value = 0;
    // eslint-disable-next-line react-hooks/immutability
    castShow.value = withTiming(1, { duration: 180 });
    setTimeout(() => {
      castShow.value = withTiming(0, { duration: 500 });
    }, 3200);
    setTimeout(() => speak(id, `cast-${castAt(id)}`), 420);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, soundscape]);

  /** What touching a thing in the painting does. */
  const actOn = useCallback(
    (act: Act, st: TownState) => {
      Haptics.selectionAsync().catch(() => {});
      if (act === 'studs') { soundscape.touch(); speak('gate', 'touch'); }
      else if (act === 'door-gods') speak('bank-east', 'door-gods');
      else if (act === 'road-money') speak('bank-end', 'road-money');
      else if (act === 'shrine') {
        if (!st.blocks) { setState(takeBlocks); speak('inland-east', 'shrine'); }
      } else if (act === 'stone' && st.fires < 3) {
        // The lock on district two: a stone to the living, a refusal to
        // the rest. The lane beyond arrives with district two.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        speak('bank-end', 'stone-refuses');
      }
    },
    [speak, soundscape],
  );

  return { actOn, throwBlocks };
}

export function Town() {
  const { width, height } = useWindowDimensions();
  const curIdx = useSharedValue(0);
  const fromIdx = useSharedValue(-1);
  const prog = useSharedValue(1);
  const dir = useSharedValue(1);
  const axis = useSharedValue(0);
  // Gates the gesture worklet reads directly: a phase in flight, and a
  // line still printing (DECISIONS: she does not walk mid-sentence).
  const WIDTH_SV = useSharedValue(width);
  const HEIGHT_SV = useSharedValue(height);
  useEffect(() => {
    WIDTH_SV.value = width;
    HEIGHT_SV.value = height;
  }, [width, height, WIDTH_SV, HEIGHT_SV]);
  const busySV = useSharedValue(0);
  const previewWay = useSharedValue(-1);
  const walk = useSharedValue(0);
  const metWatchman = useRef(false);
  const castShow = useSharedValue(0);
  const [cast, setCast] = useState<{ idx: number } | null>(null);
  const calledOnce = useRef(false);
  const prevFires = useRef(3);
  const [state, setState] = useState<TownState>(() => beginNight('gate'));
  const soundscape = useSoundscape(state);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // The night runs whether or not she moves.
  useEffect(() => {
    const id = setInterval(
      () => setState((s) => tickNight(s, 100, DEMO_TIME_SCALE)),
      100,
    );
    return () => clearInterval(id);
  }, []);

  const { line, speak, hush: hushOnMove, holdUntilSV } = useHerVoice();

  const settle = useCallback(() => {
    busySV.value = 0;
    const id = stateRef.current.nodeId;
    speak(id, 'enter');
    if (nodeOf(id).water && stateRef.current.fires === 3) speak(id, 'flames');
    // The watchman, once: he crosses, he greets her by name, he goes
    // up the way she came. His clapper sounds twice as he walks.
    if (id === 'mooring' && !metWatchman.current) {
      metWatchman.current = true;
      walk.value = 0;
      walk.value = withTiming(1, { duration: 7600, easing: Easing.linear });
      setTimeout(() => soundscape.clap(), 900);
      setTimeout(() => soundscape.clap(), 1700);
      // A living body passing close (84): if she is short and still
      // here as he passes, one flame comes back, unexplained.
      setTimeout(() => {
        if (stateRef.current.nodeId === 'mooring' && stateRef.current.fires < 3) {
          Haptics.selectionAsync().catch(() => {});
          setState(relight);
        }
      }, 3600);
      setTimeout(() => {
        // If she has already walked off, he keeps his greeting for the
        // next time she passes - he is out all night.
        if (stateRef.current.nodeId === 'mooring') speak('mooring', 'scripted');
        else { metWatchman.current = false; walk.value = 0; }
      }, 2800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  const refuse = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  /** The engine side of a move: the rite, the haptics, the state.
   *  Visual choreography is the caller's (the drag, or move()). */
  const commit = useCallback(
    (way: Way): boolean => {
      const m = moveNode(stateRef.current, way);
      if (!m.moved) return false;
      hushOnMove();
      if (m.costAFlame) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      } else {
        Haptics.selectionAsync().catch(() => {});
      }
      setState(m.state);
      return true;
    },
    [hushOnMove],
  );

  /** A move not driven by a drag - a fork chosen by touch. Forks are
   *  two ways AHEAD, so the phase is always the dolly inward. */
  const move = useCallback(
    (way: Way, visual: { axis: 0 | 1; dir: 1 | -1 }) => {
      if (busySV.value) return;
      if (Date.now() < holdUntilSV.value) { refuse(); return; }
      const from = curIdx.value;
      const dest = EXITS[from][WAYS.indexOf(way)];
      if (dest < 0) { refuse(); return; }
      // Shared values are mutable by Reanimated's contract; the React
      // Compiler rule cannot see that.
      // eslint-disable-next-line react-hooks/immutability
      busySV.value = 1;
      if (!commit(way)) { busySV.value = 0; return; }
      fromIdx.value = from;
      curIdx.value = dest;
      axis.value = visual.axis;
      dir.value = visual.dir;
      prog.value = 0;
      prog.value = withTiming(
        1,
        { duration: PHASE_MS, easing: Easing.inOut(Easing.cubic) },
        (done) => {
          'worklet';
          if (done) {
            fromIdx.value = -1;
            runOnJS(settle)();
          }
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, refuse, settle],
  );

  /** The drag landed: the engine moves, the picture finishes arriving. */
  const land = useCallback(
    (wayIdx: number) => {
      const way = WAYS[wayIdx];
      if (!commit(way)) {
        // The world refused after all - put the picture back.
        // eslint-disable-next-line react-hooks/immutability
        prog.value = withTiming(0, { duration: 200 }, (done) => {
          'worklet';
          if (done) {
            curIdx.value = fromIdx.value;
            fromIdx.value = -1;
            busySV.value = 0;
          }
        });
        return;
      }
      const left = 1 - prog.value;
      prog.value = withTiming(
        1,
        { duration: 140 + PHASE_MS * 0.7 * left, easing: Easing.out(Easing.cubic) },
        (done) => {
          'worklet';
          if (done) {
            fromIdx.value = -1;
            runOnJS(settle)();
          }
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, settle],
  );

  // Touch targets on the paintings. The bronze studs are the first
  // (OPENING beat 2): the game's first working input is a touch, not
  // a swipe. Regions are fractions of the displayed frame.
  const dimsRef = useRef({ width, height });
  useEffect(() => {
    dimsRef.current = { width, height };
  }, [width, height]);
  const { actOn, throwBlocks } = useActs({
    speak, soundscape, setState, stateRef, castShow, setCast,
  });

  const touch = useCallback(
    (x: number, y: number) => {
      if (busySV.value) return;
      const { width: w, height: h } = dimsRef.current;
      const st = stateRef.current;
      const here = nodeOf(st.nodeId);
      // Things in the painting first - authored in painting fractions.
      const geo = paintGeo(IDX[here.id], w, h);
      const hit = targetAt(here.id, x / w, (y - geo.top) / geo.ph);
      if (hit) { actOn(hit.act, st); return; }
      // A fork (DECISIONS 110): tap the mouth you want. Both ways are
      // ahead, so the phase is the dolly inward either way.
      if (here.fork && y < h * 0.7) {
        move(x < w / 2 ? 'left' : 'right', { axis: 1, dir: -1 });
        return;
      }
      // The blocks: tap the ground at her feet.
      if (st.blocks && y > h * 0.9) { throwBlocks(); return; }
      // The water's edge (DECISIONS 67/110): touch the water and she
      // leans down to it. Not a step - her feet never leave the bank.
      if (LEAN[IDX[here.id]] && y > h * 0.55) {
        move('down', { axis: 1, dir: -1 });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speak, move, soundscape, throwBlocks, actOn],
  );

  const { glance, glanceSrc, glanceStart, glanceEnd } = useGlance({
    busySV, refuse, stateRef, setState,
  });

  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    Gesture.Race(
      Gesture.Exclusive(
        Gesture.LongPress()
          .minDuration(420)
          .maxDistance(18)
          .onStart(() => {
            'worklet';
            runOnJS(glanceStart)();
          })
          .onFinalize(() => {
            'worklet';
            runOnJS(glanceEnd)();
          }),
        Gesture.Tap()
          .maxDuration(260)
          .onEnd((e) => {
            'worklet';
            runOnJS(touch)(e.x, e.y);
          }),
      ),
      Gesture.Pan()
        .minDistance(10)
        .onUpdate((e) => {
          'worklet';
          if (previewWay.value === -1) {
            const way = wayFrom(e.translationX, e.translationY);
            if (way < 0) return;
            const cur = curIdx.value;
            const blocked =
              busySV.value === 1 ||
              Date.now() < holdUntilSV.value ||
              (FORK[cur] && way !== 3) ||
              (LEAN[cur] && way === 3) ||
              EXITS[cur][way] < 0;
            if (blocked) {
              previewWay.value = -2;
              runOnJS(refuse)();
              return;
            }
            previewWay.value = way;
            fromIdx.value = cur;
            curIdx.value = EXITS[cur][way];
            axis.value = way < 2 ? 0 : 1;
            dir.value = way === 1 || way === 3 ? 1 : -1;
            prog.value = 0;
          }
          const w = previewWay.value;
          if (w < 0) return;
          const travel = w < 2 ? WIDTH_SV.value * 0.6 : HEIGHT_SV.value * 0.45;
          const along = alongWay(w, e.translationX, e.translationY);
          prog.value = Math.min(1, Math.max(0, along / travel));
        })
        .onEnd((e) => {
          'worklet';
          const w = previewWay.value;
          previewWay.value = -1;
          if (w < 0) return;
          const flung = flungAlong(w, e.velocityX, e.velocityY);
          busySV.value = 1;
          if (prog.value > 0.3 || flung) {
            runOnJS(land)(w);
          } else {
            prog.value = withTiming(0, { duration: 220 }, (done) => {
              'worklet';
              if (done) {
                curIdx.value = fromIdx.value;
                fromIdx.value = -1;
                busySV.value = 0;
              }
            });
          }
        }),
    ),
  );

  // The first relight under the lantern gets its line; the watch's
  // last minutes bring the voice, once, wherever she is.
  useEffect(() => {
    if (state.fires > prevFires.current && state.nodeId === 'lantern') {
      speak('lantern', 'relight');
    }
    prevFires.current = state.fires;
    if (!calledOnce.current && pointIndex(state) >= 5) {
      calledOnce.current = true;
      speak(state.nodeId, 'call');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fires, state.nodeId, state.elapsedMs]);

  const wc = watchCall(state);
  const drain = drainAmount(state);
  const flames = nodeOf(state.nodeId).water && state.fires > 0 ? state.fires : 0;

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill}>
          <TownCanvas
            width={width}
            height={height}
            drain={drain}
            shared={{ curIdx, fromIdx, prog, dir, axis, walk, castShow, glance }}
            cast={cast}
            glanceSrc={glanceSrc}
          />
        </View>
      </GestureDetector>

      {flames > 0 ? (
        <View style={[styles.water, { top: height * 0.66 }]} pointerEvents="none">
          <View style={styles.flames}>
            {Array.from({ length: flames }).map((_, i) => (
              <View key={i} style={styles.flame} />
            ))}
          </View>
        </View>
      ) : null}

      {line ? (
        <LineView key={line.id} line={line} top={height * (line.at ?? 0.72)} />
      ) : null}

      {watchmanCalling(state) ? (
        <View style={styles.call} pointerEvents="none">
          <Text style={styles.callLabel}>{wc.label}</Text>
          <View style={styles.strikes}>
            {Array.from({ length: wc.slow }).map((_, i) => (
              <View key={`s${i}`} style={styles.slow} />
            ))}
            <View style={styles.gap} />
            {Array.from({ length: wc.quick }).map((_, i) => (
              <View key={`q${i}`} style={styles.quick} />
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.stamp}>b64</Text>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: XUAN },
  water: { position: 'absolute', left: 0, right: 0, height: 90, alignItems: 'center' },
  flames: { flexDirection: 'row', gap: 26 },
  flame: {
    width: 7, height: 14, borderRadius: 4,
    backgroundColor: PEACH_RED, opacity: 0.8,
  },
  line: { position: 'absolute', left: 26, right: 26, alignItems: 'center' },
  lineZhRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    maxWidth: 340,
  },
  lineZh: { fontSize: 23, lineHeight: 34, letterSpacing: 3 },
  lineEn: {
    fontSize: 14, lineHeight: 21, textAlign: 'center',
    maxWidth: 330, marginTop: 7,
  },
  stacked: { position: 'absolute', top: 0, left: 0, right: 0 },
  glowWide: {
    color: 'rgba(248,243,231,0.95)',
    textShadowColor: 'rgba(248,243,231,0.95)',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14,
  },
  outline: {
    color: 'rgba(248,243,231,1)',
    textShadowColor: 'rgba(248,243,231,0.9)',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2,
  },
  inkTop: { color: SOOT },
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
