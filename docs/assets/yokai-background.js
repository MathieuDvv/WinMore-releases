// Historical sculpture cutouts rendered as real, DPR-aware ASCII glyphs.
// The foreground limbs remain native SVG; these quiet backgrounds render once per resize.
(()=>{
'use strict';
const sourceURL='assets/art/historical-sculptures-source.png';
const selections=fetch('assets/art/sculpture-masks.json').then(r=>r.json());
const images=new Map(),ramp=' .,:;irsXA253hMHGS#9B&@';
const backdrop=document.createElement('div');backdrop.className='yokai-backdrop';backdrop.setAttribute('aria-hidden','true');
backdrop.innerHTML='<canvas class="background-figure" data-yokai="ashinaga"></canvas><canvas class="background-figure" data-yokai="tenaga"></canvas>';
document.body.prepend(backdrop);
function source(name){
 if(!images.has(name))images.set(name,new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Historical artwork unavailable'));image.src=name==='print'?'assets/art/kuniyoshi-print-source.png':sourceURL;
 }));
 return images.get(name);
}
async function draw(canvas){
 if(!canvas.isConnected)return;
 const revision=(canvas.revision||0)+1;canvas.revision=revision;
 const [image,masks]=await Promise.all([source(canvas.dataset.yokai),selections]).catch(()=>[]);if(!image||!masks||revision!==canvas.revision||!canvas.isConnected)return;
 const selection=masks[canvas.dataset.yokai],crop=selection.crop;
 const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
 const font=Number(canvas.dataset.cell)||(canvas.dataset.yokai==='print'?(innerWidth<640?4.5:5):(innerWidth<640?6:7)),line=font*1.12,cell=font*.61,dpr=Math.min(devicePixelRatio||1,3);
 const cols=Math.ceil(width/cell),rows=Math.ceil(height/line);
 const sample=document.createElement('canvas');sample.width=cols;sample.height=rows;
 const ctx=sample.getContext('2d',{willReadFrequently:true});
 const scale=Math.min(width/crop[2],height/crop[3]),iw=crop[2]*scale,ih=crop[3]*scale;
 const sx=iw/width*cols/crop[2],sy=ih/height*rows/crop[3],tx=(width-iw)/2/width*cols-crop[0]*sx,ty=(height-ih)/2/height*rows-crop[1]*sy;
 ctx.save();ctx.setTransform(sx,0,0,sy,tx,ty);ctx.beginPath();
 for(const ring of [selection.outline,...(selection.holes||[])]){ring.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
 ctx.clip('evenodd');ctx.drawImage(image,0,0);ctx.restore();
 const pixels=ctx.getImageData(0,0,cols,rows).data;
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 const out=canvas.getContext('2d');out.setTransform(dpr,0,0,dpr,0,0);
 out.font=`${font}px "Cascadia Code",Consolas,monospace`;out.textBaseline='top';out.fillStyle='#dbdbe5';
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const i=(y*cols+x)*4,alpha=pixels[i+3]/255;if(alpha<.15)continue;
  const red=pixels[i],green=pixels[i+1],blue=pixels[i+2];
  const max=Math.max(red,green,blue),min=Math.min(red,green,blue);
  // The supplied photograph has a neutral wall and warm wooden sculptures.
  if(canvas.dataset.yokai!=='print'&&((max-min)/Math.max(1,max)<.14||red<blue*1.06))continue;
  const luminance=(red*.2126+green*.7152+blue*.0722)/255;
  const print=canvas.dataset.yokai==='print';
  // Preserve the original ink detail without turning the light paper/skin into a solid text block.
  const contrast=print?Math.pow(Math.max(0,Math.min(1,(.82-luminance)/.64)),1.7):luminance;
  if(print&&contrast<.04)continue;
  const value=(.16+contrast*.84)*alpha;
  out.globalAlpha=print?.2+contrast*.8:.35+contrast*.65;
  out.fillText(ramp[Math.max(1,Math.min(ramp.length-1,Math.floor(value*(ramp.length-1))))],x*cell,y*line);
 }
 out.globalAlpha=1;canvas.dataset.ready='true';canvas.dataset.renderScale=String(dpr);
}
const resize=new ResizeObserver(entries=>entries.forEach(({target})=>draw(target)));
const tracked=new Set();
function refresh(root=document){
 for(const canvas of tracked)if(!canvas.isConnected){resize.unobserve(canvas);tracked.delete(canvas);}
 const canvases=[...(root.matches?.('canvas[data-yokai]')?[root]:[]),...root.querySelectorAll('canvas[data-yokai]')];
 canvases.forEach(canvas=>{if(!tracked.has(canvas)){tracked.add(canvas);resize.observe(canvas);draw(canvas);}});
}
refresh();
if(document.body.dataset.page==='home'){
 backdrop.style.opacity='0';
 document.addEventListener('island',({detail})=>{const t=Math.max(0,Math.min(1,detail.progress/.55));backdrop.style.opacity=String(t*t*(3-2*t));});
}
window.OnbunBackground={draw,refresh};
})();
