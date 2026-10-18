---
shaping: true
---

# Content Graph plugin — Slices

No shaping doc: the behaviour reference is the POC (`poc/gestart-graph.html`, local only, never committed) and the plugin shape is the official [content-calendar](https://github.com/datocms/plugins/tree/master/content-calendar) plugin (main navigation tab + full-page render). Each slice ends in something visible inside the DatoCMS dashboard.

**Layout direction (owner, 2026-10-18):** the design frame "Mockup" (`content-graph-dato-design.pen`) is the target layout: configuration rail on the left, record details on the right, options floating over the canvas. A general UI review will refine it later; every slice already follows it.

| Slice | Name | Demo |
|---|---|---|
| V1 | Empty full-page plugin | "Content Graph" tab in the main nav opens a themed empty page |
| V2 | Graph data from the CMA | The page shows record, model and relation counts for the current environment |
| V3 | Graph view | Force-directed graph of all records; clicking a node opens the record |
| V4 | Filter rail | Models, status and relation filters reshape the graph live |
| V5 | Role isolation, selection, inspector | A role sees only what it may read; clicking a node highlights its relations and opens the inspector |
| V6 | Search and view controls | Title search, label modes, zoom/fit/relayout, distance, refresh |
| V7 | UI tweaks | Outside selection on by default, readable arrows, animated focus on select, stats bar, help modal |
| V8 | Starting models | An admin picks the models shown when Grafo opens; editors add the rest |
| V9 | Marketplace release | README, cover image, package metadata, published to npm |

---

## V1 — Empty full-page plugin

**In**
- Scaffold with the DatoCMS CLI / `datocms-plugin` skill: Vite + React + TypeScript, `datocms-plugin-sdk`, `datocms-react-ui`.
- `mainNavigationTabs` hook adding a "Content Graph" tab; `renderPage` rendering a page component inside `Canvas`.
- Page placeholder built with `datocms-react-ui` only, following the CMS theme (light/dark).
- Vitest wired with one trivial test so the gate runs; `typecheck`, `test`, `build` scripts.
- Public GitHub repo on `spleenteo`, first push (asks before pushing).

**Out**
- Any CMA call, any graph code, config screen.

**Done**
- Plugin installed as a private plugin from `localhost` in a test project; the tab appears, the page renders in both CMS themes.
- Gate green. Repo public, `poc/` and `Idea.md` absent from it.

**Gotchas**
- Check which permission the page needs later (`currentUserAccessToken`) and declare it now in `package.json` `datoCmsPlugin.permissions`, so V2 doesn't force a reinstall.

**Deviations found while planning V1**
- No trivial test: `test` runs `vitest run --passWithNoTests` until V2 brings pure logic (guidelines: tests only where needed).
- npm package name `datocms-plugin-content-graph`; GitHub repo `spleenteo/content-graph-datocms-plugin` (user choice at T3).

**V1 — done on 2026-10-18**
- T1–T3 executed as planned: scaffold, README/LICENSE, public repo with the `content-graph-plugin` branch pushed; `poc/` and `Idea.md` absent from the remote.
- T4: after installing as a private plugin the tab did not appear. Cause: the Vite dev server was not running, so DatoCMS could not load the iframe and never called `mainNavigationTabs`. With `npm run dev` up and a full reload, the tab appears.
- Gate green (typecheck, `vitest --passWithNoTests`, build).

## V2 — Graph data from the CMA

**Precondition**: `spike-cma-loading.md` done before the plan.

**In**
- `src/data/`: load schema (item types, fields) and all records of non-block models via `@datocms/cma-client-browser` using the current user's token and the current environment.
- Relation extraction: `link`/`links` fields, links inside Structured Text (`itemLink`, `inlineItem`), links inside blocks (modular content, single block, Structured Text blocks), recursively.
- Build the graph in the POC's shape: `models`, `fields`, `nodes` (id, title, itemType, status `published | updated | draft`), `edges` (source → target, field). Title from the model's presentation title field, fallback "Untitled <model>".
- Page shows a loading state, then counts (records, models, relations) and the number of CMA requests made.
- Unit tests on relation extraction and graph building with hand-written fixtures.

**Out**
- Rendering the graph, filters, persistent cache (unless the spike says it pays off cheaply).

**Done**
- On a real project the counts match the CMS (spot-check 3 records' references against the record's "linked from" panel).
- Request count is the minimum the spike identified.
- Gate green.

**Gotchas**
- Large projects: page size max, sequential vs parallel pages, rate limits.
- Localized fields: link values may be per-locale objects.
- Links to records of models excluded from the load (or to deleted records) must not crash the build.

**Deviations found while planning V2**
- Relations also include `parent_id` of tree models, as a pseudo-field `parent` (spike: 56 of the POC's 347 edges; user decision 2026-10-18).
- Links inside blocks are attributed to the record's top-level field, as in the POC (user decision 2026-10-18).
- Schema comes from one `site` request with includes, not from `ctx.loadItemTypeFields` (spike § 1).
- "Minimum request count" made concrete: 3 on Gestart (`1 + max(1, ceil(records/500)) + max(1, ceil(blocks/500))`; a listing over a non-empty type list always costs at least one request, an empty list costs none).

**V2 — done on 2026-10-18**
- Data layer in `src/data/`: `parseSchema`, `extractLinks`, `buildGraph` (pure, 19 tests), `loadGraph` (only CMA module, counting `fetchFn`, memo per environment). Page shows permission / loading / error / counts.
- Verified on Gestart: 248 records · 19 models · 347 relations · 3 CMA requests; per-field counts equal to the POC; spot-checks and both themes OK.
- Final review added two things V3 builds on: `Graph` arrays are readonly (copy nodes/edges before handing them to D3, which mutates them) and every node carries `model`, its index into `graph.models`.
- Rulings: request formula `1 + max(1, ceil(records/500)) + max(1, ceil(blocks/500))`; self-links kept as edges (V3 decides how to draw them); commit trailers name the model that wrote the commit.
- Deferred to later slices: memo reset (V5 refresh, key on environment + baseUrl), missing-permission message styled as error, label for the pseudo `parent` chip (e.g. "parent (tree)"), chunks of >200 types listed sequentially, `parseSchema` fallback to `title_field` when the presentation field is missing.

## V3 — Graph view

**In**
- `src/graph/`: D3 force simulation (only needed `d3-*` submodules), SVG render, zoom/pan, arrows from the record holding the link to the target.
- Node colour per model (golden-angle hue, as in the POC) built on CMS theme variables so it reads in light and dark; node radius by degree.
- Click on a node opens the record in the editor (`ctx.navigateTo`), honouring the current environment.

**Out**
- Filters, inspector, search, view controls.

**Done**
- Real project renders without freezing; clicking a node opens the right record.
- Readable in both themes. Gate green.

**Gotchas**
- Simulation must be stopped/cleaned up on unmount; re-render must not restart the layout from scratch.

**Deviations found while planning V3**
- Node status encoding (`updated` ring, `draft` hollow dashed dot) moved here from V4: it is part of drawing a node; V4 keeps the status filter chips.
- Node drag added (POC behaviour, a few lines in the renderer).
- Self-links neither drawn nor counted in degree (closes the V2 ruling).
- Large graphs: synchronous pre-tick only up to 2000 nodes, animated layout above, so the iframe never blocks for seconds.
- Node names via native `<title>` tooltip only; labels and hover highlight stay in V5.
- Large-graph threshold lowered to 1000 nodes after review.
- Keyboard access to nodes (POC `tabindex`/Enter) deferred to V5, with the inspector.
- No sandbox environment on Gestart: the environment prefix of the record URL is covered by a unit test on `recordEditPath` instead of a manual check.

**V3 — done on 2026-10-18**
- `src/graph/`: `prepareSimulation` (pure, copies the readonly `Graph`, degree/radius/colour order, id-based link ends), `recordEditPath` (tested env prefix), `renderGraph` (framework-free D3: POC forces, zoom/pan, drag, arrows, fit via `zoom.transform`, status styles, colours from CSS custom properties with a dark override). `src/components/GraphView.tsx` mounts it once per `Graph`; the page is a full-height stage with a counts overlay.
- Verified on Gestart: renders in about a second, zoom/pan/drag/click OK, back-navigation clean, both themes readable.
- Final review: the renderer was build-once; joins are now keyed by id and nodes kept in an id map, so V4 adds `update(visible)` instead of re-mounting (V4's first task). Drag uses `event.active` (`=== 1` on the first `drag` event: d3-drag counts the live gesture there) with a `destroyed` guard.
- Rulings: env prefix unit-tested (no sandbox on Gestart); `update()` API left to V4, where its consumer is.
- Deferred: labels, hover highlight, keyboard access, refit on iframe resize (V5); centring during the animated layout above 1000 nodes.

## V4 — Filter rail

**In**
- Left rail with chips for models, status and relation fields (All/None per group, counts, double-click a model to isolate it).
- "Show relations to records outside the selection" with direction (both / outgoing / incoming).
- "Hide records without relations". Reset filters.
- Filtering as a pure function over the built graph, with unit tests.
- First task: give `renderGraph` an `update(visible)` handle that changes nodes/links on the running simulation (keyed joins and id-keyed node map already exist since V3), keeping positions; filters call it instead of re-mounting.

**Out**
- Persisting filters across sessions.

**Done**
- Each control reshapes the graph without reloading data (no new CMA calls). Gate green.

**Deviations found while planning V4**
- Product renamed **Grafo** (design file, 2026-10-18): tab label, plugin title, page title and docs updated in a separate commit before V4; repo, npm name and work slug unchanged.
- Visual reference is the design's filter rail: model rows with counts (not chips), status and field chips without visible counts (count in tooltip), switches for outside selection and orphans. All/None, direction and Reset are kept from the mandate although the design doesn't show them.
- The page `h1` goes away in the done state (the design has none).
- The renderer update seam is T2, after the pure filter (T1), so `update` consumes the filter's real output type.

**V4 — done on 2026-10-18**
- `src/data/filterGraph.ts` (pure, POC `visible()` semantics, 13 tests); renderer `update(visible)` on the running simulation (keyed by node id and edge index, positions kept, no-op on the same set, fit on next `end`); `FilterRail` per the design (model rows with dot and count, status/field chips, All/None, double-click isolate, outside selection + Both/Out/In, hide orphans, reset); `GraphWorkspace` keyed per graph holds the filter state; model colours in a global stylesheet.
- Verified on Gestart: no CMA call on filter changes, positions kept; hide orphans 117 of 248; `changelog` only 36, +5 related with outside Both/Out, 0 with In; both themes. After review: secondary text on `--color--ink-subtle`, pills at 4px radius.
- Rulings: plan executed without the first stop (owner asked); review fixes applied as recommended; V5 shape constraints recorded below instead of V4 code.
- Spike CDA vs CMA run during the close (`spike-cda-vs-cma.md`): stay on the CMA; role isolation is a hard requirement; two leaks found, scheduled as V5's first task.

## V5 — Role isolation, selection, inspector

_Split from the former V5 on 2026-10-18 (too many tasks for one plan): search, labels, view controls and refresh moved to V6._

**In**
- Role isolation (hard requirement, spike CDA vs CMA): models the current role can't read don't appear anywhere (rail, counts); blocks of records the role can't read are not downloaded.
- Selection: click selects, hover/selection focus highlights the node's relations (POC `paint()`, design focus state).
- Inspector panel for the selected node: title, model, status, outgoing and incoming relations grouped by field, each clickable to focus or open the record.
- Keyboard access to nodes (focusable, Enter selects), deferred from V3.

**Constraints from the V4 final review (for the V5 and V6 plans)**
- Refresh: `Filters` hold model/field array indexes, so a refreshed `Graph` must either reset filters (and say so) or remap them by `apiKey`; keep the last graph on screen with a loading indicator instead of swapping the workspace for the spinner, or zoom and filters are lost on every refresh.
- View state (`selectedId`, `query`, `labelMode`, `distance`) lives in `GraphWorkspace`; `GraphView` forwards each through its own effect to a dedicated renderer method (`setSelection`, `setLabels`, `setDistance`, `fit`, `relayout`), never through `update(visible)`. Zoom/fit/relayout buttons reach the renderer via `useImperativeHandle` on `GraphView`.
- Every callback passed to `renderGraph` (`onOpen`, `onSelect`, `onHover`) goes through a ref, so the mount effect never re-runs on React renders.
- Selection is validated against `visible` in `GraphWorkspace` (clear it when a filter hides the selected node).
- Fit after filter changes should respect a `userMoved` flag (POC) once zoom controls exist.

**Out**
- Search, label modes, view controls, refresh (V6). Editing records from the plugin.

**Done**
- With a role reading one model only, nothing else is loaded or shown (checked with a role-bound token). Selection, focus, inspector and keyboard work on Gestart. Gate green.

**V5 — done on 2026-10-18**
- Role isolation: `readAccess` (pure, whitelist full read, malformed entries fail closed, 20 tests) on `ctx.currentRole.meta.final_permissions`; `loadGraph` keeps only readable models and uses nested listings (no block listing) for restricted roles. Checked with the "Changelog reader" token: 1 of 19 models, 36 records, 3 requests, no block listing; admin unchanged (248 / 19 / 347, 3 requests). Decision `2026-10-18-nested-listing-for-restricted-roles`.
- Selection and focus in the renderer (click selects, hover and keyboard focus highlight, halo, labels for focus and neighbours, Tab/Enter/Space); inspector column always present (badges, title, outgoing/incoming via `relationsOf`, Open record, close and Escape).
- Verified on Gestart by the owner (admin): selection, hover, filters clearing the selection, inspector rows, keyboard, both themes. Restricted-collaborator check in the browser still pending (owner organising a user).
- Rulings: malformed negative permission entry hides every model; keyboard-focused node is not raised (keeps focus; its label may sit under a neighbour); V6 seams recorded as constraints.
- Deferred: positive entries with unknown keys still mark their model readable (records filtered by the CMA, never full read); `paint()` cost per hover; no unit test for the per-role request path (covered by the controller script).

## V6 — Search and view controls

**Constraints from the V5 final review**
- Refresh: `loadGraph` needs a bypass of its module memo (`fresh` option); `GraphPage` keeps the last graph on screen with a `refreshing` state instead of swapping in the spinner; the workspace key must survive a refresh, and filters remap by `apiKey`.
- `update()` always fits on the next `end`: add a `userMoved` flag set in the zoom handler when `event.sourceEvent` exists, and skip the fit when it's set (reset by the fit button).
- Distance and charge are closure constants in `renderGraph`; add `setDistance` and `relayout` handle methods; label modes via a root-level class on the svg next to the existing `.show` logic. Node focus/blur already drives the hover focus (trigger for "on focus").
- `paint()` touches every node and link per hover; profile on >1000 nodes before search highlighting goes through it.

**In**
- Title search with match count; Enter focuses the first match.
- View controls: label mode (smart / all / on focus), node-distance slider, zoom in/out, fit, relayout (design: controls bottom-right, label mode top-right, search top-left).
- Manual refresh button reloading data from the CMA (constraints above).

**Out**
- Editing records from the plugin.

**Done**
- All remaining POC interactions available, built on `datocms-react-ui` components. Gate green.

**Deviations found while planning V6**
- Distance control and Reload button are not in the design: distance floats left of the zoom stack, Reload sits at the end of the stats line (pending the general UI review).
- Refresh keeps node positions by seeding the re-mounted renderer from the old one (`positions()` → `initialPositions`).

**V6 — done on 2026-10-18**
- `searchTitles`, `remapFilters` (pure, tests); renderer view API (label modes with a labels-only pass on zoom, search highlight, zoomBy/fit/relayout/setDistance, `userMoved`, seeded mount from `initialPositions`/`initialTransform`/`initialUserMoved`, `initialVisible` so the first update after a mount is a no-op); floating `CanvasControls` per the Mockup; in-place Reload (`fresh` bypass with per-key token, generation guard, workspace keyed by `loadKey`, filters remapped during render).
- Verified on Gestart by the owner: search, label modes, zoom controls, distance, wheel zoom then filter without jump, Reload keeping filters/selection/layout/zoom, both themes.
- Rulings: +/− count as user zoom; review fixes applied without the first stop (owner asked); `paint()` profiling deferred.
- Deferred: relayout above 1000 nodes overrides user zoom during the settle; "Reloading…"/"Reload failed" not announced; tests for the fresh memo, generation guard and remap during render (proposed as V7 hardening).

## V7 — UI tweaks

_Added 2026-10-18 from the owner's review after V6._

**In**
- "Relations outside selection" on by default (and after Reset), direction Both.
- Arrows readable: smaller arrowheads not scaled by stroke width, thinner and quieter links; focused relations stand out without getting heavy.
- Selecting a node (click, keyboard, search Enter, inspector row) brings it to the centre with a smooth animation, zoomed to include its relations; honours `prefers-reduced-motion`.
- Stats line no longer squeezed (bottom bar layout), "all models selected" hint moved next to the toggle.
- No text selection on the rail when double-clicking rows.
- Help button in the left rail opening a DatoCMS modal with keyboard shortcuts and a short editor help.

**Out**
- Starting models (V8). Showing blocks as nodes (dropped: the relation through a block is already drawn, attributed to the record's field).
- V6's deferred tests (fresh memo, generation guard, remap during render): moved to V9 hardening.

**Done**
- Each item visible on Gestart in both themes. Gate green.

**V7 — done on 2026-10-18**
- Outside selection on by default (hint as the switch's `hint`), rail without text selection, one bottom bar for stats and controls; readable arrows (`userSpaceOnUse` markers 4.5/6, `stroke-opacity`); one `selectNode` with an animated focus (450 ms, centred on the node, scale fitting its neighbours, reduced motion honoured); Help button with a native DatoCMS modal (`renderModal` + lazy `HelpModal`).
- Owner check, round 1: isolate didn't reframe smoothly; distance spread cores more than their linked records; zoom buttons not animated; relayout glyph read as "reload". Fixed: camera follows the settle and glides to the fit; `reframe()` on isolate/Reset/All/None; charge ∝ D² with constant gravity (measured on Gestart: core/context ratio 3.86 → 3.79 instead of 4.43 at D=3); animated +/−/fit/relayout; SVG icons "Fit to screen" / "Rearrange layout"; node drag stops the follow.
- Owner check, round 2: labels outside the frame after a reframe; nodes all the same size (median r 5). Fixed: `relativeRadius` (4–20 against the most-connected visible node), fit and focus include shown label widths.
- Verified on Gestart by the owner after both rounds.
- Rulings: dimmed links back to the previous 0.12; isolate/Reset/All/None reframe even after a user zoom, single toggles don't; no second whole-slice review for the close fixes.
- Deferred: Smart-mode fit crossing k 1.8 uses the pre-zoom label set; handle `fit()` during a settle glides twice; arrow tips 0.45 px short on normal links.

## V8 — Starting models

**Constraint from the V7 final review**
- Starting filters are built in three places today: the initial state in `GraphWorkspace` (`allFilters`), Reset in `FilterRail`, and models "All". V8 adds one `startingFilters(graph, startingModelIds)` used by the initial state and by Reset (passed to `FilterRail` as a prop); models "All" stays all. After Reload, `remapFilters` keeps switching new models on.

**In**
- Plugin config screen: an admin picks the models switched on when Grafo opens (default: all readable models).
- Opening Grafo: those models on in the rail, "Relations outside selection" on (Both), so linked records of other models show as context nodes; the editor switches other models on from the rail.
- Loading unchanged: every readable model is still loaded (owner decision 2026-10-18, option 1: incoming relations need the other models' records). Models in the config that the role can't read are ignored.
- Excluded models (owner, 2026-10-18): the config screen has an "Excluded models" list; excluded models are never queried nor shown, anywhere. Until an admin saves the config, the list defaults to `schema_migration` (the model DatoCMS creates when migrations are used), so no useless queries and no cleanup afterwards.
- Node size: area proportional to relations against the most-connected visible record, radius 3–24 (owner, 2026-10-18, after measuring: a linear radius would put 140 of 197 Gestart nodes at 4–6 px).

**Out**
- Partial loading with per-record `items.references` (possible later option for very large projects).

**Done**
- With "Testimonianza" as the only starting model on Gestart, Grafo opens on the 7 testimonials plus their linked records as context. Gate green.

## V9 — Marketplace release

**In**
- README (dev-oriented, terse): what it does, permissions, API usage, local development.
- Cover image and screenshots designed in `content-graph-dato-design.pen`.
- `package.json` marketplace metadata (`datoCmsPlugin` title, description, cover, preview), license, keywords.
- npm publish (asks before publishing).

**Out**
- New features.

**Done**
- Plugin installable from the marketplace listing; README and cover shown correctly.
