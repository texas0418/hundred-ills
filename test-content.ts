import { LINES, holdMs, linesFor } from './src/content/lines';
import { NODES } from './src/engine/nodes';

let n = 0;
function ok(c: boolean, m: string) { n++; if (!c) throw new Error(`FAIL: ${m}`); }

// Every line belongs to a real node.
for (const l of LINES) {
  ok(!!NODES[l.node], `${l.id} plays on a real node`);
}

// Ids are unique - the once-tracking depends on it.
ok(new Set(LINES.map((l) => l.id)).size === LINES.length, 'line ids are unique');

// The two voices and no third (OPENING, ratified 2026-08-21):
// her voice is interior English and carries no translation block;
// the world's voice is quotation and must be bilingual.
for (const l of LINES) {
  if (l.voice === 'her') ok(l.zh === undefined, `${l.id}: her voice has no zh block`);
  if (l.voice === 'world') ok(!!l.zh, `${l.id}: the world speaks characters first`);
}

// Her voice stays terse: a few short sentences, never a paragraph.
for (const l of LINES) {
  if (l.voice !== 'her') continue;
  ok(l.en.length <= 110, `${l.id} stays under 110 characters`);
  const sentences = l.en.split(/[.!?]+\s|[.!?]+$/).filter(Boolean).length;
  ok(sentences <= 3, `${l.id} is at most three short sentences`);
}

// DECISIONS 66 and 41: the game never says health, never says fires,
// and the fiction never speaks UI. These words do not appear in any
// player-facing line, ever.
const BANNED = [
  'health', 'damage', 'lives', 'game over', 'level', 'quest',
  'objective', 'hint', 'tutorial', 'tap', 'swipe', 'button', 'menu',
  'screen', 'save', 'fires', 'flame',
];
// Whole words only: "healthy" spoken of a neighbour's baby is her
// voice; "health" as a system word is the violation.
for (const l of LINES) {
  for (const w of BANNED) {
    ok(!new RegExp(`\\b${w}\\b`, 'i').test(l.en), `${l.id} never says "${w}"`);
  }
}

// Once-lines are skipped once seen; unseen lines come in order.
const gateTouch = linesFor('gate', 'touch', new Set());
ok(gateTouch.length === 2 && gateTouch[0].id === 'mo-ding-1',
  'the studs speak twice, in order');
ok(linesFor('gate', 'touch', new Set(['mo-ding-1', 'mo-ding-2'])).length === 0,
  'the rite counts once');

// Hold times scale with length and stay humane.
for (const l of LINES) {
  ok(holdMs(l) >= 2600 && holdMs(l) <= 8500, `${l.id} holds a readable while`);
}

console.log(`test-content: ${n} assertions passed`);
