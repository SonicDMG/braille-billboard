# Requirements — Selectable Billboard List Items

## User Story

As a billboard operator, I want to click a playlist item in the panel to immediately jump
to that billboard so that I can navigate the playlist without waiting for the auto-cycle.

---

## Requirements

### REQ-001 — Clicking an item jumps to it

**Acceptance criteria:**
- Clicking anywhere on a playlist row (except the delete button) immediately loads and
  displays that item's billboard.
- The clicked item becomes the active item (highlighted with the `⠿` indicator).
- The existing `jumpTo` mechanism in `useCycle` is used — no new state is needed.

### REQ-002 — Cursor indicates clickability

**Acceptance criteria:**
- Non-active rows show a `pointer` cursor on hover.
- The active row does not show a pointer cursor (clicking it again does nothing meaningful).

### REQ-003 — Visual hover feedback on non-active rows

**Acceptance criteria:**
- Hovering a non-active row brightens its query label text slightly so the row feels
  interactive.
- The transition is consistent with the existing `0.3s` transitions on the row.

### REQ-004 — Delete button is unaffected

**Acceptance criteria:**
- Clicking the `✕` delete button still only deletes — it does not also trigger a jump.
- The delete button's existing hover colour behaviour is preserved.

---

## Out of Scope

- Keyboard navigation of the list.
- Drag-to-reorder.
- Any change to the auto-cycle timer behaviour when an item is selected (existing
  `jumpTo` already handles this).
