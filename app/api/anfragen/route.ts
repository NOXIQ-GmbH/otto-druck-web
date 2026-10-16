import {newReference} from '@/lib/reference';
import {sendIntakeMail} from '@/lib/mail';
import {validatePrintOptions} from '@/lib/print-options';
import {categories} from '@/lib/intake-config';
import {cleanup,noStore,boundedBody} from '@/lib/intake';
import {begin,protect,reserve,complete,fail} from '@/lib/protection/otto';
import {field,ProtectionError,DAY} from '@/lib/protection/core';
import {object,contact,proofFields,inquiryFields} from '@/lib/protection/schemas';
export async function POST(req:Request){
  try{
    const a=await begin(req,'anfragen');
    const data=object(await (await boundedBody(req,20000)).json(),['name','email','privacy',...inquiryFields,...proofFields]);
    const {name,email}=contact(data);
    const details=Object.fromEntries(inquiryFields.map(k=>[k,field(data[k],k==='message'?4000:k==='phone'?60:500,false,k==='message')]));
    if(data.privacy!==true||!categories[details.category]?.includes(details.product))throw new ProtectionError(400,'invalid_product','Bitte prüfen Sie Bedarf, Produkt und Datenschutzhinweis.');
    for(const key of ['quantity','pages'])if(details[key]&&(!/^\d{1,9}$/.test(details[key])||Number(details[key])<1))throw new ProtectionError(400,'invalid_quantity','Bitte prüfen Sie Auflage und Seitenzahl.');
    const optionError=validatePrintOptions(details);if(optionError)throw new ProtectionError(400,'invalid_options',optionError);
    await protect(a,data);
    await cleanup();
    const job=await reserve(a,{name,email,...details},email,newReference());
    if(job.duplicate)return Response.json(job.result,{headers:noStore});
    const now=Date.now();
    await a.db.prepare('INSERT INTO submissions(id,kind,name,email,details,created,expires,rate_key) VALUES (?,?,?,?,?,?,?,?)').bind(job.id,'Anfrage',name,email,JSON.stringify(details),now,now+90*DAY,a.subject).run();
    const mail=await sendIntakeMail(job.id,name,email,details);
    await a.db.prepare('UPDATE submissions SET details=? WHERE id=?').bind(JSON.stringify({...details,_notification:JSON.stringify(mail)}),job.id).run();
    const result={id:job.id,emailSent:mail.customer,ownerMailAccepted:mail.owner};
    await complete(a,job.id,result);
    return Response.json(result,{headers:noStore});
  }catch(e){return fail(req,'anfragen',e);}
}
