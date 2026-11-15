#!/usr/bin/env node
// onbun-pack (Onbun 0.9.2): packs an Onbun app folder into a .wmapp file.
//   node onbun-pack.cjs [app-folder] [--out <dir>] [--tag <git tag>]
// Generated from the Onbun source; guide: https://onbun.app/docs#publish
'use strict';
const __modules={
"../companion/apps.cjs":function(module,exports,require){
// App packages: each WinMore app (music, Discord, Reddit…) is a folder with a manifest.json, an
// entry module, and any other files it wants (lib/, ui/, assets/…). Built-in packages ship in
// /apps; installed or dropped-in packages live in the user's apps folder, so apps change without a
// WinMore update. Apps with "ui":"kit" describe their phone screen in ui/screen.json with the
// native component library in kit.cjs; see docs/apps/README.md.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateScreen}=require('./kit.cjs');

const ID=/^[a-z][a-z0-9-]{0,39}$/;
const VERSION=/^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
// Desktop systems an app can declare in its manifest ("platforms"); leaving it out means all of them.
const PLATFORMS=['win32','darwin','linux'];
function platformList(value){
  if(!Array.isArray(value)||!value.length)return null;
  // Only systems WinMore doesn't know (or a typo) leaves an empty list: it runs nowhere here.
  return PLATFORMS.filter(p=>value.map(String).includes(p));
}
const supports=(platforms,platform)=>!platforms||platforms.includes(platform);
const BUNDLE_FORMAT='winmore-app';
const MAX_BUNDLE=20*1024*1024,MAX_FILES=2000;
const CATALOG_URL='https://raw.githubusercontent.com/MathieuDvv/WinMore-releases/main/index.json';
// Folders the phone may fetch from a package; everything else (backend code, data) stays on the PC.
const DEFAULT_PUBLIC=['ui','assets'];
const CONTENT_TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp',
  '.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf','.mp4':'video/mp4','.mp3':'audio/mpeg','.m4a':'audio/mp4',
  '.wav':'audio/wav','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.wasm':'application/wasm'};

// State keys older phone builds always expect, even when the app that fills them is missing.
const LEGACY_STATE={
  music:{title:'YouTube Music is not installed',artist:'Add it from Settings → Apps on your PC',playing:false,queue:[]},
  volume:{available:false,value:0,muted:false},
  chat:[],channel:'',chatConnected:false,
  browser:{url:'',image:null},
  mixer:null,reddit:null,discord:null
};

function compareVersions(a,b){
  const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);
  for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)?1:-1;}
  return 0;
}
function safeRelative(value,extensions){
  if(typeof value!=='string'||!value||value.length>200)return null;
  const normal=path.posix.normalize(value.replace(/\\/g,'/'));
  if(normal.startsWith('../')||normal==='..'||normal==='.'||path.posix.isAbsolute(normal)||/^[a-zA-Z]:/.test(normal)||normal.includes('\0'))return null;
  if(extensions&&!extensions.some(ext=>normal.toLowerCase().endsWith(ext)))return null;
  return normal;
}
function text(value,max,fallback=''){return typeof value==='string'?value.replace(/[\x00-\x1f]/g,'').trim().slice(0,max):fallback;}
// A GitHub repository as "owner/name", from "owner/name" or its https://github.com/… address.
function githubRepo(value){
  if(typeof value!=='string')return null;
  const match=/^(?:https:\/\/github\.com\/)?([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100}?)(?:\.git)?\/?$/.exec(value.trim());
  if(!match||[match[1],match[2]].some(part=>/^\.+$/.test(part)))return null;
  return `${match[1]}/${match[2]}`;
}
function validateManifest(raw){
  if(!raw||typeof raw!=='object')throw Error('The app has no manifest.');
  if(!ID.test(raw.id))throw Error('The app id must be lowercase letters, digits and dashes.');
  if(!VERSION.test(raw.version))throw Error('The app version must look like 1.2.3.');
  const name=text(raw.name,40);if(!name)throw Error('The app needs a name.');
  const entry=safeRelative(raw.entry||'index.cjs',['.cjs','.js']);if(!entry)throw Error('The app entry file is invalid.');
  const ui=raw.ui==null?'none':String(raw.ui);
  if(!/^(none|schema|kit|native:[a-z0-9-]{1,30})$/.test(ui))throw Error('The app interface type is invalid.');
  const screen=ui==='kit'?safeRelative(raw.screen||'ui/screen.json',['.json']):null;
  if(ui==='kit'&&!screen)throw Error('The app screen path is invalid.');
  const publicDirs=(Array.isArray(raw.public)?raw.public:DEFAULT_PUBLIC).map(dir=>safeRelative(String(dir))).filter(Boolean).map(dir=>dir.replace(/\/+$/,''));
  const icon=raw.icon==null?null:safeRelative(raw.icon,['.svg']);
  const iconPNG=raw.iconPNG==null?null:safeRelative(raw.iconPNG,['.png']);
  if((raw.icon!=null&&!icon)||(raw.iconPNG!=null&&!iconPNG))throw Error('The app icon path is invalid.');
  const modules=Array.isArray(raw.modules)?raw.modules.filter(m=>ID.test(m)):[];
  if(!modules.includes(raw.id))modules.unshift(raw.id);
  const platforms=platformList(raw.platforms);
  // "updates": the app's own GitHub repository. The newest release's .wmapp file updates the app, so
  // apps from outside the catalog still update through Onbun.
  const updates=raw.updates==null?null:githubRepo(raw.updates);
  if(raw.updates!=null&&!updates)throw Error('The app updates link must be a GitHub repository, like https://github.com/you/your-app.');
  return {updates,id:raw.id,name,shortName:text(raw.shortName,14,name.slice(0,14))||name.slice(0,14),version:raw.version,description:text(raw.description,240),entry,ui,
    symbol:/^[a-z0-9.]{1,60}$/.test(raw.symbol||'')?raw.symbol:'app',icon,iconPNG,modules,platforms,required:raw.required===true,screen,public:publicDirs};
}

// Reads and checks the manifest of an app folder on disk.
function validateManifestFile(dir){
  let raw;try{raw=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));}catch(error){throw Error(error.code==='ENOENT'?'That folder has no manifest.json.':'manifest.json is not valid JSON: '+error.message);}
  return {manifest:validateManifest(raw)};
}
// Every file in a package folder: [{path, size, sha256}]. Hidden files and node_modules are skipped.
function listDirectory(dir){
  const files=[];
  const walk=(folder,prefix)=>{for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
    if(entry.name.startsWith('.')||entry.name==='node_modules')continue;
    const full=path.join(folder,entry.name),rel=prefix?prefix+'/'+entry.name:entry.name;
    if(entry.isDirectory())walk(full,rel);
    else{const data=fs.readFileSync(full);files.push({path:rel,size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});}
  }};
  walk(dir,'');
  return files.sort((a,b)=>a.path.localeCompare(b.path));
}
// Checks a set of package files (from a bundle, a catalog folder or a local folder) before installing.
function checkFiles(files){
  if(files.size>MAX_FILES)throw Error('The app has too many files.');
  if(!files.has('manifest.json'))throw Error('The app has no manifest.');
  const manifest=validateManifest(JSON.parse(files.get('manifest.json').toString('utf8')));
  if(!files.has(manifest.entry))throw Error('The app is missing its entry module.');
  return {manifest,files};
}
// A bundle is one JSON file holding a package folder: {format, manifest, files:{path: base64}}.
// The catalog now publishes plain folders; bundles remain for "Install from file" and older WinMores.
function packDirectory(dir){
  const files={};
  for(const file of listDirectory(dir))files[file.path]=fs.readFileSync(path.join(dir,...file.path.split('/'))).toString('base64');
  const manifest=validateManifest(JSON.parse(Buffer.from(files['manifest.json']||'','base64').toString('utf8')||'null'));
  return {format:BUNDLE_FORMAT,formatVersion:1,manifest,files};
}
// Packs an app folder into a .wmapp after the same checks Onbun makes before installing one: the
// manifest, safe paths, size limits, the entry module and, for Kit apps, the screen. Used by the island's
// Export button, the onbun-pack command line tool and creators' GitHub release workflows.
function packApp(dir){
  const bundle=packDirectory(dir);
  const {manifest,files}=readBundle(bundle);
  if(manifest.ui==='kit'){
    const screen=files.get(manifest.screen);
    if(!screen)throw Error(`The app is missing its screen (${manifest.screen}).`);
    let parsed;try{parsed=JSON.parse(screen.toString('utf8'));}catch(error){throw Error(`${manifest.screen} is not valid JSON: ${error.message}`);}
    const errors=validateScreen(parsed);
    if(errors.length)throw Error(`${manifest.screen} has ${errors.length} problem${errors.length===1?'':'s'}:\n  ${errors.join('\n  ')}`);
  }
  if(manifest.icon&&!files.has(manifest.icon))throw Error(`The app icon ${manifest.icon} is missing.`);
  if(manifest.iconPNG&&!files.has(manifest.iconPNG))throw Error(`The app icon ${manifest.iconPNG} is missing.`);
  const data=Buffer.from(JSON.stringify(bundle));
  return {manifest,data,files:files.size,fileName:`${manifest.id}-${manifest.version}.wmapp`};
}
function readBundle(input){
  const raw=Buffer.isBuffer(input)||typeof input==='string'?(()=>{if(input.length>MAX_BUNDLE*1.4)throw Error('The app file is too large.');return JSON.parse(input.toString());})():input;
  if(!raw||raw.format!==BUNDLE_FORMAT||raw.formatVersion!==1||!raw.files||typeof raw.files!=='object')throw Error('This is not an Onbun app file.');
  const files=new Map();let size=0;
  for(const [name,data] of Object.entries(raw.files)){
    const rel=safeRelative(name);if(!rel||typeof data!=='string')throw Error('The app file contains an unsafe path.');
    const buffer=Buffer.from(data,'base64');size+=buffer.length;if(size>MAX_BUNDLE)throw Error('The app file is too large.');
    files.set(rel,buffer);
  }
  return checkFiles(files);
}

