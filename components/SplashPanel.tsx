'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { BrailleDisplay } from './BrailleDisplay'
import { idleFrames, busyFrames } from '@/lib/braille-animations'
import { useBrailleResize } from '@/hooks/useBrailleResize'
import { useKnowledgeFilters } from '@/hooks/useKnowledgeFilters'
import type { FilterSummary } from '@/lib/openrag'

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

// ─────────────────────────────────────────────────────────────────────────────
// @mention autocomplete helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse the @mention fragment the cursor is currently inside.
 * Returns the partial name (without @) when an active @token exists at the end
 * of the current word around the cursor, or null when the cursor is not inside
 * an @token.
 */
function getActiveMention(value: string, cursorPos: number): string | null {
  const before = value.slice(0, cursorPos)
  const match = before.match(/@([\w-]*)$/)
  return match ? match[1]! : null
}

/**
 * Replace the @mention fragment the cursor is currently inside with the chosen
 * filter name, appending a space so the user can keep typing.
 */
function applyMention(value: string, cursorPos: number, filterName: string): { newValue: string; newCursor: number } {
  const before = value.slice(0, cursorPos)
  const after = value.slice(cursorPos)
  // Replace the partial @token with the completed name
  const newBefore = before.replace(/@[\w-]*$/, `@${filterName} `)
  return { newValue: newBefore + after, newCursor: newBefore.length }
}

/**
 * Auto-correct a completed @mention in the submitted query.
 * If the mention matches a filter exactly, leave it alone.
 * If it is close (prefix or substring match), replace with the best match.
 * If nothing matches at all, strip the @token so the query still runs unscoped.
 */
