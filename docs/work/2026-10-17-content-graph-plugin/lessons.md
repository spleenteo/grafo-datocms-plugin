# Lessons

- A private plugin installed from `http://localhost:5173/` shows nothing (no tab, no error in the CMS UI) unless `npm run dev` is running: check the dev server before debugging hooks.
- `Graph` from `loadGraph` is cached and readonly: copy nodes and edges before passing them to D3 or anything that mutates.
- Check end-to-end counts on Gestart with the repo's own `parseSchema` + `buildGraph` via `datocms cma:script` file-mode before asking the user to verify in the browser.
- A listing over a non-empty type list costs at least one request even when it returns nothing.
- In d3-drag, `event.active` counts the current gesture during `drag` (start reports the count before increment): reheat on `active === 1`, release on `end` with `!active`.
- A renderer that only exposes `destroy` forces a re-mount on every data change: key joins by id from the start.
- Role isolation is a hard requirement: anything the current role can't read must not exist for it, in the UI and in what the page downloads. The CMA filters records by role but returns the full schema and every block.
- Before answering an architecture question (API choice, permissions, costs), verify on the real project and the docs; don't answer from memory.
