'use client'

import { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react'
import type { BillboardSegment, DotColor } from '@/lib/types'

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

const DOT_PX  = 5
const GAP_PX  = 2
const STEP    = DOT_PX + GAP_PX

// Blank dot-rows inserted between segments
const SEGMENT_GAP_ROWS = 2

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
}

function buildLines(segments: BillboardSegment[], charsPerRow: number): RenderedLine[] {
  const lines: RenderedLine[] = []

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si]!
    const words = seg.text.toUpperCase().split(/\s+/).filter(Boolean)
    let current = ''

    for (const word of words) {
      const w = word.slice(0, charsPerRow)
      if (current === '') {
        current = w
      } else if (current.length + 1 + w.length <= charsPerRow) {
        current += ' ' + w
      } else {
        lines.push({ text: current, color: seg.color })
        current = w
      }
    }
    if (current) lines.push({ text: current, color: seg.color })

    // Blank separator rows between segments
    if (si < segments.length - 1) {
      for (let g = 0; g < SEGMENT_GAP_ROWS; g++) {
        lines.push({ text: '', color: { type: 'solid', hex: '#000000' } })
      }
    }
  }

  return lines
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

function buildLitMap(
  segments: BillboardSegment[],
  cols: number,
  rows: number,
): Map<string, LitDot> {
  const lit = new Map<string, LitDot>()
  if (segments.length === 0) return lit

  const charsPerRow = Math.floor((cols * STEP + GAP_PX) / (STEP * (CHAR_W + GAP)))
  if (charsPerRow <= 0) return lit

  const lines = buildLines(segments, charsPerRow)

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!
    if (!line.text) continue

    // Compute the dot-column span of the entire line for gradient purposes
    const lineCharCount = line.text.length
    const segMinCol = 0
    const segMaxCol = lineCharCount * (CHAR_W + GAP) - GAP - 1  // last pixel col of last glyph

    const rowBase = li * (CHAR_H + 1)
    for (let ci = 0; ci < line.text.length; ci++) {
      const glyph = FONT[line.text[ci]!] ?? FONT[' ']!
      const colBase = ci * (CHAR_W + GAP)
      for (let r = 0; r < CHAR_H; r++) {
        const bits = glyph[r]!
        for (let c = 0; c < CHAR_W; c++) {
          if (bits & (1 << (CHAR_W - 1 - c))) {
            const dr = rowBase + r
            const dc = colBase + c
            if (dr < rows && dc < cols) {
              lit.set(`${dr},${dc}`, { color: line.color, segMinCol, segMaxCol })
            }
          }
        }
      }
    }
  }

  return lit
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DotMatrixDisplayProps {
  /** Structured billboard segments with per-segment color. */
  segments?: BillboardSegment[]
  /** Flat text fallback (legacy / loading). */
  text?: string
  /** When true, shows a scanning loading animation instead of text. */
  loading?: boolean
}

export function DotMatrixDisplay({ segments, text = '', loading = false }: DotMatrixDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const scanRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0]!.contentRect
      setDims({ w: Math.floor(width), h: Math.floor(height) })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const d = dims
    if (!canvas || !d) return

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

    const effectiveSegments: BillboardSegment[] = loading
      ? []
      : segments && segments.length > 0
        ? segments
        : text
          ? [{ text, color: { type: 'solid', hex: '#ff6600' } }]
          : []

    const litMap = loading
      ? new Map<string, LitDot>()
      : buildLitMap(effectiveSegments, cols, rows)

    const scan = Math.floor(scanRef.current)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * STEP
        const y = r * STEP
        const cx = x + DOT_PX / 2
        const cy = y + DOT_PX / 2

        const litDot = litMap.get(`${r},${c}`)

        if (loading) {
          const dist = Math.abs(c - (scan % cols))
          const wrapped = Math.min(dist, cols - dist)
          const brightness = Math.max(0, 1 - wrapped / 3)
          ctx.beginPath()
          ctx.arc(cx, cy, DOT_PX / 2, 0, Math.PI * 2)
          ctx.fillStyle = brightness > 0
            ? `rgba(255,${Math.round(60 * brightness)},0,${brightness})`
            : DOT_DIM
          ctx.fill()
        } else if (litDot) {
          const rgb = resolveColor(litDot.color, c, cols, litDot.segMinCol, litDot.segMaxCol)
          // Core dot
          ctx.beginPath()
          ctx.arc(cx, cy, DOT_PX / 2, 0, Math.PI * 2)
          ctx.fillStyle = rgbToCss(rgb)
          ctx.fill()
          // Radial glow halo
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, DOT_PX * 1.5)
          grd.addColorStop(0, rgbToGlowCss(rgb, 0.35))
          grd.addColorStop(1, rgbToGlowCss(rgb, 0))
          ctx.beginPath()
          ctx.arc(cx, cy, DOT_PX * 1.5, 0, Math.PI * 2)
          ctx.fillStyle = grd
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(cx, cy, DOT_PX / 2, 0, Math.PI * 2)
          ctx.fillStyle = DOT_DIM
          ctx.fill()
        }
      }
    }
  }, [dims, segments, text, loading])

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (loading) {
      let last = 0
      const tick = (ts: number) => {
        if (ts - last > 16) {
          scanRef.current += 0.8
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
}
