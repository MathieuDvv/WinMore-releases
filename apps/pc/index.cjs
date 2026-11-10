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
  let blocker=null,last=cpuTimes(),load=0,page='overview';
  const sampler=setInterval(()=>{const now=cpuTimes(),all=now.all-last.all;load=all>0?Math.round(100*(1-(now.idle-last.idle)/all)):load;last=now;},2000);
  telemetry.poll();
  const sensors=setInterval(()=>telemetry.poll(),5000);
  const awake=()=>blocker!==null&&powerSaveBlocker.isStarted(blocker);
  const stat=(label,value,symbol)=>({type:'stat',label,value,symbol});
  return {
    state:()=>({}),
    async view(){
      const used=os.totalmem()-os.freemem(),data=telemetry.read();
      const navigation={type:'row',children:['overview','temperatures','network'].map(p=>({type:'button',label:(page===p?'• ':'')+p[0].toUpperCase()+p.slice(1),action:'page',value:p}))};
      let children;
      if(page==='temperatures')children=[{type:'section',title:'Temperatures',children:data.temperatures.length?data.temperatures.map(t=>stat(`${t.name} · ${t.source}`,t.celsius.toFixed(1)+' °C','thermometer')):[stat('Hardware sensors','Unavailable','thermometer'),{type:'text',style:'caption',text:'Run Libre Hardware Monitor or Open Hardware Monitor with WMI enabled to expose supported CPU / GPU sensors. Firmware thermal zones are shown when available.'}]}];
      else if(page==='network')children=[{type:'section',title:'Network activity',children:data.network.length?data.network.flatMap(n=>[
        {type:'text',text:n.name+' · '+n.link,style:'title'},
        stat('Download',speed(n.download),'arrow.down'),stat('Upload',speed(n.upload),'arrow.up'),
        stat('Received since adapter reset',gigabytes(n.received),'network'),stat('Sent since adapter reset',gigabytes(n.sent),'network')
      ]):[stat('Connected adapters',data.available?'None detected':'Unavailable','network')]}];
      else {
        const audio=await mixer.read();
        children=[{type:'section',title:os.hostname(),children:[
          {...stat('Processor',load+'%','cpu'),progress:load/100},
          {...stat('Memory',`${gigabytes(used)} of ${gigabytes(os.totalmem())}`,'memorychip'),progress:used/os.totalmem()},
          stat('Up for',duration(os.uptime()),'clock')
        ]},{type:'section',title:'PC volume',children:audio.available?[
          {type:'slider',label:audio.device||'Master volume',symbol:'speaker.wave.2',action:'volume',value:audio.volume,min:0,max:100,step:1},
          {type:'toggle',label:'Mute PC',symbol:'speaker.slash',action:'mute',on:audio.muted}
        ]:[stat('Master volume','Unavailable','speaker.slash')]},
        {type:'section',title:'Controls',children:[
          {type:'toggle',label:'Keep PC awake',symbol:'cup.and.saucer',action:'awake',on:awake()},
          {type:'button',label:'Lock PC',symbol:'lock',action:'lock',role:'destructive',confirm:'Lock your PC now?'}
        ]}];
      }
      return {type:'stack',children:[navigation,...children]};
    },
    async command(action,value){
      if(action==='page'){
        if(!['overview','temperatures','network'].includes(value))throw Error('Unknown PC page.');
        page=value;return;
      }
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
