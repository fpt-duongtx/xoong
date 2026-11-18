# When not to use xoong

xoong is a small framework for one kind of work: screens that read and write a backend described by an OpenAPI document (admin areas, back offices, internal tools,
content screens), written as HTML, plain CSS and a little JavaScript. It is good at that. It is not for everything, and it is young (0.0.x, one maintainer, a Draft HTML
syntax). This page says where it fits badly, so you can decide before you start.

## A good fit

* Your backend already has, or can easily have, an OpenAPI document, and most screens are lists, forms and detail pages over it.
* You want few moving parts: no bundler required, no virtual DOM, no state library to choose, a strict CSP from day one.
* You want screens that people and AI assistants can write the same way every time, and a checker (`xoong check`) that says what is wrong with the message that has the fix.
* You are fine with the latest two versions of Chrome, Edge, Firefox and Safari ([browser-support.md](browser-support.md)).

## A poor fit

| If you need | Why xoong does not help (yet) |
|---|---|
| A product UI that is mostly custom interaction (a canvas editor, a design tool, a game, a dense dashboard with its own widgets) | The model is data in, screen out. Heavy client-side state and bespoke components are written in plain JavaScript and custom elements; there is no framework help there, and the rest of the ecosystem (state libraries, component kits) is built for other frameworks. |
| A backend with no OpenAPI document and no wish to write one | The data layer, the typed client, `xoong check` and the forms all start from the document. Without it you keep little more than signals, templates and the controls. |
| A large existing React, Vue or Angular codebase | xoong does not embed in those frameworks, and there is no migration path other than screen by screen behind a router. |
| A mature third-party component ecosystem (charts, grids, rich data viz, design systems) | The built-in set is deliberately small ([design-principles.md](design-principles.md): no component marketplace). You build or wrap what is missing. |
| Public, SEO-critical pages with personalised content | Prerendering (`@xoong/ssr`) is for public pages with data fetched at build time; there is no hydration and no server-rendered, per-visitor page. |
| Real-time features at scale | Server-sent events work; the stream gateway, WebSockets and optimistic updates are not built yet ([roadmap.md](roadmap.md)). |
| Older browsers | Not supported and not tested. |
| A long-lived project that cannot follow a changing API | The syntax is Draft and any 0.0.x release can break it. The packages most likely to move are marked in [stability.md](stability.md). Pin exact versions, read the `breaking:` lines in the CHANGELOG at each upgrade. |
| A team that needs a large pool of people who already know the tool, or vendor support | One maintainer today, few users beyond the author's own projects, no commercial support. |

## What you give up, even in a good fit

* **Tooling you may expect.** There is a language server and an MCP server, but not yet a VS Code extension or lint presets. Browser devtools see the real DOM (light DOM), but there is no xoong devtools panel.
* **CSS isolation.** There is no Shadow DOM and no scoped styles by design, so a large app needs naming discipline or `@layer` and `@scope`.
* **A way to ask for help.** The documentation is thorough and generated from the code, but the community around it is the maintainer and the issue tracker.

## How to find out cheaply

Build one real screen of yours with xoong (`xoong new`, `xoong sync your-openapi.json`) and look at what you had to write by hand. If it is a few lines of HTML, you are in the
good case. If most of it is JavaScript, the framework is giving you little and another choice is better.
