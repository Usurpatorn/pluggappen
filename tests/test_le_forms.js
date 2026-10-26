/* 2.1 (regel 3I): formmedvetna bevis. Del 1: reglerna steg för steg (deterministiskt). Del 2: simulering 2.1 mot 2.0 på syntetiska
   elever (tests/le/forms.js, 8 frön i CI): hållbarheten får inte försämras märkbart, falsk säkerhet ska nästan försvinna och
   förståelsen öka. 2.0-baslinjen för katalogen utan djupformer skyddas oförändrad av test_le_sim.js. */
'use strict';
process.env.TZ = 'UTC';
const E = require('../src/05b_engine2.js'); const { DAY } = E;
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const pol = E.POLICIES.older; const CAT = { a: { id: 'a', subject: 'no', maxLvl: 3, recall: true, depth: true }, b: { id: 'b', subject: 'no', maxLvl: 3, recall: true } };
const mk = (st, extra = {}) => { const L = E.newLE(); const c = E.cstate(L, 'a'); Object.assign(c, { st, n: 6, lastOk: 0, due: 0, okInd: 4 }, extra); return { L, c }; };
let seq = 0; const ev = (o) => ({ dev: 'T', seq: ++seq, ok: true, kind: 'mc', k: 4, help: 'none', ctx: 'first', item: 'i' + seq, sess: 's' + seq, lvl: 2, ...o });
const at = (d) => d * DAY + 17 * 3600000;
// 1) formkoden sparas och läses (index 19) – äldre versioner läser inte fältet
{ const a = E.encodeEv(ev({ t: at(1), cid: 'a', form: 'a' })); ok(a[19] === 'a' && a[18] === 0, 'formkod på index 19, onlyVariant 0 på 18'); ok(E.decodeEv(a).form === 'a', 'formkoden läses tillbaka');
  const b = E.encodeEv(ev({ t: at(1), cid: 'a' })); ok(b.length === 14, 'utan form: oförändrat 3B-format (14 fält)'); }
// 2) djupbevis: flerval i djupform +1 per dygn, två samma dygn räknas en gång, eget svar/ordning +2
{ const { L, c } = mk(3); E.recordEvidence(L, CAT, 'a', ev({ form: 'm' }), at(10), pol, { id: 'x1' }); ok(c.dp === 1, 'djup flerval → dp 1');
  E.recordEvidence(L, CAT, 'a', ev({ form: 'x', ctx: 'first' }), at(10) + 60000, pol, { id: 'x2' }); ok(c.dp === 1, 'samma dygn igen → fortfarande 1 (tur skyddas)');
  E.recordEvidence(L, CAT, 'a', ev({ form: 'l', kind: 'order' }), at(11), pol, { id: 'x3' }); ok(c.dp === 3, 'ordning i djupform → +2'); }
// 3) hjälp, omförsök och utmaning ger inga djupbevis
{ const { L, c } = mk(3); E.recordEvidence(L, CAT, 'a', ev({ form: 'a', help: 'hint' }), at(10), pol, { id: 'h' }); E.recordEvidence(L, CAT, 'a', ev({ form: 'a', ctx: 'retry' }), at(11), pol, { id: 'r' }); E.recordEvidence(L, CAT, 'a', ev({ form: 'a', mode: 'challenge' }), at(12), pol, { id: 'c' });
  ok(!c.dp, 'ledtråd, omförsök och utmaning ger inget djupbevis'); }
// 4) grinden: stadium 4 → 5 kräver djupbevis; utan går det inte, med två djupdygn går det
{ const { L, c } = mk(4, { lastOk: at(0) }); E.recordEvidence(L, CAT, 'a', ev({ kind: 'free', form: 'c' }), at(20), pol, { id: 'g1' }); ok(c.st === 4, 'eget svar efter intervallet men utan djupbevis → stannar på 4');
  E.recordEvidence(L, CAT, 'a', ev({ form: 'a' }), at(21), pol, { id: 'g2' }); ok(c.st === 4 && c.dp === 1, 'ett djupdygn: grinden fortfarande stängd (flerval spärrat)');
  E.recordEvidence(L, CAT, 'a', ev({ form: 'm' }), at(40), pol, { id: 'g3' }); ok(c.dp >= 2 && c.dpn === 2 && c.st === 5, 'andra djupdygnet öppnar grinden och räknas som hämtning → stadium 5');
  E.recordEvidence(L, CAT, 'a', ev({ kind: 'free', form: 'c' }), at(60), pol, { id: 'g4' }); ok(c.st === 6, 'därefter vanliga regler (eget svar efter intervallet → 6)'); }
