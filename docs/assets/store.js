(()=>{
'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const glyph=app=>`<span class="glyph">${app.icon?`<img src="${esc(app.icon)}" alt="">`:''}</span>`;
const platformNames={win32:'Windows',darwin:'macOS',linux:'Linux'};
const platforms=app=>(app.platforms||Object.keys(platformNames)).map(p=>platformNames[p]).filter(Boolean).join(' · ');
const groups=[
  {id:'default',title:'Default apps',description:'The Onbun collection.',origin:'Onbun'},
  {id:'developer',title:'More developer apps',description:'Independent releases by MathieuDvv.',origin:'MathieuDvv'},
  {id:'community',title:'Apps made by users',description:'Built by the community. Published here.',origin:'Community'}
];
const categories=[{id:'audio',name:'Music & audio',art:'category-audio'},{id:'desktop',name:'Desktop',art:'category-desktop'},{id:'social',name:'Social',art:'category-social'},{id:'tools',name:'Tools',art:'category-tools'}];
// Color and ghosted figure vary per app, but stay stable while searching/filtering.
const coverAssignments=new Map();
const coverPalettes={
 audio:[['#322661','#544384'],['#343566','#53568b']],
 desktop:[['#174a47','#2b7164'],['#193e59','#2b617b']],
 social:[['#60343e','#8a5260'],['#573953','#805677']],
 tools:[['#54451f','#806c35'],['#294b37','#447252']]
};
function coverFor(app,cat){
 if(!coverAssignments.has(app.id)){
  const palette=coverPalettes[cat.id],colors=palette[Math.floor(Math.random()*palette.length)];
  coverAssignments.set(app.id,{background:colors[0],glow:colors[1],figure:Math.random()<.5?'ashinaga':'tenaga',fade:(.17+Math.random()*.13).toFixed(3),offset:Math.round(-12+Math.random()*24)});
 }
 return coverAssignments.get(app.id);
}
const categoryIds={music:'audio',mixer:'audio',deezer:'audio',browser:'desktop',clipboard:'desktop',pc:'desktop',discord:'social',reddit:'social',twitch:'social',agents:'tools',clock:'tools',weather:'tools'};
const categoryOf=app=>categories.find(category=>category.id===(app.category||categoryIds[app.id]||'tools'))||categories[3];
let apps=[],bundles=[],filter='all',category='all',selectedBundle=null,slide=0;
const search=$('#app-search');
const state={query:new URLSearchParams(location.search).get('q')||''};
search.value=state.query;

function card(app){
  const cat=categoryOf(app),index=apps.indexOf(app),cover=coverFor(app,cat);
  return `<article class="app store-app" data-app-category="${cat.id}"><div class="app-cover" data-cover="${cat.id}" style="--cover-bg:${cover.background};--cover-glow:${cover.glow};--ascii-opacity:${cover.fade};--ascii-offset:${cover.offset}px"><canvas class="cover-ascii" data-yokai="${cover.figure}" data-cell="5.5" aria-hidden="true"></canvas><div class="cover-illustration" data-hose="${cat.art}" aria-hidden="true"></div><span class="cover-code">${esc(cat.name)} / ${String(index+1).padStart(2,'0')}</span></div><div class="app-card-body"><div class="app-name-row">${glyph(app)}<div><h4>${esc(app.name)}</h4><span class="app-origin">${esc(app.author||'Community')} ${app.version?`/ v${esc(app.version)}`:''}</span></div></div><p>${esc(app.description)}</p></div><div class="app-card-bottom"><span class="app-platforms">${esc(platforms(app))}</span><span class="app-actions"><button class="app-details" type="button" data-app="${esc(app.id)}" aria-label="View ${esc(app.name)} details">View app <i class="ic ic-out" aria-hidden="true"></i></button>${installLink(app)?`<button class="app-add" type="button" data-add="${esc(app.id)}" aria-label="Add ${esc(app.name)} to Onbun">Add to Onbun</button>`:''}</span></div></article>`;
}
function renderCategories(){
  $('#category-cards').innerHTML=categories.map((cat,index)=>`<button class="category-card" type="button" data-category="${cat.id}" aria-pressed="${category===cat.id}"><span class="category-art" data-hose="${cat.art}" aria-hidden="true"></span><span class="category-count">${String(apps.filter(app=>categoryOf(app).id===cat.id).length).padStart(2,'0')} APPS</span><span class="category-name">${cat.name} <i class="ic ic-out" aria-hidden="true"></i></span><span class="category-index" aria-hidden="true">0${index+1}</span></button>`).join('');
  window.OnbunArt.refresh($('#category-cards'));
}
function render(){
  const query=search.value.trim().toLocaleLowerCase();
  const terms=query.split(/\s+/).filter(Boolean);
  const matches=apps.filter(app=>(filter==='all'||app.collection===filter)&&(category==='all'||categoryOf(app).id===category)&&(!selectedBundle||selectedBundle.apps.includes(app.id))&&terms.every(term=>`${app.name} ${app.description} ${app.author||''} ${platforms(app)} ${categoryOf(app).name}`.toLocaleLowerCase().includes(term)));
  $('#active-category').hidden=category==='all';
  $('#active-category span').textContent=category==='all'?'':`Category / ${categories.find(cat=>cat.id===category).name}`;
  document.querySelectorAll('[data-category]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.category===category)));
  $('#clear-search').hidden=!search.value;
  $('#result-count').textContent=`${matches.length} ${matches.length===1?'app':'apps'}`;
  $('#active-bundle').hidden=!selectedBundle;
  $('#active-bundle span').textContent=selectedBundle?`Bundle / ${selectedBundle.label}`:'';
  $('#catalog-status').hidden=true;
  $('#app-sections').innerHTML=groups.filter(g=>filter==='all'||filter===g.id).map(group=>{
    const entries=matches.filter(app=>app.collection===group.id);
    if(!entries.length&&(query||selectedBundle||category!=='all'||group.id!=='community'))return '';
    return `<section class="catalog-group" aria-labelledby="group-${group.id}"><div class="group-head"><div><h3 id="group-${group.id}">${group.title}</h3><p>${group.description}</p></div><span>${String(entries.length).padStart(2,'0')} ${entries.length===1?'app':'apps'}</span></div>${entries.length?`<div class="library store-library">${entries.map(card).join('')}</div>`:`<div class="community-empty"><span class="empty-mark" aria-hidden="true">✳</span><div><h4>No community apps. Yet.</h4><p>Build something. Share the GitHub link. Start the collection.</p></div><button class="text-button" type="button" data-publish>Publish the first app <i class="ic ic-out" aria-hidden="true"></i></button></div>`}</section>`;
  }).join('');
  if(!$('#app-sections').innerHTML){
    $('#catalog-status').hidden=false;
    $('#catalog-status').replaceChildren(document.createTextNode('No apps match your search or filters. Try a different name or start again.'));
    const reset=document.createElement('button');reset.type='button';reset.textContent='Reset search and filters';reset.addEventListener('click',resetFilters);
    $('#catalog-status').append(document.createElement('br'),reset);
  }
  window.OnbunArt.refresh($('#app-sections'));
  window.OnbunBackground.refresh($('#app-sections'));
}
function resetFilters(){search.value='';filter='all';category='all';selectedBundle=null;updateFilters();render();}
function updateFilters(){document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===filter)));}
const stage=$('#bundle-stage'),featured=$('.featured'),motion=matchMedia('(prefers-reduced-motion: reduce)');
let track=null,moving=false,queued=0,animationTimer=0,rotationTimer=0,visible=false,hovered=false,userPaused=motion.matches;
const wrap=index=>(index%bundles.length+bundles.length)%bundles.length;
function bundleCard(index,offset){
  const bundle=bundles[index],current=offset===0;
  const entries=bundle.apps.map(id=>apps.find(app=>app.id===id)).filter(Boolean);
  return `<article class="bundle" data-theme="${esc(bundle.id)}" data-current="${current}" data-offset="${offset}" aria-hidden="${!current}" aria-label="${index+1} of ${bundles.length}: ${esc(bundle.label)}" aria-roledescription="slide"><div class="bundle-art" data-hose="${esc(bundle.art)}" aria-hidden="true"></div><div class="bundle-copy"><span class="label">${esc(bundle.label)} — App bundle</span><h3>${esc(bundle.title)}</h3><p>${esc(bundle.description)}</p><div class="bundle-apps" aria-label="${esc(entries.map(app=>app.name).join(', '))}">${entries.map(glyph).join('')}<span>${entries.length} apps</span></div><button class="bundle-open" type="button" data-bundle="${esc(bundle.id)}"${current?'':' disabled tabindex="-1"'}>View bundle <i class="ic ic-out" aria-hidden="true"></i></button></div>${Math.abs(offset)===1?`<button class="bundle-peek" type="button" tabindex="-1" data-carousel-step="${offset}" aria-label="${offset<0?'Previous':'Next'} bundle: ${esc(bundle.title)}"></button>`:''}</article>`;
}
function sizeTrack(step=0){
  if(!track)return;
  const width=stage.clientWidth,cardWidth=width*.8,gap=width<500?10:18;
  stage.style.setProperty('--bundle-width',`${cardWidth}px`);
  stage.style.setProperty('--bundle-gap',`${gap}px`);
  track.style.transform=`translateX(${(width-cardWidth)/2-(2+step)*(cardWidth+gap)}px)`;
}
function renderBundle(){
  if(!bundles.length){featured.hidden=true;return;}
  // Two offscreen copies let either neighboring card enter without a seam at the wrap.
  stage.innerHTML=`<div class="bundle-track">${[-2,-1,0,1,2].map(offset=>bundleCard(wrap(slide+offset),offset)).join('')}</div>`;
  track=stage.firstElementChild;
  $('#slide-count').textContent=`${String(slide+1).padStart(2,'0')} / ${String(bundles.length).padStart(2,'0')}`;
  stage.dataset.slide=String(slide);stage.dataset.moving='false';
  sizeTrack();window.OnbunArt.refresh(stage);scheduleRotation();
}
function scheduleRotation(){
  clearTimeout(rotationTimer);
  const focusInside=featured.contains(document.activeElement);
  const playing=!userPaused&&visible&&!hovered&&!focusInside&&!document.hidden&&!document.querySelector('dialog[open]')&&!moving&&bundles.length>1;
  stage.dataset.autoplay=String(playing);
  if(playing)rotationTimer=setTimeout(()=>moveBundle(1),5500);
}
function moveBundle(direction){
  if(bundles.length<2)return;
  if(moving){queued+=direction;return;}
  clearTimeout(rotationTimer);stage.dataset.autoplay='false';
  $('#slide-count').setAttribute('aria-live',featured.contains(document.activeElement)?'polite':'off');
  if(motion.matches){slide=wrap(slide+direction);renderBundle();return;}
  moving=true;stage.dataset.moving='true';
  track.getBoundingClientRect();track.classList.add('is-moving');sizeTrack(direction);
  // Highlight the incoming card during the movement, then recycle only after it settles.
  track.querySelectorAll('.bundle').forEach(card=>card.dataset.current=String(+card.dataset.offset===direction));
  let finished=false;
  const finish=()=>{
    if(finished)return;finished=true;clearTimeout(animationTimer);
    slide=wrap(slide+direction);moving=false;renderBundle();
    if(queued){const next=Math.sign(queued);queued-=next;requestAnimationFrame(()=>moveBundle(next));}
  };
  track.addEventListener('transitionend',event=>{if(event.target===track&&event.propertyName==='transform')finish();});
  animationTimer=setTimeout(finish,600);
}
$('#previous-bundle').addEventListener('click',()=>moveBundle(-1));
$('#next-bundle').addEventListener('click',()=>moveBundle(1));
stage.addEventListener('click',event=>{const peek=event.target.closest('[data-carousel-step]');if(peek)moveBundle(+peek.dataset.carouselStep);});
function updateRotationButton(){
  const button=$('#toggle-bundles');button.setAttribute('aria-pressed',String(userPaused));
  button.setAttribute('aria-label',userPaused?'Resume automatic scrolling':'Pause automatic scrolling');
  button.innerHTML=`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${userPaused?'<path d="m9 5 10 7-10 7Z"/>':'<path d="M9 6v12M15 6v12"/>'}</svg>`;
}
$('#toggle-bundles').addEventListener('click',()=>{userPaused=!userPaused;updateRotationButton();scheduleRotation();});
featured.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;scheduleRotation();}});
featured.addEventListener('pointerleave',()=>{hovered=false;scheduleRotation();});
featured.addEventListener('focusin',scheduleRotation);
featured.addEventListener('focusout',()=>setTimeout(scheduleRotation,0));
document.addEventListener('visibilitychange',scheduleRotation);
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',scheduleRotation));
new MutationObserver(scheduleRotation).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
new IntersectionObserver(entries=>{visible=entries[0].intersectionRatio>=.3;scheduleRotation();},{threshold:.3}).observe(stage);
new ResizeObserver(()=>{if(moving){clearTimeout(animationTimer);queued=0;moving=false;renderBundle();}else sizeTrack();}).observe(stage);
motion.addEventListener('change',()=>{if(motion.matches){userPaused=true;updateRotationButton();}scheduleRotation();});
updateRotationButton();

