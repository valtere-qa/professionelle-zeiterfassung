(() => {
  const addAbsenceHelp = () => {
    const panel = document.querySelector("#dynamic");
    const grid = panel?.querySelector(".stable-help-grid");
    if (!grid || grid.querySelector("[data-absence-help]")) return;
    const french = panel.querySelector(".stable-help-langs button.active")?.dataset.helpLang === "fr";
    const card = document.createElement("article");
    card.className = "card stable-help-card";
    card.dataset.absenceHelp = "true";
    card.innerHTML = french
      ? "<span class='stable-help-number'>12</span><h3>Absences dans les vues</h3><p>Les congés, maladies et autres absences sont visibles dans les saisies, la semaine et les statistiques avec leur motif et 0h 00.</p><div class='stable-help-steps'>Les jours d’absence sont grisés; aucune saisie n’est nécessaire. L’objectif hebdomadaire et mensuel est automatiquement réduit. Le sélecteur de date de l’accueil propose aussi « Aujourd’hui ».</div>"
      : "<span class='stable-help-number'>12</span><h3>Abwesenheit in den Ansichten</h3><p>Ferien, Krankheit und weitere Abwesenheiten werden in „Einträge“, „Woche“ und „Auswertung“ mit Grund und 0h 00 angezeigt.</p><div class='stable-help-steps'>Abwesenheitstage sind ausgegraut; eine Zeitbuchung ist nicht erforderlich. Wochen- und Monatssoll werden automatisch reduziert. Der Kalender-Picker in der Übersicht enthält zusätzlich „Heute“.</div>";
    grid.append(card);
  };
  const dynamic = document.querySelector("#dynamic");
  if (dynamic) new MutationObserver(addAbsenceHelp).observe(dynamic, { childList: true, subtree: true });
  addAbsenceHelp();
})();
