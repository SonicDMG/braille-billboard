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
 * Each lit dot in the segment slides in from off-screen right.
 * Columns launch with a staggered cascade (rightmost first) and ease into
 * their rest position. Alpha snaps to 1 once within 1 column of rest.
 * ~20 ticks per segment at full settlement.
 */
export function* flyInEntranceFrames(opts: EntranceOptions): Generator<AlphaMap> {
  const { cols, bounds, litKeys } = opts
  const EASE_K = 0.22
  const LAUNCH_SPREAD = 4

  // Per-column x-offset (float). 0 = settled. Positive = off-screen right.
  const offsets = new Map<number, number>()
  const segKeys = keysInBounds(litKeys, bounds)

  // Determine which columns have content in this segment.
  const activeCols = new Set<number>()
  for (const key of segKeys) {
    const c = parseInt(key.split(',')[1]!, 10)
    activeCols.add(c)
  }

  // Launch all active columns immediately with cascade offset.
  for (const c of activeCols) {
    const cascade = LAUNCH_SPREAD * (cols - c) / Math.max(1, cols)
    offsets.set(c, cols + cascade)
  }

  while (true) {
    const alpha: AlphaMap = new Map()

    for (const c of activeCols) {
      const offset = offsets.get(c) ?? 0
      const remaining = offset
      const newOffset = remaining > 0.5 ? offset - remaining * EASE_K : 0
      offsets.set(c, newOffset)
      const a = newOffset < 1.0 ? 1 : Math.max(0, 1 - (newOffset - 1) / cols)

      for (const key of segKeys) {
        const kc = parseInt(key.split(',')[1]!, 10)
        if (kc === c) alpha.set(key, a)
      }
    }

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
