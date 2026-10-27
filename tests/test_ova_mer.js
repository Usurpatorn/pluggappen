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
      click($('.go-btn[data-v2="kor"]')); D.run(() => false); const newAfterCore = PA().EXP.newToday(PA().LE.state(kid), PA().LE.now());
      let flows = 0; click($('[data-go="home"]')); while ($('[data-v2="flow"]') && flows < 5) { click($('[data-v2="flow"]')); D.run(() => false); flows++; click($('[data-go="home"]')); }
      ok(flows === PA().EXP.FLOW_MAX, `${id}: dygnets belönade extrablock som förut (${flows})`);
      let home = txt(T); const more = $('[data-v2="ovamer"]');
      ok(/vilar nu/.test(home) && !!more && /utan poäng/.test(more.textContent), `${id}: efter de belönade blocken – vila först, Öva mer finns (utan poäng)`);
      ok(!GUILT.test(home), `${id}: ingen skuld på hemmet`);
      w.__advance(10 * 60000); ok(!PA().S || !PA().S.v2 || !$('#qcard'), `${id}: inget startar av sig självt`);
      // tre Öva mer-block i rad: inga belöningar, motorns regler gäller, felen hanteras
      let blocks = 0; const r0 = rewardState(p()); const fb0 = PA().LE2.felbokVisible(PA().LE.state(kid).L, PA().LE.now()).length; const n0 = Object.values(PA().LE.state(kid).L.c).reduce((a, c) => a + c.n, 0);
      while ($('[data-v2="ovamer"]') && blocks < 3) {
        click($('[data-v2="ovamer"]')); const V = PA().S && PA().S.v2; ok(V && V.mode === 'more' && V.po === true, `${id}: Öva mer startat som övning (po)`);
        let k = 0; D.run((it) => it.cat !== 'learn' && (++k % 3 === 0)); blocks++;
        const klar = txt(T); ok(/ÖVNINGEN KLAR/.test(klar) && /inga poäng/.test(klar), `${id}: KLAR säger att extraövning inte ger poäng`);
        ok(!/\+\d+ ?XP|\+\d+ ?💎|Nytt märke/.test(klar), `${id}: inga XP, diamanter eller märken på KLAR`);
        ok(!!$('[data-go="home"]') && /Klar för idag/.test(klar), `${id}: tydlig slutpunkt efter blocket`);
        w.__advance(10 * 60000); if (blocks === 1) await sleep(1500); ok(!PA().S || !PA().S.v2 || !$('#qcard'), `${id}: inget nästa block startar av sig självt (även efter riktig väntan)`);
      }
      ok(blocks >= 2, `${id}: lärandet stoppas inte efter de belönade blocken (${blocks} Öva mer-block)`);
      // varje belöningsväg under ett övningsblock (märke, diamanter, uppdrag, XP, streak) återställs när något sparas
      if ($('[data-v2="ovamer"]')) { const r2 = rewardState(p()); click($('[data-v2="ovamer"]')); const pp = p(); pp.badges = [...pp.badges, 'testmarke']; pp.gems += 7; pp.xp += 11; pp.perfect = (pp.perfect || 0) + 1; pp.streak += 1; if (pp.quests && pp.quests.items && pp.quests.items[0]) pp.quests.items[0].claimed = true; PA().save();
        ok(rewardState(p()) === r2, `${id}: märken, diamanter, XP, uppdrag och streak återställs under Öva mer`); D.run(() => false); blocks++; }
      ok(rewardState(p()) === r0, `${id}: XP, diamanter, märken, uppdrag och streak oförändrade efter ${blocks} Öva mer-block`);
      const C1 = PA().LE.state(kid); const now = PA().LE.now();
      ok(Object.values(C1.L.c).reduce((a, c) => a + c.n, 0) > n0, `${id}: svaren i Öva mer blir bevis (kastas inte)`);
      ok(PA().LE2.felbokVisible(C1.L, now).length >= fb0, `${id}: felen hanteras som vanligt (Felboken)`);
      const inflated = Object.entries(C1.L.c).filter(([c, s]) => s.st - (st0[c] == null ? 0 : st0[c]) > 1).map(([c]) => c);
      ok(!inflated.length, `${id}: inget koncept mer än ett stadiesteg samma dygn (CORE + ${flows} FLOW + ${blocks} Öva mer): ${inflated.slice(0, 3)}`);
      const d0 = PA().LE2.dayIdx(now); const newHigh = Object.entries(C1.L.c).filter(([c, s]) => s.fs && PA().LE2.dayIdx(s.fs * 1000) === d0 && s.st >= 2).map(([c]) => c);
      ok(!newHigh.length, `${id}: inget som är nytt idag står på stadium 2 eller högre (${newHigh.slice(0, 3)})`);
      const newAll = PA().EXP.newToday(C1, now); ok(newAll <= Math.max(pol.maxNew, newAfterCore), `${id}: dygnets gräns för nytt håller (${newAfterCore} → ${newAll}, gräns ${pol.maxNew})`);
      const recs = p().le.shadow.filter(r => r.m === 'more'); ok(recs.length === blocks && recs.every(r => r.po === 1 && r.done === 1), `${id}: Öva mer sparas som övningsposter (m:'more', po:1)`);
      // provträning efter dygnets extrablock: utan poäng, och håller sig inom målet (även Boss, Rescue och omförsök)
      if (id === 'k8') {
        openKid(T, id); const mb = $('[data-v2="mission"]'); ok(!!mb && /Öva mer inför/.test(mb.textContent) && /utan poäng/.test(mb.textContent), `k8: Öva mer inför ett mål erbjuds (${mb && mb.textContent.trim()})`);
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
    // Ett mål med en befintlig extern resurs (kemi) och inget kvar att öva: länken visas, inget genereras
    { const { w, T, PA } = await (async () => { const b = await boot(5); return { ...b, PA: b.T.PA }; })(); const kid = PA().KIDS.find(k => k.id === 'k8');
      const res = PA().EXP.resources(kid, PA().LE.exams(kid, PA().DB.profiles.k8).find(e => e.id === 'w:syn-kemi'));
      ok(res.length >= 1 && res.every(r => /^https:\/\//.test(r.u)), `kemimålet har befintliga resurser (${res.length})`);
      const html = PA().EXP.enoughText(kid, { e: PA().LE.exams(kid, PA().DB.profiles.k8).find(e => e.id === 'w:syn-kemi') });
      ok(/rel="noopener noreferrer"/.test(html) && /target="_blank"/.test(html), 'resurslänken öppnas säkert i en ny flik'); }
    // Två enheter (offline): Öva mer på båda – inga belöningar efter sammanslagning
    { const a = await boot(7), b = await boot(7); const base = JSON.parse(JSON.stringify(a.T.PA().DB.profiles.k4));
      for (const dev of [a, b]) { const { T, D, w } = dev; const { $, click, PA } = T; openKid(T, 'k4'); click($('.go-btn[data-v2="kor"]')); D.run(() => false); click($('[data-go="home"]')); let f = 0; while ($('[data-v2="flow"]') && f++ < 5) { click($('[data-v2="flow"]')); D.run(() => false); click($('[data-go="home"]')); } }
      const xpA = a.T.PA().DB.profiles.k4.xp, xpB = b.T.PA().DB.profiles.k4.xp; const sx = (pp) => JSON.stringify([pp.since.xp, pp.since.gems, Object.fromEntries(Object.entries(pp.since.days || {}).map(([d, v]) => [d, v.xp]))]); const sA = sx(a.T.PA().DB.profiles.k4), sB = sx(b.T.PA().DB.profiles.k4);
      for (const dev of [a, b]) { const { T, D } = dev; const { $, click } = T; for (let i = 0; i < 2 && $('[data-v2="ovamer"]'); i++) { click($('[data-v2="ovamer"]')); D.run(() => false); click($('[data-go="home"]')); } }
      ok(a.T.PA().DB.profiles.k4.xp === xpA && b.T.PA().DB.profiles.k4.xp === xpB, 'två enheter: Öva mer ändrar inte XP på någon enhet');
      ok(sx(a.T.PA().DB.profiles.k4) === sA && sx(b.T.PA().DB.profiles.k4) === sB, 'två enheter: inga XP- eller diamantdelta att synka (aktiviteten räknas som vanligt)');
      const m = a.w.mergeProfiles(JSON.parse(JSON.stringify(a.T.PA().DB.profiles.k4)), JSON.parse(JSON.stringify(b.T.PA().DB.profiles.k4)), base);
      const rewardedA = xpA - base.xp, rewardedB = xpB - base.xp;
      ok(m.xp === base.xp + rewardedA + rewardedB, `två enheter: efter synk bara de belönade blocken (${m.xp} = ${base.xp} + ${rewardedA} + ${rewardedB})`);
      const recs = (m.le && m.le.shadow || []).filter(r => r.m === 'more'); ok(recs.length >= 2 && recs.every(r => r.po === 1), `två enheter: båda enheternas övningsposter finns kvar efter synk (${recs.length})`);
    }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'OVA MER TEST FAILED' : 'OVA MER TEST OK'); process.exit(fails ? 1 : 0);
})();
