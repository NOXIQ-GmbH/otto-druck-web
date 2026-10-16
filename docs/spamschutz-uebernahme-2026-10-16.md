# OTTO-Druck – Übernahmeprüfung am 16. Oktober 2026

## Stand und GitHub-Abgleich

- Repository: `NOXIQ-GmbH/otto-druck-web`.
- `main` beim erneuten HTTPS-Abgleich: `955427d7ef265f715a0482518390624ff241c0db`.
- Der Spam-Schutz war bereits vollständig im lokalen Commit `5d89c73ccd0bc1c2ad5899f7218bc634f1100922` auf `feat/otto-druck-spamschutz-v1` gesichert. Der Branch war auf GitHub noch nicht vorhanden. Keine neue parallele Implementierung, kein Reset, keine Vermischung mit dem Kundenportal.
- Übernahmecommit ergänzt nur die gezielte Konfigurationsmatrix, entfernt zwei unbenutzte Testimporte, benennt den Wartungsworker-Export für Lint und aktualisiert die Dokumentation. Die bestehende Schutzarchitektur bleibt erhalten.
- Der Nutzer hat den Push des vollständigen Arbeitsbranches ausdrücklich beauftragt. Kein Merge nach `main`, kein produktives Deployment. Die exakte Spitze ist mit `git rev-parse HEAD` und nach Push mit `git ls-remote origin refs/heads/feat/otto-druck-spamschutz-v1` überprüfbar. Beide Commit-SHAs werden im Abschlussbericht genannt.

## Tatsächlich vorhandener Schutz

Serverseitige Siteverify-Prüfung mit Host-, Aktions- und Zeitbindung, Einmal-Tokens, signierte Formulartickets, unsichtbarer Honeypot, strikte Feld-/Produktvalidierung, persistente atomare Rate-Limits einschließlich Ablehnungen, Inhalts-/Upload-Duplikatschutz und Schutz gegen parallelen Doppelversand sind implementiert.

Die fünf Anfrage-Schritte bleiben erhalten; Turnstile läuft erst beim endgültigen Absenden. Das Widget nutzt `appearance=interaction-only` und `execution=execute`, sodass normale erfolgreiche Hintergrundprüfungen keine sichtbare Abfrage erzeugen. Eine von Cloudflare erforderte Interaktion kann angezeigt werden; das Verhalten echter Produktionsschlüssel ist noch im Staging zu prüfen.

Kontaktmitteilungen werden vor dem bestehenden Brevo-Versand gespeichert. Absender und Betreiberziel bleiben `post@otto-druck.de`. Versandclaims und Providerstatus verhindern automatisches Nachsenden nach unbekanntem Ausgang; Kundenbestätigungen sind separat begrenzt. Ein `accepted`-Status belegt Providerannahme, nicht den tatsächlichen Posteingang.

Uploads: fünf Dateien, 20 MiB je Datei, 50 MiB insgesamt. Nachweise vor dem Multipart-Einlesen, sichere Namen, Signaturabgleich und Hashes, private R2-Quarantäne und gesperrte Downloads. Archive werden abgelehnt. **Kein angeschlossener Malware-Scanner**; ungeprüfte Dateien werden nicht freigegeben. Wartungsworker und lokale Migration sind vorbereitet.

## Erneut ausgeführte Prüfungen

| Prüfung | Ergebnis |
|---|---|
| `npm run test:spam` | 31 Tests bestanden, keine Fehler/übersprungenen Tests |
| Browser-Vertragstests | 9 Szenarien bestanden, bei 320, 768 und 1440 Pixeln |
| TypeScript (`--noEmit --incremental false`) | Bestanden |
| `npm run build` | Bestanden |
| Wartungsworker `deploy --dry-run` | Bestanden; keine Bereitstellung |
| Lokaler HTTP-Aufruf ohne Schutzkonfiguration | Kontrolliert HTTP 503 |
| Secret-Prüfung | Keine eingecheckten `.env`/`.dev.vars`; geprüfte Zugangsdatenmuster ohne Treffer, vorhandene Testliterale fiktiv bzw. veröffentlichte Dummywerte |

Die zusätzliche Konfigurationsmatrix prüft fehlendes/deaktiviertes `SPAM_MODE`, fehlenden Sitekey/Secret, zu kurzes HMAC-Secret und falsche Hostnamen für Kontakt, Projektanfrage, Upload und Ticket-Endpunkt. Alle vier Handler liefern 503 ohne Siteverify-Aufruf, Versand, Dateischreiben oder Speicherung eines Vorgangs.

Browser-Szenarien prüfen Eingabeerhalt nach Challengefehler, frischen Token beim Retry, finalen Submit der fünfstufigen Anfrage sowie Upload-Nachweise und Quarantänemeldung. Siteverify/Brevo/R2 werden in den Servertests kontrolliert simuliert; die Browser-Vertragstests simulieren Widget und Submit-Antworten. **Keine Behauptung eines echten Turnstile- oder Brevo-Livetests.**

