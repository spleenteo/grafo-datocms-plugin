# V5 — Role isolation, selection, inspector: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** A role sees only what it may read (nothing else is loaded or shown); clicking a node selects it, highlights its relations and opens an inspector with its incoming and outgoing links; nodes are reachable by keyboard.

**Architecture:** `readAccess` (pure, `src/data/`) turns `ctx.currentRole.meta.final_permissions` into the readable models and a full-read flag; `loadGraph` loads only readable models, flat listings for full-read roles and nested listings (blocks inline, never listed on their own) otherwise. The renderer gains `setSelection` and an internal hover focus; `GraphWorkspace` owns `selectedId`; `Inspector` (`src/components/`) renders `relationsOf` (pure).

**Tech Stack:** TypeScript, React 19, `datocms-plugin-sdk`, `datocms-react-ui`, `@datocms/cma-client-browser`, D3 v7 modules, Vitest.

**Spec:** `slices.md` § V5 (incl. "Constraints from the V4 final review"); `spike-cda-vs-cma.md` § Role check; POC `poc/gestart-graph.html` (`paint()`, `select()`, `renderInspector()`); design: plugin mockup "Canvas" (`isy5V`, focus state) and "Inspector" (`BaOR2`) in `content-graph-dato-design.pen`.

## Global Constraints

- Role isolation is a hard requirement: models the role can't read never reach the graph (no rail row, no count, no node); blocks are never listed by type for a role without full read, so blocks of hidden records are never downloaded. The schema (model and field names) still downloads with the `site` request: unavoidable, accepted. Unknown or unexpected permission shapes count as **not** full read.
- Absent and `null` are the same everywhere (`item_type`, `workflow`, `on_stage`, `to_stage` are optional).
- Readable model = a positive entry with action `all` or `read`, `environment` = `ctx.environment`, `item_type` absent/null or that model, `workflow` absent/null, and no negative `all`/`read` entry for the same environment covering it (`item_type` absent/null or that model).
- Full read is a whitelist, never the complement: for this environment, every model is covered by a positive `all`/`read` entry with `on_creator: 'anyone'` and `workflow`, `on_stage`, `to_stage` all absent/null, **and** there is no negative `all`/`read` entry for this environment. Anything else → not full read (nested listing).
- Requests: full read → as today (schema + flat records at 500 + flat blocks at 500). Otherwise → schema + `items.list` over readable model IDs with `nested: true`, `perPage: 30`, `concurrency: 3`, no block listing. No readable model → schema only, empty graph. Restricted roles are slower on big projects (~1 request per 30 records): accepted for isolation.
- Nested payloads: an inline block is `{ id, relationships.item_type.data.id, attributes: {…fields} }`; inside Structured Text, `block`/`inlineBlock` nodes carry the block object in `item`, `itemLink`/`inlineItem` keep a string id (accept an object with `id` too). Nested rows are `ItemInNestedResponse`-shaped: type `extractLinks`/`buildGraph` inputs to accept both shapes (a union or a structural type), no casts that hide mismatches.
- Click on a node selects it (no longer opens the record); click on the background clears the selection. Focus = hovered node, else selected node; the hover is cleared when its node leaves the visible set. Focus state (POC `paint()` + design): the **selected** node (not the hovered one) gets a halo (own class `halo`, radius `r + 7`, model colour at low opacity — distinct from the `updated` ring at `r + 3.5`); its links get class `hi` (stroke `--color--ink`, full opacity, arrow marker `#…-hi`); other links and non-neighbour nodes get `dim` (opacity 0.12); labels shown for the focused node (dark pill: `--color--ink` background, `--color--surface` text) and its neighbours (text with a `--color--surface` halo stroke). No labels otherwise (label modes are V6).
- Keyboard: each node `tabindex="0"`, `role="button"`, `aria-label="<title>, <model name>"`; Enter or Space selects (Space with `preventDefault`); Escape anywhere in the workspace clears the selection; `:focus-visible` ring with `--color--focus--border`.
- A pending fit-on-end may override `focusOn` (the `userMoved` flag is V6): accepted for V5.
- Selection lives in `GraphWorkspace`; cleared when the selected node is neither core nor context in `visible`. Callbacks into the renderer go through refs (V4 constraint): the mount effect never re-runs on React renders.
- Layout direction (owner, design frame "Mockup"): config rail left, canvas centre with floating controls, record details right. The inspector column is **always present** (290px, `border-left: 1px solid var(--color--border)`); with no selection it shows a muted "Select a record to see its relations."; with a selection, a close button (×, `Button buttonType="muted" buttonSize="xxs"`) top-right clears it.
- Inspector content (design): badges (model: dot in model colour + name; status: dot `--color--ink-success` published, `--color--ink-warning` updated, `--color--ink-subtle` draft + label); title `var(--font-size-xl)`; sections "OUTGOING · n" and "INCOMING · n" (uppercase, `--font-size-xs`, `--color--ink-subtle`), rows = dot, title, field `apiKey` right-aligned in italics (`parent (tree)` for the pseudo field), one flat list per direction as in the design (deviation from the POC, which groups rows under field headings); "Open record" `Button buttonType="primary" fullWidth` → `ctx.navigateTo(recordEditPath(…))`. Relations come from the whole graph, not only the visible set; a row click selects that record when it is visible; a row whose record is hidden by the filters is muted (`--color--ink-subtle`) and its click opens the record (deviation from the POC, which disables it).

