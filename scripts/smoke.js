// Throwaway smoke test for the system modules.
// Run: node scripts/smoke.js
(async () => {
  const { listProcesses } = require('../src/system');
  const t = Date.now();
  const list = await listProcesses();
  console.log(`processes (merged): ${list.length} entries (${Date.now() - t}ms)`);
  const matched = list.filter((p) => p.publisher);
  console.log(`  matched to an installed program: ${matched.length}`);
  console.log(`  with installDate:               ${list.filter((p) => p.installDate).length}`);
  console.log(`  with diskBytes:                 ${list.filter((p) => p.diskBytes).length}`);
  console.log('\nFirst 5 matched entries:');
  matched.slice(0, 5).forEach((p) => {
    console.log(`  ${p.name} <${p.publisher}>  pid=${p.pid}  mem=${Math.round(p.memoryBytes / 1e6)}MB  disk=${p.diskBytes ? Math.round(p.diskBytes / 1e6) + 'MB' : 'n/a'}  installed=${p.installDate || 'n/a'}`);
  });
  console.log('\nFirst 5 unmatched entries:');
  list.filter((p) => !p.publisher).slice(0, 5).forEach((p) => {
    console.log(`  ${p.name}  pid=${p.pid}  ${p.exePath}`);
  });
})().catch((e) => { console.error(e); process.exit(1); });
