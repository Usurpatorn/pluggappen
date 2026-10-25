// Privacy guard: the public bundle must not contain family-specific information.
// Forbidden terms are read from a private file that is NOT committed (privacy_terms.local.json); a generic set is always checked.
const fs = require('fs');
const root = __dirname + '/..';
// Alla publika filer: bygget, källorna, dokumentation, service worker, påminnelseskript, arbetsflöden.
const files = ['dist/index.html', 'dist/pluggappen.html', 'README.md', 'sw.js', 'scripts/remind.mjs', 'scripts/build.sh', '.github/workflows/ci.yml', '.github/workflows/reminders.yml', ...fs.readdirSync(root + '/src').map(f => 'src/' + f), ...fs.readdirSync(root + '/tests').flatMap(f => fs.statSync(root + '/tests/' + f).isDirectory() ? fs.readdirSync(root + '/tests/' + f).map(g => 'tests/' + f + '/' + g) : ['tests/' + f])].map(f => root + '/' + f).filter(f => fs.existsSync(f) && !f.endsWith('.local.json') && !f.endsWith('test_privacy.js'));
const generic = ['ADHD', 'Lärarens kommentar · 23/10', 'Kate\'s Day', 'Magic! 4', '2026-11-18', '2026-11-26', '2026-11-02', 'born:', 'Prov 12 Algebra', 'Syror och baser\', date'];
// Privat termlista (barnens namn m.m.) finns ALDRIG i repot: lokalt i tests/privacy_terms.local.json (gitignorerad), i CI via secret PRIVACY_TERMS.
let priv = []; try { priv = JSON.parse(process.env.PRIVACY_TERMS || fs.readFileSync(__dirname + '/privacy_terms.local.json', 'utf8')); } catch (e) { /* no private list available */ }
if (!Array.isArray(priv)) priv = [];
const terms = [...generic, ...priv];
let fails = 0;
for (const f of files) {
  const txt = f.endsWith('.gz') ? require('zlib').gunzipSync(fs.readFileSync(f)).toString('utf8') : fs.readFileSync(f, 'utf8'); // arkiverade byggen granskas okomprimerade
  for (const t of terms) { const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); const n = (txt.match(re) || []).length; if (n) { fails++; console.log('PRIVACY FAIL', f.split('/').slice(-2).join('/'), JSON.stringify(t), 'x' + n); } }
}
console.log(fails ? 'PRIVACY TEST FAILED' : `PRIVACY TEST OK (${files.length} files, ${terms.length} terms${priv.length ? ' incl. private list' : ''})`);
process.exit(fails ? 1 : 0);
