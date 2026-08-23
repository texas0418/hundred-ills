/**
 * Things in the paintings: what is drawn onto a screen, and where a
 * touch lands on something. All positions are FRACTIONS OF THE
 * PAINTING (0..1 of its width and height), never of the phone, so a
 * target stays on its object however the phone frames the picture.
 *
 * docs/FIRST-WATCH.txt (ratified 2026-08-23) is the authority.
 * Pure module - test-content checks every node and every fraction.
 */

export type OverlayId = 'shigandang' | 'road-money' | 'door-gods-intact' | 'jiaobei';

/** A plate composited onto a screen. x,y is the CENTRE-BOTTOM of the
 *  plate in painting fractions; w is its width as a fraction of the
 *  painting's width. Static for the night. */
export interface Overlay {
  readonly plate: OverlayId;
  readonly node: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

export const OVERLAYS: readonly Overlay[] = [
  // 石敢當 at the bank's end: the stone that refuses passage (27),
  // the lock on district two.
  { plate: 'shigandang', node: 'bank-end', x: 0.27, y: 0.595, w: 0.10 },
  // 買路錢 scattered where the funeral route runs out of her reach (72).
  { plate: 'road-money', node: 'bank-end', x: 0.13, y: 0.545, w: 0.13 },
  // Intact door gods on the lantern door of bank east - met OPEN.
  { plate: 'door-gods-intact', node: 'bank-east', x: 0.468, y: 0.535, w: 0.058 },
];

export type Act =
  | 'studs'        // 摸釘
  | 'door-gods'    // the first ward, seen
  | 'road-money'   // the prohibition, seen
  | 'shrine'       // take the blocks
  | 'stone';       // the lock

/** A touch region on a painting, in painting fractions. */
export interface Target {
  readonly act: Act;
  readonly node: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export const TARGETS: readonly Target[] = [
  { act: 'studs', node: 'gate', x0: 0.22, y0: 0.30, x1: 0.78, y1: 0.64 },
  { act: 'door-gods', node: 'bank-east', x0: 0.40, y0: 0.36, x1: 0.54, y1: 0.56 },
  { act: 'road-money', node: 'bank-end', x0: 0.04, y0: 0.44, x1: 0.22, y1: 0.58 },
  { act: 'shrine', node: 'inland-east', x0: 0.50, y0: 0.38, x1: 0.70, y1: 0.58 },
  { act: 'stone', node: 'bank-end', x0: 0.18, y0: 0.46, x1: 0.36, y1: 0.64 },
];

export function targetAt(node: string, fx: number, fy: number): Target | undefined {
  return TARGETS.find(
    (t) => t.node === node && fx >= t.x0 && fx <= t.x1 && fy >= t.y0 && fy <= t.y1,
  );
}
