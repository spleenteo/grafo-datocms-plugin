# Lessons

- A private plugin installed from `http://localhost:5173/` shows nothing (no tab, no error in the CMS UI) unless `npm run dev` is running: check the dev server before debugging hooks.
- `Graph` from `loadGraph` is cached and readonly: copy nodes and edges before passing them to D3 or anything that mutates.
- Check end-to-end counts on Gestart with the repo's own `parseSchema` + `buildGraph` via `datocms cma:script` file-mode before asking the user to verify in the browser.
- A listing over a non-empty type list costs at least one request even when it returns nothing.
- In d3-drag, `event.active` counts the current gesture during `drag` (start reports the count before increment): reheat on `active === 1`, release on `end` with `!active`.
- A renderer that only exposes `destroy` forces a re-mount on every data change: key joins by id from the start.
- Role isolation is a hard requirement: anything the current role can't read must not exist for it, in the UI and in what the page downloads. The CMA filters records by role but returns the full schema and every block.
- Before answering an architecture question (API choice, permissions, costs), verify on the real project and the docs; don't answer from memory.
- Permission checks are whitelists: count a role as full read only when every condition is explicitly met; unknown keys or malformed entries fail closed.
- Moving a focused element in the DOM (d3 `.raise()`, re-append) drops keyboard focus: never re-order the element that is `document.activeElement`.
- `datocms-react-ui` `Button` drops unknown props such as `aria-label`: give icon buttons visually hidden text.
- A re-mounted renderer must start from the current visible set and view state; otherwise its first update reheats and refits and the restored view jumps.
- State that survives a reload must be keyed by what defines the data (environment + permissions), never by a constant: a constant key leaks view state across roles.
