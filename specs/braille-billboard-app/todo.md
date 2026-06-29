# Task List — Braille Billboard

## Tasks

### Scaffold
- [x] TASK-01: [scaffold] Bootstrap Next.js 14 app with TypeScript + Tailwind (`npx create-next-app`)
- [x] TASK-02: [scaffold] Install dependencies: `openrag-sdk`, configure `tsconfig.json` strict mode
- [x] TASK-03: [scaffold] Create `.env.local` template and `billboard.config.ts` at project root

### Lib — Braille Engine
- [x] TASK-04: [lib] Implement `BrailleCanvas` class in `lib/braille.ts` (set/clear/reset/frame, Uint8Array internals, dot→bit mapping)
- [x] TASK-05: [lib] Add `drawLineChart` renderer to `lib/braille.ts`
- [x] TASK-06: [lib] Add `drawBarChart` renderer to `lib/braille.ts`
- [x] TASK-07: [lib] Add `drawSparkline` renderer to `lib/braille.ts`

### Lib — Animations
- [x] TASK-08: [lib] Implement `spinnerFrames` and `idleFrames` generators in `lib/braille-animations.ts`
- [x] TASK-09: [lib] Implement `wipeOutFrames` and `wipeInFrames` generators in `lib/braille-animations.ts`

### Lib — Types & Parsing
- [x] TASK-10: [lib] Define all shared types in `lib/types.ts`
- [x] TASK-11: [lib] Implement `parseVisualizationData` in `lib/parse-viz.ts`

### Lib — External Services
- [x] TASK-12: [lib] Implement `queryForVisualization` in `lib/openrag.ts`
- [x] TASK-13: [lib] Implement `generateMusicAudio` in `lib/elevenlabs.ts`

### API Routes
- [x] TASK-14: [API] Add `POST /api/query` route
- [x] TASK-15: [API] Add `POST /api/music` route

### Hooks
- [x] TASK-16: [hook] Implement `useBrailleResize`
- [x] TASK-17: [hook] Implement `useAudio`
- [x] TASK-18: [hook] Implement `useMusicToggle`
- [x] TASK-19: [hook] Implement `useCycle` state machine

### UI Components
- [x] TASK-20: [UI] Implement `BrailleDisplay.tsx`
- [x] TASK-21: [UI] Implement `Footer.tsx`
- [x] TASK-22: [UI] Implement `Header.tsx`
- [x] TASK-23: [UI] Implement `ManualQuery.tsx`
- [x] TASK-24: [UI] Implement `SetupScreen.tsx`
- [x] TASK-25: [UI] Implement `Billboard.tsx`
- [x] TASK-26: [UI] Wire into `app/page.tsx`

### Verify
- [x] TASK-27: [verify] `npx tsc --noEmit` — zero type errors ✓
- [x] TASK-28: [verify] `npm run build` — zero errors ✓
- [ ] TASK-29: [verify] Smoke test: playlist cycles, braille renders, spinner shows on load, music toggle persists on reload

## Deviations
- `lib/openrag.ts`: OpenRAG SDK's `chat.create()` does not accept a `systemPrompt` parameter
  at the call site — the system prompt must be configured server-side in the OpenRAG UI/settings.
  The viz JSON shape prompt should be added to the OpenRAG agent system prompt in the admin panel.

## Follow-up (out of scope v1)
- C2: AI-driven autonomous question selection
- C3: Reactive document-change triggers
- Playlist editing UI
- Multi-document filtering
- Mobile layout
