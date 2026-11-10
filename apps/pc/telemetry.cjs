const {execFile}=require('node:child_process');
const path=require('node:path');
function networkRates(current,previous,seconds){
  return current.map(n=>{
    const last=previous.find(p=>p.id===n.id);
    const rate=key=>last&&seconds>0&&n[key]>=last[key]?(n[key]-last[key])/seconds:null;
    return {...n,download:rate('received'),upload:rate('sent')};
  });
}
function createTelemetry(){
  let latest={temperatures:[],network:[],available:false},previous=[],lastTime=0,pending=null,child=null,closed=false;
  return {
    read(){return latest;},
    poll(){
      if(closed||pending||process.platform!=='win32')return pending||Promise.resolve();
      pending=new Promise(resolve=>{
        const helper=path.join(__dirname.replace(/app\.asar(?=[\\/])/,'app.asar.unpacked'),'telemetry.ps1');
        child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper],{windowsHide:true,timeout:12000},(error,stdout)=>{
          if(!closed){
            try{
              if(error)throw error;
              const raw=JSON.parse(stdout.replace(/^\uFEFF/,'')),now=performance.now();
              const network=Array.isArray(raw.network)?raw.network:[];
              latest={available:true,temperatures:(Array.isArray(raw.temperatures)?raw.temperatures:[]).filter(t=>Number.isFinite(t.celsius)&&t.celsius>-50&&t.celsius<200),network:networkRates(network,previous,(now-lastTime)/1000)};
              previous=network;lastTime=now;
            }catch{latest={temperatures:[],network:[],available:false};previous=[];lastTime=0;}
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
