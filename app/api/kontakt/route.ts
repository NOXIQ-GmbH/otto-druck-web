import {sendContactMail} from '@/lib/mail';
import {boundedBody,noStore,cleanup} from '@/lib/intake';
import {begin,protect,reserve,complete,fail} from '@/lib/protection/otto';
import {field,DAY} from '@/lib/protection/core';
import {object,contact,proofFields} from '@/lib/protection/schemas';
export async function POST(req:Request){
  try{
    const a=await begin(req,'kontakt');
    const data=object(await (await boundedBody(req,12000)).json(),['name','email','company','phone','message',...proofFields]);
    const {name,email}=contact(data);
    const details={company:field(data.company,180),phone:field(data.phone,60),message:field(data.message,4000,true,true)};
    await protect(a,data);
    await cleanup();
    const job=await reserve(a,{name,email,...details},email,crypto.randomUUID());
    if(job.duplicate){
      const status=job.result.sent?200:503;
      return Response.json({...job.result,...(status===503?{error:'Ihre Nachricht ist gespeichert. Die E-Mail-Zustellung ist noch nicht bestätigt. Bitte nicht erneut absenden.'}:{})},{status,headers:noStore});
    }
    const now=Date.now();
    await a.db.prepare('INSERT INTO submissions(id,kind,name,email,details,created,expires,rate_key) VALUES (?,?,?,?,?,?,?,?)').bind(job.id,'Kontakt',name,email,JSON.stringify(details),now,now+90*DAY,a.subject).run();
    const sent=await sendContactMail(name,email,details,job.id);
    const result={sent:sent.owner,confirmationSent:sent.customer,id:job.id};
    await complete(a,job.id,result);
    if(!sent.owner)return Response.json({error:'Ihre Nachricht wurde gespeichert, die E-Mail-Zustellung ist jedoch noch nicht bestätigt. Bitte nicht erneut absenden. Kontaktieren Sie uns bei dringenden Anliegen telefonisch.',...result},{status:503,headers:noStore});
    return Response.json(result,{headers:noStore});
  }catch(e){return fail(req,'kontakt',e);}
}
