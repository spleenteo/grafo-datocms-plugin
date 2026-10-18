# Grafo

DatoCMS plugin that draws the records of a project and the links between them as an interactive graph. It adds a **Grafo** tab to the main navigation. Each node is a record, and clicking a node shows its incoming and outgoing relations and opens the record in the editor.

![Grafo: full project view with a search](https://raw.githubusercontent.com/spleenteo/grafo-datocms-plugin/main/assets/screenshots/search.png)

Demo video: [`assets/preview.mp4`](https://raw.githubusercontent.com/spleenteo/grafo-datocms-plugin/main/assets/preview.mp4)

## What it shows

- **Nodes.** One node per record. The colour stands for the model. The area grows with the record's total number of relations, relative to the most-connected visible record.
- **Edges.** An edge goes from the record that holds the link to the linked record. Grafo reads relations from `link` and `links` fields, from Structured Text (`itemLink`, `inlineItem`, blocks and inline blocks), from Modular Content and from single-block fields, following nested blocks to any depth.
- **Links inside blocks.** They count for the record's top-level field that holds the block.
- **Tree models.** `parent_id` appears as a pseudo field named `parent (tree)`.
- **Status.** A ring marks a published record with unpublished changes. A dashed outline marks a draft. Grafo reads the current version, which is what editors see.
- **Context nodes.** These are records of models outside the selection that link to the selected models, or that the selected models link to. They are drawn faded with an italic label. The "Relations outside selection" switch controls them, with three directions: Both, Out, In.

## Features

- **Filter rail.** Filter by model, status and relation field, with All/None per group. Double-click a model to show only that one. You can also hide orphans and reset the filters.
- **Inspector.** Shows the model, title and status, an Open record button, and the outgoing and incoming relations. At the bottom it lists the creation, last update and publication dates and the creator.
- **Selection.** Selecting a record expands the view with all of its relations and centres the camera on it and its neighbours. From there you can walk from one record to the next.
- **Search by title.** Shows the match count; Enter jumps to the first match.
- **Labels.** Three modes: Smart, All, On focus.
- **View controls.** Zoom, fit, rearrange layout, and node distance. Distance is set automatically from the visible node count and canvas size, and can be overridden by hand.
- **Reload.** Reloads the data and keeps filters, selection, layout and zoom.
- **Keyboard.** Tab moves between records, Enter or Space selects, Esc clears the selection. A Help modal lists every shortcut.
- **Theme.** Follows the CMS light or dark theme.

## Installation

From the DatoCMS marketplace: Configuration → Plugins → Add new → search "Grafo" → Install.

When you install, grant the `currentUserAccessToken` permission (see below). Without it the page shows a message and loads nothing.

## Configuration

![Plugin settings](https://raw.githubusercontent.com/spleenteo/grafo-datocms-plugin/main/assets/screenshots/config.png)

Open the settings from Configuration → Plugins → Grafo. Only roles that can edit the schema can save them; other roles see them read-only.

| Setting | Parameter | Default | Effect |
| --- | --- | --- | --- |
| Excluded models | `excludedModelApiKeys: string[]` | `["schema_migration"]` | These models are never requested from the API and never shown. The default covers the model DatoCMS creates when you use migrations. Saving an empty list excludes nothing. |
| Starting models | `startingModelApiKeys: string[]` | `[]` (every model) | The models selected when Grafo opens, with "Relations outside selection" on, so their linked records appear as context. Reset returns to them. |

Both lists store model API keys, so they carry over to sandbox environments. A model that is renamed or deleted drops out of the list the next time you save.

## Permissions and data access

Grafo reads data through the Content Management API using `ctx.currentUserAccessToken`. Every request runs with the permissions of the logged-in user, so each role sees only what it is allowed to read:

- **Readable models.** Grafo works them out from `ctx.currentRole.meta.final_permissions`, so it doesn't need an extra request. Models the role can't read never reach the graph, the rail, the counts or the inspector.
- **Full-read roles** (every model, any creator, no workflow or stage restriction) get flat listings: records and blocks at 500 per page.
- **All other roles** get nested listings, with blocks embedded in their records, at 30 per page. Blocks are never listed on their own, so the page never downloads blocks that belong to records the role can't read. Unknown or malformed permission entries count as restricted.
- **Excluded models** are removed after the read-access check, so excluding a model can never promote a role to full read.

The plugin makes no write calls.

### Requests per load

| Role | Requests |
| --- | --- |
| Full read | `1 + max(1, ceil(records / 500)) + max(1, ceil(blocks / 500))` |
| Restricted | `1 + max(1, ceil(records / 30))` |

The first request fetches the schema: `site` with `include=item_types,item_types.fields`. The results are memoised for the page session, keyed by environment, endpoint, effective permissions and excluded models. Reload bypasses the memo. The schema, meaning model and field names, is always downloaded.

### Why not the Content Delivery API

The CDA would be cheaper per call and would return the same graph. However, it rejects the user session token with `401 INVALID_AUTHORIZATION_HEADER`. A project CDA token would see every record regardless of the editor's role, which breaks role isolation.

## Stored state

The editor's filters are saved in `localStorage` under `grafo:filters:v1:<siteId>:<environment>:<userType>:<userId>`. They are saved by API key, with switched-off models and fields stored as an exclusion list, so models and fields added later show up switched on. When an admin changes the starting models, the stored filters are ignored once. The key is removed when the filters match the starting ones. Grafo works normally when storage is blocked; it just doesn't remember anything.

![Help modal](https://raw.githubusercontent.com/spleenteo/grafo-datocms-plugin/main/assets/screenshots/help.png)

## Development

Requirements: Node 20.19+ or 22.12+ (Vite 8), and a DatoCMS project where you can create private plugins.

```sh
npm install
npm run dev   # http://localhost:5173/
```

Install the dev build as a private plugin:

1. In DatoCMS go to Configuration → Plugins → Add new → Create a new private plugin.
2. Set the entry point URL to `http://localhost:5173/`.
3. In the plugin's permissions tab, grant `currentUserAccessToken`.
4. Reload the DatoCMS page completely after changes to `src/main.tsx`. Hooks such as the navigation tab are read when the plugin boots.

### Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Vitest |
| `npm run preview` | Serve the production build |

Gate before every commit: `npm run typecheck && npm test && npm run build`.

### Structure

```
src/
  main.tsx              connect(): mainNavigationTabs, renderPage, renderModal, renderConfigScreen
  entrypoints/          GraphPage, ConfigScreen, HelpModal
  components/           GraphWorkspace (state), GraphView (renderer bridge), FilterRail, Inspector, CanvasControls
  data/                 CMA loading and pure graph logic: parseSchema, readAccess, visibleModelPlan,
                        extractLinks, buildGraph, filterGraph, expandAround, startingFilters,
                        remapFilters, storedFilters, pluginSettings, relationsOf, searchTitles
  graph/                D3 renderer (renderGraph) and pure helpers: prepareSimulation, autoDistance,
                        modelColor, recordEditPath
```

- `src/data/` and `src/graph/` don't import React.
- `loadGraph` is the only module that calls the API.
- Tests cover the pure modules only. Components and D3 rendering are checked by hand.
- Design decisions live in `docs/decisions-log/`, and the development log in `docs/work/`.

### Stack

`datocms-plugin-sdk`, `datocms-react-ui`, `@datocms/cma-client-browser`, React 19, `d3-force`, `d3-selection`, `d3-zoom`, `d3-drag`, `d3-transition`, Vite, Vitest, TypeScript.

## Limitations

- The whole readable dataset loads when Grafo opens. Projects with tens of thousands of records need many requests. For restricted roles that is one request per 30 records.
- Rendering is SVG. Above about 1000 visible nodes the layout animates instead of pre-computing, and hover highlighting gets slower.
- Localized relation fields count the union of the links across all locales. Titles use the first locale that has a value.

## Releasing

1. Bump `version` in `package.json`.
2. Run `npm run build`.
3. Run `npm pack --dry-run` and check that it lists `dist/`, `assets/cover.png` and `assets/preview.mp4`.
4. Run `npm publish`. The `datocms-plugin` keyword lists the package in the DatoCMS marketplace.

## License

MIT
