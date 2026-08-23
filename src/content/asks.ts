/**
 * 擲筊, the ask verb (DECISIONS 20-22). The question is never typed:
 * it is always "this way?", asked of the place she stands, and the
 * blocks answer for the place. Authored per screen; the god laughs
 * where that was the wrong question to ask.
 *
 * docs/FIRST-WATCH.txt, ratified 2026-08-23. Pure module.
 */

export type Cast = 'sheng' | 'yin' | 'xiao';

export const CAST: Record<string, Cast> = {
  // the rite passes through these - yes
  mooring: 'sheng', bridge: 'sheng', 'bank-east': 'sheng', 'bridge-b': 'sheng',
  alley: 'sheng', 'alley-deep': 'sheng', junction: 'sheng', 'inland-west': 'sheng',
  'inland-east': 'sheng',
  // not a way - no
  gate: 'yin', water: 'yin', 'east-water': 'yin', 'inland-water': 'yin',
  'bank-end': 'yin',
  // the wrong question - the god is laughing
  'house-lamp': 'xiao', 'neighbours-wall': 'xiao', lantern: 'xiao', gatelane: 'xiao',
};

/** Where nothing is authored the god laughs: the question was wrong. */
export function castAt(node: string): Cast {
  return CAST[node] ?? 'xiao';
}
