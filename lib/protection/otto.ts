import {env} from 'cloudflare:workers';
import {checkRequest,noStore} from '@/lib/intake';
import {ProtectionError,counter,event,hmac,checkTicket,verifyBot,consumeToken,canonical,claimJob,field,DAY} from './core';
import type {ProtectionConfig} from './core';
export type FormKind='kontakt'|'anfragen'|'druckdaten';
export function settings(req:Request):ProtectionConfig{
  const e=env as unknown as Record<string,string|undefined>;
  const local=['localhost','127.0.0.1','[::1]'].includes(new URL(req.url).hostname);
  if(!env.DB||!e.TURNSTILE_SITEKEY||!e.TURNSTILE_SECRET_KEY||!e.SPAM_HMAC_SECRET||e.SPAM_HMAC_SECRET.length<32||!['production','test'].includes(e.SPAM_MODE||''))throw new ProtectionError(503,'not_configured');
  const test=e.SPAM_MODE==='test';
  const dummy=/^[123]x000000000000000000/.test(e.TURNSTILE_SITEKEY)||/^[123]x000000000000000000/.test(e.TURNSTILE_SECRET_KEY);
  if((test&&(!local||!dummy))||(!test&&dummy))throw new ProtectionError(503,'unsafe_configuration');
  const hostnames=(e.TURNSTILE_HOSTNAMES||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!hostnames.length||hostnames.some(h=>!/^[a-z0-9.\-]+$/i.test(h)))throw new ProtectionError(503,'missing_hostnames');
  if(!test&&!hostnames.includes(new URL(req.url).hostname))throw new ProtectionError(503,'unexpected_host');
  return {mode:test?'test':'production',sitekey:e.TURNSTILE_SITEKEY,secret:e.TURNSTILE_SECRET_KEY,hmac:e.SPAM_HMAC_SECRET,hostnames};
}
export async function purgeProtection(db:D1Database){
  const now=Date.now();
  await db.batch(['protection_counters','protection_tokens','protection_jobs','protection_events','mail_deliveries'].map(table=>db.prepare(`DELETE FROM ${table} WHERE expires<?`).bind(now)));
}
export async function begin(req:Request,form:FormKind,bootstrap=false){
  const config=settings(req);const db=env.DB!;
  // CF-Connecting-IP must be supplied by the Cloudflare edge, never trusted via an alternate public proxy.
  const subject=await hmac(config.hmac,'source|'+new Date().toISOString().slice(0,10)+'|'+(req.headers.get('cf-connecting-ip')||'unknown'));
  await purgeProtection(db);
  await counter(db,bootstrap?'tickets':form,subject,bootstrap?60:10,10*60000);
  await counter(db,bootstrap?'tickets_daily':'all_forms',subject,bootstrap?300:30,DAY);
  if(!await checkRequest(req))throw new ProtectionError(403,'origin');
  if(!bootstrap&&form==='druckdaten'){
    await counter(db,'upload_global_burst','all_sources',20,3600000);
    await counter(db,'upload_global_daily','all_sources',100,DAY);
  }
  return {db,config,subject,form};
}
export type Admission=Awaited<ReturnType<typeof begin>>;
export async function protect(a:Admission,proof:Record<string,unknown>){
  if(field(proof.website,200))throw new ProtectionError(403,'honeypot');
  const ticket=field(proof.ticket,1000);
  await checkTicket(a.config,ticket,a.form,a.subject);
  // Upload proof is in headers and is verified before reading even the multipart body.
  const token=field(proof.token,2048);
  await verifyBot(a.config,token,a.form);
  await consumeToken(a.db,a.config.mode==='test'?token+'|'+ticket:token);
}
export async function reserve(a:Admission,data:unknown,email:string,id:string){
  const mailKey=await hmac(a.config.hmac,'email|'+email.toLowerCase());
  await counter(a.db,'recipient_submissions',mailKey,5,DAY);
  const digest=await hmac(a.config.hmac,a.form+'|'+canonical(data));
  return claimJob(a.db,a.form,digest,id);
}
export async function complete(a:Admission,id:string,result:unknown){
  await a.db.prepare("UPDATE protection_jobs SET state='complete',result=? WHERE id=? AND state='processing'").bind(JSON.stringify(result),id).run();
  await event(a.db,a.form,'accepted');
}
export async function fail(req:Request,form:FormKind,error:unknown){
  const known=error instanceof ProtectionError||error instanceof RangeError||error instanceof SyntaxError;
  const status=error instanceof ProtectionError?error.status:error instanceof RangeError?413:error instanceof SyntaxError?400:503;
  const code=error instanceof ProtectionError?error.code:error instanceof RangeError?'body_limit':error instanceof SyntaxError?'invalid_json':'dependency_failure';
  try{if(env.DB)await event(env.DB,form,code);}catch{/* A protection/storage failure stays fail-closed. */}
  if(!known)console.error('Public form dependency failure',form); // Never log the exception/body.
  return Response.json({error:error instanceof ProtectionError?error.message:status===413?'Die Übermittlung ist zu groß.':'Die Übermittlung konnte nicht abgeschlossen werden. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut oder rufen Sie uns an.'},{status,headers:{...noStore,...(status===429?{'Retry-After':'600'}:{})}});
}
