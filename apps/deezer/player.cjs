// The part of the Deezer app that runs inside deezer.com, in WinMore's hidden Deezer window.
// `deezerBridge` is sent to the page as source text and builds window.__winmore once per page load:
// it calls Deezer's own web API with the signed-in session and drives the page's player (dzPlayer).
// It must stay self-contained: it cannot use anything from this file or from Node.

function deezerBridge(){
  const endpoint='https://www.deezer.com/ajax/gw-light.php';
  let token=null,user=null,flowCache=null,flowMood='',extending=false;

  async function raw(method,apiToken,body){
    const response=await fetch(`${endpoint}?method=${encodeURIComponent(method)}&input=3&api_version=1.0&api_token=${encodeURIComponent(apiToken)}`,
      {method:'POST',credentials:'include',body:JSON.stringify(body||{})});
    if(!response.ok)throw Error('Deezer is not answering. Check the PC is online.');
    return response.json();
  }
  async function account(){
    const reply=await raw('deezer.getUserData','null');
    const result=reply.results||{},u=result.USER||{};
    token=result.checkForm||null;
    user={id:String(u.USER_ID||0),name:u.BLOG_NAME||'',picture:u.USER_PICTURE||'',offer:result.OFFER_NAME||''};
    return user;
  }
  const failed=error=>error&&!Array.isArray(error)&&Object.keys(error).length>0;
  async function gw(method,body){
    if(!token)await account();
    let reply=await raw(method,token,body);
    if(failed(reply.error)&&(reply.error.VALID_TOKEN_REQUIRED||reply.error.GATEWAY_ERROR||reply.error.NEED_USER_AUTH_REQUIRED)){
      await account();reply=await raw(method,token,body);
    }
    if(failed(reply.error)){const first=Object.values(reply.error)[0];throw Error(typeof first==='string'?first:'Deezer refused that.');}
    return reply.results;
  }
  async function signedIn(){
    if(!user||user.id==='0')await account();
    if(user.id==='0')throw Error('Sign in to Deezer on your PC first.');
    return user;
  }

  const song=t=>t&&t.SNG_ID?{id:String(t.SNG_ID),title:String(t.SNG_TITLE||'')+(t.VERSION?` ${t.VERSION}`:''),artist:t.ART_NAME||'',album:t.ALB_TITLE||'',
    albumId:t.ALB_ID?String(t.ALB_ID):null,artistId:t.ART_ID?String(t.ART_ID):null,picture:t.ALB_PICTURE||'',duration:Number(t.DURATION)||0,explicit:Number(t.EXPLICIT_LYRICS)===1}:null;

  // Gets the songs of something to play, as the player wants them (with their stream tokens).
  async function songs(source){
    const u=await signedIn();
    if(source.ids)return (await gw('song.getListData',{sng_ids:source.ids.map(String)})).data||[];
    if(source.album)return (await gw('song.getListByAlbum',{alb_id:String(source.album),nb:500})).data||[];
    if(source.playlist)return (await gw('playlist.getSongs',{playlist_id:String(source.playlist),nb:2000,start:0})).data||[];
    if(source.artist)return (await gw('artist.getTopTrack',{art_id:String(source.artist),nb:50})).data||[];
    if(source.favourites)return (await gw('favorite_song.getList',{user_id:u.id,nb:2000,start:0})).data||[];
    if(source.flow!=null){
      const mood=String(source.flow||'');
      // Playing the Flow preview shown on the phone plays exactly those songs.
      if(!mood&&flowCache&&flowCache.length){const cached=flowCache;flowCache=null;return cached;}
      return (await gw('radio.getUserRadio',mood?{user_id:u.id,config_id:mood}:{user_id:u.id})).data||[];
    }
    return [];
  }

  return {
    account,
    async tracks(source){return (await songs(source)).map(song).filter(Boolean);},
    async library(){
      const u=await signedIn();
      const [loved,ids,playlists,albums,artists,flow]=await Promise.all([
        gw('favorite_song.getList',{user_id:u.id,nb:500,start:0}),
        gw('song.getFavoriteIds',{nb:10000,start:0,checksum:null}),
        gw('deezer.pageProfile',{user_id:u.id,tab:'playlists',nb:100}),
        gw('deezer.pageProfile',{user_id:u.id,tab:'albums',nb:100}),
        gw('deezer.pageProfile',{user_id:u.id,tab:'artists',nb:100}),
        gw('radio.getUserRadio',{user_id:u.id}).catch(()=>({data:[]}))]);
      flowCache=flow.data||[];
      const tab=(page,name)=>((page&&page.TAB&&page.TAB[name])||{}).data||[];
      return {
        user:u,
        favTracks:(loved.data||[]).map(song).filter(Boolean),favCount:Number(loved.total)||0,
        favIds:(ids.data||[]).map(x=>String(x.SNG_ID)),
        playlists:tab(playlists,'playlists').filter(p=>String(p.PLAYLIST_ID)!==String(loved.playlist_id))
          .map(p=>({id:String(p.PLAYLIST_ID),title:p.TITLE||'',picture:p.PLAYLIST_PICTURE||'',pictureType:p.PICTURE_TYPE||'playlist',count:Number(p.NB_SONG)||0})),
        albums:tab(albums,'albums').map(a=>({id:String(a.ALB_ID),title:a.ALB_TITLE||'',artist:a.ART_NAME||'',picture:a.ALB_PICTURE||''})),
        artists:tab(artists,'artists').map(a=>({id:String(a.ART_ID),title:a.ART_NAME||'',picture:a.ART_PICTURE||''})),
        flow:flowCache.map(song).filter(Boolean)
      };
    },
    // What plays now, and what comes next.
    state(queueSize){
      const d=window.dzPlayer;
      if(!d||typeof d.getCurrentSong!=='function')return {ready:false};
      const current=d.getCurrentSong(),list=d.getTrackList()||[],index=Number(d.getTrackListIndex())||0,context=d.getContext()||{};
      const now=song(current);
      // Flow never ends: when its last songs start, ask Deezer for more.
      if(String(context.TYPE)==='stream_user'&&list.length-index<=2&&!extending&&user&&user.id!=='0'){
        extending=true;
        gw('radio.getUserRadio',flowMood?{user_id:user.id,config_id:flowMood}:{user_id:user.id})
          .then(more=>{if(more.data&&more.data.length)d.enqueueTracks(more.data,context);}).catch(()=>{}).finally(()=>{extending=false;});
      }
      return {ready:true,song:now,advert:!!current&&!now,position:Number(d.getPosition())||0,
        duration:(now&&now.duration)||Number(d.getDuration())||0,playing:!!d.isPlaying(),
        volume:Math.round((Number(d.getVolume())||0)*100),muted:!!d.isMuted(),shuffle:!!d.isShuffle(),repeat:Number(d.getRepeat())||0,
        canSeek:!!(d.control.canSeek&&d.control.canSeek()),context:{type:String(context.TYPE||''),id:String(context.ID||'')},mood:flowMood,
        index,queue:list.slice(index+1,index+1+(queueSize||20)).map(song).filter(Boolean)};
    },
    async play(spec){
      const d=window.dzPlayer;
      if(!d)throw Error('Deezer is still loading on your PC.');
      const data=await songs(spec.source);
      if(!data.length)throw Error('Nothing to play here.');
      const radio=spec.source.flow!=null;
      if(radio)flowMood=String(spec.source.flow||'');
      const index=spec.shuffle?Math.floor(Math.random()*data.length):Math.max(0,Math.min(data.length-1,Number(spec.index)||0));
      const id=String(spec.id||(radio?user.id:data[0].SNG_ID));
      const ok=await d.play({type:radio?'radio':spec.type||'playlist',id,radio,data,index,context:{ID:id,TYPE:radio?'stream_user':spec.context||'playlist_page',CONTEXT_ID:id}});
      if(ok===false)throw Error('Deezer could not start that. Try again.');
      if(!radio&&d.control.setShuffle)d.control.setShuffle(!!spec.shuffle);
      return true;
    },
    async control(action,value){
      const d=window.dzPlayer;
      if(!d)throw Error('Deezer is still loading on your PC.');
      const c=d.control;
      if(action==='toggle'){c.togglePause();return d.isPlaying();}
      if(action==='next'){const ok=await c.nextSong();if(ok===false)throw Error('Deezer doesn’t allow another skip right now.');return true;}
      if(action==='previous'){await c.prevSong();return true;}
      if(action==='seek'){
        if(!c.canSeek())throw Error('You can’t move through this track.');
        const current=d.getCurrentSong(),duration=Number(current&&current.DURATION)||Number(d.getDuration());
        if(!(duration>0))throw Error('This track has no length yet.');
        c.seek(Math.max(0,Math.min(0.995,value/duration)));return true;
      }
      if(action==='volume'){c.setVolume(value/100);return value;}
      if(action==='shuffle'){c.setShuffle(!!value);return !!value;}
      if(action==='repeat'){c.setRepeat(value);return value;}
      if(action==='queue'){await d.playTrackAtIndex(value);return true;}
      throw Error('Unknown player control.');
    },
    async favourite(id,on){await signedIn();await gw(on?'favorite_song.add':'favorite_song.remove',{SNG_ID:String(id)});return on;}
  };
}

// A script that runs `method(...args)` on the page's bridge, building it first if the page is new.
const call=(method,...args)=>`(window.__winmore||(window.__winmore=(${deezerBridge.toString()})()))[${JSON.stringify(method)}](${args.map(a=>JSON.stringify(a)).join(',')})`;

module.exports={deezerBridge,call};
