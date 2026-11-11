(()=>{
const {render,run,symbol}=window.KitRender;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const $=id=>document.getElementById(id);

// ── code blocks: light highlighting and a copy button ──
for(const pre of document.querySelectorAll('pre[data-lang]')){
  const raw=pre.textContent;
  let html=esc(raw);
  if(pre.dataset.lang==='json')html=html.replace(/(&#34;(?:[^&]|&(?!#34;))*?&#34;)(\s*:)?|\b(-?\d+(?:\.\d+)?|true|false|null)\b/g,(m,str,colon,num)=>str?`<span class="${colon?'k-key':'k-str'}">${str}</span>${colon||''}`:`<span class="k-num">${num}</span>`);
  else html=html.replace(/(\/\/.*)$/gm,'<span class="k-com">$1</span>').replace(/(&#39;[^&]*?&#39;)/g,'<span class="k-str">$1</span>');
  pre.innerHTML=`<code>${html}</code><button class="copy" type="button">Copy</button>`;
  pre.querySelector('.copy').onclick=e=>{navigator.clipboard?.writeText(raw);e.target.textContent='Copied';setTimeout(()=>e.target.textContent='Copy',1200);};
}

// ── table of contents follows the reading position ──
const links=[...document.querySelectorAll('.toc a')];
const spy=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){links.forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+entry.target.id));}
},{rootMargin:'-20% 0px -70% 0px'});
links.forEach(a=>{const t=document.querySelector(a.getAttribute('href'));if(t)spy.observe(t);});

// ── the catalog, with notes on how each app works ─────
const NOTES={
  music:'A hidden, signed-in YouTube Music window on the PC does the playing. The phone browses Home, Explore, your Library and search, queues songs, scrubs, and shows time-synced lyrics (from LRCLIB, or YouTube Music\'s own). Choose <strong>Open music</strong> on the island once to accept cookies and sign in.',
  discord:'Controls the Discord desktop app already running on your PC through its local RPC connection, never the web version and never your password. See who\'s in your call (green ring while they talk), mute, deafen, leave, set someone\'s volume, and play soundboard sounds. One-time setup on the island: Settings → Discord walks you through creating your own Discord application.',
  mixer:'Per-app volume for your default Windows output, like the Volume mixer but on your phone: a master fader plus a channel strip for every app making sound, with its icon. Drag to change, tap the speaker to mute. Apps with several processes (browsers) move together.',
  browser:'A remote for a real browser window on the PC. Type an address; the PC sends screenshots. Tap to click, send text to a field, scroll, or go back. For logins and keyboard shortcuts, open the window on the PC.',
  reddit:'A landscape Reddit reader. Reddit runs in WinMore\'s own window on the PC, so no API key is needed: sign in there once (or browse signed out). Each post is a screen-sized card; open one for comments, upvote and save. History, Saved and your lists are a tap away.',
  twitch:'Join any public channel and read its chat live. Connects anonymously on the PC: no login, read-only.',
  pc:'A glance at your PC on three pages: master volume, processor and memory load, hardware temperatures (from Libre Hardware Monitor or Open Hardware Monitor when running), and network speeds.',
  clipboard:'Moves text and images between the phone and the PC. <strong>Copy to phone</strong> takes what the PC copied; <strong>Send to PC</strong> pops it onto the island with Copy and Dismiss for 30 seconds. Nothing is kept as history.',
  clock:'Turns the phone into a bedside clock with several faces. Notification mirroring will come with a future Bluetooth bridge.',
};
fetch('data/apps.json').then(r=>r.json()).then(({apps})=>{
  $('app-docs').innerHTML=apps.map(app=>`<div class="app-doc" id="app-${esc(app.id)}"><span class="glyph">${app.icon?`<img src="${esc(app.icon)}" alt="">`:''}</span>
    <div><h3>${esc(app.name)} <small>v${esc(app.version)}</small></h3><p>${NOTES[app.id]||esc(app.description)}</p></div></div>`).join('');
}).catch(()=>{$('app-docs').textContent='The app list could not be loaded.';});

// ── explorer ──────────────────────────────────────────
const art=(a,b)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx=".3" cy=".25" r="1"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="#05030f"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>`)}`;
const DATA={
  pc:'Desk PC',count:3,loading:false,cpu:.42,memory:.63,temperature:58,artwork:art('#7f88ff','#3540ff'),
  song:{id:'night-drive',title:'Night Drive',artist:'Ghost Signal',current:37,duration:168,playing:true},
  songs:[{id:1,title:'Night Drive',artist:'Ghost Signal',image:art('#7f88ff','#3540ff')},{id:2,title:'Low Tide',artist:'Paper Moons',image:art('#ffb36b','#d9480f')},{id:3,title:'Neon Rain',artist:'Kilowatt',image:art('#63e6be','#0b7285')}],
  items:[{id:1,title:'Water the plants',created:Date.now()/1000-600},{id:2,title:'Call back',created:Date.now()/1000-7200}],
  people:[{id:1,name:'Ada',speaking:true},{id:2,name:'Linus',speaking:false},{id:3,name:'Grace',speaking:false}],
  load:[.2,.35,.3,.55,.48,.62,.42,.7,.58,.66,.5,.44],
  lyrics:[{time:30,text:'Headlights on the empty road'},{time:34,text:'Every sign is glowing blue'},{time:38,text:'Radio hums a song I know'},{time:42,text:'Drive until the night is through'}],
};
const EXAMPLES={
  layers:{type:'layers',alignment:'bottomLeading',children:[{type:'image',src:'$artwork',height:150,corner:20},{type:'badge',text:'Now playing',symbol:'music.note',variant:'glass',padding:10}]},
  split:{type:'split',ratio:.55,children:[{type:'card',children:[{type:'text',text:'Left pane',style:'headline'},{type:'text',text:'58% of the width in landscape',color:'secondary'}]},{type:'card',children:[{type:'text',text:'Right pane',style:'headline'}]}]},
  scroll:{type:'scroll',axis:'horizontal',spacing:12,children:[{type:'each',items:'$songs',as:'song',template:{type:'stack',spacing:6,width:120,children:[{type:'image',src:'$song.image',height:120,corner:14},{type:'text',text:'$song.title',style:'subheadline',weight:'semibold'},{type:'text',text:'$song.artist',style:'caption',color:'secondary'}]}}]},
  grid:{type:'grid',columns:3,children:[{type:'stat',label:'CPU',value:'{{cpu|percent}}',symbol:'cpu',progress:'$cpu'},{type:'stat',label:'Memory',value:'{{memory|percent}}',symbol:'memorychip',progress:'$memory'},{type:'stat',label:'GPU',value:'{{temperature}}°',symbol:'thermometer'}]},
  list:{type:'list',children:[{type:'row',title:'Night Drive',subtitle:'Ghost Signal',symbol:'music.note',accessory:'chevron'},{type:'row',title:'Volume',symbol:'speaker.wave.2.fill',value:'64%',tint:'orange'}]},
  section:{type:'section',title:'Up next',footer:'Songs after the current one.',children:[{type:'each',items:'$songs',as:'song',template:{type:'row',title:'$song.title',subtitle:'$song.artist',image:'$song.image'}}]},
  card:{type:'card',spacing:6,children:[{type:'label',text:'Desk PC',symbol:'desktopcomputer',style:'headline'},{type:'text',text:'Connected over Wi-Fi',color:'secondary'}]},
  if:{type:'if',test:{gt:['$count',0]},then:{type:'text',text:'{{count}} hellos',style:'title2'},else:{type:'text',text:'No hellos yet'}},
  spacer:{type:'stack',axis:'horizontal',fill:'width',children:[{type:'text',text:'Left'},{type:'spacer'},{type:'text',text:'Right',color:'secondary'}]},
  divider:{type:'stack',spacing:8,fill:'width',children:[{type:'text',text:'Above'},{type:'divider'},{type:'text',text:'Below'}]},
  text:{type:'text',text:'**Kit** draws _native_ text with `markdown`.',style:'title2',markdown:true},
  label:{type:'label',text:'$pc',symbol:'desktopcomputer',glass:true,shape:'capsule',padding:[10,16]},
  symbol:{type:'stack',axis:'horizontal',spacing:18,children:[{type:'symbol',name:'music.note',size:28},{type:'symbol',name:'heart.fill',size:28,color:'pink'},{type:'symbol',name:'mic.fill',size:28,slash:true,color:'red'}]},
  image:{type:'image',src:'$artwork',width:180,height:180,corner:22},
  gallery:{type:'gallery',images:['$songs.0.image','$songs.1.image','$songs.2.image']},
  video:{type:'video',src:'https://example.com/clip.mp4',poster:'$artwork',height:180,corner:18},
  media:{type:'media',image:'$artwork',video:'https://example.com/clip.mp4',badge:'Video',badgeSymbol:'play.fill',height:180,corner:18},
  badge:{type:'stack',axis:'horizontal',children:[{type:'badge',text:'Live',symbol:'dot.radiowaves.left.and.right',tint:'red'},{type:'badge',text:'Glass',variant:'glass'},{type:'badge',text:'Plain',variant:'plain',tint:'green'}]},
  stat:{type:'stat',label:'Processor',value:'{{cpu|percent}}',symbol:'cpu',progress:'$cpu',width:240},
  progress:{type:'stack',spacing:16,fill:'width',children:[{type:'progress',value:.64,label:'Downloading update'},{type:'progress',label:'Loading'}]},
  gauge:{type:'stack',axis:'horizontal',spacing:20,children:[{type:'gauge',value:'$cpu',label:'CPU'},{type:'gauge',value:'$temperature',min:20,max:100,text:'{{temperature}}°',label:'GPU',tint:'orange'}]},
  chart:{type:'chart',values:'$load',kind:'area',tint:'teal'},
  avatar:{type:'stack',axis:'horizontal',spacing:12,children:[{type:'each',items:'$people',as:'p',template:{type:'avatar',text:'$p.name',size:52,ring:'$p.speaking',dimmed:{not:'$p.speaking'}}}]},
  row:{type:'section',children:[{type:'row',title:'Night Drive',subtitle:'Ghost Signal',image:'$artwork',value:'2:48',accessory:'chevron'},{type:'row',title:'Forget phones',symbol:'xmark',role:'destructive',tint:'red'}]},
  comment:{type:'stack',fill:'width',children:[{type:'comment',author:'ghost_signal',body:'The island morph is so smooth.',meta:'2h',score:128},{type:'comment',author:'kilowatt',body:'Agreed, and it snaps to any edge.',meta:'1h',score:41,depth:1}]},
  empty:{type:'empty',symbol:'music.note',title:'Nothing playing',message:'Pick a song on the left, or open YouTube Music on the PC.'},
  lyrics:{type:'lyrics',lines:'$lyrics',timeline:'main',synced:true},
  clock:{type:'clock',face:'digital',hours24:true,date:true,size:72},
  web:{type:'web',src:'ui/chart.html',props:{title:'Last hellos'},fill:'both'},
  button:{type:'stack',axis:'horizontal',spacing:10,children:[{type:'button',label:'Play',symbol:'play.fill',variant:'prominent',action:{command:'play'}},{type:'button',label:'Queue',variant:'bordered',action:{command:'queue',value:'$song.id'}},{type:'button',symbol:'plus',variant:'glass',action:[{haptic:'light'},{command:'add',value:1}]},{type:'button',label:'Leave',role:'destructive',tint:'red',action:{command:'leave'}}]},
  pill:{type:'pill',children:[{type:'button',symbol:'backward.fill',variant:'plain',action:{command:'previous'}},{type:'button',symbol:'pause.fill',variant:'plain',action:{command:'pause'}},{type:'button',symbol:'forward.fill',variant:'plain',action:{command:'next'}}]},
  menu:{type:'menu',label:'Sort',symbol:'arrow.up',variant:'glass',chevron:true,items:[{label:'Hot',action:{set:'sort',value:'hot'},checked:{eq:['$ui.sort','hot']}},{label:'New',action:{set:'sort',value:'new'},checked:{eq:['$ui.sort','new']}},{label:'Top',action:{set:'sort',value:'top'},checked:{eq:['$ui.sort','top']}}]},
  toggle:{type:'section',children:[{type:'toggle',label:'Mute',symbol:'mic.slash.fill',value:'$ui.muted',action:[{set:'muted',value:'$value'},{command:'mute',value:'$value'}]},{type:'toggle',label:'Deafen',symbol:'headphones',value:'$ui.deaf',action:{set:'deaf',value:'$value'}}]},
  slider:{type:'slider',label:'Volume',symbol:'speaker.wave.2.fill',value:'$ui.volume',min:0,max:100,step:1,action:[{set:'volume',value:'$value'},{command:'volume',value:'$value'}]},
  stepper:{type:'stepper',label:'{{ui.size}} px text',value:'$ui.size',min:10,max:30,action:{set:'size',value:'$value'}},
  picker:{type:'picker',value:'$ui.page',options:[{value:'overview',label:'Overview'},{value:'temperatures',label:'Temperatures'},{value:'network',label:'Network'}],action:{set:'page',value:'$value'}},
  field:{type:'field',bind:'query',placeholder:'Search YouTube Music',symbol:'magnifyingglass',submit:{command:'search',value:'$ui.query'},clearable:true},
  link:{type:'link',label:'Open the Developer Portal',url:'https://discord.com/developers/applications',symbol:'safari'},
};
const STATE={muted:false,deaf:true,volume:64,size:16,page:'overview',query:'',sort:'hot',panel:1};
const CENTERED=new Set(['symbol','image','gauge','clock','empty','button','pill','menu','badge','avatar','stat','label','text','if']);

let KIT,current,state,example,dataText=JSON.stringify(DATA,null,2),tab='code';
const log=(text,cls='')=>{const el=$('ex-log');el.insertAdjacentHTML('beforeend',`<div class="${cls}">${esc(text)}</div>`);el.scrollTop=el.scrollHeight;};
const exampleFor=type=>KIT.COMPONENTS[type].example||EXAMPLES[type]||{type};

function draw(){
  const canvas=$('ex-canvas');let data;
  try{data=JSON.parse(dataText);}catch{data=DATA;}
  const scope={...data,ui:state};
  const ctx={actions:{}};
  canvas.classList.toggle('center',CENTERED.has(current));
  canvas.innerHTML=`<div class="k k-stack" style="flex-direction:column;gap:12px;align-items:${CENTERED.has(current)?'center':'stretch'};min-height:100%;justify-content:${CENTERED.has(current)?'center':'flex-start'}">${render(example,scope,ctx)}</div>`;
  canvas.onclick=e=>{
    const el=e.target.closest('[data-k-act]');if(!el||el.matches('input'))return;
    const a=ctx.actions[el.dataset.kAct];if(!a)return;
    run(a.action,a.scope,state,log);draw();
  };
  canvas.onchange=e=>{
    const el=e.target.closest('input[data-k-act]');if(!el)return;
    const a=ctx.actions[el.dataset.kAct];run(a.action,a.scope,state,log,+el.value);draw();
  };
  canvas.oninput=e=>{
    if(e.target.dataset.kBind)state[e.target.dataset.kBind]=e.target.value;
    // Sliders: the filled part of the Android track follows the thumb.
    if(e.target.type==='range'){const t=e.target,p=(t.value-t.min)/((t.max-t.min)||1)*100;t.parentElement.style.setProperty('--p',p+'%');}
  };
  canvas.onkeydown=e=>{if(e.key==='Enter'&&e.target.dataset.kBind!=null){const s=example.submit||findSubmit(example);if(s){run(s,scope,state,log);}}};
}
const findSubmit=node=>{if(!node||typeof node!=='object')return null;if(node.type==='field')return node.submit;for(const v of Object.values(node)){const f=Array.isArray(v)?v.map(findSubmit).find(Boolean):typeof v==='object'?findSubmit(v):null;if(f)return f;}return null;};

function typeLabel(prop){
  if(prop.type==='enum')return 'enum';
  return prop.type;
}
function side(type){
  const spec=KIT.COMPONENTS[type];
  const props=Object.entries(spec.props);
  $('ex-side').innerHTML=`<h4>About</h4><p>${esc(spec.doc)}</p>
    <h4>Props${props.length?` · ${props.length}`:''}</h4>
    ${props.length?props.map(([name,p])=>`<div class="prop"><header><code>${esc(name)}</code>${p.required?'<span class="req">required</span>':''}<span class="type">${esc(typeLabel(p))}</span></header>${p.doc?`<p>${esc(p.doc)}</p>`:''}${p.type==='enum'?`<div class="vals">${p.values.map(v=>`<button type="button" data-prop="${esc(name)}" data-val="${esc(v)}" title="Set ${esc(name)} to ${esc(v)}">${esc(v)}</button>`).join('')}</div>`:''}</div>`).join(''):'<p>No props of its own.</p>'}
    <h4 class="also">Also accepts</h4><p class="also">${Object.keys(KIT.COMMON).map(k=>`<code>${esc(k)}</code>`).join(' ')}</p>`;
}
$('ex-side').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.prop){
    // Set an enum value on the first component of this type in the example.
    const find=node=>{if(!node||typeof node!=='object')return null;if(node.type===current)return node;for(const v of Object.values(node)){const f=Array.isArray(v)?v.map(find).find(Boolean):typeof v==='object'?find(v):null;if(f)return f;}return null;};
    const target=find(example)||example;target[b.dataset.prop]=b.dataset.val;
    $('ex-json').value=JSON.stringify(example,null,2);draw();
  }
});