// 4b) Release-kontroll: djupbeviset måste komma från TVÅ OLIKA DYGN. Ett enda dygn – även ett eget svar/ordning som ger +2 – räcker inte,
//     varken för grinden (4 → 5), för "Säker" eller för formatet (motorn fortsätter be om en djupfråga).
{ const { L, c } = mk(4, { lastOk: at(0) }); E.recordEvidence(L, CAT, 'a', ev({ form: 'l', kind: 'order' }), at(20), pol, { id: 'd1' });
  ok(c.dp >= 2, `ett dygn med ordning i djupform ger ${c.dp} poäng djupbevis`);
  ok(c.st === 4, `ett enda djupdygn öppnar inte grinden (stadium ${c.st})`);
  ok(!E.depthOk(c) && E.childLabel(c, at(20), pol, L) !== 'Säker', 'ett enda djupdygn ger inte "Säker"');
  ok(E.formatFor(L, CAT, 'a', pol, 'focus') === 'depth', 'efter ett djupdygn ber motorn fortfarande om en djupfråga');
  E.recordEvidence(L, CAT, 'a', ev({ form: 'a', kind: 'free' }), at(20) + 3600000, pol, { id: 'd2' });
  ok(c.st === 4 && !E.depthOk(c), 'ett andra pass samma dygn räknas inte som ett andra djupdygn');
  E.recordEvidence(L, CAT, 'a', ev({ form: 'a', kind: 'free' }), at(22), pol, { id: 'd3' });
  ok(E.depthOk(c) && E.formatFor(L, CAT, 'a', pol, 'focus') === 'recall', 'andra dygnet: djupkravet uppfyllt, motorn går tillbaka till eget svar');
  E.recordEvidence(L, CAT, 'a', ev({ kind: 'free', form: 'c' }), at(60), pol, { id: 'd4' });
  ok(c.st === 5 && E.childLabel(c, at(60), pol, L) === 'Säker', `nästa fördröjda hämtning går genom grinden (stadium ${c.st}) och punkten är "Säker"`);
  // replay ger samma sak som stegvis (regeln bor i tillståndet, inte i loggen)
  const log = [{ t: at(1), cid: 'a', form: 'l', kind: 'order' }].map(o => E.encodeEv(ev(o))); const R = E.replay(log, CAT, pol); ok(!E.depthOk(R.c.a), 'omspelning: ett dygn räcker inte heller där'); }
// 5) "Säker" och MASTERY kräver djupbevis för djupkoncept, inte för koncept utan djupformer
{ const { L, c } = mk(3, { lastOk: at(0) }); const r = E.recordEvidence(L, CAT, 'a', ev({ kind: 'free', form: 'c' }), at(10), pol, { id: 'm1' }); ok(c.st === 4 && !r.rewards.includes('MASTERY') && E.childLabel(c, at(10), pol, L) !== 'Säker', 'stadium 4 utan djupbevis: inte "Säker", ingen MASTERY');
  c.dp = 2; c.dpn = 2; ok(E.childLabel(c, at(10), pol, L) === 'Säker', 'med djupbevis: "Säker"');
  const L2 = E.newLE(); const c2 = E.cstate(L2, 'b'); Object.assign(c2, { st: 3, n: 6, lastOk: at(0) }); const r2 = E.recordEvidence(L2, CAT, 'b', ev({ cid: 'b', kind: 'free' }), at(10), pol, { id: 'm2' }); ok(c2.st === 4 && r2.rewards.includes('MASTERY'), 'koncept utan djupformer: som i 2.0'); }
// 6) fel på en djupfråga är en förståelselucka – ingen sänkning, tillbaka om två dygn; samma fel i eget svar sänker som vanligt
{ const { L, c } = mk(3, { lastOk: at(0) }); E.recordEvidence(L, CAT, 'a', ev({ ok: false, form: 'a' }), at(10), pol, { id: 'f1' }); ok(c.st === 3 && c.due === E.dayStart(at(10)) + 2 * DAY, 'djupfel: stadium kvar, tillbaka om två dygn');
  const m = mk(3, { lastOk: at(0) }); E.recordEvidence(m.L, CAT, 'a', ev({ ok: false, kind: 'free', form: 'c' }), at(10), pol, { id: 'f2' }); ok(m.c.st === 1, 'fel i eget svar efter intervallet: glömt → sänks som i 2.0'); }
