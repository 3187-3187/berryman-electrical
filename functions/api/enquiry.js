/**
 * Cloudflare Pages Function: POST /api/enquiry
 * Staged only: the public Contact page continues to use mailto until
 * verified email delivery, Turnstile and end-to-end tests are approved.
 * Secrets: FORM_TURNSTILE_SECRET, FORM_RESEND_API_KEY, FORM_EMAIL_FROM,
 *          FORM_EMAIL_TO. Never store these in the repository.
 */
const TYPES = new Set([
  'Residential electrical work', 'Fault finding / repair',
  'Switchboard assessment', 'Lighting / power / fans',
  'Commercial electrical work', 'Industrial electrical work', 'EV charger installation',
  'Renovation / electrical upgrade', 'Other planned electrical work',
  'Not sure / general enquiry', 'Installation or upgrade',
  'Inspection or certification', 'Business or property maintenance',
  'Commercial electrical maintenance', 'Data & communications cabling',
  'Hot water electrical fault', 'House rewiring & new home wiring',
  'Pump controls & automation', 'Smoke alarm certification & installation',
  'Strata & property management', 'Underground power & submains'
]);
// Conservative limits keep image enquiry emails reasonably small.
const MAX_FILES = 4;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = 15 * 1024 * 1024;
const ALLOWED_FILE_TYPES = Object.freeze({
  jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png',
  webp:'image/webp', heic:'image/heic', heif:'image/heif', pdf:'application/pdf'
});
function validSignature(base64, ext) {
  // Inspect a short prefix, not a potentially multi-megabyte decoded allocation.
  let bytes;
  try { bytes = atob(base64.slice(0, 128)); } catch { return false; }
  const is = (...values) => values.every((n,i) => bytes.charCodeAt(i) === n);
  if(ext==='jpg'||ext==='jpeg')return is(255,216,255);
  if(ext==='png')return is(137,80,78,71,13,10,26,10);
  if(ext==='webp')return bytes.slice(0,4)==='RIFF' && bytes.slice(8,12)==='WEBP';
  if(ext==='pdf')return bytes.startsWith('%PDF-');
  if(ext==='heic'||ext==='heif')
    return bytes.slice(4,8)==='ftyp' && /^(?:heic|heix|hevc|hevx|mif1|msf1)$/.test(bytes.slice(8,12));
  return false;
}
function safeAttachments(list) {
  if(list === undefined)return [];
  if(!Array.isArray(list) || list.length > MAX_FILES)return null;
  let total=0;
  const result=[];
  for(const item of list){
    if(!item || typeof item !== 'object' || Array.isArray(item) ||
       typeof item.filename !== 'string' || item.filename.length < 5 ||
       item.filename.length > 120 || /[\\/]/.test(item.filename) || item.filename.includes('..') ||
       typeof item.content !== 'string')return null;
    const ext=item.filename.split('.').pop()?.toLowerCase();
    if(!Object.hasOwn(ALLOWED_FILE_TYPES,ext))return null;
    const data=item.content;
    if(data.length===0 || data.length%4!==0 ||
       !/^[A-Za-z0-9+/]+={0,2}$/.test(data))return null;
    const size=(data.length/4)*3-(data.endsWith('==')?2:data.endsWith('=')?1:0);
    total+=size;
    if(size===0 || size>MAX_FILE_BYTES || total>MAX_TOTAL_BYTES ||
       !validSignature(data,ext))return null;
    const name=item.filename.replace(/[^A-Za-z0-9._ ()-]/g,'_').replace(/^\.+/,'').trim();
    if(!name || name.length>120 || !name.toLowerCase().endsWith('.'+ext))return null;
    result.push({filename:name,content:data,content_type:ALLOWED_FILE_TYPES[ext]});
  }
  return result;
}
const responseHeaders = {
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'
};
const reply = (status, body) => new Response(JSON.stringify(body), {
  status, headers:responseHeaders
});
function clean(value, max) {
  return typeof value === 'string' && value.length <= max
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim()
    : null;
}
export async function onRequestPost({request, env}) {
  try {
    const origin = new URL(request.url);
    if(request.headers.get('Origin') !== origin.origin)
      return reply(403, {ok:false,error:'Request origin not allowed.'});
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
      return reply(415, {ok:false,error:'Expected a JSON enquiry.'});
    if(Number(request.headers.get('Content-Length')||0)>MAX_REQUEST_BYTES)
      return reply(413, {ok:false,error:'Request too large.'});
    // Explicit release switch: even configured credentials cannot send until approved.
    if(env.FORM_ENABLE_SEND !== 'true')
      return reply(503,{ok:false,error:'Online enquiries are not enabled. Please call or email directly.'});
    if(!env.FORM_TURNSTILE_SECRET || !env.FORM_RESEND_API_KEY ||
       !env.FORM_EMAIL_FROM || !env.FORM_EMAIL_TO)
      return reply(503, {ok:false,error:'Online enquiries are unavailable. Please call or email directly.'});

    const raw=await request.text();
    if(raw.length>MAX_REQUEST_BYTES) return reply(413,{ok:false,error:'Request too large.'});
    let data;
    try {data=JSON.parse(raw);}catch{return reply(400,{ok:false,error:'Invalid enquiry.'});}
    if(!data || typeof data!=='object' || Array.isArray(data))
      return reply(400,{ok:false,error:'Invalid enquiry.'});
    if(typeof data.website==='string' && data.website.trim())
      return reply(400,{ok:false,error:'Invalid enquiry.'});
    const name=clean(data.name,100);
    const contact=clean(data.contact,120);
    const suburb=clean(data.suburb,100);
    const details=clean(data.details,1500);
    const jobType=clean(data.jobType,120);
    const token=clean(data.turnstileToken,2048);
    const attachments=safeAttachments(data.attachments);
    if(attachments===null)return reply(400,{ok:false,error:'Files must be JPG, PNG, WebP, HEIC, HEIF or PDF (up to 4 files, 5 MB each, 10 MB total).'});
    if(!name || name.length<2 || !contact || contact.length<5 ||
       !suburb || !details || details.length<8 || !TYPES.has(jobType) || !token)
      return reply(400,{ok:false,error:'Please complete the required enquiry details.'});

    const challenge=new URLSearchParams({secret:env.FORM_TURNSTILE_SECRET,response:token});
    const ip=request.headers.get('CF-Connecting-IP');
    if(ip)challenge.set('remoteip',ip);
    let verification;
    try {
      const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:challenge
      });
      if(!res.ok)return reply(503,{ok:false,error:'Verification unavailable. Try again later.'});
      verification=await res.json();
    }catch{return reply(503,{ok:false,error:'Verification unavailable. Try again later.'});}
    if(verification.success!==true || verification.hostname!==origin.hostname)
      return reply(403,{ok:false,error:'Verification failed. Please try again.'});

    // Plain text only; user-controlled values never become email HTML.
    const message={
      from:env.FORM_EMAIL_FROM,
      to:[env.FORM_EMAIL_TO],
      subject:'Website enquiry: '+jobType,
      text:[
        'Berryman Electrical — website enquiry',
        'Name: '+name,
        'Contact: '+contact,
        'Suburb: '+suburb,
        'Work type: '+jobType,
        '', 'Job details:',details,
        '', 'This is an enquiry, not a confirmed booking.'
      ].join('\n')
    };
    if(attachments.length)message.attachments=attachments;
    if(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact))message.reply_to=contact;
    let accepted;
    try {
      const res=await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.FORM_RESEND_API_KEY},
        body:JSON.stringify(message)
      });
      if(!res.ok)return reply(502,{ok:false,error:'We could not deliver your enquiry. Please call or email directly.'});
      accepted=await res.json();
    }catch{return reply(502,{ok:false,error:'We could not deliver your enquiry. Please call or email directly.'});}
    if(!accepted?.id)
      return reply(502,{ok:false,error:'Email provider acceptance could not be confirmed. Please contact us directly.'});
    // Provider acceptance is not a guarantee of inbox arrival.
    return reply(200,{ok:true,message:'Your enquiry was accepted for email delivery. We will be in touch.'});
  }catch{return reply(500,{ok:false,error:'Unexpected problem. Please call or email directly.'});}
}
export function onRequestGet(){return reply(405,{ok:false,error:'POST only.'});}
