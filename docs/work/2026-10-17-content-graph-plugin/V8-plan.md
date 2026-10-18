# V8 — Starting models: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** An admin picks the models Grafo opens on and the models excluded from it; the editor starts from the starting models with linked records as context and adds the rest from the rail. Excluded models (default: `schema_migration`) are never queried. Node size contrast grows.

**Architecture:** Plugin parameters `startingModelApiKeys: string[]` and `excludedModelApiKeys: string[]`, saved by a config screen (`renderConfigScreen` + `ConfigScreen`). Pure `startingFilters(graph, apiKeys)` builds the opening filters, used by the workspace's initial state and by Reset. `loadGraph` drops excluded models after the read-access computation and before listing. `relativeRadius` keeps area ∝ relations on a wider range.

**Tech Stack:** TypeScript, React 19, `datocms-plugin-sdk` (`renderConfigScreen`, `ctx.plugin.attributes.parameters`, `updatePluginParameters`), `datocms-react-ui` (`Canvas`, `Form`/`FieldGroup`, `SelectField` multi, `Button`), Vitest.

**Spec:** `slices.md` § V8 (incl. the constraint from the V7 final review); `datocms-plugin` skill `references/config-screen.md`.

## Global Constraints

- Excluded models: `readPluginSettings(parameters: unknown): { startingModelApiKeys: string[], excludedModelApiKeys: string[] }` reads defensively (non-array or non-string entries ignored); when `excludedModelApiKeys` is **absent** (never saved) it defaults to `['schema_migration']` (DatoCMS creates that model when migrations are used); an explicitly saved empty array means nothing excluded. `loadGraph({ …, excludedModelApiKeys })`: `readAccess` still runs over **all** models (so dropping a model can never turn a role into full read), then excluded models leave both the model id list and the schema before any listing; their records are never requested, links to them are dropped like any unknown target. The memo key (`loadGraphKey`) includes the sorted excluded list. Excluded models also leave the config screen's "Starting models" options.
- Api keys, not ids: they work across environments; a renamed model drops out of the config silently (accepted; the config screen shows only current models, so a Save cleans stale keys).
- `startingFilters(graph, apiKeys)`: `allFilters(graph)` with `models` = indexes of `graph.models` whose `apiKey` is in `apiKeys`; when that set is empty (no config, or none of the configured models is in the graph — e.g. the role can't read them), all models. `showsOutside: true`, direction `both`. Used for the initial filters and for "Reset filters"; models "All" stays all.
- After Reload, `remapFilters` unchanged (new models on).
- Config screen (admins: `can_edit_schema`; others see the saved values read-only via `selectInputProps={{ isMulti: true, isDisabled: !canEdit, options }}`): two multi `SelectField`s from `ctx.itemTypes` (filter out undefined values; non-block models only; label = model name, sorted by name):
  - "Excluded models" — hint "Never loaded nor shown in Grafo. The migrations model is excluded by default."; initial value = `readPluginSettings(...).excludedModelApiKeys` limited to existing models.
  - "Starting models" — options = models not excluded; hint "Grafo opens with these models selected and shows their linked records as context. Leave empty to start with every model.".
  - A primary "Save" button → `ctx.updatePluginParameters({ ...current, startingModelApiKeys, excludedModelApiKeys })` then `ctx.notice('Settings saved.')`. No CSS module unless layout needs one; give the form enough bottom space (or `menuPlacement="auto"`) so the select menu isn't clipped by the self-resizing iframe.
- Node size: `relativeRadius(degree, maxDegree) = 3 + 21 · √(degree / maxDegree)` (area ∝ relations, range 3–24), `maxDegree <= 0 → 3`.
- Role isolation unchanged: the starting set only selects among models the role can read.

## Review Focus

- Config names a model the role can't read: it is silently ignored; with no readable starting model, Grafo opens on every model.
- Parameters saved while Grafo is open: the next open uses them (no live update needed).
- Excluded models (default `schema_migration`) absent from rail, counts, inspector relations, search, and from the "Starting models" options; a role whose only missing read is `schema_migration` is still not full read.
- Reset returns to the starting models, not to all.

---

### Task 1 (T1): Data rules

**Files:** create `src/data/pluginSettings.ts`, `src/data/startingFilters.ts` (+ tests); modify `src/data/loadGraph.ts`, `src/graph/prepareSimulation.ts` (+ test).

**What:** `readPluginSettings`, `startingFilters`, excluded models dropped in `loadGraph` after `readAccess` and included in `loadGraphKey`, `relativeRadius` 3–24.

**Verify:** tests: `startingFilters` with one configured model, unknown api key → all, empty → all, `showsOutside` true; `readPluginSettings` on bad shapes, absent excluded → `['schema_migration']`, saved empty → `[]`; `relativeRadius` 0 → 3, max → 24, quarter → 13.5, max 0 → 3; update `prepareSimulation.test.ts` assertions at ~:88 and ~:113 to the new formula. Gate green. Commit.

### Task 2 (T2): Config screen (depends on: T1)

**Files:** modify `src/main.tsx`; create `src/entrypoints/ConfigScreen.tsx` (+ css).

**What:** per the Global Constraints; `renderConfigScreen` added to the single `connect()`, lazy-loaded like the other entry points.

**Verify / Done:** gate green. Commit.

### Task 3 (T3): Opening and Reset on the starting models (depends on: T1)

**Files:** modify `src/entrypoints/GraphPage.tsx`, `src/components/GraphWorkspace.tsx`, `src/components/FilterRail.tsx`.

**What:** `GraphPage` reads `readPluginSettings(ctx.plugin.attributes.parameters)`, passes `excludedModelApiKeys` to `loadGraph` (and the load key) and `startingModelApiKeys` down; `GraphWorkspace` initial state = `startingFilters(graph, keys)`; `FilterRail` gets a `resetFilters: () => Filters` callback (Reset uses it and still calls `reframe()`). Reset picks up parameter changes immediately; the opening state on the next open (accepted).

**Verify / Done:** gate green. Commit.

### Task 4 (T4): Check on Gestart — manual, at close (depends on: T2, T3)

**What:** controller first runs `loadGraph` on Gestart via `cma:script` with the default settings and checks: 197 records, 18 models, 347 relations, 3 requests, no `schema_migration` request; Testimonianza + context baseline 13 nodes; radius distribution with 3–24. Then the owner: config screen saves "Testimonianza"; Grafo opens on the 7 testimonials plus context; Reset returns there; models All shows everything; node sizes visibly proportional; both themes.

---

## Close fixes (owner check, 2026-10-18)

Owner requests after the V8 check: (1) selecting a record (also a context record, e.g. a feature linked to a pricing plan) expands the view with that record's relations; (2) inspector: "Open record" at the top, record metadata (created, updated, published, creator) at the bottom; (3) the editor's last filters are restored on the next open instead of the starting models.

Rulings (stated to the owner): expansion follows the selection only (deselect collapses it), adds the selected record's relations in both directions regardless of the model filter but still honouring status and relation-field filters, new nodes start next to the selected node, the camera follows the focus while the layout settles; filters persist in `localStorage` per project, environment and user, by api key; Reset returns to the starting models.

### Task 5 (T5): Expand around the selection `critical`

**Files:** create `src/data/expandAround.ts` (+ test); modify `src/components/GraphWorkspace.tsx`, `src/graph/renderGraph.ts`, `src/components/GraphView.tsx`.

**What:**
- `expandAround(graph, visible, nodeIndex, filters): VisibleSet` (pure): the node itself becomes context if it isn't visible; adds every non-self edge touching the node whose field is in `filters.fields` and whose other end has a status in `filters.statuses`; other ends not already core become context; `coreIds`/`contextIds` disjoint, `edgeIndexes` ascending; unchanged when nothing to add. Runs after `filterGraph`, so `hidesOrphans` never removes expansion nodes.
- `GraphWorkspace`: `visible = selectedId ? expandAround(graph, filtered, index, filters) : filtered`. Selection validity: a click/keyboard/search/inspector selection accepts any node currently visible (expansion included), so the user can walk from record to record; the selection is validated against the **filtered** set only when the filters change (effect on `filters`), and cleared if the node isn't there. Deselect collapses the expansion and does not refit.
- Renderer: every node entering on an `update()` (also previously seen ones) starts at the selected node's position + jitter (±10) when a selection exists, else at a visible neighbour's position, set before `simulation.nodes()`. A `focusTarget` state: `focusOn(id)` sets it; `update()` keeps it and its settle follows and ends on the focus box (node + visible neighbours, same maths as today's `focusOn`) instead of the global fit; if no update follows (same visible set), the focus animates immediately as today, otherwise no initial transition (the follow does it). A user gesture, `fit()`, `reframe()`, `relayout()`, `zoomBy()` or `setSelection(null)` clears `focusTarget`.

**Verify:** `expandAround` tests: context node gets its other relations; a node outside the visible set becomes context itself; status and field filters honoured; self-link ignored; idempotent when already visible. Gate green. Commit.

### Task 6 (T6): Inspector layout and record metadata (depends on: T5)

**Files:** modify `src/data/types.ts`, `src/data/buildGraph.ts` (+ test), `src/components/Inspector.tsx` (+ css), `src/components/GraphWorkspace.tsx`.

**What:**
- `GraphNode` gains `createdAt: string | null`, `updatedAt: string | null`, `publishedAt: string | null`, `creator: { type: string, id: string } | null` from `item.meta.created_at/updated_at/published_at` and the optional `item.creator`; update every test fixture building `GraphNode` (`relationsOf`, `searchTitles`, `prepareSimulation`, `filterGraph`, … tests).
- Inspector: the model name becomes a prominent line above the title (model-colour dot + name, `--font-size-s`, `--color--ink`), replacing the small model badge; the status badge stays. Owner request 2026-10-18.
- Inspector: "Open record" button directly under the title/badges; at the bottom a muted "Details" section: Created, Last updated, Published (when `publishedAt !== null`), Created by. Dates via `Intl.DateTimeFormat(ctx.ui.locale, { dateStyle: 'medium', timeStyle: 'short' })`. Creator name, one function per type: `user` → `ctx.users[id]` `full_name` ?? `email` (call `ctx.loadUsers()` at most once, remember failures); `sso_user` → `ctx.ssoUsers[id]` `first_name last_name` ?? `username` (`ctx.loadSsoUsers()` once); `account` → `ctx.owner` when it's that account (`first_name last_name` ?? `email`); `organization` → `ctx.owner` `name`; `access_token` → "API token"; missing creator, unknown id or a failed loader → "—".

**Verify:** `buildGraph` test asserts the metadata fields. Gate green. Commit.

Also in T6 (owner request 2026-10-18): default node distance 1.6× (workspace initial state and the renderer's fallback).

### Task 7 (T7): Remember the editor's filters (depends on: T5)

**Files:** create `src/data/storedFilters.ts` (+ test); modify `src/components/GraphWorkspace.tsx`, `src/entrypoints/GraphPage.tsx`.

**What:**
- `serializeFilters(graph, filters, startingKey)` → `{ v: 1, startingKey, offModels: string[] (api keys), offFields: [apiKey, isPseudo][], statuses, showsOutside, direction, hidesOrphans }` — off sets, so models/fields added later come up on; `startingKey` = sorted starting api keys joined. `deserializeFilters(graph, data: unknown, startingKey): Filters | null`: null on bad shape, on a `startingKey` mismatch (the admin changed the starting models: start once from them), or when no model is left on; unknown api keys ignored; `statuses` filtered to the known three and `direction` validated (unknown → null).
- Storage key `grafo:filters:v1:<siteId>:<environment>:<currentUser.type>:<currentUser.id>`; `localStorage` I/O lives in `GraphWorkspace` inside try/catch (blocked or partitioned storage in the iframe). Initial filters = stored ?? starting; a `useEffect` on `filters` writes (never during render); Reset removes the key and applies the starting filters.

**Verify:** tests: round trip; model added after saving comes up on; unknown model ignored; starting-key mismatch → null; bad status/direction → null; bad shape → null. Gate green. Commit.
