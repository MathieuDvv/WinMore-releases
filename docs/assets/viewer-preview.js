/* The preview runs in an opaque-origin sandbox. It cannot access the host page or network. */
(()=>{
'use strict';
const C=window.ViewerCore,K=window.KitRender,app=document.getElementById('app');
const post=(kind,rest={})=>parent.postMessage({kind:'onbun-viewer:'+kind,...rest},'*');
let config,state=Object.create(null),assets=new Map(),ctx,screen,params=null,pages=[],notes=new Set(),budget=0,actionSequence=0,instances=new Map();
const clone=v=>v==null?v:structuredClone(v),isObject=C.object;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function report(s){post('log',{message:s});}
function scope(page){
  const s={...config.data,data:config.data,ui:state,params,env:{width:config.width,height:config.height,landscape:config.width>config.height,connected:true,error:null,platform:'web'}};
  for(const [k,v] of Object.entries(screen.let||{}))s[k]=C.resolve(v,s);
  for(const [k,v] of Object.entries(page?.let||{}))s[k]=C.resolve(v,s);
  return s;
}
const mime=p=>/\.svg$/i.test(p)?'image/svg+xml':/\.png$/i.test(p)?'image/png':/\.jpe?g$/i.test(p)?'image/jpeg':/\.webp$/i.test(p)?'image/webp':/\.avif$/i.test(p)?'image/avif':'image/gif';
function image(src){
  if(typeof src!=='string'||!src)return '';
  const p=src.replace(/^\.\//,'');if(assets.has(p))return assets.get(p);
  if(/^data:image\/(png|jpeg|gif|webp|avif|svg\+xml)[;,]/i.test(src))return src;
  notes.add(/^https?:/i.test(src)?'Remote images are blocked to keep your preview local. Use packaged images to test artwork.':`Image unavailable: ${src.slice(0,100)}.`);return '';
}
const keep=new Set(['children','template','then','else','empty','action','longPress','doubleTap','submit','items','options','__viewerPath']);
function evaluate(value,s){
  const result=C.resolve(value,s);
  if(result===undefined&&typeof value==='string'&&/^\$[\w.[\]]+$/.test(value))notes.add(`Unresolved binding ${value}. Add a representative value in Mock data or screen state.`);
  return result;
}
function prepare(original,s){
  if(++budget>6000)throw Error('Preview stopped after 6,000 components. Reduce repeated content or mock data.');
  const n={...original};
  n.__viewerInstance=String(budget);instances.set(n.__viewerInstance,{node:original,scope:s});
  for(const [k,v] of Object.entries(n))if(!keep.has(k))n[k]=evaluate(v,s);
  for(const k of ['src','image','poster'])if(n[k]&&n.type!=='web')n[k]=image(n[k]);
  if(n.images){const list=C.resolve(n.images,s);n.images=Array.isArray(list)?list.map(x=>typeof x==='string'?image(x):{...x,url:image(x?.url)}):[];}
  if(n.type==='each'){
    const list=evaluate(n.items,s);n.items=Array.isArray(list)?list.slice(0,500):[];
    if(Array.isArray(list)&&list.length>500)notes.add('A repeated list was limited to its first 500 items.');
  }
  if(n.type==='picker'){const list=C.resolve(n.options,s);n.options=Array.isArray(list)?list.map(o=>isObject(o)?Object.fromEntries(Object.entries(o).map(([k,v])=>[k,C.resolve(v,s)])):o):[];}
  if(n.type==='menu')n.items=menuItems(n.items,s);
  if(n.type==='split'&&!s.env.landscape){
    if(n.portrait==='first')n.children=n.children?.slice(0,1);else if(n.portrait==='second')n.children=n.children?.slice(1,2);
    n.type='stack';n.axis='vertical';n.fill=n.fill||'width';
  }
  if(n.height==='screen')n.height=Math.max(0,config.height-52-(Number(n.screenOffset)||0));
  if(n.gradient){const colors=Array.isArray(n.gradient)?n.gradient:[];if(colors.every(c=>/^#[a-f0-9]{6,8}$|^[a-z]+$/i.test(c)))n.background=`linear-gradient(135deg,${colors.join(',')})`;}
  if(n.type==='pager'){
    const index=n.bind?Number(state[n.bind])||0:Number(n.start)||0;
    n.children=n.children||[];n.start=Math.max(0,Math.min(n.children.length-1,index));
  }
  if(n.type==='stepper'){
    const value=Number(C.resolve(n.value,s))||0,step=Number(n.step)||1;
    n.value=Math.min(n.max??Infinity,Math.max(n.min??-Infinity,value));
    // KitRender builds the two local value actions; clamp them when they are run.
    n.step=step;
  }
  return n;
}
function menuItems(items,s,depth=0){
  if(depth>20)return [];
  const out=[];
  for(const item of Array.isArray(items)?items:[]){
    if(item.each){const list=C.resolve(item.each,s);if(Array.isArray(list))for(const row of list.slice(0,100))out.push(...menuItems([item.item],{...s,[item.as||'item']:row},depth+1));}
    else if(item.items)out.push(...menuItems(item.items,s,depth+1));
    else if(item.label)out.push({...item,label:C.resolve(item.label,s),checked:C.resolve(item.checked,s),action:bindAction(item.action,s)});
  }
  return out;
}
function bindAction(action,s){
  if(Array.isArray(action))return action.map(a=>bindAction(a,s));if(!isObject(action))return action;
  return Object.fromEntries(Object.entries(action).map(([k,v])=>[k,['then','else','onError'].includes(k)?bindAction(v,s):C.resolve(v,s)]));
}
function annotate(v,path='screen'){
  if(!v||typeof v!=='object')return;
  if(v.type)v.__viewerPath=path;
  for(const [k,x] of Object.entries(v))if(k!=='__viewerPath')if(Array.isArray(x))x.forEach((c,i)=>annotate(c,`${path}.${k}[${i}]`));else if(x&&typeof x==='object')annotate(x,`${path}.${k}`);
}
const tags=new Set(['DIV','SPAN','P','B','I','SMALL','STRONG','EM','CODE','HR','H6','BUTTON','LABEL','INPUT','DETAILS','SUMMARY','IMG','SVG','PATH','CIRCLE','RECT','POLYLINE','LINE','TITLE']);
function fragment(markup){
  const t=document.createElement('template');t.innerHTML=markup;
  for(const n of [...t.content.querySelectorAll('*')]){
    if(!tags.has(n.tagName.toUpperCase())){n.remove();continue;}
    for(const a of [...n.attributes]){
      const key=a.name.toLowerCase();
      if(!['class','style','title','type','value','placeholder','min','max','step','disabled','role','aria-label','aria-checked','alt','src','viewbox','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','pathlength','transform','vector-effect','d','cx','cy','r','x','y','width','height','rx','points','opacity','data-k-act','data-k-input','data-k-bind','data-viewer-path','data-viewer-instance'].includes(key))n.removeAttribute(a.name);
      if(key==='src'&&!/^data:image\//i.test(a.value)&&![...assets.values()].includes(a.value))n.removeAttribute('src');
    }
  }
  return t.content;
}
function renderNode(node,s){return fragment(K.render(node,s,ctx));}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
function component(node,s){
  if(node.type!=='pager')return;
  const children=node.children||[],key=node.bind||'__pager:'+node.__viewerPath;
  const page=Math.max(0,Math.min(children.length-1,Number(state[key]??node.start??0)));
  const action=value=>{const id=--actionSequence;ctx.actions[id]={scope:s,action:{set:key,value}};return `data-k-act="${id}"`;};
  return `<div class="k k-pager" data-viewer-path="${esc(node.__viewerPath)}">${K.render(children[page],s,ctx)}<div class="v-pager-controls"><button type="button" aria-label="Previous page" ${action(Math.max(0,page-1))}${page<=0?' disabled':''}>←</button><span>${page+1} / ${children.length}</span><button type="button" aria-label="Next page" ${action(Math.min(children.length-1,page+1))}${page>=children.length-1?' disabled':''}>→</button></div></div>`;
}
function pageView(page,s,{sheet=false,close=false}={}){
  const wrap=el('div',sheet?'v-sheet':'v-page');if(screen.chrome==='fullscreen'&&!sheet)wrap.classList.add('v-fullscreen');
  const bar=el('header','v-bar'),leading=el('div'),trailing=el('div');
  if(page.bar?.leading)leading.append(renderNode(page.bar.leading,s));else if(page.title||screen.title)leading.append(el('span','v-title',String(C.resolve(page.title||screen.title,s)??'')));
  if(page.bar?.trailing)trailing.append(renderNode(page.bar.trailing,s));
  if(close){const b=el('button','v-close','×');b.type='button';b.setAttribute('aria-label','Close page');b.onclick=()=>{pages.pop();params=pages.at(-1)?.params??null;syncPage();draw();};trailing.append(b);}
  bar.append(leading,trailing);wrap.append(bar);
  if(page.accessory){const accessory=el('div','v-accessory');accessory.append(renderNode(page.accessory,s));wrap.append(accessory);}
  const body=el('div','v-body');body.append(renderNode(page.body,s));wrap.append(body);return wrap;
}
function syncPage(){const p=pages.at(-1);post('page',{page:p?`${p.kind}:${p.name}`:'screen'});}
function draw(){
  if(!config)return;notes=new Set();budget=0;actionSequence=0;instances=new Map();ctx={actions:Object.create(null),resolve:evaluate,prepare,component};
  document.body.dataset.landscape=String(config.width>config.height);app.classList.toggle('v-outlines',!!config.outlines);app.classList.toggle('v-inspecting',!!config.inspect);
  const rail=el('nav','v-rail');rail.setAttribute('aria-label','App navigation placeholder');for(let i=0;i<4;i++)rail.append(el('span',i===1?'on':''));
  const top=pages.at(-1),lastCover=[...pages].reverse().find(p=>p.kind==='cover'),cover=lastCover?screen.covers?.[lastCover.name]:null;
  let view=pageView(cover||screen,scope(cover),{close:!!cover});app.replaceChildren(rail,view);
  if(top?.kind==='sheet'){
    const sheet=screen.sheets?.[top.name];if(sheet)view.append(pageView(sheet,scope(sheet),{sheet:true,close:true}));
  }
  for(const n of app.querySelectorAll('[data-viewer-path]'))if(n.dataset.viewerPath===config.selected)n.classList.add('v-selected');
  const selectedNode=app.querySelector('.v-selected');if(selectedNode)select(selectedNode);
  post('state',{state});post('notes',{notes:[...notes]});
}
function select(target){
  const r=target.getBoundingClientRect(),instance=instances.get(target.dataset.viewerInstance),node=instance?.node||C.tree(screen).find(n=>n.path===target.dataset.viewerPath)?.node;
  const resolved=node?Object.fromEntries(Object.entries(node).filter(([k])=>!keep.has(k)).map(([k,v])=>[k,C.resolve(v,instance?.scope||scope())])):{};
  post('select',{path:target.dataset.viewerPath,measure:{x:r.x,y:r.y,width:r.width,height:r.height},resolved});
}
function run(action,s,value,depth=0){
  if(depth>30){report('Action stopped: too deeply nested.');return;}
  for(const a of [].concat(action||[])){
    if(!isObject(a))continue;
    const resolve=v=>C.resolve(v,{...s,ui:state,value});
    if(Object.hasOwn(a,'set')){
      if(a.set==='__value'){value=resolve(a.value);continue;}
      if(typeof a.set==='string'){state[a.set]=clone(resolve(a.value));report(`set ${a.set} = ${JSON.stringify(state[a.set])}`);}
    }else if(typeof a.toggle==='string'){state[a.toggle]=!state[a.toggle];report(`toggle ${a.toggle} → ${state[a.toggle]}`);}
    else if(Object.hasOwn(a,'if'))run(resolve(a.if)?a.then:a.else,s,value,depth+1);
    else if(a.sheet||a.cover){
      const kind=a.sheet?'sheet':'cover',name=String(resolve(a[kind]));
      if(screen[kind+'s']?.[name]){if(pages.length>=20){report('Page limit reached. Close a page first.');continue;}params=resolve(a.params)??null;pages.push({kind,name,params});syncPage();report(`Open ${kind}: ${name}`);}
      else report(`Unknown ${kind}: ${name}`);
    }else if(a.dismiss){pages.pop();params=pages.at(-1)?.params??null;syncPage();report('Dismiss page');}
    else if(a.command){report(`command → PC: ${a.app?a.app+'.':''}${a.command}${a.value!==undefined?' '+JSON.stringify(resolve(a.value)):''} (preview only)`);if(a.result)notes.add(`Command result "${a.result}" is not simulated. Put a representative value in screen state.`);}
    else report(`${Object.keys(a)[0]}: ${JSON.stringify(resolve(Object.values(a)[0]))} (preview only)`);
  }
}
app.addEventListener('click',e=>{
  const target=e.target.closest('[data-viewer-path]');
  if(config?.inspect&&target){e.preventDefault();e.stopPropagation();config.selected=target.dataset.viewerPath;select(target);for(const n of app.querySelectorAll('.v-selected'))n.classList.remove('v-selected');target.classList.add('v-selected');return;}
  const n=e.target.closest('[data-k-act]');if(!n||n.matches('input')||n.disabled)return;const a=ctx.actions[n.dataset.kAct];if(a){run(a.action,a.scope);draw();}
});
app.addEventListener('change',e=>{const n=e.target.closest('input[data-k-act]'),a=n&&ctx.actions[n.dataset.kAct];if(a){run(a.action,a.scope,Number(n.value));draw();}});
app.addEventListener('input',e=>{
  const key=e.target.dataset.kBind;if(key!==undefined){state[key]=e.target.value;post('state',{state});
    // Update dependent labels without interrupting the focused text field.
    const pos=e.target.selectionStart,path=e.target.closest('[data-viewer-path]')?.dataset.viewerPath;draw();
    const next=[...app.querySelectorAll('[data-k-bind]')].find(n=>n.dataset.kBind===key&&(!path||n.closest('[data-viewer-path]')?.dataset.viewerPath===path));if(next){next.focus();next.setSelectionRange(pos,pos);}
  }
});
app.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.target.dataset.kBind===undefined)return;
  const node=C.tree(screen).find(n=>n.path===e.target.closest('[data-viewer-path]')?.dataset.viewerPath)?.node;
  if(node?.submit){run(node.submit,scope(),e.target.value);draw();}
});
window.addEventListener('message',e=>{
  if(e.source===parent&&e.data?.kind==='onbun-viewer:init'){post('ready');return;}
  if(e.source!==parent||e.data?.kind!=='onbun-viewer:render')return;
  try{
    const m=e.data,oldPage=config?.page;config=m;
    if(m.assets){for(const url of assets.values())URL.revokeObjectURL(url);assets=new Map(m.assets.map(([p,bytes])=>[p,URL.createObjectURL(new Blob([bytes],{type:mime(p)}))]));}
    screen=clone(C.screen(m.screen));annotate(screen);
    if(m.reset){state=Object.assign(Object.create(null),clone(screen.state||{}));pages=[];params=null;}
    if(m.reset||m.page!==oldPage){pages=[];params=null;if(m.page!=='screen'){const at=m.page.indexOf(':'),kind=m.page.slice(0,at),name=m.page.slice(at+1);if(screen[kind+'s']?.[name])pages=[{kind,name,params:null}];}}
    draw();
  }catch(err){app.replaceChildren(el('p','v-notice',err.message));post('error',{message:err.message});}
});
post('ready');
})();
