import {sendIntakeMail} from '@/lib/mail';
import {storage,removeSubmission,cleanup,noStore,boundedBody} from '@/lib/intake';
import {begin,protect,reserve,complete,fail} from '@/lib/protection/otto';
import {field,ProtectionError,DAY} from '@/lib/protection/core';
import {contact,object} from '@/lib/protection/schemas';
import {inspectFile} from '@/lib/protection/files';
export async function POST(req:Request){
  let pendingId='';let committed=false;
  try{
    const a=await begin(req,'druckdaten');
    if(Number(req.headers.get('content-length'))>52*1024*1024)throw new RangeError();
    await protect(a,{website:req.headers.get('x-form-website'),ticket:req.headers.get('x-form-ticket'),token:req.headers.get('x-form-token')});
    const form=await (await boundedBody(req,52*1024*1024)).formData();
    const allowed=['name','email','privacy','noAddressData','reference','dataStatus','message','files'];
    if([...form.keys()].some(k=>!allowed.includes(k))||allowed.filter(k=>k!=='files').some(k=>form.getAll(k).length>1))throw new ProtectionError(400,'invalid_schema');
    const data=object(Object.fromEntries([...form.entries()].filter(([k])=>k!=='files')),allowed);
    const {name,email}=contact(data);
    if(data.privacy!=='on'||data.noAddressData!=='on')throw new ProtectionError(400,'missing_consent','Bitte bestätigen Sie die Hinweise zu Datenschutz und Adressdaten.');
    const details={reference:field(data.reference,300),dataStatus:field(data.dataStatus,500),message:field(data.message,4000,false,true)};
    const values=form.getAll('files');
    if(!values.length||values.length>5||values.some(f=>!(f instanceof File)||f.size<1||f.size>20*1024*1024)||values.reduce((n,f)=>n+(f instanceof File?f.size:0),0)>50*1024*1024)throw new ProtectionError(400,'file_limits','Bitte wählen Sie 1–5 Dateien, je höchstens 20 MB und insgesamt höchstens 50 MB.');
    const files=[];
    for(const file of values as File[])files.push(await inspectFile(file));
    await cleanup();
    const job=await reserve(a,{name,email,...details,files:files.map(f=>({name:f.name,hash:f.hash})).sort((a,b)=>a.hash.localeCompare(b.hash)||a.name.localeCompare(b.name))},email,crypto.randomUUID());
    if(job.duplicate)return Response.json(job.result,{headers:noStore});
    const {db,bucket}=storage();const now=Date.now();pendingId=job.id;
    const records=files.map(file=>({...file,id:crypto.randomUUID(),key:`quarantine/${job.id}/${crypto.randomUUID()}`}));
    // Record keys before R2 writes so interrupted writes remain discoverable by cleanup.
    await db.batch([
      db.prepare('INSERT INTO submissions(id,kind,name,email,details,created,expires,rate_key) VALUES (?,?,?,?,?,?,?,?)').bind(job.id,'Druckdaten',name,email,JSON.stringify({...details,_uploadState:'writing',_scan:'pending_scan'}),now,now+7*DAY,a.subject),
      ...records.map(f=>db.prepare('INSERT INTO files(id,submission_id,name,size,key,scan_status,content_sha256) VALUES (?,?,?,?,?,?,?)').bind(f.id,job.id,f.name,f.bytes.length,f.key,f.status,f.hash)),
    ]);
    for(const f of records)await bucket.put(f.key,f.bytes,{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{scan_status:'pending_scan',sha256:f.hash}});
    await db.prepare('UPDATE submissions SET details=? WHERE id=?').bind(JSON.stringify({...details,_uploadState:'quarantined',_scan:'pending_scan'}),job.id).run();
    committed=true;
    const mail=await sendIntakeMail(job.id,name,email,{...details,files:records.map(f=>f.name).join(', '),scanStatus:'Quarantäne: nicht auf Schadsoftware geprüft; Verarbeitung und Download gesperrt.'},'Druckdaten');
    await db.prepare('UPDATE submissions SET details=? WHERE id=?').bind(JSON.stringify({...details,_uploadState:'quarantined',_scan:'pending_scan',_notification:JSON.stringify(mail)}),job.id).run();
    const result={id:job.id,scanStatus:'pending_scan'};
    await complete(a,job.id,result);
    return Response.json(result,{headers:noStore});
  }catch(e){
    if(pendingId&&!committed){try{await removeSubmission(pendingId);}catch{/* Recorded keys remain for cleanup. */}}
    return fail(req,'druckdaten',e);
  }
}
