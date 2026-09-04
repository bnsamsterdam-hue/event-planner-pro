window.TAPWAGEN_DRIVER_BUILD_ID = 'TW-DRIVER-2026-09-04-R11';
const FIREBASE_VERSION="10.12.5";
const BNS={firebase:null,app:null,db:null,user:null,state:{users:[],orders:[],alerts:[],materials:[]}};

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
function canFinishOrderNow(o){const e=dateTime(orderEnd(o)); if(!e) return true; return todayTime()>e}
function finishBlockedText(o){const e=orderEnd(o); return "Deze opdracht kan nog niet worden afgemeld. Afmelden kan pas na de einddatum"+(e?" (na "+niceDate(e)+")":"")+"."}
function niceDate(v){v=clean(v).slice(0,10);const p=v.split("-");return p.length===3?`${p[2]}-${p[1]}-${p[0]}`:v}
function addressOf(o){const p=[];const add=v=>{v=clean(v);if(v&&!p.includes(v))p.push(v)};[o.locationName,o.locationAddress,o.locationStreet,o.locationZip,o.locationCity,o.address,o.street,o.zip,o.city].forEach(add);if(o.location&&typeof o.location==="object")[o.location.name,o.location.address,o.location.street,o.location.zip,o.location.city].forEach(add);return p.join(", ")}
function customerName(o){return clean(o.customerName||(o.customer&&o.customer.name)||o.klant||"")}
function customerPhone(o){return clean(o.customerPhone||o.phone||(o.customer&&o.customer.phone)||"")}
function locationPhone(o){return clean(o.locationPhone||(o.location&&(o.location.phone||o.location.contactPhone))||"")}
function driverName(o){return clean(o.driverName||o.driver||o.bezorger||"")}
function matClean(v){return String(v==null?"":v).trim()}
function matKey(v){return matClean(v).toUpperCase().replace(/\s+/g,"")}
function matNameOf(m){return matClean(m&&(m.zoeknaam||m.searchName||m.search||m.productZoeknaam||m.productName||m.name||m.title||m.omschrijving||m.description))}
function matCodeOf(m){return matClean(m&&(m.code||m.nummer||m.number||m.nr||m.materialCode||m.artikelnummer))}
function matIdValues(m){
  const out=[];
  if(!m) return out;
  [m.id,m.docId,m.materialId,m.material_id,m.oldId,m.code,m.nummer,m.number,m.nr].forEach(v=>{v=matClean(v); if(v) out.push(v)});
  const cat=matClean(m.cat||m.rubriek||m.category||m.group), nr=matClean(m.nummer||m.number||m.nr);
  if(cat&&nr) out.push(cat+nr, cat+"-"+nr, cat+" "+nr);
  return out;
}
function sameMatRef(a,b){
  const av=matIdValues(a), bv=matIdValues(b);
  if(!av.length||!bv.length) return false;
  for(const x of av){for(const y of bv){if(matClean(x) && matClean(x)===matClean(y)) return true;}}
  for(const x of av){for(const y of bv){if(matKey(x) && matKey(x)===matKey(y)) return true;}}
  return false;
}
function findMaterialInfo(x){
  const list=Array.isArray(BNS.state.materials)?BNS.state.materials:[];
  if(!list.length) return null;
  const ref=typeof x==="string"?{code:x,id:x}:x;
  return list.find(m=>sameMatRef(ref,m))||null;
}
function materialList(o){
  const m=o.materials||o.mats||[];
  if(!Array.isArray(m)) return [];
  return m.map(x=>{
    const raw=typeof x==="string"?{code:x,name:"",qty:""}:Object.assign({},x||{});
    const info=findMaterialInfo(raw);
    const qty=raw.qty||raw.count||raw.aantal||raw.amount||"";
    const code=matCodeOf(raw)||matCodeOf(info)||matClean(typeof x==="string"?x:"");
    const nm=matNameOf(raw)||matNameOf(info); // BNS723: naam uit opdrachtregel wint boven algemene materialenlijst
    let label=code||nm;
    if(code&&nm&&matKey(code)!==matKey(nm)) label=code+" - "+nm;
    const extra=raw.extra||raw.note||"";
    return {name:label,qty:qty,extra:extra};
  }).filter(x=>x.name);
}
function materialText(o){const m=materialList(o);return m.length?m.map(x=>`${x.qty?x.qty+"x ":""}${x.name}`).join(", "):""}
function routeUrl(type,a){const q=encodeURIComponent(a||"");return type==="waze"?`https://waze.com/ul?q=${q}&navigate=yes`:`https://www.google.com/maps/search/?api=1&query=${q}`}

/* DRV-R10 (2026-09-04): de losse knoppen Waze en Maps zijn vervangen door een
   knop Navigatie met daarin drie keuzes. Een handeling extra, maar wel meteen
   duidelijk wat je krijgt - en er is nu ook ruimte voor Routenet.

     Waze             - navigeert meteen, de gewone keuze onderweg
     Route (Routenet) - de routeplanner waar het voertuig ingesteld kan worden
     Locatie bekijken - Google Maps op het adres, om te zien waar het is en
                        waar je kunt staan

   Alle drie krijgen het adres van de opdracht mee. De Routenet-link heeft een
   eigen vorm: pad /address, de lijst "a" mag lege tekst bevatten zolang hij
   evenveel items heeft als er adressen zijn, en de BESTEMMING staat voorop. */
/* DRV-R11 (2026-09-04): voor NAVIGATIE mag de naam van de locatie er niet in.
   addressOf() zet die er bewust wel voor - handig om op de kaart te lezen - maar
   Routenet en Waze kennen lang niet elke zaaknaam, en dan mislukt de hele
   zoekopdracht terwijl straat en plaats gewoon kloppen. Deze versie laat de
   naam weg en houdt alleen straat, postcode en plaats over. */
function routeAddress(o){
  const p=[];
  const add=v=>{ v=clean(v); if(v && !p.includes(v)) p.push(v); };
  [o.locationAddress,o.locationStreet,o.locationZip,o.locationCity,
   o.address,o.street,o.zip,o.city].forEach(add);
  if(o.location && typeof o.location==="object")
    [o.location.address,o.location.street,o.location.zip,o.location.city].forEach(add);
  return p.join(", ");
}

function routenetLink(adres){
  try{
    const pakket={
      q:[String(adres||''), 'Molenlaan 30, 1422ZA Uithoorn'],
      c:['NL','NL'],
      a:['',''],
      d:[],
      o:{optimization:'optimal', vehicle:'car', fueltype:'euro95',
         fuelconsumption:'14', emissionclass:'6', kenteken:''},
      action:'address',
      version:'20251105'
    };
    return 'https://routenet.nl/address?q='+btoa(unescape(encodeURIComponent(JSON.stringify(pakket))));
  }catch(e){ return 'https://routenet.nl/'; }
}

async function navMenu(adres){
  if(!String(adres||'').trim()){ toast('Bij deze opdracht staat geen adres.'); return; }
  const keuze=await askChoice('Navigatie',[
    {value:'waze',  label:'Waze',              cls:'btn-green'},
    {value:'route', label:'Route (Routenet)',  cls:'btn-dark'},
    {value:'maps',  label:'Locatie bekijken',  cls:'btn-dark'}
  ], adres);
  if(keuze==='waze')  location.href=routeUrl('waze',adres);
  else if(keuze==='route') window.open(routenetLink(adres),'_blank');
  else if(keuze==='maps')  window.open(routeUrl('maps',adres),'_blank');
}

