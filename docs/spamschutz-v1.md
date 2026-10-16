# OTTO-DRUCK-SPAMSCHUTZ-V1.0 – Implementierung und Freigabenachweis

Stand: 16. Oktober 2026. Repository: `NOXIQ-GmbH/otto-druck-web`.

**Status: lokal implementiert und geprüft, NICHT produktiv aktiviert.** Es wurde nichts produktiv deployt. Die GitHub-Übernahme erfolgt ausschließlich über den Arbeitsbranch; `main` bleibt unverändert. Live-WAF-Regeln, Turnstile-Einrichtung, Brevo-Absenderverifikation und tatsächliche Zustellung sind nicht nachgewiesen. Keine Freigabe zur Produktionsaktivierung liegt vor.

## 1. Tatsächlicher Ausgangsstand

- HTTPS-Git-Zugriff funktioniert. `main`/lokale Ausgangsbasis: `955427d7ef265f715a0482518390624ff241c0db` (direktes Kontaktformular).
- Weiterer Remote-Branch: `kundenportal-entwicklung`, `afe1e8d3dbbd8dc1b2073bf816d5749e3e1841fc`. Gegenüber `main` älterer, abweichender Stand mit eingebettetem `kundenportal/`, ohne aktuellen Kontakt-Endpunkt; kein geeigneter Ausgangspunkt für die öffentlichen Websiteformulare. Die initiale FETCH_HEAD-Prüfung zeigte nur den ersten Fetch-Eintrag; anschließend wurden die konkreten Branch-SHAs verglichen.
- Bestehende Wege: `/api/kontakt` → Brevo; `/api/anfragen` → D1 + Brevo; `/api/druckdaten` → D1/R2 + Brevo. Originprüfung, begrenztes Body-Einlesen und Zählung erfolgreicher Einträge waren vorhanden. Kontaktversuche wurden dabei nicht gespeichert/gezählt; Dateiendungen waren die einzige Dateitypprüfung. Kein Turnstile, kein persistenter Token-/Doppelversandschutz.
- Konfiguration im Repository: D1 `otto-druck-db`, ID `75a3c772-243a-4705-b80f-339699f2f37e`, R2 `otto-druck-uploads`; Hosting-Bindings `DB` und `BUCKET`. Die Live-Zuordnung ist vor Freigabe im richtigen Cloudflare-Konto zu überprüfen.
- `isOwner()` ist bereits im Ausgangsstand immer `false`: Die Website-Verwaltung ist nicht freigeschaltet. Diese Arbeit führt keine neue Admin-Anmeldung oder öffentliche Downloadfreigabe ein. Unklare Mailzustände müssen bis zu einem separaten Admin-Ausbau autorisiert über D1/Provider geprüft werden.
- In den sichtbaren Runtime-Variablennamen fanden sich keine Turnstile-, SPAM-, Brevo- oder Cloudflare-API-Konfigurationen. Es wurden keine Werte ausgegeben. Vorhandene Plattform-Git-Authentifizierung wurde genutzt. Ein Git-Zugriff beweist keinen Cloudflare- oder Brevo-Zugriff. Cloudflare-Schutzregeln konnten damit nicht authentifiziert gelesen werden; über ihren Live-Zustand wird keine Aussage getroffen.

## 2. Schutzkette und Architektur

`lib/protection/core.ts` ist unabhängig von Marke, React und Worker-Globalumgebung: strikte Felder, kanonische Inhalte, HMAC-Pseudonyme, atomare Zähler, signierte Zeitnachweise, Siteverify, Einmal-Token und Idempotenzreservierung. D1 wird explizit übergeben. `otto.ts`, `schemas.ts`, `files.ts`, `intake-config.ts` und `mail.ts` bilden den OTTO-Druck-Adapter.

Reihenfolge: Konfiguration prüfen → atomare Versuchsgrenzen → Origin → begrenzter Body/Schema (bei Upload zuerst Header-Nachweise) → Honeypot → HMAC-signierter Zeitnachweis → Siteverify → atomarer Tokenverbrauch → Empfängerlimit → eindeutige Inhaltsreservierung → Speicherung → persistente Mailclaims → Ergebnis speichern.

