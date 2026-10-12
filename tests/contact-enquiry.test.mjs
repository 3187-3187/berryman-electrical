import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, onRequestGet } from '../functions/api/enquiry.js';

const HOST='https://preview.example.com';
const env={
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
