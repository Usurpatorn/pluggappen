/* Simulering av flera samtidiga mål för Äldre (syntetisk familj, riktiga appen i jsdom, fast klocka, fast slump).
   Används av test_le_multigoal.js och valideringsmatrisen (scripts/le-matrix.mjs). Rapporterar per mål:
   introduktion (första dygn ett koncept spelas), täckning vid målets datum, fördröjd återhämtning (spelat igen ett senare dygn),
   fel och stöd (Rescue/Revansch), svält (mål utan något spelat på 5 dygn trots att datumet närmar sig), nytt per dygn,
   stadieändringar samma dygn, belöningar, faktisk fördelning av uppgifter.
   Inga familjedata: målen byggs av appens inbyggda moment. */
'use strict';
const path = require('path');
const { mkWin, tools, FIX, rng } = require('./childflow.js');
const { v2tools, toStart } = require('./v2driver.js');
const DAY = 86400000; const KID = 'k8';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const T0 = Date.UTC(2026, 10, 3, 9, 0, 0);   // 3/11 10:00 svensk tid (syntetiska datum: 17, 22 och 30 dygn till målen)
const GOALS = {
  quiz: { id: 'mg-quiz', title: 'Läxförhör svenska', date: '2026-11-20', skillIds: ['sv8_ordklasser', 'sv8_satsdelar', 'sv8_sprak', 'sv8_ord'], deckIds: [], kind: 'homework' },
  alg: { id: 'mg-alg', title: 'Algebraprov', date: '2026-11-25', skillIds: ['multin', 'forenkla', 'blandat', 'talfoljd', 'ekvation', 'problemekv', 'andragrad'], deckIds: [], kind: 'exam' },
  kemi: { id: 'mg-kemi', title: 'Kemiprov', date: '2026-12-03', skillIds: ['kemi_syror', 'kemi_baser', 'kemi_ph', 'kemi_starka', 'kemi_neutral', 'kemi_vardag', 'kemi_kropp_natur', 'kemi_saker'], deckIds: [], kind: 'exam' },
};
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
/* opts: file (dist-html), goals (lista av nycklar eller objekt), days, seed, pCorrect, attend(d) → antal block (0 = ingen dag, 1 = KÖR,
   2+ = KÖR + extra block), events: { [d]: (api) => void } (lägg till/flytta mål), scope ('all'|'exams'), preSeed (antal dygn innan med allt rätt) */
