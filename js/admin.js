function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function renderAdmin() {
  renderUserTable();
  renderBizGrid();
  renderContentTab();
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const names = ['users','businesses','content','documents'];
    t.classList.toggle('active', names[i] === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  if (name === 'documents') {
    const sel = document.getElementById('upload-biz-select');
    if (sel && sel.options.length === 0) {
      BUSINESSES.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id; opt.textContent = b.icon + ' ' + b.name;
        sel.appendChild(opt);
      });
    }
    loadAdminDocs();
  }
}

function renderUserTable() {
  const tbody = document.getElementById('user-tbody');
  document.getElementById('user-count-label').textContent = `(${USERS.length} users)`;
  if (USERS.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state">No users yet. Invite someone above.</div></td></tr>';
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
          <button class="btn-icon" onclick="openPermModal(${idx})">🔑 Permissions</button>
          <button class="btn-icon danger" onclick="deleteUser(${idx})">🗑 Remove</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function deleteUser(idx) {
  const user = USERS[idx];
  try {
    await sbFetch(`permissions?user_id=eq.${user.id}`, { method: 'DELETE', prefer: 'return=minimal' });
    await sbFetch(`users?id=eq.${user.id}`, { method: 'DELETE', prefer: 'return=minimal' });
    USERS.splice(idx, 1);
    renderUserTable(); renderBizGrid();
    showToast('"' + user.displayName + '" has been removed', 'red');
  } catch(e) { showToast('Error removing user.', 'red'); }
}

function showError(el, msg) {
  el.textContent = msg; el.classList.add('show');
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
  renderPermBizList();
  document.getElementById('perm-modal').classList.add('open');
}

function renderPermBizList() {
  const container = document.getElementById('perm-biz-list');
  container.innerHTML = BUSINESSES.map(b => {
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
  if (!checked) {
    pendingPerms[bizId].docs = false; pendingPerms[bizId].financials = false;
    document.getElementById('perm-docs-' + bizId).checked = false;
    document.getElementById('perm-fin-' + bizId).checked = false;
  }
}

function onContentToggle(bizId, type) {
  pendingPerms[bizId][type] = document.getElementById('perm-' + (type === 'financials' ? 'fin' : type) + '-' + bizId).checked;
}

function closePermModal() { document.getElementById('perm-modal').classList.remove('open'); }

async function savePerms() {
  const user = USERS[editingUserIdx];
  const saveBtn = document.querySelector('.modal-footer .btn-add');
  saveBtn.textContent = 'Saving...';
  try {
    await sbFetch(`permissions?user_id=eq.${user.id}`, { method: 'DELETE', prefer: 'return=minimal' });
    const newPerms = BUSINESSES.filter(b => pendingPerms[b.id].access).map(b => ({
      user_id: user.id, business_id: b.id,
      can_view_docs: pendingPerms[b.id].docs || false,
      can_view_financials: pendingPerms[b.id].financials || false
    }));
    if (newPerms.length > 0) await sbFetch('permissions', { method: 'POST', body: JSON.stringify(newPerms) });
    USERS[editingUserIdx].permissions = {};
    BUSINESSES.forEach(b => { if (pendingPerms[b.id].access) USERS[editingUserIdx].permissions[b.id] = { ...pendingPerms[b.id] }; });
    closePermModal(); renderUserTable(); renderBizGrid();
    showToast('Permissions saved successfully', 'green');
  } catch(e) { showToast('Error saving permissions.', 'red'); }
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
      <div class="content-section-title">📁 Documents</div>
      ${data.docs.map(d => `<div class="content-item"><div class="content-item-icon">📄</div><div class="content-item-info"><div class="content-item-name">${d}</div><div class="content-item-meta">Visible to users with Documents access in ${biz.name}</div></div></div>`).join('')}
    </div>
    <div class="content-section">
      <div class="content-section-title">💰 Financial Info</div>
      ${data.financials.map(f => `<div class="content-item"><div class="content-item-icon">📊</div><div class="content-item-info"><div class="content-item-name">${f.label}: <strong style="color:${f.up ? 'var(--success)' : 'var(--text)'}">${f.value}</strong></div><div class="content-item-meta">Visible to users with Financial Info access in ${biz.name}</div></div></div>`).join('')}
    </div>`;
}

let toastTimer;
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = (type === 'green' ? '✓ ' : '✕ ') + msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}
