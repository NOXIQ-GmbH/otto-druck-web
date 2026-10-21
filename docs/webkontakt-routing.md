# OTTO-DRUCK – Website-Formulareingang ab 21.10.2026

- **Interne Empfangsadresse:** `webkontakt@otto-druck.de` für alle drei Website-Formulare.
- **Öffentliche Adresse:** `webkontakt@otto-druck.de` für Antworten, Kontaktangabe und Brevo-Absender (standardmäßig).
- **Verbindliche Website-Adresse:** Empfang, Absender, Antwortadresse und sichtbare Kontaktangaben verwenden `webkontakt@otto-druck.de`. Bestehende Laufzeitvariablen überschreiben diese Festlegung nicht.
- **Betreffkategorien:** `[Kontakt]`, `[Reklamation]`, `[Angebotsanfrage]`, `[Druckdaten]`. Diese Kategorien können in STRATO-Eingangsregeln verwendet werden.
- **Bewerbungsfilter:** Nachrichten von `firemail.de` werden ausschließlich bei erkennbarer Bewerbungsabsicht erkannt. Der Absender erhält den vorgesehenen Hinweis, anschließend wird die Anfrage weder intern weitergeleitet noch als Kundenvorgang gespeichert. Normale Kundenanfragen von derselben Domain bleiben zulässig.

## Abnahmepunkte
1. Zustellung von Brevo an das neu angelegte STRATO-Postfach sicherstellen.
2. Alle drei Formulare samt Kundenbestätigungen und Betreffkennzeichnung im Zielsystem testen.
3. Cloudflare-Worker-/Dashboard-Konfiguration unabhängig vom Repository prüfen.
4. Gegebenenfalls STRATO-Postfachregeln für die Kennzeichnungen einrichten. Direkt an `webkontakt@otto-druck.de` gesandte Mails werden durch den Website-Formularfilter nicht abgefangen.
5. `npm run test:routing` sowie Lint/Build ausführen.

Diese Änderung enthält **kein** Produktivdeployment, keine STRATO-Einstellungen und keine Änderung an bestehenden Cloudflare-Sicherheitsregeln.
