# Task List — Playlist Tab

## Tasks

### DB
- [ ] TASK-01: [DB] Add `playlist_order INTEGER` migration in `getDb()` in `lib/db.ts`
- [ ] TASK-02: [DB] Add `playlist_order` to `ItemRow`, `PersistedItem`, `rowToItem()`, `insertItem()` in `lib/db.ts`
- [ ] TASK-03: [DB] Add `updatePlaylistOrder(id, order)` export to `lib/db.ts`
- [ ] TASK-04: [DB] Add `reorderPlaylist(orderedIds)` export to `lib/db.ts`

### Types
- [ ] TASK-05: [lib] Add `playlistOrder: number | null` to `BillboardItem` in `lib/types.ts`

### API
- [ ] TASK-06: [API] Add `GET /api/playlist` route (`app/api/playlist/route.ts`)
- [ ] TASK-07: [API] Add `POST /api/playlist` route (add/remove single item)
- [ ] TASK-08: [API] Add `PUT /api/playlist/reorder` route (`app/api/playlist/reorder/route.ts`)

### Hook
- [ ] TASK-09: [hook] Replace `included` guard with `playlistOrder !== null` + sort in `groupIndices()` in `useCycle.ts`
- [ ] TASK-10: [hook] Add `PLAYLIST_SET` and `PLAYLIST_REORDERED` action types to `useCycle.ts`
- [ ] TASK-11: [hook] Add reducer cases for `PLAYLIST_SET` and `PLAYLIST_REORDERED`
- [ ] TASK-12: [hook] Normalise `playlistOrder` in `ITEMS_LOADED` hydration; set `playlistOrder: null` in `addItem()`
- [ ] TASK-13: [hook] Add `addToPlaylist`, `removeFromPlaylist`, `reorderPlaylist` callbacks; return from `useCycle`

### UI — new components
- [ ] TASK-14: [UI] Create `components/PlaylistPanel.tsx` (ordered list, ↑↓, remove, Export GIF button)
- [ ] TASK-15: [UI] Create `components/LeftPanel.tsx` (tab bar, owns `activeTab` state, renders SplashPanel or PlaylistPanel)

### UI — existing components
- [ ] TASK-16: [UI] Remove `onToggleIncluded` / bulk toggle from `BillboardList.tsx`; add `onAddToPlaylist` prop + `⊕`/`⊙` button
- [ ] TASK-17: [UI] Remove collapse/expand button from `SplashPanel.tsx` (moves to `LeftPanel`)
- [ ] TASK-18: [UI] Replace `<SplashPanel>` with `<LeftPanel>` in `Billboard.tsx`; wire all new callbacks + GIF export state

### Verify
- [ ] TASK-19: [verify] `npx tsc --noEmit` — zero type errors
- [ ] TASK-20: [verify] `npm run build` — zero errors
