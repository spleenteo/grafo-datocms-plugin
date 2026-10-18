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
