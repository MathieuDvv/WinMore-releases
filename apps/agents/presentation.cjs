const path=require('node:path');
const {summarize}=require('./progress.cjs');
const THEMES={
 codex:{ai:'Codex',logo:'assets/codex.png',tint:'#B1ADD3',wash:'#222532',gradient:['#262836D9','#1C212CD9']},
 claude:{ai:'Claude Code',logo:'assets/claude.png',tint:'#CCA997',wash:'#29262C',gradient:['#2C2931D9','#20212AD9']},
 opencode:{ai:'OpenCode',logo:'assets/opencode.png',tint:'#97C2B5',wash:'#222B2B',gradient:['#252E30D9','#1B232AD9']}
};
const duration=ms=>{const s=Math.max(0,Math.floor(ms/1000));return s<60?s+'s':s<3600?Math.floor(s/60)+'m '+s%60+'s':Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m';};
function decorate(s,now){return {...s,...THEMES[s.provider],progress:summarize(s.progress),project:path.win32.basename(String(s.cwd||'').replaceAll('/','\\'))||'Local task',elapsed:duration((['Completed','Interrupted','Ended'].includes(s.status)?s.updatedAt:now)-s.startedAt)};}
function createTransientError(ttl=8000){
 let message='',since=0;
 return {set(value,now=Date.now()){if(value!==message){message=value;since=now;}},text(now=Date.now()){return message&&now-since<ttl?message:'';},latest:()=>message};
}
// Only observed transitions create alerts. Loading old completed logs is quiet.
function createCompletions(initial=[],save=()=>{}){
 const observed=new Map();let items=initial.slice(0,20);
 return {
  update(rows,now=Date.now()){
   let changed=false;
   for(const row of rows){
    const previous=observed.get(row.id),key=row.id+':'+row.startedAt+':'+row.updatedAt;
    if(row.status==='Completed'&&previous&&previous.status!=='Completed'&&['Running','Retrying','Needs approval','Recently active','Status unknown'].includes(previous.status)&&!items.some(i=>i.key===key)){
     items.unshift({...row,key,finishedAt:row.updatedAt,noticedAt:now,acknowledged:false});items=items.slice(0,20);changed=true;
    }
    observed.set(row.id,{status:row.status,at:now});
   }
   for(const [id,value] of observed)if(now-value.at>86400000)observed.delete(id);
   if(changed)save(items);
  },
  items:()=>items,
  acknowledge(key){const item=items.find(i=>i.key===key);if(!item)throw Error('Completion is no longer available.');item.acknowledged=true;save(items);}
 };
}
module.exports={THEMES,decorate,duration,createCompletions,createTransientError};
