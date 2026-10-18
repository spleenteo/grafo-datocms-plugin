# Grafo code review (read-only)

Date: 2026-10-18 · Branch: `grafo` · Reviewer: Claude Fable 5.1

Scope: `src/`, `package.json`, `vite.config.ts`, `index.html`, tsconfig files, `README.md`, `CLAUDE.md`, `docs/development-guidelines.md`, lessons and decision descriptions. Nothing was edited. `npx vitest run` (110 tests, 16 files) and `npx tsc -p tsconfig.app.json --noEmit` both pass. Bundle figures come from the `dist/` already on disk (built 17:01, same minute as the last `package.json` change); no rebuild was run.

Decisions honoured: flat 500/page for full-read roles, nested 30/page for everyone else, block links attributed to the record's top-level field. None of the findings below contradicts them. Claims I could not verify in code or local types are marked **(unverified)**.

Severity counts

| Area | Critical | Important | Minor |
| --- | --- | --- | --- |
| 1. Code style | 0 | 2 | 9 |
| 2. API and data loading | 0 | 1 | 4 |
| 3. Security | 0 | 0 | 4 |
| 4. Copy, comments, docs | 0 | 0 | 8 |
| 5. Performance | 0 | 3 | 7 |

---

## 1. Code style

### Important

**S1. The same `Permissions` type is declared three times.**
· `src/data/loadGraph.ts:8-11` (`RolePermissions`), `src/data/readAccess.ts:31-34` (`Permissions`), `src/data/visibleModelPlan.ts:4-7` (`Permissions`).
· Three structurally identical types for the two arrays of `final_permissions`. A change to the shape (e.g. narrowing `unknown[]`) has to be made in three places and nothing enforces agreement.
· Declare it once in `src/data/types.ts` (next to `Schema`) and import it. `loadGraph.ts` already re-exports it as the public name; keep that export.

**S2. The identity of a `GraphField` is encoded by hand in four places with two different formats.**
· `src/data/buildGraph.ts:96` and `:109` (`${isPseudo ? 'p' : 'r'}:${apiKey}`), `src/data/storedFilters.ts:72` and `:81` (`${p ? 1 : 0}:${k}`), `src/data/remapFilters.ts:17-18` (same `1/0` format as a local `fieldKey`).
· Two formats for the same key invite a mismatch the day one of them changes; the `1/0` one is already duplicated inside `storedFilters.ts`.
· Export one `fieldKey(field: GraphField): string` from `types.ts` (or `buildGraph.ts`) and use it in all four sites; `buildGraph.addEdge` can build its dedupe key as `${source}|${target}|${fieldKey(...)}`.

### Minor

**S3. `isObject` and ad-hoc object guards repeated.**
· `src/data/readAccess.ts:36-37`, `src/data/extractLinks.ts:19-21` (identical), plus inline `typeof x === 'object' && x !== null` in `src/data/buildGraph.ts:19`, `src/data/storedFilters.ts:54`, `src/data/pluginSettings.ts:16`.
· One tiny `isRecord` guard in a `src/data/guards.ts` (or `types.ts`) removes five copies.

**S4. Status list and status labels defined twice each.**
· `['published', 'updated', 'draft']` in `src/data/filterGraph.ts:22` and `src/data/storedFilters.ts:5`; the English labels in `src/components/FilterRail.tsx:17-21` and `src/components/Inspector.tsx:21-25`.
· Export `NODE_STATUSES: readonly NodeStatus[]` and `STATUS_LABEL` from one module (`types.ts` for the list, a small `src/components/labels.ts` for the labels). `allFilters` would then read `new Set(NODE_STATUSES)`.

**S5. `'parent (tree)'` field label duplicated.**
· `src/components/FilterRail.tsx:159`, `src/components/Inspector.tsx:108` (`field.isPseudo ? 'parent (tree)' : field.apiKey`).
· Add `fieldLabel(field: GraphField): string` beside `PARENT_FIELD_KEY` in `buildGraph.ts` (or the labels module from S4) so the pseudo-field name lives next to the code that creates it.

**S6. Two identical set-equality helpers.**
· `src/data/filterGraph.ts:77-81` (`sameSet`) and `src/graph/renderGraph.ts:143-147` (`sameIdSet`).
· Export `sameSet` from `filterGraph.ts` (renderGraph already imports `sameVisibleSet` from there) and delete the copy.

