import type { VisualizationData, ChartType, DataPoint } from './types'

const CHART_TYPES: ChartType[] = ['line', 'bar', 'sparkline', 'text']
const MAX_DATA_POINTS = 24

/**
 * Extract and validate a VisualizationData JSON object from a raw model reply.
 * Handles markdown code fences (```json ... ```) and bare JSON objects.
 * Throws a descriptive error for no-data responses ({ "found": false }) and
 * for malformed/missing JSON.
 */
export function parseVisualizationData(raw: string): VisualizationData {
  const json = extractJson(raw)

  // Explicit no-data signal from the model
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
  if (typeof json.musicPrompt !== 'string' || json.musicPrompt.trim() === '') {
    throw new Error('Missing or empty "musicPrompt"')
  }

  const chartType = json.chartType as ChartType

  if (chartType === 'text') {
    // Text responses carry prose in "words"; dataPoints may be empty or absent
    if (typeof json.words !== 'string' || json.words.trim() === '') {
      throw new Error('chartType "text" requires a non-empty "words" field')
    }
    return {
      chartType: 'text',
      title: json.title.trim(),
      summary: json.summary.trim(),
      dataPoints: [],
      words: json.words.trim(),
      musicPrompt: json.musicPrompt.trim(),
    }
  }

  // Chart types require dataPoints
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
    title: json.title.trim(),
    summary: json.summary.trim(),
    dataPoints,
    unit: typeof json.unit === 'string' ? json.unit : undefined,
    musicPrompt: json.musicPrompt.trim(),
  }
}

function extractJson(raw: string): Record<string, unknown> {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenceMatch ? fenceMatch[1]! : raw

  // The model may emit tool-call JSON before the answer, e.g.:
  //   {"search_query":"What is OpenRAG"}{"found":true,...}
  // We scan for every top-level {...} block and return the last one that
  // contains a "found" key — that is always the answer object.
  const blocks = extractTopLevelObjects(candidate)

  // Prefer the last block containing a "found" key (the answer object);
  // fall back to the last block overall so we always try to parse something.
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

/**
 * Extract all top-level {...} blocks from a string by tracking brace depth.
 * Handles nested objects correctly without a full JSON tokeniser.
 */
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