// iPhone or Android: the preview frame takes that phone's look (CSS under [data-platform]).
function platform(name){
  $('ex-phone').dataset.platform=name;
  document.querySelectorAll('.ex-platform button').forEach(b=>b.setAttribute('aria-checked',b.dataset.platform===name));
  try{localStorage.setItem('winmore-platform',name);}catch{}
}
document.querySelector('.ex-platform').addEventListener('click',e=>{const b=e.target.closest('button[data-platform]');if(b)platform(b.dataset.platform);});
try{const saved=localStorage.getItem('winmore-platform');if(saved==='android'||saved==='ios')platform(saved);}catch{}

function select(type,push=true){
  current=type;state={...STATE};
  example=JSON.parse(JSON.stringify(exampleFor(type)));
  $('ex-name').textContent=type;$('ex-group').textContent=KIT.COMPONENTS[type].group;
  $('ex-json').value=JSON.stringify(example,null,2);$('ex-err').hidden=true;
  document.querySelectorAll('#ex-items button').forEach(b=>b.setAttribute('aria-current',b.dataset.type===type));
  side(type);draw();
  if(push)history.replaceState(null,'',`#explorer/${type}`);
}
function list(filter=''){
  const q=filter.trim().toLowerCase(),groups={};
  for(const [type,spec] of Object.entries(KIT.COMPONENTS)){
    if(q&&!type.includes(q)&&!(spec.doc||'').toLowerCase().includes(q)&&!Object.keys(spec.props).some(p=>p.toLowerCase().includes(q)))continue;
    (groups[spec.group]||=[]).push(type);
  }
  $('ex-items').innerHTML=Object.entries(groups).map(([g,types])=>`<b>${esc(g)}</b>`+types.map(t=>`<button type="button" data-type="${t}" aria-current="${t===current}">${t}<small>${Object.keys(KIT.COMPONENTS[t].props).length||''}</small></button>`).join('')).join('')||'<p style="padding:10px;color:var(--ink-3);font-size:13px">No component matches.</p>';
}
$('ex-items').addEventListener('click',e=>{const b=e.target.closest('button[data-type]');if(b)select(b.dataset.type);});
$('ex-search').addEventListener('input',e=>list(e.target.value));
$('ex-json').addEventListener('input',e=>{
  try{
    const parsed=JSON.parse(e.target.value);
    if(tab==='data'){dataText=e.target.value;}else example=parsed;
    $('ex-err').hidden=true;draw();
  }catch(err){$('ex-err').hidden=false;$('ex-err').textContent=err.message.replace(/^JSON\.parse: /,'').slice(0,80);}
});
$('ex-json').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();document.execCommand?.('insertText',false,'  ');}});
document.querySelector('.ex-tabs').addEventListener('click',e=>{
  const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;
  document.querySelectorAll('.ex-tabs button').forEach(x=>x.setAttribute('aria-selected',x===b));
  $('ex-code').hidden=tab==='log';$('ex-log').hidden=tab!=='log';
  if(tab==='code')$('ex-json').value=JSON.stringify(example,null,2);
  if(tab==='data')$('ex-json').value=dataText;
  $('ex-err').hidden=true;
});

