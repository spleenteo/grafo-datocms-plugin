# Content Graph

DatoCMS plugin that renders record relations as an interactive graph.

Status: work in progress. Currently an empty full-page placeholder behind a "Content Graph" tab in the main navigation.

## Local development

```sh
npm install
npm run dev   # http://localhost:5173/
```

Install as a private plugin:

1. In DatoCMS: Configuration → Plugins → Add new → Create a new private plugin.
2. Set the entry point URL to `http://localhost:5173/`.
3. Open the plugin's permissions tab and grant `currentUserAccessToken`.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then production build to `dist/` |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Vitest (passes with no tests) |
| `npm run preview` | Serve the production build |

## License

MIT
