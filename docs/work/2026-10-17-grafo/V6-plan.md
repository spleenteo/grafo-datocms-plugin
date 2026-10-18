# V6 — Search and view controls: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Floating controls on the canvas — title search, label modes, zoom in/out, fit, relayout, node distance — and a data refresh that keeps the graph, filters, selection and layout on screen.

**Architecture:** Pure helpers in `src/data/` (`searchTitles`, `remapFilters`). The renderer gains view methods (`setLabelMode`, `setQuery`, `zoomBy`, `fit`, `relayout`, `setDistance`, `positions`) and a `userMoved` flag. `GraphWorkspace` owns `query`, `labelMode`, `distance`; `GraphView` forwards each through its own effect and exposes the imperative ones via its handle. `loadGraph` gets a `fresh` bypass; `GraphPage` keeps the last graph while refreshing.

**Tech Stack:** TypeScript, React 19, `datocms-react-ui` (`TextInput`, `ButtonGroup`/`ButtonGroupButton`, `Button`), D3 v7 modules, Vitest.

**Spec:** `slices.md` § V6 (incl. "Constraints from the V5 final review" and "Constraints from the V4 final review"); POC `poc/gestart-graph.html` (`paintLabels()`, `matches()`, search keydown, `fit()`, `zoomBy()`, relayout handler, `applyForces()`, `dist` input); design frame "Mockup" (floating controls).

## Global Constraints

- Layout (design "Mockup"): floating over the canvas — search top-left (width 240), label mode top-right (`ButtonGroup`: "Smart" / "All" / "On focus"), stats bottom-left, zoom stack bottom-right (+, −, fit, relayout), the distance control just left of the zoom stack (label "Distance", `<input type="range">` 0.4–3, step 0.05, default 1, value shown as `1.0×`). Floating surfaces: `--color--surface` background, `1px solid var(--color--border)`, radius 6px; icon buttons carry visually hidden text (lessons). The label-mode `ButtonGroup` sits in a `role="group"` with `aria-label="Labels"`, and the selected button carries visually hidden "(selected)" text (`ButtonGroupButton` drops aria props). The range input is a plain `<input type="range">` styled with tokens: `datocms-react-ui` has no slider.
- Search: case-insensitive substring on titles of visible nodes (core ∪ context), trimmed; under the input a muted line "N matches, press Enter to jump to the first" / "1 match, …" / "No matches"; Enter selects the first match (nodes order) and `focusOn` it. Matching nodes show their label; with no focus, non-matching nodes are dimmed. Escape inside the search clears the query (and does not clear the selection).
- Label modes (POC `paintLabels`): always shown for focus + neighbours and matches; "All" → every node; "On focus" → nothing else; "Smart" → also nodes with degree ≥ 10, or every node when zoom scale ≥ 1.8 or visible nodes ≤ 45. Smart re-evaluates on zoom through a labels-only pass (toggle `.show`, no link or pill work); "All" and "On focus" via a root-level class on the svg. Typing in search calls `setQuery`, which repaints once per change.
- Distance D (POC `applyForces`): link distance `40·D`, charge `−(70 + r·9)·D`, forceX/forceY strength `0.05 / max(D, 0.6)`, collide `r + 2 + 2·D`; then `alpha(0.9).restart()` and fit on `end` unless `userMoved`. `setDistance` and `setLabelMode` are no-ops when the value doesn't change.
- `userMoved`: set by the zoom handler when `event.sourceEvent` exists (user wheel/drag) and by the +/− buttons (ruling: explicit user zoom, unlike the POC); never by `fit`, `focusOn` or other programmatic transforms. When set, `update()` and distance changes don't fit on `end`. The fit button and relayout reset it.
- Zoom: `zoomBy(1.35)` / `zoomBy(1 / 1.35)` via `zoom.scaleBy`, no transition. Relayout: stop the simulation and clear any pending fit-on-end, clear `fx/fy`, random positions in ±30, `alpha(1)`, 300 synchronous ticks when visible nodes ≤ 1000 (else animated, fit on `end` regardless of `userMoved`), then fit and reset `userMoved`.
- Refresh: a "Reload" text button at the end of the stats line, disabled while a refresh runs. `loadGraph({ …, fresh: true })` bypasses the memo; on success it stores the result under the key computed at call time; a failed fresh load never deletes an existing good entry. `GraphPage` keeps a load-generation ref: a refresh result is applied only if no other load (role/environment change) started since; permissions are read from the ref at click time. `GraphPage` keeps the current graph on screen with a muted "Reloading…" in the stats line; errors during a refresh keep the old graph and show the message in the stats line. The workspace is not re-mounted (constant `key` replaces `graphKey()`; loading/error branches still unmount it): filters are remapped **in the same render** that receives the new graph ("adjust state during render" pattern with a `prevGraph` state, so `filterGraph` never sees new graph + old index sets); selection follows the existing visible-set validation only, run against the remapped filters; view state kept. The renderer re-mounts with the new data seeded from the old one: the mount effect's cleanup captures `positions()`, the zoom transform and `userMoved` **before** `destroy()`, and the new `renderGraph` receives them as `initialPositions`, `initialTransform`, `initialUserMoved`; with `initialPositions` the mount skips the pre-tick and the initial fit, and settles with `alpha(0.55)`. Request count shown is the last load's.
- No CMA call except the explicit refresh. Role isolation unchanged (refresh goes through the same role-aware `loadGraph`).

