/* 3.1 "Bara prov och läxor" – förälderns val per barn (ägarens beslut 27 oktober: den äldsta pluggar bara till prov och läxor; de yngre
   lär sig för att det är kul, standard "Allt" oförändrat). Riktiga appen i jsdom, SYNTETISK familj (testfixturen), fast klocka.
   · standard: ingen skillnad (planen är exakt densamma som utan inställningen)
   · på: Kör! och FLOW tränar bara inlagda prov/läxor inom 28 dygn (alla uppgifter, även Bossen); hemmet lovar bara det; inga glosor
   · två prov: båda provens områden, inget annat
   · inget prov inom 28 dygn: ärligt kort, ingen Kör!-knapp, Öva på egen hand finns kvar; Testa mig finns när ett prov finns
   · Klassisk: samma regel · v1: inställningen gäller inte · synk: senaste ändringen gäller · föräldraläget: valet finns och sparas
   Motorn är oförändrad: samma planerare med sin egen begränsning (only), som provträningen 2.1.1. */
'use strict';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js'); const { v2tools, toStart, unlockParent } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000; const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
async function boot(seed) { const w = mkWin({ seed, fixedClock: true }); await sleep(40); const T = tools(w); T.PA().FAMILY.apply(FIX); T.PA().load(); T.PA().rerender(); return { w, T, PA: T.PA, D: v2tools(w, T), r: rng(seed) }; }
(async () => {
  try {
    // ---------- 1. Standard ("Allt"): samma väg som utan inställningen (planen jämfördes även mot 3.0.1 i granskningen: identiska skuggloggar) ----------
    { const { w, T, PA, D, r } = await boot(5); const kid = () => PA().KIDS.find(k => k.id === 'k8'); const p = () => PA().DB.profiles.k8;
      const open = () => { toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
      for (let d = 0; d < 3; d++) { open(); const g = T.$('[data-v2="kor"]'); if (g) { T.click(g); D.run(() => r() < 0.3, 60); } w.__advance(DAY); }
      const a = JSON.stringify(PA().V2.peekPlan(kid()).plan); p().settings.scope = 'all'; PA().LE.invalidate('k8'); const b = JSON.stringify(PA().V2.peekPlan(kid()).plan);
      ok(a === b, 'Standard "Allt": planen är exakt densamma som utan inställningen'); }

    // ---------- 2. På, ett prov: bara provets områden – även i FLOW; inga glosor ----------
    let flows = 0;
    for (const seed of [7, 11, 19, 23, 31, 41]) {
      const { w, T, PA, D, r } = await boot(seed); const kid = () => PA().KIDS.find(k => k.id === 'k8'); const p = () => PA().DB.profiles.k8;
      const iso = (d) => new Date(w.Date.now() + d * DAY).toISOString().slice(0, 10);
      const open = () => { toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
      for (let d = 0; d < 3; d++) { open(); const g = T.$('[data-v2="kor"]'); if (g) { T.click(g); D.run(() => r() < 0.3, 60); } w.__advance(DAY); }
      p().exams = [{ id: 'e1', title: 'Algebraprov', date: iso(10), skillIds: ['forenkla', 'ekvation', 'multin', 'blandat'], deckIds: [] }];
      p().settings.scope = 'exams'; p().settings.scopeAt = w.Date.now(); PA().save(); PA().LE.invalidate('k8');
      const U = new Set(PA().V2.examCidsActive(kid(), p().exams[0]));
      for (let d = 0; d < 4; d++) {
        open(); const home = norm(T.$('#app').textContent); const pk = PA().V2.peekPlan(kid()).plan;
        ok(pk.length > 0 && pk.every(s => U.has(s.cid)), `seed ${seed} dag ${d}: hemmets plan är bara provets områden (${pk.map(s => s.cid).join(', ')})`);
        ok(!/glosor|Repetition: (engelska|spanska)/i.test(home), `seed ${seed} dag ${d}: hemmet lovar inga glosor`);
        const g = T.$('[data-v2="kor"]'); if (!g) { ok(/DAGENS PLAN KLAR|INGET ATT ÖVA/.test(home), `seed ${seed} dag ${d}: utan Kör! är det ett ärligt läge`); w.__advance(DAY); continue; }
        T.click(g); ok(JSON.stringify(PA().S.v2.plan.map(s => s.cid)) === JSON.stringify(pk.map(s => s.cid)), `seed ${seed} dag ${d}: KÖR startar den visade planen`);
        const played = []; let n = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && n++ < 60) { const q = PA().S.queue[PA().S.i]; if (q.spec && q.cat !== 'learn') played.push(q.cat === 'word' ? 'ORD' : q.spec.cid); D.answer(() => r() < 0.3); w.__advance(4000); }
        ok(played.length > 0 && played.every(c => U.has(c)), `seed ${seed} dag ${d}: allt som spelades hör till provet (${[...new Set(played)].join(', ')})`);
        // FLOW (extrapass) – samma regel
        // FLOW (extrapass, flera block, många fel → Rescue, lätta uppgifter, Bossens omval) – samma regel för ALLT som spelas
        for (let b = 0; b < 3; b++) { open(); const f = T.$('[data-v2="flow"]'); if (!f) break; const fp = PA().EXP.peekFlow(kid()); T.click(f); flows++;
          ok(PA().S.v2.plan.every(s => U.has(s.cid)) && fp.every(s => U.has(s.cid)) && Object.keys(PA().S.v2.R.cat).every(c => U.has(c)), `seed ${seed} dag ${d} FLOW ${b + 1}: planen och löparens katalog är bara provets områden`);
          const fpl = []; let m = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && m++ < 60) { const q = PA().S.queue[PA().S.i]; if (q.spec && q.cat !== 'learn') fpl.push(q.cat === 'word' ? 'ORD' : q.spec.cid); D.answer(() => r() < 0.6); w.__advance(4000); }
          ok(fpl.every(c => U.has(c)), `seed ${seed} dag ${d} FLOW ${b + 1}: allt som spelades hör till provet (${[...new Set(fpl)].join(', ')})`); }
        w.__advance(DAY);
      }
    }

    ok(flows >= 6, `FLOW prövades ${flows} gånger med valet på`);

    // ---------- 3. Två prov: båda provens områden, inget annat ----------
    { const { w, T, PA, D, r } = await boot(23); const kid = () => PA().KIDS.find(k => k.id === 'k8'); const p = () => PA().DB.profiles.k8; const iso = (d) => new Date(w.Date.now() + d * DAY).toISOString().slice(0, 10);
      p().exams = [{ id: 'e1', title: 'Algebraprov', date: iso(9), skillIds: ['forenkla', 'ekvation'], deckIds: [] }, { id: 'e2', title: 'Kemiprov', date: iso(16), kps: ['ph-skalan', 'indikatorer', 'syra-kanne'].map(k => 'k:kemi8-syror-baser/' + k), skillIds: [], deckIds: [] }];
      p().settings.scope = 'exams'; PA().save(); PA().LE.invalidate('k8');
      const U = new Set([...PA().V2.examCidsActive(kid(), p().exams[0]), ...PA().V2.examCidsActive(kid(), p().exams[1])]);
      const seen = new Set(); for (let d = 0; d < 4; d++) { toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); const pk = PA().V2.peekPlan(kid()).plan; pk.forEach(s => seen.add(s.cid)); ok(pk.every(s => U.has(s.cid)), `två prov dag ${d}: bara provens områden`); const g = T.$('[data-v2="kor"]'); if (g) { T.click(g); D.run(() => r() < 0.3, 60); } w.__advance(DAY); }
      ok([...seen].some(c => c.startsWith('k:kemi8')) && [...seen].some(c => c.startsWith('s:')), `två prov: båda proven tränas över dagarna (${[...seen].join(', ')})`); }

    // ---------- 4. Inget prov inom 28 dygn: ärligt kort, ingen Kör!; Klassisk samma; v1 påverkas inte ----------
    { const { w, T, PA } = await boot(29); const kid = () => PA().KIDS.find(k => k.id === 'k8'); const p = () => PA().DB.profiles.k8; const iso = (d) => new Date(w.Date.now() + d * DAY).toISOString().slice(0, 10);
      p().exams = [{ id: 'eF', title: 'Långt bort', date: iso(40), skillIds: ['forenkla'], deckIds: [] }]; p().removedDefaults = [...(p().removedDefaults || []), ...((kid().workExams || []).map(x => x.id))];
      p().settings.scope = 'exams'; PA().save(); PA().LE.invalidate('k8');
      const open = () => { toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
      open(); const home = norm(T.$('#app').textContent);
      ok(/INGA PROV ELLER LÄXOR JUST NU/.test(home) && !T.$('[data-v2="kor"]') && !T.$('[data-v2="flow"]'), `inget prov inom 28 dygn: ärligt kort, ingen Kör!-knapp (${home.slice(0, 120)})`);
      ok(/Öva på egen hand/.test(home), 'inget prov: Öva på egen hand finns kvar');
      p().exams.push({ id: 'eU', title: 'Engelskaläxa', date: iso(3), skillIds: [], deckIds: [] }); PA().save(); PA().LE.invalidate('k8'); open();
      { const h = norm(T.$('#app').textContent); ok(/ENGELSKALÄXA · INTE INLAGT ÄNNU/.test(h) && /områden är inte inlagda/.test(h) && !/INGA PROV ELLER LÄXOR/.test(h) && !T.$('[data-v2="kor"]'), `en läxa utan inlagda områden: ärligt, inte "inget prov" (${h.slice(0, 140)})`); }
      p().exams = p().exams.filter(e => e.id !== 'eU'); PA().save(); PA().LE.invalidate('k8');
      PA().EXP.set(kid(), 'classic'); PA().save(); open(); ok(/INGA PROV ELLER LÄXOR JUST NU/.test(norm(T.$('#app').textContent)) && !T.$('[data-v2="kor"]'), 'Klassisk: samma regel');
      p().exams.push({ id: 'eN', title: 'Algebraprov', date: iso(5), skillIds: ['forenkla', 'ekvation'], deckIds: [] }); PA().save(); PA().LE.invalidate('k8'); open();
      ok(T.$('[data-v2="kor"]') && PA().V2.peekPlan(kid()).plan.every(s => s.cid === 's:forenkla' || s.cid === 's:ekvation'), 'ett prov läggs in: Kör! finns och tränar provet');
      p().settings.engine = 'v1'; p().settings.engineAt = w.Date.now(); PA().save(); PA().LE.invalidate('k8'); ok(PA().V2.scopeCids(kid(), p()) === null, 'v1: inställningen gäller inte (reservmotorn som förut)'); }

    // ---------- 4b. KLAR efter ett annat pass (Revansch) när dagens plan är tom: ingen Kör!-knapp som inte startar något ----------
    for (const exp of ['achieve', 'classic']) { const { w, T, PA, D, r } = await boot(43 + exp.length); const kid = () => PA().KIDS.find(k => k.id === 'k8'); const p = () => PA().DB.profiles.k8;
      const open = () => { toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
      PA().EXP.set(kid(), exp); for (let d = 0; d < 3; d++) { open(); const g = T.$('[data-v2="kor"]'); if (g) { T.click(g); D.run(() => r() < 0.7, 60); } w.__advance(DAY); }
      p().exams = []; p().removedDefaults = [...(p().removedDefaults || []), ...((kid().workExams || []).map(x => x.id))]; p().settings.scope = 'exams'; PA().save(); PA().LE.invalidate('k8'); open();
      PA().V2.start(kid(), 'revansch'); if (PA().S && PA().S.v2) { D.run(() => r() < 0.3, 60);
        const klar = norm(T.$('#app').textContent); ok(!T.$('[data-v2="kor"]') && !/Ett pass till|Till dagens plan/.test(klar), `${exp}: KLAR efter Revansch erbjuder ingen Kör! när dagens plan är tom (${klar.slice(0, 120)})`); }
      else ok(false, `${exp}: Revansch-passet startade inte (testet förutsätter saker i Felboken)`); }

    // ---------- 4c. "Inget att öva idag" med ett prov med områden och en läxa utan: rätt prov, ärlig rad om läxan, Testa mig för provet ----------
    { const { w, T, PA } = await boot(47); const kid = () => PA().KIDS.find(k => k.id === 'k8'); const p = () => PA().DB.profiles.k8; const iso = (d) => new Date(w.Date.now() + d * DAY).toISOString().slice(0, 10);
      p().exams = [{ id: 'eA', title: 'Algebraprov', date: iso(10), skillIds: ['forenkla'], deckIds: [] }, { id: 'eB', title: 'Engelskaläxa', date: iso(2), skillIds: [], deckIds: [] }]; p().removedDefaults = [...(p().removedDefaults || []), ...((kid().workExams || []).map(x => x.id))];
      p().settings.scope = 'exams'; PA().save(); PA().LE.invalidate('k8');
      const real = PA().V2.peekPlan; PA().V2.peekPlan = (k) => { const o = real(k); const e = []; e.scopeEmpty = 'idle'; return { ...o, plan: e }; };   // dagen då inget av provet går att öva (svår att nå genom spel)
      toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); const h = norm(T.$('#app').textContent);
      ok(/INGET ATT ÖVA IDAG/.test(h) && /Allt inför Algebraprov är övat för idag/.test(h) && /Engelskaläxa: områdena är inte inlagda/.test(h) && T.$('[data-v2="testa"][data-exam="eA"]') && !T.$('[data-v2="kor"]'), `inget att öva idag: rätt prov, ärlig rad om läxan, Testa mig för provet (${h.slice(0, 200)})`);
      PA().V2.peekPlan = real; }

    // ---------- 5. Synk: senaste ändringen gäller, åt båda hållen ----------
    { const { PA } = await boot(31); const M = PA().mergeProfiles; const base = JSON.parse(JSON.stringify(PA().DB.profiles.k8));
      const a = { ...base, settings: { ...base.settings, scope: 'exams', scopeAt: 2000 } }, b = { ...base, settings: { ...base.settings, scope: 'all', scopeAt: 1000 } };
      ok(M(a, b).settings.scope === 'exams' && M(b, a).settings.scope === 'exams', 'synk: det senaste valet (Bara prov) gäller oavsett enhet');
      const c = { ...base, settings: { ...base.settings, scope: 'all', scopeAt: 3000 } }; ok(M(a, c).settings.scope === 'all' && M(c, a).settings.scope === 'all', 'synk: ett senare "Allt" gäller');
      const d0 = { ...base, settings: { ...base.settings } }; delete d0.settings.scope; d0.settings.scopeAt = 4000; ok(M(a, d0).settings.scope === undefined, 'synk: ett senare borttaget val från en annan enhet gäller (föräldraläget tar aldrig bort valet – det sparar "all")');
      const e0 = { ...base, settings: { ...base.settings } }; delete e0.settings.scope; delete e0.settings.scopeAt; ok(M(a, e0).settings.scope === 'exams' && M(e0, a).settings.scope === 'exams', 'synk: en enhet utan valet (äldre version) tar inte bort det'); }

    // ---------- 6. Föräldraläget: valet finns och sparas ----------
    { const { w, T, PA } = await boot(37); unlockParent(w, T); T.click(T.$('[data-tab="k8"]')); T.click(T.$('[data-sub="v2"]'));
      const btn = T.$('[data-v2="scope"][data-val="exams"]'); ok(!!btn && /Vad Kör! tränar/.test(norm(T.$('#app').textContent)), 'föräldraläget: "Vad Kör! tränar" finns');
      T.click(btn); ok(PA().DB.profiles.k8.settings.scope === 'exams' && PA().DB.profiles.k8.settings.scopeAt > 0 && T.$('[data-v2="scope"][data-val="exams"][aria-pressed="true"]'), 'föräldraläget: Bara prov och läxor sparas (med tidsstämpel för synken)');
      ok(!PA().DB.profiles.k4.settings.scope && !PA().DB.profiles.k2.settings.scope, 'gäller bara det valda barnet');
      T.click(T.$('[data-v2="scope"][data-val="all"]')); ok(PA().DB.profiles.k8.settings.scope === 'all', 'föräldraläget: tillbaka till Allt'); }
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'SCOPE EXAMS TEST FAILED' : 'SCOPE EXAMS TEST OK'); process.exit(fails ? 1 : 0);
})();
