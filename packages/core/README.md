# @xoong/core

The reactive base of xoong: signals, `html` templates and Light DOM custom elements. No dependencies.

## Install

```bash
npm install @xoong/core
```

## Use

```js
import { signal, computed, effect, html, render, XoElement, define } from '@xoong/core';

const count = signal(0);
class ClickCounter extends XoElement {
  render() { return html`<button @click=${() => count.value++}>Clicked ${() => count.value}</button>`; }
}
define('click-counter', ClickCounter);
```

`XoControl` (also here) is the base of form controls: value, validity, `dirty` and `touched` through `ElementInternals`.

## More

* Documentation, guides and live demos: https://fpt-duongtx.github.io/xoong/
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/core
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
