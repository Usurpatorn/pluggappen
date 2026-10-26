// Privacy guard: the public repo and the public bundle must not contain family-specific information.
// Forbidden terms are read from a private file that is NOT committed (privacy_terms.local.json); a generic set is always checked.
// 2.1: the private terms are NEVER printed (CI logs of a public repo are public) – a hit is reported as "privat term #n" + file:line.
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
// Alla publika filer: bygget, källorna, innehållspaketen, dokumentation, service worker, skript, arbetsflöden och testerna.
const walk = (d) => !fs.existsSync(path.join(root, d)) ? [] : fs.readdirSync(path.join(root, d)).flatMap(f => { const rel = d + '/' + f; return fs.statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel]; });
const files = ['dist/index.html', 'dist/pluggappen.html', 'README.md', 'CLAUDE.md', 'RELEASING.md', 'sw.js', 'firestore.rules', 'package.json', '.gitignore',
  ...walk('scripts'), ...walk('.github'), ...walk('src'), ...walk('content'), ...walk('docs'), ...walk('tests')]
  .filter(f => fs.existsSync(path.join(root, f)) && !f.endsWith('.local.json') && !f.endsWith('test_privacy.js'));
const generic = ['ADHD', 'Lärarens kommentar · 23/10', 'Kate\'s Day', 'Magic! 4', '2026-11-18', '2026-11-26', '2026-11-02', 'born:', 'Prov 12 Algebra', 'Syror och baser\', date'];
// Privat termlista (barnens namn m.m.) finns ALDRIG i repot: lokalt i tests/privacy_terms.local.json (gitignorerad), i CI via secret PRIVACY_TERMS.
let priv = []; try { priv = JSON.parse(process.env.PRIVACY_TERMS || fs.readFileSync(path.join(__dirname, 'privacy_terms.local.json'), 'utf8')); } catch (e) { /* no private list available */ }
if (!Array.isArray(priv)) priv = [];
priv = priv.filter(t => typeof t === 'string' && t.trim());
const terms = [...generic.map(t => ({ t, label: JSON.stringify(t) })), ...priv.map((t, i) => ({ t, label: `privat term #${i + 1}` }))];
let fails = 0;
for (const f of files) {
  const full = path.join(root, f);
  const txt = f.endsWith('.gz') ? require('zlib').gunzipSync(fs.readFileSync(full)).toString('utf8') : fs.readFileSync(full, 'utf8'); // arkiverade byggen granskas okomprimerade
  for (const { t, label } of terms) {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); const hits = [];
    for (let m; (m = re.exec(txt)) && hits.length < 5;) { const before = txt.slice(0, m.index); hits.push(`${before.split('\n').length}:${m.index - before.lastIndexOf('\n')}`); }
    if (hits.length) { fails++; console.log('PRIVACY FAIL', f, label, 'vid rad:kolumn', hits.join(' ')); }
  }
}
console.log(fails ? 'PRIVACY TEST FAILED' : `PRIVACY TEST OK (${files.length} files, ${terms.length} terms${priv.length ? ' incl. private list' : ''})`);
process.exit(fails ? 1 : 0);
