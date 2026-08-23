import { memo } from 'react';
import { Image as RNImage, StyleSheet } from 'react-native';
import {
  Canvas,
  Group,
  Image as SkImage,
  Rect,
  useImage,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { XUAN } from '../palette';
import { node as nodeOf, type Way } from '../engine/nodes';
import { OVERLAYS, type OverlayId } from '../content/targets';

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
export const SCREENS = [
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

export const IDX: Record<string, number> = Object.fromEntries(
  SCREENS.map((s2, i) => [s2.id, i]),
);

/** The graph flattened for the UI thread: EXITS[idx][way] is the
 *  destination index or -1; FORK[idx] marks a touch-chosen fork.
 *  Plain arrays, captured by the gesture worklet. */
export const WAYS: Way[] = ['left', 'right', 'up', 'down'];
export const EXITS: number[][] = SCREENS.map((s2) =>
  WAYS.map((w) => {
    const to = nodeOf(s2.id).exits[w];
    return to && IDX[to] !== undefined ? IDX[to] : -1;
  }),
);
export const FORK: boolean[] = SCREENS.map((s2) => !!nodeOf(s2.id).fork);
/** LEAN[idx] is true where the down exit goes to the water's edge:
 *  her feet are the bottom edge of every painting, and on a bank that
 *  edge is water, so stepping back is impossible - going to the water
 *  is a LEAN (DECISIONS 67/110), chosen by touching the water, and a
 *  swipe down refuses. */
export const LEAN: boolean[] = SCREENS.map((s2) => {
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
export function paintGeo(idx: number, width: number, height: number) {
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
export const DEMO_TIME_SCALE = 60;

/** The phase: leaving drifts a quarter-screen and thins; arriving
 *  comes the last sixth of the way and solidifies. Both directions on
 *  the UI thread, 640ms, eased both ends. */
export const PHASE_MS = 640;

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

export const WATER_IDX: boolean[] = SCREENS.map((s2) => !!nodeOf(s2.id).water);
const REFLECTION = require('../../assets/figures/reflection.png');
const DROWNED = require('../../assets/figures/shuigui.png');

/** Her reflection in the water (DECISIONS 67/68, FIRST-WATCH): drawn
 *  with a screen blend so only the pale figure lands on the painting's
 *  black water. Whole at three fires; at one or two the water will not
 *  hold still and she shivers and thins; at zero there is no
 *  reflection at all - the moment the player understands. */
function ReflectionLayer({
  curIdx, fromIdx, firesSV, shiver, width, height,
}: {
  curIdx: SharedValue<number>; fromIdx: SharedValue<number>;
  firesSV: SharedValue<number>; shiver: SharedValue<number>;
  width: number; height: number;
}) {
  const img = useImage(REFLECTION);
  const size = width * 0.78;
  const x = (width - size) / 2;
  const y = height * 0.69 - size / 2;
  const opacity = useDerivedValue(() => {
    if (!WATER_IDX[curIdx.value] || fromIdx.value >= 0) return 0;
    const f = firesSV.value;
    return f >= 3 ? 0.95 : f === 2 ? 0.6 : f === 1 ? 0.35 : 0;
  }, []);
  const transform = useDerivedValue(() => {
    const unrest = firesSV.value >= 3 ? 0.3 : 1.6;
    return [{ translateY: Math.sin(shiver.value * Math.PI * 2) * unrest * 2.4 }];
  }, []);
  if (!img) return null;
  return (
    <Group transform={transform}>
      <SkImage image={img} x={x} y={y} width={size} height={size} fit="fill"
        opacity={opacity} blendMode="screen" />
    </Group>
  );
}

/** 水鬼, the drowned, at the east water at zero fires: rises through
 *  the black, looks up, says its one line, sinks. */
const EAST_WATER_IDX = IDX['east-water'];
function DrownedLayer({
  curIdx, drown, width, height,
}: {
  curIdx: SharedValue<number>; drown: SharedValue<number>;
  width: number; height: number;
}) {
  const img = useImage(DROWNED);
  const fh = height * 0.42;
  const fw = img ? fh * (img.width() / img.height()) : fh * 0.5;
  const x = (width - fw) / 2;
  const opacity = useDerivedValue(() => {
    if (curIdx.value !== EAST_WATER_IDX) return 0;
    return drown.value * 0.85;
  }, []);
  const transform = useDerivedValue(() => [
    { translateY: height * 0.98 - fh + (1 - drown.value) * height * 0.12 },
  ], [height, fh]);
  if (!img) return null;
  return (
    <Group transform={transform}>
      <SkImage image={img} x={x} y={0} width={fw} height={fh} fit="fill" opacity={opacity} />
    </Group>
  );
}

export const TownCanvas = memo(function TownCanvas({
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
    firesSV: SharedValue<number>;
    shiver: SharedValue<number>;
    drown: SharedValue<number>;
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
      <ReflectionLayer
        curIdx={shared.curIdx} fromIdx={shared.fromIdx} firesSV={shared.firesSV}
        shiver={shared.shiver} width={width} height={height}
      />
      <DrownedLayer curIdx={shared.curIdx} drown={shared.drown} width={width} height={height} />
      <WatchmanLayer walk={shared.walk} curIdx={shared.curIdx} width={width} height={height} />
      <GlanceLayer src={glanceSrc} glance={shared.glance} width={width} height={height} />
    </Canvas>
  );
});

