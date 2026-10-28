/* 3.7 Product Learning Loop v1 – privata observationer (riktiga appen i jsdom, SYNTETISK familj, fast klocka, låtsad Firestore).
   · av som standard; på per barn; inga namn, inga skrivna svar, inga koder; pseudonym
   · Testa som barnet och automatiserade webbläsare registreras aldrig; testläget rör inte lagringen
   · lärandet, belöningarna och schemat är identiska med observationer på och av; ett fel i observationerna stoppar inget
   · pass: start, uppgifter, slut, uttrycklig utgång, okänt utfall efter omladdning; tid bara i förgrunden
   · erbjudanden och val efter dagens pass; tekniska fel
   · moln: satser, utan nät, dubbletter och ordning, 403 (regler inte publicerade), flera enheter, två barn samtidigt
   · lagringstid, radering (också utan nät och på en annan enhet), av/på, full kö
   · export: sammanfattning per profil med nämnare, förbehåll; exemplet i tests/obs_example_export.json */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs'); const path = require('path');
const { mkWin, tools, FIX, T_FIXED } = require('./le/childflow.js');
const { toStart, v2tools } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000; const KEY = 'pluggappen.obs.v1';
const SALT = 'c0ffee'.repeat(3).slice(0, 16);

async function boot(opts = {}) { const w = mkWin({ seed: opts.seed || 7, fixedClock: true, storage: opts.storage || null }); await sleep(40); const T = tools(w); const PA = T.PA(); if (!opts.storage) { PA.FAMILY.apply(FIX); PA.load(); } PA.rerender(); return { w, T, PA, D: v2tools(w, T), OBS: w.OBS }; }
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const consent = (PA, id, on = true, days = 30) => { const p = PA.DB.profiles[id]; p.settings.obs = { ...(p.settings.obs || {}), on, salt: (p.settings.obs || {}).salt || SALT, days, at: Date.now() }; p.settings.obsAt = Date.now(); PA.save(); };
const queue = (w) => { try { return JSON.parse(w.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const kor = (b, id, wrong = () => false) => { openKid(b.T, id); if (!b.T.$('.go-btn[data-v2="kor"]')) { b.w.__advance(DAY); openKid(b.T, id); } b.T.click(b.T.$('.go-btn[data-v2="kor"]')); return b.D.run(wrong); };   // dagens pass redan klart: nästa dygn
const ALLOWED = { ss: ['s', 'm', 'x', 'po', 'g', 'n', 'b', 'c'], it: ['s', 'q', 'c', 'f', 'ok', 'h', 'r', 'x', 'v'], se: ['s', 'o', 'a', 'p', 'am', 'tq'], of: ['w', 's', 'bt'], sl: ['w', 'a', 'cd'], er: ['w', 'n'] };

/* låtsad Firestore för observationssatserna (REST: commit, lista, radera); mode: 'ok' | '403' | 'offline' */
function mkCloud() {
  const docs = {}; const st = { mode: 'ok', calls: 0 };
  const fetch = async (url, opts = {}) => {
    st.calls++; const method = String(opts.method || 'GET').toUpperCase(); url = String(url);
    if (st.mode === 'offline') throw new TypeError('Failed to fetch');
    const deny = { ok: false, status: 403, json: async () => ({ error: { status: 'PERMISSION_DENIED' } }) };
    if (/documents:commit/.test(url)) {
      const body = JSON.parse(opts.body); const wr = body.writes[0]; const name = wr.update.name; const id = name.split('/').pop();
      if (!/\/obs\//.test(name)) return deny; if (st.mode === '403') return deny;
      if (wr.currentDocument && wr.currentDocument.exists === false && docs[id]) return { ok: false, status: 409, json: async () => ({ error: { status: 'ALREADY_EXISTS' } }) };
      docs[id] = { fields: wr.update.fields }; return { ok: true, status: 200, json: async () => ({ writeResults: [{}] }) };
    }
    const m = url.match(/\/documents\/(.+?)(\?|$)/); const p = m ? decodeURIComponent(m[1]) : '';
    if (!/\/obs(\/|$)/.test(p) || st.mode === '403') return deny;
    if (method === 'DELETE') { delete docs[p.split('/').pop()]; return { ok: true, status: 200, json: async () => ({}) }; }
    if (/\/obs$/.test(p)) return { ok: true, status: 200, json: async () => ({ documents: Object.entries(docs).map(([id, d]) => ({ name: `projects/x/databases/(default)/documents/${p}/${id}`, fields: d.fields })) }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { docs, st, fetch };
}
// Kopplar en enhet till den låtsade molnet utan att starta profilsynken (passen körs utan synk, uppladdningen prövas för sig)
const connect = (b, cloud) => { b.PA.SYNC.cfg = { projectId: 'demo', apiKey: 'k' }; b.PA.DB.settings.family = 'famsynthetic01'; b.w.fetch = cloud.fetch; b.OBS.cloudOff = false; b.PA.SYNC.lastPull = Object.fromEntries(b.PA.KIDS.map(k => [k.id, Date.now()])); };   // som en synkad enhet
const disconnect = (b) => { b.PA.SYNC.cfg = null; };

(async () => {
  try {
    void ('== test 1'); /* 1. Av som standard */
    { const b = await boot(); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]'));
      ok(b.w.localStorage.getItem(KEY) === null && !(b.OBS.q && b.OBS.q.ev.length), 'av som standard: inget registreras, ingen nyckel i lagringen');
      ok(!b.PA.DB.profiles.k8.settings.obs, 'av som standard: ingen inställning finns'); }

    void ('== test 2'); /* 2. På: pass, uppgifter, slut – bara tillåtna fält, inga namn, inga skrivna svar */
    { const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8', (it) => it.cat !== 'learn' && Math.random() < 0.4); b.T.click(b.T.$('[data-go="home"]'));
      const q = queue(b.w); const ev = q ? q.ev : []; const y = (t) => ev.filter(e => e.y === t);
      ok(y('ss').length === 1 && y('se').length === 1 && y('it').length >= 3, `på: ett pass med start, uppgifter och slut (${ev.map(e => e.y).join(',')})`);
      ok(y('se')[0] && y('se')[0].o === 'done' && y('se')[0].a === y('it').length, 'slutet: avslutat, rätt antal inlämnade');
      const bad = ev.filter(e => Object.keys(e).some(k => !['i', 'y', 't', 'k', '_u', '_b', ...(ALLOWED[e.y] || [])].includes(k)));
      ok(!bad.length, `bara tillåtna fält (${bad.slice(0, 2).map(e => JSON.stringify(e)).join(' ')})`);
      const raw = b.w.localStorage.getItem(KEY); const kid = b.PA.KIDS.find(k => k.id === 'k8');
      ok(!raw.includes(kid.name) && !raw.includes('"k8"') && !/zzqx|987654/i.test(raw) && !raw.includes('famsynthetic'), 'inga namn, inget barn-id i klartext, inga skrivna svar, ingen familj');
      ok(ev.every(e => /^p[0-9a-f]{12}$/.test(e.k)), 'pseudonym på alla händelser');
      ok(y('ss')[0].b && /^v3\.7\.0/.test(y('ss')[0].b), `appversion på passets start (${y('ss')[0].b})`); }

    void ('== test 3'); /* 3. Lärande, belöningar och schema identiska med observationer på och av */
    { const run = async (on) => { const b = await boot({ seed: 21 }); if (on) consent(b.PA, 'k8'); for (let d = 0; d < 2; d++) { kor(b, 'k8', (it) => it.cat !== 'learn' && b.D.log.items % 3 === 0); b.T.click(b.T.$('[data-go="home"]')); b.w.__advance(DAY); }
        const p = JSON.parse(JSON.stringify(b.PA.DB.profiles.k8)); delete p.settings.obs; delete p.settings.obsAt; delete p.updatedAt; return JSON.stringify(p).split(b.PA.LE.devBase()).join('DEV'); };   // enhetens id är slumpat per fönster (crypto) – jämförs utan det
      const a = await run(false), c = await run(true); ok(a === c, 'profilen (motor, belöningar, schema, Felbok) är byte för byte densamma med observationer på och av'); }

    void ('== test 4'); /* 4. Testa som barnet: ingenting registreras och lagringen rörs inte (hela flödet med riktig isolering prövas också i
       test_parent_test_mode_prod.js, med observationer på för Åttan) */
    { const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]'));
      openKid(b.T, 'k8'); const before = b.w.localStorage.getItem(KEY); const n0 = b.OBS.q.ev.length; b.PA.TM.on = { kidId: 'k8', name: 'test' }; b.PA.go('home');
      const g = b.T.$('.go-btn[data-v2="kor"]') || b.T.$('[data-v2="flow"]'); if (g) { b.T.click(g); b.D.run(() => false); }
      b.OBS.record(b.PA.KIDS.find(k => k.id === 'k8'), 'ss', { s: 'tm' }); b.OBS.save(); b.OBS.prune();
      ok(b.w.localStorage.getItem(KEY) === before && b.OBS.q.ev.length === n0 && !b.OBS.q.ev.some(e => e.s === 'tm'), 'Testa som barnet (TM.on): inga händelser och lagringen rörs inte – inget kan senare hamna i uppladdningskön');
      b.PA.TM.on = null; }

    void ('== test 5'); /* 5. Automatiserad webbläsare (skärmdumpar, layouttest) och förhandsvisning registreras aldrig */
    { const b = await boot(); consent(b.PA, 'k8'); Object.defineProperty(b.w.navigator, 'webdriver', { value: true, configurable: true }); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]'));
      ok(!(b.OBS.q && b.OBS.q.ev.length) && b.w.localStorage.getItem(KEY) === null, 'navigator.webdriver: inga händelser');
      Object.defineProperty(b.w.navigator, 'webdriver', { value: false, configurable: true }); b.w.PLUGG_NO_OBS = true; kor(b, 'k8'); ok(!(b.OBS.q && b.OBS.q.ev.length), 'PLUGG_NO_OBS: inga händelser'); }

    void ('== test 6'); /* 6. Uttrycklig utgång och okänt utfall (omladdning) – aldrig "avbrutet" */
    { const b = await boot(); consent(b.PA, 'k8'); openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); b.D.answer(() => false); b.D.answer(() => false);
      b.T.click(b.T.$('[data-go]')); const se = b.OBS.q.ev.filter(e => e.y === 'se'); const its = b.OBS.q.ev.filter(e => e.y === 'it').length;
      ok(se.length === 1 && se[0].o === 'exit' && its >= 1 && se[0].a === its && se[0].p === its + 1, `uttrycklig utgång: lämnat, inlämnade = uppgiftshändelser, en visad men inte inlämnad (${JSON.stringify(se[0])}, ${its} uppgifter)`);
      openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); b.D.answer(() => false); b.PA.flushSave && b.PA.flushSave();
      const storage = {}; for (let i = 0; i < b.w.localStorage.length; i++) { const k = b.w.localStorage.key(i); storage[k] = b.w.localStorage.getItem(k); }
      const b2 = await boot({ storage }); const s = b2.OBS.summarize(b2.OBS.load().ev); const pr = Object.values(s.profiler)[0];
      ok(pr && pr.pass.started === 2 && pr.pass.exited === 1 && pr.pass.outcomeUnknown === 1 && pr.pass.completed === 0, `efter omladdning: ett okänt utfall, ett lämnat (${JSON.stringify(pr && pr.pass)})`);
      ok(!/avbrut|abandon/i.test(JSON.stringify(s.profiler)) && s.forbehall.some(x => /okänt utfall/.test(x) && /aldrig som avbrutna/.test(x)), 'okänt utfall kallas aldrig avbrutet'); }

    void ('== test 7'); /* 7. Tid bara i förgrunden; ett långt obrutet intervall märks osäkert */
    { const b = await boot(); consent(b.PA, 'k8'); const vis = (v) => { Object.defineProperty(b.w.document, 'visibilityState', { value: v, configurable: true }); b.w.document.dispatchEvent(new b.w.Event('visibilitychange')); };
      openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); b.w.__advance(2 * 60000); vis('hidden'); b.w.__advance(45 * 60000); vis('visible'); b.w.__advance(1 * 60000); b.D.run(() => false);
      let se = b.OBS.q.ev.filter(e => e.y === 'se').pop(); ok(se && se.am === '<5' && se.tq === 'fg', `förgrund 2 + 1 min (under 5), 45 min i bakgrunden räknas inte (${se && se.am}, ${se && se.tq})`);
      openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="flow"]') || b.T.$('.go-btn[data-v2="kor"]') || b.T.$('[data-v2="flow"]')); ok(!!(b.PA.S && b.PA.S.v2 && !b.PA.S.v2.ended), 'förutsättning: ett andra pass startade'); if (b.PA.S && b.PA.S.v2 && !b.PA.S.v2.ended) { b.w.__advance(40 * 60000); b.D.run(() => false); se = b.OBS.q.ev.filter(e => e.y === 'se').pop(); ok(se && se.tq === 'u', `40 min utan signal: tiden märks osäker (${se && se.tq})`); }
      const pr = Object.values(b.OBS.summarize(b.OBS.q.ev).profiler)[0]; ok(Object.values(pr.aktivTid.passPerIntervallMinuter).reduce((a, x) => a + x, 0) >= 1 && /Ingen tid per uppgift/.test(pr.aktivTid.notering) && /fokus, förmåga eller motivation/.test(pr.aktivTid.notering), 'exporten: bara säker tid, i grova intervall, aldrig per uppgift, tolkas inte'); }

    void ('== test 8'); /* 8. Erbjudanden och val efter dagens pass (med nämnare i exporten) */
    { const c = { v: 1, updatedAt: 1, packs: [], work: [{ id: 'a1', kid: 'k8', type: 'exam', title: 'Algebraprov', date: new Date(T_FIXED + 10 * DAY).toISOString().slice(0, 10), skills: ['multin', 'forenkla', 'blandat'] }] };
      const b = await boot(); b.PA.FAMILY.applyContent(c); consent(b.PA, 'k8'); kor(b, 'k8', () => true); b.T.click(b.T.$('[data-go="home"]')); openKid(b.T, 'k8');
      const of = b.OBS.q.ev.filter(e => e.y === 'of'); ok(of.some(e => e.w === 'klar') && of.some(e => e.w === 'home'), `erbjudanden på KLAR och startsidan (${of.map(e => e.w + ':' + JSON.stringify(e.bt)).join(' ')})`);
      const n0 = of.length; b.T.click(b.T.$('[data-tab]') || b.T.$('body')); openKid(b.T, 'k8'); openKid(b.T, 'k8'); ok(b.OBS.q.ev.filter(e => e.y === 'of').length === n0, 'samma erbjudande igen: ingen ny händelse (inte per omritning)');
      const row = b.T.$('.upcoming [data-v2="mission"]'); ok(!!row, 'förutsättning: raden erbjuder Kör efter dagens pass (fel kvar)'); if (row) { b.T.click(row); const sl = b.OBS.q.ev.filter(e => e.y === 'sl').pop(); ok(sl && sl.w === 'rad' && sl.a === 'mission' && sl.cd === 1, `val: Kör på raden efter dagens pass (${JSON.stringify(sl)})`); b.D.run(() => false); }
      const pr = Object.values(b.OBS.summarize(b.OBS.q.ev).profiler)[0]; ok(pr.fortsattning.erbjudanden.hem + pr.fortsattning.erbjudanden.klar >= 1 && typeof pr.fortsattning.valEfterDagensPass === 'object', 'exporten: erbjudanden och val efter dagens pass'); }

    void ('== test 9'); /* 9. Tekniskt fel: bara plats och typ, aldrig meddelandet */
    { const b = await boot(); consent(b.PA, 'k8'); openKid(b.T, 'k8'); b.PA.V2.safe(() => { throw new TypeError('hemligt innehåll i meddelandet'); }, 'test-plats', null);
      const er = b.OBS.q.ev.filter(e => e.y === 'er'); ok(er.length === 1 && er[0].w === 'test-plats' && er[0].n === 'TypeError' && !JSON.stringify(er).includes('hemligt'), `tekniskt fel utan meddelande (${JSON.stringify(er)})`);
      for (let i = 0; i < 40; i++) b.PA.V2.safe(() => { throw new Error('x'); }, 'loop', null); ok(b.OBS.q.ev.filter(e => e.y === 'er').length <= 20, 'högst 20 fel per dygn'); }

    void ('== test 10'); /* 10. Moln: satser, igen utan dubbletter, 403 (reglerna inte publicerade), utan nät */
    { const cloud = mkCloud(); const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); await sleep(10); connect(b, cloud);
      const n = b.OBS.q.ev.length; const sent = await b.OBS.flush(); const ids = Object.keys(cloud.docs);
      ok(sent === n && ids.length === 1 && b.OBS.DOC_RE.test(ids[0]) && b.OBS.q.ev.every(e => e._u), `en sats med alla händelser (${sent}/${n}, ${ids.join(',')})`);
      const doc = cloud.docs[ids[0]].fields; ok(Object.keys(doc).sort().join(',') === 'json,k,n,t,v' && !/_u|_b/.test(doc.json.stringValue), 'satsens fält som reglerna kräver, inga interna fält');
      ok((await b.OBS.flush()) === 0 && Object.keys(cloud.docs).length === 1, 'igen: inget skickas två gånger');
      // svaret gick förlorat: samma sats skickas om med samma id → finns redan → räknas som skickad, ingen dubblett
      for (const e of b.OBS.q.ev) { delete e._u; e._b = ids[0]; } ok((await b.OBS.flush()) === n && Object.keys(cloud.docs).length === 1 && b.OBS.q.ev.every(e => e._u), 'omsändning av samma sats: ingen dubblett');
      disconnect(b); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); connect(b, cloud); cloud.st.mode = '403'; const pend = b.OBS.q.ev.filter(e => !e._u).length;
      await b.OBS.flush(); ok(b.OBS.cloudOff && b.OBS.q.ev.filter(e => !e._u).length === pend && pend > 0, '403 (regler inte publicerade): allt stannar lokalt, inget förloras');
      cloud.st.mode = 'offline'; b.OBS.cloudOff = false; await b.OBS.flush(); ok(b.OBS.q.ev.filter(e => !e._u).length === pend, 'utan nät: kvar i kön');
      cloud.st.mode = 'ok'; await b.OBS.flush(); ok(b.OBS.q.ev.every(e => e._u) && Object.keys(cloud.docs).length === 2, 'nätet tillbaka: skickat, två satser'); }

    void ('== test 11'); /* 11. Flera enheter, dubbletter och ordning, två barn samtidigt – exporten räknar varje pass en gång */
    { const cloud = mkCloud(); const A = await boot({ seed: 3 }), B = await boot({ seed: 5 });
      for (const x of [A, B]) { consent(x.PA, 'k8'); consent(x.PA, 'k4'); }
      kor(A, 'k8'); A.T.click(A.T.$('[data-go="home"]')); kor(B, 'k8'); B.T.click(B.T.$('[data-go="home"]')); kor(A, 'k4'); A.T.click(A.T.$('[data-go="home"]')); kor(B, 'k4'); B.T.click(B.T.$('[data-go="home"]'));
      ok(A.OBS.q.dev !== B.OBS.q.dev, 'två enheter har var sitt enhets-id');
      connect(A, cloud); connect(B, cloud); await A.OBS.flush(); await B.OBS.flush(); ok(Object.keys(cloud.docs).length === 4, `en sats per enhet och barn (${Object.keys(cloud.docs).length})`);
      const out = await A.OBS.exportData(A.PA.KIDS, new Date(T_FIXED - DAY).toISOString().slice(0, 10), new Date(T_FIXED + DAY).toISOString().slice(0, 10), true);
      const k8 = A.OBS.pseud(A.PA.KIDS.find(k => k.id === 'k8')), k4 = A.OBS.pseud(A.PA.KIDS.find(k => k.id === 'k4'));
      ok(out.profiler[k8] && out.profiler[k8].pass.started === 2 && out.profiler[k4] && out.profiler[k4].pass.started === 2, `två enheter × två barn: två pass per barn, inga dubbletter (${JSON.stringify(Object.values(out.profiler).map(p => p.pass))})`);
      ok(Object.keys(out.profiler).length === 2 && !/jämför|rank|bäst|sämst/i.test(JSON.stringify(out.profiler)), 'en sammanfattning per profil, ingen jämförelse mellan syskon');
      const ev = out.handelser; const shuffled = [...ev, ...ev.slice(0, 5)].reverse(); ok(JSON.stringify(A.OBS.summarize(shuffled).profiler) === JSON.stringify(A.OBS.summarize(ev).profiler), 'dubbletter och omvänd ordning ger samma sammanfattning'); }

    void ('== test 12'); /* 12. Lagringstid (lokalt och i molnet) och sänkt lagringstid */
    { const cloud = mkCloud(); const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); connect(b, cloud); await b.OBS.flush(); disconnect(b);
      b.w.__advance(10 * DAY); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); const n10 = b.OBS.q.ev.length;
      consent(b.PA, 'k8', true, 7); b.OBS.prune(); ok(b.OBS.q.ev.length < n10 && b.OBS.q.ev.every(e => e.t * 1000 >= b.w.Date.now() - 7 * DAY), `7 dygn: äldre händelser borta lokalt (${n10} → ${b.OBS.q.ev.length})`);
      connect(b, cloud); const r = await b.OBS.cleanupCloud(); ok(r.ok && r.removed === 1 && Object.keys(cloud.docs).length === 0, `molnet: satsen äldre än lagringstiden raderad när föräldern öppnar kortet (${JSON.stringify(r)})`);
      b.w.__advance(31 * DAY); consent(b.PA, 'k8', true, 30); b.OBS.prune(); ok(b.OBS.q.ev.length === 0, 'efter 31 dygn: inget kvar lokalt'); }

    void ('== test 13'); /* 13. Radera: lokalt, i molnet, utan nät (försöker igen) och på en annan enhet efter synk */
    { const cloud = mkCloud(); const A = await boot(), B = await boot({ seed: 9 }); consent(A.PA, 'k8'); B.PA.DB.profiles.k8.settings.obs = JSON.parse(JSON.stringify(A.PA.DB.profiles.k8.settings.obs)); B.PA.save();
      kor(A, 'k8'); A.T.click(A.T.$('[data-go="home"]')); kor(B, 'k8'); B.T.click(B.T.$('[data-go="home"]')); connect(A, cloud); connect(B, cloud); await A.OBS.flush(); await B.OBS.flush(); disconnect(B);
      ok(Object.keys(cloud.docs).length === 2, 'två enheters satser i molnet'); cloud.st.mode = 'offline';
      await A.OBS.purge(A.PA.KIDS); ok(A.OBS.q.ev.length === 0 && A.OBS.q.purgeQ.length === 1 && Object.keys(cloud.docs).length === 2, 'utan nät: lokalt raderat, molnet väntar (kö för nytt försök)');
      cloud.st.mode = 'ok'; await A.OBS.flush(); ok(A.OBS.q.purgeQ.length === 0 && Object.keys(cloud.docs).length === 0, 'nätet tillbaka: båda enheternas satser raderade i molnet');
      const purge = A.PA.DB.profiles.k8.settings.obs.purge; ok(purge > 0, 'raderingen sparas i barnets inställningar (synkas)');
      B.OBS.q.ev.forEach(e => { delete e._u; }); B.PA.DB.profiles.k8.settings.obs = { ...B.PA.DB.profiles.k8.settings.obs, purge }; B.OBS.prune(); ok(B.OBS.q.ev.length === 0, 'den andra enheten släpper sina händelser efter synk (också ej uppladdade)'); }

    void ('== test 14'); /* 14. Av och på */
    { const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); ok(b.OBS.q.ev.length > 0, 'på: händelser');
      consent(b.PA, 'k8', false); b.OBS.prune(); ok(b.OBS.q.ev.length === 0, 'av: det som inte laddats upp släpps'); const n = b.OBS.q.ev.length; kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); ok(b.OBS.q.ev.length === n, 'av: inget nytt registreras');
      consent(b.PA, 'k8', true); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); ok(b.OBS.q.ev.length > n, 'på igen: registreras'); }

    void ('== test 15'); /* 15. Full kö: begränsad, bortfall räknas och syns i exporten */
    { const b = await boot(); consent(b.PA, 'k8'); b.OBS.MAX_EV = 40; const kid = b.PA.KIDS.find(k => k.id === 'k8'); for (let i = 0; i < 90; i++) b.OBS.record(kid, 'er', { w: 'fyllnad', n: 'Error' });
      const dk = b.OBS.pseud(kid); ok(b.OBS.q.ev.length <= 40 && b.OBS.q.drop[dk] >= 50, `kön stannar vid gränsen, bortfallet räknas per profil (${b.OBS.q.ev.length}, bortfall ${JSON.stringify(b.OBS.q.drop)})`);
      const out = await b.OBS.exportData([kid], '2000-01-01', '2100-01-01', false); ok(out.forbehall.some(x => /föll bort/.test(x)) && out.forbehall.some(x => /bara den här enhetens/.test(x)), 'exporten säger att händelser föll bort och att bara den här enheten är med'); }

    void ('== test 16'); /* 16. Ett fel i observationerna stoppar inget (lagringen full/trasig) */
    { const b = await boot(); consent(b.PA, 'k8'); const Sp = b.w.Storage.prototype; const set0 = Sp.setItem; Sp.setItem = function (k, v) { if (k === KEY) throw new Error('QuotaExceeded'); return set0.call(this, k, v); };
      b.OBS.hex = () => { throw new Error('trasig hash'); };
      const n = kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); Sp.setItem = set0;
      ok(n > 0 && b.PA.DB.profiles.k8.le.shadow.some(r => r.done), 'observationerna kastar fel: passet går klart och sparas som vanligt'); }

    void ('== test 17'); /* 17. Föräldrakortet: av som standard, förklaring, på/av, export */
    { const b = await boot(); b.w.eval("parentUnlocked = true; state.tab = 'settings'; go('parent')");
      const card = b.T.$('.obs-card'); ok(card && /av som standard/i.test(card.textContent) && /inte\b.*anonymt/.test(card.textContent) && /INTE|inte bara föräldern/.test(card.textContent), 'kortet förklarar: av, inte anonymt, vem som kan läsa');
      ok(/ingen automatisk rensning på servern/.test(card.textContent), 'kortet säger hur rensningen går till');
      b.T.click(b.T.$('[data-obs="toggle"][data-obs-kid="k8"]')); await sleep(5); ok(b.PA.DB.profiles.k8.settings.obs && b.PA.DB.profiles.k8.settings.obs.on === true && /^[0-9a-f]{32}$/.test(b.PA.DB.profiles.k8.settings.obs.salt), 'på för ett barn med ett slumpat salt');
      ok(!b.PA.DB.profiles.k4.settings.obs, 'bara det valda barnet'); }

    void ('== test 19'); /* 19. Förhandsvisning (V2.sandbox) och testläget: ingen registrering, ingen lagring och inget nät – inte heller med en kö som väntar */
    { const cloud = mkCloud(); const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); const n0 = b.OBS.q.ev.length; const raw0 = b.w.localStorage.getItem(KEY);
      openKid(b.T, 'k8'); b.PA.V2.sandbox = { kidId: 'k8', snap: JSON.stringify(b.PA.DB.profiles.k8), tab: null }; b.PA.go('home'); const g = b.T.$('[data-v2="flow"]') || b.T.$('.go-btn[data-v2="kor"]'); if (g) { b.T.click(g); b.D.run(() => false); }
      ok(b.OBS.q.ev.length === n0 && b.w.localStorage.getItem(KEY) === raw0, 'förälderns förhandsvisning: inga händelser, lagringen orörd'); b.PA.V2.sandbox = null;
      connect(b, cloud); b.PA.TM.on = { kidId: 'k8', name: 'x' }; const c0 = cloud.st.calls; await b.OBS.flush(); await b.OBS.cleanupCloud(); await b.OBS.purge(b.PA.KIDS); await b.OBS.purgeRetry();
      ok(cloud.st.calls === c0 && b.OBS.q.ev.length === n0 && b.w.localStorage.getItem(KEY) === raw0, `testläget: ingen uppladdning, rensning eller radering över nätet och lagringen orörd (anrop ${cloud.st.calls - c0})`); b.PA.TM.on = null; }

    void ('== test 20'); /* 20. Ingen svarstid: uppgifterna har passets starttid och ett löpnummer, aldrig sin egen tid */
    { const b = await boot(); consent(b.PA, 'k8'); openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); for (let i = 0; i < 4; i++) { b.w.__advance(7000 + i * 3000); b.D.answer(() => false); } b.D.run(() => false);
      const ss = b.OBS.q.ev.find(e => e.y === 'ss'); const it = b.OBS.q.ev.filter(e => e.y === 'it' && e.s === ss.s);
      ok(it.length >= 3 && it.every(e => e.t === ss.t) && it.map(e => e.q).join(',') === it.map((_, i) => i + 1).join(','), `uppgifterna: passets starttid och löpnummer 1..${it.length} – ingen tid per uppgift`); }

    void ('== test 21'); /* 21. Fritext i id:n (skoluppgiftens id) ersätts av en kontrollsumma */
    { const c = { v: 1, updatedAt: 1, packs: [], work: [{ id: 'Anna Svensson 8B prov', kid: 'k8', type: 'exam', title: 'Prov', date: new Date(T_FIXED + 8 * DAY).toISOString().slice(0, 10), skills: ['multin', 'forenkla'] }] };
      const b = await boot(); b.PA.FAMILY.applyContent(c); consent(b.PA, 'k8'); openKid(b.T, 'k8'); const row = b.T.$('.upcoming [data-v2="mission"]'); ok(!!row, 'förutsättning: Kör på skoluppgiftens rad'); if (row) { b.T.click(row); b.D.run(() => false); }
      const raw = b.w.localStorage.getItem(KEY) || ''; const ss = b.OBS.q.ev.filter(e => e.y === 'ss' && e.g); ok(ss.length && ss.every(e => /^h[0-9a-f]{12}$/.test(e.g)) && !/Anna|Svensson/.test(raw), `mål-id med fritext lagras som kontrollsumma (${ss.map(e => e.g).join(',')})`);
      ok(b.OBS.safeId('s:multin') === 's:multin' && b.OBS.safeId('k:ori8-orientering/skala') === 'k:ori8-orientering/skala' && /^h[0-9a-f]{12}$/.test(b.OBS.safeId('d:Mitt Däck')), 'säkra id:n står kvar, fritext blir kontrollsumma'); }

    void ('== test 22'); /* 22. Samtycke och radering vid synk: en enhet som inte synkat kan aldrig slå på igen eller ångra en radering */
    { const b = await boot(); const M = b.PA.SYNC.mergeObs; const t1 = 1000, t2 = 2000, t3 = 3000;
      const server = { on: false, onAt: t2, purge: t2, days: 30, daysAt: t1, salt: 'aa'.repeat(8), saltAt: t1, at: t2 };
      const stale = { on: true, onAt: t1, days: 7, daysAt: t3, salt: 'aa'.repeat(8), saltAt: t1, at: t3 };
      const m1 = M(stale, server), m2 = M(server, stale); ok(m1.on === false && m1.purge === t2 && m1.days === 7 && JSON.stringify(m1) === JSON.stringify(m2), `fält för fält: av och raderingen står kvar, lagringstiden följer sin senaste ändring (${JSON.stringify(m1)})`);
      const pa = JSON.parse(JSON.stringify(b.PA.DB.profiles.k8)), pb = JSON.parse(JSON.stringify(b.PA.DB.profiles.k8)); pa.settings.obs = stale; pb.settings.obs = server;
      const out = b.PA.mergeProfiles(pa, pb); ok(out.settings.obs && out.settings.obs.on === false && out.settings.obs.purge === t2, `hela profilsammanslagningen: samma resultat (${JSON.stringify(out.settings.obs)})`);
      const sA = { on: true, onAt: t1, salt: '11'.repeat(8), saltAt: t2, days: 30 }, sB = { on: true, onAt: t1, salt: '22'.repeat(8), saltAt: t1, days: 30 }; ok(M(sA, sB).salt === sB.salt && M(sB, sA).salt === sB.salt, 'två salt samtidigt: det först skapade vinner (pseudonymen byts inte fram och tillbaka)'); }

    void ('== test 23'); /* 23. Exporten respekterar lagringstid och radering också för satser i molnet som ännu inte rensats */
    { const cloud = mkCloud(); const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); connect(b, cloud); await b.OBS.flush(); disconnect(b);
      b.w.__advance(10 * DAY); consent(b.PA, 'k8', true, 7); connect(b, cloud); b.PA.SYNC.lastPull = {};   // inte synkad: molnet rensas inte – exporten filtrerar ändå
      try { Object.defineProperty(b.PA.SYNC, 'active', { value: true, configurable: true, writable: true }); } catch (e) { b.PA.SYNC.active = true; }
      const out = await b.OBS.exportData(b.PA.KIDS, '2000-01-01', '2100-01-01', true); ok(Object.keys(cloud.docs).length === 1 && (out.handelser || []).length === 0, `export efter lagringstiden: inget gammalt med, fast satsen ligger kvar i molnet (${(out.handelser || []).length} händelser, ${Object.keys(cloud.docs).length} satser)`); }

    void ('== test 24'); /* 24. En föräldraenhet som inte synkat raderar ingenting i molnet; okänd pseudonym raderas först efter 30 dygn */
    { const cloud = mkCloud(); const A = await boot(); consent(A.PA, 'k8'); kor(A, 'k8'); A.T.click(A.T.$('[data-go="home"]')); connect(A, cloud); await A.OBS.flush();
      const B = await boot({ seed: 9 }); connect(B, cloud); try { Object.defineProperty(B.PA.SYNC, 'active', { value: true, configurable: true, writable: true }); } catch (e) { B.PA.SYNC.active = true; } B.PA.SYNC.lastPull = {};
      let r = await B.OBS.cleanupCloud(); ok(!r.ok && Object.keys(cloud.docs).length === 1, `inte synkad: ingen rensning (${JSON.stringify(r)})`);
      B.PA.SYNC.lastPull = Object.fromEntries(B.PA.KIDS.map(k => [k.id, Date.now()])); r = await B.OBS.cleanupCloud(); ok(r.ok && Object.keys(cloud.docs).length === 1, `synkad men saltet inte känt här: en färsk sats får vara kvar (${JSON.stringify(r)})`);
      B.w.__advance(31 * DAY); r = await B.OBS.cleanupCloud(); ok(r.ok && Object.keys(cloud.docs).length === 0, 'okänd pseudonym: raderas först efter den yttersta gränsen (30 dygn)'); }

    void ('== test 25'); /* 25. En försenad radering tar bara bort det som fanns före raderingen */
    { const cloud = mkCloud(); const A = await boot(); consent(A.PA, 'k8'); kor(A, 'k8'); A.T.click(A.T.$('[data-go="home"]')); connect(A, cloud); await A.OBS.flush();
      cloud.st.mode = 'offline'; await A.OBS.purge(A.PA.KIDS); ok(A.OBS.q.purgeQ.length === 1, 'utan nät: raderingen väntar');
      A.w.__advance(DAY); cloud.st.mode = 'ok'; const before = new Set(Object.keys(cloud.docs)); disconnect(A); kor(A, 'k8'); A.T.click(A.T.$('[data-go="home"]')); connect(A, cloud);
      const q0 = A.OBS.q.purgeQ.slice(); A.OBS.q.purgeQ = []; await A.OBS.flush(); A.OBS.q.purgeQ = q0; const fresh = Object.keys(cloud.docs).filter(id => !before.has(id)); await A.OBS.purgeRetry();
      ok(fresh.length === 1 && Object.keys(cloud.docs).length === 1 && cloud.docs[fresh[0]], `den gamla satsen raderad, den nya (efter raderingen, samtycket på) kvar (${Object.keys(cloud.docs).length})`); }

    void ('== test 26'); /* 26. Två flikar: olika id:n (sidladdningens id i varje händelse) */
    { const b = await boot(); consent(b.PA, 'k8'); const kid = b.PA.KIDS.find(k => k.id === 'k8'); b.OBS.run = '1111'; const e1 = b.OBS.record(kid, 'er', { w: 'a', n: 'E' }); b.OBS.run = '2222'; b.OBS.q.seq--; const e2 = b.OBS.record(kid, 'er', { w: 'a', n: 'E' });
      ok(e1 && e2 && e1.i !== e2.i, `samma enhet och löpnummer i två flikar: olika id (${e1 && e1.i}, ${e2 && e2.i})`); }

    void ('== test 27'); /* 27. Bortfall räknas per profil – syns inte i ett annat barns export */
    { const b = await boot(); consent(b.PA, 'k8'); consent(b.PA, 'k4'); b.OBS.MAX_EV = 20; const k4 = b.PA.KIDS.find(k => k.id === 'k4'), k8 = b.PA.KIDS.find(k => k.id === 'k8'); for (let i = 0; i < 40; i++) b.OBS.record(k4, 'er', { w: 'x', n: 'E' }); b.OBS.MAX_EV = 3000;
      const out = await b.OBS.exportData([k8], '2000-01-01', '2100-01-01', false); ok(!out.forbehall.some(x => /föll bort/.test(x)), 'Åttans export: inget bortfall från Fyrans kö'); }

    void ('== test 28'); /* 28. Radera familjens data: observationerna raderas först (sedan finns inga medlemmar som når dem) */
    { const b = await boot(); let called = 0; b.OBS.purgeFamilyCloud = async () => { called++; return 0; }; try { await b.PA.deleteFamilyData(); } catch (e) { /* utan moln går resten inte – här prövas bara ordningen */ }
      ok(called === 1, 'deleteFamilyData raderar observationerna först'); let kc = 0; b.OBS.purge = async () => { kc++; return 0; }; try { await b.PA.deleteKidData('k8'); } catch (e) { /* ignore */ } ok(kc === 1, 'deleteKidData raderar barnets observationer'); }

    void ('== test 29'); /* 29. Molnrensningen startar när föräldern öppnar ⚙ – bara på en synkad enhet */
    { const b = await boot(); let n = 0; b.OBS.cleanupCloud = async () => { n++; return { ok: true, removed: 0 }; }; try { Object.defineProperty(b.PA.SYNC, 'active', { value: true, configurable: true, writable: true }); } catch (e) { b.PA.SYNC.active = true; } b.PA.SYNC.lastPull = {};
      const PUSH = b.w.eval('PUSH'); let ls = 0; const ls0 = PUSH.loadStatus; PUSH.loadStatus = async () => { ls++; return ls0(); };
      b.w.eval("parentUnlocked = true; state.tab = 'settings'; go('parent')"); ok(n === 0, 'inte synkad: ingen molnrensning när ⚙ öppnas');
      b.PA.SYNC.lastPull = Object.fromEntries(b.PA.KIDS.map(k => [k.id, Date.now()])); b.w.eval("go('parent')"); ok(n === 1, 'synkad: molnrensningen startar när föräldern öppnar ⚙'); b.w.eval("go('parent')"); ok(n === 1, 'en gång per sidladdning');
      await sleep(200); ok(ls === 1, `⚙ utan påminnelselogg i molnet: hämtas en gång, ingen hämta-rita-om-slinga (${ls} hämtningar)`); }

    void ('== test 18'); /* 18. Exemplet (syntetiskt) i tests/obs_example_export.json stämmer med sammanfattningen */
    { const b = await boot(); const OBS = b.OBS; const k = 'p' + '0123456789ab'; const t0 = Math.round(T_FIXED / 1000) - 5 * 86400; const ev = []; let n = 0; const E = (dt, y, f) => ev.push({ i: `exdevice-${++n}`, y, t: t0 + dt, k, ...f });
      E(0, 'ss', { s: 'S1', m: 'kor', x: 'achieve', po: 0, n: 6, b: 'v3.7.0 (exempel)', c: 1 }); for (let i = 0; i < 6; i++) E(0, 'it', { s: 'S1', q: i + 1, c: ['s:multin', 's:forenkla', 'k:ori8/skala'][i % 3], f: ['mc', 'free', 'sort'][i % 3], ok: i % 4 ? 1 : 0, h: i === 2 ? 'h' : 'n', r: i === 5 ? 1 : 0, x: 'f', v: 0 }); E(300, 'se', { s: 'S1', o: 'done', a: 6, p: 6, am: '5-15', tq: 'fg' });
      E(310, 'of', { w: 'klar', s: 'S1', bt: { flow: 1 } }); E(320, 'sl', { w: 'klar', a: 'flow', cd: 1 }); E(330, 'ss', { s: 'S2', m: 'flow', x: 'achieve', po: 0, n: 4, b: 'v3.7.0 (exempel)', c: 1 }); E(330, 'it', { s: 'S2', q: 1, c: 's:multin', f: 'mc', ok: 1, h: 'n', r: 0, x: 'r', v: 0 });
      E(2 * 86400, 'ss', { s: 'S3', m: 'mission', x: 'achieve', po: 0, g: 'w:a1', n: 5, b: 'v3.7.0 (exempel)', c: 1 }); E(2 * 86400, 'it', { s: 'S3', q: 1, c: 's:forenkla', f: 'free', ok: 0, h: 's', r: 0, x: 'f', v: 0 }); E(2 * 86400 + 90, 'se', { s: 'S3', o: 'exit', a: 1, p: 2, am: '<5', tq: 'fg' });
      E(4 * 86400, 'of', { w: 'home', bt: { flow: 1, rad: 2 } }); E(4 * 86400 + 5, 'er', { w: 'v2:observe', n: 'TypeError' });
      const sum = OBS.summarize(ev, { from: t0 - 86400, to: t0 + 6 * 86400 }); const file = path.join(__dirname, 'obs_example_export.json');
      const example = { ...sum, analysmall: 'Se docs/LEARNING_LOOP.md, avsnitt "Analysmall".', handelser: OBS.dedup(ev) };
      if (process.env.WRITE_OBS_EXAMPLE) fs.writeFileSync(file, JSON.stringify(example, null, 1) + '\n');
      const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; const pr = sum.profiler[k];
      ok(saved && JSON.stringify(saved.profiler) === JSON.stringify(sum.profiler), 'exemplet i tests/obs_example_export.json är aktuellt (WRITE_OBS_EXAMPLE=1 skriver om det)');
      ok(pr.pass.started === 3 && pr.pass.completed === 1 && pr.pass.exited === 1 && pr.pass.outcomeUnknown === 1 && pr.observationsdagar === 3 && pr.uppgifter.inlamnade === 8 && pr.uppgifter.visadeMenInteInlamnade === 1, `exemplet: nämnarna stämmer (${JSON.stringify(pr.pass)})`);
      ok(pr.uppehall.length === 0, 'uppehåll: en dag utan pass räknas inte som uppehåll (bara två dagar eller mer)');
      ok(pr.fortsattning.valEfterDagensPass.flow === 1 && pr.fortsattning.erbjudanden.klar === 1 && pr.fortsattning.erbjudanden.hem === 1, 'exemplet: ett val av två erbjudanden efter dagens pass'); }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'OBS TEST FAILED' : 'OBS TEST OK'); process.exit(fails ? 1 : 0);
})();