document.addEventListener('click',function(ev){
  try{
    const b=ev.target && ev.target.closest ? ev.target.closest('[data-nav]') : null;
    if(!b) return;
    ev.preventDefault(); ev.stopPropagation();
    navMenu(b.getAttribute('data-nav'));
  }catch(e){}
}, true);

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
  try{ BNS.state.materials=await loadCollection("materials"); }catch(e){ BNS.state.materials=BNS.state.materials||[]; }
  try{ BNS.state.alerts=await loadCollection("alerts"); }catch(e){}
  setStatus("Data geladen");
}
async function loadOrdersOnly(){
  BNS.state.orders=await loadCollection("orders");
  try{ BNS.state.materials=await loadCollection("materials"); }catch(e){}
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
  try{ BNS.state.materials=await loadCollection("materials"); }catch(e){ BNS.state.materials=BNS.state.materials||[]; }
  try{ BNS.state.alerts=await loadCollection("alerts"); }catch(e){}
  if(BNS.user){
    const fresh=(BNS.state.users||[]).find(u=>String(u.id)===String(BNS.user.id));
    if(fresh) BNS.user=fresh;
  }
}
async function updateOrder(o, alleenVelden){
  /* DRV-R3-fix (2026-08-12): hier stond een setDoc ZONDER merge. Daarmee werd het
     hele opdrachtdocument in Firebase vervangen door wat deze telefoon toevallig
     in het geheugen had. Had een toestel een onvolledige kopie van de opdracht,
     dan wist het bij het maken van een foto in een klap de titel, de klant, de
     datum, de materialen en de prijzen - op alle apparaten tegelijk. Precies het
     patroon dat eerder 27 opdrachten heeft gekost, maar dan vanaf de telefoon.

     Nu wordt er samengevoegd (merge) en, waar de aanroeper dat meegeeft, worden
     alleen de daadwerkelijk gewijzigde velden verstuurd. Een veld dat niet wordt
     meegestuurd blijft in Firebase gewoon staan. */
  if(!o||!o.id)return;
  o.updatedAt=new Date().toISOString();
  var data=o;
  if(Array.isArray(alleenVelden)&&alleenVelden.length){
    data={updatedAt:o.updatedAt};
    alleenVelden.forEach(function(k){ if(o[k]!==undefined) data[k]=o[k]; });
  }
  await BNS.firebase.setDoc(BNS.firebase.doc(BNS.db,"orders",String(o.id)),data,{merge:true});
}
async function addAlert(a){
  const id=a.id||("a_"+Math.random().toString(36).slice(2,10));
  a.id=id;
  /* DRV-R9 (2026-08-30): een melding kon "verstuurd" melden terwijl hij nooit
     bij Firebase aankwam. Dat kan als de schrijfwachtrij vol zit of het bereik
     wegvalt: de opdracht wordt dan lokaal aangenomen en verdwijnt daarna stil.
     Nu wordt de melding na het wegschrijven TERUGGELEZEN. Lukt dat niet, dan
     volgt een tweede poging, en pas als ook die mislukt krijgt de bezorger een
     duidelijke foutmelding in plaats van een groen vinkje. Zo weet hij dat hij
     het opnieuw moet doen zodra hij weer bereik heeft. */
  const ref=BNS.firebase.doc(BNS.db,"alerts",id);
  async function schrijfEnControleer(){
    await BNS.firebase.setDoc(ref,a,{merge:true});
    if(typeof BNS.firebase.getDoc==="function"){
      const snap=await BNS.firebase.getDoc(ref);
      if(!snap || !(snap.exists && snap.exists())) throw new Error("melding niet teruggevonden in Firebase");
    }
  }
  try{
    await schrijfEnControleer();
  }catch(e1){
    try{
      await new Promise(r=>setTimeout(r,1200));
      await schrijfEnControleer();
    }catch(e2){
      toast("LET OP: melding NIET verstuurd. Probeer opnieuw met internet.");
      try{ console.warn("[BNS DRV R9] melding niet opgeslagen:", e2 && e2.message); }catch(_){}
      throw e2;
    }
  }
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
  /* DRV-R8 (2026-08-27): de aanmelding stond alleen in sessionStorage, en die
     wordt door de telefoon gewist zodra de app even naar de achtergrond gaat of
     wordt afgesloten. Vandaar dat de bezorger telkens opnieuw zijn PIN moest
     intoetsen. Nu wordt de aanmelding ook met een tijdstempel bewaard, zodat
     hij een werkdag lang meegaat en de PIN nog maar een keer per dag nodig is. */
  try{ localStorage.setItem(DAG_SESSIE_KEY, JSON.stringify({id:found.id, ts:Date.now()})); }catch(e){}
  $("loginPin").value="";
  after();
}
function dagSessieGeldig(){
  try{
    var raw=localStorage.getItem(DAG_SESSIE_KEY);
    if(!raw) return "";
    var d=JSON.parse(raw);
    if(!d || !d.id || !d.ts) return "";
    if(Date.now()-Number(d.ts) > DAG_SESSIE_UREN*3600*1000) return "";   // verlopen
    return String(d.id);
  }catch(e){ return ""; }
}
function restoreSession(f,key,after){
  var id=sessionStorage.getItem(key) || dagSessieGeldig();
  if(!id)return;
  const found=(BNS.state.users||[]).find(u=>String(u.id)===String(id));
  if(found&&f(found)){
    BNS.user=found;
    try{ sessionStorage.setItem(key,found.id); }catch(e){}   // ook deze sessie weer vullen
    after();
  }
}

const SESSION_KEY="tapwagen_driver_user_id_v143";
const DAG_SESSIE_KEY="tapwagen_driver_dagsessie_v1";   // DRV-R8
const DAG_SESSIE_UREN=18;                              // een werkdag; daarna weer PIN
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
  return !!(o && BNS_driverFolder(o)==="lopend" && o.afgemeld!==true && o.phoneDone!==true && o.completed!==true && !isCancelled(o) && !isDone(o) && !isDeleted(o));
}

