import {
  TOTAL_POINTS, WATCH_NAMES, ordinalOf, chapterAt, label, strikeFor,
  minutesFor, totalMinutes, LAST_CALL, watchmanCallsAt, savesAt,
  showsWatchCard, isValid,
} from './src/engine/watches';

let n = 0;
function ok(cond: boolean, msg: string) {
  n++;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

ok(TOTAL_POINTS === 25, 'TWENTY-FIVE chapters, not five');
ok(WATCH_NAMES.length === 5, 'five watches');

ok(ordinalOf({ watch: 1, point: 1 }) === 1, 'first chapter');
ok(ordinalOf({ watch: 3, point: 2 }) === 12, 'third watch second point');
ok(ordinalOf({ watch: 5, point: 5 }) === 25, 'last chapter');

for (let i = 1; i <= TOTAL_POINTS; i++) {
  ok(ordinalOf(chapterAt(i)) === i, `ordinal round-trips at ${i}`);
}
ok(!isValid(0) && !isValid(26), 'bounds hold');

ok(label({ watch: 3, point: 2 }) === '三更二點', 'the call is 三更二點');
ok(label({ watch: 5, point: 3 }) === '五更三點', 'the last call');

ok(strikeFor({ watch: 3, point: 2 }).slow === 3, 'three slow strikes for the watch');
ok(strikeFor({ watch: 3, point: 2 }).quick === 2, 'two quick for the point');

// DECISIONS 88: not uniform, and the whole night lands in the 6-8h target.
const mins = totalMinutes();
ok(mins >= 360 && mins <= 480, `night is 6-8 hours, got ${Math.round(mins / 6) / 10}h`);
ok(minutesFor(1) !== minutesFor(19), 'points are NOT uniform');

// The watchman goes silent for the door.
ok(LAST_CALL === 23, 'last call is 五更三點');
ok(watchmanCallsAt(23), 'he calls at 五更三點');
ok(!watchmanCallsAt(24), 'and never again');
ok(!watchmanCallsAt(25), 'the silence is the loudest thing in the game');
ok(!savesAt(25), 'autosave rides the strike, so it stops when he does');

ok(showsWatchCard({ watch: 2, point: 1 }), 'a card at each act break');
ok(!showsWatchCard({ watch: 2, point: 3 }), 'and nowhere else');
let cards = 0;
for (let i = 1; i <= TOTAL_POINTS; i++) if (showsWatchCard(chapterAt(i))) cards++;
ok(cards === 5, 'five cards in eight hours');

console.log(`test-watches: ${n} assertions passed`);
