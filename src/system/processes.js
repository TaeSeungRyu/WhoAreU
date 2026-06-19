// Lists user-app processes currently running.
// Excludes Windows system processes by path prefix and a known-names whitelist.

const { runPowerShellFile, resolveScriptPath } = require('./_ps');

const SCRIPT_PATH = resolveScriptPath('processes.ps1');

const WINDOWS_DIR_RE = /^[A-Z]:\\Windows\\/i;

// Known system processes (lowercase) — most either lack a Path readable to a
// non-elevated user (so already filtered) or live under C:\Windows\, but we
// keep this list as a belt-and-suspenders.
const SYSTEM_NAMES = new Set([
  'system', 'idle', 'registry', 'memory compression',
  'svchost', 'csrss', 'smss', 'wininit', 'services', 'lsass',
  'winlogon', 'dwm', 'fontdrvhost', 'spoolsv',
  'taskhostw', 'sihost', 'ctfmon', 'explorer',
  'runtimebroker', 'searchhost', 'startmenuexperiencehost',
  'applicationframehost', 'shellexperiencehost',
  'securityhealthservice', 'securityhealthsystray',
  'systemsettings', 'settingsynchost', 'lockapp',
  'textinputhost', 'usermodepowerassistant', 'searchindexer',
  'wmiprvse', 'conhost', 'audiodg',
]);

function isSystemProcess(p) {
  if (!p || !p.exePath) return true;
  if (WINDOWS_DIR_RE.test(p.exePath)) return true;
  if (SYSTEM_NAMES.has(String(p.name || '').toLowerCase())) return true;
  return false;
}

async function listRunningProcesses() {
  const raw = await runPowerShellFile(SCRIPT_PATH);
  return raw
    .filter((p) => p && p.pid != null)
    .filter((p) => !isSystemProcess(p))
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      exePath: p.exePath,
      memoryBytes: Number(p.memoryBytes) || 0,
    }));
}

module.exports = { listRunningProcesses };
