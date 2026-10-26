window.TAPWAGEN_DRIVER_BUILD_ID = 'TW-DRIVER-2026-10-26-R41';
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
/* ==========================================================
   24-10-2026 - AFMELDEN KON HIER HELEMAAL NIET.
   ----------------------------------------------------------
   Twee regels sloten elkaar precies uit: afmelden mocht pas NA de einddatum,
   en vanaf de dag NA de einddatum is de opdracht van de telefoon af (zie de
   datumcontrole in visibleOrder). De knop kwam dus vrij op het moment dat de
   opdracht verdween en was in de praktijk nooit in te drukken.
   Nu mag afmelden vanaf de einddatum ZELF: op de laatste dag meldt de
   bezorger af, de dag erna valt de opdracht vanzelf uit de werklijst.
========================================================== */
function canFinishOrderNow(o){const e=dateTime(orderEnd(o)); if(!e) return true; return todayTime()>=e}
function finishBlockedText(o){const e=orderEnd(o); return "Deze opdracht kan nog niet worden afgemeld. Afmelden kan vanaf de einddatum"+(e?" ("+niceDate(e)+")":"")+"."}
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

/* DRV-R17 (2026-09-05): een blok voor alles wat vooraf bekend moet zijn.
   De milieuzoneregel blijft precies zoals hij was; daaronder komt, alleen als
   het op de opdracht staat, wat de planner vond over autovrije zones,
   venstertijden en hoogte. De telefoon zoekt zelf nooit iets op - alles staat
   al op de opdracht, dus dit werkt ook zonder bereik. */
function waarschuwBlok(o){
  const delen=[];
  if(o && o.milieuzone) delen.push(`\u26A0\uFE0F Milieuzone: ${esc(o.milieuzone)}<div style="font-weight:600;font-size:13px;margin-top:3px">Controleer of je wagen hier mag komen.</div>`);
  if(o && o.borden)     delen.push(`\u{1F6A7} ${esc(o.borden)}<div style="font-weight:600;font-size:13px;margin-top:3px">Ter informatie, niet volledig - kijk ter plaatse.</div>`);
  if(!delen.length) return "";
  return `<div style="background:#fee2e2;color:#991b1b;border-left:5px solid #b91c1c;border-radius:10px;padding:9px 12px;margin:8px 0;font-weight:900">${delen.join('<div style="height:8px"></div>')}</div>`;
}

