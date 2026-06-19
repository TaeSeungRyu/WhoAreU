// PowerShell runner — spawns powershell.exe, passes the script via -EncodedCommand
// (avoids all quoting/escaping headaches), captures stdout, parses JSON.
// Used by processes.js and installed.js.

const { spawn } = require('child_process');

function runPowerShellJson(script, { timeoutMs = 15000 } = {}) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    const proc = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', encoded,
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

module.exports = { runPowerShellJson };
