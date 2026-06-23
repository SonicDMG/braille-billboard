# Design — Selectable Billboard List Items

## Overview

The only file that changes is `components/BillboardList.tsx`. The `jumpTo` function
already exists in `useCycle` and is already threaded through `Billboard.tsx` — it just
needs to be passed down to `BillboardList` and wired to a click handler on each row.

---

## UI changes

### `components/BillboardList.tsx`

**New prop:** `onSelect: (index: number) => void`

Wired to `jumpTo` at the `Billboard` call site (no change needed in `Billboard.tsx`
beyond adding the prop — `jumpTo` is already in scope there).

**Row click handler:**  
The outer row `<div>` gets `onClick={() => onSelect(idx)}` and
`cursor: pointer` when `!isActive`. The active row gets `cursor: default`.

**Delete button:** add `onClick` with `e.stopPropagation()` before calling `onDelete`
so the row click handler does not also fire.

**Hover state:** use a React `useState<number | null>` (`hoveredIdx`) to track which
row is hovered. On non-active rows, the query label colour shifts from `#444444` →
`#666666` when `hoveredIdx === idx`. The row's `onMouseEnter` / `onMouseLeave` set and
clear `hoveredIdx`. Active rows are unaffected (they're already at `#888888`).

### `components/Billboard.tsx`

Pass `onSelect={jumpTo}` to `<BillboardList>`. No other changes.

---

## REQ coverage

| REQ-ID | Design item |
|--------|-------------|
| REQ-001 | `onClick={() => onSelect(idx)}` on row `<div>`; `onSelect` wired to `jumpTo` in `Billboard.tsx` |
| REQ-002 | `cursor: pointer` when `!isActive`, `cursor: default` when active |
| REQ-003 | `hoveredIdx` state drives label colour `#444444` → `#666666` on hover |
| REQ-004 | `e.stopPropagation()` in delete button's `onClick` |
