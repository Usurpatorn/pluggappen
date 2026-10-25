/* 2.1 (regel 3I): simulering av FORMMEDVETNA BEVIS med syntetiska elever – djupgrinden PÅ jämförd med AV på samma elever och frön.
   Katalogen = simuleringens katalog (tests/le/sim.js) där faktakoncepten (svenska, geografi) har fördjupande former (depth: true),
   precis som kunskapspunkterna i ett Concept Pack. En djupfråga (t.ex. tillämpning eller hitta felet) kräver förståelse, inte bara minne:
   p = minne · (0,35 + 0,65 · djupförståelse u), plus gissning på flerval. u är skild från minnet: den växer av djupfrågor (och förklaringar),
   inte av att rabbla samma faktum – så en elev kan minnas svaret utan att förstå (det är det grinden ska upptäcka). Utfall:
   - hållbarhet: "överraskningsprov" (eget svar) dag 45, 45+14 och 45+30 – får inte försämras märkbart
   - falsk säkerhet: andel koncept som motorn kallar säkra (stadium ≥ 4) trots att eleven inte förstår (förståelse < 0,6) – ska minska
   - tid till säker: antal koncept som blir säkra – rapporteras (grinden får göra det något långsammare, inte stoppa) */
'use strict';
const E = require('../../src/05b_engine2.js'); const { DAY } = E; const LER = require('../../src/05e_runner.js');
const SIM = require('./sim.js'); const PROFILES = { ...SIM.PROFILES, R: { name: 'Rabblare (minns svaren, förstår lite)', pol: 'older', k0: 0.55, rate: 0.15, slip: 0.03, mcBonus: 0.3, hintUse: 0.05, fast: 0.2, S0: 3, u0: 0.25 } }; const { rng, learner, answer, answerChallenge, recallP, surpriseTest } = SIM;
const CAT = JSON.parse(JSON.stringify(SIM.CAT)); for (const d of Object.values(CAT)) if (d.subject !== 'matte') d.depth = true;
const IDS = Object.keys(CAT);
// Minnesvinst av en lyckad fördröjd djupfråga (en fri hämtning ger 2,2 och en flervalsträff 1,35 i elevmodellen). 1,6 = mellanläge: man måste
// plocka fram kunskapen för att tillämpa den, men alternativen hjälper. FORMS_DEPTH_S=1.35 ger det pessimistiska fallet.
const DEPTH_S = Number(process.env.FORMS_DEPTH_S) || 1.6;
function answerDepth(Lr, cid, now) {
  const st = Lr.m[cid]; const base = st.last == null ? st.u * 0.3 : recallP(st, now) * (0.35 + 0.65 * st.u);
  const p = Math.min(0.97, base + (1 - base) * (0.25 + Lr.prof.mcBonus * 0.5)); const ok = Lr.r() < p; const delta = st.last == null ? 99 : (now - st.last) / DAY;
  if (ok) { st.u += 0.1 * (1 - st.u); st.S *= delta >= 0.5 * st.S ? DEPTH_S : 1.03; } else { st.u += st.rate * 0.8 * (1 - st.u); st.S = Math.max(1, st.S * 0.85); }
  st.last = now; return { ok, fast: false };
}
function session(Lr, L, now, ctx, pol, log, seq, out, sessionNo) {
  const plan = E.planSession(L, CAT, now, ctx, pol, { sessionNo }); const sessId = 'A:' + Math.round(now / 1000);
  const R = LER.create(L, CAT, plan, pol, { sessId }); let t = now; let n = 0, depthQ = 0;
  for (let guard = 0; guard < 40; guard++) {
    const s = LER.peek(R, L); if (!s) break;
    if (s.mode === 'teach') { const m = Lr.m[s.cid]; m.k += m.rate * 1.2 * (1 - m.k); m.u += 0.1 * (1 - m.u); LER.answered(R, L, s, true); continue; }
    const c = E.cstate(L, s.cid); const d = CAT[s.cid]; const kinds = d.kinds;
    let kind, form, res;
    const depthNow = d.depth && s.mode !== 'challenge' && (s.format === 'depth' || (s.format !== 'recall' && s.lvl >= 2 && Lr.r() < 0.35));
    if (s.mode === 'challenge') { kind = 'free'; res = answerChallenge(Lr, s.cid, t); }
    else if (depthNow) { kind = 'mc'; form = 'a'; res = answerDepth(Lr, s.cid, t); depthQ++; }
    else { kind = kinds.length === 1 ? kinds[0] : s.format === 'recall' ? 'free' : (c.st < pol.mcMaxStage || s.role === 'warmup' || s.role === 'rescue') && kinds.includes('mc') ? 'mc' : 'free'; res = answer(Lr, s.cid, kind, s.lvl, s.help || 'none', t); form = kind === 'free' ? 'c' : 'r'; }
    seq.v++; const ev = { restart: !!plan.restart, cid: s.cid, ok: res.ok, kind, k: 4, help: s.help || 'none', ctx: s.ctx, item: s.cid + '#' + seq.v % 9, role: s.code, stretch: !!s.stretch, mode: s.mode === 'challenge' ? 'challenge' : undefined, lvl: s.lvl, fast: res.fast, dev: 'A', seq: seq.v, t, sess: sessId, form };
    log.push(ev); E.apply(L, CAT, ev, pol); LER.answered(R, L, s, res.ok); t += 30000; n++;
  }
  out.n = n; out.depthQ = depthQ; return t;
}
// gate = false → 2.0-läget: inga fördjupande former alls (faktakoncepten har bara igenkänning och eget svar, som frågebankerna i 2.0)
function run(key, { gate = true, days = Number(process.env.FORMS_DAYS) || 45, seed = 7, depth } = {}) {   // FORMS_DAYS: långkörning (t.ex. 120)
  const D0 = { ...E.CFG.depth }; if (depth) Object.assign(E.CFG.depth, depth); for (const d of Object.values(CAT)) if (d.subject !== 'matte') d.depth = gate;
  try {
    const prof = PROFILES[key]; const pol = E.POLICIES[prof.pol]; const Lr = learner(prof, seed); for (const id of IDS) { if (!Lr.m[id]) Lr.m[id] = { k: prof.k0, rate: prof.rate, S: prof.S0, last: null }; Lr.m[id].u = Math.min(0.9, (prof.u0 != null ? prof.u0 : 0.5) * Lr.m[id].k); }
    const L = E.newLE(); const log = []; const seq = { v: 0 }; let last = null; let items = 0, depthQ = 0; let sessions = 0;
    const exams = prof.examAt ? [{ at: prof.examAt * DAY + 9 * 3600000, concepts: prof.examC }] : [];
    for (let d = 0; d < days; d++) {
      if (prof.absent && d >= prof.absent[0] && d <= prof.absent[1]) continue;
      const now = d * DAY + 17 * 3600000; const out = {};
      session(Lr, L, now, { exams, lastSessionAt: last, recentSubjectShare: {}, subjectCount: 3, dueDoneToday: 0 }, pol, log, seq, out, sessions); last = now; sessions++; items += out.n; depthQ += out.depthQ;
    }
    const T = days * DAY + 17 * 3600000; const fact = IDS.filter(id => CAT[id].subject !== 'matte');
    const secure = fact.filter(id => L.c[id] && L.c[id].st >= 4 && E.depthOk(L.c[id])); const shallow = secure.filter(id => Lr.m[id].u < 0.5);
    return { key, gate, d45: surpriseTest(Lr, T), d14: surpriseTest(Lr, T + 14 * DAY), d30: surpriseTest(Lr, T + 30 * DAY), fact45: surpriseTest(Lr, T, fact), fact30: surpriseTest(Lr, T + 30 * DAY, fact),
      secure: secure.length, falseSecure: shallow.length, falseRate: secure.length ? shallow.length / secure.length : 0, items, depthQ, understanding: fact.reduce((a, id) => a + Lr.m[id].u, 0) / fact.length };
  } finally { Object.assign(E.CFG.depth, D0); for (const d of Object.values(CAT)) if (d.subject !== 'matte') d.depth = true; }
}
function compare(depth, seeds = (process.env.FORMS_SEEDS ? Array.from({ length: Number(process.env.FORMS_SEEDS) }, (_, i) => 101 + 7 * i) : [7, 11, 13, 17, 19])) {
  const out = {};
  for (const key of Object.keys(PROFILES)) {
    const agg = (gate) => { const rs = seeds.map(seed => run(key, { gate, seed, depth })); const m = (f) => rs.reduce((a, r) => a + r[f], 0) / rs.length; return { d45: m('d45'), d30: m('d30'), fact45: m('fact45'), fact30: m('fact30'), secure: m('secure'), falseSecure: m('falseSecure'), falseRate: m('falseRate'), items: m('items'), depthQ: m('depthQ'), understanding: m('understanding') }; };
    out[key] = { on: agg(true), off: agg(false) };
  }
  return out;
}
if (require.main === module) {
  const dv = process.env.LE_DEPTH_STAGE ? { gateStage: +process.env.LE_DEPTH_STAGE, askStage: +(process.env.LE_DEPTH_ASK || process.env.LE_DEPTH_STAGE), need: +(process.env.LE_DEPTH_NEED || 2) } : undefined;
  const r = compare(dv); const pct = (x) => (x * 100).toFixed(1).padStart(5);
  console.log('2.1 (former + djupgrind) / 2.0 (inga djupformer)\nprofil  d45 på/av    d30 på/av   fakta d30 på/av  säkra på/av   falskt säkra på/av   förståelse på/av  djupfrågor');
  for (const [k, v] of Object.entries(r)) console.log(`${k.padEnd(6)} ${pct(v.on.d45)}/${pct(v.off.d45)}  ${pct(v.on.d30)}/${pct(v.off.d30)}  ${pct(v.on.fact30)}/${pct(v.off.fact30)}     ${v.on.secure.toFixed(1)}/${v.off.secure.toFixed(1)}       ${v.on.falseSecure.toFixed(2)}/${v.off.falseSecure.toFixed(2)}           ${pct(v.on.understanding)}/${pct(v.off.understanding)}     ${v.on.depthQ.toFixed(0)}/${v.off.depthQ.toFixed(0)}`);
}
module.exports = { run, compare, CAT };
