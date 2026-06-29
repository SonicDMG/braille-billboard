# Design — Braille Billboard

## Tech Stack

- **Framework:** Next.js 14+ App Router
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS
- **OpenRAG:** `openrag-sdk` (npm)
- **ElevenLabs:** REST API via `fetch` (no official SDK needed — single endpoint)
- **State:** React `useState` / `useReducer` + `useEffect` — no external state lib needed

---

## Project Structure

```
src/
  app/
    page.tsx                        # Billboard root page (full-screen)
    api/
      query/
        route.ts                    # POST /api/query — RAG + music prompt generation
      music/
        route.ts                    # POST /api/music — ElevenLabs sound generation
  lib/
    braille.ts                      # BrailleCanvas + chart renderers
    braille-animations.ts           # Spinner, wipe, idle animation frame generators
    openrag.ts                      # OpenRAG client wrapper
    elevenlabs.ts                   # ElevenLabs Sound Generation client
    parse-viz.ts                    # Parse RAG response → VisualizationData
    types.ts                        # Shared TypeScript types
  components/
    Billboard.tsx                   # Root billboard shell (layout zones)
    BrailleDisplay.tsx              # <pre> renderer, handles resize
    Header.tsx                      # Query text + cycle indicator
    Footer.tsx                      # Summary text + dwell progress bar
    ManualQuery.tsx                 # Text input overlay
    SetupScreen.tsx                 # Missing env vars screen
  hooks/
    useCycle.ts                     # Auto-cycle playlist state machine
    useBrailleResize.ts             # Window resize → character grid dimensions
    useAudio.ts                     # Audio element lifecycle + fade
billboard.config.ts                 # Playlist + behavioral config (project root)
.env.local                          # Credentials + optional tuning vars
```

---

## Types  (`src/lib/types.ts`)

```ts
export type ChartType = 'line' | 'bar' | 'sparkline' | 'heatmap'

export interface DataPoint {
  label: string
  value: number
}

export interface VisualizationData {
  chartType: ChartType
  title: string
  summary: string        // one-line plain-text summary shown in footer
  dataPoints: DataPoint[]
  unit?: string          // e.g. "$", "%", "ms"
  musicPrompt: string    // natural-language music description
}

export type BillboardState =
  | { phase: 'setup' }                          // missing env vars
  | { phase: 'idle' }                           // standby animation
  | { phase: 'loading'; query: string }         // querying RAG
  | { phase: 'transitioning'; next: VisualizationData }  // wipe animation
  | { phase: 'displaying'; data: VisualizationData; dwellRemaining: number }
  | { phase: 'error'; message: string; query: string }
  | { phase: 'manual'; query: string }          // manual query in flight
```

---

## Braille Engine  (`src/lib/braille.ts`)

### BrailleCanvas

```ts
class BrailleCanvas {
  constructor(cols: number, rows: number)  // character grid dimensions
  set(x: number, y: number): void          // x,y in dot coords (cols*2, rows*4)
  clear(x: number, y: number): void
  reset(): void
  frame(): string                          // returns newline-joined string of braille chars
}
```

Internal: `Uint8Array` of length `cols * rows`, each byte is the 8-bit dot bitmask.
Dot → bit mapping follows the Unicode standard (dots 1-8 → bits 0-7).

### Chart Renderers

All renderers take a `BrailleCanvas` and data, draw in-place, return nothing.

```ts
function drawLineChart(canvas: BrailleCanvas, points: number[], opts?: LineOpts): void
function drawBarChart(canvas: BrailleCanvas, bars: DataPoint[], opts?: BarOpts): void
function drawSparkline(canvas: BrailleCanvas, points: number[], row: number): void
```

Normalization: all renderers normalize values to the canvas dot-height range internally.

---

## Braille Animations  (`src/lib/braille-animations.ts`)

Each animation is a **generator function** — yields one frame string at a time.
The component calls `.next()` on each tick via `setInterval`.

```ts
function* spinnerFrames(): Generator<string>
// cycles: ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏ — 10 frames at 100ms

function* idleFrames(cols: number, rows: number): Generator<string>
// slow-moving dot wave across the canvas — ambient standby

function* wipeOutFrames(current: string, cols: number, rows: number): Generator<string>
// sweeps existing frame off left-to-right column by column

function* wipeInFrames(next: string, cols: number, rows: number): Generator<string>
// reveals new frame left-to-right column by column
```

