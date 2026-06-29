'use client'

import { useState } from 'react'
import { SplashPanel } from './SplashPanel'
import { PlaylistPanel } from './PlaylistPanel'
import type { BillboardItem } from '@/lib/types'

type ActiveTab = 'query' | 'playlist'

interface LeftPanelProps {
  fontSize: number
  mode: 'splash' | 'split' | 'full'
  onToggleCollapse: () => void
  // QUERY tab
  onSubmit: (query: string) => void
  isLoading: boolean
  streamEnergy: number
  billboardList: React.ReactNode
  // PLAYLIST tab
  items: BillboardItem[]
  activeIndex: number
  onSelectPlaylistItem: (index: number) => void
  onRemoveFromPlaylist: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onReorderPlaylist: (orderedIds: string[]) => void
  onExportGif: () => void
  exportingGif: boolean
  exportProgress: { done: number; total: number } | null
  encodeProgress: number | null
}

export function LeftPanel({
  fontSize,
  mode,
  onToggleCollapse,
  onSubmit,
  isLoading,
  streamEnergy,
  billboardList,
  items,
  activeIndex,
  onSelectPlaylistItem,
  onRemoveFromPlaylist,
  onMoveUp,
  onMoveDown,
  onReorderPlaylist,
  onExportGif,
  exportingGif,
  exportProgress,
  encodeProgress,
}: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('query')
  const mono = "'Courier New', monospace"
  const xs = fontSize * 0.55

  const playlistCount = items.filter(it => it.playlistOrder !== null).length

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar + collapse button row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: mode === 'splash'
            ? `${fontSize * 1.5}px ${fontSize}px ${fontSize * 0.5}px`
            : `${fontSize * 0.5}px ${fontSize * 0.5}px ${fontSize * 0.25}px`,
          flexShrink: 0,
          transition: 'padding 0.55s',
        }}
      >
        {/* QUERY tab */}
        <button
          onClick={() => setActiveTab('query')}
          style={{
            background: 'none',
            border: `1px solid ${activeTab === 'query' ? '#555555' : '#2a2a2a'}`,
            color: activeTab === 'query' ? '#aaaaaa' : '#444444',
            fontFamily: mono,
            fontSize: `${xs}px`,
            cursor: 'pointer',
            padding: '2px 7px',
            borderRadius: 2,
            letterSpacing: 1,
            transition: 'color 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => { if (activeTab !== 'query') (e.currentTarget as HTMLButtonElement).style.color = '#777777' }}
          onMouseLeave={e => { if (activeTab !== 'query') (e.currentTarget as HTMLButtonElement).style.color = '#444444' }}
        >
          ⠿ QUERY
        </button>

        {/* PLAYLIST tab */}
        <button
          onClick={() => setActiveTab('playlist')}
          style={{
            background: 'none',
            border: `1px solid ${activeTab === 'playlist' ? '#555555' : '#2a2a2a'}`,
            color: activeTab === 'playlist' ? '#aaaaaa' : '#444444',
            fontFamily: mono,
            fontSize: `${xs}px`,
            cursor: 'pointer',
            padding: '2px 7px',
            borderRadius: 2,
            letterSpacing: 1,
            transition: 'color 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => { if (activeTab !== 'playlist') (e.currentTarget as HTMLButtonElement).style.color = '#777777' }}
          onMouseLeave={e => { if (activeTab !== 'playlist') (e.currentTarget as HTMLButtonElement).style.color = '#444444' }}
        >
          ⠶ PLAYLIST{playlistCount > 0 ? ` ${playlistCount}` : ''}
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Collapse ↔ expand button (moved here from SplashPanel) */}
        {mode === 'split' && (
          <button
            onClick={onToggleCollapse}
            title="Expand to full screen"
            style={{
              background: 'none',
              border: '1px solid #2a2a2a',
              color: '#444444',
              fontFamily: mono,
              fontSize: `${fontSize}px`,
              cursor: 'pointer',
              padding: '1px 5px',
              borderRadius: 2,
              lineHeight: 1,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888888' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#444444' }}
          >
            ⠿›
          </button>
        )}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: activeTab === 'query' ? 'flex' : 'none', flexDirection: 'column' }}>
        <SplashPanel
          fontSize={fontSize}
          onSubmit={onSubmit}
          mode={mode}
          onToggleCollapse={onToggleCollapse}
          isLoading={isLoading}
          streamEnergy={streamEnergy}
          billboardList={billboardList}
        />
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: activeTab === 'playlist' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: mode === 'splash'
            ? `0 ${fontSize}px ${fontSize}px`
            : `0 ${fontSize * 0.5}px ${fontSize * 0.5}px`,
          boxSizing: 'border-box',
          transition: 'padding 0.55s',
        }}
      >
        <PlaylistPanel
          items={items}
          activeIndex={activeIndex}
          onSelect={onSelectPlaylistItem}
          onRemove={onRemoveFromPlaylist}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onReorder={onReorderPlaylist}
          onExportGif={onExportGif}
          exportingGif={exportingGif}
          exportProgress={exportProgress}
          encodeProgress={encodeProgress}
          fontSize={fontSize}
        />
      </div>
    </div>
  )
}