function assignedToUser(o){
  if(!BNS.user || !o) return false;
  const uid=String(BNS.user.id||""), un=lower(BNS.user.name||"");
  const ids=[];
  const addId=v=>{ String(v==null?"":v).split(/[;,\n|]+/).map(clean).filter(Boolean).forEach(x=>ids.push(String(x))); };
  [o.driverId,o.bezorgerId,o.userId,o.assignedDriverId].forEach(addId);
  [o.driverIds,o.bezorgerIds,o.userIds,o.assignedDriverIds].forEach(a=>{ if(Array.isArray(a))a.forEach(addId); });
  const names=[];
  const addName=v=>{ String(v==null?"":v).split(/[;,\n|]+/).map(lower).filter(Boolean).forEach(x=>names.push(x)); };
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
/* BNS v518 telefoon: exact opdrachtnummer is leidend.
   Als Firebase oude dubbele orderdocs terugstuurt, mag de telefoon niet eerst filteren
   op bezorger en daarna een oude kopie tonen. Daarom wordt hier alleen in de
   telefoonweergave per exact opdrachtnummer/order-id de nieuwste versie gekozen.
   Dit wijzigt niets in de planner en verwijdert niets uit Firebase. */
function bns518OrderKey(o){
  if(!o) return "";
  return clean(o.number || o.orderNumber || o.opdrachtnummer || o.opdrachtNummer || o.opdracht_nr || o.orderNo || o.id || o.docId || o.orderId);
}
function bns518TimeValue(v){
  if(v==null || v==="") return 0;
  if(typeof v==="number") return v;
  const n=Number(v);
  if(!Number.isNaN(n) && n>0) return n;
  const t=Date.parse(String(v));
  return Number.isNaN(t)?0:t;
}
function bns518OrderStamp(o){
  if(!o) return 0;
  return Math.max(
    bns518TimeValue(o.driverTruthAt),
    bns518TimeValue(o.updatedAt),
    bns518TimeValue(o.modifiedAt),
    bns518TimeValue(o.createdAt)
  );
}
function bns518LatestOrdersByNumber(rows){
  const map=new Map();
  (rows||[]).forEach(o=>{
    const key=bns518OrderKey(o);
    if(!key) return;
    const old=map.get(key);
    if(!old || bns518OrderStamp(o)>=bns518OrderStamp(old)) map.set(key,o);
  });
  return Array.from(map.values());
}
function getOrders(){
  return bns518LatestOrdersByNumber(BNS.state.orders||[])
    .filter(visibleOrder)
    .sort((a,b)=>dateTime(orderStart(a))-dateTime(orderStart(b)));
}
function findOrder(id){
  const rows=bns518LatestOrdersByNumber(BNS.state.orders||[]);
  return rows.find(o=>String(o.id)===String(id)) || rows.find(o=>bns518OrderKey(o)===String(id));
}
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

function canAnyReportAction(){return canReport()||canDamage()}
function canAnyPhotoAction(){return canPhotoBefore()||canPhotoAfter()}
function searchIndexText(o){
  const parts=[];
  const seen=new Set();
  function add(v){
    if(v===undefined||v===null) return;
    if(Array.isArray(v)){ v.forEach(add); return; }
    if(typeof v==='object'){
      ['id','number','title','name','naam','customer','client','bedrijf','company','street','straat','address','adres','zip','postcode','city','plaats','phone','telefoon','email','status','driver','bezorger','vehicle','kenteken','code','cat','rubriek','description','omschrijving','note','notes','opmerking','extra','bijzonderheden','zoeknaam','searchName'].forEach(k=>add(v[k]));
      return;
    }
    let x=clean(v);
    if(!x) return;
    x=x.normalize ? x.normalize('NFD').replace(/[\u0300-\u036f]/g,'') : x;
    x=lower(x);
    if(x && !seen.has(x)){ seen.add(x); parts.push(x); }
  }
  add(o&&o.number); add(o&&o.title); add(o&&o.status);
  add(customerName(o)); add(customerPhone(o)); add(addressOf(o)); add(driverName(o));
  add(orderBrand(o));   // DRV-R4: zo kan de bezorger ook op merk zoeken
  if(o&&o.customer) add(o.customer);
  if(o&&o.client) add(o.client);
  if(o&&o.location) add(o.location);
  if(o&&o.deliveryAddress) add(o.deliveryAddress);
  if(o&&o.invoiceAddress) add(o.invoiceAddress);
  materialList(o).forEach(add);
  ['materials','items','materialen','transportLines','transport','bijzonderhedenLines','serviceLines','services'].forEach(k=>add(o&&o[k]));
  add(o&&o.extra); add(o&&o.notes); add(o&&o.note); add(o&&o.description); add(o&&o.bijzonderheden); add(o&&o.text);
  return parts.join(' ');
}
function applyDriverSearch(){
  const inp=$("searchBox");
  let q=lower(inp&&inp.value||'');
  q=q.normalize ? q.normalize('NFD').replace(/[\u0300-\u036f]/g,'') : q;
  const tokens=q.split(/\s+/).map(x=>x.trim()).filter(Boolean);
  qsa(".order").forEach(el=>{
    let hay=lower(el.getAttribute('data-search')||el.innerText||'');
    hay=hay.normalize ? hay.normalize('NFD').replace(/[\u0300-\u036f]/g,'') : hay;
    const ok=!tokens.length || tokens.every(t=>hay.includes(t));
    el.style.display=ok?"":"none";
  });
}


function orderBadges(o){
  // BNS v647: verwijder niet-klikbare bovenste knoppen/labels op de bezorgertelefoon.
  // Status blijft zichtbaar, echte acties staan als grote knoppen onder de opdracht.
  const badges=[];
  if(o.status) badges.push(`<span class="badge">${esc(o.status||"Open")}</span>`);
  if(otherCustomerOrders(o).length)badges.push(`<span class="badge warn">Meer artikelen</span>`);
  return badges.join("");
}

/* DRV-R4 (2026-08-18): het veld "Uitstraling / merk" werd in de bezorger-app
   nergens getoond, terwijl het in de hoofdapp wel wordt ingevuld en als o.brand
   op de opdracht wordt bewaard. Hier wordt het opgehaald - met de gebruikelijke
   alternatieve veldnamen erbij, want deze codebase gebruikt door elkaar heen
   Nederlandse en Engelse namen. */
function orderBrand(o){
  return clean(o && (o.brand || o.merk || o.uitstraling || o.orderBrand || o.brandName || ''));
}
function orderCard(o){
  const a=addressOf(o),p=locationPhone(o),s=orderStart(o),e=orderEnd(o),dl=s&&e&&s!==e?`${niceDate(s)} tot ${niceDate(e)}`:niceDate(s||e);
  const mats=materialList(o);
  return `<article class="order-card order" data-id="${esc(o.id)}" data-search="${esc(searchIndexText(o))}">
    <span class="order-number">${esc(o.number||"Opdracht")}</span>
    <div class="order-title">${esc(o.title||"Zonder titel")}</div>
    <div class="badges">${orderBadges(o)}</div>
    <div class="meta">
      <div class="meta-row"><span>📅</span><div><strong>${esc(dl||"Geen datum")}</strong></div></div>
      ${orderBrand(o)?`<div class="meta-row"><span>🍺</span><div>${esc(orderBrand(o))}</div></div>`:""}
      <div class="meta-row"><span>👤</span><div>${esc(customerName(o)||"Klant onbekend")}</div></div>
      <div class="meta-row"><span>📍</span><div>${esc(a||"Adres onbekend")}</div></div>
      <div class="meta-row"><span>📦</span><div>${esc(mats.length?`${mats.length} artikelsoorten - ${materialText(o)}`:"Geen materialen")}</div></div>
    </div>
    <div class="action-grid">
      <button type="button" class="more-btn wide" data-detail="${esc(o.id)}">Open opdracht</button>
      ${canRoute()?`<button type="button" class="btn btn-green" data-nav="${esc(routeAddress(o))}">\u{1F6E3}\uFE0F Navigatie</button>`:""}
      ${p?`<a class="btn" href="tel:${esc(p)}">Bel klant</a>`:""}
      ${canAnyReportAction()?`<button type="button" class="btn btn-red" style="background:#dc2626!important;color:#fff!important" data-report-menu="${esc(o.id)}">Melding maken</button>`:""}
      ${canQuote()?`<button type="button" class="btn btn-orange" data-quote="${esc(o.id)}">Offerte</button>`:""}
      ${canDone()?`<button type="button" class="btn btn-full ${canFinishOrderNow(o)?'btn-green':'btn-dark'} wide" data-done="${esc(o.id)}">${canFinishOrderNow(o)?'Afmelden / uitgevoerd':'Afmelden pas na einddatum'}</button>`:""}
    </div>
  </article>`;
}

function render(){
  const rows=getOrders();
  $("orders").innerHTML=rows.length?rows.map(orderCard).join(""):`<div class="empty">Geen opdrachten voor deze gebruiker.</div>`;
  bindActions();
  setTimeout(applyDriverSearch,0);
}

function showOrders(){
  CURRENT_DETAIL_ID="";
  $("detailView").classList.add("hidden");
  $("ordersView").classList.remove("hidden");
}


function orderField(o, keys){
  for(const k of keys){
    const v=o&&o[k];
    if(v!==undefined && v!==null && String(v).trim()!=='') return v;
  }
  return '';
}
function moneyLine(label, value){
  value=clean(value);
  if(!value) return '';
  return `<div><b>${esc(label)}:</b> ${esc(money(value))}</div>`;
}
function materialRowsHtml(o){
  const raw=Array.isArray(o&&o.materials)?o.materials:[];
  const mats=materialList(o);
  if(!mats.length) return '<div class="tw-row muted">Geen materialen</div>';
  return mats.map((m,i)=>{
    const r=raw[i]||{};
    const price=clean(r.price||r.prijs||r.amount||r.bedrag||'');
    const note=clean(m.extra||r.note||r.notes||r.opmerking||'');
    return `<div class="tw-row"><div><b>${esc(m.qty?m.qty+'x ':'')}${esc(m.name)}</b>${note?'<br><small>'+esc(note)+'</small>':''}</div>${(canPrices()&&price)?'<div class="tw-price">'+esc(money(price))+'</div>':''}</div>`;
  }).join('');
}

function driverLineTotal(l){
  const qty=Number(String(l&& (l.qty||l.aantal||1)).replace(',','.'))||1;
  const price=Number(String(l&& (l.price||l.prijs||l.amount||l.bedrag||0)).replace(/[^0-9,.-]/g,'').replace(',','.'))||0;
  const total=Number(String(l&& (l.total||l.totaal||'')).replace(/[^0-9,.-]/g,'').replace(',','.'));
  return Number.isFinite(total)&&total>0 ? total : qty*price;
}
function driverTransportLinesHtml(o){
  const arr = Array.isArray(o&&o.transportLines) ? o.transportLines : (Array.isArray(o&&o.transport) ? o.transport : []);
  if(!arr.length) return '<div class="tw-row muted">Geen bijzonderheden</div>';
  return arr.map(l=>{
    const qty=clean(l&& (l.qty||l.aantal||''));
    const name=clean(l&& (l.name||l.naam||l.description||l.omschrijving||''));
    const note=clean(l&& (l.note||l.opmerking||l.notes||''));
    const amount=driverLineTotal(l);
    const left=(qty?qty+'x ':'')+(name||'Bijzonderheid');
    return `<div class="tw-row"><div><b>${esc(left)}</b>${note?'<br><small>'+esc(note)+'</small>':''}</div>${(canPrices()&&amount)?'<div class="tw-price">'+esc(money(amount))+'</div>':''}</div>`;
  }).join('');
}

function priceBlockHtml(o){
  if(!canPrices()) return '';
  const lines=[];
  lines.push(moneyLine('Totaal', orderField(o,['amount','total','totaal','price','bedrag','quoteTotal','invoiceTotal'])));
  lines.push(moneyLine('Borg', orderField(o,['deposit','borg','waarborg'])));
  lines.push(moneyLine('Bijzonderheden', orderField(o,['transport','transportPrice','transportkosten','transportTotal'])));
  
  lines.push(moneyLine('BTW', orderField(o,['vat','btw','tax'])));
  const html=lines.filter(Boolean).join('');
  return html || '<div class="muted">Geen apart totaalbedrag gevonden. Kijk ook bij tekst/bijzonderheden.</div>';
}
function redactPricesForNoRight(txt){
  if(canPrices()) return txt;
  return String(txt||'')
    .replace(/€\s*[0-9][0-9\s.,-]*/g,'[prijs verborgen]')
    .replace(/\b[0-9]+(?:[,.][0-9]{1,2})?\s*(?:euro|ex\s*btw|incl\.?\s*btw)\b/ig,'[prijs verborgen]');
}
function textBlockHtml(o){
  const txt=clean(o&& (o.extra||o.notes||o.note||o.description||o.bijzonderheden||o.text||''));
  const safe=redactPricesForNoRight(txt);
  return safe ? esc(safe).replace(/\n/g,'<br>') : '<span class="muted">Geen extra tekst.</span>';
}
function fullOrderHtml(o, title){
  const a=addressOf(o), p=locationPhone(o), s=orderStart(o), e=orderEnd(o);
  const dl=s&&e&&s!==e?`${niceDate(s)} tot ${niceDate(e)}`:niceDate(s||e);
  return `<div class="tw-doc"><style>
    .tw-doc{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;color:#0f172a;padding:12px;line-height:1.45}.tw-doc h2{margin:0 0 10px;font-size:22px}.tw-card{border:1px solid #dbe3ef;border-radius:18px;padding:12px;margin:10px 0;background:#fff}.tw-grid{display:grid;grid-template-columns:1fr;gap:8px}.tw-row{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #eef2f7;padding:8px 0}.tw-row:last-child{border-bottom:0}.tw-price{font-weight:900;white-space:nowrap}.muted{color:#64748b}.tw-label{font-size:12px;text-transform:uppercase;color:#64748b;font-weight:900;letter-spacing:.04em}.tw-big{font-size:16px;font-weight:800}.tw-danger{background:#fee2e2;color:#991b1b;border-radius:12px;padding:8px 10px;font-weight:900}
  </style>
  <h2>${esc(title||'Opdracht')} ${esc(o.number||'')}</h2>
  <div class="tw-card">
    <div class="tw-label">Klant en locatie</div>
    <div class="tw-big">${esc(customerName(o)||'Klant onbekend')}</div>
    <div>${esc(o.title||'')}</div>
    <div>${esc(a||'Adres onbekend')}</div>
    ${p?'<div>Tel: '+esc(p)+'</div>':''}
  </div>
  <div class="tw-card"><div class="tw-label">Datum / planning</div><div class="tw-big">${esc(dl||'Geen datum')}</div>${o.startTime||o.endTime?'<div>'+esc(o.startTime||'')+' - '+esc(o.endTime||'')+'</div>':''}<div>Bezorger: ${esc(driverName(o)||BNS.user?.name||'')}</div></div>
  <div class="tw-card"><div class="tw-label">Materialen</div>${materialRowsHtml(o)}</div>
  ${canPrices()?'<div class="tw-card"><div class="tw-label">Prijzen / bedragen</div>'+priceBlockHtml(o)+'</div>':''}
  <div class="tw-card"><div class="tw-label">Bijzonderheden</div>${driverTransportLinesHtml(o)}</div>
  <div class="tw-card"><div class="tw-label">Tekst / bijzonderheden</div><div>${textBlockHtml(o)}</div></div>
  </div>`;
}

function detailHtml(o){
  const a=addressOf(o),p=locationPhone(o),more=otherCustomerOrders(o);
  return `<div class="detail-header"><button type="button" class="back-btn" data-back>Terug</button></div>
  <article class="card detail-card">
    ${fullOrderHtml(o,'Open opdracht')}
    ${more.length?`<div class="section-title">Meer artikelen / opdrachten voor deze klant</div><div class="info-box">${more.map(x=>`• ${esc(x.number||"")} ${esc(x.title||"")} - ${esc(niceDate(orderStart(x)))}`).join("<br>")}</div>`:""}
    <div class="section-title">Acties</div>
    <div class="report-grid">
      ${canRoute()?`<button type="button" class="btn btn-green" data-nav="${esc(routeAddress(o))}">\u{1F6E3}\uFE0F Navigatie</button>`:""}
      ${p?`<a class="btn" href="tel:${esc(p)}">Bel klant</a>`:""}
      ${canAnyReportAction()?`<button type="button" class="btn btn-red wide" style="background:#dc2626!important;color:#fff!important" data-report-menu="${esc(o.id)}">Melding maken</button>`:""}
      ${canQuote()?`<button type="button" class="btn btn-orange" data-quote="${esc(o.id)}">Offerte</button>`:""}
      ${canDone()?`<button type="button" class="btn btn-full ${canFinishOrderNow(o)?'btn-green':'btn-dark'} wide" data-done="${esc(o.id)}">${canFinishOrderNow(o)?'Afmelden / uitgevoerd':'Afmelden pas na einddatum'}</button>`:""}
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
function canQuote(){return canPrices() && (hasAnyRight(["invoice","factuur","offerte","quote","offer","orders"])||lower(BNS.user.role)==="admin")}
function money(v){const n=Number(String(v||0).replace(',','.'));return Number.isFinite(n)&&n?('€ '+n.toFixed(2).replace('.',',')):clean(v||'')}
function askChoice(title, options, subtitel){   // DRV-R7: subtitel toont wat er eerder is gemeld
  return new Promise(resolve=>{
    const wrap=document.createElement("div");
    wrap.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px";
    const rows=(options||[]).map(opt=>`<button type="button" class="${esc(opt.cls||'btn-dark')}" data-choice="${esc(opt.value)}" style="width:100%;margin:6px 0">${esc(opt.label||opt.value)}</button>`).join("");
    wrap.innerHTML=`<div style="background:#fff;border-radius:22px;padding:16px;width:min(560px,100%);box-shadow:0 24px 80px rgba(0,0,0,.35)"><h2 style="margin-top:0">${esc(title)}</h2>${subtitel?`<div style="background:#f1f5f9;border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:14px;white-space:pre-line">${esc(subtitel)}</div>`:""}${rows}<button type="button" id="twChoiceCancel" class="btn-dark" style="width:100%;margin-top:10px">Annuleren</button></div>`;
    document.body.appendChild(wrap);
    qsa("[data-choice]",wrap).forEach(b=>b.onclick=()=>{const v=b.dataset.choice;wrap.remove();resolve(v)});
    wrap.querySelector("#twChoiceCancel").onclick=()=>{wrap.remove();resolve("")};
  });
}
async function openReportChoice(order){
  const opts=[];
  if(canReport()) opts.push({value:"Melding",label:"Algemene melding",cls:"btn-orange"});
  if(canDamage()) opts.push({value:"Schade",label:"Schade",cls:"btn-red"},{value:"Storing",label:"Storing",cls:"btn-purple"});
  /* DRV-R6 (2026-08-27): sleutels apart, want dat is het probleem dat het vaakst
     terugkomt - sleutels die niet retour zijn. En een knop om een melding weer
     op te lossen, zodat de planner ziet dat het geregeld is. */
  opts.push({value:"Sleutels",label:"Sleutels afgeven",cls:"btn-dark"});
  if(openMeldingenVoor(order).length) opts.push({value:"Opgelost",label:"Melding oplossen",cls:"btn-green"});
  const type=await askChoice("Melding maken",opts);
  if(type==="Sleutels") return sendSleutels(order);
  if(type==="Opgelost") return losMeldingOp(order);
  if(type) await sendReport(order,type);
}

/* De openstaande meldingen van deze opdracht - de bezorger mag die van zijn
   eigen klanten inzien en oplossen. */
function openMeldingenVoor(order){
  const list=(BNS.state && Array.isArray(BNS.state.alerts)) ? BNS.state.alerts : [];
  const oid=String(order&&order.id||""), onr=String(order&&order.number||"");
  return list.filter(a=>{
    if(!a || a.resolved) return false;
    const ai=String(a.orderId||""), an=String(a.orderNumber||"");
    return (oid&&(ai===oid||an===oid)) || (onr&&(ai===onr||an===onr));
  });
}

/* Sleutelformulier: aantal + waar ze gebleven zijn + eigen tekst. */
function askSleutels(){
  return new Promise(resolve=>{
    const wrap=document.createElement("div");
    wrap.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:14px";
    wrap.innerHTML=`<div style="background:#fff;border-radius:22px;padding:16px;width:min(560px,100%);box-shadow:0 24px 80px rgba(0,0,0,.35);max-height:88vh;overflow:auto">
      <h2 style="margin:0 0 10px;font-size:19px">Sleutels afgeven</h2>
      <label style="display:block;font-weight:800;margin-bottom:4px">Aantal sleutels</label>
      <input id="twSlAantal" type="number" min="0" step="1" value="1" style="width:100%;padding:12px;border:2px solid #cbd5e1;border-radius:12px;font-size:17px;margin-bottom:12px">
      <label style="display:block;font-weight:800;margin-bottom:6px">Waar zijn ze gebleven?</label>
      <label style="display:flex;gap:9px;align-items:center;padding:9px;border:2px solid #e2e8f0;border-radius:12px;margin-bottom:7px;font-size:15px"><input type="radio" name="twSlWaar" value="Aan klant afgegeven" checked> Aan klant afgegeven</label>
      <label style="display:flex;gap:9px;align-items:center;padding:9px;border:2px solid #e2e8f0;border-radius:12px;margin-bottom:7px;font-size:15px"><input type="radio" name="twSlWaar" value="In brievenbus gestopt"> In brievenbus gestopt</label>
      <label style="display:flex;gap:9px;align-items:center;padding:9px;border:2px solid #e2e8f0;border-radius:12px;margin-bottom:7px;font-size:15px"><input type="radio" name="twSlWaar" value="In spoelbak gelegd"> In spoelbak gelegd</label>
      <label style="display:flex;gap:9px;align-items:center;padding:9px;border:2px solid #e2e8f0;border-radius:12px;margin-bottom:10px;font-size:15px"><input type="radio" name="twSlWaar" value="Anders"> Anders / eigen tekst</label>
      <label style="display:block;font-weight:800;margin-bottom:4px">Toelichting</label>
      <textarea id="twSlTekst" rows="3" placeholder="Bijvoorbeeld: bij de buurman afgegeven" style="width:100%;padding:12px;border:2px solid #cbd5e1;border-radius:12px;font-size:16px;margin-bottom:14px"></textarea>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button type="button" id="twSlAnnuleer" style="padding:14px;border:0;border-radius:12px;background:#475569;color:#fff;font-weight:900;font-size:16px">Annuleren</button>
        <button type="button" id="twSlOk" style="padding:14px;border:0;border-radius:12px;background:#16a34a;color:#fff;font-weight:900;font-size:16px">Versturen</button>
      </div></div>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#twSlAnnuleer").onclick=()=>{wrap.remove();resolve(null);};
    wrap.querySelector("#twSlOk").onclick=()=>{
      const aantal=String(wrap.querySelector("#twSlAantal").value||"0");
      const waarEl=wrap.querySelector('input[name="twSlWaar"]:checked');
      const waar=waarEl?waarEl.value:"";
      const tekst=clean(wrap.querySelector("#twSlTekst").value||"");
      wrap.remove();
      resolve({aantal:aantal, waar:waar, tekst:tekst});
    };
  });
}

