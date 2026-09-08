(() => {
  const STORE = "professionelle-zeiterfassung.v2";
  const defaults = {entries:[], categories:["Testing","Meeting","Entwicklung","Dokumentation","Organisation","Weiterbildung"], projects:["UKA Connect","Intern","Privat"], notes:"", favorites:[], daily:"8h 00", weekly:"40h 00", breakHours:".5"};
  const read = () => Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORE) || "{}"));
  const write = value => localStorage.setItem(STORE, JSON.stringify(value));
  const esc = v => String(v ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const fmt = m => Math.floor(Number(m||0)/60)+"h "+String(Number(m||0)%60).padStart(2,"0");
  const mins = v => { const s=String(v||"").replace(",", "."), c=s.match(/^(\d+):(\d{1,2})$/), h=s.match(/(\d+)\s*h/i); return c?Number(c[1])*60+Number(c[2]):h?Number(h[1])*60+(s.match(/(\d+)\s*(?:min)?$/i)?.[1]||0):Math.round(Number(s||0)*60); };
  const today = () => new Date().toISOString().slice(0,10);
  const panel = () => document.querySelector("#dynamic");
  const toast = text => { const e=document.createElement("div"); e.textContent=text; Object.assign(e.style,{position:"fixed",right:"18px",bottom:"85px",zIndex:100,background:"#123263",color:"#fff",padding:"12px 16px",borderRadius:"10px",boxShadow:"0 8px 20px #0002"}); document.body.append(e); setTimeout(()=>e.remove(),2200); };

  // Navigation is owned exclusively by stable-ui.js.

  function enhance() {
    const duration=document.querySelector("#duration");
    if(duration){
      duration.onclick=()=>{ const options=["0h 15","0h 30","0h 45","1h 00","1h 30","2h 00","4h 00"]; const current=duration.querySelector("span")?.textContent||"1h 30"; const next=options[(options.indexOf(current)+1)%options.length]; duration.querySelector("span").textContent=next; toast("Dauer: "+next); };
      duration.title="Klicken, um die Dauer auszuwählen";
    }
    const timer=document.querySelector("#timer"); let started=0, handle;
    if(timer) timer.onclick=()=>{ if(!started){started=Date.now();timer.dataset.on="1";timer.textContent="■ Timer stoppen";handle=setInterval(()=>{const s=Math.floor((Date.now()-started)/1000);timer.textContent="■ "+String(Math.floor(s/3600)).padStart(2,"0")+":"+String(Math.floor(s/60)%60).padStart(2,"0")+":"+String(s%60).padStart(2,"0");},1000);toast("Timer gestartet");}else{const elapsed=Math.max(1,Math.round((Date.now()-started)/60000));clearInterval(handle);started=0;timer.dataset.on="";timer.textContent="▷ Timer starten";const field=document.querySelector("#duration span");if(field)field.textContent=Math.floor(elapsed/60)+"h "+String(elapsed%60).padStart(2,"0");toast("Timer gestoppt – Dauer übernommen");} };
    document.querySelector("#closeDay")?.addEventListener("click",()=>toast("Tag abgeschlossen."));
    document.querySelector("#copyDay")?.addEventListener("click",()=>toast("Letzten Arbeitstag übernommen."));
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",enhance); else enhance();
})();

