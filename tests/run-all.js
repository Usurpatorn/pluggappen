// Kör hela testsviten mot dist/ (bygg först: npm run build). Avslutar med kod 1 om något test faller.
// --quick hoppar över de största generator-sviterna (används inte i CI, bara lokalt).
const { spawnSync } = require('node:child_process'); const fs = require('node:fs'); const path = require('node:path');
const quick = process.argv.includes('--quick');
const dist = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(dist)) { console.error('dist/index.html saknas – kör `npm run build` först'); process.exit(1); }
const suites = [
  ['Generatorer (mallar åk 8/4/2)', 'test_gen.js', { big: true }],
  ['Extra matte (bråk, geometri, enheter, klockan …)', 'test_more.js', { big: true }],
  ['Åk 2 – alla moment, alla nivåer', 'test_ak2.js', { big: true }],
  ['Språk: lektioner och ordkontroll', 'test_lang.js'],
  ['Faktabanker: geografi + kemi', 'test_so.js'],
  ['Synk: två enheter, delta-merge', 'test_sync.js'],
  ['Åtkomst: identitet, medlemskap, regler, radering', 'test_auth.js'],
  ['Indatasäkerhet (XSS)', 'test_xss.js'],
  ['Integritet: inga familjeuppgifter i bundlen', 'test_privacy.js'],
  ['Smoke: hela användarflödet (jsdom)', 'smoke.js'],
  ['v1-regression: reservmotorn v1 = release 1.2.0', 'test_v1_regression.js'],
  ['Motor v2: regler, logg, synk, migrering (3A+3B)', 'test_le_engine.js'],
  ['Motor v2: simuleringsregression', 'test_le_sim.js'],
  ['Motor v2: K-14-stresstest + säsonger A–M (syntetiska)', 'test_le_season.js'],
  ['Motor v2: barnupplevelse i appen (standard från 2.0.0)', 'test_le_v2ui.js'],
  ['Motor v2: eget svar + Utmaningar (deterministisk rättning)', 'test_le_content.js'],
  ['Motor v2: migrering på 300 syntetiska profiler', 'test_le_migration.js'],
  ['Nödrollback: v2-data i publicerade 1.2.0 och tillbaka', 'test_le_downgrade.js'],
  ['Motor v2: djuplänk från påminnelse (även trasig data)', 'test_le_deeplink.js'],
  ['Skuggläge: barnen får v1, fångst, föräldravy, täckning', 'test_le_shadow.js'],
  ['Skuggläge: flera enheter, Felboken-synk', 'test_le_sync.js'],
  ['2.1 Concept Packs: kvalitetsgrind (varje variant, migrering, id:n)', 'test_packs.js'],
  ['2.1 Formmedvetna bevis: regler + simulering mot 2.0', 'test_le_forms.js'],
  ['2.1 Paket i appen: Kör!, Testa mig, migrering, v1, rollback till 2.0.0', 'test_le_packs_app.js'],
  ['2.1 Läs upp: behörighet per fråga, Yngre-knapp, ingen extern tjänst', 'test_readaloud.js'],
  ['2.1 Små mattebanker åk 2 (former, bråk) – bara v2', 'test_gen2.js'],
  ['2.2 Study Mission: skoluppgifter, lärarfrågor, uppdrag, innehållshälsa', 'test_study_mission.js'],
  ['2.1 Kodgranskningens fynd (XSS, Felboken, kompaktering, privat innehåll)', 'test_review21.js'],
  ['2.1 Innehållsgranskningens sakfel får aldrig komma tillbaka', 'test_content_facts.js'],
  ['2.1 Learning Recipes: aktivitet efter stadium, ingen uppblåst behärskning', 'test_recipes.js'],
  ['2.1.1 Hotfix: provrubriken på Kör! = passet; Öva inför provet; ärlig text utan kopplingar; Äldres första kurs', 'test_exam_cta.js'],
  ['2.1.1 Startknappar och sammanhang: datumgränser 28/21 dygn, två prov, kemi, manuella glosor, saknat privat innehåll, v1, profilbyte', 'test_cta_paths.js'],
  ['Experience v3: Explore/Grow/Achieve, aktiviteter, KLAR → FLOW, papper, golden cases, rollback', 'test_exp_v3.js'],
  ['Experience v3: golden case A (algebra) och B (kemi) – syntetiska skoluppgifter, 34 dygn i appen', 'test_golden_cases.js'],
  ['Experience v3: golden case C – Explore för Yngre, 21 dygn: aktiviteter i stället för upprepade frågor', 'test_golden_explore.js'],
  ['Experience v3: den sista kodgranskningens fynd (v1-Felbok, Visa hur, FLOW-längd och dagsgräns, Hitta felet, id:n, välkomsttext)', 'test_review_v3.js'],
  ['Experience v3: den sista UX-granskningens fynd (Boss-kopior, provets moment, knappsats, Explore-rubrik, skuldfritt hem, papper)', 'test_ux_v3.js'],
  ['Uttrycksknappsatsen: siffrorna 1–0 i ordning på egen rad även i v1 och Klassisk', 'test_keypad.js'],
  ['Testadressen (förhandsversion): egen lagring, ingen service worker eller push, inget familjeinnehåll', 'test_preview.js'],
  ['Testa som barnet (testadressen): kopia i minnet, inga skrivningar, byte för byte före = efter, barnet spelar samtidigt', 'test_parent_test_mode.js'],
  ['3.2 Testa som barnet i den vanliga appens föräldraläge: barnet spelar samtidigt, väntande ändringar, ladda om/bakåt/byta barn', 'test_parent_test_mode_prod.js'],
  ['Hotfix 3.0.1: glosrepetition i ett v3-pass – ämnet som rubrik, hemmet säger vad som repeteras, samma plan på hemmet som i KÖR', 'test_hotfix_301.js'],
  ['3.1 Bara prov och läxor (förälderns val per barn): Kör!/FLOW bara inlagda prov och läxor, ärligt hem utan prov, standard oförändrad', 'test_scope_exams.js'],
  ['Experience v3: löfte → utförande för varje primär knapp (Explore/Grow/Achieve/Klassisk × tio tillstånd)', 'test_promise_exec.js'],
];
let failed = 0; const rows = [];
for (const [name, file, opts = {}] of suites) {
  if (quick && opts.big) { rows.push([name, 'hoppad (--quick)']); continue; }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8', timeout: 240000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').filter(l => l.trim() && !/scrollTo\(\) method/.test(l));
  const summary = lines.slice(-1)[0] || '';
  const ok = r.status === 0;
  if (!ok) failed++;
  rows.push([name, `${ok ? 'OK ' : 'FEL'} ${((Date.now() - t0) / 1000).toFixed(1)}s  ${summary.slice(0, 90)}`]);
  if (!ok) { console.log(`\n===== ${name} (${file}) =====\n` + lines.slice(-40).join('\n') + '\n'); }
  // CI: en annotering per fallen svit (läsbar via API:t även när loggarna inte är det). Bara svitens namn och sista rad – testerna skriver
  // aldrig ut privata termer (test_privacy anger "privat term #n").
  if (!ok && process.env.GITHUB_ACTIONS) { const fl = lines.filter(l => /FAIL|fel|Error/.test(l)).slice(0, 3).map(l => l.slice(0, 160)); console.log(`::error title=${file} föll::${[summary.slice(0, 160), ...fl].join(' | ').replace(/[\r\n%]/g, ' ')}`); }
}
const w = Math.max(...rows.map(r => r[0].length));
console.log('\nTestsvit – resultat'); for (const [n, s] of rows) console.log(`  ${n.padEnd(w)}  ${s}`);
console.log(failed ? `\n${failed} svit(er) FÖLL` : '\nALLA TESTER GRÖNA');
process.exit(failed ? 1 : 0);
