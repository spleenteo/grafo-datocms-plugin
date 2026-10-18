# V9 — Hardening: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Apply the findings of the full codebase review without changing behaviour: faster renderer and build, no duplication, clear copy, the tests deferred from V6.

**Spec:** `slices.md` § V9; the review report `reviews/2026-10-18-fable-codebase-review.md` (finding IDs below refer to it; each finding has what / where / why / fix).

## Global Constraints

- No behaviour change visible to editors except the copy fixes (C5–C7). Same graph on Gestart: 197 records, 18 models, 347 relations, 3 requests.
- Role isolation untouched: `readAccess`, `visibleModelPlan`, the nested/flat choice and the exclusion order stay as they are; their tests must keep passing unchanged.
- Repo style: single quotes, no formatter churn, comments terse and English, no references to the POC.
- README: the owner edited it; touch only what C8 lists and show the diff in the report.

## Tasks (sequential: they share files)

### Task 1 (T1): Duplication and dead code
S1–S11, A4 (memo key includes the user), P8, P9. Shared `Permissions` type and `fieldKey` in `src/data/types.ts`; single status list/labels; single `fieldLabel`; single set-equality helper; single `errorMessage`; shared CSS module where blocks are identical; remove dead code. Gate green. Commit.

### Task 2 (T2): Build performance (depends on: T1)
A1, A3, A5. `extractLinks` iterates only relation-capable fields (precomputed per item type), one collector per record; drop the double dedupe; `parseSchema`/`visibleModelPlan` single passes. Existing tests unchanged and green. The controller measures `buildGraph` on Gestart before and after. Commit.

### Task 3 (T3): Renderer performance (depends on: T1) `critical`
P1–P3, P5–P7 (P4 only if trivial). Per-`setVisible` adjacency map; `anchorOf`, neighbours in `paint()` and the focus box from it; class diffs on the symmetric difference with stored elements; `marker-end` only on change; `paint()` coalesced per animation frame (keyboard focus and selection still immediate where the code relies on it); pill element reused. Every V3–V8 behaviour preserved (focus target, follow, holdView, reframe, labels, raise guard on `document.activeElement`). Gate green. Commit.

### Task 4 (T4): Copy and comments (depends on: T3)
C1–C8 and A2 (document that the request count includes retries, in the stats tooltip or label). C5: missing permission → tell editors to ask an admin; C6: config note matches the `can_edit_schema` check; C7: stats wording. Gate green. Commit.

### Task 5 (T5): Deferred tests (depends on: T4)
Tests for the `loadGraph` fresh memo (latest token wins, failure keeps the good entry), the GraphPage generation guard, and the filter remap during render — by extracting the logic into small pure helpers where needed (no behaviour change). Gate green. Commit.

### Task 6 (T6): Check — at close
Controller: Gestart counts via `cma:script` and `buildGraph` timing. Owner: no visible change except copy; hover and filter switches feel faster.
