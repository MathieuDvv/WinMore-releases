const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const path=require('node:path');
// Per-application Windows audio. One persistent PowerShell helper owns the Core Audio COM objects.
function validateMixerCommand(action,value,knownIds){
 if(!value||typeof value!=='object'||typeof value.id!=='string')throw Error('Choose an app from the mixer.');
 if(value.id!=='master'&&!knownIds.has(value.id))throw Error('That app is no longer playing audio. Refresh the mixer.');
 if(action==='volume'){
  if(typeof value.value!=='number'||!Number.isFinite(value.value)||value.value<0||value.value>100)throw Error('Volume must be between 0 and 100.');
  return {id:value.id,volume:Math.round(value.value)};
 }
 if(action==='mute'){
  if(typeof value.muted!=='boolean')throw Error('Choose mute or unmute.');
  return {id:value.id,muted:value.muted};
 }
 throw Error('Unknown mixer control.');
}
// The helper reports executable paths; the phone only receives ids, names and icons.
function presentMixer(raw,{ownPath,icons={}}={}){
 const apps=(raw?.apps||[]).map(app=>({
  id:app.id,
  name:app.path&&ownPath&&app.path.toLowerCase()===ownPath.toLowerCase()?'WinMore · YouTube Music':app.name==='Electron'&&app.path?path.win32.basename(app.path,'.exe'):app.name,
  volume:app.volume,muted:app.muted,active:app.active,system:app.system,icon:app.path?icons[app.path.toLowerCase()]||null:null
 })).sort((a,b)=>(b.active-a.active)||(a.system-b.system)||a.name.localeCompare(b.name));
 return {available:true,device:raw?.device||'Speakers',volume:raw?.volume??0,muted:raw?.muted===true,apps};
}
function createMixer({iconFor}={}){
 if(process.platform!=='win32')return {read:async()=>({available:false,device:'',volume:0,muted:false,apps:[],error:'The audio mixer requires Windows.'}),command:async()=>{throw Error('The audio mixer requires Windows.');},close(){}};
 let child,lines,seq=0,closed=false,knownIds=new Set(),latest=null;
 const pending=new Map(),icons={},iconLoads=new Set();
 function start(){
  const helper=path.join(__dirname.replace(/app\.asar(?=[\\/])/,'app.asar.unpacked'),'mixer.ps1');
  child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'-OwnerPid',String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  lines=createInterface({input:child.stdout});
  lines.on('line',line=>{let reply;try{reply=JSON.parse(line);}catch{return;}const request=pending.get(reply.seq);if(!request)return;pending.delete(reply.seq);clearTimeout(request.timer);reply.error?request.reject(Error(reply.error)):request.resolve(reply);});
  const failed=()=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('The Windows audio helper stopped.'));}pending.clear();child=null;};
  child.on('exit',failed);child.on('error',failed);child.stderr.resume();
 }
 function call(request){
  if(closed)return Promise.reject(Error('Mixer closed.'));
  if(!child)start();
  const id=++seq;
  return new Promise((resolve,reject)=>{
   // The first call compiles the COM bindings, so allow a generous start-up time.
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('Windows audio did not respond.'));},15000);
   pending.set(id,{resolve,reject,timer});
   child.stdin.write(JSON.stringify({...request,seq:id})+'\n');
  });
 }
 function loadIcons(apps){
  if(!iconFor)return;
  for(const app of apps){
   const key=app.path?.toLowerCase();
   if(!key||key in icons||iconLoads.has(key))continue;
   iconLoads.add(key);
   iconFor(app.path).then(icon=>{icons[key]=icon;}).catch(()=>{icons[key]=null;}).finally(()=>iconLoads.delete(key));
  }
 }
 return {
  async read(){
   try{
    const {mixer}=await call({op:'read'});
    knownIds=new Set((mixer.apps||[]).map(app=>app.id));loadIcons(mixer.apps||[]);
    latest=presentMixer(mixer,{ownPath:process.execPath,icons});
   }catch(error){latest={...(latest||{device:'',volume:0,muted:false,apps:[]}),available:false,error:error.message};}
   return latest;
  },
  async command(action,value){await call({op:'set',...validateMixerCommand(action,value,knownIds)});},
  close(){closed=true;child?.stdin.end();child?.kill();}
 };
}
module.exports={createMixer,validateMixerCommand,presentMixer};
