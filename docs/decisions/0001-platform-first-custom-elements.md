# ADR-0001: Platform first, built on custom elements

Status: Accepted (design phase)

## Context
Mainstream frameworks introduce their own component and reactivity concepts and
change them across major versions, forcing developers and AI tools to relearn
and migrate. Browsers already provide a stable component primitive: custom
elements.

## Decision
xoong components are autonomous custom elements (`<xo-...>`). No virtual DOM,
no JSX, no hooks, no required compiler. Reactivity uses small signals aligned
with the direction of the TC39 Signals proposal. Customized built-ins (`is=`)
are not used because Safari does not support them.

## Consequences
+ AI assistants already know the underlying APIs.
+ Components work in plain HTML and survive framework fashion.
+ Slower aging: the framework changes as slowly as the platform.
- No third-party ecosystem to lean on; the built-in set must cover admin needs.
- Some platform gaps (e.g. SSR of custom elements) need xoong-specific answers.
