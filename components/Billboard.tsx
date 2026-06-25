'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { DotMatrixDisplay } from './DotMatrixDisplay'
import { Header } from './Header'
import { Footer } from './Footer'
import { SplashPanel } from './SplashPanel'
import { SetupScreen } from './SetupScreen'
import { BillboardList } from './BillboardList'
import { useCycle } from '@/hooks/useCycle'
import { useBrailleResize } from '@/hooks/useBrailleResize'
import type { BillboardSegmentSprite, EntranceStyle } from '@/lib/types'
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
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const { cols } = useBrailleResize(fontSize, 2, 2, rightPanelRef as React.RefObject<HTMLElement | null>)

  // Layout state machine
  const [layout, setLayout] = useState<Layout>('splash')

  const { phase, activeIndex, items, submitManualQuery, addItem, deleteItem, jumpTo, lastManualChatIdRef, setItemSprite, removeItemSprite } = useCycle({
    dwellSeconds: billboardConfig.dwellSeconds,
    resumeAfterManualSeconds: billboardConfig.resumeAfterManualSeconds,
  })

  // Stable entrance style for the current displaying phase.
  // Re-rolled every time we freshly enter 'displaying' (including cycling back
  // to the same billboard) so repeated visits each get a different animation.
  const fallbackEntranceRef = useRef<EntranceStyle>('dissolve')
  const lastPhaseRef = useRef<string>('')
  const currentPhase = phase.phase
  if (currentPhase === 'displaying' && lastPhaseRef.current !== 'displaying') {
    fallbackEntranceRef.current = randomEntranceStyle()
  }
  lastPhaseRef.current = currentPhase

  // When a manual query completes (manual → transitioning), add it to the billboard list.
  // We track the last manual query string so we can pair it with the resulting VisualizationData.
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
      // chatId is populated by useCycle's fetch effect when the result arrives
      const chatId = lastManualChatIdRef.current
      lastManualChatIdRef.current = null
      addItem(query, chatId, phase.next, phase.audioB64)
    }
  }, [phase, addItem, lastManualChatIdRef])

  // When query fires, transition to split layout so the billboard becomes visible
  useEffect(() => {
    if (phase.phase === 'manual' || phase.phase === 'loading') {
      if (layout === 'splash') setLayout('split')
    }
  }, [phase.phase, layout])

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

  // Handle item deletion — DB row removal and OpenRAG cleanup happen in DELETE /api/items/[id].
  const handleDeleteItem = useCallback((id: string) => {
    deleteItem(id)
  }, [deleteItem])

  const handleUploadSprite = useCallback((id: string, file: File) => {
    void setItemSprite(id, file)
  }, [setItemSprite])

  const handleRemoveSprite = useCallback((id: string) => {
    removeItemSprite(id)
  }, [removeItemSprite])

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

  // Derive a 0–1 energy signal from the stream token count.
  const tokenCount = (phase.phase === 'loading' || phase.phase === 'manual') ? phase.tokenCount : 0
  const streamEnergy = tokenCount > 0 ? 1 - Math.exp(-tokenCount / 120) : 0

  // What to show on the dot matrix
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

  // Derive imageSeg for the active billboard item:
  //   1. User-uploaded sprite takes priority.
  //   2. Fall back to EverArt-generated sprite attached to the VisualizationData.
  //   3. Otherwise undefined (no image block).
  const activeItem = items[activeIndex]
  const activeData =
    phase.phase === 'displaying' ? phase.data :
    phase.phase === 'transitioning' ? phase.next :
    activeItem?.data

  // Memoize spriteDataToMap so the Map reference is stable between renders —
  // DotMatrixDisplay uses imageSeg as a useEffect dep, and a new Map object
  // on every render would continuously restart the entrance animation.
  const activeSpriteData = activeItem?.spriteData ?? activeData?.generatedSpriteData ?? null
  const spriteMap = useMemo(
    () => activeSpriteData ? spriteDataToMap(activeSpriteData) : null,
    [activeSpriteData],
  )

  let dotImageSeg: BillboardSegmentSprite | undefined
  if (spriteMap) {
    dotImageSeg = { type: 'sprite', spriteMap }
  }

  // CSS widths for each panel based on layout
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
      {/* ── LEFT PANEL — Splash / query ─────────────────────────────────────── */}
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
        <SplashPanel
          fontSize={fontSize}
          onSubmit={submitManualQuery}
          mode={layout}
          onToggleCollapse={() => {
            if (layout === 'split') setLayout('full')
            else if (layout === 'full') setLayout('split')
          }}
          isLoading={isLoading}
          streamEnergy={streamEnergy}
          billboardList={
            <BillboardList
              items={items}
              activeIndex={activeIndex}
              onSelect={jumpTo}
              onDelete={handleDeleteItem}
              onUploadSprite={handleUploadSprite}
              onRemoveSprite={handleRemoveSprite}
              fontSize={fontSize}
            />
          }
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
