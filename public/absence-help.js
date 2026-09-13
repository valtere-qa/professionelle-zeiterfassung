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
        ? "<span class='stable-help-number'>12</span><h3>Absences dans les vues</h3><p>Les congés, maladies et autres absences sont visibles dans les saisies, la semaine et les statistiques avec leur motif et 0h 00.</p><div class='stable-help-steps'>Les jours d’absence sont grisés; aucune saisie n’est nécessaire. L’objectif hebdomadaire et mensuel est automatiquement réduit. La pause est également affichée à 0h 00. Le calendrier de l’accueil possède aussi un bouton « Aujourd’hui ».</div>"
        : "<span class='stable-help-number'>12</span><h3>Abwesenheit in den Ansichten</h3><p>Ferien, Krankheit und weitere Abwesenheiten werden in „Einträge“, „Woche“ und „Auswertung“ mit Grund und 0h 00 angezeigt.</p><div class='stable-help-steps'>Abwesenheitstage sind ausgegraut; eine Zeitbuchung ist nicht erforderlich. Wochen- und Monatssoll werden automatisch reduziert. Auch die Pause wird an diesen Tagen mit 0h 00 angezeigt. Der Kalender in der Übersicht besitzt zusätzlich die Schaltfläche „Heute“.</div>";
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
  };
  const dynamic = document.querySelector("#dynamic");
  if (dynamic) new MutationObserver(addAbsenceHelp).observe(dynamic, { childList: true, subtree: true });
  addAbsenceHelp();
})();
