// Deezer for WinMore. The PC plays Deezer in a hidden window signed in to your account;
// the phone browses Deezer and controls it.
//   - player.cjs runs inside deezer.com: Deezer's own web API (your favourites, Flow, playlists)
//     and its player (play anything, pause, skip, seek, volume, queue, hearts).
//   - Deezer's public API supplies the catalogue: charts, genres, albums, artists, search.
//   - LRCLIB supplies time-synced lyrics.
const {call}=require('./player.cjs');
const {createLyrics}=require('./lyrics.cjs');
const API='https://api.deezer.com';
const HOME='https://www.deezer.com/';
const GENRES=[[132,'Pop'],[116,'Rap/Hip Hop'],[152,'Rock'],[113,'Dance'],[165,'R&B'],[85,'Alternative'],[106,'Electro'],[129,'Jazz'],[52,'Chanson française'],[169,'Soul & Funk'],[144,'Reggae'],[197,'Latino'],[98,'Classique'],[464,'Metal']];
// Flow moods, as Deezer names them in its API.
const MOODS=[['motivation','Motivation','flame.fill',['#FF5A36','#8C1F12']],['party','Party','party.popper.fill',['#E0389B','#6E1047']],['chill','Chill','leaf.fill',['#1F9C93','#0B3F3B']],
  ['melancholy','Melancholy','cloud.rain.fill',['#3A7BD5','#13305E']],['you_and_me','You & me','heart.fill',['#F2A93B','#7A4A08']],['focus','Focus','scope',['#5E5CE6','#24226E']]];
const COLORS=[['#A238FF','#4B1A8C'],['#FF5A36','#8C1F12'],['#1F9C93','#0B3F3B'],['#E0389B','#6E1047'],['#3A7BD5','#13305E'],['#F2A93B','#7A4A08'],['#5E5CE6','#24226E'],['#2FB86B','#0E4B2A']];

const cover=(o,size='big')=>o?.[`cover_${size}`]||o?.[`picture_${size}`]||o?.album?.[`cover_${size}`]||null;
// Deezer's image server, for pictures that come from the web player.
const picture=(kind,md5,size)=>md5?`https://cdn-images.dzcdn.net/images/${kind}/${md5}/${size}x${size}-000000-80-0-0.jpg`:null;
const track=t=>({id:String(t.id),title:t.title_short||t.title,artist:t.artist?.name||'',album:t.album?.title||'',image:cover(t,'medium'),cover:cover(t,'xl')||cover(t,'big'),
  duration:t.duration||0,explicit:!!t.explicit_lyrics,albumId:t.album?.id?String(t.album.id):null,artistId:t.artist?.id?String(t.artist.id):null});
// A song read from the web player.
const webTrack=s=>({id:s.id,title:s.title,artist:s.artist,album:s.album,image:picture('cover',s.picture,250),cover:picture('cover',s.picture,1000),
  duration:s.duration,explicit:!!s.explicit,albumId:s.albumId,artistId:s.artistId});
const tile=(o,type)=>({id:String(o.id),type,title:o.title||o.name,image:cover(o,'medium'),round:type==='artist',
  subtitle:type==='playlist'?(o.nb_tracks?`${o.nb_tracks} tracks`:'Playlist'):type==='album'?o.artist?.name||'Album':'Artist'});
const darken=hex=>{const n=parseInt(hex.slice(1,7),16);const f=c=>Math.round(c*.42+14).toString(16).padStart(2,'0');return `#${f(n>>16&255)}${f(n>>8&255)}${f(n&255)}`;};
// Deezer turns away Electron; present the same Chromium without the Electron and app tokens.
const chromeAgent=agent=>agent.replace(/\s[Ee]lectron\/\S+/,'').replace(/\s\S+\/\d+\.\d+\.\d+(?=\sChrome)/,'');

