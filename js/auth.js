const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 30;
let loginAttempts = {};

function isLockedOut(username) {
  const data = loginAttempts[username];
  if (!data) return false;
  if (data.count >= MAX_ATTEMPTS) {
    const elapsed = (Date.now() - data.lastAttempt) / 1000 / 60;
    if (elapsed < LOCKOUT_MINUTES) return true;
    delete loginAttempts[username];
  }
  return false;
}

function recordFailedAttempt(username) {
  if (!loginAttempts[username]) loginAttempts[username] = { count: 0, lastAttempt: 0 };
  loginAttempts[username].count++;
  loginAttempts[username].lastAttempt = Date.now();
}

function resetAttempts(username) { delete loginAttempts[username]; }

function getRemainingLockout(username) {
  const data = loginAttempts[username];
  if (!data) return 0;
  const elapsed = (Date.now() - data.lastAttempt) / 1000 / 60;
  return Math.ceil(LOCKOUT_MINUTES - elapsed);
}

const SESSION_TIMEOUT = 30 * 60 * 1000;

function resetSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    if (currentUser) { doLogout(); alert('You have been logged out due to inactivity.'); }
  }, SESSION_TIMEOUT);
}

document.addEventListener('mousemove', resetSessionTimer);
document.addEventListener('keypress', resetSessionTimer);
document.addEventListener('click', resetSessionTimer);

let pendingTOTPSecret = null;

function generateTOTPSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) secret += chars[Math.floor(Math.random() * chars.length)];
  return secret;
}

function verifyTOTPCode(secret, code) {
  try {
    const totp = new OTPAuth.TOTP({
      issuer: "Goran's Business Hub",
      label: pendingLoginUser?.username || 'user',
      algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });
    return totp.validate({ token: code, window: 1 }) !== null;
  } catch(e) { return false; }
}

