import { memo, useCallback, useRef, useState } from 'react';
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

import { PAPER, SOOT } from '../palette';

/**
 * DECISIONS 109, the proof. The world is discrete screens: each place
 * is ONE complete painting, and moving PHASES to the neighbouring one.
 * Nothing tiles, nothing abuts, nothing repeats - so nothing can seam.
 *
 * Everything is mounted once and driven by shared values, per this
 * app's standing rule: nothing mounts or decodes during a gesture.
 *
 * This file deliberately knows nothing about fires, watches or the
 * rite. It exists to answer one question on the device: does moving
 * through authored pictures feel like the game. The systems rejoin
 * after the verdict.
 */

type Exit = number | null;
interface Node {
  id: string;
  src: number;
  /** left/right walk the bank; up steps INTO the town, down steps back
   *  toward the water - the depth verb of 108, made discrete. */
  exits: { left: Exit; right: Exit; up: Exit; down: Exit };
}

const SCREENS: Node[] = [
  {
    id: 'mooring',
    src: require('../../assets/screens/mooring.png'),
    exits: { left: null, right: 1, up: null, down: null },
  },
  {
    id: 'bridge',
    src: require('../../assets/screens/bridge.png'),
    exits: { left: 0, right: null, up: 2, down: null },
  },
  {
    // The dark passage in this painting is where 'up' leads: she steps
    // INTO the picture she was looking at.
    id: 'alley',
    src: require('../../assets/screens/alley.png'),
    exits: { left: null, right: null, up: null, down: 1 },
  },
];

/** The phase: leaving drifts a quarter-screen and thins; arriving
 *  comes the last sixth of the way and solidifies. Both directions on
 *  the UI thread, 640ms, eased both ends. */
const PHASE_MS = 640;

function ScreenLayer({
  idx, src, curIdx, fromIdx, prog, dir, axis, width, height,
}: {
  idx: number;
  src: number;
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
    </Group>
  );
}

const TownCanvas = memo(function TownCanvas({
  width, height, shared,
}: {
  width: number;
  height: number;
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
          src={s.src}
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
  const [, setNode] = useState(0);
  const busy = useRef(false);

  const settle = useCallback(() => {
    busy.current = false;
  }, []);

  const move = useCallback(
    (way: 'left' | 'right' | 'up' | 'down') => {
      if (busy.current) return;
      const cur = SCREENS[curIdx.value];
      const to = cur.exits[way];
      if (to === null) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      }
      busy.current = true;
      Haptics.selectionAsync().catch(() => {});
      fromIdx.value = curIdx.value;
      curIdx.value = to;
      // Swiping up moves INTO the picture, so the leaving screen rises
      // away; the arriving one comes up from beneath. Down mirrors.
      axis.value = way === 'left' || way === 'right' ? 0 : 1;
      dir.value = way === 'right' || way === 'down' ? 1 : -1;
      setNode(to);
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

  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
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
  );

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill}>
          <TownCanvas
            width={width}
            height={height}
            shared={{ curIdx, fromIdx, prog, dir, axis }}
          />
        </View>
      </GestureDetector>
      <Text style={styles.stamp}>b41</Text>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: PAPER },
  stamp: {
    position: 'absolute', bottom: 34, left: 22,
    color: SOOT, opacity: 0.25, fontSize: 11, letterSpacing: 1,
  },
});
