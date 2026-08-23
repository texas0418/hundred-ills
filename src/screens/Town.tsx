import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { SOOT, XUAN } from '../palette';
import {
  beginNight,
  call as watchCall,
  drainAmount,
  lookBack,
  loseFire,
  move as moveNode,
  node as nodeOf,
  pointIndex,
  relight,
  takeBlocks,
  tick as tickNight,
  watchmanCalling,
  type TownState,
  type Way,
} from '../engine/nodes';
import { targetAt, type Act } from '../content/targets';
import { castAt } from '../content/asks';
import { holdMs, linesFor, revealMs, type Line, type Trigger } from '../content/lines';
import { useSoundscape } from './useSoundscape';
import { LineView } from './LineView';
import {
  DEMO_TIME_SCALE, EXITS, FORK, IDX, LEAN, PHASE_MS, SCREENS, TownCanvas, WAYS, paintGeo,
} from './TownCanvas';

/** The watchman crossing the mooring (OPENING beat 5, DECISIONS 89),
 *  once: he comes in from the right, his clapper sounds twice, he
 *  greets her by name mid-way, and at the foot of the alley steps he
 *  goes up the way she came. A living body passing close warms her
 *  if she is short (84). If she has walked off before he speaks, he
 *  keeps the greeting for her next pass - he is out all night. */
