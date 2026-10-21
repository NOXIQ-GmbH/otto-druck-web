import {sendApplicationRejection,sendContactMail} from '@/lib/mail';
import {isUnwantedJobApplication,APPLICATION_REJECTION} from '@/lib/form-routing';
import {textField,validContact,checkRequest,rateKey,limited,noStore,boundedBody} from '@/lib/intake';

export async function POST(req:Request){
  try{
    if(!await checkRequest(req))return Response.json({error:'Ungültiger Ursprung.'},{status:403,headers:noStore});
    if(Number(req.headers.get('content-length'))>12000)return Response.json({error:'Die Nachricht ist zu groß.'},{status:413,headers:noStore});
    const raw=await (await boundedBody(req,12000)).json();
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return Response.json({error:'Ungültige Angaben.'},{status:400,headers:noStore});
    const data=raw as Record<string,unknown>;
    const name=textField(data.name,180);
    const email=textField(data.email,250);
    const company=textField(data.company,180);
    const phone=textField(data.phone,60);
    const message=textField(data.message,4000);
    if(!validContact(name,email)||!message)return Response.json({error:'Bitte ergänzen Sie Name, gültige E-Mail-Adresse und Nachricht.'},{status:400,headers:noStore});
    const key=await rateKey(req);
    if(await limited(key))return Response.json({error:'Zu viele Anfragen. Bitte versuchen Sie es später erneut oder rufen Sie uns an.'},{status:429,headers:noStore});
    if(isUnwantedJobApplication(email,message)){
      await sendApplicationRejection(email);
      return Response.json({error:APPLICATION_REJECTION},{status:422,headers:noStore});
    }
    const sent=await sendContactMail(name,email,{company,phone,message});
    if(!sent.owner)return Response.json({error:'Die Nachricht konnte derzeit nicht versendet werden. Bitte versuchen Sie es erneut oder schreiben Sie an post@otto-druck.de.'},{status:503,headers:noStore});
    return Response.json({sent:true,confirmationSent:sent.customer},{headers:noStore});
  }catch(e){
    if(e instanceof RangeError)return Response.json({error:'Die Nachricht ist zu groß.'},{status:413,headers:noStore});
    console.error('Contact form failed',e);
    return Response.json({error:'Die Nachricht konnte derzeit nicht versendet werden. Bitte versuchen Sie es erneut.'},{status:503,headers:noStore});
  }
}
