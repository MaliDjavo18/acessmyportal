const SHEET_ID = '1VGpMbt6cw3-KvWM_7SA2e5vxRLez4kEo';
const MOOD_SHINE_BIZ_ID = 'biz4';

const SHEET_YEARS = {
  '2024': ['October 2024', 'November 2024', 'December 2024'],
  '2025': ['January 2025', 'February 2025', 'March 2025', 'April 2025', 'May 2025', 'June 2025', 'July 2025', 'August 2025', 'September 2025', 'October 2025', 'November 2025', 'December 2025'],
  '2026': ['January 2026', 'February 2026', 'March 2026', 'April 2026', 'May 2026']
};

let activeYear = '2026';
let sheetsChart = null;

async function fetchSheetData(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    return JSON.parse(text.substring(47, text.length - 2)).table;
  } catch(e) { return null; }
}

function parseSheetTable(table) {
  if (!table || !table.rows) return { headers: [], rows: [], totals: {}, dayAverages: [], projection: {} };
  const headers = ['Day', 'Date', 'Net Sales', 'Customer Count'];
  const allRows = table.rows.map(r => r.c.map(cell => cell ? (cell.f || cell.v || '') : ''));
  const dayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const rows = allRows.filter(r => {
    const dayCell = String(r[0] || '').toLowerCase().trim();
    const netSales = parseFloat(String(r[2] || '').replace(/[$,]/g, ''));
    return dayNames.includes(dayCell) && !isNaN(netSales) && netSales > 0;
  });
  let totalNetSales = 0, totalSalesCT = 0, count = 0;
  rows.forEach(row => {
    const netSales = parseFloat(String(row[2]).replace(/[$,]/g, ''));
    const salesCT = parseFloat(String(row[3]).replace(/[$,]/g, ''));
    if (!isNaN(netSales) && netSales > 0) { totalNetSales += netSales; count++; }
    if (!isNaN(salesCT) && salesCT > 0) totalSalesCT += salesCT;
  });
  let projNetSales = null, projSalesCT = null, projRowIndex = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (String(allRows[i][5] || '').toLowerCase().trim().includes('projected')) {
      projRowIndex = i;
      projNetSales = parseFloat(String(allRows[i][6] || '').replace(/[$,]/g, ''));
      projSalesCT = parseFloat(String(allRows[i][7] || '').replace(/[$,]/g, ''));
      break;
    }
  }
  const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const dayAverages = [];
  if (projRowIndex >= 0) {
    for (let i = projRowIndex + 1; i < Math.min(projRowIndex + 15, allRows.length); i++) {
      const row = allRows[i] || [];
      const dayName = String(row[5] || '').trim();
      const avgSales = parseFloat(String(row[6] || '').replace(/[$,]/g, ''));
      if (dayOrder.includes(dayName) && !isNaN(avgSales) && avgSales > 0) dayAverages.push({ day: dayName, avg: avgSales });
    }
  }
  dayAverages.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
  return { headers, rows, totals: { netSales: totalNetSales, salesCT: totalSalesCT, days: count }, projection: { netSales: isNaN(projNetSales) ? null : projNetSales, salesCT: isNaN(projSalesCT) ? null : projSalesCT }, dayAverages };
}