/* Ergänzende Bedienlogik: Datum, Bearbeiten, Benachrichtigungen und Sicherung */
(() => {
  const STORE="professionelle-zeiterfassung.v2";
  const read=()=>Object.assign({entries:[],categories:[],projects:[],favorites:[],notes:"",daily:"8h 00",weekly:"40h 00",breakHours:".5"},JSON.parse(localStorage.getItem(STORE)||"{}"));
  const write=v=>localStorage.setItem(STORE,JSON.stringify(v));
  const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const fmt=m=>Math.floor(Number(m||0)/60)+"h "+String(Number(m||0)%60).padStart(2,"0");
  const selectedDate=()=>document.querySelector("#workDate")?.value||new Date().toISOString().slice(0,10);
  const toast=t=>{const e=document.createElement("div");e.textContent=t;Object.assign(e.style,{position:"fixed",right:"18px",bottom:"85px",zIndex:100,background:"#123263",color:"#fff",padding:"12px 16px",borderRadius:"10px"});document.body.append(e);setTimeout(()=>e.remove(),2200)};
  function refresh() {
    if(window.ZeiterfassungRefresh){window.ZeiterfassungRefresh();return}
    document.querySelector("#search")?.dispatchEvent(new Event("input",{bubbles:true}));
    document.querySelector("#dateLabel")?.closest(".top")?.querySelector("p");
  }
  function saveEntry(){
    const d=read(), duration=document.querySelector("#duration span")?.textContent||"1h 30";
    const category=document.querySelector("#category")?.value, project=document.querySelector("#project")?.value;
    if(!category||!project){toast("Kategorie und Projekt sind Pflichtfelder.");return}
    const value=duration.match(/(\d+)\s*h\s*(\d+)/i);
    const minutes=value?Number(value[1])*60+Number(value[2]):0;
    if(!minutes){toast("Bitte eine gültige Dauer auswählen.");return}
    d.entries.unshift({date:selectedDate(),category,project,description:document.querySelector("#description")?.value||"",notes:document.querySelector("#notes")?.value||"",minutes,time:new Date().toLocaleTimeString("de-CH",{hour:"2-digit",minute:"2-digit"})});
    write(d);if(document.querySelector("#description"))document.querySelector("#description").value="";if(document.querySelector("#notes"))document.querySelector("#notes").value="";
    refresh();toast("Buchung gespeichert.");
  }
  function addEditActions(){
    document.querySelectorAll("#entryList .entry").forEach((row,index)=>{
      if(row.querySelector("[data-edit]"))return;
      const button=document.createElement("button");button.className="delete";button.dataset.edit=index;button.title="Bearbeiten";button.textContent="✎";
      row.append(button);
      button.onclick=()=>{const d=read(), filter=(document.querySelector("#search")?.value||"").toLowerCase(), list=d.entries.filter(e=>[e.category,e.project,e.description,e.notes].join(" ").toLowerCase().includes(filter)), entry=list[index];if(!entry)return;
        const desc=prompt("Leistung:",entry.description||"");if(desc===null)return;const note=prompt("Bemerkung:",entry.notes||"");if(note===null)return;entry.description=desc;entry.notes=note;write(d);refresh();toast("Buchung geändert.");};
    });
  }
  function backup(){
    const a=document.createElement("a");a.download="zeiterfassung-backup.json";a.href=URL.createObjectURL(new Blob([JSON.stringify(read(),null,2)],{type:"application/json"}));a.click();toast("Backup exportiert.");
  }
  function notification(){
    const d=read(), count=d.entries.filter(e=>e.date===new Date().toISOString().slice(0,10)).length;
    const n=document.querySelector("#noticeCount");if(n)n.textContent=count?"0":"1";
  }
  function enhance2(){
    const add=document.querySelector("#addEntry");if(add)add.onclick=saveEntry;
    const list=document.querySelector("#entryList");if(list)new MutationObserver(addEditActions).observe(list,{childList:true,subtree:true});
    addEditActions();notification();
    const date=document.querySelector("#workDate");date?.addEventListener("change",()=>{const label=document.querySelector("#qualityText");if(label)label.textContent="Ausgewählter Arbeitstag: "+date.value;});
    const pdf=document.querySelector("#pdf");if(pdf)pdf.onclick=()=>{const choice=prompt("PDF-Bericht: Heute, Monat oder Alle","Heute");if(choice!==null){document.body.dataset.reportRange=choice;window.print();}};
    const more=document.querySelector("#more");if(more)more.title="Springt zur Buchungserfassung";
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance2);else enhance2();
})();
