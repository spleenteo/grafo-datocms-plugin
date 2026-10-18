# V3 — Graph view: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** The Content Graph page renders every record as a force-directed graph, coloured by model, sized by degree; clicking a node opens the record in the editor.

**Architecture:** `src/graph/prepareSimulation.ts` (pure) copies the readonly `Graph` into mutable simulation data with degree, radius and colour index. `src/graph/renderGraph.ts` (framework-free D3) owns the SVG content: simulation, zoom/pan, drag, arrows, fit. `src/components/GraphView.tsx` mounts it once per `Graph` and wires the click to `ctx.navigateTo`. `GraphPage` shows `GraphView` full-size with the counts as an overlay.

**Tech Stack:** TypeScript, React 19, `d3-force`, `d3-selection`, `d3-zoom`, `d3-drag` (^3) with their `@types/*`, Vitest.

**Spec:** `slices.md` § V3; behaviour reference `poc/gestart-graph.html` (local only); `docs/development-guidelines.md`.

## Global Constraints

- Never mutate the `Graph` from `loadGraph` (lessons): D3 gets copies.
- Forces (POC values): link distance 40, strength 0.55; charge `-(70 + r * 9)`; `forceX(0)`/`forceY(0)` strength 0.05; collide `r + 4`. Zoom `scaleExtent([0.1, 6])`, double-click zoom disabled.
- Radius: `min(20, 5 + sqrt(degree) * 1.6)`; degree = incoming + outgoing edges, self-links excluded from degree and not drawn (V2 ruling).
- Colour: models ordered by record count desc, then apiKey; hue `round((colorIndex[model] * 137.508 + 12) % 360)`; saturation/lightness from CSS custom properties with a `[data-color-scheme='dark']` override (light: S 62%, L 45% / 58% picked by `colorIndex[model] % 2`; dark: S 70%, L 62% / 74%).
- Other colours only from Canvas variables: edges and arrows `--color--ink-muted`, node stroke `--color--surface`, stage `--color--surface`.
- Node status (deviation, see slices.md): `updated` → outer ring (`r + 3.5`) in the model colour; `draft` → dot filled with `--color--surface`, dashed stroke in the model colour (filled so the whole dot is clickable).
- Layout: synchronous pre-tick 300 ticks then fit, when nodes ≤ 1000; above, animated simulation with fit on `end`. Fit is applied through `svg.call(zoom.transform, t)` without transition (no `d3-transition`), padding 40, scale ≤ 2; with 0 nodes, no fit. React re-renders never restart the layout: `renderGraph` runs once per `Graph` identity.
- Open record: `recordEditPath({ isEnvironmentPrimary, environment, itemTypeId, itemId })` = `${isEnvironmentPrimary ? '' : `/environments/${environment}`}/editor/item_types/${itemTypeId}/items/${itemId}/edit`, passed to `ctx.navigateTo`. A drag does not open. No sandbox to test against: the path is unit-tested instead.
- Drag: reheat (`alphaTarget(0.25).restart()`) on the first `drag` event, not on `start`, so a plain click doesn't move the layout; release on `end`.
- Link ends: start at `s.r + 1`; end at `t.r + 3`, or `t.r + 5` when the target is `updated`.
- Overlay counts: records, models and **drawn** relations (self-links excluded), plus CMA requests.
- Keyboard access to nodes (POC `tabindex`/Enter): deferred to V5.
- Native `<title>` tooltip per node: `<title> · <model name>`. No labels, no hover highlight (V5).

## Review Focus

- Unmount (navigate away and back): simulation stopped, no tick after unmount, no listeners left.
- Theme switch while the page is open: node colours follow `data-color-scheme` without re-render.
- Empty graph (0 records): page shows the counts and an empty stage, no error.
- Iframe resize: the SVG fills the stage; the view doesn't jump.
- Non-primary environment: the record URL carries `/environments/<env>`.

---

### Task 1 (T1): Simulation data

