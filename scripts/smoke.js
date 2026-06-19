// Throwaway smoke test for processes.js / installed.js.
// Run: node scripts/smoke.js
(async () => {
  const { listRunningProcesses } = require('../src/system/processes');
  const { listInstalledPrograms } = require('../src/system/installed');

  const t1 = Date.now();
  const procs = await listRunningProcesses();
  console.log(`processes: ${procs.length} entries (${Date.now() - t1}ms)`);
  console.log('  sample:', procs.slice(0, 3));

  const t2 = Date.now();
  const apps = await listInstalledPrograms();
  console.log(`installed: ${apps.length} entries (${Date.now() - t2}ms)`);
  console.log('  sample:', apps.slice(0, 3));
})().catch((e) => { console.error(e); process.exit(1); });
