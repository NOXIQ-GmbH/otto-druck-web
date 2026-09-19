# OTTO-Druck Kundenportal

Getrennter Entwicklungsstand für das künftige Kunden- und Auftragsportal von OTTO-Druck.

## Ziel des ersten Ausbaus

- Firmenkonto mit mehreren Ansprechpartnern
- Anmeldung per sicherem Einmal-Link an die E-Mail-Adresse, keine selbst verwalteten Passwörter
- eigene Projekte, Anfragen, Dateien und Nachrichten je Firma
- mehrere Produkte und Auflagen innerhalb eines Projekts
- manuelle Angebots-PDFs und Statuspflege durch OTTO-Druck
- keine öffentliche Preisberechnung und kein Shop

## Strikte Trennung

Dieser Entwicklungsstand wird **nicht** an die bestehende Website-Datenbank `otto-druck-db` und nicht an den bestehenden Upload-Bucket angebunden. Für den Portalbetrieb entstehen später:

- D1-Datenbank: `otto-druck-portal-db`
- privater R2-Bucket: `otto-druck-portal-uploads`
- Worker: `otto-druck-kundenportal`
- zunächst nur eine nicht verlinkte Testadresse unter `workers.dev`; später optional `kunden.otto-druck.de`

## Rollen

| Rolle | Berechtigung |
| --- | --- |
| Kunde | nur Daten der eigenen Firma sehen, Projekte anlegen, Entwürfe bearbeiten, Dateien und Nachrichten verwalten |
| Mitarbeiter | zugewiesene Firmen und Projekte bearbeiten |
| Admin | alle Firmen, Zugänge, Projekte, Angebote und Berechtigungen verwalten |

## Nächste technische Schritte

1. Separate D1-Datenbank und R2-Bucket in Cloudflare anlegen.
2. Magischen E-Mail-Login mit Brevo einrichten.
3. Kundenansicht und geschützte Verwaltungsansicht entwickeln.
4. Mit Testfirmen und Testdateien prüfen.
5. Erst danach Login-Link auf der öffentlichen Website und Subdomain verbinden.
