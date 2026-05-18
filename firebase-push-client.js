/* BNS Push Client V1
   Plaats in HOOFDMAP als:
   /firebase-push-client.js

   Werkt met:
   - window.BNS_FIREBASE_CONFIG uit firebase-config.js
   - window.BNS_PUSH_VAPID_KEY uit firebase-push-config.js
*/
(function(){
  "use strict";

  if (window.__bnsPushClientV1) return;
  window.__bnsPushClientV1 = true;

  let app = null;
  let db = null;
  let messaging = null;
  let fs = null;
  let msg = null;

  function clean(v){ return String(v || "").trim(); }

  function getCurrentUser(){
    try{
      if (window.BNS && window.BNS.user) return window.BNS.user;
    }catch(e){}

    try{
      const keys = [
        "bns_driver_firebase_user_id",
        "bns_planner_firebase_user_id",
        "bns_driver_user_id",
        "bns_planner_user_id"
      ];
      for (const key of keys) {
        const id = sessionStorage.getItem(key);
        if (id) return { id };
      }
    }catch(e){}

    return null;
  }

  function toast(text){
    try{
      const el = document.getElementById("toast");
      if (el) {
        el.textContent = text;
        el.classList.add("show");
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove("show"), 3500);
        return;
      }
    }catch(e){}

    alert(text);
  }

  function ensureButton(){
    if (document.getElementById("bnsPushEnableBtn")) return;

    const btn = document.createElement("button");
    btn.id = "bnsPushEnableBtn";
    btn.type = "button";
    btn.textContent = "🔔 Meldingen aanzetten";
    btn.style.cssText = [
      "position:fixed",
      "left:12px",
      "bottom:12px",
      "z-index:99999",
      "background:#16a34a",
      "color:#fff",
      "border:0",
      "border-radius:16px",
      "padding:12px 14px",
      "font-size:15px",
      "font-weight:950",
      "box-shadow:0 12px 36px rgba(15,23,42,.25)"
    ].join(";");

    btn.onclick = enablePush;
    document.body.appendChild(btn);
  }

  async function init(){
    if (!window.BNS_FIREBASE_CONFIG || window.BNS_FIREBASE_CONFIG.apiKey === "VUL_HIER_IN") {
      console.warn("[BNS Push] firebase-config ontbreekt");
      return false;
    }

    if (!window.BNS_PUSH_VAPID_KEY || window.BNS_PUSH_VAPID_KEY === "VUL_HIER_VAPID_KEY_IN") {
      console.warn("[BNS Push] VAPID key ontbreekt");
      ensureButton();
      return false;
    }

    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    fs = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    msg = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js");

    app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
    db = fs.getFirestore(app);
    messaging = msg.getMessaging(app);

    msg.onMessage(messaging, (payload) => {
      const title =
        payload.notification?.title ||
        payload.data?.title ||
        "BNS melding";

      const body =
        payload.notification?.body ||
        payload.data?.body ||
        "Nieuwe update in de planning";

      toast(title + "\n" + body);
    });

    return true;
  }

  async function enablePush(){
    try{
      const ok = await init();
      if (!ok) {
        toast("Push config ontbreekt. Vul eerst VAPID key in.");
        return;
      }

      if (!("Notification" in window)) {
        toast("Deze telefoon/browser ondersteunt geen meldingen.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        toast("Meldingen zijn niet toegestaan.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

      const token = await msg.getToken(messaging, {
        vapidKey: window.BNS_PUSH_VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      console.log("PUSH TOKEN:", token);

      if (!token) {
        toast("Geen push-token gekregen.");
        return;
      }

      const user = getCurrentUser();

      if (!user || !user.id) {
        toast("Log eerst in, daarna meldingen aanzetten.");
        return;
      }

      const tokenId = token.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 150);

      await fs.setDoc(
        fs.doc(db, "pushTokens", tokenId),
        {
          token,
          userId: String(user.id),
          userName: clean(user.name || ""),
          role: clean(user.role || ""),
          userAgent: navigator.userAgent,
          updatedAt: new Date().toISOString(),
          active: true
        },
        { merge: true }
      );

      toast("Telefoonmeldingen staan aan.");
      const btn = document.getElementById("bnsPushEnableBtn");
      if (btn) btn.textContent = "🔔 Meldingen actief";
    }catch(error){
      console.error("[BNS Push] fout", error);
      toast("Push fout: " + error.message);
    }
  }

  window.BNSPush = {
    enablePush
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(ensureButton, 1200));
  } else {
    setTimeout(ensureButton, 1200);
  }
})();
