const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const EVENTS=['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','PermissionRequest','Stop','SessionEnd'];
function configure(provider,dataDir,enable=true,home=os.homedir()){
 const folder=provider==='codex'?(process.env.CODEX_HOME||path.join(home,'.codex')):path.join(home,'.claude');
 const file=path.join(folder,provider==='codex'?'hooks.json':'settings.json');
 fs.mkdirSync(folder,{recursive:true});
 const raw=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
 const config=raw?JSON.parse(raw):{};config.hooks||={};
 const script=path.join(dataDir,'winmore-agent-hook.cjs'),spool=path.join(dataDir,'events');
 if(enable){fs.copyFileSync(path.join(__dirname,'progress.cjs'),path.join(dataDir,'progress.cjs'));fs.copyFileSync(path.join(__dirname,'hook.cjs'),script);}
 // JSON quoting is for the hook command parser, not a shell launched by WinMore.
 const command=`node "${script.replaceAll('\\','/')}" ${provider} "${spool.replaceAll('\\','/')}"`;
 for(const event of [...EVENTS,...(provider==='codex'?['Interrupt']:[])]){
  const entries=config.hooks[event]||[];
  const kept=entries.map(group=>({...group,hooks:(group.hooks||[]).filter(h=>!String(h.command||'').includes('winmore-agent-hook.cjs'))})).filter(g=>g.hooks.length);
  if(enable)kept.push({hooks:[{type:'command',command,timeout:event==='PermissionRequest'?120:3}]});
  if(kept.length)config.hooks[event]=kept;else delete config.hooks[event];
 }
 if(raw)fs.writeFileSync(file+'.winmore-backup-'+Date.now(),raw,{flag:'wx'});
 fs.writeFileSync(file+'.winmore-tmp',JSON.stringify(config,null,2)+'\n');fs.renameSync(file+'.winmore-tmp',file);
}
module.exports={configure};
