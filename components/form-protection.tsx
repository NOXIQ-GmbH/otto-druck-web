'use client';
import {useCallback,useEffect,useRef} from 'react';

type Kind='kontakt'|'anfragen'|'druckdaten';
type BotApi={render:(element:HTMLElement,options:Record<string,unknown>)=>string;execute:(id:string)=>void;remove:(id:string)=>void};
declare global {interface Window {turnstile?:BotApi}}
let script:Promise<BotApi>|undefined;
function loadBot(){
  if(window.turnstile)return Promise.resolve(window.turnstile);
  if(!script)script=new Promise<BotApi>((resolve,reject)=>{
    const tag=document.createElement('script');tag.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';tag.async=true;tag.defer=true;
    const timeout=window.setTimeout(()=>{tag.remove();reject(new Error('Die Sicherheitsprüfung ist momentan nicht erreichbar. Bitte versuchen Sie es erneut oder rufen Sie uns an.'));},15000);
    tag.onload=()=>{clearTimeout(timeout);if(window.turnstile)resolve(window.turnstile);else reject(new Error('Die Sicherheitsprüfung konnte nicht geladen werden.'));};
    tag.onerror=()=>{clearTimeout(timeout);tag.remove();reject(new Error('Die Sicherheitsprüfung konnte nicht geladen werden. Bitte prüfen Sie Ihre Verbindung.'));};
    document.head.appendChild(tag);
  }).catch(e=>{script=undefined;throw e;});
  return script;
}
export function useFormProtection(form:Kind){
  const container=useRef<HTMLDivElement>(null);
  const bootstrap=useRef<Promise<{sitekey:string;ticket:string;at:number}>|undefined>(undefined);
  const widget=useRef<string|undefined>(undefined);
  const pending=useRef<(()=>void)|undefined>(undefined);
  const prepare=useCallback(()=>{
    const task=fetch('/api/formularschutz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({form})}).then(async r=>{
      const value=await r.json() as {sitekey:string;ticket:string;error?:string};if(!r.ok)throw new Error(value.error||'Die Sicherheitsprüfung ist derzeit nicht verfügbar.');
      return {...value,at:Date.now()} as {sitekey:string;ticket:string;at:number};
    });
    // A failed early preparation is retried once when the visitor submits.
    task.catch(()=>{if(bootstrap.current===task)bootstrap.current=undefined;});bootstrap.current=task;return task;
  },[form]);
  useEffect(()=>{void prepare().catch(()=>{});return ()=>{pending.current?.();if(widget.current&&window.turnstile)window.turnstile.remove(widget.current);};},[prepare]);
  const proof=async (element:HTMLFormElement)=>{
    let config=await (bootstrap.current||prepare());
    if(Date.now()-config.at>25*60000)config=await prepare();
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,1600-(Date.now()-config.at))));
    const api=await loadBot();
    if(!container.current)throw new Error('Bitte laden Sie das Formular erneut.');
    if(widget.current)api.remove(widget.current);
    const host=container.current;
    const token=await new Promise<string>((resolve,reject)=>{
      let done=false;
      const finish=(value?:string)=>{if(done)return;done=true;clearTimeout(timeout);pending.current=undefined;if(value)resolve(value);else reject(new Error('Die Sicherheitsprüfung ist abgelaufen oder fehlgeschlagen. Bitte versuchen Sie es erneut.'));};
      const timeout=window.setTimeout(()=>finish(),60000);
      pending.current=()=>finish();
      try{
        widget.current=api.render(host,{sitekey:config.sitekey,action:form,execution:'execute',appearance:'interaction-only',size:host.clientWidth<300?'compact':'flexible',retry:'never','refresh-expired':'manual','response-field':false,
          callback:(value:string)=>finish(value),'error-callback':()=>{finish();return true;},'expired-callback':()=>finish(),'timeout-callback':()=>finish(),});
        api.execute(widget.current);
      }catch{finish();}
    });
    bootstrap.current=undefined;
    return {token,ticket:config.ticket,website:String(new FormData(element).get('website')||'')};
  };
  const fields=<><div aria-hidden="true" style={{position:'absolute',left:-10000,width:1,height:1,overflow:'hidden'}}><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" maxLength={200}/></label></div><div ref={container} style={{maxWidth:'100%'}}/><small>Beim Absenden schützt Cloudflare Turnstile dieses Formular vor Missbrauch. <a href="/datenschutz#formularschutz">Datenschutzhinweise</a></small></>;
  return {proof,fields};
}
