/* §20 Migrering – egenskapstest på 300 SYNTETISKA v1-profiler (inga riktiga data).
   För varje profil: v1 orört, deterministisk, idempotent, schemaversionerad, liten, omspelbar, sammanslagning mellan enheter
   behåller den tidigaste basen, och en "aktivering på prov" (planera + köra ett pass med passköraren) fungerar för alla tre policyer.
   Rollback = ta bort p.le (eller stäng av motorflaggan) – v1-fälten har aldrig ändrats. */
'use strict';
process.env.TZ = 'UTC';
const E = require('../src/05b_engine2.js'); const LER = require('../src/05e_runner.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 30) console.log('FAIL', m); } };
const DAY = 86400000; const T0 = Date.UTC(2026, 9, 26, 12);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SUBJ = ['math', 'sv', 'no', 'so'];
const cat = {}; const map = {}; for (let i = 0; i < 32; i++) { const id = 'k' + i; const cid = 's:' + id; cat[cid] = { id: cid, kind: 'skill', ref: id, name: 'Moment ' + i, subject: SUBJ[i % 4], maxLvl: 3, recall: i % 4 === 0 ? true : null, focus: i % 7 === 0, prereq: [] }; map[id] = cid; }
cat['d:es1'] = { id: 'd:es1', kind: 'deck', ref: 'es1', name: 'Glosor', subject: 'lang', maxLvl: 1, recall: null, focus: false, prereq: [] };
function synthProfile(r) {
  const skills = {}; const n = Math.floor(r() * 32);
  for (let i = 0; i < n; i++) { const id = 'k' + Math.floor(r() * 34); const att = Math.floor(r() * 80); const cor = Math.floor(att * r()); skills[id] = { att, cor, streak: Math.floor(r() * 5), m: Math.round(r() * 100), lvl: 1 + Math.floor(r() * 3), last: T0 - Math.floor(r() * 120) * DAY, wrongRun: Math.floor(r() * 3) }; }
  const mistakes = []; for (let i = 0; i < Math.floor(r() * 12); i++) mistakes.push({ id: 'm' + i, cat: r() < 0.8 ? 'math' : 'word', skillId: 'k' + Math.floor(r() * 34), at: T0 - Math.floor(r() * 40) * DAY });
  const words = {}; for (let i = 0; i < Math.floor(r() * 30); i++) words['w' + i] = { box: Math.floor(r() * 6), due: T0 + Math.floor((r() - 0.5) * 20) * DAY };
  return { xp: Math.floor(r() * 5000), gems: Math.floor(r() * 200), skills, mistakes, words, days: {}, streak: Math.floor(r() * 9), settings: { sprint: 8 } };
}
const pols = ['younger', 'middle', 'older'].map(k => E.POLICIES[k]);
let maxSize = 0, plans = 0, sessItems = 0;
for (let k = 0; k < 300; k++) {
  const r = rng(1000 + k); const p = synthProfile(r); const pol = pols[k % 3]; const snap = JSON.stringify(p);
  const le = E.migrateV1(p, cat, map, T0, pol); const le2 = E.migrateV1(JSON.parse(snap), cat, map, T0, pol);
  ok(JSON.stringify(p) === snap, `#${k}: v1-profilen orörd`);
  ok(E.stable(le) === E.stable(le2), `#${k}: deterministisk`);
  ok(E.migrateV1({ ...p, le }, cat, map, T0 + 5 * DAY, pol) === le, `#${k}: idempotent (befintlig le behålls)`);
  ok(le.v === 2 && le.ev === 2 && le.mv === 1 && le.migratedFrom === 'v1' && Array.isArray(le.log) && le.log.length === 0, `#${k}: schemaversionerad (v ${le.v}, ev ${le.ev}, mv ${le.mv})`);
  ok(Object.values(le.base.c).every(c => c.st <= 2 && c.lvl >= 1 && c.lvl <= 3), `#${k}: inget migrerat koncept över stadium 2, nivåer inom gränserna`);
  ok(Object.keys(le.base.c).every(cid => cat[cid]), `#${k}: bara kända koncept (okända v1-moment hoppas över)`);
  const sz = JSON.stringify(le).length; maxSize = Math.max(maxSize, sz); ok(sz < 20000, `#${k}: liten (${sz} tecken)`);
  ok(E.stable(E.replay([], cat, pol, le.base)) === E.stable(le.base), `#${k}: omspelning av tom logg = basen`);
  // två enheter migrerar samma profil vid olika tid → sammanslagningen behåller den tidigaste basen, oavsett ordning
  const later = E.migrateV1(JSON.parse(snap), cat, map, T0 + 3600000, pol); const m1 = E.mergeLE(le, later), m2 = E.mergeLE(later, le);
  ok(m1.t0 === T0 && E.stable(m1) === E.stable(m2), `#${k}: sammanslagning av två migreringar = tidigaste basen, ordningsoberoende`);
  // aktivering på prov: planera och kör ett pass på kopian
  const L = JSON.parse(JSON.stringify(le.base)); const now = T0 + 3600000;
  const plan = E.planSession(L, cat, now, { exams: [], recentSubjectShare: {}, subjectCount: 4, dueDoneToday: 0, lastSessionAt: null, decks: { 'd:es1': { due: 3, nw: 2, seen: 5 } } }, pol, { n: pol.n });
  plans++; ok(Array.isArray(plan) && plan.length >= 1 && plan.length <= pol.maxItems, `#${k}: planen fungerar (${plan.length})`);
  const R = LER.create(L, cat, plan, pol, { sessId: 'D:1' }); let seq = 0; let t = now;
  for (let g = 0; g < 40; g++) { const s = LER.peek(R, L); if (!s) break; if (s.mode === 'teach') { LER.answered(R, L, s, true); continue; } if (s.kind === 'deck') { LER.answered(R, L, s, r() < 0.7); continue; }
    const ok1 = r() < 0.65; E.apply(L, cat, { t: (t += 1000), dev: 'D', seq: ++seq, cid: s.cid, ok: ok1, kind: 'free', k: 0, help: s.help || 'none', ctx: s.ctx, item: 'i' + g, fast: false, sess: 'D:1', lvl: s.lvl, role: s.code }, pol); LER.answered(R, L, s, ok1); sessItems++; }
  ok(R.answered <= (plan.maxItems || pol.maxItems), `#${k}: passet håller taket`);
}
// rollback: en profil utan le är exakt v1; en okänd (senare) version skrivs aldrig över av migreringen
{ const p = synthProfile(rng(7)); const le = E.migrateV1(p, cat, map, T0, pols[1]); const withLe = { ...p, le }; const { le: _, ...rolled } = withLe; ok(JSON.stringify(rolled) === JSON.stringify(p), 'rollback: utan le = exakt v1-profilen');
  const fut = { ...p, le: { v: 3, x: 1 } }; const out = E.migrateV1(fut, cat, map, T0, pols[1]); ok(fut.le.v === 3 && fut.le.x === 1, 'okänd le-version lämnas orörd av migreringen');
  ok(out !== fut.le && out.v === 2, 'migreringen returnerar en ny le och muterar aldrig den okända (appen, LE.state, vägrar dessutom läsa den – se test_le_v2ui)'); }
console.log(`300 syntetiska profiler · största le ${maxSize} tecken · ${plans} planer · ${sessItems} simulerade svar`);
console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE MIGRATION TEST FAILED' : 'LE MIGRATION TEST OK'); process.exit(fails ? 1 : 0);
