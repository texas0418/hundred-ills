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
  planeRect,
  planesFor,
  scaledWidth,
  slotCount,
  slotX,
  type Plane,
} from '../engine/parallax';
import {
  bridgesOn,
  clampTo,
  linksOn,
  strip as stripById,
} from '../engine/town';
import { LIVE, DEAD, isPlate, type PlateName } from '../plates';
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

/**
 * NOTHING IS DRAWN FOR A BRIDGE YET, AND THAT IS DELIBERATE.
 *
 * The plates that exist - bridge-one, bridge-two, bridge-three - are
 * LANDMARK views: a whole arch with its own reflection, seen across
 * water from a distance. Two attempts to place one in the world both
 * failed, and for the same reason rather than two:
 *
 *   in the near canal   it is a bridge floating in the water, because
 *                       that is literally what an arch-plus-reflection
 *                       dropped into a canal is
 *   on the far plane    it slides away from her path, because a bridge
 *                       standing at a world x on the BANK cannot be
 *                       drawn on a plane that scrolls at another speed
 *
 * There is no correct placement for these plates, so there is no
 * placeholder. The bridge she walks over is prompt [26] and does not
 * exist yet; a bridge in the wrong place teaches the player something
 * false about the town, which is worse than an empty bank.
 *
 * The crossings still WORK - she spends them by walking past, per
 * DECISIONS 105 - they are simply invisible until the art lands.
 */

/**
 * Something standing in the world at a fixed place on the strip - the
 * bridge she walks over, or the mouth of a lane. No marker and no
 * prompt: DECISIONS 41 withholds help, and both of these are already
 * the most legible things a water town has.
 *
 * Sized in WORLD pixels and anchored to the ground the strip is walked
 * on, so a wide plate and a tall one come out the same size of object.
 */
function WorldObject({
  plate, worldX, band, walkX, drain, speed = 1, scale = 1.31, anchor = 0.247,
  align = 0.314,
}: {
  plate: PlateName; worldX: number;
  band: { y: number; height: number };
  walkX: SharedValue<number>; drain: number;
  /** Parallax rate of the plane this thing belongs to. */
  speed?: number;
  scale?: number; anchor?: number; align?: number;
}) {
  const live = useImage(LIVE[plate]);
  const dead = useImage(DEAD[plate]);

  // MEASURED, not guessed. The bridge plate carries its own embankment
  // at each end, and the only way it reads as part of the walkway is if
  // that embankment lands exactly on the strip's. Its wing occupies
  // 0.456 of the plate; the strip's embankment occupies 0.599 of its
  // own - hence 1.31x - and the two bands are then aligned by their
  // tops, 0.247 into the bridge and 0.314 into the strip.
  //
  // The first version sized this by a flat world width and stood it on
  // a "footing", which put a bridge in the canal twice.
  const h = band.height * scale;
  const w = live ? (h * live.width()) / live.height() : 0;
  const y = band.y + align * band.height - anchor * h;

  const transform = useDerivedValue(
    () => [{ translateX: worldX - walkX.value * speed - w / 2 }],
    [worldX, w, speed],
  );
  if (!live) return null;
  return (
    <Group transform={transform}>
      <SkImage image={live} x={0} y={y} width={w} height={h} fit="fill" />
      {dead && drain > 0 ? (
        <SkImage
          image={dead}
          x={0}
          y={y}
          width={w}
          height={h}
          fit="fill"
          opacity={drain}
        />
      ) : null}
    </Group>
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
  // Objects that stand in the walkway belong to the plane the walkway
  // is drawn on, and are aligned to that band rather than to the screen.
  const ground = planes.find((p) => p.id === 'mid') ?? planes[0];
  const groundBand = planeRect(ground, height);
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
      {bridgesOn(stripId).map((b) => (
        <WorldObject
          key={b.id}
          plate="bridge-walkover"
          worldX={b.x}
          band={groundBand}
          walkX={walkX}
          drain={drain}
        />
      ))}
      {/* A lane mouth is a GAP IN THE TERRACE, not an object in the
          walkway - DECISIONS 105 and a plate that failed once for
          being at the wrong depth. It is the same row of houses as the
          far plane, with a gap in it, laid over the far plane at the
          far plane's own rate so it stays put among the houses.
          Positioned at linkX * far.speed so the gap is in front of her
          when her walk reaches the link. */}
      {linksOn(stripId).map(({ link, x }) => (
        <WorldObject
          key={link.id}
          plate="lane-mouth"
          worldX={x * planes[0].speed}
          band={planeRect(planes[0], height)}
          walkX={walkX}
          drain={drain}
          speed={planes[0].speed}
          scale={1}
          anchor={0}
          align={0}
        />
      ))}
      {/* OLD NOTE, kept because it is why the plate was redrawn. The plate that exists is a standalone
          alley - two whole buildings, their roofs and sky - and laying
          it over the bank gives two sets of architecture at two depths.
          It is also at the wrong depth entirely: she walks the
          embankment with the houses BEHIND her, so a lane off her bank
          is a gap in the FAR terrace, not an object in the walkway.
          Re-prompted as [27] and now drawn above. */}
    </Canvas>
  );
});

export function Walk() {
  const { width, height } = useWindowDimensions();
  const walkX = useSharedValue(0);
  // How far she can walk on the strip she is on. A shared value because
  // the gesture is built once and must not capture a strip that changes.
  const stripMax = useSharedValue(0);
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
        walkX.value = clampTo(walkX.value - e.changeX, stripMax.value);
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
          clamp: [0, stripMax.value],
        });
      }),
  );

  // A crossing moves her somewhere else on another strip, so the shared
  // value has to be told. Keyed on the crossing count, not on x, so
  // ordinary walking never fights the gesture for control of walkX.
  const crossings = state.pos.crossed.length;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    stripMax.value = stripById(state.pos.strip).length;
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
