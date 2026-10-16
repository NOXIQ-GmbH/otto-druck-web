import {env} from 'cloudflare:workers';
import {counter,hmac,DAY} from '@/lib/protection/core';

const labels:Record<string,string>={category:'Bedarf',product:'Produkt',quantity:'Auflage',format:'Format',pages:'Seiten',color:'Farbigkeit Vorderseite',printSides:'Bedruckung',backColor:'Farbigkeit Rückseite',material:'Material',grammage:'Grammatur',adhesion:'Haftung',customFormat:'Wunschmaß',orientation:'Ausrichtung',coverMaterial:'Umschlagmaterial',coverGrammage:'Grammatur Umschlag',finishing:'Veredelung',delivery:'Lieferort',dataStatus:'Datenstand',company:'Firma',phone:'Telefon',message:'Weitere Wünsche',reference:'Anfragereferenz',files:'Dateien',scanStatus:'Sicherheitsstatus'};
type Details=Record<string,string>;
export async function sendIntakeMail(id:string,name:string,email:string,details:Details,kind='Anfrage') {
  const config=env as unknown as {BREVO_API_KEY?:string;MAIL_FROM?:string;MAIL_TO?:string;PUBLIC_SITE_URL?:string};
  const to='post@otto-druck.de';
  let base='https://otto-druck-web.noxiq-gmbh.workers.dev';
  if(config.PUBLIC_SITE_URL){try{const u=new URL(config.PUBLIC_SITE_URL);if(u.protocol==='https:')base=u.origin;}catch{}}
  const upload=`${base}/druckdaten?referenz=${encodeURIComponent(id)}`;
  const send=delivery(id);
  const greeting='Guten Tag,';
  const signature=`Mit besten Grüßen\n\nOtto-Druck (NOXIQ GmbH)\nMeschwitzstraße 1\n01099 Dresden\nMobil: 01 76 – 85 250 200\nTel.: 03 51 – 501 49 04\nE-Mail: ${to}`;
  const summary=Object.entries(details).filter(([key,value])=>value&&!key.startsWith('_')).map(([key,value])=>`${labels[key]||key}: ${value}`).join('\n');
  const owner=await send('owner',to,`OTTO-Druck: ${kind} ${id}`,`Neue ${kind}\nReferenz: ${id}\nName: ${name}\nE-Mail: ${email}\n\n${summary}\n\nDie Angaben wurden gespeichert.`,email);
  const customer=owner?await send('customer',email,`OTTO-Druck – Ihre Referenz ${id}`,kind==='Anfrage'
      ?`${greeting}\n\nvielen Dank für Ihre Anfrage bei OTTO-Druck.\n\nIhre Referenz: ${id}\n\nWir haben Ihre Anfrage gespeichert und melden uns persönlich bei Ihnen. Dies ist keine Auftragsbestätigung.\n\nDruckdaten noch nicht bereit? Sie können die Dateien später über diesen Link nachreichen:\n${upload}\nBitte verwenden Sie dieselbe E-Mail-Adresse. Wenn Sie keine Druckdaten haben, besprechen wir die Gestaltung mit Ihnen.\n\n${signature}`
      :`${greeting}\n\nvielen Dank. Ihre Druckdaten wurden gespeichert.\n\nUpload-Referenz: ${id}\nEine Druckfreigabe ist damit noch nicht erteilt.\n\n${signature}`,to):false;
  return {owner,customer};
}


export async function sendContactMail(name:string,email:string,details:{company:string;phone:string;message:string},id:string) {
  const to='post@otto-druck.de';
  const send=delivery(id);
  const safeName=name.replace(/[\r\n\t]+/g,' ').trim();
  const safeCompany=details.company.replace(/[\r\n\t]+/g,' ').trim();
  const safePhone=details.phone.replace(/[\r\n\t]+/g,' ').trim();
  const safeMessage=details.message.trim();
  const greeting='Guten Tag,';
  const signature=`Mit besten Grüßen\n\nOTTO-Druck – eine Marke der NOXIQ GmbH\nMeschwitzstraße 1\n01099 Dresden\nMobil: 01 76 – 80 250 200\nTel.: 03 51 – 501 49 04\nE-Mail: ${to}`;
  const ownerText=`Neue Kontaktanfrage über otto-druck.de\n\nName: ${safeName}\nFirma: ${safeCompany||'nicht angegeben'}\nE-Mail: ${email}\nTelefon: ${safePhone||'nicht angegeben'}\n\nNachricht:\n${safeMessage}`;
  const customerText=`${greeting}\n\nvielen Dank für Ihre Nachricht an OTTO-Druck. Wir haben Ihre Anfrage erhalten und melden uns persönlich bei Ihnen.\n\n${signature}`;
  const owner=await send('owner',to,'OTTO-Druck: Neue Kontaktanfrage',ownerText,email);
  const customer=owner?await send('customer',email,'OTTO-Druck – Ihre Nachricht ist eingegangen',customerText,to):false;
  return {owner,customer};
}

