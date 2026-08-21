import {
  NODES, beginNight, move, lookBack, tick, bridgesRemaining,
  drainAmount, call, RELIGHT_MS, node, type TownState,
} from './src/engine/nodes';

let n = 0;
function ok(c: boolean, m: string) { n++; if (!c) throw new Error(`FAIL: ${m}`); }

// The graph is coherent: every exit leads to a real node, and every
// edge is RECIPROCAL - walking through it, the way back is the
// opposite swipe. An edge she cannot walk back the way she came is a
// wiring bug, not a design choice; one-way passages would be their
// own mechanic and there isn't one.
const OPP = { left: 'right', right: 'left', up: 'down', down: 'up' } as const;
for (const t of Object.values(NODES)) {
  for (const [way, to] of Object.entries(t.exits)) {
    ok(!!NODES[to as string], `${t.id} exits to a real node`);
    ok(NODES[to as string]?.exits[OPP[way as keyof typeof OPP]] === t.id,
      `${t.id} -${way}-> ${to} returns by the opposite swipe`);
  }
}
ok(node('bridge').bridge === true, 'the bridge is a bridge');
ok(node('water').water === true, 'the water\'s edge is water');
ok(node('lantern').warm === true, 'the lantern corner is the warm place');
ok(!node('bridge').warm, 'warmth has moved off the bridge');

const s0 = beginNight();
ok(s0.nodeId === 'gate' && s0.fires === 3, 'the night begins at the gate, alive');

// Refusal is not movement. The gate is shut: no forward, no sideways.
const refuse = move(s0, 'up');
ok(!refuse.moved && refuse.state === s0, 'an edge with no exit refuses');
ok(!move(s0, 'right').moved, 'no side lane at the gate - the art has none');

// The walk in: turn from the gate, down the lane's foreground, and
// out onto the mooring. The lane is a corridor - no sideways exits.
const onLane = move(s0, 'down').state;
ok(!move(onLane, 'right').moved && !move(onLane, 'left').moved,
  'the gate lane has no sideways path');
const atMooring = move(onLane, 'down').state;
ok(atMooring.nodeId === 'mooring', 'the gate lane leads down to the mooring');
ok(move(onLane, 'up').state.nodeId === 'gate',
  'the receding lane walks back up to the gate');
ok(move(atMooring, 'up').state.nodeId === 'gatelane',
  'the rising alley at the mooring returns to the lane');

// Down by the water, and back up.
const atWater = move(atMooring, 'down').state;
ok(atWater.nodeId === 'water', 'down from the bank is the water\'s edge');
ok(move(atWater, 'up').state.nodeId === 'mooring', 'and up is back');

// TRAVERSAL spends the bridge: in one side, out the other.
const onBridge = move(atMooring, 'right').state;
ok(onBridge.nodeId === 'bridge' && onBridge.enteredFrom === 'left', 'entered from the left');
const throughUp = move(onBridge, 'up');
ok(throughUp.state.crossed.includes('bridge'), 'leaving the other way is a traversal');
ok(!throughUp.costAFlame, 'the first traversal is free');
ok(bridgesRemaining(throughUp.state) === 2, 'and counts toward the three');

// Backing straight out the way she came is NOT a traversal.
const backOut = move(onBridge, 'left');
ok(backOut.state.crossed.length === 0, 'in and out the same side spends nothing');

// Doubling back over a spent bridge costs a flame.
let s = throughUp.state;            // in the alley, bridge spent
s = move(s, 'down').state;          // back onto the bridge (entered from up)
const again = move(s, 'left');      // out the other side - second traversal
ok(again.costAFlame, 'recrossing a spent bridge costs a flame');
ok(again.state.fires === 2, 'and the flame is gone');
ok(again.state.crossed.length === 1, 'it never counts twice');

// Look back.
ok(lookBack(s0).fires === 2, 'turning to look behind costs one');
ok(lookBack({ ...s0, fires: 0 }).fires === 0, 'never below zero');

// Walking the deck over the arch is also a traversal.
const overToFar = move(onBridge, 'right');
ok(overToFar.state.nodeId === 'farbank', 'over the deck is the far bank');
ok(overToFar.state.crossed.includes('bridge'), 'and the crossing spends the bridge');

// Warmth: the lantern corner relights, in real time, only when short.
let w: TownState = { ...s0, nodeId: 'lantern', fires: 1 };
for (let i = 0; i < RELIGHT_MS / 100 - 1; i++) w = tick(w, 100, 60);
ok(w.fires === 1, 'not yet');
w = tick(w, 100, 60);
ok(w.fires === 2, 'a moment under the lantern and she is more alive');
const cold = tick({ ...s0, nodeId: 'mooring', fires: 1 as const, warmMs: 900 }, 100, 60);
ok(cold.warmMs === 0, 'no lantern here - the warmth goes');

// The night still runs on the watches.
ok(call(s0).label === '一更一點', 'the night opens at 一更一點');
ok(drainAmount({ ...s0, fires: 0 }) === 1, 'zero fires is a fully drained world');

// Moving resets warmth.
ok(move({ ...onBridge, warmMs: 1500 }, 'left').state.warmMs === 0, 'walking away resets warmth');

console.log(`test-nodes: ${n} assertions passed`);
