/* =========================================================
   BNS FIREBASE SYNC V1
   Los bestand voor hoofdapp/admin.
   app.js blijft met rust.
   Zet data uit localStorage naar Firebase en haalt Firebase terug.
   ========================================================= */
(function(){
  "use strict";

  const STORAGE_KEYS = [
    "event-planner-pro-v87",
    "event-planner-pro-v8",
    "event-planner-pro",
    "bns_event_planner"
  ];

  const COLLECTIONS = ["users", "orders", "materials", "customers", "locations", "alerts", "settings"];
  const SYNC_STATE_KEY = "bns_firebase_sync_enabled";

  function toast(text){
    try{
      if(typeof toastMsg === "function"){ toastMsg(text); return; }
    }catch(e){}
    console.log("[BNS Firebase]", text);
  }

  function loadLocalState(){
    for(const key of STORAGE_KEYS){
      try{
        const raw = localStorage.getItem(key);
        if(raw){
          const parsed = JSON.parse(raw);
          if(parsed && typeof parsed === "object") return parsed;
        }
      }catch(e){}
    }
    return null;
  }

  function saveLocalState(state){
    if(!state) return;
    try{
      localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(state));
      window.state = state;
    }catch(e){}
  }

  function ensureId(item, prefix){
    if(!item.id) item.id = prefix + "_" + Math.random().toString(36).slice(2,10);
    return item;
  }

  function normalizeState(state){
    state = state || {};
    state.users = Array.isArray(state.users) ? state.users : [];
    state.orders = Array.isArray(state.orders) ? state.orders : [];
    state.materials = Array.isArray(state.materials) ? state.materials : [];
    state.customers = Array.isArray(state.customers) ? state.customers : [];
    state.locations = Array.isArray(state.locations) ? state.locations : [];
    state.alerts = Array.isArray(state.alerts) ? state.alerts : [];
    state.settings = state.settings || {};
    state.users.forEach(x=>ensureId(x,"u"));
    state.orders.forEach(x=>ensureId(x,"o"));
    state.materials.forEach(x=>ensureId(x,"m"));
    state.customers.forEach(x=>ensureId(x,"c"));
    state.locations.forEach(x=>ensureId(x,"l"));
    state.alerts.forEach(x=>ensureId(x,"a"));
    return state;
  }

  async function loadFirebaseTools(){
    if(!window.BNS_FIREBASE_CONFIG || window.BNS_FIREBASE_CONFIG.apiKey === "VUL_HIER_IN"){
      toast("Firebase config ontbreekt nog");
      return null;
    }

    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

    const app = appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
    const db = fsMod.getFirestore(app);

    return {appMod, fsMod, db};
  }

  async function uploadLocalToFirebase(){
    const tools = await loadFirebaseTools();
    if(!tools) return;

    const {fsMod, db} = tools;
    const state = normalizeState(loadLocalState());

    if(!state){
      toast("Geen lokale data gevonden om te uploaden");
      return;
    }

    for(const collectionName of COLLECTIONS){
      if(collectionName === "settings"){
        await fsMod.setDoc(fsMod.doc(db, "settings", "main"), state.settings || {}, {merge:true});
        continue;
      }

      const rows = Array.isArray(state[collectionName]) ? state[collectionName] : [];

      for(const row of rows){
        ensureId(row, collectionName.slice(0,1));
        row.updatedAt = row.updatedAt || new Date().toISOString();
        await fsMod.setDoc(fsMod.doc(db, collectionName, String(row.id)), row, {merge:true});
      }
    }

    localStorage.setItem(SYNC_STATE_KEY, "1");
    saveLocalState(state);
    toast("Firebase upload klaar");
  }

  async function downloadFirebaseToLocal(){
    const tools = await loadFirebaseTools();
    if(!tools) return;

    const {fsMod, db} = tools;
    const state = normalizeState(loadLocalState() || {});

    for(const collectionName of COLLECTIONS){
      if(collectionName === "settings"){
        const snap = await fsMod.getDoc(fsMod.doc(db, "settings", "main"));
        if(snap.exists()) state.settings = snap.data() || {};
        continue;
      }

      const snap = await fsMod.getDocs(fsMod.collection(db, collectionName));
      state[collectionName] = snap.docs.map(d => ({id:d.id, ...d.data()}));
    }

    saveLocalState(state);
    localStorage.setItem(SYNC_STATE_KEY, "1");

    try{
      if(typeof renderOrders === "function") renderOrders();
      if(typeof renderMaterials === "function") renderMaterials(window.currentCat || "EXTRA");
      if(typeof adminRender === "function") adminRender();
    }catch(e){}

    toast("Firebase data geladen");
  }

  async function startRealtimeSync(){
    const tools = await loadFirebaseTools();
    if(!tools) return;

    const {fsMod, db} = tools;

    COLLECTIONS.forEach(collectionName => {
      if(collectionName === "settings"){
        fsMod.onSnapshot(fsMod.doc(db, "settings", "main"), snap => {
          const state = normalizeState(loadLocalState() || {});
          if(snap.exists()) state.settings = snap.data() || {};
          saveLocalState(state);
        });
        return;
      }

      fsMod.onSnapshot(fsMod.collection(db, collectionName), snap => {
        const state = normalizeState(loadLocalState() || {});
        state[collectionName] = snap.docs.map(d => ({id:d.id, ...d.data()}));
        saveLocalState(state);
      });
    });

    toast("Firebase live sync actief");
  }

  function addButtons(){
    if(document.getElementById("bnsFirebaseTools")) return;

    const box = document.createElement("div");
    box.id = "bnsFirebaseTools";
    box.style.cssText = "position:fixed;right:12px;top:70px;z-index:99999;display:flex;gap:6px;flex-wrap:wrap;max-width:360px;";
    box.innerHTML = `
      <button type="button" id="bnsFbUpload" style="background:#16a34a;color:white;border:0;border-radius:10px;padding:10px;font-weight:900;">Upload naar Firebase</button>
      <button type="button" id="bnsFbDownload" style="background:#0ea5e9;color:white;border:0;border-radius:10px;padding:10px;font-weight:900;">Download Firebase</button>
      <button type="button" id="bnsFbLive" style="background:#334155;color:white;border:0;border-radius:10px;padding:10px;font-weight:900;">Live sync</button>
    `;
    document.body.appendChild(box);

    document.getElementById("bnsFbUpload").onclick = uploadLocalToFirebase;
    document.getElementById("bnsFbDownload").onclick = downloadFirebaseToLocal;
    document.getElementById("bnsFbLive").onclick = startRealtimeSync;
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", () => setTimeout(addButtons, 800));
  }else{
    setTimeout(addButtons, 800);
  }

  window.BNSFirebaseSync = {
    uploadLocalToFirebase,
    downloadFirebaseToLocal,
    startRealtimeSync
  };
})();
