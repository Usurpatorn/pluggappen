/* 2.1.1 – startknappar och sammanhang genom den riktiga appen (jsdom, riktiga klick). SYNTETISK familj (testfixturen), fast klocka.
   Komplement till test_exam_cta.js (felet och rättelsen). Här prövas resten av listan från felutredningen:
   - datumgränserna runt uppdragets 28 dygn (visning) och motorns 21 dygn (schemaläggning), före, på och efter gränserna;
     "Öva inför provet" fungerar även utanför motorns provfönster
   - två kommande prov (algebra + kemi): varje provkort startar sitt eget provs innehåll, rubriken på Kör! följer närmaste uppdrag
   - kemiprovets knapp startar kemi (kunskapspaket), inte algebra eller glosor
   - vanligt Kör! behåller blandad träning (engelska är inte bortvald)
   - manuellt val av en glosgrupp startar just den glosgruppen
   - prov vars områden pekar på privat innehåll som inte finns på enheten: ärlig text, inget tyst byte till engelska
   - v1-reserven fungerar med prov inlagda
   - byte av profil läcker inget sammanhang (provrubrik, provträning, barn) */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js');
const drv = require('./le/v2driver.js'); const { v2tools, toStart, setEngine } = drv; const classic = drv.classic || null;
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const ALG = ['multin', 'forenkla', 'blandat', 'talfoljd', 'ekvation', 'problemekv', 'andragrad'];
const KEMI = ['ph-skalan', 'indikatorer', 'syra-kanne', 'bas-kanne', 'stark-svag', 'neutralisation', 'ph-kroppen'].map(k => 'k:kemi8-syror-baser/' + k);
const txt = (T, sel = '#app') => (T.$(sel) || { textContent: '' }).textContent.replace(/\s+/g, ' ').trim();

