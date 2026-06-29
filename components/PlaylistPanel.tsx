'use client'

import { useRef, useState } from 'react'
import type { BillboardItem } from '@/lib/types'

interface PlaylistPanelProps {
  items: BillboardItem[]
  activeIndex: number
  onSelect: (index: number) => void
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onReorder: (orderedIds: string[]) => void
  onExportGif: () => void
  exportingGif: boolean
  exportProgress: { done: number; total: number } | null
  encodeProgress: number | null
  fontSize: number
}

export function PlaylistPanel({
  items,
  activeIndex,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
  onReorder,
  onExportGif,
  exportingGif,
  exportProgress,
  encodeProgress,
  fontSize,
}: PlaylistPanelProps) {
  const sm = fontSize * 0.65
  const xs = fontSize * 0.55
  const mono = "'Courier New', monospace"

  // Derive the ordered playlist from items
  const playlist = items
    .filter(it => it.playlistOrder !== null)
    .sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0))

  // ── Drag-and-drop state ────────────────────────────────────────────────────
  const dragIdRef = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below'>('below')

  const handleDragStart = (id: string, e: React.DragEvent) => {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (id: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDragOverId(id)
    setDragOverPos(e.clientY < midY ? 'above' : 'below')
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = (targetId: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const srcId = dragIdRef.current
    dragIdRef.current = null
    setDragOverId(null)
    if (!srcId || srcId === targetId) return

    const ids = playlist.map(it => it.id)
    const srcIdx = ids.indexOf(srcId)
    const tgtIdx = ids.indexOf(targetId)
    if (srcIdx === -1 || tgtIdx === -1) return

    // Remove src from list, insert before or after target
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const insertAfter = e.clientY >= midY

    ids.splice(srcIdx, 1)
    const newTgt = ids.indexOf(targetId)
    ids.splice(insertAfter ? newTgt + 1 : newTgt, 0, srcId)
    onReorder(ids)
  }

  const handleDragEnd = () => {
    dragIdRef.current = null
    setDragOverId(null)
  }

  const exportLabel = exportingGif && encodeProgress !== null
    ? `⠿ RENDERING ${Math.round(encodeProgress * 100)}%`
    : exportingGif && exportProgress
      ? `⠿ ENCODING ${exportProgress.done}/${exportProgress.total}`
      : exportingGif
        ? '⠿ ENCODING...'
        : '⠾ EXPORT GIF'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        gap: 4,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: mono,
          fontSize: `${xs}px`,
          color: '#555555',
          letterSpacing: 2,
          flexShrink: 0,
          paddingBottom: 4,
        }}
      >
        PLAYLIST — {playlist.length} ITEM{playlist.length !== 1 ? 'S' : ''}
      </div>

      {/* List */}
      <div
        className="billboard-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {playlist.length === 0 ? (
          <div
            style={{
              fontFamily: mono,
              fontSize: `${xs}px`,
              color: '#444444',
              padding: '8px 0',
              letterSpacing: 1,
            }}
          >
            ⠠ EMPTY — add items from the QUERY tab
          </div>
        ) : (
          playlist.map((item, pos) => {
            const globalIdx = items.indexOf(item)
            const isActive = globalIdx === activeIndex
            const isFirst = pos === 0
            const isLast = pos === playlist.length - 1
            const isDragOver = dragOverId === item.id

            return (
              <div
                key={item.id}
                draggable
                onDragStart={e => handleDragStart(item.id, e)}
                onDragOver={e => handleDragOver(item.id, e)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(item.id, e)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelect(globalIdx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 6px',
                  border: `1px solid ${isActive ? '#4a4a4a' : '#2a2a2a'}`,
                  borderRadius: 2,
                  background: isActive ? '#111111' : 'transparent',
                  outline: isDragOver
                    ? `1px solid #555555`
                    : 'none',
                  outlineOffset: isDragOver && dragOverPos === 'above' ? '-1px' : '-1px',
                  boxShadow: isDragOver
                    ? dragOverPos === 'above'
                      ? 'inset 0 2px 0 #666666'
                      : 'inset 0 -2px 0 #666666'
                    : 'none',
                  transition: 'background 0.3s, border-color 0.3s',
                  flexShrink: 0,
                  cursor: 'grab',
                }}
              >
                {/* Drag handle */}
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: `${xs * 0.85}px`,
                    color: '#333333',
                    flexShrink: 0,
                    cursor: 'grab',
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                  title="Drag to reorder"
                >
                  ⠿⠿
                </span>

                {/* Position number */}
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: `${xs}px`,
                    color: '#444444',
                    flexShrink: 0,
                    minWidth: `${xs * 1.6}px`,
                    textAlign: 'right',
                  }}
                >
                  {pos + 1}
                </span>

                {/* Active indicator */}
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: `${xs}px`,
                    color: isActive ? '#888888' : '#333333',
                    flexShrink: 0,
                  }}
                >
                  {isActive ? '⠿' : '·'}
                </span>

                {/* Query label */}
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: `${sm}px`,
                    color: isActive ? '#cccccc' : '#777777',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={item.query}
                >
                  {item.query}
                </span>

                {/* ↑ button */}
                <button
                  onClick={e => { e.stopPropagation(); if (!isFirst) onMoveUp(item.id) }}
                  title="Move up"
                  disabled={isFirst}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isFirst ? '#2a2a2a' : '#555555',
                    fontFamily: mono,
                    fontSize: `${xs}px`,
                    cursor: isFirst ? 'default' : 'pointer',
                    padding: '0 1px',
                    flexShrink: 0,
                    lineHeight: 1,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { if (!isFirst) (e.currentTarget as HTMLButtonElement).style.color = '#aaaaaa' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isFirst ? '#2a2a2a' : '#555555' }}
                >
                  ↑
                </button>

                {/* ↓ button */}
                <button
                  onClick={e => { e.stopPropagation(); if (!isLast) onMoveDown(item.id) }}
                  title="Move down"
                  disabled={isLast}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isLast ? '#2a2a2a' : '#555555',
                    fontFamily: mono,
                    fontSize: `${xs}px`,
                    cursor: isLast ? 'default' : 'pointer',
                    padding: '0 1px',
                    flexShrink: 0,
                    lineHeight: 1,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { if (!isLast) (e.currentTarget as HTMLButtonElement).style.color = '#aaaaaa' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isLast ? '#2a2a2a' : '#555555' }}
                >
                  ↓
                </button>

                {/* Remove from playlist */}
                <button
                  onClick={e => { e.stopPropagation(); onRemove(item.id) }}
                  title="Remove from playlist"
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
        )}
      </div>

      {/* Export GIF button */}
      <button
        onClick={onExportGif}
        disabled={exportingGif || playlist.length === 0}
        style={{
          background: 'none',
          border: `1px solid ${exportingGif || playlist.length === 0 ? '#2a2a2a' : '#3a3a3a'}`,
          color: exportingGif ? '#888888' : playlist.length === 0 ? '#333333' : '#666666',
          fontFamily: mono,
          fontSize: `${xs}px`,
          cursor: exportingGif || playlist.length === 0 ? 'default' : 'pointer',
          padding: '4px 8px',
          borderRadius: 2,
          letterSpacing: 1,
          flexShrink: 0,
          transition: 'color 0.15s, border-color 0.15s',
          textAlign: 'left',
        }}
        onMouseEnter={e => {
          if (!exportingGif && playlist.length > 0) {
            (e.currentTarget as HTMLButtonElement).style.color = '#aaaaaa'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#555555'
          }
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.color = exportingGif ? '#888888' : playlist.length === 0 ? '#333333' : '#666666'
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = exportingGif || playlist.length === 0 ? '#2a2a2a' : '#3a3a3a'
        }}
      >
        {exportLabel}
      </button>
    </div>
  )
}
