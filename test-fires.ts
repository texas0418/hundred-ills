import { MAX_FIRES, readingOf, snuff, relight, spiritLayerOpen, hasReflection } from './src/engine/fires';

let n = 0;
function ok(cond: boolean, msg: string) {
  n++;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

ok(readingOf(3) === 'living', 'three fires reads living');
ok(readingOf(0) === 'dead', 'zero fires reads dead');
ok(readingOf(1) === 'ambiguous', 'one fire is the useless middle');
ok(readingOf(2) === 'ambiguous', 'two fires is the useless middle');

ok(snuff(3, 'look_back').fires === 2, 'looking back costs a fire');
ok(snuff(1, 'answer_name').fires === 0, 'answering your name costs the last one');
ok(snuff(0, 'shoulder_tap').changed === false, 'cannot go below zero');

ok(relight(0, 'hearth').fires === 1, 'a hearth relights one');
ok(relight(2, 'living_body').fires === 3, 'standing near the living relights one');
ok(relight(3, 'lamp').changed === false, 'cannot exceed three');

ok(spiritLayerOpen(0), 'the dead see the dead');
ok(!spiritLayerOpen(3), 'the living do not');
ok(!spiritLayerOpen(2), 'the middle sees nothing - this squeeze is deliberate');

ok(hasReflection(1), 'a flame casts a reflection');
ok(!hasReflection(0), 'THE THIRD BRIDGE: at zero there is nothing to count');

ok(MAX_FIRES === 3, 'three, always three');

console.log(`test-fires: ${n} assertions passed`);
