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
global.LECAT = require(path.join(ROOT, 'src/05a_concepts.js'));
// 3.5: samma kontroll av bildens upplösning som appen (src/05j_assets.js ASSETS.dims)
global.ASSETS_DIMS = (u, mime) => { if (mime === 'image/png') { if (u.length < 24 || String.fromCharCode(u[12], u[13], u[14], u[15]) !== 'IHDR') return null; const r = (o) => ((u[o] << 24) >>> 0) + (u[o + 1] << 16) + (u[o + 2] << 8) + u[o + 3]; return { w: r(16), h: r(20) }; } if (mime === 'image/jpeg') { let i = 2; while (i + 9 < u.length) { if (u[i] !== 0xff) return null; const m = u[i + 1]; const len = (u[i + 2] << 8) + u[i + 3]; if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { h: (u[i + 5] << 8) + u[i + 6], w: (u[i + 7] << 8) + u[i + 8] }; if (len < 2) return null; i += 2 + len; } return null; } return null; }; const PACKS = require(path.join(ROOT, 'src/05d_packs.js'));
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
    if (w.weight != null && !['major', 'minor'].includes(w.weight)) werr.push(`${at}: weight måste vara major eller minor (eller utelämnas: standard efter type)`);   // 3.4
    for (const t of w.teacherQs || []) {
      if (!t.n || !t.q) werr.push(`${at}: lärarfråga behöver n och q`); if (!(t.kps || []).length) werr.push(`${at} fråga ${t.n}: kps saknas (vilka kunskapspunkter prövar frågan?)`);
      for (const k of t.kps || []) if (!known.has(k)) werr.push(`${at} fråga ${t.n}: okänd kunskapspunkt ${k}`);
      if (t.a && !t.typed && (t.not || []).length < 2) werr.push(`${at} fråga ${t.n}: flerval behöver minst två felaktiga alternativ i not (eller typed: true för kort eget svar)`);
      if (t.typed && String(t.a || '').trim().split(/\s+/).length > 3) werr.push(`${at} fråga ${t.n}: eget svar får vara högst tre ord`);
    }
    // Experience v3: målområden, lärarens betoning och luckor. Ingen påhittad omfattning: målområden och betoning måste ligga inom
    // skoluppgiftens egna moment och kunskapspunkter. Luckor (saknade PDF:er, okänt provformat, ogranskade filmer) ska stå kvar synligt.
    const scopeS = new Set(w.skills || []), scopeK = new Set(w.kps || []);
    for (const g of w.goals || []) { if (!g || !g.id || !g.name) { werr.push(`${at}: målområde behöver id och name`); continue; } if (!(g.skills || []).length && !(g.kps || []).length) werr.push(`${at} målområde ${g.id}: skills eller kps krävs`);
      for (const s of g.skills || []) if (!scopeS.has(s)) werr.push(`${at} målområde ${g.id}: momentet ${s} ingår inte i skoluppgiften`); for (const k of g.kps || []) if (!scopeK.has(k)) werr.push(`${at} målområde ${g.id}: ${k} ingår inte i skoluppgiften`); }
    if (w.focus) { for (const s of w.focus.skills || []) if (!scopeS.has(s)) werr.push(`${at}: betonat moment ${s} ingår inte i skoluppgiften`); for (const k of w.focus.kps || []) if (!scopeK.has(k)) werr.push(`${at}: betonad punkt ${k} ingår inte i skoluppgiften`); }
    for (const m of w.missing || []) if (!m || !m.label) werr.push(`${at}: en lucka (missing) behöver label`);
    const txt = JSON.stringify({ ...w, kid: '' }).toLowerCase(); for (const term of PRIV) if (txt.includes(term)) werr.push(`${at}: innehåller ett namn från den privata termlistan – ta bort det (källhänvisningar utan personnamn)`);
  }
  if (werr.length) { console.error(werr.join('\n')); process.exit(1); }
  const gradeable = work.flatMap(w => w.teacherQs || []).filter(t => t.a && (t.typed || (t.not || []).length >= 2)).length;
  console.log(`skoluppgifter OK: ${work.length} st, ${work.flatMap(w => w.teacherQs || []).length} lärarfrågor (${gradeable} används i Testa mig)`);
  // 3.5 privata bilder: <mapp>/assets/<paket>/manifest.json (+ bildfilerna) och <mapp>/visual/<paket>.visual.json. Bilderna kontrolleras
  // (typ ur filens första byte, storlek, upplösning ur bildens huvud, sha256 = manifestets) och får ursprung. Bilduppgifterna kontrolleras
  // med appens egen regel (PACKS.visualErrors). Bilderna hamnar INTE i _content – bara manifestet (id → revision). Själva bilderna skrivs
  // till <ut>.assets.json för uppladdning med `assets` (oföränderliga revisioner).
  const { createHash } = await import('node:crypto'); const assets = [], upload = [], verr = [];
  for (const pk of packs) {
    const vf = path.join(a1, 'visual', pk.id + '.visual.json'), mf = path.join(a1, 'assets', pk.id, 'manifest.json'); if (!fs.existsSync(vf)) { if (pk.visual != null || pk.visualRules != null) verr.push(`${pk.id}: bilduppgifter får bara komma från visual/${pk.id}.visual.json (där de kontrolleras)`); continue; }
    if (!fs.existsSync(mf)) { verr.push(`${pk.id}: bilduppgifter utan bildmanifest`); continue; }
    const man = JSON.parse(fs.readFileSync(mf, 'utf8')); const vis = JSON.parse(fs.readFileSync(vf, 'utf8'));
    if (!man.source || !man.license) verr.push(`${pk.id}: manifestet behöver source och license (ursprung och rätt att använda)`);
    const have = new Set(); if ((man.assets || []).length > 200) verr.push(`${pk.id}: högst 200 bilder per paket`); const seenId = new Set();
    for (const a of man.assets || []) {
      if (seenId.has(a && a.id)) { verr.push(`${pk.id}/${a && a.id}: id dubblerat i manifestet`); continue; } seenId.add(a && a.id);
      const at = `${pk.id}/${a.id}`; if (!/^[a-z0-9-]{1,48}$/.test(a.id || '')) { verr.push(`${at}: id har fel form`); continue; }
      const file = path.join(a1, 'assets', pk.id, a.file || ''); if (!a.file || !fs.existsSync(file) || path.dirname(path.resolve(file)) !== path.resolve(a1, 'assets', pk.id)) { verr.push(`${at}: filen saknas`); continue; }
      if (fs.lstatSync(file).isSymbolicLink()) { verr.push(`${at}: symboliska länkar godtas inte`); continue; }
      const buf = fs.readFileSync(file); const mime = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'image/png' : buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? 'image/jpeg' : null;
      if (!mime) { verr.push(`${at}: bara PNG och JPEG stöds (filens första byte)`); continue; }
      if (buf.length > 200000) { verr.push(`${at}: för stor (${buf.length} byte > 200 000)`); continue; }
      const u = new Uint8Array(buf); const d = global.ASSETS_DIMS(u, mime); if (!d || d.w < 1 || d.h < 1 || d.w > 1024 || d.h > 1024) { verr.push(`${at}: ogiltig eller för stor upplösning`); continue; }
      const rev = createHash('sha256').update(buf).digest('hex'); if (a.sha256 && a.sha256 !== rev) { verr.push(`${at}: kontrollsumman stämmer inte med manifestet`); continue; }
      if (!a.source && !man.source) verr.push(`${at}: ursprung (source) saknas`);
      have.add(at); assets.push({ id: at, rev, mime, w: d.w, h: d.h, bytes: buf.length }); if (!upload.some(x => x.rev === rev)) upload.push({ rev, mime, w: d.w, h: d.h, bytes: buf.length, b64: buf.toString('base64') });
    }
    const KEEP = ['id', 'form', 'kp', 'kps', 'prompt', 'image', 'options', 'answer', 'accept', 'pairs', 'bins', 'cards', 'why', 'variant'];
    pk.visual = (vis.items || []).map(it => Object.fromEntries(Object.entries(it).filter(([k]) => KEEP.includes(k)))).map(it => (it.form === 'sort' && Array.isArray(it.cards) && it.answer && typeof it.answer === 'object' ? (({ answer, ...rest }) => ({ ...rest, cards: it.cards.map(c => ({ image: c && c.image, bin: answer[c && c.image] })) }))(it) : it));   // sortering: gruppen på kortet (tvätten behåller inte nycklar med bindestreck)
    if (Array.isArray(vis.neverTogether)) pk.visualRules = { neverTogether: vis.neverTogether.filter(x => Array.isArray(x) && x.length === 2) };
    const ids = new Set(); for (const it of pk.visual) { const e = PACKS.visualErrors(pk, it, { assets: have }); if (ids.has(it.id)) e.push('id dubblerat'); ids.add(it.id); for (const x of e) verr.push(`${pk.id} bilduppgift ${it.id}: ${x}`); }
    const vtxt = JSON.stringify(pk.visual).toLowerCase(); for (const term of PRIV) if (vtxt.includes(term)) verr.push(`${pk.id}: bilduppgifterna innehåller ett namn från den privata termlistan`);
  }
  if (verr.length) { console.error(verr.join('\n')); process.exit(1); }
  const out = { v: 1, updatedAt: Date.now(), packs, work, ...(assets.length ? { assets } : {}) }; fs.writeFileSync(a2, JSON.stringify(out)); console.log(`skrev ${a2}: ${packs.length} paket, ${work.length} skoluppgifter, ${assets.length} bilder, ${JSON.stringify(out).length} byte`);
  if (upload.length) { const af = a2.replace(/\.json$/, '') + '.assets.json'; fs.writeFileSync(af, JSON.stringify({ v: 1, assets: upload })); console.log(`skrev ${af}: ${upload.length} bildrevisioner (laddas upp med \`assets\`, aldrig till det publika repot)`); }
}
/* ---------- Publicering (familjens privata lagring, _content) ----------
   Inloggning: helst ett kortlivat access-token från Workload Identity Federation (GOOGLE_OAUTH_ACCESS_TOKEN, sätts av
   google-github-actions/auth i det privata innehållsrepots workflow – ingen nyckelfil finns). Reserv: FIREBASE_SERVICE_ACCOUNT (nyckelfil).
   Utskrifter innehåller aldrig innehållet, familjekoden eller token – bara storlek, kontrollsumma och tidsstämplar.
   fetch <ut.json>                         – läs nuvarande _content (backup/återläsning): { exists, updateTime, sha256, bytes, json }
   publish <bundle.json> --expect <t|none>  – skriv, bara om dokumentet fortfarande har updateTime t (eller inte finns: none)
   verify <bundle.json>                    – läs tillbaka och jämför kontrollsumman med filen
   restore <backup.json> --expect <t>      – skriv tillbaka en backup (rollback) med samma konfliktskydd
   deploy <bundle.json>                    – som tidigare (utan konfliktskydd); behålls för föräldrens lokala reservväg
   3.5 privata bilder (ordning: fetch → assets → verify-assets → publish --expect → verify):
   assets <bundle.assets.json>             – ladda upp bildrevisionerna (families/{f}/assets/{sha256}); bara skapande, aldrig överskrivning;
                                             en revision som redan finns kontrolleras och hoppas över (kan köras om)
   verify-assets <bundle.json>             – läs tillbaka varje bild som innehållet hänvisar till och kontrollera den
   publish/restore vägrar om någon bild som innehållet hänvisar till saknas i lagringen (inget aktivt innehåll pekar på en saknad bild).
   Bilder raderas aldrig av verktygen: en rollback kan behöva äldre revisioner (se docs/CONTENT_PUBLISHING.md om rensning). */
