# Data layer

Status: **Draft**. Package: `@xoong/data`.

The data layer turns an OpenAPI 3.x document into a typed client, an automatic
cache, a shared entity store, derived views and live updates.

## 1. Sync

```bash
xoong sync ./openapi.json     # or a URL
```

Generates (into `.xoong/`, git-ignored or committed, your choice):

| File | Purpose |
|---|---|
| `api.d.ts` | TypeScript types for every operation, request and response |
| `operations.json` | Runtime table: operationId, method, path template, query names, response descriptor and entity definitions |

You never write an HTTP client, a base URL constant or a response type.

## 2. Operation identity and cache keys

* An **operation** is identified by its `operationId` (or `METHOD path` if
  absent; `xoong doctor` recommends adding ids).
* **Cache key** = `operationId` + canonicalized parameters (sorted keys,
  normalized values). Developers never declare keys.
* GET results use stale-while-revalidate. Freshness is one client-wide setting,
  `staleTime` (default 30 s) in `configure()`; there is no per-operation or
  per-view override. `gcTime` and `retry` are client-wide as well.

## 3. Mutations and invalidation

One rule, derived from the REST path: after a mutation succeeds, every cached
query whose concrete path and the mutation's concrete path share a segment
prefix (one is a prefix of the other) is marked stale, and refetched at once if
a view is showing it. The HTTP method does not matter.

| Mutation | Invalidated |
|---|---|
| `POST /users` | `GET /users`, `GET /users/42` (the path is a prefix of it) |
| `PUT/PATCH /users/{id}` | `GET /users/{id}`, `GET /users` |
| `DELETE /users/{id}` | `GET /users/{id}`, `GET /users` |
| `POST /users/42/disable` | `GET /users`, `GET /users/42`; not `GET /users/42/posts` or `GET /users/43` |
| Any, if the response returns an entity | That entity is upserted into the store |

A detail query whose entity the response just rewrote is already fresh and is
not refetched. A delete does not remove the entity from the store: the list
refetch no longer returns it, so it drops out of the list, and a detail query
for it refetches and reports the server's error (typically 404). Entities no
cached query reaches are evicted later (see Known limitations). Only a stream
`delete` event removes an entity at once.

Override (rare, explicit) with `configure({ invalidate })`: a mutation
operation id maps to the operation ids of the queries to refresh as well
(exact names, no wildcards):

```js
configure({ api, invalidate: { shipOrder: ['getDashboard', 'listOrders'] } })
```

## 4. Entity store

Responses are **normalized**: each object whose schema has an identity is
stored once, as `Schema#id`.

Identity resolution, in order:

1. `x-xoong-id: <propertyName>` on the schema
2. a property named `id`
3. otherwise the schema is stored inline (not shared) and `xoong doctor`
   warns if it looks like it should be an entity

Two screens that show `User#42` read the same record. A change made by one
mutation or stream event is visible to both.

## 5. Derived views

Different screens often need the same data arranged or computed differently.
Instead of a new API call or a new backend endpoint:

```js
import { derived } from '@xoong/data'

export const revenueByRegion = derived(({ all }) =>
  Object.entries(Object.groupBy(all('Order'), (o) => o.region)).map(([region, rows]) => ({
    region,
    total: rows.reduce((sum, o) => sum + o.amount, 0),
  })),
)
```

* `all(name)` returns every currently **loaded** entity of that type (from any
  query), as plain objects. `get(name, id)` returns one.
* `derived` reads from the entity store and recomputes only when the entities
  it touched change (signal tracking).
* Fetching is still declared on the view (`get="/orders"`); `derived` never
  triggers requests itself.

## 6. Streaming

Opt-in per view:

```html
<xo-view get="/users" live>
```

Set the endpoint once: `configure({ api, streamUrl: '/api/events' })`. All
`live` views share one connection, opened with the first one and closed when
the last goes away. Transport: Server-Sent Events (`EventSource`, with
credentials); there is no WebSocket transport. Without `streamUrl` a `live`
view logs a warning and gets no updates. Event format (JSON, one per message):

```json
{ "type": "patch",  "entity": "User", "id": "42", "path": "/email", "value": "a@b.c", "version": 17 }
{ "type": "upsert", "entity": "User", "id": "42", "value": { "...": "..." }, "version": 18 }
{ "type": "delete", "entity": "User", "id": "42", "version": 19 }
{ "type": "resync" }
```

Rules:

* `version` is optional and per entity. An event whose version is not higher
  than the last one applied to that entity is dropped (deletes keep theirs, so a
  late event cannot bring the entity back).
