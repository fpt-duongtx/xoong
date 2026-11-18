import '@xoong/richtext';
import { sanitizeHtml, isSafeLink, isSafeImage, textOf, defineRichtextProfile } from '@xoong/richtext';
import type { RichtextProfile } from '@xoong/richtext';
import * as sanitizer from '@xoong/richtext/sanitize';
import type { XoRichtextElement, XoRichtextConstructor } from '@xoong/richtext';
import type { XoControl } from '@xoong/core';

const editor = document.createElement('xo-richtext');
editor.value = '<p>Hi</p>';
editor.tools = 'bold italic link image';
editor.toolbar = 'compact';
editor.media = true;
editor.maxlength = 200;
editor.name = 'body';
editor.required = true;
const html: string = editor.value;
const open: boolean = editor.expanded;
editor.expand();
editor.collapse();
const inserted: boolean = editor.insertImage('/a.png', 'A');
editor.insertImage('/a.png');
const asControl: XoControl = editor;
const byQuery: XoRichtextElement | null = document.querySelector('xo-richtext');
const ctor = customElements.get('xo-richtext') as unknown as XoRichtextConstructor;
const link: string = ctor.linkTarget('example.com');

editor.addEventListener('xo-pick-media', (event) => {
  event.preventDefault();
  event.detail.insert({ src: '/library/1.png', alt: 'One' });
  event.detail.insert('/library/2.png', 'Two');
});
editor.addEventListener('xo-richtext-expand', () => {});
editor.addEventListener('xo-richtext-done', () => {});

const clean: string = sanitizeHtml('<b>x</b>', { images: false });
const safe: boolean = isSafeLink('https://x.test') && isSafeImage('/a.png');
const plain: string = textOf('<p>a</p>') + sanitizer.sanitizeHtml('x');
void [html, open, inserted, asControl, byQuery, link, clean, safe, plain];

// Mistakes are compile errors.
// @ts-expect-error the value is a string
editor.value = 3;
// @ts-expect-error expanded is read-only
editor.expanded = true;
// @ts-expect-error insert needs a src
editor.addEventListener('xo-pick-media', (event) => { event.detail.insert({ alt: 'x' }); });
// @ts-expect-error images is a boolean
sanitizeHtml('x', { images: 'no' });

const profile: RichtextProfile = { tags: { p: {}, aside: { classes: ['note'] }, a: { attrs: { href: 'url', target: ['_blank'] } } }, rename: { div: 'p' }, schemes: { url: ['https'] } };
defineRichtextProfile('mine', profile);
const cleaned: string = sanitizeHtml('<p>x</p>', profile);
sanitizeHtml('<p>x</p>', 'rich');
editor.profile = 'rich';
editor.profile = profile;
editor.sanitize = (html, { source }) => html + source;
editor.sanitize = null;
const figure: boolean = editor.insertFigure('/a.png', 'A', 'Caption');
// @ts-expect-error a profile needs tags
const noTags: RichtextProfile = {};
// @ts-expect-error an attribute type is text, url, imgurl, int or a list
const badType: RichtextProfile = { tags: { a: { attrs: { href: 'link' } } } };
