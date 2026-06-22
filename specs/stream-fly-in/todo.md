# Tasks — Streaming Fly-In Animation

## Tasks

- [x] TASK-01: [lib] Add `streamText` to `loading` and `manual` phase shapes in `lib/types.ts`
- [x] TASK-02: [lib] Extend `TOKEN_DELTA` action with `text: string`; update reducer and all `streamText: ''` init sites in `hooks/useCycle.ts`
- [x] TASK-03: [lib] Dispatch `text` alongside `count` in the stream reader loop in `hooks/useCycle.ts`
- [x] TASK-04: [lib] Add `flyInFrames` generator to `lib/braille-animations.ts`
- [x] TASK-05: [UI]  Wire `flyInFrames` into `Billboard.tsx`, replacing the spinner branch; add `streamTextRef`
- [x] TASK-06: [verify] `npx tsc --noEmit` — 0 errors; `npm run build` — clean

## Done-when notes

- **TASK-01** — `BillboardPhase` union in `types.ts` has `streamText: string` on both loading shapes; TypeScript is happy with no casts needed downstream.
- **TASK-02** — Every place in the reducer that writes `tokenCount: 0` also writes `streamText: ''`; the `TOKEN_DELTA` case appends `action.text` to `phase.streamText`.
- **TASK-03** — The `dispatch` call inside the `delta` branch passes `text: msg.text`; `tokenCount` accumulation is unchanged.
- **TASK-04** — Generator accepts `(cols, rows, textRef: { value: string })`, uses `drawTextFrame` + `BrailleCanvas` internally, implements column-offset easing, yields a `rows`-line braille string on every call to `.next()`.
- **TASK-05** — Spinner `setInterval` block removed; replaced by `flyInFrames` at 40 ms; `currentFrameRef.current` updated each tick; `streamTextRef` initialised and kept in sync with `phase.streamText`; `flyInFrames` added to the import line.
