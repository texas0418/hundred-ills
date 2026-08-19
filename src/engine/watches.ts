/**
 * 更點 - watches and points. Time, chapters, and the watchman.
 *
 * DECISIONS 15, 88, 89. Five watches of five points each: TWENTY-FIVE
 * chapters, not five. Five is the count of watches, which are ~90 minute
 * acts and the only thing that gets a title card.
 *
 * Pure module.
 */

export const WATCHES = 5;
export const POINTS_PER_WATCH = 5;
export const TOTAL_POINTS = WATCHES * POINTS_PER_WATCH;

export const WATCH_NAMES = ['一更', '二更', '三更', '四更', '五更'] as const;
export const WATCH_NAMES_EN = [
  'the first watch',
  'the second watch',
  'the third watch',
  'the fourth watch',
  'the fifth watch',
] as const;

const POINT_NUMERALS = ['一點', '二點', '三點', '四點', '五點'] as const;

/**
 * DECISIONS 88: points are NOT uniform. Real watches were measured by
 * actual darkness and stretched with the season, and ours is the first
 * lunar month - the longest night of the year. The unevenness also stops
 * the game feeling gridded. Minutes, indexed by ordinal - 1.
 */
const POINT_MINUTES: readonly number[] = [
  10, 12, 14, 14, 16, // 一更 - learning the town
  14, 16, 18, 16, 18, // 二更
  20, 22, 24, 20, 22, // 三更 - both states in play, the real puzzles
  18, 20, 22, 24, 20, // 四更
  16, 18, 14, 12, 10, // 五更 - tightening to the door
]; // 430 minutes, 7.2 hours - inside the 6-8h target at DECISIONS 83

export interface Chapter {
  /** 1-5 */
  readonly watch: number;
  /** 1-5 */
  readonly point: number;
}

export function ordinalOf(c: Chapter): number {
  return (c.watch - 1) * POINTS_PER_WATCH + c.point;
}

export function chapterAt(ordinal: number): Chapter {
  const i = ordinal - 1;
  return {
    watch: Math.floor(i / POINTS_PER_WATCH) + 1,
    point: (i % POINTS_PER_WATCH) + 1,
  };
}

export function isValid(ordinal: number): boolean {
  return Number.isInteger(ordinal) && ordinal >= 1 && ordinal <= TOTAL_POINTS;
}

/** '三更二點' - what the watchman calls and what the resume screen shows. */
export function label(c: Chapter): string {
  return `${WATCH_NAMES[c.watch - 1]}${POINT_NUMERALS[c.point - 1]}`;
}

export function minutesFor(ordinal: number): number {
  return POINT_MINUTES[ordinal - 1];
}

export function totalMinutes(): number {
  return POINT_MINUTES.reduce((a, b) => a + b, 0);
}

/**
 * DECISIONS 89. The strike encodes the count: the watch as slow deep
 * strikes, the point as quick light ones. Nobody explains it; the number
 * is always right, so the player teaches themselves to read it inside
 * the first watch. This is the clock, the chapter number, the progress
 * bar and the save indicator, and it is a man hitting a piece of bamboo.
 */
export interface Strike {
  readonly slow: number;
  readonly quick: number;
}

export function strikeFor(c: Chapter): Strike {
  return { slow: c.watch, quick: c.point };
}

/**
 * The watchman's LAST call is 五更三點, some minutes before she reaches
 * the door. After that he is silent, because the door sequence must give
 * the player nothing to wait for (ENDING-SEQUENCE.txt, movement three).
 * The silence after his last call is the loudest thing in the game.
 */
export const LAST_CALL = ordinalOf({ watch: 5, point: 3 });

export function watchmanCallsAt(ordinal: number): boolean {
  return isValid(ordinal) && ordinal <= LAST_CALL;
}

/** Autosave rides the strike, so it stops when he does not. */
export function savesAt(ordinal: number): boolean {
  return watchmanCallsAt(ordinal);
}

/** A full-stop title card, five times only, at the act breaks. */
export function showsWatchCard(c: Chapter): boolean {
  return c.point === 1;
}
