# Task List — Presentation Selection

## Tasks

- [x] TASK-01: [DB] Add `included INTEGER NOT NULL DEFAULT 1` column migration in `getDb()` in `lib/db.ts`
- [x] TASK-02: [DB] Add `included` to `ItemRow`, `PersistedItem`, `rowToItem()`, and `insertItem()` in `lib/db.ts`
- [x] TASK-03: [DB] Add `updateItemIncluded(id, included)` export to `lib/db.ts`
- [x] TASK-04: [lib] Add `included: boolean` to `BillboardItem` in `lib/types.ts`
- [x] TASK-05: [API] Extend `PATCH /api/items/[id]` to handle `{ included?: boolean }` and call `updateItemIncluded()`
- [x] TASK-06: [hook] Add `ITEM_INCLUSION_SET` action type to `useCycle.ts`
- [x] TASK-07: [hook] Extend `groupIndices()` to skip items where `included === false`
- [x] TASK-08: [hook] Add `ITEM_INCLUSION_SET` reducer case to `useCycle.ts`
- [x] TASK-09: [hook] Normalise `included` in the `ITEMS_LOADED` hydration block in `useCycle.ts`
- [x] TASK-10: [hook] Add `included: true` to the `BillboardItem` created in `addItem()` and its POST body
- [x] TASK-11: [hook] Add `setItemIncluded` callback and return it from `useCycle`
- [x] TASK-12: [UI] Add `onToggleIncluded` prop to `BillboardList` and wire toggle button (`⠶`/`⠠`) on every row
- [x] TASK-13: [UI] Apply `opacity: 0.35` and dimmed label color to excluded rows in `BillboardList`
- [x] TASK-14: [UI] Wire `setItemIncluded` → `onToggleIncluded` in `Billboard.tsx`
- [x] TASK-15: [verify] `npx tsc --noEmit` — zero type errors
- [x] TASK-16: [verify] `npm run build` — zero errors