async function navMenu(adres, info){
  if(!String(adres||'').trim()){ toast('Bij deze opdracht staat geen adres.'); return; }
  /* DRV-R13: eerst de milieuzone-controle. Ligt er geen zone, dan komt hij
     hier meteen doorheen en merkt de bezorger er niets van. */
  try{
    if(window.BNS_DRV_MILIEUZONE){
      const door = await window.BNS_DRV_MILIEUZONE.controleer(adres);
      if(door===false) return;
    }
  }catch(e){}
  /* DRV-R17: autovrije zone, venstertijd of hoogte. Met opzet GEEN vraag welke
     wagen je rijdt - een paaltje of een voetgangersgebied geldt voor iedereen.
     En met opzet geen oordeel: we tonen wat er staat, nooit "u mag hier niet
     in". Staat er niets op de opdracht, dan komt dit scherm niet. */
  try{
    if(String(info||'').trim()){
      await askChoice('Let op bij dit adres',
        [{value:'ok', label:'Begrepen, ga verder', cls:'btn-orange'}],
        String(info)+'\n\nTer info - druk op Locatie bekijken.');
    }
  }catch(e){}
  const keuze=await askChoice('Navigatie',[
    /* DRV-R12 (2026-09-04): alle drie een eigen kleur. Eerder was alleen Waze
       groen en waren de andere twee donkergrijs, waardoor het leek alsof die
       niet actief waren. Nu is in een oogopslag te zien welke knop je pakt -
       handig met een telefoon in je hand. */
    {value:'waze',  label:'Waze',              cls:'btn-green'},
    {value:'route', label:'Route (Routenet)',  cls:'btn-orange'},
    {value:'maps',  label:'Locatie bekijken',  cls:'btn-purple'}
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
    navMenu(b.getAttribute('data-nav'), b.getAttribute('data-nav-info'));
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
  /* TW-AUTH (2026-09-08): anoniem inloggen VOORDAT er gegevens worden
     opgehaald. Zonder dit stuurt de app geen enkel bewijs mee, en dan moet de
     regel in Firestore wel op "iedereen mag lezen en schrijven" staan - anders
     werkt er niets. Alles hier loopt via deze ene functie, dus wie hier
     doorheen komt is ingelogd.
     Het pincodescherm blijft precies zoals het was; dit gebeurt op de
     achtergrond en niemand ziet het.
     Mislukt het inloggen, dan gaat de app gewoon door zoals hiervoor. Zolang
     de regels nog openstaan werkt alles dan nog steeds. */
  try{
    const authMod=await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const auth=authMod.getAuth(BNS.app);
    if(!auth.currentUser) await authMod.signInAnonymously(auth);
    window.BNS_TW_INGELOGD = !!auth.currentUser;
    try{ console.info('[TW-AUTH] Ingelogd bij Firebase:', auth.currentUser ? auth.currentUser.uid : 'niet gelukt'); }catch(e){}
  }catch(e){
    window.BNS_TW_INGELOGD=false;
    try{ console.warn('[TW-AUTH] Inloggen mislukt, app werkt door zoals voorheen:', e && e.message); }catch(x){}
  }
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
  /* 25-10-2026 - OOK EEN KOPIE VAN DE GEBRUIKER ZELF BEWAREN.
     Zie de uitleg bij restoreSession: bij een trage start is de
     gebruikerslijst er nog niet, en dan viel de bezorger terug naar het
     pinscherm. Met deze kopie kan hij alvast binnen. */
  try{
    localStorage.setItem(DAG_SESSIE_KEY, JSON.stringify({
      id:found.id, ts:Date.now(),
      user:{ id:found.id, name:found.name, role:found.role, rights:found.rights||{}, active:found.active }
    }));
  }catch(e){}
  $("loginPin").value="";
  after();
}
function dagSessie(){
  try{
    var raw=localStorage.getItem(DAG_SESSIE_KEY);
    if(!raw) return null;
    var d=JSON.parse(raw);
    if(!d || !d.id || !d.ts) return null;
    /* 25-10-2026: DAG_SESSIE_UREN op 0 betekent GEEN vervaldatum. */
    if(DAG_SESSIE_UREN>0 && Date.now()-Number(d.ts) > DAG_SESSIE_UREN*3600*1000) return null;
    return d;
  }catch(e){ return null; }
}
function dagSessieGeldig(){ var d=dagSessie(); return d ? String(d.id) : ""; }

/* ==========================================================
   25-10-2026 - NIET MEER TERUG NAAR HET PINSCHERM BIJ EEN TRAGE START.
   ----------------------------------------------------------
   [stated] "bij mij is het als ik te snel druk gaat hij terug naar het
   inlogscherm; moet ik wachten en dan opent hij weer."

   Hier stond: zoek de bewaarde bezorger op in BNS.state.users, en alleen als
   je hem daar vindt mag hij binnen. Maar deze regel loopt bij het opstarten,
   en op dat moment kan die lijst nog leeg zijn - de gegevens zijn dan nog
   onderweg. Gevolg: niets gevonden, dus geen sessie, dus pinscherm. Even
   wachten en opnieuw openen hielp, want dan was de lijst er wel. Precies wat
   hij beschreef.

   Nu wordt alleen in dat ene geval - lijst nog HELEMAAL leeg - teruggevallen
   op de kopie die bij het inloggen is bewaard. Is de lijst er wel en staat de
   bezorger er niet in, dan is hij echt verwijderd en blijft het pinscherm
   staan; die controle wordt dus niet zwakker. Komt de lijst daarna binnen,
   dan vervangt de bewaking verderop de kopie door de echte gebruiker, of logt
   alsnog uit als hij weg blijkt.
========================================================== */
function restoreSession(f,key,after){
  var d=dagSessie();
  var id=sessionStorage.getItem(key) || (d ? String(d.id) : "");
  if(!id)return;
  var lijst=(BNS.state.users||[]);
  var found=lijst.find(u=>String(u.id)===String(id));
  if(!found && !lijst.length && d && d.user && String(d.user.id)===String(id)){
    found=d.user;                                            /* lijst nog niet binnen */
  }
  if(found&&f(found)){
    BNS.user=found;
    try{ sessionStorage.setItem(key,String(found.id)); }catch(e){}   // ook deze sessie weer vullen
    after();
  }
}

const SESSION_KEY="tapwagen_driver_user_id_v143";
const DAG_SESSIE_KEY="tapwagen_driver_dagsessie_v1";   // DRV-R8
/* 25-10-2026: stond op 18 uur - een werkdag, daarna weer de PIN. [stated] hij
   wil het zoals de andere app: een keer de PIN en dan blijft hij staan. 0 is
   geen vervaldatum. Wil je het ooit terug, zet hier weer een aantal uren neer.
   Uitloggen en een bezorger in Admin weghalen werken gewoon als voorheen. */
const DAG_SESSIE_UREN=0;
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
      ${waarschuwBlok(o)}
      ${canRoute()?`<button type="button" class="btn btn-green" data-nav="${esc(routeAddress(o))}" data-nav-info="${esc(o.borden||"")}">\u{1F6E3}\uFE0F Navigatie</button>`:""}
      ${p?`<a class="btn" href="tel:${esc(p)}">Bel klant</a>`:""}
      ${canAnyReportAction()?`<button type="button" class="btn btn-red" style="background:#dc2626!important;color:#fff!important" data-report-menu="${esc(o.id)}">Melding maken</button>`:""}
      ${canQuote()?`<button type="button" class="btn btn-orange" data-quote="${esc(o.id)}">Offerte</button>`:""}
      ${canDone()?`<button type="button" class="btn btn-full ${canFinishOrderNow(o)?'btn-green':'btn-dark'} wide" data-done="${esc(o.id)}">${canFinishOrderNow(o)?'Afmelden / uitgevoerd':'Afmelden vanaf einddatum'}</button>`:""}
    </div>
  </article>`;
}

/* ==========================================================
   24-10-2026 - TWEEDE LIJST: AFGERONDE OPDRACHTEN TERUGKIJKEN.
   ----------------------------------------------------------
   Zodra een opdracht van de werklijst viel was hij voor de bezorger
   onbereikbaar - ook alles wat hij er zelf in had gezet: foto's, meldingen,
   de handtekening. Daarom een tweede lijst naast de werklijst.

   Wat er in hoort: zijn eigen opdrachten van DIT KALENDERJAAR die bevestigd
   zijn geweest en nu voorbij of afgemeld zijn. Op 1 januari is de lijst leeg
   en begint het jaar schoon. Offertes, opties, geannuleerde en verwijderde
   opdrachten horen er net zo min in als in de werklijst.

   Het is om te KIJKEN, niet om te werken: geen afmelden, geen navigatie, geen
   nieuwe foto's. Afmelden hoort bij de werklijst, en daar kan het sinds
   vandaag ook echt.

   Let op: de einddatum verandert niets aan de opdracht zelf. De status blijft
   staan; het zijn de schermen die op datum indelen - hier en op de
   Archief-pagina in de app. Dat is altijd zo geweest.
========================================================== */
var BNS_R28_TOON_AFGEROND = false;

function bnsR28IsAfgerond(o){
  if(!o) return false;
  if(isCancelled(o) || isDeleted(o)) return false;
  try{ if(typeof deletedFlag==='function' && deletedFlag(o)) return false; }catch(e){}
  var f = BNS_driverFolder(o);
  if(f!=='lopend' && f!=='uitgevoerd') return false;
  try{ if(typeof visibleOrder==='function' && visibleOrder(o)) return false; }catch(e){}
  var jaar = clean(orderEnd(o)||orderStart(o)).slice(0,4);
  if(jaar !== String(new Date().getFullYear())) return false;
  return assignedToUser(o);
}

function bnsR28AfgerondeOrders(){
  return bns518LatestOrdersByNumber(BNS.state.orders||[])
    .filter(bnsR28IsAfgerond)
    .sort((a,b)=>dateTime(orderEnd(b)||orderStart(b))-dateTime(orderEnd(a)||orderStart(a)));
}

function bnsR28AfgerondeKaart(o){
  const a=addressOf(o), s=orderStart(o), e=orderEnd(o);
  const dl = s&&e&&s!==e ? `${niceDate(s)} tot ${niceDate(e)}` : niceDate(s||e);
  const af = clean(o.doneAt||o.driverDoneAt||"").slice(0,10);
  const door = clean(o.doneBy||o.driverDoneBy||"");
  return `<article class="order-card order" data-id="${esc(o.id)}" data-search="${esc(searchIndexText(o))}" style="opacity:.92">
    <span class="order-number">${esc(o.number||"Opdracht")}</span>
    <div class="order-title">${esc(o.title||"Zonder titel")}</div>
    <div class="badges"><span class="badge">${esc(o.status||"Uitgevoerd")}</span></div>
    <div class="meta">
      <div class="meta-row"><span>\u{1F4C5}</span><div><strong>${esc(dl||"Geen datum")}</strong></div></div>
      <div class="meta-row"><span>\u{1F464}</span><div>${esc(customerName(o)||"Klant onbekend")}</div></div>
      <div class="meta-row"><span>\u{1F4CD}</span><div>${esc(a||"Adres onbekend")}</div></div>
      ${af?`<div class="meta-row"><span>\u2714\uFE0F</span><div>Afgemeld op ${esc(niceDate(af))}${door?` door ${esc(door)}`:""}</div></div>`:""}
    </div>
    <div class="action-grid">
      <button type="button" class="more-btn wide" data-detail="${esc(o.id)}">Open opdracht</button>
    </div>
  </article>`;
}

/* ---------- wat er al is vastgelegd, om te bekijken ---------- */
function bnsR28Vastgelegd(o){
  const list=(BNS.state && Array.isArray(BNS.state.alerts)) ? BNS.state.alerts : [];
  const oid=String(o&&o.id||""), onr=String(o&&o.number||"");
  return list.filter(a=>{
    if(!a) return false;
    const ai=String(a.orderId||""), an=String(a.orderNumber||"");
    return (oid&&(ai===oid||an===oid)) || (onr&&(ai===onr||an===onr));
  }).sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
}
function bnsR28Afbeelding(a){
  return (a && (a.data || a.photoData || a.signatureData || a.imageData || a.image)) || "";
}
function bnsR28ToonVastgelegd(o){
  const items=bnsR28Vastgelegd(o);
  const wrap=document.createElement("div");
  wrap.style.cssText="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:14px";
  const body = items.length ? items.map(a=>{
    const img=bnsR28Afbeelding(a);
    const wanneer=clean(a.time||"")||niceDate(clean(a.createdAt||"").slice(0,10));
    const wie=clean(a.driverName||a.from||"");
    const tekst=clean(a.note||a.text||a.message||"");
    return `<div style="border:1px solid #e2e8f0;border-radius:14px;padding:11px;margin-bottom:10px">
      <div style="font-weight:900">${esc(a.type||a.title||"Melding")}</div>
      <div style="font-size:13px;color:#64748b">${esc(wanneer)}${wie?" - "+esc(wie):""}</div>
      ${tekst?`<div style="margin-top:5px">${esc(tekst)}</div>`:""}
      ${img?`<img src="${img}" style="margin-top:8px;max-width:100%;border-radius:10px">`:""}
    </div>`;
  }).join("") : `<div style="color:#64748b">Er is bij deze opdracht niets vastgelegd.</div>`;
  wrap.innerHTML=`<div style="background:#fff;border-radius:22px;padding:16px;width:min(620px,100%);max-height:88vh;overflow:auto;box-shadow:0 24px 80px rgba(0,0,0,.35)">
    <h2 style="margin:0 0 4px;font-size:19px">Vastgelegd bij deze opdracht</h2>
    <div style="font-size:13px;color:#64748b;margin-bottom:12px">${esc(o.number||"")} ${esc(o.title||"")}</div>
    ${body}
    <button type="button" id="bnsR28Sluit" style="width:100%;margin-top:6px;padding:14px;border:0;border-radius:12px;background:#475569;color:#fff;font-weight:900;font-size:16px">Sluiten</button>
  </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector("#bnsR28Sluit").onclick=()=>wrap.remove();
  wrap.onclick=(ev)=>{ if(ev.target===wrap) wrap.remove(); };
}

/* ---------- de twee knoppen boven de lijst ---------- */
function bnsR28Balk(){
  const box = $("orders");
  if(!box) return;
  let b = document.getElementById("bnsR28Balk");
  if(!b){
    b = document.createElement("div");
    b.id = "bnsR28Balk";
    b.style.cssText = "display:flex;gap:8px;margin:10px 0";
    b.innerHTML = '<button type="button" id="bnsR28TabWerk" class="btn wide" style="flex:1"></button>'+
                  '<button type="button" id="bnsR28TabAf" class="btn wide" style="flex:1"></button>';
    box.parentNode.insertBefore(b, box);
    b.querySelector("#bnsR28TabWerk").onclick=function(){ BNS_R28_TOON_AFGEROND=false; try{ BNS_R30_ONDERHOUD=false; }catch(e){} render(); };
    b.querySelector("#bnsR28TabAf").onclick=function(){ BNS_R28_TOON_AFGEROND=true; try{ BNS_R30_ONDERHOUD=false; }catch(e){} render(); };
  }
  const w=document.getElementById("bnsR28TabWerk"), f=document.getElementById("bnsR28TabAf");
  if(w){ w.textContent="Opdrachten ("+getOrders().length+")"; w.className="btn wide "+(BNS_R28_TOON_AFGEROND?"btn-dark":"btn-green"); }
  if(f){ f.textContent="Afgerond ("+bnsR28AfgerondeOrders().length+")"; f.className="btn wide "+(BNS_R28_TOON_AFGEROND?"btn-green":"btn-dark"); }
  if(w) w.style.background='';
  if(f) f.style.background='';
  try{ bnsOhBalk(); }catch(e){}
}

function render(){
  bnsR28Balk();
  /* 25-10-2026: de rubriek Onderhoud tekent zijn eigen schermen in dezelfde
     lijst. Zie het blok onderaan dit bestand (R30). */
  if(typeof BNS_R30_ONDERHOUD!=='undefined' && BNS_R30_ONDERHOUD){ bnsOhTekenZacht(); return; }
  if(BNS_R28_TOON_AFGEROND){
    const af=bnsR28AfgerondeOrders();
    $("orders").innerHTML=af.length?af.map(bnsR28AfgerondeKaart).join(""):`<div class="empty">Nog geen afgeronde opdrachten dit jaar.</div>`;
    bindActions();
    setTimeout(applyDriverSearch,0);
    return;
  }
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
  /* 25-10-2026: de terugknop plakt nu bovenaan vast terwijl je scrolt.
     [stated] "ook mis ik een terugknop onder de pagina, boven staat er wel
     een van een opdracht maar onder dus niet en dan moet ik steeds scrollen
     naar boven." Zijn keuze was een plakkende knop boven in plaats van een
     tweede knop onderaan - dan heb je er maar een en hoef je nooit te
     scrollen. */
  return `<div class="detail-header" style="position:sticky;top:0;z-index:60;background:#fff;padding:8px 0;margin:0 0 6px;box-shadow:0 6px 10px -8px rgba(15,23,42,.45)"><button type="button" class="back-btn" data-back>Terug</button></div>
  <article class="card detail-card">
    ${fullOrderHtml(o,'Open opdracht')}
    ${more.length?`<div class="section-title">Meer artikelen / opdrachten voor deze klant</div><div class="info-box">${more.map(x=>`• ${esc(x.number||"")} ${esc(x.title||"")} - ${esc(niceDate(orderStart(x)))}`).join("<br>")}</div>`:""}
    ${bnsR28IsAfgerond(o)?`
    <div class="section-title">Afgeronde opdracht</div>
    <div class="report-grid">
      <button type="button" class="btn btn-purple wide" data-bns-vastgelegd="${esc(o.id)}">Foto's en handtekening bekijken (${bnsR28Vastgelegd(o).length})</button>
    </div>`:`
    <div class="section-title">Acties</div>
    <div class="report-grid">
      ${waarschuwBlok(o)}
      ${canRoute()?`<button type="button" class="btn btn-green" data-nav="${esc(routeAddress(o))}" data-nav-info="${esc(o.borden||"")}">\u{1F6E3}\uFE0F Navigatie</button>`:""}
      ${p?`<a class="btn" href="tel:${esc(p)}">Bel klant</a>`:""}
      ${canAnyReportAction()?`<button type="button" class="btn btn-red wide" style="background:#dc2626!important;color:#fff!important" data-report-menu="${esc(o.id)}">Melding maken</button>`:""}
      ${canQuote()?`<button type="button" class="btn btn-orange" data-quote="${esc(o.id)}">Offerte</button>`:""}
      ${canDone()?`<button type="button" class="btn btn-full ${canFinishOrderNow(o)?'btn-green':'btn-dark'} wide" data-done="${esc(o.id)}">${canFinishOrderNow(o)?'Afmelden / uitgevoerd':'Afmelden vanaf einddatum'}</button>`:""}
    </div>`}
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
    wrap.innerHTML=`<div style="background:#fff;border-radius:22px;padding:16px;width:min(560px,100%);box-shadow:0 24px 80px rgba(0,0,0,.35);max-height:86vh;overflow-y:auto;-webkit-overflow-scrolling:touch"><h2 style="margin-top:0;position:sticky;top:0;background:#fff;padding:2px 0 8px">${esc(title)}</h2><label style="font-weight:900">${esc(label||"Tekst")}</label><textarea id="twAskText" rows="5" style="margin-top:8px;width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:12px;font-size:16px"></textarea><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><button id="twAskCancel" type="button" class="btn-dark">Annuleren</button><button id="twAskSave" type="button" class="btn-green">Versturen</button></div></div>`;
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
    wrap.innerHTML=`<div style="background:#fff;border-radius:22px;padding:16px;width:min(560px,100%);box-shadow:0 24px 80px rgba(0,0,0,.35);max-height:86vh;overflow-y:auto;-webkit-overflow-scrolling:touch"><h2 style="margin-top:0;position:sticky;top:0;background:#fff;padding:2px 0 8px">${esc(title)}</h2>${subtitel?`<div style="background:#f1f5f9;border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:14px;white-space:pre-line">${esc(subtitel)}</div>`:""}${rows}<button type="button" id="twChoiceCancel" class="btn-dark" style="width:100%;margin-top:10px">Annuleren</button></div>`;
    document.body.appendChild(wrap);
    qsa("[data-choice]",wrap).forEach(b=>b.onclick=()=>{const v=b.dataset.choice;wrap.remove();resolve(v)});
    wrap.querySelector("#twChoiceCancel").onclick=()=>{wrap.remove();resolve("")};
  });
}
async function openReportChoice(order){
  const opts=[];
  if(canReport()) opts.push({value:"Melding",label:"Algemene melding",cls:"btn-orange"});
  /* 25-10-2026: [stated] "daar maken we nu een rubriek met reparatie." */
  if(typeof bnsOhMag==='function' && bnsOhMag()) opts.push({value:"Reparatie",label:"Reparatie / onderhoud",cls:"btn-dark"});
  if(canDamage()) opts.push({value:"Schade",label:"Schade",cls:"btn-red"},{value:"Storing",label:"Storing",cls:"btn-purple"});
  /* DRV-R6 (2026-08-27): sleutels apart, want dat is het probleem dat het vaakst
     terugkomt - sleutels die niet retour zijn. En een knop om een melding weer
     op te lossen, zodat de planner ziet dat het geregeld is. */
  opts.push({value:"Sleutels",label:"Sleutels afgeven",cls:"btn-dark"});
  if(openMeldingenVoor(order).length) opts.push({value:"Opgelost",label:"Melding oplossen",cls:"btn-green"});
  const type=await askChoice("Melding maken",opts);
  if(type==="Reparatie") return bnsOhReparatieMelden(order);
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

  /* ==========================================================
     25-10-2026 - VRAGEN OM WELK OBJECT HET GAAT.
     ----------------------------------------------------------
     [stated] "een bezorger moet een extra vakje krijgen bij rubriek
     schademelding maken / schade, storing, algemene melding, met de vraag
     welk materiaal nr, bv tw."
     Tot nu toe werd alleen het opdrachtnummer bewaard, dus kon je later niet
     zien WELK ding kapot was. De klant stond er al in. Vanaf nu wordt het
     object erbij gevraagd en meegeschreven, zodat het schadeverleden per
     wagen en per materiaal klopt. Weet hij het niet, dan kan hij overslaan -
     liever een melding zonder object dan geen melding.
  ========================================================== */
  let gekozenObject = null;
  try{
    const objs = await bnsOhObjectenHalen();
    if(Array.isArray(objs) && objs.length){
      const opts = objs.slice(0,40).map(function(o){
        const nr = [clean(o.twnr), clean(o.kenteken)].filter(Boolean).join(' / ');
        return { value: String(o.id), label: clean(o.naam) + (nr ? ' - ' + nr : ''), cls: 'btn-dark' };
      });
      opts.push({ value: '', label: 'Weet ik niet / niet van toepassing', cls: 'btn-grey' });
      const keus = await askChoice('Om welk object gaat het?', opts);
      if(keus) objs.forEach(function(o){ if(String(o.id) === String(keus)) gekozenObject = o; });
    }
  }catch(e){}

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
    objectId: gekozenObject ? String(gekozenObject.id) : "",
    objectNaam: gekozenObject ? clean(gekozenObject.naam) : "",
    objectNummer: gekozenObject ? [clean(gekozenObject.twnr), clean(gekozenObject.kenteken)].filter(Boolean).join(' / ') : "",
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
    /* 24-10-2026: bij een afgeronde opdracht niets toevoegen waarmee je iets
       NIEUWS maakt - daar wordt gekeken, niet gewerkt. [stated] "het lijkt
       erop dat ik nog een foto dien te maken ... er zou dus uit het archief
       iets van bewijs moeten komen." */
    try{ var ord=findOrder(id); if(ord && bnsR28IsAfgerond(ord)) return; }catch(e){}
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
  qsa("[data-bns-vastgelegd]").forEach(b=>{b.onclick=()=>{const o=findOrder(b.getAttribute("data-bns-vastgelegd")); if(o)bnsR28ToonVastgelegd(o)}});
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
    /* 25-10-2026: meeluisteren op het overzichtje van openstaande reparaties,
       zodat de rode knop en de lijst vanzelf meelopen. */
    try{ setTimeout(bnsOhMeeluisteren, 2000); }catch(e){}
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
            /* ==========================================================
               25-10-2026 - NIET MEER UITLOGGEN OP EEN HIKJE.
               ----------------------------------------------------------
               [stated] "bij mij is het als ik te snel druk gaat hij terug
               naar inlogscherm, moet ik wachten en dan opent hij weer."

               Hier stond: vind ik mijn gebruiker niet in de lijst, dan is hij
               verwijderd - dagsessie wissen en herladen. Maar er werd nergens
               gekeken of die lijst UBERHAUPT iets bevatte. Kwam er door een
               traag moment of even geen bereik een lege of halve lijst binnen,
               dan was de conclusie "die bestaat niet meer" en vloog je terug
               naar de pin. In de eerste seconden na het openen is die lijst
               nog onderweg; vandaar dat het juist gebeurde als hij snel drukte.

               Nu twee sloten:
                 1. een lege lijst zegt niets - dan gebeurt er niets
                 2. pas uitloggen als hij twee keer op rij ontbreekt
               Ben je echt uit Admin gehaald, dan word je nog steeds uitgelogd,
               alleen een rondje later.
            ========================================================== */
            var lijst=(BNS.state.users||[]);
            if(!lijst.length){ try{ render(); }catch(e){} return; }
            var fresh=lijst.find(function(u){return String(u.id)===String(BNS.user.id);});
            var weg = (!fresh || fresh.active===false || fresh.deleted===true || fresh.disabled===true);
            if(weg){
              window.__bnsWegTeller = (window.__bnsWegTeller||0) + 1;
              if(window.__bnsWegTeller < 2){ return; }      /* eerste keer: even afwachten */
              try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
              try{ localStorage.removeItem(DAG_SESSIE_KEY); }catch(e){}
              location.reload(); return;
            }
            window.__bnsWegTeller = 0;
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

/* ==========================================================
   BNS DRV-R13 — Milieuzone-controle op de telefoon
   ----------------------------------------------------------
   Bij het openen van Navigatie kijkt de app eerst of het adres in een milieu-
   of zero-emissiezone ligt. Ligt er niets - verreweg de meeste ritten - dan
   verschijnt gewoon het navigatiemenu en merkt de bezorger er niets van.

   Ligt er wel een zone, dan komt eerst de vraag met welke wagen hij rijdt. Die
   vraag komt elke rit opnieuw: er wordt vaak van auto gewisseld, en juist bij
   een zone mag daar geen aanname in sluipen. Daarna volgt het oordeel, dat hij
   moet bevestigen voordat hij verder kan. Doorrijden blijft mogelijk - soms moet
   je er heen om te overleggen of buiten de zone te laden - maar niet zonder dat
   hij het gelezen heeft.

   Dit bestand staat helemaal los van de plannerapp, dus alles wat daar al werkt
   is hier opnieuw opgebouwd: de zones inlezen, het adres omzetten via de
   adressenzoeker van de overheid, de voertuigenlijst, en het rekenen.
========================================================== */
(function bnsDrvMilieuzone(){
  'use strict';
  if(window.__BNS_DRV_MZ__) return;
  window.__BNS_DRV_MZ__=true;

  var ZONES='milieuzones.json';                 // in de hoofdmap; de telefoon zit in /driver
  var PDOK='https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=1&fq=type:adres&q=';
  var zones=null, voertuigen=null;

  function T(v){ return String(v==null?'':v).trim(); }

  function laadZones(){
    if(zones) return Promise.resolve(zones);
    return fetch('../'+ZONES).then(function(r){ return r.json(); })
      .catch(function(){ return fetch(ZONES).then(function(r){ return r.json(); }); })
      .then(function(d){ zones=(d&&d.zones)||[]; return zones; })
      .catch(function(){ zones=[]; return zones; });
  }

  /* De voertuigen worden door de planner beheerd en meegestuurd in de
     instellingen. Lukt dat niet, dan blijft de lijst leeg en slaan we de vraag
     over in plaats van de bezorger op te houden. */
  /* DRV-R15-fix (2026-09-04): hier ging het mis. De lijst werd uit het geheugen
     van de telefoon gehaald, maar die staat alleen op het apparaat waar OOK de
     planner draait - op de laptop dus. Op een telefoon was hij leeg, en erger:
     die lege uitkomst werd onthouden, zodat de vraag daarna nooit meer kwam.

     Nu wordt de lijst rechtstreeks bij Firebase opgehaald, waar de planner hem
     neerzet. En een leeg antwoord wordt NIET onthouden: de volgende keer wordt
     er gewoon opnieuw gekeken. */
  function laadVoertuigen(opnieuw){
    /* R26: `opnieuw` vraagt om verse gegevens. Zonder dat blijft de lijst in
       het geheugen staan zolang de pagina open is, en dat is prima binnen een
       sessie - bij het opstarten wordt hij hoe dan ook opgehaald. */
    if(!opnieuw && voertuigen && voertuigen.length) return Promise.resolve(voertuigen);

    function uitState(){
      try{
        var s=BNS.state && BNS.state.settings;
        var l=(s && (s.voertuigen || (s.main && s.main.voertuigen))) || null;
        if(Array.isArray(l) && l.length) return l;
      }catch(e){}
      return null;
    }
    function uitOpslag(){
      try{
        var lok=JSON.parse(localStorage.getItem('bns_voertuigen')||'[]');
        if(Array.isArray(lok) && lok.length) return lok;
      }catch(e){}
      return null;
    }

    /* DRV-R24 (2026-09-05): een lijst die van voor vandaag is, mist de
       toelatingsdatum. Daarmee zou de telefoon bij elke wagen zeggen dat de
       gegevens niet volledig zijn, terwijl ze in Admin allang ingevuld staan.
       Ontbreekt die datum overal, dan negeren we het bewaarde lijstje en halen
       we hem opnieuw op. Zo lost elke telefoon dit zelf op; niemand hoeft
       langs de toestellen. */
    function compleet(l){
      return Array.isArray(l) && l.some(function(v){ return v && T(v.det); });
    }
    /* ==========================================================
       R26 (17-9-2026) - ALTIJD EERST BIJ FIREBASE KIJKEN.
       ----------------------------------------------------------
       WAT ER MIS WAS. Deze telefoon gebruikte zijn BEWAARDE lijst zodra die er
       was, en keek dan niet verder. Gevolg: wat de planner wijzigt komt hier
       nooit aan. [stated] hij zette wagens op rood ("niet zichtbaar voor de
       bezorgers") en zag ze op de telefoon gewoon staan. Hetzelfde gold voor
       een VERKOCHTE wagen: die haal je bij Voertuigen weg en hij bleef hier
       staan - [stated] "als ik hem wis in voertuigen zou hij normaal weg moeten
       gaan uit de lijst en telefoon".
       Die bewaarde lijst was bedoeld voor onderweg zonder bereik. Maar [stated]
       zijn tegenwerping snijdt hout: "als een bezorger geen bereik heeft is er
       ook geen navigatie en werkt de voertuiglijst ook niet". Die kopie helpt
       dus nauwelijks, en hij zat wel altijd in de weg.
       Nu andersom: er wordt ALTIJD eerst bij Firebase gekeken, en de bewaarde
       kopie is nog slechts een laatste redmiddel als dat echt mislukt. Hij
       wordt daarbij ook steeds bijgewerkt, zodat die terugval nooit ouder is
       dan de laatste keer met bereik.
       De bezorgers moeten hun telefoon na het plaatsen een keer verversen;
       daarna gaat het vanzelf.
    ========================================================== */
    var oudLijstje = uitState() || uitOpslag();   // alleen achter de hand

    /* Altijd bij Firebase kijken, in de instellingen. */
    return (async function(){
      try{
        if(!BNS.db) await initFirebase();
        const fs=BNS.firebase;
        const snap=await fs.getDocs(fs.collection(BNS.db,'settings'));
        /* ==========================================================
           R27 (17-9-2026) - EEN LEGE LIJST IS OOK EEN ANTWOORD.
           ----------------------------------------------------------
           Tot nu toe telde een lijst alleen mee als er wagens in stonden
           (`data.lijst.length`). Zette de planner ALLE wagens op rood, dan
           kwam hier een lege lijst binnen, werd die genegeerd, en viel de
           telefoon terug op het oude lijstje met alles erin. [stated] "het
           moet zo zijn: geen kentekens geen melding, dus is hij leeg ziet de
           bezorger geen kentekens."
           Nu telt de aanwezigheid van de lijst, niet de lengte: staat er in
           `settings/voertuigen` een lege lijst, dan is dat het antwoord en
           toont de telefoon geen wagens.
        ========================================================== */
        let gevonden=null;
        snap.docs.forEach(function(d){
          const data=d.data()||{};
          if(d.id==='voertuigen' && Array.isArray(data.lijst)) gevonden=data.lijst;
          if(gevonden===null && Array.isArray(data.voertuigen)) gevonden=data.voertuigen;
        });
        if(Array.isArray(gevonden)){
          voertuigen=gevonden;
          try{ localStorage.setItem('bns_voertuigen', JSON.stringify(gevonden)); }catch(e){}
          return voertuigen;
        }
      }catch(e){}
      /* Firebase onbereikbaar: dan liever het oude lijstje dan helemaal niets.
         Er staat dan "gegevens niet volledig", en dat is eerlijk. */
      if(oudLijstje && oudLijstje.length){ voertuigen=oudLijstje; return voertuigen; }
      return [];                      // bewust NIET onthouden
    })();
  }

  function zoekAdres(adres){
    return fetch(PDOK+encodeURIComponent(T(adres)))
      .then(function(r){ return r.json(); })
      .then(function(d){
        var doc=(d&&d.response&&d.response.docs&&d.response.docs[0])||null;
        if(!doc) return null;
        var m=String(doc.centroide_ll||'').match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
        if(!m) return null;
        return {lon:parseFloat(m[1]), lat:parseFloat(m[2]), naam:T(doc.weergavenaam)};
      }).catch(function(){ return null; });
  }

  function binnen(lat, lon, ring){
    var raak=false;
    for(var i=0, j=ring.length-1; i<ring.length; j=i++){
      var bi=ring[i][0], li=ring[i][1], bj=ring[j][0], lj=ring[j][1];
      if(((bi>lat)!==(bj>lat)) && (lon < (lj-li)*(lat-bi)/(bj-bi)+li)) raak=!raak;
    }
    return raak;
  }
  function zonesOpPunt(lat, lon){
    return (zones||[]).filter(function(z){
      return (z.vlakken||[]).some(function(v){ return binnen(lat, lon, v); });
    });
  }

  function uitstootvrij(v){ return /elektri|waterstof/.test(T(v&&v.brandstof).toLowerCase()); }

  /* ----------------------------------------------------------
     DRV-R19 (2026-09-05): de OVERGANGSREGELING voor zero-emissiezones.

     Hiervoor stond hier een regel die zei: is het een zero-emissiezone en is
     de wagen niet elektrisch, dan "mag hier NIET komen". Dat is onjuist en het
     kwam ook echt fout uit in Leiden - een euro 6 mag daar nog jaren in. Er
     loopt een landelijke overgangsregeling en die hangt op de emissieklasse,
     de Datum Eerste Toelating en het soort voertuig.

     De regels (stand 2026-09-05, bron: opwegnaarzes.nl / Ondernemersplein):
       bestelauto (t/m 3500 kg)   euro 4 of lager  geen toegang
                                  euro 5           tot 1-1-2027
                                  euro 6           tot 1-1-2028
       vrachtauto  bakwagen       euro 6, DET 2017 t/m 2019   tot 1-1-2028
                                  euro 6, DET 2020 t/m 2024   tot 1-1-2030
                   oplegtrekker   euro 6, DET 2017 t/m 2024   tot 1-1-2030
       alles met een DET vanaf 1-1-2025 moet uitstootvrij zijn.

     Het kabinet heeft besloten de termijn voor euro 6 bestelauto's met een
     jaar te verlengen naar 1-1-2029, maar dat geldt pas als het RVV daarop is
     aangepast. Daarom rekenen we met 2028 en NOEMEN we 2029 - niet andersom.

     Wat we NIET kunnen zien: vrijstellingen op carrosseriecode, voertuigen van
     veertig jaar en ouder, en ontheffingen die bij de RDW zijn aangevraagd.
     Daarom noemen we een datum en geven we nooit een garantie.
  ---------------------------------------------------------- */
  /* DRV-R21 (2026-09-05): deze datums staan NIET meer vast. De planner kan ze
     in Admin aanpassen als een termijn verschuift, en de telefoon leest ze mee
     uit de instellingen - dezelfde weg als de voertuigenlijst. Lukt dat niet,
     dan gelden de waarden hieronder, de stand van 5 september 2026. */
  var ZE_EIND={ euro5best:'2027-01-01', euro6best:'2028-01-01',
                euro6bak0:'2028-01-01', euro6laat:'2030-01-01' };

  function laadZeDatums(){
    function neem(o){
      if(!o) return false;
      var raak=false;
      Object.keys(ZE_EIND).forEach(function(k){
        if(/^\d{4}-\d{2}-\d{2}$/.test(T(o[k]))){ ZE_EIND[k]=T(o[k]); raak=true; }
      });
      return raak;
    }
    try{ if(neem(BNS.state && BNS.state.settings && BNS.state.settings.zeDatums)) return Promise.resolve(ZE_EIND); }catch(e){}
    try{ if(neem(JSON.parse(localStorage.getItem('bns_ze_datums')||'null'))) return Promise.resolve(ZE_EIND); }catch(e){}
    return (async function(){
      try{
        if(!BNS.db) await initFirebase();
        const fs=BNS.firebase;
        const snap=await fs.getDocs(fs.collection(BNS.db,'settings'));
        let gevonden=null;
        snap.docs.forEach(function(d){
          const data=d.data()||{};
          if(d.id==='zedatums') gevonden=data;
          if(!gevonden && data.zeDatums) gevonden=data.zeDatums;
        });
        if(neem(gevonden)){
          try{ localStorage.setItem('bns_ze_datums', JSON.stringify(ZE_EIND)); }catch(e){}
        }
      }catch(e){}
      return ZE_EIND;                 // mislukt het, dan de ingebouwde waarden
    })();
  }

  function detDatum(v){
    var s=T(v&&v.det).replace(/\D/g,'');
    if(s.length!==8) return null;
    return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8);
  }
  function isVracht(v){
    var m=parseInt(T(v&&v.massa).replace(/\D/g,''),10);
    return !!(m && m>3500);
  }
  function isTrekker(v){ return /trekker/i.test(T(v&&v.inrichting)); }

  function resterend(tot){
    var nu=new Date(), eind=new Date(tot+'T00:00:00');
    /* Dichtbij de datum in DAGEN tellen. In hele maanden zou hij op 31
       december nog "ongeveer een maand" zeggen, en juist dan moet het scherp
       zijn. Vanaf zes weken mag het weer grof. */
    var dagen=Math.ceil((eind-nu)/86400000);
    if(dagen<=0)  return '';
    if(dagen===1) return 'nog vandaag, morgen niet meer';
    if(dagen<=45) return 'nog '+dagen+' dagen';
    var mnd=(eind.getFullYear()-nu.getFullYear())*12 + (eind.getMonth()-nu.getMonth());
    if(mnd<12) return 'nog ongeveer '+mnd+' maanden';
    var jr=Math.floor(mnd/12), rest=mnd%12;
    if(rest<3)  return 'nog ruim '+jr+' jaar';
    if(rest>=9) return 'nog bijna '+(jr+1)+' jaar';
    return 'nog ruim '+jr+' jaar en '+rest+' maanden';
  }
  function nlDatum(d){
    var mnd=['januari','februari','maart','april','mei','juni','juli','augustus',
             'september','oktober','november','december'];
    var p=d.split('-');
    return parseInt(p[2],10)+' '+mnd[parseInt(p[1],10)-1]+' '+p[0];
  }

  /* Geeft terug tot wanneer deze wagen de zero-emissiezones nog in mag. */
  function zeToegang(v){
    /* DRV-R22 (2026-09-05): zero-emissiezones gelden voor bestel- en
       vrachtauto's. Een personenauto - een pick-up staat soms zo op kenteken -
       valt er buiten. Zonder deze regel zou daar een onterechte beperking op
       komen te staan. */
    if(/personenauto/i.test(T(v&&v.soort)))
      return {tot:'-', wat:'personenauto',
              tekst:'dit is een personenauto; de zero-emissiezone geldt voor bestel- en vrachtauto\'s'};
    var euro=parseInt(T(v&&v.euronorm).replace(/\D/g,''),10);
    var det=detDatum(v);
    var wat=isVracht(v) ? (isTrekker(v)?'oplegtrekker':'bakwagen') : 'bestelauto';
    if(!euro || !det) return {tot:null, wat:wat,
      tekst:'de gegevens van deze wagen zijn niet volledig'+
            (!euro?' (emissieklasse onbekend)':'')+(!det?' (toelatingsdatum onbekend)':'')+
            ' - controleer zelf of hij hier mag komen'};
    if(det>='2025-01-01') return {tot:'', wat:wat,
      tekst:'op kenteken gezet in '+det.slice(0,4)+'; voertuigen van 2025 en later moeten uitstootvrij zijn'};
    var tot=null;
    if(!isVracht(v)){
      if(euro>=6) tot=ZE_EIND.euro6best;
      else if(euro===5) tot=ZE_EIND.euro5best;
    } else if(euro>=6 && det>='2017-01-01'){
      tot = isTrekker(v) ? ZE_EIND.euro6laat
          : (det<='2019-12-31' ? ZE_EIND.euro6bak0 : ZE_EIND.euro6laat);
    }
    if(!tot) return {tot:'', wat:wat,
      tekst:'euro '+euro+' '+wat+' uit '+det.slice(0,4)+': valt niet onder de overgangsregeling'};
    var vandaag=new Date().toISOString().slice(0,10);
    var basis='euro '+euro+' '+wat+' uit '+det.slice(0,4);
    if(tot<=vandaag) return {tot:tot, verlopen:true, wat:wat,
      tekst:basis+': de overgangsregeling liep af op '+nlDatum(tot)};
    var staart=(!isVracht(v) && euro>=6)
      ? '\nHet kabinet wil dit verlengen tot 1 januari 2029.' : '';
    return {tot:tot, wat:wat,
      tekst:basis+': toegang tot '+nlDatum(tot)+', '+resterend(tot)+'.'+staart};
  }

  /* ----------------------------------------------------------
     DRV-R23 (2026-09-05): kijk naar wat de ZONE ZELF zegt.

     Bij elke zone staat in het bestand op welke brandstoffen hij slaat en voor
     welke voertuigcategorieen hij geldt. Dat gebruikten we niet, en dat ging
     twee kanten op mis:

       te veel waarschuwen - zeventien van de twintig gewone milieuzones gelden
       alleen voor diesel, dus een benzine- of lpg-bus kreeg daar een rode
       melding die nergens op sloeg. LEZ Haarlem geldt zelfs alleen voor
       personenauto's en bussen, niet voor een bestelwagen.

       te weinig waarschuwen, en dat is het gevaarlijkst - drie zones staan als
       gewone milieuzone in het bestand maar laten alleen accu en waterstof
       toe. Dat zijn in de praktijk zero-emissiezones. Daar zei de app "euro 6
       voldoet, goede reis" terwijl er alleen elektrisch in mag.

     Daarom bepalen we het soort zone voortaan aan de brandstoffen die hij
     toelaat, en niet alleen aan het label dat erbij staat.
  ---------------------------------------------------------- */
  function brandstofVan(v){
    var b=T(v&&v.brandstof).toLowerCase();
    if(/elektri/.test(b))    return 'elektrisch';
    if(/waterstof/.test(b))  return 'waterstof';
    if(/diesel/.test(b))     return 'diesel';
    if(/lpg|gas|cng|lng/.test(b)) return 'gas';
    if(/benzine/.test(b))    return 'benzine';
    return '';
  }
  function categorieVan(v){
    var s=T(v&&v.soort).toLowerCase();
    if(/personenauto/.test(s)) return 'm';
    if(/bedrijfsauto|vrachtauto|bestelauto|aanhang|oplegger/.test(s)) return 'n';
    return '';
  }
  function zoneBrandstoffen(z){
    return ((z && z.brandstoffen)||[]).map(function(x){ return String(x).toLowerCase(); });
  }
  function isZeroZone(z){
    if(z && z.soort==='zero') return true;
    var br=zoneBrandstoffen(z);
    return br.length>0 && br.every(function(x){ return /battery|hydrogen|elektr|waterstof/.test(x); });
  }
  /* Geldt deze zone uberhaupt voor dit soort voertuig? */
  function raaktVoertuig(v, z){
    var cats=((z && z.categorieen)||[]).map(function(x){ return String(x).toLowerCase(); });
    var c=categorieVan(v);
    if(!c || !cats.length) return true;                 // onbekend: niet wegredeneren
    return cats.some(function(x){ return x.charAt(0)===c; });
  }

  function oordeel(v, z){
    var vandaag=new Date().toISOString().slice(0,10);
    var nogNiet=z.vanaf && z.vanaf>vandaag;
    if(!raaktVoertuig(v, z))
      return {mag:true, tekst:'deze zone geldt niet voor dit soort voertuig'};
    if(isZeroZone(z)){
      if(uitstootvrij(v)) return {mag:true, tekst:'uitstootvrij, dus altijd toegestaan'};
      var t=zeToegang(v);
      var slot='\n\nVrijstellingen en ontheffingen kunnen wij niet zien; twijfel je, overleg met de planner.';
      if(t.tot===null) return {mag:null, tekst:t.tekst};
      if(t.tot==='-')  return {mag:true, tekst:t.tekst};
      if(t.tot==='' || t.verlopen) return {mag:false, nogNiet:nogNiet, tekst:t.tekst+slot};
      return {mag:true, tekst:t.tekst+slot};
    }
    /* Een gewone milieuzone die alleen op diesel slaat, raakt een benzine-,
       lpg- of elektrische wagen niet. */
    var br=zoneBrandstoffen(z);
    if(br.length && br.indexOf('diesel')>=0 && brandstofVan(v) && brandstofVan(v)!=='diesel')
      return {mag:true, tekst:'deze milieuzone geldt alleen voor diesel'};
    var nodig=z.euro||0;
    var heeft=parseInt(T(v&&v.euronorm).replace(/\D/g,''),10);
    if(!nodig || !heeft) return {mag:null, tekst:'eis of emissieklasse onbekend - controleer zelf'};
    if(heeft>=nodig) return {mag:true, tekst:'euro '+heeft+' voldoet (eis: euro '+nodig+')'};
    return {mag:false, nogNiet:nogNiet, tekst:'euro '+heeft+' is te laag, deze zone eist euro '+nodig};
  }

  function kiesVoertuig(){
    return laadVoertuigen().then(function(l){
      if(!l.length) return null;
      var opts=l.map(function(v){
        return {value:T(v.kenteken),
                label:T(v.naam)+' - '+T(v.kenteken)+(v.euronorm?' (euro '+v.euronorm+')':''),
                cls:'btn-dark'};
      });
      return askChoice('Met welke wagen rijd je?', opts, 'Dit adres ligt in een milieuzone.')
        .then(function(k){ return l.filter(function(v){ return T(v.kenteken)===T(k); })[0]||null; });
    });
  }

  /* Geeft true terug als er doorgereden mag worden naar het navigatiemenu. */
  function controleer(adres){
    /* DRV-R21: de toegangsdatums ophalen voordat er een oordeel valt. */
    return Promise.resolve(laadZeDatums()).then(laadZones).then(function(){
      if(!zones.length) return true;                 // geen gegevens: niet in de weg lopen
      return zoekAdres(adres).then(function(plek){
        if(!plek) return true;                       // adres onbekend: doorlaten
        var raak=zonesOpPunt(plek.lat, plek.lon);
        if(!raak.length) return true;                // geen zone: gewoon door
        return kiesVoertuig().then(function(v){
          if(!v){
            return askChoice('Milieuzone',
              [{value:'ok', label:'Begrepen, ga verder', cls:'btn-orange'}],
              'Dit adres ligt in: '+raak.map(function(z){return z.naam;}).join(', ')+
              '\nControleer zelf of je wagen hier mag komen.').then(function(){ return true; });
          }
          var slecht=raak.map(function(z){ return {z:z, o:oordeel(v,z)}; })
                         .filter(function(x){ return x.o.mag===false && !x.o.nogNiet; });
          var onzeker=raak.map(function(z){ return {z:z, o:oordeel(v,z)}; })
                          .filter(function(x){ return x.o.mag===null; });
          var tekst, knop;
          if(slecht.length){
            tekst='LET OP\n\n'+T(v.naam)+' mag hier NIET komen.\n'+
                  slecht[0].z.naam+' - '+slecht[0].o.tekst+'\n\nOverleg met de planner voordat je rijdt.';
            knop=[{value:'ok', label:'Ik heb dit gelezen, ga verder', cls:'btn-red'}];
          } else if(onzeker.length){
            tekst='Dit adres ligt in: '+raak.map(function(z){return z.naam;}).join(', ')+
                  '\n\n'+onzeker[0].o.tekst;
            knop=[{value:'ok', label:'Begrepen, ga verder', cls:'btn-orange'}];
          } else {
            /* DRV-R19: de reden erbij. Bij een zero-emissiezone staat daar de
               datum tot wanneer deze wagen er nog in mag - juist dat wil de
               bezorger weten, en het is de kern van de reparatie. */
            var reden=(raak.map(function(z){ return oordeel(v,z); })
                          .filter(function(o){ return T(o.tekst); })[0]||{}).tekst||'';
            tekst=T(v.naam)+' mag hier komen.\n'+raak[0].naam+(reden?'\n\n'+reden:'');
            knop=[{value:'ok', label:'Goede reis, ga verder', cls:'btn-green'}];
          }
          return askChoice('Milieuzone', knop, tekst).then(function(){ return true; });
        });
      });
    }).catch(function(){ return true; });
  }

  window.BNS_DRV_MILIEUZONE={
    controleer:controleer,
    zones:laadZones,
    voertuigen:laadVoertuigen
  };
  try{ console.info('[BNS DRV R13] Milieuzone-controle actief bij Navigatie.'); }catch(e){}
})();

/* ==========================================================
   BNS TW R30 - ONDERHOUD OP DE BEZORGERSTELEFOON (25-10-2026)
   ----------------------------------------------------------
   [stated] "deze knop moet ook bij de bezorg telefoon komen zodat een
   bezorger er ook iets kan invullen en of een melding kan maken en inzien,
   altijd." En: "als de nieuwe knop met kleur kan, dus geen melding is hij
   groen met 0 meldingen, en is er een reparatieverzoek dan rood met ...
   melding. Deze optie moet via admin bij personeel aangevinkt worden als hij
   dit mag gebruiken; vink ik hem niet aan, ziet hij hem niet."

   Dus: een derde knop naast Opdrachten en Afgerond. Groen met het aantal 0,
   rood met het aantal zodra er iets openstaat. Zonder het recht `onderhoud`
   uit Admin > Personeel verschijnt de knop helemaal niet.

   WAT DE BEZORGER MAG.
   [stated] toevoegen en zijn eigen regel aanpassen; wissen doet de planner.
   Dat is hier precies zo: toevoegen mag altijd, afmelden mag altijd (ook de
   planner kan dat), wijzigen alleen bij een regel die hij zelf heeft gezet en
   die nog niet is afgemeld. Een wisknop is er niet.

   WAAR DE GEGEVENS VANDAAN KOMEN.
   Dezelfde plekken als in Admin: de objectenlijst uit settings/
   onderhoud_objecten, en de regels per object uit onderhoud/<object-id>. Die
   regels worden PAS opgehaald als je dat object opent, zodat de telefoon bij
   het starten niets extra's binnenhaalt.

   SCHADEVERLEDEN.
   [stated] "als je op bv knop schade verleden drukt dat hij dan ook aangeeft
   welke klant de schade heeft gemaakt en pas als je erop drukt dat hij dan
   pas de gegevens ophaalt."
   De klantnaam zit al in elke melding, dus die kan altijd getoond worden. De
   FOTO wordt pas in beeld gebracht als je op die ene melding tikt - tien
   foto's tegelijk tekenen is wat de telefoon traag maakt.
   Welk object een melding betrof werd tot nu toe nergens vastgelegd; vanaf nu
   vraagt de meldingsknop daarom eerst om het object. Oudere meldingen worden
   gekoppeld via het kenteken dat op de opdracht stond - zo goed als het gaat.
========================================================== */
var BNS_R30_ONDERHOUD = false;          /* staat de rubriek open? */
var bnsOhScherm = 'lijst';              /* lijst | boek | schade */
var bnsOhObject = '';                   /* welk object openstaat */
var bnsOhZoek = '';
var bnsOhObjecten = null;               /* null = nog niet opgehaald */
var bnsOhRegels = {};                   /* per object-id */
var bnsOhBezig = {};
var bnsOhFoto = '';                     /* welke melding zijn foto laat zien */
/* 25-10-2026: per object hoeveel punten er openstaan, uit settings/onderhoud_open.
   Daarmee weet de telefoon welke paar objecten hij moet ophalen in plaats van
   alle 169. Zie de uitleg aan de Admin-kant. */
var bnsOhTellers = null;
var bnsOhVastePunten = null;   /* de vaste puntenlijst uit Admin */

function bnsOhMag(){ try{ return hasRight('onderhoud') || lower(BNS.user && BNS.user.role)==='admin'; }catch(e){ return false; } }
function bnsOhT(v){ return String(v==null?'':v).trim(); }
function bnsOhDatumNL(d){ const s=bnsOhT(d).slice(0,10), p=s.split('-'); return p.length===3 ? p[2]+'-'+p[1]+'-'+p[0] : s; }
function bnsOhVandaag(){ return new Date().toISOString().slice(0,10); }
function bnsOhId(p){ return p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); }

async function bnsOhFirestore(){
  const m = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  return m;
}

/* ---------- de objectenlijst ---------- */
async function bnsOhObjectenHalen(){
  if(Array.isArray(bnsOhObjecten)) return bnsOhObjecten;
  bnsOhObjecten = [];
  try{ const b=JSON.parse(localStorage.getItem('bns_tw_oh_objecten_tel')||'null'); if(Array.isArray(b)) bnsOhObjecten=b; }catch(e){}
  try{
    const {doc,getDoc}=await bnsOhFirestore();
    const snap=await getDoc(doc(BNS.db,'settings','onderhoud_objecten'));
    const d=snap && snap.exists() ? snap.data() : null;
    if(d && Array.isArray(d.lijst)){
      bnsOhObjecten=d.lijst;
      try{ localStorage.setItem('bns_tw_oh_objecten_tel', JSON.stringify(d.lijst)); }catch(e){}
    }
  }catch(e){}
  return bnsOhObjecten;
}

async function bnsOhVastePuntenHalen(){
  if(Array.isArray(bnsOhVastePunten)) return bnsOhVastePunten;
  bnsOhVastePunten=['Banden','Remmen','Verlichting','Olie en vloeistoffen','Carrosserie','Sloten en sleutels','Koeling','Tapinstallatie'];
  try{
    const b=JSON.parse(localStorage.getItem('bns_tw_oh_vastepunten_tel')||'null');
    if(Array.isArray(b) && b.length) bnsOhVastePunten=b;
  }catch(e){}
  try{
    const {doc,getDoc}=await bnsOhFirestore();
    const snap=await getDoc(doc(BNS.db,'settings','onderhoud_punten'));
    const d=snap && snap.exists() ? snap.data() : null;
    if(d && Array.isArray(d.lijst) && d.lijst.length){
      bnsOhVastePunten=d.lijst;
      try{ localStorage.setItem('bns_tw_oh_vastepunten_tel', JSON.stringify(d.lijst)); }catch(e){}
    }
  }catch(e){}
  return bnsOhVastePunten;
}

/* ==========================================================
   25-10-2026 - EEN DOCUMENT, EN DAAR STAAT ALLES IN WAT OPENSTAAT.
   ----------------------------------------------------------
   [stated] "het gaat om de bezorgtelefoon waar alleen de nog te repareren op
   moeten komen, dat zijn er 4 of 5."
   De planner zet die paar punten in settings/onderhoud_open, met de naam van
   het object erbij. De telefoon leest dat ene kleine document en heeft daarmee
   zijn hele rode lijst. Er wordt hier dus NIETS per object opgehaald; dat
   gebeurt pas als je er eentje opent om af te melden.
========================================================== */
/* ==========================================================
   25-10-2026 - DE RODE KNOP LOOPT NU VANZELF MEE.
   ----------------------------------------------------------
   [stated] "dit is ook onder de bezorgtelefoons; hij moet opnieuw laden wil
   de wijziging van een andere bezorger zichtbaar worden."

   Dat klopte: het overzichtje werd alleen opgehaald op het moment dat je op
   de knop Reparatie drukte. Meldt een andere bezorger intussen iets af, dan
   zag je dat pas als je de knop opnieuw aantikte.

   Hier dezelfde weg als de opdrachten en de bezorgers in deze telefoon al
   gebruiken: een meeluisteraar. Firebase duwt een wijziging door op het
   moment dat hij gemaakt wordt. Het gaat om EEN klein document, dus dit kost
   niets zolang er niets verandert - zeker minder dan elke tien seconden zelf
   gaan kijken.

   Staat de bezorger een wagen te bekijken, dan worden ook de beurten van die
   ene wagen opnieuw opgehaald, zodat hij niet iets afmeldt wat al weg is.
========================================================== */
var bnsOhLuistert=false;
function bnsOhMeeluisteren(){
  try{
    var f=window.BNS && BNS.firebase, db=window.BNS && BNS.db;
    if(!(f && db && f.onSnapshot && f.doc)){ setTimeout(bnsOhMeeluisteren, 4000); return; }
    if(bnsOhLuistert) return;
    bnsOhLuistert=true;
    f.onSnapshot(f.doc(db,'settings','onderhoud_open'), async function(snap){
      try{
        const d=(snap && snap.exists && snap.exists()) ? snap.data() : null;
        if(!d) return;
        const uit={};
        Object.keys(d).forEach(function(k){
          if(k.indexOf('o_')!==0) return;
          const v=d[k];
          if(v && typeof v==='object' && Number(v.n)>0) uit[k.slice(2)]=v;
          else if(Number(v)>0) uit[k.slice(2)]={n:Number(v), naam:'', nr:'', punten:[]};
        });
        bnsOhTellers=uit;
        if(BNS_R30_ONDERHOUD && bnsOhScherm==='boek' && bnsOhObject){
          delete bnsOhRegels[bnsOhObject];
          await bnsOhRegelsHalen(bnsOhObject);
        }
        bnsOhBalk();
        if(BNS_R30_ONDERHOUD) bnsOhTekenZacht();
      }catch(e){}
    }, function(){ bnsOhLuistert=false; setTimeout(bnsOhMeeluisteren, 8000); });
  }catch(e){ bnsOhLuistert=false; }
}

async function bnsOhTellersHalen(force){
  if(bnsOhTellers && !force) return bnsOhTellers;
  const uit={};
  try{
    const {doc,getDoc}=await bnsOhFirestore();
    const snap=await getDoc(doc(BNS.db,'settings','onderhoud_open'));
    const d=snap && snap.exists() ? snap.data() : null;
    if(d) Object.keys(d).forEach(function(k){
      if(k.indexOf('o_')!==0) return;
      const v=d[k];
      if(v && typeof v==='object' && Number(v.n)>0) uit[k.slice(2)]=v;
      else if(Number(v)>0) uit[k.slice(2)]={n:Number(v), naam:'', nr:'', punten:[]};
    });
  }catch(e){}
  bnsOhTellers=uit;
  return bnsOhTellers;
}

/* ---------- de regels van een object, pas bij openen ---------- */
/* 25-10-2026: in Admin is een regel een BEURT met losse punten geworden, elk
   met Uitgevoerd of Nog doen. De telefoon werkte nog met een regeltje plus
   een vinkje. Hieronder wordt alles naar die ene vorm gebracht, zodat wat de
   planner maakt hier leesbaar is en wat hier gemaakt wordt daar klopt. */
function bnsOhNetjes(r){
  if(r && !Array.isArray(r.punten)){
    r.punten=[{tekst:clean(r.wat)||'(zonder omschrijving)', staat:(clean(r.status)==='klaar'?'klaar':'open')}];
  }
  if(r && !r.punten.length) r.punten=[{tekst:'(leeg)', staat:'klaar'}];
  return r;
}
function bnsOhHeeftOpen(r){ return (r&&r.punten||[]).some(function(p){ return clean(p.staat)!=='klaar'; }); }

async function bnsOhRegelsHalen(objId){
  if(bnsOhRegels[objId]) return bnsOhRegels[objId];
  if(bnsOhBezig[objId]) return [];
  bnsOhBezig[objId]=true;
  let uit=[];
  try{ const b=JSON.parse(localStorage.getItem('bns_tw_oh_regels_'+objId)||'null'); if(Array.isArray(b)) uit=b; }catch(e){}
  try{
    const {doc,getDoc}=await bnsOhFirestore();
    const snap=await getDoc(doc(BNS.db,'onderhoud',String(objId)));
    const d=snap && snap.exists() ? snap.data() : null;
    if(d && Array.isArray(d.regels)){
      uit=d.regels;
      try{ localStorage.setItem('bns_tw_oh_regels_'+objId, JSON.stringify(uit)); }catch(e){}
    }
  }catch(e){}
  uit=(uit||[]).map(bnsOhNetjes);
  bnsOhRegels[objId]=uit;
  bnsOhBezig[objId]=false;
  return uit;
}
/* ==========================================================
   26-10-2026 - DE TELEFOON SCHRIJFT OOK IN DE GROENE LIJST.
   ----------------------------------------------------------
   [stated] "onder de groene knop de laatste 40 reparaties die gedaan zijn."
   Dat lijstje is gedeeld: de planner en elke telefoon zetten er hun eigen
   afmeldingen in, elk onder een eigen sleutel zodat niemand iets van een
   ander overschrijft. Wat eruit valt blijft gewoon bij de wagen staan.
========================================================== */
function bnsOhNieuwAfgemeld(objId, nieuweLijst){
  var oud={}, uit=[];
  try{
    JSON.parse(localStorage.getItem('bns_tw_oh_regels_'+objId)||'[]').forEach(function(r){
      (r.punten||[]).forEach(function(p,i){ oud[bnsOhT(r.id)+'|'+i]=(clean(p.staat)==='klaar'); });
    });
  }catch(e){}
  (nieuweLijst||[]).forEach(function(r){
    (r.punten||[]).forEach(function(p,i){
      if(clean(p.staat)!=='klaar') return;
      if(oud[bnsOhT(r.id)+'|'+i]===true) return;
      uit.push({r:r, p:p, i:i});
    });
  });
  return uit;
}
async function bnsOhGedaanDelen(objId, nieuwe){
  if(!nieuwe || !nieuwe.length) return;
  try{
    var o=bnsOhObjectVan(objId) || (bnsOhTellers && bnsOhTellers[objId]) || {};
    var naam=clean(o.naam)||'Onbekend';
    var nr=[clean(o.twnr), clean(o.kenteken)].filter(Boolean).join(' \u00B7 ') || clean(o.nr);
    var ik=clean(BNS.user && BNS.user.name||'');
    var mee={id:'onderhoud_gedaan'};
    nieuwe.forEach(function(x,n){
      mee['g_'+Date.now().toString(36)+'_'+n+'_'+Math.random().toString(36).slice(2,6)]={
        t:clean(x.p.tekst), o:String(objId), naam:naam, nr:nr, d:clean(x.r.datum),
        w:clean(x.p.klaarDoor)||ik, s:clean(x.r.soort), r:clean(x.r.id), i:x.i, ts:Date.now()+n
      };
    });
    const {doc,setDoc}=await bnsOhFirestore();
    await setDoc(doc(BNS.db,'settings','onderhoud_gedaan'), mee, {merge:true});
  }catch(e){}
}

async function bnsOhRegelsBewaren(objId, lijst){
  /* eerst kijken wat er NET op klaar is gezet - de oude stand staat nog in
     de opslag, dus dit moet voor het wegschrijven gebeuren */
  const netGedaan=bnsOhNieuwAfgemeld(objId, lijst);
  bnsOhRegels[objId]=lijst;
  /* 25-10-2026: de teller voor de telefoon meteen bijwerken, zodat het
     beginscherm klopt zonder dat er iets opnieuw opgehaald hoeft te worden. */
  try{
    const o=bnsOhObjectVan(objId) || {naam:(bnsOhTellers&&bnsOhTellers[objId]&&bnsOhTellers[objId].naam)||'', twnr:'', kenteken:''};
    const punten=[];
    (lijst||[]).forEach(function(r){
      (r.punten||[]).forEach(function(p,i){
        if(clean(p.staat)==='klaar') return;
        punten.push({t:clean(p.tekst), r:clean(r.id), i:i, d:clean(r.datum), s:clean(r.soort)});
      });
    });
    /* 26-10-2026: een tijdstempel erbij. Zonder dat merkt Admin een afmelding
       niet waarbij er nul overblijft - het aantal gaat dan van nul naar nul
       en dan lijkt er niets gebeurd. */
    const vak={ n:punten.length, naam:clean(o.naam),
                nr:[clean(o.twnr), clean(o.kenteken)].filter(Boolean).join(' \u00B7 '), punten:punten, ts:Date.now() };
    if(!bnsOhTellers) bnsOhTellers={};
    if(vak.n>0) bnsOhTellers[objId]=vak; else delete bnsOhTellers[objId];
    const {doc,setDoc}=await bnsOhFirestore();
    const mee={id:'onderhoud_open'}; mee['o_'+String(objId)]=vak;
    await setDoc(doc(BNS.db,'settings','onderhoud_open'), mee, {merge:true});
  }catch(e){}
  try{ localStorage.setItem('bns_tw_oh_regels_'+objId, JSON.stringify(lijst)); }catch(e){}
  bnsOhGedaanDelen(objId, netGedaan);
  try{
    const {doc,setDoc}=await bnsOhFirestore();
    await setDoc(doc(BNS.db,'onderhoud',String(objId)), {id:String(objId), regels:lijst, bijgewerkt:new Date().toISOString()}, {merge:true});
  }catch(e){ toast('Opslaan naar de planning is niet gelukt. Hij staat wel op deze telefoon.'); }
}

function bnsOhOpen(objId){
  const l=bnsOhRegels[objId]||[];
  let n=[];
  l.forEach(function(r){ (r.punten||[]).forEach(function(p){ if(clean(p.staat)!=='klaar') n.push(p); }); });
  return n;
}
function bnsOhTotaalOpen(){
  /* liefst uit het overzichtje, want dan klopt het ook voor objecten
     waarvan we de regels nog niet hebben opgehaald */
  if(bnsOhTellers){
    let t=0;
    Object.keys(bnsOhTellers).forEach(function(k){ t+=Number(bnsOhTellers[k].n)||0; });
    return t;
  }
  let n=0;
  (bnsOhObjecten||[]).forEach(o=>{ n+=bnsOhOpen(o.id).length; });
  return n;
}

/* ---------- schadeverleden ---------- */
function bnsOhSchadeVoor(obj){
  const list=(BNS.state && Array.isArray(BNS.state.alerts)) ? BNS.state.alerts : [];
  const kent=bnsOhT(obj&&obj.kenteken).toUpperCase().replace(/[^A-Z0-9]/g,'');
  return list.filter(a=>{
    if(!a) return false;
    if(bnsOhT(a.objectId) && bnsOhT(a.objectId)===bnsOhT(obj.id)) return true;
    if(!kent) return false;
    /* oudere meldingen: via het kenteken dat op de opdracht stond */
    const o=findOrder(a.orderId||a.orderNumber||'');
    const v=bnsOhT(o && (o.vehicle||o.kenteken||'')).toUpperCase().replace(/[^A-Z0-9]/g,'');
    return !!v && v===kent;
  }).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}

/* ---------- tekenen ---------- */
function bnsOhSoortKleur(k){
  const m={reparatie:['#e6ddfb','#4c1d95','#6d28d9','Reparatie'],
           onderhoudsbeurt:['#dbeafe','#14509b','#1765d8','Onderhoudsbeurt'],
           controle:['#d6f0dc','#14532d','#15803d','Controle'],
           melding:['#fde8c8','#7a3f06','#b45309','Melding'],
           vervangen:['#d6f0dc','#14532d','#15803d','Vervangen'],
           onderhoud:['#dbeafe','#14509b','#1765d8','Onderhoud']};
  return m[bnsOhT(k)] || m.reparatie;
}

/* ==========================================================
   26-10-2026 - NIET HERTEKENEN TERWIJL IEMAND ZIT IN TE VULLEN.
   ----------------------------------------------------------
   [stated] "ik druk op melding of reparatie toevoegen; tijdens typen of als
   ik gewoon wacht sluit dat stukje en gaat hij steeds terug naar de wagen."

   Dit scherm wordt automatisch opnieuw getekend: elke tien seconden na het
   ophalen van de gegevens, en sinds gisteren ook zodra een andere bezorger
   iets afmeldt. Bij zo'n hertekening wordt het hele scherm opnieuw opgebouwd
   - en daarmee ook het invulblok, dat dan leeg terugkomt. Precies wat hij
   beschrijft, en zonder dat er iets misgaat met de gegevens: je typwerk is
   weg omdat het vakje opnieuw is gemaakt.

   Automatische verversingen lopen nu via bnsOhTekenZacht en slaan de
   hertekening over zolang het invulblok openstaat. Het getal op de knop
   loopt wel gewoon mee. Druk je zelf op iets - opslaan, annuleren, terug -
   dan wordt er wel direct getekend, want dan wil je het juist zien.
========================================================== */
function bnsOhFormOpen(){
  try{ var v=document.getElementById('bnsOhFormTel'); return !!(v && v.innerHTML.trim()); }catch(e){ return false; }
}
function bnsOhTekenZacht(){
  if(bnsOhFormOpen()) return;
  bnsOhTeken();
}

function bnsOhTeken(){
  const box=$("orders"); if(!box) return;
  if(bnsOhScherm==='boek' || bnsOhScherm==='schade'){ bnsOhTekenBoek(); return; }

  /* ==========================================================
     25-10-2026 - EERST ALLEEN WAT ROOD STAAT.
     ----------------------------------------------------------
     [stated] "bij de bezorgtelefoon is het niet heel duidelijk, hier opent een
     hele lijst van alle materialen; hier zou alleen op moeten te zien zijn wat
     nog gerepareerd moet worden, ook in rood. En als hij gaat zoeken dan
     alleen bv tw 9 dat die naar voren komt, en als hij dan zoekt kan hij die
     openen en een reparatie aanmaken."
     Dus: zonder zoekwoord alleen de objecten met openstaand werk, rood, met de
     punten eronder. Tikt hij iets in het zoekvak, dan verschijnt de hele lijst
     om uit te kiezen. Welke objecten iets openstaan hebben weet hij uit het
     kleine overzichtje in settings/onderhoud_open; alleen van die paar worden
     de regels opgehaald.
  ========================================================== */
  const q=bnsOhT(bnsOhZoek).toLowerCase();
  /* 26-10-2026: [stated] "mis daar ook een terug knop." Hij stond er wel,
     maar bovenaan - en zodra je scrolt is hij uit beeld. Nu blijft hij
     meelopen, net als de terugknop bij een opdracht. */
  const terug=`<div style="position:sticky;top:0;z-index:60;background:#e0f2fe;padding:8px 0;margin:0 0 6px;box-shadow:0 6px 10px -8px rgba(15,23,42,.45)"><button type="button" class="btn btn-dark wide" data-oh-naarwerk>&larr; Terug naar opdrachten</button></div>`;
  const zoekveld=`<input id="bnsOhZoekVeld" type="search" style="width:100%;box-sizing:border-box;border:2px solid #cbd5e1;border-radius:14px;font-size:16px;font-weight:700;padding:12px 14px;margin:0 0 10px" placeholder="Zoek op naam, TW-nummer of kenteken" value="${esc(bnsOhZoek)}">`;

  let inhoud='';
  if(q){
    const lijst=(bnsOhObjecten||[]).filter(o=>[o.naam,o.kenteken,o.twnr].map(x=>bnsOhT(x).toLowerCase()).join(' ').indexOf(q)>=0);
    inhoud = lijst.length ? lijst.map(o=>{
      const n=(bnsOhTellers&&bnsOhTellers[o.id])||bnsOhOpen(o.id).length;
      const onder=[bnsOhT(o.twnr), bnsOhT(o.kenteken)||'geen kenteken'].filter(Boolean).join(' · ');
      return `<article class="order-card order" data-id="${esc(o.id)}">
        <div style="display:flex;justify-content:space-between;gap:9px;align-items:center">
          <div class="order-title">${esc(o.naam)}</div>
          <span class="badge" style="background:${n?'#fee2e2':'#dcfce7'};color:${n?'#b91c1c':'#166534'}">${n?n+' open':'in orde'}</span>
        </div>
        <div class="meta"><div class="meta-row"><span>\u{1F527}</span><div>${esc(onder)}</div></div></div>
        <div class="action-grid"><button type="button" class="more-btn wide" data-oh-open="${esc(o.id)}">Openen</button></div>
      </article>`;
    }).join('') : `<div class="empty">Niets gevonden voor "${esc(bnsOhZoek)}".</div>`;
  } else {
    /* Alles komt uit het overzichtsdocument: naam, nummer en de punten zelf. */
    const ids=Object.keys(bnsOhTellers||{});
    inhoud = ids.length ? ids.map(function(id){
      const v=bnsOhTellers[id];
      const rijen=(v.punten&&v.punten.length)
        ? v.punten.map(function(p){ return '<div style="padding:8px 11px;border-radius:9px;margin:0 0 5px;background:#fff6f6;color:#b91c1c;font-weight:800">'+esc(p.t)+'</div>'; }).join('')
        : '<div style="color:#64748b">'+v.n+' punt(en)</div>';
      return '<article class="order-card order" data-id="'+esc(id)+'" style="border-top-color:#dc2626">'+
        '<div style="display:flex;justify-content:space-between;gap:9px;align-items:center">'+
          '<div class="order-title" style="color:#b91c1c">'+esc(v.naam||'Onbekend')+'</div>'+
          '<span class="badge" style="background:#fee2e2;color:#b91c1c">'+v.n+' nog doen</span>'+
        '</div>'+
        (v.nr? '<div class="meta"><div class="meta-row"><span>\u{1F527}</span><div>'+esc(v.nr)+'</div></div></div>' : '')+
        '<div style="margin:8px 0">'+rijen+'</div>'+
        '<div class="action-grid"><button type="button" class="more-btn wide" data-oh-open="'+esc(id)+'">Openen en afmelden</button></div>'+
      '</article>';
    }).join('')
    : '<article class="order-card"><div class="order-title" style="color:#166534">Niets te repareren</div>'+
      '<div class="meta"><div class="meta-row"><span>\u2714\uFE0F</span><div>Er staat op dit moment niets open.</div></div></div>'+
      '<div class="meta"><div class="meta-row"><span>\u{1F50D}</span><div>Een nieuwe reparatie meld je vanuit de opdracht, bij Melding maken.</div></div></div>'+
      '</article>';
  }

  box.innerHTML = terug + zoekveld + inhoud;

  const nw=document.querySelector('[data-oh-naarwerk]');
  if(nw) nw.onclick=()=>{ BNS_R30_ONDERHOUD=false; bnsOhZoek=''; render(); };
  const zv=$("bnsOhZoekVeld");
  if(zv) zv.oninput=function(){
    bnsOhZoek=zv.value; bnsOhTeken();
    const n=$("bnsOhZoekVeld"); if(n){ n.focus(); n.setSelectionRange(n.value.length,n.value.length); }
  };
  qsa("[data-oh-open]").forEach(b=>{
    b.onclick=async()=>{
      bnsOhObject=b.getAttribute('data-oh-open');
      bnsOhScherm='boek';
      bnsOhTeken();
      await bnsOhRegelsHalen(bnsOhObject);
      bnsOhTeken();
      bnsOhBalk();
    };
  });
}

function bnsOhObjectVan(id){
  let uit=null;
  (bnsOhObjecten||[]).forEach(o=>{ if(bnsOhT(o.id)===bnsOhT(id)) uit=o; });
  return uit;
}

function bnsOhTekenBoek(){
  const box=$("orders"); if(!box) return;
  const o=bnsOhObjectVan(bnsOhObject);
  if(!o){ bnsOhScherm='lijst'; bnsOhTeken(); return; }
  const kop=[bnsOhT(o.twnr), bnsOhT(o.kenteken)||'geen kenteken'].filter(Boolean).join(' · ');

  if(bnsOhScherm==='schade'){
    const scha=bnsOhSchadeVoor(o);
    box.innerHTML =
      `<div style="position:sticky;top:0;z-index:60;background:#e0f2fe;padding:8px 0;margin:0 0 6px;box-shadow:0 6px 10px -8px rgba(15,23,42,.45)"><button type="button" class="btn btn-dark wide" data-oh-terugboek>&larr; Terug naar ${esc(o.naam)}</button></div>` +
      `<article class="order-card"><div class="order-title">Schadeverleden</div>
        <div class="meta"><div class="meta-row"><span>\u{1F6E0}️</span><div>${esc(kop)}</div></div></div>
        ${scha.length ? scha.map(a=>{
          const dt=clean(a.time||'')||niceDate(clean(a.createdAt||'').slice(0,10));
          const klant=clean(a.customerName||'');
          const toon=(bnsOhFoto===String(a.id));
          const img=a.data||a.photoData||a.imageData||a.signatureData||'';
          return `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:11px;margin:9px 0">
            <div style="font-weight:900">${esc(a.type||a.title||'Melding')}</div>
            <div style="font-size:13px;color:#64748b">${esc(dt)}${klant?' · klant: '+esc(klant):''}${a.driverName?' · '+esc(a.driverName):''}</div>
            ${clean(a.note||a.text||a.message||'')?`<div style="margin-top:4px">${esc(clean(a.note||a.text||a.message||''))}</div>`:''}
            ${img?(toon?`<img src="${img}" style="margin-top:8px;max-width:100%;border-radius:10px">`
                       :`<button type="button" class="btn btn-dark wide" data-oh-foto="${esc(a.id)}" style="margin-top:8px">Foto tonen</button>`):''}
          </div>`;
        }).join('') : '<p class="status">Geen schade bekend bij dit object.</p>'}
      </article>`;
    const t=document.querySelector('[data-oh-terugboek]');
    if(t) t.onclick=()=>{ bnsOhScherm='boek'; bnsOhFoto=''; bnsOhTeken(); };
    qsa("[data-oh-foto]").forEach(b=>{ b.onclick=()=>{ bnsOhFoto=b.getAttribute('data-oh-foto'); bnsOhTeken(); }; });
    return;
  }

  const rs=(bnsOhRegels[o.id]||[]).map(bnsOhNetjes).slice().sort((a,b)=>{
    const ao=bnsOhHeeftOpen(a)?0:1, bo=bnsOhHeeftOpen(b)?0:1;
    if(ao!==bo) return ao-bo;
    return String(b.datum||'').localeCompare(String(a.datum||''));
  });
  const ik=clean(BNS.user && BNS.user.name||'');

  box.innerHTML =
    `<div style="position:sticky;top:0;z-index:60;background:#e0f2fe;padding:8px 0;margin:0 0 6px;box-shadow:0 6px 10px -8px rgba(15,23,42,.45)"><button type="button" class="btn btn-dark wide" data-oh-terug>&larr; Alle objecten</button></div>` +
    `<article class="order-card">
      <div class="order-title">${esc(o.naam)}</div>
      <div class="meta"><div class="meta-row"><span>\u{1F527}</span><div>${esc(kop)}</div></div></div>
      <div class="action-grid">
        <button type="button" class="btn btn-green wide" data-oh-nieuw>Melding of reparatie toevoegen</button>
        <button type="button" class="btn btn-dark wide" data-oh-schade>Schadeverleden bekijken</button>
      </div>
    </article>
    <div id="bnsOhFormTel"></div>` +
    (rs.length ? rs.map(r=>{
      const k=bnsOhSoortKleur(r.soort), isOpen=bnsOhHeeftOpen(r);
      const punten=(r.punten||[]).map((p,i)=>{
        const klaar=(clean(p.staat)==='klaar');
        return `<div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap;padding:8px 10px;border-radius:10px;margin:0 0 6px;background:${klaar?'#f3fdf5':'#fff6f6'}">
          <span style="flex:1 1 150px;min-width:0;font-weight:800;color:${klaar?'#101827':'#b91c1c'}">${esc(p.tekst)}</span>
          <span class="badge" style="background:${klaar?'#dcfce7':'#fee2e2'};color:${klaar?'#166534':'#b91c1c'}">${klaar?'Uitgevoerd':'Nog doen'}</span>
          ${klaar?'':`<button type="button" class="btn btn-green" data-oh-puntklaar="${esc(r.id)}|${i}" style="padding:9px 13px">Afmelden</button>`}
        </div>`;
      }).join('');
      return `<article class="order-card" style="border-top-color:${isOpen?'#dc2626':k[2]}">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
          <span class="badge" style="background:${k[0]};color:${k[1]}">${esc(k[3])}</span>
          <span style="font-size:13px;color:#64748b">${esc(bnsOhDatumNL(r.datum))} - ${esc(clean(r.door)||'onbekend')}</span>
        </div>
        <div style="margin-top:8px">${punten}</div>
        ${clean(r.toelichting)?`<div style="font-size:15px;line-height:1.3">${esc(r.toelichting)}</div>`:''}
      </article>`;
    }).join('') : '<p class="status">Nog niets vastgelegd bij dit object.</p>');

  const t=document.querySelector('[data-oh-terug]');
  if(t) t.onclick=()=>{ bnsOhScherm='lijst'; bnsOhTeken(); bnsOhBalk(); };
  const sb=document.querySelector('[data-oh-schade]');
  if(sb) sb.onclick=()=>{ bnsOhScherm='schade'; bnsOhFoto=''; bnsOhTeken(); };
  const nb=document.querySelector('[data-oh-nieuw]');
  if(nb) nb.onclick=()=>bnsOhForm({});
  qsa("[data-oh-puntklaar]").forEach(b=>{
    b.onclick=async()=>{
      if(!await askConfirm('Afmelden','Dit punt afmelden als uitgevoerd?')) return;
      const d=b.getAttribute('data-oh-puntklaar').split('|');
      /* 25-10-2026: vers ophalen voor het afmelden, anders schrijf je een oude
         kopie terug over wat de planner intussen heeft veranderd. */
      delete bnsOhRegels[o.id];
      const l=(await bnsOhRegelsHalen(o.id)).slice();
      l.forEach(r=>{
        if(bnsOhT(r.id)!==bnsOhT(d[0])) return;
        const p=(r.punten||[])[Number(d[1])];
        if(p){ p.staat='klaar'; if(!p.klaarOp){ p.klaarOp=new Date().toISOString(); p.klaarDoor=clean(BNS.user&&BNS.user.name||''); } }
      });
      await bnsOhRegelsBewaren(o.id,l);
      toast('Afgemeld');
      bnsOhTeken(); bnsOhBalk();
    };
  });
}

/* ---------- invullen op de telefoon: zo weinig mogelijk typen ---------- */
function bnsOhForm(r){
  r=r||{};
  const vak=$("bnsOhFormTel"); if(!vak) return;
  const soorten=[['melding','Melding'],['reparatie','Reparatie'],['onderhoudsbeurt','Onderhoudsbeurt'],['controle','Controle']];
  const huidig=bnsOhT(r.soort)||'melding';
  vak.innerHTML=`<article class="order-card" style="border-top-color:#16a34a">
    <div class="order-title">${r.id?'Regel wijzigen':'Nieuwe regel'}</div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin:8px 0">
      ${soorten.map(s=>{
        const aan=(s[0]===huidig), k=bnsOhSoortKleur(s[0]);
        return `<button type="button" data-oh-s="${s[0]}" class="btn" style="flex:1 1 45%;min-height:48px;background:${aan?k[2]:'#ffffff'};color:${aan?'#fff':'#334155'};border:${aan?'0':'2px solid #dce7f2'}">${s[1]}</button>`;
      }).join('')}
    </div>
    <input id="bnsOhWatTel" placeholder="Wat is er aan de hand of gedaan" value="${esc(r.wat||'')}" style="width:100%;box-sizing:border-box;border:2px solid #c9e4fb;border-radius:14px;font-size:16px;font-weight:700;padding:13px 14px;margin:0 0 9px">
    <textarea id="bnsOhToelTel" rows="3" placeholder="Toelichting, niet verplicht" style="width:100%;box-sizing:border-box;border:2px solid #e5e7eb;border-radius:14px;font-size:15px;font-weight:700;padding:12px 14px;margin:0 0 9px">${esc(r.toelichting||'')}</textarea>
    <label style="display:flex;gap:10px;align-items:center;font-size:15px;margin:0 0 12px">
      <input type="checkbox" id="bnsOhOpenTel" ${bnsOhT(r.status)==='klaar'?'':'checked'} style="width:22px;height:22px">
      <span>Dit moet nog uitgevoerd worden</span>
    </label>
    <button type="button" class="btn btn-green wide" id="bnsOhBewaarTel" style="min-height:52px">Opslaan</button>
    <button type="button" class="btn btn-dark wide" id="bnsOhAnnTel">&larr; Terug zonder opslaan</button>
  </article>`;
  vak.setAttribute('data-oh-soort', huidig);
  vak.setAttribute('data-oh-id', bnsOhT(r.id));
  qsa("[data-oh-s]").forEach(b=>{
    b.onclick=()=>{
      const nu={id:vak.getAttribute('data-oh-id'), soort:b.getAttribute('data-oh-s'),
                wat:($("bnsOhWatTel")||{}).value||'', toelichting:($("bnsOhToelTel")||{}).value||'',
                status:($("bnsOhOpenTel")&&$("bnsOhOpenTel").checked)?'open':'klaar'};
      bnsOhForm(nu);
    };
  });
  const ann=$("bnsOhAnnTel"); if(ann) ann.onclick=()=>{ vak.innerHTML=''; };
  const bew=$("bnsOhBewaarTel");
  if(bew) bew.onclick=async()=>{
    const wat=clean(($("bnsOhWatTel")||{}).value||'');
    if(!wat){ await askConfirm('Niets ingevuld','Vul eerst in wat er aan de hand is.'); return; }
    const o=bnsOhObjectVan(bnsOhObject); if(!o) return;
    const l=(bnsOhRegels[o.id]||[]).slice();
    const id=bnsOhT(vak.getAttribute('data-oh-id'));
    const soort=vak.getAttribute('data-oh-soort')||'melding';
    const status=($("bnsOhOpenTel")&&$("bnsOhOpenTel").checked)?'open':'klaar';
    const toel=clean(($("bnsOhToelTel")||{}).value||'');
    const ik=clean(BNS.user&&BNS.user.name||'');
    /* 25-10-2026: wegschrijven in dezelfde vorm als Admin gebruikt - een beurt
       met punten. De bezorger zet er een punt in; de planner kan er in Admin
       meer aan toevoegen. Zo leest alles aan beide kanten hetzelfde. */
    const punt={tekst:wat, staat:status};
    if(status==='klaar'){ punt.klaarOp=new Date().toISOString(); punt.klaarDoor=ik; }
    let bestaand=null;
    l.forEach(x=>{ if(bnsOhT(x.id)===id) bestaand=x; });
    if(bestaand){
      bestaand.soort=soort; bestaand.toelichting=toel; bestaand.punten=[punt];
      delete bestaand.wat; delete bestaand.status;
    } else {
      l.push({id:bnsOhId('oh'), soort:soort, punten:[punt], toelichting:toel, datum:bnsOhVandaag(),
              door:ik, kosten:'', gemaaktOp:new Date().toISOString(), gemaaktDoor:ik, vanTelefoon:true});
    }
    await bnsOhRegelsBewaren(o.id,l);
    toast('Opgeslagen');
    bnsOhTeken(); bnsOhBalk();
  };
  const w=$("bnsOhWatTel"); if(w) w.focus();
}

/* ---------- de derde knop in de balk ---------- */
function bnsOhBalk(){
  const bar=document.getElementById('bnsR28Balk');
  if(!bar) return;
  let k=document.getElementById('bnsOhTab');
  if(!bnsOhMag()){ if(k) k.remove(); return; }
  if(!k){
    k=document.createElement('button');
    k.type='button';
    k.id='bnsOhTab';
    k.style.flex='1';
    bar.appendChild(k);
    k.onclick=async()=>{
      BNS_R30_ONDERHOUD=true;
      BNS_R28_TOON_AFGEROND=false;
      bnsOhScherm='lijst'; bnsOhZoek='';
      render();
      await bnsOhTellersHalen(true);     /* een klein document, vers opgehaald */
      render();
      bnsOhObjectenHalen();              /* op de achtergrond, voor het zoeken */
      bnsOhBalk();
    };
  }
  const n=bnsOhTotaalOpen();
  /* 25-10-2026: [stated] "die knop rode letters geven, en als er een melding
     komt wordt de knop helemaal rood; bij geen melding de letters groen." */
  k.textContent='Reparatie ('+n+')';
  k.className='btn wide';
  if(n){
    k.style.background='#dc2626'; k.style.color='#ffffff'; k.style.border='0';
  } else {
    k.style.background='#ffffff'; k.style.color='#15803d'; k.style.border='2px solid #15803d';
  }
}

/* ==========================================================
   BNS TW R33 - REPARATIE MELDEN VANUIT DE OPDRACHT (25-10-2026)
   ----------------------------------------------------------
   [stated] "bij een opdracht waar hij een schade of reparatie tegenkomt dan
   opent hij de opdracht, drukt op melding maken, en daar maken we nu een
   rubriek met reparatie. Opent hij die dan kan hij zelf kenteken en of tw
   invullen en hij moet dezelfde lijst krijgen die ik bij beurt toevoegen
   krijg. Simpel, snel en geen hele lijsten nodig, wij weten al met welke
   wagen hij is."

   Daarom geen objectenlijst om doorheen te bladeren. Hij staat al in de
   opdracht, dus het kenteken van die opdracht staat alvast ingevuld; hij kan
   het overtypen als het om iets anders gaat, bijvoorbeeld een TW-nummer van
   een materiaal.

   Daarna dezelfde opzet als in Admin: een soort, punten die je uit de vaste
   lijst aantikt of zelf intypt, en per punt Uitgevoerd of Nog doen. Wat op
   Nog doen staat telt mee in de rode knop en komt bij de planner in de lijst
   Nog te doen.

   KENTEKEN ONBEKEND? Dan wordt het object AANGEMAAKT in plaats van de melding
   te weigeren. Liever een object dat de planner later bijwerkt dan een
   reparatie die niemand heeft vastgelegd.
========================================================== */
function bnsOhZoekObject(tekst){
  const t=bnsOhT(tekst).toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!t) return null;
  let raak=null;
  (bnsOhObjecten||[]).forEach(function(o){
    if(raak) return;
    const k=bnsOhT(o.kenteken).toUpperCase().replace(/[^A-Z0-9]/g,'');
    const n=bnsOhT(o.twnr).toUpperCase().replace(/[^A-Z0-9]/g,'');
    if((k && k===t) || (n && n===t)) raak=o;
  });
  return raak;
}

/* ==========================================================
   25-10-2026 - NOOIT EEN OUDE KOPIE TERUGSCHRIJVEN.
   ----------------------------------------------------------
   De telefoon haalt de objectenlijst bij het starten op. Schrijft hij later
   zijn eigen kopie terug, dan verdwijnt alles wat de planner intussen heeft
   toegevoegd of veranderd. Daarom wordt de lijst vlak voor het schrijven
   opnieuw opgehaald, en wordt het nieuwe object DAARAAN toegevoegd. Blijkt
   het er dan al in te staan - iemand anders was net sneller - dan wordt dat
   object gebruikt in plaats van er nog een te maken.
========================================================== */
async function bnsOhObjectMaken(tekst){
  const t=bnsOhT(tekst);
  try{
    const {doc,getDoc}=await bnsOhFirestore();
    const snap=await getDoc(doc(BNS.db,'settings','onderhoud_objecten'));
    const d=snap && snap.exists() ? snap.data() : null;
    if(d && Array.isArray(d.lijst)){
      bnsOhObjecten=d.lijst;
      try{ localStorage.setItem('bns_tw_oh_objecten_tel', JSON.stringify(d.lijst)); }catch(e){}
      const alBekend=bnsOhZoekObject(t);
      if(alBekend) return alBekend;
    }
  }catch(e){}
  const lijktOpKenteken=/^[A-Z0-9]{6}$/.test(t.toUpperCase().replace(/[^A-Z0-9]/g,''));
  const o={ id:'obj_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),
            naam:t, kenteken: lijktOpKenteken ? t.toUpperCase() : '',
            twnr: lijktOpKenteken ? '' : t, soort: lijktOpKenteken ? 'voertuig' : 'materiaal',
            gemaaktOp:new Date().toISOString(), uit:'telefoon' };
  bnsOhObjecten=(bnsOhObjecten||[]).concat([o]);
  try{ localStorage.setItem('bns_tw_oh_objecten_tel', JSON.stringify(bnsOhObjecten)); }catch(e){}
  try{
    const {doc,setDoc}=await bnsOhFirestore();
    await setDoc(doc(BNS.db,'settings','onderhoud_objecten'), {id:'onderhoud_objecten', lijst:bnsOhObjecten, bijgewerkt:new Date().toISOString()}, {merge:true});
  }catch(e){}
  return o;
}

/* het formulier zelf - dezelfde onderdelen als bij een beurt in Admin */
async function bnsOhReparatieMelden(order){
  await bnsOhObjectenHalen();
  const vp=await bnsOhVastePuntenHalen();

  /* ==========================================================
     25-10-2026 - NIET BLIND HET VELD VAN DE OPDRACHT OVERNEMEN.
     ----------------------------------------------------------
     [stated] "er staat nu transport brengen + ophalen, daar moet toch komen
     kenteken en of materiaal / tw nr."
     Het veld `vehicle` op een opdracht blijkt hier geen kenteken te bevatten
     maar een omschrijving van het transport. Daarom wordt het alleen nog
     ingevuld als het ook echt ergens op slaat: als het een bekend object is,
     of als het eruitziet als een kenteken. Anders blijft het leeg en vult de
     bezorger het zelf in - dat is maar een paar tekens werk. */
  function bruikbaarKenteken(v){
    const t=clean(v);
    if(!t) return '';
    const bekend=bnsOhZoekObject(t);
    if(bekend) return clean(bekend.kenteken) || clean(bekend.twnr) || t;
    const kaal=t.toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(kaal.length>=5 && kaal.length<=8 && /[0-9]/.test(kaal) && /[A-Z]/.test(kaal) && t.indexOf(' ')<0) return t.toUpperCase();
    return '';
  }
  const staat={ merk: bruikbaarKenteken(order && (order.vehicle||order.kenteken||order.voertuig||'')),
                soort:'reparatie', punten:[{tekst:'', staat:'open'}], toelichting:'' };

  const m=modalVoorReparatie();
  /* 25-10-2026 - EIGEN VENSTER MET EIGEN OPMAAK.
     [stated] "als ik op de knop reparatie / onderhoud druk gaat hij terug naar
     het beginscherm." Oorzaak: ik gebruikte opmaaknamen die in DEZE telefoon
     niet bestaan, dus het venster werd onzichtbaar en je keek door naar het
     scherm eronder. Alles wat dit venster nodig heeft staat nu in het venster
     zelf, net als bij het sleutelformulier hierboven. Gebruik hier alleen de
     klassen die driver.css van Tapwagen zelf kent: btn, btn-green, btn-dark,
     wide, order-card, badge, meta, meta-row, search, empty, status. */
  function modalVoorReparatie(){
    const wrap=document.createElement('div');
    wrap.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.62);display:flex;align-items:flex-start;justify-content:center;padding:12px;overflow:auto';
    wrap.innerHTML='<div style="background:#fff;border-radius:22px;padding:16px;width:min(620px,100%);max-height:94vh;overflow:auto;box-shadow:0 24px 80px rgba(0,0,0,.35)">'+
      '<button type="button" data-sluit style="border:0;border-radius:14px;background:#374151;color:#fff;font-size:16px;font-weight:800;padding:11px 16px;min-height:46px;margin:0 0 12px">&larr; Terug</button>'+
      '<div id="bnsOhRepBody"></div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-sluit]').onclick=function(){ wrap.remove(); };
    return wrap;
  }

  function lezen(){
    staat.punten.forEach(function(p,i){ const el=document.getElementById('bnsOhRepPunt'+i); if(el) p.tekst=clean(el.value); });
    const k=document.getElementById('bnsOhRepMerk'); if(k) staat.merk=clean(k.value);
    const t=document.getElementById('bnsOhRepToel'); if(t) staat.toelichting=clean(t.value);
  }

  function teken(){
    const body=m.querySelector('#bnsOhRepBody');
    const soorten=[['reparatie','Reparatie'],['melding','Melding'],['onderhoudsbeurt','Onderhoudsbeurt'],['controle','Controle']];
    const nOpen=staat.punten.filter(function(p){ return p.staat!=='klaar'; }).length;
    body.innerHTML=
      '<h2>Reparatie of melding</h2>'+
      '<label style="display:block;font-size:15px;color:#475569;margin:0 0 5px">Kenteken of TW-nummer</label>'+
      '<input id="bnsOhRepMerk" value="'+esc(staat.merk)+'" placeholder="Bijvoorbeeld VSN-68-R of TW17" style="width:100%;box-sizing:border-box;border:2px solid #c9e4fb;border-radius:14px;font-size:17px;font-weight:800;padding:13px 14px;margin:0 0 6px">'+
      '<div style="font-size:13px;color:#64748b;margin:0 0 14px">'+
        (bnsOhZoekObject(staat.merk) ? 'Bekend: '+esc(bnsOhZoekObject(staat.merk).naam) : (clean(staat.merk)?'Nog niet bekend - wordt aangemaakt':'Vul in om welke wagen of welk materiaal het gaat'))+
      '</div>'+
      '<div style="display:flex;gap:7px;flex-wrap:wrap;margin:0 0 14px">'+
        soorten.map(function(s){
          const aan=(staat.soort===s[0]);
          return '<button type="button" class="btn" data-rep-soort="'+s[0]+'" style="flex:1 1 45%;min-height:48px;background:'+(aan?'#6d28d9':'#fff')+';color:'+(aan?'#fff':'#334155')+';border:'+(aan?'0':'2px solid #dce7f2')+'">'+s[1]+'</button>';
        }).join('')+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:0 0 6px">'+
        '<span style="font-size:15px;color:#475569">Punten</span>'+
        (nOpen? '<span style="font-size:14px;color:#b91c1c;font-weight:800">'+nOpen+' nog doen</span>' : '')+
      '</div>'+
      staat.punten.map(function(p,i){
        const klaar=(p.staat==='klaar');
        return '<div style="border:2px solid '+(klaar?'#bbf7d0':'#fecaca')+';border-radius:14px;padding:10px;margin:0 0 9px;background:'+(klaar?'#f3fdf5':'#fff6f6')+'">'+
          '<input id="bnsOhRepPunt'+i+'" value="'+esc(p.tekst)+'" placeholder="Wat is er aan de hand" style="width:100%;box-sizing:border-box;border:1px solid #d8dee9;border-radius:12px;font-size:16px;font-weight:700;padding:11px 12px;margin:0 0 8px">'+
          '<div style="display:flex;gap:7px">'+
            '<button type="button" class="btn" data-rep-staat="'+i+'|klaar" style="flex:1;min-height:46px;background:'+(klaar?'#16a34a':'#fff')+';color:'+(klaar?'#fff':'#334155')+';border:'+(klaar?'0':'2px solid #dce7f2')+'">Uitgevoerd</button>'+
            '<button type="button" class="btn" data-rep-staat="'+i+'|open" style="flex:1;min-height:46px;background:'+(klaar?'#fff':'#dc2626')+';color:'+(klaar?'#334155':'#fff')+';border:'+(klaar?'2px solid #dce7f2':'0')+'">Nog doen</button>'+
            '<button type="button" class="btn" data-rep-weg="'+i+'" style="min-height:46px;background:#e2e8f0;color:#334155;border:0;padding:0 14px">&times;</button>'+
          '</div>'+
        '</div>';
      }).join('')+
      '<button type="button" class="btn btn-dark wide" data-rep-bij style="margin:0 0 12px">+ Punt erbij</button>'+
      '<div style="font-size:14px;color:#475569;margin:0 0 6px">Of kies uit de vaste lijst</div>'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px">'+
        (vp||[]).map(function(x){ return '<button type="button" class="btn" data-rep-vast="'+esc(x)+'" style="background:#fff;color:#334155;border:2px solid #dce7f2;border-radius:999px;padding:9px 14px;min-height:44px">'+esc(x)+'</button>'; }).join('')+
      '</div>'+
      '<textarea id="bnsOhRepToel" rows="2" placeholder="Toelichting, niet verplicht" style="width:100%;box-sizing:border-box;border:2px solid #e5e7eb;border-radius:14px;font-size:15px;font-weight:700;padding:12px 14px;margin:0 0 14px">'+esc(staat.toelichting)+'</textarea>'+
      '<button type="button" class="btn btn-green wide" id="bnsOhRepBewaar" style="min-height:54px;font-size:17px">Opslaan</button>';

    qsa('[data-rep-soort]', body).forEach(function(b){ b.onclick=function(){ lezen(); staat.soort=b.getAttribute('data-rep-soort'); teken(); }; });
    qsa('[data-rep-staat]', body).forEach(function(b){
      b.onclick=function(){ lezen(); const d=b.getAttribute('data-rep-staat').split('|'); if(staat.punten[Number(d[0])]) staat.punten[Number(d[0])].staat=d[1]; teken(); };
    });
    qsa('[data-rep-weg]', body).forEach(function(b){
      b.onclick=function(){ lezen(); staat.punten.splice(Number(b.getAttribute('data-rep-weg')),1); if(!staat.punten.length) staat.punten=[{tekst:'',staat:'open'}]; teken(); };
    });
    const bij=body.querySelector('[data-rep-bij]');
    if(bij) bij.onclick=function(){ lezen(); staat.punten.push({tekst:'', staat:'open'}); teken(); };
    qsa('[data-rep-vast]', body).forEach(function(b){
      b.onclick=function(){
        lezen();
        const t=b.getAttribute('data-rep-vast');
        let leeg=-1;
        staat.punten.forEach(function(p,i){ if(leeg<0 && !clean(p.tekst)) leeg=i; });
        if(leeg>=0) staat.punten[leeg].tekst=t; else staat.punten.push({tekst:t, staat:'open'});
        teken();
      };
    });
    const bew=body.querySelector('#bnsOhRepBewaar');
    if(bew) bew.onclick=opslaan;
    const mk=body.querySelector('#bnsOhRepMerk');
    if(mk) mk.onblur=function(){ lezen(); teken(); };
  }

  async function opslaan(){
    lezen();
    if(!clean(staat.merk)){ await askConfirm('Nog niet compleet','Vul eerst het kenteken of TW-nummer in.'); return; }
    const punten=staat.punten.filter(function(p){ return clean(p.tekst); });
    if(!punten.length){ await askConfirm('Nog niet compleet','Vul minstens een punt in, of kies er een uit de vaste lijst.'); return; }
    let obj=bnsOhZoekObject(staat.merk);
    if(!obj) obj=await bnsOhObjectMaken(staat.merk);
    const ik=clean(BNS.user && BNS.user.name||'');
    punten.forEach(function(p){ if(p.staat==='klaar' && !p.klaarOp){ p.klaarOp=new Date().toISOString(); p.klaarDoor=ik; } });
    /* 25-10-2026: de regels vlak voor het opslaan opnieuw ophalen, zodat een
       beurt die de planner net heeft toegevoegd niet wordt overschreven. */
    delete bnsOhRegels[obj.id];
    const l=(await bnsOhRegelsHalen(obj.id)).slice();
    l.push({ id:'oh_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),
             soort:staat.soort, punten:punten, toelichting:staat.toelichting,
             datum:new Date().toISOString().slice(0,10), door:ik, kosten:'',
             gemaaktOp:new Date().toISOString(), gemaaktDoor:ik, vanTelefoon:true,
             orderId: clean(order && order.id || ''), orderNumber: clean(order && order.number || '') });
    await bnsOhRegelsBewaren(obj.id, l);
    m.remove();
    toast('Reparatie vastgelegd bij '+obj.naam);
    bnsOhBalk();
    if(BNS_R30_ONDERHOUD) bnsOhTeken();
  }

  teken();
}
