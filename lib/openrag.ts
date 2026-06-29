import { OpenRAGClient } from 'openrag-sdk'
import type { StreamEvent, SearchFilters } from 'openrag-sdk'

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
    { "text": "<body copy — 1 to 2 sentences maximum. 12 words or fewer. Punchy rhythm.>", "color": { "type": "solid", "hex": "amber" } },
    { "text": "<tagline — 3 to 6 words. Short. Impossible to forget.>",                    "color": { "type": "solid", "hex": "white" } },
    { "text": "<SUBJECT NAME — the name of the person, product, or entity this billboard is about. 1 to 3 words maximum. This is the brand signature at the bottom of the billboard.>", "color": { "type": "solid", "hex": "gold" } }
  ],
  "dataPoints": [],
  "entranceStyle": "<one of: fly-in | dissolve | sparkle | typewriter | exploding | tetris>",
  "visualDescription": "<1–2 sentences describing what the subject looks like — appearance, colors, defining features. Written for an image-generation model, not a reader. Omit for abstract or data queries.>"
}

SEGMENT RULES:
- The LAST segment is always the subject name — the entity this billboard is about (a product, person, place, concept).
  It must be 1 to 3 words. It is the brand signature. It always appears.
- The FIRST segment is body copy — the facts, told with rhythm. 1 to 2 sentences. 12 words maximum.
- The MIDDLE segment (optional) is the tagline — punchy, 3 to 6 words. Use only when it genuinely adds impact.
- Total segments: 2 (body + subject) or 3 (body + tagline + subject).

VISUAL DESCRIPTION RULES:
- Include "visualDescription" only when the subject has a concrete visual form (a character, creature, object, place, or person).
- Describe appearance: silhouette, dominant colors, textures, defining features (weapon, clothing, face, markings).
- Write for an image-generation model. Be specific. No metaphors. No narrative. Just visual facts.
- Omit the field entirely for abstract concepts, statistics, or data queries.

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

ENTRANCE STYLE GUIDE — choose the style that fits the subject mood:
- fly-in:    fast, urgent, kinetic — action, breaking news
- dissolve:  slow, atmospheric — cinematic, contemplative
- sparkle:   celebratory, electric — upbeat, festive
- typewriter: deliberate, weighty — somber, minimal
- exploding: intense, dramatic — power, revelation, impact
- tetris:    structured, methodical — data, systems, precision

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
    { "text": "Reckless Attack. Rage Strike. He hits until nothing moves.", "color": { "type": "solid", "hex": "amber" } },
    { "text": "BUILD AGENTS. NOT BOILERPLATE.",                                                              "color": { "type": "gradient", "from": "red", "to": "orange" } },
    { "text": "BERSERKER KORG",                                                                             "color": { "type": "solid", "hex": "gold" } }
  ],
  "dataPoints": [],
  "entranceStyle": "sparkle"
}

If the documents contain NO relevant information:
{ "found": false, "reason": "<one sentence>" }

WORD LIMITS — text shares the display with a large portrait image. Keep it tight:
- Body segment: 12 words maximum.
- Tagline segment (middle, optional): 6 words maximum.
- Subject name segment (last): 3 words maximum.
- Total across ALL segments combined: 20 words maximum.
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
/** A minimal filter shape safe to serialize to the client. */
export interface FilterSummary {
  id: string
  name: string
  description?: string
}

/**
 * List all knowledge filters (up to 100).
 * Returns minimal shape — id + name + description — safe to send to the browser.
 */
export async function listFilters(): Promise<FilterSummary[]> {
  const client = getClient()
  const filters = await client.knowledgeFilters.search(undefined, 100)
  return filters.map(f => ({ id: f.id, name: f.name, description: f.description }))
}

/** Resolved filter details needed to scope a chat request. */
export interface ResolvedFilter {
  filterId: string
  filters?: SearchFilters
  limit?: number
  scoreThreshold?: number
}

/**
 * Resolve a knowledge-filter name (from an @mention) to its full filter details.
 * Returns null if no exact (case-insensitive) name match is found.
 *
 * We fetch the full KnowledgeFilter so we can also pass its queryData.filters,
 * limit, and scoreThreshold directly in the chat request — this ensures the
 * document scope is applied even if the server-side filter_id lookup doesn't
 * propagate all constraints through the agent retrieval path.
 */
export async function resolveFilterMention(name: string): Promise<ResolvedFilter | null> {
  const client = getClient()
  // Normalise hyphens used in the @token back to spaces for filter name lookup
  const normalisedName = name.replace(/-/g, ' ')
  const filters = await client.knowledgeFilters.search(normalisedName)
  const match = filters.find(f => f.name.toLowerCase() === normalisedName.toLowerCase())
  if (!match) return null

  // Fetch the full filter to get queryData constraints
  const full = await client.knowledgeFilters.get(match.id)
  if (!full) return null

  const resolved: ResolvedFilter = { filterId: full.id }

  // Only pass data_sources — never document_types, owners, connector_types.
  // killrctx confirmed this: sending those extra fields (even as ['*'])
  // causes OpenRAG to return 0 results. data_sources is the only constraint
  // that scopes retrieval correctly.
  const qf = full.queryData.filters as Record<string, unknown> | undefined
  const rawSources = qf?.['data_sources']
  if (Array.isArray(rawSources)) {
    const sources = rawSources.filter((v): v is string => typeof v === 'string' && v !== '*')
    if (sources.length > 0) resolved.filters = { data_sources: sources }
  }

  if (full.queryData.limit) resolved.limit = full.queryData.limit
  if (full.queryData.scoreThreshold) resolved.scoreThreshold = full.queryData.scoreThreshold

  console.log(`[openrag] resolved filter "${name}" →`, JSON.stringify({
    filterId: resolved.filterId,
    filters: resolved.filters,
    limit: resolved.limit,
    scoreThreshold: resolved.scoreThreshold,
  }, null, 2))
  return resolved
}

export async function streamForVisualization(query: string, filter?: ResolvedFilter): Promise<AsyncIterable<StreamEvent>> {
  const client = getClient()
  const message = buildVisualizationMessage(query)
  const params = {
    message,
    ...(filter ? {
      filterId: filter.filterId,
      ...(filter.filters ? { filters: filter.filters } : {}),
      limit: filter.limit ?? 8,
      ...(filter.scoreThreshold != null ? { scoreThreshold: filter.scoreThreshold } : {}),
    } : {}),
  }
  console.log('[openrag] chat.stream →', JSON.stringify(params, null, 2))
  const stream = await client.chat.stream(params)

  async function* withDebugLog(): AsyncIterable<StreamEvent> {
    let accumulated = ''
    for await (const event of stream) {
      if (event.type === 'content') accumulated += event.delta
      yield event
    }
    console.log('[openrag] ← LLM response:\n', accumulated)
  }

  return withDebugLog()
}

/**
 * Delete an OpenRAG conversation by chatId.
 * Returns true if deleted, false if not found.
 */
export async function deleteConversation(chatId: string): Promise<boolean> {
  const client = getClient()
  return client.chat.delete(chatId)
}
