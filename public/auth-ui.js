(() => {
  const api=()=>window.ZeiterfassungAPI;
  const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const css=document.createElement("style");css.textContent=".auth-overlay{position:fixed;inset:0;background:#0b1f4788;z-index:300;display:grid;place-items:center;padding:18px}.auth-card{background:#fff;border-radius:20px;max-width:460px;width:100%;padding:30px;box-shadow:0 24px 70px #10285755}.auth-card h2{margin:0 0 8px;color:#12264a}.auth-card p{color:#73819a}.auth-tabs{display:flex;gap:6px;background:#eef3fb;padding:4px;border-radius:10px;margin:20px 0}.auth-tabs button{flex:1;border:0;background:transparent;padding:10px;border-radius:8px;font-weight:750}.auth-tabs button.active{background:#fff;color:#1769e8;box-shadow:0 2px 8px #12326318}.auth-field{margin:12px 0}.auth-field label{display:block;font-weight:750;margin-bottom:6px}.auth-field input{width:100%;padding:12px;border:1px solid #dbe3ee;border-radius:10px}.auth-error{color:#c94747!important;font-weight:650}.auth-info{background:#eef6ff;color:#245b9e;padding:12px;border-radius:10px}";
  document.head.append(css);
  const close=()=>document.querySelector(".auth-overlay")?.remove();
  function open(mode="login"){
    close();const o=document.createElement("div");o.className="auth-overlay";o.innerHTML="<form class='auth-card'><button type='button' data-close style='float:right;border:0;background:none;font-size:22px'>×</button><div class='eyebrow'>Sicherer persönlicher Bereich</div><h2>Professionelle Zeiterfassung</h2><p>Mit D1-Datenbank anmelden oder kostenlos registrieren.</p><div class='auth-tabs'><button type='button' data-mode='login'>Einloggen</button><button type='button' data-mode='register'>Registrieren</button></div><div id='authFields'></div><div id='authMessage'></div><button class='btn primary' style='width:100%;margin-top:10px' type='submit' id='authSubmit'>Einloggen</button></form>";document.body.append(o);
    const fields=o.querySelector("#authFields"), submit=o.querySelector("#authSubmit");
    const render=kind=>{o.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===kind));fields.innerHTML=(kind==="register"?"<div class='auth-field'><label>Name *</label><input id='authName' autocomplete='name' required></div>":"")+"<div class='auth-field'><label>E-Mail *</label><input id='authEmail' type='email' autocomplete='email' required></div>"+(kind==="register"?"<div class='auth-field'><label>Telefon (optional)</label><input id='authPhone' type='tel' autocomplete='tel' placeholder='+41 ...'></div>":"")+"<div class='auth-field'><label>Passwort *</label><input id='authPassword' type='password' minlength='8' autocomplete='"+(kind==="register"?"new-password":"current-password")+"' required></div>"+(kind==="register"?"<p class='sub'>Mindestens 8 Zeichen. Das Passwort wird nur als Hash in D1 gespeichert.</p>":"");submit.textContent=kind==="register"?"Registrieren":"Einloggen";o.dataset.mode=kind};
    o.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>render(b.dataset.mode));o.querySelector("[data-close]").onclick=close;render(mode);
    o.onsubmit=async e=>{e.preventDefault();const msg=o.querySelector("#authMessage");msg.innerHTML="<p>Bitte warten …</p>";try{let result;if(o.dataset.mode==="register")result=await api().register(o.querySelector("#authName").value,o.querySelector("#authEmail").value,o.querySelector("#authPassword").value);else result=await api().login(o.querySelector("#authEmail").value,o.querySelector("#authPassword").value);msg.innerHTML="<p class='auth-info'>Erfolgreich angemeldet. Deine Daten werden sicher geladen.</p>";setTimeout(close,500);if(result?.user)document.querySelectorAll(".profile b").forEach(x=>x.textContent=result.user.name||"Valtère Fansi");}catch(err){msg.innerHTML="<p class='auth-error'>"+esc(err.message)+"</p>"}};
  }
  function enhance(){
    const profile=document.querySelector(".profile");
    if(profile){profile.addEventListener("dblclick",()=>open("login"));profile.title="Doppelklick zum Einloggen oder Registrieren";}
    document.addEventListener("click",e=>{if(e.target.id==="rfLogout"){e.preventDefault();api()?.logout().finally(()=>open("login"))}});
    window.AuthUI={open};
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance);else enhance();
})();
/* Sichtbarer Einstieg für Einloggen/Registrieren */
(() => {
  function addEntry(){
    const menu=document.querySelector("#rfProfile");
    if(menu&&!menu.querySelector("#authOpen")){const b=document.createElement("button");b.id="authOpen";b.className="btn primary";b.textContent="↪ Einloggen / Registrieren";b.style.width="100%";b.style.marginBottom="10px";b.onclick=()=>window.AuthUI?.open("login");menu.insertBefore(b,menu.firstChild);}
    const profile=document.querySelector(".profile");
    if(profile&&!profile.parentElement.querySelector("#authQuick")){const b=document.createElement("button");b.id="authQuick";b.className="btn";b.textContent="↪ Einloggen / Registrieren";b.style.width="100%";b.style.marginTop="10px";b.onclick=()=>window.AuthUI?.open("login");profile.parentElement.append(b);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{addEntry();new MutationObserver(addEntry).observe(document.body,{childList:true,subtree:true})});else{addEntry();new MutationObserver(addEntry).observe(document.body,{childList:true,subtree:true})}
})();