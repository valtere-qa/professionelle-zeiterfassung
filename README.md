# Professionelle Zeiterfassung

Responsive Zeiterfassung für **Valtère Fansi** mit Cloudflare Worker, D1-Datenbank und lokaler Offline-Unterstützung.

## Funktionen

### Arbeitszeit

- Übersicht mit Tages-, Wochen-, Monats- und Jahressaldo
- Arbeitsrahmen mit Datum, Start, Ende und Pause in Stunden
- Tag-/Woche-Ansicht für den Arbeitsrahmen
- Individuelle Sollzeiten je Wochentag
- Abwesenheiten und Projektbudgets mit Status
- Tagesabschluss und Übernahme des letzten Arbeitstags
- Live-Timer mit Übernahme der gemessenen Dauer
- Buchungen mit Kategorie, Projekt, Leistung, Dauer, Bemerkung und Jira-Referenz
- Buchungen sofort nach Erstellen, Bearbeiten oder Löschen aktualisieren
- Suche, Bearbeitung und Löschung von Buchungen

### Kalender und Erinnerungen

- Monatskalender mit Navigation, Heute-Schaltfläche und Agenda
- Tag-/Woche-Agenda
- Termine, Aufgaben und Geburtstage
- Ganztägige Einträge, Ort, Notiz und Erinnerungsintervall
- Browser-Benachrichtigungen mit einmaliger Erinnerung
- ICS-Export für Outlook, Teams und Gerätekalender

### Notizen

- Notizen mit Titel und Inhalt
- Farbmarkierungen: Blau, Grün, Gelb, Rot und Violett
- Checklisten beim Erstellen und Bearbeiten
- Aufgaben hinzufügen, abhaken und einzeln löschen
- Lokale Speicherung sowie D1-Synchronisierung bei Anmeldung

### Exporte und Verwaltung

- CSV-Export für Tag, freien Zeitraum, Monat und Jahr
- PDF-Druckbericht für Tag, freien Zeitraum, Monat und Jahr
- CSV/PDF mit Datum, Kategorie, Projekt, Leistung, Dauer und Bemerkung
- Kategorien, Projekte und Favoriten verwalten
- JSON-Datensicherung und Wiederherstellung
- Authentifizierungs-Untermenü im Profil: Einloggen, Registrierung und Abmelden
- Passwort wird nur als Hash in D1 gespeichert
- Name **Valtère Fansi** und Microsoft-Teams-/Fluent-Design
- Responsive Desktop- und Mobile-Darstellung

## Bedienung

1. Profil unten links öffnen und Einloggen oder Registrierung auswählen.
2. Im Arbeitsrahmen Tag oder Woche wählen und Sollzeit konfigurieren.
3. Eine Buchung mit Kategorie, Projekt und Dauer erfassen.
4. Kalender- und Notizfunktionen über die linke Navigation öffnen.
5. Für Exporte oben CSV oder PDF wählen und den Berichtszeitraum festlegen.
6. Für Browser-Erinnerungen im Kalender „Benachrichtigungen testen“ bestätigen.

## Technische Architektur

- worker.js: Cloudflare Worker, Authentifizierung, API und D1-Zugriff
- public/index.html: Grundlayout, Navigation und Fluent-Design
- public/stable-ui.js: stabile UI-Schicht, Ansichten, Kalender, Notizen, Exporte und Aktualisierung
- public/auth-ui.js: Profil-Untermenü und Authentifizierungsdialog
- public/api.js: API-Client und Session-Verwaltung
- public/extra.js: Buchungserfassung und Synchronisierung
- Die Hauptnavigation wird ausschließlich in `stable-ui.js` verarbeitet. Die alten Routing-Handler in `index.html` und `extra.js` sind entfernt; Buchungsfunktionen aus `extra.js` bleiben erhalten.

## Cloudflare

Die Bindings stehen in wrangler.toml:

- D1: DB → zeiterfassung-cloud-prod
- Assets: ASSETS → public

Migrationen und Deployment:

    bun install
    npx wrangler d1 migrations apply zeiterfassung-cloud-prod --remote
    npx wrangler deploy

E-Mail-Bestätigung und SMS sind als Integrationspunkt dokumentiert, aber erst nach Auswahl eines E-Mail-/SMS-Anbieters und Einrichtung der erforderlichen Cloudflare-Secrets aktivierbar.

## Performance und Reaktionszeit

- Lokale Änderungen werden über ein gebündeltes Storage-Ereignis verarbeitet.
- Mehrfach-Refreshes durch denselben Klick werden zu einem UI-Update zusammengefasst.
- Das frühere 500-ms-Voll-Polling über alle lokalen Daten ist entfernt.
- Änderungen aus anderen Browser-Tabs werden über das Storage-Ereignis erkannt.
- Erinnerungen laufen separat in einem 30-Sekunden-Intervall.
- Navigation verwendet kein künstliches Smooth-Scrolling mehr.

## Kompakte Teams-Darstellung

