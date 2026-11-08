// Keyboard focus indicators (WCAG 1.4.11, 2.4.7): tab through a page and measure, for every focus state, the indicator (an outline, a ring
// or a border change, on the element or on the wrapper that gets :focus-within) against what surrounds it. axe cannot check this.
// The probe is the one of the design kit's audit (design/brand-kit/audit/focus-check.mjs), kept in step with it.

const probe=()=>{
  const parse=(s)=>{ if(!s) return null; let m=s.match(/rgba?\(([^)]+)\)/); if(m){const v=m[1].split(/[ ,\/]+/).map(Number); return {r:v[0],g:v[1],b:v[2],a:v[3]??1}}
    m=s.match(/color\(srgb ([^)]+)\)/); if(m){const v=m[1].split(/[ \/]+/).map(Number); return {r:v[0]*255,g:v[1]*255,b:v[2]*255,a:v[3]??1}} return null; };
  const lum=(c)=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
  const cr=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};
  const over=(top,bot)=>({r:top.r*top.a+bot.r*(1-top.a),g:top.g*top.a+bot.g*(1-top.a),b:top.b*top.a+bot.b*(1-top.a),a:1});
  const bgOf=(el)=>{const layers=[];for(let n=el;n;n=n.parentElement){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c.a>0){layers.push(c);if(c.a>=1)break}}let acc={r:255,g:255,b:255,a:1};for(const l of layers.reverse())acc=over(l,acc);return acc};
  const el=document.activeElement; if(!el||el===document.body) return null;
  const rect=el.getBoundingClientRect(); if(!rect.width||!rect.height) return null;
  const indicator=(n)=>{ const cs=getComputedStyle(n); const around=bgOf(n.parentElement||n); const out=[];
    if(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>=2){const c=parse(cs.outlineColor); if(c&&c.a>0.5) out.push({kind:'outline '+cs.outlineWidth,ratio:cr(over(c,around),around)});}
    const m=cs.boxShadow.match(/(rgba?\([^)]+\)|color\(srgb[^)]+\))\s+0px 0px 0px (\d+)px/); if(m){const c=parse(m[1]); if(c) out.push({kind:'glow '+m[2]+'px',ratio:cr(over(c,around),around),soft:c.a<1});}
    const bw=parseFloat(cs.borderTopWidth); if(bw>=1){const c=parse(cs.borderTopColor); if(c&&c.a>0) out.push({kind:'border '+bw+'px',ratio:cr(over(c,around),around)});}
    return {out,around};};
  let best=null, chain=[];
  for(let n=el,d=0;n&&d<5;n=n.parentElement,d++){ const {out,around}=indicator(n); for(const o of out){ chain.push((d?'^'+d+' ':'')+o.kind+' '+o.ratio.toFixed(2)); if(!best||o.ratio>best.ratio) best={...o,depth:d,around}; } if(best&&best.ratio>=3) break; if(n.matches&&n.matches(':focus-within')===false) break; }
  const around=bgOf(el.parentElement||el);
  return {tag:el.tagName.toLowerCase()+(el.getAttribute('role')?'['+el.getAttribute('role')+']':'')+(el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:''),text:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,24),kind:best?(best.depth?'^'+best.depth+' ':'')+best.kind:'none',ratio:best?+best.ratio.toFixed(2):null,around:`rgb(${Math.round(around.r)},${Math.round(around.g)},${Math.round(around.b)})`};
};

/**
 * @param {import('playwright-core').Page} page a page that is loaded
 * @param {{ max?: number }} [options] the most Tab presses
 * @returns {Promise<{ tag: string, text: string, kind: string, ratio: number | null, around: string }[]>}
 */
export async function focusStates(page, { max = 120 } = {}) {
  await page.evaluate(() => { /** @type {any} */ (document.activeElement)?.blur?.(); });
  const seen = new Set();
  const found = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(probe);
    if (!r) continue;
    const key = r.tag + r.text;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(r);
  }
  return found;
}

/** The states without an indicator, or with less than 3:1 against what surrounds them. */
export const weak = (states) => states.filter((r) => r.ratio === null || r.ratio < 3);
