# Design — Text Entrance Animations & Music Sync

## Overview

Five layers of change:

1. **Types** (`lib/types.ts`) — add `EntranceStyle` union and `entranceStyle?` on `VisualizationData`.
2. **LLM prompt** (`lib/openrag.ts`) — instruct the model to emit `entranceStyle` alongside `musicPrompt`.
3. **Parser** (`lib/parse-viz.ts`) — extract and validate `entranceStyle` from model JSON.
4. **Animation library** (`lib/entrance-animations.ts`) — four entrance generators operating on the dot lit-map.
5. **Display component** (`components/DotMatrixDisplay.tsx`) — run entrance animations once per `displaying` phase, stagger per segment.
6. **ElevenLabs** (`lib/elevenlabs.ts`) — lower `music_length_ms` to 10 000.

---

## 1. Types — `lib/types.ts`

Add:

```ts
export type EntranceStyle = 'fly-in' | 'dissolve' | 'sparkle' | 'typewriter'
```

Extend `VisualizationData`:

```ts
/** Entrance animation style chosen by the LLM to match the music mood. */
entranceStyle?: EntranceStyle
```

---

## 2. LLM prompt — `lib/openrag.ts`

In `buildVisualizationMessage`, add `entranceStyle` to the JSON schema example and rules:

```json
"entranceStyle": "<one of: fly-in | dissolve | sparkle | typewriter — pick what matches the music mood>"
```

Add to COLOR RULES section:

```
ENTRANCE STYLE GUIDE:
- fly-in:    fast, urgent, news-ticker energy — matches driving beats, action music
- dissolve:  slow, atmospheric — matches ambient, cinematic, orchestral
- sparkle:   celebratory, chaotic — matches upbeat, festival, electronic
- typewriter: deliberate, weighty — matches slow strings, somber, minimal
```

---

## 3. Parser — `lib/parse-viz.ts`

Add a `VALID_ENTRANCE_STYLES` set. After existing field validation in `parseVisualizationData`, extract:

```ts
const VALID_ENTRANCE_STYLES = new Set(['fly-in', 'dissolve', 'sparkle', 'typewriter'])

const entranceStyle: EntranceStyle =
  typeof json.entranceStyle === 'string' && VALID_ENTRANCE_STYLES.has(json.entranceStyle)
    ? (json.entranceStyle as EntranceStyle)
    : 'dissolve'   // default
```

Set `entranceStyle` on the returned `VisualizationData` for both `text` and chart paths.

---

## 4. Animation library — `lib/entrance-animations.ts`  (new file)

The four generators each accept a `LitMap` (the `Map<string, LitDot>` already produced by
`buildLitMap` in `DotMatrixDisplay`) plus canvas dimensions, and yield **per-frame alpha
maps** — `Map<string, number>` where key is `"row,col"` and value is brightness 0–1.

The caller (`DotMatrixDisplay`) already owns the dot-render loop; it merges the entrance
alpha with the existing resolved color to produce the final dot brightness.

### Shared types (exported)

```ts
export type AlphaMap = Map<string, number>

export interface EntranceOptions {
  cols: number
  rows: number
  litMap: LitMap          // Map<string, LitDot> — the settled layout
  segmentBounds: SegmentBounds[]  // [{minRow, maxRow}] per segment, derived from litMap
}

export interface SegmentBounds {
  minRow: number
  maxRow: number
}
```

### Helper — `deriveSegmentBounds`

```ts
export function deriveSegmentBounds(litMap: LitMap, rows: number): SegmentBounds[]
```

Scans the litMap dot rows, detects blank row gaps between content bands, and returns one
`{minRow, maxRow}` per contiguous band. Used by `DotMatrixDisplay` to feed stagger logic.

### Generator signatures

All generators are infinite; the caller stops consuming them when the segment reaches ≥70%
alpha coverage (for stagger) or when total frame count exceeds a cap (for safety).

```ts
export function* flyInEntranceFrames(opts: EntranceOptions): Generator<AlphaMap>
export function* dissolveEntranceFrames(opts: EntranceOptions): Generator<AlphaMap>
export function* sparkleEntranceFrames(opts: EntranceOptions): Generator<AlphaMap>
export function* typewriterEntranceFrames(opts: EntranceOptions): Generator<AlphaMap>
```

### Behaviour per style

**fly-in** (`flyInEntranceFrames`)
- Each lit dot slides in from off-screen right.
- Column `c` launches at tick `c * 0.4` (cascade stagger), with x-offset starting at
  `cols + 3`. Each tick the offset eases toward 0 with `EASE_K = 0.22`.
