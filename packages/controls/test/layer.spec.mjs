import { describe, it, expect, afterEach } from 'vitest';
import { prepareLayer, showLayer } from '../src/layer.js';

const rect = (o) => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, ...o });
const place = ({ anchor, size, vw, vh }) => {
  const oldW = globalThis.innerWidth, oldH = globalThis.innerHeight;
  globalThis.innerWidth = vw; globalThis.innerHeight = vh;
  const a = document.createElement('div');
  a.getBoundingClientRect = () => rect({ ...anchor, right: anchor.left + anchor.width, bottom: anchor.top + anchor.height });
  const panel = document.createElement('div');
  panel.showPopover = () => {}; panel.hidePopover = () => {}; panel.matches = () => false;
  panel.getBoundingClientRect = () => rect({ width: size.width, height: panel.style.maxHeight ? Math.min(size.height, parseFloat(panel.style.maxHeight)) : size.height });
  prepareLayer(panel);
  document.body.append(a, panel);
  const stop = showLayer(panel, a);
  stop();
  globalThis.innerWidth = oldW; globalThis.innerHeight = oldH;
  return { left: parseFloat(panel.style.left), top: parseFloat(panel.style.top), maxHeight: panel.style.maxHeight };
};
afterEach(() => { document.body.innerHTML = ''; });

describe('showLayer keeps a popup inside the viewport', () => {
  const field = (o) => ({ width: 200, height: 40, ...o });
  it('sideways: a panel wider than the room to the right is moved left; one at the left edge stays at 8px', () => {
    expect(place({ anchor: field({ left: 300, top: 100 }), size: { width: 298, height: 200 }, vw: 390, vh: 700 }).left).toBe(390 - 298 - 8);
    expect(place({ anchor: field({ left: -50, top: 100 }), size: { width: 298, height: 200 }, vw: 390, vh: 700 }).left).toBe(8);
    expect(place({ anchor: field({ left: 20, top: 100 }), size: { width: 298, height: 200 }, vw: 1280, vh: 700 }).left).toBe(20); // room: unchanged
  });
  it('vertically: opens below when it fits, above when there is more room above', () => {
    expect(place({ anchor: field({ left: 10, top: 100 }), size: { width: 200, height: 256 }, vw: 1280, vh: 700 })).toMatchObject({ top: 140, maxHeight: '' });
    const up = place({ anchor: field({ left: 10, top: 400 }), size: { width: 200, height: 256 }, vw: 1280, vh: 500 });
    expect(up.top).toBe(400 - 256); // 60px below is not enough, 392 above is
    expect(up.maxHeight).toBe('');
  });
  it('when neither side has enough room the height is capped so the panel scrolls', () => {
    const r = place({ anchor: field({ left: 10, top: 240 }), size: { width: 200, height: 400 }, vw: 1280, vh: 500 });
    expect(r.maxHeight).toBe('232px'); // above: 240 - 8; below: 500 - 280 - 8 = 212
    expect(r.top).toBe(240 - 232);
  });
});