- Alle Versuche nach gültiger Schutzkonfiguration werden gezählt, auch abgewiesene Eingaben/Bot-Nachweise. Schemafehler werden nicht abgeschnitten oder still korrigiert. E-Mail-/Headerfelder lehnen Zeilenumbrüche ab, unbekannte Felder und falsche Typen werden zurückgewiesen. Produktkonfiguration und bisherige Druckoptionen bleiben wirksam.
- Signiertes Formular-Ticket: an Herkunftspseudonym und Formular gebunden, mindestens 1,5 Sekunden alt, höchstens 30 Minuten. Kein Vertrauen in einen vom Browser behaupteten Startzeitpunkt. Turnstile selbst wird erst beim Absenden ausgeführt.
- Siteverify: `success`, erlaubter Hostname, exakte Aktion (`kontakt`, `anfragen`, `druckdaten`), Challenge-Zeit innerhalb 300 Sekunden; 8-Sekunden-Timeout, kein automatischer Wiederholungsversuch. Roh-IP und Formularinhalte werden nicht zusätzlich an Siteverify gesendet. Das Widget verarbeitet eigene Browser-/Verbindungsdaten.
- Tokens: nur SHA-256-Prüfmerkmal, atomarer Einmalverbrauch; Ablauf nach zehn Minuten. Auch parallele Aufrufe dürfen denselben Token nicht zweimal nutzen.
- Duplikate: HMAC über normalisierte vollständige Fachdaten (Uploads einschließlich Inhaltshashes), eindeutiger D1-Index pro Formular für 24 Stunden. Vollständige Wiederholungen liefern das gespeicherte Ergebnis. Gleichzeitig laufende oder unklare Vorgänge bleiben mit 409 gesperrt. Die Referenz wird beibehalten. Andere Daten ergeben einen neuen Vorgang innerhalb der Grenzen.
- Schutzereignisse: erste Ereigniskategorie pro Formular und Stunde, sieben Tage. Keine vollständigen Request-Objekte, Roh-IP, Adressen, Nachrichten, Tokens oder Providerantworten im Log. Die Stichprobenbildung verhindert unbegrenzt viele Einzelereignisse je Angriffsart.
- Voraussetzung für Herkunftsmerkmale: Öffentliche Zugriffe laufen direkt über Cloudflares vertrauenswürdigen Edge, der `CF-Connecting-IP` setzt. Kein Vertrauen auf `X-Forwarded-For`. Fehlende Edge-Adresse wird als gemeinsames `unknown`-Pseudonym begrenzt. Ein alternativer ungeschützter Upstream mit frei setzbarem CF-Header darf nicht öffentlich angeboten werden.

### Feste, überprüfbare Zählfenster

| Regel | Grenze |
|---|---|
| Vorbereitungstickets je Herkunft | 60 / 10 Minuten, 300 / Tag |
| Je Formular und Herkunft, einschließlich Ablehnungen | 10 / 10 Minuten |
| Alle Formulare je Herkunft | 30 / Tag |
| Vorgangsversuche je E-Mail-Pseudonym | 5 / Tag |
| Kundenbestätigung je Empfänger | 1 / Tag und 3 / 7-Tage-Fenster |
| Betreiber-E-Mails insgesamt | 20 / 10 Minuten, 200 / Tag |
| Uploadversuche über alle Herkünfte | 20 / Stunde, 100 / Tag |

Es sind feste Fenster, keine gleitenden Zeiträume. An Fenstergrenzen können aufeinanderfolgende Budgets genutzt werden. Einzel-IP-Adressen sind kein vollständiger DDoS-Schutz; kontoabhängige Edge-/WAF-/Body-Size-Regeln bleiben vor Freigabe zu prüfen. Eine erschöpfte globale Grenze sperrt kontrolliert und kann legitime Nutzer betreffen; Einstellungen anhand freigegebener Nutzungsmengen überprüfen.

## 3. Turnstile-Konfiguration

Keine produktiven Schlüssel im Code oder Browserbundle. Der **öffentliche** Sitekey wird dem Browser über den No-Store-Vorbereitungsendpunkt bereitgestellt; Secret und HMAC-Schlüssel bleiben serverseitig. Testliterale in den Tests sind veröffentlichte Cloudflare-Dummywerte bzw. ausdrücklich fiktive Daten, keine Zugangsdaten.

