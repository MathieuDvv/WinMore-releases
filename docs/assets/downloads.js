/* Resolve real installers per platform; a Windows-only release must not hide mobile/mac builds. */
(function(){
'use strict';
const API='https://api.github.com/repos/MathieuDvv/WinMore-releases/releases?per_page=100';
const CACHE='onbun-downloads-v1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const systems=[
 {id:'windows',name:'Windows',art:'feet',color:'#293e6a'},
 {id:'macos',name:'macOS',art:'feet',color:'#51436b'},
 {id:'linux',name:'Linux',art:'feet',color:'#50603a'},
 {id:'android',name:'Android',art:'hands',color:'#28594b'},
 {id:'ios',name:'iOS',art:'hands',color:'#744750'}
];
function installer(asset){
 const name=asset.name||'',arch=/-(arm64|aarch64)\b/i.test(name)?'arm64':/-(ia32|x86)\b/i.test(name)?'x86':'x64';
 if(!/^(?:WinMore|Onbun)-/i.test(name))return null;
 if(/-Setup-.*\.exe$/i.test(name))return {os:'windows',key:arch,label:arch==='arm64'?'ARM64':arch==='x86'?'Intel / AMD · 32-bit':'Intel / AMD · 64-bit',rank:0};
 if(/-Android-.*\.apk$/i.test(name))return {os:'android',key:'apk',label:'Android 10+ · APK',rank:0};
 if(/-iOS-.*\.ipa$/i.test(name))return {os:'ios',key:'ipa',label:'iPhone · IPA',rank:0};
 if(/\.(dmg|zip)$/i.test(name)&&/-(arm64|x64)(?:-mac)?\./i.test(name))return {os:'macos',key:arch,label:arch==='arm64'?'Apple silicon':'Intel',rank:/\.dmg$/i.test(name)?0:1};
 if(/\.(AppImage|deb)$/i.test(name)){
  const format=/\.deb$/i.test(name)?'deb':'AppImage';
  return {os:'linux',key:`${arch}-${format}`,label:`${format==='deb'?'DEB':'AppImage'} · ${arch==='arm64'?'ARM64':'64-bit'}`,rank:0};
 }
 return null;
}
// Releases after the rename also carry WinMore-named copies for older installs; show the Onbun file.
const legacy=asset=>/^WinMore-/i.test(asset.name||'')?1:0;
function safeAsset(asset){
 try{const url=new URL(asset.browser_download_url);return url.protocol==='https:'&&url.hostname==='github.com'&&url.pathname.startsWith('/MathieuDvv/WinMore-releases/releases/download/')&&!url.username&&!url.password;}catch{return false;}
}
function versionParts(release){return (release.tag_name?.match(/\d+(?:\.\d+)+/)?.[0]||'0').split('.').map(Number);}
function newestFirst(a,b){
 const av=versionParts(a),bv=versionParts(b);
 for(let i=0;i<Math.max(av.length,bv.length);i++){const delta=(bv[i]||0)-(av[i]||0);if(delta)return delta;}
 return (Date.parse(b.published_at)||0)-(Date.parse(a.published_at)||0);
}
function resolveDownloads(releases){
 const result=Object.fromEntries(systems.map(os=>[os.id,[]]));
 for(const release of releases.filter(r=>!r.draft&&!r.prerelease).sort(newestFirst)){
  const candidates=(release.assets||[]).filter(safeAsset).map(asset=>({asset,type:installer(asset)})).filter(x=>x.type).sort((a,b)=>a.type.rank-b.type.rank||legacy(a.asset)-legacy(b.asset));
  for(const {asset,type} of candidates){
   if(result[type.os].some(entry=>entry.key===type.key))continue;
   result[type.os].push({...type,url:asset.browser_download_url,name:asset.name,size:asset.size,version:release.tag_name});
  }
 }
 result.linux.sort((a,b)=>Number(a.key.endsWith('deb'))-Number(b.key.endsWith('deb')));
 return result;
}
if(typeof module==='object'&&module.exports){module.exports={installer,resolveDownloads};return;}
const host=document.querySelector('#download-cards');if(!host)return;
const status=document.querySelector('#download-status');
const osIcons={
 windows:'<path d="m3 5 8-1v7H3Zm10-1 8-1v8h-8ZM3 13h8v7l-8-1Zm10 0h8v8l-8-1Z"/>',
 macos:'<path d="M15.8 2.2c.2 1.7-.5 3.1-1.5 4.1-1 1-2.2 1.5-3.5 1.3-.2-1.6.6-3.1 1.5-4.1 1-.9 2.3-1.5 3.5-1.3ZM19.4 17.1c-.5 1.1-.8 1.7-1.4 2.6-.9 1.4-2.1 3.1-3.6 3.1-1.3 0-1.7-.9-3.4-.9-1.6 0-2.1.9-3.4.9-1.5 0-2.6-1.5-3.5-2.9C1.6 16 1.1 10.4 4 8.7c2-1.2 4.2-.7 5.5-.1.8.4 1.2.5 1.7.5s1.1-.2 2-.6c1.2-.5 3.6-.9 5.3.7-3.8 2.2-3.2 6.7.9 7.9Z" transform="translate(1 -1) scale(.95)"/>',
 linux:'<path d="M7 9C5 12 4 15 5 19l3 1h8l3-1c1-4 0-7-2-10V7a5 5 0 0 0-10 0Z"/><ellipse cx="12" cy="15" rx="4" ry="5" fill="var(--os-color)"/><ellipse cx="10" cy="7" rx="1.3" ry="2" fill="var(--os-color)"/><ellipse cx="14" cy="7" rx="1.3" ry="2" fill="var(--os-color)"/><path d="m9 10 3 2 3-2-3-1ZM3 19l5-1 2 4H2Zm18 0-5-1-2 4h8Z"/>',
 android:'<path d="m7 4-1-2m11 2 1-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 10a8 8 0 0 1 16 0Zm0 2h16v7H4Z"/><path d="M2 12v6m20-6v6M8 18v4m8-4v4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="8" cy="7" r="1" fill="var(--os-color)"/><circle cx="16" cy="7" r="1" fill="var(--os-color)"/>',
 ios:''
};
osIcons.ios=`<g transform="translate(5 5) scale(.6)">${osIcons.macos}</g><rect x="3" y="1" width="18" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 20h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
const arrow='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></svg>';
let downloads=null;
const selections=new Map();
function render(data){
 downloads=data;
 host.innerHTML=systems.map(os=>{
  const entries=data?.[os.id]||[],choice=entries.find(entry=>entry.key===selections.get(os.id))||entries[0];
  return `<article class="download-card" data-os="${os.id}" style="--os-color:${os.color}"><div class="download-art"><img src="assets/art/onbun-${os.art}.svg" alt="" width="240" height="200"></div><div class="download-body"><h3>${os.name}</h3><span class="os-mark"><svg viewBox="0 0 24 24" aria-hidden="true">${osIcons[os.id]}</svg></span>${entries.length>1?`<label class="sr-only" for="variant-${os.id}">${os.name} installer</label><select id="variant-${os.id}" data-download-variant="${os.id}">${entries.map(entry=>`<option value="${esc(entry.key)}"${choice.key===entry.key?' selected':''}>${esc(entry.label)}</option>`).join('')}</select>`:`${os.id==='ios'&&!choice?'<a class="download-format download-help" href="docs.html#install">Build with Xcode ↗</a>':`<span class="download-format">${esc(choice?.label||(data?'No public build yet':'Checking releases…'))}</span>`}`}<span class="download-version">${choice?`${esc(choice.version)} · ${(choice.size/1048576).toFixed(1)} MB`:data?(os.id==='ios'?'Source build only':'No installer yet'):'Latest version'}</span>${choice?`<a class="btn download-button" href="${esc(choice.url)}" download="${esc(choice.name)}" aria-label="Download Onbun for ${os.name}, ${esc(choice.label)}, ${esc(choice.version)}">Download ${arrow}</a>`:`<button class="btn download-button" type="button" disabled>${data?'Not available yet':'Loading…'}</button>`}</div></article>`;
 }).join('');
}
host.addEventListener('change',event=>{
 const os=event.target.dataset.downloadVariant;if(!os)return;
 selections.set(os,event.target.value);
 // Preserve the native select and its keyboard focus when choosing an installer.
 const entry=downloads[os].find(item=>item.key===event.target.value),card=event.target.closest('.download-card'),link=card.querySelector('.download-button');
 card.querySelector('.download-version').textContent=`${entry.version} · ${(entry.size/1048576).toFixed(1)} MB`;
 link.href=entry.url;link.download=entry.name;link.setAttribute('aria-label',`Download Onbun for ${systems.find(s=>s.id===os).name}, ${entry.label}, ${entry.version}`);
});
async function load(){
 const retry=status.querySelector('button');if(retry)retry.disabled=true;
 status.textContent='Checking latest releases…';
 try{
  let url=API,releases=[];
  while(url){
   const response=await fetch(url,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('Releases unavailable');
   const page=await response.json();if(!Array.isArray(page))throw Error('Invalid releases');
   releases.push(...page);
   const resolved=resolveDownloads(releases);
   url=systems.every(os=>resolved[os.id].length)?null:response.headers.get('Link')?.match(/<([^>]+)>; rel="next"/)?.[1];
  }
  const data=resolveDownloads(releases);render(data);status.textContent='Latest available build for each platform.';
  try{localStorage.setItem(CACHE,JSON.stringify({at:Date.now(),releases}));}catch{}
 }catch{
  status.textContent=downloads?'Showing previously checked downloads. ':'Downloads couldn’t be checked. ';
  if(!downloads){host.querySelectorAll('.download-version').forEach(el=>el.textContent='Check unavailable');host.querySelectorAll('.download-format').forEach(el=>el.textContent='Try again below');host.querySelectorAll('.download-button').forEach(el=>el.textContent='Unavailable');}
  const button=document.createElement('button');button.type='button';button.textContent='Try again';button.addEventListener('click',load);status.append(button);
 }
}
try{
 const cached=JSON.parse(localStorage.getItem(CACHE));
 if(cached&&Date.now()-cached.at<7*86400000&&Array.isArray(cached.releases))downloads=resolveDownloads(cached.releases);
}catch{}
render(downloads);load();
})();
