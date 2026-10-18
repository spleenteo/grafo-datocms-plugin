# V1 — Canvas at scale: plan

**Goal**: on a ~2000-node graph (Acacia) the pointer can sweep the canvas without flashing the whole graph, a node can be reached and clicked, and labels stay readable at any zoom.

**Scope**: `src/graph/renderGraph.ts`, `src/graph/graph.module.css`, new `src/graph/labelBudget.ts` (+ test). No data-layer or React changes, no change to the `RenderGraphHandle` interface.

## Global constraints

- Gate: `npm run typecheck && npm test && npm run build`.
- Tests only for the pure helper (guidelines: no D3/rendering tests).
- Keyboard focus (`focus`/`blur` on a node) stays immediate: no dwell.
- Gestart (< 600 visible nodes) keeps today's hover behaviour apart from the 150 ms dwell.
- Never commit `design/content-graph-dato-design.pen` or `design/export/video.mp4`.

## Constants (new, in `renderGraph.ts` unless noted)

| Name | Value | Meaning |
| --- | --- | --- |
| `HOVER_DELAY` | 150 ms | dwell before a pointer hover counts |
| `HOVER_FOCUS_MAX_NODES` | 600 | above this many visible nodes, hover doesn't dim |
| `LABEL_BUDGET` | 40 | Smart labels chosen by degree among in-view nodes |
| `LABEL_FONT` | 11 px | base label size (today in CSS) |

`SMART_MIN_DEGREE` and `SMART_MIN_SCALE` go away; `SMART_MAX_NODES` (45) stays: at or under it Smart shows every label.

## T1 — `pickLabelBudget` helper

File: `src/graph/labelBudget.ts`, test `labelBudget.test.ts`.

```ts
export interface LabelCandidate { id: string; degree: number; x: number; y: number }
export interface ViewBox { x0: number; y0: number; x1: number; y1: number } // graph units
export function pickLabelBudget(nodes: readonly LabelCandidate[], view: ViewBox, budget: number): Set<string>
```

Keeps the nodes whose point lies inside `view` (inclusive), sorts by degree desc then id asc (stable, deterministic), returns the first `budget` ids. Budget ≤ 0 or empty view → empty set.

Tests (one behaviour each): nodes outside the view are never picked; the highest-degree nodes win when more than `budget` are in view; all in-view nodes when fewer than `budget`; ties broken by id; budget 0 → empty.

Done: tests green.

## T2 — Hover intent and hover without dimming above the threshold (`critical`)

File: `renderGraph.ts` (+ CSS if needed).

- Split pointer hover from focus. `mouseenter` starts a `HOVER_DELAY` timer; when it fires, `hoveredId = d.id` and `schedulePaint()`. `mouseleave` clears a pending timer; if that node was hovered, clears `hoveredId` at once (moving to empty space un-dims immediately). Only one pending timer at a time; `destroy()` clears it. `focus`/`blur` set/clear `hoveredId` immediately as today.
- `currentFocus()` returns `{ sel, focus, hover }`: `hover` is the visible hovered id; `focus` is `hover` only when `visibleNodes.length <= HOVER_FOCUS_MAX_NODES` **or the hover came from keyboard focus**, else `sel`. Track the keyboard case with a `hoverFromKeyboard` flag set in `focus`, cleared in `blur`/`mouseenter`.
- Above the threshold, a pointer-hovered node gets its label shown and the pill (`placePill` on `hover ?? focus`), without `focused`/`near`/`focusing`. Its label must be the readable pill style: the CSS rule for `.focused .label` (white text on ink) applies to a new class `hovered` too. The node is raised (as `placePill` does) so it draws on top.
- `paint()` diffs the hovered id the same way it diffs `paintedFocus` (O(1) per hover change); `paintAll()` sets it from scratch.
- `labelOn()` includes the hovered id.

Done: Acacia full view, sweeping the pointer across the core never dims the graph; dwelling on a node shows its label pill; clicking selects and dims as today. Gestart: hover dims after 150 ms. Tab through nodes dims immediately on both.

## T3 — Constant label size and Smart label budget (depends on T1, T2)

Files: `renderGraph.ts`, `graph.module.css`.

