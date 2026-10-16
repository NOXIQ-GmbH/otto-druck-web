// Browser/UI contract checks. Run with a local dev server; all protection/provider requests are intercepted.
// QA dependencies live outside the application; no real Turnstile, mail or production writes occur.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.env.SPAM_QA_MODULE_ROOT||'/workspace/.onboarding/qa/package.json');
const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
let browser;
const base=process.env.SPAM_UI_BASE||'http://localhost:5174';
const fakeBot=`window.__botCalls=[];window.turnstile={render:function(host,options){window.__botOptions=options;window.__botCalls.push({action:options.action,size:options.size});return String(window.__botCalls.length);},execute:function(id){setTimeout(function(){if(window.__failBot){window.__botOptions['error-callback']();}else{window.__botOptions.callback('fictional-token-'+id);}},50);},remove:function(){}};`;
let count=0;
try{
 for(const viewport of [{width:320,height:800},{width:768,height:1024},{width:1440,height:1000}]){
  browser=await chromium.launch({args:binary.args,executablePath:await binary.executablePath(),headless:true});
  const context=await browser.newContext({viewport});
  const page=await context.newPage();const sent=[];
  page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
  page.on('console',m=>{if(m.type()==='error')console.log('BROWSER ERROR',m.text());});
  await page.route('**/api/formularschutz',r=>r.fulfill({json:{sitekey:'fictional-sitekey',ticket:'fictional-ticket'}}));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',r=>r.fulfill({contentType:'application/javascript',body:fakeBot}));
  for(const form of ['kontakt','anfragen','druckdaten'])await page.route('**/api/'+form,async r=>{
   sent.push({form,body:r.request().postData(),headers:r.request().headers()});
   await r.fulfill({json:form==='kontakt'?{sent:true,confirmationSent:true,id:'test-contact'}:{id:'OD-TEST-123',emailSent:true,scanStatus:'pending_scan'}});
  });
  const visit=async path=>{const ready=page.waitForRequest('**/api/formularschutz');await page.goto(base+path);await ready;};
  await visit('/kontakt');
  await page.locator('input[name=name]').fill('Fiktiver Browserkunde');await page.locator('input[name=email]').fill('test@example.test');await page.locator('textarea[name=message]').fill('Fiktive Nachricht');
  assert.equal(await page.locator('input[name=website]').getAttribute('tabindex'),'-1');
  await page.evaluate(()=>{window.__failBot=true;});
  await page.getByRole('button',{name:/Nachricht direkt senden/}).click();await page.locator('.contact-form .form-status').waitFor();assert.match(await page.locator('.contact-form .form-status').innerText(),/Sicherheitsprüfung/);
  assert.equal(sent.length,0);assert.equal(await page.locator('textarea[name=message]').inputValue(),'Fiktive Nachricht');
  await page.evaluate(()=>{window.__failBot=false;});
  await page.getByRole('button',{name:/Nachricht direkt senden/}).click();await page.locator('.contact-form .form-status').filter({hasText:/zum E-Mail-Versand/}).waitFor();
  assert.equal(sent.length,1);assert.equal(JSON.parse(sent[0].body).token,'fictional-token-2');
  assert.equal((await page.evaluate(()=>window.__botCalls)).length,2);
  count++;console.log('PASS contact retry retains inputs and executes fresh proof:',viewport.width);
  await visit('/anfrage');
  await page.locator('input[name=category][value="Webseite"]').check();await page.getByRole('button',{name:'Weiter'}).click();
  await page.getByText('Neue Website',{exact:true}).click();await page.getByRole('button',{name:'Weiter'}).click();
  await page.getByRole('button',{name:'Weiter'}).click();await page.getByRole('button',{name:'Weiter'}).click();
  assert.equal((await page.evaluate(()=>window.__botCalls||[])).length,0);
  await page.locator('input[name=name]').fill('Fiktiver Browserkunde');await page.locator('input[name=email]').fill('projekt@example.test');await page.locator('input[type=checkbox]').check();
  await page.getByRole('button',{name:'Anfrage absenden'}).click();await page.getByRole('heading',{name:'Ihre Anfrage ist eingegangen.'}).waitFor();
  assert.equal(sent.filter(x=>x.form==='anfragen').length,1);assert.equal((await page.evaluate(()=>window.__botCalls)).length,1);
  count++;console.log('PASS five-step inquiry challenges only final submit:',viewport.width);
  await visit('/druckdaten');
  await page.locator('input[name=name]').fill('Fiktiver Browserkunde');await page.locator('input[name=email]').fill('datei@example.test');
  await page.locator('input[type=file]').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nFiktiv')});
  await page.locator('input[name=privacy]').check();await page.locator('input[name=noAddressData]').check();
  await page.getByRole('button',{name:'Druckdaten übermitteln'}).click();await page.getByRole('heading',{name:'Ihre Dateien sind eingegangen.'}).waitFor();
  const upload=sent.find(x=>x.form==='druckdaten');assert.equal(upload.headers['x-form-token'],'fictional-token-1');assert.equal(upload.headers['x-form-ticket'],'fictional-ticket');
  await page.getByText(/Sie sind noch nicht auf Schadsoftware geprüft/).waitFor();
  count++;console.log('PASS upload proof headers and honest quarantine notice:',viewport.width);
  await browser.close();
 }
 console.log('Browser scenarios passed:',count);
}finally{if(browser?.isConnected())await browser.close();}
