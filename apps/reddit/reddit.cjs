const fs=require('node:fs');
// Reddit runs on the PC in WinMore's own Reddit windows, like YouTube Music: you sign in
// there once and WinMore reads the posts that page renders. Only post data reaches the phone.
const ORIGIN='https://www.reddit.com';
const SORTS=['hot','new','top','rising'];
// Your own Reddit lists (signed in), and how History is ordered.
const ACCOUNT_FEEDS={saved:'Saved',upvoted:'Upvoted',downvoted:'Downvoted',hidden:'Hidden',submitted:'Your posts'};
const HISTORY_SORTS=['new','old'];
const DEFAULT_SUBREDDITS=['pics','worldnews','technology','gaming','todayilearned','aww','movies','music','science','earthporn'];
const MAX_POSTS=200,MAX_HISTORY=200;
const clip=(value,length)=>typeof value==='string'?value.length>length?value.slice(0,length-1)+'…':value:'';
const httpsURL=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};
function parseFeed(value){
 if(typeof value!=='string')throw Error('Choose a subreddit.');
 const feed=value.trim().replace(/^\/+/,'');
 if(['home','popular','all','history',...Object.keys(ACCOUNT_FEEDS)].includes(feed.toLowerCase()))return feed.toLowerCase();
 const match=feed.match(/^(?:r\/)?([A-Za-z0-9][A-Za-z0-9_]{1,20})$/);
 if(!match)throw Error('Enter a subreddit name, like r/pics.');
 return 'r/'+match[1];
}
function feedTitle(feed){return {home:'Home',popular:'Popular',all:'All',history:'History',...ACCOUNT_FEEDS}[feed]||feed;}
// History orders newest or oldest first and account lists keep Reddit's order; other sorts fall back to Hot there.
function feedSort(feed,sort='hot'){
 if(![...SORTS,...HISTORY_SORTS].includes(sort))throw Error('Unknown Reddit sort.');
 if(feed==='history')return HISTORY_SORTS.includes(sort)?sort:'new';
 if(ACCOUNT_FEEDS[feed])return 'new';
 return SORTS.includes(sort)?sort:'hot';
}
function feedURL(feed,sort='hot'){
 if(!SORTS.includes(sort))throw Error('Unknown Reddit sort.');
 if(ACCOUNT_FEEDS[feed])return `${ORIGIN}/user/me/${feed}/`;
 if(feed==='history')throw Error('History is kept by WinMore on your PC.');
 const base=feed==='home'?'':feed==='popular'?'/r/popular':feed==='all'?'/r/all':'/'+feed;
 if(feed==='home'&&sort==='hot')return ORIGIN+'/';
 return `${ORIGIN}${base}/${sort}/${sort==='top'?'?t=day':''}`;
}
// Serialized into the PC's Reddit page. Reads the posts it rendered.
function readRedditPage(){
 const absolute=value=>{if(!value)return null;try{const url=new URL(value,location.origin);return url.protocol==='https:'?url.href:null;}catch{return null;}};
 const text=element=>element?.innerText?.replace(/\n{3,}/g,'\n\n').trim()||'';
 const posts=[...document.querySelectorAll('shreddit-post')].map(post=>{
  const attr=name=>post.getAttribute(name)||'';
  const type=attr('post-type'),href=absolute(attr('content-href'));
  // Blurred (NSFW/spoiler) media can sit in <template> content rather than the live tree.
  const roots=[post,...[...post.querySelectorAll('template')].map(template=>template.content)];
  const find=selector=>{for(const root of roots){const found=root.querySelector(selector);if(found)return found;}return null;};
  const player=find('shreddit-player, shreddit-player-2');
  let video=absolute(player?.getAttribute('src')||'');
  if(!video&&type==='video'&&href&&/^https:\/\/v\.redd\.it\/\w+\/?$/.test(href))video=href.replace(/\/?$/,'/HLSPlaylist.m3u8');
  // Each gallery slide holds a few copies (previews and the full i.redd.it file); take one per slide, preferring the full file.
  const slides=roots.flatMap(root=>[...root.querySelectorAll('gallery-carousel li')]);
  const gallery=[...new Set(slides.map(slide=>{
   const sources=[...slide.querySelectorAll('img')].map(img=>absolute(img.getAttribute('src')||img.getAttribute('data-lazy-src')||'')).filter(Boolean);
   return sources.find(source=>/^https:\/\/i\.redd\.it\//.test(source))||sources[0];
  }).filter(Boolean))];
  let image=absolute(player?.getAttribute('poster')||'')||absolute(find('img.preview-img, img.media-lightbox-img')?.getAttribute('src')||'')||gallery[0];
  if(!image&&(type==='image'||type==='gif')&&href&&/^https:\/\/i\.redd\.it\//.test(href))image=href;
  return {id:attr('id'),type,title:attr('post-title'),subreddit:attr('subreddit-prefixed-name'),author:attr('author'),score:attr('score'),comments:attr('comment-count'),
   created:attr('created-timestamp'),nsfw:post.hasAttribute('nsfw'),spoiler:post.hasAttribute('spoiler'),flair:text(post.querySelector('shreddit-post-flair')),
   text:text(post.querySelector('[slot="text-body"]')),image,gallery,video,url:href,domain:attr('domain'),permalink:absolute(attr('permalink'))};
 });
 const comments=[...document.querySelectorAll('shreddit-comment')].map(comment=>({id:comment.getAttribute('thingid'),author:comment.getAttribute('author'),
  body:text(comment.querySelector('[slot="comment"]')),score:comment.getAttribute('score'),depth:comment.getAttribute('depth'),created:comment.getAttribute('created'),op:comment.hasAttribute('is-op')}));
 return {posts,comments,signedIn:!document.querySelector('#login-button'),path:location.pathname};
}
// Serialized into a Reddit page by pages.api.
async function redditApi(path,form){
 const options={credentials:'include',headers:{}};
 if(form){
  const me=await (await fetch('/api/me.json',{credentials:'include'})).json();
  const modhash=me?.data?.modhash;
  if(!modhash)throw Error('not signed in on the PC');
  options.method='POST';
  options.headers['Content-Type']='application/x-www-form-urlencoded';
  options.headers['X-Modhash']=modhash;
  options.body=new URLSearchParams({...form,uh:modhash,api_type:'json'}).toString();
 }
 const response=await fetch(path,options);
 if(!response.ok)throw Error('Reddit returned '+response.status);
 const text=await response.text();
 let json=null;try{json=JSON.parse(text);}catch{}
 const errors=json?.json?.errors;
 if(Array.isArray(errors)&&errors.length)throw Error(String(errors[0]?.[1]||errors[0]?.[0]||'request failed'));
 return json;
}
const seconds=value=>{const time=Date.parse(value);return Number.isFinite(time)?time/1000:0;};
const count=value=>{const number=parseInt(value,10);return Number.isFinite(number)?number:0;};
function cleanPost(raw,{textLength=600}={}){
 if(typeof raw?.id!=='string'||!/^t3_[a-z0-9]{1,13}$/.test(raw.id)||!raw.title)return null;
 const kind=['video','gif','gallery','image'].includes(raw.type)?raw.type:raw.type==='text'||raw.type==='self'?'text':'link';
 const gallery=(Array.isArray(raw.gallery)?raw.gallery:[]).map(httpsURL).filter(Boolean).slice(0,20);
 const permalink=httpsURL(raw.permalink);
 return {id:raw.id,postId:raw.id.slice(3),kind,title:clip(raw.title,300),subreddit:clip(raw.subreddit||'Reddit',60),author:clip(raw.author||'[deleted]',40),
  score:count(raw.score),comments:count(raw.comments),created:seconds(raw.created),nsfw:raw.nsfw===true,spoiler:raw.spoiler===true,saved:false,vote:0,
  flair:clip(raw.flair||'',40)||null,text:clip(raw.text||'',textLength)||null,image:httpsURL(raw.image),imageWidth:null,imageHeight:null,
  gallery:gallery.length?gallery:null,video:httpsURL(raw.video),url:kind==='text'?null:httpsURL(raw.url),domain:clip(raw.domain||'',60)||null,
  permalink:permalink&&new URL(permalink).origin===ORIGIN?permalink:`${ORIGIN}/comments/${raw.id.slice(3)}/`};
}
function cleanComments(raw,limit=80){
 return (Array.isArray(raw)?raw:[]).filter(c=>typeof c?.id==='string'&&count(c.depth)<=2&&c.body).slice(0,limit)
  .map(c=>({id:c.id,author:clip(c.author||'[deleted]',40),body:clip(c.body,1500),score:count(c.score),depth:count(c.depth),created:seconds(c.created),op:c.op===true}));
}
// Search results come from Reddit's JSON listing; this maps one listing entry to the page-reader shape.
function listingPost(d){
 if(!d||typeof d!=='object')return null;
 const ext=String(d.url||'').split('?')[0].toLowerCase();
 const type=d.is_video?'video':d.is_gallery?'gallery':d.post_hint==='image'?(ext.endsWith('.gif')?'gif':'image'):d.is_self?'text':'link';
 const gallery=(d.gallery_data?.items||[]).map(item=>{const m=d.media_metadata?.[item.media_id];return m?.s?.gif||m?.s?.u||null;}).filter(Boolean);
 return {id:d.name,type,title:d.title,subreddit:d.subreddit_name_prefixed,author:d.author,score:d.score,comments:d.num_comments,
  created:Number.isFinite(d.created_utc)?new Date(d.created_utc*1000).toISOString():'',nsfw:d.over_18===true,spoiler:d.spoiler===true,
  flair:d.link_flair_text||'',text:d.selftext||'',image:d.preview?.images?.[0]?.source?.url||gallery[0]||null,gallery,
  video:d.media?.reddit_video?.hls_url||d.secure_media?.reddit_video?.hls_url||null,url:d.url_overridden_by_dest||d.url,domain:d.domain,
  permalink:typeof d.permalink==='string'?ORIGIN+d.permalink:null};
}
// Everywhere, or inside one subreddit.
function searchPath(query,subreddit){
 const q=typeof query==='string'?query.trim().slice(0,200):'';
 if(!q)throw Error('Type something to search for.');
 const params=new URLSearchParams({q,limit:'100',raw_json:'1',sort:'relevance',t:'all'});
 if(subreddit){const sub=parseFeed(subreddit);if(!sub.startsWith('r/'))throw Error('Search inside a subreddit.');params.set('restrict_sr','1');return {q,sub,path:`/${sub}/search.json?${params}`};}
 return {q,sub:null,path:`/search.json?${params}`};
}
const HISTORY_GROUP=['history','upvoted','downvoted','hidden','submitted'];
const isLibrary=feed=>feed==='history'||Boolean(ACCOUNT_FEEDS[feed]);
// Card details the screen shows: whether there is media, and the small label on it.
function decorate(post){
 const hasMedia=Boolean(post.image||post.video||post.gallery?.length);
 const badge=post.kind==='video'?['Video','play.fill']:post.kind==='gif'?['GIF','play.square']:post.kind==='link'&&hasMedia?[post.domain||'Link','link']:[null,null];
 return {...post,hasMedia,badge:badge[0],badgeSymbol:badge[1]};
}
const validPostId=value=>{if(typeof value!=='string'||!/^[a-z0-9]{1,13}$/.test(value))throw Error('Choose a Reddit post.');return value;};
// pages: {open(name,url), more(name), read(name), show(url), signIn(onClose)} backed by PC windows.
function createReddit({pages,historyFile,redgifs=null}){
 let stored={history:[],recent:[]};
 try{const saved=JSON.parse(fs.readFileSync(historyFile,'utf8'));if(Array.isArray(saved.history))stored.history=saved.history.slice(0,MAX_HISTORY);if(Array.isArray(saved.recent))stored.recent=saved.recent.filter(v=>typeof v==='string').slice(0,12);}catch{}
 const persist=()=>{try{fs.writeFileSync(historyFile,JSON.stringify(stored));}catch(error){console.warn('Could not save Reddit history:',error.message);}};
 // Revisions start at a random number, so a revision the phone kept from an earlier run never matches this one.
 const view={feed:'home',sort:'hot',search:null,posts:[],hasMore:false,loading:false,error:null,loaded:false,revision:Math.floor(Math.random()*1e9)};
 let post=null,ticket=0,signedIn=false,signingIn=false,work=Promise.resolve(),returnTo={feed:'home',sort:'hot'};
 // Page loads can take several seconds; they run in the background and the phone polls state.
 const background=task=>{work=task.catch(error=>console.warn('Reddit:',error.message));};
 const changed=()=>{view.revision++;};
 const historyPosts=()=>view.sort==='old'?[...stored.history].reverse():stored.history;
 // Your own lists say what you did: everything in Saved is saved, everything in Upvoted is upvoted.
 const known=feed=>feed==='saved'?{saved:true}:feed==='upvoted'?{vote:1}:feed==='downvoted'?{vote:-1}:{};
 const take=page=>{if(typeof page.signedIn==='boolean')signedIn=page.signedIn;const seen=new Set(),mark=known(view.feed);
  return page.posts.map(raw=>cleanPost(raw)).filter(p=>p&&!seen.has(p.id)&&seen.add(p.id)).slice(0,MAX_POSTS).map(p=>Object.assign(p,mark));};
 async function load(append){
  const mine=++ticket;
  view.loading=true;view.error=null;changed();
  try{
   if(view.feed==='history'){view.posts=historyPosts();view.hasMore=false;return;}
   if(view.feed==='search'){
    const listing=await pages.api('feed',view.search.path);
    if(mine!==ticket)return;
    view.posts=take({posts:(listing?.data?.children||[]).map(child=>listingPost(child?.data)).filter(Boolean),signedIn});
    view.hasMore=false;
    if(!view.posts.length)view.error='No posts match that search.';
    return;
   }
   const before=view.posts.length;
   // The phone gets the first rendered posts right away; media details fill in after hydration.
   const early=partial=>{
    if(mine!==ticket||append)return;
    const first=take(partial);
    if(first.length&&!(ACCOUNT_FEEDS[view.feed]&&!signedIn)){view.posts=first;changed();}
   };
   // A newer load makes this one stale; the PC window stops scrolling through it.
   const stale=()=>mine!==ticket;
   const page=append?await pages.more('feed',stale):await pages.open('feed',feedURL(view.feed,view.sort),early,stale);
   if(mine!==ticket)return;
   const fresh=take(page);
   // RedGIFs lookups run after the feed is shown, then upgrade those posts in place.
   if(redgifs&&fresh.length)background(work.then(()=>redgifs.enrich(fresh)).then(()=>{if(mine===ticket&&fresh.some(p=>p.video))changed();}));
   if(ACCOUNT_FEEDS[view.feed]&&!signedIn)throw Error(`Sign in to Reddit on your PC to see ${ACCOUNT_FEEDS[view.feed]}.`);
   // Reddit drops posts far above the viewport while scrolling, so "more" adds to what the phone has.
   const known=new Set(append?view.posts.map(p=>p.id):[]);
   const posts=append?[...view.posts,...fresh.filter(p=>!known.has(p.id))].slice(0,MAX_POSTS):fresh;
   view.posts=posts;
   view.hasMore=posts.length<MAX_POSTS&&(!append||posts.length>before)&&posts.length>0;
   if(!posts.length&&!append)view.error=view.feed.startsWith('r/')?'No posts here. Check the subreddit name, or open it on your PC.':'Reddit didn’t show any posts. Open Reddit on your PC to check.';
  }catch(error){if(mine===ticket){view.error=error.message;if(!append)view.posts=[];}}
  finally{if(mine===ticket){view.loading=false;view.loaded=true;changed();}}
 }
 async function openPost(id){
  try{
   const page=await pages.open('post',`${ORIGIN}/comments/${id}/`);
   if(post?.id!==id)return;
   if(typeof page.signedIn==='boolean')signedIn=page.signedIn;
   const raw=page.posts.find(p=>p.id==='t3_'+id)||page.posts[0];
   const detail=raw&&cleanPost(raw,{textLength:10000});
   if(!detail)throw Error('That post is no longer available.');
   const before=post?.post;
   if(before){detail.saved=before.saved===true;detail.vote=before.vote||0;}
   // RedGIFs media and your own vote and saved state (from Reddit's account API, not the page) are looked up together.
   await Promise.all([
    redgifs?redgifs.enrich([detail]):null,
    signedIn&&pages.api?pages.api('post',`/api/info.json?id=t3_${id}`).then(info=>{
     const data=info?.data?.children?.[0]?.data;
     if(data){detail.saved=data.saved===true;detail.vote=data.likes===true?1:data.likes===false?-1:0;if(Number.isFinite(data.score))detail.score=data.score;}
    },error=>console.warn('Reddit account state:',error.message)):null
   ]);
   // Another post may have been opened while this one loaded.
   if(post?.id!==id)return;
   post={id,post:detail,comments:cleanComments(page.comments),loading:false,error:null};
   remember(detail);
  }catch(error){if(post?.id!==id)return;post={...post,loading:false,error:error.message};}
  changed();
 }
 // Applies a change to every copy of a post the phone can see: the open post, the feed and History.
 function patch(id,change){
  for(const item of [post?.post,...view.posts,...stored.history])if(item&&item.postId===id)change(item);
  changed();
 }
 async function account(id,apply,revert,request){
  if(!signedIn)throw Error('Sign in to Reddit on your PC to vote and save.');
  patch(id,apply);
  try{await pages.api('post',request.path,request.form);persist();}
  catch(error){patch(id,revert);throw Error('Reddit didn’t accept that: '+error.message);}
 }
 function remember(item){
  stored.history=[{...item,text:clip(item.text||'',600)||null},...stored.history.filter(p=>p.postId!==item.postId)].slice(0,MAX_HISTORY);
  persist();
 }
 return {
  idle:()=>work,
  state(){
   if(!view.loaded&&!view.loading)load(false);
   const title=view.feed==='search'?(view.search.sub?view.search.sub+' · ':'')+'“'+view.search.q+'”':feedTitle(view.feed);
   return {feed:view.feed,title,search:view.search&&view.feed==='search'?{query:view.search.q,subreddit:view.search.sub}:null,sort:view.sort,posts:view.posts,hasMore:view.hasMore,loading:view.loading,error:view.error,revision:view.revision,
    signedIn,signingIn,subreddits:DEFAULT_SUBREDDITS,recent:stored.recent,post};
  },
  // What the phone's screen (ui/screen.json) reads: the state plus a few values it would
  // otherwise have to work out itself. The revision lets the PC skip unchanged polls.
  data(){
   const state=this.state();
   const current=state.feed.startsWith('r/')?state.feed:state.search?.subreddit||null;
   return {...state,posts:state.posts.map(decorate),post:state.post?{...state.post,post:state.post.post?decorate(state.post.post):null}:null,
    library:isLibrary(state.feed),historyGroup:HISTORY_GROUP.includes(state.feed),currentSubreddit:current};
  },
  async command(action,value){
   // History and Saved: a second tap returns to the feed you came from.
   if(action==='library'){
    const feed=parseFeed(value);
    if(!isLibrary(feed))throw Error('Choose History or one of your Reddit lists.');
    const active=view.feed===feed||(feed==='history'&&HISTORY_GROUP.includes(view.feed));
    return this.command('open',active?returnTo:{feed,sort:feed==='history'?'new':view.sort});
   }
   if(action==='open'){
    const feed=parseFeed(value?.feed??value);const sort=feedSort(feed,value?.sort??'hot');
    if(isLibrary(feed)&&!isLibrary(view.feed)&&view.feed!=='search')returnTo={feed:view.feed,sort:view.sort};
    view.feed=feed;view.sort=sort;view.posts=feed==='history'?historyPosts():[];view.hasMore=false;
    if(feed.startsWith('r/')){stored.recent=[feed.slice(2),...stored.recent.filter(v=>v.toLowerCase()!==feed.slice(2).toLowerCase())].slice(0,12);persist();}
    background(load(false));return;
   }
   if(action==='search'){
    view.search=searchPath(value?.query,value?.subreddit||null);
    if(!isLibrary(view.feed)&&view.feed!=='search')returnTo={feed:view.feed,sort:view.sort};
    view.feed='search';view.sort='hot';view.posts=[];view.hasMore=false;
    background(load(false));return;
   }
   if(action==='refresh'){background(load(false));return;}
   if(action==='more'){if(view.hasMore&&!view.loading&&view.feed!=='history')background(load(true));return;}
   if(action==='post'){
    const id=validPostId(value);
    const known=[...view.posts,...stored.history].find(item=>item.postId===id);
    post={id,post:known||null,comments:[],loading:true,error:null};changed();
    background(openPost(id));return;
   }
   if(action==='signin'){
    if(signingIn)throw Error('Finish signing in on your PC.');
    signingIn=true;changed();
    // Reddit's own sign-in runs on the PC; the feed reloads when that window closes.
    pages.signIn(()=>{signingIn=false;load(false);});
    return;
   }
   if(action==='vote'){
    // dir: 1 upvotes, 0 clears your vote, -1 downvotes.
    const id=validPostId(value?.id),dir=Number(value?.dir);
    if(![1,0,-1].includes(dir))throw Error('Unknown vote.');
    const known=[post?.post,...view.posts,...stored.history].find(item=>item?.postId===id);
    const was=known?.vote||0;
    await account(id,item=>{item.score+=dir-(item.vote||0);item.vote=dir;},item=>{item.score+=was-(item.vote||0);item.vote=was;},
     {path:'/api/vote',form:{id:'t3_'+id,dir:String(dir)}});
    return;
   }
   if(action==='save'){
    const id=validPostId(value?.id),saved=value?.saved===true;
    await account(id,item=>{item.saved=saved;},item=>{item.saved=!saved;},{path:saved?'/api/save':'/api/unsave',form:{id:'t3_'+id}});
    return;
   }
   if(action==='pc'){
    const url=new URL(typeof value==='string'?value:'');
    if(url.origin!==ORIGIN)throw Error('Only Reddit pages can open on PC.');
    pages.show(url.href);return;
   }
   throw Error('Unknown Reddit command.');
  }
 };
}
// "Continue with Google/Apple" on Reddit's login page opens the provider in a popup that
// reports back to its opener. Only those sign-in pages may open, and only from the visible window.
const SIGN_IN_POPUPS=['https://accounts.google.com','https://appleid.apple.com'];
function isSignInPopup(value){try{return SIGN_IN_POPUPS.includes(new URL(value).origin);}catch{return false;}}
// Reddit: one hidden window holds the feed (keeping its scroll position for "more"),
// one loads opened posts, and a visible one is for signing in or opening pages on PC.
function createRedditPages({BrowserWindow,isQuitting=()=>false}){
 const windows={};
 // Hidden windows only read the page's markup; images, video and fonts are never shown there.
 const hiddenIds=new Set();
 const SKIPPED=new Set(['image','media','font']);
 let filtering=false;
 const skipHeavy=win=>{
  // webContents is gone by the time 'closed' fires, so keep its id.
  const id=win.webContents.id;
  hiddenIds.add(id);
  win.once('closed',()=>hiddenIds.delete(id));
  if(filtering)return;
  filtering=true;
  win.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
   callback({cancel:hiddenIds.has(details.webContentsId)&&SKIPPED.has(details.resourceType)});
  });
 };
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const preferences={contextIsolation:true,nodeIntegration:false,sandbox:true};
 const windowFor=(name,visible=false)=>{
  let win=windows[name];
  if(!win||win.isDestroyed()){
   win=visible?new BrowserWindow({width:1100,height:820,autoHideMenuBar:true,webPreferences:preferences}):new BrowserWindow({show:false,width:1280,height:1600,webPreferences:{...preferences,backgroundThrottling:false}});
   if(!visible)skipHeavy(win);
   const parent=win;
   win.webContents.setWindowOpenHandler(({url})=>visible&&isSignInPopup(url)
    ?{action:'allow',overrideBrowserWindowOptions:{parent,width:520,height:680,autoHideMenuBar:true,webPreferences:preferences}}
    :{action:'deny'});
   win.on('close',event=>{if(!isQuitting()){event.preventDefault();win.hide();}});
   windows[name]=win;
  }
  return win;
 };
 // Resolve once the document is parsed instead of waiting for every subresource to finish.
 const load=(win,url)=>new Promise((resolve,reject)=>{
  const contents=win.webContents;
  const done=()=>{contents.off('did-fail-load',failed);resolve();};
  const failed=(_event,code,description,_url,mainFrame)=>{if(mainFrame&&code!==-3){contents.off('dom-ready',done);reject(Error(description||'Reddit could not load.'));}};
  contents.once('dom-ready',done);contents.on('did-fail-load',failed);
  win.loadURL(url).catch(error=>{if(error.code!=='ERR_ABORTED'){contents.off('dom-ready',done);contents.off('did-fail-load',failed);reject(error);}});
 });
 const run=(win,script)=>win.webContents.executeJavaScript(script,true);
 const postCount=win=>run(win,`document.querySelectorAll('shreddit-post').length`);
 const read=win=>run(win,`(${readRedditPage.toString()})()`);
 // Reddit only renders media (video players, posters) for posts that have been on screen,
 // so step through the page like a reader would before reading it.
 const hydrate=async(win,from,stale=()=>false)=>{
  const end=await run(win,'document.documentElement.scrollHeight');
  for(let y=from;y<end&&!stale();y+=1600){await run(win,`window.scrollTo(0,${y})`);await pause(70);}
 };
 const EMPTY={posts:[],comments:[]};
 const pages={
  async open(name,url,onPartial,stale=()=>false){
   const win=windowFor(name);
   await load(win,url);
   if(stale())return EMPTY;
   // Reddit's browser check can land on the front page; load the requested page again.
   if(new URL(win.webContents.getURL()).pathname==='/'&&new URL(url).pathname!=='/')await load(win,url);
   const partial=async()=>{if(onPartial&&!stale())try{onPartial(await read(win));}catch(error){console.warn('Reddit:',error.message);}};
   // Reddit renders a few posts on the server and streams the rest in. The phone gets the first
   // ones as soon as they exist, then the settled list, then the list with media filled in.
   let seen=0,steady=0,shown=false;
   for(let i=0;i<40&&steady<2;i++){
    await pause(150);
    if(stale())return EMPTY;
    const now=await postCount(win);
    if(now>0&&!shown){shown=true;await partial();}
    steady=now>0&&now===seen&&(now>=10||i>=12)?steady+1:0;seen=now;
   }
   if(seen>0)await partial();
   await hydrate(win,0,stale);
   return stale()?EMPTY:read(win);
  },
  async more(name,stale=()=>false){
   const win=windowFor(name);
   const before=await postCount(win);
   const from=await run(win,'window.scrollY');
   await run(win,'window.scrollTo(0,document.documentElement.scrollHeight)');
   for(let i=0;i<40&&!stale()&&(await postCount(win))<=before;i++)await pause(150);
   await hydrate(win,from,stale);
   return stale()?EMPTY:read(win);
  },
  // Calls Reddit's account API from inside a Reddit page, so the PC's sign-in cookies apply.
  // Writes carry the account's modhash, which Reddit requires for cookie-signed requests.
  async api(name,path,form){
   const win=windowFor(name);
   let here='';try{here=new URL(win.webContents.getURL()).origin;}catch{}
   if(here!==ORIGIN)await load(win,ORIGIN+'/');
   return run(win,`(${redditApi.toString()})(${JSON.stringify(path)},${JSON.stringify(form||null)})`);
  },
  show(url){const win=windowFor('pc',true);win.loadURL(url).catch(error=>console.warn('Reddit could not load:',error.message));win.show();win.focus();},
  signIn(onClose){pages.show(`${ORIGIN}/login/`);windows.pc.once('hide',onClose);},
  close(){for(const win of Object.values(windows))if(!win.isDestroyed())win.destroy();}
 };
 return pages;
}
module.exports={decorate,isLibrary,listingPost,searchPath,ACCOUNT_FEEDS,feedSort,createReddit,createRedditPages,isSignInPopup,parseFeed,feedURL,readRedditPage,cleanPost,cleanComments,ORIGIN};
