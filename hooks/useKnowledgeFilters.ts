'use client'

import { useState, useEffect } from 'react'
import type { FilterSummary } from '@/lib/openrag'

interface UseKnowledgeFiltersResult {
  filters: FilterSummary[]
  loading: boolean
}

/**
 * Fetches the list of available OpenRAG knowledge filters once on mount.
 * Silently swallows errors — returns an empty array if the endpoint fails.
 */
export function useKnowledgeFilters(): UseKnowledgeFiltersResult {
  const [filters, setFilters] = useState<FilterSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/filters')
        if (!res.ok) return
        const json = await res.json() as { filters: FilterSummary[] }
        if (!cancelled) setFilters(json.filters ?? [])
      } catch {
        // Non-fatal — mention autocomplete just won't show suggestions.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { filters, loading }
}
