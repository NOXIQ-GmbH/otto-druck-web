import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WEBSITE_INBOX,PUBLIC_REPLY_EMAIL,isUnwantedJobApplication,contactCategory} from '../lib/form-routing.ts';
test('use the definitive website contact address throughout',()=>{
  assert.equal(WEBSITE_INBOX,'webkontakt@otto-druck.de');
  assert.equal(PUBLIC_REPLY_EMAIL,'webkontakt@otto-druck.de');
});
test('identify specific unsolicited applications',()=>{
  assert.equal(isUnwantedJobApplication('name@firemail.de','Ich bewerbe mich als Mitarbeiter.'),true);
  assert.equal(isUnwantedJobApplication('name@firemail.de','Meine Initiativbewerbung'),true);
  assert.equal(isUnwantedJobApplication('name@firemail.de','Lebenslauf im Anhang'),true);
  assert.equal(isUnwantedJobApplication('name@firemail.de','Ich möchte mich bei Ihnen bewerben'),true);
});
test('do not block legitimate print inquiries',()=>{
  assert.equal(isUnwantedJobApplication('kunde@firemail.de','Bitte 500 Flyer kalkulieren'),false);
  assert.equal(isUnwantedJobApplication('kunde@firemail.de','Bewerbungsunterlagen drucken'),false);
  assert.equal(isUnwantedJobApplication('kunde@example.org','Meine Initiativbewerbung'),false);
  assert.equal(isUnwantedJobApplication('kunde@firemail.de.evil.org','Meine Initiativbewerbung'),false);
});
test('categorize complaints',()=>{
  assert.equal(contactCategory('Reklamation zu meiner Bestellung'),'Reklamation');
  assert.equal(contactCategory('Angebot für Flyer erbeten'),'Kontakt');
});
