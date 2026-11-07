# ADR-0002: Light DOM only

Status: Accepted (design phase)

## Context
Shadow DOM and framework-scoped CSS prevent accidental style collisions, but
they also isolate design systems from the organization that owns them: global
tokens, themes, utility CSS, test selectors and analytics become harder to
apply. Strategy-led teams pay for protection meant for inexperienced ones.

## Decision
xoong renders into the regular DOM. Style safety comes from `@layer`, `@scope`,
tag-name namespacing, and `xoong check` lint rules instead of encapsulation.
There is no `slot`; projected content uses a simple documented convention.

## Consequences
+ Global CSS, tokens and tests work unchanged.
+ SSR is plain HTML (no Declarative Shadow DOM).
+ Accessibility and form participation behave like normal DOM.
- Collisions are possible; tooling must catch them.
- Re-rendering must not overwrite user-provided child content, which is why
  updates are fine-grained rather than whole-tree.
