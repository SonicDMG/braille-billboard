'use client'

interface HeaderProps {
  query: string
  playlistIndex: number
  playlistTotal: number
  onPrev?: () => void
  onNext?: () => void
  fontSize: number
}

export function Header({
  query,
  playlistIndex,
  playlistTotal,
  onPrev,
  onNext,
  fontSize,
}: HeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        fontFamily: "'Courier New', monospace",
        fontSize: `${fontSize}px`,
        color: '#888888',
        gap: 16,
      }}
    >
      {/* Query text */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          color: '#cccccc',
        }}
      >
        {query || '⠀'}
      </div>

      {/* Right side: prev/next + cycle position */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {(onPrev || onNext) && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={onPrev}
              disabled={!onPrev || playlistTotal <= 1}
              title="Previous billboard"
              style={{
                background: 'none',
                border: '1px solid #2a2a2a',
                color: (!onPrev || playlistTotal <= 1) ? '#2a2a2a' : '#555555',
                fontFamily: "'Courier New', monospace",
                fontSize: `${fontSize}px`,
                cursor: (!onPrev || playlistTotal <= 1) ? 'default' : 'pointer',
                padding: '2px 6px',
                borderRadius: 2,
                lineHeight: 1,
              }}
            >
              ‹
            </button>
            <span style={{ color: '#555555', minWidth: '3ch', textAlign: 'center' }}>
              ⠿ {playlistIndex + 1}/{playlistTotal}
            </span>
            <button
              onClick={onNext}
              disabled={!onNext || playlistTotal <= 1}
              title="Next billboard"
              style={{
                background: 'none',
                border: '1px solid #2a2a2a',
                color: (!onNext || playlistTotal <= 1) ? '#2a2a2a' : '#555555',
                fontFamily: "'Courier New', monospace",
                fontSize: `${fontSize}px`,
                cursor: (!onNext || playlistTotal <= 1) ? 'default' : 'pointer',
                padding: '2px 6px',
                borderRadius: 2,
                lineHeight: 1,
              }}
            >
              ›
            </button>
          </div>
        )}
        {!(onPrev || onNext) && (
          <span style={{ color: '#555555' }}>
            ⠿ {playlistIndex + 1}/{playlistTotal}
          </span>
        )}
      </div>
    </div>
  )
}
