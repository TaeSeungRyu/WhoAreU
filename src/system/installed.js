// Reads installed-program metadata from the three standard Uninstall registry
// hives (HKLM 64-bit, HKLM 32-bit / WOW6432Node, HKCU).
//
// Result is cached: installs/uninstalls are rare events, but auto-refresh hits
// this every few seconds. Caching cuts PowerShell spawn frequency in half,
// which both improves responsiveness and lowers AV-heuristic noise. The cache
// is bypassed when `force: true` is passed (wired to the manual refresh button).

const { runPowerShellFile, resolveScriptPath } = require('./_ps');

const SCRIPT_PATH = resolveScriptPath('installed.ps1');
const CACHE_TTL_MS = 60 * 1000;

let cache = null;
let cacheAt = 0;

// Registry InstallDate is "YYYYMMDD". Some apps leave it blank or write garbage.
function parseInstallDate(raw) {
  if (!raw) return null;
  const s = String(raw);
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

async function listInstalledPrograms({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) {
    return cache;
  }
  const raw = await runPowerShellFile(SCRIPT_PATH);
  cache = raw
    .filter((x) => x && x.displayName)
    .map((x) => ({
      displayName: x.displayName,
      publisher: x.publisher || null,
      installDate: parseInstallDate(x.installDate),
      diskBytes: x.estimatedSizeKb ? Number(x.estimatedSizeKb) * 1024 : null,
      installLocation: x.installLocation || null,
      displayIcon: x.displayIcon || null,
      displayVersion: x.displayVersion || null,
    }));
  cacheAt = Date.now();
  return cache;
}

module.exports = { listInstalledPrograms };