// "Add to Onbun": an onbun:// link the desktop app opens. Catalog apps go by id, developer apps by their
// package file, community apps by their GitHub repository (its newest release's .wmapp).
function installLink(app){
  const query=new URLSearchParams();
  if(app.collection==='default')query.set('app',app.id);
  else if(app.download)query.set('url',new URL(app.download,location.href).href);
  else if(app.repository){const repo=new URL(app.repository).pathname.replace(/^\/|\/$/g,'');if(!/^[\w.-]+\/[\w.-]+$/.test(repo))return null;query.set('github',repo);}
  else return null;
  return 'onbun://install?'+query.toString();
}
function openAdd(id){
  const app=apps.find(app=>app.id===id),link=app&&installLink(app);if(!link)return;
  document.querySelector('dialog[open]')?.close();
  const origin=app.collection==='default'?'From the Onbun catalog.':app.collection==='developer'?'From the developer’s package on this site.':'From the creator’s GitHub releases. Not reviewed by Onbun.';
  $('#add-detail').innerHTML=`${glyph(app)}<span class="label">Add to Onbun</span><h2 id="add-dialog-title">${esc(app.name)}</h2><p>${esc(app.description)}</p><div class="detail-meta">${app.version?`<span>v${esc(app.version)}</span>`:''}<span>${esc(platforms(app))}</span><span>${esc(origin)}</span></div><ol class="add-steps"><li>Choose <strong>Open in Onbun</strong>. Onbun must be running on this PC; your browser may ask first.</li><li>Onbun opens its Library on your PC and shows the app.</li><li>Choose <strong>Add to Onbun</strong> there. Your phone shows it right away.</li></ol><a class="btn primary" id="add-open" href="${esc(link)}">Open in Onbun <i class="ic ic-out" aria-hidden="true"></i></a><p class="add-status" id="add-status" role="status"></p><p class="add-fallback">Nothing happened? <a href="/#download">Download Onbun</a> for your PC first${app.download?`, or <a href="${esc(app.download)}" download>download the .wmapp file</a> and open it from the island’s Library`:''}.</p>`;
  $('#add-dialog').showModal();
  $('#add-open').addEventListener('click',event=>{event.preventDefault();sendToOnbun(link);});
}
// Hands the link to the Onbun running on this PC (its local server answers only this store). Browsers
// that ignore onbun:// links (Dia, for one) still reach it; without a running Onbun, the link is opened.
async function sendToOnbun(link){
  const status=$('#add-status');status.textContent='Opening Onbun…';
  try{
    const response=await fetch('http://127.0.0.1:4317/link',{method:'POST',headers:{'Content-Type':'text/plain'},body:link,signal:AbortSignal.timeout(2500)});
    if(!response.ok)throw Error(String(response.status));
    status.textContent='Onbun opened its Library on your PC. Choose Add to Onbun there.';
  }catch{
    status.textContent='If your browser asks, allow it to open Onbun.';
    location.href=link;
  }
}
function openApp(id){
  const app=apps.find(app=>app.id===id);if(!app)return;
  const isDefault=app.collection==='default';
  $('#app-detail').innerHTML=`${glyph(app)}<h2 id="app-dialog-title">${esc(app.name)}</h2><p>${esc(app.description)}</p><div class="detail-meta"><span>By ${esc(app.author||'the community')}</span>${app.version?`<span>v${esc(app.version)}</span>`:''}<span>${esc(platforms(app))}</span></div><div class="install-help"><strong>Add it to Onbun</strong><p>${installLink(app)?'Choose Add to Onbun: Onbun opens on your PC and asks before installing.':'Visit the creator’s GitHub repository for the app and installation instructions.'}${isDefault?' It’s also in Onbun → Settings → Library.':''}</p></div>${installLink(app)?`<button class="btn primary" type="button" data-add="${esc(app.id)}">Add to Onbun</button>`:''}${app.download?`<a class="btn" href="${esc(app.download)}" download>Download .wmapp <i class="ic ic-down" aria-hidden="true"></i></a>`:''}${app.repository?`<a class="btn" href="${esc(app.repository)}" target="_blank" rel="noopener noreferrer">View on GitHub <i class="ic ic-out" aria-hidden="true"></i></a>`:''}<p><a href="/docs#build">Read the app guide <i class="ic ic-right" aria-hidden="true"></i></a></p>`;
  $('#app-dialog').showModal();
}
document.addEventListener('click',event=>{
  const categoryButton=event.target.closest('[data-category]');
  if(categoryButton){category=category===categoryButton.dataset.category?'all':categoryButton.dataset.category;filter='all';selectedBundle=null;search.value='';updateFilters();render();$('#catalog').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  if(event.target.closest('[data-publish]')){$('#publish-status').textContent='';$('#publish-dialog').showModal();}
  const appButton=event.target.closest('[data-app]');if(appButton)openApp(appButton.dataset.app);
  const addButton=event.target.closest('[data-add]');if(addButton)openAdd(addButton.dataset.add);
  if(event.target.closest('[data-close]'))event.target.closest('dialog').close();
  const bundleButton=event.target.closest('[data-bundle]');
  if(bundleButton){selectedBundle=bundles.find(b=>b.id===bundleButton.dataset.bundle);search.value='';filter='all';category='all';updateFilters();render();$('#catalog').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;updateFilters();render();}));
search.addEventListener('input',render);
$('#search-form').addEventListener('submit',event=>{event.preventDefault();render();});
$('#clear-search').addEventListener('click',()=>{search.value='';render();search.focus();});
$('#active-bundle button').addEventListener('click',()=>{selectedBundle=null;render();});
$('#active-category button').addEventListener('click',()=>{category='all';render();});
$('#all-categories').addEventListener('click',()=>{resetFilters();$('#catalog').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});


addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!document.querySelector('dialog[open]')&&!event.target.closest('input,textarea,select,[contenteditable]')){event.preventDefault();search.focus();}});

