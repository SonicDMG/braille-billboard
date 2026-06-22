'use client'

import { useReducer, useEffect, useRef, useCallback } from 'react'
import type { BillboardPhase, BillboardItem, VisualizationData } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// State & actions
// ─────────────────────────────────────────────────────────────────────────────

interface CycleState {
  phase: BillboardPhase
  /** Index into items[] currently being displayed / targeted */
  activeIndex: number
  items: BillboardItem[]
  dwellSeconds: number
  resumeAfterManualSeconds: number
}

type CycleAction =
  | { type: 'START_NEXT' }
  | { type: 'QUERY_COMPLETE'; data: VisualizationData; chatId: string | null }
  | { type: 'QUERY_ERROR'; message: string }
  | { type: 'TOKEN_DELTA'; count: number; text: string }
  | { type: 'TRANSITION_DONE' }
  | { type: 'DWELL_TICK' }
  | { type: 'DWELL_DONE' }
  | { type: 'MANUAL_QUERY'; query: string }
  | { type: 'MANUAL_COMPLETE'; data: VisualizationData; chatId: string | null }
  | { type: 'MANUAL_ERROR'; message: string }
  | { type: 'RESUME_AUTO' }
  | { type: 'ITEM_ADDED'; item: BillboardItem }
  | { type: 'ITEM_DELETED'; id: string }

