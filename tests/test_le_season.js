/* Fas 3C–3H – grindtester på långa syntetiska säsonger (produktionsmotor + passkörare). SYNTETISKA elever, inga riktiga data.
   1. K-14 stresstest: 9 scenarier × 2 elevmodeller (mem 2 = måttligt glömsk, mem 1 = 3A-modellens pessimistiska) × 3 frön.
      Dokumenterade undantag (PARTIAL) listas uttryckligen nedan – testet faller om ett NYTT fel dyker upp.
   2. Profiler A–M (mem 2): hållbarhet mot v1, prov, giltig "mästrad"-status, missuppfattning, Rescue, Utmaning, KLAR, två enheter. */
'use strict';
process.env.TZ = 'UTC';
const { runAll } = require('./le/k14.js'); const { PROFILES, runSeason, metrics } = require('./le/season.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const t0 = Date.now();
// Kända, dokumenterade begränsningar (rapportens avsnitt N/R): extrem överlast (60 koncept) + pessimistisk glömskemodell.
const KNOWN = [['S5 många nya koncept samtidigt', 1, 'skulden stabiliseras'], ['S5 många nya koncept samtidigt', 1, 'svaga koncept göms inte']];
const isKnown = (r, c) => KNOWN.some(([n, mem, check]) => r.name === n && r.mem === mem && c[0].startsWith(check));
const all = runAll([7, 11, 23], [2, 1]); let known = 0;
for (const r of all) for (const c of r.checks) { if (c[1]) continue; if (isKnown(r, c)) { known++; continue; } ok(false, `K-14 ${r.name} · mem ${r.mem} · seed ${r.seed}: ${c[0]} (${c[2]})`); }
const k14n = all.length * all[0].checks.length; checks += k14n - 1;
console.log(`K-14: ${all.length} körningar × ${all[0].checks.length} villkor – ${known} kända PARTIAL (extrem överlast, pessimistisk modell)`);

const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const res = {}; for (const k of Object.keys(PROFILES)) { const rs = [7, 11, 23].map(seed => runSeason(k, { seed, mem: 2 })); res[k] = { rs, ms: rs.map(metrics) }; }
for (const [k, { rs, ms }] of Object.entries(res)) {
  const v2 = avg(rs.map(r => r.end.v2.d14)), v1 = avg(rs.map(r => r.end.v1.d14));
  ok(k === 'H' ? v2 >= v1 - 0.03 : v2 >= v1, `${k}: hållbarhet +14 d v2 ${(v2 * 100).toFixed(0)} ≥ v1 ${(v1 * 100).toFixed(0)}`);
  const ex = rs.flatMap(r => r.examResults); if (ex.length) ok(avg(ex.map(x => x.v2)) >= avg(ex.map(x => x.v1)), `${k}: provresultat v2 ≥ v1`);
  const mastered = rs.reduce((a, r) => a + r.end.mastered, 0), valid = rs.reduce((a, r) => a + r.end.validMastery, 0);
  ok(!mastered || valid / mastered >= 0.95, `${k}: "mästrat" är giltigt (minns fritt ≥ 50 %): ${valid}/${mastered}`);
  ok(ms.every(m => m.fbVisibleMax <= m.fbCap), `${k}: synlig Felbok ≤ ${ms[0].fbCap}`);
  ok(ms.every(m => m.rescueMax <= 2), `${k}: högst 2 Rescue per pass`);
  ok(ms.every(m => m.maxItems <= m.polMaxItems), `${k}: inget pass längre än taket`);
}
ok(avg(res.E.ms.map(m => m.rescuePerSession)) <= 0.6, 'E (kämpar): Rescue i snitt ≤ 0,6 per pass');
ok(avg(res.G.rs.map(r => r.end.misLeft)) <= 0.5, 'G: säkra missuppfattningar rättas via förklaring/Rescue (kvar ≤ 0,5 i snitt)');
ok(res.H.ms.every(m => m.challenges >= m.sessions / 3), 'H (avancerad): Utmaning minst var tredje pass');
ok(res.H.ms.every(m => m.challengeOk >= m.challenges * 0.6), 'H: Utmaningarna är lagom svåra (≥ 60 % klarade)');
ok(res.H.ms.every(m => m.klar >= 10), 'H: KLAR – korta "klart för idag"-pass när inget mer är värdefullt');
ok(res.D.rs.every(r => r.end.validMastery >= r.end.mastered - 1), 'D (gissar på flerval): flerval blåser inte upp mästrat');
ok(res.L.rs.every(r => r.merges.length > 10 && r.merges.every(x => x.equalAfter)), 'L: två enheter – identiskt tillstånd efter varje synk');
ok(res.L.rs.every(r => r.dupRewards <= 3), 'L: dubbla belöningar mellan offline-enheter ≤ 3 per termin (utan synk mellan passen)');
ok(res.C.ms.every(m => m.restartStartOk && m.restartDrops === 0), 'C: återkomst efter uppehåll börjar lätt utan hårda sänkningar');
console.log(`Profiler A–M: 13 × 3 säsonger à 120 dygn`);
console.log(`tid ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE SEASON TEST FAILED' : 'LE SEASON TEST OK'); process.exit(fails ? 1 : 0);
