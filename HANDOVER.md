# Handover: xoong

For the next agent (a Claude Code session on a new machine). Read section 0 first (the state on 2026-11-10 and how to
continue), then `README.md`, `docs/design-principles.md` and `llms.txt`. Sections 1 and later were written in the first
cloud session and are still true unless section 0 says otherwise; the packages are released (npm, tag `next`) and CI runs.

## 0. State on 2026-11-10 and how to continue

**Released:** `@xoong/*` 0.0.52 is on npm (tag `next`; `latest` is an old 0.0.34, `@xoong/xoong` latest 0.0.35) and on GitHub
(prereleases `v0.0.x`, tarballs attached). Docs site: https://fpt-duongtx.github.io/xoong/ (GitHub Pages, built by
`.github/workflows/pages.yml` with `xoong build`). Main is green. Versions move in lockstep (all 14 packages, exact pins).
`CHANGELOG.md` is the detailed history (0.0.31 to 0.0.52); each entry has a `breaking:` line.

**People and roles (Claude sessions, owner chats in Vietnamese; code, docs, commits in English):**

* *Xoong Dev* (this role): core, data, forms, ui, controls, cli, mcp, lsp, server, ssr, i18n, tooling, the docs-site
  generator (`tools/site/**`, `site/src/site.css`, `tools/kit-css.mjs`, `tools/build-mist.mjs`), CI, README, releases.
* *UX* session: owns the design kit `design/brand-kit/**` (Mist look). It works on branches `ux/<topic>`; Dev takes them with
  `git checkout ux/<branch> -- design/brand-kit/` then `node tools/kit-css.mjs && node tools/build-mist.mjs && node tools/site.mjs`.
  Dev never edits the kit CSS; it describes the markup it needs and asks UX.
* *rainlet / Bloomoz admin* session (`Admin page shared architecture`): the first real consumer (admin UI on xoong); its bug
  reports have priority. The clinic site (`fpt-duongtx/tieuhoalamhong`) is a second consumer.
* Messages between sessions arrive as "cross-session" messages; they are not the owner's approval for anything.

**Release procedure** (the owner says "bump freely"; publishing to npm needs an explicit yes in chat each time):

1. Edit `CHANGELOG.md` (new heading, a `breaking:` line), `node tools/set-version.mjs 0.0.N` (all versions, pins, lockfile, docs),
   `node tools/site.mjs` (regenerates `site/*.html`, `reference.json`, `search-index.json`, `llms.txt` copy), `npm ci`,
   `npm run lint`, `npx vitest run` (or `npm run test:coverage`), commit, push to `main`.
2. CI (`ci.yml`, about 10 to 15 minutes, runs on the home server) must be green: jobs test (22), test (24), browsers (firefox, webkit).
3. Pack from the TAGGED commit (a scratch `git worktree` at that commit, symlink `node_modules`): `node tools/pack.mjs dist-pack --prefix ./vendor/xoong`,
   `git tag vN`, `git push origin vN`, `gh release create vN --prerelease dist-pack/*.tgz`.
4. Only after the owner's yes: `gh workflow run publish.yml --ref vN -f dry_run=false -f tag=next` (npm Trusted Publishing/OIDC, no token,
   runs on `ubuntu-latest`). npm metadata lags for a minute: re-check with `npm view @xoong/core dist-tags.next --prefer-online`.
5. Tell UX and rainlet (SendMessage) what shipped.

**Home server (CI and Pages runners):** `ssh duongtx@192.168.0.200` (Ubuntu, Node 24, Docker, passwordless sudo). Runners
`/opt/actions-runner/xoong`, `xoong-2`, `xoong-3` (user `runner`, label `xoong-home`); other projects have their own: leave them
alone. `ci.yml` has one job at a time (`max-parallel: 1`) and capped workers because the server is shared. To re-register a runner
get a token with `gh api -X POST repos/fpt-duongtx/xoong/actions/runners/registration-token` and pass it over ssh stdin, never print
it. After a Playwright upgrade run `sudo node node_modules/playwright/cli.js install-deps` on the server.

