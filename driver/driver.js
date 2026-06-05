const FIREBASE_VERSION="10.12.5";
const BNS={firebase:null,app:null,db:null,user:null,state:{users:[],orders:[],alerts:[]}};

const $=id=>document.getElementById(id);
const qsa=(sel,root=document)=>Array.from(root.querySelectorAll(sel));

function clean(v){return String(v||"").trim()}
function lower(v){return clean(v).toLowerCase()}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function toast(t){const e=$("toast");if(!e){alert(t);return}e.textContent=String(t||"");e.classList.add("show");clearTimeout(e._timer);e._timer=setTimeout(()=>e.classList.remove("show"),3800)}
function setStatus(t){const e=$("status");if(e)e.textContent=t}
function hasRight(k){return !!(BNS.user&&BNS.user.rights&&BNS.user.rights[k])}
function hasAnyRight(keys){return keys.some(k=>hasRight(k))}
function statusOf(o){return lower(o&&o.status)}
function isCancelled(o){return["geannuleerd","geannuleerde","annulering","cancelled","canceled"].includes(statusOf(o))}
function isDone(o){return["uitgevoerd","afgerond","voltooid","done","klaar"].includes(statusOf(o))}
function isDeleted(o){return["verwijderd","gewist","deleted","trash"].includes(statusOf(o))}
function orderStart(o){return clean(o.start||o.dateStart||o.startDate||o.date||"")}
function orderEnd(o){return clean(o.end||o.dateEnd||o.endDate||orderStart(o))}
function dateTime(v){const d=new Date(clean(v).slice(0,10)+"T00:00:00");return Number.isNaN(d.getTime())?0:d.getTime()}
function todayTime(){const d=new Date();d.setHours(0,0,0,0);return d.getTime()}
function niceDate(v){v=clean(v).slice(0,10);const p=v.split("-");return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:v}
function addressOf(o){const p=[];const add=v=>{v=clean(v);if(v&&!p.includes(v))p.push(v)};[o.locationName,o.locationAddress,o.locationStreet,o.locationZip,o.locationCity,o.address,o.street,o.zip,o.city].forEach(add);if(o.location&&typeof o.location==="object")[o.location.name,o.location.address,o.location.street,o.location.zip,o.location.city].forEach(add);return p.join(", ")}
function customerName(o){return clean(o.customerName||(o.customer&&o.customer.name)||o.klant||"")}
function customerPhone(o){return clean(o.customerPhone||o.phone||(o.customer&&o.customer.phone)||"")}
function driverName(o){return clean(o.driverName||o.driver||o.bezorger||"")}
function materialList(o){const m=o.materials||o.mats||[];return Array.isArray(m)?m.map(x=>typeof x==="string"?{name:x,qty:""}:{name:x.code||x.name||"",qty:x.qty||x.count||x.aantal||"",extra:x.extra||x.note||""}).filter(x=>x.name):[]}
function materialText(o){const m=materialList(o);return m.length?m.map(x=>`${x.qty?x.qty+"x ":""}${x.name}`).join(", "):""}
function routeUrl(type,a){const q=encodeURIComponent(a||"");return type==="waze"?`https://waze.com/ul?q=${q}&navigate=yes`:`https://www.google.com/maps/search/?api=1&query=${q}`}

async function initFirebase(){
  if(!window.BNS_FIREBASE_CONFIG||window.BNS_FIREBASE_CONFIG.apiKey==="VUL_HIER_IN"){
    setStatus("Firebase config ontbreekt of is niet ingevuld.");
    toast("Firebase config ontbreekt");
    throw new Error("Firebase config ontbreekt");
  }
  const appMod=await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
  const fsMod=await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
  BNS.firebase=fsMod;
  BNS.app=appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
  BNS.db=fsMod.getFirestore(BNS.app);
  setStatus("Firebase verbonden");
}
async function loadCollection(n){
  const s=await BNS.firebase.getDocs(BNS.firebase.collection(BNS.db,n));
  let rows=s.docs.map(d=>({id:d.id,...d.data()}));

  // BNS v446: alleen orders filteren voor telefoon. Users nooit filteren.
  if(n==="orders"){
    rows=rows.filter(o=>{
      const id=String((o&&(o.id||o.docId||o.orderId))||"");
      if(id.indexOf("old_")===0) return false;
      const f=lower((o&&(o.folder||o.map||o.orderFolder))||"");
      if(f) return f==="lopend";
      const st=lower(o&&o.status);
      return /bevestigd|opdrachtbevestiging|opdracht|actief|lopend/.test(st) &&
        !/offerte|optie|geann|annul|cancel|verwijderd|deleted|trash|uitgevoerd|afgerond|done|klaar|afgemeld/.test(st);
    });
  }
  return rows;
}
async function loadInitial(){
  setStatus("Data laden...");
  BNS.state.users=await loadCollection("users");
  BNS.state.orders=await loadCollection("orders");
  try{ BNS.state.alerts=await loadCollection("alerts"); }catch(e){}
  setStatus("Data geladen");
}
async function loadOrdersOnly(){
  BNS.state.orders=await loadCollection("orders");
}
async function loadUsersOnly(){
  BNS.state.users=await loadCollection("users");
  if(BNS.user){
    const fresh=(BNS.state.users||[]).find(u=>String(u.id)===String(BNS.user.id));
    if(fresh) BNS.user=fresh;
  }
}
async function loadPhoneData(){
  BNS.state.users=await loadCollection("users");
  BNS.state.orders=await loadCollection("orders");
  try{ BNS.state.alerts=await loadCollection("alerts"); }catch(e){}
  if(BNS.user){
    const fresh=(BNS.state.users||[]).find(u=>String(u.id)===String(BNS.user.id));
    if(fresh) BNS.user=fresh;
  }
}
async function updateOrder(o){
  if(!o||!o.id)return;
  o.updatedAt=new Date().toISOString();
  await BNS.firebase.setDoc(BNS.firebase.doc(BNS.db,"orders",String(o.id)),o);
}
async function addAlert(a){
  const id=a.id||("a_"+Math.random().toString(36).slice(2,10));
  a.id=id;
  await BNS.firebase.setDoc(BNS.firebase.doc(BNS.db,"alerts",id),a,{merge:true});
  BNS.state.alerts = Array.isArray(BNS.state.alerts) ? BNS.state.alerts : [];
  const ix = BNS.state.alerts.findIndex(x => String(x.id) === String(id));
  if(ix >= 0) BNS.state.alerts[ix] = a; else BNS.state.alerts.unshift(a);
}

