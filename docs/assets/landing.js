(()=>{
const {icon}=window.WinMoreIcons;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const kb=n=>n<1024*1024?`${Math.max(1,Math.round(n/1024))} KB`:`${(n/1048576).toFixed(1)} MB`;
document.getElementById('download').innerHTML=`${icon('download')}Download for Windows`;

// The headline fades as the island leaves the middle of the screen.
const copy=document.getElementById('hero-copy');
document.addEventListener('island:progress',e=>{copy.style.opacity=Math.max(0,1-e.detail*2.2);});

fetch('data/apps.json').then(r=>r.json()).then(({apps})=>{
  const library=document.getElementById('library');
  document.getElementById('count').textContent=`${apps.length} apps`;
  library.innerHTML=apps.map(app=>`
    <article class="app">
      <div class="app-top">
        <span class="glyph">${app.icon?`<img src="${esc(app.icon)}" alt="">`:''}</span>
        <div><h3>${esc(app.name)}</h3><span class="ver">v${esc(app.version)}</span></div>
      </div>
      <p>${esc(app.description)}</p>
      <div class="tags"><span class="tag">${kb(app.size)}</span>${app.platforms?.includes('win32')?'<span class="tag">Windows only</span>':''}</div>
    </article>`).join('')+`
    <a class="app build" href="docs.html#build">
      <div class="app-top"><span class="glyph"><svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg></span>
      <div><h3>Build your own</h3><span class="ver">a folder + JSON</span></div></div>
      <p>Write a screen in JSON, a backend in JavaScript, and drop the folder into WinMore.</p>
    </a>`;
  library.addEventListener('pointermove',e=>{
    const card=e.target.closest('.app');if(!card)return;
    const r=card.getBoundingClientRect();
    card.style.setProperty('--mx',`${e.clientX-r.left}px`);card.style.setProperty('--my',`${e.clientY-r.top}px`);
  });
}).catch(()=>{document.getElementById('library').textContent='The app list could not be loaded.';});
})();
