(()=>{
'use strict';
const C=window.ViewerCore,$=id=>document.getElementById(id),frame=$('preview-frame');
const EXAMPLE={type:'screen',title:'Layout study',state:{playing:false,volume:.64,query:''},let:{trackCount:{count:'$tracks'}},bar:{leading:[{type:'label',text:'Studio / Desk',symbol:'desktopcomputer',style:'headline'}],trailing:[{type:'button',symbol:'gearshape',variant:'glass',action:{sheet:'settings'}}]},body:{type:'split',ratio:.43,spacing:20,children:[{type:'card',spacing:14,fill:'both',children:[{type:'badge',text:'YOUR DESKTOP, WITHIN REACH',variant:'plain'},{type:'text',text:'A good place\nto press play.',style:'largeTitle',weight:'medium'},{type:'text',text:'{{trackCount}} tracks. A little space to focus.',color:'secondary',style:'subheadline'},{type:'spacer'},{type:'stack',axis:'horizontal',spacing:10,children:[{type:'button',label:{if:['$ui.playing','Pause','Play something']},symbol:{if:['$ui.playing','pause.fill','play.fill']},variant:'prominent',action:{toggle:'playing'}},{type:'button',label:'Queue',action:{cover:'queue',params:{source:'Home'}}}]}]},{type:'stack',spacing:14,fill:'both',children:[{type:'text',text:'Made for the afternoon',style:'title3'},{type:'each',items:'$tracks',as:'track',template:{type:'row',title:'$track.title',subtitle:'$track.artist',symbol:'music.note',accessory:'chevron',action:{command:'play',value:'$track.id'}}},{type:'slider',label:'Volume',value:'$ui.volume',min:0,max:1,action:{set:'volume',value:'$value'}}]}]},sheets:{settings:{title:'Make it yours',body:{type:'stack',spacing:16,children:[{type:'text',text:'Try a local interaction.',style:'headline'},{type:'toggle',label:'Keep the music going',value:'$ui.playing',action:{toggle:'playing'}},{type:'field',placeholder:'Name this session',bind:'query'},{type:'text',text:'Session: {{ui.query}}',color:'secondary'}]}}},covers:{queue:{title:'Your queue',body:{type:'stack',spacing:16,children:[{type:'text',text:'Opened from {{params.source}}',style:'title2'},{type:'each',items:'$tracks',as:'track',template:{type:'row',title:'$track.title',subtitle:'$track.artist',symbol:'music.note'}},{type:'button',label:'Back to the studio',action:{dismiss:true}}]}}}};
const EXAMPLE_DATA={tracks:[{id:'night-drive',title:'Night Drive',artist:'Ghost Signal'},{id:'low-tide',title:'Low Tide',artist:'Paper Moons'},{id:'neon-rain',title:'Neon Rain',artist:'Kilowatt'}]};
let current=structuredClone(EXAMPLE),data=structuredClone(EXAMPLE_DATA),files=new Map(),manifest={},nodes=[],selected='screen.body',ready=false,kit=null,loadId=0,editTimer,activity=0;
let width=844,height=390,revision=0,validation=[];
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
function status(message,error=false){$('import-status').textContent=message;$('import-status').dataset.error=String(error);}
function editorStatus(message,error=false){$('editor-status').textContent=message;$('editor-status').dataset.error=String(error);}
function addLog(message){
  $('activity-log').querySelector('.activity-empty')?.remove();const li=el('li'),time=el('time',new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}));li.append(time,document.createTextNode(message));$('activity-log').prepend(li);
  while($('activity-log').children.length>150)$('activity-log').lastChild.remove();$('activity-count').textContent=String(++activity);
}
function assetEntries(){return [...files].filter(([p])=>/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(p));}
function send(reset=false,withAssets=false){
  if(!ready)return;
  frame.contentWindow.postMessage({kind:'onbun-viewer:render',screen:current,data,width,height,page:$('preview-page').value,outlines:$('show-outlines').checked,inspect:$('inspect-mode').checked,selected,reset,revision:++revision,...(withAssets?{assets:assetEntries()}: {})},'*');
}
function fit(){
  const area=$('preview-area'),scale=Math.min(1,(area.clientWidth-52)/width,(area.clientHeight-46)/height);
  const size=$('preview-size');size.style.width=`${width*scale}px`;size.style.height=`${height*scale}px`;frame.style.width=`${width}px`;frame.style.height=`${height}px`;frame.style.transform=`scale(${scale})`;
  $('preview-scale').textContent=`${Math.round(scale*100)}%`;$('viewport-label').textContent=`${width} × ${height} · ${width>height?'landscape':'portrait'}`;
}
function tree(){
  validation=window.KitSpec?.validateScreen(current)||[];
  nodes=C.tree(current);$('node-count').textContent=String(nodes.length);const q=$('tree-search').value.trim().toLowerCase();$('component-tree').replaceChildren();
  for(const node of nodes){
    if(q&&!`${node.type} ${node.label} ${node.path}`.toLowerCase().includes(q))continue;
    const b=el('button',node.type);b.type='button';b.dataset.path=node.path;b.style.setProperty('--indent',`${7+Math.min(node.depth,7)*10}px`);b.setAttribute('aria-current',String(node.path===selected));b.title=node.path;
    if(node.label)b.append(el('small',node.label.slice(0,45)));$('component-tree').append(b);
  }
  if(!$('component-tree').children.length)$('component-tree').append(el('p','No matching components.'));
  inspect();notes();
}
function inspect(measure,resolved){
  const node=nodes.find(n=>n.path===selected)||nodes[0];if(!node)return;selected=node.path;
  const target=$('node-inspector');target.replaceChildren(el('h3',node.type),el('p',node.path,'node-path'));
  if(measure)target.append(el('p',`${Math.round(measure.width)} × ${Math.round(measure.height)} px rendered · x ${Math.round(measure.x)}, y ${Math.round(measure.y)}`));
  const spec=kit?.COMPONENTS?.[node.type];if(spec?.doc)target.append(el('p',spec.doc));
  const dl=el('dl',undefined,'viewer-props');
  for(const [k,v] of Object.entries(node.node)){
    if(['children','body','sheets','covers','template','then','else','empty','__viewerPath'].includes(k))continue;
    const row=el('div');row.append(el('dt',k),el('dd',typeof v==='string'?v:JSON.stringify(v,null,2)));
    if(resolved&&Object.hasOwn(resolved,k)&&JSON.stringify(resolved[k])!==JSON.stringify(v))row.append(el('dd','Resolved: '+JSON.stringify(resolved[k])));
    const doc=spec?.props?.[k]?.doc||kit?.COMMON?.[k]?.doc;if(doc)row.append(el('p',doc));dl.append(row);
  }
  target.append(dl);if(node.type==='screen')target.append(el('p','Select a component in Structure, or enable Inspect and click the preview.'));
}
function notes(extra=[]){
  const warnings=new Set(extra);
  validation.forEach(message=>warnings.add('Kit validation · '+message));
  if(nodes.some(n=>n.type==='each'))warnings.add('Repeated content needs matching arrays in Mock data. The browser does not call data().');
  if(nodes.some(n=>n.type==='web'))warnings.add('Web blocks are placeholders. Packaged HTML and scripts are never executed.');
  if(nodes.some(n=>['video','media','scrubber','lyrics','clock'].includes(n.type)))warnings.add('Media and time-based components are illustrative; playback and native timing are not simulated.');
  if(!files.size&&nodes.some(n=>['image','avatar','gallery'].includes(n.type)))warnings.add('Import a folder or .wmapp to include local image assets.');
  if(kit){const unknown=[...new Set(nodes.map(n=>n.type))].filter(t=>t!=='screen'&&!Object.hasOwn(kit.COMPONENTS,t));if(unknown.length)warnings.add(`Unknown components shown as placeholders: ${unknown.join(', ')}.`);}
  warnings.add('The preview has its own web style. Native fonts, symbols and controls will differ on phones.');
  $('preview-notes').replaceChildren(...[...warnings].slice(0,20).map(x=>el('li',x)));$('warning-count').textContent=`(${warnings.size})`;
}
function pages(){
  const old=$('preview-page').value;const entries=[['screen','Main screen'],...Object.keys(current.sheets||{}).map(k=>['sheet:'+k,'Sheet / '+k]),...Object.keys(current.covers||{}).map(k=>['cover:'+k,'Cover / '+k])];
  $('preview-page').replaceChildren(...entries.map(([value,label])=>{const option=el('option',label);option.value=value;return option;}));
  $('preview-page').value=entries.some(([v])=>v===old)?old:'screen';
}
function install(result,label){
  current=result.screen;files=result.files||new Map();manifest=result.manifest||{};data={};selected='screen.body';
  $('screen-json').value=JSON.stringify(current,null,2);$('mock-data').value='{}';$('app-name').textContent=manifest.name||current.title||'Untitled screen';$('app-source').textContent=label;
  $('preview-page').value='screen';pages();tree();send(true,true);editorStatus('Ready · edit JSON or add mock data to explore bindings.');
  status(`Opened ${label}${manifest.name?' · '+manifest.name:''}. ${files.size} local files. Add Mock data for backend-driven content.`);
}
async function importFile(file){
  const ticket=++loadId;if(!file)return;status(`Reading ${file.name} locally…`);
  try{
    if(file.size>C.MAX_BYTES*1.4)throw Error('File exceeds the 80 MB package limit.');
    const raw=C.json(await file.text(),file.name);if(ticket!==loadId)return;
    if(file.name.toLowerCase().endsWith('.wmapp')||raw?.format==='winmore-app')install(C.bundle(raw),file.name);
    else install({screen:C.screen(raw),files:new Map(),manifest:{}},file.name);
  }catch(e){if(ticket===loadId)status(e.message+' Your previous preview is still available.',true);}
}
async function importFolder(entries,label='App folder'){
  const ticket=++loadId;status('Reading the folder locally…');
  try{
    if(!entries.length)throw Error('No readable files found.');if(entries.length>C.MAX_FILES)throw Error('Folder has too many files (maximum 4,000).');
    if(entries.reduce((n,x)=>n+x.file.size,0)>C.MAX_BYTES)throw Error('Folder exceeds the 80 MB preview limit.');
    const paths=entries.map(x=>x.path.replace(/^\//,''));let prefix='';
    const root=paths[0].split('/')[0];if(paths.every(p=>p.startsWith(root+'/')))prefix=root+'/';
    const result=new Map();
    for(let i=0;i<entries.length;i++){
      const p=C.path(paths[i].slice(prefix.length));result.set(p,new Uint8Array(await entries[i].file.arrayBuffer()));
    }
    if(ticket===loadId)install(C.fromFiles(result),label);
  }catch(e){if(ticket===loadId)status(e.message+' Your previous preview is still available.',true);}
}
async function droppedEntry(entry,prefix='',out=[]){
  if(out.length>=C.MAX_FILES)throw Error('Folder has too many files.');
  if(entry.isFile){const file=await new Promise((ok,no)=>entry.file(ok,no));out.push({path:prefix+entry.name,file});}
  else if(entry.isDirectory){const reader=entry.createReader();for(;;){const batch=await new Promise((ok,no)=>reader.readEntries(ok,no));if(!batch.length)break;for(const child of batch)await droppedEntry(child,prefix+entry.name+'/',out);}}
  return out;
}
$('open-file').onclick=()=>$('file-input').click();$('open-folder').onclick=()=>$('folder-input').click();
$('file-input').onchange=e=>{importFile(e.target.files[0]);e.target.value='';};
$('folder-input').onchange=e=>{importFolder([...e.target.files].map(file=>({file,path:file.webkitRelativePath||file.name})));e.target.value='';};
const zone=$('drop-zone');
for(const name of ['dragenter','dragover'])zone.addEventListener(name,e=>{e.preventDefault();zone.classList.add('dragover');});
zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('dragover');});
zone.addEventListener('drop',async e=>{
  e.preventDefault();zone.classList.remove('dragover');
  const items=[...e.dataTransfer.items],entries=items.map(x=>x.webkitGetAsEntry?.()).filter(Boolean),plain=[...e.dataTransfer.files];
  try{if(entries.some(x=>x.isDirectory)){let all=[];for(const entry of entries)await droppedEntry(entry,'',all);await importFolder(all);}else if(plain.length===1)await importFile(plain[0]);else if(plain.length)await importFolder(plain.map(file=>({file,path:file.name})));}catch(err){status(err.message,true);}
});
$('load-example').onclick=()=>{loadId++;install({screen:structuredClone(EXAMPLE),files:new Map(),manifest:{}},'Example screen');data=structuredClone(EXAMPLE_DATA);$('mock-data').value=JSON.stringify(data,null,2);send(true);status('Example loaded. Try the Queue and settings buttons, then rotate the viewport.');};
function edit(){
  clearTimeout(editTimer);editTimer=setTimeout(()=>{
    try{const next=C.screen(C.json($('screen-json').value,'Screen JSON')),mock=C.json($('mock-data').value,'Mock data');if(!C.object(mock))throw Error('Mock data must be a JSON object.');current=next;data=mock;$('app-name').textContent=manifest.name||current.title||'Untitled screen';pages();tree();send(true);editorStatus('Updated · valid JSON. Preview interpretation is approximate.');}
    catch(e){editorStatus(e.message+' The last valid preview is still shown.',true);}
  },250);
}
for(const id of ['screen-json','mock-data']){
  $(id).addEventListener('input',edit);$(id).addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const start=e.target.selectionStart,end=e.target.selectionEnd;e.target.setRangeText('  ',start,end,'end');edit();}});
}
$('open-data').onclick=()=>$('data-input').click();$('data-input').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>5*1024*1024)throw Error('Mock data is limited to 5 MB.');const obj=C.json(await file.text(),file.name);if(!C.object(obj))throw Error('Mock data must be a JSON object.');$('mock-data').value=JSON.stringify(obj,null,2);edit();}catch(err){editorStatus(err.message,true);}};
function tab(name){document.querySelectorAll('[data-tab]').forEach(b=>{const on=b.dataset.tab===name;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;$(b.dataset.tab+'-panel').hidden=!on;});}
document.querySelector('.viewer-editor-tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b)tab(b.dataset.tab);};
document.querySelector('.viewer-editor-tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...document.querySelectorAll('[data-tab]')],index=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowLeft'?2:1))%3;tab(buttons[next].dataset.tab);buttons[next].focus();};
$('tree-search').oninput=tree;$('component-tree').onclick=e=>{const b=e.target.closest('[data-path]');if(b){selected=b.dataset.path;tree();send();}};
$('viewport').onchange=e=>{if(e.target.value!=='custom'){[width,height]=e.target.value.split(',').map(Number);dimensions();}};
function dimensions(){ $('viewport-width').value=width;$('viewport-height').value=height;fit();send();}
for(const id of ['viewport-width','viewport-height'])$(id).onchange=()=>{width=Math.max(240,Math.min(1600,Number($('viewport-width').value)||844));height=Math.max(240,Math.min(1600,Number($('viewport-height').value)||390));$('viewport').value='custom';dimensions();};
$('rotate').onclick=()=>{[width,height]=[height,width];$('viewport').value='custom';dimensions();};
for(const id of ['show-outlines','inspect-mode'])$(id).onchange=()=>send();
$('preview-page').onchange=()=>send();$('reset-state').onclick=()=>{send(true);addLog('Reset screen variables to their initial values.');};
$('download-json').onclick=()=>{
  try{const parsed=C.screen(C.json($('screen-json').value,'Screen JSON'));const url=URL.createObjectURL(new Blob([JSON.stringify(parsed,null,2)+'\n'],{type:'application/json'}));const a=el('a');a.href=url;a.download='screen.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){editorStatus(e.message,true);}
};
$('clear-log').onclick=()=>{$('activity-log').replaceChildren(el('li','Try a button or change a control to see its action.','activity-empty'));activity=0;$('activity-count').textContent='0';};
window.addEventListener('message',e=>{
  if(e.source!==frame.contentWindow||!e.data?.kind?.startsWith('onbun-viewer:'))return;const m=e.data;
  if(m.kind==='onbun-viewer:ready'){ready=true;send(true,true);fit();}
  if(m.kind==='onbun-viewer:log')addLog(String(m.message));
  if(m.kind==='onbun-viewer:state')$('live-state').textContent=JSON.stringify(m.state,null,2);
  if(m.kind==='onbun-viewer:notes')notes(m.notes);
  if(m.kind==='onbun-viewer:select'){selected=m.path;tree();inspect(m.measure,m.resolved);}
  if(m.kind==='onbun-viewer:page'&&[...$('preview-page').options].some(o=>o.value===m.page))$('preview-page').value=m.page;
  if(m.kind==='onbun-viewer:error')editorStatus('Preview: '+m.message,true);
});
new ResizeObserver(fit).observe($('preview-area'));
fetch('data/kit.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{kit=value;tree();}).catch(()=>notes(['Component descriptions are unavailable; the viewer still works.']));
$('screen-json').value=JSON.stringify(current,null,2);$('mock-data').value=JSON.stringify(data,null,2);pages();tree();fit();
// The sandbox can finish loading before the host has attached its listener.
frame.contentWindow.postMessage({kind:'onbun-viewer:init'},'*');
})();
