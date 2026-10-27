/* 3.2 – Testa som barnet i den VANLIGA appens föräldraläge (ägarens önskan: Föräldraläge → barnet → Testa som …, utan testadress).
   Föräldrens telefon kör den vanliga appen med riktig data och vanlig synk; barnet använder sin egen enhet samtidigt. SYNTETISK familj
   (testfixturen), en låtsad Firestore som enheterna delar, fast klocka. Varje fall kontrollerar
     · den lagrade datan på förälderns enhet byte för byte (före = efter) – samma nycklar som appen alltid använt
     · familjens data (före = efter, utom barnets egna samtidiga skrivningar) och att förälderns enhet inte skickar något under testet
     · att det riktiga läget efter testet är BARNETS nya läge – aldrig A, testet, A+test eller B+test
   Fall: Åttan/Achieve med Bara prov och läxor (CORE, fel, papper, Testa mig, KLAR, flera FLOW) medan barnet spelar · Tvåan/Explore
   (aktiviteter, uppläsning, fel/Rescue, KLAR, FLOW igen) · Fyran/Grow med en annan upplevelse i testet · väntande ändringar (skickas
   först – utan nät startar testet inte) · ladda om, bakåt (sidan ur cachen), dold/synlig, nät borta/tillbaka under testet · avsluta. */