/* De laatste openstaande sleutelmelding van deze opdracht - zo weet de app bij
   het ophalen nog wat er bij het brengen is ingevuld. */
function laatsteSleutelmelding(order){
  return openMeldingenVoor(order).filter(a=>{
    const t=(String(a.type||"")+" "+String(a.title||"")).toLowerCase();
    return t.indexOf("sleutel")>=0;
  }).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")))[0]||null;
}

/* DRV-R7 (2026-08-27): bij het OPHALEN moet de bezorger kunnen zeggen of de
   sleutel er weer is. Staat er al een sleutelmelding open, dan tonen we eerst
   wat hij bij het brengen heeft ingevuld, met drie keuzes:
     - Sleutel is terug  -> melding gaat op opgelost
     - Sleutel mist      -> melding wordt Vermissing sleutel voor de planner
     - Nieuwe sleutelmelding -> het gewone formulier
   Is de sleutel er gewoon, dan hoeft hij niets te doen. */
async function sendSleutels(order){
  const oud=laatsteSleutelmelding(order);
  if(oud){
    const wat=clean(String(oud.message||oud.text||""));
    const wanneer=String(oud.time||oud.createdAt||"").slice(0,16);
    const keuze=await askChoice(
      "Sleutels - eerder gemeld",
      [
        {value:"terug", label:"Sleutel is terug", cls:"btn-green"},
        {value:"mist",  label:"Sleutel mist",     cls:"btn-red"},
        {value:"nieuw", label:"Nieuwe sleutelmelding", cls:"btn-dark"}
      ],
      (wat?wat:"Sleutelmelding")+(wanneer?"\n"+wanneer:"")
    );
    if(!keuze) return;
    if(keuze==="terug"){
      const tekst=await askText("Sleutel is terug","Toelichting (mag leeg blijven)");
      oud.resolved=true;
      oud.resolvedAt=new Date().toISOString();
      oud.resolvedBy=BNS.user.name||"";
      oud.resolvedNote=clean(tekst)||"Sleutel terug ontvangen";
      oud.oplossing=oud.resolvedNote;
      await addAlert(oud);
      toast("Sleutel gemeld als terug");
      return;
    }
    if(keuze==="mist"){
      const tekst=await askText("Sleutel mist","Wat is er aan de hand?");
      if(!tekst) return;
      const eerder=clean(String(oud.message||oud.text||""));
      const nieuwTekst="SLEUTEL MIST bij ophalen. "+clean(tekst)+(eerder?" (bij brengen: "+eerder+")":"");
      oud.type="Vermissing sleutel";
      oud.kind="Vermissing sleutel";
      oud.category="Vermissing sleutel";
      oud.reportType="Vermissing sleutel";
      oud.alertType="Vermissing sleutel";
      oud.title="Vermissing sleutel"+(order.number?" - "+order.number:"");
      oud.text=nieuwTekst; oud.note=nieuwTekst; oud.message=nieuwTekst; oud.description=nieuwTekst;
      oud.resolved=false;
      oud.sleutelMistSinds=new Date().toISOString();
      oud.gemeldDoor=BNS.user.name||"";
      await addAlert(oud);
      toast("Vermissing sleutel doorgegeven aan de planning");
      return;
    }
  }
  const r=await askSleutels();
  if(!r) return;
  if(r.waar==="Anders" && !r.tekst){ toast("Vul een toelichting in."); return; }
  const omschrijving = r.aantal+" sleutel(s) - "+(r.waar==="Anders"?r.tekst:r.waar)+(r.waar!=="Anders"&&r.tekst?" ("+r.tekst+")":"");
  const label="Sleutels";
  const aid="alert_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
  await addAlert({
    id:aid, source:"driver", portal:"driver", fromDriver:true, fromPhone:true,
    orderId:order.id||"", orderNumber:order.number||"",
    linkedOrder:order.id||"", linkedOrderNumber:order.number||"",
    orderTitle:order.title||"", customerName:customerName(order)||"",
    driverName:BNS.user.name||"",
    title:label+(order.number?" - "+order.number:""),
    type:label, kind:label, category:label, reportType:label, alertType:label,
    sleutelAantal:r.aantal, sleutelWaar:r.waar,
    text:omschrijving, note:omschrijving, message:omschrijving, description:omschrijving,
    resolved:false, done:false, hidden:false, admin:true, visibleInPlanner:true,
    createdAt:new Date().toISOString(), time:new Date().toLocaleString("nl-NL"),
    from:BNS.user.name||"", userId:BNS.user.id||""
  });
  toast("Sleutelmelding verstuurd voor opdracht "+(order.number||""));
}

