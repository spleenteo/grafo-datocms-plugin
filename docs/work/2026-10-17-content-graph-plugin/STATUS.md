---
status: open
phase: slice
slice: V3
step: plan
work: content-graph-plugin
stack: generic
updated: 2026-10-18
tags: [work, content-graph-plugin]
description: "Full-page DatoCMS plugin that renders record relations (incoming and outgoing) as an interactive graph, with filters by model, status and relation field; each node opens its record."
---

# Status — Content Graph plugin

> Update at the **end of every session**: done, remaining, blockers.

**Entry**: technical, decided on 2026-10-17 because the outcome is stated in one sentence: editors get a menu entry that opens a graph of the project's records; the POC (`poc/gestart-graph.html`, not in the repo) already shows the behaviour.

**Path**: frame, shaping and breadboard skipped (UI defined by the POC, plugin shape by the official content-calendar plugin). Impact skipped (no code yet); replaced by a spike on CMA data loading before the V2 plan.

## Slices

- [x] V1 — Empty full-page plugin
- [x] V2 — Graph data from the CMA (spike first)
- [ ] V3 — Graph view
- [ ] V4 — Filter rail
- [ ] V5 — Inspector, search, view controls
- [ ] V6 — Marketplace release

## Log

<!-- date — step — done — remaining — wall-clock — cost -->
- 2026-10-17 — opening — repo initialised, guidelines written, path chosen — slicing — — —
- 2026-10-17 — slicing — 6 slices in slices.md; fidelity check skipped (no frame); impact skipped (no code) — V1 plan — — —
- 2026-10-18 — V1 close — scaffold, README, public repo, tab verified in DatoCMS; gate green — spike CMA loading, then V2 plan — — —
- 2026-10-18 — spike CMA loading — 3 requests on Gestart (schema 1, records 1, blocks 1), POC edges reconciled (347 = 291 + 56 parent_id) — V2 plan — — —
- 2026-10-18 — V2 close — data layer + page counts; Gestart 248/19/347, 3 requests; 4 task reviews + final review (4 fixes) — V3 plan — — —
