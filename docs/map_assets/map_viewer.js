/** Project Map Viewer Interactive Logic **/
let projectData = null;

async function initMapViewer() {
  try {
    const res = await fetch('project_map.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    projectData = await res.json();
  } catch (err) {
    if (window.EMBEDDED_PROJECT_MAP) {
      projectData = window.EMBEDDED_PROJECT_MAP;
    } else {
      console.warn('Could not load project_map.json via fetch, using fallback', err);
    }
  }

  if (projectData) {
    renderHeaderAndStats();
    renderArchitecture();
    renderDataFlows();
    renderEndpoints();
    renderFileTable();
    renderRawJson();
    setupEventListeners();
  }
}

function renderHeaderAndStats() {
  const sum = projectData.summary || {};
  const meta = (projectData.project || {}).name || 'HODL Watcher';
  document.getElementById('project-title').textContent = `${meta} — Architecture Map`;
  document.getElementById('stat-files').textContent = sum.total_files || 0;
  document.getElementById('stat-loc').textContent = (sum.total_loc || 0).toLocaleString();
  
  const eps = (projectData.project || {}).endpoints || [];
  document.getElementById('stat-endpoints').textContent = eps.length;

  const comp = sum.compliance?.rule_200_lines_limit || {};
  const compEl = document.getElementById('stat-compliance');
  if (compEl) {
    compEl.textContent = comp.compliant ? '100% (Clean)' : `${comp.violations_count} files > 200 LOC`;
    compEl.style.color = comp.compliant ? '#34d399' : '#f87171';
  }
}

function renderArchitecture() {
  const layers = (projectData.project || {}).layers || {};
  const breakdown = projectData.summary?.layer_breakdown || {};
  const grid = document.getElementById('layers-grid');
  if (!grid) return;

  grid.innerHTML = Object.entries(layers).map(([key, l]) => {
    const st = breakdown[key] || { files: 0, loc: 0 };
    return `
      <div class="layer-card" style="border-left: 4px solid ${l.color || '#3b82f6'}">
        <div class="layer-card-header">
          <h3 style="color:${l.color || '#fff'}">${l.name}</h3>
          <span class="badge badge-layer">${st.files} files</span>
        </div>
        <p style="color:var(--text-secondary); font-size:0.88rem; margin-bottom:12px;">${l.description}</p>
        <div style="font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between;">
          <span class="code-pill">${l.path}</span>
          <span>${st.loc.toLocaleString()} LOC</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderDataFlows() {
  const flows = (projectData.project || {}).data_flows || [];
  const container = document.getElementById('flows-container');
  if (!container) return;

  container.innerHTML = flows.map(f => `
    <div class="flow-card" style="margin-bottom: 12px; display:flex; gap:16px; align-items:flex-start;">
      <div class="logo-icon" style="min-width:36px; height:36px; font-size:1rem;">${f.step}</div>
      <div>
        <h4 style="margin-bottom:4px; font-size:1rem;">${f.title} <span class="badge badge-layer">${f.layer}</span></h4>
        <p style="color:var(--text-secondary); font-size:0.88rem;">${f.detail}</p>
      </div>
    </div>
  `).join('');
}

function renderEndpoints() {
  const eps = (projectData.project || {}).endpoints || [];
  const grid = document.getElementById('endpoints-grid');
  if (!grid) return;

  grid.innerHTML = eps.map(e => `
    <div class="endpoint-card">
      <div class="endpoint-header">
        <span class="endpoint-method method-${e.method.toLowerCase()}">${e.method}</span>
        <code style="font-size:0.95rem; font-weight:600; color:#fff;">${e.path}</code>
      </div>
      <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:10px;">${e.description}</p>
      <div style="font-size:0.8rem; color:var(--text-muted);">
        <strong>Returns:</strong> <span class="code-pill">${e.response}</span>
      </div>
    </div>
  `).join('');
}

function renderFileTable(filterQuery = '', filterLayer = 'all') {
  const files = projectData.files || [];
  const tbody = document.getElementById('files-table-body');
  if (!tbody) return;

  const q = filterQuery.toLowerCase();
  const filtered = files.filter(f => {
    const matchQ = f.path.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
    const matchL = filterLayer === 'all' || f.layer === filterLayer;
    return matchQ && matchL;
  });

  tbody.innerHTML = filtered.map(f => `
    <tr>
      <td><span class="code-pill">${f.path}</span></td>
      <td><span class="badge badge-layer">${f.layer}</span></td>
      <td style="color:${f.loc > 200 ? '#f87171' : 'inherit'}">${f.loc}</td>
      <td style="color:var(--text-muted);">${(f.size_bytes / 1024).toFixed(1)} KB</td>
    </tr>
  `).join('');
}

function renderRawJson() {
  const pre = document.getElementById('raw-json-content');
  if (pre) pre.textContent = JSON.stringify(projectData, null, 2);
}

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Search & Filter
  const sInput = document.getElementById('search-files');
  const lSelect = document.getElementById('filter-layer');
  if (sInput && lSelect) {
    const handleFilter = () => renderFileTable(sInput.value, lSelect.value);
    sInput.addEventListener('input', handleFilter);
    lSelect.addEventListener('change', handleFilter);
  }

  // Copy JSON
  const copyBtn = document.getElementById('copy-json-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(projectData, null, 2));
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy JSON', 2000);
    });
  }
}

document.addEventListener('DOMContentLoaded', initMapViewer);