// 7) formatFor: djup från stadium 3 tills djupbeviset finns, sedan eget svar; aldrig för uppvärmning/Rescue
{ const { L, c } = mk(3); ok(E.formatFor(L, CAT, 'a', pol, 'focus') === 'depth', 'stadium 3 utan djupbevis → djupfråga'); c.dp = 2; c.dpn = 2; ok(E.formatFor(L, CAT, 'a', pol, 'focus') === 'recall', 'med djupbevis → eget svar');
  c.dp = 0; ok(E.formatFor(L, CAT, 'a', pol, 'warmup') === 'any' && E.formatFor(L, CAT, 'a', pol, 'rescue') === 'any', 'uppvärmning och Rescue: ingen djupfråga'); }
// 8) vilande moment leder beviset till kunskapspunkten (route) – deterministiskt, loggen orörd
{ const cat = { 's:x': { id: 's:x', subject: 'no', active: false, route: { iOLD: 'k:p/a' } }, 'k:p/a': { id: 'k:p/a', subject: 'no', maxLvl: 3, recall: true } };
  const log = [E.encodeEv(ev({ t: at(1), cid: 's:x', item: 'iOLD' })), E.encodeEv(ev({ t: at(1) + 1000, cid: 's:x', item: 'iNEW' }))];
  const L = E.replay(log, cat, pol); ok(L.c['k:p/a'] && L.c['k:p/a'].n === 1 && L.c['s:x'] && L.c['s:x'].n === 1, 'känd gammal fråga → punkten, okänd → kvar på momentet');
  ok(E.stable(E.replay(log, cat, pol)) === E.stable(L), 'omspelningen är deterministisk'); ok(log[0][3] === 's:x', 'loggen ändras inte'); }
// 9) simulering 2.1 mot 2.0
const F = require('./le/forms.js'); const seeds = Array.from({ length: Number(process.env.FORMS_SEEDS) || 8 }, (_, i) => 101 + 7 * i);
const R = F.compare(undefined, seeds); const keys = Object.keys(R); const avg = (f, side) => keys.reduce((a, k) => a + R[k][side][f], 0) / keys.length;
for (const k of keys) { const v = R[k]; console.log(`${k} d45 ${(v.on.d45 * 100).toFixed(1)}/${(v.off.d45 * 100).toFixed(1)} d30 ${(v.on.d30 * 100).toFixed(1)}/${(v.off.d30 * 100).toFixed(1)} falskt säkra ${v.on.falseSecure.toFixed(2)}/${v.off.falseSecure.toFixed(2)} förståelse ${(v.on.understanding * 100).toFixed(0)}/${(v.off.understanding * 100).toFixed(0)}`);
  ok(v.on.d45 >= v.off.d45 - 0.035, `${k}: hållbarhet dag 45 inte märkbart sämre (${(v.on.d45 * 100).toFixed(1)} mot ${(v.off.d45 * 100).toFixed(1)})`); ok(v.on.understanding > v.off.understanding, `${k}: förståelsen ökar`); }
ok(avg('d45', 'on') >= avg('d45', 'off') - 0.01, `medel dag 45: ${(avg('d45', 'on') * 100).toFixed(1)} mot ${(avg('d45', 'off') * 100).toFixed(1)}`);
ok(avg('d30', 'on') >= avg('d30', 'off') - 0.015, `medel dag 45+30: ${(avg('d30', 'on') * 100).toFixed(1)} mot ${(avg('d30', 'off') * 100).toFixed(1)}`);
ok(avg('falseSecure', 'on') <= 0.3 * avg('falseSecure', 'off'), `falsk säkerhet minskar kraftigt: ${avg('falseSecure', 'on').toFixed(2)} mot ${avg('falseSecure', 'off').toFixed(2)}`);
console.log(fails ? `LE FORMS TEST FAILED (${fails} av ${checks})` : `LE FORMS TEST OK – ${checks} kontroller, regel ${E.RULES}`); process.exit(fails ? 1 : 0);
