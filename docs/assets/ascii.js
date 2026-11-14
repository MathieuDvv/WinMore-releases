// Store artwork: local sculptures become real characters, then move in a gentle wave.
(()=>{
'use strict';
const sources={reach:'assets/art/reach-source.png',apollo:'assets/art/apollo-source.png',athena:'assets/art/athena-source.png',hermes:'assets/art/hermes-source.png',victory:'assets/art/victory-source.png',ascend:'assets/art/ascend-source.png'};
const images=new Map(),items=new Map(),reduce=matchMedia('(prefers-reduced-motion: reduce)');
const ramp=' .,:;i1tfLCG08@',TAU=Math.PI*2;
let frameId=0,lastFrame=0;

function source(name){
  if(!images.has(name))images.set(name,new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);
    image.onerror=()=>{images.delete(name);reject(new Error('Artwork unavailable'));};
    image.src=sources[name]||sources.apollo;
  }));
  return images.get(name);
}
function moving(item){
  return item.texture&&item.visible&&item.canvas.isConnected&&(item.canvas.dataset.motion==='wave'||item.canvas.dataset.motion==='hover'&&item.hover);
}
function schedule(){
  if(!frameId&&!reduce.matches&&!document.hidden&&[...items.values()].some(moving))frameId=requestAnimationFrame(frame);
}
function frame(now){
  frameId=0;
  if(reduce.matches){for(const item of items.values())paint(item);return;}
  if(document.hidden)return;
  // Textures are cached; animation only shifts their columns, at most 24 times a second.
  if(now-lastFrame>=1000/24){
    for(const item of items.values())if(moving(item))paint(item,now/1000,true);
    lastFrame=now;
  }
  schedule();
}
function paint(item,time=0,animate=false){
  if(!item.texture||!item.canvas.isConnected)return;
  const {canvas,texture,width,height,dpr,cell,phase}=item;
  time*=Number(canvas.dataset.speed)||1;
  const out=canvas.getContext('2d');
  out.setTransform(dpr,0,0,dpr,0,0);out.globalCompositeOperation='source-over';out.clearRect(0,0,width,height);
  if(item.aura)out.drawImage(item.aura,0,0,width,height);
  if(!animate)out.drawImage(texture,0,0,width,height);
  else{
    const amplitude=canvas.dataset.ascii==='reach'?5.5:2.2;
    for(let x=0;x<width;x+=cell){
      const slice=Math.min(cell,width-x),position=x/width;
      const wave=(Math.sin(position*TAU*1.6-time*.85+phase)+.28*Math.sin(position*TAU*3.1+time*.5))*amplitude*Math.sin(position*Math.PI);
      out.drawImage(texture,x*dpr,0,slice*dpr,texture.height,x,wave,slice,height);
    }
    // A soft band of light travels through the glyphs, like the landing page's wave.
    const center=((time*.075+phase*.11)%1.5-.25)*width,span=width*.3;
    const light=out.createLinearGradient(center-span,0,center+span,height*.1);
    light.addColorStop(0,'#7088ff00');light.addColorStop(.4,'#7088ff08');light.addColorStop(.5,'#e5ebff38');light.addColorStop(.6,'#7088ff08');light.addColorStop(1,'#7088ff00');
    out.globalCompositeOperation='source-atop';out.fillStyle=light;out.fillRect(0,0,width,height);out.globalCompositeOperation='source-over';
  }
  if(canvas.dataset.atmosphere==='true'){
    out.font='9px "Cascadia Code",Consolas,monospace';out.fillStyle='#a4b5ff';
    // Sparse, slow rising characters, fixed in place when reduced motion is enabled.
    for(let i=0;i<32;i++){
      const seed=Math.sin((i+1)*127.1+phase)*43758.5453,x=(seed-Math.floor(seed))*width;
      const base=Math.sin((i+1)*311.7)*13758.14,y=((base-Math.floor(base)-time*(.006+i%3*.002))%1+1)%1;
      out.globalAlpha=(.12+.12*Math.sin(time*.6+i)**2)*Math.sin(y*Math.PI);
      out.fillText(i%7===0?'+':'.',x,y*height);
    }
    out.globalAlpha=1;
  }
  canvas.dataset.animating=String(animate);
}

