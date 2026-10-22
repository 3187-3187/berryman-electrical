const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const base = 'http://127.0.0.1:8765';
const targets = [
 ['underground-power-submains','/services/underground-power-submains/'],
 ['commercial-electrical-maintenance','/services/commercial-electrical-maintenance/'],
 ['smoke-alarm-installation','/services/smoke-alarm-installation/'],
 ['hot-water-electrical-repairs','/services/hot-water-electrical-repairs/'],
 ['services-hub','/services/']
];
const views=[['mobile',390,844],['tablet',768,1024],['desktop',1440,900]];
const output='qa-output/seo-batch1';
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 let failed=0;
 const results=[];
 for(const [name,url] of targets){
  for(const [view,width,height] of views){
   const context=await browser.newContext({viewport:{width,height}});
   const page=await context.newPage();
   const problems=[];
   page.on('pageerror',err=>problems.push('JavaScript: '+err.message));
   const res=await page.goto(base+url,{waitUntil:'networkidle',timeout:30000});
   if(res.status()!==200)problems.push('HTTP '+res.status());
   // Images below the fold use loading=lazy; request and decode them before testing integrity.
   await page.evaluate(async()=>{
     const imgs=[...document.images];
     for(const img of imgs) img.loading='eager';
     await Promise.all(imgs.map(img=>img.decode().catch(()=>{})));
   });
   const info=await page.evaluate(()=>{
    const main=document.querySelector('main');
    const canonical=document.querySelector('link[rel=canonical]')?.href||'';
    const q=[...document.querySelectorAll('main .staticFaq details')].map(el=>({
      name:el.querySelector('summary')?.textContent?.trim(),
      text:el.querySelector('p')?.textContent?.trim()
    }));
    const schemas=[...document.querySelectorAll('script[type="application/ld+json"]')].map(el=>{try{return JSON.parse(el.textContent)}catch{return null}});
    const faq=schemas.find(x=>x?.['@type']==='FAQPage');
    return {title:document.title,description:document.querySelector('meta[name=description]')?.content||'',
      canonical,mainH1s:main?.querySelectorAll('h1').length||0,
      scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,
      hasVisibleCTA:[...document.querySelectorAll('main a[href^="tel:"],main a[href*="/contact/"]')].some(a=>a.getBoundingClientRect().width>0),
      faqCount:q.length,faqMatches:faq?faq.mainEntity?.length===q.length&&faq.mainEntity.every((x,i)=>x.name===q[i].name&&x.acceptedAnswer.text===q[i].text):null,
      imgs:[...document.querySelectorAll('img')].map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0}))
    };
   });
   if(info.mainH1s!==1)problems.push('Expected one H1');
   if(info.scrollWidth>width+4)problems.push('Horizontal overflow');
   if(!info.hasVisibleCTA)problems.push('Missing visible CTA');
   if(!info.canonical.startsWith('https://www.berrymanelectrical.com.au/'))problems.push('Unexpected canonical');
   if(!info.title)problems.push('Missing title');
   if(name!=='services-hub' && (info.description.length<90 || info.description.length>170))problems.push('Description length');
   if(name!=='services-hub' && (info.faqCount!==5 || info.faqMatches!==true))problems.push('FAQ schema mismatch');
   for(const img of info.imgs)if(!img.loaded)problems.push('Image failed: '+img.src);
   if(view==='desktop'&&!(await page.locator('header .navlinks').isVisible()))problems.push('Desktop nav not visible');
   if(view==='mobile'){
     const toggle=page.locator('.mobileNavToggle');
     if(await toggle.count()){
       await toggle.click();
       if(!(await page.locator('.mobileDrawer').isVisible()))problems.push('Mobile menu did not open');
       await toggle.click();
     }
   }
   await page.screenshot({path:path.join(output,name+'-'+view+'.png'),fullPage:true});
   const pass=problems.length===0;
   if(!pass)failed++;
   results.push({name,view,url,pass,problems,...info});
   await context.close();
  }
 }
 await browser.close();
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({failed,results},null,2));
 console.log(JSON.stringify({screenshots:results.length,failed,cases:results.map(x=>({name:x.name,view:x.view,pass:x.pass,problems:x.problems}))},null,2));
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
