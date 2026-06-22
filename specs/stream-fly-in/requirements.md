# Requirements — Streaming Fly-In Animation

## User Story

As a billboard viewer, I want to see streaming LLM response text fly in column-by-column
from the right side of the right panel while a query is loading, so that the billboard
feels alive and responsive during the wait.

---

## Requirements

### REQ-001 — Stream text accumulation
The raw delta text arriving from the `/api/query` NDJSON stream must be accumulated and
exposed through the billboard phase state so the animation layer can access it.

**Acceptance criteria:**
- The `loading` and `manual` phase shapes each carry a `streamText: string` field.
- Each `TOKEN_DELTA` action appends the incoming text to `streamText`.
- `streamText` resets to `""` when a new `loading` or `manual` phase begins.

---

### REQ-002 — Fly-in animation during loading/manual phase
While the phase is `loading` or `manual`, the right panel billboard must display a
column-by-column fly-in animation of the accumulated stream text rendered as braille.

**Acceptance criteria:**
- Characters are rendered via the existing `drawTextFrame` pipeline into a braille grid.
- Each column of the rendered braille frame "enters" from off-screen right and eases
  (decelerates) into its final rest position, left-to-right.
- Columns that have not yet arrived remain blank (`⠀`).
- The animation ticks at a consistent interval (~40 ms) independent of how fast tokens
  arrive.
- As new text tokens arrive and extend the rendered frame, new columns are smoothly
  launched rather than causing a full restart.

---

### REQ-003 — Seamless handoff to transition
When the stream completes and the phase moves to `transitioning`, the final in-flight
fly-in frame is used as the outgoing frame for the existing wipe-out/wipe-in transition.

**Acceptance criteria:**
- `currentFrameRef` in `Billboard` is updated with the last fly-in frame before the
  transition begins, so no visual jump occurs.

---

### REQ-004 — No regression to existing animations
All existing animations (spinner, wipe-out/wipe-in, idle wave, busy wave, error pattern,
dwell display) must continue to behave exactly as before.

**Acceptance criteria:**
- Spinner animation is replaced by the fly-in only; it is no longer shown during
  `loading`/`manual`.
- All other phase animations are untouched.
- `SplashPanel` busy/idle wave is untouched.

---

## Out of Scope

- Vertical (bottom-up) fly-in — horizontal column-by-column only.
- Per-character easing (individual character-level physics).
- Right panel fly-in for chart types (line, bar, sparkline) — text stream only.
- Sound effects or haptic feedback tied to the animation.
- Configuration knobs exposed in `billboard.config.ts` for animation speed/easing.
- Any changes to the left panel (`SplashPanel`).
