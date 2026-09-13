(() => {
  const addAbsenceHelp = () => {
    const panel = document.querySelector("#dynamic");
    const grid = panel?.querySelector(".stable-help-grid");
    if (!grid) return;
    const french = panel.querySelector(".stable-help-langs button.active")?.dataset.helpLang === "fr";
    if (!grid.querySelector("[data-absence-help]")) {
      const card = document.createElement("article");
      card.className = "card stable-help-card";
      card.dataset.absenceHelp = "true";
      card.innerHTML = french
        ? "<span class='stable-help-number'>12</span><h3>Absences dans les vues</h3><p>Les congés, maladies et autres absences sont visibles dans les saisies, la semaine et les statistiques avec leur motif et 0h 00.</p><div class='stable-help-steps'>Les jours d’absence sont grisés; aucune saisie n’est nécessaire. L’objectif hebdomadaire et mensuel est automatiquement réduit. La pause est également affichée à 0h 00. Le calendrier de l’accueil possède aussi un bouton « Aujourd’hui ». Sur smartphone, la navigation reste accessible par glissement et les formulaires sont disposés en une seule colonne. Le calendrier et l’organisation s’adaptent également : les onglets peuvent être parcourus horizontalement, les cartes sont disposées en une colonne et les tableaux peuvent défiler horizontalement si nécessaire. Toutes les vues, des catégories, favoris et paramètres jusqu’à l’aide, restent entièrement accessibles jusqu’en bas de la page; la barre de défilement native peut être déplacée jusqu’en bas, même sur un écran étroit de 360 px, et la navigation mobile fixe ne masque pas le dernier contenu. Un seul espace de défilement vertical est utilisé pour toutes les vues.</div>"
        : "<span class='stable-help-number'>12</span><h3>Abwesenheit in den Ansichten</h3><p>Ferien, Krankheit und weitere Abwesenheiten werden in „Einträge“, „Woche“ und „Auswertung“ mit Grund und 0h 00 angezeigt.</p><div class='stable-help-steps'>Abwesenheitstage sind ausgegraut; eine Zeitbuchung ist nicht erforderlich. Wochen- und Monatssoll werden automatisch reduziert. Auch die Pause wird an diesen Tagen mit 0h 00 angezeigt. Der Kalender in der Übersicht besitzt zusätzlich die Schaltfläche „Heute“. Auf dem Smartphone bleibt die Navigation per Wischen erreichbar; Formulare werden übersichtlich einspaltig angeordnet. Kalender und Organisation passen sich ebenfalls an: Reiter können horizontal gewischt, Karten einspaltig gelesen und Tabellen bei Bedarf horizontal gescrollt werden. Alle Ansichten von Kategorien, Favoriten und Einstellungen bis Hilfe, besonders Organisation und Auswertung, bleiben bis zum Seitenende vertikal erreichbar; der native Scrollbalken kann bis zum Seitenende bewegt werden, auch auf einem schmalen 360‑px‑Display, und die feste mobile Navigation verdeckt den letzten Inhalt nicht. Für alle Ansichten wird ein einheitlicher vertikaler Seiten-Scrollbereich verwendet.</div>";
      grid.append(card);
    }
    if (!grid.querySelector("[data-export-help]")) {
      const card = document.createElement("article");
      card.className = "card stable-help-card";
      card.dataset.exportHelp = "true";
      card.innerHTML = french
        ? "<span class='stable-help-number'>13</span><h3>Exports professionnels</h3><p>Exportez un rapport clair pour un jour, une période, un mois ou une année.</p><div class='stable-help-steps'>Le CSV contient l’en-tête, le résumé, les absences à 0h 00 et les détails. Les saisies du minuteur affichent les noms visibles des catégories et projets. Les colonnes restent fixes et correctement formatées en UTF-8 avec séparateur point-virgule. Après une mise à jour, la version actuelle est chargée automatiquement. Le PDF est optimisé pour A4 avec indicateurs, répartition par catégorie et projet et saisies détaillées.</div>"
        : "<span class='stable-help-number'>13</span><h3>Professionelle Exporte</h3><p>Erstelle für Tag, Zeitraum, Monat oder Jahr einen klaren Arbeitszeitreport.</p><div class='stable-help-steps'>CSV enthält Berichtskopf, Zusammenfassung, Abwesenheiten mit 0h 00 und Detailfelder. Timer-Buchungen verwenden die sichtbaren Namen von Kategorie und Projekt; die Spalten bleiben fest und korrekt als UTF-8 mit Semikolon formatiert. Nach einer Aktualisierung wird automatisch der aktuelle Stand geladen. PDF ist für A4 optimiert, zeigt Kategorien und Projekte mit ihren Namen und enthält Kennzahlen, Verteilungen sowie Detailbuchungen.</div>";
      grid.append(card);
    }
    if (!grid.querySelector("[data-auth-help]")) {
      const card = document.createElement("article");
      card.className = "card stable-help-card";
      card.dataset.authHelp = "true";
      card.innerHTML = french
        ? "<span class='stable-help-number'>14</span><h3>Connexion mobile</h3><p>Le profil reste visible au-dessus de la navigation mobile.</p><div class='stable-help-steps'>Touchez le profil pour ouvrir la connexion, l’inscription, la sauvegarde et, après connexion, la déconnexion. Le menu reste entièrement accessible sur un écran de 360 px.</div>"
        : "<span class='stable-help-number'>14</span><h3>Mobiler Login-Bereich</h3><p>Das Profil bleibt oberhalb der mobilen Navigation sichtbar.</p><div class='stable-help-steps'>Tippe auf das Profil, um Einloggen, Registrierung, Datensicherung und – nach der Anmeldung – Ausloggen zu öffnen. Das Menü bleibt auch auf einem 360‑px‑Display vollständig erreichbar.</div>";
      grid.append(card);
    }
    if (!grid.querySelector("[data-sync-help]")) {
      const card = document.createElement("article");
      card.className = "card stable-help-card";
      card.dataset.syncHelp = "true";
      card.innerHTML = french
        ? "<span class='stable-help-number'>17</span><h3>Synchronisation et notifications</h3><p>Les données du profil sont synchronisées avec D1 en quelques secondes sur les appareils connectés.</p><div class='stable-help-steps'>À l’ouverture de l’application, la connexion est demandée. Après la connexion, les saisies, réglages, absences, calendrier, notes et rappels sont chargés puis synchronisés automatiquement. Utilisez la même URL de l’application et la même adresse e-mail sur tous les appareils. Les réponses API ne sont pas conservées dans le cache du navigateur : après une modification, chaque appareil demande l’état actuel. Après une coupure réseau ou une erreur serveur temporaire, une nouvelle tentative automatique est effectuée pour éviter un statut hors ligne inutile. Lors du premier rapprochement, les données locales et celles du cloud sont réunies afin de ne rien perdre. Les modifications simultanées sur plusieurs appareils sont fusionnées puis enregistrées automatiquement. Une modification venant d’un autre appareil est signalée avec son nom et propose « Actualiser maintenant ». Dans le menu du profil, activez les notifications du navigateur pour recevoir cette information lorsque l’application est ouverte. Après le premier profil, toute nouvelle inscription exige un code d’invitation à usage unique créé par un Owner, un Admin ou les RH. Le code est valable sept jours.</div>"
        : "<span class='stable-help-number'>17</span><h3>Synchronisation und Benachrichtigungen</h3><p>Die Profildaten werden innerhalb weniger Sekunden mit D1 auf den angemeldeten Geräten synchronisiert.</p><div class='stable-help-steps'>Beim Öffnen der App wird die Anmeldung verlangt. Nach der Anmeldung werden Buchungen, Einstellungen, Abwesenheiten, Kalender, Notizen und Erinnerungen geladen und automatisch synchronisiert. Verwende auf allen Geräten dieselbe App-URL und dieselbe E-Mail-Adresse. API-Antworten werden nicht im Browser-Cache behalten: Nach einer Änderung fordert jedes Gerät den aktuellen Stand neu an. Nach einem kurzen Netzwerk- oder Serverfehler erfolgt automatisch ein zweiter Versuch, damit der Status nicht unnötig offline bleibt. Beim ersten Abgleich werden bereits lokale und Cloud-Daten zusammengeführt, damit keine Einträge verloren gehen. Gleichzeitige Änderungen auf mehreren Geräten werden zusammengeführt und automatisch gespeichert. Eine Änderung von einem anderen Gerät wird mit dessen Namen gemeldet und bietet „Jetzt aktualisieren“ an. Aktiviere im Profilmenü die Browser-Benachrichtigungen, damit diese Information bei geöffneter App zusätzlich angezeigt wird. Nach dem ersten Profil benötigt jede weitere Registrierung einen einmaligen Einladungscode von Owner, Admin oder HR. Der Code ist sieben Tage gültig.</div>";
      grid.append(card);
    }
  };
  const dynamic = document.querySelector("#dynamic");
  if (dynamic) new MutationObserver(addAbsenceHelp).observe(dynamic, { childList: true, subtree: true });
  addAbsenceHelp();
})();
