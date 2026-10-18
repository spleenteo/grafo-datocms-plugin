# Slices — Large projects

## Measurements

Acacia Firenze (site 454), full-read role, `schema_migration` excluded, 2026-10-18:

| | |
| --- | --- |
| Load | 1.3 s from the CLI |
| Models with records | 23 (16 block models) |
| Records / blocks | 1873 / 484 |
| Relations | 1575 |
| Orphans | 965 (51%) |
| Degree | p50 0, p90 2, p99 33, max 82 |
| Biggest models | 838, 418, 130, 124, 87, 72 records |
| Relation fields | 32 in the schema, 28 distinct api keys, 18 chips in the graph |

Shared api keys merge unrelated fields into one chip today: `category` is Apartments › Category, POI › Category and Post › Category; `description` and `related_content` likewise. `GraphField` is keyed by `isPseudo:apiKey` (`src/data/types.ts:52`), stored filters too (`src/data/storedFilters.ts:72`).

Reference for the upper end: the DatoCMS site, about 3400 records.

## V1 — Canvas at scale

**In**
- Hover intent: focus (dimming + neighbour highlight) starts after ~150 ms of dwell, so sweeping the pointer across a dense area doesn't flash the whole graph and the node under the pointer stays put.
- Above a visible-node threshold (start at 600, tune on Acacia), hover shows only the node's label/tooltip; dimming happens on selection only.
- Labels keep a constant on-screen size at any zoom (counter-scale by `k`), so zooming in doesn't produce giant text.
- Smart label budget: at most N labels (start at 40), chosen by degree among nodes inside the viewport, recomputed on zoom/pan end, plus focus, selection and search matches.

**Out**: canvas rendering, clustering, model list changes.

**Done**: on Acacia full view, sweeping the pointer across the dense core doesn't dim the graph; a node can be reached and clicked; zooming in to 4× keeps labels at the same pixel size; Smart mode never shows more than N labels plus focus. Gestart behaves as before for hover (below threshold).

**Gotchas**: `renderGraph.ts` is 1197 lines; label geometry feeds the label-aware fit and the pill drawing (`getBBox`). Keyboard focus must still focus immediately (no dwell).

## V2 — Models list

**In**
- Search box on the models section (filters the list, not the graph).
- Sort: by name / by record count (default count, descending); choice remembered with the filters.
- Show the first 10 models, then "Show all (N)"; selected models always visible.
- Same All/None semantics as today, applied to the whole list, not just the visible rows.

**Out**: field chips (V3), auto-filters (V4).

**Done**: on Acacia, a model with 15 records is found by typing three letters; sorting by name puts emoji-prefixed names in a sensible order (ignore leading emoji/symbols when sorting).

## V3 — Relation fields per model

**In**
- Fields become per model: a chip is "Model › Field label" (pseudo field stays `parent (tree)` per tree model, or one global chip, decide in the plan). Edge field index points at the per-model field.
- Only fields of the models currently selected are listed; the rest are hidden, not switched off.
- Search and sort (name / relation count), collapsible section.
- Stored filters keep working: old entries keyed by api key are read once (an off api key switches off all its per-model fields), new ones are written per model.
- Inspector shows the field label, not the api key.

**Out**: models list (V2).

**Done**: on Acacia, Apartments › Category and POI › Category are separate chips; switching off one leaves the other's edges; stored filters from v1.0.0 still load.

**Gotchas**: changes `GraphField`, `buildGraph`, `filterGraph`, `storedFilters`, `remapFilters`, `startingFilters` and their tests. Block fields: links inside blocks are attributed to the record's top-level field (decision 2026-10-18), so the model is always the record's model.

## V4 — Exploration mode (to shape)

Open questions for the owner before planning:
- Threshold (e.g. 1500 readable records) above which Grafo opens empty with search, or on the starting models only, or with orphans hidden.
- Auto-filters: hide models below X records, hide orphans by default when they are more than half the graph (Acacia: 51%).
- "Expand neighbourhood" as the main way to grow the view, "Show everything" as an explicit action with a warning.
- Clustering (collapse a model to one node) left for later.
