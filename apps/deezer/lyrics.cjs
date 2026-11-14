// Time-synced lyrics for the playing track, from LRCLIB (the Deezer desktop app does not share its own).
const LRCLIB='https://lrclib.net/api';
const HEADERS={'User-Agent':'WinMore companion','Accept':'application/json'};

function parseLRC(value){
  const lines=[];
  for(const raw of String(value||'').split(/\r?\n/)){
    const stamps=[...raw.matchAll(/\[(\d+):(\d{1,2}(?:[.:]\d+)?)\]/g)];
    if(!stamps.length)continue;
    const text=raw.replace(/\[[^\]]*\]/g,'').trim();
    for(const stamp of stamps){const time=Number(stamp[1])*60+Number(stamp[2].replace(':','.'));if(Number.isFinite(time))lines.push({time:Math.round(time*1000)/1000,text});}
  }
  return lines.sort((a,b)=>a.time-b.time);
}
// "Song (Remastered 2011)" -> "Song"; "A feat. B" -> "A"
const cleanTitle=t=>String(t||'').replace(/\s*[([][^)\]]*(version|remaster|remastered|edit|mix|live|explicit|feat\.?|ft\.?)[^)\]]*[)\]]/gi,'').replace(/\s+-\s+.*(remaster|version|edit|mix|live).*$/i,'').trim()||String(t||'').trim();
const mainArtist=a=>String(a||'').split(/\s*(?:,|&|\bet\b|\band\b|\bfeat\.?|\bft\.?|\bx\b|·|•)\s*/i)[0].trim();

function createLyrics({fetch=globalThis.fetch}={}){
  const cache=new Map(),pending=new Set();
  async function get(path,params){
    const url=new URL(LRCLIB+path);
    for(const [k,v] of Object.entries(params))if(v!==undefined&&v!=='')url.searchParams.set(k,String(v));
    const r=await fetch(url,{headers:HEADERS,signal:AbortSignal.timeout(8000)});
    if(r.status===404)return null;
    if(!r.ok)throw Error('Lyrics service answered '+r.status);
    return r.json();
  }
  async function load({title,artist,duration}){
    const name=cleanTitle(title),lead=mainArtist(artist),seconds=duration>0?Math.round(duration):undefined;
    let found=null;
    for(const a of [...new Set([artist,lead])].filter(Boolean)){found=await get('/get',{track_name:name,artist_name:a,duration:seconds});if(found)break;}
    if(!found?.syncedLyrics){
      const list=await get('/search',{track_name:name,artist_name:lead});
      const fits=e=>!seconds||Math.abs(Number(e?.duration)-seconds)<=3;
      found=(Array.isArray(list)?list:[]).filter(fits).find(e=>e.syncedLyrics)||found;
    }
    if(found?.syncedLyrics){const lines=parseLRC(found.syncedLyrics);if(lines.length)return {status:'ready',synced:true,lines};}
    if(found?.instrumental)return {status:'instrumental',lines:[]};
    if(found?.plainLyrics)return {status:'ready',synced:false,lines:found.plainLyrics.split(/\r?\n/).map(text=>({text:text.trim()}))};
    return {status:'unavailable',lines:[]};
  }
  // What is known now; starts one lookup per track in the background.
  return {get(track){
    if(!track?.title)return null;
    const key=`${track.title}\u001f${track.artist}`;
    if(cache.has(key))return cache.get(key);
    if(!pending.has(key)){
      pending.add(key);
      load(track).catch(()=>({status:'unavailable',lines:[]})).then(value=>{cache.set(key,value);if(cache.size>40)cache.delete(cache.keys().next().value);}).finally(()=>pending.delete(key));
    }
    return {status:'loading',lines:[]};
  }};
}
module.exports={createLyrics,parseLRC,cleanTitle,mainArtist};
