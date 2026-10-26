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
const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const ALG = ['multin', 'forenkla', 'blandat', 'talfoljd', 'ekvation', 'problemekv', 'andragrad'];
const txt = (T, sel = '#app') => (T.$(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim();

(async () => {
  try {
    const w = mkWin({ seed: 11, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; const { $, click } = T;
    PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T); const rnd = rng(4);
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
    ok(PA().LE.errors.length === 0, 'inga fel i v2-lagret ' + JSON.stringify(PA().LE.errors.slice(0, 2)));
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'EXAM CTA TEST FAILED' : 'EXAM CTA TEST OK'); process.exit(fails ? 1 : 0);
})();
