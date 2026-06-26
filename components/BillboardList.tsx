'use client'

import { useRef, useState } from 'react'
import type { BillboardItem } from '@/lib/types'

interface BillboardListProps {
  items: BillboardItem[]
  activeIndex: number
  activeGroupKey: string | null
  onSelect: (index: number) => void
  onDelete: (id: string) => void
  onUploadSprite: (id: string, file: File) => void
  onRemoveSprite: (id: string) => void
  onDownloadGif: (id: string) => void
  onSetGroup: (key: string | null) => void
  fontSize: number
}

/** Human-readable label for a filterKey. '' → 'unfiltered', 'dnd|wiki' → '@dnd @wiki' */
function groupLabel(key: string): string {
  if (key === '') return 'unfiltered'
  return key.split('|').map(k => `@${k}`).join(' ')
}

export function BillboardList({
  items,
  activeIndex,
  activeGroupKey,
  onSelect,
  onDelete,
  onUploadSprite,
  onRemoveSprite,
  onDownloadGif,
  onSetGroup,
  fontSize,
}: BillboardListProps) {
  const sm = fontSize * 0.65
  const xs = fontSize * 0.55

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  // Hidden file input ref — one per list, reused for whichever active item triggers it
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadIdRef = useRef<string | null>(null)

  if (items.length === 0) return null

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

  // Derive unique groups in order of first appearance
  const groupKeys: string[] = []
  for (const item of items) {
    if (!groupKeys.includes(item.filterKey)) groupKeys.push(item.filterKey)
  }
  const hasMultipleGroups = groupKeys.length > 1

  // Items filtered to the active group (for count display); null = all
  const groupCount = (key: string) => items.filter(it => it.filterKey === key).length

  const mono = "'Courier New', monospace"

  return (
    <div
      className="billboard-scroll"
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

      {/* Header row */}
      <div
        style={{
          fontFamily: mono,
          fontSize: `${xs}px`,
          color: '#555555',
          letterSpacing: 2,
          paddingBottom: 4,
          flexShrink: 0,
        }}
      >
        BILLBOARD — {items.length} ITEM{items.length !== 1 ? 'S' : ''}
      </div>

      {/* Group selector — only shown when there are multiple groups */}
      {hasMultipleGroups && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            paddingBottom: 6,
            flexShrink: 0,
          }}
        >
          {/* "ALL" pill */}
          <button
            onClick={() => onSetGroup(null)}
            title="Cycle through all groups"
            style={{
              background: activeGroupKey === null ? '#222222' : 'transparent',
              border: `1px solid ${activeGroupKey === null ? '#555555' : '#333333'}`,
              color: activeGroupKey === null ? '#aaaaaa' : '#555555',
              fontFamily: mono,
              fontSize: `${xs}px`,
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 2,
              letterSpacing: 1,
              transition: 'background 0.2s, border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { if (activeGroupKey !== null) (e.currentTarget as HTMLButtonElement).style.color = '#888888' }}
            onMouseLeave={e => { if (activeGroupKey !== null) (e.currentTarget as HTMLButtonElement).style.color = '#555555' }}
          >
            ALL
          </button>

          {/* One pill per group */}
          {groupKeys.map(key => {
            const isActive = activeGroupKey === key
            return (
              <button
                key={key}
                onClick={() => onSetGroup(key)}
                title={`Cycle ${groupLabel(key)} group (${groupCount(key)} item${groupCount(key) !== 1 ? 's' : ''})`}
                style={{
                  background: isActive ? '#222222' : 'transparent',
                  border: `1px solid ${isActive ? '#555555' : '#333333'}`,
                  color: isActive ? '#aaaaaa' : '#555555',
                  fontFamily: mono,
                  fontSize: `${xs}px`,
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 2,
                  letterSpacing: 1,
                  transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#888888' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#555555' }}
              >
                {groupLabel(key)}
              </button>
            )
          })}
        </div>
      )}

      {/* Item rows — filtered to active group when one is selected */}
      {(() => {
        const rows: React.ReactNode[] = []
        const seenKeys = new Set<string>()
        const visibleItems = activeGroupKey !== null
          ? items.map((item, idx) => ({ item, idx })).filter(({ item }) => item.filterKey === activeGroupKey)
          : items.map((item, idx) => ({ item, idx }))

        visibleItems.forEach(({ item, idx }) => {
          // Insert a group label the first time each key is seen (only when multiple groups)
          if (hasMultipleGroups && !seenKeys.has(item.filterKey)) {
            seenKeys.add(item.filterKey)
            const isGroupActive = activeGroupKey === item.filterKey
            rows.push(
              <div
                key={`group-${item.filterKey}`}
                style={{
                  fontFamily: mono,
                  fontSize: `${xs * 0.9}px`,
                  color: isGroupActive ? '#666666' : '#3a3a3a',
                  letterSpacing: 1,
                  paddingTop: rows.length > 0 ? 4 : 0,
                  paddingBottom: 1,
                  flexShrink: 0,
                  transition: 'color 0.2s',
                }}
              >
                {groupLabel(item.filterKey).toUpperCase()}
              </div>
            )
          }

          const isActive = idx === activeIndex % items.length
          const isHovered = hoveredIdx === idx
          const hasSprite = item.spriteData != null
          rows.push(
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
                    fontFamily: mono,
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
                    fontFamily: mono,
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
                      fontFamily: mono,
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
                        fontFamily: mono,
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
                      fontFamily: mono,
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
                  fontFamily: mono,
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
        })

        return rows
      })()}
    </div>
  )
}
