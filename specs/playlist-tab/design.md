# Design — Playlist Tab

## Overview

The left panel gains a two-tab layout (`QUERY` | `PLAYLIST`) managed by a new
[`LeftPanel.tsx`](../../components/LeftPanel.tsx) wrapper component. `SplashPanel` is
renamed/refactored into the QUERY tab content; a new `PlaylistPanel` component handles
the PLAYLIST tab. The cycle state machine in `useCycle` is updated to drive from
`playlist_order` rather than the `included` flag.

---

## SQLite changes — `lib/db.ts`

### New column — `items.playlist_order`

```sql
ALTER TABLE items ADD COLUMN playlist_order INTEGER;
```

`NULL` = not in the playlist. Any non-null integer = position in the playlist (0-based).
Added via the existing idempotent migration block in `getDb()`:

```ts
if (!cols.some(c => c.name === 'playlist_order')) {
  conn.exec('ALTER TABLE items ADD COLUMN playlist_order INTEGER')
}
```

No backfill needed — `NULL` correctly means "not in playlist" for all pre-existing rows.

### `ItemRow` type
```ts
playlist_order: number | null
```

### `PersistedItem` type
```ts
playlistOrder: number | null   // null = not in playlist
```

### `rowToItem()`
```ts
playlistOrder: row.playlist_order ?? null,
```

### `insertItem()`
Accepts `playlistOrder?: number | null` (defaults to `null`). Writes the column.

### New function — `updatePlaylistOrder(id, order)`
```ts
export function updatePlaylistOrder(id: string, order: number | null): void
```
Single-column UPDATE. `null` removes the item from the playlist.

### New function — `reorderPlaylist(orderedIds)`
```ts
export function reorderPlaylist(orderedIds: string[]): void
```
Wraps a transaction that sets `playlist_order = i` for each `id` at index `i`.

---

## API changes

### New route — `GET /api/playlist`
Returns items where `playlist_order IS NOT NULL`, ordered by `playlist_order ASC`.

```
Response: { items: PersistedItem[] }
```

### New route — `POST /api/playlist`
Add an item to the playlist (appended at the end) or remove it.

```
Body: { id: string; action: 'add' | 'remove' }
Response: { ok: true }
```

For `add`: reads current max `playlist_order`, inserts at `max + 1`.
For `remove`: sets `playlist_order = NULL`.

### New route — `PUT /api/playlist/reorder`
Accepts a full ordered array of ids and resets all `playlist_order` values atomically.

```
Body: { ids: string[] }
Response: { ok: true }
```

All three routes export `runtime = 'nodejs'`.

---

## `lib/types.ts` changes

### `BillboardItem`
```ts
playlistOrder: number | null   // null = not in playlist
```

`included: boolean` field is **kept** in the type (backward compat with DB rows written
by the previous feature) but is no longer used by `useCycle` or any UI. It will be
removed in a future cleanup PR.

---

## `hooks/useCycle.ts` changes

### `groupIndices()` — replace `included` guard with `playlistOrder` guard

```ts
function groupIndices(items: BillboardItem[], groupKey: string | null): number[] {
  return items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => item.playlistOrder !== null)          // ← playlist only
    .filter(({ item }) => groupKey === null || item.filterKey === groupKey)
    .sort((a, b) => (a.item.playlistOrder ?? 0) - (b.item.playlistOrder ?? 0))
    .map(({ i }) => i)
}
```

This is the only cycle change needed — all downstream paths (`START_NEXT`, `DWELL_DONE`,
`RESUME_AUTO`, `nextGroupIndex`, `firstGroupIndex`) already call through this helper.

### New actions
```ts
| { type: 'PLAYLIST_SET'; id: string; playlistOrder: number | null }
| { type: 'PLAYLIST_REORDERED'; orderedIds: string[] }
```

### Reducer cases
`PLAYLIST_SET`: maps items, sets `playlistOrder` on the matching id.
`PLAYLIST_REORDERED`: maps items, sets `playlistOrder = orderedIds.indexOf(id)` (or null
if not in the array).

### Hydration (`ITEMS_LOADED`)
```ts
playlistOrder: it.playlistOrder ?? null,
```

### `addItem()`
New items always start with `playlistOrder: null` (not in playlist until explicitly added).

