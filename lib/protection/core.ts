// Framework/brand-neutral primitives. Dependencies are explicit for later Portal Core extraction.
export class ProtectionError extends Error {
  constructor(public status:number, public code:string, message='Die Sicherheitsprüfung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns telefonisch.') {super(message);}
}
export type ProtectionConfig={mode:'production'|'test';sitekey:string;secret:string;hmac:string;hostnames:string[]};
export const DAY=86400000;
export function field(value:unknown,max:number,required=false,multiline=false):string {
  if(value===undefined||value===null){if(required)throw new ProtectionError(400,'invalid_fields','Bitte vervollständigen Sie Ihre Angaben.');return '';}
  if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)||(!multiline&&/[\r\n]/.test(value)))throw new ProtectionError(400,'invalid_fields','Bitte prüfen Sie Ihre Angaben und deren Länge.');
  const text=value.trim().normalize('NFC');
  if(required&&!text)throw new ProtectionError(400,'invalid_fields','Bitte vervollständigen Sie Ihre Angaben.');
  return text;
}
export function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export async function sha256(value:BufferSource|string){
  const data=typeof value==='string'?new TextEncoder().encode(value):value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function hmac(secret:string,value:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function counter(db:D1Database,scope:string,subject:string,limit:number,period:number,now=Date.now()){
  // One atomic UPSERT counts rejected attempts too. No SELECT-then-INSERT race.
  const window=Math.floor(now/period);
  const row=await db.prepare('INSERT INTO protection_counters(scope,subject,window,hits,expires) VALUES (?,?,?,1,?) ON CONFLICT(scope,subject,window) DO UPDATE SET hits=hits+1 RETURNING hits').bind(scope,subject,window,(window+2)*period).first<{hits:number}>();
  if(!row||row.hits>limit)throw new ProtectionError(429,'rate_limited','Zu viele Versuche. Bitte warten Sie eine Weile oder rufen Sie uns an.');
}
export async function event(db:D1Database,form:string,code:string,now=Date.now()){
  // No IPs, emails, contents, tokens or provider response bodies in security logs.
  await db.prepare('INSERT INTO protection_events(id,form,code,created,expires) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING').bind(form+'|'+code+'|'+Math.floor(now/3600000),form,code,now,now+7*DAY).run();
}
export async function issueTicket(config:ProtectionConfig,form:string,subject:string,now=Date.now()){
  const payload=[form,now.toString(),crypto.randomUUID(),subject].join('|');
  return btoa(payload)+'.'+await hmac(config.hmac,payload);
}
export async function checkTicket(config:ProtectionConfig,ticket:string,form:string,subject:string,now=Date.now()){
  try{
    if(ticket.length>1000)throw Error();
    const [encoded,signature,...rest]=ticket.split('.');const payload=atob(encoded);const parts=payload.split('|');
    if(rest.length||signature!==await hmac(config.hmac,payload)||parts.length!==4||parts[0]!==form||parts[3]!==subject||!/^\d+$/.test(parts[1]))throw Error();
    const age=now-Number(parts[1]);if(age<1500||age>30*60000)throw Error();
  }catch{throw new ProtectionError(403,'invalid_ticket');}
}
export async function verifyBot(config:ProtectionConfig,token:string,action:string,fetcher:typeof fetch=fetch,now=Date.now()){
  if(!token||token.length>2048)throw new ProtectionError(403,'invalid_token');
  let response:Response;
  try{response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json'},
    body:JSON.stringify({secret:config.secret,response:token}),
  });}catch{throw new ProtectionError(503,'bot_unavailable');}
  if(!response.ok)throw new ProtectionError(503,'bot_unavailable');
  let data:{success?:boolean;hostname?:string;action?:string;challenge_ts?:string;'error-codes'?:string[]};
  try{data=await response.json();}catch{throw new ProtectionError(503,'bot_unavailable');}
  if(!data||typeof data.success!=='boolean'||(data.success&&(typeof data.hostname!=='string'||typeof data.action!=='string'||typeof data.challenge_ts!=='string')))throw new ProtectionError(503,'bot_unavailable');
  if(data?.['error-codes']?.some(code=>['internal-error','invalid-input-secret','missing-input-secret'].includes(code)))throw new ProtectionError(503,'bot_unavailable');
  const age=now-Date.parse(data?.challenge_ts||'');
  if(data?.success!==true||!config.hostnames.includes(data.hostname||'')||data.action!==(config.mode==='test'?'test':action)||!Number.isFinite(age)||age< -10000||age>300000)throw new ProtectionError(403,'invalid_token');
}
export async function consumeToken(db:D1Database,token:string,now=Date.now()){
  const row=await db.prepare('INSERT INTO protection_tokens(digest,expires) VALUES (?,?) ON CONFLICT DO NOTHING RETURNING digest').bind(await sha256(token),now+10*60000).first();
  if(!row)throw new ProtectionError(403,'replayed_token');
}
export async function claimJob(db:D1Database,form:string,digest:string,id:string,now=Date.now()){
  const row=await db.prepare("INSERT INTO protection_jobs(id,form,digest,state,created,expires) VALUES (?,?,?,'processing',?,?) ON CONFLICT(form,digest) DO NOTHING RETURNING id").bind(id,form,digest,now,now+DAY).first();
  if(row)return {id,duplicate:false,result:null};
  const previous=await db.prepare('SELECT id,state,result FROM protection_jobs WHERE form=? AND digest=?').bind(form,digest).first<{id:string;state:string;result:string|null}>();
  if(previous?.state==='complete'&&previous.result)return {id:previous.id,duplicate:true,result:JSON.parse(previous.result)};
  throw new ProtectionError(409,'already_processing','Diese Übermittlung wird bereits bearbeitet. Bitte senden Sie sie nicht erneut und wenden Sie sich bei Unklarheiten an uns.');
}
