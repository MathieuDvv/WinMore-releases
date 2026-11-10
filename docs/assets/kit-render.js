// An approximate web renderer for WinMore Kit screens, for the docs explorer. The real thing is
// drawn natively by the iPhone app (SwiftUI); this one only aims to show the shape of each component.
(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const COLORS={primary:'#f5f5f7',secondary:'#98989f',tertiary:'#5a5a5f',accent:'var(--k-accent)',background:'#000',card:'var(--k-surface)',white:'#fff',black:'#000',clear:'transparent',
  red:'#ff453a',orange:'#ff9f0a',yellow:'#ffd60a',green:'#30d158',mint:'#63e6e2',teal:'#40c8e0',cyan:'#64d2ff',blue:'#0a84ff',indigo:'#5e5ce6',purple:'#bf5af2',pink:'#ff375f',brown:'#ac8e68',gray:'#8e8e93'};
const color=c=>c==null?null:COLORS[c]||c;
const TEXT={largeTitle:[30,700],title:[26,700],title2:[21,700],title3:[19,600],headline:[16,600],body:[16,400],callout:[15,400],subheadline:[14,400],footnote:[12.5,400],caption:[11.5,400],caption2:[10.5,400]};
const WEIGHT={regular:400,medium:500,semibold:600,bold:700,heavy:800,light:300};

// A few SF Symbols, redrawn as simple strokes. Anything else becomes a dot with the name in its title.
const P={
  'play.fill':'<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>','pause.fill':'<path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z" fill="currentColor" stroke="none"/>',
  'forward.fill':'<path d="M3.5 6v12l8-6zm9 0v12l8-6z" fill="currentColor" stroke="none"/>','backward.fill':'<path d="M20.5 6v12l-8-6zm-9 0v12l-8-6z" fill="currentColor" stroke="none"/>',
  'plus':'<path d="M12 5v14M5 12h14"/>','minus':'<path d="M5 12h14"/>','xmark':'<path d="M6 6l12 12M18 6L6 18"/>','checkmark':'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  'chevron.left':'<path d="M15 5l-7 7 7 7"/>','chevron.right':'<path d="M9 5l7 7-7 7"/>','chevron.down':'<path d="M5 9l7 7 7-7"/>',
  'gearshape':'<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  'speaker.wave.2.fill':'<path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  'speaker.slash.fill':'<path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6m0-6l-5 6"/>',
  'mic.fill':'<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>',
  'mic.slash.fill':'<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M4 4l16 16"/>',
  'headphones':'<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>',
  'music.note':'<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  'desktopcomputer':'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>','cpu':'<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  'memorychip':'<rect x="4" y="7" width="16" height="10" rx="1.5"/><path d="M8 17v3M12 17v3M16 17v3M8 10v4M12 10v4M16 10v4"/>',
  'thermometer':'<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>','network':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  'magnifyingglass':'<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>','heart.fill':'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
  'star.fill':'<path d="M12 3.5l2.6 5.5 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.7l6-.7z" fill="currentColor"/>','bell':'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4"/>',
  'person.fill':'<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21a8 8 0 0 1 16 0z" fill="currentColor"/>','photo':'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M3 17l5-5 4 4 3-3 6 6"/>',
  'arrow.up':'<path d="M12 20V5M6 11l6-6 6 6"/>','arrow.down':'<path d="M12 4v15M6 13l6 6 6-6"/>','arrow.clockwise':'<path d="M19 12a7 7 0 1 1-2.1-5M19 4v4h-4"/>',
  'ellipsis':'<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/>',
  'keyboard':'<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h1M10 10h1M14 10h1M18 10h0M7 14h10"/>','doc.on.clipboard':'<rect x="7" y="4" width="11" height="15" rx="2"/><path d="M5 7v12a2 2 0 0 0 2 2h9"/>',
  'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>','hand.wave':'<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5v-1a1.5 1.5 0 0 1 3 0V12m0-6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-12.6 4.2L3.4 14a1.6 1.6 0 0 1 2.4-2.1L8 14"/>',
  'bubble.left':'<path d="M4 5h16v11H9l-5 4z"/>','phone.down.fill':'<path d="M3 13c5-4.5 13-4.5 18 0l-2.5 2.5-3-1.5v-2.5a10 10 0 0 0-7 0V14l-3 1.5z" fill="currentColor"/>','safari':'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
};
const symbol=(name,size=17,col)=>`<svg class="k-sym" viewBox="0 0 24 24" style="width:${size}px;height:${size}px${col?`;color:${col}`:''}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><title>${esc(name)}</title>${P[name]||P[String(name).replace(/\.fill$/,'')]||P[name+'.fill']||'<circle cx="12" cy="12" r="5" fill="currentColor" opacity=".55"/>'}</svg>`;

// ── bindings and expressions ─────────────────────────
const get=(obj,pathname)=>pathname.split('.').reduce((o,k)=>o==null?undefined:o[k],obj);
const FILTERS={
  count:v=>Array.isArray(v)?v.length:0,percent:v=>`${Math.round((+v||0)*100)}%`,upper:v=>String(v??'').toUpperCase(),lower:v=>String(v??'').toLowerCase(),
  number:v=>(+v||0).toLocaleString('en'),json:v=>JSON.stringify(v),bytes:v=>{v=+v||0;const u=['B','KB','MB','GB'];let i=0;while(v>=1024&&i<3){v/=1024;i++;}return `${v.toFixed(i?1:0)} ${u[i]}`;},
  duration:v=>{v=Math.max(0,+v||0);return `${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}`;},
  age:v=>{const s=Math.max(0,Date.now()/1000-(+v||0));return s<60?'now':s<3600?`${Math.floor(s/60)}m`:s<86400?`${Math.floor(s/3600)}h`:`${Math.floor(s/86400)}d`;},
  date:v=>new Date((+v||0)*1000).toLocaleDateString('en',{month:'short',day:'numeric'}),time:v=>new Date((+v||0)*1000).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'}),
};
const n=v=>+v||0;
const OPS={
  eq:([a,b])=>a==b,ne:([a,b])=>a!=b,gt:([a,b])=>n(a)>n(b),gte:([a,b])=>n(a)>=n(b),lt:([a,b])=>n(a)<n(b),lte:([a,b])=>n(a)<=n(b),
  not:a=>!(Array.isArray(a)?a[0]:a),and:a=>a.every(Boolean),or:a=>a.some(Boolean),if:([t,a,b])=>t?a:b,has:a=>{const v=Array.isArray(a)?a[0]:a;return v!=null&&v!==''&&!(Array.isArray(v)&&!v.length);},
  count:a=>{const v=Array.isArray(a)&&a.length===1?a[0]:a;return Array.isArray(v)?v.length:0;},in:([a,b])=>Array.isArray(b)?b.includes(a):String(b??'').includes(a),
  startsWith:([a,b])=>String(a??'').startsWith(b),concat:a=>a.join(''),coalesce:a=>a.find(v=>v!=null&&v!==''),
  add:a=>a.reduce((s,v)=>s+n(v),0),sub:([a,b])=>n(a)-n(b),mul:a=>a.reduce((s,v)=>s*n(v),1),div:([a,b])=>n(b)?n(a)/n(b):0,min:a=>Math.min(...a.map(n)),max:a=>Math.max(...a.map(n)),
  lower:a=>String(Array.isArray(a)?a[0]:a).toLowerCase(),upper:a=>String(Array.isArray(a)?a[0]:a).toUpperCase(),join:([a,s])=>(a||[]).join(s??', '),
  first:a=>(Array.isArray(a)&&a.length===1?a[0]:a)?.[0],last:a=>{const v=Array.isArray(a)&&a.length===1?a[0]:a;return v?.[v.length-1];},
  slice:([a,s,e])=>(a||[]).slice(s,e),range:([a,b])=>Array.from({length:Math.max(0,n(b)-n(a))},(_,i)=>n(a)+i),round:a=>Math.round(n(Array.isArray(a)?a[0]:a)),floor:a=>Math.floor(n(Array.isArray(a)?a[0]:a)),
  format:([v,f])=>FILTERS[f]?FILTERS[f](v):v,find:([a,k,v])=>(a||[]).find(x=>get(x,k)==v),
};
function resolve(value,scope){
  if(typeof value==='string'){
    if(/^\$[\w.]+$/.test(value))return get(scope,value.slice(1));
    if(value.includes('{{'))return value.replace(/\{\{\s*([\w.]+)\s*(?:\|\s*(\w+))?\s*\}\}/g,(_,p,f)=>{const v=get(scope,p);return f&&FILTERS[f]?FILTERS[f](v):v??'';});
    return value;
  }
  if(Array.isArray(value))return value.map(v=>resolve(v,scope));
  if(value&&typeof value==='object'){
    const keys=Object.keys(value);
    if(keys.length===1&&OPS[keys[0]]&&!value.type){const arg=resolve(value[keys[0]],scope);try{return OPS[keys[0]](Array.isArray(arg)?arg:[arg]);}catch{return undefined;}}
    return value;
  }
  return value;
}

// ── rendering ────────────────────────────────────────
let actionId=0;
function render(node,scope,ctx){
  if(node==null)return '';
  if(Array.isArray(node))return node.map(c=>render(c,scope,ctx)).join('');
  if(typeof node!=='object'||!node.type)return '';
  if(node.when!==undefined&&!resolve(node.when,scope))return '';
  const r=k=>resolve(node[k],scope);
  const kids=(list=node.children)=>(list||[]).map(c=>render(c,scope,ctx)).join('');
  const act=a=>{if(a==null)return '';const id=++actionId;ctx.actions[id]={action:a,scope};return ` data-k-act="${id}"`;};
  const st=[],cls=['k',`k-${node.type}`];
  // Common props
  const pad=node.padding;
  if(pad!=null)st.push(`padding:${Array.isArray(pad)?pad.map(v=>v+'px').join(' '):pad+'px'}`);
  for(const [k,css] of [['width','width'],['height','height'],['minWidth','min-width'],['minHeight','min-height'],['maxWidth','max-width'],['maxHeight','max-height']]){
    const v=r(k);if(typeof v==='number')st.push(`${css}:${v}px`);else if(v==='screen')st.push(`${css}:100%`);
  }
  if(node.fill==='both'||node.fill===true)st.push('flex:1;align-self:stretch;width:100%');else if(node.fill==='width')st.push('align-self:stretch;width:100%');else if(node.fill==='height')st.push('align-self:stretch');
  if(node.background)st.push(`background:${color(r('background'))}`);
  if(node.foreground)st.push(`color:${color(r('foreground'))}`);
  if(node.opacity!=null)st.push(`opacity:${r('opacity')}`);
  if(node.corner!=null)st.push(`border-radius:${node.corner}px`);
  if(node.shape==='capsule')st.push('border-radius:999px');else if(node.shape==='circle')st.push('border-radius:50%');
  if(node.glass){cls.push('k-glass');if(node.glassTint)st.push(`--glass-tint:${color(node.glassTint)}`);}
  if(node.aspect)st.push(`aspect-ratio:${node.aspect}`);
  if(node.align)st.push(`align-self:${{leading:'flex-start',trailing:'flex-end',center:'center'}[node.align]||'auto'}`);
  if(node.blur)st.push(`filter:blur(${node.blur}px)`);
  if(node.scale)st.push(`transform:scale(${node.scale})`);
  if(node.shadow)st.push('box-shadow:0 8px 24px #0008');
  if(node.clip)st.push('overflow:hidden');
  const wrapAction=node.type!=='button'&&node.action?act(node.action):'';
  if(wrapAction)cls.push('k-tap');
  const open=(tag='div',extra='',more='')=>`<${tag} class="${cls.join(' ')}${more?' '+more:''}" style="${st.join(';')}${extra?';'+extra:''}"${wrapAction}>`;
  const textStyle=(style,weight,col,size)=>{const [s,w]=TEXT[style]||TEXT.body;return `font-size:${size||s}px;font-weight:${WEIGHT[weight]||w}${col?`;color:${color(col)}`:''}`;};
  const align={leading:'flex-start',center:'center',trailing:'flex-end',top:'flex-start',bottom:'flex-end',fill:'stretch'};
  switch(node.type){
    case 'stack':{
      const h=node.axis==='horizontal';
      return open('div',`flex-direction:${h?'row':'column'};gap:${node.spacing??8}px;align-items:${align[node.alignment]||(h?'center':'flex-start')}`)+kids()+'</div>';
    }
    case 'layers':{
      const a=node.alignment||'center',v=/top/i.test(a)?'start':/bottom/i.test(a)?'end':'center',hz=/leading/i.test(a)?'start':/trailing/i.test(a)?'end':'center';
      return open('div',`place-items:${v} ${hz}`)+kids()+'</div>';
    }
    case 'split':return open('div',`grid-template-columns:${(node.ratio??.58)}fr ${1-(node.ratio??.58)}fr;gap:${node.spacing??12}px`)+kids()+'</div>';
    case 'scroll':{
      const h=node.axis==='horizontal';
      return open('div',`flex-direction:${h?'row':'column'};gap:${node.spacing??12}px;overflow:${h?'auto hidden':'hidden auto'}`)+kids()+render(node.footer,scope,ctx)+'</div>';
    }
    case 'grid':return open('div',`grid-template-columns:${node.columns?`repeat(${node.columns},1fr)`:`repeat(auto-fill,minmax(${Math.min(node.minWidth??140,200)}px,1fr))`};gap:${node.spacing??12}px`)+kids()+'</div>';
    case 'list':return open('div','',node.style==='plain'?'plain':'')+kids()+'</div>';
    case 'section':return open()+(node.title?`<h6>${esc(r('title'))}</h6>`:'')+`<div class="k-group">${kids()}</div>`+(node.footer?`<p class="k-foot">${esc(r('footer'))}</p>`:'')+'</div>';
    case 'card':return open('div',`flex-direction:${node.axis==='horizontal'?'row':'column'};gap:${node.spacing??8}px;padding:${node.inset??16}px`)+kids()+'</div>';
    case 'each':{
      const items=r('items')||[];
      if(!items.length)return render(node.empty,scope,ctx);
      return items.map((item,i)=>render(node.template,{...scope,[node.as||'item']:item,...(node.index?{[node.index]:i}:{})},ctx)).join('');
    }
    case 'if':return render(r('test')?node.then:node.else,scope,ctx);
    case 'pager':{
      const page=node.bind?(get(scope,'ui.'+node.bind)??node.start??0):(node.start??0),list=node.children||[];
      const dots=node.indicator==='none'?'':`<div class="k-dots">${list.map((_,i)=>`<i${i==page?' class="on"':''}></i>`).join('')}</div>`;
      return open()+render(list[page]||list[0],scope,ctx)+dots+'</div>';
    }
    case 'spacer':return `<div class="k k-spacer" style="min-width:${node.min||0}px;min-height:${node.min||0}px"></div>`;
    case 'divider':return '<hr class="k k-divider">';
    case 'text':{
      let t=esc(r('text'));
      if(node.markdown)t=t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/_(.+?)_/g,'<i>$1</i>').replace(/`(.+?)`/g,'<code>$1</code>');
      return open('p',`${textStyle(node.style,node.weight,r('color')||'primary',node.size)};text-align:${{center:'center',trailing:'right'}[node.textAlign]||'left'}${node.lines?`;-webkit-line-clamp:${node.lines};display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden`:''}${node.monospaced?';font-variant-numeric:tabular-nums':''}`)+t+'</p>';
    }
    case 'label':return open('span',textStyle(node.style,node.weight,r('color')))+symbol(r('symbol'),(TEXT[node.style]||TEXT.body)[0],color(r('iconColor')))+`<span>${esc(r('text'))}</span></span>`;
    case 'symbol':return open('span')+symbol(r('name'),node.size||17,color(r('color')))+'</span>';
    case 'image':{
      const src=r('src');
      return open('div',node.fit==='fit'?'background-size:contain':'')+(src?`<img src="${esc(src)}" alt="" style="object-fit:${node.fit==='fit'?'contain':'cover'}">`:symbol(node.placeholder||'photo',28,'#636366'))+'</div>';
    }
    case 'gallery':{const imgs=r('images')||[];return open()+(imgs[0]?`<img src="${esc(imgs[0].url||imgs[0])}" alt="">`:'')+(node.counter!==false&&imgs.length?`<span class="k-count">1 / ${imgs.length}</span>`:'')+'</div>';}
    case 'video':return open('div','','k-image')+(r('poster')?`<img src="${esc(r('poster'))}" alt="">`:'')+`<span class="k-playbadge">${symbol('play.fill',26,'#fff')}</span></div>`;
    case 'media':{
      const img=r('image')||(r('images')||[])[0];
      return open('div','','k-image')+(img?`<img src="${esc(img.url||img)}" alt=""${node.spoiler?' style="filter:blur(18px)"':''}>`:'')+(node.video?`<span class="k-playbadge">${symbol('play.fill',26,'#fff')}</span>`:'')+(node.badge?`<span class="k-badge-corner k-glass">${node.badgeSymbol?symbol(r('badgeSymbol'),12):''}${esc(r('badge'))}</span>`:'')+'</div>';
    }
    case 'badge':{const tint=color(r('tint'))||'var(--k-accent)';return open('span',node.variant==='plain'?`color:${tint}`:node.variant==='glass'?'':`background:color-mix(in srgb,${tint} 22%,transparent);color:${tint}`,node.variant==='glass'?'k-glass':'')+(node.symbol?symbol(r('symbol'),12):'')+esc(r('text'))+'</span>';}
    case 'stat':{const p=r('progress');return open()+`<span class="k-stat-label">${node.symbol?symbol(r('symbol'),13):''}${esc(r('label'))}</span><b>${esc(r('value'))}</b>`+(p!=null?`<span class="k-meter"><i style="width:${Math.max(0,Math.min(1,p))*100}%"></i></span>`:'')+'</div>';}
    case 'progress':{const v=r('value');return open('div',`--tint:${color(r('tint'))||'var(--k-accent)'}`)+(node.label?`<span>${esc(r('label'))}</span>`:'')+(v==null?'<span class="k-spin"></span>':`<span class="k-meter"><i style="width:${Math.max(0,Math.min(1,v))*100}%"></i></span>`)+'</div>';}
    case 'gauge':{
      const v=n(r('value')),min=node.min??0,max=node.max??1,t=Math.max(0,Math.min(1,(v-min)/((max-min)||1))),tint=color(r('tint'))||'var(--k-accent)';
      return open()+`<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="25" pathLength="100" stroke-dasharray="75 100" transform="rotate(135 30 30)" class="track"/><circle cx="30" cy="30" r="25" pathLength="100" stroke-dasharray="${75*t} 100" transform="rotate(135 30 30)" style="stroke:${tint}"/></svg><b>${esc(r('text')??Math.round(t*100)+'%')}</b>${node.label?`<span>${esc(r('label'))}</span>`:''}</div>`;
    }
    case 'chart':{
      const vals=(r('values')||[]).map(n),max=node.max??Math.max(1,...vals),min=node.min??0,tint=color(r('tint'))||'var(--k-accent)';
      if(!vals.length)return open()+'</div>';
      const pts=vals.map((v,i)=>[i/(Math.max(1,vals.length-1))*100,40-(v-min)/((max-min)||1)*38]);
      const line=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
      const body=node.kind==='bar'?vals.map((v,i)=>{const h=(v-min)/((max-min)||1)*38;return `<rect x="${i*100/vals.length+1}" y="${40-h}" width="${100/vals.length-2}" height="${h}" rx="1" fill="${tint}"/>`;}).join('')
        :`${node.kind==='line'?'':`<path d="${line}L100 40L0 40Z" fill="${tint}" opacity=".25"/>`}<path d="${line}" fill="none" stroke="${tint}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
      return open()+`<svg viewBox="0 0 100 40" preserveAspectRatio="none">${body}</svg></div>`;
    }
    case 'avatar':{const size=node.size||36,img=r('image');return open('span',`width:${size}px;height:${size}px;font-size:${size*.4}px${node.ring&&r('ring')?';box-shadow:0 0 0 2px #000,0 0 0 4px #30d158':''}${r('dimmed')?';opacity:.45':''}`)+(img?`<img src="${esc(img)}" alt="">`:esc(String(r('text')||'?').slice(0,2).toUpperCase()))+'</span>';}
    case 'row':{
      const tint=color(r('tint'));
      return open('div',node.role==='destructive'?'color:#ff453a':'')+(node.image?`<img class="k-row-img" src="${esc(r('image'))}" alt="">`:node.symbol?`<span class="k-row-sym" style="${tint?`background:${tint}`:''}">${symbol(r('symbol'),16,'#fff')}</span>`:'')
        +`<span class="k-row-text"><b>${esc(r('title'))}</b>${node.subtitle?`<small>${esc(r('subtitle'))}</small>`:''}</span>`
        +(node.value?`<span class="k-row-value">${esc(r('value'))}</span>`:'')+(r('checked')||node.accessory==='check'?symbol('checkmark',16,'var(--k-accent)'):'')+(node.accessory==='chevron'?symbol('chevron.right',14,'#5a5a5f'):'')+'</div>';
    }
    case 'comment':return open('div',`margin-left:${(r('depth')||0)*14}px`)+`<span class="k-comment-head"><b>${esc(r('author'))}</b>${node.meta?` · ${esc(r('meta'))}`:''}${node.score!=null?`<span>${symbol('arrow.up',12)} ${esc(r('score'))}</span>`:''}</span><p>${esc(r('body'))}</p></div>`;
    case 'empty':return open()+(r('loading')?'<span class="k-spin"></span>':node.symbol?symbol(r('symbol'),34,'#636366'):'')+(node.title?`<b>${esc(r('title'))}</b>`:'')+(node.message?`<p>${esc(r('message'))}</p>`:'')+kids()+'</div>';
    case 'lyrics':{const lines=r('lines')||[];return open()+lines.slice(0,5).map((l,i)=>`<p class="${i===1?'on':''}">${esc(l.text??l)}</p>`).join('')+'</div>';}
    case 'clock':{const d=new Date(),h24=node.hours24!==false;return open('div',`font-size:${node.size||64}px`,`face-${node.face||'digital'}`)+`<b>${d.toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit',hour12:!h24}).replace(/\s?[AP]M/,'')}</b>`+(node.date!==false?`<span>${d.toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'})}</span>`:'')+'</div>';}
    case 'web':return open()+`${symbol('safari',22,'#98989f')}<span>Web block · <code>${esc(node.src)}</code></span><small>Your HTML page draws here, talking to the app through <code>window.winmore</code>.</small></div>`;
    case 'button':{
      const variant=node.variant||'bordered',tint=color(r('tint'));
      const shape=node.buttonShape==='circle'||(!node.label&&node.symbol&&variant==='glass')?'circle':node.buttonShape||'capsule';
      return `<button type="button" class="${cls.join(' ')} v-${variant} s-${shape}${r('selected')?' on':''}${node.size?' z-'+node.size:''}" style="${st.join(';')}${tint?`;--tint:${tint}`:''}"${act(node.action)}${r('disabled')?' disabled':''}>`
        +(r('loading')?'<span class="k-spin"></span>':node.symbol?symbol(r('symbol'),node.symbolSize||(node.label?15:18)):'')+(node.label?`<span>${esc(r('label'))}</span>`:'')+'</button>';
    }
    case 'pill':return open('div','','k-glass')+kids()+'</div>';
    case 'menu':{
      const items=(node.items||[]).filter(i=>i.label||i.title);
      return `<details class="${cls.join(' ')}" style="${st.join(';')}"><summary class="k-button v-${node.variant||'glass'} s-${node.buttonShape||(node.label?'capsule':'circle')}">${node.symbol?symbol(r('symbol'),16):''}${node.label?`<span>${esc(r('label'))}</span>`:''}${node.chevron?symbol('chevron.down',12):''}</summary><div class="k-menu-list">${items.map(i=>`<button type="button"${act(i.action)}>${i.symbol?symbol(i.symbol,15):''}<span>${esc(resolve(i.label||i.title,scope))}</span>${resolve(i.checked,scope)?symbol('checkmark',14):''}</button>`).join('')}</div></details>`;
    }
    case 'toggle':return open('label')+(node.symbol?symbol(r('symbol'),17):'')+`<span>${esc(r('label'))}</span><button type="button" role="switch" aria-checked="${!!r('value')}" class="k-switch"${act(node.action?[{set:'__value',value:!r('value')},...[].concat(node.action)]:null)}></button></label>`;
    case 'slider':{
      const min=node.min??0,max=node.max??1,v=n(r('value'));
      return open('label',`--tint:${color(r('tint'))||'var(--k-accent)'}`)+(node.symbol?symbol(r('symbol'),17):'')+(node.label?`<span>${esc(r('label'))}</span>`:'')+`<input type="range" min="${min}" max="${max}" step="${node.step||(max-min)/100}" value="${v}"${act(node.action)} data-k-input${r('disabled')?' disabled':''}></label>`;
    }
    case 'scrubber':{const tl=get(scope,'song')||{current:37,duration:168};return open()+`<span class="k-meter"><i style="width:${tl.current/tl.duration*100}%"></i></span>`+(node.times!==false?`<span class="k-times"><span>${FILTERS.duration(tl.current)}</span><span>-${FILTERS.duration(tl.duration-tl.current)}</span></span>`:'')+'</div>';}
    case 'stepper':{const v=n(r('value'));return open()+`<span>${esc(r('label'))}</span><span class="k-step"><button type="button"${act([{set:'__value',value:v-(node.step||1)},...[].concat(node.action||[])])}>${symbol('minus',14)}</button><button type="button"${act([{set:'__value',value:v+(node.step||1)},...[].concat(node.action||[])])}>${symbol('plus',14)}</button></span></div>`;}
    case 'picker':{
      const v=r('value'),opts=(r('options')||[]).map(o=>typeof o==='object'?o:{value:o,label:o});
      if(node.variant==='menu')return open()+`<span>${esc(r('label')||'')}</span><span class="k-picker-menu">${esc((opts.find(o=>o.value==v)||opts[0]||{}).label)} ${symbol('chevron.down',11)}</span></div>`;
      return open('div','','seg')+opts.map(o=>`<button type="button" class="${o.value==v?'on':''}"${act(node.action?[{set:'__value',value:o.value},...[].concat(node.action)]:null)}>${o.symbol?symbol(o.symbol,14):''}${esc(o.label??o.value)}</button>`).join('')+'</div>';
    }
    case 'field':{
      const v=node.bind?get(scope,'ui.'+node.bind)??'':'';
      return open('label')+(node.symbol?symbol(r('symbol'),16,'#98989f'):'')+(node.prefix?`<span class="k-prefix">${esc(r('prefix'))}</span>`:'')+`<input type="${node.secure?'password':'text'}" placeholder="${esc(r('placeholder')||'')}" value="${esc(v)}" data-k-bind="${esc(node.bind||'')}">`+(node.pcKeyboard!==false?symbol('keyboard',16,'#636366'):'')+'</label>';
    }
    case 'link':return open('span')+(node.symbol?symbol(r('symbol'),15):'')+esc(r('label'))+'</span>';
    default:return open()+`<code>${esc(node.type)}</code></div>`;
  }
}

// Runs an action the way the phone would, as far as a web page can: screen variables change,
// everything else is reported in the activity log.
function run(action,scope,state,log,value){
  for(const a of [].concat(action)){
    if(!a||typeof a!=='object')continue;
    const v=k=>resolve(a[k],{...scope,value});
    if('set' in a){
      if(a.set==='__value'){value=v('value');continue;}
      state[a.set]=v('value');log(`set ${a.set} = ${JSON.stringify(state[a.set])}`);
    }else if('toggle' in a){state[a.toggle]=!state[a.toggle];log(`toggle ${a.toggle} → ${state[a.toggle]}`);}
    else if('command' in a)log(`command → PC: ${a.app?a.app+'.':''}${a.command}${a.value!==undefined?` ${JSON.stringify(v('value'))}`:''}`,'cmd');
    else{const k=Object.keys(a)[0];log(`${k}${a[k]!==true?` ${JSON.stringify(v(k))}`:''}`);}
  }
}

window.KitRender={render,run,resolve,symbol};
})();
