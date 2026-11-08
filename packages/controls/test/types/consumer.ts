import '@xoong/controls';
import '@xoong/controls/carousel';
import type { XoComboboxElement, XoTabsElement, XoCarouselElement, XoControlsTagMap } from '@xoong/controls';
import { XoControl } from '@xoong/core';

// Every tag of the package is in the tag map, with its element type.
const tabs = document.querySelector('xo-tabs')!;
tabs.select('seo', { focus: true });
tabs.select(1);
const key: string = tabs.value;

const menu = document.createElement('xo-menu');
menu.open('last');
menu.close({ focus: true });
const isOpen: boolean = menu.isOpen;

const combo = document.createElement('xo-combobox');
combo.options = ['a', { value: 'b', label: 'B', disabled: true }, { value: 3 }];
const options: { value: string; label: string; disabled?: boolean }[] = combo.options;
combo.multiple = true;
combo.value = ['a'];
combo.schema = { t: 'array', items: { enum: ['x'] } };
const asControl: XoControl = combo;
const tags = document.createElement('xo-tags');
tags.options = ['x'];

const carousel = document.createElement('xo-carousel');
carousel.next(); carousel.prev(); carousel.goTo(2); carousel.play(); carousel.pause();
const where: number = carousel.index + carousel.count;
carousel.autoplay = 4000;

const sw = document.createElement('xo-switch');
sw.checked = true; sw.value = false; sw.busy = true;
const on: boolean = sw.value;

const date = document.createElement('xo-date');
date.range = true;
date.value = { start: '2026-01-01', end: '2026-01-05' };
date.weekStart = 1;
const time = document.createElement('xo-time');
time.value = '09:30'; time.step = 15;
const slider = document.createElement('xo-slider');
slider.value = 40; slider.labels = 'Low,High';
const stepper = document.createElement('xo-stepper');
stepper.value = 3; stepper.min = 0;
const password = document.createElement('xo-password');
password.autocomplete = 'new-password';
const copy = document.createElement('xo-copy');
copy.value = 'xo_live';
const file = document.createElement('xo-file');
file.progress = 0.4; file.progress = null; file.maxSize = '2MB';
const picked: File | File[] | '' = file.value;
const image = document.createElement('xo-image');
image.src = '/a.jpg'; image.width = 100; image.priority = true;
const chart = document.createElement('xo-chart');
chart.rows = [1, 2, { label: 'Mon', value: 12 }];
const rows: { label: string; value: number }[] = chart.rows;
const accordion = document.createElement('xo-accordion');
accordion.single = true;
const popover = document.createElement('xo-popover');
popover.show(); popover.toggle(); popover.close(true); popover.open = false;
const command = document.createElement('xo-command');
command.open(); command.close(); command.shortcut = 'j';
const consent = document.createElement('xo-consent');
const choices: Record<string, boolean> | null = consent.choices;
consent.open();
const toggle = document.createElement('xo-theme-toggle');
const theme: 'light' | 'dark' = toggle.theme;
toggle.reset();
const byQuery: XoComboboxElement | null = document.querySelector<XoComboboxElement>('xo-combobox');
const asTag: XoControlsTagMap['xo-tabs'] = tabs satisfies XoTabsElement;
const typed: XoCarouselElement = carousel;

// Form controls are XoControls: validation and state come with them.
combo.setCustomValidity('nope');
void [key, isOpen, options, asControl, tags, where, on, time, slider, stepper, password, copy, picked, image, rows, accordion, choices, theme, byQuery, asTag, typed, menu];

// Events carry typed details.
tabs.addEventListener('xo-tab-change', (e) => { const v: string = e.detail.value; void v; });
menu.addEventListener('xo-menu-select', (e) => { const v: string = e.detail.value; void v; });
menu.addEventListener('xo-menu-open', () => {});
menu.addEventListener('xo-menu-close', () => {});
carousel.addEventListener('xo-carousel-change', (e) => { const n: number = e.detail.index + e.detail.count; void n; });
file.addEventListener('xo-file-reject', (e) => { const f: File = e.detail.file; const r: 'type' | 'size' = e.detail.reason; void [f, r]; });
command.addEventListener('xo-command-run', (e) => { const v: string = e.detail.value + e.detail.label; void v; });
consent.addEventListener('xo-consent', (e) => { const analytics: boolean | undefined = e.detail.analytics; void analytics; });
toggle.addEventListener('xo-theme-change', (e) => { const t: 'light' | 'dark' = e.detail.theme; void t; });
popover.addEventListener('xo-popover-open', () => {});
popover.addEventListener('xo-popover-close', () => {});
accordion.addEventListener('xo-accordion-change', (e) => { const o: boolean = e.detail.open; void o; });
combo.addEventListener('xo-search', (e) => { const q: string = e.detail.query; void q; });
copy.addEventListener('copied', (e) => { const t: string = e.detail.text; void t; });
document.addEventListener('xo-tab-change', (e) => { void e.detail.value; });

// Mistakes are compile errors.
// @ts-expect-error unknown key
tabs.nope = 1;
// @ts-expect-error a carousel index is read-only
carousel.index = 3;
// @ts-expect-error goTo takes a number
carousel.goTo('1');
// @ts-expect-error options take strings or objects
combo.options = [1, 2];
// @ts-expect-error the switch value is a boolean
sw.value = 'yes';
// @ts-expect-error the reason is 'type' or 'size'
file.addEventListener('xo-file-reject', (e) => { const r: 'other' = e.detail.reason; void r; });
// @ts-expect-error the theme is light or dark
toggle.addEventListener('xo-theme-change', (e) => { const t: 'blue' = e.detail.theme; void t; });
// @ts-expect-error choices are read-only
consent.choices = null;
// @ts-expect-error not an element of the package
document.createElement('xo-unknown').select('a');
