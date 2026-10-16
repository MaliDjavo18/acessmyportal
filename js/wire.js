// Connects page buttons to their actions.
// Lives in its own file because the site's Content-Security-Policy blocks inline <script> blocks and onclick="" attributes.
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
});
