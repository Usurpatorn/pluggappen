/* Experience v3 – golden case A (algebraprov) och B (kemiprov) som simulering i den riktiga appen (jsdom).
   Standard: SYNTETISKA skoluppgifter med samma struktur som familjens riktiga (målområden, lärarens betoning, luckor) – inga riktiga
   namn eller datum i repot. Lokalt kan samma simulering köras mot familjens privata innehåll: GOLDEN_BUNDLE=<bundle.json> GOLDEN_KID=k8
   (filen ligger aldrig i repot; utskriften innehåller bara antal och etiketter för aktivitetstyper).
   Algebra ska visa: löst exempel, eget digitalt räknande, papper, hitta felet, baklänges, problemlösning, fördröjd repetition, Revansch,
   Testa mig och CORE → KLAR → FLOW. Lärarens betonade områden ska få mer tid än övriga kapitelområden.
   Kemi ska visa: UPPTÄCK → SORTERA → MINNS → KOPPLA → ORSAK OCH EFFEKT → ANVÄND → HITTA FELET (+ Boss/Utmaning), med fördröjd repetition. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs');
const { mkWin, tools, FIX, rng, T_FIXED } = require('./le/childflow.js');
const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const isoIn = (d) => new Date(T_FIXED + d * DAY).toISOString().slice(0, 10);
const ALG = ['multin', 'forenkla', 'blandat', 'talfoljd', 'ekvation', 'problemekv', 'andragrad']; const FOCUS = ['multin', 'forenkla', 'blandat', 'talfoljd'];
const KEMI = ['ph-skalan', 'indikatorer', 'syra-kanne', 'bas-kanne', 'stark-svag', 'neutralisation', 'ph-kroppen'].map(k => 'k:kemi8-syror-baser/' + k);
const SYN = { v: 1, updatedAt: 1, packs: [], work: [
  { id: 'syn-alg', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(25), priority: 'high', skills: ALG,
    goals: ALG.map(s => ({ id: s, name: 'Område ' + s, skills: [s], teacher: FOCUS.includes(s) })), focus: { skills: FOCUS }, missing: [{ label: 'Lärobokens PDF:er', kind: 'pdf' }, { label: 'Provets format', kind: 'format' }] },
  { id: 'syn-kemi', kid: 'k8', type: 'exam', title: 'Kemiprov', date: isoIn(33), kps: KEMI, goals: [{ id: 'ph', name: 'pH', kps: KEMI.slice(0, 2) }, { id: 'rest', name: 'Övrigt', kps: KEMI.slice(2) }], missing: [{ label: 'Filmer (ej granskade)', kind: 'video' }] },
] };
const BUNDLE = process.env.GOLDEN_BUNDLE ? JSON.parse(fs.readFileSync(process.env.GOLDEN_BUNDLE, 'utf8')) : null;
const KID = process.env.GOLDEN_KID || 'k8';
if (BUNDLE) for (const w of BUNDLE.work) { w.kid = KID; const d0 = new Date(T_FIXED); const dd = Math.round((new Date(w.date + 'T08:00:00') - d0) / DAY); if (dd < 10) w.date = isoIn(25); }   // samma avstånd till provet som i den syntetiska körningen
const CONTENT = BUNDLE || SYN;

(async () => {
  try {
    const w = mkWin({ seed: 1234, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; const { $, click } = T;
    PA().FAMILY.apply(FIX); PA().load(); PA().FAMILY.applyContent(CONTENT); PA().rerender(); const D = v2tools(w, T);
    const openKid = () => { toStart(T); click($(`[data-kid="${KID}"]`)); if ($('[data-pet]')) click($('[data-pet]')); };
    const kid = () => PA().KIDS.find(k => k.id === KID); const algC = new Set(ALG.map(s => 's:' + s));
    const seen = { exempel: 0, digitalt: 0, papper: 0, hittaFelet: 0, baklanges: 0, problem: 0, minns: 0, revansch: 0, testa: 0, testaPapper: 0, flow: 0, klar: 0 };
    const kemi = { upptack: 0, sortera: 0, minns: 0, koppla: 0, orsak: 0, anvand: 0, hittaFelet: 0, boss: 0, minnsSenare: 0 };
    const time = {}; const time14 = {}; const rnd = rng(+(process.env.GSEED || 77)); let day = 0;
    const play = (mode) => {
      let g = 0; while (PA().S && PA().S.v2 && $('#qcard') && g++ < 80) {
        const S = PA().S; const it = S.queue[S.i]; const cid = it.spec && it.spec.cid; const def = cid ? (PA().LE.state(kid()).cat[cid] || {}) : {};
        const isAlg = algC.has(cid); const isKemi = cid && cid.startsWith('k:kemi8');
        if (isAlg) {
          const sk = cid.slice(2); time[sk] = (time[sk] || 0) + 1; if (day < 14) time14[sk] = (time14[sk] || 0) + 1;
          if (it.cat === 'learn') seen.exempel++;
          else if (it.paper) { seen.papper++; if (S.v2.exam) seen.testaPapper++; }
          else if (it.rhythm === 'spot' || /Hitta felet/i.test(it.text || '')) seen.hittaFelet++;
          else if (it.rhythm === 'reverse' || it.create || /Baklänges/i.test(it.text || '')) seen.baklanges++;
          else if (it.type === 'expr' || it.type === 'num') seen.digitalt++;
          if (sk === 'problemekv' && it.cat !== 'learn') seen.problem++;
          if (it.spec.role === 'remember' && it.cat !== 'learn') seen.minns++;
          if (S.v2.mode === 'revansch') seen.revansch++;
        }
        if (isKemi) {   // hela upplevelsen: CORE, FLOW och Testa mig
          if (it.cat === 'learn' && it.spec.role === 'intro') kemi.upptack++;
          else if (it.type === 'sort' && it.form !== 'mistake') kemi.sortera++;
          else if (it.form === 'recall') kemi.minns++;
          else if (it.form === 'relationship') kemi.koppla++;
          else if (it.form === 'cause') kemi.orsak++;
          else if (it.form === 'application') kemi.anvand++;
          else if (it.form === 'mistake') kemi.hittaFelet++;
          if (it.spec.role === 'boss' || it.spec.mode === 'challenge') kemi.boss++;
          if (it.spec.role === 'remember') kemi.minnsSenare++;
        }
        void def; D.answer(() => rnd() < (mode === 'exam' ? 0.25 : 0.22)); w.__advance(5000);
      }
    };
    let atExam = null;
    for (let d = 0; d < 34; d++) { day = d; if (d === 23) atExam = JSON.parse(JSON.stringify(PA().LE.state(kid()).L.c));
      openKid();
      if (d === 30) { PA().V2.start(kid(), 'exam', { examId: 'w:' + CONTENT.work[1].id }); play('exam'); openKid(); }
      if (d === 20) { const b = $('[data-v2="testa"]'); if (b) { click(b); seen.testa++; play('exam'); } openKid(); }
      if ($('[data-v2="felbok"]') && d % 4 === 3) { click($('[data-v2="felbok"]')); if ($('[data-v2="revansch"]')) { click($('[data-v2="revansch"]')); play('rev'); } openKid(); }
      const kor = $('.go-btn[data-v2="kor"]'); if (kor) { click(kor); play('core'); if (/DAGENS PLAN KLAR/.test($('#app').textContent)) seen.klar++; }
      if (d % 3 === 1 && $('[data-v2="flow"]')) { click($('[data-v2="flow"]')); seen.flow++; play('flow'); }
      w.__advance(DAY);
    }
    // Testa mig om det inte gick att nå hemifrån (t.ex. hopfällt): starta direkt
    if (!seen.testa) { openKid(); PA().V2.start(kid(), 'exam', { examId: 'w:' + CONTENT.work[0].id }); seen.testa++; play('exam'); }
    console.log('  Algebra:', JSON.stringify(seen));
    console.log('  Tid per område (uppgifter):', JSON.stringify(time), ' första två veckorna:', JSON.stringify(time14));
    console.log('  Kemi:', JSON.stringify(kemi));
    for (const [k, v] of Object.entries(seen)) ok(v > 0, `algebra: ${k} förekommer (${v})`);
    ok(seen.testaPapper >= 2 && seen.testaPapper <= 3, `Testa mig: 2–3 pappersuppgifter (${seen.testaPapper})`);
    // Lärarens betoning (kravet: betonade områden får mer tid). Mäts per område under de två första veckorna, då uppdraget byggs upp;
    // närmare provet sprids repetitionen efter vad som sitter (hållbar inlärning), så totalsiffran styrs mest av hur många fel som görs.
    // Stabilt över tio frön (GSEED=1..9, 77). Dessutom introduceras de betonade områdena först.
    const fs0 = (sk) => ((atExam || {})['s:' + sk] || {}).fs || Infinity; const st0 = (sk) => ((atExam || {})['s:' + sk] || {}).st || 0;
    const avg = (arr, f) => arr.reduce((a, x) => a + f(x), 0) / arr.length; const NON = ALG.filter(s => !FOCUS.includes(s));
    console.log('  Introducerad (dygn från start):', JSON.stringify(Object.fromEntries(ALG.map(s => [s, Math.round((fs0(s) * 1000 - T_FIXED) / DAY)]))), ' stadium dagen före provet:', JSON.stringify(Object.fromEntries(ALG.map(s => [s, st0(s)]))));
    ok(Math.max(...FOCUS.map(fs0)) <= Math.min(...NON.map(fs0)), 'lärarens betonade områden introduceras före övrigt kapitelinnehåll');
    const t14 = (sk) => time14[sk] || 0;
    ok(avg(FOCUS, t14) > avg(NON, t14), `betonade områden får mer tid per område de två första veckorna (${avg(FOCUS, t14).toFixed(1)} mot ${avg(NON, t14).toFixed(1)} uppgifter)`);
    for (const [k, v] of Object.entries(kemi)) ok(v > 0, `kemi: ${k} förekommer (${v})`);
    ok(PA().LE.errors.length === 0, 'inga fel i v2-lagret ' + JSON.stringify(PA().LE.errors.slice(0, 2)));
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'GOLDEN CASES TEST FAILED' : 'GOLDEN CASES TEST OK'); process.exit(fails ? 1 : 0);
})();