// Reuses the existing Brevo transport. Durable claims prevent repeat sends after ambiguous outcomes.
function delivery(id:string){
  return async (audience:'owner'|'customer',recipient:string,subject:string,textContent:string,replyTo:string)=>{
    const e=env as unknown as Record<string,string|undefined>;const db=env.DB;
    if(!db)return false;
    if(!e.BREVO_API_KEY||e.MAIL_FROM_VERIFIED!=='true'||(e.MAIL_FROM&&e.MAIL_FROM!=='post@otto-druck.de')||(e.MAIL_TO&&e.MAIL_TO!=='post@otto-druck.de')){
      const now=Date.now();
      await db.prepare("INSERT INTO mail_deliveries(job_id,audience,state,updated,expires) VALUES (?,?,'configuration_blocked',?,?) ON CONFLICT DO NOTHING").bind(id,audience,now,now+90*DAY).run();
      return false;
    }
    if(/[\r\n]/.test(recipient+subject+replyTo)||!id)return false;
    const now=Date.now();
    const existing=await db.prepare('SELECT state FROM mail_deliveries WHERE job_id=? AND audience=?').bind(id,audience).first<{state:string}>();
    if(existing)return existing.state==='accepted';
    if(audience==='owner'){
      try{
        await counter(db,'operator_mail_burst','fixed_operator',20,10*60000);
        await counter(db,'operator_mail_daily','fixed_operator',200,DAY);
      }catch{
        await db.prepare("INSERT INTO mail_deliveries(job_id,audience,state,updated,expires) VALUES (?,?,'rate_blocked',?,?) ON CONFLICT DO NOTHING").bind(id,audience,now,now+90*DAY).run();
        return false;
      }
    }
    if(audience==='customer'){
      if(!e.SPAM_HMAC_SECRET)return false;
      const key=await hmac(e.SPAM_HMAC_SECRET,'mail|'+recipient.toLowerCase());
      try{
        await counter(db,'confirmation_daily',key,1,DAY);
        await counter(db,'confirmation_weekly',key,3,7*DAY);
      }catch{return false;}
    }
    const claim=await db.prepare("INSERT INTO mail_deliveries(job_id,audience,state,updated,expires) VALUES (?,?,'sending',?,?) ON CONFLICT DO NOTHING RETURNING job_id").bind(id,audience,now,now+90*DAY).first();
    if(!claim)return false;
    let state='unknown',providerId:string|null=null;
    try{
      const response=await fetch('https://api.brevo.com/v3/smtp/email',{
        method:'POST',signal:AbortSignal.timeout(10000),
        headers:{'api-key':e.BREVO_API_KEY,'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({sender:{name:'OTTO-Druck',email:'post@otto-druck.de'},to:[{email:audience==='owner'?'post@otto-druck.de':recipient}],replyTo:{email:replyTo},subject,textContent}),
      });
      if(response.ok){
        const payload=await response.json() as {messageId?:string};
        if(typeof payload.messageId==='string'&&payload.messageId.length<300){state='accepted';providerId=payload.messageId;}
      }else state=response.status>=500?'unknown':'rejected';
    }catch{/* Timeout/connection interruption may occur AFTER provider acceptance. Never retry automatically. */}
    await db.prepare('UPDATE mail_deliveries SET state=?,provider_id=?,updated=? WHERE job_id=? AND audience=?').bind(state,providerId,Date.now(),id,audience).run();
    return state==='accepted';
  };
}
