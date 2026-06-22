'use client'

interface BrailleDisplayProps {
  frame: string
  fontSize: number
  color?: string
}

export function BrailleDisplay({ frame, fontSize, color = '#ffffff' }: BrailleDisplayProps) {
  return (
    <pre
      style={{
        fontFamily: "'Courier New', 'DejaVu Sans Mono', monospace",
        fontSize: `${fontSize}px`,
        lineHeight: 1,
        color,
        margin: 0,
        padding: 0,
        whiteSpace: 'pre',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {frame}
    </pre>
  )
}
