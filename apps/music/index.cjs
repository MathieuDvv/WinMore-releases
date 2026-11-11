// YouTube Music package: the PC plays music in a hidden window; the phone browses and controls it.
const {readMusicSnapshot,musicURL,navigateMusicPage,setMusicVolume,validateVolume,playQueueItem,validateQueueTarget}=require('./music.cjs');
const {createLyrics,readYouTubeMusicLyrics}=require('./lyrics.cjs');
const {createBrowse,artwork}=require('./browse.cjs');

function activate(ctx){
  const {BrowserWindow}=ctx.electron;
  const music=new BrowserWindow({show:false,width:1200,height:760,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  music.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  music.on('close',event=>{if(!ctx.isQuitting()){event.preventDefault();music.hide();}});
  const run=script=>music.webContents.executeJavaScript(script,true);
  let snapshot=null,reading=null,browsing=false,lastRead=0;
  const browse=createBrowse();
  const read=()=>{
    if(!reading)reading=run(`(${readMusicSnapshot.toString()})()`).catch(()=>null).finally(()=>{reading=null;});
    return reading;
  };
  const navigate=async url=>{browsing=true;try{await music.loadURL(url);}finally{browsing=false;}};
  navigate('https://music.youtube.com').catch(error=>ctx.log.warn('Music player could not load:',error.message));
  const lyrics=createLyrics({readPageLyrics:videoId=>run(`(${readYouTubeMusicLyrics.toString()})(${JSON.stringify(videoId)})`)});
  // The island and the phone both poll; one read of the page serves both within a moment.
  async function current(){
    if(!browsing&&Date.now()-lastRead>300){const result=await read();lastRead=Date.now();if(result){snapshot=result;browse.observe({...result,loading:false});}}
    return snapshot;
  }
  const openURL=async(action,value)=>{
    const url=musicURL(action,value);
    if(browsing)throw Error('Music is loading. Try again in a moment.');
    await run(`(${navigateMusicPage.toString()})(${JSON.stringify(action)},${JSON.stringify(value)},${JSON.stringify(url)})`);
  };
  async function state(){
      await current();
      const info={...(snapshot||{title:'Open YouTube Music on PC',artist:'Sign in and choose something to play',playing:false}),loading:browsing};
      // Lyrics for the current song (looked up once per song, in the background) and its queue.
      if(info.videoId)info.lyrics=lyrics.get({videoId:info.videoId,title:info.videoTitle||info.title,artist:info.videoAuthor||String(info.artist||'').split(' • ')[0],duration:info.videoDuration||info.duration});
      info.queue=info.queue||[];
      // The island tints its waveform with the cover's colour.
      if(info.artwork)info.accent=ctx.accentColor(info.artwork);
      return {music:info,volume:info.volume||{available:false,value:0,muted:false}};
  }
  return {
    state,
    // The PC island: the playing song in the resting pill, and a player card when it opens.
    async island(){
      const {music:info,volume}=await state();
      const active=!!(info.playing||info.artwork);
      return {
        priority:info.playing?20:active?10:1,
        compact:active?{title:info.title,image:info.artwork,accent:info.accent,activity:!!info.playing}:null,
        expanded:{title:info.title,subtitle:info.artist,image:info.artwork,placeholder:'note',
          buttons:[{symbol:'previous',action:'previous',label:'Previous'},{symbol:info.playing?'pause':'play',action:'toggle',label:info.playing?'Pause':'Play'},{symbol:'next',action:'next',label:'Next'}],
          slider:{action:'volume',value:volume.value,label:'YouTube Music volume',symbol:'speaker',disabled:!volume.available,display:volume.available?(volume.muted?'Mute':volume.value+'%'):'—'},
          footer:{label:'Open YouTube Music',action:'setup',note:'Runs on PC'}}
      };
    },
    // The phone's Music screen (ui/screen.json).
    async data(){
      const {music:info,volume}=await state();
      const shown=browse.view(snapshot);
      return {
        ...info,
        artwork:artwork(info.artwork,1200),
        queue:(info.queue||[]).map(song=>({...song,image:artwork(song.image,160)})),
        // What identifies the playing song for the position bar (the title can lag behind the audio).
        track:info.videoId||`${info.title}\u001f${info.artist}`,
        volume,
        ...shown
      };
    },
    async command(action,value){
      // Older iOS builds sent system/volume; every volume request goes to YouTube Music's own player.
      if(action==='volume'){const result=await run(`(${setMusicVolume.toString()})(${validateVolume(value)})`);if(snapshot)snapshot.volume=result;return;}
      if(action==='setup'){music.show();return;}
      // Opening a tile sends the whole item, so the PC knows which album or playlist is open.
      if(action==='open'&&value&&typeof value==='object'){await openURL('open',String(value.id));browse.open(value);return;}
      if(action==='play'){await openURL('open',String(value?.id??value));return;}
      if(action==='playCollection'){await openURL('open',browse.pick(value).id);return;}
      if(action==='refreshHome'){browse.reloadHome();await openURL('page','home');return;}
      if(['search','page','open'].includes(action)){
        await openURL(action,value);
        if(action!=='open')browse.leave();
        if(action==='page'&&value==='home')browse.reloadHome();
        return;
      }
      if(action==='queue'){const target=validateQueueTarget(value);await run(`(${playQueueItem.toString()})(${JSON.stringify(target.id)},${JSON.stringify(target.index)})`);return;}
      if(action==='back'){browse.leave();if(music.webContents.navigationHistory.canGoBack())music.webContents.navigationHistory.goBack();return;}
      if(action==='more'){await run('window.scrollBy(0, window.innerHeight * .8)');return;}
      if(action==='seek'){
        if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Invalid track position.');
        // The player's own seek fetches unbuffered audio; setting currentTime past the buffer can be ignored.
        await run(`(()=>{const api=document.querySelector('#movie_player')||document.querySelector('ytmusic-player')?.playerApi;const v=document.querySelector('video');const d=Number(api?.getDuration?.())||v?.duration;const t=Math.min(${value},Number.isFinite(d)?Math.max(0,d-1):${value});if(typeof api?.seekTo==='function')api.seekTo(t,true);else if(v)v.currentTime=t;})()`);return;
      }
      const scripts={toggle:`(()=>{const v=document.querySelector('video');if(!v)throw Error('Choose a track on PC first');return v.paused?v.play():v.pause()})()`,next:`document.querySelector('.next-button')?.click()`,previous:`document.querySelector('.previous-button')?.click()`};
      if(!scripts[action])throw Error('Unknown music command');
      await run(scripts[action]);
    },
    close(){if(!music.isDestroyed())music.destroy();}
  };
}
module.exports={activate};
