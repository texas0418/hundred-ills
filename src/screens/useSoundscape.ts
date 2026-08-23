/**
 * The night's sound, wired to the same engine state as the pixels.
 *
 * Six loop players run the whole night: water, wind and the bed,
 * each with a live and a drained twin. Volumes ramp toward targets
 * computed from where she stands (soundscape MIX) and how many
 * fires still burn (drainAmount) - the world loses sound the way it
 * loses colour. The clapper reads the same watch call as the visual
 * strike display. One-shots rotate takes so nothing repeats.
 */
import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { drainAmount, watchmanCalling, call as watchCall, type TownState } from '../engine/nodes';
import {
  BED_LEVEL, MIX, strikePattern, takeFor, type SoundId,
} from '../content/soundscape';
import { SRC } from '../content/soundSources';

const RAMP_MS = 900;
const RAMP_STEP = 50;

type LoopName = 'water' | 'wind' | 'bed';
const LOOPS: { name: LoopName; live: SoundId; drained: SoundId }[] = [
  { name: 'water', live: 'water-loop', drained: 'water-drained' },
  { name: 'wind', live: 'wind-loop', drained: 'wind-drained' },
  { name: 'bed', live: 'bed-loop', drained: 'bed-drained' },
];

function targetsFor(s: TownState): Record<string, number> {
  const mix = MIX[s.nodeId] ?? { water: 0, wind: 0 };
  const d = drainAmount(s);
  const base: Record<LoopName, number> = {
    water: mix.water, wind: mix.wind, bed: BED_LEVEL,
  };
  const out: Record<string, number> = {};
  for (const l of LOOPS) {
    out[l.live] = base[l.name] * (1 - d);
    out[l.drained] = base[l.name] * d;
  }
  return out;
}

export function useSoundscape(state: TownState) {
  const players = useRef<Map<SoundId, AudioPlayer> | null>(null);
  const volumes = useRef<Record<string, number>>({});
  const targets = useRef<Record<string, number>>({});
  const takes = useRef(0);
  const wasCalling = useRef(false);
  const strikeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function oneShot(id: SoundId) {
    try {
      const p = createAudioPlayer(SRC[id]);
      p.volume = 0.9;
      p.play();
      setTimeout(() => {
        try { p.release(); } catch { /* already gone */ }
      }, 2500);
    } catch { /* sound is never worth crashing over */ }
  }

  // Mount once: audio mode, the six loops, the ramp clock.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const map = new Map<SoundId, AudioPlayer>();
    for (const l of LOOPS) {
      for (const id of [l.live, l.drained]) {
        const p = createAudioPlayer(SRC[id]);
        p.loop = true;
        p.volume = 0;
        p.play();
        map.set(id, p);
        volumes.current[id] = 0;
      }
    }
    players.current = map;
    targets.current = targetsFor(state);

    const ramp = setInterval(() => {
      const m = players.current;
      if (!m) return;
      for (const [id, p] of m) {
        const want = targets.current[id] ?? 0;
        const have = volumes.current[id] ?? 0;
        if (Math.abs(want - have) < 0.005) continue;
        const step = (RAMP_STEP / RAMP_MS) * Math.sign(want - have);
        const next = Math.abs(want - have) < Math.abs(step)
          ? want
          : have + step;
        volumes.current[id] = next;
        p.volume = next;
      }
    }, RAMP_STEP);

    const timers = strikeTimers.current;
    return () => {
      clearInterval(ramp);
      for (const t of timers) clearTimeout(t);
      for (const [, p] of map) {
        try { p.release(); } catch { /* already gone */ }
      }
      players.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every state change retargets the mix; the ramp walks there.
  useEffect(() => {
    targets.current = targetsFor(state);
  }, [state]);

  // The clapper: strike the pattern on the call's rising edge.
  useEffect(() => {
    const calling = watchmanCalling(state);
    if (calling && !wasCalling.current) {
      const c = watchCall(state);
      for (const s of strikePattern(c.slow, c.quick)) {
        const timer = setTimeout(() => {
          const kind = s.kind === 'slow' ? 'clapper-slow' : 'clapper-quick';
          oneShot(takeFor(kind, takes.current++));
        }, s.atMs);
        strikeTimers.current.push(timer);
      }
    }
    wasCalling.current = calling;
  }, [state]);

  // One stable object for the life of the component, so callers can
  // hold it without re-wiring gestures: everything it touches is a ref.
  const [api] = useState(() => ({
    /** The bronze studs, and whatever touch targets come after. */
    touch() {
      oneShot(takeFor('studs', takes.current++));
    },
    /** One quick strike of the watchman's clapper as he walks by. */
    clap() {
      oneShot(takeFor('clapper-quick', takes.current++));
    },
    /** The blocks landing on stone - two knocks, close together. */
    clatter() {
      oneShot(takeFor('studs', takes.current++));
      setTimeout(() => oneShot(takeFor('studs', takes.current++)), 110);
    },
  }));
  return api;
}
