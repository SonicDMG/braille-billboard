import { OpenRAGClient } from 'openrag-sdk'
import type { StreamEvent } from 'openrag-sdk'

let _client: OpenRAGClient | null = null

function getClient(): OpenRAGClient {
  if (!_client) {
    const baseUrl = process.env.OPENRAG_BASE_URL
    const apiKey = process.env.OPENRAG_API_KEY
    if (!baseUrl) throw new Error('OPENRAG_BASE_URL is not set')
    if (!apiKey) throw new Error('OPENRAG_API_KEY is not set')
    _client = new OpenRAGClient({ baseUrl, apiKey })
  }
  return _client
}

/**
 * Builds the message sent to the OpenRAG agent.
 *
 * Every response is billboard copy — text-only, punchy, written like a roadside
 * sign. No charts, no data tables, no analyst prose.
 */
function buildVisualizationMessage(query: string): string {
  return `You are writing copy for a large roadside billboard. Every word must earn its place.
Be direct. Be memorable. Be funny when the subject is funny. Be stark when it is not.
Write like a copywriter, not an analyst. No hedging. No jargon. No filler.

QUERY: ${query}

Search the documents for the answer. Respond with this exact JSON — no prose, no markdown, nothing outside the JSON:

{
  "found": true,
  "chartType": "text",
  "title": "<the billboard headline — 2 to 6 words, punchy, printed 10 feet tall>",
  "summary": "<one sentence. The kind a driver reads at 60mph and remembers.>",
  "words": "<the full billboard copy — 2 to 4 short sentences. Plain words. Punchy voice. No bullet points. No special characters.>",
  "dataPoints": [],
  "musicPrompt": "<10 words or fewer describing background music, e.g. low ominous strings in a dark hall>"
}

Example — query: "tell me about Berserker Korg"
{
  "found": true,
  "chartType": "text",
  "title": "FURY BUILT. DEVASTATING BLOWS.",
  "summary": "35 HP. One bad mood. Do not approach.",
  "words": "Korg does not strategize. He attacks. Reckless Attack hits hard. Rage Strike hits harder. When he is done, the floor is wet.",
  "dataPoints": [],
  "musicPrompt": "heavy war drums building to a crash"
}

If the documents contain NO relevant information:
{ "found": false, "reason": "<one sentence>" }

Rules:
- title: short headline. Could be shouted from a moving vehicle.
- summary: one sentence. State the fact, land the joke, or make the threat.
- words: write it for a billboard, not a report. If a word does not pull its weight, cut it.
- Output JSON only`
}

/**
 * Stream a visualization query to OpenRAG.
 *
 * Returns the AsyncIterable<StreamEvent> from the SDK directly.
 * Pattern mirrors killrctx: await the connection setup, then the caller
 * drains events with `for await`. The SDK's ChatStream handles cleanup.
 */
export function streamForVisualization(query: string): Promise<AsyncIterable<StreamEvent>> {
  const client = getClient()
  const message = buildVisualizationMessage(query)
  console.log('[openrag] → streaming query:', query)
  return client.chat.stream({ message })
}

/**
 * Delete an OpenRAG conversation by chatId.
 * Returns true if deleted, false if not found.
 */
export async function deleteConversation(chatId: string): Promise<boolean> {
  const client = getClient()
  return client.chat.delete(chatId)
}
