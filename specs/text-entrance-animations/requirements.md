# Requirements — Text Entrance Animations & Music Sync

## User Story

As a billboard viewer, I want each billboard's text segments to enter the screen with
a visually distinct animation (fly-in, dissolve, sparkle, etc.) that is coordinated
with any generated music, so that the moment a new billboard appears is impactful and
cinematic rather than an abrupt static reveal.

---

## Requirements

### REQ-001 — Multiple entrance animation styles
When a billboard transitions from `transitioning` → `displaying`, each segment of text
must animate onto the screen rather than appearing all at once.

**Acceptance criteria:**
- At least four distinct entrance styles are implemented: `fly-in`, `dissolve`,
  `sparkle`, and `typewriter`.
- Each style is a self-contained generator/function in `lib/entrance-animations.ts`.
- Animations operate on the dot-level lit map produced by `DotMatrixDisplay`, so they
  work with all existing segment colors (solid, gradient, rainbow).

---

### REQ-002 — Per-segment stagger
Individual segments within a single billboard reveal sequentially (not simultaneously),
creating a staggered cascade effect.

**Acceptance criteria:**
- Segment 1 begins its entrance immediately.
- Segment 2 begins after segment 1 reaches ≥ 70 % completion.
- Segment 3 (if present) begins after segment 2 reaches ≥ 70 % completion.
- The entrance animation loop runs inside `DotMatrixDisplay` at ~30 ms ticks.

---

### REQ-003 — Music-driven animation selection
The entrance animation style for a given billboard is chosen to complement the music
that was generated for it. The `VisualizationData` type gains an optional
`entranceStyle` field that the AI sets alongside `musicPrompt`.

**Acceptance criteria:**
- `VisualizationData` gains `entranceStyle?: EntranceStyle` where `EntranceStyle` is
  `'fly-in' | 'dissolve' | 'sparkle' | 'typewriter'`.
- The OpenRAG/LLM prompt is updated to instruct the model to pick an `entranceStyle`
  that matches the mood of the generated `musicPrompt`.
- When `entranceStyle` is absent or unrecognised, `dissolve` is used as the default.
- `DotMatrixDisplay` accepts an `entranceStyle` prop and routes to the correct
  animation.

---

### REQ-004 — Music duration shortened to 10 s
ElevenLabs music clips are trimmed from 30 s to 10 s to keep the dwell cycle snappy.

**Acceptance criteria:**
- `lib/elevenlabs.ts` sends `music_length_ms: 10000` instead of `30000`.
- No other behaviour changes.

---

### REQ-005 — Entrance animation plays once per billboard display
The entrance animation runs exactly once each time a billboard enters `displaying`
phase. After the animation completes the final settled frame persists for the remainder
of the dwell period.

**Acceptance criteria:**
- Switching to a previously-seen billboard re-runs the entrance animation.
- Entrance animation does not restart during the dwell period.
- The settled (fully revealed) frame is stable and pixel-identical to the normal
  static render.

---

### REQ-006 — No regression to existing animations or loading phase
All existing animations (streaming fly-in during load, wipe-out/wipe-in transitions,
loading streams, error pattern) must continue to work exactly as before.

**Acceptance criteria:**
- The loading fly-in (`flyInFrames`) is unchanged.
- Wipe-out/wipe-in transition is unchanged.
- `SplashPanel` busy/idle wave is unchanged.
- `DotMatrixDisplay` render loop gracefully handles the absence of an entrance style.

---

## Out of Scope

- Entrance animations for chart types (line, bar, sparkline) — text segments only.
- User-selectable animation style in the UI.
- Per-dot physics simulation (spring forces, collisions).
- Audio waveform analysis to drive animation timing (beat detection).
- Looping / repeating entrance animations during the dwell period.
- Any changes to the left panel (`SplashPanel`) or the `Footer`.
