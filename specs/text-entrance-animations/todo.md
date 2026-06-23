# Tasks — Text Entrance Animations & Music Sync

## Tasks

- [x] TASK-01: [lib] Add `EntranceStyle` type and `entranceStyle?` field to `VisualizationData` in `lib/types.ts`
- [x] TASK-02: [lib] Lower `music_length_ms` from 30000 → 10000 in `lib/elevenlabs.ts`
- [x] TASK-03: [lib] Add `entranceStyle` field + entrance style guide to LLM JSON schema in `lib/openrag.ts`
- [x] TASK-04: [lib] Extract and validate `entranceStyle` from model JSON in `lib/parse-viz.ts`
- [x] TASK-05: [lib] Create `lib/entrance-animations.ts` with `deriveSegmentBounds` helper and all four entrance generators (`flyInEntranceFrames`, `dissolveEntranceFrames`, `sparkleEntranceFrames`, `typewriterEntranceFrames`)
- [x] TASK-06: [UI]  Add `entranceStyle` prop to `DotMatrixDisplay`; wire entrance alpha refs, 30 ms animation interval, per-segment stagger, and alpha-multiplied draw path
- [x] TASK-07: [UI]  Pass `entranceStyle` from `Billboard.tsx` down to `DotMatrixDisplay`
- [x] TASK-08: [verify] `npx tsc --noEmit` — 0 errors; `npm run build` — clean

## Done-when notes

- **TASK-01** — `VisualizationData` has `entranceStyle?: EntranceStyle`; `EntranceStyle` is exported from `lib/types.ts`; TypeScript is happy with no casts needed downstream.
- **TASK-04** — Parser sets `entranceStyle` on the returned object for both the `text` and chart code paths; absent/unrecognised values default to `'dissolve'`.
- **TASK-05** — Each generator is infinite (while-true loop); `dissolveEntranceFrames` completes in ~25 ticks; `sparkleEntranceFrames` in ~24; `flyInEntranceFrames` in ~20; `typewriterEntranceFrames` in `cols * 1.5` ticks. `deriveSegmentBounds` returns one `{minRow, maxRow}` per contiguous content band in the lit map.
- **TASK-06** — `entranceIntervalRef` is cleared in the `useEffect` cleanup and whenever `loading` becomes true. Dots with no alpha entry in the map render at full brightness (animation complete or not started). The entrance does NOT restart while the same segments are displayed; it restarts only when `segments` reference changes.
- **TASK-07** — `Billboard.tsx` reads `entranceStyle` from the active phase's `data.entranceStyle`; passes `undefined` (or `'dissolve'`) during loading/transitioning so `DotMatrixDisplay` stays inert until `displaying` phase.
