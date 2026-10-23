/* Browser-only preview test. It intercepts all Turnstile and API traffic.
 * No real customer data and no email provider is contacted.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = 'http://127.0.0.1:8765';
const out = 'qa-output';
fs.mkdirSync(out, {recursive:true});
const report=[];
(async()=>{
 const browser = await chromium.launch({headless:true});
 for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:850}});
   page.setDefaultTimeout(9000);
   page.setDefaultNavigationTimeout(14000);
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route=>route.fulfill({
     status:200,contentType:'application/javascript',
     body:'window.turnstile={render:()=>1,reset:()=>{}};'
   }));
   await page.goto(ROOT+'/contact/?service=lighting',{waitUntil:'domcontentloaded',timeout:16000});
   const enabled=await page.evaluate(()=>window.BERRYMAN_ENQUIRY?.enabled===true);
   if(enabled){
     if(!(await page.locator('[data-online-enquiry]').isVisible()))errors.push('Online enquiry is hidden in preview');
     if(await page.locator('form button[type="submit"]').isVisible())errors.push('Draft submit should be hidden');
     if(!(await page.locator('form [data-online-send]').isVisible()))errors.push('Online button is missing');
     if(!(await page.locator('[data-online-attachments]').isVisible()))errors.push('Attachment picker is missing');
   }else{
     if(await page.locator('[data-online-enquiry]').isVisible())errors.push('Online service visible with disabled config');
     if(!(await page.locator('form button[type="submit"]').isVisible()))errors.push('Manual draft fallback not visible');
     if(await page.locator('form [data-online-send]').isVisible())errors.push('Inactive online-send button visible');
     if(await page.locator('[data-online-attachments]').isVisible())errors.push('Attachments visible without online delivery');
   }
   // The service-page CTA must carry context all the way to the form.
   await page.goto(ROOT+'/services/smoke-alarm-installation/',{waitUntil:'domcontentloaded'});
   const smokeCTA=page.locator('main a[href="../../contact/?service=smoke-alarm-installation"]');
   if(!(await smokeCTA.count()))errors.push('Smoke alarm CTA does not preserve service context');
   else{
     await smokeCTA.first().click();
     await page.waitForURL('**/contact/?service=smoke-alarm-installation');
     if(await page.locator('select[name="job_type"]').inputValue()!=='Smoke alarm certification & installation')
       errors.push('Smoke alarm service is not automatically selected');
     if(!(await page.locator('#job-type-context').isVisible()))
       errors.push('Selected service help text is missing');
   }
   await page.goto(ROOT+'/contact/',{waitUntil:'domcontentloaded'});
   if(await page.locator('select[name="job_type"]').inputValue()!=='Not sure / general enquiry')
     errors.push('Direct visitors should not have to choose a work type');
   if(await page.locator('select[name="job_type"] option').count()!==5)
     errors.push('Direct visitors see too many category choices');
   await page.goto(ROOT+'/contact/?service=data-communications-cabling',{waitUntil:'domcontentloaded'});
   if(await page.locator('select[name="job_type"]').inputValue()!=='Data & communications cabling')
     errors.push('Data cabling context not recognised');
   await page.goto(ROOT+'/contact/?service=invalid-value',{waitUntil:'domcontentloaded'});
   if(await page.locator('select[name="job_type"]').inputValue()!=='Not sure / general enquiry')
     errors.push('Unexpected URL context should never be accepted');
   report.push({case:'configured preview state and service prefills / '+width,errors:[...errors]});
   if(errors.length)throw Error(report[report.length-1].case+': '+errors.join(' | '));
   await page.close();
 }
 for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:850}});
   page.setDefaultTimeout(9000);
   page.setDefaultNavigationTimeout(14000);
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   let responseCode=503;
   const posts=[];
   await page.route('**/assets/enquiry-config.js',route=>route.fulfill({
     status:200,contentType:'application/javascript',
     body:'window.BERRYMAN_ENQUIRY={enabled:true,turnstileSiteKey:"0x4AAAAAAAmockpublickey"};'
   }));
   await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>route.fulfill({
     status:200,contentType:'application/javascript',
     body:"window.turnstile={render:function(el,opts){window.__mockTurnstile=opts;setTimeout(function(){opts.callback('mock-site-token');},10);return 1;},reset:function(){setTimeout(function(){window.__mockTurnstile.callback('new-mock-token');},10);}};"
   }));
   await page.route('**/api/enquiry',async route=>{
     const req=route.request();
     if(req.method()!=='POST')errors.push('Online request not POST');
     try{posts.push(req.postDataJSON())}catch{errors.push('Invalid JSON payload')}
     await route.fulfill({status:responseCode,contentType:'application/json',
       body:JSON.stringify(responseCode===200?{ok:true,message:'Accepted'}:{ok:false,error:'Not delivered'})});
   });
   await page.goto(ROOT+'/contact/?service=smoke-alarm-installation',{waitUntil:'domcontentloaded',timeout:16000});
   await page.locator('[data-online-enquiry]').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.querySelector('[data-online-send]')?.disabled===false);
   if(await page.locator('select[name="job_type"]').inputValue()!=='Smoke alarm certification & installation')errors.push('Wrong smoke alarm service prefill');
   if(await page.locator('form button[type="submit"]').isVisible())errors.push('Email draft button still visible when online sending enabled');
   if(!(await page.locator('form a[href^="mailto:"]').first().isVisible()))errors.push('Email fallback link not accessible');
   await page.locator('input[name="suburb"]').fill('Byron Bay');
   await page.locator('input[name="name"]').fill('Test Person');
   await page.locator('input[name="contact"]').fill('test@example.net');
   await page.locator('textarea[name="job_details"]').fill('Certification check and replacement for two hard-wired smoke alarms');
   await page.locator('input[name="attachments"]').setInputFiles({
     name:'switchboard.jpg',mimeType:'image/jpeg',
     buffer:Buffer.from([255,216,255,224,0,16,74,70,73,70,0])
   });
   if(!(await page.locator('[data-attachment-status]').innerText()).includes('switchboard.jpg'))errors.push('Selected photo name missing');
   await page.locator('[data-online-send]').click();
   await page.waitForFunction(()=>document.querySelector('[data-online-status]')?.textContent.includes('could not be confirmed'));
   if(await page.locator('input[name="name"]').inputValue()!=='Test Person')errors.push('Form lost input after unsuccessful send');
   if(posts.length!==1)errors.push('Expected exactly one failed POST');
   responseCode=200;
   await page.waitForFunction(()=>document.querySelector('[data-online-send]')?.disabled===false);
   if(!(await page.locator('[data-online-status]').innerText()).includes('could not be confirmed')) errors.push('Failure status was lost after anti-spam token refresh');
   await page.locator('[data-online-send]').click();
   await page.waitForFunction(()=>document.querySelector('[data-online-status]')?.textContent.includes('accepted for email delivery'));
   if(posts.length!==2)errors.push('Expected a single retry POST');
   if(posts[0]?.jobType!=='Smoke alarm certification & installation')errors.push('Incorrect posted service');
   if(posts[0]?.attachments?.length!==1 || posts[0]?.attachments?.[0]?.filename!=='switchboard.jpg' ||
      !posts[0]?.attachments?.[0]?.content?.startsWith('/9j/')) errors.push('Photo attachment missing from POST');
   if(await page.locator('input[name="attachments"]').inputValue()!=='')errors.push('Photo selection not reset after success');
   if(posts[1]?.turnstileToken!=='new-mock-token')errors.push('Did not renew verification token');
   if(await page.locator('input[name="name"]').inputValue()!=='')errors.push('Successful send did not reset details');
   if(await page.locator('[data-online-send]').isEnabled())errors.push('Duplicate online submit still enabled');
   if(page.url().includes('test@example.net'))errors.push('Contact data leaked into URL');
   await page.screenshot({path:path.join(out,'contact-online-mocked-'+width+'.png')});
   report.push({case:'mocked failure and success / '+width,errors:[...errors],posted:posts.length});
   if(errors.length)throw Error(report[report.length-1].case+': '+errors.join(' | '));
   await page.close();
 }
 await browser.close();
 const md=['# Staged Contact enhancement browser QA','','- Disabled by default, manual mail draft present at mobile/desktop; hidden when direct sending is enabled','- Mocked Turnstile client and API (no real emails)','- Failure leaves inputs intact; retry uses new token; acceptance prevents duplicate submits','','| Scenario | Result |','|---|---|'];
 for(const r of report)md.push('| '+r.case+' | '+(r.errors.length?'FAIL: '+r.errors.join(', '):'PASS')+' |');
 fs.writeFileSync(path.join(out,'contact-online-qa.md'),md.join('\n'));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,md.join('\n')+'\n');
 console.log(report.map(r=>r.case+' '+(r.errors.length?'FAIL':'PASS')).join('\n'));
})().catch(e=>{console.error('Online-form QA failed:',e?.stack||e);process.exit(1);});
