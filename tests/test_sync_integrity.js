/* Synkens integritet (3.2.x, ägarens beslut 27 oktober): en enhet med ett gammalt läge får aldrig skriva över nyare data.
   Granskningen av Testa som barnet visade att den VANLIGA synken laddade upp hela profilen utan att först hämta: en förälder som
   ändrade en inställning på en enhet som inte hämtat sedan barnet spelade skrev över barnets framsteg.
   SYNTETISK familj (testfixturen), en låtsad Firestore som enheterna delar (med Firestores villkorade skrivningar), fast klocka.
   Fall (ägarens lista):
     A  gammalt läge A på förälderns enhet, barnet spelar B på sin enhet, föräldern ändrar en inställning → B + inställningen
     B  något raderas på en annan enhet (eget prov, egen ordlista, avstängd ordlista) efter den gamla enhetens senaste hämtning;
        den gamla enheten ändrar något annat → raderingen står sig (och det går att slå på igen efteråt)
     C  väntande lokala ändringar medan nyare data finns i familjens data → hämta → slå ihop → villkorad skrivning
     D  familjens data ändras mellan hämtning och skrivning → villkoret nekar → hämta igen → slå ihop → försök igen
     E  två enheter ändrar olika saker samtidigt → båda ändringarna finns kvar, alla enheter hamnar i samma läge
     F  en enhet som varit utan nät kommer tillbaka efter mycket aktivitet på en annan enhet → ingen gammal helprofil skrivs över
     G  fel och nya försök: ingenting tas bort ur uppladdningskön förrän skrivningen bekräftats; nya försök sker av sig själva
   Varje fall kontrollerar bevisloggen, XP/diamanter, ord, Felboken, inställningar, upplevelsen och andra fält. */
'use strict';
const fs = require('fs'); const path = require('path');
const { JSDOM } = require('jsdom');
const { rng, T_FIXED, tools } = require('./le/childflow.js');
const { v2tools } = require('./le/v2driver.js');
const FIX = require('./test_fixture_family.json');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const info = []; const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const PROD_HTML = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
const URL0 = 'https://example.org/pluggappen/'; const FAM = 'test-fam-123';

