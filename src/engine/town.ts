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
 * A crossing. Bidirectional: standing at either end puts you within
 * reach of the other.
 */
export interface Link {
  readonly id: string;
  readonly via: 'bridge' | 'lane';
  readonly a: { strip: string; x: number };
  readonly b: { strip: string; x: number };
  /** Which of the three ritual bridges this is, if any. */
  readonly bridgePlate?: string;
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

export const TOWN: { strips: Strip[]; links: Link[] } = {
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
  links: [
    {
      id: 'bridge-a', via: 'bridge', bridgePlate: 'bridge-one',
      a: { strip: 'north', x: 900 }, b: { strip: 'south', x: 900 },
    },
    {
      id: 'bridge-b', via: 'bridge', bridgePlate: 'bridge-two',
      a: { strip: 'north', x: 2700 }, b: { strip: 'south', x: 2700 },
    },
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

/** Where every link sits on this strip, for drawing them into the world. */
export function linksOn(stripId: string): { link: Link; x: number }[] {
  return TOWN.links.flatMap((l) => {
    if (l.a.strip === stripId) return [{ link: l, x: l.a.x }];
    if (l.b.strip === stripId) return [{ link: l, x: l.b.x }];
    return [];
  });
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

export function cross(pos: Position, link: Link): Crossing {
  const to = otherEnd(link, pos.strip);
  const spent = link.via === 'bridge' && pos.crossed.includes(link.id);
  const crossed =
    link.via === 'bridge' && !spent ? [...pos.crossed, link.id] : pos.crossed;
  return {
    position: { strip: to.strip, x: to.x, crossed },
    costsAFlame: spent,
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
