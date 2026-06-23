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
  | { type: 'QUERY_COMPLETE'; data: VisualizationData; chatId: string | null; audioB64: string | null }
  | { type: 'QUERY_ERROR'; message: string }
  | { type: 'TOKEN_DELTA'; count: number; text: string }
  | { type: 'TRANSITION_DONE' }
  | { type: 'DWELL_TICK' }
  | { type: 'DWELL_DONE' }
  | { type: 'MANUAL_QUERY'; query: string }
  | { type: 'MANUAL_COMPLETE'; data: VisualizationData; chatId: string | null; audioB64: string | null }
  | { type: 'MANUAL_ERROR'; message: string }
  | { type: 'RESUME_AUTO' }
  | { type: 'ITEMS_LOADED'; items: BillboardItem[] }
  | { type: 'ITEM_ADDED'; item: BillboardItem }
  | { type: 'ITEM_DELETED'; id: string }
  | { type: 'JUMP_TO'; index: number }

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
        phase: { phase: 'transitioning', next: action.data, audioB64: action.audioB64 },
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
        phase: { phase: 'transitioning', next: action.data, audioB64: action.audioB64 },
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

    case 'ITEMS_LOADED':
      return { ...state, items: action.items }

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

    case 'JUMP_TO': {
      if (state.items.length === 0) return state
      const idx = ((action.index % state.items.length) + state.items.length) % state.items.length
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
  onVisualizationReady?: (data: VisualizationData, audioB64: string | null) => void
  /** When false, the API will skip calling ElevenLabs. */
  musicEnabled?: boolean
}

// NDJSON line shapes coming from /api/query
type QueryStreamLine =
  | { type: 'delta'; text: string }
  | { type: 'result'; data: VisualizationData; chatId?: string | null; audioB64?: string | null }
  | { type: 'error'; message: string }

export function useCycle({
  dwellSeconds,
  resumeAfterManualSeconds,
  onVisualizationReady,
  musicEnabled = true,
}: UseCycleOptions) {
  const [state, dispatch] = useReducer(reducer, {
    phase: { phase: 'idle' },
    activeIndex: 0,
    items: [],
    dwellSeconds,
    resumeAfterManualSeconds,
  })

  // Cache: prevents re-fetching the same question across cycles.
  const cacheRef = useRef<Map<string, { data: VisualizationData; chatId: string | null; audioB64: string | null }>>(new Map())
  // Mutable ref so the fetch closure always reads the latest musicEnabled without restarting.
  const musicEnabledRef = useRef(musicEnabled)
  musicEnabledRef.current = musicEnabled

  // Hydrate playlist from SQLite on first mount.
  // Pre-populate the cache with every restored item so the loading phase
  // resolves instantly from stored data instead of re-querying OpenRAG.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/items')
        if (!res.ok) return
        const json = await res.json() as { items: BillboardItem[] }
        if (json.items.length > 0) {
          for (const item of json.items) {
            cacheRef.current.set(item.query.trim().toLowerCase(), {
              data: item.data,
              chatId: item.chatId,
              audioB64: item.audioB64,
            })
          }
          dispatch({ type: 'ITEMS_LOADED', items: json.items })
          dispatch({ type: 'START_NEXT' })
        }
      } catch {
        // Non-fatal — app works fine with an empty playlist.
      }
    })()
  }, [])

  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        audioB64: cached.audioB64,
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
          body: JSON.stringify({ query, musicEnabled: musicEnabledRef.current }),
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
              const audioB64 = msg.audioB64 ?? null
              cacheRef.current.set(cacheKey, { data: msg.data, chatId, audioB64 })
              activeQueryRef.current = null
              if (isManual) lastManualChatIdRef.current = chatId
              dispatch({ type: isManual ? 'MANUAL_COMPLETE' : 'QUERY_COMPLETE', data: msg.data, chatId, audioB64 })
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
    const audioB64 = phase.audioB64
    const t = setTimeout(() => {
      dispatch({ type: 'TRANSITION_DONE' })
      if (onReadyRef.current) onReadyRef.current(phase.next, audioB64)
    }, 1500)
    return () => clearTimeout(t)
  }, [phase])

  // Dwell countdown — only runs when the active item has no audio.
  // When there IS audio, Billboard drives dwell via triggerDwellDone() on the
  // song's 'ended' event instead.
  const activeItemHasAudio = state.items[state.activeIndex]?.audioB64 != null
  useEffect(() => {
    if (phase.phase !== 'displaying') return
    if (activeItemHasAudio) return
    if (phase.dwellRemaining <= 0) {
      dispatch({ type: 'DWELL_DONE' })
      return
    }
    const t = setInterval(() => dispatch({ type: 'DWELL_TICK' }), 1000)
    return () => clearInterval(t)
  }, [phase, activeItemHasAudio])

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
  const addItem = useCallback((query: string, chatId: string | null, data: VisualizationData, audioB64: string | null) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const item: BillboardItem = { id, query, chatId, data, audioB64 }
    dispatch({ type: 'ITEM_ADDED', item })
    // If we were idle, start cycling immediately
    dispatch({ type: 'START_NEXT' })
    // Persist to SQLite — fire-and-forget, UI is not gated on write.
    void fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, query, chatId, data, audioB64 }),
    })
  }, [])

  // Stable ref to current state so deleteItem can read chatId without
  // being re-created on every state change.
  const stateRef = useRef(state)
  stateRef.current = state

  /**
   * Remove a billboard item from the list. Dispatches immediately so the UI
   * updates at once, then fires DELETE /api/items/[id] to remove the SQLite row
   * and clean up the OpenRAG conversation server-side. Passes chatId in the
   * request body as a fallback for items whose DB row may not exist.
   */
  const deleteItem = useCallback((id: string) => {
    const chatId = stateRef.current.items.find(it => it.id === id)?.chatId ?? null
    dispatch({ type: 'ITEM_DELETED', id })
    void fetch(`/api/items/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId }),
    })
  }, [])

  const jumpTo = useCallback((index: number) => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    dispatch({ type: 'JUMP_TO', index })
  }, [])

  const triggerDwellDone = useCallback(() => {
    dispatch({ type: 'DWELL_DONE' })
  }, [])

  return {
    phase: state.phase,
    activeIndex: state.activeIndex,
    items: state.items,
    submitManualQuery,
    addItem,
    deleteItem,
    jumpTo,
    triggerDwellDone,
    lastManualChatIdRef,
  }
}
