/**
 * The audio files, as the bundler sees them. Keys are enforced
 * against soundscape.ts's FILES at the type level - a missing or
 * extra entry fails tsc. Kept apart from soundscape.ts so the pure
 * module stays loadable by the node test runner.
 */
import type { SoundId } from './soundscape';

export const SRC: Record<SoundId, number> = {
  'clapper-slow-1': require('../../assets/audio/clapper-slow-1.wav'),
  'clapper-slow-2': require('../../assets/audio/clapper-slow-2.wav'),
  'clapper-slow-3': require('../../assets/audio/clapper-slow-3.wav'),
  'clapper-slow-4': require('../../assets/audio/clapper-slow-4.wav'),
  'clapper-quick-1': require('../../assets/audio/clapper-quick-1.wav'),
  'clapper-quick-2': require('../../assets/audio/clapper-quick-2.wav'),
  'clapper-quick-3': require('../../assets/audio/clapper-quick-3.wav'),
  'clapper-quick-4': require('../../assets/audio/clapper-quick-4.wav'),
  'studs-1': require('../../assets/audio/studs-1.wav'),
  'studs-2': require('../../assets/audio/studs-2.wav'),
  'studs-3': require('../../assets/audio/studs-3.wav'),
  'water-loop': require('../../assets/audio/water-loop.wav'),
  'wind-loop': require('../../assets/audio/wind-loop.wav'),
  'bed-loop': require('../../assets/audio/bed-loop.wav'),
  'water-drained': require('../../assets/audio/water-drained.wav'),
  'wind-drained': require('../../assets/audio/wind-drained.wav'),
  'bed-drained': require('../../assets/audio/bed-drained.wav'),
};
