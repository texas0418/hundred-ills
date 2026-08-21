/**
 * The town as nodes. DECISIONS 109: each node is one painted screen,
 * and gameplay is what happens as she moves between them.
 *
 * Pure module - Node tests everything here.
 */

import { MAX_FIRES, readingOf, type FireCount, type Reading } from './fires';
import { TOTAL_POINTS, chapterAt, label, strikeFor, type Chapter } from './watches';

export type Way = 'left' | 'right' | 'up' | 'down';

export interface TownNode {
  readonly id: string;
  readonly exits: Readonly<Partial<Record<Way, string>>>;
  /**
   * A bridge node spends the rite when TRAVERSED - entered one side,
   * left the other. 走三桥, DECISIONS 102, discrete.
   */
  readonly bridge?: boolean;
  /** A lit lantern in the painting: standing here warms her. */
  readonly warm?: boolean;
  /** The water's edge: flames show here, and worse at zero. */
  readonly water?: boolean;
}

/**
 * The first district, per docs/TOWN-MAP.txt. Two edges are TEMPORARY
 * until the rest of the map's screens land, and are marked so:
 * canal two's banks ([47]-[49]) will carry the lantern corner, and
 * bank east ([42]) continues the near-bank chain past the bridge.
 */
export const NODES: Record<string, TownNode> = {
  gate: {
    id: 'gate',
    // The painting licenses ONE exit: the flagged lane running from
    // the gate to the foreground. The gate is shut; the only move is
    // to turn from it and walk back down the lane. The map drew this
    // edge left/right, but the art won (DECISIONS 109) - the
    // generation gave no side lane.
    exits: { down: 'gatelane' },
  },
  gatelane: {
    id: 'gatelane',
    // A corridor screen: the lane recedes along the wall INTO the
    // picture (up, to the gate) and exits the foreground (down, to
    // the mooring). The painting has no sideways path, so it has no
    // sideways exits.
    exits: { up: 'gate', down: 'mooring' },
  },
  mooring: {
    id: 'mooring',
    // The central alley rising between the houses is the visible way
    // up toward the gate lane; the bank walks right; the water is
    // below.
    exits: { up: 'gatelane', right: 'bridge', down: 'water' },
  },
  water: {
    id: 'water',
    exits: { up: 'mooring' },
    water: true,
  },
  bridge: {
    id: 'bridge',
    // The deck rises over the arch and carries the bank walk onward -
    // right continues her bank to the east stretch, spending the
    // bridge as she passes (the map's chain, DECISIONS 102/105). The
    // far bank - the town not-hers - is down, past the arch and
    // across. If walking it says the deck should cross to the far
    // bank instead, swap right and down here.
    exits: { left: 'mooring', up: 'alley', right: 'bank-east', down: 'farbank' },
    bridge: true,
  },
  farbank: {
    id: 'farbank',
    exits: { up: 'bridge' },
  },
  'bank-east': {
    id: 'bank-east',
    // [42], the plain breathing stretch: laundry poles over the
    // water, one lantern door.
    exits: { left: 'bridge', right: 'bridge-b', down: 'east-water' },
  },
  'east-water': {
    id: 'east-water',
    // [45]: the washing slab and the paddle someone set down and
    // never came back for. The generation put two red seals on the
    // stones - rule 5 - so the window ends at x875 and the painting
    // ships with no red at all; on a water screen her flames are the
    // vermilion.
    exits: { up: 'bank-east' },
    water: true,
  },
  'bridge-b': {
    id: 'bridge-b',
    // [43]: the flat beam bridge, second of the night's three.
    exits: { left: 'bank-east', right: 'bank-end' },
    bridge: true,
  },
  'bank-end': {
    id: 'bank-end',
    // [44]: where her bank runs out. A dead end that says the town
    // continues where she cannot yet go.
    exits: { left: 'bridge-b' },
  },
  alley: {
    id: 'alley',
    exits: { down: 'bridge', up: 'alley-deep' },
  },
  'alley-deep': {
    id: 'alley-deep',
    exits: { down: 'alley', up: 'junction' },
  },
  junction: {
    id: 'junction',
    // The Y-split, both mouths real: left walks toward the visible
    // glow and reaches the lantern; right climbs to canal two at its
    // west bank. Canal two closes into a ring - junction, lantern,
    // inland east, the house with the lamp, inland west, junction -
    // the first loop players will draw on their maps.
    exits: { down: 'alley-deep', left: 'lantern', right: 'inland-west' },
  },
  lantern: {
    id: 'lantern',
    // [38], the warm place. Its lane runs into darkness both ways and
    // both ways are now real: right to the junction, left onto canal
    // two's east bank.
    exits: { left: 'inland-east', right: 'junction' },
    warm: true,
  },
  'inland-west': {
    id: 'inland-west',
    // [47]: the town behind the town, houses leaning close.
    exits: { left: 'junction', right: 'house-lamp', down: 'inland-water' },
  },
  'inland-water': {
    id: 'inland-water',
    // [50]: the meaner water. Flames render here too.
    exits: { up: 'inland-west' },
    water: true,
  },
  'house-lamp': {
    id: 'house-lamp',
    // [48], the story screen, mid-chain on canal two as the map
    // wants: the lamp lit in the window all night, and nobody remarks
    // on it. She passes and does not go in - the door is art, not an
    // exit, until the wards say otherwise.
    exits: { left: 'inland-west', right: 'neighbours-wall' },
  },
  'neighbours-wall': {
    id: 'neighbours-wall',
    // [51], ENDING-SITE plant 4, placed per OPENING (ratified
    // 2026-08-21): the neighbour's wall stands beside her house. The
    // print is seen plainly and warmly and never remarked on again.
    exits: { left: 'house-lamp', right: 'inland-east' },
  },
  'inland-east': {
    id: 'inland-east',
    // [49]: the shrine niche hints at what lives inland. The map
    // hangs the lantern off this bank; its steps to the water stay
    // art-only for now.
    exits: { left: 'neighbours-wall', right: 'lantern' },
  },
};

