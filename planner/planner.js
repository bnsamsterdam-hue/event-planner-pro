/* BNS Planner Portal V1 - losse map */
(function(){
  "use strict";

  const STORAGE_KEYS = ["event-planner-pro-v87","event-planner-pro-v8","event-planner-pro","bns_event_planner"];
  const SESSION_KEY = "bns_planner_user_id";
  const $ = id => document.getElementById(id);
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
    try{ localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(state)); }catch(e){}
  }

  function clean(v){ return String(v || "").trim(); }
  function lower(v){ return clean(v).toLowerCase(); }
  function esc(v){
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function hasRight(key){ return !!(user && user.rights && user.rights[key]); }
  function isPlannerAllowed(u){
    const role = lower(u.role);
    return role === "planner" || role === "admin" || !!(u.rights && (u.rights.orders || u.rights.admin));
  }

  function populateUsers(){
    const users = (state.users || []).filter(isPlannerAllowed);
    $("loginName").innerHTML = users.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} (${esc(u.role || "Planner")})</option>`).join("") || `<option value="">Geen planner gevonden</option>`;
  }

  function login(){
    const id = $("loginName").value;
    const pin = clean($("loginPin").value);
    const found = (state.users || []).find(u => String(u.id) === String(id) && String(u.pin || "") === pin);
    if(!found){ toast("Naam of PIN klopt niet"); return; }
    if(!isPlannerAllowed(found)){ toast("Geen plannerrechten"); return; }
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
    const found = (state.users || []).find(u => String(u.id) === String(id));
    if(found && isPlannerAllowed(found)){ user = found; showApp(); }
  }

  function statusOf(o){ return lower(o.status); }
  function isDeleted(o){ return ["verwijderd","gewist","deleted","trash"].includes(statusOf(o)); }
  function orderStart(o){ return clean(o.start || o.dateStart || o.startDate || o.date || ""); }
  function orderEnd(o){ return clean(o.end || o.dateEnd || o.endDate || orderStart(o)); }
  function dateTime(v){ const d = new Date(clean(v).slice(0,10)+"T00:00:00"); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); }
  function niceDate(v){ v=clean(v).slice(0,10); const p=v.split("-"); return p.length===3 ? `${p[2]}-${p[1]}-${p[0]}` : v; }

  function addressOf(o){
    const parts = [];
    const add = v => { v=clean(v); if(v && !parts.includes(v)) parts.push(v); };
    [o.locationName,o.locationAddress,o.locationStreet,o.locationZip,o.locationCity,o.address,o.street,o.zip,o.city].forEach(add);
    if(o.location && typeof o.location==="object"){
      [o.location.name,o.location.address,o.location.street,o.location.zip,o.location.city].forEach(add);
    }
    return parts.join(", ");
  }

  function customerName(o){ return clean(o.customerName || (o.customer && o.customer.name) || ""); }
  function driverName(o){ return clean(o.driverName || o.driver || o.bezorger || ""); }
  function materialText(o){
    const mats = o.materials || o.mats || [];
    return Array.isArray(mats) ? mats.map(m=>typeof m==="string" ? m : (m.code || m.name || "")).filter(Boolean).join(", ") : "";
  }

  function orders(){
    return (state.orders || [])
      .filter(o=>!isDeleted(o))
      .sort((a,b)=>dateTime(orderStart(a)) - dateTime(orderStart(b)));
  }

  function card(o){
    const start = orderStart(o);
    const end = orderEnd(o);
    const dateLine = start && end && start !== end ? `${niceDate(start)} t/m ${niceDate(end)}` : niceDate(start || end);
    return `
      <article class="card order" data-id="${esc(o.id)}">
        <div class="order-title">${esc(o.number || "")} - ${esc(o.title || "Zonder titel")}</div>
        <div class="rights">
          <span class="badge">${esc(o.status || "Open")}</span>
          <span class="badge">Bezorger: ${esc(driverName(o) || "niet gekoppeld")}</span>
        </div>
        <div class="meta">
          <div>📅 <strong>${esc(dateLine)}</strong></div>
          <div>👤 ${esc(customerName(o) || "Klant onbekend")}</div>
          <div>🚚 ${esc(driverName(o) || "Geen bezorger")}</div>
          <div>📍 ${esc(addressOf(o) || "Adres onbekend")}</div>
          <div>📦 ${esc(materialText(o) || "Geen materialen")}</div>
        </div>
        <div class="row">
          <button class="btn btn-green" type="button" data-status="${esc(o.id)}" data-value="Uitgevoerd">Uitgevoerd</button>
          <button class="btn btn-orange" type="button" data-status="${esc(o.id)}" data-value="Geannuleerd">Geannuleerd</button>
          <button class="btn btn-dark btn-full" type="button" data-assign="${esc(o.id)}">Bezorger koppelen</button>
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
    const rows = orders();
    $("orders").innerHTML = rows.length ? rows.map(card).join("") : `<div class="empty">Geen opdrachten.</div>`;
    bindActions();
  }

  function findOrder(id){ return (state.orders || []).find(o => String(o.id) === String(id)); }

  function driverUsers(){
    return (state.users || []).filter(u => lower(u.role)==="bezorger" || !!(u.rights && u.rights.gps));
  }

  function bindActions(){
    document.querySelectorAll("[data-status]").forEach(btn=>{
      btn.onclick = () => {
        const o = findOrder(btn.dataset.status);
        if(!o) return;
        if(!confirm(`Status wijzigen naar ${btn.dataset.value}?`)) return;
        o.status = btn.dataset.value;
        o.updatedAt = new Date().toISOString();
        o.updatedBy = user.name || "";
        saveState();
        toast("Status opgeslagen");
        render();
      };
    });

    document.querySelectorAll("[data-assign]").forEach(btn=>{
      btn.onclick = () => {
        const o = findOrder(btn.dataset.assign);
        if(!o) return;
        const drivers = driverUsers();
        if(!drivers.length){ toast("Geen bezorgers gevonden in admin"); return; }
        const list = drivers.map((d,i)=>`${i+1}. ${d.name}`).join("\n");
        const answer = prompt("Kies bezorger nummer:\n" + list, "1");
        const idx = Number(answer) - 1;
        if(!drivers[idx]) return;
        o.driverId = drivers[idx].id;
        o.driverName = drivers[idx].name;
        o.driver = drivers[idx].name;
        o.updatedAt = new Date().toISOString();
        saveState();
        toast("Bezorger gekoppeld");
        render();
      };
    });
  }

  function bind(){
    $("loginBtn").onclick = login;
    $("loginPin").addEventListener("keydown", e => { if(e.key === "Enter") login(); });
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
