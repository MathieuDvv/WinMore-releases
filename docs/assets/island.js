// The site's navigation is a copy of the WinMore island (public/island.html), drawn at the real
// island's sizes and scaled up. On the landing page it starts as a large resting pill and docks at
// the top centre as you scroll. Hovering expands it the way the PC island expands: into the music
// controls while it is in the hero, into the site menu once docked.
(()=>{
const GHOST='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M4 11.2a8 8 0 0 1 16 0v7c-1.34 0-1.34-1.25-2.67-1.25s-1.33 1.25-2.66 1.25-1.34-1.25-2.67-1.25-1.33 1.25-2.67 1.25-1.33-1.25-2.66-1.25S5.34 18.2 4 18.2z"/><rect x="7.6" y="11.3" width="2.6" height="1.5" rx=".75" fill="var(--logo)"/><rect x="13.8" y="11.3" width="2.6" height="1.5" rx=".75" fill="var(--logo)"/></svg>';
// Same stroke icons as the island.
const I={
  play:'<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor" stroke="none"/>',
  speaker:'<path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/>',
  collapse:'<path d="M7 12h10"/>',
  grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
  doc:'<path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5Zm0 0v4.5h4.5M9 12.5h6M9 16h6"/>',
  sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  download:'<path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19h14"/>',
};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;
window.WinMoreIcons={icon,GHOST};

const page=document.body.dataset.page;               // "home" or "docs"
const home=page==='home'?'./':'index.html';
const RELEASES='https://github.com/MathieuDvv/WinMore-releases/releases/latest';
const SIZES={rest:[232,48,25],player:[348,194,26],menu:[348,174,26]};

const island=document.createElement('nav');
island.className='island';island.dataset.mode='rest';island.setAttribute('aria-label','WinMore');
island.innerHTML=`
  <div class="rest"><a class="rest-open" href="${home}" aria-label="WinMore"><span class="rest-cover">${GHOST}</span><strong>WinMore</strong><span class="activity playing" aria-hidden="true"><i></i><i></i><i></i></span></a></div>
  <div class="details player" aria-label="Example music">
    <header><span class="wordmark">WinMore</span><span class="status">Example</span><button type="button" data-act="collapse" aria-label="Collapse">${icon('collapse')}</button></header>
    <div class="song"><span class="cover"></span><div class="metadata"><strong>Night Drive</strong><span>Ghost Signal</span></div><button type="button" class="play" data-act="toggle" aria-label="Pause">${icon('pause')}</button></div>
    <div class="volume">${icon('speaker')}<input type="range" min="0" max="100" value="40" aria-label="Volume" data-act="volume"><output>40%</output></div>
    <div class="bottom"><button type="button" data-act="sound">Play sound</button><span>Made in your browser</span></div>
  </div>
  <div class="details menu">
    <header><a class="wordmark" href="${home}">WinMore</a><span class="status">${page==='docs'?'Docs':'Home'}</span><button type="button" data-act="collapse" aria-label="Collapse">${icon('collapse')}</button></header>
    <div class="links">
      <a href="${home}#apps">${icon('grid')}<span><strong>App library</strong><small>What you can install</small></span></a>
      <a href="docs.html"${page==='docs'?' aria-current="page"':''}>${icon('doc')}<span><strong>Documentation</strong><small>How it works</small></span></a>
      <a href="docs.html#explorer">${icon('sliders')}<span><strong>Components</strong><small>Kit explorer</small></span></a>
      <a href="${RELEASES}">${icon('download')}<span><strong>Download the client</strong><small>Windows, macOS and Linux</small></span></a>
    </div>
  </div>`;
document.body.prepend(island);
const $=s=>island.querySelector(s);

// ── layout ───────────────────────────────────────────
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ease=t=>1-Math.pow(1-t,3);
let progress=page==='home'?0:1,mode='rest';
const inHero=()=>progress<.02,docked=()=>progress>.999;

function layout(){
  const vw=innerWidth,vh=innerHeight,t=ease(progress);
  const dock=vw<640?1:1.12;
  const heroRest=Math.min(2.2,(vw-32)/232);
  const heroTop=Math.max(72,vh*.34-24*heroRest);
  const heroOpen=Math.min(heroRest,(vw-32)/348,(vh-24-heroTop)/194);
  let k=lerp(heroRest,dock,t);
  if(mode==='player')k=heroOpen;
  if(mode==='menu')k=Math.min(dock,(vw-24)/348);
  const [w,h,r]=SIZES[mode];
  island.style.width=w+'px';island.style.height=h+'px';island.style.borderRadius=r+'px';
  island.style.top=lerp(heroTop,12,t)+'px';
  island.style.transform=`translateX(-50%) scale(${k})`;
  document.dispatchEvent(new CustomEvent('island',{detail:{progress,mode,heroBottom:heroTop+48*heroRest}}));
}
let morphTimer;
function setMode(next){
  if(next==='player'&&!inHero())next='rest';
  if(next==='menu'&&!docked())next='rest';
  if(next===mode)return;
  mode=next;island.dataset.mode=next;
  island.classList.add('morph');clearTimeout(morphTimer);morphTimer=setTimeout(()=>island.classList.remove('morph'),460);
  layout();
}
const expand=()=>setMode(inHero()?'player':'menu');

if(page==='home'){
  addEventListener('scroll',()=>{
    const p=clamp(scrollY/Math.max(1,innerHeight*.8));
    if(p===progress)return;
    progress=p;
    if(mode!=='rest'&&!(mode==='player'&&inHero())&&!(mode==='menu'&&docked()))setMode('rest');
    layout();
  },{passive:true});
  progress=clamp(scrollY/Math.max(1,innerHeight*.8));
}
addEventListener('resize',layout);
layout();
// Again once the page's own scripts are listening for 'island' events.
addEventListener('DOMContentLoaded',layout);

// Hover opens after a short pause and closes shortly after leaving, like the PC island.
let hoverTimer,closeTimer;
island.addEventListener('pointerenter',e=>{if(e.pointerType!=='mouse')return;clearTimeout(closeTimer);hoverTimer=setTimeout(expand,mode==='rest'?200:0);});
island.addEventListener('pointerleave',e=>{if(e.pointerType!=='mouse')return;clearTimeout(hoverTimer);closeTimer=setTimeout(()=>setMode('rest'),400);});
island.addEventListener('focusin',()=>{clearTimeout(closeTimer);expand();});
island.addEventListener('focusout',e=>{if(!island.contains(e.relatedTarget))setMode('rest');});
// Touch: tapping the pill expands it instead of following the link.
$('.rest-open').addEventListener('click',e=>{if(mode==='rest'){e.preventDefault();expand();}});
document.addEventListener('pointerdown',e=>{if(mode!=='rest'&&!island.contains(e.target))setMode('rest');});
addEventListener('keydown',e=>{if(e.key==='Escape')setMode('rest');});

// ── the example player ───────────────────────────────
let playing=true;
const synth=(()=>{
  // A short lo-fi loop made with Web Audio, only after "Play sound".
  let ctx,master,timer,step=0,next=0,on=false,volume=.4;
  const SIXTEENTH=60/84/4,CHORDS=[[57,60,64,67],[53,57,60,64],[48,52,55,59],[55,59,62,65]],ARP=[0,2,1,3,2,1,3,2];
  const hz=n=>440*Math.pow(2,(n-69)/12);
  function voice(freq,time,len,type,gain,cutoff){
    const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();
    o.type=type;o.frequency.value=freq;f.type='lowpass';f.frequency.value=cutoff;
    g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(gain,time+Math.min(.02,len/4));g.gain.exponentialRampToValueAtTime(.0001,time+len);
    o.connect(f).connect(g).connect(master);o.start(time);o.stop(time+len+.05);
  }
  function kick(time){
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.setValueAtTime(110,time);o.frequency.exponentialRampToValueAtTime(42,time+.18);
    g.gain.setValueAtTime(.5,time);g.gain.exponentialRampToValueAtTime(.001,time+.3);
    o.connect(g).connect(master);o.start(time);o.stop(time+.32);
  }
  function schedule(){
    while(next<ctx.currentTime+.15){
      const chord=CHORDS[Math.floor(step/16)%4],s=step%16;
      if(s===0)chord.forEach((n,i)=>{voice(hz(n),next,SIXTEENTH*16,'triangle',.05,900);if(!i)voice(hz(n-12),next,SIXTEENTH*15,'sine',.16,400);});
      if(s%2===0)voice(hz(chord[ARP[s/2]]+12),next,SIXTEENTH*3,'sine',.07,2400);
      if(s===0||s===10)kick(next);
      step++;next+=SIXTEENTH*(step%2?1.06:.94);
    }
  }
  return {
    get on(){return on;},
    toggle(){
      on=!on;
      if(on&&!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.connect(ctx.destination);}
      this.update();return on;
    },
    volume(v){volume=v;if(master)master.gain.value=volume*1.2;},
    update(){
      if(!ctx)return;
      master.gain.value=volume*1.2;clearInterval(timer);
      if(on&&playing){ctx.resume();next=ctx.currentTime+.05;timer=setInterval(schedule,40);}else ctx.suspend();
    }
  };
})();
island.addEventListener('click',e=>{
  const act=e.target.closest('[data-act]')?.dataset.act;
  if(act==='collapse')setMode('rest');
  if(act==='toggle'){
    playing=!playing;
    island.querySelector('.activity').classList.toggle('playing',playing);
    const b=$('.play');b.innerHTML=icon(playing?'pause':'play');b.setAttribute('aria-label',playing?'Pause':'Play');
    synth.update();
  }
  if(act==='sound'){const on=synth.toggle();e.target.textContent=on?'Stop sound':'Play sound';}
});
$('[data-act=volume]').addEventListener('input',e=>{$('.volume output').textContent=e.target.value+'%';synth.volume(e.target.value/100);});
})();
