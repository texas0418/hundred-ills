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
  PLANES,
  planeRect,
  scaledWidth,
  slotCount,
  slotX,
  type Plane,
} from '../engine/parallax';
import {
  BANK_LENGTH,
  BRIDGE_SPAN,
  bridgesOn,
  clampToStrip,
} from '../engine/town';
import {
  applyCrossing,
  arriveAt,
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

const BRIDGES = {
  'bridge-one': require('../../assets/plates-alpha/bridge-one.png'),
  'bridge-two': require('../../assets/plates-alpha/bridge-two.png'),
} as const;

/**
 * A bridge standing in the world where it actually is. No marker and no
 * prompt - DECISIONS 41 withholds help, and a bridge is already the most
 * legible object in a water town.
 *
 * SIZED IN WORLD PIXELS, not as a fraction of the screen. The first
 * version scaled by band height, so a wide plate rendered two screens
 * across and a tall one filled the view - the same code producing two
 * completely different objects.
 *
 * These are still the LANDMARK plates, a whole arch seen across water.
 * The bridge she actually walks over is prompt [26] and does not exist
 * yet; until it does, this reads as a bridge further along the canal
 * rather than one underfoot. See DECISIONS 105.
 */
function BridgeObject({
  plate, worldX, walkX, screenH,
}: {
  plate: keyof typeof BRIDGES; worldX: number;
  walkX: SharedValue<number>; screenH: number;
}) {
  const image = useImage(BRIDGES[plate]);
  const mid = PLANES[1];
  const band = planeRect(mid, screenH);
  const w = BRIDGE_SPAN * 0.42;
  const h = image ? (w * image.height()) / image.width() : 0;
  const transform = useDerivedValue(
    () => [{ translateX: worldX - walkX.value * mid.speed - w / 2 }],
    [worldX, w],
  );
  if (!image) return null;
  // Anchor by the plate's waterline (its mirror axis, measured at 0.485
  // for bridge-one and 0.736 for bridge-two) rather than by its box, so
  // both sit on the water instead of one floating and one sinking.
  const waterline = band.y + band.height * 0.82;
  return (
    <Group transform={transform}>
      <SkImage
        image={image}
        x={0}
        y={waterline - h * 0.5}
        width={w}
        height={h}
        fit="fill"
      />
    </Group>
  );
}

const Scene = memo(function Scene({
  walkX, width, height, drain, stripId,
}: {
  walkX: SharedValue<number>; width: number; height: number;
  drain: number; stripId: string;
}) {
  const bridges = bridgesOn(stripId);
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
      {bridges.map((b) =>
        b.plate in BRIDGES ? (
          <BridgeObject
            key={b.id}
            plate={b.plate as keyof typeof BRIDGES}
            worldX={b.x}
            walkX={walkX}
            screenH={height}
          />
        ) : null,
      )}
    </Canvas>
  );
});

export function Walk() {
  const { width, height } = useWindowDimensions();
  const walkX = useSharedValue(0);
  const [state, setState] = useState<WalkState>(beginFirstWatch);

  // The night runs whether or not she moves, and this is also where the
  // walk is reported back to React - ten times a second, not once a
  // frame. arriveAt takes the whole span since the last sample, so a
  // fast fling cannot skip over a bridge between two reads.
  useEffect(() => {
    const id = setInterval(
      () => setState((s) => arriveAt(tick(s, 100), walkX.value)),
      100,
    );
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One pure transition, tested in Node. Stable - no deps - so the
  // gesture built once at mount never goes stale.
  const takeCrossing = useCallback(
    (atX: number) => setState((s) => applyCrossing(s, atX)),
    [],
  );

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
        // Down over the water to count; up onto a crossing.
        if (e.translationY > 40 && e.translationY > Math.abs(e.translationX)) {
          runOnJS(setLook)(true);
          return;
        }
        if (e.translationY < -60 && -e.translationY > Math.abs(e.translationX)) {
          runOnJS(takeCrossing)(walkX.value);
          return;
        }
        walkX.value = clampToStrip('north', walkX.value - e.changeX);
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
          // The district has two ends now. Walking into one stops her,
          // rather than the endless belt the first build had.
          clamp: [0, BANK_LENGTH],
        });
      }),
  );

  // A crossing moves her somewhere else on another strip, so the shared
  // value has to be told. Keyed on the crossing count, not on x, so
  // ordinary walking never fights the gesture for control of walkX.
  const crossings = state.pos.crossed.length;
  useEffect(() => {
    // react-hooks/immutability mis-reads useSharedValue as useState. A
    // shared value is a mutable box by design - assigning to .value is
    // the whole API - so this is a false positive, not a shortcut.
    // eslint-disable-next-line react-hooks/immutability
    walkX.value = state.x;
    // Deliberately keyed on the crossing, not on x - listing state.x
    // would fire this on every step and fight the gesture for walkX.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossings, state.pos.strip]);

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
