// SECURITY — Login attempt limiting
// ────────────────────────────
const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 30;
let loginAttempts = {};

function isLockedOut(username) {
  const data = loginAttempts[username];
  if (!data) return false;
  if (data.count >= MAX_ATTEMPTS) {
    const elapsed = (Date.now() - data.lastAttempt) / 1000 / 60;
    if (elapsed < LOCKOUT_MINUTES) return true;
    delete loginAttempts[username]; // Reset after lockout period
  }
  return false;
}

function recordFailedAttempt(username) {
  if (!loginAttempts[username]) loginAttempts[username] = { count: 0, lastAttempt: 0 };
  loginAttempts[username].count++;
  loginAttempts[username].lastAttempt = Date.now();
}

function resetAttempts(username) {
  delete loginAttempts[username];
}

function getRemainingLockout(username) {
  const data = loginAttempts[username];
  if (!data) return 0;
  const elapsed = (Date.now() - data.lastAttempt) / 1000 / 60;
  return Math.ceil(LOCKOUT_MINUTES - elapsed);
}

// ────────────────────────────
// SECURITY — Session timeout (30 minutes)
// ────────────────────────────
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let sessionTimer = null;
let lastActivity = Date.now();

function resetSessionTimer() {
  lastActivity = Date.now();
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    if (currentUser) {
      doLogout();
      alert('You have been logged out due to inactivity.');
    }
  }, SESSION_TIMEOUT);
}

// Track user activity
document.addEventListener('mousemove', resetSessionTimer);
document.addEventListener('keypress', resetSessionTimer);
document.addEventListener('click', resetSessionTimer);

// ────────────────────────────
// TOTP — Authenticator App 2FA
// ────────────────────────────
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
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  } catch(e) {
    console.error('TOTP error:', e);
    return false;
  }
}

async function showTOTPSetup(user) {
  pendingTOTPSecret = generateTOTPSecret();
  const totp = new OTPAuth.TOTP({
    issuer: "Goran's Business Hub",
    label: user.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(pendingTOTPSecret)
  });
  const uri = totp.toString();

  document.getElementById('login-step1').style.display = 'none';
  document.getElementById('login-step3').style.display = 'block';
  document.getElementById('totp-manual-code').textContent = pendingTOTPSecret;

  // Generate QR code using qrcodejs
  setTimeout(() => {
    try {
      const container = document.getElementById('qr-canvas');
      container.innerHTML = '';
      new QRCode(container, {
        text: uri,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch(e) {
      console.error('QR error:', e);
    }
  }, 500);
}

async function confirmTOTPSetup() {
  const code = document.getElementById('totp-setup-code').value.trim();
  const err = document.getElementById('totp-setup-error');
  err.classList.remove('show');

  if (!verifyTOTPCode(pendingTOTPSecret, code)) {
    err.classList.add('show');
    return;
  }

  // Save secret to database
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${pendingLoginUser.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ totp_secret: pendingTOTPSecret, totp_enabled: true })
    });

    // Complete login
    currentUser = { role: 'user', data: pendingLoginUser };
    resetAttempts(pendingLoginUser.username);
    resetSessionTimer();
    showScreen('user-screen');
    renderUserDash();
  } catch(e) {
    err.textContent = 'Error saving. Please try again.';
    err.classList.add('show');
  }
}

function verify2FA() {
  const code = document.getElementById('twofa-code').value.trim();
  const err = document.getElementById('twofa-error');
  err.classList.remove('show');

  if (!verifyTOTPCode(pendingLoginUser.totp_secret, code)) {
    err.textContent = 'Invalid code. Please try again.';
    err.classList.add('show');
    return;
  }

  // Code correct — complete login
  currentUser = { role: 'user', data: pendingLoginUser };
  resetAttempts(pendingLoginUser.username);
  resetSessionTimer();
  showScreen('user-screen');
  renderUserDash();
}

