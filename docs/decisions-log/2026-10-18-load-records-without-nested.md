---
work: content-graph-plugin
status: active
superseded_by: null
tags: [decision, data, cma]
description: "Records and blocks are listed separately at 500 per page without `nested`; rules out `nested: true` listings (30 per page)"
---

# Records and blocks are loaded without `nested`, in two flat listings

Scope narrowed by 2026-10-18-nested-listing-for-restricted-roles: applies to full-read roles only.

**Date**: 2026-10-18 · **Work**: `content-graph-plugin` · **Status**: active

## Context

The graph needs every link, including links inside blocks (modular content, single block, Structured Text blocks, nested). `items.list` with `nested: true` returns blocks inline but caps `perPage` at 30; without it, block fields hold only block IDs and `perPage` goes to 500.

## Decision

`loadGraph` (`src/data/loadGraph.ts`) makes one `site` request with `include=item_types,item_types.fields`, then two listings in parallel without `nested`, `version: 'current'`, `perPage: 500`: one with `filter.type` = all model IDs, one with `filter.type` = all block-model IDs. `extractLinks` resolves block IDs through a `Map<blockId, block>` and recurses. Cost: `1 + max(1, ceil(records/500)) + max(1, ceil(blocks/500))`; 3 requests on Gestart.

## Alternatives discarded

- **`nested: true` listing**: same graph (verified, set difference 0 on Gestart), but 10 requests instead of 3 there, and ~17× more on large projects (30 vs 500 per page).
- **`ctx.loadItemTypeFields` per model for the schema**: one call per model (40 on Gestart) instead of one.

## Consequences

- All block payloads of the environment sit in memory until `buildGraph` returns, including blocks of models the user may filter out later. Acceptable at current sizes; revisit if memory shows up on very large projects.
- Type-ID lists are chunked at 200 per listing to bound the URL; above 200 types the formula grows by one request per extra chunk.

## References

- `docs/work/2026-10-17-content-graph-plugin/spike-cma-loading.md`
- `docs/work/2026-10-17-content-graph-plugin/slices.md` § V2
