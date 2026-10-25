/* Lång säsongssimulering (Fas 3C–3H). SYNTETISKA elever – inga riktiga barndata. Kör PRODUKTIONENS motor (05b) och passkörare (05e).
   Elevmodell (förenklad, ärligt märkt): per koncept förståelse k och minnesstabilitet S; sannolikhet att minnas efter Δ dygn = k·e^(−Δ/(S·mem·(0.4+k))).
   Fördröjd självständig hämtning ökar S kraftigt, upprepning samma dag nästan inte. Flerval kan gissas. Resultaten visar hur motorn BETER sig
   under antaganden – de bevisar inte att riktiga barn lär sig mer. */
'use strict';
process.env.TZ = 'UTC';
const E = require('../../src/05b_engine2.js'); const LER = require('../../src/05e_runner.js'); const { DAY } = E;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Syntetisk katalog: 4 ämnen, 28 koncept (eller fler i stresstestet "många nya") ---------- */
function makeCat(extra = 0) {
  const CAT = {}; const add = (id, o) => { CAT[id] = { id, kind: 'skill', maxLvl: 3, kinds: ['free'], items: 0, prereq: [], challenge: true, ...o }; };
  const P = { ma2: ['ma1'], ma3: ['ma2'], ma4: ['ma1'], ma5: ['ma4'], ma6: ['ma2', 'ma3'], ma7: ['ma2'], ma9: ['ma5'], ma10: ['ma7'] };
  for (let i = 1; i <= 10; i++) add('ma' + i, { subject: 'math', name: 'Matte ' + i, recall: true, kinds: i % 3 === 0 ? ['free', 'mc'] : ['free'], prereq: P['ma' + i] || [] });
  for (let i = 1; i <= 6; i++) add('sv' + i, { subject: 'sv', name: 'Svenska ' + i, kinds: ['mc', 'free'], maxLvl: 2, items: 8 });
  for (let i = 1; i <= 6; i++) add('no' + i, { subject: 'no', name: 'NO ' + i, kinds: i >= 5 ? ['mc'] : ['mc', 'free'], maxLvl: 2, items: 6 });
  for (let i = 1; i <= 6; i++) add('so' + i, { subject: 'so', name: 'SO ' + i, kinds: i >= 6 ? ['mc'] : ['mc', 'free'], maxLvl: 2, items: 6 });
  for (let i = 1; i <= extra; i++) add('x' + i, { subject: ['math', 'sv', 'no', 'so'][i % 4], name: 'Extra ' + i, kinds: ['mc', 'free'], maxLvl: 2, items: 6 });
  return CAT;
}

