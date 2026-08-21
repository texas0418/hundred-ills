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

const SCREENS = [
  {
    id: 'mooring',
    src: require('../../assets/screens/mooring.png'),
    exits: { left: null as number | null, right: 1 },
  },
  {
    id: 'bridge',
    src: require('../../assets/screens/bridge.png'),
    exits: { left: 0 as number | null, right: 2 as number | null },
  },
  {
    id: 'alley',
    src: require('../../assets/screens/alley.png'),
    exits: { left: 1 as number | null, right: null },
  },
] as const;

/** The phase: leaving drifts a quarter-screen and thins; arriving
 *  comes the last sixth of the way and solidifies. Both directions on
 *  the UI thread, 640ms, eased both ends. */
const PHASE_MS = 640;

function ScreenLayer({
  idx, src, curIdx, fromIdx, prog, dir, width, height,
}: {
  idx: number;
  src: number;
  curIdx: SharedValue<number>;
  fromIdx: SharedValue<number>;
  prog: SharedValue<number>;
  dir: SharedValue<number>;
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
    let dx = 0;
    if (idx === curIdx.value && fromIdx.value >= 0) {
      dx = dir.value * (1 - prog.value) * width * 0.16;
    } else if (idx === fromIdx.value) {
      dx = -dir.value * prog.value * width * 0.28;
    }
    return [{ translateX: dx }];
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
  const [, setNode] = useState(0);
  const busy = useRef(false);

  const settle = useCallback(() => {
    busy.current = false;
  }, []);

  const move = useCallback(
    (toRight: boolean) => {
      if (busy.current) return;
      const cur = SCREENS[curIdx.value];
      const to = toRight ? cur.exits.right : cur.exits.left;
      if (to === null) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      }
      busy.current = true;
      Haptics.selectionAsync().catch(() => {});
      fromIdx.value = curIdx.value;
      curIdx.value = to;
      dir.value = toRight ? 1 : -1;
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
        if (Math.abs(e.translationX) < 48) return;
        runOnJS(move)(e.translationX < 0);
      }),
  );

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill}>
          <TownCanvas
            width={width}
            height={height}
            shared={{ curIdx, fromIdx, prog, dir }}
          />
        </View>
      </GestureDetector>
      <Text style={styles.stamp}>b40</Text>
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
