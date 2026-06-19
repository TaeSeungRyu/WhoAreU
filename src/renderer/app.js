const state = {
  rows: [],                 // flat processes from IPC
  filter: '',
  sortKey: 'totalMemoryBytes',
  sortDir: 'desc',
  expanded: new Set(),      // group keys whose details are open
  autoRefreshMs: 10000,
  windowVisible: true,
  loading: false,
  error: null,
  lastRefreshAt: null,
};

// Sensible default direction per sort key.
const SORT_DEFAULTS = {
  totalMemoryBytes: 'desc',
  diskBytes: 'desc',
  processCount: 'desc',
  installDate: 'desc',
  name: 'asc',
  publisher: 'asc',
};

let autoTimer = null;
const $ = (id) => document.getElementById(id);

function formatBytes(n) {
  if (n == null) return null;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Group processes by app. Matched apps use displayName+publisher as identity;
// unmatched use processName+exePath so two unrelated installs of the same
// binary (e.g. claude.exe in MSIX vs VS Code extension) stay separate.
function groupByApp(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.publisher
      ? r.name + '|' + r.publisher
      : '__nopub__|' + r.name + '|' + (r.exePath || '');
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        name: r.name,
        publisher: r.publisher,
        installDate: r.installDate,
        diskBytes: r.diskBytes,
        exePath: r.exePath,
        processCount: 0,
        totalMemoryBytes: 0,
        processes: [],
      };
      map.set(key, g);
    }
    g.processCount += 1;
    g.totalMemoryBytes += r.memoryBytes || 0;
    g.processes.push({ pid: r.pid, memoryBytes: r.memoryBytes, exePath: r.exePath });
  }
  return Array.from(map.values());
}

function compareValues(a, b, dir) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;   // nulls always last regardless of direction
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a;
  }
  const cmp = String(a).localeCompare(String(b), 'ko');
  return dir === 'asc' ? cmp : -cmp;
}

function filterGroup(g, q) {
  if (!q) return true;
  return (
    (g.name || '').toLowerCase().includes(q) ||
    (g.publisher || '').toLowerCase().includes(q) ||
    (g.exePath || '').toLowerCase().includes(q)
  );
}

function applyView() {
  const groups = groupByApp(state.rows);
  const q = state.filter.trim().toLowerCase();
  const filtered = q ? groups.filter((g) => filterGroup(g, q)) : groups;
  filtered.sort((a, b) => compareValues(a[state.sortKey], b[state.sortKey], state.sortDir));
  return { groups, filtered };
}

function processListHtml(g) {
  // Sort PIDs by memory desc inside the expanded panel.
  const procs = g.processes.slice().sort((a, b) => (b.memoryBytes || 0) - (a.memoryBytes || 0));
  const items = procs
    .map(
      (p) =>
        '<li><span class="pid">#' +
        p.pid +
        '</span><span>' +
        escapeHtml(formatBytes(p.memoryBytes) || '—') +
        '</span></li>'
    )
    .join('');
  const path = g.exePath
    ? '<div class="path">' + escapeHtml(g.exePath) + '</div>'
    : '';
  return path + '<ul>' + items + '</ul>';
}

function cardHtml(g) {
  const expanded = state.expanded.has(g.key);
  const isUnverified = !g.publisher;
  const pubHtml = g.publisher
    ? '<span class="pub">' + escapeHtml(g.publisher) + '</span>'
    : '<span class="pub unknown">출처 미확인</span>';

  const meta = [pubHtml];
  if (g.installDate) {
    meta.push('<span class="sep">·</span>');
    meta.push('<span>설치 ' + escapeHtml(g.installDate) + '</span>');
  }
  if (g.diskBytes != null) {
    meta.push('<span class="sep">·</span>');
    meta.push('<span>디스크 <span class="num">' + escapeHtml(formatBytes(g.diskBytes)) + '</span></span>');
  }

  const childrenHtml = expanded
    ? '<div class="card-children">' + processListHtml(g) + '</div>'
    : '';

  return (
    '<div class="card' +
    (isUnverified ? ' unverified' : '') +
    (expanded ? ' expanded' : '') +
    '" data-key="' +
    escapeHtml(g.key) +
    '">' +
    '<div class="card-header">' +
    '<span class="card-name" title="' +
    escapeHtml(g.name) +
    '">' +
    escapeHtml(g.name) +
    '</span>' +
    '<span class="card-badge">' +
    g.processCount +
    ' 프로세스</span>' +
    '<span class="card-chevron">▾</span>' +
    '</div>' +
    '<div class="card-meta">' +
    meta.join('') +
    '</div>' +
    '<div class="card-stat"><span class="label">메모리 합계</span>' +
    escapeHtml(formatBytes(g.totalMemoryBytes)) +
    '</div>' +
    childrenHtml +
    '</div>'
  );
}