/* ---------- Profiler A–M ---------- */
const ALL = ['math', 'sv', 'no', 'so'];
const ex = (day, subj, n = 4) => ({ day, subj, n });
const PROFILES = {
  A: { name: 'Regelbunden', pol: 'middle', subjects: ALL, active: (d, r) => r() < 0.9, extra: 0.25, k0: 0.5, rate: 0.2, slip: 0.04, mcBonus: 0.1, hintUse: 0.15, fast: 0.1, S0: 1.5, exams: [ex(30, 'math'), ex(70, 'no'), ex(105, 'so')], testa: true },
  B: { name: 'Bara inför prov', pol: 'middle', subjects: ALL, active: (d, r, P) => P.exams.some(e => d < e.day && e.day - d <= 6), k0: 0.45, rate: 0.2, slip: 0.04, mcBonus: 0.1, hintUse: 0.15, fast: 0.1, S0: 1.5, exams: [ex(30, 'math'), ex(70, 'no'), ex(105, 'so')], testa: true },
  C: { name: 'Återvänder efter uppehåll', pol: 'middle', subjects: ALL, active: (d, r) => (d < 35 || d >= 70) && r() < 0.9, k0: 0.5, rate: 0.2, slip: 0.04, mcBonus: 0.1, hintUse: 0.15, fast: 0.1, S0: 1.5, exams: [ex(95, 'math')], absence: [35, 69] },
  D: { name: 'Flervalsgissare', pol: 'middle', subjects: ALL, active: (d, r) => r() < 0.85, k0: 0.3, rate: 0.12, slip: 0.03, mcBonus: 0.45, hintUse: 0.1, fast: 0.3, S0: 1, exams: [ex(60, 'so')] },
  E: { name: 'Kämpar', pol: 'younger', subjects: ['math', 'sv'], active: (d, r) => r() < 0.85, k0: 0.15, rate: 0.08, slip: 0.04, mcBonus: 0.05, hintUse: 0.4, fast: 0, S0: 1, hard: { ma3: { k0: 0.02, rate: 0.02 }, ma4: { k0: 0.02, rate: 0.02 } }, exams: [] },
  F: { name: 'Snabb men slarvig', pol: 'middle', subjects: ALL, active: (d, r) => r() < 0.85, k0: 0.75, rate: 0.25, slip: 0.15, mcBonus: 0.1, hintUse: 0.02, fast: 0.6, S0: 2, exams: [ex(50, 'math')] },
  G: { name: 'Säker missuppfattning', pol: 'middle', subjects: ALL, active: (d, r) => r() < 0.85, k0: 0.5, rate: 0.2, slip: 0.04, mcBonus: 0.1, hintUse: 0.1, fast: 0.1, S0: 1.5, misconception: ['ma3', 'sv2'], exams: [ex(60, 'math')] },
  H: { name: 'Avancerad', pol: 'older', subjects: ALL, active: (d, r) => r() < 0.9, extra: 0.3, k0: 0.95, rate: 0.3, slip: 0.02, mcBonus: 0.05, hintUse: 0, fast: 0.2, S0: 6, exams: [ex(60, 'math')] },
  I: { name: 'Noggrann och långsam', pol: 'older', subjects: ALL, active: (d, r) => r() < 0.85, k0: 0.5, rate: 0.2, slip: 0, mcBonus: 0.05, hintUse: 0.3, fast: 0, S0: 1.5, exams: [ex(60, 'no')] },
  J: { name: 'Flera ämnen och prov', pol: 'older', subjects: ALL, active: (d, r) => r() < 0.9, k0: 0.5, rate: 0.2, slip: 0.04, mcBonus: 0.1, hintUse: 0.15, fast: 0.1, S0: 1.5, exams: [ex(40, 'math'), ex(45, 'so'), ex(90, 'no'), ex(95, 'sv')], testa: true },
  K: { name: 'Flera prov tätt', pol: 'middle', subjects: ALL, active: (d, r) => r() < 0.9, k0: 0.5, rate: 0.2, slip: 0.04, mcBonus: 0.1, hintUse: 0.15, fast: 0.1, S0: 1.5, exams: [ex(50, 'math'), ex(53, 'no'), ex(57, 'so')], testa: true },
  L: { name: 'Två enheter offline', pol: 'middle', subjects: ALL, active: (d, r) => r() < 0.9, k0: 0.5, rate: 0.2, slip: 0.04, mcBonus: 0.1, hintUse: 0.15, fast: 0.1, S0: 1.5, exams: [ex(60, 'math')], devices: 2, mergeEvery: 3 },
  M: { name: 'Oregelbunden yngre', pol: 'younger', n: 5, subjects: ['math', 'sv', 'so'], active: (d, r) => r() < 0.45, quit: 0.25, k0: 0.4, rate: 0.18, slip: 0.05, mcBonus: 0.1, hintUse: 0.3, fast: 0.05, S0: 1, exams: [] },
};

