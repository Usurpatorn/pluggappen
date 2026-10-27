// Membership / access-control test: simulates Identity Toolkit + a Firestore that enforces firestore.rules semantics.
const { JSDOM } = require('jsdom'); const fs = require('fs'); const { withCommit } = require('./le/fscommit.js');
const html = fs.readFileSync(__dirname + '/../dist/index.html', 'utf8').replace(/<script src=[^>]+><\/script>/, '');
const FIX = require('./test_fixture_family.json');

// ---------- fake backend ----------
const cloud = {}; // docPath -> {fields}
let uidCounter = 0; const tokens = {}; // token -> uid
let grace = true; // legacy window open?
const fieldStr = (doc, k) => doc && doc.fields && doc.fields[k] && (doc.fields[k].stringValue ?? doc.fields[k].integerValue);
function authOf(opts) { const h = (opts.headers || {}).Authorization; if (!h) return null; return tokens[h.replace('Bearer ', '')] || null; }
function rules(method, path, uid, body) {
  const [, fam, coll, id] = path.match(/^families\/([^/]+)\/([^/]+)\/?([^/?]*)/) || [];
  if (!fam) return 400;
  const isMember = !!(uid && cloud[`families/${fam}/members/${uid}`]);
  const isParent = isMember && fieldStr(cloud[`families/${fam}/members/${uid}`], 'role') === 'parent';
  const legacy = grace && fam.length >= 6;
  const infoExists = !!cloud[`families/${fam}/meta/info`];
  if (coll === 'meta' && id === 'info') {
    if (method === 'GET') return isMember ? 200 : 403;
    if (method === 'PATCH') { const keysOk = Object.keys(body.fields).every(k => ['joinCode', 'createdAt', 'rotatedAt'].includes(k)); if (!keysOk) return 403; return infoExists ? (isMember ? 200 : 403) : (uid ? 200 : 403); }
    if (method === 'DELETE') return isParent ? 200 : 403;
  }
  if (coll === 'members') {
    if (method === 'GET') return isMember ? 200 : 403;
    if (method === 'PATCH') { const exists = !!cloud[path.split('?')[0]]; if (!exists) { if (!uid || id !== uid || !infoExists) return 403; const code = fieldStr(body, 'code'); return code === fieldStr(cloud[`families/${fam}/meta/info`], 'joinCode') ? 200 : 403; } return isMember && (id === uid || isParent) ? 200 : 403; }
    if (method === 'DELETE') return isMember && (id === uid || isParent) ? 200 : 403;
  }
  if (coll === 'profiles') {
    if (method === 'GET') return isMember || (legacy && id !== '_content') ? 200 : 403;   // _content: aldrig via övergångsvägen
    if (method === 'PATCH') { const ok = Object.keys(body.fields).every(k => ['json', 'updatedAt', 'kid'].includes(k)); return id !== '_content' && (isMember || legacy) && ok ? 200 : 403; }   // _content: bara servicekontot
    if (method === 'DELETE') return isParent ? 200 : 403;
  }
  return 403;
}
let writeClock = 0;
const mkFetch = (log) => async (url, opts = {}) => {
  log.push((opts.method || 'GET') + ' ' + url.split('/v1/')[1].split('?')[0]);
  if (url.includes('identitytoolkit')) { const uid = 'uid' + (++uidCounter); const tok = 'tok_' + uid; tokens[tok] = uid; return { ok: true, status: 200, json: async () => ({ localId: uid, idToken: tok, refreshToken: 'ref_' + uid, expiresIn: '3600' }) }; }
  if (url.includes('securetoken')) { const uid = JSON.parse(opts.body).refresh_token.replace('ref_', ''); const tok = 'tok_' + uid; tokens[tok] = uid; return { ok: true, status: 200, json: async () => ({ user_id: uid, id_token: tok, refresh_token: 'ref_' + uid, expires_in: '3600' }) }; }
  const path = url.split('/documents/')[1].split('?')[0]; const uid = authOf(opts); const method = opts.method || 'GET';
  const body = opts.body ? JSON.parse(opts.body) : null;
  // collection list
  if (method === 'GET' && /\/(profiles|members)$/.test(path)) { const st = rules('GET', path + '/x', uid); if (st !== 200) return { ok: false, status: st }; const docs = Object.entries(cloud).filter(([k]) => k.startsWith(path + '/')).map(([k, v]) => ({ name: 'projects/p/databases/(default)/documents/' + k, ...v })); return { ok: true, status: 200, json: async () => ({ documents: docs }) }; }
  const st = rules(method, path, uid, body); if (st !== 200) return { ok: false, status: st, json: async () => ({}) };
  if (method === 'GET') { if (!cloud[path]) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => cloud[path] }; }
  if (method === 'DELETE') { delete cloud[path]; return { ok: true, status: 200, json: async () => ({}) }; }
  // som Firestore: villkorade skrivningar (currentDocument.*) och updateTime på varje skrivning (3.2.1: appen skriver alltid villkorat)
  const qs = new URL(url).searchParams; const ut = qs.get('currentDocument.updateTime'), ex = qs.get('currentDocument.exists');
  if ((ut !== null && (!cloud[path] || cloud[path].updateTime !== ut)) || (ex === 'false' && cloud[path]) || (ex === 'true' && !cloud[path])) return { ok: false, status: 400, json: async () => ({ error: { status: 'FAILED_PRECONDITION' } }) };
  if (url.includes('updateMask')) { cloud[path] = cloud[path] || { fields: {} }; Object.assign(cloud[path].fields, body.fields); } else cloud[path] = body;
  cloud[path].updateTime = new Date(Date.UTC(2026, 0, 1) + (++writeClock) * 1000).toISOString();
  return { ok: true, status: 200, json: async () => cloud[path] };
};
function device(name, storage) {
  const dom = new JSDOM('<!doctype html>' + html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://plugg.example/' });
  const w = dom.window; w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false }); w.HTMLCanvasElement.prototype.getContext = () => null; w.confirm = () => true; w.prompt = () => null;
  const log = []; w.fetch = withCommit(mkFetch(log)); w.__log = log; w.crypto = w.crypto || {}; if (!w.crypto.getRandomValues) w.crypto.getRandomValues = (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 2 ** 32); return a; };
  if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  for (const sc of [...dom.window.document.querySelectorAll('script')]) if (sc.textContent.trim()) w.eval(sc.textContent);
  w.__name = name; return w;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  // 1. Legacy device A: only has the old family code → bootstraps meta/info and joins as parent (push kid=parent heuristic)
  const legacyDB = JSON.stringify({ profiles: {}, settings: { pin: '1234', goals: {}, sound: true, family: 'legacy-fam-001', push: { id: 'x', kid: 'parent' } } });
  const A = device('A', { 'pluggappen.v1': legacyDB }); await sleep(150);
  check(A.PA.AUTH.member && A.PA.AUTH.member.role === 'parent', 'A joined automatically as parent with legacy code');
  check(fieldStr(cloud['families/legacy-fam-001/meta/info'], 'joinCode') === 'legacy-fam-001', 'bootstrap: joinCode == legacy family code');
  A.PA.FAMILY.apply(FIX); A.PA.load(); await A.PA.FAMILY.push(); A.PA.DB.profiles.k2.xp = 120; A.PA.setKid('k2'); A.PA.save(); await sleep(1800);
  check(!!cloud['families/legacy-fam-001/profiles/k2'], 'A pushed profile with bearer token');
  // 2. Device B pairs with a link "fam.code"
  const B = device('B'); B.location.hash = '#fam-legacy-fam-001.legacy-fam-001'; await sleep(50);
  B.PA.DB.settings.family = 'legacy-fam-001'; B.PA.DB.settings.joinCode = 'legacy-fam-001'; const jb = await B.PA.AUTH.join('legacy-fam-001', 'kid');
  check(jb.ok, 'B joined with correct code: ' + jb.msg); await B.PA.FAMILY.pull(); B.PA.load(); await B.PA.SYNC.refreshAll();
  check(B.PA.KIDS.length === 3 && B.PA.DB.profiles.k2.xp === 120, 'B pulled config and profile as member');
  // 2b. Release-kontroll 2.1: familjens privata innehåll (_content: paket, facit, provdatum) kan inte skrivas av någon appklient –
  //     varken av en barnenhet som är medlem eller av en gammal klient under övergången. Bara servicekontot (utanför reglerna) skriver.
  {
    cloud['families/legacy-fam-001/profiles/_content'] = { fields: { json: { stringValue: '{"v":1,"packs":[],"work":[]}' }, updatedAt: { integerValue: '1' } } };
    const body = JSON.stringify({ fields: { json: { stringValue: '{"v":1,"packs":[],"work":[{"id":"x","kid":"k2","type":"exam","title":"falskt prov"}]}' }, updatedAt: { integerValue: '2' } } });
    const wB = await B.PA.AUTH.fetch(B.PA.AUTH.doc('profiles/_content'), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    check(wB.status === 403, `_content: barnenhet (medlem) får inte skriva (${wB.status})`);
    const rB = await B.PA.AUTH.fetch(B.PA.AUTH.doc('profiles/_content')); check(rB.ok, '_content: medlem får läsa');
    check(rules('PATCH', 'families/legacy-fam-001/profiles/_content', null, JSON.parse(body)) === 403, '_content: gammal klient under övergången får inte skriva');
    check(rules('GET', 'families/legacy-fam-001/profiles/_content', null) === 403 && rules('GET', 'families/legacy-fam-001/profiles/k2', null) === 200, '_content: gammal klient under övergången får inte läsa (vanliga profiler: oförändrat)');
    check(rules('PATCH', 'families/legacy-fam-001/profiles/_content', 'uid1', JSON.parse(body)) === 403, '_content: inte heller enheten som skapade familjen');
    check(rules('PATCH', 'families/legacy-fam-001/profiles/k2', null, { fields: { json: {}, updatedAt: {} } }) === 200, 'vanliga profiler: övergångsvägen oförändrad');
    check(fieldStr(cloud['families/legacy-fam-001/profiles/_content'], 'json').includes('"work":[]'), '_content oförändrat efter försöken');
    delete cloud['families/legacy-fam-001/profiles/_content'];
  }
  // 3. Attacker C: wrong code, and no membership
  grace = false;
  const C = device('C'); C.PA.DB.settings.family = 'legacy-fam-001'; const jc = await C.PA.AUTH.join('wrong-code-999', 'parent');
  check(!jc.ok, 'C with wrong code is refused: ' + jc.msg);
  const rc = await C.PA.AUTH.fetch(C.PA.AUTH.doc('profiles/k2')); check(rc.status === 403, 'C cannot read profiles after grace (403)');
  const rcfg = await C.PA.AUTH.fetch(C.PA.AUTH.doc('profiles/_config')); check(rcfg.status === 403, 'C cannot read family config (403)');
  // 4. Rotate on A; B keeps access; D joins with new code; E with old code fails
  const newCode = await A.PA.AUTH.rotateCode(); check(!!newCode && newCode.length === 19, 'A rotated join code: ' + newCode);
  const rb = await B.PA.AUTH.fetch(B.PA.AUTH.doc('profiles/k2')); check(rb.ok, 'B still has access after rotation');
  const D = device('D'); D.PA.DB.settings.family = 'legacy-fam-001'; const jd = await D.PA.AUTH.join(newCode, 'kid'); check(jd.ok, 'D joins with new code');
  const E = device('E'); E.PA.DB.settings.family = 'legacy-fam-001'; const je = await E.PA.AUTH.join('legacy-fam-001', 'kid'); check(!je.ok, 'E with OLD code is refused after rotation');
  // 5. Parent removes D → D denied
  const members = await A.PA.AUTH.listMembers(); check(members.length === 3, 'member list shows 3 devices (A, B, D)');
  check(await A.PA.AUTH.removeMember(D.PA.AUTH.uid), 'A (parent) removed D');
  const rd = await D.PA.AUTH.fetch(D.PA.AUTH.doc('profiles/k2')); check(rd.status === 403 && D.PA.AUTH.denied, 'D is denied after removal');
  const rbb = await B.PA.AUTH.removeMember(A.PA.AUTH.uid); check(!rbb, 'B (kid) cannot remove the parent device');
  // 6. Delete kid data on A → tombstone → B resets on refresh instead of re-uploading
  B.PA.DB.profiles.k2.xp = 500; B.PA.setKid('k2'); B.PA.save(); await sleep(1800);
  const okDel = await A.PA.deleteKidData('k2'); check(okDel, 'A wrote tombstone for k2');
  await B.PA.SYNC.refresh('k2'); check(B.PA.DB.profiles.k2.xp === 0 && B.PA.DB.profiles.k2.resetAt > 0, 'B reset k2 locally from tombstone (xp 0)');
  B.PA.DB.profiles.k2.xp = 7; B.PA.save(); await sleep(1800); const remote = JSON.parse(fieldStr(cloud['families/legacy-fam-001/profiles/k2'], 'json')); check(remote.resetAt > 0 && remote.xp === 7, 'B continues from reset state and keeps the tombstone marker');
  // 7. Family deletion by parent
  const n = await A.PA.deleteFamilyData(); check(n >= 4 && !cloud['families/legacy-fam-001/meta/info'] && !Object.keys(cloud).some(k => k.includes('/profiles/')), `A deleted family cloud data (${n} docs)`);
  check(A.PA.KIDS.length === 0 && !A.PA.AUTH.member, 'A is unpaired locally after family deletion');
  console.log(fails ? `AUTH TEST FAILED (${fails})` : 'AUTH TEST OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('EXC', e.stack); process.exit(1); });
