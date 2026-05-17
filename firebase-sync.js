/* BNS FIREBASE AUTO SYNC V196 - VEILIG
   Doel:
   - Eerst Firebase downloaden, daarna pas opslaan/uploaden.
   - Voorkomt dat INITIAL_STATE/localStorage demo-users terug naar Firebase worden geschreven.
   - User-verwijderingen in de site worden ook uit Firestore users verwijderd.
*/
(function(){
"use strict";
if(window.__bnsFirebaseAutoSyncV196)return; window.__bnsFirebaseAutoSyncV196=true;

const STORAGE_KEYS=["event-planner-pro-v87","event-planner-pro-v8","event-planner-pro","bns_event_planner"];
const COLLECTIONS=["users","orders","materials","customers","locations","alerts"];
const AUTO_KEY="bns_firebase_auto_sync_on";
let tools=null, uploading=false, downloading=false, started=false, ready=false, timer=null, lastJson="";

function status(t){
  let e=document.getElementById("bnsFirebaseStatus");
  if(!e){
    e=document.createElement("div");
    e.id="bnsFirebaseStatus";
    e.style.cssText="position:fixed;right:10px;bottom:10px;z-index:99999;background:#fff;color:#111;border:2px solid #0ea5e9;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900;box-shadow:0 8px 24px rgba(15,23,42,.22);opacity:.9;pointer-events:none";
    document.body.appendChild(e);
  }
  e.textContent=t;
}
function toast(t){try{if(typeof toastMsg==="function"){toastMsg(t);return}}catch(e){} console.log("[BNS Firebase]",t)}
function loadLocal(){
  for(const k of STORAGE_KEYS){
    try{const r=localStorage.getItem(k); if(r){const p=JSON.parse(r); if(p&&typeof p==="object")return p}}catch(e){}
  }
  try{if(window.state&&typeof window.state==="object")return window.state}catch(e){}
  return {};
}
function saveLocal(s){
  if(!s)return;
  try{localStorage.setItem(STORAGE_KEYS[0],JSON.stringify(s))}catch(e){}
  try{window.state=s}catch(e){}
}
function arr(s,k){s[k]=Array.isArray(s[k])?s[k]:[]}
function makeId(p){return p+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8)}
function ensureId(x,p){if(!x.id)x.id=makeId(p);return x}
function normRole(u){
  const r=String(u.role||u.type||u.functie||"").trim().toLowerCase();
  if(r==="admin") return "Admin";
  if(r==="planner") return "Planner";
  if(r==="bezorger"||r==="driver"||r==="chauffeur") return "Bezorger";
  if(u.rights&&u.rights.admin===true) return "Admin";
  if(u.rights&&u.rights.agenda===true&&u.rights.admin!==false) return "Planner";
  return "Bezorger";
}
function normUser(u){
  u=Object.assign({},u||{});
  ensureId(u,"u");
  u.name=String(u.name||u.naam||"").trim();
  u.pin=String(u.pin||"").trim();
  u.role=normRole(u);
  u.rights=Object.assign({},u.rights||{});
  return u;
}
function norm(s){
  s=s||{};
  ["users","orders","materials","customers","locations","alerts"].forEach(k=>arr(s,k));
  s.settings=s.settings||{};
  s.users=s.users.map(normUser).filter(u=>u.name||u.pin||u.id);
  s.orders.forEach(x=>ensureId(x,"o"));
  s.materials.forEach(x=>ensureId(x,"m"));
  s.customers.forEach(x=>ensureId(x,"c"));
  s.locations.forEach(x=>ensureId(x,"l"));
  s.alerts.forEach(x=>ensureId(x,"a"));
  return s;
}
function json(){try{return JSON.stringify(loadLocal()||{})}catch(e){return""}}
async function fb(){
  if(tools)return tools;
  if(!window.BNS_FIREBASE_CONFIG||window.BNS_FIREBASE_CONFIG.apiKey==="VUL_HIER_IN"){status("Firebase config ontbreekt");return null}
  const appMod=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const fsMod=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  const app=appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
  const db=fsMod.getFirestore(app);
  tools={fsMod,db};
  return tools;
}
async function getCollection(col){
  const t=await fb(); if(!t)return [];
  const snap=await t.fsMod.getDocs(t.fsMod.collection(t.db,col));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function getSettings(){
  const t=await fb(); if(!t)return {};
  const snap=await t.fsMod.getDoc(t.fsMod.doc(t.db,"settings","main"));
  return snap.exists() ? (snap.data()||{}) : {};
}
function rerender(){
  try{ if(typeof renderAll==="function") renderAll(); }catch(e){}
  try{ if(typeof renderOrders==="function") renderOrders(); }catch(e){}
  try{ if(typeof renderMaterials==="function") renderMaterials(window.currentCat||"EXTRA"); }catch(e){}
  try{ if(typeof adminRender==="function") adminRender(); }catch(e){}
}
async function download(reason){
  if(uploading||downloading)return;
  const t=await fb(); if(!t)return;
  downloading=true; status("Firebase laden...");
  try{
    const s=norm(loadLocal()||{});
    for(const col of COLLECTIONS){
      const rows=await getCollection(col);
      if(col==="users"){
        s.users=rows.map(normUser).filter(u=>u.name||u.pin||u.id);
      }else{
        s[col]=rows;
      }
    }
    s.settings=await getSettings();

    /* Als Firebase users heeft, is Firebase leidend. Geen demo-users uit INITIAL_STATE terugzetten. */
    saveLocal(s);
    lastJson=json();
    status("Firebase geladen");
    rerender();
    ready=true;
  }catch(e){console.error(e);status("Firebase download fout")}
  finally{downloading=false}
}
async function mirrorUsersToFirebase(t, localUsers){
  const localIds=new Set(localUsers.map(u=>String(u.id)));
  const snap=await t.fsMod.getDocs(t.fsMod.collection(t.db,"users"));
  for(const d of snap.docs){
    if(!localIds.has(String(d.id))){
      await t.fsMod.deleteDoc(t.fsMod.doc(t.db,"users",String(d.id)));
    }
  }
}
async function upload(reason){
  if(uploading||downloading||!ready)return;
  const t=await fb(); if(!t)return;
  const s=norm(loadLocal());
  if(!s)return;
  uploading=true; status("Firebase opslaan...");
  try{
    for(const col of COLLECTIONS){
      const rows=Array.isArray(s[col])?s[col]:[];
      if(col==="users"){
        await mirrorUsersToFirebase(t, rows);
      }
      for(const row of rows){
        ensureId(row,col.slice(0,1));
        if(col==="users") Object.assign(row,normUser(row));
        row.updatedAt=row.updatedAt||new Date().toISOString();
        await t.fsMod.setDoc(t.fsMod.doc(t.db,col,String(row.id)),row,{merge:true});
      }
    }
    await t.fsMod.setDoc(t.fsMod.doc(t.db,"settings","main"),s.settings||{},{merge:true});
    localStorage.setItem(AUTO_KEY,"1");
    saveLocal(s);
    lastJson=json();
    status("Firebase opgeslagen");
  }catch(e){console.error(e);status("Firebase upload fout")}
  finally{uploading=false}
}
function schedule(reason){
  if(!started||!ready||downloading)return;
  clearTimeout(timer);
  timer=setTimeout(()=>{const j=json(); if(j&&j!==lastJson)upload(reason||"auto")},1200);
}
function patchStorage(){
  if(localStorage.__bnsFbAutoV196)return;
  localStorage.__bnsFbAutoV196="1";
  const old=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){const r=old(k,v); if(STORAGE_KEYS.includes(k))schedule("localStorage"); return r};
}
function patchSave(){
  try{
    if(typeof window.save==="function"&&!window.save.__bnsFbAutoV196){
      const old=window.save;
      window.save=function(){const r=old.apply(this,arguments); schedule("save"); return r};
      window.save.__bnsFbAutoV196=true;
    }
  }catch(e){}
}
function addTools(){
  const p=new URLSearchParams(location.search);
  if(p.get("fbtools")!=="1")return;
  if(document.getElementById("bnsFirebaseTools"))return;
  const b=document.createElement("div");
  b.id="bnsFirebaseTools";
  b.style.cssText="position:fixed;right:12px;top:80px;z-index:99999;display:flex;gap:6px;flex-wrap:wrap;max-width:360px";
  b.innerHTML='<button id="bnsFbUpload" style="background:#16a34a;color:white;border:0;border-radius:10px;padding:10px;font-weight:900">Upload Firebase</button><button id="bnsFbDownload" style="background:#0ea5e9;color:white;border:0;border-radius:10px;padding:10px;font-weight:900">Download Firebase</button>';
  document.body.appendChild(b);
  document.getElementById("bnsFbUpload").onclick=()=>upload("manual");
  document.getElementById("bnsFbDownload").onclick=()=>download("manual");
}
async function start(){
  if(started)return; started=true;
  addTools();
  const t=await fb(); if(!t)return;
  /* Eerst downloaden. Pas daarna save/localStorage patchen, zodat lokale/demo-data niet naar Firebase wordt teruggeschreven. */
  await download("start");
  patchStorage();
  patchSave();
  lastJson=json();
  status("Firebase veilig actief");
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(start,700)); else setTimeout(start,700);
setInterval(patchSave,3000);
window.BNSFirebaseSync={uploadLocalToFirebase:upload,downloadFirebaseToLocal:download,startRealtimeSync:download};
})();