// Island parts: an app's optional island() returns what it shows on the PC island, in a fixed shape the
// island draws itself (like the phone's Kit). compact is the resting pill; expanded is a card in the
// open island. Buttons and sliders send {module: app, action, value} like the phone does.
const ISLAND_SYMBOLS=['play','pause','next','previous','speaker','note','open','mic','mic-off','headphones','bell'];
function islandPart(raw,manifest){
  if(!raw||typeof raw!=='object')return null;
  const action=value=>typeof value==='string'&&/^[a-zA-Z][\w-]{0,39}$/.test(value)?value:null;
  const image=value=>typeof value==='string'&&/^(https:\/\/|data:image\/(png|jpeg|webp|gif|svg\+xml);base64,)/.test(value)&&value.length<2_000_000?value:null;
  const symbol=value=>ISLAND_SYMBOLS.includes(value)?value:null;
  const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:null;
  const plain=value=>value==null||['string','number','boolean'].includes(typeof value)?value:undefined;
  const c=raw.compact,e=raw.expanded;
  const compact=c&&typeof c==='object'&&text(c.title,80)?{title:text(c.title,80),image:image(c.image),accent:color(c.accent),activity:c.activity===true}:null;
  let expanded=null;
  if(e&&typeof e==='object'&&text(e.title,120)){
    const buttons=(Array.isArray(e.buttons)?e.buttons:[]).slice(0,4).map(b=>b&&symbol(b.symbol)&&action(b.action)?{symbol:b.symbol,action:b.action,value:plain(b.value),label:text(b.label,40,b.symbol)}:null).filter(Boolean);
    const sl=e.slider,slider=sl&&action(sl.action)?{action:sl.action,value:Math.max(0,Math.min(100,Math.round(Number(sl.value)||0))),label:text(sl.label,60,'Level'),symbol:symbol(sl.symbol)||'speaker',display:text(sl.display,12),disabled:sl.disabled===true}:null;
    const f=e.footer,footer=f&&action(f.action)&&text(f.label,40)?{label:text(f.label,40),action:f.action,value:plain(f.value),note:text(f.note,40)}:null;
    expanded={title:text(e.title,120),subtitle:text(e.subtitle,160),image:image(e.image),placeholder:symbol(e.placeholder)||'note',buttons,slider,footer};
  }
  if(!compact&&!expanded)return null;
  return {app:manifest.id,name:manifest.name,priority:Number.isFinite(raw.priority)?raw.priority:0,compact,expanded};
}

