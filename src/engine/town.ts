/**
 * The town as a graph of horizontal strips. DECISIONS 100-104.
 *
 * Walking never leaves the horizontal. A bridge or a lane is a
 * TRANSITION between strips, not a new axis to steer on - the player is
 * always walking left or right and only chooses which strip they come
 * out on.
 *
 * Pure module. No expo or react-native imports.
 */

import { MAX_FIRES, type FireCount } from './fires';
import {
  NORTH_WALKWAY,
  SOUTH_WALKWAY,
  bridgesPassed,
  layoutWalkway,
  type Layout,
} from './walkway';

export type StripKind = 'bank' | 'lane' | 'water';

export interface Strip {
  readonly id: string;
  readonly kind: StripKind;
  /** Walkable length in pixels. She cannot pass either end. */
  readonly length: number;
  /** Plate set. Lanes want their own; see the art note in TOWN. */
  readonly plates: { far: string; mid: string; kerb: string };
}

/**
 * A 弄 lane. THE ONLY BRANCHING IN THE GAME - DECISIONS 105. A gap in
 * the wall she turns into. Bidirectional: standing at either end puts
 * her within reach of the other.
 */
export interface Link {
  readonly id: string;
  readonly a: { strip: string; x: number };
  readonly b: { strip: string; x: number };
}

/**
 * A bridge. NOT a way off the strip - a thing she walks OVER, on her
 * path along it, spanning a side canal. DECISIONS 105.
 *
 * She crosses it by WALKING PAST IT. There is no gesture and no prompt,
 * which also makes "do not turn back" literal: walking back over one
 * she has already crossed is doubling back, and costs a flame.
 */
export interface Landmark {
  readonly id: string;
  readonly strip: string;
  readonly x: number;
  readonly plate: string;
}

/** How close she must be to take a crossing. */
export const REACH = 140;

/**
 * A starting district. Deliberately small - 103 says two or three
 * canals, four to six banks, three to five bridges. This is one canal,
 * two banks, two bridges, so that branching EXISTS on the phone and can
 * be felt before the full map is drawn.
 *
 * STRIP LENGTH is a starting number, not gospel. 3600px is about ten
 * screen-widths of dragging.
 */
export const BANK_LENGTH = 3600;

/**
 * A lane is short. An alley you can wander in is a corridor with
 * different wallpaper, and the branching is supposed to come from the
 * NETWORK, not from length.
 */
export const LANE_LENGTH = 900;

/**
 * DECISIONS 108: the depth order of strips. Swipe down steps toward the
 * water, swipe up steps inland. On the bank the last outward step IS
 * the water - where she counts her flames.
 */
export const OUTWARD: Record<string, string | undefined> = {
  north: 'water-north',
  // A lane has NO depth mapping outward: an alley exits at its MOUTH,
  // through the link, or not at all. A blanket mapping teleported her
  // from anywhere in the lane to the same x on the bank - 1650px from
  // where the mouth actually is.
};
export const INWARD: Record<string, string | undefined> = {
  'water-north': 'north',
  // north -> lane-a only at the lane mouth, via links.
};

export const TOWN: { strips: Strip[]; links: Link[]; bridges: Landmark[] } = {
  strips: [
    {
      id: 'north', kind: 'bank', length: BANK_LENGTH,
      plates: { far: 'canal-far-pair', mid: 'canal-mid', kerb: 'canal-near-kerb' },
    },
    {
      id: 'south', kind: 'bank', length: BANK_LENGTH,
      plates: { far: 'canal-far-b-pair', mid: 'canal-mid', kerb: 'canal-near-kerb' },
    },
    {
      // Her last step toward the water. The reflection lives here.
      id: 'water-north', kind: 'water', length: BANK_LENGTH,
      plates: { far: 'canal-far-pair', mid: 'canal-mid', kerb: 'night-water' },
    },
    {
      /**
       * A 弄. Short, because an alley is short, and because a lane you
       * can get lost in is a corridor by another name.
       *
       * NO MID PLANE. A lane has the opposite wall and the near kerb and
       * nothing between - exactly as the bank has no plate for the
       * ground she walks on. See the note on LANE_LENGTH.
       */
      id: 'lane-a', kind: 'lane', length: LANE_LENGTH,
      plates: { far: 'lane-wall-pair', mid: '', kerb: 'canal-near-kerb' },
    },
  ],
  // 弄 lanes - the only branching in the game, DECISIONS 105.
  links: [
    {
      id: 'lane-a-mouth',
      a: { strip: 'north', x: 1650 },
      b: { strip: 'lane-a', x: 0 },
    },
  ],
  // Positions are DERIVED from the walkway layout - the art decides
  // where a bridge stands, never the other way round (DECISIONS 107).
  bridges: [],
};

export function walkwayFor(stripId: string) {
  if (stripId === 'north') return NORTH_WALKWAY;
  if (stripId === 'south') return SOUTH_WALKWAY;
  return null;
}

/**
 * Warmth: where a flame can be relit (DECISIONS 84). Positions live in
 * the ART - the lantern painted into bridge segment A - so they are
 * fractions of a walkway plate, resolved through the layout.
 */
export const RELIGHTS: readonly {
  strip: string;
  plateIndex: number;
  frac: number;
}[] = [
  // The red lantern on its post, left of bridge A.
  { strip: 'north', plateIndex: 1, frac: 0.40 },
];

export function relightXs(stripId: string, bandH?: number): number[] {
  const lay = layoutFor(stripId, bandH);
  if (!lay) return [];
  return RELIGHTS.filter((r) => r.strip === stripId).map((r) => {
    const p = lay.plates[r.plateIndex];
    return p.x + p.width * r.frac;
  });
}