'use strict';
const { execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const { rng, T_FIXED, tools } = require('./le/childflow.js');
const { v2tools } = require('./le/v2driver.js');
const FIX = require('./test_fixture_family.json');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const info = []; const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const ROOT = path.join(__dirname, '..'); const DIST = path.join(ROOT, 'dist');
execFileSync('bash', [path.join(ROOT, 'scripts/build.sh')], { env: { ...process.env, PREVIEW: '1' }, stdio: 'pipe' });   // båda byggena (testadressen behövs inte här, men byggs likadant)
const PV_HTML = fs.readFileSync(path.join(DIST, 'preview/index.html'), 'utf8');
const PROD_HTML = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const PV_URL = 'https://example.org/pluggappen/preview/'; const PROD_URL = 'https://example.org/pluggappen/';
const FAM = 'test-fam-123';

/* ---------- låtsad Firestore (REST som appen använder) ---------- */
function mkCloud() {
  const docs = {}; const log = []; let clock = T_FIXED;
  const fetchFor = (dev, nowFn) => async (url, opts = {}) => {   // serverns klocka följer enheternas (annars blir klockskillnaden ett helt dygn)
    const method = String(opts.method || 'GET').toUpperCase(); url = String(url);
    if (url.includes('/projects/offline-test/')) throw new TypeError('Failed to fetch');   // utan nät
    const m = url.match(/\/documents\/(.+?)(\?|$)/); const p = m ? decodeURIComponent(m[1]) : null;
    log.push({ dev, method, path: p || url.split('?')[0], at: log.length });
    if (!p) return { ok: false, status: 403, json: async () => ({}) };            // inloggning m.m. finns inte här
    if (!/^families\/[^/]+\/profiles\//.test(p)) return { ok: false, status: 403, json: async () => ({}) };   // medlemmar m.m.: nekas
    if (method === 'GET') { if (!docs[p]) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => JSON.parse(docs[p]) }; }
    if (method === 'PATCH') {   // villkor som i Firestore: currentDocument.updateTime / currentDocument.exists
      const q = new URL(url).searchParams; const ut = q.get('currentDocument.updateTime'); const ex = q.get('currentDocument.exists');
      if ((ut !== null && (!docs[p] || JSON.parse(docs[p]).updateTime !== ut)) || (ex === 'false' && docs[p]) || (ex === 'true' && !docs[p])) { log.push({ dev, method: 'PATCH-NEKAD', path: p, at: log.length }); return { ok: false, status: 400, json: async () => ({ error: { status: 'FAILED_PRECONDITION' } }) }; }
      clock = Math.max(clock + 1000, nowFn ? nowFn() : 0); const body = JSON.parse(opts.body); const d = { name: p, fields: body.fields, updateTime: new Date(clock).toISOString() }; docs[p] = JSON.stringify(d); return { ok: true, status: 200, json: async () => JSON.parse(docs[p]) }; }
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
    w.fetch = cloud.fetchFor(dev, () => w.__now()); w.addEventListener('error', (e) => e.preventDefault());
    w.__spoken = []; w.speechSynthesis = { getVoices: () => [{ lang: 'sv-SE', name: 'Alva' }], speak(u) { w.__spoken.push(u.text); }, cancel() {}, onvoiceschanged: null }; w.SpeechSynthesisUtterance = function (t) { this.text = t; };
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

/* ---------- den vanliga appen som förälderns enhet ---------- */
async function parentDevice(cloud, seed, now) {
  const P = mk({ html: PROD_HTML, url: PROD_URL, dev: 'parent', cloud, seed, now }); await sleep(30);
  P.PA.DB.settings.family = FAM; P.PA.flushSave(); await P.PA.FAMILY.pull(); P.PA.load(); await P.PA.SYNC.refreshAll(); P.PA.rerender(); return P;
}
async function exitProd(P, cloud, seed, how = 'exit') {
  let reloaded = false; P.PA.TM.reload = () => { reloaded = true; }; const T = tools(P);
  if (how === 'exit') T.click(P.document.querySelector('#tmBar [data-tm-exit]'));
  else if (how === 'start') { P.PA.go('home'); const b = P.document.querySelector('#app [data-go="start"]'); if (b) T.click(b); }
  else if (how === 'back') { const ev = new P.Event('pageshow'); ev.persisted = true; P.dispatchEvent(ev); }
  const hash = P.location.hash; const stored = allStored(P);
  const P2 = mk({ html: PROD_HTML, url: PROD_URL + (how === 'drop' ? '' : hash), dev: 'parent-omladdad', cloud, seed, storage: stored, now: P.__now() }); await sleep(80); await until(() => P2.PA && P2.PA.SYNC.status !== 'off', 2000); await sleep(80);
  return { P2, reloaded, hash, stored };
}
const fsRequests = (cloud, from, dev) => cloud.log.slice(from).filter(x => x.dev === dev);

(async () => {
  try {
    /* ================= A. Åttan/Achieve, Bara prov och läxor – barnet spelar samtidigt ================= */
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 31);
      const k8 = C.PA.KIDS.find(k => k.id === 'k8'); const iso = (d) => new Date(C.__now() + d * DAY).toISOString().slice(0, 10);
      C.PA.DB.profiles.k8.exams = [{ id: 'e1', title: 'Algebraprov', date: iso(10), skillIds: ['forenkla', 'ekvation', 'multin', 'blandat'], deckIds: [] }];
      C.PA.DB.profiles.k8.removedDefaults = [...(C.PA.DB.profiles.k8.removedDefaults || []), ...((k8.workExams || []).map(x => x.id))];
      C.PA.DB.profiles.k8.settings.scope = 'exams'; C.PA.DB.profiles.k8.settings.scopeAt = C.__now(); C.PA.save();
      await childPlays(C, 'k8', 0.3, 5); await childPlays(C, 'k2', 0.3, 6); await childPlays(C, 'k4', 0.3, 7); C.__advance(DAY);
      const P = await parentDevice(cloud, 41, C.__now()); const A = cloud.prof('k8');
      ok(learnOf(P.PA.DB.profiles.k8) === learnOf(A), 'Åttan: förälderns enhet har det riktiga läget');
      ok(await enterTest(P, 'k8'), 'Åttan: Testa som Åttan startar i den vanliga appens föräldraläge');
      const before = P.PA.TM.before; const all0 = allStored(P); const logTm = cloud.log.length; const T = tools(P); const { $, click } = T; const D = v2tools(P, T); const r = rng(51);
      ok(same(before, all0), 'Åttan: ögonblicksbilden = all lagrad data (samma nycklar som appen alltid använt)');
      ok(/TESTLÄGE – inget sparas/.test($('#tmBar').textContent) && /ALGEBRAPROV/i.test($('#app').textContent) && /inför provet/.test($('#app').textContent) && P.PA.EXP.of(P.PA.KIDS.find(k => k.id === 'k8')) === 'achieve', 'Åttan: Achieve, Bara prov och läxor, provet – som Åttan ser det');
      ok(!$('#app [data-push]') && !$('#app [data-go="sync"]'), 'Åttan: påminnelser och synkkod finns inte under testet');
      const xp0 = P.PA.DB.profiles.k8.xp;
      click($('[data-v2="kor"]')); const played = []; let n = 0; while (P.PA.S && P.PA.S.v2 && $('#qcard') && n++ < 60) { const q = P.PA.S.queue[P.PA.S.i]; if (q.spec && q.cat !== 'learn') played.push(q.cat === 'word' ? 'ORD' : q.spec.cid); D.answer(() => r() < 0.35); P.__advance(4000); }
      const U = new Set(P.PA.V2.examCidsActive(P.PA.KIDS.find(k => k.id === 'k8'), P.PA.DB.profiles.k8.exams[0]));
      ok(played.length > 0 && played.every(c => U.has(c)), `Åttan: CORE bara provets områden (${[...new Set(played)].join(', ')})`);
      ok(/DAGENS PLAN KLAR|Klart/i.test($('#app').textContent), 'Åttan: KLAR');
      let flows = 0; for (let i = 0; i < 3; i++) { P.PA.go('home'); const f = $('[data-v2="flow"]'); if (!f) break; click(f); D.run(() => r() < 0.4, 60); flows++; }
      P.PA.go('home'); const tm = $('[data-v2="testa"]'); if (tm) { click(tm); D.run(() => r() < 0.3, 60); }
      ok(flows >= 1 && !!tm, `Åttan: FLOW (${flows}) och Testa mig spelade i testet`);
      info.push(`Åttan: typer ${JSON.stringify(D.log.types)}, Rescue ${D.log.rescueLearn}, FLOW ${flows}`);
      // barnet spelar SAMTIDIGT på sin enhet → B
      C.__advance(3600000); await childPlays(C, 'k8', 0.2, 61); const B = cloud.prof('k8');
      // förälderns enhet: synk, sparning, dold/synlig, nät borta/tillbaka – inget får skickas
      P.PA.save(); P.PA.SYNC.schedulePush('k8'); await P.PA.SYNC.refreshAll(); P.document.dispatchEvent(new P.Event('visibilitychange')); P.dispatchEvent(new P.Event('offline')); P.dispatchEvent(new P.Event('online')); await sleep(1700);
      ok(fsRequests(cloud, logTm, 'parent').length === 0, `Åttan: förälderns enhet skickade ingenting under testet (${fsRequests(cloud, logTm, 'parent').length})`);
      ok(same(allStored(P), all0), 'Åttan: lagrad data på förälderns enhet oförändrad under testet');
      ok(P.PA.DB.profiles.k8.xp > xp0 && hasTestDev(JSON.stringify(P.PA.DB.profiles.k8.le)), 'Åttan: testet ändrade bara kopian (XP och ~t-bevis i minnet)');
      const { P2, reloaded, hash } = await exitProd(P, cloud, 42);
      ok(reloaded && hash === '#foralder-tm1' && P2.document.querySelector('[data-pin]') && /Inget från testet sparades/.test(P2.document.body.textContent), 'Avsluta: kontroll byte för byte, omladdning, föräldraläget med beskedet');
      ok(learnOf(cloud.prof('k8')) === learnOf(B) && learnOf(P2.PA.DB.profiles.k8) === learnOf(B), 'Riktigt läge efter testet = BARNETS nya läge B (i familjens data och på förälderns enhet)');
      ok(learnOf(B) !== learnOf(A), 'förutsättning: barnet ändrade läget under testet');
      ok(!hasTestDev(cloud.snap()) && !hasTestDev(JSON.stringify(allStored(P2))), 'Inga testbevis någonstans');
      ok(cloud.writes('parent').filter(x => x.dev === 'parent').length === 0, `Förälderns enhet skrev aldrig något i familjens data under och före omladdningen (${cloud.writes('parent').filter(x => x.dev === 'parent').length})`);
      ok(P2.PA.DB.profiles.k8.xp === B.xp && cloud.prof('k8').xp === C.PA.DB.profiles.k8.xp, 'Belöningar: inga dubbletter');
      const cb = learnOf(C.PA.DB.profiles.k8); ok(await C.PA.SYNC.refresh('k8') === false && learnOf(C.PA.DB.profiles.k8) === cb, 'Barnets enhet: nästa synk ändrar inget');
      // vanlig användning efter testet: en riktig ändring på förälderns enhet synkas som vanligt
      { const n0 = cloud.log.length; P2.PA.DB.profiles.k4.settings.goal = 7; P2.PA.setKid('k4'); P2.PA.go('home'); P2.PA.save(); await sleep(1800);
        ok(cloud.writes('parent-omladdad', n0).some(x => x.path.endsWith('/k4')) && cloud.prof('k4').settings.goal === 7, 'Efter testet: förälderns riktiga ändringar synkas som vanligt'); }
    }

    /* ================= B. Väntande ändringar: skickas först – utan nät startar testet inte ================= */
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 32); await childPlays(C, 'k4', 0.2, 8); C.__advance(DAY);
      const P = await parentDevice(cloud, 43, C.__now());
      // en riktig ändring på förälderns enhet som ännu inte hunnit laddas upp
      P.PA.DB.profiles.k4.settings.goal = 9; P.PA.DB.profiles.k4.updatedAt = Date.now() + 5; P.PA.flushSave(); P.PA.SYNC.pending.add('k4');
      const cfg = P.PA.SYNC.cfg; P.PA.SYNC.cfg = { ...cfg, projectId: 'offline-test' };   // utan nät
      const d0 = allStored(P); unlock(P); tools(P).click(P.document.querySelector('[data-tab="k4"]')); tools(P).click(P.document.querySelector('[data-tm="start"]')); await sleep(300);
      ok(!P.PA.TM.on && /inte hunnit sparas/.test(P.document.body.textContent), 'Väntande ändring utan nät: testet startar inte (ärligt besked)');
      ok(P.PA.DB.profiles.k4.settings.goal === 9 && JSON.parse(allStored(P)['pluggappen.v1']).profiles.k4.settings.goal === 9, 'Väntande ändring: finns kvar och laddas upp senare');
      void d0;
      P.PA.SYNC.cfg = cfg; ok(await enterTest(P, 'k4'), 'Med nät: väntande ändringar skickas först, sedan startar testet');
      ok(cloud.prof('k4').settings.goal === 9, 'Väntande ändring: finns i familjens data innan testet börjar');
      const { P2 } = await exitProd(P, cloud, 44); ok(P2.PA.DB.profiles.k4.settings.goal === 9 && cloud.prof('k4').settings.goal === 9, 'Efter testet: den riktiga ändringen är kvar');
    }

    /* ================= C. Tvåan/Explore: aktiviteter, uppläsning, fel, KLAR, FLOW igen – ladda om mitt i ================= */
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 33); await childPlays(C, 'k2', 0.3, 9); C.__advance(DAY);
      const P = await parentDevice(cloud, 45, C.__now()); const A2 = cloud.prof('k2');
      ok(await enterTest(P, 'k2'), 'Tvåan: testläget startar'); const T = tools(P); const { $, click } = T; const D = v2tools(P, T); const r = rng(52); const all0 = allStored(P); const logTm = cloud.log.length;
            ok(P.PA.EXP.of(P.PA.KIDS.find(k => k.id === 'k2')) === 'explore' && /DAGENS ÄVENTYR|Dagens äventyr/i.test($('#app').textContent), 'Tvåan: Dagens äventyr');
      click($('[data-v2="kor"]')); let read = 0; let n = 0; while (P.PA.S && P.PA.S.v2 && $('#qcard') && n++ < 60) { const sp = $('#qcard [data-speak]') || $('#qcard .speak, #qcard [data-read]'); if (sp && read < 2) { click(sp); read++; } D.answer(() => r() < 0.45); P.__advance(4000); }
      ok(/KLAR|Klart|klar/i.test($('#app').textContent), 'Tvåan: KLAR');
      let flows = 0; for (let i = 0; i < 2; i++) { P.PA.go('home'); const f = $('[data-v2="flow"]'); if (!f) break; click(f); D.run(() => r() < 0.4, 40); flows++; }
      info.push(`Tvåan: typer ${JSON.stringify(D.log.types)}, Rescue ${D.log.rescueLearn}, uppläsning ${P.__spoken.length}, FLOW ${flows}`);
      ok(flows >= 1, `Tvåan: FLOW igen (${flows})`);
      ok(fsRequests(cloud, logTm, 'parent').length === 0 && same(allStored(P), all0), 'Tvåan: inget skickat, inget lagrat');
      const { P2 } = await exitProd(P, cloud, 46, 'drop');
      ok(!P2.PA.TM.on && learnOf(P2.PA.DB.profiles.k2) === learnOf(A2) && learnOf(cloud.prof('k2')) === learnOf(A2), 'Ladda om / stänga under testet: riktiga läget, inget test kvar');
    }

    /* ================= D. Fyran/Grow med en annan upplevelse i testet – bakåt ur cachen, byta barn ================= */
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 34); for (let d = 0; d < 2; d++) { await childPlays(C, 'k4', 0.55, 70 + d); C.__advance(DAY); }
      const P = await parentDevice(cloud, 47, C.__now()); const A4 = cloud.prof('k4');
      ok(await enterTest(P, 'k4', 'achieve'), 'Fyran: testa med en annan upplevelse (Achieve)');
      ok(P.PA.EXP.of(P.PA.KIDS.find(k => k.id === 'k4')) === 'achieve', 'Fyran: kopian kör Achieve');
      const lD = cloud.log.length; const T = tools(P); const D = v2tools(P, T); const r = rng(53); P.PA.go('home'); const go = T.$('[data-v2="kor"]'); if (go) { T.click(go); D.run(() => r() < 0.5, 60); }
      ok(fsRequests(cloud, lD, 'parent').length === 0, 'Fyran: inget skickat under testet');
      const b = await exitProd(P, cloud, 48, 'back');
      ok(b.reloaded && b.hash === '#foralder-tm1', 'Bakåt (sidan visas igen ur webbläsarens cache): testet avslutas');
      ok(b.P2.PA.EXP.of(b.P2.PA.KIDS.find(k => k.id === 'k4')) === 'grow' && learnOf(b.P2.PA.DB.profiles.k4) === learnOf(A4), 'Fyrans riktiga upplevelse (Grow) och läge orörda');
      // byta barn under ett nytt test
      const P3 = b.P2; P3.__advance(DAY); ok(await enterTest(P3, 'k4'), 'Fyran: nytt test'); const l3 = cloud.log.length; const T3 = tools(P3); const D3 = v2tools(P3, T3); const r3 = rng(54);
      P3.PA.go('home'); const rev = T3.$('[data-v2="revansch"]'); if (rev) { T3.click(rev); D3.run(() => r3() < 0.5, 60); } else { const g = T3.$('[data-v2="kor"]'); if (g) { T3.click(g); D3.run(() => r3() < 0.5, 60); } }
      info.push(`Fyran: Revansch ${rev ? 'ja' : 'nej'}, typer ${JSON.stringify(D3.log.types)}, utmaningar ${D3.log.challenge}`);
      ok(fsRequests(cloud, l3, P3.__dev).length === 0, 'Fyran: inget skickat under det andra testet');
      const c = await exitProd(P3, cloud, 49, 'start');
      ok(c.reloaded && c.hash === '#foralder-tm1' && learnOf(c.P2.PA.DB.profiles.k4) === learnOf(A4) && learnOf(cloud.prof('k4')) === learnOf(A4), 'Byta barn: testet avslutas, Fyrans läge orört');
      ok(!hasTestDev(cloud.snap()) && !hasTestDev(JSON.stringify(allStored(c.P2))), 'Inga testbevis i familjens data eller på enheten');
    }

    /* ===== E. Oberoende granskning 3.2 (BLOCKER): väntande ändringar slås ihop INNAN de laddas upp – aldrig en blind uppladdning ===== */
    // E1: förälderns enhet har en ändring för Fyran som inte hunnit laddas upp; Fyran har spelat på sin egen enhet EFTER förälderns
    //     senaste hämtning (läge B). Föräldern testar ett ANNAT barn. Familjens data ska ha B + förälderns ändring – aldrig A + ändringen.
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 35); await childPlays(C, 'k4', 0.2, 81); C.__advance(DAY);
      const P = await parentDevice(cloud, 50, C.__now()); const A = cloud.prof('k4');
      C.__advance(3600000); await childPlays(C, 'k4', 0.2, 82); const B = cloud.prof('k4');
      ok(learnOf(B) !== learnOf(A) && (B.le.log || []).length > (A.le.log || []).length, 'E1: barnet har spelat efter förälderns senaste hämtning (B ≠ A)');
      P.__advance(2 * 3600000); const cfg = P.PA.SYNC.cfg; P.PA.SYNC.cfg = { ...cfg, projectId: 'offline-test' };
      P.PA.setKid('k4'); P.PA.DB.profiles.k4.settings.goal = 9; P.PA.save(); await sleep(1800);   // uppladdningen misslyckas utan nät
      ok(P.PA.DB.profiles.k4.updatedAt > P.PA.DB.profiles.k4.syncedAt, 'E1: förälderns ändring väntar på uppladdning');
      P.PA.SYNC.cfg = cfg;   // nätet tillbaka – ingen hämtning har skett
      ok(await enterTest(P, 'k2'), 'E1: testet av ett annat barn startar när väntande ändringar kunnat slås ihop och laddas upp');
      const S = cloud.prof('k4'); const sLog = new Set((S.le.log || []).map(e => JSON.stringify(e)));
      ok((B.le.log || []).every(e => sLog.has(JSON.stringify(e))), 'E1: barnets nya bevis (B) finns kvar i familjens data – ingen tillbakarullning till A');
      ok(S.xp >= B.xp && Object.keys(S.words || {}).length >= Object.keys(B.words || {}).length, 'E1: barnets XP och ord (B) finns kvar');
      ok(S.settings.goal === 9, 'E1: förälderns väntande ändring finns också med');
      const l1 = cloud.log.length; const T = tools(P); const D = v2tools(P, T); const r = rng(83); P.PA.go('home'); const go = T.$('[data-v2="kor"]'); if (go) { T.click(go); D.run(() => r() < 0.4, 40); }
      ok(fsRequests(cloud, l1, 'parent').length === 0, 'E1: inget skickat under testet');
      const { P2 } = await exitProd(P, cloud, 51); await C.PA.SYNC.refresh('k4');
      ok(!hasTestDev(cloud.snap()) && learnOf(C.PA.DB.profiles.k4) === learnOf(cloud.prof('k4')), 'E1: barnets enhet och familjens data är samma riktiga läge efter testet');
      void P2;
    }
    // E2: radering på en annan enhet (tombstone) medan förälderns enhet har en gammal ändring som väntar: raderingen gäller.
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 36); await childPlays(C, 'k4', 0.2, 84); C.__advance(DAY);
      const P = await parentDevice(cloud, 52, C.__now());
      const cfg = P.PA.SYNC.cfg; P.PA.SYNC.cfg = { ...cfg, projectId: 'offline-test' };
      P.PA.setKid('k4'); P.PA.DB.profiles.k4.settings.goal = 9; P.PA.save(); await sleep(1800);
      ok(P.PA.DB.profiles.k4.updatedAt > P.PA.DB.profiles.k4.syncedAt, 'E2: förälderns gamla ändring väntar på uppladdning');
      C.__advance(3600000); await C.PA.deleteKidData('k4'); const tomb = cloud.prof('k4');
      ok(tomb && tomb.resetAt && !(tomb.le && (tomb.le.log || []).length), 'E2: Fyrans data är raderad på en annan enhet');
      P.__advance(2 * 3600000); P.PA.SYNC.cfg = cfg;
      ok(await enterTest(P, 'k2'), 'E2: testet av ett annat barn startar');
      const S = cloud.prof('k4');
      ok(S.resetAt === tomb.resetAt && !(S.le && (S.le.log || []).length) && !S.xp, 'E2: raderingen gäller – förälderns gamla kopia laddades inte upp över den');
      ok(P.PA.TM.before && !hasTestDev(cloud.snap()), 'E2: inga testbevis i familjens data');
      await exitProd(P, cloud, 53);
    }
    // E3 (granskningens SHOULD-FIX): något som ligger i uppladdningskön när testet ska börja tas aldrig tyst bort – testet startar inte.
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 37); await childPlays(C, 'k4', 0.2, 85); C.__advance(DAY);
      const P = await parentDevice(cloud, 54, C.__now());
      const orig = P.PA.TM.freshProd; P.PA.TM.freshProd = async (id) => { const res = await orig(id); P.PA.SYNC.pending.add('k4'); return res; };   // en uppladdning hamnar i kön precis innan testet
      unlock(P); tools(P).click(P.document.querySelector('[data-tab="k2"]')); tools(P).click(P.document.querySelector('[data-tm="start"][data-kid-id="k2"]:not([data-exp])')); await sleep(300);
      ok(!P.PA.TM.on && /håller på att synkas/.test(P.document.body.textContent), 'E3: väntande uppladdning när testet ska börja → testet startar inte (ärligt besked)');
      ok(P.PA.SYNC.pending.has('k4'), 'E3: den väntande uppladdningen finns kvar i kön');
      P.PA.TM.freshProd = orig;
    }
    // E4 (granskning 2, SHOULD-FIX): barnets enhet laddar upp B precis mellan förälderns hämtning och uppladdning. Uppladdningen är
    //     villkorad på den hämtade versionen → servern nekar, hämtning + sammanslagning görs om, och B finns kvar.
    {
      const cloud = mkCloud(); const C = await childDevice(cloud, 38); await childPlays(C, 'k4', 0.2, 86); C.__advance(DAY);
      const P = await parentDevice(cloud, 55, C.__now()); const A = cloud.prof('k4');
      const cfg = P.PA.SYNC.cfg; P.PA.SYNC.cfg = { ...cfg, projectId: 'offline-test' };
      P.PA.setKid('k4'); P.PA.DB.profiles.k4.settings.goal = 9; P.PA.save(); await sleep(1800); P.PA.SYNC.cfg = cfg;
      const orig = cloud.fetchFor('parent', () => P.__now()); let raced = false, B = null;
      P.fetch = async (u, o) => { if (!raced && o && String(o.method).toUpperCase() === 'PATCH' && /profiles\/k4/.test(String(u))) { raced = true; C.__advance(3600000); await childPlays(C, 'k4', 0.2, 87); B = cloud.prof('k4'); } return orig(u, o); };
      ok(await enterTest(P, 'k2'), 'E4: testet startar efter att uppladdningen gjorts om');
      const S = cloud.prof('k4'); const sLog = new Set((S.le.log || []).map(e => JSON.stringify(e)));
      ok(raced && B && learnOf(B) !== learnOf(A), 'E4: barnet laddade upp B mitt emellan');
      ok(cloud.log.some(x => x.dev === 'parent' && x.method === 'PATCH-NEKAD'), 'E4: förälderns första uppladdning nekades (versionen hade ändrats)');
      ok((B.le.log || []).every(e => sLog.has(JSON.stringify(e))) && S.xp >= B.xp, 'E4: barnets B finns kvar i familjens data');
      ok(S.settings.goal === 9, 'E4: förälderns ändring finns också med');
      await exitProd(P, cloud, 56);
    }
  } catch (e) { fails++; console.log('EXC', e.stack); }
  finally { try { fs.rmSync(path.join(DIST, 'preview'), { recursive: true, force: true }); } catch (e) { /* ignore */ } }
  for (const l of info) console.log('  ·', l);
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'PARENT TEST MODE PROD FAILED' : 'PARENT TEST MODE PROD OK'); process.exit(fails ? 1 : 0);
})();
