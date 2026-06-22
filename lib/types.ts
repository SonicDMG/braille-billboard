export type ChartType = 'line' | 'bar' | 'sparkline' | 'text'

export interface DataPoint {
  label: string
  value: number
}

// ---------------------------------------------------------------------------
// Dot color descriptors
// ---------------------------------------------------------------------------

/** Solid fill — every dot in the segment is the same color. */
export interface DotColorSolid {
  type: 'solid'
  /** CSS hex string, e.g. "#ff6600". Named colors are resolved in parse-viz. */
  hex: string
}

/**
 * Rainbow — hue cycles continuously across the horizontal dot position
 * of the entire rendered display, so the rainbow spans the full width
 * regardless of word boundaries.
 */
export interface DotColorRainbow {
  type: 'rainbow'
}

/**
 * Linear gradient — color interpolates from `from` to `to` across the
 * leftmost to rightmost rendered dot column of this segment.
 */
export interface DotColorGradient {
  type: 'gradient'
  from: string  // CSS hex
  to: string    // CSS hex
}

export type DotColor = DotColorSolid | DotColorRainbow | DotColorGradient

// ---------------------------------------------------------------------------
// Billboard segment
// ---------------------------------------------------------------------------

/**
 * A single block of billboard copy with its own display row(s) and dot color.
 * Each segment starts on a new row group in the dot-matrix display.
 */
export interface BillboardSegment {
  text: string
  color: DotColor
}

// ---------------------------------------------------------------------------
// Visualization data
// ---------------------------------------------------------------------------

export interface VisualizationData {
  chartType: ChartType
  title: string
  /** One-line plain-text summary shown in the footer */
  summary: string
  /** Present for chart types (line/bar/sparkline) */
  dataPoints: DataPoint[]
  /**
   * Billboard copy split into 1–3 display segments.
   * Each segment starts on its own row group and is drawn with its dot color.
   * Always populated for chartType "text".
   */
  segments?: BillboardSegment[]
  /** Legacy flat copy — kept for backward compat; prefer segments */
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
  /** Base64-encoded mp3 generated at query time — null if unavailable */
  audioB64: string | null
}

export type BillboardPhase =
  | { phase: 'setup' }
  | { phase: 'idle' }
  | { phase: 'loading'; query: string; tokenCount: number; streamText: string }
  | { phase: 'transitioning'; next: VisualizationData; audioB64: string | null }
  | { phase: 'displaying'; data: VisualizationData; dwellRemaining: number }
  | { phase: 'error'; message: string; query: string }
  | { phase: 'manual'; query: string; tokenCount: number; streamText: string }
