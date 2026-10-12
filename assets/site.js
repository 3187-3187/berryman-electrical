(()=>{
 const toggle=document.querySelector('.mobileNavToggle');
 const drawer=document.querySelector('.mobileDrawer');
 if(toggle&&drawer){
   const close=()=>{drawer.classList.remove('open');toggle.setAttribute('aria-expanded','false');};
   toggle.addEventListener('click',()=>{const open=!drawer.classList.contains('open');drawer.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));});
   drawer.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
   document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 }
 const enquiry=document.querySelector('form[data-email-enquiry]');
 if(enquiry){
   const types={
     residential:'Residential electrical work',
     fault:'Fault finding / repair',
     switchboard:'Switchboard assessment',
     lighting:'Lighting / power / fans',
     commercial:'Commercial electrical work',
     industrial:'Industrial electrical work',
     ev:'EV charger installation',
     renovation:'Renovation / electrical upgrade',
     planned:'Other planned electrical work'
   };
   const selected=new URLSearchParams(window.location.search).get('service');
   const typeSelect=enquiry.querySelector('select[name="job_type"]');
   if(selected&&types[selected]&&typeSelect)typeSelect.value=types[selected];
   // The Byron Bay location-page CTA can carry a non-sensitive suburb hint.
   const suburb=new URLSearchParams(window.location.search).get('suburb');
   const suburbInput=enquiry.querySelector('input[name="suburb"]');
   if(suburbInput && suburb && !suburbInput.value && suburb.length<=100 && /^[\p{L}\p{N}\s,.'-]+$/u.test(suburb)){
     suburbInput.value=suburb;
   }
   enquiry.addEventListener('submit',e=>{
     e.preventDefault();
     // The approved online experience never launches a mail client on Enter.
     if(window.BERRYMAN_ENQUIRY?.enabled===true && enquiry.querySelector('[data-online-enquiry]:not([hidden])')){
       if(!enquiry.reportValidity())return;
       const onlineButton=enquiry.querySelector('[data-online-send]');
       if(onlineButton && !onlineButton.disabled)onlineButton.click();
       return;
     }
     if(!enquiry.reportValidity())return;
     const fd=new FormData(enquiry);
     const get=k=>String(fd.get(k)||'').trim();
     const job=get('job_type');
     const suburb=get('suburb');
     const name=get('name');
     const contact=get('contact');
     const details=get('job_details');
     const subject='Berryman Electrical enquiry - '+job+(suburb?' - '+suburb:'');
     const body=[
       'Name: '+name,
       'Phone or email: '+contact,
       'Suburb: '+suburb,
       'Type of work: '+job,
       '',
       'Job details:',
       details,
       '',
       'Photos may be attached manually before sending.',
       '',
       'Please contact me to discuss availability and the next steps.'
     ].join('\n');
     const note=enquiry.querySelector('.success');
     if(note){note.hidden=false;note.style.display='block';}
     // mailto starts a draft only; it does not submit the enquiry or attach files.
     window.location.href='mailto:info@berrymanelectrical.com.au?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
   });
 }
})();
