/**
 * The lines. docs/OPENING.txt is the authority; every line here was
 * ratified there (2026-08-21) and must survive DECISIONS 65's two
 * readings - an ordinary woman's thought on the first walk, the dead
 * performing being alive on the second.
 *
 * Two voices and no third (OPENING, ratified): the world's voice is
 * bilingual, characters first; her voice is interior English, a few
 * short sentences, and never describes what the player can see.
 *
 * Pure module - test-content.ts holds the prose rules.
 */

export type Trigger = 'enter' | 'touch' | 'flames';

export interface Line {
  /** Stable id, used to keep a once-line from repeating. */
  readonly id: string;
  /** Node the line belongs to. */
  readonly node: string;
  readonly trigger: Trigger;
  readonly voice: 'her' | 'world';
  /** World voice only: characters first, English beneath. */
  readonly zh?: string;
  readonly en: string;
  /** A once-line never plays twice in a night. */
  readonly once?: boolean;
  /** Where the line sits, as a fraction of screen height. Authored
   *  per line so text always lands on a quiet part of the painting;
   *  default is the lower flagstones (0.78). */
  readonly at?: number;
}

export const LINES: readonly Line[] = [
  // 摸釘, the cruelest object in the game (DECISIONS 70). Two lines in
  // sequence off one touch. She already has a son. He is why she is
  // dead. Ratified: sincere.
  {
    id: 'mo-ding-1',
    node: 'gate',
    trigger: 'touch',
    voice: 'her',
    en: 'The nail-heads first. Then the walk. Do it properly and it counts.',
    once: true,
  },
  {
    id: 'mo-ding-2',
    node: 'gate',
    trigger: 'touch',
    voice: 'her',
    en: '釘 for 丁. A son. Everyone asks for a son.',
    once: true,
  },

  // The fires, taught only by her counting habit (DECISIONS 66/67).
  // The only fires text in the game; plays only while all three burn,
  // so if the first look comes late it never plays at all.
  {
    id: 'count-three',
    node: 'water',
    trigger: 'flames',
    voice: 'her',
    en: "Three. Good. Steady the whole way, that's the trick of it.",
    once: true,
    // Up in the mist - the lower half of this painting is black water.
    at: 0.2,
  },

  // ENDING-SITE plants 1 and 2: the house, the lamp, the mundane
  // reason. Ratified: "ours", said once, never again.
  {
    id: 'ours-lamp',
    node: 'house-lamp',
    trigger: 'enter',
    voice: 'her',
    en: "Lamp's burning at ours. Wasteful. I'll be back before it matters.",
    once: true,
  },

  // ENDING-SITE plant 4: the neighbour's wall, warm, no music cue.
  {
    id: 'zhous-print',
    node: 'neighbours-wall',
    trigger: 'enter',
    voice: 'her',
    en: "The Zhous' new-year print. A fat boy and a carp. Theirs came in autumn - a girl, but healthy.",
    once: true,
  },
];

/** Lines due for a node and trigger, in declared order, skipping
 *  once-lines already seen. */
export function linesFor(
  node: string,
  trigger: Trigger,
  seen: ReadonlySet<string>,
): Line[] {
  return LINES.filter(
    (l) => l.node === node && l.trigger === trigger && !(l.once && seen.has(l.id)),
  );
}

/** How long a line holds on screen: reading pace plus a breath. */
export function holdMs(line: Line): number {
  return 2600 + line.en.length * 42;
}
