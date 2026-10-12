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
  'Commercial electrical work', 'EV charger installation',
  'Renovation / electrical upgrade', 'Other planned electrical work'
]);
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
    if(Number(request.headers.get('Content-Length')||0)>10000)
      return reply(413, {ok:false,error:'Request too large.'});
    if(!env.FORM_TURNSTILE_SECRET || !env.FORM_RESEND_API_KEY ||
       !env.FORM_EMAIL_FROM || !env.FORM_EMAIL_TO)
      return reply(503, {ok:false,error:'Online enquiries are unavailable. Please call or email directly.'});

    const raw=await request.text();
    if(raw.length>10000) return reply(413,{ok:false,error:'Request too large.'});
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
