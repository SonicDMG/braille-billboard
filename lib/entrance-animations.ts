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
 * Dots are revealed row by row (one full text line at a time), left-to-right
 * within each row. Each dot row is fully revealed in a single tick (30 ms),
 * so the whole segment sweeps through quickly line by line.
 */
export function* typewriterEntranceFrames(opts: EntranceOptions): Generator<AlphaMap> {
  const { bounds, litKeys } = opts
  const segKeys = keysInBounds(litKeys, bounds)

  // Collect all distinct rows that have lit dots, sorted top→bottom.
  const rowSet = new Set<number>()
  for (const key of segKeys) {
    rowSet.add(parseInt(key.split(',')[0]!, 10))
  }
  const rows = Array.from(rowSet).sort((a, b) => a - b)

  let tick = 0

  while (true) {
    // One full row is revealed per tick.
    const revealedUpToRowIdx = tick
    const alpha: AlphaMap = new Map()
    for (const key of segKeys) {
      const r = parseInt(key.split(',')[0]!, 10)
      const rowIdx = rows.indexOf(r)
      alpha.set(key, rowIdx <= revealedUpToRowIdx ? 1 : 0)
    }
    tick++
    yield alpha
  }
}

// ---------------------------------------------------------------------------
// exploding
// ---------------------------------------------------------------------------

/**
 * Starts with only the centre dots lit, then radiates outward in all
 * directions simultaneously. Each dot's birth tick is proportional to its
 * distance from the centroid, with small random jitter so the wave front
 * breaks into individual sparks rather than a smooth ring.
 * Hard snap-on per dot — no fade — so each spark feels like an impact.
 * ~12 ticks total per segment at 30 ms ≈ ~360 ms.
 */
export function* explodingEntranceFrames(opts: EntranceOptions): Generator<AlphaMap> {
  const { bounds, litKeys } = opts
  // Ticks for the wave to travel from the centroid to the furthest dot.
  const SWEEP_TICKS = 10
  // Max random offset applied to each dot's nominal birth tick (±JITTER).
  // Kept small so the radial wave is still readable but the edge is ragged.
  const JITTER = 2

  const segKeys = keysInBounds(litKeys, bounds)

  // Compute centroid of all lit dots in the segment.
  let sumR = 0, sumC = 0
  for (const key of segKeys) {
    const [rs, cs] = key.split(',')
    sumR += parseInt(rs!, 10)
    sumC += parseInt(cs!, 10)
  }
  const n = segKeys.length || 1
  const centR = sumR / n
  const centC = sumC / n

  // Compute max distance for normalisation.
  let maxDist = 0
  for (const key of segKeys) {
    const [rs, cs] = key.split(',')
    const dr = parseInt(rs!, 10) - centR
    const dc = parseInt(cs!, 10) - centC
    const d = Math.sqrt(dr * dr + dc * dc)
    if (d > maxDist) maxDist = d
  }
  if (maxDist === 0) maxDist = 1

  // Assign each dot a birth tick: 0 at centroid, SWEEP_TICKS at edge, ±JITTER noise.
  const birthTick = new Map<string, number>()
  for (const key of segKeys) {
    const [rs, cs] = key.split(',')
    const dr = parseInt(rs!, 10) - centR
    const dc = parseInt(cs!, 10) - centC
    const d = Math.sqrt(dr * dr + dc * dc)
    const nominal = Math.round(SWEEP_TICKS * (d / maxDist))
    const jitter = Math.floor(Math.random() * (JITTER * 2 + 1)) - JITTER
    birthTick.set(key, Math.max(0, nominal + jitter))
  }

  let tick = 0

  while (true) {
    const alpha: AlphaMap = new Map()
    for (const key of segKeys) {
      // Dot is dark until its birth tick, then snaps on instantly.
      alpha.set(key, tick >= birthTick.get(key)! ? 1 : 0)
    }
    tick++
    yield alpha
  }
}

// ---------------------------------------------------------------------------
// tetris
// ---------------------------------------------------------------------------

/**
 * Dots drop into place column by column, left to right. Within each column,
 * dots light up top-to-bottom one row at a time — mimicking a Tetris piece
 * falling and stacking. A new column starts every COL_STRIDE ticks; rows
 * within the column are revealed one per tick, so the drop is visible.
 * ~total ticks ≈ numCols * COL_STRIDE + numRows at 30 ms each — halved for speed.
 */
export function* tetrisEntranceFrames(opts: EntranceOptions): Generator<AlphaMap> {
  const { bounds, litKeys } = opts
  // Ticks between starting each successive column's drop — 2 for double speed.
  const COL_STRIDE = 2

  const segKeys = keysInBounds(litKeys, bounds)

  // Collect active columns sorted left → right.
  const colSet = new Set<number>()
  for (const key of segKeys) colSet.add(parseInt(key.split(',')[1]!, 10))
  const sortedCols = Array.from(colSet).sort((a, b) => a - b)

  // For each dot: birth tick = colIdx * COL_STRIDE + rowRank within that column.
  // rowRank is 0 for the topmost lit dot in the column, increasing downward.
  // Build rowRank per column.
  const colRows = new Map<number, number[]>()
  for (const key of segKeys) {
    const c = parseInt(key.split(',')[1]!, 10)
    const r = parseInt(key.split(',')[0]!, 10)
    const arr = colRows.get(c) ?? []
    arr.push(r)
    colRows.set(c, arr)
  }
  // Sort each column's rows top → bottom.
  for (const [c, rows] of colRows) colRows.set(c, rows.sort((a, b) => a - b))

  const birthTick = new Map<string, number>()
  for (const key of segKeys) {
    const c = parseInt(key.split(',')[1]!, 10)
    const r = parseInt(key.split(',')[0]!, 10)
    const colIdx = sortedCols.indexOf(c)
    const rowRank = colRows.get(c)!.indexOf(r)
    birthTick.set(key, colIdx * COL_STRIDE + rowRank)
  }

  let tick = 0

  while (true) {
    const alpha: AlphaMap = new Map()
    for (const key of segKeys) {
      const birth = birthTick.get(key)!
      // Snap on instantly when born — no fade, hard landing like a piece placing.
      alpha.set(key, tick >= birth ? 1 : 0)
    }
    tick++
    yield alpha
  }
}
