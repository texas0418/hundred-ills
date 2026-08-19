import { passWard } from './src/engine/wards';

let n = 0;
function ok(cond: boolean, msg: string) {
  n++;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// ---------------------------------------------------------------
// REGRESSION LOCK. An early draft of docs/LENGTH.txt had this
// backwards, claiming zero fires OPENED warded houses. Wards are
// installed against the dead. If these four fail, the inversion is
// back and the whole finale is broken.
// ---------------------------------------------------------------
ok(passWard('intact', 3).canPass, 'INVERSION LOCK: alive passes an intact ward');
ok(!passWard('intact', 0).canPass, 'INVERSION LOCK: the dead do not');
ok(passWard('intact', 0).reason === 'ward_refuses_the_dead', 'and for that reason');
ok(!passWard('intact', 2).canPass, 'INVERSION LOCK: the middle passes nothing');

ok(passWard('faded', 0).canPass, 'lapsed protection lets her in');
ok(passWard('torn', 0).canPass, 'so does torn');
ok(passWard('faded', 0).reason === 'ward_lapsed', 'the houses are not neglected, the wards lapsed');

// ---------------------------------------------------------------
// THE DOOR. Her own house, gods pasted eleven days ago.
// Three fires is a costume, not a key.
// ---------------------------------------------------------------
ok(!passWard('new', 3).canPass, 'THE WARDS HOLD, even at three fires');
ok(passWard('new', 3).reason === 'new_ward_refuses_all', 'nothing about her passes it');
ok(!passWard('new', 0).canPass, 'and certainly not at zero');

// 叫魂 - the last input in the game.
ok(passWard('new', 3, true).canPass, 'she is called past her own protection');
ok(passWard('new', 0, true).canPass, 'invitation does not care what she is');
ok(passWard('new', 3, true).reason === 'called_past', 'nothing failed. she was welcomed.');

console.log(`test-wards: ${n} assertions passed`);