Wipe speed: ~20ms per column step — a 60-col canvas wipes in ~1.2s.

---

## API Routes

### `POST /api/query`  (`src/app/api/query/route.ts`)

**Request:**
```json
{ "query": "What were the top revenue months last year?" }
```

**Behavior:**
1. Sends query to OpenRAG via `openrag.ts` chat endpoint
2. System prompt instructs model to return a JSON block with:
   `chartType`, `title`, `summary`, `dataPoints[]`, `unit`, `musicPrompt`
3. Parses response via `parse-viz.ts` — extracts the JSON block from the model reply
4. Returns `VisualizationData` or an error shape

**Response (success):**
```json
{
  "ok": true,
  "data": { ...VisualizationData }
}
```

**Response (error):**
```json
{ "ok": false, "error": "string" }
```

**Export:** `export const runtime = "nodejs"`

---

### `POST /api/music`  (`src/app/api/music/route.ts`)

**Request:**
```json
{ "prompt": "warm, uplifting, jazz piano, ascending melody, 8 seconds" }
```

**Behavior:**
1. Calls ElevenLabs Sound Generation API (`POST https://api.elevenlabs.io/v1/sound-generation`)
2. Returns the audio as a binary stream with `Content-Type: audio/mpeg`
3. On failure: returns `500` with no body — client treats as silent failure

> This route is only called when music is enabled. The client checks `useMusicToggle`
> before making this request — no server-side awareness of the toggle needed.

**Export:** `export const runtime = "nodejs"`

---

## `src/lib/openrag.ts`

Thin wrapper around `openrag-sdk`:

```ts
export async function queryForVisualization(query: string): Promise<string>
```

- Constructs a system prompt that instructs the model to respond with a JSON block
- System prompt template:
  ```
  You are a data analyst. The user will ask a question about their documents.
  Respond with ONLY a JSON object in this exact shape:
  {
    "chartType": "line" | "bar" | "sparkline",
    "title": "short title",
    "summary": "one sentence summary of the key insight",
    "dataPoints": [{ "label": "string", "value": number }, ...],
    "unit": "optional unit string",
    "musicPrompt": "musical description for ambient generation, e.g. warm uplifting jazz piano ascending 8 seconds"
  }
  Keep musicPrompt coherent and musical — never atonal or discordant unless the data
  truly warrants tension. Default toward warm, resolved, ambient tones.
  ```
- Timeout: 30s
- Returns raw model reply string for `parse-viz.ts` to extract

---

## `src/lib/elevenlabs.ts`

```ts
export async function generateMusicAudio(prompt: string): Promise<ArrayBuffer>
```

- `POST https://api.elevenlabs.io/v1/sound-generation`
- Body: `{ text: prompt, duration_seconds: 8, prompt_influence: 0.3 }`
- Returns `ArrayBuffer` of mp3 data
- Throws on non-200 — caller (`/api/music`) catches and returns 500

---

## `src/lib/parse-viz.ts`

```ts
export function parseVisualizationData(raw: string): VisualizationData
```

- Extracts the first JSON block from the model reply (handles markdown code fences)
- Validates required fields — throws descriptive error if shape is wrong
- Clamps `dataPoints` to a maximum of 24 entries (canvas width limit)

---

## `billboard.config.ts`  (project root)

```ts
export const billboardConfig = {
  dwellSeconds: 30,
  resumeAfterManualSeconds: 60,
  fontSize: 16,
  playlist: [
    "What were the monthly revenue totals for last year?",
    "Show me the top 10 categories by volume.",
    "What are the quarterly trends in customer acquisition?",
    "Which months had the highest and lowest performance?",
    "What are the key dates and milestones mentioned in the documents?",
  ],
} as const
```

Users edit this file to customize the playlist. No UI needed.

---

## Hooks

### `useCycle`  (`src/hooks/useCycle.ts`)

State machine managing the auto-cycle loop.

**States:** `idle → loading → transitioning → displaying → loading → ...`
**Actions:** `start`, `pause`, `resume`, `manualQuery`, `queryComplete`, `queryError`, `dwellTick`

