/* Learning Engine v2 (Fas 3B) – enhets- och egenskapstester mot PRODUKTIONSMOTORN (src/05b_engine2.js).
   Del 1: de 36 godkända Fas 3A-kontrollerna, portade. Del 2: 3B-specifikt (logglagring, omspelning, sammanslagning,
   kompaktering, migrering, beslut O-1…O-9, K-12). Syntetisk data – ingen riktig barndata. */
'use strict';
process.env.TZ = 'UTC';
const fs = require('fs'); const path = require('path');
const E = require('../src/05b_engine2.js'); const LECAT = require('../src/05a_concepts.js'); const S = require('./le/sim.js'); const { DAY } = E; const CAT = S.CAT;
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const pol = E.POLICIES.middle; const T0 = 100 * DAY + 17 * 3600000;
const rnd = S.rng(12345); const pick = (a) => a[Math.floor(rnd() * a.length)];
const KINDS = ['free', 'mc', 'order', 'open'], HELPS = ['none', 'none', 'none', 'hint', 'solution', 'rescue'], CTX = ['first', 'first', 'repeat', 'retry', 'exam'];
const randEv = (cid, t, dev, seq) => ({ cid, ok: rnd() < 0.6, kind: pick(CAT[cid].kinds.concat(KINDS.slice(0, 1))), k: 4, help: pick(HELPS), ctx: pick(CTX), item: cid + '#' + Math.floor(rnd() * 5), dev, seq, t, sess: dev + Math.floor(t / DAY), lvl: 1 + Math.floor(rnd() * 3), fast: rnd() < 0.1 });
const st = (o) => E.stable(o);

