/* Tapwagen.nl push client - FIX4 veilig
   Push is optioneel. Deze file mag de telefoon/planner nooit blokkeren.
   Er verschijnt geen knop meer automatisch. Bezorger -> planner meldingen werken via Firebase alerts, niet via push.
*/
(function(){
  "use strict";
  if(window.__tapwagenPushFix4) return;
  window.__tapwagenPushFix4 = true;
  var app=null, db=null, messaging=null, fs=null, msg=null;
  var scriptUrl = (document.currentScript && document.currentScript.src) || (location.origin + location.pathname);
  function toast(text){
    try{ var el=document.getElementById('toast'); if(el){ el.textContent=String(text||''); el.classList.add('show'); clearTimeout(el._timer); el._timer=setTimeout(function(){el.classList.remove('show');},3000); return; } }catch(e){}
    console.log('[Tapwagen push]', text);
  }
  function currentUser(){
    try{ if(window.BNS && window.BNS.user) return window.BNS.user; }catch(e){}
    try{ var keys=['tapwagen_driver_user_id_v143','bns_driver_firebase_user_id','bns_planner_firebase_user_id','bns_driver_user_id','bns_planner_user_id']; for(var i=0;i<keys.length;i++){ var id=sessionStorage.getItem(keys[i]); if(id) return {id:id}; } }catch(e){}
    return null;
  }
  async function init(){
    try{
      if(!window.BNS_FIREBASE_CONFIG || window.BNS_FIREBASE_CONFIG.apiKey==='VUL_HIER_IN') return false;
      if(!window.BNS_PUSH_VAPID_KEY || window.BNS_PUSH_VAPID_KEY==='VUL_HIER_VAPID_KEY_IN') return false;
      var appMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
      fs = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
      msg = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js');
      app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
      db = fs.getFirestore(app);
      messaging = msg.getMessaging(app);
      try{ msg.onMessage(messaging,function(payload){ var title=(payload.notification&&payload.notification.title)||(payload.data&&payload.data.title)||'Tapwagen melding'; var body=(payload.notification&&payload.notification.body)||(payload.data&&payload.data.body)||'Nieuwe update'; toast(title+'\n'+body); }); }catch(e){}
      return true;
    }catch(e){ console.warn('[Tapwagen push] init overgeslagen', e); return false; }
  }
  async function enablePush(){
    try{
      if(!('serviceWorker' in navigator) || !('Notification' in window)){ toast('Pushmeldingen worden niet ondersteund op dit apparaat.'); return false; }
      var ok = await init();
      if(!ok){ toast('Push staat nog niet ingericht. Planner meldingen werken wel gewoon.'); return false; }
      var permission = await Notification.requestPermission();
      if(permission !== 'granted'){ toast('Meldingen zijn niet toegestaan.'); return false; }
      var swUrl = new URL('firebase-messaging-sw.js', scriptUrl).href;
      var registration = await navigator.serviceWorker.register(swUrl, {scope: new URL('./', scriptUrl).pathname});
      var token = await msg.getToken(messaging,{vapidKey:window.BNS_PUSH_VAPID_KEY,serviceWorkerRegistration:registration});
      if(!token){ toast('Geen push-token gekregen.'); return false; }
      var user=currentUser(); if(!user || !user.id){ toast('Log eerst in, daarna meldingen aanzetten.'); return false; }
      var tokenId=String(token).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,150);
      await fs.setDoc(fs.doc(db,'pushTokens',tokenId),{token:token,userId:String(user.id),userName:String(user.name||''),role:String(user.role||''),userAgent:navigator.userAgent,updatedAt:new Date().toISOString(),active:true},{merge:true});
      toast('Telefoonmeldingen staan aan.'); return true;
    }catch(e){ console.warn('[Tapwagen push] niet actief', e); toast('Pushmelding niet actief. Planner meldingen werken wel.'); return false; }
  }
  window.BNSPush = {enablePush:enablePush};
  // Geen automatische knop meer: de 404 melding door GitHub Pages serviceworker mag de telefoon niet blokkeren.
})();