/* ---------- låtsad Firestore med villkorade skrivningar ---------- */
function mkCloud() {
  const docs = {}; const log = []; let clock = T_FIXED; const hooks = [];
  const fetchFor = (dev, nowFn) => async (url, opts = {}) => {
    const method = String(opts.method || 'GET').toUpperCase(); url = String(url);
    if (url.includes('/projects/offline-test/')) throw new TypeError('Failed to fetch');   // utan nät
    const m = url.match(/\/documents\/(.+?)(\?|$)/); const p = m ? decodeURIComponent(m[1]) : null;
    for (const h of hooks.splice(0)) await h(dev, method, p);   // engångskrokar (t.ex. "en annan enhet hinner skriva precis nu")
    log.push({ dev, method, path: p || url.split('?')[0], at: log.length });
    if (!p || !/^families\/[^/]+\/profiles\//.test(p)) return { ok: false, status: 403, json: async () => ({}) };
    if (method === 'GET') { if (!docs[p]) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => JSON.parse(docs[p]) }; }
    if (method === 'PATCH') {
      const q = new URL(url).searchParams; const ut = q.get('currentDocument.updateTime'); const ex = q.get('currentDocument.exists');
      if ((ut !== null && (!docs[p] || JSON.parse(docs[p]).updateTime !== ut)) || (ex === 'false' && docs[p]) || (ex === 'true' && !docs[p])) { log.push({ dev, method: 'PATCH-NEKAD', path: p, at: log.length }); return { ok: false, status: 400, json: async () => ({ error: { status: 'FAILED_PRECONDITION' } }) }; }
      clock = Math.max(clock + 1000, nowFn ? nowFn() : 0); const body = JSON.parse(opts.body); const d = { name: p, fields: body.fields, updateTime: new Date(clock).toISOString().replace('Z', '123456Z') }; docs[p] = JSON.stringify(d); return { ok: true, status: 200, json: async () => JSON.parse(docs[p]) }; }
    return { ok: false, status: 400, json: async () => ({}) };
  };
  const prof = (kid) => { const d = docs[`families/${FAM}/profiles/${kid}`]; return d ? JSON.parse(JSON.parse(d).fields.json.stringValue) : null; };
  return { docs, log, hooks, fetchFor, prof };
}
function mk(cloud, dev, seed, now = T_FIXED) {
  const dom = new JSDOM(PROD_HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: URL0, beforeParse(w) {
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    w.Math.random = rng(seed); const RD = w.Date; let t = now; class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(t); } static now() { return t; } } w.Date = FD; w.__advance = (ms) => { t += ms; }; w.__now = () => t;
    w.fetch = cloud.fetchFor(dev, () => w.__now()); w.addEventListener('error', (e) => { e.preventDefault(); if (process.env.DBG) console.log('PAGEERR', dev, e.error && e.error.stack); });
    w.speechSynthesis = { getVoices: () => [], speak() {}, cancel() {}, onvoiceschanged: null }; w.SpeechSynthesisUtterance = function () {};
  } });
  const w = dom.window; w.__dev = dev; return w;
}
async function firstDevice(cloud, dev, seed) { const W = mk(cloud, dev, seed); await sleep(30); W.PA.DB.settings.family = FAM; W.PA.FAMILY.apply(FIX); W.PA.load(); await W.PA.FAMILY.push(); await W.PA.SYNC.refreshAll(); await settle(W); W.PA.rerender(); return W; }
async function device(cloud, dev, seed, now) { const W = mk(cloud, dev, seed, now); await sleep(30); W.PA.DB.settings.family = FAM; W.PA.FAMILY.apply(FIX); W.PA.load(); await W.PA.SYNC.refreshAll(); await settle(W); W.PA.rerender(); return W; }
const offline = (W) => { W.__cfg = W.PA.SYNC.cfg; W.PA.SYNC.cfg = { ...W.__cfg, projectId: 'offline-test' }; };
const online = (W) => { if (W.__cfg) W.PA.SYNC.cfg = W.__cfg; try { W.dispatchEvent(new W.Event('online')); } catch (e) { /* ignore */ } };
// vänta tills enhetens uppladdningskö är tom (eller tiden gått ut)
async function settle(W, ms = 4000) { const t0 = Date.now(); await sleep(1700); while ((W.PA.SYNC.pending.size || W.PA.SYNC.busy) && Date.now() - t0 < ms) await sleep(50); }
// barnet spelar ett riktigt pass; appen sparar och laddar upp själv (ingen handpåläggning)
async function play(W, kid, wrongP, seed) {
  const T = tools(W); const { $, click } = T; const D = v2tools(W, T); const r = rng(seed);
  W.PA.go('start'); click($(`[data-kid="${kid}"]`)); if ($('[data-pet]')) click($('[data-pet]'));
  const go = $('.go-btn[data-v2="kor"]') || $('[data-v2="kor"]') || $('[data-v2="flow"]'); if (go) { click(go); D.run(() => r() < wrongP, 60); }
  W.PA.go('start'); W.__advance(60000);
}
// en ändring som appen själv gör (föräldern i föräldraläget eller barnet): ändra, spara – appen laddar upp själv
function edit(W, kid, fn) { W.PA.setKid(kid); W.PA.go('home'); fn(W.PA.DB.profiles[kid]); W.PA.save(); }
const logKeys = (p) => new Set(((p && p.le && p.le.log) || []).map(e => JSON.stringify(e)));
const contains = (S, B) => { const s = logKeys(S); return [...logKeys(B)].every(k => s.has(k)); };
const wordsKept = (S, B) => Object.entries(B.words || {}).every(([id, w]) => S.words && S.words[id] && S.words[id].seen >= w.seen);
const mistakesKept = (S, B) => (B.mistakes || []).every(x => (S.mistakes || []).some(y => y.id === x.id) || ((S.mistakesCleared || {})[x.id] || 0) >= (x.at || 0));
const keptAll = (S, B, tag) => {
  ok(contains(S, B), `${tag}: barnets bevislogg (B) finns kvar (${logKeys(S).size} ⊇ ${logKeys(B).size})`);
  ok((S.xp || 0) >= (B.xp || 0) && (S.gems || 0) >= (B.gems || 0) - 0, `${tag}: XP/diamanter (B) finns kvar (${S.xp}/${S.gems} ≥ ${B.xp}/${B.gems})`);
  ok(wordsKept(S, B), `${tag}: orden (B) finns kvar`); ok(mistakesKept(S, B), `${tag}: Felboken (B) finns kvar`);
  ok((S.sessions || 0) >= (B.sessions || 0), `${tag}: antal pass (B) finns kvar`);
};
const canon = (v) => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const SKIP = new Set(['syncedAt', 'updatedAt', 'since', '_lx', '_lg']);
const core = (p) => JSON.stringify(canon(Object.fromEntries(Object.entries(p || {}).filter(([k]) => !SKIP.has(k)).map(([k, v]) => [k, k === 'le' && v ? { ...v, srv: undefined, dev: undefined, seq: undefined } : v]))));

