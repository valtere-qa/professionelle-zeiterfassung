# Professionelle Zeiterfassung

Vollständige responsive Zeiterfassung für **Valtère Fansi** mit Cloudflare Worker und D1-Datenbank.

## Funktionen

- Registrierung, Anmeldung, Session und Abmeldung
- Zeiterfassungsbuchungen mit CRUD, Dauer, Pause, Kategorie, Projekt und Jira-Referenz
- Kategorien, Projekte und Favoriten
- Einstellungen für Tages- und Wochensollzeit
- Dashboard-Frontend mit Übersicht, Kalender, Wochenfortschritt und Dauer-Auswahl
- API-Client für die Frontend-Anbindung
- D1-Migration und KV-Konfiguration für Cloudflare

## Cloudflare

Die Bindings sind in `wrangler.toml` hinterlegt:

- D1: `DB` → `zeiterfassung-cloud-prod`
- KV: `KV_BINDING`

Migration anwenden:

```bash
npm install
npm run db:migrate
npm run deploy
```
