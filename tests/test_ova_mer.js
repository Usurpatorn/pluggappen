/* 3.4 fas D – "Belöningar har tak, lärandet inte" (riktiga appen i jsdom, SYNTETISK familj och skoluppgifter, fast klocka).
   Efter dygnets belönade extrablock (FLOW_MAX FLOW) erbjuds frivillig "Öva mer" och "Öva mer inför <mål>":
   · inget startar av sig självt; efter varje block finns en tydlig slutpunkt ("Klar för idag"); ingen skuld
   · inga XP, diamanter, märken, uppdrag, streak eller belöningsrader (allt som är belöning återställs i save())
   · dygnets gräns för nytt gäller; inget koncept tar mer än ett stadiesteg samma dygn; nytt idag når aldrig stadium 2
   · fel hanteras som vanligt (motorns bevis, Felboken) – svaren kastas inte
   · passposten märks po:1; provträning efter dygnets extrablock är också utan poäng; provträningen håller sig inom målet (även Boss och Rescue)
   · när inget mer gör nytta: säg det ärligt (och visa en befintlig resurs om målet har en) – ingen utfyllnad
   · två enheter: Öva mer på båda ger inga belöningar efter synk */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, T_FIXED } = require('./le/childflow.js');
const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const txt = (T) => T.$('#app').textContent.replace(/\s+/g, ' ');
const GUILT = /missat|förlorat|tappa(r|t)? (din|streak)|streak(en)? (bryts|försvinner)|du har inte|glöm inte|synd att|ligger efter|ta igen/i;
const isoIn = (days) => new Date(T_FIXED + days * DAY).toISOString().slice(0, 10);
const CONTENT = { v: 1, updatedAt: 1, packs: [], work: [
  { id: 'syn-alg', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(12), skills: ['multin', 'forenkla', 'blandat', 'talfoljd', 'ekvation'] },
  { id: 'syn-kemi', kid: 'k8', type: 'exam', title: 'Kemiprov', date: isoIn(20), kps: ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer', 'k:kemi8-syror-baser/neutralisation'] },
] };
const rewardState = (p) => JSON.stringify({ xp: p.xp, gems: p.gems, badges: p.badges, perfect: p.perfect || 0, quests: p.quests, streak: p.streak, claimedAll: p.claimedAll || null });

async function boot(seed) { const w = mkWin({ seed, fixedClock: true }); await sleep(40); const T = tools(w); T.PA().FAMILY.apply(FIX); T.PA().load(); T.PA().FAMILY.applyContent(CONTENT); T.PA().rerender(); return { w, T, D: v2tools(w, T) }; }
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };

