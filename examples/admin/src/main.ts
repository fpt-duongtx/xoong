import { configure } from '@xoong/data';
import '@xoong/data/view';
import operations from '/.xoong/operations.json' with { type: 'json' };

// One client for the whole app. `streamUrl` is used by every <xo-view live>.
configure({ api: operations, baseUrl: '/api', streamUrl: '/api/events' });

// Mutation failures arrive as bubbling `xo-error` events carrying the normalised error.
const toast = document.getElementById('toast') as HTMLElement;
document.addEventListener('xo-error', (event) => {
  const error = (event as CustomEvent).detail as { code?: string; detail?: string; message: string };
  toast.textContent = error.detail ?? error.message;
  toast.hidden = false;
});
document.addEventListener('xo-done', () => { toast.hidden = true; });
