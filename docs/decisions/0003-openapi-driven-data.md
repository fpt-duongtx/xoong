# ADR-0003: OpenAPI-driven data layer

Status: Accepted (design phase)

## Context
Projects re-create HTTP clients, response types, cache keys and error handling
screen by screen. Multiple screens need the same data arranged differently and
usually trigger extra requests or extra backend endpoints. Live updates are
implemented ad hoc.

## Decision
The data layer is derived from an OpenAPI document: typed client, cache key
from `operationId` + params, invalidation from REST structure, a normalized
entity store, `derived` views over the store, and an opt-in streaming protocol.
There is no second public way to make HTTP calls.

## Consequences
+ Screens declare *which* operation, never *how* to call it.
+ One fetch can serve many screens; changes propagate everywhere.
- Quality of the OpenAPI document becomes a prerequisite. `xoong doctor`
  reports gaps and gives fixes.
- Entity identity must be resolvable (`x-xoong-id`, or `id`).
- Streaming requires a small agreement with the backend (or the gateway).