(async () => {
  try {
    /* ================= A. gammalt läge + barnet spelar + föräldern ändrar en inställning ================= */
    {
      const cloud = mkCloud(); const C = await firstDevice(cloud, 'barn', 11); await play(C, 'k4', 0.3, 1); await settle(C);
      C.__advance(DAY); const P = await device(cloud, 'förälder', 12, C.__now());
      C.__advance(3600000); await play(C, 'k4', 0.3, 2); await settle(C); const B = cloud.prof('k4');
      ok(logKeys(B).size > logKeys(P.PA.DB.profiles.k4).size, 'A: barnet har spelat efter förälderns senaste hämtning');
      P.__advance(2 * 3600000); edit(P, 'k4', (p) => { p.settings.goal = 9; }); await settle(P);
      const S = cloud.prof('k4'); keptAll(S, B, 'A'); ok(S.settings.goal === 9, 'A: förälderns inställning finns med');
      await C.PA.SYNC.refresh('k4'); ok(C.PA.DB.profiles.k4.settings.goal === 9 && contains(C.PA.DB.profiles.k4, B), 'A: barnets enhet har båda efteråt');
    }

    /* ================= B. radering på en annan enhet står sig ================= */
    {
      const cloud = mkCloud(); const X = await firstDevice(cloud, 'förälder-1', 21);
      // ett eget prov och en egen ordlista finns (inlagda tidigare och synkade)
      edit(X, 'k8', (p) => { p.exams.push({ id: 'eget1', title: 'Eget prov', date: '2026-12-01', skillIds: [p.exams[0].skillIds[0]], deckIds: [] }); p.decks.push({ id: 'custom_eget', lang: 'sv', name: 'Egna ord', emoji: '🗂️', level: 1, builtin: false, words: [{ id: 'w1', w: 'hund', t: 'dog', e: '' }] }); p.enabledDecks.push('custom_eget'); });
      await settle(X);
      const Y = await device(cloud, 'förälder-2', 22, X.__now());   // den andra enheten hämtar – och hämtar sedan inte mer
      ok(Y.PA.DB.profiles.k8.exams.some(e => e.id === 'eget1') && Y.PA.DB.profiles.k8.decks.some(d => d.id === 'custom_eget'), 'B: den andra enheten har provet och ordlistan');
      const def = (X.PA.DB.profiles.k4.enabledDecks || []).find(id => !String(id).startsWith('custom')); ok(!!def, 'B: Mellan har en inbyggd ordlista påslagen');
      X.__advance(3600000);
      // radera på X – samma sätt som föräldraläget gör det
      edit(X, 'k8', (p) => { p.exams = p.exams.filter(x => x.id !== 'eget1'); p.removedDefaults = [...(p.removedDefaults || []), 'eget1']; p.decks = p.decks.filter(x => x.id !== 'custom_eget'); p.enabledDecks = p.enabledDecks.filter(x => x !== 'custom_eget'); });
      edit(X, 'k4', (p) => { p.enabledDecks = p.enabledDecks.filter(x => x !== def); p.removedDefaults = [...(p.removedDefaults || []), def]; });
      await settle(X);
      // den gamla enheten ändrar något annat
      Y.__advance(2 * 3600000); edit(Y, 'k8', (p) => { p.settings.goal = 12; }); edit(Y, 'k4', (p) => { p.settings.sprint = 6; }); await settle(Y);
      const S8 = cloud.prof('k8'), S4 = cloud.prof('k4');
      ok(!S8.exams.some(e => e.id === 'eget1'), 'B: det raderade provet kommer inte tillbaka');
      ok(!S8.decks.some(d => d.id === 'custom_eget') && !S8.enabledDecks.includes('custom_eget'), 'B: den raderade ordlistan kommer inte tillbaka');
      ok(!S4.enabledDecks.includes(def), 'B: den avstängda ordlistan förblir avstängd');
      ok(S8.settings.goal === 12 && S4.settings.sprint === 6, 'B: den gamla enhetens andra ändringar finns med');
      // och efter att båda hämtat: samma läge, raderingen står sig även på den gamla enheten
      await Y.PA.SYNC.refreshAll(); await X.PA.SYNC.refreshAll(); await settle(Y); await settle(X);
      ok(!Y.PA.DB.profiles.k8.exams.some(e => e.id === 'eget1') && !Y.PA.DB.profiles.k4.enabledDecks.includes(def), 'B: den gamla enheten har raderingen efteråt');
      // slå på igen (på den gamla enheten) – det ska gå, och stå sig
      Y.__advance(3600000); edit(Y, 'k4', (p) => { p.enabledDecks = [...p.enabledDecks, def]; p.removedDefaults = (p.removedDefaults || []).filter(x => x !== def); }); await settle(Y);
      await X.PA.SYNC.refresh('k4'); await settle(X);
      ok(cloud.prof('k4').enabledDecks.includes(def) && X.PA.DB.profiles.k4.enabledDecks.includes(def), 'B: en ordlista som slås på igen förblir påslagen');
    }

    /* ================= C. väntande ändring + nyare data i familjens data ================= */
    {
      const cloud = mkCloud(); const C = await firstDevice(cloud, 'barn', 31); await play(C, 'k2', 0.3, 3); await settle(C);
      C.__advance(DAY); const P = await device(cloud, 'förälder', 32, C.__now());
      offline(P); edit(P, 'k2', (p) => { p.settings.goal = 7; p.settings.tts = false; }); await sleep(1800);
      ok(P.PA.DB.profiles.k2.updatedAt > P.PA.DB.profiles.k2.syncedAt, 'C: förälderns ändring väntar');
      C.__advance(3600000); await play(C, 'k2', 0.3, 4); await settle(C); const B = cloud.prof('k2');
      P.__advance(2 * 3600000); const l0 = cloud.log.length; online(P); P.PA.SYNC.schedulePush('k2'); await settle(P, 8000);
      const mine = cloud.log.slice(l0).filter(x => x.dev === 'förälder' && /\/k2$/.test(x.path)).map(x => x.method);
      ok(mine.indexOf('GET') >= 0 && mine.indexOf('GET') < mine.lastIndexOf('PATCH'), `C: hämtning före skrivning (${mine.join(' → ')})`);
      const S = cloud.prof('k2'); keptAll(S, B, 'C'); ok(S.settings.goal === 7 && S.settings.tts === false, 'C: förälderns ändringar finns med');
    }

    /* ================= D. ändring mellan hämtning och skrivning ================= */
    {
      const cloud = mkCloud(); const C = await firstDevice(cloud, 'barn', 41); await play(C, 'k8', 0.3, 5); await settle(C);
      C.__advance(DAY); const P = await device(cloud, 'förälder', 42, C.__now());
      // nästa gång förälderns enhet skriver Äldres profil hinner barnet spela och ladda upp precis innan
      let raced = false, B = null; const hook = async (dev, method, p) => { if (!raced && dev === 'förälder' && method === 'PATCH' && /\/k8$/.test(p || '')) { raced = true; C.__advance(3600000); await play(C, 'k8', 0.3, 6); C.PA.flushSave(); await (C.PA.SYNC.flush ? C.PA.SYNC.flush() : C.PA.SYNC.push('k8')); B = cloud.prof('k8'); } else cloud.hooks.push(hook); };
      cloud.hooks.push(hook);
      P.__advance(2 * 3600000); edit(P, 'k8', (p) => { p.settings.goal = 15; }); await settle(P, 8000); cloud.hooks.length = 0;
      ok(raced && B && logKeys(B).size > 0, 'D: barnet laddade upp mitt emellan');
      ok(cloud.log.some(x => x.dev === 'förälder' && x.method === 'PATCH-NEKAD'), 'D: förälderns villkorade skrivning nekades');
      const S = cloud.prof('k8'); keptAll(S, B, 'D'); ok(S.settings.goal === 15, 'D: förälderns ändring kom med vid det nya försöket');
      ok(!P.PA.SYNC.pending.size && P.PA.DB.profiles.k8.updatedAt <= P.PA.DB.profiles.k8.syncedAt, 'D: inget kvar i kön efteråt');
    }

    /* ================= E. två enheter ändrar olika saker samtidigt ================= */
    {
      const cloud = mkCloud(); const P1 = await firstDevice(cloud, 'förälder-1', 51); const P2 = await device(cloud, 'förälder-2', 52, P1.__now()); const C = await device(cloud, 'barn', 53, P1.__now());
      P1.__advance(60000); P2.__advance(60000); C.__advance(60000);
      edit(P1, 'k4', (p) => { p.settings.goal = 11; }); edit(P2, 'k4', (p) => { p.settings.sprint = 5; p.paper = 'linjerat'; }); edit(C, 'k4', (p) => { p.pet = 'uggla'; });
      await Promise.all([settle(P1, 8000), settle(P2, 8000), settle(C, 8000)]);
      const S = cloud.prof('k4');
      ok(S.settings.goal === 11 && S.settings.sprint === 5 && S.paper === 'linjerat' && S.pet === 'uggla', `E: alla tre ändringarna finns kvar (mål ${S.settings.goal}, sprint ${S.settings.sprint}, papper ${S.paper}, djur ${S.pet})`);
      for (const W of [P1, P2, C]) { await W.PA.SYNC.refresh('k4'); await settle(W); }
      const cs = [P1, P2, C].map(W => core(W.PA.DB.profiles.k4)); ok(cs[0] === cs[1] && cs[1] === cs[2] && cs[0] === core(cloud.prof('k4')), 'E: alla enheter hamnar i samma läge som familjens data');
      // upplevelsen (med tidsstämpel) och en inställning utan: senaste valet gäller, inget annat går förlorat
      P1.__advance(60000); P2.__advance(120000);
      edit(P1, 'k4', (p) => { p.settings.exp = 'achieve'; p.settings.expAt = P1.__now(); }); edit(P2, 'k4', (p) => { p.settings.exp = 'explore'; p.settings.expAt = P2.__now(); p.settings.timer = true; });
      await Promise.all([settle(P1, 8000), settle(P2, 8000)]);
      const S2 = cloud.prof('k4'); ok(S2.settings.exp === 'explore' && S2.settings.timer === true && S2.settings.goal === 11, `E: senaste upplevelsevalet gäller och inget annat försvinner (${S2.settings.exp})`);
    }

    /* ================= F. enhet utan nät länge, mycket aktivitet på en annan ================= */
    {
      const cloud = mkCloud(); const C = await firstDevice(cloud, 'barn', 61); await play(C, 'k2', 0.3, 7); await settle(C);
      const T2 = await device(cloud, 'surfplatta', 62, C.__now()); offline(T2);
      for (let d = 0; d < 2; d++) { T2.__advance(DAY); await play(T2, 'k2', 0.4, 20 + d); }   // spelar utan nät
      await sleep(1800); const L = T2.PA.DB.profiles.k2;
      for (let d = 0; d < 3; d++) { C.__advance(DAY); await play(C, 'k2', 0.3, 30 + d); await settle(C); }
      const B = cloud.prof('k2'); T2.__advance(DAY); online(T2); T2.PA.SYNC.schedulePush('k2'); await settle(T2, 8000);
      const S = cloud.prof('k2'); keptAll(S, B, 'F (den andra enheten)'); keptAll(S, L, 'F (enheten som var utan nät)');
      const offXp = (L.since && L.since.xp) || 0; ok(offXp > 0 && (S.xp || 0) >= (B.xp || 0) + offXp, `F: XP från båda enheterna (${S.xp} ≥ ${B.xp} + ${offXp})`);
    }

    /* ================= G. fel och nya försök ================= */
    {
      const cloud = mkCloud(); const P = await firstDevice(cloud, 'förälder', 71);
      offline(P); edit(P, 'k8', (p) => { p.settings.goal = 13; }); await sleep(2000);
      ok(P.PA.SYNC.pending.has('k8'), 'G: misslyckad uppladdning ligger kvar i kön');
      ok(cloud.prof('k8').settings.goal !== 13, 'G: inget skrivet utan nät');
      online(P); await settle(P, 12000);
      ok(cloud.prof('k8').settings.goal === 13 && !P.PA.SYNC.pending.has('k8'), 'G: nytt försök av sig självt när nätet är tillbaka – och först då lämnar den kön');
      // nekad skrivning gång på gång (en annan enhet skriver hela tiden): begränsat antal försök, sedan ligger den kvar i kön
      const C = await device(cloud, 'barn', 72, P.__now()); let n = 0; const spam = async (dev, method, p) => { if (dev === 'förälder' && method === 'PATCH' && /\/k8$/.test(p || '') && n < 50) { n++; C.__advance(1000); edit(C, 'k8', (q) => { q.settings.sprint = 4 + (n % 3); }); C.PA.flushSave(); await (C.PA.SYNC.flush ? C.PA.SYNC.flush() : C.PA.SYNC.push('k8')); } cloud.hooks.push(spam); };
      cloud.hooks.push(spam); P.__advance(60000); edit(P, 'k8', (p) => { p.settings.goal = 14; }); await sleep(2500); cloud.hooks.length = 0;
      const tries = cloud.log.filter(x => x.dev === 'förälder' && x.method === 'PATCH-NEKAD').length;
      ok(tries >= 1 && tries <= 5, `G: begränsat antal försök i en omgång (${tries})`);
      ok(P.PA.SYNC.pending.has('k8') || cloud.prof('k8').settings.goal === 14, 'G: ändringen ligger kvar i kön (eller kom fram) – den försvinner aldrig');
      await settle(P, 15000); ok(cloud.prof('k8').settings.goal === 14, 'G: kommer fram när den andra enheten slutat skriva');
    }

    /* ================= H. klockor som går fel (ägarens lista: klocka/tidsstämpel) ================= */
    {
      const cloud = mkCloud(); const C = await firstDevice(cloud, 'barn', 81); await play(C, 'k4', 0.3, 40); await settle(C);
      const SLOW = await device(cloud, 'efter', 82, C.__now() - DAY);          // en enhet vars klocka går ett dygn efter
      const FAST = await device(cloud, 'före', 83, C.__now() + 2 * DAY);       // och en vars klocka går två dygn före
      edit(FAST, 'k4', (p) => { p.settings.goal = 21; }); await settle(FAST);
      edit(SLOW, 'k4', (p) => { p.settings.sprint = 3; }); await settle(SLOW, 8000);
      C.__advance(3600000); await play(C, 'k4', 0.3, 41); await settle(C, 8000); const B = cloud.prof('k4');
      const S = cloud.prof('k4'); ok(S.settings.goal === 21 && S.settings.sprint === 3, `H: ändringar från enheter med fel klocka kommer fram och står sig (mål ${S.settings.goal}, sprint ${S.settings.sprint})`);
      await SLOW.PA.SYNC.refresh('k4'); await FAST.PA.SYNC.refresh('k4');
      ok(contains(SLOW.PA.DB.profiles.k4, B) && contains(FAST.PA.DB.profiles.k4, B), 'H: båda enheterna får barnets nya bevis trots klockskillnaden');
      edit(SLOW, 'k4', (p) => { p.settings.tts = false; }); await settle(SLOW, 8000); keptAll(cloud.prof('k4'), B, 'H'); ok(cloud.prof('k4').settings.tts === false, 'H: enheten som går efter kan ändra igen');
    }

    /* ================= Återgång (rollback): profilernas format är oförändrat ================= */
    {
      const cloud = mkCloud(); const C = await firstDevice(cloud, 'barn', 91); await play(C, 'k2', 0.3, 50); await settle(C);
      const keys = Object.keys(cloud.prof('k2')); ok(!keys.includes('syncBase') && !keys.some(k => /^_base|docTime/.test(k)), `rollback: inga nya fält i barnets profil (${keys.length} fält)`);
      ok(C.PA.DB.syncBase && C.PA.DB.syncBase.k2 && C.PA.DB.syncBase.k2.t, 'basen (senast kända serverversion) sparas bara på enheten');
    }
  } catch (e) { fails++; console.log('EXC', e.stack); }
  for (const l of info) console.log('  ·', l);
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'SYNC INTEGRITY TEST FAILED' : 'SYNC INTEGRITY TEST OK'); process.exit(fails ? 1 : 0);
})();
