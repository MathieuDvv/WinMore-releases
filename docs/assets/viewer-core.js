/* Local-only package reader and expression helpers. No app code is evaluated. */
((root,factory)=>{const api=factory();if(typeof module==='object')module.exports=api;else root.ViewerCore=api;})(globalThis,()=>{
'use strict';
const MAX_BYTES=80*1024*1024,MAX_FILES=4000;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(v,k)=>v!=null&&Object.prototype.hasOwnProperty.call(v,k);
function path(value){
  if(typeof value!=='string'||!value||value.includes('\\')||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..')||/[\x00-\x1f:]/.test(value))throw Error('Unsafe package path.');
  return value;
}
function json(text,label='JSON'){
  try{return JSON.parse(text.replace(/^\uFEFF/,''));}catch(e){throw Error(`${label}: ${e.message}`);}
}
function screen(value){
  if(!object(value)||value.type!=='screen'||!object(value.body)||typeof value.body.type!=='string')throw Error('Expected a Kit screen: {"type":"screen", "body":{...}}.');
  let count=0;
  function visit(v,depth){if(depth>100||++count>50000)throw Error('Screen is too complex to preview (maximum depth 100).');if(v&&typeof v==='object')Object.values(v).forEach(c=>visit(c,depth+1));}
  visit(value,0);return value;
}
function fromFiles(files,manifest){
  if(!manifest&&files.has('manifest.json'))manifest=json(new TextDecoder().decode(files.get('manifest.json')),'manifest.json');
  if(manifest&&!object(manifest))throw Error('manifest.json must contain an object.');
  if(manifest?.ui&&manifest.ui!=='kit')throw Error('This app uses a web UI. The viewer accepts Kit JSON screens.');
  const location=manifest?.screen?path(manifest.screen):files.has('ui/screen.json')?'ui/screen.json':files.has('screen.json')?'screen.json':null;
  if(!location||!files.has(location))throw Error(`Screen not found${location?`: ${location}`:'. Choose an app folder with manifest.json or ui/screen.json'}.`);
  return {screen:screen(json(new TextDecoder().decode(files.get(location)),location)),manifest:manifest||{},files,location};
}
function bundle(raw){
  if(!object(raw)||raw.format!=='winmore-app'||raw.formatVersion!==1||!object(raw.files))throw Error('Not a supported .wmapp package (winmore-app version 1).');
  const entries=Object.entries(raw.files);if(entries.length>MAX_FILES)throw Error('Too many files in this package.');
  let total=0;const files=new Map();
  for(const [name,encoded] of entries){
    path(name);if(typeof encoded!=='string'||encoded.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw Error(`Invalid base64 file: ${name}`);
    total+=encoded.length*3/4;if(total>MAX_BYTES)throw Error('Package exceeds the 80 MB preview limit.');
    files.set(name,Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));
  }
  return fromFiles(files,files.has('manifest.json')?undefined:raw.manifest);
}
function get(value,name){return String(name).replace(/\[(\d+)\]/g,'.$1').split('.').filter(Boolean).reduce((v,k)=>own(v,k)?v[k]:undefined,value);}
const filters={
  count:v=>v?.length??0,upper:v=>String(v??'').toUpperCase(),lower:v=>String(v??'').toLowerCase(),json:v=>JSON.stringify(v),number:v=>Number(v||0).toLocaleString('en'),
  percent:v=>`${Math.round(Number(v||0)*100)}%`,duration:v=>`${Math.floor(Math.max(0,Number(v)||0)/60)}:${String(Math.floor(Math.max(0,Number(v)||0)%60)).padStart(2,'0')}`,
  bytes:v=>{let n=Number(v)||0,i=0;while(n>=1024&&i<3){n/=1024;i++;}return `${n.toFixed(i?1:0)} ${['B','KB','MB','GB'][i]}`;},
  age:v=>{const s=Math.max(0,Date.now()/1000-Number(v||0));return s<60?'now':s<3600?`${Math.floor(s/60)}m`:s<86400?`${Math.floor(s/3600)}h`:`${Math.floor(s/86400)}d`;},
  date:v=>new Date(Number(v)*1000).toLocaleDateString(),time:v=>new Date(Number(v)*1000).toLocaleTimeString()
};
function resolve(v,s){
  if(typeof v==='string'){
    if(v.startsWith('$$'))return v.slice(1);
    if(/^\$[\w.[\]]+$/.test(v))return get(s,v.slice(1));
    return v.replace(/\{\{\s*([\w.[\]]+)\s*(?:\|\s*(\w+))?\s*\}\}/g,(_,k,f)=>{const val=get(s,k);return own(filters,f)?filters[f](val):val??'';});
  }
  if(Array.isArray(v))return v.map(x=>resolve(x,s));
  if(!object(v))return v;
  const keys=Object.keys(v),op=keys[0];
  if(op==='format'&&own(v,'value'))return own(filters,v.format)?filters[v.format](resolve(v.value,s)):resolve(v.value,s);
  if(keys.length!==1)return v;
  if(op==='if'){const a=v.if;return resolve(a[0],s)?resolve(a[1],s):resolve(a[2],s);}
  const value=resolve(v[op],s),a=Array.isArray(value)?value:[value],n=x=>Number(x)||0;
  const ops={eq:()=>a[0]==a[1],ne:()=>a[0]!=a[1],gt:()=>a[0]>a[1],gte:()=>a[0]>=a[1],lt:()=>a[0]<a[1],lte:()=>a[0]<=a[1],not:()=>!value,
    and:()=>a.every(Boolean),or:()=>a.find(Boolean),has:()=>value!=null&&value!==''&&(!Array.isArray(value)||value.length>0),count:()=>value?.length??0,
    in:()=>a[1]?.includes?.(a[0])??false,startsWith:()=>String(a[0]??'').startsWith(a[1]),concat:()=>a.join(''),coalesce:()=>a.find(x=>x!=null),
    add:()=>a.reduce((x,y)=>x+n(y),0),sub:()=>n(a[0])-n(a[1]),mul:()=>a.reduce((x,y)=>x*n(y),1),div:()=>n(a[1])?n(a[0])/n(a[1]):0,min:()=>Math.min(...a.map(n)),max:()=>Math.max(...a.map(n)),
    lower:()=>String(value??'').toLowerCase(),upper:()=>String(value??'').toUpperCase(),join:()=>a[0]?.join(a[1]??', '),first:()=>value?.[0],last:()=>value?.[value.length-1],
    find:()=>a[0]?.find(x=>get(x,a[1])==a[2]),slice:()=>a[0]?.slice(n(a[1]),n(a[1])+n(a[2])),range:()=>Array.from({length:Math.min(1000,Math.max(0,n(value)))},(_,i)=>i),round:()=>Math.round(n(value)),floor:()=>Math.floor(n(value))};
  try{return own(ops,op)?ops[op]():v;}catch{return undefined;}
}
function tree(screen){
  const nodes=[];
  function walk(v,p,depth){
    if(!v||typeof v!=='object')return;
    if(typeof v.type==='string'){nodes.push({path:p,type:v.type,label:typeof (v.text??v.label??v.title)==='string'?String(v.text??v.label??v.title):'',depth,node:v});depth++;}
    for(const [k,c] of Object.entries(v))if(k!=='state'&&k!=='let')if(Array.isArray(c))c.forEach((x,i)=>walk(x,`${p}.${k}[${i}]`,depth));else if(object(c))walk(c,`${p}.${k}`,depth);
  }
  walk(screen,'screen',0);return nodes;
}
return {MAX_BYTES,MAX_FILES,object,path,json,screen,fromFiles,bundle,get,resolve,tree};
});
