/* Nödrollback: profiler som körts med v2 (utökade bevis, belöningsmarkörer, v2-passposter, Testa mig-resultat, motorflaggan)
   ska fungera i den publicerade 1.2.0 (tests/golden/pluggappen-1.2.0.html.gz, byggd från commit 8d06e53) – och tillbaka igen.
   1.2.0 får inte krascha, inte förstöra v2-data och barnet får v1 som vanligt. SYNTETISK familj (testfixturen). */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { v2tools, enableV2, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const OLD = path.join(require('os').tmpdir(), 'pluggappen-1.2.0-' + process.pid + '.html');
fs.writeFileSync(OLD, zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'golden/pluggappen-1.2.0.html.gz'))));
const dump = (w) => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const finish = () => { try { fs.unlinkSync(OLD); } catch (e) { /* ignore */ } console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE DOWNGRADE TEST FAILED' : 'LE DOWNGRADE TEST OK'); process.exit(fails ? 1 : 0); };
const wN = mkWin({ seed: 4711, fixedClock: true }); const TN = tools(wN);
setTimeout(() => { try {
  TN.PA().FAMILY.apply(FIX); TN.PA().load(); TN.PA().rerender(); const D = v2tools(wN, TN);
  enableV2(wN, TN, 'k8'); openKid(TN, 'k8');
  for (let i = 0; i < 3; i++) { TN.click(TN.$('[data-v2="kor"]') || TN.$('[data-v2="extra"]')); D.run((it) => Math.random() < 0.35); toStart(TN); openKid(TN, 'k8'); wN.__advance(86400000); TN.click(TN.$('[data-go="start"]')); openKid(TN, 'k8'); }
  TN.click(TN.$('[data-v2="testa"]')); D.run(() => Math.random() < 0.3); toStart(TN);
  const pN = TN.PA().DB.profiles.k8; TN.PA().flushSave();
  ok(pN.le.log.some(e => e.length > 14) && pN.le.shadow.some(r => r.e === 2) && pN.tests.some(t => t.v2), 'v2-data finns: utökade bevis, v2-passposter, Testa mig-resultat');
  const logN = pN.le.log.length, rw = (pN.le.rw || []).slice(), skillsAtt = Object.values(pN.skills).reduce((a, s) => a + s.att, 0);
  const wO = mkWin({ seed: 99, fixedClock: true, storage: dump(wN), file: OLD }); const TO = tools(wO);
  setTimeout(() => { try {
    ok(/v1\.2\.0/.test(wO.PLUGG_BUILD || ''), '1.2.0 laddad: ' + wO.PLUGG_BUILD);
    TO.PA().FAMILY.apply(FIX); TO.PA().load(); TO.PA().rerender(); openKid(TO, 'k8');
    ok(TO.$('[data-rec]') && !TO.$('[data-v2]'), '1.2.0: barnet får v1-startsidan');
    TO.click(TO.$('[data-rec]')); TO.run(); ok(/Resultat|Klart|Bra|rätt/.test(TO.$('#app').textContent), '1.2.0: ett v1-pass går att köra');
    TO.click(TO.$('[data-go="home"]')); if (TO.$('[data-act="felbok"]')) { TO.click(TO.$('[data-act="felbok"]')); TO.run(); TO.click(TO.$('[data-go="home"]')); }
    const pO = TO.PA().DB.profiles.k8; ok(TO.PA().LE.errors.length === 0, '1.2.0: inga fel i skugglagret med v2-data: ' + JSON.stringify(TO.PA().LE.errors));
    ok(pO.le && pO.le.v === 2 && pO.le.log.length >= logN, `1.2.0: le behålls och växer (${logN} → ${pO.le.log.length})`);
    ok(Object.values(pO.skills).reduce((a, s) => a + s.att, 0) > skillsAtt, '1.2.0: v1-mastery fortsätter från v2-passens övning');
    ok(pO.settings.engine === 'v2', '1.2.0: motorflaggan ligger kvar orörd (ignoreras av 1.2.0)');
    TO.PA().flushSave();
    const wB = mkWin({ seed: 7, fixedClock: true, storage: dump(wO) }); const TB = tools(wB);
    setTimeout(() => { try {
      TB.PA().FAMILY.apply(FIX); TB.PA().load(); TB.PA().rerender(); openKid(TB, 'k8'); const DB2 = v2tools(wB, TB);
      ok(TB.$('[data-v2="kor"]'), 'tillbaka till ny version: v2 fortsätter för barnet');
      TB.click(TB.$('[data-v2="kor"]') || TB.$('[data-v2="extra"]')); DB2.run(false); ok(/Bra jobbat/.test(TB.$('#app').textContent), 'ny version: v2-pass fungerar efter 1.2.0-perioden');
      const pB = TB.PA().DB.profiles.k8; ok(rw.every(k => (pB.le.rw || []).includes(k)), 'belöningsmarkörer överlever 1.2.0-perioden');
      ok(TB.PA().LE.errors.length === 0, 'inga fel efter återgång: ' + JSON.stringify(TB.PA().LE.errors));
    } catch (e) { fails++; console.log('EXC', e.stack); } finish(); }, 50);
  } catch (e) { fails++; console.log('EXC', e.stack); finish(); } }, 50);
} catch (e) { fails++; console.log('EXC', e.stack); finish(); } }, 50);
