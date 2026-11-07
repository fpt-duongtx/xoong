// Importing the package registers every element of the admin set.
import '@xoong/forms'; // every <form xo-submit> (and <xo-form>) uses the schema-driven form model
import './table.js';
import './form.js';
import './dialog.js';
import './toast.js';
export { router } from './router.js';
export { toast } from './toast.js';
export { confirm, labels as confirmLabels } from './confirm.js';
export { setConfirm } from '@xoong/data/view';
