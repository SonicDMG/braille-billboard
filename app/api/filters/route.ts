import { listFilters } from '@/lib/openrag'

export const runtime = 'nodejs'

/**
 * GET /api/filters
 *
 * Returns all knowledge filters available in OpenRAG.
 * Used by the client-side @mention autocomplete in the query input.
 *
 * Response: { filters: Array<{ id: string; name: string; description?: string }> }
 */
export async function GET() {
  try {
    const filters = await listFilters()
    return Response.json({ filters })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/filters] failed to list filters:', message)
    return Response.json({ filters: [] })
  }
}
