import {begin,fail} from '@/lib/protection/otto';
import {issueTicket,ProtectionError} from '@/lib/protection/core';
import {boundedBody,noStore} from '@/lib/intake';
import {object} from '@/lib/protection/schemas';
export async function POST(req:Request){
  try{
    const a=await begin(req,'kontakt',true);
    const data=object(await (await boundedBody(req,1000)).json(),['form']);
    if(!['kontakt','anfragen','druckdaten'].includes(String(data.form)))throw new ProtectionError(400,'invalid_form');
    a.form=data.form as 'kontakt'|'anfragen'|'druckdaten';
    return Response.json({sitekey:a.config.sitekey,ticket:await issueTicket(a.config,a.form,a.subject),minimumWaitMs:1500},{headers:noStore});
  }catch(e){return fail(req,'kontakt',e);}
}
