#!/usr/bin/env node
/* Innehållsverktyg för Concept Packs och skoluppgifter (2.1). Används av Claude i innehållsflödet (docs/CONTENT_WORKFLOW.md).
   node scripts/content.mjs check [mapp]          – kör kvalitetsgrinden (inbyggda paket om ingen mapp anges)
   node scripts/content.mjs lock                  – för in nya koncept-id:n i content/ids.lock.json (id:n tas aldrig bort)
   node scripts/content.mjs stats [mapp]          – kunskapspunkter, fakta och olika frågor per paket
   node scripts/content.mjs bundle <mapp> <ut>    – bygg familjens privata innehåll (_content) av <mapp>/packs/*.json + <mapp>/work.json
   node scripts/content.mjs deploy <ut.json>      – ladda upp _content till familjens lagring (kräver FAMILY_CODE + FIREBASE_SERVICE_ACCOUNT)
   node scripts/content.mjs fetch|publish|verify|restore … – nyckelfri publicering från det privata innehållsrepot (se docs/CONTENT_PUBLISHING.md)
   Familjens innehåll läggs ALDRIG i det publika repot. */
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { spawnSync } from 'node:child_process'; import { createSign } from 'node:crypto';
const require = createRequire(import.meta.url); const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
global.LECAT = require(path.join(ROOT, 'src/05a_concepts.js')); const PACKS = require(path.join(ROOT, 'src/05d_packs.js'));
const [cmd, a1, a2] = process.argv.slice(2);
const readPacks = (dir) => fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const PUB = path.join(ROOT, 'content', 'packs');
if (cmd === 'check') { const r = spawnSync(process.execPath, [path.join(ROOT, 'tests/test_packs.js'), ...(a1 ? ['--dir', a1] : [])], { stdio: 'inherit' }); process.exit(r.status); }
else if (cmd === 'lock') {
  const file = path.join(ROOT, 'content', 'ids.lock.json'); const lock = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { note: '', concepts: [] };
  const ids = readPacks(PUB).flatMap(p => p.kps.map(k => PACKS.cidOf(p.id, k.id))); const add = ids.filter(id => !lock.concepts.includes(id));
  lock.note = 'Alla koncept-id:n som någon gång har släppts. Tas aldrig bort – barnens bevis hänger på dem. Pensionera i paketets "retired" i stället.';
  lock.concepts = [...lock.concepts, ...add].sort(); fs.writeFileSync(file, JSON.stringify(lock, null, 1) + '\n'); console.log(`${add.length} nya id:n, ${lock.concepts.length} totalt`);
}
else if (cmd === 'stats') {
  for (const p of readPacks(a1 || PUB)) { PACKS.register(p, { private: !!a1 }); let q = 0; for (const k of p.kps) for (const pol of p.policies) q += PACKS.variants(PACKS.cidOf(p.id, k.id), pol).length; console.log(`${p.id.padEnd(28)} ${String(p.kps.length).padStart(3)} punkter ${String(p.kps.reduce((a, k) => a + k.facts.length, 0)).padStart(4)} fakta ${String(q).padStart(5)} varianter`); }
}
else if (cmd === 'bundle') {
  if (!a1 || !a2) { console.error('användning: bundle <mapp> <ut.json>'); process.exit(2); }
  const packs = fs.existsSync(path.join(a1, 'packs')) ? readPacks(path.join(a1, 'packs')) : []; const work = fs.existsSync(path.join(a1, 'work.json')) ? JSON.parse(fs.readFileSync(path.join(a1, 'work.json'), 'utf8')) : [];
  const pubIds = new Set(readPacks(PUB).map(p => p.id)); const errs = [...packs.flatMap(p => PACKS.validate(p, { private: true })), ...packs.filter(p => pubIds.has(p.id)).map(p => `${p.id}: ett privat paket får inte ha ett inbyggt pakets id`)]; if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  if (packs.length) { const r = spawnSync(process.execPath, [path.join(ROOT, 'tests/test_packs.js'), '--dir', path.join(a1, 'packs')], { stdio: 'inherit' }); if (r.status) process.exit(r.status); }
  // Skoluppgifterna: samma regler som appen (FAMILY.cleanContent) + att varje kunskapspunkt finns i ett inbyggt eller ett av familjens paket
  // Privat termlista (namn m.m., gitignorerad / secret PRIVACY_TERMS) – samma som integritetstestet. Finns den inte: ingen namnkontroll.
  let PRIV = []; try { PRIV = JSON.parse(process.env.PRIVACY_TERMS || fs.readFileSync(path.join(ROOT, 'tests/privacy_terms.local.json'), 'utf8')).map(x => String(x).toLowerCase()).filter(x => x.length >= 3); } catch (e) { /* ingen lista */ }
  const known = new Set([...readPacks(PUB), ...packs].flatMap(p => p.kps.map(k => PACKS.cidOf(p.id, k.id)))); const werr = [];
  const TYPES = ['exam', 'homework', 'vocab', 'practice']; const ids = new Set();
  for (const w of Array.isArray(work) ? work : [null]) {
    if (!w || typeof w !== 'object') { werr.push('work.json måste vara en lista med skoluppgifter'); continue; }
    const at = `skoluppgift ${w.id}`; if (!/^[A-Za-z0-9_-]{2,40}$/.test(w.id || '') || ids.has(w.id)) werr.push(`${at}: id saknas, har fel form eller är dubblerat`); ids.add(w.id);
    if (!w.kid || !w.title) werr.push(`${at}: kid och title krävs`); if (!TYPES.includes(w.type)) werr.push(`${at}: type måste vara ${TYPES.join('/')}`);
    if (w.date && !/^\d{4}-\d{2}-\d{2}$/.test(w.date)) werr.push(`${at}: date måste vara ÅÅÅÅ-MM-DD`); if (w.type !== 'practice' && !w.date) werr.push(`${at}: ${w.type} behöver ett datum`);
    for (const k of w.kps || []) if (!known.has(k)) werr.push(`${at}: okänd kunskapspunkt ${k}`);
    for (const t of w.teacherQs || []) {
      if (!t.n || !t.q) werr.push(`${at}: lärarfråga behöver n och q`); if (!(t.kps || []).length) werr.push(`${at} fråga ${t.n}: kps saknas (vilka kunskapspunkter prövar frågan?)`);
      for (const k of t.kps || []) if (!known.has(k)) werr.push(`${at} fråga ${t.n}: okänd kunskapspunkt ${k}`);
      if (t.a && !t.typed && (t.not || []).length < 2) werr.push(`${at} fråga ${t.n}: flerval behöver minst två felaktiga alternativ i not (eller typed: true för kort eget svar)`);
      if (t.typed && String(t.a || '').trim().split(/\s+/).length > 3) werr.push(`${at} fråga ${t.n}: eget svar får vara högst tre ord`);
    }
    const txt = JSON.stringify({ ...w, kid: '' }).toLowerCase(); for (const term of PRIV) if (txt.includes(term)) werr.push(`${at}: innehåller ett namn från den privata termlistan – ta bort det (källhänvisningar utan personnamn)`);
  }
  if (werr.length) { console.error(werr.join('\n')); process.exit(1); }
  const gradeable = work.flatMap(w => w.teacherQs || []).filter(t => t.a && (t.typed || (t.not || []).length >= 2)).length;
  console.log(`skoluppgifter OK: ${work.length} st, ${work.flatMap(w => w.teacherQs || []).length} lärarfrågor (${gradeable} används i Testa mig)`);
  const out = { v: 1, updatedAt: Date.now(), packs, work }; fs.writeFileSync(a2, JSON.stringify(out)); console.log(`skrev ${a2}: ${packs.length} paket, ${work.length} skoluppgifter, ${JSON.stringify(out).length} byte`);
}
/* ---------- Publicering (familjens privata lagring, _content) ----------
   Inloggning: helst ett kortlivat access-token från Workload Identity Federation (GOOGLE_OAUTH_ACCESS_TOKEN, sätts av
   google-github-actions/auth i det privata innehållsrepots workflow – ingen nyckelfil finns). Reserv: FIREBASE_SERVICE_ACCOUNT (nyckelfil).
   Utskrifter innehåller aldrig innehållet, familjekoden eller token – bara storlek, kontrollsumma och tidsstämplar.
   fetch <ut.json>                         – läs nuvarande _content (backup/återläsning): { exists, updateTime, sha256, bytes, json }
   publish <bundle.json> --expect <t|none>  – skriv, bara om dokumentet fortfarande har updateTime t (eller inte finns: none)
   verify <bundle.json>                    – läs tillbaka och jämför kontrollsumman med filen
   restore <backup.json> --expect <t>      – skriv tillbaka en backup (rollback) med samma konfliktskydd
   deploy <bundle.json>                    – som tidigare (utan konfliktskydd); behålls för föräldrens lokala reservväg */