(async () => {
  try {
    const w = mkWin({ seed: 41, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; const { $, click } = T;
    PA().FAMILY.apply(FIX); PA().load(); if (classic) classic(T); PA().rerender(); const D = v2tools(w, T); const rnd = rng(8);
    const open = (id = 'k8') => { toStart(T); click($(`[data-kid="${id}"]`)); if ($('[data-pet]')) click($('[data-pet]')); };
    const kid = (id = 'k8') => PA().KIDS.find(k => k.id === id); const p8 = PA().DB.profiles.k8;
    const iso = (d) => new Date(w.Date.now() + d * DAY).toISOString().slice(0, 10);
    const setExams = (list) => { p8.exams = list; PA().save(); PA().LE.invalidate('k8'); };
    const cidsOf = (e) => new Set(PA().V2.examCidsActive(kid(), e));
    const korTxt = () => txt(T, '.go-btn[data-v2="kor"]');
    for (let d = 0; d < 4; d++) { open(); click($('[data-v2="kor"]')); D.run(() => rnd() < 0.2); w.__advance(DAY); }   // lite historik (algebra ännu inte påbörjad helt)
    const runAll = (wrong = () => false) => { const seen = []; let g = 0; while (PA().S && PA().S.v2 && $('#qcard') && g++ < 60) { const it = PA().S.queue[PA().S.i]; if (it.cat !== 'learn' && it.spec) seen.push(it.spec.cid); D.answer(wrong); w.__advance(4000); } return seen; };

    /* 1. Datumgränser: uppdraget visas inom 28 dygn, motorn prioriterar provet inom 21 dygn. Rubriken på Kör! följer alltid passet. */
    const late = ALG.filter(s => !(PA().LE.state(kid()).L.c['s:' + s] || {}).n).slice(-3);   // provområden som barnet inte har börjat på
    const rows = [];
    for (const d of [40, 29, 28, 22, 21, 20, 7, 3, 1, 0, -1]) {
      w.__advance(DAY);   // nytt dygn per fall: dygnets gräns för nytt gäller per fall
      const e = { id: 'alg' + d, title: 'Algebraprov', date: iso(d), skillIds: late.length ? late : ALG.slice(-3), deckIds: [] }; setExams([e]);
      open(); const cta = korTxt(); const peek = PA().V2.peekPlan(kid()).plan; const share = PA().V2.missionShare(peek, [...cidsOf(e)]);
      const m = PA().V2.mission(kid()); const card = $(`[data-v2="mission"][data-exam="${e.id}"]`); const home = txt(T);
      const mp = PA().V2.plan(kid(), 'mission', PA().LE.state(kid()), PA().LE.now(), null, { examId: e.id });
      rows.push(`${d}d: uppdrag ${m ? 'ja' : 'nej'} · Kör!-andel ${share.n}/${share.of} · provträning ${mp.length} · rubrik "${cta.slice(0, 40)}"`);
      // uppdraget (visningen) bara inom 28 dygn och inte för passerade prov
      ok(!!m === (d >= 0 && d <= 28), `${d} dygn: uppdraget visas bara inom 0–28 dygn`);
      // motorns provfönster: utanför 21 dygn ingen provandel i dagens pass
      // (utanför motorns 21-dygnsfönster prioriteras provet inte – men ett provkoncept kan ändå finnas i passet av andra skäl, t.ex. som
      // nästa nya moment; då räknas det ärligt i andelen. Därför ingen kontroll av att andelen är 0 här.)
      // rubriken lovar provet bara när passet innehåller det, och då med rätt andel
      ok(/ALGEBRAPROV/i.test(cta) === (!!m && share.n > 0), `${d} dygn: provrubrik på Kör! ⇔ uppdrag och provandel > 0 ("${cta.slice(0, 50)}")`);
      if (m && share.n > 0) ok(cta.includes(share.n === share.of ? 'Allt inför provet' : `${share.n} av ${share.of} uppgifter inför provet`), `${d} dygn: rubriken anger andelen`);
      // provkortet finns för alla kommande prov (även utanför 28 dygn); knappen bara när det finns något att öva, annars ärlig text
      if (d >= 0) ok(!!card === mp.length > 0 && (card || /inget att öva just för provet/.test(home)), `${d} dygn: provkortets knapp ⇔ provträningen har innehåll (annars ärlig text)`);
      else ok(!card && !/ALGEBRAPROV/i.test(cta), `${d} dygn: passerat prov – inget provkort, ingen provrubrik`);
      // "Öva inför provet" fungerar även utanför motorns provfönster (22–40 dygn) när det finns opåbörjade områden
      if (d >= 22) ok(mp.length > 0, `${d} dygn: Öva inför provet har innehåll även utanför 21-dygnsfönstret`);
      if (card) { click(card); const S = PA().S; const set = cidsOf(e); ok(S && S.v2 && S.v2.mode === 'mission' && S.v2.plan.every(s => set.has(s.cid)), `${d} dygn: provträningen planerar bara provets koncept`);
        const seen = runAll(() => rnd() < 0.3); ok(seen.length > 0 && seen.every(c => set.has(c)), `${d} dygn: allt som spelades i provträningen hör till provet`); }
      // Kör! startar exakt det pass som rubriken beskrev
      open(); const peek2 = PA().V2.peekPlan(kid()).plan; click($('.go-btn[data-v2="kor"]')); ok(PA().S && PA().S.v2 && JSON.stringify(PA().S.v2.plan.map(x => x.cid)) === JSON.stringify(peek2.map(x => x.cid)), `${d} dygn: Kör! startar det pass som visades`); runAll();
    }
    console.log('  Datumgränser:\n   ' + rows.join('\n   '));

    /* 2. Två kommande prov: algebra (närmast) och kemi. Varje provkort startar sitt eget prov; Kör!-rubriken följer närmaste uppdrag. */
    w.__advance(DAY);
    const eA = { id: 'A', title: 'Algebraprov', date: iso(12), skillIds: ALG.slice(), deckIds: [] }, eK = { id: 'K', title: 'Kemiprov', date: iso(20), kps: KEMI.slice(), skillIds: [], deckIds: [] };
    setExams([eA, eK]); open();
    ok(PA().V2.mission(kid()).e.id === 'A', 'två prov: uppdraget är det närmaste (algebra)');
    { const cta = korTxt(); ok(!/KEMIPROV/i.test(cta), 'två prov: Kör!-rubriken nämner inte kemiprovet (det är inte uppdraget)'); }
    const kb = $('[data-v2="mission"][data-exam="K"]'); ok(!!kb, 'två prov: kemiprovet har en egen knapp');
    if (kb) { click(kb); const set = cidsOf(eK); ok(PA().S.v2.mode === 'mission' && PA().S.v2.extra.examId === 'K' && PA().S.v2.plan.every(s => set.has(s.cid)), 'kemiknappen startar kemiprovets träning');
      ok(/Inför Kemiprov/.test(txt(T, '.topbar')), 'kemiknappen: passets rubrik säger "Inför Kemiprov"');
      const seen = runAll(() => rnd() < 0.3); ok(seen.length > 0 && seen.every(c => c.startsWith('k:kemi8-syror-baser/')), 'kemiknappen: allt som spelades är kemi (inte algebra eller glosor): ' + [...new Set(seen.filter(c => !c.startsWith('k:kemi8')))].join(' ')); }
    open(); const ab = $('[data-v2="mission"][data-exam="A"]');
    if (ab) { click(ab); const set = cidsOf(eA); const seen = runAll(() => rnd() < 0.3); ok(seen.length > 0 && seen.every(c => set.has(c)), 'algebraknappen: allt som spelades är algebra'); }
    else ok(/inget att öva just för provet/.test(txt(T)), 'algebraknappen saknas bara med ärlig text');

    /* 3. Vanligt Kör! behåller blandad träning: över en vecka med två prov förekommer även annat än proven (t.ex. glosor) */
    { const other = new Set(); for (let d = 0; d < 6; d++) { w.__advance(DAY); open(); click($('.go-btn[data-v2="kor"]')); const plan = PA().S.v2.plan; for (const s of plan) if (!cidsOf(eA).has(s.cid) && !cidsOf(eK).has(s.cid)) other.add(s.cid); runAll(() => rnd() < 0.2); }
      ok(other.size > 0, `vanligt Kör! med två prov behåller blandad träning (${other.size} andra koncept, t.ex. ${[...other].slice(0, 3).join(' ')})`);
      ok([...other].some(c => c.startsWith('d:')) || PA().LE.state(kid()).L.c && Object.keys(PA().LE.state(kid()).L.c).some(c => c.startsWith('d:')), 'engelska/språk är inte bortvalt (glosgrupper finns kvar i planeringen)'); }

    /* 4. Manuellt val av en glosgrupp startar just den glosgruppen */
    open(); const lang = $('[data-subj="lang"]'); if (lang) click(lang);
    { const db = $('[data-deck]'); ok(!!db, 'manuellt val: en glosgrupp går att välja'); if (db) { const id = db.dataset.deck; click(db); const q = (PA().S && PA().S.queue) || [];
      ok(q.length > 0 && q.every(x => !x.deck || x.deck.id === id) && q.some(x => x.deck && x.deck.id === id), `manuellt val: passet är just glosgruppen ${id}`);
      toStart(T); } }   // manuella pass är v1-pass: avbryts här (svaren prövas i smoke/test_lang)

    /* 5. Prov vars områden pekar på privat innehåll som inte finns på enheten: ärlig text – aldrig tyst byte till engelska */
    w.__advance(DAY); setExams([{ id: 'P', title: 'Fysikprov', date: iso(9), kps: ['k:privat-paket-saknas/x', 'k:privat-paket-saknas/y'], skillIds: [], deckIds: [] }]);
    open(); { const cta = korTxt(); const home = txt(T);
      ok(/inte inlagda i appen ännu/.test(home) && !$('[data-v2="mission"][data-exam="P"]') && !$('[data-v2="testa"][data-exam="P"]'), 'privat innehåll saknas: ärlig text, ingen provträning, ingen Testa mig');
      ok(!/FYSIKPROV/i.test(cta), 'privat innehåll saknas: Kör! lovar inte provet');
      ok(PA().V2.plan(kid(), 'mission', PA().LE.state(kid()), PA().LE.now(), null, { examId: 'P' }).length === 0, 'privat innehåll saknas: provträningen är tom (inget tyst utbyte)'); }

    /* 6. Byte av profil läcker inget sammanhang */
    w.__advance(DAY); setExams([eA]); open(); const mb = $('[data-v2="mission"][data-exam="A"]'); if (mb) click(mb);   // påbörja provträning för Äldre …
    open('k4'); { const home = txt(T); ok(!/ALGEBRAPROV|Algebraprov/.test(home), 'profilbyte: Mellans startsida visar inget av Äldres prov');   // … och byt barn mitt i
      click($('.go-btn[data-v2="kor"]') || $('[data-v2="kor"]')); const S = PA().S; const cat4 = PA().LE.state(kid('k4')).cat;
      ok(S && S.kid.id === 'k4' && S.v2 && S.v2.mode === 'kor' && !S.v2.extra.examId, 'profilbyte: Mellans Kör! är ett vanligt pass för Mellan (ingen provträning med sig)');
      ok(S.v2.plan.every(s => cat4[s.cid]), 'profilbyte: Mellans pass använder bara Mellans katalog'); runAll(); }

    /* 7. v1-reserven fungerar med prov inlagda */
    setEngine(w, T, 'k8', 'v1'); open(); { const go = $('.go-btn'); ok(!!go, 'v1: startknappen finns'); if (go) { click(go); ok(PA().S && !PA().S.v2 && PA().S.queue.length > 0 && !!$('#qcard'), 'v1: ett v1-pass startar med prov inlagda'); toStart(T); } }
    setEngine(w, T, 'k8', 'v2'); open(); ok(!!$('[data-v2="kor"]'), 'tillbaka till v2: Kör! finns igen');
    ok(PA().LE.errors.length === 0, 'inga fel i v2-lagret ' + JSON.stringify(PA().LE.errors.slice(0, 2)));
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'CTA PATHS TEST FAILED' : 'CTA PATHS TEST OK'); process.exit(fails ? 1 : 0);
})();
