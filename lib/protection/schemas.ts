import {field,ProtectionError} from './core';
export const inquiryFields=['category','product','quantity','format','pages','color','printSides','backColor','paper','material','grammage','adhesion','customFormat','orientation','coverMaterial','coverGrammage','finishing','delivery','dataStatus','company','phone','message'];
export function object(raw:unknown,allowed:string[]){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!allowed.includes(k)))throw new ProtectionError(400,'invalid_schema','Bitte prüfen Sie die Formularangaben.');
  return raw as Record<string,unknown>;
}
export function contact(data:Record<string,unknown>){
  const name=field(data.name,180,true),email=field(data.email,250,true).toLowerCase();
  if(name.length<2||!/^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/.test(email))throw new ProtectionError(400,'invalid_contact','Bitte geben Sie Name und eine gültige E-Mail-Adresse an.');
  return {name,email};
}
export const proofFields=['website','ticket','token'];
