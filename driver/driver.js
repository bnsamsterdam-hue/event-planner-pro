/* Bezorger Tapwagen.nl - driver-only V130
   Doel: planner -> telefoon blijft live/read-only verversen zonder planner te wijzigen.
   Telefoon schrijft alleen alerts, behalve bewust Afmelden/uitgevoerd. */
const FIREBASE_VERSION = "10.12.5";
const TAP = { firebase:null, app:null, db:null, user:null, state:{ users:[], orders:[], alerts:[] }, poll:null, lastHash:"" };
const $ = id => document.getElementById(id);
const qsa = (s,r=document) => Array.from(r.querySelectorAll(s));
function clean(v){ return String(v ?? "").trim(); }
function lower(v){ return clean(v).toLowerCase(); }
function esc(v){ return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function setStatus(t){ const e=$("status"); if(e) e.textContent = t; }
function toast(t){ const e=$("toast"); if(!e){ alert(t); return; } e.textContent=String(t||""); e.classList.add("show"); clearTimeout(e._timer); e._timer=setTimeout(()=>e.classList.remove("show"),3200); }
function roleOf(u){ return lower(u && u.role); }
function isAdmin(){ return roleOf(TAP.user)==="admin"; }
function rightsOf(u){ return (u && u.rights && typeof u.rights === "object") ? u.rights : {}; }
function hasRightKey(u,k){ return !!rightsOf(u)[k]; }
function hasAnyRight(keys,u=TAP.user){ const r=rightsOf(u); return isAdmin() || keys.some(k => !!r[k]); }
function statusOf(o){ return lower(o && o.status); }
function isCancelled(o){ return ["geannuleerd","geannuleerde","annulering","cancelled","canceled","verwijderd","gewist","deleted","trash"].includes(statusOf(o)); }
function isDone(o){ return ["uitgevoerd","afgerond","voltooid","done","klaar"].includes(statusOf(o)); }
function orderStart(o){ return clean(o.start || o.dateStart || o.startDate || o.date || ""); }
function orderEnd(o){ return clean(o.end || o.dateEnd || o.endDate || orderStart(o)); }
function dateTime(v){ const d=new Date(clean(v).slice(0,10)+"T00:00:00"); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); }
function todayTime(){ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
function niceDate(v){ v=clean(v).slice(0,10); const p=v.split("-"); return p.length===3 ? `${p[2]}-${p[1]}-${p[0]}` : v; }
function arrayify(v){ return Array.isArray(v) ? v : (v==null || v==="" ? [] : [v]); }
function uniq(a){ return Array.from(new Set(a.filter(x=>clean(x)!==""))); }
function customerName(o){ return clean(o.customerName || o.klant || (o.customer && o.customer.name) || ""); }
function customerPhone(o){ return clean(o.customerPhone || o.phone || (o.customer && o.customer.phone) || (o.customer && o.customer.telephone) || ""); }
function addressOf(o){
  const p=[]; const add=v=>{ v=clean(v); if(v && !p.includes(v)) p.push(v); };
  [o.locationName,o.locationAddress,o.locationStreet,o.locationZip,o.locationCity,o.address,o.street,o.zip,o.city].forEach(add);
  if(o.location && typeof o.location === "object") [o.location.name,o.location.address,o.location.street,o.location.zip,o.location.city].forEach(add);
  return p.join(", ");
}
function materialList(o){
  const m=o.materials || o.mats || [];
  return Array.isArray(m) ? m.map(x => typeof x==="string" ? {name:x,qty:""} : {name:x.code||x.name||"", qty:x.qty||x.count||x.aantal||"", extra:x.extra||x.note||""}).filter(x=>x.name) : [];
}
function materialText(o){ const m=materialList(o); return m.length ? m.map(x=>`${x.qty?x.qty+"x ":""}${x.name}`).join(", ") : ""; }
function routeUrl(type,a){ const q=encodeURIComponent(a||""); return type==="waze" ? `https://waze.com/ul?q=${q}&navigate=yes` : `https://www.google.com/maps/search/?api=1&query=${q}`; }

async function initFirebase(){
  if(!window.BNS_FIREBASE_CONFIG || window.BNS_FIREBASE_CONFIG.apiKey === "VUL_HIER_IN") throw new Error("Firebase config ontbreekt");
  const appMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
  const fsMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
  TAP.firebase = fsMod;
  TAP.app = appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
  TAP.db = fsMod.getFirestore(TAP.app);
}
async function readCollection(name){
  const ref = TAP.firebase.collection(TAP.db, name);
  let snap;
  if (TAP.firebase.getDocsFromServer) {
    try { snap = await TAP.firebase.getDocsFromServer(ref); }
    catch(e){ snap = await TAP.firebase.getDocs(ref); }
  } else {
    snap = await TAP.firebase.getDocs(ref);
  }
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}
async function loadUsersOrders(){
  const [users,orders] = await Promise.all([readCollection("users"), readCollection("orders")]);
  TAP.state.users = Array.isArray(users) ? users : [];
  TAP.state.orders = Array.isArray(orders) ? orders : [];
  return true;
}
async function updateOrderStatusDone(o){
  if(!o || !o.id) return;
  const patch = { status:"Uitgevoerd", doneAt:new Date().toISOString(), doneBy:TAP.user ? TAP.user.name : "" };
  await TAP.firebase.setDoc(TAP.firebase.doc(TAP.db,"orders",String(o.id)), patch, { merge:true });
}
async function addAlert(a){
  const id = a.id || ("a_" + Date.now() + "_" + Math.random().toString(36).slice(2,8));
  const payload = { ...a, id, createdAt:a.createdAt || new Date().toISOString(), resolved:false, source:"driver" };
  await TAP.firebase.setDoc(TAP.firebase.doc(TAP.db,"alerts",id), payload, { merge:true });
}

function userAllowed(u){ const r=roleOf(u); return r==="bezorger" || r==="planner" || r==="admin"; }
function activeUser(u){ return !!(u && !u.deleted && lower(u.active)!=="false" && lower(u.enabled)!=="false"); }
function populateUsers(){
  const users=(TAP.state.users||[]).filter(u=>activeUser(u) && userAllowed(u));
  const el=$("loginName"); if(!el) return;
  el.innerHTML = users.length ? users.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.role||"Medewerker")})</option>`).join("") : `<option value="">Geen gebruikers gevonden</option>`;
}
const SESSION_KEY = "tapwagen_driver_user_id_v130";
let CURRENT_DETAIL_ID = "";
function login(){
  const id=$("loginName") && $("loginName").value; const pin=clean($("loginPin") && $("loginPin").value);
  const found=(TAP.state.users||[]).find(u=>activeUser(u) && String(u.id)===String(id) && String(u.pin||"")===pin);
  if(!found){ toast("Naam of PIN klopt niet"); return; }
  if(!userAllowed(found)){ toast("Geen rechten voor deze portal"); return; }
  TAP.user = found;
  sessionStorage.setItem(SESSION_KEY, found.id);
  if($("loginPin")) $("loginPin").value="";
  showApp(true);
}
function restoreSession(){
  const id=sessionStorage.getItem(SESSION_KEY); if(!id) return false;
  const found=(TAP.state.users||[]).find(u=>activeUser(u) && String(u.id)===String(id));
  if(found && userAllowed(found)){ TAP.user = found; showApp(false); return true; }
  return false;
}
function refreshCurrentUser(){
  if(!TAP.user) return;
  const fresh=(TAP.state.users||[]).find(u=>String(u.id)===String(TAP.user.id));
  if(fresh) TAP.user = fresh;
}
function orderIds(o){ return uniq([].concat(arrayify(o.driverId), arrayify(o.bezorgerId), arrayify(o.userId), arrayify(o.driverIds), arrayify(o.bezorgerIds), Array.isArray(o.drivers)?o.drivers.map(d=>d&&d.id):[]).map(String)); }
function orderNames(o){ return uniq([].concat(arrayify(o.driverName), arrayify(o.driver), arrayify(o.bezorger), arrayify(o.bezorgerName), arrayify(o.driverNames), arrayify(o.bezorgerNames), Array.isArray(o.drivers)?o.drivers.map(d=>d&&d.name):[]).map(lower)); }
function assignedToUser(o){
  if(!TAP.user) return false;
  const r=roleOf(TAP.user);
  if((r==="planner" || r==="admin") && hasAnyRight(["orders","admin"],TAP.user)) return true;
  const uid=String(TAP.user.id||""); if(uid && orderIds(o).includes(uid)) return true;
  const un=lower(TAP.user.name||""); return !!(un && orderNames(o).some(n => n===un || n.includes(un) || un.includes(n)));
}
function visibleOrder(o){ if(!o || isCancelled(o) || isDone(o)) return false; if(dateTime(orderEnd(o)) < todayTime()) return false; return assignedToUser(o); }
function getOrders(){ return (TAP.state.orders||[]).filter(visibleOrder).sort((a,b)=>dateTime(orderStart(a))-dateTime(orderStart(b))); }
function findOrder(id){ return (TAP.state.orders||[]).find(o=>String(o.id)===String(id)); }
function otherCustomerOrders(o){
  const currentId=String(o.id||""), currentNumber=String(o.number||"");
  return (TAP.state.orders||[]).filter(x=>String(x.id||"")!==currentId).filter(x=>String(x.number||"")===currentNumber).filter(x=>!isCancelled(x) && !isDone(x)).filter(x=>dateTime(orderEnd(x))>=todayTime()).sort((a,b)=>dateTime(orderStart(a))-dateTime(orderStart(b)));
}

function canRoute(){ return hasAnyRight(["gps","route","waze"]); }
function canCall(){ return hasAnyRight(["phoneCall","callCustomer","bellen","klantBellen","phone","orders"]); }
function canDone(){ return hasAnyRight(["phoneDone","resolve","afmelden","done","uitgevoerd"]); }
function canReport(){ return hasAnyRight(["reports","meldingen","report","reportGeneral","resolve","orders","reportStoring","reportDamage","reportMissing"]); }
function canStoring(){ return hasAnyRight(["reportStoring","storing","reports","meldingen"]); }
function canDamage(){ return hasAnyRight(["reportDamage","damage","schade","reports","meldingen"]); }
function canMissing(){ return hasAnyRight(["reportMissing","missing","vermissing","reports","meldingen"]); }
function canPhotoBefore(){ return hasAnyRight(["photoBefore","fotoVoor","photo","photos","reports","meldingen"]); }
function canPhotoAfter(){ return hasAnyRight(["photoAfter","fotoNa","photo","photos","reports","meldingen"]); }
function canSignature(){ return hasAnyRight(["signatureCustomer","handtekening","signature","sign","reports","meldingen"]); }
function canAgenda(){ return hasAnyRight(["agenda"]); }
function canPrices(){ return hasAnyRight(["prices","prijzen"]); }

function orderBadges(o){
  const badges=[`<span class="badge">${esc(o.status||"Open")}</span>`];
  if(canAgenda()) badges.push(`<span class="badge">Agenda</span>`);
  if(canRoute()) badges.push(`<span class="badge ok">Route</span>`);
  if(otherCustomerOrders(o).length) badges.push(`<span class="badge warn">Meer artikelen</span>`);
  if(canPrices()) badges.push(`<span class="badge dark">Prijzen</span>`);
  return badges.join("");
}
function actionButtons(o,detail){
  const a=addressOf(o), p=customerPhone(o), id=esc(o.id||"");
  let h="";
  if(detail) h += canRoute()?`<a class="btn btn-green" href="${esc(routeUrl("waze",a))}" target="_blank" rel="noopener">Waze</a>`:"";
  else h += canRoute()?`<a class="btn btn-green" href="${esc(routeUrl("waze",a))}" target="_blank" rel="noopener">Waze</a>`:"";
  h += canRoute()?`<a class="btn btn-dark" href="${esc(routeUrl("maps",a))}" target="_blank" rel="noopener">Maps</a>`:"";
  h += (p && canCall()) ? `<a class="btn" href="tel:${esc(p)}">Bel klant</a>` : "";
  h += canReport()?`<button type="button" class="btn btn-orange" data-report="${id}" data-type="Melding">Melding</button>`:"";
  h += canDamage()?`<button type="button" class="btn btn-red" data-report="${id}" data-type="Schade">Schade</button>`:"";
  h += canStoring()?`<button type="button" class="btn btn-purple" data-report="${id}" data-type="Storing">Storing</button>`:"";
  h += canMissing()?`<button type="button" class="btn btn-dark" data-report="${id}" data-type="Vermissing">Vermissing</button>`:"";
  h += canPhotoBefore()?`<button type="button" class="btn btn-dark" data-photo="${id}" data-photo-type="Foto voor levering">Foto voor</button>`:"";
  h += canPhotoAfter()?`<button type="button" class="btn btn-dark" data-photo="${id}" data-photo-type="Foto na levering">Foto na</button>`:"";
  h += canSignature()?`<button type="button" class="btn btn-purple" data-sign="${id}">Handtekening</button>`:"";
  h += canDone()?`<button type="button" class="btn btn-full btn-green wide" data-done="${id}">Afmelden / uitgevoerd</button>`:"";
  return h;
}
function orderCard(o){
  const s=orderStart(o), e=orderEnd(o), dl=s&&e&&s!==e?`${niceDate(s)} t/m ${niceDate(e)}`:niceDate(s||e);
  const mats=materialList(o);
  return `<article class="order-card order" data-id="${esc(o.id)}">
    <span class="order-number">${esc(o.number||"Opdracht")}</span>
    <div class="order-title">${esc(o.title||"Zonder titel")}</div>
    <div class="badges">${orderBadges(o)}</div>
    <div class="meta">
      <div class="meta-row"><span>📅</span><div><strong>${esc(dl||"Geen datum")}</strong></div></div>
      <div class="meta-row"><span>👤</span><div>${esc(customerName(o)||"Klant onbekend")}</div></div>
      <div class="meta-row"><span>📍</span><div>${esc(addressOf(o)||"Adres onbekend")}</div></div>
      <div class="meta-row"><span>📦</span><div>${esc(mats.length?`${mats.length} artikelsoorten - ${materialText(o)}`:"Geen materialen")}</div></div>
    </div>
    <div class="action-grid"><button type="button" class="more-btn wide" data-detail="${esc(o.id)}">Open opdracht</button>${actionButtons(o,false)}</div>
  </article>`;
}
function render(){
  refreshCurrentUser();
  const rows=getOrders();
  const box=$("orders"); if(box) box.innerHTML = rows.length ? rows.map(orderCard).join("") : `<div class="empty">Geen opdrachten voor deze gebruiker.</div>`;
  bindActions();
  setStatus(`Data bijgewerkt ${new Date().toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`);
}
function showOrders(){ CURRENT_DETAIL_ID=""; $("detailView").classList.add("hidden"); $("ordersView").classList.remove("hidden"); render(); }
function detailHtml(o){
  const s=orderStart(o), e=orderEnd(o), dl=s&&e&&s!==e?`${niceDate(s)} t/m ${niceDate(e)}`:niceDate(s||e);
  const mats=materialList(o), more=otherCustomerOrders(o);
  return `<div class="detail-header"><button type="button" class="back-btn" data-back>Terug</button></div>
  <article class="card detail-card">
    <h2>${esc(o.number||"")} - ${esc(o.title||"Zonder titel")}</h2>
    <div class="badges">${orderBadges(o)}</div>
    <div class="section-title">Opdracht</div>
    <div class="info-box">📅 ${esc(dl||"Geen datum")}<br>👤 ${esc(customerName(o)||"Klant onbekend")}<br>📍 ${esc(addressOf(o)||"Adres onbekend")}<br>🚚 ${esc(TAP.user?.name||"")}</div>
    <div class="section-title">Materialen</div>
    <div class="info-box">${mats.length?mats.map(x=>`• ${esc(x.qty?x.qty+"x ":"")}${esc(x.name)}${x.extra?" - "+esc(x.extra):""}`).join("<br>"):"Geen materialen"}</div>
    ${more.length?`<div class="section-title">Meer artikelen / opdrachten voor deze klant</div><div class="info-box">${more.map(x=>`• ${esc(x.number||"")} ${esc(x.title||"")} - ${esc(niceDate(orderStart(x)))}`).join("<br>")}</div>`:""}
    <div class="section-title">Acties</div><div class="report-grid">${actionButtons(o,true)}</div>
  </article>`;
}
function showDetail(id){ const o=findOrder(id); if(!o) return; CURRENT_DETAIL_ID=String(id||""); $("ordersView").classList.add("hidden"); $("detailView").classList.remove("hidden"); $("detailView").innerHTML=detailHtml(o); bindActions(); }

async function sendReport(order,type){
  let label = type || "Melding";
  let extra = prompt(label + " voor planning:", "");
  if(!extra) return;
  await addAlert({
    orderId: order.id || "", linkedOrder: order.id || "",
    orderNumber: order.number || "", linkedOrderNumber: order.number || "",
    orderTitle: order.title || "", customerName: customerName(order),
    title: label, type: label, text: extra, note: extra, message: extra,
    from: TAP.user.name || "", driverName: TAP.user.name || "", userId: TAP.user.id || ""
  });
  toast(`${label} verstuurd naar planner`);
}
function compressImage(file, cb){
  const reader=new FileReader();
  reader.onload=function(){
    const img=new Image(); img.onload=function(){
      const c=document.createElement("canvas");
      const max=900; let w=img.width, h=img.height; if(w>h && w>max){h=Math.round(h*max/w);w=max;} else if(h>=w && h>max){w=Math.round(w*max/h);h=max;}
      c.width=w; c.height=h; const ctx=c.getContext("2d"); ctx.drawImage(img,0,0,w,h); cb(c.toDataURL("image/jpeg",0.72));
    }; img.src=reader.result;
  }; reader.readAsDataURL(file);
}
function sendPhoto(order,type){
  const input=document.createElement("input"); input.type="file"; input.accept="image/*"; input.capture="environment";
  input.onchange=function(){ const f=input.files&&input.files[0]; if(!f) return; compressImage(f, async function(data){
    const note=prompt((type||"Foto") + " notitie:", "") || "";
    await addAlert({ orderId:order.id||"", linkedOrder:order.id||"", orderNumber:order.number||"", linkedOrderNumber:order.number||"", orderTitle:order.title||"", customerName:customerName(order), title:type||"Foto", type:type||"Foto", text:note||"Foto toegevoegd", note:note||"Foto toegevoegd", message:note||"Foto toegevoegd", photoData:data, from:TAP.user.name||"", driverName:TAP.user.name||"", userId:TAP.user.id||"" });
    toast("Foto verstuurd naar planner");
  }); };
  input.click();
}
function sendSignature(order){
  const wrap=document.createElement("div"); wrap.style.cssText="position:fixed;z-index:99999;inset:0;background:rgba(15,23,42,.6);padding:16px;display:flex;align-items:center;justify-content:center";
  wrap.innerHTML=`<div style="background:#fff;border-radius:22px;padding:16px;max-width:620px;width:100%;box-shadow:0 20px 70px rgba(0,0,0,.35)"><h2>Handtekening klant</h2><input id="sigName" placeholder="Naam klant" style="margin-bottom:10px"><canvas id="sigCanvas" style="width:100%;height:220px;border:2px solid #111;border-radius:14px;background:#fff"></canvas><div style="display:grid;gap:8px;margin-top:10px"><button id="sigSave">Opslaan</button><button id="sigClear" class="btn-dark">Opnieuw tekenen</button><button id="sigCancel" class="btn-red">Annuleren</button></div></div>`;
  document.body.appendChild(wrap);
  const c=$("sigCanvas"), ctx=c.getContext("2d"); let drawing=false, has=false;
  function fit(){ const r=c.getBoundingClientRect(); c.width=Math.max(300,Math.floor(r.width)); c.height=220; ctx.lineWidth=3; ctx.lineCap="round"; ctx.strokeStyle="#111"; }
  function pos(ev){ const e=(ev.touches&&ev.touches[0])||ev, r=c.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  function start(ev){ ev.preventDefault(); drawing=true; has=true; const p=pos(ev); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(ev){ if(!drawing)return; ev.preventDefault(); const p=pos(ev); ctx.lineTo(p.x,p.y); ctx.stroke(); }
  function end(ev){ if(ev)ev.preventDefault(); drawing=false; }
  fit(); ["mousedown","touchstart"].forEach(n=>c.addEventListener(n,start,{passive:false})); ["mousemove","touchmove"].forEach(n=>c.addEventListener(n,move,{passive:false})); ["mouseup","mouseleave","touchend","touchcancel"].forEach(n=>c.addEventListener(n,end,{passive:false}));
  $("sigClear").onclick=function(){ fit(); has=false; };
  $("sigCancel").onclick=function(){ wrap.remove(); };
  $("sigSave").onclick=async function(){ if(!has){ toast("Laat eerst tekenen"); return; } const name=clean($("sigName").value); const data=c.toDataURL("image/png"); await addAlert({ orderId:order.id||"", linkedOrder:order.id||"", orderNumber:order.number||"", linkedOrderNumber:order.number||"", orderTitle:order.title||"", customerName:customerName(order), title:"Handtekening klant", type:"Handtekening klant", text:name?`Ondertekend door ${name}`:"Klant heeft getekend", note:name?`Ondertekend door ${name}`:"Klant heeft getekend", signatureData:data, signatureName:name, from:TAP.user.name||"", driverName:TAP.user.name||"", userId:TAP.user.id||"" }); wrap.remove(); toast("Handtekening verstuurd naar planner"); };
}
function bindActions(){
  qsa("[data-detail]").forEach(b=>b.onclick=()=>showDetail(b.dataset.detail));
  qsa("[data-back]").forEach(b=>b.onclick=()=>showOrders());
  qsa("[data-report]").forEach(b=>b.onclick=async()=>{ const o=findOrder(b.dataset.report); if(o) await sendReport(o,b.dataset.type||"Melding"); });
  qsa("[data-photo]").forEach(b=>b.onclick=()=>{ const o=findOrder(b.dataset.photo); if(o) sendPhoto(o,b.dataset.photoType||"Foto"); });
  qsa("[data-sign]").forEach(b=>b.onclick=()=>{ const o=findOrder(b.dataset.sign); if(o) sendSignature(o); });
  qsa("[data-done]").forEach(b=>b.onclick=async()=>{ const o=findOrder(b.dataset.done); if(!o) return; if(!confirm("Opdracht afmelden als uitgevoerd?")) return; await updateOrderStatusDone(o); toast("Opdracht afgemeld"); await forceRefresh(true); showOrders(); });
}
function viewHash(){
  const u=TAP.user ? {id:TAP.user.id, rights:rightsOf(TAP.user)} : null;
  const rows=getOrders().map(o=>({id:o.id,number:o.number,title:o.title,status:o.status,start:o.start,end:o.end,customer:o.customerName||(o.customer&&o.customer.name),location:o.locationName||(o.location&&o.location.name),driverIds:o.driverIds,bezorgerIds:o.bezorgerIds,driverNames:o.driverNames,bezorgerNames:o.bezorgerNames,driver:o.driver,bezorger:o.bezorger,materials:o.materials,updatedAt:o.updatedAt}));
  return JSON.stringify({u,rows});
}
async function forceRefresh(doRender){
  try{ await loadUsersOrders(); refreshCurrentUser(); if(doRender){ if(CURRENT_DETAIL_ID && !$("detailView").classList.contains("hidden")) showDetail(CURRENT_DETAIL_ID); else render(); } return true; }
  catch(e){ console.warn(e); setStatus("Verversen mislukt: "+(e.message||e)); return false; }
}
function startPolling(){
  if(TAP.poll) clearInterval(TAP.poll);
  TAP.lastHash = viewHash();
  TAP.poll = setInterval(async function(){
    if(!TAP.user) return;
    const ok = await forceRefresh(false);
    if(!ok) return;
    const h=viewHash();
    if(h !== TAP.lastHash){ TAP.lastHash = h; if(CURRENT_DETAIL_ID && !$("detailView").classList.contains("hidden")) showDetail(CURRENT_DETAIL_ID); else render(); }
  }, 3000);
}
function showApp(start){
  $("loginBox").classList.add("hidden"); $("appBox").classList.remove("hidden"); $("logoutBtn").classList.remove("hidden");
  $("who").textContent = TAP.user ? `${TAP.user.name} - ${TAP.user.role||"Bezorger"}` : "";
  render(); startPolling();
  if(start) forceRefresh(true);
}
async function boot(){
  try{
    setStatus("Firebase verbinden..."); await initFirebase(); await loadUsersOrders(); populateUsers();
    $("loginBtn").onclick=login; $("loginPin").addEventListener("keydown",e=>{ if(e.key==="Enter") login(); });
    $("logoutBtn").onclick=()=>{ sessionStorage.removeItem(SESSION_KEY); location.reload(); };
    $("refreshBtn").onclick=async()=>{ await forceRefresh(true); toast("Verversd"); };
    $("clearSearchBtn").onclick=()=>{ $("searchBox").value=""; qsa(".order").forEach(el=>el.style.display=""); };
    $("searchBox").oninput=()=>{ const q=lower($("searchBox").value); qsa(".order").forEach(el=>{ el.style.display=!q||lower(el.innerText).includes(q)?"":"none"; }); };
    if(!restoreSession()) setStatus("Klaar om in te loggen");
  }catch(e){ console.error(e); setStatus("Fout: "+(e.message||e)); }
}
boot();
