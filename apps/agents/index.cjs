const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {configure}=require('./setup.cjs'),{discover}=require('./transcripts.cjs'),{createOpenCode,localURL}=require('./opencode.cjs');
const LABELS={codex:'Codex',claude:'Claude Code',opencode:'OpenCode'};
const {decorate,createCompletions,createTransientError}=require('./presentation.cjs');
const {mergeProgress,readClaudeTasks}=require('./progress.cjs');
const duration=ms=>{const s=Math.max(0,Math.floor(ms/1000));return s<60?s+'s':s<3600?Math.floor(s/60)+'m '+s%60+'s':Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m';};
function activate(ctx){
 const root=path.join(ctx.dataDir,'events'),configFile=path.join(ctx.dataDir,'config.json');fs.mkdirSync(root,{recursive:true});
 let config={};try{config=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch{}
 const historyFile=path.join(ctx.dataDir,'completions.json');let history=[];try{history=JSON.parse(fs.readFileSync(historyFile,'utf8'));if(!Array.isArray(history))history=[];}catch{}
 const completions=createCompletions(history,items=>fs.writeFileSync(historyFile,JSON.stringify(items)));
 let rows=[],permissions=[],errors=[],closed=false,busy=false,lastDiscovery=0,passive=[],openCode=null;
 const sessions=new Map();
 const errorNotice=createTransientError();
 function client(){let password='';try{if(config.secret)password=ctx.electron.safeStorage.decryptString(Buffer.from(config.secret,'base64'));}catch{}return createOpenCode({...config,password});}
 async function poll(){
  if(busy||closed)return;busy=true;
  try{
   await fsp.writeFile(path.join(root,'heartbeat'),'');
   const now=Date.now(),pending=[];
   const files=await fsp.readdir(root);
   const events=[];
   for(const file of files.filter(f=>/^[a-f0-9-]+\.json$/.test(f))){try{events.push({file,e:JSON.parse(await fsp.readFile(path.join(root,file),'utf8'))});}catch{}}
   events.sort((a,b)=>a.e.at-b.e.at);
   for(const {file,e} of events){
    try{
     if(now-e.at>86400000){await fsp.unlink(path.join(root,file));try{await fsp.unlink(path.join(root,e.id+'.reply'));}catch{}continue;}
     if(!LABELS[e.provider]||typeof e.sessionId!=='string')continue;
     const id=e.provider+':'+e.sessionId,previous=sessions.get(id);
     if(!previous||e.at>previous.updatedAt){
      const start=e.event==='UserPromptSubmit';
      const status=e.event==='Stop'?'Completed':e.event==='Interrupt'?'Interrupted':e.event==='SessionEnd'?(previous?.status==='Completed'?'Completed':'Ended'):e.event==='SessionStart'?'Idle':'Running';
      sessions.set(id,{id,sessionId:e.sessionId,provider:e.provider,cwd:e.cwd,model:e.model||previous?.model||'',task:e.prompt||previous?.task||'Task in progress',startedAt:start?e.at:previous?.startedAt||e.at,updatedAt:e.at,status,source:'Live hooks',tool:e.tool,taskListId:e.taskListId||previous?.taskListId,
       progress:mergeProgress(start?{}:previous?.progress,e.progress),capturedProgress:!start&&(previous?.capturedProgress||Object.keys(e.progress||{}).length>0)});
     }
     if(e.event==='PermissionRequest'&&e.expiresAt>now&&!fs.existsSync(path.join(root,e.id+'.reply'))&&!events.some(q=>q.e.provider===e.provider&&q.e.sessionId===e.sessionId&&q.e.at>e.at&&['PostToolUse','Stop','SessionEnd','UserPromptSubmit'].includes(q.e.event))){
      // The hook owns expiry; replies are tied to a unique invocation, never to a session alone.
      pending.push({...e,detail:e.detail||'',actionable:!!e.actionable});
     }
    }catch{}
   }
   if(now-lastDiscovery>10000){
    passive=(await Promise.all([discover(path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions'),'codex',now),discover(path.join(os.homedir(),'.claude','projects'),'claude',now)])).flat();lastDiscovery=now;
   }
   for(const [id,s] of sessions)if(now-s.updatedAt>86400000)sessions.delete(id);
   const merged=new Map(passive.map(s=>[s.id,s]));
   for(const [id,s] of sessions){const log=merged.get(id);merged.set(id,{...s,progress:!s.capturedProgress&&log?.startedAt>=s.startedAt?log.progress:s.progress,status:s.status==='Running'&&now-s.updatedAt>180000?'Status unknown':s.status});}
   for(const s of merged.values())if(s.provider==='claude'){const tasks=await readClaudeTasks(path.join(os.homedir(),'.claude'),s.taskListId||s.sessionId);if(tasks)s.progress=mergeProgress(s.progress,{tasks});}
   errors=[];let ocRows=[];
   if(config.openCode){try{openCode||=client();const oc=await openCode.poll();ocRows=oc.rows;pending.push(...oc.permissions);await Promise.all(ocRows.slice(0,6).map(async row=>{row.progress=await openCode.progress(row.sessionId);}));}catch(error){errors.push(error.message);}}
   for(const p of pending){const s=merged.get(p.provider+':'+p.sessionId);if(s)s.status='Needs approval';}
   permissions=pending;rows=[...merged.values(),...ocRows].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,48);
   completions.update(rows,now);
   errorNotice.set(errors.join(' '),now);
  }finally{busy=false;}
 }
 const fail=e=>{errors=[e.message];errorNotice.set(e.message);};
 const timer=setInterval(()=>poll().catch(fail),2000);timer.unref?.();poll().catch(fail);
 return {
  data(){
   const now=Date.now(),display=rows.map(s=>decorate(s,now)),finished=display.filter(s=>['Completed','Interrupted','Ended'].includes(s.status));
   return {host:os.hostname(),rows:display,active:display.filter(s=>!['Completed','Interrupted','Ended'].includes(s.status)),finished,
    completions:completions.items().filter(s=>!s.acknowledged).map(s=>decorate(s,now)),
    permissions:permissions.map(p=>({...decorate(p,now),actionable:p.actionable&&p.detail.length<=24000,detail:p.detail.slice(0,24000)})),
    count:rows.filter(s=>['Running','Retrying','Needs approval'].includes(s.status)).length,finishedCount:finished.length,approvalCount:permissions.length,
    errors:errorNotice.text(now),connectionError:errorNotice.latest(),setup:'Enable live hooks or connect OpenCode in PC Settings → Agent Watch.'};
  },
  async command(action,value){
   if(action==='acknowledge'){completions.acknowledge(value);return;}
   if(action!=='decide')throw Error('Agent Watch only accepts permission decisions.');
   if(!value||!['allow','deny'].includes(value.behavior))throw Error('Invalid decision.');
     const p=permissions.find(p=>p.id===value.id);
   if(!p||!p.actionable||p.detail.length>24000||(p.expiresAt&&(p.expiresAt<=Date.now()||!fs.existsSync(path.join(root,p.id+'.json')))))throw Error('This request expired or must be answered on the PC.');
   p.actionable=false;
   try{if(p.provider==='opencode'){
     const current=await openCode.poll();if(!current.permissions.some(q=>q.id===p.id))throw Error('This request was already answered.');
     await openCode.reply(p.remoteId,value.behavior,p.sessionId);
    }else await fsp.writeFile(path.join(root,p.id+'.reply'),JSON.stringify({behavior:value.behavior}),{flag:'wx'});
    permissions=permissions.filter(q=>q.id!==p.id);
   }catch(e){p.actionable=true;throw e;}
  },
  settings:{
   describe(){return {status:{label:'Local agent monitor',tone:'good'},items:[
    {type:'note',text:'Hook setup preserves other hooks and saves a backup. Node.js must be on PATH. Review and trust the hooks in Codex Settings → Hooks; reload Claude Code after setup. Approval waits up to 110 seconds, then returns to the normal PC prompt.'},
    ...['codex','claude'].flatMap(p=>[{type:'button',action:'enable-'+p,label:'Enable '+LABELS[p]+' hooks'},{type:'button',action:'disable-'+p,label:'Remove '+LABELS[p]+' hooks'}]),
    {type:'input',id:'url',label:'Existing OpenCode server',value:config.url||'http://127.0.0.1:4096'},
    {type:'input',id:'username',label:'OpenCode username',value:config.username||'opencode'},
    {type:'input',id:'password',label:'OpenCode password (blank keeps saved)',secret:true},
    {type:'button',action:'opencode',label:'Connect to OpenCode'},
    {type:'button',action:'disconnect',label:'Disconnect OpenCode'},
    {type:'note',text:'For a predictable address start your OpenCode TUI with --port 4096. Agent Watch follows that server; starting another server does not attach to an existing session. No prompt controls are provided.'}
   ]};},
   action(action,values={}){
    const match=/^(enable|disable)-(codex|claude)$/.exec(action);
    if(match){configure(match[2],ctx.dataDir,match[1]==='enable');return;}
    if(action==='disconnect'){config.openCode=false;openCode=null;}
    else if(action==='opencode'){
     const next={...config,url:localURL(values.url||'http://127.0.0.1:4096'),username:String(values.username||'opencode'),openCode:true};
     if(values.password){if(!ctx.electron.safeStorage.isEncryptionAvailable())throw Error('Windows credential encryption is unavailable.');next.secret=ctx.electron.safeStorage.encryptString(String(values.password)).toString('base64');}
     config=next;openCode=null;
    }else throw Error('Unknown setting.');
    fs.writeFileSync(configFile,JSON.stringify(config));lastDiscovery=0;
   }
  },
  close(){closed=true;clearInterval(timer);try{fs.unlinkSync(path.join(root,'heartbeat'));}catch{}}
 };
}
module.exports={activate,duration};
