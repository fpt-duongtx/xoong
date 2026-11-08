// Contrast of the focus ring colour (--xo-color-accent) against every surface token, per palette and scheme. Prints JSON, then a table.

const hex=h=>{h=h.replace('#','');if(h.length===3)h=[...h].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
const lum=h=>{const c=hex(h).map(v=>v/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};
const mix=(a,b,p)=>'#'+hex(a).map((v,i)=>Math.round(v*p+hex(b)[i]*(1-p)).toString(16).padStart(2,'0')).join('');
const SETS={
 'Calm · light':{accent:'#9a4d33',inverseText:'#f7f3ea',bg:{page:'#f7f4ec',surface:'#fffdf8',subtle:'#eee8da','accent-soft':'#f7e6dc',inverse:'#2b2623'}},
 'Calm · dark':{accent:'#eeaa90',inverseText:'#f7f3ea',bg:{page:'#171513',surface:'#201d1a',subtle:'#29251f','accent-soft':'#33231d',inverse:'#3b3530'}},
 'Ember · light':{accent:'#b93a0a',inverseText:'#fff3e2',bg:{page:'#fff8ee',surface:'#ffffff',subtle:'#ffefd6','accent-soft':'#ffe3d3',inverse:'#1c1512'}},
 'Ember · dark':{accent:'#ff9068',inverseText:'#fff3e2',bg:{page:'#15110f',surface:'#1f1916',subtle:'#2a211c','accent-soft':'#3a1f14',inverse:'#3b3530'}},
};
const fw={'Framework default · light':{accent:'#2457d6',inverseText:'#ffffff',bg:{page:'#f7f8fa',surface:'#ffffff',subtle:mix('#1b1f27','#f7f8fa',.06),'accent-soft':mix('#2457d6','#f7f8fa',.12),inverse:'#1b1f24'}},
 'Framework default · dark':{accent:'#7aa2ff',inverseText:'#ffffff',bg:{page:'#14161a',surface:'#1d2026',subtle:mix('#e8eaee','#14161a',.07),'accent-soft':mix('#7aa2ff','#14161a',.16),inverse:'#3a3f47'}}};
const out={};
for(const [n,s] of Object.entries({...SETS,...fw})){out[n]={accent:s.accent,rows:Object.entries(s.bg).map(([k,bg])=>({bg:k,hex:bg,ratio:+cr(s.accent,bg).toFixed(2),ok:cr(s.accent,bg)>=3,altRing:s.inverseText,altRatio:+cr(s.inverseText,bg).toFixed(2)}))};}
console.log(JSON.stringify(out));
for(const [n,v] of Object.entries(out)){console.log(n,v.accent);for(const r of v.rows)console.log('   ',r.bg.padEnd(12),r.hex,String(r.ratio).padStart(5),r.ok?'ok':'FAIL', 'inverse-text ring', r.altRatio)}
