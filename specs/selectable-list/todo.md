# Tasks — Selectable Billboard List Items

## Tasks

- [x] TASK-01: [UI] Add `onSelect` prop and `hoveredIdx` state to `BillboardList.tsx`; wire `onClick`, `cursor`, hover colour, and `stopPropagation` on delete
- [x] TASK-02: [UI] Pass `onSelect={jumpTo}` to `<BillboardList>` in `Billboard.tsx`
- [x] TASK-03: [verify] `npx tsc --noEmit` — 0 errors; `npm run build` — clean

## Done-when notes

- **TASK-01** — Row `<div>` has `onClick={() => onSelect(idx)}` and `cursor: isActive ? 'default' : 'pointer'`; delete `onClick` calls `e.stopPropagation()` then `onDelete`; `hoveredIdx` drives label colour on non-active rows only.
- **TASK-02** — `BillboardList` in `Billboard.tsx` receives `onSelect={jumpTo}`; `BillboardListProps` type update in TASK-01 makes TypeScript enforce it.
