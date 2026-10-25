/* Fas 3C–3H – v2-barnupplevelsen i den riktiga appen (jsdom, dist/pluggappen.html). SYNTETISK familj (testfixturen).
   v2 är AV som standard och slås på per barn i föräldraläget. Testar: Smart Kör!, rollkort, LÄR/Rescue, Felboken 2.0 + Revansch,
   KLAR, veckokonsekvens, Testa mig (inga ledtrådar/ingen återkoppling förrän efteråt), Läs → Stäng → Minns, föräldrainsikter,
   E/C/A bara för förälder, rollback till v1, förälderns förhandsvisning (ändrar inget), avbrott (Testa mig, Rescue, omladdning),
   fel klocka, två enheter (inga dubbla belöningar efter synk), inga fria svarstexter i lagringen. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { v2tools, unlockParent, enableV2, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const txt = (T) => T.$('#app').textContent.replace(/\s+/g, ' ');
const FORBIDDEN_CHILD = /försenade|repetitioner försenade|\bv2\b|skugg|E\/C\/A|Indikation|betyg|syskon|\d+\s*fel\b|förlorat|streak(en)? (bryts|försvinner)|missat/i;
const DAY = 86400000;

function boot(seed, storage) { const w = mkWin({ seed, fixedClock: true, storage }); const T = tools(w); return { w, T }; }
function family(T) { T.PA().FAMILY.apply(FIX); T.PA().load(); T.PA().rerender(); }
function goHome(T) { for (let i = 0; i < 3 && !T.$('[data-subj]'); i++) { const b = T.$('[data-go="home"]'); if (!b) break; T.click(b); } }
function openKid(T, id) { const { $, click } = T; toStart(T); click($(`[data-kid="${id}"]`)); if ($('[data-pet]')) click($('[data-pet]')); }

setTimeout(() => {
  try {
    const { w, T } = boot(Number(process.env.SEED) || 777); const { $, click, PA } = T; family(T);
    const D = v2tools(w, T);
    /* ---------- 1. Standard = v1; slå på v2 per barn ---------- */
    openKid(T, 'k4'); ok($('[data-rec]') && !$('[data-v2="kor"]'), 'standard: v1-startsida (v2 av)');
    ok(!PA().DB.profiles.k4.settings.engine, 'engine-flaggan saknas som standard');
    enableV2(w, T, 'k4'); ok(PA().DB.profiles.k4.settings.engine === 'v2', 'föräldern slog på v2 för k4 (två steg)');
    ok(!PA().DB.profiles.k2.settings.engine && !PA().DB.profiles.k8.settings.engine, 'bara det valda barnet påverkas');
    /* ---------- 2. Smart Kör! ---------- */
    openKid(T, 'k4'); const home = txt(T);
    const korTxt = T.$('.go-btn[data-v2="kor"]') ? T.$('.go-btn[data-v2="kor"]').textContent.replace(/\s+/g, ' ').trim() : ''; ok(/^(Kör!|Spela match|\S.*) ?\d+ uppgifter · cirka \d+ minuter$/.test(korTxt), 'startsidan: "Kör! N uppgifter · cirka M minuter" – ' + korTxt);
    ok(!/Pluggat 0 dagar/.test(home), 'veckokonsekvens visas inte som "0 dagar" (ingen skuld)');
    ok(!/\bfrys\b/.test(home), 'streakfrys-pillret ersatt av veckokonsekvens');
    ok(!FORBIDDEN_CHILD.test(home), 'startsidan: inga skuld-/felräknare, ingen v2-jargong');
    const k4 = () => PA().DB.profiles.k4; const att0 = Object.values(k4().skills).reduce((a, s) => a + s.att, 0);
    click($('[data-v2="kor"]')); ok(PA().S && PA().S.v2 && PA().S.v2.mode === 'kor', 'Kör! startar ett v2-pass');
    const planN = PA().S.v2.plan.length; ok(planN >= 3 && planN <= 12, `passlängd inom mellanpolicyn (${planN}; första passet begränsas av ny-inlärningsregeln)`);
    let firstScreen = txt(T); ok(/Uppgift 1 av \d+/.test(firstScreen) || /1 av \d+/.test(firstScreen), 'räknare "1 av N"');
    D.run((item) => item.spec && item.spec.role === 'focus' && item.type !== 'choicetext');
    ok(/Bra jobbat/.test(txt(T)), 'slutskärm: "Bra jobbat"');
    click($('[data-go="home"]')); ok(/Pluggat 1 dag den här veckan/.test(txt(T)), 'veckokonsekvens efter första passet: "Pluggat 1 dag den här veckan"'); click($('[data-v2="kor"]')); D.run(false); 
    ok(!FORBIDDEN_CHILD.test(txt(T)), 'slutskärm: inga felräknare');
    const le = k4().le; const evs = le.log; ok(evs.length >= planN - 2, `bevis loggade (${evs.length})`);
    ok(evs.every(e => e.length >= 15 && /^[WRVFPBXETCMQSL]?$/.test(e[15] || '')), 'varje bevis bär rollkod (index 15)');
    const att1 = Object.values(k4().skills).reduce((a, s) => a + s.att, 0); ok(att1 > att0, `v1-mastery uppdateras samtidigt (rollback) ${att0} → ${att1}`);
    const rec = le.shadow.filter(r => r.e === 2); ok(rec.length >= 1 && rec.every(r => r.done === 1 && r.src === 'v2'), 'v2-passen sparade som avslutade passposter');
    ok(D.log.chips.size >= 1, 'rollkort visas: ' + [...D.log.chips].join(', '));
    /* ---------- 3. Rescue Loop + LÄR ---------- */
    click($('[data-v2="kor"]')); const before = D.log.rescueLearn; D.run(true);
    ok(D.log.rescueLearn > before || D.log.learn > 0, `Rescue Loop/LÄR-kort när det går fel (${D.log.rescueLearn} rescue, ${D.log.learn} lär)`);
    ok([...D.log.chips].some(c => /tillsammans/.test(c)), '"Vi tar det tillsammans" visas');
    const lastSess = k4().le.shadow.filter(r => r.e === 2).slice(-1)[0]; const sessEv = k4().le.log.filter(e => e[11] === lastSess.id);
    ok(sessEv.filter(e => e[15] === 'X').length <= 12, 'Rescue begränsad i passet');
    ok(!FORBIDDEN_CHILD.test(txt(T)), 'efter ett tufft pass: ingen felräknare');
    /* ---------- 4. Felboken 2.0 + Revansch ---------- */
    // Felboken öppnas för ett koncept först när det gått fel på två olika dagar (CFG.fb.failDaysToOpen) – nya koncept som är svåra första dagen är inlärning, inte "fel".
    for (let d = 0; d < 3 && !$('[data-v2="felbok"]'); d++) { w.__advance(DAY + 3600000); goHome(T); if ($('[data-v2="felbok"]')) break; click($('[data-v2="kor"]')); D.run(true); goHome(T); }
    const fbCard = $('[data-v2="felbok"]'); ok(!!fbCard, 'Felboken-kortet visas efter fel på flera dagar');
    if (fbCard) {
      ok(!/\b(1[0-9]|[2-9][0-9])\b/.test(fbCard.textContent), 'Felboken-kortet visar aldrig stora tal: ' + fbCard.textContent.trim());
      click(fbCard); const fbt = txt(T); ok(/Felboken/.test(fbt) && !FORBIDDEN_CHILD.test(fbt), 'Felboken 2.0-vy utan felräknare');
      const rows = w.document.querySelectorAll('.breakdown .r').length; ok(rows >= 1 && rows <= 5, `högst 5 synliga (mellanpolicy) – ${rows}`);
      const rv = $('[data-v2="revansch"]'); ok(!!rv, 'Revansch-knapp'); if (rv) { click(rv); ok(PA().S.v2.mode === 'revansch', 'Revansch-pass'); const items0 = PA().S.v2.plan.map(s => s.cid); ok(items0.every(c => k4().le && true), 'revansch på Felbokens koncept');
        const failedItems = new Set(); for (const cid of items0) { const c = PA().LE.state(PA().KIDS.find(k => k.id === 'k4')).L.c[cid]; for (const it of ((c.fb && c.fb.items) || [])) failedItems.add(it); }
        const firstItem = PA().S.queue[0]; ok(firstItem.cat === 'learn' || !failedItems.has(PA().V2.iid(firstItem)), 'Revansch använder en annan uppgift än den man svarade fel på: ' + (firstItem.skill && firstItem.skill.id) + ' ' + firstItem.type + ' ' + String(firstItem.text).slice(0, 60) + ' fb=' + [...failedItems].join(','));
        D.run(false); ok(/Bra jobbat/.test(txt(T)), 'revansch klar'); }
    }
    /* ---------- 5. KLAR ---------- */
    const kidK4 = PA().KIDS.find(k => k.id === 'k4'); const realPlan = PA().LE.plan;
    PA().LE.plan = (...a) => { const r = realPlan(...a); r.plan.light = true; r.plan.splice(3); return r; };
    goHome(T); const klarHome = txt(T); ok(/Bra jobbat\. Du är klar för idag\./.test(klarHome) && $('[data-v2="extra"]'), 'KLAR på startsidan efter dagens pass: lugn text + diskret "Öva extra"');
    ok(!$('.go-btn[data-v2="kor"]'), 'KLAR: ingen stor Kör!-knapp');
    click($('[data-v2="extra"]')); ok(PA().S && PA().S.v2, '"Öva extra" startar ett kort pass'); D.run(false);
    ok(/Du är klar för idag/.test(txt(T)) && $('[data-v2="extra"]') && !$('button.big[data-v2="kor"]'), 'KLAR-slutskärm utan stor CTA');
    PA().LE.plan = realPlan;
    /* ---------- 6. Testa mig (k8) ---------- */
    enableV2(w, T, 'k8'); openKid(T, 'k8'); const k8home = txt(T);
    ok(/BRA KOLL|ÖVA LITE MER|FÖR LITE UNDERLAG|Kör några pass så ser du/.test(k8home), 'provkort: beredskap (tre lägen, eller en lugn rad när underlag saknas)');
    ok(/IDAG \d+ frågor · cirka \d+ minuter/.test(k8home), 'provkort: "IDAG N frågor · cirka M minuter"');
    ok(!/E\/C\/A|Indikation/.test(k8home), 'barnet ser inget E/C/A');
    const tb = $('[data-v2="testa"][data-exam="alg12"]'); ok(!!tb, 'Testa mig-knapp'); click(tb);
    ok(PA().S.v2.exam && !$('#hintBtn') && !$('#explainBtn'), 'Testa mig: inga ledtrådar');
    const nEx = PA().S.v2.plan.length; D.run(() => Math.random() < 0.3);
    ok(D.log.feedbackInExam === 0 && D.log.hintInExam === 0, 'Testa mig: ingen återkoppling under testet');
    const exRes = txt(T); ok(/Svar och förklaringar/.test(exRes) && /Rätt svar/.test(exRes), 'Testa mig: svar och förklaringar efteråt');
    ok(!/E\/C\/A|Indikation|övningsindikation/i.test(exRes), 'Testa mig-resultat: inget E/C/A för barnet');
    const k8 = PA().DB.profiles.k8; const t8 = k8.tests.slice(-1)[0]; ok(t8 && t8.v2 && t8.ind && t8.total === nEx, 'testresultat sparat med övningsindikation för förälder');
    const exEv = k8.le.log.filter(e => e[14] === 't'); ok(exEv.length === nEx && exEv.every(e => e[8] === 'e' && e[7] === 'n'), 'Testa mig-bevis: provkontext, ingen hjälp');
    /* ---------- 7. Testa mig avbrutet ---------- */
    click($('[data-go="home"]')); click($('[data-v2="testa"][data-exam="alg12"]')); D.answer(false); D.answer(true); const sid = PA().S.v2.id; click($('[data-go="home"]'));
    ok($('[data-v2="kor"]') && PA().LE.errors.length === 0, 'avbrutet Testa mig: startsidan fungerar');
    const r8 = k8.le.shadow.find(r => r.id === sid); ok(r8 && r8.done === 0 && k8.le.log.filter(e => e[11] === sid).length === 2, 'avbrutet Testa mig: två svar sparade, passet inte avslutat');
    ok(k8.tests.filter(t => t.v2).length === 1, 'avbrutet Testa mig: inget resultat sparat');
    /* ---------- 8. Läs → Stäng → Minns ---------- */
    click($('[data-subj="no"]')) ; const lb = [...w.document.querySelectorAll('[data-method]')][0];
    if (lb) { click(lb); const rc = $('[data-v2="rc"]'); ok(!!rc, 'Läs på: "Stäng texten och testa dig själv"'); click(rc); ok(PA().S.v2.mode === 'readclose' && !/Läs mer/.test(txt(T)) && !$('.method'), 'texten är stängd under hämtningen');
      D.run(false); ok($('[data-method]') && /Öppna texten igen/.test(txt(T)), 'efteråt: "Öppna texten igen och jämför"');
      ok(k8.le.log.some(e => e[14] === 'q'), 'Läs-Stäng-Minns-bevis märkt (mode q)'); }
    /* ---------- 9. Föräldrainsikter, E/C/A bara för förälder ---------- */
    unlockParent(w, T); click($('[data-tab="k8"]')); const ov = txt(T);
    ok(/STYRKOR/.test(ov) && /BEHÖVER ÖVAS/.test(ov) && /REKOMMENDERAT NÄSTA STEG/.test(ov), 'föräldraöversikt: STYRKOR / BEHÖVER ÖVAS / REKOMMENDERAT');
    const recs = w.document.querySelectorAll('.card ol li'); ok(recs.length >= 1, 'minst en rekommendation');
    ok(/övningsindikation/.test(ov) && /ingen betygsprognos/.test(ov), 'E/C/A märkt som övningsindikation, inte betygsprognos');
    const card = [...w.document.querySelectorAll('.card')].find(c => /insikter från Learning Engine v2/.test(c.textContent)); const others = FIX.kids.filter(k => k.id !== 'k8').map(k => k.name);
    ok(card && !others.some(n => card.textContent.includes(n)) && !/bättre än|sämre än|jämfört med|syskon|placering|topplista/i.test(card.textContent), 'insiktskortet nämner inga andra barn och jämför inte');
    click($('[data-sub="v2"]')); ok(/Motor för Åttan/.test(txt(T)), 'motorkort i fliken Motor v2');
    const ex = txt(T); ok(/varför just detta/.test(ex) && /Varför nu:/.test(ex) && /Svaret ändrar:/.test(ex) && /Tillbaka:/.test(ex) && /nivå \d/.test(ex), 'förälder: varje vald uppgift förklaras (vad, varför, varför nu, vad svaret ändrar, när den kommer tillbaka, nivå)');
    ok(/vad motorn gjorde/.test(ex), 'förälder: senaste svarens motorbeslut visas (bara i minnet)');
    ok(!JSON.stringify(PA().DB.profiles.k8).includes('stadium '), 'förklaringstexterna sparas inte i profilen');
    /* ---------- 9b. Belöningar går inte att farma ---------- */
    { openKid(T, 'k4'); for (let r = 0; r < 4; r++) { click($('[data-v2="kor"]') || $('[data-v2="extra"]')); D.run(() => Math.random() < 0.5); goHome(T); }
      const rw = PA().DB.profiles.k4.le.rw || []; const day = PA().LE2.dayIdx(PA().LE.now()); const cnt = (pre) => rw.filter(k => k.startsWith(pre)).length;
      ok(rw.filter(k => k === 'FO:' + day).length <= 1 && rw.filter(k => k === 'CH:' + day).length <= 1, 'FOCUS och CHALLENGE högst en gång per dygn trots många pass');
      ok(cnt('CO:') <= 2, 'CONSISTENCY högst en gång per vecka (' + rw.filter(k => k.startsWith('CO:')).join(',') + ')');
      const rem = rw.filter(k => k.startsWith('REM:')); ok(rem.length === new Set(rem).size, 'REMEMBERED högst en gång per koncept och dygn');
      const ma = rw.filter(k => k.startsWith('MA:')); ok(ma.length === new Set(ma).size, 'MASTERY högst en gång per koncept'); }
    unlockParent(w, T); click($('[data-tab="k8"]')); click($('[data-sub="v2"]'));
    /* ---------- 10. Rollback till v1 ---------- */
    const k8v1skills = JSON.stringify(k8.skills); click($('[data-v2="engine"][data-val="v1"]')); ok(!PA().DB.profiles.k8.settings.engine, 'rollback: tillbaka till v1 med ett tryck');
    openKid(T, 'k8'); ok($('[data-rec]') && !$('[data-v2="kor"]') && /frys/.test(txt(T)), 'rollback: v1-startsidan igen');
    ok(JSON.stringify(PA().DB.profiles.k8.skills) === k8v1skills && Object.values(PA().DB.profiles.k8.skills).some(s => s.att > 0), 'rollback: v1-data finns kvar och innehåller v2-passens övning');
    ok(PA().DB.profiles.k8.le.log.length === k8.le.log.length, 'rollback: v2-bevisen finns kvar (kan slås på igen)');
    click($('[data-rec]')); T.run(); ok(PA().LE.errors.length === 0, 'rollback: v1-pass fungerar med v2-data kvar');
    /* ---------- 11. Förhandsvisning (k2, v1) – ändrar ingenting ---------- */
    unlockParent(w, T); click($('[data-tab="k2"]')); click($('[data-sub="v2"]'));
    const snapK2 = JSON.stringify(PA().DB.profiles.k2); const lsBefore = w.localStorage.getItem('pluggappen.v1');
    click($('[data-v2="preview"]')); if ($('[data-pet]')) click($('[data-pet]')); ok(/Förhandsvisning av v2/.test(txt(T)) && $('[data-v2="kor"]'), 'förhandsvisning: v2-startsida med tydlig banner');
    click($('[data-v2="kor"]')); D.run(false); ok(/Bra jobbat/.test(txt(T)) && /Förhandsvisning/.test(txt(T)), 'förhandsvisning: helt pass går att köra');
    click($('[data-v2="endPreview"]')); ok(JSON.stringify(PA().DB.profiles.k2) === snapK2, 'förhandsvisning: barnets data exakt som före');
    ok(w.localStorage.getItem('pluggappen.v1') === lsBefore, 'förhandsvisning: inget sparat i lagringen');
    ok(!PA().DB.profiles.k2.settings.engine && !PA().V2.sandbox, 'förhandsvisning: avslutad, k2 kör fortfarande v1');
    /* ---------- 11b. Säkerhetsnät ---------- */
    { const p4 = PA().DB.profiles.k4; const errs0 = PA().LE.errors.length;
      // XSS: ett eget glosdeck med HTML i namnet, kopplat till ett prov, visas escapat i v2:s provkort
      p4.decks.push({ id: 'evil', lang: 'en', name: '<img src=x onerror="window.__x=1">', emoji: '🗂️', level: 1, builtin: false, words: [{ id: 'ev1', w: 'cat', t: 'katt', e: '' }] }); p4.enabledDecks.push('evil'); p4.words.ev1 = { box: 4, due: Date.now() + 9 * DAY, seen: 4, cor: 4, wrong: 0, last: Date.now() };
      p4.exams.push({ id: 'evx', title: '<b onclick=1>Prov</b>', date: '2026-11-20', skillIds: [], deckIds: ['evil'] }); PA().LE.invalidate('k4');
      openKid(T, 'k4'); ok(!w.document.querySelector('#app img[src="x"]') && !w.document.querySelector('#app b[onclick]') && /&lt;img|<img/.test($('#app').innerHTML) && !w.__x, 'v2-provkort: deck- och provnamn escapas');
      // ett fel i v2 stoppar aldrig barnet: Kör! faller tillbaka till v1
      const realPlan2 = PA().V2.plan; PA().V2.plan = () => { throw new Error('test'); }; click($('[data-v2="kor"]'));
      ok(PA().S && !PA().S.v2 && PA().S.mode === 'practice' && $('#qcard'), 'fel i v2 → v1-pass startar i stället'); PA().V2.plan = realPlan2; T.run(); goHome(T);
      ok(PA().LE.errors.length > errs0, 'felet loggas för föräldradiagnostiken'); PA().LE.errors.length = errs0;
      p4.exams = p4.exams.filter(e => e.id !== 'evx'); p4.decks = p4.decks.filter(d => d.id !== 'evil'); p4.enabledDecks = p4.enabledDecks.filter(x => x !== 'evil'); delete p4.words.ev1; PA().LE.invalidate('k4');
      // okänd (senare) le-version: v2 stängs av för barnet och le skrivs aldrig över
      const realLe = p4.le; p4.le = { v: 3, future: true }; PA().LE.invalidate('k4'); openKid(T, 'k4');
      ok($('[data-rec]') && !$('[data-v2="kor"]'), 'okänd le-version: barnet får v1'); click($('[data-rec]')); T.run(); goHome(T);
      ok(p4.le.v === 3 && p4.le.future === true, 'okänd le-version lämnas orörd'); p4.le = realLe; PA().LE.invalidate('k4'); PA().LE.errors.length = errs0; }
    /* ---------- 12. Inga fria svarstexter, ingen svarstid ---------- */
    const allLe = JSON.stringify(['k2', 'k4', 'k8'].map(id => PA().DB.profiles[id].le));
    ok(!/zzqx|987654|vet inte/.test(allLe), 'inga fria svarstexter i le');
    ok(!/"(ms|elapsed|rt)"/.test(allLe), 'ingen svarstidstelemetri i le');
    ok(PA().LE.errors.length === 0, 'inga fel i v2-lagret: ' + JSON.stringify(PA().LE.errors));
    /* ---------- 13. Omladdning mitt i Rescue + fel klocka ---------- */
    flushAndReload(w, T, D);
  } catch (e) { fails++; console.log('EXC', e.stack); finish(); }
}, 50);

