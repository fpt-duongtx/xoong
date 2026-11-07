// @xoong/forms: importing it makes every <form xo-submit> use the schema-driven model (see form-dom.js once it is registered).
export { createForm, normalize } from './form-model.js';
export { attach, isoToLocal, localToIso } from './form-dom.js';

import { setFormEngine } from '@xoong/data/view';
import { attach as attachForm } from './form-dom.js';
setFormEngine({ attach: attachForm }); // from now on, every xo-submit form with a request schema uses the form model
export { parsePath, pathKey, getAt, setAt, nodeAt, variant, coerce, defaults, validate, checkValue, setMessages, resetMessages, message } from './schema.js';