// ── reference tables ──────────────────────────────────
function reference(){
  const C={primary:'#f5f5f7',secondary:'#98989f',tertiary:'#5a5a5f',accent:'#0a84ff',background:'#000',card:'#1c1c1e',white:'#fff',black:'#000',clear:'transparent',red:'#ff453a',orange:'#ff9f0a',yellow:'#ffd60a',green:'#30d158',mint:'#63e6e2',teal:'#40c8e0',cyan:'#64d2ff',blue:'#0a84ff',indigo:'#5e5ce6',purple:'#bf5af2',pink:'#ff375f',brown:'#ac8e68',gray:'#8e8e93'};
  const tabs={
    Actions:`<table><thead><tr><th>Action</th><th>What it does</th></tr></thead><tbody>${Object.entries(KIT.ACTIONS).map(([k,a])=>`<tr><td><code>${esc(k)}</code></td><td>${esc(a.doc)}</td></tr>`).join('')}</tbody></table>`,
    Operators:`<table><thead><tr><th>Operator</th><th>Meaning</th></tr></thead><tbody>${Object.entries(KIT.OPERATORS).map(([k,d])=>`<tr><td><code>{"${esc(k)}": …}</code></td><td>${esc(typeof d==='string'?d:d.doc||'')}</td></tr>`).join('')}</tbody></table>`,
    Filters:`<p>Use them in templates: <code>"{{size|bytes}}"</code>.</p><div class="swatches">${KIT.FILTERS.map(f=>`<span class="swatch" style="padding-left:10px">|${esc(f)}</span>`).join('')}</div>`,
    Colors:`<p>Any prop typed <em>color</em> takes one of these names or a hex value like <code>#FF8800</code>.</p><div class="swatches">${KIT.COLORS.map(c=>`<span class="swatch"><i style="background:${C[c]||c}"></i>${esc(c)}</span>`).join('')}</div>`,
    Screen:`<table><thead><tr><th>Prop</th><th>Meaning</th></tr></thead><tbody>${Object.entries(KIT.SCREEN).map(([k,p])=>`<tr><td><code>${esc(k)}</code>${p.required?' <span class="req">required</span>':''}</td><td>${esc(p.doc||p.type)}</td></tr>`).join('')}</tbody></table>`,
    'Common props':`<table><thead><tr><th>Prop</th><th>Meaning</th></tr></thead><tbody>${Object.entries(KIT.COMMON).map(([k,p])=>`<tr><td><code>${esc(k)}</code></td><td>${esc(p.doc||p.type)}</td></tr>`).join('')}</tbody></table>`,
  };
  const names=Object.keys(tabs);
  $('ref-tabs').innerHTML=names.map((n,i)=>`<button type="button" role="tab" aria-selected="${!i}">${n}</button>`).join('');
  $('ref-body').innerHTML=tabs[names[0]];
  $('ref-tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;$('ref-tabs').querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',x===b));$('ref-body').innerHTML=tabs[b.textContent];};
}

fetch('data/kit.json').then(r=>r.json()).then(kit=>{
  KIT=kit;
  $('kit-count').textContent=`${Object.keys(kit.COMPONENTS).length} components`;
  const fromHash=location.hash.match(/^#explorer\/(\w+)/)?.[1];
  current=fromHash&&kit.COMPONENTS[fromHash]?fromHash:'button';
  list();select(current,false);reference();
  if(fromHash)requestAnimationFrame(()=>$('explorer').scrollIntoView({behavior:'instant'}));
});
})();
