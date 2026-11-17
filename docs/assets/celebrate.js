// After "Open in Onbun": two long rubber arms rise from the bottom of the screen and throw confetti,
// then a card thanks the visitor and points to Ko-fi before they go back to the store.
(()=>{
'use strict';
const KOFI='https://ko-fi.com/dotslimy';
const rubber='#101013',edge='#a5a5ae';
const colors=['#eeeeef','#efc34b','#9fb8ff','#7fd6a2','#ff8d86','#c9a3ff','#2b7164','#8a5260','#544384'];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ease=t=>t<0?0:t>1?1:1-Math.pow(1-t,3);
let dialog,canvas,ctx,svg,frame=0,start=0,particles=[],bursts=new Set(),leaving=0,size={w:0,h:0,dpr:1};

function build(){
  dialog=document.createElement('dialog');
  dialog.className='celebrate';dialog.setAttribute('aria-labelledby','celebrate-title');
  const arm=side=>`<g class="celebrate-arm ${side}"><path class="arm-edge" fill="none" stroke="${edge}" stroke-linecap="round" stroke-linejoin="round"/><path class="arm-rubber" fill="none" stroke="${rubber}" stroke-linecap="round" stroke-linejoin="round"/><g class="arm-hand"><g transform="translate(0 -21)">${window.OnbunArt?.glove(0,0)||''}</g></g></g>`;
  dialog.innerHTML=`<canvas class="celebrate-confetti" aria-hidden="true"></canvas><svg class="celebrate-arms" aria-hidden="true">${arm('left')}${arm('right')}</svg>
    <div class="celebrate-card"><span class="label">Added to Onbun</span><h2 id="celebrate-title"></h2><p class="celebrate-status" role="status"></p>
    <p class="celebrate-kofi">Onbun is free and made by one person. If you like it, you can support it on Ko-fi.</p>
    <div class="celebrate-actions"><a class="btn primary" href="${KOFI}" target="_blank" rel="noopener"><i class="ic ic-heart" aria-hidden="true"></i>Donate on Ko-fi</a><button class="btn" type="button" data-celebrate-close>Back to the store</button></div></div>`;
  document.body.append(dialog);
  canvas=dialog.querySelector('canvas');ctx=canvas.getContext('2d');svg=dialog.querySelector('svg');
  dialog.querySelector('[data-celebrate-close]').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  addEventListener('resize',()=>{if(dialog.open){resize();if(!frame)draw(performance.now());}});
}

function resize(){
  const w=innerWidth,h=innerHeight,dpr=Math.min(2,devicePixelRatio||1);
  size={w,h,dpr};canvas.width=w*dpr;canvas.height=h*dpr;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
}

// One arm: a wavy rubber tube from below the bottom edge to the glove, like the page's separators.
function armPose(side,t){
  const {w,h}=size,mobile=w<640,dir=side==='left'?1:-1;
  const rise=leaving?1-ease((t-leaving)/350):ease((t-80)/750);
  // The hands land just outside the card's sides when there's room, else just below it, so the card
  // never hides them. offset* ignore the card's entrance transform.
  const card=dialog.querySelector('.celebrate-card'),left=card.offsetLeft,right=left+card.offsetWidth,top=card.offsetTop,bottom=top+card.offsetHeight;
  const beside=left>=120;
  const targetX=beside?(side==='left'?left-60:right+60):w/2-dir*Math.min(card.offsetWidth*.3,120);
  const targetY=beside?top+card.offsetHeight*.42:Math.min(h-60,bottom+80);
  const baseX=targetX-dir*(beside?Math.min(left*.55,140):40),baseY=h+70;
  const tipX=targetX,tipY=h+130-(h+130-targetY)*rise;
  // A quick flick when the confetti flies, then a gentle sway.
  const flick=Math.exp(-Math.pow((t-900)/120,2))*0.6+Math.exp(-Math.pow((t-1550)/120,2))*0.4;
  const sway=Math.sin(t/520+(side==='left'?0:1.7))*(reducedMotion.matches?0:1);
  const end={x:tipX+dir*(flick*28+sway*10),y:tipY-flick*22+Math.cos(t/610)*6*(reducedMotion.matches?0:1)};
  const dx=end.x-baseX,dy=end.y-baseY,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  const waves=2,amp=Math.min(34,len*.07)*(reducedMotion.matches?1:.8+.2*Math.sin(t/300));
  const points=Array.from({length:25},(_,i)=>{
    const u=i/24,env=Math.sin(u*Math.PI)**2,off=Math.sin(u*Math.PI*2*waves-t/260*(reducedMotion.matches?0:1))*amp*env*dir;
    return {x:baseX+dx*u+nx*off,y:baseY+dy*u+ny*off};
  });
  let d=`M${points[0].x} ${points[0].y}`;
  for(let i=0;i<points.length-1;i++){
    const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
    d+=`C${p1.x+(p2.x-p0.x)/6} ${p1.y+(p2.y-p0.y)/6} ${p2.x-(p3.x-p1.x)/6} ${p2.y-(p3.y-p1.y)/6} ${p2.x} ${p2.y}`;
  }
  const a=points[22],angle=Math.atan2(end.y-a.y,end.x-a.x)*180/Math.PI+90;
  return {d,end,angle,heading:Math.atan2(end.y-a.y,end.x-a.x)};
}

function burst(pose,count){
  const scale=Math.max(.7,Math.min(1.3,size.h/850));
  for(let i=0;i<count;i++){
    const angle=pose.heading+(Math.random()-.5)*1.1,speed=(9+Math.random()*10)*scale;
    particles.push({x:pose.end.x,y:pose.end.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,rot:Math.random()*6.3,vr:(Math.random()-.5)*.35,
      w:6+Math.random()*7,h:3+Math.random()*5,color:colors[Math.floor(Math.random()*colors.length)],round:Math.random()<.25,wobble:Math.random()*6.3});
  }
}

function draw(now){
  const t=now-start,{w,h,dpr}=size,mobile=w<640;
  for(const side of ['left','right']){
    const pose=armPose(side,reducedMotion.matches?2000:t),g=svg.querySelector(`.celebrate-arm.${side}`);
    g.querySelector('.arm-edge').setAttribute('d',pose.d);g.querySelector('.arm-rubber').setAttribute('d',pose.d);
    g.querySelector('.arm-edge').setAttribute('stroke-width',mobile?16:20);g.querySelector('.arm-rubber').setAttribute('stroke-width',mobile?14:18);
    g.querySelector('.arm-hand').setAttribute('transform',`translate(${pose.end.x} ${pose.end.y}) rotate(${pose.angle}) scale(${mobile?.85:1.1})`);
    if(!reducedMotion.matches&&!leaving){
      if(t>=900&&!bursts.has(side+1)){bursts.add(side+1);burst(pose,mobile?70:110);}
      if(t>=1550&&!bursts.has(side+2)){bursts.add(side+2);burst(pose,mobile?40:65);}
    }
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  particles=particles.filter(p=>p.y<h+40&&p.x>-40&&p.x<w+40);
  for(const p of particles){
    p.vy+=.32;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;p.wobble+=.12;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.scale(1,Math.cos(p.wobble));ctx.fillStyle=p.color;
    if(p.round){ctx.beginPath();ctx.arc(0,0,p.h*.7,0,6.3);ctx.fill();}else ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
    ctx.restore();
  }
  if(leaving&&t-leaving>360){finish();return;}
  frame=reducedMotion.matches&&!leaving?0:requestAnimationFrame(draw);
}

function close(){
  if(!dialog?.open||leaving)return;
  if(reducedMotion.matches){finish();return;}
  leaving=performance.now()-start;dialog.dataset.leaving='true';
}
function finish(){
  cancelAnimationFrame(frame);frame=0;particles=[];leaving=0;delete dialog.dataset.leaving;dialog.close();
}

// app: {name}. status: what happened with the link, shown under the title.
function celebrate(app,status=''){
  if(!dialog)build();
  if(dialog.open)finish();
  dialog.querySelector('#celebrate-title').innerHTML=`Enjoy <em>${esc(app?.name||'your app')}.</em>`;
  dialog.querySelector('.celebrate-status').innerHTML=status;
  particles=[];bursts=new Set();leaving=0;
  dialog.showModal();resize();
  dialog.querySelector('[data-celebrate-close]').focus({preventScroll:true});
  start=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);
}
window.OnbunCelebrate=celebrate;
})();
