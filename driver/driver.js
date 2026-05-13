/* Bezorger Tapwagen.nl - driver only V123
   Zelfstandige telefoonpagina. Geen planner-overlays, geen automatische her-render.
   Haalt orders/users op bij openen en bij Verversen. Schrijft alleen bij knopacties.
*/
const FIREBASE_VERSION = "10.12.5";
const BNS = { firebase:null, app:null, db:null, user:null, state:{users:[],orders:[],alerts:[]} };

const $ = id => document.getElementById(id);
const qsa = (sel,root=document) => Array.from(root.querySelectorAll(sel));
const clean = v => String(v ?? "").trim();
const lower = v => clean(v).toLowerCase();
const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function toast(t){
  const e=$("toast");
  if(!e){ alert(t); return; }
  e.textContent=String(t||"");
  e.classList.add("show");
  clearTimeout(e._timer);
  e._timer=setTimeout(()=>e.classList.remove("show"),3500);
}
function setStatus(t){ const e=$("status"); if(e)e.textContent=t; }

function roleOf(u){ return lower(u && u.role); }
function isDriverUser(u){ const r=roleOf(u); return r==="bezorger" || r==="driver" || r==="chauffeur"; }
function isActiveUser(u){ return !!u && u.deleted!==true && u.active!==false; }
function rights(){ return (BNS.user && BNS.user.rights) || {}; }
function hasKey(k){ return !!rights()[k]; }
function hasAny(keys){ return keys.some(k => hasKey(k)); }
function hasAnyUser(u,keys){ const r=(u&&u.rights)||{}; return keys.some(k=>!!r[k]); }

const RIGHT = {
  route:["gps","route","waze","routeOpen","wazeRoute"],
  call:["phoneCall","callCustomer","klantBellen","phone","bellen"],
  message:["resolve","meldingen","reports","report","melding","reportMessage","meldingenStoringen","meldingenAfmelden"],
  done:["phoneDone","afmelden","done","uitgevoerd","resolve","complete"],
  storing:["reportStoring","storing","storingMelden"],
  damage:["reportDamage","schade","damage","schadeMelden"],
  missing:["reportMissing","vermissing","missing","vermissingMelden"],
  photoBefore:["photoBefore","fotoVoor","fotoVoorLevering"],
  photoAfter:["photoAfter","fotoNa","fotoNaLevering"],
  signature:["signatureCustomer","handtekening","handtekeningKlant","signature"]
};
function can(type){ return hasAny(RIGHT[type] || []); }