**Files:** `package.json`/`package-lock.json` (`d3-force`, `d3-selection`, `d3-zoom`, `d3-drag` in `dependencies`; their `@types/*` in `devDependencies`), create `src/graph/prepareSimulation.ts`, `src/graph/prepareSimulation.test.ts`, `src/graph/recordEditPath.ts`, `src/graph/recordEditPath.test.ts`.

**What:** `prepareSimulation(graph: Graph): { nodes: SimNode[], links: SimLink[], colorIndex: number[] }`. `SimNode extends SimulationNodeDatum` = `{ id, title, itemTypeId, model, status, degree, r }` (array order = `graph.nodes` order, so D3's default index-based link ids line up). `SimLink extends SimulationLinkDatum<SimNode>` = `{ source, target, field }`, created with numeric source/target; D3 replaces them with nodes at runtime, so consumers narrow with `typeof end === 'object'`. `colorIndex[modelIndex]` = position of the model in the colour order. All objects freshly allocated.

`recordEditPath` as in the Global Constraints.

**Verify:** tests: input `Graph` unchanged after the call (deep-equal to a copy); self-link excluded from links and degree; radius capped at 20 for a high-degree node; colour order by count desc, ties by apiKey; `recordEditPath` on primary (no prefix) and on a sandbox (`/environments/<env>` prefix).

**Done:** gate green. Commit.

### Task 2 (T2): D3 renderer (depends on: T1) `critical`

**Files:** create `src/graph/renderGraph.ts`, `src/graph/graph.module.css`.

**What:** `renderGraph(svg: SVGSVGElement, data: ReturnType<typeof prepareSimulation>, options: { modelName: (model: number) => string, onOpen: (node: SimNode) => void }): { destroy(): void }`. Builds `<defs>` arrow marker, a viewport `<g>` with links (`<line>`, marker-end, shortened by the radii as in the POC `draw`) and nodes (`<g>` with optional ring, dot, title). Forces, radius, colour (`--c` per node from `colorIndex`), status styles, link ends, zoom, drag, fit and layout rule from the Global Constraints; 0 nodes → empty viewport, no simulation run. Click on a node (not after a drag) → `onOpen`; click on the background does nothing. `destroy` stops the simulation, calls `svg.interrupt()`, removes zoom/drag listeners and empties the SVG. Note: StrictMode runs mount/destroy/mount in dev; that must be clean. Styles in the CSS module, colours per Global Constraints.

**Verify / Done:** typecheck green; exercised in T3. Commit.

### Task 3 (T3): Graph view in the page (depends on: T2)

**Files:** create `src/components/GraphView.tsx`; modify `src/entrypoints/GraphPage.tsx`, `src/entrypoints/GraphPage.module.css`.

**What:** `GraphView({ data, modelName, ctx }: { data: ReturnType<typeof prepareSimulation>, modelName: (model: number) => string, ctx: RenderPageCtx })`: an `<svg>` filling its parent; `useEffect` keyed on `data` calls `renderGraph`, returns `destroy`; `onOpen` reads `ctx` through a ref so it never re-runs the effect. `GraphPage` done state: `.page { height: 100vh; display: flex; flex-direction: column }` (box-sizing border-box), title row, then a stage `{ flex: 1; min-height: 0; position: relative }` with a `--color--border` 1px border; the `<svg>` is `position: absolute; inset: 0; width: 100%; height: 100%`. Counts (drawn relations) and request count as one muted overlay line at the stage's top-left. `GraphView` exposes the drawn relation count by computing `prepareSimulation` in the page with `useMemo` on `graph` and passing the result down (one computation, shared).

**Verify / Done:** gate green. Commit.

### Task 4 (T4): Check on Gestart — manual, at close (depends on: T3)

**What:** `npm run dev`, open Content Graph on Gestart. Expected: graph appears within ~1 s, no freeze; zoom, pan and drag work; clicking a `changelog` node and a `doc_page` node opens the right record (primary environment only: no sandbox available, the prefix is unit-tested); navigating back re-renders without errors in the console; colours, arrows and status readable in light and dark CMS themes.
