// macOS and Linux readings for the PC app: master volume, network transfer and (Linux) temperatures.
const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
const run=(command,args)=>new Promise((resolve,reject)=>execFile(command,args,{timeout:5000},(error,stdout)=>error?reject(error):resolve(String(stdout))));
const clamp=value=>Math.max(0,Math.min(100,Math.round(Number(value))));

// Master output volume, 0–100, in the same shape as the Windows mixer's master channel.
function createMasterAudio({platform=process.platform,exec=run}={}){
  const unavailable=error=>({available:false,device:'',volume:0,muted:false,apps:[],error});
  const mac={
    async read(){
      const [volume,muted]=(await exec('osascript',['-e','set s to get volume settings','-e','return (output volume of s as text) & "," & (output muted of s as text)'])).trim().split(',');
      if(volume==='missing value')return unavailable('This output has no adjustable volume.');
      return {available:true,device:'Output',volume:clamp(volume),muted:muted==='true',apps:[]};
    },
    set:value=>exec('osascript',['-e',`set volume output volume ${clamp(value)}`]),
    mute:muted=>exec('osascript',['-e',`set volume output muted ${muted?'true':'false'}`])
  };
  // PipeWire (wpctl) first, then PulseAudio (pactl).
  const wpctl={
    async read(){
      const text=await exec('wpctl',['get-volume','@DEFAULT_AUDIO_SINK@']),match=/Volume:\s*([\d.]+)/.exec(text);
      if(!match)throw Error('No output volume.');
      return {available:true,device:'Output',volume:clamp(Number(match[1])*100),muted:/MUTED/.test(text),apps:[]};
    },
    set:value=>exec('wpctl',['set-volume','@DEFAULT_AUDIO_SINK@',`${clamp(value)}%`]),
    mute:muted=>exec('wpctl',['set-mute','@DEFAULT_AUDIO_SINK@',muted?'1':'0'])
  };
  const pactl={
    async read(){
      const volume=/(\d+)%/.exec(await exec('pactl',['get-sink-volume','@DEFAULT_SINK@'])),muted=/yes/.test(await exec('pactl',['get-sink-mute','@DEFAULT_SINK@']));
      if(!volume)throw Error('No output volume.');
      return {available:true,device:'Output',volume:clamp(volume[1]),muted,apps:[]};
    },
    set:value=>exec('pactl',['set-sink-volume','@DEFAULT_SINK@',`${clamp(value)}%`]),
    mute:muted=>exec('pactl',['set-sink-mute','@DEFAULT_SINK@',muted?'1':'0'])
  };
  const candidates=platform==='darwin'?[mac]:platform==='linux'?[wpctl,pactl]:[];
  let backend=null;
  const pick=async()=>{
    if(backend)return backend.read();
    let lastError;
    for(const candidate of candidates){try{const value=await candidate.read();backend=candidate;return value;}catch(error){lastError=error;}}
    throw lastError||Error('Volume is not supported on this PC.');
  };
  return {
    async read(){try{return await pick();}catch(error){backend=null;return unavailable(error.message);}},
    async command(action,{id,value,muted}={}){
      if(id!=='master')throw Error('Only the master volume is available on this PC.');
      await pick();
      if(action==='volume')return backend.set(value);
      if(action==='mute')return backend.mute(!!muted);
      throw Error('Unknown volume command.');
    },
    close(){}
  };
}

// Cumulative bytes per network adapter, the same shape telemetry.ps1 reports.
function parseProcNetDev(text){
  return text.split('\n').slice(2).map(line=>line.trim()).filter(Boolean).map(line=>{
    const [name,rest]=line.split(':'),fields=rest.trim().split(/\s+/).map(Number);
    return {id:name,name,link:'',received:fields[0],sent:fields[8]};
  }).filter(n=>n.name!=='lo'&&!/^(veth|docker|br-|virbr)/.test(n.name)&&(n.received||n.sent));
}
function parseNetstat(text){
  const lines=text.trim().split('\n'),header=lines.shift()?.trim().split(/\s+/)||[];
  const at=name=>header.indexOf(name),seen=new Map();
  for(const line of lines){
    const cols=line.trim().split(/\s+/);
    // Link rows only (<Link#n>); address rows repeat the counters.
    if(!/^<Link#/.test(cols[2]||''))continue;
    const name=cols[0];if(/^(lo|gif|stf|utun|awdl|llw|anpi|ap|bridge)\d*/.test(name))continue;
    // Rows without an address have one column fewer than the header.
    const shift=cols.length<header.length?-1:0,received=Number(cols[at('Ibytes')+shift]),sent=Number(cols[at('Obytes')+shift]);
    if(Number.isFinite(received)&&Number.isFinite(sent)&&(received||sent))seen.set(name,{id:name,name,link:'',received,sent});
  }
  return [...seen.values()];
}
function linuxTemperatures(root='/sys/class/hwmon'){
  const temperatures=[];
  let chips=[];try{chips=fs.readdirSync(root);}catch{return temperatures;}
  for(const chip of chips){
    const dir=path.join(root,chip);let source=chip;
    try{source=fs.readFileSync(path.join(dir,'name'),'utf8').trim();}catch{}
    let files=[];try{files=fs.readdirSync(dir);}catch{continue;}
    for(const file of files.filter(f=>/^temp\d+_input$/.test(f))){
      try{
        const celsius=Number(fs.readFileSync(path.join(dir,file),'utf8'))/1000;
        let name=file.replace('_input','');try{name=fs.readFileSync(path.join(dir,file.replace('_input','_label')),'utf8').trim();}catch{}
        temperatures.push({name,source,celsius});
      }catch{}
    }
  }
  return temperatures;
}
async function readUnixSensors({platform=process.platform,exec=run,readFile=fs.promises.readFile}={}){
  if(platform==='linux')return {temperatures:linuxTemperatures(),network:parseProcNetDev(await readFile('/proc/net/dev','utf8'))};
  if(platform==='darwin')return {temperatures:[],network:parseNetstat(await exec('netstat',['-ibn']))};
  throw Error('Sensors are not supported on this PC.');
}
module.exports={createMasterAudio,readUnixSensors,parseProcNetDev,parseNetstat};
