/* Simulering av Learning Engine v2 med SYNTETISKA elever (inga riktiga barndata). Kör mot PRODUKTIONSMOTORN (src/05b_engine2.js).
   Fas 3B: K-13-varianter via opts.memMult (hur glömsk elevmodellen är) och opts.polPatch (t.ex. kortare intervallstege).
   Elevmodell: per koncept förståelse k (0..1) och minnesstabilitet S (dygn). Sannolikhet att minnas efter Δ dygn = k·e^(−Δ/S).
   Hämtning efter lagom lång tid ökar S kraftigt (spacing), direkt upprepning nästan inte (massed practice). */
'use strict';
const E = require('../../src/05b_engine2.js'); const { DAY } = E; const fs = require('fs');
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Syntetisk katalog: 3 ämnen, 20 koncept ---------- */
const CAT = {};
const add = (id, o) => { CAT[id] = { id, maxLvl: 3, kinds: ['free'], items: 0, ...o }; };
// matte: förkunskapskedja, generator (oändliga varianter), eget svar
add('m1', { subject: 'matte', name: 'Plus inom 10' }); add('m2', { subject: 'matte', name: 'Plus med tiotalsövergång', prereq: ['m1'] });
add('m3', { subject: 'matte', name: 'Minus med tiotalsövergång', prereq: ['m2'] }); add('m4', { subject: 'matte', name: 'Dubbelt och hälften', prereq: ['m1'] });
add('m5', { subject: 'matte', name: '2:ans och 5:ans tabell', prereq: ['m4'] }); add('m6', { subject: 'matte', name: 'Vilket tal saknas?', prereq: ['m2', 'm3'] });
add('m7', { subject: 'matte', name: 'Talen till 100', prereq: ['m2'] }); add('m8', { subject: 'matte', name: 'Klockan hel/halv', prereq: [] });
for (const id of Object.keys(CAT)) CAT[id].recall = true;   // matte: eget svar
// svenska: identifiera → producera (flerval + eget svar)
for (const [i, n] of [['s1', 'Substantiv'], ['s2', 'Verb'], ['s3', 'Motsatsord'], ['s4', 'Stor bokstav och punkt']].map(x => x)) add(i, { subject: 'svenska', name: n, kinds: ['mc', 'free'], items: 6, maxLvl: 2 });
// fakta (geografi): frågebank med 5 frågor per koncept; två koncept bara flerval
const geo = ['Väderstreck', 'Karttecken', 'Landskap', 'Norden', 'Världsdelar', 'Skala', 'Hav och sjöar', 'Huvudstäder'];
geo.forEach((n, i) => add('g' + (i + 1), { subject: 'geografi', name: n, kinds: i >= 6 ? ['mc'] : ['mc', 'free'], items: 5, maxLvl: 2 }));
const IDS = Object.keys(CAT);

/* ---------- Elevprofiler ---------- */
const PROFILES = {
  A: { name: 'Snabb men slarvig', pol: 'middle', k0: 0.75, rate: 0.25, slip: 0.15, mcBonus: 0.1, hintUse: 0.05, fast: 0.6, S0: 2 },
  B: { name: 'Försiktig nybörjare', pol: 'younger', k0: 0.15, rate: 0.2, slip: 0.02, mcBonus: 0.05, hintUse: 0.6, fast: 0, S0: 1 },
  C: { name: 'Flervalsgissare', pol: 'middle', k0: 0.3, rate: 0.12, slip: 0.03, mcBonus: 0.45, hintUse: 0.1, fast: 0.3, S0: 1 },
  D: { name: 'Kämpar med ett koncept', pol: 'younger', k0: 0.45, rate: 0.18, slip: 0.04, mcBonus: 0.05, hintUse: 0.4, fast: 0, S0: 1.5, hard: { m4: { k0: 0.02, rate: 0.03 } } },
  E: { name: 'Återvänder efter uppehåll', pol: 'middle', k0: 0.5, rate: 0.2, slip: 0.05, mcBonus: 0.1, hintUse: 0.2, fast: 0, S0: 1.5, absent: [21, 41] },
  F: { name: 'Prov om 14 dagar', pol: 'older', k0: 0.45, rate: 0.2, slip: 0.04, mcBonus: 0.1, hintUse: 0.15, fast: 0, S0: 1.5, examAt: 14, examC: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'm3'], kOverride: { g1: 0.85, g2: 0.8, g3: 0.8, g4: 0.15, g5: 0.2, g6: 0.15 } },
  G: { name: 'Avancerad', pol: 'older', k0: 0.95, rate: 0.3, slip: 0.02, mcBonus: 0.05, hintUse: 0, fast: 0.2, S0: 6 },
  H: { name: 'Två enheter offline', pol: 'middle', k0: 0.5, rate: 0.2, slip: 0.05, mcBonus: 0.1, hintUse: 0.2, fast: 0, S0: 1.5 },
};

