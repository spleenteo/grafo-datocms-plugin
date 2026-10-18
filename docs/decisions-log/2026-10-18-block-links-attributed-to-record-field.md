---
work: grafo
status: active
superseded_by: null
tags: [decision, data, graph]
description: "Links found inside blocks are attributed to the record's top-level field; rules out attributing them to the inner block field"
---

# Links inside blocks belong to the record's top-level field

**Date**: 2026-10-18 · **Work**: `grafo` · **Status**: active

## Context

A link can sit in a field of a block nested inside a record's modular content, single block or Structured Text field. The edge needs one field for the relation-field filter chips. On Gestart, 6 edges come from `testimonial_block.testimonial` inside the record field `content`.

## Decision

`extractLinks` (`src/data/extractLinks.ts`) reports every link found while walking a top-level field's blocks under that top-level field's api_key. The POC does the same. Tree-model `parent_id` is a separate pseudo-field `{ apiKey: 'parent', isPseudo: true }`.

## Alternatives discarded

- **Inner block field** (e.g. `testimonial`): more precise about where the link lives, but it adds filter chips for fields editors never see on the record, and the same inner field can appear in many host fields.

## Consequences

- The filter can't tell apart two links that reach the same target through different blocks of the same top-level field: they dedupe into one edge.
- If editors ever need "which block holds this link", it needs a new edge attribute (the block path), not a change of `field`.

## References

- `docs/work/archive/2026-10-17-grafo/spike-cma-loading.md` § 3
- User decision, 2026-10-18 (V2 planning)
