const path=require('node:path'),fs=require('node:fs/promises');
const clean=(v,n=500)=>typeof v==='string'?v.slice(0,n):'';
const STATUS={pending:'pending',todo:'pending',in_progress:'in_progress',running:'in_progress',completed:'completed',done:'completed',cancelled:'cancelled'};
function task(value,index=0){
 if(!value||typeof value!=='object')return null;
 const title=clean(value.step||value.content||value.subject||value.title);if(!title)return null;
 return {id:clean(String(value.id??value.taskId??index),120),title,status:STATUS[value.status]||'pending'};
}
function file(value,kind='Updated file'){
 if(typeof value!=='string'||!value.length||value.length>2000||/[\x00-\x1f]/.test(value))return null;
 return {id:value,path:value,name:path.win32.basename(value.replaceAll('/','\\')),kind};
}
// Capture only progress metadata, never source code, file contents or shell output.
function extractTool(name,input={},output={}){
 name=String(name||'').split(/__|\/|\./).at(-1).toLowerCase();
 if(typeof input==='string'){try{input=JSON.parse(input);}catch{input={command:input};}}
 if(!input||typeof input!=='object')return {};
 const delta={};
 const list=name==='update_plan'?input.plan:['todowrite','todo_write'].includes(name)?input.todos:null;
 if(Array.isArray(list))delta.tasks=list.slice(0,100).map(task).filter(Boolean);
 if(name==='taskcreate'){
  const result=output?.task||output,id=result?.id||result?.taskId;
  if(id)delta.updates=[task({...input,id,status:result.status||'pending'})].filter(Boolean);
 }
 if(name==='taskupdate'&&input.taskId)delta.updates=[{id:clean(String(input.taskId),120),...(input.subject?{title:clean(input.subject)}:{}),status:input.status==='deleted'?'deleted':STATUS[input.status]}];
 const files=[];
 if(['write','edit','multiedit','create_file','edit_file'].includes(name))files.push(file(input.file_path||input.filePath||input.path,name==='write'?'Written file':'Updated file'));
 if(name==='apply_patch')for(const match of String(input.command||input.patch||'').matchAll(/^\*\*\* (?:Add|Update) File: (.+)$/gm))files.push(file(match[1]));
 let artifacts=output?.artifacts||output?.structuredContent?.artifacts;
 if(!artifacts&&Array.isArray(output?.content))for(const block of output.content){if(block.type==='text')try{const parsed=JSON.parse(block.text);if(Array.isArray(parsed.artifacts)){artifacts=parsed.artifacts;break;}}catch{}}
 if(Array.isArray(artifacts))for(const a of artifacts.slice(0,30))files.push(file(a?.path||a?.filePath,'Artifact'));
 if(files.some(Boolean))delta.files=files.filter(Boolean).slice(0,30);
 return delta;
}
function mergeProgress(previous={},delta={}){
 let tasks=Array.isArray(delta.tasks)?delta.tasks.map(task).filter(Boolean):(previous.tasks||[]);
 for(const update of delta.updates||[]){const at=tasks.findIndex(t=>t.id===update.id);if(update.status==='deleted'){tasks=tasks.filter(t=>t.id!==update.id);continue;}if(at>=0)tasks=tasks.map((t,i)=>i===at?{...t,...update,status:update.status||t.status}:t);else if(update.title)tasks=[...tasks,{...update,status:update.status||'pending'}];}
 const files=new Map((previous.files||[]).map(f=>[f.path,f]));for(const f of delta.files||[])if(f?.path)files.set(f.path,f);
 return {tasks:tasks.slice(0,100),files:[...files.values()].slice(-40)};
}
function summarize(progress={}){
 const tasks=(progress.tasks||[]).map((t,i)=>({...t,id:t.id||String(i),symbol:t.status==='completed'?'checkmark.circle.fill':t.status==='in_progress'?'arrow.triangle.2.circlepath':t.status==='cancelled'?'minus.circle':'circle',tint:t.status==='completed'?'#76DDB1':t.status==='in_progress'?'#BBA5FF':'#919AB1'}));
 const total=tasks.filter(t=>t.status!=='cancelled').length,done=tasks.filter(t=>t.status==='completed').length;
 return {tasks,files:progress.files||[],hasTasks:total>0,hasFiles:!!progress.files?.length,fraction:total?done/total:0,label:total?`${done} / ${total} steps`:''};
}
async function readClaudeTasks(home,listId){
 if(typeof listId!=='string'||!/^[-a-zA-Z0-9_]{1,150}$/.test(listId))return null;
 const dir=path.join(home,'tasks',listId);let names;try{names=await fs.readdir(dir);}catch{return null;}
 const tasks=[];for(const name of names.filter(n=>/^[\w-]+\.json$/.test(n)).slice(0,100))try{const p=path.join(dir,name),s=await fs.lstat(p);if(!s.isFile()||s.size>65536)continue;const t=task(JSON.parse(await fs.readFile(p,'utf8')));if(t)tasks.push(t);}catch{}
 return tasks.length?tasks:null;
}
module.exports={extractTool,mergeProgress,summarize,readClaudeTasks};
function consumeTranscript(event,state){
 const p=event.payload||{};
 const parse=value=>{if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{return {};}};
 state.pending||=new Map();
 const record=(id,name,input)=>{if(state.pending.size>200)state.pending.delete(state.pending.keys().next().value);state.pending.set(id,{name,input});};
 const finish=(id,output,failed)=>{const call=state.pending.get(id);if(!call)return;state.pending.delete(id);if(!failed)state.progress=mergeProgress(state.progress,extractTool(call.name,call.input,parse(output)));};
 if(event.type==='response_item'){
  if(['function_call','custom_tool_call'].includes(p.type))record(p.call_id,p.name,p.arguments||p.input);
  if(['function_call_output','custom_tool_call_output'].includes(p.type))finish(p.call_id,p.output,p.is_error||p.isError||/^Error[: ]/i.test(String(p.output||'')));
 }
 const content=event.message?.content;
 if(Array.isArray(content))for(const block of content){
  if(block.type==='tool_use')record(block.id,block.name,block.input);
  if(block.type==='tool_result')finish(block.tool_use_id,typeof block.content==='string'?block.content:undefined,block.is_error);
 }
 const texts=p.type==='message'&&p.role==='assistant'?p.content?.map(c=>c.text||''):event.type==='assistant'&&Array.isArray(content)?content.filter(c=>c.type==='text').map(c=>c.text):[];
 const linked=[];for(const text of texts||[])for(const m of String(text).matchAll(/\[[^\]]*\]\(<?([^\)\n]+?)>?\)/g)){
  const target=m[1].replace(/:\d+(?::\d+)?$/,'');
  if(!/^https?:|^plugin:|^app:/i.test(target)&&/\.[a-zA-Z0-9]{1,10}$/.test(target))linked.push(file(target,'Linked output'));
 }
 if(linked.some(Boolean))state.progress=mergeProgress(state.progress,{files:linked.filter(Boolean)});
 return state;
}
module.exports.consumeTranscript=consumeTranscript;
