// The site's navigation follows the Onbun island (public/island.html), drawn at the real
// island's sizes and scaled up. On the landing page it starts as a large resting pill and docks at
// the top centre as you scroll. Hovering expands it the way the PC island expands: into the music
// controls while it is in the hero, into the site menu once docked.
(()=>{
const GHOST='<svg viewBox="0 0 28 28" aria-hidden="true"><ellipse cx="10" cy="12" rx="3" ry="5" fill="#25251f"/><ellipse cx="18" cy="12" rx="3" ry="5" fill="#25251f"/><path d="m8 8 4 3-5 1m9-4 4 3-5 1" fill="#ededf0"/><path d="M9 20q5 5 10-1" fill="none" stroke="#25251f" stroke-width="1.5" stroke-linecap="round"/></svg>';
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
window.OnbunIcons={icon,GHOST};

const page=document.body.dataset.page;
const home=page==='home'?'./':'/';
const RELEASES='/#download';
const SIZES={rest:[232,48,25],player:[348,194,26],menu:[348,174,26]};

const island=document.createElement('nav');
island.className='island';island.dataset.mode='rest';island.setAttribute('aria-label','Onbun island navigation');
island.innerHTML=`
  <div class="rest"><button type="button" class="rest-open" aria-label="Open Onbun island" aria-expanded="false"><span class="rest-cover">${GHOST}</span><strong>onbun</strong><span class="activity playing" aria-hidden="true"><i></i><i></i><i></i></span></button></div>
  <div class="details player" aria-label="Example music">
    <header><span class="wordmark">onbun</span><span class="status">Give it a try</span><button type="button" data-act="collapse" aria-label="Collapse">${icon('collapse')}</button></header>
    <div class="song"><span class="cover"></span><div class="metadata"><strong>Night Drive</strong><span>Ghost Signal</span></div><button type="button" class="play" data-act="toggle" aria-label="Pause">${icon('pause')}</button></div>
    <div class="volume">${icon('speaker')}<input type="range" min="0" max="100" value="40" aria-label="Volume" data-act="volume"><output>40%</output></div>
    <div class="bottom"><button type="button" data-act="sound">Play sound</button><span>Made in your browser</span></div>
  </div>
  <div class="details menu">
    <header><a class="wordmark" href="${home}">onbun</a><span class="status">${page==='docs'?'The guide':page==='apps'?'The apps':'Hello there'}</span><button type="button" data-act="collapse" aria-label="Collapse">${icon('collapse')}</button></header>
    <div class="links">
      <a href="/apps"${page==='apps'?' aria-current="page"':''}>${icon('grid')}<span><strong>App store</strong><small>Find your next app</small></span></a>
      <a href="/docs"${page==='docs'?' aria-current="page"':''}>${icon('doc')}<span><strong>Documentation</strong><small>How it works</small></span></a>
      <a href="/viewer"${page==='viewer'?' aria-current="page"':''}>${icon('sliders')}<span><strong>Layout viewer</strong><small>Free developer tool</small></span></a>
      <a href="${RELEASES}">${icon('download')}<span><strong>Download the client</strong><small>Windows, macOS and Linux</small></span></a>
    </div>
  </div>`;
document.body.prepend(island);
const $=s=>island.querySelector(s);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let stage,grips;
if(page==='home'){
  stage=document.createElement('div');stage.className='lift-stage';stage.setAttribute('aria-hidden','true');
  const hand=side=>`<g class="${side}-hand"><path class="grasp-shape"/><path d="M-20-44H16V-56H-20Z" fill="#f0f0ee" stroke="#111114" stroke-width="2.4"/><path d="M-14-19q14-9 27-1" fill="none" stroke="#111114" stroke-width="1.8" stroke-linecap="round"/></g>`;
  const leg=side=>`<path class="limb-outline ${side}-leg-outline"/><path class="island-leg ${side}-leg"/>`;
  stage.innerHTML=`<svg><defs><clipPath id="leg-retraction-clip"><rect/></clipPath></defs><g class="island-leg-group" clip-path="url(#leg-retraction-clip)">${leg('left')}${leg('right')}<g class="left-shoe">${window.OnbunArt.shoe(0,0)}</g><g class="right-shoe">${window.OnbunArt.shoe(0,0)}</g></g><g class="island-arms"><path class="limb-outline left-arm-outline"/><path class="lift-arm left-arm"/><path class="limb-outline right-arm-outline"/><path class="lift-arm right-arm"/></g></svg>`;
  grips=document.createElement('div');grips.className='lift-grips';grips.setAttribute('aria-hidden','true');
  grips.innerHTML=`<svg>${hand('left')}${hand('right')}</svg>`;
  document.body.prepend(grips);document.body.prepend(stage);

}

// ── layout ───────────────────────────────────────────
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=t=>t*t*(3-2*t);
let progress=page==='home'?0:1,mode='rest';
const inHero=()=>progress<.02,docked=()=>progress>=.9;

function layout(){
  const vw=innerWidth,vh=innerHeight,t=smooth(clamp(progress/.9));
  const dock=vw<640?1:1.12;
  const compact=vh<600;
  const heroRest=Math.min(compact?1.5:1.95,(vw-78)/232);
  const heroTop=compact?Math.max(170,vh*.46):Math.max(vw<640?270:260,vh*.43);
  const heroOpen=Math.min(heroRest,(vw-32)/348,(vh-24-heroTop)/194);
  let k=lerp(heroRest,dock,t);
  if(mode==='player')k=heroOpen;
  if(mode==='menu')k=Math.min(dock,(vw-24)/348);
  const [w,baseHeight,r]=SIZES[mode];
  const h=mode==='menu'?Math.max(baseHeight,$('.menu').scrollHeight+30):baseHeight;
  island.style.width=w+'px';island.style.height=h+'px';island.style.borderRadius=r+'px';
  const top=lerp(heroTop,16,t);
  island.style.top=top+'px';
  island.style.transform=`translateX(-50%) scale(${k})`;
  if(stage){
    const mobile=vw<640,handScale=mobile?.65:.9;
    const bottom=top+h*k;
    const retract=smooth(clamp((progress-.08)/.48));
    const release=smooth(clamp((progress-.65)/.14));
    const retreat=smooth(clamp((progress-.79)/.21));
    const legLength=compact?64:mobile?102:138;
    const shoeScale=mobile?.62:.82;
    const travel=retract*(legLength+35*shoeScale+18);
    const spread=w*k*.15,rootY=bottom-16-travel,footY=bottom+legLength-travel;
    const clip=stage.querySelector('#leg-retraction-clip rect');
    clip.setAttribute('x',0);clip.setAttribute('y',bottom);clip.setAttribute('width',vw);clip.setAttribute('height',vh);
    const setLimb=(name,d,width)=>{
      const inner=stage.querySelector('.'+name),outline=stage.querySelector('.'+name+'-outline');
      inner.setAttribute('d',d);outline.setAttribute('d',d);
      inner.setAttribute('stroke-width',width);outline.setAttribute('stroke-width',width+2);
    };
    setLimb('left-leg',`M${vw/2-spread} ${rootY}C${vw/2-spread-32} ${rootY+47} ${vw/2-spread+18} ${footY-35} ${vw/2-spread-10} ${footY}`,mobile?12:16);
    setLimb('right-leg',`M${vw/2+spread} ${rootY}C${vw/2+spread+32} ${rootY+47} ${vw/2+spread-18} ${footY-35} ${vw/2+spread+10} ${footY}`,mobile?12:16);
    stage.querySelector('.left-shoe').setAttribute('transform',`translate(${vw/2-spread-10} ${footY}) scale(${-shoeScale} ${shoeScale})`);
    stage.querySelector('.right-shoe').setAttribute('transform',`translate(${vw/2+spread+10} ${footY}) scale(${shoeScale})`);
    stage.dataset.legs=retract===1?'retracted':retract>0?'retracting':'extended';
    stage.dataset.retraction=String(retract);
    // Arm control points use the remaining vertical length. Their y coordinates
    // stay monotonic, so pulling cannot fold an elbow back into a pointed loop.
    const gripY=top+2-release*25*handScale-retreat*(vh*.3+180);
    const left=vw/2-w*k*.28,right=vw-left,wristY=gripY-48*handScale;
    function armPath(end,mirror=false){
      const origin=vw*(mirror?.72:.28),length=wristY+90;
      const amplitude=Math.max(0,Math.min(vw*.075,Math.abs(length)*.2,95));
      const points=Array.from({length:9},(_,i)=>{
        const u=i/8,blend=smooth(u),wave=Math.sin(u*Math.PI*2)*Math.sin(u*Math.PI)*amplitude;
        return {x:lerp(origin,end,blend)+(mirror?-wave:wave),y:-90+length*u};
      });
      let d=`M${points[0].x} ${points[0].y}`;
      for(let i=0;i<points.length-1;i++){
        const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
        d+=`C${p1.x+(p2.x-p0.x)/6} ${p1.y+(p2.y-p0.y)/6} ${p2.x-(p3.x-p1.x)/6} ${p2.y-(p3.y-p1.y)/6} ${p2.x} ${p2.y}`;
      }
      return d;
    }
    setLimb('left-arm',armPath(left),mobile?13:18);
    setLimb('right-arm',armPath(right,true),mobile?13:18);
    const finger=lerp(17,-14,release),tip=lerp(12,-19,release),base=lerp(2,-23,release);
    const grasp=`M-23-21C-26-39-10-46 7-42C17-40 22-32 22-20L22 ${tip}C22 ${tip+10} 12 ${tip+10} 12 ${tip}L11 ${base}L8 ${finger}C7 ${finger+10}-3 ${finger+10}-4 ${finger-1}L-5 ${base}L-8 ${finger}C-10 ${finger+9}-20 ${finger+6}-19 ${finger-3}L-19 ${lerp(-1,-20,release)}C-26 ${lerp(5,-12,release)}-34 ${lerp(1,-16,release)}-33 ${lerp(-6,-24,release)}C-32-12-26-18-23-21Z`;
    grips.querySelectorAll('.grasp-shape').forEach(path=>path.setAttribute('d',grasp));
    grips.querySelector('.left-hand').setAttribute('transform',`translate(${left} ${gripY}) scale(${handScale})`);
    grips.querySelector('.right-hand').setAttribute('transform',`translate(${right} ${gripY}) scale(${-handScale} ${handScale})`);
    stage.dataset.arms=progress<.65?'gripping':progress<.79?'releasing':progress<1?'withdrawing':'withdrawn';
    stage.style.visibility=reducedMotion.matches?'hidden':'visible';
    grips.style.visibility=stage.style.visibility;
  }
  document.dispatchEvent(new CustomEvent('island',{detail:{progress,mode,heroBottom:heroTop+48*heroRest}}));
}
let morphTimer;
function setMode(next){
  if(next==='player'&&!inHero())next='rest';
  if(next==='menu'&&!docked())next='rest';
  if(next===mode)return;
  mode=next;island.dataset.mode=next;
  $('.rest-open').setAttribute('aria-expanded',String(next!=='rest'));
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
    requestLayout();
  },{passive:true});
  progress=clamp(scrollY/Math.max(1,innerHeight*.8));
}
let layoutFrame=0;
function requestLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;layout();});}
addEventListener('resize',requestLayout);
reducedMotion.addEventListener('change',requestLayout);
layout();
// Again once the page's own scripts are listening for 'island' events.
addEventListener('DOMContentLoaded',layout);

// Hover opens after a short pause and closes shortly after leaving, like the PC island.
let hoverTimer,closeTimer;
island.addEventListener('pointerenter',e=>{if(e.pointerType!=='mouse')return;clearTimeout(closeTimer);hoverTimer=setTimeout(expand,mode==='rest'?200:0);});
island.addEventListener('pointerleave',e=>{if(e.pointerType!=='mouse')return;clearTimeout(hoverTimer);closeTimer=setTimeout(()=>setMode('rest'),400);});
island.addEventListener('focusin',()=>{clearTimeout(closeTimer);});
island.addEventListener('focusout',e=>{if(!island.contains(e.relatedTarget))setMode('rest');});
// Touch: tapping the pill expands it instead of following the link.
$('.rest-open').addEventListener('click',e=>{e.preventDefault();expand();if(e.detail===0)$(mode==='player'?'.player .play':'.menu .wordmark').focus({preventScroll:true});});
document.addEventListener('pointerdown',e=>{if(mode!=='rest'&&!island.contains(e.target))setMode('rest');});
addEventListener('keydown',e=>{if(e.key==='Escape'&&mode!=='rest'){setMode('rest');$('.rest-open').focus({preventScroll:true});}});

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