/* ================= Del 1: Fas 3A-kontrollerna (oförändrade regler) ================= */
{ const L = E.newLE(); let t = T0; const ids = Object.keys(CAT);
  for (let i = 0; i < 20000; i++) { t += Math.floor(rnd() * 3 * DAY / 10); const cid = pick(ids); E.recordEvidence(L, CAT, cid, randEv(cid, t, 'A', i), t, pol, { id: 's' + Math.floor(t / DAY) }); const c = L.c[cid];
    if (!(c.st >= 0 && c.st <= 6 && Number.isInteger(c.st))) ok(false, 'stage out of range ' + c.st);
    if (!(c.lvl >= 1 && c.lvl <= (CAT[cid].maxLvl || 3))) ok(false, 'lvl out of range');
    if (!Number.isFinite(c.due) || c.due <= t - DAY) ok(false, 'due invalid/past ' + c.due);
    if (c.ev.length > 12 || c.items.length > 6) ok(false, 'unbounded storage');
    if (c.fb && !['open', 'corrected', 'awaiting', 'verified', 'resolved'].includes(c.fb.s)) ok(false, 'bad fb state');
    if (/NaN|Infinity/.test(JSON.stringify(c))) ok(false, 'NaN/Infinity in state'); }
  ok(true, 'invariants'); console.log('A1. invarianter: 20 000 händelser inom gränser'); }
{ const fresh = () => { const L = E.newLE(); const c = E.cstate(L, 'm1'); c.st = 2; c.lastOk = T0 - 3 * DAY; c.n = 5; c.due = T0; return L; };
  const L1 = fresh(); E.recordEvidence(L1, CAT, 'm1', { ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'x' }, T0, pol, { id: 'a' });
  const L2 = fresh(); E.recordEvidence(L2, CAT, 'm1', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'x' }, T0, pol, { id: 'a' }); E.recordEvidence(L2, CAT, 'm1', { ok: true, kind: 'free', help: 'none', ctx: 'retry', item: 'y' }, T0 + 60000, pol, { id: 'a' });
  ok(L1.c.m1.st === 3, 'delayed independent success advances (2→3)'); ok(L2.c.m1.st === 1, 'fail then immediate correction does not restore stage');
  const L3 = fresh(); for (let i = 0; i < 6; i++) E.recordEvidence(L3, CAT, 'm1', { ok: false, kind: 'free', help: 'none', ctx: i ? 'retry' : 'first', item: 'z' + i }, T0 + i * 60000, pol, { id: 'a' }); ok(L3.c.m1.st <= 2, 'repeated failure never increases stage');
  const L4 = fresh(); E.recordEvidence(L4, CAT, 'm1', { ok: true, kind: 'free', help: 'hint', ctx: 'first', item: 'x' }, T0, pol, { id: 'a' }); ok(L4.c.m1.st === 2, 'hint success on learned concept does not advance');
  const L5 = fresh(); E.recordEvidence(L5, CAT, 'm1', { ok: true, kind: 'free', help: 'solution', ctx: 'first', item: 'x' }, T0, pol, { id: 'a' }); ok(L5.c.m1.st === 2, 'after solution shown: no advance');
  const L6 = fresh(); L6.c.m1.lastOk = T0 - 0.5 * DAY; E.recordEvidence(L6, CAT, 'm1', { ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'x' }, T0, pol, { id: 'a' }); ok(L6.c.m1.st === 2, 'too-early retrieval does not advance');
  const L7 = E.newLE(); const c7 = E.cstate(L7, 's1'); c7.st = 2; c7.lastOk = T0 - 5 * DAY; c7.n = 4; E.recordEvidence(L7, CAT, 's1', { ok: true, kind: 'mc', k: 4, help: 'none', ctx: 'first', item: 'x' }, T0, pol, { id: 'a' }); ok(L7.c.s1.st === 2, 'MC cannot lift a recall-capable concept past mcMaxStage');
  console.log('A2. bevisvärde'); }
{ const L = E.newLE(); const c = E.cstate(L, 'm2'); c.st = 2; c.n = 4; c.lastOk = T0 - 3 * DAY;
  E.recordEvidence(L, CAT, 'm2', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'q1' }, T0, pol, { id: 'a' }); ok(c.fb && c.fb.s === 'open', 'lapse opens Felboken');
  E.recordEvidence(L, CAT, 'm2', { ok: true, kind: 'free', help: 'none', ctx: 'retry', item: 'q2' }, T0 + 60000, pol, { id: 'a' }); ok(c.fb.s === 'corrected', 'same-session correction → corrected');
  let R = E.recordEvidence(L, CAT, 'm2', { ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'q1' }, T0 + DAY, pol, { id: 'b' }); ok(c.fb.s === 'corrected', 'same question next day does not verify');
  R = E.recordEvidence(L, CAT, 'm2', { ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'q3' }, T0 + 2 * DAY, pol, { id: 'c' }); ok(c.fb.s === 'verified' && R.rewards.includes('COMEBACK'), 'different question on later day → verified + COMEBACK');
  E.recordEvidence(L, CAT, 'm2', { ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'q4' }, T0 + 5 * DAY, pol, { id: 'd' }); ok(c.fb.s === 'resolved', 'second delayed success → resolved');
  E.recordEvidence(L, CAT, 'm2', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'q5' }, T0 + 9 * DAY, pol, { id: 'e' }); ok(c.fb.s === 'open' && c.fb.reopened === 1, 'later failure reopens');
  const L2 = E.newLE(); E.recordEvidence(L2, CAT, 'm3', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'a' }, T0, pol, { id: 'a' }); ok(!L2.c.m3.fb, 'first-day error on new concept is learning, not Felboken');
  E.recordEvidence(L2, CAT, 'm3', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'b' }, T0 + DAY, pol, { id: 'b' }); ok(L2.c.m3.fb && L2.c.m3.fb.s === 'open', 'new concept failing on second day → Felboken');
  const L3 = E.newLE(); const c3 = E.cstate(L3, 'm4'); c3.st = 3; c3.n = 5; c3.lastOk = T0 - 7 * DAY; let cb = 0;
  for (let d = 0; d < 10; d++) { E.recordEvidence(L3, CAT, 'm4', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'f' + d, fast: true }, T0 + d * DAY, pol, { id: 'x' + d }); const r2 = E.recordEvidence(L3, CAT, 'm4', { ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'g' + d }, T0 + d * DAY + DAY / 2, pol, { id: 'y' + d }); cb += r2.rewards.filter(x => x === 'COMEBACK').length; }
  ok(cb <= 2, 'deliberate-fail farming yields ≤2 COMEBACK in 10 days (got ' + cb + ')');
  console.log('A3. Felboken 2.0-regler'); }
{ const r = S.runProfile('B', { days: 12, seed: 3 }); const L = r.L; const ctx = { exams: [], lastSessionAt: 11 * DAY, recentSubjectShare: {}, subjectCount: 3 };
  const a = JSON.stringify(E.planSession(L, CAT, 12 * DAY + 17 * 3600000, ctx, E.POLICIES.younger)); const b = JSON.stringify(E.planSession(JSON.parse(JSON.stringify(L)), CAT, 12 * DAY + 17 * 3600000, ctx, E.POLICIES.younger));
  ok(a === b, 'identical input → identical plan'); const plan = JSON.parse(a); ok(plan.every(s => s.why), 'every slot has a reason');
  const subj = new Set(plan.map(s => CAT[s.cid].subject)); ok(subj.size <= E.POLICIES.younger.maxSubjects, 'younger ≤2 subjects');
  console.log('A4. Kör!-planering deterministisk och förklarbar'); }
{ const r = S.runProfile('H', { days: 10, seed: 5 }); const base = r.log.slice(); const tA = 10 * DAY;
  const extraA = [], extraB = []; let seq = 9000;
  for (let i = 0; i < 40; i++) { const cid = pick(['m1', 'm2', 'g1', 's1']); (i % 2 ? extraB : extraA).push(randEv(cid, tA + i * 3600000, i % 2 ? 'B' : 'A', ++seq)); }
  extraA.push({ cid: 'g1', ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'g1#4', dev: 'A', seq: ++seq, t: tA + 2 * DAY, sess: 'A12', lvl: 1 });
  extraB.push({ cid: 'g1', ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'g1#2', dev: 'B', seq: ++seq, t: tA + 2 * DAY + 3600000, sess: 'B12', lvl: 1 });
  const logA = [...base, ...extraA], logB = [...base, ...extraB];
  const mAB = E.mergeLog(logA, logB), mBA = E.mergeLog(logB, logA), mAA = E.mergeLog(mAB, logA);
  const sAB = st(E.replay(mAB, CAT, pol).c), sBA = st(E.replay(mBA, CAT, pol).c), sAA = st(E.replay(mAA, CAT, pol).c);
  ok(sAB === sBA, 'merge commutative'); ok(sAB === sAA, 'merge idempotent');
  const seqAll = [...base, ...extraA, ...extraB].sort((x, y) => x.t - y.t || (x.dev < y.dev ? -1 : 1) || x.seq - y.seq); ok(sAB === st(E.replay(seqAll, CAT, pol).c), 'merged == sequential history');
  ok(E.replay(mAB, CAT, pol).c.g1.fb.s === 'open', 'later failure on B wins over earlier resolution on A');
  const L = E.newLE(); E.recordEvidence(L, CAT, 'm1', { ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'a' }, T0, pol, { id: 'x' }); const d1 = L.c.m1.due; E.recordEvidence(L, CAT, 'm1', { ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'b' }, T0 - 30 * DAY, pol, { id: 'y' });
  // Granskning H3: motorn räknar med händelsens egen tid; klockan är ett högvattenmärke. Appen bygger om tillståndet i tidsordning när en händelse kommer i otakt.
  ok(L.clock.last === T0, 'clock moved back: the high-water mark does not go backwards'); ok(L.c.m1.st === 1, 'clock rollback cannot farm advancement');
  { const evs = [{ t: T0, dev: 'A', seq: 1, cid: 'm1', ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'a', sess: 's1' }, { t: T0 + 40 * DAY, dev: 'A', seq: 2, cid: 'm1', ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'b', sess: 's2' }];
    for (let d = 1; d <= 6; d++) evs.push({ t: T0 + d * DAY, dev: 'A', seq: 2 + d, cid: 'm1', ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'c' + d, sess: 's' + (2 + d) });
    const live = E.newLE(); let rem = 0; for (const e of evs) rem += E.apply(live, CAT, e, pol).rewards.filter(r => r === 'REMEMBERED').length;
    const replayed = E.replay(evs, CAT, pol);
    ok(rem <= 2, `one session with the clock 40 days ahead cannot farm REMEMBERED on later real days (${rem})`);
    ok(st(E.replay(evs.slice().reverse(), CAT, pol).c) === st(replayed.c), 'replay is order-independent (always in time order)'); }
  console.log('A5. synk: kommutativ, idempotent, = sekventiell historik, klockskydd'); }
{ // A6 (anpassad till produktionens migrering: ett koncept per moment)
  const p = { xp: 1200, gems: 40, streak: 5, skills: { plus20: { att: 40, cor: 36, m: 92, lvl: 3, last: T0 - 2 * DAY }, minus20: { att: 6, cor: 4, m: 55, lvl: 2, last: T0 - DAY }, tal100: { att: 2, cor: 0, m: 0, lvl: 1, last: T0 } }, words: { w1: { box: 4, due: T0 + DAY } }, mistakes: [{ id: 'm_1', cat: 'math', skillId: 'minus20', at: T0 - DAY, q: { text: '13 − 7' } }], badges: ['first'] };
  const cat = { 's:plus20': { id: 's:plus20', subject: 'math', maxLvl: 3, recall: true }, 's:minus20': { id: 's:minus20', subject: 'math', maxLvl: 3, recall: true }, 's:tal100': { id: 's:tal100', subject: 'math', maxLvl: 3, recall: true } };
  const map = { plus20: 's:plus20', minus20: 's:minus20', tal100: 's:tal100' };
  const snap = JSON.stringify(p); const le1 = E.migrateV1(p, cat, map, T0, E.POLICIES.younger); const le2 = E.migrateV1({ ...p, le: le1 }, cat, map, T0 + DAY, E.POLICIES.younger);
  ok(JSON.stringify(p) === snap, 'v1 profile untouched'); ok(le2 === le1, 'migration idempotent (existing le kept)');
  const B = le1.base.c; ok(Object.values(B).every(c => c.st <= 2), 'no migrated concept above stage 2'); ok(B['s:plus20'].st === 2 && B['s:minus20'].st === 1 && B['s:tal100'].st === 0, 'strength buckets');
  ok(B['s:minus20'].fb && B['s:minus20'].fb.s === 'open', 'v1 mistake → open Felboken entry'); ok(p.xp === 1200 && p.gems === 40 && JSON.stringify(p.words) === JSON.stringify({ w1: { box: 4, due: T0 + DAY } }), 'XP, gems, Leitner unchanged');
  ok(E.childLabel(B['s:plus20'], T0, E.POLICIES.younger, le1.base) !== 'Säker', 'migrated strong skill not shown as Säker');
  console.log('A6. migrering: idempotent, v1 orört, max stadium 2, v1-fel → Felboken'); }
{ const r = S.runProfile('E', { seed: 2 }); const back = r.trace.find(t => t.d === 42); ok(back && back.n <= E.POLICIES.middle.maxItems, 'return-after-absence session bounded (' + (back && back.n) + ')');
  const firstRoles = back.lines.slice(0, 2).map(l => l.split(' ')[0]); ok(firstRoles[0] === 'warmup' || firstRoles[0] === 'remember', 'return session starts with warm-up/retrieval');
  const shares = [1, 2, 3, 4, 5].map(seed => { const f = S.runProfile('F', { seed }); const sh = (d) => { const t = f.trace.find(x => x.d === d); const ids = t.lines.map(l => (l.match(/ ([a-z]\d)@/) || [])[1]).filter(Boolean); return ids.filter(id => S.PROFILES.F.examC.includes(id)).length / Math.max(1, ids.length); }; return [sh(3), sh(12)]; });
  const s3 = shares.reduce((a, x) => a + x[0], 0) / 5, s12 = shares.reduce((a, x) => a + x[1], 0) / 5;
  ok(s12 >= 0.65 && s12 > s3, `exam share ≥65 % two days before and above day 3 (${(s3 * 100).toFixed(0)} → ${(s12 * 100).toFixed(0)} %)`);
  console.log('A7. frånvaro och prov'); }