### Lint-Befunde gegen main abgegrenzt

`npm run lint` bleibt mit **18 Fehlern und 13 Warnungen** rot. Ein unveränderter Export des aktuellen `origin/main` wurde mit denselben installierten ESLint-Abhängigkeiten und denselben Ignorieroptionen separat geprüft: ebenfalls 18 Fehler und 13 Warnungen. Die Fehleranzahl pro Datei und Regel stimmt überein. Keine neue Lint-Regel wurde deaktiviert, keine bestehende Assertion entfernt.

Die 18 bestehenden Fehler betreffen interne `<a>`-Navigation (`app/not-found.tsx`, `app/page.tsx`, `app/verwaltung/page.tsx`, `app/webdesign/page.tsx`, `components/inquiry-form.tsx`, `components/site-chrome.tsx`), synchrones setState in Effekten (`app/druckdaten/page.tsx`, `app/kontakt/page.tsx`, `components/inquiry-form.tsx`) sowie `any` und Reinheitsregeln in der Verwaltungsseite. Die 13 Warnungen bestehen ebenfalls bereits in main. Diese allgemeinen Bestandskorrekturen werden nicht als Spam-Schutzänderung kaschiert. Lint ist ausdrücklich **nicht bestanden**.

## Noch nötige Cloudflare-/Produktionskonfiguration

- Turnstile-Widget/Sitekey für die exakten Produktionshostnamen; `TURNSTILE_SITEKEY` und `TURNSTILE_HOSTNAMES` konfigurieren.
- `TURNSTILE_SECRET_KEY` und zufälliges `SPAM_HMAC_SECRET` (mindestens 32 Zeichen) sicher als Worker-Secrets; `SPAM_MODE=production`. Keine Werte im Repository, Chat oder Commit.
- Bestehendes `BREVO_API_KEY` sicher binden, Absenderverifikation nachweisen und erst dann `MAIL_FROM_VERIFIED=true` setzen. Optional gesetzte `MAIL_FROM`/`MAIL_TO` müssen `post@otto-druck.de` entsprechen; `PUBLIC_SITE_URL` prüfen.
- Tatsächliche `DB`-/`BUCKET`-Bindings und Edge-/WAF-/CSP-Regeln prüfen; additive D1-Migration im freigegebenen Ziel anwenden; Wartungsworker-Zeitplan und Löschung nachweisen.
- Reale Formulare mit kontrollierten Testpersonen/Postfächern prüfen: Turnstile-Host/Aktion, echter Empfang der Brevo-Nachrichten, Uploadquarantäne und Dateisperre. Datenschutzhinweise zur konkreten Widgetkonfiguration abnehmen.

Diese Bindungen konnten in der aktuellen Runtime anhand der Variablennamen nicht als vorhanden bestätigt werden. Live-Kontostände und externe Dienstfunktionen wurden nicht aus Git-Zugriff oder Simulationen abgeleitet.

**Produktive Veröffentlichung: noch nicht bereit/freigegeben.** Insbesondere fehlt der reale Turnstile-/Brevo-Nachweis. Der Stand ist zur GitHub-Review vorbereitet; fehlende Konfiguration sperrt die neuen Formularhandler sicher statt einen Bypass zu aktivieren. Produktiv ist die bisherige Version unverändert. Für sichere Freischaltung und Rückfall siehe [Implementierungsbericht](spamschutz-v1.md).

## Geänderte Dateien gegenüber main

- `app/api/anfragen/route.ts`
- `app/api/druckdaten/route.ts`
- `app/api/formularschutz/route.ts`
- `app/api/kontakt/route.ts`
- `app/api/verwaltung/[id]/route.ts`
- `app/datenschutz/page.tsx`
- `app/druckdaten/page.tsx`
- `app/kontakt/page.tsx`
- `app/verwaltung/page.tsx`
- `cloudflare-env.d.ts`
- `cloudflare/spam-maintenance.ts`
- `cloudflare/spam-maintenance.wrangler.jsonc`
- `components/cookie-consent.tsx`
- `components/form-protection.tsx`
- `components/inquiry-form.tsx`
- `db/schema.ts`
- `docs/spamschutz-uebernahme-2026-10-16.md`
- `docs/spamschutz-v1.md`
- `drizzle/0001_spam_protection.sql`
- `drizzle/meta/0001_snapshot.json`
- `drizzle/meta/_journal.json`
- `lib/intake-config.ts`
- `lib/intake.ts`
- `lib/mail.ts`
- `lib/protection/cleanup.ts`
- `lib/protection/core.ts`
- `lib/protection/files.ts`
- `lib/protection/otto.ts`
- `lib/protection/schemas.ts`
- `package.json`
- `tests/browser-spam.mjs`
- `tests/register.mjs`
- `tests/spam.test.mjs`
- `tests/ts-loader.mjs`
- `tests/worker-bindings.mjs`
