// YouTube Music package: the PC plays music in a hidden window; the phone browses and controls it.
const {readMusicSnapshot,musicURL,navigateMusicPage,setMusicVolume,validateVolume,playQueueItem,validateQueueTarget}=require('./music.cjs');
const {createLyrics,readYouTubeMusicLyrics}=require('./lyrics.cjs');

function activate(ctx){
  const {BrowserWindow}=ctx.electron;
  const music=new BrowserWindow({show:false,width:1200,height:760,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  music.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  music.on('close',event=>{if(!ctx.isQuitting()){event.preventDefault();music.hide();}});
  const run=script=>music.webContents.executeJavaScript(script,true);
  let snapshot=null,reading=null,browsing=false;
  const read=()=>{
    if(!reading)reading=run(`(${readMusicSnapshot.toString()})()`).catch(()=>null).finally(()=>{reading=null;});
    return reading;
  };
  const navigate=async url=>{browsing=true;try{await music.loadURL(url);}finally{browsing=false;}};
  navigate('https://music.youtube.com').catch(error=>ctx.log.warn('Music player could not load:',error.message));
  const lyrics=createLyrics({readPageLyrics:videoId=>run(`(${readYouTubeMusicLyrics.toString()})(${JSON.stringify(videoId)})`)});
  return {
    async state(){
      if(!browsing){const result=await read();if(result)snapshot=result;}
      const info={...(snapshot||{title:'Open YouTube Music on PC',artist:'Sign in and choose something to play',playing:false}),loading:browsing};
      // Lyrics for the current song (looked up once per song, in the background) and its queue.
      if(info.videoId)info.lyrics=lyrics.get({videoId:info.videoId,title:info.videoTitle||info.title,artist:info.videoAuthor||String(info.artist||'').split(' • ')[0],duration:info.videoDuration||info.duration});
      info.queue=info.queue||[];
      // The island tints its waveform with the cover's colour.
      if(info.artwork)info.accent=ctx.accentColor(info.artwork);
      return {music:info,volume:info.volume||{available:false,value:0,muted:false}};
    },
    async command(action,value){
      // Older iOS builds sent system/volume; every volume request goes to YouTube Music's own player.
      if(action==='volume'){const result=await run(`(${setMusicVolume.toString()})(${validateVolume(value)})`);if(snapshot)snapshot.volume=result;return;}
      if(action==='setup'){music.show();return;}
      if(['search','page','open'].includes(action)){
        const url=musicURL(action,value);
        if(browsing)throw Error('Music is loading. Try again in a moment.');
        await run(`(${navigateMusicPage.toString()})(${JSON.stringify(action)},${JSON.stringify(value)},${JSON.stringify(url)})`);
        return;
      }
      if(action==='queue'){const target=validateQueueTarget(value);await run(`(${playQueueItem.toString()})(${JSON.stringify(target.id)},${JSON.stringify(target.index)})`);return;}
      if(action==='back'){if(music.webContents.navigationHistory.canGoBack())music.webContents.navigationHistory.goBack();return;}
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
