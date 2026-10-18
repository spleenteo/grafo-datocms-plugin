---
work: grafo
status: active
superseded_by: null
tags: [decision, data, cma, permissions]
description: "Roles without full read load records with `nested: true` (30 per page) over readable models only, and never list blocks by type"
---

# Restricted roles load records with `nested: true`, without a block listing

**Date**: 2026-10-18 · **Work**: `grafo` · **Status**: active

## Context

`2026-10-18-load-records-without-nested` lists all blocks of the environment by block type. For a role that can read only some models, that listing returns blocks of records the role can't read: the page would download data the role must not see. Role isolation is a hard requirement. A block has no permission of its own; access to it follows the record that holds it.

## Decision

`loadGraph` (`src/data/loadGraph.ts`) reads `ctx.currentRole.meta.final_permissions` (passed as `permissions`) and runs `readAccess` (`src/data/readAccess.ts`) over the non-block models of the schema.

- The `Schema` given to `buildGraph` keeps block models and only the readable models: unreadable models get no rail row, no count, no node.
- **Full read** (whitelist, see `readAccess`): unchanged, flat listings at 500 per page for records and blocks.
- **Not full read**: one `items.list` over readable model IDs with `nested: true`, `version: 'current'`, `perPage: 30`, `concurrency: 3`; no block listing. Blocks arrive inline in the records the role can read. `extractLinks` accepts both a block ID and an inline block object (`id`, `relationships.item_type.data.id` or `__itemTypeId`, `attributes`), and Structured Text `itemLink`/`inlineItem` with a string or `{ id }`.
- **No readable model**: schema request only, empty graph.
- Memo key: environment, `baseUrl` and the two permission arrays (`loadGraphKey`). `GraphPage` uses the same string as the effect dependency, so a new `ctx` with equal permissions does not reload.

Cost for a restricted role: `1 + max(1, ceil(records/30))` per 200-model chunk.

## Alternatives discarded

- **Flat block listing filtered client-side**: the blocks of hidden records still reach the browser. Rejected on isolation.
- **Flat records + one `items.find`/`nested` fetch per record with blocks**: per-record requests, worse than 30 per page.
- **Nested listing for every role**: same graph, but ~17× more requests for full-read roles on large projects.

## Consequences

- Restricted roles are slower on big projects (~1 request per 30 records). Accepted for isolation.
- The schema (model and field names of every model) still downloads with the `site` request. Unavoidable, accepted.
- Unknown or malformed permission shapes fall to the nested path (never full read).

## References

- `docs/decisions-log/2026-10-18-load-records-without-nested.md`
- `docs/work/2026-10-17-grafo/V5-plan.md`
- `docs/work/2026-10-17-grafo/lessons.md` (role isolation)
