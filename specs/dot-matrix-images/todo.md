# Tasks — Dot-Matrix Image Rendering

## Tasks

- [ ] TASK-01: [lib] Add `SpriteMap` type, new `BillboardSegment` variants, `BillboardItem.spriteData`, and `VisualizationData.portraitColors` to `lib/types.ts`
- [ ] TASK-02: [DB] Add `sprite_data` column migration, `updateItemSprite()`, and updated `PersistedItem` / `ItemRow` to `lib/db.ts`
- [ ] TASK-03: [lib] Create `lib/image-to-sprite.ts` with `imageToSprite()` converter
- [ ] TASK-04: [API] Add PATCH handler to `app/api/items/[id]/route.ts`
- [ ] TASK-05: [lib] Add `portraitColors` parsing to `lib/parse-viz.ts`
- [ ] TASK-06: [lib] Extend LLM prompt in `lib/openrag.ts` with `portraitColors` field + PORTRAIT GUIDE
- [ ] TASK-07: [UI] Add `computeSpriteRegion`, `buildSpriteDots`, `buildPortraitDots` and extend `buildLitMap` + `computeDotPx` in `components/DotMatrixDisplay.tsx`
- [ ] TASK-08: [UI] Add `imageSeg` prop to `DotMatrixDisplay` and wire it into the draw/entrance pipeline
- [ ] TASK-09: [hook] Add `ITEM_SPRITE_SET` action + `setItemSprite` / `removeItemSprite` callbacks to `hooks/useCycle.ts`
- [ ] TASK-10: [UI] Add upload/remove affordances to `components/BillboardList.tsx`
- [ ] TASK-11: [UI] Wire `imageSeg` derivation and sprite callbacks in `components/Billboard.tsx`

## Done when

- TASK-01: `npx tsc --noEmit` passes; all existing `{ text, color }` segment objects still typecheck without adding `type: 'text'` (the discriminant must be optional or defaulted).
- TASK-03: Function works in a browser context only; no Node imports.
- TASK-07: `buildLitMap` with no `imageSeg` arg produces identical output to before; new paths are additive.
- TASK-08: Billboard with no sprite/portrait renders exactly as it did before this PR.
- TASK-11: Full golden path — upload PNG on active item → sprite appears in dot matrix → reload page → sprite is still there → click remove → sprite gone.