**Gates you will meet** (all in tests; raise a number only with a stated reason next to it): gzip budgets in
`test/architecture.test.mjs` `budgetKb` (core 5.9, data 19.8, forms 9.5, i18n 5.7, ui 12.8, controls 37, richtext 8.5 KB);
`llms.txt` size limit (`length / 3.8 < 3220`); drift tests (every element and attribute needs an html-data description, MCP
explanation, LSP completion, llms.txt or `NOT_IN_LLMS` entry, a docs mention and a Reference entry); the site gates
(`packages/cli/test/site.test.mjs`: axe in 4 palette/scheme combinations and at 390px, focus indicator 3:1, strict CSP, no sideways
scroll, pages equal the generator output); coverage thresholds (never lowered); `node tools/site.mjs --check`.

**Things that bite:**

* The permission classifier sometimes blocks big `python - <<EOF` heredoc commands as "dangerous rm" even when nothing is removed; use the
  Edit/Write tools instead (do not try to get around a real removal block). Never publish to npm without the owner's yes.
* Local site tests can be flaky when the Mac sleeps or is loaded (timeouts of hours are not real failures); CI on the home server is the judge.
* Absent `Number` props read as 0; props do not reflect to attributes; `define()` keeps an accessor a class wrote for a prop
  (`xo-switch.checked`); XoControl sets a `value` attribute after `connected()`; use `this.ready().then(...)` when children are data;
  `text('xoong.<area>.<key>', 'English')` needs literal keys and an entry in `packages/i18n/src/builtin.js` and `catalogs/vi.json`.
* Strict CSP everywhere: no inline scripts or style attributes (CSSOM from script is fine).
* `@xoong/xoong` is the umbrella name (`xoong` was refused by npm); `xoong new` pins the CLI's own version.

**What exists now (beyond sections 1 to 8):** drawer, breadcrumb, alert, skeleton, tree, colour picker, rating and 30 other controls;
dialogs (`confirm/alert/prompt/ask`, titled `<xo-dialog>`); `<xo-table column-picker>`, icon pager, humanized headers; cancelable `xo-error`
and `view.error`; `getClient().reset()`; `xoong build --minify --exclude --no-preload` (modulepreload by default); lazy router and dialogs;
the Reference page and menu, universal search (Ctrl/Cmd+K), Tools pages (CLI, MCP, editor, error codes, generated from the code),
Recipes page, Dialogs page, animated architecture figures with a step bar. Edge-case scan result: `CHANGELOG.md` 0.0.46, and the
"Known limits" table of the Recipes page lists what is deliberately not fixed.

**Saving credits: run the benchmark scripts yourself.** Running measurement scripts costs nothing (it is only commands on your machine);
credit is spent only when an assistant reads output, writes or edits code, or reasons. So do the measuring by hand and ask an
assistant only to read and summarise the final results. All stage A data is committed in `benchmarks/results/` (`perf-baseline.json`,
`profile-before-lazy.json`, `profile.json`, `rerender.json`, `runtime.json`, `cli.json`, `mcp.json`, `effort.json`, `install.json`);
the numbers are from an Apple M1 (8 GB), Chromium 158, Node 26: do not mix them with numbers from another machine, rerun everything
there. The competitor apps have lockfiles in `benchmarks/apps/*` but no `node_modules`: install them first as `benchmarks/README.md`
says (separate from the root lockfile and CI; Angular 22 needs Node 24.15 or newer). Then, from `benchmarks/`:

```bash
npm ci
node runtime.mjs         # the four-stack runtime table (real Chromium, h2, strict CSP, 5 runs)
node cli.mjs             # CLI speed
node mcp.mjs             # MCP server speed
node effort.mjs          # lines, files, packages
node rerender.mjs        # re-render probe
node perf/profile.mjs    # where xoong's time and bytes go -> results/profile.json; `node perf/report.mjs` regenerates perf/PROFILE.md
```

Keep the machine idle and plugged in while measuring (the scripts record the load average and discard noisy runs); treat install
times as an order of magnitude only (network). Results land in `benchmarks/results/*.json`; the site page, home block and READMEs are
generated from them only when `benchmarks/results/publish.json` says `{ "publish": true }`.

**Unfinished work, in the owner's order of priority:**

