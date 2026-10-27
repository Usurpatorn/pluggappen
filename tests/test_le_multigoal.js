/* 3.4 Flera samtidiga mål (Äldre, syntetisk familj, riktiga appen i jsdom, fast klocka och slump).
   Rapporterat problem (syntetisk motsvarighet: ett mindre förhör, fem dygn senare ett större prov, ytterligare åtta dygn senare ett större prov): det NÄRMASTE målet – vilket som helst –
   satte provveckans broms på ny inlärning i hela planen, så ett litet läxförhör stoppade nytt inom algebra och kemi.
   Regeln nu (LE2.planSession, LE.isMajor):
     · bara ett STÖRRE mål (prov) bromsar ny inlärning i hela planen; ett mindre (läxförhör/glosförhör – typ homework/vocab, eller
       förälderns val weight:'minor') får egen prioritet (vikt 0,6) och sina sista dygn, men stryper inte andra mål
     · standard utan uppgift om storlek: som förut (större) – gamla prov och uppgifter beter sig likadant
     · ett mindre måls sista dygn: inga osedda koncept som bara hör dit
     · ett större provs vecka bromsar annat nytt, men provets egna osedda koncept får introduceras som vanligt
     · ett mål med fler osedda koncept än dygn kvar får +1 nytt per pass under ett annat provs vecka (aldrig vid överlast)
     · hemmets rubrik är målet dagens plan faktiskt tränar mest, inte bara det närmaste datumet
     · målrättvisa: ett större prov inom 14 dygn (ett annat mål närmare) vars övade koncept inte setts på 3 dygn får ett av dem (repetition)
     · M8: dagen före och på dagen för ett större prov kommer inget osett in – inte heller osett med förkunskap kvar (förut en läcka)
     · en tom plan: ingen Boss utan koncept, och hemmet säger det ärligt i stället för en KÖR-knapp som inte startar något
     · föräldern: mål och täckning (storlek + varför, påbörjade områden, risk med planerarens egen regel), ändra storlek, storlek i formuläret
   Inget här lovar provresultat; måttet är introduktion, återhämtning ett senare dygn och att inget mål svälter. */