**S7. Dead or hollow abstractions.**
· `src/data/buildGraph.ts:29-31` `fieldValues(item)` is the identity function (called twice). `src/graph/renderGraph.ts:104` `type RenderLink = SimLink` is a pure alias used in 8 places. `src/graph/renderGraph.ts:162-164` `labelWidth` applies `Math.min(_, LABEL_MAX)` to a string `labelText` has already capped at `LABEL_MAX`. `src/entrypoints/GraphPage.module.css:14-17` `.hint` has no user (the only unused CSS class in the tree). `src/components/Inspector.tsx:58` carries an `eslint-disable-next-line` directive although the project has no ESLint.
· Remove each; for `fieldValues`, index `item` directly (the `Item` type has an index signature) or keep a single typed cast at the call site.

**S8. `GraphPage` loadKey plumbing is more convoluted than it needs to be.**
· `src/entrypoints/GraphPage.tsx:32-48`. `readPluginSettings` runs on every render and yields fresh arrays; `excludedKey` is stringified, then `JSON.parse`d again inside a `useMemo` whose deps include the `permissions` object that changes on every `ctx` anyway, so the memo never hits across ctx updates. The `useEffect` on line 85 lists `environment` and `baseUrl` although both are already inside `loadKey`.
· Compute `const loadKey = loadGraphKey(environment, baseUrl, permissions, excludedModelApiKeys)` with no memo (it is a short string), make the effect depend on `[apiToken, loadKey]`, and wrap `readPluginSettings(ctx.plugin.attributes.parameters)` in a `useMemo` keyed on `ctx.plugin.attributes.parameters` so the arrays passed down are stable.

**S9. CSS repeated across modules.**
· `.srOnly` byte-identical in `src/components/CanvasControls.module.css:152-159` and `src/components/Inspector.module.css:114-121`. `.model.on` and `.chip.on` in `src/components/FilterRail.module.css:54-58` and `:104-108` are the same three declarations. The `focus-visible` outline (`2px solid var(--color--focus--border)`) is written in `src/graph/graph.module.css:80-83`, `CanvasControls.module.css:112-115` and `:147-150`, `Inspector.module.css:91-93`. The uppercase xs subtle section header appears as `FilterRail .header:23-30` and `Inspector .heading:65-69`. The 8/10 px colour `.dot` is in both `FilterRail.module.css:65-70` and `Inspector.module.css:45-50`.
· One `src/components/shared.module.css` (or composes via `composes:`) with `.srOnly`, `.sectionHeading`, `.colorDot`, `.selectedSurface`; keep per-component modules for layout only.

**S10. `errorMessage` duplicated.**
· `src/entrypoints/GraphPage.tsx:24-26` and inline in `src/entrypoints/ConfigScreen.tsx:47`.
· Move to `src/utils/errorMessage.ts`.

**S11. Small API nits.**
· `src/components/CanvasControls.tsx:69,140` `onReload?` is optional and then guarded with `!onReload`, but `GraphWorkspace` always passes it. `src/components/Inspector.tsx:12` takes `visibleIds: Set<string>` where `ReadonlySet<string>` is enough (it is never mutated). `src/components/FilterRail.tsx:61-62` casts `prev[key] as ReadonlySet<number | NodeStatus>` to share `toggled`; two typed one-liners (`toggleModelOrField`, `toggleStatus`) would avoid the cast. `src/entrypoints/ConfigScreen.tsx:15-16` uses `m!` twice after a `filter(m !== undefined)`; a type-guard filter removes the assertions. `src/data/loadGraph.ts:34-35` names its monotonic counter `freshTokens`/`lastFreshToken`, which reads like an API token in a security grep; `freshSeq` is clearer.

---

## 2. API queries and data loading

Verified against `node_modules/@datocms/cma-client@6.8.0` (`dist/types/generated/ApiTypes.d.ts`, `resources/Item.d.ts`) and `@datocms/rest-client-utils/dist/esm/request.js`.

