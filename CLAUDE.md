# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

V1 done: empty full-page plugin (tab "Content Graph" in the main navigation, `pageId` `graph`) rendering a themed placeholder. No CMA calls yet. Entry: `src/main.tsx`, page: `src/entrypoints/GraphPage.tsx`. Graph, data layer and filters are not built yet.

Commands:

- `npm run dev`: Vite at http://localhost:5173/ (install as private plugin, grant `currentUserAccessToken` in the plugin's permissions tab).
- Gate before committing: `npm run typecheck && npm test && npm run build`.

## Goal

Content Graph: a DatoCMS plugin that shows record relations as an interactive graph. Editors pick models/statuses and see incoming and outgoing links between records. Every node links to its record in the DatoCMS editor.

## Hard requirements (from `Idea.md`)

- Full-page plugin with a main-menu entry, same shape as the official [content-calendar](https://github.com/datocms/plugins/tree/master/content-calendar) plugin (`mainNavigationTabs` + `renderPage`).
- Build with `datocms-plugin-sdk` + `datocms-react-ui`; use DatoCMS UI components and design tokens wherever possible. Must work in light and dark mode (follow the CMS theme, not `prefers-color-scheme`).
- Use the DatoCMS CLI and the `datocms:*` skills (especially `datocms:datocms-plugin`, `datocms:datocms-cma`) instead of guessing SDK/API shapes.
- Minimize CMA calls: batch, paginate with large page sizes, cache schema (item types/fields) per session, avoid per-record fetches.
- Public GitHub repo on the owner's account.
- Never commit DatoCMS tokens or any user secret.
- Never commit `poc/` (add it to `.gitignore`).
- Docs/README tone: developer-oriented, terse.
- Use `content-graph-dato-design.pen` (via the `pencil` MCP tools only, it is encrypted) for discussing visual details and for the marketplace cover image.

## POC as reference (`poc/gestart-graph.html`)

Single HTML file, D3 v7 force-directed graph, vanilla JS. Port the behaviour, not the code style or the custom fonts/palette (replace with DatoCMS UI).

Static data shape to reproduce from the CMA:

```js
DATA = {
  models: [{ k: api_key, n: name, c: record_count }],
  fields: [api_key, ...],                    // relation fields, indexed by edges
  nodes:  [[record_id, title, model_api_key, status]],   // status: published | updated | draft
  edges:  [[sourceNodeIdx, targetNodeIdx, fieldIdx]]     // source = record holding the link
}
```

Relations include link/links fields, links inside Structured Text, and links inside blocks (nested), so the data layer must walk block content too.

UI features to keep: filter rail (models, status, relation field chips with All/None, double-click a model to isolate it), "show relations to records outside the selection" with direction (both/out/in), hide orphans, title search, label mode (smart/all/on focus), node-distance slider, zoom/fit/relayout controls, record inspector panel, node radius scaled by degree, per-model colour from golden-angle hue.
