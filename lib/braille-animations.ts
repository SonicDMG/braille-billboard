/**
 * Braille animation frame generators.
 * Each is a generator function — call .next() on each tick to get the next frame string.
 */

import { BrailleCanvas } from './braille'

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

const SPINNER_CHARS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/** Single-character rotating braille spinner. Tick at ~100ms. */
export function* spinnerFrames(): Generator<string> {
  let i = 0
  while (true) {
    yield SPINNER_CHARS[i % SPINNER_CHARS.length]!
    i++
  }
}

// ---------------------------------------------------------------------------
// Idle ambient wave
// ---------------------------------------------------------------------------

/**
 * Slow-moving sinusoidal dot wave that fills the canvas.
 * Tick at ~50ms for a smooth ambient animation.
 */
export function* idleFrames(cols: number, rows: number): Generator<string> {
  const canvas = new BrailleCanvas(cols, rows)
  const dw = canvas.dotWidth
  const dh = canvas.dotHeight
  let t = 0

  while (true) {
    canvas.reset()
    for (let x = 0; x < dw; x++) {
      // Two overlapping sine waves for organic feel
      const y1 = Math.round((dh / 2) + (dh / 4) * Math.sin((x / dw) * Math.PI * 4 + t))
      const y2 = Math.round((dh / 2) + (dh / 6) * Math.sin((x / dw) * Math.PI * 6 - t * 0.7))
      if (y1 >= 0 && y1 < dh) canvas.set(x, y1)
      if (y2 >= 0 && y2 < dh) canvas.set(x, y2)
    }
    yield canvas.frame()
    t += 0.08
  }
}

// ---------------------------------------------------------------------------
// Wipe transitions
// ---------------------------------------------------------------------------

/**
 * Sweeps the current frame out to the right, column by column.
 * Yields one frame per step. Tick at ~20ms per step.
 */
export function* wipeOutFrames(
  currentFrame: string,
  cols: number,
): Generator<string> {
  const lines = currentFrame.split('\n')
  const rows = lines.length

  for (let col = 0; col <= cols; col++) {
    const frame = lines
      .map(line => {
        // Replace chars at or beyond col with blank braille (⠀)
        return line
          .split('')
          .map((ch, i) => (i >= cols - col ? '⠀' : ch))
          .join('')
      })
      .join('\n')
    yield frame
  }
}

/**
 * Reveals a new frame from left to right, column by column.
 * Yields one frame per step. Tick at ~20ms per step.
 */
export function* wipeInFrames(
  nextFrame: string,
  cols: number,
): Generator<string> {
  const lines = nextFrame.split('\n')

  for (let col = 0; col <= cols; col++) {
    const frame = lines
      .map(line => {
        return line
          .split('')
          .map((ch, i) => (i < col ? ch : '⠀'))
          .join('')
      })
      .join('\n')
    yield frame
  }
}

// ---------------------------------------------------------------------------
// Dwell progress bar
// ---------------------------------------------------------------------------

/**
 * Returns a single-line braille progress bar string.
 * @param progress  0.0 (full) → 1.0 (empty) — drains left to right
 * @param cols      number of character columns available
 */
export function dwellProgressBar(progress: number, cols: number): string {
  // Each character cell has 2 dot columns, so we get sub-character precision
  const totalDots = cols * 2
  const filledDots = Math.round((1 - progress) * totalDots)

  let bar = ''
  for (let c = 0; c < cols; c++) {
    const leftDot = c * 2 < filledDots
    const rightDot = c * 2 + 1 < filledDots
    // Dots 1+4 = left+right top dot = 0b00001001 = 0x09
    // Dot  1   = left only          = 0b00000001 = 0x01
    // No dots  = blank              = 0x00
    if (leftDot && rightDot) bar += String.fromCodePoint(0x2800 + 0b00001001)
    else if (leftDot)        bar += String.fromCodePoint(0x2800 + 0b00000001)
    else                     bar += '⠀'
  }
  return bar
}