async function simulate(opts = {}) {
  const goalsIn = (opts.goals || ['quiz', 'alg', 'kemi']).map(g => (typeof g === 'string' ? { ...GOALS[g] } : { ...g }));
  const w = mkWin({ seed: opts.seed || 77, fixedClock: true, file: opts.file }); await sleep(40); const T = tools(w); const PA = T.PA; const { $, click } = T;
  const fix = JSON.parse(JSON.stringify(FIX)); for (const k of fix.kids) if (k.id === KID) k.exams = [];
  PA().FAMILY.apply(fix); PA().load(); PA().rerender(); const D = v2tools(w, T);
  w.__advance(T0 - w.Date.now());
  const kid = () => PA().KIDS.find(k => k.id === KID); const p = () => PA().DB.profiles[KID];
  const setGoals = (list) => { p().exams = list.map(g => ({ ...g })); PA().save(); PA().LE.invalidate(KID); };
  if (opts.scope) { p().settings.scope = opts.scope; p().settings.scopeAt = w.Date.now(); }
  let goals = goalsIn.filter(g => !g.addAt); setGoals(goals);
  const rnd = rng((opts.seed || 77) + 1); const pc = opts.pCorrect == null ? 0.7 : opts.pCorrect;
  const open = () => { toStart(T); click($(`[data-kid="${KID}"]`)); if ($('[data-pet]')) click($('[data-pet]')); };
  const cidsOf = (g) => new Set(PA().LE.examCids(PA().LE.state(kid()), g));
  const R = { days: [], goals: {}, first: {}, playDays: {}, plays: {}, errors: {}, support: {}, newPerDay: [], sameDayStage: 0, rewards: { xp: 0, gems: 0, list: {} }, headlines: [], sessions: 0, items: 0, flowBlocks: 0, practiceBlocks: 0 };
  const goalSets = () => Object.fromEntries(goals.map(g => [g.id, cidsOf(g)]));
  const goalOf = (cid, sets) => { const ids = Object.keys(sets).filter(id => sets[id].has(cid)); return ids.length ? ids.join('+') : 'annat'; };
  const play = (sets, maxItems = 80) => { let g = 0; const day = dayKey(w.Date.now());
    while (PA().S && PA().S.v2 && $('#qcard') && g++ < maxItems) { const S = PA().S; const it = S.queue[S.i]; const cid = it.spec && it.spec.cid;
      if (it.cat !== 'learn' && cid) { R.items++; const gl = goalOf(cid, sets); R.plays[gl] = (R.plays[gl] || 0) + 1; if (!R.first[cid]) R.first[cid] = day; (R.playDays[cid] = R.playDays[cid] || new Set()).add(day);
        if (it.spec.role === 'rescue' || it.spec.help === 'rescue') R.support[gl] = (R.support[gl] || 0) + 1; }
      const ok = rnd() < pc; if (!ok && it.cat !== 'learn' && cid) { const gl = goalOf(cid, sets); R.errors[gl] = (R.errors[gl] || 0) + 1; }
      D.answer(() => !ok); w.__advance(5000); }
  };
  const days = opts.days || 31;
  for (let d = 0; d < days; d++) {
    for (const g of goalsIn) if (g.addAt === d) { goals = [...goals, g]; setGoals(goals); }
    if (opts.events && opts.events[d]) { opts.events[d]({ goals, setGoals: (l) => { goals = l; setGoals(l); }, PA, w, p }); }
    const date = dayKey(w.Date.now()); const sets = goalSets();
    open(); const card = $('.mission'); const eb = card ? String((card.querySelector('.eyebrow') || {}).textContent || '').trim() : ''; const gt = card ? String((card.querySelector('.goal-title') || {}).textContent || '').trim() : '';
    const train = card ? [...card.querySelectorAll('.train li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()) : [];
    const plan = PA().V2.safe(() => PA().V2.peekPlan(kid()).plan, 'sim', []) || []; const pg = {}, pgNB = {}; for (const s of plan) { const gl = goalOf(s.cid, sets); pg[gl] = (pg[gl] || 0) + 1; if (s.role !== 'boss') for (const id of gl.split('+')) pgNB[id] = (pgNB[id] || 0) + 1; }   // pgNB: per mål utan Bossen (som hemmets examShare), gemensamma koncept räknas för båda
    R.headlines.push({ date, eb, gt, train, plan: pg, planNB: pgNB, live: goals.filter(g => g.date >= date).map(g => g.id), maxNew: plan.maxNew, examDays: plan.examDays });
    const st0 = {}; for (const [c, v] of Object.entries(PA().LE.state(kid()).L.c)) st0[c] = v.st;   // dygnets början: för samma-dygnsmåttet
    const blocks = opts.attend ? opts.attend(d, date) : 1; const before = Object.keys(R.first).length; const xp0 = p().xp, gems0 = p().gems; const pb0 = R.practiceBlocks;
    if (blocks > 0) { const kor = $('.go-btn[data-v2="kor"]') || $('[data-v2="kor"]'); if (kor) { click(kor); R.sessions++; play(sets); }
      for (let b = 1; b < blocks; b++) { open(); const more = $('[data-v2="flow"]') || $('[data-v2="practice-more"]') || $('[data-v2="ovamer"]'); if (!more) break; const isFlow = more.dataset.v2 === 'flow'; click(more); if (isFlow) R.flowBlocks++; else R.practiceBlocks++; play(sets); } }
    R.newPerDay.push({ date, n: Object.keys(R.first).length - before });
    // samma dygn: mer än ett stadiesteg, eller ett koncept som sågs första gången idag och redan står på stadium 2+ (motorns regel: högst ett steg per dygn, nytt → 1)
    for (const [c, v] of Object.entries(PA().LE.state(kid()).L.c)) { const a = st0[c] == null ? 0 : st0[c]; if (v.st - a >= 2 || (R.first[c] === date && v.st >= 2)) { R.sameDayStage++; (R.sameDayList = R.sameDayList || []).push([date, c, a, v.st]); } }
    R.days.push({ date, blocks, flow: R.flowBlocks, practice: R.practiceBlocks - pb0, dxp: p().xp - xp0, dgems: p().gems - gems0 });
    w.__advance(DAY);
  }
  const L = PA().LE.state(kid()).L.c; const final = goalSets();
  for (const g of goals) { const set = final[g.id]; const cids = [...set]; const at = g.date;
    const introBy = cids.filter(c => R.first[c] && R.first[c] < at).length; const introBy3 = cids.filter(c => R.first[c] && R.first[c] <= dayKey(new Date(at + 'T08:00:00').getTime() - 3 * DAY)).length;
    const delayed = cids.filter(c => R.playDays[c] && [...R.playDays[c]].filter(x => x < at).length >= 2).length;
    let starve = 0; { const ds = R.headlines.map(h => h.date).filter(x => x < at); let gap = 0; for (const x of ds) { const any = cids.some(c => R.playDays[c] && R.playDays[c].has(x)); gap = any ? 0 : gap + 1; if (gap >= 5 && x >= dayKey(new Date(at + 'T08:00:00').getTime() - 14 * DAY)) starve = Math.max(starve, gap); } }
    R.goals[g.id] = { title: g.title, kind: g.kind, date: at, concepts: cids.length, introducedBefore: introBy, introducedBy3DaysBefore: introBy3, delayedRetrieval: delayed, plays: R.plays[g.id] || 0, errors: R.errors[g.id] || 0, support: R.support[g.id] || 0, maxGapLast2Weeks: starve, stages: cids.reduce((a, c) => { const s = (L[c] || {}).st; const k = s == null ? 'osett' : 's' + s; a[k] = (a[k] || 0) + 1; return a; }, {}) };
  }
  R.rewards.xp = p().xp; R.rewards.gems = p().gems; R.maxNewPerDay = Math.max(0, ...R.newPerDay.map(x => x.n));
  for (const k of Object.keys(R.playDays)) R.playDays[k] = [...R.playDays[k]];
  R.allocation = R.plays; return R;
}
module.exports = { simulate, GOALS, DAY, KID };
