/* v1-regression: med v2 AV (standard) ska barnet och föräldern se exakt samma skärmar och få exakt samma v1-data som i release 1.2.0.
   Referensen (tests/golden/v1_reference.json) skapades från release-1.2.0-8d06e53 med samma flöde, slumpfrö och klocka.
   Undantag: p.le (skuggdata) och p.mistakesCleared (Felboken-synkfixen i 1.2.0) jämförs inte. ⚙-sidan (versionsnummer) ingår inte.
   3.3 (ägarbeslut 2026-10-27): startsidans barnkort visar inte längre syskonens nivå, streak och dagens antal. Referensen är omgjord från
   samma 1.2.0-bygge med samma normalisering av startsidan (tests/le/childflow.js startNorm); alla andra skärmar och all v1-data är oförändrade. */
process.env.TZ = 'Europe/Stockholm';
const { capture } = require('./golden/make_v1_golden.js'); const ref = require('./golden/v1_reference.json');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
capture().then(cur => {
  ok(cur.screens.length === ref.screens.length, `antal skärmar ${cur.screens.length} = ${ref.screens.length}`);
  ref.screens.forEach(([label, hh], i) => ok(cur.screens[i] && cur.screens[i][1] === hh, `skärm "${label}" identisk med 1.2.0`));
  for (const id of Object.keys(ref.data)) ok(cur.data[id] === ref.data[id], `v1-data för ${id} identisk med 1.2.0`);
  console.log(`${ref.screens.length} skärmar + ${Object.keys(ref.data).length} profiler jämförda mot ${ref.made}`);
  console.log(fails ? 'V1 REGRESSION FAILED' : 'V1 REGRESSION OK'); process.exit(fails ? 1 : 0);
}).catch(e => { console.log('EXC', e.stack); process.exit(1); });
