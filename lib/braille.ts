/**
 * BrailleCanvas — Unicode Braille rendering engine
 *
 * Each character cell covers a 2-wide × 4-tall dot grid.
 * The 8-bit dot bitmask maps to Unicode Braille (U+2800) as follows:
 *
 *   Dot layout    Bit index
 *    col 0  col 1
 *    •1     •4      bit 0   bit 3
 *    •2     •5      bit 1   bit 4
 *    •3     •6      bit 2   bit 5
 *    •7     •8      bit 6   bit 7
 */

const DOT_BIT: readonly number[] = [0, 1, 2, 6, 3, 4, 5, 7]

// (dotCol 0|1, dotRow 0..3) → bit index
function dotBit(col: 0 | 1, row: number): number {
  return DOT_BIT[col * 4 + row]!
}

export class BrailleCanvas {
  readonly cols: number
  readonly rows: number
  // Each entry is the 8-bit dot bitmask for that character cell
  private cells: Uint8Array

  constructor(cols: number, rows: number) {
    this.cols = Math.max(1, cols)
    this.rows = Math.max(1, rows)
    this.cells = new Uint8Array(this.cols * this.rows)
  }

  /** Set a dot at pixel coordinates (x, y). x range: 0..cols*2-1, y range: 0..rows*4-1 */
  set(x: number, y: number): void {
    const cellCol = Math.floor(x / 2)
    const cellRow = Math.floor(y / 4)
    if (cellCol < 0 || cellCol >= this.cols || cellRow < 0 || cellRow >= this.rows) return
    const dotCol = (x % 2) as 0 | 1
    const dotRow = y % 4
    const idx = cellRow * this.cols + cellCol
    this.cells[idx]! |= 1 << dotBit(dotCol, dotRow)
  }

  /** Clear a dot at pixel coordinates (x, y). */
  clear(x: number, y: number): void {
    const cellCol = Math.floor(x / 2)
    const cellRow = Math.floor(y / 4)
    if (cellCol < 0 || cellCol >= this.cols || cellRow < 0 || cellRow >= this.rows) return
    const dotCol = (x % 2) as 0 | 1
    const dotRow = y % 4
    const idx = cellRow * this.cols + cellCol
    this.cells[idx]! &= ~(1 << dotBit(dotCol, dotRow))
  }

  /** Clear all dots. */
  reset(): void {
    this.cells.fill(0)
  }

  /** Render the canvas to a newline-joined string of braille characters. */
  frame(): string {
    const lines: string[] = []
    for (let r = 0; r < this.rows; r++) {
      let line = ''
      for (let c = 0; c < this.cols; c++) {
        line += String.fromCodePoint(0x2800 + (this.cells[r * this.cols + c]!))
      }
      lines.push(line)
    }
    return lines.join('\n')
  }

  /** Dot-pixel width of the canvas. */
  get dotWidth(): number { return this.cols * 2 }

  /** Dot-pixel height of the canvas. */
  get dotHeight(): number { return this.rows * 4 }
}

// ---------------------------------------------------------------------------
// Chart renderers
// ---------------------------------------------------------------------------

export interface LineOpts {
  /** 0..dotHeight-1, default fills canvas height */
  yMin?: number
  yMax?: number
}

export interface BarOpts {
  /** Gap in dot-pixels between bars, default 1 */
  gap?: number
}

export interface DataPoint {
  label: string
  value: number
}

/**
 * Draw a line chart from an array of numeric values.
 * Values are normalised to fill the canvas dot-height range.
 */
export function drawLineChart(
  canvas: BrailleCanvas,
  points: number[],
  opts: LineOpts = {},
): void {
  if (points.length < 2) return
  const dw = canvas.dotWidth
  const dh = canvas.dotHeight

  const rawMin = Math.min(...points)
  const rawMax = Math.max(...points)
  const range = rawMax - rawMin || 1

  const yMin = opts.yMin ?? 0
  const yMax = opts.yMax ?? dh - 1

  function norm(v: number): number {
    return Math.round(yMax - ((v - rawMin) / range) * (yMax - yMin))
  }

  for (let i = 0; i < points.length - 1; i++) {
    const x0 = Math.round((i / (points.length - 1)) * (dw - 1))
    const x1 = Math.round(((i + 1) / (points.length - 1)) * (dw - 1))
    const y0 = norm(points[i]!)
    const y1 = norm(points[i + 1]!)
    // Bresenham line between (x0,y0) and (x1,y1)
    bresenham(canvas, x0, y0, x1, y1)
  }
}

/**
 * Draw a bar chart from DataPoint array.
 * Bars are evenly spaced across the canvas width.
 */
export function drawBarChart(
  canvas: BrailleCanvas,
  bars: DataPoint[],
  opts: BarOpts = {},
): void {
  if (bars.length === 0) return
  const dw = canvas.dotWidth
  const dh = canvas.dotHeight
  const gap = opts.gap ?? 1

  const maxVal = Math.max(...bars.map(b => b.value))
  if (maxVal === 0) return

  const totalGap = gap * (bars.length - 1)
  const barWidth = Math.max(1, Math.floor((dw - totalGap) / bars.length))

  bars.forEach((bar, i) => {
    const x0 = i * (barWidth + gap)
    const barHeight = Math.round((bar.value / maxVal) * (dh - 1))
    for (let bx = x0; bx < x0 + barWidth && bx < dw; bx++) {
      for (let by = dh - barHeight; by < dh; by++) {
        canvas.set(bx, by)
      }
    }
  })
}