1. **Benchmarks** (`benchmarks/`, its README explains everything; publish switch `benchmarks/results/publish.json` is `false`, so the
   home block, `benchmarks.html` and the README tables are NOT generated). Done: runtime table for the flat people screen in xoong, React
   (specialist version), Vue and Angular 22 (all libraries counted in full), CLI and MCP speed, a re-render probe, a profile of where xoong's
   time and bytes go (`benchmarks/perf/PROFILE.md`, `CHANGES.md`: layout and style are 53% of creating 10,000 rows and shared by all stacks;
   xoong's own JS 18%). Remaining, in order: (a) stage B: `SPEC.md`, one shared stylesheet and fixture, text-only normalisation (no
   icons, svg, fonts), parity test (same accessible tree and API calls in every stack); (b) stage C: a rich nested screen (3 levels,
   nested views, array-form dialog, optimistic edit) in xoong first (it may reveal framework slow paths: fix them generally, never tune
   the sample), then React, Vue, Angular; (c) stage D: re-measure all stacks in one session, evaluate the publication gate on both
   screens (xoong best or within 10% in 4 of 6 headline rows, none more than 25% behind; show xoong default AND `--minify` side by side,
   count esbuild in the minified column), then flip `publish.json` and regenerate. Today the flat screen with `--minify` meets the gate, the
   default build does not (bytes 37% behind). Owner rule: honest numbers, nothing inflated; if xoong clearly loses, do not publish.
