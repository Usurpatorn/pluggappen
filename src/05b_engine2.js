/* ========= Learning Engine v2 – kärna (Fas 3B: SKUGGLÄGE) =========
   Rena funktioner: tillstånd = f(bas, bevislogg, katalog, policy). Ingen Math.random, ingen DOM, inga appglobaler.
   I Fas 3B räknar motorn bara i bakgrunden – barnet får v1. Allt här är portat från den godkända Fas 3A-prototypen
   (arkitekturdokumentet avsnitt C–J); avvikelser är markerade "3B:".
   Begrepp: koncept (vad en uppgift prövar) → bevis (hur svaret gavs) → stadium/förfallodag → planering → pass. */
const LE2 = (() => {
  'use strict';
  const DAY = 86400000;
  // 3B: lokala dygn (prototypen räknade UTC-dygn). Förfallodagar ligger på lokala dygnsgränser.
  const tzOff = (t) => new Date(t).getTimezoneOffset() * 60000;
  const dayIdx = (t) => Math.floor((t - tzOff(t)) / DAY);
  const dayStart = (t) => { const d = dayIdx(t); const g = d * DAY; return g + tzOff(g); };

  /* ---------- Godkända beslut (Fas 3A, O-1 … O-9) – byggställning som senare faser läser ---------- */
  const DECISIONS = {
    O1_intervals: 'Behåll stegen 0/1/3/7/14/30/60 och ×0,8 för yngre under 3B; omprövas med skuggdata.',
    O2_verifiedDays: 7,               // nyss verifierade Felboks-poster visas som framgång i 7 dagar (ingen historikvy)
    O3_streak: 'Streak behålls (positiv kontinuitet), ingen straffande text vid tappad streak; "dagar den här veckan" visas bredvid. Omprövas i 3F.',
    O4_mcMaxStageYounger: 2,          // flerval får lyfta till stadium 2 för yngre
    O5_grades: 'E/C/A bara för förälder, märkt "övningsresultat – inte en betygsprognos". Barn: Bra koll / Öva lite mer / För lite underlag.',
    O6_afterKlar: 'Diskret länk "Öva extra" – ingen stor "en till"-knapp när planerat arbete är klart.',
    O7_shadowExit: { minDays: 14, needAllProfiles: true },
    O8_felbokDisplay: { younger: 3, middle: 5, older: 5 },
    O9_policy: 'Kursmallens standard + föräldraöverstyrning (bara i föräldraläget, visas aldrig för barnet).',
    K12_fast: { comeback: true, calibration: false, stage: false }, // snabbt svar = svag signal, avgör aldrig "slarv" på egen hand
    accuracyBand: [0.70, 0.85],       // diagnostiskt jämförelseband, INTE ett mål som passen styrs mot
  };

  /* ---------- Policyer (åldersanpassad upplevelse) ---------- */
  const POLICIES = {
    younger: { name: 'younger', n: 8, maxSubjects: 2, maxNew: 1, dueCap: 6, intervalMult: 0.8, mcMaxStage: 2, upRun: 3, downRun: 2, rescueAfter: 2, bossStretchRun: 3, warmups: 2, fbCap: 4, maxItems: 10 },
    middle: { name: 'middle', n: 8, maxSubjects: 3, maxNew: 2, dueCap: 10, intervalMult: 1.0, mcMaxStage: 1, upRun: 3, downRun: 2, rescueAfter: 2, bossStretchRun: 2, warmups: 1, fbCap: 6, maxItems: 12 },
    older: { name: 'older', n: 10, maxSubjects: 4, maxNew: 3, dueCap: 14, intervalMult: 1.0, mcMaxStage: 1, upRun: 3, downRun: 3, rescueAfter: 2, bossStretchRun: 2, warmups: 1, fbCap: 8, maxItems: 14 },
  };
  const STAGE_DAYS = [0, 1, 3, 7, 14, 30, 60];
  const intervalDays = (st, pol, L) => st === 0 ? 0 : Math.max(1, Math.round((pol.stages || STAGE_DAYS)[st] * pol.intervalMult * ((L && L.ivMult) || 1)));
  // Personlig kalibrering mot ≈80 % vid fördröjd hämtning. 20 senaste hämtningar, gräns 0,5–1,4, steg ≤0,1.
  function calibrate(L) { const r = L.rs || []; if (r.length < 10) return; const rate = r.reduce((a, b) => a + b, 0) / r.length; const target = (L.ivMult || 1) * (1 + 1.5 * (rate - 0.8)); const cur = L.ivMult || 1; L.ivMult = +Math.max(0.5, Math.min(1.4, cur + Math.max(-0.1, Math.min(0.1, target - cur)))).toFixed(2); }

  /* ---------- Bevisvärde ---------- */
  function evidenceWeight(ev) {
    const kindW = ev.kind === 'free' ? 1 : ev.kind === 'open' ? 0.8 : ev.kind === 'order' ? 0.6 : ev.kind === 'mc' ? Math.max(0.15, 1 - 1 / (ev.k || 4)) * 0.6 : 0.5;
    const helpW = { none: 1, hint: 0.5, rescue: 0.25, solution: 0 }[ev.help || 'none'];
    const ctxW = { first: 1, repeat: 0.6, retry: 0.3, exam: 1.2 }[ev.ctx || 'first'];
    return +(kindW * helpW * ctxW).toFixed(3);
  }

  /* ---------- Konceptstatus ---------- */
  function newConcept() { return { st: 0, due: 0, lvl: 1, n: 0, ok: 0, okInd: 0, lap: 0, lastOk: 0, lastSeen: 0, okRun: 0, failRun: 0, lvlSess: null, mcOk: 0, fb: null, items: [], ev: [] }; }
  function cstate(L, id) { return L.c[id] || (L.c[id] = newConcept()); }
  function newLE() { return { v: 2, c: {}, clock: { last: 0, server: 0 } }; }
  // Diagnostik (3B): ackumuleras deterministiskt i samma omspelning – lagras inte separat.
  function diag(L) { return L.d || (L.d = { ret: [0, 0], retDue: [0, 0], retEarly: [0, 0], wrong: 0, fastWrong: 0, fw: [0, 0], sw: [0, 0], mcAdv: 0, freeAdv: 0, lapses: 0, fbOpened: 0, fbVerified: 0, newSeen: 0 }); }
  function engineNow(L, deviceNow) { const t = Math.max(deviceNow, L.clock.last || 0, L.clock.server || 0); L.clock.last = t; return t; }

  /* Registrera ett svar (prototypens regler oförändrade + diagnostik). Deterministisk. */
  function recordEvidence(L, cat, cid, ev, nowRaw, pol, sess) {
    const now = engineNow(L, nowRaw); const c = cstate(L, cid); const def = cat[cid] || {}; const D = diag(L);
    const before = { st: c.st, due: c.due, lvl: c.lvl, fb: c.fb && c.fb.s };
    const reasons = []; const rewards = [];
    const w = evidenceWeight(ev); const independent = ev.ok && ev.help === 'none';
    const firstInSess = ev.ctx === 'first' || ev.ctx === 'exam';
    if (c.n === 0) { D.newSeen++; c.fs = Math.round(now / 1000); }
    if (ev.kind && ev.kind !== 'mc') c.kf = 1;
    c.n++; c.lastSeen = now; const today = dayIdx(now);
    // 3B-diagnostik: hämtningsträffsäkerhet (första försöket i passet på något redan inlärt)
    if (firstInSess && before.st >= 1 && ev.ctx !== 'exam') {
      const hit = independent ? 1 : 0; D.ret[0]++; D.ret[1] += hit;
      if (before.due && before.due <= now) { D.retDue[0]++; D.retDue[1] += hit; L.dd = L.dd && L.dd.d === today ? L.dd : { d: today, n: 0 }; L.dd.n++; } else { D.retEarly[0]++; D.retEarly[1] += hit; }
    }
    // 3B-diagnostik K-12: utfallet nästa gång (senare dygn) efter ett snabbt resp. långsamt fel
    if (firstInSess && c.pw && today > c.pw.d) { const b = c.pw.f ? D.fw : D.sw; b[0]++; if (independent) b[1]++; delete c.pw; }
    if (!ev.ok && firstInSess && ev.ctx !== 'exam') { D.wrong++; if (ev.fast) D.fastWrong++; c.pw = { d: today, f: ev.fast ? 1 : 0 }; }
    if (firstInSess && c.st >= 1 && ev.ctx !== 'exam' && (ev.help === 'none' || !ev.ok)) L.rs = [...(L.rs || []), ev.ok ? 1 : 0].slice(-20);
    const I = intervalDays(c.st, pol, L); const elapsedD = c.lastOk ? (now - c.lastOk) / DAY : Infinity;
    const recallCapable = def.recall === true || (def.recall == null && !!c.kf) || (def.kinds || []).some(k => k !== 'mc');
    if (ev.ok) {
      c.ok++; if (independent) { c.okInd++; c.okRun++; } c.failRun = 0;
      const mcBlocked = ev.kind === 'mc' && c.st >= pol.mcMaxStage && recallCapable;
      const mcOnlyNeedsTwo = ev.kind === 'mc' && !recallCapable && c.st >= pol.mcMaxStage;
      const qualifying = independent && firstInSess && w >= 0.3 && !mcBlocked;
      const hintLearn = ev.ok && ev.help === 'hint' && c.st === 0 && firstInSess;
      if (hintLearn) { c.st = 1; c.lastOk = now; reasons.push('rätt med ledtråd på nytt koncept → stadium 1 (repetition imorgon)'); }
      else if (qualifying && mcOnlyNeedsTwo && !c.mcOk) { c.mcOk = 1; reasons.push('flervalskoncept: första fördröjda träffen noterad, nästa avgör'); }
      else if (qualifying) {
        if (c.st === 0) { c.st = 1; reasons.push('lärt idag → kommer tillbaka imorgon'); }
        else if (elapsedD >= 0.5 * I) { c.st = Math.min(6, c.st + 1); reasons.push(`hämtat efter ${elapsedD.toFixed(1)} d (intervall ${I} d) → stadium ${c.st}`); rewards.push('REMEMBERED'); if (ev.kind === 'mc') D.mcAdv++; else D.freeAdv++; if (mcOnlyNeedsTwo) c.mcOk = 0; }
        else reasons.push(`för tidig hämtning (${elapsedD.toFixed(1)} d < ${(0.5 * I).toFixed(1)} d) → räknas som övning`);
        c.lastOk = now;
      } else reasons.push(mcBlocked ? 'flerval räcker inte på detta stadium → behöver eget svar' : !independent ? `rätt med ${ev.help} → delvis bevis` : 'upprepning i samma pass → delvis bevis');
    } else {
      c.failRun++; c.okRun = 0;
      if (ev.ctx !== 'retry' && ev.help !== 'rescue') {
        const old = c.st; const early = c.lastOk && elapsedD < 0.5 * I;
        if (ev.restart && old >= 2) { c.st = old - 1; reasons.push(`återstart efter uppehåll: rostigt, inte glömt → stadium ${old} → ${c.st}`); }
        else if (early && old >= 2) { c.st = old - 1; reasons.push(`fel vid tidig repetition → stadium ${old} → ${c.st} (mjuk sänkning)`); }
        else if (old >= 3) { c.st = Math.max(1, old - 2); c.lap++; D.lapses++; reasons.push(`glömt från stadium ${old} → ${c.st}`); }
        else if (old >= 1) { c.st = 1; if (old === 2) { c.lap++; D.lapses++; } reasons.push('fel → tillbaka till stadium 1'); }
        else reasons.push('fel på nytt koncept → fortsätter öva');
      } else reasons.push('fel vid omförsök → ingen extra sänkning');
    }
    c.due = dayStart(now) + Math.max(1, intervalDays(c.st, pol, L)) * DAY;
    if (ev.ok && !independent && c.st > 0) c.due = Math.min(c.due, dayStart(now) + Math.max(1, Math.ceil(intervalDays(c.st, pol, L) / 2)) * DAY);
    const maxLvl = def.maxLvl || 3;
    if (sess && c.lvlSess !== sess.id) {
      if (independent && c.okRun >= pol.upRun && c.lvl < maxLvl) { c.lvl++; c.okRun = 0; c.lvlSess = sess.id; reasons.push(`nivå upp → ${c.lvl}`); }
      else if (!ev.ok && c.failRun >= pol.downRun && c.lvl > 1 && ev.ctx !== 'exam') { c.lvl--; c.failRun = 0; c.lvlSess = sess.id; reasons.push(`nivå ner → ${c.lvl}`); }
    }
    // Felboken 2.0 (härlett av bevis; i 3B osynlig för barnet)
    const learnedBefore = before.st >= 1; c.failDays = c.failDays || []; if (!ev.ok && firstInSess && !c.failDays.includes(today)) c.failDays = [...c.failDays, today].slice(-3);
    const fbWorthy = !ev.ok && ev.help !== 'rescue' && !ev.restart && (ev.ctx === 'exam' || (firstInSess && learnedBefore) || c.failDays.filter(d => today - d <= 14).length >= 2 || (c.fb && c.fb.s !== 'resolved'));
    if (!ev.ok && ev.restart && c.fb && c.fb.s !== 'resolved') { c.fb.s = 'open'; c.fb.wd = today; }
    if (fbWorthy) {
      if (!c.fb || c.fb.s === 'resolved') { D.fbOpened++; c.fb = { s: 'open', at: now, wd: today, wrong: 1, items: [ev.item], reopened: c.fb ? 1 : 0, fast: !!ev.fast, firstFail: ev.ctx === 'first' || ev.ctx === 'exam' }; reasons.push(c.fb.reopened ? 'Felboken: öppnad igen' : 'Felboken: ny'); }
      else { c.fb.s = 'open'; c.fb.wrong++; c.fb.wd = today; if (ev.ctx === 'first' || ev.ctx === 'exam') c.fb.firstFail = true; if (!c.fb.items.includes(ev.item)) c.fb.items = [...c.fb.items, ev.item].slice(-4); c.fb.fast = c.fb.fast && !!ev.fast; }
    } else if (ev.ok && c.fb && c.fb.s !== 'resolved') {
      const differentItem = !c.fb.items.includes(ev.item) || (ev.onlyVariant && today >= c.fb.wd + 2);
      if (independent && firstInSess && today > c.fb.wd && differentItem && (c.fb.s === 'open' || c.fb.s === 'corrected')) {
        c.fb.s = 'verified'; c.fb.vd = today; D.fbVerified++; reasons.push('Felboken: verifierat efter minst ett dygn med ny fråga → REVANSCH');
        const lastCb = c.cb || -99; L.cbDay = L.cbDay && L.cbDay.d === today ? L.cbDay : { d: today, n: 0 };
        if ((!DECISIONS.K12_fast.comeback || !c.fb.fast) && c.fb.firstFail && today - lastCb >= 7 && L.cbDay.n < 2) { rewards.push('COMEBACK'); c.cb = today; L.cbDay.n++; }
      } else if (independent && firstInSess && c.fb.s === 'verified' && today >= c.fb.vd + 2 && differentItem) { c.fb.s = 'resolved'; c.fb.rd = today; reasons.push('Felboken: löst (två fördröjda träffar)'); }
      else if (c.fb.s === 'open' && today === c.fb.wd && ev.ok) { c.fb.s = 'corrected'; reasons.push('Felboken: rättat i passet – verifieras tidigast imorgon'); }
      if (c.st >= 3 && c.fb.s !== 'resolved' && c.fb.s !== 'open') { c.fb.s = 'resolved'; c.fb.rd = today; }
    }
    if (!ev.ok && !ev.restart && c.st <= 1 && (c.failDays || []).filter(d => today - d <= 14).length >= 2) c.teach = 1; else if (independent && c.st >= 2) c.teach = 0;
    if (independent && c.st >= 4 && !c.mastered) { c.mastered = 1; rewards.push('MASTERY'); }
    if (independent && ev.role === 'boss' && ev.lvl > (sess && sess.baseLvl && sess.baseLvl[cid] || c.lvl)) rewards.push('CHALLENGE');
    if (ev.item) c.items = [...c.items.filter(x => x !== ev.item), ev.item].slice(-6);
    c.ev = [...c.ev, [Math.round(now / 1000), ev.ok ? 1 : 0, KCODE[ev.kind] || 'f', HCODE[ev.help || 'none'] || 'n', XCODE[ev.ctx || 'first'] || 'f']].slice(-12);
    const after = { st: c.st, due: c.due, lvl: c.lvl, fb: c.fb && c.fb.s };
    return { diff: { before, after }, reasons, rewards, weight: w };
  }
  const KCODE = { free: 'f', mc: 'm', open: 'p', order: 'r' }, HCODE = { none: 'n', hint: 'h', solution: 's', rescue: 'r' }, XCODE = { first: 'f', repeat: 'p', retry: 'r', exam: 'e' };
  const inv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
  const KDEC = inv(KCODE), HDEC = inv(HCODE), XDEC = inv(XCODE);

  /* Tillämpa en logghändelse: kalibrering sker lat vid FÖRSTA händelsen i ett nytt pass (samma live som vid omspelning). */
  function apply(L, cat, e, pol) {
    if (e.sess && L.lastSess !== e.sess) { if (L.lastSess) calibrate(L); L.lastSess = e.sess; }
    return recordEvidence(L, cat, e.cid, e, e.t, pol, { id: e.sess });
  }

  /* ---------- Etiketter och föräldrabevis ---------- */
  function felbokVisible(L) { return Object.entries(L.c).filter(([, c]) => c.fb && (c.fb.s === 'open' || c.fb.s === 'corrected')).map(([id]) => id); }
  // O-8: högst 3/5/5 synliga poster, resten "fler väntar" (äldst först – längst väntat)
  function felbokDisplay(L, pol) { const all = felbokVisible(L).sort((a, b) => (L.c[a].fb.at - L.c[b].fb.at) || (a < b ? -1 : 1)); const cap = DECISIONS.O8_felbokDisplay[pol.name] || 5; return { shown: all.slice(0, cap), more: Math.max(0, all.length - cap), total: all.length }; }
  // O-2: nyss verifierade/klarade poster visas som framgång i 7 dagar
  function felbokRecentWins(L, now) { const d = dayIdx(now); return Object.entries(L.c).filter(([, c]) => c.fb && (c.fb.s === 'verified' || c.fb.s === 'resolved') && d - (c.fb.rd || c.fb.vd || 0) <= DECISIONS.O2_verifiedDays).map(([id]) => id); }
  function childLabel(c, now, pol, L) {
    if (!c || c.n === 0) return 'Nytt';
    const overdue = c.due && now > c.due + intervalDays(c.st, pol, L) * DAY;
    if (c.fb && c.fb.s === 'open') return 'Tränar';
    if (overdue && c.st >= 2) return 'Behöver repetition';
    if (c.st >= 4) return 'Säker'; if (c.st >= 2) return 'På väg'; return 'Tränar';
  }
  function delayedOks(c, sinceMs) { return c.ev.filter((e, i) => e[1] === 1 && e[3] === 'n' && (e[4] === 'f' || e[4] === 'e') && e[0] * 1000 >= sinceMs && i > 0 && (e[0] - c.ev[i - 1][0]) >= 86400 * 0.9).length; }
  // O-5: provberedskap per område – inga procent, inget betyg
  function readiness(c, now) {
    if (!c || c.n < 3) return 'För lite underlag';
    if (c.fb && c.fb.s === 'open') return 'Öva lite mer';
    if (c.st >= 3 || (c.st === 2 && delayedOks(c, now - 7 * DAY) >= 1)) return 'Bra koll';
    return 'Öva lite mer';
  }
  function parentInsights(L, cat, now, pol) {
    const strong = [], weak = [], thin = [];
    for (const [id, c] of Object.entries(L.c)) {
      const name = (cat[id] || {}).name || id;
      if (c.n < 4) { if (c.n > 0) thin.push(name); continue; }
      const d30 = delayedOks(c, now - 30 * DAY);
      if (c.st >= 4 || (c.st >= 3 && d30 >= 2)) strong.push(name);
      else if ((c.fb && c.fb.s === 'open' && c.fb.wrong >= 2 && dayIdx(now) - dayIdx(c.fb.at) >= 1) || c.lap >= 1 && c.st <= 2 || (c.rescue7 || 0) >= 2) weak.push(name);
    }
    return { strong, weak, thin };
  }

  /* ---------- Kör!: prioritet ---------- */
  // P = 40·FÖRFALLEN + 30·FELBOK + 35·PROV + 15·SVAG + 12·NY + 8·LÄRARFOKUS − 20·ÄMNESOBALANS
  const W = { due: 40, fb: 30, exam: 35, weak: 15, new: 12, focus: 8, balance: 20 };
  function examUrgency(daysLeft) { if (daysLeft == null || daysLeft < 0 || daysLeft > 21) return 0; return Math.pow(Math.min(1, (21 - daysLeft) / 19), 1.5); }
  function conf(c) { return !c || c.n === 0 ? 0 : Math.min(1, c.st / 4); }
  function priority(L, cat, cid, now, ctx, pol) {
    const c = L.c[cid]; const def = cat[cid]; const comps = {};
    if (def.kind === 'deck') {
      // 3B: glosor följer Leitner oförändrat – en glos-"koncept" är förfallen när orden i den är förfallna.
      const ds = (ctx.decks || {})[cid]; if (ds && ds.due > 0) comps.due = Math.min(1, 0.5 + ds.due / 20); else if (ds && ds.nw > 0) comps.new = 1;
    } else {
      if (c && c.n > 0 && c.due && c.due <= now) { const I = Math.max(1, intervalDays(c.st, pol, L)); comps.due = Math.min(1, 0.5 + 0.5 * ((now - c.due) / DAY) / I); }
      if (c && c.fb && c.fb.s !== 'resolved' && dayIdx(now) > c.fb.wd) comps.fb = c.fb.s === 'open' ? 1 : c.fb.s === 'corrected' ? 0.9 : 0.6;
      if (c && c.n > 0 && c.st <= 1) comps.weak = 1 - conf(c) * 0.5;
      if ((!c || c.n === 0) && (def.prereq || []).every(p => L.c[p] && L.c[p].st >= 2)) comps.new = 1;
    }
    const ex = (ctx.exams || []).filter(e => e.concepts.includes(cid)).map(e => examUrgency(Math.ceil((e.at - now) / DAY)));
    if (ex.length) { const u = Math.max(...ex); if (u > 0) comps.exam = u * (1 - conf(c)) + u * 0.25; }
    if (def.focus) comps.focus = 1;
    const share = ctx.recentSubjectShare ? (ctx.recentSubjectShare[def.subject] || 0) : 0; const fair = 1 / Math.max(1, ctx.subjectCount || 1);
    if (share > fair) comps.balance = -Math.min(1, (share - fair) / (1 - fair + 1e-9));
    let P = 0; const parts = {}; for (const [k, v] of Object.entries(comps)) { parts[k] = +(W[k] * v).toFixed(2); P += parts[k]; }
    const top = Object.entries(parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
    return { cid, P: +P.toFixed(2), parts, why: top ? top[0] : 'maintenance' };
  }
  const WHY_TEXT = { due: 'dags att minnas', fb: 'Felboken – revansch', exam: 'provet närmar sig', weak: 'behöver mer övning', new: 'nytt att lära', focus: 'lärarens fokusområde', maintenance: 'håller kunskapen varm' };
  function rankAll(L, cat, now, ctx, pol) {
    return Object.keys(cat).filter(id => cat[id].active !== false).map(id => priority(L, cat, id, now, ctx, pol))
      .sort((a, b) => b.P - a.P || (b.parts.due || 0) - (a.parts.due || 0) || (b.parts.fb || 0) - (a.parts.fb || 0) || (b.parts.exam || 0) - (a.parts.exam || 0) || ((L.c[a.cid] || {}).due || 0) - ((L.c[b.cid] || {}).due || 0) || (a.cid < b.cid ? -1 : 1));
  }

  /* Sätt ihop ett pass: UPPVÄRMNING · KOMMER DU IHÅG? · REVANSCH · DAGENS FOKUS · BOSSEN (prototypen oförändrad) */
  function planSession(L, cat, now, ctx, pol, opts = {}) {
    let n = opts.n || pol.n; const ranked = rankAll(L, cat, now, ctx, pol); const slots = [];
    const valuable = ranked.filter(r => (r.parts.due || 0) + (r.parts.fb || 0) + (r.parts.exam || 0) + (r.parts.new || 0) + (r.parts.weak || 0) > 0).length;
    const light = valuable <= 1; if (light) n = Math.min(n, 4);
    const restart = ctx.lastSessionAt && (now - ctx.lastSessionAt) / DAY > 10; if (restart) n = Math.max(5, Math.round(n * 0.75));
    const maxItems = restart ? n + 2 : pol.maxItems;
    const examDays = Math.min(99, ...(ctx.exams || []).map(e => Math.ceil((e.at - now) / DAY)).filter(d => d >= 0));
    const examFirst = (a, b) => (examDays <= 7 ? ((b.parts.exam > 0) - (a.parts.exam > 0)) : 0);
    const subjOf = (cid) => cat[cid].subject; const subjects = new Set(); const used = new Map();
    const canUse = (cid, max = 2) => (used.get(cid) || 0) < max && (subjects.has(subjOf(cid)) || subjects.size < pol.maxSubjects);
    const take = (r, role) => { slots.push({ cid: r.cid, role, why: role === 'boss' ? 'utmaning' : WHY_TEXT[r.why] || r.why, P: r.P, parts: r.parts }); used.set(r.cid, (used.get(r.cid) || 0) + 1); subjects.add(subjOf(r.cid)); };
    const absentDays = ctx.lastSessionAt ? (now - ctx.lastSessionAt) / DAY : 0;
    const dueList = ranked.filter(r => r.parts.due > 0 && !(r.parts.fb > 0)).sort(examFirst);
    const fbList = ranked.filter(r => r.parts.fb > 0).sort(examFirst);
    const newList = ranked.filter(r => r.parts.new > 0);
    const focusList = ranked.filter(r => !(r.parts.due > 0) && !(r.parts.fb > 0) && (r.parts.exam > 0 || r.parts.weak > 0 || r.parts.focus > 0 || r.parts.new > 0));
    const warmN = absentDays > 7 ? pol.warmups + 1 : pol.warmups;
    const warm = ranked.filter(r => L.c[r.cid] && L.c[r.cid].st >= 2 && L.c[r.cid].due <= now + DAY && (L.c[r.cid].ev.slice(-1)[0] || [])[1] === 1 && !(L.c[r.cid].fb && L.c[r.cid].fb.s !== 'resolved')).sort((a, b) => examFirst(a, b) || L.c[b.cid].st - L.c[a.cid].st || (L.c[a.cid].due - L.c[b.cid].due) || (a.cid < b.cid ? -1 : 1));
    for (const r of warm) { if (slots.length >= Math.min(warmN, Math.floor(n / 4))) break; if (canUse(r.cid, 1)) { take(r, 'warmup'); slots[slots.length - 1].lvlDelta = -1; } }
    const dueSlots = Math.max(1, Math.round(n * (examDays <= 7 ? 0.25 : 0.4)));
    let dueTaken = 0; for (const r of dueList) { if (dueTaken >= dueSlots || (ctx.dueDoneToday || 0) + dueTaken >= pol.dueCap) break; if (!used.has(r.cid) && canUse(r.cid, 1)) { take(r, 'remember'); dueTaken++; } }
    const fbSlots = examDays <= 1 ? 1 : 2; let fbTaken = 0;
    for (const r of fbList) { if (fbTaken >= fbSlots) break; if (canUse(r.cid, 1)) { take(r, 'revansch'); fbTaken++; } }
    const bossReserve = 1; let newTaken = 0; const openFb = Object.values(L.c).filter(c => c.fb && c.fb.s === 'open').length;
    const maxNew = examDays <= 1 || openFb > pol.fbCap ? 0 : pol.maxNew;
    if (maxNew > 0 && newList.length) { const r = newList.find(x => canUse(x.cid, 2)); if (r && slots.length < n - bossReserve - 1) { take(r, 'focus'); take(r, 'focus'); newTaken++; } }
    for (const r of focusList.concat(newList)) {
      if (slots.length >= n - bossReserve) break;
      const isNew = r.parts.new > 0 && !(L.c[r.cid] && L.c[r.cid].n > 0);
      if (isNew && newTaken >= maxNew) continue;
      if (!canUse(r.cid, 2)) continue;
      take(r, 'focus'); if (isNew) newTaken++;
      if (slots.length < n - bossReserve && canUse(r.cid, 2) && (r.parts.exam > 0 || r.parts.weak > 0 || isNew)) take(r, 'focus');
    }
    for (const r of ranked) { if (slots.length >= n - bossReserve) break; if (!used.has(r.cid) && canUse(r.cid, 1) && L.c[r.cid] && L.c[r.cid].n > 0) take(r, r.parts.due ? 'remember' : 'practice'); }
    const bossC = slots.filter(s => s.role === 'focus' || s.role === 'remember').map(s => s.cid).find(cid => !(L.c[cid] && L.c[cid].fb && L.c[cid].fb.s === 'open'));
    if (slots.length < n) slots.push({ cid: bossC || (slots[0] && slots[0].cid), role: 'boss', why: 'utmaning', P: 0, parts: {}, dynamic: true, examC: examDays <= 7 ? (ctx.exams || []).flatMap(e => e.concepts) : [] });
    while (slots.length < n && ranked.length) { const r = ranked[slots.length % ranked.length]; if (canUse(r.cid, 3)) take(r, 'practice'); else break; }
    const finish = (arr) => { arr.light = light; arr.restart = !!restart; arr.maxItems = maxItems; return arr; };
    if (pol.name === 'younger') { const order = [...new Set(slots.map(s => subjOf(s.cid)))]; const head = slots.filter(s => s.role === 'warmup'); const tail = slots.filter(s => s.role === 'boss'); const mid = slots.filter(s => s.role !== 'warmup' && s.role !== 'boss').sort((a, b) => order.indexOf(subjOf(a.cid)) - order.indexOf(subjOf(b.cid))); return finish([...head, ...mid, ...tail]); }
    return finish(slots);
  }
  function pickBoss(L, sessState, slots, pol) {
    const ex = sessState.examC || []; const okC = Object.entries(sessState.byC).filter(([, s]) => s.fails === 0 && s.n > 0).map(([cid]) => cid).sort((a, b) => (ex.includes(b) - ex.includes(a)) || (L.c[b].okRun - L.c[a].okRun) || (L.c[b].st - L.c[a].st) || (a < b ? -1 : 1));
    if (okC.length) { const cid = okC[0]; const stretch = L.c[cid].okRun >= pol.bossStretchRun; return { cid, stretch, why: stretch ? 'utmaning (nivå upp)' : 'utmaning' }; }
    const strong = Object.entries(L.c).filter(([, c]) => c.st >= 2).sort((a, b) => b[1].st - a[1].st)[0];
    return strong ? { cid: strong[0], stretch: false, why: 'gulduppgift' } : null;
  }
  function rescueTrigger(sessState, cid, pol) {
    if (sessState.mode === 'exam') return null;
    const s = sessState.byC[cid] || { fails: 0, run: 0, rescued: 0 };
    if (s.rescued) return 'defer';
    if (s.run >= pol.rescueAfter) return 'rescue';
    const last4 = sessState.results.slice(-4); if (last4.length === 4 && last4.filter(x => !x).length >= 3 && !sessState.eased) return 'ease';
    return null;
  }

  /* ---------- Bevislogg: lagring, sammanslagning, omspelning ---------- */
  // Kompakt lagring: [t(s), dev, seq, cid, ok, kind, k, help, ctx, item, fast, sess, lvl, restart]. Inga fria svarstexter, ingen svarstid.
  function encodeEv(e) { return [Math.round(e.t / 1000), e.dev, e.seq, e.cid, e.ok ? 1 : 0, KCODE[e.kind] || 'f', e.k || 0, HCODE[e.help || 'none'] || 'n', XCODE[e.ctx || 'first'] || 'f', e.item || '', e.fast ? 1 : 0, e.sess || '', e.lvl || 1, e.restart ? 1 : 0]; }
  function decodeEv(a) { return { t: a[0] * 1000, dev: a[1], seq: a[2], cid: a[3], ok: !!a[4], kind: KDEC[a[5]] || 'free', k: a[6], help: HDEC[a[7]] || 'none', ctx: XDEC[a[8]] || 'first', item: a[9], fast: !!a[10], sess: a[11], lvl: a[12], restart: !!a[13] }; }
  const evKey = (e) => Array.isArray(e) ? e[1] + ':' + e[2] : e.dev + ':' + e.seq;
  const evT = (e) => Array.isArray(e) ? e[0] * 1000 : e.t;
  const evOrder = (x, y) => evT(x) - evT(y) || (evKey(x).split(':')[0] < evKey(y).split(':')[0] ? -1 : evKey(x).split(':')[0] > evKey(y).split(':')[0] ? 1 : (Array.isArray(x) ? x[2] - y[2] : x.seq - y.seq));
  function mergeLog(a, b) { const m = new Map(); for (const e of [...(a || []), ...(b || [])]) m.set(evKey(e), e); return [...m.values()].sort(evOrder); }
  function replay(log, cat, pol, base) { const L = base ? JSON.parse(JSON.stringify(base)) : newLE(); for (const raw of log) { const e = Array.isArray(raw) ? decodeEv(raw) : raw; if (!cat[e.cid]) cat = { ...cat, [e.cid]: { id: e.cid, subject: 'okänt', active: false } }; apply(L, cat, e, pol); } return L; }
  // stabil hash för deterministisk val av bas vid konflikt
  function stable(o) { if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']'; if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'; return JSON.stringify(o); }
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }

  /* Sammanslagning av två enheters le (kommutativ, idempotent).
     Bas: flest inbakade händelser vinner; lika → tidigast t0 (migreringsbaser); lika → hash. Loggarna förenas på dev:seq.
     Händelser som är äldre än vald bas och bara fanns i den andra basen kan inte spelas om (känd begränsning, se rapport). */
  function mergeLE(a, b) {
    if (!a || !a.v) return b && b.v ? b : (a || b || null); if (!b || !b.v) return a;
    const rank = (x) => [-(x.folded || 0), x.t0 || 0, hash(stable(x.base || {}))];
    const ra = rank(a), rb = rank(b); const cmp = ra[0] - rb[0] || ra[1] - rb[1] || (ra[2] < rb[2] ? -1 : ra[2] > rb[2] ? 1 : 0);
    const pick = cmp <= 0 ? a : b; const other = pick === a ? b : a;
    const log = mergeLog(a.log, b.log).filter(e => evT(e) > (pick.t0 || 0));
    const seqs = { ...(other.seqs || {}) }; for (const [d, n] of Object.entries(pick.seqs || {})) seqs[d] = Math.max(seqs[d] || 0, n);
    const sh = new Map(); for (const r of [...(other.shadow || []), ...(pick.shadow || [])]) { const o = sh.get(r.id); sh.set(r.id, !o || (r.done && !o.done) || ((r.a || []).length > (o.a || []).length) ? r : o); }
    const shadow = [...sh.values()].sort((x, y) => x.t - y.t || (x.id < y.id ? -1 : 1)).slice(-SHADOW_MAX);
    return { ...other, ...pick, log, seqs, shadow, srv: Math.max(a.srv || 0, b.srv || 0) || undefined };
  }
  const SHADOW_MAX = 40, LOG_SOFT = 300, LOG_HARD = 450, FOLD_AGE = 14 * DAY;
  /* Kompaktering: bakar in gamla händelser i basen så att lagringen hålls begränsad. */
  function compact(le, cat, pol, now) {
    if (!le || (le.log || []).length <= LOG_SOFT) return false;
    const log = le.log.slice().sort(evOrder); let cut = 0;
    while (cut < log.length - 200 && evT(log[cut]) < now - FOLD_AGE) cut++;
    if (log.length - cut > LOG_HARD) cut = log.length - LOG_SOFT;
    if (cut <= 0) return false;
    while (cut < log.length && evT(log[cut]) === evT(log[cut - 1])) cut++;   // vik alla händelser med samma tidsstämpel
    const folded = log.slice(0, cut); const base = replay(folded, cat, pol, le.base);
    le.base = base; le.t0 = evT(folded[folded.length - 1]); le.folded = (le.folded || 0) + folded.length; le.log = log.slice(cut);
    return true;
  }

  /* ---------- Migrering v1 → le (deterministisk, idempotent, v1 orört) ---------- */
  // mapping: v1-skillId → koncept-id. Svagt bevis, aldrig uppblåst: max stadium 2. Förfallodagar sprids (≤ dueCap per dygn, dygn 1–7).
  function migrateV1(p, cat, mapping, now, pol) {
    if (p.le && p.le.v === 2) return p.le;
    const L = newLE(); L.clock.last = now; const strong = [];
    for (const skillId of Object.keys(p.skills || {}).sort()) {
      const s = p.skills[skillId]; const cid = mapping[skillId]; if (!cid || !cat[cid]) continue;
      const c = cstate(L, cid); c.lvl = Math.max(1, Math.min((cat[cid].maxLvl || 3), s.lvl || 1)); c.mig = { att: s.att || 0, cor: s.cor || 0, m: Math.round(s.m || 0) };
      if (s.att >= 10 && s.m >= 75) { c.st = 2; c.n = 1; c.lastOk = Math.min(now, s.last || now); strong.push(cid); }
      else if (s.att >= 5 && s.m >= 40) { c.st = 1; c.n = 1; c.lastOk = Math.min(now, s.last || now); strong.push(cid); }
      else if (s.att > 0) { c.st = 0; c.n = 1; c.due = dayStart(now) + DAY; }
    }
    strong.sort((x, y) => (hash(x) < hash(y) ? -1 : 1) || (x < y ? -1 : 1)).forEach((cid, i) => { L.c[cid].due = dayStart(now) + Math.min(7, 1 + Math.floor(i / Math.max(1, Math.min(pol.dueCap, 3)))) * DAY; });
    for (const mi of (p.mistakes || [])) if (mi.cat === 'math' && mapping[mi.skillId] && cat[mapping[mi.skillId]]) { const c = cstate(L, mapping[mi.skillId]); if (!c.fb) c.fb = { s: 'open', at: Math.min(now, mi.at || now), wd: dayIdx(Math.min(now, mi.at || now)), wrong: 1, items: [], reopened: 0, fast: false, legacy: 1 }; }
    return { v: 2, base: L, t0: now, folded: 0, log: [], seqs: {}, shadow: [], migratedFrom: 'v1', migratedAt: now };
  }

  return { DAY, dayIdx, dayStart, DECISIONS, POLICIES, STAGE_DAYS, intervalDays, calibrate, evidenceWeight, newConcept, cstate, newLE, engineNow, recordEvidence, apply,
    felbokVisible, felbokDisplay, felbokRecentWins, childLabel, readiness, parentInsights, delayedOks, W, WHY_TEXT, examUrgency, priority, rankAll, planSession, pickBoss, rescueTrigger,
    encodeEv, decodeEv, mergeLog, replay, mergeLE, compact, migrateV1, stable, hash, SHADOW_MAX, LOG_SOFT, LOG_HARD };
})();
if (typeof module !== 'undefined') module.exports = LE2;
