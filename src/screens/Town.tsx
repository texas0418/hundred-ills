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

  const settle = useCallback(() => {
    busy.current = false;
  }, []);

  const move = useCallback(
    (way: Way) => {
      if (busy.current) return;
      const m = moveNode(stateRef.current, way);
      if (!m.moved) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      }
      busy.current = true;
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

      <Text style={styles.stamp}>b45</Text>
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
