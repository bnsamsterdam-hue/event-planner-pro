/* BNS Driver Portal V1 - losse map, hoofdapp blijft veilig */
(function(){
  "use strict";

  const STORAGE_KEYS = [
    "event-planner-pro-v87",
    "event-planner-pro-v8",
    "event-planner-pro",
    "bns_event_planner"
  ];
  const SESSION_KEY = "bns_driver_user_id";

  const $ = (id) => document.getElementById(id);

  let state = loadState();
  let user = null;

  function toast(text){
    const el = $("toast");
    el.textContent = String(text || "");
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(()=>el.classList.remove("show"), 3500);
  }

  function loadState(){
    for(const key of STORAGE_KEYS){
      try{
        const raw = localStorage.getItem(key);
        if(raw){
          const parsed = JSON.parse(raw);
          if(parsed && Array.isArray(parsed.users)) return parsed;
        }
      }catch(e){}
    }
    return {users:[], orders:[], alerts:[]};
  }

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(state));
    }catch(e){}
  }

  function clean(v){ return String(v || "").trim(); }
  function lower(v){ return clean(v).toLowerCase(); }
  function esc(v){
    return String(v ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;");
  }

  function hasRight(key){
    return !!(user && user.rights && user.rights[key]);
  }

  function userAllowed(u){
    const role = lower(u.role);
    return role === "bezorger" || role === "planner" || !!(u.rights && (u.rights.gps || u.rights.agenda || u.rights.resolve));
  }

  function populateUsers(){
    const select = $("loginName");
    const users = (state.users || []).filter(userAllowed);
    select.innerHTML = users.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.role || "Medewerker")})</option>`).join("");
    if(!users.length){
      select.innerHTML = `<option value="">Geen medewerkers gevonden</option>`;
    }
  }

  function login(){
    const id = $("loginName").value;
    const pin = clean($("loginPin").value);
    const found = (state.users || []).find(u => String(u.id) === String(id) && String(u.pin || "") === pin);

    if(!found){
      toast("Naam of PIN klopt niet");
      return;
    }

    if(!userAllowed(found)){
      toast("Deze gebruiker heeft geen mobiele rechten");
      return;
    }

    user = found;
    sessionStorage.setItem(SESSION_KEY, found.id);
    $("loginPin").value = "";
    showApp();
  }

  function logout(){
    sessionStorage.removeItem(SESSION_KEY);
    user = null;
    $("appBox").classList.add("hidden");
    $("loginBox").classList.remove("hidden");
  }

  function restoreSession(){
    const id = sessionStorage.getItem(SESSION_KEY);
    if(!id) return;
    const found = (state.users || []).find(u => String(u.id) === String(id));
    if(found && userAllowed(found)){
      user = found;
      showApp();
    }
  }

  function statusOf(order){ return lower(order.status); }
  function isCancelled(order){ return ["geannuleerd","geannuleerde","annulering","cancelled","canceled"].includes(statusOf(order)); }
  function isDone(order){ return ["uitgevoerd","afgerond","voltooid","done","klaar"].includes(statusOf(order)); }
  function isDeleted(order){ return ["verwijderd","gewist","deleted","trash"].includes(statusOf(order)); }

  function orderStart(order){ return clean(order.start || order.dateStart || order.startDate || order.date || ""); }
  function orderEnd(order){ return clean(order.end || order.dateEnd || order.endDate || orderStart(order)); }
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

  function assignedToUser(order){
    const userId = String(user.id || "");
    const userName = lower(user.name || "");
    const driverId = String(order.driverId || order.bezorgerId || order.userId || "");
    const driverName = lower(order.driverName || order.driver || order.bezorger || "");

    if(driverId && userId && driverId === userId) return true;
    if(driverName && userName && driverName === userName) return true;

    // Planner mag alles zien als hij opdracht-recht heeft.
    if(lower(user.role) === "planner" && hasRight("orders")) return true;

    return false;
  }

  function visibleOrder(order){
    if(isCancelled(order) || isDone(order) || isDeleted(order)) return false;
    if(dateTime(orderEnd(order)) < todayTime()) return false;
    return assignedToUser(order);
  }

  function addressOf(order){
    const parts = [];
    function add(v){
      v = clean(v);
      if(v && !parts.includes(v)) parts.push(v);
    }
    add(order.locationName);
    add(order.locationAddress);
    add(order.locationStreet);
    add(order.locationZip);
    add(order.locationCity);
    add(order.address);
    add(order.street);
    add(order.zip);
    add(order.city);
    if(order.location && typeof order.location === "object"){
      add(order.location.name);
      add(order.location.address);
      add(order.location.street);
      add(order.location.zip);
      add(order.location.city);
    }
    return parts.join(", ");
  }

  function customerName(order){
    return clean(order.customerName || (order.customer && order.customer.name) || "");
  }

  function customerPhone(order){
    return clean(order.customerPhone || order.phone || (order.customer && order.customer.phone) || "");
  }

  function materialText(order){
    const mats = order.materials || order.mats || [];
    if(!Array.isArray(mats)) return "";
    return mats.map(m => typeof m === "string" ? m : (m.code || m.name || "")).filter(Boolean).join(", ");
  }

  function routeUrl(type, address){
    const q = encodeURIComponent(address || "");
    if(type === "waze") return `https://waze.com/ul?q=${q}&navigate=yes`;
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  function getOrders(){
    return (state.orders || [])
      .filter(visibleOrder)
      .sort((a,b)=>dateTime(orderStart(a)) - dateTime(orderStart(b)));
  }

  function card(order){
    const addr = addressOf(order);
    const phone = customerPhone(order);
    const start = orderStart(order);
    const end = orderEnd(order);
    const dateLine = start && end && start !== end ? `${niceDate(start)} t/m ${niceDate(end)}` : niceDate(start || end);

    return `
      <article class="card order" data-id="${esc(order.id)}">
        <div class="order-title">${esc(order.number || "")} - ${esc(order.title || "Zonder titel")}</div>
        <div class="rights">
          <span class="badge">${esc(order.status || "Open")}</span>
          ${hasRight("agenda") ? `<span class="badge">Agenda</span>` : ""}
          ${hasRight("gps") ? `<span class="badge">Route</span>` : ""}
        </div>
        <div class="meta">
          <div>📅 <strong>${esc(dateLine)}</strong></div>
          <div>👤 ${esc(customerName(order) || "Klant onbekend")}</div>
          <div>📍 ${esc(addr || "Adres onbekend")}</div>
          <div>📦 ${esc(materialText(order) || "Geen materialen")}</div>
        </div>
        <div class="row">
          ${hasRight("gps") ? `<a class="btn btn-green" href="${esc(routeUrl("waze", addr))}" target="_blank" rel="noopener">Waze</a>` : ""}
          ${hasRight("gps") ? `<a class="btn btn-dark" href="${esc(routeUrl("maps", addr))}" target="_blank" rel="noopener">Maps</a>` : ""}
          ${phone ? `<a class="btn" href="tel:${esc(phone)}">Bel klant</a>` : `<button type="button" class="btn">Geen tel.</button>`}
          <button type="button" class="btn btn-orange" data-report="${esc(order.id)}">Melding</button>
          ${hasRight("agenda") ? `<button type="button" class="btn btn-dark" data-agenda="${esc(order.id)}">Agenda info</button>` : ""}
          ${hasRight("resolve") ? `<button type="button" class="btn btn-full btn-green" data-done="${esc(order.id)}">Afmelden / uitgevoerd</button>` : ""}
        </div>
      </article>
    `;
  }

  function showApp(){
    $("loginBox").classList.add("hidden");
    $("appBox").classList.remove("hidden");
    render();
  }

  function render(){
    state = loadState();
    if(user){
      const fresh = (state.users || []).find(u => String(u.id) === String(user.id));
      if(fresh) user = fresh;
    }

    const orders = getOrders();
    $("orders").innerHTML = orders.length ? orders.map(card).join("") : `<div class="empty">Geen opdrachten voor deze gebruiker.</div>`;
    bindActions();
  }

  function findOrder(id){
    return (state.orders || []).find(o => String(o.id) === String(id));
  }

  function bindActions(){
    document.querySelectorAll("[data-done]").forEach(btn=>{
      btn.onclick = () => {
        const order = findOrder(btn.dataset.done);
        if(!order) return;
        if(!confirm("Opdracht afmelden als uitgevoerd?")) return;
        order.status = "Uitgevoerd";
        order.doneAt = new Date().toISOString();
        order.doneBy = user.name || "";
        saveState();
        toast("Opdracht afgemeld");
        render();
      };
    });

    document.querySelectorAll("[data-report]").forEach(btn=>{
      btn.onclick = () => {
        const order = findOrder(btn.dataset.report);
        if(!order) return;
        const text = prompt("Melding voor planning:", "");
        if(!text) return;
        state.alerts = Array.isArray(state.alerts) ? state.alerts : [];
        state.alerts.push({
          id:"a_" + Math.random().toString(36).slice(2,10),
          orderId: order.id || "",
          orderNumber: order.number || "",
          title:"Mobiele melding",
          text,
          resolved:false,
          createdAt:new Date().toISOString(),
          from:user.name || ""
        });
        saveState();
        toast("Melding verstuurd");
      };
    });

    document.querySelectorAll("[data-agenda]").forEach(btn=>{
      btn.onclick = () => {
        const order = findOrder(btn.dataset.agenda);
        if(!order) return;
        toast(`Agenda: ${niceDate(orderStart(order))} ${order.startTime || ""} - ${order.endTime || ""}`);
      };
    });
  }

  function bind(){
    $("loginBtn").onclick = login;
    $("loginPin").addEventListener("keydown", e => {
      if(e.key === "Enter") login();
    });
    $("logoutBtn").onclick = logout;
    $("refreshBtn").onclick = render;
    $("searchBox").oninput = () => {
      const q = lower($("searchBox").value);
      document.querySelectorAll(".order").forEach(el=>{
        el.style.display = !q || lower(el.innerText).includes(q) ? "" : "none";
      });
    };
  }

  populateUsers();
  bind();
  restoreSession();
})();
