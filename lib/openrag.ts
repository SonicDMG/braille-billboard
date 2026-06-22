import { OpenRAGClient } from 'openrag-sdk'

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

Using only information found in the documents, respond with a single JSON object in exactly this shape — no prose, no markdown code fences, no explanation before or after:

{
  "found": true,
  "chartType": "line" | "bar" | "sparkline",
  "title": "<concise title, max 60 chars>",
  "summary": "<one sentence describing the key insight>",
  "dataPoints": [{ "label": "<string>", "value": <number> }, ...],
  "unit": "<optional unit string, e.g. $ % ms — omit if not applicable>",
  "musicPrompt": "<natural-language ambient music description, e.g. warm uplifting jazz piano ascending 8 seconds>"
}

If the documents do not contain relevant data to answer this question, respond with exactly:
{ "found": false, "reason": "<brief explanation of what was missing>" }

Rules:
- chartType: use "line" for time-series or trends, "bar" for category comparisons, "sparkline" for a compact overview
- dataPoints values must be plain numbers — no currency symbols, no commas
- musicPrompt must describe coherent, musical ambient audio; default to warm resolved tones; only use tension if the data strongly warrants it
- Output the JSON object and nothing else`
}

/**
 * Send a visualization query to OpenRAG and return the raw model reply string.
 * The caller is responsible for parsing the response via parse-viz.ts.
 */
export async function queryForVisualization(query: string): Promise<string> {
  const client = getClient()
  const message = buildVisualizationMessage(query)

  console.log('[openrag] → query:', query)
  console.log('[openrag] → full message length:', message.length)

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('OpenRAG request timed out after 30s')), 30_000)
  )

  const request = client.chat.create({
    message,
    stream: false,
  })

  const response = await Promise.race([request, timeout])

  console.log('[openrag] ← raw response:', response.response)
  if (response.sources?.length) {
    console.log('[openrag] ← sources:', response.sources.map(s => s.filename))
  } else {
    console.log('[openrag] ← no sources returned')
  }

  return response.response
}
