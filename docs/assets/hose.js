// Native, monochrome SVG limbs. Geometry uses the rendered size, never a bitmap.
(()=>{
'use strict';
const rubber='#101013',edge='#a5a5ae',white='#ededee',ink='#101013';
const path=(d,width=15)=>`<path d="${d}" fill="none" stroke="${edge}" stroke-width="${width+2}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${rubber}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const glove=(x,y,angle=0,scale=1)=>`<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" fill="${white}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M-15 15c-8-2-15-12-14-19 1-6 8-6 11 0l-2-20c-1-8 8-9 10-2l4 16-1-24c0-8 9-8 10-1l2 23 4-17c2-7 10-5 9 2l-2 22c4-4 10-4 13 0 5 8-3 17-12 23Z"/><path d="m-8 7 3-10M3 5 4-6M14 4l3-9" fill="none" stroke-width="1.8"/><path d="M-15 14 17 17 15 27-17 24Z"/></g>`;
const shoe=(x,y,angle=0)=>`<g transform="translate(${x} ${y}) rotate(${angle})" fill="${rubber}" stroke="${edge}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M-12-15h23l5 14c23-5 36 3 34 15-1 11-53 14-69 6-7-4-3-18 4-23Z"/><path d="M-19 17c22 7 46 4 68-3" fill="none" stroke="${white}" stroke-width="2.8"/><path d="M22 3q14-3 20 3" fill="none" stroke="${white}" stroke-width="2.5"/></g>`;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=value=>Math.max(0,Math.min(1,value));
function separatorProgress(el){
 if(reducedMotion.matches)return .5;
 const rect=el.getBoundingClientRect();
 return clamp((innerHeight-rect.top)/(innerHeight+rect.height));
}
function separatorGeometry(type,width,height,progress){
 const extension=clamp((progress-.10)/.45);
 const eased=extension*extension*(3-2*extension);
 // Start near the edge and visibly stretch to four-fifths by the viewport center.
 const reach=width*(.18+.64*eased),end=reach-(type==='leg'?36:50);
 const cy=height*.5-Math.sin((progress-.5)*Math.PI)*5;
 const count=Math.max(1,Math.round(width*.55/350)),segments=count*10;
 const amplitude=Math.min(31,height*.21,(end+70)/(count*8))*(.7+.3*Math.sin(progress*Math.PI));
 const points=Array.from({length:segments+1},(_,i)=>{
   const u=i/segments,envelope=Math.sin(u*Math.PI)**2;
   return {x:-70+(end+70)*u,y:cy+Math.sin(u*Math.PI*2*count-progress*Math.PI*.8)*amplitude*envelope};
 });
 let d=`M${points[0].x} ${points[0].y}`;
 for(let i=0;i<points.length-1;i++){
   const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
   d+=`C${p1.x+(p2.x-p0.x)/6} ${p1.y+(p2.y-p0.y)/6} ${p2.x-(p3.x-p1.x)/6} ${p2.y-(p3.y-p1.y)/6} ${p2.x} ${p2.y}`;
 }
 const tilt=Math.sin(progress*Math.PI*1.3)*5;
 const tip=type==='leg'?`translate(${end+12} ${cy}) rotate(${-90+tilt})`:`translate(${end+23} ${cy-2}) rotate(${90+tilt}) scale(.78)`;
 return {d,tip};
}
function illustration(type,width=360,height=180,separator=false,progress=.5){
 const categories={audio:'audio',desktop:'desktop',social:'social',together:'social',tools:'tools'};
 const category=type.startsWith('category-')?type.slice(9):categories[type];
 if(!separator&&['audio','desktop','social','tools'].includes(category))return `<svg xmlns="http://www.w3.org/2000/svg" class="hose-svg category-svg" viewBox="0 0 360 240" fill="none" aria-hidden="true"><use href="assets/art/category-${category}.svg#artwork"/></svg>`;
 let inside='',view=`0 0 ${width} ${height}`;
 if(separator){
   const geometry=separatorGeometry(type,width,height,progress);
   inside=`<g class="separator-limb">${path(geometry.d,16)}</g><g class="separator-tip" transform="${geometry.tip}">${type==='leg'?shoe(0,0):glove(0,0)}</g>`;
 }else{
   view='0 0 360 180';
   if(['phone','tools','ashinaga'].includes(type)){
     inside=path('M90-35C52 25 152 56 106 105',13)+path('M200-35C248 25 157 57 205 105',13)+`<g transform="translate(106 110) scale(-.8 .8)">${shoe(0,0)}</g><g transform="translate(205 110) scale(.8)">${shoe(0,0)}</g>`;
   }else if(['together','friends'].includes(type)){
     inside=path('M-35 105C65 140 74 41 142 73',13)+path('M395 105C295 140 286 41 218 73',13)+glove(155,70,90,.72)+glove(205,70,-90,.72);
   }else{
     inside=path('M-35 120C68 165 75 40 157 75S239 142 278 68',14)+glove(282,48,12,.78);
   }
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" class="hose-svg" viewBox="${view}" fill="none" aria-hidden="true" shape-rendering="geometricPrecision">${inside}</svg>`;
}
const tracked=new Set(),separators=new Set(),visible=new Set();
let scrollFrame=0;
function animateSeparator(el){
 if(!el.isConnected)return;
 const progress=separatorProgress(el),geometry=separatorGeometry(el.dataset.hose,el.clientWidth,el.clientHeight,progress);
 el.querySelectorAll('.separator-limb path').forEach(part=>part.setAttribute('d',geometry.d));
 el.querySelector('.separator-tip')?.setAttribute('transform',geometry.tip);
 el.dataset.scrollProgress=progress.toFixed(4);el.dataset.motion=reducedMotion.matches?'still':'scroll';
}
function requestScrollFrame(){
 if(scrollFrame||reducedMotion.matches||!visible.size)return;
 scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;visible.forEach(animateSeparator);});
}
const visibility=new IntersectionObserver(entries=>{
 for(const {target,isIntersecting} of entries){
  if(isIntersecting){visible.add(target);animateSeparator(target);}else visible.delete(target);
 }
},{rootMargin:'100px 0px'});
function draw(el){
 const separator=el.classList.contains('hose-separator'),w=separator?el.clientWidth:360,h=separator?el.clientHeight:180;
 if(!w||!h)return;
 const signature=[el.dataset.hose,w,h,separator].join('|');
 if(signature===el.dataset.geometry)return;
 el.innerHTML=illustration(el.dataset.hose,w,h,separator,separator?separatorProgress(el):.5);el.dataset.geometry=signature;el.dataset.ready='true';
 if(separator)animateSeparator(el);
}
const resize=new ResizeObserver(entries=>entries.forEach(({target})=>draw(target)));
function refresh(root=document){
 for(const el of tracked)if(!el.isConnected){resize.unobserve(el);visibility.unobserve(el);tracked.delete(el);separators.delete(el);visible.delete(el);}
 const elements=[...(root.matches?.('[data-hose]')?[root]:[]),...root.querySelectorAll('[data-hose]')];
 elements.forEach(el=>{
  draw(el);
  if(!tracked.has(el)){
   tracked.add(el);
   if(el.classList.contains('hose-separator')){separators.add(el);resize.observe(el);visibility.observe(el);}
  }
 });
}
addEventListener('scroll',requestScrollFrame,{passive:true});
addEventListener('resize',requestScrollFrame);
reducedMotion.addEventListener('change',()=>{
 cancelAnimationFrame(scrollFrame);scrollFrame=0;separators.forEach(animateSeparator);
});
window.OnbunArt={illustration,refresh,glove,shoe};refresh();
})();