/* Melding oplossen: kies er een, geef een eigen tekst, en de planner ziet hem
   als opgelost met die toelichting erbij. */
async function losMeldingOp(order){
  const open=openMeldingenVoor(order);
  if(!open.length){ toast("Geen openstaande meldingen."); return; }
  const opts=open.map(a=>({value:String(a.id),label:clean(a.title||a.type||"Melding")+(a.message?" - "+clean(String(a.message)).slice(0,40):""),cls:"btn-dark"}));
  const keuze=await askChoice("Welke melding is opgelost?",opts);
  if(!keuze) return;
  const a=open.filter(x=>String(x.id)===String(keuze))[0];
  if(!a) return;
  const tekst=await askText("Melding oplossen","Wat is er gebeurd? (bijvoorbeeld: sleutel is terug)");
  if(!tekst) return;
  a.resolved=true;
  a.resolvedAt=new Date().toISOString();
  a.resolvedBy=BNS.user.name||"";
  a.resolvedNote=tekst;
  a.oplossing=tekst;
  await addAlert(a);
  toast("Melding gemeld als opgelost");
}
async function openPhotoChoice(order){
  const opts=[];
  if(canPhotoBefore()) opts.push({value:"Foto voor levering",label:"Foto voor levering",cls:"btn-dark"});
  if(canPhotoAfter()) opts.push({value:"Foto na levering",label:"Foto na levering",cls:"btn-dark"});
  const type=await askChoice("Foto / bewijs",opts);
  if(type) await sendPhoto(order,type);
}

