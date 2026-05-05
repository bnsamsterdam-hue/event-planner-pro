const FIREBASE_VERSION = "10.12.5";

const BNS = {
  firebase: null,
  app: null,
  db: null,
  user: null,
  state: {
    users: [],
    orders: [],
    materials: [],
    customers: [],
    locations: [],
    alerts: [],
    settings: {}
  }
};

const $ = id => document.getElementById(id);

function clean(v){ return String(v || "").trim(); }
function lower(v){ return clean(v).toLowerCase(); }
function esc(v){
  return String(v ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function toast(t){
  const e = $("toast");
  if(!e){ alert(t); return; }
  e.textContent = String(t || "");
  e.classList.add("show");
  clearTimeout(e._timer);
  e._timer = setTimeout(()=>e.classList.remove("show"),3500);
}

function setStatus(t){
  const e = $("status");
  if(e) e.textContent = t;
}

function hasRight(k){
  return !!(BNS.user && BNS.user.rights && BNS.user.rights[k]);
}

function statusOf(o){ return lower(o && o.status); }

function isCancelled(o){
  return ["geannuleerd","geannuleerde","annulering","cancelled","canceled"].includes(statusOf(o));
}

function isDone(o){
  return ["uitgevoerd","afgerond","voltooid","done","klaar"].includes(statusOf(o));
}

function isDeleted(o){
  return ["verwijderd","gewist","deleted","trash"].includes(statusOf(o));
}

function orderStart(o){
  return clean(o.start || o.dateStart || o.startDate || o.date || "");
}

function orderEnd(o){
  return clean(o.end || o.dateEnd || o.endDate || orderStart(o));
}

function dateTime(v){
  const d = new Date(clean(v).slice(0,10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function todayTime(){
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.getTime();
}

function niceDate(v){
  v = clean(v).slice(0,10);
  const p = v.split("-");
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : v;
}

function addressOf(o){
  const p = [];
  const add = v => {
    v = clean(v);
    if(v && !p.includes(v)) p.push(v);
  };

  [
    o.locationName,
    o.locationAddress,
    o.locationStreet,
    o.locationZip,
    o.locationCity,
    o.address,
    o.street,
    o.zip,
    o.city
  ].forEach(add);

  if(o.location && typeof o.location === "object"){
    [
      o.location.name,
      o.location.address,
      o.location.street,
      o.location.zip,
      o.location.city
    ].forEach(add);
  }

  return p.join(", ");
}

function customerName(o){
  return clean(o.customerName || (o.customer && o.customer.name) || "");
}

function customerPhone(o){
  return clean(o.customerPhone || o.phone || (o.customer && o.customer.phone) || "");
}

function driverName(o){
  return clean(o.driverName || o.driver || o.bezorger || "");
}

function materialText(o){
  const m = o.materials || o.mats || [];
  return Array.isArray(m)
    ? m.map(x => typeof x === "string" ? x : (x.code || x.name || ""))
       .filter(Boolean)
       .join(", ")
    : "";
}

function routeUrl(type,a){
  const q = encodeURIComponent(a || "");
  return type === "waze"
    ? `https://waze.com/ul?q=${q}&navigate=yes`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/* =========================
   FIREBASE
========================= */

async function initFirebase(){
  if(!window.BNS_FIREBASE_CONFIG || window.BNS_FIREBASE_CONFIG.apiKey === "VUL_HIER_IN"){
    setStatus("Firebase config ontbreekt of is niet ingevuld.");
    toast("Firebase config ontbreekt");
    throw new Error("Firebase config ontbreekt");
  }

  const appMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
  const fsMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);

  BNS.firebase = fsMod;
  BNS.app = appMod.initializeApp(window.BNS_FIREBASE_CONFIG);
  BNS.db = fsMod.getFirestore(BNS.app);

  setStatus("Firebase verbonden");
}

/* 
  BELANGRIJK:
  Orders worden gefilterd vanaf 2025-01-01.
  Daardoor haalt planner niet meer alle oude rommel vanaf 2023 binnen.
*/
async function loadCollection(n){
  const s = await BNS.firebase.getDocs(
    BNS.firebase.collection(BNS.db,n)
  );

  let data = s.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  if(n === "orders"){
    data = data.filter(o => {
      const datum = orderStart(o).slice(0,10);
      return datum && datum >= "2025-01-01";
    });
  }

  return data;
}

async function loadAll(){
  setStatus("Data laden...");

  BNS.state.users = await loadCollection("users");
  BNS.state.orders = await loadCollection("orders");
  BNS.state.materials = await loadCollection("materials");
  BNS.state.customers = await loadCollection("customers");
  BNS.state.locations = await loadCollection("locations");
  BNS.state.alerts = await loadCollection("alerts");

  setStatus("Data geladen");
}

async function updateOrder(o){
  if(!o || !o.id) return;

  o.updatedAt = new Date().toISOString();

  await BNS.firebase.setDoc(
    BNS.firebase.doc(BNS.db,"orders",String(o.id)),
    o,
    { merge:true }
  );
}

async function addAlert(a){
  const id = a.id || ("a_" + Math.random().toString(36).slice(2,10));
  a.id = id;

  await BNS.firebase.setDoc(
    BNS.firebase.doc(BNS.db,"alerts",id),
    a,
    { merge:true }
  );
}

/* =========================
   LOGIN
========================= */

function populateUsers(f){
  const users = (BNS.state.users || []).filter(f);

  $("loginName").innerHTML = users.length
    ? users.map(u => `<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.role || "Medewerker")})</option>`).join("")
    : `<option value="">Geen gebruikers gevonden</option>`;
}

function loginWithFilter(f,key,after){
  const id = $("loginName").value;
  const pin = clean($("loginPin").value);

  const found = (BNS.state.users || []).find(u =>
    String(u.id) === String(id) &&
    String(u.pin || "") === pin
  );

  if(!found){
    toast("Naam of PIN klopt niet");
    return;
  }

  if(!f(found)){
    toast("Geen rechten voor deze portal");
    return;
  }

  BNS.user = found;
  sessionStorage.setItem(key,found.id);
  $("loginPin").value = "";
  after();
}

function restoreSession(f,key,after){
  const id = sessionStorage.getItem(key);
  if(!id) return;

  const found = (BNS.state.users || []).find(u => String(u.id) === String(id));

  if(found && f(found)){
    BNS.user = found;
    after();
  }
}

/* =========================
   PLANNER
========================= */

const SESSION_KEY = "bns_planner_firebase_user_id";

function plannerAllowed(u){
  const r = lower(u.role);
  return r === "planner" ||
         r === "admin" ||
         !!(u.rights && (u.rights.orders || u.rights.admin || u.rights.planner));
}

function getOrders(){
  return (BNS.state.orders || [])
    .filter(o => !isDeleted(o))
    .sort((a,b) => dateTime(orderStart(a)) - dateTime(orderStart(b)));
}

function orderCard(o){
  const s = orderStart(o);
  const e = orderEnd(o);
  const dl = s && e && s !== e
    ? `${niceDate(s)} t/m ${niceDate(e)}`
    : niceDate(s || e);

  return `
    <article class="card order" data-id="${esc(o.id)}">
      <div class="order-title">
        ${esc(o.number || "")} - ${esc(o.title || "Zonder titel")}
      </div>

      <div class="rights">
        <span class="badge">${esc(o.status || "Open")}</span>
        <span class="badge">Bezorger: ${esc(driverName(o) || "niet gekoppeld")}</span>
      </div>

      <div class="meta">
        <div>📅 <strong>${esc(dl)}</strong></div>
        <div>👤 ${esc(customerName(o) || "Klant onbekend")}</div>
        <div>🚚 ${esc(driverName(o) || "Geen bezorger")}</div>
        <div>📍 ${esc(addressOf(o) || "Adres onbekend")}</div>
        <div>📦 ${esc(materialText(o) || "Geen materialen")}</div>
      </div>

      <div class="row">
        <button class="btn btn-green" type="button" data-status="${esc(o.id)}" data-value="Uitgevoerd">
          Uitgevoerd
        </button>

        <button class="btn btn-orange" type="button" data-status="${esc(o.id)}" data-value="Geannuleerd">
          Geannuleerd
        </button>

        <button class="btn btn-dark btn-full" type="button" data-assign="${esc(o.id)}">
          Bezorger koppelen
        </button>
      </div>
    </article>
  `;
}

function showApp(){
  $("loginBox").classList.add("hidden");
  $("appBox").classList.remove("hidden");

  $("who").textContent = BNS.user
    ? `${BNS.user.name} - ${BNS.user.role || "Planner"}`
    : "";

  render();
}

function render(){
  const rows = getOrders();

  $("orders").innerHTML = rows.length
    ? rows.map(orderCard).join("")
    : `<div class="empty">Geen opdrachten.</div>`;

  renderAlerts(); // 🔴 DEZE MOET ERIN

  bindActions();
}

function findOrder(id){
  return (BNS.state.orders || []).find(o => String(o.id) === String(id));
}

function driverUsers(){
  return (BNS.state.users || []).filter(u =>
    lower(u.role) === "bezorger" ||
    !!(u.rights && u.rights.gps)
  );
}

function bindActions(){
  document.querySelectorAll("[data-status]").forEach(b => {
    b.onclick = async () => {
      const o = findOrder(b.dataset.status);
      if(!o) return;

      if(!confirm(`Status wijzigen naar ${b.dataset.value}?`)) return;

      o.status = b.dataset.value;
      o.updatedAt = new Date().toISOString();
      o.updatedBy = BNS.user.name || "";

      await updateOrder(o);

      toast("Status opgeslagen");

      await loadAll();
      render();
    };
  });

  document.querySelectorAll("[data-assign]").forEach(b => {
    b.onclick = async () => {
      const o = findOrder(b.dataset.assign);
      if(!o) return;

      const drivers = driverUsers();

      if(!drivers.length){
        toast("Geen bezorgers gevonden in Firebase");
        return;
      }

      const list = drivers.map((d,i) => `${i+1}. ${d.name}`).join("\n");
      const answer = prompt("Kies bezorger nummer:\n" + list,"1");
      const idx = Number(answer) - 1;

      if(!drivers[idx]) return;

      o.driverId = drivers[idx].id;
      o.bezorgerId = drivers[idx].id;
      o.driverName = drivers[idx].name;
      o.driver = drivers[idx].name;
      o.bezorger = drivers[idx].name;
      o.updatedAt = new Date().toISOString();
      o.updatedBy = BNS.user.name || "";

      await updateOrder(o);

      toast("Bezorger gekoppeld");

      await loadAll();
      render();
    };
  });
}

/* =========================
   START
========================= */
function renderAlerts(){
  const list = (BNS.state.alerts || [])
    .filter(a => !a.resolved)
    .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));

  const el = document.getElementById("alerts");
 if(!el){
  console.log("alerts element niet gevonden");
  return;
}

  if(!list.length){
    el.innerHTML = "<div class='empty'>Geen meldingen</div>";
    return;
  }

  el.innerHTML = list.map(a => `
    <div class="card">
      <strong>${a.title || "Melding"}</strong><br>
      Opdracht: ${a.orderNumber || "-"}<br>
      ${a.text || ""}<br>
      <small>${a.from || ""}</small>
    </div>
  `).join("");
}
async function boot(){
  try{
    await initFirebase();
    await loadAll();

    populateUsers(plannerAllowed);

    $("loginBtn").onclick = () => loginWithFilter(plannerAllowed,SESSION_KEY,showApp);

    $("loginPin").addEventListener("keydown",e => {
      if(e.key === "Enter"){
        loginWithFilter(plannerAllowed,SESSION_KEY,showApp);
      }
    });

    $("logoutBtn").onclick = () => {
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
    };

    $("refreshBtn").onclick = async () => {
      await loadAll();
      render();
      toast("Verversd");
    };

    $("searchBox").oninput = () => {
      const q = lower($("searchBox").value);

      document.querySelectorAll(".order").forEach(el => {
        el.style.display = !q || lower(el.innerText).includes(q) ? "" : "none";
      });
    };

    restoreSession(plannerAllowed,SESSION_KEY,showApp);

  }catch(e){
    console.error(e);
    setStatus("Fout: " + e.message);
  }
}

boot();