const repository=$('#publish-repo');
function validateRepository(){
  let valid=false;
  try{const url=new URL(repository.value);valid=url.protocol==='https:'&&url.hostname==='github.com'&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname);}catch{}
  repository.setCustomValidity(valid?'':'Enter a GitHub repository URL, such as https://github.com/you/your-app.');
  return valid;
}
repository.addEventListener('input',()=>repository.setCustomValidity(''));
repository.addEventListener('change',validateRepository);
$('#publish-form').addEventListener('submit',event=>{
  event.preventDefault();if(!validateRepository()||!event.target.reportValidity()){repository.reportValidity();return;}
  const name=$('#publish-name').value.trim(),description=$('#publish-description').value.trim();
  if(!name||!description){$('#publish-status').textContent='Add an app name and a short description.';return;}
  const body=`## Community app submission\n\nApp name: ${name}\nRepository: ${repository.value.trim()}\n\n### Description\n${description}\n\n### Before listing\n- [ ] The repository is public and includes a README and installation instructions.\n- [ ] The app includes an Onbun manifest and works with the current client.\n- [ ] A GitHub release has the app’s .wmapp file (https://onbun.app/docs#publish).\n`;
  const url=new URL('https://github.com/MathieuDvv/WinMore-releases/issues/new');url.searchParams.set('title',`[App submission] ${name}`);url.searchParams.set('body',body);
  // Leave the final submission to the creator in GitHub; the static site stores no personal data.
  $('#publish-status').innerHTML=`Your submission draft is ready. <a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Open it on GitHub to submit <i class="ic ic-out" aria-hidden="true"></i></a>`;
  window.open(url.href,'_blank','noopener,noreferrer');
});

async function load(){
  try{
    const response=await fetch('data/apps.json');if(!response.ok)throw Error('Catalog unavailable');
    const data=await response.json();if(!Array.isArray(data.apps))throw Error('Invalid catalog');
    apps=data.apps.map(app=>({...app,collection:app.collection||'default'}));bundles=data.bundles||[];renderCategories();render();renderBundle();
  }catch{
    $('#result-count').textContent='Unavailable';$('.featured').hidden=true;$('#catalog-status').hidden=false;
    $('#catalog-status').innerHTML='The app store couldn’t be loaded. <button type="button" id="retry-catalog">Try again <i class="ic ic-out" aria-hidden="true"></i></button>';
    $('#retry-catalog').addEventListener('click',load);
  }
}
load();
})();
