import {
  newGame, withFlag, hasFlag, recordEnding, releaseAvailable, isCoherent,
} from './src/dbCore';

let n = 0;
function ok(cond: boolean, msg: string) {
  n++;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const s0 = newGame(1000);
ok(s0.ordinal === 1 && s0.fires === 3, 'she begins alive, at 一更一點');
ok(isCoherent(s0), 'a new game is coherent');

const s1 = withFlag(s0, 'bridge.one.crossed');
ok(hasFlag(s1, 'bridge.one.crossed'), 'flags set');
ok(withFlag(s1, 'bridge.one.crossed').flags.length === 1, 'flags do not duplicate');
ok(s0.flags.length === 0, 'state is immutable');

// DECISIONS 82: the release is walk-two only.
ok(!releaseAvailable(s0), 'no release on a fresh save');
const read = withFlag(s0, 'almanac.xuehu.read');
ok(!releaseAvailable(read), 'reading the almanac alone is not enough');
const finished = recordEnding(read, 'waited');
ok(releaseAvailable(finished), 'the release opens on the second walk');
ok(recordEnding(finished, 'waited').endingsSeen.length === 1, 'endings do not duplicate');

ok(!isCoherent({ ...s0, ordinal: 99 }), 'rejects an impossible chapter');
ok(!isCoherent({ ...s0, district: 7 }), 'rejects an impossible district');

console.log(`test-db: ${n} assertions passed`);
