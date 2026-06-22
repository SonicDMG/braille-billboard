'use client'

import { dwellProgressBar } from '@/lib/braille-animations'

interface FooterProps {
  summary: string
  dwellRemaining: number
  dwellTotal: number
  cols: number
  fontSize: number
}

export function Footer({ summary, dwellRemaining, dwellTotal, cols, fontSize }: FooterProps) {
  const progress = dwellTotal > 0 ? 1 - dwellRemaining / dwellTotal : 0
  const bar = dwellProgressBar(progress, cols)

  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize: `${fontSize}px`, color: '#aaaaaa' }}>
      <div
        style={{
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          marginBottom: 2,
        }}
      >
        {summary}
      </div>
      <pre style={{ margin: 0, lineHeight: 1, color: '#555555', userSelect: 'none' }} suppressHydrationWarning>
        {bar}
      </pre>
    </div>
  )
}