function populateUsers(f){
  let users=(BNS.state.users||[]).filter(f);
  try{
    const locked=localStorage.getItem(LOCKED_USER_KEY)||"";
    if(locked){
      const one=users.find(u=>String(u.id)===String(locked));
      if(one) users=[one];
    }
  }catch(e){}
  $("loginName").innerHTML=users.length?users.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.role||"Medewerker")})</option>`).join(""):`<option value="">Geen gebruikers gevonden</option>`;
}
function loginWithFilter(f,key,after){
  const id=$("loginName").value,pin=clean($("loginPin").value);
  const found=(BNS.state.users||[]).find(u=>String(u.id)===String(id)&&String(u.pin||"")===pin);
  if(!found){toast("Naam of PIN klopt niet");return}
  if(!f(found)){toast("Geen rechten voor deze portal");return}
  BNS.user=found;
  sessionStorage.setItem(key,found.id);
  try{localStorage.setItem(LOCKED_USER_KEY, found.id);}catch(e){}
  $("loginPin").value="";
  after();
}
function restoreSession(f,key,after){
  const id=sessionStorage.getItem(key);
  if(!id)return;
  const found=(BNS.state.users||[]).find(u=>String(u.id)===String(id));
  if(found&&f(found)){BNS.user=found;after()}
}

const SESSION_KEY="tapwagen_driver_user_id_v143";
const LOCKED_USER_KEY="tapwagen_driver_locked_user_id";
let CURRENT_DETAIL_ID="";

function userAllowed(u){
  if(!u) return false;
  const r=lower(u.role||u.type||u.functie||"");
  const nm=lower(u.name||u.naam||u.displayName||"");
  const id=lower(u.id||u.uid||"");
  const rights=u.rights||{};
  if(u.deleted===true || u.disabled===true || u.active===false) return false;
  if(id==="u_admin" || id==="u_planner" || id==="admin" || id==="planner") return false;
  if(nm==="admin" || nm==="planner") return false;
  if(clean(u.pin) && clean(u.name||u.naam||u.displayName)) return true;
  return r==="bezorger" || r==="driver" || !!(rights && (
    rights.gps || rights.route || rights.waze || rights.agenda || rights.resolve || rights.orders ||
    rights.afmelden || rights.afmeldenMelding || rights.complete || rights.done || rights.uitgevoerd ||
    rights.bellen || rights.callCustomer || rights.customerSignature ||
    rights.damage || rights.schade || rights.storing || rights.materials || rights.prices
  ));
}

/* BNS v460 telefoon folder helpers */
function BNS_driverFolderFromStatus(st){
  const s=lower(st||"");
  if(/offerte/.test(s))return"offerte";
  if(/optie|14/.test(s))return"optie14";
  if(/geann|annul|cancel|verwijderd|deleted|trash/.test(s))return"geannuleerd";
  if(/uitgevoerd|afgerond|done|klaar|afgemeld/.test(s))return"uitgevoerd";
  if(/bevestigd|opdrachtbevestiging|opdracht|actief|lopend/.test(s))return"lopend";
  return"";
}
function BNS_driverFolder(o){
  const id=String((o&&(o.id||o.docId||o.orderId))||"");
  if(id.indexOf("old_")===0)return"archief";
  const f=lower((o&&(o.folder||o.map||o.orderFolder))||"");
  if(f){ if(f==="live")return"lopend"; if(f==="optie")return"optie14"; if(f==="old")return"archief"; return f; }
  return BNS_driverFolderFromStatus(o&&o.status);
}
function BNS_orderIsLiveForPhone(o){
  return !!(o && BNS_driverFolder(o)==="lopend" && BNS_driverHasAssignee(o) && o.afgemeld!==true && o.phoneDone!==true && o.completed!==true && !isCancelled(o) && !isDone(o) && !isDeleted(o));
}
function BNS_driverHasAssignee(o){
  if(!o) return false;
  const vals=[];
  ['driverId','bezorgerId','userId','assignedDriverId','driverName','driver','bezorger','bezorgerName','assignedDriver','assignedDriverName'].forEach(k=>{ if(o[k]) vals.push(clean(o[k])); });
  ['driverIds','bezorgerIds','userIds','assignedDriverIds','driverNames','bezorgerNames','assignedDriverNames','drivers','bezorgers','driverList','selectedDrivers','assigned','assignedDrivers'].forEach(k=>{
    const v=o[k];
    if(Array.isArray(v)) v.forEach(x=>vals.push(clean((x&&typeof x==='object')?(x.id||x.name||x.naam):x)));
  });
  return vals.some(Boolean);
}

function assignedToUser(o){
  if(!BNS.user || !o) return false;
  const uid=String(BNS.user.id||""), un=lower(BNS.user.name||"");
  const ids=[];
  const names=[];
  const addId=v=>{ String(v==null?"":v).split(new RegExp('[;,\n|]+')).map(clean).filter(Boolean).forEach(x=>ids.push(String(x))); };
  const addName=v=>{ String(v==null?"":v).split(new RegExp('[;,\n|]+')).map(lower).filter(Boolean).forEach(x=>names.push(x)); };
  [o.driverId,o.bezorgerId,o.userId,o.assignedDriverId].forEach(addId);
  [o.driverIds,o.bezorgerIds,o.userIds,o.assignedDriverIds,o.selectedDrivers].forEach(a=>{ if(Array.isArray(a))a.forEach(addId); });
  [o.drivers,o.bezorgers,o.driverList,o.assigned,o.assignedDrivers].forEach(a=>{ if(Array.isArray(a))a.forEach(x=>{ if(x&&typeof x==='object'){ addId(x.id); addName(x.name||x.naam); } else { addId(x); addName(x); } }); });
  [o.driverName,o.driver,o.bezorger,o.bezorgerName,o.assignedDriver,o.assignedDriverName].forEach(addName);
  [o.driverNames,o.bezorgerNames,o.assignedDriverNames].forEach(a=>{ if(Array.isArray(a))a.forEach(addName); });
  if(uid&&ids.includes(uid))return true;
  if(un&&names.includes(un))return true;
  if((lower(BNS.user.role)==="planner"||lower(BNS.user.role)==="admin")&&hasRight("orders"))return true;
  return false;
}
function visibleOrder(o){
  if(!BNS_orderIsLiveForPhone(o))return false;
  if(dateTime(orderEnd(o))<todayTime())return false;
  return assignedToUser(o);
}
function getOrders(){
  return(BNS.state.orders||[]).filter(visibleOrder).sort((a,b)=>dateTime(orderStart(a))-dateTime(orderStart(b)));
}
function findOrder(id){return(BNS.state.orders||[]).find(o=>String(o.id)===String(id))}
function otherCustomerOrders(o){
  const currentId = String(o.id || "");
  const currentNumber = String(o.number || "");

  return (BNS.state.orders || [])
    .filter(x => String(x.id || "") !== currentId)
    .filter(x => String(x.number || "") === currentNumber)
    .filter(x => !isCancelled(x))
    .filter(x => !isDone(x))
    .filter(x => !isDeleted(x))
    .filter(x => dateTime(orderEnd(x)) >= todayTime())
    .sort((a,b) => dateTime(orderStart(a)) - dateTime(orderStart(b)));
}
function canRoute(){return hasAnyRight(["gps","route","waze"])||lower(BNS.user.role)==="admin"}
function canAgenda(){return hasRight("agenda")||lower(BNS.user.role)==="admin"}
function canDone(){return hasAnyRight(["resolve","afmelden","done","uitgevoerd"])||lower(BNS.user.role)==="admin"}
function canMaterials(){return hasAnyRight(["materials","materialen","orders"])||lower(BNS.user.role)==="admin"}
function canPrices(){return hasAnyRight(["prices","prijzen"])||lower(BNS.user.role)==="admin"}
function canReport(){return true}
function canDamage(){return hasAnyRight(["damage","schade","storing","vermissing","reports","meldingen","orders"])||lower(BNS.user.role)==="admin"}
function canPhotoBefore(){return hasAnyRight(["fotoVoor","photoBefore","foto_voor","fotoVoorLevering","photo_before","reports","meldingen","orders"])||lower(BNS.user.role)==="admin"}
function canPhotoAfter(){return hasAnyRight(["fotoNa","photoAfter","foto_na","fotoNaLevering","photo_after","reports","meldingen","orders"])||lower(BNS.user.role)==="admin"}
function canSignature(){return hasAnyRight(["handtekening","signature","sign","klantHandtekening","reports","meldingen","orders"])||lower(BNS.user.role)==="admin"}

function orderBadges(o){
  const badges=[`<span class="badge">${esc(o.status||"Open")}</span>`];
  if(canAgenda())badges.push(`<span class="badge">Agenda</span>`);
  if(canRoute())badges.push(`<span class="badge ok">Route</span>`);
  if(otherCustomerOrders(o).length)badges.push(`<span class="badge warn">Meer artikelen</span>`);
  if(canPrices())badges.push(`<span class="badge dark">Prijzen</span>`);
  return badges.join("");
}

function orderCard(o){
  const a=addressOf(o),p=customerPhone(o),s=orderStart(o),e=orderEnd(o),dl=s&&e&&s!==e?`${niceDate(s)} t/m ${niceDate(e)}`:niceDate(s||e);
  const mats=materialList(o);
  return `<article class="order-card order" data-id="${esc(o.id)}">
    <span class="order-number">${esc(o.number||"Opdracht")}</span>
    <div class="order-title">${esc(o.title||"Zonder titel")}</div>
    <div class="badges">${orderBadges(o)}</div>
    <div class="meta">
      <div class="meta-row"><span>📅</span><div><strong>${esc(dl||"Geen datum")}</strong></div></div>
      <div class="meta-row"><span>👤</span><div>${esc(customerName(o)||"Klant onbekend")}</div></div>
      <div class="meta-row"><span>📍</span><div>${esc(a||"Adres onbekend")}</div></div>
      <div class="meta-row"><span>📦</span><div>${esc(mats.length?`${mats.length} artikelsoorten - ${materialText(o)}`:"Geen materialen")}</div></div>
    </div>
    <div class="action-grid">
      <button type="button" class="more-btn wide" data-detail="${esc(o.id)}">Open opdracht</button>
      ${canRoute()?`<a class="btn btn-green" href="${esc(routeUrl("waze",a))}" target="_blank" rel="noopener">Waze</a>`:""}
      ${canRoute()?`<a class="btn btn-dark" href="${esc(routeUrl("maps",a))}" target="_blank" rel="noopener">Maps</a>`:""}
      ${p?`<a class="btn" href="tel:${esc(p)}">Bel klant</a>`:""}
      ${canReport()?`<button type="button" class="btn btn-orange" data-report="${esc(o.id)}" data-type="Melding">Melding</button>`:""}
      ${canDamage()?`<button type="button" class="btn btn-red" data-report="${esc(o.id)}" data-type="Schade">Schade</button>`:""}
      ${canDamage()?`<button type="button" class="btn btn-purple" data-report="${esc(o.id)}" data-type="Storing">Storing</button>`:""}
      ${canQuote()?`<button type="button" class="btn btn-orange" data-quote="${esc(o.id)}">Offerte</button>`:""}
      ${canDone()?`<button type="button" class="btn btn-full btn-green wide" data-done="${esc(o.id)}">Afmelden / uitgevoerd</button>`:""}
    </div>
  </article>`;
}

function render(){
  const rows=getOrders();
  $("orders").innerHTML=rows.length?rows.map(orderCard).join(""):`<div class="empty">Geen opdrachten voor deze gebruiker.</div>`;
  bindActions();
}

function showOrders(){
  CURRENT_DETAIL_ID="";
  $("detailView").classList.add("hidden");
  $("ordersView").classList.remove("hidden");
}

function detailHtml(o){
  const a=addressOf(o),p=customerPhone(o),mats=materialList(o),more=otherCustomerOrders(o);
  const s=orderStart(o),e=orderEnd(o),dl=s&&e&&s!==e?`${niceDate(s)} t/m ${niceDate(e)}`:niceDate(s||e);
  return `<div class="detail-header"><button type="button" class="back-btn" data-back>Terug</button></div>
  <article class="card detail-card">
    <h2>${esc(o.number||"")} - ${esc(o.title||"Zonder titel")}</h2>
    <div class="badges">${orderBadges(o)}</div>
    <div class="section-title">Opdracht</div>
    <div class="info-box">📅 ${esc(dl||"Geen datum")}<br>👤 ${esc(customerName(o)||"Klant onbekend")}<br>📍 ${esc(a||"Adres onbekend")}<br>🚚 ${esc(driverName(o)||BNS.user?.name||"")}</div>

    <div class="section-title">Materialen</div>
    <div class="info-box">${mats.length?mats.map(x=>`• ${esc(x.qty?x.qty+"x ":"")}${esc(x.name)}${x.extra?" - "+esc(x.extra):""}`).join("<br>"):"Geen materialen"}</div>

    ${more.length?`<div class="section-title">Meer artikelen / opdrachten voor deze klant</div><div class="info-box">${more.map(x=>`• ${esc(x.number||"")} ${esc(x.title||"")} - ${esc(niceDate(orderStart(x)))}`).join("<br>")}</div>`:""}

    <div class="section-title">Acties</div>
    <div class="report-grid">
      ${canRoute()?`<a class="btn btn-green" href="${esc(routeUrl("waze",a))}" target="_blank" rel="noopener">Waze</a>`:""}
      ${canRoute()?`<a class="btn btn-dark" href="${esc(routeUrl("maps",a))}" target="_blank" rel="noopener">Google Maps</a>`:""}
      ${p?`<a class="btn" href="tel:${esc(p)}">Bel klant</a>`:""}
      ${canAgenda()?`<button type="button" class="btn btn-dark" data-agenda="${esc(o.id)}">Agenda info</button>`:""}
      ${canReport()?`<button type="button" class="btn btn-orange" data-report="${esc(o.id)}" data-type="Melding">Melding</button>`:""}
      ${canDamage()?`<button type="button" class="btn btn-red" data-report="${esc(o.id)}" data-type="Schade">Schade</button>`:""}
      ${canDamage()?`<button type="button" class="btn btn-purple" data-report="${esc(o.id)}" data-type="Storing">Storing</button>`:""}
      ${canDamage()?`<button type="button" class="btn btn-dark" data-report="${esc(o.id)}" data-type="Vermissing">Vermissing</button>`:""}
      ${canQuote()?`<button type="button" class="btn btn-orange" data-quote="${esc(o.id)}">Offerte</button>`:""}
      ${canDone()?`<button type="button" class="btn btn-full btn-green wide" data-done="${esc(o.id)}">Afmelden / uitgevoerd</button>`:""}
    </div>
  </article>`;
}

function showDetail(id){
  CURRENT_DETAIL_ID=String(id||"");
  const o=findOrder(id);
  if(!o)return;
  $("ordersView").classList.add("hidden");
  $("detailView").classList.remove("hidden");
  $("detailView").innerHTML=detailHtml(o);
  bindActions();
}

function askText(title, label){
  return new Promise(resolve=>{
    const wrap=document.createElement("div");
    wrap.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px";
    wrap.innerHTML=`<div style="background:#fff;border-radius:22px;padding:16px;width:min(560px,100%);box-shadow:0 24px 80px rgba(0,0,0,.35)"><h2 style="margin-top:0">${esc(title)}</h2><label style="font-weight:900">${esc(label||"Tekst")}</label><textarea id="twAskText" rows="5" style="margin-top:8px;width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:12px;font-size:16px"></textarea><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button id="twAskCancel" type="button" class="btn-dark">Annuleren</button><button id="twAskSave" type="button" class="btn-green">Versturen</button></div></div>`;
    document.body.appendChild(wrap);
    const ta=wrap.querySelector("#twAskText");
    wrap.querySelector("#twAskCancel").onclick=()=>{wrap.remove();resolve("")};
    wrap.querySelector("#twAskSave").onclick=()=>{const v=clean(ta.value);wrap.remove();resolve(v)};
    setTimeout(()=>{try{ta.focus()}catch(e){}},50);
  });
}
function askConfirm(title, text){
  return new Promise(resolve=>{
    const wrap=document.createElement("div");
    wrap.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px";
    wrap.innerHTML=`<div style="background:#fff;border-radius:22px;padding:16px;width:min(480px,100%);box-shadow:0 24px 80px rgba(0,0,0,.35)"><h2 style="margin-top:0">${esc(title)}</h2><p>${esc(text||"")}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button id="twNo" type="button" class="btn-dark">Nee</button><button id="twYes" type="button" class="btn-green">Ja</button></div></div>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#twNo").onclick=()=>{wrap.remove();resolve(false)};
    wrap.querySelector("#twYes").onclick=()=>{wrap.remove();resolve(true)};
  });
}
function canQuote(){return hasAnyRight(["invoice","factuur","offerte","quote","offer","orders"])||lower(BNS.user.role)==="admin"}
function money(v){const n=Number(String(v||0).replace(',','.'));return Number.isFinite(n)&&n?('€ '+n.toFixed(2).replace('.',',')):clean(v||'')}
function quoteHtml(o){
  const mats=materialList(o);
  return `<div style="padding:10px"><h2>${esc(o.number||'Opdracht')} - ${esc(o.title||'')}</h2><p><b>Klant:</b> ${esc(customerName(o)||'')}<br><b>Datum:</b> ${esc(niceDate(orderStart(o)))}${orderEnd(o)&&orderEnd(o)!==orderStart(o)?' t/m '+esc(niceDate(orderEnd(o))):''}<br><b>Adres:</b> ${esc(addressOf(o)||'')}</p><h3>Materialen</h3><ul>${mats.map(m=>`<li>${esc(m.qty?m.qty+'x ':'')}${esc(m.name)}${m.extra?' - '+esc(m.extra):''}</li>`).join('')||'<li>Geen materialen</li>'}</ul>${canPrices()?`<p><b>Totaal:</b> ${esc(money(o.amount||o.total||o.price||''))}<br><b>Borg:</b> ${esc(money(o.deposit||o.borg||''))}</p>`:''}<p>${esc(o.extra||o.notes||'')}</p></div>`;
}
function openQuote(order){
  const wrap=document.createElement("div");
  wrap.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:12px";
  wrap.innerHTML='<div style="background:#fff;border-radius:22px;width:min(760px,100%);max-height:92vh;overflow:auto;box-shadow:0 24px 80px rgba(0,0,0,.35)"><div id="twQuoteBody">'+quoteHtml(order)+'</div><div style="position:sticky;bottom:0;background:#fff;padding:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;border-top:1px solid #e5e7eb"><button id="twQuoteClose" class="btn-dark" type="button">Sluiten</button><button id="twQuoteShare" type="button">Delen</button><button id="twQuotePrint" class="btn-green" type="button">Print</button></div></div>';
  document.body.appendChild(wrap);
  wrap.querySelector('#twQuoteClose').onclick=()=>wrap.remove();
  wrap.querySelector('#twQuoteShare').onclick=async()=>{const text=(wrap.querySelector('#twQuoteBody').innerText||''); if(navigator.share){try{await navigator.share({title:'Offerte '+(order.number||''),text});}catch(e){}} else {location.href='mailto:?subject='+encodeURIComponent('Offerte '+(order.number||''))+'&body='+encodeURIComponent(text);}};
  wrap.querySelector('#twQuotePrint').onclick=()=>{const w=window.open('','_blank'); if(w){w.document.write('<html><head><title>Offerte</title></head><body>'+quoteHtml(order)+'</body></html>');w.document.close();w.print();}};
}

