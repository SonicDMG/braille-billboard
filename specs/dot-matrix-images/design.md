# Design — Dot-Matrix Image Rendering

---

## Overview

Two parallel additions:

1. **Sprite rendering** — a new `BillboardSegment` variant (`type: 'sprite'`) carries
   a precomputed `SpriteMap` (dot coords → hex colors).  `DotMatrixDisplay` merges
   sprite dots into the same lit-map it already uses for text, so all existing entrance
   animations, glow rendering, and dim-dot logic apply for free.

2. **Portrait approximation** — a second new variant (`type: 'portrait'`) carries an
   array of 1–4 palette colors.  The renderer synthesises a banded color block at
   render-time from those colors; no image file is needed.

Both variants are placed using a whitespace-detection pass that runs after the text
layout is committed, so the sprite/portrait fills dead space rather than pushing text
down whenever possible.

---

## 1. Type changes  (`lib/types.ts`)

### 1a. `SpriteMap`

```ts
/** key = "row,col", value = CSS hex color (e.g. "#ff6600") */
export type SpriteMap = Map<string, string>
```

Stored as a JSON-serialisable plain object `{ [key: string]: string }` in SQLite
(converted to/from `Map` at the boundary).

### 1b. New `BillboardSegment` variants

```ts
export interface BillboardSegmentText {
  type: 'text'          // new discriminant field; absent = legacy, treated as 'text'
  text: string
  color: DotColor
}

export interface BillboardSegmentSprite {
  type: 'sprite'
  /** Dot coords → hex color. Width/height implicit from key range. */
  spriteMap: SpriteMap
}

export interface BillboardSegmentPortrait {
  type: 'portrait'
  /** 1–4 palette colors, top-to-bottom banded rows. */
  colors: string[]      // CSS hex strings
}

export type BillboardSegment =
  | BillboardSegmentText
  | BillboardSegmentSprite
  | BillboardSegmentPortrait
```

`BillboardSegmentText` is a superset of the current `BillboardSegment` shape.  All
existing code that constructs `{ text, color }` objects continues to work; the `type`
field is treated as optional and defaults to `'text'` everywhere it is read.

### 1c. `BillboardItem` — new `spriteData` field

```ts
export interface BillboardItem {
  id: string
  query: string
  chatId: string | null
  data: VisualizationData
  audioB64: string | null
  /** Serialised SpriteMap for an uploaded logo, null if none. */
  spriteData: Record<string, string> | null   // plain obj for JSON compat
}
```

### 1d. `VisualizationData` — new `portraitColors` field

```ts
export interface VisualizationData {
  // ... existing fields unchanged ...
  /**
   * Optional palette colors for the portrait approximation block.
   * Populated by the LLM for character-sheet queries.  1–4 CSS hex strings.
   */
  portraitColors?: string[]
}
```

---

## 2. SQLite migration  (`lib/db.ts`)

Add a `sprite_data` column to the `items` table.  Migration is inline in `getDb()`,
idempotent via `ADD COLUMN IF NOT EXISTS`:

```sql
ALTER TABLE items ADD COLUMN sprite_data TEXT;
```

`sprite_data` stores the `SpriteMap` as `JSON.stringify({ [key]: hexColor })` or NULL.

`ItemRow` gains `sprite_data: string | null`.  
`PersistedItem` gains `spriteData: Record<string, string> | null`.

`insertItem` and `updateItem` (new) write this column.  A new `updateItemSprite(id,
spriteData)` function handles the patch-update path (upload replaces existing sprite).

---

## 3. Lib — image-to-dot-matrix converter  (`lib/image-to-sprite.ts`)

New browser-only utility.  No server involvement.

```ts
/**
 * Convert a raster image (from a File or data-URL) into a SpriteMap at the
 * specified target dot-column width.  Aspect ratio is preserved.
 *
 * @param source    File (PNG/JPEG) or data-URL string
 * @param dotCols   Target width in dot-columns
 * @returns         SpriteMap — entries only for non-transparent pixels
 */
export async function imageToSprite(
  source: File | string,
  dotCols: number,
): Promise<SpriteMap>
```

