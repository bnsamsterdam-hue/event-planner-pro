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
  BNS.app=appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
  BNS.db=fsMod.getFirestore(BNS.app);
  setStatus("Firebase verbonden");
}
async function loadCollection(n){
  const s=await BNS.firebase.getDocs(BNS.firebase.collection(BNS.db,n));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}
async function loadInitial(){
  setStatus("Data laden...");
  BNS.state.users=await loadCollection("users");
  BNS.state.orders=await loadCollection("orders");
  setStatus("Data geladen");
}
async function loadOrdersOnly(){
  BNS.state.orders=await loadCollection("orders");
}
async function updateOrder(o){
  if(!o||!o.id)return;
  o.updatedAt=new Date().toISOString();
  await BNS.firebase.setDoc(BNS.firebase.doc(BNS.db,"orders",String(o.id)),o,{merge:true});
}
async function addAlert(a){
  const id=a.id||("a_"+Math.random().toString(36).slice(2,10));
  a.id=id;
  await BNS.firebase.setDoc(BNS.firebase.doc(BNS.db,"alerts",id),a,{merge:true});
}
function populateUsers(f){
  const users=(BNS.state.users||[]).filter(f);
  $("loginName").innerHTML=users.length?users.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.role||"Medewerker")})</option>`).join(""):`<option value="">Geen gebruikers gevonden</option>`;
}
function loginWithFilter(f,key,after){
  const id=$("loginName").value,pin=clean($("loginPin").value);
  const found=(BNS.state.users||[]).find(u=>String(u.id)===String(id)&&String(u.pin||"")===pin);
  if(!found){toast("Naam of PIN klopt niet");return}
  if(!f(found)){toast("Geen rechten voor deze portal");return}
  BNS.user=found;
  sessionStorage.setItem(key,found.id);
  $("loginPin").value="";
  after();
}
function restoreSession(f,key,after){
  const id=sessionStorage.getItem(key);
  if(!id)return;
  const found=(BNS.state.users||[]).find(u=>String(u.id)===String(id));
  if(found&&f(found)){BNS.user=found;after()}
}

const SESSION_KEY="bns_driver_firebase_user_id";
let CURRENT_DETAIL_ID="";

function userAllowed(u){
  const r=lower(u.role);
  return r==="bezorger"||r==="planner"||r==="admin"||!!(u.rights&&(u.rights.gps||u.rights.agenda||u.rights.resolve||u.rights.orders||u.rights.damage||u.rights.schade||u.rights.storing||u.rights.materials||u.rights.prices));
}
function assignedToUser(o){
  const uid=String(BNS.user.id||""),un=lower(BNS.user.name||""),did=String(o.driverId||o.bezorgerId||o.userId||""),dn=lower(o.driverName||o.driver||o.bezorger||"");
  if(did&&uid&&did===uid)return true;
  if(dn&&un&&dn===un)return true;
  if((lower(BNS.user.role)==="planner"||lower(BNS.user.role)==="admin")&&hasRight("orders"))return true;
  return false;
}
function visibleOrder(o){
  if(isCancelled(o)||isDone(o)||isDeleted(o))return false;
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
      ${canDamage()?`<button type="button" class="btn btn-dark" data-report="${esc(o.id)}" data-type="Offerte">Offerte</button>`:""}
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
      ${canDamage()?`<button type="button" class="btn btn-orange" data-report="${esc(o.id)}" data-type="Offerte">Offerte</button>`:""}
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

async function sendReport(order,type){
  let extra="";

  if(type==="Schade") extra=prompt("Omschrijving schade:", "");
  else if(type==="Storing") extra=prompt("Omschrijving storing:", "");
  else if(type==="Vermissing") extra=prompt("Wat mist er?", "");
  else if(type==="Offerte") extra=prompt("Waarvoor moet offerte gemaakt worden?", "");
  else extra=prompt("Melding voor planning:", "");

  if(!extra) return;

  await addAlert({
    orderId: order.id || "",
    orderNumber: order.number || "",
    title: type,
    text: extra,

    // 🔴 BELANGRIJK: dit zorgt dat je kunt filteren
    linkedOrder: order.id || "",
    linkedOrderNumber: order.number || "",

    resolved: false,
    createdAt: new Date().toISOString(),

    // alleen meldingen van deze bezorger
    from: BNS.user.name || "",
    userId: BNS.user.id || ""
  });

  toast(`${type} verstuurd voor opdracht ${order.number || ""}`);
}

function bindActions(){
  qsa("[data-detail]").forEach(b=>{b.onclick=()=>showDetail(b.dataset.detail)});
  qsa("[data-back]").forEach(b=>{b.onclick=()=>showOrders()});
  qsa("[data-done]").forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.done);if(!o)return;if(!confirm("Opdracht afmelden als uitgevoerd?"))return;o.status="Uitgevoerd";o.doneAt=new Date().toISOString();o.doneBy=BNS.user.name||"";await updateOrder(o);toast("Opdracht afgemeld");await loadOrdersOnly();showOrders();render()}});
  qsa("[data-report]").forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.report);if(!o)return;await sendReport(o,b.dataset.type||"Melding")}});
  qsa("[data-agenda]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.agenda);if(!o)return;toast(`Agenda:\n${niceDate(orderStart(o))} ${o.startTime||""} - ${o.endTime||""}`)}});
}

function showApp(){
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
  await loadOrdersOnly();

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

/* =========================================================
   Tapwagen.nl V128 DRIVER-ONLY PATCH
   Basis: oude zelfstandige driver.js + echte driver/index.html.
   Doel:
   - GEEN redirect naar hoofd-app ?driver= meer.
   - Planner/app.js blijft ongemoeid.
   - Telefoon leest orders/users live read-only en schrijft alleen bij acties.
   - Telefoon mag orders alleen wijzigen bij Afmelden / uitgevoerd.
   - Meldingen/foto/handtekening gaan alleen naar Firebase alerts.
   ========================================================= */

function rightsObj(){ return (BNS.user && BNS.user.rights) || {}; }
function rightVal(keys){
  const r = rightsObj();
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(r,k)) return r[k] === true;
  }
  return false;
}
function roleName(){ return lower(BNS.user && BNS.user.role || ''); }
function isAdminUser(){ return roleName()==='admin'; }
function canRoute(){ return isAdminUser() || rightVal(['gps','route','waze']); }
function canAgenda(){ return isAdminUser() || rightVal(['agenda']); }
function canDone(){ return isAdminUser() || rightVal(['phoneDone','resolve','afmelden','done','uitgevoerd']); }
function canMaterials(){ return isAdminUser() || rightVal(['materials','materialen','orders']); }
function canPrices(){ return isAdminUser() || rightVal(['prices','prijzen']); }
function canCall(){ return isAdminUser() || rightVal(['phoneCall','call','bellen','klantBellen']); }
function canReport(){ return isAdminUser() || rightVal(['phoneMessage','meldingen','reports','report','resolve']); }
function canStoring(){ return isAdminUser() || rightVal(['reportStoring','storing','storingMelden']); }
function canDamage(){ return isAdminUser() || rightVal(['reportDamage','damage','schade','schadeMelden']); }
function canMissing(){ return isAdminUser() || rightVal(['reportMissing','missing','vermissing','vermissingMelden']); }
function canPhotoBefore(){ return isAdminUser() || rightVal(['photoBefore','fotoVoor','fotoVoorLevering']); }
function canPhotoAfter(){ return isAdminUser() || rightVal(['photoAfter','fotoNa','fotoNaLevering']); }
function canSignature(){ return isAdminUser() || rightVal(['signatureCustomer','signature','handtekening','handtekeningKlant']); }

function arr(v){ return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]); }
function normList(v){ return arr(v).map(x=>lower(x)).filter(Boolean); }
function idList(v){ return arr(v).map(x=>String(x||'').trim()).filter(Boolean); }
function assignedToUser(o){
  const uid = String(BNS.user && BNS.user.id || '').trim();
  const un = lower(BNS.user && BNS.user.name || '');
  const role = roleName();
  if ((role === 'planner' || role === 'admin') && rightVal(['orders'])) return true;

  const ids = []
    .concat(idList(o.driverIds))
    .concat(idList(o.bezorgerIds))
    .concat(idList(o.driverId))
    .concat(idList(o.bezorgerId))
    .concat(idList(o.userId));
  if (uid && ids.includes(uid)) return true;

  const names = []
    .concat(normList(o.driverNames))
    .concat(normList(o.bezorgerNames))
    .concat(normList(o.driverName))
    .concat(normList(o.driver))
    .concat(normList(o.bezorger));
  if (un && names.includes(un)) return true;

  return false;
}

async function loadOrdersOnly(){
  const [users,orders] = await Promise.all([loadCollection('users'), loadCollection('orders')]);
  BNS.state.users = users;
  BNS.state.orders = orders;
  if (BNS.user) {
    const fresh = users.find(u => String(u.id) === String(BNS.user.id));
    if (fresh) BNS.user = fresh;
  }
}

let __tapLiveStarted = false;
let __tapRenderTimer = null;
function scheduleRender(){
  if (!BNS.user) return;
  clearTimeout(__tapRenderTimer);
  __tapRenderTimer = setTimeout(function(){
    if (CURRENT_DETAIL_ID && !$('detailView').classList.contains('hidden')) showDetail(CURRENT_DETAIL_ID);
    else render();
  }, 300);
}
function mergeRows(target, rows){
  let changed = false;
  rows.forEach(row => {
    const idx = target.findIndex(x => String(x.id) === String(row.id));
    const old = idx >= 0 ? JSON.stringify(target[idx]) : '';
    if (idx >= 0) target[idx] = Object.assign({}, target[idx], row);
    else target.push(row);
    if (idx < 0 || JSON.stringify(target[idx]) !== old) changed = true;
  });
  return changed;
}
function startReadOnlyListeners(){
  if (__tapLiveStarted || !BNS.firebase || !BNS.db || !BNS.firebase.onSnapshot) return;
  __tapLiveStarted = true;
  try {
    BNS.firebase.onSnapshot(BNS.firebase.collection(BNS.db,'users'), function(snap){
      const rows = snap.docs.map(d=>({id:d.id,...d.data()}));
      if (mergeRows(BNS.state.users, rows)) {
        if (BNS.user) {
          const fresh = BNS.state.users.find(u=>String(u.id)===String(BNS.user.id));
          if (fresh) BNS.user = fresh;
        }
        scheduleRender();
      }
    });
    BNS.firebase.onSnapshot(BNS.firebase.collection(BNS.db,'orders'), function(snap){
      const rows = snap.docs.map(d=>({id:d.id,...d.data()}));
      if (mergeRows(BNS.state.orders, rows)) scheduleRender();
    });
  } catch(e) {
    console.warn('Live lezen niet gestart', e);
  }
}

function orderBadges(o){
  const badges=[`<span class="badge">${esc(o.status||"Open")}</span>`];
  if(canAgenda())badges.push(`<span class="badge">Agenda</span>`);
  if(canRoute())badges.push(`<span class="badge ok">Route</span>`);
  if(otherCustomerOrders(o).length)badges.push(`<span class="badge warn">Meer artikelen</span>`);
  if(canPrices())badges.push(`<span class="badge dark">Prijzen</span>`);
  return badges.join('');
}
function orderActionButtons(o, detail){
  const a = addressOf(o), p = customerPhone(o), id = esc(o.id);
  return `${canRoute()?`<a class="btn btn-green" href="${esc(routeUrl('waze',a))}" target="_blank" rel="noopener">Waze</a>`:''}
    ${canRoute()?`<a class="btn btn-dark" href="${esc(routeUrl('maps',a))}" target="_blank" rel="noopener">${detail?'Google Maps':'Maps'}</a>`:''}
    ${p && canCall()?`<a class="btn" href="tel:${esc(p)}">Bel klant</a>`:''}
    ${detail && canAgenda()?`<button type="button" class="btn btn-dark" data-agenda="${id}">Agenda info</button>`:''}
    ${canReport()?`<button type="button" class="btn btn-orange" data-report="${id}" data-type="Melding">Melding</button>`:''}
    ${canDamage()?`<button type="button" class="btn btn-red" data-report="${id}" data-type="Schade">Schade</button>`:''}
    ${canStoring()?`<button type="button" class="btn btn-purple" data-report="${id}" data-type="Storing">Storing</button>`:''}
    ${canMissing()?`<button type="button" class="btn btn-dark" data-report="${id}" data-type="Vermissing">Vermissing</button>`:''}
    ${canPhotoBefore()?`<button type="button" class="btn btn-green" data-photo="${id}" data-type="Foto voor levering">Foto voor</button>`:''}
    ${canPhotoAfter()?`<button type="button" class="btn btn-green" data-photo="${id}" data-type="Foto na levering">Foto na</button>`:''}
    ${canSignature()?`<button type="button" class="btn btn-purple" data-sign="${id}">Handtekening</button>`:''}
    ${canDone()?`<button type="button" class="btn btn-full btn-green wide" data-done="${id}">Afmelden / uitgevoerd</button>`:''}`;
}
function orderCard(o){
  const a=addressOf(o),s=orderStart(o),e=orderEnd(o),dl=s&&e&&s!==e?`${niceDate(s)} t/m ${niceDate(e)}`:niceDate(s||e);
  const mats=materialList(o);
  return `<article class="order-card order" data-id="${esc(o.id)}">
    <span class="order-number">${esc(o.number||'Opdracht')}</span>
    <div class="order-title">${esc(o.title||'Zonder titel')}</div>
    <div class="badges">${orderBadges(o)}</div>
    <div class="meta">
      <div class="meta-row"><span>📅</span><div><strong>${esc(dl||'Geen datum')}</strong></div></div>
      <div class="meta-row"><span>👤</span><div>${esc(customerName(o)||'Klant onbekend')}</div></div>
      <div class="meta-row"><span>📍</span><div>${esc(a||'Adres onbekend')}</div></div>
      <div class="meta-row"><span>📦</span><div>${esc(mats.length?`${mats.length} artikelsoorten - ${materialText(o)}`:'Geen materialen')}</div></div>
    </div>
    <div class="action-grid">
      <button type="button" class="more-btn wide" data-detail="${esc(o.id)}">Open opdracht</button>
      ${orderActionButtons(o,false)}
    </div>
  </article>`;
}
function detailHtml(o){
  const a=addressOf(o),mats=materialList(o),more=otherCustomerOrders(o);
  const s=orderStart(o),e=orderEnd(o),dl=s&&e&&s!==e?`${niceDate(s)} t/m ${niceDate(e)}`:niceDate(s||e);
  return `<div class="detail-header"><button type="button" class="back-btn" data-back>Terug</button></div>
  <article class="card detail-card">
    <h2>${esc(o.number||'')} - ${esc(o.title||'Zonder titel')}</h2>
    <div class="badges">${orderBadges(o)}</div>
    <div class="section-title">Opdracht</div>
    <div class="info-box">📅 ${esc(dl||'Geen datum')}<br>👤 ${esc(customerName(o)||'Klant onbekend')}<br>📍 ${esc(a||'Adres onbekend')}<br>🚚 ${esc(driverName(o)||BNS.user?.name||'')}</div>
    <div class="section-title">Materialen</div>
    <div class="info-box">${mats.length?mats.map(x=>`• ${esc(x.qty?x.qty+'x ':'')}${esc(x.name)}${x.extra?' - '+esc(x.extra):''}`).join('<br>'):'Geen materialen'}</div>
    ${more.length?`<div class="section-title">Meer artikelen / opdrachten voor deze klant</div><div class="info-box">${more.map(x=>`• ${esc(x.number||'')} ${esc(x.title||'')} - ${esc(niceDate(orderStart(x)))}`).join('<br>')}</div>`:''}
    <div class="section-title">Acties</div>
    <div class="report-grid">${orderActionButtons(o,true)}</div>
  </article>`;
}

async function addAlert(a){
  const id = a.id || ('a_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8));
  const row = Object.assign({}, a, {
    id,
    resolved:false,
    source:'telefoon',
    sourceApp:'driver',
    createdAt:a.createdAt || new Date().toISOString(),
    time:a.time || new Date().toLocaleString('nl-NL'),
    updatedAt:new Date().toISOString()
  });
  await BNS.firebase.setDoc(BNS.firebase.doc(BNS.db,'alerts',id),row,{merge:true});
  return row;
}
async function sendReport(order,type){
  let extra = '';
  if(type==='Schade') extra=prompt('Omschrijving schade:', '');
  else if(type==='Storing') extra=prompt('Omschrijving storing:', '');
  else if(type==='Vermissing') extra=prompt('Wat mist er?', '');
  else extra=prompt('Melding voor planning:', '');
  if(!extra) return;
  await addAlert({
    orderId: order.id || '', orderNumber: order.number || '', orderTitle: order.title || '',
    customerName: customerName(order), title:type, type:type, text:extra, note:extra, message:extra,
    linkedOrder: order.id || '', linkedOrderNumber: order.number || '',
    from: BNS.user.name || '', userId: BNS.user.id || '', driverId:BNS.user.id||'', driverName:BNS.user.name||''
  });
  toast(`${type} verstuurd naar planning`);
}
function resizeImage(file, max=1200, quality=.72){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onerror=reject;
    fr.onload=()=>{
      const img=new Image();
      img.onerror=reject;
      img.onload=()=>{
        let w=img.width,h=img.height;
        if(Math.max(w,h)>max){ const r=max/Math.max(w,h); w=Math.round(w*r); h=Math.round(h*r); }
        const c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src=fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function sendPhoto(order,type){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.capture='environment';
  inp.onchange=async()=>{
    const file=inp.files&&inp.files[0]; if(!file) return;
    try{
      toast('Foto verwerken...');
      const photoData=await resizeImage(file);
      await addAlert({
        orderId:order.id||'', orderNumber:order.number||'', orderTitle:order.title||'', customerName:customerName(order),
        title:type, type:type, text:'Foto toegevoegd', note:'Foto toegevoegd', photoData,
        from:BNS.user.name||'', userId:BNS.user.id||'', driverId:BNS.user.id||'', driverName:BNS.user.name||''
      });
      toast('Foto verstuurd naar planning');
    }catch(e){ console.error(e); toast('Foto versturen mislukt'); }
  };
  inp.click();
}
function openSignatureModal(order){
  const old=document.getElementById('tapSignModal'); if(old) old.remove();
  const modal=document.createElement('div'); modal.id='tapSignModal';
  modal.style.cssText='position:fixed;z-index:999999;inset:0;background:rgba(15,23,42,.65);display:flex;align-items:center;justify-content:center;padding:14px';
  modal.innerHTML='<div style="background:#fff;border-radius:22px;padding:14px;width:min(96vw,560px);box-shadow:0 24px 70px rgba(0,0,0,.35)"><h2 style="margin:4px 0 10px">Handtekening klant</h2><canvas id="tapSignCanvas" width="520" height="240" style="width:100%;height:240px;border:2px solid #111;border-radius:14px;background:#fff;touch-action:none"></canvas><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button id="tapSignClear" type="button" style="background:#334155;color:white;border:0;border-radius:12px;padding:12px;font-weight:900">Leeg</button><button id="tapSignCancel" type="button" style="background:#64748b;color:white;border:0;border-radius:12px;padding:12px;font-weight:900">Annuleren</button><button id="tapSignSave" type="button" style="background:#16a34a;color:white;border:0;border-radius:12px;padding:12px;font-weight:900">Opslaan</button></div></div>';
  document.body.appendChild(modal);
  const canvas=document.getElementById('tapSignCanvas'); const ctx=canvas.getContext('2d');
  ctx.lineWidth=4; ctx.lineCap='round'; ctx.strokeStyle='#111'; let drawing=false, did=false;
  function pos(ev){ const r=canvas.getBoundingClientRect(); const t=ev.touches&&ev.touches[0]||ev; return {x:(t.clientX-r.left)*(canvas.width/r.width), y:(t.clientY-r.top)*(canvas.height/r.height)}; }
  function start(ev){ ev.preventDefault(); drawing=true; did=true; const p=pos(ev); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(ev){ if(!drawing)return; ev.preventDefault(); const p=pos(ev); ctx.lineTo(p.x,p.y); ctx.stroke(); }
  function end(){ drawing=false; }
  ['mousedown','touchstart'].forEach(e=>canvas.addEventListener(e,start,{passive:false}));
  ['mousemove','touchmove'].forEach(e=>canvas.addEventListener(e,move,{passive:false}));
  ['mouseup','mouseleave','touchend','touchcancel'].forEach(e=>canvas.addEventListener(e,end));
  document.getElementById('tapSignClear').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);did=false;};
  document.getElementById('tapSignCancel').onclick=()=>modal.remove();
  document.getElementById('tapSignSave').onclick=async()=>{
    if(!did){ toast('Zet eerst een handtekening'); return; }
    const signatureData=canvas.toDataURL('image/png');
    await addAlert({
      orderId:order.id||'', orderNumber:order.number||'', orderTitle:order.title||'', customerName:customerName(order),
      title:'Handtekening klant', type:'Handtekening klant', text:'Handtekening toegevoegd', note:'Handtekening toegevoegd', signatureData,
      from:BNS.user.name||'', userId:BNS.user.id||'', driverId:BNS.user.id||'', driverName:BNS.user.name||''
    });
    modal.remove(); toast('Handtekening verstuurd naar planning');
  };
}
function bindActions(){
  qsa('[data-detail]').forEach(b=>{b.onclick=()=>showDetail(b.dataset.detail)});
  qsa('[data-back]').forEach(b=>{b.onclick=()=>showOrders()});
  qsa('[data-done]').forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.done);if(!o)return;if(!confirm('Opdracht afmelden als uitgevoerd?'))return;o.status='Uitgevoerd';o.doneAt=new Date().toISOString();o.doneBy=BNS.user.name||'';await updateOrder(o);toast('Opdracht afgemeld');await loadOrdersOnly();showOrders();render();}});
  qsa('[data-report]').forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.report);if(!o)return;await sendReport(o,b.dataset.type||'Melding')}});
  qsa('[data-photo]').forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.photo);if(!o)return;await sendPhoto(o,b.dataset.type||'Foto')}});
  qsa('[data-sign]').forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.sign);if(!o)return;openSignatureModal(o);}});
  qsa('[data-agenda]').forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.agenda);if(!o)return;toast(`Agenda:\n${niceDate(orderStart(o))} ${o.startTime||''} - ${o.endTime||''}`)}});
}
function showApp(){
  $('loginBox').classList.add('hidden');
  $('appBox').classList.remove('hidden');
  $('logoutBtn').classList.remove('hidden');
  $('who').textContent=BNS.user?`${BNS.user.name} - Bezorger Tapwagen.nl`:'';
  startReadOnlyListeners();
  render();
}
async function boot(){
  try{
    await initFirebase();
    await loadInitial();
    populateUsers(userAllowed);
    $('loginBtn').onclick=()=>loginWithFilter(userAllowed,SESSION_KEY,showApp);
    $('loginPin').addEventListener('keydown',e=>{if(e.key==='Enter')loginWithFilter(userAllowed,SESSION_KEY,showApp)});
    $('logoutBtn').onclick=()=>{sessionStorage.removeItem(SESSION_KEY);location.reload()};
    $('refreshBtn').onclick=async()=>{
      await loadOrdersOnly();
      if(!$('detailView').classList.contains('hidden') && CURRENT_DETAIL_ID) showDetail(CURRENT_DETAIL_ID); else render();
      toast('Verversd');
    };
    $('clearSearchBtn').onclick=()=>{$('searchBox').value='';qsa('.order').forEach(el=>el.style.display='')};
    $('searchBox').oninput=()=>{const q=lower($('searchBox').value);qsa('.order').forEach(el=>{el.style.display=!q||lower(el.innerText).includes(q)?'':'none'})};
    restoreSession(userAllowed,SESSION_KEY,showApp);
  }catch(e){console.error(e);setStatus('Fout: '+e.message)}
}

/* =========================================================
   V129 driver-only: planner -> telefoon live/retry sync
   - Geen planner/app.js wijziging.
   - Telefoon schrijft niet naar orders behalve Afmelden/uitgevoerd.
   - Orders/users worden read-only live vervangen, niet gemerged.
   - Fallback polling vangt vastlopende Firebase listener/cache op.
   ========================================================= */
let __tapV129LiveStarted = false;
let __tapV129PollTimer = null;
let __tapV129LastUsersKey = '';
let __tapV129LastOrdersKey = '';
let __tapV129SnapshotReady = false;

function __tapV129Key(rows){
  try {
    return JSON.stringify((rows||[]).map(function(x){
      return {
        id: x && x.id,
        updatedAt: x && x.updatedAt,
        status: x && x.status,
        title: x && x.title,
        number: x && x.number,
        driverId: x && x.driverId,
        bezorgerId: x && x.bezorgerId,
        driverIds: x && x.driverIds,
        bezorgerIds: x && x.bezorgerIds,
        driverNames: x && x.driverNames,
        bezorgerNames: x && x.bezorgerNames,
        driver: x && x.driver,
        bezorger: x && x.bezorger,
        rights: x && x.rights,
        pin: x && x.pin,
        name: x && x.name,
        role: x && x.role
      };
    }));
  } catch(e) { return String(Date.now()); }
}

function __tapV129ApplyUsers(rows, from){
  rows = Array.isArray(rows) ? rows : [];
  const key = __tapV129Key(rows);
  if (key === __tapV129LastUsersKey) return false;
  __tapV129LastUsersKey = key;
  BNS.state.users = rows;
  if (BNS.user) {
    const fresh = rows.find(function(u){ return String(u.id) === String(BNS.user.id); });
    if (fresh) BNS.user = fresh;
  }
  if (BNS.user) scheduleRender();
  return true;
}

function __tapV129ApplyOrders(rows, from){
  rows = Array.isArray(rows) ? rows : [];
  const key = __tapV129Key(rows);
  if (key === __tapV129LastOrdersKey) return false;
  __tapV129LastOrdersKey = key;
  BNS.state.orders = rows;
  if (BNS.user) scheduleRender();
  return true;
}

async function __tapV129PollOnce(silent){
  if (!BNS.firebase || !BNS.db) return;
  try {
    const usersSnap = await BNS.firebase.getDocs(BNS.firebase.collection(BNS.db,'users'));
    const ordersSnap = await BNS.firebase.getDocs(BNS.firebase.collection(BNS.db,'orders'));
    const users = usersSnap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
    const orders = ordersSnap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
    const u = __tapV129ApplyUsers(users,'poll');
    const o = __tapV129ApplyOrders(orders,'poll');
    if (!silent && (u || o)) toast('Bijgewerkt');
    if (!silent && !(u || o)) toast('Geen nieuwe wijzigingen');
    setStatus('Laatste sync: ' + new Date().toLocaleTimeString('nl-NL'));
  } catch(e) {
    console.warn('V129 poll mislukt', e);
    if (!silent) toast('Verversen mislukt');
  }
}

function startReadOnlyListeners(){
  if (__tapV129LiveStarted) return;
  __tapV129LiveStarted = true;
  try {
    __tapV129LastUsersKey = __tapV129Key(BNS.state.users || []);
    __tapV129LastOrdersKey = __tapV129Key(BNS.state.orders || []);

    if (BNS.firebase && BNS.db && BNS.firebase.onSnapshot) {
      BNS.firebase.onSnapshot(BNS.firebase.collection(BNS.db,'users'), function(snap){
        const rows = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        __tapV129SnapshotReady = true;
        __tapV129ApplyUsers(rows,'snapshot');
      }, function(err){ console.warn('users listener fout', err); });

      BNS.firebase.onSnapshot(BNS.firebase.collection(BNS.db,'orders'), function(snap){
        const rows = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        __tapV129SnapshotReady = true;
        __tapV129ApplyOrders(rows,'snapshot');
      }, function(err){ console.warn('orders listener fout', err); });
    }
  } catch(e) {
    console.warn('V129 live listener niet gestart', e);
  }

  // Zachte fallback: leest alleen, schrijft niets. Rendert alleen bij echte wijziging.
  clearInterval(__tapV129PollTimer);
  __tapV129PollTimer = setInterval(function(){ __tapV129PollOnce(true); }, 5000);
}

// Verversknop overschrijven: haalt users + orders op en toont meteen nieuwe plannerwijzigingen.
setTimeout(function(){
  const btn = $('refreshBtn');
  if (btn) btn.onclick = async function(){ await __tapV129PollOnce(false); };
}, 0);