const n3A = checks; console.log(`Del 1: ${n3A} kontroller (Fas 3A-sviten)`);

/* ================= Del 2: Fas 3B ================= */
// B1. kompakt lagring: koda/avkoda utan förlust
{ let okAll = true; for (let i = 0; i < 500; i++) { const cid = pick(Object.keys(CAT)); const e = randEv(cid, T0 + i * 1000, 'dv', i); e.t = Math.round(e.t / 1000) * 1000; e.restart = rnd() < 0.1; const d = E.decodeEv(E.encodeEv(e)); for (const k of ['t', 'dev', 'seq', 'cid', 'ok', 'kind', 'k', 'help', 'ctx', 'item', 'fast', 'sess', 'lvl', 'restart']) if (d[k] !== e[k]) { okAll = false; console.log('roundtrip', k, d[k], e[k]); break; } } ok(okAll, 'encode/decode roundtrip'); }
// B2. live tillämpning == omspelning från logg (samma regler, samma lata kalibrering)
function mkLog(dev, n, t0, seed) { const r = S.rng(seed); const ids = Object.keys(CAT); const out = []; let t = t0; for (let i = 0; i < n; i++) { t += Math.floor(r() * DAY / 3) * 1000 / 1000; t = Math.round(t / 1000) * 1000; const cid = ids[Math.floor(r() * ids.length)]; out.push({ cid, ok: r() < 0.65, kind: CAT[cid].kinds[Math.floor(r() * CAT[cid].kinds.length)], k: 4, help: r() < 0.8 ? 'none' : 'hint', ctx: r() < 0.6 ? 'first' : 'repeat', item: cid + '#' + Math.floor(r() * 6), dev, seq: i + 1, t, sess: dev + Math.floor(t / (DAY / 2)), lvl: 1, fast: r() < 0.1, restart: false }); } return out; }
{ const log = mkLog('A', 600, T0, 77); const live = E.newLE(); for (const e of log) E.apply(live, CAT, e, pol); const rep = E.replay(log.map(E.encodeEv), CAT, pol); ok(st(live) === st(rep), 'live state == replay of stored log'); }
// B3. mergeLE: två enheter, samma migreringsbas → kommutativ, idempotent, = sekventiell historik
const migP = { skills: { plus20: { att: 12, cor: 11, m: 80, lvl: 2, last: T0 - DAY } } };
const mcat = { ...CAT, 's:plus20': { id: 's:plus20', subject: 'matte', maxLvl: 3, recall: true } };
{ const base = E.migrateV1(migP, mcat, { plus20: 's:plus20' }, T0, pol); const la = mkLog('A', 120, T0 + 1000, 1), lb = mkLog('B', 140, T0 + 2000, 2);
  const A = { ...JSON.parse(JSON.stringify(base)), log: la.map(E.encodeEv), seqs: { A: 120 }, shadow: [{ id: 'A:1', t: 1, v1: [], v2: [], a: [], done: 1 }] }, B = { ...JSON.parse(JSON.stringify(base)), log: lb.map(E.encodeEv), seqs: { B: 140 }, shadow: [{ id: 'B:1', t: 2, v1: [], v2: [], a: [], done: 1 }] };
  const AB = E.mergeLE(A, B), BA = E.mergeLE(B, A); ok(st(AB) === st(BA), 'mergeLE commutative'); ok(st(E.mergeLE(AB, A)) === st(AB) && st(E.mergeLE(AB, AB)) === st(AB), 'mergeLE idempotent');
  ok(AB.log.length === 260 && AB.seqs.A === 120 && AB.seqs.B === 140 && AB.shadow.length === 2, 'union of logs, seqs and shadow records');
  const seqAll = [...la, ...lb].sort((x, y) => x.t - y.t || (x.dev < y.dev ? -1 : 1) || x.seq - y.seq);
  ok(st(E.replay(AB.log, mcat, pol, AB.base)) === st(E.replay(seqAll, mcat, pol, base.base)), 'merged le == one-device history');
  // olika migreringsbaser (två enheter migrerade vid olika tid) → tidigaste basen, alla händelser kvar
  const B2 = { ...E.migrateV1(migP, mcat, { plus20: 's:plus20' }, T0 + 3600000, pol), log: lb.map(E.encodeEv) };
  const m1 = E.mergeLE(A, B2), m2 = E.mergeLE(B2, A); ok(m1.t0 === T0 && m2.t0 === T0 && m1.log.length === 260 && st(m1) === st(m2), 'different migration bases → earliest base, no event lost, commutative');
  // gammal klient: profil utan le / med inaktuell le
  ok(E.mergeLE(A, undefined) === A && E.mergeLE(null, A) === A, 'missing le on one side keeps the other');
  const stale = { ...A, log: A.log.slice(0, 30) }; ok(E.mergeLE(stale, AB).log.length === 260, 'stale le (old client overwrite) cannot shrink the log'); }
