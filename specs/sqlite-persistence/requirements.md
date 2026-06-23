# Requirements — SQLite Persistence for Billboard Items

## User Story

As a billboard operator, I want my playlist of queried items to survive page reloads and
server restarts so that I don't lose a curated set of visualisations between sessions.

---

## Requirements

### REQ-001 — Items are persisted to disk

**Acceptance criteria:**
- Every `BillboardItem` added to the playlist is written to a local SQLite database
  before the UI confirms it was added.
- The database file lives at `data/braille-billboard.db` under the project root.
- The directory is created automatically if it doesn't exist.

### REQ-002 — Items are restored on load

**Acceptance criteria:**
- When the app starts (or the page is hard-refreshed), the full playlist is rehydrated
  from SQLite in the order items were originally created.
- The billboard resumes cycling from the first item as if the user had just added them.

### REQ-003 — Deleting an item removes it from the database

**Acceptance criteria:**
- When the user deletes an item from the playlist, the corresponding row is removed from
  the database immediately.
- The item's OpenRAG `chatId` (if any) is retrieved from the database during deletion
  so the route can fire the OpenRAG conversation cleanup.

### REQ-004 — The database uses WAL mode and a lazy open strategy

**Acceptance criteria:**
- The SQLite connection uses `PRAGMA journal_mode = WAL`.
- The database file is not opened until the first API request touches it (no open at
  module load time).
- The connection is reused across requests (singleton).

### REQ-005 — Audio is preserved across sessions

**Acceptance criteria:**
- The base-64 encoded audio generated at query time is stored in the database alongside
  the item.
- On reload, audio plays normally for restored items (same behaviour as freshly queried
  items).

### REQ-006 — No data is stored in `localStorage` or in React state alone

**Acceptance criteria:**
- The playlist is the database — React state is a mirror of what SQLite holds, not the
  source of truth.
- `localStorage` is not used anywhere for playlist persistence.

---

## Out of Scope

- Multi-user or multi-session support — this is a single-user local app.
- Syncing the database to a remote store.
- Pagination or search within the persisted playlist.
- Schema versioning or migration tooling beyond the inline `ALTER TABLE` pattern already
  used in the codebase reference (`killrctx/src/lib/db.ts`).
- Persisting the `activeIndex` — the playlist always restarts from index 0 on reload.
- Persisting audio to disk as a file — base-64 in a TEXT column is sufficient for the
  volumes expected here.