async function sendReport(order,type){
  let extra="";

  if(type==="Schade") extra=await askText("Schade melden", "Omschrijving schade");
  else if(type==="Storing") extra=await askText("Storing melden", "Omschrijving storing");
  else if(type==="Vermissing") extra=await askText("Vermissing melden", "Wat mist er?");
  else extra=await askText("Melding voor planning", "Melding");

  if(!extra) return;

  await addAlert({
    id: "alert_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8),
    source: "telefoon",
    orderId: order.id || "",
    orderNumber: order.number || "",
    linkedOrder: order.id || "",
    linkedOrderNumber: order.number || "",
    orderTitle: order.title || "",
    customerName: customerName(order) || "",
    driverName: BNS.user.name || "",
    title: type,
    type: type,
    text: extra,
    note: extra,
    message: extra,
    resolved: false,
    createdAt: new Date().toISOString(),
    time: new Date().toLocaleString("nl-NL"),
    from: BNS.user.name || "",
    userId: BNS.user.id || ""
  });

  toast(`${type} verstuurd voor opdracht ${order.number || ""}`);
}


function fileToDataUrl(file, maxW=1280, quality=.72){
  return new Promise((resolve,reject)=>{
    const rd=new FileReader();
    rd.onerror=()=>reject(rd.error||new Error("Foto lezen mislukt"));
    rd.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const scale=Math.min(1,maxW/img.width);
        const w=Math.max(1,Math.round(img.width*scale)), h=Math.max(1,Math.round(img.height*scale));
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        resolve(c.toDataURL("image/jpeg",quality));
      };
      img.onerror=()=>resolve(String(rd.result||""));
      img.src=String(rd.result||"");
    };
    rd.readAsDataURL(file);
  });
}
function pickPhoto(){
  return new Promise(resolve=>{
    const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*"; inp.setAttribute("capture","environment");
    inp.onchange=()=>resolve(inp.files&&inp.files[0]); inp.click();
  });
}
async function sendPhoto(order,type){
  const file=await pickPhoto(); if(!file)return;
  const data=await fileToDataUrl(file);
  const item={
    id:"media_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),
    type:type,
    data:data,
    photoData:data,
    note:"Foto toegevoegd",
    createdAt:new Date().toISOString(),
    time:new Date().toLocaleString("nl-NL"),
    driverName:BNS.user.name||"",
    from:BNS.user.name||"",
    userId:BNS.user.id||""
  };
  // Sla foto MET base64 op in Firebase alerts
  item.orderId = order.id||order.number||'';
  item.orderNumber = order.number||'';
  try{
    if(BNS.db){
      const {doc,setDoc}=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
      await setDoc(doc(BNS.db,"alerts",item.id),item);
    }
  }catch(e){ console.error("Photo alert sync fout:",e); }
  // Order krijgt referentie ZONDER base64
  const photoRef={id:item.id,type:item.type,note:item.note,createdAt:item.createdAt,hasMedia:true,orderId:item.orderId};
  order.media=Array.isArray(order.media)?order.media:[];
  order.photos=Array.isArray(order.photos)?order.photos:[];
  order.driverUploads=Array.isArray(order.driverUploads)?order.driverUploads:[];
  order.media.push(photoRef);
  order.photos.push(photoRef);
  order.driverUploads.push(photoRef);
  order.updatedAt=new Date().toISOString();
  await updateOrder(order);
  toast(type+" opgeslagen bij opdracht");
}
function openSignatureModal(order){
  const wrap=document.createElement("div");
  wrap.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px";
  wrap.innerHTML='<div style="background:#fff;border-radius:22px;padding:16px;width:min(720px,100%);box-shadow:0 24px 80px rgba(0,0,0,.35)"><h2 style="margin-top:0">Handtekening klant</h2><canvas id="sigCanvas" width="640" height="280" style="width:100%;height:280px;border:2px solid #cbd5e1;border-radius:14px;background:#fff;touch-action:none"></canvas><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px"><button id="sigClear" type="button" class="btn-dark">Wissen</button><button id="sigCancel" type="button" class="btn-red">Annuleren</button><button id="sigSave" type="button" class="btn-green">Opslaan</button></div></div>';
  document.body.appendChild(wrap);
  const c=wrap.querySelector("#sigCanvas"), ctx=c.getContext("2d"); ctx.lineWidth=4; ctx.lineCap="round"; ctx.strokeStyle="#111827";
  let down=false,last=null;
  function pos(e){const r=c.getBoundingClientRect();const t=e.touches&&e.touches[0]||e;return{x:(t.clientX-r.left)*c.width/r.width,y:(t.clientY-r.top)*c.height/r.height}}
  function start(e){e.preventDefault();down=true;last=pos(e)} function move(e){if(!down)return;e.preventDefault();const p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p} function end(){down=false;last=null}
  ["mousedown","touchstart"].forEach(ev=>c.addEventListener(ev,start,{passive:false})); ["mousemove","touchmove"].forEach(ev=>c.addEventListener(ev,move,{passive:false})); ["mouseup","mouseleave","touchend","touchcancel"].forEach(ev=>c.addEventListener(ev,end));
  wrap.querySelector("#sigClear").onclick=()=>ctx.clearRect(0,0,c.width,c.height); wrap.querySelector("#sigCancel").onclick=()=>wrap.remove();
  wrap.querySelector("#sigSave").onclick=async()=>{
    const data=c.toDataURL("image/png");
    const item={
      id:"sig_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),
      type:"Handtekening klant",data:data,signatureData:data,
      note:"Handtekening toegevoegd",
      orderId:order.id||order.number||"",
      orderNumber:order.number||"",
      createdAt:new Date().toISOString(),
      time:new Date().toLocaleString("nl-NL"),
      driverName:BNS.user.name||"",from:BNS.user.name||"",userId:BNS.user.id||""
    };
    // Sla alert MET base64 op in Firebase alerts (apart van order)
    try{
      if(BNS.db){
        const {doc,setDoc}=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
        await setDoc(doc(BNS.db,"alerts",item.id),item);
      }
    }catch(e){ console.error("Alert sync fout:",e); }
    // Order krijgt alleen een referentie ZONDER base64
    order.media=Array.isArray(order.media)?order.media:[];
    order.signatures=Array.isArray(order.signatures)?order.signatures:[];
    const ref={id:item.id,type:item.type,note:item.note,createdAt:item.createdAt,hasMedia:true,orderId:item.orderId};
    order.media.push(ref);
    order.signatures.push(ref);
    order.customerSignature="signed";
    order.customerSignedAt=item.createdAt;
    order.customerSignedBy=BNS.user.name||"";
    order.updatedAt=new Date().toISOString();
    await updateOrder(order);
    wrap.remove();
    toast("Handtekening opgeslagen bij opdracht");
  };
}
function enhanceDriverButtons(){
  function addMediaButtons(grid,id){
    if(!id||!grid||grid.dataset.media143)return;
    grid.dataset.media143="1";
    if(canPhotoBefore()) grid.insertAdjacentHTML("beforeend",`<button type="button" class="btn btn-dark" data-photo-before="${esc(id)}">Foto voor</button>`);
    if(canPhotoAfter()) grid.insertAdjacentHTML("beforeend",`<button type="button" class="btn btn-dark" data-photo-after="${esc(id)}">Foto na</button>`);
    if(canSignature()) grid.insertAdjacentHTML("beforeend",`<button type="button" class="btn btn-purple wide" data-signature="${esc(id)}">Handtekening klant</button>`);
  }

  qsa(".order-card").forEach(card=>{
    addMediaButtons(card.querySelector(".action-grid"), card.getAttribute("data-id"));
  });

  // BNS v459: detailpagina heeft geen .order-card, dus daar ook toevoegen.
  try{
    if(CURRENT_DETAIL_ID){
      qsa("#detailView .report-grid,#detailView .action-grid").forEach(grid=>{
        addMediaButtons(grid, CURRENT_DETAIL_ID);
      });
    }
  }catch(e){}

  qsa("[data-photo-before]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.photoBefore); if(o)sendPhoto(o,"Foto voor levering")}});
  qsa("[data-photo-after]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.photoAfter); if(o)sendPhoto(o,"Foto na levering")}});
  qsa("[data-signature]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.signature); if(o)openSignatureModal(o)}});
}

function bindActions(){
  setTimeout(enhanceDriverButtons,0);
  qsa("[data-detail]").forEach(b=>{b.onclick=()=>showDetail(b.dataset.detail)});
  qsa("[data-back]").forEach(b=>{b.onclick=()=>showOrders()});
  qsa("[data-done]").forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.done);if(!o)return;if(!await askConfirm("Opdracht afmelden", "Opdracht afmelden als uitgevoerd?"))return;o.status="Uitgevoerd";o.doneAt=new Date().toISOString();o.doneBy=BNS.user.name||"";await updateOrder(o);toast("Opdracht afgemeld");await loadPhoneData();showOrders();render()}});
  qsa("[data-quote]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.quote); if(o)openQuote(o)}});
  qsa("[data-report]").forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.report);if(!o)return;await sendReport(o,b.dataset.type||"Melding")}});
  qsa("[data-agenda]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.agenda);if(!o)return;toast(`Agenda:\n${niceDate(orderStart(o))} ${o.startTime||""} - ${o.endTime||""}`)}});
}

