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

export type StripKind = 'bank' | 'lane';

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

export const TOWN: { strips: Strip[]; links: Link[]; bridges: Landmark[] } = {
  strips: [
    {
      id: 'north', kind: 'bank', length: BANK_LENGTH,
      plates: { far: 'canal-far-pair', mid: 'canal-mid', kerb: 'canal-near-kerb' },
    },
    {
      // The far side of the same canal. Uses the same plates until the
      // second bank plate exists - so crossing currently changes WHERE
      // you are without changing what you see. See the art note below.
      id: 'south', kind: 'bank', length: BANK_LENGTH,
      plates: { far: 'canal-far-pair', mid: 'canal-mid', kerb: 'canal-near-kerb' },
    },
  ],
  // Lanes. None yet - the art does not exist, so there is nowhere to
  // turn off to. The model is here so the first lane is a data change.
  links: [],
  bridges: [
    { id: 'bridge-a', strip: 'north', x: 900, plate: 'bridge-one' },
    { id: 'bridge-b', strip: 'north', x: 2400, plate: 'bridge-two' },
  ],
};

export function strip(id: string): Strip {
  const s = TOWN.strips.find((t) => t.id === id);
  if (!s) throw new Error(`no strip ${id}`);
  return s;
}

export function clampToStrip(stripId: string, x: number): number {
  'worklet';
  const s = TOWN.strips.find((t) => t.id === stripId);
  const max = s ? s.length : 0;
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
): Landmark[] {
  const lo = Math.min(fromX, toX);
  const hi = Math.max(fromX, toX);
  return bridgesOn(stripId).filter((b) => b.x > lo && b.x <= hi);
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
export function walkTo(pos: Position, toX: number): Crossing {
  const met = bridgesCrossed(pos.strip, pos.x, toX);
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

export function payForDoublingBack(fires: FireCount): FireCount {
  return (fires > 0 ? fires - 1 : 0) as FireCount;
}

export const FULL_FIRES: FireCount = MAX_FIRES;
