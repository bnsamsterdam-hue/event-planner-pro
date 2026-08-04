/* material-fix.js
   Losse patch voor Event Planner PRO.
   Upload dit bestand naast index.html, styles.css en app.js.
   Voeg in index.html ONDER <script src="app.js"></script> deze regel toe:
   <script src="material-fix.js"></script>
*/
(function(){
  "use strict";

  const CAT_COLORS = {
    TW: "#1683d8",
    TO: "#f97316",
    KW: "#22c55e",
    KA: "#a855f7",
    SL: "#eab308",
    EXTRA: "#334155"
  };

  const $ = (id) => document.getElementById(id);

  function cleanCat(cat){
    return String(cat || "EXTRA").trim().toUpperCase();
  }

  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, function(ch){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
    });
  }

  function mats(){
    if (window.state && Array.isArray(window.state.materials)) return window.state.materials;
    try {
      if (typeof state !== "undefined" && Array.isArray(state.materials)) return state.materials;
    } catch(e){}
    if (window.INITIAL_STATE && Array.isArray(window.INITIAL_STATE.materials)) return window.INITIAL_STATE.materials;
    try {
      if (typeof INITIAL_STATE !== "undefined" && Array.isArray(INITIAL_STATE.materials)) return INITIAL_STATE.materials;
    } catch(e){}
    return [];
  }

  function statusInfo(status){
    const s = String(status || "free").toLowerCase();
    if (s === "reserved" || s === "gereserveerd") return ["Gereserveerd", "reserved"];
    if (s === "defect") return ["Defect", "defect"];
    if (s === "inactive" || s === "niet actief" || s === "niet beschikbaar") return ["Niet actief", "inactive"];
    return ["Vrij", "free"];
  }

  function firstCat(){
    const all = [...new Set(mats().map(m => cleanCat(m.cat || m.rubriek || m.category)).filter(Boolean))].sort();
    return all[0] || "TW";
  }

  function activeCat(){
    let cat = firstCat();
    try { if (typeof currentCat !== "undefined" && currentCat) cat = currentCat; } catch(e){}
    if (window.currentCat) cat = window.currentCat;
    return cleanCat(cat);
  }

  function setActiveCat(cat){
    const c = cleanCat(cat);
    window.currentCat = c;
    try { currentCat = c; } catch(e){}
    return c;
  }

  function catColor(cat){
    return CAT_COLORS[cleanCat(cat)] || CAT_COLORS.EXTRA;
  }

  function renderCatsFixed(){
    const box = $("materialCats");
    if (!box) return;

    const allCats = [...new Set(mats().map(m => cleanCat(m.cat)))].sort();
    const cats = allCats.length ? allCats : ["TW","TO","KW","EXTRA"];
    let active = activeCat();
    if (!cats.includes(active)) active = cats[0] || firstCat();
    setActiveCat(active);

    box.innerHTML = cats.map(cat => `
      <button type="button"
        class="${cat === active ? "active" : ""}"
        data-cat="${esc(cat)}"
        style="border-bottom:5px solid ${catColor(cat)}">
        ${esc(cat)}
      </button>
    `).join("");

    box.querySelectorAll("button").forEach(btn => {
      btn.onclick = function(){
        setActiveCat(btn.dataset.cat);
        renderCatsFixed();
        renderMaterialsFixed(btn.dataset.cat);
      };
    });
  }

  function renderLegendFixed(){
    const panel = $("materialPanel");
    if (!panel) return;

    panel.querySelectorAll(".material-status-legend").forEach((el, idx) => {
      if (idx > 0) el.remove();
    });

    let legend = panel.querySelector(".material-status-legend");
    if (!legend) {
      legend = document.createElement("div");
      legend.className = "material-status-legend";
      const workspace = panel.querySelector(".material-workspace");
      if (workspace) workspace.insertAdjacentElement("beforebegin", legend);
      else panel.prepend(legend);
    }

    legend.innerHTML = `
      <strong>Materiaal status:</strong>
      <span class="badge status-free"><i></i>Vrij</span>
      <span class="badge status-reserved"><i></i>Gereserveerd</span>
      <span class="badge status-defect"><i></i>Defect</span>
      <span class="badge status-inactive"><i></i>Niet actief</span>
    `;
  }

  function renderMaterialsFixed(cat){
    const list = $("materialList");
    if (!list) return;

    const current = setActiveCat(cat || activeCat());
    const search = ($("materialSearch")?.value || "").toLowerCase().trim();

    const rows = mats()
      .filter(m => cleanCat(m.cat) === current)
      .filter(m => {
        if (!search) return true;
        return `${m.code || ""} ${m.name || ""} ${m.notes || ""} ${m.price || ""}`.toLowerCase().includes(search);
      });

    list.innerHTML = rows.length ? rows.map(m => {
      const st = window.BNS_V392 && typeof window.BNS_V392.statusFor === "function" ? window.BNS_V392.statusFor(m) : null;
      const fallback = statusInfo(m.status);
      const txt = st && st.label ? st.label : fallback[0];
      const cls = st && st.key ? st.key : fallback[1];
      const color = catColor(m.cat);
      const id = esc(m.id || "");
      const productNaam = m.product || m.searchName || m.zoeknaam || m.type || m.name || "";
      const productOmschrijving = m.description || m.beschrijving || m.desc || m.notes || "";
      return `
        <div class="material-row status-${cls}" style="--cat-color:${color};--mat-cat-color:${color}" onclick="if(window.addMat){addMat('${id}')}">
          <div class="catbar" aria-hidden="true"></div>
          <div class="mat-text">
            <b>${esc(m.code || "")}</b> ${esc(productNaam)}
            <br><small>${esc(productOmschrijving)}</small>
          </div>
          <span class="badge status-${cls}"><i></i>${esc(txt)}</span>
        </div>
      `;
    }).join("") : `<p class="material-empty">Geen materiaal gevonden bij ${esc(current)}.</p>`;

    renderLegendFixed();
  }

  function install(){
    /* v1-fix: dit forceerde hier, met vertraging (300ms en nogmaals na
       1000ms), window.renderMaterials altijd terug naar de oudere V392-
       module, ongeacht wat er intussen al correct stond (V611, de module
       die vandaag uitgebreid is gestabiliseerd). Dat verklaarde het
       "eerst goed, dan plots weer fout"-patroon. V611 is nu leidend;
       dit bestand grijpt niet meer in als die al aanwezig is. */
    if (window.BNS_V611 && typeof window.BNS_V611.renderMaterials === "function") {
      return;
    }
    if (window.BNS_V392 && typeof window.BNS_V392.renderMaterials === "function") {
      window.renderMaterials = window.BNS_V392.renderMaterials;
      if (typeof window.BNS_V392.toggleMaterial === "function") window.addMat = window.BNS_V392.toggleMaterial;
      try { renderMaterials = window.BNS_V392.renderMaterials; } catch(e){}
      try { addMat = window.BNS_V392.toggleMaterial; } catch(e){}
      try { window.BNS_V392.renderMaterials(window.currentCat || firstCat(), true); } catch(e){}
      return;
    }

    window.renderMaterials = renderMaterialsFixed;
    window.renderCats = renderCatsFixed;

    try { renderMaterials = renderMaterialsFixed; } catch(e){}
    try { renderCats = renderCatsFixed; } catch(e){}

    const search = $("materialSearch");
    if (search && !search.dataset.materialFixBound) {
      search.dataset.materialFixBound = "1";
      search.addEventListener("input", () => renderMaterialsFixed(activeCat()));
    }

    const tabs = document.querySelectorAll(".worktab");
    tabs.forEach(btn => {
      if (btn.dataset.materialFixBound) return;
      btn.dataset.materialFixBound = "1";
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === "materialPanel") setTimeout(() => {
          renderCatsFixed();
          renderMaterialsFixed(activeCat());
        }, 80);
      });
    });

    renderCatsFixed();
    renderMaterialsFixed(activeCat());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(install, 300));
  } else {
    setTimeout(install, 300);
  }

  setTimeout(install, 1000);
})();