**Algorithm:**
1. Decode the image into an `HTMLImageElement` (via `URL.createObjectURL` or direct src).
2. Create an offscreen `<canvas>` sized to `dotCols × Math.round(dotCols * aspectRatio)`.
3. Draw the image scaled to fill that canvas.
4. Call `ctx.getImageData(0, 0, dotCols, dotRows)`.
5. For each pixel `(x, y)`: if `alpha >= 128`, emit `"y,x" → "#rrggbb"`.
6. Return the resulting `Map`.

The returned map's row count is `Math.round(dotCols * (naturalHeight / naturalWidth))`.

---

## 4. Whitespace-detection and sprite placement  (`components/DotMatrixDisplay.tsx`)

### 4a. `computeSpriteRegion`

New function, called after `buildLines` and `totalDotRows` complete:

```ts
interface SpriteRegion {
  mode: 'beside' | 'below'
  /** For 'beside': leftmost dot-column available to the sprite */
  colOffset: number
  /** For 'beside': available dot-column width */
  colWidth: number
  /** First dot-row of the sprite block */
  rowOffset: number
  /** Available dot-row height */
  rowHeight: number
}

function computeSpriteRegion(
  lines: RenderedLine[],
  cols: number,
  rows: number,
  usedDotRows: number,
): SpriteRegion
```

**Logic:**
- Compute `maxLineColWidth` = max dot-column span across all text lines.
- Aside space = `cols - maxLineColWidth - SEGMENT_GAP_ROWS`.
- Below space = `rows - usedDotRows - SEGMENT_GAP_ROWS`.
- If `asideWidth >= 16 AND usedDotRows >= 8`: place `beside`, `colOffset =
  maxLineColWidth + SEGMENT_GAP_ROWS`, `colWidth = asideWidth`, `rowOffset = 0`,
  `rowHeight = usedDotRows`.
- Else: place `below`, `colOffset = 0`, `colWidth = cols`, `rowOffset = usedDotRows +
  SEGMENT_GAP_ROWS`, `rowHeight = below space`.

### 4b. `buildSpriteDots`

```ts
function buildSpriteDots(
  spriteMap: SpriteMap,
  region: SpriteRegion,
): Map<string, LitDot>
```

Scales the source sprite map to fit `region.colWidth × region.rowHeight` (preserving
aspect ratio, clamped to available space), then offsets each key by `(region.rowOffset,
region.colOffset)` and emits `LitDot` entries with `color: { type: 'solid', hex }`.

### 4c. `buildPortraitDots`

```ts
function buildPortraitDots(
  colors: string[],
  region: SpriteRegion,
): Map<string, LitDot>
```

Divides `region.rowHeight` into `colors.length` equal bands.  Every dot in each band
gets the corresponding color as a solid `LitDot`.  Width is `region.colWidth`.

### 4d. `buildLitMap` extension

`buildLitMap` gains a third optional parameter `imageSeg`:

```ts
function buildLitMap(
  segments: BillboardSegment[],
  cols: number,
  rows: number,
  imageSeg?: BillboardSegmentSprite | BillboardSegmentPortrait,
): Map<string, LitDot>
```

If `imageSeg` is present, after building text dots the function calls
`computeSpriteRegion`, then `buildSpriteDots` or `buildPortraitDots`, and merges the
results into the main map.

Text segments that are not `type: 'sprite'` or `type: 'portrait'` are passed unchanged
to the existing text layout logic.  The `type` discriminant defaults to `'text'` for
objects that predate this change.

### 4e. `computeDotPx` extension

`computeDotPx` receives the optional `imageSeg` parameter and includes estimated sprite
rows in its content-fits check.

---

## 5. API routes

### 5a. `PATCH /api/items/[id]`  — new route  (`app/api/items/[id]/route.ts`)

Adds a PATCH handler alongside the existing DELETE.

