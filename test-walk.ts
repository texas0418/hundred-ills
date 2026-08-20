import {
  beginFirstWatch, step, pointIndex, chapter, currentCall, watchmanCalling,
  reflection, drainAmount, lookBack, setLooking, applyCrossing,
  DEMO_TIME_SCALE,
} from './src/engine/walk';
import { TOWN } from './src/engine/town';

let n = 0;
function ok(c: boolean, m: string) { n++; if (!c) throw new Error(`FAIL: ${m}`); }

const s0 = beginFirstWatch();
ok(s0.x === 0 && s0.fires === 3, 'she begins at the start, alive');
ok(pointIndex(s0) === 1, 'the night opens at 一更一點');
ok(currentCall(s0).label === '一更一點', "the call names the point in the game's own numerals");
ok(currentCall(s0).slow === 1 && currentCall(s0).quick === 1, 'one slow, one quick');

// Walking
const walked = step(s0, 250, 16);
ok(walked.x === 250, 'she walks');
ok(step(walked, -10000, 16).x === 0, 'she cannot leave the district to the left');

// Leaning over the water is standing still.
const looking = setLooking(walked, true);
ok(step(looking, 500, 16).x === walked.x, 'you cannot count and walk at once');

// The reflection
ok(reflection(walked).visible === false, 'no reflection unless she looks');
ok(reflection(looking).flames === 3, 'three flames at three fires');
const dead = setLooking({ ...s0, fires: 0 }, true);
ok(reflection(dead).visible === false, 'THE THIRD BRIDGE: at zero there is nothing to count');
ok(reflection(dead).flames === 0, 'and no flames to report');

// Looking back costs a flame
ok(lookBack(s0).fires === 2, 'turning to look behind you costs one');
ok(lookBack(lookBack(lookBack(s0))).fires === 0, 'three costs empties her');
ok(lookBack({ ...s0, fires: 0 }).fires === 0, 'cannot go below zero');

// Drain
ok(drainAmount(s0) === 0, 'living world at full colour');
ok(drainAmount({ ...s0, fires: 0 }) === 1, 'dead world fully drained');
ok(Math.abs(drainAmount({ ...s0, fires: 2 }) - 1 / 3) < 1e-9, 'and in between');

// Time advances, and the watch turns over.
const POINT_REAL_MS = (20 * 60 * 1000) / DEMO_TIME_SCALE;
let t = s0;
for (let i = 0; i < 40; i++) t = step(t, 1, POINT_REAL_MS / 40);
ok(pointIndex(t) === 2, 'one demo point of walking reaches 一更二點');
ok(currentCall(t).quick === 2, 'and the call says so');

// The call lands mid-point, so she is walking when she hears it.
let heard = false, atStart = false;
let u = beginFirstWatch();
for (let i = 0; i < 200; i++) {
  u = step(u, 1, POINT_REAL_MS / 100);
  if (watchmanCalling(u)) { heard = true; if (u.elapsedMs < 1000) atStart = true; }
}
ok(heard, 'the watchman calls');
ok(!atStart, 'never at the very start of a point - she is walking when it comes');
ok(!watchmanCalling(s0), 'and not before the night has begun');

ok(chapter(s0).watch === 1, 'the first watch');

// Crossings, as ONE transition rather than three racing setStates.
ok(s0.pos.strip === 'north', 'she starts on the north bank');
ok(applyCrossing(s0, 50) === s0, 'nothing in reach leaves the state untouched');

const at = TOWN.links[0].a.x;
const over = applyCrossing(s0, at);
ok(over.pos.strip === 'south', 'walking onto a bridge crosses it');
ok(over.x === TOWN.links[0].b.x, 'and lands her at the far end of it');
ok(over.fires === 3, 'a fresh bridge costs nothing');
ok(over.pos.crossed.length === 1, 'and counts toward the rite');

const back = applyCrossing(over, TOWN.links[0].b.x);
ok(back.pos.strip === 'north', 'she can always go back - never blocked');
ok(back.fires === 2, 'but doubling back over a spent bridge costs a flame');
ok(back.pos.crossed.length === 1, 'and never counts twice');

console.log(`test-walk: ${n} assertions passed`);
