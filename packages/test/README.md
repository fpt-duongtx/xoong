# @xoong/test

Test helpers for xoong screens: mount markup with a mocked API generated from `operations.json`, click, submit and push live events. Runs on Vitest.

## Install

```bash
npm install @xoong/test
```

## Use

```js
import { mount, mockApi } from '@xoong/test';

const api = mockApi(operations, { listPeople: () => ({ items: [{ id: 1, name: 'Ada' }] }) });
const screen = await mount('<xo-view get="listPeople"><li xo-each="items">{name}</li></xo-view>', { api });
expect(screen.texts('li')).toEqual(['Ada']);
```

## More

* Documentation and demos: https://github.com/fpt-duongtx/xoong#readme
* Source: https://github.com/fpt-duongtx/xoong/tree/main/packages/test
* All packages share one version number and are released together: https://github.com/fpt-duongtx/xoong/releases
* xoong is a working prototype (0.0.x): the HTML syntax is still Draft.

MIT licence.
