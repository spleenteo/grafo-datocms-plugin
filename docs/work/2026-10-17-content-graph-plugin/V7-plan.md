# V7 — UI tweaks: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** The owner's review fixes: outside selection on by default, readable arrows, animated focus on select, unsqueezed stats bar, no text selection on the rail, help modal.

**Architecture:** Small changes across `filterGraph`, `FilterRail`, `CanvasControls`, the renderer and a new modal entry point (`renderModal` + `HelpModal`), reusing the SDK's `ctx.openModal` so the modal is a native DatoCMS one.

**Tech Stack:** TypeScript, React 19, `datocms-plugin-sdk` (`openModal`, `renderModal`), `datocms-react-ui`, D3 v7 modules plus `d3-transition` as a direct dependency (already bundled through `d3-zoom`, which imports it for `interrupt`: no size cost; declared for its types and the explicit import), Vitest.

**Spec:** `slices.md` § V7; POC `poc/gestart-graph.html` (`focusOn()`, `fit()` with transitions; don't print the DATA line ~201); `datocms-plugin` skill `references/modals.md`.

## Global Constraints

- `allFilters(graph).showsOutside` is `true` (Reset uses it too); direction `both`.
- "All models are selected: nothing is outside the selection." leaves the stats line; it becomes the `hint` prop of the "Relations outside selection" `SwitchField`, only when the switch is on and every model is on.
- Arrows: both markers use `markerUnits="userSpaceOnUse"` (size no longer multiplied by stroke width), `viewBox 0 0 10 10`, `markerWidth`/`markerHeight` 4.5 for normal links and 6 for `hi` links, `refX` 7 (so the line's flat end stays under the arrowhead; add the overshoot to the link-end shortening in `draw()` if the tip lands inside the node). Links are quieted with `stroke-opacity` (0.35 normal, 0.9 `hi`), never element `opacity`, so arrowheads keep their own fill (`fill-opacity` 0.6 normal, 1 `hi`). Stroke-width 0.75 normal, 1.25 `hi` with stroke `--color--ink`; `dim` unchanged.
- Focus on select: every user selection (node click, Enter/Space on a node, search Enter, inspector row) calls `focusOn(id)`, which animates the zoom transform over 450 ms (d3-transition, `ease` default cubic) that **centres the selected node** and picks the scale so its visible neighbours fit around it: `k = min(availW / (2·max|dx| + 2r), availH / (2·max|dy| + 2r))` with `dx/dy` the neighbours' offsets from the node, `r` the largest radius involved, `avail` = viewport minus 60 padding per side; clamp to [0.5, 2]; a node with no visible neighbour centres at scale `max(current, 1.2)`. With `prefers-reduced-motion: reduce` (checked at call time via `matchMedia`) the transform is applied without transition. `focusOn` never sets `userMoved`, clears any pending fit-on-end, and `destroy()` interrupts a running transition (`svg.interrupt()`, typed via the explicit `d3-transition` import, replacing today's cast). A Reload or remount during the 450 ms seeds the in-between transform: accepted. Background click (deselect) doesn't move the view.
- Bottom bar: stats (left) and the distance + zoom cluster (right) share one absolutely positioned flex row (`left/right/bottom: var(--spacing-s)`, same as the other corners; `justify-content: space-between`, `align-items: flex-end`, `gap: var(--spacing-m)`, `pointer-events: none` on the row, `auto` on its children); the stats element `flex: 1 1 auto; min-width: 0` wraps on spaces only when the row is too narrow, the right cluster `flex: none`; no fixed `max-width` calc.
- Rail: `user-select: none` on the whole rail root.
- Help: a "Help" `Button buttonType="muted" buttonSize="s"` at the bottom of the rail next to "Reset filters" → `ctx.openModal({ id: 'help', title: 'Grafo help', width: 'm', initialHeight: 480 })`; `renderModal` added to the existing single `connect()` in `src/main.tsx` renders `src/entrypoints/HelpModal.tsx` inside `<Canvas ctx={ctx}>` (auto-resizer on, no `100vh`/`height: 100%` in its CSS). The modal's own X and Esc close it; no extra close button. Content (English, terse):
  - Shortcuts table: Tab / Shift+Tab — move between records; Enter or Space — select the focused record; Esc — clear the selection; Enter in search — jump to the first match; Esc in search — clear the search; double-click a model — show only that model; mouse wheel / drag on empty canvas — zoom / pan; drag a record — move it.
  - "How to read the graph": node = record, colour = model, size = number of relations, ring = published with unpublished changes, dashed = draft, faded dot or italic label = record outside the selected models (shown because of "Relations outside selection"); arrows go from the record that holds the link to the linked record; links inside blocks and Structured Text count for the field that holds them.
  - "What you see": only records your role can read; data is loaded when Grafo opens and with Reload.

## Review Focus

- Default view on Gestart with all models on: no "outside" hint in the stats line, no context nodes, nothing else changes.
- Rapid selections (click several nodes quickly): transitions interrupt each other cleanly, no jump at the end.
- A selection right after a filter change: the focus animation wins over the pending fit.
- Reduced motion: no animation.
- The help modal follows the CMS theme and closes with its button and Esc.

---

### Task 1 (T1): Defaults, rail and bottom bar

**Files:** modify `src/data/filterGraph.ts` (+ test), `src/data/remapFilters.test.ts` if affected, `src/components/FilterRail.tsx` (+ css), `src/components/CanvasControls.tsx` (+ css), `src/components/GraphWorkspace.tsx`.

**What:** default `showsOutside: true`; hint moved from stats to the rail; rail `user-select: none`; bottom bar layout per the Global Constraints.

**Verify:** new `allFilters` test asserts `showsOutside: true`; in `filterGraph.test.ts` the `with_` base pins `showsOutside: false` so existing tests keep their meaning; in `remapFilters.test.ts` the carry-over test uses `showsOutside: false` (no longer the default). Gate green. Commit.

### Task 2 (T2): Arrows and animated focus `critical`

**Files:** `package.json`/lock (add `d3-transition`, `@types/d3-transition`); modify `src/graph/renderGraph.ts`, `src/graph/graph.module.css`, `src/components/GraphWorkspace.tsx` (call `focusOn` on every user selection).

**What:** markers, link styles and `focusOn` per the Global Constraints. One `selectNode(id)` in `GraphWorkspace` sets the selection and, when `id` isn't null, calls `focusOn`; node click, keyboard, search Enter and inspector rows all use it, and the direct `focusOn` calls in `selectFromInspector`/`jumpToFirstMatch` go away. Background click stays a plain deselect.

**Verify / Done:** gate green. Commit.

### Task 3 (T3): Help modal

**Files:** modify `src/main.tsx`, `src/components/FilterRail.tsx` (+ css), `src/components/GraphWorkspace.tsx`; create `src/entrypoints/HelpModal.tsx` (+ css).

**What:** per the Global Constraints. `FilterRail` gets an `onHelp` prop; `GraphWorkspace` opens the modal through `ctx`. Lazy-load `HelpModal` like `GraphPage`.

**Verify / Done:** gate green. Commit.

### Task 4 (T4): Check on Gestart — manual, at close (depends on: T1–T3)

**What:** `npm run dev`, Grafo on Gestart: outside selection on at open and after Reset; isolate Testimonianza → testimonials + context nodes; arrows readable on a dense node (e.g. "Gestione interventi e materiali"); select by click, keyboard, search and inspector → smooth centring on node + relations; stats bar on a narrow window; double-click a model row doesn't select text; Help opens, reads well in both themes, closes.
