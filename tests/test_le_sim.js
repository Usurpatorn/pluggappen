/* Fas 3B – simuleringsregression (syntetiska elever, produktionsmotorn). Godkänd Fas 3A-baslinje ± 1 procentenhet.
   Ändras motorns beteende så att utfallet flyttar sig utanför banden faller testet → ny baslinje måste granskas och godkännas. */
'use strict';
process.env.TZ = 'UTC';
const { summarize, table } = require('./le/runN.js');
// [träffsäkerhet, d45 v2, d14 v2, d30 v2, prov v2, iv] – godkända 3A-värden (final_results, 5 frön)
const BASE = { A: [64, 57, 9, 3, null, 0.50], B: [64, 52, 6, 2, null, 0.50], C: [61, 61, 9, 3, null, 0.50], D: [64, 49, 6, 2, null, 0.50], E: [61, 32, 2, 1, null, 0.50], F: [68, 78, 22, 9, 76, 0.51], G: [83, 86, 43, 25, null, 0.83], H: [65, 65, 11, 4, null, 0.50] };
const res = summarize(); console.log(table(res));
let fails = 0; const near = (a, b, tol) => Math.abs(a - b) <= tol;
for (const [k, b] of Object.entries(BASE)) { const r = res[k]; const got = [r.acc * 100, r.v2.d45 * 100, r.v2.d14 * 100, r.v2.d30 * 100, r.v2.exam == null ? null : r.v2.exam * 100, r.iv];
  b.forEach((v, i) => { if (v == null) return; if (!near(got[i], v, i === 5 ? 0.02 : 1)) { fails++; console.log(`FAIL ${k}[${i}] ${got[i].toFixed(2)} ≠ ${v}`); } }); }
// skyddsräcken från 3A: provprofilen bättre än v1 på provet, Rescue begränsad, Felboken begränsad i synligt läge (tak O-8 tillämpas i visningen)
if (!(res.F.v2.exam - res.F.v1.exam >= 0.15)) { fails++; console.log('FAIL exam advantage'); }
if (!Object.values(res).every(r => r.rescue <= 0.5)) { fails++; console.log('FAIL rescue rate'); }
console.log(fails ? 'LE SIM TEST FAILED' : 'LE SIM TEST OK – inom ±1 p av godkänd baslinje'); process.exit(fails ? 1 : 0);
