// Spawns powershell.exe with -File pointing at a shipped .ps1 script.
// (Avoids -EncodedCommand, which Korean AV products like V3 / 알약 treat as
// a strong indicator of Living-off-the-Land abuse.)

const { spawn } = require('child_process');
const path = require('path');

// In production, this module sits inside app.asar but PowerShell can't read
// from inside the archive. electron-builder unpacks .ps1 files (via
// build.asarUnpack) to a sibling app.asar.unpacked tree — swap the prefix.
function resolveScriptPath(name) {
  const ASAR_SEG = `${path.sep}app.asar${path.sep}`;
  const UNPACKED_SEG = `${path.sep}app.asar.unpacked${path.sep}`;
  const base = __dirname.includes(ASAR_SEG)
    ? __dirname.replace(ASAR_SEG, UNPACKED_SEG)
    : __dirname;
  return path.join(base, name);
}

function runPowerShellFile(scriptPath, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
    ], { windowsHide: true });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    proc.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

    const killTimer = setTimeout(() => {
      proc.kill();
      reject(new Error(`PowerShell timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('error', (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(killTimer);
      if (code !== 0) {
        return reject(new Error(`PowerShell exited with code ${code}: ${stderr.trim()}`));
      }
      const trimmed = stdout.trim();
      if (!trimmed) return resolve([]);
      try {
        const parsed = JSON.parse(trimmed);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (err) {
        reject(new Error(`Failed to parse PowerShell JSON: ${err.message}`));
      }
    });
  });
}

module.exports = { runPowerShellFile, resolveScriptPath };