function renderStatus(view) {
  if (state.loading) {
    $('status').textContent = '로딩 중…';
    return;
  }
  if (!state.lastRefreshAt) {
    $('status').textContent = '';
    return;
  }
  const ago = Math.max(0, Math.round((Date.now() - state.lastRefreshAt) / 1000));
  const procCount = state.rows.length;
  const appCount = view ? view.groups.length : 0;
  const shown = view ? view.filtered.length : appCount;
  const counts =
    shown === appCount
      ? appCount + '개 앱 · ' + procCount + '개 프로세스'
      : shown + ' / ' + appCount + '개 앱 · ' + procCount + '개 프로세스';
  $('status').textContent = counts + ' · 마지막 갱신 ' + ago + '초 전';
}

function renderSortDir() {
  $('sortDir').textContent = state.sortDir === 'asc' ? '▲' : '▼';
  $('sortDir').title = state.sortDir === 'asc' ? '오름차순 (클릭: 내림차순)' : '내림차순 (클릭: 오름차순)';
}

function render() {
  const cards = $('cards');
  const errorBox = $('error');
  const emptyBox = $('empty');

  if (state.error) {
    errorBox.textContent = '오류: ' + state.error;
    errorBox.classList.remove('hidden');
    emptyBox.classList.add('hidden');
    cards.innerHTML = '';
    renderStatus(null);
    return;
  }
  errorBox.classList.add('hidden');

  const view = applyView();
  if (view.filtered.length === 0) {
    cards.innerHTML = '';
    emptyBox.classList.remove('hidden');
  } else {
    emptyBox.classList.add('hidden');
    cards.innerHTML = view.filtered.map(cardHtml).join('');
  }
  renderStatus(view);
  renderSortDir();
}

async function refresh({ force = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  $('refresh').disabled = true;
  renderStatus(null);
  try {
    state.rows = await window.whoAreU.list({ force });
    state.error = null;
    state.lastRefreshAt = Date.now();
  } catch (err) {
    state.error = (err && err.message) || String(err);
  } finally {
    state.loading = false;
    $('refresh').disabled = false;
    render();
  }
}

function setAutoRefresh(on) {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  // Only actually run the timer when the user wants it AND the window is shown.
  // While hidden, the renderer stays completely quiet — no PowerShell spawns.
  if (on && state.windowVisible) autoTimer = setInterval(refresh, state.autoRefreshMs);
}

if (window.whoAreU && window.whoAreU.onVisibility) {
  window.whoAreU.onVisibility((visible) => {
    state.windowVisible = visible;
    setAutoRefresh($('autoRefresh').checked);
  });
}

// --- wiring ---

$('search').addEventListener('input', (e) => {
  state.filter = e.target.value;
  render();
});

$('refresh').addEventListener('click', () => refresh({ force: true }));

$('autoRefresh').addEventListener('change', (e) => {
  setAutoRefresh(e.target.checked);
});

$('sortKey').addEventListener('change', (e) => {
  state.sortKey = e.target.value;
  state.sortDir = SORT_DEFAULTS[state.sortKey] || 'desc';
  render();
});

$('sortDir').addEventListener('click', () => {
  state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  render();
});

// Event delegation for card expand/collapse.
$('cards').addEventListener('click', (e) => {
  const header = e.target.closest('.card-header');
  if (!header) return;
  const card = header.closest('.card');
  if (!card) return;
  const key = card.dataset.key;
  if (state.expanded.has(key)) state.expanded.delete(key);
  else state.expanded.add(key);
  render();
});

// Status "ago" ticker — only refresh the status line, not the whole tree.
setInterval(() => {
  if (!state.loading && state.lastRefreshAt) renderStatus(applyView());
}, 1000);

// Boot
refresh();
setAutoRefresh(true);