// B4. kompaktering: lagring begränsad, tillstånd oförändrat
{ const log = mkLog('A', 1200, T0, 9); const base = E.migrateV1(migP, mcat, { plus20: 's:plus20' }, T0 - 1000, pol); const le = { ...base, log: log.map(E.encodeEv) };
  const before = st(E.replay(le.log, mcat, pol, le.base)); const nowT = log[log.length - 1].t + DAY; const did = E.compact(le, mcat, pol, nowT);
  ok(did && le.log.length <= E.LOG_HARD && le.folded > 0 && le.t0 > T0, 'compaction folds old events (log ' + le.log.length + ', folded ' + le.folded + ')');
  ok(st(E.replay(le.log, mcat, pol, le.base)) === before, 'state after compaction == state before');
  // stor historik: 4000 händelser över ~400 dygn, kompaktering efter varje "pass" → begränsad storlek
  const big = { ...E.migrateV1(migP, mcat, { plus20: 's:plus20' }, T0 - 1000, pol) }; const many = mkLog('A', 4000, T0, 4); let maxSize = 0;
  for (let i = 0; i < many.length; i++) { big.log.push(E.encodeEv(many[i])); if (i % 10 === 9) { E.compact(big, mcat, pol, many[i].t); maxSize = Math.max(maxSize, JSON.stringify(big).length); } }
  ok(big.log.length <= E.LOG_HARD && maxSize < 120000, `storage bounded (max ${Math.round(maxSize / 1024)} kB, log ${big.log.length})`);
  // kompakterad enhet + annan enhet med nyare händelser → nyare händelser behålls, kommutativt
  const other = { ...JSON.parse(JSON.stringify(base)), log: mkLog('B', 50, nowT + 1000, 5).map(E.encodeEv) }; const x = E.mergeLE(le, other), y = E.mergeLE(other, le);
  ok(st(x) === st(y) && x.log.filter(e => e[1] === 'B').length === 50 && x.t0 === le.t0, 'compacted base wins; newer events from other device kept'); }
// B5. migrering: deterministisk, utspridda förfallodagar, katalogstyrd
{ const skills = {}; for (let i = 0; i < 14; i++) skills['sk' + i] = { att: 20, cor: 18, m: 85, lvl: 2, last: T0 - 2 * DAY }; skills.unknown = { att: 30, cor: 30, m: 99, lvl: 3, last: T0 };
  const cat = Object.fromEntries(Object.keys(skills).filter(k => k !== 'unknown').map(k => ['s:' + k, { id: 's:' + k, subject: 'math', maxLvl: 3, recall: true }])); const map = Object.fromEntries(Object.keys(skills).map(k => [k, 's:' + k]));
  const a = E.migrateV1({ skills }, cat, map, T0, E.POLICIES.younger), b = E.migrateV1({ skills }, cat, map, T0, E.POLICIES.younger); ok(st(a) === st(b), 'migration deterministic (same input → identical le)');
  ok(!a.base.c['s:unknown'], 'skills without a catalogue concept are not invented');
  const perDay = {}; for (const c of Object.values(a.base.c)) { const d = Math.round((c.due - E.dayStart(T0)) / DAY); perDay[d] = (perDay[d] || 0) + 1; }
  ok(Object.keys(perDay).every(d => d >= 1 && d <= 7) && Object.values(perDay).every(n => n <= 3), 'migrated reviews staggered over days 1–7, ≤3 per day ' + JSON.stringify(perDay)); }
// B6. beslut O-1 … O-9 som byggställning
{ const D = E.DECISIONS; ok(E.POLICIES.younger.intervalMult === 0.8 && E.STAGE_DAYS.join() === '0,1,3,7,14,30,60' && !E.POLICIES.younger.stages, 'O-1: ladder unchanged, ×0.8 for younger');
  ok(D.O2_verifiedDays === 7, 'O-2: verified shown 7 days'); ok(E.POLICIES.younger.mcMaxStage === 2 && D.O4_mcMaxStageYounger === 2, 'O-4: MC to stage 2 for younger');
  ok(D.O7_shadowExit.minDays === 14 && D.O7_shadowExit.needAllProfiles === true, 'O-7: exit needs ≥14 days AND evidence for all profiles');
  ok(D.O8_felbokDisplay.younger === 3 && D.O8_felbokDisplay.middle === 5 && D.O8_felbokDisplay.older === 5, 'O-8: 3/5/5');
  ok(D.K12_fast.calibration === false && D.K12_fast.stage === false, 'K-12: fast flag not used for calibration or stage');
  ok(D.accuracyBand[0] === 0.7 && D.accuracyBand[1] === 0.85, 'accuracy band recorded as diagnostic band');
  const L = E.newLE(); for (let i = 0; i < 9; i++) { const c = E.cstate(L, 'x' + i); c.n = 3; c.fb = { s: i % 3 ? 'open' : 'corrected', at: T0 + i, wd: 1, items: [] }; }
  const dy = E.felbokDisplay(L, E.POLICIES.younger), dm = E.felbokDisplay(L, E.POLICIES.middle); ok(dy.shown.length === 3 && dy.more === 6 && dm.shown.length === 5 && dm.more === 4, 'O-8: display cap with "fler väntar"');
  const L2 = E.newLE(); const v = E.cstate(L2, 'v'); v.fb = { s: 'verified', vd: E.dayIdx(T0) - 3 }; const o = E.cstate(L2, 'o'); o.fb = { s: 'resolved', rd: E.dayIdx(T0) - 9 };
  ok(E.felbokRecentWins(L2, T0).join() === 'v', 'O-2: only wins from the last 7 days');
  const thin = E.newConcept(); thin.n = 2; const good = E.newConcept(); good.n = 6; good.st = 3; const meh = E.newConcept(); meh.n = 6; meh.st = 1; const fbc = E.newConcept(); fbc.n = 6; fbc.st = 4; fbc.fb = { s: 'open' };
  ok(E.readiness(thin, T0) === 'För lite underlag' && E.readiness(good, T0) === 'Bra koll' && E.readiness(meh, T0) === 'Öva lite mer' && E.readiness(fbc, T0) === 'Öva lite mer', 'O-5: readiness buckets, no grades'); }
// B7. K-12: snabb-flaggan ändrar inte stadium, nivå, förfallodag eller kalibrering
{ const log = mkLog('A', 400, T0, 21); const noFast = log.map(e => ({ ...e, fast: false })), allFast = log.map(e => ({ ...e, fast: !e.ok }));
  const a = E.replay(noFast, CAT, pol), b = E.replay(allFast, CAT, pol); const core = (L) => st({ iv: L.ivMult, rs: L.rs, c: Object.fromEntries(Object.entries(L.c).map(([k, c]) => [k, [c.st, c.lvl, c.due, c.lap]])) });
  ok(core(a) === core(b), 'fast flag does not change stage/level/due/calibration'); ok(b.d.fastWrong > 0 && a.d.fastWrong === 0, 'fast errors are only counted (diagnostic)'); }
