/**
 * One walkable minute of 一更.
 *
 * Everything here is pure so Node can test it. The screen owns input and
 * drawing; this owns what the walk MEANS.
 */

import { MAX_FIRES, readingOf, type FireCount, type Reading } from './fires';
import {
  TOTAL_POINTS,
  chapterAt,
  label as chapterLabel,
  strikeFor,
  type Chapter,
} from './watches';

/**
 * A point is about twenty minutes of real play (DECISIONS 88). Nobody
 * can look at that in a slice, so the demo compresses one point into
 * twenty seconds and says so out loud. Ship with this at 1.
 */
export const DEMO_TIME_SCALE = 60;
const POINT_MS = 20 * 60 * 1000;

export interface WalkState {
  /** Pixels walked from the start of the district. Negative is left. */
  readonly x: number;
  readonly fires: FireCount;
  /** Milliseconds since the watch began. Callers pass it; no clock here. */
  readonly elapsedMs: number;
  /** True while she is leaning over the water, counting. */
  readonly looking: boolean;
}

export function beginFirstWatch(): WalkState {
  return { x: 0, fires: MAX_FIRES, elapsedMs: 0, looking: false };
}

/** She cannot walk off the left end of the district. */
export const DISTRICT_START = 0;

export function step(s: WalkState, dx: number, dtMs: number): WalkState {
  // Leaning over the water is standing still. You cannot count and walk.
  const x = s.looking ? s.x : Math.max(DISTRICT_START, s.x + dx);
  return { ...s, x, elapsedMs: s.elapsedMs + dtMs * DEMO_TIME_SCALE };
}

export function pointIndex(s: WalkState): number {
  return Math.min(TOTAL_POINTS, Math.floor(s.elapsedMs / POINT_MS) + 1);
}

export function chapter(s: WalkState): Chapter {
  return chapterAt(pointIndex(s));
}

/**
 * The watchman is somewhere in the streets, and you hear him rather than
 * meet him. He calls once per point, a little way into it - so the
 * player is walking when it happens, never waiting for it.
 */
const CALL_AT_FRACTION = 0.35;
const CALL_MS = 4000 * 1000;

export function watchmanCalling(s: WalkState): boolean {
  const into = s.elapsedMs % POINT_MS;
  return into >= POINT_MS * CALL_AT_FRACTION
    && into < POINT_MS * CALL_AT_FRACTION + CALL_MS;
}

export interface Call {
  readonly slow: number;
  readonly quick: number;
  readonly label: string;
}

export function currentCall(s: WalkState): Call {
  const c = chapter(s);
  const st = strikeFor(c);
  return { slow: st.slow, quick: st.quick, label: chapterLabel(c) };
}

/**
 * DECISIONS 67 and 68. She counts her flames in the canal, and at zero
 * there is nothing to count because there is no reflection. The screen
 * must render the ABSENCE - never a "0 fires" readout.
 */
export interface Reflection {
  readonly visible: boolean;
  readonly flames: number;
}

export function reflection(s: WalkState): Reflection {
  if (!s.looking) return { visible: false, flames: 0 };
  return { visible: s.fires > 0, flames: s.fires };
}

export function reading(s: WalkState): Reading {
  return readingOf(s.fires);
}

/**
 * How far the colour has drained, 0 living to 1 dead. The screen
 * cross-fades the full-colour plates to the drained ones by this.
 */
export function drainAmount(s: WalkState): number {
  return (MAX_FIRES - s.fires) / MAX_FIRES;
}

/** Turning to look behind you costs a flame (DECISIONS 18). */
export function lookBack(s: WalkState): WalkState {
  if (s.fires === 0) return s;
  return { ...s, fires: (s.fires - 1) as FireCount };
}

export function setLooking(s: WalkState, looking: boolean): WalkState {
  return { ...s, looking };
}
