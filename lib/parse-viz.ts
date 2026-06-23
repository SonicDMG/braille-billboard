import type { VisualizationData, ChartType, DataPoint, BillboardSegment, DotColor, EntranceStyle } from './types'

const CHART_TYPES: ChartType[] = ['line', 'bar', 'sparkline', 'text']
const VALID_ENTRANCE_STYLES = new Set<string>(['fly-in', 'dissolve', 'sparkle', 'typewriter'])
const MAX_DATA_POINTS = 24

// Word budget — mirrors the hard caps in the LLM prompt.
const MAX_WORDS_BODY    = 25   // body segment(s)
const MAX_WORDS_TAGLINE = 8    // middle tagline segment (optional)
const MAX_WORDS_SUBJECT = 3    // final subject-name segment
const MAX_WORDS_TOTAL   = 35   // across all segments combined

/** Truncate to at most `limit` words, appending "…" if cut. */
function truncateWords(text: string, limit: number): string {
  const words = text.split(/\s+/)
  if (words.length <= limit) return text
  return words.slice(0, limit).join(' ') + '…'
}

// ---------------------------------------------------------------------------
// Named color table — lets the LLM use plain words instead of hex codes
// ---------------------------------------------------------------------------
const NAMED_COLORS: Record<string, string> = {
  amber:   '#ff6600',
  orange:  '#ff8800',
  red:     '#ff2200',
  yellow:  '#ffee00',
  lime:    '#aaff00',
  green:   '#00ff66',
  cyan:    '#00ffee',
  blue:    '#0088ff',
  indigo:  '#4400ff',
  violet:  '#aa00ff',
  purple:  '#cc00cc',
  pink:    '#ff44aa',
  white:   '#ffffff',
  gold:    '#ffd700',
  teal:    '#00ccaa',
}

/** Resolve a color string to a validated lowercase hex, or null if unrecognisable. */
function resolveHex(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  if (NAMED_COLORS[s]) return NAMED_COLORS[s]!
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) {
    // Expand shorthand #rgb → #rrggbb
    return '#' + s[1]! + s[1]! + s[2]! + s[2]! + s[3]! + s[3]!
  }
  return null
}

// ---------------------------------------------------------------------------
// LLM artifact scrubber
// ---------------------------------------------------------------------------

/**
 * Strip LLM artifacts from a display string:
 *   - Citation markers: (source…), [source…], (Source 1), etc.
 *   - Unfilled template placeholders: {}, {var}, {{var}}
 * Collapses any resulting double-spaces and trims.
 */
