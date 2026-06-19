// Facade: lists running processes augmented with installed-program metadata.
// Matches a process to an installed app by checking whether the process's
// executable path lies under the app's InstallLocation or DisplayIcon directory.

const path = require('path');
const { listRunningProcesses } = require('./processes');
const { listInstalledPrograms } = require('./installed');

// Strip quotes/whitespace, trailing backslashes, lowercase, and require at least
// one backslash so single-token noise like "C:" or random strings don't match.
function normalizeDir(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/^"|"$/g, '').trim();
  if (!s) return null;
  s = s.replace(/\\+$/g, '');
  if (!s.includes('\\')) return null;
  return s.toLowerCase();
}

// DisplayIcon is often "C:\path\app.exe,0" or "C:\path\app.exe" — extract dir.
function dirFromIcon(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/^"|"$/g, '').trim();
  s = s.split(',')[0].trim();
  if (!s) return null;
  return normalizeDir(path.dirname(s));
}

function buildIndex(apps) {
  const entries = [];
  for (const app of apps) {
    const candidates = new Set();
    const loc = normalizeDir(app.installLocation);
    if (loc) candidates.add(loc);
    const iconDir = dirFromIcon(app.displayIcon);
    if (iconDir) candidates.add(iconDir);
    for (const prefix of candidates) entries.push({ prefix, app });
  }
  // Longest prefix wins — most specific match.
  entries.sort((a, b) => b.prefix.length - a.prefix.length);
  return entries;
}

function findApp(exePath, index) {
  if (!exePath) return null;
  const lower = exePath.toLowerCase();
  for (const { prefix, app } of index) {
    if (lower === prefix || lower.startsWith(prefix + '\\')) return app;
  }
  return null;
}

async function listProcesses({ force = false } = {}) {
  const [procs, apps] = await Promise.all([
    listRunningProcesses(),
    listInstalledPrograms({ force }),
  ]);
  const index = buildIndex(apps);
  return procs.map((p) => {
    const app = findApp(p.exePath, index);
    return {
      pid: p.pid,
      name: (app && app.displayName) || p.name,
      exePath: p.exePath || null,
      publisher: (app && app.publisher) || null,
      installDate: (app && app.installDate) || null,
      diskBytes: app && app.diskBytes != null ? app.diskBytes : null,
      memoryBytes: p.memoryBytes,
    };
  });
}

module.exports = { listProcesses };
