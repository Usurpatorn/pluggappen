// Kör hela testsviten mot dist/ (bygg först: npm run build). Avslutar med kod 1 om något test faller.
// --quick hoppar över de största generator-sviterna (används inte i CI, bara lokalt).
const { spawnSync } = require('node:child_process'); const fs = require('node:fs'); const path = require('node:path');
const quick = process.argv.includes('--quick');
const dist = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(dist)) { console.error('dist/index.html saknas – kör `npm run build` först'); process.exit(1); }
const suites = [
  ['Generatorer (mallar åk 8/4/2)', 'test_gen.js', { big: true }],
  ['Extra matte (bråk, geometri, enheter, klockan …)', 'test_more.js', { big: true }],
  ['Åk 2 – alla moment, alla nivåer', 'test_ak2.js', { big: true }],
  ['Språk: lektioner och ordkontroll', 'test_lang.js'],
  ['Faktabanker: geografi + kemi', 'test_so.js'],
  ['Synk: två enheter, delta-merge', 'test_sync.js'],
  ['Åtkomst: identitet, medlemskap, regler, radering', 'test_auth.js'],
  ['Indatasäkerhet (XSS)', 'test_xss.js'],
  ['Integritet: inga familjeuppgifter i bundlen', 'test_privacy.js'],
  ['Smoke: hela användarflödet (jsdom)', 'smoke.js'],
  ['Motor v2: regler, logg, synk, migrering (3A+3B)', 'test_le_engine.js'],
  ['Motor v2: simuleringsregression', 'test_le_sim.js'],
  ['Skuggläge: barnen får v1, fångst, föräldravy, täckning', 'test_le_shadow.js'],
  ['Skuggläge: flera enheter, Felboken-synk', 'test_le_sync.js'],
];
let failed = 0; const rows = [];
for (const [name, file, opts = {}] of suites) {
  if (quick && opts.big) { rows.push([name, 'hoppad (--quick)']); continue; }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8', timeout: 240000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').filter(l => l.trim() && !/scrollTo\(\) method/.test(l));
  const summary = lines.slice(-1)[0] || '';
  const ok = r.status === 0;
  if (!ok) failed++;
  rows.push([name, `${ok ? 'OK ' : 'FEL'} ${((Date.now() - t0) / 1000).toFixed(1)}s  ${summary.slice(0, 90)}`]);
  if (!ok) { console.log(`\n===== ${name} (${file}) =====\n` + lines.slice(-40).join('\n') + '\n'); }
}
const w = Math.max(...rows.map(r => r[0].length));
console.log('\nTestsvit – resultat'); for (const [n, s] of rows) console.log(`  ${n.padEnd(w)}  ${s}`);
console.log(failed ? `\n${failed} svit(er) FÖLL` : '\nALLA TESTER GRÖNA');
process.exit(failed ? 1 : 0);
