(()=>{
 const toggle=document.querySelector('.mobileNavToggle');
 const drawer=document.querySelector('.mobileDrawer');
 if(toggle&&drawer){
   const close=()=>{drawer.classList.remove('open');toggle.setAttribute('aria-expanded','false');};
   toggle.addEventListener('click',()=>{const open=!drawer.classList.contains('open');drawer.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));});
   drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
   document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 }
 document.querySelectorAll('form[data-preview]').forEach(f=>f.addEventListener('submit',e=>{
   e.preventDefault(); const s=f.querySelector('.success'); if(s){s.hidden=false;s.style.display='block';}
 }));
})();
