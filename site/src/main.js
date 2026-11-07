// The only script of the demo page: one client, pointed at the static JSON next to the site (no server).
import { configure } from '@xoong/data';
import '@xoong/data/view';
import '@xoong/ui';
import operations from '/.xoong/operations.json' with { type: 'json' };

configure({ api: operations, baseUrl: new URL('.', document.baseURI).pathname.replace(/\/$/, '') });