function learner(prof, cat, seed, mem) {
  const r = rng(seed); const m = {};
  for (const id of Object.keys(cat)) { const h = (prof.hard || {})[id] || {}; const k = h.k0 ?? prof.k0; m[id] = { k, rate: h.rate ?? prof.rate, S: prof.S0 * (k >= 0.6 ? 3 : 1), last: k >= 0.6 ? -DAY : null, mis: (prof.misconception || []).includes(id) }; }
  return { prof, r, m, mem };
}
const recallP = (Lr, st, now) => st.last == null ? 0 : st.k * Math.exp(-((now - st.last) / DAY) / (st.S * Lr.mem * (0.4 + st.k)));
function answer(Lr, cid, kind, lvl, help, now) {
  const st = Lr.m[cid]; const prof = Lr.prof;
  if (st.mis) return { ok: false, fast: true };   // säker missuppfattning: samma fel, snabbt, tills en förklaring rättar den
  const p0 = recallP(Lr, st, now) * (1 - 0.08 * (lvl - 1));
  let pFree = st.last == null ? st.k * 0.6 : p0;
  if (help === 'hint') pFree = Math.min(1, pFree + 0.25); if (help === 'rescue') pFree = Math.min(1, pFree + 0.35);
  const fast = Lr.r() < prof.fast; pFree *= (1 - prof.slip * (fast ? 1.5 : 0.5));
  // Flerval: antingen minns eleven (som vid eget svar) eller gissar rätt. En lyckad gissning lär inte ut något (3C: realistiskare än 3A-modellen).
  const recalled = Lr.r() < pFree; const guessed = !recalled && kind === 'mc' && Lr.r() < Math.min(0.97, 0.25 + prof.mcBonus);
  const ok = recalled || guessed; const delta = st.last == null ? 99 : (now - st.last) / DAY; const realRecall = recalled && kind !== 'mc' && help === 'none';
  if (guessed) { st.last = now; return { ok, fast: false }; }
  if (ok) { if (realRecall && delta >= 0.5 * st.S) st.S *= 2.2; else if (kind === 'mc' && delta >= 0.5 * st.S) st.S *= 1.35; else st.S *= 1.05; st.k += 0.05 * (1 - st.k); }
  else { st.k += st.rate * (1 - st.k); st.S = Math.max(1, st.S * 0.7); }
  st.last = now; return { ok, fast: fast && !ok };
}
function answerChallenge(Lr, cid, now) { const st = Lr.m[cid]; if (st.mis) return { ok: false, fast: false }; const p = Math.min(0.95, st.k * st.k * (0.5 + 0.5 * recallP(Lr, st, now) / Math.max(0.01, st.k))); return { ok: Lr.r() < p, fast: false }; }
function teach(Lr, cid, strong) { const m = Lr.m[cid]; m.k += m.rate * (strong ? 1.2 : 0.8) * (1 - m.k); if (m.mis && Lr.r() < 0.35) m.mis = false; }