| Worker-Variable | Einrichtung |
|---|---|
| `SPAM_MODE` | `production` für echten Betrieb; `test` ausschließlich bei Loopback-Hostnamen |
| `TURNSTILE_SITEKEY` | Öffentlicher Sitekey aus dem passenden Cloudflare-Widget |
| `TURNSTILE_SECRET_KEY` | Secret ausschließlich als geschütztes Worker-Secret |
| `TURNSTILE_HOSTNAMES` | Exakte, kommaseparierte freigegebene Hostnamen, ohne Scheme/Port/Wildcard |
| `SPAM_HMAC_SECRET` | Zufälliges Secret mit mindestens 32 Zeichen, sicher generieren und als Worker-Secret setzen |
| `BREVO_API_KEY` | Bestehende sichere Brevo-Bindung weiterverwenden |
| `MAIL_FROM_VERIFIED` | Erst nach echter Brevo-Absender-/Domainprüfung explizit `true` setzen |
| `MAIL_FROM`, `MAIL_TO` | Falls gesetzt, müssen beide `post@otto-druck.de` sein; Versandadresse und Betreiberziel sind im Adapter fest |
| `PUBLIC_SITE_URL` | Freigegebener HTTPS-Ursprung für den bestehenden Upload-Link |

Lokale Provider-Tests: ausschließlich in ignorierter `.dev.vars` konfigurieren; die veröffentlichten Dummy-Sitekeys/-Secrets aus Cloudflares Testdokumentation einsetzen. `SPAM_MODE=test` verweigert öffentliche Hostnamen. Der Testmodus nutzt weiterhin Siteverify und erwartet dessen Testaktionswert `test`; erlaubte Provider-Hostnamen explizit konfigurieren. Da der offizielle Dummy-Token konstant ist, wird sein Einmalverbrauch im lokalen Testmodus zusätzlich an das signierte Ticket gebunden. Im Produktionsmodus gibt es diese Sonderbehandlung nicht; bekannte Dummy-Schlüssel werden dort abgewiesen. **Kein Modus ohne Providerprüfung, kein Produktions-Bypass.**

Bevorzugt Managed Turnstile mit `execution=execute` und `appearance=interaction-only`: normalerweise ohne sichtbare Abfrage, bei Bedarf bedienbar. Ein Invisible-Widget kann nach eigener Konto-/Datenschutzprüfung gewählt werden. Frische Widgetinstanz je Absendeversuch, Timeout/Fehler/Expiry kontrolliert, zugängliche Fehlermeldung und Eingabeerhalt. Kompakte Darstellung unter 300 Pixel Containerbreite. Die Anfrage-Schritte erzeugen keine einzelnen Challenges.

Manuelle Einrichtung vor Freigabe:

1. Richtiges Cloudflare-Konto und tatsächlichen Website-Worker samt D1/R2 prüfen; bestehende Regeln sichern. Keine Umstellung des Kundenportal-Workers.
2. Turnstile-Widget mit ausschließlich tatsächlich genutzten Produktionshostnamen einrichten; localhost nicht für produktive Sitekeys erlauben. Pre-Clearance bleibt aus.
3. Obige Werte sicher im Worker hinterlegen. Schlüsselwerte weder ins Git noch in Tickets/Chat übernehmen. Vorhandene Bindungen wiederverwenden.
4. Falls CSP eingesetzt wird: `script-src` und `frame-src` für `https://challenges.cloudflare.com` gemäß offizieller CSP-Dokumentation prüfen; Sicherheitsregeln nicht pauschal abschalten. Native HTTPS-Zugriffe auf `challenges.cloudflare.com` (Siteverify) und `api.brevo.com` müssen möglich sein.
5. Widget im realen Staging-Formular mit echten Testbedienern prüfen: Erfolg, falscher Host, ungültiger/verbrauchter Token, Timeout, Smartphone und Tablet.

## 4. Persistenz und Brevo

Kontaktmitteilungen werden jetzt ebenfalls vor dem E-Mail-Versand in `submissions` gespeichert. Unklare oder fehlgeschlagene Zustellung liefert sichtbar 503 mit Hinweis auf gespeicherten Eingang und telefonischen Kontakt; keine stille Erfolgsmeldung. Projektanfragen bleiben bei Mailfehlern gespeichert und behalten ihre Referenz. Der Bestätigungshinweis berücksichtigt unterdrückte Bestätigungen.

`mail_deliveries` reserviert jeden Versand pro Vorgang/Zielgruppe atomar **vor** dem Provideraufruf. Zustände: `sending`, `accepted` mit Provider-Nachrichtenkennung, `rejected`, `unknown`, `configuration_blocked`, `rate_blocked`. `accepted` bedeutet vom Provider angenommen, nicht nachweislich im Posteingang zugestellt. Unterdrückte Empfängerbestätigungen sind anhand des Vorgangsergebnisses und der pseudonymen Zähler nachvollziehbar. Betreiberbenachrichtigung zuerst; ohne deren Annahme keine Kundenbestätigung. Der bestehende Brevo-Endpunkt, Absender, feste Betreiberempfänger und Referenz-/Upload-Link-Texte bleiben erhalten. Kundennachrichten werden nicht in die Bestätigung zurückgespiegelt; freie Namen/Referenztexte werden nicht zur steuerbaren Bestätigungsnachricht.

