# Security: what xoong enforces, and how to run it under a strict CSP

## Content-Security-Policy

The xoong runtime runs under a policy with **no `unsafe-eval` and no `unsafe-inline`**:

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'self'
```

* The runtime never calls `eval`, `new Function` or `setTimeout` with a string. Interpolation, `xo-if`, `xo-each`, formats and
  validation rules are plain code walking data. `new RegExp` is used for schema `pattern`; that is not code evaluation.
* It never creates a `<style>` element and never writes a `style=""` attribute. `xoong.css` is an external file; the generated table, form,
  dialog, confirm and toast use classes only.
* It sets no inline event handler. Interpolation into `on*` attributes and `srcdoc` is refused.
* The dev server (`xoong dev`) injects an **inline import map**, which `script-src 'self'` blocks. Do not use the dev server's HTML in
  production: use **`xoong build`** (see [admin.md](admin.md), [consuming.md](consuming.md)). Its output has no import map: package
  imports are rewritten to URLs, TypeScript is stripped, and it warns about anything in *your* pages the policy would block (an inline
  `<script>`, a `style=""` attribute, an inline `<style>`).
* Verified by a test: `packages/cli/test/build.test.mjs` serves the built admin example with exactly the policy above, in real Chromium,
  and fails on any `securitypolicyviolation`. A second test shows the policy is really enforced there (an inline script is blocked).
* Nonce-based policies work as well: nothing in the runtime needs a nonce.

## What the runtime refuses or escapes

| Input | Rule |
|---|---|
| Data in text (`{path}`) | Always set with `textContent`; never HTML. |
| Data in attributes | Refused for `on*` and `srcdoc`; URL attributes (`href`, `src`, `action`, ...) that are not relative, `http(s)`, `mailto` or `tel` become `about:blank` (`javascript:`, `data:`, `vbscript:`, also obfuscated with whitespace). |
| Table labels and column names written in markup | Escaped when `<xo-table>` builds its markup. |
| Router links | Only same-origin links inside `base` are handled; everything else is left to the browser. A route parameter is URL-encoded when it goes into a request path. |
| Server error messages | Shown with `textContent`. |
| Prerendering (`xoong render`) | Text and attribute values come out escaped by the DOM serializer; scripts of the page are not run or fetched while rendering. |
| Dev server and proxy | Serves files under its root only (paths that escape it are refused); proxies only the prefixes in `xoong.config.json`; checks the `Host` header against `allowedHosts`. |

## What is yours

* The server's own checks: authentication, authorisation, CSRF, validation. The client-side schema rules are for the person's convenience,
  never a control.
* Sanitising HTML that people write (rich text): the editor sanitises what it emits and what is pasted, and the server must sanitise
  again on write.
* Cookies and tokens: `configure({ headers, credentials })` sends what you give it; xoong stores nothing.

Report a vulnerability as described in [SECURITY.md](../SECURITY.md).
