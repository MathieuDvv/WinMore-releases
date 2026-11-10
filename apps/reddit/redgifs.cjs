// RedGIFs links on Reddit become playable MP4s through RedGIFs' public API (anonymous temporary token).
const API='https://api.redgifs.com/v2';
const MAX_CACHE=500,TIMEOUT=8000,BATCH=6;
// watch/<id>, ifr/<id>, i/<id>.jpg on redgifs.com or a subdomain (v3., i.).
function redgifsId(value){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||!/(^|\.)redgifs\.com$/.test(url.hostname))return null;
  const match=url.pathname.match(/^\/(?:watch|ifr|i)\/([A-Za-z]{3,80})(?:[.\-/#?]|$)/);
  return match?match[1].toLowerCase():null;
 }catch{return null;}
}
const mediaURL=value=>{try{const url=new URL(value);return url.protocol==='https:'&&/(^|\.)redgifs\.com$/.test(url.hostname)?url.href:null;}catch{return null;}};
function createRedgifs({fetch=globalThis.fetch}={}){
 let token=null;const cache=new Map();
 // Parallel lookups share one token request.
 const newToken=async()=>{
  const response=await fetch(API+'/auth/temporary',{signal:AbortSignal.timeout(TIMEOUT)});
  if(!response.ok)throw Error('RedGIFs sign-in failed: '+response.status);
  return (await response.json()).token;
 };
 const get=async(path,retry=true)=>{
  const current=token||=newToken().catch(error=>{token=null;throw error;});
  const response=await fetch(API+path,{headers:{Authorization:'Bearer '+await current},signal:AbortSignal.timeout(TIMEOUT)});
  // Temporary tokens expire; get a new one once.
  if((response.status===401||response.status===403)&&retry){if(token===current)token=null;return get(path,false);}
  if(!response.ok)throw Error('RedGIFs lookup failed: '+response.status);
  return response.json();
 };
 async function resolve(id){
  if(cache.has(id))return cache.get(id);
  const gif=(await get('/gifs/'+encodeURIComponent(id)))?.gif;
  const video=mediaURL(gif?.urls?.hd)||mediaURL(gif?.urls?.sd);
  const media=video?{video,image:mediaURL(gif.urls.poster)||mediaURL(gif.urls.thumbnail),hasAudio:gif.hasAudio===true}:null;
  cache.set(id,media);
  if(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);
  return media;
 }
 // Turns RedGIFs link posts into video/GIF posts in place. Failures leave the post as a link.
 async function enrich(posts){
  const pending=posts.filter(post=>!post.video&&redgifsId(post.url));
  for(let i=0;i<pending.length;i+=BATCH){
   await Promise.all(pending.slice(i,i+BATCH).map(async post=>{
    try{
     const media=await resolve(redgifsId(post.url));
     if(!media)return;
     post.kind=media.hasAudio?'video':'gif';post.video=media.video;post.image=media.image||post.image;
    }catch(error){console.warn('RedGIFs:',error.message);}
   }));
  }
  return posts;
 }
 return {resolve,enrich};
}
module.exports={createRedgifs,redgifsId};
