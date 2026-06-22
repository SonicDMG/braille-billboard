'use client'

import { useReducer, useEffect, useRef, useCallback } from 'react'
import type { BillboardPhase, VisualizationData } from '@/lib/types'

interface CycleState {
  phase: BillboardPhase
  playlistIndex: number
  playlist: readonly string[]
  dwellSeconds: number
  resumeAfterManualSeconds: number
}

type CycleAction =
  | { type: 'START' }
  | { type: 'QUERY_COMPLETE'; data: VisualizationData }
  | { type: 'QUERY_ERROR'; message: string }
  | { type: 'TOKEN_DELTA'; count: number }
  | { type: 'TRANSITION_DONE' }
  | { type: 'DWELL_TICK' }
  | { type: 'DWELL_DONE' }
  | { type: 'MANUAL_QUERY'; query: string }
  | { type: 'MANUAL_COMPLETE'; data: VisualizationData }
  | { type: 'MANUAL_ERROR'; message: string }
  | { type: 'RESUME_AUTO' }

function reducer(state: CycleState, action: CycleAction): CycleState {
  const { phase } = state

  switch (action.type) {
    case 'START':
      if (phase.phase !== 'idle') return state
      return {
        ...state,
        phase: {
          phase: 'loading',
          query: state.playlist[state.playlistIndex]!,
          tokenCount: 0,
        },
      }

    case 'QUERY_COMPLETE':
      if (phase.phase !== 'loading') return state
      return {
        ...state,
        phase: { phase: 'transitioning', next: action.data },
      }

    case 'QUERY_ERROR':
      return {
        ...state,
        phase: {
          phase: 'error',
          message: action.message,
          query: phase.phase === 'loading' ? phase.query : '',
        },
      }

    case 'TOKEN_DELTA': {
      if (phase.phase !== 'loading' && phase.phase !== 'manual') return state
      return {
        ...state,
        phase: { ...phase, tokenCount: action.count },
      }
    }

    case 'TRANSITION_DONE': {
      if (phase.phase !== 'transitioning') return state
      return {
        ...state,
        phase: {
          phase: 'displaying',
          data: phase.next,
          dwellRemaining: state.dwellSeconds,
        },
      }
    }

    case 'DWELL_TICK': {
      if (phase.phase !== 'displaying') return state
      const next = phase.dwellRemaining - 1
      return {
        ...state,
        phase: { ...phase, dwellRemaining: next },
      }
    }

    case 'DWELL_DONE': {
      const nextIndex = (state.playlistIndex + 1) % state.playlist.length
      return {
        ...state,
        playlistIndex: nextIndex,
        phase: { phase: 'loading', query: state.playlist[nextIndex]!, tokenCount: 0 },
      }
    }

    case 'MANUAL_QUERY':
      return {
        ...state,
        phase: { phase: 'manual', query: action.query, tokenCount: 0 },
      }

    case 'MANUAL_COMPLETE':
      return {
        ...state,
        phase: { phase: 'transitioning', next: action.data },
      }

    case 'MANUAL_ERROR':
      return {
        ...state,
        phase: {
          phase: 'error',
          message: action.message,
          query: phase.phase === 'manual' ? phase.query : '',
        },
      }

    case 'RESUME_AUTO': {
      // If no playlist, return to idle so the user can enter another query
      if (state.playlist.length === 0) {
        return { ...state, phase: { phase: 'idle' } }
      }
      const nextIndex = (state.playlistIndex + 1) % state.playlist.length
      return {
        ...state,
        playlistIndex: nextIndex,
        phase: { phase: 'loading', query: state.playlist[nextIndex]!, tokenCount: 0 },
      }
    }

    default:
      return state
  }
}

interface UseCycleOptions {
  playlist: readonly string[]
  dwellSeconds: number
  resumeAfterManualSeconds: number
  onVisualizationReady?: (data: VisualizationData) => void
}

// NDJSON line shapes coming from /api/query
type QueryStreamLine =
  | { type: 'delta'; text: string }
  | { type: 'result'; data: VisualizationData }
  | { type: 'error'; message: string }

