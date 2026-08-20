/**
 * The walk. Three plates sliding at different speeds to make depth.
 *
 * DECISIONS 14 and 85: she walks left and right along a canal bank and
 * only goes deeper by crossing a bridge. This module is the sliding.
 *
 * Pure module. No expo or react-native imports - Node runs this in tests.
 * No Date.now(): callers pass the walk position.
 */

export interface Plane {
  readonly id: 'far' | 'mid' | 'kerb';
  /**
   * How fast this plane moves relative to her walk. She walks ON the mid
   * plane - the embankment lane - so that is the reference at 1.0. The
   * far bank is distant and barely moves. The kerb is between her and
   * the camera, so it moves FASTER than she does.
   */
  readonly speed: number;
  /** Top of the plate, as a fraction of screen height. */
  readonly top: number;
  /** Height of the plate, as a fraction of screen height. */
  readonly height: number;
  /**
   * Use the pre-mirrored double-width tile. Baking [plate | mirrored
   * plate] into one image makes its two edges the same column of pixels,
   * so it repeats with no seam and the renderer only has to translate -
   * no per-tile parity, nothing to swap mid-animation.
   *
   * Only safe on a plane with no distinctive feature. The far bank
   * qualifies; the mid plane does not, its boat would ping-pong.
   */
  readonly paired: boolean;
}

export const DISTRICT_START = 0;

export const PLANES: readonly Plane[] = [
  { id: 'far', speed: 0.25, top: 0.26, height: 0.22, paired: true },
  { id: 'mid', speed: 1.0, top: 0.44, height: 0.24, paired: false },
  { id: 'kerb', speed: 1.45, top: 0.78, height: 0.2, paired: false },
];

/**
 * A LANE is not shaped like a bank. The wall opposite is an arm's length
 * away, so it is tall and close and moves nearly at her own pace, and
 * there is no middle distance at all - just the wall and the kerb.
 */
export const LANE_PLANES: readonly Plane[] = [
  { id: 'far', speed: 0.75, top: 0.14, height: 0.62, paired: true },
  { id: 'kerb', speed: 1.45, top: 0.78, height: 0.2, paired: false },
];

export function planesFor(kind: 'bank' | 'lane'): readonly Plane[] {
  return kind === 'lane' ? LANE_PLANES : PLANES;
}

export interface Tile {
  /** Which repeat this is. Negative to the left of the origin. */
  readonly index: number;
  /** Left edge in screen pixels. */
  readonly x: number;
}

/** Positive modulo. JS % keeps the sign of the dividend, which puts
 *  tiles left of the origin in the wrong slot. */
export function mod(n: number, m: number): number {
  'worklet';
  return ((n % m) + m) % m;
}

/**
 * How many copies of a plate it takes to cover the viewport, whatever
 * the scroll position. Fixed for a given plate and screen, which is the
 * point: the renderer allocates this many nodes ONCE and then only
 * animates their x, so nothing is created or destroyed mid-walk.
 */
export function slotCount(plateWidth: number, screenWidth: number): number {
  if (plateWidth <= 0 || screenWidth <= 0) return 0;
  return Math.ceil(screenWidth / plateWidth) + 2;
}

/**
 * Where slot k sits, for a walk position. Pure arithmetic and marked as
 * a worklet so it can run on the UI thread every frame without touching
 * React.
 */
export function slotX(
  plane: Plane,
  walkX: number,
  plateWidth: number,
  slot: number,
): number {
  'worklet';
  const offset = -walkX * plane.speed;
  return mod(offset, plateWidth) + (slot - 1) * plateWidth;
}

/**
 * Which copies of a plate are on screen, and where.
 *
 * The plate repeats forever in both directions; this returns only the
 * copies that touch the viewport, so the cost is constant however far
 * she has walked.
 */
export function tilesFor(
  plane: Plane,
  walkX: number,
  plateWidth: number,
  screenWidth: number,
): Tile[] {
  if (plateWidth <= 0 || screenWidth <= 0) return [];
  const offset = -walkX * plane.speed;
  const first = Math.floor(-offset / plateWidth);
  const tiles: Tile[] = [];
  for (let i = first; i * plateWidth + offset < screenWidth; i++) {
    tiles.push({ index: i, x: i * plateWidth + offset });
  }
  return tiles;
}

export function planeRect(
  plane: Plane,
  screenHeight: number,
): { y: number; height: number } {
  return {
    y: plane.top * screenHeight,
    height: plane.height * screenHeight,
  };
}

/** Scale a plate to the plane's band, preserving aspect. */
export function scaledWidth(
  plane: Plane,
  plateW: number,
  plateH: number,
  screenHeight: number,
): number {
  return (plane.height * screenHeight * plateW) / plateH;
}
