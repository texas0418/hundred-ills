/**
 * Pure save state. No expo-sqlite import here - the persistence layer
 * wraps this. House rule: pure modules take no expo or react-native
 * imports so Node can test them.
 *
 * Time is sacred: no Date.now() in this file. Callers pass nowMs.
 */

import { MAX_FIRES, type FireCount } from './engine/fires';
import { TOTAL_POINTS, isValid } from './engine/watches';

export type Ending = 'answered' | 'waited' | 'released';

export interface SaveState {
  readonly ordinal: number;
  readonly fires: FireCount;
  /** 1-3, per DECISIONS 85. Space does not align to time. */
  readonly district: number;
  /** Set of authored flags - puzzles solved, lore read, wards examined. */
  readonly flags: readonly string[];
  /** DECISIONS 80: the second walk is required, so this persists. */
  readonly endingsSeen: readonly Ending[];
  readonly updatedMs: number;
}

export function newGame(nowMs: number): SaveState {
  return {
    ordinal: 1,
    fires: MAX_FIRES,
    district: 1,
    flags: [],
    endingsSeen: [],
    updatedMs: nowMs,
  };
}

export function withFlag(s: SaveState, flag: string): SaveState {
  if (s.flags.includes(flag)) return s;
  return { ...s, flags: [...s.flags, flag] };
}

export function hasFlag(s: SaveState, flag: string): boolean {
  return s.flags.includes(flag);
}

export function recordEnding(s: SaveState, e: Ending): SaveState {
  if (s.endingsSeen.includes(e)) return s;
  return { ...s, endingsSeen: [...s.endingsSeen, e] };
}

/**
 * DECISIONS 82. The 破血湖 release is walk-two only: it requires almanac
 * reading nobody completes first time through. Gate it on having
 * finished a walk, not on a difficulty setting.
 */
export function releaseAvailable(s: SaveState): boolean {
  return s.endingsSeen.length > 0 && hasFlag(s, 'almanac.xuehu.read');
}

export function isCoherent(s: SaveState): boolean {
  return (
    isValid(s.ordinal) &&
    s.ordinal <= TOTAL_POINTS &&
    s.fires >= 0 &&
    s.fires <= MAX_FIRES &&
    s.district >= 1 &&
    s.district <= 3
  );
}
