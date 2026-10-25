/* ========= 2.1: rikare generatorer för små mattebanker åk 2 (bara Learning Engine v2) =========
   v1 är frusen reserv och använder skill.gen som förut (tests/test_v1_regression.js). v2 använder skill.gen2 när den finns.
   former: 3–4 olika frågor på nivå 1 i 2.0 → former, sidor, hörn, kroppar (klot, kub, cylinder, kon, rätblock) och symmetri.
   brak2: 4 olika frågor på nivå 1 i 2.0 → halvor, tredjedelar och fjärdedelar i bild och ord, "hur många delar är en hel". */
const GEN2 = (() => {
  const SH = [['triangel', 3], ['kvadrat', 4], ['rektangel', 4], ['femhörning', 5], ['sexhörning', 6]];
  const PL = { triangel: 'trianglar', kvadrat: 'kvadrater', rektangel: 'rektanglar', femhörning: 'femhörningar', sexhörning: 'sexhörningar' };
  const mc = (text, correct, wrong, why, hint, level, fig) => { const choices = R.shuffle([correct, ...wrong]); return { type: 'choicetext', fig, text, choices, answer: choices.indexOf(correct), level, steps: [why], hint }; };
  const num = (text, answer, why, hint, level, fig, choices) => ({ type: 'num', fig, text, answer, level, steps: [why], hint, choices });
  const FORMER = {
    1: [
      () => genFormer(1),
      () => { const [n, s] = R.pick(SH.slice(0, 3)); return num(`Hur många sidor har en ${n}?`, s, `En ${n} har ${s} sidor och ${s} hörn.`, 'Följ kanten runt figuren och räkna sidorna.', 1, VIS.shape(n), T.choices(s, 4, 1).filter(x => x > 0)); },
      () => { const [n, s] = R.pick(SH.slice(3)); return num(`Hur många hörn har figuren?`, s, `Det är en ${n}: ${s} hörn.`, 'Räkna spetsarna – peka på varje hörn.', 1, VIS.shape(n), T.choices(s, 4, 1).filter(x => x > 0)); },
      () => mc('Vilken form är rund och har inga hörn?', 'cirkel', ['kvadrat', 'triangel', 'rektangel'], 'En cirkel är helt rund – inga hörn och inga raka sidor.', 'Tänk på en tallrik.', 1),
      () => { const [n] = R.pick(SH.slice(0, 3)); return mc('Vad heter formen?', n, SH.slice(0, 3).map(x => x[0]).filter(x => x !== n).concat(['cirkel']), `Det är en ${n}.`, 'Räkna sidorna och titta om de är lika långa.', 1, VIS.shape(n)); },
    ],
    2: [
      () => genFormer(2),
      () => { const k = R.pick([['ser ut som en boll', 'klot'], ['ser ut som en burk', 'cylinder'], ['ser ut som en glasstrut', 'kon'], ['ser ut som en tärning', 'kub'], ['ser ut som en skokartong', 'rätblock']]); return mc(`Vilken kropp ${k[0]}?`, k[1], ['klot', 'cylinder', 'kon', 'kub', 'rätblock'].filter(x => x !== k[1]).slice(0, 3), `En ${k[1]} ${k[0]}.`, 'Tänk på saker hemma som har den formen.', 2); },
      () => { const sym = R.pick(['A', 'H', 'M', 'O', 'T', 'U', 'V', 'X']); const not = R.shuffle(['F', 'G', 'J', 'L', 'N', 'P', 'R', 'S', 'Z']).slice(0, 3); return mc('Vilken bokstav kan man vika på mitten så att båda halvorna blir lika (symmetrisk)?', sym, not, `${sym} är symmetrisk – vik den på mitten så täcker halvorna varandra.`, 'Tänk dig en spegel mitt i bokstaven.', 2); },
      () => { const [n, s] = R.pick(SH.slice(0, 3)); return mc(`Vilken form har ${s === 3 ? 'tre' : 'fyra'} hörn${n === 'kvadrat' ? ' och fyra lika långa sidor' : n === 'rektangel' ? ', två långa och två korta sidor' : ''}?`, n, ['triangel', 'kvadrat', 'rektangel', 'cirkel'].filter(x => x !== n).slice(0, 3), `Det är en ${n}.`, 'Rita formen i luften.', 2); },
    ],
    3: [
      () => genFormer(3),
      () => { const t = R.int(1, 3), q = R.int(1, 2); return num(`Du ritar ${t} ${t === 1 ? 'triangel' : 'trianglar'} och ${q} ${q === 1 ? 'kvadrat' : 'kvadrater'}. Hur många hörn blir det sammanlagt?`, 3 * t + 4 * q, `${m(`${t} · 3 + ${q} · 4 = ${3 * t + 4 * q}`)} hörn.`, 'Räkna hörnen på trianglarna först, sedan på kvadraterna.', 3); },
      () => { const s = R.int(2, 5); return num(`En kvadrat har sidan ${s} cm. Hur lång är vägen runt hela kvadraten?`, 4 * s, `Fyra lika långa sidor: ${m(`${s} + ${s} + ${s} + ${s} = ${4 * s}`)} cm.`, 'En kvadrat har fyra lika långa sidor.', 3, VIS.shape('kvadrat')); },
      () => { const [n, s] = R.pick(SH); const k = R.pick([2, 3]); return num(`Hur många sidor har ${k} ${PL[n]} tillsammans?`, k * s, `En ${n} har ${s} sidor: ${m(`${k} · ${s} = ${k * s}`)}.`, `Hur många sidor har en ${n}?`, 3); },
    ],
  };
  const WORD = { 2: 'en halv', 3: 'en tredjedel', 4: 'en fjärdedel' };
  const BRAK = {
    1: [
      () => genBrak2(1),
      () => { const d = R.pick([2, 3, 4]); const k = R.int(1, d - 1); const c = `${k}/${d}`; const wrong = [...new Set([`${d - k}/${d}`, `${k}/${d + 1}`, `${d}/${k}`, `1/${d === 2 ? 3 : 2}`])].filter(x => x !== c).slice(0, 3); return mc('Hur stor del av cirkeln är färgad?', c, wrong, `${d} lika delar, ${k} färgade: <b>${c}</b>.`, `Räkna alla delar (${d}). Hur många är färgade?`, 1, VIS.pie(k, d)); },
      () => { const d = R.pick([2, 3, 4]); return mc(`Vad heter ${m(`1/${d}`)} med ord?`, WORD[d], Object.values(WORD).filter(x => x !== WORD[d]).concat(['en hel']), `${m(`1/${d}`)} = ${WORD[d]}: det hela delat i ${d} lika delar.`, 'Talet under strecket säger hur många delar det hela är delat i.', 1); },
      () => { const d = R.pick([2, 3, 4]); return num(`Hur många ${d === 2 ? 'halvor' : d === 3 ? 'tredjedelar' : 'fjärdedelar'} behövs för att få en hel?`, d, `${d} ${d === 2 ? 'halvor' : d === 3 ? 'tredjedelar' : 'fjärdedelar'} = en hel.`, 'Hur många lika stora bitar delades det hela i?', 1, VIS.pie(1, d), T.choices(d, 4, 1).filter(x => x > 0)); },
    ],
  };
  const pick = (table, orig) => (lvl, opts) => { const list = table[lvl]; return list ? R.pick(list)() : orig(lvl, opts); };
  return { former: pick(FORMER, (l, o) => genFormer(l, o)), brak2: pick(BRAK, (l, o) => genBrak2(l, o)), FORMER, BRAK };
})();
// Kopplas på momenten (v1 rör aldrig gen2). Nivå 4 för former kommer från åk 2-mallens nivå 4 (oförändrad).
for (const list of [typeof MORE_SKILLS !== 'undefined' ? MORE_SKILLS.ak2 || [] : []]) for (const s of list) if (GEN2[s.id]) { const base = s.gen; s.gen2 = (lvl, o) => (lvl >= 4 ? base(lvl, o) : GEN2[s.id](lvl, o)); }
if (typeof module !== 'undefined') module.exports = { GEN2 };
