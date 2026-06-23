# Tasks — SQLite Persistence for Billboard Items

## Tasks

- [x] TASK-01: [DB] Create `lib/db.ts` — `items` table, lazy `getDb()`, WAL, `listItems` / `insertItem` / `deleteItem` helpers, proxy default export
- [x] TASK-02: [API] Add `GET` and `POST` handlers to `app/api/items/route.ts`
- [x] TASK-03: [API] Add `DELETE` handler to `app/api/items/[id]/route.ts` — removes row, calls `deleteConversation` with retrieved `chatId`
- [x] TASK-04: [lib] Add `ITEMS_LOADED` action + reducer case to `hooks/useCycle.ts`; hydrate from `GET /api/items` on mount
- [x] TASK-05: [lib] Fire-and-forget `POST /api/items` in `addItem` inside `hooks/useCycle.ts`
- [x] TASK-06: [lib] Fire `DELETE /api/items/[id]` in `deleteItem` inside `hooks/useCycle.ts`; remove `chatId` parameter from the function signature
- [x] TASK-07: [UI] Update `handleDeleteItem` in `components/Billboard.tsx` — remove inline OpenRAG delete call; stop passing `chatId` to `deleteItem`
- [x] TASK-08: [verify] `npx tsc --noEmit` — 0 errors; `npm run build` — clean

## Deviations

- `deleteItem` return type changed from `string | null` to a tagged union `{ found: false } | { found: true; chatId: string | null }` — the original design was ambiguous between "row not found" and "row found but chatId was null". The tagged union makes the distinction explicit and keeps the DELETE route correct.
- Proxy default export dropped from `lib/db.ts` — no code in this app needs `db.prepare(...)` directly; the three named exports are sufficient and simpler.

## Done-when notes

- **TASK-01** — `lib/db.ts` already drafted as a working file on disk; review against design and commit as-is or adjust. `better-sqlite3` and `@types/better-sqlite3` already installed.
- **TASK-02** — Route exports `runtime = 'nodejs'`; `GET` returns `{ items: PersistedItem[] }`; `POST` accepts `{ id, query, chatId, data, audioB64 }`, calls `insertItem`, returns `{ ok: true }` with status 201.
- **TASK-03** — Route exports `runtime = 'nodejs'`; calls `deleteItem(id)` to get `chatId`, then calls `deleteConversation(chatId)` from `lib/openrag.ts` if `chatId` is non-null; returns 404 if `deleteItem` returned `null`.
- **TASK-04** — `ITEMS_LOADED` replaces `state.items` wholesale; mount effect fires once (empty deps); maps `PersistedItem[]` → `BillboardItem[]` (shapes are identical minus `createdAt`).
- **TASK-05** — `void fetch('/api/items', { method: 'POST', ... })` called after `dispatch({ type: 'ITEM_ADDED', item })`; UI is not gated on write.
- **TASK-06** — `deleteItem(id: string)` dispatches `ITEM_DELETED` then fires `void fetch('/api/items/${id}', { method: 'DELETE' })`; `chatId` param removed — DB route owns that.
- **TASK-07** — `handleDeleteItem` signature becomes `(id: string)` only; `BillboardList` `onDelete` prop type updated to match; call sites in `BillboardList.tsx` updated.
