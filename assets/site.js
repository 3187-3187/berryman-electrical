(()=>{
 const toggle=document.querySelector('.mobileNavToggle');
 const drawer=document.querySelector('.mobileDrawer');
 if(toggle&&drawer){
   const close=()=>{drawer.classList.remove('open');toggle.setAttribute('aria-expanded','false');};
   toggle.addEventListener('click',()=>{const open=!drawer.classList.contains('open');drawer.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));});
   drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
   document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 }
 document.querySelectorAll('form[data-email-enquiry]').forEach(f=>f.addEventListener('submit',e=>{
   e.preventDefault();
   if(!f.reportValidity()) return;
   const fd=new FormData(f);
   const job=fd.get('job_type')||'Electrical enquiry';
   const suburb=fd.get('suburb')||'';
   const name=fd.get('name')||'';
   const contact=fd.get('contact')||'';
   const details=fd.get('job_details')||'';
   const photoInput=f.querySelector('input[type="file"]');
   const photoCount=photoInput&&photoInput.files ? photoInput.files.length : 0;
   const subject=`Berryman Electrical enquiry - ${job}${suburb ? ' - '+suburb : ''}`;
   const body=[
     `Name: ${name}`,
     `Phone or email: ${contact}`,
     `Suburb: ${suburb}`,
     `Type of work: ${job}`,
     '',
     'Job details:',
     details,
     '',
     photoCount ? `I have ${photoCount} photo${photoCount===1?'':'s'} to attach to this email.` : 'No photos selected.'
   ].join('
');
   const s=f.querySelector('.success');
   if(s){s.hidden=false;s.style.display='block';}
   window.location.href='mailto:info@berrymanelectrical.com.au?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
 }));
})();