/* ---------- Ett pass med produktionens passkörare ---------- */
function runSession(Lr, dev, L, cat, now, pol, ctx, opts) {
  const plan = opts.plan || E.planSession(L, cat, now, ctx, pol, { n: opts.n, sessionNo: opts.sessionNo });
  const ranked0 = E.rankAll(L, cat, now, ctx, pol); const newAvail = ranked0.some(r => (r.parts.new || 0) > 0);
  const demandList = ranked0.filter(r => ['due', 'fb', 'new', 'weak', 'stale'].some(k => (r.parts[k] || 0) > 0)); const demand = new Set(demandList.map(r => cat[r.cid].subject));
  const demandCount = {}; for (const r of demandList) demandCount[cat[r.cid].subject] = (demandCount[cat[r.cid].subject] || 0) + 1;
  const soonEx = (ctx.exams || []).filter(e => e.at > now && (e.at - now) / DAY <= 7);
  const sessId = dev.id + ':' + Math.round(now / 1000); const Rn = LER.create(L, cat, plan, pol, { sessId, mode: opts.mode });
  let t = now; const rec = { day: opts.day, mode: opts.mode || 'practice', planN: plan.length, light: !!plan.light, restart: !!plan.restart, backlog: E.dueBacklog(L, cat, now), load: E.learningLoad(L, cat, now), roles: {}, subj: {}, planSubj: {}, items: 0, ok: 0, firstOk: 0, first: 0, newItems: 0, rescues: 0, ch: 0, chOk: 0, rewards: [], stageDrops: 0, exam: 0, maxNew: plan.maxNew, demand: [...demand], demandCount, newAvail, examReady: soonEx.length > 0 && soonEx.every(e => E.examReady(L, e)) };
  const seenNew = new Set(); let chCap = 0; const quitAt = opts.quitAt || 99;
  const variant = (cid, ch) => { const c = E.cstate(L, cid); if (ch) return cid + '#ch' + ((c.ch || {}).n || 0); const k = cat[cid].items; if (!k) return cid + '#' + (c.n + 1) + '.' + dev.seq; const avoid = new Set([...(c.fb ? c.fb.items : []), ...c.items.slice(-Math.min(3, k - 1))]); for (let j = 0; j < k; j++) { const it = cid + '#' + ((c.n + j) % k); if (!avoid.has(it)) return it; } return cid + '#' + (c.n % k); };
  for (let guard = 0; guard < 40; guard++) {
    if (rec.items >= quitAt) break;   // barnet stänger appen mitt i passet
    const s = LER.peek(Rn, L); if (!s) break;
    if (s.mode === 'teach') { teach(Lr, s.cid, !s.rescueStep); LER.answered(Rn, L, s, true); continue; }
    const c = E.cstate(L, s.cid); const kinds = cat[s.cid].kinds; const isNew = c.n === 0;
    const kind = s.mode === 'challenge' ? 'free' : kinds.length === 1 ? kinds[0] : s.format === 'recall' ? 'free' : (c.st < pol.mcMaxStage || s.role === 'warmup' || s.role === 'rescue') && kinds.includes('mc') ? 'mc' : 'free';
    let help = s.help || 'none'; if (help === 'none' && opts.mode !== 'exam' && s.role !== 'rescue' && s.mode !== 'challenge' && Lr.r() < Lr.prof.hintUse && recallP(Lr, Lr.m[s.cid], t) < 0.4) help = 'hint';
    const res = s.mode === 'challenge' ? answerChallenge(Lr, s.cid, t) : answer(Lr, s.cid, kind, s.lvl, help, t);
    if (s.role === 'rescue' && s.help === 'rescue') teach(Lr, s.cid, false);
    const ev = { restart: !!plan.restart, cid: s.cid, ok: res.ok, kind, k: 4, help, ctx: s.ctx, item: variant(s.cid, s.mode === 'challenge'), role: s.code, stretch: !!s.stretch, mode: s.mode === 'challenge' ? 'challenge' : opts.mode === 'exam' ? 'testa' : undefined, lvl: s.lvl, fast: res.fast, dev: dev.id, seq: ++dev.seq, t: Math.round(t / 1000) * 1000, sess: sessId };
    dev.log.push(ev); const stBefore = c.st; const R = E.apply(L, cat, ev, pol);
    if (L.c[s.cid].st < stBefore - 1) rec.stageDrops++;
    for (const rw of R.rewards) { if (rw === 'CHALLENGE' && chCap++) continue; rec.rewards.push(rw); }
    const evs = LER.answered(Rn, L, s, res.ok);
    if (!rec.items) rec.firstRole = s.code; rec.items++; if (res.ok) rec.ok++; if (s.ctx === 'first' || s.ctx === 'exam') { rec.first++; if (res.ok && help === 'none') rec.firstOk++; }
    rec.roles[s.code] = (rec.roles[s.code] || 0) + 1; const sj = cat[s.cid].subject; rec.subj[sj] = (rec.subj[sj] || 0) + 1;
    if (s.code !== 'X' && s.code !== 'T') rec.planSubj[sj] = (rec.planSubj[sj] || 0) + 1;   // planerade uppgifter (utan Rescue/omförsök)
    if (isNew && !seenNew.has(s.cid)) { seenNew.add(s.cid); } if (seenNew.has(s.cid)) rec.newItems++;
    if (s.mode === 'challenge') { rec.ch++; if (res.ok) rec.chOk++; }
    if ((opts.examC || []).includes(s.cid)) rec.exam++;
    rec.rescues += evs.filter(e => e.type === 'rescue').length;
    t += 30000;
  }
  // sessionsbaserad väntan: hur många pass i rad har ett svagt förfallet koncept fått vänta? (rättvist även för den som övar sällan)
  const picked = new Set(Rn.log.map(x => x[0])); dev.wait = dev.wait || {};
  for (const [id, x] of Object.entries(L.c)) { if (!cat[id] || x.n === 0) continue; const weakDue = x.st <= 2 && x.due && x.due <= now; if (picked.has(id) || !weakDue) delete dev.wait[id]; else dev.wait[id] = (dev.wait[id] || 0) + 1; }
  rec.weakWaitSessions = Math.max(0, ...Object.values(dev.wait));
  rec.newConcepts = seenNew.size; rec.fbOpen = E.fbOpenCount(L, now); rec.fbVisible = E.felbokDisplay(L, pol, now).shown.length; rec.fbMore = E.felbokDisplay(L, pol, now).more;
  rec.weakWait = Math.max(0, ...Object.entries(L.c).filter(([id, x]) => cat[id] && x.n > 0 && x.st <= 2 && x.due && x.due <= now).map(([, x]) => (now - x.due) / DAY));
  rec.overdueLate = Object.entries(L.c).filter(([id, x]) => cat[id] && x.n > 0 && x.due && now - x.due > E.intervalDays(x.st, pol, L) * DAY).length;
  rec.learned = Object.values(L.c).filter(x => x.n > 0).length;
  return rec;
}

