import { NextRequest } from 'next/server'
import { streamForVisualization } from '@/lib/openrag'
import { parseVisualizationData } from '@/lib/parse-viz'

export const runtime = 'nodejs'

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
  const query = typeof body.query === 'string' ? body.query.trim() : ''

  if (!query) {
    return new Response(
      JSON.stringify({ type: 'error', message: 'query is required' }) + '\n',
      { status: 400, headers: { 'Content-Type': 'application/x-ndjson' } },
    )
  }

  console.log('[/api/query] streaming query:', query)

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
        const events = await streamForVisualization(query)

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
