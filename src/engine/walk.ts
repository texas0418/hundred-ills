/**
 * One walkable minute of 一更.
 *
 * Everything here is pure so Node can test it. The screen owns input and
 * drawing; this owns what the walk MEANS.
 */

import { MAX_FIRES, readingOf, type FireCount, type Reading } from './fires';
import {
  cross,
  linkInReach,
  payForDoublingBack,
  walkTo,
  type Position,
  beginAt,
} from './town';
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
  /**
   * Pixels walked. Mirrors the shared value the renderer animates - the
   * screen owns the authoritative x on the UI thread, because a React
   * state update per frame is not a walk.
   */
  readonly x: number;
  readonly fires: FireCount;
  /** Milliseconds since the watch began. Callers pass it; no clock here. */
  readonly elapsedMs: number;
  /** True while she is leaning over the water, counting. */
  readonly looking: boolean;
  /**
   * Where in the town she is, and which bridges the rite has spent.
   * Folded in here rather than kept alongside so that a crossing is ONE
   * pure transition Node can test, instead of three setState calls
   * racing each other in a callback.
   */
  readonly pos: Position;
}

export function beginFirstWatch(): WalkState {
  return {
    x: 0, fires: MAX_FIRES, elapsedMs: 0, looking: false,
    pos: beginAt('north'),
  };
}

/**
 * Turn into whatever lane she is standing at. Returns the state
 * unchanged if there is nothing in reach, so the caller can fire this at
 * any gesture without checking first.
 */
export function applyCrossing(s: WalkState, atX: number): WalkState {
  const link = linkInReach(s.pos.strip, atX);
  if (!link) return s;
  const c = cross({ ...s.pos, x: atX }, link);
  return { ...s, pos: c.position, x: c.position.x };
}

/**
 * Report where the walk has got to, crossing any bridges passed on the
 * way. DECISIONS 105: a bridge is crossed by WALKING OVER IT, not by a
 * gesture - which is what makes "do not turn back" literal. Walking back
 * over a bridge already spent costs a flame, and never stops her.
 */
export function arriveAt(s: WalkState, toX: number): WalkState {
  const c = walkTo(s.pos, toX);
  if (c.position.crossed.length === s.pos.crossed.length && !c.costsAFlame) {
    return s.x === toX ? s : { ...s, x: toX, pos: c.position };
  }
  return {
    ...s,
    x: toX,
    pos: c.position,
    fires: c.costsAFlame ? payForDoublingBack(s.fires) : s.fires,
  };
}

/** She cannot walk off the left end of the district. */
export const DISTRICT_START = 0;

export function step(s: WalkState, dx: number, dtMs: number): WalkState {
  // Leaning over the water is standing still. You cannot count and walk.
  const x = s.looking ? s.x : Math.max(DISTRICT_START, s.x + dx);
  return { ...s, x, elapsedMs: s.elapsedMs + dtMs * DEMO_TIME_SCALE };
}

/** Advance only the night. The walk itself is animated elsewhere. */
export function tick(s: WalkState, dtMs: number): WalkState {
  return { ...s, elapsedMs: s.elapsedMs + dtMs * DEMO_TIME_SCALE };
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