let __twAutoRefreshStarted=false;
function showApp(){
  if(!__twAutoRefreshStarted){__twAutoRefreshStarted=true;setInterval(async()=>{try{if(BNS.user){await loadPhoneData(); if(!$("detailView").classList.contains("hidden") && CURRENT_DETAIL_ID)showDetail(CURRENT_DETAIL_ID); else render();}}catch(e){}},10000);}
  $("loginBox").classList.add("hidden");
  $("appBox").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("who").textContent=BNS.user?`${BNS.user.name} - ${BNS.user.role||"Medewerker"}`:"";
  render();
}

async function boot(){
  try{
    await initFirebase();
    await loadInitial();
    populateUsers(userAllowed);
    $("loginBtn").onclick=()=>loginWithFilter(userAllowed,SESSION_KEY,showApp);
    $("loginPin").addEventListener("keydown",e=>{if(e.key==="Enter")loginWithFilter(userAllowed,SESSION_KEY,showApp)});
    $("logoutBtn").onclick=()=>{sessionStorage.removeItem(SESSION_KEY);location.reload()};
   $("refreshBtn").onclick=async()=>{
  await loadPhoneData();

  if(!$("detailView").classList.contains("hidden") && CURRENT_DETAIL_ID){
    showDetail(CURRENT_DETAIL_ID);
  }else{
    render();
  }

  toast("Verversd");
};
    $("clearSearchBtn").onclick=()=>{$("searchBox").value="";qsa(".order").forEach(el=>el.style.display="")};
    $("searchBox").oninput=()=>{const q=lower($("searchBox").value);qsa(".order").forEach(el=>{el.style.display=!q||lower(el.innerText).includes(q)?"":"none"})};
    restoreSession(userAllowed,SESSION_KEY,showApp);
  }catch(e){console.error(e);setStatus("Fout: "+e.message)}
}
boot();