function useWatchman({
  stateRef, setState, speak, soundscape,
}: {
  stateRef: React.MutableRefObject<TownState>;
  setState: React.Dispatch<React.SetStateAction<TownState>>;
  speak: (node: string, trigger: Trigger) => void;
  soundscape: { clap(): void };
}) {
  const walk = useSharedValue(0);
  const met = useRef(false);
  const arrive = useCallback((id: string) => {
    if (id !== 'mooring' || met.current) return;
    met.current = true;
    // eslint-disable-next-line react-hooks/immutability
    walk.value = 0;
    walk.value = withTiming(1, { duration: 7600, easing: Easing.linear });
    setTimeout(() => soundscape.clap(), 900);
    setTimeout(() => soundscape.clap(), 1700);
    setTimeout(() => {
      if (stateRef.current.nodeId === 'mooring' && stateRef.current.fires < 3) {
        Haptics.selectionAsync().catch(() => {});
        setState(relight);
      }
    }, 3600);
    setTimeout(() => {
      if (stateRef.current.nodeId === 'mooring') speak('mooring', 'scripted');
      else { met.current = false; walk.value = 0; }
    }, 2800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, soundscape]);
  return { walk, arrive };
}

/** The water (FIRST-WATCH 一更三點): living, lean too long and the
 *  water reaches - the shoulder tap, a flame out; dead, at the east
 *  water, the drowned rises, speaks, sinks. Owns its timers; a move
 *  stops everything. */
function useWater({
  stateRef, setState, speak,
}: {
  stateRef: React.MutableRefObject<TownState>;
  setState: React.Dispatch<React.SetStateAction<TownState>>;
  speak: (node: string, trigger: Trigger) => void;
}) {
  const drown = useSharedValue(0);
  const leanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drownedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stop = useCallback(() => {
    if (leanTimer.current) { clearTimeout(leanTimer.current); leanTimer.current = null; }
    for (const t of drownedTimers.current) clearTimeout(t);
    drownedTimers.current = [];
    // eslint-disable-next-line react-hooks/immutability
    drown.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arrive = useCallback((id: string) => {
    if (!nodeOf(id).water) return;
    if (stateRef.current.fires === 3) {
      leanTimer.current = setTimeout(() => {
        leanTimer.current = null;
        const st = stateRef.current;
        if (st.nodeId === id && st.fires === 3) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          setState(loseFire);
          speak(id, 'stare');
        }
      }, 8000);
    }
    if (id === 'east-water' && stateRef.current.fires === 0) {
      // eslint-disable-next-line react-hooks/immutability
      drown.value = 0;
      drown.value = withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) });
      drownedTimers.current.push(setTimeout(() => {
        if (stateRef.current.nodeId === 'east-water') speak('east-water', 'drowned');
      }, 2200));
      drownedTimers.current.push(setTimeout(() => {
        drown.value = withTiming(0, { duration: 1600 });
      }, 6800));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  return { drown, arrive, stop };
}

/** Which way a drag is going, once it is clearly going somewhere.
 *  THE FINGER'S DIRECTION IS HER DIRECTION on both axes (Simon, b57):
 *  swipe left, she goes left; swipe up, she goes deeper. Nothing
 *  slides under the finger any more, so the scrolling convention
 *  (drag the world left to go right) had nothing left to justify it. */
function wayFrom(tx: number, ty: number): number {
  'worklet';
  const ax = Math.abs(tx);
  const ay = Math.abs(ty);
  if (Math.max(ax, ay) < 14) return -1;
  if (ay > ax * 1.2) return ty < 0 ? 2 : 3;
  if (ax > ay * 1.2) return tx < 0 ? 0 : 1;
  return -1;
}

/** How far the finger has travelled ALONG the chosen way. */
function alongWay(w: number, tx: number, ty: number): number {
  'worklet';
  if (w === 0) return -tx;
  if (w === 1) return tx;
  if (w === 2) return -ty;
  return ty;
}

/** A flick along the way commits even from a short drag. */
function flungAlong(w: number, vx: number, vy: number): boolean {
  'worklet';
  return (w === 0 && vx < -600) || (w === 1 && vx > 600)
    || (w === 2 && vy < -600) || (w === 3 && vy > 600);
}

/** Her voice: one line at a time, queued, once-lines kept for the
 *  night. The content lives in src/content/lines.ts; this is only the
 *  throat. holdUntilSV is the gesture's gate - while a line prints,
 *  she does not walk. */
function useHerVoice() {
  const holdUntilSV = useSharedValue(0);
  const [line, setLine] = useState<Line | null>(null);
  const seen = useRef(new Set<string>());
  const lineQueue = useRef<Line[]>([]);
  const speaking = useRef(false);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNext = useCallback(function show() {
    const next = lineQueue.current.shift() ?? null;
    setLine(next);
    if (next) {
      // A once-line counts as heard when it is SHOWN, not when it is
      // queued - a line swept away by a move can still play later.
      if (next.once) seen.current.add(next.id);
      // While the line prints, she does not walk (Simon, b52).
      holdUntilSV.value = Date.now() + revealMs(next);
      lineTimer.current = setTimeout(show, holdMs(next));
    } else {
      speaking.current = false;
    }
  }, []);

  const speak = useCallback(
    (nodeId: string, trigger: Trigger) => {
      const pending = new Set(lineQueue.current.map((l) => l.id));
      const due = linesFor(nodeId, trigger, seen.current).filter(
        (l) => !pending.has(l.id),
      );
      if (!due.length) return;
      lineQueue.current.push(...due);
      if (!speaking.current) {
        speaking.current = true;
        showNext();
      }
    },
    [showNext],
  );

  // Her thoughts belong to the place she is standing. Moving sweeps
  // the current line and everything queued - the wall's line must
  // never play over the house (Simon, b51).
  const hushOnMove = useCallback(() => {
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineQueue.current = [];
    speaking.current = false;
    holdUntilSV.value = 0;
    setLine(null);
  }, []);

  useEffect(
    () => () => {
      if (lineTimer.current) clearTimeout(lineTimer.current);
    },
    [],
  );

  return { line, speak, hush: hushOnMove, holdUntilSV };
}

/** LOOK BACK as a HOLD (FIRST-WATCH question 1, ratified): she stops
 *  and turns; the screen she came from shows DRAINED behind her for
 *  the length of the turn - the dead town is what you see when you
 *  look behind you - and a flame is out. Let go early and she only
 *  began to turn: no cost. */
function useGlance({
  busySV, refuse, stateRef, setState,
}: {
  busySV: SharedValue<number>;
  refuse: () => void;
  stateRef: React.MutableRefObject<TownState>;
  setState: React.Dispatch<React.SetStateAction<TownState>>;
}) {
  const glance = useSharedValue(0);
  const [glanceSrc, setGlanceSrc] = useState<number | null>(null);
  const glanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const glanceStart = useCallback(() => {
    const st = stateRef.current;
    if (busySV.value || !st.prevNodeId || st.fires === 0) { refuse(); return; }
    setGlanceSrc(SCREENS[IDX[st.prevNodeId]].dead);
    // eslint-disable-next-line react-hooks/immutability
    glance.value = withTiming(0.9, { duration: 380 });
    glanceTimer.current = setTimeout(() => {
      glanceTimer.current = null;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setState(lookBack);
      glance.value = withTiming(0, { duration: 420 }, (done) => {
        'worklet';
        if (done) runOnJS(setGlanceSrc)(null);
      });
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refuse]);

  const glanceEnd = useCallback(() => {
    if (glanceTimer.current) {
      clearTimeout(glanceTimer.current);
      glanceTimer.current = null;
      // eslint-disable-next-line react-hooks/immutability
      glance.value = withTiming(0, { duration: 220 }, (done) => {
        'worklet';
        if (done) runOnJS(setGlanceSrc)(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { glance, glanceSrc, glanceStart, glanceEnd };
}

/** What her hands do to the things in the paintings (FIRST-WATCH):
 *  the touchable things, and the blocks thrown at her feet. */
function useActs({
  speak, soundscape, setState, stateRef, castShow, setCast,
}: {
  speak: (node: string, trigger: Trigger) => void;
  soundscape: { touch(): void; clatter(): void };
  setState: React.Dispatch<React.SetStateAction<TownState>>;
  stateRef: React.MutableRefObject<TownState>;
  castShow: SharedValue<number>;
  setCast: (c: { idx: number } | null) => void;
}) {
  /** 擲筊: the blocks clatter and land at her feet; the world names
   *  the cast. The question is always "this way?" of where she stands.
   *  (castShow is a shared value, mutable by Reanimated's contract.) */
  // eslint-disable-next-line react-hooks/immutability
  const throwBlocks = useCallback(() => {
    const id = stateRef.current.nodeId;
    soundscape.clatter();
    setCast({ idx: IDX[id] });
    // eslint-disable-next-line react-hooks/immutability
    castShow.value = 0;
    // eslint-disable-next-line react-hooks/immutability
    castShow.value = withTiming(1, { duration: 180 });
    setTimeout(() => {
      castShow.value = withTiming(0, { duration: 500 });
    }, 3200);
    setTimeout(() => speak(id, `cast-${castAt(id)}`), 420);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak, soundscape]);

  /** What touching a thing in the painting does. */
  const actOn = useCallback(
    (act: Act, st: TownState) => {
      Haptics.selectionAsync().catch(() => {});
      if (act === 'studs') { soundscape.touch(); speak('gate', 'touch'); }
      else if (act === 'door-gods') speak('bank-east', 'door-gods');
      else if (act === 'road-money') speak('bank-end', 'road-money');
      else if (act === 'shrine') {
        if (!st.blocks) { setState(takeBlocks); speak('inland-east', 'shrine'); }
      } else if (act === 'stone' && st.fires < 3) {
        // The lock on district two: a stone to the living, a refusal to
        // the rest. The lane beyond arrives with district two.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        speak('bank-end', 'stone-refuses');
      }
    },
    [speak, soundscape],
  );

  return { actOn, throwBlocks };
}

export function Town() {
  const { width, height } = useWindowDimensions();
  const curIdx = useSharedValue(0);
  const fromIdx = useSharedValue(-1);
  const prog = useSharedValue(1);
  const dir = useSharedValue(1);
  const axis = useSharedValue(0);
  // Gates the gesture worklet reads directly: a phase in flight, and a
  // line still printing (DECISIONS: she does not walk mid-sentence).
  const WIDTH_SV = useSharedValue(width);
  const HEIGHT_SV = useSharedValue(height);
  useEffect(() => {
    WIDTH_SV.value = width;
    HEIGHT_SV.value = height;
  }, [width, height, WIDTH_SV, HEIGHT_SV]);
  const busySV = useSharedValue(0);
  const previewWay = useSharedValue(-1);
  const castShow = useSharedValue(0);
  const [cast, setCast] = useState<{ idx: number } | null>(null);
  const firesSV = useSharedValue(3);
  const shiver = useSharedValue(0);
  useEffect(() => {
    shiver.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.linear }), -1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const calledOnce = useRef(false);
  const prevFires = useRef(3);
  const [state, setState] = useState<TownState>(() => beginNight('gate'));
  const soundscape = useSoundscape(state);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // The night runs whether or not she moves.
  useEffect(() => {
    const id = setInterval(
      () => setState((s) => tickNight(s, 100, DEMO_TIME_SCALE)),
      100,
    );
    return () => clearInterval(id);
  }, []);

  const { line, speak, hush: hushOnMove, holdUntilSV } = useHerVoice();
  const water = useWater({ stateRef, setState, speak });
  const drown = water.drown;
  const watchman = useWatchman({ stateRef, setState, speak, soundscape });
  const walk = watchman.walk;

  const settle = useCallback(() => {
    busySV.value = 0;
    const id = stateRef.current.nodeId;
    speak(id, 'enter');
    if (nodeOf(id).water && stateRef.current.fires === 3) speak(id, 'flames');
    water.arrive(id);
    watchman.arrive(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  const refuse = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  /** The engine side of a move: the rite, the haptics, the state.
   *  Visual choreography is the caller's (the drag, or move()). */
  const commit = useCallback(
    (way: Way): boolean => {
      const m = moveNode(stateRef.current, way);
      if (!m.moved) return false;
      hushOnMove();
      water.stop();
      if (m.costAFlame) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      } else {
        Haptics.selectionAsync().catch(() => {});
      }
      setState(m.state);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hushOnMove, water],
  );

  /** A move not driven by a drag - a fork chosen by touch. Forks are
   *  two ways AHEAD, so the phase is always the dolly inward. */
  const move = useCallback(
    (way: Way, visual: { axis: 0 | 1; dir: 1 | -1 }) => {
      if (busySV.value) return;
      if (Date.now() < holdUntilSV.value) { refuse(); return; }
      const from = curIdx.value;
      const dest = EXITS[from][WAYS.indexOf(way)];
      if (dest < 0) { refuse(); return; }
      // Shared values are mutable by Reanimated's contract; the React
      // Compiler rule cannot see that.
      // eslint-disable-next-line react-hooks/immutability
      busySV.value = 1;
      if (!commit(way)) { busySV.value = 0; return; }
      fromIdx.value = from;
      curIdx.value = dest;
      axis.value = visual.axis;
      dir.value = visual.dir;
      prog.value = 0;
      prog.value = withTiming(
        1,
        { duration: PHASE_MS, easing: Easing.inOut(Easing.cubic) },
        (done) => {
          'worklet';
          if (done) {
            fromIdx.value = -1;
            runOnJS(settle)();
          }
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, refuse, settle],
  );

  /** The drag landed: the engine moves, the picture finishes arriving. */
  const land = useCallback(
    (wayIdx: number) => {
      const way = WAYS[wayIdx];
      if (!commit(way)) {
        // The world refused after all - put the picture back.
        // eslint-disable-next-line react-hooks/immutability
        prog.value = withTiming(0, { duration: 200 }, (done) => {
          'worklet';
          if (done) {
            curIdx.value = fromIdx.value;
            fromIdx.value = -1;
            busySV.value = 0;
          }
        });
        return;
      }
      const left = 1 - prog.value;
      prog.value = withTiming(
        1,
        { duration: 140 + PHASE_MS * 0.7 * left, easing: Easing.out(Easing.cubic) },
        (done) => {
          'worklet';
          if (done) {
            fromIdx.value = -1;
            runOnJS(settle)();
          }
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, settle],
  );

  // Touch targets on the paintings. The bronze studs are the first
  // (OPENING beat 2): the game's first working input is a touch, not
  // a swipe. Regions are fractions of the displayed frame.
  const dimsRef = useRef({ width, height });
  useEffect(() => {
    dimsRef.current = { width, height };
  }, [width, height]);
  const { actOn, throwBlocks } = useActs({
    speak, soundscape, setState, stateRef, castShow, setCast,
  });

  const touch = useCallback(
    (x: number, y: number) => {
      if (busySV.value) return;
      const { width: w, height: h } = dimsRef.current;
      const st = stateRef.current;
      const here = nodeOf(st.nodeId);
      // Things in the painting first - authored in painting fractions.
      const geo = paintGeo(IDX[here.id], w, h);
      const hit = targetAt(here.id, x / w, (y - geo.top) / geo.ph);
      if (hit) { actOn(hit.act, st); return; }
      // A fork (DECISIONS 110): tap the mouth you want. Both ways are
      // ahead, so the phase is the dolly inward either way.
      if (here.fork && y < h * 0.7) {
        move(x < w / 2 ? 'left' : 'right', { axis: 1, dir: -1 });
        return;
      }
      // The blocks: tap the ground at her feet.
      if (st.blocks && y > h * 0.9) { throwBlocks(); return; }
      // The water's edge (DECISIONS 67/110): touch the water and she
      // leans down to it. Not a step - her feet never leave the bank.
      if (LEAN[IDX[here.id]] && y > h * 0.55) {
        move('down', { axis: 1, dir: -1 });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speak, move, soundscape, throwBlocks, actOn],
  );

  const { glance, glanceSrc, glanceStart, glanceEnd } = useGlance({
    busySV, refuse, stateRef, setState,
  });

  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    Gesture.Race(
      Gesture.Exclusive(
        Gesture.LongPress()
          .minDuration(420)
          .maxDistance(18)
          .onStart(() => {
            'worklet';
            runOnJS(glanceStart)();
          })
          .onFinalize(() => {
            'worklet';
            runOnJS(glanceEnd)();
          }),
        Gesture.Tap()
          .maxDuration(260)
          .onEnd((e) => {
            'worklet';
            runOnJS(touch)(e.x, e.y);
          }),
      ),
      Gesture.Pan()
        .minDistance(10)
        .onUpdate((e) => {
          'worklet';
          if (previewWay.value === -1) {
            const way = wayFrom(e.translationX, e.translationY);
            if (way < 0) return;
            const cur = curIdx.value;
            const blocked =
              busySV.value === 1 ||
              Date.now() < holdUntilSV.value ||
              (FORK[cur] && way !== 3) ||
              (LEAN[cur] && way === 3) ||
              EXITS[cur][way] < 0;
            if (blocked) {
              previewWay.value = -2;
              runOnJS(refuse)();
              return;
            }
            previewWay.value = way;
            fromIdx.value = cur;
            curIdx.value = EXITS[cur][way];
            axis.value = way < 2 ? 0 : 1;
            dir.value = way === 1 || way === 3 ? 1 : -1;
            prog.value = 0;
          }
          const w = previewWay.value;
          if (w < 0) return;
          const travel = w < 2 ? WIDTH_SV.value * 0.6 : HEIGHT_SV.value * 0.45;
          const along = alongWay(w, e.translationX, e.translationY);
          prog.value = Math.min(1, Math.max(0, along / travel));
        })
        .onEnd((e) => {
          'worklet';
          const w = previewWay.value;
          previewWay.value = -1;
          if (w < 0) return;
          const flung = flungAlong(w, e.velocityX, e.velocityY);
          busySV.value = 1;
          if (prog.value > 0.3 || flung) {
            runOnJS(land)(w);
          } else {
            prog.value = withTiming(0, { duration: 220 }, (done) => {
              'worklet';
              if (done) {
                curIdx.value = fromIdx.value;
                fromIdx.value = -1;
                busySV.value = 0;
              }
            });
          }
        }),
    ),
  );

  // The first relight under the lantern gets its line; the watch's
  // last minutes bring the voice, once, wherever she is.
  useEffect(() => {
    firesSV.value = state.fires;
    if (state.fires > prevFires.current && state.nodeId === 'lantern') {
      speak('lantern', 'relight');
    }
    prevFires.current = state.fires;
    if (!calledOnce.current && pointIndex(state) >= 5) {
      calledOnce.current = true;
      speak(state.nodeId, 'call');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fires, state.nodeId, state.elapsedMs]);

  const wc = watchCall(state);
  const drain = drainAmount(state);

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill}>
          <TownCanvas
            width={width}
            height={height}
            drain={drain}
            shared={{ curIdx, fromIdx, prog, dir, axis, walk, castShow, glance, firesSV, shiver, drown }}
            cast={cast}
            glanceSrc={glanceSrc}
          />
        </View>
      </GestureDetector>


      {line ? (
        <LineView key={line.id} line={line} top={height * (line.at ?? 0.72)} />
      ) : null}

      {watchmanCalling(state) ? (
        <View style={styles.call} pointerEvents="none">
          <Text style={styles.callLabel}>{wc.label}</Text>
          <View style={styles.strikes}>
            {Array.from({ length: wc.slow }).map((_, i) => (
              <View key={`s${i}`} style={styles.slow} />
            ))}
            <View style={styles.gap} />
            {Array.from({ length: wc.quick }).map((_, i) => (
              <View key={`q${i}`} style={styles.quick} />
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.stamp}>b67</Text>
    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: XUAN },
  call: { position: 'absolute', top: 54, left: 0, right: 0, alignItems: 'center' },
  callLabel: { color: SOOT, fontSize: 26, letterSpacing: 6, opacity: 0.75 },
  strikes: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 7 },
  slow: { width: 9, height: 9, borderRadius: 5, backgroundColor: SOOT, opacity: 0.65 },
  quick: { width: 5, height: 5, borderRadius: 3, backgroundColor: SOOT, opacity: 0.45 },
  gap: { width: 16 },
  stamp: {
    position: 'absolute', bottom: 34, left: 22,
    color: SOOT, opacity: 0.25, fontSize: 11, letterSpacing: 1,
  },
});