function reducer(state: CycleState, action: CycleAction): CycleState {
  const { phase } = state

  switch (action.type) {
    case 'START_NEXT': {
      if (phase.phase !== 'idle') return state
      if (state.items.length === 0) return state
      const idx = state.activeIndex % state.items.length
      return {
        ...state,
        activeIndex: idx,
        phase: {
          phase: 'loading',
          query: state.items[idx]!.query,
          tokenCount: 0,
          streamText: '',
        },
      }
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
        phase: { ...phase, tokenCount: action.count, streamText: phase.streamText + action.text },
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
      return {
        ...state,
        phase: { ...phase, dwellRemaining: phase.dwellRemaining - 1 },
      }
    }

    case 'DWELL_DONE': {
      if (state.items.length === 0) return { ...state, phase: { phase: 'idle' } }
      const nextIndex = (state.activeIndex + 1) % state.items.length
      return {
        ...state,
        activeIndex: nextIndex,
        phase: {
          phase: 'loading',
          query: state.items[nextIndex]!.query,
          tokenCount: 0,
          streamText: '',
        },
      }
    }

    case 'MANUAL_QUERY':
      return {
        ...state,
        phase: { phase: 'manual', query: action.query, tokenCount: 0, streamText: '' },
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
      if (state.items.length === 0) {
        return { ...state, phase: { phase: 'idle' } }
      }
      const nextIndex = (state.activeIndex + 1) % state.items.length
      return {
        ...state,
        activeIndex: nextIndex,
        phase: {
          phase: 'loading',
          query: state.items[nextIndex]!.query,
          tokenCount: 0,
          streamText: '',
        },
      }
    }

    case 'ITEM_ADDED':
      return {
        ...state,
        items: [...state.items, action.item],
      }

    case 'ITEM_DELETED': {
      const filtered = state.items.filter(it => it.id !== action.id)
      // Clamp activeIndex if it's now out of range
      const newIndex = filtered.length === 0
        ? 0
        : Math.min(state.activeIndex, filtered.length - 1)
      return {
        ...state,
        items: filtered,
        activeIndex: newIndex,
      }
    }

    default:
      return state
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

interface UseCycleOptions {
  dwellSeconds: number
  resumeAfterManualSeconds: number
  onVisualizationReady?: (data: VisualizationData) => void
}

// NDJSON line shapes coming from /api/query
type QueryStreamLine =
  | { type: 'delta'; text: string }
  | { type: 'result'; data: VisualizationData; chatId?: string | null }
  | { type: 'error'; message: string }

export function useCycle({
  dwellSeconds,
  resumeAfterManualSeconds,
  onVisualizationReady,
}: UseCycleOptions) {
  const [state, dispatch] = useReducer(reducer, {
    phase: { phase: 'idle' },
    activeIndex: 0,
    items: [],
    dwellSeconds,
    resumeAfterManualSeconds,
  })

  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cache: prevents re-fetching the same question across cycles.
  const cacheRef = useRef<Map<string, { data: VisualizationData; chatId: string | null }>>(new Map())

  const { phase } = state
  const onReadyRef = useRef(onVisualizationReady)
  onReadyRef.current = onVisualizationReady

  // Track the query currently in-flight so TOKEN_DELTA updates don't re-trigger a fetch.
  const activeQueryRef = useRef<string | null>(null)

  const phaseType = phase.phase
  const phaseQuery = (phase.phase === 'loading' || phase.phase === 'manual') ? phase.query : null

  // Fire RAG query whenever we enter a new 'loading' or 'manual' phase.
  useEffect(() => {
    if (phaseType !== 'loading' && phaseType !== 'manual') return
    if (!phaseQuery) return

    const query = phaseQuery
    const isManual = phaseType === 'manual'
    const cacheKey = query.trim().toLowerCase()

    if (activeQueryRef.current === cacheKey) return

    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      dispatch({
        type: isManual ? 'MANUAL_COMPLETE' : 'QUERY_COMPLETE',
        data: cached.data,
        chatId: cached.chatId,
      })
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

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let tokenCount = 0

        while (true) {
          const { done, value } = await reader.read()
          if (cancelled) { reader.cancel(); return }

          if (value) buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

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
              dispatch({ type: 'TOKEN_DELTA', count: tokenCount, text: msg.text })
            } else if (msg.type === 'result') {
              if (cancelled) return
              const chatId = msg.chatId ?? null
              cacheRef.current.set(cacheKey, { data: msg.data, chatId })
              activeQueryRef.current = null
              if (isManual) lastManualChatIdRef.current = chatId
              dispatch({ type: isManual ? 'MANUAL_COMPLETE' : 'QUERY_COMPLETE', data: msg.data, chatId })
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

  // Transition delay
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

  // Clear resume timer when leaving 'displaying'
  useEffect(() => {
    if (phase.phase !== 'displaying') {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current)
        resumeTimerRef.current = null
      }
    }
  }, [phase])

  // ── Public API ──────────────────────────────────────────────────────────────

  // Set by the fetch effect when a manual query result arrives — allows callers
  // to read the chatId that came back from OpenRAG for the most recent manual query.
  const lastManualChatIdRef = useRef<string | null>(null)

  const submitManualQuery = useCallback((query: string) => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    dispatch({ type: 'MANUAL_QUERY', query })
    resumeTimerRef.current = setTimeout(() => {
      dispatch({ type: 'RESUME_AUTO' })
    }, resumeAfterManualSeconds * 1000)
  }, [resumeAfterManualSeconds])

  /**
   * Called when a query completes (manual or auto) and should be added to the
   * rotating billboard list. The caller provides the query string plus whatever
   * chatId was returned by the API.
   */
  const addItem = useCallback((query: string, chatId: string | null, data: VisualizationData) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const item: BillboardItem = { id, query, chatId, data }
    dispatch({ type: 'ITEM_ADDED', item })
    // If we were idle, start cycling immediately
    dispatch({ type: 'START_NEXT' })
  }, [])

  /**
   * Remove a billboard item from the list and optionally delete its OpenRAG
   * conversation. Deletion is fire-and-forget — UI updates immediately.
   */
  const deleteItem = useCallback((id: string) => {
    dispatch({ type: 'ITEM_DELETED', id })
  }, [])

  return {
    phase: state.phase,
    activeIndex: state.activeIndex,
    items: state.items,
    submitManualQuery,
    addItem,
    deleteItem,
    lastManualChatIdRef,
  }
}