## Review Focus

- Typing in search never re-mounts the SVG and never restarts the simulation.
- Zoom with the wheel, then change a filter: the view does not jump back (userMoved); pressing fit re-centres.
- Refresh while something is selected and filters are set: same filters (by apiKey), same selection, nodes stay where they were.
- A model added between loads appears on after refresh; a removed one disappears without errors.
- Space or Enter typed in the search input don't trigger node keyboard handlers.

---

### Task 1 (T1): Search and filter remap helpers

**Files:** create `src/data/searchTitles.ts`, `src/data/remapFilters.ts`, tests next to each.

**What:** `searchTitles(graph: Graph, visibleIds: ReadonlySet<string>, query: string): string[]` (ids in nodes order; empty/blank query → `[]`). `remapFilters(prev: Graph, next: Graph, filters: Filters): Filters`: models matched by `itemTypeId` (stable across renames), fields by `(apiKey, isPseudo)`; entries absent in `prev` → on (also when the user had isolated one model: accepted); entries gone in `next` → dropped; statuses, `showsOutside`, `direction`, `hidesOrphans` copied.

**Verify:** tests: case-insensitive match, context nodes included, hidden excluded, blank query; remap keeps an off model off across reordered models, new model on, removed model dropped, pseudo `parent` kept distinct.

**Done:** gate green. Commit.

### Task 2 (T2): Renderer view API `critical`

**Files:** modify `src/graph/renderGraph.ts`, `src/graph/graph.module.css`.

**What:** options gain `initialPositions?: ReadonlyMap<string, { x: number, y: number }>`, `initialTransform?: { x: number, y: number, k: number }`, `initialUserMoved?: boolean`, `labelMode`, `distance`, `matchIds` (initial view state, applied at mount without reheating) and keep `onSelect`; seeded mount per the Global Constraints. Handle gains `setLabelMode(mode: 'smart' | 'all' | 'focus')`, `setQuery(matchIds: ReadonlySet<string>)`, `zoomBy(factor: number)`, `fit()`, `relayout()`, `setDistance(d: number)`, `positions(): Map<string, { x: number, y: number }>`, `viewState(): { transform: { x, y, k }, userMoved: boolean }`; behaviour per the Global Constraints. Labels follow mode + focus + matches; dim rule for matches when there is no focus.

**Verify / Done:** gate green. Commit.

### Task 3 (T3): Floating controls and view state (depends on: T1, T2)

**Files:** create `src/components/CanvasControls.tsx` (+ css); modify `src/components/GraphView.tsx`, `src/components/GraphWorkspace.tsx` (+ css).

**What:** `GraphWorkspace` holds `query`, `labelMode` (default "smart"), `distance` (default 1); computes `matchIds` with `searchTitles` (memo on graph/visible/query). `GraphView` takes `labelMode`, `matchIds`, `distance`: refs read by the mount effect (passed as initial options), plus one effect each calling the handle method (no-op when unchanged), declared after the mount/update/selection effects and its imperative handle adds `zoomBy`, `fit`, `relayout`. `CanvasControls` renders search (+ match line, Enter/Escape), label mode, distance, zoom stack and the stats line per the Global Constraints (stats + Reload button come from props; Reload wired in T4, rendered disabled until then).

**Verify / Done:** gate green. Commit.

### Task 4 (T4): Refresh keeping state (depends on: T1, T3) `critical`

**Files:** modify `src/data/loadGraph.ts`, `src/entrypoints/GraphPage.tsx`, `src/components/GraphWorkspace.tsx`, `src/components/GraphView.tsx`.

**What:** `fresh` option and memo rules; `GraphPage` state `{ graph, requestCount, isRefreshing, refreshError }` once loaded, load-generation ref, constant workspace key; `GraphWorkspace` remaps filters during render; `GraphView` mount-effect cleanup captures positions + view state before `destroy()` and seeds the next mount. Reload wired, disabled while refreshing.

**Verify / Done:** gate green. Commit.

### Task 5 (T5): Check on Gestart — manual, at close (depends on: T4)

**What:** `npm run dev`, Grafo on Gestart: search (matches, Enter, Escape), label modes at several zoom levels, zoom buttons, fit, relayout, distance; wheel-zoom then filter (no jump); Reload with filters + selection set (state kept, 3 new CMA requests in Network, positions and zoom kept); both themes. `paint()` profiling on >1000 nodes (V5 constraint) is deferred: no project of that size at hand.