- **Size**: on every zoom event set `--label-k` on the root svg to `Math.max(1, k)` (only when it changes by more than 1%); CSS `.label { font-size: calc(11px / var(--label-k, 1)); stroke-width: calc(3.5px / var(--label-k, 1)); }`, and the label `x` offset becomes `n.r + LABEL_GAP / labelK` and `y` `4 / labelK`, updated with the variable. Above k = 1 labels keep their on-screen size; below it they shrink with the graph as today. `labelWidth` for the fit is divided by the same `labelK` (fit then slightly over-estimates when the target scale differs: acceptable, note it in a comment). Remeasure the pill when `labelK` changes.
- **Budget**: Smart shows focus set + hovered + matches + `budgetIds`, or every label when `visibleNodes.length <= SMART_MAX_NODES`. `budgetIds = pickLabelBudget(visibleNodes, viewBox(), LABEL_BUDGET)`, where `viewBox()` inverts the current zoom transform over the svg client size. Recompute (then `paintLabels()`) on zoom **end** (d3-zoom `end` event, not per frame), on the simulation `end`, after `update()`/`paintAll()`, and on `setLabelMode('smart')`. "All" and "On focus" ignore the budget.
- Remove `SMART_MIN_DEGREE`, `SMART_MIN_SCALE`, `wasSmartScale` and their checks in the zoom handler and in `paint()`.

Done: Acacia, zoom to 4×: labels stay the same pixel size; Smart never shows more than 40 labels plus focus/hover/matches; panning and releasing updates which ones. Gestart (< 45 visible after filters) shows all labels as before; full Gestart (197) shows its 40 hubs.

## Order

T1 → T2 → T3. T2 and T3 share `renderGraph.ts`, so sequential. Final whole-branch review: no (3 tasks, one file family).

## Review rulings (2026-10-18)

These override the task text above where they conflict.

1. **Hovered style above the threshold**: no pill. The single pill stays on `focus` (selection). A hovered node gets class `hovered`: label shown in the normal ink-on-surface style, `font-weight: 600`, raised. `.focused .label` (white on ink) is untouched.
2. **Dwell vs click**: `mousedown` on a node cancels the pending hover timer; no `raise()` while a pointer button is down (track it with `pointerdown`/`pointerup` on the svg).
3. **One hover timer, both directions**: `mouseenter` schedules `hoveredId = d.id`, `mouseleave` schedules `hoveredId = null`, both after `HOVER_DELAY`; each schedule replaces the pending one. Moving between neighbours keeps the old focus until the new one commits (no un-dim/re-dim blink). The timer callback returns if `destroyed`; `update()` drops a pending target that left the visible set; `destroy()` clears it.
4. **Keyboard**: `hoverFromKeyboard` is set in `focus` only when `this.matches(':focus-visible')`, so a mouse click (which focuses the `tabindex=0` node) doesn't bypass the threshold. Reset whenever `hoveredId` changes through the pointer path and in `blur`.
5. **Label scaling, no per-node writes on zoom**: each node gets an outer `<g class="labelAnchor">` with `transform="translate(r, 0)"` (written in `enterNodes` and on radius change in `join()` only) wrapping an inner `<g class="labelBox">` holding the text (`x = LABEL_GAP`, `y = 4`) and, when present, the pill. CSS: `.labelBox { transform: scale(calc(1 / var(--label-k, 1))); }` (origin = the anchor point). The zoom handler writes only `--label-k = max(1, k)` on the root svg, when it changes by more than 1%. Pill padding and radius live inside `labelBox`, so they scale with it; `getBBox()` of the text is in the box's own units, unaffected by the CSS transform.
6. **Fit**: `nodeBox`/`extendBox` keep label geometry at `labelK = 1` (widest case) for fit, focus and camera follow. When the resulting scale is above 1 the labels are smaller than assumed: more margin, never clipping. Say so in a comment. No `LABEL_FONT` constant.
7. **Budget wording**: Smart shows at most `LABEL_BUDGET` budget labels **plus** the focus set (focus + neighbours), the hovered node and search matches. Labels shrink with the graph below k = 1 on purpose (deviation from the slice's "any zoom"; zoomed-out labels at full size would cover the graph).
8. **Budget inputs**: skip nodes with undefined `x`/`y`; `degree` is the record's total relations (same value that sizes the node), documented in the helper. View box from `svgEl.clientWidth/clientHeight` inverted through `zoomTransform(svgEl)`. Recompute also on drag end. Zoom `end` callback guarded by `destroyed`.

## Manual check (owner, after T3)

- Acacia full view: sweep the pointer across the core, no dimming; dwell → bold label; quick click selects (no deselect); Tab dims immediately.
- Acacia: zoom to 4× and 6×, labels same pixel size; Smart ≤ 40 labels + focus; pan and release updates them; Fit after zoom-in doesn't clip labels.
- Gestart: hover dims after ~150 ms, moving between neighbours doesn't blink; small filtered views show every label.