### New public callbacks
```ts
addToPlaylist(id: string): void
// dispatches PLAYLIST_SET with the next order number, fires POST /api/playlist

removeFromPlaylist(id: string): void
// dispatches PLAYLIST_SET with null, fires POST /api/playlist

reorderPlaylist(orderedIds: string[]): void
// dispatches PLAYLIST_REORDERED, fires PUT /api/playlist/reorder
```

All three returned from `useCycle`.

---

## New component — `components/PlaylistPanel.tsx`

```tsx
interface PlaylistPanelProps {
  items: BillboardItem[]           // full item list — filtered to playlist inside
  activeIndex: number
  onSelect: (index: number) => void
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onExportGif: () => void
  exportingGif: boolean
  exportProgress: { done: number; total: number } | null
  fontSize: number
}
```

Renders:
1. Playlist rows sorted by `playlistOrder`. Each row: position number, query label,
   ↑ / ↓ buttons (disabled at boundaries), remove (`✕`) button. Active item shown with `⠿`.
2. Empty state: `⠠ PLAYLIST EMPTY — add items from the QUERY tab`
3. Export GIF button at the bottom: `⠾ EXPORT GIF` / `⠿ ENCODING n/N` while in progress.

---

## New component — `components/LeftPanel.tsx`

Owns the `activeTab: 'query' | 'playlist'` state.

Renders:
- Tab bar (always visible, even in splash mode but styled differently)
- The `SplashPanel` content when `activeTab === 'query'`
- The `PlaylistPanel` content when `activeTab === 'playlist'`

The collapse/expand button moves here (currently in `SplashPanel`).

```tsx
interface LeftPanelProps {
  fontSize: number
  mode: 'splash' | 'split' | 'full'
  onToggleCollapse: () => void
  // QUERY tab props (passed through to SplashPanel)
  onSubmit: (query: string) => void
  isLoading: boolean
  streamEnergy: number
  billboardList: React.ReactNode
  // PLAYLIST tab props (passed through to PlaylistPanel)
  playlistProps: PlaylistPanelProps
}
```

---

## `components/Billboard.tsx` changes

- Replace `<SplashPanel ... billboardList={...} />` with `<LeftPanel ... />`.
- Destructure `addToPlaylist`, `removeFromPlaylist`, `reorderPlaylist` from `useCycle`.
- Add `exportingGif` / `exportProgress` state; wire `onExportGif` to call
  `dotMatrixRef.current?.capturePlaylistGif(...)`.
- Remove `handleToggleIncluded` / `setItemIncluded` (superseded by playlist membership).
- Pass `onAddToPlaylist` / `onRemoveFromPlaylist` to `BillboardList` (see below).

---

## `components/BillboardList.tsx` changes

- Remove `onToggleIncluded` prop and the `⠶`/`⠠` toggle button and bulk toggle.
- Add `onAddToPlaylist: (id: string) => void` prop.
- Each row: replace inclusion toggle with `⊕` (not in playlist) / `⊙` (already in playlist) button.
- `isInPlaylist` = `item.playlistOrder !== null`.

---

## `components/SplashPanel.tsx` changes

- Remove the collapse/expand button (moves to `LeftPanel`).
- Remove the `mode` prop handling for the collapse button specifically (mode itself stays
  for padding/font-size adjustments).

---

## REQ coverage

| REQ | Design item |
|-----|-------------|
| REQ-001 | `LeftPanel.tsx` tab bar; `activeTab` state |
| REQ-002 | `SplashPanel` unchanged minus collapse btn; `BillboardList` swap ⊕/⊙ for ⠶/⠠ |
| REQ-003 | `PlaylistPanel.tsx`; empty state; tab label with count |
| REQ-004 | `⊕`/`⊙` in `BillboardList`; `addToPlaylist`/`removeFromPlaylist` in `useCycle` |
| REQ-005 | ↑↓ buttons in `PlaylistPanel`; `reorderPlaylist` callback + `PUT /api/playlist/reorder` |
| REQ-006 | `groupIndices()` filters by `playlistOrder !== null` and sorts by order |
| REQ-007 | Export GIF button in `PlaylistPanel`; `capturePlaylistGif()` ref call in `Billboard` |
| REQ-008 | `playlist_order INTEGER NULL` migration; `updatePlaylistOrder`; `reorderPlaylist` DB fn |
