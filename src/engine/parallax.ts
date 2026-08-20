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
   * Mirror alternate tiles. Makes the seam exactly zero by construction,
   * at the cost of a visible symmetry - so it is only safe on a plane
   * with no distinctive feature. The far bank qualifies; the mid plane
   * does not, its steps and boat would ping-pong.
   */
  readonly mirror: boolean;
}

export const PLANES: readonly Plane[] = [
  { id: 'far', speed: 0.25, top: 0.26, height: 0.22, mirror: true },
  { id: 'mid', speed: 1.0, top: 0.44, height: 0.24, mirror: false },
  { id: 'kerb', speed: 1.45, top: 0.78, height: 0.2, mirror: false },
];

export interface Tile {
  /** Which repeat this is. Negative to the left of the origin. */
  readonly index: number;
  /** Left edge in screen pixels. */
  readonly x: number;
  readonly mirrored: boolean;
}

/** Positive modulo. JS % keeps the sign of the dividend, which breaks
 *  mirroring for tiles to the left of the origin. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
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
    tiles.push({
      index: i,
      x: i * plateWidth + offset,
      mirrored: plane.mirror && mod(i, 2) === 1,
    });
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
