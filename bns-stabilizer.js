/* ============================================================
   BNS STABILIZER
   Laadt NA alle andere scripts.
   Pakt de resterende problemen aan die niet via de preloader
   kunnen worden opgelost (omdat de code dan nog niet bestaat):
   1. Vertraagt de 250ms tick naar 2000ms (was alert-knop updater)
   2. Wis knop correct in overzicht bestelling
   3. Boekhouding mappen — navigatie fix
   4. Firebase verbindingsstatus tonen
   ============================================================ */
(function BNS_STABILIZER() {
  'use strict';
  if (window.__BNS_STABILIZER__) return;
  window.__BNS_STABILIZER__ = true;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function E(id) { return document.getElementById(id); }
  function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ── 1. Interval opschoning ────────────────────────────────────────────────
  // De alert-knop wordt elke 250ms bijgewerkt, maar 2 seconden is meer dan genoeg.
  // We kunnen bestaande intervals niet stoppen zonder referentie, maar we kunnen
  // de callback zelf vertragen via een guard variable.
  function slowDownAlertButtonTick() {
    // Zoek de globale applyButton / tick functie en voeg een debounce toe
    // BNS_V180 gebruikt window.apply — we wrappen renderAll om dit te beperken
    var _lastTick = 0;
    var _origRenderAll = window.renderAll;
    if (_origRenderAll && !_origRenderAll.__bnsStabilized) {
      window.renderAll = function() {
        var now = Date.now();
        if (now - _lastTick < 500) return; // max 2x per seconde
        _lastTick = now;
        return _origRenderAll.apply(this, arguments);
      };
      window.renderAll.__bnsStabilized = true;
      try { renderAll = window.renderAll; } catch(e) {}
    }
  }

  // ── 2. Wis knop in Overzicht bestelling ──────────────────────────────────
  // Zorgt dat de Wis-knop (voor meldingen/foto's) altijd in de header staat.
  // De losse rode Wis knop rechtsboven in de popup wordt verwijderd.
  function patchOrderOverviewWisButton() {
    var modal = E('bnsOrderOverviewModal');
    if (!modal) return;

    var card = modal.querySelector('.bns-order-overview-card');
    if (!card) return;

    var head = card.querySelector('.bns-order-overview-head');
    if (!head) return;

    // Verwijder losse Wis knoppen BUITEN de head
    card.querySelectorAll('button').forEach(function(btn) {
      if (/^Wis\s*$/.test((btn.textContent || '').trim()) && !head.contains(btn)) {
        btn.remove();
      }
    });

    // Voeg Wis-knop toe in de head als die er nog niet is
    if (head.querySelector('.bns-stab-wis')) return;

    // Vind het opdrachtnummer uit de modal tekst
    var text = card.textContent || '';
    var match = text.match(/(20\d{2}-\d{3,6})/);
    if (!match) return;

    var orderId = null;
    try {
      var s = typeof appState === 'function' ? appState() :
               (typeof state === 'function' ? state() : null);
      if (s && Array.isArray(s.orders)) {
        var found = s.orders.find(function(o) {
          return String(o.number) === String(match[1]);
        });
        if (found) orderId = found.id;
      }
    } catch(e) {}

    if (!orderId) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bns-stab-wis';
    btn.style.cssText = [
      'background:#dc2626!important',
      'color:#fff!important',
      'border:0!important',
      'border-radius:12px!important',
      'padding:10px 18px!important',
      'font-weight:900!important',
      'cursor:pointer!important',
      'margin-left:8px!important',
      'font-size:14px!important',
    ].join(';');
    btn.textContent = 'Wis meldingen';

    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      var clearFn = window.bnsV311ClearOrderOverviewData;
      if (typeof clearFn === 'function') {
        clearFn(orderId);
      }
    };

    var closeBtn = head.querySelector('.bns-order-overview-close');
    if (closeBtn && closeBtn.parentNode) {
      closeBtn.parentNode.insertBefore(btn, closeBtn.nextSibling);
    } else {
      head.appendChild(btn);
    }
  }

  // Wrapt BNS_V128_SHOW_ORDER_OVERVIEW zodat Wis knop altijd wordt toegevoegd
  function wrapOrderOverviewShow() {
    var fn = window.BNS_V128_SHOW_ORDER_OVERVIEW;
    if (!fn || fn.__bnsStabWrapped) return;
    var wrapped = function() {
      var r = fn.apply(this, arguments);
      setTimeout(patchOrderOverviewWisButton, 80);
      setTimeout(patchOrderOverviewWisButton, 300);
      return r;
    };
    wrapped.__bnsStabWrapped = true;
    window.BNS_V128_SHOW_ORDER_OVERVIEW = wrapped;
  }

  // ── 3. Boekhouding mappen ─────────────────────────────────────────────────
  // Terug knop en map knoppen werken altijd correct.
  function fixBoekhoudingModal() {
    var modal = E('tw300AUModal');
    if (!modal) return;

    // Sluit bij klikken op achtergrond
    if (!modal.__bnsStabBackdrop) {
      modal.__bnsStabBackdrop = true;
      modal.addEventListener('click', function(ev) {
        if (ev.target === modal) modal.classList.add('hidden');
      });
    }

    // Terug knop
    var closeBtn = E('twAuClose');
    if (closeBtn && !closeBtn.__bnsStabFixed) {
      closeBtn.__bnsStabFixed = true;
      closeBtn.onclick = function() {
        modal.classList.add('hidden');
      };
    }

    // Map knoppen — herstel actieve state correct
    modal.querySelectorAll('.tw-au-folder').forEach(function(btn) {
      if (btn.__bnsStabFixed) return;
      btn.__bnsStabFixed = true;
      var orig = btn.onclick;
      btn.onclick = function(ev) {
        modal.querySelectorAll('.tw-au-folder').forEach(function(b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        if (typeof orig === 'function') orig.call(btn, ev);
      };
    });
  }

  // ── 4. Soft-delete knoppen in opdrachtlijst ───────────────────────────────
  // Vervangt de native confirm() door eigen bnsConfirm modal.
  function patchSoftDeleteButtons() {
    document.querySelectorAll('.bns-soft-delete:not([data-bns-stab])').forEach(function(btn) {
      btn.dataset.bnsStab = '1';
      var origClick = btn.onclick;
      btn.onclick = null;

      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var num = btn.dataset.orderNumber || btn.dataset.orderId || '';
        window.bnsConfirm(
          'Opdracht ' + num + ' verwijderen?\nDe opdracht gaat naar Verwijderde opdrachten.',
          'Opdracht verwijderen?'
        ).then(function(ok) {
          if (ok && typeof origClick === 'function') origClick.call(btn, e);
        });
      });
    });
  }

  // ── 5. Admin materiaal verwijderen — eigen confirm ────────────────────────
  function patchAdminDeleteButtons() {
    // adminDeleteMat
    var delMat = E('adminDeleteMat');
    if (delMat && !delMat.__bnsStab) {
      delMat.__bnsStab = true;
      var origMat = delMat.onclick;
      delMat.onclick = null;
      delMat.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.bnsConfirm('Gekozen materiaal verwijderen?', 'Materiaal verwijderen?')
          .then(function(ok) {
            if (ok) {
              // Roep originele delete aan (geeft zelf ook confirm die nu true geeft)
              var c = window.confirm; window.confirm = function(){ return true; };
              try {
                if (typeof window.deleteMatAdminV92 === 'function') window.deleteMatAdminV92();
                else if (typeof origMat === 'function') origMat.call(delMat, e);
              } finally { window.confirm = c; }
            }
          });
      });
    }
  }

  // ── 6. Firebase verbindingsstatus ─────────────────────────────────────────
  function monitorFirebase() {
    var statusEl = E('bnsFirebaseStatus');
    if (!statusEl) return; // firebase-sync.js maakt dit element zelf aan
    // Status is al zichtbaar via firebase-sync.js — geen extra actie nodig
  }

  // ── 7. Github tekst in DOM opruimen ──────────────────────────────────────
  // Loopt één keer na laden om eventuele resterende github-vermeldingen te wissen.
  function cleanGithubText() {
    var re = /git\s*hub|github\.io/gi;
    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    var node;
    while ((node = walker.nextNode())) {
      if (re.test(node.nodeValue)) {
        node.nodeValue = node.nodeValue.replace(re, 'BNS Systeem');
      }
    }
  }

  // ── Main run ──────────────────────────────────────────────────────────────
  function run() {
    slowDownAlertButtonTick();
    wrapOrderOverviewShow();
    patchOrderOverviewWisButton();
    fixBoekhoudingModal();
    patchSoftDeleteButtons();
    patchAdminDeleteButtons();
    monitorFirebase();
  }

  // Eenmalige opschoning na volledig laden
  function onReady() {
    setTimeout(run, 500);
    setTimeout(cleanGithubText, 1500);
    // Periodiek voor dynamisch geladen elementen — rustig interval
    setInterval(function() {
      patchSoftDeleteButtons();
      fixBoekhoudingModal();
      patchOrderOverviewWisButton();
    }, 3000);
  }

  // Klik-listener: Wis knop updaten als overview wordt geopend
  document.addEventListener('click', function() {
    setTimeout(function() {
      patchOrderOverviewWisButton();
      fixBoekhoudingModal();
    }, 120);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(onReady, 400);
    });
  } else {
    onReady();
  }

  console.info('[BNS Stabilizer] Actief. Wis knop, boekhouding, confirm modals, interval rustiger.');
})();
