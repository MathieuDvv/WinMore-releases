// Best-effort discovery for sessions started before hooks were enabled. Never claims liveness.
const fs=require('node:fs/promises'),path=require('node:path');
const {consumeTranscript}=require('./progress.cjs');
async function discover(root,provider,now=Date.now()){
 const files=[];let budget=3000;
 async function walk(dir,depth=0){
  if(depth>5||budget<=0)return;
  let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{return;}
  for(const e of entries){if(--budget<=0)break;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p,depth+1);else if(e.isFile()&&e.name.endsWith('.jsonl'))files.push(p);}
 }
 await walk(root);
 const recent=[];
 for(const file of files){try{const stat=await fs.stat(file);if(now-stat.mtimeMs<3600000)recent.push({file,stat});}catch{}}
 recent.sort((a,b)=>b.stat.mtimeMs-a.stat.mtimeMs);
 const result=[];
 for(const {file,stat} of recent.slice(0,24)){
  let handle;try{
   handle=await fs.open(file,'r');const size=Math.min(stat.size,256*1024),buffer=Buffer.alloc(size),start=stat.size-size;
   await handle.read(buffer,0,size,start);const lines=buffer.toString('utf8').split('\n');if(start)lines.shift();
   let sessionId=path.basename(file,'.jsonl'),cwd='',task='',model='',startedAt=stat.mtimeMs,status='Recently active',progressState={progress:{}};
   for(const line of lines){let e;try{e=JSON.parse(line);}catch{continue;}
    const p=e.payload||{};
    if(e.type==='session_meta'){sessionId=p.id||sessionId;cwd=p.cwd||cwd;}
    if(e.sessionId)sessionId=e.sessionId;if(e.cwd)cwd=e.cwd;
    if(e.type==='turn_context')model=p.model||model;
    const prompt=provider==='codex'?(e.type==='event_msg'&&p.type==='user_message'?p.message:null):(e.type==='user'&&!e.isMeta&&typeof e.message?.content==='string'?e.message.content:null);
    if(prompt){task=prompt.slice(0,2000);startedAt=Date.parse(e.timestamp)||stat.mtimeMs;status='Recently active';progressState={progress:{}};}
    consumeTranscript(e,progressState);
    if(e.type==='event_msg'&&['task_complete','turn_aborted'].includes(p.type))status=p.type==='task_complete'?'Completed':'Interrupted';
    if(provider==='claude'&&e.type==='assistant'&&e.message?.stop_reason==='end_turn')status='Completed';
   }
   if(task)result.push({id:provider+':'+sessionId,provider,sessionId,cwd,task,model,startedAt,updatedAt:stat.mtimeMs,status,progress:progressState.progress,source:'Session log · status may be delayed'});
  }catch{}finally{await handle?.close();}
 }
 return result;
}
module.exports={discover};
