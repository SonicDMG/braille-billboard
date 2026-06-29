import { NextRequest } from 'next/server'
import { deleteItem, updateItemSprite, updateItemIncluded, updateItemData } from '@/lib/db'
import { deleteConversation } from '@/lib/openrag'
import type { SpriteData, VisualizationData } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * PATCH /api/items/[id]
 *
 * Updates the sprite_data for an item.
 *
 * Request body: { spriteData: Record<string, string> | null }
 * Response 200: { ok: true }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let spriteData: SpriteData | null | undefined = undefined  // undefined = not provided
  let included: boolean | undefined
  let data: VisualizationData | undefined
  try {
    const body = await req.json() as { spriteData?: unknown; included?: unknown; data?: unknown }
    if ('spriteData' in body) {
      if (body.spriteData && typeof body.spriteData === 'object' && !Array.isArray(body.spriteData)) {
        spriteData = body.spriteData as SpriteData
      } else {
        spriteData = null  // explicit null/falsy = intentional clear
      }
    }
    if (typeof body.included === 'boolean') {
      included = body.included
    }
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      data = body.data as VisualizationData
    }
  } catch { /* no body — no-op */ }

  if (included !== undefined) updateItemIncluded(id, included)
  if (spriteData !== undefined) updateItemSprite(id, spriteData)
  if (data !== undefined) updateItemData(id, data)
  return Response.json({ ok: true })
}

/**
 * DELETE /api/items/[id]
 *
 * Removes the item from SQLite and fires OpenRAG conversation cleanup.
 *
 * Accepts an optional JSON body `{ chatId?: string }`. When the DB row exists
 * its stored chatId takes precedence; the body chatId is used as a fallback so
 * that items whose POST /api/items write failed (or items that pre-date the DB)
 * still have their OpenRAG conversation cleaned up.
 *
 * Response 200: { ok: true }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Read optional fallback chatId from body (client passes item.chatId).
  let bodyChatId: string | null = null
  try {
    const body = await req.json() as { chatId?: unknown }
    if (typeof body.chatId === 'string') bodyChatId = body.chatId
  } catch { /* no body or non-JSON body — fine */ }

  const result = deleteItem(id)
  // Use chatId from DB row when found; fall back to body otherwise.
  const chatId = result.found ? result.chatId : bodyChatId

  // Fire OpenRAG cleanup regardless of whether the DB row existed.
  if (chatId) {
    try {
      await deleteConversation(chatId)
    } catch (err) {
      // Non-fatal — item is already removed from the UI.
      console.warn('[/api/items/delete] OpenRAG cleanup failed:', err instanceof Error ? err.message : String(err))
    }
  }

  return Response.json({ ok: true })
}
