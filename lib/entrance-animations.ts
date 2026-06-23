/**
 * Entrance animation generators for the dot-matrix billboard display.
 *
 * Each generator yields an AlphaMap — a per-dot brightness map (0–1) for a
 * single segment's row range. The caller (DotMatrixDisplay) multiplies each
 * lit dot's resolved color by the alpha value on every draw tick.
 *
 * All generators are infinite; the caller stops consuming when the segment
 * reaches ≥ 70% of its lit dots at alpha = 1.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** key = "row,col", value = alpha 0–1 */
export type AlphaMap = Map<string, number>

/** Row range for a single contiguous segment band in the lit map. */
export interface SegmentBounds {
  minRow: number
  maxRow: number
}

export interface EntranceOptions {
  cols: number
  rows: number
  /** All lit dot positions and their color descriptors for the full display. */
  litKeys: Set<string>
  /** Row bounds of the segment currently being animated. */
  bounds: SegmentBounds
}

// ---------------------------------------------------------------------------
// deriveSegmentBounds
// ---------------------------------------------------------------------------

/**
 * Scan the lit-map keys to find contiguous bands of content rows.
 * Each gap of ≥ 1 blank rows between content rows starts a new segment bound.
 * Returns one SegmentBounds per contiguous band, in top-to-bottom order.
 */
