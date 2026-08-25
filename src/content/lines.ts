/**
 * The lines. docs/OPENING.txt is the authority; every line here was
 * ratified there (2026-08-21) and must survive DECISIONS 65's two
 * readings - an ordinary woman's thought on the first walk, the dead
 * performing being alive on the second.
 *
 * Two voices and no third (OPENING, ratified; presentation AMENDED by
 * Simon after walking b49): BOTH voices are bilingual, characters
 * first, English beneath - the DECISIONS 35 pattern everywhere. What
 * still separates them: the world's voice is quotation; hers is
 * interior, a few short sentences, and never describes what the
 * player can see.
 *
 * Pure module - test-content.ts holds the prose rules.
 */

export type Trigger =
  | 'enter' | 'touch' | 'flames' | 'scripted'
  | 'door-gods' | 'road-money' | 'shrine' | 'stone-refuses'
  | 'cast-sheng' | 'cast-yin' | 'cast-xiao'
  | 'relight' | 'call' | 'stare' | 'drowned'
  | 'crossed-1' | 'crossed-2' | 'stone-not-yet';

export interface Line {
  /** Stable id, used to keep a once-line from repeating. */
  readonly id: string;
  /** Node the line belongs to; '*' means any node. */
  readonly node: string;
  readonly trigger: Trigger;
  readonly voice: 'her' | 'world';
  /** Characters first, English beneath (DECISIONS 35), both voices. */
  readonly zh: string;
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
    zh: '先摸釘，再走路。做得周全才算數。',
    en: 'The nail-heads first. Then the walk. Do it properly and it counts.',
    once: true,
  },
  {
    id: 'mo-ding-2',
    node: 'gate',
    trigger: 'touch',
    voice: 'her',
    zh: '釘就是丁。求個兒子，誰家不求。',
    en: 'A nail for a son. Everyone asks for a son.',
    once: true,
  },

  // The rite, in her own mouth - her grandmother's instructions, the
  // reason she is out. First walk: the rules of the walk. Second walk:
  // the exact rules that keep the dead from being recognised.
  {
    id: 'the-rules',
    node: 'gate',
    trigger: 'touch',
    voice: 'her',
    zh: '三座橋，雞叫前過完。不回頭，不應名。',
    en: "Three bridges before cockcrow. Don't look back, don't answer your name.",
    once: true,
  },

  // She counts her crossings aloud - the rite is deliberate work.
  { id: 'crossed-one', node: '*', trigger: 'crossed-1', voice: 'her', zh: '一座。', en: 'One.', once: true },
  { id: 'crossed-two', node: '*', trigger: 'crossed-2', voice: 'her', zh: '兩座。', en: 'Two.', once: true },

  // The stone, when the walk here is not yet done. Repeatable - a
  // wall that explains itself every time it is touched.
  {
    id: 'stone-not-yet',
    node: 'bank-end',
    trigger: 'stone-not-yet',
    voice: 'her',
    zh: '石敢當不讓。橋還沒走完。',
    en: "It won't let me by. The bridges aren't done.",
  },

  // The slice's horizon: the mouth of the covered bridge, the only
  // one you cannot see through.
  {
    id: 'third-bridge',
    node: 'covered-bridge',
    trigger: 'enter',
    voice: 'her',
    zh: '第三座橋。過了它就回家。',
    en: 'The third bridge. Across it, and home.',
    once: true,
    at: 0.24,
  },

  // The fires, taught only by her counting habit (DECISIONS 66/67).
  // The only fires text in the game; plays only while all three burn,
  // so if the first look comes late it never plays at all.
  {
    id: 'count-three',
    node: 'water',
    trigger: 'flames',
    voice: 'her',
    zh: '三盞，好。一路穩穩的，就靠這個。',
    en: "Three. Good. Steady the whole way, that's the trick of it.",
    once: true,
    // Up in the mist - the lower half of this painting is black water.
    at: 0.2,
  },

  // OPENING beat 5, DECISIONS 89's free beat, ENDING-SITE plant 6: the
  // watchman crosses the mooring on her first visit and greets her by
  // name - the only time tonight a living person speaks to her. The
  // world's voice quotes him; she answers in hers.
  {
    id: 'watchman-greet',
    node: 'mooring',
    trigger: 'scripted',
    voice: 'world',
    zh: '阿秀，走百病去？橋上滑。',
    en: 'Out for the walk, A-Xiu? Bridges are slick.',
    once: true,
    at: 0.56,
  },
  {
    id: 'mind-them',
    node: 'mooring',
    trigger: 'scripted',
    voice: 'her',
    zh: '我會當心的。',
    en: "I'll mind them.",
    once: true,
  },

  // ENDING-SITE plants 1 and 2: the house, the lamp, the mundane
  // reason. Ratified: "ours", said once, never again.
  {
    id: 'ours-lamp',
    node: 'house-lamp',
    trigger: 'enter',
    voice: 'her',
    zh: '我們家的燈還點著，費油。走完就回去。',
    en: "Lamp's burning at ours. Wasteful. I'll be back before it matters.",
    once: true,
  },

  // ENDING-SITE plant 4: the neighbour's wall, warm, no music cue.
  {
    id: 'zhous-print',
    node: 'neighbours-wall',
    trigger: 'enter',
    voice: 'her',
    zh: '周家的年畫，胖娃娃抱鯉魚。秋天添的是個丫頭，好在結實。',
    en: "The Zhous' new-year print. A fat boy and a carp. Theirs came in autumn - a girl, but healthy.",
    once: true,
  },

  // ---- FIRST-WATCH, ratified 2026-08-23 ----------------------------

  // 一更二點: the first ward, met open.
  {
    id: 'door-gods-new',
    node: 'bank-east',
    trigger: 'door-gods',
    voice: 'her',
    zh: '門神還新得很。是好人家。',
    en: 'The door gods are still new. A good household.',
    once: true,
    at: 0.62,
  },
  // The road money at the bank's end: the prohibition, seen, obeyed.
  {
    id: 'road-money',
    node: 'bank-end',
    trigger: 'road-money',
    voice: 'her',
    zh: '買路錢。別碰，不是給活人的。',
    en: "Road money. Leave it - it's not for the living.",
    once: true,
  },
  // 一更四點: the shrine's blocks, borrowed.
  {
    id: 'shrine-borrow',
    node: 'inland-east',
    trigger: 'shrine',
    voice: 'her',
    zh: '借一下，回頭還。',
    en: "Borrowing. I'll bring them back.",
    once: true,
  },
  // The stone refuses her when she reads as less than living: the
  // rule stated as a complaint, exactly true on the second walk.
  {
    id: 'stone-unclean',
    node: 'bank-end',
    trigger: 'stone-refuses',
    voice: 'her',
    zh: '石敢當。說我不乾淨。',
    en: "Stone-dares. It's calling me unclean.",
  },
  // The casts, the world's voice, anywhere.
  { id: 'cast-sheng', node: '*', trigger: 'cast-sheng', voice: 'world', zh: '聖筊', en: 'Yes.' },
  { id: 'cast-yin', node: '*', trigger: 'cast-yin', voice: 'world', zh: '陰筊', en: 'No.' },
  {
    id: 'cast-xiao', node: '*', trigger: 'cast-xiao', voice: 'world',
    zh: '笑筊', en: 'The god is laughing. Ask a better question.',
  },
  // 一更三點: the water reaches for what is living. Her one line about
  // leaning over night water, once.
  {
    id: 'water-stare',
    node: '*',
    trigger: 'stare',
    voice: 'her',
    zh: '夜裡別對著水發呆。',
    en: "Don't stand staring at night water.",
    once: true,
    at: 0.2,
  },
  // At zero fires the drowned looks up at her and says exactly what
  // she is, in the first watch, and it reads as a monster's line.
  {
    id: 'drowned',
    node: 'east-water',
    trigger: 'drowned',
    voice: 'world',
    zh: '你不成。你也是沒了的。',
    en: "You're no use to me. You're gone too.",
    once: true,
    at: 0.22,
  },
  // 一更五點: the first relight, once.
  {
    id: 'warm-stand',
    node: 'lantern',
    trigger: 'relight',
    voice: 'her',
    zh: '暖和。站一會兒。',
    en: 'Warm. Stand a moment.',
    once: true,
  },
  // ENDING-SITE plant 3: the voice, from behind, distant, once, at the
  // watch's edge. Nothing to answer yet. Her false comfort follows.
  { id: 'the-call', node: '*', trigger: 'call', voice: 'world', zh: '阿秀——', en: 'A-Xiu——', once: true, at: 0.3 },
  {
    id: 'no-one-calls',
    node: '*',
    trigger: 'call',
    voice: 'her',
    zh: '走路的時候沒人會叫我。規矩大家都懂。',
    en: 'No one calls me on the walk. Everyone knows the rule.',
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
    (l) => (l.node === node || l.node === '*') && l.trigger === trigger
      && !(l.once && seen.has(l.id)),
  );
}

/** The characters settle one by one, like a brush laying them down. */
export const CHAR_MS = 80;

/** How long a line spends PRINTING: the characters' reveal plus the
 *  English fading in beneath. While a line prints, she does not walk
 *  (Simon, b52) - the player never has a line swept mid-reveal. Once
 *  printed, moving on is the player's choice. */
export function revealMs(line: Line): number {
  return line.zh.length * CHAR_MS + 1120;
}

/** How long a line holds on screen: the characters' reveal, reading
 *  pace for the English, and a breath. */
export function holdMs(line: Line): number {
  return line.zh.length * CHAR_MS + 2600 + line.en.length * 42;
}