function parseDriverAmount(v){
  if(v===undefined||v===null||v==='') return 0;
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  var x=String(v).replace(/\s/g,'').replace(/€|EUR|eur/g,'');
  if(x.indexOf(',')>=0){ x=x.replace(/\./g,'').replace(',','.'); }
  else { x=x.replace(/[^0-9.-]/g,''); }
  var n=Number(x.replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)?n:0;
}
function materialLineTotalDriver(m){
  var qty=parseDriverAmount(m&& (m.qty||m.aantal||m.count||1)) || 1;
  var price=parseDriverAmount(m&& (m.price||m.prijs||m.amount||m.bedrag||m.total||m.totaal||0));
  return qty*price;
}
function quoteTotalsHtml(o){
  if(!canPrices()) return '';
  var mats=Array.isArray(o&&o.materials)?o.materials:[];
  var matSub=mats.reduce(function(sum,m){return sum+materialLineTotalDriver(m);},0);
  var lines=Array.isArray(o&&o.transportLines)?o.transportLines:(Array.isArray(o&&o.transport)?o.transport:[]);
  var bijzSub=lines.reduce(function(sum,l){return sum+driverLineTotal(l);},0);
  var explicitTotal=parseDriverAmount(orderField(o,['quoteTotal','invoiceTotal','grandTotal','total','totaal','amount','bedrag']));
  var borg=parseDriverAmount(orderField(o,['deposit','borg','waarborg']));
  var excl=(matSub+bijzSub) || explicitTotal;
  var vat=parseDriverAmount(orderField(o,['vat','btw','tax']));
  if(!vat && excl) vat=excl*0.21;
  var grand=explicitTotal || (excl+vat+borg);
  function row(label,val,strong){ return val?`<div class="tw-row"><div>${esc(label)}</div><div class="tw-price">${esc(money(val))}</div></div>`:''; }
  return `<div class="tw-card"><div class="tw-label">Totaal</div>
    ${row('Subtotaal materialen',matSub)}
    ${row('Subtotaal bijzonderheden',bijzSub)}
    ${row('Subtotaal excl. btw',excl)}
    ${row('BTW 21%',vat)}
    ${row('Borg',borg)}
    ${row('Totaal incl. btw',grand,true)}
  </div>`;
}
function quoteHtml(o){
  return `<div>${fullOrderHtml(o,'Offerte / opdrachtbevestiging').replace(/<div class="tw-card"><div class="tw-label">Prijzen \/ bedragen<\/div>[\s\S]*?<\/div>\s*<div class="tw-card"><div class="tw-label">Bijzonderheden<\/div>/,'<div class="tw-card"><div class="tw-label">Bijzonderheden</div>')}${quoteTotalsHtml(o)}</div>`;
}
function openQuote(order){
  const wrap=document.createElement("div");
  wrap.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:12px";
  wrap.innerHTML='<div style="background:#fff;border-radius:22px;width:min(760px,100%);max-height:92vh;overflow:auto;box-shadow:0 24px 80px rgba(0,0,0,.35)"><div id="twQuoteBody">'+quoteHtml(order)+'</div><div style="position:sticky;bottom:0;background:#fff;padding:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;border-top:1px solid #e5e7eb"><button id="twQuoteClose" class="btn-dark" type="button">Terug</button><button id="twQuoteShare" type="button">Delen</button><button id="twQuotePrint" class="btn-green" type="button">Print</button></div></div>';
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

  const label = type || "Melding";
  const aid = "alert_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
  await addAlert({
    id: aid,
    source: "driver",
    portal: "driver",
    fromDriver: true,
    fromPhone: true,
    orderId: order.id || "",
    orderNumber: order.number || "",
    linkedOrder: order.id || "",
    linkedOrderNumber: order.number || "",
    orderTitle: order.title || "",
    customerName: customerName(order) || "",
    driverName: BNS.user.name || "",
    title: label + (order.number ? " - " + order.number : ""),
    type: label,
    kind: label,
    category: label,
    reportType: label,
    alertType: label,
    text: extra,
    note: extra,
    message: extra,
    description: extra,
    resolved: false,
    done: false,
    hidden: false,
    admin: true,
    visibleInPlanner: true,
    createdAt: new Date().toISOString(),
    time: new Date().toLocaleString("nl-NL"),
    from: BNS.user.name || "",
    userId: BNS.user.id || ""
  });

  toast(`${label} verstuurd voor opdracht ${order.number || ""}`);
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
  await updateOrder(order,['media','photos','driverUploads']); // DRV-R3: alleen de fotolijsten
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
    await updateOrder(order,['media','signatures','customerSignature','customerSignedAt','customerSignedBy']); // DRV-R3
    wrap.remove();
    toast("Handtekening opgeslagen bij opdracht");
  };
}
function enhanceDriverButtons(){
  function addMediaButtons(grid,id){
    if(!id||!grid||grid.dataset.media143)return;
    grid.dataset.media143="1";
    if(canAnyPhotoAction()) grid.insertAdjacentHTML("beforeend",`<button type="button" class="btn btn-dark" data-photo-menu="${esc(id)}">Foto / bewijs</button>`);
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
  qsa("[data-photo-menu]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.photoMenu); if(o)openPhotoChoice(o)}});
  qsa("[data-signature]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.signature); if(o)openSignatureModal(o)}});
}

function bindActions(){
  setTimeout(enhanceDriverButtons,0);
  qsa("[data-detail]").forEach(b=>{b.onclick=()=>showDetail(b.dataset.detail)});
  qsa("[data-back]").forEach(b=>{b.onclick=()=>showOrders()});
  qsa("[data-done]").forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.done);if(!o)return;if(!canFinishOrderNow(o)){await askConfirm("Nog niet afmelden", finishBlockedText(o));return;}if(!await askConfirm("Opdracht afmelden", "Opdracht afmelden als uitgevoerd?"))return;o.status="Uitgevoerd";o.doneAt=new Date().toISOString();o.doneBy=BNS.user.name||"";await updateOrder(o,['status','doneAt','doneBy']);/* DRV-R3 */toast("Opdracht afgemeld");await loadPhoneData();showOrders();render()}});
  qsa("[data-quote]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.dataset.quote); if(o)openQuote(o)}});
  qsa("[data-report]").forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.report);if(!o)return;await sendReport(o,b.dataset.type||"Melding")}});
  qsa("[data-report-menu]").forEach(b=>{b.onclick=async()=>{const o=findOrder(b.dataset.reportMenu);if(!o)return;await openReportChoice(o)}});
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

