# Requirements — Dot-Matrix Image Rendering

## User Story

As a billboard operator, I want to upload logo images via the left-panel UI so that they
are converted into dot-matrix sprites and shown on the billboard display around the third
text segment — letting brands and characters appear as part of the dot-matrix itself
rather than as overlaid images.

---

## Requirements

### REQ-001 — Image-to-dot-matrix conversion engine
A client-side utility must convert any uploaded PNG/JPEG into a sparse dot-matrix
representation at a target resolution.

**Acceptance criteria:**
- Given a raster image (PNG or JPEG), the converter produces a `SpriteMap` — a
  `Map<"row,col", string>` where the string is a CSS hex color — at a caller-specified
  width in dot-columns.
- Conversion happens entirely in the browser via an offscreen `<canvas>`; no server
  round-trip is required.
- Transparent pixels (alpha < 128) produce no entry in the map (dot is unlit).
- Non-transparent pixels are sampled and their color is included in the map.

### REQ-002 — Sprite segment type
The `BillboardSegment` type and `DotMatrixDisplay` rendering pipeline must support an
image sprite as a segment alongside existing text segments.

**Acceptance criteria:**
- A new `BillboardSegment` variant carries the `SpriteMap` data (not a URL, not a
  `<img>` element — raw dot coordinates and colors).
- The dot matrix renders sprite segments using the same per-dot circle draw path as text
  segments.
- Sprite dots use per-dot solid color resolved directly from the `SpriteMap`.
- Sprite segments participate in the same entrance animation system (dissolve, fly-in,
  sparkle, typewriter) as text segments.

### REQ-003 — Sprite fits the billboard grid
The sprite is placed in whatever horizontal whitespace the current text layout leaves
unused, rather than at a fixed position.

**Acceptance criteria:**
- After text segments are laid out, the renderer measures the remaining dot-row space
  below and unused dot-column space to the right of the widest text line.
- If sufficient whitespace exists (≥ 8 dot-rows or ≥ 16 dot-columns beside the text),
  the sprite is drawn there; otherwise it is drawn in its own row-band below all text.
- Aspect ratio is always preserved.
- `computeDotPx` continues to ensure all content (text + sprite) fits within the canvas.

### REQ-004 — Upload control attached to the active billboard item
The left-panel exposes a file upload control that attaches an image to whichever
billboard item is currently displayed on the dot matrix.

**Acceptance criteria:**
- When the left panel is in split mode and a billboard item is active, a small
  "upload logo" affordance is visible in the billboard list row for the active item.
- Clicking it opens a native file picker restricted to `image/png,image/jpeg`.
- Once an image is chosen, it is converted (REQ-001), stored as part of the active
  `BillboardItem`, and the dot matrix immediately re-renders with the sprite placed
  using the whitespace-detection logic from REQ-003.
- The uploaded sprite data is persisted in SQLite so it survives page reload.
- A second upload replaces the previous sprite.
- A "remove logo" affordance (×) on the same row clears the sprite.

### REQ-005 — Character text-approximation for OpenRAG documents
When an OpenRAG character sheet document is queried, the LLM may include key palette
colors from the `IMAGE GENERATION DETAILS` section in its JSON response, and those
colors are used to render a simple color-block portrait placeholder using dot rows — a
pure-dot approximation of a portrait, no image file required.

**Acceptance criteria:**
- The LLM prompt is extended with an optional `portraitColors` field: an array of 1–4
  CSS hex colors.
- When `portraitColors` is present in the response, `DotMatrixDisplay` renders a
  generated portrait block below the text segments using those colors.
- The portrait block is a banded gradient of dot rows, each row a color from the array.
- If no `portraitColors` are provided, no portrait block is shown (backward-compatible).

---

## Out of Scope

- Server-side image storage or CDN hosting of sprites.
- AI image generation (Stable Diffusion, DALL·E, Ollama vision) from character prompts.
- Animated GIFs or multi-frame sprites.
- Per-dot custom colors for text segments (text segments keep their existing `DotColor`
  descriptor).
- Any UI for reordering or batch-managing sprites.
- Image editing or cropping within the app.