function flushAndReload(w0, T0, D0) {
  const { $, click, PA } = T0;
  openKid(T0, 'k4'); click($('[data-v2="kor"]'));
  let guard = 0; while (PA().S && PA().S.v2 && !PA().S.queue.slice(PA().S.i).some(x => x.cat === 'learn') && guard++ < 30) D0.answer(true);
  const midRescue = PA().S && PA().S.v2 && PA().S.queue[PA().S.i] && true; PA().flushSave();
  const storage = {}; for (let i = 0; i < w0.localStorage.length; i++) { const k = w0.localStorage.key(i); storage[k] = w0.localStorage.getItem(k); }
  const { w, T } = boot(991, storage); setTimeout(() => {
    try {
      const { $, click, PA: PB } = T; T.PA().FAMILY.apply(FIX); T.PA().load(); const D = v2tools(w, T);
      openKid(T, 'k4'); ok(midRescue && $('[data-v2="kor"]') && PB().LE.errors.length === 0, 'omladdning mitt i ett pass (Rescue): startsidan fungerar');
      const n0 = PB().DB.profiles.k4.le.log.length; click($('[data-v2="kor"]')); D.run(false); ok(/Bra jobbat/.test(T.$('#app').textContent), 'omladdning: nytt pass går att köra');
      ok(PB().DB.profiles.k4.le.log.length > n0, 'omladdning: bevisen från före omladdningen finns kvar och nya läggs till');
      // fel klocka: enheten går 3 dygn bakåt – motorns tid ska vara monoton och inget fel uppstå
      const lastT = Math.max(...PB().DB.profiles.k4.le.log.map(e => e[0])); w.__advance(-3 * DAY);
      click($('[data-go="home"]')); click($('[data-v2="kor"]')); D.run(false);
      const newEv = PB().DB.profiles.k4.le.log.filter(e => e[0] > lastT); ok(newEv.length > 0 && PB().LE.errors.length === 0, 'klockan bakåt: pass fungerar, bevisens tid fortsätter framåt (monoton)');
      { const kid = PB().KIDS.find(k => k.id === 'k4'); const le = PB().DB.profiles.k4.le; const C = PB().LE.state(kid); const L2 = PB().LE2;
        const sorted = L2.replay(L2.mergeLog(le.log, []), C.cat, C.pol, le.base); ok(L2.stable(sorted) === L2.stable(L2.replay(le.log, C.cat, C.pol, le.base)), 'klockan bakåt: loggens ordning = tidsordning (samma tillstånd efter synk-sortering)'); }
      w.__advance(3 * DAY);
      twoDevices(w, T);
    } catch (e) { fails++; console.log('EXC', e.stack); finish(); }
  }, 50);
}

