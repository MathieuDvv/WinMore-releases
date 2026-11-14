(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);

// The hero contains only artwork and the scroll cue.
const scene=document.querySelector('.hero-scene');
document.addEventListener('island',({detail})=>{
  scene.querySelectorAll('.hero-bottom').forEach(el=>{el.style.opacity=Math.max(0,1-detail.progress*1.4);});
});

fetch('data/apps.json').then(r=>r.json()).then(({apps})=>{
  document.getElementById('all-apps-label').textContent=`Explore all ${apps.length} apps`;
  const available=apps.filter(app=>app.collection!=='developer'&&app.collection!=='community');
  const featured=['music','mixer','clipboard'].map(id=>available.find(app=>app.id===id)).filter(Boolean);
  apps=[...featured,...available.filter(app=>!featured.includes(app))].slice(0,3);
  document.getElementById('count').textContent=`${apps.length} featured apps`;
  document.getElementById('library').innerHTML=apps.map(app=>`
    <article class="app">
      <span class="glyph">${app.icon?`<img src="${esc(app.icon)}" alt="">`:''}</span>
      <div><h3>${esc(app.name)}<small>${esc(app.version)}</small></h3><p>${esc(app.description)}</p></div>
    </article>`).join('');
}).catch(()=>{document.getElementById('library').textContent='The app list could not be loaded.';});
})();
