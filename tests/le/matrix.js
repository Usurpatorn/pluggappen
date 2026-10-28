/* 3.4 Motorns valideringsmatris (körs för hand, inte i npm test – tar några minuter):
     node tests/le/matrix.js <gammalt bygge.html> <nytt bygge.html> [frön] > rapport.md
   Samma fixturer, frön och elevantaganden i båda byggena. SYNTETISK familj och syntetiska datum.
   Mått per scenario och mål: introducerade före datum, hämtade igen ett senare dygn (fördröjd hämtning), fel, Rescue/stöd, svält
   (≥ 5 dygn MED plugg utan målet de sista två veckorna), högst nya koncept per dygn, stadiesteg samma dygn, XP, faktisk fördelning.
   Medelstadium används inte som bevis. Inget här är en prognos för provresultat. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const path = require('path');
const { simulate, GOALS } = require('./multigoal_sim.js');
const [oldF, newF] = process.argv.slice(2, 4); const seeds = (process.argv[4] || '5,13,31,77').split(',').map(Number);
const att = (f) => (d) => f(d);
const S = [
  { id: 'tre-mal', t: 'Tre mål (mindre förhör d17, större prov d22, d30), ett pass per dygn', o: { goals: ['quiz', 'alg', 'kemi'] } },
  { id: 'kontroll', t: 'Kontroll: bara de två proven', o: { goals: ['alg', 'kemi'] } },
  { id: 'svag', t: 'Svagare start (55 % rätt)', o: { goals: ['quiz', 'alg', 'kemi'], pCorrect: 0.55 } },
  { id: 'stark', t: 'Starkare start (92 % rätt)', o: { goals: ['quiz', 'alg', 'kemi'], pCorrect: 0.92 } },
  { id: 'oregelbunden', t: 'Oregelbundet: ungefär varannan dag, ibland två block', o: { goals: ['quiz', 'alg', 'kemi'], attend: att((d) => [1, 0, 2, 0, 1, 1, 0][d % 7]) } },
  { id: 'uppehall', t: 'Sex missade dygn i rad (dag 8–13)', o: { goals: ['quiz', 'alg', 'kemi'], attend: att((d) => (d >= 8 && d <= 13 ? 0 : 1)) } },
  { id: 'langa', t: 'Långa frivilliga pass: KÖR + 3 FLOW + 2 Öva mer varje dygn', o: { goals: ['quiz', 'alg', 'kemi'], attend: att(() => 6) } },
  { id: 'sen-laxa', t: 'Läxan läggs in sent (dag 10)', o: { goals: [{ ...GOALS.quiz, addAt: 10 }, 'alg', 'kemi'] } },
  { id: 'flyttat', t: 'Algebraprovet flyttas fem dygn framåt dag 12', o: { goals: ['quiz', 'alg', 'kemi'], events: { 12: (api) => api.setGoals(api.goals.map(g => (g.id === 'mg-alg' ? { ...g, date: '2026-11-30' } : g))) } } },
  { id: 'tva-nara', t: 'Två större prov två dygn isär', o: { goals: ['alg', { ...GOALS.kemi, date: '2026-11-27' }] } },
  { id: 'kant-forhor', t: 'Det mindre förhöret är redan väl känt (10 dygn förträning)', o: { goals: ['quiz', 'alg', 'kemi'], preSeed: { goal: 'quiz', days: 10 } } },
  { id: 'inga-mal', t: 'Inga mål', o: { goals: [] } },
];
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
(async () => {
  const out = []; out.push(`# Valideringsmatris 3.3 → 3.4 (frön ${seeds.join(', ')} × rätt-andel ${'0,7/0,85 där inget annat anges'})`, '');
  for (const sc of S.filter(x => !process.env.MATRIX_ONLY || process.env.MATRIX_ONLY.split(',').includes(x.id))) {   // MATRIX_ONLY=id1,id2: bara vissa scenarier
    const pcs = sc.o.pCorrect ? [sc.o.pCorrect] : [0.7, 0.85]; const row = {};
    for (const [lbl, f] of [['3.3', oldF], ['3.4', newF]]) {
      const a = { n: 0, goals: {}, same: 0, maxNew: 0, xp: 0, items: 0, flow: 0, practice: 0, starve: 0, sameList: [] };
      for (const seed of seeds) for (const pc of pcs) {
        const R = await simulate({ ...sc.o, seed, pCorrect: pc, file: f }); a.n++; a.same += R.sameDayStage; a.maxNew = Math.max(a.maxNew, R.maxNewPerDay); a.xp += R.rewards.xp; a.items += R.items; a.flow += R.flowBlocks; a.practice += R.practiceBlocks;
        if (R.sameDayList) a.sameList.push(...R.sameDayList.slice(0, 2));
        for (const [id, g] of Object.entries(R.goals)) { const x = a.goals[id] = a.goals[id] || { c: g.concepts, intro: 0, intro3: 0, del: 0, plays: 0, err: 0, sup: 0, starve: 0 }; x.intro += g.introducedBefore; x.intro3 += g.introducedBy3DaysBefore; x.del += g.delayedRetrieval; x.plays += g.plays; x.err += g.errors; x.sup += g.support; if (g.maxGapLast2Weeks >= 5) x.starve++; }
      }
      row[lbl] = a;
    }
    out.push(`## ${sc.t}`, '', '| Mål | Bygge | Introducerat före datum | ≥ 3 dygn före | Hämtat igen senare dygn | Övningar | Fel | Stöd | Svält (körningar) |', '|---|---|---|---|---|---|---|---|---|');
    const ids = [...new Set([...Object.keys(row['3.3'].goals), ...Object.keys(row['3.4'].goals)])];
    for (const id of ids) for (const lbl of ['3.3', '3.4']) { const a = row[lbl]; const x = a.goals[id]; if (!x) continue; out.push(`| ${id.replace('mg-', '')} (${x.c}) | ${lbl} | ${f1(x.intro / a.n)} | ${f1(x.intro3 / a.n)} | ${f1(x.del / a.n)} | ${f1(x.plays / a.n)} | ${f1(x.err / a.n)} | ${f1(x.sup / a.n)} | ${x.starve}/${a.n} |`); }
    for (const lbl of ['3.3', '3.4']) { const a = row[lbl]; out.push(`| alla | ${lbl} | högst ${a.maxNew} nya/dygn | samma-dygnssteg ${a.same} | XP ${f1(a.xp / a.n)} | uppgifter ${f1(a.items / a.n)} | FLOW ${f1(a.flow / a.n)} | Öva mer ${f1(a.practice / a.n)} | |`); }
    if (row['3.4'].sameList.length || row['3.3'].sameList.length) out.push('', `Samma-dygnssteg (exempel): 3.3 ${JSON.stringify(row['3.3'].sameList.slice(0, 3))} · 3.4 ${JSON.stringify(row['3.4'].sameList.slice(0, 3))}`);
    out.push('');
    process.stderr.write(`klart: ${sc.id}\n`);
  }
  console.log(out.join('\n')); process.exit(0);
})();