function learner(prof, seed) {
  const r = rng(seed); const m = {};
  for (const id of IDS) { const h = (prof.hard || {})[id] || {}; const k = (prof.kOverride || {})[id] ?? h.k0 ?? prof.k0; m[id] = { k, rate: h.rate ?? prof.rate, S: prof.S0 * (k >= 0.6 ? 3 : 1), last: k >= 0.6 ? -DAY : null }; }  // k≥0.6: redan mött i skolan
  return { prof, r, m };
}
let MEM = 1; // K-13: >1 = elevmodellen glömmer långsammare
const recallP = (st, now) => st.last == null ? 0 : st.k * Math.exp(-((now - st.last) / DAY) / (st.S * MEM * (0.4 + st.k)));  // välförstått glöms långsammare
function answer(Lr, cid, kind, lvl, help, now) {
  const st = Lr.m[cid]; const p0 = recallP(st, now) * (1 - 0.08 * (lvl - 1));
  let pFree = st.last == null ? st.k * 0.6 : p0;                 // ny kunskap: hälften av förståelsen utan förklaring
  if (help === 'hint') pFree = Math.min(1, pFree + 0.25); if (help === 'rescue') pFree = Math.min(1, pFree + 0.35);
  const fast = Lr.r() < Lr.prof.fast;
  pFree *= (1 - Lr.prof.slip * (fast ? 1.5 : 0.5));
  const p = kind === 'mc' ? Math.min(0.97, pFree + (1 - pFree) * (0.25 + Lr.prof.mcBonus)) : pFree;
  const ok = Lr.r() < p;
  // inlärning
  const delta = st.last == null ? 99 : (now - st.last) / DAY; const realRecall = ok && kind !== 'mc' && help === 'none';
  if (ok) { if (realRecall && delta >= 0.5 * st.S) st.S *= 2.2; else if (kind === 'mc' && delta >= 0.5 * st.S) st.S *= 1.35; else st.S *= 1.05; st.k += 0.05 * (1 - st.k); }
  else { st.k += st.rate * (1 - st.k); st.S = Math.max(1, st.S * 0.7); }
  if (help === 'rescue') st.k += st.rate * 0.8 * (1 - st.k);
  st.last = now; return { ok, fast: fast && !ok };
}

