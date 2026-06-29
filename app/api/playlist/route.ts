import { NextRequest } from 'next/server'
import { listItems, updatePlaylistOrder, maxPlaylistOrder } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * GET /api/playlist
 *
 * Returns items that have a non-null playlist_order, sorted by playlist_order ASC.
 * Response: { items: PersistedItem[] }
 */
export async function GET() {
  const all = listItems()
  const playlist = all
    .filter(it => it.playlistOrder !== null)
    .sort((a, b) => (a.playlistOrder ?? 0) - (b.playlistOrder ?? 0))
  return Response.json({ items: playlist })
}

/**
 * POST /api/playlist
 *
 * Add or remove a single item from the playlist.
 *
 * Body:   { id: string; action: 'add' | 'remove' }
 * Add:    appends at max playlist_order + 1
 * Remove: sets playlist_order = NULL
 *
 * Response 200: { ok: true }
 */
export async function POST(req: NextRequest) {
  const body = await req.json() as { id?: unknown; action?: unknown }

  if (typeof body.id !== 'string' || (body.action !== 'add' && body.action !== 'remove')) {
    return Response.json({ error: 'id (string) and action ("add"|"remove") are required' }, { status: 400 })
  }

  if (body.action === 'add') {
    const nextOrder = maxPlaylistOrder() + 1
    updatePlaylistOrder(body.id, nextOrder)
  } else {
    updatePlaylistOrder(body.id, null)
  }

  return Response.json({ ok: true })
}