/* ---------- v1-baslinje (förenklad, samma antal uppgifter) ---------- */
function runV1(Lr, V, cat, ids, now, n) {
  let t = now; const pick = () => { const w = ids.map(id => { const s = V[id] || { m: 0, last: 0 }; const stale = Math.min(3, (t - (s.last || 0)) / DAY); return 20 + (100 - s.m) + stale * 10; }); let r = Lr.r() * w.reduce((a, b) => a + b, 0); for (let j = 0; j < ids.length; j++) { r -= w[j]; if (r <= 0) return ids[j]; } return ids[0]; };
  const q = []; for (let j = 0; j < n; j++) q.push(pick());
  for (let j = 0; j < n; j++) { const id = q[j]; const s = V[id] || (V[id] = { m: 0, lvl: 1, streak: 0, wrongRun: 0, last: 0 }); const kind = cat[id].kinds.includes('mc') ? 'mc' : 'free'; const res = answer(Lr, id, kind, s.lvl, 'none', t); s.last = t;
    if (res.ok) { s.m = Math.min(100, s.m + (100 - s.m) * (0.12 + 0.05 * s.lvl)); s.streak++; s.wrongRun = 0; if (s.streak >= 4 && s.m >= 55 && s.lvl < cat[id].maxLvl) { s.lvl++; s.streak = 0; } }
    else { s.m = Math.max(0, s.m - s.m * 0.22 - 3); s.streak = 0; s.wrongRun++; if (s.wrongRun >= 3 && s.lvl > 1) { s.lvl--; s.wrongRun = 0; } if (j + 3 < n) q.splice(j + 3, 0, id); }
    t += 30000; }
}
const surprise = (Lr, T, ids) => ids.reduce((a, id) => a + recallP(Lr, Lr.m[id], T) * (Lr.m[id].mis ? 0 : 1), 0) / Math.max(1, ids.length);

