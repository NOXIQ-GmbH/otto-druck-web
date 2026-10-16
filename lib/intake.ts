import {env} from 'cloudflare:workers';
import {removeStoredSubmission,expireSubmissions} from '@/lib/protection/cleanup';
export function storage(){if(!env.DB||!env.BUCKET)throw new Error('Storage unavailable');return {db:env.DB,bucket:env.BUCKET};}
// Standalone Cloudflare: enable administration only after verified authentication is implemented.
export async function isOwner(){return false;}
export async function checkRequest(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return false;return true;}
export async function removeSubmission(id:string){const {db,bucket}=storage();await removeStoredSubmission(db,bucket,id);}
export async function cleanup(){const {db,bucket}=storage();await expireSubmissions(db,bucket);}
export const noStore={'Cache-Control':'private, no-store'};
export async function boundedBody(req:Request,max:number){const reader=req.body?.getReader();if(!reader)throw new Error('Empty body');const parts:Uint8Array[]=[];let length=0;for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new RangeError('Payload too large')}parts.push(value)}const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}return new Request(req.url,{method:'POST',headers:req.headers,body:bytes});}
