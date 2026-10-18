# V3 — Relation fields per model: plan

**Goal**: an editor reads relation fields by their label, under the model that owns them, and switches one off without touching a same-named field of another model.

**Scope**: data layer (`types.ts`, `parseSchema.ts`, `buildGraph.ts`, `storedFilters.ts`, `remapFilters.ts` + tests), `FilterRail.tsx` (+ CSS), `Inspector.tsx`. Filtering (`filterGraph`, `expandAround`) keeps working on field indexes and needs no change.

## Global constraints

- Gate: `npm run typecheck && npm test && npm run build`, then the renderer harness (`.superpowers/lp/shoot4.mjs`) still prints `offPosition 0`. Regenerate `.superpowers/lp/acacia-graph.json` with `npx --no-install datocms cma:script .superpowers/lp/measure.ts --skip-validation --config-file /Users/spleenteo/.claude/jobs/b6acc723/tmp/acacia/datocms.config.json` after T1 (read-only CLI; never print tokens).
- Links inside blocks stay attributed to the record's top-level field (decision 2026-10-18), so a field always belongs to the record's model.
- Stored filters written by v1.0.0 must still load.
- UI with `datocms-react-ui` and its CSS variables; English strings.

## T1 — Per-model fields in the graph (`critical`)

- `SchemaField` gains `label: string` (`attributes.label`), set in `parseSchema`.
- `GraphField` becomes `{ apiKey, isPseudo, model: number, label: string }`: `model` is the index into `graph.models` of the record's model; `label` is the schema label, `'parent (tree)'` for the pseudo field.
- `fieldKey(f, models)` → `${isPseudo ? 1 : 0}:${models[f.model].itemTypeId}:${apiKey}` (session identity). Add `fieldStoreKey(f, models)` → `[modelApiKey, apiKey, isPseudo]` for storage. Pick the signatures that keep call sites short; both live in `types.ts`.
- `buildGraph`: `fieldFor(model, apiKey, isPseudo)` dedupes on the new identity; label from the item type's schema field (fallback: api key).
- `fieldLabel(field)` returns `field.label`. New `fieldTitle(field, graph)` → `"Model › Label"` (model name with its emoji, as the rail shows it), used for tooltips and the inspector's title attribute.
- Tests: two models with the same field api key give two fields; edges point at the right one; pseudo field per tree model; label taken from the schema.

## T2 — Stored and remapped filters (depends on T1, `critical`)

- `StoredFilters` becomes `v: 2` with `offFields: [modelApiKey, fieldApiKey, isPseudo][]`. `serializeFilters` writes v2.
- `deserializeFilters` reads v2, and v1 (`offFields: [apiKey, isPseudo][]`): a v1 entry switches off every per-model field with that api key and pseudo flag. Every other v1 rule unchanged (fails closed, startingKey check).
- `remapFilters` matches fields by the new `fieldKey`.
- Tests: v2 round trip; v1 payload switches off all same-key fields; unknown version → null; remap keeps a per-model field off across a refresh and turns new fields on.

## T3 — Rail and inspector (depends on T1)

- Relation fields section: only fields whose `model` is in `filters.models` are listed; fields of hidden models keep their state. Grouped by model, groups in the models list's current order (same `orderModels` call, pass it down or recompute), each group: a small muted line with the model dot and name, then its chips (`field.label`, sorted by relation count desc, then label). Chip `title`: `"Model › Label · api_key · N relations"`.
- A search `TextInput` (`grafo-field-search`, "Search fields") when more than 10 fields are listed: matches label, api key or model name (reuse `matchesModel`-style normalisation from `modelList.ts`; extract a shared `normalizeForSearch` there if needed). Esc clears.
- The section header gets a collapse toggle (chevron button, `aria-expanded`); collapsed hides search and chips. Not remembered.
- All / None act on the listed fields (visible models, current search), not on hidden ones. Ruling: what you see is what you switch.
- With no listed field: muted "No relation fields for the selected models".
- Inspector: the relation row shows `field.label` with `title={fieldTitle(...)}`.

Done: on Acacia, Apartments › Category and POI › Category are separate chips under their models; switching one off removes only its edges; selecting only Apartments lists only Apartments' fields; a v1.0.0 stored filter with `category` off loads with every `category` field off; Gestart unchanged apart from labels.

## Order

T1 → T2 (one implementer, data), then T3 (second implementer). Opus review after T2 (data, stored state) and after T3.
