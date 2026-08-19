/**
 * 三把火 - the three fires.
 *
 * DECISIONS 16, 17, 66, 84. This is NOT a health system and nothing in
 * this file may be renamed to suggest it is. A living person carries
 * three flames, one on each shoulder and one on the crown. She is dead
 * and does not know it; the fires are the performance of being alive.
 *
 * Pure module. No expo or react-native imports - Node runs this in tests.
 */

export const MAX_FIRES = 3;

export type FireCount = 0 | 1 | 2 | 3;

/** What the world reads her as. Wards and the dead both consult this. */
export type Reading = 'living' | 'ambiguous' | 'dead';

/** Ways a flame goes out. All sourced - see docs/LORE.txt. */
export type Snuffer = 'look_back' | 'answer_name' | 'shoulder_tap' | 'cold';

/** 陽氣. Ways a flame comes back. All ordinary objects in a winter town. */
export type Warmth = 'hearth' | 'brazier' | 'lamp' | 'oven' | 'living_body';

/**
 * The middle is deliberately useless.
 *
 * At 1 or 2 fires she passes no ward AND the dead still hide from her.
 * That squeeze is the point: the player cannot drift, they must commit
 * to being fully alive or fully dead. Do not "fix" this by making
 * 'ambiguous' behave like one of the ends.
 */
export function readingOf(fires: FireCount): Reading {
  if (fires === MAX_FIRES) return 'living';
  if (fires === 0) return 'dead';
  return 'ambiguous';
}

export interface FireChange {
  readonly fires: FireCount;
  /** False when the action had no effect - already out, or already full. */
  readonly changed: boolean;
}

export function snuff(fires: FireCount, _cause: Snuffer): FireChange {
  if (fires === 0) return { fires, changed: false };
  return { fires: (fires - 1) as FireCount, changed: true };
}

export function relight(fires: FireCount, _source: Warmth): FireChange {
  if (fires === MAX_FIRES) return { fires, changed: false };
  return { fires: (fires + 1) as FireCount, changed: true };
}

/** Can she see and walk the spirit layer? Only when she reads as dead. */
export function spiritLayerOpen(fires: FireCount): boolean {
  return readingOf(fires) === 'dead';
}

/**
 * DECISIONS 67, 68. She counts her flames in the canal.
 * At zero there is nothing to count, because there is no reflection -
 * which is the whole of the third-bridge reveal. Callers must render
 * the ABSENCE, never a "0 fires" readout.
 */
export function hasReflection(fires: FireCount): boolean {
  return fires > 0;
}
