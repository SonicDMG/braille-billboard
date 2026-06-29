'use client'

import { useReducer, useEffect, useRef, useCallback } from 'react'
import type { BillboardPhase, BillboardItem, VisualizationData, SpriteData } from '@/lib/types'
import { imageToSprite, spriteMapToData } from '@/lib/image-to-sprite'
import { extractFilterKey } from '@/lib/filter-key'

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
  /**
   * When non-null, only items whose filterKey === activeGroupKey participate
   * in auto-cycling. null means "all items".
   */
  activeGroupKey: string | null
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
  | { type: 'ITEM_SPRITE_SET'; id: string; spriteData: SpriteData | null }
  | { type: 'SET_GROUP'; key: string | null }
  | { type: 'ITEM_INCLUSION_SET'; id: string; included: boolean }

// ─────────────────────────────────────────────────────────────────────────────
// Group-aware helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the subset indices of items that belong to the active group.
 * When groupKey is null, all indices are included.
 */
function groupIndices(items: BillboardItem[], groupKey: string | null): number[] {
  return items.reduce<number[]>((acc, item, i) => {
    if (!item.included) return acc
    if (groupKey !== null && item.filterKey !== groupKey) return acc
    acc.push(i)
    return acc
  }, [])
}

/**
 * Given the current activeIndex, find the next index within the active group.
 * Returns null when the group is empty.
 */
function nextGroupIndex(
  items: BillboardItem[],
  currentIndex: number,
  groupKey: string | null,
): number | null {
  const indices = groupIndices(items, groupKey)
  if (indices.length === 0) return null
  const pos = indices.indexOf(currentIndex)
  if (pos === -1) {
    // Current item not in group — jump to first in group
    return indices[0]!
  }
  return indices[(pos + 1) % indices.length]!
}

/**
 * Find the first valid index within the active group, starting from `start`.
 * Falls back to the first item in the group when `start` is out of range.
 */
