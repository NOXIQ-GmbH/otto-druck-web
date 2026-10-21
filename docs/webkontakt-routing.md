# OTTO-DRUCK – Website-Formulareingang ab 21.10.2026

- **Interne Empfangsadresse:** `webkontakt@otto-druck.de` für alle drei Website-Formulare.
- **Öffentliche Adresse:** `post@otto-druck.de` für Antworten, Kontaktangabe, und Brevo-Absender (standardmäßig). Sie wird nicht durch die interne Inbox ersetzt.
- **Optionale Laufzeitvariablen:** `WEBSITE_MAIL_TO` (Website-Empfänger), `PUBLIC_CONTACT_EMAIL` (öffentliche Antwortadresse). Ohne Variable gelten die obenstehenden Werte. Bestehendes `MAIL_TO` wird für Website-Formulare bewusst nicht mehr ausgewertet.
- **Betreffkategorien:** `[Kontakt]`, `[Reklamation]`, `[Angebotsanfrage]`, `[Druckdaten]`. Diese Kategorien können in STRATO-Eingangsregeln verwendet werden.
- **Bewerbungsfilter:** Nachrichten von `firemail.de` werden ausschließlich bei erkennbarer Bewerbungsabsicht vor Versand und Datenspeicherung mit HTTP 422 abgelehnt. Normale Kundenanfragen von derselben Domain bleiben zulässig. Keine automatischen Absage-E-Mails (Backscatter-Schutz).

## Abnahmepunkte
1. Zustellung von Brevo an das neu angelegte STRATO-Postfach sicherstellen.
2. Alle drei Formulare samt Kundenbestätigungen und Betreffkennzeichnung im Zielsystem testen.
3. Cloudflare-Worker-/Dashboard-Konfiguration unabhängig vom Repository prüfen.
4. Gegebenenfalls STRATO-Postfachregeln für die Kennzeichnungen einrichten. Direkt an `post@otto-druck.de` gesandte Mails werden durch den Website-Formularfilter nicht abgefangen.
5. `npm run test:routing` sowie Lint/Build ausführen.

Diese Änderung enthält **kein** Produktivdeployment, keine STRATO-Einstellungen und keine Änderung an bestehenden Cloudflare-Sicherheitsregeln.
