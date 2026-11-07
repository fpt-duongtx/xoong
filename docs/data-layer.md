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
| `operations.json` | Runtime table: operationId, method, path template, schemas, invalidation hints |

You never write an HTTP client, a base URL constant or a response type.

## 2. Operation identity and cache keys

* An **operation** is identified by its `operationId` (or `METHOD path` if
  absent; `xoong doctor` recommends adding ids).
* **Cache key** = `operationId` + canonicalized parameters (sorted keys,
  normalized values). Developers never declare keys.
* GET results use stale-while-revalidate. Defaults can be overridden per
  operation in `xoong.config` or per view with `stale="30s"`.

## 3. Mutations and invalidation

Rules are derived from REST structure and can be overridden:

| Mutation | Default invalidation |
|---|---|
| `POST /users` | `GET /users*` |
| `PUT/PATCH /users/{id}` | `GET /users/{id}`, `GET /users*` |
| `DELETE /users/{id}` | `GET /users/{id}`, `GET /users*`, entity `User#id` removed |
| Any, if the response returns an entity | That entity is upserted into the store |

Override (rare, explicit):

```json
{ "invalidate": { "POST /orders/{id}/ship": ["GET /orders*", "GET /dashboard"] } }
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

Transport: Server-Sent Events by default; WebSocket supported. Event format
(JSON, one per message):

```json
{ "type": "patch",  "entity": "User", "id": "42", "path": "/email", "value": "a@b.c", "version": 17 }
{ "type": "upsert", "entity": "User", "id": "42", "value": { "...": "..." }, "version": 18 }
{ "type": "delete", "entity": "User", "id": "42", "version": 19 }
```

Rules:

* `version` is monotonic per entity. A patch with a lower version than the
  stored one is dropped.
* On reconnect the client sends the last seen event id (`Last-Event-ID`) and,
  if the server cannot replay, refetches the visible operations.
* `path` is a JSON Pointer. Only the addressed field changes; other fields and
  other screens are untouched.
* Advertise streams in OpenAPI with `x-xoong-stream` on an operation or at the
  document root. The [stream gateway](server.md#stream-gateway) can translate a
  backend that cannot emit this format.

Conflict policy (editing the same field concurrently) is last-writer-wins by
`version` in 0.x; richer policies are a later ADR.

## 7. Errors

* Error responses declared in OpenAPI are mapped to typed errors.
* `application/problem+json` (RFC 9457) is recommended and rendered by default.
* One global handler (toast, redirect on 401, etc.) plus an optional per-view
  override. Retry and token refresh are configured once, not per call.

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
`$loading`, `$error`, `$index`, and the bubbling events `xo-done` / `xo-error`.
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

## 12. Backend shapes handled by hints and detection

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
