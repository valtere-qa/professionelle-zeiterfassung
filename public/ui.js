(() => {
  const STORE = "professionelle-zeiterfassung.local";
  const state = JSON.parse(localStorage.getItem(STORE) || '{"entries":[]}');
  const save = () => localStorage.setItem(STORE, JSON.stringify(state));
  const flash = message => { const el=document.createElement("div"); el.textContent=message; Object.assign(el.style,{position:"fixed",right:"18px",bottom:"82px",zIndex:50,background:"#113263",color:"#fff",padding:"12px 16px",borderRadius:"10px"}); document.body.appendChild(el); setTimeout(()=>el.remove(),2400); };
  const minutes = value => { const h=value.match(/(\d+)h/), m=value.match(/(\d+)\s*(?:min)?$/); return (h?Number(h[1])*60:0)+(m?Number(m[1]):0); };
  const exportCsv = () => { const rows=[["Datum","Kategorie","Projekt","Leistung","Dauer Minuten","Bemerkung"]]; state.entries.forEach(e=>rows.push([e.date,e.category,e.project,e.description,e.minutes,e.notes])); const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(";")).join("\n"); const link=document.createElement("a"); link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); link.download="zeiterfassung-"+new Date().toISOString().slice(0,10)+".csv"; link.click(); flash("CSV wurde exportiert."); };
  const addEntry = async () => {
    const selects=document.querySelectorAll(".form-grid select"), desc=document.querySelector(".form-grid input"), notes=document.querySelector(".long-row input"), duration=document.getElementById("durationValue")?.textContent.trim()||"1h 30";
    const entry={date:new Date().toISOString().slice(0,10),category:selects[0]?.value||"Organisation",project:selects[1]?.value||"Intern",description:desc?.value||"",minutes:minutes(duration),notes:notes?.value||""};
    if(!entry.minutes) return flash("Bitte eine Dauer auswählen.");
    state.entries.unshift(entry); save(); flash("Buchung wurde gespeichert.");
    const list=document.querySelector(".entries"), more=list?.querySelector(".add-more");
    if(list&&more){ const row=document.createElement("div"); row.className="row"; row.innerHTML='<div class="row-icon blue">◷</div><div><div class="row-title">'+entry.category+' · '+entry.project+'</div><div class="row-sub">'+(entry.description||"Neue Zeiterfassung")+'</div></div><div class="time">'+Math.floor(entry.minutes/60)+'h '+String(entry.minutes%60).padStart(2,"0")+'<small>gerade eben</small></div><div class="more">⋮</div>'; list.insertBefore(row,more); }
    if(window.ZeiterfassungAPI?.hasSession()){ const data=await window.ZeiterfassungAPI.bootstrap().catch(()=>null), category=data?.categories?.find(x=>x.name===entry.category), project=data?.projects?.find(x=>x.name===entry.project); if(category&&project) await window.ZeiterfassungAPI.create("entries",{entry_date:entry.date,duration_minutes:entry.minutes,category_id:category.id,project_id:project.id,description:entry.description,notes:entry.notes}).catch(()=>{}); }
  };
  document.querySelector(".btn.secondary")?.addEventListener("click",exportCsv);
  document.querySelector(".long-row .btn.primary")?.addEventListener("click",addEntry);
  document.querySelectorAll(".nav a").forEach(link=>link.addEventListener("click",event=>{ event.preventDefault(); document.querySelectorAll(".nav a").forEach(x=>x.classList.remove("active")); link.classList.add("active"); const target=link.textContent.trim().toLowerCase(); const section=target.includes("einträge")?".entries":target.includes("woche")?".weekly":target.includes("kategorie")?".form-grid":target.includes("favorit")?".fav-card":target.includes("übersicht")?".main":null; if(section) document.querySelector(section)?.scrollIntoView({behavior:"smooth"}); }));
  document.querySelectorAll(".icon-button").forEach(button=>button.addEventListener("click",()=>{ const select=button.closest(".inline")?.querySelector("select"), label=select?.closest(".field")?.querySelector("label")?.textContent||"Eintrag", value=prompt(label+" hinzufügen:"); if(value?.trim()){ select?.add(new Option(value.trim(),value.trim())); select.value=value.trim(); flash(value.trim()+" wurde hinzugefügt."); } }));
  document.querySelector(".outline-btn")?.addEventListener("click",()=>flash("Favoriten können nach der ersten Buchung gespeichert werden."));
  document.querySelector(".add-more")?.addEventListener("click",()=>document.getElementById("entryForm")?.scrollIntoView({behavior:"smooth"}));
})();