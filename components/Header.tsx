'use client'

interface HeaderProps {
  query: string
  playlistIndex: number
  playlistTotal: number
  musicEnabled: boolean
  onMusicToggle: () => void
  fontSize: number
}

export function Header({
  query,
  playlistIndex,
  playlistTotal,
  musicEnabled,
  onMusicToggle,
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

      {/* Right side: cycle position + music toggle */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: '#555555' }}>
          ⠿ {playlistIndex + 1}/{playlistTotal}
        </span>
        <button
          onClick={onMusicToggle}
          style={{
            background: 'none',
            border: `1px solid ${musicEnabled ? '#666666' : '#333333'}`,
            color: musicEnabled ? '#aaaaaa' : '#444444',
            fontFamily: "'Courier New', monospace",
            fontSize: `${fontSize}px`,
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: 2,
            letterSpacing: 1,
          }}
        >
          ♪ {musicEnabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  )
}