/**
 * Draw a single-row sparkline at a given character row.
 * Points are normalised to fill 4 dot rows (the height of one character row).
 */
export function drawSparkline(
  canvas: BrailleCanvas,
  points: number[],
  charRow: number,
): void {
  if (points.length < 2) return
  const dw = canvas.dotWidth
  const yBase = charRow * 4

  const rawMin = Math.min(...points)
  const rawMax = Math.max(...points)
  const range = rawMax - rawMin || 1

  for (let i = 0; i < points.length - 1; i++) {
    const x0 = Math.round((i / (points.length - 1)) * (dw - 1))
    const x1 = Math.round(((i + 1) / (points.length - 1)) * (dw - 1))
    const y0 = yBase + 3 - Math.round(((points[i]! - rawMin) / range) * 3)
    const y1 = yBase + 3 - Math.round(((points[i + 1]! - rawMin) / range) * 3)
    bresenham(canvas, x0, y0, x1, y1)
  }
}

// ---------------------------------------------------------------------------
// Text renderer
// ---------------------------------------------------------------------------

/**
 * Render plain prose text into a braille canvas by word-wrapping at `cols`
 * characters and printing each character cell directly.
 *
 * Each character is mapped to a 2×4 dot cell using a minimal 5×3 pixel font
 * stored as a bitmask per glyph. Unknown characters fall back to a filled block.
 *
 * The result fills the canvas top-to-bottom. Overflow lines are silently
 * clipped at the canvas boundary.
 */
export function drawTextFrame(canvas: BrailleCanvas, text: string): void {
  const cols = canvas.cols
  const words = text.split(/\s+/).filter(Boolean)

  // Word-wrap into lines of at most `cols` chars
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current === '') {
      current = word.slice(0, cols)
    } else if (current.length + 1 + word.length <= cols) {
      current += ' ' + word
    } else {
      lines.push(current)
      current = word.slice(0, cols)
    }
  }
  if (current) lines.push(current)

  // Render each line at a character row using the dot grid
  // Each character maps to a 2-wide × 4-tall dot region (one cell).
  // We use a compact 2×3 pixel font (top 3 of 4 dot rows) encoded as a
  // 6-bit value: bits 5..0 = (col0,row0),(col0,row1),(col0,row2),(col1,row0),(col1,row1),(col1,row2)
  lines.forEach((line, lineIdx) => {
    const charRow = lineIdx * 2  // use every 2 char-rows for spacing (1 char height + 1 blank)
    if (charRow >= canvas.rows) return
    const yBase = charRow * 4

    for (let ci = 0; ci < line.length && ci < cols; ci++) {
      const ch = line[ci]!
      const xBase = ci * 2
      const glyph = GLYPH_MAP[ch.toLowerCase()] ?? GLYPH_MAP['?'] ?? 0
      // 6 bits: left column top/mid/bot, right column top/mid/bot
      for (let row = 0; row < 3; row++) {
        if (glyph & (1 << (5 - row)))     canvas.set(xBase,     yBase + row)
        if (glyph & (1 << (2 - row)))     canvas.set(xBase + 1, yBase + row)
      }
    }
  })
}

// Minimal 2×3 pixel font — 6 bits per glyph (left col top→bot, right col top→bot)
// Bit layout: bit5=L0, bit4=L1, bit3=L2, bit2=R0, bit1=R1, bit0=R2
const GLYPH_MAP: Record<string, number> = {
  'a': 0b011110, 'b': 0b111010, 'c': 0b011010, 'd': 0b111010,
  'e': 0b111110, 'f': 0b111000, 'g': 0b011110, 'h': 0b101110,
  'i': 0b111011, 'j': 0b001110, 'k': 0b101110, 'l': 0b100011,
  'm': 0b111010, 'n': 0b110110, 'o': 0b111110, 'p': 0b111100,
  'q': 0b111110, 'r': 0b111100, 's': 0b011010, 't': 0b111011,
  'u': 0b100111, 'v': 0b100111, 'w': 0b101111, 'x': 0b101010,
  'y': 0b101011, 'z': 0b011010,
  '0': 0b111110, '1': 0b011011, '2': 0b101110, '3': 0b111010,
  '4': 0b100111, '5': 0b110010, '6': 0b011110, '7': 0b111001,
  '8': 0b111110, '9': 0b111010,
  '.': 0b000001, ',': 0b000001, '!': 0b110001, '?': 0b101000,
  '-': 0b000100, ':': 0b010001, ';': 0b010001, '(': 0b011010,
  ')': 0b101001, '/': 0b001100, ' ': 0b000000,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function bresenham(
  canvas: BrailleCanvas,
  x0: number, y0: number,
  x1: number, y1: number,
): void {
  let dx = Math.abs(x1 - x0)
  let dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (true) {
    canvas.set(x0, y0)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx)  { err += dx; y0 += sy }
  }
}