function statusOf(o){ return lower(o && o.status); }
function isCancelled(o){ return ["geannuleerd","geannuleerde","annulering","cancelled","canceled"].includes(statusOf(o)); }
function isDone(o){ return ["uitgevoerd","afgerond","voltooid","done","klaar"].includes(statusOf(o)); }
function isDeleted(o){ return ["verwijderd","gewist","deleted","trash"].includes(statusOf(o)); }
function orderStart(o){ return clean(o.start || o.dateStart || o.startDate || o.date || ""); }
function orderEnd(o){ return clean(o.end || o.dateEnd || o.endDate || orderStart(o)); }
function dateTime(v){ const d=new Date(clean(v).slice(0,10)+"T00:00:00"); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); }
function todayTime(){ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
function niceDate(v){ v=clean(v).slice(0,10); const p=v.split("-"); return p.length===3 ? `${p[2]}-${p[1]}-${p[0]}` : v; }
function arrayify(v){ return Array.isArray(v) ? v : (v==null || v==="" ? [] : [v]); }
function idStr(v){ return String(v ?? ""); }
function nameStr(v){ return lower(v); }

function addressOf(o){
  const p=[]; const add=v=>{v=clean(v); if(v && !p.includes(v))p.push(v);};
  [o.locationName,o.locationAddress,o.locationStreet,o.locationZip,o.locationCity,o.address,o.street,o.zip,o.city].forEach(add);
  if(o.location && typeof o.location==="object") [o.location.name,o.location.address,o.location.street,o.location.zip,o.location.city].forEach(add);
  return p.join(" ");
}
function customerName(o){ return clean(o.customerName || (o.customer&&o.customer.name) || o.klant || ""); }
function customerPhone(o){ return clean(o.customerPhone || o.phone || (o.customer&&o.customer.phone) || ""); }
function driverDisplay(o){
  const names = arrayify(o.driverNames).concat(arrayify(o.bezorgerNames)).filter(Boolean);
  if(names.length) return names.join(", ");
  return clean(o.driverName || o.driver || o.bezorger || "");
}
function materialList(o){
  const m = o.materials || o.mats || [];
  return Array.isArray(m) ? m.map(x => typeof x === "string" ? {name:x,qty:""} : {
    name:x.code || x.name || x.title || "", qty:x.qty || x.count || x.aantal || "", extra:x.extra || x.note || x.description || ""
  }).filter(x=>x.name) : [];
}
function materialText(o){ const m=materialList(o); return m.length ? m.map(x=>`${x.qty?x.qty+"x ":""}${x.name}`).join(", ") : ""; }
function routeUrl(type,a){ const q=encodeURIComponent(a||""); return type==="waze" ? `https://waze.com/ul?q=${q}&navigate=yes` : `https://www.google.com/maps/search/?api=1&query=${q}`; }

async function initFirebase(){
  if(!window.BNS_FIREBASE_CONFIG || window.BNS_FIREBASE_CONFIG.apiKey === "VUL_HIER_IN"){
    setStatus("Firebase config ontbreekt.");
    throw new Error("Firebase config ontbreekt");
  }
  const appMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
  const fsMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
  BNS.firebase = fsMod;
  BNS.app = appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
  BNS.db = fsMod.getFirestore(BNS.app);
  setStatus("Firebase verbonden");
}
async function loadCollection(n){
  const s = await BNS.firebase.getDocs(BNS.firebase.collection(BNS.db,n));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
async function loadAll(){
  setStatus("Data laden...");
  BNS.state.users = await loadCollection("users");
  BNS.state.orders = await loadCollection("orders");
  try{ BNS.state.alerts = await loadCollection("alerts"); }catch(e){ BNS.state.alerts=[]; }
  if(BNS.user){
    const fresh = BNS.state.users.find(u=>String(u.id)===String(BNS.user.id));
    if(fresh) BNS.user = fresh;
  }
  setStatus("Data geladen");
}
async function updateOrder(o){
  if(!o || !o.id) return;
  o.updatedAt = new Date().toISOString();
  await BNS.firebase.setDoc(BNS.firebase.doc(BNS.db,"orders",String(o.id)),o,{merge:true});
}
async function addAlert(a){
  const id = a.id || ("a_"+Date.now()+"_"+Math.random().toString(36).slice(2,7));
  a.id=id;
  await BNS.firebase.setDoc(BNS.firebase.doc(BNS.db,"alerts",id),a,{merge:true});
}

function findDriverByPin(pin){
  return (BNS.state.users||[]).find(u => isActiveUser(u) && isDriverUser(u) && clean(u.pin) === clean(pin));
}
function showApp(){
  $("loginBox").classList.add("hidden");
  $("appBox").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("who").textContent = BNS.user ? `${BNS.user.name} - Bezorger` : "Mobiele opdrachten";
  render();
}
function logout(){
  BNS.user=null;
  sessionStorage.removeItem("tapwagen_driver_user_id");
  $("appBox").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  $("loginBox").classList.remove("hidden");
  $("who").textContent="Mobiele opdrachten";
  const p=$("loginPin"); if(p){ p.value=""; setTimeout(()=>p.focus(),150); }
}
function login(){
  const pin=clean($("loginPin").value);
  const u=findDriverByPin(pin);
  if(!u){ toast("PIN klopt niet of gebruiker is geen bezorger."); return; }
  BNS.user=u;
  sessionStorage.setItem("tapwagen_driver_user_id",String(u.id));
  $("loginPin").value="";
  showApp();
}
function restoreSession(){
  const id=sessionStorage.getItem("tapwagen_driver_user_id");
  if(!id) return;
  const u=(BNS.state.users||[]).find(x=>String(x.id)===String(id) && isActiveUser(x));
  if(u && isDriverUser(u)){ BNS.user=u; showApp(); }
}

function assignedToUser(o){
  if(!BNS.user) return false;
  const uid = idStr(BNS.user.id);
  const uname = nameStr(BNS.user.name);
  const ids = []
    .concat(arrayify(o.driverIds), arrayify(o.bezorgerIds), arrayify(o.driverId), arrayify(o.bezorgerId), arrayify(o.userId))
    .map(idStr).filter(Boolean);
  const names = []
    .concat(arrayify(o.driverNames), arrayify(o.bezorgerNames), arrayify(o.driverName), arrayify(o.driver), arrayify(o.bezorger))
    .map(nameStr).filter(Boolean);
  if(uid && ids.includes(uid)) return true;
  if(uname && names.includes(uname)) return true;
  return false;
}
function visibleOrder(o){
  if(isCancelled(o)||isDone(o)||isDeleted(o)) return false;
  if(dateTime(orderEnd(o)) && dateTime(orderEnd(o)) < todayTime()) return false;
  return assignedToUser(o);
}
function getOrders(){ return (BNS.state.orders||[]).filter(visibleOrder).sort((a,b)=>dateTime(orderStart(a))-dateTime(orderStart(b))); }
function findOrder(id){ return (BNS.state.orders||[]).find(o=>String(o.id)===String(id)); }

function orderBadges(o){
  const out=[`<span class="badge">${esc(o.status||"Open")}</span>`];
  if(materialList(o).length) out.push(`<span class="badge dark">${materialList(o).length} artikelen</span>`);
  return out.join("");
}
function actionButtons(o){
  const a=addressOf(o), p=customerPhone(o), enc=encodeURIComponent(a), id=esc(o.id||"");
  const html=[];
  if(can("route")){
    html.push(`<a class="btn btn-green" href="${esc(routeUrl("waze",a))}" target="_blank" rel="noopener">Waze</a>`);
    html.push(`<a class="btn btn-dark" href="${esc(routeUrl("maps",a))}" target="_blank" rel="noopener">Maps</a>`);
  }
  if(can("call")) html.push(p ? `<a class="btn" href="tel:${esc(p)}">Bel klant</a>` : `<button type="button" class="btn">Geen tel.</button>`);
  if(can("message")) html.push(`<button type="button" class="btn btn-orange" data-report="${id}" data-type="Melding">Melding</button>`);
  if(can("storing")) html.push(`<button type="button" class="btn btn-red" data-report="${id}" data-type="Storing">Storing</button>`);
  if(can("damage")) html.push(`<button type="button" class="btn btn-orange" data-report="${id}" data-type="Schade">Schade</button>`);
  if(can("missing")) html.push(`<button type="button" class="btn btn-purple" data-report="${id}" data-type="Vermissing">Vermissing</button>`);
  if(can("done")) html.push(`<button type="button" class="btn btn-full btn-green wide" data-done="${id}">Afmelden / uitgevoerd</button>`);
  if(can("photoBefore")) html.push(`<button type="button" class="btn btn-dark" data-photo="${id}" data-photo-type="Foto voor levering">Foto voor</button>`);
  if(can("photoAfter")) html.push(`<button type="button" class="btn btn-dark" data-photo="${id}" data-photo-type="Foto na levering">Foto na</button>`);
  if(can("signature")) html.push(`<button type="button" class="btn btn-purple" data-sign="${id}">Handtekening</button>`);
  return html.join("");
}
function orderCard(o){
  const a=addressOf(o), s=orderStart(o), e=orderEnd(o), dl=s&&e&&s!==e?`${niceDate(s)} t/m ${niceDate(e)}`:niceDate(s||e), id=esc(o.id||"");
  return `<article class="order-card order" data-id="${id}">
    <span class="order-number">${esc(o.number||"Opdracht")}</span>
    <div class="order-title">${esc(o.title||"Zonder titel")}</div>
    <div class="badges">${orderBadges(o)}</div>
    <div class="meta">
      <div class="meta-row"><span>📅</span><div><strong>${esc(dl||"Geen datum")}</strong></div></div>
      <div class="meta-row"><span>👤</span><div>${esc(customerName(o)||"Klant onbekend")}</div></div>
      <div class="meta-row"><span>📍</span><div>${esc(a||"Adres onbekend")}</div></div>
      <div class="meta-row"><span>📦</span><div>${esc(materialText(o)||"Geen materialen")}</div></div>
    </div>
    <div class="action-grid">${actionButtons(o)}</div>
  </article>`;
}
function render(){
  const rows=getOrders();
  $("orders").innerHTML = rows.length ? rows.map(orderCard).join("") : `<div class="empty">Geen opdrachten voor deze gebruiker.</div>`;
  bindActions();
}
async function refresh(){
  await loadAll();
  if(!BNS.user){ restoreSession(); return; }
  render();
  toast("Verversd");
}

function alertBase(order,type,text,extra){
  return Object.assign({
    orderId: order.id || "",
    orderNumber: order.number || "",
    orderTitle: order.title || "",
    customerName: customerName(order),
    title: type,
    type: type,
    text: text || "",
    note: text || "",
    resolved: false,
    createdAt: new Date().toISOString(),
    time: new Date().toLocaleString("nl-NL"),
    from: BNS.user && BNS.user.name || "",
    userId: BNS.user && BNS.user.id || ""
  }, extra || {});
}
async function sendReport(order,type){
  const txt = prompt(`${type} voor planning:`, "");
  if(!txt) return;
  await addAlert(alertBase(order,type,txt));
  toast(`${type} verstuurd`);
}
function ensureMedia(order){
  order.media = Array.isArray(order.media) ? order.media : [];
  return order.media;
}
function pickPhoto(order,type){
  const inp=document.createElement("input");
  inp.type="file"; inp.accept="image/*"; inp.capture="environment";
  inp.onchange=()=>{
    const file=inp.files && inp.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=async()=>{
      const data=String(reader.result||"");
      const item={id:"ph_"+Date.now(),type:type,data:data,driverId:BNS.user.id,driverName:BNS.user.name,createdAt:new Date().toISOString()};
      ensureMedia(order).push(item);
      await updateOrder(order);
      await addAlert(alertBase(order,type,"Foto toegevoegd",{photoData:data,mediaId:item.id}));
      toast("Foto opgeslagen en verstuurd");
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}
function openSign(order){
  const overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.65);display:flex;align-items:center;justify-content:center;padding:14px";
  overlay.innerHTML=`<div class="card" style="width:100%;max-width:720px;margin:0;background:#fff"><h2 style="margin-top:0">Handtekening klant</h2><input id="sigName" placeholder="Naam klant"><canvas id="sigCanvas" style="width:100%;height:220px;border:2px solid #dbe6f3;border-radius:16px;background:#fff;margin:10px 0;touch-action:none"></canvas><div class="action-grid"><button id="sigSave" class="btn-green" type="button">Opslaan</button><button id="sigClear" class="btn-dark" type="button">Opnieuw</button><button id="sigCancel" class="btn-red" type="button">Annuleren</button></div></div>`;
  document.body.appendChild(overlay);
  const c=$("sigCanvas"), ctx=c.getContext("2d");
  let draw=false, has=false;
  function fit(){ const r=c.getBoundingClientRect(); c.width=Math.max(300,Math.floor(r.width)); c.height=220; ctx.lineWidth=3; ctx.lineCap="round"; ctx.strokeStyle="#111827"; }
  function pos(ev){ const e=(ev.touches&&ev.touches[0])||ev, r=c.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  function start(ev){ ev.preventDefault(); draw=true; has=true; const p=pos(ev); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(ev){ if(!draw) return; ev.preventDefault(); const p=pos(ev); ctx.lineTo(p.x,p.y); ctx.stroke(); }
  function end(ev){ if(ev) ev.preventDefault(); draw=false; }
  setTimeout(fit,0);
  ["mousedown","touchstart"].forEach(n=>c.addEventListener(n,start,{passive:false}));
  ["mousemove","touchmove"].forEach(n=>c.addEventListener(n,move,{passive:false}));
  ["mouseup","mouseleave","touchend","touchcancel"].forEach(n=>c.addEventListener(n,end,{passive:false}));
  $("sigCancel").onclick=()=>overlay.remove();
  $("sigClear").onclick=()=>{ fit(); has=false; };
  $("sigSave").onclick=async()=>{
    if(!has){ toast("Laat eerst tekenen."); return; }
    const name=clean($("sigName").value);
    const data=c.toDataURL("image/png");
    const item={id:"sig_"+Date.now(),type:"Handtekening klant",data:data,customerName:name,driverId:BNS.user.id,driverName:BNS.user.name,createdAt:new Date().toISOString()};
    ensureMedia(order).push(item);
    order.customerSignature=data; order.customerSignedName=name; order.customerSignedAt=new Date().toISOString();
    await updateOrder(order);
    await addAlert(alertBase(order,"Handtekening klant",name?`Ondertekend door ${name}`:"Klant heeft getekend",{signatureData:data,signatureName:name,mediaId:item.id}));
    overlay.remove();
    toast("Handtekening opgeslagen en verstuurd");
  };
}
async function markDone(order){
  if(!confirm("Opdracht afmelden als uitgevoerd?")) return;
  order.status="Uitgevoerd";
  order.doneAt=new Date().toISOString();
  order.doneBy=BNS.user.name||"";
  await updateOrder(order);
  await addAlert(alertBase(order,"Opdracht uitgevoerd","Bezorger heeft opdracht uitgevoerd gemeld."));
  await refresh();
}
function bindActions(){
  qsa("[data-report]").forEach(b=>b.onclick=async()=>{ const o=findOrder(b.dataset.report); if(o) await sendReport(o,b.dataset.type||"Melding"); });
  qsa("[data-photo]").forEach(b=>b.onclick=()=>{ const o=findOrder(b.dataset.photo); if(o) pickPhoto(o,b.dataset.photoType||"Foto"); });
  qsa("[data-sign]").forEach(b=>b.onclick=()=>{ const o=findOrder(b.dataset.sign); if(o) openSign(o); });
  qsa("[data-done]").forEach(b=>b.onclick=async()=>{ const o=findOrder(b.dataset.done); if(o) await markDone(o); });
}

async function boot(){
  try{
    await initFirebase();
    await loadAll();
    $("loginBtn").onclick=login;
    $("loginPin").addEventListener("keydown",e=>{ if(e.key==="Enter") login(); });
    $("logoutBtn").onclick=logout;
    $("refreshBtn").onclick=refresh;
    $("clearSearchBtn").onclick=()=>{ $("searchBox").value=""; qsa(".order").forEach(el=>el.style.display=""); };
    $("searchBox").oninput=()=>{ const q=lower($("searchBox").value); qsa(".order").forEach(el=>{ el.style.display=!q||lower(el.innerText).includes(q)?"":"none"; }); };
    restoreSession();
    const pin=$("loginPin"); if(pin && !BNS.user) setTimeout(()=>pin.focus(),150);
  }catch(e){ console.error(e); setStatus("Fout: "+e.message); }
}
boot();