export function deriveSegmentBounds(
  litKeys: Set<string>,
  rows: number,
): SegmentBounds[] {
  // Build a set of rows that have at least one lit dot.
  const contentRows = new Set<number>()
  for (const key of litKeys) {
    const r = parseInt(key.split(',')[0]!, 10)
    if (!isNaN(r)) contentRows.add(r)
  }

  if (contentRows.size === 0) return []

  const bounds: SegmentBounds[] = []
  let bandStart = -1
  let prevRow = -1

  for (let r = 0; r < rows; r++) {
    if (contentRows.has(r)) {
      if (bandStart === -1) {
        bandStart = r
      }
      prevRow = r
    } else {
      if (bandStart !== -1 && prevRow !== -1) {
        // Gap detected — close the current band.
        bounds.push({ minRow: bandStart, maxRow: prevRow })
        bandStart = -1
        prevRow = -1
      }
    }
  }
  // Close last open band.
  if (bandStart !== -1 && prevRow !== -1) {
    bounds.push({ minRow: bandStart, maxRow: prevRow })
  }

  return bounds
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all lit-map keys within a segment's row range. */
function keysInBounds(litKeys: Set<string>, bounds: SegmentBounds): string[] {
  const result: string[] = []
  for (const key of litKeys) {
    const r = parseInt(key.split(',')[0]!, 10)
    if (r >= bounds.minRow && r <= bounds.maxRow) result.push(key)
  }
  return result
}

// ---------------------------------------------------------------------------
// fly-in
// ---------------------------------------------------------------------------

/**
 * Columns sweep in from right to left.
 * Each column has a birth tick proportional to its distance from the right
 * edge — rightmost columns appear first, leftmost last — producing a clear
 * directional wave. After birth a column fades from 0 → 1 over FADE_TICKS.
 * ~30 ticks per segment at 30 ms ≈ 900 ms total.
 */
export function* flyInEntranceFrames(opts: EntranceOptions): Generator<AlphaMap> {
  const { cols, bounds, litKeys } = opts
  const FADE_TICKS = 5
  // Spread the wave over half the total tick budget so the stagger is obvious.
  const WAVE_TICKS = 20

  const segKeys = keysInBounds(litKeys, bounds)

  // Collect active columns and their content min/max for birth-tick calculation.
  const activeCols = new Set<number>()
  for (const key of segKeys) {
    activeCols.add(parseInt(key.split(',')[1]!, 10))
  }

  const colArr = Array.from(activeCols).sort((a, b) => a - b)
  const minCol = colArr[0] ?? 0
  const maxCol = colArr[colArr.length - 1] ?? cols - 1
  const span = Math.max(1, maxCol - minCol)

  // Rightmost column (maxCol) births at tick 0; leftmost at tick WAVE_TICKS.
  const birthTick = new Map<number, number>()
  for (const c of activeCols) {
    birthTick.set(c, Math.round(WAVE_TICKS * (maxCol - c) / span))
  }

  let tick = 0

  while (true) {
    const alpha: AlphaMap = new Map()

    for (const key of segKeys) {
      const c = parseInt(key.split(',')[1]!, 10)
      const birth = birthTick.get(c) ?? 0
      const age = tick - birth
      const a = age < 0 ? 0 : age >= FADE_TICKS ? 1 : age / FADE_TICKS
      alpha.set(key, a)
    }

    tick++
    yield alpha
  }
}

// ---------------------------------------------------------------------------
// dissolve
// ---------------------------------------------------------------------------

/**
 * All lit dots in the segment fade in simultaneously over 25 ticks.
 */
export function* dissolveEntranceFrames(opts: EntranceOptions): Generator<AlphaMap> {
  const { bounds, litKeys } = opts
  const TICKS = 25
  const segKeys = keysInBounds(litKeys, bounds)
  let tick = 0

  while (true) {
    const a = Math.min(1, tick / TICKS)
    const alpha: AlphaMap = new Map()
    for (const key of segKeys) alpha.set(key, a)
    tick++
    yield alpha
  }
}

// ---------------------------------------------------------------------------
// sparkle
// ---------------------------------------------------------------------------

/**
 * Each lit dot gets a random birth tick in [0, 18]. Before birth it is dark.
 * After birth it flickers for 5 ticks then settles permanently to 1.
 * ~24 ticks total per segment.
 */
export function* sparkleEntranceFrames(opts: EntranceOptions): Generator<AlphaMap> {
  const { bounds, litKeys } = opts
  const BIRTH_WINDOW = 18
  const FLICKER_TICKS = 5
  const segKeys = keysInBounds(litKeys, bounds)

  // Assign a random birth tick and flicker seed to each key.
  const birthTick = new Map<string, number>()
  const flickerSeed = new Map<string, number>()
  for (const key of segKeys) {
    birthTick.set(key, Math.floor(Math.random() * BIRTH_WINDOW))
    flickerSeed.set(key, Math.random())
  }

  let tick = 0

  while (true) {
    const alpha: AlphaMap = new Map()
    for (const key of segKeys) {
      const birth = birthTick.get(key)!
      if (tick < birth) {
        alpha.set(key, 0)
      } else if (tick < birth + FLICKER_TICKS) {
        // Flicker phase — alternate between dim and bright using seed + tick parity
        const flicker = ((tick + Math.floor(flickerSeed.get(key)! * 4)) % 2 === 0) ? 1 : 0.25
        alpha.set(key, flicker)
      } else {
        alpha.set(key, 1)
      }
    }
    tick++
    yield alpha
  }
}

// ---------------------------------------------------------------------------
// typewriter
// ---------------------------------------------------------------------------

/**
 * Dots are revealed left-to-right column by column.
 * 1.5 ticks per column → full reveal in cols * 1.5 ticks ≈ 1 s at 30 ms.
 */
export function* typewriterEntranceFrames(opts: EntranceOptions): Generator<AlphaMap> {
  const { cols, bounds, litKeys } = opts
  const TICKS_PER_COL = 1.5
  const segKeys = keysInBounds(litKeys, bounds)
  let tick = 0

  while (true) {
    const revealedUpToCol = Math.round(tick / TICKS_PER_COL)
    const alpha: AlphaMap = new Map()
    for (const key of segKeys) {
      const c = parseInt(key.split(',')[1]!, 10)
      alpha.set(key, c <= revealedUpToCol ? 1 : 0)
    }
    tick++
    yield alpha
  }
}
