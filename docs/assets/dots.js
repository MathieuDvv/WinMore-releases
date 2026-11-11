// Halftone artwork. Each <canvas data-dots="name"> is drawn at a coarse grid (one cell per dot),
// then every cell becomes a dot, or a square with data-shape="square", sized by its brightness.
// Arts either draw on that grid (draw) or give a brightness for any point (field, can animate).
(()=>{
const TAU=Math.PI*2;
const GHOST=new Path2D('M4 11.2a8 8 0 0 1 16 0v7c-1.34 0-1.34-1.25-2.67-1.25s-1.33 1.25-2.66 1.25-1.34-1.25-2.67-1.25-1.33 1.25-2.67 1.25-1.33-1.25-2.66-1.25S5.34 18.2 4 18.2z');
const shade=(o,x0,y0,x1,y1,a,b)=>{const g=o.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(1,`rgba(255,255,255,${b})`);return g;};
const box=(o,x,y,w,h,r)=>{o.beginPath();o.roundRect(x,y,w,h,r);};

const ARTS={
  // Three sound waves drifting across, brightest where they cross.
  waves:{animate:true,field(x,y,w,h,t){
    let v=0;
    for(let i=0;i<3;i++){
      const line=h*(.58+.16*Math.sin(x/w*TAU*(1.1+i*.35)+t*(.35+i*.12)+i*2)+.06*Math.sin(x/w*TAU*4.2-t*.8+i));
      const d=(y-line)/(h*(.05+i*.025));
      v+=Math.exp(-d*d)*(1-i*.22);
    }
    const edge=Math.min(1,x/(w*.18),(w-x)/(w*.18));
    return Math.min(1,v)*edge*Math.min(1,y/(h*.35));
  }},
  // A sphere lit from the top left, rising from the bottom.
  planet:{field(x,y,w,h){
    const r=w*.62,cx=w*.62,cy=h+r*.42,dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);
    if(d>r)return 0;
    const z=Math.sqrt(1-(d/r)**2),light=(-dx/r*.45-dy/r*.75+z*.5);
    return Math.max(0,Math.min(1,light))*(.35+.65*(1-d/r)**.2);
  }},
  pc:{draw(o,w,h){
    const sw=w*.62,sh=sw*.6,x=(w-sw)/2,y=h*.12;
    box(o,x,y,sw,sh,6);o.fillStyle=shade(o,x,y,x+sw,y+sh,.95,.22);o.fill();
    o.fillStyle='#fff';o.fillRect(w/2-4,y+sh,8,h*.1);o.fillRect(w/2-sw*.16,y+sh+h*.1,sw*.32,5);
    o.globalCompositeOperation='destination-out';box(o,w/2-sw*.17,y+7,sw*.34,sh*.13,99);o.fill();
    o.globalCompositeOperation='source-over';o.fillStyle='rgba(255,255,255,.35)';box(o,w/2-sw*.17,y+7,sw*.34,sh*.13,99);o.fill();
  }},
  phone:{draw(o,w,h){
    const pw=w*.66,ph=pw*.46,x=(w-pw)/2,y=(h-ph)/2;
    box(o,x,y,pw,ph,ph*.2);o.fillStyle='rgba(255,255,255,.95)';o.fill();
    o.globalCompositeOperation='destination-out';box(o,x+ph*.12,y+ph*.12,pw-ph*.24,ph*.76,ph*.12);o.fill();
    o.globalCompositeOperation='source-over';
    const cw=(pw-ph*.24-ph*.2-18)/3;
    for(let i=0;i<3;i++){const cx=x+ph*.22+i*(cw+9);box(o,cx,y+ph*.22,cw,ph*.56,4);o.fillStyle=shade(o,cx,y+ph*.22,cx,y+ph*.78,.8-i*.2,.15);o.fill();}
  }},
  apps:{draw(o,w,h){
    const s=Math.min(w,h)*.3,g=s*.22,x=(w-2*s-g)/2,y=(h-2*s-g)/2;
    [[.95,.4],[.55,.15],[.3,.08],[.8,.3]].forEach(([a,b],i)=>{const cx=x+(i%2)*(s+g),cy=y+(i>1)*(s+g);box(o,cx,cy,s,s,s*.24);o.fillStyle=shade(o,cx,cy,cx+s,cy+s,a,b);o.fill();});
  }},
  ghost:{draw(o,w,h){
    const k=Math.min(w,h)/17;o.save();o.translate(w/2-12*k,h/2-14.5*k);o.scale(k,k);
    o.fillStyle=shade(o,4,4,20,18,1,.45);o.fill(GHOST);
    o.globalCompositeOperation='destination-out';o.fillRect(7.6,11.3,2.6,1.5);o.fillRect(13.8,11.3,2.6,1.5);o.restore();
  }},
};

const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const items=[...document.querySelectorAll('canvas[data-dots]')].map(canvas=>({canvas,art:ARTS[canvas.dataset.dots],grid:document.createElement('canvas'),visible:true})).filter(item=>item.art);

function paint(item,t){
  const {canvas,art,grid}=item,step=+canvas.dataset.step||7,square=canvas.dataset.shape==='square';
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
  const dpr=Math.min(2,devicePixelRatio||1);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const cols=Math.ceil(w/step),rows=Math.ceil(h/step);
  const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  g.fillStyle=canvas.dataset.color||getComputedStyle(canvas).color;
  let value;
  if(art.field)value=(c,r)=>art.field((c+.5)*step,(r+.5)*step,w,h,t);
  else{
    grid.width=cols;grid.height=rows;
    const o=grid.getContext('2d',{willReadFrequently:true});o.clearRect(0,0,cols,rows);o.save();o.scale(cols/w,rows/h);art.draw(o,w,h);o.restore();
    const data=o.getImageData(0,0,cols,rows).data;value=(c,r)=>data[(r*cols+c)*4+3]/255;
  }
  g.beginPath();
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const v=value(c,r);if(v<.04)continue;
    const x=(c+.5)*step,y=(r+.5)*step;
    if(square){const s=step*.82*Math.sqrt(v);g.rect(x-s/2,y-s/2,s,s);}
    else{const s=step*.48*Math.sqrt(v);g.moveTo(x+s,y);g.arc(x,y,s,0,TAU);}
  }
  g.fill();
}

const drawAll=()=>items.forEach(item=>paint(item,0));
drawAll();
addEventListener('resize',drawAll);
if('IntersectionObserver' in window){
  const seen=new IntersectionObserver(entries=>entries.forEach(e=>{const item=items.find(i=>i.canvas===e.target);if(item)item.visible=e.isIntersecting;}));
  items.forEach(item=>seen.observe(item.canvas));
}
const moving=items.filter(item=>item.art.animate);
if(moving.length){
  const frame=now=>{if(!reduce.matches&&!document.hidden)moving.forEach(item=>item.visible&&paint(item,now/1000));requestAnimationFrame(frame);};
  requestAnimationFrame(frame);
}
})();
