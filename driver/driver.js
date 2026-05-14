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
function deviceId(){let id=localStorage.getItem('tapwagen_driver_device_id_v147')||''; if(!id){id='dev_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9); localStorage.setItem('tapwagen_driver_device_id_v147',id)} return id}
function linkedUser(){const d=deviceId(); return (BNS.state.users||[]).find(u=>String(u.deviceId||u.phoneDeviceId||u.mobileDeviceId||'')===d&&userAllowed(u))||null}
function setLinkedUser(u){const d=deviceId(); u.deviceId=d; u.phoneDeviceId=d; u.mobileDeviceId=d; u.deviceLinkedAt=u.deviceLinkedAt||new Date().toISOString(); try{localStorage.setItem('tapwagen_driver_linked_user_v147',String(u.id||''))}catch(e){}}
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
  const linked=linkedUser();
  const users=linked?[linked]:(BNS.state.users||[]).filter(f);
  const sel=$("loginName");
  sel.innerHTML=users.length?users.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.role||"Medewerker")})</option>`).join(""):`<option value="">Geen gebruikers gevonden</option>`;
  sel.disabled=!!linked;
  const help=document.querySelector('#loginBox .help'); if(help) help.textContent=linked?'Deze telefoon is gekoppeld aan '+linked.name+'. Vul je PIN in.':'Kies je naam en vul je PIN in.';
}
function loginWithFilter(f,key,after){
  const id=$("loginName").value,pin=clean($("loginPin").value);
  const found=(BNS.state.users||[]).find(u=>String(u.id)===String(id)&&String(u.pin||"")===pin);
  if(!found){toast("Naam of PIN klopt niet");return}
  if(!f(found)){toast("Geen rechten voor deze portal");return}
  const linked=linkedUser(); if(linked && String(linked.id)!==String(found.id)){toast("Deze telefoon is gekoppeld aan "+linked.name);return}
  setLinkedUser(found);
  BNS.user=found;
  try{BNS.firebase.setDoc(BNS.firebase.doc(BNS.db,"users",String(found.id)),found,{merge:true}).catch(()=>{})}catch(e){}
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

const SESSION_KEY="tapwagen_driver_user_id_v143";
let CURRENT_DETAIL_ID="";

function userAllowed(u){
  const r=lower(u.role);
  return r==="bezorger"||r==="planner"||r==="admin"||!!(u.rights&&(u.rights.gps||u.rights.agenda||u.rights.resolve||u.rights.orders||u.rights.damage||u.rights.schade||u.rights.storing||u.rights.materials||u.rights.prices));
}
function assignedToUser(o){
  const uid=String(BNS.user.id||""),un=lower(BNS.user.name||"");
  const ids=[];
  [o.driverId,o.bezorgerId,o.userId].forEach(v=>{if(v!=null)ids.push(String(v))});
  [o.driverIds,o.bezorgerIds,o.userIds].forEach(a=>{if(Array.isArray(a))a.forEach(v=>ids.push(String(v)))});
  const names=[];
  [o.driverName,o.driver,o.bezorger].forEach(v=>{if(v!=null)names.push(lower(v))});
  [o.driverNames,o.bezorgerNames].forEach(a=>{if(Array.isArray(a))a.forEach(v=>names.push(lower(v)))});
  if(uid&&ids.includes(uid))return true;
  if(un&&names.includes(un))return true;
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
function canReport(){return hasAnyRight(["resolve","reports","meldingen","report","phoneReport"])||lower(BNS.user.role)==="admin"}
function canStoring(){return hasAnyRight(["reportStoring","storing","reports","meldingen"])||lower(BNS.user.role)==="admin"}
function canSchade(){return hasAnyRight(["reportDamage","damage","schade","reports","meldingen"])||lower(BNS.user.role)==="admin"}
function canVermissing(){return hasAnyRight(["reportMissing","missing","vermissing","vermist","reports","meldingen"])||lower(BNS.user.role)==="admin"}
function canPhotoBefore(){return hasAnyRight(["photoBefore","fotoVoor","foto_voor","fotoVoorLevering","photo_before"])||lower(BNS.user.role)==="admin"}
function canPhotoAfter(){return hasAnyRight(["photoAfter","fotoNa","foto_na","fotoNaLevering","photo_after"])||lower(BNS.user.role)==="admin"}
function canSignature(){return hasAnyRight(["signatureCustomer","handtekening","signature","sign","klantHandtekening"])||lower(BNS.user.role)==="admin"}
function canInvoice(){return hasAnyRight(["invoice","factuur","offerte","quote"])||lower(BNS.user.role)==="admin"}

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
      ${canSchade()?`<button type="button" class="btn btn-red" data-report="${esc(o.id)}" data-type="Schade">Schade</button>`:""}
      ${canStoring()?`<button type="button" class="btn btn-purple" data-report="${esc(o.id)}" data-type="Storing">Storing</button>`:""}
      ${canVermissing()?`<button type="button" class="btn btn-dark" data-report="${esc(o.id)}" data-type="Vermissing">Vermissing</button>`:""}
      ${canInvoice()?`<button type="button" class="btn btn-orange" data-offer="${esc(o.id)}">Offerte</button>`:""}
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
      ${canSchade()?`<button type="button" class="btn btn-red" data-report="${esc(o.id)}" data-type="Schade">Schade</button>`:""}
      ${canStoring()?`<button type="button" class="btn btn-purple" data-report="${esc(o.id)}" data-type="Storing">Storing</button>`:""}
      ${canVermissing()?`<button type="button" class="btn btn-dark" data-report="${esc(o.id)}" data-type="Vermissing">Vermissing</button>`:""}
      ${canInvoice()?`<button type="button" class="btn btn-orange" data-offer="${esc(o.id)}">Offerte</button>`:""}
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
  else extra=prompt("Melding voor planning:", "");

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
    system: /^(Schade|Vermissing)$/i.test(type),
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
  await addAlert({
    id:"alert_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),
    source:"telefoon", orderId:order.id||"", orderNumber:order.number||"", linkedOrder:order.id||"", linkedOrderNumber:order.number||"",
    orderTitle:order.title||"", customerName:customerName(order)||"", driverName:BNS.user.name||"", from:BNS.user.name||"", userId:BNS.user.id||"",
    title:type, type:type, system:false, text:"Foto toegevoegd", note:"Foto toegevoegd", message:"Foto toegevoegd", photoData:data,
    resolved:false, createdAt:new Date().toISOString(), time:new Date().toLocaleString("nl-NL")
  });
  toast(type+" verstuurd");
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
  wrap.querySelector("#sigSave").onclick=async()=>{const data=c.toDataURL("image/png"); await addAlert({id:"alert_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),source:"telefoon",orderId:order.id||"",orderNumber:order.number||"",linkedOrder:order.id||"",linkedOrderNumber:order.number||"",orderTitle:order.title||"",customerName:customerName(order)||"",driverName:BNS.user.name||"",from:BNS.user.name||"",userId:BNS.user.id||"",title:"Handtekening klant",type:"Handtekening klant",system:false,text:"Handtekening toegevoegd",note:"Handtekening toegevoegd",message:"Handtekening toegevoegd",signatureData:data,resolved:false,createdAt:new Date().toISOString(),time:new Date().toLocaleString("nl-NL")}); wrap.remove(); toast("Handtekening verstuurd");};
}
function enhanceDriverButtons(){
  qsa(".order-card").forEach(card=>{
    const id=card.getAttribute("data-id"); const grid=card.querySelector(".action-grid"); if(!id||!grid||grid.dataset.media143)return; grid.dataset.media143="1";
    if(canPhotoBefore()) grid.insertAdjacentHTML("beforeend",`<button type="button" class="btn btn-dark" data-photo-before="${esc(id)}">Foto voor</button>`);
    if(canPhotoAfter()) grid.insertAdjacentHTML("beforeend",`<button type="button" class="btn btn-dark" data-photo-after="${esc(id)}">Foto na</button>`);
    if(canSignature()) grid.insertAdjacentHTML("beforeend",`<button type="button" class="btn btn-purple wide" data-signature="${esc(id)}">Handtekening klant</button>`);
  });
  qsa("[data-photo-before]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.photoBefore); if(o)sendPhoto(o,"Foto voor levering")}});
  qsa("[data-photo-after]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.photoAfter); if(o)sendPhoto(o,"Foto na levering")}});
  qsa("[data-signature]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.signature); if(o)openSignatureModal(o)}});
}

function offerHtml(o){
  const mats=materialList(o);
  const total=o.total||o.totaal||o.amount||o.bedrag||'';
  const borg=o.deposit||o.borg||'';
  const rows=mats.length?mats.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.name||'')}</td><td>${esc(m.qty||'')}</td><td>${canPrices()?esc(m.price||m.prijs||''):''}</td></tr>`).join(''):'<tr><td colspan="4">Geen materialen</td></tr>';
  return `<div class="detail-header"><button type="button" class="back-btn" data-back>Terug</button></div><article class="card detail-card" id="offerView"><h2>Offerte / opdrachtbevestiging</h2><h3>${esc(o.number||'')} - ${esc(o.title||'')}</h3><div class="info-box"><b>Klant:</b> ${esc(customerName(o)||'')}<br><b>Adres:</b> ${esc(addressOf(o)||'')}<br><b>Datum:</b> ${esc(niceDate(orderStart(o)))} t/m ${esc(niceDate(orderEnd(o)))}</div><div class="section-title">Materialen</div><table style="width:100%;border-collapse:collapse"><thead><tr><th>#</th><th>Omschrijving</th><th>Aantal</th><th>${canPrices()?'Prijs':''}</th></tr></thead><tbody>${rows}</tbody></table>${canPrices()?`<div class="info-box"><b>Totaal:</b> ${esc(total||'')}<br><b>Borg:</b> ${esc(borg||'')}</div>`:''}<div class="report-grid"><button class="btn" type="button" data-share-offer> Delen </button><button class="btn btn-dark" type="button" data-print-offer> Print </button></div></article>`;
}
function showOffer(id){
  const o=findOrder(id); if(!o)return;
  $("ordersView").classList.add("hidden"); $("detailView").classList.remove("hidden"); $("detailView").innerHTML=offerHtml(o);
  const txt=`Offerte / opdrachtbevestiging\n${o.number||''} - ${o.title||''}\nKlant: ${customerName(o)||''}\nAdres: ${addressOf(o)||''}\nDatum: ${niceDate(orderStart(o))} t/m ${niceDate(orderEnd(o))}\nMaterialen: ${materialText(o)}`;
  const sh=document.querySelector('[data-share-offer]'); if(sh) sh.onclick=()=>{ if(navigator.share)navigator.share({title:'Offerte '+(o.number||''),text:txt}).catch(()=>{}); else {navigator.clipboard&&navigator.clipboard.writeText(txt); toast('Offerte gekopieerd');} };
  const pr=document.querySelector('[data-print-offer]'); if(pr) pr.onclick=()=>window.print();
  bindActions();
}

