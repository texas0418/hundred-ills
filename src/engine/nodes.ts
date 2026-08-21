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
    exits: { right: 'gatelane' },
  },
  gatelane: {
    id: 'gatelane',
    exits: { left: 'gate', right: 'mooring' },
  },
  mooring: {
    id: 'mooring',
    exits: { left: 'gatelane', right: 'bridge', down: 'water' },
  },
  water: {
    id: 'water',
    exits: { up: 'mooring' },
    water: true,
  },
  bridge: {
    id: 'bridge',
    // down: crossing to the far bank - the other side, the town
    // not-hers. TEMPORARY direction until [42] bank east lands and
    // the map settles how the crossing reads.
    exits: { left: 'mooring', up: 'alley', down: 'farbank' },
    bridge: true,
  },
  farbank: {
    id: 'farbank',
    exits: { up: 'bridge' },
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
    // up leads toward canal two. TEMPORARY: it reaches the lantern
    // corner directly until [47]-[49] land; the map hangs [38] off
    // second-canal bank east.
    exits: { down: 'alley-deep', up: 'lantern' },
  },
  lantern: {
    id: 'lantern',
    exits: { down: 'junction' },
    warm: true,
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
