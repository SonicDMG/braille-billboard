'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { BrailleCanvas, drawLineChart, drawBarChart, drawSparkline, drawTextFrame } from '@/lib/braille'
import {
  spinnerFrames,
  wipeOutFrames,
  wipeInFrames,
} from '@/lib/braille-animations'
import { BrailleDisplay } from './BrailleDisplay'
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

function renderVisualization(data: VisualizationData, cols: number, rows: number): string {
  const canvas = new BrailleCanvas(cols, rows)

  switch (data.chartType) {
    case 'line':
      drawLineChart(canvas, data.dataPoints.map(d => d.value))
      break
    case 'bar':
      drawBarChart(canvas, data.dataPoints)
      break
    case 'sparkline':
      drawSparkline(canvas, data.dataPoints.map(d => d.value), Math.floor(rows / 2))
      break
    case 'text':
      drawTextFrame(canvas, data.words ?? data.summary)
      break
  }
  return canvas.frame()
}

export function Billboard({ missingEnvVars }: BillboardProps) {
  const fontSize = billboardConfig.fontSize

  // Right panel container ref — so useBrailleResize measures only that panel
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const { cols, rows } = useBrailleResize(fontSize, 2, 2, rightPanelRef as React.RefObject<HTMLElement | null>)

  const { play, stop } = useAudio()
  const { musicEnabled, toggle: toggleMusic } = useMusicToggle(stop)

  // Layout state machine
  const [layout, setLayout] = useState<Layout>('splash')

  const [frame, setFrame] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentFrameRef = useRef<string>('')

  const clearAnim = useCallback(() => {
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null }
  }, [])

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

  // Keyboard shortcut: Escape collapses to split (if full) or back to splash (not useful once started)
  // '/' opens panel if collapsed to full
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

  // Drive animations based on phase (right panel only)
  useEffect(() => {
    clearAnim()

    if (phase.phase === 'idle') {
      // Idle — right panel stays blank; SplashPanel drives its own animation

    } else if (phase.phase === 'loading' || phase.phase === 'manual') {
      const gen = spinnerFrames()
      animRef.current = setInterval(() => {
        const spin = gen.next().value
        const midRow = Math.floor(rows / 2)
        const lines = Array.from({ length: rows }, (_, i) => {
          if (i !== midRow) return '⠀'.repeat(cols)
          const left = '⠀'.repeat(Math.max(0, Math.floor(cols / 2) - 1))
          const right = '⠀'.repeat(Math.max(0, cols - Math.floor(cols / 2) - 1))
          return left + spin + right
        })
        setFrame(lines.join('\n'))
      }, 100)

    } else if (phase.phase === 'transitioning') {
      const nextVizFrame = renderVisualization(phase.next, cols, rows)
      setTitle(phase.next.title)
      const prev = currentFrameRef.current

      const wipeOut = wipeOutFrames(prev || '⠀'.repeat(cols), cols)
      const wipeIn = wipeInFrames(nextVizFrame, cols)

      let wipingOut = true
      animRef.current = setInterval(() => {
        if (wipingOut) {
          const result = wipeOut.next()
          if (result.done) {
            wipingOut = false
          } else {
            setFrame(result.value)
          }
        } else {
          const result = wipeIn.next()
          if (!result.done) {
            setFrame(result.value)
          } else {
            currentFrameRef.current = nextVizFrame
            setFrame(nextVizFrame)
            clearAnim()
          }
        }
      }, 20)

    } else if (phase.phase === 'displaying') {
      const vizFrame = renderVisualization(phase.data, cols, rows)
      currentFrameRef.current = vizFrame
      setFrame(vizFrame)
      setTitle(phase.data.title)

    } else if (phase.phase === 'error') {
      const canvas = new BrailleCanvas(cols, rows)
      for (let x = 0; x < canvas.dotWidth; x += 4) {
        for (let y = 0; y < canvas.dotHeight; y += 4) {
          canvas.set(x, y)
        }
      }
      setFrame(canvas.frame())
      setTitle('ERROR')
    }

    return clearAnim
  }, [phase, cols, rows, clearAnim])

  // Stop music on transition
  useEffect(() => {
    if (phase.phase === 'transitioning') stop()
  }, [phase, stop])

  if (missingEnvVars.length > 0) {
    return <SetupScreen missingVars={missingEnvVars} fontSize={fontSize} />
  }

  const currentQuery =
    phase.phase === 'loading' || phase.phase === 'manual' || phase.phase === 'error'
      ? phase.query
      : phase.phase === 'displaying'
      ? phase.data.title
      : title

  const summary =
    phase.phase === 'displaying' ? phase.data.summary :
    phase.phase === 'error' ? phase.message :
    phase.phase === 'loading' || phase.phase === 'manual' ? 'Querying documents...' :
    '⠀'

  const dwellRemaining = phase.phase === 'displaying' ? phase.dwellRemaining : 0
  const dwellTotal = billboardConfig.dwellSeconds

  const isLoading = phase.phase === 'loading' || phase.phase === 'manual' || phase.phase === 'transitioning'

  // Derive a 0–1 energy signal from the stream token count.
  // We use a saturating curve: energy approaches 1 as tokenCount approaches
  // ~400 chars (a typical JSON response). The `1 - e^(-x)` shape means it
  // rises quickly at first then levels off naturally.
  const tokenCount = (phase.phase === 'loading' || phase.phase === 'manual') ? phase.tokenCount : 0
  const streamEnergy = tokenCount > 0 ? 1 - Math.exp(-tokenCount / 120) : 0

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

      {/* ── RIGHT PANEL — Billboard ──────────────────────────────────────────── */}
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

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: `${fontSize * 0.5}px` }}>
          {/* For text responses: show braille as a decorative strip + readable prose below */}
          {phase.phase === 'displaying' && phase.data.chartType === 'text' ? (
            <>
              <div style={{ flexShrink: 0, opacity: 0.35, overflow: 'hidden', maxHeight: `${fontSize * 5}px` }}>
                <BrailleDisplay
                  frame={frame}
                  fontSize={fontSize}
                  color="#ffffff"
                />
              </div>
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  fontFamily: "'Courier New', monospace",
                  fontSize: `${fontSize}px`,
                  color: '#ffffff',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {phase.data.words ?? phase.data.summary}
              </div>
            </>
          ) : (
            <BrailleDisplay
              frame={frame}
              fontSize={fontSize}
              color={phase.phase === 'error' ? '#ff3333' : '#ffffff'}
            />
          )}
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
