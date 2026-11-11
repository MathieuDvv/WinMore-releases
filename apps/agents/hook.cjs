// Standalone Node hook. No listening port, terminal injection, or agent credentials.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {extractTool}=require('./progress.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const [provider,root]=process.argv.slice(2);if(!['codex','claude'].includes(provider)||!root)return;
 let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>1024*1024)return;}
 const input=JSON.parse(raw),event=input.hook_event_name;
 if(typeof input.session_id!=='string'||!event)return;
 fs.mkdirSync(root,{recursive:true});
 const id=crypto.randomUUID(),now=Date.now(),approval=event==='PermissionRequest';
 const detail=JSON.stringify(input.tool_input||{},null,2);
 const entry={id,provider,sessionId:input.session_id,event,at:now,cwd:String(input.cwd||''),model:String(input.model||''),
  taskListId:provider==='claude'?String(process.env.CLAUDE_CODE_TASK_LIST_ID||input.session_id):'',
  progress:event==='PostToolUse'?extractTool(input.tool_name,input.tool_input,input.tool_response):{},
  prompt:String(input.prompt||'').slice(0,2000),tool:String(input.tool_name||''),
  detail:approval?detail.slice(0,24000):'',
  // Questions and plan editors need richer replies. They stay on the computer.
  actionable:approval&&detail.length<=24000&&!['AskUserQuestion','ExitPlanMode'].includes(input.tool_name),expiresAt:now+110000};
 const file=path.join(root,id+'.json');fs.writeFileSync(file+'.tmp',JSON.stringify(entry));fs.renameSync(file+'.tmp',file);
 if(!entry.actionable)return;
 const reply=path.join(root,id+'.reply');
 try{
  while(Date.now()<entry.expiresAt){
   if(fs.existsSync(reply)){
    const decision=JSON.parse(fs.readFileSync(reply,'utf8'));
    if(['allow','deny'].includes(decision.behavior))process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PermissionRequest',decision:{behavior:decision.behavior,...(decision.behavior==='deny'?{message:'Declined from WinMore.'}:{})}}}));
    return;
   }
   // Only the running monitor may hold an approval. Otherwise return to the normal prompt.
   const heartbeat=fs.statSync(path.join(root,'heartbeat')).mtimeMs;if(Date.now()-heartbeat>10000)return;
   await pause(250);
  }
 }finally{for(const p of [file,reply])try{fs.unlinkSync(p);}catch{}}
}
if(require.main===module)main().catch(()=>{}).finally(()=>{if(!process.stdout.writableEnded)process.stdout.end();});
