let allDocs = [];
let activeDocsBiz = 'biz1';

function getFileIcon(fileType) {
  if (fileType.includes('pdf')) return { icon: '📄', cls: 'pdf' };
  if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('xlsx') || fileType.includes('xls')) return { icon: '📊', cls: 'excel' };
  if (fileType.includes('word') || fileType.includes('doc')) return { icon: '📝', cls: 'word' };
  return { icon: '📁', cls: 'pdf' };
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const name = document.getElementById('upload-doc-name').value.trim() || file.name;
  const desc = document.getElementById('upload-doc-desc').value.trim();
  const bizId = document.getElementById('upload-biz-select').value;
  document.getElementById('upload-progress').style.display = 'block';
  try {
    const filePath = `${bizId}/${Date.now()}_${file.name}`;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${filePath}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type, 'x-upsert': 'true' },
      body: file
    });
    if (!uploadRes.ok) throw new Error('Upload failed');
    await sbFetch('documents', {
      method: 'POST',
      body: JSON.stringify({ name, description: desc, business_id: bizId, file_path: filePath, file_type: file.type })
    });
    document.getElementById('upload-doc-name').value = '';
    document.getElementById('upload-doc-desc').value = '';
    document.getElementById('doc-file-input').value = '';
    document.getElementById('upload-progress').style.display = 'none';
    showToast('Document uploaded successfully!', 'green');
    await loadAdminDocs();
  } catch(e) {
    document.getElementById('upload-progress').style.display = 'none';
    showToast('Upload failed. Please try again.', 'red');
  }
}

async function loadAdminDocs() {
  try {
    allDocs = await sbFetch('documents?order=uploaded_at.desc');
    renderAdminDocs();
    renderDocsBizFilter();
  } catch(e) { console.error('Error loading docs:', e); }
}

function renderDocsBizFilter() {
  const filterRow = document.getElementById('docs-biz-filter');
  if (!filterRow) return;
  filterRow.innerHTML = BUSINESSES.map(b =>
    `<button class="biz-filter-btn ${b.id === activeDocsBiz ? 'active' : ''}" onclick="setActiveDocsBiz('${b.id}')">${b.icon} ${b.name}</button>`
  ).join('');
}

function setActiveDocsBiz(bizId) {
  activeDocsBiz = bizId;
  renderDocsBizFilter();
  renderAdminDocs();
}

function renderAdminDocs() {
  const container = document.getElementById('admin-docs-list');
  if (!container) return;
  const filtered = allDocs.filter(d => d.business_id === activeDocsBiz);
  const countEl = document.getElementById('docs-count');
  if (countEl) countEl.textContent = `(${allDocs.length} total)`;
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No documents uploaded for this business yet.</div>';
    return;
  }
  container.innerHTML = filtered.map(doc => {
    const { icon } = getFileIcon(doc.file_type);
    const date = new Date(doc.uploaded_at).toLocaleDateString();
    return `<div class="admin-doc-item">
      <div style="font-size:1.5rem;">${icon}</div>
      <div class="admin-doc-info">
        <div class="admin-doc-name">${doc.name}</div>
        <div class="admin-doc-meta">${doc.description || ''} · ${date}</div>
      </div>
      <button class="btn-icon danger" onclick="deleteDoc('${doc.id}', '${doc.file_path}')">🗑 Delete</button>
    </div>`;
  }).join('');
}

async function deleteDoc(docId, filePath) {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/documents/${filePath}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    await sbFetch(`documents?id=eq.${docId}`, { method: 'DELETE', prefer: 'return=minimal' });
    allDocs = allDocs.filter(d => d.id != docId);
    renderAdminDocs();
    showToast('Document deleted', 'red');
  } catch(e) { showToast('Error deleting document', 'red'); }
}

async function getDocURL(filePath) {
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/documents/${filePath}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 })
    });
    const data = await res.json();
    return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
  } catch(e) { return null; }
}

function openPDFModal(url, name) {
  document.getElementById('pdf-modal-title').textContent = name;
  document.getElementById('pdf-iframe').src = url;
  document.getElementById('pdf-modal').classList.add('open');
}

function closePDFModal() {
  document.getElementById('pdf-modal').classList.remove('open');
  document.getElementById('pdf-iframe').src = '';
}

async function renderUserDocs(bizId) {
  const sectionsEl = document.getElementById('user-sections');
  const biz = BUSINESSES.find(b => b.id === bizId);
  sectionsEl.innerHTML = `<button class="back-btn" onclick="renderCompanyCards();document.getElementById('user-sub-text').textContent='Select a business to view your reports.'">← Back to Businesses</button>
  <div class="u-card">
    <div class="u-card-title">📁 Documents — ${biz.name}</div>
    <div id="user-docs-loading" style="text-align:center;color:var(--muted);padding:2rem;">Loading documents...</div>
    <div class="docs-grid" id="user-docs-grid" style="display:none;"></div>
  </div>`;
  try {
    const docs = await sbFetch(`documents?business_id=eq.${bizId}&order=uploaded_at.desc`);
    document.getElementById('user-docs-loading').style.display = 'none';
    if (docs.length === 0) {
      document.getElementById('user-docs-grid').style.display = 'block';
      document.getElementById('user-docs-grid').innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No documents available yet.</div>';
      return;
    }
    document.getElementById('user-docs-grid').style.display = 'grid';
    document.getElementById('user-docs-grid').innerHTML = docs.map(doc => {
      const { icon, cls } = getFileIcon(doc.file_type);
      const date = new Date(doc.uploaded_at).toLocaleDateString();
      return `<div class="doc-card" onclick="openUserDoc('${doc.file_path}', '${doc.name}', '${doc.file_type}')">
        <div class="doc-card-icon ${cls}">${icon}</div>
        <div class="doc-card-name">${doc.name}</div>
        ${doc.description ? `<div class="doc-card-desc">${doc.description}</div>` : ''}
        <div class="doc-card-date">📅 ${date}</div>
      </div>`;
    }).join('');
  } catch(e) {
    document.getElementById('user-docs-loading').textContent = 'Error loading documents.';
  }
}

async function openUserDoc(filePath, name, fileType) {
  const url = await getDocURL(filePath);
  if (!url) { showToast('Could not open document', 'red'); return; }
  if (fileType.includes('pdf')) {
    openPDFModal(url, name);
  } else {
    openPDFModal(`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`, name);
  }
}
