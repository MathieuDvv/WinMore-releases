function localURL(value){const url=new URL(value);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use a local OpenCode address, for example http://127.0.0.1:4096.');return url.origin;}
function createOpenCode(config,fetcher=fetch){
 const {extractTool,mergeProgress}=require('./progress.cjs');
 const base=localURL(config.url||'http://127.0.0.1:4096');
 let version=0;
 const progressCache=new Map();
 async function request(route,body){
  const headers={};if(config.password)headers.Authorization='Basic '+Buffer.from((config.username||'opencode')+':'+config.password).toString('base64');
  if(body)headers['Content-Type']='application/json';
  const response=await fetcher(base+route,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(2500),redirect:'error'});
  if(!response.ok)throw Error(`OpenCode returned ${response.status}. Check the server address and password.`);
  if(response.status===204)return null;
  return response.json();
 }
 return {
  async progress(sessionId){
   const previous=progressCache.get(sessionId);if(previous&&Date.now()-previous.at<5000)return previous.value;
   const sid=encodeURIComponent(sessionId),routes=version===2?['/api/session/'+sid+'/message?limit=50&order=desc','/api/experimental/artifacts?sessionID='+sid]:['/session/'+sid+'/message?limit=50','/session/'+sid+'/todo'];
   const results=await Promise.allSettled(routes.map(route=>request(route)));
   let value={};const messagesResult=results[0].status==='fulfilled'?results[0].value:null;
   let messages=messagesResult?.data??messagesResult;
   if(Array.isArray(messages)){
    messages=[...messages].sort((a,b)=>(a.time?.created||a.info?.time?.created||0)-(b.time?.created||b.info?.time?.created||0));
    for(const message of messages.slice(-50))for(const part of message.content||message.parts||[]){
     if(part.type==='tool'&&part.state?.status==='completed')value=mergeProgress(value,extractTool(part.name||part.tool,part.state.input,part.state.output||part.state.metadata));
    }
   }
   const secondary=results[1].status==='fulfilled'?results[1].value:null,list=secondary?.data??secondary;
   if(Array.isArray(list)){
    if(version===1)value=mergeProgress(value,{tasks:list});
    else value=mergeProgress(value,{files:list.filter(a=>a.sessionID===sessionId&&typeof (a.url||a.entry)==='string').slice(0,30).map(a=>({id:a.id,path:a.url||a.entry,name:String(a.title||a.entry||'Artifact').slice(0,500),kind:'Published artifact'}))});
   }
   if(progressCache.size>=48)progressCache.delete(progressCache.keys().next().value);
   progressCache.set(sessionId,{at:Date.now(),value});return value;
  },
  async poll(){
   if(!version){try{const test=await request('/api/session?limit=1');if(!Array.isArray(test.data))throw Error('Not V2');version=2;}catch{version=1;}}
   if(version===2){
    const [listing,activeResult,permissionResult]=await Promise.all([request('/api/session?limit=100'),request('/api/session/active'),request('/api/permission/request')]);
    const sessions=listing.data,active=activeResult.data??activeResult,permissions=permissionResult.data??permissionResult;
    if(!Array.isArray(sessions)||!Array.isArray(permissions)||!active||typeof active!=='object')throw Error('Unsupported OpenCode V2 response.');
    const ids=new Set(Array.isArray(active)?active.map(s=>typeof s==='string'?s:s.sessionID||s.id):Object.keys(active));
    return {rows:sessions.filter(s=>ids.has(s.id)||permissions.some(p=>p.sessionID===s.id)||s.outcome).map(s=>({id:'opencode:'+s.id,sessionId:s.id,provider:'opencode',task:s.title||'OpenCode task',cwd:s.location?.directory||'',model:typeof s.model==='object'?s.model.id||s.model.modelID||'':'',startedAt:s.time?.created||Date.now(),updatedAt:s.time?.updated||Date.now(),status:permissions.some(p=>p.sessionID===s.id)?'Needs approval':ids.has(s.id)?'Running':s.outcome==='succeeded'?'Completed':s.outcome==='interrupted'?'Interrupted':'Ended',source:'Local server · elapsed since session created'})),permissions:permissions.map(p=>({id:'opencode:'+p.id,remoteId:p.id,sessionId:p.sessionID,provider:'opencode',tool:p.action||'Permission',detail:JSON.stringify({resources:p.resources,metadata:p.metadata,message:p.message},null,2),actionable:true}))};
   }
   const [sessions,statuses,permissions]=await Promise.all([request('/session'),request('/session/status'),request('/permission')]);
   if(!Array.isArray(sessions)||!Array.isArray(permissions))throw Error('Unsupported OpenCode server response.');
   const rows=sessions.filter(s=>statuses[s.id]?.type==='busy'||statuses[s.id]?.type==='retry'||permissions.some(p=>p.sessionID===s.id)||Date.now()-(s.time?.updated||0)<3600000).map(s=>({id:'opencode:'+s.id,sessionId:s.id,provider:'opencode',task:s.title||'OpenCode task',cwd:s.directory||'',startedAt:s.time?.created||Date.now(),updatedAt:s.time?.updated||Date.now(),status:permissions.some(p=>p.sessionID===s.id)?'Needs approval':statuses[s.id]?.type==='retry'?'Retrying':statuses[s.id]?.type==='busy'?'Running':'Completed',source:'Local server · elapsed since session created'}));
   return {rows,permissions:permissions.map(p=>({id:'opencode:'+p.id,remoteId:p.id,sessionId:p.sessionID,provider:'opencode',tool:p.permission||'Permission',detail:JSON.stringify({patterns:p.patterns,metadata:p.metadata},null,2),actionable:true}))};
  },
  reply(id,behavior,sessionId){return request(version===2?'/api/session/'+encodeURIComponent(sessionId)+'/permission/'+encodeURIComponent(id)+'/reply':'/permission/'+encodeURIComponent(id)+'/reply',{reply:behavior==='allow'?'once':'reject'});}
 };
}
module.exports={createOpenCode,localURL};
