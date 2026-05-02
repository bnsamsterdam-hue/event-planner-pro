/* =========================================================
   V12 PRO FIX PATCH
   Plak dit ONDERAAN app.js. Dit bestand wist niets.
   Doel:
   - Kopie opdracht knop naast Extra
   - Materiaal mag alleen gekozen worden als status 'vrij' is
   - Gereserveerd/schade/vermissing toont info bij klik
   - Planner/admin kan materiaal wijzigen/vrijgeven/wisselen
   - Meldingsbalk leesbaar + meldingen afhandelen
   - PIN invoer werkt met Enter en wordt na fout/poging leeg gemaakt
   ========================================================= */
(function v12ProFixPatch() {
  'use strict';

  const STORAGE = {
    materials: 'v12pro.materials.db',
    jobs: 'v12pro.jobs.db',
    notifications: 'v12pro.notifications.db',
    activeJob: 'v12pro.activeJob'
  };

  const STATUS = {
    FREE: 'vrij',
    RESERVED: 'gereserveerd',
    DAMAGE: 'schade',
    MISSING: 'vermissing',
    DEFECT: 'defect',
    REPAIR: 'reparatie'
  };

  const BLOCKED_STATUSES = [
    STATUS.RESERVED,
    STATUS.DAMAGE,
    STATUS.MISSING,
    STATUS.DEFECT,
    STATUS.REPAIR
  ];

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn('[V12 PRO] Kan opslag niet lezen:', key, error);
      return fallback;
    }
  }

  function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toISOString().slice(0, 10);
  }

  function rangesOverlap(startA, endA, startB, endB) {
    const aStart = new Date(startA || '1900-01-01').getTime();
    const aEnd = new Date(endA || startA || '2999-12-31').getTime();
    const bStart = new Date(startB || '1900-01-01').getTime();
    const bEnd = new Date(endB || startB || '2999-12-31').getTime();
    return aStart <= bEnd && bStart <= aEnd;
  }

  function getJobs() {
    return readStore(STORAGE.jobs, []);
  }

  function saveJobs(jobs) {
    writeStore(STORAGE.jobs, jobs);
  }

  function getMaterials() {
    return readStore(STORAGE.materials, []);
  }

  function saveMaterials(materials) {
    writeStore(STORAGE.materials, materials);
  }

  function getNotifications() {
    return readStore(STORAGE.notifications, []);
  }

  function saveNotifications(notifications) {
    writeStore(STORAGE.notifications, notifications);
  }

  function addNotification(type, text, data) {
    const notifications = getNotifications();
    notifications.unshift({
      id: createId('melding'),
      type: type || 'info',
      text: text || '',
      data: data || {},
      status: 'open',
      createdAt: new Date().toISOString()
    });
    saveNotifications(notifications);
    renderNotificationBar();
  }

  function getActiveJobFromForm() {
    const existingNumber = valueOf(['#opdrachtNummer', '#orderNumber', '[name="opdrachtNummer"]', '[name="orderNumber"]']);
    const job = {
      id: existingNumber || createId('opdracht'),
      opdrachtNummer: existingNumber || createJobNumber(),
      klant: valueOf(['#klant', '#customer', '[name="klant"]', '[name="customer"]']),
      telefoon: valueOf(['#telefoon', '#phone', '[name="telefoon"]', '[name="phone"]']),
      adres: valueOf(['#adres', '#address', '[name="adres"]', '[name="address"]']),
      plaats: valueOf(['#plaats', '#city', '[name="plaats"]', '[name="city"]']),
      datumVan: normalizeDate(valueOf(['#datumVan', '#startDatum', '#dateFrom', '[name="datumVan"]', '[name="dateFrom"]'])),
      datumTot: normalizeDate(valueOf(['#datumTot', '#eindDatum', '#dateTo', '[name="datumTot"]', '[name="dateTo"]'])),
      materialen: collectSelectedMaterialIds(),
      extra: valueOf(['#extra', '#extraInfo', '[name="extra"]', '[name="extraInfo"]']),
      updatedAt: new Date().toISOString()
    };
    return job;
  }

  function createJobNumber() {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replaceAll('-', '');
    const count = getJobs().filter(job => String(job.opdrachtNummer || '').includes(ymd)).length + 1;
    return `OPD-${ymd}-${String(count).padStart(3, '0')}`;
  }

  function valueOf(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && 'value' in element) return normalizeText(element.value);
      if (element) return normalizeText(element.textContent);
    }
    return '';
  }

  function setValue(selectors, value) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      if ('value' in element) element.value = value || '';
      else element.textContent = value || '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  function collectSelectedMaterialIds() {
    const checked = Array.from(document.querySelectorAll('[data-material-id].selected, [data-material-id][aria-pressed="true"], input[data-material-id]:checked'));
    return checked.map(el => el.dataset.materialId).filter(Boolean);
  }

  function fillJobForm(job) {
    setValue(['#opdrachtNummer', '#orderNumber', '[name="opdrachtNummer"]', '[name="orderNumber"]'], job.opdrachtNummer);
    setValue(['#klant', '#customer', '[name="klant"]', '[name="customer"]'], job.klant);
    setValue(['#telefoon', '#phone', '[name="telefoon"]', '[name="phone"]'], job.telefoon);
    setValue(['#adres', '#address', '[name="adres"]', '[name="address"]'], job.adres);
    setValue(['#plaats', '#city', '[name="plaats"]', '[name="city"]'], job.plaats);
    setValue(['#datumVan', '#startDatum', '#dateFrom', '[name="datumVan"]', '[name="dateFrom"]'], job.datumVan || '');
    setValue(['#datumTot', '#eindDatum', '#dateTo', '[name="datumTot"]', '[name="dateTo"]'], job.datumTot || '');
    setValue(['#extra', '#extraInfo', '[name="extra"]', '[name="extraInfo"]'], job.extra);
  }

  function saveOrUpdateJob(job) {
    const jobs = getJobs();
    const index = jobs.findIndex(item => item.opdrachtNummer === job.opdrachtNummer || item.id === job.id);
    if (index >= 0) jobs[index] = { ...jobs[index], ...job, updatedAt: new Date().toISOString() };
    else jobs.push({ ...job, createdAt: new Date().toISOString() });
    saveJobs(jobs);
    reserveMaterialsForJob(job);
    localStorage.setItem(STORAGE.activeJob, job.opdrachtNummer);
    return job;
  }

  function copyCurrentJob() {
    const original = getActiveJobFromForm();
    const copy = {
      ...original,
      id: createId('opdracht'),
      opdrachtNummer: createJobNumber(),
      datumVan: '',
      datumTot: '',
      copiedFrom: original.opdrachtNummer || original.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    fillJobForm(copy);
    localStorage.setItem(STORAGE.activeJob, copy.opdrachtNummer);
    addNotification('info', `Opdracht gekopieerd naar ${copy.opdrachtNummer}. Vul alleen de nieuwe datum in en sla op.`, copy);
  }

  function ensureCopyButton() {
    if (document.getElementById('v12-copy-opdracht-btn')) return;

    const extraButton = findButtonByText(['extra', '+ extra']);
    const target = extraButton || document.querySelector('#extra, .extra, [data-action="extra"]');
    const parent = target ? target.parentElement : document.querySelector('main, body');

    const button = document.createElement('button');
    button.id = 'v12-copy-opdracht-btn';
    button.type = 'button';
    button.textContent = 'Kopie opdracht';
    button.className = target && target.className ? target.className : 'v12-copy-opdracht-button';
    button.style.marginLeft = '8px';
    button.addEventListener('click', copyCurrentJob);

    if (target && target.nextSibling) parent.insertBefore(button, target.nextSibling);
    else parent.appendChild(button);
  }

  function findButtonByText(words) {
    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    return buttons.find(button => {
      const text = normalizeText(button.textContent).toLowerCase();
      return words.some(word => text === word || text.includes(word));
    });
  }

  function reserveMaterialsForJob(job) {
    if (!job.datumVan || !Array.isArray(job.materialen)) return;
    const materials = getMaterials();
    const jobs = getJobs();

    for (const materialId of job.materialen) {
      const material = materials.find(item => String(item.id) === String(materialId));
      if (!material) continue;

      const conflict = findMaterialConflict(material.id, job, jobs);
      if (conflict) {
        addNotification('error', `${material.naam || material.name || material.id} is al ${conflict.status} bij ${conflict.klant || 'onbekende klant'}.`, conflict);
        continue;
      }

      material.status = STATUS.RESERVED;
      material.reservedBy = job.klant;
      material.reservedJobNumber = job.opdrachtNummer;
      material.dateFrom = job.datumVan;
      material.dateTo = job.datumTot || job.datumVan;
      material.updatedAt = new Date().toISOString();
    }

    saveMaterials(materials);
    renderMaterialsState();
  }

  function findMaterialConflict(materialId, currentJob, jobs) {
    const materials = getMaterials();
    const material = materials.find(item => String(item.id) === String(materialId));

    if (material && BLOCKED_STATUSES.includes(material.status) && material.reservedJobNumber !== currentJob.opdrachtNummer) {
      if (!currentJob.datumVan || !material.dateFrom) return material;
      if (rangesOverlap(currentJob.datumVan, currentJob.datumTot, material.dateFrom, material.dateTo)) return material;
    }

    for (const job of jobs) {
      if (job.opdrachtNummer === currentJob.opdrachtNummer) continue;
      if (!Array.isArray(job.materialen) || !job.materialen.includes(materialId)) continue;
      if (rangesOverlap(currentJob.datumVan, currentJob.datumTot, job.datumVan, job.datumTot)) {
        return {
          status: STATUS.RESERVED,
          klant: job.klant,
          reservedJobNumber: job.opdrachtNummer,
          dateFrom: job.datumVan,
          dateTo: job.datumTot
        };
      }
    }

    return null;
  }

  function handleMaterialClick(event) {
    const element = event.target.closest('[data-material-id]');
    if (!element) return;

    const materialId = element.dataset.materialId;
    const materials = getMaterials();
    const material = materials.find(item => String(item.id) === String(materialId));
    if (!material) return;

    if (BLOCKED_STATUSES.includes(material.status)) {
      event.preventDefault();
      event.stopPropagation();
      showMaterialInfo(material);
      return false;
    }

    element.classList.toggle('selected');
    element.setAttribute('aria-pressed', element.classList.contains('selected') ? 'true' : 'false');
    return true;
  }

  function showMaterialInfo(material) {
    const text = [
      `Materiaal: ${material.naam || material.name || material.id}`,
      `Status: ${material.status || STATUS.FREE}`,
      material.reservedBy ? `Klant: ${material.reservedBy}` : '',
      material.reservedJobNumber ? `Opdracht: ${material.reservedJobNumber}` : '',
      material.dateFrom ? `Van: ${material.dateFrom}` : '',
      material.dateTo ? `Tot: ${material.dateTo}` : '',
      material.note ? `Notitie: ${material.note}` : '',
      '',
      'Kies OK om te wijzigen/vrijgeven. Kies Annuleren om niets te doen.'
    ].filter(Boolean).join('\n');

    if (window.confirm(text)) editMaterialStatus(material.id);
  }

  function editMaterialStatus(materialId) {
    const materials = getMaterials();
    const material = materials.find(item => String(item.id) === String(materialId));
    if (!material) return;

    const status = window.prompt(
      'Nieuwe status: vrij, gereserveerd, schade, vermissing, defect, reparatie',
      material.status || STATUS.FREE
    );
    if (!status) return;

    const cleanStatus = status.toLowerCase().trim();
    material.status = cleanStatus;

    if (cleanStatus === STATUS.FREE) {
      material.reservedBy = '';
      material.reservedJobNumber = '';
      material.dateFrom = '';
      material.dateTo = '';
      material.note = '';
    } else {
      material.reservedBy = window.prompt('Klant / reden / bezorger:', material.reservedBy || '') || material.reservedBy || '';
      material.reservedJobNumber = window.prompt('Opdracht nummer:', material.reservedJobNumber || '') || material.reservedJobNumber || '';
      material.dateFrom = normalizeDate(window.prompt('Van datum:', material.dateFrom || '')) || material.dateFrom || '';
      material.dateTo = normalizeDate(window.prompt('Tot datum:', material.dateTo || material.dateFrom || '')) || material.dateTo || '';
      material.note = window.prompt('Vrije tekst schade/vermissing/reparatie:', material.note || '') || material.note || '';
    }

    material.updatedAt = new Date().toISOString();
    saveMaterials(materials);
    renderMaterialsState();
    addNotification('info', `${material.naam || material.name || material.id} gewijzigd naar ${material.status}.`, material);
  }

  function renderMaterialsState() {
    const materials = getMaterials();
    document.querySelectorAll('[data-material-id]').forEach(element => {
      const material = materials.find(item => String(item.id) === String(element.dataset.materialId));
      if (!material) return;
      const status = material.status || STATUS.FREE;
      element.dataset.status = status;
      element.title = materialTitle(material);
      element.classList.toggle('is-blocked', BLOCKED_STATUSES.includes(status));
      element.classList.toggle('is-free', status === STATUS.FREE);
      if (BLOCKED_STATUSES.includes(status)) {
        element.classList.remove('selected');
        element.setAttribute('aria-disabled', 'true');
        element.setAttribute('aria-pressed', 'false');
      } else {
        element.removeAttribute('aria-disabled');
      }
    });
  }

  function materialTitle(material) {
    if (!BLOCKED_STATUSES.includes(material.status)) return 'Vrij inzetbaar';
    return `${material.status} - ${material.reservedBy || 'geen klant'} - ${material.dateFrom || '?'} t/m ${material.dateTo || '?'}`;
  }

  function renderNotificationBar() {
    let bar = document.getElementById('v12-notification-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'v12-notification-bar';
      document.body.prepend(bar);
    }

    const notifications = getNotifications().filter(item => item.status !== 'closed').slice(0, 8);
    bar.innerHTML = '';
    bar.className = notifications.length ? 'v12-notification-bar has-alerts' : 'v12-notification-bar';

    if (!notifications.length) {
      bar.textContent = 'Geen open meldingen';
      return;
    }

    for (const notification of notifications) {
      const item = document.createElement('div');
      item.className = `v12-notification-item ${notification.type || 'info'}`;

      const text = document.createElement('span');
      text.textContent = notification.text || 'Melding zonder tekst';
      item.appendChild(text);

      const repairButton = document.createElement('button');
      repairButton.type = 'button';
      repairButton.textContent = 'Gerepareerd/vrijgeven';
      repairButton.addEventListener('click', () => closeNotification(notification.id, true));
      item.appendChild(repairButton);

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = 'Wissen';
      closeButton.addEventListener('click', () => closeNotification(notification.id, false));
      item.appendChild(closeButton);

      bar.appendChild(item);
    }
  }

  function closeNotification(id, releaseMaterial) {
    const notifications = getNotifications();
    const notification = notifications.find(item => item.id === id);
    if (!notification) return;

    notification.status = 'closed';
    notification.closedAt = new Date().toISOString();

    if (releaseMaterial && notification.data && notification.data.id) {
      const materials = getMaterials();
      const material = materials.find(item => String(item.id) === String(notification.data.id));
      if (material) {
        material.status = STATUS.FREE;
        material.reservedBy = '';
        material.reservedJobNumber = '';
        material.dateFrom = '';
        material.dateTo = '';
        material.note = '';
        material.updatedAt = new Date().toISOString();
        saveMaterials(materials);
      }
    }

    saveNotifications(notifications);
    renderMaterialsState();
    renderNotificationBar();
  }

  function fixPinInputs() {
    const pinInputs = Array.from(document.querySelectorAll('input[type="password"], input[name*="pin" i], input[id*="pin" i]'));
    pinInputs.forEach(input => {
      input.setAttribute('autocomplete', 'one-time-code');
      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        const form = input.closest('form');
        const loginButton = form ? form.querySelector('button[type="submit"], button') : findButtonByText(['login', 'inloggen', 'admin']);
        if (loginButton) loginButton.click();
      });
    });

    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const text = normalizeText(button.textContent).toLowerCase();
      if (!text.includes('login') && !text.includes('inloggen') && !text.includes('admin')) return;
      setTimeout(() => pinInputs.forEach(input => { input.value = ''; }), 400);
    });
  }

  function fixMapsButtons() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-map], [data-waze], .waze, .googlemaps, .google-maps');
      if (!button) return;
      const address = valueOf(['#adres', '#address', '[name="adres"]', '[name="address"]']);
      const city = valueOf(['#plaats', '#city', '[name="plaats"]', '[name="city"]']);
      const query = encodeURIComponent(`${address} ${city}`.trim());
      if (!query) return;
      const isWaze = button.matches('[data-waze], .waze') || normalizeText(button.textContent).toLowerCase().includes('waze');
      const url = isWaze ? `https://waze.com/ul?q=${query}&navigate=yes` : `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  function injectStyles() {
    if (document.getElementById('v12-pro-fix-styles')) return;
    const style = document.createElement('style');
    style.id = 'v12-pro-fix-styles';
    style.textContent = `
      :root {
        --v12-material-free-color: var(--theme-primary, var(--primary-color, #2563eb));
        --v12-material-blocked-color: #b91c1c;
        --v12-material-warning-color: #f59e0b;
        --v12-panel-bg: var(--theme-surface, #ffffff);
        --v12-panel-text: var(--theme-text, #111827);
      }

      [data-material-id].is-free {
        border-color: var(--v12-material-free-color) !important;
        color: var(--v12-material-free-color) !important;
      }

      [data-material-id].is-blocked {
        border-color: var(--v12-material-blocked-color) !important;
        background: rgba(185, 28, 28, 0.10) !important;
        color: var(--v12-material-blocked-color) !important;
        cursor: not-allowed !important;
      }

      #v12-copy-opdracht-btn,
      .v12-copy-opdracht-button {
        border-radius: 8px;
        padding: 8px 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .v12-notification-bar {
        position: sticky;
        top: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        background: var(--v12-panel-bg) !important;
        color: var(--v12-panel-text) !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
      }

      .v12-notification-bar.has-alerts {
        background: #fff7ed !important;
      }

      .v12-notification-item {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 8px;
        color: #111827 !important;
        background: #ffffff !important;
        border-left: 5px solid var(--v12-material-warning-color);
      }

      .v12-notification-item.error {
        border-left-color: var(--v12-material-blocked-color);
      }

      .v12-notification-item button {
        padding: 5px 8px;
        border-radius: 6px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyles();
    ensureCopyButton();
    renderMaterialsState();
    renderNotificationBar();
    fixPinInputs();
    fixMapsButtons();
    document.addEventListener('click', handleMaterialClick, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
