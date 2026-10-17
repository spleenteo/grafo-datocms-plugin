# Development guidelines

Rules the plans and the code must follow. Short and checkable.

## Language

Everything in English: code, comments, docs, commit messages, UI strings.

## Tests

- Vitest. Test files next to the source: `foo.ts` → `foo.test.ts`.
- Test only pure logic where a bug would be silent: graph building from CMA payloads (relation extraction from link fields, Structured Text, nested blocks), filtering.
- A few small tests per module, one behaviour each, hand-written fixtures. No snapshots, no mocks of the SDK.
- No tests for React components, D3 rendering or plugin wiring: verified by hand in the DatoCMS dashboard.
- No TDD by default.

## Naming

- camelCase for variables and functions, PascalCase for components and types, kebab-case not used for files: `GraphView.tsx`, `buildGraph.ts`.
- Booleans as questions: `isDraft`, `hasRelations`.
- DatoCMS terms as the API uses them: `itemType` (model), `item` (record), `field`, `apiKey`.

## Functions and modules

- Data layer (CMA fetching, graph building) is framework-free TypeScript, no React imports.
- Rendering never calls the CMA directly; it receives a built graph.
- Keep functions short and single-purpose; split when a function mixes fetching and transforming.

## Code placement

- `src/entrypoints/`: one component per plugin entry point (config screen, page).
- `src/data/`: CMA client usage, caching, graph building.
- `src/graph/`: D3 simulation and rendering.
- `src/components/`: UI pieces built on `datocms-react-ui`.
- `src/utils/`: framework glue only (React `render` helper).

## Dependencies

- Required: `datocms-plugin-sdk`, `datocms-react-ui`, `@datocms/cma-client-browser`, `d3` (only the submodules used).
- Prefer `datocms-react-ui` components and CSS variables over custom styling; no other UI kit, no custom fonts.
- Any other runtime dependency needs a reason in the plan.

## API usage

- Minimize CMA calls: fetch schema once per page load, list records with the maximum page size, never fetch records one by one.
- Never hardcode or log tokens; use the token the plugin receives from the SDK.

## Commits

- Imperative mood, English, one concern per commit.
- Never commit `poc/`, `Idea.md`, `.env*`, `dist/`.

## Gate

```bash
npm run typecheck
npm test
npm run build
```