**Request body:**
```json
{ "spriteData": { "0,0": "#ff6600", ... } | null }
```

**Response:** `{ "ok": true }`

**Implementation:** calls `updateItemSprite(id, spriteData)` from `lib/db.ts`.

### 5b. `GET /api/items` — unchanged (sprite data included in response)

`listItems()` already returns full rows; the new `spriteData` field will be present once
the DB migration runs.

---

## 6. LLM prompt extension  (`lib/openrag.ts`)

The `portraitColors` field is added to the example JSON and SEGMENT RULES block:

```
"portraitColors": ["#hex1", "#hex2", "#hex3"]   // optional: 1-4 dominant palette colors
                                                 // for character art approximation
```

Added under a new `PORTRAIT GUIDE` section:
- Include only for character or entity queries where you found a colour palette.
- Pick 2–4 colors from the `IMAGE GENERATION DETAILS` palette description.
- Order top-to-bottom (e.g. sky → midground → foreground).
- Omit entirely for data/topic queries with no visual character.

`parseVisualizationData` in `lib/parse-viz.ts` gains parsing for `portraitColors`:
an array of 1–4 strings, each validated as a hex color or named color via the existing
`resolveHex` helper.

---

## 7. UI — BillboardList upload affordance  (`components/BillboardList.tsx`)

### New props

```ts
interface BillboardListProps {
  // ... existing ...
  onUploadSprite: (id: string, file: File) => void
  onRemoveSprite: (id: string) => void
}
```

### Behaviour

- For the active item row only, show two additional controls after the delete (✕) button:
  - `📎` (or `⊕`) upload button — triggers a hidden `<input type="file" accept="image/png,image/jpeg">`.
  - `⊘` remove button — visible only when `item.spriteData != null`.
- Clicking upload calls `onUploadSprite(item.id, file)`.
- Clicking remove calls `onRemoveSprite(item.id)`.

---

## 8. Hook changes  (`hooks/useCycle.ts`)

### New actions

```ts
| { type: 'ITEM_SPRITE_SET'; id: string; spriteData: Record<string, string> | null }
```

Reducer: finds item by id, sets `spriteData`.

### New public callbacks

```ts
setItemSprite: (id: string, file: File) => void
removeItemSprite: (id: string) => void
```

`setItemSprite`:
1. Reads the current dot-column count from a passed-in ref (or uses a fixed 40-dot
   default as the conversion width).
2. Calls `imageToSprite(file, DOT_COLS)`.
3. Converts the `Map` to a plain object.
4. Dispatches `ITEM_SPRITE_SET`.
5. Fire-and-forget `PATCH /api/items/[id]` with `{ spriteData }`.

`removeItemSprite`: dispatches `ITEM_SPRITE_SET` with `null`, fire-and-forget PATCH.

---

## 9. `Billboard.tsx` wiring

- Passes `setItemSprite` / `removeItemSprite` from `useCycle` down to `BillboardList`
  via `onUploadSprite` / `onRemoveSprite`.
- Derives an `imageSeg` from the active item:
  - If `item.spriteData != null` → `{ type: 'sprite', spriteMap: new Map(entries) }`.
  - Else if `data.portraitColors` present → `{ type: 'portrait', colors }`.
  - Else → `undefined`.
- Passes `imageSeg` to `DotMatrixDisplay` as a new optional `imageSeg` prop.

---

## REQ coverage table

| REQ-ID  | Design item that covers it |
|---------|---------------------------|
| REQ-001 | §3 `lib/image-to-sprite.ts` |
| REQ-002 | §1b new segment variants; §4b/4c `buildSpriteDots` / `buildPortraitDots`; §4d `buildLitMap` extension |
| REQ-003 | §4a `computeSpriteRegion` whitespace detection |
| REQ-004 | §2 DB migration; §5a PATCH route; §7 `BillboardList` affordance; §8 `useCycle` callbacks; §9 `Billboard.tsx` wiring |
| REQ-005 | §6 LLM prompt extension + `parseVisualizationData`; §4c `buildPortraitDots` |
