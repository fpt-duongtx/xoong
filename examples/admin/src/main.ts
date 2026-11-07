import { configure } from '@xoong/data';
import '@xoong/data/view';
import '@xoong/ui';
import operations from '/.xoong/operations.json' with { type: 'json' };

// The whole application script: one client for every screen. `streamUrl` serves every <xo-view live>.
const options: Parameters<typeof configure>[0] = { api: operations, baseUrl: '/api', streamUrl: '/api/events' };
configure(options);
