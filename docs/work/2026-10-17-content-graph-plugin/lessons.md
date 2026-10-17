# Lessons

- A private plugin installed from `http://localhost:5173/` shows nothing (no tab, no error in the CMS UI) unless `npm run dev` is running: check the dev server before debugging hooks.
- `Graph` from `loadGraph` is cached and readonly: copy nodes and edges before passing them to D3 or anything that mutates.
- Check end-to-end counts on Gestart with the repo's own `parseSchema` + `buildGraph` via `datocms cma:script` file-mode before asking the user to verify in the browser.
- A listing over a non-empty type list costs at least one request even when it returns nothing.
