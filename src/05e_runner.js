/* ========= Learning Engine v2 – passkörare (Fas 3D) =========
   Ren logik för ETT pass: vilken uppgift kommer härnäst, vad händer efter ett fel (omförsök, Rescue Loop, Lätt läge, uppskjutning),
   när Bossen väljs och när LÄR-kortet visas. Ingen DOM, ingen slump, ingen klocka – samma kod används av appen och av simuleringen.
   Appen gör om varje "spec" till en riktig fråga och registrerar beviset; körarens uppgift är bara ordningen. */
const LER = (() => {
  'use strict';
  const E = typeof LE2 !== 'undefined' ? LE2 : require('./05b_engine2.js');
  // Rollkoder i bevisloggen (diagnostik, Bossens CHALLENGE). Barnet ser aldrig koderna.
  const ROLE_CODE = { warmup: 'W', remember: 'R', revansch: 'V', focus: 'F', practice: 'P', boss: 'B', rescue: 'X', easy: 'E', retry: 'T', challenge: 'C', manual: 'M', readclose: 'Q', testa: 'S' };
  const newBy = () => ({ n: 0, fails: 0, run: 0, rescued: 0, taught: 0, intro: 0 });
  /* Skapa ett pass. plan = LE2.planSession(...). opts.mode: 'practice' | 'exam' (Testa mig) | 'revansch'. */
  function create(L, cat, plan, pol, opts = {}) {
    return { pol, cat, mode: opts.mode || 'practice', sessId: opts.sessId || '', queue: plan.map(s => ({ ...s })), i: 0, byC: {}, results: [], answered: 0,
      maxItems: opts.maxItems || plan.maxItems || pol.maxItems, eased: false, rescues: 0, examC: [], log: [], restart: !!plan.restart, baseLvl: {}, light: !!plan.light, planned: plan.length };
  }
  /* Nästa uppgift (eller null när passet är slut). Löser Bossen och LÄR-kortet när de ska spelas. */
  function peek(R, L) {
    while (R.i < R.queue.length) {
      if (R.answered >= R.maxItems) return null;
      let s = R.queue[R.i];
      if (s.dynamic) {
        R.examC = s.examC || [];
        const b = E.pickBoss(L, R, R.queue, R.pol, R.cat);
        if (!b) { R.queue.splice(R.i, 1); continue; }
        s = R.queue[R.i] = { ...s, cid: b.cid, why: b.why, stretch: b.stretch, dynamic: false };
      }
      const c = L.c[s.cid]; const def = R.cat[s.cid] || {};
      if (def.kind === 'deck') return { ...s, kind: 'deck', ctx: (R.byC[s.cid] || {}).n ? 'repeat' : 'first', help: 'none', lvl: 1, code: ROLE_CODE[s.role] || 'P' };
      // LÄR: förståelseproblem (fel på flera dygn trots korta intervall) → kort förklaring, sedan ett stöttat försök
      if (R.mode !== 'exam' && s.mode !== 'challenge' && s.mode !== 'teach' && s.role !== 'rescue' && c && c.teach && !(R.byC[s.cid] && R.byC[s.cid].taught)) {
        (R.byC[s.cid] = R.byC[s.cid] || newBy()).taught = 1;
        R.queue[R.i] = { ...s, help: 'hint', teachFollow: 1 };
        R.queue.splice(R.i, 0, { cid: s.cid, role: 'teach', mode: 'teach', why: 'kort förklaring först' });
        s = R.queue[R.i];
      }
      // 2.1 UPPTÄCK: en helt ny kunskapspunkt börjar med en kort förklaring (Learning Recipe: NY → förstå). Ger inget bevis.
      if (R.mode !== 'exam' && s.mode !== 'challenge' && s.mode !== 'teach' && s.role !== 'rescue' && s.role !== 'readclose' && s.role !== 'revansch' && def.kind === 'kp' && def.intro !== false && !(c && c.n > 0) && !(R.byC[s.cid] && (R.byC[s.cid].intro || R.byC[s.cid].n))) {
        (R.byC[s.cid] = R.byC[s.cid] || newBy()).intro = 1;
        R.queue.splice(R.i, 0, { cid: s.cid, role: 'intro', mode: 'teach', why: 'nytt – upptäck först' });
        s = R.queue[R.i];
      }
      if (s.mode === 'teach') return { ...s, code: '' };
      const seen = R.byC[s.cid] || (R.byC[s.cid] = newBy());
      if (R.baseLvl[s.cid] == null) R.baseLvl[s.cid] = c ? c.lvl : 1;
      const maxLvl = def.maxLvl || 3;
      let lvl = s.lvl || Math.max(1, (c ? c.lvl : 1) + (s.lvlDelta || 0));
      if (s.role === 'boss' && s.stretch && lvl < maxLvl) lvl++;
      if (s.mode === 'challenge') lvl = maxLvl;
      lvl = Math.max(1, Math.min(maxLvl, lvl));
      const ctx = s.ctx || (R.mode === 'exam' ? 'exam' : seen.n === 0 ? 'first' : 'repeat');
      const help = R.mode === 'exam' ? 'none' : (s.help || 'none');
      const role = R.mode === 'exam' ? 'testa' : s.role;
      return { ...s, role, lvl, ctx, help, code: s.teachFollow ? 'L' : (ROLE_CODE[role] || 'P'), format: s.mode === 'challenge' ? 'challenge' : R.mode === 'exam' ? 'any' : E.formatFor(L, R.cat, s.cid, R.pol, s.role) };
    }
    return null;
  }
  // Rescue Loop: kort förklaring → stöttat försök → lättare egen variant → vanlig variant → tillbaka. Längd beror på policy (max 4).
  function rescueSeq(pol, spec) {
    const lv = Math.max(1, spec.lvl - 1); const cid = spec.cid;
    return (E.CFG.rescue.seq[pol.name] || E.CFG.rescue.seq.middle).map(k => k === 'teach' ? { cid, role: 'rescue', mode: 'teach', why: 'vi tar det tillsammans', rescueStep: 'teach' }
      : k === 'supported' ? { cid, role: 'rescue', help: 'rescue', lvl: lv, ctx: 'retry', why: 'vi tar det tillsammans', rescueStep: 'supported' }
      : k === 'easier' ? { cid, role: 'rescue', help: 'none', lvl: lv, ctx: 'retry', why: 'en lite lättare', rescueStep: 'easier' }
      : { cid, role: 'rescue', help: 'none', lvl: spec.lvl, ctx: 'retry', why: 'nu själv', rescueStep: 'normal' });
  }
  /* Efter ett svar: uppdatera passet. Returnerar händelser för gränssnittet: retry | rescue | ease | defer. Beviset registreras av anroparen. */
  function answered(R, L, spec, ok) {
    const out = [];
    if (spec.mode === 'teach') { R.i++; return out; }
    const seen = R.byC[spec.cid] || (R.byC[spec.cid] = newBy());
    seen.n++; R.answered++; R.results.push(!!ok); R.log.push([spec.cid, spec.code, ok ? 1 : 0]);
    if (ok) seen.run = 0; else { seen.fails++; seen.run++; }
    if (spec.mode === 'challenge' || R.mode === 'exam') { R.i++; return out; }   // utmaning och Testa mig: inga omförsök, ingen Rescue
    if (spec.kind === 'deck') { R.i++; return out; }   // glosor: v1:s Leitner-boxar tar hand om fel ord (ingen Rescue för ord)
    if (!ok && spec.rescueStep === 'normal') {   // fel även efter Rescue → skjut upp konceptet till ett senare pass (ingen ändlös loop)
      for (let j = R.queue.length - 1; j > R.i; j--) if (R.queue[j].cid === spec.cid && !R.queue[j].dynamic) R.queue.splice(j, 1);
      out.push({ type: 'defer', cid: spec.cid });
    } else if (!ok && spec.help !== 'rescue' && spec.role !== 'rescue') {
      const trig = E.rescueTrigger(R, spec.cid, R.pol);
      if (trig === 'ease') {
        R.eased = true;
        const strong = Object.entries(L.c).filter(([id, c]) => c.st >= 2 && R.cat[id] && R.cat[id].kind !== 'deck' && !(R.byC[id] && R.byC[id].fails)).sort((a, b) => b[1].st - a[1].st || (a[0] < b[0] ? -1 : 1)).slice(0, 2);
        // Granskning L6 (prövat, förkastat): att räkna de lättare uppgifterna som upprepning sänkte hållbarheten kraftigt i simuleringen (H −8 p).
        // De är äkta hämtningar av redan säkra koncept; stadiet höjs ändå bara efter fördröjning, så medvetna fel ger ingen genväg.
        R.queue.splice(R.i + 1, 0, ...strong.map(([id]) => ({ cid: id, role: 'easy', why: 'lättare läge – bygga självförtroende', lvlDelta: -1 })));
        out.push({ type: 'ease' });
      } else if (trig === 'rescue') {
        R.rescues++; seen.rescued = 1;
        R.queue.splice(R.i + 1, 0, ...rescueSeq(R.pol, spec));
        out.push({ type: 'rescue', cid: spec.cid });
      } else if (trig === 'defer') {
        for (let j = R.queue.length - 1; j > R.i; j--) if (R.queue[j].cid === spec.cid && !R.queue[j].dynamic) R.queue.splice(j, 1);
        out.push({ type: 'defer', cid: spec.cid });
      } else if (seen.fails === 1 && !R.queue.slice(R.i + 1).some(q => q.cid === spec.cid)) {
        R.queue.splice(Math.min(R.queue.length, R.i + 3), 0, { cid: spec.cid, role: 'retry', why: 'ny variant om en stund', ctx: 'retry' });
        out.push({ type: 'retry', cid: spec.cid });
      }
    }
    R.i++;
    return out;
  }
  // Hur långt har passet kommit (för "N kvar" i fokusläge och för KLAR)?
  function progress(R) { const left = R.queue.slice(R.i).filter(s => s.mode !== 'teach').length; return { done: R.answered, left: Math.max(0, Math.min(left, R.maxItems - R.answered)) }; }
  function summary(R) { const ok = R.results.filter(Boolean).length; return { n: R.results.length, ok, rescues: R.rescues, eased: R.eased, light: R.light }; }
  return { ROLE_CODE, create, peek, answered, rescueSeq, progress, summary };
})();
if (typeof module !== 'undefined') module.exports = LER;
