# Professionelle Zeiterfassung

Responsive Zeiterfassung für **Valtère Fansi** mit Cloudflare Worker, D1-Datenbank und einer lokalen Offline-Ansicht.

## Enthaltene Funktionen

- Übersicht mit Heute-, Tages-, Monats- und Wochen-Saldo
- Arbeitsrahmen: Datum, Start, Ende, Pause in Stunden sowie Nettozeitberechnung
- Individuelle Sollzeiten je Wochentag
- Abwesenheiten und Projektbudgets mit Status
- Buchungen mit Kategorie, Projekt, Leistung, Dauer, Bemerkung und Jira-Referenz
- Buchungen suchen, bearbeiten, löschen und nach Datum erfassen
- Live-Timer mit Übernahme der gemessenen Dauer
- Kalender für Termine, Aufgaben und Geburtstage mit Ganztägig-Option und Erinnerungsintervall
- Notizen mit Titel, Inhalt und Checkliste
- Auswertung nach Tag, Woche, Monat, Jahr und Kategorie
- Konfigurierbarer PDF-Druckbericht
- CSV-Export mit Zeitraum
- Kategorien, Projekte und Favoriten verwalten
- Datensicherung als JSON
- Login, Registrierung und Abmeldung; Passwörter werden nur als Hash in D1 gespeichert
- Responsive Desktop-/Mobile-Darstellung
- Korrekte Anzeige des Namens **Valtère Fansi**

## Cloudflare

Die Bindings stehen in `wrangler.toml`:

- D1: `DB` → `zeiterfassung-cloud-prod`
- Assets: `ASSETS` → `public`

Migrationen:

```bash
bun install
npx wrangler d1 migrations apply zeiterfassung-cloud-prod --remote
npx wrangler deploy
```

E-Mail-Bestätigung und SMS sind als nächster Integrationspunkt vorbereitet. Dafür müssen bewusst ein E-Mail-/SMS-Anbieter und die zugehörigen Cloudflare-Secrets konfiguriert werden.
