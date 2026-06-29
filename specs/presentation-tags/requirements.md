# Requirements — Presentation Selection

## User story

As a presenter, I want to click-select which billboard items are included in the active
cycle so that I can curate exactly what displays during a live session without deleting
anything from my full history.

---

## Requirements

### REQ-001 — Per-item inclusion toggle
Each item in the billboard list has a toggleable "included" state.

**Acceptance criteria:**
- Default state for every new item is **included**.
- A single click on the toggle switches an item between included and excluded.
- Excluded items remain visible in the list panel (dimmed / marked) so they can be
  re-included.
- The toggle is always visible on every row (not just the active row).

### REQ-002 — Cycle respects the included set
When at least one item is explicitly excluded, auto-cycling and `←` `→` navigation
skip excluded items.

**Acceptance criteria:**
- Only included items participate in the dwell timer loop.
- `←` / `→` jump only to the next/previous included item.
- If the currently-displaying item is toggled off mid-display, it finishes its dwell
  then advances to the next included item.
- When *all* items are excluded, the cycle stops (no infinite skip loop).

### REQ-003 — Visual distinction for excluded items
Excluded items are clearly distinguishable from included items in the list.

**Acceptance criteria:**
- Excluded rows are visibly dimmer than included rows (opacity or color change).
- A small indicator (e.g. `·` vs `⠿` or a strike/dash) differentiates the two states
  without adding heavy UI chrome.
- The active (currently-displaying) item indicator is unaffected by inclusion state.

### REQ-004 — Persistence
Inclusion state survives a full page reload and app restart.

**Acceptance criteria:**
- Stored in the existing SQLite `items` table via the existing idempotent migration
  pattern (new `INTEGER` column, default 1 = included).
- The `PersistedItem` type gains an `included` boolean field.
- Toggling fires a `PATCH /api/items/[id]` call (reuses the existing route pattern).

---

## Out of scope

- Bulk select / deselect all.
- Named "presets" or saved selection sets.
- Reordering items.
- Any change to the OpenRAG query or filter pipeline.
- Any new tag/label strings — inclusion is a boolean, not a category.