// Collections of catalog apps the Library offers together (from the catalog, or site/store.json).
function bundleList(value){
  return (Array.isArray(value)?value:[]).filter(b=>b&&ID.test(b.id)&&Array.isArray(b.apps)).slice(0,20).map(b=>({
    id:b.id,title:text(b.title,60,b.id),description:text(b.description,200),apps:b.apps.filter(id=>ID.test(id)).slice(0,30)})).filter(b=>b.apps.length);
}
const NOTIFICATION_LIMIT=20;
const summary=m=>({id:m.id,name:m.name,version:m.version,description:m.description,platforms:m.platforms||null,icon:null});
function createAppManager({builtinDir,userDir,dataRoot,makeContext,platform=process.platform,fetch=globalThis.fetch,catalogURL=CATALOG_URL,log=console,onChange=()=>{},watch=false,autoUpdate=false,minimalInstall=false,bundles:fallbackBundles=[],githubAPI='https://api.github.com'}){
  const prefsFile=path.join(dataRoot,'apps.json');
  // sources: where each app outside the catalog came from ({github:"owner/repo"} or {url}), so it updates from there.
  let prefs={removed:[],autoUpdate:true,sources:{}};try{prefs={removed:[],autoUpdate:true,sources:{},...JSON.parse(fs.readFileSync(prefsFile,'utf8'))};}catch{}
  if(!prefs.sources||typeof prefs.sources!=='object')prefs.sources={};
  // Notifications apps post with context.notifications; unseen ones put a dot on the app's icon until it is opened.
  const notices=new Map();// id -> [{id, title, body, at}]
  function notifier(id){
    return {
      post(value={}){
        const note={id:typeof value.id==='string'&&value.id?value.id.slice(0,80):crypto.randomUUID(),title:text(value.title,80),body:text(value.body,240),at:Date.now()};
        const list=(notices.get(id)||[]).filter(item=>item.id!==note.id);
        list.push(note);notices.set(id,list.slice(-NOTIFICATION_LIMIT));onChange('notifications');
        return note.id;
      },
      clear(noteId){manager.clearNotifications(id,noteId);},
      get count(){return (notices.get(id)||[]).length;}
    };
  }
  const savePrefs=()=>{try{fs.mkdirSync(dataRoot,{recursive:true});fs.writeFileSync(prefsFile,JSON.stringify(prefs));}catch(error){log.warn('Could not save app list:',error.message);}};
  const loaded=new Map();// id -> {manifest, dir, source, instance, error, build}
  const failures=new Map();// id -> last logged state error
  // Counts loads, so the phone reloads an app's screen after any change, even without a new version.
  let loads=0;

  function scan(root,source){
    const found=[];
    let entries=[];try{entries=fs.readdirSync(root,{withFileTypes:true});}catch{return found;}
    for(const entry of entries){
      if(!entry.isDirectory()||entry.name.endsWith('.installing'))continue;
      const dir=path.join(root,entry.name);
      try{const manifest=validateManifest(JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')));if(manifest.id===entry.name)found.push({manifest,dir,source});else log.warn(`Skipping app folder "${entry.name}": its manifest id is "${manifest.id}". Name the folder after the id.`);}
      catch(error){log.warn(`Skipping app "${entry.name}":`,error.message);}
    }
    return found;
  }
  // The newest copy wins; an installed copy wins a tie with the built-in one.
  function candidates(){
    const chosen=new Map();
    for(const pkg of [...scan(builtinDir,'builtin'),...scan(userDir,'user')]){
      const current=chosen.get(pkg.manifest.id);
      if(!current||compareVersions(pkg.manifest.version,current.manifest.version)>=0)chosen.set(pkg.manifest.id,pkg);
    }
    return chosen;
  }
  function forget(dir){for(const key of Object.keys(require.cache))if(key.startsWith(dir+path.sep))delete require.cache[key];}
  async function activate(pkg){
    const {manifest,dir}=pkg;
    const build=`${manifest.version}+${++loads}`;
    if(!supports(manifest.platforms,platform)){loaded.set(manifest.id,{...pkg,instance:null,error:'Not available on this PC.',unsupported:true,build});return;}
    try{
      forget(dir);
      const module=require(path.join(dir,manifest.entry));
      if(typeof module.activate!=='function')throw Error('The app has no activate() function.');
      const dataDir=path.join(dataRoot,'app-data',manifest.id);fs.mkdirSync(dataDir,{recursive:true});
      const context=makeContext({manifest,dir,dataDir});
      // Every app can post notifications, whatever host made its context.
      if(context&&typeof context==='object'&&!context.notifications)context.notifications=notifier(manifest.id);
      const instance=await module.activate(context);
      loaded.set(manifest.id,{...pkg,instance:instance||{},error:null,build});
    }catch(error){
      log.warn(`App "${manifest.id}" could not start:`,error.message);
      loaded.set(manifest.id,{...pkg,instance:null,error:error.message,build});
    }
  }
  async function unload(id){
    const pkg=loaded.get(id);if(!pkg)return;
    loaded.delete(id);failures.delete(id);
    try{await pkg.instance?.close?.();}catch(error){log.warn(`App "${id}" did not close cleanly:`,error.message);}
    forget(pkg.dir);
  }
  // Built-ins marked "required" in their manifest stay installed: WinMore always has one app to show.
  const requiredIds=()=>new Set(scan(builtinDir,'builtin').filter(pkg=>pkg.manifest.required).map(pkg=>pkg.manifest.id));
  const running=()=>[...loaded.values()].filter(pkg=>pkg.instance);
  function owner(module){return running().find(pkg=>pkg.manifest.modules.includes(module))||null;}
  function info(pkg){
    const m=pkg.manifest;
    return {id:m.id,name:m.name,shortName:m.shortName,version:m.version,build:pkg.build,description:m.description,ui:m.ui,symbol:m.symbol,
      icon:!!m.icon,iconPNG:!!m.iconPNG,source:pkg.source,running:!!pkg.instance,error:pkg.error,settings:!!pkg.instance?.settings,
      platforms:m.platforms,supported:!pkg.unsupported,required:requiredIds().has(m.id),
      notifications:(notices.get(m.id)||[]).length,updates:updateSource(pkg)};
  }
  // Where an installed app updates from: its manifest's GitHub repository, else where it was installed
  // from (a GitHub repository or a file link), else the catalog (null).
  function updateSource(pkg){
    if(pkg.manifest.updates)return {github:pkg.manifest.updates};
    const source=prefs.sources[pkg.manifest.id];
    if(pkg.source==='user'&&source&&(source.github||source.url))return source.github?{github:source.github}:{url:source.url};
    return null;
  }
  // Kit apps answer data(context). When the phone already has this revision, only the revision is sent.
  async function appData(pkg,context){
    const data=await pkg.instance.data(context);
    if(!data||typeof data!=='object')return {app:pkg.manifest.id,revision:'0',data:{}};
    const revision=data.revision!=null?String(data.revision):crypto.createHash('sha1').update(JSON.stringify(data)).digest('base64url').slice(0,16);
    if(context.since!=null&&context.since===revision)return {app:pkg.manifest.id,revision,unchanged:true};
    return {app:pkg.manifest.id,revision,data};
  }
  // Writes a checked set of files as the app's folder in the user apps folder, then starts it.
  // source: {github} or {url} when the app came from outside the catalog; it then updates from there.
  async function installFiles({manifest,files},source=null){
    fs.mkdirSync(userDir,{recursive:true});
    const target=path.join(userDir,manifest.id),staging=target+'.installing';
    fs.rmSync(staging,{recursive:true,force:true});
    for(const [rel,buffer] of files){const file=path.join(staging,...rel.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,buffer);}
    suppress(manifest.id);
    await unload(manifest.id);
    fs.rmSync(target,{recursive:true,force:true});fs.renameSync(staging,target);
    prefs.removed=prefs.removed.filter(id=>id!==manifest.id);
    if(source)prefs.sources[manifest.id]=source;else delete prefs.sources[manifest.id];
    savePrefs();
    const pkg=candidates().get(manifest.id);
    if(pkg)await activate(pkg);
    onChange();
    return info(loaded.get(manifest.id));
  }
  // Downloads a catalog entry: a folder of files (each checked against its hash), or an older bundle.
  async function download(entry){
    if(Array.isArray(entry.files)&&entry.folder){
      const base=new URL(entry.folder.replace(/\/?$/,'/'),catalogURL);
      if(base.protocol!=='https:'&&base.protocol!=='file:'&&!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(base.href))throw Error('The catalog must use HTTPS.');
      const files=new Map();let size=0;
      if(entry.files.length>MAX_FILES)throw Error('The app has too many files.');
      for(const file of entry.files){
        const rel=safeRelative(file?.path);if(!rel||!/^[0-9a-f]{64}$/.test(file.sha256||''))throw Error('The catalog lists an unsafe file.');
        const response=await fetch(new URL(rel.split('/').map(encodeURIComponent).join('/'),base).href);
        if(!response.ok)throw Error(`The app could not be downloaded (${rel}).`);
        const buffer=Buffer.from(await response.arrayBuffer());
        if(crypto.createHash('sha256').update(buffer).digest('hex')!==file.sha256)throw Error(`The downloaded ${rel} does not match the catalog.`);
        size+=buffer.length;if(size>MAX_BUNDLE)throw Error('The app is too large.');
        files.set(rel,buffer);
      }
      return checkFiles(files);
    }
    if(!entry.bundle?.startsWith('https://'))throw Error('The catalog must use HTTPS.');
    return fetchBundle(entry.bundle);
  }
  // Downloads one .wmapp file over HTTPS and checks it.
  async function fetchBundle(url){
    let address;try{address=new URL(url);}catch{throw Error('That app link is not valid.');}
    if(address.protocol!=='https:'||address.username||address.password)throw Error('Apps download only over HTTPS.');
    const response=await fetch(address.href,{headers:{Accept:'application/octet-stream','User-Agent':'Onbun'}});
    if(!response.ok)throw Error(`The app could not be downloaded (${response.status}).`);
    const size=Number(response.headers?.get?.('content-length'))||0;
    if(size>MAX_BUNDLE*1.4)throw Error('The app file is too large.');
    return readBundle(Buffer.from(await response.arrayBuffer()));
  }
  // The newest release of a GitHub repository that has an app file (.wmapp): its version and file link.
  async function githubRelease(repo,id){
    const response=await fetch(`${githubAPI}/repos/${repo}/releases/latest`,{headers:{Accept:'application/vnd.github+json','User-Agent':'Onbun'}});
    if(response.status===404)throw Error(`${repo} has no published release.`);
    if(!response.ok)throw Error(`GitHub answered ${response.status} for ${repo}.`);
    const release=await response.json();
    const files=(Array.isArray(release.assets)?release.assets:[]).filter(asset=>/\.wmapp$/i.test(asset?.name||'')&&/^https:\/\//.test(asset.browser_download_url||''));
    // A repository with several apps names each file after its app.
    const file=(id&&files.find(asset=>asset.name.toLowerCase().startsWith(id)))||files[0];
    if(!file)throw Error(`The newest release of ${repo} has no .wmapp app file.`);
    const version=/^v?(\d{1,4}\.\d{1,4}\.\d{1,4})$/.exec(String(release.tag_name||'').trim())?.[1]||null;
    return {version,url:file.browser_download_url,name:String(release.name||repo).slice(0,80),notes:text(release.body,600)};
  }
  // What a source offers now: {version, load()} (the version of a file link is only known once downloaded).
  async function latestFrom(source,id){
    if(source.github){
      const release=await githubRelease(source.github,id);
      return {version:release.version,load:async()=>{const pkg=await fetchBundle(release.url);return pkg;}};
    }
    const pkg=await fetchBundle(source.url);
    return {version:pkg.manifest.version,load:async()=>pkg};
  }

  // Watching: dropping a folder into the apps folder starts it, and editing a package's files
  // reloads it (and the phone's screen) without restarting WinMore.
  const watchers=[],timers=new Map(),quiet=new Map();let closed=false;
  function suppress(id){quiet.set(id,Date.now()+2000);}
  function changed(file){
    const id=String(file||'').split(/[\\/]/)[0];
    // Events can still arrive after close(); a reload then would start an app nobody closes.
    if(closed||!ID.test(id)||(quiet.get(id)||0)>Date.now())return;
    clearTimeout(timers.get(id));
    timers.set(id,setTimeout(()=>{timers.delete(id);reload(id).catch(error=>log.warn(`App "${id}" could not reload:`,error.message));},500));
  }
  async function reload(id){
    const pkg=candidates().get(id);
    // A removed built-in stays removed until you drop a copy into the apps folder.
    if(pkg&&prefs.removed.includes(id)){
      if(pkg.source!=='user')return;
      prefs.removed=prefs.removed.filter(x=>x!==id);savePrefs();
    }
    await unload(id);
    if(pkg){await activate(pkg);log.log?.(`Loaded app ${id} ${pkg.manifest.version}`);}
    onChange();
  }
  function startWatching(){
    for(const root of [builtinDir,userDir]){
      try{fs.mkdirSync(root,{recursive:true});// unref: a watcher never keeps WinMore (or a test) running; macOS can be slow to release one on close.
        const watcher=fs.watch(root,{recursive:true},(_event,file)=>changed(file));watcher.unref?.();watchers.push(watcher);}
      catch(error){log.warn('Not watching apps in',root+':',error.message);}
    }
  }
  // Installed apps update themselves from the catalog when it has a newer version.
  let updateTimer=null,firstCheck=null,catalogBundles=null;
  // force: the person asked (Update all), so it runs even with automatic updates off.
  async function updateAll({force=false}={}){
    if(!force&&prefs.autoUpdate===false)return [];
    const updated=[];
    for(const entry of await manager.updates()){
      try{await manager.updateApp(entry.id);updated.push(entry.id);log.log?.(`Updated app ${entry.id} to ${entry.version}`);}
      catch(error){log.warn(`App "${entry.id}" could not update:`,error.message);}
    }
    return updated;
  }

  const manager={
    async load(){
      const required=requiredIds();
      // Only seed a fresh packaged profile. Existing app choices survive upgrades.
      if(minimalInstall&&!fs.existsSync(prefsFile)){
        const installed=new Set(scan(userDir,'user').map(pkg=>pkg.manifest.id));
        prefs.removed=scan(builtinDir,'builtin').filter(pkg=>!required.has(pkg.manifest.id)&&!installed.has(pkg.manifest.id)).map(pkg=>pkg.manifest.id);
        savePrefs();
      }
      if(prefs.removed.some(id=>required.has(id))){prefs.removed=prefs.removed.filter(id=>!required.has(id));savePrefs();}
      for(const pkg of candidates().values())if(!prefs.removed.includes(pkg.manifest.id))await activate(pkg);
      onChange();
      if(watch)startWatching();
      if(autoUpdate){
        const check=()=>updateAll().catch(error=>log.warn('App updates:',error.message));
        firstCheck=setTimeout(check,15000);updateTimer=setInterval(check,6*60*60*1000);
      }
    },
    list(){return [...loaded.values()].map(info).sort((a,b)=>a.name.localeCompare(b.name));},
    get(id){return loaded.get(id)||null;},
    reload,updateAll,
    get autoUpdate(){return prefs.autoUpdate!==false;},
    setAutoUpdate(on){prefs.autoUpdate=on===true;savePrefs();},
    folder:()=>userDir,
    async state(context={}){
      const merged={...LEGACY_STATE};
      const parts=await Promise.all(running().map(async pkg=>{
        try{const part=await pkg.instance.state?.(context);failures.delete(pkg.manifest.id);return part;}
        catch(error){if(failures.get(pkg.manifest.id)!==error.message){failures.set(pkg.manifest.id,error.message);log.warn(`App "${pkg.manifest.id}" state failed:`,error.message);}return null;}
      }));
      for(const part of parts)if(part&&typeof part==='object')Object.assign(merged,part);
      const viewed=context.view&&loaded.get(context.view);
      // The phone has the app open: its notifications are seen.
      if(viewed)manager.clearNotifications(viewed.manifest.id);
      if(viewed?.instance?.view){try{merged.view=await viewed.instance.view(context);}catch(error){merged.view={type:'text',text:error.message,style:'secondary'};}}
      if(viewed?.instance?.data&&viewed.manifest.ui==='kit'){
        const key=viewed.manifest.id+':data';
        try{merged.appData=await appData(viewed,context);failures.delete(key);}
        catch(error){
          if(failures.get(key)!==error.message){failures.set(key,error.message);log.warn(`App "${viewed.manifest.id}" data failed:`,error.message);}
          merged.appData={app:viewed.manifest.id,revision:'error',error:error.message};
        }
      }
      if(context.view==='island'){merged.island=await manager.island(context);merged.notifications=manager.notifications();}
      merged.apps=manager.list().filter(app=>app.running&&app.ui!=='none');
      merged.capabilities=Object.fromEntries(running().map(pkg=>[pkg.manifest.id,true]));
      return merged;
    },
    // Every running app's island part, the most important first (the resting pill shows the first compact one).
    async island(context={}){
      const parts=await Promise.all(running().filter(pkg=>typeof pkg.instance.island==='function').map(async pkg=>{
        const key=pkg.manifest.id+':island';
        try{const part=islandPart(await pkg.instance.island(context),pkg.manifest);failures.delete(key);return part;}
        catch(error){if(failures.get(key)!==error.message){failures.set(key,error.message);log.warn(`App "${pkg.manifest.id}" island failed:`,error.message);}return null;}
      }));
      return parts.filter(Boolean).sort((a,b)=>b.priority-a.priority||a.name.localeCompare(b.name));
    },
    async command({module,action,value}){
      const pkg=owner(String(module));
      if(!pkg?.instance?.command)throw Error('This app is not installed on your PC.');
      return pkg.instance.command(String(action),value,String(module));
    },
    // The app's phone screen: ui/screen.json (or screen() from the app), checked against the kit.
    async screen(id,context={}){
      const pkg=loaded.get(id);
      if(!pkg)throw Error('This app is not installed on your PC.');
      if(pkg.manifest.ui!=='kit')throw Error('This app has no kit screen.');
      let screen;
      try{
        if(pkg.instance?.screen)screen=await pkg.instance.screen(context);
        else screen=JSON.parse(fs.readFileSync(path.join(pkg.dir,...pkg.manifest.screen.split('/')),'utf8'));
      }catch(error){return {build:pkg.build,errors:[`${pkg.manifest.screen}: ${error.code==='ENOENT'?'file not found':error.message}`]};}
      const errors=validateScreen(screen);
      if(errors.length){log.warn(`App "${id}" screen has problems:\n  `+errors.join('\n  '));return {build:pkg.build,errors};}
      return {build:pkg.build,screen};
    },
    // A public file of the app (ui/, assets/, its icons, or the folders its manifest lists).
    file(id,rel){
      const pkg=loaded.get(id);
      const clean=safeRelative(rel);
      if(!pkg||!clean)return null;
      const allowed=[...pkg.manifest.public,pkg.manifest.icon,pkg.manifest.iconPNG].filter(Boolean);
      if(!allowed.some(dir=>clean===dir||clean.startsWith(dir+'/')))return null;
      let real;try{real=fs.realpathSync(path.join(pkg.dir,...clean.split('/')));}catch{return null;}
      if(!real.startsWith(fs.realpathSync(pkg.dir)+path.sep)||!fs.statSync(real).isFile())return null;
      return {file:real,type:CONTENT_TYPES[path.extname(real).toLowerCase()]||'application/octet-stream'};
    },
    icon(id,kind){
      const pkg=loaded.get(id),rel=kind==='png'?pkg?.manifest.iconPNG:pkg?.manifest.icon;
      return rel?path.join(pkg.dir,rel):null;
    },
    settings(id){
      const pkg=loaded.get(id);
      if(!pkg?.instance?.settings)return null;
      return pkg.instance.settings;
    },
    async install(input){return installFiles(readBundle(input));},
    // Installs an app folder from anywhere on this PC (it is copied into the apps folder).
    async installFolder(dir){
      const files=new Map();let size=0;
      for(const file of listDirectory(dir)){
        const data=fs.readFileSync(path.join(dir,...file.path.split('/')));
        size+=data.length;if(size>MAX_BUNDLE)throw Error('The app is too large.');
        files.set(file.path,data);
      }
      return installFiles(checkFiles(files));
    },
    async remove(id){
      if(!loaded.has(id))throw Error('That app is not installed.');
      if(requiredIds().has(id))throw Error(`${loaded.get(id).manifest.name} comes with Onbun and can't be removed.`);
      const pkg=loaded.get(id);
      await unload(id);
      if(pkg.source==='user'){suppress(id);fs.rmSync(pkg.dir,{recursive:true,force:true});}
      // Built-in apps stay on disk with Onbun; remember that you removed them.
      if(!prefs.removed.includes(id))prefs.removed.push(id);
      delete prefs.sources[id];notices.delete(id);savePrefs();
      onChange();
    },
    // Installs the app in the newest release of a GitHub repository; it then updates from there.
    async installFromGitHub(value){
      const repo=githubRepo(String(value||''));
      if(!repo)throw Error('Enter a GitHub repository, like owner/app or https://github.com/owner/app.');
      const release=await githubRelease(repo);
      return installFiles(await fetchBundle(release.url),{github:repo});
    },
    // Installs a .wmapp from an HTTPS link; it then updates from the same link.
    async installFromURL(url){
      const pkg=await fetchBundle(url);
      return installFiles(pkg,{url:new URL(url).href});
    },
    // Looks at what an install link offers without installing it: {app, from, install()}.
    async prepare({app:id,github,url}){
      if(id){
        if(!ID.test(id))throw Error('That app link is not valid.');
        const entry=(await manager.catalog()).find(item=>item.id===id);
        const builtin=!entry&&scan(builtinDir,'builtin').find(pkg=>pkg.manifest.id===id);
        if(!entry&&!builtin)throw Error('That app is not in the Onbun catalog.');
        const m=entry||builtin.manifest;
        return {app:{id,name:m.name,version:m.version,description:m.description,platforms:m.platforms||null,icon:entry?.icon||null},from:{kind:'catalog'},
          installed:!!loaded.get(id)?.instance,install:()=>manager.add(id)};
      }
      if(github){
        const repo=githubRepo(String(github));
        if(!repo)throw Error('That app link names an invalid GitHub repository.');
        const release=await githubRelease(repo);
        const pkg=await fetchBundle(release.url);
        return {app:summary(pkg.manifest),from:{kind:'github',github:repo},installed:!!loaded.get(pkg.manifest.id)?.instance,install:()=>installFiles(pkg,{github:repo})};
      }
      if(url){
        const pkg=await fetchBundle(String(url));
        return {app:summary(pkg.manifest),from:{kind:'url',host:new URL(url).host,url:new URL(url).href},installed:!!loaded.get(pkg.manifest.id)?.instance,install:()=>installFiles(pkg,{url:new URL(url).href})};
      }
      throw Error('That app link is not valid.');
    },
    // Apps with a newer version where they update from: the catalog, their GitHub repository or their file link.
    async updates(){
      const found=[],errors=[];
      for(const pkg of [...loaded.values()]){
        const source=updateSource(pkg);if(!source)continue;
        try{
          const latest=await latestFrom(source,pkg.manifest.id);
          if(latest.version&&compareVersions(latest.version,pkg.manifest.version)>0)found.push({id:pkg.manifest.id,name:pkg.manifest.name,version:latest.version,from:source.github?'github':'url'});
        }catch(error){errors.push(`${pkg.manifest.name}: ${error.message}`);}
      }
      try{
        for(const entry of await manager.catalog()){
          const pkg=loaded.get(entry.id);
          if(entry.status==='update'&&pkg&&!updateSource(pkg))found.push({id:entry.id,name:entry.name,version:entry.version,from:'catalog'});
        }
      }catch(error){if(!found.length)throw error;errors.push(error.message);}
      if(errors.length)log.warn('App updates:',errors.join('; '));
      return found;
    },
    // Updates one app from wherever it updates from.
    async updateApp(id){
      const pkg=loaded.get(id);
      if(!pkg)throw Error('That app is not installed.');
      const source=updateSource(pkg);
      if(!source)return manager.installFromCatalog(id);
      const next=await (await latestFrom(source,id)).load();
      if(next.manifest.id!==id)throw Error(`The update for ${pkg.manifest.name} is a different app (${next.manifest.id}).`);
      if(compareVersions(next.manifest.version,pkg.manifest.version)<=0)return info(pkg);
      return installFiles(next,prefs.sources[id]||null);
    },
    // Notifications from every app: [{app, name, count, latest}].
    notifications(){
      return [...notices.entries()].filter(([id,list])=>list.length&&loaded.has(id)).map(([id,list])=>({app:id,name:loaded.get(id).manifest.name,count:list.length,latest:list[list.length-1]}));
    },
    clearNotifications(id,noteId){
      const list=notices.get(id);if(!list?.length)return;
      const next=noteId==null?[]:list.filter(item=>item.id!==noteId);
      if(next.length===list.length)return;
      if(next.length)notices.set(id,next);else notices.delete(id);
      onChange('notifications');
    },
    async catalog(){
      // GitHub's CDN keeps index.json for 5 minutes; a unique query asks for the version just published.
      const url=catalogURL.startsWith('https://')?catalogURL+(catalogURL.includes('?')?'&':'?')+'t='+Date.now():catalogURL;
      const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});
      if(!response.ok)throw Error('The app catalog is unavailable right now.');
      const data=await response.json();
      catalogBundles=bundleList(data.bundles);
      // Catalogs published before 0.8.0 don't list platforms: WinMore's own copy of the app knows them.
      const known=new Map(scan(builtinDir,'builtin').map(pkg=>[pkg.manifest.id,pkg.manifest.platforms]));
      return (Array.isArray(data.apps)?data.apps:[]).filter(app=>ID.test(app?.id)&&VERSION.test(app?.version)).map(app=>{
        const installed=loaded.get(app.id);
        const platforms=platformList(app.platforms)||known.get(app.id)||null;
        return {id:app.id,name:text(app.name,40,app.id),version:app.version,description:text(app.description,240),icon:typeof app.icon==='string'?new URL(app.icon,catalogURL).href:null,platforms,
          bundle:typeof app.bundle==='string'?new URL(app.bundle,catalogURL).href:null,folder:typeof app.folder==='string'?app.folder:null,files:Array.isArray(app.files)?app.files:null,
          status:!supports(platforms,platform)?'unsupported':!installed||installed.unsupported?'available':compareVersions(app.version,installed.manifest.version)>0?'update':'installed'};
      });
    },
    async installFromCatalog(id){
      const entry=(await manager.catalog()).find(app=>app.id===id);
      if(!entry)throw Error('That app is not in the catalog.');
      if(entry.status==='unsupported')throw Error(`${entry.name} doesn't run on this PC.`);
      const pkg=await download(entry);
      if(pkg.manifest.id!==id||pkg.manifest.version!==entry.version)throw Error('The downloaded app does not match the catalog.');
      return installFiles(pkg);
    },
    // Apps you can add: built-ins you removed (they ship with WinMore on this PC), and catalog apps
    // not installed yet. Apps for another system are listed too, marked unsupported.
    async library(){
      const entries=new Map();
      for(const pkg of scan(builtinDir,'builtin')){
        const m=pkg.manifest,current=loaded.get(m.id);
        if(current&&!current.unsupported)continue;
        entries.set(m.id,{id:m.id,name:m.name,version:m.version,description:m.description,platforms:m.platforms,source:'pc',iconFile:m.icon?path.join(pkg.dir,m.icon):null,
          status:supports(m.platforms,platform)?'available':'unsupported'});
      }
      let catalogError='';
      try{
        for(const app of await manager.catalog()){
          if(app.status==='installed'||app.status==='update')continue;
          const local=entries.get(app.id);
          // A newer catalog version wins over the copy on this PC.
          if(local&&compareVersions(local.version,app.version)>=0&&local.status!=='unsupported')continue;
          entries.set(app.id,{id:app.id,name:app.name,version:app.version,description:app.description,platforms:app.platforms,icon:app.icon,iconFile:local?.iconFile||null,source:'catalog',status:app.status});
        }
      }catch(error){catalogError=error.message;}
      const order={available:0,unsupported:1};
      // Bundles from the catalog (or the copy Onbun ships when the catalog has none), with installed apps marked.
      const installed=[...loaded.values()].filter(pkg=>pkg.instance).map(pkg=>({id:pkg.manifest.id,name:pkg.manifest.name}));
      return {apps:[...entries.values()].sort((a,b)=>order[a.status]-order[b.status]||a.name.localeCompare(b.name)),catalogError,
        bundles:catalogBundles?.length?catalogBundles:bundleList(fallbackBundles),installed};
    },
    // Adds a library entry: a removed built-in starts again from WinMore's own copy; others download.
    async add(id){
      const builtin=scan(builtinDir,'builtin').find(pkg=>pkg.manifest.id===id);
      const current=loaded.get(id);
      if(builtin&&(!current||current.unsupported)&&prefs.removed.includes(id)){
        if(!supports(builtin.manifest.platforms,platform))throw Error(`${builtin.manifest.name} doesn't run on this PC.`);
        prefs.removed=prefs.removed.filter(x=>x!==id);savePrefs();
        const pkg=candidates().get(id);await unload(id);if(pkg)await activate(pkg);
        onChange();
        return info(loaded.get(id));
      }
      return manager.installFromCatalog(id);
    },
    async close(){
      closed=true;
      for(const watcher of watchers.splice(0))watcher.close();
      for(const timer of timers.values())clearTimeout(timer);timers.clear();
      clearTimeout(firstCheck);clearInterval(updateTimer);
      for(const id of [...loaded.keys()])await unload(id);
    }
  };
  return manager;
}
module.exports={githubRepo,bundleList,packApp,PLATFORMS,ISLAND_SYMBOLS,islandPart,createAppManager,validateManifest,validateManifestFile,readBundle,packDirectory,listDirectory,checkFiles,compareVersions,safeRelative,LEGACY_STATE,CATALOG_URL,CONTENT_TYPES};

},
"./kit.cjs":function(module,exports,require){
// Onbun Kit: the native component library that app packages use to describe their phone screen.
// This file is the single source of truth. The PC validates screens against it, and
// scripts/kit-docs.cjs turns it into docs/apps/components.md and docs/apps/screen.schema.json.
// Each phone draws every component natively (SwiftUI and Liquid Glass on iPhone, Compose and Material 3
// Expressive on Android); `web` is the escape hatch.

// Prop types:
//   string, number, bool, color, symbol (SF Symbol name), url (https URL or a path inside the package)
//   enum (one of `values`), array, object, any, node (one component), nodes (list of components),
//   action (see ACTIONS), items (menu items), options (picker options)
// Value props also accept an expression (see EXPRESSIONS): "$path", "{{path|filter}}" or {"op": ...}.

const COLORS=['primary','secondary','tertiary','accent','background','card','white','black','clear','red','orange','yellow','green','mint','teal','cyan','blue','indigo','purple','pink','brown','gray'];
const TEXT_STYLES=['largeTitle','title','title2','title3','headline','body','callout','subheadline','footnote','caption','caption2'];
const WEIGHTS=['regular','medium','semibold','bold','heavy','light'];
const ALIGN=['leading','center','trailing','top','bottom','topLeading','topTrailing','bottomLeading','bottomTrailing'];

// Every component accepts these layout and decoration props.
const COMMON={
  when:{type:'any',doc:'Show the component only when this expression is truthy.'},
  padding:{type:'any',doc:'Inner spacing: a number for all sides, [vertical, horizontal], or [top, leading, bottom, trailing].'},
  width:{type:'number',doc:'Fixed width in points.'},
  height:{type:'any',doc:'Fixed height in points, or "screen" for the visible content height (minus `screenOffset`).'},
  screenOffset:{type:'number',doc:'Points subtracted from the screen height when `height` is "screen". Default 0.'},
  minWidth:{type:'number',doc:'Minimum width.'},
  minHeight:{type:'number',doc:'Minimum height.'},
  maxWidth:{type:'number',doc:'Maximum width; the component centers in wider space.'},
  maxHeight:{type:'number',doc:'Maximum height.'},
  fill:{type:'enum',values:['width','height','both'],doc:'Grow to fill the available width, height or both.'},
  align:{type:'enum',values:ALIGN,doc:'Where content sits inside the frame when it is larger than the content.'},
  aspect:{type:'number',doc:'Keep this width / height ratio.'},
  background:{type:'color',doc:'Flat background color. Use `glass` for a floating material instead.'},
  glass:{type:'bool',doc:'The floating material behind the component, in `shape`: Liquid Glass on iPhone, a tonal Material surface on Android. Use it for floating controls only; content stays flat.'},
  glassTint:{type:'color',doc:'Tint for the glass, e.g. to mark a selected control.'},
  shape:{type:'enum',values:['rounded','capsule','circle','rect'],doc:'Shape for `background`, `glass` and clipping. Default rounded.'},
  corner:{type:'number',doc:'Corner radius for the rounded shape. Default 24.'},
  clip:{type:'bool',doc:'Clip content to `shape`.'},
  foreground:{type:'color',doc:'Default color for text and symbols inside.'},
  opacity:{type:'number',doc:'0 to 1.'},
  blur:{type:'number',doc:'Gaussian blur radius.'},
  gradient:{type:'array',doc:'Colors for a diagonal gradient background (top leading to bottom trailing), e.g. ["#0A84FFA6", "black"].'},
  shadow:{type:'number',doc:'Soft drop shadow with this radius, for artwork that floats.'},
  scale:{type:'number',doc:'Scale factor; changes animate, e.g. shrink artwork while paused.'},
  action:{type:'action',doc:'Runs when the component is tapped.'},
  longPress:{type:'action',doc:'Runs on a long press.'},
  doubleTap:{type:'action',doc:'Runs on a double tap.'},
  accessibility:{type:'string',doc:'VoiceOver label.'},
  key:{type:'string',doc:'Stable identity, so animations and state follow the right item.'}
};

const C={};
const def=(type,group,doc,props={},extra={})=>{C[type]={type,group,doc,props,...extra};};

// ── Layout ───────────────────────────────────────────────────────────────────
def('stack','Layout','Lays children out in a column or a row.',{
  axis:{type:'enum',values:['vertical','horizontal'],doc:'Default vertical.'},
  spacing:{type:'number',doc:'Space between children. Default 8.'},
  alignment:{type:'enum',values:['leading','center','trailing','top','bottom','fill'],doc:'Cross-axis alignment. Default leading (vertical) or center (horizontal).'},
  children:{type:'nodes',required:true}
},{example:{type:'stack',spacing:12,children:[{type:'text',text:'Hello',style:'headline'},{type:'text',text:'World',color:'secondary'}]}});
def('layers','Layout','Stacks children on top of each other (first child at the back).',{
  alignment:{type:'enum',values:ALIGN,doc:'Default center.'},
  children:{type:'nodes',required:true}
});
def('split','Layout','Two panes side by side in landscape. In portrait they stack, or the second one hides.',{
  ratio:{type:'number',doc:'Share of the width for the first pane in landscape, 0.2 to 0.8. Default 0.58.'},
  spacing:{type:'number',doc:'Default 12.'},
  portrait:{type:'enum',values:['stack','first','second'],doc:'Portrait layout. Default stack.'},
  portraitHeight:{type:'number',doc:'Height of the first pane when stacked in portrait.'},
  children:{type:'nodes',required:true,doc:'Exactly two components.'}
});
def('scroll','Layout','A scrolling container. Children are created lazily, so long feeds stay fast.',{
  axis:{type:'enum',values:['vertical','horizontal'],doc:'Default vertical.'},
  spacing:{type:'number',doc:'Default 12.'},
  snap:{type:'bool',doc:'Settle on each child after a swipe (paging cards).'},
  indicators:{type:'bool',doc:'Show scroll bars. Default false.'},
  refresh:{type:'action',doc:'Pull to refresh.'},
  end:{type:'action',doc:'Runs when the last child appears (load more).'},
  footer:{type:'node',doc:'Shown after the children, e.g. a spinner while more loads.'},
  stick:{type:'enum',values:['none','bottom'],doc:'bottom keeps the newest (last) child in view as children arrive, like a chat. Default none.'},
  children:{type:'nodes',required:true}
});
def('grid','Layout','A grid that fills rows with as many columns as fit.',{
  columns:{type:'number',doc:'Fixed number of columns.'},
  minWidth:{type:'number',doc:'Adaptive columns at least this wide (used when `columns` is not set). Default 140.'},
  spacing:{type:'number',doc:'Default 12.'},
  children:{type:'nodes',required:true}
});
def('list','Layout','A native grouped list, like the phone’s own Settings. Put `section` and `row` components inside.',{
  style:{type:'enum',values:['inset','plain'],doc:'Default inset.'},
  refresh:{type:'action',doc:'Pull to refresh.'},
  children:{type:'nodes',required:true}
});
def('section','Layout','A titled group. Inside a `list` it is a list section; elsewhere a rounded card.',{
  title:{type:'string'},footer:{type:'string'},
  children:{type:'nodes',required:true}
});
def('card','Layout','A flat rounded surface for content (posts, tiles).',{
  spacing:{type:'number',doc:'Default 8.'},
  axis:{type:'enum',values:['vertical','horizontal'],doc:'Default vertical.'},
  inset:{type:'number',doc:'Inner padding. Default 16. Use 0 for edge-to-edge media.'},
  children:{type:'nodes',required:true}
});
def('each','Layout','Repeats `template` for every element of `items`.',{
  items:{type:'array',required:true,doc:'Usually a binding, e.g. "$posts".'},
  as:{type:'string',doc:'Name for the current element in bindings. Default "item".'},
  index:{type:'string',doc:'Name for the current position (from 0).'},
  id:{type:'string',doc:'Path inside each element that identifies it. Default "id".'},
  template:{type:'node',required:true},
  empty:{type:'node',doc:'Shown when there are no items.'}
},{example:{type:'each',items:'$songs',as:'song',template:{type:'row',title:'$song.title',subtitle:'$song.artist'}}});
def('if','Layout','Shows `then` when `test` is truthy, otherwise `else`.',{
  test:{type:'any',required:true},then:{type:'node'},else:{type:'node'}
});
def('pager','Layout','Pages you swipe through one at a time, sideways or up and down. Vertical pagers resist past the first and last page. Use `bind` to read or move the page.',{
  axis:{type:'enum',values:['horizontal','vertical'],doc:'Default horizontal.'},
  bind:{type:'string',doc:'Screen variable holding the current page (from 0). Set it to change page.'},
  start:{type:'number',doc:'First page shown. Default 0.'},
  indicator:{type:'enum',values:['auto','dots','none'],doc:'Page dots; auto fades them out after a moment. Default auto.'},
  locked:{type:'bool',doc:'Stop swiping (pages still change through `bind`).'},
  children:{type:'nodes',required:true,doc:'One component per page; `each` works too.'}
},{example:{type:'pager',axis:'vertical',bind:'panel',start:1,indicator:'none',children:[{type:'text',text:'Lyrics'},{type:'image',src:'$artwork'},{type:'text',text:'Up next'}]}});
def('spacer','Layout','Flexible empty space.',{min:{type:'number'}});
def('divider','Layout','A thin separator line.',{});

// ── Content ──────────────────────────────────────────────────────────────────
def('text','Content','Text. Supports inline Markdown.',{
  text:{type:'string',required:true},
  style:{type:'enum',values:TEXT_STYLES,doc:'Default body.'},
  weight:{type:'enum',values:WEIGHTS},
  color:{type:'color'},
  lines:{type:'number',doc:'Maximum lines before truncating.'},
  textAlign:{type:'enum',values:['leading','center','trailing']},
  markdown:{type:'bool',doc:'Render **bold**, _italic_, `code` and links.'},
  selectable:{type:'bool'},
  monospaced:{type:'bool',doc:'Monospaced digits (for changing numbers).'},
  size:{type:'number',doc:'Font size in points, overriding `style`.'}
});
def('label','Content','A symbol and text side by side.',{
  text:{type:'string',required:true},symbol:{type:'symbol',required:true},
  style:{type:'enum',values:TEXT_STYLES},weight:{type:'enum',values:WEIGHTS},color:{type:'color'},
  iconColor:{type:'color'},lines:{type:'number'}
});
def('symbol','Content','An icon, named like an SF Symbol. Android draws the matching Material Symbol.',{
  name:{type:'symbol',required:true},size:{type:'number',doc:'Default 17.'},weight:{type:'enum',values:WEIGHTS},color:{type:'color'},
  slash:{type:'bool',doc:'Draw a diagonal slash through the symbol, for states SF Symbols has no slashed version of.'}
});
def('image','Content','A remote or packaged image. Animated GIFs play. Downloads are cached and downscaled.',{
  src:{type:'url',required:true,doc:'https URL, a path in your package such as "assets/logo.png", a data: URL, or a photo saved with the `photo` action.'},
  fit:{type:'enum',values:['fill','fit'],doc:'Default fill.'},
  placeholder:{type:'symbol',doc:'Symbol shown when there is no image. Default "photo".'},
  template:{type:'bool',doc:'Draw as a single-color glyph tinted with `foreground`.'},
  tap:{type:'action',doc:'Runs when the image is tapped, with where as `$value`: {"x": 0…1, "y": 0…1} from the top left. For remote screens.'}
});
def('gallery','Content','Swipe through images, with a page counter.',{
  images:{type:'array',required:true},fit:{type:'enum',values:['fill','fit']},counter:{type:'bool',doc:'Default true.'}
});
def('video','Content','Plays a video (MP4 or HLS).',{
  src:{type:'url',required:true},autoplay:{type:'bool',doc:'Default true.'},muted:{type:'bool',doc:'Default false.'},
  loop:{type:'bool',doc:'Default true.'},controls:{type:'bool',doc:'Show playback controls. Default true.'},
  fit:{type:'enum',values:['fill','fit'],doc:'Default fit.'},poster:{type:'url'}
});
def('media','Content','Picks the right player: a video when there is one, a gallery for several images, otherwise an image. Handles spoilers and full-screen viewing.',{
  video:{type:'url'},images:{type:'array'},image:{type:'url'},
  fit:{type:'enum',values:['fill','fit'],doc:'Default fill.'},
  inline:{type:'bool',doc:'Muted, looping, no controls: for feeds. Default false.'},
  spoiler:{type:'bool',doc:'Blur until tapped.'},
  badge:{type:'string',doc:'Small glass label in the bottom corner, e.g. "Video".'},
  badgeSymbol:{type:'symbol'},
  expandable:{type:'bool',doc:'Double-tap or pinch opens a full-screen viewer.'}
});
def('badge','Content','A small capsule label.',{
  text:{type:'string',required:true},symbol:{type:'symbol'},tint:{type:'color'},
  variant:{type:'enum',values:['tinted','glass','plain'],doc:'Default tinted.'}
});
def('stat','Content','A labelled value with an optional progress bar.',{
  label:{type:'string',required:true},value:{type:'string',required:true},symbol:{type:'symbol'},progress:{type:'number',doc:'0 to 1.'}
});
def('progress','Content','A spinner, or a bar when `value` is set.',{
  value:{type:'number',doc:'0 to 1. Leave out for a spinner.'},label:{type:'string'},tint:{type:'color'}
});
def('gauge','Content','A circular gauge for a single reading.',{
  value:{type:'number',required:true},min:{type:'number',doc:'Default 0.'},max:{type:'number',doc:'Default 1.'},
  label:{type:'string'},text:{type:'string',doc:'Text in the middle. Default the value.'},symbol:{type:'symbol'},tint:{type:'color'}
});
def('chart','Content','A line, area or bar chart.',{
  values:{type:'array',required:true,doc:'Numbers, or objects with `x` and `y`.'},
  kind:{type:'enum',values:['line','area','bar'],doc:'Default line.'},
  tint:{type:'color'},min:{type:'number'},max:{type:'number'},axes:{type:'bool',doc:'Default false.'}
});
def('avatar','Content','A round picture, or initials when there is none.',{
  image:{type:'url'},text:{type:'string'},size:{type:'number',doc:'Default 36.'},
  ring:{type:'color',doc:'Ring around the picture, e.g. green while someone speaks. Leave out (or null) for none.'},
  dimmed:{type:'bool',doc:'Fade the picture, e.g. for someone muted.'}
});
def('row','Content','A list row: symbol or image, title, subtitle and a trailing value.',{
  title:{type:'string',required:true},subtitle:{type:'string'},symbol:{type:'symbol'},image:{type:'url'},
  value:{type:'string',doc:'Trailing text.'},accessory:{type:'enum',values:['none','chevron','check']},
  checked:{type:'bool',doc:'Shows a checkmark when true.'},role:{type:'enum',values:['normal','destructive']},
  tint:{type:'color'},lines:{type:'number',doc:'Maximum title lines. Default 2.'}
});
def('comment','Content','A threaded comment or chat message.',{
  author:{type:'string',required:true},body:{type:'string',required:true},meta:{type:'string',doc:'e.g. "3h".'},
  score:{type:'string'},depth:{type:'number',doc:'Nesting level; draws thread lines.'},highlight:{type:'string',doc:'Badge next to the author, e.g. "OP".'},
  avatar:{type:'url'}
});
def('empty','Content','A centered message for empty, loading or error states.',{
  symbol:{type:'symbol'},title:{type:'string',required:true},message:{type:'string'},loading:{type:'bool'},
  children:{type:'nodes',doc:'Buttons under the message.'}
});
def('lyrics','Content','Lines that follow a playing timeline, karaoke style: the current line is large, earlier ones fade. Tap a line to jump to it. Without times, the lines scroll as plain text.',{
  lines:{type:'array',required:true,doc:'[{"time": seconds, "text": "…"}]. `time` is optional.'},
  timeline:{type:'string',doc:'Name of a screen timeline (see Screen `timelines`). Default "main".'},
  window:{type:'number',doc:'Lines shown at once. Default 6.'},
  synced:{type:'bool',doc:'Follow the timeline. Default true when lines have times.'},
  action:{type:'action',doc:'Runs when a line is tapped, with its time as `$value`.'}
});
def('clock','Content','The current time, updated every second.',{
  face:{type:'enum',values:['digital','minimal','analog'],doc:'Default digital.'},
  hours24:{type:'bool',doc:'24-hour time. Default true.'},
  date:{type:'bool',doc:'Show the date under the time. Default true.'},
  size:{type:'number',doc:'Digit size in points. Default 112 (digital) or 84 (minimal); the analog dial is 220 wide.'}
});
def('web','Content','Escape hatch: an HTML page from your package (or an https site) inside the native screen. The page talks to your app through window.onbun (window.winmore also works).',{
  src:{type:'url',required:true,doc:'e.g. "ui/chart.html".'},
  props:{type:'any',doc:'Sent to the page as onbun.props.'},
  transparent:{type:'bool',doc:'Let the screen show through. Default true.'},
  scroll:{type:'bool',doc:'Let the page scroll itself. Default true.'}
});

// ── Controls ─────────────────────────────────────────────────────────────────
def('button','Controls','A button. Use `glass` style for floating controls over content.',{
  label:{type:'string'},symbol:{type:'symbol'},
  variant:{type:'enum',values:['glass','prominent','bordered','plain','link'],doc:'Default bordered.'},
  buttonShape:{type:'enum',values:['capsule','circle','rounded'],doc:'Default capsule; circle for symbol-only buttons.'},
  size:{type:'enum',values:['small','regular','large'],doc:'Default regular.'},
  selected:{type:'bool',doc:'Highlights the button (tinted glass, filled symbol color).'},
  tint:{type:'color'},role:{type:'enum',values:['normal','destructive']},
  confirm:{type:'string',doc:'Ask this question before running the action.'},
  symbolSize:{type:'number',doc:'Symbol size in points. Default 17. Changing symbols (play and pause) animate.'},
  disabled:{type:'bool'},loading:{type:'bool',doc:'Shows a spinner instead of the label.'},
  action:{type:'action'}
});
def('pill','Controls','A glass capsule that groups several symbol buttons with dividers.',{
  children:{type:'nodes',required:true,doc:'`button` components; their own glass is ignored.'}
});
def('menu','Controls','A button that opens a menu.',{
  label:{type:'string'},symbol:{type:'symbol'},
  variant:{type:'enum',values:['glass','bordered','plain'],doc:'Default glass.'},
  buttonShape:{type:'enum',values:['capsule','circle'],doc:'Default capsule, circle when there is no label.'},
  chevron:{type:'bool',doc:'Show a small chevron after the label.'},
  items:{type:'items',required:true,doc:'Menu items (see Menu items).'}
});
def('toggle','Controls','An on/off switch. The new value is `$value` in the action.',{
  label:{type:'string',required:true},symbol:{type:'symbol'},value:{type:'bool',required:true},action:{type:'action',required:true}
});
def('slider','Controls','A slider. The action runs when you let go, with the value as `$value`.',{
  label:{type:'string'},symbol:{type:'symbol'},value:{type:'number',required:true},
  min:{type:'number',doc:'Default 0.'},max:{type:'number',doc:'Default 100.'},step:{type:'number'},
  live:{type:'bool',doc:'Also run the action while dragging (at most about 8 times a second).'},
  axis:{type:'enum',values:['horizontal','vertical'],doc:'vertical draws a tall fader, like a mixer channel. Default horizontal.'},
  tint:{type:'color'},disabled:{type:'bool'},
  action:{type:'action',required:true}
});
def('scrubber','Controls','A media position bar that keeps moving between updates from the PC. Drag to seek; a tap never jumps. Reads a screen timeline (see Screen `timelines`).',{
  timeline:{type:'string',doc:'Name of a screen timeline. Default "main".'},
  times:{type:'bool',doc:'Show elapsed and remaining time. Default true.'},
  compact:{type:'bool',doc:'A thinner bar.'},
  tint:{type:'color'},
  action:{type:'action',doc:'Runs when you let go, with the new position in seconds as `$value`.'}
},{example:{type:'scrubber',timeline:'main',action:{command:'seek',value:'$value'}}});
def('stepper','Controls','Minus and plus buttons around a value. The new value is `$value`.',{
  label:{type:'string',required:true},value:{type:'number',required:true},min:{type:'number'},max:{type:'number'},step:{type:'number'},action:{type:'action',required:true}
});
def('picker','Controls','Choose one option. The chosen value is `$value` in the action.',{
  label:{type:'string'},value:{type:'any',required:true},options:{type:'options',required:true},
  variant:{type:'enum',values:['segmented','menu','inline'],doc:'Default segmented.'},
  action:{type:'action',required:true},disabled:{type:'bool'}
});
def('field','Controls','A text field bound to a screen variable. It can type with the PC keyboard.',{
  bind:{type:'string',required:true,doc:'Screen variable that holds the text, e.g. "query" (read it as "$ui.query").'},
  placeholder:{type:'string'},prefix:{type:'string',doc:'Fixed text before the field, e.g. "r/".'},
  symbol:{type:'symbol',doc:'Leading symbol.'},
  keyboard:{type:'enum',values:['default','search','url','number','email'],doc:'Default default.'},
  submit:{type:'action',doc:'Runs on Return, with the text as `$value`.'},
  pcKeyboard:{type:'bool',doc:'Show the PC keyboard button. Default true.'},
  clearable:{type:'bool',doc:'Show a clear button. Default true.'},
  secure:{type:'bool'},multiline:{type:'bool'},
  leading:{type:'node',doc:'A control before the field, e.g. a scope menu.'}
});
def('link','Controls','Opens a web page on the phone.',{
  label:{type:'string',required:true},url:{type:'url',required:true},symbol:{type:'symbol'}
});

// ── Screen ───────────────────────────────────────────────────────────────────
// The root of ui/screen.json. Not a component; described here for validation and docs.
const SCREEN={
  type:{type:'enum',values:['screen'],required:true},
  title:{type:'string',doc:'Shown in the app bar on PC and as the default navigation title.'},
  chrome:{type:'enum',values:['standard','fullscreen'],doc:'standard keeps Onbun\'s margins and music volume bar. fullscreen gives the app the whole content area and reaches the bottom edge: a scroll runs under the edge and keeps the margin as space after its last item, and an element that fills the height with a background or gradient extends that background to the edge while its content stays inside the margin. Default standard.'},
  background:{type:'color',doc:'Screen color. Default black.'},
  surface:{type:'color',doc:'Color of `card` and `section` surfaces. Default #1C1C1E.'},
  accent:{type:'color',doc:'Selected and highlighted states. Default blue.'},
  state:{type:'object',doc:'Initial screen variables, read as "$ui.name" and changed with the `set` action.'},
  let:{type:'object',doc:'Named values worked out from data, e.g. {"unread": {"count": "$messages"}}; read them as "$unread". Sheets and covers can have their own `let`.'},
  bar:{type:'object',doc:'Floating glass bar: {leading:[…], trailing:[…]}. Use glass buttons, menus and pills.'},
  accessory:{type:'node',doc:'Shown under the bar, e.g. a search field.'},
  body:{type:'node',required:true},
  sheets:{type:'object',doc:'Named sheets: {name: {title, body, detents:["medium","large"]}}. Open with {"sheet":"name"}.'},
  covers:{type:'object',doc:'Named full-screen pages: {name: {bar, body, background}}. Open with {"cover":"name","params":…}.'},
  refresh:{type:'object',doc:'How often the phone asks for data: {interval: 1.5, fast: 0.45, fastWhen: "$loading"} in seconds.'},
  timelines:{type:'object',doc:'Media positions that keep moving between updates: {"main": {"track": "$song.id", "position": "$song.current", "duration": "$song.duration", "playing": "$song.playing"}} (seconds). `scrubber` and `lyrics` follow them.'},
  persist:{type:'array',doc:'Screen variables this phone remembers between launches, e.g. ["face", "theme"].'},
  backdrop:{type:'url',doc:'An image (usually album art) whose colors tint the whole screen background.'},
  appear:{type:'action',doc:'Runs when the screen appears.'}
};

// ── Actions ──────────────────────────────────────────────────────────────────
// An action is one object, or a list run in order (a failing command stops the list).
const ACTIONS={
  command:{doc:'Sends a command to your app on the PC: {"command":"open","value":…}. Optional "app" sends it to another app, "result":"name" stores the reply in a screen variable, and "onError" runs an action if it fails (the error message is $error).',keys:['command','value','app','result','onError']},
  set:{doc:'Sets a screen variable: {"set":"query","value":""}.',keys:['set','value']},
  toggle:{doc:'Flips a true/false screen variable: {"toggle":"showSearch"}.',keys:['toggle']},
  sheet:{doc:'Opens a named sheet: {"sheet":"places"}.',keys:['sheet','params']},
  cover:{doc:'Opens a named full-screen page; its bindings can read "$params": {"cover":"post","params":"$post"}.',keys:['cover','params']},
  dismiss:{doc:'Closes the sheet or page this action runs in: {"dismiss":true}.',keys:['dismiss']},
  open:{doc:'Opens a web page on the phone: {"open":"$post.url"}.',keys:['open']},
  copy:{doc:'Copies text, or an image given as a data: URL or {"kind":"image","data":…}: {"copy":"$post.url"}.',keys:['copy']},
  paste:{doc:'Reads the phone clipboard into a screen variable as {"kind":"text"|"image","data":…} (images as a PNG data: URL under 2 MB), or null: {"paste":"clip"}. The phone may ask once for permission.',keys:['paste']},
  photo:{doc:'Lets you choose a photo, keeps a copy on this phone and stores its path in a screen variable, for `image`: {"photo":"background","maxSize":1600}. Cancelling stops the list.',keys:['photo','maxSize']},
  haptic:{doc:'Plays a haptic: light, medium, heavy, selection, success, warning, error.',keys:['haptic']},
  refresh:{doc:'Asks the PC for fresh data now: {"refresh":true}.',keys:['refresh']},
  if:{doc:'Runs `then` or `else`: {"if":"$saved","then":…,"else":…}.',keys:['if','then','else']},
  keyboard:{doc:'Hides the phone keyboard: {"keyboard":"hide"}.',keys:['keyboard']}
};

// ── Expressions ──────────────────────────────────────────────────────────────
const OPERATORS={
  eq:'[a, b] equal',ne:'[a, b] not equal',gt:'[a, b] a > b',gte:'[a, b] a ≥ b',lt:'[a, b] a < b',lte:'[a, b] a ≤ b',
  not:'a — true when a is falsy',and:'[a, b, …] all truthy',or:'[a, b, …] first truthy value',
  if:'[test, then, else]',has:'a — not null, not empty',count:'a — length of a list or text',
  in:'[value, list] — list contains value (or text contains text)',startsWith:'[text, prefix]',
  concat:'[a, b, …] joins as text',coalesce:'[a, b, …] first value that is not null',
  add:'[a, b]',sub:'[a, b]',mul:'[a, b]',div:'[a, b]',min:'[a, b]',max:'[a, b]',
  lower:'text',upper:'text',join:'[list, separator]',first:'list',last:'list',
  find:'[list, path, value] — the first element whose path equals value, e.g. {"find": ["$members", "id", "$params"]}',
  slice:'[list, start, count] — part of a list',range:'n — [0, 1, … n-1]',round:'a — nearest whole number',floor:'a — rounded down',
  format:'{"format": "count|age|date|time|duration|percent|bytes|number", "value": …}'
};
const FILTERS=['count','age','date','time','duration','percent','bytes','number','upper','lower','json'];

// ── Validation ───────────────────────────────────────────────────────────────
const MAX_NODES=8000,MAX_DEPTH=48;
const isBinding=value=>typeof value==='string'&&(/^\$[A-Za-z_][\w]*(\.[\w]+|\[\d+\])*$/.test(value)||/\{\{[^}]+\}\}/.test(value));
const isOperator=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length>=1&&Object.keys(value).every(k=>k in OPERATORS||k==='value')&&Object.keys(value).some(k=>k in OPERATORS);
const isExpression=value=>isBinding(value)||isOperator(value);
const COLOR_RE=/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SYMBOL_RE=/^[a-z0-9.]{1,80}$/;