What is correct:
- `client.site.rawFind({ include: 'item_types,item_types.fields' })` matches `SiteSelfHrefSchema.include?: string`; `parseSchema` reads `included` by `type`, resolves `presentation_title_field` then `title_field`.
- `listPagedIterator({ filter: { type: ids.join(',') }, version: 'current', nested: true | undefined }, { perPage, concurrency })` matches the overloads at `Item.d.ts:46-51`; `ItemInstancesHrefSchema.filter.type` is documented as comma-separated IDs, `version` as `'current' | 'published'`.
- `Item` and `ItemInNestedResponse` both carry `item_type`, `creator?`, `meta: ItemMeta` with `status: null | 'draft' | 'updated' | 'published'`, `created_at: string`, `updated_at: string`, `published_at: null | string`, plus an attribute index signature, so `buildGraph`'s reads are type-safe. The cast at `buildGraph.ts:50` (`as string | null | undefined`) and the `?? null` on `created_at`/`updated_at` at `:84-85` are unnecessary given those types.
- Request count: `1 + Σ chunks` for full read (records and blocks in parallel) and `1 + Σ chunks` nested for restricted roles; `listFlat([])` for a project with no block models issues zero requests because `chunk([])` is empty, consistent with the README formula's `max(1, ·)` being a bound rather than a floor.
- Order of role-aware loading is right: `visibleModelPlan` (`src/data/visibleModelPlan.ts:28-29`) runs `readAccess` over **all** non-block models first, then drops exclusions, so excluding a model cannot promote a role to full read (covered by `visibleModelPlan.test.ts:46`).
- Memo: keyed by environment, baseUrl, both permission arrays and sorted exclusions; failures evict; `fresh` only replaces the entry when it is the latest fresh load. Sound.

### Important

**A1. `extractLinks` allocates a `Collector` (two `Set`s) and a spread copy of the item type for every field of every record, relational or not.**
· `src/data/extractLinks.ts:136-146` (`collectFields({ ...itemType, fields: [field] }, …)` in a loop over all fields).
· On a 50k-record project with ~15 fields per model that is ~750k `Collector`s and 1.5M `Set`s during `buildGraph`, almost all for string/text/number fields that can never hold a link. It is the dominant cost of the build step after the network.
· Precompute per `SchemaItemType` the subset of fields whose `fieldType` is `link | links | rich_text | single_block | structured_text` (once, in `parseSchema` or lazily in a `Map`), iterate only those, and call a `collectField(field, values, c)` that takes the field directly instead of spreading the item type. Reuse one `Collector` per record and `clear()` its sets between fields. Expected: build time for large projects drops by a large constant factor (estimate 3–5×, unverified by measurement) and GC pressure drops accordingly.

### Minor

**A2. `requestCount` counts HTTP attempts, including rate-limit retries.**
· `src/data/loadGraph.ts:62-65` wraps `fetch`; `rest-client-utils/request.js:164-181` re-invokes `fetchFn` on 429 / non-JSON responses via `request({ ...options, retryCount + 1 })`.
· The stats line says "N CMA requests"; after a 429 it reports more than the README formula predicts. Not a bug, but worth one line in the README ("counts attempts, retries included") or counting only responses that are not 429.

**A3. Double deduplication of links.**
· `src/data/extractLinks.ts:143-145` dedupes targets per field with a `Set`, then `src/data/buildGraph.ts:107-113` dedupes again by `source|target|field` string.
· The second pass is needed only because `extractLinks` returns a flat list; if it returned `Map<fieldApiKey, Set<targetId>>` the `seen` set and its string keys disappear. Small win in allocations on big graphs.

