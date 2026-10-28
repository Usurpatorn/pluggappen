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
const run = (...args) => { const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/content.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, FAMILY_CODE: FAM, FIREBASE_PROJECT: 'demo-pluggappen' } }); const txt = r.stdout + r.stderr; last = `kod ${r.status}: ${txt.trim().replace(/\s+/g, ' ')}`; if (txt.includes(FAM) || txt.includes(MARK)) { fails++; out.push('FAIL utskriften innehåller familjekoden eller innehållet: ' + args[0]); } return { code: r.status, txt: txt.trim() }; };
let last = ''; const check = (name, cond, extra = '') => { if (!cond) extra = (extra ? extra + ' – ' : '') + last.slice(0, 160); out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' – ' + extra : ''}`); if (!cond) fails++; };
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
// 3.5 privata bilder: validera → ladda upp oföränderliga revisioner → kontrollera → publicera villkorat → läs tillbaka. Syntetiska "bilder"
// (giltiga minimala PNG-huvuden, inga riktiga bilder). Visar: publicering vägras när en bild saknas (inget aktivt innehåll pekar på en
// saknad bild), uppladdningen kan köras om, en manipulerad fil stoppas, rollback hittar sina gamla bilder, och loggen läcker inget.
{
  const { createHash } = await import('node:crypto'); const zlib = await import('node:zlib');
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const png = (w, h, v) => { const i = Buffer.alloc(13); i.writeUInt32BE(w, 0); i.writeUInt32BE(h, 4); i[8] = 8; i[9] = 0; const raw = Buffer.alloc((w + 1) * h, v); for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0; return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', i), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); };
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  const mk = (tag, imgs) => { const assets = imgs.map(([id, b]) => ({ id: 'syn/' + id, rev: sha(b), mime: 'image/png', w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length }));
    fs.writeFileSync(f(tag + '.json'), JSON.stringify({ v: 1, updatedAt: Date.now(), packs: [], work: [{ id: tag, kid: 'k1', type: 'exam', title: 'syntetiskt ' + MARK, date: '2030-01-01' }], assets }));
    fs.writeFileSync(f(tag + '.assets.json'), JSON.stringify({ v: 1, assets: imgs.map(([, b]) => ({ rev: sha(b), mime: 'image/png', w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length, b64: b.toString('base64') })) })); };
  const P1 = png(4, 3, 10), P2 = png(5, 5, 200), P3 = png(3, 7, 90);
  mk('i1', [['ring', P1], ['torn', P2]]); mk('i2', [['ring', P1], ['stig', P3]]);
  r = run('fetch', f('ib0.json')); const ib0 = ut(f('ib0.json'));
  r = run('publish', f('i1.json'), '--expect', ib0.updateTime || 'none'); check('bilder: publicering vägras när innehållet hänvisar till bilder som inte finns', r.code === 4);
  r = run('fetch', f('ib0b.json')); check('…och ingenting skrevs', ut(f('ib0b.json')).updateTime === ib0.updateTime);
  const badUp = JSON.parse(fs.readFileSync(f('i1.assets.json'), 'utf8')); badUp.assets[0].b64 = P3.toString('base64'); fs.writeFileSync(f('bad.assets.json'), JSON.stringify(badUp));
  r = run('assets', f('bad.assets.json')); check('bilder: en fil vars innehåll inte stämmer med sin revision laddas aldrig upp', r.code === 1);
  r = run('assets', f('i1.assets.json')); check('bilder: två nya oföränderliga revisioner', r.code === 0 && /2 nya revisioner, 0 fanns redan/.test(r.txt), r.txt);
  r = run('assets', f('i1.assets.json')); check('bilder: uppladdningen kan köras om (inget skrivs över)', r.code === 0 && /0 nya revisioner, 2 fanns redan/.test(r.txt), r.txt);
  r = run('verify-assets', f('i1.json')); check('bilder: återlästa och kontrollerade', r.code === 0 && /kontrollerade: 2/.test(r.txt), r.txt);
  r = run('verify-assets', f('i2.json')); check('bilder: verify-assets upptäcker en saknad bild', r.code === 1);
  r = run('publish', f('i1.json'), '--expect', ib0.updateTime || 'none'); check('bilder: publicering när alla bilder finns', r.code === 0 && /bilder: 2 kontrollerade/.test(r.txt), r.txt);
  r = run('verify', f('i1.json')); check('bilder: innehållet återläst', r.code === 0);
  r = run('fetch', f('ib1.json')); const ib1 = ut(f('ib1.json'));
  r = run('assets', f('i2.assets.json')); check('bilder: nästa version laddar bara upp det nya', r.code === 0 && /1 nya revisioner, 1 fanns redan/.test(r.txt), r.txt);
  r = run('publish', f('i2.json'), '--expect', ib1.updateTime); check('bilder: andra versionen publicerad', r.code === 0, r.txt);
  r = run('fetch', f('ib2.json')); r = run('restore', f('ib1.json'), '--expect', ut(f('ib2.json')).updateTime); check('bilder: rollback till första versionen – dess bilder finns kvar (raderas aldrig)', r.code === 0 && /bilder: 2 kontrollerade/.test(r.txt), r.txt);
  r = run('verify-assets', f('i1.json')); check('bilder: efter rollback är alla bilder hela', r.code === 0);
}
fs.rmSync(dir, { recursive: true, force: true });
const head = `Nyckelfri publicering i emulatorn: ${out.filter(x => x.startsWith('ok')).length} av ${out.length} som förväntat`;
console.log(head); for (const x of out) console.log('  ' + x);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${head}\n\n${out.map(x => '- ' + x).join('\n')}\n\n`);
if (process.env.GITHUB_ACTIONS) console.log(`::${fails ? 'error' : 'notice'} title=Nyckelfri publicering::${head}${fails ? ' | ' + out.filter(x => x.startsWith('FAIL')).join(' | ').slice(0, 900) : ''}`);
process.exit(fails ? 1 : 0);
