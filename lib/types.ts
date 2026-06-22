export type ChartType = 'line' | 'bar' | 'sparkline' | 'text'

export interface DataPoint {
  label: string
  value: number
}

export interface VisualizationData {
  chartType: ChartType
  title: string
  /** One-line plain-text summary shown in the footer */
  summary: string
  /** Present for chart types (line/bar/sparkline) */
  dataPoints: DataPoint[]
  /** Present for chartType "text" — the prose answer rendered as braille */
  words?: string
  /** Optional unit string, e.g. "$", "%", "ms" */
  unit?: string
  /** Natural-language music description for ElevenLabs generation */
  musicPrompt: string
}

/**
 * A single item in the user's billboard playlist.
 * Created when a query completes; chatId enables deletion of the OpenRAG conversation.
 */
export interface BillboardItem {
  id: string
  query: string
  /** chatId returned by OpenRAG — null if the stream didn't return one */
  chatId: string | null
  data: VisualizationData
}

export type BillboardPhase =
  | { phase: 'setup' }
  | { phase: 'idle' }
  | { phase: 'loading'; query: string; tokenCount: number; streamText: string }
  | { phase: 'transitioning'; next: VisualizationData }
  | { phase: 'displaying'; data: VisualizationData; dwellRemaining: number }
  | { phase: 'error'; message: string; query: string }
  | { phase: 'manual'; query: string; tokenCount: number; streamText: string }