**A4. Memo key omits the user.**
· `src/data/loadGraph.ts:41-52`.
· For a role with `on_creator: 'self'` the readable records depend on the user, not only on the permission arrays. In practice the memo lives in the plugin iframe, which DatoCMS recreates on login/logout, so no cross-user hit can happen today **(unverified against the dashboard's iframe lifecycle)**. Adding `ctx.currentUser.id` to the key costs nothing and makes the invariant explicit.

**A5. `parseSchema` runs over the full `included` array twice and `visibleModelPlan` rebuilds the item-type map.**
· `src/data/parseSchema.ts:9-44`, `src/data/visibleModelPlan.ts:28-37`.
· All O(schema size), negligible at any realistic schema. Noted only because `visibleModelPlan` could return `access.readableModelIds` filtered in one pass instead of three list conversions.

---

## 3. Security

### Secrets and token handling (verified clean)

- No tokens, project IDs or endpoints in `src/`, config, or tracked assets (`git ls-files` + regex sweep for 40-hex / `da…` strings: none). `.gitignore` covers `poc/`, `Idea.md`, `.env*`, `dist/`.
- The token flows only `ctx.currentUserAccessToken → loadGraph → buildClient` (`src/entrypoints/GraphPage.tsx:29`, `src/data/loadGraph.ts:66-71`). It is never logged (the only `console`-like call is `ctx.alert` in `ConfigScreen.tsx:48`), never placed in a URL, never stored. `rest-client-utils` builds `ApiError` with `redactedHeaders`, so the API error text rendered at `GraphPage.tsx:142` cannot carry the bearer token.
- `package.json` `permissions: ["currentUserAccessToken"]` is the minimum needed; no write calls exist anywhere in `src/data/`.

### D3 / DOM injection (verified clean)

- No `.html(`, `innerHTML`, `dangerouslySetInnerHTML`, `insertAdjacentHTML` in `src/`. Record titles reach the DOM only through `.text()` (`renderGraph.ts:383, 398`), `.attr('aria-label', …)` (`:379`), React text children (`Inspector.tsx:107, 137`, `FilterRail.tsx:110`) and `title=` attributes. Model names and field api keys likewise.
- Colours are computed from a numeric rank (`modelColor(colorIndex[m])`), so the inline `style={{ background }}` and `style.setProperty('--c', …)` cannot be influenced by content.
- `recordEditPath` interpolates `itemTypeId`/`itemId` from the API and `environment` from `ctx`; the result goes to `ctx.navigateTo`, which stays inside the dashboard router. Marker IDs use a module counter (`cg-${++markerSeq}`), not content.

### Role isolation (verified, with one note)

- Readable models come from `final_permissions` (`readAccess.ts`), whitelist semantics, fail-closed on malformed entries, environment-scoped (the CMA docs embedded in `ApiTypes.d.ts:2142` confirm every entry carries a required single `environment`). `isFullRead` requires every model covered by an `all|read` entry with `on_creator: 'anyone'`, no workflow/stage/locale restriction, no unknown keys with values and zero negative read entries. Any other shape takes the nested path, where blocks arrive only inside records the CMA already filtered for the role, so the page never downloads blocks of unreadable records. Unreadable models are removed from the `Schema` before `buildGraph`, so they get no node, no rail row, no count, no inspector entry, no colour slot.
- `readAccess` treats only `action: 'all' | 'read'` as a read grant. Whether `update`/`publish`/`create` imply read in the dashboard is **unverified**; the choice is fail-closed (a model readable through another action would be hidden, never leaked), which is the correct direction for a hard requirement.
- 18 unit tests cover the permission matrix including malformed negatives, other environments and stage/workflow/locale scoping.

### Minor

**X1. The schema request downloads names and field api keys of models the role cannot read.**
· `src/data/loadGraph.ts:73`.
· Already recorded as accepted in `2026-10-18-nested-listing-for-restricted-roles.md` ("Unavoidable, accepted"). I agree it is unavoidable with one request; the alternative (`ctx.itemTypes` from the SDK, which the dashboard already filtered for the role, plus `ctx.loadItemTypeFields` per model) trades one request for N and was rightly rejected. No action; noted for completeness because it is the only residual gap in the isolation story and the README states it.

**X2. `localStorage` content is trusted only as lookup keys.**
· `src/data/storedFilters.ts:49-92`, `src/components/GraphWorkspace.tsx:52-64, 81-94`.
· The stored value is validated field by field (`v`, `startingKey`, arrays of strings/tuples, enum membership) and its strings are only used as keys into `graph.models`/`graph.fields`; unknown keys are dropped. The storage key includes site, environment, user type and user id (`GraphPage.tsx:154`), satisfying the lesson about keying by what defines the data. Only nit: model and field api keys that the user switched off are stored in the browser profile; that is schema metadata the user could already read, so no isolation issue. No action.

**X3. Committed media may contain client content.**
· `assets/preview.mp4`, `assets/screenshots/*.png`, `design/export/*.png` are tracked; `design/export/video.mp4` is untracked but present.
· I cannot inspect frames here **(unverified)**. If the recordings show the Gestart project, confirm the owner is comfortable publishing record titles and model names in the marketplace assets, and add `design/export/video.mp4` to `.gitignore` or commit it deliberately.

**X4. Dependencies.**
· `package.json`: `@datocms/cma-client-browser ^6.1.0` resolves `@datocms/cma-client 6.8.0` (lockfile), `datocms-plugin-sdk 2.5.0`, `datocms-react-ui 2.5.1`, React 19.3, Vite 8, TypeScript 6, Vitest 5. All first-party DatoCMS, D3 submodules and React; no unusual packages. The `overrides` block forces `react-intersection-observer ^10` and React 19 onto `datocms-react-ui`; that is a transitive-dependency override, so a future `datocms-react-ui` release could silently disagree with it. Not a vulnerability; keep an eye on it when bumping. No `postinstall` scripts, no network at build time beyond npm.

---

## 4. Copy, comments and docs

Everything is English and the register is right for developers and advanced editors. The long handle doc-comments in `renderGraph.ts:58-101` are the best part of the file: behavioural contracts, not restatements. Findings are all Minor.

**C1. Comments that reference the POC, which is not in the repo.**
· `src/graph/renderGraph.ts:450` ("POC `paint()`"), `:505` ("POC `paintLabels`"), `:784` ("POC pattern on `event.active`").
· `poc/` is git-ignored, so for any reader of the public repo these point nowhere. Replace with the actual rule ("Focus = hovered node, else selected") and, for the drag note, the d3-drag fact that is already spelled out in the next sentences.

**C2. Stale comment in `readAccess.ts`.**
· `src/data/readAccess.ts:1-2`: "the loader falls back to the nested, per-model path."
· The nested path is one listing over all readable model IDs, not per model. Say "the nested listing over readable models".

**C3. Misattached doc comment.**
· `src/graph/renderGraph.ts:46-47`: `/** Initial view state, applied at mount without reheating. */` sits on `labelMode?`, while the view-state options are `initialPositions`/`initialTransform`/`initialUserMoved` below, which already have their own comment.
· Delete it or rewrite as "Initial label mode, distance and matches; later changes go through the handle."

**C4. Owner-specific calibration note.**
· `src/graph/autoDistance.ts:1-2`: "Calibrated on the owner's checks (canvas ≈ 1100 px)".
· For a public repo: "Calibrated by hand on a ≈1100 px canvas".

**C5. UI string that editors cannot act on.**
· `src/entrypoints/GraphPage.tsx:136`: "Grant the currentUserAccessToken permission in the plugin settings."
· Most readers of that message are editors without access to plugin settings. "Grafo needs the `currentUserAccessToken` permission. Ask an administrator to grant it in Configuration → Plugins → Grafo."

**C6. Config screen note disagrees with the check and the README.**
· `src/entrypoints/ConfigScreen.tsx:101`: "Only administrators can change these settings." The gate is `can_edit_schema` (`:10`), and the README says "Only roles that can edit the schema can save them."
· Use the README wording.

**C7. Stats line vocabulary.**
· `src/components/GraphWorkspace.tsx:271`: "· 3 CMA requests".
· "CMA" is developer jargon in an editor-facing status bar; "API requests" reads the same to developers and better to editors. Also decide (see A2) whether retries count.

**C8. README nits.**
· `README.md:67` ends with a double period ("always downloaded..").
· The "Requests per load" table omits the per-200-model-chunk factor that the decision log states; one parenthesis fixes it.
· `README.md` "Stored state" says "They are saved by API key" immediately after describing the key format; "Filters are stored by model and field API key" is less ambiguous.

---

## 5. Performance

Verified hot paths in `src/graph/renderGraph.ts` and the pure functions. Sizes below assume N ≈ 20k visible nodes, E ≈ 50k visible links, which the README lists as the upper range; the README already states SVG degrades above ~1000 visible nodes, so the Important items are the ones that bite well below that too or that block the main thread on a filter change.

### Important

**P1. `seedEntering` is O(entering × E).**
· `src/graph/renderGraph.ts:304-327`: for every node entering the visible set, `anchorOf` scans **all** `visibleLinks` to find a neighbour that was already visible.
· Turning a filter from a few models to "All" makes k ≈ N nodes enter; k × E = 20k × 50k = 10⁹ iterations on the main thread before the first frame. Even at 2k × 10k it is 2×10⁷ with string comparisons and `Map` lookups per step, i.e. a visible stall.
· Build an adjacency index once per `setVisible()` (`Map<string, string[]>` from `visibleLinks`, O(E)), then `anchorOf` walks `adj.get(n.id)` only: O(Σ deg(entering)). The same index serves P2 and P5. Expected: filter-change stall goes from seconds to tens of ms on large graphs.

**P2. `paint()` touches every node and every link on every hover and focus change.**
· `src/graph/renderGraph.ts:452-503`: neighbour search over `visibleLinks` (O(E)); three `nodeSel.classed(...)` passes (3 × N classList writes); `paintLabels` (another N); `linkSel.each` creating a `select(this)` per link, two `classed` and an unconditional `setAttribute('marker-end', …)` per link (O(E) with allocation and an attribute mutation each). Mouse moving across a cluster fires `mouseleave` + `mouseenter` back to back, so this runs twice per crossing.
· With N=5k/E=15k this is ~65k DOM operations per hover; attribute writes on `marker-end` invalidate marker rendering for every edge every time. This is the "hover highlighting gets slower" the README admits, and it starts far below 1000 nodes.
· Fix in three steps: (a) adjacency map from P1 for neighbours, O(deg); (b) keep the previous `focus`/`neighbours`/`hiLinks` sets and only toggle classes on the symmetric difference, using `classList.toggle` on the stored element (`linkByEdge` can hold the `SVGLineElement` after `join`) instead of `select(this)`; (c) set `marker-end` only when `isHi` changed. Coalesce `paint()` calls into one `requestAnimationFrame` so leave+enter costs one pass. Expected: hover cost O(deg) instead of O(N+E), i.e. sub-millisecond for typical nodes regardless of graph size.

**P3. Per-tick camera follow recomputes the focus box from all links.**
· `src/graph/renderGraph.ts:683-691` → `focusTransform` (`:632-669`) scans `visibleLinks` on **every simulation tick** while `follow && focusTarget !== null`; `fitTransform` (`:592-615`) scans all visible nodes per tick during a plain follow.
· ~300 ticks × E link checks per settle (15M at E=50k) plus N box computations per tick; not catastrophic, but it is pure waste inside the tick budget shared with `draw()`.
· Cache the neighbour id list when `focusTarget` is set (from the adjacency map) and compute the box over that list; for the fit case, a running bounding box in `draw()` (already iterating nodes) removes the second pass. Expected: tick time during follow drops by the link-scan share (measure; likely 20–40 % at large E, unverified).

### Minor

**P4. Synchronous `tick(300)` on mount and relayout.**
· `src/graph/renderGraph.ts:826-830`, `:987-990`, `PRETICKS = 300`, `PRETICK_MAX_NODES = 1000`.
· For 1000 nodes with many links the 300 pre-ticks (many-body + collide) block the main thread for roughly 0.5–1.5 s (estimate). Options in increasing effort: lower `PRETICK_MAX_NODES` to ~500; stop the pre-tick when `alpha < alphaMin` (d3 reaches it at ~300 ticks anyway, so no gain) or when the mean displacement per tick falls under a threshold (often ~120 ticks); or move the pre-layout to a Web Worker with `d3-force` and post positions back (bigger change, best result).

**P5. Two more O(E) neighbour scans.**
· `src/graph/renderGraph.ts:460-466` (paint, see P2) and `:647-658` (focusTransform, see P3) duplicate the `other = s === id ? t : t === id ? s : null` idiom; the adjacency map removes both and the triplicated code.

**P6. `join()` runs four `select()` passes per update.**
· `src/graph/renderGraph.ts:444-447`: `nodeSel.select('.halo')`, `.ring`, `.dot`, `.label` each query every node group. One `.each` that reads the four children once (`querySelector` ×4 per node is still cheaper than 4 selection passes, or store child refs on enter) halves the DOM queries per update.

**P7. Pill element churn and forced layout.**
· `src/graph/renderGraph.ts:484-502`: every paint removes all `.labelPill` via a `selectAll` query and, when focused, re-creates one after a `getBBox()` read that forces a synchronous layout right after the class writes above it.
· Keep one `<rect>` reference and move/reshape it; compute its size from `labelW` (already estimated per node) to drop `getBBox()`, or accept the single read but do it before the class writes to avoid write→read→write.

**P8. `searchTitles` lowercases every title on every keystroke.**
· `src/data/searchTitles.ts:11-13`: `n.title.toLowerCase()` for all N nodes per query change.
· Precompute `titleLower` once per graph (a `useMemo` in `GraphWorkspace` or a field in `GraphNode`), then the per-keystroke cost is an `includes` per visible node. Few ms at 20k nodes; cheap to fix.

**P9. React re-render fan-out is contained; two small leaks.**
· `src/components/GraphWorkspace.tsx:281-284` passes new inline `resetFilters`/`onHelp` closures every render, so `FilterRail` (not memoised) re-renders on every workspace render including every keystroke in search. Model lists are small, so this is cheap today; `useCallback` on both and `memo(FilterRail)` make it free. `GraphPage.tsx:32` recomputes `readPluginSettings` per render (see S8).

**P10. Bundle.**
· `dist/` (gzip): `index` 73.6 KB (React + plugin SDK + react-ui), `GraphPage` 50.6 KB (d3 submodules + cma-client + app), `ConfigScreen` 31.8 KB (react-select via `SelectField`, loaded lazily), `HelpModal` 0.9 KB; CSS 5.7 + 2.1 KB. Total first paint of the graph page ≈ 124 KB gz, which is reasonable for a dashboard iframe.
· The `GraphPage` chunk contains the full `@datocms/cma-client` resource surface (45 distinct endpoint path templates in the minified chunk) although only `site.rawFind` and `items.listPagedIterator` are used; the client is a class graph that tree-shaking cannot split. Replacing it with two `fetch` calls (JSON:API, `X-Api-Version: 3`, `page[offset]`, `nested`, `version`, 429 back-off) would shave an estimated 25–35 KB gz **(unverified)** at the cost of re-implementing pagination and retry. Not worth it now; revisit only if load time becomes a complaint. Lazy loading of the three entry points is already done well in `src/main.tsx`.

---

## Strengths

- Role isolation is designed, documented, tested (18 cases) and fail-closed; the read-access-before-exclusions ordering is explicit in code and in a test.
- The data layer is framework-free, pure where it matters, and every pure module has focused tests with hand-written fixtures (110 tests, 366 ms).
- CMA usage is tight: one schema request, maximal page sizes, chunked type filters, memoised per page session, no per-record fetch, no write call.
- The renderer handle has real behavioural contracts in its doc comments; keyed joins by id, StrictMode-safe copies of nodes/links, and careful handling of focus/keyboard (never reordering the active element).
- No innerHTML anywhere; content reaches the DOM as text only. Token never leaves the client builder.
- Stored filters are validated field by field and keyed by site/environment/user; starting-model changes invalidate them by design.
- Decision logs record the trade-offs (flat vs nested, block attribution) with costs measured on a real project, so future readers know why.

---

## Prioritised action list

1. **P1 + P2 + P3 + P5** – add a per-`setVisible` adjacency map in `renderGraph.ts`; make `seedEntering`, `paint` and `focusTransform` O(degree); diff class changes and gate `marker-end` writes; coalesce paints per frame. One change, removes the only real stalls on medium and large graphs.
2. **A1** – iterate only relation-capable fields in `extractLinks` and stop allocating a `Collector` per field; biggest win in `buildGraph` for large projects.
3. **S1 + S2 + S4 + S5 + S6** – single `Permissions` type, single `fieldKey`, single status list/labels, single `fieldLabel`, single `sameSet`. Mechanical, low risk.
4. **C5 + C6 + C7 + C8** – the four user-facing strings and the README nits.
5. **C1 + C2 + C3 + C4** – comment hygiene (POC references, stale `readAccess` note, misattached doc comment, owner-specific calibration).
6. **S7 + S8 + S9 + S10 + S11** – dead code, `GraphPage` key plumbing, shared CSS module, `errorMessage`, small typing nits.
7. **P4, P6, P7, P8, P9** – secondary renderer and React tidy-ups; do them when touching the file anyway.
8. **A2, A4, X3, X4** – document retry counting, add the user id to the memo key, confirm the marketplace media content, watch the `overrides` block on the next `datocms-react-ui` bump.
