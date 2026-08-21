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

import { PAPER, PEACH_RED, SOOT } from '../palette';
import {
  beginNight,
  call as watchCall,
  drainAmount,
  lookBack,
  move as moveNode,
  node as nodeOf,
  tick as tickNight,
  watchmanCalling,
  type TownState,
  type Way,
} from '../engine/nodes';
import { CHAR_MS, holdMs, linesFor, revealMs, type Line, type Trigger } from '../content/lines';

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
    id: 'farbank',
    live: require('../../assets/screens/farbank.png'),
    dead: require('../../assets/screens-drained/farbank.png'),
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

/** One real minute per point in the demo; ships at 1. */
const DEMO_TIME_SCALE = 60;

/** The phase: leaving drifts a quarter-screen and thins; arriving
 *  comes the last sixth of the way and solidifies. Both directions on
 *  the UI thread, 640ms, eased both ends. */
const PHASE_MS = 640;

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
  // cover-fit: fill the screen, crop the overflow evenly
  const dims = image
    ? (() => {
        const s = Math.max(width / image.width(), height / image.height());
        const w = image.width() * s;
        const h = image.height() * s;
        return { w, h, x: (width - w) / 2, y: (height - h) / 2 };
      })()
    : null;

  const transform = useDerivedValue(() => {
    let d = 0;
    if (idx === curIdx.value && fromIdx.value >= 0) {
      d = dir.value * (1 - prog.value) * width * 0.16;
    } else if (idx === fromIdx.value) {
      d = -dir.value * prog.value * width * 0.28;
    }
    return axis.value === 1 ? [{ translateY: d }] : [{ translateX: d }];
  }, [idx, width]);

  const opacity = useDerivedValue(() => {
    if (idx === curIdx.value) {
      return fromIdx.value >= 0 ? prog.value : 1;
    }
    if (idx === fromIdx.value) return 1 - prog.value;
    return 0;
  }, [idx]);

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

const TownCanvas = memo(function TownCanvas({
  width, height, drain, shared,
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
  };
}) {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height} color={PAPER} />
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
    </Canvas>
  );
});

export function Town() {
  const { width, height } = useWindowDimensions();
  const curIdx = useSharedValue(0);
  const fromIdx = useSharedValue(-1);
  const prog = useSharedValue(1);
  const dir = useSharedValue(1);
  const axis = useSharedValue(0);
  const [state, setState] = useState<TownState>(() => beginNight('gate'));
  const busy = useRef(false);
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

  // Her voice: one line at a time, queued, once-lines kept for the
  // night. The content lives in src/content/lines.ts; this is only
  // the throat.
  const [line, setLine] = useState<Line | null>(null);
  const seen = useRef(new Set<string>());
  const lineQueue = useRef<Line[]>([]);
  const speaking = useRef(false);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const printingUntil = useRef(0);

  const showNext = useCallback(function show() {
    const next = lineQueue.current.shift() ?? null;
    setLine(next);
    if (next) {
      // A once-line counts as heard when it is SHOWN, not when it is
      // queued - a line swept away by a move can still play later.
      if (next.once) seen.current.add(next.id);
      // While the line prints, she does not walk (Simon, b52).
      printingUntil.current = Date.now() + revealMs(next);
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
    printingUntil.current = 0;
    setLine(null);
  }, []);

  useEffect(
    () => () => {
      if (lineTimer.current) clearTimeout(lineTimer.current);
    },
    [],
  );

  const settle = useCallback(() => {
    busy.current = false;
    const id = stateRef.current.nodeId;
    speak(id, 'enter');
    if (nodeOf(id).water && stateRef.current.fires === 3) speak(id, 'flames');
  }, [speak]);

  const move = useCallback(
    (way: Way) => {
      if (busy.current) return;
      // A printing line holds her still; the refusal haptic says wait.
      if (Date.now() < printingUntil.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      }
      const m = moveNode(stateRef.current, way);
      if (!m.moved) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      }
      busy.current = true;
      hushOnMove();
      if (m.costAFlame) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      } else {
        Haptics.selectionAsync().catch(() => {});
      }
      setState(m.state);
      fromIdx.value = curIdx.value;
      curIdx.value = IDX[m.state.nodeId];
      // Swiping up moves INTO the picture, so the leaving screen rises
      // away; the arriving one comes up from beneath. Down mirrors.
      axis.value = way === 'left' || way === 'right' ? 0 : 1;
      dir.value = way === 'right' || way === 'down' ? 1 : -1;
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
    [settle],
  );

  const doLookBack = useCallback(() => {
    if (busy.current || stateRef.current.fires === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState(lookBack);
  }, []);

  // Touch targets on the paintings. The bronze studs are the first
  // (OPENING beat 2): the game's first working input is a touch, not
  // a swipe. Regions are fractions of the displayed frame.
  const dimsRef = useRef({ width, height });
  dimsRef.current = { width, height };
  const touch = useCallback(
    (x: number, y: number) => {
      if (busy.current) return;
      const { width: w, height: h } = dimsRef.current;
      if (
        stateRef.current.nodeId === 'gate' &&
        x > w * 0.2 && x < w * 0.8 &&
        y > h * 0.28 && y < h * 0.65
      ) {
        Haptics.selectionAsync().catch(() => {});
        speak('gate', 'touch');
      }
    },
    [speak],
  );

  const [pan] = useState(() =>
    Gesture.Race(
      Gesture.Exclusive(
        Gesture.Tap()
          .numberOfTaps(2)
          .maxDuration(260)
          .onEnd(() => {
            'worklet';
            runOnJS(doLookBack)();
          }),
        Gesture.Tap()
          .maxDuration(260)
          .onEnd((e) => {
            'worklet';
            runOnJS(touch)(e.x, e.y);
          }),
      ),
      Gesture.Pan()
        .minDistance(24)
        .onEnd((e) => {
          'worklet';
          const ax = Math.abs(e.translationX);
          const ay = Math.abs(e.translationY);
          if (Math.max(ax, ay) < 48) return;
          if (ay > ax * 1.2) {
            runOnJS(move)(e.translationY < 0 ? 'up' : 'down');
          } else if (ax > ay * 1.2) {
            runOnJS(move)(e.translationX < 0 ? 'right' : 'left');
          }
        }),
    ),
  );

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
            shared={{ curIdx, fromIdx, prog, dir, axis }}
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

      <Text style={styles.stamp}>b53</Text>
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
