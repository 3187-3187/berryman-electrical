const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://127.0.0.1:8765';
const PAGES = [
  ['homepage', '/'],
  ['byron-bay', '/areas/electrician-byron-bay/'],
  ['fault-finding', '/services/fault-finding-electrical-repairs/'],
  ['switchboard-upgrades', '/services/switchboard-upgrades/'],
  ['residential', '/services/residential-electrician/'],
  ['commercial', '/services/commercial-electrician/'],
  ['services-hub', '/services/'],
  ['contact', '/contact/'],
  ['service-areas', '/areas/'],
  ['mullumbimby', '/areas/electrician-mullumbimby/'],
  ['brunswick-heads', '/areas/electrician-brunswick-heads/'],
  ['about', '/about/']
];
const VIEWS = [
  ['mobile', 390, 844],
  ['tablet', 768, 1024],
  ['desktop', 1440, 900]
];
const output = 'qa-output';
fs.mkdirSync(output, { recursive: true });
const results = [];
let failed = false;
const browserErrors = [];
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [name, url] of PAGES) {
    for (const [view, width, height] of VIEWS) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const problems = [];
      page.on('pageerror', error => problems.push('JS error: ' + error.message));
      let res = await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 30000 });
      if (res.status() !== 200) problems.push('Page response: ' + res.status());
      const data = await page.evaluate(() => ({
        width: innerWidth,
        docWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        h1s: document.querySelectorAll('main h1').length,
        title: document.title,
        canonical: document.querySelector('link[rel=canonical]')?.href || null,
        visibleCTA: [...document.querySelectorAll('main a[href^="tel:"],main a[href*="/contact/"],main a[href="contact/"]')].some(el => el.getBoundingClientRect().width > 0),
        idCount: document.querySelectorAll('[id]').length,
        uniqueIdCount: new Set([...document.querySelectorAll('[id]')].map(el => el.id)).size
      }));
      if (data.h1s !== 1) problems.push('Expected exactly one main H1');
      if (!(await page.locator('header .brand').isVisible())) problems.push('Header brand is not visible');
      if (view === 'desktop' && !(await page.locator('header .navlinks').isVisible())) problems.push('Desktop navigation links are not visible');
      if (data.docWidth > width + 4 || data.bodyWidth > width + 4) problems.push('Horizontal overflow: doc ' + data.docWidth + ' / viewport ' + width);
      if (!data.visibleCTA && !['service-areas','about'].includes(name)) problems.push('No visible main phone/contact CTA');
      if (data.idCount !== data.uniqueIdCount) problems.push('Duplicate HTML IDs');
      if (!data.canonical?.startsWith('https://www.berrymanelectrical.com.au/')) problems.push('Missing or unexpected canonical');
      if (view === 'mobile') {
        const mobileToggle = page.locator('.mobileNavToggle');
        if (await mobileToggle.count()) {
          await mobileToggle.click();
          if (!(await page.locator('.mobileDrawer').isVisible())) problems.push('Mobile drawer did not open');
          await mobileToggle.click();
          if (await page.locator('.mobileDrawer').isVisible()) problems.push('Mobile drawer did not close');
        }
        const sticky = page.locator('.mobileStickyActions:visible, .mobileBar:visible');
        if (await sticky.count() !== 1) problems.push('Expected exactly one visible mobile CTA bar; found ' + await sticky.count());
      }
      if (name === 'mullumbimby' || name === 'brunswick-heads') {
        const place=name==='mullumbimby'?'Mullumbimby':'Brunswick Heads';
        const heading = await page.locator('main h1').innerText();
        if (heading.trim() !== 'Electrician '+place) problems.push('Area owner H1 incorrect for '+place);
        if (await page.locator('main .localServiceCard').count() !== 6) problems.push('Expected six local service cards');
        if (await page.locator('main .localIntentCard').count() !== 3) problems.push('Expected three contact pathways');
        if (await page.locator('main .realPhoto img').count() !== 3) problems.push('Expected three genuine evidence images');
        const qs = await page.locator('main .staticFaq details').count();
        if (qs !== 6) problems.push('Expected six visible FAQ questions; found '+qs);
        const text = await page.locator('main').innerText();
        if (/based in (Byron Bay|Mullumbimby|Brunswick Heads)/i.test(text)) problems.push('Repeated public business-base statement');
        if (/these jobs were (in|at) (Mullumbimby|Brunswick Heads)/i.test(text)) problems.push('Unverified job location claim');
        const faqSchema = await page.evaluate(() => {
           const s=[...document.querySelectorAll('script[type="application/ld+json"]')].map(x => {
             try {return JSON.parse(x.textContent);}catch{return null;}
           }).find(x=>x?.['@type']==='FAQPage');
           const visible=[...document.querySelectorAll('main .staticFaq details')].map(x=>({
             name:x.querySelector('summary')?.textContent?.trim(),
             text:x.querySelector('p')?.textContent?.trim()
           }));
           return !!s && s.mainEntity.length===visible.length && s.mainEntity.every((q,i)=>q.name===visible[i].name&&q.acceptedAnswer.text===visible[i].text);
        });
        if (!faqSchema) problems.push('Visible FAQ and schema mismatch');
      }
      if (name === 'mullumbimby') {
        const h1 = await page.locator('main h1').innerText();
        if (h1.trim() !== 'Electrician Mullumbimby') problems.push('Mullumbimby owner H1 not exact service-area intent');
        if ((await page.locator('main').innerText()).includes('Are you actually based in Byron Bay?')) problems.push('Outdated base-location FAQ remains');
      }
            if (name === 'residential' || name === 'commercial') {
        const isResidential = name === 'residential';
        const heading = isResidential ? 'Residential Electrical Services' : 'Commercial Electrical Services';
        if ((await page.locator('main h1').innerText()).trim() !== heading) problems.push('Unexpected specialist owner H1');
        if (await page.locator('main .scopeCard').count() !== 6) problems.push('Expected six service scope cards');
        if (await page.locator('main .scopeConsideration').count() !== 4) problems.push('Expected four scoping considerations');
        if (await page.locator('main .realPhoto img').count() !== 3) problems.push('Expected three genuine archive photos');
        if (await page.locator('main .staticFaq details').count() !== 6) problems.push('Expected six service FAQs');
        const result = await page.evaluate(() => {
          const s=[...document.querySelectorAll('script[type="application/ld+json"]')].map(el=>{try{return JSON.parse(el.textContent)}catch{return null}});
          const q=s.find(x=>x?.['@type']==='FAQPage');
          const service=s.find(x=>x?.['@type']==='Service');
          const shown=[...document.querySelectorAll('main .staticFaq details')].map(el=>({
            name:el.querySelector('summary')?.textContent.trim(),
            text:el.querySelector('p')?.textContent.trim()
          }));
          return {
            faqMatch:!!q && q.mainEntity.length===shown.length && q.mainEntity.every((x,i)=>x.name===shown[i].name&&x.acceptedAnswer.text===shown[i].text),
            serviceMatch:!!service && service.name===document.querySelector('main h1')?.textContent.trim(),
            content:document.querySelector('main')?.textContent||''
          };
        });
        if (!result.faqMatch) problems.push('FAQ schema does not match visible FAQs');
        if (!result.serviceMatch) problems.push('Service JSON-LD and H1 mismatch');
        if (/based in Byron Bay|Byron Bay-based/i.test(result.content)) problems.push('Unnecessary business base assertion');
        if (/\$\s*\d+(?:\.\d+)?\s*(?:per hour|\/hr)/i.test(result.content)) problems.push('Unapproved published fixed hourly price');
      }
      if (name === 'services-hub') {
        if (await page.locator('main .hubServiceCard').count() !== 8) problems.push('Expected eight service cards');
        if (await page.locator('main a[href="emergency-electrician/"]').count()) problems.push('Linked to unpublished emergency service page');
      }
      if (name === 'contact') {
        const form = page.locator('form[data-email-enquiry]');
        if (await form.count() !== 1) problems.push('Contact enquiry form missing');
        else {
          const required = await form.evaluate(el => [...el.querySelectorAll('[required]')].length);
          if (required < 5) problems.push('Expected required type, suburb, name, contact, and details');
          if (await form.locator('select[name="job_type"]').inputValue() !== '') problems.push('Missing blank default job type');
          if (await form.locator('input[type="file"]').count()) problems.push('Unexpected file input which cannot attach via mailto');
          if (await form.locator('button[type="submit"]').innerText() !== 'Open email draft') problems.push('Email draft action incorrectly described');
          const invalid = await form.evaluate(el => el.checkValidity());
          if (invalid) problems.push('Empty form should be invalid');
          if (!await page.locator('main').innerText().then(t => t.includes('does not submit enquiries to a server'))) problems.push('Missing transparent mailto disclosure');
          if (view === 'desktop') {
            for (const [service,expected] of [['switchboard','Switchboard assessment'],['residential','Residential electrical work'],['commercial','Commercial electrical work']]) {
              await page.goto(BASE + '/contact/?service='+service, {waitUntil:'networkidle'});
              if (await form.locator('select[name="job_type"]').inputValue() !== expected) problems.push('Service preselect failed: '+service);
            }
            await page.goto(BASE + '/contact/', {waitUntil:'networkidle'});
          }
        }
      }
      const firstFaq = page.locator('main details').first();
      if (await firstFaq.count()) {
        await firstFaq.locator('summary').click();
        if (!(await firstFaq.evaluate(el => el.open))) problems.push('First FAQ did not open');
      }
      // Scroll lazy images into view; report failed actual loads.
      const imgs = page.locator('main img');
      for (let i=0;i<await imgs.count();i++) {
        let img=imgs.nth(i);
        await img.scrollIntoViewIfNeeded().catch(()=>{});
        await img.evaluate(el => el.decode().catch(()=>{}));
        if (!(await img.evaluate(el=>el.complete && el.naturalWidth>0))) {
          problems.push('Image failed to load: ' + await img.getAttribute('src'));
        }
      }
      if (view === 'desktop') {
        const broken = await page.evaluate(async () => {
          const urls = [...new Set([...document.querySelectorAll('a[href]')].map(a=>a.href).filter(x => x.startsWith(location.origin)))];
          const bad = [];
          for (const url of urls) {
            try { const response = await fetch(url, { method:'GET' }); if (!response.ok) bad.push(url + ': ' + response.status); }
            catch(e) { bad.push(url + ': ' + e.message); }
          }
          return bad;
        });
        problems.push(...broken.map(x=>'Broken internal link: '+x));
      }
      // Reset focus and scroll before capture, so fixed bars do not appear mid-page in full-page images.
      await page.evaluate(() => {
        if (document.activeElement) document.activeElement.blur();
        document.documentElement.style.scrollBehavior = 'auto';
        document.body.style.scrollBehavior = 'auto';
        window.scrollTo({top:0,left:0,behavior:'instant'});
      });
      await page.waitForFunction(() => window.scrollY === 0);
      await page.screenshot({path:path.join(output,name+'-'+view+'.png'),fullPage:view!=='tablet'});
      const row = {page:name,viewport:view,width,measured: data,problems};
      results.push(row);
      console.log((problems.length?'FAIL':'PASS') + ' ' + name + ' ' + view + ' ' + problems.join(' | '));
      if (problems.length) failed=true;
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(output,'qa-report.json'),JSON.stringify(results,null,2));
  const lines=['# Berryman Electrical — SEO branch browser QA','', 'Tested '+new Date().toISOString(), '', '| Page | Viewport | Result |', '|---|---|---|'];
  for(const r of results) lines.push('| '+r.page+' | '+r.viewport+' ('+r.width+'px) | '+(r.problems.length?r.problems.join('; '):'PASS')+' |');
  lines.push('', 'Checks: actual Chromium rendering, title/canonical/H1, mobile nav, mobile sticky CTA, FAQ interaction, contact form requirements/service prefilling, lazy-image loading, horizontal overflow, JS errors, and internal links.', '');
  fs.writeFileSync(path.join(output,'qa-report.md'),lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
  if (failed) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});