/* ===== V187 telefoon: verwijderde/verborgen opdrachten nooit tonen ===== */
(function(){
  function lower2(v){ return String(v==null?'':v).trim().toLowerCase(); }
  function deletedFlag(o){
    if(!o) return false;
    var st=lower2(o.status);
    return o.deleted===true || o.removed===true || o.hidden===true || o.active===false || o.isDeleted===true || ['verwijderd','gewist','deleted','trash','removed'].indexOf(st)>=0;
  }
  try{
    var oldIsDeleted = isDeleted;
    isDeleted = function(o){ return deletedFlag(o) || (typeof oldIsDeleted==='function' && oldIsDeleted(o)); };
    window.isDeleted = isDeleted;
  }catch(e){}
  try{
    var oldVisible = visibleOrder;
    visibleOrder = function(o){ if(deletedFlag(o)) return false; return oldVisible(o); };
    window.visibleOrder = visibleOrder;
  }catch(e){}
  try{
    var oldFind = findOrder;
    findOrder = function(id){ var o=oldFind(id); if(deletedFlag(o)) return null; return o; };
    window.findOrder = findOrder;
  }catch(e){}
})();



/* BNS v461 telefoon media refresh */
(function(){
  if(window.__BNS_V461_DRIVER_MEDIA_REFRESH__) return;
  window.__BNS_V461_DRIVER_MEDIA_REFRESH__ = true;

  var oldRenderDriver = typeof renderDriver === "function" ? renderDriver : null;
  if(oldRenderDriver && !oldRenderDriver.__bns461){
    window.renderDriver = renderDriver = function(){
      var r = oldRenderDriver.apply(this, arguments);
      setTimeout(function(){ try{ if(typeof enhanceDriverButtons==="function") enhanceDriverButtons(); }catch(e){} }, 80);
      setTimeout(function(){ try{ if(typeof enhanceDriverButtons==="function") enhanceDriverButtons(); }catch(e){} }, 900);
      return r;
    };
    renderDriver.__bns461 = true;
  }
})();



