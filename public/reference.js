(() => {
  const add=(parent,html)=>{const e=document.createElement("article");e.className="metric";e.innerHTML=html;parent.append(e)};
  const safe=v=>String(v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  document.addEventListener("DOMContentLoaded",()=>{
    const metrics=document.querySelector(".metrics");
    if(metrics && metrics.children.length===3){
      add(metrics,'<div class="metric-row"><div class="metric-icon blue">▥</div><div><div class="metric-label">Monatssaldo</div><div class="metric-value">−176h 00</div></div></div>');
      add(metrics,'<div class="metric-row"><div class="metric-icon blue">♧</div><div><div class="metric-label">Erinnerungen</div><div class="metric-value">0</div></div></div>');
    }
    const actions=document.querySelector(".top-actions");
    if(actions && ![...actions.children].some(x=>x.textContent.includes("Timer"))){
      const timer=document.createElement("button");timer.className="btn secondary";timer.textContent="▷ Timer starten";timer.id="timerButton";actions.prepend(timer);
      const pdf=document.createElement("button");pdf.className="btn secondary";pdf.textContent="▤ PDF-Bericht";pdf.id="pdfButton";actions.insertBefore(pdf,actions.lastElementChild);
      timer.onclick=()=>{timer.dataset.started=timer.dataset.started?"":"1";timer.textContent=timer.dataset.started?"■ Timer stoppen":"▷ Timer starten";window.flash?.(timer.dataset.started?"Timer gestartet.":"Timer gestoppt.");};
      pdf.onclick=()=>window.print();
    }
    const heading=document.querySelector(".entry-card");
    if(heading&&!document.querySelector("#workFrame")){const frame=document.createElement("section");frame.id="workFrame";frame.className="card";frame.style.cssText="padding:18px 20px;margin-bottom:20px";frame.innerHTML='<div style="display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap"><div><strong>Arbeitsrahmen</strong><div style="font-size:12px;color:var(--muted);margin-top:4px">Tages- und Wochensollzeit</div></div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label style="font-size:12px">Datum <input type="date" id="workDate" value="'+new Date().toISOString().slice(0,10)+'"></label><label style="font-size:12px">Start <input type="time" value="07:00"></label><label style="font-size:12px">Ende <input type="time" value="16:00"></label><label style="font-size:12px">Pause <input type="number" min="0" step=".25" value="0.5" style="width:70px"></label></div></div>';heading.parentNode.insertBefore(frame,heading);}
    const search=document.querySelector(".entries-head");if(search&&!document.querySelector("#bookingSearch")){const input=document.createElement("input");input.id="bookingSearch";input.placeholder="Buchungen durchsuchen";input.style.cssText="margin:0 20px 12px;width:calc(100% - 40px);padding:11px;border:1px solid var(--border);border-radius:10px";search.parentNode.insertBefore(input,search.nextSibling);}
  });
})();