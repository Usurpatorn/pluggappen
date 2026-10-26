// Nyckelfri publicering (scripts/content.mjs fetch/publish/verify/restore) mot Googles Firestore-emulator.
// Körs i CI inuti `firebase emulators:exec` (FIRESTORE_EMULATOR_HOST sätts av emulatorn). SYNTETISKT innehåll – inga riktiga data.
// Visar: backup före skrivning, konfliktskydd (ingen överskrivning av en ändring som kommit emellan), återläsning med kontrollsumma,
// rollback från backup, skadad backup stoppas – och att varken familjekoden eller innehållet skrivs ut i loggen.
import { spawnSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error('kräver Firestore-emulatorn (firebase emulators:exec)'); process.exit(2); }
const FAM = 'syntetisk-familj-' + Math.random().toString(36).slice(2, 8); const MARK = 'HEMLIG-MARKOR-' + Date.now();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-')); const f = (n) => path.join(dir, n);
const bundle = (tag) => JSON.stringify({ v: 1, updatedAt: Date.now(), packs: [], work: [{ id: tag, kid: 'k1', type: 'exam', title: 'syntetiskt prov ' + MARK, date: '2030-01-01' }] });
fs.writeFileSync(f('a.json'), bundle('a')); fs.writeFileSync(f('b.json'), bundle('b')); fs.writeFileSync(f('c.json'), bundle('c'));
let fails = 0; const out = [];
const run = (...args) => { const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/content.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, FAMILY_CODE: FAM, FIREBASE_PROJECT: 'demo-pluggappen' } }); const txt = r.stdout + r.stderr; if (txt.includes(FAM) || txt.includes(MARK)) { fails++; out.push('FAIL utskriften innehåller familjekoden eller innehållet: ' + args[0]); } return { code: r.status, txt: txt.trim() }; };
const check = (name, cond, extra = '') => { out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' – ' + extra : ''}`); if (!cond) fails++; };
const ut = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

let r = run('fetch', f('bk0.json')); check('backup när inget dokument finns', r.code === 0 && ut(f('bk0.json')).exists === false);
r = run('publish', f('a.json')); check('publish utan --expect vägras (konfliktskyddet är obligatoriskt)', r.code === 2);
r = run('publish', f('a.json'), '--expect', 'none'); check('första publiceringen (--expect none)', r.code === 0, r.txt);
r = run('verify', f('a.json')); check('återläsning: identiskt', r.code === 0, r.txt);
r = run('publish', f('b.json'), '--expect', 'none'); check('--expect none stoppas när dokumentet redan finns', r.code === 3);
r = run('verify', f('a.json')); check('…och ingenting skrevs', r.code === 0);
r = run('fetch', f('bk1.json')); const bk1 = ut(f('bk1.json')); check('backup före andra publiceringen', r.code === 0 && bk1.exists && bk1.json === fs.readFileSync(f('a.json'), 'utf8'));
r = run('publish', f('b.json'), '--expect', bk1.updateTime); check('andra publiceringen med rätt updateTime', r.code === 0, r.txt);
r = run('verify', f('b.json')); check('återläsning: version b', r.code === 0);
r = run('publish', f('c.json'), '--expect', bk1.updateTime); check('inaktuell backup: skrivningen stoppas (en ändring har kommit emellan)', r.code === 3);
r = run('verify', f('b.json')); check('…och version b ligger kvar', r.code === 0);
r = run('verify', f('a.json')); check('verify upptäcker avvikelse', r.code === 1);
r = run('fetch', f('bk2.json')); const bk2 = ut(f('bk2.json'));
r = run('restore', f('bk1.json'), '--expect', bk2.updateTime); check('rollback: återställ backupen (version a)', r.code === 0, r.txt);
r = run('verify', f('a.json')); check('återläsning efter rollback: version a', r.code === 0);
const bad = { ...bk1, json: bk1.json.replace('"a"', '"x"') }; fs.writeFileSync(f('bad.json'), JSON.stringify(bad)); r = run('fetch', f('bk3.json'));
r = run('restore', f('bad.json'), '--expect', ut(f('bk3.json')).updateTime); check('skadad backup stoppas (kontrollsumman)', r.code === 1);
r = run('restore', f('bk0.json'), '--expect', ut(f('bk3.json')).updateTime); check('backup av "inget dokument" raderar aldrig av sig själv', r.code === 2);
fs.writeFileSync(f('junk.json'), '{"v":2}'); r = run('publish', f('junk.json'), '--expect', ut(f('bk3.json')).updateTime); check('fel format publiceras aldrig', r.code === 1);
fs.rmSync(dir, { recursive: true, force: true });
const head = `Nyckelfri publicering i emulatorn: ${out.filter(x => x.startsWith('ok')).length} av ${out.length} som förväntat`;
console.log(head); for (const x of out) console.log('  ' + x);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${head}\n\n${out.map(x => '- ' + x).join('\n')}\n\n`);
process.exit(fails ? 1 : 0);
