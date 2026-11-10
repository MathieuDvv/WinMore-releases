// Lyrics for the track playing in the PC's YouTube Music window.
// Time-synced lyrics come from LRCLIB; YouTube Music's own (unsynced) lyrics are the fallback.
const LRCLIB='https://lrclib.net/api';
const HEADERS={'User-Agent':'WinMore companion','Accept':'application/json'};
const RETRY_AFTER_ERROR=60_000, CACHE_SIZE=40;

// Executed inside the PC's YouTube Music renderer: reads the Lyrics tab for a video.
async function readYouTubeMusicLyrics(videoId){
  const manager=document.querySelector('ytmusic-app')?.networkManager;
  if(typeof manager?.fetch!=='function')return null;
  const next=await manager.fetch('/next',{videoId,isAudioOnly:true});
  const tabs=next?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs||[];
  const endpoint=tabs.map(tab=>tab.tabRenderer?.endpoint?.browseEndpoint)
    .find(value=>value?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType==='MUSIC_PAGE_TYPE_TRACK_LYRICS'||value?.browseId?.startsWith('MPLY'));
  if(!endpoint?.browseId)return null;
  const page=await manager.fetch('/browse',{browseId:endpoint.browseId,browseEndpointContextSupportedConfigs:endpoint.browseEndpointContextSupportedConfigs});
  const shelf=page?.contents?.sectionListRenderer?.contents?.find(content=>content.musicDescriptionShelfRenderer)?.musicDescriptionShelfRenderer;
  const runs=value=>(value?.runs||[]).map(run=>run.text).join('');
  const text=runs(shelf?.description).trim();
  return text?{text,source:runs(shelf?.footer).trim()}:null;
}

function parseLRC(value){
  const lines=[];
  for(const raw of String(value||'').split(/\r?\n/)){
    const stamps=[...raw.matchAll(/\[(\d+):(\d{1,2}(?:[.:]\d+)?)\]/g)];
    if(!stamps.length)continue;
    const text=raw.replace(/\[[^\]]*\]/g,'').trim();
    for(const stamp of stamps){
      const time=Number(stamp[1])*60+Number(stamp[2].replace(':','.'));
      if(Number.isFinite(time))lines.push({time:Math.round(time*1000)/1000,text});
    }
  }
  return lines.sort((a,b)=>a.time-b.time);
}
const plainLines=text=>String(text||'').split(/\r?\n/).map(line=>({text:line.trim()}));

// "Song (Single Version)" / "Song - 2011 Remaster" -> "Song"
function cleanTitle(title){
  return String(title||'')
    .replace(/\s*[([][^)\]]*(version|remaster|remastered|mono|stereo|edit|mix|live|explicit|official|audio|video|lyrics?|from|feat\.?|ft\.?)[^)\]]*[)\]]/gi,'')
    .replace(/\s+-\s+.*(remaster|version|edit|mix|live).*$/i,'')
    .trim()||String(title||'').trim();
}
// "Quincy Jones et Michael Jackson" / "A, B & C" -> "Quincy Jones"
const mainArtist=artist=>String(artist||'').split(/\s*(?:,|&|\bet\b|\band\b|\bfeat\.?|\bft\.?|\bx\b|·|•)\s*/i)[0].trim();

function createLyrics({fetch=globalThis.fetch,readPageLyrics=async()=>null,now=Date.now}={}){
  const cache=new Map(), pending=new Map();
  const remember=(id,value)=>{cache.delete(id);cache.set(id,value);while(cache.size>CACHE_SIZE)cache.delete(cache.keys().next().value);return value;};
  async function lrclib(path,params){
    const url=new URL(LRCLIB+path);
    for(const [key,value] of Object.entries(params))if(value!==undefined&&value!=='')url.searchParams.set(key,String(value));
    const response=await fetch(url,{headers:HEADERS,signal:AbortSignal.timeout(8000)});
    if(response.status===404)return null;
    if(!response.ok)throw Error('Lyrics service answered '+response.status);
    return response.json();
  }
  async function findLRCLIB({title,artist,duration}){
    const track=cleanTitle(title), lead=mainArtist(artist), seconds=duration>0?Math.round(duration):undefined;
    const fits=entry=>!seconds||Math.abs(Number(entry?.duration)-seconds)<=3;
    for(const name of [...new Set([artist,lead])].filter(Boolean)){
      const exact=await lrclib('/get',{track_name:track,artist_name:name,duration:seconds});
      if(exact&&(exact.syncedLyrics||exact.plainLyrics||exact.instrumental))return exact;
    }
    const results=await lrclib('/search',{track_name:track,artist_name:lead});
    const candidates=(Array.isArray(results)?results:[]).filter(fits);
    return candidates.find(entry=>entry.syncedLyrics)||candidates.find(entry=>entry.plainLyrics||entry.instrumental)||null;
  }
  async function load(track){
    let found=null, failure=null;
    try{found=await findLRCLIB(track);}catch(error){failure=error;}
    if(found?.syncedLyrics){const lines=parseLRC(found.syncedLyrics);if(lines.length)return {status:'ready',synced:true,source:'LRCLIB',lines,text:found.plainLyrics||lines.map(line=>line.text).join('\n')};}
    if(found?.instrumental)return {status:'instrumental',synced:false,source:'LRCLIB',lines:[],text:''};
    let page=null;
    try{page=await readPageLyrics(track.videoId);}catch(error){failure=failure||error;}
    if(page?.text)return {status:'ready',synced:false,source:page.source||'YouTube Music',lines:plainLines(page.text),text:page.text};
    if(found?.plainLyrics)return {status:'ready',synced:false,source:'LRCLIB',lines:plainLines(found.plainLyrics),text:found.plainLyrics};
    if(failure)throw failure;
    return {status:'unavailable',synced:false,source:'',lines:[],text:''};
  }
  // Returns what is known right now and starts a lookup in the background when needed.
  function get(track){
    const id=track?.videoId;
    if(!id||!track.title)return null;
    const cached=cache.get(id);
    if(cached&&!(cached.status==='error'&&now()-cached.at>RETRY_AFTER_ERROR))return {videoId:id,...cached.value};
    if(!pending.has(id)){
      pending.set(id,load(track)
        .then(value=>remember(id,{value,at:now()}))
        .catch(error=>remember(id,{status:'error',value:{status:'error',synced:false,source:'',lines:[],text:'',error:error.message||'Lyrics could not be loaded.'},at:now()}))
        .finally(()=>pending.delete(id)));
    }
    return {videoId:id,status:'loading',synced:false,source:'',lines:[],text:''};
  }
  return {get,ready:id=>pending.get(id)};
}
module.exports={createLyrics,readYouTubeMusicLyrics,parseLRC,cleanTitle,mainArtist};
