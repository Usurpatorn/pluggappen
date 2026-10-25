/* Simuleringsregression (syntetiska 3A-profiler, produktionsmotorn + produktionens passkörare) ± 1 procentenhet.
   Baslinjen är omsatt för regelversionen i LE2.RULES (3C–3H): reglerna ändrades avsiktligt (K-14, Rescue, LÄR-förbrukning, Utmaning …).
   Godkända 3A-värden finns kvar i kommentaren för jämförelse. Flyttar sig utfallet utanför banden faller testet → ny baslinje granskas. */
'use strict';
process.env.TZ = 'UTC';
const { summarize, table } = require('./le/runN.js');
// [träffsäkerhet, d45 v2, d14 v2, d30 v2, prov v2, iv] – regelversion LE2.RULES (5 frön)
// (godkänd 3A: A 64,57,9,3 · B 64,52,6,2 · C 61,61,9,3 · D 64,49,6,2 · E 61,32,2,1 · F 68,78,22,9,prov 76 · G 83,86,43,25 · H 65,65,11,4)
// 3H.2 (efter oberoende granskning): Utmaningar skrivs inte längre i c.ev (L10) → B 69,48,10 → 68,45,8 och G d45 85 → 86, iv 1.09 → 0.97.
const BASE = {A:[63,61,12,5,null,0.5],B:[68,45,8,3,null,0.5],C:[62,61,12,3,null,0.5],D:[68,49,10,3,null,0.5],E:[60,38,2,0,null,0.5],F:[68,78,22,8,79,0.5],G:[84,86,45,27,null,0.97],H:[66,67,15,6,null,0.5]};
const res = summarize(); console.log(table(res));
let fails = 0; const near = (a, b, tol) => Math.abs(a - b) <= tol;
for (const [k, b] of Object.entries(BASE)) { const r = res[k]; const got = [r.acc * 100, r.v2.d45 * 100, r.v2.d14 * 100, r.v2.d30 * 100, r.v2.exam == null ? null : r.v2.exam * 100, r.iv];
  b.forEach((v, i) => { if (v == null) return; if (!near(got[i], v, i === 5 ? 0.02 : 1)) { fails++; console.log(`FAIL ${k}[${i}] ${got[i].toFixed(2)} ≠ ${v}`); } }); }
// skyddsräcken från 3A: provprofilen bättre än v1 på provet, Rescue begränsad, Felboken begränsad i synligt läge (tak O-8 tillämpas i visningen)
if (!(res.F.v2.exam - res.F.v1.exam >= 0.15)) { fails++; console.log('FAIL exam advantage'); }
if (!Object.values(res).every(r => r.rescue <= 0.5)) { fails++; console.log('FAIL rescue rate'); }
console.log(fails ? 'LE SIM TEST FAILED' : 'LE SIM TEST OK – inom ±1 p av godkänd baslinje'); process.exit(fails ? 1 : 0);