else if (['deploy', 'fetch', 'publish', 'verify', 'restore', 'assets', 'verify-assets'].includes(cmd)) {
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
  // 3.5: bildrevisioner
  const famBase = url.slice(0, url.indexOf('/profiles/_content')); const assetUrl = (rev) => `${famBase}/assets/${rev}`;
  const readAsset = async (rev) => { const r = await fetch(assetUrl(rev), { headers: auth }); if (r.status === 404) return null; if (!r.ok) { console.error('läsning av bild misslyckades: HTTP ' + r.status); process.exit(1); } const d = await r.json(); const f = d.fields || {}; return { b64: f.b64 && f.b64.stringValue, mime: f.mime && f.mime.stringValue, bytes: Number(f.bytes && f.bytes.integerValue), w: Number(f.w && f.w.integerValue), h: Number(f.h && f.h.integerValue) }; };
  const assetOk = (a, d) => { if (!d || !d.b64) return 'saknas'; const buf = Buffer.from(d.b64, 'base64'); if (buf.length !== a.bytes || d.mime !== a.mime) return 'fel storlek eller typ'; if (sha(buf) !== a.rev) return 'fel kontrollsumma'; const dm = global.ASSETS_DIMS(new Uint8Array(buf), a.mime); if (!dm || dm.w !== a.w || dm.h !== a.h) return 'fel upplösning'; return null; };
  // Före varje publicering/återställning: alla bilder som innehållet hänvisar till måste finnas och vara hela
  const preflight = async (parsed) => { const list = Array.isArray(parsed.assets) ? parsed.assets : []; const bad = []; for (const a of list) { const why = assetOk(a, await readAsset(a.rev)); if (why) bad.push(`${a.id}: ${why}`); } if (bad.length) { console.error(`stoppat: ${bad.length} bild(er) som innehållet hänvisar till saknas eller är skadade i lagringen – kör \`assets\` och \`verify-assets\` först. Inget skrevs.\n` + bad.slice(0, 10).join('\n')); process.exit(4); } return list.length; };
  const readDoc = async () => { const r = await fetch(url, { headers: auth }); if (r.status === 404) return { exists: false }; if (!r.ok) { console.error('läsning misslyckades: HTTP ' + r.status); process.exit(1); } const d = await r.json(); const json = (d.fields && d.fields.json && d.fields.json.stringValue) || ''; return { exists: true, updateTime: d.updateTime, json, sha256: sha(json), bytes: json.length }; };
  const checkBody = (body) => { let parsed; try { parsed = JSON.parse(body); } catch (e) { console.error('filen är inte giltig JSON'); process.exit(1); } if (parsed.v !== 1 || !Array.isArray(parsed.packs) || !Array.isArray(parsed.work)) { console.error('fel format (v: 1, packs, work)'); process.exit(1); } if (body.length > 850000) { console.error('för stort för ett dokument'); process.exit(1); } return parsed; };
  async function write(body, expect) {
    const parsed = checkBody(body);
    const nA = await preflight(parsed); if (nA) console.log(`bilder: ${nA} kontrollerade i lagringen`);
    // Atomär skrivning med förvillkor i JSON-kroppen (documents:commit) – samma i produktion och i emulatorn
    const docName = `projects/${proj}/databases/(default)/documents/families/${fam}/profiles/_content`;
    const base = url.slice(0, url.indexOf('/documents/') + '/documents'.length);
    const write = { update: { name: docName, fields: { json: { stringValue: body }, updatedAt: { integerValue: String(parsed.updatedAt || Date.now()) }, kid: { stringValue: 'content' } } }, updateMask: { fieldPaths: ['json', 'updatedAt', 'kid'] } };
    if (expect === 'none') write.currentDocument = { exists: false }; else if (expect) write.currentDocument = { updateTime: expect };
    const r = await fetch(`${base}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ writes: [write] }) });
    if (r.status === 400 || r.status === 409 || r.status === 412) {
      // Felets typ och meddelande (utan familjekod) – så att ett annat fel än konflikt inte döljs som "ändrat sedan backupen"
      let why = ''; try { const e = (await r.json()).error || {}; why = `${e.status || ''} ${String(e.message || '').split(fam).join('<familj>').split(encodeURIComponent(fam)).join('<familj>').slice(0, 200)}`.trim(); } catch (e) { /* ingen kropp */ }
      const conflict = r.status !== 400 || /FAILED_PRECONDITION|precondition|does not match|already exists|ALREADY_EXISTS/i.test(why);
      console.error(conflict ? `stoppat: dokumentet har ändrats sedan backupen (HTTP ${r.status}${why ? ': ' + why : ''}) – inget skrevs. Kör om publiceringen.` : `skrivningen avvisades (HTTP ${r.status}: ${why}) – inget skrevs`); process.exit(conflict ? 3 : 1); }
    if (!r.ok) { console.error('skrivningen misslyckades: HTTP ' + r.status); process.exit(1); }
    const d = await r.json(); const ut = (d.writeResults && d.writeResults[0] && d.writeResults[0].updateTime) || d.commitTime; console.log(`skrivet: ${body.length} byte, sha256 ${sha(body).slice(0, 16)}, updateTime ${ut}`);
  }
  if (cmd === 'assets') {
    const pack = JSON.parse(fs.readFileSync(a1, 'utf8')); let made = 0, kept = 0;
    for (const a of pack.assets || []) {
      if (!/^[0-9a-f]{64}$/.test(a.rev || '') || sha(Buffer.from(a.b64 || '', 'base64')) !== a.rev) { console.error('en bild i filen stämmer inte med sin kontrollsumma – inget mer laddas upp'); process.exit(1); }
      const cur = await readAsset(a.rev); if (cur) { const why = assetOk(a, cur); if (why) { console.error(`en befintlig revision avviker (${why}) – stoppat, inget skrivs över`); process.exit(1); } kept++; continue; }
      const name = `projects/${proj}/databases/(default)/documents/families/${fam}/assets/${a.rev}`; const base = url.slice(0, url.indexOf('/documents/') + '/documents'.length);
      const w = { update: { name, fields: { b64: { stringValue: a.b64 }, mime: { stringValue: a.mime }, bytes: { integerValue: String(a.bytes) }, w: { integerValue: String(a.w) }, h: { integerValue: String(a.h) }, createdAt: { integerValue: String(Date.now()) } } }, currentDocument: { exists: false } };
      const r = await fetch(`${base}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify({ writes: [w] }) });
      if (!r.ok) { const again = await readAsset(a.rev); if (again && !assetOk(a, again)) { kept++; continue; } console.error('uppladdningen av en bild misslyckades: HTTP ' + r.status); process.exit(1); }
      made++;
    }
    console.log(`bilder: ${made} nya revisioner, ${kept} fanns redan (oförändrade)`);
  }
  else if (cmd === 'verify-assets') { const parsed = checkBody(fs.readFileSync(a1, 'utf8')); const list = Array.isArray(parsed.assets) ? parsed.assets : []; const bad = []; for (const a of list) { const why = assetOk(a, await readAsset(a.rev)); if (why) bad.push(why); } console.log(bad.length ? `AVVIKELSE: ${bad.length} av ${list.length} bilder saknas eller är skadade` : `bilder återlästa och kontrollerade: ${list.length}`); process.exit(bad.length ? 1 : 0); }
  else if (cmd === 'fetch') { const cur = await readDoc(); fs.writeFileSync(a1, JSON.stringify({ ...cur, project: proj, fetchedAt: new Date().toISOString() })); console.log(cur.exists ? `backup: ${cur.bytes} byte, sha256 ${cur.sha256.slice(0, 16)}, updateTime ${cur.updateTime}` : 'backup: inget _content-dokument ännu'); }
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
