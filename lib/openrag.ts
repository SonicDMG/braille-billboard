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
 * Wraps the user's query with JSON schema instructions so the model always
 * returns a structured response regardless of the server's system prompt.
 *
 * Includes an explicit no-data path so the parser can surface a clean error
 * instead of receiving unparseable prose.
 */
function buildVisualizationMessage(query: string): string {
  return `${query}

Using only information found in the documents, respond with a single JSON object — no prose, no markdown code fences, no explanation before or after.

If the answer contains numeric data (counts, amounts, percentages, durations, rankings, etc.), use this shape:

{
  "found": true,
  "chartType": "line" | "bar" | "sparkline",
  "title": "<concise title, max 60 chars>",
  "summary": "<one sentence describing the key insight>",
  "dataPoints": [{ "label": "<string>", "value": <number> }, ...],
  "unit": "<optional unit string, e.g. $ % ms — omit if not applicable>",
  "musicPrompt": "<natural-language ambient music description, e.g. warm uplifting jazz piano ascending 8 seconds>"
}

If the answer is descriptive, conceptual, or has no numeric data but the documents DO contain relevant information, use this shape instead:

{
  "found": true,
  "chartType": "text",
  "title": "<concise title, max 60 chars>",
  "summary": "<one sentence describing the key insight>",
  "words": "<the answer as plain prose, 2–5 sentences, no special characters>",
  "dataPoints": [],
  "musicPrompt": "<natural-language ambient music description>"
}

Only respond with found:false if the documents contain NO relevant information at all:
{ "found": false, "reason": "<brief explanation>" }

Rules:
- chartType: "line" for trends, "bar" for category comparisons, "sparkline" for compact overview, "text" for prose answers
- dataPoints values must be plain numbers — no currency symbols, no commas
- musicPrompt must describe coherent ambient audio; default to warm resolved tones
- Output the JSON object and nothing else`
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