function cleanText(s: string): string {
  return s
    .replace(/[\[(][^\])\n]*?\bsource[^\])\n]*?[\])]/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\{[^}\n]*\}/g, '')
    .replace(/  +/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Color parsing
// ---------------------------------------------------------------------------

const COLOR_AMBER: DotColor = { type: 'solid', hex: '#ff6600' }
const COLOR_WHITE: DotColor = { type: 'solid', hex: '#ffffff' }

/**
 * Parse a color descriptor from the model JSON.
 * Accepts:
 *   { "type": "solid",    "hex": "red" | "#ff0000" }
 *   { "type": "rainbow" }
 *   { "type": "gradient", "from": "red", "to": "blue" }
 * Falls back to `fallback` on any parse failure.
 */
function parseDotColor(raw: unknown, fallback: DotColor): DotColor {
  if (typeof raw !== 'object' || raw === null) return fallback
  const c = raw as Record<string, unknown>

  if (c['type'] === 'rainbow') return { type: 'rainbow' }

  if (c['type'] === 'gradient') {
    const from = typeof c['from'] === 'string' ? resolveHex(c['from']) : null
    const to   = typeof c['to']   === 'string' ? resolveHex(c['to'])   : null
    if (from && to) return { type: 'gradient', from, to }
    return fallback
  }

  if (c['type'] === 'solid' || typeof c['hex'] === 'string') {
    const hex = typeof c['hex'] === 'string' ? resolveHex(c['hex']) : null
    if (hex) return { type: 'solid', hex }
  }

  return fallback
}

// ---------------------------------------------------------------------------
// Segment parsing
// ---------------------------------------------------------------------------

/**
 * Parse and validate the segments array from the model JSON.
 * Supports both the new `color` field and the legacy `emphasis` field.
 * Returns null if the value is absent or structurally invalid.
 */
function parseSegments(raw: unknown): BillboardSegment[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const result: BillboardSegment[] = []

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null
    const s = item as Record<string, unknown>
    if (typeof s['text'] !== 'string' || s['text'].trim() === '') return null

    const text = cleanText(s['text'] as string)
    if (!text) continue

    // Resolve color: prefer `color` field, fall back to legacy `emphasis`
    let color: DotColor
    if (s['color'] !== undefined) {
      color = parseDotColor(s['color'], COLOR_AMBER)
    } else if (s['emphasis'] === 'high') {
      color = COLOR_WHITE
    } else {
      color = COLOR_AMBER
    }

    result.push({ text, color })
  }

  if (result.length === 0) return null

  // Apply per-segment word caps.
  // - Last segment: subject name (≤3 words)
  // - Second-to-last in a 3-segment response: tagline (≤8 words)
  // - All others: body copy (≤25 words)
  const capped = result.map((seg, i) => {
    const isLast = i === result.length - 1
    const isTagline = result.length >= 3 && i === result.length - 2
    const limit = isLast ? MAX_WORDS_SUBJECT
      : isTagline ? MAX_WORDS_TAGLINE
      : MAX_WORDS_BODY
    return { ...seg, text: truncateWords(seg.text, limit) }
  })

  // Apply total word budget across all segments combined.
  let remaining = MAX_WORDS_TOTAL
  const budgeted = capped.map(seg => {
    const words = seg.text.split(/\s+/)
    const allowed = Math.min(words.length, remaining)
    remaining -= allowed
    const text = allowed < words.length
      ? words.slice(0, allowed).join(' ') + '…'
      : seg.text
    return { ...seg, text }
  }).filter(seg => seg.text.trim().length > 0)

  return budgeted.length > 0 ? budgeted : null
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Extract and validate a VisualizationData JSON object from a raw model reply.
 * Handles markdown code fences (```json ... ```) and bare JSON objects.
 * Throws a descriptive error for no-data responses ({ "found": false }) and
 * for malformed/missing JSON.
 */
export function parseVisualizationData(raw: string): VisualizationData {
  const json = extractJson(raw)

  if (json.found === false) {
    const reason = typeof json.reason === 'string' ? json.reason : 'No relevant data found in documents'
    throw new Error(`No data: ${reason}`)
  }

  if (typeof json.chartType !== 'string' || !CHART_TYPES.includes(json.chartType as ChartType)) {
    throw new Error(`Invalid chartType: "${json.chartType}". Must be one of: ${CHART_TYPES.join(', ')}`)
  }
  if (typeof json.title !== 'string' || json.title.trim() === '') {
    throw new Error('Missing or empty "title"')
  }
  if (typeof json.summary !== 'string' || json.summary.trim() === '') {
    throw new Error('Missing or empty "summary"')
  }

  const chartType = json.chartType as ChartType

  if (chartType === 'text') {
    const segments =
      parseSegments(json.segments) ??
      (typeof json.words === 'string' && json.words.trim()
        ? [{ text: cleanText(json.words as string), color: COLOR_AMBER }]
        : null)

    if (!segments) {
      throw new Error('chartType "text" requires a non-empty "segments" or "words" field')
    }

    return {
      chartType: 'text',
      title: cleanText(json.title as string),
      summary: cleanText(json.summary as string),
      dataPoints: [],
      segments,
      words: segments.map(s => s.text).join(' '),
      entranceStyle: parseEntranceStyle(json.entranceStyle),
    }
  }

  if (!Array.isArray(json.dataPoints) || json.dataPoints.length === 0) {
    throw new Error('Missing or empty "dataPoints" array')
  }

  const dataPoints: DataPoint[] = (json.dataPoints as unknown[])
    .slice(0, MAX_DATA_POINTS)
    .map((pt, i) => {
      if (typeof pt !== 'object' || pt === null) throw new Error(`dataPoints[${i}] is not an object`)
      const p = pt as Record<string, unknown>
      if (typeof p['label'] !== 'string') throw new Error(`dataPoints[${i}].label must be a string`)
      if (typeof p['value'] !== 'number') throw new Error(`dataPoints[${i}].value must be a number`)
      return { label: p['label'], value: p['value'] }
    })

  return {
    chartType,
    title: cleanText(json.title as string),
    summary: cleanText(json.summary as string),
    dataPoints,
    unit: typeof json.unit === 'string' ? json.unit : undefined,
    entranceStyle: parseEntranceStyle(json.entranceStyle),
  }
}

function parseEntranceStyle(raw: unknown): EntranceStyle {
  if (typeof raw === 'string' && VALID_ENTRANCE_STYLES.has(raw)) {
    return raw as EntranceStyle
  }
  return 'dissolve'
}

// ---------------------------------------------------------------------------
// JSON extraction helpers
// ---------------------------------------------------------------------------

function extractJson(raw: string): Record<string, unknown> {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenceMatch ? fenceMatch[1]! : raw

  const blocks = extractTopLevelObjects(candidate)

  const answerBlock =
    [...blocks].reverse().find(b => b.includes('"found"'))
    ?? blocks[blocks.length - 1]

  if (!answerBlock) {
    throw new Error('No JSON object found in model response')
  }

  try {
    return JSON.parse(answerBlock) as Record<string, unknown>
  } catch (e) {
    throw new Error(`Failed to parse JSON from model response: ${String(e)}`)
  }
}

function extractTopLevelObjects(text: string): string[] {
  const results: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!

    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        results.push(text.slice(start, i + 1))
        start = -1
      }
    }
  }

  return results
}
