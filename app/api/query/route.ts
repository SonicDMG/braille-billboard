import { NextRequest } from 'next/server'
import { streamForVisualization, resolveFilterMention, type ResolvedFilter } from '@/lib/openrag'
import { parseVisualizationData } from '@/lib/parse-viz'
import { generatePortraitSprite } from '@/lib/everart'

export const runtime = 'nodejs'

/**
 * Parse a single @mention token from a query string.
 * Returns `{ mention, cleanQuery }` where `mention` is the matched name (without @)
 * and `cleanQuery` is the query with the @mention stripped and whitespace normalised.
 * Returns `{ mention: null, cleanQuery: query }` when no @mention is present.
 */
function parseAtMention(query: string): { mention: string | null; cleanQuery: string } {
  const match = query.match(/@([\w-]+)/)
  if (!match) return { mention: null, cleanQuery: query }
  const mention = match[1]!
  const cleanQuery = query.replace(/@[\w-]+/, '').replace(/\s{2,}/g, ' ').trim()
  return { mention, cleanQuery }
}

/**
 * POST /api/query
 *
 * Streams NDJSON lines to the client:
 *   {"type":"delta","text":"..."}        — each content token as it arrives
 *   {"type":"result","data":{...},"chatId":"..."} — final parsed VisualizationData + chatId on success
 *   {"type":"error","message":"…"}       — on any failure
 */
export async function POST(req: NextRequest) {
  const body = await req.json() as { query?: unknown }
  const rawQuery = typeof body.query === 'string' ? body.query.trim() : ''

  if (!rawQuery) {
    return new Response(
      JSON.stringify({ type: 'error', message: 'query is required' }) + '\n',
      { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } },
    )
  }

  // Resolve an optional @filter-name mention before streaming.
  const { mention, cleanQuery: query } = parseAtMention(rawQuery)
  let filter: ResolvedFilter | undefined
  if (mention) {
    const resolved = await resolveFilterMention(mention)
    if (resolved) {
      filter = resolved
    } else {
      console.warn(`[/api/query] @${mention} did not match any knowledge filter — ignoring`)
    }
  }

  console.log('[/api/query] streaming query:', query, filter ? `filter:${filter.filterId}` : '')

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      function send(obj: Record<string, unknown>) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          // Controller was closed by client disconnect — stop sending.
          closed = true
        }
      }

      function close() {
        if (closed) return
        closed = true
        try { controller.close() } catch { /* already closed */ }
      }

      let accumulated = ''
      let chatId: string | null = null
      try {
        // Await the connection; then drain events — mirrors killrctx pattern.
        const events = await streamForVisualization(query, filter)

        for await (const event of events) {
          if (closed) break
          if (event.type === 'content') {
            accumulated += event.delta
            send({ type: 'delta', text: event.delta })
          } else if (event.type === 'done' && event.chatId) {
            chatId = event.chatId
          }
          // 'sources' silently consumed
        }

        if (closed) return

        console.log('[/api/query] stream complete, accumulated length:', accumulated.length, '| raw:', JSON.stringify(accumulated))

        let data
        try {
          data = parseVisualizationData(accumulated)
          console.log('[/api/query] parsed ok — chartType:', data.chartType)
        } catch (parseErr) {
          console.error('[/api/query] parse failed:', parseErr)
          console.error('[/api/query] raw was:\n', accumulated)
          send({ type: 'error', message: parseErr instanceof Error ? parseErr.message : String(parseErr) })
          return
        }

        // Generate EverArt portrait — non-blocking best-effort: attach if it
        // succeeds, send the result either way without delaying the response.
        try {
          const spriteData = await generatePortraitSprite(data.title, data.visualDescription)
          data.generatedSpriteData = spriteData
          console.log('[/api/query] EverArt sprite ready, keys:', Object.keys(spriteData).length)
        } catch (imgErr) {
          console.warn('[/api/query] EverArt generation failed (non-fatal):', imgErr instanceof Error ? imgErr.message : imgErr)
        }

        send({ type: 'result', data, chatId, audioB64: null })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[/api/query] stream error:', message)
        send({ type: 'error', message })
      } finally {
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