'use strict';   // LE_HTML=<bygge> kör samma kontroller mot ett annat bygge (t.ex. 3.3 för att visa att testet fångar felet)
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { simulate, GOALS } = require('./le/multigoal_sim.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);

(async () => {
  try {
    /* 1. Planeraren direkt: ett mindre mål imorgon och ett större om tio dygn */
    { const w = mkWin({ seed: 3, fixedClock: true, file: process.env.LE_HTML }); await sleep(40); const T = tools(w); const PA = T.PA; const fix = JSON.parse(JSON.stringify(FIX)); for (const k of fix.kids) if (k.id === 'k8') k.exams = [];
      PA().FAMILY.apply(fix); PA().load(); PA().rerender(); const kid = PA().KIDS.find(k => k.id === 'k8'); const p = PA().DB.profiles.k8; const now = w.Date.now();
      const plan = (goals) => { p.exams = goals; PA().LE.invalidate('k8'); return PA().V2.peekPlan(kid).plan; };
      const C = PA().LE.state(kid); const pol = C.pol; const cids = (g) => PA().LE.examCids(C, g);
      const quiz = { ...GOALS.quiz, date: iso(now + 1 * DAY) }, alg = { ...GOALS.alg, date: iso(now + 10 * DAY) };
      const isNew = (cid) => !(C.L.c[cid] && C.L.c[cid].n > 0); const qOnly = new Set(cids(quiz)); const aSet = new Set(cids(alg));
      let pl = plan([quiz, alg]);
      ok(pl.maxNew === pol.maxNew, `mindre mål imorgon: ingen broms på annat nytt (maxNew ${pl.maxNew}, policy ${pol.maxNew})`);
      ok(pl.some(s => aSet.has(s.cid) && isNew(s.cid)), 'mindre mål imorgon: ett nytt algebrakoncept får komma');
      ok(!pl.some(s => qOnly.has(s.cid) && !aSet.has(s.cid) && isNew(s.cid)), 'mindre mål imorgon: inga osedda koncept som bara hör till förhöret');
      pl = plan([{ ...quiz, weight: 'major' }, alg]); ok(pl.maxNew === 0, `förälderns val "större" på läxan: bromsen som för ett prov (maxNew ${pl.maxNew})`);
      pl = plan([{ ...quiz, kind: undefined }, alg]); ok(pl.maxNew === 0, `inlagt prov utan typ (gamla data): som förut, större (maxNew ${pl.maxNew})`);
      pl = plan([{ ...quiz, kind: 'exam', weight: 'minor' }, alg]); ok(pl.maxNew === pol.maxNew, `förälderns val "mindre" på ett prov: ingen global broms (maxNew ${pl.maxNew})`);
      pl = plan([{ ...quiz, kind: 'vocab' }, alg]); ok(pl.maxNew === pol.maxNew, `glosförhör (vocab) är mindre som standard (maxNew ${pl.maxNew})`);
      // gemensamma koncept: ett förhör som täcker samma moment som provet – förhörets sista dygn får inte stoppa provets koncept
      pl = plan([{ ...quiz, id: 'mg-quiz-delad', skillIds: alg.skillIds.slice() }, alg]);
      ok(pl.some(s => aSet.has(s.cid) && isNew(s.cid)), 'gemensamt koncept: förhörets sista dygn blockerar inte ett koncept som också hör till ett senare prov');
      // M8 (granskning): större prov imorgon – inget osett alls, inte heller osett med förkunskap kvar (parts.new 0, förut en läcka), och ingen tom Boss
      pl = plan([{ ...alg, date: iso(now + 1 * DAY) }, { ...quiz, date: iso(now + 10 * DAY) }]);
      ok(pl.maxNew === 0 && !pl.some(s => isNew(s.cid)), `provkvällen: inga osedda koncept i planen (${pl.filter(s => isNew(s.cid)).map(s => s.role).join(',') || 'inga'})`);
      ok(pl.every(s => typeof s.cid === 'string'), 'ingen planplats utan koncept (tom Boss)');
      // hemmet med en tom plan: ingen KÖR-knapp som inte startar något, ärlig text
      { const { toStart } = require('./le/v2driver.js'); PA().save(); toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]'));
        const home = T.$('#app').textContent.replace(/\s+/g, ' ');
        ok(!pl.length, 'fixturen ger en tom plan (inget sett, provkväll)');
        if (!pl.length) { ok(!T.$('[data-v2="kor"]') && /Dagen före ett prov tar Kör! inte in något nytt/.test(home) && !/cirka 0 min|0 uppgifter/.test(home), 'tom plan: ärligt hem utan KÖR-knapp'); }
        else ok(!!T.$('[data-v2="kor"]'), 'plan finns: KÖR-knappen finns'); }
      // större prov om fem dygn: annat nytt bromsas till ett, provets egna osedda koncept får komma
      const alg3 = { ...alg, skillIds: alg.skillIds.slice(0, 3), date: iso(now + 7 * DAY) }; const a3 = new Set(cids(alg3));   // tre osedda < sju dygn − 3: inget täckningstryck, bara undantaget prövas
      pl = plan([alg3, { ...GOALS.kemi, date: iso(now + 20 * DAY) }]); const newHere = pl.filter((s, i) => isNew(s.cid) && pl.findIndex(x => x.cid === s.cid) === i);
      const newAlg = newHere.filter(s => a3.has(s.cid)).length, newOther = newHere.filter(s => !a3.has(s.cid)).length;
      ok(pl.maxNew === 1 && newOther <= 1 && newAlg >= Math.min(2, [...a3].filter(isNew).length), `provvecka: bromsen ger 1 nytt för annat, men provets egna osedda koncept får komma utöver det (${newAlg} nya i provet, ${newOther} annat)`);
      /* 1b. Föräldern: mål och täckning, storlek med förklaring, ändra storlek, lägga till med storlek (fas B/C) */
      try { const { unlockParent } = require('./le/v2driver.js'); const { $, click } = T; const doc = w.document;
        const legacy = { id: 'mg-legacy', title: 'Gammalt prov', date: iso(now + 2 * DAY), skillIds: alg.skillIds.slice(), deckIds: [] };   // inlagt före 3.4: ingen typ, ingen storlek
        p.exams = [legacy, { ...GOALS.quiz, date: iso(now + 30 * DAY) }]; PA().LE.invalidate('k8'); PA().save();
        const parentV = () => { unlockParent(w, T); click($('[data-tab="k8"]')); if ($('[data-sub="overview"]')) click($('[data-sub="overview"]')); return doc.querySelector('#app').textContent.replace(/\s+/g, ' '); };
        let txt = parentV();
        ok(/mål och täckning/.test(txt), 'föräldern ser kortet mål och täckning');
        ok(/Gammalt prov[^]*?Större \(prov\) · standard för prov/.test(txt), 'gamla data utan storlek: större, förklarat som standard');
        ok(/Läxförhör svenska[^]*?Mindre \(förhör eller läxa\) · standard för läxa och förhör/.test(txt), 'läxförhör: mindre som standard, förklarat');
        ok(/Risk:<?\/?b?>? ?7 av 7 områden är inte påbörjade/.test(txt.replace(/<[^>]+>/g, '')) || /Risk: 7 av 7 områden är inte påbörjade/.test(txt), 'täckningsrisk visas när osedda områden är fler än dagarna före de sista tre');
        ok(/14 av 14 områden är inte påbörjade än · 29 dagar kvar/.test(txt) && !/Risk: 14/.test(txt), 'utan risk: bara läget, ingen varning');
        const card = [...doc.querySelectorAll('.card')].find(c => /mål och täckning/.test(c.textContent)); const ct = card ? card.textContent.replace(/\s+/g, ' ') : '';
        ok(!/minuter efter|ligger efter|har missat|ta igen|i kapp/i.test(ct), 'ingen skuld, "efter" eller ikappkörning i kortet');
        ok(/Inget här är en prognos för provresultatet/.test(ct) && !/kommer att klara|redo för provet|\d+ ?%/.test(ct), 'ingen prognos eller procent utlovas');
        const b = doc.querySelector('[data-ex-weight="mg-legacy"]'); ok(!!b && /Ändra till mindre/.test(b.textContent), 'inlagt prov: knapp för att ändra storlek');
        const before = PA().V2.peekPlan(kid).plan.maxNew; click(b);
        ok(p.exams.find(x => x.id === 'mg-legacy').weight === 'minor', 'förälderns val sparas på provet (synkas som en ändring av provet)');
        PA().LE.invalidate('k8'); const after = PA().V2.peekPlan(kid).plan.maxNew;
        ok(before === 0 && after === pol.maxNew, `förälderns val styr bromsen (maxNew ${before} → ${after})`);
        txt = doc.querySelector('#app').textContent.replace(/\s+/g, ' '); ok(/Gammalt prov[^]*?Mindre \(förhör eller läxa\) · ditt val/.test(txt), 'kortet visar förälderns val');
        click(doc.querySelector('[data-ex-weight="mg-legacy"]')); ok(p.exams.find(x => x.id === 'mg-legacy').weight === 'major', 'och tillbaka till större');
        // lägga till med storlek (bara v2-barn har valet; v1:s föräldravy är frusen)
        click($('[data-sub="exams"]')); ok(!!doc.querySelector('input[name=ex_weight][value=minor]'), 'formuläret har storlek');
        doc.getElementById('exTitle').value = 'Glosförhör v.9'; doc.querySelector('input[name=ex_weight][value=minor]').checked = true; doc.querySelector('input[name=ex_weight][value=major]').checked = false;
        click(doc.querySelector('[data-act="addExam"]')); const added = p.exams.find(x => x.title === 'Glosförhör v.9'); ok(!!added && added.weight === 'minor', 'nytt mål sparas med vald storlek');
        p.exams = []; PA().save(); } catch (e) { ok(false, 'förälderns kort: ' + String(e && e.message || e).slice(0, 80)); p.exams = []; }
      /* 1c. Policyns gräns per pass i ett provs vecka – alla tre policyer (granskning av 3.4). Ett ENSAMT prov: exakt 3.3:s regel (högst
         ett nytt). Flera mål: aldrig fler än policyn (yngre 1, mellan 2, äldre 3), annat mål högst +1. De sista tre dygnen: inget osett. */
      for (const kidId of ['k2', 'k4', 'k8']) try { const kd = PA().KIDS.find(k => k.id === kidId); const pp = PA().DB.profiles[kidId]; const C2 = PA().LE.state(kd); const pol2 = C2.pol;
        const sk = kd.skills.map(s0 => s0.id).filter(id => PA().LE.cidsOfSkill(C2, id).length); const near = (d) => ({ id: 'mg-n', title: 'Prov', kind: 'exam', date: iso(now + d * DAY), skillIds: sk.slice(0, 8), deckIds: [] });
        const far = { id: 'mg-f', title: 'Senare prov', kind: 'exam', date: iso(now + 16 * DAY), skillIds: sk.slice(8, 20), deckIds: [] };
        const pl2 = (goals) => { pp.exams = goals; PA().LE.invalidate(kidId); return PA().V2.peekPlan(kd).plan; }; const unseen = (c) => !(C2.L.c[c] && C2.L.c[c].n > 0);
        const newIn = (pl0) => [...new Set(pl0.filter(x => x.role !== 'boss' && unseen(x.cid)).map(x => x.cid))];   // Bossen väljs om under passet bland det som spelats
        const nearC = new Set(PA().LE.examCids(C2, near(5))), farC = new Set(PA().LE.examCids(C2, far));
        for (const d of [7, 6, 5, 4]) { const p1 = pl2([near(d)]); const a1 = [...new Set(p1.filter(x => x.role !== 'boss' && unseen(x.cid) && x.parts && x.parts.new > 0).map(x => x.cid))]; ok(a1.length <= 1, `${kidId} (${pol2.name}): ensamt prov om ${d} dygn – högst ett nytt enligt provveckans regel, som i 3.3 (${a1.length}); osett utan förkunskap via provets vikt är oförändrat från 3.3`);
          const a2 = newIn(pl2([near(d), far])); ok(a2.length <= pol2.maxNew, `${kidId} (${pol2.name}): två prov, det närmaste om ${d} dygn – högst policyns ${pol2.maxNew} nya (${a2.length})`);
          ok(a2.filter(c => farC.has(c) && !nearC.has(c)).length <= 1, `${kidId}: det senare provet högst +1 under det närmaste provets vecka`); }
        for (const d of [3, 2, 1]) { const a3x = newIn(pl2([near(d), far])); ok(a3x.length === 0, `${kidId}: ${d} dygn före ett större prov – inget osett (${a3x.length})`); }
        pp.exams = []; PA().LE.invalidate(kidId); } catch (e) { ok(false, `${kidId}: provveckan gick inte att planera (${String(e && e.message || e).slice(0, 60)})`); }
      /* 1d. Storlek på en skoluppgift (work.json weight) hela vägen genom appen */
      { const fx2 = JSON.parse(JSON.stringify(FIX)); const cont = { v: 1, updatedAt: 2, packs: [], work: [{ id: 'syn-forhor', kid: 'k8', type: 'exam', weight: 'minor', title: 'Litet prov', date: iso(now + 1 * DAY), skills: GOALS.quiz.skillIds.slice() }] };
        PA().FAMILY.applyContent(cont); const kd8 = PA().KIDS.find(k => k.id === 'k8'); p.exams = [alg]; PA().LE.invalidate('k8');
        const we = PA().LE.exams(kd8, PA().DB.profiles.k8).find(e => e.id === 'w:syn-forhor'); ok(we && we.weight === 'minor' && PA().LE.isMajor(we) === false, 'skoluppgiftens weight: minor följer med till appen');
        ok(PA().V2.peekPlan(kd8).plan.maxNew === PA().LE.state(kd8).pol.maxNew, 'ett prov som föräldern märkt som mindre i skoluppgiften bromsar inte annat nytt');
        PA().FAMILY.clearContent(); p.exams = []; PA().LE.invalidate('k8'); }
    }
    /* 2. Tre mål över en månad, åtta körningar (frön × rätt-andel) – jämfört med samma utan läxförhöret */
    const runs = []; for (const seed of [5, 13, 31, 77]) for (const pc of [0.7, 0.85]) runs.push({ seed, pc });
    const agg = async (goals) => { const a = {}; let maxNewDay = 0; const heads = []; for (const r of runs) { const R = await simulate({ goals, seed: r.seed, pCorrect: r.pc, file: process.env.LE_HTML }); maxNewDay = Math.max(maxNewDay, R.maxNewPerDay); heads.push(...R.headlines);
      for (const [id, g] of Object.entries(R.goals)) { const x = a[id] = a[id] || { n: 0, c: g.concepts, intro: 0, del: 0, gap: 0 }; x.n++; x.intro += g.introducedBefore; x.del += g.delayedRetrieval; x.gap = Math.max(x.gap, g.maxGapLast2Weeks); } }
      for (const x of Object.values(a)) { x.intro /= x.n; x.del /= x.n; } return { a, maxNewDay, heads }; };
    const three = await agg(['quiz', 'alg', 'kemi']); const ctrl = await agg(['alg', 'kemi']);
    const f = (x) => x.toFixed(1); const T3 = three.a, C2 = ctrl.a;
    console.log(`  tre mål: förhör ${f(T3['mg-quiz'].intro)}/${T3['mg-quiz'].c} · algebra ${f(T3['mg-alg'].intro)}/${T3['mg-alg'].c} · kemi ${f(T3['mg-kemi'].intro)}/${T3['mg-kemi'].c} introducerade före datum`);
    console.log(`  kontroll (utan förhöret): algebra ${f(C2['mg-alg'].intro)} · kemi ${f(C2['mg-kemi'].intro)}`);
    ok(T3['mg-alg'].intro >= 6.3, `algebra introduceras före provet trots läxförhöret (${f(T3['mg-alg'].intro)} av 7; före 3.4 ≈ 5,3)`);
    ok(T3['mg-kemi'].intro >= 7.0, `kemi får nytt trots förhör och algebra (${f(T3['mg-kemi'].intro)} av 19; före 3.4 ≈ 7,3)`);
    ok(T3['mg-quiz'].intro >= 9.0, `läxförhöret får sitt (${f(T3['mg-quiz'].intro)} av 14 – inte oviktigt, men inte allt)`);
    ok(C2['mg-alg'].intro >= 6.9 && C2['mg-kemi'].intro >= 12.0, `utan förhöret som förut (algebra ${f(C2['mg-alg'].intro)}, kemi ${f(C2['mg-kemi'].intro)})`);
    for (const [id, x] of Object.entries(T3)) { ok(x.del >= 0.85 * x.intro, `${id}: introducerat övas igen ett senare dygn före datum (${f(x.del)} av ${f(x.intro)})`); ok(x.gap < 5, `${id}: inget uppehåll på fem dygn de sista två veckorna (${x.gap})`); }
    ok(three.maxNewDay <= 4, `högst fyra nya koncept samma dygn (${three.maxNewDay})`);
    /* 3. Hemmets rubrik = det dagens plan tränar mest */
    let checked = 0, wrong = 0; const titleOf = { 'LÄXFÖRHÖR SVENSKA': 'mg-quiz', 'ALGEBRAPROV': 'mg-alg', 'KEMIPROV': 'mg-kemi' };
    for (const h of three.heads) { const shares = Object.entries(h.planNB || {}).filter(([k]) => h.live.includes(k)); /* bara mål som inte passerat; Bossen räknas inte (väljs om under passet) */ if (!shares.length || !h.gt) continue; const top = Math.max(...shares.map(x => x[1])); const tops = shares.filter(x => x[1] === top).map(x => x[0]); if (tops.length !== 1) continue; checked++; if (titleOf[h.gt] !== tops[0]) wrong++; }
    ok(checked > 40 && wrong === 0, `hemmets rubrik följer dagens plan (${checked} dygn prövade, ${wrong} fel)`);
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE MULTIGOAL TEST FAILED' : 'LE MULTIGOAL TEST OK'); process.exit(fails ? 1 : 0);
})();
