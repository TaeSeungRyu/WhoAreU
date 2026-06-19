// Reads installed-program metadata from the three standard Uninstall registry
// hives (HKLM 64-bit, HKLM 32-bit / WOW6432Node, HKCU).

const { runPowerShellJson } = require('./_ps');

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$paths = @(
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
Get-ItemProperty $paths |
  Where-Object { $_.DisplayName } |
  ForEach-Object {
    [PSCustomObject]@{
      displayName     = $_.DisplayName
      publisher       = $_.Publisher
      installDate     = $_.InstallDate
      estimatedSizeKb = $_.EstimatedSize
      installLocation = $_.InstallLocation
      displayIcon     = $_.DisplayIcon
      displayVersion  = $_.DisplayVersion
    }
  } |
  ConvertTo-Json -Compress
`;

// Registry InstallDate is "YYYYMMDD". Some apps leave it blank or write garbage.
function parseInstallDate(raw) {
  if (!raw) return null;
  const s = String(raw);
  if (!/^\d{8}$/.test(s)) return null;
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  return `${y}-${m}-${d}`;
}

async function listInstalledPrograms() {
  const raw = await runPowerShellJson(PS_SCRIPT);
  return raw
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
}

module.exports = { listInstalledPrograms };