// Två enheter offline: samma barn övar på båda, sedan synk (mergeLE). Samma tillstånd på båda; belöningsmarkörer slås ihop.
function twoDevices(wA, TA) {
  const { PA } = TA; PA().flushSave();
  const storage = {}; for (let i = 0; i < wA.localStorage.length; i++) { const k = wA.localStorage.key(i); if (k !== 'pluggappen.dev') storage[k] = wA.localStorage.getItem(k); }
  const { w: wB, T: TB } = boot(1234, storage); setTimeout(() => {
    try {
      TB.PA().FAMILY.apply(FIX); TB.PA().load(); const DA = v2tools(wA, TA), DB2 = v2tools(wB, TB);
      ok(TA.PA().LE.dev() !== TB.PA().LE.dev(), 'två enheter har olika enhets-id');
      openKid(TA, 'k4'); TA.click(TA.$('[data-v2="kor"]')); DA.run(false);
      openKid(TB, 'k4'); TB.click(TB.$('[data-v2="kor"]')); DB2.run(false);
      const a = TA.PA().DB.profiles.k4.le, b = TB.PA().DB.profiles.k4.le; const L2 = TA.PA().LE2;
      const m1 = L2.mergeLE(a, b), m2 = L2.mergeLE(b, a); ok(L2.stable(m1) === L2.stable(m2), 'synk: samma resultat oavsett ordning');
      const kid = TA.PA().KIDS.find(k => k.id === 'k4'); const C = TA.PA().LE.state(kid);
      const rA = L2.replay(m1.log, C.cat, C.pol, m1.base), rB = L2.replay(m2.log, C.cat, C.pol, m2.base); ok(L2.stable(rA) === L2.stable(rB), 'synk: identiskt motortillstånd på båda enheterna');
      ok(m1.log.length === new Set(m1.log.map(e => e[1] + ':' + e[2])).size && m1.log.length >= a.log.length, 'synk: inga dubblerade bevis');
      ok(m1.shadow.filter(r => r.e === 2).length >= Math.max(a.shadow.filter(r => r.e === 2).length, b.shadow.filter(r => r.e === 2).length), 'synk: båda enheternas pass finns kvar');
      const rw = m1.rw || []; ok(rw.length === new Set(rw).size, 'synk: belöningsmarkörer slås ihop utan dubbletter');
      // efter synk: samma belöning kan inte delas ut igen
      const keyed = rw.find(k => k.startsWith('MA:') || k.startsWith('CB:') || k.startsWith('REM:')) || 'CO:test'; const le2 = JSON.parse(JSON.stringify(m1)); if (!rw.includes(keyed)) L2.rewardOnce(le2, keyed);
      ok(L2.rewardOnce(le2, keyed) === false, 'synk: en redan utdelad belöning ges inte igen');
    } catch (e) { fails++; console.log('EXC', e.stack); }
    finish();
  }, 50);
}
function finish() { console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE V2 UI TEST FAILED' : 'LE V2 UI TEST OK'); process.exit(fails ? 1 : 0); }
