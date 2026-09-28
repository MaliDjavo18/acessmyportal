// USER DASHBOARD
// ────────────────────────────
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
  const grantedBizIds = Object.keys(user.permissions).filter(b => user.permissions[b].access && b !== 'personal');
  const hasPersonal = user.permissions['personal'] && user.permissions['personal'].access;

  if (grantedBizIds.length === 0 && !hasPersonal) {
    sectionsEl.innerHTML = `<div class="no-access">
      <div class="no-access-icon">&#128274;</div>
      <div class="no-access-title">No Access Yet</div>
      <div class="no-access-msg">You haven't been granted access to any content. Please contact your admin.</div>
    </div>`;
    return;
  }

  const personalCard = hasPersonal ? `
    <div class="company-card" onclick="openPersonalView()" style="background:linear-gradient(135deg,var(--surface2) 0%,var(--surface3,var(--surface2)) 100%);border-color:var(--accent);">
      <div class="company-card-top">
        <div class="company-card-logo" style="font-size:1.8rem;">&#127969;</div>
        <div>
          <div class="company-card-name">Mamic Family</div>
          <div class="company-card-industry">Personal &amp; Family</div>
        </div>
      </div>
      <div class="company-card-reports">
        <span class="report-tag">&#128221; Notes</span>
        <span class="report-tag">&#128194; Documents</span>
        <span class="report-tag">&#128222; Contacts</span>
        <span class="report-tag">&#128279; Links</span>
      </div>
      <div class="company-card-footer">
        <span class="company-card-cta">View Family Hub</span>
        <span class="company-card-arrow">&rarr;</span>
      </div>
    </div>` : '';

  sectionsEl.innerHTML = `<div class="company-grid">
    ${personalCard}
    ${grantedBizIds.map(bid => {
      const biz = BUSINESSES.find(b => b.id === bid);
      if (!biz) return '';
      const perms = user.permissions[bid];
      const reports = [];
      if (perms.financials) reports.push('&#128202; Revenue Dashboard', '&#128200; Monthly Overview');
      if (perms.docs) reports.push('&#128193; Documents');
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
          <span class="company-card-arrow">&rarr;</span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function openPersonalView() {
  const sectionsEl = document.getElementById('user-sections');
  document.getElementById('user-sub-text').textContent = '&#127969; Mamic Family';
  const data = (typeof getPersonalDataForUser === 'function') ? getPersonalDataForUser() : { notes: [], links: [], contacts: [], docs: [] };
  const backBtn = `<button class="back-btn" onclick="renderCompanyCards();document.getElementById('user-sub-text').textContent='Select a business to view your reports.'">← Back</button>`;

  const notesHtml = data.notes.length ? data.notes.map(n => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.65rem;margin-bottom:0.4rem;">
      <div style="font-size:0.83rem;white-space:pre-wrap;">${n.text}</div>
      <div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;">${n.date}</div>
    </div>`).join('') : '<div style="color:var(--muted);font-size:0.82rem;">No notes shared yet.</div>';

  const linksHtml = data.links.length ? data.links.map(l => `
    <a href="${l.url}" target="_blank" style="display:block;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;margin-bottom:0.4rem;color:var(--accent);font-size:0.83rem;font-weight:600;text-decoration:none;">${l.label}</a>`).join('') : '<div style="color:var(--muted);font-size:0.82rem;">No links shared yet.</div>';

  const contactsHtml = data.contacts.length ? data.contacts.map(c => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;margin-bottom:0.4rem;">
      <div style="font-weight:600;font-size:0.83rem;">${c.name}</div>
      <div style="font-size:0.8rem;color:var(--accent);">${c.phone}</div>
      ${c.note ? '<div style="font-size:0.74rem;color:var(--muted);">' + c.note + '</div>' : ''}
    </div>`).join('') : '<div style="color:var(--muted);font-size:0.82rem;">No contacts shared yet.</div>';

  const docsHtml = data.docs.length ? data.docs.map(d => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.75rem;margin-bottom:0.4rem;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:0.83rem;font-weight:600;">&#128196; ${d.name}</div>
        <div style="font-size:0.73rem;color:var(--muted);">${d.date}</div>
      </div>
      <a href="${d.url}" target="_blank" style="font-size:0.8rem;color:var(--accent);text-decoration:none;font-weight:600;">View</a>
    </div>`).join('') : '<div style="color:var(--muted);font-size:0.82rem;">No documents shared yet.</div>';

  sectionsEl.innerHTML = backBtn + `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:0.5rem;">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1.1rem;">
        <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.75rem;">&#128221; Family Notes</div>
        ${notesHtml}
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1.1rem;">
        <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.75rem;">&#128279; Important Links</div>
        ${linksHtml}
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1.1rem;">
        <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.75rem;">&#128194; Family Documents</div>
        ${docsHtml}
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:1.1rem;">
        <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.75rem;">&#128222; Family Contacts</div>
        ${contactsHtml}
      </div>
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
    sectionsEl.innerHTML = backBtn;
    sectionsEl.innerHTML += `
      <div style="display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:4px;margin-bottom:1.25rem;">
        <button class="dash-tab-btn active" id="biz-tab-reports" onclick="showBizTab('reports','${bizId}')" style="flex:1;padding:0.5rem;background:var(--surface2);border:1px solid var(--border2);border-radius:7px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.82rem;font-weight:600;cursor:pointer;">&#128202; Reports</button>
        <button class="dash-tab-btn" id="biz-tab-docs" onclick="showBizTab('docs','${bizId}')" style="flex:1;padding:0.5rem;background:transparent;border:none;border-radius:7px;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:0.82rem;font-weight:500;cursor:pointer;">&#128193; Documents</button>
      </div>
      <div id="biz-reports-panel"><div id="mood-shine-dash"></div></div>
      <div id="biz-docs-panel" style="display:none;"></div>`;
    renderMoodShineDashboard();
    return;
  }

  if (bizId === MOOD_SHINE_BIZ_ID && hasFin) {
    sectionsEl.innerHTML = backBtn;
    sectionsEl.innerHTML += `<div id="mood-shine-dash"></div>`;
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
        <div class="u-card-title">&#128193; Documents</div>
        <div style="color:var(--muted);font-size:0.85rem;">Click to view documents</div>
      </div>` : `
      <div class="locked-card">
        <div class="lock-icon">&#128274;</div>
        <div style="font-size:0.9rem;font-weight:600;margin-bottom:0.3rem;">Documents</div>
        <div class="lock-msg">You don't have access to documents for this business.</div>
      </div>`}
    ${hasFin ? `
      <div class="u-card">
        <div class="u-card-title">&#128176; Financial Info <span class="count">${data.financials.length}</span></div>
        ${data.financials.map(f => `
          <div class="fin-item">
            <div class="fin-label">${f.label}</div>
            <div class="fin-value ${f.up ? 'up' : 'neutral'}">${f.value}</div>
          </div>`).join('')}
      </div>` : `
      <div class="locked-card">
        <div class="lock-icon">&#128274;</div>
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

// ────────────────────────────