function bindActions(){
  setTimeout(enhanceDriverButtons,0);
  qsa("[data-detail]").forEach(b=>{b.onclick=()=>showDetail(b.dataset.detail)});
  qsa("[data-back]").forEach(b=>{b.onclick=()=>showOrders()});
  qsa("[data-done]").forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.done);if(!o)return;if(!confirm("Opdracht afmelden als uitgevoerd?"))return;o.status="Uitgevoerd";o.doneAt=new Date().toISOString();o.doneBy=BNS.user.name||"";await updateOrder(o);toast("Opdracht afgemeld");await loadOrdersOnly();showOrders();render()}});
  qsa("[data-report]").forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.report);if(!o)return;await sendReport(o,b.dataset.type||"Melding")}});
  qsa("[data-offer]").forEach(b=>{b.onclick=()=>showOffer(b.dataset.offer)});
  qsa("[data-agenda]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.agenda);if(!o)return;toast(`Agenda:\n${niceDate(orderStart(o))} ${o.startTime||""} - ${o.endTime||""}`)}});
}

let __twAutoRefreshStarted=false;
function showApp(){
  if(!__twAutoRefreshStarted){__twAutoRefreshStarted=true;setInterval(async()=>{try{if(BNS.user){await loadOrdersOnly(); if(!$("detailView").classList.contains("hidden") && CURRENT_DETAIL_ID)showDetail(CURRENT_DETAIL_ID); else render();}}catch(e){}},10000);}
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