function autocorrectMention(query: string, filters: FilterSummary[]): string {
  return query.replace(/@([\w-]+)/g, (token, name: string) => {
    const lower = name.toLowerCase()
    // Exact match — leave as-is
    if (filters.some(f => f.name.toLowerCase() === lower)) return token
    // Prefix match — pick shortest name that starts with the typed text
    const prefixMatches = filters.filter(f => f.name.toLowerCase().startsWith(lower))
    if (prefixMatches.length > 0) {
      const best = prefixMatches.sort((a, b) => a.name.length - b.name.length)[0]!
      return `@${best.name}`
    }
    // Substring match — pick shortest name containing the typed text
    const subMatches = filters.filter(f => f.name.toLowerCase().includes(lower))
    if (subMatches.length > 0) {
      const best = subMatches.sort((a, b) => a.name.length - b.name.length)[0]!
      return `@${best.name}`
    }
    // No match — strip the token so the query runs without a filter
    return ''
  }).replace(/\s{2,}/g, ' ').trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

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
  const [cursorPos, setCursorPos] = useState(0)
  const [dropdownIndex, setDropdownIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState('')
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Mutable box passed into the generator so energy updates without restarting it
  const energyRef = useRef<{ value: number }>({ value: 0 })

  const { filters } = useKnowledgeFilters()

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

  // ── @mention dropdown logic ────────────────────────────────────────────────

  // The partial name after @ at the current cursor position, or null
  const activeMention = getActiveMention(value, cursorPos)

  // Filtered suggestions: all filters when activeMention is '' (just typed @),
  // otherwise filters whose name starts with or contains the typed fragment.
  const suggestions: FilterSummary[] = activeMention !== null && filters.length > 0
    ? (activeMention === ''
        ? filters
        : filters.filter(f => f.name.toLowerCase().includes(activeMention.toLowerCase()))
      ).slice(0, 8) // cap at 8 visible items
    : []

  // Reset dropdown selection whenever suggestions list changes
  useEffect(() => {
    setDropdownIndex(0)
  }, [suggestions.length, activeMention])

  const applySelection = useCallback((filterName: string) => {
    const { newValue, newCursor } = applyMention(value, cursorPos, filterName)
    setValue(newValue)
    setCursorPos(newCursor)
    // Restore focus and set cursor position after React re-renders
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.setSelectionRange(newCursor, newCursor)
      }
    })
  }, [value, cursorPos])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = autocorrectMention(value.trim(), filters)
    if (q && !isLoading) {
      onSubmit(q)
      setValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setDropdownIndex(i => Math.min(i + 1, suggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setDropdownIndex(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        // Tab always picks from dropdown; Enter only picks when dropdown is open
        const sel = suggestions[dropdownIndex]
        if (sel) {
          e.preventDefault()
          applySelection(sel.name)
          return
        }
      }
      if (e.key === 'Escape') {
        // Close dropdown without collapsing the panel
        setValue(v => v) // no-op value update — cursor re-read via onSelect
        setCursorPos(inputRef.current?.selectionStart ?? cursorPos)
        // Move cursor out of the @token to dismiss dropdown
        const el = inputRef.current
        if (el) {
          const pos = el.selectionStart ?? 0
          const before = value.slice(0, pos)
          // find the @ and move cursor before it to kill the active mention
          const atIdx = before.lastIndexOf('@')
          if (atIdx !== -1) {
            const newPos = atIdx
            el.setSelectionRange(newPos, newPos)
            setCursorPos(newPos)
          }
        }
        return
      }
    }
    if (e.key === 'Escape') {
      // In split mode with no dropdown open, ESC collapses the panel
      if (mode === 'split') onToggleCollapse()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setCursorPos(e.target.selectionStart ?? e.target.value.length)
  }

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    setCursorPos(el.selectionStart ?? el.value.length)
  }

  const showInput = mode === 'splash' || mode === 'split'
  const showCollapseBtn = mode === 'split'
  const waveOpacity = mode === 'splash' ? 0.75 : 0.5

  const mono = "'Courier New', monospace"

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: mode === 'split' ? `${fontSize * 0.5}px ${fontSize * 0.5}px` : `${fontSize * 0.5}px ${fontSize}px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        transition: 'padding 0.55s',
      }}
    >
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
                fontFamily: mono,
                fontSize: `${mode === 'splash' ? fontSize * 0.9 : fontSize * 0.65}px`,
                color: '#888888',
                letterSpacing: 2,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
          >
            {isLoading ? '⠿ QUERYING...' : '⠿ ASK A QUESTION'}
          </div>

          {/* Input + dropdown wrapper */}
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
              onClick={handleSelect}
              disabled={isLoading}
              placeholder={mode === 'splash' ? 'Ask about your documents...' : 'New question...'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#0a0a0a',
                border: `1px solid ${suggestions.length > 0 ? '#555555' : mode === 'splash' ? '#444444' : '#3a3a3a'}`,
                color: isLoading ? '#444444' : '#ffffff',
                fontFamily: mono,
                fontSize: `${mode === 'splash' ? fontSize : fontSize * 0.85}px`,
                padding: mode === 'splash' ? '12px 16px' : '8px 10px',
                outline: 'none',
                borderRadius: suggestions.length > 0 ? '2px 2px 0 0' : 2,
                transition: 'font-size 0.3s, padding 0.3s, border-color 0.3s',
              }}
            />

            {/* @mention dropdown */}
            {suggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#111111',
                  border: '1px solid #555555',
                  borderTop: 'none',
                  borderRadius: '0 0 2px 2px',
                  zIndex: 50,
                  overflow: 'hidden',
                }}
              >
                {suggestions.map((f, i) => (
                  <div
                    key={f.id}
                    onMouseDown={e => {
                      // mousedown fires before input blur — prevent blur then apply
                      e.preventDefault()
                      applySelection(f.name)
                    }}
                    onMouseEnter={() => setDropdownIndex(i)}
                    style={{
                      padding: mode === 'splash' ? '7px 14px' : '5px 10px',
                      cursor: 'pointer',
                      background: i === dropdownIndex ? '#1e1e1e' : 'transparent',
                      borderLeft: i === dropdownIndex ? '2px solid #666666' : '2px solid transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontFamily: mono, fontSize: `${(mode === 'splash' ? fontSize : fontSize * 0.85) * 0.9}px`, color: '#cccccc' }}>
                      @{f.name}
                    </span>
                    {f.description && (
                      <span style={{ fontFamily: mono, fontSize: `${(mode === 'splash' ? fontSize : fontSize * 0.85) * 0.7}px`, color: '#555555', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {f.description}
                      </span>
                    )}
                  </div>
                ))}
                <div style={{
                  padding: mode === 'splash' ? '4px 14px' : '3px 10px',
                  fontFamily: mono,
                  fontSize: `${(mode === 'splash' ? fontSize : fontSize * 0.85) * 0.65}px`,
                  color: '#444444',
                  borderTop: '1px solid #2a2a2a',
                }}>
                  ↑↓ navigate · TAB/ENTER select · ESC dismiss
                </div>
              </div>
            )}
          </div>

          <div
            style={{
                fontFamily: mono,
                fontSize: `${fontSize * 0.65}px`,
                color: '#555555',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
          >
            {mode === 'splash' ? 'ENTER to ask · type @ to filter by source' : 'ENTER · ESC to hide · @ to filter'}
          </div>
        </form>
      )}

      {/* Braille sine wave — fills available space, always centred vertically */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          opacity: waveOpacity,
          transition: 'opacity 0.6s',
          display: 'flex',
          alignItems: 'center',
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