// B8. glosor som planeringskoncept: följer Leitner, får aldrig stadium
{ const cat = { 'd:es': { id: 'd:es', kind: 'deck', subject: 'lang' }, 's:a': { id: 's:a', kind: 'skill', subject: 'math', recall: true } }; const L = E.newLE();
  const p1 = E.priority(L, cat, 'd:es', T0, { decks: { 'd:es': { due: 6, nw: 0 } } }, pol); const p2 = E.priority(L, cat, 'd:es', T0, { decks: { 'd:es': { due: 0, nw: 5 } } }, pol); const p3 = E.priority(L, cat, 'd:es', T0, { decks: {} }, pol);
  ok(p1.why === 'due' && p2.why === 'new' && p3.P === 0, 'deck priority from Leitner due/new words');
  const plan = E.planSession(L, cat, T0, { decks: { 'd:es': { due: 6, nw: 0 } }, subjectCount: 2 }, E.POLICIES.younger, { n: 6 }); ok(plan.length <= 6 && plan.some(s => s.cid === 'd:es'), 'deck concepts appear in v2 plans'); ok(!L.c['d:es'], 'planning never creates deck stage state'); }
// B9. motorns källkod: ingen slump, ingen klocka, inga appglobaler
{ const src = (fs.readFileSync(path.join(__dirname, '../src/05b_engine2.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '../src/05a_concepts.js'), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/ \/\/ .*$/gm, '');
  ok(!/Math\.random|Date\.now|localStorage|document\.|window\.|fetch\(/.test(src), 'engine + catalogue are pure (no randomness, clock, storage, DOM or network)');
  ok(LECAT.itemId({ type: 'num', text: '7 + 5 = ?' }) === LECAT.itemId({ type: 'num', text: '7  + 5 = ?' }) && LECAT.itemId({ type: 'num', text: '7 + 5 = ?' }) !== LECAT.itemId({ type: 'num', text: '7 + 6 = ?' }), 'item ids stable and distinct'); }
// B10. dygnsgränser i lokal tid (Europe/Stockholm) – förfallodagar hamnar på lokal midnatt
{ const { execFileSync } = require('child_process'); const out = execFileSync(process.execPath, ['-e', `const E=require(${JSON.stringify(path.join(__dirname, '../src/05b_engine2.js'))}); const t=Date.UTC(2026,9,24,22,30); const d=new Date(E.dayStart(t)); console.log(d.getHours()+':'+d.getMinutes()+' '+d.getDate())`], { env: { ...process.env, TZ: 'Europe/Stockholm' } }).toString().trim();
  ok(out === '0:0 25', 'local-midnight day boundary in Europe/Stockholm (got ' + out + ')'); }

const n3B = checks; console.log(`Del 2: ${checks - n3A} kontroller (Fas 3B)`);

/* ================= Del 3: Fas 3C–3H (regler) ================= */
const LER = require('../src/05e_runner.js');
const fresh2 = (cid, st, extra = {}) => { const L = E.newLE(); const c = E.cstate(L, cid); Object.assign(c, { st, n: 5, lastOk: T0 - 10 * DAY, due: T0 - DAY, lvl: 2 }, extra); return L; };
// C1. Felboken 2.0: Testa mig-fel → "väntar" (syns först nästa dygn), mjuk sänkning; utgång efter 30 dygn
{ const L = fresh2('m1', 4); E.recordEvidence(L, CAT, 'm1', { ok: false, kind: 'free', help: 'none', ctx: 'exam', item: 'q' }, T0, pol, { id: 't' });
  ok(L.c.m1.fb.s === 'awaiting' && L.c.m1.st === 3, 'Testa mig failure → awaiting + one-stage drop (does not overwrite long-term evidence)');
  ok(E.felbokVisible(L, T0).length === 0 && E.felbokVisible(L, T0 + DAY).length === 1, 'awaiting entry hidden the same day, visible next day');
  ok(E.felbokVisible(L, T0 + 32 * DAY).length === 0, 'untouched Felboken entry expires from the list after 30 days');
  ok(E.priority(L, CAT, 'm1', T0 + 32 * DAY, {}, pol).parts.fb == null && L.c.m1.st === 3, 'expired entry: no Felboken priority, concept stays in normal scheduling'); }
// C2. Faser
{ const L = E.newLE(); ok(E.phase(L.c.x, T0, pol, L) === 'new', 'phase new'); const c = E.cstate(L, 'm1'); c.n = 3; c.st = 4; c.due = T0 + DAY; ok(E.phase(c, T0, pol, L) === 'stable', 'phase stable'); c.due = T0 - 30 * DAY; ok(E.phase(c, T0, pol, L) === 'weakening', 'phase weakening');
  c.fb = { s: 'open', wd: E.dayIdx(T0), reopened: 1 }; ok(E.phase(c, T0, pol, L) === 'reopened', 'phase reopened'); c.fb = { s: 'corrected', wd: E.dayIdx(T0) - 1 }; ok(E.phase(c, T0, pol, L) === 'awaiting', 'phase awaiting delayed verification'); ok(E.PHASES.length >= 9, 'phase list'); }
// C3. LÄR förbrukas av det stöttade försöket (rollkod L) och visas högst var 3:e dygn
{ const L = E.newLE(); const c = E.cstate(L, 'm3'); c.n = 3; c.failDays = [E.dayIdx(T0) - 1]; E.recordEvidence(L, CAT, 'm3', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'a' }, T0, pol, { id: 's1' }); ok(c.teach === 1, 'LÄR flag after failures on two days');
  E.recordEvidence(L, CAT, 'm3', { ok: true, kind: 'free', help: 'hint', ctx: 'first', item: 'b', role: 'L' }, T0 + 60000, pol, { id: 's1' }); ok(c.teach === 0 && c.taughtDay === E.dayIdx(T0), 'LÄR consumed by the supported follow-up');
  E.recordEvidence(L, CAT, 'm3', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'c' }, T0 + DAY, pol, { id: 's2' }); ok(c.teach === 0, 'not re-flagged within 3 days'); }
// C4. Adaptiv svårighet: variation krävs; ett fel sänker inte; ingen pendling samma dygn
{ const L = fresh2('m1', 2); for (let i = 0; i < 3; i++) E.recordEvidence(L, CAT, 'm1', { ok: true, kind: 'free', help: 'none', ctx: i ? 'repeat' : 'first', item: 'same' }, T0 + i * 60000, pol, { id: 'a' + i }); ok(L.c.m1.lvl === 2, 'same item three times → no level up (variety required)');
  const L2 = fresh2('m1', 2); for (let i = 0; i < 3; i++) E.recordEvidence(L2, CAT, 'm1', { ok: true, kind: 'free', help: 'none', ctx: i ? 'repeat' : 'first', item: 'v' + i }, T0 + i * 60000, pol, { id: 'b' + i }); ok(L2.c.m1.lvl === 3, 'three varied independent successes → level up');
  E.recordEvidence(L2, CAT, 'm1', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'w' }, T0 + 4 * 60000, pol, { id: 'c1' }); E.recordEvidence(L2, CAT, 'm1', { ok: false, kind: 'free', help: 'none', ctx: 'repeat', item: 'x' }, T0 + 5 * 60000, pol, { id: 'c2' }); ok(L2.c.m1.lvl === 3, 'no level down on the same day as a level up (anti-oscillation)');
  const L3 = fresh2('m1', 2, { lvl: 2 }); E.recordEvidence(L3, CAT, 'm1', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'a' }, T0, pol, { id: 'd1' }); ok(L3.c.m1.lvl === 2, 'single failure never drops difficulty');
  E.recordEvidence(L3, CAT, 'm1', { ok: false, kind: 'free', help: 'none', ctx: 'retry', item: 'b' }, T0 + 60000, pol, { id: 'd1' }); ok(L3.c.m1.lvl === 2, 'retry failures do not count toward a level drop');
  const L4 = fresh2('s1', 2, { kf: 1 }); for (let i = 0; i < 4; i++) E.recordEvidence(L4, CAT, 's1', { ok: true, kind: 'mc', k: 4, help: 'none', ctx: i ? 'repeat' : 'first', item: 'm' + i }, T0 + i * 60000, pol, { id: 'e' + i }); ok(L4.c.s1.lvl === 2, 'recognition (MC) success does not raise difficulty once recall is required'); }