function createValidator(){
  const errors=[];let nodes=0;
  const fail=(at,message)=>{if(errors.length<40)errors.push(`${at}: ${message}`);};
  function checkValue(spec,value,at){
    if(value==null)return;
    if(isExpression(value))return;
    switch(spec.type){
      case 'string':if(typeof value!=='string'&&typeof value!=='number')fail(at,'must be text');break;
      case 'number':if(typeof value!=='number'||!Number.isFinite(value))fail(at,'must be a number');break;
      case 'bool':if(typeof value!=='boolean')fail(at,'must be true or false');break;
      case 'color':if(typeof value!=='string'||!(COLORS.includes(value)||COLOR_RE.test(value)))fail(at,`must be a color (${COLORS.slice(0,6).join(', ')}…, or #RRGGBB)`);break;
      case 'symbol':if(typeof value!=='string'||!SYMBOL_RE.test(value))fail(at,'must be an SF Symbol name like "star.fill"');break;
      case 'url':if(typeof value!=='string'||!(/^https:\/\//.test(value)||/^[\w-][\w./-]*$/.test(value)&&!value.includes('..')))fail(at,'must be an https URL or a path inside the package');break;
      case 'enum':if(!spec.values.includes(value))fail(at,`must be one of ${spec.values.join(', ')}`);break;
      case 'array':if(!Array.isArray(value))fail(at,'must be a list');break;
      case 'object':if(typeof value!=='object'||Array.isArray(value))fail(at,'must be an object');break;
      case 'node':node(value,at);break;
      case 'nodes':if(!Array.isArray(value))fail(at,'must be a list of components');else value.forEach((child,i)=>node(child,`${at}[${i}]`));break;
      case 'action':action(value,at);break;
      case 'items':items(value,at);break;
      case 'options':if(!Array.isArray(value))fail(at,'must be a list of {value, label}');else value.forEach((o,i)=>{if(!o||typeof o!=='object'||!('value' in o)||!('label' in o))fail(`${at}[${i}]`,'needs value and label');});break;
    }
  }
  function action(value,at){
    if(Array.isArray(value)){value.forEach((step,i)=>action(step,`${at}[${i}]`));return;}
    if(!value||typeof value!=='object'){fail(at,'must be an action object');return;}
    const kind=Object.keys(ACTIONS).find(k=>k in value);
    if(!kind){fail(at,`unknown action; use one of ${Object.keys(ACTIONS).join(', ')}`);return;}
    for(const k of Object.keys(value))if(!ACTIONS[kind].keys.includes(k))fail(at,`"${k}" is not used by the ${kind} action`);
    if(kind==='if'){if(value.then)action(value.then,at+'.then');if(value.else)action(value.else,at+'.else');}
    if(kind==='command'&&value.onError)action(value.onError,at+'.onError');
  }
  function items(value,at){
    if(isExpression(value))return;
    if(!Array.isArray(value)){fail(at,'must be a list of menu items');return;}
    value.forEach((item,i)=>{
      const here=`${at}[${i}]`;
      if(!item||typeof item!=='object'){fail(here,'must be a menu item');return;}
      if(item.divider===true)return;
      if(item.section!==undefined){items(item.items||[],here+'.items');return;}
      if(item.each!==undefined){if(!item.item)fail(here,'"each" needs an "item" template');return;}
      if(item.label==null)fail(here,'needs a label');
      if(item.action)action(item.action,here+'.action');
      if(item.items)items(item.items,here+'.items');
    });
  }
  function node(value,at,depth=0){
    if(++nodes>MAX_NODES){fail(at,'the screen is too large');return;}
    if(depth>MAX_DEPTH){fail(at,'components are nested too deeply');return;}
    if(!value||typeof value!=='object'||Array.isArray(value)){fail(at,'must be a component object with a "type"');return;}
    const spec=C[value.type];
    if(!spec){fail(at,`unknown component "${value.type}"`);return;}
    const here=`${at}<${value.type}>`;
    for(const [name,prop] of Object.entries(spec.props))if(prop.required&&value[name]==null)fail(here,`needs "${name}"`);
    for(const [name,v] of Object.entries(value)){
      if(name==='type')continue;
      const prop=spec.props[name]||COMMON[name];
      if(!prop){fail(here,`"${name}" is not a ${value.type} property`);continue;}
      if(prop.type==='node'){if(v!=null)node(v,`${here}.${name}`,depth+1);}
      else if(prop.type==='nodes'){if(!Array.isArray(v))fail(`${here}.${name}`,'must be a list of components');else v.forEach((child,i)=>node(child,`${here}.${name}[${i}]`,depth+1));}
      else checkValue(prop,v,`${here}.${name}`);
    }
    if(value.type==='split'&&Array.isArray(value.children)&&value.children.length!==2)fail(here,'needs exactly two children');
  }
  function screen(value){
    if(!value||typeof value!=='object'||value.type!=='screen'){fail('screen','the root must be {"type":"screen", …}');return;}
    for(const [name,prop] of Object.entries(SCREEN))if(prop.required&&value[name]==null)fail('screen',`needs "${name}"`);
    for(const [name,v] of Object.entries(value)){
      if(name==='$schema')continue;// editor autocomplete
      const prop=SCREEN[name];
      if(!prop){fail('screen',`"${name}" is not a screen property`);continue;}
      if(name==='body'||name==='accessory')node(v,'screen.'+name);
      else if(name==='bar'){
        for(const side of Object.keys(v||{})){if(!['leading','trailing'].includes(side))fail('screen.bar',`"${side}" must be leading or trailing`);else checkValue({type:'nodes'},v[side],`screen.bar.${side}`);}
      }else if(name==='sheets'||name==='covers'){
        for(const [key,page] of Object.entries(v||{})){
          const at=`screen.${name}.${key}`;
          if(!page||typeof page!=='object'||!page.body){fail(at,'needs a body');continue;}
          node(page.body,at+'.body');
          if(page.bar)for(const side of Object.keys(page.bar))checkValue({type:'nodes'},page.bar[side],`${at}.bar.${side}`);
          if(page.accessory)node(page.accessory,at+'.accessory');
          for(const k of Object.keys(page))if(!['title','body','bar','accessory','let','detents','background'].includes(k))fail(at,`"${k}" is not a ${name==='sheets'?'sheet':'cover'} property`);
        }
      }else if(name==='appear')action(v,'screen.appear');
      else checkValue(prop,v,'screen.'+name);
    }
  }
  return {screen,node,errors};
}
function validateScreen(screen){
  const validator=createValidator();validator.screen(screen);
  return validator.errors;
}

module.exports={COMPONENTS:C,COMMON,SCREEN,ACTIONS,OPERATORS,FILTERS,COLORS,TEXT_STYLES,validateScreen,isExpression};

},
"main":function(module,exports,require){
// onbun-pack: packs an Onbun app folder into a .wmapp file, with the same checks Onbun makes before
// installing it (manifest, paths, size, entry module, Kit screen).
//
//   node onbun-pack.cjs [app-folder] [--out <dir>] [--tag <git tag>]
//
// app-folder defaults to the current folder; a repository with its app in one subfolder works too.
// --out   where to write <id>-<version>.wmapp (default: the current folder)
// --tag   fail unless the tag names the manifest version (v1.2.0 or 1.2.0), for release workflows
// In GitHub Actions it also sets the step outputs file, id, name and version.
//
// Creators download the standalone copy from https://onbun.app/tools/onbun-pack.cjs (Node 18 or later,
// no dependencies). That copy is generated from this file by scripts/build-site.cjs.
const fs=require('node:fs');
const path=require('node:path');
const {packApp}=require('../companion/apps.cjs');

function fail(message){console.error(`onbun-pack: ${message}`);process.exit(1);}
function parse(argv){
  const options={folder:null,out:process.cwd(),tag:null};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='-h'||arg==='--help'){console.log('Usage: node onbun-pack.cjs [app-folder] [--out <dir>] [--tag <git tag>]');process.exit(0);}
    else if(arg==='--out'||arg==='--tag'){if(argv[i+1]==null)fail(`${arg} needs a value.`);options[arg.slice(2)]=argv[++i];}
    else if(arg.startsWith('-'))fail(`Unknown option ${arg}.`);
    else if(options.folder)fail('Give one app folder.');
    else options.folder=arg;
  }
  return options;
}
// The app folder: the given one if it has a manifest, else its only subfolder that has one.
function appFolder(start){
  const dir=path.resolve(start);
  if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())fail(`${start} is not a folder.`);
  if(fs.existsSync(path.join(dir,'manifest.json')))return dir;
  const found=fs.readdirSync(dir,{withFileTypes:true})
    .filter(entry=>entry.isDirectory()&&!entry.name.startsWith('.')&&entry.name!=='node_modules'&&fs.existsSync(path.join(dir,entry.name,'manifest.json')))
    .map(entry=>path.join(dir,entry.name));
  if(found.length===1)return found[0];
  if(found.length>1)fail(`Several app folders in ${start}: ${found.map(f=>path.basename(f)).join(', ')}. Name the one to pack.`);
  fail(`No manifest.json in ${start} or its subfolders.`);
}