Ein Timeout oder 5xx kann nach Annahme beim Provider auftreten: kein automatisches Nachsenden. Bei `sending`/`unknown` muss der berechtigte Betreiber den konkreten Versand in Brevo/D1 abgleichen. Erst eine separat bestätigte Bearbeitungsentscheidung darf einen erneuten Versand auslösen; hierfür existiert bewusst kein öffentlicher Retry-Endpunkt. Keine unkontrollierte Mail-Queue und kein zweites Versandsystem.

**Reale Brevo-Prüfung ausstehend:** `post@otto-druck.de` und Domainauthentifizierung im Konto bestätigen, bestehenden API-Key wiederverwenden, feste Betreiberzustellung und höchstens eine Kundenbestätigung mit fiktivem Inhalt an kontrollierte Testpostfächer prüfen, Provider-ID sowie tatsächlichen Empfang protokollieren. Testcode sendet keine echten E-Mails.

## 5. Druckdaten und Quarantäne

Grenzen bleiben fünf Dateien, 20 MiB je Datei, 50 MiB insgesamt (Multipart-Body zusätzlich auf 52 MiB begrenzt). Vor dem Einlesen stehen Rate-, Origin-, Ticket- und Botprüfung anhand begrenzter Header. Danach strenge Feldprüfung, sichere Dateinamen, Dateiformaterkennung anhand Signaturen und Inhaltshashes. PDF/JPEG/PNG/AI/EPS werden nur bei passender Signatur angenommen. Das ist **keine** vollständige Parser- oder Malwareprüfung. Archive (ZIP/RAR/7z usw.), ausführbare Doppelendungen und gefährliche Namen werden abgelehnt; ZIP wurde deshalb aus der Auswahl entfernt. Für Archivübertragungen ist ein separat abgestimmter sicherer Weg nötig.

R2-Schlüssel sind zufällig unter `quarantine/`, ohne personenbezogenen Dateinamen. Schlüssel werden vor dem Schreiben in D1 erfasst, damit auch abgebrochene Übertragungen bereinigt werden können. Mehrdateifehler löschen bereits erfasste Objekte; fehlgeschlagene Löschungen bleiben für den nächsten Lauf auffindbar. Erst nach vollständiger Ablage wird der Vorgang als quarantiniert bestätigt. Mailfehler löschen keine vollständig eingegangenen Dateien.

Alle neuen Dateien: `scan_status=pending_scan`. Vorhandene Dateien erhalten `unscanned`. Es gibt **keinen angeschlossenen Scanner** und keinen automatischen Freigabeweg. Downloads bleiben ohne verifizierte Betreiberanmeldung ohnehin gesperrt und prüfen zusätzlich `scan_status=clean` und den Vorgangsablauf. Der neue Code setzt nie `clean`. Keine automatischen Vorschauen, Anhänge oder Weiterverarbeitung.

Neue Quarantäneobjekte laufen nach sieben Tagen ab; bestehende Vorgänge behalten ihre bisherige Frist und bleiben gesperrt. Die UI zeigt den ungeprüften Zustand ausdrücklich. Der separat vorbereitete Worker `cloudflare/spam-maintenance.ts` löscht abgelaufene Objekte vor den Metadaten und räumt Schutzdaten auf; er läuft nach expliziter Bereitstellung alle 15 Minuten (100 Vorgänge/Lauf, bei Fehlern später erneut). Ohne deployten Zeitplan erfolgt nur anlassbezogene Bereinigung – deshalb ist der Scheduler Teil der Aktivierungsbedingungen. Keine Behauptung einer fristgenauen Löschung ohne aktivierten und überwachten Zeitplan.

Offener Scanneranschluss: authentifizierter isolierter Scanner, private Lesezugriffe, Limits gegen Archive/Entpackbomben, SHA-256-Bindung des Ergebnisses an genau das gespeicherte Objekt, fail-closed bei Timeout/unklarem Ergebnis, auditierter Übergang `pending_scan → clean/rejected`, sichere Löschung abgelehnter Objekte und autorisierte Freigabe. Bis dahin findet keine Produktionsübergabe dieser Dateien statt.

## 6. Datenschutz und Bestandsschutz