function activate(ctx){
  const {BrowserWindow}=ctx.electron;
  const fetcher=ctx.electron.net?.fetch?.bind(ctx.electron.net)||globalThis.fetch;
  const lyrics=createLyrics({fetch:fetcher});

  // ── The hidden Deezer window ──
  const win=new BrowserWindow({show:false,width:1200,height:820,title:'Deezer',autoHideMenuBar:true,
    webPreferences:{partition:'persist:deezer',contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
  const agent=chromeAgent(win.webContents.getUserAgent());
  win.webContents.session.setUserAgent(agent);win.webContents.setUserAgent(agent);
  // Sign-in pop-ups (Google, Apple, Facebook) open only while you're looking at the window.
  win.webContents.setWindowOpenHandler(()=>win.isVisible()?{action:'allow'}:{action:'deny'});
  win.on('close',event=>{if(!ctx.isQuitting()){event.preventDefault();win.hide();refreshAccount();}});
  let pageReady=false,loadError='';
  win.webContents.on('did-navigate',()=>{pageReady=false;});
  win.webContents.on('did-finish-load',()=>{pageReady=true;loadError='';refreshAccount();});
  win.webContents.on('did-fail-load',(event,code,description,url,mainFrame)=>{if(mainFrame&&code!==-3)loadError='Deezer could not load on your PC. Check it is online.';});
  const load=()=>win.loadURL(HOME).catch(e=>{loadError='Deezer could not load on your PC. Check it is online.';ctx.log.warn('Deezer could not load:',e.message);});
  load();
  const run=(method,...args)=>{
    if(win.isDestroyed())return Promise.reject(Error('Deezer is closed.'));
    if(!pageReady)return Promise.reject(Error('Deezer is still loading on your PC.'));
    return win.webContents.executeJavaScript(call(method,...args),true);
  };

  // ── Your account: favourites, playlists, Flow ──
  let account=null,accountAt=0,checking=null;
  const library={favIds:new Set(),favTracks:[],favCount:0,lists:{playlists:[],albums:[],artists:[]},flow:[],at:0,loading:false,error:'',edits:0};
  function refreshAccount(){
    if(checking||!pageReady)return checking;
    checking=run('account').then(u=>{
      const changed=account?.id!==u.id;account=u;accountAt=Date.now();
      if(u.id!=='0'&&(changed||!library.at))loadLibrary(true);
      if(u.id==='0')Object.assign(library,{favIds:new Set(),favTracks:[],favCount:0,lists:{playlists:[],albums:[],artists:[]},flow:[],at:0});
    }).catch(()=>{accountAt=Date.now();}).finally(()=>{checking=null;});
    return checking;
  }
  const signedIn=()=>!!account&&account.id!=='0';
  async function loadLibrary(force){
    if(!signedIn()||library.loading||(!force&&Date.now()-library.at<120000))return;
    library.loading=true;
    const edits=library.edits;
    try{
      const l=await run('library');
      // A heart changed while this was loading: these favourites are already out of date.
      if(edits!==library.edits){library.at=0;return;}
      library.favTracks=l.favTracks.map(webTrack);library.favIds=new Set(l.favIds);library.favCount=l.favCount;
      library.lists={
        playlists:l.playlists.map(p=>({id:p.id,type:'playlist',title:p.title,image:picture(p.pictureType,p.picture,250),subtitle:p.count?`${p.count} tracks`:'Playlist'})),
        albums:l.albums.map(a=>({id:a.id,type:'album',title:a.title,image:picture('cover',a.picture,250),subtitle:a.artist||'Album'})),
        artists:l.artists.map(a=>({id:a.id,type:'artist',title:a.title,image:picture('artist',a.picture,250),subtitle:'Artist',round:true}))};
      library.flow=l.flow.map(webTrack);library.error='';library.at=Date.now();
    }catch(e){library.error=e.message;library.at=Date.now();}
    finally{library.loading=false;}
  }

  // ── What plays ──
  let player={ready:false},playerAt=0,reading=null,context=null;
  function readPlayer(){
    if(Date.now()-playerAt>600&&!reading&&pageReady){
      reading=run('state',25).then(s=>{player=s||{ready:false};playerAt=Date.now();})
        .catch(()=>{playerAt=Date.now();}).finally(()=>{reading=null;});
    }
    return reading||Promise.resolve();
  }
  function song(){
    const p=player;if(!p.ready||(!p.song&&!p.advert))return null;
    if(!p.song)return {id:'advert',title:'Advertisement',artist:'Deezer',album:'',image:null,cover:null,duration:p.duration,current:p.position,playing:p.playing,
      favourite:false,matched:false,context:'Deezer',inFlow:false,canSeek:false,color:'#1E1B24'};
    const t=webTrack(p.song);
    const elapsed=p.playing?(Date.now()-playerAt)/1000:0;
    const current=Math.max(0,Math.min(t.duration||Infinity,p.position+elapsed));
    const inFlow=p.context.type==='stream_user';
    const mood=MOODS.find(m=>m[0]===p.mood);
    const label=inFlow?(mood?`Flow · ${mood[1]}`:'Flow'):p.context.type==='album_page'?t.album:context&&context.id===p.context.id?context.label:'Deezer';
    const accent=t.cover&&ctx.accentColor?ctx.accentColor(t.cover):null;
    return {...t,matched:true,current,playing:p.playing,favourite:library.favIds.has(t.id),context:label,inFlow,mood:inFlow?p.mood:null,
      canSeek:p.canSeek,color:accent?darken(accent):'#1E1B24'};
  }

  // ── Catalogue: Home and Explore (public API, cached) ──
  const cache=new Map();
  async function api(p,ttl=300000){
    const hit=cache.get(p);if(hit&&Date.now()-hit.at<ttl)return hit.value;
    const r=await fetcher(API+p,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw Error('Deezer is not answering. Check the PC is online.');
    const json=await r.json();
    if(json.error)throw Error(json.error.message||'Deezer could not find that.');
    cache.set(p,{value:json,at:Date.now()});if(cache.size>200)cache.delete(cache.keys().next().value);
    return json;
  }
  let chart=null,chartError='';
  const loadChart=()=>api('/chart/0?limit=12',1800000).then(c=>{chart=c;chartError='';}).catch(e=>{chartError=e.message;});
  loadChart();
  function home(){
    const quick=[{id:'favourites',type:'favourites',title:'Favourite tracks'},{id:'',type:'flow',title:'Flow',tint:'#A238FF'}];
    const sections=[],l=library.lists;
    quick.push(...l.playlists.slice(0,2),...l.albums.slice(0,1),...l.artists.slice(0,1));
    if(l.playlists.length)sections.push({id:'my-playlists',title:'Your playlists',items:l.playlists});
    if(l.albums.length)sections.push({id:'my-albums',title:'Albums you love',items:l.albums});
    if(l.artists.length)sections.push({id:'my-artists',title:'Your artists',items:l.artists});
    if(chart){
      if(quick.length<6)quick.push(...chart.playlists.data.slice(0,6-quick.length).map(x=>tile(x,'playlist')));
      sections.push({id:'top-playlists',title:'Popular playlists',items:chart.playlists.data.map(x=>tile(x,'playlist'))},
        {id:'top-albums',title:'Top albums',items:chart.albums.data.map(x=>tile(x,'album'))},
        {id:'top-artists',title:'Popular artists',items:chart.artists.data.map(x=>tile(x,'artist'))});
    }
    return {quick:quick.slice(0,6),sections};
  }

  // ── Pages opened from the phone ──
  let collection=null,results=null;
  async function open({type,id}){
    collection={type,id:String(id),loading:true,tracks:[]};
    const done=c=>{if(collection?.id===String(id)&&collection.type===type)collection={...c,type,id:String(id),loading:false};return collection;};
    if(type==='favourites'){
      if(!signedIn())throw Error('Sign in to Deezer on your PC first.');
      await loadLibrary(true);return done({title:'Favourite tracks',subtitle:account?.name||'',image:null,tracks:library.favTracks,count:library.favCount});
    }
    if(type==='genre'){const g=GENRES.find(([gid])=>String(gid)===String(id));const r=await api(`/chart/${id}/tracks?limit=50`);return done({title:g?.[1]||'Genre',subtitle:'Top tracks',image:null,tracks:r.data.map(track)});}
    if(type==='artist'){const [a,top]=await Promise.all([api(`/artist/${id}`),api(`/artist/${id}/top?limit=25`)]);return done({title:a.name,subtitle:`${(a.nb_fan||0).toLocaleString('en')} fans`,image:cover(a,'xl')||cover(a,'big'),round:true,tracks:top.data.map(track)});}
    if(type==='album'){const a=await api(`/album/${id}`);return done({title:a.title,subtitle:a.artist?.name||'',image:cover(a,'xl')||cover(a,'big'),tracks:a.tracks.data.map(t=>({...track(t),image:cover(a,'medium'),cover:cover(a,'xl')}))});}
    if(type==='playlist'){
      // Private playlists aren't in the public API; read them through your account.
      const p=await api(`/playlist/${id}`).catch(()=>null);
      if(p)return done({title:p.title,subtitle:p.creator?.name?`By ${p.creator.name}`:'Playlist',image:cover(p,'xl')||cover(p,'big'),tracks:p.tracks.data.map(track)});
      const mine=library.lists.playlists.find(x=>x.id===String(id));
      const tracks=(await run('tracks',{playlist:id})).map(webTrack);
      return done({title:mine?.title||'Playlist',subtitle:'Your playlist',image:mine?.image||null,tracks});
    }
    throw Error('Unknown page.');
  }

  // ── Playing ──
  // Where the songs of a page come from, for the player on the PC.
  function source(c){
    if(c.type==='album')return {source:{album:c.id},type:'album',context:'album_page'};
    if(c.type==='playlist')return {source:{playlist:c.id},type:'playlist',context:'playlist_page'};
    if(c.type==='artist')return {source:{artist:c.id},type:'artist',context:'artist_top'};
    if(c.type==='favourites')return {source:{favourites:true},type:'playlist',context:'loved'};
    return {source:{ids:c.tracks.map(t=>t.id)},type:'playlist',context:'playlist_page'};
  }
  async function play(spec,label){
    if(!signedIn())throw Error('Sign in to Deezer on your PC first.');
    await run('play',spec);context={id:String(spec.id||''),label};playerAt=0;
    return true;
  }
  const playFlow=mood=>{const m=MOODS.find(x=>x[0]===mood);return play({source:{flow:m?m[0]:''}},m?`Flow · ${m[1]}`:'Flow');};

  async function data(){
    await readPlayer();
    if(!account||(!signedIn()&&Date.now()-accountAt>15000))refreshAccount();
    loadLibrary();
    if(!chart&&!chartError)loadChart();
    const s=song(),h=home(),hearts=list=>(list||[]).map(t=>({...t,favourite:library.favIds.has(t.id)}));
    const ly=s&&s.id!=='advert'?lyrics.get({title:s.title,artist:s.artist,duration:s.duration}):null;
    return {
      account:{ready:!!account,signedIn:signedIn(),name:account?.name||'',offer:account?.offer||'',error:loadError},
      loading:!chart&&!chartError,error:chartError,
      song:s,volume:player.ready?player.volume:null,shuffle:!!player.shuffle,repeat:player.repeat||0,
      queue:hearts((player.queue||[]).map(webTrack)),
      quick:h.quick,sections:h.sections,
      flow:{next:hearts(library.flow.slice(0,8)),has:library.flow.length>0},
      moods:MOODS.map(([id,title,symbol,colors])=>({id,type:'flow',title,symbol,colors,subtitle:'Flow'})),
      explore:[...MOODS.map(([id,title,symbol,colors])=>({id,type:'flow',title,subtitle:'Flow mood',symbol,colors})),
        ...GENRES.map(([id,name],i)=>({id:String(id),type:'genre',title:name,subtitle:'Top tracks',symbol:'music.note',colors:COLORS[i%COLORS.length]}))],
      favourites:{tracks:library.favCount,loading:library.loading&&!library.at,error:library.error,lists:Object.entries(library.lists).map(([id,items])=>({id,items}))},
      lyrics:ly&&{...ly,has:ly.lines.length>0},
      collection:collection&&{...collection,count:collection.count||collection.tracks.length,tracks:hearts(collection.tracks)},
      results:results&&{...results,tracks:hearts(results.tracks)}
    };
  }

  async function command(action,value){
    switch(action){
      case 'toggle':case 'next':case 'previous':{
        if(!player.ready)throw Error('Deezer is still loading on your PC.');
        if(action==='toggle'&&!player.song&&!player.advert)return playFlow('');
        const r=await run('control',action);playerAt=0;return r;
      }
      case 'seek':{
        const t=Number(value);if(!Number.isFinite(t)||t<0)throw Error('Invalid position.');
        const r=await run('control','seek',t);playerAt=0;return r;
      }
      case 'volume':{
        const v=Math.round(Number(value));if(!Number.isFinite(v)||v<0||v>100)throw Error('Volume must be between 0 and 100.');
        const r=await run('control','volume',v);player.volume=v;return r;
      }
      case 'shuffle':{const r=await run('control','shuffle',!player.shuffle);player.shuffle=r;return r;}
      case 'repeat':{const next=((player.repeat||0)+1)%3;await run('control','repeat',next);player.repeat=next;return next;}
      case 'queue':{
        // The phone sends the position in Up next; the player counts from the start of its list.
        const i=Number(value);if(!Number.isInteger(i)||i<0)throw Error('Unknown song.');
        const r=await run('control','queue',(player.index||0)+1+i);playerAt=0;return r;
      }
      case 'favourite':{
        if(!signedIn())throw Error('Sign in to Deezer on your PC first.');
        const id=String(value?.id??value??'').replace(/\D/g,'');if(!id)throw Error('Unknown song.');
        const on=!library.favIds.has(id);
        await run('favourite',id,on);
        if(on)library.favIds.add(id);else library.favIds.delete(id);
        library.favCount+=on?1:-1;library.edits++;library.at=0;
        return on;
      }
      case 'flow':return playFlow(typeof value==='string'?value:'');
      case 'play':{
        // {type,id} plays an item; {list:"collection"|"results"|"flow"|"favourites", index, shuffle} plays from a list.
        const v=value||{};
        if(v.type&&['album','playlist','artist'].includes(v.type))return play({...source({type:v.type,id:String(v.id)}),id:String(v.id)},v.title||'');
        if(v.list==='flow')return play({source:{flow:''},index:v.index},'Flow');
        if(v.list==='favourites')return play({...source({type:'favourites'}),id:account.id,index:v.index,shuffle:!!v.shuffle},'Favourite tracks');
        const list=v.list==='results'?results:collection;
        if(!list?.tracks?.length)throw Error('Nothing to play here yet.');
        if(v.list==='results')return play({source:{ids:list.tracks.map(t=>t.id)},type:'playlist',context:'search_page',id:list.tracks[0].id,index:v.index},`“${list.query}”`);
        return play({...source(list),id:list.type==='favourites'?account.id:list.id,index:v.index,shuffle:!!v.shuffle},list.title||'Deezer');
      }
      case 'open':{const v=value||{};if(!v.type||v.id==null)throw Error('Unknown page.');return open({type:String(v.type),id:String(v.id)});}
      case 'search':{
        const q=String(value||'').trim();if(!q){results=null;return null;}
        results={query:q,loading:true,tracks:[],albums:[],artists:[],playlists:[]};
        const e=encodeURIComponent(q);
        const [t,a,r,p]=await Promise.all([api(`/search?q=${e}&limit=12`),api(`/search/album?q=${e}&limit=12`),api(`/search/artist?q=${e}&limit=12`),api(`/search/playlist?q=${e}&limit=12`).catch(()=>({data:[]}))]);
        results={query:q,loading:false,tracks:t.data.map(track),albums:a.data.map(x=>tile(x,'album')),artists:r.data.map(x=>tile(x,'artist')),playlists:p.data.map(x=>tile(x,'playlist'))};
        return true;
      }
      case 'setup':win.show();win.focus();return true;
      case 'retry':cache.clear();chartError='';if(loadError){loadError='';load();}await loadChart();await refreshAccount();await loadLibrary(true);return true;
    }
    throw Error('Unknown Deezer command.');
  }

  return {
    data,command,
    async island(){
      await readPlayer();
      const s=song();
      return {
        priority:s?.playing?20:s?10:1,
        compact:s?{title:s.title,image:s.image||undefined,accent:s.cover&&ctx.accentColor?ctx.accentColor(s.cover)||'#A238FF':'#A238FF',activity:s.playing}:null,
        expanded:{title:s?.title||(signedIn()?'Deezer':'Sign in to Deezer'),subtitle:s?.artist||(signedIn()?'Pick something on your phone':'Open Deezer to sign in'),image:s?.image||undefined,placeholder:'note',
          buttons:[{symbol:'previous',action:'previous',label:'Previous'},{symbol:s?.playing?'pause':'play',action:'toggle',label:s?.playing?'Pause':'Play'},{symbol:'next',action:'next',label:'Next'}],
          ...(player.ready?{slider:{action:'volume',value:player.volume,label:'Deezer volume',symbol:'speaker',display:`${player.volume}%`}}:{}),
          footer:{label:'Open Deezer',action:'setup',note:'Runs on PC'}}
      };
    },
    settings:{
      describe(){
        const status=loadError?{label:'Deezer could not load',tone:'warning'}:!account?{label:'Loading Deezer',tone:'neutral'}
          :signedIn()?{label:`Signed in as ${account.name}`,tone:'ok'}:{label:'Not signed in',tone:'warning'};
        return {status,items:[
          {type:'text',text:'WinMore plays Deezer on this PC in its own window. Your phone browses Deezer and controls it.'},
          {type:'button',label:signedIn()?'Open Deezer':'Sign in to Deezer',action:'setup',primary:!signedIn()},
          {type:'note',text:'Sign in once in the Deezer window, then close it: the music keeps playing.'}
        ]};
      },
      async action(action){if(action==='setup')return command('setup');}
    },
    close(){if(!win.isDestroyed())win.destroy();}
  };
}
module.exports={activate,chromeAgent};
