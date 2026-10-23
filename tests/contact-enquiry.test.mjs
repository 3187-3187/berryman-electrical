import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, onRequestGet } from '../functions/api/enquiry.js';

const HOST='https://preview.example.com';
const env={
  FORM_ENABLE_SEND:'true',
  FORM_TURNSTILE_SECRET:'unit-test-secret',
  FORM_RESEND_API_KEY:'unit-test-provider-key',
  FORM_EMAIL_FROM:'Website <enquiries@example.com>',
  FORM_EMAIL_TO:'office@example.com'
};
const valid={
  name:'Test Customer',contact:'customer@example.net',suburb:'Byron Bay',
  details:'Three ceiling lights need replacing',
  jobType:'Lighting / power / fans',turnstileToken:'test-captcha-token',website:''
};
function req(changes={}, headers={}) {
  return new Request(HOST+'/api/enquiry',{
    method:'POST',
    headers:{'Origin':HOST,'Content-Type':'application/json',...headers},
    body:JSON.stringify({...valid,...changes})
  });
}
const ctx=(request,settings=env)=>({request,env:settings});
const json=async response=>({status:response.status,body:await response.json()});

test('cannot send when explicit server release flag is disabled', async()=>{
  const res=await json(await onRequestPost(ctx(req(),{...env,FORM_ENABLE_SEND:'false'})));
  assert.equal(res.status,503);
  assert.equal(res.body.ok,false);
});
test('fails closed if email and bot-check secrets are missing',async()=>{
  const result=await json(await onRequestPost(ctx(req(),{})));
  assert.equal(result.status,503);
  assert.equal(result.body.ok,false);
});
test('rejects requests from another origin',async()=>{
  const result=await json(await onRequestPost(ctx(req({}, {Origin:'https://attacker.invalid'}))));
  assert.equal(result.status,403);
});
test('rejects empty or invalid fields and honeypot',async()=>{
  assert.equal((await onRequestPost(ctx(req({details:'short'})))).status,400);
  assert.equal((await onRequestPost(ctx(req({website:'spam.example'})))).status,400);
  assert.equal((await onRequestPost(ctx(req({jobType:'Unknown service'})))).status,400);
});
test('checks Turnstile hostname and refuses invalid challenges',async()=>{
  const before=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({success:true,hostname:'someone-else.example'});
  try{
    const result=await json(await onRequestPost(ctx(req())));
    assert.equal(result.status,403);
    assert.equal(result.body.ok,false);
  }finally{globalThis.fetch=before;}
});
test('sends a text-only email and only confirms verified provider acceptance',async()=>{
  const before=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,opts)=>{
    calls.push([String(url),opts]);
    if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'preview.example.com'});
    if(String(url).includes('api.resend.com/emails'))return Response.json({id:'test-message-id'});
    throw Error('Unexpected destination');
  };
  try{
    const result=await json(await onRequestPost(ctx(req())));
    assert.equal(result.status,200);
    assert.equal(result.body.ok,true);
    assert.equal(calls.length,2);
    const sent=JSON.parse(calls[1][1].body);
    assert.deepEqual(sent.to,['office@example.com']);
    assert.equal(sent.reply_to,'customer@example.net');
    assert.match(sent.text,/Three ceiling lights need replacing/);
    assert.equal(sent.html,undefined);
    assert.doesNotMatch(JSON.stringify(result),/customer@example.net/);
  }finally{globalThis.fetch=before;}
});
test('accepts the industrial work type and sends the correct label',async()=>{
  const before=globalThis.fetch;
  let sent;
  globalThis.fetch=async(url,opts)=>{
    if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'preview.example.com'});
    sent=JSON.parse(opts.body);
    return Response.json({id:'industrial-enquiry-test'});
  };
  try {
    const result=await json(await onRequestPost(ctx(req({jobType:'Industrial electrical work',details:'Intermittent motor drive trips at a workshop'}))));
    assert.equal(result.status,200);
    assert.equal(sent.subject,'Website enquiry: Industrial electrical work');
  } finally {globalThis.fetch=before;}
});
test('fails if email provider rejects or cannot confirm acceptance',async()=>{
  const before=globalThis.fetch;
  globalThis.fetch=async(url)=>{
    if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'preview.example.com'});
    return Response.json({message:'provider failure'},{status:403});
  };
  try{
    const result=await json(await onRequestPost(ctx(req())));
    assert.equal(result.status,502);
    assert.equal(result.body.ok,false);
  }finally{globalThis.fetch=before;}
});
test('does not expose a GET submission interface',async()=>{
  const result=await json(onRequestGet());
  assert.equal(result.status,405);
});