function firstGroupIndex(
  items: BillboardItem[],
  groupKey: string | null,
): number | null {
  const indices = groupIndices(items, groupKey)
  return indices.length > 0 ? indices[0]! : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

function reducer(state: CycleState, action: CycleAction): CycleState {
  const { phase } = state

  switch (action.type) {
    case 'START_NEXT': {
      if (phase.phase !== 'idle') return state
      if (state.items.length === 0) return state
      const indices = groupIndices(state.items, state.activeGroupKey)
      if (indices.length === 0) return state
      // Use activeIndex if it's in the group; otherwise start from the first group item.
      const idx = indices.includes(state.activeIndex) ? state.activeIndex : indices[0]!
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
      const nextIdx = nextGroupIndex(state.items, state.activeIndex, state.activeGroupKey)
      if (nextIdx === null) return { ...state, phase: { phase: 'idle' } }
      return {
        ...state,
        activeIndex: nextIdx,
        phase: {
          phase: 'loading',
          query: state.items[nextIdx]!.query,
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
      const nextIdx = nextGroupIndex(state.items, state.activeIndex, state.activeGroupKey)
      if (nextIdx === null) {
        return { ...state, phase: { phase: 'idle' } }
      }
      return {
        ...state,
        activeIndex: nextIdx,
        phase: {
          phase: 'loading',
          query: state.items[nextIdx]!.query,
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

    case 'ITEM_SPRITE_SET': {
      const items = state.items.map(it =>
        it.id === action.id ? { ...it, spriteData: action.spriteData } : it
      )
      return { ...state, items }
    }

    case 'ITEM_INCLUSION_SET': {
      const items = state.items.map(it =>
        it.id === action.id ? { ...it, included: action.included } : it
      )
      return { ...state, items }
    }

    case 'SET_GROUP': {
      // Switching group — find the first item in the new group (or keep current if in group).
      const key = action.key
      const firstIdx = firstGroupIndex(state.items, key)
      const newActiveIndex = firstIdx ?? state.activeIndex
      // If the billboard was displaying or idle, kick off a load for the new group item.
      const shouldLoad = phase.phase === 'displaying' || phase.phase === 'idle' || phase.phase === 'error'
      if (shouldLoad && firstIdx !== null) {
        return {
          ...state,
          activeGroupKey: key,
          activeIndex: newActiveIndex,
          phase: {
            phase: 'loading',
            query: state.items[newActiveIndex]!.query,
            tokenCount: 0,
            streamText: '',
          },
        }
      }
      return {
        ...state,
        activeGroupKey: key,
        activeIndex: newActiveIndex,
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
}

// NDJSON line shapes coming from /api/query
type QueryStreamLine =
  | { type: 'delta'; text: string }
  | { type: 'result'; data: VisualizationData; chatId?: string | null; audioB64?: string | null }
  | { type: 'error'; message: string }

export function useCycle({
  dwellSeconds,
  resumeAfterManualSeconds,
}: UseCycleOptions) {
  const [state, dispatch] = useReducer(reducer, {
    phase: { phase: 'idle' },
    activeIndex: 0,
    items: [],
    dwellSeconds,
    resumeAfterManualSeconds,
    activeGroupKey: null,
  })

  // Cache: prevents re-fetching the same question across cycles.
  const cacheRef = useRef<Map<string, { data: VisualizationData; chatId: string | null; audioB64: string | null }>>(new Map())

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
          // Ensure spriteData and filterKey are present for items persisted before these features.
          const items = json.items.map(it => ({
            ...it,
            spriteData: it.spriteData ?? null,
            filterKey: it.filterKey ?? '',
            included: it.included ?? true,
          }))
          for (const item of items) {
            cacheRef.current.set(item.query.trim().toLowerCase(), {
              data: item.data,
              chatId: item.chatId,
              audioB64: item.audioB64,
            })
          }
          dispatch({ type: 'ITEMS_LOADED', items })
          dispatch({ type: 'START_NEXT' })
        }
      } catch {
        // Non-fatal — app works fine with an empty playlist.
      }
    })()
  }, [])

  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { phase } = state
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
    const t = setTimeout(() => {
      dispatch({ type: 'TRANSITION_DONE' })
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
  const addItem = useCallback((query: string, chatId: string | null, data: VisualizationData, audioB64: string | null) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const filterKey = extractFilterKey(query)
    const item: BillboardItem = { id, query, chatId, data, audioB64, spriteData: null, filterKey, included: true }
    dispatch({ type: 'ITEM_ADDED', item })
    // If we were idle, start cycling immediately
    dispatch({ type: 'START_NEXT' })
    // Persist to SQLite — fire-and-forget, UI is not gated on write.
    void fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, query, chatId, data, audioB64, filterKey, included: true }),
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
    const item = stateRef.current.items.find(it => it.id === id)
    const chatId = item?.chatId ?? null
    // Evict from the in-memory cache so the same query re-fetches fresh data.
    if (item) cacheRef.current.delete(item.query.trim().toLowerCase())
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

  /**
   * Switch the active cycling group. Pass null to cycle through all items.
   */
  const setActiveGroup = useCallback((key: string | null) => {
    dispatch({ type: 'SET_GROUP', key })
  }, [])

  /**
   * Convert a user-supplied image file to a SpriteMap, attach it to the item
   * with the given id, and persist it to SQLite via PATCH /api/items/[id].
   *
   * The conversion target width (40 dot-columns) is a reasonable default for
   * a billboard grid; the actual placement is handled by computeSpriteRegion.
   */
  const setItemSprite = useCallback(async (id: string, file: File) => {
    const SPRITE_COLS = 40
    try {
      const spriteMap = await imageToSprite(file, SPRITE_COLS, { maskBackground: true })
      const spriteData = spriteMapToData(spriteMap)
      dispatch({ type: 'ITEM_SPRITE_SET', id, spriteData })
      void fetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spriteData }),
      })
    } catch (err) {
      console.warn('[useCycle] setItemSprite failed:', err instanceof Error ? err.message : String(err))
    }
  }, [])

  /**
   * Clear the sprite for an item and persist the removal.
   */
  const removeItemSprite = useCallback((id: string) => {
    dispatch({ type: 'ITEM_SPRITE_SET', id, spriteData: null })
    void fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spriteData: null }),
    })
  }, [])

  /**
   * Toggle an item's inclusion in the cycle and persist the change.
   */
  const setItemIncluded = useCallback((id: string, included: boolean) => {
    dispatch({ type: 'ITEM_INCLUSION_SET', id, included })
    void fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ included }),
    })
  }, [])

  return {
    phase: state.phase,
    activeIndex: state.activeIndex,
    items: state.items,
    activeGroupKey: state.activeGroupKey,
    submitManualQuery,
    addItem,
    deleteItem,
    jumpTo,
    setActiveGroup,
    lastManualChatIdRef,
    setItemSprite,
    removeItemSprite,
    setItemIncluded,
  }
}