else if (['deploy', 'fetch', 'publish', 'verify', 'restore'].includes(cmd)) {
  const { createHash } = await import('node:crypto');
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const fam = (process.env.FAMILY_CODE || '').trim(); const proj = process.env.FIREBASE_PROJECT || 'pluggappen';
  const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
  if (!fam || !a1) { console.error(`${cmd} kräver en fil samt FAMILY_CODE i miljön (skrivs aldrig ut)`); process.exit(2); }
  async function token() {
    const t = (process.env.GOOGLE_OAUTH_ACCESS_TOKEN || '').trim(); if (t) return t;
    const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim(); if (!raw) { console.error('ingen inloggning: GOOGLE_OAUTH_ACCESS_TOKEN (WIF) eller FIREBASE_SERVICE_ACCOUNT saknas'); process.exit(2); }
    const sa = JSON.parse(raw); const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url'); const iat = Math.floor(Date.now() / 1000);
    const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 });
    const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
    const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${sig}` });
    if (!tr.ok) { console.error('kunde inte autentisera: HTTP ' + tr.status); process.exit(1); } return (await tr.json()).access_token;
  }
  // FIRESTORE_EMULATOR_HOST: Googles Firestore-emulator (CI-testet tests/rules/publish.test.mjs) – då används emulatorns administratörsinloggning
  const emu = (process.env.FIRESTORE_EMULATOR_HOST || '').trim();
  const url = `${emu ? 'http://' + emu : 'https://firestore.googleapis.com'}/v1/projects/${proj}/databases/(default)/documents/families/${encodeURIComponent(fam)}/profiles/_content`;
  const auth = { Authorization: 'Bearer ' + (emu ? 'owner' : await token()) };
  const readDoc = async () => { const r = await fetch(url, { headers: auth }); if (r.status === 404) return { exists: false }; if (!r.ok) { console.error('läsning misslyckades: HTTP ' + r.status); process.exit(1); } const d = await r.json(); const json = (d.fields && d.fields.json && d.fields.json.stringValue) || ''; return { exists: true, updateTime: d.updateTime, json, sha256: sha(json), bytes: json.length }; };
  const checkBody = (body) => { let parsed; try { parsed = JSON.parse(body); } catch (e) { console.error('filen är inte giltig JSON'); process.exit(1); } if (parsed.v !== 1 || !Array.isArray(parsed.packs) || !Array.isArray(parsed.work)) { console.error('fel format (v: 1, packs, work)'); process.exit(1); } if (body.length > 850000) { console.error('för stort för ett dokument'); process.exit(1); } return parsed; };
  async function write(body, expect) {
    const parsed = checkBody(body);
    const pre = expect === 'none' ? 'currentDocument.exists=false' : expect ? `currentDocument.updateTime=${encodeURIComponent(expect)}` : '';
    const mask = ['json', 'updatedAt', 'kid'].map(f => `updateMask.fieldPaths=${f}`).join('&');
    const r = await fetch(`${url}?${mask}${pre ? '&' + pre : ''}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ fields: { json: { stringValue: body }, updatedAt: { integerValue: String(parsed.updatedAt || Date.now()) }, kid: { stringValue: 'content' } } }) });
    if (r.status === 400 || r.status === 409 || r.status === 412) { console.error(`stoppat: dokumentet har ändrats sedan backupen (HTTP ${r.status}) – inget skrevs. Kör om publiceringen.`); process.exit(3); }
    if (!r.ok) { console.error('skrivningen misslyckades: HTTP ' + r.status); process.exit(1); }
    const d = await r.json(); console.log(`skrivet: ${body.length} byte, sha256 ${sha(body).slice(0, 16)}, updateTime ${d.updateTime}`);
  }
  if (cmd === 'fetch') { const cur = await readDoc(); fs.writeFileSync(a1, JSON.stringify({ ...cur, project: proj, fetchedAt: new Date().toISOString() })); console.log(cur.exists ? `backup: ${cur.bytes} byte, sha256 ${cur.sha256.slice(0, 16)}, updateTime ${cur.updateTime}` : 'backup: inget _content-dokument ännu'); }
  else if (cmd === 'publish' || cmd === 'deploy') { const expect = cmd === 'deploy' ? null : arg('--expect'); if (cmd === 'publish' && !expect) { console.error('publish kräver --expect <updateTime|none> (från fetch) – skyddar mot att skriva över en ändring som kommit emellan'); process.exit(2); } await write(fs.readFileSync(a1, 'utf8'), expect); }
  else if (cmd === 'verify') { const body = fs.readFileSync(a1, 'utf8'); const cur = await readDoc(); const ok = cur.exists && cur.sha256 === sha(body); console.log(ok ? `återläst och identiskt: sha256 ${cur.sha256.slice(0, 16)}, ${cur.bytes} byte` : `AVVIKELSE: lagrat ${cur.exists ? cur.sha256.slice(0, 16) : 'saknas'} ≠ fil ${sha(body).slice(0, 16)}`); if (ok) checkBody(cur.json); process.exit(ok ? 0 : 1); }
  else if (cmd === 'restore') {
    const bk = JSON.parse(fs.readFileSync(a1, 'utf8')); const expect = arg('--expect'); if (!expect) { console.error('restore kräver --expect <updateTime> (från fetch)'); process.exit(2); }
    if (!bk.exists) { console.error('backupen säger att inget dokument fanns – återställning skulle betyda radering; gör det i stället med en tom publicering ({ v: 1, packs: [], work: [] })'); process.exit(2); }
    if (sha(bk.json) !== bk.sha256) { console.error('backupen är skadad (kontrollsumman stämmer inte)'); process.exit(1); }
    await write(bk.json, expect);
  }
}
else { console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').slice(1, 9).join('\n')); }
