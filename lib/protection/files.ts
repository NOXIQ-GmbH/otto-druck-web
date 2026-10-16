import {ProtectionError,sha256} from './core';
export async function inspectFile(file:File){
  const name=file.name.normalize('NFC');
  if(name.length>180||/[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/.test(name)||name.startsWith('.')||/\.(exe|js|html?|svg|bat|cmd|scr|msi|php|sh|zip|rar|7z|gz|tar)(\.|$)/i.test(name))throw new ProtectionError(400,'unsafe_file','Bitte verwenden Sie PDF-, JPG-, PNG-, AI- oder EPS-Dateien ohne Archive.');
  const ext=name.split('.').pop()?.toLowerCase();
  if(!['pdf','jpg','jpeg','png','ai','eps'].includes(ext||''))throw new ProtectionError(400,'unsafe_file');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const ascii=new TextDecoder('ascii').decode(bytes.slice(0,64));
  const pdf=ascii.startsWith('%PDF-');
  const png=[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)&&new TextDecoder().decode(bytes.slice(12,16))==='IHDR'&&bytes.length>=33;
  const jpeg=bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const ps=ascii.startsWith('%!PS-Adobe-')&&ascii.includes('EPSF-');
  const matches=ext==='pdf'?pdf:ext==='png'?png:ext==='jpg'||ext==='jpeg'?jpeg:ext==='ai'?pdf||ps:ps;
  if(!matches)throw new ProtectionError(400,'signature_mismatch','Dateityp und Dateiinhalt passen nicht zusammen. Bitte prüfen Sie Ihre Druckdateien.');
  // Format recognition is NOT malware scanning. Every accepted file stays blocked.
  return {name,bytes,hash:await sha256(bytes),status:'pending_scan' as const};
}