export function useCycle({
  playlist,
  dwellSeconds,
  resumeAfterManualSeconds,
  onVisualizationReady,
}: UseCycleOptions) {
  const [state, dispatch] = useReducer(reducer, {
    phase: { phase: 'idle' },
    playlistIndex: 0,
    playlist,
    dwellSeconds,
    resumeAfterManualSeconds,
  })

  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Query result cache — persists for the lifetime of the hook instance.
  // Keyed by normalised query string (trimmed, lower-cased).
  // Prevents re-fetching the same question (playlist cycles, re-asks, StrictMode double-invoke).
  const cacheRef = useRef<Map<string, VisualizationData>>(new Map())

  // Start on mount — only auto-start if the playlist has items.
  useEffect(() => {
    if (playlist.length > 0) {
      dispatch({ type: 'START' })
    }
  }, [playlist.length])

  const { phase } = state
  const onReadyRef = useRef(onVisualizationReady)
  onReadyRef.current = onVisualizationReady

  // Track the query currently in-flight so TOKEN_DELTA updates (which change
  // the phase object reference) don't re-trigger a new fetch.
  const activeQueryRef = useRef<string | null>(null)

  // Fire RAG query whenever we enter a new 'loading' or 'manual' phase.
  // We key on phase.phase + phase.query (not the full phase object) so that
  // TOKEN_DELTA updates — which create a new phase reference with the same
  // query — do not re-run this effect.
  const phaseType = phase.phase
  const phaseQuery = (phase.phase === 'loading' || phase.phase === 'manual') ? phase.query : null

  useEffect(() => {
    if (phaseType !== 'loading' && phaseType !== 'manual') return
    if (!phaseQuery) return

    const query = phaseQuery
    const isManual = phaseType === 'manual'
    const cacheKey = query.trim().toLowerCase()

    // Already fetching this query — TOKEN_DELTA triggered a re-run, skip.
    if (activeQueryRef.current === cacheKey) return

    // Cache hit — dispatch immediately, no network call.
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      dispatch({ type: isManual ? 'MANUAL_COMPLETE' : 'QUERY_COMPLETE', data: cached })
      return
    }

    activeQueryRef.current = cacheKey
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })

        if (!res.ok || !res.body) {
          const text = await res.text()
          dispatch({ type: isManual ? 'MANUAL_ERROR' : 'QUERY_ERROR', message: text || 'Request failed' })
          return
        }

        // Read NDJSON stream line by line
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let tokenCount = 0

        while (true) {
          const { done, value } = await reader.read()
          if (cancelled) { reader.cancel(); return }

          if (value) buffer += decoder.decode(value, { stream: true })

          // Process complete lines
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? '' // keep last incomplete line

          for (const raw of lines) {
            const line = raw.trim()
            if (!line) continue

            let msg: QueryStreamLine
            try {
              msg = JSON.parse(line) as QueryStreamLine
            } catch {
              continue
            }

            if (msg.type === 'delta') {
              tokenCount += msg.text.length
              dispatch({ type: 'TOKEN_DELTA', count: tokenCount })
            } else if (msg.type === 'result') {
              if (cancelled) return
              cacheRef.current.set(cacheKey, msg.data)
              activeQueryRef.current = null
              dispatch({ type: isManual ? 'MANUAL_COMPLETE' : 'QUERY_COMPLETE', data: msg.data })
              return
            } else if (msg.type === 'error') {
              if (cancelled) return
              activeQueryRef.current = null
              dispatch({ type: isManual ? 'MANUAL_ERROR' : 'QUERY_ERROR', message: msg.message })
              return
            }
          }

          if (done) break
        }
      } catch (e) {
        if (!cancelled) {
          activeQueryRef.current = null
          dispatch({ type: isManual ? 'MANUAL_ERROR' : 'QUERY_ERROR', message: String(e) })
        }
      }
    })()

    return () => { cancelled = true }
  }, [phaseType, phaseQuery])

  // Transition delay — give wipe animation ~1.5s before marking done
  useEffect(() => {
    if (phase.phase !== 'transitioning') return
    const t = setTimeout(() => {
      dispatch({ type: 'TRANSITION_DONE' })
      if (onReadyRef.current) onReadyRef.current(phase.next)
    }, 1500)
    return () => clearTimeout(t)
  }, [phase])

  // Dwell countdown
  useEffect(() => {
    if (phase.phase !== 'displaying') return
    if (phase.dwellRemaining <= 0) {
      dispatch({ type: 'DWELL_DONE' })
      return
    }
    const t = setInterval(() => dispatch({ type: 'DWELL_TICK' }), 1000)
    return () => clearInterval(t)
  }, [phase])

  // Auto-resume after manual query
  useEffect(() => {
    if (phase.phase !== 'displaying') {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current)
        resumeTimerRef.current = null
      }
    }
  }, [phase])

  const submitManualQuery = useCallback((query: string) => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    dispatch({ type: 'MANUAL_QUERY', query })
    resumeTimerRef.current = setTimeout(() => {
      dispatch({ type: 'RESUME_AUTO' })
    }, resumeAfterManualSeconds * 1000)
  }, [resumeAfterManualSeconds])

  return { phase: state.phase, playlistIndex: state.playlistIndex, submitManualQuery }
}
