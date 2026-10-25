/* Granskning M2: påminnelsens djuplänk (#<barn>-kor) för ett v2-barn får aldrig ge en tom sida – inte ens med trasig v2-data. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const prep = mkWin({ seed: 3, fixedClock: true }); const TP = tools(prep);
setTimeout(() => {
  TP.PA().FAMILY.apply(FIX); TP.PA().load(); const p = TP.PA().DB.profiles.k4; p.settings.engine = 'v2'; p.settings.engineAt = 1; p.pet = 'uggla';
  const good = JSON.parse(JSON.stringify(TP.PA().DB)); const bad = JSON.parse(JSON.stringify(good)); bad.profiles.k4.le = { v: 2, base: null, log: 'trasig' };
  const fam = {}; for (let i = 0; i < prep.localStorage.length; i++) { const k = prep.localStorage.key(i); fam[k] = prep.localStorage.getItem(k); }
  const run = (db, label, cb) => { const w = mkWin({ seed: 5, fixedClock: true, url: 'https://example.org/#k4-kor', storage: { ...fam, 'pluggappen.v1': JSON.stringify(db) } }); const T = tools(w);
    setTimeout(() => { try { cb(w, T); } catch (e) { fails++; console.log('EXC', label, e.stack); } }, 80); };
  run(good, 'good', (w, T) => {
    ok(T.PA().S && T.PA().S.v2 && T.$('#qcard'), 'djuplänk för v2-barn startar ett v2-pass');
    run(bad, 'bad', (w2, T2) => {
      ok(T2.$('#qcard') || T2.$('[data-subj]'), 'djuplänk med trasig v2-data: ett v1-pass eller startsidan visas (aldrig tom sida)');
      ok(!(T2.PA().S && T2.PA().S.v2), 'trasig v2-data: v2-passet startas inte');
      console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE DEEPLINK TEST FAILED' : 'LE DEEPLINK TEST OK'); process.exit(fails ? 1 : 0);
    });
  });
}, 50);
