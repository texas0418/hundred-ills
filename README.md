# HUNDRED ILLS · 走百病

A Chinese folk-horror walk game for iOS, in the Year Walk mould.

On the sixteenth night of the first lunar month, women walked out after
dark to shed the coming year's sickness — cross three bridges, touch the
gate studs, don't turn back, be home before light. You play a woman
walking that route home to her child.

Late Qing. A Jiangnan water town. Roughly eight hours, no map, no hints.

## Status

Pre-production. Design is settled and documented; the engine primitives
and their tests exist. No content, no art, no audio yet.

## Design authority

`docs/DECISIONS.txt` — numbered, SETTLED / ASSUMED / OPEN / DEAD.
Change one by referring to its number. Everything else in `docs/`
elaborates on it.

## Build

    npm install
    npm run ios

## Checks

    npm test         # pure-module tests
    npm run typecheck
    npm run lint
