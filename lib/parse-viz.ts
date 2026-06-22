import type { VisualizationData, ChartType, DataPoint } from './types'

const VALID_CHART_TYPES: ChartType[] = ['line', 'bar', 'sparkline']
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

  if (typeof json.chartType !== 'string' || !VALID_CHART_TYPES.includes(json.chartType as ChartType)) {
    throw new Error(`Invalid chartType: "${json.chartType}". Must be one of: ${VALID_CHART_TYPES.join(', ')}`)
  }
  if (typeof json.title !== 'string' || json.title.trim() === '') {
    throw new Error('Missing or empty "title"')
  }
  if (typeof json.summary !== 'string' || json.summary.trim() === '') {
    throw new Error('Missing or empty "summary"')
  }
  if (!Array.isArray(json.dataPoints) || json.dataPoints.length === 0) {
    throw new Error('Missing or empty "dataPoints" array')
  }
  if (typeof json.musicPrompt !== 'string' || json.musicPrompt.trim() === '') {
    throw new Error('Missing or empty "musicPrompt"')
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
    chartType: json.chartType as ChartType,
    title: json.title.trim(),
    summary: json.summary.trim(),
    dataPoints,
    unit: typeof json.unit === 'string' ? json.unit : undefined,
    musicPrompt: json.musicPrompt.trim(),
  }
}

function extractJson(raw: string): Record<string, unknown> {
  // Try to find a JSON code fence first
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenceMatch ? fenceMatch[1]! : raw

  // Find the outermost { ... } block
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response')
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
  } catch (e) {
    throw new Error(`Failed to parse JSON from model response: ${String(e)}`)
  }
}
