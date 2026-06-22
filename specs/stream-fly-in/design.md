# Design — Streaming Fly-In Animation

## Overview

Three layers of change:
1. **State layer** (`lib/types.ts`, `hooks/useCycle.ts`) — thread `streamText` through the phase machine.
2. **Animation layer** (`lib/braille-animations.ts`) — new `flyInFrames` generator.
3. **Render layer** (`components/Billboard.tsx`) — wire the generator to the loading/manual phase, drop the spinner.

---

## 1. State layer

### `lib/types.ts`

Add `streamText: string` to both loading phase shapes:

```ts
| { phase: 'loading'; query: string; tokenCount: number; streamText: string }
| { phase: 'manual';  query: string; tokenCount: number; streamText: string }
```

### `hooks/useCycle.ts`

**`TOKEN_DELTA` action** — extend payload to carry the text chunk:

```ts
| { type: 'TOKEN_DELTA'; count: number; text: string }
```

**Reducer `TOKEN_DELTA` case** — append text:

```ts
case 'TOKEN_DELTA': {
  if (phase.phase !== 'loading' && phase.phase !== 'manual') return state
  return {
    ...state,
    phase: { ...phase, tokenCount: action.count, streamText: phase.streamText + action.text },
  }
}
```

**`START`, `DWELL_DONE`, `RESUME_AUTO`, `MANUAL_QUERY`** — initialise `streamText: ''` wherever `tokenCount: 0` is set.

**Dispatch site** (inside the stream reader loop):

```ts
if (msg.type === 'delta') {
  tokenCount += msg.text.length
  dispatch({ type: 'TOKEN_DELTA', count: tokenCount, text: msg.text })
}
```

---

## 2. Animation layer — `flyInFrames`

### Location
New export in `lib/braille-animations.ts`.

### Signature

```ts
export function* flyInFrames(
  cols: number,
  rows: number,
  textRef: { value: string },   // mutable box; caller updates without restarting generator
): Generator<string>
```

`textRef` mirrors the `energyRef` pattern already used by `busyFrames` — the caller sets
`textRef.value` every render without restarting the generator.

### Algorithm

```
state: colOffset[c]  — float, current x-position of column c (cols+N = off-screen right)
       colTarget[c]  — float, rest x-position = c (0-based)

On each tick:
  1. Render textRef.value into a BrailleCanvas using drawTextFrame → targetLines[row][col]
  2. For each column c in 0..cols-1:
       if colOffset[c] > c + EPSILON:
         colOffset[c] += (c - colOffset[c]) * EASE_K   // exponential ease toward target
       else:
         colOffset[c] = c                               // snapped
  3. When a new column first becomes "active" (targetLines has a non-blank char at col c),
     and colOffset[c] === c (hasn't launched yet), launch it:
       colOffset[c] = cols + LAUNCH_SPREAD * (cols - c) / cols
     (rightmost cols launch from further right, giving a cascade feel)
  4. Composite: for each row, build the output line by reading targetLines[row][round(colOffset[c])]
     — columns still in flight are shown at their current offset position;
     columns past their target are clamped to target.
  5. yield the composed frame string.
```

**Constants (tunable):**
```ts
const EASE_K        = 0.18   // fraction of remaining distance closed per tick (~40 ms)
const LAUNCH_SPREAD = 6      // extra cols of rightward offset added to outermost column
const EPSILON       = 0.5    // snap threshold
```

### Frame composition detail

Each tick produces a `rows`-line string. For row `r`, column `c`:
- Compute `srcCol = Math.round(colOffset[c])` — clamped to `[0, cols-1]`
- If `colOffset[c] > c + EPSILON` (still in flight): read `targetLines[r][srcCol]`
  (shows the character travelling from its starting column)
- If snapped: read `targetLines[r][c]` (final resting character)
- If column `c` not yet launched (no non-blank content at col `c` in any row): output `⠀`

> This means the braille characters themselves slide in — the same glyph that will end up
> at column `c` is visible moving rightward-to-left. For sparse text (most columns blank)
> this looks like individual characters flying across and landing.

---

## 3. Render layer — `Billboard.tsx`

### New ref

```ts
const streamTextRef = useRef<{ value: string }>({ value: '' })
```

### Keep ref in sync (no re-render, same pattern as `energyRef` in SplashPanel)

```ts
streamTextRef.current.value =
  (phase.phase === 'loading' || phase.phase === 'manual') ? phase.streamText : ''
```

### Animation effect — replace spinner branch

```ts
} else if (phase.phase === 'loading' || phase.phase === 'manual') {
  const gen = flyInFrames(cols, rows, streamTextRef.current)
  animRef.current = setInterval(() => {
    const result = gen.next()
    if (!result.done) {
      const f = result.value
      currentFrameRef.current = f   // keep currentFrameRef live for transition handoff
      setFrame(f)
    }
  }, 40)
```

`currentFrameRef` is updated on every fly-in tick (REQ-003) — when the phase moves to
`transitioning`, `wipeOutFrames` will receive the last fly-in frame as its input.

### Imports

Add `flyInFrames` to the existing import from `@/lib/braille-animations`.

---

## REQ Coverage

| REQ-ID  | Design item that covers it |
|---------|----------------------------|
| REQ-001 | §1 — `streamText` in phase shapes, `TOKEN_DELTA` accumulation |
| REQ-002 | §2 — `flyInFrames` generator; §3 — Billboard wires it at 40 ms |
| REQ-003 | §3 — `currentFrameRef` updated on every fly-in tick |
| REQ-004 | Spinner branch replaced (not added to); all other branches untouched |
