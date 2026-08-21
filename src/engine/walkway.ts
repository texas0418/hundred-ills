/**
 * The walkway as a sequence of authored segments. DECISIONS 107.
 *
 * A strip's walkway is an ordered list of plates - plain embankment
 * tiles and scene segments with bridges painted in. Each plate carries
 * its own measured band (where the embankment sits inside the image,
 * from assets/plates/segments.json), and layout aligns every band to
 * the same screen band, so the walkway runs level through plates of
 * different heights.
 *
 * Pure module. Positions depend on the screen's band height, so tests
 * pass a fixed one.
 */

import meta from '../../assets/plates/segments.json';

export interface WalkwayPlate {
  readonly plate: string;
  readonly bandTop: number;
  readonly bandBot: number;
  readonly aspect: number;
}

const REF: WalkwayPlate = {
  plate: 'canal-mid',
  bandTop: meta.reference.bandTop,
  bandBot: meta.reference.bandBot,
  aspect: 1024 / 439,
};

function seg(name: string): WalkwayPlate {
  const s = (meta.segments as Record<string, {
    bandTop: number; bandBot: number; aspect: number;
  }>)[name];
  return { plate: name, ...s };
}

/** North bank: tile, bridge A, tile, bridge B, tile. */
export const NORTH_WALKWAY: readonly WalkwayPlate[] = [
  REF,
  seg('seg-bridge-a'),
  REF,
  seg('seg-bridge-b'),
  REF,
];

/** South bank: plain for now - its own segments when the art exists. */
export const SOUTH_WALKWAY: readonly WalkwayPlate[] = [REF, REF, REF, REF];

export interface PlacedPlate extends WalkwayPlate {
  /** World x of the plate's left edge. */
  readonly x: number;
  /** Drawn size and position, band-aligned. */
  readonly width: number;
  readonly drawH: number;
  readonly drawTopOffset: number;
}

export interface Layout {
  readonly plates: readonly PlacedPlate[];
  readonly length: number;
  /** World x of each bridge segment's centre, in walkway order. */
  readonly bridgeXs: readonly number[];
}

/**
 * Band-aligned layout: every plate is scaled so ITS band height equals
 * the screen band height, and offset so the bands coincide.
 */
export function layoutWalkway(
  seq: readonly WalkwayPlate[],
  bandH: number,
): Layout {
  const plates: PlacedPlate[] = [];
  const bridgeXs: number[] = [];
  let x = 0;
  for (const p of seq) {
    const band = p.bandBot - p.bandTop;
    const drawH = bandH / band;
    const width = drawH * p.aspect;
    plates.push({
      ...p,
      x,
      width,
      drawH,
      drawTopOffset: -p.bandTop * drawH,
    });
    if (p.plate.startsWith('seg-bridge')) bridgeXs.push(x + width / 2);
    x += width;
  }
  return { plates, length: x, bridgeXs };
}

/** Which bridges (by index) a walk from fromX to toX passes over. */
export function bridgesPassed(
  layout: Layout,
  fromX: number,
  toX: number,
): number[] {
  const lo = Math.min(fromX, toX);
  const hi = Math.max(fromX, toX);
  const out: number[] = [];
  layout.bridgeXs.forEach((bx, i) => {
    if (bx > lo && bx <= hi) out.push(i);
  });
  return out;
}
