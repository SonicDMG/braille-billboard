# Design — SQLite Persistence for Billboard Items

## Overview

All playlist state currently lives in React reducer memory (`useCycle`). On page reload
or server restart the list is lost. This design adds a thin SQLite layer (one table,
three API routes) so the playlist survives sessions. The React state becomes a mirror of
the database; the database is the source of truth.

Reference implementation: `killrctx/src/lib/db.ts` — same `better-sqlite3` singleton
pattern, WAL mode, and lazy open strategy.

---

## SQLite changes

### New file: `lib/db.ts`

Single table, opened lazily, WAL mode.

```sql
CREATE TABLE IF NOT EXISTS items (
  id          TEXT    PRIMARY KEY,
  query       TEXT    NOT NULL,
  chat_id     TEXT,                  -- OpenRAG chatId; NULL if stream didn't return one
  data_json   TEXT    NOT NULL,      -- JSON-serialised VisualizationData
  audio_b64   TEXT,                  -- base-64 mp3; NULL if ElevenLabs was unavailable
  created_at  INTEGER NOT NULL       -- ms since epoch; ORDER BY this to restore playlist order
);
```

No migrations needed — this is a fresh table; `CREATE TABLE IF NOT EXISTS` is the only
guard required.

### Exported types

```ts
// Raw SQLite row
export type ItemRow = {
  id: string; query: string; chat_id: string | null;
  data_json: string; audio_b64: string | null; created_at: number;
};

// Deserialised form returned by the helper functions
export type PersistedItem = {
  id: string; query: string; chatId: string | null;
  data: VisualizationData; audioB64: string | null; createdAt: number;
};
```

### Exported helper functions

| Function | Signature | Notes |
|---|---|---|
| `listItems` | `() → PersistedItem[]` | `ORDER BY created_at ASC` |
| `insertItem` | `(item) → void` | `INSERT OR IGNORE` — idempotent on duplicate id |
| `deleteItem` | `(id) → string \| null` | Returns `chat_id` for OpenRAG cleanup; deletes row |

### Default export

A `Proxy` that forwards every property access to the lazily-opened `Database` instance,
matching the killrctx convention so future code can write `db.prepare(...)` directly.

---

## API routes

All routes must export `runtime = 'nodejs'` — `better-sqlite3` is a native module and
cannot run in the Edge runtime.

### `GET /api/items` — `app/api/items/route.ts`

Returns the full playlist in creation order.

**Response 200:**
```json
{ "items": [ { "id": "...", "query": "...", "chatId": "...", "data": {...}, "audioB64": "...", "createdAt": 0 } ] }
```

### `POST /api/items` — `app/api/items/route.ts`

Persists a newly completed item.

**Request body:**
```json
{ "id": "...", "query": "...", "chatId": "..." | null, "data": {...}, "audioB64": "..." | null }
```

**Response 201:** `{ "ok": true }`  
**Response 400:** `{ "error": "..." }` — if required fields are missing.

### `DELETE /api/items/[id]` — `app/api/items/[id]/route.ts`

Deletes the item from SQLite and fires the OpenRAG conversation cleanup.

**Response 200:** `{ "ok": true }`  
**Response 404:** `{ "error": "not found" }` — if id doesn't exist in the DB.

The existing `DELETE /api/conversation/[chatId]` route stays unchanged; this route
calls it internally (or calls `deleteConversation` from `lib/openrag.ts` directly —
same effect, avoids an extra HTTP hop).

---

## `lib/` changes

`lib/db.ts` — new file described above. No changes to any existing `lib/` module.

---

## UI / hook changes

### `hooks/useCycle.ts`

**Hydration on mount** — one `useEffect` with an empty dependency array fires a
`GET /api/items` request and dispatches `ITEMS_LOADED` for each returned item, so the
reducer initialises the list from the database instead of empty.

New action:
```ts
| { type: 'ITEMS_LOADED'; items: BillboardItem[] }
```

Reducer case — replaces the initial empty `items` array (safe to call once):
```ts
case 'ITEMS_LOADED':
  return { ...state, items: action.items }
```

**Persist on add** — `addItem` fires `POST /api/items` after dispatching `ITEM_ADDED`.
Fire-and-forget (`void fetch(...)`); the UI update is not gated on the write completing.

**Delete from DB** — `deleteItem` fires `DELETE /api/items/[id]` instead of
(or in addition to) the item removal from state. The DB route handles the OpenRAG
`chatId` cleanup, so `useCycle` no longer needs to know about chatIds at delete time.

### `components/Billboard.tsx`

Remove the inline `fetch('/api/conversation/${chatId}', { method: 'DELETE' })` call from
`handleDeleteItem` — that responsibility moves to `DELETE /api/items/[id]`. The handler
becomes a one-liner that just calls `deleteItem(id)`.

---

## REQ coverage

| REQ-ID | Design item |
|--------|-------------|
| REQ-001 | `POST /api/items` called from `addItem` in `useCycle`; `insertItem` in `lib/db.ts` |
| REQ-002 | `GET /api/items` + `ITEMS_LOADED` reducer action in `useCycle` mount effect |
| REQ-003 | `DELETE /api/items/[id]` retrieves `chatId` via `deleteItem()` then calls `deleteConversation` |
| REQ-004 | `getDb()` lazy singleton; `PRAGMA journal_mode = WAL` in `lib/db.ts` |
| REQ-005 | `audio_b64` column in `items` table; round-tripped through `POST` / `GET /api/items` |
| REQ-006 | `useCycle` hydrates from DB on mount; no `localStorage` calls anywhere in the playlist path |
