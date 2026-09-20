// Curated supplier options checked 2026-09-16. Source register: docs/print-options-sources.md.
// No cartesian product of paper weights: every weight belongs to a specific material/product.
export type Material = {name:string; weights:string[]; adhesion?:string[]; finishes?:string[]};
export type PrintProfile = {formats:string[]; materials:Material[]; colors:string[]; pages?:boolean; note?:string; formatLabel?:string; freeMaterial?:boolean};
export const CUSTOM='Freies Format (auf Anfrage)';
const a4='DIN A4 – 210 × 297 mm', a5='DIN A5 – 148 × 210 mm', a6='DIN A6 – 105 × 148 mm', a7='DIN A7 – 74 × 105 mm', dl='DIN lang – 105 × 210 mm';
const bw='Schwarz/weiß', cmyk='4-farbig (CMYK)', special='Sonderfarben (HKS / Pantone)';
const colors=[bw,cmyk,special];
const paper=(name:string,weights:number[],extra:Partial<Material>={}):Material=>({name,weights:weights.map(w=>`${w} g/m²`),...extra});
const coated=(weights:number[])=>[paper('Bilderdruckpapier matt',weights),paper('Bilderdruckpapier glänzend',weights)];
const letter=[paper('Offsetpapier weiß',[80,90,100,120]),paper('Naturpapier',[90,120]),paper('Recyclingpapier',[80])];
const flyers=[...coated([90,130,170,250,300,400]),paper('Offsetpapier',[80,90,100,120]),paper('Naturpapier',[90,120,160,250]),paper('Recyclingpapier',[80,170,250]),paper('Offsetkarton',[300]),paper('Chromokarton beidseitig gestrichen',[300,450])];
const cards=[...coated([250,300,400]),paper('Naturpapier',[250,300]),paper('Recyclingpapier',[250,300]),paper('Postkartenkarton',[280,350]),paper('Offsetkarton',[300])];
const fold=[...coated([90,130,170,250,300]),paper('Offsetpapier',[80,90,100,120]),paper('Naturpapier',[120,160,250]),paper('Recyclingpapier',[170,250]),paper('Offsetkarton',[300])];
const inside=[...coated([90,115,130,170]),paper('Offsetpapier',[100]),paper('Naturpapier',[90,120,160]),paper('Recyclingpapier',[80,170])];
export const coverMaterials=[...coated([130,170,250,300]),paper('Naturpapier',[160,250]),paper('Recyclingpapier',[170,250])];
const permanent='Permanent haftend (Perm)', removable='Wiederablösbar (Non-Perm)', strong='Stark haftend';
const uv=['UV-Lack matt','UV-Lack glänzend'];
const rolls:Material[]=[paper('Haftpapier beschreibbar',[77],{adhesion:[permanent]}),{name:'PP-Haftfolie weiß glänzend',weights:['60 µm'],adhesion:[permanent,removable]},{name:'PP-Haftfolie transparent glänzend',weights:['50 µm'],adhesion:[permanent,removable]},{name:'PP-Haftfolie weiß mit Perlmutteffekt',weights:['60 µm'],adhesion:[strong]},{name:'PVC-Haftfolie UV-beständig',weights:['100 µm'],adhesion:[removable]}];
const generic:PrintProfile={formats:[CUSTOM],materials:[],colors,pages:false,freeMaterial:true};
export function printProfile(category:string,product:string,format=''):PrintProfile{
 const base={...generic};
 if(product==='Sonstiges'||category==='Sonstiges')return base;
 if(category==='Geschäftsausstattung'){
  if(product==='Visitenkarten')return {formats:['85 × 55 mm','90 × 50 mm',CUSTOM],materials:[...cards,paper('Chromokarton beidseitig gestrichen',[300,450])],colors};
  if(product==='Briefbogen')return {formats:[a4,CUSTOM],materials:letter,colors};
  if(product==='Briefumschläge')return {formats:['DIN lang – 220 × 110 mm','DIN C5 – 229 × 162 mm','DIN C4 – 229 × 324 mm','DIN B4 – 353 × 250 mm','235 × 125 mm','220 × 156 mm',CUSTOM],materials:[{name:'Offsetpapier weiß',weights:[]}],colors,note:'Bitte Fenster, Verschluss und gewünschte Bedruckungsseite unter „Weitere Wünsche“ angeben.'};
  if(product==='Blöcke')return {formats:[a4,a5,a6,a7,dl,CUSTOM],materials:[paper('Offsetpapier',[80,90]),paper('Naturpapier',[90]),paper('Recyclingpapier',[80])],colors,note:'Bitte Blattzahl je Block und Leimkante unter „Weitere Wünsche“ ergänzen.'};
  if(product==='Mappen'){
   const formats=['220 × 306 mm – zwei Laschen','225 × 310 mm – drei Laschen und Gummiband','240 × 310 mm – Einstecktasche','260 × 310 mm – Abheftösen',CUSTOM];
   const materials=!format||format===CUSTOM?[]:format.startsWith('225')?[paper('Chromosulfatkarton matt',[380])]:[paper('Bilderdruckpapier matt',[350])];
   return {formats,materials:materials.map(m=>({...m,finishes:['Cellophanierung matt','Cellophanierung glänzend']})),colors:[cmyk],note:'Mappen für DIN-A4-Unterlagen. Bitte zuerst die Ausführung wählen.'};
  }
 }
 if(category==='Flyer & Werbung'){
  if(product==='Flyer')return {formats:[a4,a5,a6,a7,'DIN A8 – 52 × 74 mm',dl,'DIN A3 – 297 × 420 mm','100 × 100 mm','210 × 210 mm',CUSTOM],materials:flyers,colors};
  if(product==='Falzflyer')return {formats:[a4,a5,a6,a7,dl,'100 × 100 mm','148 × 148 mm','210 × 210 mm',CUSTOM],materials:fold,colors,pages:true,formatLabel:'Geschlossenes Endformat',note:'Bitte Falzart unter „Weitere Wünsche“ ergänzen.'};
  return {formats:[a4,a5,a6,dl,'148 × 148 mm','210 × 210 mm',CUSTOM],materials:cards,colors};
 }
 if(category==='Broschüren')return {formats:[a4,a5,a6,dl,'120 × 120 mm','148 × 148 mm','210 × 210 mm','210 × 280 mm',CUSTOM],materials:inside,colors:[bw,cmyk],pages:true,note:'Material und Grammatur beziehen sich auf den Inhalt. Den Umschlag können Sie separat auswählen.'};
 if(category==='Bücher')return {formats:[a4,a5,a6,CUSTOM],materials:coated([90,100,115]),colors:[bw,cmyk],pages:true,note:'Material und Grammatur beziehen sich auf die Inhaltsseiten. Bitte Einbandwünsche unter „Weitere Wünsche“ beschreiben.'};
 if(category==='Plakate')return {formats:['DIN A3 – 297 × 420 mm','DIN A2 – 420 × 594 mm','DIN A1 – 594 × 841 mm','DIN A0 – 841 × 1189 mm','DIN B2 – 500 × 707 mm','DIN B1 – 707 × 1000 mm',CUSTOM],materials:[...coated([90,115,130,170,250,300]),paper('Affichenpapier (Blueback)',[115])],colors:[bw,cmyk]};
 if(category==='Verpackungen')return {formats:[CUSTOM],materials:product==='Versandverpackung'?[paper('GD-Karton auf B-Welle kaschiert',[230])]:[paper('GC1-Chromokarton weiß',[350]),paper('GZ1-Chromosulfatkarton',[350])],colors:[cmyk],formatLabel:'Verpackungsmaß',note:'Bitte Breite × Höhe × Tiefe und den Inhalt angeben; das passende Stanzformat stimmen wir mit Ihnen ab.'};
 if(product==='Papiertragetasche')return {formats:[CUSTOM],materials:[paper('Kraftpapier braun, Papierkordeln',[100]),paper('Kraftpapier weiß, Papierkordeln',[100]),paper('Bilderdruckpapier folienkaschiert, PP-Kordeln',[170])],colors:[cmyk],note:'Bitte Breite × Höhe × Tiefe der Tasche angeben.'};
 if(category==='Mailing'){
  if(product==='Anschreiben mit Umschlag')return {formats:[a4,CUSTOM],materials:letter,colors,note:'Format und Papier beziehen sich auf das Anschreiben. Umschlag und Beilagen bitte unter „Weitere Wünsche“ nennen.'};
  if(product==='Postkartenmailing')return {formats:[a6,dl,'DIN lang schmal – 98 × 210 mm','235 × 125 mm',CUSTOM],materials:cards,colors:[cmyk]};
  // Supplier page proves formats, not a paper-weight mapping for selfmailers.
  return {formats:[a5,a6,dl,'235 × 125 mm',CUSTOM],materials:[],colors:[cmyk],pages:true};
 }
 if(category==='Aufkleber & Etiketten'){
  if(product==='Rollenetiketten')return {formats:['Rund – Wunschdurchmesser','Rechteckig – Wunschmaß','Oval – Wunschmaß','Freie Kontur – Wunschmaß'],materials:rolls,colors:[cmyk],formatLabel:'Etikettenform',note:'Bitte Maß in mm angeben; bei runden Etiketten den Durchmesser. Klebeuntergrund und Einsatzort helfen uns bei der Materialprüfung.'};
  if(product==='Bogenetiketten')return {formats:[a4,'210 × 146,5 mm','210 × 96,3 mm','103 × 146,5 mm','103 × 96,3 mm','103 × 71,2 mm','49,5 × 71,2 mm','33,6 × 49,5 mm',CUSTOM],materials:[paper('Haftpapier weiß, beschreibbar',[80],{adhesion:[permanent]})],colors, note:'Die Etiketten werden auf DIN-A4-Bögen geliefert. Auflage bitte als Anzahl einzelner Etiketten angeben.'};
  if(product==='Kontursticker')return {formats:['289 × 202 mm','142,5 × 202 mm','202 × 94 mm','99 × 142,5 mm','99 × 94 mm','99 × 69 mm','47,5 × 69 mm','30 × 44,5 mm',CUSTOM],materials:[paper('PVC-Folie weiß glänzend',[135]),paper('PVC-Folie weiß matt',[135])],colors:[cmyk],note:'Freie Kontur innerhalb des gewählten Formats; Lieferung auf DIN-A4-Bögen.'};
 }
 return base;
}
export function finishesFor(data:Record<string,string>):string[]{
 const m=printProfile(data.category,data.product,data.format).materials.find(m=>m.name===data.material);
 if(!m)return [];
 if(['Flyer','Visitenkarten','Postkarten','Einladungen'].includes(data.product)&&m.name.startsWith('Bilderdruckpapier')&&['250 g/m²','300 g/m²','400 g/m²'].includes(data.grammage))return ['UV-Lack glänzend','Cellophanierung matt','Cellophanierung glänzend'];
 if(data.product==='Rollenetiketten'&&data.adhesion===removable)return uv;
 return m.finishes||[];
}
const specKeys=['quantity','format','customFormat','orientation','pages','color','printSides','backColor','paper','material','grammage','adhesion','finishing','coverMaterial','coverGrammage','delivery'];
export function updatePrintData(data:Record<string,string>,key:string,value:string){
 const next={...data,[key]:value};
 if(key==='category'||key==='product') {for(const k of specKeys)delete next[k];if(key==='category')delete next.product;}
 if(key==='printSides')delete next.backColor;
 if(key==='format'){delete next.customFormat;if(data.product==='Mappen'){delete next.material;delete next.grammage;delete next.finishing;}}
 if(key==='material'){delete next.grammage;delete next.adhesion;delete next.finishing;}
 if(key==='adhesion'||key==='grammage')delete next.finishing;
 if(key==='coverMaterial')delete next.coverGrammage;
 return next;
}
export function validatePrintOptions(data:Record<string,string>):string|null{
 const p=printProfile(data.category,data.product,data.format);
 if(data.category==='Geschäftsausstattung'&&['Visitenkarten','Briefbogen'].includes(data.product)){
  if(!['Einseitig','Beidseitig'].includes(data.printSides)||!p.colors.includes(data.color))return 'Bitte wählen Sie Bedruckung und Farbigkeit der Vorderseite.';
  if(data.printSides==='Beidseitig'&&!p.colors.includes(data.backColor))return 'Bitte wählen Sie die Farbigkeit der Rückseite.';
  if(data.printSides==='Einseitig'&&data.backColor)return 'Bei einseitiger Bedruckung bleibt die Rückseite unbedruckt.';
 }else if(data.printSides||data.backColor)return 'Bitte prüfen Sie die Bedruckung für das gewählte Produkt.';
 for(const [key,options] of [['format',p.formats],['color',p.colors]] as const)if(data[key]&&!options.includes(data[key]))return 'Bitte prüfen Sie Format und Farbigkeit für das gewählte Produkt.';
 const m=p.materials.find(m=>m.name===data.material);
 if(data.material&&!m&&!p.freeMaterial)return 'Bitte wählen Sie ein zum Produkt passendes Material.';
 if(data.grammage&&!m?.weights.includes(data.grammage))return 'Bitte wählen Sie eine zum Material passende Grammatur oder Stärke.';
 if(data.adhesion&&!m?.adhesion?.includes(data.adhesion))return 'Bitte prüfen Sie die Haftung für das gewählte Etikettenmaterial.';
 if(data.finishing&&!finishesFor(data).includes(data.finishing))return 'Bitte prüfen Sie die Veredelung für das gewählte Material.';
 const cover=coverMaterials.find(m=>m.name===data.coverMaterial);
 if(data.coverMaterial&&(data.category!=='Broschüren'||!cover))return 'Bitte prüfen Sie das Umschlagmaterial.';
 if(data.coverGrammage&&!cover?.weights.includes(data.coverGrammage))return 'Bitte prüfen Sie die Grammatur des Umschlags.';
 return null;
}
