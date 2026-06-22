import { NextRequest } from 'next/server'
import { deleteConversation } from '@/lib/openrag'

export const runtime = 'nodejs'

/**
 * DELETE /api/conversation/[chatId]
 *
 * Deletes the OpenRAG conversation for the given chatId.
 * Returns 200 { success: true } or 404/500 with { error: "..." }.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await params
  if (!chatId) {
    return Response.json({ error: 'chatId is required' }, { status: 400 })
  }

  try {
    const ok = await deleteConversation(chatId)
    if (!ok) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 })
    }
    return Response.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/conversation/delete] error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
