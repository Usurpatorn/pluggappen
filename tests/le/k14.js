// K-14 stresstest: repetitionsskulden över långa syntetiska perioder (båda elevmodellerna). Används av test_le_season.js.
process.env.TZ = 'UTC';
const { PROFILES, runSeason, metrics, E } = require('./season.js');
const SCEN = [
  ['S1 normal daglig användning', 'A', {}],
  ['S2 oregelbunden användning', 'A', { override: { active: (d, r) => r() < 0.5 } }],
  ['S3 långt uppehåll', 'C', {}],
  ['S4 flera prov tätt', 'K', {}],
  ['S5 många nya koncept samtidigt', 'A', { extraConcepts: 32 }],
  ['S6 ihållande misslyckanden', 'E', { override: { k0: 0.05, rate: 0.04 } }],
  ['S7 avancerad elev', 'H', {}],
  ['S8 flera ämnen', 'J', {}],
  ['S9 begränsad kapacitet (yngre, 5 uppgifter, 4 ämnen)', 'A', { override: { pol: 'younger', n: 5, extra: 0 } }],
];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
function check(m, res) {
  const pol = E.POLICIES[res.pol];
  // Skulden mäts relativt det barnet har lärt sig (en större kunskapsbas har fler saker att repetera): kvoten får inte stiga mer än 0,1.
  const growthOk = m.ratioEnd <= m.ratioMid + 0.1;
  return [
    ['skulden stabiliseras', growthOk, `${m.backlogMid.toFixed(1)} → ${m.backlogEnd.toFixed(1)} (kvot ${m.ratioMid.toFixed(2)} → ${m.ratioEnd.toFixed(2)})`],
    // Längsta väntan för ett svagt förfallet koncept: högst tre veckors dagliga pass (21), och väntan växer inte över terminen.
    ['svaga koncept göms inte (≤ 21 pass väntan, växer inte)', m.weakWaitSessionsMax <= 21 && m.weakWaitEnd <= Math.max(12, m.weakWaitMid), `max ${m.weakWaitSessionsMax} pass (mitt ${m.weakWaitMid}, slut ${m.weakWaitEnd})`],
    // Svält-skyddet ger nytt efter högst 12 pass även vid extrem överlast (CFG.backlog) – gränsen för testet är skyddets maxvärde + 2.
    ['nytt svälts inte (≤ 14 pass utan nytt när nytt är möjligt)', m.newGapMax <= 14, `${m.newGapMax} pass`],
    ['prov får plats men tar inte allt (30–90 % när provet inte är klart)', m.examShare == null || (m.examShare >= 0.3 && m.examShare <= 0.9), m.examShare == null ? 'inget prov/redan klart' : `${Math.round(m.examShare * 100)} %`],
    ['inget ämne dominerar utöver sitt behov (≤ max(80 %, behovsandel + 15 %) utanför provveckor)', m.subjectExcess <= 0, `max andel ${Math.round(m.subjectMaxShare * 100)} %, överskott ${Math.round(m.subjectExcess * 100)} p`],
    ['inget ämne med behov svälts ut (≤ 7 pass i rad)', m.subjectStarve <= 7, `${m.subjectStarve} pass`],
    ['återkomst börjar lätt, ingen hård sänkning', m.restartStartOk && m.restartDrops === 0, `${m.restarts} återkomster, ${m.restartDrops} sänkningar >1`],
    ['ingen skuld att betala av (passlängd ≤ tak)', m.maxItems <= m.polMaxItems, `max ${m.maxItems} / ${m.polMaxItems}`],
    // Barnet ser högst taket (3/5/5) + "Fler väntar"; bakom det får det inte bli en ändlös kö (≤ 3 × taket öppna poster).
    ['Felboken hanterbar (synligt ≤ tak, öppna ≤ 3 × tak)', m.fbVisibleMax <= m.fbCap && m.fbOpenMax <= 3 * m.fbCap, `synligt ≤ ${m.fbVisibleMax}/${m.fbCap}, öppna max ${m.fbOpenMax} (${m.fbOpenMid.toFixed(1)} → ${m.fbOpenEnd.toFixed(1)})`],
    ['Rescue begränsad (≤ 2/pass, ≤ 0,6 i snitt)', m.rescueMax <= 2 && m.rescuePerSession <= 0.6, `max ${m.rescueMax}, snitt ${m.rescuePerSession.toFixed(2)}`],
  ];
}
function runAll(seeds = [7, 11, 23], mems = [2, 1]) {
  const out = [];
  for (const [name, key, opts] of SCEN) for (const mem of mems) for (const seed of seeds) {
    const res = runSeason(key, { ...opts, seed, mem }); const m = metrics(res); out.push({ name, key, mem, seed, checks: check(m, res), m, res });
  }
  return out;
}
module.exports = { SCEN, runAll, check };
if (require.main === module) {
  const all = runAll(); const byScen = {};
  for (const r of all) { const k = r.name + ' · mem ' + r.mem; (byScen[k] = byScen[k] || []).push(r); }
  for (const [k, rs] of Object.entries(byScen)) { const fails = rs.flatMap(r => r.checks.filter(c => !c[1]).map(c => `seed ${r.seed}: ${c[0]} (${c[2]})`)); console.log((fails.length ? 'FAIL ' : 'OK   ') + k + (fails.length ? '\n      ' + fails.join('\n      ') : '')); }
}
