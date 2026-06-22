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
        phase: { phase: 'loading', query: state.playlist[nextIndex]! },
      }
    }

    case 'MANUAL_QUERY':
      return {
        ...state,
        phase: { phase: 'manual', query: action.query },
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
        phase: { phase: 'loading', query: state.playlist[nextIndex]! },
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

  // Start on mount — only auto-start if the playlist has items.
  // If empty, stay in idle and wait for the user to submit a manual query.
  useEffect(() => {
    if (playlist.length > 0) {
      dispatch({ type: 'START' })
    }
  }, [playlist.length])

  // Fire RAG query whenever we enter 'loading' or 'manual'
  const { phase } = state
  const onReadyRef = useRef(onVisualizationReady)
  onReadyRef.current = onVisualizationReady

  useEffect(() => {
    if (phase.phase !== 'loading' && phase.phase !== 'manual') return
    const query = phase.query
    const isManual = phase.phase === 'manual'

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        const json = await res.json() as { ok: boolean; data?: VisualizationData; error?: string }
        if (cancelled) return
        if (!json.ok || !json.data) {
          dispatch({ type: isManual ? 'MANUAL_ERROR' : 'QUERY_ERROR', message: json.error ?? 'Unknown error' })
        } else {
          dispatch({ type: isManual ? 'MANUAL_COMPLETE' : 'QUERY_COMPLETE', data: json.data })
        }
      } catch (e) {
        if (!cancelled) {
          dispatch({ type: isManual ? 'MANUAL_ERROR' : 'QUERY_ERROR', message: String(e) })
        }
      }
    })()

    return () => { cancelled = true }
  }, [phase])

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
