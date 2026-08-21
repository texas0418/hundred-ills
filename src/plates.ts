/**
 * Every plate the engine can draw, by name.
 *
 * require() needs a static path, so this cannot be built from strings at
 * runtime - the map has to be written out. That is also why town.ts
 * refers to plates by NAME: the town is data, and this is the one place
 * that knows where the files are.
 *
 * Two copies of each: -alpha is the living world, -drained is monochrome
 * except vermilion. The screen cross-fades between them by fire count.
 */
export const LIVE = {
  'canal-far-pair': require('../assets/plates-alpha/canal-far-pair.png'),
  'canal-far-b-pair': require('../assets/plates-alpha/canal-far-b-pair.png'),
  'canal-mid': require('../assets/plates-alpha/canal-mid.png'),
  'canal-near-kerb': require('../assets/plates-alpha/canal-near-kerb.png'),
  'lane-wall-pair': require('../assets/plates-alpha/lane-wall-pair.png'),
  'lane-mouth': require('../assets/plates-alpha/lane-mouth.png'),
  'seg-bridge-a': require('../assets/plates-alpha/seg-bridge-a.png'),
  'seg-bridge-b': require('../assets/plates-alpha/seg-bridge-b.png'),
  'night-water': require('../assets/plates-alpha/night-water.png'),
  'shuigui': require('../assets/plates-alpha/shuigui.png'),
} as const;

export const DEAD = {
  'canal-far-pair': require('../assets/plates-drained/canal-far-pair.png'),
  'canal-far-b-pair': require('../assets/plates-drained/canal-far-b-pair.png'),
  'canal-mid': require('../assets/plates-drained/canal-mid.png'),
  'canal-near-kerb': require('../assets/plates-drained/canal-near-kerb.png'),
  'lane-wall-pair': require('../assets/plates-drained/lane-wall-pair.png'),
  'lane-mouth': require('../assets/plates-drained/lane-mouth.png'),
  'seg-bridge-a': require('../assets/plates-drained/seg-bridge-a.png'),
  'seg-bridge-b': require('../assets/plates-drained/seg-bridge-b.png'),
  'night-water': require('../assets/plates-drained/night-water.png'),
  'shuigui': require('../assets/plates-drained/shuigui.png'),
} as const;

export type PlateName = keyof typeof LIVE;

export function isPlate(name: string): name is PlateName {
  return name in LIVE;
}
