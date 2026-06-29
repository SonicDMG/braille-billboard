'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { DotMatrixDisplay, type DotMatrixDisplayHandle } from './DotMatrixDisplay'
import { Header } from './Header'
import { Footer } from './Footer'
import { LeftPanel } from './LeftPanel'
import { SetupScreen } from './SetupScreen'
import { BillboardList } from './BillboardList'
import { useCycle } from '@/hooks/useCycle'
import { useBrailleResize } from '@/hooks/useBrailleResize'
import type { BillboardSegmentSprite, EntranceStyle, VisualizationData } from '@/lib/types'
import { spriteDataToMap } from '@/lib/image-to-sprite'
import { billboardConfig } from '@/billboard.config'

const ENTRANCE_STYLES: EntranceStyle[] = ['fly-in', 'dissolve', 'sparkle', 'typewriter']

function randomEntranceStyle(): EntranceStyle {
  return ENTRANCE_STYLES[Math.floor(Math.random() * ENTRANCE_STYLES.length)]!
}

interface BillboardProps {
  missingEnvVars: string[]
}

/**
 * Layout states:
 *  'splash' — left panel fills 100%, right panel is hidden (initial state)
 *  'split'  — left panel ~25%, right panel ~75%
 *  'full'   — left panel collapsed to 0, right panel fills 100%
 */
type Layout = 'splash' | 'split' | 'full'

