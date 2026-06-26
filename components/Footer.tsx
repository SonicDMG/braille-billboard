'use client'

import { useEffect, useState } from 'react'
import { dwellProgressBar, dotsFrames } from '@/lib/braille-animations'

interface FooterProps {
  summary: string
  isLoading?: boolean
  dwellRemaining: number
  dwellTotal: number
  cols: number
  fontSize: number
  onAsk?: () => void
}

export function Footer({ summary, isLoading, dwellRemaining, dwellTotal, cols, fontSize, onAsk }: FooterProps) {
  const progress = dwellTotal > 0 ? 1 - dwellRemaining / dwellTotal : 0
  const bar = dwellProgressBar(progress, cols)

  const [spinnerFrame, setSpinnerFrame] = useState('⠀⠀⠀')

  useEffect(() => {
    if (!isLoading) return
    const gen = dotsFrames()
    const id = setInterval(() => {
      setSpinnerFrame(gen.next().value as string)
    }, 120)
    return () => clearInterval(id)
  }, [isLoading])

  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize: `${fontSize}px`, color: '#aaaaaa' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          overflow: 'hidden',
          marginBottom: 2,
          gap: 16,
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {isLoading
            ? <>{summary.replace(/\.{3}$/, '')}<span style={{ position: 'relative', top: -5 }}>{spinnerFrame}</span></>
            : summary}
        </div>
        {onAsk && (
          <button
            onClick={onAsk}
            style={{
              background: 'none',
              border: '1px solid #444444',
              color: '#666666',
              fontFamily: "'Courier New', monospace",
              fontSize: `${fontSize * 0.8}px`,
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 2,
              letterSpacing: 1,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            ⠿ ASK [/]
          </button>
        )}
      </div>
      <pre style={{ margin: 0, lineHeight: 1, color: '#555555', userSelect: 'none' }} suppressHydrationWarning>
        {bar}
      </pre>
    </div>
  )
}
