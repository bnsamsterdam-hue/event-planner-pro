/* ============================================================
   V12 PRO COMPLETE FIX
   Plak dit HELE bestand onderaan je huidige werkende app.js.
   Doel:
   - Werkende PIN met Enter + leegmaken na gebruik
   - Knop "Kopie opdracht" naast Extra
   - Complete opdracht kopiëren met nieuw opdrachtnummer
   - Materiaal blokkeren bij gereserveerd / schade / vermissing / defect / reparatie
   - Materiaal info tonen bij klik
   - Materiaal wijzigen / vrijgeven
   - Meldingenbalk leesbaar + wissen + gerepareerd/vrijgeven
   - Groene materiaalkleur koppelen aan thema-kleur
   - Waze / Google Maps openen verbeteren
   ============================================================ */

(function () {
  "use strict";

  /* =========================
     BASIS INSTELLINGEN
     ========================= */

  const V12_FIX = {
    adminPin: localStorage.getItem("adminPin") || "1234",
    themeMaterialColor: localStorage.getItem("themeMaterialColor") || localStorage.getItem("themeColor") || "#2563eb",
    blockedStatuses: ["gereserveerd", "schade", "vermissing", "defect", "storing", "reparatie"],
    freeStatuses: ["vrij", "", null, undefined],
    materialStorageKey: "v12_material_database",
    orderStorageKey: "v12_orders",
    notificationStorageKey: "v12_notifications"
  };

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function cleanText(value) {
    return String(value || "").trim();
  }

  function nowId(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Kon opslag niet lezen:", key, e);
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function showToast(message, type) {
    let box = qs("#v12Toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "v12Toast";
      box.style.position = "fixed";
      box.style.left = "50%";
      box.style.bottom = "22px";
      box.style.transform = "translateX(-50%)";
      box.style.zIndex = "999999";
      box.style.padding = "12px 18px";
      box.style.borderRadius = "10px";
      box.style.fontWeight = "700";
      box.style.boxShadow = "0 8px 30px rgba(0,0,0,.25)";
      document.body.appendChild(box);
    }

    box.textContent = message;
    box.style.background = type === "error" ? "#dc2626" : type === "warn" ? "#f59e0b" : "#16a34a";
    box.style.color = "#fff";
    box.style.display = "block";

    clearTimeout(box._timer);
    box._timer = setTimeout(() => {
      box.style.display = "none";
    }, 3500);
  }

  /* =========================
     1. PIN FIX
     ========================= */

  function findPinInput() {
    return (
      qs("#pinInput") ||
      qs("#adminPin") ||
      qs("input[name='pin']") ||
      qs("input[type='password']") ||
      qsa("input").find(i => /pin|code|admin/i.test(i.id + " " + i.name + " " + i.placeholder))
    );
  }

  function findPinScreen() {
    return (
      qs("#pinScreen") ||
      qs("#pinOverlay") ||
      qs(".pin-screen") ||
      qs(".pinOverlay") ||
      qs("[data-pin-screen]")
    );
  }

  function findAdminPanel() {
    return (
      qs("#adminPanel") ||
      qs("#admin") ||
      qs(".admin-panel") ||
      qs("[data-admin-panel]")
    );
  }

  window.resetAdminPinInput = function resetAdminPinInput() {
    const input = findPinInput();
    if (input) {
      input.value = "";
      input.blur();
      setTimeout(() => input.focus && input.focus(), 80);
    }
  };

  window.checkPin = function checkPin() {
    const input = findPinInput();

    if (!input) {
      showToast("PIN invoerveld niet gevonden. Controleer id pinInput/adminPin.", "error");
      return false;
    }

    const value = cleanText(input.value);
    const correctPin = cleanText(localStorage.getItem("adminPin") || V12_FIX.adminPin);

    if (value === correctPin) {
      window.unlockAdminPanel();
      window.resetAdminPinInput();
      return true;
    }

    showToast("Foute pincode", "error");
    window.resetAdminPinInput();
    return false;
  };

  window.unlockAdminPanel = function unlockAdminPanel() {
    const screen = findPinScreen();
    const panel = findAdminPanel();

    if (screen) {
      screen.style.display = "none";
      screen.classList.add("hidden");
    }

    if (panel) {
      panel.style.display = "block";
      panel.classList.remove("hidden");
      panel.style.visibility = "visible";
      panel.style.opacity = "1";
    }

    document.body.classList.add("admin-unlocked");
    localStorage.setItem("adminUnlocked", "1");
    showToast("Admin geopend", "ok");
  };

  window.lockAdminPanel = function lockAdminPanel() {
    const screen = findPinScreen();
    const panel = findAdminPanel();

    if (screen) {
      screen.style.display = "block";
      screen.classList.remove("hidden");
    }

    if (panel) {
      panel.style.display = "none";
      panel.classList.add("hidden");
    }

    document.body.classList.remove("admin-unlocked");
    localStorage.removeItem("adminUnlocked");
    window.resetAdminPinInput();
  };

  function initPinFix() {
    const input = findPinInput();

    if (input) {
      input.value = "";
      input.autocomplete = "off";
      input.inputMode = "numeric";

      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          window.checkPin();
        }
      });
    }

    qsa("button, input[type='button'], input[type='submit']").forEach(btn => {
      const txt = cleanText(btn.textContent || btn.value).toLowerCase();
      if (txt.includes("pin") || txt.includes("login") || txt.includes("admin") || txt.includes("open")) {
        if (!btn.dataset.v12PinBound) {
          btn.dataset.v12PinBound = "1";
          btn.addEventListener("click", function () {
            const active = document.activeElement;
            if (active && active === input) window.checkPin();
          });
        }
      }
    });
  }

  /* =========================
     2. MATERIAAL DATABASE
     ========================= */

  function getMaterials() {
    return readJson(V12_FIX.materialStorageKey, {});
  }

  function saveMaterials(materials) {
    writeJson(V12_FIX.materialStorageKey, materials || {});
  }

  function normalizeMaterialName(name) {
    return cleanText(name).toLowerCase();
  }

  function getMaterialStatus(name) {
    const db = getMaterials();
    const key = normalizeMaterialName(name);
    const item = db[key];

    if (!item) {
      return {
        name: cleanText(name),
        status: "vrij"
      };
    }

    return item;
  }

  function setMaterialStatus(name, data) {
    const db = getMaterials();
    const key = normalizeMaterialName(name);

    db[key] = Object.assign(
      {
        name: cleanText(name),
        status: "vrij",
        klant: "",
        opdrachtNr: "",
        datumVan: "",
        datumTot: "",
        melding: "",
        inzetbaar: true
      },
      db[key] || {},
      data || {}
    );

    saveMaterials(db);
    renderMaterialBadges();
    renderNotifications();
  }

  function isMaterialBlocked(item) {
    if (!item) return false;
    const status = normalizeMaterialName(item.status);
    return V12_FIX.blockedStatuses.includes(status);
  }

  function dateRangesOverlap(aStart, aEnd, bStart, bEnd) {
    if (!aStart || !bStart) return true;

    const startA = new Date(aStart);
    const endA = new Date(aEnd || aStart);
    const startB = new Date(bStart);
    const endB = new Date(bEnd || bStart);

    return startA <= endB && startB <= endA;
  }

  function currentOrderDates() {
    const start =
      qs("#datumVan") ||
      qs("#startDatum") ||
      qs("#dateFrom") ||
      qs("input[name='datumVan']") ||
      qs("input[type='date']");

    const end =
      qs("#datumTot") ||
      qs("#eindDatum") ||
      qs("#dateTo") ||
      qs("input[name='datumTot']");

    return {
      van: start ? start.value : "",
      tot: end ? end.value : start ? start.value : ""
    };
  }

  function currentCustomerName() {
    const el =
      qs("#klantNaam") ||
      qs("#customerName") ||
      qs("input[name='klant']") ||
      qs("input[name='klantNaam']");

    return el ? el.value : "";
  }

  function currentOrderNumber() {
    const el =
      qs("#opdrachtNr") ||
      qs("#opdrachtNummer") ||
      qs("input[name='opdrachtNr']") ||
      qs("input[name='opdrachtNummer']");

    return el ? el.value : "";
  }

  function materialNameFromElement(el) {
    return cleanText(
      el.dataset.material ||
      el.dataset.name ||
      el.getAttribute("data-materiaal") ||
      el.textContent
    ).replace(/\b(vrij|gereserveerd|schade|vermissing|defect|storing|reparatie)\b/gi, "").trim();
  }

  function isMaterialElement(el) {
    if (!el) return false;

    const text = (el.className + " " + el.id + " " + (el.dataset.material || "") + " " + el.textContent).toLowerCase();

    return (
      el.matches("[data-material], [data-materiaal], .materiaal, .material, .material-item, .materiaal-item") ||
      text.includes("materiaal") ||
      el.closest("#materialen, #materials, .materialen, .materials")
    );
  }

  function showMaterialInfo(name) {
    const item = getMaterialStatus(name);
    const blocked = isMaterialBlocked(item);

    let msg = "Materiaal: " + item.name + "\nStatus: " + (item.status || "vrij");

    if (blocked) {
      msg += "\nKlant: " + (item.klant || "onbekend");
      msg += "\nOpdracht: " + (item.opdrachtNr || "onbekend");
      msg += "\nDatum: " + (item.datumVan || "-") + " t/m " + (item.datumTot || item.datumVan || "-");
      if (item.melding) msg += "\nMelding: " + item.melding;
    }

    const choice = confirm(
      msg +
      "\n\nKlik OK om dit materiaal te wijzigen/vrij te geven.\nKlik Annuleren om niets te doen."
    );

    if (choice) {
      openMaterialEdit(name);
    }
  }

  window.openMaterialEdit = function openMaterialEdit(name) {
    const item = getMaterialStatus(name);

    const status = prompt(
      "Status voor " + item.name + ":\nKies: vrij, gereserveerd, schade, vermissing, defect, reparatie",
      item.status || "vrij"
    );

    if (status === null) return;

    const newStatus = cleanText(status).toLowerCase();

    let data = {
      status: newStatus,
      inzetbaar: newStatus === "vrij"
    };

    if (newStatus !== "vrij") {
      data.klant = prompt("Klant:", item.klant || currentCustomerName() || "") || "";
      data.opdrachtNr = prompt("Opdracht nummer:", item.opdrachtNr || currentOrderNumber() || "") || "";
      data.datumVan = prompt("Datum van:", item.datumVan || currentOrderDates().van || "") || "";
      data.datumTot = prompt("Datum tot:", item.datumTot || currentOrderDates().tot || "") || "";
      data.melding = prompt("Schade/vermissing/opmerking:", item.melding || "") || "";
    } else {
      data.klant = "";
      data.opdrachtNr = "";
      data.datumVan = "";
      data.datumTot = "";
      data.melding = "";
    }

    setMaterialStatus(name, data);
    showToast("Materiaal bijgewerkt: " + item.name, "ok");
  };

  function blockMaterialClick(e) {
    const el = e.target.closest("[data-material], [data-materiaal], .materiaal, .material, .material-item, .materiaal-item, button, li, div");

    if (!el || !isMaterialElement(el)) return;

    const name = materialNameFromElement(el);
    if (!name) return;

    const item = getMaterialStatus(name);

    if (isMaterialBlocked(item)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      showMaterialInfo(name);
      return false;
    }

    if (!el.dataset.v12FreeClickBound) {
      el.dataset.v12FreeClickBound = "1";
    }
  }

  function reserveSelectedMaterialsForCurrentOrder() {
    const selected = qsa(
      "[data-material].selected, [data-materiaal].selected, .materiaal.selected, .material.selected, .materiaal-item.selected, .material-item.selected, input[type='checkbox'][data-material]:checked, input[type='checkbox'][data-materiaal]:checked"
    );

    const dates = currentOrderDates();
    const klant = currentCustomerName();
    const opdrachtNr = currentOrderNumber();

    selected.forEach(el => {
      const name = materialNameFromElement(el);
      if (!name) return;

      const item = getMaterialStatus(name);

      if (isMaterialBlocked(item)) return;

      setMaterialStatus(name, {
        status: "gereserveerd",
        klant: klant,
        opdrachtNr: opdrachtNr,
        datumVan: dates.van,
        datumTot: dates.tot,
        inzetbaar: false
      });
    });
  }

  function renderMaterialBadges() {
    qsa("[data-material], [data-materiaal], .materiaal, .material, .material-item, .materiaal-item").forEach(el => {
      const name = materialNameFromElement(el);
      if (!name) return;

      const item = getMaterialStatus(name);
      const status = normalizeMaterialName(item.status);
      const blocked = isMaterialBlocked(item);

      el.dataset.v12Status = status || "vrij";
      el.style.borderColor = blocked ? "#dc2626" : V12_FIX.themeMaterialColor;
      el.style.backgroundColor = blocked ? "#fee2e2" : "rgba(37,99,235,.08)";
      el.style.color = blocked ? "#991b1b" : "";

      let badge = qs(".v12-material-status", el);
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "v12-material-status";
        badge.style.marginLeft = "8px";
        badge.style.padding = "2px 7px";
        badge.style.borderRadius = "999px";
        badge.style.fontSize = "12px";
        badge.style.fontWeight = "800";
        el.appendChild(badge);
      }

      badge.textContent = blocked ? status : "vrij";
      badge.style.background = blocked ? "#dc2626" : V12_FIX.themeMaterialColor;
      badge.style.color = "#fff";
    });
  }

  function initMaterialSystem() {
    document.addEventListener("click", blockMaterialClick, true);

    qsa("button").forEach(btn => {
      const txt = cleanText(btn.textContent).toLowerCase();

      if ((txt.includes("opslaan") || txt.includes("bewaar")) && !btn.dataset.v12ReserveBound) {
        btn.dataset.v12ReserveBound = "1";
        btn.addEventListener("click", function () {
          setTimeout(reserveSelectedMaterialsForCurrentOrder, 50);
        });
      }
    });

    renderMaterialBadges();
  }

  /* =========================
     3. KOPIE OPDRACHT
     ========================= */

  function generateOrderNumber() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return "OP-" + y + m + day + "-" + rand;
  }

  function findExtraButton() {
    return qsa("button, a").find(el => cleanText(el.textContent).toLowerCase() === "extra" || cleanText(el.textContent).toLowerCase().includes("extra"));
  }

  function addCopyButton() {
    if (qs("#v12CopyOrderBtn")) return;

    const extra = findExtraButton();
    const btn = document.createElement("button");

    btn.id = "v12CopyOrderBtn";
    btn.type = "button";
    btn.textContent = "Kopie opdracht";
    btn.className = extra ? extra.className : "btn";
    btn.style.marginLeft = "8px";
    btn.style.fontWeight = "800";

    btn.addEventListener("click", copyCurrentOrder);

    if (extra && extra.parentNode) {
      extra.parentNode.insertBefore(btn, extra.nextSibling);
    } else {
      const top =
        qs("#planner") ||
        qs("#app") ||
        qs("main") ||
        document.body;

      top.insertBefore(btn, top.firstChild);
    }
  }

  function copyCurrentOrder() {
    const newNr = generateOrderNumber();

    qsa("input, textarea, select").forEach(el => {
      const idName = (el.id + " " + el.name + " " + el.placeholder).toLowerCase();

      if (idName.includes("opdracht") && (idName.includes("nr") || idName.includes("nummer"))) {
        el.value = newNr;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      if (
        idName.includes("datum") ||
        idName.includes("date") ||
        idName.includes("van") ||
        idName.includes("tot")
      ) {
        if (el.type === "date" || idName.includes("datum") || idName.includes("date")) {
          el.value = "";
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });

    const orders = readJson(V12_FIX.orderStorageKey, []);
    orders.push({
      id: nowId("order-copy"),
      opdrachtNr: newNr,
      copiedAt: new Date().toISOString(),
      note: "Gekopieerde opdracht. Controleer datum en materiaal en klik daarna opslaan."
    });
    writeJson(V12_FIX.orderStorageKey, orders);

    showToast("Opdracht gekopieerd. Nieuw opdracht nr: " + newNr + ". Vul nu alleen de nieuwe datum in.", "ok");
  }

  /* =========================
     4. MELDINGEN
     ========================= */

  function getNotifications() {
    return readJson(V12_FIX.notificationStorageKey, []);
  }

  function saveNotifications(list) {
    writeJson(V12_FIX.notificationStorageKey, list || []);
  }

  window.v12AddNotification = function v12AddNotification(message, data) {
    const list = getNotifications();

    list.unshift(Object.assign({
      id: nowId("msg"),
      message: message,
      status: "open",
      createdAt: new Date().toISOString()
    }, data || {}));

    saveNotifications(list);
    renderNotifications();
  };

  window.v12ClearNotification = function v12ClearNotification(id) {
    const list = getNotifications().filter(n => n.id !== id);
    saveNotifications(list);
    renderNotifications();
  };

  window.v12MarkNotificationFixed = function v12MarkNotificationFixed(id) {
    const list = getNotifications().map(n => {
      if (n.id === id) {
        n.status = "gerepareerd";
        n.fixedAt = new Date().toISOString();

        if (n.material) {
          setMaterialStatus(n.material, {
            status: "vrij",
            klant: "",
            opdrachtNr: "",
            datumVan: "",
            datumTot: "",
            melding: "",
            inzetbaar: true
          });
        }
      }

      return n;
    });

    saveNotifications(list);
    renderNotifications();
  };

  function findNotificationBar() {
    return (
      qs("#meldingen") ||
      qs("#meldingBar") ||
      qs("#notificationBar") ||
      qs(".meldingen") ||
      qs(".notification-bar")
    );
  }

  function renderNotifications() {
    let bar = findNotificationBar();

    if (!bar) {
      bar = document.createElement("div");
      bar.id = "meldingBar";
      document.body.insertBefore(bar, document.body.firstChild);
    }

    const list = getNotifications();

    bar.style.display = "block";
    bar.style.background = list.length ? "#fff7ed" : "#f1f5f9";
    bar.style.color = "#111827";
    bar.style.border = "2px solid " + (list.length ? "#f97316" : "#cbd5e1");
    bar.style.padding = "10px";
    bar.style.margin = "8px 0";
    bar.style.borderRadius = "10px";
    bar.style.fontWeight = "700";
    bar.style.zIndex = "9999";

    if (!list.length) {
      bar.innerHTML = "<strong>Meldingen:</strong> geen open meldingen";
      return;
    }

    bar.innerHTML = "<strong>Meldingen:</strong>";

    list.forEach(n => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      row.style.flexWrap = "wrap";
      row.style.marginTop = "8px";
      row.style.padding = "8px";
      row.style.background = "#ffffff";
      row.style.borderRadius = "8px";
      row.style.border = "1px solid #fed7aa";

      const text = document.createElement("span");
      text.textContent = (n.status === "gerepareerd" ? "✓ " : "⚠ ") + n.message;
      text.style.flex = "1";

      const fixed = document.createElement("button");
      fixed.type = "button";
      fixed.textContent = "Gerepareerd / vrijgeven";
      fixed.onclick = () => window.v12MarkNotificationFixed(n.id);

      const clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = "Wissen";
      clear.onclick = () => window.v12ClearNotification(n.id);

      row.appendChild(text);
      row.appendChild(fixed);
      row.appendChild(clear);
      bar.appendChild(row);
    });
  }

  /* =========================
     5. THEMA / GROENE KLEUR FIX
     ========================= */

  function applyMaterialThemeColor() {
    const color =
      localStorage.getItem("themeMaterialColor") ||
      localStorage.getItem("themeColor") ||
      V12_FIX.themeMaterialColor;

    const styleId = "v12MaterialColorFix";
    let style = qs("#" + styleId);

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }

    style.textContent = `
      :root {
        --materiaal-kleur: ${color};
        --material-color: ${color};
      }

      .materiaal:not([data-v12-status="gereserveerd"]):not([data-v12-status="schade"]):not([data-v12-status="vermissing"]):not([data-v12-status="defect"]),
      .material:not([data-v12-status="gereserveerd"]):not([data-v12-status="schade"]):not([data-v12-status="vermissing"]):not([data-v12-status="defect"]),
      .materiaal-item:not([data-v12-status="gereserveerd"]):not([data-v12-status="schade"]):not([data-v12-status="vermissing"]):not([data-v12-status="defect"]),
      .material-item:not([data-v12-status="gereserveerd"]):not([data-v12-status="schade"]):not([data-v12-status="vermissing"]):not([data-v12-status="defect"]),
      [data-material]:not([data-v12-status="gereserveerd"]):not([data-v12-status="schade"]):not([data-v12-status="vermissing"]):not([data-v12-status="defect"]),
      [data-materiaal]:not([data-v12-status="gereserveerd"]):not([data-v12-status="schade"]):not([data-v12-status="vermissing"]):not([data-v12-status="defect"]) {
        border-color: var(--materiaal-kleur) !important;
      }
    `;

    renderMaterialBadges();
  }

  window.v12SetMaterialColor = function v12SetMaterialColor(color) {
    localStorage.setItem("themeMaterialColor", color);
    V12_FIX.themeMaterialColor = color;
    applyMaterialThemeColor();
    showToast("Materiaalkleur aangepast", "ok");
  };

  /* =========================
     6. WAZE / GOOGLE MAPS FIX
     ========================= */

  function getAddressFromForm() {
    const candidates = [
      "#adres",
      "#address",
      "#straat",
      "#locatie",
      "#location",
      "input[name='adres']",
      "input[name='address']",
      "input[name='locatie']"
    ];

    const parts = [];

    candidates.forEach(sel => {
      const el = qs(sel);
      if (el && el.value && !parts.includes(el.value)) parts.push(el.value);
    });

    const postcode = qs("#postcode, input[name='postcode']");
    const plaats = qs("#plaats, #city, input[name='plaats'], input[name='city']");

    if (postcode && postcode.value) parts.push(postcode.value);
    if (plaats && plaats.value) parts.push(plaats.value);

    return parts.join(" ");
  }

  window.openWaze = function openWaze(address) {
    const q = encodeURIComponent(address || getAddressFromForm());

    if (!q) {
      showToast("Geen adres gevonden voor Waze", "warn");
      return;
    }

    window.open("https://waze.com/ul?q=" + q + "&navigate=yes", "_blank");
  };

  window.openGoogleMaps = function openGoogleMaps(address) {
    const q = encodeURIComponent(address || getAddressFromForm());

    if (!q) {
      showToast("Geen adres gevonden voor Google Maps", "warn");
      return;
    }

    window.open("https://www.google.com/maps/search/?api=1&query=" + q, "_blank");
  };

  function bindNavigationButtons() {
    qsa("button, a").forEach(el => {
      const txt = cleanText(el.textContent).toLowerCase();

      if (txt.includes("waze") && !el.dataset.v12WazeBound) {
        el.dataset.v12WazeBound = "1";
        el.addEventListener("click", function (e) {
          e.preventDefault();
          window.openWaze();
        });
      }

      if ((txt.includes("google maps") || txt.includes("googlemaps") || txt === "maps") && !el.dataset.v12MapsBound) {
        el.dataset.v12MapsBound = "1";
        el.addEventListener("click", function (e) {
          e.preventDefault();
          window.openGoogleMaps();
        });
      }
    });
  }

  /* =========================
     7. INIT
     ========================= */

  function initV12ProFix() {
    initPinFix();
    initMaterialSystem();
    addCopyButton();
    renderNotifications();
    applyMaterialThemeColor();
    bindNavigationButtons();

    const observer = new MutationObserver(function () {
      addCopyButton();
      bindNavigationButtons();
      renderMaterialBadges();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log("V12 PRO COMPLETE FIX geladen");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initV12ProFix);
  } else {
    initV12ProFix();
  }
})();
