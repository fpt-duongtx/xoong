import { configure } from '@xoong/data';
import '@xoong/data/view';
import '@xoong/ui';
import operations from '/.xoong/operations.json' with { type: 'json' };

configure({ api: operations, baseUrl: '/api' });