`app/datenschutz/page.tsx` ergänzt Kontaktpersistenz, Turnstile-Datenverarbeitung, HMAC-Pseudonyme, Schutz-/Versandfristen und ehrliche Quarantäneangaben. Die Einwilligungsanzeige nennt den technisch erforderlichen Formularschutz; Versionswechsel 4 zeigt den geänderten Hinweis erneut. Keine Analyse-/Marketingkategorie wird aktiviert. Vollständige Formulardaten werden nicht zum Botanbieter übertragen. Die konkrete Widgetkonfiguration, Anbietervereinbarungen, Drittlandgarantien und rechtliche Einordnung nach DSGVO/TDDDG müssen vor Live-Freigabe geprüft werden; der Implementierungstest ist keine rechtliche Freigabe.

Aufbewahrung: Kontakt-/Projektvorgänge 90 Tage, neue Quarantäne sieben Tage, Mailstatus 90 Tage, Duplikatreservierung 24 Stunden, Tokenmerkmale zehn Minuten, Schutzereignisse sieben Tage. Zähler höchstens zwei feste Fenster (bis 14 Tage). Bei Ausfällen/backlog bleibt die Löschung bis zum erfolgreichen nächsten Wartungslauf ausstehend und ist zu überwachen. Bestehende Auftragsaufbewahrung bleibt separat.

## 7. Reproduzierbare Prüfungen

Node.js 24 und vorhandene gesperrte Projektabhängigkeiten verwenden:

```sh
npm run test:spam
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config cloudflare/spam-maintenance.wrangler.jsonc --outdir /workspace/otto-druck-web/.sites-runtime/spam-maintenance
```

Die Route-Tests verwenden eine echte SQLite-Datenbank im Speicher als D1-Adapter sowie simuliertes R2, Siteverify und Brevo. Sie prüfen SQL-Eindeutigkeit/Transaktionen und die echten Handler, nicht nur isolierte boolesche Funktionen. Sie ersetzen keine Prüfung des produktiven Cloudflare-Kontos.

Ergebnisse:

- **31/31 Server-Szenarien bestanden:** legitimer Kontakt, fünfstufige Anfragedaten, gültiger Upload, fehlende/ungültige/abgelaufene/wiederverwendete Tokens, Host/Aktion/Zeitabweichung, Honeypot, signierte Zeitgrenzen, direkte/cross-origin HTTP-Aufrufe, abgelehnte Versuche im Zähler, parallele Zähler/Jobs/Tokens/Uploads/Mailclaims, Duplikate, Turnstile-Ausfall, Brevo-Ausfall/Ablehnung/unklare Antwort, unbestätigter Absender, Bestätigungs-/globale Budgets, strikte Schemas/Header-Injection, Uploadgrenzen, Formatfälschung/Archive/Dateinamen, R2-Fehler/Rollback einschließlich Teilübertragung und Dateierhalt bei anschließendem Mailfehler, Quarantäne/Downloads, Löschung, loopbackbeschränkter Testmodus, datensparsame Ereignisse und eine zusätzliche Konfigurationsmatrix über alle öffentlichen Handler.
- **9/9 Browser-Szenarien bestanden:** Kontaktfehler mit Eingabeerhalt und frischem Retry-Token, fünf Schritte ohne Zwischenchallenge und Upload-Header/Quarantäneanzeige, jeweils bei 320×800, 768×1024 und 1440×1000. Headless Chromium; Widget-API und Submit-Antworten kontrolliert simuliert. Keine Aussage über eine echte Turnstile-Challenge oder reale Mailzustellung.
- TypeScript-Prüfung, Website-Produktionsbuild und Wartungsworker-Dry-Run bestanden.
- Neue Migration lokal angewandt. Keine entfernte D1-Migration ausgeführt. Lokaler HTTP-Aufruf ohne Schutzkonfiguration liefert kontrolliert 503, statt E-Mails ohne Prüfung auszulösen.

Browser-Tests werden gegen einen laufenden lokalen Devserver ausgeführt (`npm run dev -- --port 5174`). QA-Abhängigkeiten sind getrennt vom Anwendungs-Lockfile installiert: `playwright-core@1.56.1`, `@sparticuz/chromium@141.0.0`. Der Pfad zum separaten QA-`package.json` wird mit `SPAM_QA_MODULE_ROOT` übergeben; `SPAM_UI_BASE` kann den lokalen Testursprung ersetzen:

```sh
SPAM_QA_MODULE_ROOT=/workspace/.onboarding/qa/package.json node tests/browser-spam.mjs
```

## 8. Aktivierung und Rückfall

Nur nach **ausdrücklicher produktiver Freigabe**:

1. Aktuellen Worker-Artefaktstand und D1/R2 sichern; bestehenden E-Mail-/Telefonkontakt und Rollback-Version prüfen.
2. Bindings, WAF-/Bodygrenzen, Turnstile-Hostname/Modus, Secretbindung, Brevo-Verifikation und Rechtstexte abnehmen. Keine Regel anhand vermuteter Konto-ID ersetzen.
3. Additive Migration `drizzle/0001_spam_protection.sql` im richtigen Staging und anschließend freigegebenen Produktions-D1 einmalig anwenden. Drizzle-Schema, Journal und Snapshot sind beigefügt. Bestehende Datensätze werden nicht gelöscht.
4. Staging-App mit sicherer Konfiguration bereitstellen; alle realen Nachweise aus Abschnitten 3–5 durchführen. Fiktive Daten, kontrollierte Postfächer, keine Kundendateien.
5. Wartungsworker mit den geprüften D1/R2-Bindings bereitstellen, Zeitplan und tatsächliche Löschung einer abgelaufenen Testdatei beweisen. Quarantäne bleibt gesperrt; noch keine Scannerfreigabe behaupten.
6. Website erst nach Abnahme veröffentlichen, Mailzustände, 429/503 und Cleanup überwachen. Alte Website-Version für Rückfall bereithalten. Die additive Migration lässt alte Spalten bestehen, zusätzliche Tabellen müssen für einen Rollback nicht gelöscht werden.
7. Rückfall auf alte Artefakte stellt die früheren, schwächeren Schutzmechanismen wieder her; diesen Schritt nur bewusst autorisiert vornehmen. Nie den neuen Code mit einem allgemeinen Bot-Bypass betreiben. Telefon-/E-Mailkontakt bleibt im Design verfügbar.

Diese Schritte wurden **nicht** ausgeführt; es gab keine eigenmächtige Liveänderung und keine Deaktivierung produktiver Kontaktwege.

## 9. Entwicklungsbranch und Commits

Branch: `feat/otto-druck-spamschutz-v1`. Die Implementierung wird als eigener Commit dokumentiert; die vollständige Kennung steht im abschließenden Prüfprotokoll/Chat und ist mit `git log -1` abrufbar. Keine Übernahme aus dem Kundenportal und keine Änderung am separaten Kundenportal-Repository. Der Folgeauftrag autorisiert den Push dieses Arbeitsbranches zu GitHub. Kein Merge nach `main` und kein Deployment. Der ursprüngliche Implementierungscommit ist `5d89c73ccd0bc1c2ad5899f7218bc634f1100922`; die anschließende Übernahmeprüfung ist separat committet. Alle Commits sind mit `git log origin/main..HEAD` nachvollziehbar. Details und Dateiliste: `docs/spamschutz-uebernahme-2026-10-16.md`.

## 10. Folgeauftrag NOXIQ Portal Core

Eigenen Auftrag anlegen: neutrales Paket für strikte Schemas, signierte Formulartickets, HMAC-Schlüsselrotation, atomare Zähleradapter (D1/Durable Objects), Siteverify-Adapter mit exakter Host-/Aktionsbindung, Idempotenzzustände, datensparsame Ereignisse und Aufbewahrung exportieren. Bestehende Konkurrenz-/Ausfalltests als Paket-Vertragstests übernehmen; Tests gegen echte Cloudflare-Services im getrennten Staging ergänzen. Richtlinien müssen je Mandant injiziert werden. OTTO-Druck-Felder, Referenzen, Limits, Brevo-Texte, Absender/Empfänger und Druckdatenlogik bleiben im Markenadapter. Kein globales Shared-Secret und keine gemeinsamen Personenprofile über Marken. Scanner-/Freigabeintegration, kontrollierte Wiederanstoßung unklarer Mailzustände und zuverlässige Wartungsüberwachung sind gesonderte, authentifizierte Schnittstellen. Keine Übertragung in andere Repositories in diesem Auftrag.

## Quellen

Offizielle Cloudflare-Dokumentation, am 16. Oktober 2026 aus dem offiziellen `cloudflare/cloudflare-docs`-Repository gelesen (direkte Dokumentationswebsite lieferte hier HTTP 403):

- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
- Quellen: https://github.com/cloudflare/cloudflare-docs/tree/production/src/content/docs/turnstile
