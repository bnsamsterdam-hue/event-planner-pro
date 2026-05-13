/* Tapwagen.nl Bezorger - driver-only V124
   Alleen telefoonmap. Planner/app.js blijft ongemoeid.
*/
const FIREBASE_VERSION = "10.12.5";
const APP = { firebase:null, app:null, db:null, user:null, state:{users:[],orders:[]} };
const $ = (id)=>document.getElementById(id);
const $$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));

function clean(v){ return String(v ?? "").trim(); }
function lower(v){ return clean(v).toLowerCase(); }
function esc(v){ return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function nowIso(){ return new Date().toISOString(); }
function nowLocal(){ return new Date().toLocaleString("nl-NL"); }
function toast(t){ const e=$("toast"); if(!e){ alert(t); return; } e.textContent=String(t||""); e.classList.add("show"); clearTimeout(e._t); e._t=setTimeout(()=>e.classList.remove("show"),3500); }
function setStatus(t){ const e=$("status"); if(e) e.textContent=t; }
function unique(arr){ return Array.from(new Set((arr||[]).map(x=>clean(x)).filter(Boolean))); }

async function initFirebase(){
  if(!window.BNS_FIREBASE_CONFIG || window.BNS_FIREBASE_CONFIG.apiKey === "VUL_HIER_IN"){
    setStatus("Firebase config ontbreekt.");
    throw new Error("Firebase config ontbreekt");
  }
  const appMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
  const fsMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
  APP.firebase = fsMod;
  APP.app = appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
  APP.db = fsMod.getFirestore(APP.app);
  setStatus("Firebase verbonden");
}
async function loadCollection(name){
  const snap = await APP.firebase.getDocs(APP.firebase.collection(APP.db,name));
  const rows = [];
  snap.forEach(d=>rows.push({id:d.id,...d.data()}));
  return rows;
}
async function loadAll(){
  setStatus("Data laden...");
  const [users,orders] = await Promise.all([loadCollection("users"), loadCollection("orders")]);
  APP.state.users = users;
  APP.state.orders = orders;
  setStatus("Data geladen");
}
async function writeDoc(col,id,data){
  if(!id) throw new Error("Geen id");
  await APP.firebase.setDoc(APP.firebase.doc(APP.db,col,String(id)),data,{merge:true});
}
async function addAlert(alert){
  const id = alert.id || ("alert_"+Date.now()+"_"+Math.random().toString(36).slice(2,7));
  const row = { ...alert, id, resolved:false, source:"bezorger", createdAt: alert.createdAt || nowIso(), time: alert.time || nowLocal() };
  await writeDoc("alerts", id, row);
  return row;
}

function userAllowed(u){ return lower(u.role)==="bezorger" || lower(u.role)==="driver" || lower(u.role)==="chauffeur"; }
function loginByPin(){
  const pin = clean($("loginPin").value);
  if(!pin){ toast("Vul je PIN in"); return; }
  const found = (APP.state.users||[]).find(u => userAllowed(u) && clean(u.pin) === pin);
  if(!found){ toast("PIN klopt niet of gebruiker is geen bezorger"); return; }
  APP.user = found;
  sessionStorage.setItem("tapwagen_driver_user_id", String(found.id));
  $("loginPin").value = "";
  showApp();
}
function restoreSession(){
  const id = sessionStorage.getItem("tapwagen_driver_user_id");
  if(!id) return false;
  const u = (APP.state.users||[]).find(x => String(x.id)===String(id));
  if(u && userAllowed(u)){ APP.user = u; showApp(); return true; }
  return false;
}
function logout(){ sessionStorage.removeItem("tapwagen_driver_user_id"); APP.user=null; showLogin(); }

function userRights(){ return (APP.user && APP.user.rights) || {}; }
function hasRight(keys, fallback=false){
  const r = userRights();
  for(const k of keys){ if(r[k] === true) return true; if(r[k] === false) return false; }
  return fallback;
}
const RIGHTS = {
  route:      ["gps","route","waze"],
  call:       ["phoneCall","call","bellen","klantBellen"],
  message:    ["resolve","meldingen","reports","report","phoneMessage"],
  storing:    ["reportStoring","storing","storingMelden"],
  damage:     ["reportDamage","damage","schade","schadeMelden"],
  missing:    ["reportMissing","missing","vermissing","vermissingMelden"],
  photoBefore:["photoBefore","fotoVoor","fotoVoorLevering"],
  photoAfter: ["photoAfter","fotoNa","fotoNaLevering"],
  signature:  ["signatureCustomer","signature","handtekening","handtekeningKlant"],
  done:       ["phoneDone","done","uitgevoerd","afmelden"]
};
function can(k){
  if(!APP.user) return false;
  if(lower(APP.user.role)==="admin") return true;
  const def = (k === "route" || k === "message" || k === "done") ? true : false;
  return hasRight(RIGHTS[k]||[k], def);
}

function statusOf(o){ return lower(o && o.status); }
function isCancelled(o){ return ["geannuleerd","annulering","cancelled","canceled"].includes(statusOf(o)); }
function isDone(o){ return ["uitgevoerd","afgerond","voltooid","done","klaar"].includes(statusOf(o)); }
function isDeleted(o){ return ["verwijderd","deleted","trash","gewist"].includes(statusOf(o)); }
function orderStart(o){ return clean(o.start || o.dateStart || o.startDate || o.date || ""); }
function orderEnd(o){ return clean(o.end || o.dateEnd || o.endDate || orderStart(o)); }
function dateTime(v){ const d=new Date(clean(v).slice(0,10)+"T00:00:00"); return Number.isNaN(d.getTime())?0:d.getTime(); }
function todayTime(){ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
function niceDate(v){ v=clean(v).slice(0,10); const p=v.split("-"); return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:v; }
function customerName(o){ return clean(o.customerName || (o.customer&&o.customer.name) || o.klant || ""); }
function customerPhone(o){ return clean(o.customerPhone || o.phone || (o.customer&&o.customer.phone) || ""); }
function addressOf(o){
  const p=[]; const add=(v)=>{ v=clean(v); if(v && !p.includes(v)) p.push(v); };
  [o.locationName,o.locationAddress,o.locationStreet,o.locationZip,o.locationCity,o.address,o.street,o.zip,o.city].forEach(add);
  if(o.location && typeof o.location === "object") [o.location.name,o.location.address,o.location.street,o.location.zip,o.location.city].forEach(add);
  return p.join(" ");
}
function materialList(o){
  const m = Array.isArray(o.materials) ? o.materials : (Array.isArray(o.mats) ? o.mats : []);
  return m.map(x => typeof x === "string" ? x : clean([x.code,x.name].filter(Boolean).join(" "))).filter(Boolean);
}
function materialText(o){ return materialList(o).join(", "); }
function routeUrl(type,a){ const q=encodeURIComponent(a||""); return type==="waze" ? `https://waze.com/ul?q=${q}&navigate=yes` : `https://www.google.com/maps/search/?api=1&query=${q}`; }

function allDriverIds(o){ return unique([o.driverId,o.bezorgerId,o.userId].concat(Array.isArray(o.driverIds)?o.driverIds:[]).concat(Array.isArray(o.bezorgerIds)?o.bezorgerIds:[])); }
function allDriverNames(o){
  const raw=[o.driverName,o.driver,o.bezorger,o.bezorgerName].concat(Array.isArray(o.driverNames)?o.driverNames:[]).concat(Array.isArray(o.bezorgerNames)?o.bezorgerNames:[]);
  return unique(raw.flatMap(v => clean(v).split(/[,;|]/g))).map(lower);
}
function assignedToUser(o){
  const uid=String(APP.user.id||""); const un=lower(APP.user.name||"");
  if(allDriverIds(o).map(String).includes(uid)) return true;
  if(allDriverNames(o).includes(un)) return true;
  return false;
}
function visibleOrder(o){
  if(!o || isCancelled(o) || isDone(o) || isDeleted(o)) return false;
  if(dateTime(orderEnd(o)) && dateTime(orderEnd(o)) < todayTime()) return false;
  return assignedToUser(o);
}
function getOrders(){ return (APP.state.orders||[]).filter(visibleOrder).sort((a,b)=>dateTime(orderStart(a))-dateTime(orderStart(b))); }
function findOrder(id){ return (APP.state.orders||[]).find(o=>String(o.id)===String(id)); }

function showLogin(){
  $("loginBox").classList.remove("hidden");
  $("appBox").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  $("who").textContent = "Mobiele opdrachten";
  setTimeout(()=>$("loginPin") && $("loginPin").focus(),80);
}
function showApp(){
  $("loginBox").classList.add("hidden");
  $("appBox").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("who").textContent = APP.user ? `${APP.user.name} - Bezorger` : "Mobiele opdrachten";
  renderOrders();
}
function orderCard(o){
  const id=esc(o.id||""); const a=addressOf(o); const ph=customerPhone(o);
  const s=orderStart(o), e=orderEnd(o); const dl=s&&e&&s!==e ? `${niceDate(s)} t/m ${niceDate(e)}` : niceDate(s||e);
  const actions=[];
  actions.push(`<button type="button" class="more-btn wide" data-detail="${id}">Open opdracht</button>`);
  if(can("route")){
    actions.push(`<a class="btn btn-green" href="${esc(routeUrl("waze",a))}" target="_blank" rel="noopener">Waze</a>`);
    actions.push(`<a class="btn btn-dark" href="${esc(routeUrl("maps",a))}" target="_blank" rel="noopener">Maps</a>`);
  }
  if(can("call")) actions.push(ph ? `<a class="btn" href="tel:${esc(ph)}">Bel klant</a>` : `<button type="button" class="btn">Geen tel.</button>`);
  if(can("message")) actions.push(`<button type="button" class="btn btn-orange" data-report="${id}" data-type="Bezorger melding">Melding</button>`);
  if(can("storing")) actions.push(`<button type="button" class="btn btn-red" data-report="${id}" data-type="Storing">Storing</button>`);
  if(can("damage")) actions.push(`<button type="button" class="btn btn-orange" data-report="${id}" data-type="Schade">Schade</button>`);
  if(can("missing")) actions.push(`<button type="button" class="btn btn-purple" data-report="${id}" data-type="Vermissing">Vermissing</button>`);
  if(can("photoBefore")) actions.push(`<button type="button" class="btn btn-dark" data-photo="${id}" data-type="Foto voor levering">Foto voor</button>`);
  if(can("photoAfter")) actions.push(`<button type="button" class="btn btn-dark" data-photo="${id}" data-type="Foto na levering">Foto na</button>`);
  if(can("signature")) actions.push(`<button type="button" class="btn btn-purple" data-sign="${id}">Handtekening</button>`);
  if(can("done")) actions.push(`<button type="button" class="btn btn-green wide" data-done="${id}">Afmelden / uitgevoerd</button>`);
  return `<article class="order-card order" data-id="${id}"><span class="order-number">${esc(o.number||"Opdracht")}</span><div class="order-title">${esc(o.title||"Zonder titel")}</div><div class="meta"><div class="meta-row"><span>📅</span><div><strong>${esc(dl||"Geen datum")}</strong></div></div><div class="meta-row"><span>👤</span><div>${esc(customerName(o)||"Klant onbekend")}</div></div><div class="meta-row"><span>📍</span><div>${esc(a||"Adres onbekend")}</div></div><div class="meta-row"><span>📦</span><div>${esc(materialText(o)||"Geen materialen")}</div></div></div><div class="action-grid">${actions.join("")}</div></article>`;
}
function renderOrders(){
  const rows=getOrders();
  $("orders").innerHTML = rows.length ? rows.map(orderCard).join("") : `<div class="empty">Geen opdrachten voor deze gebruiker.</div>`;
  bindActions();
}

function alertBase(order,type,note,extra){
  return {
    id: "alert_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
    title: type,
    type: type,
    kind: type,
    note: note || "",
    message: note || "",
    text: note || "",
    orderId: order.id || "",
    linkedOrder: order.id || "",
    orderNumber: order.number || "",
    linkedOrderNumber: order.number || "",
    orderTitle: order.title || "",
    customerName: customerName(order),
    klant: customerName(order),
    driverName: APP.user && APP.user.name || "",
    from: APP.user && APP.user.name || "",
    userId: APP.user && APP.user.id || "",
    resolved: false,
    source: "bezorger",
    createdAt: nowIso(),
    time: nowLocal(),
    ...(extra||{})
  };
}
async function sendAlert(order,type,note,extra){
  const alert = alertBase(order,type,note,extra);
  await addAlert(alert);
  return alert;
}
async function sendReport(order,type){
  const label = type || "Bezorger melding";
  let promptText = "Melding voor planning:";
  if(label === "Schade") promptText = "Omschrijving schade:";
  if(label === "Storing") promptText = "Omschrijving storing:";
  if(label === "Vermissing") promptText = "Wat mist er?";
  const note = prompt(promptText, "");
  if(!note) return;
  try{ await sendAlert(order,label,note,{}); toast("Melding verstuurd naar planning"); }
  catch(e){ console.error(e); toast("Niet verstuurd: "+(e.message||e)); }
}
function compressImage(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader(); r.onerror=reject; r.onload=()=>{
      const img=new Image(); img.onerror=reject; img.onload=()=>{
        const max=1000; let w=img.width,h=img.height;
        if(w>h && w>max){ h=Math.round(h*max/w); w=max; } else if(h>max){ w=Math.round(w*max/h); h=max; }
        const c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
        resolve(c.toDataURL("image/jpeg",0.75));
      }; img.src=r.result;
    }; r.readAsDataURL(file);
  });
}
async function takePhoto(order,type){
  const input=document.createElement("input"); input.type="file"; input.accept="image/*"; input.capture="environment";
  input.onchange=async()=>{
    const file=input.files && input.files[0]; if(!file) return;
    try{
      setStatus("Foto verwerken...");
      const data=await compressImage(file);
      const note=prompt("Opmerking bij foto:", "") || type;
      const item={id:"media_"+Date.now(), type, data, note, createdAt:nowIso(), time:nowLocal(), driverId:APP.user.id, driverName:APP.user.name};
      order.media=Array.isArray(order.media)?order.media:[]; order.media.push(item);
      order.photos=Array.isArray(order.photos)?order.photos:[]; order.photos.push(item);
      order.customerPhotos=Array.isArray(order.customerPhotos)?order.customerPhotos:[]; order.customerPhotos.push(item);
      await writeDoc("orders", order.id, order);
      await sendAlert(order,type,note,{photoData:data, media:item});
      setStatus("Data geladen"); toast("Foto verstuurd naar planning");
    }catch(e){ console.error(e); setStatus("Data geladen"); toast("Foto niet verstuurd: "+(e.message||e)); }
  };
  input.click();
}
function openSignature(order){
  const old=document.getElementById("signModal"); if(old) old.remove();
  const m=document.createElement("div"); m.id="signModal"; m.className="tw-modal";
  m.innerHTML=`<div class="tw-modal-card"><h2>Handtekening klant</h2><input id="sigName" placeholder="Naam klant"><canvas id="sigCanvas" class="tw-sign"></canvas><button id="sigSave" class="btn btn-green btn-full" type="button">Handtekening opslaan</button><button id="sigClear" class="btn btn-dark btn-full" type="button">Opnieuw tekenen</button><button id="sigCancel" class="btn btn-red btn-full" type="button">Annuleren</button></div>`;
  document.body.appendChild(m);
  const c=$("sigCanvas"), ctx=c.getContext("2d"); let drawing=false,has=false;
  function fit(){ const r=c.getBoundingClientRect(); c.width=Math.max(300,Math.floor(r.width)); c.height=220; ctx.lineWidth=3; ctx.lineCap="round"; ctx.strokeStyle="#111827"; }
  function pos(ev){ const e=(ev.touches&&ev.touches[0])||ev, r=c.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  function start(ev){ ev.preventDefault(); drawing=true; has=true; const p=pos(ev); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(ev){ if(!drawing) return; ev.preventDefault(); const p=pos(ev); ctx.lineTo(p.x,p.y); ctx.stroke(); }
  function end(ev){ if(ev) ev.preventDefault(); drawing=false; }
  setTimeout(fit,30);
  ["mousedown","touchstart"].forEach(n=>c.addEventListener(n,start,{passive:false}));
  ["mousemove","touchmove"].forEach(n=>c.addEventListener(n,move,{passive:false}));
  ["mouseup","mouseleave","touchend","touchcancel"].forEach(n=>c.addEventListener(n,end,{passive:false}));
  $("sigCancel").onclick=()=>m.remove();
  $("sigClear").onclick=()=>{ fit(); has=false; };
  $("sigSave").onclick=async()=>{
    if(!has){ toast("Laat eerst tekenen"); return; }
    try{
      const name=clean($("sigName").value); const data=c.toDataURL("image/png");
      const item={id:"sig_"+Date.now(), type:"Handtekening klant", data, customerName:name, createdAt:nowIso(), time:nowLocal(), driverId:APP.user.id, driverName:APP.user.name};
      order.media=Array.isArray(order.media)?order.media:[]; order.media.push(item);
      order.signatures=Array.isArray(order.signatures)?order.signatures:[]; order.signatures.push(item);
      order.customerSignature=data; order.customerSignedName=name; order.customerSignedAt=nowIso();
      await writeDoc("orders", order.id, order);
      await sendAlert(order,"Handtekening klant", name?`Ondertekend door ${name}`:"Klant heeft getekend", {signatureData:data, signatureName:name, media:item});
      m.remove(); toast("Handtekening verstuurd naar planning");
    }catch(e){ console.error(e); toast("Handtekening niet verstuurd: "+(e.message||e)); }
  };
}
async function markDone(order){
  if(!confirm("Opdracht afmelden als uitgevoerd?")) return;
  order.status="Uitgevoerd"; order.doneAt=nowIso(); order.doneBy=APP.user.name||"";
  await writeDoc("orders", order.id, order);
  await loadAll(); renderOrders(); toast("Opdracht afgemeld");
}
function showDetail(id){
  const o=findOrder(id); if(!o) return;
  $("ordersView").classList.add("hidden"); $("detailView").classList.remove("hidden");
  $("detailView").innerHTML = `<div class="detail-header"><button type="button" class="back-btn" data-back>Terug</button></div>${orderCard(o)}`;
  bindActions();
}
function showOrders(){ $("detailView").classList.add("hidden"); $("ordersView").classList.remove("hidden"); }
function bindActions(){
  $$('[data-detail]').forEach(b=>b.onclick=()=>showDetail(b.dataset.detail));
  $$('[data-back]').forEach(b=>b.onclick=showOrders);
  $$('[data-report]').forEach(b=>b.onclick=()=>{ const o=findOrder(b.dataset.report); if(o) sendReport(o,b.dataset.type); });
  $$('[data-photo]').forEach(b=>b.onclick=()=>{ const o=findOrder(b.dataset.photo); if(o) takePhoto(o,b.dataset.type); });
  $$('[data-sign]').forEach(b=>b.onclick=()=>{ const o=findOrder(b.dataset.sign); if(o) openSignature(o); });
  $$('[data-done]').forEach(b=>b.onclick=()=>{ const o=findOrder(b.dataset.done); if(o) markDone(o); });
}

async function refresh(){
  try{
    await loadAll();
    if(APP.user){
      const fresh=(APP.state.users||[]).find(u=>String(u.id)===String(APP.user.id));
      if(fresh) APP.user=fresh;
      showApp();
    }
    toast("Verversd");
  }catch(e){ console.error(e); toast("Verversen mislukt: "+(e.message||e)); }
}
async function boot(){
  try{
    await initFirebase(); await loadAll();
    $("loginBtn").onclick=loginByPin;
    $("loginPin").addEventListener("keydown", e=>{ if(e.key==="Enter") loginByPin(); });
    $("logoutBtn").onclick=logout;
    $("refreshBtn").onclick=refresh;
    $("clearSearchBtn").onclick=()=>{ $("searchBox").value=""; $$(".order").forEach(el=>el.style.display=""); };
    $("searchBox").oninput=()=>{ const q=lower($("searchBox").value); $$(".order").forEach(el=>el.style.display=!q||lower(el.innerText).includes(q)?"":"none"); };
    if(!restoreSession()) showLogin();
  }catch(e){ console.error(e); setStatus("Fout: "+(e.message||e)); }
}
boot();
