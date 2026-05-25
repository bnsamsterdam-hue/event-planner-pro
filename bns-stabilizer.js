/* ============================================================
   BNS STABILIZER v2
   Laadt NA alle andere scripts.
   Fixes:
   1. Materiaal flicker stoppen (animation:none op hele materialList)
   2. Routenet knipperen stoppen (één knop, nooit verwijderen)
   3. Boekhouding tabs correct (klanten/betalingen werken)
   4. Wis knop in overzicht bestelling
   5. Wis knop per bezorger melding in overzicht
   6. Factuur popup: Terug knop (al in app.js)
   7. Schade meldingen in Admin/Opruimen al opgelost via aYear fix in app.js
   ============================================================ */
(function BNS_STABILIZER_V2() {
  'use strict';
  if (window.__BNS_STABILIZER_V2__) return;
  window.__BNS_STABILIZER_V2__ = true;

  function E(id) { return document.getElementById(id); }
  function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(sel, root) { return Array.from((root||document).querySelectorAll(sel)); }

  // ── 1. MATERIAAL FLICKER — Stop alle animaties op materialList ────────────
  // Meerdere versies overschrijven renderMaterials en voegen CSS toe die
  // botst. We forceren animation:none op de hele lijst via een hoge-priority style.
  function injectAntiFlickerCss() {
    if (E('bnsStabAntiFlicker')) return;
    var s = document.createElement('style');
    s.id = 'bnsStabAntiFlicker';
    s.textContent = [
      // Materiaallijst: geen animaties, geen transitions
      '#materialList *{animation:none!important;transition:none!important;transform:none!important}',
      // Maar defect badge mag wel zichtbaar zijn (alleen geen blink)
      '#materialList .badge.defect{opacity:1!important}',
      // Materiaalknoppen in de lijst: stabiel
      '#materialList button{animation:none!important}',
      // Gekozen materialen: ook stabiel
      '#chosenMaterials *{animation:none!important;transition:none!important}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── 2. ROUTENET KNIPPEREN — stabiel houden ───────────────────────────────
  // v126 voegt .bns-routenet-btn toe, v357 verwijdert ze, v126 voegt ze terug.
  // Fix A: markeer ze als .bns356-route zodat v357 ze overslaat.
  // Fix B: verwijder routenet volledig van optie/offerte kaarten (geen actieve levering).
  function fixRoutenetButtons() {
    // Markeer bestaande routenet knoppen zodat v357 ze niet verwijdert
    $('button.bns-routenet-btn').forEach(function(btn) {
      if (!btn.classList.contains('bns356-route')) {
        btn.classList.add('bns356-route');
      }
      // Verwijder routenet van optie 14 dagen en offerte kaarten
      var card = btn.closest('.order-card,.bns-v126-order-card,[data-bns-order-id]');
      if (card) {
        var txt = (card.textContent || '').toLowerCase();
        if (/optie 14|optie.*dag|offerte/.test(txt)) {
          btn.remove();
        }
      }
    });
    // Verwijder ook .bns356-route knoppen van optie/offerte kaarten
    $('button.bns356-route').forEach(function(btn) {
      var card = btn.closest('.order-card,.bns-v126-order-card,[data-bns-order-id]');
      if (card) {
        var txt = (card.textContent || '').toLowerCase();
        if (/optie 14|optie.*dag|offerte/.test(txt)) {
          btn.remove();
        }
      }
    });
  }

  // ── 3. BOEKHOUDING TABS — niet re-patchen, alleen close-knop fixen ────────
  // De tab-knoppen (Facturen/Klanten/Betalingen) hebben hun eigen onclick
  // die de closure-variabele 'tab' bijhoudt. Die MOGEN WE NIET aanraken.
  // We fixen alleen: sluit bij klikken buiten modal, Terug knop.
  function fixBoekhoudingModal() {
    var modal = E('tw300AUModal');
    if (!modal) return;

    // Sluit bij klikken op achtergrond
    if (!modal.__bnsStabV2Backdrop) {
      modal.__bnsStabV2Backdrop = true;
      modal.addEventListener('click', function(ev) {
        if (ev.target === modal) modal.classList.add('hidden');
      });
    }

    // Terug knop — gebruik de originele close logica
    var closeBtn = E('twAuClose');
    if (closeBtn && !closeBtn.__bnsStabV2Fixed) {
      closeBtn.__bnsStabV2Fixed = true;
      closeBtn.onclick = function() {
        modal.classList.add('hidden');
        return false;
      };
    }
  }

  // ── 4. WIS KNOP IN OVERZICHT BESTELLING ──────────────────────────────────
  // Wis knop in de header, losse Wis knoppen buiten de header verwijderen.
  function patchOrderOverviewWisButton() {
    var modal = E('bnsOrderOverviewModal');
    if (!modal) return;
    var card = modal.querySelector('.bns-order-overview-card');
    if (!card) return;
    var head = card.querySelector('.bns-order-overview-head');
    if (!head) return;

    // Verwijder losse Wis knoppen BUITEN de head
    $('button', card).forEach(function(btn) {
      var txt = (btn.textContent || '').trim();
      if ((txt === 'Wis' || txt === 'Wis opdracht') && !head.contains(btn)) {
        btn.remove();
      }
    });

    if (head.querySelector('.bns-stab-wis-btn')) return;

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
    btn.className = 'bns-stab-wis-btn';
    btn.style.cssText = 'background:#dc2626!important;color:#fff!important;border:0!important;border-radius:12px!important;padding:10px 18px!important;font-weight:900!important;cursor:pointer!important;margin-left:8px!important;font-size:14px!important';
    btn.textContent = 'Wis meldingen';
    btn.onclick = function(e) {
      e.preventDefault(); e.stopPropagation();
      var fn = window.bnsV311ClearOrderOverviewData;
      if (typeof fn === 'function') fn(orderId);
    };

    var closeBtn = head.querySelector('.bns-order-overview-close');
    if (closeBtn && closeBtn.parentNode) {
      closeBtn.parentNode.insertBefore(btn, closeBtn.nextSibling);
    } else {
      head.appendChild(btn);
    }
  }

  function wrapOrderOverviewShow() {
    var fn = window.BNS_V128_SHOW_ORDER_OVERVIEW;
    if (!fn || fn.__bnsStabV2Wrapped) return;
    var wrapped = function() {
      var r = fn.apply(this, arguments);
      setTimeout(patchOrderOverviewWisButton, 100);
      setTimeout(addWisToDriverMessages, 150);
      return r;
    };
    wrapped.__bnsStabV2Wrapped = true;
    window.BNS_V128_SHOW_ORDER_OVERVIEW = wrapped;
  }

  // ── 5. WIS KNOP PER BEZORGER MELDING IN OVERZICHT ────────────────────────
  // In het bestellingoverzicht staat "Foto's / handtekeningen / bezorger meldingen"
  // Elke melding heeft Delen + Print maar geen Wis. Die voegen we toe.
  function addWisToDriverMessages() {
    var modal = E('bnsOrderOverviewModal');
    if (!modal) return;

    // Zoek alle tw-v141-actions divs (bezorger melding knoppen)
    $('.tw-v141-actions', modal).forEach(function(actDiv) {
      if (actDiv.querySelector('.bns-stab-wis-alert')) return;

      // Zoek het alert-id via de bestaande onclick knoppen
      var alertId = null;
      actDiv.querySelectorAll('button').forEach(function(b) {
        var oc = b.getAttribute('onclick') || '';
        var m = oc.match(/[A-Za-z]+Alert\('([^']+)'\)/);
        if (m && !alertId) alertId = m[1];
      });
      if (!alertId) return;

      var wisBtn = document.createElement('button');
      wisBtn.type = 'button';
      wisBtn.className = 'bns-stab-wis-alert danger';
      wisBtn.textContent = 'Wis';
      wisBtn.style.cssText = 'background:#dc2626;color:#fff;border:0;border-radius:10px;padding:8px 11px;font-weight:900;cursor:pointer';
      wisBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        window.bnsConfirm('Deze melding definitief wissen?', 'Melding wissen?').then(function(ok) {
          if (!ok) return;
          // Gebruik bestaande delete functie als die beschikbaar is
          var delFns = ['TapwagenV141DeleteAlert', 'bnsDeleteAlertV108', 'bnsDeleteAlertV109',
                        'bnsAlertDelV11', 'BNS_A12_DELETE_ALERT'];
          var called = false;
          delFns.forEach(function(fn) {
            if (!called && typeof window[fn] === 'function') {
              window[fn](alertId);
              called = true;
            }
          });
          if (!called) {
            // Fallback: verwijder direct uit state
            try {
              var s = typeof appState === 'function' ? appState() : (typeof state === 'function' ? state() : null);
              if (s && Array.isArray(s.alerts)) {
                s.alerts = s.alerts.filter(function(a) { return String(a.id) !== String(alertId); });
                if (typeof saveOnly === 'function') saveOnly();
                else if (typeof saveState === 'function') saveState();
              }
            } catch(err) {}
          }
          // Verwijder de kaart uit de DOM
          var card = actDiv.closest('.tw-v141-alert,.tw-v141-card');
          if (card) card.remove();
        });
      };
      actDiv.appendChild(wisBtn);
    });
  }

  // ── 6. SOFT-DELETE OPDRACHT — eigen confirm ───────────────────────────────
  function patchSoftDeleteButtons() {
    $('button.bns-soft-delete:not([data-bns-stab-v2])').forEach(function(btn) {
      btn.dataset.bnsStabV2 = '1';
      var origClick = btn.onclick;
      btn.onclick = null;
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var num = btn.dataset.orderNumber || btn.dataset.orderId || '';
        window.bnsConfirm(
          'Opdracht ' + num + ' verwijderen?\nGaat naar Verwijderde opdrachten.',
          'Opdracht verwijderen?'
        ).then(function(ok) {
          if (ok && typeof origClick === 'function') origClick.call(btn, e);
        });
      });
    });
  }

  // ── 7. ADMIN MATERIAAL DELETE — eigen confirm ─────────────────────────────
  function patchAdminDeleteMat() {
    var btn = E('adminDeleteMat');
    if (!btn || btn.__bnsStabV2) return;
    btn.__bnsStabV2 = true;
    btn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      window.bnsConfirm('Gekozen materiaal verwijderen?', 'Materiaal verwijderen?').then(function(ok) {
        if (!ok) return;
        var c = window.confirm; window.confirm = function(){ return true; };
        try {
          if (typeof window.deleteMatAdminV92 === 'function') window.deleteMatAdminV92();
        } finally { window.confirm = c; }
      });
    }, true); // capture phase to beat existing listeners
  }

  // ── Main run ──────────────────────────────────────────────────────────────
  function run() {
    injectAntiFlickerCss();
    fixRoutenetButtons();
    fixBoekhoudingModal();
    wrapOrderOverviewShow();
    patchOrderOverviewWisButton();
    addWisToDriverMessages();
    patchSoftDeleteButtons();
    patchAdminDeleteMat();
  }

  // Klik-events: update wis knoppen als overview opengaat
  document.addEventListener('click', function() {
    setTimeout(function() {
      fixRoutenetButtons();
      patchOrderOverviewWisButton();
      addWisToDriverMessages();
      fixBoekhoudingModal();
    }, 120);
  }, true);

  // Rustig interval voor dynamisch geladen elementen
  setInterval(function() {
    fixRoutenetButtons();
    patchSoftDeleteButtons();
    fixBoekhoudingModal();
  }, 3000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(run, 500); });
  } else {
    setTimeout(run, 400);
  }

  setTimeout(run, 1200);

  console.info('[BNS Stabilizer v2] Actief: flicker, routenet, boekhouding, wis knoppen.');
})();