/* BNS v474 driver: alleen lopend + gekoppeld, media direct verversen */
(function(){
  if(window.__BNS_V474_DRIVER_STRICT__) return;
  window.__BNS_V474_DRIVER_STRICT__=true;
  function T(v){return String(v==null?'':v).trim();}
  function hasAssigned(o){
    try{
      var vals=[];
      ['driverIds','bezorgerIds','userIds','assignedDriverIds','driverNames','bezorgerNames','assignedDriverNames'].forEach(function(k){if(Array.isArray(o[k])) vals=vals.concat(o[k]);});
      ['driver','driverName','bezorger','bezorgerName','driverId','bezorgerId','userId','assignedDriverId'].forEach(function(k){if(o[k]) vals=vals.concat(String(o[k]).split(/[,;|\n]+/));});
      return vals.map(T).filter(Boolean).length>0;
    }catch(e){return false;}
  }
  if(typeof visibleOrder==='function' && !visibleOrder.__bns474){
    var old=visibleOrder;
    visibleOrder=function(o){ if(!hasAssigned(o)) return false; return old(o); };
    visibleOrder.__bns474=true;
  }
  function refresh(){try{if(typeof loadPhoneData==='function' && BNS&&BNS.user) loadPhoneData().then(function(){try{render();}catch(e){}});}catch(e){}}
  var oldUpdate = typeof updateOrder==='function'?updateOrder:null;
  if(oldUpdate && !oldUpdate.__bns474){
    updateOrder=async function(o){ var r=await oldUpdate.apply(this,arguments); setTimeout(refresh,500); return r; };
    updateOrder.__bns474=true;
  }
  console.log('[BNS v474] driver strikt gekoppeld + media refresh actief.');
})();



/* BNS v493 driver: signaal na foto/handtekening/melding */
(function(){
  if(window.__BNS_V493_DRIVER_SIGNAL__) return;
  window.__BNS_V493_DRIVER_SIGNAL__=true;
  function fire(){
    try{ document.dispatchEvent(new CustomEvent("bns:phone-media-updated")); }catch(e){}
    try{ window.dispatchEvent(new Event("storage")); }catch(e){}
  }
  if(typeof updateOrder==="function" && !updateOrder.__bns493){
    const oldUpdateOrder=updateOrder;
    updateOrder=async function(o){
      const res=await oldUpdateOrder.apply(this,arguments);
      setTimeout(fire,250);
      return res;
    };
    updateOrder.__bns493=true;
  }
  ["save","saveState","saveLocal","uploadPhoto","saveSignature","submitAlert","sendAlert"].forEach(function(name){
    try{
      var fn=window[name];
      if(typeof fn==="function" && !fn.__bns493){
        var wrapped=function(){
          var r=fn.apply(this,arguments);
          setTimeout(fire,250);
          return r;
        };
        wrapped.__bns493=true;
        window[name]=wrapped;
      }
    }catch(e){}
  });
  console.log("[BNS v493 driver] update-signaal actief.");
})();