/* ---------- v2-passkörare: produktionens passkörare (src/05e_runner.js) med syntetiska svar ---------- */
const LER = require('../../src/05e_runner.js');
function runSessionV2(Lr, L, now, ctx, pol, log, dev, seqRef, out, opts = {}) {
  const plan = E.planSession(L, CAT, now, ctx, pol, { sessionNo: opts.sessionNo || 0, n: opts.n }); const sessId = dev + ':' + Math.round(now / 1000);
  const Rn = LER.create(L, CAT, plan, pol, { sessId }); const lines = []; const rewards = []; let t = now; let chCap = 0;
  const variant = (cid, ch) => { const c = E.cstate(L, cid); if (ch) return { item: cid + '#ch' + ((c.ch || {}).n || 0), only: false }; const k = CAT[cid].items; if (!k) return { item: cid + '#' + (c.n + 1) + '.' + seqRef.v, only: false }; const avoid = new Set([...(c.fb ? c.fb.items : []), ...c.items.slice(-Math.min(3, k - 1))]); for (let j = 0; j < k; j++) { const it = cid + '#' + ((c.n + j) % k); if (!avoid.has(it)) return { item: it, only: false }; } return { item: cid + '#' + (c.n % k), only: true }; };
  for (let guard = 0; guard < 40; guard++) {
    const s = LER.peek(Rn, L); if (!s) break;
    if (s.mode === 'teach') { const m = Lr.m[s.cid]; m.k += m.rate * 1.2 * (1 - m.k); lines.push(`LÄR     ${s.cid}: kort förklaring + löst exempel (Läs → stäng → hämta)${s.rescueStep ? ' [Rescue]' : ''}`); LER.answered(Rn, L, s, true); continue; }
    const c = E.cstate(L, s.cid); const kinds = CAT[s.cid].kinds;
    const kind = s.mode === 'challenge' ? 'free' : kinds.length === 1 ? kinds[0] : s.format === 'recall' ? 'free' : (c.st < pol.mcMaxStage || s.role === 'warmup' || s.role === 'rescue') && kinds.includes('mc') ? 'mc' : 'free';
    let help = s.help || 'none'; if (help === 'none' && s.role !== 'rescue' && s.mode !== 'challenge' && Lr.r() < Lr.prof.hintUse && recallP(Lr.m[s.cid], t) < 0.4) help = 'hint';
    const res = s.mode === 'challenge' ? answerChallenge(Lr, s.cid, t) : answer(Lr, s.cid, kind, s.lvl, help, t);
    if (s.role === 'rescue' && s.help === 'rescue') { const m = Lr.m[s.cid]; m.k += m.rate * 0.8 * (1 - m.k); }
    const vv = variant(s.cid, s.mode === 'challenge');
    const ev = { restart: !!plan.restart, cid: s.cid, ok: res.ok, kind, k: 4, help, ctx: s.ctx, item: vv.item, onlyVariant: vv.only, role: s.code, stretch: !!s.stretch, mode: s.mode === 'challenge' ? 'challenge' : undefined, lvl: s.lvl, fast: res.fast, dev, seq: ++seqRef.v, t, sess: sessId };
    log.push(ev); const R = E.apply(L, CAT, ev, pol);
    for (const rw of R.rewards) { if (rw === 'CHALLENGE' && chCap++) continue; rewards.push(rw); }
    const evs = LER.answered(Rn, L, s, res.ok);
    lines.push(`${(s.role || '').padEnd(8)} ${s.cid}@${s.lvl} ${kind}${help !== 'none' ? '+' + help : ''} ${res.ok ? '✓' : '✗'}  st ${R.diff.before.st}→${R.diff.after.st}${R.diff.after.fb ? ' fb:' + R.diff.after.fb : ''}${R.rewards.length ? ' [' + R.rewards.join(',') + ']' : ''}  (${s.why})`);
    for (const e of evs) if (e.type !== 'retry') lines.push(`  ↳ ${({ rescue: 'RESCUE LOOP på ', ease: 'LÄTTARE LÄGE', defer: 'skjuts upp till imorgon: ' })[e.type]}${e.cid || ''}`);
    t += 30000;
  }
  const sm = LER.summary(Rn);
  out.push({ lines, rewards, rescues: sm.rescues, n: sm.n, ok: sm.ok, light: !!plan.light, plan, log: Rn.log, challenge: Rn.log.filter(x => x[1] === 'C').length });
  return t;
}
// Utmaning: kräver djupare förståelse än vanlig hämtning – sannolikhet ≈ k² · minne
function answerChallenge(Lr, cid, now) { const st = Lr.m[cid]; const p = Math.min(0.95, st.k * st.k * (0.5 + 0.5 * recallP(st, now) / Math.max(0.01, st.k))); return { ok: Lr.r() < p, fast: false }; }

/* ---------- v1-baslinje (nuvarande motor, förenklad men trogen) ---------- */
function runSessionV1(Lr, V, now, n, out) {
  const skills = IDS; let t = now; let ok = 0, cnt = 0; const pick = () => { const w = skills.map(id => { const s = V[id] || { m: 0, last: 0 }; const stale = Math.min(3, (t - (s.last || 0)) / DAY); return 20 + (100 - s.m) + stale * 10; }); let r = Lr.r() * w.reduce((a, b) => a + b, 0); for (let j = 0; j < skills.length; j++) { r -= w[j]; if (r <= 0) return skills[j]; } return skills[0]; };
  const q = []; for (let j = 0; j < n; j++) q.push(pick());
  for (let j = 0; j < n; j++) {
    const id = q[j]; const s = V[id] || (V[id] = { m: 0, lvl: 1, streak: 0, wrongRun: 0, last: 0 });
    const kind = CAT[id].kinds.includes('mc') ? 'mc' : 'free';   // v1: faktaämnen mest flerval
    const res = answer(Lr, id, kind, s.lvl, 'none', t); cnt++; s.last = t;
    if (res.ok) { ok++; s.m = Math.min(100, s.m + (100 - s.m) * (0.12 + 0.05 * s.lvl)); s.streak++; s.wrongRun = 0; if (s.streak >= 4 && s.m >= 55 && s.lvl < CAT[id].maxLvl) { s.lvl++; s.streak = 0; } }
    else { s.m = Math.max(0, s.m - s.m * 0.22 - 3); s.streak = 0; s.wrongRun++; if (s.wrongRun >= 3 && s.lvl > 1) { s.lvl--; s.wrongRun = 0; } if (j + 3 < n) q.splice(j + 3, 0, id); }   // omförsök ersätter senare plats → lika många frågor som v2
    t += 30000;
  }
  out.push({ n: cnt, ok });
}

