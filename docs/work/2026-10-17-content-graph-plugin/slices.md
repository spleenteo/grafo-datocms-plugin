---
shaping: true
---

# Content Graph plugin — Slices

No shaping doc: the behaviour reference is the POC (`poc/gestart-graph.html`, local only, never committed) and the plugin shape is the official [content-calendar](https://github.com/datocms/plugins/tree/master/content-calendar) plugin (main navigation tab + full-page render). Each slice ends in something visible inside the DatoCMS dashboard.

| Slice | Name | Demo |
|---|---|---|
| V1 | Empty full-page plugin | "Content Graph" tab in the main nav opens a themed empty page |
| V2 | Graph data from the CMA | The page shows record, model and relation counts for the current environment |
| V3 | Graph view | Force-directed graph of all records; clicking a node opens the record |
| V4 | Filter rail | Models, status and relation filters reshape the graph live |
| V5 | Inspector, search, view controls | Selected record details, title search, zoom/fit/relayout, labels, distance |
| V6 | Marketplace release | README, cover image, package metadata, published to npm |

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

## V4 — Filter rail

**In**
- Left rail with chips for models, status and relation fields (All/None per group, counts, double-click a model to isolate it).
- "Show relations to records outside the selection" with direction (both / outgoing / incoming).
- "Hide records without relations". Reset filters.
- Filtering as a pure function over the built graph, with unit tests.

**Out**
- Persisting filters across sessions.

**Done**
- Each control reshapes the graph without reloading data (no new CMA calls). Gate green.

## V5 — Inspector, search, view controls

**In**
- Inspector panel for the selected node: title, model, status, outgoing and incoming relations grouped by field, each clickable to focus or open the record.
- Title search with match count; Enter focuses the first match.
- View controls: label mode (smart / all / on focus), node-distance slider, zoom in/out, fit, relayout.
- Manual refresh button reloading data from the CMA.

**Out**
- Editing records from the plugin.

**Done**
- All POC interactions available, built on `datocms-react-ui` components. Gate green.

## V6 — Marketplace release

**In**
- README (dev-oriented, terse): what it does, permissions, API usage, local development.
- Cover image and screenshots designed in `content-graph-dato-design.pen`.
- `package.json` marketplace metadata (`datoCmsPlugin` title, description, cover, preview), license, keywords.
- npm publish (asks before publishing).

**Out**
- New features.

**Done**
- Plugin installable from the marketplace listing; README and cover shown correctly.
