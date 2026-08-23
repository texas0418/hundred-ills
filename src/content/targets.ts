/**
 * Things in the paintings: what is drawn onto a screen, and where a
 * touch lands on something. All positions are FRACTIONS OF THE
 * PAINTING (0..1 of its width and height), never of the phone, so a
 * target stays on its object however the phone frames the picture.
 *
 * docs/FIRST-WATCH.txt (ratified 2026-08-23) is the authority.
 * Pure module - test-content checks every node and every fraction.
 */

/** Plates still composited at runtime. Things that STAND in a place
 *  are painted into the screen now ([60], [61] - Simon, b62: pasted
 *  plates pop in and look pasted); only what appears and vanishes is
 *  composited - the thrown blocks, the watchman, the drowned. */
export type OverlayId = 'jiaobei';

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
  // Nothing static is composited any more: the stone, the road money
  // and the door gods are IN their paintings ([60], [61]).
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
  // [61]: the door gods painted on the double door, mid-bank.
  { act: 'door-gods', node: 'bank-east', x0: 0.55, y0: 0.32, x1: 0.70, y1: 0.50 },
  // [60]: the stone standing in the path; the coins on the flagstones
  // before it. The stone is checked first where they meet.
  { act: 'stone', node: 'bank-end', x0: 0.42, y0: 0.58, x1: 0.60, y1: 0.78 },
  { act: 'road-money', node: 'bank-end', x0: 0.30, y0: 0.78, x1: 0.60, y1: 0.95 },
  { act: 'shrine', node: 'inland-east', x0: 0.50, y0: 0.38, x1: 0.70, y1: 0.58 },
];

export function targetAt(node: string, fx: number, fy: number): Target | undefined {
  return TARGETS.find(
    (t) => t.node === node && fx >= t.x0 && fx <= t.x1 && fy >= t.y0 && fy <= t.y1,
  );
}
