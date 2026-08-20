import {
  TOWN, BANK_LENGTH, REACH, BRIDGE_SPAN, beginAt, clampToStrip, cross,
  linkInReach, linksOn, otherEnd, strip, bridgesRemaining, riteComplete,
  payForDoublingBack, bridgesOn, bridgesCrossed, walkTo,
} from './src/engine/town';

let n = 0;
function ok(c: boolean, m: string) { n++; if (!c) throw new Error(`FAIL: ${m}`); }

// The district has ends. This is the whole point of the change - a
// strip you can walk off forever is a treadmill, not a place.
ok(clampToStrip('north', -500) === 0, 'she cannot walk off the left end');
ok(clampToStrip('north', BANK_LENGTH + 5000) === BANK_LENGTH, 'nor off the right');
ok(clampToStrip('north', 1234) === 1234, 'and moves freely in between');

// LANES are the only branching (DECISIONS 105).
ok(TOWN.links.length >= 1, 'there is somewhere to turn off to');
const lm = TOWN.links[0];
ok(linksOn('north').length === 1, 'the bank has a lane mouth on it');
ok(linkInReach('north', lm.a.x)?.id === lm.id, 'and she can reach it');
ok(linkInReach('north', lm.a.x + REACH + 80) === null, 'but not from far off');
ok(strip('lane-a').kind === 'lane', 'the lane is a lane');
ok(strip('lane-a').length < BANK_LENGTH, 'and is much shorter than a bank');
ok(strip('lane-a').plates.mid === '',
   'a lane has no mid plane - wall and kerb and nothing between');
ok(strip('north').plates.far !== strip('south').plates.far,
   'the two banks no longer look identical');

// BRIDGES are landmarks ON a strip, not ways off it.
ok(TOWN.bridges.length >= 2, 'the north bank has bridges standing on it');
ok(TOWN.bridges.every((b) => b.x <= strip(b.strip).length),
   'no bridge stands past the end of its strip');
ok(bridgesOn('north').length === TOWN.bridges.length, 'all on the north bank');
ok(bridgesOn('nowhere').length === 0, 'and none anywhere else');
ok(BRIDGE_SPAN > 0, 'a bridge is a size in the TOWN, not a fraction of a screen');

// She crosses one by WALKING OVER IT.
const b0 = TOWN.bridges[0];
ok(bridgesCrossed('north', 0, b0.x + 10).some((b) => b.id === b0.id),
   'walking past a bridge crosses it');
ok(bridgesCrossed('north', 0, b0.x - 10).length === 0, 'stopping short does not');
ok(bridgesCrossed('north', b0.x + 10, 0).some((b) => b.id === b0.id),
   'and walking back over it counts as meeting it again');

let p = beginAt('north');
const one = walkTo(p, b0.x + 10);
ok(one.position.crossed.length === 1, 'a fresh bridge counts toward the three');
ok(one.costsAFlame === false, 'and costs nothing');
p = one.position;

// DOUBLING BACK - now literal, because it is done by walking.
const back = walkTo(p, 0);
ok(back.costsAFlame === true, 'walking back over it is doubling back, and costs a flame');
ok(back.position.crossed.length === 1, 'and never counts twice');
ok(back.position.x === 0, 'she is not stopped - she walks, and pays');
ok(payForDoublingBack(3) === 2 && payForDoublingBack(0) === 0, 'one flame, never below zero');

// Both bridges in one sweep.
const sweep = walkTo(beginAt('north'), BANK_LENGTH);
ok(sweep.position.crossed.length === TOWN.bridges.length,
   'one long walk crosses every bridge on the strip');
ok(sweep.costsAFlame === false, 'all fresh, so nothing to pay');

// The rite still wants three DISTINCT bridges.
ok(bridgesRemaining(beginAt('north')) === 3, 'the rite wants three');
ok(!riteComplete(sweep.position), 'two bridges is not three');
ok(riteComplete({ ...p, crossed: ['a', 'b', 'c'] }), 'three distinct completes it');

// Turning into a lane is free and not part of the rite.
const turned = cross(beginAt('north'), lm);
ok(turned.position.strip === 'lane-a', 'a lane leads off the bank');
ok(cross(turned.position, lm).position.strip === 'north', 'and back again');
ok(turned.costsAFlame === false, 'lanes are free');
ok(turned.position.crossed.length === 0, 'and are not part of 走三桥');
ok(otherEnd(lm, 'lane-a').strip === 'north', 'and leads back');
ok(REACH > 0, 'reach is a real distance');

console.log(`test-town: ${n} assertions passed`);