function backToLogin() {
  pendingLoginUser = null;
  pendingTOTPSecret = null;
  document.getElementById('login-step1').style.display = 'block';
  document.getElementById('login-step2').style.display = 'none';
  document.getElementById('login-step3').style.display = 'none';
  document.getElementById('twofa-code').value = '';
  document.getElementById('twofa-error').classList.remove('show');
}
async function doLogin() {
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  const btn = document.querySelector('.btn-primary');
  err.classList.remove('show');

  // Check lockout
  if (isLockedOut(u)) {
    const mins = getRemainingLockout(u);
    err.textContent = `Account locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`;
    err.classList.add('show');
    return;
  }

  if (u === ADMIN.username && p === ADMIN.password) {
    currentUser = { role: 'admin' };
    btn.textContent = 'Loading...';
    await loadUsers();
    btn.textContent = 'Sign In →';
    resetAttempts(u);
    resetSessionTimer();
    showScreen('admin-screen');
    renderAdmin();
    return;
  }

  btn.textContent = 'Checking...';
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input_username: u, input_password: p })
    });
    
    if (!response.ok) {
      throw new Error('Database error: ' + response.status);
    }

    const users = await response.json();
    const user = users.length > 0 ? users[0] : null;
    
    if (user) {
      // Load permissions
      const permResponse = await fetch(`${SUPABASE_URL}/rest/v1/permissions?user_id=eq.${user.id}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }
      });
      const permsRaw = await permResponse.json();
      const perms = Array.isArray(permsRaw) ? permsRaw : [];
      const permissions = {};
      perms.forEach(p => { permissions[p.business_id] = { access: true, docs: p.can_view_docs, financials: p.can_view_financials }; });
      pendingLoginUser = { ...user, displayName: user.display_name, permissions };

      btn.textContent = 'Sign In →';

      if (!user.totp_enabled || !user.totp_secret) {
        // First time — show TOTP setup
        await showTOTPSetup(user);
      } else {
        // Has TOTP — show verification screen
        document.getElementById('login-step1').style.display = 'none';
        document.getElementById('login-step2').style.display = 'block';
      }
    } else {
      recordFailedAttempt(u);
      const attempts = loginAttempts[u]?.count || 0;
      const remaining = MAX_ATTEMPTS - attempts;
      if (remaining <= 0) {
        err.textContent = `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`;
      } else {
        err.textContent = `Incorrect username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`;
      }
      err.classList.add('show');
    }
  } catch(e) {
    err.textContent = 'Connection error: ' + e.message;
    err.classList.add('show');
  }
  btn.textContent = 'Sign In →';
}

async function loadUsers() {
  try {
    const users = await sbFetch('users?role=eq.user&order=created_at.asc');
    const perms = await sbFetch('permissions');
    USERS = users.map(u => {
      const userPerms = perms.filter(p => p.user_id === u.id);
      const permissions = {};
      userPerms.forEach(p => {
        permissions[p.business_id] = { access: true, docs: p.can_view_docs, financials: p.can_view_financials };
      });
      return { ...u, displayName: u.display_name, permissions, _perms: userPerms };
    });
  } catch(e) {
    showToast('Could not load users from database', 'red');
  }
}

function doLogout() {
  currentUser = null;
  USERS = [];
  clearTimeout(sessionTimer);
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').classList.remove('show');
  document.getElementById('login-error').textContent = 'Incorrect username or password.';
  showScreen('login-screen');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('invite-screen').classList.contains('active')) {
      completeInvite();
    } else if (document.getElementById('login-screen').classList.contains('active')) {
      if (document.getElementById('login-step2').style.display !== 'none') {
        verify2FA();
      } else {
        doLogin();
      }
    }
  }
});

// ────────────────────────────
// INVITATION SYSTEM
// ────────────────────────────
const EMAILJS_INVITE_TEMPLATE = 'template_3g3e4kk';

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
    // Generate secure token
    const token = generateInviteToken();
    const inviteLink = `${window.location.origin}?invite=${token}`;

    // Save invitation to database
    await sbFetch('invitations', {
      method: 'POST',
      body: JSON.stringify({ email: e, display_name: d, token: token })
    });

    document.getElementById('new-displayname').value = '';
    document.getElementById('new-email').value = '';
    err.classList.remove('show');

    // Try sending email, but always show the link
    let emailSent = false;
    try {
      const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: 'service_xdz63id',
          template_id: EMAILJS_INVITE_TEMPLATE,
          user_id: 'unXnX6EE_UcdnhFd1',
          template_params: { to_email: e, display_name: d, invite_link: inviteLink }
        })
      });
      emailSent = emailRes.ok;
    } catch(emailErr) { emailSent = false; }

    // Always show the invite link so it can be copied and shared manually
    showInviteLink(inviteLink, e, emailSent);

  } catch(ex) {
    showError(err, 'Error creating invitation. Please try again.');
  }
}

function showInviteLink(link, email, emailSent) {
  // Remove any existing invite link box
  const existing = document.getElementById('invite-link-box');
  if (existing) existing.remove();

  const box = document.createElement('div');
  box.id = 'invite-link-box';
  box.style.cssText = 'margin-top:1rem;padding:1rem;background:var(--surface2);border:1px solid var(--border);border-radius:10px;';
  box.innerHTML = `
    <div style="font-size:0.82rem;font-weight:600;margin-bottom:0.5rem;color:var(--text);">
      ${emailSent ? '✅ Invite email sent to ' + email + '!' : '⚠️ Email could not be sent — share this link manually:'}
    </div>
    <div style="display:flex;gap:0.5rem;align-items:center;">
      <input id="invite-link-input" type="text" value="${link}" readonly
        style="flex:1;padding:0.4rem 0.6rem;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:0.78rem;font-family:monospace;">
      <button onclick="navigator.clipboard.writeText('${link}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000);"
        style="padding:0.4rem 0.8rem;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;">Copy</button>
    </div>
    <div style="font-size:0.75rem;color:var(--muted);margin-top:0.4rem;">Link expires in 7 days. Send it to ${email}.</div>
  `;

  const inviteSection = document.querySelector('.invite-section') || document.getElementById('add-user-error').parentElement;
  inviteSection.appendChild(box);
}

async function checkInviteToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('invite');
  if (!token) return;

  // Show invite screen
  showScreen('invite-screen');

  try {
    const invites = await sbFetch(`invitations?token=eq.${token}&used=eq.false&select=*`);
    if (invites.length === 0) {
      document.getElementById('invite-form').style.display = 'none';
      document.getElementById('invite-invalid').style.display = 'block';
      return;
    }

    const invite = invites[0];
    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      document.getElementById('invite-form').style.display = 'none';
      document.getElementById('invite-invalid').style.display = 'block';
      return;
    }

    // Pre-fill display name
    document.getElementById('invite-displayname').value = invite.display_name;
    window.currentInvite = invite;
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

  if (!displayName || !username || !password || !password2) { 
    err.textContent = 'Please fill in all fields.'; 
    err.classList.add('show'); 
    return; 
  }
  if (password !== password2) { 
    err.textContent = 'Passwords do not match.'; 
    err.classList.add('show'); 
    return; 
  }
  if (!isStrongPassword(password)) { 
    err.textContent = 'Password must be 8+ characters with uppercase, number and symbol.'; 
    err.classList.add('show'); 
    return; 
  }

  try {
    // Create user account with encrypted password
    const result = await sbFetch('rpc/create_invited_user', {
      method: 'POST',
      body: JSON.stringify({ 
        p_username: username, 
        p_password: password, 
        p_display_name: displayName, 
        p_email: window.currentInvite.email 
      })
    });

    // Mark invitation as used
    await sbFetch(`invitations?id=eq.${window.currentInvite.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ used: true }),
      prefer: 'return=minimal'
    });

    // Remove invite token from URL
    window.history.replaceState({}, document.title, window.location.pathname);

    // Show success and redirect to login
    showScreen('login-screen');
    showToast('Account created! You can now log in.', 'green');
  } catch(e) {
    err.textContent = 'Error creating account. Username may already exist.';
    err.classList.add('show');
  }
}

// Check for invite token on page load
window.addEventListener('DOMContentLoaded', checkInviteToken);
