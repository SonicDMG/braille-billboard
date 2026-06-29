# Design — Presentation Selection

## Overview

A single boolean column (`included`) is added to the SQLite `items` table. The
`groupIndices` helper in `useCycle` — which already gates which items participate in
auto-cycling and `←`/`→` — is extended to also filter out excluded items.
A toggle button is added to every row in `BillboardList`. No new API routes are needed;
the existing `PATCH /api/items/[id]` handler gains a second field.

---

## SQLite changes

### New column — `items.included`

```sql
ALTER TABLE items ADD COLUMN included INTEGER NOT NULL DEFAULT 1;
```

Added via the existing idempotent migration block in [`getDb()`](../../lib/db.ts):

```ts
if (!cols.some((c) => c.name === 'included')) {
  conn.exec('ALTER TABLE items ADD COLUMN included INTEGER NOT NULL DEFAULT 1')
}
```

No backfill needed — `DEFAULT 1` covers all pre-existing rows automatically.

---

## `lib/db.ts` changes

### `ItemRow` type
Add field:
```ts
included: number  // 1 = included, 0 = excluded
```

### `PersistedItem` type
Add field:
```ts
included: boolean
```

### `rowToItem()`
Map the new column:
```ts
included: row.included !== 0,
```

### `insertItem()`
Accept and write the new field (default `true` → `1`):
```ts
// parameter shape gains:
included?: boolean   // defaults to true when absent
// INSERT statement gains the column:
INSERT INTO items (..., included) VALUES (..., ?)
// value: item.included !== false ? 1 : 0
```

### New exported function — `updateItemIncluded()`
```ts
export function updateItemIncluded(id: string, included: boolean): void
```
Single-column UPDATE used by the PATCH route.

---

## API changes

### `PATCH /api/items/[id]`  (existing route)

The handler already handles `{ spriteData }`. Extend it to also handle `{ included }`:

```ts
// body shape gains:
included?: boolean

// when present:
updateItemIncluded(id, body.included)
```

Both fields remain optional and independent — a single PATCH may carry either or both.

---

## `lib/types.ts` changes

### `BillboardItem`
Add field:
```ts
included: boolean
```

---

## `hooks/useCycle.ts` changes

### New action
```ts
| { type: 'ITEM_INCLUSION_SET'; id: string; included: boolean }
```

### `groupIndices()` helper
Extend the existing filter to also exclude items where `included === false`:

```ts
function groupIndices(items: BillboardItem[], groupKey: string | null): number[] {
  return items.reduce<number[]>((acc, item, i) => {
    if (!item.included) return acc                         // ← new
    if (groupKey !== null && item.filterKey !== groupKey) return acc
    acc.push(i)
    return acc
  }, [])
}
```

This single change propagates to `START_NEXT`, `DWELL_DONE`, `RESUME_AUTO`, and
`SET_GROUP` automatically — they all call `groupIndices` or `nextGroupIndex`.

### Reducer — `ITEM_INCLUSION_SET` case
```ts
case 'ITEM_INCLUSION_SET': {
  const items = state.items.map(it =>
    it.id === action.id ? { ...it, included: action.included } : it
  )
  return { ...state, items }
}
```

### `ITEMS_LOADED` handler (hydration)
Add `included` to the normalisation spread:
```ts
included: it.included ?? true,
```

### New public callback — `setItemIncluded`
```ts
const setItemIncluded = useCallback((id: string, included: boolean) => {
  dispatch({ type: 'ITEM_INCLUSION_SET', id, included })
  void fetch(`/api/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ included }),
  })
}, [])
```

Returned from `useCycle` alongside the other callbacks.

### `addItem()`
Pass `included: true` in the new item object and in the POST body.

---

## `components/BillboardList.tsx` changes

### New prop
```ts
onToggleIncluded: (id: string, included: boolean) => void
```

### Toggle button — every row
A small button added to each row (not just the active row), positioned to the left of
the existing `·` / `⠿` active indicator. It renders:

- Included: `⠶` (bright, full opacity)
- Excluded: `⠠` (dimmed, `color: #333333`)

Click handler: `onToggleIncluded(item.id, !item.included)`

### Row visual dimming
When `!item.included`, the entire row gets `opacity: 0.35` and the query label color
drops to `#444444`. The active-item border and indicator are unaffected.

---

## `components/Billboard.tsx` changes

Wire the new prop/callback:

```tsx
// Destructure from useCycle:
const { ..., setItemIncluded } = useCycle(...)

// Pass to BillboardList:
<BillboardList
  ...
  onToggleIncluded={setItemIncluded}
/>
```

---

## REQ coverage

| REQ | Design item |
|-----|-------------|
| REQ-001 | `included` column + `ITEM_INCLUSION_SET` action + toggle button on every row |
| REQ-002 | `groupIndices()` extended to skip `!item.included`; all cycle paths use it |
| REQ-003 | Row opacity `0.35` + `⠠` indicator for excluded; active indicator unchanged |
| REQ-004 | `ALTER TABLE … DEFAULT 1`; `rowToItem` maps `included`; `insertItem` writes `1` |
