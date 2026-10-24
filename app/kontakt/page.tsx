"use client";
import {useState,useEffect,FormEvent} from "react";
import {Page} from "@/components/site-chrome";
import {Mail,MapPin,Phone,ArrowRight} from "lucide-react";

export default function Contact(){
  const [message,setMessage]=useState("");
  const [status,setStatus]=useState("");
  const [error,setError]=useState(false);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{const product=new URLSearchParams(window.location.search).get("produkt");if(product)setMessage(`Ich interessiere mich für ${product}.\n\nAuflage:\nFormat:\nWunschtermin:\nWeitere Angaben:`)},[]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy)return;
    const form=e.currentTarget;
    const f=new FormData(form);
    setBusy(true);setStatus("");setError(false);
    try{
      const response=await fetch("/api/kontakt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:f.get("name"),company:f.get("company"),email:f.get("email"),phone:f.get("phone"),message:f.get("message")})});
      const body=await response.json() as {error?:string;confirmationSent?:boolean};
      if(!response.ok)throw new Error(body.error||"Die Nachricht konnte nicht gesendet werden.");
      setStatus(body.confirmationSent===false?"Ihre Nachricht wurde direkt gesendet. Die automatische Bestätigung konnte derzeit nicht zugestellt werden.":"Ihre Nachricht wurde direkt gesendet. Eine Bestätigung wurde an Ihre E-Mail-Adresse verschickt.");
      form.reset();setMessage("");
    }catch(e){
      setError(true);setStatus(e instanceof Error?e.message:"Die Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.");
    }finally{setBusy(false)}
  }
  return <Page image="/assets/contact.webp" eyebrow="Kontakt" title="Was möchten Sie auf den Weg bringen?" intro="Ein paar Eckdaten genügen für den Anfang. Wir besprechen persönlich, welche Lösung zu Ihrem Vorhaben passt."><section className="content-section contact-page"><div className="contact-data"><p className="eyebrow">Lassen Sie uns sprechen</p><h2>Ihr direkter Draht.</h2><a href="tel:+493515014904"><Phone/><span>0351 501 49 04</span></a><a href="tel:+4917685250200"><Phone/><span>0176 85 250 200</span></a><a href="mailto:webkontakt@otto-druck.de"><Mail/><span>webkontakt@otto-druck.de</span></a><p><MapPin/><span>Meschwitzstraße 1<br/>01099 Dresden</span></p><p>Sie wissen noch nicht genau, was Sie benötigen? Rufen Sie uns an oder senden Sie uns Ihre Idee. Wir beraten Sie gern.</p><a className="button yellow" href="/anfrage">Projektanfrage starten</a></div><form onSubmit={submit} className="contact-form"><div className="form-row"><label>Name *<input name="name" autoComplete="name" required maxLength={180}/></label><label>Firma<input name="company" autoComplete="organization" maxLength={180}/></label></div><div className="form-row"><label>E-Mail *<input name="email" type="email" autoComplete="email" required maxLength={250}/></label><label>Telefon<input name="phone" type="tel" autoComplete="tel" maxLength={60}/></label></div><label>Worum geht es? *<textarea name="message" rows={7} required value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} placeholder="Produkt, Auflage, Format, Wunschtermin …"/></label><small>Ihre Angaben werden ausschließlich zur Bearbeitung Ihrer Anfrage verwendet. Mehr dazu in der <a href="/datenschutz">Datenschutzerklärung</a>.</small><button className="button magenta" type="submit" disabled={busy}>{busy?"Wird gesendet …":"Senden"} <ArrowRight size={18}/></button><small>Nach dem Absenden erhalten Sie eine Bestätigung an die angegebene E-Mail-Adresse.</small>{status&&<p className="form-status" role="status" aria-live="polite" data-error={error?"true":"false"}>{status}</p>}</form></section></Page>;
}
