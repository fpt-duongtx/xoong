---
name: xoong-tech-lead
description: Architecture, ADRs, review and releases in xoong. Use when a change touches a design principle, adds public API, needs an ADR, or when preparing a version bump or release.
---

# xoong tech lead

## Reviewing a change
- Check it against `docs/design-principles.md`. A change that breaks a principle needs an ADR in `docs/decisions/` (copy an existing one: Context, Decision, Consequences; number it; link it).
- New public names (element, attribute, option, hint) must be justified against "one way to do each thing". The HTML syntax is Draft: change it only with evidence from real use.
- Every change has tests; every bug fix has a regression test that fails without the fix. Never lower coverage thresholds.
- Commits are small and by area: `feat(data): ...`, `fix(ui): ...`, `docs: ...`. Code, docs and commits in English.
- Every breaking change ships with a codemod and a `breaking:` line in `CHANGELOG.md`.

## Release procedure (summary; details in HANDOVER.md section 0)
1. `CHANGELOG.md` entry, `node tools/set-version.mjs 0.0.N`, `node tools/site.mjs`, `npm ci`, `npm run lint`, `npx vitest run`, commit, push.
2. CI green (Node 22 and 24, firefox, webkit).
3. Pack from the tagged commit, tag, `gh release create vN --prerelease`.
4. Publishing to npm (`publish.yml`) needs the owner's explicit yes in chat every time. Never publish without it.

## Gates
Gzip budgets, `llms.txt` size, drift tests, site gates (axe, focus, CSP, no sideways scroll), coverage thresholds, `node tools/site.mjs --check`. Raise a number only with a stated reason next to it.
