(() => {
  const STORE = "professionelle-zeiterfassung.v2";
  const CALENDAR = "professionelle-zeiterfassung.calendar.v1";
  const NOTES = "professionelle-zeiterfassung.notes.v1";
  const defaults = {
    entries: [], categories: ["Testing","Meeting","Entwicklung","Dokumentation","Organisation","Weiterbildung"],
    projects: ["UKA Connect","Intern","Privat"], favorites: [], daily: "8h 00", weekly: "40h 00", breakHours: ".5"
  };
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  const state = () => Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORE) || "{}"));
  const read = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const api=()=>window.ZeiterfassungAPI;
  const pullRemote=async()=>{if(!api()?.hasSession?.())return;try{const remote=await api().bootstrap();if(remote.calendar_events?.length){save(CALENDAR,remote.calendar_events.map(x=>({id:x.id,title:x.title,type:x.event_type,date:x.event_date,allDay:Boolean(x.all_day),start:x.start_time||"",end:x.end_time||"",place:x.place||"",reminder:Number(x.reminder_minutes||0),note:x.note||""})));}if(remote.notes?.length){save(NOTES,remote.notes.map(x=>({id:x.id,title:x.title,content:x.content,color:x.color,tasks:JSON.parse(x.checklist_json||"[]"),created:x.created_at})));}}catch(error){console.warn("Remote-Daten konnten nicht geladen werden.",error);}};
  const pushCalendar=async item=>{if(!api()?.hasSession?.())return;try{const remote=await api().create("calendar",{event_type:item.type||"Termin",title:item.title,event_date:item.date,all_day:item.allDay,start_time:item.start,end_time:item.end,place:item.place,reminder_minutes:item.reminder,note:item.note});if(remote?.id){item.id=remote.id;save(CALENDAR,read(CALENDAR,[]));}}catch(error){toast("Kalender lokal gespeichert; D1-Synchronisierung fehlgeschlagen.");}};
  const pushNote=async note=>{if(!api()?.hasSession?.())return;try{const remote=await api().create("notes",{title:note.title,content:note.content,checklist_json:JSON.stringify(note.tasks||[]),color:note.color});if(remote?.id){note.id=remote.id;save(NOTES,read(NOTES,[]));}}catch(error){toast("Notiz lokal gespeichert; D1-Synchronisierung fehlgeschlagen.");}};
  const today = () => new Date().toISOString().slice(0,10);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const minutes = value => {
    const s=String(value||"").replace(",",".");
    const clock=s.match(/^(\d+):(\d{1,2})$/), hours=s.match(/(\d+)\s*h/i);
    if(clock) return Number(clock[1])*60+Number(clock[2]);
    if(hours) return Number(hours[1])*60;
    return Number(s) ? Math.round(Number(s)*60) : 0;
  };
  const format = value => Math.floor(Number(value||0)/60)+"h "+String(Number(value||0)%60).padStart(2,"0");
  const toast = message => {
    const node=document.createElement("div"); node.textContent=message;
    Object.assign(node.style,{position:"fixed",right:"18px",bottom:"85px",zIndex:1200,background:"#123263",color:"#fff",padding:"12px 16px",borderRadius:"10px",boxShadow:"0 8px 22px #12326355"});
    document.body.append(node); setTimeout(()=>node.remove(),2400);
  };
  const panel = () => $("#dynamic");
  let currentView="overview", refreshTimer=0, lastDataSignature="";
  const dataSignature=()=>[localStorage.getItem(STORE)||"",localStorage.getItem(CALENDAR)||"",localStorage.getItem(NOTES)||""].join("|");
  const requestRefresh=()=>{if(refreshTimer)return;refreshTimer=setTimeout(()=>{refreshTimer=0;if(currentView==="overview")refreshOverview();else if(currentView)render(currentView)},0)};

  const refreshOverview=()=>{
    const d=state(), todayEntries=d.entries.filter(e=>e.date===today()), total=todayEntries.reduce((sum,e)=>sum+Number(e.minutes||0),0), all=d.entries.reduce((sum,e)=>sum+Number(e.minutes||0),0);
    const set=(id,value)=>{const n=$("#"+id);if(n)n.textContent=value};
    set("todayTotal",format(total)); set("entrySum","Gesamt: "+format(total)); set("weekTotal",format(all));
    const dailyTarget=minutes(d.daily)||480, balance=total-dailyTarget; set("balance",(balance>=0?"+":"−")+format(Math.abs(balance)));
    const bar=$("#weekBar");if(bar)bar.style.width=Math.min(100,total/Math.max(1,minutes(d.weekly)||2400)*100)+"%";
    const title=$("#qualityTitle"), text=$("#qualityText"), close=$("#closeDay");if(title)title.textContent=total?"Bereit zum Abschluss":"Prüfung erforderlich";if(text)text.textContent=total?"Zeit wurde erfasst und kann abgeschlossen werden.":"Für diesen Arbeitstag ist noch keine Zeit erfasst.";if(close)close.disabled=!total;
    const list=$("#entryList");
    if(list){
      const q=($("#search")?.value||"").toLowerCase();
      const rows=d.entries.filter(e=>[e.category,e.project,e.description,e.notes].join(" ").toLowerCase().includes(q));
      list.className=rows.length?"":"empty";
      list.innerHTML=rows.length?rows.map(e=>"<div class='entry'><div class='entry-icon'>◷</div><div><b>"+escapeHtml(e.category)+" · "+escapeHtml(e.project)+"</b><small>"+escapeHtml(e.description||"Keine Beschreibung")+(e.notes?" · "+escapeHtml(e.notes):"")+"</small></div><div class='time'>"+format(e.minutes)+"<small>"+escapeHtml(e.time||"")+"</small></div></div>").join(""):"<div class='clock'>◷</div><b>Noch keine Zeit gebucht</b><p>Erfasse oben deine erste Leistung.</p>";
    }
  };

  const showModal = (title, body, action, onSave) => {
    $(".stable-modal")?.remove();
    const root=document.createElement("div"); root.className="stable-modal";
    root.innerHTML="<div class='stable-dialog'><button class='stable-x' aria-label='Schliessen'>×</button><h2>"+title+"</h2><div class='stable-form'>"+body+"</div><div class='stable-actions'><button class='btn stable-cancel'>Abbrechen</button><button class='btn primary stable-save'>"+action+"</button></div></div>";
    document.body.append(root);
    $(".stable-x",root).onclick=()=>root.remove(); $(".stable-cancel",root).onclick=()=>root.remove();
    root.onclick=e=>{if(e.target===root)root.remove()}; $(".stable-save",root).onclick=()=>onSave(root);
  };
  const editEntry = (index, redraw) => {
    const d=state(), e=d.entries[index]; if(!e) return;
    showModal("Buchung bearbeiten",
      "<div class='field'><label>Datum *</label><input id='seDate' type='date' value='"+escapeHtml(e.date||today())+"'></div>"+
      "<div class='stable-two'><div class='field'><label>Leistung</label><input id='seDesc' value='"+escapeHtml(e.description||"")+"'></div><div class='field'><label>Dauer (Minuten) *</label><input id='seMinutes' type='number' min='1' value='"+Number(e.minutes||0)+"'></div></div>"+
      "<div class='field'><label>Bemerkung / Jira-Referenz</label><input id='seNote' value='"+escapeHtml(e.notes||"")+"'></div>",
      "Speichern", root => { e.date=$("#seDate",root).value; e.description=$("#seDesc",root).value; e.minutes=Number($("#seMinutes",root).value||0); e.notes=$("#seNote",root).value; save(STORE,d); root.remove(); redraw(); toast("Buchung gespeichert."); });
  };
  const renderCalendar = p => {
    const events=read(CALENDAR,[]), now=new Date(), cal={selected:today(), month:new Date(now.getFullYear(),now.getMonth(),1), mode:"day"};
    const months=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"], weekdays=["Mo","Di","Mi","Do","Fr","Sa","So"];
    const key=(y,m,d)=>new Date(y,m,d).toISOString().slice(0,10);
    const label=date=>new Date(date+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
    p.innerHTML="<div class='stable-cal-head'><div><div class='eyebrow'>Persönlicher Kalender</div><h2>Termine, Aufgaben & Geburtstage</h2><p>Alles lokal geplant und mit rechtzeitiger Erinnerung.</p></div><div class='stable-cal-actions'><button class='btn' id='stableIcs'>⇩ Outlook / Teams / Gerät</button><button class='btn' id='stableNotify'>♧ Benachrichtigungen testen</button><button class='btn primary' id='newStableCal'>＋ Neuer Eintrag</button></div></div><div class='stable-cal-layout'><section class='card stable-month'><div class='stable-month-head'><button class='btn' id='calPrev'>‹</button><div><h2 id='calTitle'></h2><button class='btn' id='calToday'>Heute</button></div><button class='btn' id='calNext'>›</button></div><div class='stable-weekdays'>"+weekdays.map(x=>"<b>"+x+"</b>").join("")+"</div><div id='stableGrid' class='stable-grid'></div></section><section class='card stable-agenda'><div class='stable-agenda-head'><div><div class='eyebrow'>Agenda</div><h2 id='stableAgendaTitle'></h2></div><div class='seg'><button id='modeDay' class='active'>Tag</button><button id='modeWeek'>Woche</button></div></div><div id='stableAgenda'></div></section></div>";
    const draw=()=>{
      const y=cal.month.getFullYear(), m=cal.month.getMonth(), first=(new Date(y,m,1).getDay()+6)%7, last=new Date(y,m+1,0).getDate(), grid=$("#stableGrid",p);
      $("#calTitle",p).textContent=months[m]+" "+y; grid.innerHTML="";
      for(let i=0;i<first;i++) grid.insertAdjacentHTML("beforeend","<button class='stable-day muted' aria-hidden='true'></button>");
      for(let day=1;day<=last;day++){const date=key(y,m,day), count=events.filter(x=>x.date===date).length, cls=date===cal.selected?" selected":date===today()?" today":"";
        grid.insertAdjacentHTML("beforeend","<button class='stable-day"+cls+"' data-date='"+date+"'><strong>"+day+"</strong>"+(count?"<small>"+count+" "+(count===1?"Eintrag":"Einträge")+"</small>":"")+"</button>");}
      $("#stableAgendaTitle",p).textContent=label(cal.selected);
      const selected=new Date(cal.selected+"T12:00:00"), end=new Date(selected); end.setDate(end.getDate()+(cal.mode==="week"?6:0));
      const list=events.filter(x=>x.date>=cal.selected&&x.date<=end.toISOString().slice(0,10));
      $("#stableAgenda",p).innerHTML=list.length?list.map(x=>"<div class='stable-event'><div><b>"+escapeHtml(x.title)+"</b><div class='sub'>"+(x.allDay?"Ganztägig":escapeHtml(x.start)+" – "+escapeHtml(x.end))+(x.place?" · "+escapeHtml(x.place):"")+" · Erinnerung: "+Number(x.reminder||0)+" Min.</div><p>"+escapeHtml(x.note||"")+"</p></div><button class='delete' data-event-delete='"+escapeHtml(x.id)+"'>×</button></div>").join(""):"<div class='stable-empty-cal'><div class='stable-cal-icon'>▦</div><h3>Noch keine Einträge</h3><p>Plane einen Termin, eine Aufgabe oder einen Geburtstag.</p><button class='btn' id='stableEmptyNew'>＋ Eintrag erstellen</button></div>";
      $$("[data-date]",p).forEach(b=>b.onclick=()=>{cal.selected=b.dataset.date;draw()});
      $("#stableEmptyNew",p)?.addEventListener("click",()=>$("#newStableCal",p).click());
      $$("[data-event-delete]",p).forEach(b=>b.onclick=()=>{const i=events.findIndex(x=>String(x.id)===String(b.dataset.eventDelete));if(i>=0){events.splice(i,1);save(CALENDAR,events);draw();toast("Kalendereintrag gelöscht.")}});
    };
    $("#calPrev",p).onclick=()=>{cal.month.setMonth(cal.month.getMonth()-1);draw()}; $("#calNext",p).onclick=()=>{cal.month.setMonth(cal.month.getMonth()+1);draw()};
    $("#calToday",p).onclick=()=>{cal.selected=today();cal.month=new Date(now.getFullYear(),now.getMonth(),1);draw()};
    $("#modeDay",p).onclick=()=>{cal.mode="day";$("#modeDay",p).classList.add("active");$("#modeWeek",p).classList.remove("active");draw()};
    $("#modeWeek",p).onclick=()=>{cal.mode="week";$("#modeWeek",p).classList.add("active");$("#modeDay",p).classList.remove("active");draw()};
    $("#stableNotify",p).onclick=async()=>{if("Notification" in window){const permission=await Notification.requestPermission();toast(permission==="granted"?"Benachrichtigungen aktiviert.":"Benachrichtigungen nicht freigegeben.");checkReminders();}else toast("Dieser Browser unterstützt keine Benachrichtigungen.")};
    $("#stableIcs",p).onclick=()=>{const ics=events.map(x=>"BEGIN:VEVENT\\nSUMMARY:"+String(x.title||"").replace(/\\n/g," ")+"\\nDTSTART:"+String(x.date||"").replaceAll("-","")+"T"+String(x.start||"0900").replace(":","")+"00\\nEND:VEVENT").join("\\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["BEGIN:VCALENDAR\\nVERSION:2.0\\n"+ics+"\\nEND:VCALENDAR"],{type:"text/calendar"}));a.download="kalender.ics";a.click();toast("Kalender exportiert.")};
    $("#newStableCal",p).onclick=()=>showModal("Neuer Kalendereintrag","<div class='field'><label>Typ</label><select id='scType'><option>Termin</option><option>Aufgabe</option><option>Geburtstag</option></select></div><div class='field'><label>Titel *</label><input id='scTitle'></div><div class='stable-date-row'><div class='field'><label>Datum *</label><input id='scDate' type='date' value='"+cal.selected+"'></div><label class='stable-check'><input id='scAll' type='checkbox'> Ganztägig</label></div><div class='stable-two'><div class='field'><label>Beginn</label><input id='scStart' type='time' value='09:00'></div><div class='field'><label>Ende</label><input id='scEnd' type='time' value='10:00'></div></div><div class='field'><label>Ort</label><input id='scPlace'></div><div class='field'><label>Erinnerung vorher</label><div class='stable-reminder'><input id='scRemNum' type='number' min='0' value='1'><select id='scRemUnit'><option value='60'>Stunde(n)</option><option value='15'>Minute(n)</option><option value='1440'>Tag(e)</option></select></div></div><div class='field'><label>Notiz</label><textarea id='scNote'></textarea></div>","Speichern",root=>{const title=$("#scTitle",root).value.trim();if(!title){toast("Titel ist ein Pflichtfeld.");return}const item={id:crypto.randomUUID(),title,type:$("#scType",root).value,date:$("#scDate",root).value,start:$("#scStart",root).value,end:$("#scEnd",root).value,allDay:$("#scAll",root).checked,place:$("#scPlace",root).value,reminder:Number($("#scRemNum",root).value||0)*Number($("#scRemUnit",root).value||60),note:$("#scNote",root).value};events.push(item);save(CALENDAR,events);pushCalendar(item);root.remove();cal.selected=item.date;cal.month=new Date(item.date+"T12:00:00");cal.month.setDate(1);renderCalendar(p);toast("Kalendereintrag gespeichert.")}); draw();
  };
  const renderNotes = p => {
    const notes=read(NOTES,[]);
    const colors={blau:{label:"Blau",className:"note-blue"},grün:{label:"Grün",className:"note-green"},gelb:{label:"Gelb",className:"note-yellow"},rot:{label:"Rot",className:"note-red"},violett:{label:"Violett",className:"note-purple"}};
    const normalizeTasks=n=>Array.isArray(n.tasks)?n.tasks.filter(t=>t&&String(t.text||"").trim()).map(t=>({text:String(t.text||"").trim(),done:Boolean(t.done)})):[];
    const colorInfo=n=>colors[n.color]||colors.blau;
    const syncNote=note=>{if(!api()?.hasSession?.()||!note?.id)return;api().update("notes",note.id,{title:note.title,content:note.content,checklist_json:JSON.stringify(note.tasks||[]),color:note.color}).catch(()=>toast("Notiz lokal gespeichert; D1-Synchronisierung fehlgeschlagen."));};
    const removeRemoteNote=note=>{if(!api()?.hasSession?.()||!note?.id)return;api().remove("notes",note.id).catch(()=>toast("Notiz lokal gelöscht; D1-Löschung fehlgeschlagen."));};
    const noteForm=(prefix,n={})=>{
      const selectedColor=n.color||"blau";
      return "<div class='field'><label>Titel *</label><input id='"+prefix+"Title' value='"+escapeHtml(n.title||"")+"' required></div>"+
        "<div class='field'><label>Notiz *</label><textarea id='"+prefix+"Content' placeholder='Gedanken, Informationen und längere Inhalte ...' required>"+escapeHtml(n.content||"")+"</textarea></div>"+
        "<div class='field'><label>Farbe</label><select id='"+prefix+"Color'>"+Object.entries(colors).map(([key,item])=>"<option value='"+key+"' "+(selectedColor===key?"selected":"")+">"+item.label+"</option>").join("")+"</select></div>"+
        "<div class='field'><label>Checkliste</label><div class='stable-task-editor'><div class='stable-task-add'><input id='"+prefix+"TaskText' placeholder='Aufgabe hinzufügen'><button type='button' class='btn' id='"+prefix+"TaskAdd'>＋ Hinzufügen</button></div><div id='"+prefix+"TaskRows'></div></div></div>";
    };
    const bindDraft=(root,prefix,initial)=>{
      let draft=initial.map(t=>({text:t.text,done:Boolean(t.done)}));
      const draw=()=>{$("#"+prefix+"TaskRows",root).innerHTML=draft.map((t,i)=>"<div class='stable-draft-task'><span>"+escapeHtml(t.text)+"</span><button type='button' class='delete' data-draft-remove='"+i+"' aria-label='Aufgabe löschen'>×</button></div>").join("")||"<div class='sub'>Noch keine Aufgaben.</div>";$$("[data-draft-remove]",root).forEach(b=>b.onclick=()=>{draft.splice(Number(b.dataset.draftRemove),1);draw()});};
      const add=()=>{const input=$("#"+prefix+"TaskText",root),text=input.value.trim();if(!text)return;draft.push({text,done:false});input.value="";draw();input.focus();};
      $("#"+prefix+"TaskAdd",root).onclick=add;$("#"+prefix+"TaskText",root).onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();add()}};draw();return()=>draft;
    };
    const openEditor=(note,creating)=>{
      const prefix=creating?"sn":"en";let getTasks=()=>[];
      showModal(creating?"Neue Notiz erstellen":"Notiz bearbeiten",noteForm(prefix,creating?{}:note),creating?"Notiz speichern":"Änderungen speichern",root=>{
        const title=$("#"+prefix+"Title",root).value.trim(),content=$("#"+prefix+"Content",root).value.trim();
        if(!title||!content){toast("Titel und Notiz sind Pflichtfelder.");return}
        const tasks=getTasks(),color=$("#"+prefix+"Color",root).value;
        if(creating){const created={id:crypto.randomUUID(),title,content,tasks,color,created:new Date().toLocaleDateString("de-DE")};notes.unshift(created);save(NOTES,notes);pushNote(created);}
        else{note.title=title;note.content=content;note.tasks=tasks;note.color=color;save(NOTES,notes);syncNote(note);}
        root.remove();redraw();toast(creating?"Notiz gespeichert.":"Notiz geändert.");
      });
      getTasks=bindDraft($(".stable-modal"),prefix,creating?[]:normalizeTasks(note));
    };
    const redraw=()=>{
      p.innerHTML="<div class='stable-section-head'><div><div class='eyebrow'>Persönliche Notizen</div><h2>Notizen</h2><p>Notizen mit Farbe, Inhalt und Checkliste.</p></div><button class='btn primary' id='newStableNote'>＋ Neue Notiz</button></div><div>"+(notes.length?notes.map(n=>{
        const tasks=normalizeTasks(n),info=colorInfo(n),done=tasks.filter(t=>t.done).length;
        return "<article class='card stable-note "+info.className+"'><div class='stable-note-head'><div><b>"+escapeHtml(n.title)+"</b><div class='stable-note-meta'><span class='stable-note-swatch "+info.className+"'></span>"+info.label+" · "+escapeHtml(n.created||"")+(tasks.length?" · "+done+"/"+tasks.length+" erledigt":"")+"</div></div></div><p>"+escapeHtml(n.content).replace(/\\n/g,"<br>")+"</p>"+(tasks.length?"<div class='stable-task-list'>"+tasks.map((t,i)=>"<div class='stable-task-row'><label><input type='checkbox' data-note='"+escapeHtml(n.id)+"' data-task='"+i+"' "+(t.done?"checked":"")+"> <span class='"+(t.done?"task-done":"")+"'>"+escapeHtml(t.text)+"</span></label><button type='button' class='delete' data-task-delete='1' data-note-id='"+escapeHtml(n.id)+"' data-task-index='"+i+"' aria-label='Aufgabe löschen'>×</button></div>").join("")+"</div>":"")+"<div class='stable-task-add'><input data-task-input='"+escapeHtml(n.id)+"' placeholder='Aufgabe hinzufügen'><button type='button' class='btn' data-task-add='"+escapeHtml(n.id)+"'>＋ Aufgabe</button></div><div class='stable-note-actions'><button class='btn' data-note-edit='"+escapeHtml(n.id)+"'>Bearbeiten</button><button class='btn' data-note-delete='"+escapeHtml(n.id)+"'>Löschen</button></div></article>";
      }).join(""):"<div class='empty'>Noch keine Notizen.</div>")+"</div>";
      $("#newStableNote",p).onclick=()=>openEditor(null,true);
      $$("[data-task-add]",p).forEach(b=>b.onclick=()=>{const n=notes.find(x=>String(x.id)===String(b.dataset.taskAdd)),input=$$("[data-task-input]",p).find(x=>String(x.dataset.taskInput)===String(b.dataset.taskAdd));if(n&&input&&input.value.trim()){n.tasks=normalizeTasks(n);n.tasks.push({text:input.value.trim(),done:false});save(NOTES,notes);syncNote(n);redraw();toast("Aufgabe hinzugefügt.");}});
      $$("[data-task-input]",p).forEach(input=>input.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();const button=$$("[data-task-add]",p).find(x=>String(x.dataset.taskAdd)===String(input.dataset.taskInput));button?.click()}});
      $$("[data-task-delete]",p).forEach(b=>b.onclick=()=>{const n=notes.find(x=>String(x.id)===String(b.dataset.noteId));if(n){n.tasks=normalizeTasks(n);n.tasks.splice(Number(b.dataset.taskIndex),1);save(NOTES,notes);syncNote(n);redraw();toast("Aufgabe gelöscht.");}});
      $$("[data-note-delete]",p).forEach(b=>b.onclick=()=>{const i=notes.findIndex(n=>String(n.id)===String(b.dataset.noteDelete));if(i>=0){const deleted=notes.splice(i,1)[0];save(NOTES,notes);removeRemoteNote(deleted);redraw();toast("Notiz gelöscht.");}});
      $$("[data-note-edit]",p).forEach(b=>b.onclick=()=>{const n=notes.find(x=>String(x.id)===String(b.dataset.noteEdit));if(n)openEditor(n,false)});
      $$("[data-note]",p).forEach(box=>box.onchange=()=>{const n=notes.find(x=>String(x.id)===String(box.dataset.note));if(n){n.tasks=normalizeTasks(n);n.tasks[Number(box.dataset.task)].done=box.checked;save(NOTES,notes);syncNote(n);redraw();}});
    };
    redraw();
  };
  const exportPeriod=(mode,root)=>{
    const day=$("#exportDay",root)?.value||today(), from=$("#exportFrom",root)?.value||"", to=$("#exportTo",root)?.value||"", month=$("#exportMonth",root)?.value||today().slice(0,7), year=$("#exportYear",root)?.value||today().slice(0,4);
    let begin=day, finish=day, label=new Date(day+"T12:00:00").toLocaleDateString("de-DE");
    if(mode==="range"){begin=from;finish=to;label=new Date(from+"T12:00:00").toLocaleDateString("de-DE")+" – "+new Date(to+"T12:00:00").toLocaleDateString("de-DE");}
    if(mode==="month"){const parts=month.split("-").map(Number);begin=month+"-01";finish=new Date(parts[0],parts[1],0).toISOString().slice(0,10);label=new Date(begin+"T12:00:00").toLocaleDateString("de-DE",{month:"long",year:"numeric"});}
    if(mode==="year"){begin=year+"-01-01";finish=year+"-12-31";label=year;}
    if(!begin||!finish||begin>finish)return null;
    return {from:begin,to:finish,label};
  };
  const downloadCsv=(entries,period)=>{
    const rows=[["Datum","Kategorie","Projekt","Leistung","Dauer","Bemerkung"],...entries.map(e=>[e.date,e.category,e.project,e.description,format(e.minutes),e.notes])];
    const blob=new Blob(["\\ufeff"+rows.map(row=>row.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(";")).join("\\n")],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="zeiterfassung-"+period.label.replaceAll(".","").replaceAll(" ","-").replaceAll("–","bis")+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(entries.length+" Buchungen als CSV exportiert.");
  };
  const printPdf=(entries,period)=>{
    const total=entries.reduce((sum,e)=>sum+Number(e.minutes||0),0),win=window.open("","_blank");
    if(!win){toast("Bitte Pop-ups für den PDF-Bericht erlauben.");return}
    win.document.write("<!doctype html><html lang='de'><head><meta charset='utf-8'><title>Arbeitszeitnachweis – "+escapeHtml(period.label)+"</title><style>body{font:14px 'Segoe UI',Arial,sans-serif;color:#242424;margin:42px}h1{font-size:25px;font-weight:600;color:#4f52a3}p{color:#616161}table{width:100%;border-collapse:collapse;margin-top:24px}th{background:#edebe9;text-align:left}th,td{border:1px solid #d1d1d1;padding:9px}tfoot{font-weight:700;background:#f5f5f5}@media print{body{margin:18mm}}</style></head><body><h1>Arbeitszeitnachweis</h1><p><strong>Valtère Fansi</strong></p><p>Zeitraum: "+escapeHtml(period.label)+" · Erstellt am "+new Date().toLocaleDateString("de-DE")+"</p><table><thead><tr><th>Datum</th><th>Kategorie</th><th>Projekt</th><th>Leistung</th><th>Dauer</th><th>Bemerkung</th></tr></thead><tbody>"+entries.map(e=>"<tr><td>"+escapeHtml(e.date)+"</td><td>"+escapeHtml(e.category)+"</td><td>"+escapeHtml(e.project)+"</td><td>"+escapeHtml(e.description||"")+"</td><td>"+format(e.minutes)+"</td><td>"+escapeHtml(e.notes||"")+"</td></tr>").join("")+"</tbody><tfoot><tr><td colspan='4'>Gesamt</td><td>"+format(total)+"</td><td>"+entries.length+" Buchungen</td></tr></tfoot></table><script>window.onload=()=>window.print()<\\/script></body></html>");win.document.close();toast("PDF-Druckansicht für "+period.label+" geöffnet.");
  };
  const openExport=(kind)=>{
    const isCsv=kind==="csv", prefix=isCsv?"CSV":"PDF", body="<div class='field'><label>Berichtszeitraum</label><div class='seg export-modes'><button type='button' class='active' data-export-mode='day'>Tag</button><button type='button' data-export-mode='range'>Zeitraum</button><button type='button' data-export-mode='month'>Monat</button><button type='button' data-export-mode='year'>Jahr</button></div></div><div id='exportFields'><div class='field' data-export-field='day'><label>Tag</label><input id='exportDay' type='date' value='"+today()+"'></div><div class='field' data-export-field='range' hidden><div class='stable-two'><div><label>Von</label><input id='exportFrom' type='date' value='"+today()+"'></div><div><label>Bis</label><input id='exportTo' type='date' value='"+today()+"'></div></div></div><div class='field' data-export-field='month' hidden><label>Monat</label><input id='exportMonth' type='month' value='"+today().slice(0,7)+"'></div><div class='field' data-export-field='year' hidden><label>Jahr</label><input id='exportYear' type='number' min='2000' max='2100' value='"+today().slice(0,4)+"'></div></div><div class='stable-export-info'>Der "+prefix+"-Bericht enthält alle Buchungen des gewählten Zeitraums einschließlich Datum, Kategorie, Projekt, Dauer und Bemerkung.</div>";
    showModal(isCsv?"CSV-Datei exportieren":"PDF-Bericht erstellen",body,isCsv?"CSV herunterladen":"PDF-Bericht erstellen",root=>{
      const mode=root.querySelector("[data-export-mode].active")?.dataset.exportMode||"day",period=exportPeriod(mode,root);
      if(!period){toast("Bitte einen gültigen Zeitraum auswählen.");return}
      const entries=state().entries.filter(e=>e.date>=period.from&&e.date<=period.to);
      if(isCsv)downloadCsv(entries,period);else printPdf(entries,period);root.remove();
    });
    const root=$(".stable-modal"),buttons=$$("[data-export-mode]",root),fields=$$("[data-export-field]",root);
    buttons.forEach(button=>button.onclick=()=>{buttons.forEach(x=>x.classList.toggle("active",x===button));fields.forEach(field=>field.hidden=field.dataset.exportField!==button.dataset.exportMode);});
  };
  const exportCsv=()=>openExport("csv");
  const exportPdf=()=>openExport("pdf");
  const render = name => {
    currentView=name; const p=panel(); if(!p)return; const d=state(); p.hidden=false;
    if(name==="entries"){const draw=()=>{const q=($("#stableSearch",p)?.value||"").toLowerCase(), list=d.entries.map((e,i)=>({...e,_i:i})).filter(e=>[e.date,e.category,e.project,e.description,e.notes].join(" ").toLowerCase().includes(q));p.innerHTML="<h2>Einträge</h2><p>Alle Buchungen suchen, bearbeiten und verwalten.</p><input id='stableSearch' class='search' placeholder='Datum, Kategorie, Projekt, Leistung oder Notiz suchen' value='"+escapeHtml(q)+"'><div id='stableRows'></div>";$("#stableRows",p).innerHTML=list.length?list.map(e=>"<div class='card stable-entry'><div><b>"+escapeHtml(e.date)+" · "+escapeHtml(e.category)+" · "+escapeHtml(e.project)+"</b><div class='sub'>"+escapeHtml(e.description||"Keine Leistung")+" · "+escapeHtml(e.notes||"Keine Notiz")+"</div></div><div><strong>"+format(e.minutes)+"</strong><br><button class='btn' data-edit='"+e._i+"'>Bearbeiten</button> <button class='btn' data-delete='"+e._i+"'>Löschen</button></div></div>").join(""):"<p class='sub'>Keine passenden Einträge.</p>";$("#stableSearch",p).oninput=draw;$$("[data-delete]",p).forEach(b=>b.onclick=()=>{if(confirm("Buchung löschen?")){d.entries.splice(Number(b.dataset.delete),1);save(STORE,d);draw();toast("Buchung gelöscht.")}});$$("[data-edit]",p).forEach(b=>b.onclick=()=>editEntry(Number(b.dataset.edit),draw));}; draw();}
    else if(name==="week"){const totals={};d.entries.forEach(e=>totals[e.date]=(totals[e.date]||0)+Number(e.minutes||0));p.innerHTML="<h2>Woche</h2><p>Wochensollzeit: <strong>"+escapeHtml(d.weekly)+"</strong></p><div class='bar'><span style='width:"+Math.min(100,Object.values(totals).reduce((a,b)=>a+b,0)/Math.max(1,minutes(d.weekly))*100)+"%'></span></div>"+(Object.entries(totals).sort().map(x=>"<div class='stable-line'><span>"+escapeHtml(x[0])+"</span><strong>"+format(x[1])+"</strong></div>").join("")||"<p class='sub'>Noch keine Buchungen.</p>");}
    else if(name==="stats"){const total=d.entries.reduce((a,e)=>a+Number(e.minutes||0),0),cats={};d.entries.forEach(e=>cats[e.category]=(cats[e.category]||0)+Number(e.minutes||0));p.innerHTML="<h2>Auswertung</h2><div class='metrics'>"+["Heute","Woche","Monat","Jahr"].map((x,i)=>"<div class='metric'><label>"+x+"</label><strong>"+format(i===0?d.entries.filter(e=>e.date===today()).reduce((a,e)=>a+Number(e.minutes||0),0):total)+"</strong></div>").join("")+"</div><h3>Zeit nach Kategorie</h3>"+Object.entries(cats).map(x=>"<div class='stable-line'><span>"+escapeHtml(x[0])+"</span><strong>"+format(x[1])+"</strong></div>").join("")||"<p class='sub'>Noch keine Buchungen.</p>";}
    else if(name==="calendar") renderCalendar(p);
    else if(name==="notes") renderNotes(p);
    else if(name==="categories"||name==="favorites"){const key=name==="categories"?"categories":"favorites", arr=d[key]||[], values=arr.map(x=>typeof x==="string"?x:x.label||x.name);p.innerHTML="<h2>"+(key==="categories"?"Kategorien":"Favoriten")+"</h2><p>Verwalten und direkt verwenden.</p><div class='stable-pills'>"+(values.map((x,i)=>"<span>"+escapeHtml(x)+" <button class='delete' data-remove='"+i+"'>×</button></span>").join("")||"<p class='sub'>Noch keine Einträge.</p>")+"</div><button class='btn primary' id='stableAdd'>＋ Hinzufügen</button>";$("#stableAdd",p).onclick=()=>{const value=prompt("Name eingeben:");if(value?.trim()){const n=state();n[key].push(key==="favorites"?{label:value.trim(),duration_minutes:0}:value.trim());save(STORE,n);render(name)}};$$("[data-remove]",p).forEach(b=>b.onclick=()=>{const n=state();n[key].splice(Number(b.dataset.remove),1);save(STORE,n);render(name)})}
    else if(name==="settings"){const days=["So","Mo","Di","Mi","Do","Fr","Sa"], targets=d.weekdayTargets||{};p.innerHTML="<h2>Einstellungen & Arbeitsplanung</h2><p>Sollzeiten, Abwesenheiten und Projektbudgets konfigurieren.</p><div class='card stable-settings'><h3>Individuelles Soll je Wochentag</h3><div class='stable-days'>"+days.map(x=>"<div class='field'><label>"+x+" (Std.)</label><input class='stable-day-input' data-day='"+x+"' type='number' min='0' value='"+(targets[x]??(x==="So"||x==="Sa"?0:8))+"'></div>").join("")+"</div></div><div class='card stable-settings'><h3>Abwesenheit</h3><select id='stableAbs'><option>Arbeitstag</option><option>Ferien</option><option>Krankheit</option><option>Feiertag</option></select><h3>Projektbudgets & Status</h3>"+d.projects.map((x,i)=>"<div class='stable-project-row'><input class='stable-project-name' data-project='"+i+"' value='"+escapeHtml(typeof x==="string"?x:x.name)+"'><input class='stable-project-budget' data-project-budget='"+i+"' type='number' min='0' placeholder='Budget Std.' value='"+Number(x.budget_hours||0)+"'><select class='stable-project-status' data-project-status='"+i+"'><option value='active'>Aktiv</option><option value='archived'>Archiviert</option></select></div>").join("")+"</div>";$$(".stable-day-input",p).forEach(x=>x.onchange=()=>{const n=state();n.weekdayTargets=n.weekdayTargets||{};n.weekdayTargets[x.dataset.day]=Number(x.value);save(STORE,n)});$("#stableAbs",p).onchange=e=>{const n=state();n.absence=e.target.value;save(STORE,n)};$$("[data-project]",p).forEach(x=>x.onchange=()=>{const n=state(),i=Number(x.dataset.project),old=n.projects[i];n.projects[i]=typeof old==="string"?{name:x.value,budget_hours:0,status:"active"}:old;n.projects[i].name=x.value;save(STORE,n)});}
    else if(name==="help"){p.innerHTML="<h2>Hilfe · Aide</h2><p>Verwalte deine persönliche Zeiterfassung.</p>"+["Arbeitszeit konfigurieren","Zeit erfassen","Live-Timer verwenden","Organisieren und auswerten","Bearbeiten, suchen und sichern"].map((x,i)=>"<div class='card' style='padding:15px;margin:9px 0'><b>"+(i+1)+" · "+x+"</b><p class='sub'>"+["Datum, Start, Ende, Pause sowie Tages- und Wochensoll festlegen.","Kategorie, Projekt, Leistung, Dauer und Bemerkung erfassen.","Timer starten; beim Stoppen wird die gemessene Zeit übernommen.","Kategorien, Projekte, Favoriten, Kalender, Notizen, CSV und PDF verwenden.","Buchungen bearbeiten, suchen, sichern und wiederherstellen."][i]+"</p></div>").join("");}
    if(name!=="calendar"&&name!=="notes") p.scrollIntoView({block:"start"});
  };
  let timerStarted=0, timerInterval;
  const handleClick = e => {
    const nav=e.target.closest(".nav button");
    if(nav){e.preventDefault();e.stopImmediatePropagation();$$(".nav button").forEach(x=>x.classList.toggle("active",x===nav));if(nav.dataset.view==="overview")panel().hidden=true;else render(nav.dataset.view);return;}
    if(e.target.closest("#csv")){e.preventDefault();e.stopImmediatePropagation();exportCsv();return;}
    if(e.target.closest("#pdf")){e.preventDefault();e.stopImmediatePropagation();exportPdf();return;}
    if(e.target.closest("#timer")){e.preventDefault();e.stopImmediatePropagation();const button=$("#timer");if(!timerStarted){timerStarted=Date.now();button.textContent="■ Timer stoppen";timerInterval=setInterval(()=>{const elapsed=Math.floor((Date.now()-timerStarted)/1000);button.textContent="■ "+String(Math.floor(elapsed/3600)).padStart(2,"0")+":"+String(Math.floor(elapsed/60)%60).padStart(2,"0")+":"+String(elapsed%60).padStart(2,"0");},1000);toast("Timer gestartet.");}else{const elapsed=Math.max(1,Math.round((Date.now()-timerStarted)/60000));clearInterval(timerInterval);timerStarted=0;button.textContent="▷ Timer starten";const durationButton=$("#duration");if(durationButton){const span=$("span",durationButton);if(span)span.textContent=format(elapsed)}toast("Gemessene Dauer wurde übernommen.");}return;}
    if(e.target.closest("#focus")||e.target.closest("#more")){$("#capture")?.scrollIntoView({behavior:"smooth"});}
  };
  const style=document.createElement("style");style.textContent=".work-grid>.field:last-child{display:none}.work.week-mode .work-grid{grid-template-columns:1fr 1fr}.work.week-mode .work-grid>.field:nth-child(-n+4){display:none}.work.week-mode .work-grid>.field:nth-child(5){grid-column:1}.work.week-mode .work-grid>.field:nth-child(6){grid-column:2}.stable-cal-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:20px}.stable-cal-actions{display:flex;gap:10px;flex-wrap:wrap}.stable-cal-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);gap:20px}.stable-month,.stable-agenda{padding:20px;min-height:580px}.stable-month-head{display:flex;justify-content:space-between;align-items:center;text-align:center;margin-bottom:20px}.stable-month-head h2{margin:0 0 8px}.stable-weekdays,.stable-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.stable-weekdays{text-align:center;color:#718099;margin-bottom:8px}.stable-day{min-height:76px;border:1px solid transparent;border-radius:6px;background:#f5f5f5;color:var(--ink);text-align:left;padding:12px;display:flex;flex-direction:column;gap:7px}.stable-day:hover{border-color:#d1d1d1;background:#edebe9}.stable-day.selected{background:#6264a7;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.16)}.stable-day.today:not(.selected){border-color:#6264a7;color:#4f52a3}.stable-day small{font-size:10px;color:inherit;opacity:.8}.stable-day.muted{background:transparent}.stable-agenda-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px}.stable-agenda-head h2{margin:5px 0 0}.stable-event{display:flex;justify-content:space-between;gap:12px;padding:16px 0;border-bottom:1px solid var(--line)}.stable-event p{margin:8px 0 0;color:var(--muted)}.stable-empty-cal{text-align:center;padding:110px 20px;color:var(--muted)}.stable-cal-icon{font-size:52px;color:var(--blue)}.stable-empty-cal h3{color:var(--ink);margin:12px 0 4px}.stable-date-row,.stable-two,.stable-reminder{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:end}.stable-check{display:flex;gap:8px;align-items:center;height:36px;font-weight:700}.stable-check input{width:20px!important}.stable-reminder{grid-template-columns:125px 1fr}.stable-dialog{background:#fff;border:1px solid #e1dfdd;border-radius:8px;padding:28px;max-width:720px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 24px 70px #0003}.stable-dialog h2{margin-top:0}.stable-dialog input,.stable-dialog select,.stable-dialog textarea{width:100%;min-height:36px;padding:11px;border:1px solid #d1d1d1;border-radius:6px}.stable-dialog textarea{min-height:120px}.stable-dialog input[type=checkbox]{width:20px;min-height:auto}.stable-modal{position:fixed;inset:0;background:rgba(36,36,36,.55);z-index:1100;display:grid;place-items:center;padding:18px}.stable-x{float:right;border:0;background:none;font-size:24px}.stable-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.stable-form{display:grid;gap:12px}.stable-section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px}.stable-note,.stable-entry,.stable-settings{padding:16px;margin:10px 0}.stable-task{display:block;margin:8px 0}.stable-note-actions{display:flex;gap:8px;margin-top:14px}.stable-line{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)}.stable-pills{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.stable-pills span{background:#edebe9;padding:9px 12px;border-radius:6px}.stable-days{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}.stable-project-row{display:grid;grid-template-columns:1fr 140px 150px;gap:8px;margin:9px 0}.stable-project-row input,.stable-project-row select{min-height:36px;border:1px solid #d1d1d1;border-radius:6px;padding:0 10px}@media(max-width:900px){.stable-cal-head,.stable-cal-layout,.stable-section-head{display:block}.stable-cal-actions{margin-top:15px}.stable-cal-actions .btn{width:100%;margin-bottom:8px}.stable-agenda{margin-top:18px}.stable-day{min-height:58px;padding:8px;font-size:12px}.stable-day small{display:none}.stable-date-row,.stable-two,.stable-days{grid-template-columns:1fr}.stable-dialog{padding:22px}.stable-days{display:grid}.stable-project-row{grid-template-columns:1fr}}.export-modes{width:100%;height:auto;min-height:42px;flex-wrap:wrap}.export-modes button{min-height:36px;flex:1}.stable-export-info{margin-top:15px;background:#f5f5f5;border:1px solid #e1dfdd;border-radius:6px;padding:12px;color:#616161}.stable-note{border-left:4px solid #6264a7}.stable-note.note-blue{border-left-color:#6264a7;background:#f8f8ff}.stable-note.note-green{border-left-color:#107c10;background:#f7fbf7}.stable-note.note-yellow{border-left-color:#986f0b;background:#fffdf5}.stable-note.note-red{border-left-color:#c4314b;background:#fff8f8}.stable-note.note-purple{border-left-color:#8764b8;background:#fbf8ff}.stable-note-head{display:flex;justify-content:space-between;gap:12px}.stable-note-meta{display:flex;align-items:center;gap:6px;color:#616161;font-size:11px;margin-top:5px}.stable-note-swatch{width:9px;height:9px;border-radius:50%;background:#6264a7;display:inline-block}.stable-note-swatch.note-green{background:#107c10}.stable-note-swatch.note-yellow{background:#986f0b}.stable-note-swatch.note-red{background:#c4314b}.stable-note-swatch.note-purple{background:#8764b8}.stable-task-list{margin:12px 0}.stable-task-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #e1dfdd}.stable-task-row label{display:flex;align-items:center;gap:7px}.stable-task-row input{width:16px!important;min-height:auto}.task-done{text-decoration:line-through;color:#616161}.stable-task-add{display:flex;gap:8px;margin-top:12px}.stable-task-add input{flex:1;min-height:36px;border:1px solid #d1d1d1;border-radius:6px;padding:0 10px}.stable-draft-task{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;margin-top:6px;background:#f5f5f5;border-radius:6px}.stable-task-editor{padding:10px;border:1px solid #e1dfdd;border-radius:6px;background:#fafafa}";document.head.append(style);

  const bindWorkMode=()=>{
    const work=$(".work"), toggles=$(".work .work-head .seg button");
    if(!work||!toggles.length||work.dataset.modeBound)return;
    work.dataset.modeBound="1";
    const setMode=mode=>{work.classList.toggle("week-mode",mode==="week");toggles.forEach((b,i)=>b.classList.toggle("active",(mode==="day"&&i===0)||(mode==="week"&&i===1)));localStorage.setItem("professionelle-zeiterfassung.view-mode",mode);};
    toggles.forEach((b,i)=>b.onclick=()=>setMode(i===1?"week":"day"));
    setMode(localStorage.getItem("professionelle-zeiterfassung.view-mode")||"day");
  };
  const REMINDER_STATE="professionelle-zeiterfassung.reminders.v1";
  const checkReminders=()=>{
    const events=read(CALENDAR,[]),sent=read(REMINDER_STATE,{}),now=Date.now(),current=events.filter(event=>event.date&&Number(event.reminder||0)>0);
    let changed=false;
    current.forEach(event=>{
      const key=String(event.id)+"|"+event.date+"|"+(event.start||"");
      const due=Date.parse(event.date+"T"+(event.start||"09:00")+":00")-Number(event.reminder||0)*60000;
      if(due<=now&&now-due<86400000&&!sent[key]){sent[key]=now;changed=true;if("Notification" in window&&Notification.permission==="granted")new Notification(event.title||"Kalender-Erinnerung",{body:(event.allDay?"Heute":(event.start||""))+(event.place?" · "+event.place:"")});}
    });
    if(changed)save(REMINDER_STATE,sent);
    const count=current.filter(event=>Date.parse(event.date+"T"+(event.start||"09:00")+":00")>=now).length;const badge=$("#noticeCount");if(badge)badge.textContent=String(count);
  };
  const init=()=>{
    if(!Storage.prototype.__zeiterfassungPatched){const originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){originalSetItem.call(this,key,value);window.dispatchEvent(new CustomEvent("zeiterfassung-storage-changed",{detail:key}));};Storage.prototype.__zeiterfassungPatched=true;}
    window.addEventListener("zeiterfassung-storage-changed",e=>{if([STORE,CALENDAR,NOTES].includes(e.detail))requestRefresh()});window.addEventListener("storage",e=>{if([STORE,CALENDAR,NOTES].includes(e.key))requestRefresh()});
    bindWorkMode();
    pullRemote();window.addEventListener("zeiterfassung-auth-changed",()=>{pullRemote();requestRefresh()});window.ZeiterfassungRefresh=requestRefresh;lastDataSignature=dataSignature();checkReminders();setInterval(checkReminders,30000);document.addEventListener("click",handleClick,true);$$("body *").forEach(x=>{if(x.childNodes.length===1&&x.textContent.includes("Valt%C3%A8re%20Fansi"))x.textContent="Valtère Fansi"});};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();