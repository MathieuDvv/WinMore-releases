// What the phone's Music screen shows, worked out on the PC: the saved Home grid, the collection
// you opened and its songs, and artwork at a size that looks sharp on the iPhone.

const isHome=url=>{
  if(!url)return true;
  try{const u=new URL(url);return u.hostname==='music.youtube.com'&&(u.pathname==='/'||u.pathname==='');}catch{return false;}
};
// The page now open is the collection that was opened (same album, or the same playlist).
function matchesCollection(url,id){
  try{
    const actual=new URL(url),expected=new URL(id);
    if(actual.host!==expected.host||actual.pathname!==expected.pathname)return false;
    if(expected.pathname==='/playlist'){const list=actual.searchParams.get('list');return !!list&&list===expected.searchParams.get('list');}
    return true;
  }catch{return false;}
}
// Google's image CDN serves any size: ask for one that fits the phone, keep other URLs as they are.
function artwork(url,pixels=1200){
  if(typeof url!=='string'||!url.startsWith('https://'))return url||'';
  let host='';try{host=new URL(url).hostname;}catch{return url;}
  if(!(host.endsWith('googleusercontent.com')||host.endsWith('.ggpht.com')))return url;
  const size=Math.min(1600,Math.max(128,pixels));
  return url.replace(/=w\d+-h\d+/,`=w${size}-h${size}`).replace(/=s\d+(?=[-&]|$)/,`=s${size}`);
}
const decorate=(item,pixels=384)=>({...item,image:artwork(item.image,pixels),song:item.kind==='Song',playlist:item.kind==='Playlist'||/\/playlist$/.test((()=>{try{return new URL(item.id).pathname;}catch{return '';}})())});

function createBrowse(){
  let home=[],awaitingHome=true,collection=null,songs=[];
  return {
    // Called with each snapshot of the PC's YouTube Music page.
    observe(snapshot){
      if(!snapshot||snapshot.loading)return;
      const items=snapshot.items||[];
      if((awaitingHome||!home.length)&&isHome(snapshot.url)&&snapshot.section!=='loading'&&items.length){
        const seen=new Set();home=items.filter(item=>!seen.has(item.id)&&seen.add(item.id)).slice(0,36);awaitingHome=false;
      }
      if(collection&&matchesCollection(snapshot.url,collection.id)){
        const found=items.filter(item=>item.kind==='Song');
        if(found.length)songs=found;
      }
    },
    // Opening a tile: albums and playlists become the open collection; songs just play.
    open(item){
      if(item&&typeof item==='object'&&item.kind!=='Song'){collection={id:String(item.id),title:String(item.title||''),subtitle:String(item.subtitle||''),image:item.image||'',kind:item.kind||'Collection'};songs=[];}
      else if(item&&typeof item==='object')collection=null;
    },
    leave(){collection=null;songs=[];},
    reloadHome(){awaitingHome=true;},
    pick(which){
      if(!songs.length)throw Error('Waiting for this collection’s songs.');
      return which==='random'?songs[Math.floor(Math.random()*songs.length)]:songs[0];
    },
    view(snapshot){
      return {
        home:home.map(item=>decorate(item)),
        items:(snapshot?.items||[]).map(item=>decorate(item)),
        collection:collection?{...decorate(collection,600),title:snapshot?.pageTitle||collection.title,songs:songs.map(item=>decorate(item,160))}:null
      };
    }
  };
}
module.exports={createBrowse,matchesCollection,artwork,isHome};