async function showTOTPSetup(user) {
  pendingTOTPSecret = generateTOTPSecret();
  const totp = new OTPAuth.TOTP({
    issuer: "Goran's Business Hub", label: user.username,
    algorithm: 'SHA1', digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(pendingTOTPSecret)
  });
  const uri = totp.toString();
  document.getElementById('login-step1').style.display = 'none';
  document.getElementById('login-step3').style.display = 'block';
  document.getElementById('totp-manual-code').textContent = pendingTOTPSecret;
  setTimeout(() => {
    try {
      const container = document.getElementById('qr-canvas');
      container.innerHTML = '';
      new QRCode(container, { text: uri, width: 200, height: 200, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    } catch(e) { console.error('QR error:', e); }
  }, 500);
}

async function confirmTOTPSetup() {
  const code = document.getElementById('totp-setup-code').value.trim();
  const err = document.getElementById('totp-setup-error');
  err.classList.remove('show');
  if (!verifyTOTPCode(pendingTOTPSecret, code)) { err.classList.add('show'); return; }
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${pendingLoginUser.id}`, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ totp_secret: pendingTOTPSecret, totp_enabled: true })
    });
    currentUser = { role: 'user', data: pendingLoginUser };
    resetAttempts(pendingLoginUser.username);
    resetSessionTimer();
    showScreen('user-screen');
    renderUserDash();
  } catch(e) { err.textContent = 'Error saving. Please try again.'; err.classList.add('show'); }
}

function verify2FA() {
  const code = document.getElementById('twofa-code').value.trim();
  const err = document.getElementById('twofa-error');
  err.classList.remove('show');
  if (!verifyTOTPCode(pendingLoginUser.totp_secret, code)) {
    err.textContent = 'Invalid code. Please try again.'; err.classList.add('show'); return;
  }
  currentUser = { role: 'user', data: pendingLoginUser };
  resetAttempts(pendingLoginUser.username);
  resetSessionTimer();
  showScreen('user-screen');
  renderUserDash();
}

function backToLogin() {
  pendingLoginUser = null; pendingTOTPSecret = null;
  document.getElementById('login-step1').style.display = 'block';
  document.getElementById('login-step2').style.display = 'none';
  document.getElementById('login-step3').style.display = 'none';
  document.getElementById('twofa-code').value = '';
  document.getElementById('twofa-error').classList.remove('show');
}

function generateInviteToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function inviteUser() {
  const d = document.getElementById('new-displayname').value.trim();
  const e = document.getElementById('new-email').value.trim().toLowerCase();
  const err = document.getElementById('add-user-error');
  if (!d || !e) { showError(err, 'Please fill in name and email.'); return; }
  if (!e.includes('@')) { showError(err, 'Please enter a valid email address.'); return; }
  try {
    const token = generateInviteToken();
    const inviteLink = `${window.location.origin}?invite=${token}`;
    await sbFetch('invitations', { method: 'POST', body: JSON.stringify({ email: e, display_name: d, token }) });
    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: EMAILJS_SERVICE, template_id: 'template_3g3e4kk', user_id: EMAILJS_PUBLIC_KEY, template_params: { to_email: e, display_name: d, invite_link: inviteLink } })
    });
    document.getElementById('new-displayname').value = '';
    document.getElementById('new-email').value = '';
    err.classList.remove('show');
    showToast(emailRes.ok ? 'Invitation sent to ' + e + '!' : 'Invite saved! Share link: ' + inviteLink, emailRes.ok ? 'green' : 'red');
  } catch(e) { showError(err, 'Error sending invitation.'); }
}

async function checkInviteToken() {
  const token = new URLSearchParams(window.location.search).get('invite');
  if (!token) return;
  showScreen('invite-screen');
  try {
    const invites = await sbFetch(`invitations?token=eq.${token}&used=eq.false&select=*`);
    if (!invites.length || new Date(invites[0].expires_at) < new Date()) {
      document.getElementById('invite-form').style.display = 'none';
      document.getElementById('invite-invalid').style.display = 'block';
      return;
    }
    document.getElementById('invite-displayname').value = invites[0].display_name;
    window.currentInvite = invites[0];
  } catch(e) {
    document.getElementById('invite-form').style.display = 'none';
    document.getElementById('invite-invalid').style.display = 'block';
  }
}

async function completeInvite() {
  const displayName = document.getElementById('invite-displayname').value.trim();
  const username = document.getElementById('invite-username').value.trim().toLowerCase();
  const password = document.getElementById('invite-password').value;
  const password2 = document.getElementById('invite-password2').value;
  const err = document.getElementById('invite-error');
  err.classList.remove('show');
  if (!displayName || !username || !password || !password2) { err.textContent = 'Please fill in all fields.'; err.classList.add('show'); return; }
  if (password !== password2) { err.textContent = 'Passwords do not match.'; err.classList.add('show'); return; }
  if (!isStrongPassword(password)) { err.textContent = 'Password must be 8+ chars, uppercase, number, symbol.'; err.classList.add('show'); return; }
  try {
    await sbFetch('rpc/create_invited_user', { method: 'POST', body: JSON.stringify({ p_username: username, p_password: password, p_display_name: displayName, p_email: window.currentInvite.email }) });
    await sbFetch(`invitations?id=eq.${window.currentInvite.id}`, { method: 'PATCH', body: JSON.stringify({ used: true }), prefer: 'return=minimal' });
    window.history.replaceState({}, document.title, window.location.pathname);
    showScreen('login-screen');
    showToast('Account created! You can now log in.', 'green');
  } catch(e) { err.textContent = 'Error creating account. Username may already exist.'; err.classList.add('show'); }
}

async function doLogin() {
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  const btn = document.querySelector('.btn-primary');
  err.classList.remove('show');
  if (isLockedOut(u)) {
    const mins = getRemainingLockout(u);
    err.textContent = `Account locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`;
    err.classList.add('show'); return;
  }
  if (u === ADMIN.username && p === ADMIN.password) {
    currentUser = { role: 'admin' };
    btn.textContent = 'Loading...';
    await loadUsers();
    btn.textContent = 'Sign In →';
    resetAttempts(u); resetSessionTimer();
    showScreen('admin-screen'); renderAdmin(); return;
  }
  btn.textContent = 'Checking...';
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_password`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_username: u, input_password: p })
    });
    if (!response.ok) throw new Error('Database error: ' + response.status);
    const users = await response.json();
    const user = users.length > 0 ? users[0] : null;
    if (user) {
      const permResponse = await fetch(`${SUPABASE_URL}/rest/v1/permissions?user_id=eq.${user.id}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }
      });
      const permsRaw = await permResponse.json();
      const perms = Array.isArray(permsRaw) ? permsRaw : [];
      const permissions = {};
      perms.forEach(p => { permissions[p.business_id] = { access: true, docs: p.can_view_docs, financials: p.can_view_financials }; });
      pendingLoginUser = { ...user, displayName: user.display_name, permissions };
      btn.textContent = 'Sign In →';
      if (!user.totp_enabled || !user.totp_secret) { await showTOTPSetup(user); }
      else { document.getElementById('login-step1').style.display = 'none'; document.getElementById('login-step2').style.display = 'block'; }
    } else {
      recordFailedAttempt(u);
      const attempts = loginAttempts[u]?.count || 0;
      const remaining = MAX_ATTEMPTS - attempts;
      err.textContent = remaining <= 0 ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` : `Incorrect username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`;
      err.classList.add('show');
    }
  } catch(e) { err.textContent = 'Connection error: ' + e.message; err.classList.add('show'); }
  btn.textContent = 'Sign In →';
}

async function loadUsers() {
  try {
    const users = await sbFetch('users?role=eq.user&order=created_at.asc');
    const perms = await sbFetch('permissions');
    USERS = users.map(u => {
      const userPerms = perms.filter(p => p.user_id === u.id);
      const permissions = {};
      userPerms.forEach(p => { permissions[p.business_id] = { access: true, docs: p.can_view_docs, financials: p.can_view_financials }; });
      return { ...u, displayName: u.display_name, permissions };
    });
  } catch(e) { showToast('Could not load users from database', 'red'); }
}

function doLogout() {
  currentUser = null; USERS = []; clearTimeout(sessionTimer);
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').classList.remove('show');
  document.getElementById('login-error').textContent = 'Incorrect username or password.';
  showScreen('login-screen');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').classList.contains('active')) {
    document.getElementById('login-step2').style.display !== 'none' ? verify2FA() : doLogin();
  }
});

function isStrongPassword(pwd) {
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd);
}

checkInviteToken();
