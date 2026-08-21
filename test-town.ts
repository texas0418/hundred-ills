import {
  TOWN, REACH, beginAt, clampToStrip, cross, linkInReach, linksOn,
  otherEnd, strip, bridgesRemaining, riteComplete, payForDoublingBack,
  bridgesCrossed, walkTo, layoutFor, stepDepth, DEFAULT_BAND_H,
} from './src/engine/town';
import { NORTH_WALKWAY, bridgesPassed } from './src/engine/walkway';

let n = 0;
function ok(c: boolean, m: string) { n++; if (!c) throw new Error(`FAIL: ${m}`); }

// LAYOUT: the walkway is authored segments, band-aligned (107).
const L = layoutFor('north', DEFAULT_BAND_H)!;
ok(L.plates.length === NORTH_WALKWAY.length, 'every plate is placed');
ok(L.bridgeXs.length === 2, 'two bridges stand in the north walkway');
for (let i = 1; i < L.plates.length; i++) {
  const prev = L.plates[i - 1];
  ok(Math.abs(L.plates[i].x - (prev.x + prev.width)) < 1e-9, 'plates are flush');
}
for (const p of L.plates) {
  const bandPx = (p.bandBot - p.bandTop) * p.drawH;
  ok(Math.abs(bandPx - DEFAULT_BAND_H) < 1e-6,
     `${p.plate} band lands exactly on the walkway band`);
}
ok(L.length === L.plates.reduce((a2, p) => a2 + p.width, 0), 'length is the sum');
const L2 = layoutFor('north', DEFAULT_BAND_H * 2)!;
ok(Math.abs(L2.length - L.length * 2) < 1e-6, 'layout scales with the band');

// The district has ends, from the layout now.
ok(clampToStrip('north', -500, DEFAULT_BAND_H) === 0, 'no walking off the left');
ok(clampToStrip('north', L.length + 99, DEFAULT_BAND_H) === L.length, 'nor the right');

// Bridges are crossed by WALKING OVER them - positions from the ART.
const bx = L.bridgeXs[0];
ok(bridgesCrossed('north', 0, bx + 5, DEFAULT_BAND_H).length === 1, 'walking past crosses');
ok(bridgesCrossed('north', 0, bx - 5, DEFAULT_BAND_H).length === 0, 'stopping short does not');
ok(bridgesPassed(L, bx + 5, 0).length === 1, 'and walking back meets it again');

let p = beginAt('north');
const one = walkTo(p, bx + 5, DEFAULT_BAND_H);
ok(one.position.crossed.length === 1, 'a fresh bridge counts');
ok(one.costsAFlame === false, 'and costs nothing');
const back = walkTo(one.position, 0, DEFAULT_BAND_H);
ok(back.costsAFlame === true, 'doubling back costs a flame');
ok(back.position.crossed.length === 1, 'and never counts twice');
ok(payForDoublingBack(3) === 2 && payForDoublingBack(0) === 0, 'one flame, floor zero');

const sweep = walkTo(beginAt('north'), L.length, DEFAULT_BAND_H);
ok(sweep.position.crossed.length === 2, 'one sweep crosses both');
ok(!riteComplete(sweep.position), 'two is not three');
ok(bridgesRemaining(beginAt('north')) === 3, 'the rite wants three');
ok(riteComplete({ ...p, crossed: ['a', 'b', 'c'] }), 'three distinct completes it');

// LANES: the only inland branching. The mouth is a two-way door.
const lm = TOWN.links[0];
ok(linksOn('north').length === 1, 'the bank has a mouth');
ok(linkInReach('north', lm.a.x)?.id === lm.id, 'reachable at the mouth');
ok(linkInReach('north', lm.a.x + REACH + 80) === null, 'not from far off');
const turned = cross(beginAt('north'), lm);
ok(turned.position.strip === 'lane-a', 'a lane leads off the bank');
ok(turned.costsAFlame === false, 'lanes are free');
ok(otherEnd(lm, 'lane-a').strip === 'north', 'and lead back');
ok(strip('lane-a').kind === 'lane', 'the lane is a lane');

// DEPTH (108): toward the water and back. Lane has NO depth exit -
// an alley leaves at its mouth or not at all.
const atBank = beginAt('north');
const toWater = stepDepth(atBank, 'outward');
ok(toWater?.strip === 'water-north', 'outward from the bank reaches the water');
ok(stepDepth(toWater!, 'inward')?.strip === 'north', 'and inward returns');
ok(stepDepth(toWater!, 'outward') === null, 'nothing beyond the water');
ok(stepDepth({ ...atBank, strip: 'lane-a' }, 'outward') === null,
   'a lane exits at its mouth, never by depth map');
ok(strip('water-north').kind === 'water', 'the water strip is water');
ok(strip('water-north').plates.kerb === 'night-water', 'and the flames land on night water');

console.log(`test-town: ${n} assertions passed`);
