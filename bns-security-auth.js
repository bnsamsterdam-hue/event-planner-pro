/* =========================================================
   BNS 537 - Firebase echte login beveiliging
   - Verplicht Firebase Authentication voordat Firestore wordt gebruikt
   - Bestaande PIN-login blijft daarna gewoon bestaan
   - Geen rollenlogica in deze file; Firestore rules doen de databescherming
   ========================================================= */
(function(){
  "use strict";
  if(window.BNSSecurityAuth) return;

  var VERSION = "BNS 539 security auth vaste Firebase config";
  var FIREBASE_VERSION = "10.12.5";
  var authPromise = null;
  var appModPromise = null;
  var authModPromise = null;

  function loadAppMod(){
    if(!appModPromise) appModPromise = import("https://www.gstatic.com/firebasejs/"+FIREBASE_VERSION+"/firebase-app.js");
    return appModPromise;
  }
  function loadAuthMod(){
    if(!authModPromise) authModPromise = import("https://www.gstatic.com/firebasejs/"+FIREBASE_VERSION+"/firebase-auth.js");
    return authModPromise;
  }
  function esc(v){
    return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
  }
  function ensureStyle(){
    if(document.getElementById("bnsSecurityAuthStyle")) return;
    var s=document.createElement("style");
    s.id="bnsSecurityAuthStyle";
    s.textContent =
      "#bnsSecurityAuthOverlay{position:fixed;inset:0;z-index:2147483000;background:linear-gradient(135deg,#0f172a,#0ea5e9);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,Segoe UI,sans-serif}"+
      "#bnsSecurityAuthCard{width:min(460px,96vw);background:#fff;border-radius:24px;padding:26px;box-shadow:0 24px 90px rgba(0,0,0,.35);color:#0f172a}"+
      "#bnsSecurityAuthCard h2{margin:0 0 8px;font-size:28px;line-height:1.1}"+
      "#bnsSecurityAuthCard p{margin:0 0 16px;color:#475569;font-weight:700}"+
      "#bnsSecurityAuthCard label{display:block;margin:12px 0 6px;font-weight:900}"+
      "#bnsSecurityAuthCard input{width:100%;box-sizing:border-box;border:2px solid #cbd5e1;border-radius:14px;padding:13px;font-size:16px}"+
      "#bnsSecurityAuthCard button{width:100%;margin-top:16px;border:0;border-radius:14px;background:#16a34a;color:#fff;font-weight:900;font-size:17px;padding:14px;cursor:pointer}"+
      "#bnsSecurityAuthCard button:disabled{opacity:.65;cursor:wait}"+
      "#bnsSecurityAuthError{margin-top:12px;color:#b91c1c;font-weight:900;min-height:20px}"+
      "#bnsSecurityAuthSmall{display:block;margin-top:14px;color:#64748b;font-size:13px;line-height:1.35}"+
      ".bns-security-logout{position:fixed;right:12px;top:12px;z-index:2147482000;background:#0f172a;color:#fff;border:0;border-radius:999px;padding:9px 13px;font-weight:900;box-shadow:0 8px 28px rgba(0,0,0,.25);cursor:pointer}";
    document.head.appendChild(s);
  }
  function showOverlay(auth, authMod){
    ensureStyle();
    var old=document.getElementById("bnsSecurityAuthOverlay");
    if(old) old.remove();
    var remembered="";
    try{remembered=localStorage.getItem("bns_security_email")||"";}catch(e){}
    var div=document.createElement("div");
    div.id="bnsSecurityAuthOverlay";
    div.innerHTML =
      '<form id="bnsSecurityAuthCard">'+
        '<h2>Beveiligde toegang</h2>'+
        '<p>Log eerst in met Firebase. Daarna werkt de normale PIN-login zoals voorheen.</p>'+
        '<label>E-mail</label>'+
        '<input id="bnsSecurityEmail" type="email" autocomplete="username" value="'+esc(remembered)+'" placeholder="naam@bedrijf.nl" required>'+
        '<label>Wachtwoord</label>'+
        '<input id="bnsSecurityPass" type="password" autocomplete="current-password" placeholder="Firebase wachtwoord" required>'+
        '<button id="bnsSecurityBtn" type="submit">Inloggen</button>'+
        '<div id="bnsSecurityAuthError"></div>'+
        '<small id="bnsSecurityAuthSmall">Deze login beschermt Firebase-data. De app-PIN blijft voor Admin/Planner/Bezorger rechten.</small>'+
      '</form>';
    document.body.appendChild(div);
    var form=document.getElementById("bnsSecurityAuthCard");
    var btn=document.getElementById("bnsSecurityBtn");
    var err=document.getElementById("bnsSecurityAuthError");
    form.addEventListener("submit", async function(e){
      e.preventDefault();
      var email=(document.getElementById("bnsSecurityEmail").value||"").trim();
      var pass=document.getElementById("bnsSecurityPass").value||"";
      if(!email || !pass) return;
      btn.disabled=true; btn.textContent="Inloggen..."; err.textContent="";
      try{
        await authMod.setPersistence(auth, authMod.browserLocalPersistence);
        var cred = await authMod.signInWithEmailAndPassword(auth,email,pass);
        try{localStorage.setItem("bns_security_email", email);}catch(_){ }
        div.remove();
        installLogout(auth, authMod, cred.user);
      }catch(ex){
        console.error("[BNS Security] login fout", ex);
        var code = ex && ex.code ? String(ex.code) : "onbekende fout";
        var msg = "Login mislukt: " + code;
        if(code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"){
          msg += " - e-mail of wachtwoord klopt niet exact.";
        } else if(code === "auth/operation-not-allowed"){
          msg += " - Email/Password staat nog niet goed aan in Firebase Authentication.";
        } else if(code === "auth/unauthorized-domain"){
          msg += " - dit domein staat niet bij Authorized domains.";
        } else if(code === "auth/invalid-api-key" || code === "auth/api-key-not-valid"){
          msg += " - Firebase API key/config klopt niet of is beperkt.";
        } else if(code === "auth/network-request-failed"){
          msg += " - netwerk/verbinding probleem.";
        }
        err.textContent = msg;
        btn.disabled=false; btn.textContent="Inloggen";
      }
    });
  }
  function installLogout(auth, authMod, user){
    try{
      if(document.getElementById("bnsSecurityLogoutBtn")) return;
      var b=document.createElement("button");
      b.id="bnsSecurityLogoutBtn";
      b.className="bns-security-logout";
      b.type="button";
      b.title=(user&&user.email)?("Firebase login: "+user.email):"Firebase login";
      b.textContent="Beveiligd";
      b.onclick=async function(){
        if(!confirm("Firebase uitloggen? De app sluit dan af tot opnieuw inloggen.")) return;
        await authMod.signOut(auth);
        location.reload();
      };
      document.body.appendChild(b);
    }catch(e){}
  }
  async function ensureAuth(){
    if(authPromise) return authPromise;
    authPromise = (async function(){
      var fixedConfig = {
        apiKey: "1:343572783519:web:7fd4995fe012c8b51f1daa",
        authDomain: "event-planner-pro-bbcdc.firebaseapp.com",
        projectId: "event-planner-pro-bbcdc",
        storageBucket: "event-planner-pro-bbcdc.firebasestorage.app",
        messagingSenderId: "343572783519",
        appId: "1:343572783519:web:7fd4995fe012c8b51f1daa"
      };
      try { window.BNS_FIREBASE_CONFIG = fixedConfig; } catch(e) {}
      var appMod = await loadAppMod();
      var authMod = await loadAuthMod();
      var apps = appMod.getApps();
      var app = apps.length ? apps[0] : appMod.initializeApp(fixedConfig);
      var auth = authMod.getAuth(app);
      await authMod.setPersistence(auth, authMod.browserLocalPersistence);
      var user = await new Promise(function(resolve){
        var unsub = authMod.onAuthStateChanged(auth, function(u){ try{unsub();}catch(e){} resolve(u); });
      });
      if(user){ installLogout(auth, authMod, user); return user; }
      showOverlay(auth, authMod);
      user = await new Promise(function(resolve){
        var unsub = authMod.onAuthStateChanged(auth, function(u){ if(u){ try{unsub();}catch(e){} resolve(u); } });
      });
      installLogout(auth, authMod, user);
      return user;
    })();
    return authPromise;
  }
  window.BNSSecurityAuth = { version: VERSION, ensureAuth: ensureAuth };
  console.info("[BNS 539] Firebase Auth beveiliging actief met vaste Firebase config.");
})();
