'use client'

import { useEffect, useRef, useState, useLayoutEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import type {
  BillboardSegment,
  BillboardSegmentSprite,
  BillboardSegmentPortrait,
  BillboardSegmentText,
  DotColor,
  EntranceStyle,
  SpriteMap,
} from '@/lib/types'
import {
  flyInEntranceFrames,
  dissolveEntranceFrames,
  sparkleEntranceFrames,
  typewriterEntranceFrames,
  type AlphaMap,
  type SegmentBounds,
  type EntranceOptions,
} from '@/lib/entrance-animations'

// ---------------------------------------------------------------------------
// 5×7 bitmap font
// Each glyph is 5 columns × 7 rows, stored as 7 uint8s (one per row, 5 bits
// used, MSB = leftmost column).
// ---------------------------------------------------------------------------
const FONT: Record<string, number[]> = {
  'A': [0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  'B': [0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110],
  'C': [0b01111,0b10000,0b10000,0b10000,0b10000,0b10000,0b01111],
  'D': [0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110],
  'E': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
  'F': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000],
  'G': [0b01111,0b10000,0b10000,0b10111,0b10001,0b10001,0b01111],
  'H': [0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  'I': [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b11111],
  'J': [0b11111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100],
  'K': [0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
  'L': [0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
  'M': [0b10001,0b11011,0b10101,0b10001,0b10001,0b10001,0b10001],
  'N': [0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001],
  'O': [0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  'P': [0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  'Q': [0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101],
  'R': [0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
  'S': [0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
  'T': [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
  'U': [0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  'V': [0b10001,0b10001,0b10001,0b10001,0b01010,0b01010,0b00100],
  'W': [0b10001,0b10001,0b10001,0b10001,0b10101,0b11011,0b10001],
  'X': [0b10001,0b01010,0b00100,0b00100,0b00100,0b01010,0b10001],
  'Y': [0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100],
  'Z': [0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111],
  '0': [0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110],
  '1': [0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110],
  '2': [0b01110,0b10001,0b00001,0b00110,0b01000,0b10000,0b11111],
  '3': [0b11111,0b00001,0b00010,0b00110,0b00001,0b10001,0b01110],
  '4': [0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010],
  '5': [0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110],
  '6': [0b01110,0b10000,0b10000,0b11110,0b10001,0b10001,0b01110],
  '7': [0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000],
  '8': [0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110],
  '9': [0b01110,0b10001,0b10001,0b01111,0b00001,0b00001,0b01110],
  '.': [0b00000,0b00000,0b00000,0b00000,0b00000,0b01100,0b01100],
  ',': [0b00000,0b00000,0b00000,0b00000,0b00110,0b00100,0b01000],
  '!': [0b00100,0b00100,0b00100,0b00100,0b00100,0b00000,0b00100],
  '?': [0b01110,0b10001,0b00001,0b00110,0b00100,0b00000,0b00100],
  '-': [0b00000,0b00000,0b00000,0b11111,0b00000,0b00000,0b00000],
  ':': [0b00000,0b01100,0b01100,0b00000,0b01100,0b01100,0b00000],
  '\'': [0b00100,0b00100,0b01000,0b00000,0b00000,0b00000,0b00000],
  '/': [0b00001,0b00010,0b00100,0b01000,0b10000,0b00000,0b00000],
  ' ': [0b00000,0b00000,0b00000,0b00000,0b00000,0b00000,0b00000],
}

const CHAR_W = 5   // dot columns per glyph
const CHAR_H = 7   // dot rows per glyph
const GAP    = 1   // dot gap between chars (in dot units)

const GAP_PX  = 2  // physical pixels between dots

// Blank dot-rows inserted between segments
const SEGMENT_GAP_ROWS = 2

// Fraction of total dot-columns reserved for the image when one is present.
// Text is constrained to the remaining left portion; image fills the right.
const IMAGE_COL_FRACTION = 0.52

// Unlit dot color
const DOT_DIM = '#1a0500'

// ---------------------------------------------------------------------------
// Color resolution
// ---------------------------------------------------------------------------

type RGB = [number, number, number]

/** Parse a CSS hex string (#rrggbb or #rgb) to [r, g, b] 0–255. */
function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [
      parseInt(h[0]! + h[0]!, 16),
      parseInt(h[1]! + h[1]!, 16),
      parseInt(h[2]! + h[2]!, 16),
    ]
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Linear interpolation between two RGB values at position t ∈ [0, 1]. */
function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/** Convert hue (0–360) to RGB using HSV saturation=1, value=1. */
function hueToRgb(hue: number): RGB {
  const h = ((hue % 360) + 360) % 360
  const s = 1, v = 1
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if      (h < 60)  { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else              { r = c; g = 0; b = x }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/**
 * Resolve a DotColor to an RGB value for a specific dot.
 *
 * @param color     The segment's DotColor descriptor
 * @param dotCol    The absolute dot-column of this dot in the display
 * @param totalCols Total dot columns in the display (for rainbow span)
 * @param segMinCol Leftmost dot-column of this segment (for gradient span)
 * @param segMaxCol Rightmost dot-column of this segment (for gradient span)
 */
function resolveColor(
  color: DotColor,
  dotCol: number,
  totalCols: number,
  segMinCol: number,
  segMaxCol: number,
): RGB {
  switch (color.type) {
    case 'solid':
      return hexToRgb(color.hex)

    case 'rainbow': {
      // Hue cycles 0→360 across the full display width
      const t = totalCols > 1 ? dotCol / (totalCols - 1) : 0
      return hueToRgb(t * 360)
    }

    case 'gradient': {
      const span = segMaxCol - segMinCol
      const t = span > 0 ? (dotCol - segMinCol) / span : 0
      return lerpRgb(hexToRgb(color.from), hexToRgb(color.to), Math.min(1, Math.max(0, t)))
    }
  }
}

function rgbToCss([r, g, b]: RGB): string {
  return `rgb(${r},${g},${b})`
}

function rgbToGlowCss([r, g, b]: RGB, alpha: number): string {
  return `rgba(${r},${g},${b},${alpha})`
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

interface RenderedLine {
  text: string
  color: DotColor
  /** Integer scale factor for this line's glyphs (1 = 5×7, 2 = 10×14, etc.) */
  scale: number
}

/**
 * Word-wrap segment text into lines given a char width budget that varies by
 * scale factor. Returns lines tagged with their scale and color.
 *
 * @param segments    Text-only billboard segments (each may have a different scale)
 * @param scales      Per-segment integer scale factor (parallel array to segments)
 * @param colDotWidth Available dot-columns for all segments
 */
function buildLines(
  segments: BillboardSegmentText[],
  scales: number[],
  colDotWidth: number,
): RenderedLine[] {
  const lines: RenderedLine[] = []

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si]!
    const scale = scales[si] ?? 1
    // At this scale, each char occupies (CHAR_W + GAP) * scale dot-columns
    const charDotW = (CHAR_W + GAP) * scale
    const charsPerRow = Math.max(1, Math.floor((colDotWidth + GAP * scale) / charDotW))

    // Split on explicit newlines first so the author can force line breaks.
    // Each newline-delimited chunk is then independently word-wrapped.
    const hardLines = seg.text.toUpperCase().split(/\r?\n/)
    let current = ''

    for (const hardLine of hardLines) {
      // A blank hard line (empty or whitespace-only) acts as an explicit line break.
      if (!hardLine.trim()) {
        if (current) { lines.push({ text: current, color: seg.color, scale }); current = '' }
        lines.push({ text: '', color: seg.color, scale })
        continue
      }
      const words = hardLine.split(/\s+/).filter(Boolean)
      for (const word of words) {
        const w = word.slice(0, charsPerRow)
        if (current === '') {
          current = w
        } else if (current.length + 1 + w.length <= charsPerRow) {
          current += ' ' + w
        } else {
          lines.push({ text: current, color: seg.color, scale })
          current = w
        }
      }
      // Flush at the end of each hard line — the next hard line starts fresh.
      if (current) { lines.push({ text: current, color: seg.color, scale }); current = '' }
    }
    if (current) lines.push({ text: current, color: seg.color, scale })

    // Blank separator rows between segments (in 1× dot-row units)
    if (si < segments.length - 1) {
      for (let g = 0; g < SEGMENT_GAP_ROWS; g++) {
        lines.push({ text: '', color: { type: 'solid', hex: '#000000' }, scale: 1 })
      }
    }
  }

  return lines
}

/**
 * Total dot-rows consumed by a set of lines (including inter-glyph row gap).
 */
function totalDotRows(lines: RenderedLine[]): number {
  let rows = 0
  for (const line of lines) {
    rows += CHAR_H * line.scale + 1  // 1 dot-row gap after each line
  }
  return rows
}

// ---------------------------------------------------------------------------
// Lit map — maps 'row,col' → { color, segMinCol, segMaxCol }
// ---------------------------------------------------------------------------

interface LitDot {
  color: DotColor
  /** Leftmost dot-col of the segment that owns this dot (for gradient span) */
  segMinCol: number
  /** Rightmost dot-col of the segment that owns this dot (for gradient span) */
  segMaxCol: number
}

/**
 * Determine per-segment scale factors so that:
 *  - The first segment (headline) is as large as possible while keeping all
 *    content within `maxDotRows` total rows.
 *  - Subsequent segments share the remaining space at scale=1.
 * Returns an array of integer scales parallel to `segments`.
 */
function computeScales(
  segments: BillboardSegmentText[],
  colDotWidth: number,
  maxDotRows: number,
): number[] {
  if (segments.length === 0) return []

  // Body segments always render at scale=1. Compute how many rows they need.
  const bodyScales = segments.map(() => 1)

  // Try decreasing headline scales until everything fits
  for (let headlineScale = 6; headlineScale >= 1; headlineScale--) {
    const scales = segments.map((_, i) => (i === 0 ? headlineScale : 1))
    const lines = buildLines(segments, scales, colDotWidth)
    if (totalDotRows(lines) <= maxDotRows) {
      return scales
    }
  }

  // Fallback: everything at scale=1
  return bodyScales
}

/**
 * Compute the dot-row range [minRow, maxRow] for each BillboardSegment.
 * One entry per segment; rows occupied by that segment's word-wrapped lines
 * are grouped together regardless of how many typography lines it wraps into.
 * Must be called with the same inputs as buildLitMap.
 */
function buildSegmentBounds(
  segments: BillboardSegmentText[],
  cols: number,
  rows: number,
  hasImage = false,
): SegmentBounds[] {
  if (segments.length === 0) return []
  const colDotWidth = hasImage ? Math.floor(cols * (1 - IMAGE_COL_FRACTION)) : cols
  const scales = computeScales(segments, colDotWidth, rows)
  const lines = buildLines(segments, scales, colDotWidth)

  const bounds: SegmentBounds[] = []
  let rowCursor = 0
  let segIdx = 0
  let segStart = 0
  let segEnd = 0
  // Track whether we've seen any content for the current segment yet, so that
  // multiple consecutive blank rows only close the band once.
  let segHasContent = false

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!
    const lineH = CHAR_H * line.scale + 1

    if (!line.text) {
      // Blank separator row — close the current segment band on the first blank
      // after content. Subsequent blank rows for the same gap just advance rowCursor.
      if (segHasContent) {
        bounds.push({ minRow: segStart, maxRow: segEnd })
        segIdx++
        segHasContent = false
      }
      rowCursor += lineH
      segStart = rowCursor
      segEnd = rowCursor
      continue
    }

    segEnd = rowCursor + CHAR_H * line.scale - 1
    segHasContent = true
    rowCursor += lineH
  }

  // Close the final segment.
  if (segHasContent) {
    bounds.push({ minRow: segStart, maxRow: segEnd })
  }

  return bounds
}

// ---------------------------------------------------------------------------
// Sprite / portrait placement helpers
// ---------------------------------------------------------------------------

/**
 * Describes where to draw an image or portrait block within the dot grid.
 *
 * 'beside' — to the right of the text columns, same row range as the text.
 * 'below'  — below all text rows, full column width.
 */
interface SpriteRegion {
  mode: 'beside' | 'below'
  colOffset: number   // first dot-column of the sprite block
  colWidth: number    // available dot-column width
  rowOffset: number   // first dot-row of the sprite block
  rowHeight: number   // available dot-row height
}

/**
 * Compute the image region when an imageSeg is present.
 *
 * The image always occupies the right IMAGE_COL_FRACTION of the total canvas,
 * full height. Text is pre-constrained to the left portion in buildLitMap and
 * computeDotPx, so there is never a text/image overlap.
 */
function computeSpriteRegion(
  _lines: RenderedLine[],
  cols: number,
  rows: number,
  _usedDotRows: number,
): SpriteRegion {
  const textCols = Math.floor(cols * (1 - IMAGE_COL_FRACTION))
  const imgCols  = cols - textCols
  return {
    mode: 'beside',
    colOffset: textCols,
    colWidth:  imgCols,
    rowOffset: 0,
    rowHeight: rows,
  }
}

/**
 * Scale a SpriteMap to fit within a region, preserving aspect ratio.
 * Returns entries offset by (region.rowOffset, region.colOffset).
 */
function buildSpriteDots(
  spriteMap: SpriteMap,
  region: SpriteRegion,
): Map<string, LitDot> {
  if (region.colWidth <= 0 || region.rowHeight <= 0 || spriteMap.size === 0) {
    return new Map()
  }

  // Determine source dimensions from the map's key range
  let srcRows = 0
  let srcCols = 0
  for (const key of spriteMap.keys()) {
    const [r, c] = key.split(',').map(Number)
    if (r! + 1 > srcRows) srcRows = r! + 1
    if (c! + 1 > srcCols) srcCols = c! + 1
  }
  if (srcRows === 0 || srcCols === 0) return new Map()

  // Scale to fit within the region preserving aspect ratio
  const scaleX = region.colWidth / srcCols
  const scaleY = region.rowHeight / srcRows
  const scale = Math.min(scaleX, scaleY)
  const dstCols = Math.floor(srcCols * scale)
  const dstRows = Math.floor(srcRows * scale)

  if (dstCols <= 0 || dstRows <= 0) return new Map()

  // Build destination pixel array.
  // When downscaling (scale < 1) use area-averaging: accumulate all source pixels
  // that map into each destination dot and blend their colours.  This avoids the
  // aliasing and pixel-skip artefacts of pure nearest-neighbour at low resolutions.
  // When upscaling (scale >= 1) nearest-neighbour is sufficient.
  const dst = new Map<string, string>()
  if (scale >= 1) {
    // Upscaling — nearest-neighbour
    for (let dr = 0; dr < dstRows; dr++) {
      for (let dc = 0; dc < dstCols; dc++) {
        const sr = Math.min(srcRows - 1, Math.floor(dr / scale))
        const sc = Math.min(srcCols - 1, Math.floor(dc / scale))
        const hex = spriteMap.get(`${sr},${sc}`)
        if (hex) dst.set(`${dr},${dc}`, hex)
      }
    }
  } else {
    // Downscaling — area-average over the source region that maps to each dst dot
    for (let dr = 0; dr < dstRows; dr++) {
      for (let dc = 0; dc < dstCols; dc++) {
        // Source region in fractional coordinates
        const srStart = dr / scale
        const srEnd   = (dr + 1) / scale
        const scStart = dc / scale
        const scEnd   = (dc + 1) / scale

        let rSum = 0, gSum = 0, bSum = 0, weight = 0

        const rMin = Math.floor(srStart)
        const rMax = Math.min(srcRows - 1, Math.ceil(srEnd) - 1)
        const cMin = Math.floor(scStart)
        const cMax = Math.min(srcCols - 1, Math.ceil(scEnd) - 1)

        for (let sr = rMin; sr <= rMax; sr++) {
          const rw = Math.min(sr + 1, srEnd) - Math.max(sr, srStart)
          for (let sc = cMin; sc <= cMax; sc++) {
            const cw = Math.min(sc + 1, scEnd) - Math.max(sc, scStart)
            const hex = spriteMap.get(`${sr},${sc}`)
            if (!hex) continue  // unlit source dot — skip (treat as off)
            const [ri, gi, bi] = hexToRgb(hex)
            const w = rw * cw
            rSum += ri * w; gSum += gi * w; bSum += bi * w; weight += w
          }
        }

        if (weight > 0) {
          // Only emit a lit dot if the covered area is at least half lit
          const totalArea = (srEnd - srStart) * (scEnd - scStart)
          if (weight / totalArea >= 0.5) {
            const avg: RGB = [Math.round(rSum / weight), Math.round(gSum / weight), Math.round(bSum / weight)]
            dst.set(`${dr},${dc}`, '#' + avg.map(v => v.toString(16).padStart(2, '0')).join(''))
          }
        }
      }
    }
  }

  // Emit as LitDot entries offset into the grid
  const lit = new Map<string, LitDot>()
  for (const [key, hex] of dst) {
    const [r, c] = key.split(',').map(Number)
    const gr = r! + region.rowOffset
    const gc = c! + region.colOffset
    lit.set(`${gr},${gc}`, {
      color: { type: 'solid', hex },
      segMinCol: region.colOffset,
      segMaxCol: region.colOffset + dstCols - 1,
    })
  }
  return lit
}

/**
 * Generate a color-banded portrait approximation filling the region.
 * Colors are applied as equal-height horizontal bands, top-to-bottom.
 */
function buildPortraitDots(
  colors: string[],
  region: SpriteRegion,
): Map<string, LitDot> {
  if (region.colWidth <= 0 || region.rowHeight <= 0 || colors.length === 0) {
    return new Map()
  }
  const lit = new Map<string, LitDot>()
  const bandHeight = region.rowHeight / colors.length

  for (let dr = 0; dr < region.rowHeight; dr++) {
    const colorIdx = Math.min(colors.length - 1, Math.floor(dr / bandHeight))
    const hex = colors[colorIdx]!
    for (let dc = 0; dc < region.colWidth; dc++) {
      const gr = dr + region.rowOffset
      const gc = dc + region.colOffset
      lit.set(`${gr},${gc}`, {
        color: { type: 'solid', hex },
        segMinCol: region.colOffset,
        segMaxCol: region.colOffset + region.colWidth - 1,
      })
    }
  }
  return lit
}

function buildLitMap(
  segments: BillboardSegmentText[],
  cols: number,
  rows: number,
  imageSeg?: BillboardSegmentSprite | BillboardSegmentPortrait,
): Map<string, LitDot> {
  const lit = new Map<string, LitDot>()
  if (segments.length === 0 && !imageSeg) return lit

  // When an image is present, all text is constrained to the left column so
  // the image owns the full right portion at full canvas height.
  const colDotWidth = imageSeg ? Math.floor(cols * (1 - IMAGE_COL_FRACTION)) : cols

  const scales = computeScales(segments, colDotWidth, rows)
  const lines = buildLines(segments, scales, colDotWidth)

  let rowCursor = 0

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!
    if (!line.text) {
      rowCursor += CHAR_H * line.scale + 1
      continue
    }

    const scale = line.scale
    const glyphH = CHAR_H * scale
    const glyphW = CHAR_W * scale
    const charStep = (CHAR_W + GAP) * scale

    // Compute the dot-column span of the entire line for gradient purposes
    const lineCharCount = line.text.length
    const segMinCol = 0
    const segMaxCol = lineCharCount * charStep - GAP * scale - 1

    for (let ci = 0; ci < line.text.length; ci++) {
      const glyph = FONT[line.text[ci]!] ?? FONT[' ']!
      const colBase = ci * charStep

      for (let r = 0; r < CHAR_H; r++) {
        const bits = glyph[r]!
        for (let c = 0; c < CHAR_W; c++) {
          if (bits & (1 << (CHAR_W - 1 - c))) {
            // Each source dot maps to a scale×scale block of display dots
            for (let sr = 0; sr < scale; sr++) {
              for (let sc = 0; sc < scale; sc++) {
                const dr = rowCursor + r * scale + sr
                const dc = colBase + c * scale + sc
                if (dr < rows && dc < cols) {
                  lit.set(`${dr},${dc}`, { color: line.color, segMinCol, segMaxCol })
                }
              }
            }
          }
        }
      }
    }

    rowCursor += glyphH + 1
  }

  // Merge image/portrait dots if present
  if (imageSeg) {
    const usedDotRows = totalDotRows(lines)
    const region = computeSpriteRegion(lines, cols, rows, usedDotRows)
    const imageDots = imageSeg.type === 'sprite'
      ? buildSpriteDots(imageSeg.spriteMap, region)
      : buildPortraitDots(imageSeg.colors, region)
    for (const [key, dot] of imageDots) lit.set(key, dot)
  }

  return lit
}

// ---------------------------------------------------------------------------
// Compute the best uniform dot size (DOT_PX) to fill the canvas
// ---------------------------------------------------------------------------

/**
 * Given the canvas pixel dimensions and the billboard segments, compute the
 * largest integer DOT_PX such that all content fits.
 *
 * When an imageSeg is provided its estimated row contribution is included in
 * the fit check (portrait/sprite placed below text adds rows).
 */
function computeDotPx(
  canvasW: number,
  canvasH: number,
  segments: BillboardSegmentText[],
  imageSeg?: BillboardSegmentSprite | BillboardSegmentPortrait,
): number {
  const MIN_DOT = 3
  const MAX_DOT = 18

  for (let dotPx = MAX_DOT; dotPx >= MIN_DOT; dotPx--) {
    const step = dotPx + GAP_PX
    const cols = Math.floor((canvasW + GAP_PX) / step)
    const rows = Math.floor((canvasH + GAP_PX) / step)
    if (cols <= 0 || rows <= 0) continue

    if (segments.length === 0 && !imageSeg) return dotPx  // loading — any size works

    // When an image is present, all text is constrained to the left column.
    const colDotWidth = imageSeg ? Math.floor(cols * (1 - IMAGE_COL_FRACTION)) : cols
    const scales = computeScales(segments, colDotWidth, rows)
    const lines = buildLines(segments, scales, colDotWidth)
    const textRows = totalDotRows(lines)

    // Text must fit within total rows regardless of image layout.
    if (textRows <= rows) return dotPx
  }

  return MIN_DOT
}

// ---------------------------------------------------------------------------
// Entrance generator factory
// ---------------------------------------------------------------------------

function makeEntranceGenerator(
  style: EntranceStyle,
  opts: EntranceOptions,
): Generator<AlphaMap> {
  switch (style) {
    case 'fly-in':     return flyInEntranceFrames(opts)
    case 'sparkle':    return sparkleEntranceFrames(opts)
    case 'typewriter': return typewriterEntranceFrames(opts)
    case 'dissolve':
    default:           return dissolveEntranceFrames(opts)
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DotMatrixDisplayProps {
  /** Structured billboard segments with per-segment color. */
  segments?: BillboardSegmentText[]
  /** Flat text fallback (legacy / loading). */
  text?: string
  /** When true, shows a scanning loading animation instead of text. */
  loading?: boolean
  /**
   * Streaming energy 0–1. Updated each token; drives the loading animation's
   * amplitude and speed without restarting the RAF loop.
   */
  streamEnergy?: number
  /** Entrance animation style to play when segments first appear. Default: 'dissolve'. */
  entranceStyle?: EntranceStyle
  /**
   * Absolute ms offsets (from when the entrance starts) at which each segment
   * begins animating in. Index 0 = first segment. When provided, subsequent
   * segments wait until their scheduled time rather than following immediately
   * after the previous segment finishes. Unscheduled segments (index beyond the
   * array) start immediately after the prior one completes.
   */
  segmentDelaysMs?: number[]
  /**
   * Optional image segment to render in available whitespace.
   * Either a user-uploaded sprite or an LLM-derived portrait approximation.
   */
  imageSeg?: BillboardSegmentSprite | BillboardSegmentPortrait
}

/** Imperative handle exposed via ref for GIF capture. */
export interface DotMatrixDisplayHandle {
  /**
   * Capture the entrance animation as an animated GIF and trigger a download.
   * Re-triggers the entrance animation from scratch, records every frame at
   * ~30 fps, then encodes and downloads the result.
   *
   * @param filename  Suggested download filename (default: "billboard.gif")
   */
  captureGif(filename?: string): void

  /**
   * Render a sequence of billboard items as a single animated GIF.
   * Each item plays its entrance animation, holds for ~1 second, then the
   * next item begins. Triggers a file download when encoding is complete.
   *
   * @param items     Ordered array of items to include.
   * @param filename  Suggested download filename (default: "presentation.gif")
   * @param onProgress  Optional callback: called with (completedItems, totalItems)
   *                    after each item's frames are built (pre-encoding phase).
   * @param onEncodeProgress  Optional callback: called with a 0–1 fraction as
   *                          the GIF worker encodes frames.
   */
  capturePlaylistGif(
    items: Array<{
      segments?: BillboardSegmentText[]
      text?: string
      entranceStyle?: EntranceStyle
      imageSeg?: BillboardSegmentSprite | BillboardSegmentPortrait
    }>,
    filename?: string,
    onProgress?: (done: number, total: number) => void,
    onEncodeProgress?: (fraction: number) => void,
  ): void
}

export const DotMatrixDisplay = forwardRef<DotMatrixDisplayHandle, DotMatrixDisplayProps>(
function DotMatrixDisplay({ segments, text = '', loading = false, streamEnergy = 0, entranceStyle = 'dissolve', segmentDelaysMs, imageSeg }: DotMatrixDisplayProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  // Stable ref mirror of dims so effects that must not re-run on resize can read it
  const dimsRef = useRef<{ w: number; h: number } | null>(null)
  // Flips to true exactly once when the ResizeObserver first reports a size.
  // Used as a dep so the entrance-init effect re-runs if segments beat dims.
  const [dimsReady, setDimsReady] = useState(false)
  const scanRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  // Mutable box so energy can update without restarting the RAF loop
  const energyRef = useRef(0)
  energyRef.current = loading ? streamEnergy : 0
  // Per-column stream state: each column has an independent head position (0–1 of rows)
  // and a phase offset so they don't all move in lockstep.
  const streamsRef = useRef<Float32Array | null>(null)
  const streamPhaseRef = useRef<Float32Array | null>(null)

  // ── Entrance animation state ────────────────────────────────────────────────
  // Per-dot alpha overlay: key = "row,col", value 0–1. Missing = fully lit.
  const entranceAlphaRef = useRef<AlphaMap>(new Map())
  // Which segment is currently animating (-1 = all done / not started)
  const entranceSegRef = useRef<number>(-1)
  // The active generator for the current segment
  const entranceGenRef = useRef<Generator<AlphaMap> | null>(null)
  // Segment bounds derived from the lit map for the current segments
  const entranceBoundsRef = useRef<SegmentBounds[]>([])
  // Key to detect when segments change so we restart
  const entranceKeyRef = useRef<string>('')
  // Interval for the entrance animation ticks (30 ms)
  const entranceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Latest lit-key snapshot shared from draw() → entrance interval
  const entranceLitKeysRef = useRef<Set<string>>(new Set())
  const entranceColsRef = useRef<number>(0)
  const entranceRowsRef = useRef<number>(0)
  // Stable ref to entranceStyle so the interval closure reads the latest value
  const entranceStyleRef = useRef<EntranceStyle>(entranceStyle)
  entranceStyleRef.current = entranceStyle
  // Stable ref to segmentDelaysMs so the interval closure reads the latest value
  const segmentDelaysMsRef = useRef<number[] | undefined>(segmentDelaysMs)
  segmentDelaysMsRef.current = segmentDelaysMs
  // Absolute timestamp (Date.now()) when the current entrance sequence began
  const entranceStartTimeRef = useRef<number>(0)
  // Stable ref to draw so the entrance interval can call it without being in its dep array
  const drawRef = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0]!.contentRect
      const next = { w: Math.floor(width), h: Math.floor(height) }
      const firstTime = dimsRef.current === null
      dimsRef.current = next
      setDims(next)
      if (firstTime) setDimsReady(true)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const d = dims
    if (!canvas || !d) return

    const effectiveSegments: BillboardSegmentText[] = loading
      ? []
      : segments && segments.length > 0
        ? segments
        : text
          ? [{ text, color: { type: 'solid', hex: '#ff6600' } }]
          : []

    // Pick the largest dot size that fits all content
    const DOT_PX = loading ? 5 : computeDotPx(d.w, d.h, effectiveSegments, imageSeg)
    const STEP = DOT_PX + GAP_PX

    const cols = Math.floor((d.w + GAP_PX) / STEP)
    const rows = Math.floor((d.h + GAP_PX) / STEP)
    if (cols <= 0 || rows <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (canvas.width !== d.w || canvas.height !== d.h) {
      canvas.width = d.w
      canvas.height = d.h
    }

    ctx.clearRect(0, 0, d.w, d.h)

    const litMap = loading
      ? new Map<string, LitDot>()
      : buildLitMap(effectiveSegments, cols, rows, imageSeg)

    // Keep dim/grid snapshot fresh for the entrance interval
    if (!loading) {
      const litKeys = new Set(litMap.keys())
      entranceLitKeysRef.current = litKeys
      entranceColsRef.current = cols
      entranceRowsRef.current = rows
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * STEP
        const y = r * STEP
        const cx = x + DOT_PX / 2
        const cy = y + DOT_PX / 2

        const litDot = litMap.get(`${r},${c}`)

        if (loading) {
          const e = energyRef.current

          // Lazily init / resize per-column stream state.
          if (!streamsRef.current || streamsRef.current.length !== cols) {
            streamsRef.current = new Float32Array(cols)
            streamPhaseRef.current = new Float32Array(cols)
            for (let i = 0; i < cols; i++) {
              // Stagger starting positions so columns don't move in lockstep.
              // Each stream begins somewhere across the full height, moving downward.
              streamsRef.current[i] = (i / cols) * rows
              streamPhaseRef.current![i] = (i * 1.618033) % 1  // golden ratio spread
            }
          }

          // Each stream head falls from row 0 to the bottom (rows).
          // At the bottom it wraps back to row 0 to restart the descent.
          const headRow = streamsRef.current[c]!
          const midRow = rows

          // Tail length: tighter at low energy (3 rows), longer at peak (8 rows).
          const tail = 3 + e * 5

          // Distance from this dot to the stream head, measured along the column.
          // Positive = behind the head (in the tail); negative = ahead (not yet lit).
          const dist = headRow - r

          let brightness = 0
          if (dist >= 0 && dist < tail) {
            // Head dot is full brightness; tail fades exponentially.
            brightness = dist < 1 ? 1 : Math.pow(1 - dist / tail, 2.2)
          }

          // Center-pull: dots closest to the vertical midpoint get a subtle boost
          // so the display feels like data converging on the center.
          const centerBoost = 1 - Math.abs(r - rows / 2) / (rows * 0.6)
          brightness *= Math.max(0.5, centerBoost)
          brightness = Math.min(1, brightness)

          ctx.beginPath()
          ctx.arc(cx, cy, DOT_PX / 2, 0, Math.PI * 2)
          ctx.fillStyle = brightness > 0
            ? `rgba(255,${Math.round(60 * brightness * (0.2 + e * 0.8))},0,${brightness})`
            : DOT_DIM
          ctx.fill()

          // Tight glow only on the head dot — grows with energy
          if (dist < 1 && e > 0.05) {
            const glowR = DOT_PX * (1.0 + e * 1.2)
            const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
            grd.addColorStop(0, `rgba(255,${Math.round(80 * e)},0,${0.5 * e})`)
            grd.addColorStop(1, 'rgba(255,30,0,0)')
            ctx.beginPath()
            ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
            ctx.fillStyle = grd
            ctx.fill()
          }
        } else if (litDot) {
          // Apply entrance alpha overlay (1 = fully lit, 0 = dark)
          const entranceAlpha = entranceAlphaRef.current.get(`${r},${c}`) ?? 1
          if (entranceAlpha <= 0) {
            // Dot exists but not yet revealed — draw as dim
            ctx.beginPath()
            ctx.arc(cx, cy, DOT_PX / 2, 0, Math.PI * 2)
            ctx.fillStyle = DOT_DIM
            ctx.fill()
          } else {
            const rgb = resolveColor(litDot.color, c, cols, litDot.segMinCol, litDot.segMaxCol)
            // Core dot — alpha modulated
            ctx.beginPath()
            ctx.arc(cx, cy, DOT_PX / 2, 0, Math.PI * 2)
            ctx.fillStyle = entranceAlpha >= 1
              ? rgbToCss(rgb)
              : rgbToGlowCss(rgb, entranceAlpha)
            ctx.fill()
            // Radial glow halo — scaled by entrance alpha
            if (entranceAlpha > 0.1) {
              const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, DOT_PX * 1.5)
              grd.addColorStop(0, rgbToGlowCss(rgb, 0.35 * entranceAlpha))
              grd.addColorStop(1, rgbToGlowCss(rgb, 0))
              ctx.beginPath()
              ctx.arc(cx, cy, DOT_PX * 1.5, 0, Math.PI * 2)
              ctx.fillStyle = grd
              ctx.fill()
            }
          }
        } else {
          ctx.beginPath()
          ctx.arc(cx, cy, DOT_PX / 2, 0, Math.PI * 2)
          ctx.fillStyle = DOT_DIM
          ctx.fill()
        }
      }
    }
  }, [dims, segments, text, loading, entranceStyle, imageSeg])

  // Keep drawRef current after every render so the entrance interval always calls
  // the latest draw without that function being in the interval's dep array.
  drawRef.current = draw

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (loading) {
      let last = 0
      const tick = (ts: number) => {
        if (ts - last > 16) {
          const e = energyRef.current
          const streams = streamsRef.current
          const phases = streamPhaseRef.current
          const canvas = canvasRef.current
          const d = dims
          if (streams && phases && canvas && d) {
            const DOT_PX_l = loading ? 5 : computeDotPx(d.w, d.h, [])
            const STEP_l = DOT_PX_l + GAP_PX
            const cols_l = Math.floor((d.w + GAP_PX) / STEP_l)
            const rows_l = Math.floor((d.h + GAP_PX) / STEP_l)
            for (let c = 0; c < cols_l && c < streams.length; c++) {
              // Each column falls at a slightly different speed — phase offset
              // creates a rain-like cascade rather than a uniform wall.
              // Base speed: 0.18 at rest → 0.55 at peak energy.
              const speed = (0.18 + e * 0.37) * (0.7 + phases[c]! * 0.6)
              streams[c] = (streams[c]! + speed)

              // Wrap at the bottom: head resets to 0 once it passes the last row.
              if (streams[c]! > rows_l + 1) {
                streams[c] = 0
              }
            }
          }
          scanRef.current += 1
          draw()
          last = ts
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      scanRef.current = 0
      draw()
    }

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [loading, draw])

  // ── Entrance initialisation ────────────────────────────────────────────────
  // Runs when content (segments / text / entranceStyle / loading) changes, and
  // also once when dimsReady flips true so content that arrived before the first
  // ResizeObserver callback still gets initialised.
  // dimsReady never goes back to false, so it only adds one extra run ever.
  // Full dims object is intentionally absent from deps — a pure resize must not
  // reset the animation, and the dep-array size must stay constant.
  useEffect(() => {
    if (loading) return
    const d = dimsRef.current
    if (!d) return

    const effectiveSegments: BillboardSegmentText[] =
      segments && segments.length > 0
        ? segments
        : text
          ? [{ text, color: { type: 'solid', hex: '#ff6600' } }]
          : []

    if (effectiveSegments.length === 0 && !imageSeg) return

    // Only reset when the actual content (or style) has changed — not on resize.
    // Include the imageSeg type/size in the key so adding/removing a sprite restarts.
    const imageKey = imageSeg
      ? imageSeg.type === 'sprite' ? `sprite:${imageSeg.spriteMap.size}` : `portrait:${imageSeg.colors.join(',')}`
      : ''
    const newKey = `${entranceStyle}|${effectiveSegments.map(s => s.text).join('|')}|${imageKey}`
    if (newKey === entranceKeyRef.current) return

    const DOT_PX = computeDotPx(d.w, d.h, effectiveSegments, imageSeg)
    const STEP = DOT_PX + GAP_PX
    const cols = Math.floor((d.w + GAP_PX) / STEP)
    const rows = Math.floor((d.h + GAP_PX) / STEP)
    if (cols <= 0 || rows <= 0) return

    const litMap = buildLitMap(effectiveSegments, cols, rows, imageSeg)
    const litKeys = new Set(litMap.keys())

    // Pre-populate every lit dot at alpha=0 so the very first draw() after this
    // reset renders a dark canvas. Without this, missing keys default to 1 (fully
    // lit), so the first synchronous draw() paints everything bright before the
    // interval has produced even one animation frame.
    const initialAlpha: AlphaMap = new Map()
    for (const key of litKeys) initialAlpha.set(key, 0)

    entranceAlphaRef.current = initialAlpha
    entranceLitKeysRef.current = litKeys
    entranceColsRef.current = cols
    entranceRowsRef.current = rows

    const bounds = buildSegmentBounds(effectiveSegments, cols, rows, !!imageSeg)
    entranceBoundsRef.current = bounds

    if (bounds.length > 0) {
      // Normal path: animate text segments in sequence; the interval will snap
      // sprite/portrait dots to 1 when the last text segment completes.
      entranceSegRef.current = 0
      entranceGenRef.current = makeEntranceGenerator(entranceStyle, { cols, rows, litKeys, bounds: bounds[0]! })
    } else {
      // No text segments (sprite/portrait only) — snap everything to fully lit
      // immediately so the interval loop doesn't leave the image dark.
      for (const key of litKeys) initialAlpha.set(key, 1)
      entranceAlphaRef.current = initialAlpha
      entranceSegRef.current = -1
      entranceGenRef.current = null
    }
    entranceKeyRef.current = newKey
    // Record the wall-clock time this entrance sequence started so the interval
    // can compare against segmentDelaysMs offsets.
    entranceStartTimeRef.current = Date.now()
  }, [segments, text, entranceStyle, loading, dimsReady, imageSeg])

  // ── Entrance animation interval ────────────────────────────────────────────
  // Runs at 30 ms when segments are active. Advances the active segment's
  // generator, checks 70% completion to stagger to the next segment.
  // When segmentDelaysMs is set, subsequent segments also wait until their
  // scheduled time offset (measured from entranceStartTimeRef) before starting.
  useEffect(() => {
    if (loading) {
      // Clear any active entrance when we enter loading phase
      if (entranceIntervalRef.current) {
        clearInterval(entranceIntervalRef.current)
        entranceIntervalRef.current = null
      }
      return
    }

    // Start the interval
    entranceIntervalRef.current = setInterval(() => {
      const segIdx = entranceSegRef.current
      if (segIdx < 0) return  // all done

      const gen = entranceGenRef.current
      if (!gen) {
        // Parked: waiting for this segment's scheduled start time.
        // Check every tick whether the time has arrived and, if so, start it.
        const delays = segmentDelaysMsRef.current
        const scheduledDelay = delays?.[segIdx]
        if (scheduledDelay !== undefined) {
          const elapsed = Date.now() - entranceStartTimeRef.current
          if (elapsed >= scheduledDelay) {
            const nextBounds = entranceBoundsRef.current[segIdx]
            if (nextBounds) {
              entranceGenRef.current = makeEntranceGenerator(entranceStyleRef.current, {
                cols: entranceColsRef.current,
                rows: entranceRowsRef.current,
                litKeys: entranceLitKeysRef.current,
                bounds: nextBounds,
              })
            }
          }
        }
        drawRef.current()
        return
      }

      const result = gen.next()
      if (result.done) return

      const frame = result.value
      // Merge frame into the alpha map
      for (const [key, alpha] of frame) {
        entranceAlphaRef.current.set(key, alpha)
      }

      // Check 70% completion for the current segment to trigger stagger
      const bounds = entranceBoundsRef.current[segIdx]
      if (bounds) {
        const litKeys = entranceLitKeysRef.current
        let total = 0
        let settled = 0
        for (const key of litKeys) {
          const r = parseInt(key.split(',')[0]!, 10)
          if (r >= bounds.minRow && r <= bounds.maxRow) {
            total++
            if ((entranceAlphaRef.current.get(key) ?? 1) >= 0.99) settled++
          }
        }
        const pct = total > 0 ? settled / total : 1

        if (pct >= 0.7) {
          // Snap remaining dots in this segment to fully lit
          for (const key of litKeys) {
            const r = parseInt(key.split(',')[0]!, 10)
            if (r >= bounds.minRow && r <= bounds.maxRow) {
              entranceAlphaRef.current.set(key, 1)
            }
          }

          // Advance to next segment
          const nextIdx = segIdx + 1
          const nextBounds = entranceBoundsRef.current[nextIdx]
          if (nextBounds) {
            entranceSegRef.current = nextIdx
            const delays = segmentDelaysMsRef.current
            const scheduledDelay = delays?.[nextIdx]
            const elapsed = Date.now() - entranceStartTimeRef.current
            if (scheduledDelay !== undefined && elapsed < scheduledDelay) {
              // Not yet time — park with no generator; the interval will keep
              // polling until the scheduled moment arrives, then start it.
              entranceGenRef.current = null
            } else {
              const litKeys2 = entranceLitKeysRef.current
              entranceGenRef.current = makeEntranceGenerator(entranceStyleRef.current, {
                cols: entranceColsRef.current,
                rows: entranceRowsRef.current,
                litKeys: litKeys2,
                bounds: nextBounds,
              })
            }
          } else {
            // All text segments complete — snap any remaining unlit dots to 1.
            // This covers sprite / portrait dots that live outside the text bounds
            // and were pre-seeded at alpha=0 by the entrance init but never driven
            // by a generator (they have no segment bound of their own).
            for (const key of entranceLitKeysRef.current) {
              if ((entranceAlphaRef.current.get(key) ?? 1) < 1) {
                entranceAlphaRef.current.set(key, 1)
              }
            }
            entranceSegRef.current = -1
            entranceGenRef.current = null
            if (entranceIntervalRef.current) {
              clearInterval(entranceIntervalRef.current)
              entranceIntervalRef.current = null
            }
          }
        }
      }

      drawRef.current()
    }, 30)

    return () => {
      if (entranceIntervalRef.current) {
        clearInterval(entranceIntervalRef.current)
        entranceIntervalRef.current = null
      }
    }
  }, [loading])

  // ── GIF capture ───────────────────────────────────────────────────────────
  // Stable refs so captureGif can read the latest values without being listed
  // as effect deps.
  const segmentsRef = useRef(segments)
  const textRef = useRef(text)
  const entranceStyleRefCapture = useRef(entranceStyle)
  const imageSegRef = useRef(imageSeg)
  segmentsRef.current = segments
  textRef.current = text
  entranceStyleRefCapture.current = entranceStyle
  imageSegRef.current = imageSeg

  useImperativeHandle(ref, () => ({
    captureGif(filename = 'billboard.gif') {
      const canvas = canvasRef.current
      const d = dimsRef.current
      if (!canvas || !d) return

      // Dynamically import gif.js (keeps the bundle lean; only loaded when needed)
      import('gif.js').then(({ default: GIF }) => {
        const gif = new GIF({
          workers: 2,
          quality: 8,
          width: d.w,
          height: d.h,
          workerScript: '/gif.worker.js',
          background: '#000000',
        })

        const effectiveSegments: BillboardSegmentText[] =
          segmentsRef.current && segmentsRef.current.length > 0
            ? segmentsRef.current
            : textRef.current
              ? [{ text: textRef.current, color: { type: 'solid', hex: '#ff6600' } }]
              : []

        if (effectiveSegments.length === 0 && !imageSegRef.current) return

        const style = entranceStyleRefCapture.current
        const imgSeg = imageSegRef.current

        const DOT_PX = computeDotPx(d.w, d.h, effectiveSegments, imgSeg ?? undefined)
        const STEP = DOT_PX + GAP_PX
        const cols = Math.floor((d.w + GAP_PX) / STEP)
        const rows = Math.floor((d.h + GAP_PX) / STEP)
        if (cols <= 0 || rows <= 0) return

        const litMap = buildLitMap(effectiveSegments, cols, rows, imgSeg ?? undefined)
        const litKeys = new Set(litMap.keys())

        // Scratch canvas for off-screen frame rendering
        const scratch = document.createElement('canvas')
        scratch.width = d.w
        scratch.height = d.h
        const ctx = scratch.getContext('2d')!

        // Entrance animation state (isolated — does not touch the live display)
        const alphaMap: AlphaMap = new Map()
        for (const key of litKeys) alphaMap.set(key, 0)

        const bounds = buildSegmentBounds(effectiveSegments, cols, rows, !!imgSeg)

        // We'll run through the animation synchronously frame-by-frame.
        // Each "tick" corresponds to 30 ms in real time.
        const FRAME_DELAY = 30  // ms per frame in the GIF

        function renderFrame(alphaSnapshot: AlphaMap) {
          ctx.clearRect(0, 0, d!.w, d!.h)
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const cx = c * STEP + DOT_PX / 2
              const cy = r * STEP + DOT_PX / 2
              const litDot = litMap.get(`${r},${c}`)
              ctx.beginPath()
              ctx.arc(cx, cy, DOT_PX / 2, 0, Math.PI * 2)
              if (litDot) {
                const entranceAlpha = alphaSnapshot.get(`${r},${c}`) ?? 1
                if (entranceAlpha <= 0) {
                  ctx.fillStyle = DOT_DIM
                } else {
                  const rgb = resolveColor(litDot.color, c, cols, litDot.segMinCol, litDot.segMaxCol)
                  ctx.fillStyle = entranceAlpha >= 1
                    ? rgbToCss(rgb)
                    : rgbToGlowCss(rgb, entranceAlpha)
                }
              } else {
                ctx.fillStyle = DOT_DIM
              }
              ctx.fill()
            }
          }
          gif.addFrame(ctx, { copy: true, delay: FRAME_DELAY })
        }

        // Simulate the entrance sequence segment-by-segment
        if (bounds.length === 0) {
          // No text — just one fully-lit frame
          for (const key of litKeys) alphaMap.set(key, 1)
          renderFrame(alphaMap)
        } else {
          for (let si = 0; si < bounds.length; si++) {
            const bound = bounds[si]!
            const gen = makeEntranceGenerator(style, { cols, rows, litKeys, bounds: bound })
            let done = false
            while (!done) {
              const result = gen.next()
              if (result.done) break
              const frame = result.value
              for (const [key, a] of frame) alphaMap.set(key, a)
              renderFrame(alphaMap)

              // Check ≥70% settled to advance (mirrors live animation logic)
              let total = 0
              let settled = 0
              for (const key of litKeys) {
                const r = parseInt(key.split(',')[0]!, 10)
                if (r >= bound.minRow && r <= bound.maxRow) {
                  total++
                  if ((alphaMap.get(key) ?? 1) >= 0.99) settled++
                }
              }
              if (total > 0 && settled / total >= 0.7) {
                // Snap segment to fully lit and stop
                for (const key of litKeys) {
                  const r = parseInt(key.split(',')[0]!, 10)
                  if (r >= bound.minRow && r <= bound.maxRow) alphaMap.set(key, 1)
                }
                done = true
              }
            }
          }
          // Snap any remaining dots to fully lit, render the complete final frame,
          // then hold it for ~1 second before the GIF loops.
          for (const key of litKeys) alphaMap.set(key, 1)
          renderFrame(alphaMap)  // draws the fully-lit state onto ctx
          // Hold on the final frame (addFrame reuses the already-rendered ctx)
          for (let i = 0; i < 32; i++) {
            gif.addFrame(ctx, { copy: true, delay: FRAME_DELAY })
          }
        }

        gif.on('finished', (blob: Blob) => {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
        })

        gif.render()
      }).catch(err => {
        console.error('[captureGif] Failed to encode GIF:', err)
      })
    },

    capturePlaylistGif(items, filename = 'presentation.gif', onProgress, onEncodeProgress) {
      const canvas = canvasRef.current
      const d = dimsRef.current
      if (!canvas || !d || items.length === 0) return

      import('gif.js').then(({ default: GIF }) => {
        const gif = new GIF({
          workers: 2,
          quality: 8,
          width: d.w,
          height: d.h,
          workerScript: '/gif.worker.js',
          background: '#000000',
        })

        const scratch = document.createElement('canvas')
        scratch.width = d.w
        scratch.height = d.h
        const ctx = scratch.getContext('2d')!

        const FRAME_DELAY = 30  // ms per frame

        function renderFrameToGif(litMap: Map<string, LitDot>, alphaSnapshot: AlphaMap, cols: number, rows: number, dotPx: number) {
          const STEP = dotPx + GAP_PX
          ctx.clearRect(0, 0, d!.w, d!.h)
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const cx = c * STEP + dotPx / 2
              const cy = r * STEP + dotPx / 2
              const litDot = litMap.get(`${r},${c}`)
              ctx.beginPath()
              ctx.arc(cx, cy, dotPx / 2, 0, Math.PI * 2)
              if (litDot) {
                const entranceAlpha = alphaSnapshot.get(`${r},${c}`) ?? 1
                if (entranceAlpha <= 0) {
                  ctx.fillStyle = DOT_DIM
                } else {
                  const rgb = resolveColor(litDot.color, c, cols, litDot.segMinCol, litDot.segMaxCol)
                  ctx.fillStyle = entranceAlpha >= 1
                    ? rgbToCss(rgb)
                    : rgbToGlowCss(rgb, entranceAlpha)
                }
              } else {
                ctx.fillStyle = DOT_DIM
              }
              ctx.fill()
            }
          }
          gif.addFrame(ctx, { copy: true, delay: FRAME_DELAY })
        }

        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
          const item = items[itemIdx]!
          const effectiveSegments: BillboardSegmentText[] =
            item.segments && item.segments.length > 0
              ? item.segments
              : item.text
                ? [{ text: item.text, color: { type: 'solid', hex: '#ff6600' } }]
                : []

          if (effectiveSegments.length === 0 && !item.imageSeg) continue

          const style = item.entranceStyle ?? 'dissolve'
          const imgSeg = item.imageSeg

          const dotPx = computeDotPx(d.w, d.h, effectiveSegments, imgSeg)
          const STEP = dotPx + GAP_PX
          const cols = Math.floor((d.w + GAP_PX) / STEP)
          const rows = Math.floor((d.h + GAP_PX) / STEP)
          if (cols <= 0 || rows <= 0) continue

          const litMap = buildLitMap(effectiveSegments, cols, rows, imgSeg)
          const litKeys = new Set(litMap.keys())
          const alphaMap: AlphaMap = new Map()
          for (const key of litKeys) alphaMap.set(key, 0)

          const bounds = buildSegmentBounds(effectiveSegments, cols, rows, !!imgSeg)

          // Render the entrance animation for this item
          if (bounds.length === 0) {
            for (const key of litKeys) alphaMap.set(key, 1)
            renderFrameToGif(litMap, alphaMap, cols, rows, dotPx)
          } else {
            for (let si = 0; si < bounds.length; si++) {
              const bound = bounds[si]!
              const gen = makeEntranceGenerator(style, { cols, rows, litKeys, bounds: bound })
              let done = false
              while (!done) {
                const result = gen.next()
                if (result.done) break
                const frame = result.value
                for (const [key, a] of frame) alphaMap.set(key, a)
                renderFrameToGif(litMap, alphaMap, cols, rows, dotPx)

                let total = 0
                let settled = 0
                for (const key of litKeys) {
                  const r = parseInt(key.split(',')[0]!, 10)
                  if (r >= bound.minRow && r <= bound.maxRow) {
                    total++
                    if ((alphaMap.get(key) ?? 1) >= 0.99) settled++
                  }
                }
                if (total > 0 && settled / total >= 0.7) {
                  for (const key of litKeys) {
                    const r = parseInt(key.split(',')[0]!, 10)
                    if (r >= bound.minRow && r <= bound.maxRow) alphaMap.set(key, 1)
                  }
                  done = true
                }
              }
            }

            // Snap fully lit, render final frame, then hold ~1s (33 frames × 30ms)
            for (const key of litKeys) alphaMap.set(key, 1)
            renderFrameToGif(litMap, alphaMap, cols, rows, dotPx)
            for (let i = 0; i < 33; i++) {
              gif.addFrame(ctx, { copy: true, delay: FRAME_DELAY })
            }
          }

          onProgress?.(itemIdx + 1, items.length)
        }

        gif.on('progress', (fraction: number) => {
          onEncodeProgress?.(fraction)
        })

        gif.on('finished', (blob: Blob) => {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
        })

        gif.render()
      }).catch(err => {
        console.error('[capturePlaylistGif] Failed to encode GIF:', err)
      })
    },
  }))

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, width: '100%', overflow: 'hidden', position: 'relative' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
})

DotMatrixDisplay.displayName = 'DotMatrixDisplay'