(async () => {
  try {
    for (const id of ['k8', 'k4', 'k2']) {
      const { w, T, D } = await boot(31); const { $, click, PA } = T; const kid = PA().KIDS.find(k => k.id === id); const p = () => PA().DB.profiles[id]; const pol = PA().LE.state(kid).pol;
      for (let d = 0; d < 2; d++) { openKid(T, id); click($('.go-btn[data-v2="kor"]')); D.run((it) => it.cat !== 'learn' && D.log.items % 4 === 0); w.__advance(DAY); }
      openKid(T, id); const C0 = PA().LE.state(kid); const st0 = Object.fromEntries(Object.entries(C0.L.c).map(([c, s]) => [c, s.st]));
      let wk = 0; click($('.go-btn[data-v2="kor"]')); D.run((it) => it.cat !== 'learn' && (++wk % 2 === 0)); const newAfterCore = PA().EXP.newToday(PA().LE.state(kid), PA().LE.now());
      let flows = 0; click($('[data-go="home"]')); while ($('[data-v2="flow"]') && flows < 5) { click($('[data-v2="flow"]')); D.run((it) => it.cat !== 'learn' && (++wk % 2 === 0)); flows++; click($('[data-go="home"]')); }
      ok(flows === PA().EXP.FLOW_MAX, `${id}: dygnets belönade extrablock som förut (${flows})`);
      let home = txt(T); const moreB = () => $('[data-v2="ovamer"]') || $('.mission.done [data-v2="mission"]') || $('[data-v2="mission"]'); const more = moreB();
      ok(/vilar nu/.test(home) && ((!!more && /utan poäng/.test(more.textContent)) || /inget mer som gör nytta/.test(home)), `${id}: efter de belönade blocken – vila först, sedan Öva mer (utan poäng) eller ärligt att inget mer gör nytta`);
      ok(!GUILT.test(home), `${id}: ingen skuld på hemmet`);
      w.__advance(10 * 60000); ok(!PA().S || !PA().S.v2 || !$('#qcard'), `${id}: inget startar av sig självt`);
      // tre Öva mer-block i rad: inga belöningar, motorns regler gäller, felen hanteras
      for (const q of ((p().quests || {}).items || [])) if (q.done && !q.claimed) w.eval('claimQuest')(kid, q.id);   // uppdrag som blev klara i de belönade blocken hämtas först (de får hämtas när som helst)
      const rw0 = JSON.stringify((p().le && p().le.rw) || []); let blocks = 0; const r0 = rewardState(p()); const fb0 = PA().LE2.felbokVisible(PA().LE.state(kid).L, PA().LE.now()).length; const n0 = Object.values(PA().LE.state(kid).L.c).reduce((a, c) => a + c.n, 0);
      while (moreB() && blocks < 6) {
        click(moreB()); const V = PA().S && PA().S.v2; ok(V && (V.mode === 'more' || V.mode === 'mission') && V.po === true, `${id}: Öva mer startat som övning (po, ${V && V.mode})`);
        if (blocks === 0) { const xc = p().xp; PA().V2.challengeXp(true); ok(p().xp === xc, `${id}: Utmaningens XP ges inte under Öva mer`); }
        let k = 0; D.run((it) => it.cat !== 'learn' && (++k % 3 === 0)); blocks++;
        const klar = txt(T); ok(/ÖVNINGEN KLAR/.test(klar) && /inga poäng/.test(klar), `${id}: KLAR säger att extraövning inte ger poäng`);
        ok(!/\+\d+ ?XP|\+\d+ ?💎|Nytt märke/.test(klar), `${id}: inga XP, diamanter eller märken på KLAR`);
        ok(!!$('[data-go="home"]') && /Klar för idag/.test(klar), `${id}: tydlig slutpunkt efter blocket`);
        w.__advance(10 * 60000); if (blocks === 1) await sleep(1500); ok(!PA().S || !PA().S.v2 || !$('#qcard'), `${id}: inget nästa block startar av sig självt (även efter riktig väntan)`);
      }
      ok(blocks >= 1 || /inget mer som gör nytta/.test(txt(T)), `${id}: lärandet stoppas inte efter de belönade blocken så länge något gör nytta (${blocks} Öva mer-block)`); if (id !== 'k2') ok(blocks >= 1, `${id}: minst ett Öva mer-block i den här fixturen (${blocks})`);
      if (blocks < 6) { const t6 = txt(T); ok(/inget mer som gör nytta/.test(t6) || !!$('[data-v2="mission"]'), `${id}: när Öva mer tar slut sägs det ärligt (ingen upprepning som utfyllnad)`); }
      // granskning: spärren gäller bara blocket – inte senare köp, synk, nollställning eller uppdrag (förut återställdes allt till blockets start)
      { const pp = p(); const x0 = pp.xp, g0 = pp.gems; ok(!PA().EXP.poActive(), `${id}: efter blocket är spärren av`);
        pp.gems += 40; pp.xp += 25; PA().save(); ok(p().gems === g0 + 40 && p().xp === x0 + 25, `${id}: belöningar efter blocket (t.ex. från synk) står kvar`);
        pp.gems -= 25; PA().save(); ok(p().gems === g0 + 15, `${id}: ett köp efter blocket kostar som vanligt`);
        // ett uppdrag som blev klart tidigare kan hämtas efter blocket och ger sin belöning
        const qs0 = JSON.stringify(pp.quests || null), ca0 = pp.claimedAll; const q = pp.quests && pp.quests.items && pp.quests.items.find(x => !x.claimed); if (q) { q.done = true; const xq = pp.xp; w.eval('claimQuest')(PA().KIDS.find(k => k.id === id), q.id); ok(p().xp > xq && q.claimed === true, `${id}: ett uppdrag efter blocket ger sin belöning`); }
        pp.quests = JSON.parse(qs0); pp.claimedAll = ca0; pp.gems = g0; pp.xp = x0; PA().save(); }
      { const A0 = JSON.parse(r0), A1 = JSON.parse(rewardState(p())); const diff = Object.keys(A0).filter(k => JSON.stringify(A0[k]) !== JSON.stringify(A1[k])).map(k => k + ':' + JSON.stringify(A0[k]).slice(0, 60) + '→' + JSON.stringify(A1[k]).slice(0, 60)); ok(!diff.length, `${id}: XP, diamanter, märken, uppdrag och streak oförändrade efter ${blocks} Öva mer-block ${diff.join(' | ')}`); }
      ok(JSON.stringify((p().le && p().le.rw) || []) === rw0, `${id}: motorns belöningsliggare förbrukas inte i Öva mer`);
      const C1 = PA().LE.state(kid); const now = PA().LE.now();
      if (blocks) ok(Object.values(C1.L.c).reduce((a, c) => a + c.n, 0) > n0, `${id}: svaren i Öva mer blir bevis (kastas inte)`);
      ok(PA().LE2.felbokVisible(C1.L, now).length >= fb0, `${id}: felen hanteras som vanligt (Felboken)`);
      const inflated = Object.entries(C1.L.c).filter(([c, s]) => s.st - (st0[c] == null ? 0 : st0[c]) > 1).map(([c]) => c);
      ok(!inflated.length, `${id}: inget koncept mer än ett stadiesteg samma dygn (CORE + ${flows} FLOW + ${blocks} Öva mer): ${inflated.slice(0, 3)}`);
      const d0 = PA().LE2.dayIdx(now); const newHigh = Object.entries(C1.L.c).filter(([c, s]) => s.fs && PA().LE2.dayIdx(s.fs * 1000) === d0 && s.st >= 2).map(([c]) => c);
      ok(!newHigh.length, `${id}: inget som är nytt idag står på stadium 2 eller högre (${newHigh.slice(0, 3)})`);
      const newAll = PA().EXP.newToday(C1, now); ok(newAll <= Math.max(pol.maxNew, newAfterCore), `${id}: dygnets gräns för nytt håller (${newAfterCore} → ${newAll}, gräns ${pol.maxNew})`);
      const recs = p().le.shadow.filter(r => r.po === 1); ok(recs.length === blocks && recs.every(r => r.done === 1 && (r.m === 'more' || r.m === 'mission')), `${id}: Öva mer sparas som övningsposter (po:1)`);
      // provträning efter dygnets extrablock: utan poäng, och håller sig inom målet (även Boss, Rescue och omförsök)
      if (id === 'k8') {
        openKid(T, id); const mb = $('[data-v2="mission"]'); ok(mb ? /Öva mer inför/.test(mb.textContent) && /utan poäng/.test(mb.textContent) : /inget mer som gör nytta/.test(txt(T)), `k8: Öva mer inför ett mål erbjuds när provträningen gör nytta, annars ärlig text (${mb ? mb.textContent.trim() : 'inget kvar'})`);
        if (mb) { const exId = mb.dataset.exam; click(mb); const V = PA().S.v2; ok(V.mode === 'mission' && V.po === true, 'k8: provträning efter dygnets extrablock är utan poäng');
          const e = PA().LE.exams(kid, p()).find(x => x.id === exId); const set = new Set(PA().V2.examCidsActive(kid, e)); const r1 = rewardState(p()); const out = [];
          let n = 0; while (PA().S && PA().S.v2 && $('#qcard') && n++ < 60) { const it = PA().S.queue[PA().S.i]; if (it.spec && it.spec.cid && !set.has(it.spec.cid)) out.push((it.spec.role || '?') + ':' + it.spec.cid); D.answer(() => n % 2 === 0); w.__advance(4000); }
          ok(!out.length, `k8: provträningen höll sig inom målet, även Boss/Rescue/omförsök (${out.slice(0, 3)})`);
          ok(rewardState(p()) === r1, 'k8: inga belöningar i provträning efter dygnets extrablock'); }
      }
      // när inget mer gör nytta: ärligt, ingen knapp som startar utfyllnad, en befintlig resurs om målet har en
      openKid(T, id); PA().EXP.peekFlow = () => []; const vp = PA().V2.plan; PA().V2.plan = (k, mode, ...r) => (mode === 'mission' ? [] : vp(k, mode, ...r)); PA().rerender(); openKid(T, id); home = txt(T);
      ok(!$('[data-v2="ovamer"]') && !$('[data-v2="mission"]') && /inget mer som gör nytta att öva i appen idag/.test(home), `${id}: slut på nyttigt innehåll sägs ärligt (${home.slice(0, 80)})`);
    }
    // Dygnets belönade extrablock är FLOW + provträning tillsammans (högst tre), och Testa mig ger poäng en gång per dygn (granskning)
    { const { T, D } = await boot(17); const { $, click, PA } = T; const kid = PA().KIDS.find(k => k.id === 'k8'); openKid(T, 'k8'); click($('.go-btn[data-v2="kor"]')); D.run(() => false);
      const ex = PA().LE.exams(kid, PA().DB.profiles.k8).find(e => e.id === 'w:syn-alg'); let m = 0;
      for (let i = 0; i < 3; i++) { PA().V2.start(kid, 'mission', { examId: ex.id }); if (PA().S && PA().S.v2) { m++; D.run(() => false); } }
      openKid(T, 'k8'); ok(m === 3 && !$('[data-v2="flow"]'), `tre provträningar: inget belönat FLOW-block därefter (${m})`); ok(/vilar nu/.test(txt(T)), 'tre provträningar: hemmet visar vila-läget (inte "Allt för idag är gjort" utan val)');
      PA().V2.start(kid, 'mission', { examId: ex.id }); ok(PA().S && PA().S.v2 && PA().S.v2.po === true, 'fjärde provträningen är utan poäng'); D.run(() => false);
      PA().V2.start(kid, 'exam', { examId: ex.id }); ok(PA().S.v2.po !== true, 'dagens första Testa mig ger poäng'); D.run(() => false);
      const x1 = PA().DB.profiles.k8.xp; PA().V2.start(kid, 'exam', { examId: ex.id }); ok(PA().S.v2.po === true, 'andra Testa mig samma dygn är utan poäng'); D.run(() => false);
      ok(PA().DB.profiles.k8.xp === x1 && /bara för att se läget/.test(txt(T)), `andra Testa mig: inga XP och det sägs (${PA().DB.profiles.k8.xp - x1})`); }
    // Allt rätt i CORE och FLOW: det som återstår har redan blivit rätt idag – då ingen Öva mer (bara upprepning) utan ärlig text
    { const { T, D } = await boot(13); const { $, click } = T; openKid(T, 'k4'); click($('.go-btn[data-v2="kor"]')); D.run(() => false); click($('[data-go="home"]')); let f = 0; while ($('[data-v2="flow"]') && f++ < 5) { click($('[data-v2="flow"]')); D.run(() => false); click($('[data-go="home"]')); }
      const useful = T.PA().EXP.useful(T.PA().EXP.peekFlow(T.PA().KIDS.find(k => k.id === 'k4')), T.PA().KIDS.find(k => k.id === 'k4')); const t = txt(T);
      ok(useful ? !!$('[data-v2="ovamer"]') : (!$('[data-v2="ovamer"]') && /inget mer som gör nytta/.test(t)), `allt rätt idag: Öva mer bara om något återstår som inte redan blivit rätt (${useful ? 'återstår' : 'inget kvar – ärlig text'})`); }
    // Ett avbrutet övningsblock spärrar inte senare belöningar
    { const { T, D } = await boot(23); const { $, click, PA } = T; const kid = PA().KIDS.find(k => k.id === 'k8'); openKid(T, 'k8'); click($('.go-btn[data-v2="kor"]')); D.run(() => false);
      const ex = PA().LE.exams(kid, PA().DB.profiles.k8).find(e => e.id === 'w:syn-alg'); for (let i = 0; i < 3; i++) { PA().V2.start(kid, 'mission', { examId: ex.id }); if (PA().S && PA().S.v2) D.run(() => false); }
      PA().V2.start(kid, 'mission', { examId: ex.id }); ok(PA().EXP.poActive(), 'övningsblocket pågår'); D.answer(() => false); click($('[data-go="home"]') || $('[data-go="start"]'));
      ok(!PA().EXP.poActive(), 'avbrutet block: spärren gäller inte utanför övningsskärmen'); }
    // Granskarens fall (k4, frö 41, två dygn historik): Öva mer tar slut av sig själv
    { const { T, D, w } = await boot(41); const { $, click } = T; for (let d = 0; d < 2; d++) { openKid(T, 'k4'); click($('.go-btn[data-v2="kor"]')); D.run((it) => it.cat !== 'learn' && D.log.items % 4 === 0); w.__advance(DAY); }
      openKid(T, 'k4'); click($('.go-btn[data-v2="kor"]')); D.run(() => false); click($('[data-go="home"]')); let f = 0; while ($('[data-v2="flow"]') && f++ < 5) { click($('[data-v2="flow"]')); D.run(() => false); click($('[data-go="home"]')); }
      let n = 0; while ($('[data-v2="ovamer"]') && n < 25) { click($('[data-v2="ovamer"]')); let k = 0; D.run(() => (++k % 2 === 0)); n++; openKid(T, 'k4'); }
      ok(n < 25 && /inget mer som gör nytta/.test(txt(T)), `k4 frö 41: Öva mer tar slut även när varannan uppgift blir fel (${n} block)`); }
    // Ingen ändlös upprepning: Öva mer gång på gång (allt rätt) tar slut med ärlig text (granskning: samma plan erbjöds 25 gånger)
    for (const [kidId, seed] of [['k4', 41], ['k2', 41], ['k8', 41]]) { const { T, D } = await boot(seed); const { $, click } = T; openKid(T, kidId); let wk = 0; click($('.go-btn[data-v2="kor"]')); D.run((it) => it.cat !== 'learn' && (++wk % 2 === 0)); click($('[data-go="home"]'));
      let f = 0; while ($('[data-v2="flow"]') && f++ < 5) { click($('[data-v2="flow"]')); D.run((it) => it.cat !== 'learn' && (++wk % 2 === 0)); click($('[data-go="home"]')); }
      let n = 0; while (($('[data-v2="ovamer"]') || $('[data-v2="mission"]')) && n < 25) { click($('[data-v2="ovamer"]') || $('[data-v2="mission"]')); D.run(() => false); n++; openKid(T, kidId); }
      ok(n < 25 && /inget mer som gör nytta/.test(txt(T)), `${kidId}: Öva mer tar slut när inget gör nytta – ingen ändlös upprepning (${n} block)`); }
    // Ett mål med en befintlig extern resurs (kemi) och inget kvar att öva: länken visas, inget genereras
    { const { w, T, PA } = await (async () => { const b = await boot(5); return { ...b, PA: b.T.PA }; })(); const kid = PA().KIDS.find(k => k.id === 'k8');
      const res = PA().EXP.resources(kid, PA().LE.exams(kid, PA().DB.profiles.k8).find(e => e.id === 'w:syn-kemi'));
      ok(res.length >= 1 && res.every(r => /^https:\/\//.test(r.u)), `kemimålet har befintliga resurser (${res.length})`);
      const html = PA().EXP.enoughText(kid, { e: PA().LE.exams(kid, PA().DB.profiles.k8).find(e => e.id === 'w:syn-kemi') });
      ok(/rel="noopener noreferrer"/.test(html) && /target="_blank"/.test(html), 'resurslänken öppnas säkert i en ny flik'); }
    // Två enheter (offline): Öva mer på båda – inga belöningar efter sammanslagning
    { const a = await boot(7), b = await boot(7); let base = null;
      for (const dev of [a, b]) { const { T, D, w } = dev; const { $, click, PA } = T; let wk = 0; for (let d = 0; d < 2; d++) { openKid(T, 'k8'); click($('.go-btn[data-v2="kor"]')); D.run((it) => it.cat !== 'learn' && D.log.items % 4 === 0); w.__advance(DAY); } { const pp = PA().DB.profiles.k8; pp.since = { xp: 0, gems: 0, days: {} }; pp._lx = pp.xp; pp._lg = pp.gems; }   // som efter en synk: samma utgångsläge på båda (samma frö)
      if (!base) base = JSON.parse(JSON.stringify(PA().DB.profiles.k8)); else if (PA().DB.profiles.k8.xp !== base.xp) ok(false, 'två enheter: olika utgångsläge'); openKid(T, 'k8'); click($('.go-btn[data-v2="kor"]')); D.run((it) => it.cat !== 'learn' && (++wk % 2 === 0)); click($('[data-go="home"]')); let f = 0; while ($('[data-v2="flow"]') && f++ < 5) { click($('[data-v2="flow"]')); D.run((it) => it.cat !== 'learn' && (++wk % 2 === 0)); click($('[data-go="home"]')); } }
      const xpA = a.T.PA().DB.profiles.k8.xp, xpB = b.T.PA().DB.profiles.k8.xp; const sx = (pp) => JSON.stringify([pp.since.xp, pp.since.gems, Object.fromEntries(Object.entries(pp.since.days || {}).map(([d, v]) => [d, v.xp]))]); const sA = sx(a.T.PA().DB.profiles.k8), sB = sx(b.T.PA().DB.profiles.k8);
      let nMore = 0; for (const dev of [a, b]) { const { T, D } = dev; const { $, click } = T; for (let i = 0; i < 2 && ($('[data-v2="ovamer"]') || $('[data-v2="mission"]')); i++) { click($('[data-v2="ovamer"]') || $('[data-v2="mission"]')); nMore++; D.run(() => false); click($('[data-go="home"]')); } }
      ok(a.T.PA().DB.profiles.k8.xp === xpA && b.T.PA().DB.profiles.k8.xp === xpB, 'två enheter: Öva mer ändrar inte XP på någon enhet');
      ok(sx(a.T.PA().DB.profiles.k8) === sA && sx(b.T.PA().DB.profiles.k8) === sB, 'två enheter: inga XP- eller diamantdelta att synka (aktiviteten räknas som vanligt)');
      const m = a.w.mergeProfiles(JSON.parse(JSON.stringify(a.T.PA().DB.profiles.k8)), JSON.parse(JSON.stringify(b.T.PA().DB.profiles.k8)), base);
      const rewardedA = xpA - base.xp, rewardedB = xpB - base.xp;
      ok(m.xp === base.xp + rewardedA + rewardedB, `två enheter: efter synk bara de belönade blocken (${m.xp} = ${base.xp} + ${rewardedA} + ${rewardedB})`);
      const recs = (m.le && m.le.shadow || []).filter(r => r.po === 1); ok(recs.length === nMore && recs.every(r => r.po === 1), `två enheter: båda enheternas övningsposter finns kvar efter synk (${recs.length} av ${nMore})`); ok(nMore >= 1, `två enheter: minst ett Öva mer-block spelades (${nMore})`);
    }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'OVA MER TEST FAILED' : 'OVA MER TEST OK'); process.exit(fails ? 1 : 0);
})();
