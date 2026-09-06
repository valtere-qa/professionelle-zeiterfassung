(() => {
  const KEY="professionelle-zeiterfassung.reminders";
  const notify=(title,text)=>{let p=document.querySelector("#noticePanel");if(!p){p=document.createElement("section");p.id="noticePanel";p.className="card";p.style.cssText="position:fixed;right:20px;top:82px;width:min(360px,calc(100% - 40px));z-index:90;padding:18px;background:#fff;box-shadow:0 18px 45px #1d3a6c33";document.body.append(p)}p.innerHTML="<strong>"+title+"</strong><p style='margin:8px 0;color:#74819a'>"+text+"</p><button class='btn secondary' id='closeNotice'>Schliessen</button>";p.querySelector("#closeNotice").onclick=()=>p.remove()};
  const read=()=>JSON.parse(localStorage.getItem(KEY)||"[]");
  const save=v=>localStorage.setItem(KEY,JSON.stringify(v));
  const calendar=()=>{
    const box=document.querySelector(".calendar");if(!box||box.dataset.ready)return;box.dataset.ready="1";
    const head=box.querySelector(".cal-head"), title=head?.querySelector("span:nth-child(2)"), prev=head?.querySelector("span:first-child"), next=head?.querySelector("span:last-child");
    let date=new Date(); const render=()=>{if(title)title.textContent=date.toLocaleDateString("de-CH",{month:"long",year:"numeric"});box.querySelectorAll(".days span").forEach(x=>x.classList.remove("active"));};
    prev?.addEventListener("click",()=>{date.setMonth(date.getMonth()-1);render()});next?.addEventListener("click",()=>{date.setMonth(date.getMonth()+1);render()});render();
  };
  const addNotifications=()=>{
    const actions=document.querySelector(".top-actions");if(actions&&!document.querySelector("#noticeButton")){const b=document.createElement("button");b.id="noticeButton";b.className="btn secondary";b.textContent="♧ Erinnerungen";b.onclick=()=>{const notices=read();notify("Erinnerungen",notices.length?notices.join(" · "):"Keine offenen Erinnerungen.")};actions.insertBefore(b,actions.firstChild)}
    document.querySelector("#workFrame")?.querySelectorAll("input").forEach(input=>input.addEventListener("change",()=>{const notices=read();notices.push("Arbeitsrahmen aktualisiert");save([...new Set(notices)].slice(-5))}));
  };
  const pdf=()=>{
    const b=[...document.querySelectorAll("button")].find(x=>x.textContent.includes("PDF-Bericht"));if(b&&!b.dataset.ready){b.dataset.ready="1";b.addEventListener("click",()=>{document.body.classList.add("print-report");window.print();setTimeout(()=>document.body.classList.remove("print-report"),500)})}
  };
  document.addEventListener("DOMContentLoaded",()=>{calendar();addNotifications();pdf();});
})();