import { NextRequest } from 'next/server'
import { deleteItem } from '@/lib/db'
import { deleteConversation } from '@/lib/openrag'

export const runtime = 'nodejs'

/**
 * DELETE /api/items/[id]
 *
 * Removes the item from SQLite and fires OpenRAG conversation cleanup.
 * Response 200: { ok: true }
 * Response 404: { error: 'not found' }
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const result = deleteItem(id)
  if (!result.found) {
    return Response.json({ error: 'not found' }, { status: 404 })
  }

  // Fire OpenRAG cleanup if the item had a conversation thread.
  if (result.chatId) {
    try {
      await deleteConversation(result.chatId)
    } catch (err) {
      // Non-fatal — item is already gone from the DB.
      console.warn('[/api/items/delete] OpenRAG cleanup failed:', err instanceof Error ? err.message : String(err))
    }
  }

  return Response.json({ ok: true })
}
