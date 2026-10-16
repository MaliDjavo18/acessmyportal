// Connects page buttons to their actions.
// The site's Content-Security-Policy blocks inline <script> blocks and onclick=""/onchange="" attributes,
// so buttons use data-click="fn(args)" / data-change="fn(args)" instead, handled here without eval.

// ---- Small, safe interpreter for simple calls like: fn('a', 2, this.checked) ----
function parseActionCalls(src, el, evt) {
  var i = 0, calls = [];
  function ws() { while (i < src.length && /\s/.test(src[i])) i++; }
  function ident() {
    var m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
    if (!m) throw new Error('expected name at ' + i);
    i += m[0].length; return m[0];
  }
  function str(q) {
    var out = ''; i++;
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\' && i + 1 < src.length) { i++; }
      out += src[i++];
    }
    if (src[i] !== q) throw new Error('unclosed string');
    i++; return out;
  }
  function value() {
    ws();
    var c = src[i];
    if (c === "'" || c === '"') return str(c);
    var num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { i += num[0].length; return Number(num[0]); }
    var word = /^[A-Za-z_$][\w$.]*/.exec(src.slice(i));
    if (!word) throw new Error('unexpected character at ' + i);
    i += word[0].length;
    switch (word[0]) {
      case 'true': return true;
      case 'false': return false;
      case 'null': return null;
      case 'undefined': return undefined;
      case 'this': return el;
      case 'this.checked': return el.checked;
      case 'this.value': return el.value;
      case 'event': return evt;
    }
    throw new Error('unsupported value ' + word[0]);
  }
  ws();
  while (i < src.length) {
    var name = ident(); ws();
    if (src[i] !== '(') throw new Error('expected ( after ' + name);
    i++; ws();
    var args = [];
    if (src[i] !== ')') {
      for (;;) { args.push(value()); ws(); if (src[i] === ',') { i++; continue; } break; }
    }
    if (src[i] !== ')') throw new Error('expected ) in ' + name);
    i++; ws();
    if (src[i] === ';') { i++; ws(); }
    calls.push({ name: name, args: args });
  }
  return calls;
}

function runAction(src, el, evt) {
  var calls;
  try { calls = parseActionCalls(src, el, evt); }
  catch (e) { console.error('Could not run action "' + src + '":', e.message); return; }
  calls.forEach(function (c) {
    var fn = window[c.name];
    if (typeof fn !== 'function') { console.error('Action function not found: ' + c.name); return; }
    fn.apply(el, c.args);
  });
}

// Shared "Back to Businesses" action used by several screens
function backToBusinesses() {
  renderCompanyCards();
  var sub = document.getElementById('user-sub-text');
  if (sub) sub.textContent = 'Select a business to view your reports.';
}

// Delegated handlers: work for buttons created later by JavaScript too
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-click]');
  if (el) runAction(el.getAttribute('data-click'), el, e);
});
document.addEventListener('change', function (e) {
  var el = e.target.closest('[data-change]');
  if (el) runAction(el.getAttribute('data-change'), el, e);
});
// Broken logo images fall back to the business icon (replaces inline onerror)
document.addEventListener('error', function (e) {
  var el = e.target;
  if (el && el.tagName === 'IMG' && el.hasAttribute('data-fallback')) {
    el.style.display = 'none';
    if (el.parentElement) el.parentElement.textContent = el.getAttribute('data-fallback');
  }
}, true);

window.addEventListener('load', function () {
  function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
  function onAll(cls, fn) { document.querySelectorAll('.' + cls).forEach(function (el) { el.addEventListener('click', fn); }); }
  on('btn-login', doLogin);
  on('btn-confirm-totp', confirmTOTPSetup);
  on('btn-verify-2fa', verify2FA);
  on('btn-back-to-login', backToLogin);
  on('btn-complete-invite', completeInvite);
  on('btn-view-as-admin', function () { viewAsAdmin(); });
  onAll('btn-logout', doLogout);
  on('tab-btn-users', function () { switchTab('users'); });
  on('tab-btn-businesses', function () { switchTab('businesses'); });
  on('tab-btn-content', function () { switchTab('content'); });
  on('tab-btn-documents', function () { switchTab('documents'); });
  on('tab-btn-personal', function () { switchTab('personal'); });
  on('btn-invite-user', inviteUser);
  on('upload-area-doc', function () { document.getElementById('doc-file-input').click(); });
  on('upload-area-personal', function () { document.getElementById('personal-file-input').click(); });
  on('btn-admin-set-family-pin', adminSetFamilyPin);
  on('btn-save-personal-note', savePersonalNote);
  on('btn-save-personal-link', savePersonalLink);
  on('btn-save-personal-contact', savePersonalContact);
  on('btn-cancel-family-pin', function () { document.getElementById('family-pin-modal').classList.remove('open'); });
  on('btn-submit-family-pin', function () { submitFamilyPin(); });
  on('btn-close-perm-modal-x', closePermModal);
  on('btn-close-perm-modal-cancel', closePermModal);
  on('btn-save-perms', savePerms);
  on('btn-close-pdf-modal', closePDFModal);
  var pinInput = document.getElementById('family-pin-input');
  if (pinInput) pinInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitFamilyPin(); });
});