// C5. Utmaning: skild från grundkunskap; fel sänker aldrig; bakåtkompatibel lagring
{ const L = fresh2('m1', 4); const before = E.stable({ st: L.c.m1.st, due: L.c.m1.due, lvl: L.c.m1.lvl, fb: L.c.m1.fb });
  for (let i = 0; i < 5; i++) E.recordEvidence(L, CAT, 'm1', { ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'ch' + i, mode: 'challenge' }, T0 + i * 60000, pol, { id: 'x' });
  ok(E.stable({ st: L.c.m1.st, due: L.c.m1.due, lvl: L.c.m1.lvl, fb: L.c.m1.fb }) === before && L.c.m1.ch.n === 5, 'Challenge failures never touch stage, due, level or Felboken');
  const R = E.recordEvidence(L, CAT, 'm1', { ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'ch9', mode: 'challenge' }, T0 + DAY, pol, { id: 'y' }); ok(R.rewards.includes('CHALLENGE') && L.c.m1.ch.ok === 1, 'Challenge success → CHALLENGE + depth evidence');
  const enc = E.encodeEv({ t: T0, dev: 'd', seq: 1, cid: 'm1', ok: false, kind: 'free', help: 'none', ctx: 'first', item: 'q', mode: 'challenge', role: 'C', sess: 's', lvl: 3 });
  ok(enc[7] === 'r' && enc[8] === 'r', 'legacy fields of a Challenge event = supported retry (harmless for older versions)');
  const old = fresh2('m1', 4); const oldBefore = old.c.m1.st; E.apply(old, CAT, E.decodeEv(enc.slice(0, 14)), pol); ok(old.c.m1.st === oldBefore && !old.c.m1.fb, 'a 3B-format reader treats it as supported retry: no drop, no Felboken');
  const back = E.decodeEv(enc); ok(back.mode === 'challenge' && back.help === 'none' && back.role === 'C', 'new reader restores Challenge semantics'); }
// C6. Belöningar en gång (omstart, två enheter efter synk)
{ const le = { v: 2, log: [], rw: [] }; ok(E.rewardOnce(le, 'FOCUS:100') && !E.rewardOnce(le, 'FOCUS:100'), 'same reward key only once');
  const a = { v: 2, base: {}, t0: 0, log: [], rw: ['FOCUS:100'] }, b = { v: 2, base: {}, t0: 0, log: [], rw: ['COMEBACK:m1:100'] }; const m = E.mergeLE(a, b); ok(m.rw.length === 2 && E.stable(E.mergeLE(b, a).rw) === E.stable(m.rw), 'reward markers merge as a union (commutative)'); }
// Regression (egen granskning): markörer gallrades förut på ANTAL (60, lexikografiskt) → en veckomarkör kunde falla bort mitt i veckan
// när många REM-markörer tillkom, och samma belöning kunde ges igen. Nu: gallring på ålder (21 dygn från nyaste markören), MA behålls.
{ const le = { v: 2, log: [], rw: [] }; ok(E.rewardOnce(le, 'CO:2000') && E.rewardOnce(le, 'FO:2001') && E.rewardOnce(le, 'MA:s:x'), 'week, day and mastery markers set');
  for (let d = 2001; d <= 2006; d++) for (let c = 0; c < 40; c++) E.rewardOnce(le, `REM:${d}:s:c${c}`);
  ok(!E.rewardOnce(le, 'CO:2000') && !E.rewardOnce(le, 'FO:2001') && !E.rewardOnce(le, 'MA:s:x'), 'after 240 newer markers the week/day/mastery markers still block a second award');
  for (let d = 2007; d <= 2030; d++) E.rewardOnce(le, `FO:${d}`);
  ok(!le.rw.includes('CO:2000') && le.rw.includes('MA:s:x') && le.rw.length <= E.RW_MAX, 'markers older than 21 days are pruned; mastery markers are kept; size bounded');
  ok(!E.rewardOnce(le, 'FO:2001', 2030), 'a marker older than the window is never awarded again (offline device with an old clock)');
  // verifiering: en enhet med klockan 60 dygn fram får inte blockera riktiga dagars belöningar
  { const f = { v: 2, log: [], rw: [] }; ok(E.rewardOnce(f, 'FO:2090', 2090), 'future-clock session sets a far-future marker');
    ok(E.rewardOnce(f, 'FO:2030', 2030) && E.rewardOnce(f, 'REM:2030:s:a', 2030), 'back on the real clock: today\'s rewards still work (no 60-day lockout)');
    ok(!f.rw.includes('FO:2090'), 'the far-future marker is pruned on the real day'); }
  const a = { v: 2, base: {}, t0: 0, log: [], rw: le.rw.slice(0, 10) }, b = { v: 2, base: {}, t0: 0, log: [], rw: le.rw.slice(5) };
  ok(E.stable(E.mergeLE(a, b).rw) === E.stable(E.mergeLE(b, a).rw) && E.mergeLE(a, b).rw.length === le.rw.length, 'pruned merge is commutative and loses nothing still valid'); }
