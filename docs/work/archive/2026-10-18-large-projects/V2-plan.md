# V2 — Models list: plan

**Goal**: on a project with dozens of models, the editor finds a model by typing a few letters and reads the list in a useful order, without scrolling past every model.

**Scope**: new `src/data/modelList.ts` (+ test), `src/components/FilterRail.tsx`, `src/components/FilterRail.module.css`. No change to `Filters`, filtering or the stored filters format.

## Global constraints

- Gate: `npm run typecheck && npm test && npm run build`.
- UI from `datocms-react-ui` (`TextInput`, `ButtonGroup`/`ButtonGroupButton`, `Button`) and its CSS variables; layout per the pen "Mockup" frame (rail on the left, 256 px).
- English UI strings. Model colours unchanged (still `colorIndex`).
- All / None act on every model, not only the rows on screen. Double-click a row still isolates it.

## T1 — Ordering helper

`src/data/modelList.ts`:

```ts
export type ModelSort = 'count' | 'name';
export function modelSortName(name: string): string           // leading non-letter/non-digit chars stripped (emoji, symbols, spaces), then lowercased
export function matchesModel(model: { name: string; apiKey: string }, query: string): boolean
export function orderModels(models: readonly { name: string; apiKey: string; count: number }[], sort: ModelSort, query: string): number[]
```

- `modelSortName`: `/^[^\p{L}\p{N}]+/u` removed; the rest lowercased. `'🏠 Apartments'` → `'apartments'`, `'⁉️ Faq'` → `'faq'`.
- `matchesModel`: trimmed query empty → true; otherwise case- and accent-insensitive substring of the name (emoji stripped as above) or of the api key (NFD + strip combining marks).
- `orderModels`: indices of matching models; `count` = count desc, then sort name asc; `name` = sort name asc (`localeCompare`), then count desc. Ties end on the index, so the order is deterministic.

Tests: emoji/symbol prefix stripped; `count` order with a tie broken by name; `name` order ignores the emoji; query matches the name case- and accent-insensitively; query matches the api key; empty or blank query keeps everything.

## T2 — Rail: search, sort, show all (depends on T1)

In the Models section of `FilterRail`, between the header and the rows:

- A `TextInput` (placeholder "Search models", `id`/`name` `grafo-model-search`) filtering the rows with `matchesModel`. Esc in the field clears it. When nothing matches: one muted line "No models match".
- A small `ButtonGroup` "Count" / "Name" (selected = current sort). Default `count`.
- Rows from `orderModels(graph.models, sort, query)`. Without a query, only the first `MODEL_ROWS = 10` rows are shown, followed by a muted `Button` "Show all (N)" / "Show fewer" when the list is longer. With a query every match is shown. Below 10 + 3 models (`≤ 13`) always show everything (a "Show all" for 2 rows is noise).
- Search and sort controls are shown only when the project has more than `MODEL_ROWS` models (Gestart, 18 models, gets them).
- Sort choice remembered per browser in `localStorage` key `grafo:modelSort:v1` (value `count` | `name`), read once on mount and written on change, both in try/catch; an unknown value falls back to `count`. Search text and expanded state are not remembered.

Done: on Acacia (23 models) the list shows 10 rows and "Show all (23)"; typing "gal" shows only the models whose name or api key contains it (Gallery Image); "Name" sorts Apartments near the top despite the emoji; All / None still switch every model, including hidden rows; the sort survives a reload of the page.

## Order

T1 → T2, one implementer. Task review on the combined diff (smaller model: UI, not shared renderer code).
