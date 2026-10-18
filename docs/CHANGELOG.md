# Changelog

What changed in Grafo, by version. Newest first; each entry links the work and the decisions behind it.

## v1.0.0 — 2026-10-18 — First release: record relations as an interactive graph

Grafo adds a tab to the DatoCMS main navigation that draws the records of a project and the links between them as a force-directed graph. It loads only what the current role can read.

- **Graph**: one node per record, coloured by model and sized by relations. Edges come from link fields, Structured Text, Modular Content, single blocks and nested blocks, and from the tree parent.
- **Filters**: by model, status and relation field. Relations outside the selection can be shown in either direction, orphans can be hidden, and a model can be isolated with a double-click. The editor's last filters are remembered per user.
- **Selection**: selecting a record expands the view with its relations and centres on it. The inspector shows the outgoing and incoming relations, the record's dates and creator, and an Open record button.
- **Search and view**: title search with a match count, three label modes, zoom, fit, rearrange layout, and an automatic node distance with a manual override. Reload keeps filters, selection and layout.
- **Configuration**: admins pick the starting models and the excluded models. The migrations model is excluded by default.
- **Access**: data is read through the CMA with the user's token, flat for full-read roles and nested for restricted ones, so a role never sees or downloads what it can't read.
- **Accessibility and theme**: keyboard navigation, a help modal with shortcuts, light and dark theme.
- **Work**: `grafo`
- **Decision**: [load records without nested](decisions-log/2026-10-18-load-records-without-nested.md)
- **Decision**: [nested listing for restricted roles](decisions-log/2026-10-18-nested-listing-for-restricted-roles.md)
- **Decision**: [block links attributed to the record field](decisions-log/2026-10-18-block-links-attributed-to-record-field.md)

---