// C7. Planering: nytt får plats först, väntat-länge garanteras, provets sista dygn, ämnesrättvisa, ingen utfyllnad med lågt värde
{ const cat = {}; for (let i = 1; i <= 12; i++) cat['a' + i] = { id: 'a' + i, subject: 'math', recall: true, maxLvl: 3 }; for (let i = 1; i <= 4; i++) cat['b' + i] = { id: 'b' + i, subject: 'sv', recall: true, maxLvl: 2 };
  const L = E.newLE(); for (let i = 1; i <= 12; i++) { const c = E.cstate(L, 'a' + i); Object.assign(c, { n: 4, st: 1, due: T0 - (i * 2) * DAY, lastSeen: T0 - DAY, lastOk: T0 - 3 * DAY, ev: [[0, 1, 'f', 'n', 'f']] }); } L.clock.last = T0; L.sessN = 20; L.newSess = 0;
  const plan = E.planSession(L, cat, T0, { subjectCount: 2 }, E.POLICIES.middle, { n: 8 });
  ok(plan.some(s => s.cid.startsWith('b') && s.parts.new > 0), 'starved new learning gets a slot even with a heavy backlog');
  ok(plan.some(s => s.parts.stale > 0) && plan.filter(s => s.parts.stale > 0).map(s => s.cid).includes('a12'), 'the longest-waiting weak concept is in the session');
  ok(plan.length <= 8 && plan.every(s => s.role !== 'practice' || s.parts.due || s.parts.weak), 'no low-value padding');
  const roles = plan.map(s => s.role); const order = ['warmup', 'remember', 'revansch', 'focus', 'practice', 'challenge', 'boss']; ok(roles.every((r, i) => i === 0 || order.indexOf(r) >= order.indexOf(roles[i - 1])), 'session follows the arc warm-up → remember → revansch → focus → boss');
  const ex = [{ at: T0 + 2 * DAY, concepts: ['a1', 'a2', 'a3'] }]; const pe = E.planSession(L, cat, T0, { subjectCount: 2, exams: ex }, E.POLICIES.middle, { n: 8 });
  ok(pe.filter(s => ex[0].concepts.includes(s.cid)).length >= Math.ceil(7 * 0.5), 'last three exam days: at least half the session on exam concepts');
  ok(new Set(pe.filter(s => s.parts.new > 0).map(s => s.cid)).size <= 1, 'two days before an exam: at most one new concept, and only because learning was starved');
  const L1 = JSON.parse(JSON.stringify(L)); L1.newSess = L1.sessN; ok(!E.planSession(L1, cat, T0, { subjectCount: 2, exams: ex }, E.POLICIES.middle, { n: 8 }).some(s => s.parts.new > 0), 'two days before an exam and not starved: no new concepts');
  const L2 = JSON.parse(JSON.stringify(L)); for (const id of ['b1', 'b2']) Object.assign(E.cstate(L2, id), { n: 4, st: 2, due: T0 - 2 * DAY, lastSeen: T0 - 9 * DAY, lastOk: T0 - 9 * DAY, ev: [[0, 1, 'f', 'n', 'f']] });
  const pf = E.planSession(L2, cat, T0, { subjectCount: 2 }, E.POLICIES.younger, { n: 6 }); ok(pf.some(s => s.cid.startsWith('b')), 'subject fairness: a subject with due work unpractised for a week gets into the session');
  ok(E.stable(E.planSession(L2, cat, T0, { subjectCount: 2 }, E.POLICIES.younger, { n: 6 })) === E.stable(pf), 'planning stays deterministic'); }
// C8. Passkörare: Rescue-sekvens per policy, max två per pass, uppskjutning, Testa mig utan Rescue
{ const cat = { m1: { id: 'm1', subject: 'math', recall: true, maxLvl: 3 }, m2: { id: 'm2', subject: 'math', recall: true, maxLvl: 3 } }; const L = E.newLE(); Object.assign(E.cstate(L, 'm1'), { n: 3, st: 1, lvl: 2 }); Object.assign(E.cstate(L, 'm2'), { n: 3, st: 2, lvl: 2 });
  for (const [pn, len] of [['younger', 4], ['middle', 3], ['older', 2]]) { const R = LER.create(L, cat, [{ cid: 'm1', role: 'focus' }, { cid: 'm1', role: 'focus' }, { cid: 'm2', role: 'remember' }], E.POLICIES[pn]);
    let s = LER.peek(R, L); LER.answered(R, L, s, false); s = LER.peek(R, L); const ev = LER.answered(R, L, s, false); ok(ev.some(e => e.type === 'rescue'), pn + ': Rescue after two failures on the same concept');
    const seq = R.queue.slice(R.i).filter(x => x.role === 'rescue'); ok(seq.length === len && seq[0].mode === 'teach', `${pn}: Rescue sequence of ${len} starting with an explanation`);
    ok(seq.filter(x => x.mode !== 'teach').every(x => x.ctx === 'retry'), pn + ': Rescue attempts are retry evidence (never durable mastery)'); }
  const R2 = LER.create(L, cat, [{ cid: 'm1', role: 'focus' }, { cid: 'm1', role: 'focus' }], E.POLICIES.older); let s = LER.peek(R2, L); LER.answered(R2, L, s, false); s = LER.peek(R2, L); LER.answered(R2, L, s, false);
  for (let g = 0; g < 6; g++) { s = LER.peek(R2, L); if (!s) break; const evs = LER.answered(R2, L, s, false); if (evs.some(e => e.type === 'defer')) { ok(!R2.queue.slice(R2.i).some(x => x.cid === 'm1'), 'failure after Rescue defers the concept (no endless loop)'); break; } }
  const R3 = LER.create(L, cat, [{ cid: 'm1', role: 'focus' }, { cid: 'm1', role: 'focus' }, { cid: 'm1', role: 'focus' }], E.POLICIES.middle, { mode: 'exam' }); let n3 = 0; for (let g = 0; g < 10; g++) { const x = LER.peek(R3, L); if (!x) break; ok(x.help === 'none' && x.ctx === 'exam', 'Testa mig: no hints, exam context'); LER.answered(R3, L, x, false); n3++; } ok(n3 === 3, 'Testa mig: no retries or Rescue inserted'); }
/* ---------- Regressionstester för fynd i den oberoende granskningen ---------- */
const evq = (cid, ok, t, seq, extra = {}) => ({ cid, ok, kind: 'free', k: 0, help: 'none', ctx: 'first', item: cid + '#' + seq, dev: 'R', seq, t, sess: 'R:' + Math.floor(t / DAY), lvl: 1, ...extra });
// M4: Testa mig sänker ett koncept högst en gång per dygn
{ const L = E.newLE(); const c = E.cstate(L, 'm1'); c.st = 4; c.n = 6; c.lastOk = T0 - 10 * DAY; c.due = T0;
  E.apply(L, CAT, evq('m1', false, T0, 1, { ctx: 'exam', mode: 'testa' }), pol); E.apply(L, CAT, evq('m1', false, T0 + 1000, 2, { ctx: 'exam', mode: 'testa' }), pol); E.apply(L, CAT, evq('m1', false, T0 + 60000, 3, { ctx: 'exam', mode: 'testa', sess: 'R:x' }), pol);
  ok(L.c.m1.st === 3, `M4: två fel på samma koncept i Testa mig (och en omkörning samma dygn) sänker bara ett steg (4 → ${L.c.m1.st})`); }
