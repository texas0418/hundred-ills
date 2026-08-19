/**
 * 門神 - door gods, and the lock system.
 *
 * DECISIONS 60, 84. Wards are installed against THE DEAD. Alive gets you
 * into houses; dead gets you into the spirit layer. An early draft of
 * docs/LENGTH.txt had this backwards and the bug is locked out by
 * test-wards.ts. Do not invert it again.
 *
 * Pure module.
 */

import { readingOf, type FireCount, type Reading } from './fires';

/**
 * 'new' is her own door and only her own door: gods pasted up eleven
 * days ago at New Year, uncreased and bright. It refuses EVERY reading,
 * including 'living', because three fires is a costume and not a key
 * (DECISIONS 81, ENDING-SEQUENCE.txt movement three). It opens by
 * invitation alone.
 */
export type WardState = 'new' | 'intact' | 'faded' | 'torn';

export interface Passage {
  readonly canPass: boolean;
  /** Why, for authoring and for tests. Never shown to the player. */
  readonly reason:
    | 'living_passes'
    | 'ward_refuses_the_dead'
    | 'ward_refuses_the_ambiguous'
    | 'ward_lapsed'
    | 'new_ward_refuses_all'
    | 'called_past';
}

/**
 * 叫魂. A soul called home by its own family is not an intruder.
 * This is the only thing that opens a 'new' ward, and it is the last
 * input in the game.
 */
export function passWard(
  ward: WardState,
  fires: FireCount,
  invited: boolean = false,
): Passage {
  if (invited) return { canPass: true, reason: 'called_past' };
  if (ward === 'new') return { canPass: false, reason: 'new_ward_refuses_all' };
  if (ward === 'faded' || ward === 'torn') {
    return { canPass: true, reason: 'ward_lapsed' };
  }
  return refuseOrAdmit(readingOf(fires));
}

function refuseOrAdmit(reading: Reading): Passage {
  if (reading === 'living') return { canPass: true, reason: 'living_passes' };
  if (reading === 'dead') {
    return { canPass: false, reason: 'ward_refuses_the_dead' };
  }
  return { canPass: false, reason: 'ward_refuses_the_ambiguous' };
}