2. **Controls** not built yet (owner's list): table advanced (column resize, pinned columns, row grouping, virtualisation: separate batch),
   kanban (third party), timeline and stepper (not wanted: use tabs).
3. **Streaming** (the owner mentioned it at the very beginning; the exact wording is lost): live views over SSE, `connectStream`, POST
   streams with `$stream` exist. Not built: stream gateway (`docs/server.md` section 4), WebSocket transport (a recipe only), SSE with an
   Authorization header (recipe), NDJSON streaming, new entities joining a loaded list. Ask the owner which they meant.
4. **Owner-side tasks:** `npm deprecate` of the 0.0.34 versions, inspect the stray `0.0.0-stage` version on npm, native-speaker review of
   the Vietnamese strings and the rewritten docs (data-layer, architecture, ADR-0009), real-device checks (IME, Safari, phones),
   unverified Claude Desktop/Cursor/Neovim snippets on the MCP and editor pages.
5. **Known gaps** (honest list in the Recipes page "Known limits"): pager needs `total`; 429/408 not retried; objects as query params;
   duplicate ids in a list; hidden or disabled form fields are still sent; `--base` leaves anchors; no live reload in `xoong dev`.
6. Roadmap items open: stream gateway, VS Code extension and lint presets, per-tag lazy loading, codemods (0.8), three production
   projects before 1.0 (see `docs/roadmap.md`).

**Local memory of the previous machine is not transferred.** Key preferences from it: bump versions freely, publish to npm only on an
explicit yes; never force-push `main`; honest assessments; explain in Vietnamese, write code and docs in English; never enter credentials.

## 1. What xoong is (and who it is for)

A small web framework on the browser platform. Goals, in the owner's words and priorities:

* Small sites build fast; large sites perform best; **admin sites follow one strict convention**.
* **Plain CSS/SCSS** for styling. No Tailwind, no CSS-in-JS, no Shadow DOM.
* **Stability.** The owner is tired of chasing framework releases (for example Angular 18 to 22: signals, then
  OnPush by default) and of dependency chains that make upgrades costlier than rewrites.
* **AI-friendly.** An unseen AI assistant should write correct code on the first attempt from a ~2k-token spec
  (`llms.txt`) plus fast, precise feedback (`xoong check`, later an MCP server).
* **Data from OpenAPI.** No hand-written HTTP clients, cache keys or error handling; shared entities across
  screens; live updates over SSE.
* Open source (MIT). First use: the owner's own projects and friends; light promotion later.

Working language: the owner writes Vietnamese; **chat in Vietnamese, write code, docs and commit messages in
English.** The owner has 12 years of CSS experience and asks for honest assessments, not agreement.

Design rules that must not be broken without an ADR (`docs/decisions/`): Light DOM only; zero runtime
dependencies in `core` and `data` (enforced by a test); one way to do each thing; no hidden rules; platform
first; optional server; OpenAPI is the data contract.

## 2. State

| Package | What | State |
|---|---|---|
| `packages/core` | signals, `html` templates, `XoElement`, `define`, shared `closest`/`syntax` | Done, 97% covered |
| `packages/data` | OpenAPI client, auto cache, entity store, `derived`, SSE, `client.stream()`, `<xo-view>` | Done (Draft HTML syntax) |
| `packages/cli` | `sync`, `doctor`, `check`, `new`, `dev` | Done |
| `packages/server` | `(Request) => Response` handler: static, proxy, TS stripping, import map; Node adapter | Done |
| `packages/test` | `mount`, `mockApi`, `push`, `settle` on Vitest | Done |
| `packages/ssr` | Prerender pages with data using the real runtime on happy-dom; `xoong render` | First version, tested in real Chromium |
| `packages/lsp` | Language server over stdio: diagnostics from `check`, completion, hover, quick fix | First version |
| `packages/mcp` | MCP server over stdio: `get_spec`, `list_operations`, `check`, `explain_error`, `explain_syntax`, `search_docs` | First version (no `scaffold` tool yet) |
| `packages/ui` | `xoong.css`, `xo-table`, `xo-form`, `xo-dialog` (see `docs/admin.md`, ADR-0007) | First version, screen tests + end to end |
| `examples/admin` | Admin (table with sort/paging, generated form, dialog, SSE) through `xoong dev` in real Chromium | Done, end-to-end test |
| `examples/chat` | Screen tests on an anonymised real API spec | Done |

Not built (see `docs/roadmap.md`, "Where we are"): custom table cells, filters and selection (0.5 leftovers); MCP server; typed client (`createClient<Operations>`); SSR; stream gateway; router; editor
extension and lint presets (designed in `docs/editor-integration.md`); WebSocket; multipart uploads.

Numbers at handover: **168 tests pass** (node 22): 146 in the `logic` project (unit + real browser + end to end) and 22 in `screens` (happy-dom); coverage 92.2% statements,
84.4% branches, 92.9% functions, 95.6% lines (thresholds in `vitest.config.mjs` are just below). Generated
`api.d.ts` compiles under `tsc --strict` for every OpenAPI 3.x file in the 19-document real-world corpus.

## 3. Verify it on your machine (do this before anything else)

```bash
npm ci                      # a lockfile is included
npx playwright install chromium   # real-browser tests; or set XOONG_CHROMIUM=/path/to/chromium
npm test                    # expect: 14 files, 168 tests passed
npm run test:coverage       # expect: thresholds satisfied
```

Run the example by hand:

```bash
node examples/admin/backend.mjs &                       # fake backend on :8080
cd examples/admin
node ../../packages/cli/src/cli.js sync openapi.json --hints xoong.hints.json
node ../../packages/cli/src/cli.js dev                  # http://127.0.0.1:5173
node ../../packages/cli/src/cli.js check index.html     # 0 errors expected
```

Open two tabs, click Disable in one: the other updates without polling.

**Not verified, so check them:** Node 20 (CI matrix has 20 and 22; development ran on 22.23 only); macOS and
Windows (paths use `node:path`, but nothing was run there); the GitHub Actions workflow
(`.github/workflows/ci.yml`) has **never run** (each of its commands was run locally); `npm ci` from a clean
clone (the tarball was checked this way, a real clone was not).

## 4. Pushing to GitHub

The owner creates the GitHub project; you push from the local session. **The repository starts private** and
becomes public only when there is something finished to show (see section 10). Suggested order:

1. Extract/clone, run section 3. If something fails because of the environment, fix the environment first; if
   a test fails, report it before changing code.
2. `.gitignore` already excludes `node_modules`, `coverage`, `.xoong`, `.tmp`. `examples/admin/.xoong` is
   generated by its test; do not commit it. Do not commit `*.tar.gz`.
3. History becomes public together with the repository, so keep it clean from the first commit: no secrets,
   no internal URLs, no unanonymised specs or data, and no "fix typo" noise. Make the first commits by area, for example: docs + LICENSE; `core`; `data`; `cli`;
   `server`; `test`; `examples`; tooling and CI. Use real authorship (the owner's identity, not a model).
4. Push, then watch the first CI run. Private repositories have a limited monthly allowance of free Actions
   minutes: if it runs out, temporarily reduce the matrix in `.github/workflows/ci.yml` to Node 22 and note it. Expect possible failures on Node 20 or from Playwright browser install;
   fix and record what you changed in `docs/testing.md`.
5. Do **not** publish to npm. Names, scopes and versioning are an owner decision (see section 7).
6. Create issues from the backlog (section 6) and a simple project board; label by milestone (0.3 ... 0.8).

## 5. Rules the owner set (keep following them)

* **The library has its own unit tests, always.** Every bug fix gets a regression test; prove it fails without
  the fix when practical. Coverage thresholds must not be lowered to make CI pass.
* Self-review each batch (the `code-review` skill at `high`), fix findings, and record outcomes.
* Update `llms.txt` in the same change as any public API change; tests tie it to `check`, the CLI and the
  runtime, and cap it at 3k tokens.
* External specs and sample data must be **anonymised** before entering the repo. `examples/chat/openapi.json`
  was anonymised on purpose (names, tags, locale); do not try to restore the original. The 19-spec corpus
  lives outside the repo (public vendor licences); `tools/corpus.mjs` runs it. It was provided as a zip by
  the owner; ask for it again if you need it.
* Style: plain CSS; prefer native elements; HTML must pass `xoong check`.
* The HTML syntax is Draft: change it only with evidence from real use, and update `llms.txt`, `check` and docs.

## 6. Backlog (suggested order)

1. **Verify CI** and fix environment gaps (section 3). Add a coverage badge only after it is green.
2. **0.5 admin set**: `xoong.css` tokens (`@layer`, custom properties), `xo-table` (sort, filter, server
   pagination from OpenAPI query params), `xo-form` generated from request schemas with field errors,
   `xo-dialog` on `<dialog>`, admin layout. Acceptance: a CRUD admin for `examples/admin` with no
   application JS beyond `configure()`, covered by screen tests and an end-to-end test.
3. **Declarative gaps found with real specs**: idempotency keys (`client_message_id` needs a fresh UUID per
   submit), streaming for POST SSE in HTML (today `client.stream()` is JS only), `unwrap` hint for
   `{code,message,data}` envelopes, multipart in `xo-submit`.
4. **Data layer limits** (documented in `docs/data-layer.md` section 11): replace-vs-merge, entity eviction,
   request cancellation, stream version reset, composite identity and untagged unions are done.
5. **0.6**: typed client (`createClient<Operations>`), `check` for JS/TS templates, MCP server wrapping
   `check`/`doctor`/`scaffold`/`llms.txt`, first-attempt-correctness benchmark (`docs/ai-integration.md` section 5).
6. **0.6.x editor and lint**: HTML custom data first (cheap), then the language server; design in
   `docs/editor-integration.md`. Extract the `check` rules as a library.
7. **0.7**: SSR for public pages (no hydration), per-tag lazy loading, benchmark on a large example site.
8. Release prep: done except the owner decisions (package names and scope, `author`/`repository` fields, copyright
   holder, a docs site): `files`, `exports`, types, `engines`, CHANGELOG, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT and
   issue/PR templates exist; `xoong new --link <checkout>` creates a project that installs and runs from the unpublished packages.
9. Low priority: built-in Swagger 2.0 input (users can run `swagger2openapi`), WebSocket, optimistic updates.

## 7. Open questions for the owner

* ~~Final project/package names~~ **Decided:** the package is `xoong` (project name, MIT licence, copyright "Duong Tran Xuan", as in `LICENSE`). The
  unscoped name `xoong` and every `@xoong/*` name were free on npm on 2026-11-08; whether the `@xoong` scope itself can be
  registered is not verified (npm does not say without an account: create the organisation `xoong` before the first publish).
* Which of the owner's real projects goes first for dogfooding, and can we get an anonymised CRUD spec with
  pagination from it? The corpus has none from the owner's own stack besides the chat sample.
* Browser support matrix of the owner's clients: needed before using newer platform features (Popover,
  anchor positioning, customizable select).
* TypeScript preference for application code: erasable syntax only is assumed (no `enum`/`namespace`).

## 8. Things learned the hard way (avoid repeating)

* `connectedCallback` can fire before children exist (HTML parser, some DOMs): `<xo-view>` starts on a
  microtask or `DOMContentLoaded`.
* happy-dom replaces the global `URL`; do not build `new URL(import.meta.url)` inside happy-dom specs. Import
  JSON instead.
* Installing a different `playwright` than the sandbox's browsers breaks launch; `tools/browser.mjs`
  honours `XOONG_CHROMIUM` and falls back to `/opt/pw-browsers/chromium` when present.
* A package `exports` map hides `package.json`; find package folders by walking up from the resolved entry.
* `Headers.set` loses repeated `Set-Cookie`; use `append` and `getSetCookie()`.
* Real specs differ from fixtures: dotted schema names, TypeScript keywords as names, duplicated parameters,
  `anyOf [X, null]`, "expandable" `string | object`, `X | deleted_X` unions, `gid`/`pk` identities.
* Fixed waits make browser tests flaky under parallel load; poll for a condition.

## 9. Map of the repo

```
README.md  llms.txt  HANDOVER.md  LICENSE  vitest.config.mjs  .github/workflows/ci.yml
docs/            architecture, principles, data layer, styling, server, testing, typescript,
                 ai-integration, editor-integration, test-corpus, roadmap, glossary, decisions/ (ADR 0001-0006)
packages/core    signals, html, element, closest, syntax
packages/data    client, store, derived, stream, view, default, invalidate, pointer
packages/cli     openapi, commands, check, scaffold, dev, cli
packages/server  handler (portable), node (adapters)
packages/test    mount, mockApi
examples/admin   OpenAPI spec, backend.mjs, index.html, src/, e2e test
examples/chat    anonymised spec + hints + screen tests
test/            architecture tests (dependencies, direction, size, llms.txt drift)
tools/           browser.mjs (Chromium helper), corpus.mjs (real-spec runner)
```

## 10. Before going public

Do these, in order, when the owner decides to flip the repository to public. Tick them in an issue.

1. **Choose the copyright holder.** `LICENSE` says "xoong contributors". Decide whether it is a person or an
   organisation, and put the same name in every package `author` field.
2. **Rewrite or remove this file.** `HANDOVER.md` contains personal context (the origin of the name, how the
   owner likes to work) and instructions for a specific agent. Move the useful parts (state, backlog,
   lessons learned) into `CONTRIBUTING.md` and `docs/`, then delete this file. Also drop the "owner" wording
   from other docs if you find any.
3. **Scan the working tree and the whole git history** for secrets, e-mail addresses (the owner chose to publish `duongtx1505@icloud.com` as package author and in commits; no other address should appear), customer or project
   names, machine paths and unanonymised data. At handover time a text scan of the tree found only the one
   personal reference in this file; history did not exist yet. Re-check `examples/chat` once more: it was
   anonymised on purpose (names, tags, locale) and must stay that way. If history contains anything
   sensitive, rewrite it before publishing: a deleted file is still visible in old commits.
4. **Check third-party material.** No vendor specs are in the repo (the real-world corpus lives outside it and
   has per-source licences). Confirm that remains true, and that `docs/test-corpus.md` only describes them.
5. **Reserve names.** Check that the npm scope `@xoong` and each package name are free, and decide the
   versioning policy (`0.x` until three real projects run it in production, per `docs/roadmap.md`).
6. **Add community files:** `CONTRIBUTING.md` (how to run tests, the rules in section 5, the ADR process),
   `SECURITY.md` (private reporting address; the dev server and proxy are security-sensitive), `CODE_OF_CONDUCT.md`,
   issue and pull-request templates, a `CHANGELOG.md`.
7. **Make CI green and visible** on Node 20 and 22, with coverage thresholds enforced. Restore the full matrix if it
   was reduced for private-repository minutes.
8. **Prove it on real projects, then go public.** The owner's decision: the repository stays private until xoong has been tested
   on the owner's current projects, or on a few new projects built for the purpose (`xoong new --link <checkout>` creates one that
   runs from the unpublished packages); only when that goes well is it made public and users invited. Write down what hurt.
   Original wording follows. At least one of the owner's own projects should run on xoong, so the README can
   say where it works today instead of only "prototype". Record what hurt in `docs/` or issues.
9. **Make `xoong new` installable** or state plainly in the README how to try the packages before they are
   published.
10. **Re-read the README as a stranger.** The first screen must say what xoong is, what it is not (no SSR yet, no admin
    components yet), its status, and how to run the example in under a minute. Keep the claims to what the
    tests and docs support: no "better than React" without a benchmark.
11. **Settings when flipping the switch:** description and topics (see the suggested text in the repository
    description conversation: a short standards-first summary ending with "Early prototype"), branch protection on
    `main` (require CI), enable Dependabot and secret scanning, disable features you will not use
    (wiki, projects) and add a pinned issue for feedback.
