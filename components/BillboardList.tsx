'use client'

import { useRef, useState, useEffect } from 'react'
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
  onAddToPlaylist: (id: string) => void
  onRemoveFromPlaylist: (id: string) => void
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
  onAddToPlaylist,
  onRemoveFromPlaylist,
  fontSize,
}: BillboardListProps) {
  const sm = fontSize * 0.65
  const xs = fontSize * 0.55

  // "Selected" row in the Query tab — drives which item shows sprite controls.
  // Defaults to the active (playing) item; follows it when it changes externally.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Keep selectedId tracking the active item when it changes due to auto-cycle.
  const prevActiveIndexRef = useRef(activeIndex)
  useEffect(() => {
    if (prevActiveIndexRef.current !== activeIndex) {
      prevActiveIndexRef.current = activeIndex
      const item = items[activeIndex]
      if (item) setSelectedId(item.id)
    }
  }, [activeIndex, items])

  // On first load, select the active item.
  useEffect(() => {
    if (selectedId === null && items.length > 0) {
      const item = items[activeIndex]
      if (item) setSelectedId(item.id)
    }
  }, [items, activeIndex, selectedId])

  // Hidden file input ref — one per list, reused for whichever selected item triggers it
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

  const handleRowClick = (idx: number, id: string) => {
    setSelectedId(id)
    onSelect(idx)
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
        QUERY — {items.length} ITEM{items.length !== 1 ? 'S' : ''}
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

          const isPlaying = idx === activeIndex % items.length
          const isSelected = item.id === selectedId
          const hasSprite = item.spriteData != null
          const isInPlaylist = item.playlistOrder !== null

          rows.push(
            <div
              key={item.id}
              onClick={() => handleRowClick(idx, item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 6px',
                border: `1px solid ${isSelected ? '#4a4a4a' : isPlaying ? '#3a3a3a' : '#2a2a2a'}`,
                borderRadius: 2,
                background: isSelected ? '#111111' : 'transparent',
                transition: 'background 0.2s, border-color 0.2s',
                flexShrink: 0,
                cursor: isSelected ? 'default' : 'pointer',
              }}
            >
              {/* Playing indicator — ⠿ when this item is actively cycling on the billboard */}
              <span
                style={{
                  fontFamily: mono,
                  fontSize: `${xs}px`,
                  color: isPlaying ? '#888888' : '#333333',
                  flexShrink: 0,
                  transition: 'color 0.3s',
                }}
                title={isPlaying ? 'Now playing' : undefined}
              >
                {isPlaying ? '⠿' : '·'}
              </span>

              {/* Query label */}
              <span
                style={{
                  fontFamily: mono,
                  fontSize: `${sm}px`,
                  color: isSelected ? '#cccccc' : isPlaying ? '#999999' : '#777777',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  transition: 'color 0.2s',
                }}
                title={item.query}
              >
                {item.query}
              </span>

              {/* ── Controls — visible on selected row ───────────────── */}
              {isSelected && (
                <>
                  {/* Image upload — ▣ when has sprite, ▢ when empty */}
                  <button
                    onClick={e => { e.stopPropagation(); triggerUpload(item.id) }}
                    title={hasSprite ? 'Replace custom image' : 'Upload custom image'}
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
                    {hasSprite ? '▣' : '▢'}
                  </button>

                  {/* Remove sprite — only when one is attached */}
                  {hasSprite && (
                    <button
                      onClick={e => { e.stopPropagation(); onRemoveSprite(item.id) }}
                      title="Remove custom image"
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

                  {/* Download GIF */}
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

              {/* Playlist toggle — ⊕ add / ⊙ remove — always visible */}
              <button
                onClick={e => {
                  e.stopPropagation()
                  if (isInPlaylist) onRemoveFromPlaylist(item.id)
                  else onAddToPlaylist(item.id)
                }}
                title={isInPlaylist ? 'Remove from playlist' : 'Add to playlist'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isInPlaylist ? '#aa8833' : '#444444',
                  fontFamily: mono,
                  fontSize: `${xs}px`,
                  cursor: 'pointer',
                  padding: '0 2px',
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = isInPlaylist ? '#cc9933' : '#888888' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isInPlaylist ? '#aa8833' : '#444444' }}
              >
                {isInPlaylist ? '⊙' : '⊕'}
              </button>

              {/* Delete */}
              <button
                onClick={e => { e.stopPropagation(); onDelete(item.id) }}
                title={`Remove "${item.query}"`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#444444',
                  fontFamily: mono,
                  fontSize: `${xs}px`,
                  cursor: 'pointer',
                  padding: '0 2px',
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#cc4444' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#444444' }}
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
