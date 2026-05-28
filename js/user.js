const BIZ_LOGOS = {
  biz4: 'https://www.moodshine.com/wp-content/uploads/2025/05/MoodShine_Submark-1_Fuscia.png'
};

function renderUserDash() {
  const user = currentUser.data;
  document.getElementById('user-greeting-name').textContent = user.displayName;
  document.getElementById('user-name-top').textContent = user.displayName;
  document.getElementById('user-avatar-top').textContent = user.displayName.charAt(0);
  document.getElementById('user-sub-text').textContent = 'Select a business to view your reports.';
  renderCompanyCards();
}

function renderCompanyCards() {
  const user = currentUser.data;
  const sectionsEl = document.getElementById('user-sections');
  const grantedBizIds = Object.keys(user.permissions).filter(b => user.permissions[b].access);

  if (grantedBizIds.length === 0) {
    sectionsEl.innerHTML = `<div class="no-access">
      <div class="no-access-icon">🔒</div>
      <div class="no-access-title">No Access Yet</div>
      <div class="no-access-msg">You haven't been granted access to any businesses. Please contact your admin.</div>
    </div>`;
    return;
  }

  sectionsEl.innerHTML = `<div class="company-grid">
    ${grantedBizIds.map(bid => {
      const biz = BUSINESSES.find(b => b.id === bid);
      const perms = user.permissions[bid];
      const reports = [];
      if (perms.financials) reports.push('📊 Revenue Dashboard', '📈 Monthly Overview');
      if (perms.docs) reports.push('📁 Documents');
      const logo = BIZ_LOGOS[bid];
      return `<div class="company-card" onclick="openBizReports('${bid}')">
        <div class="company-card-top">
          <div class="company-card-logo">
            ${logo ? `<img src="${logo}" alt="${biz.name} logo" onerror="this.style.display='none';this.parentElement.textContent='${biz.icon}'">` : biz.icon}
          </div>
          <div>
            <div class="company-card-name">${biz.name}</div>
            <div class="company-card-industry">${biz.industry}</div>
          </div>
        </div>
        <div class="company-card-reports">
          ${reports.map(r => `<span class="report-tag">${r}</span>`).join('')}
        </div>
        <div class="company-card-footer">
          <span class="company-card-cta">View Reports</span>
          <span class="company-card-arrow">→</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function openBizReports(bizId) {
  activeUserBiz = bizId;
  const biz = BUSINESSES.find(b => b.id === bizId);
  document.getElementById('user-sub-text').textContent = `${biz.icon} ${biz.name}`;
  renderBizReports(bizId);
}

function renderBizReports(bizId) {
  const user = currentUser.data;
  const perms = user.permissions[bizId] || {};
  const data = CONTENT[bizId];
  const sectionsEl = document.getElementById('user-sections');
  const hasDocs = perms.docs;
  const hasFin = perms.financials;
  const backBtn = `<button class="back-btn" onclick="renderCompanyCards();document.getElementById('user-sub-text').textContent='Select a business to view your reports.'">← Back to Businesses</button>`;

  if (bizId === MOOD_SHINE_BIZ_ID && hasFin && hasDocs) {
    sectionsEl.innerHTML = backBtn + `
      <div style="display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:4px;margin-bottom:1.25rem;">
        <button class="dash-tab-btn active" id="biz-tab-reports" onclick="showBizTab('reports','${bizId}')" style="flex:1;padding:0.5rem;background:var(--surface2);border:1px solid var(--border2);border-radius:7px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.82rem;font-weight:600;cursor:pointer;">📊 Reports</button>
        <button class="dash-tab-btn" id="biz-tab-docs" onclick="showBizTab('docs','${bizId}')" style="flex:1;padding:0.5rem;background:transparent;border:none;border-radius:7px;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:0.82rem;font-weight:500;cursor:pointer;">📁 Documents</button>
      </div>
      <div id="biz-reports-panel"><div id="mood-shine-dash"></div></div>
      <div id="biz-docs-panel" style="display:none;"></div>`;
    renderMoodShineDashboard();
    return;
  }

  if (bizId === MOOD_SHINE_BIZ_ID && hasFin) {
    sectionsEl.innerHTML = backBtn + `<div id="mood-shine-dash"></div>`;
    renderMoodShineDashboard();
    return;
  }

  if (hasDocs && !hasFin) {
    renderUserDocs(bizId);
    return;
  }

  sectionsEl.innerHTML = backBtn + `<div class="user-grid">
    ${hasDocs ? `
      <div class="u-card" style="cursor:pointer;" onclick="renderUserDocs('${bizId}')">
        <div class="u-card-title">📁 Documents</div>
        <div style="color:var(--muted);font-size:0.85rem;">Click to view documents</div>
      </div>` : `
      <div class="locked-card">
        <div class="lock-icon">🔒</div>
        <div style="font-size:0.9rem;font-weight:600;margin-bottom:0.3rem;">Documents</div>
        <div class="lock-msg">You don't have access to documents for this business.</div>
      </div>`}
    ${hasFin ? `
      <div class="u-card">
        <div class="u-card-title">💰 Financial Info <span class="count">${data.financials.length}</span></div>
        ${data.financials.map(f => `
          <div class="fin-item">
            <div class="fin-label">${f.label}</div>
            <div class="fin-value ${f.up ? 'up' : 'neutral'}">${f.value}</div>
          </div>`).join('')}
      </div>` : `
      <div class="locked-card">
        <div class="lock-icon">🔒</div>
        <div style="font-size:0.9rem;font-weight:600;margin-bottom:0.3rem;">Financial Info</div>
        <div class="lock-msg">You don't have access to financial information for this business.</div>
      </div>`}
  </div>`;
}

function showBizTab(tab, bizId) {
  document.getElementById('biz-tab-reports').style.background = tab === 'reports' ? 'var(--surface2)' : 'transparent';
  document.getElementById('biz-tab-reports').style.color = tab === 'reports' ? 'var(--text)' : 'var(--muted)';
  document.getElementById('biz-tab-docs').style.background = tab === 'docs' ? 'var(--surface2)' : 'transparent';
  document.getElementById('biz-tab-docs').style.color = tab === 'docs' ? 'var(--text)' : 'var(--muted)';
  document.getElementById('biz-reports-panel').style.display = tab === 'reports' ? 'block' : 'none';
  document.getElementById('biz-docs-panel').style.display = tab === 'docs' ? 'block' : 'none';
  if (tab === 'docs') renderUserDocs(bizId);
}
