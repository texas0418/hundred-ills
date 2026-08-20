import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  Canvas,
  Group,
  Image as SkImage,
  Rect,
  useImage,
} from '@shopify/react-native-skia';

import { PAPER, PEACH_RED, SOOT } from '../palette';
import {
  PLANES,
  planeRect,
  scaledWidth,
  tilesFor,
  type Plane,
} from '../engine/parallax';
import {
  beginFirstWatch,
  currentCall,
  drainAmount,
  lookBack,
  reflection,
  setLooking,
  step,
  watchmanCalling,
  type WalkState,
} from '../engine/walk';

/**
 * 一更 - one walkable minute of the first watch.
 *
 * All arithmetic is in src/engine/{parallax,walk}.ts, tested by Node.
 * This file owns input and drawing only.
 *
 * Plates load from assets/plates-alpha (paper is transparent, so planes
 * layer through each other) and assets/plates-drained (monochrome except
 * vermilion). The drain is a cross-fade between the two - DECISIONS 59.
 */

const LIVE = {
  far: require('../../assets/plates-alpha/canal-far.png'),
  mid: require('../../assets/plates-alpha/canal-mid.png'),
  kerb: require('../../assets/plates-alpha/canal-near-kerb.png'),
} as const;

const DEAD = {
  far: require('../../assets/plates-drained/canal-far.png'),
  mid: require('../../assets/plates-drained/canal-mid.png'),
  kerb: require('../../assets/plates-drained/canal-near-kerb.png'),
} as const;

function PlaneLayer({
  plane, walkX, screenW, screenH, drain,
}: {
  plane: Plane; walkX: number; screenW: number; screenH: number; drain: number;
}) {
  const live = useImage(LIVE[plane.id]);
  const dead = useImage(DEAD[plane.id]);
  const band = planeRect(plane, screenH);

  const tiles = useMemo(() => {
    if (!live) return [];
    const w = scaledWidth(plane, live.width(), live.height(), screenH);
    return tilesFor(plane, walkX, w, screenW).map((t) => ({ ...t, w }));
  }, [live, plane, walkX, screenW, screenH]);

  if (!live) return null;

  return (
    <Group>
      {tiles.map((t) => (
        <Group
          key={`${plane.id}:${t.index}`}
          transform={
            t.mirrored
              ? [{ translateX: t.x + t.w }, { scaleX: -1 }]
              : [{ translateX: t.x }]
          }
        >
          <SkImage image={live} x={0} y={band.y} width={t.w} height={band.height} fit="fill" />
          {dead && drain > 0 ? (
            <SkImage
              image={dead}
              x={0}
              y={band.y}
              width={t.w}
              height={band.height}
              fit="fill"
              opacity={drain}
            />
          ) : null}
        </Group>
      ))}
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
  const [state, setState] = useState<WalkState>(beginFirstWatch);

  // The night runs whether or not she moves.
  useEffect(() => {
    const id = setInterval(() => setState((s) => step(s, 0, 100)), 100);
    return () => clearInterval(id);
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        onPanResponderMove: (_e, g) => {
          // Dragging down is leaning over the water to count.
          if (g.dy > 40 && Math.abs(g.dy) > Math.abs(g.dx)) {
            setState((s) => setLooking(s, true));
            return;
          }
          setState((s) => step(setLooking(s, false), -g.dx * 0.35, 0));
        },
        onPanResponderRelease: () => setState((s) => setLooking(s, false)),
        onPanResponderTerminate: () => setState((s) => setLooking(s, false)),
      }),
    [],
  );

  const onLookBack = useCallback(() => setState(lookBack), []);
  const call = currentCall(state);
  const calling = watchmanCalling(state);

  return (
    <View style={styles.fill} {...pan.panHandlers}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={width} height={height} color={PAPER} />
        {PLANES.map((p) => (
          <PlaneLayer
            key={p.id}
            plane={p}
            walkX={state.x}
            screenW={width}
            screenH={height}
            drain={drainAmount(state)}
          />
        ))}
      </Canvas>

      <Reflection state={state} screenH={height} />

      {/* The watchman is heard, not met. No audio yet, so the call is
          drawn as the strike count he beats out - see DECISIONS 89. */}
      {calling ? (
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

      {/* Temporary. A real "look back" is a gesture in the world, not a
          word on the screen; this exists so the drain can be seen. */}
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
