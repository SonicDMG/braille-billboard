/**
 * Derive a stable group key from a query string.
 *
 * Extracts all @mention tokens, sorts them case-insensitively, and joins with '|'.
 * Returns '' when no @mentions are present (the "unfiltered" group).
 *
 * Examples:
 *   "tell me about @DnD characters" → "dnd"
 *   "@wiki @dnd lore"               → "dnd|wiki"
 *   "what is the weather today"     → ""
 */
export function extractFilterKey(query: string): string {
  const matches = query.match(/@([\w-]+)/g)
  if (!matches || matches.length === 0) return ''
  return matches
    .map(m => m.slice(1).toLowerCase())
    .sort()
    .join('|')
}