- On mount: enters `idle`, then kicks off first query
- Every `dwellSeconds`: advances to next playlist item
- `manualQuery(q)`: pauses cycle, fires query, sets `resumeAfterManualSeconds` timer

### `useBrailleResize`  (`src/hooks/useBrailleResize.ts`)

```ts
function useBrailleResize(fontSize: number): { cols: number; rows: number }
```

- Listens to `window.resize`
- Calculates character grid: `cols = floor(width / charWidth)`, `rows = floor(height / charHeight)`
- Debounced 150ms to avoid thrashing on resize
- Returns `{ cols, rows }` — triggers re-render of `BrailleDisplay`

### `useAudio`  (`src/hooks/useAudio.ts`)

```ts
function useAudio(): { play: (url: string) => void; stop: () => void }
```

- Manages a single `HTMLAudioElement`
- `play(url)`: loads blob URL, fades in over 1s, loops
- `stop()`: fades out over 1s, then pauses and revokes blob URL
- Silent on any error

### `useMusicToggle`  (`src/hooks/useMusicToggle.ts`)

```ts
function useMusicToggle(): { musicEnabled: boolean; toggle: () => void }
```

- Reads initial state from `localStorage` key `"billboard-music-enabled"` (default: `true`)
- `toggle()`: flips state and persists to `localStorage`
- When toggled off while music is playing: calls `useAudio`'s `stop()` immediately

---

## UI Components

### `Billboard.tsx`

Root shell. Reads `billboardConfig`, checks env vars, renders `SetupScreen` if missing.
Otherwise renders the three-zone layout and owns top-level state via `useCycle`.

### `BrailleDisplay.tsx`

```tsx
<BrailleDisplay frame={string} cols={number} rows={number} color={string} />
```

Renders `frame` inside a `<pre>` with:
- `font-family: 'Courier New', monospace`
- `line-height: 1`
- `font-size: ${fontSize}px`
- `color: ${color}` — allows per-visualization accent color (optional, defaults white)

### `Header.tsx`
Query text (truncated to one line) + small braille cycle-position indicator (e.g. `⠿ 2/5`) + music toggle in the top-right corner (renders `♪ ON` / `♪ OFF`, styled as a braille-adjacent control). Toggle calls `useMusicToggle().toggle()` and stops audio immediately when turned off.

### `Footer.tsx`
One-line summary text + braille dwell progress bar draining left-to-right.

### `ManualQuery.tsx`
Triggered by `/` keypress. Full-width text input overlay, semi-transparent. `Escape` dismisses.

### `SetupScreen.tsx`
Lists missing env vars. Braille spinner animates while waiting (in case vars are added and page reloaded).

---

## `.env.local` template

```
# Required
OPENRAG_BASE_URL=http://localhost:3001
OPENRAG_API_KEY=

ELEVENLABS_API_KEY=

# Optional
BILLBOARD_DWELL_SECONDS=30
BILLBOARD_RESUME_SECONDS=60
BILLBOARD_FONT_SIZE=16
```

---

## REQ Coverage Table

| REQ | Design item |
|-----|-------------|
| REQ-001 | `src/lib/braille.ts` — `BrailleCanvas`, `drawLineChart`, `drawBarChart`, `drawSparkline` |
| REQ-002 | `src/lib/braille-animations.ts` — `spinnerFrames`, `idleFrames`, `wipeOutFrames`, `wipeInFrames` |
| REQ-003 | `src/lib/openrag.ts`, `src/lib/parse-viz.ts`, `POST /api/query` |
| REQ-004 | `billboard.config.ts`, `src/hooks/useCycle.ts`, `Footer.tsx` dwell bar |
| REQ-005 | `ManualQuery.tsx`, `useCycle` `manualQuery` action + resume timer |
| REQ-006 | `src/lib/elevenlabs.ts`, `POST /api/music`, `useAudio.ts`, `useMusicToggle.ts`, toggle in `Header.tsx` |
| REQ-007 | `Billboard.tsx` layout, `BrailleDisplay.tsx`, `useBrailleResize.ts` |
| REQ-008 | `.env.local`, `SetupScreen.tsx`, `billboardConfig` in `billboard.config.ts` |
