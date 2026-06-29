# Requirements — Braille Billboard

## User Story

As a knowledge worker with documents in an OpenRAG instance, I want a living billboard
that autonomously cycles through data-rich insights from those documents — rendered as
braille visualizations with generative ambient music — so that I can passively absorb
trends, numbers, and patterns without actively querying anything.

---

## Requirements

### REQ-001 — Braille Rendering Engine
The app must render all data visualizations (charts, sparklines, progress bars, heatmaps)
exclusively using Unicode Braille characters (U+2800–U+28FF) in a monospace display.

**Acceptance criteria:**
- A reusable `BrailleCanvas` utility exists that accepts width/height in character cells
  and exposes `set(x, y)` / `clear(x, y)` / `frame()` methods
- The canvas maps a 2×4 dot grid per character cell correctly
- Output renders in a `<pre>` block with monospace font and `line-height: 1`
- At minimum: line chart, bar chart, and sparkline renderers are implemented on top of
  the canvas

### REQ-002 — Braille UI States
All loading, waiting, transitioning, and error states must use braille-based animations
rather than conventional spinners, skeletons, or progress bars.

**Acceptance criteria:**
- A rotating braille spinner cycles through dot patterns at ~100ms per frame
- A braille "wipe" transition plays between visualization changes (old viz sweeps out,
  new one sweeps in)
- An idle/standby state displays a slow animated braille pattern
- Error states display a braille-rendered indicator + plain text message below

### REQ-003 — OpenRAG RAG Pipeline Integration
The app must query a configured OpenRAG instance to retrieve data suitable for
visualization (numbers, trends, comparisons, dates, statistics).

**Acceptance criteria:**
- OpenRAG base URL and API key are configurable via environment variables
- Queries are structured to elicit quantitative/visual data (the prompt instructs the
  model to return structured data: labels, values, a chart type suggestion, and a
  one-line summary)
- The RAG response is parsed into a typed `VisualizationData` structure
- Errors from OpenRAG (timeout, auth failure, no results) are caught and displayed via
  the REQ-002 error state

### REQ-004 — Playlist / Auto-Cycle Mode (C1)
The billboard must support a configurable playlist of questions that cycle automatically,
each producing a fresh visualization.

**Acceptance criteria:**
- A playlist is defined as an ordered array of query strings in a config file
  (`billboard.config.ts` or similar)
- The billboard cycles through the playlist at a configurable dwell time (default: 30s)
- Each cycle: run RAG query → parse → render braille viz → play music sting
- Cycle timing is visible as a braille progress bar draining across the bottom of the
  billboard
- The playlist loops back to the first item after the last

### REQ-005 — Manual Query Mode
The user can interrupt the auto-cycle and manually enter a query at any time.

**Acceptance criteria:**
- A text input is always accessible (keyboard shortcut or visible field)
- Submitting a query pauses the auto-cycle and renders the result immediately
- After a configurable timeout (default: 60s), auto-cycle resumes
- Manual queries are not added to the playlist permanently

### REQ-006 — ElevenLabs Generative Music
Each visualization may be accompanied by a short generative music sting produced by
ElevenLabs Sound Generation, derived from the data content and query.

**Acceptance criteria:**
- ElevenLabs API key is configurable via environment variable
- A persistent music on/off toggle is visible at all times on the billboard UI
- When music is **on**: the RAG response pipeline generates a natural-language music
  prompt (e.g. "warm, uplifting, jazz piano, ascending melody, 8 seconds") derived from
  the data tone and trend direction; the prompt is sent to ElevenLabs and the resulting
  audio plays automatically when the visualization renders
- When music is **off**: no ElevenLabs API call is made; visualization renders normally
  with no audio
- The toggle state persists across page reloads (localStorage)
- Music is looped softly as ambient background during the dwell period, then fades out
  on transition
- Music generation failures are silent (no error shown to user) — visualization still
  renders

### REQ-007 — Billboard Layout
The app must have a full-screen billboard aesthetic appropriate for display on a monitor
or large screen.

**Acceptance criteria:**
- Full viewport display, dark background (near-black), high-contrast braille (white/
  bright color)
- Three zones: header (query text + cycle indicator), main canvas (braille viz), footer
  (summary text + dwell progress bar)
- Responsive to window resize — braille canvas recalculates character grid to fill
  available space
- Font: monospace, minimum 14px, configurable

### REQ-008 — Environment Configuration
All external service credentials and behavioral parameters must be configurable without
code changes.

**Acceptance criteria:**
- `.env.local` file documents all required and optional variables
- Required: `OPENRAG_BASE_URL`, `OPENRAG_API_KEY`, `ELEVENLABS_API_KEY`
- Optional: `BILLBOARD_DWELL_SECONDS` (default 30), `BILLBOARD_RESUME_SECONDS` (default 60),
  `BILLBOARD_FONT_SIZE` (default 14)
- App renders an explicit setup screen if required env vars are missing

---

## Out of Scope (v1)

- **REQ-C2 / REQ-C3:** AI-driven autonomous question selection; reactive document-change
  triggers — these are follow-up specs
- **Multi-document filtering:** Querying specific document subsets within OpenRAG
- **Visualization type selection by user:** The RAG pipeline suggests the chart type;
  user cannot override in v1
- **Playlist editing UI:** Playlist is edited in the config file only; no in-app editor
- **Authentication / multi-user:** Single-user, local/trusted-network deployment only
- **Mobile layout:** Billboard is designed for landscape desktop/TV display
- **Saving or exporting visualizations**
- **Conversation history / follow-up queries:** Each query is stateless
