---
spike: cma-loading
date: 2026-10-18
project: Gestart Website (32292), primary environment, read-only
---

# Spike — Loading the graph from the CMA

Measured with `datocms cma:script` (Node client, same API as `@datocms/cma-client-browser`). Gestart: 19 models, 21 block models, 1 locale (`it`), 248 records, 333 blocks.

## Questions and outcomes

**1. How many requests for the schema?**
One. `GET /site?include=item_types,item_types.fields` (`client.site.rawFind({ include: 'item_types,item_types.fields' })`) returns every model, block model and field (212 included resources). Per-model `fields.list` would be 40 requests here.
`ctx.itemTypes` already holds every model at zero cost, but `ctx.fields` is partial and `ctx.loadItemTypeFields` is one call per model. Use the single `site` request; it also respects `ctx.environment`.

**2. `nested: true` or not?**
Not. Two strategies, same project, same result (248 records, 291 edges, set difference 0):

| Strategy | Requests | Time |
|---|---|---|
| `items.list` with `nested: true`, `filter.type` = all models (max `perPage` 30) | 1 + 9 | ~330–570 ms |
| `items.list` without `nested`, `perPage` 500, plus `items.list` with `filter.type` = all block models, `perPage` 500 | 1 + 1 + 1 | ~250–500 ms |

Without `nested`, block fields hold block IDs: modular content (`rich_text`) is an array of IDs, `single_block` an ID, Structured Text `block`/`inlineBlock` nodes carry `item: <id>`. Blocks listed by type come back with their own fields flattened, so the walker resolves IDs through a `Map<blockId, block>` and recurses (nested blocks reference other block IDs the same way).
Requests: `1 + max(1, ceil(records / 500)) + max(1, ceil(blocks / 500))` (a listing with no results still costs its first page; no block models → no block request). 10k records and 20k blocks are 61 requests; with `concurrency: 5` this stays under the rate limit (60 req / 3 s) and the client retries 429s on its own.
Cross-model `filter.type` (comma-separated IDs) works for both models and block models.

**3. Which relations exist?**
- `link`, `links`: target IDs.
- Structured Text: `itemLink` and `inlineItem` nodes in `document` (`item` is the target ID); `block`/`inlineBlock` nodes point to blocks to walk.
- Modular content and single block: walk the block's own relation fields, recursively.
- **Tree models** (`tree: true`, here `doc_page`): `parent_id` on the record. 56 edges in Gestart, child → parent. Not a field of the schema: needs a pseudo-field.

Reconciliation with the POC: POC 347 edges = 291 (field relations) + 56 (`parent_id`). Per field the counts match, with one difference: 6 links found inside a `testimonial_block` (inner field `testimonial`) are attributed by the POC to the record's top-level field `content`.

**4. Status**
`meta.status` is `published | updated | draft` on every record. Gestart has only `published`; `updated`/`draft` covered by fixtures only.
Read `version: 'current'` (what the editor sees). An `updated` record shows its unpublished links.

**5. Localized fields**
None of Gestart's relation fields is localized. A localized value is `{ [locale]: value }`; the walker visits every locale and dedupes edges. Covered by fixtures only.

**6. Dangling links**
0 in Gestart. The builder still drops edges whose target is not a loaded record (deleted record, or model outside the load) instead of crashing.

## Consequences for V2

- Dependency: `@datocms/cma-client-browser`, built with `ctx.currentUserAccessToken`, `environment: ctx.environment`, `baseUrl: ctx.cmaBaseUrl`.
- Load = 1 schema request + paged records (500) + paged blocks (500), pages in parallel (`concurrency: 5`). Gestart: 3 requests.
- Graph builder is a pure function over (schema, records, blocks): unit-testable with hand-written fixtures (localized values, nested blocks, Structured Text, `parent_id`, dangling targets, `draft`/`updated`).
- Two choices for the V2 plan: block-internal links attributed to the record's top-level field (as the POC) or to the inner block field; `parent_id` shown as a relation field or not.
