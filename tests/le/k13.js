// K-13 omsimulering (Fas 3B): sitter kalibreringen i golvet för att elevmodellen glömmer för fort, eller för att intervallen är för långa?
// Syntetiska elever, produktionsmotorn. Skriver en tabell per variant. Ingen riktig barndata.
process.env.TZ = 'UTC';
const { summarize, table } = require('./runN.js');
const SHORT = [0, 1, 2, 5, 10, 21, 45];
const variants = [
  ['A. Baslinje (godkänd 3A-modell, nuvarande stege)', {}],
  ['B. Elevmodell glömmer hälften så fort (memMult 2)', { memMult: 2 }],
  ['C. Elevmodell glömmer en tredjedel så fort (memMult 3)', { memMult: 3 }],
  ['D. Kortare stege för yngre (0/1/2/5/10/21/45)', { polPatch: { younger: { stages: SHORT } } }],
  ['E. Kortare stege för alla', { polPatch: { younger: { stages: SHORT }, middle: { stages: SHORT }, older: { stages: SHORT } } }],
  ['F. memMult 2 + kortare stege för yngre', { memMult: 2, polPatch: { younger: { stages: SHORT } } }],
];
const all = {};
for (const [name, opts] of variants) { const r = summarize(opts); all[name] = r; console.log('\n### ' + name + '\n' + table(r)); }
const agg = (r) => { const v = Object.values(r); const m = (f) => v.reduce((a, x) => a + f(x), 0) / v.length; return { floor: v.filter(x => x.iv <= 0.52).length, inBand: v.filter(x => x.acc >= 0.70 && x.acc <= 0.85).length, acc: m(x => x.acc), iv: m(x => x.iv), due: m(x => x.dueMax), d30: m(x => x.v2.d30 - x.v1.d30), d14: m(x => x.v2.d14 - x.v1.d14), worse14: v.filter(x => x.v2.d14 < x.v1.d14 - 0.005).map((x, i) => Object.keys(r)[Object.values(r).indexOf(x)]).join('') }; };
console.log('\n### Sammanfattning (8 profiler × 5 frön)\nvariant | kalibrering i golvet | träffsäkerhet i 70–85 % | snitt träffsäkerhet | snitt iv | snitt max förfallna | Δ+14d v2−v1 | v2 sämre +14d');
for (const [name, r] of Object.entries(all)) { const a = agg(r); console.log(`${name.split('.')[0]} | ${a.floor}/8 | ${a.inBand}/8 | ${(a.acc * 100).toFixed(0)} % | ${a.iv.toFixed(2)} | ${a.due.toFixed(1)} | ${(a.d14 * 100).toFixed(1)} p | ${a.worse14 || '–'}`); }
module.exports = { all };
