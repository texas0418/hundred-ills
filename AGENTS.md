# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# What this is

HUNDRED ILLS (走百病). A Chinese folk-horror walk game in the Year Walk
mould, built on a real Ming-Qing ritual: on the sixteenth night of the
first lunar month, women walked out after dark to shed the coming year's
sickness. Cross three bridges, touch the gate studs, do not turn back, be
home before light.

You play a woman walking home to her child. She died in childbirth before
the game begins and does not know it.

**docs/DECISIONS.txt is the design authority.** Every decision is numbered;
SETTLED / ASSUMED / OPEN / DEAD. When code and DECISIONS.txt disagree, one
of them is wrong on purpose — find out which before "fixing" either.

Supporting docs, all in `docs/`:
LORE.txt (folklore with [A]/[B]/[C] sourcing marks) · ART.txt · PROMPTS.txt
(AI image prompts) · REFERENCE.txt (museum links) · LENGTH.txt ·
CHAPTERS.txt · ENDING-SITE.txt · ENDING-SEQUENCE.txt

# Doctrine (decided 2026-08-19; do not relitigate)

## Sourcing
- Every creature and custom needs an `[A]` or `[B]` entry in LORE.txt and
  one clear obligation it is bound by. If it cannot be sourced it does not
  go in. The product claim is "this is real and you can look it up."
- ONE region, ONE century: late Qing, Jiangnan. Pan-Chinese mythology
  sampler is banned. So are Ghost Month as a frame, jiangshi, and ink wash.

## The three fires are NOT a health system
- She is dead and does not know it; the fires are the performance of being
  alive. Never render a bar, never say "health", never show a number.
- Counted diegetically, in canal reflections. At zero there is no
  reflection — that absence is the third-bridge reveal, not a UI state.
- 3 = living, 0 = dead, 1–2 = ambiguous and deliberately useless. The
  player must commit to a state. Do not "fix" the middle.

## Wards are installed against the DEAD
- Alive passes door gods and gets into houses; dead opens the spirit
  layer and every warded door is shut. An early draft had this backwards.
  `test-wards.ts` locks it. **Do not invert it again.**

## Everything reads two ways
- No line of dialogue and no creature behaviour ships until it works both
  as menace (first walk) and as deference (knowing). This is the expensive
  part of the game and the reason anyone will write about it.

## No help
- No map, no HUD, no tutorial, no hint system, no waypoint, no chapter
  select, no save menu. The watchman's clapper is the clock, the chapter
  marker, the save indicator and the progress bar.

## Images
- AI-generated, directed by Simon. Generate flat woodblock PLATES, never
  finished pictures: black keylines, flat unmodulated colour, no gradient,
  no baked lighting. Skia adds paper, ink bleed, registration drift, lamp
  and parallax at runtime. A gradient makes line and colour inseparable
  and kills the registration mechanic.
- **No text in any generated image, ever.** All Chinese is set live with a
  real font. Garbled characters would destroy the game's central claim.

# Engineering doctrine (house rules)

- Pure modules (`src/dbCore.ts`, `src/engine/*`) take NO expo or
  react-native imports so Node can test them (`npm test`).
- No navigation library. Screens are components behind a switch in App.tsx.
- Time is sacred: no `Date.now()` in pure modules — callers pass `nowMs`.
- Tests encode design decisions, not just behaviour. `test-wards.ts` exists
  to stop a specific bug coming back.