/* ---------- Utfall: "överraskningsprov" på alla koncept dag T (eget svar, nivå 1) ---------- */
function surpriseTest(Lr, T, ids = IDS) { return ids.reduce((a, id) => a + recallP(Lr.m[id], T), 0) / ids.length; }

/* ---------- Kör en profil ---------- */
function runProfile(key, opts = {}) {
  const prof = PROFILES[key]; const pol = { ...E.POLICIES[prof.pol], ...((opts.polPatch || {})[prof.pol] || {}) }; const days = opts.days || 45; const seed = opts.seed || 7; MEM = opts.memMult || 1;
  const Lr2 = learner(prof, seed), Lr1 = learner(prof, seed); const L = E.newLE(); const V = {}; const log = []; const seq = { v: 0 };
  const trace = []; let lastSess = null; const exams = prof.examAt ? [{ at: prof.examAt * DAY + 9 * 3600000, concepts: prof.examC }] : [];
  const examScore = {}; const recentSubj = []; const stats = { light: 0, rescue: 0, items: 0, ok: 0, rewards: {}, sessions: 0, fbOpenMax: 0, dueMax: 0, lvlChanges: 0 };
  for (let d = 0; d < days; d++) {
    if (prof.absent && d >= prof.absent[0] && d <= prof.absent[1]) continue;
    const now = d * DAY + 17 * 3600000;
    if (prof.examAt && d === prof.examAt) { examScore.v2 = surpriseTest(Lr2, prof.examAt * DAY + 9 * 3600000, prof.examC); examScore.v1 = surpriseTest(Lr1, prof.examAt * DAY + 9 * 3600000, prof.examC); }
    const share = {}; const flat = recentSubj.slice(-2).flat(); for (const s of flat) share[s] = (share[s] || 0) + 1 / flat.length;
    const ctx = { exams, lastSessionAt: lastSess, recentSubjectShare: share, subjectCount: 3, dueDoneToday: 0 };
    const out = []; runSessionV2(Lr2, L, now, ctx, pol, log, 'A', seq, out, { sessionNo: stats.sessions }); const o = out[0];
    const sessSubj = [...new Set(log.filter(e => e.t >= now).map(e => CAT[e.cid].subject))]; recentSubj.push(sessSubj);
    const o1 = []; runSessionV1(Lr1, V, now, o.n, o1);
    lastSess = now; stats.sessions++; if (o.light) stats.light++; stats.items += o.n; stats.ok += o.ok; stats.rescue += o.rescues; for (const r of o.rewards) stats.rewards[r] = (stats.rewards[r] || 0) + 1;
    const fbOpen = E.felbokVisible(L).length; stats.fbOpenMax = Math.max(stats.fbOpenMax, fbOpen);
    const dueNext = Object.values(L.c).filter(c => c.n > 0 && c.due <= now + DAY).length; stats.dueMax = Math.max(stats.dueMax, dueNext);
    const ins = E.parentInsights(L, CAT, now + 3600000, pol);
    const nextPlan = E.planSession(L, CAT, (d + 1) * DAY + 17 * 3600000, { ...ctx, lastSessionAt: now }, pol).map(s => s.role[0].toUpperCase() + ':' + s.cid);
    trace.push({ d, n: o.n, ok: o.ok, lines: o.lines, rescues: o.rescues, rewards: o.rewards, fbOpen, dueNext, parent: ins, nextPlan, v1ok: o1[0].ok, v1n: o1[0].n,
      stages: Object.fromEntries(Object.entries(L.c).filter(([, c]) => c.n > 0).map(([id, c]) => [id, c.st])), labels: Object.fromEntries(Object.entries(L.c).filter(([, c]) => c.n > 0).map(([id, c]) => [id, E.childLabel(c, now, pol, L)])) });
  }
  const T = days * DAY + 17 * 3600000;
  const examT = prof.examAt ? prof.examAt * DAY + 9 * 3600000 : null;
  const res = { key, name: prof.name, pol: prof.pol, stats, trace, L, log,
    v2: { test: surpriseTest(Lr2, T), test14: surpriseTest(Lr2, T + 14 * DAY), test30: surpriseTest(Lr2, T + 30 * DAY), exam: examT ? examScore.v2 : null },
    v1: { test: surpriseTest(Lr1, T), test14: surpriseTest(Lr1, T + 14 * DAY), test30: surpriseTest(Lr1, T + 30 * DAY), exam: examT ? examScore.v1 : null } };
  return res;
}
module.exports = { runProfile, PROFILES, CAT, IDS, rng, learner, answer, answerChallenge, recallP, surpriseTest, runSessionV2 };