* `patch` changes one field of an entity that is already loaded; for an unknown
  entity it is dropped. `upsert` merges into the stored record (or creates it).
  `delete` removes the entity, and references to it drop out of lists.
* `path` is a JSON Pointer. Only the addressed field changes; other fields and
  other screens are untouched.
* `resync` forgets the stored versions and refetches every cached query.
* Reconnection and `Last-Event-ID` replay are done by the browser's
  `EventSource`. After an interruption the client cannot know what was missed,
  so once the connection is open again it forgets the versions and refetches
  every cached query, whether or not the server replays.
* The [stream gateway](server.md#stream-gateway) (planned) can translate a
  backend that cannot emit this format. `connectStream()` from `@xoong/data`
  does the same wiring without a view.

Conflict policy (editing the same field concurrently) is last-writer-wins by
`version` in 0.x; richer policies are a later ADR.

## 7. Errors

* Error responses declared in OpenAPI are mapped to typed errors.
* `application/problem+json` (RFC 9457) is recommended and rendered by default.
* One global handler (toast, redirect on 401, etc.) plus an optional per-view
  override. Retry and token refresh are configured once, not per call.

## One client, one place for paths and settings

Everything that talks to the API goes through the one client that `configure()` made, and `getClient()` returns it. `baseUrl`, `headers` (a CSRF token, auth), `credentials`, `retry`, `onUnauthorized`, `onError` and `fetch` are set there once; a widget does not carry its own copy and does not call `fetch` itself.

* **Paths live in the OpenAPI document** (and so in `operations.json`). Code names an operation: `getClient().query('listMedia', { limit: 50 })`, `getClient().mutate('uploadMedia', {}, formData)`. A multipart operation takes a `FormData` body as it is.
* **Errors are one type.** Whatever the server returns (`application/problem+json`, `{ errors: [{ pointer, detail }] }`, `{ error: { code, message, fields } }`, `{ detail }`) becomes a `XoongError` with `status`, `code`, `detail` and `fields`.
* **Reads share the cache.** A list read with `<xo-view get>` or `client.query()` refreshes by itself after a mutation whose path overlaps it, and records are shared by entity id.
* **Data the server already has** goes in with `client.seed(operation, params, data)`: the server writes the JSON into the page (a `<script type="application/json">` is not code, so a strict CSP allows it), one module script calls `seed` (params are matched by their text in the URL, so `1` and `"1"` are the same query), and a view that asks for the same operation and params shows it at once and makes no request until it is stale (`staleTime`). The API stays the contract for everything else.

### While the next result loads

A view keeps showing the previous result while the next query of the same view loads (a sort, a page, a filter), so the page does not collapse and jump. `$refreshing` is true then (and the element has `data-refreshing`, which the default CSS uses to dim the table rows); `$loading` is true only when there is nothing to show yet, so a skeleton appears on the first load, not on every sort. An error clears the old rows. A view that changes to another operation starts empty.

## 8. Declarative call syntax (Draft)

```html
<button xo-click="POST /users/{id}/disable">Disable</button>
<form xo-submit="POST /orders" xo-then="/orders/{id}">...</form>
```

Parameters in `{braces}` resolve from the nearest entity or route context.
A body comes from the form or from `xo-body`. Everything is type-checked
against `api.d.ts` by `xoong check`.

Implemented in `@xoong/data/view` (0.0.x prototype): `<xo-view get="/path" p-id="1" live>`,
`{path}` interpolation, `xo-each`, `xo-if`, `xo-click`, `xo-submit`, `xo-body`,
`$loading`, `$error`, `$index`, `$stream`, `xo-param`, and the bubbling events `xo-done` / `xo-error`.
`p-<name>="?q"` takes the param from the page URL (`post.html?id=3` with `p-id="?id"`); an absent query parameter is left out, so the
request cannot be built and the view reports it. Evidence for it: a public "show one item" page was the one task an assistant could not
solve declaratively in the benchmark.
The syntax stays **Draft** until dogfooded on real projects.

## 9. What the data layer will not do

* Guess business meaning. Unusual cache rules must be stated explicitly.
* Fix a poor OpenAPI document silently; `xoong doctor` reports problems.
* Offer a second way to call APIs. There is no manual `fetch` helper in the
  public surface.

## 10. Unions and expandable fields

Normalization understands `oneOf`/`anyOf` when it can choose a member safely:
an id-or-object field is treated as the object (an id string stays as received);
members with a fixed tag property (or an OpenAPI `discriminator`) are stored under their own
entity type; `X | deleted_X` pairs use the flagged member for `deleted: true` and `X` otherwise.
When nothing tells the members apart, the value is kept inline and `xoong doctor` reports `XO160`.
See [test-corpus.md](test-corpus.md#unions-resolved-where-the-document-allows).

## 11. Known limitations (0.0.x prototype)

* **Replace or merge.** When a response uses the entity's own schema, the stored record is replaced, so a
  field the server stops sending (an optional property omitted when null) disappears. When several schemas share
  one entity through a hint (`"entity": "User"` on a summary schema), or a schema carries `x-xoong-partial`, the
  record is merged field by field, because projections carry fewer fields. Stream `upsert` events always merge.
* **Entity eviction.** When an unobserved query is collected (`gcTime`), entities that no remaining
  cached query reaches (following nested references) are dropped; screens still reading them see them as
  deleted. Entities that arrived only through a mutation response or a stream event are evicted the same way the next time any query is collected, so a screen should show data through a query (a created record is normally followed by a list refetch). Turn it off with
  `configure({ evictEntities: false })`.
* **Request cancellation.** When the last view observing a query goes away or changes params while the
  request runs, the request is aborted (an `AbortSignal`) and is not an error; the query returns to
  "not loaded". A `load()` waiting for the same query keeps it alive. Mutations are never cancelled.
* **Stream versions** are compared per entity and are in-memory. They are forgotten on every `resync` event and
  on every reconnect, so a restarted server can start counting from 1 again.

## Optimistic updates

`xo-optimistic="status=disabled"` on an `xo-click` button inside `xo-each` over entities shows those field values on the item at
once and undoes them if the call fails (`{path}` works in values; several fields: `a=1,b={name}`). When the call succeeds the
server's response replaces the provisional values as usual. The undo only restores fields that still hold the provisional value,
so a newer change from the server or another screen is never erased. From JavaScript:
`client.mutate(op, params, body, { optimistic: [{ $ref: 'User#1', patch: { status: 'disabled' } }] })`. Entities that are not loaded
are ignored. Not covered: optimistic *creation* of new list rows.

## 12. Backend shapes handled by hints and detection

Identity and unions, in addition to the table below:

* **Composite identity** (Kubernetes: `namespace` + `name`): hint `"schemas": { "Pod": { "id": ["namespace", "name"] } }`.
  The id is the parts percent-encoded and joined with `/` (so `["a/b","c"]` and `["a","b/c"]` stay different); stream events address it the same way (`"id": "a/web"`, or `"a%2Fb/c"`). A record missing a part
  stays inline instead of being stored.
* **Unions without a tag** (GitHub: an issue and a pull request in one list): when every member has a *required*
  property that no other member declares, the member is recognised by that property being present. If any member cannot
  be recognised the union stays unresolved and `xoong doctor` reports XO160 as before.


Real backends are rarely tidy. These are handled without touching the backend's OpenAPI document:

| Shape | How |
|---|---|
| `{ code, message, data }` envelope on every response | hint `"unwrap": "data"`: operations whose success schema has that property are read as `data`; types and the entity store see the inner schema. Errors are not unwrapped. |
| A request id the server wants fresh per attempt (`client_message_id`) | hint `"idempotencyKeys": { "sendMessage": "client_message_id" }`: `mutate()` and `stream()` fill the field with `crypto.randomUUID()` when the caller did not. `xoong sync` reports XO170 if the field does not exist. |
| `multipart/form-data` request body | detected: `operations.json` gets `multipart: true`, `xo-submit` sends the form as `FormData` (files included), `<xo-form>` renders `type: string, format: binary` as a file input. |
| Response `text/event-stream` (a chat reply over POST) | detected: `stream: true`. `xo-submit`/`xo-click` on it fill `$stream` (a list; each item is the event's JSON payload plus `event`, or `{ event, data }` for plain text) while `$streaming` is true. The list is replaced by each new call. When the stream ends, cached queries are refetched. From JavaScript, use `client.stream()`. |

```html
<xo-view>
  <p xo-each="$stream"><b>{event}</b> {text}</p>
  <form xo-submit="POST /sessions/{sid}/chat" p-sid="7"><input name="text"><button>Send</button></form>
</xo-view>
```

A stream is cancelled when the view is removed or the next call starts. `$stream` is copied per event, which is fine for hundreds of events, not for token-by-token output of thousands.

Not covered: accumulating token deltas into one string (do it with `client.stream()` or a `derived`), upload progress.

## 13. Security notes

* Text interpolation is always safe (`textContent`).
* Attribute interpolation refuses `on*` and `srcdoc`, and rewrites `javascript:`,
  `data:` and `vbscript:` URLs in URL attributes (`href`, `src`, `action`, ...)
  to `about:blank`.