const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
  for(const {target,isIntersecting} of entries){const item=items.get(target);if(item)item.visible=isIntersecting;}
  schedule();
}):null;
const resize='ResizeObserver' in window?new ResizeObserver(entries=>entries.forEach(({target})=>draw(target))):null;
function register(canvas){
  if(items.has(canvas))return items.get(canvas);
  const rect=canvas.getBoundingClientRect();
  const item={canvas,visible:rect.bottom>0&&rect.top<innerHeight,hover:false,revision:0,phase:items.size*.8,dispose:()=>{}};
  items.set(canvas,item);observer?.observe(canvas);resize?.observe(canvas);
  if(canvas.dataset.motion==='hover'){
    const host=canvas.closest('.store-app')||canvas.parentElement;
    const enter=()=>{item.hover=true;schedule();};
    const leave=()=>{item.hover=false;paint(item);};
    const blur=event=>{if(!host.contains(event.relatedTarget))leave();};
    host.addEventListener('pointerenter',enter);host.addEventListener('pointerleave',leave);host.addEventListener('focusin',enter);host.addEventListener('focusout',blur);
    item.dispose=()=>{host.removeEventListener('pointerenter',enter);host.removeEventListener('pointerleave',leave);host.removeEventListener('focusin',enter);host.removeEventListener('focusout',blur);};
  }
  return item;
}
async function draw(canvas){
  if(!canvas.isConnected)return;
  const item=register(canvas),revision=++item.revision;
  const image=await source(canvas.dataset.ascii).catch(()=>null);
  if(!image||!canvas.isConnected||revision!==item.revision)return;
  const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
  const font=Number(canvas.dataset.cell)||8,cell=font*.61,line=font*1.05,dpr=Math.min(devicePixelRatio||1,2);
  const signature=[width,height,dpr,canvas.dataset.ascii,font,canvas.dataset.ink,canvas.dataset.fit,canvas.dataset.x,canvas.dataset.y,canvas.dataset.atmosphere].join('|');
  if(signature===item.signature){paint(item,performance.now()/1000,!reduce.matches&&moving(item));schedule();return;}
  const cols=Math.ceil(width/cell),rows=Math.ceil(height/line);
  const sample=document.createElement('canvas');sample.width=cols;sample.height=rows;
  const ctx=sample.getContext('2d',{willReadFrequently:true});
  const fit=canvas.dataset.fit||(canvas.dataset.ascii==='reach'?'contain':'cover');
  const scale=fit==='width'?width/image.width:(fit==='contain'?Math.min:Math.max)(width/image.width,height/image.height);
  const iw=image.width*scale,ih=image.height*scale,px=Number(canvas.dataset.x??.5),py=Number(canvas.dataset.y??.5);
  ctx.drawImage(image,(width-iw)*px/width*cols,(height-ih)*py/height*rows,iw/width*cols,ih/height*rows);
  const data=ctx.getImageData(0,0,cols,rows).data;
  const texture=document.createElement('canvas');texture.width=Math.round(width*dpr);texture.height=Math.round(height*dpr);
  const ink=texture.getContext('2d');ink.setTransform(dpr,0,0,dpr,0,0);ink.font=`${font}px "Cascadia Code",Consolas,monospace`;ink.textBaseline='top';
  const paper=canvas.dataset.ink==='blue',mono=canvas.dataset.ink==='white';
  const colors=paper?['#283be2','#2538dc','#2335d5','#2233d0']:mono?['#48547e','#7688bb','#bac6e8','#f4f5ff']:['#2333a0','#3b50e4','#8396ff','#edf0ff'];
  for(let tone=0;tone<4;tone++){
    ink.fillStyle=colors[tone];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const i=(y*cols+x)*4;
      let light=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255*(data[i+3]/255);if(light<.045)continue;
      light=Math.min(1,Math.pow(light,.8));if(Math.min(3,Math.floor(light*4))!==tone)continue;
      const character=ramp[Math.min(ramp.length-1,Math.max(1,Math.floor(light*(ramp.length-1))))];ink.fillText(character,x*cell,y*line);
    }
  }
  canvas.width=texture.width;canvas.height=texture.height;
  let aura=null;
  if(canvas.dataset.atmosphere==='true'){
    aura=document.createElement('canvas');aura.width=Math.max(1,Math.round(width/3));aura.height=Math.max(1,Math.round(height/3));
    const glow=aura.getContext('2d');glow.filter='blur(5px)';glow.drawImage(texture,0,0,aura.width,aura.height);glow.filter='none';
    glow.globalCompositeOperation='source-in';glow.globalAlpha=.28;glow.fillStyle='#677aff';glow.fillRect(0,0,aura.width,aura.height);
  }
  Object.assign(item,{texture,aura,width,height,dpr,cell,signature});
  paint(item,performance.now()/1000,!reduce.matches&&moving(item));canvas.dataset.ready='true';schedule();
}
function refresh(root=document){
  for(const [canvas,item] of items)if(!canvas.isConnected){observer?.unobserve(canvas);resize?.unobserve(canvas);item.dispose();items.delete(canvas);}
  root.querySelectorAll('canvas[data-ascii]').forEach(canvas=>{if(!items.has(canvas)){register(canvas);draw(canvas);}});
}
function motionChanged(){
  cancelAnimationFrame(frameId);frameId=0;
  for(const item of items.values())paint(item);
  schedule();
}
reduce.addEventListener('change',motionChanged);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frameId);frameId=0;}else schedule();});
if(!resize)addEventListener('resize',()=>items.forEach(item=>draw(item.canvas)));
window.WinMoreASCII={refresh,draw};refresh();
})();