## Review Focus

- A role with read on one model only: 36 `changelog`, no other model in the rail, no block request (Network tab), no error.
- Selecting a node, then hiding its model with a filter clears the inspector.
- Hover while something is selected moves the focus temporarily; leaving restores the selection's focus.
- Rapid clicks on different nodes never re-mount the SVG.
- Keyboard: Tab reaches nodes, Enter selects, the inspector updates.

---

### Task 1 (T1): Readable models from the role

**Files:** create `src/data/readAccess.ts`, `src/data/readAccess.test.ts`.

**What:** `readAccess(permissions: { positive_item_type_permissions: unknown[], negative_item_type_permissions: unknown[] }, environment: string, modelIds: string[]): { readableModelIds: Set<string>, isFullRead: boolean }` per the Global Constraints, narrowing entries at runtime (no casts that hide shape mismatches).

**Verify:** tests: admin-like `all` on every model → full read; `read` on one model → that model only, not full read; negative `read` on one model; entry for another environment ignored; `on_creator: 'self'` → readable, not full read; `workflow` entry → not full read; empty lists → nothing readable.

**Done:** gate green. Commit.

### Task 2 (T2): Role-aware loading (depends on: T1) `critical`

**Files:** modify `src/data/loadGraph.ts`, `src/data/extractLinks.ts` (+ test), `src/data/buildGraph.ts` (input type only), `src/entrypoints/GraphPage.tsx`; create `docs/decisions-log/2026-10-18-nested-listing-for-restricted-roles.md` (limits `2026-10-18-load-records-without-nested` to full-read roles; mark the old one with a line pointing to the new one).

**What:** `loadGraph({ apiToken, environment, baseUrl, permissions })`: parse the schema, keep only readable models (block models stay), list per the Global Constraints, build the graph. Memo key = environment + baseUrl. `extractLinks` accepts inline block objects and Structured Text nodes holding objects. `GraphPage` passes `ctx.currentRole.meta.final_permissions`; the load effect depends on `JSON.stringify` of it (stable string), never on the object, so a new `ctx` doesn't reload and unmount the workspace.

**Verify:** `extractLinks` tests: inline modular block with a link; Structured Text `block` node holding an object with a nested inline block; `itemLink` with object `item`. At close the controller runs the role check via `cma:script`: the admin client reads `roles.find('89878').meta.final_permissions` ("Changelog reader"), `readAccess` on it, then the "Changelog app" token runs the restricted listing (expected: 36 `changelog`, no block request); also logs `readAccess` for the admin role on Gestart (expected: full read).

**Done:** gate green. Commit.

### Task 3 (T3): Selection and focus in the renderer `critical`

**Files:** modify `src/graph/renderGraph.ts`, `src/graph/graph.module.css`, `src/components/GraphView.tsx` (minimal: pass `onSelect` through a ref as a no-op until T4, so the gate stays green).

**What:** `renderGraph(svg, data, { modelName, onSelect })` returns `{ update, setSelection(id: string | null), focusOn(id: string), destroy }`. Node click → `onSelect(id)`; background click → `onSelect(null)`; hover tracked inside the renderer; focus, labels, halo, `hi`/`dim`, second arrow marker and keyboard per the Global Constraints; focus recomputed after `update`. `focusOn` centres the node at scale `max(current, 1.2)` via `zoom.transform`, no transition. `onOpen` goes away from the renderer.

**Verify / Done:** gate green. Commit.

### Task 4 (T4): Inspector and selection state (depends on: T3)

**Files:** create `src/data/relationsOf.ts` (+ test), `src/components/Inspector.tsx`, `src/components/Inspector.module.css`; modify `src/components/GraphView.tsx`, `src/components/GraphWorkspace.tsx` (+ css).

**What:** `nodeIndexById(graph): Map<string, number>` and `relationsOf(graph, nodeIndex): { outgoing: Relation[], incoming: Relation[] }` with `Relation = { nodeIndex, field: number }`, self-links excluded, sorted by field apiKey then title. `GraphWorkspace` holds `selectedId`, validates it against `visible`, passes it to `GraphView` (effect → `setSelection`) and renders `Inspector` per the Global Constraints. Row click: visible → select + `focusOn`; hidden → open record. Escape clears the selection. `GraphView` keeps `onSelect` in a ref.

**Verify:** `relationsOf` tests: in/out split, self-link excluded, sort order. Gate green. Commit.

### Task 5 (T5): Check on Gestart — manual, at close (depends on: T2, T4)

**What:** controller runs the role check (T2). Then `npm run dev`, Grafo on Gestart as admin: select, hover, background click, Escape, close button, filter hides the selection, inspector rows (visible and hidden), Open record, keyboard; both themes. When the owner has a restricted collaborator: log in as them, check the rail shows only readable models and the Network tab has no block listing.