function formatCurrency(val) {
  if (!val && val !== 0) return '—';
  const num = parseFloat(String(val).replace(/[$,]/g, ''));
  if (isNaN(num)) return val;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderSheetsChart(rows) {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas) return;
  if (sheetsChart) { sheetsChart.destroy(); sheetsChart = null; }
  sheetsChart = new Chart(canvas, {
    type: 'bar',
    data: { labels: rows.map(r => r[0] || r[1] || '').filter(l => l), datasets: [{ label: 'Net Sales', data: rows.map(r => parseFloat(String(r[2]).replace(/[$,]/g, '')) || 0), backgroundColor: 'rgba(16,185,129,0.5)', borderColor: 'rgba(16,185,129,0.9)', borderWidth: 1, borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' $' + ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2 }) } } }, scales: { x: { ticks: { color: '#5a6a82', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { min: 0, ticks: { color: '#5a6a82', font: { size: 10 }, callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
  });
}

function renderDayChart(dayAverages) {
  const canvas = document.getElementById('day-chart');
  if (!canvas || dayAverages.length === 0) return;
  if (window.dayChartInstance) { window.dayChartInstance.destroy(); window.dayChartInstance = null; }
  const bestDay = Math.max(...dayAverages.map(d => d.avg));
  window.dayChartInstance = new Chart(canvas, {
    type: 'bar',
    data: { labels: dayAverages.map(d => d.day), datasets: [{ label: 'Avg Net Sales', data: dayAverages.map(d => d.avg), backgroundColor: dayAverages.map(d => d.avg === bestDay ? 'rgba(245,158,11,0.7)' : 'rgba(59,130,246,0.5)'), borderColor: dayAverages.map(d => d.avg === bestDay ? 'rgba(245,158,11,1)' : 'rgba(59,130,246,0.9)'), borderWidth: 1, borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' $' + ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2 }) } } }, scales: { x: { ticks: { color: '#5a6a82', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { min: 0, ticks: { color: '#5a6a82', font: { size: 10 }, callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
  });
}

async function loadSheetMonth(sheetName) {
  const loadingEl = document.getElementById('sheets-loading');
  const contentEl = document.getElementById('sheets-content');
  if (loadingEl) loadingEl.style.display = 'flex';
  if (contentEl) contentEl.style.display = 'none';
  const table = await fetchSheetData(sheetName);
  const { headers, rows, totals, projection, dayAverages } = parseSheetTable(table);
  if (loadingEl) loadingEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';

  const summaryEl = document.getElementById('sheets-summary');
  if (summaryEl) {
    const avgNetSales = totals.days > 0 ? totals.netSales / totals.days : 0;
    const avgSalesCT = totals.days > 0 ? totals.salesCT / totals.days : 0;
    summaryEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
        <div class="summary-card">
          <div class="summary-label">Total Net Sales</div>
          <div class="summary-value">${formatCurrency(totals.netSales)}</div>
          <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
            <div class="summary-label">Avg Daily Net Sales</div>
            <div class="summary-value" style="font-size:1.1rem;">${formatCurrency(avgNetSales)}</div>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Customer Count</div>
          <div class="summary-value">${Math.round(totals.salesCT).toLocaleString()}</div>
          <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);">
            <div class="summary-label">Avg Daily Customers</div>
            <div class="summary-value" style="font-size:1.1rem;color:var(--accent2)">${Math.round(avgSalesCT).toLocaleString()}</div>
          </div>
        </div>
      </div>`;
  }

  const projEl = document.getElementById('sheets-projection');
  if (projEl) {
    projEl.innerHTML = (projection.netSales || projection.salesCT) ? `
      <div style="font-family:'Syne',sans-serif;font-size:0.85rem;font-weight:700;margin-bottom:0.75rem;color:var(--warning);">📈 Month-End Projection</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
        <div class="summary-card" style="border-color:rgba(245,158,11,0.3);">
          <div class="summary-label">Projected Net Sales</div>
          <div class="summary-value" style="color:var(--warning)">${projection.netSales ? formatCurrency(projection.netSales) : '—'}</div>
        </div>
        <div class="summary-card" style="border-color:rgba(245,158,11,0.3);">
          <div class="summary-label">Projected Customer Count</div>
          <div class="summary-value" style="color:var(--warning)">${projection.salesCT ? Math.round(projection.salesCT).toLocaleString() : '—'}</div>
        </div>
      </div>` : '';
  }

  renderSheetsChart(rows);
  renderDayChart(dayAverages);

  const bestDayEl = document.getElementById('best-day-label');
  if (bestDayEl && dayAverages.length > 0) {
    const best = dayAverages.reduce((a, b) => a.avg > b.avg ? a : b);
    bestDayEl.textContent = `🏆 Best day: ${best.day} (avg ${formatCurrency(best.avg)})`;
  }

  const tableEl = document.getElementById('sheets-table-body');
  const tableHead = document.getElementById('sheets-table-head');
  if (tableHead) tableHead.innerHTML = headers.map(h => `<th>${h}</th>`).join('');
  if (tableEl) {
    const dataRows = rows.filter(row => !isNaN(parseFloat(String(row[2]).replace(/[$,]/g, ''))) && parseFloat(String(row[2]).replace(/[$,]/g, '')) > 0);
    tableEl.innerHTML = dataRows.length > 0
      ? dataRows.map(row => {
          const day = String(row[0] || '').trim().toLowerCase();
          const isHighlight = day === 'friday' || day === 'saturday';
          const rowStyle = isHighlight ? 'background:rgba(245,158,11,0.08);border-left:3px solid rgba(245,158,11,0.6);' : '';
          return `<tr style="${rowStyle}">${row.slice(0,4).map((cell, i) => {
            if (i === 2) return `<td>${formatCurrency(cell)}</td>`;
            if (i === 3) { const num = parseFloat(String(cell).replace(/[$,]/g, '')); return `<td>${isNaN(num) ? cell : Math.round(num).toLocaleString()}</td>`; }
            if (i === 0 && isHighlight) return `<td style="color:var(--warning);font-weight:600;">${cell}</td>`;
            return `<td>${cell}</td>`;
          }).join('')}</tr>`;
        }).join('')
      : '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:1.5rem;">No data found for this month</td></tr>';
  }
}

function onYearChange() {
  const year = document.getElementById('year-select').value;
  activeYear = year;
  const months = SHEET_YEARS[year] || [];
  const monthSelect = document.getElementById('month-select');
  monthSelect.innerHTML = months.map(m => `<option value="${m}">${m.split(' ')[0]}</option>`).join('');
  loadSheetMonth(months[months.length - 1]);
}

function switchDashTab(tab) {
  document.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('dash-tab-' + tab).classList.add('active');
  document.getElementById('daily-panel').style.display = tab === 'daily' ? 'block' : 'none';
  document.getElementById('monthly-panel').style.display = tab === 'monthly' ? 'block' : 'none';
  if (tab === 'monthly') loadMonthlyOverview();
}

async function loadMonthlyOverview() {
  const loadingEl = document.getElementById('monthly-loading');
  const contentEl = document.getElementById('monthly-content');
  if (loadingEl) loadingEl.style.display = 'flex';
  if (contentEl) contentEl.style.display = 'none';
  const table = await fetchSheetData('Monthly');
  if (!table || !table.rows) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) { contentEl.style.display = 'block'; contentEl.innerHTML = '<div class="empty-state">Could not load Monthly data.</div>'; }
    return;
  }
  const allRows = table.rows.map(r => r.c.map(cell => cell ? (cell.f || cell.v || '') : ''));
  const monthRows = allRows.filter(r => { const month = String(r[0] || '').trim(); const sales = parseFloat(String(r[1] || '').replace(/[$,]/g, '')); return month && !isNaN(sales) && sales > 0; });
  if (loadingEl) loadingEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';
  let totalSales = 0, totalCustomers = 0;
  monthRows.forEach(r => { totalSales += parseFloat(String(r[1] || '').replace(/[$,]/g, '')) || 0; totalCustomers += parseFloat(String(r[2] || '').replace(/[$,]/g, '')) || 0; });
  const yearlyEl = document.getElementById('monthly-yearly');
  if (yearlyEl) {
    yearlyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;margin-bottom:1.25rem;">
        <div class="summary-card" style="border-color:rgba(59,130,246,0.3);">
          <div class="summary-label">Total Revenue (All Time)</div>
          <div class="summary-value">${formatCurrency(totalSales)}</div>
        </div>
        <div class="summary-card" style="border-color:rgba(6,182,212,0.3);">
          <div class="summary-label">Total Customers (All Time)</div>
          <div class="summary-value" style="color:var(--accent2)">${Math.round(totalCustomers).toLocaleString()}</div>
        </div>
        <div class="summary-card" style="border-color:rgba(16,185,129,0.3);">
          <div class="summary-label">Months Tracked</div>
          <div class="summary-value" style="color:var(--success)">${monthRows.length}</div>
        </div>
      </div>`;
  }
  const canvas = document.getElementById('monthly-chart');
  if (canvas) {
    if (window.monthlyChartInstance) { window.monthlyChartInstance.destroy(); }
    const labels = monthRows.map(r => String(r[0] || '').trim());
    const salesData = monthRows.map(r => parseFloat(String(r[1] || '').replace(/[$,]/g, '')) || 0);
    const isProjection = monthRows.map(r => String(r[5] || '').toLowerCase().includes('proj'));
    window.monthlyChartInstance = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Net Sales', data: salesData, backgroundColor: salesData.map((_, i) => isProjection[i] ? 'rgba(245,158,11,0.5)' : 'rgba(59,130,246,0.5)'), borderColor: salesData.map((_, i) => isProjection[i] ? 'rgba(245,158,11,0.9)' : 'rgba(59,130,246,0.9)'), borderWidth: 1, borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' $' + ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2 }) } } }, scales: { x: { ticks: { color: '#5a6a82', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { min: 0, ticks: { color: '#5a6a82', font: { size: 10 }, callback: v => '$' + (v/1000).toFixed(0) + 'K' }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
    });
  }
  const tableEl = document.getElementById('monthly-table-body');
  if (tableEl) {
    tableEl.innerHTML = monthRows.map(r => {
      const isProj = String(r[4] || '').includes('Proj') || String(r[5] || '').includes('Proj');
      const rowStyle = isProj ? 'background:rgba(245,158,11,0.08);border-left:3px solid rgba(245,158,11,0.6);' : '';
      const sales = parseFloat(String(r[1] || '').replace(/[$,]/g, ''));
      const customers = parseFloat(String(r[2] || '').replace(/[$,]/g, ''));
      const dailyAvg = parseFloat(String(r[3] || '').replace(/[$,]/g, ''));
      const profitPct = String(r[5] || '').trim();
      const expenses = parseFloat(String(r[6] || '').replace(/[$,]/g, ''));
      return `<tr style="${rowStyle}">
        <td style="${isProj ? 'color:var(--warning);font-weight:600;' : ''}">${r[0]}${isProj ? ' 🔮' : ''}</td>
        <td>${!isNaN(sales) ? formatCurrency(sales) : '—'}</td>
        <td>${!isNaN(customers) ? Math.round(customers).toLocaleString() : '—'}</td>
        <td>${!isNaN(dailyAvg) ? formatCurrency(dailyAvg) : '—'}</td>
        <td>${profitPct || '—'}</td>
        <td>${!isNaN(expenses) ? formatCurrency(expenses) : '—'}</td>
      </tr>`;
    }).join('');
  }
}

function renderMoodShineDashboard() {
  const container = document.getElementById('mood-shine-dash') || document.getElementById('user-sections');
  const defaultYear = '2026';
  const defaultMonths = SHEET_YEARS[defaultYear];
  const defaultMonth = defaultMonths[defaultMonths.length - 1];

  container.innerHTML = `
    <div style="display:flex;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:4px;margin-bottom:1.25rem;">
      <button class="dash-tab-btn active" id="dash-tab-daily" onclick="switchDashTab('daily')" style="flex:1;padding:0.5rem;background:var(--surface3);border:1px solid var(--border2);border-radius:7px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.82rem;font-weight:600;cursor:pointer;">📊 Daily Revenue</button>
      <button class="dash-tab-btn" id="dash-tab-monthly" onclick="switchDashTab('monthly')" style="flex:1;padding:0.5rem;background:transparent;border:none;border-radius:7px;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:0.82rem;font-weight:500;cursor:pointer;">📈 Monthly Overview</button>
    </div>
    <div id="daily-panel">
      <div class="sheets-controls">
        <select class="sheets-select" id="year-select" onchange="onYearChange()">
          ${Object.keys(SHEET_YEARS).map(y => `<option value="${y}" ${y === defaultYear ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
        <select class="sheets-select" id="month-select" onchange="loadSheetMonth(this.value)">
          ${defaultMonths.map(m => `<option value="${m}" ${m === defaultMonth ? 'selected' : ''}>${m.split(' ')[0]}</option>`).join('')}
        </select>
        <div class="sheets-loading" id="sheets-loading" style="display:none;">Loading data...</div>
      </div>
      <div id="sheets-content" style="display:none;">
        <div class="sheets-summary" id="sheets-summary"></div>
        <div id="sheets-projection" style="margin-bottom:1.25rem;"></div>
        <div class="chart-wrap"><canvas id="revenue-chart"></canvas></div>
        <div style="font-family:'Syne',sans-serif;font-size:0.85rem;font-weight:700;margin:1.25rem 0 0.5rem;color:var(--muted2);">📅 Best Day of Week <span id="best-day-label" style="font-weight:400;color:var(--warning);font-size:0.78rem;margin-left:8px;"></span></div>
        <div class="chart-wrap" style="height:220px;margin-bottom:1.25rem;"><canvas id="day-chart"></canvas></div>
        <div class="sheets-table-wrap">
          <table class="sheets-table">
            <thead><tr id="sheets-table-head"></tr></thead>
            <tbody id="sheets-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
    <div id="monthly-panel" style="display:none;">
      <div class="sheets-loading" id="monthly-loading">Loading data...</div>
      <div id="monthly-content" style="display:none;">
        <div id="monthly-yearly"></div>
        <div class="chart-wrap" style="height:280px;margin-bottom:1.25rem;"><canvas id="monthly-chart"></canvas></div>
        <div class="sheets-table-wrap">
          <table class="sheets-table">
            <thead><tr><th>Month</th><th>Net Sales</th><th>Customers</th><th>Daily Avg</th><th>Profit %</th><th>Expenses</th></tr></thead>
            <tbody id="monthly-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  loadSheetMonth(defaultMonth);
}
