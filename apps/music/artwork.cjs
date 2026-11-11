// Cache covers on the PC so phones don't each depend on a fresh CDN request.
function createArtworkCache({fetch,now=Date.now}={}){
  const cache=new Map(),queue=[];let active=0,closed=false;
  const allowed=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['googleusercontent.com','ggpht.com','ytimg.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host));}catch{return false;}};
  function drain(){
    while(!closed&&active<4&&queue.length){
      const [url,entry]=queue.shift();active++;
      (async()=>{
        try{
          const response=await fetch(url,{signal:AbortSignal.timeout(7000)});
          const type=response.headers.get('content-type')?.split(';')[0];
          if(!response.ok||!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Cover unavailable');
          const bytes=Buffer.from(await response.arrayBuffer());
          if(!bytes.length||bytes.length>1500000)throw Error('Invalid cover size');
          entry.data=`data:${type};base64,${bytes.toString('base64')}`;
        }catch{entry.retryAt=now()+Math.min(60000,2000*2**entry.attempts);}
        finally{entry.pending=false;active--;drain();}
      })();
    }
  }
  return {
    get(url){
      if(closed||!fetch||!allowed(url))return url||'';
      let entry=cache.get(url);
      if(!entry){
        if(cache.size>=160){const stale=[...cache].find(([,value])=>!value.pending);if(stale)cache.delete(stale[0]);else return url;}
        entry={attempts:0,retryAt:0,pending:false};cache.set(url,entry);
      }
      if(!entry.data&&!entry.pending&&entry.attempts<4&&now()>=entry.retryAt){entry.pending=true;entry.attempts++;queue.push([url,entry]);drain();}
      return entry.data||url;
    },
    close(){closed=true;queue.length=0;cache.clear();}
  };
}
module.exports={createArtworkCache};
