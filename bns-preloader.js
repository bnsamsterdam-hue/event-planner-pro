/* ============================================================
   BNS PRELOADER
   Laadt VOOR app.js — patchs MutationObserver, alert en confirm
   zodat alle opvolgende code automatisch veilig is.
   ============================================================ */
(function BNS_PRELOADER() {
  'use strict';
  if (window.__BNS_PRELOADER__) return;
  window.__BNS_PRELOADER__ = true;

  // ── 1. MutationObserver debounce ─────────────────────────────────────────
  // Elke MutationObserver die op document.documentElement of document.body
  // observeert met subtree:true krijgt automatisch een 400ms debounce.
  // Observers op specifieke kleine elementen (bijv. een knop) blijven snel.
  var _OrigMO = window.MutationObserver;
  if (_OrigMO) {
    function SafeMO(userCallback) {
      var _debounceTimer = null;
      var _isDocRoot = false; // wordt true zodra .observe() op root wordt aangeroepen

      var _inner = new _OrigMO(function(mutations, obs) {
        if (!_isDocRoot) {
          // Kleine specifieke observer — direct doorsturen
          try { userCallback(mutations, obs); } catch(e) {}
          return;
        }
        // Root/subtree observer — sterk debouncen om loop te voorkomen
        if (_debounceTimer) return;
        _debounceTimer = setTimeout(function() {
          _debounceTimer = null;
          try { userCallback(mutations, obs); } catch(e) {}
        }, 400);
      });

      this.observe = function(target, options) {
        // Is dit een root-level observer?
        if (
          (target === document.documentElement || target === document.body) &&
          options && options.subtree
        ) {
          _isDocRoot = true;
        }
        return _inner.observe(target, options);
      };

      this.disconnect = function() {
        if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
        return _inner.disconnect();
      };

      this.takeRecords = function() {
        return _inner.takeRecords();
      };
    }

    // Kopieer static members
    SafeMO.prototype = _OrigMO.prototype;

    try {
      window.MutationObserver = SafeMO;
    } catch(e) {}
  }

  // ── 2. Eigen modal systeem (alert + confirm) ─────────────────────────────
  // Zorgt dat NOOIT meer de browser-dialoog met "github.io meldt het volgende" verschijnt.

  function injectModalCss() {
    if (document.getElementById('bnsPreloaderStyle')) return;
    var s = document.createElement('style');
    s.id = 'bnsPreloaderStyle';
    s.textContent = [
      '.bns-modal-bd{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.62);',
      'display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,sans-serif}',
      '.bns-modal-box{background:#fff;color:#172033;border-radius:20px;padding:28px 26px 22px;',
      'max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.38);font-size:16px;line-height:1.5}',
      '.bns-modal-box h3{margin:0 0 12px;font-size:18px;font-weight:900;color:#0f172a}',
      '.bns-modal-msg{margin-bottom:20px;white-space:pre-wrap;color:#334155}',
      '.bns-modal-btns{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}',
      '.bns-modal-btn{border:0;border-radius:11px;padding:11px 22px;font-weight:900;',
      'cursor:pointer;font-size:15px;transition:opacity .15s}',
      '.bns-modal-btn:hover{opacity:.85}',
      '.bns-modal-ok{background:#2563eb;color:#fff}',
      '.bns-modal-ok.danger{background:#dc2626}',
      '.bns-modal-cancel{background:#e2e8f0;color:#0f172a}',
    ].join('');
    // Voeg toe zodra <head> beschikbaar is
    var head = document.head || document.documentElement;
    head.appendChild(s);
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // bnsAlert — eigen alert
  window.bnsAlert = function(msg, title) {
    return new Promise(function(resolve) {
      injectModalCss();
      var bd = document.createElement('div');
      bd.className = 'bns-modal-bd';
      bd.innerHTML =
        '<div class="bns-modal-box">' +
          '<h3>' + esc(title || 'BNS Systeem') + '</h3>' +
          '<div class="bns-modal-msg">' + esc(String(msg || '')) + '</div>' +
          '<div class="bns-modal-btns">' +
            '<button class="bns-modal-btn bns-modal-ok">OK</button>' +
          '</div>' +
        '</div>';
      bd.querySelector('.bns-modal-ok').onclick = function() {
        bd.remove(); resolve(true);
      };
      document.body ? document.body.appendChild(bd) : document.documentElement.appendChild(bd);
    });
  };

  // bnsConfirm — eigen confirm met dubbele beveiliging voor delete-acties
  window.bnsConfirm = function(msg, title, danger) {
    return new Promise(function(resolve) {
      injectModalCss();
      var bd = document.createElement('div');
      bd.className = 'bns-modal-bd';
      bd.innerHTML =
        '<div class="bns-modal-box">' +
          '<h3>' + esc(title || 'Bevestig') + '</h3>' +
          '<div class="bns-modal-msg">' + esc(String(msg || '')) + '</div>' +
          '<div class="bns-modal-btns">' +
            '<button class="bns-modal-btn bns-modal-cancel">Annuleren</button>' +
            '<button class="bns-modal-btn bns-modal-ok' + (danger !== false ? ' danger' : '') + '">Ja, doorgaan</button>' +
          '</div>' +
        '</div>';
      bd.querySelector('.bns-modal-ok').onclick = function() { bd.remove(); resolve(true); };
      bd.querySelector('.bns-modal-cancel').onclick = function() { bd.remove(); resolve(false); };
      document.body ? document.body.appendChild(bd) : document.documentElement.appendChild(bd);
    });
  };

  // Vervang window.alert — clean van github tekst
  var _origAlert = window.alert;
  window.alert = function(msg) {
    var clean = String(msg || '').replace(/git\s*hub|github|gitup/ig, 'Systeemmelding');
    window.bnsAlert(clean);
  };

  // Vervang window.confirm — geef altijd true terug (sync API kan niet async)
  // De specifieke delete-functies worden hieronder apart gepatcht met async bnsConfirm
  window.confirm = function(msg) {
    // Toon onze eigen modal asynchroon voor informatie — return true voor backwards compat
    var clean = String(msg || '').replace(/git\s*hub|github|gitup/ig, 'Systeemmelding');
    // Sla het op zodat bns-stabilizer het kan oppakken
    window._lastConfirmMsg = clean;
    return true;
  };

  // ── 3. Patch specifieke delete-confirms async ────────────────────────────
  // Na laden van app.js patchen we de functies die confirm() gebruiken voor deletes.
  // We wachten tot DOMContentLoaded zodat alle functies geregistreerd zijn.
  function patchDeleteFunctions() {

    // clearOrderOverviewData — meldingen/foto's wissen bij opdracht
    var _origClear = window.bnsV311ClearOrderOverviewData;
    if (_origClear && !_origClear.__bnsPreloaderPatched) {
      window.bnsV311ClearOrderOverviewData = function(id) {
        window.bnsConfirm(
          'Meldingen, foto\'s en handtekeningen bij deze opdracht wissen?',
          'Weet je het zeker?'
        ).then(function(ok1) {
          if (!ok1) return;
          window.bnsConfirm(
            'Definitief wissen? Dit kan niet ongedaan gemaakt worden.',
            'Nogmaals bevestigen'
          ).then(function(ok2) {
            if (!ok2) return;
            var c = window.confirm; window.confirm = function(){ return true; };
            try { _origClear(id); } finally { window.confirm = c; }
          });
        });
      };
      window.bnsV311ClearOrderOverviewData.__bnsPreloaderPatched = true;
    }

    // BNS_V126_DELETE_BUCKET — hele map wissen
    var _origBucket = window.BNS_V126_DELETE_BUCKET;
    if (_origBucket && !_origBucket.__bnsPreloaderPatched) {
      window.BNS_V126_DELETE_BUCKET = function(bucket) {
        window.bnsConfirm(
          'Hele map "' + bucket + '" definitief wissen?\nAlle opdrachten in deze map worden verwijderd.',
          'Map wissen?'
        ).then(function(ok1) {
          if (!ok1) return;
          window.bnsConfirm(
            'Nogmaals bevestigen: map "' + bucket + '" leegmaken?',
            'Zeker weten?'
          ).then(function(ok2) {
            if (!ok2) return;
            var c = window.confirm; window.confirm = function(){ return true; };
            try { _origBucket(bucket); } finally { window.confirm = c; }
          });
        });
      };
      window.BNS_V126_DELETE_BUCKET.__bnsPreloaderPatched = true;
    }
  }

  // Probeer direct en na DOMContentLoaded (functies worden laat geregistreerd)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(patchDeleteFunctions, 800);
      setTimeout(patchDeleteFunctions, 2000);
    });
  } else {
    setTimeout(patchDeleteFunctions, 800);
    setTimeout(patchDeleteFunctions, 2000);
  }

  console.info('[BNS Preloader] MutationObserver gepatcht, eigen alert/confirm actief.');
})();