function installSearchKeyboard(){
  const inp=$("searchBox");
  if(!inp||inp.dataset.bns687Keyboard) return;
  inp.dataset.bns687Keyboard="1";
  inp.setAttribute("readonly","readonly");
  inp.setAttribute("inputmode","none");
  inp.setAttribute("autocomplete","off");
  inp.setAttribute("autocorrect","off");
  inp.setAttribute("spellcheck","false");
  inp.placeholder=inp.placeholder||"Zoeken";

  function hideKb(){
    const kb=$("bns687SearchKeyboard") || $("bns686SearchKeyboard");
    if(kb) kb.classList.add("hidden");
    try{inp.blur()}catch(_e){}
  }
  function addText(t){ inp.value += t; applyDriverSearch(); }
  function keyBtn(k, extra){
    return `<button type="button" data-k="${esc(k)}" style="min-width:0;padding:12px 0;border-radius:10px;border:0;background:#ffffff;color:#111827;font-weight:800;font-size:20px;box-shadow:0 1px 2px rgba(15,23,42,.24);${extra||''}">${esc(k)}</button>`;
  }
  function showKb(){
    let old=$("bns686SearchKeyboard");
    if(old) old.remove();
    let kb=$("bns687SearchKeyboard");
    if(kb){kb.classList.remove("hidden"); return;}
    kb=document.createElement("div");
    kb.id="bns687SearchKeyboard";
    kb.style.cssText="position:fixed;left:0;right:0;bottom:0;z-index:999998;background:#e5e7eb;border-radius:18px 18px 0 0;box-shadow:0 -8px 30px rgba(15,23,42,.28);padding:10px 8px 12px;max-height:38vh;overflow:auto";
    kb.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <button type="button" data-clear style="padding:9px 14px;border-radius:12px;border:0;background:#9ca3af;color:#111827;font-weight:900;font-size:15px">Leeg</button>
        <button type="button" data-close-top style="padding:9px 18px;border-radius:12px;border:0;background:#2563eb;color:#fff;font-weight:900;font-size:15px">Klaar</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:6px;margin-bottom:8px">${['1','2','3','4','5','6','7','8','9','0'].map(k=>keyBtn(k)).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:6px;margin-bottom:8px">${['Q','W','E','R','T','Y','U','I','O','P'].map(k=>keyBtn(k)).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:6px;margin:0 5% 8px">${['A','S','D','F','G','H','J','K','L'].map(k=>keyBtn(k)).join('')}</div>
      <div style="display:grid;grid-template-columns:1.15fr repeat(7,1fr) 1.15fr;gap:6px;margin-bottom:8px">
        <button type="button" data-k="-" style="padding:12px 0;border-radius:10px;border:0;background:#cbd5e1;color:#111827;font-weight:900;font-size:20px">-</button>
        ${['Z','X','C','V','B','N','M'].map(k=>keyBtn(k)).join('')}
        <button type="button" data-backspace style="padding:12px 0;border-radius:10px;border:0;background:#9ca3af;color:#111827;font-weight:900;font-size:20px">⌫</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 4fr 1fr 1fr;gap:6px">
        <button type="button" data-k="/" style="padding:12px 0;border-radius:10px;border:0;background:#cbd5e1;color:#111827;font-weight:900;font-size:18px">/</button>
        <button type="button" data-k="," style="padding:12px 0;border-radius:10px;border:0;background:#fff;color:#111827;font-weight:900;font-size:18px">,</button>
        <button type="button" data-space style="padding:12px;border-radius:10px;border:0;background:#fff;color:#111827;font-weight:900;font-size:15px">Spatie</button>
        <button type="button" data-k="." style="padding:12px 0;border-radius:10px;border:0;background:#fff;color:#111827;font-weight:900;font-size:18px">.</button>
        <button type="button" data-close style="padding:12px 0;border-radius:10px;border:0;background:#9ca3af;color:#111827;font-weight:900;font-size:18px">↵</button>
      </div>`;
    document.body.appendChild(kb);
    qsa("[data-k]",kb).forEach(b=>b.onclick=()=>addText(b.dataset.k));
    kb.querySelector("[data-space]").onclick=()=>addText(" ");
    kb.querySelector("[data-backspace]").onclick=()=>{inp.value=inp.value.slice(0,-1);applyDriverSearch()};
    kb.querySelector("[data-clear]").onclick=()=>{inp.value="";applyDriverSearch()};
    kb.querySelector("[data-close]").onclick=hideKb;
    kb.querySelector("[data-close-top]").onclick=hideKb;
  }
  inp.addEventListener("focus",e=>{try{inp.blur()}catch(_e){};showKb()});
  inp.addEventListener("click",e=>{e.preventDefault();showKb()});
  inp.addEventListener("touchstart",e=>{showKb()},{passive:true});
}


async function boot(){
  try{
    await initFirebase();
    await loadInitial();
    populateUsers(userAllowed);
    $("loginBtn").onclick=()=>loginWithFilter(userAllowed,SESSION_KEY,showApp);
    $("loginPin").addEventListener("keydown",e=>{if(e.key==="Enter")loginWithFilter(userAllowed,SESSION_KEY,showApp)});
    $("logoutBtn").onclick=()=>{sessionStorage.removeItem(SESSION_KEY);try{localStorage.removeItem(DAG_SESSIE_KEY);}catch(e){}location.reload()};   // DRV-R8: uitloggen wist ook de dagsessie
   $("refreshBtn").onclick=async()=>{
  await loadPhoneData();

  if(!$("detailView").classList.contains("hidden") && CURRENT_DETAIL_ID){
    showDetail(CURRENT_DETAIL_ID);
  }else{
    render();
  }

  toast("Verversd");
};
    installSearchKeyboard();
    $("clearSearchBtn").onclick=()=>{$("searchBox").value="";applyDriverSearch()};
    $("searchBox").oninput=applyDriverSearch;
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


/* BNS v516 telefoon: realtime orders/users verversen, zonder opdrachten te mixen */
(function(){
  if(window.__BNS_V516_DRIVER_REALTIME__) return;
  window.__BNS_V516_DRIVER_REALTIME__=true;
  function start(){
    try{
      if(!BNS || !BNS.firebase || !BNS.db || BNS.__v516Live) return;
      BNS.__v516Live=true;
      BNS.firebase.onSnapshot(BNS.firebase.collection(BNS.db,"orders"), function(){
        try{ if(BNS.user) loadOrdersOnly().then(function(){ try{ render(); }catch(e){} }); }catch(e){}
      });
      BNS.firebase.onSnapshot(BNS.firebase.collection(BNS.db,"users"), function(){
        try{ loadUsersOnly().then(function(){
          if(BNS.user){
            var fresh=(BNS.state.users||[]).find(function(u){return String(u.id)===String(BNS.user.id);});
            if(!fresh || fresh.active===false || fresh.deleted===true || fresh.disabled===true){ try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){} try{ localStorage.removeItem(DAG_SESSIE_KEY); }catch(e){} location.reload(); return; }
            BNS.user=fresh;
          }
          try{ render(); }catch(e){}
        }); }catch(e){}
      });
    }catch(e){}
  }
  setTimeout(start,1200);
  setInterval(start,4000);
})();

/* BNS v648 driver: vermissing alert velden, offerte/prijzen, open opdracht layout, rode meldingknop */


/* BNS 650 - driver: vermissing verborgen, afmelden pas na einddatum. Alleen driver/driver.js. */


// ===== BNS v685: prijzenrechten hard afdwingen op bezorgertelefoon =====
(function(){
  try{ console.info('[BNS 687] Driver offertebon + toetsenbordindeling + prijzenrechten actief.'); }catch(e){}
})();

/* ==========================================================
   BNS DRV-R2 — Bezorger-app werkt zichzelf bij
   ----------------------------------------------------------
   Waarom dit nodig is:
   Op een telefoon houdt de browser bestanden vast om de app offline te laten
   werken. Staat er een nieuwe versie op de server, dan blijft het toestel de
   oude tonen - en dat is niet te zien zonder ontwikkelaarsscherm, dat je op een
   telefoon nauwelijks kunt openen. Bij een bezorger die zo vastloopt lijkt het
   alsof zijn foto's niet aankomen, terwijl hij simpelweg oude code draait.

   Wat deze module doet:
     1. zet het versienummer ZICHTBAAR in de app, zodat je het van het scherm
        kunt aflezen zonder console;
     2. haalt bij het opstarten (en daarna elk kwartier) de startpagina op
        zonder cache en vergelijkt het versienummer;
     3. is dat nieuwer, dan worden de opgeslagen kopieen gewist en laadt de app
        zichzelf opnieuw met een verse adresregel.

   Er zit een teller op het herladen: maximaal twee keer per sessie. Zo kan een
   bezorger nooit in een eindeloze herstartlus terechtkomen als er iets niet
   klopt aan de serverkant.
========================================================== */
(function bnsDriverZelfBijwerken(){
  'use strict';
  if(window.__BNS_DRV_UPDATER__) return;
  window.__BNS_DRV_UPDATER__=true;

  var HUIDIG = String(window.TAPWAGEN_DRIVER_BUILD_ID||'onbekend');
  var TELLER = 'bns_drv_herlaad_teller';
  var MAX_HERLAAD = 2;

  function tel(){ try{ return Number(sessionStorage.getItem(TELLER)||0)||0; }catch(e){ return 0; } }
  function telOp(){ try{ sessionStorage.setItem(TELLER,String(tel()+1)); }catch(e){} }

  /* Versienummer zichtbaar maken - onderin, klein, altijd afleesbaar. */
  function toonVersie(){
    try{
      var el=document.getElementById('bnsDrvVersie');
      if(!el){
        el=document.createElement('div');
        el.id='bnsDrvVersie';
        el.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:9998;'+
          'background:rgba(15,23,42,.85);color:#fff;font:11px Arial,Helvetica,sans-serif;'+
          'padding:4px 8px;text-align:center;letter-spacing:.2px';
        el.title='Versie van deze bezorger-app';
        document.body.appendChild(el);
        el.addEventListener('click', function(){ nuBijwerken(true); });
      }
      el.textContent = 'versie ' + HUIDIG + '  (tik om bij te werken)';
    }catch(e){}
  }

  async function wisOpslagKopieen(){
    try{
      if('serviceWorker' in navigator){
        var regs=await navigator.serviceWorker.getRegistrations();
        for(var i=0;i<regs.length;i++){ try{ await regs[i].unregister(); }catch(e){} }
      }
    }catch(e){}
    try{
      if(window.caches){
        var keys=await caches.keys();
        for(var j=0;j<keys.length;j++){ try{ await caches.delete(keys[j]); }catch(e){} }
      }
    }catch(e){}
  }

  function herlaadVers(){
    try{
      var basis=location.href.split('#')[0].split('?')[0];
      location.replace(basis + '?vers=' + Date.now());
    }catch(e){ try{ location.reload(); }catch(_){} }
  }

  /* Het versienummer op de SERVER opzoeken, zonder cache. */
  async function serverVersie(){
    try{
      var res=await fetch('driver.js?vers='+Date.now(), {cache:'no-store'});
      if(!res || !res.ok) return '';
      var tekst=await res.text();
      var m=tekst.match(/TAPWAGEN_DRIVER_BUILD_ID\s*=\s*['"]([^'"]+)['"]/);
      return m ? m[1] : '';
    }catch(e){ return ''; }
  }

  async function nuBijwerken(handmatig){
    var opServer=await serverVersie();
    if(!opServer){
      if(handmatig) melding('Kon de serverversie niet ophalen. Controleer de internetverbinding.');
      return false;
    }
    if(opServer===HUIDIG){
      if(handmatig) melding('Je hebt al de nieuwste versie ('+HUIDIG+').');
      return false;
    }
    if(!handmatig && tel()>=MAX_HERLAAD){
      console.warn('[BNS DRV] Nieuwere versie ('+opServer+') gezien, maar al '+tel()+'x herladen. Gestopt om een lus te voorkomen.');
      return false;
    }
    melding('Nieuwe versie gevonden ('+opServer+'). De app werkt zichzelf bij...');
    telOp();
    await wisOpslagKopieen();
    setTimeout(herlaadVers, 600);
    return true;
  }

  function melding(tekst){
    try{
      var s=document.getElementById('status');
      if(s){ s.textContent=tekst; return; }
      var t=document.getElementById('toast');
      if(t){ t.textContent=tekst; t.className='toast show'; setTimeout(function(){ t.className='toast'; },3500); return; }
    }catch(e){}
    try{ console.info('[BNS DRV] '+tekst); }catch(e){}
  }

  function start(){
    toonVersie();
    setTimeout(function(){ nuBijwerken(false); }, 2500);
    setInterval(function(){ nuBijwerken(false); }, 15*60*1000);
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState==='visible') setTimeout(function(){ nuBijwerken(false); }, 1200);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.BNS_DRV={
    versie:HUIDIG,
    bijwerken:function(){ return nuBijwerken(true); },
    wissen:async function(){ await wisOpslagKopieen(); herlaadVers(); }
  };
  try{ console.info('[BNS DRV] Zelf-bijwerken actief. Versie: '+HUIDIG); }catch(e){}
})();
