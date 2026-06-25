'use client'

import { useRef, useState } from 'react'
import type { BillboardItem } from '@/lib/types'

interface BillboardListProps {
  items: BillboardItem[]
  activeIndex: number
  onSelect: (index: number) => void
  onDelete: (id: string) => void
  onUploadSprite: (id: string, file: File) => void
  onRemoveSprite: (id: string) => void
  onDownloadGif: (id: string) => void
  fontSize: number
}

export function BillboardList({ items, activeIndex, onSelect, onDelete, onUploadSprite, onRemoveSprite, onDownloadGif, fontSize }: BillboardListProps) {
  if (items.length === 0) return null

  const sm = fontSize * 0.65
  const xs = fontSize * 0.55

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  // Hidden file input ref — one per list, reused for whichever active item triggers it
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadIdRef = useRef<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const id = pendingUploadIdRef.current
    if (file && id) {
      onUploadSprite(id, file)
    }
    // Reset so the same file can be re-selected after a remove
    e.target.value = ''
    pendingUploadIdRef.current = null
  }

  const triggerUpload = (id: string) => {
    pendingUploadIdRef.current = id
    fileInputRef.current?.click()
  }

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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div
        style={{
          fontFamily: "'Courier New', monospace",
          fontSize: `${xs}px`,
          color: '#555555',
          letterSpacing: 2,
          paddingBottom: 4,
          flexShrink: 0,
        }}
      >
        BILLBOARD — {items.length} ITEM{items.length !== 1 ? 'S' : ''}
      </div>

      {items.map((item, idx) => {
        const isActive = idx === activeIndex % items.length
        const isHovered = hoveredIdx === idx
        const hasSprite = item.spriteData != null
        return (
          <div
            key={item.id}
            onClick={() => onSelect(idx)}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              border: `1px solid ${isActive ? '#4a4a4a' : '#2a2a2a'}`,
              borderRadius: 2,
              background: isActive ? '#111111' : 'transparent',
              transition: 'background 0.3s, border-color 0.3s',
              flexShrink: 0,
              cursor: isActive ? 'default' : 'pointer',
            }}
          >
            {/* Active indicator */}
            <span
              style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: `${xs}px`,
                  color: isActive ? '#888888' : '#555555',
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
                  color: isActive ? '#cccccc' : isHovered ? '#999999' : '#777777',
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

            {/* Upload / remove sprite — active item only */}
            {isActive && (
              <>
                {/* Upload button — shows ⊕ normally, ⊙ when a sprite is already attached */}
                <button
                  onClick={e => { e.stopPropagation(); triggerUpload(item.id) }}
                  title={hasSprite ? 'Replace logo image' : 'Upload logo image'}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: hasSprite ? '#aa8833' : '#555555',
                    fontFamily: "'Courier New', monospace",
                    fontSize: `${xs}px`,
                    cursor: 'pointer',
                    padding: '0 2px',
                    flexShrink: 0,
                    lineHeight: 1,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#cc9933' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = hasSprite ? '#aa8833' : '#555555' }}
                >
                  {hasSprite ? '⊙' : '⊕'}
                </button>

                {/* Remove sprite button — only when a sprite is attached */}
                {hasSprite && (
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveSprite(item.id) }}
                    title="Remove logo image"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#555555',
                      fontFamily: "'Courier New', monospace",
                      fontSize: `${xs}px`,
                      cursor: 'pointer',
                      padding: '0 2px',
                      flexShrink: 0,
                      lineHeight: 1,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#cc6644' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555555' }}
                  >
                    ⊘
                  </button>
                )}

                {/* Download GIF button */}
                <button
                  onClick={e => { e.stopPropagation(); onDownloadGif(item.id) }}
                  title="Download as animated GIF"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#555555',
                    fontFamily: "'Courier New', monospace",
                    fontSize: `${xs}px`,
                    cursor: 'pointer',
                    padding: '0 2px',
                    flexShrink: 0,
                    lineHeight: 1,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4488cc' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555555' }}
                >
                  ⇩
                </button>
              </>
            )}

            {/* Delete button */}
            <button
              onClick={e => { e.stopPropagation(); onDelete(item.id) }}
              title={`Remove "${item.query}"`}
              style={{
                background: 'none',
                border: 'none',
                color: '#555555',
                fontFamily: "'Courier New', monospace",
                fontSize: `${xs}px`,
                cursor: 'pointer',
                padding: '0 2px',
                flexShrink: 0,
                lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#cc4444' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555555' }}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
