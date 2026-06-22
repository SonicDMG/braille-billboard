export type ChartType = 'line' | 'bar' | 'sparkline'

export interface DataPoint {
  label: string
  value: number
}

export interface VisualizationData {
  chartType: ChartType
  title: string
  /** One-line plain-text summary shown in the footer */
  summary: string
  dataPoints: DataPoint[]
  /** Optional unit string, e.g. "$", "%", "ms" */
  unit?: string
  /** Natural-language music description for ElevenLabs generation */
  musicPrompt: string
}

export type BillboardPhase =
  | { phase: 'setup' }
  | { phase: 'idle' }
  | { phase: 'loading'; query: string }
  | { phase: 'transitioning'; next: VisualizationData }
  | { phase: 'displaying'; data: VisualizationData; dwellRemaining: number }
  | { phase: 'error'; message: string; query: string }
  | { phase: 'manual'; query: string }
