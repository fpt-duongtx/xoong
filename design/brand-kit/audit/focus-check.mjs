// Keyboard focus audit (WCAG 1.4.11 / 2.4.7): tabs through the built docs site in Calm/Ember x light/dark and checks that every focus
// state has a visible indicator (outline, ring, or border change, on the element or the wrapper that gets :focus-within) of at least
// 3:1 against what surrounds it. axe cannot check this.
//   node design/brand-kit/audit/focus-check.mjs components forms data demo     (page names without .html)
//   KIT=1 node ...   builds the site, then overlays design/brand-kit/css/{components,controls,states,xo-map}.css before checking
import { createServer } from 'node:http'; import { readFile, stat } from 'node:fs/promises'; import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { build, CSP } from '../../../packages/cli/src/build.js';
const R=new URL('../../../', import.meta.url).pathname, out='/tmp/_focus';
await build({root:R+'site',out,base:'/xoong',include:['img','brand']});
import { copyFile } from 'node:fs/promises';
if (process.env.KIT) { const K=R+'design/brand-kit/css/'; await copyFile(K+'components.css',out+'/src/components.css'); await copyFile(K+'controls.css',out+'/src/standard.css'); await copyFile(K+'states.css',out+'/src/states.css'); await copyFile(K+'xo-map.css',out+'/src/xo-map.css'); }
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const srv=createServer(async(q,r)=>{r.setHeader('content-security-policy',CSP);const p=new URL(q.url,'http://x').pathname.replace(/^\/xoong/,'')||'/';const f=join(out,p==='/'?'index.html':p);if(!(await stat(f).then(s=>s.isFile(),()=>false))){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':T[extname(f)]||'application/octet-stream'});r.end(await readFile(f))});
await new Promise(r=>srv.listen(0,'127.0.0.1',r)); const base=`http://127.0.0.1:${srv.address().port}/xoong/`;
const b=await chromium.launch();
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
const results=[];
for (const [pal,scheme] of [['calm','light'],['calm','dark'],['ember','light'],['ember','dark']]) {
  const ctx=await b.newContext({viewport:{width:1500,height:900},colorScheme:scheme}); const p=await ctx.newPage();
  await p.addInitScript((pal)=>{try{localStorage.setItem('xoong-palette',pal)}catch{}},pal);
  for (const pg of process.argv.slice(2)) {
    await p.goto(base+pg+'.html'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(300);
    await p.evaluate(()=>{document.activeElement&&document.activeElement.blur()});
    const seen=new Set();
    for (let i=0;i<160;i++){ await p.keyboard.press('Tab'); const r=await p.evaluate(probe); if(!r) continue; const key=r.tag+r.text; if(seen.has(key)) continue; seen.add(key); results.push({pal,scheme,pg,...r}); }
  }
  await ctx.close();
}
const bad=results.filter(r=>r.ratio===null||r.ratio<3);
console.log('checked',results.length,'focus states; below 3:1 or no indicator:',bad.length);
const group={};for(const r of bad){const k=`${r.pal}/${r.scheme} ${r.tag} ring=${r.kind} ratio=${r.ratio} on ${r.around}`;(group[k]??=[]).push(r.pg+':'+r.text)}
for(const [k,v] of Object.entries(group)) console.log(k,'\n    e.g.',v.slice(0,3).join(' | '));
process.exitCode = bad.length ? 1 : 0;
await b.close(); srv.close();