const options=parse(process.argv.slice(2));
const folder=appFolder(options.folder||'.');
let result;
try{result=packApp(folder);}catch(error){fail(`${path.relative(process.cwd(),folder)||'.'}: ${error.message}`);}
const {manifest,data,files,fileName}=result;
if(options.tag!=null&&options.tag.replace(/^refs\/tags\//,'').replace(/^v/,'')!==manifest.version)
  fail(`The tag ${options.tag} doesn't match the manifest version ${manifest.version}. Bump "version" in manifest.json or tag v${manifest.version}.`);
fs.mkdirSync(options.out,{recursive:true});
const file=path.join(options.out,fileName);
fs.writeFileSync(file,data);
console.log(`Packed ${manifest.name} ${manifest.version}: ${files} files, ${(data.length/1024).toFixed(0)} KB`);
console.log(file);
if(process.env.GITHUB_OUTPUT)
  fs.appendFileSync(process.env.GITHUB_OUTPUT,`file=${path.resolve(file)}\nid=${manifest.id}\nname=${manifest.name}\nversion=${manifest.version}\n`);

}
};
const __cache={};
function __require(name){
  if(!Object.prototype.hasOwnProperty.call(__modules,name))return require(name);
  if(!__cache[name]){const module={exports:{}};__cache[name]=module;__modules[name](module,module.exports,__require);}
  return __cache[name].exports;
}
__require('main');
