import {
  beginFirstWatch, step, pointIndex, chapter, currentCall, watchmanCalling,
  reflection, drainAmount, lookBack, setLooking, applyCrossing, arriveAt,
  applyDepth, applyWarmth, atWater, DEMO_TIME_SCALE, RELIGHT_MS,
} from './src/engine/walk';
import { layoutFor, relightXs, DEFAULT_BAND_H } from './src/engine/town';
import type { WalkState } from './src/engine/walk';

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

// Bridges are crossed by WALKING OVER them, at positions the ART set.
ok(s0.pos.strip === 'north', 'she starts on the north bank');
ok(applyCrossing(s0, 50) === s0, 'no lane in reach leaves the state untouched');

const L = layoutFor('north', DEFAULT_BAND_H)!;
const bx = L.bridgeXs[0];
const past = arriveAt(s0, bx + 20, DEFAULT_BAND_H);
ok(past.pos.crossed.length === 1, 'walking past a bridge crosses it');
ok(past.fires === 3, 'a fresh bridge costs nothing');
const backOver = arriveAt(past, 0, DEFAULT_BAND_H);
ok(backOver.fires === 2, 'walking back over it costs a flame');
ok(backOver.pos.crossed.length === 1, 'and never counts twice');
ok(backOver.x === 0, 'she is never stopped - she walks, and pays');

const whole = arriveAt(s0, L.length, DEFAULT_BAND_H);
ok(whole.pos.crossed.length === 2, 'one sweep crosses both bridges');
ok(whole.fires === 3, 'all fresh, nothing to pay');

const a1 = arriveAt(s0, 100, DEFAULT_BAND_H);
ok(a1.x === 100, 'plain walking updates x');
ok(arriveAt(a1, 100, DEFAULT_BAND_H) === a1, 'standing still is a no-op');

// THE DEPTH VERB (108). One verb: toward the water or away from it.
const down = applyDepth(s0, 'outward');
ok(atWater(down), 'outward from the bank reaches the water');
ok(reflection(down).visible && reflection(down).flames === 3,
   'and the flames are there, all three');
const drowned = { ...down, fires: 0 as const };
ok(!reflection(drowned).visible, 'THE THIRD BRIDGE: at zero, nothing in the water');
ok(!atWater(applyDepth(down, 'inward')), 'inward steps back to the bank');
ok(applyDepth(applyDepth(down, 'outward'), 'outward') === applyDepth(down, 'outward')
   || applyDepth(down, 'outward') === down, 'nothing beyond the water');

// WARMTH (DECISIONS 84). Standing by the lantern relights, slowly.
const rx = relightXs('north', DEFAULT_BAND_H);
ok(rx.length === 1, 'one warmth on the bank - the lantern by bridge A');
const cold: WalkState = { ...arriveAt(s0, rx[0], DEFAULT_BAND_H), fires: 1 };
let w: WalkState = cold;
for (let i = 0; i < RELIGHT_MS / 100 - 1; i++) w = applyWarmth(w, 100, DEFAULT_BAND_H);
ok(w.fires === 1, 'not yet - warming takes real time');
w = applyWarmth(w, 100, DEFAULT_BAND_H);
ok(w.fires === 2, 'a moment by the fire and she is more alive');
ok(w.warmMs === 0, 'and the warmth starts again for the next');
const away = applyWarmth({ ...cold, x: rx[0] + 500, warmMs: 1800 }, 100, DEFAULT_BAND_H);
ok(away.warmMs === 0, 'walking away lets the warmth go');
const full = applyWarmth({ ...cold, fires: 3 as const, warmMs: 900 }, 100, DEFAULT_BAND_H);
ok(full.fires === 3 && full.warmMs === 0, 'three is all there is');

console.log(`test-walk: ${n} assertions passed`);
