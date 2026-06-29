# Requirements — Playlist Tab

## User story

As a presenter, I want a dedicated Playlist tab in the left panel so that I can curate,
order, and control exactly what the billboard cycles through, keeping my query history
completely separate from the live presentation.

---

## Requirements

### REQ-001 — Two-tab left panel
The left panel gains a tab bar with two tabs: **QUERY** and **PLAYLIST**.

**Acceptance criteria:**
- The tab bar is always visible in split and splash modes.
- Switching tabs does not affect the billboard display on the right.
- The active tab is visually distinguished from the inactive one.
- Default tab on load is QUERY.

### REQ-002 — QUERY tab (existing behaviour, preserved)
The QUERY tab contains everything the current left panel shows today: the braille wave
animation, the query input, and the billboard history list.

**Acceptance criteria:**
- All existing query, history, sprite, GIF-export, and group-filter behaviour is intact.
- The per-item `⠶`/`⠠` inclusion toggle is **removed** from the history list; items are
  added to the playlist via an explicit "add" action instead (see REQ-004).
- The INCL ALL / EXCL ALL bulk toggle is removed (replaced by playlist membership).

### REQ-003 — PLAYLIST tab
The PLAYLIST tab shows only the items that have been explicitly added to the playlist,
in their presentation order.

**Acceptance criteria:**
- Each row shows the item's query label, its position number, and action buttons.
- When the playlist is empty a short empty-state message is shown.
- The tab label shows the current playlist item count (e.g. `PLAYLIST 3`).

### REQ-004 — Add / remove items from the playlist
Items are promoted from the history list (QUERY tab) to the playlist explicitly.

**Acceptance criteria:**
- Each history row gains an "add to playlist" button (`⊕`). Pressing it appends the
  item to the end of the playlist and changes the button to a "remove" indicator (`⊙`).
- Pressing the remove indicator removes the item from the playlist.
- An item can only appear in the playlist once.
- Removing an item from the playlist does not delete it from history.

### REQ-005 — Playlist ordering
Items in the playlist can be reordered with ↑ / ↓ buttons.

**Acceptance criteria:**
- Each playlist row has ↑ and ↓ buttons; ↑ is disabled on the first item, ↓ on the last.
- Moving an item updates the persisted order immediately.

### REQ-006 — Cycle plays only from the playlist
The auto-cycle and `←` `→` navigation use the playlist order exclusively. The query
history does not participate in auto-cycling.

**Acceptance criteria:**
- Only playlist items cycle; history-only items are never auto-displayed.
- When the playlist is empty the billboard shows the idle braille animation.
- A manual query still renders immediately on the right panel, but does not
  interrupt an active playlist cycle (it displays once, then the cycle resumes).

### REQ-007 — Playlist GIF export
The PLAYLIST tab has an "Export GIF" button that renders all playlist items in order
into a single animated GIF.

**Acceptance criteria:**
- The button is disabled while encoding; a progress label shows `ENCODING n/N`.
- On completion the GIF is downloaded as `presentation.gif`.
- Uses the existing `capturePlaylistGif()` handle already implemented on `DotMatrixDisplay`.

### REQ-008 — Persistence
Playlist membership and order survive a full page reload.

**Acceptance criteria:**
- Stored in SQLite via a new `playlist_order` column on the `items` table
  (`INTEGER`, nullable — `NULL` means not in the playlist).
- The existing idempotent migration pattern is used.
- `included` boolean column from the previous feature is **removed from active use**
  (column kept in DB for migration safety, but ignored by all new code).

---

## Out of scope

- Drag-to-reorder (↑↓ buttons are sufficient).
- Multiple named playlists.
- Syncing the playlist across devices or users.
- Any change to the OpenRAG query pipeline.
