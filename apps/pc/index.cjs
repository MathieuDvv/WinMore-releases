const os=require('node:os');
const {execFile}=require('node:child_process');
const {createMixer}=require('./mixer.cjs');
const {createTelemetry}=require('./telemetry.cjs');
function cpuTimes(){return os.cpus().reduce((total,cpu)=>{const t=cpu.times;total.idle+=t.idle;total.all+=t.user+t.nice+t.sys+t.idle+t.irq;return total;},{idle:0,all:0});}
const duration=seconds=>{const d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60);return d?`${d}d ${h}h`:h?`${h}h ${m}m`:`${m}m`;};
const gigabytes=bytes=>(bytes/1024**3).toFixed(1)+' GB';
const speed=value=>value===null?'Measuring…':value>=1024**2?(value/1024**2).toFixed(1)+' MB/s':(value/1024).toFixed(1)+' KB/s';
function activate(ctx, dependencies={}){
  const {powerSaveBlocker}=ctx.electron;
  const mixer=(dependencies.createMixer||createMixer)(),telemetry=(dependencies.createTelemetry||createTelemetry)();
  let blocker=null,last=cpuTimes(),load=0;
  const sampler=setInterval(()=>{const now=cpuTimes(),all=now.all-last.all;load=all>0?Math.round(100*(1-(now.idle-last.idle)/all)):load;last=now;},2000);
  telemetry.poll();
  const sensors=setInterval(()=>telemetry.poll(),5000);
  const awake=()=>blocker!==null&&powerSaveBlocker.isStarted(blocker);
  return {
    // The phone's PC screen (ui/screen.json): readings, already formatted for display.
    async data(){
      const used=os.totalmem()-os.freemem(),sensors=telemetry.read(),audio=await mixer.read();
      return {
        host:os.hostname(),
        cpu:{percent:load,fraction:load/100,text:load+'%'},
        memory:{fraction:used/os.totalmem(),text:`${gigabytes(used)} of ${gigabytes(os.totalmem())}`},
        uptime:duration(os.uptime()),
        audio:{available:!!audio.available,device:audio.device||'Master volume',volume:audio.volume??0,muted:audio.muted===true},
        awake:awake(),
        sensorsAvailable:!!sensors.available,
        temperatures:sensors.temperatures.map(t=>({label:`${t.name} · ${t.source}`,value:t.celsius.toFixed(1)+' °C'})),
        network:sensors.network.map(n=>({name:n.name,link:n.link,download:speed(n.download),upload:speed(n.upload),received:gigabytes(n.received),sent:gigabytes(n.sent)}))
      };
    },
    async command(action,value){
      // Always address the default Windows endpoint, never the music audio session.
      if(action==='volume'){await mixer.command('volume',{id:'master',value});return;}
      if(action==='mute'){await mixer.command('mute',{id:'master',muted:value});return;}
      if(action==='awake'){
        if(typeof value!=='boolean')throw Error('Choose awake or sleep.');
        if(value&&!awake())blocker=powerSaveBlocker.start('prevent-display-sleep');
        if(!value&&awake()){powerSaveBlocker.stop(blocker);blocker=null;}
        return;
      }
      if(action==='lock'){
        if(process.platform!=='win32')throw Error('Locking requires Windows.');
        await new Promise((resolve,reject)=>execFile('rundll32.exe',['user32.dll,LockWorkStation'],error=>error?reject(error):resolve()));return;
      }
      throw Error('Unknown PC command.');
    },
    close(){clearInterval(sampler);clearInterval(sensors);telemetry.close();mixer.close();if(awake())powerSaveBlocker.stop(blocker);}
  };
}
module.exports={activate};
