/**
 * The soundscape, pure. docs/AUDIO.txt is the plan; this module is
 * the part a test can hold: which sounds exist, how each screen
 * mixes them, and how the clapper strikes a call.
 *
 * The current files are SYNTHESIZED PLACEHOLDERS, correct in role
 * and length only; Simon's sourced recordings replace them
 * one-for-one under the same names.
 */

/** Every audio file the game ships, by id, without extensions -
 *  test-content checks each exists on disk; soundSources.ts must
 *  mirror these keys exactly (the type below enforces it). */
export const FILES = {
  'clapper-slow-1': 1, 'clapper-slow-2': 1, 'clapper-slow-3': 1, 'clapper-slow-4': 1,
  'clapper-quick-1': 1, 'clapper-quick-2': 1, 'clapper-quick-3': 1, 'clapper-quick-4': 1,
  'studs-1': 1, 'studs-2': 1, 'studs-3': 1,
  'water-loop': 1, 'wind-loop': 1, 'bed-loop': 1,
  'water-drained': 1, 'wind-drained': 1, 'bed-drained': 1,
} as const;

export type SoundId = keyof typeof FILES;

export interface Mix {
  /** 0..1 level for the still-canal loop. */
  readonly water: number;
  /** 0..1 level for the winter wind loop. */
  readonly wind: number;
}

/** Per-screen ambience. The night bed always plays beneath at a
 *  fixed low level; these are the two voices that move. Walking
 *  toward the canal brings the water up before the screen arrives
 *  (the hook cross-fades over the phase). */
export const MIX: Record<string, Mix> = {
  gate: { water: 0, wind: 0.5 },
  gatelane: { water: 0, wind: 0.6 },
  mooring: { water: 0.45, wind: 0.15 },
  water: { water: 1, wind: 0 },
  bridge: { water: 0.55, wind: 0.1 },
  'bank-east': { water: 0.45, wind: 0.1 },
  'east-water': { water: 1, wind: 0 },
  'bridge-b': { water: 0.55, wind: 0.1 },
  'bank-end': { water: 0.4, wind: 0.25 },
  'covered-bridge': { water: 0.45, wind: 0.3 },
  alley: { water: 0.15, wind: 0.5 },
  'alley-deep': { water: 0, wind: 0.7 },
  junction: { water: 0, wind: 0.6 },
  lantern: { water: 0, wind: 0.3 },
  'house-lamp': { water: 0, wind: 0.35 },
  'neighbours-wall': { water: 0, wind: 0.4 },
  'inland-west': { water: 0.3, wind: 0.3 },
  'inland-east': { water: 0.25, wind: 0.3 },
  'inland-water': { water: 1, wind: 0.1 },
};

/** The night bed's constant level. */
export const BED_LEVEL = 0.5;

/** DECISIONS 88: slow deep strikes count the watch, quick light
 *  ones count the point. The spacing is the walk of a cold man. */
export const SLOW_GAP_MS = 680;
export const QUICK_GAP_MS = 430;
export const BETWEEN_MS = 950;

export interface Strike {
  readonly kind: 'slow' | 'quick';
  readonly atMs: number;
}

/** The full strike pattern for a call, as offsets from its start. */
export function strikePattern(slow: number, quick: number): Strike[] {
  const out: Strike[] = [];
  let t = 0;
  for (let i = 0; i < slow; i++) {
    out.push({ kind: 'slow', atMs: t });
    t += SLOW_GAP_MS;
  }
  t += BETWEEN_MS - SLOW_GAP_MS;
  for (let i = 0; i < quick; i++) {
    out.push({ kind: 'quick', atMs: t });
    t += QUICK_GAP_MS;
  }
  return out;
}

/** Rotate takes so nothing plays the same recording twice running. */
export function takeFor(kind: 'clapper-slow' | 'clapper-quick' | 'studs', n: number): SoundId {
  const count = kind === 'studs' ? 3 : 4;
  return `${kind}-${(n % count) + 1}` as SoundId;
}
