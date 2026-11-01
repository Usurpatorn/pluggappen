/* 3.7.2 Ägarens krav: "Kör" för ett prov, en läxa eller ett glosförhör ska aldrig ge ett pass på en eller två frågor (barnet tappade fokus).
   Riktiga appen i jsdom, SYNTETISK familj och skoluppgifter, fast klocka. För varje form av mål (en färdighet, flera färdigheter, en eller två
   kunskapspunkter, en hel paketfärdighet, glosor, blandat) och olika avstånd till målet (14, 7, 3, 1 och 0 dygn), före och efter dagens pass:
   · erbjuder raden Kör → passet som spelas har minst V2.MISSION_MIN uppgifter (eller alla förfallna glosor), bara målets innehåll,
     och "Kör · N min" stämmer med passet
   · erbjuder raden ingen Kör → ärlig text, ingen knapp
   · aldrig ett pass på en eller två frågor */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, T_FIXED } = require('./le/childflow.js');
const { toStart, v2tools } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const isoIn = (days) => new Date(T_FIXED + days * DAY).toISOString().slice(0, 10);
const SHAPES = [
  ['en färdighet (åk 8)', { kid: 'k8', type: 'exam', skills: ['multin'] }],
  ['tre färdigheter (åk 8)', { kid: 'k8', type: 'exam', skills: ['multin', 'forenkla', 'blandat'] }],
  ['en kunskapspunkt (läxa)', { kid: 'k8', type: 'homework', kps: ['k:kemi8-syror-baser/ph-skalan'] }],
  ['två kunskapspunkter (läxa)', { kid: 'k8', type: 'homework', kps: ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer'] }],
  ['hel paketfärdighet', { kid: 'k8', type: 'exam', skills: ['kemi_syror'] }],
  ['glosor (åk 4)', { kid: 'k4', type: 'vocab', decks: ['en_djur'] }],
  ['glosor + färdighet (åk 4)', { kid: 'k4', type: 'exam', decks: ['en_djur'], skills: ['mult'] }],
  ['en färdighet (åk 4)', { kid: 'k4', type: 'exam', skills: ['mult'] }],
  ['en färdighet (åk 2)', { kid: 'k2', type: 'exam', skills: ['plus20'] }],
];
const DAYS = [14, 7, 3, 1, 0];

(async () => {
  try {
    let offered = 0, honest = 0, minPlayed = Infinity;
    for (const [name, sh] of SHAPES) for (const d of DAYS) for (const after of [false, true]) {
      const w = mkWin({ seed: 7 + d, fixedClock: true }); await sleep(30); const T = tools(w); const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); for (const k of ['k2', 'k4', 'k8']) PA.DB.profiles[k].exams = [];
      PA.FAMILY.applyContent({ v: 1, updatedAt: 1, packs: [], work: [{ id: 'g', title: 'Målet', date: isoIn(d), ...sh }] }); PA.rerender(); const D = v2tools(w, T);
      const kid = PA.KIDS.find(k => k.id === sh.kid); const open = () => { toStart(T); T.click(T.$(`[data-kid="${sh.kid}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
      const tag = `${name}, ${d} dygn${after ? ', efter dagens pass' : ''}`;
      open(); if (after) { const go = T.$('.go-btn[data-v2="kor"]'); if (go) { T.click(go); D.run(() => false); } open(); }
      const row = [...T.$('#app').querySelectorAll('.upcoming .up-row')].find(li => li.dataset.row === 'w:g'); const btn = T.$('.upcoming [data-v2="mission"][data-exam="w:g"]');
      if (!btn) { honest++; ok(!row || !/Kör ·/.test(row.textContent), `${tag}: ingen Kör → ingen knapp som lovar ett pass`); continue; }
      offered++; const e = PA.LE.exams(kid, PA.DB.profiles[sh.kid]).find(x => x.id === 'w:g'); const cids = new Set(PA.V2.examCidsActive(kid, e));
      const plan = PA.V2.plan(kid, 'mission', PA.LE.state(kid), PA.LE.now(), 'chk', { examId: 'w:g' }); const nb = plan.filter(s => s.role !== 'boss').length;
      const deckOnly = [...cids].every(c => c.startsWith('d:')); const dueWords = (sh.decks || []).reduce((a, id) => { const dk = PA.V2.deckOf(PA.DB.profiles[sh.kid], 'd:' + id); return a + (dk ? PA.V2.deckDue(PA.DB.profiles[sh.kid], dk).length : 0); }, 0);
      ok(nb >= (deckOnly ? Math.min(PA.V2.MISSION_MIN, Math.max(1, dueWords)) : PA.V2.MISSION_MIN), `${tag}: planen har minst ${PA.V2.MISSION_MIN} uppgifter (${nb})`);
      const mins = (btn.textContent.match(/(\d+) min/) || [])[1]; ok(mins && +mins === PA.EXP.mins(plan, kid), `${tag}: "Kör · ${mins} min" = passet (${PA.EXP.mins(plan, kid)})`);
      T.click(btn); let n = 0, foreign = 0, g = 0; while (PA.S && PA.S.v2 && T.$('#qcard') && g++ < 80) { const it = PA.S.queue[PA.S.i]; if (it.cat !== 'learn' && !(it.cat === 'word' && it.kind === 'intro')) { n++; if (it.spec && !cids.has(it.spec.cid)) foreign++; } D.answer(() => false); w.__advance(4000); }
      minPlayed = Math.min(minPlayed, n);
      ok(n >= 3 && n >= Math.min(nb, PA.V2.MISSION_MIN), `${tag}: passet som spelas har ${n} uppgifter – aldrig en eller två`);
      ok(foreign === 0, `${tag}: bara målets innehåll (${foreign} utanför)`);
    }
    console.log(`  Kör erbjöds ${offered} gånger, ärlig text ${honest} gånger; kortaste spelade pass: ${minPlayed} uppgifter`);
    ok(offered >= SHAPES.length * 4, `Kör erbjuds i de flesta lägen (${offered})`);
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`);
  console.log(fails ? 'GOAL MISSION MIN TEST FAILED' : 'GOAL MISSION MIN TEST OK');
  process.exit(fails ? 1 : 0);
})();
