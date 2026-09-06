(() => {
  const api=()=>window.ZeiterfassungAPI;
  const escapeHtml=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const css=document.createElement("style");
  css.textContent=".auth-overlay{position:fixed;inset:0;background:#0b1f4788;z-index:1300;display:grid;place-items:center;padding:18px}.auth-card{background:#fff;border-radius:20px;max-width:460px;width:100%;padding:30px;box-shadow:0 24px 70px #10285755}.auth-card h2{margin:0 0 8px;color:#12264a}.auth-card p{color:#73819a}.auth-tabs{display:flex;gap:6px;background:#eef3fb;padding:4px;border-radius:10px;margin:20px 0}.auth-tabs button{flex:1;border:0;background:transparent;padding:10px;border-radius:8px;font-weight:750}.auth-tabs button.active{background:#fff;color:#1769e8;box-shadow:0 2px 8px #12326318}.auth-field{margin:12px 0}.auth-field label{display:block;font-weight:750;margin-bottom:6px}.auth-field input{width:100%;padding:12px;border:1px solid #dbe3ee;border-radius:10px}.auth-error{color:#c94747!important;font-weight:650}.auth-info{background:#eef6ff;color:#245b9e;padding:12px;border-radius:10px}.auth-menu{position:absolute;left:18px;bottom:86px;width:270px;background:#fff;border:1px solid #e0e7f0;border-radius:16px;padding:12px;box-shadow:0 18px 45px #15315d25;z-index:1250}.auth-menu button{width:100%;text-align:left;border:0;background:transparent;padding:11px;border-radius:9px;font-weight:700;color:#12264a}.auth-menu button:hover{background:#eef5ff;color:#1769e8}.auth-menu .auth-danger{color:#c94747}.auth-status{font-size:11px;color:#74839b;margin:5px 0 10px}.auth-quick{margin:10px 0 0;width:100%;display:block}.auth-quick.auth-logout{color:#c94747}@media(max-width:780px){.auth-quick{position:fixed;right:12px;top:12px;width:auto;z-index:1200;margin:0;background:#fff;box-shadow:0 8px 22px #12326322}}";
  document.head.append(css);
  const close=()=>document.querySelector(".auth-overlay")?.remove();
  const setProfile=(user)=>{
    document.querySelectorAll(".profile b").forEach(x=>x.textContent=user?.name||"Valtère Fansi");
    document.querySelectorAll(".profile small").forEach(x=>x.textContent=user?"Angemeldet":"Persönlicher Bereich");
    const status=document.querySelector("#authStatus"); if(status)status.textContent=user?"Angemeldet als "+(user.name||user.email):"Nicht angemeldet";
    const login=document.querySelector("#authLogin"); const logout=document.querySelector("#authLogout"); const quick=document.querySelector("#authQuick");
    if(login)login.hidden=Boolean(user); if(logout)logout.hidden=!user;
    if(quick){quick.textContent=user?"⇥ Abmelden":"↪ Einloggen / Registrieren";quick.classList.toggle("auth-logout",Boolean(user));quick.onclick=user?logout:()=>open("login");}
  };
  const logout=async()=>{
    try{await api()?.logout?.();}finally{setProfile(null);document.querySelector(".auth-menu")?.remove();window.dispatchEvent(new Event("zeiterfassung-auth-changed"));}
  };
  function open(mode="login"){
    close();const root=document.createElement("div");root.className="auth-overlay";
    root.innerHTML="<form class='auth-card'><button type='button' data-close style='float:right;border:0;background:none;font-size:22px'>×</button><div class='eyebrow'>Sicherer persönlicher Bereich</div><h2>Professionelle Zeiterfassung</h2><p>Mit D1-Datenbank anmelden oder kostenlos registrieren.</p><div class='auth-tabs'><button type='button' data-mode='login'>Einloggen</button><button type='button' data-mode='register'>Registrieren</button></div><div id='authFields'></div><div id='authMessage'></div><button class='btn primary' style='width:100%;margin-top:10px' type='submit' id='authSubmit'>Einloggen</button></form>";
    document.body.append(root);const fields=root.querySelector("#authFields"),submit=root.querySelector("#authSubmit");
    const render=kind=>{root.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===kind));fields.innerHTML=(kind==="register"?"<div class='auth-field'><label>Name *</label><input id='authName' autocomplete='name' required></div>":"")+"<div class='auth-field'><label>E-Mail *</label><input id='authEmail' type='email' autocomplete='email' required></div>"+(kind==="register"?"<div class='auth-field'><label>Telefon (optional)</label><input id='authPhone' type='tel' autocomplete='tel' placeholder='+41 ...'></div>":"")+"<div class='auth-field'><label>Passwort *</label><input id='authPassword' type='password' minlength='8' autocomplete='"+(kind==="register"?"new-password":"current-password")+"' required></div>"+(kind==="register"?"<p class='sub'>Mindestens 8 Zeichen. Das Passwort wird nur als Hash in D1 gespeichert.</p>":"");submit.textContent=kind==="register"?"Registrieren":"Einloggen";root.dataset.mode=kind};
    root.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>render(b.dataset.mode));root.querySelector("[data-close]").onclick=close;render(mode);
    root.onsubmit=async e=>{e.preventDefault();const msg=root.querySelector("#authMessage");msg.innerHTML="<p>Bitte warten …</p>";try{let result;if(root.dataset.mode==="register")result=await api().register(root.querySelector("#authName").value,root.querySelector("#authEmail").value,root.querySelector("#authPassword").value);else result=await api().login(root.querySelector("#authEmail").value,root.querySelector("#authPassword").value);setProfile(result.user);msg.innerHTML="<p class='auth-info'>Erfolgreich angemeldet. Deine Daten werden geladen.</p>";window.dispatchEvent(new Event("zeiterfassung-auth-changed"));setTimeout(close,500);}catch(err){msg.innerHTML="<p class='auth-error'>"+escapeHtml(err.message)+"</p>"}};
  }
  const showMenu=()=>{
    document.querySelector(".auth-menu")?.remove();const menu=document.createElement("div");menu.className="auth-menu";menu.innerHTML="<div class='auth-status' id='authStatus'>Status wird geprüft …</div><button id='authLogin'>↪ Einloggen / Registrieren</button><button id='authLogout' class='auth-danger' hidden>⇥ Abmelden</button>";document.body.append(menu);
    menu.querySelector("#authLogin").onclick=()=>{menu.remove();open("login")};menu.querySelector("#authLogout").onclick=logout;
    api()?.me?.().then(x=>setProfile(x.user)).catch(()=>setProfile(null));setTimeout(()=>{if(!document.body.contains(menu))return;document.addEventListener("click",function outside(e){if(!menu.contains(e.target)&&!e.target.closest(".profile")){menu.remove();document.removeEventListener("click",outside)}},{once:true,capture:true})},0);
  };
  const enhance=()=>{
    const profile=document.querySelector(".profile");
    if(profile&&!profile.dataset.authBound){profile.dataset.authBound="1";profile.style.cursor="pointer";profile.title="Login, Registrierung und Abmeldung";profile.onclick=e=>{e.stopPropagation();showMenu()};}
    const sidebar=document.querySelector(".sidebar");
    let quick=document.querySelector("#authQuick");
    if(!quick&&sidebar){quick=document.createElement("button");quick.id="authQuick";quick.className="btn auth-quick";quick.type="button";sidebar.append(quick);}
    api()?.me?.().then(x=>setProfile(x.user)).catch(()=>setProfile(null));
    window.AuthUI={open,logout};
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance);else enhance();
})();