export function node(id: string): TownNode {
  const n = NODES[id];
  if (!n) throw new Error(`no node ${id}`);
  return n;
}

const OPPOSITE: Record<Way, Way> = {
  left: 'right', right: 'left', up: 'down', down: 'up',
};

export interface TownState {
  readonly nodeId: string;
  readonly fires: FireCount;
  /** Which way she came INTO the current node, for bridge traversal. */
  readonly enteredFrom: Way | null;
  /** Bridge nodes the rite has spent, in order. */
  readonly crossed: readonly string[];
  /** Milliseconds since the watch began. */
  readonly elapsedMs: number;
  /** Milliseconds of warmth accumulated where she stands. */
  readonly warmMs: number;
}

export function beginNight(at: string = 'gate'): TownState {
  return {
    nodeId: at, fires: MAX_FIRES, enteredFrom: null,
    crossed: [], elapsedMs: 0, warmMs: 0,
  };
}

export interface Move {
  readonly state: TownState;
  readonly moved: boolean;
  /** True when this move was doubling back over a spent bridge. */
  readonly costAFlame: boolean;
}

/**
 * Step through an exit. Leaving a bridge node through the side opposite
 * the one she entered is a TRAVERSAL: the first spends the bridge for
 * the rite; doing it again is doubling back and costs a flame - never
 * a wall, always a price (DECISIONS 18).
 */
export function move(s: TownState, way: Way): Move {
  const here = node(s.nodeId);
  const to = here.exits[way];
  if (!to) return { state: s, moved: false, costAFlame: false };

  let crossed = s.crossed;
  let fires = s.fires;
  let cost = false;
  if (here.bridge && s.enteredFrom && way !== s.enteredFrom) {
    if (crossed.includes(here.id)) {
      cost = true;
      fires = (fires > 0 ? fires - 1 : 0) as FireCount;
    } else {
      crossed = [...crossed, here.id];
    }
  }
  return {
    state: {
      ...s, nodeId: to, enteredFrom: OPPOSITE[way],
      crossed, fires, warmMs: 0,
    },
    moved: true,
    costAFlame: cost,
  };
}

export function bridgesRemaining(s: TownState): number {
  return Math.max(0, 3 - s.crossed.length);
}

/** Turning to look behind you costs a flame. DECISIONS 16. */
export function lookBack(s: TownState): TownState {
  if (s.fires === 0) return s;
  return { ...s, fires: (s.fires - 1) as FireCount };
}

/** DECISIONS 84: standing by a lit lantern relights, in real time. */
export const RELIGHT_MS = 2200;

export function tick(s: TownState, dtMs: number, timeScale: number): TownState {
  let out: TownState = { ...s, elapsedMs: s.elapsedMs + dtMs * timeScale };
  if (node(s.nodeId).warm && s.fires < MAX_FIRES) {
    const warm = s.warmMs + dtMs;
    if (warm >= RELIGHT_MS) {
      out = { ...out, warmMs: 0, fires: (s.fires + 1) as FireCount };
    } else {
      out = { ...out, warmMs: warm };
    }
  } else if (s.warmMs !== 0) {
    out = { ...out, warmMs: 0 };
  }
  return out;
}

/** The five watches still govern the night. */
const POINT_MS = 20 * 60 * 1000;

export function pointIndex(s: TownState): number {
  return Math.min(TOTAL_POINTS, Math.floor(s.elapsedMs / POINT_MS) + 1);
}

export function chapter(s: TownState): Chapter {
  return chapterAt(pointIndex(s));
}

export function call(s: TownState): { label: string; slow: number; quick: number } {
  const c = chapter(s);
  const st = strikeFor(c);
  return { label: label(c), slow: st.slow, quick: st.quick };
}

const CALL_AT = 0.35;
const CALL_LEN = 4000 * 1000;

export function watchmanCalling(s: TownState): boolean {
  const into = s.elapsedMs % POINT_MS;
  return into >= POINT_MS * CALL_AT && into < POINT_MS * CALL_AT + CALL_LEN;
}

export function reading(s: TownState): Reading {
  return readingOf(s.fires);
}

/** 0 living to 1 dead: the whole-screen drain crossfade. */
export function drainAmount(s: TownState): number {
  return (MAX_FIRES - s.fires) / MAX_FIRES;
}
