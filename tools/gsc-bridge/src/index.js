const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Berryman GSC Bridge</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:920px;margin:38px auto;padding:0 18px;color:#171717}
h1{margin-bottom:6px}.muted{color:#666}.card{border:1px solid #ddd;border-radius:14px;padding:18px;margin:18px 0}
button,a.button{display:inline-block;background:#111;color:#fff;border:0;border-radius:9px;padding:11px 15px;text-decoration:none;font-weight:650;cursor:pointer}
button.secondary{background:#eee;color:#111}input,select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:8px;margin:6px 0 12px}
.grid{display:grid;grid-template-columns:1fr 120px;gap:12px}.ok{color:#087b34}.bad{color:#a51d1d}
code,pre{background:#f6f6f6;padding:2px 5px;border-radius:5px}pre{white-space:pre-wrap;padding:12px;overflow:auto}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:8px;border-bottom:1px solid #eee}th{background:#fafafa}
@media(max-width:600px){.grid{grid-template-columns:1fr}}
</style></head>
<body>
<h1>Berryman Search Console Bridge</h1>
<p class="muted">Private proof: Google Search Console → our own bridge → ranking data.</p>

<div class="card">
<h2>1. Google connection</h2><div id="status">Checking…</div>
<p><a class="button" href="/api/oauth-start">Connect Google Search Console</a>
<button class="secondary" onclick="logout()">Disconnect browser</button></p>
</div>

<div class="card">
<h2>2. Test a keyword</h2>
<label>Search Console property</label><select id="site"></select>
<div class="grid"><div><label>Exact query</label><input id="q" value="electrician byron bay"></div>
<div><label>Days</label><input id="days" type="number" min="1" max="480" value="28"></div></div>
<button onclick="runKeyword()">Run test</button><div id="keywordOut"></div>
</div>

<div class="card">
<h2>3. Top queries</h2>
<button onclick="runTop()">Load top 50 queries</button><div id="topOut"></div>
</div>

<div class="card">
<h2>4. Server handoff</h2>
<p class="muted">Promote the working browser connection to a server connection so the bridge can run without this phone/browser. The refresh token is sensitive; copy it straight into Cloudflare as the runtime secret <code>GOOGLE_REFRESH_TOKEN</code> and do not send it in chat.</p>
<button onclick="exportRefresh()">Show refresh token</button>
<div id="handoffOut"></div>
</div>

<script>
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function j(url){const r=await fetch(url);const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={error:t}};if(!r.ok)throw new Error(d.error||r.statusText);return d}
async function init(){
 try{
  const s=await j('/api/status');
  document.getElementById('status').innerHTML=
   '<div>Google OAuth configured: <b class="'+(s.googleConfigured?'ok':'bad')+'">'+(s.googleConfigured?'yes':'no')+'</b></div>'+
   '<div>Browser connected: <b class="'+(s.browserConnected?'ok':'bad')+'">'+(s.browserConnected?'yes':'no')+'</b></div>'+
   '<div>Server connected: <b class="'+(s.serverConnected?'ok':'bad')+'">'+(s.serverConnected?'yes':'no')+'</b></div>'+
   '<div>ChatGPT read API configured: <b class="'+(s.aiReadConfigured?'ok':'bad')+'">'+(s.aiReadConfigured?'yes':'no')+'</b></div>'+
   '<div>OAuth callback: <code>'+esc(s.callbackUrl)+'</code></div>';
  if(s.connected){
   const d=await j('/api/sites'),sel=document.getElementById('site');sel.innerHTML='';
   (d.siteEntry||[]).forEach(x=>{const o=document.createElement('option');o.value=x.siteUrl;o.textContent=x.siteUrl+' ('+x.permissionLevel+')';sel.appendChild(o)});
   const p=[...sel.options].find(o=>o.value.includes('berrymanelectrical.com.au'));if(p)sel.value=p.value;
  }
 }catch(e){document.getElementById('status').innerHTML='<span class="bad">'+esc(e.message)+'</span>'}
}
async function runKeyword(){
 const out=document.getElementById('keywordOut');out.innerHTML='<p>Loading…</p>';
 try{
  const site=document.getElementById('site').value,q=document.getElementById('q').value,days=document.getElementById('days').value;
  const d=await j('/api/query?site='+encodeURIComponent(site)+'&q='+encodeURIComponent(q)+'&days='+encodeURIComponent(days));
  if(!d.rows?.length){out.innerHTML='<p>No rows returned for that exact query in this period.</p>';return}
  out.innerHTML='<p><b>'+esc(q)+'</b> — '+esc(d.meta.startDate)+' to '+esc(d.meta.endDate)+'</p>'+
   '<table><thead><tr><th>Page</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Avg position</th></tr></thead><tbody>'+
   d.rows.map(r=>'<tr><td>'+esc(r.page)+'</td><td>'+r.clicks+'</td><td>'+r.impressions+'</td><td>'+((r.ctr||0)*100).toFixed(1)+'%</td><td><b>'+Number(r.position).toFixed(1)+'</b></td></tr>').join('')+
   '</tbody></table>';
 }catch(e){out.innerHTML='<p class="bad">'+esc(e.message)+'</p>'}
}
async function runTop(){
 const out=document.getElementById('topOut');out.innerHTML='<p>Loading…</p>';
 try{
  const site=document.getElementById('site').value,days=document.getElementById('days').value;
  const d=await j('/api/queries?site='+encodeURIComponent(site)+'&days='+encodeURIComponent(days)+'&limit=50');
  out.innerHTML='<p>'+esc(d.meta.startDate)+' to '+esc(d.meta.endDate)+'</p>'+
   '<table><thead><tr><th>Query</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Avg position</th></tr></thead><tbody>'+
   (d.rows||[]).map(r=>'<tr><td>'+esc(r.query)+'</td><td>'+r.clicks+'</td><td>'+r.impressions+'</td><td>'+((r.ctr||0)*100).toFixed(1)+'%</td><td><b>'+Number(r.position).toFixed(1)+'</b></td></tr>').join('')+
   '</tbody></table>';
 }catch(e){out.innerHTML='<p class="bad">'+esc(e.message)+'</p>'}
}
async function exportRefresh(){
 const out=document.getElementById('handoffOut');out.innerHTML='<p>Loading…</p>';
 try{
  const r=await fetch('/api/export-refresh-token',{method:'POST'});
  const t=await r.text();let d;try{d=JSON.parse(t)}catch{d={error:t}};
  if(!r.ok)throw new Error(d.error||r.statusText);
  out.innerHTML='<p><b>Sensitive:</b> copy this directly into Cloudflare as <code>GOOGLE_REFRESH_TOKEN</code>, then remove it from view by refreshing this page.</p><pre>'+esc(d.refreshToken)+'</pre>';
 }catch(e){out.innerHTML='<p class="bad">'+esc(e.message)+'</p>'}
}
async function logout(){await fetch('/api/logout');location.reload()} init();
</script></body></html>`;

const enc = new TextEncoder(), dec = new TextDecoder();

function b64url(bytes){
  let s=''; for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function unb64url(s){
  s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';
  const raw=atob(s),a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a;
}
async function aesKey(secret){
  const hash=await crypto.subtle.digest('SHA-256',enc.encode(secret));
  return crypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(obj,secret){
  const iv=crypto.getRandomValues(new Uint8Array(12)),key=await aesKey(secret);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(obj))));
  const all=new Uint8Array(iv.length+ct.length);all.set(iv);all.set(ct,iv.length);return b64url(all);
}
async function unseal(token,secret){
  try{
    const all=unb64url(token),iv=all.slice(0,12),ct=all.slice(12),key=await aesKey(secret);
    const p=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);return JSON.parse(dec.decode(p));
  }catch{return null}
}
function cookies(req){
  const out={};for(const part of (req.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out;
}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}})}
function callbackUrl(req){return new URL('/api/oauth-callback',req.url).toString()}
function configured(env){return Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.SESSION_SECRET)}
function serverConnected(env){return Boolean(env.GOOGLE_REFRESH_TOKEN)}
function aiReadConfigured(env){return Boolean(configured(env)&&env.GOOGLE_REFRESH_TOKEN&&env.BRIDGE_READ_KEY)}
function readKeyOk(req,env,u){
  if(!env.BRIDGE_READ_KEY)return false;
  const auth=req.headers.get('authorization')||'';
  const bearer=auth.startsWith('Bearer ')?auth.slice(7):'';
  const query=u.searchParams.get('key')||'';
  return bearer===env.BRIDGE_READ_KEY||query===env.BRIDGE_READ_KEY;
}
async function session(req,env){
  const t=cookies(req).gsc_session;if(!t||!env.SESSION_SECRET)return null;return unseal(t,env.SESSION_SECRET);
}
async function refreshTokenFor(req,env){
  if(env.GOOGLE_REFRESH_TOKEN)return env.GOOGLE_REFRESH_TOKEN;
  const s=await session(req,env);return s?.refresh_token||null;
}
async function getAccessToken(refreshToken,env){
  const body=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:'refresh_token'});
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const d=await r.json();if(!r.ok)throw new Error(d.error_description||d.error||'Google token refresh failed');return d.access_token;
}
function dateRange(days){
  const n=Math.max(1,Math.min(Number(days)||28,480)),end=new Date();end.setUTCDate(end.getUTCDate()-2);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-(n-1));const f=d=>d.toISOString().slice(0,10);
  return {startDate:f(start),endDate:f(end),days:n};
}
async function gscPost(site,body,token){
  const u='https://searchconsole.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(site)+'/searchAnalytics/query';
  const r=await fetch(u,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Google Search Console request failed');return d;
}

const MCP_TOOLS=[
 {name:'gsc_status',description:'Check whether the Berryman Electrical Google Search Console bridge is connected and ready.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'gsc_summary',description:'Get overall Google Search Console performance for Berryman Electrical for a recent period.',inputSchema:{type:'object',properties:{days:{type:'integer',minimum:1,maximum:480,default:28}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'gsc_top_queries',description:'Get the top Google Search queries for Berryman Electrical with clicks, impressions, CTR and average position.',inputSchema:{type:'object',properties:{days:{type:'integer',minimum:1,maximum:480,default:28},limit:{type:'integer',minimum:1,maximum:1000,default:100}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'gsc_query',description:'Inspect one exact Google Search query and see which Berryman Electrical page or pages appeared, with clicks, impressions, CTR and average position.',inputSchema:{type:'object',required:['query'],properties:{query:{type:'string',minLength:1},days:{type:'integer',minimum:1,maximum:480,default:28}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'gsc_pages',description:'Get the Berryman Electrical pages receiving Google Search visibility, with clicks, impressions, CTR and average position.',inputSchema:{type:'object',properties:{days:{type:'integer',minimum:1,maximum:480,default:28},limit:{type:'integer',minimum:1,maximum:1000,default:100}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'gsc_opportunities',description:'Find Google Search queries with meaningful impressions and average positions 4 through 20, useful for prioritising SEO opportunities.',inputSchema:{type:'object',properties:{days:{type:'integer',minimum:1,maximum:480,default:28},minImpressions:{type:'integer',minimum:1,default:20}},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}}
];

function mcpResult(id,result){return json({jsonrpc:'2.0',id,result},200,{'cache-control':'no-store'});}
function mcpError(id,code,message,data){return json({jsonrpc:'2.0',id,error:{code,message,...(data===undefined?{}:{data})}},200,{'cache-control':'no-store'});}
function mcpToolPayload(data){return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false};}

async function mcpCallTool(name,args,env){
  const site='sc-domain:berrymanelectrical.com.au';
  const token=await getAccessToken(env.GOOGLE_REFRESH_TOKEN,env);
  if(name==='gsc_status')return {ok:true,site,serverConnected:true,readOnly:true};
  if(name==='gsc_summary'){
    const dts=dateRange(args?.days),d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,rowLimit:1},token);
    const r=d.rows?.[0]||{clicks:0,impressions:0,ctr:0,position:0};
    return {meta:{site,...dts},summary:{clicks:r.clicks||0,impressions:r.impressions||0,ctr:r.ctr||0,position:r.position||0}};
  }
  if(name==='gsc_top_queries'){
    const dts=dateRange(args?.days),limit=Math.max(1,Math.min(Number(args?.limit)||100,1000));
    const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['query'],rowLimit:limit},token);
    return {meta:{site,...dts},rows:(d.rows||[]).map(r=>({query:r.keys?.[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}))};
  }
  if(name==='gsc_query'){
    const q=String(args?.query||'').trim();if(!q)throw new Error('query is required');
    const dts=dateRange(args?.days),d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['query','page'],dimensionFilterGroups:[{filters:[{dimension:'query',operator:'equals',expression:q}]}],rowLimit:100},token);
    return {meta:{site,q,...dts},rows:(d.rows||[]).map(r=>({query:r.keys?.[0],page:r.keys?.[1],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}))};
  }
  if(name==='gsc_pages'){
    const dts=dateRange(args?.days),limit=Math.max(1,Math.min(Number(args?.limit)||100,1000));
    const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['page'],rowLimit:limit},token);
    return {meta:{site,...dts},rows:(d.rows||[]).map(r=>({page:r.keys?.[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}))};
  }
  if(name==='gsc_opportunities'){
    const dts=dateRange(args?.days),minImpressions=Math.max(1,Number(args?.minImpressions)||20);
    const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['query'],rowLimit:1000},token);
    const rows=(d.rows||[]).map(r=>({query:r.keys?.[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}))
      .filter(r=>r.impressions>=minImpressions&&r.position>=4&&r.position<=20)
      .sort((a,b)=>b.impressions-a.impressions).slice(0,100);
    return {meta:{site,...dts,minImpressions},rows};
  }
  throw new Error('Unknown tool: '+name);
}

export default {
 async fetch(req,env){
  const u=new URL(req.url),path=u.pathname;
  try{
   if(path==='/')return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
   if(path==='/api/status'){
    const s=await session(req,env);
    return json({
      googleConfigured:configured(env),
      connected:Boolean(s?.refresh_token||env.GOOGLE_REFRESH_TOKEN),
      browserConnected:Boolean(s?.refresh_token),
      serverConnected:serverConnected(env),
      aiReadConfigured:aiReadConfigured(env),
      callbackUrl:callbackUrl(req)
    });
   }
   if(path==='/api/oauth-start'){
    if(!configured(env))return new Response('Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET in Worker secrets first.',{status:503});
    const state=b64url(crypto.getRandomValues(new Uint8Array(24)));
    const p=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:callbackUrl(req),response_type:'code',scope:'https://www.googleapis.com/auth/webmasters.readonly',access_type:'offline',prompt:'consent',include_granted_scopes:'true',state});
    return new Response(null,{status:302,headers:{location:'https://accounts.google.com/o/oauth2/v2/auth?'+p,'set-cookie':'oauth_state='+state+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600'}});
   }
   if(path==='/api/oauth-callback'){
    const code=u.searchParams.get('code'),state=u.searchParams.get('state'),err=u.searchParams.get('error');
    if(err)return new Response('Google authorization failed: '+err,{status:400});
    if(!code||!state||cookies(req).oauth_state!==state)return new Response('Invalid OAuth callback/state.',{status:400});
    const body=new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:callbackUrl(req),grant_type:'authorization_code'});
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
    const d=await r.json();if(!r.ok)throw new Error(d.error_description||d.error||'Token exchange failed');
    if(!d.refresh_token)throw new Error('Google did not return a refresh token. Reconnect and approve consent again.');
    const token=await seal({refresh_token:d.refresh_token,connected_at:new Date().toISOString()},env.SESSION_SECRET);
    return new Response(null,{status:302,headers:{location:'/?connected=1','set-cookie':'gsc_session='+encodeURIComponent(token)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=7776000'}});
   }
   if(path==='/api/logout')return json({ok:true},200,{'set-cookie':'gsc_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});
   if(path==='/api/export-refresh-token'){
    if(req.method!=='POST')return json({error:'POST required'},405,{'cache-control':'no-store'});
    const s=await session(req,env);if(!s?.refresh_token)return json({error:'Browser connection is required to export the refresh token.'},401,{'cache-control':'no-store'});
    return json({refreshToken:s.refresh_token},200,{'cache-control':'no-store'});
   }
   if(path==='/api/sites'){
    const refreshToken=await refreshTokenFor(req,env);if(!refreshToken)return json({error:'Connect Google Search Console first.'},401);
    const token=await getAccessToken(refreshToken,env),r=await fetch('https://www.googleapis.com/webmasters/v3/sites',{headers:{authorization:'Bearer '+token}});
    const d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Unable to list Search Console properties');return json(d);
   }
   if(path==='/api/query'){
    const site=u.searchParams.get('site'),q=u.searchParams.get('q');if(!site||!q)return json({error:'site and q are required'},400);
    const refreshToken=await refreshTokenFor(req,env);if(!refreshToken)return json({error:'Connect Google Search Console first.'},401);
    const token=await getAccessToken(refreshToken,env),dts=dateRange(u.searchParams.get('days'));
    const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['query','page'],dimensionFilterGroups:[{filters:[{dimension:'query',operator:'equals',expression:q}]}],rowLimit:100},token);
    const rows=(d.rows||[]).map(r=>({query:r.keys?.[0],page:r.keys?.[1],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}));
    return json({meta:{site,q,...dts},rows});
   }
   if(path==='/api/queries'){
    const site=u.searchParams.get('site');if(!site)return json({error:'site is required'},400);
    const limit=Math.max(1,Math.min(Number(u.searchParams.get('limit'))||50,1000)),refreshToken=await refreshTokenFor(req,env);
    if(!refreshToken)return json({error:'Connect Google Search Console first.'},401);
    const token=await getAccessToken(refreshToken,env),dts=dateRange(u.searchParams.get('days'));
    const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['query'],rowLimit:limit},token);
    const rows=(d.rows||[]).map(r=>({query:r.keys?.[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}));
    return json({meta:{site,...dts},rows});
   }
   if(path==='/mcp'){
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,content-type,mcp-protocol-version'}});
    if(req.method!=='POST')return new Response('Method not allowed',{status:405,headers:{allow:'POST, OPTIONS'}});
    if(!env.GOOGLE_REFRESH_TOKEN)return json({error:'Server connection is not configured.'},503);
    if(!env.BRIDGE_READ_KEY)return json({error:'MCP read access is not configured.'},503);
    if(!readKeyOk(req,env,u))return new Response(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32001,message:'Unauthorized'}}),{status:401,headers:{'content-type':'application/json; charset=utf-8','www-authenticate':'Bearer'}});
    let body;try{body=await req.json()}catch{return mcpError(null,-32700,'Parse error')}
    if(Array.isArray(body))return mcpError(null,-32600,'Batch requests are not supported');
    const id=body?.id??null,method=body?.method,params=body?.params||{};
    if(method==='initialize'){
      return mcpResult(id,{protocolVersion:params.protocolVersion||'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'berryman-gsc-bridge',version:'1.0.0'},instructions:'Read-only Google Search Console tools for Berryman Electrical. Use these tools to inspect real GSC performance, queries, pages and SEO opportunities. GSC average position is aggregated visibility, not an exact live local rank.'});
    }
    if(method==='notifications/initialized')return new Response(null,{status:202});
    if(method==='ping')return mcpResult(id,{});
    if(method==='tools/list')return mcpResult(id,{tools:MCP_TOOLS});
    if(method==='tools/call'){
      const name=params?.name,args=params?.arguments||{};
      try{return mcpResult(id,mcpToolPayload(await mcpCallTool(name,args,env)))}
      catch(e){return mcpResult(id,{content:[{type:'text',text:e.message||String(e)}],isError:true})}
    }
    return mcpError(id,-32601,'Method not found');
   }
   if(path.startsWith('/api/ai/')){
    if(!env.GOOGLE_REFRESH_TOKEN)return json({error:'Server connection is not configured. Add GOOGLE_REFRESH_TOKEN as a Worker runtime secret.'},503);
    if(!env.BRIDGE_READ_KEY)return json({error:'ChatGPT read access is not configured. Add BRIDGE_READ_KEY as a Worker runtime secret.'},503);
    if(!readKeyOk(req,env,u))return json({error:'Unauthorized'},401);
    const refreshToken=env.GOOGLE_REFRESH_TOKEN,token=await getAccessToken(refreshToken,env);
    const defaultSite='sc-domain:berrymanelectrical.com.au';
    if(path==='/api/ai/status')return json({ok:true,site:defaultSite,serverConnected:true,readOnly:true});
    if(path==='/api/ai/sites'){
      const r=await fetch('https://www.googleapis.com/webmasters/v3/sites',{headers:{authorization:'Bearer '+token}});
      const d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Unable to list Search Console properties');return json(d);
    }
    if(path==='/api/ai/summary'){
      const site=u.searchParams.get('site')||defaultSite,dts=dateRange(u.searchParams.get('days'));
      const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,rowLimit:1},token);
      const r=d.rows?.[0]||{clicks:0,impressions:0,ctr:0,position:0};
      return json({meta:{site,...dts},summary:{clicks:r.clicks||0,impressions:r.impressions||0,ctr:r.ctr||0,position:r.position||0}});
    }
    if(path==='/api/ai/queries'){
      const site=u.searchParams.get('site')||defaultSite,dts=dateRange(u.searchParams.get('days'));
      const limit=Math.max(1,Math.min(Number(u.searchParams.get('limit'))||100,1000));
      const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['query'],rowLimit:limit},token);
      const rows=(d.rows||[]).map(r=>({query:r.keys?.[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}));
      return json({meta:{site,...dts},rows});
    }
    if(path==='/api/ai/query'){
      const site=u.searchParams.get('site')||defaultSite,q=u.searchParams.get('q');if(!q)return json({error:'q is required'},400);
      const dts=dateRange(u.searchParams.get('days'));
      const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['query','page'],dimensionFilterGroups:[{filters:[{dimension:'query',operator:'equals',expression:q}]}],rowLimit:100},token);
      const rows=(d.rows||[]).map(r=>({query:r.keys?.[0],page:r.keys?.[1],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}));
      return json({meta:{site,q,...dts},rows});
    }
    if(path==='/api/ai/pages'){
      const site=u.searchParams.get('site')||defaultSite,dts=dateRange(u.searchParams.get('days'));
      const limit=Math.max(1,Math.min(Number(u.searchParams.get('limit'))||100,1000));
      const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['page'],rowLimit:limit},token);
      const rows=(d.rows||[]).map(r=>({page:r.keys?.[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}));
      return json({meta:{site,...dts},rows});
    }
    if(path==='/api/ai/opportunities'){
      const site=u.searchParams.get('site')||defaultSite,dts=dateRange(u.searchParams.get('days'));
      const d=await gscPost(site,{startDate:dts.startDate,endDate:dts.endDate,dimensions:['query'],rowLimit:1000},token);
      const minImpressions=Math.max(1,Number(u.searchParams.get('minImpressions'))||20);
      const rows=(d.rows||[]).map(r=>({query:r.keys?.[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}))
        .filter(r=>r.impressions>=minImpressions&&r.position>=4&&r.position<=20)
        .sort((a,b)=>b.impressions-a.impressions).slice(0,100);
      return json({meta:{site,...dts,minImpressions},rows});
    }
    return json({error:'Unknown AI endpoint'},404);
   }
   return json({error:'Not found'},404);
  }catch(e){return json({error:e.message||String(e)},500)}
 }
};