'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { DotMatrixDisplay } from './DotMatrixDisplay'
import { Header } from './Header'
import { Footer } from './Footer'
import { SplashPanel } from './SplashPanel'
import { SetupScreen } from './SetupScreen'
import { useCycle } from '@/hooks/useCycle'
import { useBrailleResize } from '@/hooks/useBrailleResize'
import { useAudio } from '@/hooks/useAudio'
import { useMusicToggle } from '@/hooks/useMusicToggle'
import type { VisualizationData } from '@/lib/types'
import { billboardConfig } from '@/billboard.config'

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

  const { play, stop } = useAudio()
  const { musicEnabled, toggle: toggleMusic } = useMusicToggle(stop)

  // Layout state machine
  const [layout, setLayout] = useState<Layout>('splash')

  // Handle music when a new visualization is ready
  const handleVisualizationReady = useCallback(async (data: VisualizationData) => {
    if (!musicEnabled) return
    try {
      const res = await fetch('/api/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: data.musicPrompt }),
      })
      if (!res.ok) return
      const buffer = await res.arrayBuffer()
      const blob = new Blob([buffer], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      play(url)
    } catch {
      // silent failure
    }
  }, [musicEnabled, play])

  const { phase, playlistIndex, submitManualQuery } = useCycle({
    playlist: billboardConfig.playlist,
    dwellSeconds: billboardConfig.dwellSeconds,
    resumeAfterManualSeconds: billboardConfig.resumeAfterManualSeconds,
    onVisualizationReady: handleVisualizationReady,
  })

  // When query fires, transition to split layout so the billboard becomes visible
  useEffect(() => {
    if (phase.phase === 'manual' || phase.phase === 'loading') {
      if (layout === 'splash') setLayout('split')
    }
  }, [phase.phase, layout])

  // Stop music on transition
  useEffect(() => {
    if (phase.phase === 'transitioning') stop()
  }, [phase, stop])

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

  // What text to show on the dot matrix
  const isLoadingPhase = phase.phase === 'loading' || phase.phase === 'manual'
  const dotText =
    phase.phase === 'displaying' ? (phase.data.words ?? phase.data.summary) :
    phase.phase === 'transitioning' ? (phase.next.words ?? phase.next.summary) :
    phase.phase === 'error' ? 'ERROR' :
    ''

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
          playlistIndex={playlistIndex}
          playlistTotal={billboardConfig.playlist.length}
          musicEnabled={musicEnabled}
          onMusicToggle={toggleMusic}
          fontSize={fontSize}
        />

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <DotMatrixDisplay
            text={dotText}
            loading={isLoadingPhase}
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
