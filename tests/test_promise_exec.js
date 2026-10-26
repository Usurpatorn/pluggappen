/* Experience v3 – acceptansgrind "löfte → utförande" (den riktiga appen, jsdom, riktiga klick, fast klocka, syntetisk familj).
   För VARJE primär knapp på startsidan och på KLAR-skärmen, i alla tre upplevelser + Klassisk, i tillstånden:
   ny profil · inget prov · CORE klar · FLOW · ett prov · prov utanför motorns 21 dygn · två prov · saknad koppling · saknat innehåll ·
   återkommande · v1-reserv · profilbyte (testadressens egen lagring prövas i test_preview.js)
   kontrolleras:
   1. vad skärmen lovar (knappens text, kortets rubrik, "cirka N min", provets namn, "N av M uppgifter inför provet")
   2. vilket sammanhang klicket skickar (läge, prov-id, barn)
   3. vilket pass som faktiskt startar (motorns plan = planen som visades)
   4. varför aktiviteterna hör dit (provknappar: bara provets koncept; varje planerad plats har motorns skäl "why")
   Tabellen skrivs ut (promise → execution) och används i slutrapporten. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js');
const { v2tools, toStart, setEngine } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const ROWS = [];

async function run(kidId, exp) {
  const w = mkWin({ seed: 50 + kidId.length + exp.length, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; const { $, click } = T;
  PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T); const rnd = rng(13);
  const kid = () => PA().KIDS.find(k => k.id === kidId); const p = () => PA().DB.profiles[kidId];
  PA().EXP.set(kid(), exp); PA().save();
  const open = () => { toStart(T); click($(`[data-kid="${kidId}"]`)); if ($('[data-pet]')) click($('[data-pet]')); };
  const iso = (d) => new Date(w.Date.now() + d * DAY).toISOString().slice(0, 10);
  const setExams = (list) => { p().exams = list; PA().save(); PA().LE.invalidate(kidId); };
  const cidsOf = (e) => new Set(PA().V2.examCidsActive(kid(), e));
  const play = () => { const seen = []; let g = 0; while (PA().S && PA().S.v2 && $('#qcard') && g++ < 70) { const it = PA().S.queue[PA().S.i]; if (it.cat !== 'learn' && it.spec) seen.push(it.spec.cid); D.answer(() => rnd() < 0.2); w.__advance(4000); } return seen; };
  const tag = `${exp}/${kidId}`;

  // Kontrollera en knapp: löfte före klick → sammanhang → startat pass → innehåll
  function check(state, el) {
    const act = el.dataset.v2; const label = norm(el.textContent); const examId = el.dataset.exam; const card = el.closest('section, .card'); const cardTxt = norm(card && card.textContent);
    const exams = PA().LE.exams(kid(), p()).filter(e => PA().daysUntil ? true : true);
    const C = PA().LE.state(kid()); const now = PA().LE.now();
    let expectPlan = null; if (act === 'kor') expectPlan = PA().V2.peekPlan(kid()).plan; else if (act === 'flow') expectPlan = PA().EXP.peekFlow(kid());
    else if (act === 'mission') expectPlan = PA().V2.plan(kid(), 'mission', C, now, null, { examId });
    const mins = (label.match(/cirka (\d+) min/) || [])[1];
    click(el); const S = PA().S;
    if (!S || !S.v2) { ok(act === 'kor' && exp === 'v1', `${tag} ${state}: "${label.slice(0, 40)}" startade inget v2-pass`); return; }
    const V = S.v2; const plan = V.plan; const pc = plan.map(s => s.cid);
    const row = { state, exp: tag, promise: label.slice(0, 60), mode: V.mode, exam: V.extra && V.extra.examId || '', n: plan.length };
    ok(S.kid.id === kidId, `${tag} ${state} ${act}: rätt barn`);
    const MODE = { kor: 'kor', flow: 'flow', mission: 'mission', revansch: 'revansch', testa: 'exam' };
    ok(V.mode === MODE[act] || (act === 'testa' && V.exam), `${tag} ${state} ${act}: knappen startar rätt läge (${V.mode})`);
    if (expectPlan) ok(JSON.stringify(pc) === JSON.stringify(expectPlan.map(s => s.cid)), `${tag} ${state} ${act}: passet som startade = planen som visades`);
    if (mins && expectPlan) { const m = +mins; const calc = [PA().EXP.mins(plan, kid()), PA().V2.mins(plan.length)]; ok(calc.includes(m), `${tag} ${state} ${act}: "cirka ${m} min" stämmer med passet (${calc.join('/')})`); }
    if (act === 'kor') { const mN = (label.match(/(?<!av )(\d+) uppgifter/) || cardTxt.match(/(?<!av )(\d+) (?:uppgifter|små utmaningar)/) || [])[1]; if (mN) ok(+mN === plan.length, `${tag} ${state} kor: "${mN} uppgifter" = passets längd (${plan.length})`); }
    ok(plan.every(s => s.why || ['boss', 'testa', 'readclose'].includes(s.role)), `${tag} ${state} ${act}: varje planerad plats har motorns skäl`);
    // Provlöften: provknapparna spelar bara provets koncept; Kör! nämner ett prov bara om passet innehåller det (och med rätt andel)
    for (const e of exams) {
      const set = cidsOf(e); const share = PA().V2.missionShare(plan, [...set]); const t = e.title.toUpperCase();
      if ((act === 'kor' || act === 'flow') && (label.toUpperCase().includes(t) || (cardTxt.toUpperCase().includes('NÄSTA MÅL' + t) || cardTxt.toUpperCase().includes('DAGENS MISSION · ' + t)) || /MOT PROVET/.test(label))) {
        if (label.toUpperCase().includes(t) || /NÄSTA MÅL|DAGENS MISSION/.test(cardTxt.toUpperCase()) || /MOT PROVET/.test(label)) ok(share.n > 0 || !set.size, `${tag} ${state} ${act}: "${label.slice(0, 40)}" lovar ${e.title} – passet innehåller provet (${share.n} av ${share.of})`);
      }
      if ((act === 'mission' || act === 'testa') && e.id === examId) { ok(pc.length > 0 && pc.every(c => set.has(c)), `${tag} ${state} ${act}: bara ${e.title}s koncept`); row.share = `${share.n}/${share.of}`; }
    }
    const seen = play(); row.played = seen.length;
    if (act === 'mission' || act === 'testa') { const e = exams.find(x => x.id === examId); const set = cidsOf(e); ok(seen.every(c => set.has(c)), `${tag} ${state} ${act}: allt som spelades hör till provet`); }
    ok(!PA().S || !PA().S.v2 || !$('#qcard'), `${tag} ${state} ${act}: passet tar slut`);
    ROWS.push(row);
  }
  const ctas = () => [...w.document.querySelectorAll('[data-v2="kor"],[data-v2="mission"],[data-v2="flow"],[data-v2="testa"],[data-v2="revansch"]')];
  function state(name, opts = {}) {
    open(); const home = norm($('#app').textContent);
    if (opts.home) opts.home(home);
    const list = ctas().filter(el => !opts.only || opts.only.includes(el.dataset.v2));
    ok(list.length > 0 || exp === 'v1', `${tag} ${name}: startsidan har minst en primär knapp`);
    const seenKinds = new Set();
    for (const el0 of list) { const key = el0.dataset.v2 + (el0.dataset.exam || ''); if (seenKinds.has(key)) continue; seenKinds.add(key);
      open(); const el = ctas().find(x => x.dataset.v2 + (x.dataset.exam || '') === key); if (!el) continue; check(name, el); }
  }

  // 1. Ny profil, inget prov
  setExams([]); state('ny profil', { only: ['kor'], home: (h) => ok(!/tillbaka/i.test(h), `${tag} ny profil: ingen "välkommen tillbaka"`) });
  // 2. Inget prov (med historik)
  w.__advance(DAY); state('inget prov', { only: ['kor'] });
  // 3. CORE klar → KLAR → FLOW (en knapp på hemmet efter CORE)
  open(); { const done = norm($('#app').textContent); const fb = $('[data-v2="flow"]');
    ok(!$('.go-btn[data-v2="kor"]') || exp === 'classic', `${tag} CORE klar: ingen ny "dagens plan"-knapp på hemmet`);
    if (exp !== 'classic') { ok(!!fb && /cirka \d+ min/.test(fb.textContent), `${tag} CORE klar: FLOW erbjuds med tid`); ok(!/MOT PROVET/.test(done) || false, `${tag} CORE klar utan prov: inget provlöfte`); }
    if (fb) { open(); check('FLOW', $('[data-v2="flow"]')); } }
  // 4. Ett prov med koppling (Äldre/Mellan: matte; Yngre: matte i sin mall)
  w.__advance(DAY);
  const C0 = PA().LE.state(kid()); const sk = [...new Set(Object.entries(C0.cat).filter(([, d]) => d.kind === 'skill' && d.active !== false).map(([c]) => c.slice(2)))];
  const e1 = { id: 'e1', title: 'Matteprov', date: iso(9), skillIds: sk.slice(0, 3), deckIds: [] };
  setExams([e1]); state('ett prov');
  // 4b. Ett prov 25 dygn bort på moment som inte är påbörjade: inom uppdragets 28 dygn men utanför motorns 21 – det ursprungliga felet
  w.__advance(DAY);
  { const L = PA().LE.state(kid()).L.c; const fresh = sk.filter(x => !(L['s:' + x] || {}).n).slice(-3); const eF = { id: 'eF', title: 'Algebraprov', date: iso(25), skillIds: fresh.length ? fresh : sk.slice(-3), deckIds: [] };
    setExams([eF]); state('prov om 25 dygn'); }
  // 5. Två prov
  w.__advance(DAY);
  const e2 = kidId === 'k8' ? { id: 'e2', title: 'Kemiprov', date: iso(16), kps: ['ph-skalan', 'indikatorer', 'syra-kanne'].map(k => 'k:kemi8-syror-baser/' + k), skillIds: [], deckIds: [] } : { id: 'e2', title: 'Läxförhör', date: iso(16), skillIds: sk.slice(-2), deckIds: [] };
  setExams([e1, e2]); state('två prov');
  // 6. Saknad koppling (provet har inga områden)
  w.__advance(DAY); setExams([{ id: 'e3', title: 'Engelskaprov', date: iso(6), skillIds: [], deckIds: [] }]);
  state('saknad koppling', { home: (h) => ok(exp === 'explore' || exp === 'v1' || /inte inlagda i appen ännu/.test(h), `${tag} saknad koppling: ärlig text`) });
  // 7. Saknat innehåll (privat paket finns inte på enheten)
  w.__advance(DAY); setExams([{ id: 'e4', title: 'Fysikprov', date: iso(6), kps: ['k:privat-saknas/a'], skillIds: [], deckIds: [] }]);
  state('saknat innehåll', { home: (h) => ok(exp === 'explore' || exp === 'v1' || /inte inlagda i appen ännu/.test(h), `${tag} saknat innehåll: ärlig text`) });
  // 8. Återkommande efter uppehåll
  setExams([]); w.__advance(6 * DAY);
  state('återkommande', { only: ['kor'], home: (h) => { const plan = PA().V2.peekPlan(kid()).plan; if (/Jag har justerat planen/.test(h)) ok(!!(plan.restart || plan.light || plan.some(s => s.role === 'warmup')), `${tag} återkommande: "Jag har justerat planen" bara när motorn har justerat`); } });
  // 8b. Revansch: fel som hamnat i Felboken – knappen startar ett Revansch-pass med Felbokens saker (bara när hemmet erbjuder det)
  for (let d = 0; d < 3 && !$('[data-v2="revansch"]'); d++) { open(); const go = $('.go-btn[data-v2="kor"]'); if (go) { click(go); D.run(() => rnd() < 0.6); } w.__advance(DAY); open(); }
  if ($('[data-v2="revansch"]')) { const fbBefore = PA().LE2.felbokChild(PA().LE.state(kid()).L, PA().LE.state(kid()).pol, PA().LE.now()).items.filter(x => x.state === 'todo').map(x => x.cid);
    const el = $('[data-v2="revansch"]'); click(el); const V = PA().S && PA().S.v2;
    ok(V && V.mode === 'revansch', `${tag} revansch: knappen startar ett Revansch-pass`);
    ok(V && V.plan.length > 0 && V.plan.every(s => fbBefore.includes(s.cid) || s.role !== 'revansch'), `${tag} revansch: Revansch-platserna är Felbokens saker`);
    ROWS.push({ state: 'revansch', exp: tag, promise: norm(el.textContent).slice(0, 60), mode: V && V.mode, exam: '', n: V ? V.plan.length : 0, played: 0 });
    D.run(() => false); }
  else if (exp !== 'explore') ROWS.push({ state: 'revansch', exp: tag, promise: '(erbjuds inte på hemmet i det här tillståndet)', mode: '-', exam: '', n: 0, played: 0 });
  // 9. v1-reserv (förälderns val): ingen v3-presentation, ett v1-pass startar
  setEngine(w, T, kidId, 'v1'); open(); { const h = norm($('#app').textContent); ok(!$('section.mission') && !$('[data-v2]'), `${tag} v1: ingen v3/v2-presentation`);
    const go = $('.go-btn'); if (go) { const nU = (norm(go.textContent).match(/(\d+) uppgifter/) || [])[1]; click(go); if (nU) ok(+nU === PA().S.queue.length, `${tag} v1: "${nU} uppgifter" = v1-passets längd (${PA().S.queue.length})`); ok(PA().S && !PA().S.v2 && PA().S.queue.length > 0, `${tag} v1: v1-pass startar`); ROWS.push({ state: 'v1-reserv', exp: tag, promise: norm(go.textContent).slice(0, 60), mode: 'v1', exam: '', n: PA().S.queue.length, played: 0 }); toStart(T); } void h; }
  setEngine(w, T, kidId, 'v2');
  ok(PA().LE.errors.length === 0, `${tag}: inga fel i v2-lagret ` + JSON.stringify(PA().LE.errors.slice(0, 2)));
}

(async () => {
  try {
    for (const [k, e] of [['k2', 'explore'], ['k4', 'grow'], ['k8', 'achieve'], ['k8', 'classic']]) await run(k, e);
    // 10. Profilbyte: ett påbörjat pass hos ett barn följer aldrig med till syskonet – syskonets knapp startar syskonets egen plan
    { const w = mkWin({ seed: 91, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; const { $, click } = T; PA().FAMILY.apply(FIX); PA().load(); PA().rerender();
      const openK = (id) => { toStart(T); click($(`[data-kid="${id}"]`)); if ($('[data-pet]')) click($('[data-pet]')); };
      openK('k8'); click($('.go-btn[data-v2="kor"]')); const v2tool = v2tools(w, T); v2tool.answer(() => false); w.__advance(4000);   // ett svar, sedan byte mitt i passet
      openK('k2'); const kid2 = PA().KIDS.find(k => k.id === 'k2'); const cat2 = PA().LE.state(kid2).cat; const home2 = norm($('#app').textContent);
      const peek = PA().V2.peekPlan(kid2).plan.map(s => s.cid); click($('.go-btn[data-v2="kor"]'));
      ok(PA().S && PA().S.kid.id === 'k2' && JSON.stringify(PA().S.v2.plan.map(s => s.cid)) === JSON.stringify(peek), 'profilbyte: syskonets KÖR startar syskonets visade plan');
      ok(PA().S.v2.plan.every(s => cat2[s.cid]), 'profilbyte: varje plats hör till syskonets katalog');
      ok(!/Åttan/.test(home2), 'profilbyte: syskonets startsida visar inte det andra barnets namn');
      ROWS.push({ state: 'profilbyte', exp: 'explore/k2', promise: 'KÖR efter byte från k8', mode: PA().S.v2.mode, exam: '', n: PA().S.v2.plan.length, played: 0 }); }
    console.log('  Löfte → utförande:');
    for (const r of ROWS) console.log(`   ${r.exp.padEnd(16)} ${r.state.padEnd(16)} "${r.promise}" → ${r.mode}${r.exam ? ' ' + r.exam : ''} · ${r.n} platser${r.share ? ' · prov ' + r.share : ''} · ${r.played} spelade`);
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'PROMISE EXEC TEST FAILED' : 'PROMISE EXEC TEST OK'); process.exit(fails ? 1 : 0);
})();
