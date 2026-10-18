# V1 — Empty full-page plugin: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** A "Content Graph" tab in the DatoCMS main navigation opens a full-page plugin that renders a themed placeholder.

**Architecture:** Vite + React SPA loaded by DatoCMS in an iframe. One top-level `connect()` in `src/main.tsx` declares `mainNavigationTabs` and dispatches `renderPage` to `src/entrypoints/GraphPage.tsx`, wrapped in `<Canvas ctx={ctx} noAutoResizer>`.

**Tech Stack:** TypeScript, React 19, Vite, `datocms-plugin-sdk` ^2.5, `datocms-react-ui` ^2.5, Vitest.

**Spec:** `docs/work/2026-10-17-grafo/slices.md` § V1; `docs/development-guidelines.md`. Baseline files: `datocms-plugin` skill, `references/project-scaffold.md` (lazy-loading entry template) and `references/custom-pages.md`.

## Global Constraints

- Package name `datocms-plugin-content-graph`, version `0.1.0`, `"type": "module"`, keyword `datocms-plugin`.
- `datoCmsPlugin`: `title: "Content Graph"`, `entryPoint: "dist/index.html"`, `permissions: ["currentUserAccessToken"]`: declared for the Marketplace; private installs ignore it and grant it in the UI (T4).
- `homepage: "https://github.com/spleenteo/content-graph-datocms-plugin"`.
- Plugin code at repo root (no subfolder). Directories per guidelines: `src/entrypoints/`, `src/utils/` (render helper).
- Only `datocms-react-ui` components and Canvas CSS variables; no custom fonts, no hardcoded colours.
- Never commit `poc/`, `Idea.md`, `.env*`, `dist/`, `node_modules/` (already in `.gitignore`).
- English everywhere.

## Review Focus

- Theme: page must read correctly when the CMS is in dark mode (Canvas variables only, no `prefers-color-scheme`).
- Full height: page fills the iframe (`noAutoResizer`), no double scrollbars.
- Exactly one `connect()`; `datocms-react-ui/styles.css` imported once in `src/main.tsx`; `src/vite-env.d.ts` present.

---

### Task 1 (T1): Scaffold the plugin and the page `critical`

**Files:** create `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/vite-env.d.ts`, `src/utils/render.tsx`, `src/main.tsx`, `src/entrypoints/GraphPage.tsx`, `src/entrypoints/GraphPage.module.css`.

**What:**
- Files as in the skill's `project-scaffold.md` (basic `vite.config.ts` with `base: './'`, React 19 `overrides` block). Keep `typescript` at `^6.0.3`.
- Both `tsconfig.app.json` and `tsconfig.node.json` set `tsBuildInfoFile` to `./node_modules/.tmp/tsconfig.<app|node>.tsbuildinfo`, so `tsc -b` leaves nothing in the repo root.
- Scripts: `dev` (`vite`), `build` (`tsc -b && vite build`), `typecheck` (`tsc -b`), `test` (`vitest run --passWithNoTests`), `preview`, `prepublishOnly`. Add `vitest` as devDependency. No test file in V1: nothing pure to test yet (guidelines).
- `mainNavigationTabs`: one tab, `label: 'Content Graph'`, `pointsTo: { pageId: 'graph' }`, `placement: ['after', 'content']`, `icon: 'diagram-project'`.
- `renderPage`: `switch (pageId)`, case `'graph'` → lazy `GraphPage` inside `Suspense` with `<Spinner size={60} placement="centered" />`.
- `GraphPage({ ctx }: { ctx: RenderPageCtx })`: `<Canvas ctx={ctx} noAutoResizer>`, full-height layout, heading "Content Graph" and one muted line ("Record relations will appear here."). Styles via CSS module using Canvas variables only.

**Verify:** `npm install`, then `npm run typecheck && npm test && npm run build` all exit 0; `npm run dev` serves on `http://localhost:5173/`.

**Done:** gate green; `git status` shows no `dist/`, `node_modules/` or `*.tsbuildinfo`. Commit.

### Task 2 (T2): Minimal README and license (depends on: T1)

**Files:** create `README.md`, `LICENSE` (MIT, holder `spleenteo`, 2026); modify `CLAUDE.md`.

**What:** README, terse: one-line purpose, status "work in progress", local development (`npm install`, `npm run dev`, install as private plugin from `http://localhost:5173/`, grant `currentUserAccessToken` in the plugin's permissions tab), scripts. Full README is V6.

`CLAUDE.md`: replace the "Status" section (no longer pre-code) with the real commands (`npm run dev`, gate: `npm run typecheck && npm test && npm run build`).

**Verify / Done:** no secrets, no project IDs or tokens in the text. Commit.

### Task 3 (T3): Public GitHub repo (depends on: T2)

**What:** `gh repo create spleenteo/content-graph-datocms-plugin --public --source . --remote origin`, then push `main`. **Ask the user before running** (outward-facing).

**Verify / Done:** repo public on GitHub; `poc/` and `Idea.md` absent from the remote tree (`gh api repos/spleenteo/content-graph-datocms-plugin/contents`).

### Task 4 (T4): Install and check in DatoCMS — manual, at close (depends on: T1)

**What:** on the test project, add a private plugin from URL `http://localhost:5173/` (UI: Configuration → Plugins → Add new → Create a new private plugin) and grant `currentUserAccessToken`. Done by the user in the UI, or via CMA only on explicit consent.

**Verify / Done:** with `npm run dev` running, the "Content Graph" tab appears after Content, the page renders full height, readable in both light and dark CMS themes.
