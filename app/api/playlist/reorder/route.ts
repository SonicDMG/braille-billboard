import { NextRequest } from 'next/server'
import { reorderPlaylist } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * PUT /api/playlist/reorder
 *
 * Atomically reset all playlist_order values from a fully-ordered id array.
 *
 * Body:     { ids: string[] }
 * Response: { ok: true }
 */
export async function PUT(req: NextRequest) {
  const body = await req.json() as { ids?: unknown }

  if (!Array.isArray(body.ids) || !body.ids.every(id => typeof id === 'string')) {
    return Response.json({ error: 'ids must be an array of strings' }, { status: 400 })
  }

  reorderPlaylist(body.ids as string[])
  return Response.json({ ok: true })
}
