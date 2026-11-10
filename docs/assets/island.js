// The WinMore island, as the site's navigation. On the landing page it starts as a big expanded
// player in the middle of the screen and, as you scroll, morphs into the resting pill at the top
// centre. Once docked, hovering (or tapping) expands it into the menu, the way the PC island expands.
(()=>{
const GHOST='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M4 11.2a8 8 0 0 1 16 0v7c-1.34 0-1.34-1.25-2.67-1.25s-1.33 1.25-2.66 1.25-1.34-1.25-2.67-1.25-1.33 1.25-2.67 1.25-1.33-1.25-2.66-1.25S5.34 18.2 4 18.2z"/><rect x="7.6" y="11.3" width="2.6" height="1.5" rx=".75" fill="var(--blue)"/><rect x="13.8" y="11.3" width="2.6" height="1.5" rx=".75" fill="var(--blue)"/></svg>';
const I={
  play:'<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>',
  pause:'<rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/>',
  prev:'<path d="M6 5h2v14H6zM9.5 12l9 6.5V5.5z"/>',
  next:'<path d="M16 5h2v14h-2zM14.5 12l-9 6.5V5.5z"/>',
  sound:'<path d="M4 9h3.5L12 5v14l-4.5-4H4z"/><path d="M15 8.5a5 5 0 0 1 0 7M17.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  muted:'<path d="M4 9h3.5L12 5v14l-4.5-4H4z"/><path d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  apps:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="3.5"/>',
  docs:'<path d="M6 3.5h8l4.5 4.5v12a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5zm7.5 1v4h4M8.5 12h7M8.5 15h7M8.5 18h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>',
  kit:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  download:'<path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
};
const icon=(name,cls='icon')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name]}</svg>`;
window.WinMoreIcons={icon,GHOST};
const RELEASES='https://github.com/MathieuDvv/WinMore-releases/releases/latest';
const page=document.body.dataset.page;               // "home" or "docs"
const home=page==='home'?'./':'index.html';
const wave='<span class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const cover=`<span class="cover" aria-hidden="true">${GHOST}</span>`;

const island=document.createElement('div');
island.className='island playing';
island.innerHTML=`
  <section class="player" aria-label="Example: music playing on the PC">
    <header><span class="logo">${GHOST}</span><strong>WinMore</strong><span class="status">iPhone connected</span></header>
    <div class="song">${cover}
      <div class="meta"><strong>Night Drive</strong><span>Ghost Signal · Example track</span>${wave}</div>
      <div class="controls">
        <button type="button" aria-label="Previous" data-act="prev">${icon('prev')}</button>
        <button type="button" class="main" aria-label="Pause" data-act="toggle">${icon('pause')}</button>
        <button type="button" aria-label="Next" data-act="next">${icon('next')}</button>
      </div>
    </div>
    <div class="scrub"><span data-now>0:00</span><span class="bar"><i></i></span><span data-left>-2:48</span></div>
    <footer><span>An island for your PC, a remote for your iPhone.</span>
      <button type="button" class="sound" aria-pressed="false" data-act="sound">${icon('muted')}<span>Hear it</span></button></footer>
  </section>
  <section class="rest"><a class="pill" href="${home}" aria-label="WinMore home. Hover for the menu"><span class="logo">${GHOST}</span><b>WinMore</b>${wave}</a></section>
  <section class="menu" aria-label="Site menu">
    <a class="pill" href="${home}"><span class="logo">${GHOST}</span><b>WinMore</b>${wave}</a>
    <nav>
      <a href="${home}#apps"${page==='home'?'':''}>${icon('apps')}<span>App library<small>What you can install</small></span></a>
      <a href="docs.html"${page==='docs'?' aria-current="page"':''}>${icon('docs')}<span>Documentation<small>How it all works</small></span></a>
      <a href="docs.html#explorer">${icon('kit')}<span>Components<small>Kit explorer</small></span></a>
      <a href="${RELEASES}">${icon('download')}<span>Download<small>Latest for Windows</small></span></a>
    </nav>
    <div class="mini">${cover}<span><b>Night Drive</b> · Ghost Signal</span>
      <button type="button" aria-label="Pause" data-act="toggle">${icon('pause')}</button></div>
  </section>`;
document.body.prepend(island);
const $=s=>island.querySelector(s);
const player=$('.player'),rest=$('.rest'),menu=$('.menu');

// ── geometry ────────────────────────────────────────
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ease=t=>1-Math.pow(1-t,3);
let progress=page==='home'?0:1,open=false;
function sizes(){
  const vw=innerWidth,vh=innerHeight,small=vw<640;
  const big={w:Math.min(640,vw-32),h:vw<=760?330:316};
  const pill={w:small?230:264,h:small?52:58};
  return {big,pill,hero:Math.min(2,(vw-32)/pill.w),
    menu:{w:Math.min(460,vw-24),h:small?292:262}};
}
// Where the island is: in the hero (top of the landing page) or docked at the top centre.
const inHero=()=>progress<.02;
const docked=()=>progress>=.999;
function layout(){
  const s=sizes(),t=ease(progress),vh=innerHeight;
  // The resting pill, scaled up in the hero and down to its real size when docked.
  const k=lerp(s.hero,1,t);
  let w=s.pill.w*k,h=s.pill.h*k,r=h/2;
  const showPlayer=open&&inHero(),showMenu=open&&docked();
  if(showPlayer){w=s.big.w;h=s.big.h;r=38;}
  if(showMenu){w=s.menu.w;h=s.menu.h;r=30;}
  const top=lerp((vh-h)/2-vh*.08,14,t);
  island.style.setProperty('--w',w+'px');island.style.setProperty('--h',h+'px');
  island.style.setProperty('--top',top+'px');island.style.setProperty('--r',r+'px');
  island.style.setProperty('--pill-h',s.pill.h+'px');island.style.setProperty('--pill-w',s.pill.w+'px');
  island.style.setProperty('--glow',lerp(80,26,t)+'px');
  player.style.width=s.big.w+'px';player.style.height=s.big.h+'px';
  player.style.left='50%';player.style.right='auto';
  player.style.transform='translateX(-50%)';
  player.style.opacity=showPlayer?1:0;
  player.style.pointerEvents=showPlayer?'auto':'none';
  player.style.transitionDelay=showPlayer?'.1s':'0s';
  rest.style.opacity=open?0:1;
  rest.style.pointerEvents=open?'none':'auto';
  rest.style.setProperty('--k',open?(showPlayer?s.hero:1):k);
  menu.style.opacity=showMenu?1:0;
  menu.style.pointerEvents=showMenu?'auto':'none';
  menu.style.transitionDelay=open?'.1s':'0s';
  document.documentElement.style.setProperty('--glow-o',clamp(1-progress*1.4));
  document.dispatchEvent(new CustomEvent('island:progress',{detail:progress}));
}
let morphTimer;
function morph(){island.classList.add('morph');clearTimeout(morphTimer);morphTimer=setTimeout(()=>island.classList.remove('morph'),460);}
// Hovering expands it: into the example player in the hero, into the menu once docked.
function setOpen(value){
  if(value&&!inHero()&&!docked())return;
  if(open===value)return;
  open=value;island.dataset.open=value;morph();layout();
}
if(page==='home'){
  const onScroll=()=>{const p=clamp(scrollY/Math.max(1,innerHeight*.85));if(p!==progress){progress=p;if(open&&!inHero()&&!docked())setOpen(false);layout();}};
  addEventListener('scroll',onScroll,{passive:true});onScroll();
}
addEventListener('resize',layout);
let closeTimer;
island.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){clearTimeout(closeTimer);setOpen(true);}});
island.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')closeTimer=setTimeout(()=>setOpen(false),220);});
island.addEventListener('focusin',()=>setOpen(true));
island.addEventListener('focusout',e=>{if(!island.contains(e.relatedTarget))setOpen(false);});
// Touch: the first tap on the resting pill opens the menu instead of following the link.
rest.querySelector('a').addEventListener('click',e=>{if(!open){e.preventDefault();setOpen(true);}});
document.addEventListener('pointerdown',e=>{if(open&&!island.contains(e.target))setOpen(false);});
addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
layout();

// ── fake playback ───────────────────────────────────
const DURATION=168;let position=37,playing=true,last=performance.now();
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const bar=$('.bar i'),now=$('[data-now]'),left=$('[data-left]');
function tick(t){
  if(playing){position+=(t-last)/1000;if(position>=DURATION)position=0;}
  last=t;
  bar.style.setProperty('--at',position/DURATION*100+'%');
  now.textContent=fmt(position);left.textContent='-'+fmt(DURATION-position);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
function setPlaying(value){
  playing=value;island.classList.toggle('playing',value);
  island.querySelectorAll('[data-act=toggle]').forEach(b=>{b.innerHTML=icon(value?'pause':'play');b.setAttribute('aria-label',value?'Pause':'Play');});
  synth.update();
}

// ── a tiny lo-fi loop, made in the browser (only after "Hear it") ──
const synth=(()=>{
  let ctx,master,timer,step=0,next=0,on=false;
  const BPM=84,SIXTEENTH=60/BPM/4;
  const CHORDS=[[57,60,64,67],[53,57,60,64],[48,52,55,59],[55,59,62,65]]; // Am7 Fmaj7 Cmaj7 G7
  const ARP=[0,2,1,3,2,1,3,2];
  const hz=n=>440*Math.pow(2,(n-69)/12);
  function voice(freq,time,len,type,gain,cutoff){
    const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();
    o.type=type;o.frequency.value=freq;f.type='lowpass';f.frequency.value=cutoff;
    g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(gain,time+Math.min(.02,len/4));
    g.gain.exponentialRampToValueAtTime(.0001,time+len);
    o.connect(f).connect(g).connect(master);o.start(time);o.stop(time+len+.05);
  }
  function hat(time){
    const len=.05,buffer=ctx.createBuffer(1,ctx.sampleRate*len,ctx.sampleRate),d=buffer.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
    const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
    s.buffer=buffer;f.type='highpass';f.frequency.value=7000;g.gain.value=.05;s.connect(f).connect(g).connect(master);s.start(time);
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
      if(s===0)chord.forEach((n,i)=>{voice(hz(n),next,SIXTEENTH*16,'triangle',.05,900);voice(hz(n)*1.004,next,SIXTEENTH*16,'sawtooth',.012,700);if(!i)voice(hz(n-12),next,SIXTEENTH*15,'sine',.16,400);});
      if(s%2===0)voice(hz(chord[ARP[s/2]]+12),next,SIXTEENTH*3,'sine',.07,2400);
      if(s===0||s===10)kick(next);
      if(s%4===2)hat(next);
      step++;next+=SIXTEENTH*(step%2?1.06:.94); // swing
    }
  }
  return {
    get on(){return on;},
    toggle(){
      on=!on;
      if(on&&!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=.5;master.connect(ctx.destination);}
      this.update();return on;
    },
    update(){
      if(!ctx)return;
      clearInterval(timer);
      if(on&&playing){ctx.resume();next=ctx.currentTime+.05;timer=setInterval(schedule,40);}
      else ctx.suspend();
    }
  };
})();

island.addEventListener('click',e=>{
  const act=e.target.closest('[data-act]')?.dataset.act;
  if(act==='toggle')setPlaying(!playing);
  if(act==='prev'||act==='next'){position=act==='prev'?0:Math.min(DURATION-1,position+30);}
  if(act==='sound'){
    const on=synth.toggle(),b=e.target.closest('button');
    b.setAttribute('aria-pressed',on);b.innerHTML=`${icon(on?'sound':'muted')}<span>${on?'Playing':'Hear it'}</span>`;
    if(on&&!playing)setPlaying(true);
  }
});
})();
