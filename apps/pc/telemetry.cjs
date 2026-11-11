const {execFile}=require('node:child_process');
const path=require('node:path');
const {readUnixSensors}=require('./unix.cjs');
function networkRates(current,previous,seconds){
  return current.map(n=>{
    const last=previous.find(p=>p.id===n.id);
    const rate=key=>last&&seconds>0&&n[key]>=last[key]?(n[key]-last[key])/seconds:null;
    return {...n,download:rate('received'),upload:rate('sent')};
  });
}
function createTelemetry({platform=process.platform,readUnix=readUnixSensors}={}){
  let latest={temperatures:[],network:[],available:false},previous=[],lastTime=0,pending=null,child=null,closed=false;
  return {
    read(){return latest;},
    poll(){
      if(closed||pending)return pending||Promise.resolve();
      const accept=raw=>{
        const now=performance.now(),network=Array.isArray(raw.network)?raw.network:[];
        latest={available:true,temperatures:(Array.isArray(raw.temperatures)?raw.temperatures:[]).filter(t=>Number.isFinite(t.celsius)&&t.celsius>-50&&t.celsius<200),network:networkRates(network,previous,(now-lastTime)/1000)};
        previous=network;lastTime=now;
      };
      const reset=()=>{latest={temperatures:[],network:[],available:false};previous=[];lastTime=0;};
      if(platform!=='win32'){
        pending=readUnix({platform}).then(raw=>{if(!closed)accept(raw);},()=>{if(!closed)reset();}).finally(()=>{pending=null;});
        return pending;
      }
      pending=new Promise(resolve=>{
        const helper=path.join(__dirname.replace(/app\.asar(?=[\\/])/,'app.asar.unpacked'),'telemetry.ps1');
        child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper],{windowsHide:true,timeout:12000},(error,stdout)=>{
          if(!closed){
            try{
              if(error)throw error;
              accept(JSON.parse(stdout.replace(/^\uFEFF/,'')));
            }catch{reset();}
          }
          child=null;resolve();
        });
      }).finally(()=>{pending=null;});
      return pending;
    },
    close(){closed=true;child?.kill();}
  };
}
module.exports={createTelemetry,networkRates};
