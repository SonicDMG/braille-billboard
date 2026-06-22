'use client'

import { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react'

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

// Fixed dot size — small and dense
const DOT_PX  = 5
const GAP_PX  = 2
const STEP    = DOT_PX + GAP_PX

/** Returns a Set of 'row,col' keys for every lit dot in the text layout. */
function buildLitSet(text: string, cols: number, rows: number): Set<string> {
  const lit = new Set<string>()
  if (!text) return lit

  const charsPerRow = Math.floor((cols * STEP + GAP_PX) / (STEP * (CHAR_W + GAP)))
  if (charsPerRow <= 0) return lit

  const words = text.toUpperCase().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const w = word.slice(0, charsPerRow)
    if (current === '') {
      current = w
    } else if (current.length + 1 + w.length <= charsPerRow) {
      current += ' ' + w
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!
    const rowBase = li * (CHAR_H + 1)
    for (let ci = 0; ci < line.length; ci++) {
      const glyph = FONT[line[ci]!] ?? FONT[' ']!
      const colBase = ci * (CHAR_W + GAP)
      for (let r = 0; r < CHAR_H; r++) {
        const bits = glyph[r]!
        for (let c = 0; c < CHAR_W; c++) {
          if (bits & (1 << (CHAR_W - 1 - c))) {
            const dr = rowBase + r
            const dc = colBase + c
            if (dr < rows && dc < cols) {
              lit.add(`${dr},${dc}`)
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
  /** Text to display. Empty string = all-dim idle grid. */
  text: string
  /** When true, shows a scanning loading animation instead of text. */
  loading?: boolean
}

export function DotMatrixDisplay({ text, loading = false }: DotMatrixDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  // scanLine is used to drive the loading animation
  const scanRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  // Measure container via ResizeObserver
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

    // Ensure canvas pixel dimensions match
    if (canvas.width !== d.w || canvas.height !== d.h) {
      canvas.width = d.w
      canvas.height = d.h
    }

    ctx.clearRect(0, 0, d.w, d.h)

    const litSet = loading ? new Set<string>() : buildLitSet(text, cols, rows)
    const scan = Math.floor(scanRef.current)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * STEP
        const y = r * STEP

        const isLit = litSet.has(`${r},${c}`)

        let brightness: number
        if (loading) {
          // Scanning bar: bright column sweeps left→right, everything else dim
          const dist = Math.abs(c - (scan % cols))
          const wrapped = Math.min(dist, cols - dist)
          brightness = Math.max(0, 1 - wrapped / 3)
        } else {
          brightness = isLit ? 1 : 0
        }

        if (brightness > 0) {
          // Lit: red glow
          const alpha = loading ? brightness : 1
          ctx.beginPath()
          ctx.arc(x + DOT_PX / 2, y + DOT_PX / 2, DOT_PX / 2, 0, Math.PI * 2)
          ctx.fillStyle = loading
            ? `rgba(255,${Math.round(60 * brightness)},0,${alpha})`
            : '#ff2200'
          ctx.fill()
          if (!loading) {
            // Glow
            const grd = ctx.createRadialGradient(
              x + DOT_PX / 2, y + DOT_PX / 2, 0,
              x + DOT_PX / 2, y + DOT_PX / 2, DOT_PX * 1.5,
            )
            grd.addColorStop(0, 'rgba(255,68,0,0.35)')
            grd.addColorStop(1, 'rgba(255,68,0,0)')
            ctx.beginPath()
            ctx.arc(x + DOT_PX / 2, y + DOT_PX / 2, DOT_PX * 1.5, 0, Math.PI * 2)
            ctx.fillStyle = grd
            ctx.fill()
          }
        } else {
          // Dim background dot
          ctx.beginPath()
          ctx.arc(x + DOT_PX / 2, y + DOT_PX / 2, DOT_PX / 2, 0, Math.PI * 2)
          ctx.fillStyle = '#1a0500'
          ctx.fill()
        }
      }
    }
  }, [dims, text, loading])

  // Animation loop for loading state; static redraw otherwise
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (loading) {
      let last = 0
      const tick = (ts: number) => {
        if (ts - last > 16) { // ~60fps
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
