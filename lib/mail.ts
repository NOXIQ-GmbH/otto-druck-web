import {env} from 'cloudflare:workers';
import {WEBSITE_INBOX,PUBLIC_REPLY_EMAIL,contactCategory} from '@/lib/form-routing';
const labels:Record<string,string>={category:'Bedarf',product:'Produkt',quantity:'Auflage',format:'Format',pages:'Seiten',color:'Farbigkeit Vorderseite',printSides:'Bedruckung',backColor:'Farbigkeit Rückseite',material:'Material',grammage:'Grammatur',adhesion:'Haftung',customFormat:'Wunschmaß',orientation:'Ausrichtung',coverMaterial:'Umschlagmaterial',coverGrammage:'Grammatur Umschlag',finishing:'Veredelung',delivery:'Lieferort',dataStatus:'Datenstand',company:'Firma',phone:'Telefon',message:'Weitere Wünsche',reference:'Anfragereferenz',files:'Dateien'};
type Details=Record<string,string>;
export async function sendApplicationRejection(email:string) {
  const config=env as unknown as {BREVO_API_KEY?:string;MAIL_FROM?:string;PUBLIC_CONTACT_EMAIL?:string};
  const from=config.MAIL_FROM||PUBLIC_REPLY_EMAIL;
  const publicReply=config.PUBLIC_CONTACT_EMAIL?.trim()||PUBLIC_REPLY_EMAIL;
  if(!config.BREVO_API_KEY){console.error('Application rejection mail not configured');return false;}
  const textContent=`Guten Tag,

vielen Dank für Ihre Nachricht.

OTTO-Druck nimmt derzeit keine Bewerbungen entgegen. Wir bitten Sie daher, von weiteren Bewerbungen abzusehen.

Sollte es sich bei Ihrer Nachricht nicht um eine Bewerbung, sondern um eine geschäftliche Anfrage handeln, wurde sie möglicherweise versehentlich als Bewerbung erkannt. Bitte senden Sie Ihre Anfrage in diesem Fall von einer anderen, nicht blockierten E-Mail-Adresse direkt an ${publicReply}.

Mit freundlichen Grüßen

OTTO-Druck – eine Marke der NOXIQ GmbH
Meschwitzstraße 1
01099 Dresden
E-Mail: ${publicReply}`;
  try{
    const response=await fetch('https://api.brevo.com/v3/smtp/email',{
      method:'POST',signal:AbortSignal.timeout(10000),
      headers:{'api-key':config.BREVO_API_KEY,'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({sender:{name:'OTTO-Druck',email:from},to:[{email}],replyTo:{email:publicReply},subject:'OTTO-Druck – Hinweis zu Bewerbungen',textContent})
    });
    if(!response.ok){console.error('Application rejection mail rejected',response.status);return false;}
    return true;
  }catch{console.error('Application rejection mail unavailable');return false;}
}

export async function sendIntakeMail(id:string,name:string,email:string,details:Details,kind='Anfrage') {
  const config=env as unknown as {BREVO_API_KEY?:string;MAIL_FROM?:string;WEBSITE_MAIL_TO?:string;PUBLIC_CONTACT_EMAIL?:string;PUBLIC_SITE_URL?:string};
  const from=config.MAIL_FROM||PUBLIC_REPLY_EMAIL;
  const to=config.WEBSITE_MAIL_TO?.trim()||WEBSITE_INBOX;
  const publicReply=config.PUBLIC_CONTACT_EMAIL?.trim()||PUBLIC_REPLY_EMAIL;
  if(!config.BREVO_API_KEY){console.error('Intake mail not configured',id);return {owner:false,customer:false};}
  let base='https://otto-druck-web.noxiq-gmbh.workers.dev';
  if(config.PUBLIC_SITE_URL){try{const u=new URL(config.PUBLIC_SITE_URL);if(u.protocol==='https:')base=u.origin;}catch{}}
  const upload=`${base}/druckdaten?referenz=${encodeURIComponent(id)}`;
  async function send(recipient:string,subject:string,textContent:string,replyTo:string){
    try{
      const response=await fetch('https://api.brevo.com/v3/smtp/email',{
        method:'POST',signal:AbortSignal.timeout(10000),
        headers:{'api-key':config.BREVO_API_KEY!,'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({sender:{name:'OTTO-Druck',email:from},to:[{email:recipient}],replyTo:{email:replyTo},subject,textContent})
      });
      if(!response.ok){console.error('Intake mail rejected',id,response.status);return false;}
      return true;
    }catch{console.error('Intake mail unavailable',id);return false;}
  }
  const customerName=name.replace(/[\r\n\t]+/g,' ').trim();
  const greeting=customerName ? `Guten Tag ${customerName},` : 'Guten Tag,';
  const signature=`Mit besten Grüßen\n\nOtto-Druck (NOXIQ GmbH)\nMeschwitzstraße 1\n01099 Dresden\nMobil: 01 76 – 85 250 200\nTel.: 03 51 – 501 49 04\nE-Mail: ${publicReply}`;
  const summary=Object.entries(details).filter(([key,value])=>value&&!key.startsWith('_')).map(([key,value])=>`${labels[key]||key}: ${value}`).join('\n');
  const [owner,customer]=await Promise.all([
    send(to,`OTTO-Druck [${kind==='Druckdaten'?'Druckdaten':'Angebotsanfrage'}]: ${kind} ${id}`,`Neue ${kind}\nReferenz: ${id}\nName: ${name}\nE-Mail: ${email}\n\n${summary}\n\nDie Angaben wurden gespeichert.`,email),
    send(email,`OTTO-Druck – Ihre Referenz ${id}`,kind==='Anfrage'
      ?`${greeting}\n\nvielen Dank für Ihre Anfrage bei OTTO-Druck.\n\nIhre Referenz: ${id}\n\nWir haben Ihre Anfrage gespeichert und melden uns persönlich bei Ihnen. Dies ist keine Auftragsbestätigung.\n\nDruckdaten noch nicht bereit? Sie können die Dateien später über diesen Link nachreichen:\n${upload}\nBitte verwenden Sie dieselbe E-Mail-Adresse. Wenn Sie keine Druckdaten haben, besprechen wir die Gestaltung mit Ihnen.\n\n${signature}`
      :`${greeting}\n\nvielen Dank. Ihre Druckdaten wurden gespeichert.\n\nUpload-Referenz: ${id}\nAnfragereferenz: ${details.reference||'nicht angegeben'}\n\nEine Druckfreigabe ist damit noch nicht erteilt.\n\n${signature}`,publicReply)
  ]);
  return {owner,customer};
}


export async function sendContactMail(name:string,email:string,details:{company:string;phone:string;message:string}) {
  const config=env as unknown as {BREVO_API_KEY?:string;MAIL_FROM?:string;WEBSITE_MAIL_TO?:string;PUBLIC_CONTACT_EMAIL?:string};
  const from=config.MAIL_FROM||PUBLIC_REPLY_EMAIL;
  const to=config.WEBSITE_MAIL_TO?.trim()||WEBSITE_INBOX;
  const publicReply=config.PUBLIC_CONTACT_EMAIL?.trim()||PUBLIC_REPLY_EMAIL;
  if(!config.BREVO_API_KEY){console.error('Contact mail not configured');return {owner:false,customer:false};}
  async function send(recipient:string,subject:string,textContent:string,replyTo:string){
    try{
      const response=await fetch('https://api.brevo.com/v3/smtp/email',{
        method:'POST',signal:AbortSignal.timeout(10000),
        headers:{'api-key':config.BREVO_API_KEY!,'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({sender:{name:'OTTO-Druck',email:from},to:[{email:recipient}],replyTo:{email:replyTo},subject,textContent})
      });
      if(!response.ok){console.error('Contact mail rejected',response.status);return false;}
      return true;
    }catch{console.error('Contact mail unavailable');return false;}
  }
  const safeName=name.replace(/[\r\n\t]+/g,' ').trim();
  const safeCompany=details.company.replace(/[\r\n\t]+/g,' ').trim();
  const safePhone=details.phone.replace(/[\r\n\t]+/g,' ').trim();
  const safeMessage=details.message.trim();
  const greeting=safeName ? `Guten Tag ${safeName},` : 'Guten Tag,';
  const signature=`Mit besten Grüßen\n\nOTTO-Druck – eine Marke der NOXIQ GmbH\nMeschwitzstraße 1\n01099 Dresden\nMobil: 01 76 – 80 250 200\nTel.: 03 51 – 501 49 04\nE-Mail: ${publicReply}`;
  const ownerText=`Neue Kontaktanfrage über otto-druck.de\n\nName: ${safeName}\nFirma: ${safeCompany||'nicht angegeben'}\nE-Mail: ${email}\nTelefon: ${safePhone||'nicht angegeben'}\n\nNachricht:\n${safeMessage}`;
  const customerText=`${greeting}\n\nvielen Dank für Ihre Nachricht an OTTO-Druck. Wir haben Ihre Anfrage erhalten und melden uns persönlich bei Ihnen.\n\nIhre Nachricht:\n${safeMessage}\n\n${signature}`;
  const [owner,customer]=await Promise.all([
    send(to,`OTTO-Druck [${contactCategory(safeMessage)}]: Neue Kontaktanfrage`,ownerText,email),
    send(email,'OTTO-Druck – Ihre Nachricht ist eingegangen',customerText,publicReply)
  ]);
  return {owner,customer};
}
