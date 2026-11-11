(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);

// The headline steps aside while the island moves up, or while it is expanded over it.
const copy=document.getElementById('hero-copy');
document.addEventListener('island',({detail})=>{
  copy.style.paddingTop=detail.heroBottom+56+'px';
  copy.style.opacity=detail.mode==='player'?0:Math.max(0,1-detail.progress*2.2);
});

fetch('data/apps.json').then(r=>r.json()).then(({apps})=>{
  document.getElementById('count').textContent=`${apps.length} apps`;
  document.getElementById('library').innerHTML=apps.map(app=>`
    <article class="app">
      <span class="glyph">${app.icon?`<img src="${esc(app.icon)}" alt="">`:''}</span>
      <div><h3>${esc(app.name)}<small>${esc(app.version)}</small></h3><p>${esc(app.description)}</p></div>
    </article>`).join('');
}).catch(()=>{document.getElementById('library').textContent='The app list could not be loaded.';});
})();
