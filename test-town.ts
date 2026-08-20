import {
  TOWN, BANK_LENGTH, REACH, beginAt, clampToStrip, cross, linkInReach,
  linksOn, otherEnd, strip, bridgesRemaining, riteComplete,
  payForDoublingBack,
} from './src/engine/town';

let n = 0;
function ok(c: boolean, m: string) { n++; if (!c) throw new Error(`FAIL: ${m}`); }

// The district has ends. This is the whole point of the change - a
// strip you can walk off forever is a treadmill, not a place.
ok(clampToStrip('north', -500) === 0, 'she cannot walk off the left end');
ok(clampToStrip('north', BANK_LENGTH + 5000) === BANK_LENGTH, 'nor off the right');
ok(clampToStrip('north', 1234) === 1234, 'and moves freely in between');

// Every link is reachable from both of its ends.
for (const l of TOWN.links) {
  ok(linkInReach(l.a.strip, l.a.x)?.id === l.id, `${l.id} reachable from a`);
  ok(linkInReach(l.b.strip, l.b.x)?.id === l.id, `${l.id} reachable from b`);
  ok(otherEnd(l, l.a.strip).strip === l.b.strip, `${l.id} leads across`);
  ok(otherEnd(l, l.b.strip).strip === l.a.strip, `${l.id} leads back`);
}
ok(linkInReach('north', 900 + REACH - 1)?.id === 'bridge-a', 'in reach just inside');
ok(linkInReach('north', 900 + REACH + 60) === null, 'and out of reach beyond');
ok(linksOn('north').length === 2, 'both bridges touch the north bank');

// Strips are bounded and known.
ok(strip('north').length === BANK_LENGTH, 'strips know their length');
ok(TOWN.strips.every((s) => s.length > 0), 'no zero-length strips');
ok(TOWN.links.every((l) => l.a.x <= strip(l.a.strip).length
  && l.b.x <= strip(l.b.strip).length), 'no link sits past the end of its strip');

// 走三桥. The town is open; the rite through it is not.
let p = beginAt('north');
ok(bridgesRemaining(p) === 3 && !riteComplete(p), 'the rite wants three');

const first = cross(p, TOWN.links[0]);
ok(first.position.strip === 'south', 'crossing puts her on the far bank');
ok(first.costsAFlame === false, 'a fresh bridge costs nothing');
ok(bridgesRemaining(first.position) === 2, 'and counts toward the three');
p = first.position;

const second = cross(p, TOWN.links[1]);
ok(second.position.strip === 'north', 'the second bridge leads back across');
ok(second.costsAFlame === false, 'still fresh');
ok(second.position.crossed.length === 2, 'two spent');
p = second.position;

// DOUBLING BACK. Recrossing a spent bridge is turning back, and turning
// back costs a flame - never a locked gate.
const again = cross(p, TOWN.links[0]);
ok(again.costsAFlame === true, 'recrossing a spent bridge costs a flame');
ok(again.position.crossed.length === 2, 'and does not count again');
ok(again.position.strip === 'south', 'but she is NOT blocked - she still crosses');
ok(payForDoublingBack(3) === 2, 'the price is one flame');
ok(payForDoublingBack(0) === 0, 'and cannot go below zero');

// The rite completes on three DISTINCT bridges.
ok(!riteComplete(p), 'two is not three');
const three = { ...p, crossed: ['bridge-a', 'bridge-b', 'bridge-c'] };
ok(riteComplete(three) && bridgesRemaining(three) === 0, 'three distinct completes it');
const dupes = { ...p, crossed: ['bridge-a', 'bridge-b'] };
ok(!riteComplete(dupes), 'recrossings never accumulate toward it');

console.log(`test-town: ${n} assertions passed`);