/* ---------- Kör en profil över en säsong ---------- */
function runSeason(key, opts = {}) {
  const prof = { ...PROFILES[key], ...(opts.override || {}) }; const days = opts.days || 120; const seed = opts.seed || 7; const mem = opts.mem || 2;
  const cat0 = makeCat(opts.extraConcepts || 0); const cat = Object.fromEntries(Object.entries(cat0).filter(([, d]) => prof.subjects.includes(d.subject)));
  const ids = Object.keys(cat); const pol = { ...E.POLICIES[prof.pol], ...(opts.polPatch || {}) };
  const Lr = learner(prof, cat, seed, mem), Lr1 = learner(prof, cat, seed, mem); const V = {}; const rS = rng(seed * 31 + 7);
  const nDev = prof.devices || 1; const devs = Array.from({ length: nDev }, (_, i) => ({ id: 'd' + i, seq: 0, log: [], L: E.newLE() }));
  const examsAbs = prof.exams.map((e, i) => ({ at: e.day * DAY + 9 * 3600000, day: e.day, concepts: ids.filter(id => cat[id].subject === e.subj).slice(0, e.n), subj: e.subj, id: 'e' + i }));
  const sessions = []; const examResults = []; let sessionNo = 0; let lastSessionAt = null; const recent = []; const merges = []; const rewardKeys = {};
  for (let d = 0; d < days; d++) {
    // provdagen (morgon): mät provresultatet innan dagens övning
    for (const e of examsAbs.filter(x => x.day === d)) { const s = examsAbs.length ? E.examStatus(devs[0].L, cat, e, e.at - 3600000, pol) : null; examResults.push({ day: d, subj: e.subj, v2: surprise(Lr, e.at, e.concepts), v1: surprise(Lr1, e.at, e.concepts), ready: s && s.good, of: e.concepts.length }); }
    if (!prof.active(d, rS, prof)) continue;
    const dev = devs[nDev === 1 ? 0 : (rS() < 0.5 ? 0 : 1)]; const L = dev.L;
    const runs = 1 + (prof.extra && rS() < prof.extra ? 1 : 0);
    for (let k = 0; k < runs; k++) {
      const now = d * DAY + (16 + 2 * k) * 3600000;
      const fut = examsAbs.filter(e => e.at > now);
      const flat = recent.slice(-2); const tot = flat.reduce((a, o) => a + Object.values(o).reduce((x, y) => x + y, 0), 0) || 1; const share = {}; for (const o of flat) for (const [sj, v] of Object.entries(o)) share[sj] = (share[sj] || 0) + v / tot;
      const ctx = { exams: fut, lastSessionAt, recentSubjectShare: share, subjectCount: prof.subjects.length, dueDoneToday: L.dd && L.dd.d === E.dayIdx(now) ? L.dd.n : 0 };
      const soon = fut.filter(e => (e.at - now) / DAY <= 7); const examC = soon.flatMap(e => e.concepts);
      // Testa mig två dygn före provet (de profiler som använder det), annars vanligt Kör!
      const testaExam = prof.testa && k === 0 && fut.find(e => Math.ceil((e.at - now) / DAY) === 2);
      let rec;
      if (testaExam) { const plan = E.planSession(L, cat, now, ctx, pol, { n: 10, only: testaExam.concepts, challenge: false }); rec = runSession(Lr, dev, L, cat, now, pol, ctx, { plan, mode: 'exam', day: d, examC }); }
      else rec = runSession(Lr, dev, L, cat, now, pol, ctx, { n: prof.n, sessionNo, day: d, examC, quitAt: prof.quit && rS() < prof.quit ? 3 : 99 });
      rec.dev = dev.id; rec.examSoon = soon.length > 0; rec.examDays = fut.length ? Math.ceil((fut[0].at - now) / DAY) : null;
      for (const rw of rec.rewards) { const key = rw + ':' + d; rewardKeys[key] = (rewardKeys[key] || new Set()).add(dev.id); }
      sessions.push(rec); sessionNo++; lastSessionAt = now; recent.push(rec.subj);
      runV1(Lr1, V, cat, ids, now, rec.items || 1);
    }
    // två enheter: synk med jämna mellanrum (union av bevis + omspelning – samma som appen)
    if (nDev > 1 && d % prof.mergeEvery === prof.mergeEvery - 1) {
      const merged = E.mergeLog(devs[0].log, devs[1].log); const Lm = E.replay(merged, cat, pol);
      const before = devs.map(x => E.stable(x.L.c)); for (const x of devs) { x.log = merged.slice(); x.L = JSON.parse(JSON.stringify(Lm)); }
      merges.push({ day: d, events: merged.length, diverged: before[0] !== before[1], equalAfter: E.stable(devs[0].L.c) === E.stable(devs[1].L.c) });
    }
  }
  const L = devs[0].L; const T = days * DAY + 17 * 3600000; const learned = ids.filter(id => L.c[id] && L.c[id].n > 0);
  // "mästrat" just nu = stadium ≥4 och inte försenat mer än ett intervall (motorn visar annars "behöver repetition")
  const pol0 = { ...E.POLICIES[prof.pol], ...(opts.polPatch || {}) };
  const mastered = learned.filter(id => L.c[id].st >= 4 && T <= L.c[id].due + E.intervalDays(L.c[id].st, pol0, L) * DAY); const validMastery = mastered.filter(id => recallP(Lr, Lr.m[id], T) >= 0.5 && !Lr.m[id].mis);
  const ins = E.insights(L, cat, T, pol, { exams: [], daysSinceActive: 0 });
  const dupRewards = Object.entries(rewardKeys).filter(([k, s]) => s.size > 1 && !k.startsWith('REMEMBERED')).length;
  return { key, name: prof.name, pol: prof.pol, prof, cat, ids, L, sessions, examResults, merges, dupRewards, insights: ins,
    end: { v2: { now: surprise(Lr, T, ids), d14: surprise(Lr, T + 14 * DAY, ids), d30: surprise(Lr, T + 30 * DAY, ids) }, v1: { now: surprise(Lr1, T, ids), d14: surprise(Lr1, T + 14 * DAY, ids), d30: surprise(Lr1, T + 30 * DAY, ids) },
      learned: learned.length, of: ids.length, mastered: mastered.length, validMastery: validMastery.length, stages: [0, 1, 2, 3, 4, 5, 6].map(s => learned.filter(id => L.c[id].st === s).length), iv: L.ivMult || 1, misLeft: ids.filter(id => Lr.m[id].mis).length } };
}

