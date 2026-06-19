const state = {
  rows: [],
  filter: '',
  sortKey: 'memoryBytes',
  sortDir: 'desc',
  autoRefreshMs: 5000,
  loading: false,
  error: null,
  lastRefreshAt: null,
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

function compareValues(a, b, dir) {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls always last
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a;
  }
  const cmp = String(a).localeCompare(String(b), 'ko');
  return dir === 'asc' ? cmp : -cmp;
}

function applyFilterAndSort() {
  const q = state.filter.trim().toLowerCase();
  const list = q
    ? state.rows.filter((r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.publisher || '').toLowerCase().includes(q) ||
        (r.exePath || '').toLowerCase().includes(q))
    : state.rows.slice();
  list.sort((a, b) => compareValues(a[state.sortKey], b[state.sortKey], state.sortDir));
  return list;
}

function muted(v) {
  return v ? escapeHtml(v) : '<span class="muted">—</span>';
}

function rowHtml(r) {
  const disk = r.diskBytes != null ? formatBytes(r.diskBytes) : null;
  const mem = formatBytes(r.memoryBytes);
  return (
    '<tr>' +
    '<td title="' + escapeHtml(r.name) + '">' + escapeHtml(r.name) + '</td>' +
    '<td title="' + escapeHtml(r.publisher || '') + '">' + muted(r.publisher) + '</td>' +
    '<td title="' + escapeHtml(r.exePath || '') + '">' + muted(r.exePath) + '</td>' +
    '<td class="num">' + muted(disk) + '</td>' +
    '<td class="num">' + escapeHtml(mem) + '</td>' +
    '<td>' + muted(r.installDate) + '</td>' +
    '<td class="num">' + r.pid + '</td>' +
    '</tr>'
  );
}

function renderHeaderSort() {
  document.querySelectorAll('th').forEach((th) => {
    th.classList.remove('sorted', 'asc');
    if (th.dataset.key === state.sortKey) {
      th.classList.add('sorted');
      if (state.sortDir === 'asc') th.classList.add('asc');
    }
  });
}

function renderStatus() {
  if (state.loading) {
    $('status').textContent = '로딩 중…';
    return;
  }
  if (!state.lastRefreshAt) {
    $('status').textContent = '';
    return;
  }
  const ago = Math.max(0, Math.round((Date.now() - state.lastRefreshAt) / 1000));
  $('status').textContent = state.rows.length + '개 · 마지막 갱신 ' + ago + '초 전';
}

function render() {
  const tbody = $('tbody');
  const errorBox = $('error');
  const emptyBox = $('empty');

  if (state.error) {
    errorBox.textContent = '오류: ' + state.error;
    errorBox.classList.remove('hidden');
    emptyBox.classList.add('hidden');
    tbody.innerHTML = '';
    renderHeaderSort();
    renderStatus();
    return;
  }
  errorBox.classList.add('hidden');

  const list = applyFilterAndSort();
  if (list.length === 0) {
    tbody.innerHTML = '';
    emptyBox.classList.remove('hidden');
  } else {
    emptyBox.classList.add('hidden');
    tbody.innerHTML = list.map(rowHtml).join('');
  }

  renderHeaderSort();
  renderStatus();
}

async function refresh() {
  if (state.loading) return;
  state.loading = true;
  $('refresh').disabled = true;
  renderStatus();
  try {
    state.rows = await window.whoAreU.list();
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
  if (on) autoTimer = setInterval(refresh, state.autoRefreshMs);
}

// Wire UI
$('search').addEventListener('input', (e) => {
  state.filter = e.target.value;
  render();
});

$('refresh').addEventListener('click', refresh);

$('autoRefresh').addEventListener('change', (e) => {
  setAutoRefresh(e.target.checked);
});

document.querySelectorAll('th').forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.key;
    if (!key) return;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = key === 'name' || key === 'publisher' || key === 'installDate' ? 'asc' : 'desc';
    }
    render();
  });
});

// Status "ago" ticker — keeps the relative time fresh between refreshes.
setInterval(renderStatus, 1000);

// Boot
refresh();
setAutoRefresh(true);
