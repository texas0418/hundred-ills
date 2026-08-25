import { existsSync } from 'node:fs';
import { LINES, holdMs, linesFor, revealMs } from './src/content/lines';
import {
  FILES, MIX, strikePattern, takeFor,
} from './src/content/soundscape';
import { NODES } from './src/engine/nodes';
import { OVERLAYS, TARGETS, targetAt } from './src/content/targets';
import { CAST, castAt } from './src/content/asks';

let n = 0;
function ok(c: boolean, m: string) { n++; if (!c) throw new Error(`FAIL: ${m}`); }

// Every line belongs to a real node, or to anywhere ('*').
for (const l of LINES) {
  ok(l.node === '*' || !!NODES[l.node], `${l.id} plays on a real node`);
}

// Ids are unique - the once-tracking depends on it.
ok(new Set(LINES.map((l) => l.id)).size === LINES.length, 'line ids are unique');

// Both voices are bilingual, characters first (DECISIONS 35; the
// her-voice English-only clause was amended by Simon after b49).
// 繁體 only - a simplified character would break the period claim.
for (const l of LINES) {
  ok(l.zh.length > 0, `${l.id} speaks characters first`);
  ok(!/[们还点着条钉个国过对讲长张爱见叶写读]/.test(l.zh),
    `${l.id} stays in 繁體`);
}

// Her voice stays terse in both scripts: a few short sentences,
// never a paragraph.
for (const l of LINES) {
  if (l.voice !== 'her') continue;
  ok(l.en.length <= 110, `${l.id} stays under 110 characters`);
  ok(l.zh.length <= 32, `${l.id} stays terse in characters too`);
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
ok(gateTouch.length === 3 && gateTouch[0].id === 'mo-ding-1'
  && gateTouch[2].id === 'the-rules',
  'the studs speak three times, ending on the rules');
ok(linesFor('gate', 'touch', new Set(['mo-ding-1', 'mo-ding-2', 'the-rules'])).length === 0,
  'the rite counts once');

// Hold times scale with length and stay humane, and a line always
// finishes printing well before its hold ends - the walk-hold during
// printing must never last the whole display.
for (const l of LINES) {
  ok(holdMs(l) >= 2600 && holdMs(l) <= 10000, `${l.id} holds a readable while`);
  ok(revealMs(l) < holdMs(l) - 1000, `${l.id} prints, then leaves time to read`);
}

// The soundscape: every declared file exists, every node has a mix,
// every mix belongs to a node.
for (const id of Object.keys(FILES)) {
  ok(existsSync(`assets/audio/${id}.wav`), `${id}.wav exists`);
}
for (const nodeId of Object.keys(NODES)) {
  ok(!!MIX[nodeId], `${nodeId} has an ambience mix`);
}
for (const nodeId of Object.keys(MIX)) {
  ok(!!NODES[nodeId], `mix "${nodeId}" belongs to a real node`);
}
for (const [nodeId, m] of Object.entries(MIX)) {
  ok(m.water >= 0 && m.water <= 1 && m.wind >= 0 && m.wind <= 1,
    `${nodeId} mix stays in range`);
  if (NODES[nodeId].water) ok(m.water === 1, `${nodeId} is loud water`);
}

// The clapper strikes the call: slow strikes, a breath, quick ones,
// in order, spaced like a man and not a metronome burst.
const pat = strikePattern(3, 2);
ok(pat.length === 5, 'three slow and two quick');
ok(pat.filter((s) => s.kind === 'slow').length === 3, 'the watch counted slow');
ok(pat.every((s, i) => i === 0 || s.atMs > pat[i - 1].atMs), 'strikes in order');
ok(pat[3].atMs - pat[2].atMs > 700, 'a breath between the counts');

// Takes rotate and never leave the set.
const seen4 = new Set([0, 1, 2, 3].map((i) => takeFor('clapper-slow', i)));
ok(seen4.size === 4, 'four slow takes rotate');
ok(takeFor('studs', 3) === 'studs-1', 'studs wrap at three');

// Things in the paintings sit on real screens, inside the frame.
for (const o of OVERLAYS) {
  ok(!!NODES[o.node], `overlay ${o.plate} on a real node`);
  ok(o.x > 0 && o.x < 1 && o.y > 0 && o.y <= 1 && o.w > 0 && o.w < 0.6,
    `overlay ${o.plate} inside the painting`);
}
for (const t of TARGETS) {
  ok(!!NODES[t.node], `target ${t.act} on a real node`);
  ok(t.x0 < t.x1 && t.y0 < t.y1 && t.x0 >= 0 && t.x1 <= 1 && t.y0 >= 0 && t.y1 <= 1,
    `target ${t.act} is a sane box`);
}
ok(targetAt('gate', 0.5, 0.45)?.act === 'studs', 'the studs are where the door is');
ok(targetAt('gate', 0.5, 0.9) === undefined, 'the lane is not the studs');

// The casts: every authored screen is real, and the god laughs at
// her own door.
for (const id of Object.keys(CAST)) ok(!!NODES[id], `cast authored for real node ${id}`);
ok(castAt('house-lamp') === 'xiao', 'the god laughs at her own door');
ok(castAt('bank-end') === 'sheng', 'the stone stands on the way itself');
ok(castAt('somewhere-unwritten') === 'xiao', 'the unwritten is the wrong question');

console.log(`test-content: ${n} assertions passed`);
