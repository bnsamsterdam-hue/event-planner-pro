
// ── Globale localStorage base64 interceptor ────────────────
// Onderschept ALLE localStorage writes en verwijdert base64 data
// zodat QuotaExceededError nooit meer optreedt
(function(){
  var _BIG = ['photoData','photo','image','signatureData','signature',
              'data','customerSignature'];
  var _SKIP = ['bnsCatColors','bns.catColors','bnsV57FavColors',
               'COLOR_KEY','STYLE_KEY','CLOSED_KEY','INVOICE_KEY',
               'PENDING_KEY','OVERRIDE_KEY','DOC_KEY','knownUserKey'];
  
  function _isStateKey(k){
    k = String(k||'');
    return k.indexOf('event-planner')>=0 || k.indexOf('bns_')>=0 ||
           k.indexOf('eventPlanner')>=0 || k.indexOf('plannerState')>=0 ||
           k.indexOf('bns-') >=0;
  }
  
  function _strip(obj){
    if(!obj || typeof obj !== 'object') return;
    _BIG.forEach(function(f){
      if(obj[f] && typeof obj[f]==='string' && obj[f].length > 500) delete obj[f];
    });
  }
  
  function _stripState(s){
    if(!s || typeof s !== 'object') return s;
    try{
      (['orders','alerts']).forEach(function(col){
        (s[col]||[]).forEach(function(o){
          _strip(o);
          ['media','photos','signatures','driverUploads',
           'handtekeningen','klantmeldingen'].forEach(function(k){
            (o[k]||[]).forEach(_strip);
          });
        });
      });
    }catch(e){}
    return s;
  }

  var _orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value){
    // Alleen state-keys strippen, kleine keys doorlaten
    if(_isStateKey(key) && typeof value === 'string' && value.length > 10000){
      try{
        var parsed = JSON.parse(value);
        _stripState(parsed);
        value = JSON.stringify(parsed);
      }catch(e){}
    }
    try{
      _orig(key, value);
    }catch(e){
      // Vol: verwijder backup keys en probeer opnieuw
      try{
        ['bns_auto_backup_latest_json_v1','bns_auto_backup_date_v1'].forEach(function(k){
          try{ localStorage.removeItem(k); }catch(_){}
        });
        _orig(key, value);
      }catch(e2){
        console.warn('[BNS] localStorage vol, sla op in Firebase alleen');
      }
    }
  };
  console.info('[BNS] localStorage base64 interceptor actief');
})();

