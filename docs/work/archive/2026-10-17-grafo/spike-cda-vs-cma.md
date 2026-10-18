---
spike: cda-vs-cma
date: 2026-10-18
project: Gestart Website (32292), primary environment, read-only
status: done
---

# Spike — CDA instead of CMA for loading the graph

Question raised by the owner: the plugin only reads, CDA calls are cheaper and faster, GraphQL returns structured JSON with meta fields. Why CMA?

## Findings

**1. Cost.** CMA calls are priced 10× CDA calls: extra packets €9 per 100K CMA calls vs €9 per 1M CDA calls; standard plans moved the old allowance to CDA and added 10% for CMA. Reason given by DatoCMS: CMA can't be cached, CDA can. ([2026 pricing](https://www.datocms.com/blog/introducing-our-2026-pricing-changes))

**2. Same graph, same request count, faster.** A schema-driven GraphQL query generator (spike script, not in the repo) rebuilt Gestart from the CDA with `X-Include-Drafts: true`:

| | Requests | Time (2 runs) | Payload | Result |
|---|---|---|---|---|
| CDA | 3: introspection (134 KB), `_all…Meta { count }` for every model, one aliased query for all records (67 KB) | 217 / 263 ms | 201 KB | 248 records, 347 edges |
| CMA | 3: site + includes, records, blocks | ~400 ms | — | 248 records, 347 edges |

Edge sets identical (difference 0 both ways). Complexity of the records query: 126,039 of the project's 21,294,900 max (0.6%). The count request can go (ask `first: 500`, paginate only models that return 500), so CDA needs 2 requests on Gestart.

**3. How the query is built.** One root `all<Models>(first: 500, skip)` per model, aliased in one document. Per record: `id _status _modelApiKey <title>`, plus per relation field:
- link/links: `field { __typename ... on RecordInterface { id } }`;
- modular content / single block: `field { __typename ... on <Block>Record { id <its relation fields> } }`, recursive, pruned when a block type holds no relations;
- Structured Text: `links { ... on RecordInterface { id } }` + `blocks`/`inlineBlocks` fragments as above;
- tree models: `parent { id }`.
GraphQL names: type `Pascal(api_key) + "Record"`, field `camel(api_key)`; root collection names (pluralised) and Structured Text sub-fields (whether `links` is a selectable type) come from introspection. Localized relation fields need `_all<Field>Locales { value { … } }` (none on Gestart, not exercised).

**4. Token — the open point.**
- The plugin SDK exposes one additional permission, `currentUserAccessToken`, documented for the CMA only. ([Additional permissions](https://www.datocms.com/docs/plugin-sdk/additional-permissions)) `ctx.cdaEndpointUrl` exists, but no CDA token.
- The CLI's OAuth user token is rejected by the CDA (`401 INVALID_AUTHORIZATION_HEADER`). An old community thread reports the same for the plugin's injected token. ([community](https://community.datocms.com/t/request-allow-injected-token-to-work-for-graphql-api-as-well/2722))
- **In-plugin probe (2026-10-18, Gestart):** `ctx.currentUserAccessToken` on `ctx.cdaEndpointUrl` → `401 INVALID_AUTHORIZATION_HEADER`. The same token on CMA `GET /access_tokens` (admin user) → `200`, listing the hardcoded "Read-only API token". The CDA does not accept the user session token: it's a platform choice, not an implementation detail of the plugin.
- Every project has a hardcoded **"Read-only API token"** (on Gestart: CDA ✓, CDA preview ✓, CMA ✓ read-only). Reading it through the CMA needs a role allowed to manage API tokens (admins).

**5. Permissions semantics.** A CDA token sees every record of the environment; `currentUserAccessToken` sees what the user's role allows. With a project token, an editor with a restricted role would see titles of records their role hides. `currentUserAccessToken` also carries the user's write permissions: the plugin never writes, but the token could.

## Options (to discuss)

- **A. Keep CMA (today).** No setup, role-aware, 3 calls per load at CMA price.
- **B. CDA with a token from the plugin settings.** Config screen where an admin pastes a read-only CDA token with preview access (or a button that fills it from the project's "Read-only API token" via one CMA call made by an admin). Then the plugin no longer needs `currentUserAccessToken` at all: it can't write anywhere. Cost: setup step, token readable by anyone who can read plugin parameters, not role-aware.
- **C. CDA with `currentUserAccessToken`.** Ruled out by the probe (401). Would need DatoCMS to accept user session tokens on the CDA (feature request).
- Schema for B/C: introspection (1 CDA call) plus `ctx.itemTypes` (free) for names, tree flag and title field; no CMA call.

## Role check with the CMA (2026-10-18)

Token "Changelog app", role "Changelog reader" (read: `changelog` only), same calls as `loadGraph`:
- schema (`site` + includes): all 19 models and 21 blocks visible;
- `items.list` over all model IDs: 36 records, all `changelog` (no error, other models silently filtered);
- `items.list` over all block-model IDs: **all 333 blocks**, including blocks of records the role cannot read;
- graph: 36 records, 0 relations (links to hidden records dropped as dangling).

So records and relations follow the role; two leaks remain: model names of unreadable models in the filter rail (count 0), and block payloads of hidden records downloaded (not displayed).

## Decision (owner, 2026-10-18)

- Roles are a hard requirement: a role must see only content it is authorised for; everything else must not exist for it. Option B (project CDA token) is out.
- Stay on the CMA for now: few calls, benefit of the CDA not perceptible yet.
- Open: the owner asks the DatoCMS team (1) why the CDA rejects the user session token, (2) whether block listing ignoring role read permissions is intended. Revisit CDA (option C) if (1) changes.
- To fix in a later slice: hide unreadable models from the rail; avoid downloading blocks of unreadable records (nested listing for restricted roles, or a CMA fix).
