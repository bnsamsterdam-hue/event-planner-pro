/* BNS FIREBASE AUTO SYNC V460 */
(function(){
"use strict";
if(window.__bnsFirebaseAutoSyncV2)return; window.__bnsFirebaseAutoSyncV2=true;

const STORAGE_KEYS=["event-planner-pro-v87","event-planner-pro-v8","event-planner-pro","bns_event_planner"];
const COLLECTIONS=["users","orders","materials","customers","locations","alerts","settings"];
const UPLOAD_COLLECTIONS=["orders","materials","customers","locations","alerts","settings"]; // V197: users nooit massaal uploaden vanuit localStorage/INITIAL_STATE
const AUTO_KEY="bns_firebase_auto_sync_on";
let tools=null, uploading=false, downloading=false, started=false, timer=null, lastJson="";

function status(t){
  let e=document.getElementById("bnsFirebaseStatus");
  if(!e){
    e=document.createElement("div");
    e.id="bnsFirebaseStatus";
    e.style.cssText="position:fixed;right:10px;bottom:10px;z-index:99999;background:#fff;color:#111;border:2px solid #0ea5e9;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900;box-shadow:0 8px 24px rgba(15,23,42,.22);opacity:.85;pointer-events:none";
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
  return null;
}
function saveLocal(s){
  if(!s)return;
  try{localStorage.setItem(STORAGE_KEYS[0],JSON.stringify(s))}catch(e){}
  try{window.state=s}catch(e){}
}
function arr(s,k){s[k]=Array.isArray(s[k])?s[k]:[]}
function id(x,p){if(!x.id)x.id=p+"_"+Math.random().toString(36).slice(2,10);return x}
function isAddMaterialLine(m){
  return !!(m&&String(m.id||"").match(/^add[_-]/i));
}
function cleanMaterialStatuses(s){
  try{
    if(!s||!Array.isArray(s.materials))return s;
    s.materials=s.materials.filter(m=>!isAddMaterialLine(m));
    s.materials.forEach(m=>{
      if(!m)return;
      const st=String(m.status||"").toLowerCase();
      if(/reserved|gereserveerd|bezet|geboekt/.test(st))m.status="free";
    });
  }catch(e){}
  return s;
}
function norm(s){
  s=s||{}; ["users","orders","materials","customers","locations","alerts"].forEach(k=>arr(s,k)); s.settings=s.settings||{};
  s.users.forEach(x=>id(x,"u")); s.orders.forEach(x=>id(x,"o")); s.materials.forEach(x=>id(x,"m")); s.customers.forEach(x=>id(x,"c")); s.locations.forEach(x=>id(x,"l")); s.alerts.forEach(x=>id(x,"a"));
  cleanMaterialStatuses(s);
  return s;
}
function json(){try{return JSON.stringify(loadLocal()||{})}catch(e){return""}}
async function fb(){
  if(tools)return tools;
  if(!window.BNS_FIREBASE_CONFIG||window.BNS_FIREBASE_CONFIG.apiKey==="VUL_HIER_IN"){status("Firebase config ontbreekt");return null}
  const appMod=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const fsMod=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  const app=appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
  const db=fsMod.getFirestore(app);
  tools={fsMod,db};
  return tools;
}
async function remoteDoc(col,docid){
  const t=await fb(); if(!t||!docid)return null;
  const s=await t.fsMod.getDoc(t.fsMod.doc(t.db,col,String(docid)));
  return s.exists()?s.data():null;
}
function keep(local,remote,k){
  if(!remote)return;
  if((local[k]===undefined||local[k]===null||local[k]==="")&&remote[k]!==undefined&&remote[k]!==null&&remote[k]!=="")local[k]=remote[k];
}

/* BNS v460 sync helpers */
function bns460SplitList(v){
  if(v===undefined||v===null)return[];
  if(Array.isArray(v)){let out=[];v.forEach(x=>out=out.concat(bns460SplitList(x)));return out;}
  if(typeof v==="object")return bns460SplitList([v.id,v.uid,v.name,v.naam,v.displayName].filter(Boolean));
  return String(v).split(/[;,\n|]+/).map(x=>String(x||"").trim()).filter(Boolean);
}
function bns460Unique(a){
  const s={}; const out=[];
  (a||[]).forEach(x=>{const v=String(x||"").trim();const k=v.toLowerCase();if(v&&!s[k]){s[k]=1;out.push(v);}});
  return out;
}
function bns460Lower(v){return String(v||"").trim().toLowerCase();}
function bns460Folder(o){
  const id=String(o&&(o.id||o.docId||o.orderId)||"");
  if(id.indexOf("old_")===0)return"archief";
  const f=bns460Lower(o&&(o.folder||o.map||o.orderFolder));
  if(f){ if(f==="live")return"lopend"; if(f==="optie")return"optie14"; if(f==="old")return"archief"; return f; }
  const s=bns460Lower(o&&(o.status||o.state||o.orderStatus));
  if(/offerte/.test(s))return"offerte";
  if(/optie|14/.test(s))return"optie14";
  if(/geann|annul|cancel|verwijderd|deleted|trash/.test(s))return"geannuleerd";
  if(/uitgevoerd|afgerond|done|klaar|afgemeld/.test(s))return"uitgevoerd";
  if(/bevestigd|opdrachtbevestiging|opdracht bevestigd|opdracht|actief|lopend/.test(s))return"lopend";
  return"";
}
function bns460ClearDrivers(o){
  if(!o)return o;
  ["driver","driverId","driverName","bezorger","bezorgerId","bezorgerName","assignedDriver","assignedDriverId","assignedDriverName","userId"].forEach(k=>o[k]="");
  ["driverIds","driverNames","bezorgerIds","bezorgerNames","assignedDriverIds","assignedDriverNames","userIds","drivers","bezorgers","driverList"].forEach(k=>o[k]=[]);
  return o;
}
function bns460NormalizeDrivers(o){
  if(!o)return o;
  const ids=bns460Unique([].concat(bns460SplitList(o.driverIds),bns460SplitList(o.bezorgerIds),bns460SplitList(o.assignedDriverIds),bns460SplitList(o.userIds),bns460SplitList(o.driverId),bns460SplitList(o.bezorgerId),bns460SplitList(o.assignedDriverId),bns460SplitList(o.userId)));
  const names=bns460Unique([].concat(bns460SplitList(o.driverNames),bns460SplitList(o.bezorgerNames),bns460SplitList(o.assignedDriverNames),bns460SplitList(o.driverName),bns460SplitList(o.driver),bns460SplitList(o.bezorger),bns460SplitList(o.bezorgerName),bns460SplitList(o.assignedDriver),bns460SplitList(o.assignedDriverName)));
  o.driverIds=ids; o.bezorgerIds=ids; o.assignedDriverIds=ids; o.userIds=ids;
  o.driverNames=names; o.bezorgerNames=names; o.assignedDriverNames=names;
  o.driver=names.join(", "); o.bezorger=names.join(", "); o.driverName=names.join(", "); o.bezorgerName=names.join(", ");
  return o;
}
function bns460DriverCount(o){
  return bns460Unique([].concat(bns460SplitList(o&&o.driverIds),bns460SplitList(o&&o.bezorgerIds),bns460SplitList(o&&o.driverNames),bns460SplitList(o&&o.bezorgerNames),bns460SplitList(o&&o.driver),bns460SplitList(o&&o.bezorger),bns460SplitList(o&&o.driverName),bns460SplitList(o&&o.bezorgerName))).length;
}
function bns460NormalizeOrder(o){
  if(!o)return o;
  o.folder=bns460Folder(o);
  if(o.folder!=="lopend")bns460ClearDrivers(o);
  else bns460NormalizeDrivers(o);
  return o;
}
function bns460IsPhoneClient(){
  const h=String(location.href||"").toLowerCase();
  const b=String(document.body&&document.body.innerText||"").toLowerCase();
  return h.indexOf("/driver")>=0||h.indexOf("bezorger")>=0||h.indexOf("telefoon")>=0||b.indexOf("mobiele opdrachten")>=0||b.indexOf("bezorger tapwagen")>=0;
}
function bns460FilterRows(col,rows){
  rows=(rows||[]).map(o=>col==="orders"?bns460NormalizeOrder(o):o);
  if(col==="orders"&&bns460IsPhoneClient())return rows.filter(o=>o.folder==="lopend");
  return rows;
}


/* BNS v461 sync extra: lege bezorger blijft leeg */
function bns461IsEmptyDriverOrder(o){
  try{ return bns460DriverCount(o)===0; }catch(e){ return false; }
}

function preserveOrder(local,remote){
  if(!local)return local;
  bns460NormalizeOrder(local);
  if(!remote)return local;
  bns460NormalizeOrder(remote);

  // BNS v460: als planner lokaal bezorgers heeft gewist, remote niet terugzetten.
  const lc=bns460DriverCount(local), rc=bns460DriverCount(remote);
  if(local.folder==="lopend" && lc>0 && rc>lc){
    ["driverId","bezorgerId","userId","assignedDriverId","driverName","driver","bezorger","bezorgerName","assignedDriver"].forEach(k=>keep(local,remote,k));
    ["driverIds","bezorgerIds","userIds","assignedDriverIds","driverNames","bezorgerNames","assignedDriverNames","drivers","bezorgers"].forEach(k=>{
      if(Array.isArray(remote[k])&&remote[k].length>(Array.isArray(local[k])?local[k].length:0))local[k]=remote[k];
    });
    bns460NormalizeDrivers(local);
  }
  return local;
}
async function upload(reason){
  if(uploading||downloading)return;
  const t=await fb(); if(!t)return;
  const s=norm(loadLocal()); if(!s)return;
  uploading=true; status("Firebase opslaan...");
  try{
    for(const col of UPLOAD_COLLECTIONS){
      if(col==="settings"){
        await t.fsMod.setDoc(t.fsMod.doc(t.db,"settings","main"),s.settings||{},{merge:true});
        continue;
      }
      const rows=Array.isArray(s[col])?s[col]:[];
      for(const row of rows){
        id(row,col.slice(0,1));
        if(col==="orders"){
          bns460NormalizeOrder(row);
          if(row.folder==="archief"){
            console.warn("[BNS v460] old_/archief order niet opnieuw als live geupload", row.id);
            continue;
          }
          const rem=await remoteDoc("orders",row.id);
          if(rem && rem.updatedAt && (!row.updatedAt || rem.updatedAt>row.updatedAt)){
            // Firebase is nieuwer: lokale oude versie niet terugschrijven.
            bns460NormalizeOrder(rem);
            Object.keys(row).forEach(k=>delete row[k]);
            Object.assign(row,rem);
            continue;
          }
          preserveOrder(row,rem);
          bns460NormalizeOrder(row);
        }
        row.updatedAt=row.updatedAt||new Date().toISOString();
        await t.fsMod.setDoc(t.fsMod.doc(t.db,col,String(row.id)),row,{merge:true});
      }
    }
    localStorage.setItem(AUTO_KEY,"1");
    saveLocal(s);
    lastJson=json();
    status("Firebase opgeslagen");
  }catch(e){console.error(e);status("Firebase upload fout")}
  finally{uploading=false}
}
async function download(){
  if(uploading||downloading)return;
  const t=await fb(); if(!t)return;
  downloading=true; status("Firebase laden...");
  try{
    const s=norm(loadLocal()||{});
    for(const col of UPLOAD_COLLECTIONS){
      if(col==="settings"){
        const snap=await t.fsMod.getDoc(t.fsMod.doc(t.db,"settings","main"));
        if(snap.exists())s.settings=snap.data()||{};
        continue;
      }
      const snap=await t.fsMod.getDocs(t.fsMod.collection(t.db,col));
      s[col]=bns460FilterRows(col,snap.docs.map(d=>({id:d.id,...d.data()})));
      if(col==="materials")cleanMaterialStatuses(s);
    }
    saveLocal(s); lastJson=json(); status("Firebase geladen");
    try{if(typeof renderOrders==="function")renderOrders();}catch(e){}
  }catch(e){console.error(e);status("Firebase download fout")}
  finally{downloading=false}
}
function schedule(reason){
  if(!started||downloading)return;
  clearTimeout(timer);
  timer=setTimeout(()=>{const j=json(); if(j&&j!==lastJson)upload(reason||"auto")},1800);
}
function patchStorage(){
  if(localStorage.__bnsFbAutoV2)return;
  localStorage.__bnsFbAutoV2="1";
  const old=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){const r=old(k,v); if(STORAGE_KEYS.includes(k))schedule("localStorage"); return r};
}
function patchSave(){
  try{
    if(typeof window.save==="function"&&!window.save.__bnsFbAutoV2){
      const old=window.save;
      window.save=function(){const r=old.apply(this,arguments); schedule("save"); return r};
      window.save.__bnsFbAutoV2=true;
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
  document.getElementById("bnsFbDownload").onclick=download;
}
async function live(){
  const t = await fb(); if(!t)return;
  COLLECTIONS.forEach(col=>{
    if(col==="settings"){
      t.fsMod.onSnapshot(t.fsMod.doc(t.db,"settings","main"), snap=>{
        if(uploading)return;
        const s=norm(loadLocal()||{}); if(snap.exists())s.settings=snap.data()||{};
        downloading=true; saveLocal(s); downloading=false; lastJson=json();
      });
      return;
    }
    t.fsMod.onSnapshot(t.fsMod.collection(t.db,col), snap=>{
      if(uploading)return;
      const s=norm(loadLocal()||{});
      s[col]=bns460FilterRows(col,snap.docs.map(d=>({id:d.id,...d.data()})));
      if(col==="materials")cleanMaterialStatuses(s);
      downloading=true; saveLocal(s); downloading=false; lastJson=json();
      try{
        if(col==="orders"&&typeof renderOrders==="function")renderOrders();
        if(col==="alerts"){
          if(typeof renderDriver==="function")renderDriver();
          var ab=document.getElementById("alertsBtn");
          if(ab){var oc=(window.__bnsState||loadLocal()||{}).alerts||[];ab.textContent="Systeemmeldingen ("+(oc.filter(function(a){return !a.resolved;}).length)+")";}
          try{if(typeof toastMsg==="function")toastMsg("Nieuwe bezorger melding ontvangen");}catch(e){}
        }
        if(col==="materials"){
          clearTimeout(window.__bnsFbMatTimer);
          window.__bnsFbMatTimer=setTimeout(function(){
            try{
              var panel=document.getElementById("materialPanel");
              var isVisible=panel&&!panel.classList.contains("hidden");
              if(isVisible&&typeof renderMaterials==="function")renderMaterials(window.currentCat||"TW");
            }catch(e){}
          },300);
        }
      }catch(e){}
    });
  });
  localStorage.setItem(AUTO_KEY,"1");
  status("Firebase live actief");
}
async function start(){
  if(started)return; started=true;
  patchStorage(); patchSave(); addTools(); lastJson=json();
  const t=await fb(); if(!t)return;
  await live();
  status("Firebase automatisch actief");
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(start,1000)); else setTimeout(start,1000);
setInterval(patchSave,3000);
async function syncDoc(col,row){
  const t=await fb(); if(!t||!col||!row||!row.id)return false;
  try{
    await t.fsMod.setDoc(t.fsMod.doc(t.db,String(col),String(row.id)),row,{merge:true});
    return true;
  }catch(e){console.error(e);status("Firebase syncDoc fout");return false;}
}
async function deleteDocPublic(col,id){
  const t=await fb(); if(!t||!col||!id)return false;
  try{
    uploading=true;
    await t.fsMod.deleteDoc(t.fsMod.doc(t.db,String(col),String(id)));
    status("Firebase verwijderd");
    return true;
  }catch(e){console.error(e);status("Firebase delete fout");return false;}
  finally{uploading=false;}
}
window.BNSFirebaseSync={uploadLocalToFirebase:upload,downloadFirebaseToLocal:download,startRealtimeSync:live,syncDoc:syncDoc,deleteDoc:deleteDocPublic};
window.BNS=window.BNS||{};
window.BNS.syncDoc=syncDoc;
window.BNS.deleteDoc=deleteDocPublic;
})();

console.log('[BNS v461] firebase-sync lege bezorger blijft leeg.');
