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
const ALLOWED = { ss: ['s', 'm', 'x', 'po', 'g', 'n', 'b', 'c'], it: ['s', 'c', 'f', 'ok', 'h', 'r', 'x', 'v'], se: ['s', 'o', 'a', 'p', 'am', 'tq'], of: ['w', 's', 'bt'], sl: ['w', 'a', 'cd'], er: ['w', 'n'] };

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
const connect = (b, cloud) => { b.PA.SYNC.cfg = { projectId: 'demo', apiKey: 'k' }; b.PA.DB.settings.family = 'famsynthetic01'; b.w.fetch = cloud.fetch; b.OBS.cloudOff = false; };
const disconnect = (b) => { b.PA.SYNC.cfg = null; };

(async () => {
  try {
    /* 1. Av som standard */
    { const b = await boot(); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]'));
      ok(b.w.localStorage.getItem(KEY) === null && !(b.OBS.q && b.OBS.q.ev.length), 'av som standard: inget registreras, ingen nyckel i lagringen');
      ok(!b.PA.DB.profiles.k8.settings.obs, 'av som standard: ingen inställning finns'); }

    /* 2. På: pass, uppgifter, slut – bara tillåtna fält, inga namn, inga skrivna svar */
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

    /* 3. Lärande, belöningar och schema identiska med observationer på och av */
    { const run = async (on) => { const b = await boot({ seed: 21 }); if (on) consent(b.PA, 'k8'); for (let d = 0; d < 2; d++) { kor(b, 'k8', (it) => it.cat !== 'learn' && b.D.log.items % 3 === 0); b.T.click(b.T.$('[data-go="home"]')); b.w.__advance(DAY); }
        const p = JSON.parse(JSON.stringify(b.PA.DB.profiles.k8)); delete p.settings.obs; delete p.settings.obsAt; delete p.updatedAt; return JSON.stringify(p).split(b.PA.LE.devBase()).join('DEV'); };   // enhetens id är slumpat per fönster (crypto) – jämförs utan det
      const a = await run(false), c = await run(true); ok(a === c, 'profilen (motor, belöningar, schema, Felbok) är byte för byte densamma med observationer på och av'); }

    /* 4. Testa som barnet: ingenting registreras och lagringen rörs inte (hela flödet med riktig isolering prövas också i
       test_parent_test_mode_prod.js, med observationer på för Åttan) */
    { const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]'));
      openKid(b.T, 'k8'); const before = b.w.localStorage.getItem(KEY); const n0 = b.OBS.q.ev.length; b.PA.TM.on = { kidId: 'k8', name: 'test' }; b.PA.go('home');
      const g = b.T.$('.go-btn[data-v2="kor"]') || b.T.$('[data-v2="flow"]'); if (g) { b.T.click(g); b.D.run(() => false); }
      b.OBS.record(b.PA.KIDS.find(k => k.id === 'k8'), 'ss', { s: 'tm' }); b.OBS.save(); b.OBS.prune();
      ok(b.w.localStorage.getItem(KEY) === before && b.OBS.q.ev.length === n0 && !b.OBS.q.ev.some(e => e.s === 'tm'), 'Testa som barnet (TM.on): inga händelser och lagringen rörs inte – inget kan senare hamna i uppladdningskön');
      b.PA.TM.on = null; }

    /* 5. Automatiserad webbläsare (skärmdumpar, layouttest) och förhandsvisning registreras aldrig */
    { const b = await boot(); consent(b.PA, 'k8'); Object.defineProperty(b.w.navigator, 'webdriver', { value: true, configurable: true }); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]'));
      ok(!(b.OBS.q && b.OBS.q.ev.length) && b.w.localStorage.getItem(KEY) === null, 'navigator.webdriver: inga händelser');
      Object.defineProperty(b.w.navigator, 'webdriver', { value: false, configurable: true }); b.w.PLUGG_NO_OBS = true; kor(b, 'k8'); ok(!(b.OBS.q && b.OBS.q.ev.length), 'PLUGG_NO_OBS: inga händelser'); }

    /* 6. Uttrycklig utgång och okänt utfall (omladdning) – aldrig "avbrutet" */
    { const b = await boot(); consent(b.PA, 'k8'); openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); b.D.answer(() => false); b.D.answer(() => false);
      b.T.click(b.T.$('[data-go]')); const se = b.OBS.q.ev.filter(e => e.y === 'se'); const its = b.OBS.q.ev.filter(e => e.y === 'it').length;
      ok(se.length === 1 && se[0].o === 'exit' && its >= 1 && se[0].a === its && se[0].p === its + 1, `uttrycklig utgång: lämnat, inlämnade = uppgiftshändelser, en visad men inte inlämnad (${JSON.stringify(se[0])}, ${its} uppgifter)`);
      openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); b.D.answer(() => false); b.PA.flushSave && b.PA.flushSave();
      const storage = {}; for (let i = 0; i < b.w.localStorage.length; i++) { const k = b.w.localStorage.key(i); storage[k] = b.w.localStorage.getItem(k); }
      const b2 = await boot({ storage }); const s = b2.OBS.summarize(b2.OBS.load().ev); const pr = Object.values(s.profiler)[0];
      ok(pr && pr.pass.started === 2 && pr.pass.exited === 1 && pr.pass.outcomeUnknown === 1 && pr.pass.completed === 0, `efter omladdning: ett okänt utfall, ett lämnat (${JSON.stringify(pr && pr.pass)})`);
      ok(!/avbrut|abandon/i.test(JSON.stringify(s.profiler)) && s.forbehall.some(x => /okänt utfall/.test(x) && /aldrig som avbrutna/.test(x)), 'okänt utfall kallas aldrig avbrutet'); }

    /* 7. Tid bara i förgrunden; ett långt obrutet intervall märks osäkert */
    { const b = await boot(); consent(b.PA, 'k8'); const vis = (v) => { Object.defineProperty(b.w.document, 'visibilityState', { value: v, configurable: true }); b.w.document.dispatchEvent(new b.w.Event('visibilitychange')); };
      openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); b.w.__advance(3 * 60000); vis('hidden'); b.w.__advance(45 * 60000); vis('visible'); b.w.__advance(2 * 60000); b.D.run(() => false);
      let se = b.OBS.q.ev.filter(e => e.y === 'se').pop(); ok(se && se.am === 5 && se.tq === 'fg', `förgrund 3 + 2 min, 45 min i bakgrunden räknas inte (${se && se.am} min, ${se && se.tq})`);
      openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="flow"]') || b.T.$('.go-btn[data-v2="kor"]') || b.T.$('[data-v2="flow"]')); ok(!!(b.PA.S && b.PA.S.v2 && !b.PA.S.v2.ended), 'förutsättning: ett andra pass startade'); if (b.PA.S && b.PA.S.v2 && !b.PA.S.v2.ended) { b.w.__advance(40 * 60000); b.D.run(() => false); se = b.OBS.q.ev.filter(e => e.y === 'se').pop(); ok(se && se.tq === 'u', `40 min utan signal: tiden märks osäker (${se && se.tq})`); }
      const pr = Object.values(b.OBS.summarize(b.OBS.q.ev).profiler)[0]; ok(pr.aktivTidMinuter.pass >= 1 && /fokus, förmåga eller motivation/.test(pr.aktivTidMinuter.notering), 'exporten räknar bara säker tid och tolkar den inte'); }

    /* 8. Erbjudanden och val efter dagens pass (med nämnare i exporten) */
    { const c = { v: 1, updatedAt: 1, packs: [], work: [{ id: 'a1', kid: 'k8', type: 'exam', title: 'Algebraprov', date: new Date(T_FIXED + 10 * DAY).toISOString().slice(0, 10), skills: ['multin', 'forenkla', 'blandat'] }] };
      const b = await boot(); b.PA.FAMILY.applyContent(c); consent(b.PA, 'k8'); kor(b, 'k8', () => true); b.T.click(b.T.$('[data-go="home"]')); openKid(b.T, 'k8');
      const of = b.OBS.q.ev.filter(e => e.y === 'of'); ok(of.some(e => e.w === 'klar') && of.some(e => e.w === 'home'), `erbjudanden på KLAR och startsidan (${of.map(e => e.w + ':' + JSON.stringify(e.bt)).join(' ')})`);
      const n0 = of.length; b.T.click(b.T.$('[data-tab]') || b.T.$('body')); openKid(b.T, 'k8'); openKid(b.T, 'k8'); ok(b.OBS.q.ev.filter(e => e.y === 'of').length === n0, 'samma erbjudande igen: ingen ny händelse (inte per omritning)');
      const row = b.T.$('.upcoming [data-v2="mission"]'); ok(!!row, 'förutsättning: raden erbjuder Kör efter dagens pass (fel kvar)'); if (row) { b.T.click(row); const sl = b.OBS.q.ev.filter(e => e.y === 'sl').pop(); ok(sl && sl.w === 'rad' && sl.a === 'mission' && sl.cd === 1, `val: Kör på raden efter dagens pass (${JSON.stringify(sl)})`); b.D.run(() => false); }
      const pr = Object.values(b.OBS.summarize(b.OBS.q.ev).profiler)[0]; ok(pr.fortsattning.erbjudanden.hem + pr.fortsattning.erbjudanden.klar >= 1 && typeof pr.fortsattning.valEfterDagensPass === 'object', 'exporten: erbjudanden och val efter dagens pass'); }

    /* 9. Tekniskt fel: bara plats och typ, aldrig meddelandet */
    { const b = await boot(); consent(b.PA, 'k8'); openKid(b.T, 'k8'); b.PA.V2.safe(() => { throw new TypeError('hemligt innehåll i meddelandet'); }, 'test-plats', null);
      const er = b.OBS.q.ev.filter(e => e.y === 'er'); ok(er.length === 1 && er[0].w === 'test-plats' && er[0].n === 'TypeError' && !JSON.stringify(er).includes('hemligt'), `tekniskt fel utan meddelande (${JSON.stringify(er)})`);
      for (let i = 0; i < 40; i++) b.PA.V2.safe(() => { throw new Error('x'); }, 'loop', null); ok(b.OBS.q.ev.filter(e => e.y === 'er').length <= 20, 'högst 20 fel per dygn'); }

    /* 10. Moln: satser, igen utan dubbletter, 403 (reglerna inte publicerade), utan nät */
    { const cloud = mkCloud(); const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); await sleep(10); connect(b, cloud);
      const n = b.OBS.q.ev.length; const sent = await b.OBS.flush(); const ids = Object.keys(cloud.docs);
      ok(sent === n && ids.length === 1 && /^p[0-9a-f]{12}-[a-z0-9]{8}-1$/.test(ids[0]) && b.OBS.q.ev.every(e => e._u), `en sats med alla händelser (${sent}/${n}, ${ids.join(',')})`);
      const doc = cloud.docs[ids[0]].fields; ok(Object.keys(doc).sort().join(',') === 'json,k,n,t,v' && !/_u|_b/.test(doc.json.stringValue), 'satsens fält som reglerna kräver, inga interna fält');
      ok((await b.OBS.flush()) === 0 && Object.keys(cloud.docs).length === 1, 'igen: inget skickas två gånger');
      // svaret gick förlorat: samma sats skickas om med samma id → finns redan → räknas som skickad, ingen dubblett
      for (const e of b.OBS.q.ev) { delete e._u; e._b = ids[0]; } ok((await b.OBS.flush()) === n && Object.keys(cloud.docs).length === 1 && b.OBS.q.ev.every(e => e._u), 'omsändning av samma sats: ingen dubblett');
      disconnect(b); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); connect(b, cloud); cloud.st.mode = '403'; const pend = b.OBS.q.ev.filter(e => !e._u).length;
      await b.OBS.flush(); ok(b.OBS.cloudOff && b.OBS.q.ev.filter(e => !e._u).length === pend && pend > 0, '403 (regler inte publicerade): allt stannar lokalt, inget förloras');
      cloud.st.mode = 'offline'; b.OBS.cloudOff = false; await b.OBS.flush(); ok(b.OBS.q.ev.filter(e => !e._u).length === pend, 'utan nät: kvar i kön');
      cloud.st.mode = 'ok'; await b.OBS.flush(); ok(b.OBS.q.ev.every(e => e._u) && Object.keys(cloud.docs).length === 2, 'nätet tillbaka: skickat, två satser'); }

    /* 11. Flera enheter, dubbletter och ordning, två barn samtidigt – exporten räknar varje pass en gång */
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

    /* 12. Lagringstid (lokalt och i molnet) och sänkt lagringstid */
    { const cloud = mkCloud(); const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); connect(b, cloud); await b.OBS.flush(); disconnect(b);
      b.w.__advance(10 * DAY); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); const n10 = b.OBS.q.ev.length;
      consent(b.PA, 'k8', true, 7); b.OBS.prune(); ok(b.OBS.q.ev.length < n10 && b.OBS.q.ev.every(e => e.t * 1000 >= b.w.Date.now() - 7 * DAY), `7 dygn: äldre händelser borta lokalt (${n10} → ${b.OBS.q.ev.length})`);
      connect(b, cloud); const r = await b.OBS.cleanupCloud(); ok(r.ok && r.removed === 1 && Object.keys(cloud.docs).length === 0, `molnet: satsen äldre än lagringstiden raderad när föräldern öppnar kortet (${JSON.stringify(r)})`);
      b.w.__advance(31 * DAY); consent(b.PA, 'k8', true, 30); b.OBS.prune(); ok(b.OBS.q.ev.length === 0, 'efter 31 dygn: inget kvar lokalt'); }

    /* 13. Radera: lokalt, i molnet, utan nät (försöker igen) och på en annan enhet efter synk */
    { const cloud = mkCloud(); const A = await boot(), B = await boot({ seed: 9 }); consent(A.PA, 'k8'); B.PA.DB.profiles.k8.settings.obs = JSON.parse(JSON.stringify(A.PA.DB.profiles.k8.settings.obs)); B.PA.save();
      kor(A, 'k8'); A.T.click(A.T.$('[data-go="home"]')); kor(B, 'k8'); B.T.click(B.T.$('[data-go="home"]')); connect(A, cloud); connect(B, cloud); await A.OBS.flush(); await B.OBS.flush(); disconnect(B);
      ok(Object.keys(cloud.docs).length === 2, 'två enheters satser i molnet'); cloud.st.mode = 'offline';
      await A.OBS.purge(A.PA.KIDS); ok(A.OBS.q.ev.length === 0 && A.OBS.q.purgeQ.length === 1 && Object.keys(cloud.docs).length === 2, 'utan nät: lokalt raderat, molnet väntar (kö för nytt försök)');
      cloud.st.mode = 'ok'; await A.OBS.flush(); ok(A.OBS.q.purgeQ.length === 0 && Object.keys(cloud.docs).length === 0, 'nätet tillbaka: båda enheternas satser raderade i molnet');
      const purge = A.PA.DB.profiles.k8.settings.obs.purge; ok(purge > 0, 'raderingen sparas i barnets inställningar (synkas)');
      B.OBS.q.ev.forEach(e => { delete e._u; }); B.PA.DB.profiles.k8.settings.obs = { ...B.PA.DB.profiles.k8.settings.obs, purge }; B.OBS.prune(); ok(B.OBS.q.ev.length === 0, 'den andra enheten släpper sina händelser efter synk (också ej uppladdade)'); }

    /* 14. Av och på */
    { const b = await boot(); consent(b.PA, 'k8'); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); ok(b.OBS.q.ev.length > 0, 'på: händelser');
      consent(b.PA, 'k8', false); b.OBS.prune(); ok(b.OBS.q.ev.length === 0, 'av: det som inte laddats upp släpps'); const n = b.OBS.q.ev.length; kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); ok(b.OBS.q.ev.length === n, 'av: inget nytt registreras');
      consent(b.PA, 'k8', true); kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); ok(b.OBS.q.ev.length > n, 'på igen: registreras'); }

    /* 15. Full kö: begränsad, bortfall räknas och syns i exporten */
    { const b = await boot(); consent(b.PA, 'k8'); b.OBS.MAX_EV = 40; const kid = b.PA.KIDS.find(k => k.id === 'k8'); for (let i = 0; i < 90; i++) b.OBS.record(kid, 'er', { w: 'fyllnad', n: 'Error' });
      ok(b.OBS.q.ev.length <= 40 && b.OBS.q.drop >= 50, `kön stannar vid gränsen, bortfallet räknas (${b.OBS.q.ev.length}, bortfall ${b.OBS.q.drop})`);
      const out = await b.OBS.exportData([kid], '2000-01-01', '2100-01-01', false); ok(out.forbehall.some(x => /föll bort/.test(x)) && out.forbehall.some(x => /bara den här enhetens/.test(x)), 'exporten säger att händelser föll bort och att bara den här enheten är med'); }

    /* 16. Ett fel i observationerna stoppar inget (lagringen full/trasig) */
    { const b = await boot(); consent(b.PA, 'k8'); const Sp = b.w.Storage.prototype; const set0 = Sp.setItem; Sp.setItem = function (k, v) { if (k === KEY) throw new Error('QuotaExceeded'); return set0.call(this, k, v); };
      b.OBS.hex = () => { throw new Error('trasig hash'); };
      const n = kor(b, 'k8'); b.T.click(b.T.$('[data-go="home"]')); Sp.setItem = set0;
      ok(n > 0 && b.PA.DB.profiles.k8.le.shadow.some(r => r.done), 'observationerna kastar fel: passet går klart och sparas som vanligt'); }

    /* 17. Föräldrakortet: av som standard, förklaring, på/av, export */
    { const b = await boot(); b.w.eval("parentUnlocked = true; state.tab = 'settings'; go('parent')");
      const card = b.T.$('.obs-card'); ok(card && /av som standard/i.test(card.textContent) && /inte\b.*anonymt/.test(card.textContent) && /INTE|inte bara föräldern/.test(card.textContent), 'kortet förklarar: av, inte anonymt, vem som kan läsa');
      ok(/ingen automatisk rensning på servern/.test(card.textContent), 'kortet säger hur rensningen går till');
      b.T.click(b.T.$('[data-obs="toggle"][data-obs-kid="k8"]')); await sleep(5); ok(b.PA.DB.profiles.k8.settings.obs && b.PA.DB.profiles.k8.settings.obs.on === true && /^[0-9a-f]{32}$/.test(b.PA.DB.profiles.k8.settings.obs.salt), 'på för ett barn med ett slumpat salt');
      ok(!b.PA.DB.profiles.k4.settings.obs, 'bara det valda barnet'); }

    /* 18. Exemplet (syntetiskt) i tests/obs_example_export.json stämmer med sammanfattningen */
    { const b = await boot(); const OBS = b.OBS; const k = 'p' + '0123456789ab'; const t0 = Math.round(T_FIXED / 1000) - 5 * 86400; const ev = []; let n = 0; const E = (dt, y, f) => ev.push({ i: `exdevice-${++n}`, y, t: t0 + dt, k, ...f });
      E(0, 'ss', { s: 'S1', m: 'kor', x: 'achieve', po: 0, n: 6, b: 'v3.7.0 (exempel)', c: 1 }); for (let i = 0; i < 6; i++) E(30 + i * 40, 'it', { s: 'S1', c: ['s:multin', 's:forenkla', 'k:ori8/skala'][i % 3], f: ['mc', 'free', 'sort'][i % 3], ok: i % 4 ? 1 : 0, h: i === 2 ? 'h' : 'n', r: i === 5 ? 1 : 0, x: 'f', v: 0 }); E(300, 'se', { s: 'S1', o: 'done', a: 6, p: 6, am: 5, tq: 'fg' });
      E(310, 'of', { w: 'klar', s: 'S1', bt: { flow: 1 } }); E(320, 'sl', { w: 'klar', a: 'flow', cd: 1 }); E(330, 'ss', { s: 'S2', m: 'flow', x: 'achieve', po: 0, n: 4, b: 'v3.7.0 (exempel)', c: 1 }); E(360, 'it', { s: 'S2', c: 's:multin', f: 'mc', ok: 1, h: 'n', r: 0, x: 'r', v: 0 });
      E(2 * 86400, 'ss', { s: 'S3', m: 'mission', x: 'achieve', po: 0, g: 'w:a1', n: 5, b: 'v3.7.0 (exempel)', c: 1 }); E(2 * 86400 + 60, 'it', { s: 'S3', c: 's:forenkla', f: 'free', ok: 0, h: 's', r: 0, x: 'f', v: 0 }); E(2 * 86400 + 90, 'se', { s: 'S3', o: 'exit', a: 1, p: 2, am: 1, tq: 'fg' });
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