export function nearRelight(stripId: string, x: number, bandH?: number): boolean {
  return relightXs(stripId, bandH).some((rx) => Math.abs(rx - x) <= REACH);
}

/** Test-friendly default: the band height used when none is given. */
export const DEFAULT_BAND_H = 126;

export function layoutFor(stripId: string, bandH: number = DEFAULT_BAND_H): Layout | null {
  const w = walkwayFor(stripId);
  return w ? layoutWalkway(w, bandH) : null;
}

export function strip(id: string): Strip {
  const s = TOWN.strips.find((t) => t.id === id);
  if (!s) throw new Error(`no strip ${id}`);
  return s;
}

export function clampToStrip(stripId: string, x: number, bandH?: number): number {
  const lay = layoutFor(stripId, bandH);
  if (lay) return clampTo(x, lay.length);
  const s = TOWN.strips.find((t) => t.id === stripId);
  return clampTo(x, s ? s.length : 0);
}

/**
 * The worklet form. The gesture is built once at mount, so it cannot
 * capture a strip id - she changes strips, and the captured one would
 * be stale the moment she turned into a lane. It clamps to a length the
 * screen keeps in a shared value instead.
 */
export function clampTo(x: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(0, x));
}

/** Where every lane mouth sits on this strip. */
export function linksOn(stripId: string): { link: Link; x: number }[] {
  return TOWN.links.flatMap((l) => {
    if (l.a.strip === stripId) return [{ link: l, x: l.a.x }];
    if (l.b.strip === stripId) return [{ link: l, x: l.b.x }];
    return [];
  });
}

/** Every bridge standing on this strip, for drawing them into the world. */
export function bridgesOn(stripId: string): Landmark[] {
  return TOWN.bridges.filter((b) => b.strip === stripId);
}

/**
 * A bridge is a real size in the town, not a fraction of the screen.
 * Scaling by screen height made a wide plate render two screens across
 * and a tall one fill the view - same code, different objects.
 */
export const BRIDGE_SPAN = 620;

/** Which bridges she walked over going from fromX to toX. */
export function bridgesCrossed(
  stripId: string,
  fromX: number,
  toX: number,
  bandH?: number,
): { id: string }[] {
  const lay = layoutFor(stripId, bandH);
  if (!lay) return [];
  return bridgesPassed(lay, fromX, toX).map((i) => ({
    id: `${stripId}:bridge:${i}`,
  }));
}

/** The one crossing she is close enough to take, if any. */
export function linkInReach(stripId: string, x: number): Link | null {
  let best: Link | null = null;
  let bestD = REACH;
  for (const { link, x: lx } of linksOn(stripId)) {
    const d = Math.abs(lx - x);
    if (d <= bestD) {
      best = link;
      bestD = d;
    }
  }
  return best;
}

export function otherEnd(link: Link, stripId: string): { strip: string; x: number } {
  return link.a.strip === stripId ? link.b : link.a;
}

export interface Position {
  readonly strip: string;
  readonly x: number;
  /** 走三桥: which bridges have been spent. Order matters for the rite. */
  readonly crossed: readonly string[];
}

export function beginAt(stripId: string): Position {
  return { strip: stripId, x: 0, crossed: [] };
}

export interface Crossing {
  readonly position: Position;
  /**
   * DECISIONS 102. Recrossing a bridge already spent is doubling back,
   * and doubling back costs a flame - the price set at 18, never a wall.
   * The game does NOT say which bridges are spent; that is what the
   * player's paper is for.
   */
  readonly costsAFlame: boolean;
}

/** Turn into a lane. Lanes are free - they are not part of the rite. */
export function cross(pos: Position, link: Link): Crossing {
  const to = otherEnd(link, pos.strip);
  return {
    position: { strip: to.strip, x: to.x, crossed: pos.crossed },
    costsAFlame: false,
  };
}

/**
 * Walk from fromX to toX, crossing whatever bridges lie between.
 *
 * A fresh bridge counts toward the three. Walking back over one already
 * spent is doubling back - DECISIONS 102 - and costs a flame per bridge.
 * She is never stopped; she crosses and pays.
 */
export function walkTo(pos: Position, toX: number, bandH?: number): Crossing {
  const met = bridgesCrossed(pos.strip, pos.x, toX, bandH);
  let crossed = pos.crossed;
  let flames = 0;
  for (const b of met) {
    if (crossed.includes(b.id)) flames += 1;
    else crossed = [...crossed, b.id];
  }
  return {
    position: { ...pos, x: toX, crossed },
    costsAFlame: flames > 0,
  };
}

/** How many of the three the rite still wants. */
export function bridgesRemaining(pos: Position): number {
  return Math.max(0, 3 - pos.crossed.length);
}

export function riteComplete(pos: Position): boolean {
  return pos.crossed.length >= 3;
}

/**
 * DECISIONS 108. The depth step: outward (toward the water) or inward.
 * Returns null when the town has no strip that way.
 */
export function stepDepth(
  pos: Position,
  dir: 'outward' | 'inward',
): Position | null {
  const to = dir === 'outward' ? OUTWARD[pos.strip] : INWARD[pos.strip];
  if (!to) return null;
  return { ...pos, strip: to };
}

export function payForDoublingBack(fires: FireCount): FireCount {
  return (fires > 0 ? fires - 1 : 0) as FireCount;
}

export const FULL_FIRES: FireCount = MAX_FIRES;