- Alpha = 1 as soon as the dot is within 1 column of its rest position.
- ~20 ticks per segment to full settlement.

**dissolve** (`dissolveEntranceFrames`)
- All lit dots in the segment fade in simultaneously.
- Alpha ramps linearly from 0 → 1 over 25 ticks.
- Simple: frame N → alpha = N / 25, clamped to 1.

**sparkle** (`sparkleEntranceFrames`)
- Each lit dot gets a random `birthTick` ∈ [0, 18]. Before its birth tick, alpha = 0.
- After birth tick, each dot flickers: `alpha = Math.random() > 0.4 ? 1 : 0.3` for 5
  ticks, then settles to 1 permanently.
- Total: ~24 ticks per segment.

**typewriter** (`typewriterEntranceFrames`)
- Dots are revealed left-to-right column by column.
- At tick T, all dot-columns ≤ `Math.round(T / TICKS_PER_COL)` are fully lit (alpha=1).
- `TICKS_PER_COL = 1.5` → full reveal in `cols * 1.5` ticks ≈ 30 ticks at 30 ms = ~1 s.

### Completion detection

A generator is considered "complete" (≥70%) when the count of alpha=1 dots in the
segment's row range equals or exceeds 70% of the total lit dots in that range.
`DotMatrixDisplay` checks this after each tick to advance to the next segment.

---

## 5. Display component — `components/DotMatrixDisplay.tsx`

### New props

```ts
interface DotMatrixDisplayProps {
  segments?: BillboardSegment[]
  text?: string
  loading?: boolean
  streamEnergy?: number
  /** Entrance animation to play when segments first appear. Default: 'dissolve'. */
  entranceStyle?: EntranceStyle
}
```

### Entrance animation state (refs, no re-renders)

```ts
// Which segment index is currently animating (or -1 = all settled)
const entranceSegRef    = useRef<number>(-1)
// Current generator for the active segment
const entranceGenRef    = useRef<Generator<AlphaMap> | null>(null)
// Per-dot alpha overlay: key = "row,col", value 0–1
const entranceAlphaRef  = useRef<AlphaMap>(new Map())
// Snapshot of segments/style that started the current animation run
const entranceKeyRef    = useRef<string>('')
```

### Triggering the entrance

Add a `useEffect` that watches `[segments, entranceStyle]`. When the segments change
(new billboard), compute a key `JSON.stringify(segments?.map(s=>s.text))`, compare to
`entranceKeyRef.current`, and if different:
- Reset `entranceSegRef.current = 0`
- Build `segmentBounds` from `deriveSegmentBounds`
- Launch the first segment's generator via the appropriate factory
- Store the key

### Rendering with entrance alpha

In the `draw` callback, after `buildLitMap` produces `litMap`, for each dot that has a
`litDot`:
- Look up `entranceAlphaRef.current.get(\`\${r},\${c}\`)` → `alpha` (default 1 if not present, meaning animation complete).
- Multiply the final draw alpha by `alpha`.
- Dim dot (`DOT_DIM`) is drawn if `alpha <= 0`.

### Animation loop — extending the existing RAF

The existing RAF loop already runs during `loading`. For the `displaying` phase
(non-loading), add a parallel interval at 30 ms that:
1. Calls `entranceGenRef.current?.next()` to get the next `AlphaMap`.
2. Merges it into `entranceAlphaRef.current` for the current segment's row range.
3. Checks completion (≥70% of segment dots at alpha=1). If complete:
   - Sets the remaining dots in that segment to alpha=1 (snaps to settled).
   - Advances `entranceSegRef.current` to the next segment and launches its generator.
   - When all segments complete, clears the interval.
4. Calls `draw()`.

Store the interval ref as `entranceIntervalRef.current`. Clear it in the `useEffect`
cleanup and when `loading = true`.

---

## 6. ElevenLabs — `lib/elevenlabs.ts`

Change `music_length_ms: 30000` → `music_length_ms: 10000`. One-line change.

---

## REQ Coverage

| REQ-ID  | Design item that covers it |
|---------|----------------------------|
| REQ-001 | §4 — four entrance generator styles in `lib/entrance-animations.ts` |
| REQ-002 | §5 — stagger logic in `DotMatrixDisplay`; 70% completion threshold |
| REQ-003 | §1 `EntranceStyle` type; §2 LLM prompt addition; §3 parser extraction; §5 `entranceStyle` prop |
| REQ-004 | §6 `music_length_ms: 10000` |
| REQ-005 | §5 entrance key comparison; animation runs once per segments change |
| REQ-006 | No changes to `flyInFrames`, wipe generators, loading RAF, or `SplashPanel` |
