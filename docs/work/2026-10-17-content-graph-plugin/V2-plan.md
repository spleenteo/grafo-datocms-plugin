# V2 — Graph data from the CMA: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** The Content Graph page loads schema, records and blocks from the CMA and shows record, model and relation counts plus the number of CMA requests made.

**Architecture:** Framework-free data layer in `src/data/`: `parseSchema` (raw `site` payload → schema), `extractLinks` + `buildGraph` (pure, over schema + records + blocks), `loadGraph` (the only module that talks to the CMA). `GraphPage` calls `loadGraph` once and renders states.

**Tech Stack:** TypeScript, React 19, `@datocms/cma-client-browser` (new, installed in T1), Vitest.

**Spec:** `slices.md` § V2; `spike-cma-loading.md` (strategy and counts); `docs/development-guidelines.md`.

## Global Constraints

- Requests: 1 × `client.site.rawFind({ include: 'item_types,item_types.fields' })`, then `client.items.listPagedIterator` without `nested`, `version: 'current'`, `perPage: 500`, `concurrency: 3`, once over model IDs and once over block-model IDs (`filter.type` comma-separated, chunks of 200 IDs ≈ 5 KB of URL), the two listings in parallel. Request formula `1 + ceil(records/500) + ceil(blocks/500)` holds up to 200 models and 200 block models. Never per-record calls.
- Client: `buildClient({ apiToken: ctx.currentUserAccessToken, environment: ctx.environment, baseUrl: ctx.cmaBaseUrl, fetchFn })`, where `fetchFn` is `(...args) => { count++; return fetch(...args); }` (never pass `fetch` unbound; 429 retries go through it and are counted). Never log the token.
- Relation fields: `link`, `links`, `structured_text` (`itemLink`, `inlineItem`; `block`, `inlineBlock` to walk), `rich_text`, `single_block`. Localized values are `{ [locale]: value }`: visit every locale.
- Links found inside blocks are attributed to the **record's top-level field** (user decision 2026-10-18).
- Tree models: `parent_id` becomes an edge child → parent on a pseudo-field `{ apiKey: 'parent', isPseudo: true }`, distinct from any real field named `parent` (user decision 2026-10-18).
- Edges deduped on (source, target, field); edges to IDs that are not loaded records are dropped.
- Title: the model's `presentation_title_field`, else `title_field`; localized → first non-empty value in `site.locales` order; empty → `Untitled <model name>`.
- Status: `meta.status` `null` maps to `published`.
- Data layer has no React imports. UI with `datocms-react-ui` and Canvas CSS variables only.

## Review Focus

- Relations through nested blocks two levels deep (block inside a block inside Structured Text) are found and attributed to the top-level field.
- A localized link field with different targets per locale yields the union, without duplicates.
- A project with no block models, or with no records, loads without error (no request for an empty type list).
- Missing `currentUserAccessToken` (permission not granted) shows an explanatory message, not a crash.
- Many models: `filter.type` lists are split into chunks of 200 IDs, so the URL never grows unbounded.

---

### Task 1 (T1): Schema parsing and graph types

**Files:** `package.json`/`package-lock.json` (add `@datocms/cma-client-browser`), create `src/data/types.ts`, `src/data/parseSchema.ts`, `src/data/parseSchema.test.ts`.

**What:** `types.ts` exports `SchemaField { id, apiKey, fieldType, isLocalized }`, `SchemaItemType { id, apiKey, name, isBlock, isTree, titleFieldApiKey: string | null, fields: SchemaField[] }`, `Schema { locales: string[], itemTypes: Map<string, SchemaItemType> }`, and the graph shape from the POC: `Graph { models: { itemTypeId, apiKey, name, count }[], fields: { apiKey, isPseudo: boolean }[], nodes: { id, title, itemTypeId, status: 'published' | 'updated' | 'draft' }[], edges: { source: number, target: number, field: number }[] }` (indexes into `nodes`/`fields`). `RawItem` = `ApiTypes.Item` (simplified-API item: `id`, `item_type.id`, `meta.status`, flattened fields). `parseSchema(site: RawApiTypes.SiteSelfTargetSchema): Schema` maps the JSON:API payload (`included` holds several resource types: keep only `type === 'item_type'` and `type === 'field'`; field → item type via `relationships.item_type`; title via `presentation_title_field` / `title_field` relationships, resolved to the field's api_key).

**Verify:** tests with a hand-written payload: one model, one block, one tree model, plus an unrelated included resource (ignored); title field resolved; field without title → `null`; localized flag read.

**Done:** gate green. Commit.

### Task 2 (T2): Link extraction and graph building (depends on: T1) `critical`

**Files:** create `src/data/extractLinks.ts`, `src/data/buildGraph.ts`, tests next to each.

**What:** `extractLinks(itemType: SchemaItemType, values: Record<string, unknown>, lookup: { schema: Schema, blocksById: Map<string, RawItem> }): { fieldApiKey: string, targetId: string }[]` walks every relation field of a record; for block references (ID strings in `rich_text`, `single_block`, Structured Text `item`) it looks up the block, recurses into the block's relation fields, and reports links under the record's top-level field. Unknown block IDs are skipped. `RawItem` comes from T1.
`buildGraph(schema: Schema, items: RawItem[], blocks: RawItem[]): Graph`: nodes for every item of a non-block model, models with counts (all non-block item types, including those with 0 records), fields in first-seen order (`isPseudo: false`) plus the pseudo-field `parent` when used, edges per the Global Constraints.

**Verify:** tests, one behaviour each: `link` and `links`; Structured Text `itemLink` + `inlineItem`; modular content block with a `link`; block nested in a block inside Structured Text → top-level field; localized field union; `parent_id` → `parent` pseudo-field edge, separate from a real `parent` field; dangling target dropped; duplicate link deduped; localized title takes the first non-empty locale; title fallback `Untitled <name>`; `draft` and `updated` status kept, `null` → `published`.

**Done:** gate green. Commit.

### Task 3 (T3): CMA loading (depends on: T1, T2) `critical`

**Files:** create `src/data/loadGraph.ts`.

**What:** `loadGraph({ apiToken, environment, baseUrl }): Promise<{ graph: Graph, requestCount: number }>`. Builds the client with the counting `fetchFn`, runs the requests of the Global Constraints (records and blocks listed in parallel after the schema; type IDs in chunks of 200; empty list → no request), then `buildGraph`. Memoized per `environment` for the page session (module-level `Map<string, Promise>`); a rejected promise is evicted. No tests (CMA wiring, guidelines).

**Verify / Done:** typecheck green; exercised in T4. Commit.

### Task 4 (T4): Page states (depends on: T3)

**Files:** modify `src/entrypoints/GraphPage.tsx`, `src/entrypoints/GraphPage.module.css`.

**What:** no `ctx.currentUserAccessToken` → message "Grant the currentUserAccessToken permission in the plugin settings." Otherwise call `loadGraph` in an effect (ignore results after unmount): loading → `<Spinner placement="centered" />`; error → error message with the API error text; done → "N records · M models · K relations" and "X CMA requests" in the muted style.

**Verify / Done:** gate green. Commit.

### Task 5 (T5): Check on Gestart — manual, at close (depends on: T4)

**What:** `npm run dev`, open Content Graph in Gestart Website (32292). Expected: 248 records, 19 models, 347 relations, 3 CMA requests. Spot-check 3 records' references against their "linked from" panel (one `changelog`, one page with a testimonial block, one `doc_page` with links); check one `doc_page` child's `parent` edge in the tree view. Check light and dark CMS themes (pending from V1).
