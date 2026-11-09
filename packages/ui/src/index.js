// Importing the package registers every element of the admin set.
import '@xoong/forms'; // every <form xo-submit> (and <xo-form>) uses the schema-driven form model
import './table.js';
import './pager.js';
import './form.js';
import './dialog.js';
import './toast.js';
export { router } from './router-lazy.js'; // router.js loads when a <xo-router> is on the page or `router` is first used
export { toast } from './toast.js';
export { confirm, alert, prompt, ask, confirmLabels } from './dialogs-lazy.js'; // dialogs.js loads on the first question
export { setConfirm } from '@xoong/data/view';
