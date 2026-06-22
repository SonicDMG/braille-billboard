'use client'

import type { BillboardItem } from '@/lib/types'

interface BillboardListProps {
  items: BillboardItem[]
  activeIndex: number
  onDelete: (id: string, chatId: string | null) => void
  fontSize: number
}

export function BillboardList({ items, activeIndex, onDelete, fontSize }: BillboardListProps) {
  if (items.length === 0) return null

  const sm = fontSize * 0.65
  const xs = fontSize * 0.55

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflowY: 'auto',
        maxHeight: '100%',
        paddingBottom: 4,
      }}
    >
      <div
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: `${xs}px`,
          color: '#2a2a2a',
          letterSpacing: 2,
          paddingBottom: 4,
          flexShrink: 0,
        }}
      >
        BILLBOARD — {items.length} ITEM{items.length !== 1 ? 'S' : ''}
      </div>

      {items.map((item, idx) => {
        const isActive = idx === activeIndex % items.length
        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              border: `1px solid ${isActive ? '#333333' : '#1a1a1a'}`,
              borderRadius: 2,
              background: isActive ? '#0d0d0d' : 'transparent',
              transition: 'background 0.3s, border-color 0.3s',
              flexShrink: 0,
            }}
          >
            {/* Active indicator */}
            <span
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: `${xs}px`,
                color: isActive ? '#555555' : '#222222',
                flexShrink: 0,
                transition: 'color 0.3s',
              }}
            >
              {isActive ? '⠿' : '·'}
            </span>

            {/* Query label */}
            <span
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: `${sm}px`,
                color: isActive ? '#888888' : '#444444',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                transition: 'color 0.3s',
              }}
              title={item.query}
            >
              {item.query}
            </span>

            {/* Delete button */}
            <button
              onClick={() => onDelete(item.id, item.chatId)}
              title={`Remove "${item.query}"`}
              style={{
                background: 'none',
                border: 'none',
                color: '#333333',
                fontFamily: "'Courier New', monospace",
                fontSize: `${xs}px`,
                cursor: 'pointer',
                padding: '0 2px',
                flexShrink: 0,
                lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#cc4444' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#333333' }}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