/* ---------- Mått över tid och grindar ---------- */
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function metrics(res) {
  const S = res.sessions.filter(s => s.mode !== 'exam'); const pol = E.POLICIES[res.pol];
  const third = (arr, i) => arr.slice(Math.floor(arr.length * i / 3), Math.floor(arr.length * (i + 1) / 3));
  const backlogMid = mean(third(S, 1).map(s => s.backlog)), backlogEnd = mean(third(S, 2).map(s => s.backlog));
  const ratio = (s) => s.learned ? s.backlog / s.learned : 0; const ratioMid = mean(third(S, 1).map(ratio)), ratioEnd = mean(third(S, 2).map(ratio));
  const items = S.reduce((a, s) => a + s.items, 0);
  const roles = {}; for (const s of S) for (const [k, v] of Object.entries(s.roles)) roles[k] = (roles[k] || 0) + v;
  // ny inlärning: luckor (aktiva dagar) mellan pass med nytt, så länge det finns osett innehåll
  // (bara pass där ett NYTT koncept faktiskt var möjligt – förkunskaper på plats)
  let gap = 0, maxGap = 0; for (const s of S) { if (!s.newAvail) { gap = 0; continue; } if (s.newConcepts > 0) gap = 0; else { gap++; maxGap = Math.max(maxGap, gap); } }
  // ämnesdominans: andel av uppgifterna under 7 aktiva pass i rad
  const examDays = new Set(res.prof.exams.flatMap(e => Array.from({ length: 8 }, (_, j) => e.day - j)));
  let domAll = 0; let dom = 0; let domExcess = -1; if (res.prof.subjects.length >= 2) for (let i = 0; i + 14 <= S.length; i++) { const w = S.slice(i, i + 14); const inExam = w.some(s => examDays.has(s.day)) || w.filter(s => s.demand.length >= 2).length < w.length / 2; const by0 = {}; for (const s of w) for (const [k, v] of Object.entries(s.planSubj)) by0[k] = (by0[k] || 0) + v; const tot0 = Object.values(by0).reduce((a, b) => a + b, 0) || 1; domAll = Math.max(domAll, Math.max(...Object.values(by0)) / tot0); if (inExam) continue;
    // jämför med behovet: ett ämne får dominera om det också står för det mesta som behöver övas (t.ex. ett barn som kämpar i matte)
    const top = Object.entries(by0).sort((a, b) => b[1] - a[1])[0][0]; const dc = {}; for (const s of w) for (const [k, v] of Object.entries(s.demandCount || {})) dc[k] = (dc[k] || 0) + v; const dtot = Object.values(dc).reduce((a, b) => a + b, 0) || 1;
    const excess = by0[top] / tot0 - Math.max(0.8, (dc[top] || 0) / dtot + 0.15); dom = Math.max(dom, by0[top] / tot0); domExcess = Math.max(domExcess, excess); }
  const examShare = res.sessions.filter(s => s.mode !== 'exam' && s.examDays != null && s.examDays <= 3 && s.examDays >= 1 && !s.examReady).map(s => s.items ? s.exam / s.items : 0);
  // ämnessvält: hur många pass i rad fick ett ämne som HADE något att öva (förfallet, Felbok, nytt, svagt) noll uppgifter?
  const run = {}; let subjStarve = 0; for (const s of S) for (const sj of res.prof.subjects) { if (s.demand.includes(sj) && !(s.subj[sj] > 0)) { run[sj] = (run[sj] || 0) + 1; subjStarve = Math.max(subjStarve, run[sj]); } else run[sj] = 0; }
  const restart = S.filter(s => s.restart); const firstAcc = S.filter(s => s.first).map(s => s.firstOk / s.first);
  return { sessions: S.length, items, accFirst: mean(firstAcc), backlogMid, backlogEnd, backlogMax: Math.max(0, ...S.map(s => s.backlog)), ratioMid, ratioEnd, weakWaitMax: Math.max(0, ...S.filter(s => !res.prof.absence || s.day < res.prof.absence[0] || s.day > res.prof.absence[1] + 7).map(s => s.weakWait)),
    weakWaitSessionsMax: Math.max(0, ...S.map(s => s.weakWaitSessions || 0)), weakWaitMid: Math.max(0, ...third(S, 1).map(s => s.weakWaitSessions || 0)), weakWaitEnd: Math.max(0, ...third(S, 2).map(s => s.weakWaitSessions || 0)),
    newShare: items ? S.reduce((a, s) => a + s.newItems, 0) / items : 0, newGapMax: maxGap, subjectStarve: subjStarve, subjectMaxShare: dom, subjectExcess: domExcess, subjectMaxShareAll: domAll, examShare: examShare.length ? mean(examShare) : null, examShareMin: examShare.length ? Math.min(...examShare) : null,
    fbOpenMid: mean(third(S, 1).map(s => s.fbOpen)), fbOpenEnd: mean(third(S, 2).map(s => s.fbOpen)), fbOpenMax: Math.max(0, ...S.map(s => s.fbOpen)), fbVisibleMax: Math.max(0, ...S.map(s => s.fbVisible)), fbCap: E.DECISIONS.O8_felbokDisplay[res.pol],
    rescuePerSession: S.length ? S.reduce((a, s) => a + s.rescues, 0) / S.length : 0, rescueMax: Math.max(0, ...S.map(s => s.rescues)), challenges: S.reduce((a, s) => a + s.ch, 0), challengeOk: S.reduce((a, s) => a + s.chOk, 0), challengeSessions: S.filter(s => s.ch).length,
    klar: S.filter(s => s.light).length, maxItems: Math.max(0, ...S.map(s => s.items)), polMaxItems: Math.max(pol.maxItems, (res.prof.n || pol.n) + 2), restarts: restart.length, restartDrops: restart.reduce((a, s) => a + s.stageDrops, 0), restartStartOk: restart.every(s => s.items === 0 || s.firstRole === 'W' || s.firstRole === 'R'),
    roles, rewards: S.reduce((o, s) => { for (const r of s.rewards) o[r] = (o[r] || 0) + 1; return o; }, {}) };
}
module.exports = { PROFILES, makeCat, runSeason, metrics, rng, E, LER };