// Eenmalige opruiming bestaande base64 in localStorage
(function(){
  var BIG=['photoData','photo','image','signatureData','signature','data','customerSignature'];
  var KEYS=['event-planner-pro-v87','event-planner-pro-v8','event-planner-pro',
            'bns_auto_backup_latest_json_v1','bns_event_planner'];
  KEYS.forEach(function(k){
    try{
      var raw=localStorage.getItem(k); if(!raw) return;
      var s=JSON.parse(raw); var changed=0;
      function strip(o){ if(!o||typeof o!=='object') return;
        BIG.forEach(function(f){ if(o[f]&&String(o[f]).length>200){delete o[f];changed++;} }); }
      (s.orders||[]).forEach(function(o){ strip(o);
        ['media','photos','signatures','driverUploads'].forEach(function(a){ (o[a]||[]).forEach(strip); }); });
      (s.alerts||[]).forEach(strip);
      if(changed){ localStorage.setItem(k,JSON.stringify(s)); console.info('[BNS] '+changed+' base64 items verwijderd uit localStorage'); }
    }catch(e){}
  });
})();
/* BNS FIREBASE AUTO SYNC V460 */
(function(){
"use strict";
if(window.__bnsFirebaseAutoSyncV2)return; window.__bnsFirebaseAutoSyncV2=true;

const STORAGE_KEYS=["event-planner-pro-v87","event-planner-pro-v8","event-planner-pro","bns_event_planner"];
const COLLECTIONS=["users","orders","materials","customers","locations","alerts","settings"];
const UPLOAD_COLLECTIONS=["settings"]; // BNS749: geen bulk-upload van orders/materials/customers/locations/alerts vanuit localStorage/INITIAL_STATE
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
  try{
    // Strip base64 voor localStorage
    var _BIG=['photoData','photo','image','signatureData','signature','data','customerSignature'];
    function _stripFs(o){ if(!o||typeof o!=='object') return; _BIG.forEach(function(f){ if(o[f]&&String(o[f]).length>200) delete o[f]; }); }
    var _sc = JSON.parse(JSON.stringify(s));
    (_sc.orders||[]).forEach(function(o){
      _stripFs(o);
      ['media','photos','signatures','driverUploads','handtekeningen','klantmeldingen'].forEach(function(k){ (o[k]||[]).forEach(_stripFs); });
    });
    (_sc.alerts||[]).forEach(_stripFs);
    localStorage.setItem(STORAGE_KEYS[0],JSON.stringify(_sc));
  }catch(e){
    // Als nog vol: probeer zonder alerts
    try{
      var _min={orders:s.orders||[],materials:s.materials||[],users:s.users||[],settings:s.settings||{}};
      localStorage.setItem(STORAGE_KEYS[0],JSON.stringify(_min));
    }catch(_){}
  }
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

/* =========================================================
   BNS v481 firebase-sync folderfix vanaf werkende zip
   Corrigeert vervuilde folders in Firebase:
   status geannuleerd/uitgevoerd/verwijderd/offerte/optie wint van folder=lopend.
   ========================================================= */
function bns481FolderFromOrder(o){
  try{
    if(!o) return "";
    const id = String(o.id || o.docId || o.orderId || "").trim();
    if(id.startsWith("old_")) return "archief";

    const s = String(o.status || o.state || o.orderStatus || "").trim().toLowerCase();
    if(/offerte/.test(s)) return "offerte";
    if(/optie|14/.test(s)) return "optie14";
    if(/geann|annul|cancel|verwijderd|deleted|trash/.test(s)) return "geannuleerd";
    if(/uitgevoerd|afgerond|voltooid|done|klaar|afgemeld/.test(s)) return "uitgevoerd";
    if(/opdrachtbevestiging|opdracht bevestigd|bevestigd|opdracht|actief|lopend|gereserveerd/.test(s)) return "lopend";

    let f = String(o.folder || o.map || o.orderFolder || "").trim().toLowerCase();
    if(f === "live") f = "lopend";
    if(f === "optie") f = "optie14";
    if(f === "old") f = "archief";
    return f;
  }catch(e){ return ""; }
}
function bns481NormalizeFolder(o){
  try{
    const f = bns481FolderFromOrder(o);
    if(f) o.folder = f;
  }catch(e){}
  return o;
}
async function bns481CorrectFoldersInFirebase(rows){
  try{
    if(!Array.isArray(rows) || !rows.length) return;
    const t = await fb(); if(!t) return;
    const batch = t.fsMod.writeBatch(t.db);
    let n = 0;
    rows.forEach(o=>{
      if(!o || !o.id) return;
      const before = String(o.folder || "").trim().toLowerCase();
      const after = bns481FolderFromOrder(o);
      if(after && before !== after){
        batch.set(t.fsMod.doc(t.db, "orders", String(o.id)), {folder: after, updatedAt: Date.now()}, {merge:true});
        o.folder = after;
        n++;
      }
    });
    if(n){
      await batch.commit();
      console.log("[BNS v481 sync] folders in Firebase gecorrigeerd:", n);
    }
  }catch(e){
    console.warn("[BNS v481 sync] folder correctie overgeslagen", e);
  }
}
if(typeof window !== "undefined"){
  window.BNS_v481FolderFromOrder = bns481FolderFromOrder;
  window.BNS_v481NormalizeFolder = bns481NormalizeFolder;
  window.BNS_v481CorrectFoldersInFirebase = bns481CorrectFoldersInFirebase;
}

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
  // BNS763: nooit bezorger/driver velden wissen tijdens normaliseren.
  // Ook uitgevoerde/geannuleerde orders mogen hun bezorger-historie bewaren.
  // Alleen normaliseren als er werkelijk driver/bezorger-data aanwezig is.
  if(bns460DriverCount(o)>0) bns460NormalizeDrivers(o);
  return o;
}
function bns460HasDriver(o){
  if(!o) return false;
  if(bns460DriverCount(o)>0) return true;
  const f=[o.driver,o.driverName,o.bezorger,o.bezorgerName,o.assignedDriver,o.assignedDriverName];
  return f.some(v=>String(v||'').trim().length>0);
}

function bns763CopyDriverFields(to, from){
  if(!to||!from)return to;
  ["driver","driverId","driverName","bezorger","bezorgerId","bezorgerName","assignedDriver","assignedDriverId","assignedDriverName","userId"].forEach(function(k){
    if((to[k]===undefined||to[k]===null||to[k]==="") && from[k]!==undefined && from[k]!==null && from[k]!=="") to[k]=from[k];
  });
  ["driverIds","driverNames","bezorgerIds","bezorgerNames","assignedDriverIds","assignedDriverNames","userIds","drivers","bezorgers","driverList"].forEach(function(k){
    if((!Array.isArray(to[k])||to[k].length===0) && Array.isArray(from[k]) && from[k].length>0) to[k]=from[k].slice();
  });
  if(bns460DriverCount(to)>0) bns460NormalizeDrivers(to);
  return to;
}
function bns763PreserveDriversForRows(incomingRows, existingRows){
  try{
    var byId={};
    (existingRows||[]).forEach(function(o){ if(o&&(o.id||o.number)) byId[String(o.id||o.number)]=o; });
    return (incomingRows||[]).map(function(row){
      if(!row)return row;
      var old=byId[String(row.id||row.number)];
      if(old && bns460DriverCount(old)>0 && bns460DriverCount(row)===0){
        bns763CopyDriverFields(row, old);
      }
      return row;
    });
  }catch(e){return incomingRows||[];}
}

function bns460IsPhoneClient(){
  const h=String(location.href||"").toLowerCase();
  const b=String(document.body&&document.body.innerText||"").toLowerCase();
  return h.indexOf("/driver")>=0||h.indexOf("bezorger")>=0||h.indexOf("telefoon")>=0||b.indexOf("mobiele opdrachten")>=0||b.indexOf("bezorger tapwagen")>=0;
}
function bns460FilterRows(col,rows,includeArchief){
  rows=(rows||[]).map(o=>col==="orders"?bns460NormalizeOrder(o):o);
  if(col==="orders"){
    // Telefoon: alleen lopend EN bezorger toegewezen
    if(bns460IsPhoneClient()){
      return rows.filter(o=>{
        if(o.folder!=="lopend") return false;
        // Check: heeft deze order een bezorger toegewezen?
        const hasDriver = bns460HasDriver(o);
        return hasDriver;
      });
    }
    // Planner: standaard geen archief/old laden (tenzij expliciet gevraagd)
    if(!includeArchief){
      rows=rows.filter(o=>{
        if(!o||!o.id) return false;
        if(String(o.id).match(/^old[_-]/i)) return false;  // old_ prefix
        if(o.folder==="old"||o.folder==="archief") return false;  // archief folder
        return true;
      });
    }
  }
  return rows;
}

// Laad archief on-demand (alleen als je de archief tab opent)
async function bns466LoadArchief(jaar){
  const t=await fb(); if(!t) return [];
  try{
    const snap=await t.fsMod.getDocs(t.fsMod.collection(t.db,"orders"));
    const all=snap.docs.map(d=>bns481NormalizeFolder({id:d.id,...d.data()}));
    const archief=all.filter(o=>{
      if(!o) return false;
      const isOld=String(o.id||"").match(/^old[_-]/i)||o.folder==="old"||o.folder==="archief";
      if(!isOld) return false;
      if(jaar){
        // Filter op jaar via einddatum of opdrachtnummer
        const y=String(o.end||o.start||o.number||o.id||"");
        return y.indexOf(String(jaar))>=0;
      }
      return true;
    }).map(bns460NormalizeOrder);
    return archief;
  }catch(e){ console.error("[BNS466] Archief laden fout:",e); return []; }
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
  // BNS749 bulk upload guard: alleen expliciete syncDoc/syncOrder mag bedrijfsdata wijzigen; bulk upload is alleen settings.
  try{ if(Array.isArray(UPLOAD_COLLECTIONS) && UPLOAD_COLLECTIONS.some(c=>["orders","materials","customers","locations","alerts"].includes(c))){ console.warn("[BNS749] bulk upload bedrijfsdata geblokkeerd"); return; } }catch(e){}
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
          if(row.folder==="archief"||row.folder==="old"||String(row.id||"").match(/^old[_-]/i)){
            continue; // Stil overslaan
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
        // Orders zonder merge zodat bewust geclearde velden echt worden opgeslagen.
        if(col==="orders"){
          await t.fsMod.setDoc(t.fsMod.doc(t.db,col,String(row.id)),row);
        }else{
          await t.fsMod.setDoc(t.fsMod.doc(t.db,col,String(row.id)),row,{merge:true});
        }
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
      var incoming=snap.docs.map(d=>bns481NormalizeFolder({id:d.id,...d.data()}));
      if(col==="orders") incoming=bns763PreserveDriversForRows(incoming,s[col]||[]);
      s[col]=bns460FilterRows(col,incoming,false);
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
      var incoming=snap.docs.map(d=>bns481NormalizeFolder({id:d.id,...d.data()}));
      if(col==="orders") incoming=bns763PreserveDriversForRows(incoming,s[col]||[]);
      s[col]=bns460FilterRows(col,incoming,false);
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
    // Orders: GEEN merge - volledige overschrijving zodat geclearde velden echt weg zijn
    const useMerge = col !== 'orders';
    if(useMerge){
      await t.fsMod.setDoc(t.fsMod.doc(t.db,String(col),String(row.id)),row,{merge:true});
    } else {
      // Order zonder merge: zorgt dat driver=[] echt wordt opgeslagen
      row.updatedAt = row.updatedAt || new Date().toISOString();
      await t.fsMod.setDoc(t.fsMod.doc(t.db,String(col),String(row.id)),row);
    }
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
window.BNSFirebaseSync = window.BNSFirebaseSync || {};
window.BNSFirebaseSync.uploadLocalToFirebase = upload;
window.BNSFirebaseSync.downloadFirebaseToLocal = download;
window.BNSFirebaseSync.startRealtimeSync = live;
window.BNSFirebaseSync.syncDoc = syncDoc;
window.BNSFirebaseSync.deleteDoc = deleteDocPublic;
window.BNSFirebaseSync.loadArchief = bns466LoadArchief;
window.BNS=window.BNS||{};
window.BNS.syncDoc=syncDoc;
window.BNS.deleteDoc=deleteDocPublic;
})();

console.log('[BNS v461] firebase-sync lege bezorger blijft leeg.');



/* BNS v462 sync: geen bezorger terugpreserven als planner leeg opslaat */
(function(){
  if(typeof preserveOrder === "function" && !preserveOrder.__bns462){
    var oldPreserve = preserveOrder;
    preserveOrder = function(local, remote){
      try{
        if(local && typeof bns460NormalizeOrder==="function") bns460NormalizeOrder(local);
        var lc = (typeof bns460DriverCount==="function") ? bns460DriverCount(local) : 0;
        if(local && local.folder==="lopend" && lc===0){
          // Leeg is bewust leeg: remote driverdata niet terugzetten.
          return local;
        }
      }catch(e){}
      return oldPreserve(local, remote);
    };
    preserveOrder.__bns462 = true;
  }
})();


console.log('[BNS v473] BNSFirebaseSync veilig aangemaakt met loadArchief.');



/* BNS v474 sync: lege bezorger blijft leeg, geen remote driver terugzetten */
(function(){
  if(typeof preserveOrder === 'function' && !preserveOrder.__bns474){
    var old=preserveOrder;
    function countDrivers(o){
      if(!o)return 0;
      var vals=[];
      ['driverIds','bezorgerIds','userIds','assignedDriverIds','driverNames','bezorgerNames','assignedDriverNames'].forEach(function(k){ if(Array.isArray(o[k])) vals=vals.concat(o[k]); });
      ['driver','driverName','bezorger','bezorgerName','driverId','bezorgerId','userId','assignedDriverId'].forEach(function(k){ if(o[k]) vals=vals.concat(String(o[k]).split(/[,;|\n]+/)); });
      return vals.map(function(x){return String(x||'').trim();}).filter(Boolean).length;
    }
    preserveOrder=function(local,remote){
      try{
        if(local && local.folder==='lopend' && countDrivers(local)===0) return local;
      }catch(e){}
      return old(local,remote);
    };
    preserveOrder.__bns474=true;
  }
  console.log('[BNS v474] firebase-sync lege bezorger blijft leeg actief.');
console.log('[BNS v763] firebase-sync driver/bezorger preserve actief, dubbele orders-if opgeschoond.');
})();

/* BNS v481 download folder correction wrapper */
(function(){
  try{
    if(typeof download === "function" && !download.__bns481){
      const oldDownload = download;
      download = async function(){
        const s = await oldDownload.apply(this, arguments);
        try{ if(s && Array.isArray(s.orders)) await bns481CorrectFoldersInFirebase(s.orders); }catch(e){}
        return s;
      };
      download.__bns481 = true;
    }
  }catch(e){}
})();
console.log("[BNS v481 sync] folderfix actief vanaf werkende zip.");

console.log("[BNS v482 sync] ongewijzigd vanaf basis; app-popup gebruikt nu folder=lopend strikt.");

/* BNS v493: open dossieroverzicht verversen na Firebase update */
(function(){
  try{
    function fire(){
      try{ document.dispatchEvent(new CustomEvent("bns:firebase-updated")); }catch(e){}
      try{ if(typeof window.BNS_V493_RENDER==="function") window.BNS_V493_RENDER(); }catch(e){}
    }
    if(typeof download==="function" && !download.__bns493){
      const oldDownload=download;
      download=async function(){
        const res=await oldDownload.apply(this,arguments);
        setTimeout(fire,150);
        return res;
      };
      download.__bns493=true;
    }
    if(typeof saveLocal==="function" && !saveLocal.__bns493){
      const oldSaveLocal=saveLocal;
      saveLocal=function(){
        const res=oldSaveLocal.apply(this,arguments);
        setTimeout(fire,120);
        return res;
      };
      saveLocal.__bns493=true;
    }
    window.BNS_V493_FIRE_UPDATE=fire;
  }catch(e){}
})();
console.log("[BNS v493 sync] update-signaal actief.");
