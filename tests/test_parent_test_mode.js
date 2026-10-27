/* Testa som barnet (testadressen <sajten>/preview/): föräldern provar appen som ett barn utan att något blir riktig data.
   Riktiga byggen (dist/preview/index.html och den publicerade dist/index.html), en låtsad Firestore som delas av enheterna,
   SYNTETISK familj (testfixturen), fast klocka och fast slump. Varje fall kontrollerar
     · den lagrade datan på testenheten byte för byte (före = efter)
     · familjens data i "Firestore" (före = efter, utom barnets egna samtidiga skrivningar från en annan enhet)
     · att testenheten inte skickar en enda skrivning under testet, och aldrig skriver barnens data utanför testet
   Fallen: Explore (Yngre), Grow (Mellan), Achieve (Äldre) · CORE · rätt och fel · Rescue · Revansch · papper · Testa mig · KLAR ·
   flera FLOW-block · belöningar · prov · annan upplevelse i testet · byta barn · ladda om · stänga och öppna igen · barnet använder
   produktionen samtidigt (Åttan och Tvåan) · avsluta · stänger säkert (vanliga appen, gammal lagring, trasig isolering, utan nät,
   utan föräldraläge) · testadressen utanför testet (spegel, nätverksskydd, inga barnvyer). */
'use strict';
const { withCommit } = require('./le/fscommit.js');
const { execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const { rng, T_FIXED, tools } = require('./le/childflow.js');
const { v2tools } = require('./le/v2driver.js');
const FIX = require('./test_fixture_family.json');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const info = []; const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const ROOT = path.join(__dirname, '..'); const DIST = path.join(ROOT, 'dist');
execFileSync('bash', [path.join(ROOT, 'scripts/build.sh')], { env: { ...process.env, PREVIEW: '1' }, stdio: 'pipe' });
const PV_HTML = fs.readFileSync(path.join(DIST, 'preview/index.html'), 'utf8');
const PROD_HTML = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const PV_URL = 'https://example.org/pluggappen/preview/'; const PROD_URL = 'https://example.org/pluggappen/';
const FAM = 'test-fam-123';

/* ---------- låtsad Firestore (REST som appen använder) ---------- */
function mkCloud() {
  const docs = {}; const log = []; let clock = T_FIXED;
  const fetchFor = (dev) => async (url, opts = {}) => {
    const method = String(opts.method || 'GET').toUpperCase(); url = String(url);
    if (url.includes('/projects/offline-test/')) throw new TypeError('Failed to fetch');   // utan nät
    const m = url.match(/\/documents\/(.+?)(\?|$)/); const p = m ? decodeURIComponent(m[1]) : null;
    log.push({ dev, method, path: p || url.split('?')[0], at: log.length });
    if (!p) return { ok: false, status: 403, json: async () => ({}) };            // inloggning m.m. finns inte här
    if (!/^families\/[^/]+\/profiles\//.test(p)) return { ok: false, status: 403, json: async () => ({}) };   // medlemmar m.m.: nekas
    if (method === 'GET') { if (!docs[p]) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => JSON.parse(docs[p]) }; }
    if (method === 'PATCH') { clock += 1000; const body = JSON.parse(opts.body); const d = { name: p, fields: body.fields, updateTime: new Date(clock).toISOString() }; docs[p] = JSON.stringify(d); return { ok: true, status: 200, json: async () => JSON.parse(docs[p]) }; }
    if (method === 'DELETE') { delete docs[p]; return { ok: true, status: 200, json: async () => ({}) }; }
    return { ok: false, status: 400, json: async () => ({}) };
  };
  const prof = (kid) => { const d = docs[`families/${FAM}/profiles/${kid}`]; return d ? JSON.parse(JSON.parse(d).fields.json.stringValue) : null; };
  return { docs, log, fetchFor, prof, snap: () => JSON.stringify(docs), writes: (dev, from = 0) => log.slice(from).filter(x => x.dev.startsWith(dev) && x.method !== 'GET' && x.method !== 'HEAD' && /^families\//.test(x.path)) };   // skrivningar i familjens data (inloggning räknas inte)
}

/* ---------- enheter ---------- */
function mk({ html, url, dev, cloud, storage = null, seed = 1, now = T_FIXED, tweak = null }) {
  const dom = new JSDOM(tweak ? tweak(html) : html, { runScripts: 'dangerously', pretendToBeVisual: true, url, beforeParse(w) {
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.Math.random = rng(seed); const RD = w.Date; let t = now; class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(t); } static now() { return t; } } w.Date = FD; w.__advance = (ms) => { t += ms; }; w.__now = () => t;
    w.fetch = withCommit(cloud.fetchFor(dev)); w.addEventListener('error', (e) => e.preventDefault());
    if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  } });
  const w = dom.window; w.__dev = dev; return w;
}
const realDump = (w) => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); if (k.startsWith('pluggappen-preview:')) o[k] = w.localStorage.getItem(k); } return o; };   // testversionens lagrade data (produktionens nyckel kontrolleras för sig)
const allStored = (w) => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
const same = (a, b) => JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));
const until = async (fn, ms = 3000) => { const t0 = Date.now(); while (!fn() && Date.now() - t0 < ms) await sleep(10); return fn(); };
const unlock = (w) => { const T = tools(w); const { $, click } = T; if (!$('[data-pin]')) click($('[data-go="parent"]')); const pins = [...w.document.querySelectorAll('[data-pin]')]; if (pins.length) ['1', '2', '3', '4'].forEach((d, i) => { pins[i].value = d; pins[i].dispatchEvent(new w.Event('input', { bubbles: true })); }); };
const learnFields = ['le', 'xp', 'gems', 'skills', 'mistakes', 'mistakesCleared', 'tests', 'badges', 'exams', 'v3', 'words', 'settings', 'sessions', 'perfect', 'blitz', 'unlocked', 'pet'];   // allt barnet lärt och fått (dygnsomslaget räknas om på varje enhet)
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const learnOf = (p) => JSON.stringify(canon(Object.fromEntries(learnFields.map(k => [k, p && k === 'le' && p.le ? { ...p.le, srv: undefined } : p ? p[k] : undefined]))));   // le.srv = enhetens senaste serverklocka (räknas om vid varje hämtning)   // innehållet, oberoende av nycklarnas ordning
// Testbevisens enhetsmärkning (~t) – sökt i AVKODADE värden (dokumentens json och lagringens JSON), så att både löpnummer (dev:seq),
// enhetsfält och seqs-nycklar hittas (granskning: sökning i flerfaldigt kodad text missade allt utom dev:seq)
const decodeAll = (v) => { if (typeof v === 'string') { try { const j = JSON.parse(v); if (j && typeof j === 'object') return decodeAll(j); } catch (e) { /* vanlig text */ } return v; } if (Array.isArray(v)) return v.map(decodeAll); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decodeAll(x)])); return v; };
const hasTestDev = (x) => /~t(["':]|$)/m.test(JSON.stringify(decodeAll(typeof x === 'string' ? x : x)));
const PROD_KEY = '{"marker":"produktionens data på samma enhet"}';

// Barnets riktiga enhet (produktionen): kopplad till familjen, spelar riktiga pass och laddar upp.
async function childDevice(cloud, seed) {
  const C = mk({ html: PROD_HTML, url: PROD_URL, dev: 'child', cloud, seed }); await sleep(30);
  C.PA.DB.settings.family = FAM; C.PA.FAMILY.apply(FIX); C.PA.load(); await C.PA.FAMILY.push(); await C.PA.SYNC.refreshAll(); C.PA.rerender();
  return C;
}
async function childPlays(C, kidId, wrongP, seed) {
  const T = tools(C); const { $, click } = T; const D = v2tools(C, T); const r = rng(seed);
  C.PA.go('start'); click($(`[data-kid="${kidId}"]`)); if ($('[data-pet]')) click($('[data-pet]'));
  const go = $('.go-btn[data-v2="kor"]') || $('[data-v2="kor"]') || $('[data-v2="flow"]'); if (go) { click(go); D.run(() => r() < wrongP, 60); }
  C.PA.flushSave(); C.PA.SYNC.pending.clear(); clearTimeout(C.PA.SYNC.pushTimer); await C.PA.SYNC.push(kidId); C.PA.go('start');
}
// Testenheten (testadressen): kopplad till familjen, speglar familjens data.
async function previewDevice(cloud, seed, storage, now) {
  const P = mk({ html: PV_HTML, url: PV_URL, dev: 'preview', cloud, seed, storage: storage || { 'pluggappen.v1': PROD_KEY }, now }); await sleep(30);
  if (!storage) { P.PA.DB.settings.family = FAM; P.PA.flushSave(); await P.PA.FAMILY.pull(); P.PA.load(); }
  await P.PA.SYNC.refreshAll(); P.PA.rerender(); return P;
}
async function enterTest(P, kidId, exp) {
  const T = tools(P); const { $, click } = T; P.PA.go('start'); unlock(P); click($(`[data-tab="${kidId}"]`));
  const btn = exp ? $(`[data-tm="start"][data-kid-id="${kidId}"][data-exp="${exp}"]`) : $(`[data-tm="start"][data-kid-id="${kidId}"]:not([data-exp])`);
  ok(!!btn, `${kidId}: föräldraläget visar "Testa som …"`); if (!btn) return false;
  click(btn); await until(() => P.PA.TM.on); return !!P.PA.TM.on;
}
// Avsluta testläget och "ladda om": en ny sida med samma lagrade data (den gamla sidans minne finns inte kvar).
async function exitAndReload(P, cloud, seed, how = 'exit') {
  let reloaded = false; P.PA.TM.reload = () => { reloaded = true; }; const T = tools(P);
  if (how === 'exit') T.click(P.document.querySelector('#tmBar [data-tm-exit]'));
  else if (how === 'start') { P.PA.go('home'); const b = P.document.querySelector('#app [data-go="start"]'); ok(!!b, 'byta barn: barnets vy har tillbaka-knappen till start'); if (b) T.click(b); }
  const hash = P.location.hash; const stored = allStored(P);
  const P2 = mk({ html: PV_HTML, url: PV_URL + (how === 'drop' ? '' : hash), dev: 'preview-omladdad', cloud, seed, storage: stored, now: P.__now() }); await sleep(60); await until(() => P2.PA && P2.PA.SYNC.status !== 'off', 1500); await sleep(60);
  return { P2, reloaded, hash };
}

(async () => {
  try {
    /* ================= A. Åttan (Achieve): CORE, rätt/fel, papper, Testa mig, flera FLOW, belöningar, prov – barnet spelar samtidigt ================= */
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 11);
      { const k8 = C.PA.KIDS.find(k => k.id === 'k8'); const cat = C.PA.LE.state(k8).cat; const sk = [...new Set(Object.entries(cat).filter(([, d]) => d.kind === 'skill' && d.active !== false).map(([c]) => c.slice(2)))];
        const iso = (d) => new Date(C.__now() + d * DAY).toISOString().slice(0, 10);
        C.PA.DB.profiles.k8.exams = [{ id: 'e1', title: 'Matteprov', date: iso(9), skillIds: sk.filter(s => ['forenkla', 'ekvation', 'multin'].includes(s)).concat(sk).slice(0, 3), deckIds: [] }]; C.PA.save(); }
      await childPlays(C, 'k8', 0.3, 5); await childPlays(C, 'k4', 0.3, 6); await childPlays(C, 'k2', 0.3, 7); C.__advance(DAY);
      const P = await previewDevice(cloud, 21, null, C.__now());
      const A = cloud.prof('k8');
      ok(A && learnOf(P.PA.DB.profiles.k8) === learnOf(A), 'Åttan: testadressen har barnets riktiga läge (spegel av familjens data)');
      const cloud0 = cloud.snap(); const logStart = cloud.log.length;
      const inflight = P.PA.SYNC.refresh('k8');   // en hämtning som redan pågår när testet startar
      ok(await enterTest(P, 'k8'), 'Åttan: testläget startar från föräldraläget');
      ok(await inflight === false, 'Åttan: en hämtning som pågick när testet startade ändrar ingenting');
      const TM = P.PA.TM; const before = TM.before; ok(before && same(realDump(P), before), 'Åttan: ögonblicksbilden = lagrad data när testet startar');
      const logTm = cloud.log.length; const T = tools(P); const { $, click } = T; const D = v2tools(P, T); const r = rng(31);
      ok(/TESTLÄGE – inget sparas/.test($('#tmBar').textContent) && $('#tmBar [data-tm-exit]') && /Avsluta testläge/.test($('#tmBar').textContent), 'Åttan: förälderns markering "TESTLÄGE – inget sparas" och "Avsluta testläge"');
      ok(!/TESTLÄGE|testläge|inget sparas/i.test($('#app').textContent), 'Åttan: ingen testtext i barnets egen vy');
      ok(!$('#app [data-go="sync"]'), 'Åttan: ingen synkkod under testet (kopian kan inte lämna sidan)'); { const sc = P.PA.S; P.PA.go('sync'); ok(!$('#syncArea') && !$('[data-act="syncCopy"]') && P.PA.S === sc, 'Åttan: synkvyn öppnas inte under testet'); }
      ok(/Matteprov/.test($('#app').textContent) && P.PA.EXP.of(P.PA.KIDS.find(k => k.id === 'k8')) === 'achieve', 'Åttan: samma upplevelse (Achieve) och samma prov som barnet ser');
      const xp0 = P.PA.DB.profiles.k8.xp, log0 = ((P.PA.DB.profiles.k8.le || {}).log || []).length;
      // CORE med rätt och fel
      click($('.go-btn[data-v2="kor"]') || $('[data-v2="kor"]')); D.run(() => r() < 0.35, 60);
      ok(/KLAR|Klart|klar/i.test($('#app').textContent), 'Åttan: CORE → KLAR i testet');
      // flera FLOW-block
      let flows = 0; for (let i = 0; i < 3; i++) { P.PA.go('home'); const f = $('[data-v2="flow"]'); if (!f) break; click(f); D.run(() => r() < 0.3, 60); flows++; }
      ok(flows >= 2, `Åttan: flera FLOW-block i testet (${flows})`);
      // Testa mig (provet)
      P.PA.go('home'); const tm = $('[data-v2="testa"]'); let examOn = false; const exLog0 = ((P.PA.DB.profiles.k8.le || {}).log || []).length; if (tm) { click(tm); examOn = !!(P.PA.S && P.PA.S.v2 && P.PA.S.v2.exam); D.run(() => r() < 0.3, 60); }
      ok(!!tm && examOn && ((P.PA.DB.profiles.k8.le || {}).log || []).length > exLog0, 'Åttan: Testa mig spelas i testet och ger resultat i kopian');
      // barnet använder produktionen SAMTIDIGT på sin egen enhet → riktigt läge B
      C.__advance(3600000); await childPlays(C, 'k8', 0.2, 41); const B = cloud.prof('k8');
      ok(B && learnOf(B) !== learnOf(A), 'Åttan: barnets samtidiga riktiga pass finns i familjens data (läge B)');
      // ett pass till i testet efter barnets skrivning
      P.PA.go('home'); const f2 = $('[data-v2="flow"]') || $('[data-v2="kor"]'); if (f2) { click(f2); D.run(() => r() < 0.3, 40); }
      const copy = P.PA.DB.profiles.k8; const newLog = ((copy.le || {}).log || []).slice(log0);
      ok(copy.xp > xp0 && newLog.length > 10, `Åttan: testet gjorde verkligen något i kopian (XP ${xp0}→${copy.xp}, ${newLog.length} nya bevis)`);
      ok(newLog.every(e => String(Array.isArray(e) ? e[0] : (e.d || e.dev || '')).includes('~t') || hasTestDev(JSON.stringify(e))), 'Åttan: testets bevis är märkta ~t (egen enhetsmärkning, ingen krock med riktiga löpnummer)');
      info.push(`Åttan: ${D.log.items} svar, typer ${JSON.stringify(D.log.types)}, Rescue-kort ${D.log.rescueLearn}, Testa mig ${D.log.exam}, FLOW ${flows}`);
      ok((D.log.types.paper || 0) + (D.log.types.expr || 0) + (D.log.types.num || 0) > 0, 'Åttan: eget svar/papper ingår i testet');
      // andra barns synk, uppladdning och sparning under testet kan inte skriva något
      let blockedAny = 0; try { await P.fetch(`https://firestore.googleapis.com/v1/projects/pluggappen/databases/(default)/documents/families/${FAM}/members/u1?key=x`, { method: 'PATCH', body: '{}' }); } catch (e) { blockedAny++; }
      ok(blockedAny === 1, 'Åttan: under testet nekas även skrivningar utanför barnens data (t.ex. medlemskap)');
      P.PA.DB.profiles.k4.xp += 500; P.PA.save(); P.PA.SYNC.schedulePush('k4'); const pr = await P.PA.SYNC.push('k4'); const rf = await P.PA.SYNC.refreshAll(); const fp = await P.PA.FAMILY.push(); P.PA.flushSave();
      ok(pr === false && rf === false && fp === false, 'Åttan: under testet laddar ingenting upp och synken hämtar inget (även för syskonen)');
      await sleep(1700);
      ok(cloud.log.slice(logTm).filter(x => x.dev === 'preview').length === 0, `Åttan: inte en enda begäran från testenheten under testet (${cloud.log.slice(logTm).filter(x => x.dev === 'preview').length})`);
      ok(P.__PV_BLOCKED >= 1, `Åttan: nätverksskyddet nekade det försökte (${P.__PV_BLOCKED})`);
      ok(same(realDump(P), before), 'Åttan: lagrad data på testenheten oförändrad under testet (byte för byte)');
      ok(P.PA.SYNC.pending.size === 0, 'Åttan: ingen väntande uppladdning');
      // avsluta
      const { P2, reloaded, hash } = await exitAndReload(P, cloud, 22);
      ok(reloaded && hash === '#foralder-tm1', `Avsluta: kontrollen före omladdning = oförändrat (${hash}), sidan laddas om`);
      ok(same(realDump(P), before), 'Avsluta: lagrad data byte för byte som före testet');
      ok(!P2.PA.TM.on && /Testläget är avslutat\. Inget från testet sparades/.test(P2.document.body.textContent) && P2.document.querySelector('[data-pin]'), 'Avsluta: tillbaka i föräldraläget (koden) med beskedet');
      ok(learnOf(cloud.prof('k8')) === learnOf(B), 'Samtidigt: barnets läge B gäller i familjens data');
      ok(learnOf(P2.PA.DB.profiles.k8) === learnOf(B), 'Samtidigt: testenheten speglar barnets läge B efter testet (nästa synk konvergerar)');
      ok(cloud.writes('preview').length === 0, `Ingen skrivning från testenheten någonsin (${cloud.writes('preview').map(x => x.method + ' ' + x.path).join(', ')})`);
      ok(!hasTestDev(cloud.snap()) && !hasTestDev(JSON.stringify(realDump(P2))), 'Inga testbevis (~t) i familjens data eller i testenhetens lagring');
      const docsNow = JSON.parse(cloud.snap()), docs0 = JSON.parse(cloud0);
      ok(Object.keys(docs0).every(k => k.endsWith('/k8') || docsNow[k] === docs0[k]), 'Syskonens dokument i familjens data orörda');
      ok(C.PA.DB.profiles.k8.xp === cloud.prof('k8').xp && P2.PA.DB.profiles.k8.xp === B.xp, `Belöningar: inga dubbletter (barnet ${C.PA.DB.profiles.k8.xp}, familjen ${cloud.prof('k8').xp}, testenheten ${P2.PA.DB.profiles.k8.xp})`);
      const Cbefore = learnOf(C.PA.DB.profiles.k8); const ch = await C.PA.SYNC.refresh('k8'); ok(ch === false && learnOf(C.PA.DB.profiles.k8) === Cbefore, 'Barnets enhet: nästa synk ändrar inget (inget från testet att hämta)');
      ok(((B.le || {}).log || []).length >= ((A.le || {}).log || []).length, 'Inga riktiga bevis försvann');
      ok(P.localStorage.getItem('pluggappen.v1') === PROD_KEY && P2.localStorage.getItem('pluggappen.v1') === PROD_KEY, 'Produktionens data på samma enhet orörd genom hela testet');
      void logStart;
    }

    /* ================= B. Tvåan (Explore): aktiviteter, rätt/fel, KLAR, FLOW – barnet spelar samtidigt; byta barn under testet ================= */
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 12); await childPlays(C, 'k2', 0.3, 8); await childPlays(C, 'k4', 0.2, 9); C.__advance(DAY);
      const P = await previewDevice(cloud, 23, null, C.__now()); const A2 = cloud.prof('k2'); const A4 = cloud.prof('k4');
      ok(await enterTest(P, 'k2'), 'Tvåan: testläget startar');
      const before = P.PA.TM.before; const T = tools(P); const { $, click } = T; const D = v2tools(P, T); const r = rng(32); const logTm = cloud.log.length;
      ok(P.PA.EXP.of(P.PA.KIDS.find(k => k.id === 'k2')) === 'explore' && P.document.querySelector('section.mission, .mission, [data-v2="kor"]'), 'Tvåan: Explore-hemmet som barnet ser det');
      click($('.go-btn[data-v2="kor"]') || $('[data-v2="kor"]')); D.run(() => r() < 0.4, 60);
      P.PA.go('home'); const f = $('[data-v2="flow"]'); if (f) { click(f); D.run(() => r() < 0.3, 40); }
      ok(D.log.items > 4, `Tvåan: testet spelade ${D.log.items} uppgifter (${JSON.stringify(D.log.types)})`);
      C.__advance(1800000); await childPlays(C, 'k2', 0.2, 42); const B2 = cloud.prof('k2');
      ok(same(realDump(P), before), 'Tvåan: lagrad data oförändrad under testet');
      const reqB = cloud.log.slice(logTm).filter(x => x.dev === 'preview').length;
      // byta barn: tillbaka till start = testet avslutas (sidan laddas om)
      const { P2, reloaded, hash } = await exitAndReload(P, cloud, 24, 'start');
      ok(reloaded && hash === '#foralder-tm1', 'Byta barn: tillbaka till start avslutar testet');
      ok(reqB === 0 && cloud.writes('preview').length === 0, `Tvåan: ingen begäran under testet (${reqB}), ingen skrivning någonsin`);
      ok(learnOf(P2.PA.DB.profiles.k2) === learnOf(B2) && learnOf(cloud.prof('k2')) === learnOf(B2), 'Tvåan: barnets samtidiga läge gäller överallt efter testet');
      ok(learnOf(P2.PA.DB.profiles.k4) === learnOf(A4) && learnOf(cloud.prof('k4')) === learnOf(A4), 'Byta barn: syskonets profil orörd');
      ok(!hasTestDev(cloud.snap()) && !hasTestDev(JSON.stringify(realDump(P2))), 'Tvåan: inga testbevis någonstans');
      ok(P.localStorage.getItem('pluggappen.v1') === PROD_KEY && P2.localStorage.getItem('pluggappen.v1') === PROD_KEY, 'Tvåan: produktionens data på samma enhet orörd');
      void A2;
    }

    /* ================= C. Fyran (Grow): Revansch, Rescue, annan upplevelse i testet, ladda om mitt i testet, stänga och öppna igen ================= */
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 13);
      for (let d = 0; d < 3; d++) { await childPlays(C, 'k4', 0.55, 50 + d); C.__advance(DAY); }
      const P = await previewDevice(cloud, 25, null, C.__now()); const A4 = cloud.prof('k4');
      // annan upplevelse bara i testet
      ok(await enterTest(P, 'k4', 'achieve'), 'Fyran: testläget med en annan upplevelse (Achieve)');
      ok(P.PA.EXP.of(P.PA.KIDS.find(k => k.id === 'k4')) === 'achieve', 'Fyran: kopian kör Achieve');
      const before = P.PA.TM.before; const T = tools(P); const { $, click } = T; const D = v2tools(P, T); const r = rng(33);
      P.PA.go('home'); click($('.go-btn[data-v2="kor"]') || $('[data-v2="kor"]')); D.run(() => r() < 0.6, 60);
      ok(same(realDump(P), before), 'Fyran: lagrad data oförändrad (Achieve i testet)');
      // ladda om mitt i testet (ingen Avsluta): kopian i minnet försvinner
      const r1 = await exitAndReload(P, cloud, 26, 'drop');
      ok(!r1.P2.PA.TM.on && same(realDump(r1.P2), realDump(P)) && learnOf(r1.P2.PA.DB.profiles.k4) === learnOf(A4), 'Ladda om under testet: inget test kvar, riktiga läget');
      ok(r1.P2.PA.EXP.of(r1.P2.PA.KIDS.find(k => k.id === 'k4')) === 'grow', 'Ladda om: barnets riktiga upplevelse (Grow) – testets val följde inte med');
      // stänga och öppna igen: nytt test med barnets egen upplevelse, Revansch och Rescue
      const P3 = r1.P2; P3.__advance(DAY); ok(await enterTest(P3, 'k4'), 'Fyran: nytt test efter omstart');
      const before3 = P3.PA.TM.before; const T3 = tools(P3); const D3 = v2tools(P3, T3); const r3 = rng(34); const logTm = cloud.log.length;
      P3.PA.go('home'); const rev = T3.$('[data-v2="revansch"]');
      if (rev) { T3.click(rev); ok(P3.PA.S && P3.PA.S.v2 && P3.PA.S.v2.mode === 'revansch', 'Fyran: Revansch startar i testet'); D3.run(() => r3() < 0.6, 60); }
      else info.push('Fyran: Revansch erbjöds inte på hemmet i det här läget');
      P3.PA.go('home'); const go = T3.$('.go-btn[data-v2="kor"]') || T3.$('[data-v2="kor"]') || T3.$('[data-v2="flow"]'); if (go) { T3.click(go); D3.run(() => r3() < 0.7, 60); }
      info.push(`Fyran: Revansch ${rev ? 'ja' : 'nej'}, Rescue-kort ${D3.log.rescueLearn}, svar ${D3.log.items}`);
      ok(!!rev || D3.log.rescueLearn > 0, 'Fyran: Revansch eller Rescue prövades i testet');
      const copy = P3.PA.DB.profiles.k4; ok((copy.mistakes || []).length !== (A4.mistakes || []).length || learnOf(copy) !== learnOf(A4), 'Fyran: Felboken/beviset ändrades i kopian');
      ok(same(realDump(P3), before3), 'Fyran: lagrad data oförändrad (Revansch/Rescue)');
      const reqC = cloud.log.slice(logTm).filter(x => x.dev === P3.__dev).length;
      const { P2, hash } = await exitAndReload(P3, cloud, 27);
      ok(hash === '#foralder-tm1' && learnOf(P2.PA.DB.profiles.k4) === learnOf(A4) && learnOf(cloud.prof('k4')) === learnOf(A4), 'Fyran: efter testet är barnets riktiga Felbok, bevis och belöningar orörda');
      ok(reqC === 0 && cloud.writes('preview').length === 0, `Fyran: inga begäranden under testet (${reqC}), inga skrivningar någonsin`);
      ok(P3.localStorage.getItem('pluggappen.v1') === PROD_KEY && P2.localStorage.getItem('pluggappen.v1') === PROD_KEY, 'Fyran: produktionens data på samma enhet orörd');
    }

    /* ================= D. Stänger säkert ================= */
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 14); await childPlays(C, 'k8', 0.2, 60);
      // vanliga appen: ingen knapp, start vägras
      // 3.2: den vanliga appen har Testa som barnet i föräldraläget (prövas fullt i test_parent_test_mode_prod.js); utanför föräldraläget vägras start
      { C.PA.go('start'); const d0 = allStored(C); await C.PA.TM.start('k8'); ok(!C.PA.TM.on && same(allStored(C), d0), 'Vanliga appen: start utanför föräldraläget vägras och inget ändras');
        unlock(C); tools(C).click(C.document.querySelector('[data-tab="k8"]')); ok(!!C.document.querySelector('[data-tm="start"]') && C.PA.TM.available(), 'Vanliga appen: "Testa som" finns i föräldraläget'); C.PA.go('start'); }
      // gammal lagring utan omkoppling (en äldre testsida): ingen knapp
      { const old = (h) => h.replace(/__tmBegin: function \(\) \{[^}]*\}, /, ''); const W = mk({ html: PV_HTML, url: PV_URL, dev: 'preview', cloud, tweak: old }); await sleep(30); W.PA.DB.settings.family = FAM; await W.PA.FAMILY.pull(); W.PA.load(); await W.PA.SYNC.refreshAll(); unlock(W); tools(W).click(W.document.querySelector('[data-tab="k8"]'));
        ok(!W.PA.TM.available() && !W.document.querySelector('[data-tm]'), 'Lagring som inte kan kopplas om: testläget erbjuds inte'); }
      // trasig isolering (omkopplingen gör ingenting): testläget startar inte, lagringen orörd
      { const fake = (h) => h.replace(/__tmBegin: function \(\) \{ if \(!ov\) ov = new Map\(\); return true; \}/, '__tmBegin: function () { return true; }').replace('get __tmOn() { return !!ov; }', 'get __tmOn() { return true; }');
        ok(fake(PV_HTML) !== PV_HTML, 'testet hittar omkopplingen i testsidan');
        const W = mk({ html: PV_HTML, url: PV_URL, dev: 'preview', cloud, tweak: fake }); await sleep(30); W.PA.DB.settings.family = FAM; W.PA.flushSave(); await W.PA.FAMILY.pull(); W.PA.load(); await W.PA.SYNC.refreshAll(); W.PA.rerender();
        const d0 = realDump(W); unlock(W); tools(W).click(W.document.querySelector('[data-tab="k8"]')); tools(W).click(W.document.querySelector('[data-tm="start"]')); await until(() => W.PA.TM.on);
        const d1 = realDump(W); const T = tools(W);
        ok(W.PA.TM.on && W.PA.TM.on.broken && /kunde inte starta/i.test(W.document.body.textContent) && !T.$('[data-v2="kor"]'), 'Trasig isolering: testläget startar inte (barnets vy visas inte)');
        const V1 = 'pluggappen-preview:pluggappen.v1'; ok(Object.keys(d1).length === Object.keys(d0).length && Object.keys(d1).every(k => k === V1 || d1[k] === d0[k]) && learnOf(JSON.parse(d1[V1]).profiles.k8) === learnOf(JSON.parse(d0[V1]).profiles.k8), 'Trasig isolering: barnets lagrade bevis orörda, provnyckeln borttagen');
        ok(!W.PA.SYNC.active && cloud.writes('preview').length === 0, 'Trasig isolering: ingen synk, inga skrivningar');
        const sc0 = W.PA.S; W.PA.setKid('k8'); W.PA.go('home'); ok(W.PA.S === sc0 && !T.$('[data-v2="kor"]'), 'Trasig isolering: barnets vyer går inte att öppna');
        W.PA.TM.reload = () => {}; T.click(W.document.querySelector('[data-tm-exit]')); ok(W.location.hash === '#foralder-tm2', `Trasig isolering: Tillbaka ger ett eget besked, inget falsklarm (${W.location.hash})`); }
      // utan nät och med en lokalt ändrad kopia: vägras (det riktiga läget går inte att garantera)
      { const P = await previewDevice(cloud, 28); P.PA.DB.profiles.k8.xp += 7; P.PA.DB.profiles.k8.updatedAt = (P.PA.DB.profiles.k8.syncedAt || 0) + 5; P.PA.flushSave();
        const cf = cloud.fetchFor; void cf; const d0 = realDump(P); P.PA.SYNC.cfg = { ...P.PA.SYNC.cfg, projectId: 'offline-test' };   // pull mot fel projekt → 403 = "fel"
        unlock(P); tools(P).click(P.document.querySelector('[data-tab="k8"]')); tools(P).click(P.document.querySelector('[data-tm="start"]')); await sleep(200);
        ok(!P.PA.TM.on && /Kunde inte hämta|nätet/i.test(P.document.body.textContent) && same(realDump(P), d0), 'Utan nät + ändrad kopia: testläget vägras (startar inte från ett osäkert läge)'); }
      // utanför föräldraläget: vägras
      { const P = await previewDevice(cloud, 29); P.PA.go('start'); await P.PA.TM.start('k8'); ok(!P.PA.TM.on, 'Utanför föräldraläget: start vägras'); }
    }

    /* ================= E. Testadressen utanför testet: spegel, nätverksskydd, inga barnvyer ================= */
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 15); await childPlays(C, 'k2', 0.2, 70);
      const P = await previewDevice(cloud, 30); const T = tools(P);
      P.PA.go('start'); ok(!P.document.querySelector('[data-kid]') && /för föräldern/.test(P.document.body.textContent), 'Testadressen: startsidan har inga barnkort (barnen använder den vanliga appen)');
      P.PA.setKid('k2'); P.PA.go('home'); ok(!P.document.querySelector('[data-v2="kor"]') && !P.PA.S, 'Testadressen: barnets vy öppnas inte utanför testläget');
      { const P2 = mk({ html: PV_HTML, url: PV_URL + '#k2-kor', dev: 'preview', cloud, storage: realDump(P) }); await sleep(80); ok(!P2.PA.S && !P2.document.querySelector('#qcard'), 'Testadressen: djuplänken #k2-kor startar inget pass'); }
      // spegel: en lokalt ändrad kopia ersätts av familjens data, och laddas aldrig upp
      P.PA.DB.profiles.k2.xp += 999; P.PA.DB.profiles.k2.updatedAt = Date.now(); P.PA.flushSave(); const n0 = cloud.log.length;
      ok(await P.PA.SYNC.push('k2') === false, 'Testadressen: SYNC.push laddar aldrig upp');
      await P.PA.SYNC.refresh('k2'); ok(P.PA.DB.profiles.k2.xp === cloud.prof('k2').xp, 'Testadressen: lokalt ändrad kopia ersätts av familjens data');
      ok(cloud.log.slice(n0).every(x => x.method === 'GET'), 'Testadressen: bara hämtningar');
      // nätverksskyddet: skrivning till barnens data nekas alltid; annat (t.ex. medlemskap) släpps igenom till servern
      let rej = 0; try { await P.fetch(`https://firestore.googleapis.com/v1/projects/pluggappen/databases/(default)/documents/families/${FAM}/profiles/k2?key=x`, { method: 'PATCH', body: '{}' }); } catch (e) { rej++; }
      try { await P.fetch(`https://firestore.googleapis.com/v1/projects/pluggappen/databases/(default)/documents/families/${FAM}/profiles?key=x`, { method: 'POST', body: '{}' }); } catch (e) { rej++; }
      const m0 = cloud.log.length; await P.fetch(`https://firestore.googleapis.com/v1/projects/pluggappen/databases/(default)/documents/families/${FAM}/members/u1?key=x`, { method: 'PATCH', body: '{}' });
      ok(rej === 2 && cloud.log.length === m0 + 1 && cloud.writes('preview').filter(x => /profiles/.test(x.path)).length === 0, 'Nätverksskyddet: skrivning till profiles nekas, medlemskap släpps igenom');
      let rej2 = 0; for (const [m, u] of [['DELETE', `families/${FAM}/members/u1`], ['PATCH', `families/${FAM}/meta/info?key=x&updateMask.fieldPaths=joinCode&updateMask.fieldPaths=rotatedAt`], ['PATCH', `families/${FAM}/members/u2?key=x&updateMask.fieldPaths=role`]]) { const n0 = cloud.log.length; try { const rr = await P.fetch(`https://firestore.googleapis.com/v1/projects/pluggappen/databases/(default)/documents/${u}`, { method: m, body: '{}' }); if (rr && rr.status === 403 && cloud.log.length === n0) rej2++; } catch (e) { rej2++; } }
      ok(rej2 === 3, 'Nätverksskyddet: radering, byte av parkopplingskod och byte av roll nekas i testversionen');
      { const m0 = cloud.log.length; const rr = await P.fetch(`https://firestore.googleapis.com/v1/projects/pluggappen/databases/(default)/documents/families/${FAM}/meta/info?key=x`, { method: 'PATCH', body: '{}' });
        ok(rr && rr.status === 403 && cloud.log.length === m0, 'Nätverksskyddet: familjens meta/info skrivs aldrig (svarar "finns redan", parkopplingen fortsätter)'); }
      { const m0 = cloud.log.length; let rej = false; try { await P.fetch('https://firestore.googleapis.com/v1/projects/pluggappen/databases/(default)/documents:commit?key=x', { method: 'POST', body: JSON.stringify({ writes: [{ update: { name: `projects/pluggappen/databases/(default)/documents/families/${FAM}/profiles/k8`, fields: {} } }] }) }); } catch (e) { rej = true; }
        ok(rej && cloud.log.length === m0, 'Nätverksskyddet: en villkorad skrivning via documents:commit (3.2.2) nekas också på testadressen'); }
      unlock(P); T.click(P.document.querySelector('[data-tab="settings"]'));
      ok(!P.document.querySelector('[data-act="deleteFamilyData"], [data-act="copyFamLink"], #memberList') && /hanteras i den vanliga appen/.test(P.document.body.textContent), 'Testversionen: familj, enheter och radering hanteras inte här');
      { P.PA.FAMILY.update(c => { c.kids[0].name = 'Ändrad i testversionen'; }); await P.PA.FAMILY.pull(); ok(P.PA.FAMILY.cfg.kids[0].name !== 'Ändrad i testversionen' && JSON.stringify(P.PA.FAMILY.cfg) === JSON.stringify(JSON.parse(JSON.parse(cloud.docs[`families/${FAM}/profiles/_config`]).fields.json.stringValue)), 'Testversionen: familjens inställningar är en spegel (lokal ändring ersätts)'); }
      let reassigned = false; try { P.fetch = () => Promise.resolve({ ok: true }); reassigned = P.fetch.toString().includes('ok: true'); } catch (e) { reassigned = false; }
      ok(!reassigned, 'Nätverksskyddet går inte att byta ut');
      ok(Object.isFrozen(P.eval('localStorage')) && P.eval('localStorage') !== P.localStorage, 'Testadressens lagring är fryst och skild från webbläsarens');
      void T;
    }
  } catch (e) { fails++; console.log('EXC', e.stack); }
  finally { try { fs.rmSync(path.join(DIST, 'preview'), { recursive: true, force: true }); } catch (e) { /* ignore */ } }
  for (const l of info) console.log('  ·', l);
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'PARENT TEST MODE FAILED' : 'PARENT TEST MODE OK'); process.exit(fails ? 1 : 0);
})();
