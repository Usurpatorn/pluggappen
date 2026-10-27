/* Hotfix 2.1.1 – provrubriken på Kör! och passet som startar måste stämma (den riktiga appen, jsdom, riktiga klick).
   SYNTETISK familj. Återskapar felet: startknappen visade närmaste prov ("ALGEBRAPROV · <datum> / IDAG 3 minuter / KÖR") men startade
   ett vanligt Smart Kör!-pass utan provets områden (t.ex. förfallna glosor först). Kontrollerar:
   - rubriken nämner provet bara när passet innehåller provets områden, och anger hur många – och passet som startar är just det passet
   - "Öva inför provet" startar provets egen träning: bara provets koncept, första aktiviteten hör till provet
   - prov utan kopplade områden: ärlig text, ingen provknapp, inget tyst utbyte mot annat innehåll
   - vanligt Kör! (blandat) finns kvar och är märkt som vanligt Kör!
   - rätt barn, mall och kurs: Äldre börjar inte på den lättaste engelska kursen; Yngre och Mellan oförändrade */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js');
const { v2tools, toStart, classic } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const ALG = ['multin', 'forenkla', 'blandat', 'talfoljd', 'ekvation', 'problemekv', 'andragrad'];
const txt = (T, sel = '#app') => (T.$(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim();

(async () => {
  try {
    const w = mkWin({ seed: 11, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; const { $, click } = T;
    PA().FAMILY.apply(FIX); PA().load(); classic(T); PA().rerender(); const D = v2tools(w, T); const rnd = rng(4);   // del 1–5: Klassisk presentation (2.1.1); del 6: v3
    const open = (id = 'k8') => { toStart(T); click($(`[data-kid="${id}"]`)); if ($('[data-pet]')) click($('[data-pet]')); };
    const kid = (id = 'k8') => PA().KIDS.find(k => k.id === id); const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
    for (let d = 0; d < 6; d++) { open(); click($('[data-v2="kor"]')); D.run(() => rnd() < 0.2); w.__advance(DAY); }   // vanlig historik, inget prov
    const p = PA().DB.profiles.k8; const setExams = (list) => { p.exams = list; PA().save(); PA().LE.invalidate('k8'); };
    const examCids = (e) => new Set(PA().V2.examCidsActive(kid(), e));

    /* 1. Provet 23 dygn bort: dagens Kör!-pass saknar provets områden → ingen provrubrik på Kör! */
    setExams([{ id: 'alg', title: 'Algebraprov', date: iso(w.Date.now() + 23 * DAY), skillIds: ALG.slice(), deckIds: [] }]);
    open(); let cta = txt(T, '.go-btn[data-v2="kor"]'); const peek = PA().V2.peekPlan(kid()).plan; const share = PA().V2.missionShare(peek, [...examCids(p.exams[0])]);
    console.log(`  Kör!-rubrik: "${cta}" · passet: ${share.n} av ${share.of} inför provet`);
    if (share.n === 0) ok(!/ALGEBRAPROV/i.test(cta) && /uppgifter · cirka/.test(cta), 'utan provets områden i passet: vanlig Kör!-rubrik (inget prov utlovas)');
    else ok(new RegExp(`${share.n === share.of ? 'Allt inför provet' : share.n + ' av ' + share.of + ' uppgifter inför provet'}`).test(cta), 'provrubriken anger hur stor del av passet som hör till provet');
    // rubriken och passet som startar är samma plan
    click($('.go-btn[data-v2="kor"]')); const S1 = PA().S; ok(S1.v2.mode === 'kor' && JSON.stringify(S1.v2.plan.map(x => x.cid)) === JSON.stringify(peek.map(x => x.cid)), 'Kör! startar exakt det pass som rubriken beskriver');
    D.run(() => false);

    /* 2. Provkortet: "Öva inför provet" → bara provets koncept, första aktiviteten är algebra */
    open(); const mb = $('[data-v2="mission"]'); ok(mb && /Öva inför provet · cirka \d+ minuter/.test(mb.textContent), 'provkortet har "Öva inför provet · cirka N minuter"');
    click(mb); const S2 = PA().S; const cids = examCids(p.exams[0]);
    ok(S2.v2.mode === 'mission' && S2.v2.plan.length > 0 && S2.v2.plan.every(s => cids.has(s.cid)), 'provträningen planerar bara provets koncept: ' + S2.v2.plan.map(s => s.cid).join(' '));
    let first = S2.queue[S2.i]; while (first && first.cat === 'learn') { click($('[data-v2="teachok"]')); first = PA().S.queue[PA().S.i]; }
    ok(first && first.cat === 'math' && ALG.includes(first.skill.id), 'första aktiviteten i provträningen är algebra: ' + (first && (first.skill ? first.skill.id : first.deck && first.deck.id)));
    ok(/Inför Algebraprov/.test(txt(T, '.topbar')), 'passets rubrik säger "Inför Algebraprov"');
    const items = []; let g = 0; while (PA().S && PA().S.v2 && $('#qcard') && g++ < 40) { const it = PA().S.queue[PA().S.i]; if (it.cat !== 'learn') items.push(it.cat === 'word' ? 'ord:' + it.deck.id : it.skill.id); D.answer(() => rnd() < 0.2); w.__advance(4000); }
    ok(items.length > 0 && items.every(x => ALG.includes(x)), 'hela provträningen är algebra (inga glosor eller andra ämnen): ' + items.join(','));
    { const C = PA().LE.state(kid()); const d0 = PA().LE2.dayIdx(PA().LE.now()); const nNew = Object.entries(C.L.c).filter(([id, c]) => c.fs && PA().LE2.dayIdx(c.fs * 1000) === d0 && C.cat[id] && C.cat[id].kind !== 'deck').length;
      ok(nNew <= C.pol.maxNew, `provträningen håller dygnets gräns för nytt (${nNew} ≤ ${C.pol.maxNew})`);
      for (let r = 0; r < 3; r++) { open(); click($('[data-v2="mission"]')); D.run(() => false); }
      const n2 = Object.entries(PA().LE.state(kid()).L.c).filter(([id, c]) => c.fs && PA().LE2.dayIdx(c.fs * 1000) === d0 && C.cat[id] && C.cat[id].kind !== 'deck').length;
      ok(n2 <= Math.max(C.pol.maxNew, nNew), `flera provträningar samma dag tar inte in mer nytt än dygnets gräns (${n2})`); }
    const rec = p.le.shadow.filter(r => r.e === 2 && r.m === 'mission').slice(-1)[0]; ok(rec && rec.m === 'mission' && rec.done === 1, 'passposten sparas som provträning (m: "mission")');

    /* 3. Provet närmar sig (provveckan): Kör!-passet innehåller provets områden och rubriken säger hur många */
    w.__advance(17 * DAY); open(); cta = txt(T, '.go-btn[data-v2="kor"]'); const peek3 = PA().V2.peekPlan(kid()).plan; const sh3 = PA().V2.missionShare(peek3, [...examCids(p.exams[0])]);
    console.log(`  provveckan: "${cta}" · ${sh3.n} av ${sh3.of}`);
    ok(sh3.n > 0 && /ALGEBRAPROV/.test(cta) && new RegExp(sh3.n === sh3.of ? 'Allt inför provet' : `${sh3.n} av ${sh3.of} uppgifter inför provet`).test(cta), 'provveckan: provrubrik med rätt andel');
    click($('.go-btn[data-v2="kor"]')); const S3 = PA().S; ok(S3.v2.plan.filter(s => s.role !== 'boss' && cids.has(s.cid)).length === sh3.n, 'andelen i rubriken = andelen i passet som startade'); D.run(() => false);

    /* 4. Prov utan kopplade områden: ärlig förklaring, ingen provknapp, Kör! märkt som vanligt Kör! */
    setExams([{ id: 'tom', title: 'Engelskaprov', date: iso(w.Date.now() + 5 * DAY), skillIds: [], deckIds: [] }]);
    open(); const home = txt(T); cta = txt(T, '.go-btn[data-v2="kor"]');
    ok(/inte inlagda i appen ännu/.test(home) && !$('[data-v2="mission"]') && !$('[data-v2="testa"][data-exam="tom"]'), 'prov utan områden: ärlig text, ingen provträning och ingen Testa mig');
    ok(!/ENGELSKAPROV/i.test(cta) && /uppgifter · cirka/.test(cta), 'prov utan områden: Kör! lovar inte provet');
    ok(!PA().V2.plan(kid(), 'mission', PA().LE.state(kid()), PA().LE.now(), null, { examId: 'tom' }).length, 'provträning utan områden ger ett tomt pass (inget tyst utbyte)');

    /* 5. Rätt kurs per barn: Äldre börjar på mallens egen kurs, inte den lättaste; Yngre/Mellan oförändrade (lägst nivå först) */
    const newDeck = (id, lang) => { const k = kid(id); const C = PA().LE.state(k); const ctx = PA().LE.ctx(k, PA().DB.profiles[id], C, PA().LE.now()); return Object.entries(ctx.decks).filter(([cid, d]) => d.nw > 0 && d.lang === lang).map(([cid]) => cid.slice(2)); };
    const fresh = mkWin({ seed: 12, fixedClock: true }); await sleep(40); const T2 = tools(fresh); T2.PA().FAMILY.apply(FIX); T2.PA().load();
    const nd = (id, lang) => { const k = T2.PA().KIDS.find(x => x.id === id); const C = T2.PA().LE.state(k); const ctx = T2.PA().LE.ctx(k, T2.PA().DB.profiles[id], C, T2.PA().LE.now()); return Object.entries(ctx.decks).filter(([, d]) => d.nw > 0 && d.lang === lang).map(([cid]) => cid.slice(2)); };
    const k8en = nd('k8', 'en'), k8es = nd('k8', 'es'), k4en = nd('k4', 'en'), k2en = nd('k2', 'en');
    console.log(`  första nya kurs utan historik: åk 8 en ${k8en} · es ${k8es} · åk 4 en ${k4en} · åk 2 en ${k2en}`);
    ok(k8en.length === 1 && k8en[0].startsWith('en8_'), 'Äldre utan historik: engelska börjar på åk 8-kursen, inte "Animals"');
    ok(k8es.length === 1 && T2.PA().BUILTIN_DECKS.find(d => d.id === k8es[0]).level === 1, 'Äldre: spanska börjar från början av sin progression (ingen gissad nivå)');
    ok(k4en.length === 1 && T2.PA().BUILTIN_DECKS.find(d => d.id === k4en[0]).level === 1 && k2en.length === 1 && T2.PA().BUILTIN_DECKS.find(d => d.id === k2en[0]).level === 1, 'Mellan och Yngre oförändrade: lägsta nivån först');
    void newDeck;

    /* 6. Experience v3 (Achieve och Grow): samma princip – provrubrik bara när dagens pass innehåller provet, annars ärligt + "Öva inför provet" */
    { const w3 = mkWin({ seed: 21, fixedClock: true }); await sleep(40); const T3 = tools(w3); const P3 = T3.PA; P3().FAMILY.apply(FIX); P3().load(); P3().rerender(); const D3 = v2tools(w3, T3); const r3 = rng(9);
      const open3 = (id) => { toStart(T3); T3.click(T3.$(`[data-kid="${id}"]`)); if (T3.$('[data-pet]')) T3.click(T3.$('[data-pet]')); };
      const kid3 = (id) => P3().KIDS.find(k => k.id === id); const iso3 = (ms) => new Date(ms).toISOString().slice(0, 10);
      const home3 = () => txt(T3, '.mission');
      for (const [id, exp] of [['k8', 'achieve'], ['k4', 'grow']]) {
        ok(P3().EXP.of(kid3(id)) === exp, `${id}: standardupplevelsen är ${exp}`);
        for (let d = 0; d < 4; d++) { open3(id); T3.click(T3.$('[data-v2="kor"]')); D3.run(() => r3() < 0.2); w3.__advance(DAY); }
        const pr = P3().DB.profiles[id]; const C = P3().LE.state(kid3(id));
        const sk = [...new Set(Object.entries(C.cat).filter(([, d]) => d.kind === 'skill' && d.active !== false).map(([cid]) => cid.slice(2)))];
        // ett prov på områden som barnet inte övar idag (sist i mallens ordning) – dagens pass har då ingen provandel
        const later = sk.filter(s => !(C.L.c['s:' + s] || {}).n).slice(-2);
        pr.exams = [{ id: 'x', title: 'Mattetest', date: iso3(w3.Date.now() + 20 * DAY), skillIds: later, deckIds: [] }]; P3().save(); P3().LE.invalidate(id);
        open3(id); const m = P3().EXP.goalOf(kid3(id)).now || { e: pr.exams[0] }; const sh = P3().EXP.examShare(kid3(id), m, P3().V2.peekPlan(kid3(id)).plan); const h = home3();
        console.log(`  v3 ${exp}: ${sh.n} av ${sh.of} inför provet · "${h.slice(0, 110)}"`);
        if (sh.n === 0) {
          ok(!/NÄSTA MÅL MATTETEST|DAGENS MISSION · MATTETEST/i.test(h) && /övar annat/.test(h), `${exp}: utan provet i passet lovar startkortet inte provet och säger det ärligt`);
          const mb = T3.$('.mission [data-v2="mission"]'); ok(mb && /Öva inför provet · cirka \d+ min/.test(mb.textContent), `${exp}: "Öva inför provet" erbjuds`);
          if (mb) { T3.click(mb); const S = P3().S; const cids = new Set(P3().V2.examCidsActive(kid3(id), pr.exams[0])); ok(S.v2.mode === 'mission' && S.v2.plan.length && S.v2.plan.every(x => cids.has(x.cid)), `${exp}: provträningen planerar bara provets koncept`); D3.run(() => false);
            ok(/PROVTRÄNINGEN KLAR|ÄVENTYRET/.test(txt(T3)) || !/DAGENS PLAN KLAR/.test(txt(T3)), `${exp}: avslutet kallar inte provträningen för dagens plan`);
            ok(T3.$('[data-v2="kor"]') && /Till dagens plan/.test(txt(T3)) && !T3.$('[data-v2="flow"]'), `${exp}: efter provträning före dagens plan erbjuds dagens plan, inte FLOW`); }
        } else ok(new RegExp(P3().EXP.shareText(sh)).test(h), `${exp}: provrubriken anger andelen (${sh.n} av ${sh.of})`);
        // provveckan: dagens pass innehåller provets områden → provrubrik med andel, och KÖR startar exakt den planen
        pr.exams[0].skillIds = sk.slice(0, 3); pr.exams[0].date = iso3(w3.Date.now() + 3 * DAY); P3().save(); P3().LE.invalidate(id);
        open3(id); const peek = P3().V2.peekPlan(kid3(id)).plan; const sh2 = P3().EXP.examShare(kid3(id), P3().EXP.goalOf(kid3(id)).now || { e: pr.exams[0] }, peek); const h2 = home3();
        console.log(`  v3 ${exp} provveckan: ${sh2.n} av ${sh2.of} · "${h2.slice(0, 90)}"`);
        if (sh2.n > 0) ok(/MATTETEST/i.test(h2) && h2.includes(P3().EXP.shareText(sh2)), `${exp}: provveckan – provrubrik med rätt andel (${sh2.n} av ${sh2.of})`);
        else ok(!/NÄSTA MÅL MATTETEST|DAGENS MISSION · MATTETEST/i.test(h2), `${exp}: provveckan utan provandel – ingen provrubrik`);
        T3.click(T3.$('.mission [data-v2="kor"]')); ok(JSON.stringify(P3().S.v2.plan.map(x => x.cid)) === JSON.stringify(peek.map(x => x.cid)), `${exp}: KÖR startar exakt det pass som kortet beskriver`); D3.run(() => false);
        // prov utan kopplade områden: ärlig text, ingen provträning, ingen Testa mig
        w3.__advance(DAY);   // nytt dygn: dagens plan är inte gjord
        pr.exams = [{ id: 'tom', title: 'Engelskaprov', date: iso3(w3.Date.now() + 5 * DAY), skillIds: [], deckIds: [] }]; P3().save(); P3().LE.invalidate(id);
        open3(id); const h3 = home3();
        ok(/inte inlagda i appen ännu/.test(h3) && !T3.$('[data-v2="mission"]') && !T3.$('[data-v2="testa"][data-exam="tom"]') && !/ENGELSKAPROV ·|NÄSTA MÅL ENGELSKAPROV/i.test(h3.replace(/Nästa (mål|prov):.*$/s, '')), `${exp}: prov utan områden – ärlig text, ingen provträning, ingen Testa mig`);
        pr.exams = []; P3().save(); P3().LE.invalidate(id);
      }
      ok(P3().LE.errors.length === 0, 'v3: inga fel i v2-lagret ' + JSON.stringify(P3().LE.errors.slice(0, 2))); }
    /* 6. Granskningens fynd (oberoende granskning av hotfixen): dygnets gräns, tom provträning, bara provets innehåll, svältskyddet, "klar för idag" */
    { const w6 = mkWin({ seed: 31, fixedClock: true }); await sleep(40); const T6 = tools(w6); const P6 = T6.PA; P6().FAMILY.apply(FIX); P6().load(); if (typeof classic === 'function') classic(T6); P6().rerender(); const D6 = v2tools(w6, T6);
      const open6 = () => { toStart(T6); T6.click(T6.$('[data-kid="k8"]')); if (T6.$('[data-pet]')) T6.click(T6.$('[data-pet]')); };
      const k6 = () => P6().KIDS.find(k => k.id === 'k8'); const p6 = P6().DB.profiles.k8; const iso6 = (ms) => new Date(ms).toISOString().slice(0, 10);
      const newToday = () => { const C = P6().LE.state(k6()); const d0 = P6().LE2.dayIdx(P6().LE.now()); return Object.entries(C.L.c).filter(([id, c]) => c.fs && P6().LE2.dayIdx(c.fs * 1000) === d0 && C.cat[id] && C.cat[id].kind !== 'deck').length; };
      p6.exams = [{ id: 'g', title: 'Mattetest', date: iso6(w6.Date.now() + 20 * DAY), skillIds: ['ekvation', 'problemekv', 'andragrad'], deckIds: [] }]; P6().save(); P6().LE.invalidate('k8');
      // a) provträning först, sedan Kör!: tillsammans aldrig mer nytt än dygnets gräns
      open6(); const sessN0 = P6().LE.state(k6()).L.sessN || 0; const mb = T6.$('[data-v2="mission"]'); ok(!!mb, 'granskning: provträningen erbjuds');
      if (mb) { T6.click(mb); const set = new Set(P6().V2.examCidsActive(k6(), p6.exams[0])); const seenC = []; let g = 0; while (P6().S && P6().S.v2 && T6.$('#qcard') && g++ < 60) { const it = P6().S.queue[P6().S.i]; if (it.spec && it.spec.cid) seenC.push(it.spec.cid); D6.answer(() => true); w6.__advance(4000); }
        ok(seenC.length > 0 && seenC.every(c => set.has(c)), 'granskning: provträning med bara fel svar – lätta uppgifter, omförsök och Boss är ändå bara provets innehåll: ' + [...new Set(seenC.filter(c => !set.has(c)))].join(' '));
        ok((P6().LE.state(k6()).L.sessN || 0) === sessN0, `granskning: provträningen räknas inte som eget pass för svältskyddet (${sessN0} → ${P6().LE.state(k6()).L.sessN || 0})`);
        ok(!P6().V2.doneToday(p6), 'granskning: provträning är inte "dagens pass" (Klar för idag visas inte efter bara provträning)');
        open6(); T6.click(T6.$('.go-btn[data-v2="kor"]')); D6.run(() => false); const pol = P6().LE.state(k6()).pol;
        ok(newToday() <= pol.maxNew, `granskning: provträning + Kör! samma dag håller dygnets gräns för nytt (${newToday()} ≤ ${pol.maxNew})`); }
      // b) kvällen före provet med opåbörjade områden: ingen provknapp som startar annat – ärlig text
      w6.__advance(DAY); p6.exams = [{ id: 'h', title: 'Mattetest', date: iso6(w6.Date.now() + 1 * DAY), skillIds: ['talfoljd', 'multin'], deckIds: [] }]; P6().save(); P6().LE.invalidate('k8');
      open6(); const mp = P6().V2.plan(k6(), 'mission', P6().LE.state(k6()), P6().LE.now(), null, { examId: 'h' }); const set2 = new Set(P6().V2.examCidsActive(k6(), p6.exams[0]));
      console.log(`  kvällen före: provträningens plan ${JSON.stringify(mp.map(s => [s.cid, s.role]))}`);
      ok(mp.every(s => set2.has(s.cid)) && (mp.length === 0 || mp.some(s => s.role !== 'boss')), 'granskning: provträningens plan innehåller bara provets koncept och aldrig bara en Boss');
      if (!mp.length) ok(!T6.$('[data-v2="mission"]') && /Inget behöver övas för provet just nu/.test(txt(T6)), 'granskning: tom provträning → ingen knapp, ärlig text (3.3: lugnare formulering, samma besked)');
      ok(P6().LE.errors.length === 0, 'granskning: inga fel i v2-lagret ' + JSON.stringify(P6().LE.errors.slice(0, 2))); }
    /* 7. Granskning: med historik (starka koncept i andra ämnen) – provträning med bara fel svar spelar ändå bara provets innehåll */
    { const w7 = mkWin({ seed: 31, fixedClock: true }); await sleep(40); const T7 = tools(w7); const P7 = T7.PA; P7().FAMILY.apply(FIX); P7().load(); if (typeof classic === 'function') classic(T7); P7().rerender(); const D7 = v2tools(w7, T7);
      const open7 = () => { toStart(T7); T7.click(T7.$('[data-kid="k8"]')); if (T7.$('[data-pet]')) T7.click(T7.$('[data-pet]')); };
      const k7 = () => P7().KIDS.find(k => k.id === 'k8'); const p7 = P7().DB.profiles.k8; const r7 = rng(5);
      for (let d = 0; d < 5; d++) { open7(); T7.click(T7.$('.go-btn[data-v2="kor"]')); D7.run(() => r7() < 0.1); w7.__advance(DAY); }
      const notYet = ALG.filter(sk => !(P7().LE.state(k7()).L.c['s:' + sk] || {}).n);
      p7.exams = [{ id: 'g', title: 'Mattetest', date: new Date(w7.Date.now() + 20 * DAY).toISOString().slice(0, 10), skillIds: notYet.slice(0, 3), deckIds: [] }]; P7().save(); P7().LE.invalidate('k8');
      open7(); const mb = T7.$('[data-v2="mission"]'); ok(!!mb, 'granskning (historik): provträningen erbjuds');
      if (mb) { T7.click(mb); const set = new Set(P7().V2.examCidsActive(k7(), p7.exams[0])); const seenC = []; let g = 0; while (P7().S && P7().S.v2 && T7.$('#qcard') && g++ < 60) { const it = P7().S.queue[P7().S.i]; if (it.spec && it.spec.cid) seenC.push(it.spec.cid); D7.answer(() => true); w7.__advance(4000); }
        ok(seenC.length > 0 && seenC.every(c => set.has(c)), 'granskning (historik): provträning med bara fel svar – lätta uppgifter, omförsök och Boss är bara provets innehåll ' + [...new Set(seenC.filter(c => !set.has(c)))].join(' ')); }
      ok(P7().LE.errors.length === 0, 'granskning (historik): inga fel i v2-lagret'); }
    ok(PA().LE.errors.length === 0, 'inga fel i v2-lagret ' + JSON.stringify(PA().LE.errors.slice(0, 2)));
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'EXAM CTA TEST FAILED' : 'EXAM CTA TEST OK'); process.exit(fails ? 1 : 0);
})();
