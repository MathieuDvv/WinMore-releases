// Executed inside the PC's YouTube Music renderer. No phone-side service session.
function readMusicSnapshot(maxVolume = 70) {
  const text = element => element?.textContent?.replace(/\s+/g,' ').trim() || '';
  const player = document.querySelector('ytmusic-player-bar');
  const video = document.querySelector('video');
  // YouTube Music lazy-loads artwork: rows that haven't scrolled into view (and sometimes the
  // player bar) hold a data: placeholder instead of a URL. Fall back to the video's thumbnail.
  const imageOf=(img,videoId)=>{
    for(const src of [img?.currentSrc,img?.src,img?.getAttribute('data-src')])if(typeof src==='string'&&src.startsWith('https://'))return src;
    return videoId&&/^[\w-]{6,20}$/.test(videoId)?`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`:'';
  };
  const playerImage=player?.querySelector('img');
  let playing='';try{playing=new URL(location.href).searchParams.get('v')||'';}catch{}
  const art = imageOf(playerImage,playing);
  let volume={available:false,value:0,muted:false,source:'youtube-music'};
  try {
    const api=document.querySelector('#movie_player') || document.querySelector('ytmusic-player')?.playerApi;
    let level=typeof api?.getVolume==='function'?Number(api.getVolume()):NaN;
    // Apply the ceiling to an older saved player setting as well, so a displayed
    // 100% really is the capped music volume immediately after loading a track.
    if(Number.isFinite(level)&&level>maxVolume&&typeof api?.setVolume==='function'){api.setVolume(maxVolume);level=Number(api.getVolume());}
    if(Number.isFinite(level)&&typeof api?.setVolume==='function')volume={available:true,value:Math.round(Math.max(0,Math.min(100,level*100/maxVolume))),playerValue:level,maxPlayerValue:maxVolume,muted:api.isMuted?.()===true,source:'youtube-music'};
  }catch{}
  const items = [], seen = new Set();
  const tiles='ytmusic-responsive-list-item-renderer, ytmusic-two-row-item-renderer';
  // On Home, the phone's grid is the account's Speed Dial shelf only, not Listen again or
  // recommendations. Speed Dial is the one grid-style shelf (numItemsPerColumn), whatever
  // the interface language; its title is the fallback.
  const home=location.hostname==='music.youtube.com'&&(location.pathname==='/'||location.pathname==='');
  const shelves=home?Array.from(document.querySelectorAll('ytmusic-section-list-renderer #contents > *')):[];
  const speedDial=shelves.find(shelf=>shelf.data?.numItemsPerColumn&&shelf.querySelector(tiles))
    ||shelves.find(shelf=>/^(speed dial|sélection rapide)$/i.test(text(shelf.querySelector('#header .title, .title'))));
  // Until it renders, send nothing from Home so the phone keeps waiting instead of saving other
  // shelves. Accounts without Speed Dial (or signed out) get the whole page once it has loaded.
  const homeLoading=home&&!speedDial&&shelves.length<3;
  const kindOf=url=>url.pathname==='/watch'?'Song':url.pathname==='/playlist'?'Playlist':'Collection';
  const add=(url,title,subtitle,image)=>{
    if(!url||!title||seen.has(url.href))return;
    seen.add(url.href);
    items.push({id:url.href,title:title.slice(0,180),subtitle:(subtitle||'').slice(0,220),image,kind:kindOf(url)});
  };
  // Speed Dial is read from the shelf's data: it holds every tile, in your order, as soon as the
  // shelf exists, while the page only draws some of them (and draws them progressively).
  const runs=value=>(value?.runs||[]).map(run=>run.text).join('');
  for(const entry of speedDial?.data?.contents||[]){
    const tile=entry.musicTwoRowItemRenderer||entry.musicResponsiveListItemRenderer;
    if(!tile)continue;
    const columns=(tile.flexColumns||[]).map(column=>column.musicResponsiveListItemFlexColumnRenderer?.text);
    const endpoint=tile.navigationEndpoint||columns[0]?.runs?.[0]?.navigationEndpoint
      ||tile.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
    let url=null;
    const watch=endpoint?.watchEndpoint, browse=endpoint?.browseEndpoint?.browseId;
    if(watch?.videoId){url=new URL('https://music.youtube.com/watch');url.searchParams.set('v',watch.videoId);if(watch.playlistId)url.searchParams.set('list',watch.playlistId);}
    else if(typeof browse==='string'&&browse)url=browse.startsWith('VL')?new URL('https://music.youtube.com/playlist?list='+encodeURIComponent(browse.slice(2))):new URL('https://music.youtube.com/browse/'+encodeURIComponent(browse));
    const thumbs=(tile.thumbnailRenderer||tile.thumbnail)?.musicThumbnailRenderer?.thumbnail?.thumbnails||[];
    const thumb=thumbs[thumbs.length-1]?.url||'';
    add(url,runs(tile.title)||runs(columns[0]),runs(tile.subtitle)||columns.slice(1).map(runs).filter(Boolean).join(' • '),
      thumb.startsWith('https://')?thumb:(watch?.videoId?`https://i.ytimg.com/vi/${watch.videoId}/hqdefault.jpg`:''));
  }
  // Every other page (and a Speed Dial whose data couldn't be read) uses the rendered tiles.
  const rows = homeLoading||items.length?[]:(speedDial||document).querySelectorAll(tiles);
  for(const row of rows) {
    // Speed Dial pages beyond the first sit off-screen in its carousel but still count.
    if(row.closest('ytmusic-player-queue') || (!speedDial&&!row.getClientRects().length)) continue;
    const anchors=Array.from(row.querySelectorAll('a[href]'));
    let url;
    const anchor=anchors.find(a=>{try{const candidate=new URL(a.getAttribute('href'),location.origin);if(candidate.origin==='https://music.youtube.com'&&(['/watch','/playlist','/browse'].includes(candidate.pathname)||candidate.pathname.startsWith('/browse/'))){url=candidate;return true;}}catch{}return false;});
    if(!anchor)continue;
    add(url,text(row.querySelector('.title')) || text(anchor) || row.getAttribute('aria-label') || '',
      text(row.querySelector('.subtitle')) || text(row.querySelector('.secondary-flex-columns')) || text(row.querySelector('.flex-column:nth-child(2)')),
      imageOf(row.querySelector('img'),url.pathname==='/watch'?url.searchParams.get('v'):''));
    if(items.length>=60)break;
  }
  // Playback queue: songs after the one currently selected, including Automix suggestions.
  let videoId='', videoAuthor='', videoTitle='', videoDuration=0, videoTime=NaN;
  try{const playerApi=document.querySelector('#movie_player') || document.querySelector('ytmusic-player')?.playerApi;const data=playerApi?.getVideoData?.();videoId=data?.video_id||'';videoAuthor=data?.author||'';videoTitle=data?.title||'';videoDuration=Number(playerApi?.getDuration?.())||0;videoTime=Number(playerApi?.getCurrentTime?.());}catch{}
  const queue=[];
  const queueRows=Array.from(document.querySelectorAll('ytmusic-player-queue ytmusic-player-queue-item'));
  const selected=queueRows.findIndex(row=>row.hasAttribute('selected'));
  for(let index=selected+1;index<queueRows.length&&queue.length<50;index++){
    const row=queueRows[index], data=row.data||{};
    const thumbs=data.thumbnail?.thumbnails||[];
    const thumb=thumbs[thumbs.length-1]?.url||'';
    const image=thumb.startsWith('https://')?thumb:imageOf(row.querySelector('img'),data.videoId);
    const title=text(row.querySelector('.song-title'))||(data.title?.runs||[]).map(r=>r.text).join('');
    if(!title)continue;
    queue.push({id:data.videoId||'',index,title:title.slice(0,180),artist:(text(row.querySelector('.byline'))||(data.shortBylineText?.runs||[]).map(r=>r.text).join('')).slice(0,220),
      duration:text(row.querySelector('.duration'))||(data.lengthText?.runs||[]).map(r=>r.text).join(''),image,automix:!!row.closest('#automix-contents')});
  }
  return {
    videoId,videoTitle,videoAuthor,videoDuration,queue,
    title:text(player?.querySelector('.title')) || 'Find your next favorite',
    artist:text(player?.querySelector('.byline')) || 'YouTube Music on your PC',
    artwork:art,playing:video?!video.paused:false,// Time and length come from the same player as videoId, so a track switch can't pair the new
    // song with the old song's time. The <video> element is the fallback.
    current:Number.isFinite(videoTime)&&videoId?videoTime:(video?.currentTime||0),
    duration:videoId&&videoDuration>0?videoDuration:(Number.isFinite(video?.duration)?video.duration:0),
    items,section:speedDial?'speed-dial':homeLoading?'loading':'page',pageTitle:text(document.querySelector('ytmusic-detail-header-renderer .title')) || text(document.querySelector('ytmusic-immersive-header-renderer .title')) || '',
    url:location.href,ready:!!document.querySelector('ytmusic-app'),volume
  };
}
function navigateMusicPage(action,value,url) {
  const app=document.querySelector('ytmusic-app');
  if(!app)throw Error('Open music on PC to finish signing in or the consent screen.');
  let endpoint;
  if(action==='search')endpoint={searchEndpoint:{query:value.trim()}};
  if(action==='page')endpoint={browseEndpoint:{browseId:{home:'FEmusic_home',explore:'FEmusic_explore',library:'FEmusic_library_landing'}[value]}};
  if(action==='open'){
    const anchor=Array.from(document.querySelectorAll('a[href]')).find(a=>{try{return new URL(a.href,location.origin).href===url;}catch{return false;}});
    const row=anchor?.closest('ytmusic-two-row-item-renderer,ytmusic-responsive-list-item-renderer');
    const u=new URL(url);
    const rowEndpoint=row?.data?.navigationEndpoint || anchor?.data?.navigationEndpoint;
    if(u.pathname==='/watch'&&rowEndpoint?.watchEndpoint?.videoId===u.searchParams.get('v'))endpoint=rowEndpoint;
    if(!endpoint){
      if(u.pathname==='/watch')endpoint={watchEndpoint:{videoId:u.searchParams.get('v'),...(u.searchParams.has('list')?{playlistId:u.searchParams.get('list')}:{})}};
      else endpoint={browseEndpoint:{browseId:u.pathname==='/playlist'?'VL'+u.searchParams.get('list'):decodeURIComponent(u.pathname.split('/').pop())}};
    }
  }
  app.dispatchEvent(new CustomEvent('yt-navigate',{detail:{endpoint},bubbles:true,composed:true}));
}
function musicURL(action,value) {
  const pages={home:'/',explore:'/explore',library:'/library'};
  if(action==='search'){
    if(typeof value!=='string'||!value.trim()||value.length>300)throw Error('Enter a search of up to 300 characters.');
    return 'https://music.youtube.com/search?q='+encodeURIComponent(value.trim());
  }
  if(action==='page'){
    if(!Object.hasOwn(pages,value))throw Error('Unknown music page.');
    return 'https://music.youtube.com'+pages[value];
  }
  if(action==='open'){
    const url=new URL(value);
    if(url.origin!=='https://music.youtube.com'||!(['/watch','/playlist','/browse'].includes(url.pathname)||url.pathname.startsWith('/browse/')))throw Error('Choose a YouTube Music item.');
    return url.href;
  }
  throw Error('Unknown music navigation command.');
}
function validateVolume(value){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)throw Error('Music volume must be between 0 and 100.');
  return Math.round(value);
}
// This function is serialized into YouTube Music's own PC renderer.
function setMusicVolume(value, maxVolume = 70){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)throw Error('Music volume must be between 0 and 100.');
  const api=document.querySelector('#movie_player') || document.querySelector('ytmusic-player')?.playerApi;
  if(typeof api?.setVolume!=='function'||typeof api?.getVolume!=='function')throw Error('Load a track in YouTube Music on your PC first.');
  const level=Math.round(value*maxVolume/100);
  api.setVolume(level);
  if(level>0&&api.isMuted?.()===true&&typeof api.unMute==='function')api.unMute();
  const actual=Number(api.getVolume());
  return {available:true,value:Math.round(Math.max(0,Math.min(100,actual*100/maxVolume))),playerValue:actual,maxPlayerValue:maxVolume,muted:api.isMuted?.()===true,source:'youtube-music'};
}
// Serialized into YouTube Music's PC renderer: plays a song from the queue.
function playQueueItem(videoId,index){
  const rows=Array.from(document.querySelectorAll('ytmusic-player-queue ytmusic-player-queue-item'));
  const row=rows.find(item=>item.data?.videoId===videoId)||(Number.isInteger(index)&&!videoId?rows[index]:null);
  if(!row)throw Error('That song is no longer in the queue.');
  const button=row.querySelector('ytmusic-play-button-renderer');
  (button||row.querySelector('.song-info')||row).click();
}
function validateQueueTarget(value){
  const id=typeof value==='string'?value:value?.id;
  const index=typeof value==='number'?value:value?.index;
  if(id!==undefined&&id!==''&&!(typeof id==='string'&&/^[A-Za-z0-9_-]{6,20}$/.test(id)))throw Error('Choose a song from the queue.');
  if(!id&&!(Number.isInteger(index)&&index>=0&&index<1000))throw Error('Choose a song from the queue.');
  return {id:id||'',index:Number.isInteger(index)?index:null};
}
module.exports={readMusicSnapshot,musicURL,navigateMusicPage,setMusicVolume,validateVolume,playQueueItem,validateQueueTarget};
