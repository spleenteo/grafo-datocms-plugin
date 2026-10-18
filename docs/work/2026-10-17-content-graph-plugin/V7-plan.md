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

---

## Close fixes (owner check, 2026-10-18)

Root causes (verified in code and with a d3-force run on Gestart, `.superpowers/v7-debug/distance.ts`):
- After a filter change the fit happens only on the simulation `end` (seconds later) and instantly; with `userMoved` set (any earlier zoom) it never happens.
- Distance: charge `−(70 + 9r)·D` with gravity `0.05 / D` scales core spacing faster than core→context links (ratio 3.86 → 4.43 from D=1 to 3 on Testimonianza). Charge `·D²` with constant gravity keeps the shape (3.86 → 3.79) and scales spacing linearly (doc_page 212 → 426 → 638).
- +/− and fit are instant; the relayout glyph ↻ reads as "reload".

### Task 5 (T5): Smooth reframing and uniform distance `critical`

**Files:** modify `src/graph/renderGraph.ts`.

**What:**
- Camera follow: after `update()` and `setDistance()` (when not `userMoved`), on each tick while alpha > 0.05 the transform eases toward the fit target of the visible nodes (`t = t + (target − t)·0.12` on x, y, k, applied via `zoom.transform` with no source event); at `end` a 450 ms transition to the final fit. A user wheel/drag during the follow sets `userMoved` and stops it. `prefers-reduced-motion`: no follow, one instant fit at `end`.
- `reframe()` handle method: resets `userMoved` so the next `update()` follows and fits even after a user zoom.
- Distance: charge `−(70 + 9r)·D²`, forceX/forceY strength constant 0.05, link distance `40·D`, collide `r + 2 + 2·D`.
- `zoomBy` animates (250 ms transition of `scaleBy`); the handle's `fit()` animates (450 ms); relayout keeps its synchronous layout and animates the camera to the fit (450 ms). All honour reduced motion; all transitions are interrupted by user gestures, a new `focusOn`, or `destroy()`.

**Verify / Done:** gate green. Commit.

### Task 6 (T6): Reframe on isolate/reset and clearer zoom icons (depends on: T5)

**Files:** modify `src/components/FilterRail.tsx`, `src/components/GraphWorkspace.tsx`, `src/components/GraphView.tsx` (expose `reframe`), `src/components/CanvasControls.tsx` (+ css).

**What:**
- Double-click isolate, Reset filters and the models "All"/"None" buttons call `reframe()` before the filter change (explicit "show me this" intents); single chip/row toggles keep respecting `userMoved` (V6 behaviour).
- Zoom stack icons as inline SVGs (`currentColor`, 16×16, stroke 1.75, `aria-hidden`): plus, minus, "frame" (four corner brackets) for fit, "shuffle" (two crossing arrows) for relayout. Labels/tooltips: "Zoom in", "Zoom out", "Fit to screen", "Rearrange layout".
- Help modal shortcut list unchanged; its "Relayout" mention (if any) renamed to "Rearrange layout".

**Verify / Done:** gate green. Commit.

### Task 7 (T7): Size by relations relative to the view, label-aware fit `critical`

Owner check 2: labels fall outside the frame after a reframe; nodes look all the same size. Measured on Gestart (`.superpowers/v7-debug/radii.ts`): median degree 0 (r 5), p90 r 9.5, max r 16; with Testimonianza isolated radii span 5–11.4, mostly 5–8. `fitTransform()` bounds use only `x ± r`, ignoring labels that extend up to ~30 characters to the right.

**Files:** modify `src/graph/prepareSimulation.ts` (+ test), `src/graph/renderGraph.ts`.

**What:**
- `relativeRadius(degree: number, maxDegree: number): number` (pure, exported from `prepareSimulation.ts`) = `4 + 16 * Math.sqrt(degree / maxDegree)`, with `maxDegree <= 0 → 4`. `degree` stays the record's total relations (self-links excluded).
- The renderer computes `r` for visible nodes from the max degree among the visible ones, at mount and on every `update()`; changed radii update every derived element (dot, `updated` ring at `r + 3.5`, halo at `r + 7`, label x offset `r + 5`, link-end shortening, collide radius, charge `−(70 + 9r)·D²`) and re-initialise the forces (`simulation.nodes()` already does it after `update`).
- `fitTransform()` and the focus-scale maths include label extents: for each visible node, right edge = `x + r + 5 + labelWidth(title)` where `labelWidth` = `min(chars, 30) · 6.2` (11 px font estimate, chars by code points, `…` counted), applied for nodes whose label is currently shown; vertical extent ± max(r, 8).

**Verify:** `relativeRadius` tests: 0 → 4; max → 20; quarter of max → 12; `maxDegree` 0 → 4. Gate green. Commit.
