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

## V1.1 — Zoom strokes and neighbour labels

**In**
- Link, dot and ring strokes and the arrowheads keep their on-screen size above k = 1, like labels (same `--label-k`); below 1 they shrink with the graph as today.
- Smart and On focus label at most 20 neighbours of the focus: the highest-degree ones inside the view. The focus node is always labelled. "All" unchanged.

**Out**: models list (V2).

**Done**: Acacia, Cosmea selected: no more than 20 neighbour labels; zoom to 6×: links stay hairlines, arrows small, no crown of triangles. Gestart unchanged at k ≤ 1.

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

## V4 — Exploration mode

Shaped with the owner on 2026-10-18:

- **Threshold**: a graph with more than 1500 readable records is large (Acacia, 1873, is).
- **Opening a large graph**: with starting models configured, Grafo opens on them with orphans hidden; without, it opens on an empty canvas with the search in front, and the view grows from the record found (selection already expands its relations).
- **Orphans**: hidden by default whenever they are more than half the records (Acacia: 51%), large or not.
- **No "Show everything"** action: selecting all models in the rail is the way.

**In**: starting filters policy, empty-canvas state with a hint, search over every record when nothing is visible, a short result list to pick from.

**Out**: clustering, auto-hiding small models.

**Done**: Acacia without starting models opens empty with the search focused; typing "pri" lists Primula, picking it shows Primula and its relations; Reset filters returns to the empty canvas; with starting models it opens on them without orphans; Gestart (197 records) opens as today unless its orphans exceed half.

### V1 — done on 2026-10-18

- Hover intent (150 ms, both directions), hover without dimming above 600 visible nodes, labels at constant screen size above k = 1 via one `--label-k` variable, Smart budget of 40 by degree in view.
- Two crashes found only in the browser: `follow` read before its `let` (the mount's zoom fires `end` synchronously), and `selectAll('g')` matching the new nested label groups, which exited them as duplicates and dropped nodes from the element map. Both reproduced afterwards in a headless harness with the Acacia graph (`.superpowers/lp/`, ignored).
- Parked: the budget pass before an end-of-settle fit is wasted; a hidden pane gives an empty budget until the next zoom.
- Left for later (owner to confirm): strokes and arrows still scale with zoom; every neighbour of the selection is labelled (65 on Cosmea), which piles up.

### V1.1 — done on 2026-10-18

- Strokes, dash patterns and the two arrow markers divide by `--label-k`; line-end gaps too, redrawn at zoom end (otherwise arrow tips drift off the node after zooming a settled graph).
- Neighbour labels: focus + up to 20 neighbours, the highest-degree in view when there are more; dimming still covers every neighbour.
- Harness checked: Cosmea shows ~20 neighbour labels; at 6× links are hairlines and arrows small.

### V2 — done on 2026-10-18

- `src/data/modelList.ts`: sort name without leading emoji/symbols, accent-insensitive search on name and api key, deterministic order.
- Rail: search field, table-like "Model" / "Records" headers that sort (choice in `localStorage` `grafo:modelSort:v1`), first 10 rows plus every enabled model, "Show all (N)" only when more than 3 would stay hidden.
- Owner change after the first check: the ButtonGroup was too big (now column headers), and enabled models must never hide behind the collapse.

### V3 — done on 2026-10-18

- `GraphField` is per model (`model`, `label`); identity `isPseudo:itemTypeId:apiKey`. Stored filters v2 store `[modelApiKey, fieldApiKey, isPseudo]`; v1 payloads still load (an off api key switches it off in every model).
- Rail: fields grouped by model in the models list order, only for enabled models; search above 10 fields; collapsible; All / None act on the listed fields only.
- Added after the owner's first check: with relations outside shown (both/in), fields of other models that link into the selection get a "Linking into the selection" block, so those edges can be switched off; every chip names its target models (`fieldStats.ts`), restricted to the selected ones for incoming fields.
- Inspector shows field labels, rows sorted by label.