// M8: provkvällen – inga osedda koncept i planen
{ const L = E.newLE(); const cat = {}; for (let i = 0; i < 8; i++) cat['x' + i] = { id: 'x' + i, kind: 'skill', subject: 'math', maxLvl: 3, prereq: [] };
  for (let i = 0; i < 2; i++) { const c = E.cstate(L, 'x' + i); c.st = 1; c.n = 2; c.lastOk = T0 - 2 * DAY; c.due = T0; }
  const plan = E.planSession(L, cat, T0, { exams: [{ at: T0 + DAY - 3600000, concepts: Object.keys(cat) }], subjectCount: 1 }, pol, { n: 8 });
  ok(plan.maxNew === 0 && plan.every(s => L.c[s.cid] && L.c[s.cid].n > 0), `M8: provkvällen (maxNew 0) planeras inga osedda koncept (${plan.map(s => s.cid).join(',')})`); }
// M9: sammanslagning blandar aldrig versioner
{ const v2 = { v: 2, base: E.newLE(), t0: 0, log: [E.encodeEv(evq('m1', true, T0, 1))] }, v3 = { v: 3, future: { x: 1 }, log: 'annat format' };
  ok(E.mergeLE(v2, v3) === v3 && E.mergeLE(v3, v2) === v3 && v3.log === 'annat format', 'M9: v2 + okänd v3 → v3 lämnas orörd, i båda ordningarna'); }
// M10 (verifieringen): vattenmärkesförsöket gav dataförlust och dubbelräkning → återställt till tidsgränsen. Kontrollera att packning +
// sammanslagning varken tappar eller dubbelräknar – även med en dokumentkopia utan nya fält (som en 1.2.0-enhet skriver).
{ const mk = () => { const A = { v: 2, ev: 2, base: E.newLE(), t0: 0, folded: 0, log: [], seqs: {} };
    for (let i = 1; i <= 360; i++) A.log.push(E.encodeEv({ ...evq('m' + (1 + i % 3), i % 4 > 0, T0 + i * 3600000, i), dev: 'A' })); return A; };
  const full = mk(); const truth = st(E.replay(full.log, CAT, pol).c);
  const A = mk(); ok(E.compact(A, CAT, pol, T0 + 40 * DAY) && A.folded > 0, 'packing folds old events');
  ok(st(E.replay(A.log, CAT, pol, A.base).c) === truth, 'packed state = full history');
  const self = E.mergeLE(A, JSON.parse(JSON.stringify(A))); ok(self.log.length === A.log.length && st(E.replay(self.log, CAT, pol, self.base).c) === truth, 'merging a packed document with itself loses nothing');
  const stale = mk(); const m1 = E.mergeLE(A, stale), m2 = E.mergeLE(stale, A);
  ok(st(E.replay(m1.log, CAT, pol, m1.base).c) === truth && st(m1) === st(m2), 'packed + unpacked copy (old device): no double counting, order-independent');
  // framtidsstämplade händelser (klocka fram) följt av riktiga: packning + självsammanslagning behåller allt
  const F = { v: 2, ev: 2, base: E.newLE(), t0: 0, folded: 0, log: [], seqs: {} }; for (let i = 1; i <= 3; i++) F.log.push(E.encodeEv({ ...evq('m3', true, T0 + 90 * DAY + i * 1000, i), dev: 'T' }));
  for (let i = 4; i <= 340; i++) F.log.push(E.encodeEv({ ...evq('m' + (1 + i % 2), true, T0 + i * 3600000, i), dev: 'T' }));
  const fTruth = st(E.replay(F.log, CAT, pol).c); E.compact(F, CAT, pol, T0 + 40 * DAY); const fm = E.mergeLE(F, JSON.parse(JSON.stringify(F)));
  ok(st(E.replay(fm.log, CAT, pol, fm.base).c) === fTruth && fm.log.filter(e => e[3] === 'm3').length === 3, 'future-stamped events survive packing + merge (verification repro)'); }
// L5: utgångna Felboken-poster räknas inte i beredskap, last eller insikter
{ const L = E.newLE(); const c = E.cstate(L, 'm1'); c.st = 3; c.n = 8; c.lastOk = T0 - 40 * DAY; c.due = T0 + 5 * DAY; c.fb = { s: 'open', at: T0 - 45 * DAY, wd: E.dayIdx(T0 - 45 * DAY), wrong: 1, items: [] };
  ok(E.readiness(c, T0) !== 'Öva lite mer' && E.learningLoad(L, CAT, T0) === 0 && !E.felbokVisible(L, T0).length, 'L5: en Felboken-post äldre än 30 dygn räknas inte någonstans'); }
// L7: "bara samma fråga finns" sparas i bevisloggen och överlever omspelning
{ const e = evq('m1', true, T0, 1, { onlyVariant: true, mode: 'readclose' }); const d = E.decodeEv(E.encodeEv(e)); ok(d.onlyVariant === true && d.mode === 'readclose', 'L7: onlyVariant och läge kodas och avkodas');
  const d2 = E.decodeEv(E.encodeEv(evq('m1', true, T0, 2, { onlyVariant: true }))); ok(d2.onlyVariant === true, 'L7: onlyVariant utan läge kodas också'); }
// 3I.3 (Experience v3, FLOW): ett flervalskoncept (inget eget svar finns) kräver två fördröjda träffar – från två OLIKA dygn.
// Reproducerat före rättningen: Kör! kl 9 + ett extrapass kl 10 samma dag höjde stadiet 2 → 3.
{ const CATM = { q: { id: 'q', subject: 'no', kind: 'skill', recall: false, kinds: ['mc'], maxLvl: 3 } }; const T9 = 100 * DAY + 9 * 3600000;
  const mk = () => { const L = E.newLE(); const c = E.cstate(L, 'q'); c.st = 2; c.n = 5; c.lastOk = T9 - 10 * DAY; c.due = T9; return L; };
  const hit = (L, t, s) => E.recordEvidence(L, CATM, 'q', { ok: true, kind: 'mc', k: 4, help: 'none', ctx: 'first', item: 'i' + t }, t, pol, { id: s });
  const L1 = mk(); hit(L1, T9, 'a'); hit(L1, T9 + 3600000, 'b'); ok(L1.c.q.st === 2 && L1.c.q.mcOk === 1, '3I.3: två flervalsträffar samma dygn höjer inte stadiet');
  hit(L1, T9 + DAY, 'c'); ok(L1.c.q.st === 3 && !L1.c.q.mcOk && L1.c.q.mcd === undefined, '3I.3: andra träffen nästa dygn höjer (2 → 3)');
  const L2 = mk(); hit(L2, T9, 'a'); hit(L2, T9 + DAY, 'b'); ok(L2.c.q.st === 3, '3I.3: ett pass per dag ger samma resultat som före rättningen');
  const L3 = mk(); L3.c.q.mcOk = 1; hit(L3, T9, 'a'); ok(L3.c.q.st === 3, '3I.3: gammalt tillstånd utan dygnsmarkering behandlas som förut'); }
console.log(`Del 3: ${checks - n3B} kontroller (Fas 3C–3H)`);
console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE ENGINE TEST FAILED' : 'LE ENGINE TEST OK'); process.exit(fails ? 1 : 0);
