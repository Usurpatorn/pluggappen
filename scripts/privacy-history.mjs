#!/usr/bin/env node
// Integritet i git-historiken: samma termer som tests/test_privacy.js (generiska + den privata listan i secret PRIVACY_TERMS /
// tests/privacy_terms.local.json), men i VARJE commit – varje ändrad fil (även .gz-byggen, okomprimerade) och varje commit-meddelande.
// Termerna skrivs ALDRIG ut (CI-loggar i ett publikt repo är publika): en träff rapporteras som commit + fil + "privat term #n".
//
//   node scripts/privacy-history.mjs                 grenens egna commits (från merge-basen mot origin/main) – underkänner vid träff
//   node scripts/privacy-history.mjs --all           hela historiken som når HEAD – underkänner vid träff
//   node scripts/privacy-history.mjs --all --report  hela historiken – bara antal (underkänner inte)
//
// Kräver full historik (actions/checkout med fetch-depth: 0). Utan historik: hoppar över och säger det.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import url from 'node:url';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'buffer', maxBuffer: 1 << 28 });
const gitS = (...a) => git(...a).toString('utf8').trim();
const args = new Set(process.argv.slice(2)); const ALL = args.has('--all'); const REPORT = args.has('--report');

// Samma generiska termer som test_privacy.js (läses därifrån så att listorna aldrig glider isär)
const tp = fs.readFileSync(path.join(ROOT, 'tests/test_privacy.js'), 'utf8');
const generic = eval(tp.match(/const generic = (\[[^\n]*\]);/)[1]);   // en litteral array i vår egen testfil
let priv = []; try { priv = JSON.parse(process.env.PRIVACY_TERMS || fs.readFileSync(path.join(ROOT, 'tests/privacy_terms.local.json'), 'utf8')); } catch (e) { /* ingen privat lista */ }
if (!Array.isArray(priv)) priv = []; priv = priv.filter(t => typeof t === 'string' && t.trim());
const terms = [...generic.map(t => ({ t, label: JSON.stringify(t) })), ...priv.map((t, i) => ({ t, label: `privat term #${i + 1}` }))]
  .map(x => ({ ...x, re: new RegExp(x.t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }));
const SKIP = (f) => f.endsWith('test_privacy.js') || f.endsWith('privacy-history.mjs') || f.endsWith('.local.json');   // filerna som själva bär de generiska termerna
const hitsIn = (txt) => terms.filter(x => x.re.test(txt)).map(x => x.label);

let shallow = false; try { shallow = gitS('rev-parse', '--is-shallow-repository') === 'true'; } catch (e) { shallow = true; }
if (shallow) { console.log('PRIVACY HISTORY: historiken saknas (grund kloning) – hoppar över. Kör med fetch-depth: 0.'); process.exit(0); }

let range;
if (ALL) range = ['HEAD'];
else {
  let base = ''; for (const ref of ['origin/main', 'main']) { try { base = gitS('merge-base', 'HEAD', ref); break; } catch (e) { /* prova nästa */ } }
  if (!base) { console.log('PRIVACY HISTORY: hittar inte main – hoppar över'); process.exit(0); }
  range = [`${base}..HEAD`];
}
const commits = gitS('rev-list', '--reverse', ...range).split('\n').filter(Boolean);
let bad = 0; const badCommits = new Set();
for (const c of commits) {
  const short = c.slice(0, 7);
  const msgHits = hitsIn(gitS('log', '-1', '--format=%B', c));
  if (msgHits.length) { bad++; badCommits.add(short); if (!REPORT) console.log(`PRIVACY HISTORY FAIL ${short} commit-meddelandet: ${msgHits.join(', ')}`); }
  // ändrade/tillagda filer i commiten (mot varje förälder; rot-commit: hela trädet)
  const parents = gitS('rev-list', '--parents', '-n', '1', c).split(' ').slice(1);
  const lines = parents.length
    ? parents.flatMap(p => gitS('diff-tree', '-r', '--no-renames', '--diff-filter=AM', p, c).split('\n').filter(Boolean))
    : gitS('ls-tree', '-r', c).split('\n').filter(Boolean).map(l => { const [meta, f] = l.split('\t'); const [, , sha] = meta.split(' '); return `:000000 100644 0 ${sha} A\t${f}`; });
  const seen = new Set();
  for (const l of lines) {
    const [meta, f] = l.split('\t'); const sha = meta.split(' ')[3]; if (!f || SKIP(f) || seen.has(sha + f)) continue; seen.add(sha + f);
    let buf = git('cat-file', 'blob', sha); if (f.endsWith('.gz')) { try { buf = zlib.gunzipSync(buf); } catch (e) { /* inte gzip */ } }
    if (f.match(/\.(png|jpg|jpeg|gif|ico|woff2?)$/i)) continue;
    const h = hitsIn(buf.toString('utf8'));
    if (h.length) { bad++; badCommits.add(short); if (!REPORT) console.log(`PRIVACY HISTORY FAIL ${short} ${f}: ${h.join(', ')}`); }
  }
}
const scope = ALL ? 'hela historiken' : 'grenens egna commits';
const summary = `${commits.length} commits (${scope}), ${terms.length} termer${priv.length ? ' inkl. privat lista' : ' (utan privat lista)'}: ${badCommits.size} commits med träff`;
if (REPORT) { console.log(`PRIVACY HISTORY REPORT – ${summary}`); process.exit(0); }
console.log(bad ? `PRIVACY HISTORY FAILED – ${summary}` : `PRIVACY HISTORY OK – ${summary}`);
process.exit(bad ? 1 : 0);
