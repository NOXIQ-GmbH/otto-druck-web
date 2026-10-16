import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {POST as contactRoute} from '../app/api/kontakt/route.ts';
import {POST as inquiryRoute} from '../app/api/anfragen/route.ts';
import {POST as uploadRoute} from '../app/api/druckdaten/route.ts';
import {POST as bootstrapRoute} from '../app/api/formularschutz/route.ts';
import {GET as downloadRoute} from '../app/api/verwaltung/[id]/route.ts';
import {issueTicket,hmac,counter,verifyBot,ProtectionError,claimJob,DAY} from '../lib/protection/core.ts';
import {inspectFile} from '../lib/protection/files.ts';
import {sendContactMail} from '../lib/mail.ts';
import maintenance from '../cloudflare/spam-maintenance.ts';
const nativeFetch=globalThis.fetch;
let sql;
afterEach(()=>{globalThis.fetch=nativeFetch;sql?.close();sql=undefined;});
function fixture(){
 sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 sql.exec(readFileSync(new URL('../drizzle/0000_wonderful_mindworm.sql',import.meta.url),'utf8'));
 sql.exec(readFileSync(new URL('../drizzle/0001_spam_protection.sql',import.meta.url),'utf8'));
 const prepare=query=>{let values=[];const stmt={bind(...args){values=args;return stmt;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){sql.prepare(query).run(...values);return {success:true};}};return stmt;};
 const db={prepare,async batch(statements){sql.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const objects=new Map();
 const bucket={async put(key,value,options){objects.set(key,{value,options});},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])objects.delete(key);},async get(key){return objects.get(key)||null;}};
 const env={DB:db,BUCKET:bucket,SPAM_MODE:'production',SPAM_HMAC_SECRET:'test-only-hmac-secret-which-is-at-least-32-characters',TURNSTILE_SITEKEY:'fake-production-sitekey',TURNSTILE_SECRET_KEY:'fake-production-secret',TURNSTILE_HOSTNAMES:'otto-druck.test',BREVO_API_KEY:'fictional-test-key',MAIL_FROM_VERIFIED:'true'};
 globalThis.__spamEnv=env;
 let botAction='kontakt',mode='ok';const mails=[];const botRequests=[];
 globalThis.fetch=async (url,init)=>{
  if(String(url).includes('/siteverify')){
   const data=JSON.parse(init.body);botRequests.push(data);
   if(mode==='bot-down')throw Error('provider down');
   if(mode==='bot-error')return new Response('broken',{status:503});
   if(mode==='bot-malformed')return Response.json({success:true});
   return Response.json({success:!['invalid','expired','reused'].includes(data.response),hostname:mode==='wrong-host'?'evil.test':'otto-druck.test',action:mode==='wrong-action'?'wrong':botAction,challenge_ts:new Date(Date.now()-(mode==='old-token'?301000:0)).toISOString()});
  }
  if(String(url)==='https://api.brevo.com/v3/smtp/email'){
   mails.push(JSON.parse(init.body));
   if(mode==='mail-down')throw Error('timeout after acceptance');
   return Response.json({messageId:'<fictional-'+mails.length+'>'},{status:mode==='mail-rejected'?400:201});
  }
  throw Error('Unexpected network request');
 };
 return {db,bucket,env,objects,mails,botRequests,setAction(a){botAction=a;},setMode(m){mode=m;}};
}
const origin='https://otto-druck.test';
const ip='192.0.2.10';
async function proof(f,form,overrides={}){
 const subject=await hmac(f.env.SPAM_HMAC_SECRET,'source|'+new Date().toISOString().slice(0,10)+'|'+ip);
 const ticket=await issueTicket({hmac:f.env.SPAM_HMAC_SECRET},form,subject,Date.now()-2000);
 return {ticket,token:crypto.randomUUID(),website:'',...overrides};
}
function request(path,body,headers={}){return new Request(origin+path,{method:'POST',headers:{origin,'cf-connecting-ip':ip,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
async function contact(f,fields={},p={}){f.setAction('kontakt');return contactRoute(request('/api/kontakt',{name:'Testkunde',email:'kunde@example.test',company:'',phone:'',message:'Fiktive Druckanfrage',...fields,...await proof(f,'kontakt',p)}));}
async function upload(f,{file=new File(['%PDF-1.7\nFiktive Testdatei'],'druck.pdf'),proofOverride={},privacy='on',files}={}){
 f.setAction('druckdaten');const p=await proof(f,'druckdaten',proofOverride);const form=new FormData();
 for(const [k,v] of Object.entries({name:'Testkunde',email:'datei@example.test',privacy,noAddressData:'on',reference:'OD-TEST',dataStatus:'PDF vorhanden',message:'Fiktiv'}))form.set(k,v);
 for(const item of files||[file])form.append('files',item);
 return uploadRoute(new Request(origin+'/api/druckdaten',{method:'POST',headers:{origin,'cf-connecting-ip':ip,'x-form-ticket':p.ticket,'x-form-token':p.token,'x-form-website':p.website},body:form}));
}
function rows(table){return sql.prepare('SELECT * FROM '+table).all();}

test('legitimate contact persists before owner + bounded confirmation; provider receives no form contents for bot check',async()=>{
 const f=fixture();const response=await contact(f);assert.equal(response.status,200);assert.equal((await response.json()).sent,true);
 assert.equal(rows('submissions').length,1);assert.equal(f.mails.length,2);assert.equal(f.mails[0].to[0].email,'post@otto-druck.de');assert.equal(f.mails[0].sender.email,'post@otto-druck.de');
 assert.match(f.mails[0].textContent,/Fiktive Druckanfrage/);assert.doesNotMatch(f.mails[1].textContent,/Fiktive Druckanfrage/);
 assert.deepEqual(Object.keys(f.botRequests[0]).sort(),['response','secret']);assert.ok(rows('mail_deliveries').every(x=>x.state==='accepted'));
});
test('five-step project payload is stored once and keeps the reference and print details',async()=>{
 const f=fixture();f.setAction('anfragen');
 const data={name:'Fiktiver Kunde',email:'projekt@example.test',category:'Webseite',product:'Neue Website',privacy:true,message:'Fiktives Projekt'};
 const response=await inquiryRoute(request('/api/anfragen',{...data,...await proof(f,'anfragen')}));assert.equal(response.status,200);
 const body=await response.json();assert.match(body.id,/^OD-/);assert.equal(body.emailSent,true);assert.match(rows('submissions')[0].details,/Neue Website/);
 const repeat=await inquiryRoute(request('/api/anfragen',{...data,...await proof(f,'anfragen')}));assert.equal(repeat.status,200);assert.equal((await repeat.json()).id,body.id);assert.equal(f.mails.length,2);
});
test('missing, invalid, expired, reused and context-mismatched bot proofs fail without mail/storage',async()=>{
 for(const mode of ['invalid','expired','reused','wrong-host','wrong-action','old-token']){
  const f=fixture();f.setMode(mode);const response=await contact(f,{}, {token:['invalid','expired','reused'].includes(mode)?mode:crypto.randomUUID()});assert.equal(response.status,403,mode);assert.equal(f.mails.length,0);assert.equal(rows('submissions').length,0);sql.close();sql=undefined;
 }
});
test('honeypot, forged/too-fast/old tickets and no token are rejected',async()=>{
 const f=fixture();
 for(const p of [{website:'spam'},{ticket:'forged'},{token:''}])assert.equal((await contact(f,{},p)).status,403);
 const subject=await hmac(f.env.SPAM_HMAC_SECRET,'source|'+new Date().toISOString().slice(0,10)+'|'+ip);
 for(const age of [0,31*60000])assert.equal((await contact(f,{}, {ticket:await issueTicket({hmac:f.env.SPAM_HMAC_SECRET},'kontakt',subject,Date.now()-age)})).status,403);
 assert.equal(f.mails.length,0);
});
test('rejected malformed attempts consume persistent limits; direct HTTP and cross-origin requests cannot bypass',async()=>{
 const f=fixture();
 for(let i=0;i<10;i++)assert.equal((await contact(f,{name:[]})).status,400);
 assert.equal((await contact(f)).status,429);assert.equal(f.botRequests.length,0);
 const direct=await contactRoute(request('/api/kontakt',{}, {origin:'https://attacker.test','cf-connecting-ip':'192.0.2.99'}));assert.equal(direct.status,403);
});
test('concurrent rate counter and job claims are atomic',async()=>{
 const f=fixture();const results=await Promise.allSettled(Array.from({length:20},()=>counter(f.db,'parallel','source',5,60000)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,5);assert.equal(rows('protection_counters')[0].hits,20);
 const jobs=await Promise.allSettled(Array.from({length:8},()=>claimJob(f.db,'kontakt','same-content',crypto.randomUUID())));
 assert.equal(jobs.filter(x=>x.status==='fulfilled').length,1);assert.equal(rows('protection_jobs').length,1);
});
test('same token cannot be used twice, including concurrent submissions',async()=>{
 const f=fixture();const p=await proof(f,'kontakt');const data={name:'Testkunde',email:'kunde@example.test',message:'Fiktive Druckanfrage',...p};
 const responses=await Promise.all([contactRoute(request('/api/kontakt',data)),contactRoute(request('/api/kontakt',data))]);
 assert.deepEqual(responses.map(x=>x.status).sort(),[200,403]);assert.equal(f.mails.length,2);
});
test('duplicate content with new bot tokens returns the saved result without more sends',async()=>{
 const f=fixture();const a=await (await contact(f)).json();const b=await (await contact(f)).json();assert.equal(a.id,b.id);assert.equal(f.mails.length,2);assert.equal(rows('submissions').length,1);
});
test('Turnstile outage, HTTP failure and malformed successful response fail closed',async()=>{
 for(const mode of ['bot-down','bot-error','bot-malformed']){const f=fixture();f.setMode(mode);const response=await contact(f);assert.ok([403,503].includes(response.status));assert.equal(f.mails.length,0);assert.equal(rows('submissions').length,0);sql.close();sql=undefined;}
});
test('Brevo timeout is visible, persisted as unknown and never automatically retried',async()=>{
 const f=fixture();f.setMode('mail-down');const response=await contact(f);assert.equal(response.status,503);assert.equal(f.mails.length,1);assert.equal(rows('mail_deliveries')[0].state,'unknown');assert.equal(rows('submissions').length,1);
 f.setMode('ok');assert.equal((await contact(f)).status,503);assert.equal(f.mails.length,1);
});
test('Brevo explicit rejection and unverified sender prevent confirmations and are recorded',async()=>{
 const f=fixture();f.setMode('mail-rejected');assert.equal((await contact(f)).status,503);assert.equal(rows('mail_deliveries')[0].state,'rejected');assert.equal(f.mails.length,1);
 f.env.MAIL_FROM_VERIFIED='false';assert.equal((await contact(f,{message:'Anderer Inhalt'})).status,503);assert.equal(f.mails.length,1);assert.ok(rows('mail_deliveries').some(x=>x.state==='configuration_blocked'));
});
test('unverified recipient cannot receive repeated confirmations or reflected arbitrary messages',async()=>{
 const f=fixture();assert.equal((await contact(f,{message:'Erste Nachricht'})).status,200);assert.equal((await contact(f,{message:'Zweite Nachricht'})).status,200);
 assert.equal(f.mails.filter(m=>m.to[0].email==='kunde@example.test').length,1);assert.equal(f.mails.filter(m=>m.to[0].email==='post@otto-druck.de').length,2);
});
test('parallel notification claims send at most one email per job/audience',async()=>{
 const f=fixture();await Promise.all(Array.from({length:4},()=>sendContactMail('Test','parallel@example.test',{company:'',phone:'',message:'Fiktiv'},'same-job')));
 assert.equal(f.mails.filter(m=>m.to[0].email==='post@otto-druck.de').length,1);assert.ok(f.mails.length<=2);
});
test('strict validation rejects truncation, unknown properties, arrays and header injection',async()=>{
 const f=fixture();for(const fields of [{message:'x'.repeat(4001)},{email:'x@example.test\r\nBcc:y@example.test'},{name:3},{company:['abc']},{extra:'unexpected'}])assert.equal((await contact(f,fields)).status,400);
 assert.equal(f.mails.length,0);
});
test('legitimate upload is privately quarantined, hashes are recorded and downloads stay blocked',async()=>{
 const f=fixture();const response=await upload(f);assert.equal(response.status,200);assert.equal((await response.json()).scanStatus,'pending_scan');
 assert.equal(f.objects.size,1);assert.match([...f.objects.keys()][0],/^quarantine\//);assert.equal(rows('files')[0].scan_status,'pending_scan');assert.equal(rows('files')[0].content_sha256.length,64);
 const id=rows('files')[0].id;assert.equal((await downloadRoute(new Request(origin+'/api/verwaltung/'+id),{params:Promise.resolve({id})})).status,403);
});
test('upload bot proof is checked before request body is read',async()=>{
 const f=fixture();let read=false;const req=new Request(origin+'/api/druckdaten',{method:'POST',headers:{origin,'cf-connecting-ip':ip},body:'not multipart'});
 const original=req.body.getReader.bind(req.body);req.body.getReader=()=>{read=true;return original();};assert.equal((await uploadRoute(req)).status,403);assert.equal(read,false);assert.equal(f.objects.size,0);
});
test('archives, executable names, traversal, double extensions and spoofed signatures are rejected',async()=>{
 const f=fixture();for(const [name,bytes] of [['a.zip','PK\x03\x04'],['a.exe.pdf','%PDF-1.7'],['../a.pdf','%PDF-1.7'],['a.pdf','<script>'],['a.png','%PDF-1.7'],['a.svg','<svg>']]){
  await assert.rejects(()=>inspectFile(new File([bytes],name)),ProtectionError);
 }
 assert.equal(f.objects.size,0);
});
test('R2 failure rolls back tracked files, keeps the job locked and sends no email',async()=>{
 const f=fixture();f.bucket.put=async()=>{throw Error('R2 down');};assert.equal((await upload(f)).status,503);assert.equal(rows('files').length,0);assert.equal(rows('submissions').length,0);assert.equal(f.objects.size,0);assert.equal(f.mails.length,0);assert.equal(rows('protection_jobs')[0].state,'processing');
});
test('cleanup removes expired private objects and rows, including unscanned legacy files',async()=>{
 const f=fixture();await upload(f);sql.prepare('UPDATE submissions SET expires=?').run(Date.now()-1);
 await maintenance.scheduled({},f.env);assert.equal(f.objects.size,0);assert.equal(rows('files').length,0);assert.equal(rows('submissions').length,0);
});
test('test configuration is loopback-only and production rejects dummy keys or missing requirements',async()=>{
 const f=fixture();f.env.SPAM_MODE='test';assert.equal((await contact(f)).status,503);
 f.env.SPAM_MODE='production';f.env.TURNSTILE_SITEKEY='1x00000000000000000000BB';assert.equal((await contact(f)).status,503);
 delete f.env.TURNSTILE_SECRET_KEY;assert.equal((await contact(f)).status,503);assert.equal(f.mails.length,0);
});
test('bootstrap yields no secret and cannot accept unknown form types',async()=>{
 const f=fixture();const response=await bootstrapRoute(request('/api/formularschutz',{form:'anfragen'}));assert.equal(response.status,200);const body=await response.json();assert.ok(body.ticket);assert.equal(body.sitekey,f.env.TURNSTILE_SITEKEY);assert.equal(JSON.stringify(body).includes(f.env.SPAM_HMAC_SECRET),false);
 assert.equal((await bootstrapRoute(request('/api/formularschutz',{form:'unknown'}))).status,400);
});
test('security event records have no personal data, message content or token',async()=>{
 const f=fixture();await contact(f,{}, {website:'spam'});const serialized=JSON.stringify(rows('protection_events'));for(const value of [ip,'kunde@example.test','Fiktive Druckanfrage','spam'])assert.equal(serialized.includes(value),false);
});

test('oversized upload declarations and file-count/size limits reject before storage or email',async()=>{
 const f=fixture();
 const declared=new Request(origin+'/api/druckdaten',{method:'POST',headers:{origin,'cf-connecting-ip':ip,'Content-Length':String(53*1024*1024)},body:'x'});
 assert.equal((await uploadRoute(declared)).status,413);
 f.setAction('druckdaten');const p=await proof(f,'druckdaten');const form=new FormData();
 for(const [k,v] of Object.entries({name:'Testkunde',email:'test@example.test',privacy:'on',noAddressData:'on'}))form.set(k,v);
 for(let i=0;i<6;i++)form.append('files',new File(['%PDF-1.7'],i+'.pdf'));
 const req=new Request(origin+'/api/druckdaten',{method:'POST',headers:{origin,'cf-connecting-ip':ip,'x-form-ticket':p.ticket,'x-form-token':p.token},body:form});
 assert.equal((await uploadRoute(req)).status,400);assert.equal(f.objects.size,0);assert.equal(f.mails.length,0);
});
test('parallel identical uploads create one quarantined submission and at most one notification pair',async()=>{
 const f=fixture();const responses=await Promise.all([upload(f),upload(f)]);
 assert.ok(responses.every(r=>[200,409].includes(r.status)));assert.ok(responses.some(r=>r.status===200));
 assert.equal(rows('submissions').length,1);assert.equal(f.objects.size,1);assert.equal(f.mails.length,2);
});
test('malformed JSON, missing origin and incomplete fields have no side effects',async()=>{
 const f=fixture();
 const bad=new Request(origin+'/api/kontakt',{method:'POST',headers:{origin,'cf-connecting-ip':ip},body:'{broken'});
 assert.equal((await contactRoute(bad)).status,400);
 assert.equal((await contactRoute(new Request(origin+'/api/kontakt',{method:'POST',body:'{}'}))).status,403);
 assert.equal((await contact(f,{email:'',name:''})).status,400);assert.equal(f.mails.length,0);
});
test('provider success without an acknowledgement id stays unknown; re-entry does not resend',async()=>{
 const f=fixture();const wrapped=globalThis.fetch;
 globalThis.fetch=async(url,init)=>String(url).includes('api.brevo.com')?(f.mails.push(JSON.parse(init.body)),Response.json({})):wrapped(url,init);
 assert.equal((await contact(f)).status,503);assert.equal(rows('mail_deliveries')[0].state,'unknown');
 assert.equal((await contact(f)).status,503);assert.equal(f.mails.length,1);
});
test('global upload and operator-mail budgets bound abuse across independent sources',async()=>{
 const f=fixture();
 await counter(f.db,'upload_global_burst','all_sources',20,3600000);
 for(let i=1;i<20;i++)await counter(f.db,'upload_global_burst','all_sources',20,3600000);
 assert.equal((await upload(f)).status,429);assert.equal(f.objects.size,0);
 for(let i=0;i<20;i++)await counter(f.db,'operator_mail_burst','fixed_operator',20,10*60000);
 assert.equal((await contact(f)).status,503);assert.equal(f.mails.length,0);assert.equal(rows('mail_deliveries')[0].state,'rate_blocked');
});
test('local dummy keys still require Siteverify and cannot be used on a public hostname',async()=>{
 const f=fixture();f.env.SPAM_MODE='test';f.env.TURNSTILE_SITEKEY='1x00000000000000000000BB';f.env.TURNSTILE_SECRET_KEY='1x0000000000000000000000000000000AA';f.env.TURNSTILE_HOSTNAMES='localhost';
 const local='http://localhost';const subject=await hmac(f.env.SPAM_HMAC_SECRET,'source|'+new Date().toISOString().slice(0,10)+'|'+ip);
 const ticket=await issueTicket({hmac:f.env.SPAM_HMAC_SECRET},'kontakt',subject,Date.now()-2000);
 let checks=0;const wrapped=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{if(String(url).includes('siteverify')){checks++;return Response.json({success:true,hostname:'localhost',action:'test',challenge_ts:new Date().toISOString()});}return wrapped(url,init);};
 const req=new Request(local+'/api/kontakt',{method:'POST',headers:{origin:local,'cf-connecting-ip':ip},body:JSON.stringify({name:'Lokaler Test',email:'test@example.test',message:'Fiktiv',ticket,token:'XXXX.DUMMY.TOKEN.XXXX'})});
 assert.equal((await contactRoute(req)).status,200);assert.equal(checks,1);
 assert.equal((await contact(f)).status,503);
});

test('a later R2 write failure deletes earlier private writes and leaves no submission/files',async()=>{
 const f=fixture();let writes=0;const put=f.bucket.put;
 f.bucket.put=async(...args)=>{if(++writes===2)throw Error('second write failed');return put(...args);};
 const response=await upload(f,{files:[new File(['%PDF-1.7 a'],'a.pdf'),new File(['%PDF-1.7 b'],'b.pdf')]});
 assert.equal(response.status,503);assert.equal(writes,2);assert.equal(f.objects.size,0);assert.equal(rows('files').length,0);assert.equal(rows('submissions').length,0);assert.equal(f.mails.length,0);
});
test('mail outage after complete upload does not undo quarantined files or change its reference on retry',async()=>{
 const f=fixture();f.setMode('mail-down');const response=await upload(f);assert.equal(response.status,200);const result=await response.json();
 assert.equal(f.objects.size,1);assert.equal(rows('mail_deliveries')[0].state,'unknown');assert.equal(rows('files')[0].scan_status,'pending_scan');
 f.setMode('ok');const retry=await upload(f);assert.equal(retry.status,200);assert.equal((await retry.json()).id,result.id);assert.equal(f.mails.length,1);assert.equal(f.objects.size,1);
});
