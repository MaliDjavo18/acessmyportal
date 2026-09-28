// 
// SCREEN SWITCHING
// 
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// 
// ADMIN RENDER
// 
function renderAdmin() {
  renderUserTable();
  renderBizGrid();
  renderContentTab();
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const names = ['users','businesses','content','documents','personal'];
    t.classList.toggle('active', names[i] === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  if (name === 'businesses') {
    renderBizGrid();
  }
  if (name === 'documents') {
    const sel = document.getElementById('upload-biz-select');
    if (sel && sel.options.length === 0) {
      BUSINESSES.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.icon + ' ' + b.name;
        sel.appendChild(opt);
      });
    }
    loadAdminDocs();
  }
  if (name === 'personal') {
    loadPersonalData();
  }
}

function renderUserTable() {
  const tbody = document.getElementById('user-tbody');
  document.getElementById('user-count-label').textContent = `(${USERS.length} users)`;

  if (USERS.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state">No users yet. Add one above.</div></td></tr>';
    return;
  }

  tbody.innerHTML = USERS.map((u, idx) => {
    const grantedBizIds = Object.keys(u.permissions).filter(b => u.permissions[b].access);
    const bizBadges = grantedBizIds.map(bid => {
      const biz = BUSINESSES.find(b => b.id === bid);
      return biz ? `<span class="biz-badge">${biz.icon} ${biz.name}</span>` : '';
    }).join('');

    return `<tr>
      <td>
        <div class="username-cell">
          <div class="avatar user-av" style="width:30px;height:30px;font-size:0.75rem;">${u.displayName.charAt(0)}</div>
          <div>
            <div style="font-weight:600;font-size:0.85rem;">${u.displayName}</div>
            <div style="font-size:0.72rem;color:var(--muted);">@${u.username}</div>
          </div>
        </div>
      </td>
      <td>${grantedBizIds.length > 0 ? bizBadges : '<span style="color:var(--muted);font-size:0.8rem;">No access granted</span>'}</td>
      <td>
        <div class="actions-row">
          <button class="btn-icon" onclick="openPermModal(${idx})">Permissions</button>
          <button class="btn-icon" onclick="previewAsUser(${idx})">Preview</button>
          <button class="btn-icon danger" onclick="deleteUser(${idx})">Remove</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function isStrongPassword(pwd) {
  return pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd);
}

async function addUser() {
  const u = document.getElementById('new-username').value.trim().toLowerCase();
  const p = document.getElementById('new-password').value;
  const d = document.getElementById('new-displayname').value.trim();
  const e = document.getElementById('new-email').value.trim().toLowerCase();
  const err = document.getElementById('add-user-error');

  if (!u || !p || !d) { showError(err, 'Please fill in all fields.'); return; }
  if (u === ADMIN.username) { showError(err, 'That username is reserved.'); return; }
  if (USERS.find(x => x.username === u)) { showError(err, 'Username already exists.'); return; }
  if (!isStrongPassword(p)) { showError(err, 'Password must be 8+ characters with uppercase, number and symbol.'); return; }

  try {
    const result = await sbFetch('users', {
      method: 'POST',
      body: JSON.stringify({ username: u, password: p, display_name: d, role: 'user', email: e || null })
    });
    const newUser = Array.isArray(result) ? result[0] : result;
    USERS.push({ ...newUser, displayName: d, permissions: {} });
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('new-displayname').value = '';
    document.getElementById('new-email').value = '';
    err.classList.remove('show');
    renderUserTable();
    renderBizGrid();
    showToast('User "' + d + '" added successfully', 'green');
  } catch(e) {
    showError(err, 'Error saving user. Please try again.');
  }
}

async function deleteUser(idx) {
  const user = USERS[idx];
  try {
    await sbFetch(`permissions?user_id=eq.${user.id}`, { method: 'DELETE', prefer: 'return=minimal' });
    await sbFetch(`users?id=eq.${user.id}`, { method: 'DELETE', prefer: 'return=minimal' });
    USERS.splice(idx, 1);
    renderUserTable();
    renderBizGrid();
    showToast('"' + user.displayName + '" has been removed', 'red');
  } catch(e) {
    showToast('Error removing user. Please try again.', 'red');
  }
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function openPermModal(idx) {
  editingUserIdx = idx;
  const user = USERS[idx];
  document.getElementById('perm-modal-title').textContent = user.displayName + "'s Permissions";
  document.getElementById('perm-modal-sub').textContent = 'Enable access per business and choose what they can see.';
  pendingPerms = {};
  BUSINESSES.forEach(b => {
    const existing = user.permissions[b.id] || { access: false, docs: false, financials: false };
    pendingPerms[b.id] = { ...existing };
  });
  const existingPersonal = user.permissions['personal'] || { access: false };
  pendingPerms['personal'] = { ...existingPersonal };
  renderPermBizList();
  document.getElementById('perm-modal').classList.add('open');
}

function renderPermBizList() {
  const container = document.getElementById('perm-biz-list');
  const bizRows = BUSINESSES.map(b => {
    const p = pendingPerms[b.id];
    return `<div class="perm-biz">
      <div class="perm-biz-top">
        <div class="perm-biz-name">${b.icon} ${b.name} <span style="font-size:0.72rem;color:var(--muted);">${b.industry}</span></div>
        <label class="toggle-wrap">
          <label class="toggle">
            <input type="checkbox" id="perm-access-${b.id}" ${p.access ? 'checked' : ''} onchange="onAccessToggle('${b.id}')">
            <span class="slider"></span>
          </label>
          <span class="perm-biz-access-label ${p.access ? 'on' : 'off'}" id="perm-access-label-${b.id}">${p.access ? 'Access On' : 'No Access'}</span>
        </label>
      </div>
      <div class="perm-checks" id="perm-checks-${b.id}" style="${p.access ? '' : 'opacity:0.3;pointer-events:none;'}">
        <label class="perm-check"><input type="checkbox" id="perm-docs-${b.id}" ${p.docs && p.access ? 'checked' : ''} onchange="onContentToggle('${b.id}','docs')"> Documents</label>
        <label class="perm-check"><input type="checkbox" id="perm-fin-${b.id}" ${p.financials && p.access ? 'checked' : ''} onchange="onContentToggle('${b.id}','financials')"> Financial Info</label>
      </div>
    </div>`;
  }).join('');
}

function onAccessToggle(bizId) {
  const checked = document.getElementById('perm-access-' + bizId).checked;
  pendingPerms[bizId].access = checked;
  const label = document.getElementById('perm-access-label-' + bizId);
  label.textContent = checked ? 'Access On' : 'No Access';
  label.className = 'perm-biz-access-label ' + (checked ? 'on' : 'off');
  const checks = document.getElementById('perm-checks-' + bizId);
  checks.style.opacity = checked ? '1' : '0.3';
  checks.style.pointerEvents = checked ? 'auto' : 'none';
  if (!checked && bizId !== 'personal') {
    pendingPerms[bizId].docs = false;
    pendingPerms[bizId].financials = false;
    document.getElementById('perm-docs-' + bizId).checked = false;
    document.getElementById('perm-fin-' + bizId).checked = false;
  }
}

function onContentToggle(bizId, type) {
  pendingPerms[bizId][type] = document.getElementById('perm-' + (type==='financials'?'fin':type) + '-' + bizId).checked;
}

function closePermModal() {
  document.getElementById('perm-modal').classList.remove('open');
}

async function savePerms() {
  const user = USERS[editingUserIdx];
  const saveBtn = document.querySelector('.modal-footer .btn-add');
  saveBtn.textContent = 'Saving...';

  try {
    await sbFetch(`permissions?user_id=eq.${user.id}`, { method: 'DELETE', prefer: 'return=minimal' });
    const newPerms = BUSINESSES
      .filter(b => pendingPerms[b.id].access)
      .map(b => ({
        user_id: user.id,
        business_id: b.id,
        can_view_docs: pendingPerms[b.id].docs || false,
        can_view_financials: pendingPerms[b.id].financials || false
      }));

    if (newPerms.length > 0) {
      await sbFetch('permissions', { method: 'POST', body: JSON.stringify(newPerms) });
    }

    USERS[editingUserIdx].permissions = {};
    BUSINESSES.forEach(b => {
      if (pendingPerms[b.id].access) {
        USERS[editingUserIdx].permissions[b.id] = { ...pendingPerms[b.id] };
      }
    });

    closePermModal();
    renderUserTable();
    renderBizGrid();
    showToast('Permissions saved successfully', 'green');
  } catch(e) {
    showToast('Error saving permissions. Please try again.', 'red');
  }
  saveBtn.textContent = 'Save Permissions';
}

function renderBizGrid() {
  const grid = document.getElementById('biz-grid');
  grid.innerHTML = BUSINESSES.map(b => {
    const userCount = USERS.filter(u => u.permissions[b.id]?.access).length;
    return `<div class="biz-manage-card">
      <div class="biz-icon-wrap">${b.icon}</div>
      <div class="biz-manage-info">
        <div class="biz-manage-name">${b.name}</div>
        <div class="biz-manage-industry">${b.industry}</div>
        <div class="biz-user-count">${userCount} user${userCount !== 1 ? 's' : ''} with access</div>
      </div>
    </div>`;
  }).join('');
}

function renderContentTab() {
  const filterRow = document.getElementById('content-biz-filter');
  filterRow.innerHTML = BUSINESSES.map(b =>
    `<button class="biz-filter-btn ${b.id === activeContentBiz ? 'active' : ''}" onclick="setContentBiz('${b.id}')">${b.icon} ${b.name}</button>`
  ).join('');
  renderContentList();
}

function setContentBiz(bizId) {
  activeContentBiz = bizId;
  document.querySelectorAll('.biz-filter-btn').forEach((btn, i) => {
    btn.classList.toggle('active', BUSINESSES[i].id === bizId);
  });
  renderContentList();
}

function renderContentList() {
  const data = CONTENT[activeContentBiz];
  const biz = BUSINESSES.find(b => b.id === activeContentBiz);
  const container = document.getElementById('content-list');
  container.innerHTML = `
    <div class="content-section">
      <div class="content-section-title"> Documents</div>
      ${data.docs.map(d => `
        <div class="content-item">
          <div class="content-item-icon"></div>
          <div class="content-item-info">
            <div class="content-item-name">${d}</div>
            <div class="content-item-meta">Visible to users with Documents access in ${biz.name}</div>
          </div>
        </div>`).join('')}
    </div>
    <div class="content-section">
      <div class="content-section-title"> Financial Info</div>
      ${data.financials.map(f => `
        <div class="content-item">
          <div class="content-item-icon"></div>
          <div class="content-item-info">
            <div class="content-item-name">${f.label}: <strong style="color:${f.up ? 'var(--success)' : 'var(--text)'}">${f.value}</strong></div>
            <div class="content-item-meta">Visible to users with Financial Info access in ${biz.name}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

function previewAsUser(idx) {
  const user = USERS[idx];
  currentUser = { role: 'user', data: user, isAdminPreview: true };
  showScreen('user-screen');
  renderUserDash();
  setTimeout(() => {
    const existing = document.getElementById('admin-preview-bar');
    if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.id = 'admin-preview-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#000;text-align:center;padding:0.5rem 1rem;font-size:0.82rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:1rem;';
    bar.innerHTML = ` Admin Preview  viewing as <strong>${user.displayName}</strong> &nbsp;<button onclick="exitPreview()" style="background:#000;color:#fff;border:none;padding:0.25rem 0.75rem;border-radius:5px;cursor:pointer;font-weight:700;font-size:0.8rem;"> Back to Admin</button>`;
    document.body.prepend(bar);
  }, 100);
}

function exitPreview() {
  const bar = document.getElementById('admin-preview-bar');
  if (bar) bar.remove();
  currentUser = { role: 'admin' };
  showScreen('admin-screen');
  renderAdmin();
}

function viewAsAdmin() {
  const fullPerms = {};
  BUSINESSES.forEach(b => { fullPerms[b.id] = { access: true, docs: true, financials: true }; });
  currentUser = {
    role: 'admin',
    isAdminView: true,
    data: { displayName: 'Admin', username: 'admin', permissions: fullPerms }
  };
  showScreen('user-screen');
  renderUserDash();
  setTimeout(() => {
    const existing = document.getElementById('admin-preview-bar');
    if (existing) existing.remove();
    const bar = document.createElement('div');
    bar.id = 'admin-preview-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#6366f1;color:#fff;text-align:center;padding:0.5rem 1rem;font-size:0.82rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:1rem;';
    bar.innerHTML = '<span>Admin View  Full Access</span><button onclick="exitPreview()" style="background:#fff;color:#6366f1;border:none;padding:0.25rem 0.75rem;border-radius:5px;cursor:pointer;font-weight:700;font-size:0.8rem;">Back to Admin</button>';
    document.body.prepend(bar);
  }, 100);
}

// 


// MAMIC FAMILY TAB
const PERSONAL_STORAGE_KEY = 'mamic_family_data';
function getPersonalData() { try { return JSON.parse(localStorage.getItem(PERSONAL_STORAGE_KEY)) || { notes:[], links:[], contacts:[], docs:[] }; } catch(e) { return { notes:[], links:[], contacts:[], docs:[] }; } }
function setPersonalData(data) { try { localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(data)); } catch(e) {} }
function loadPersonalData() { const data = getPersonalData(); renderPersonalNotes(data); renderPersonalLinks(data); renderPersonalContacts(data); renderPersonalDocs(data); }
function renderPersonalNotes(data) { const el = document.getElementById('personal-notes-list'); if (!el) return; if (!data.notes.length) { el.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;">No notes yet.</div>'; return; } el.innerHTML = data.notes.map((n,i) => '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.65rem;margin-bottom:0.4rem;"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;"><div style="font-size:0.82rem;white-space:pre-wrap;">' + n.text + '</div><button onclick="deletePersonalItem(\'notes\',' + i + ')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.75rem;">X</button></div><div style="color:var(--muted);font-size:0.72rem;margin-top:0.3rem;">' + n.date + '</div></div>').join(''); }
function renderPersonalLinks(data) { const el = document.getElementById('personal-links-list'); if (!el) return; if (!data.links.length) { el.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;">No links yet.</div>'; return; } el.innerHTML = data.links.map((l,i) => '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;margin-bottom:0.4rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;"><a href="' + l.url + '" target="_blank" style="color:var(--accent);font-size:0.82rem;font-weight:600;text-decoration:none;">' + l.label + '</a><button onclick="deletePersonalItem(\'links\',' + i + ')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.75rem;">X</button></div>').join(''); }
function renderPersonalContacts(data) { const el = document.getElementById('personal-contacts-list'); if (!el) return; if (!data.contacts.length) { el.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;">No contacts yet.</div>'; return; } el.innerHTML = data.contacts.map((c,i) => '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;margin-bottom:0.4rem;"><div style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-weight:600;font-size:0.83rem;">' + c.name + '</div><div style="font-size:0.8rem;color:var(--accent);">' + c.phone + '</div>' + (c.note ? '<div style="font-size:0.74rem;color:var(--muted);">' + c.note + '</div>' : '') + '</div><button onclick="deletePersonalItem(\'contacts\',' + i + ')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.75rem;">X</button></div></div>').join(''); }
function renderPersonalDocs(data) { const el = document.getElementById('personal-docs-list'); if (!el) return; if (!data.docs.length) { el.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;">No documents yet.</div>'; return; } el.innerHTML = data.docs.map((d,i) => '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;margin-bottom:0.4rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;"><div><div style="font-size:0.83rem;font-weight:600;">D ' + d.name + '</div><div style="font-size:0.73rem;color:var(--muted);">' + d.date + '</div></div><div style="display:flex;gap:0.4rem;align-items:center;"><a href="' + d.url + '" target="_blank" style="font-size:0.75rem;color:var(--accent);text-decoration:none;">View</a><button onclick="deletePersonalItem(\'docs\',' + i + ')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.75rem;">X</button></div></div>').join(''); }
function savePersonalNote() { const txt = document.getElementById('personal-notes').value.trim(); if (!txt) return; const data = getPersonalData(); data.notes.unshift({ text: txt, date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }); setPersonalData(data); document.getElementById('personal-notes').value = ''; renderPersonalNotes(data); showToast('Note saved','green'); }
function savePersonalLink() { const label = document.getElementById('personal-link-label').value.trim(); const url = document.getElementById('personal-link-url').value.trim(); if (!label||!url) { showToast('Enter both label and URL','red'); return; } const data = getPersonalData(); data.links.push({ label:label, url:url.startsWith('http')?url:'https://'+url }); setPersonalData(data); document.getElementById('personal-link-label').value=''; document.getElementById('personal-link-url').value=''; renderPersonalLinks(data); showToast('Link added','green'); }
function savePersonalContact() { const name = document.getElementById('personal-contact-name').value.trim(); const phone = document.getElementById('personal-contact-phone').value.trim(); const note = document.getElementById('personal-contact-note').value.trim(); if (!name||!phone) { showToast('Enter name and phone','red'); return; } const data = getPersonalData(); data.contacts.push({ name:name, phone:phone, note:note }); setPersonalData(data); document.getElementById('personal-contact-name').value=''; document.getElementById('personal-contact-phone').value=''; document.getElementById('personal-contact-note').value=''; renderPersonalContacts(data); showToast('Contact added','green'); }
async function handlePersonalUpload(event) { const file = event.target.files[0]; if (!file) return; const name = document.getElementById('personal-doc-name').value.trim()||file.name; const progress = document.getElementById('personal-upload-progress'); progress.style.display='block'; try { const fileName='personal/'+Date.now()+'_'+file.name; const url = await uploadToSupabase(file,fileName); const data = getPersonalData(); data.docs.unshift({ name:name, url:url, date:new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) }); setPersonalData(data); document.getElementById('personal-doc-name').value=''; event.target.value=''; renderPersonalDocs(data); showToast('Document uploaded','green'); } catch(e) { showToast('Upload failed. Try again.','red'); } progress.style.display='none'; }
function deletePersonalItem(type,idx) { const data = getPersonalData(); data[type].splice(idx,1); setPersonalData(data); loadPersonalData(); showToast('Removed','red'); }
function getPersonalDataForUser() { return getPersonalData(); }
