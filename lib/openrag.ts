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
  return `You are writing copy for a large full-color LED dot-matrix roadside billboard. Every word must earn its place.
Be direct. Be memorable. Be funny when the subject is funny. Be stark when it is not.
Write like a copywriter, not an analyst. No hedging. No jargon. No filler.

QUERY: ${query}

Search the documents for the answer. Respond with this exact JSON — no prose, no markdown, nothing outside the JSON:

{
  "found": true,
  "chartType": "text",
  "title": "<the billboard headline — 2 to 6 words, punchy, printed 10 feet tall>",
  "summary": "<one sentence. The kind a driver reads at 60mph and remembers.>",
  "segments": [
    { "text": "<body copy — 1 to 3 sentences. The facts, the story, the argument.>", "color": { "type": "solid", "hex": "amber" } },
    { "text": "<tagline — 3 to 7 words. Short. Punchy. Impossible to forget.>",       "color": { "type": "solid", "hex": "white" } },
    { "text": "<SUBJECT NAME — the name of the person, product, or entity this billboard is about. 1 to 3 words maximum. This is the brand signature at the bottom of the billboard.>", "color": { "type": "solid", "hex": "gold" } }
  ],
  "dataPoints": [],
  "musicPrompt": "<10 words or fewer describing background music, e.g. low ominous strings in a dark hall>"
}

SEGMENT RULES:
- The LAST segment is always the subject name — the entity this billboard is about (a product, person, place, concept).
  It must be 1 to 3 words. It is the brand signature. It always appears.
- The FIRST segment is body copy — the facts, the story, the argument. 1 to 3 sentences.
- The MIDDLE segment (optional) is the tagline — punchy, 3 to 7 words. Use only when it genuinely adds impact.
- Total segments: 2 (body + subject) or 3 (body + tagline + subject).

COLOR GUIDE — choose the color that serves the copy:

Solid color — one color for the whole segment:
  { "type": "solid", "hex": "<name or hex>" }
  Named colors: amber, orange, red, yellow, lime, green, cyan, blue, indigo, violet, purple, pink, white, gold, teal
  Or use any CSS hex: "#ff4400"

Gradient — sweeps left to right across the segment:
  { "type": "gradient", "from": "<color>", "to": "<color>" }
  Use for transitions — fire, sunset, cold-to-hot, etc.

Rainbow — full hue cycle across the display width:
  { "type": "rainbow" }
  Use sparingly — for celebration, chaos, or when the subject is inherently colorful.

COLOR RULES:
- Body copy: use solid warm colors (amber, orange, gold) or thematic colors matching the subject.
- Taglines: use white, a bold contrasting color, or rainbow for maximum impact.
- Subject name: use gold, white, or a bright thematic color — it must stand out from the body copy.
- Be intentional. Pick colors that match the mood of the content.
- Every segment text must be plain — no bullet points, no special characters, no markdown.

Example — query: "tell me about Berserker Korg"
{
  "found": true,
  "chartType": "text",
  "title": "FURY BUILT. DEVASTATING BLOWS.",
  "summary": "35 HP. One bad mood. Do not approach.",
  "segments": [
    { "text": "Reckless Attack hits hard. Rage Strike hits harder. He does not stop until the floor is wet.", "color": { "type": "solid", "hex": "amber" } },
    { "text": "BUILD AGENTS. NOT BOILERPLATE.",                                                              "color": { "type": "gradient", "from": "red", "to": "orange" } },
    { "text": "BERSERKER KORG",                                                                             "color": { "type": "solid", "hex": "gold" } }
  ],
  "dataPoints": [],
  "musicPrompt": "heavy war drums building to a crash"
}

If the documents contain NO relevant information:
{ "found": false, "reason": "<one sentence>" }

WORD LIMITS — the display is physically finite. Respect these hard caps:
- Body segment: 25 words maximum.
- Tagline segment (middle, optional): 8 words maximum.
- Subject name segment (last): 3 words maximum.
- Total across ALL segments combined: 35 words maximum.
- Count every word before you write the JSON. If you are over, cut — do not compress or hyphenate.

Rules:
- title: short headline. Could be shouted from a moving vehicle.
- summary: one sentence. State the fact, land the joke, or make the threat.
- segments: always end with the subject name. Cut every word that does not pull its weight.
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