Die Microsoft-Teams-/Fluent-Oberfläche verwendet eine kompakte Dichte:

- kleinere App-Titel und Überschriften
- kompakte Buttons mit klaren Klickflächen
- reduzierte Eingabefelder und Auswahlfelder
- kleinere Kennzahlenkarten und Abstände
- separate Anpassung für Dialoge, Kalender, Notizen und Mobile
- Bedienbarkeit und Fokusrahmen bleiben erhalten

## Reduzierte App-Skalierung

Auf Desktop wird die App kompakt mit 90 % Skalierung dargestellt, damit mehr Inhalte gleichzeitig sichtbar sind. Auf Mobilgeräten bleibt die Skalierung bei 100 %, damit Touch-Ziele und Lesbarkeit erhalten bleiben.

## Navigation und Darstellung

- Clientseitige Routen: #overview, #entries, #week, #stats, #calendar, #notes, #categories, #favorites, #settings und #help
- Reiter wechseln ohne vollständigen Seitenreload
- Browser-Zurück und Vorwärts werden unterstützt
- Direkte Links auf einzelne Reiter öffnen die passende Ansicht
- Die Übersicht und der gewählte Reiter belegen denselben Inhaltsbereich; sie sind nie gleichzeitig sichtbar.
- Neue Ansichten beginnen sofort am Seitenanfang, ohne animiertes Scrollen zu einem Abschnitt unter der Übersicht.
- Ein erneuter Klick auf den aktiven Reiter erzeugt weder einen zusätzlichen Verlaufseintrag noch einen Neuaufbau des Editors.
- „Zeit erfassen“ wechselt von jedem Reiter zur Übersicht und fokussiert das Eingabeformular.
- Auf schmalen Bildschirmen sind alle zehn Reiter über eine horizontal verschiebbare Navigationsleiste erreichbar.
- Desktop-Darstellung mit reduzierter 90-%-Skalierung; Mobile bleibt bei 100 %

## Tagesbuchungen mit Pagination

Die Tagesliste zeigt die heutigen Buchungen in übersichtlichen Seiten. Die Suche filtert nur die heutigen Buchungen und setzt die aktuelle Seite zurück; über „Zurück“ und „Weiter“ werden weitere Einträge geladen.

## Authentifizierung und Sitzung

- Profil-Untermenü mit getrennten Aktionen „Einloggen“, „Registrierung“ und „Ausloggen“
- Nach dem Ausloggen wird die App geschlossen und automatisch das Anmeldefenster geöffnet.
- Nach erfolgreicher Anmeldung wird die App wieder freigeschaltet und die persönliche Sitzung geladen.
- Passwörter werden serverseitig nur als Hash in D1 gespeichert.

## Kalender-Details

- Eintragsarten: Termin, Aufgabe und Geburtstag
- Persönliche Erinnerung pro Eintrag: Minuten, Stunden, Tage oder Wochen
- Ganztägige Einträge sowie Beginn, Ende, Ort und Notiz
- Kalenderansicht für Tag und Woche mit Monatsnavigation
- Einträge können erstellt, bearbeitet und gelöscht werden
- Mobile Ansicht mit touch-freundlichen Kalenderzellen, Agenda und Dialogfeldern

## OneNote-Notizbereiche

- Bereich-Tabs: Alle Bereiche, Arbeit, Privat und Organisation
- Notizliste mit Suche, Farbfilttern und aktiver Auswahl
- Editor mit Titel, Inhalt, Farbe, Bereich und Checkliste
- Checklistenaufgaben können hinzugefügt, abgehakt und einzeln gelöscht werden
- Bereiche werden lokal und bei aktiver Anmeldung mit D1 synchronisiert
## Routing-Korrektur und Tests – 8. September 2026

Ursache: `#dynamic` wurde unter allen weiterhin sichtbaren Übersichtskarten aufgebaut. Das Entfernen von `scrollIntoView()` allein änderte daran nichts. Zusätzlich existierten drei konkurrierende Navigationsimplementierungen.

Die Übersicht hat jetzt einen eigenen Container `#overviewView`. Ein einziger Router schaltet diesen Container und `#dynamic` gegenseitig um. Ein gebündeltes Daten-Update bleibt auf der aktuellen Route; ausstehende Updates werden beim Ansichtenwechsel berücksichtigt. Der Tag-/Woche-Schalter verwendet jetzt alle Schaltflächen statt einer einzelnen DOM-Referenz.

