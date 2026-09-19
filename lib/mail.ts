import {env} from 'cloudflare:workers';
const labels:Record<string,string>={category:'Bedarf',product:'Produkt',quantity:'Auflage',format:'Format',pages:'Seiten',color:'Farbigkeit',material:'Material',grammage:'Grammatur',adhesion:'Haftung',customFormat:'Wunschmaß',orientation:'Ausrichtung',coverMaterial:'Umschlagmaterial',coverGrammage:'Grammatur Umschlag',finishing:'Veredelung',delivery:'Lieferort',dataStatus:'Datenstand',company:'Firma',phone:'Telefon',message:'Weitere Wünsche',reference:'Anfragereferenz',files:'Dateien'};
type Details=Record<string,string>;
export async function sendIntakeMail(id:string,name:string,email:string,details:Details,kind='Anfrage') {
  const config=env as unknown as {BREVO_API_KEY?:string;MAIL_FROM?:string;MAIL_TO?:string;PUBLIC_SITE_URL?:string};
  const from=config.MAIL_FROM||'post@otto-druck.de';
  const to=config.MAIL_TO||'post@otto-druck.de';
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
  const signature=`Mit besten Grüßen\n\nOtto-Druck (NOXIQ GmbH)\nMeschwitzstraße 1\n01099 Dresden\nMobil: 01 76 – 85 250 200\nTel.: 03 51 – 501 49 04\nE-Mail: ${to}`;
  const summary=Object.entries(details).filter(([key,value])=>value&&!key.startsWith('_')).map(([key,value])=>`${labels[key]||key}: ${value}`).join('\n');
  const [owner,customer]=await Promise.all([
    send(to,`OTTO-Druck: ${kind} ${id}`,`Neue ${kind}\nReferenz: ${id}\nName: ${name}\nE-Mail: ${email}\n\n${summary}\n\nDie Angaben wurden gespeichert.`,email),
    send(email,`OTTO-Druck – Ihre Referenz ${id}`,kind==='Anfrage'
      ?`${greeting}\n\nvielen Dank für Ihre Anfrage bei OTTO-Druck.\n\nIhre Referenz: ${id}\n\nWir haben Ihre Anfrage gespeichert und melden uns persönlich bei Ihnen. Dies ist keine Auftragsbestätigung.\n\nDruckdaten noch nicht bereit? Sie können die Dateien später über diesen Link nachreichen:\n${upload}\nBitte verwenden Sie dieselbe E-Mail-Adresse. Wenn Sie keine Druckdaten haben, besprechen wir die Gestaltung mit Ihnen.\n\n${signature}`
      :`${greeting}\n\nvielen Dank. Ihre Druckdaten wurden gespeichert.\n\nUpload-Referenz: ${id}\nAnfragereferenz: ${details.reference||'nicht angegeben'}\n\nEine Druckfreigabe ist damit noch nicht erteilt.\n\n${signature}`,to)
  ]);
  return {owner,customer};
}
