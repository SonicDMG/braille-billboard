'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { BrailleCanvas, drawLineChart, drawBarChart, drawSparkline } from '@/lib/braille'
import {
  spinnerFrames,
  idleFrames,
  wipeOutFrames,
  wipeInFrames,
} from '@/lib/braille-animations'
import { BrailleDisplay } from './BrailleDisplay'
import { Header } from './Header'
import { Footer } from './Footer'
import { ManualQuery } from './ManualQuery'
import { SetupScreen } from './SetupScreen'
import { useCycle } from '@/hooks/useCycle'
import { useBrailleResize } from '@/hooks/useBrailleResize'
import { useAudio } from '@/hooks/useAudio'
import { useMusicToggle } from '@/hooks/useMusicToggle'
import type { VisualizationData } from '@/lib/types'
import { billboardConfig } from '@/billboard.config'

const REQUIRED_ENV = ['OPENRAG_BASE_URL', 'OPENRAG_API_KEY', 'ELEVENLABS_API_KEY']

interface BillboardProps {
  missingEnvVars: string[]
}

function renderVisualization(data: VisualizationData, cols: number, rows: number): string {
  const canvas = new BrailleCanvas(cols, rows)
  const values = data.dataPoints.map(d => d.value)

  switch (data.chartType) {
    case 'line':
      drawLineChart(canvas, values)
      break
    case 'bar':
      drawBarChart(canvas, data.dataPoints)
      break
    case 'sparkline':
      drawSparkline(canvas, values, Math.floor(rows / 2))
      break
  }
  return canvas.frame()
}

export function Billboard({ missingEnvVars }: BillboardProps) {
  const fontSize = billboardConfig.fontSize
  const { cols, rows } = useBrailleResize(fontSize)
  const { play, stop } = useAudio()
  const { musicEnabled, toggle: toggleMusic } = useMusicToggle(stop)

  const [frame, setFrame] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  // Open the query input immediately when there's no playlist to auto-run
  const [showManual, setShowManual] = useState(billboardConfig.playlist.length === 0)
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

  // Re-open query input when cycle returns to idle with no playlist
  useEffect(() => {
    if (phase.phase === 'idle' && billboardConfig.playlist.length === 0) {
      setShowManual(true)
    }
  }, [phase.phase])

  // Keyboard listener for manual query (/)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !showManual) {
        e.preventDefault()
        setShowManual(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showManual])

  // Drive animations based on phase
  useEffect(() => {
    clearAnim()

    if (phase.phase === 'idle') {
      const gen = idleFrames(cols, rows)
      animRef.current = setInterval(() => {
        setFrame(gen.next().value)
      }, 50)

    } else if (phase.phase === 'loading' || phase.phase === 'manual') {
      // Spinner in the centre
      const gen = spinnerFrames()
      animRef.current = setInterval(() => {
        const spin = gen.next().value
        const canvas = new BrailleCanvas(cols, rows)
        // Place spinner roughly in centre
        const cx = Math.floor((canvas.dotWidth) / 2)
        const cy = Math.floor((canvas.dotHeight) / 2)
        // We can't place a pre-made char in the canvas, so render a full loading frame
        void canvas // canvas unused for spinner — we build the frame manually
        const midRow = Math.floor(rows / 2)
        const lines = Array.from({ length: rows }, (_, i) => {
          if (i !== midRow) return '⠀'.repeat(cols)
          const left = '⠀'.repeat(Math.floor(cols / 2) - 1)
          const right = '⠀'.repeat(cols - Math.floor(cols / 2) - 1)
          return left + spin + right
        })
        setFrame(lines.join('\n'))
      }, 100)

    } else if (phase.phase === 'transitioning') {
      const nextVizFrame = renderVisualization(phase.next, cols, rows)
      setTitle(phase.next.title)
      const prev = currentFrameRef.current

      // Wipe out current, then wipe in new
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
      // Show error pattern — a sparse dot grid
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

  return (
    <div
      style={{
        background: '#000000',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: `${fontSize}px`,
        boxSizing: 'border-box',
        gap: `${fontSize * 0.5}px`,
      }}
    >
      <Header
        query={currentQuery}
        playlistIndex={playlistIndex}
        playlistTotal={billboardConfig.playlist.length}
        musicEnabled={musicEnabled}
        onMusicToggle={toggleMusic}
        fontSize={fontSize}
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <BrailleDisplay
          frame={frame}
          fontSize={fontSize}
          color={phase.phase === 'error' ? '#ff3333' : '#ffffff'}
        />
      </div>

      <Footer
        summary={summary}
        dwellRemaining={dwellRemaining}
        dwellTotal={dwellTotal}
        cols={cols}
        fontSize={fontSize}
      />

      {showManual && (
        <ManualQuery
          onSubmit={submitManualQuery}
          onClose={() => setShowManual(false)}
          fontSize={fontSize}
          isInitial={phase.phase === 'idle'}
        />
      )}
    </div>
  )
}