const photo={filename:'switchboard.jpg',content:Buffer.from([255,216,255,224,0,16,74,70,73,70,0]).toString('base64')};
const pdf={filename:'plan.pdf',content:Buffer.from('%PDF-1.7\\nExample file').toString('base64')};
test('includes permitted photos and PDFs as Resend attachments',async()=>{
  const before=globalThis.fetch;
  let sent;
  globalThis.fetch=async(url,opts)=>{
    if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'preview.example.com'});
    if(String(url).includes('api.resend.com/emails')){
      sent=JSON.parse(opts.body);
      return Response.json({id:'attached-test-id'});
    }
    throw Error('Unexpected URL');
  };
  try{
    const result=await json(await onRequestPost(ctx(req({attachments:[photo,pdf]}))));
    assert.equal(result.status,200);
    assert.deepEqual(sent.attachments,[
      {...photo,content_type:'image/jpeg'}, {...pdf,content_type:'application/pdf'}
    ]);
    assert.match(sent.text,/Three ceiling lights/);
  }finally{globalThis.fetch=before;}
});
test('rejects unsafe, misleading or oversized attachment sets before contacting providers',async()=>{
  const reject=[
    {attachments:[{filename:'payload.exe',content:photo.content}]},
    {attachments:[{filename:'wrong.pdf',content:photo.content}]},
    {attachments:Array.from({length:5},()=>photo)},
    {attachments:[{...photo,filename:'bad/../../photo.jpg'}]},
    {attachments:[{...photo,content:'not even base64!'}]},
    {attachments:'plain string'}
  ];
  const before=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Must reject before any outbound request');};
  try{
    for(const item of reject){
      const result=await json(await onRequestPost(ctx(req(item))));
      assert.equal(result.status,400,JSON.stringify(item).slice(0,90));
    }
  }finally{globalThis.fetch=before;}
});
test('keeps legacy text-only enquiries working without attachments',async()=>{
  const before=globalThis.fetch;
  let sent;
  globalThis.fetch=async(url,opts)=>{
    if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'preview.example.com'});
    sent=JSON.parse(opts.body);
    return Response.json({id:'text-only-id'});
  };
  try{
    assert.equal((await onRequestPost(ctx(req()))).status,200);
    assert.equal(sent.attachments,undefined);
  }finally{globalThis.fetch=before;}
});


test('accepts simplified enquiry categories and specialist service-page context',async()=>{
  const before=globalThis.fetch;
  const emails=[];
  globalThis.fetch=async(url,opts)=>{
    if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'preview.example.com'});
    const submitted=JSON.parse(opts.body);
    emails.push(submitted);
    return Response.json({id:'accepted-category-'+emails.length});
  };
  try{
    const choices=[
      'Not sure / general enquiry', 'Fault finding / repair','Installation or upgrade',
      'Inspection or certification','Business or property maintenance',
      'Smoke alarm certification & installation','Data & communications cabling',
      'Strata & property management','Pump controls & automation',
      'House rewiring & new home wiring','Hot water electrical fault',
      'Underground power & submains','Commercial electrical maintenance'
    ];
    for(const jobType of choices){
      const result=await json(await onRequestPost(ctx(req({jobType})));
      assert.equal(result.status,200,jobType);
      assert.equal(result.body.ok,true);
    }
    assert.equal(emails.length,choices.length);
    for(let i=0;i<choices.length;i++){
      assert.equal(emails[i].subject,'Website enquiry: '+choices[i]);
      assert.match(emails[i].text,/Name: Test Customer/);
    }
  } finally {globalThis.fetch=before;}
});
