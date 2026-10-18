# V4 — Filter rail: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** A left filter rail (models, status, relation fields, outside-selection with direction, hide orphans, reset) reshapes the running graph live, without new CMA calls and without losing node positions.

**Architecture:** `filterGraph` (pure, `src/data/`) turns `Graph` + `Filters` into the visible set. `renderGraph` gains `update(visible)`, which changes nodes/links on the running simulation through the keyed joins and id-keyed node map built in V3. `FilterRail` (`src/components/`) edits `Filters`; `GraphPage` holds the state and passes `visible` to `GraphView`, which calls `update`.

**Tech Stack:** TypeScript, React 19, `datocms-react-ui` (`SwitchInput`, `Button`, `ButtonGroup`/`ButtonGroupButton`), D3 v7 modules (`d3-*` ^3), Vitest.

**Spec:** `slices.md` § V4; behaviour `poc/gestart-graph.html` (`visible()`, chip handlers, reset); visual reference: the "Filter Rail" (`TU1yA`) inside the plugin mockup of `content-graph-dato-design.pen` (pencil MCP only).

## Global Constraints

- Filtering semantics = POC `visible()`: core nodes = model ∈ models ∧ status ∈ statuses; links = field ∈ fields ∧ both ends core. Outside selection (when on): every link with field ∈ fields and exactly one end core, filtered by direction (`out`: core end is the source; `in`: core end is the target; `both`), whose other end has status ∈ statuses → that end becomes a **context** node and the link is visible. Hide orphans: drop nodes (core or context) with no visible link.
- Self-links never visible (V3 ruling). No CMA call on any filter change (`loadGraph` memo already guarantees it).
- Rail layout from the design: width 256px, full height, scrolls on its own; sections "MODELS", "STATUS", "RELATION FIELDS" (uppercase, small, `--color--ink-muted`), each header with "All" / "None" as `Button buttonType="muted" buttonSize="xxs"` on the right (mandate, not in the design); then the switches "Relations outside selection" and "Hide orphans" (`SwitchField` with label); a "Both / Out / In" `ButtonGroup`/`ButtonGroupButton` under the first switch, visible only when it is on; "Reset filters" `Button buttonType="muted" buttonSize="s"` at the bottom.
- Model rows: colour dot (same colour as the node), name, record count right-aligned; ordered as the colour order; on = selected family (`--color--selected--surface`, `--color--selected--ink`, `--color--selected--border`), off = `--color--ink-muted`, no border. Click toggles, double-click isolates the model (click, click, dblclick ends with only that model on, as in the POC); rows `user-select: none`.
- Status and relation-field chips: pills; on = selected family, off = border only (`--color--border`), muted ink. Count in the chip's `title` tooltip; counts exclude self-links. Status order published, updated, draft; fields ordered by edge count desc, ties by apiKey; pseudo `parent` labelled "parent (tree)".
- Node colour helper shared by rail and renderer; the `--node-s/--node-l0/--node-l1` custom properties move from the svg root class to `:global(:root)`, with the dark override under `:global(:root[data-color-scheme='dark'])`, values unchanged.
- Context nodes: dot `fill-opacity: 0.45`, stroke in the model colour (POC `.node.ctx`).
- After an update: every node keeps its last position, including nodes that come back (POC behaviour); order `simulation.nodes(visibleNodes)` → `force('link').links(visibleLinks)` → `alpha(0.55).restart()`; fit on the next `end`, over visible nodes only. Never re-mount. `update` with the same set as the last applied one is a no-op (so the first effect run after mount doesn't reheat the pre-ticked layout).
- Overlay counts: `<core> of <total> records` + ` (+<context> related)` only when context > 0 + ` · <links> relations · <requests> CMA requests`; when outside-selection is on and every model is selected, a muted hint: "All models are selected: nothing is outside the selection."
- Page done state per the design: no `h1`; row layout rail | stage.

## Review Focus

- Toggling filters quickly (several clicks while the simulation runs) never re-mounts the SVG and never leaves stale elements.
- None on every model → empty stage, counts "0 of 248", no errors; All brings everything back in place.
- Outside selection with direction `in` vs `out` on a one-model selection gives different context sets.
- Double-click a model row also fires two clicks: the end state must be "only this model on".
- Theme switch: rail dots and nodes keep the same colour per model.

---

### Task 1 (T1): Visible-set filter

**Files:** create `src/data/filterGraph.ts`, `src/data/filterGraph.test.ts`.

**What:** `Filters = { models: ReadonlySet<number>, statuses: ReadonlySet<NodeStatus>, fields: ReadonlySet<number>, showsOutside: boolean, direction: 'both' | 'out' | 'in', hidesOrphans: boolean }`; `allFilters(graph): Filters` (everything on, outside off, `both`, orphans shown); `filterGraph(graph, filters): VisibleSet` with `VisibleSet = { coreIds: Set<string>, contextIds: Set<string>, edgeIndexes: number[] }` (`coreIds` and `contextIds` disjoint; edge indexes into `graph.edges`, ascending). Also export `sameVisibleSet(a, b): boolean`.

**Verify:** tests, one behaviour each: all filters → all non-self edges; `sameVisibleSet` true for equal content; model off removes its nodes and their links; status off; field off; outside `both`/`out`/`in` on a one-model selection; outside respects status on the context end; hide orphans drops core and context orphans; self-link never visible.

**Done:** gate green. Commit.

### Task 2 (T2): Renderer update seam (depends on: T1) `critical`

**Files:** modify `src/graph/prepareSimulation.ts` (+ test), `src/graph/renderGraph.ts`, `src/graph/graph.module.css`; create `src/graph/modelColor.ts`.

**What:** `SimLink` gains `edge: number`, the **original** index into `graph.edges` (self-links skipped, so not the position in `links`); test with a fixture where the self-link comes first. Renderer link key = `edge`. `modelColor(colorPosition: number): string` returns the `hsl(... var(--node-s) var(--node-l0|l1))` string, used by the renderer (and the rail in T3). Custom properties move to `:global(:root)` / `:global([data-color-scheme='dark'])`. `renderGraph` returns `{ update(visible: VisibleSet): void, destroy(): void }`; `update` follows the Global Constraints. Internal state becomes mutable: current node/link selections and the visible node list are reassigned on each update; `draw` and `fit` read the current ones; a `Map<number, RenderLink>` by edge sits next to `nodeById`; node enter (title, ring, dot, drag, click) and link enter live in helpers used by mount and update; the `ctx` class is set on the merged node selection. Initial render = everything visible, recorded as the last applied set.

**Verify / Done:** gate green (prepareSimulation test updated for `edge`). Commit.

### Task 3 (T3): Filter rail and page wiring (depends on: T2)

**Files:** create `src/components/FilterRail.tsx`, `src/components/FilterRail.module.css`, `src/components/GraphWorkspace.tsx`; modify `src/components/GraphView.tsx`, `src/entrypoints/GraphPage.tsx`, `src/entrypoints/GraphPage.module.css`.

**What:** `FilterRail({ graph, colorIndex, filters, onChange })` per the Global Constraints (All/None per group, double-click isolate, reset → `allFilters(graph)`). New `src/components/GraphWorkspace.tsx`, rendered by `GraphPage` in the done state with `key` = graph identity: holds `filters` (`useState(() => allFilters(graph))`), `data = useMemo(prepareSimulation)`, `visible = useMemo(filterGraph)`; layout rail | stage; overlay counts and hint. `GraphView` takes `visible`; the update effect is declared after the mount effect and calls `handle.update(visible)` (handle in a ref; mount effect keyed on `data` only).

**Verify / Done:** gate green. Commit.

### Task 4 (T4): Check on Gestart — manual, at close (depends on: T3)

**What:** before asking the user: run `filterGraph` on the Gestart graph via `datocms cma:script` file-mode and note the counts for `changelog` only, outside `in` and `out` (lessons). Then `npm run dev`, open Grafo on Gestart, compare with those counts. Each control reshapes the graph without reload (Network tab: no CMA request after the first 3); positions kept; double-click isolates; outside selection + direction on `changelog` only; hide orphans; reset; rail readable in light and dark, model colours equal to node colours.
