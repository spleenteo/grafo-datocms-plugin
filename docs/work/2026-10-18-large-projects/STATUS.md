---
status: open
phase: slice
slice: V4
step: shape
work: large-projects
stack: react
updated: 2026-10-18
tags: [work, large-projects]
description: "Make Grafo usable on projects with thousands of records and dozens of models: readable canvas, findable models and relation fields, an entry point that doesn't draw everything."
---

# Status — Large projects

> Update at the **end of every session**: done, remaining, blockers.

**Entry**: technical, decided on 2026-10-18: the outcome fits one sentence (the same features stay usable at 2000–3500 records), the owner agreed the proposed fixes.

## Slices

- [x] V1 — Canvas at scale: hover intent, constant label size, label budget
- [x] V1.1 — Zoom strokes and neighbour labels
- [x] V2 — Models list: search, sort, show all
- [x] V3 — Relation fields per model: "Model › Field" labels, scoped to visible models, search
- [ ] V4 — Exploration mode for large projects (to shape with the owner)

## Log

<!-- date — step — done — remaining — wall-clock — cost -->
- 2026-10-18 — slicing — measured Acacia, wrote slices — impact, then V1 plan — — —
- 2026-10-18 — V1 execute — T1–T3 done, reviews applied, crash on mount fixed — owner check on Acacia/Gestart — — —
- 2026-10-18 — V1 close — owner checked on Acacia; two browser-only crashes fixed — V2 plan — — —
- 2026-10-18 — V1.1 execute+close — strokes/arrows at screen size, neighbour label cap; harness checked — owner check, then V2 — — —
- 2026-10-18 — V2 execute — search, Count/Name sort, Show all; controller reviewed the diff — owner check — — —
- 2026-10-18 — V2 close — owner checked; column-header sort, enabled models stay visible — V3 plan — — —
- 2026-10-18 — V3 execute — per-model fields with labels, stored filters v2 (reads v1), rail grouped by model with search/collapse; opus review of data PASS — owner check — — —
- 2026-10-18 — V3 close — owner checked; incoming fields of outside models, target hints — V4 to shape with the owner — — —
