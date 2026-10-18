# V10 — Marketplace release: Plan

Operational slice: the code is done (V1–V9). Most of the preparation landed in V9 (`a551685`): README, `package.json` metadata, `assets/` (cover, preview video, screenshots). Each step below that leaves the machine asks first.

## Steps

1. **Pre-flight (local, no network writes).**
   - Gate green.
   - `npm pack --dry-run`: `dist/`, `assets/cover.png`, `assets/preview.mp4`, README and LICENSE only. Check the size.
   - `dist/index.html` uses relative paths.
   - `package.json`: name `datocms-plugin-grafo` (free on npm), keyword `datocms-plugin`, `homepage` set to the GitHub repo, version `1.0.0`.
   - README image URLs point at `main`.
   - Update the `CLAUDE.md` status.
2. **Changelog and version (`devflow-docs`).** Create `docs/CHANGELOG.md` with the `1.0.0` entry for work `grafo`, linking the decisions. Write `.version` = `1.0.0`. Commit on `grafo`.
3. **Archive the work (`devflow-archive`).** Move `docs/work/2026-10-17-grafo/` to `docs/work/archive/` and add a line to `docs/work/archived.md`. Commit on `grafo`.
4. **Merge and push (asks).** Merge `grafo` into `main` (fast-forward if possible; `main` is still at `255dde8`). Push `main`. Keep or delete the `grafo` branch, as the owner decides. Then check that the README images load from `raw.githubusercontent.com/.../main/...`.
5. **Publish (asks; needs `npm login` by the owner: `npm whoami` is not logged in).** `npm publish` from `main`. Then check that the package page on npm shows the README and that the DatoCMS marketplace listing appears with the cover and preview (indexing can take a while).
6. **Switch the Gestart installation (asks, optional).** On Gestart, Plugins → Grafo → "Switch to a Marketplace package". This keeps the plugin settings and stops depending on `localhost:5173`.

## Done

- Plugin installable from the marketplace listing, with README, cover and preview shown correctly.
- `main` holds the code, the changelog and the archived work in one changeset.
