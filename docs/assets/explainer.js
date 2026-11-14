// Both screens show one app running on the desktop; the phone sends its controls.
(()=>{
  const demo=document.querySelector('.control-demo');
  if(!demo)return;
  const play=demo.querySelector('.demo-play'),motion=demo.querySelector('.demo-motion');
  play.addEventListener('click',()=>{
    const playing=demo.dataset.playing!=='true';
    demo.dataset.playing=String(playing);
    play.setAttribute('aria-label',`${playing?'Pause':'Play'} music demo`);
    demo.querySelector('.demo-state').textContent=`${playing?'Playing':'Paused'} on your desktop`;
  });
  motion.addEventListener('click',()=>{
    const paused=demo.dataset.motion!=='paused';
    demo.dataset.motion=paused?'paused':'running';
    motion.setAttribute('aria-pressed',String(paused));
    motion.innerHTML=`${paused?'Play':'Pause'} animation <span aria-hidden="true">${paused?'▷':'Ⅱ'}</span>`;
  });
  // Animate only while the example is visible. Reduced motion is handled in CSS.
  new IntersectionObserver(entries=>{
    demo.dataset.visible=String(entries[0].isIntersecting);
  },{threshold:.1}).observe(demo);
})();
