'use client'

import { useState, useEffect, useRef } from 'react'
import { BrailleDisplay } from './BrailleDisplay'
import { idleFrames, busyFrames } from '@/lib/braille-animations'
import { useBrailleResize } from '@/hooks/useBrailleResize'

interface SplashPanelProps {
  fontSize: number
  /** Called when the user submits a query */
  onSubmit: (query: string) => void
  /**
   * 'splash' — full-screen initial state (no collapse button, input is prominent)
   * 'split'  — narrow left panel, input hidden, collapse/expand button visible
   * 'full'   — panel width is 0, nothing rendered (handled by parent hiding the div)
   */
  mode: 'splash' | 'split' | 'full'
  /** Toggle between split ↔ full from inside the panel */
  onToggleCollapse: () => void
  /** Loading state — disable input and switch to busy wave */
  isLoading: boolean
  /**
   * Streaming energy signal 0–1. Updated every token delta; drives busyFrames
   * amplitude and speed in real time without restarting the generator.
   */
  streamEnergy: number
  /** Optional billboard list rendered below the query input in split mode */
  billboardList?: React.ReactNode
}

export function SplashPanel({
  fontSize,
  onSubmit,
  mode,
  onToggleCollapse,
  isLoading,
  streamEnergy,
  billboardList,
}: SplashPanelProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState('')
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Mutable box passed into the generator so energy updates without restarting it
  const energyRef = useRef<{ value: number }>({ value: 0 })

  // Keep the energy box in sync on every render (no re-render, no generator restart)
  energyRef.current.value = isLoading ? streamEnergy : 0

  // Measure only this panel's dimensions for the braille grid
  const { cols, rows } = useBrailleResize(fontSize, 3, 3, containerRef as React.RefObject<HTMLElement | null>)

  // Switch between idle wave and busy wave depending on loading state.
  // The busy generator holds a ref to energyRef so amplitude updates live.
  useEffect(() => {
    if (cols === 0 || rows === 0) return
    if (animRef.current) clearInterval(animRef.current)
    const gen = isLoading ? busyFrames(cols, rows, energyRef.current) : idleFrames(cols, rows)
    animRef.current = setInterval(() => {
      setFrame(gen.next().value)
    }, 50)
    return () => {
      if (animRef.current) clearInterval(animRef.current)
    }
  }, [cols, rows, isLoading])

  // Auto-focus input when entering splash or after expanding back from split
  useEffect(() => {
    if (mode === 'splash' || mode === 'split') {
      // Small delay lets the CSS transition settle before stealing focus
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [mode])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    if (q && !isLoading) {
      onSubmit(q)
      setValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // In split mode, ESC collapses the panel to full-screen billboard
      if (mode === 'split') onToggleCollapse()
    }
  }

  const showInput = mode === 'splash' || mode === 'split'
  const showCollapseBtn = mode === 'split'
  const waveOpacity = mode === 'splash' ? 0.55 : 0.2

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: mode === 'split' ? `${fontSize * 0.75}px ${fontSize * 0.5}px` : `${fontSize * 2}px ${fontSize}px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        transition: 'padding 0.55s',
      }}
    >
      {/* Collapse ↔ expand button */}
      {showCollapseBtn && (
        <button
          onClick={onToggleCollapse}
          title="Expand to full screen"
          style={{
            position: 'absolute',
            top: fontSize * 0.75,
            right: fontSize * 0.5,
            background: 'none',
            border: '1px solid #2a2a2a',
            color: '#444444',
            fontFamily: "'Courier New', monospace",
            fontSize: `${fontSize}px`,
            cursor: 'pointer',
            padding: '1px 5px',
            borderRadius: 2,
            zIndex: 10,
            lineHeight: 1,
          }}
        >
          ⠿›
        </button>
      )}

      {/* Query input */}
      {showInput && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: fontSize * 0.5,
            paddingTop: mode === 'splash' ? fontSize : mode === 'split' ? fontSize * 2 : fontSize * 0.5,
            paddingBottom: mode === 'split' ? fontSize * 0.5 : 0,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: `${mode === 'splash' ? fontSize * 0.9 : fontSize * 0.65}px`,
              color: '#444444',
              letterSpacing: 2,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {isLoading ? '⠿ QUERYING...' : '⠿ ASK A QUESTION'}
          </div>
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={mode === 'splash' ? 'Ask about your documents...' : 'New question...'}
            style={{
              background: '#0a0a0a',
              border: `1px solid ${mode === 'splash' ? '#444444' : '#2a2a2a'}`,
              color: isLoading ? '#444444' : '#ffffff',
              fontFamily: "'Courier New', monospace",
              fontSize: `${mode === 'splash' ? fontSize : fontSize * 0.85}px`,
              padding: mode === 'splash' ? '12px 16px' : '8px 10px',
              outline: 'none',
              borderRadius: 2,
              transition: 'font-size 0.3s, padding 0.3s, border-color 0.3s',
            }}
          />
          <div
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: `${fontSize * 0.65}px`,
              color: '#2a2a2a',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {mode === 'splash' ? 'ENTER to ask' : 'ENTER · ESC to hide panel'}
          </div>
        </form>
      )}

      {/* Braille sine wave — fills available space */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          opacity: waveOpacity,
          transition: 'opacity 0.6s',
        }}
      >
        <BrailleDisplay frame={frame} fontSize={fontSize} color="#ffffff" />
      </div>

      {/* Billboard list — only shown in split mode when there are items */}
      {mode === 'split' && billboardList && (
        <div
          style={{
            marginTop: fontSize * 0.5,
            flexShrink: 0,
            overflow: 'hidden',
            maxHeight: '40%',
          }}
        >
          {billboardList}
        </div>
      )}
    </div>
  )
}
