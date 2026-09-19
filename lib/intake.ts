import {env} from 'cloudflare:workers';
export function storage(){if(!env.DB||!env.BUCKET)throw new Error('Storage unavailable');return {db:env.DB,bucket:env.BUCKET};}
// Standalone Cloudflare: enable administration only after verified authentication is implemented.
export async function isOwner(){return false;}
export function textField(value:unknown,max=300){return typeof value==='string'?value.trim().slice(0,max):'';}
export function validContact(name:string,email:string){return name.length>1&&email.length<=250&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);}
export async function checkRequest(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return false;return true;}
export async function rateKey(req:Request){const input=req.headers.get('cf-connecting-ip')||'unknown';const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input+new Date().toISOString().slice(0,10)));return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function limited(key:string){const {db}=storage();const row=await db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE rate_key=? AND created>?').bind(key,Date.now()-3600000).first<{n:number}>();return (row?.n??0)>=10;}
export async function removeSubmission(id:string){const {db,bucket}=storage();const rows=await db.prepare('SELECT key FROM files WHERE submission_id=?').bind(id).all<{key:string}>();if(rows.results.length)await bucket.delete(rows.results.map(x=>x.key));await db.batch([db.prepare('DELETE FROM files WHERE submission_id=?').bind(id),db.prepare('DELETE FROM submissions WHERE id=?').bind(id)]);}
export async function cleanup(){const {db}=storage();const rows=await db.prepare('SELECT id FROM submissions WHERE expires<? LIMIT 20').bind(Date.now()).all<{id:string}>();for(const row of rows.results)await removeSubmission(row.id);}
export const noStore={'Cache-Control':'private, no-store'};
export async function boundedBody(req:Request,max:number){const reader=req.body?.getReader();if(!reader)throw new Error('Empty body');const parts:Uint8Array[]=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new RangeError('Payload too large')}parts.push(value)}const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}return new Request(req.url,{method:'POST',headers:req.headers,body:bytes});}
