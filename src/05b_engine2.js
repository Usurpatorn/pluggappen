/* ========= Learning Engine v2 – kärna (Fas 3B skugga → Fas 3C–3H) =========
   Rena funktioner: tillstånd = f(bas, bevislogg, katalog, policy). Ingen Math.random, ingen DOM, inga appglobaler.
   Begrepp: koncept (vad en uppgift prövar) → bevis (hur svaret gavs) → konceptstatus → hämtningsschema → passplanering.
   ALLA vikter, trösklar och gränser finns i CFG nedan (dokumenterade, testade). Regeländringar sedan 3B är märkta "3C:" … "3H:".
   Schema: le.v = 2 (format), le.ev = 2 (händelseformat med förlängning, se encodeEv), regelversion RULES. Tillståndet härleds alltid
   genom omspelning med gällande regler, så en ny regelversion kräver ingen datamigrering. */
const LE2 = (() => {
  'use strict';
  const DAY = 86400000;
  const RULES = '3I.1';   // 3I (2.1): formmedvetna bevis – djupgrind för kunskapspunkter, form i bevisloggen, vilande moment leds vidare
  // Lokala dygn: förfallodagar ligger på lokala dygnsgränser.
  const tzOff = (t) => new Date(t).getTimezoneOffset() * 60000;
  const dayIdx = (t) => Math.floor((t - tzOff(t)) / DAY);
  const dayStart = (t) => { const d = dayIdx(t); const g = d * DAY; return g + tzOff(g); };

  /* ---------- Godkända beslut (Fas 3A, O-1 … O-9, K-12) ---------- */
  const DECISIONS = {
    O1_intervals: 'Behåll stegen 0/1/3/7/14/30/60 och ×0,8 för yngre; K-13 visade att en kortare stege inte hjälper.',
    O2_verifiedDays: 7,
    O3_streak: 'Streak behålls som positiv kontinuitet, ingen straffande text; "Pluggat N dagar den här veckan" visas bredvid.',
    O4_mcMaxStageYounger: 2,
    O5_grades: 'E/C/A bara för förälder, märkt "övningsindikation – inte ett förutsagt betyg". Barn: Bra koll / Öva lite mer / För lite underlag.',
    O6_afterKlar: 'Diskret länk "Öva extra" – ingen stor "en till"-knapp när planerat arbete är klart.',
    O7_shadowExit: { minDays: 14, needAllProfiles: true },
    O8_felbokDisplay: { younger: 3, middle: 5, older: 5 },
    O9_policy: 'Kursmallens standard + föräldraöverstyrning (bara i föräldraläget, visas aldrig för barnet).',
    K12_fast: { comeback: true, calibration: false, stage: false },
    accuracyBand: [0.70, 0.85],
  };

  /* ---------- CFG: alla vikter, trösklar och gränser på ett ställe ---------- */
  const CFG = {
    stageDays: [0, 1, 3, 7, 14, 30, 60],                 // stadium → intervall i dygn (före policy- och personlig faktor)
    calib: { min: 10, window: 20, target: 0.8, gain: 1.5, lo: 0.5, hi: 1.4, step: 0.1 },
    evidence: { kind: { free: 1, open: 0.8, order: 0.6, mc: 0.6, other: 0.5 }, help: { none: 1, hint: 0.5, rescue: 0.25, solution: 0 }, ctx: { first: 1, repeat: 0.6, retry: 0.3, exam: 1.2 }, qualify: 0.3, mcFloor: 0.15 },
    early: 0.5,                                          // hämtning före halva intervallet = övning, inget stadiesteg
    lapse: { drop: 2, softDrop: 1, examDrop: 1 },        // glömt från ≥3 → −2; tidig/återstart → −1; Testa mig-fel → −1 (skriver inte över långtidsbevis)
    // expireDays: en Felboks-post som inte rörts på 30 dygn försvinner ur Felboken (konceptet ligger kvar som svagt i schemat och kommer tillbaka via Kör!)
    fb: { failWindowDays: 14, failDaysToOpen: 2, resolveGapDays: 2, comebackCooldownDays: 7, comebackPerDay: 2, resolveStage: 3, teachEveryDays: 3, expireDays: 30 },
    level: { distinctItems: 2 },                         // nivå upp kräver variation: minst 2 olika uppgifter i rätt-serien
    // Prioritet P = Σ vikt × komponent (0..1). Komponenterna förklaras i priority().
    W: { due: 40, fb: 30, exam: 35, stale: 30, weak: 15, new: 12, prereq: 6, focus: 8, balance: 20, recent: 10, subj: 15 },
    subjectWaitDays: 7,                                  // ämnesrättvisa: ett ämne med behov som inte övats på 7 dygn får full extra vikt
    recentHours: 20,                                     // K-14 rotation: övat inom 20 h → låt något annat få turen först
    due: { base: 0.5, slope: 0.5, maintFactor: 0.6, maintStage: 4 },
    exam: { horizon: 21, ramp: 19, power: 1.5, floor: 0.25, readyDamp: 0.5, weekDays: 7, examFirstDays: 7, minShareLast3: 0.5 },
    // K-14: begränsad repetitionsskuld
    // loadCap: hur många halvlärda koncept (stadium ≤1) innan nytt bromsas. starveSessions: även bromsat kommer något nytt efter så många pass
    // (svält-skydd), men bara om lasten är under 2×loadCap; annars först efter starveSessionsHard pass (nytt ovanpå allt som glöms hjälper ingen).
    backlog: { share: 0.4, shareExam: 0.25, shareHigh: 0.5, shareMax: 0.6, maxWaitDays: 7, maxWaitMult: 2, loadCap: { younger: 6, middle: 9, older: 12 }, starveSessions: 4, starveSessionsHard: 8, breadthAbove: 1 },
    session: { restartDays: 10, absentWarmDays: 7, klarMax: 4, klarValuable: 1, bossMinItems: 5, warmMinItems: 6, revansch: 2, revanschExamEve: 1, range: { younger: [5, 8], middle: [6, 12], older: [5, 15] } },
    rescue: { maxPerSession: 2, seq: { younger: ['teach', 'supported', 'easier', 'normal'], middle: ['teach', 'supported', 'normal'], older: ['teach', 'normal'] }, insightCount: 2, insightDays: 7 },
    challenge: { minStage: 3, ceilingStage: 4, every: 2 },
    // 3I: djupgrind för kunskapspunkter med fördjupande former (samband, hitta felet, orsak, tillämpning, förklaring, flerstegs).
    // Från stadium 3 krävs djupbevis ≥ need: +1 per dygn för en flervalsfråga i djupform, +2 för eget svar/ordning i djupform.
    // Tur på flerval skyddas: två olika dygn krävs. Den andra djupträffen räknas då som giltig hämtning (inte flervalsspärrad).
    depth: { gateStage: 3, need: 2, forms: 'lmxaes' },
    reward: { REMEMBERED: { xp: 5 }, COMEBACK: { gems: 3 }, CHALLENGE: { gems: 2 }, MASTERY: { gems: 5 }, FOCUS: { gems: 2 }, CONSISTENCY: { gems: 5, days: 3 } },
  };

  /* ---------- Policyer (åldersanpassad upplevelse – samma motor) ---------- */
  const POLICIES = {
    younger: { name: 'younger', n: 8, maxSubjects: 2, maxNew: 1, dueCap: 6, intervalMult: 0.8, mcMaxStage: 2, upRun: 3, downRun: 2, rescueAfter: 2, bossStretchRun: 3, warmups: 2, fbCap: 4, maxItems: 10 },
    middle: { name: 'middle', n: 8, maxSubjects: 3, maxNew: 2, dueCap: 10, intervalMult: 1.0, mcMaxStage: 1, upRun: 3, downRun: 2, rescueAfter: 2, bossStretchRun: 2, warmups: 1, fbCap: 6, maxItems: 12 },
    older: { name: 'older', n: 10, maxSubjects: 4, maxNew: 3, dueCap: 14, intervalMult: 1.0, mcMaxStage: 1, upRun: 3, downRun: 3, rescueAfter: 2, bossStretchRun: 2, warmups: 1, fbCap: 8, maxItems: 14 },
  };
  const STAGE_DAYS = CFG.stageDays;
  const intervalDays = (st, pol, L) => st === 0 ? 0 : Math.max(1, Math.round((pol.stages || STAGE_DAYS)[st] * pol.intervalMult * ((L && L.ivMult) || 1)));
  function calibrate(L) { const k = CFG.calib; const r = L.rs || []; if (r.length < k.min) return; const rate = r.reduce((a, b) => a + b, 0) / r.length; const target = (L.ivMult || 1) * (1 + k.gain * (rate - k.target)); const cur = L.ivMult || 1; L.ivMult = +Math.max(k.lo, Math.min(k.hi, cur + Math.max(-k.step, Math.min(k.step, target - cur)))).toFixed(2); }

  /* ---------- Bevisvärde ---------- */
  function evidenceWeight(ev) {
    const E = CFG.evidence;
    const kindW = ev.kind === 'mc' ? Math.max(E.mcFloor, 1 - 1 / (ev.k || 4)) * E.kind.mc : (E.kind[ev.kind] != null ? E.kind[ev.kind] : E.kind.other);
    const helpW = E.help[ev.help || 'none']; const ctxW = E.ctx[ev.ctx || 'first'];
    return +(kindW * helpW * ctxW).toFixed(3);
  }

  /* ---------- Konceptstatus ---------- */
  function newConcept() { return { st: 0, due: 0, lvl: 1, n: 0, ok: 0, okInd: 0, lap: 0, lastOk: 0, lastSeen: 0, okRun: 0, failRun: 0, lvlSess: null, mcOk: 0, fb: null, items: [], ev: [] }; }
  function cstate(L, id) { return L.c[id] || (L.c[id] = newConcept()); }
  function newLE() { return { v: 2, c: {}, clock: { last: 0, server: 0 } }; }
  function diag(L) { return L.d || (L.d = { ret: [0, 0], retDue: [0, 0], retEarly: [0, 0], wrong: 0, fastWrong: 0, fw: [0, 0], sw: [0, 0], mcAdv: 0, freeAdv: 0, lapses: 0, fbOpened: 0, fbVerified: 0, newSeen: 0, ch: [0, 0], rescues: 0 }); }
  // Granskning H3: motorn räknar med HÄNDELSENS egen tid (samma live som vid omspelning). Förut max(enhet, senaste, server) –
  // ett pass med klockan framställd förgiftade då alla senare beräkningar (live ≠ omspelning, belöningar varje dag). clock.last = högvattenmärke.
  function engineNow(L, deviceNow) { L.clock.last = Math.max(deviceNow, L.clock.last || 0); return deviceNow; }
  const isDepthForm = (f) => !!f && CFG.depth.forms.includes(f);
  const isRecallCapable = (def, c) => def.recall === true || (def.recall == null && !!c.kf) || (def.kinds || []).some(k => k !== 'mc');

  /* Registrera ett svar. Deterministisk. Returnerar { diff, reasons, rewards, weight }. */
  function recordEvidence(L, cat, cid, ev, nowRaw, pol, sess) {
    const now = engineNow(L, nowRaw); const c = cstate(L, cid); const def = cat[cid] || {}; const D = diag(L); const today = dayIdx(now);
    const before = { st: c.st, due: c.due, lvl: c.lvl, fb: c.fb && c.fb.s };
    const reasons = []; const rewards = [];
    // 3H: Utmaning – fördjupning, skild från grundläggande hållbarhet. Påverkar aldrig stadium, förfallodag, nivå eller Felboken.
    if (ev.mode === 'challenge') {
      const ch = c.ch || (c.ch = { n: 0, ok: 0, run: 0, d: 0 }); ch.n++; ch.d = today; D.ch[0]++;
      if (ev.ok && ev.help === 'none') { ch.ok++; ch.run++; D.ch[1]++; rewards.push('CHALLENGE'); reasons.push('utmaning klarad → fördjupning'); } else { ch.run = 0; reasons.push('utmaning inte klarad → ingen påverkan på grundkunskapen'); }
      // Granskning L10: Utmaningen skrivs inte i c.ev (styr uppvärmning och fördröjda träffar). lastSeen uppdateras: konceptet HAR övats på djupet.
      c.lastSeen = now; if (ev.item) c.items = [...c.items.filter(x => x !== ev.item), ev.item].slice(-6);
      return { diff: { before, after: before }, reasons, rewards, weight: 0 };
    }
    const w = evidenceWeight(ev); const independent = ev.ok && ev.help === 'none';
    const firstInSess = ev.ctx === 'first' || ev.ctx === 'exam';
    const countsForLevel = ev.ctx !== 'retry' && ev.help !== 'rescue' && ev.ctx !== 'exam';
    if (c.n === 0) { D.newSeen++; c.fs = Math.round(now / 1000); L.newSess = L.sessN || 0; }
    if (ev.kind && ev.kind !== 'mc') c.kf = 1;
    c.n++; c.lastSeen = now;
    if (firstInSess && before.st >= 1 && ev.ctx !== 'exam') {
      const hit = independent ? 1 : 0; D.ret[0]++; D.ret[1] += hit;
      if (before.due && before.due <= now) { D.retDue[0]++; D.retDue[1] += hit; L.dd = L.dd && L.dd.d === today ? L.dd : { d: today, n: 0 }; L.dd.n++; } else { D.retEarly[0]++; D.retEarly[1] += hit; }
    }
    if (firstInSess && c.pw && today > c.pw.d) { const b = c.pw.f ? D.fw : D.sw; b[0]++; if (independent) b[1]++; delete c.pw; }
    if (!ev.ok && firstInSess && ev.ctx !== 'exam') { D.wrong++; if (ev.fast) D.fastWrong++; c.pw = { d: today, f: ev.fast ? 1 : 0 }; }
    if (firstInSess && c.st >= 1 && ev.ctx !== 'exam' && (ev.help === 'none' || !ev.ok)) L.rs = [...(L.rs || []), ev.ok ? 1 : 0].slice(-CFG.calib.window);
    // 3D: Rescue-räkning (föräldrainsikt vid upprepade Rescue)
    if (ev.role === 'X' && sess && c.rsSess !== sess.id) { c.rsSess = sess.id; D.rescues++; c.rescueDays = [...(c.rescueDays || []).filter(d => today - d <= 14), today].slice(-4); }
    const I = intervalDays(c.st, pol, L); const elapsedD = c.lastOk ? (now - c.lastOk) / DAY : Infinity;
    const recallCapable = isRecallCapable(def, c);
    // 3I: djupbevis (fördjupande form, rätt utan hjälp, första försöket i passet) – högst en gång per dygn
    const depthEv = !!def.depth && isDepthForm(ev.form) && independent && firstInSess;
    if (depthEv && c.dpd !== today) { c.dp = Math.min(4, (c.dp || 0) + (ev.kind === 'mc' ? 1 : 2)); c.dpd = today; }
    const gateOpen = !def.depth || c.st !== CFG.depth.gateStage || (c.dp || 0) >= CFG.depth.need;
    if (ev.ok) {
      const mcBlocked = ev.kind === 'mc' && c.st >= pol.mcMaxStage && recallCapable && !(depthEv && c.st === CFG.depth.gateStage && gateOpen);
      c.ok++; if (independent) { c.okInd++; if (countsForLevel && !mcBlocked) { c.okRun++; c.runItems = [...(c.runItems || []).filter(x => x !== ev.item), ev.item].slice(-4); } }
      if (countsForLevel) c.failRun = 0;
      const mcOnlyNeedsTwo = ev.kind === 'mc' && !recallCapable && c.st >= pol.mcMaxStage;
      const qualifying = independent && firstInSess && w >= CFG.evidence.qualify && !mcBlocked;
      const hintLearn = ev.ok && ev.help === 'hint' && c.st === 0 && firstInSess;
      if (hintLearn) { c.st = 1; c.lastOk = now; reasons.push('rätt med ledtråd på nytt koncept → stadium 1 (repetition imorgon)'); }
      else if (qualifying && mcOnlyNeedsTwo && !c.mcOk) { c.mcOk = 1; reasons.push('flervalskoncept: första fördröjda träffen noterad, nästa avgör'); }
      else if (qualifying) {
        if (c.st === 0) { c.st = 1; reasons.push('lärt idag → kommer tillbaka imorgon'); }
        else if (elapsedD >= CFG.early * I && !gateOpen) { reasons.push(`hämtat efter ${elapsedD.toFixed(1)} d men stadium ${c.st} kräver djupare förståelse först (djupbevis ${c.dp || 0}/${CFG.depth.need})`); }
        else if (elapsedD >= CFG.early * I) { c.st = Math.min(6, c.st + 1); reasons.push(`hämtat efter ${elapsedD.toFixed(1)} d (intervall ${I} d) → stadium ${c.st}`); rewards.push('REMEMBERED'); if (ev.kind === 'mc') D.mcAdv++; else D.freeAdv++; if (mcOnlyNeedsTwo) c.mcOk = 0; }
        else reasons.push(`för tidig hämtning (${elapsedD.toFixed(1)} d < ${(CFG.early * I).toFixed(1)} d) → räknas som övning`);
        c.lastOk = now;
      } else reasons.push(mcBlocked ? 'flerval räcker inte på detta stadium → behöver eget svar' : !independent ? `rätt med ${ev.help} → delvis bevis` : 'upprepning i samma pass → delvis bevis');
    } else {
      c.okRun = 0; c.runItems = [];
      if (countsForLevel) c.failRun++;
      if (ev.ctx !== 'retry' && ev.help !== 'rescue') {
        const old = c.st; const early = c.lastOk && elapsedD < CFG.early * I;
        if (ev.ctx === 'exam' && c.exDay === today) reasons.push('fel i Testa mig igen samma dygn → ingen ytterligare sänkning');   // granskning M4
        else if (ev.ctx === 'exam' && old >= 3) { c.st = old - CFG.lapse.examDrop; c.lap++; D.lapses++; c.exDay = today; reasons.push(`fel i Testa mig → stadium ${old} → ${c.st} (ett provfel skriver inte över långtidsbevis)`); }
        else if (ev.ctx === 'exam' && old >= 1) { c.st = Math.max(1, old - 1); c.exDay = today; reasons.push(`fel i Testa mig → stadium ${old} → ${c.st}`); }
        else if (ev.restart && old >= 2) { c.st = old - CFG.lapse.softDrop; reasons.push(`återstart efter uppehåll: rostigt, inte glömt → stadium ${old} → ${c.st}`); }
        else if (early && old >= 2) { c.st = old - CFG.lapse.softDrop; reasons.push(`fel vid tidig repetition → stadium ${old} → ${c.st} (mjuk sänkning)`); }
        else if (old >= 3) { c.st = Math.max(1, old - CFG.lapse.drop); c.lap++; D.lapses++; reasons.push(`glömt från stadium ${old} → ${c.st}`); }
        else if (old >= 1) { c.st = 1; if (old === 2) { c.lap++; D.lapses++; } reasons.push('fel → tillbaka till stadium 1'); }
        else reasons.push('fel på nytt koncept → fortsätter öva');
      } else reasons.push('fel vid omförsök → ingen extra sänkning');
    }
    c.due = dayStart(now) + Math.max(1, intervalDays(c.st, pol, L)) * DAY;
    if (ev.ok && !independent && c.st > 0) c.due = Math.min(c.due, dayStart(now) + Math.max(1, Math.ceil(intervalDays(c.st, pol, L) / 2)) * DAY);
    // 3D: adaptiv svårighet per koncept – variation krävs, en ändring per pass, ingen pendling samma dygn
    const maxLvl = def.maxLvl || 3;
    if (sess && c.lvlSess !== sess.id && countsForLevel) {
      const varied = new Set(c.runItems || []).size >= CFG.level.distinctItems;
      if (independent && c.okRun >= pol.upRun && varied && c.lvl < maxLvl && !(c.lvlDir === -1 && c.lvlDay === today)) { c.lvl++; c.okRun = 0; c.runItems = []; c.lvlSess = sess.id; c.lvlDir = 1; c.lvlDay = today; reasons.push(`nivå upp → ${c.lvl} (${pol.upRun} rätt i rad på olika uppgifter)`); }
      else if (!ev.ok && c.failRun >= pol.downRun && c.lvl > 1 && !(c.lvlDir === 1 && c.lvlDay === today)) { c.lvl--; c.failRun = 0; c.lvlSess = sess.id; c.lvlDir = -1; c.lvlDay = today; reasons.push(`nivå ner → ${c.lvl} (${pol.downRun} fel i rad)`); }
    }
    // Felboken 2.0: tillstånd härlett av bevis
    const F = CFG.fb; const learnedBefore = before.st >= 1; c.failDays = c.failDays || []; if (!ev.ok && firstInSess && !c.failDays.includes(today)) c.failDays = [...c.failDays, today].slice(-3);
    const recentFailDays = c.failDays.filter(d => today - d <= F.failWindowDays).length;
    const fbWorthy = !ev.ok && ev.help !== 'rescue' && !ev.restart && (ev.ctx === 'exam' || (firstInSess && learnedBefore) || recentFailDays >= F.failDaysToOpen || (c.fb && c.fb.s !== 'resolved'));
    if (!ev.ok && ev.restart && c.fb && c.fb.s !== 'resolved') { c.fb.s = 'open'; c.fb.wd = today; }
    if (fbWorthy) {
      // 3G: fel i Testa mig → "väntar" (visas från nästa dygn), aldrig direkt som misslyckande
      const startState = ev.ctx === 'exam' ? 'awaiting' : 'open';
      if (!c.fb || c.fb.s === 'resolved') { D.fbOpened++; c.fb = { s: startState, at: now, wd: today, wrong: 1, items: [ev.item], reopened: c.fb ? 1 : 0, fast: !!ev.fast, firstFail: ev.ctx === 'first' || ev.ctx === 'exam' }; reasons.push(c.fb.reopened ? 'Felboken: öppnad igen' : 'Felboken: ny'); }
      else { c.fb.s = c.fb.s === 'awaiting' && ev.ctx === 'exam' ? 'awaiting' : 'open'; c.fb.wrong++; c.fb.wd = today; if (ev.ctx === 'first' || ev.ctx === 'exam') c.fb.firstFail = true; if (!c.fb.items.includes(ev.item)) c.fb.items = [...c.fb.items, ev.item].slice(-4); c.fb.fast = c.fb.fast && !!ev.fast; }
    } else if (ev.ok && c.fb && c.fb.s !== 'resolved') {
      const differentItem = !c.fb.items.includes(ev.item) || (ev.onlyVariant && today >= c.fb.wd + F.resolveGapDays);
      if (independent && firstInSess && today > c.fb.wd && differentItem && (c.fb.s === 'open' || c.fb.s === 'corrected' || c.fb.s === 'awaiting')) {
        c.fb.s = 'verified'; c.fb.vd = today; D.fbVerified++; reasons.push('Felboken: verifierat efter minst ett dygn med ny fråga → REVANSCH');
        const lastCb = c.cb || -99; L.cbDay = L.cbDay && L.cbDay.d === today ? L.cbDay : { d: today, n: 0 };
        if ((!DECISIONS.K12_fast.comeback || !c.fb.fast) && c.fb.firstFail && today - lastCb >= F.comebackCooldownDays && L.cbDay.n < F.comebackPerDay) { rewards.push('COMEBACK'); c.cb = today; L.cbDay.n++; }
      } else if (independent && firstInSess && c.fb.s === 'verified' && today >= c.fb.vd + F.resolveGapDays && differentItem) { c.fb.s = 'resolved'; c.fb.rd = today; reasons.push('Felboken: löst (två fördröjda träffar)'); }
      else if ((c.fb.s === 'open' || c.fb.s === 'awaiting') && today === c.fb.wd && ev.ok) { c.fb.s = 'corrected'; reasons.push('Felboken: rättat i passet – verifieras tidigast imorgon'); }
      if (c.st >= F.resolveStage && c.fb.s === 'verified') { c.fb.s = 'resolved'; c.fb.rd = today; }
    }
    // LÄR-flaggan: sätts vid förståelseproblem, förbrukas när förklaringen visats (rollkod L på det stöttade försöket), högst var 3:e dygn
    if (ev.role === 'L') { c.teach = 0; c.taughtDay = today; }
    else if (!ev.ok && !ev.restart && c.st <= 1 && recentFailDays >= F.failDaysToOpen && ev.ctx !== 'exam' && today - (c.taughtDay == null ? -99 : c.taughtDay) >= CFG.fb.teachEveryDays) c.teach = 1;
    else if (independent && c.st >= 2) c.teach = 0;
    if (independent && c.st >= 4 && !c.mastered) { c.mastered = 1; rewards.push('MASTERY'); }
    if (independent && ev.role === 'B' && ev.stretch) rewards.push('CHALLENGE');
    if (ev.item) c.items = [...c.items.filter(x => x !== ev.item), ev.item].slice(-6);
    c.ev = [...c.ev, [Math.round(now / 1000), ev.ok ? 1 : 0, KCODE[ev.kind] || 'f', HCODE[ev.help || 'none'] || 'n', XCODE[ev.ctx || 'first'] || 'f']].slice(-12);
    const after = { st: c.st, due: c.due, lvl: c.lvl, fb: c.fb && c.fb.s };
    return { diff: { before, after }, reasons, rewards, weight: w };
  }
  const KCODE = { free: 'f', mc: 'm', open: 'p', order: 'r' }, HCODE = { none: 'n', hint: 'h', solution: 's', rescue: 'r' }, XCODE = { first: 'f', repeat: 'p', retry: 'r', exam: 'e' };
  const MCODE = { challenge: 'c', testa: 't', readclose: 'q' };
  const inv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
  const KDEC = inv(KCODE), HDEC = inv(HCODE), XDEC = inv(XCODE), MDEC = inv(MCODE);

  function apply(L, cat, e, pol) {
    if (e.sess && L.lastSess !== e.sess) { if (L.lastSess) calibrate(L); L.lastSess = e.sess; L.sessN = (L.sessN || 0) + 1; }
    // 3I: ett vilande moment (Concept Pack) leder beviset till kunskapspunkten frågan prövar. Loggen ändras aldrig (rollback läser originalet).
    const d = cat[e.cid]; const to = d && d.route && e.item ? d.route[e.item] : null; if (to && cat[to] && to !== e.cid) e = { ...e, cid: to };
    return recordEvidence(L, cat, e.cid, e, e.t, pol, { id: e.sess });
  }

  /* ---------- 3C: konceptfaser (internt; barnet ser bara enkla etiketter) ---------- */
  const PHASES = ['new', 'introduced', 'learning', 'retry', 'corrected', 'awaiting', 'verified', 'consolidating', 'stable', 'weakening', 'reopened'];
  function phase(c, now, pol, L) {
    if (!c || c.n === 0) return 'new';
    const today = dayIdx(now); const fb = fbS(c, now) ? c.fb : null;
    if (fb && fb.s === 'open' && fb.reopened) return 'reopened';
    if (fb && fb.s === 'open') return fb.wd === today ? 'retry' : 'learning';
    if (fb && fb.s === 'corrected') return fb.wd === today ? 'corrected' : 'awaiting';
    if (fb && fb.s === 'awaiting') return 'awaiting';
    if (fb && fb.s === 'verified') return 'verified';
    const I = intervalDays(c.st, pol, L);
    if (c.st >= 2 && c.due && now > c.due + I * DAY) return 'weakening';
    if (c.st >= 4) return 'stable';
    if (c.st >= 2) return 'consolidating';
    return c.fs && today - dayIdx(c.fs * 1000) <= 1 ? 'introduced' : 'learning';
  }
  const fbLive = (c, today) => c.fb && !(today !== Infinity && today - c.fb.wd > CFG.fb.expireDays);
  const fbS = (c, now) => (c && fbLive(c, now == null ? Infinity : dayIdx(now)) ? c.fb.s : null);   // granskning L5: utgångna poster räknas inte
  const fbVisibleState = (c, today) => fbLive(c, today) && (c.fb.s === 'open' || c.fb.s === 'corrected' || (c.fb.s === 'awaiting' && today > c.fb.wd));
  function felbokVisible(L, now) { const today = now == null ? Infinity : dayIdx(now); return Object.entries(L.c).filter(([, c]) => fbVisibleState(c, today)).map(([id]) => id); }
  function felbokDisplay(L, pol, now) { const all = felbokVisible(L, now).sort((a, b) => (L.c[a].fb.at - L.c[b].fb.at) || (a < b ? -1 : 1)); const cap = DECISIONS.O8_felbokDisplay[pol.name] || 5; return { shown: all.slice(0, cap), more: Math.max(0, all.length - cap), total: all.length }; }
  function felbokRecentWins(L, now) { const d = dayIdx(now); return Object.entries(L.c).filter(([, c]) => c.fb && (c.fb.s === 'verified' || c.fb.s === 'resolved') && d - (c.fb.rd || c.fb.vd || 0) <= DECISIONS.O2_verifiedDays).map(([id]) => id); }
  // Felboken 2.0 som barnvy: vad som ska visas (namn sätts av appen). Inga felräknare.
  function felbokChild(L, pol, now) { const d = felbokDisplay(L, pol, now); const today = dayIdx(now); return { items: d.shown.map(cid => ({ cid, state: L.c[cid].fb.s === 'corrected' && L.c[cid].fb.wd === today ? 'corrected' : 'todo' })), more: d.more > 0, wins: felbokRecentWins(L, now) }; }
  function childLabel(c, now, pol, L) {
    if (!c || c.n === 0) return 'Nytt';
    const overdue = c.due && now > c.due + intervalDays(c.st, pol, L) * DAY;
    if (fbS(c, now) === 'open') return 'Tränar';
    if (overdue && c.st >= 2) return 'Behöver repetition';
    if (c.st >= 4) return 'Säker'; if (c.st >= 2) return 'På väg'; return 'Tränar';
  }
  function delayedOks(c, sinceMs) { return c.ev.filter((e, i) => e[1] === 1 && e[3] === 'n' && (e[4] === 'f' || e[4] === 'e') && e[0] * 1000 >= sinceMs && i > 0 && (e[0] - c.ev[i - 1][0]) >= 86400 * 0.9).length; }
  function readiness(c, now) {
    if (!c || c.n < 3) return 'För lite underlag';
    if (['open', 'awaiting'].includes(fbS(c, now))) return 'Öva lite mer';
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
      else if ((fbS(c, now) === 'open' && c.fb.wrong >= 2 && dayIdx(now) - dayIdx(c.fb.at) >= 1) || c.lap >= 1 && c.st <= 2 || rescueCount(c, now) >= CFG.rescue.insightCount) weak.push(name);
    }
    return { strong, weak, thin };
  }
  const rescueCount = (c, now) => (c.rescueDays || []).filter(d => dayIdx(now) - d <= CFG.rescue.insightDays).length;

  /* ---------- Kör!: prioritet (förklarbar) ----------
     P = 40·FÖRFALLEN + 30·FELBOK + 35·PROV + 15·LÄNGE_VÄNTAT + 15·SVAG + 12·NY + 6·FÖRKUNSKAP + 8·LÄRARFOKUS − 20·ÄMNESOBALANS
     due:     förfallen; 0,5 + 0,5·(dygn försenad / intervall), max 1. Stabilt underhåll (stadium ≥4, inga glömskor, < ett intervall sent) ×0,6 → kan vänta (K-14).
     fb:      Felboken (öppen 1, väntar 1, rättad 0,9, verifierad 0,6) – först dygnet efter felet.
     exam:    provets brådska u = ((21 − dagar)/19)^1,5, gånger (1 − säkerhet) + golv 0,25·u; halveras när provets alla koncept har god koll.
     stale:   svagt koncept som väntat länge (≥ max(7 dygn, 2 intervall)): 0,5 → 1 ju längre väntan – K-14: göms aldrig för evigt.
     weak:    stadium ≤ 1 med försök.  new: aldrig sett och förkunskaper på plats.  prereq: svag förkunskap till något som väntar.
     balance: ämnet har tagit mer än sin rättvisa andel de två senaste passen.
     recent:  övat för mindre än 20 h sedan (gäller inte prov inom en vecka) → −10, så att det som väntat länge får sin tur (K-14).
     subj:    ämnet har något att öva men har inte övats på d dygn → min(1, d/7) (K-14: inget ämne svälts ut). */
  const W = CFG.W;
  function examUrgency(daysLeft) { const X = CFG.exam; if (daysLeft == null || daysLeft < 0 || daysLeft > X.horizon) return 0; return Math.pow(Math.min(1, (X.horizon - daysLeft) / X.ramp), X.power); }
  function conf(c) { return !c || c.n === 0 ? 0 : Math.min(1, c.st / 4); }
  function examReady(L, exam, now) { return exam.concepts.length > 0 && exam.concepts.every(cid => { const c = L.c[cid]; const s = fbS(c, now); return c && c.n >= 3 && c.st >= 3 && !(s && s !== 'resolved' && s !== 'verified'); }); }
  const fbOpenCount = (L, now) => Object.values(L.c).filter(c => fbLive(c, dayIdx(now)) && (c.fb.s === 'open' || c.fb.s === 'awaiting')).length;
  function priority(L, cat, cid, now, ctx, pol) {
    const c = L.c[cid]; const def = cat[cid]; const comps = {}; const today = dayIdx(now);
    if (def.kind === 'deck') {
      const ds = (ctx.decks || {})[cid]; if (ds && ds.due > 0) comps.due = Math.min(1, 0.5 + ds.due / 20); else if (ds && ds.nw > 0) comps.new = 1;
    } else {
      if (c && c.n > 0 && c.due && c.due <= now) {
        const I = Math.max(1, intervalDays(c.st, pol, L)); const late = (now - c.due) / DAY;
        let v = Math.min(1, CFG.due.base + CFG.due.slope * late / I);
        if (c.st >= CFG.due.maintStage && !c.lap && late < I) v *= CFG.due.maintFactor;
        comps.due = v;
        const thr = Math.max(CFG.backlog.maxWaitDays, CFG.backlog.maxWaitMult * I);
        if ((c.st <= 2 || c.lap > 0) && late >= thr) comps.stale = Math.min(1, 0.5 + 0.5 * (late - thr) / thr);   // ju längre väntan, desto högre
      }
      if (c && fbLive(c, today) && c.fb.s !== 'resolved' && today > c.fb.wd) comps.fb = c.fb.s === 'open' || c.fb.s === 'awaiting' ? 1 : c.fb.s === 'corrected' ? 0.9 : 0.6;
      if (c && c.n > 0 && c.st <= 1) comps.weak = 1 - conf(c) * 0.5;
      if ((!c || c.n === 0) && (def.prereq || []).every(p => L.c[p] && L.c[p].st >= 2)) comps.new = 1;
      if (c && c.n > 0 && c.st <= 1 && (ctx.prereqOf || {})[cid]) comps.prereq = 1;
      // ämnesrättvisa: något i ämnet behöver övas men ämnet har inte övats på länge
      const sw = (ctx.subjWait || {})[def.subject]; if (sw != null && (comps.due || comps.fb || comps.weak || comps.new || comps.stale)) comps.subj = Math.min(1, sw / CFG.subjectWaitDays);
    }
    const ex = (ctx.exams || []).filter(e => e.concepts.includes(cid)).map(e => examUrgency(Math.ceil((e.at - now) / DAY)) * (e.ready ? CFG.exam.readyDamp : 1));
    if (ex.length) { const u = Math.max(...ex); if (u > 0) comps.exam = u * (1 - conf(c)) + u * CFG.exam.floor; }
    if (def.focus) comps.focus = 1;
    if (c && c.lastSeen && now - c.lastSeen < CFG.recentHours * 3600000 && !(comps.exam > 0 && ex.some(u => u > 0)) && def.kind !== 'deck') comps.recent = -1;
    const share = ctx.recentSubjectShare ? (ctx.recentSubjectShare[def.subject] || 0) : 0; const fair = 1 / Math.max(1, ctx.subjectCount || 1);
    if (share > fair) comps.balance = -Math.min(1, (share - fair) / (1 - fair + 1e-9));
    let P = 0; const parts = {}; for (const [k, v] of Object.entries(comps)) { parts[k] = +(W[k] * v).toFixed(2); P += parts[k]; }
    const top = Object.entries(parts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
    return { cid, P: +P.toFixed(2), parts, why: top ? top[0] : 'maintenance' };
  }
  const WHY_TEXT = { due: 'dags att minnas', fb: 'Felboken – revansch', exam: 'provet närmar sig', stale: 'har väntat länge', weak: 'behöver mer övning', new: 'nytt att lära', prereq: 'grund för något nytt', focus: 'lärarens fokusområde', maintenance: 'håller kunskapen varm', boss: 'utmaning', challenge: 'fördjupning' };
  function withCtx(L, cat, ctx) {
    const prereqOf = {}; for (const [id, d] of Object.entries(cat)) for (const p of d.prereq || []) if (!(L.c[id] && L.c[id].st >= 2)) prereqOf[p] = 1;
    // dygn sedan ämnet senast övades (av koncept som barnet har mött); ämnen utan erfarenhet får ingen extra vikt
    const last = {}; for (const [id, d] of Object.entries(cat)) { const c = L.c[id]; if (c && c.lastSeen) last[d.subject] = Math.max(last[d.subject] || 0, c.lastSeen); }
    const now0 = L.clock && L.clock.last || 0; const subjWait = {}; for (const d of Object.values(cat)) if (d.kind !== 'deck') subjWait[d.subject] = last[d.subject] ? Math.max(0, (now0 - last[d.subject]) / DAY) : CFG.subjectWaitDays;
    return { ...ctx, prereqOf, subjWait: ctx.subjWait || subjWait, exams: (ctx.exams || []).map(e => ({ ...e, ready: e.ready != null ? e.ready : examReady(L, e) })) };
  }
  function rankAll(L, cat, now, ctx, pol) {
    const cx = ctx.prereqOf ? ctx : withCtx(L, cat, ctx);
    return Object.keys(cat).filter(id => cat[id].active !== false).map(id => priority(L, cat, id, now, cx, pol))
      .sort((a, b) => b.P - a.P || (b.parts.due || 0) - (a.parts.due || 0) || (b.parts.fb || 0) - (a.parts.fb || 0) || (b.parts.exam || 0) - (a.parts.exam || 0) || ((L.c[a.cid] || {}).due || 0) - ((L.c[b.cid] || {}).due || 0) || (a.cid < b.cid ? -1 : 1));
  }
  // K-14: hur mycket "pågående inlärning" (stadium ≤1) barnet bär just nu, och när kom senast något nytt?
  // Pågående, ännu inte säker inlärning: stadium ≤1, eller stadium 2 som är förfallen, eller öppen Felbok.
  function learningLoad(L, cat, now) { return Object.entries(L.c).filter(([id, c]) => c.n > 0 && (!cat[id] || (cat[id].kind !== 'deck' && cat[id].active !== false)) && (c.st <= 1 || (c.st === 2 && now != null && c.due <= now) || ['open', 'awaiting'].includes(fbS(c, now)))).length; }
  function lastNewAt(L) { return Math.max(0, ...Object.values(L.c).map(c => (c.fs || 0) * 1000)); }
  function dueBacklog(L, cat, now) { return Object.entries(L.c).filter(([id, c]) => cat[id] && cat[id].kind !== 'deck' && cat[id].active !== false && c.n > 0 && c.due && c.due <= now).length; }
  function challengeEligible(L, cat, cid) { const c = L.c[cid]; const d = cat[cid]; if (!c || !d || d.challenge === false || d.kind === 'deck') return false; return c.st >= CFG.challenge.ceilingStage || (c.st >= CFG.challenge.minStage && c.lvl >= (d.maxLvl || 3)); }

  /* Sätt ihop ett pass: UPPVÄRMNING · KOMMER DU IHÅG? · REVANSCH · DAGENS FOKUS · (UTMANING) · BOSSEN.
     opts.n: önskat antal (policyns intervall), opts.only: begränsa till dessa koncept (t.ex. "IDAG" inför prov), opts.sessionNo: löpnummer (variation). */
  function planSession(L, cat0, now, ctx0, pol, opts = {}) {
    const cat = opts.only ? Object.fromEntries(Object.entries(cat0).filter(([id]) => opts.only.includes(id))) : cat0;
    const ctx = withCtx(L, cat, ctx0); const S = CFG.session; const B = CFG.backlog;
    const range = S.range[pol.name] || [5, 12]; let n = Math.max(range[0], Math.min(range[1], opts.n || pol.n));
    const ranked = rankAll(L, cat, now, ctx, pol); const slots = [];
    const valuable = ranked.filter(r => (r.parts.due || 0) + (r.parts.fb || 0) + (r.parts.exam || 0) + (r.parts.new || 0) + (r.parts.weak || 0) + (r.parts.stale || 0) > 0).length;
    const light = valuable <= S.klarValuable; if (light) n = Math.min(n, S.klarMax);
    const restart = ctx.lastSessionAt && (now - ctx.lastSessionAt) / DAY > S.restartDays; if (restart) n = Math.max(range[0], Math.round(n * 0.75));
    const maxItems = restart ? n + 2 : Math.max(pol.maxItems, n + 2);
    const examDays = Math.min(99, ...(ctx.exams || []).map(e => Math.ceil((e.at - now) / DAY)).filter(d => d >= 0));
    const examFirst = (a, b) => (examDays <= CFG.exam.examFirstDays ? ((b.parts.exam > 0) - (a.parts.exam > 0)) : 0);
    const subjOf = (cid) => cat[cid].subject; const subjects = new Set(); const used = new Map(); const newGuard = new Set();
    const canUse = (cid, max = 2) => (used.get(cid) || 0) < max && (subjects.has(subjOf(cid)) || subjects.size < pol.maxSubjects);
    const take = (r, role) => { slots.push({ cid: r.cid, role, why: role === 'boss' ? WHY_TEXT.boss : WHY_TEXT[r.why] || r.why, P: r.P, parts: r.parts }); used.set(r.cid, (used.get(r.cid) || 0) + 1); subjects.add(subjOf(r.cid)); };
    const absentDays = ctx.lastSessionAt ? (now - ctx.lastSessionAt) / DAY : 0;
    const dueList = ranked.filter(r => r.parts.due > 0 && !(r.parts.fb > 0)).sort(examFirst);
    const fbList = ranked.filter(r => r.parts.fb > 0).sort(examFirst);
    const newList = ranked.filter(r => r.parts.new > 0);
    const focusList = ranked.filter(r => !(r.parts.due > 0) && !(r.parts.fb > 0) && (r.parts.exam > 0 || r.parts.weak > 0 || r.parts.focus > 0 || r.parts.new > 0));
    // 1) Uppvärmning: bara i pass med plats för den (≥6), säkra förfallna koncept med senaste svaret rätt, en nivå lättare
    if (n >= S.warmMinItems) {
      const warmN = Math.min(absentDays > S.absentWarmDays ? pol.warmups + 1 : pol.warmups, Math.floor(n / 4));
      const warm = ranked.filter(r => L.c[r.cid] && L.c[r.cid].st >= 2 && L.c[r.cid].due <= now + DAY && (L.c[r.cid].ev.slice(-1)[0] || [])[1] === 1 && !(L.c[r.cid].fb && L.c[r.cid].fb.s !== 'resolved')).sort((a, b) => examFirst(a, b) || L.c[b.cid].st - L.c[a.cid].st || (L.c[a.cid].due - L.c[b.cid].due) || (a.cid < b.cid ? -1 : 1));
      for (const r of warm) { if (slots.length >= warmN) break; if (canUse(r.cid, 1)) { take(r, 'warmup'); slots[slots.length - 1].lvlDelta = -1; } }
    }
    // Återkomst efter uppehåll: börja alltid med något barnet troligen klarar (starkaste konceptet, en nivå lättare)
    if (restart && !slots.length) { const r = ranked.filter(x => L.c[x.cid] && L.c[x.cid].n > 0 && L.c[x.cid].st >= 1 && cat[x.cid].kind !== 'deck').sort((a, b) => L.c[b.cid].st - L.c[a.cid].st || (a.cid < b.cid ? -1 : 1))[0]; if (r) { take(r, 'warmup'); slots[slots.length - 1].lvlDelta = -1; } }
    // Ny inlärning bestäms FÖRST (K-14): annars kan repetitioner och Revansch fylla passet så att nytt aldrig får plats.
    const bossReserve = n >= S.bossMinItems ? 1 : 0; const openFb = Object.values(L.c).filter(c => fbLive(c, dayIdx(now)) && (c.fb.s === 'open' || c.fb.s === 'awaiting')).length;
    const load = learningLoad(L, cat, now); const cap = B.loadCap[pol.name] || 9; const sinceNew = (L.sessN || 0) - (L.newSess || 0);
    const overloaded = load >= cap || openFb > pol.fbCap;
    // svält-skydd: vanlig överlast → nytt efter 4 pass; kraftig överlast (≥2×tak) → efter 8; extrem (≥3×tak) → efter 12. Aldrig permanent stopp.
    const starved = load < 2 * cap ? sinceNew >= B.starveSessions : sinceNew >= B.starveSessionsHard * (load >= 3 * cap ? 1.5 : 1);
    // provets sista dygn: inget nytt; tre dygn före: bara om svält; provvecka: ett nytt koncept på en plats
    const maxNew = examDays <= 1 ? 0 : examDays <= 3 ? (starved ? 1 : 0) : overloaded ? (starved ? 1 : 0) : examDays <= CFG.exam.weekDays ? 1 : pol.maxNew;
    let newTaken = 0; const isNewC = (cid) => !(L.c[cid] && L.c[cid].n > 0);
    // Provets sista tre dygn (och provet inte klart): minst halva passet till provets koncept – innan något annat fyller passet.
    // Granskning M8: aldrig osedda koncept här utöver maxNew (provkvällen: inget nytt alls).
    if (examDays <= 3 && (ctx.exams || []).some(e => Math.ceil((e.at - now) / DAY) <= 3 && !e.ready)) {
      const want = Math.ceil((n - bossReserve) * CFG.exam.minShareLast3); let have = slots.filter(x => x.parts && x.parts.exam > 0).length;
      for (const r of ranked.filter(x => x.parts.exam > 0)) { if (have >= want) break; const nw = isNewC(r.cid); if (nw && (newTaken >= maxNew || newGuard.has(r.cid))) continue; if (canUse(r.cid, 2)) { take(r, r.parts.fb > 0 ? 'revansch' : r.parts.due > 0 ? 'remember' : 'focus'); have++; if (nw) { newGuard.add(r.cid); newTaken++; } } }
    }
    // Ämnesrättvisa (K-14): ett ämne med något att öva som inte övats på en vecka får sin bästa uppgift tidigt i passet (nytt bara inom maxNew).
    for (const sj of Object.keys(ctx.subjWait || {}).filter(x => ctx.subjWait[x] >= CFG.subjectWaitDays).sort()) {
      if (slots.some(x => subjOf(x.cid) === sj)) continue;
      const r = ranked.find(x => subjOf(x.cid) === sj && canUse(x.cid, 1) && (['due', 'fb', 'weak', 'stale'].some(k => (x.parts[k] || 0) > 0) || ((x.parts.new || 0) > 0 && newTaken < maxNew)));
      if (r) { take(r, r.parts.fb > 0 ? 'revansch' : r.parts.due > 0 ? 'remember' : 'focus'); if (r.parts.new > 0 && !(L.c[r.cid] && L.c[r.cid].n > 0)) { newGuard.add(r.cid); newTaken++; } }
    }
    const newPick = maxNew > newTaken ? newList.find(x => canUse(x.cid, 2) && !newGuard.has(x.cid)) : null;
    if (newPick) { take(newPick, 'focus'); if (n > S.klarMax + 1 && examDays > CFG.exam.weekDays) take(newPick, 'focus'); newTaken++; }
    // 2) Kommer du ihåg? K-14: andelen växer med skulden (40 → 50 → 60 %) men aldrig över dagens tak; provvecka 25 %
    const backlog = dueBacklog(L, cat, now);
    const share = examDays <= CFG.exam.weekDays ? B.shareExam : backlog > 2 * pol.dueCap ? B.shareMax : backlog > pol.dueCap ? B.shareHigh : B.share;
    const dueSlots = Math.max(1, Math.min(Math.round(n * share), n - bossReserve - slots.length - 1));
    let dueTaken = 0; for (const r of dueList) { if (dueTaken >= dueSlots || (ctx.dueDoneToday || 0) + dueTaken >= pol.dueCap) break; if (!used.has(r.cid) && canUse(r.cid, 1)) { take(r, 'remember'); dueTaken++; } }
    // K-14: det som väntat längst göms aldrig – minst ett koncept som "väntat länge" får plats i varje pass (även provveckor)
    { const want = examDays <= 3 ? 1 : backlog > 2.5 * pol.dueCap ? 3 : backlog > 1.5 * pol.dueCap ? 2 : 1; let have = slots.filter(x => x.parts && x.parts.stale > 0).length;
      for (const st of ranked.filter(r => r.parts.stale > 0 && !used.has(r.cid) && canUse(r.cid, 1) && (examDays > 3 || r.parts.stale >= W.stale)).sort((a, b) => ((L.c[a.cid] || {}).due || 0) - ((L.c[b.cid] || {}).due || 0) || (a.cid < b.cid ? -1 : 1))) { if (have >= want || slots.length >= n - bossReserve) break; take(st, 'remember'); have++; } }
    // 3) Revansch (efter uppehåll: högst en, och först efter dagens fokus – återkomsten ska inte börja med gamla fel)
    const fbSlots = examDays <= 1 || restart ? S.revanschExamEve : S.revansch; let fbTaken = 0; const revAt = slots.length; const revSlots = [];
    for (const r of fbList) { if (fbTaken >= fbSlots) break; if (canUse(r.cid, 1)) { take(r, 'revansch'); fbTaken++; } }
    if (restart) revSlots.push(...slots.splice(revAt));
    // 4) Dagens fokus
    for (const r of focusList.concat(newList)) {
      if (slots.length >= n - bossReserve) break;
      const isNew = r.parts.new > 0 && !(L.c[r.cid] && L.c[r.cid].n > 0);
      if (isNew && newTaken >= maxNew) continue;
      if (!canUse(r.cid, 2)) continue;
      take(r, 'focus'); if (isNew) newTaken++;
      // K-14: med hög repetitionsskuld prioriteras bredd – ett svagt koncept får bara en plats (nytt får fortfarande två: introduktion + övning)
      if (slots.length < n - bossReserve && canUse(r.cid, 2) && (isNew || ((r.parts.exam > 0 || r.parts.weak > 0) && backlog <= B.breadthAbove * pol.dueCap))) take(r, 'focus');
    }
    for (const r of ranked) { if (slots.length + revSlots.length >= n - bossReserve) break; if (!used.has(r.cid) && canUse(r.cid, 1) && L.c[r.cid] && L.c[r.cid].n > 0) take(r, r.parts.due ? 'remember' : 'practice'); }
    if (revSlots.length) slots.splice(Math.max(0, Math.min(slots.length, n - bossReserve - revSlots.length)), 0, ...revSlots);
    // 5) 3H Utmaning: fördjupning på redan säkra koncept – inte varje pass, och den gör aldrig passet längre (ersätter en övningsplats)
    let challenge = null;
    if (opts.challenge !== false && (light || ((opts.sessionNo || 0) % CFG.challenge.every === 0))) {
      const elig = Object.keys(cat).filter(id => cat[id].active !== false && challengeEligible(L, cat, id) && (subjects.has(subjOf(id)) || subjects.size < pol.maxSubjects))
        .sort((a, b) => ((L.c[a].ch || {}).n || 0) - ((L.c[b].ch || {}).n || 0) || ((L.c[a].ch || {}).d || 0) - ((L.c[b].ch || {}).d || 0) || (a < b ? -1 : 1));
      if (elig.length) {
        challenge = { cid: elig[0], role: 'challenge', why: WHY_TEXT.challenge, P: 0, parts: {}, mode: 'challenge' };
        const pi = slots.map(s => s.role).lastIndexOf('practice');
        if (slots.length < n - bossReserve) { slots.push(challenge); subjects.add(subjOf(challenge.cid)); } else if (pi >= 0) slots[pi] = challenge; else challenge = null;
      }
    }
    // Granskning L2 (prövat och förkastat): att trimma planen till exakt n försämrade K-14 (svaga koncept väntade längre). Planen får vara
    // högst ett par uppgifter över n; passköraren stoppar alltid vid policyns maxItems (yngre 10, mellan 12, äldre 14).
    // 6) Bossen: väljs när den ska spelas (bland koncept som gått bra i passet) – aldrig ett just misslyckat koncept
    if (bossReserve && slots.length < n) { const bossC = slots.filter(s => s.role === 'focus' || s.role === 'remember').map(s => s.cid).find(cid => !(L.c[cid] && L.c[cid].fb && L.c[cid].fb.s === 'open')); slots.push({ cid: bossC || (slots[0] && slots[0].cid), role: 'boss', why: WHY_TEXT.boss, P: 0, parts: {}, dynamic: true, examC: examDays <= CFG.exam.examFirstDays ? (ctx.exams || []).flatMap(e => e.concepts) : [] }); }
    // Ingen utfyllnad med lågt värde: hellre ett kortare pass (lärande per minut) – men ett andra försök på dagens fokus/nya koncept får fylla
    for (const x of slots.filter(y => y.role === 'focus').map(y => y.cid)) { if (slots.length >= n - bossReserve) break; if (canUse(x, 2)) { const r = ranked.find(y => y.cid === x); if (r) take(r, 'focus'); } }
    // Passets båge: uppvärmning → minnas → revansch → fokus/nytt → övning → utmaning → boss (efter uppehåll: revansch efter fokus)
    const ORD = { warmup: 0, remember: 1, revansch: restart ? 4 : 2, focus: 3, practice: 5, challenge: 6, boss: 7 };
    slots.forEach((x, i) => { x._i = i; }); slots.sort((a, b) => (ORD[a.role] ?? 5) - (ORD[b.role] ?? 5) || a._i - b._i); slots.forEach(x => { delete x._i; });
    const finish = (arr) => { arr.light = light; arr.restart = !!restart; arr.maxItems = maxItems; arr.backlog = backlog; arr.load = load; arr.maxNew = maxNew; arr.examDays = examDays; return arr; };
    if (pol.name === 'younger') { const order = [...new Set(slots.map(s => subjOf(s.cid)))]; const head = slots.filter(s => s.role === 'warmup'); const tail = slots.filter(s => s.role === 'boss'); const mid = slots.filter(s => s.role !== 'warmup' && s.role !== 'boss').sort((a, b) => order.indexOf(subjOf(a.cid)) - order.indexOf(subjOf(b.cid))); return finish([...head, ...mid, ...tail]); }
    return finish(slots);
  }
  function pickBoss(L, sessState, slots, pol, cat) {
    const ex = sessState.examC || []; const okC = Object.entries(sessState.byC).filter(([cid, s]) => s.fails === 0 && s.n > 0 && L.c[cid] && !(cat && cat[cid] && cat[cid].kind === 'deck')).map(([cid]) => cid).sort((a, b) => (ex.includes(b) - ex.includes(a)) || (L.c[b].okRun - L.c[a].okRun) || (L.c[b].st - L.c[a].st) || (a < b ? -1 : 1));
    if (okC.length) { const cid = okC[0]; const stretch = L.c[cid].okRun >= pol.bossStretchRun; return { cid, stretch, why: stretch ? 'utmaning (nivå upp)' : 'utmaning' }; }
    const strong = Object.entries(L.c).filter(([id, c]) => c.st >= 2 && !(cat && cat[id] && (cat[id].kind === 'deck' || cat[id].active === false)) && !(cat && !cat[id])).sort((a, b) => b[1].st - a[1].st || (a[0] < b[0] ? -1 : 1))[0];
    return strong ? { cid: strong[0], stretch: false, why: 'gulduppgift' } : null;
  }
  function rescueTrigger(sessState, cid, pol) {
    if (sessState.mode === 'exam') return null;
    const s = sessState.byC[cid] || { fails: 0, run: 0, rescued: 0 };
    if (s.rescued) return 'defer';
    if (s.run >= pol.rescueAfter) return (sessState.rescues || 0) >= CFG.rescue.maxPerSession ? 'defer' : 'rescue';
    const last4 = sessState.results.slice(-4); if (last4.length === 4 && last4.filter(x => !x).length >= 3 && !sessState.eased) return 'ease';
    return null;
  }
  // 3E: vilken svarsform behövs som bevis? Flerval räcker i början; därefter eget svar när ämnet har det.
  function formatFor(L, cat, cid, pol, role) { const c = L.c[cid]; const d = cat[cid] || {}; if (!c || role === 'warmup' || role === 'rescue') return 'any';
    if (d.depth && c.st >= CFG.depth.gateStage && (c.dp || 0) < CFG.depth.need) return 'depth';   // 3I: djupgrinden behöver en fördjupande fråga
    return c.st >= pol.mcMaxStage && isRecallCapable(d, c) ? 'recall' : 'any'; }

  /* ---------- 3G: provstatus och föräldrainsikter ---------- */
  function examStatus(L, cat, exam, now, pol) {
    const days = Math.ceil((exam.at - now) / DAY); const per = exam.concepts.filter(cid => cat[cid]).map(cid => ({ cid, ready: readiness(L.c[cid], now) }));
    const count = (k) => per.filter(x => x.ready === k).length; const ready = per.length > 0 && count('Bra koll') === per.length;
    return { days, per, good: count('Bra koll'), more: count('Öva lite mer'), thin: count('För lite underlag'), ready, calm: ready && days >= 1 };
  }
  function insights(L, cat, now, pol, ctx = {}) {
    const out = { strengths: [], practise: [], due: [], temporary: [], thin: [], urgent: [], depth: [], rescue: [], recs: [] }; const today = dayIdx(now);
    for (const [id, c] of Object.entries(L.c)) {
      const d = cat[id]; if (!d || d.kind === 'deck' || d.active === false) continue;
      if (c.n < 4) { if (c.n > 0) out.thin.push(id); continue; }
      const failedToday = c.failDays && c.failDays.includes(today);
      if (c.st >= 4 || (c.st >= 3 && delayedOks(c, now - 30 * DAY) >= 2)) { (failedToday ? out.temporary : out.strengths).push(id); }
      else if (['open', 'awaiting'].includes(fbS(c, now)) || (c.lap >= 1 && c.st <= 2) || phase(c, now, pol, L) === 'weakening') out.practise.push(id);
      if (c.due && c.due <= now && c.st >= 1) out.due.push(id);
      if (rescueCount(c, now) >= CFG.rescue.insightCount) out.rescue.push(id);
      if (c.ch && c.ch.n) out.depth.push(id);
    }
    for (const e of ctx.exams || []) { const s = examStatus(L, cat, e, now, pol); if (s.days >= 0 && s.days <= CFG.exam.weekDays && !s.ready) out.urgent.push({ exam: e, status: s }); }
    // Rekommendationer: högst tre, praktiska, utan skuld. Ordning: prov → upprepade svårigheter → svagt → repetitioner → paus → fördjupning.
    const R = out.recs; const mins = (n) => Math.max(5, Math.round(n * 0.6));
    for (const u of out.urgent.slice(0, 1)) R.push({ k: 'exam', days: u.status.days, concepts: u.status.per.filter(x => x.ready !== 'Bra koll').map(x => x.cid), minutes: mins(pol.n) });
    if (out.rescue.length && R.length < 3) R.push({ k: 'rescue', concepts: out.rescue.slice(0, 2) });
    if (out.practise.length && R.length < 3) R.push({ k: 'practise', concepts: out.practise.slice(0, 2), minutes: mins(pol.n) });
    if (out.due.length > pol.dueCap && R.length < 3) R.push({ k: 'due', minutes: mins(pol.n) });
    if (ctx.daysSinceActive >= 3 && R.length < 3) R.push({ k: 'return', minutes: 5 });
    if (!R.length && out.strengths.length >= 3 && Object.keys(L.c).filter(id => challengeEligible(L, cat, id)).length) R.push({ k: 'depth' });
    if (!R.length) R.push({ k: 'steady', minutes: mins(pol.n) });
    return out;
  }

  /* ---------- Bevislogg: lagring, sammanslagning, omspelning ----------
     Kompakt lagring: [t(s), dev, seq, cid, ok, kind, k, help, ctx, item, fast, sess, lvl, restart, mode?, role?, stretch?].
     Index 0–13 = 3B-format (läses av äldre versioner). 14+ = förlängning (3C+). Bakåtkompatibelt: en Utmaning sparas som
     help=rescue + ctx=retry i grundfälten, så en äldre version tolkar den som ofarligt stöttad övning (ingen sänkning, ingen Felbok). */
  function encodeEv(e) {
    const base = [Math.round(e.t / 1000), e.dev, e.seq, e.cid, e.ok ? 1 : 0, KCODE[e.kind] || 'f', e.k || 0, HCODE[e.help || 'none'] || 'n', XCODE[e.ctx || 'first'] || 'f', e.item || '', e.fast ? 1 : 0, e.sess || '', e.lvl || 1, e.restart ? 1 : 0];
    if (e.mode === 'challenge') { base[7] = 'r'; base[8] = 'r'; }
    if (e.mode || e.role || e.stretch || e.onlyVariant || e.form) base.push(MCODE[e.mode] || '', e.role || '', e.stretch ? 1 : 0, e.mode === 'challenge' ? (HCODE[e.help || 'none'] || 'n') : '');
    if (e.onlyVariant || e.form) base.push(e.onlyVariant ? 1 : 0);   // 18: frågebanken saknade en annan uppgift (Felboken får verifiera med samma fråga efter några dygn)
    if (e.form) base.push(e.form);   // 19 (3I): frågeform r/c/v/l/m/x/a/e/s (äldre versioner läser inte fältet)
    return base;
  }
  function decodeEv(a) {
    const e = { t: a[0] * 1000, dev: a[1], seq: a[2], cid: a[3], ok: !!a[4], kind: KDEC[a[5]] || 'free', k: a[6], help: HDEC[a[7]] || 'none', ctx: XDEC[a[8]] || 'first', item: a[9], fast: !!a[10], sess: a[11], lvl: a[12], restart: !!a[13] };
    if (a.length > 14) { if (a[14]) e.mode = MDEC[a[14]]; if (a[15]) e.role = a[15]; if (a[16]) e.stretch = true; if (e.mode === 'challenge') { e.help = HDEC[a[17]] || 'none'; e.ctx = 'first'; } if (a[18]) e.onlyVariant = true; if (a[19] && typeof a[19] === 'string') e.form = a[19].slice(0, 1); }
    return e;
  }
  const evKey = (e) => Array.isArray(e) ? e[1] + ':' + e[2] : e.dev + ':' + e.seq;
  const evT = (e) => Array.isArray(e) ? e[0] * 1000 : e.t;
  const evOrder = (x, y) => evT(x) - evT(y) || (evKey(x).split(':')[0] < evKey(y).split(':')[0] ? -1 : evKey(x).split(':')[0] > evKey(y).split(':')[0] ? 1 : (Array.isArray(x) ? x[2] - y[2] : x.seq - y.seq));
  function mergeLog(a, b) { const m = new Map(); for (const e of [...(a || []), ...(b || [])]) { const k = evKey(e); const o = m.get(k); if (!o || stable(e) < stable(o)) m.set(k, e); } return [...m.values()].sort(evOrder); }
  function replay(log, cat, pol, base) { const L = base ? JSON.parse(JSON.stringify(base)) : newLE(); for (const raw of (log || []).slice().sort(evOrder)) { const e = Array.isArray(raw) ? decodeEv(raw) : raw; if (!cat[e.cid]) cat = { ...cat, [e.cid]: { id: e.cid, subject: 'okänt', active: false } }; apply(L, cat, e, pol); } return L; }
  function stable(o) { if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']'; if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'; return JSON.stringify(o); }
  function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }

  /* Sammanslagning av två enheters le (kommutativ, idempotent). Bas: flest inbakade händelser vinner; lika → tidigast t0; lika → hash.
     Loggarna förenas på dev:seq (vid krock på samma nyckel väljs deterministiskt). Skuggposter och v2-passposter förenas på id.
     Belöningsmarkörer (rw) förenas som union – samma belöning delas aldrig ut två gånger efter synk. */
  const SHADOW_MAX = 40, LOG_SOFT = 300, LOG_HARD = 450, FOLD_AGE = 14 * DAY, RW_MAX = 400, RW_DAYS = 21, RW_AHEAD = 7;   // RW_AHEAD: markörer mer än en vecka fram i tiden (fel klocka) tas bort
  /* Belöningsmarkörer "TYP:dygn[:nyckel]" (MA:koncept saknar dygn och behålls alltid – en per koncept). Gallras efter ÅLDER, inte antal:
     en dags- eller veckomarkör får aldrig falla bort medan den gäller (annars kunde samma belöning delas ut igen). Deterministiskt: åldern
     räknas från den nyaste markörens dygn, inte från klockan, så två enheter gallrar likadant. */
  const rwDay = (k) => { const m = /^[A-Z]+:(\d+)(?::|$)/.exec(k); return m ? Number(m[1]) : null; };
  // today: passets dygn (då gallras på ålder och markörer långt i framtiden – från en enhet med fel klocka – tas bort, granskning H3).
  // Utan today (sammanslagning): bara union och ett tak, ordnat på dygn – deterministiskt och utan klocka.
  function pruneRw(list, today) {
    const u = [...new Set(list || [])];
    const keep = today == null ? u : u.filter(k => { const d = rwDay(k); return d == null || (d >= today - RW_DAYS && d <= today + RW_AHEAD); });
    keep.sort((a, b) => ((rwDay(a) == null ? -1 : rwDay(a)) - (rwDay(b) == null ? -1 : rwDay(b))) || (a < b ? -1 : a > b ? 1 : 0));
    return keep.length > RW_MAX ? [...keep.filter(k => rwDay(k) == null), ...keep.filter(k => rwDay(k) != null)].slice(-RW_MAX) : keep;
  }
  function mergeLE(a, b) {
    if (!a || !a.v) return b && b.v ? b : (a || b || null); if (!b || !b.v) return a;
    if (a.v !== b.v) return a.v > b.v ? a : b;   // granskning M9: blanda aldrig versioner – den senare versionen lämnas orörd
    const rank = (x) => [-(x.folded || 0), x.t0 || 0, hash(stable(x.base || {}))];
    const ra = rank(a), rb = rank(b); const cmp = ra[0] - rb[0] || ra[1] - rb[1] || (ra[2] < rb[2] ? -1 : ra[2] > rb[2] ? 1 : 0);
    const pick = cmp <= 0 ? a : b; const other = pick === a ? b : a;
    // Händelser inbakade i den valda basen tas bort med tidsgränsen t0 – bara om något faktiskt är inbakat (folded > 0), så en migrering
    // på en enhet med fel klocka (t0 i framtiden) aldrig kastar riktiga bevis. Granskning M10 (sena offlinebevis äldre än en packad bas)
    // prövades med enhetsvisa vattenmärken men gav dataförlust/dubbelräkning med 1.2.0-enheter → återställt, dokumenterad begränsning.
    const log = mergeLog(a.log, b.log).filter(e => !((pick.folded || 0) > 0 && evT(e) <= (pick.t0 || 0)));
    const seqs = { ...(other.seqs || {}) }; for (const [d, n] of Object.entries(pick.seqs || {})) seqs[d] = Math.max(seqs[d] || 0, n);
    const sh = new Map(); for (const r of [...(other.shadow || []), ...(pick.shadow || [])]) { const o = sh.get(r.id); sh.set(r.id, !o || (r.done && !o.done) || ((r.a || []).length > (o.a || []).length) ? r : o); }
    const shadow = [...sh.values()].sort((x, y) => x.t - y.t || (x.id < y.id ? -1 : 1)).slice(-SHADOW_MAX);
    const rw = pruneRw([...(a.rw || []), ...(b.rw || [])]);
    const out = { ...other, ...pick, log, seqs, shadow, srv: Math.max(a.srv || 0, b.srv || 0) || undefined };
    if (rw.length) out.rw = rw; else delete out.rw;
    return out;
  }
  function compact(le, cat, pol, now) {
    if (!le || (le.log || []).length <= LOG_SOFT) return false;
    const log = le.log.slice().sort(evOrder); let cut = 0;
    while (cut < log.length - 200 && evT(log[cut]) < now - FOLD_AGE) cut++;
    if (log.length - cut > LOG_HARD) cut = log.length - LOG_SOFT;
    if (cut <= 0) return false;
    while (cut < log.length && evT(log[cut]) === evT(log[cut - 1])) cut++;
    const folded = log.slice(0, cut); const base = replay(folded, cat, pol, le.base);
    le.base = base; le.t0 = evT(folded[folded.length - 1]); le.folded = (le.folded || 0) + folded.length; le.log = log.slice(cut);
    return true;
  }
  // Belöningsmarkörer: "typ:dygn:nyckel". En markör per belöning → samma belöning två gånger (omstart, två enheter efter synk) ger inget.
  function rewardOnce(le, key, today) { le.rw = le.rw || []; if (le.rw.includes(key)) return false; const d = rwDay(key); const t = today != null ? today : d; if (d != null && t != null && (d < t - RW_DAYS || d > t + RW_AHEAD)) return false; le.rw = pruneRw([...le.rw, key], t); return true; }

  /* ---------- Migrering v1 → le (deterministisk, idempotent, v1 orört) ---------- */
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
    return { v: 2, ev: 2, mv: 1, base: L, t0: now, folded: 0, log: [], seqs: {}, shadow: [], migratedFrom: 'v1', migratedAt: now };
  }

  return { DAY, RULES, CFG, dayIdx, dayStart, DECISIONS, POLICIES, STAGE_DAYS, intervalDays, calibrate, evidenceWeight, newConcept, cstate, newLE, engineNow, recordEvidence, apply,
    PHASES, phase, felbokVisible, felbokDisplay, felbokRecentWins, felbokChild, childLabel, readiness, parentInsights, delayedOks, rescueCount, W, WHY_TEXT, examUrgency, examReady, examStatus, insights, priority, rankAll, withCtx,
    learningLoad, lastNewAt, dueBacklog, fbOpenCount, challengeEligible, planSession, pickBoss, rescueTrigger, formatFor, isRecallCapable, isDepthForm,
    encodeEv, decodeEv, mergeLog, replay, mergeLE, compact, rewardOnce, pruneRw, rwDay, migrateV1, stable, hash, SHADOW_MAX, LOG_SOFT, LOG_HARD, RW_MAX, RW_DAYS };
})();
if (typeof module !== 'undefined') module.exports = LE2;
