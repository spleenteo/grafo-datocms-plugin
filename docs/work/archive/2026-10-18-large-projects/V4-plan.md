# V4 — Exploration mode: plan

**Goal**: a large project opens on something readable (the starting models without orphans, or an empty canvas with the search), and the editor grows the view from the record they look for.

**Scope**: `src/data/startingFilters.ts`, `src/data/searchTitles.ts` (+ tests), `src/components/GraphWorkspace.tsx`, `src/components/CanvasControls.tsx` (+ CSS), a small empty-state element in the workspace. No renderer change, no stored-filter format change.

## Global constraints

- Gate: `npm run typecheck && npm test && npm run build`; renderer harness `shoot4.mjs` still `offPosition 0`.
- `LARGE_GRAPH_RECORDS = 1500` (more than this is large), `ORPHAN_SHARE = 0.5` (more than half → hide orphans). Constants in `startingFilters.ts`.
- Orphan = record with no relation to another record (self-links don't count), over the whole graph.
- Stored filters still win over the starting filters when they load; Reset filters returns to the starting filters.
- UI with `datocms-react-ui` and its CSS variables; English strings.

## T1 — Starting filters policy

`startingFilters(graph, apiKeys)` keeps its signature:

- models: the configured ones present in the graph; if none and the graph is large → **empty set** (explore); otherwise all.
- `hidesOrphans`: true when the graph is large and the configured models are used, or when orphans are more than `ORPHAN_SHARE` of the records; else false.
- Everything else as `allFilters`.
- Export `isLargeGraph(graph)` for the workspace.

Tests: small graph, no config → all models, orphans shown; small graph with > 50% orphans → hides orphans; large graph, no config → no models; large graph with config → configured models and hides orphans; config naming no existing model on a large graph → no models.

Check that `deserializeFilters` (returns null when no model is on) and the "remove the key at the starting filters" effect in `GraphWorkspace` still behave: an empty-models state is the starting state, so nothing is stored.

## T2 — Search over every record when nothing is visible (depends on T1)

- `searchTitles(graph, scopeIds, query)`: callers pass `null` for "every record". Workspace: scope = visible ids, or `null` when the visible set is empty.
- Enter still selects the first match (`jumpToFirstMatch`), and `selectNode` already expands around a record that isn't visible: verify the camera focuses it on an empty canvas (focusOn after the update).
- Results list: when the scope is every record and the query has matches, `CanvasControls` shows up to 8 results under the search field (title, model name muted), each a button that selects it; "+N more" muted line when more. Arrow keys not required. The match line stays as today otherwise.
- Tests: `null` scope searches every node; a visible scope still filters.

## T3 — Empty canvas state (depends on T2)

- When the visible set is empty and no selection: a centred, muted block on the canvas: "**N records** · too many to draw at once" (only when large; otherwise "Nothing matches the filters"), then "Search a record to start, or pick models in the rail." `pointer-events: none`, below the floating controls.
- On mount in this state the search field is focused (once, no focus steal later).
- Deselecting (Esc / background click) from an explored record returns to the empty canvas: expected, no special case.

Done: see `slices.md` V4 Done, checked on Acacia (no starting models, then with starting models) and Gestart.

## Order

T1 → T2 → T3, one implementer (shared workspace file). Task review on the combined diff (sonnet); the policy in T1 is the risky part.
