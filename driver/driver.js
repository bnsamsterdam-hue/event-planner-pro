const FIREBASE_VERSION="10.12.5";
const BNS={firebase:null,app:null,db:null,user:null,state:{users:[],orders:[],alerts:[]}};

const $=id=>document.getElementById(id);
const qsa=(sel,root=document)=>Array.from(root.querySelectorAll(sel));

function clean(v){return String(v||"").trim()}
function lower(v){return clean(v).toLowerCase()}
function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function toast(t){const e=$("toast");if(!e){alert(t);return}e.textContent=String(t||"");e.classList.add("show");clearTimeout(e._timer);e._timer=setTimeout(()=>e.classList.remove("show"),3800)}
function setStatus(t){const e=$("status");if(e)e.textContent=t}
function rightsObj(u=BNS.user){return (u&&u.rights)||{}}
function hasRight(k){
  const r=rightsObj();
  if(!r)return false;
  if(Array.isArray(r))return r.includes(k);
  return !!r[k];
}
function hasAnyRight(keys){return keys.some(k=>hasRight(k))}
function hasAnyAlias(groups){return groups.some(g=>hasAnyRight(Array.isArray(g)?g:[g]))}
function roleIs(v){return lower(BNS.user&&BNS.user.role)===v}
function isAdmin(){return roleIs("admin")}
function canUseWaze(){return isAdmin()||hasAnyRight(["gps","route","waze"])}
function canUsePhone(){return isAdmin()||hasAnyRight(["phoneCall","klantBellen","call","bellen","phone"])}
function canUseGeneralReport(){return isAdmin()||hasAnyRight(["reportGeneral","melding","meldingen","reports","resolve"])}
function canUseDamage(){return isAdmin()||hasAnyRight(["reportDamage","damage","schade"])}
function canUseStoring(){return isAdmin()||hasAnyRight(["reportStoring","storing"])}
function canUseMissing(){return isAdmin()||hasAnyRight(["reportMissing","vermissing","missing"])}
function canUsePhotoBefore(){return isAdmin()||hasAnyRight(["photoBefore","fotoVoor","fotoVoorLevering","photoBeforeDelivery"])}
function canUsePhotoAfter(){return isAdmin()||hasAnyRight(["photoAfter","fotoNa","fotoNaLevering","photoAfterDelivery"])}
function canUseSignature(){return isAdmin()||hasAnyRight(["signatureCustomer","handtekening","handtekeningKlant","signature"])}
function canUseDone(){return isAdmin()||hasAnyRight(["resolve","afmelden","done","uitgevoerd","finish"])}
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
function driverName(o){
  const arr=o.driverNames||o.bezorgerNames||o.drivers||o.bezorgers;
  if(Array.isArray(arr))return arr.map(x=>typeof x==="string"?x:(x&&x.name)||"").filter(Boolean).join(", ");
  return clean(o.driverName||o.driver||o.bezorger||"")
}
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
  try{
    const users=await loadCollection("users");
    BNS.state.users=users;
    if(BNS.user&&BNS.user.id){
      const fresh=users.find(u=>String(u.id)===String(BNS.user.id));
      if(fresh)BNS.user=fresh;
    }
  }catch(e){console.warn("users refresh overgeslagen",e)}
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
function valueList(v){
  if(Array.isArray(v))return v.map(x=>typeof x==="string"?x:(x&&(x.id||x.name))||"").filter(Boolean).map(String);
  if(v==null)return [];
  return String(v).split(/[;,]/).map(x=>x.trim()).filter(Boolean);
}
function assignedToUser(o){
  const uid=String(BNS.user.id||""),un=lower(BNS.user.name||"");
  const ids=[o.driverId,o.bezorgerId,o.userId,...valueList(o.driverIds),...valueList(o.bezorgerIds),...valueList(o.userIds)].filter(v=>v!=null).map(String);
  const names=[o.driverName,o.driver,o.bezorger,...valueList(o.driverNames),...valueList(o.bezorgerNames),...valueList(o.drivers),...valueList(o.bezorgers)].filter(Boolean).map(lower);
  if(uid&&ids.includes(uid))return true;
  if(un&&names.includes(un))return true;
  if((roleIs("planner")||roleIs("admin"))&&hasRight("orders"))return true;
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
function canRoute(){return canUseWaze()}
function canAgenda(){return hasRight("agenda")||isAdmin()}
function canDone(){return canUseDone()}
function canMaterials(){return hasAnyRight(["materials","materialen","orders"])||isAdmin()}
function canPrices(){return hasAnyRight(["prices","prijzen"])||isAdmin()}
function canReport(){return canUseGeneralReport()}
function canDamage(){return canUseDamage()||canUseStoring()||canUseMissing()}

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
      ${p&&canUsePhone()?`<a class="btn" href="tel:${esc(p)}">Bel klant</a>`:""}
      ${canReport()?`<button type="button" class="btn btn-orange" data-report="${esc(o.id)}" data-type="Melding">Melding</button>`:""}
      ${canUseStoring()?`<button type="button" class="btn btn-purple" data-report="${esc(o.id)}" data-type="Storing">Storing</button>`:""}
      ${canUseDamage()?`<button type="button" class="btn btn-red" data-report="${esc(o.id)}" data-type="Schade">Schade</button>`:""}
      ${canUseMissing()?`<button type="button" class="btn btn-dark" data-report="${esc(o.id)}" data-type="Vermissing">Vermissing</button>`:""}
      ${canUsePhotoBefore()?`<button type="button" class="btn btn-dark" data-photo="${esc(o.id)}" data-type="Foto voor levering">Foto voor</button>`:""}
      ${canUsePhotoAfter()?`<button type="button" class="btn btn-dark" data-photo="${esc(o.id)}" data-type="Foto na levering">Foto na</button>`:""}
      ${canUseSignature()?`<button type="button" class="btn btn-purple" data-signature="${esc(o.id)}">Handtekening</button>`:""}
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
      ${p&&canUsePhone()?`<a class="btn" href="tel:${esc(p)}">Bel klant</a>`:""}
      ${canAgenda()?`<button type="button" class="btn btn-dark" data-agenda="${esc(o.id)}">Agenda info</button>`:""}
      ${canReport()?`<button type="button" class="btn btn-orange" data-report="${esc(o.id)}" data-type="Melding">Melding</button>`:""}
      ${canUseStoring()?`<button type="button" class="btn btn-purple" data-report="${esc(o.id)}" data-type="Storing">Storing</button>`:""}
      ${canUseDamage()?`<button type="button" class="btn btn-red" data-report="${esc(o.id)}" data-type="Schade">Schade</button>`:""}
      ${canUseMissing()?`<button type="button" class="btn btn-dark" data-report="${esc(o.id)}" data-type="Vermissing">Vermissing</button>`:""}
      ${canUsePhotoBefore()?`<button type="button" class="btn btn-dark" data-photo="${esc(o.id)}" data-type="Foto voor levering">Foto voor</button>`:""}
      ${canUsePhotoAfter()?`<button type="button" class="btn btn-dark" data-photo="${esc(o.id)}" data-type="Foto na levering">Foto na</button>`:""}
      ${canUseSignature()?`<button type="button" class="btn btn-purple" data-signature="${esc(o.id)}">Handtekening</button>`:""}
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

async function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result||""));
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}
async function sendPhoto(order,type){
  const inp=$("photoInput");
  if(!inp){toast("Foto invoer ontbreekt");return}
  inp.value="";
  inp.onchange=async()=>{
    const file=inp.files&&inp.files[0];
    if(!file)return;
    try{
      const data=await fileToDataUrl(file);
      const alert={
        orderId:order.id||"",orderNumber:order.number||"",linkedOrder:order.id||"",linkedOrderNumber:order.number||"",
        title:type,text:"Foto toegevoegd",photoData:data,mediaData:data,mediaType:"photo",resolved:false,
        createdAt:new Date().toISOString(),from:BNS.user.name||"",userId:BNS.user.id||""
      };
      await addAlert(alert);
      order.media=Array.isArray(order.media)?order.media:[];
      order.media.push({type,mediaType:"photo",photoData:data,createdAt:alert.createdAt,from:alert.from});
      await updateOrder(order);
      toast(type+" opgeslagen");
    }catch(e){console.error(e);toast("Foto opslaan mislukt")}
  };
  inp.click();
}
async function sendSignature(order){
  const name=prompt("Naam klant / ondertekenaar:", customerName(order)||"");
  if(name===null)return;
  const note="Handtekening klant"+(name?" - "+name:"");
  const data="SIGNATURE:"+note+" @ "+new Date().toISOString();
  const alert={
    orderId:order.id||"",orderNumber:order.number||"",linkedOrder:order.id||"",linkedOrderNumber:order.number||"",
    title:"Handtekening klant",text:note,signatureData:data,mediaData:data,mediaType:"signature",resolved:false,
    createdAt:new Date().toISOString(),from:BNS.user.name||"",userId:BNS.user.id||""
  };
  await addAlert(alert);
  order.media=Array.isArray(order.media)?order.media:[];
  order.media.push({type:"Handtekening klant",mediaType:"signature",signatureData:data,text:note,createdAt:alert.createdAt,from:alert.from});
  await updateOrder(order);
  toast("Handtekening opgeslagen");
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