UI-Kennung dieser Änderung: `stable-ui.js?v=20260908-39`, `auth-ui.js?v=20260908-9` und `extra.js?v=20260908-27`. Die URL der veröffentlichten App ist [Professionelle Zeiterfassung](https://professionelle-zeiterfassung.vafa-qa-engineering.workers.dev/).

Tests lokal ausführen (Node.js 18 oder neuer):

```sh
npm install
npm test
```

`tests/routing.test.cjs` führt die echte HTML-Datei mit allen eingebundenen App-Skripten in jsdom aus. Getestet werden alle zehn Reiter, Direktlinks, URL-Normalisierung, Browser-Verlauf, wiederholte Klicks, Notizentwürfe beim erneuten Öffnen desselben Reiters, „Zeit erfassen“, Daten-Aktualisierung, Tag-/Woche-Umschaltung und die Sichtbarkeit der Ansichten. Netzwerkanfragen sind simuliert; keine produktiven Daten werden verändert.

Ergebnis am 8. September 2026: **37 Tests bestanden, 0 fehlgeschlagen**. Die mobile Navigation wird zusätzlich anhand ihrer CSS-Regeln und mit simulierten Abmessungen geprüft.

Die Auswertung entspricht jetzt dem professionellen Dashboard-Aufbau: Zeitraumkopf, PDF-Aktion, sieben Kennzahlen, Wochenvergleich „Gebuchte Zeit vs. Tagessoll“ und Zeitverteilung nach Kategorie. Alle Werte werden aus den lokalen Buchungen berechnet und reagieren direkt auf Änderungen.

Der Reiter „Woche“ zeigt die aktuelle Arbeitswoche mit Arbeitsrahmen, Tages-/Wochensoll, Ist-Zeit, Fortschrittsbalken, Wochensaldo und sieben anklickbaren Tageskarten. Die Karten verwenden eine dezente 3D-Tiefe und bleiben auf Mobilgeräten zweispaltig und touch-freundlich.

Die gesamte App verwendet ein einheitliches 3D-Fluent-System: abgestufte Kartenflächen, dezente Tiefenschatten, erhöhte Primäraktionen, aktive Navigationsflächen, interaktive Eingabefelder und klare gedrückte/hover-/Fokus-Zustände. Auf Mobilgeräten werden die Tiefen reduziert, damit Bedienbarkeit und Performance erhalten bleiben.

Zusätzliche Live-Prüfung am 8. September 2026: Alle zehn Reiter wurden in der veröffentlichten Cloudflare-App angeklickt. Jeweils nur die ausgewählte Ansicht war sichtbar, und der URL-Hash stimmte überein. Browser-Zurück/-Vorwärts, „Zeit erfassen“ mit Fokus auf dem Leistungsfeld sowie der Wechsel aus einer gescrollten Übersicht zum Seitenanfang wurden ebenfalls erfolgreich geprüft. Die ausgelieferte HTML-Datei entspricht dem korrigierten Stand `bc972e0`.

Das Kalenderformular stellt alle Felder einheitlich dar: gut lesbare Labels, 44 px hohe Eingabefelder, klare Abstände und eine sauber ausgerichtete Erinnerungsauswahl. Das Feld `Erinnerung vorher (persönlich pro Eintrag)` verknüpft Zahl und Einheit per Label; `Minute(n)`, `Stunde(n)`, `Tag(e)` und `Woche(n)` bleiben auch auf kleinen Bildschirmen vollständig sichtbar.

Die Kalenderübersicht verwendet eine kompakte Dichte: kleinere Tagesfelder, weniger Innenabstand und eine geringere Mindesthöhe für Monatsansicht und Agenda. Die Kalendernavigation und die Touch-Klickflächen bleiben erhalten.

Die Kalenderseite folgt der Referenzaufteilung: schmalerer Monatskalender links, breitere Agenda rechts und ein eigener Hinweisblock für Browser-/Smartphone-Benachrichtigungen. Auf kleineren Bildschirmen wechselt das Layout automatisch in eine einspaltige Darstellung.

Die Übersicht ist als kompakte Microsoft-Teams-inspirierte Arbeitsoberfläche gestaltet: ruhiger Seitenhintergrund, klar getrennte Kopfaktionen, Kennzahlenleiste, Arbeitsrahmen und Tagesabschluss. Die Kopfzeile normalisiert außerdem URL-kodierte Namen wie Valt%C3%A8re%20Fansi direkt beim Laden.

Beim Klick auf einen Kalendertag wird der ausgewählte Tag als Filter übernommen und direkt der Reiter „Einträge“ geöffnet. Dort erscheinen links nur die Tagesbuchungen dieses Datums; „Heute“ setzt den Filter wieder auf den aktuellen Tag.

Der Notizen-Reiter folgt der OneNote-Referenz: Mini-OneNote-Kopf, Registerkarte „Alle Notizen“, Suche für Notizen und Subtasks sowie Filter für Kategorie, Unterkategorie und Thema. Bei leerem Bestand wird eine eigene, klar zentrierte Startansicht angezeigt; bestehende Farbmarkierungen und Checklisten bleiben vollständig bedienbar.

Testgrenzen: jsdom prüft DOM und Ereignisse, jedoch keine Pixelpositionen oder reale Touch-Bedienung. Die Live-Prüfung erfolgte im Desktop-Browser; reale mobile Touch-Geräte wurden nicht geprüft. Datenbank-, Authentifizierungs-, Export- und Erinnerungsfunktionen wurden mit diesem Routing-Test nicht vollständig abgenommen.
