#!/usr/bin/env node
/* Innehållsverktyg för Concept Packs och skoluppgifter (2.1). Används av Claude i innehållsflödet (docs/CONTENT_WORKFLOW.md).
   node scripts/content.mjs check [mapp]          – kör kvalitetsgrinden (inbyggda paket om ingen mapp anges)
   node scripts/content.mjs lock                  – för in nya koncept-id:n i content/ids.lock.json (id:n tas aldrig bort)
   node scripts/content.mjs stats [mapp]          – kunskapspunkter, fakta och olika frågor per paket
   node scripts/content.mjs bundle <mapp> <ut>    – bygg familjens privata innehåll (_content) av <mapp>/packs/*.json + <mapp>/work.json
   node scripts/content.mjs deploy <ut.json>      – ladda upp _content till familjens lagring (kräver FAMILY_CODE + FIREBASE_SERVICE_ACCOUNT)
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
  const errs = packs.flatMap(p => PACKS.validate(p, { private: true })); if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tests/test_packs.js'), '--dir', path.join(a1, 'packs')], { stdio: 'inherit' }); if (r.status) process.exit(r.status);
  const out = { v: 1, updatedAt: Date.now(), packs, work }; fs.writeFileSync(a2, JSON.stringify(out)); console.log(`skrev ${a2}: ${packs.length} paket, ${work.length} skoluppgifter, ${JSON.stringify(out).length} byte`);
}
else if (cmd === 'deploy') {
  const fam = (process.env.FAMILY_CODE || '').trim(); const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim(); const proj = process.env.FIREBASE_PROJECT || 'pluggappen';
  if (!fam || !raw || !a1) { console.error('deploy kräver <ut.json> samt FAMILY_CODE och FIREBASE_SERVICE_ACCOUNT i miljön (skrivs aldrig ut)'); process.exit(2); }
  const body = fs.readFileSync(a1, 'utf8'); const parsed = JSON.parse(body); if (parsed.v !== 1) { console.error('fel format'); process.exit(1); }
  if (body.length > 850000) { console.error('för stort för ett dokument'); process.exit(1); }
  const sa = JSON.parse(raw); const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url'); const iat = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 });
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${unsigned}.${sig}` });
  if (!tr.ok) { console.error('kunde inte autentisera: HTTP ' + tr.status); process.exit(1); } const token = (await tr.json()).access_token;
  const url = `https://firestore.googleapis.com/v1/projects/${proj}/databases/(default)/documents/families/${encodeURIComponent(fam)}/profiles/_content`;
  const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ fields: { json: { stringValue: body }, updatedAt: { integerValue: String(parsed.updatedAt) }, kid: { stringValue: 'content' } } }) });
  console.log(r.ok ? 'uppladdat till familjens lagring (_content)' : 'uppladdningen misslyckades: HTTP ' + r.status); process.exit(r.ok ? 0 : 1);
}
else { console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('\n').slice(1, 9).join('\n')); }
