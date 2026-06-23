import { NextRequest } from 'next/server'
import { listItems, insertItem } from '@/lib/db'
import type { VisualizationData } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * GET /api/items
 *
 * Returns the full persisted billboard playlist, oldest-first.
 * Response: { items: PersistedItem[] }
 */
export async function GET() {
  const items = listItems()
  return Response.json({ items })
}

/**
 * POST /api/items
 *
 * Persists a newly completed billboard item.
 * Body: { id, query, chatId, data, audioB64 }
 * Response 201: { ok: true }
 */
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    id?: unknown
    query?: unknown
    chatId?: unknown
    data?: unknown
    audioB64?: unknown
  }

  const { id, query, chatId, data, audioB64 } = body

  if (typeof id !== 'string' || typeof query !== 'string' || !data) {
    return Response.json({ error: 'id, query, and data are required' }, { status: 400 })
  }

  insertItem({
    id,
    query,
    chatId: typeof chatId === 'string' ? chatId : null,
    data: data as VisualizationData,
    audioB64: typeof audioB64 === 'string' ? audioB64 : null,
  })

  return Response.json({ ok: true }, { status: 201 })
}
