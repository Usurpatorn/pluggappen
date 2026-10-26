/* 2.1 Learning Recipes (WHAT / HOW / WHEN): låser tillägget om aktivitetstyper och bevis.
   Variation i aktiviteter får aldrig blåsa upp behärskning:
   - ett svar direkt efter en förklaring (UPPTÄCK/LÄR) ger högst stadium 1 ("lärt idag – tillbaka imorgon")
   - igenkänning ensam gör aldrig en punkt "Säker", hur många fördröjda träffar det än blir
   - fördröjt eget svar är starkare bevis än flerval; djupformer (tillämpa, hitta felet …) öppnar djupgrinden
   - Utmaning är ett eget spår och rör inte grundkunskapens stadium
   - receptet: stadium → band → aktivitet (NY → igenkänning, SÄKER → djupformer), utan slumpvis rotation. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const E = require('../src/05b_engine2.js'); const DAY = 86400000;
global.LECAT = require('../src/05a_concepts.js');
const PACKS = require('../src/05d_packs.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const pol = E.POLICIES.older;
const CAT = (o = {}) => ({ 'k:p/x': { id: 'k:p/x', kind: 'kp', subject: 'no', maxLvl: 3, depth: true, recall: true, ...o } });
function run(cat, steps) {
  const L = E.newLE(); let t = Date.UTC(2026, 9, 1, 8); let seq = 0;
  for (const s of steps) { t += (s.gap || 0) * DAY + 60000; E.apply(L, cat, { t, dev: 'd', seq: ++seq, cid: 'k:p/x', ok: s.ok !== false, kind: s.kind || 'mc', k: 4, help: s.help || 'none', ctx: s.ctx || 'first', item: 'i' + (seq % 7), sess: 'd:' + (s.sess || seq), lvl: 1, form: s.form || 'r', mode: s.mode }, pol); }
  return { L, c: L.c['k:p/x'], t };
}
// 1. Direkt efter förklaringen: högst stadium 1, oavsett om svaret räknas som stöttat
for (const help of ['none', 'hint']) {
  const { c } = run(CAT(), [{ help, sess: 1 }, { ctx: 'repeat', sess: 1 }, { ctx: 'repeat', kind: 'free', form: 'c', sess: 1 }, { ctx: 'repeat', form: 'a', sess: 1 }]);
  ok(c.st === 1, `svar direkt efter förklaring (help ${help}) + upprepningar i samma pass → stadium 1 (fick ${c.st})`);
  ok(!E.depthOk(c), 'en djupfråga i samma pass som första mötet räknas inte som djupbevis');
}
// 2. Igenkänning ensam: aldrig "Säker" (punkt med eget svar → flervalsspärr; punkt utan eget svar → djupgrind)
for (const recall of [true, false]) {
  const steps = [{}]; for (const g of [1, 2, 4, 7, 12, 20, 30, 45, 60, 80]) steps.push({ gap: g });
  const { L, c, t } = run(CAT({ recall }), steps);
  ok(!E.depthOk(c) && c.st <= E.CFG.depth.gateStage, `bara igenkänning i 260 dagar (eget svar ${recall}) → inte säker (stadium ${c.st}, djup ${c.dp || 0})`);
  ok(!E.insights(L, CAT({ recall }), t + DAY, pol).strengths.includes('k:p/x'), 'föräldern ser inte en igenkänningspunkt som styrka');
}
// 3. Fördröjt eget svar + djupformer → säker; samma antal svar utan fördröjning → inte
{
  const steps = [{}]; for (const g of [1, 2, 4, 7, 12, 20]) steps.push({ gap: g, kind: 'free', form: 'c' }, { form: 'a', sess: 'x' + g });
  const { c } = run(CAT(), steps);
  ok(c.st >= 5 && E.depthOk(c), `fördröjt eget svar + tillämpning på olika dagar → säker (stadium ${c.st}, djup ${c.dp})`);
  const same = []; for (let i = 0; i < 13; i++) same.push({ kind: 'free', form: i % 2 ? 'a' : 'c', ctx: i ? 'repeat' : 'first', sess: 1 });
  const r2 = run(CAT(), same); ok(r2.c.st === 1 && !E.depthOk(r2.c), `13 rätt i samma pass → fortfarande stadium 1 (fick ${r2.c.st})`);
}
// 4. Utmaning: eget spår
{
  const base = [{}, { gap: 1, kind: 'free', form: 'c' }, { gap: 2, kind: 'free', form: 'c' }];
  const a = run(CAT(), base).c; const b = run(CAT(), [...base, { gap: 1, mode: 'challenge', kind: 'free', form: 's' }, { gap: 0, mode: 'challenge', kind: 'free', form: 's', sess: 'c2' }]).c;
  ok(b.st === a.st && (b.dp || 0) === (a.dp || 0), 'Utmaning ändrar varken stadium eller djupbevis');
  ok(b.ch && b.ch.ok >= 1, 'Utmaning räknas i sitt eget spår');
}
// 5. Receptet: stadium → band → vikter
ok(PACKS.bandOf({ n: 0, st: 0 }) === 'new' && PACKS.bandOf({ n: 3, st: 1 }) === 'learning' && PACKS.bandOf({ n: 6, st: 2 }) === 'practising' && PACKS.bandOf({ n: 9, st: 4 }) === 'secure' && PACKS.bandOf(null) === null, 'banden följer motorns stadier (inga nya tillstånd)');
const R = PACKS.RECIPE;
ok(Object.entries(R.new).every(([f, w]) => f === 'recognition' || w < R.new.recognition), 'NY: igenkänning väger tyngst');
ok(R.practising.recall === Math.max(...Object.values(R.practising)), 'ÖVAR: eget svar väger tyngst');
ok(['relationship', 'mistake', 'cause', 'application', 'explanation', 'multistep'].every(f => R.secure[f] > R.secure.recognition * 5), 'SÄKER: koppla/tillämpa/hitta felet väger långt mer än igenkänning');
ok(['new', 'learning'].every(b => R[b].explanation <= R[b].recall && R[b].explanation <= R[b].recognition), 'NY/LÄR SIG: förklaringsfrågor kommer inte före igenkänning och eget svar');
// 6. Riktiga paket: andelen igenkänning sjunker och djupformer ökar från NY till SÄKER, för varje paket och policy
const fs = require('fs'); const path = require('path'); const dir = path.join(__dirname, '../content/packs');
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) PACKS.register(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (const p of Object.values(PACKS.REG.packs)) for (const polName of p.policies) {
  const share = (stage) => { let rec = 0, deep = 0, n = 0; for (const kp of p.kps) for (let i = 0; i < 12; i++) { const q = PACKS.question(PACKS.cidOf(p.id, kp.id), { lvl: 2, format: 'any', pol: polName, avoid: new Set(), rnd, stage, itemId: LECAT.itemId }); if (!q) continue; n++; if (q.form === 'recognition') rec++; if (PACKS.DEPTH.has(q.form)) deep++; } return { rec: rec / n, deep: deep / n }; };
  const a = share({ n: 0, st: 0 }), b = share({ n: 9, st: 4 });
  const msg = `${p.id} (${polName}): NY igenkänning ${(a.rec * 100).toFixed(0)}% → SÄKER ${(b.rec * 100).toFixed(0)}%, djup ${(a.deep * 100).toFixed(0)}% → ${(b.deep * 100).toFixed(0)}%`; ok(a.rec > b.rec && b.deep > a.deep, msg); if (process.argv.includes("-v")) console.log(msg);
}
console.log(`${checks} kontroller, ${fails} fel`); console.log(fails ? 'RECIPES TEST FAILED' : 'RECIPES TEST OK'); process.exit(fails ? 1 : 0);