export function Billboard({ missingEnvVars }: BillboardProps) {
  const fontSize = billboardConfig.fontSize

  // Right panel container ref — for cols used by footer progress bar
  const dotMatrixRef = useRef<DotMatrixDisplayHandle>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const { cols } = useBrailleResize(fontSize, 2, 2, rightPanelRef as React.RefObject<HTMLElement | null>)

  // Layout state machine
  const [layout, setLayout] = useState<Layout>('splash')

  const {
    phase, activeIndex, items, activeGroupKey,
    submitManualQuery, addItem, deleteItem, jumpTo, setActiveGroup,
    lastManualChatIdRef, setItemSprite, removeItemSprite, updateItemData,
    addToPlaylist, removeFromPlaylist, reorderPlaylistItems,
  } = useCycle({
    dwellSeconds: billboardConfig.dwellSeconds,
    resumeAfterManualSeconds: billboardConfig.resumeAfterManualSeconds,
  })

  // GIF export state
  const [exportingGif, setExportingGif] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)

  // Stable entrance style for the current displaying phase.
  const fallbackEntranceRef = useRef<EntranceStyle>('dissolve')
  const lastPhaseRef = useRef<string>('')
  const currentPhase = phase.phase
  if (currentPhase === 'transitioning' && lastPhaseRef.current !== 'transitioning') {
    fallbackEntranceRef.current = randomEntranceStyle()
  }
  lastPhaseRef.current = currentPhase

  // When a manual query completes (manual → transitioning), add it to the billboard list.
  const lastManualQueryRef = useRef<string | null>(null)
  useEffect(() => {
    if (phase.phase === 'manual') {
      lastManualQueryRef.current = phase.query
    }
  }, [phase])

  useEffect(() => {
    if (phase.phase === 'transitioning' && lastManualQueryRef.current) {
      const query = lastManualQueryRef.current
      lastManualQueryRef.current = null
      const chatId = lastManualChatIdRef.current
      lastManualChatIdRef.current = null
      addItem(query, chatId, phase.next, phase.audioB64)
    }
  }, [phase, addItem, lastManualChatIdRef])

  // Switch to split layout when there's something to show in the left panel.
  // Triggers on: active query, or items loaded from DB (even with empty playlist).
  useEffect(() => {
    if (layout !== 'splash') return
    if (phase.phase === 'manual' || phase.phase === 'loading') {
      setLayout('split')
    } else if ((phase.phase === 'idle' || phase.phase === 'displaying' || phase.phase === 'transitioning') && items.length > 0) {
      setLayout('split')
    }
  }, [phase.phase, items.length, layout])

  // Keyboard shortcut: Escape collapses to split (if full), '/' opens panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (layout === 'full') setLayout('split')
      }
      if (e.key === '/') {
        if (layout === 'full') {
          e.preventDefault()
          setLayout('split')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [layout])

  const handleDeleteItem = useCallback((id: string) => {
    deleteItem(id)
  }, [deleteItem])

  const handleUploadSprite = useCallback((id: string, file: File) => {
    void setItemSprite(id, file)
  }, [setItemSprite])

  const handleRemoveSprite = useCallback((id: string) => {
    removeItemSprite(id)
  }, [removeItemSprite])

  const handleUpdateItem = useCallback((id: string, data: VisualizationData) => {
    updateItemData(id, data)
  }, [updateItemData])

  // Playlist reorder helpers — derive ordered playlist ids, swap adjacent items
  const playlistItems = useMemo(
    () => [...items].filter(it => it.playlistOrder !== null).sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0)),
    [items],
  )

  const handleMoveUp = useCallback((id: string) => {
    const idx = playlistItems.findIndex(it => it.id === id)
    if (idx <= 0) return
    const newOrder = playlistItems.map(it => it.id)
    ;[newOrder[idx - 1]!, newOrder[idx]!] = [newOrder[idx]!, newOrder[idx - 1]!]
    reorderPlaylistItems(newOrder)
  }, [playlistItems, reorderPlaylistItems])

  const handleMoveDown = useCallback((id: string) => {
    const idx = playlistItems.findIndex(it => it.id === id)
    if (idx === -1 || idx >= playlistItems.length - 1) return
    const newOrder = playlistItems.map(it => it.id)
    ;[newOrder[idx]!, newOrder[idx + 1]!] = [newOrder[idx + 1]!, newOrder[idx]!]
    reorderPlaylistItems(newOrder)
  }, [playlistItems, reorderPlaylistItems])

  const handleExportGif = useCallback(() => {
    if (exportingGif || playlistItems.length === 0) return
    setExportingGif(true)
    setExportProgress(null)

    const gifItems = playlistItems.map(item => {
      const activeSpriteData = item.spriteData ?? item.data.generatedSpriteData ?? null
      const spriteMap = activeSpriteData ? spriteDataToMap(activeSpriteData) : null
      const imageSeg: BillboardSegmentSprite | undefined = spriteMap ? { type: 'sprite', spriteMap } : undefined
      return {
        segments: item.data.segments,
        text: item.data.words ?? item.data.summary,
        entranceStyle: item.data.entranceStyle,
        imageSeg,
      }
    })

    dotMatrixRef.current?.capturePlaylistGif(
      gifItems,
      'presentation.gif',
      (done, total) => setExportProgress({ done, total }),
    )

    // capturePlaylistGif is synchronous for frame building then async for encoding.
    // Listen for the download to complete by polling progress completion.
    const check = setInterval(() => {
      setExportProgress(prev => {
        if (prev && prev.done === prev.total) {
          clearInterval(check)
          setTimeout(() => {
            setExportingGif(false)
            setExportProgress(null)
          }, 500)
        }
        return prev
      })
    }, 200)
  }, [exportingGif, playlistItems])

  if (missingEnvVars.length > 0) {
    return <SetupScreen missingVars={missingEnvVars} fontSize={fontSize} />
  }

  const currentQuery =
    phase.phase === 'loading' || phase.phase === 'manual' || phase.phase === 'error'
      ? phase.query
      : phase.phase === 'displaying' || phase.phase === 'transitioning'
      ? phase.phase === 'displaying' ? phase.data.title : phase.next.title
      : ''

  const summary =
    phase.phase === 'displaying' ? phase.data.summary :
    phase.phase === 'error' ? phase.message :
    phase.phase === 'loading' || phase.phase === 'manual' ? 'Querying documents...' :
    '⠀'

  const dwellRemaining = phase.phase === 'displaying' ? phase.dwellRemaining : 0
  const dwellTotal = billboardConfig.dwellSeconds

  const isLoading = phase.phase === 'manual'

  const tokenCount = (phase.phase === 'loading' || phase.phase === 'manual') ? phase.tokenCount : 0
  const streamEnergy = tokenCount > 0 ? 1 - Math.exp(-tokenCount / 120) : 0

  const isLoadingPhase = phase.phase === 'loading' || phase.phase === 'manual'
  const dotSegments =
    phase.phase === 'displaying' ? phase.data.segments :
    phase.phase === 'transitioning' ? phase.next.segments :
    undefined
  const dotEntranceStyle =
    phase.phase === 'displaying' ? (phase.data.entranceStyle ?? fallbackEntranceRef.current) :
    phase.phase === 'transitioning' ? (phase.next.entranceStyle ?? fallbackEntranceRef.current) :
    undefined
  const dotText =
    phase.phase === 'error' ? 'ERROR' :
    (!dotSegments && phase.phase === 'displaying') ? (phase.data.words ?? phase.data.summary) :
    (!dotSegments && phase.phase === 'transitioning') ? (phase.next.words ?? phase.next.summary) :
    ''

  const activeItem = items[activeIndex]
  const activeData =
    phase.phase === 'displaying' ? phase.data :
    phase.phase === 'transitioning' ? phase.next :
    activeItem?.data

  const activeSpriteData = activeItem?.spriteData ?? activeData?.generatedSpriteData ?? null
  const spriteMap = useMemo(
    () => activeSpriteData ? spriteDataToMap(activeSpriteData) : null,
    [activeSpriteData],
  )

  let dotImageSeg: BillboardSegmentSprite | undefined
  if (spriteMap) {
    dotImageSeg = { type: 'sprite', spriteMap }
  }

  const leftWidth = layout === 'splash' ? '100%' : layout === 'split' ? '25%' : '0%'
  const rightWidth = layout === 'splash' ? '0%' : layout === 'split' ? '75%' : '100%'
  const TRANSITION = 'width 0.55s cubic-bezier(0.4, 0, 0.2, 1)'

  return (
    <div
      style={{
        background: '#000000',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {/* ── LEFT PANEL — tabbed query / playlist ────────────────────────────── */}
      <div
        style={{
          width: leftWidth,
          flexShrink: 0,
          overflow: 'hidden',
          borderRight: layout !== 'splash' ? '1px solid #1a1a1a' : 'none',
          transition: TRANSITION,
          position: 'relative',
        }}
      >
        <LeftPanel
          fontSize={fontSize}
          mode={layout}
          onToggleCollapse={() => {
            if (layout === 'split') setLayout('full')
            else if (layout === 'full') setLayout('split')
          }}
          onSubmit={submitManualQuery}
          isLoading={isLoading}
          streamEnergy={streamEnergy}
          billboardList={
            <BillboardList
              items={items}
              activeIndex={activeIndex}
              activeGroupKey={activeGroupKey}
              onSelect={jumpTo}
              onDelete={handleDeleteItem}
              onUploadSprite={handleUploadSprite}
              onRemoveSprite={handleRemoveSprite}
              onUpdateItem={handleUpdateItem}
              onAddToPlaylist={addToPlaylist}
              onRemoveFromPlaylist={removeFromPlaylist}
              onDownloadGif={(id) => {
                const item = items.find(it => it.id === id)
                const slug = item?.query.slice(0, 40).replace(/[^a-z0-9]+/gi, '-').toLowerCase() ?? 'billboard'
                dotMatrixRef.current?.captureGif(`${slug}.gif`)
              }}
              onSetGroup={setActiveGroup}
              fontSize={fontSize}
            />
          }
          items={items}
          activeIndex={activeIndex}
          onSelectPlaylistItem={jumpTo}
          onRemoveFromPlaylist={removeFromPlaylist}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onReorderPlaylist={reorderPlaylistItems}
          onExportGif={handleExportGif}
          exportingGif={exportingGif}
          exportProgress={exportProgress}
        />
      </div>

      {/* ── RIGHT PANEL — Billboard (dot matrix always) ─────────────────────── */}
      <div
        ref={rightPanelRef}
        style={{
          width: rightWidth,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: `${fontSize}px`,
          boxSizing: 'border-box',
          gap: `${fontSize * 0.5}px`,
          transition: TRANSITION,
        }}
      >
        {/* When panel is fully collapsed, show a small button to expand it again */}
        {layout === 'full' && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: fontSize * 0.25 }}>
            <button
              onClick={() => setLayout('split')}
              title="Show query panel"
              style={{
                background: 'none',
                border: '1px solid #222222',
                color: '#444444',
                fontFamily: "'Courier New', monospace",
                fontSize: `${fontSize * 0.75}px`,
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: 2,
                letterSpacing: 1,
              }}
            >
              ‹⠿ PANEL
            </button>
          </div>
        )}

        <Header
          query={currentQuery}
          playlistIndex={activeIndex}
          playlistTotal={items.length}
          onPrev={items.length > 1 ? () => jumpTo(activeIndex - 1) : undefined}
          onNext={items.length > 1 ? () => jumpTo(activeIndex + 1) : undefined}
          fontSize={fontSize}
        />

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DotMatrixDisplay
            ref={dotMatrixRef}
            segments={dotSegments}
            text={dotText}
            loading={isLoadingPhase}
            streamEnergy={streamEnergy}
            entranceStyle={dotEntranceStyle}
            imageSeg={dotImageSeg}
          />
        </div>

        <Footer
          summary={summary}
          isLoading={isLoadingPhase}
          dwellRemaining={dwellRemaining}
          dwellTotal={dwellTotal}
          cols={cols}
          fontSize={fontSize}
          onAsk={layout === 'full' ? () => setLayout('split') : undefined}
        />
      </div>
    </div>
  )
}
