/* =====================================================================
   WIRE WATCH for the FT6 Deposit Manager
   Loaded by one line in index.html. If this file ever causes trouble,
   deleting that one line turns Wire Watch off; the app works as before.
   ===================================================================== */
(function () {
  'use strict';
  var W = { data: null, loading: false, err: '', busy: false, prefill: null };
  window._W = W;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function dstr(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1); if (m.length < 2) m = '0' + m;
    var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
    return d.getFullYear() + '-' + m + '-' + dd;
  }
  function money(v) { return (typeof fmt$ === 'function') ? fmt$(v) : '$' + v; }
  function toast(m) { if (typeof showToast === 'function') showToast(m); }

  function api(action, params) {
    if (!S || !S.scriptUrl) return Promise.reject(new Error('Script URL not set'));
    var q = new URLSearchParams(Object.assign({ action: action }, params || {}));
    return fetch(S.scriptUrl + '?' + q.toString()).then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.error) throw new Error(d.error); return d; });
  }

  function redraw() {
    if (typeof step !== 'undefined' && (step === 'home' || step === 'wire')) render();
  }

  function loadWire(quiet) {
    if (!S || !S.scriptUrl) return;
    W.loading = true; W.err = '';
    api('wireStatus').then(function (d) { W.data = d; W.loading = false; redraw(); })
      .catch(function (e) { W.loading = false; W.err = e.message || 'error'; redraw(); });
  }
  window.wireLoad = loadWire;

  /* ---------- Home-screen banner ---------- */
  function bannerHtml() {
    if (!S || !S.scriptUrl) return '';
    var d = W.data;
    if (!d) {
      if (W.err) return '<div class="warn-box" onclick="go(\'wire\')" style="cursor:pointer">&#9888;&#65039; <strong>Wire Watch could not check in.</strong> Tap to retry.</div>';
      return '<div class="info-box" style="opacity:.7">Wire Watch: checking&hellip;</div>';
    }
    var un = (d.wires || []).filter(function (w) { return !w.reported; });
    var parts = '';
    if (un.length) {
      parts += '<div style="background:#7a1020;border:1.5px solid #ff5a6e;border-radius:12px;padding:14px;margin-bottom:12px;cursor:pointer" onclick="go(\'wire\')">' +
        '<div style="font-weight:700;font-size:16px;margin-bottom:6px">&#128680; ' + un.length + ' wire' + (un.length !== 1 ? 's' : '') + ' still need a remit email to the team</div>' +
        un.map(function (w) { return '<div style="font-size:14px;opacity:.95">' + esc(w.donor) + ' &mdash; ' + money(w.amount) + ' (' + dstr(w.wireDate) + ')</div>'; }).join('') +
        '<div style="margin-top:8px;font-size:13px;text-decoration:underline">Tap to handle &rarr;</div></div>';
    }
    if (d.candidates && d.candidates.length) {
      parts += '<div class="warn-box" onclick="go(\'wire\')" style="cursor:pointer">&#128269; <strong>' + d.candidates.length + ' possible new wire' + (d.candidates.length !== 1 ? 's' : '') + '</strong> spotted in Gmail. Tap to review.</div>';
    }
    if (d.bankCheckDue) {
      parts += '<div class="warn-box" onclick="go(\'wire\')" style="cursor:pointer">&#127974; <strong>Weekly Amalgamated check is due.</strong> ' +
        (d.lastBankCheck ? 'Last checked ' + dstr(d.lastBankCheck) + '.' : 'It has never been checked.') +
        ' Tap for how.</div>';
    }
    if (!parts) {
      parts = '<div class="ok-box" onclick="go(\'wire\')" style="cursor:pointer">&#9989; <strong>Wire Watch: all clear.</strong> Last Amalgamated check: ' + dstr(d.lastBankCheck) + '.</div>';
    }
    return parts;
  }

  var origHome = window.scrHome;
  window.scrHome = function () {
    var h = origHome();
    try { return h.replace('<div class="hero">', bannerHtml() + '<div class="hero">'); } catch (e) { return h; }
  };

  /* ---------- Wire Watch screen ---------- */
  function remitLabel(r) {
    return r === 'ActBlue' ? 'Remit in ActBlue' : r === 'EveryAction' ? 'Remit in EveryAction'
      : r === 'attached' ? 'Remit attached' : 'Remit status unknown';
  }
  function remitSelect(w) {
    var opts = ['ActBlue', 'EveryAction', 'attached', 'unknown'];
    return '<select onchange="wireSetRemit(\'' + w.id + '\', this.value)" style="width:100%;padding:10px;border-radius:9px;background:#0d1230;color:#fff;border:1px solid var(--border);margin:8px 0">' +
      opts.map(function (o) { return '<option value="' + o + '"' + (w.remit === o ? ' selected' : '') + '>' + remitLabel(o) + '</option>'; }).join('') + '</select>';
  }

  window.scrWire = function () {
    var d = W.data;
    var h = hdr('Home', "go('home')") + '<div class="main"><h1 class="stitle">Wire Watch</h1>' +
      '<p class="ssub">Money that arrives by wire never goes through the check flow, so this keeps track of it for you.</p>';
    if (!S.scriptUrl) return h + '<div class="warn-box">Set your Script URL in &#9881; Setup first.</div></div>';
    if (W.err && !d) return h + '<div class="warn-box">Could not reach the backend: ' + esc(W.err) + '</div><div class="stack"><button class="btn btn-gold" onclick="wireLoad()">Try again</button></div></div>';
    if (!d) return h + '<div class="spin-wrap"><div class="spin"></div>Loading&hellip;</div></div>';

    /* weekly bank check */
    h += '<div class="sec">Weekly Amalgamated check</div>' +
      '<div class="' + (d.bankCheckDue ? 'warn-box' : 'ok-box') + '">' +
      (d.bankCheckDue ? '&#127974; <strong>Due now.</strong> ' : '&#9989; ') +
      (d.lastBankCheck ? 'Last checked <strong>' + dstr(d.lastBankCheck) + '</strong>' + (d.daysSinceBankCheck != null ? ' (' + d.daysSinceBankCheck + ' day' + (d.daysSinceBankCheck !== 1 ? 's' : '') + ' ago)' : '') + '.' : 'Never checked yet.') +
      (d.lastBankNote ? '<br><small style="opacity:.75">' + esc(d.lastBankNote) + '</small>' : '') +
      '<br><small style="opacity:.8">To check: log in to Amalgamated in Chrome, then tell Claude <em>&ldquo;I&rsquo;m logged in, check for wires.&rdquo;</em> Claude logs the date here automatically. You can also tap below if you checked it yourself.</small></div>' +
      '<div class="stack"><button class="btn btn-out" onclick="wireLogCheck()">I checked it myself &mdash; log today</button></div>';

    /* wires needing email */
    var un = (d.wires || []).filter(function (w) { return !w.reported; });
    h += '<div class="sec">Need a remit email to the team (' + un.length + ')</div>';
    if (!un.length) h += '<div class="ok-box">&#9989; Nothing waiting. Every logged wire has been reported.</div>';
    un.forEach(function (w) {
      h += '<div class="chk-item"><div class="chk-info" style="width:100%">' +
        '<div class="chk-name">' + esc(w.donor) + '</div>' +
        '<div class="chk-amt">' + money(w.amount) + '</div>' +
        '<div class="chk-meta"><span class="pill pill-gold">Wired ' + dstr(w.wireDate) + '</span>' +
        (w.draftedAt ? '<span class="pill pill-green">Draft made ' + dstr(w.draftedAt) + '</span>' : '') + '</div>' +
        (w.reference ? '<div style="font-size:12px;opacity:.7;margin-top:4px">Confirmation # ' + esc(w.reference) + '</div>' : '') +
        remitSelect(w) +
        '<div class="stack">' +
        '<button class="btn btn-gold" onclick="wireMakeDraft(\'' + w.id + '\')">&#9993; ' + (w.draftedAt ? 'Make another Gmail draft' : 'Make Gmail draft') + '</button>' +
        '<button class="btn btn-out" onclick="wireMarkSent(\'' + w.id + '\')">&#10003; I sent the email</button>' +
        '</div></div></div>';
    });

    /* candidates */
    if (d.candidates && d.candidates.length) {
      h += '<div class="sec">Possible wires spotted in Gmail (' + d.candidates.length + ')</div>' +
        '<div class="info-box">These emails mention a wire. Add the real ones; dismiss the rest.</div>';
      d.candidates.forEach(function (c) {
        h += '<div class="chk-item"><div class="chk-info" style="width:100%">' +
          '<div class="chk-name" style="font-size:15px">' + esc(c.subject) + '</div>' +
          '<div style="font-size:12px;opacity:.7">' + esc(c.from) + ' &middot; ' + dstr(c.date) + '</div>' +
          '<div class="stack" style="margin-top:8px">' +
          '<button class="btn btn-gold btn-sm" onclick="wireAddFromCandidate(\'' + c.threadId + '\')">Add as a wire</button>' +
          '<button class="btn btn-out btn-sm" onclick="wireDismiss(\'' + c.threadId + '\')">Not a wire</button>' +
          '</div></div></div>';
      });
    }

    h += '<div class="stack" style="margin-top:16px">' +
      '<button class="btn btn-gold" onclick="wireStartAdd()">+ Add a wire by hand</button>' +
      '<button class="btn btn-out" onclick="wireRescan()">&#128260; Rescan Gmail now</button></div>';

    /* history */
    var done = (d.wires || []).filter(function (w) { return w.reported; }).slice(0, 12);
    if (done.length) {
      h += '<div class="sec">Already reported</div>' + done.map(function (w) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 2px;border-bottom:1px solid var(--border);font-size:14px"><span>' + esc(w.donor) + '</span><span>' + money(w.amount) + ' &middot; ' + dstr(w.wireDate) + '</span></div>';
      }).join('');
    }
    return h + '<div style="height:30px"></div></div>';
  };

  /* ---------- Add-a-wire screen ---------- */
  window.scrWireAdd = function () {
    var p = W.prefill || {};
    var opts = ['ActBlue', 'EveryAction', 'attached', 'unknown'];
    return hdr('Back', "go('wire')") + '<div class="main"><h1 class="stitle">Add a wire</h1>' +
      '<p class="ssub">Enter what the bank (or the donor&rsquo;s confirmation) shows.</p>' +
      '<div class="field"><label>Donor name</label><input type="text" id="ww-donor" autocapitalize="words" placeholder="Jane Smith" value="' + esc(p.donor || '') + '"></div>' +
      '<div class="field"><label>Amount</label><input type="text" id="ww-amt" inputmode="decimal" placeholder="5000" value="' + esc(p.amount || '') + '"></div>' +
      '<div class="field"><label>Date the wire arrived</label><input type="date" id="ww-date" value="' + esc(p.wireDate || todayIso()) + '"></div>' +
      '<div class="field"><label>Where is the remit?</label><select id="ww-remit" style="width:100%;padding:12px;border-radius:9px;background:#0d1230;color:#fff;border:1px solid var(--border)">' +
      opts.map(function (o) { return '<option value="' + o + '"' + ((p.remit || 'unknown') === o ? ' selected' : '') + '>' + remitLabel(o) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Wire confirmation # (optional)</label><input type="text" id="ww-ref" value="' + esc(p.reference || '') + '"></div>' +
      '<div class="field"><label>Note (optional)</label><input type="text" id="ww-note" value="' + esc(p.note || '') + '"></div>' +
      '<div class="stack"><button class="btn btn-gold" onclick="wireSubmitAdd()">Save wire</button></div></div>';
  };

  /* ---------- Actions ---------- */
  function busy(msg) { if (typeof showLoading === 'function') { /* leave app's own overlay alone */ } toast(msg); }

  window.wireLogCheck = function () {
    api('wireLogBankCheck', { note: 'Checked by Jason' }).then(function (d) { W.data = d; toast('Logged: Amalgamated checked today'); redraw(); })
      .catch(function (e) { toast('Could not log: ' + e.message); });
  };
  window.wireRescan = function () {
    toast('Scanning Gmail…');
    api('wireScan').then(function (d) { W.data = d; toast('Scan done'); redraw(); })
      .catch(function (e) { toast('Scan failed: ' + e.message); });
  };
  window.wireMakeDraft = function (id) {
    var w = (W.data.wires || []).filter(function (x) { return x.id === id; })[0];
    if (w && w.remit === 'unknown' && !confirm('Remit status is "unknown". The draft will have a bracketed placeholder you must fix before sending. Make the draft anyway?')) return;
    toast('Making Gmail draft…');
    api('wireCreateDraft', { id: id }).then(function () { toast('Draft created. Look for the starred draft in Gmail.'); loadWire(); })
      .catch(function (e) { toast('Draft failed: ' + e.message); });
  };
  window.wireMarkSent = function (id) {
    api('wireMarkReported', { id: id }).then(function () { toast('Marked as reported'); loadWire(); })
      .catch(function (e) { toast('Failed: ' + e.message); });
  };
  window.wireSetRemit = function (id, val) {
    api('wireUpdate', { id: id, remit: val }).then(function () { toast('Remit status saved'); loadWire(); })
      .catch(function (e) { toast('Failed: ' + e.message); });
  };
  window.wireDismiss = function (threadId) {
    api('wireDismiss', { threadId: threadId }).then(function () { loadWire(); })
      .catch(function (e) { toast('Failed: ' + e.message); });
  };
  window.wireStartAdd = function () { W.prefill = null; go('wire-add'); };
  window.wireAddFromCandidate = function (threadId) {
    var c = ((W.data && W.data.candidates) || []).filter(function (x) { return x.threadId === threadId; })[0];
    W.prefill = { note: c ? ('From Gmail: ' + c.subject) : '', threadId: threadId };
    go('wire-add');
  };
  window.wireSubmitAdd = function () {
    var donor = (document.getElementById('ww-donor').value || '').trim();
    var amt = (document.getElementById('ww-amt').value || '').trim();
    if (!donor || !amt) { toast('Please enter a name and an amount'); return; }
    var params = {
      donor: (typeof properName === 'function') ? properName(donor) : donor,
      amount: amt,
      wireDate: document.getElementById('ww-date').value,
      remit: document.getElementById('ww-remit').value,
      reference: document.getElementById('ww-ref').value,
      note: document.getElementById('ww-note').value,
      source: 'manual (app)'
    };
    if (W.prefill && W.prefill.threadId) params.threadId = W.prefill.threadId;
    api('wireAdd', params).then(function () { W.prefill = null; toast('Wire saved'); go('wire'); loadWire(); })
      .catch(function (e) { toast('Could not save: ' + e.message); });
  };

  /* ---------- Hook into the app ---------- */
  if (typeof SCREENS !== 'undefined') { SCREENS.wire = 'scrWire'; SCREENS['wire-add'] = 'scrWireAdd'; }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadWire(); });
  loadWire();
  redraw();
})();
