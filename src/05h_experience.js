/* ========= Experience v3 – tre upplevelser, EN Learning Engine =========
   EXPLORE (standard för Yngre), GROW (Mellan), ACHIEVE (Äldre). Standardval – inga etiketter på barnet, inget tak. Föräldern kan välja
   en annan upplevelse per barn – eller "Klassisk" (2.1-presentationen) som reserv. Komplexiteten bor i motorn; här finns bara
   presentation, rytm, avslut och fortsättning:
   - Uppdraget (Dagens äventyr / Dagens runda / nästa riktiga mål) är en PRESENTATION av Smart Kör!-planen. Ingen egen schemaläggning.
   - CORE → KLAR → FLOW: CORE = dagens Kör!-pass. KLAR = tydligt slut. FLOW = ett frivilligt, kortare extrablock med samma motor och samma
     dagliga gräns för ny inlärning. Inget startar av sig självt; att sluta är alltid lika enkelt som att fortsätta.
   - Aktiviteter: sortera, para ihop, ordna, tryck i meningen, bygg ordet, räkna på papper. Allt går att göra med tryck (ingen dragning).
   - Papper och penna: appen väljer uppgiften, barnet räknar på papper och skriver bara svaret. Bara svaret rättas ("Ditt svar stämmer.").
   - Ärlig intelligens: varje status bygger på motorns verkliga tillstånd. Inga procent, inga löften om provresultat.
   Data (tillägg, versionerade, ignoreras av äldre versioner): p.settings.exp/expAt (upplevelse, senaste ändringen vinner),
   passposter med m:'flow', bevisets index 20 = 'p' (räknat på papper, påverkar inte motorn), p.v3.sc (barnets egen stegjämförelse – bara visning). */
const EXP = {
  V: 1,
  KINDS: {
    explore: { name: 'Explore', sv: 'Upptäck', desc: 'Dagens äventyr: korta, varierade aktiviteter, uppläsning och tryckvänliga kort.' },
    grow: { name: 'Grow', sv: 'Väx', desc: 'Dagens runda: synliga framsteg, revansch, utmaningar och mer eget svar.' },
    achieve: { name: 'Achieve', sv: 'Nå målet', desc: 'Nästa riktiga mål först, dagens plan, papper och penna i matte, FLOW på bra dagar.' },
    classic: { name: 'Klassisk (2.1)', sv: 'Klassisk', desc: 'Startsidan och passen som i 2.1.0. Samma motor och samma data.' },
  },
  DEFAULT: { younger: 'explore', middle: 'grow', older: 'achieve' },
  FLOW_MAX: 3,   // högst tre FLOW-block per dygn – sedan ett vänligt "vila nu" (det som övats sätter sig bäst med mellanrum)
  safe(fn, where, fb) { return V2.safe(fn, 'exp:' + where, fb); },
  of(kid) { const p = kid && prof(kid.id); const s = p && p.settings && p.settings.exp; if (s && EXP.KINDS[s]) return s; return EXP.DEFAULT[LE.policyName(kid, p)] || 'grow'; },
  isDefault(kid) { const p = prof(kid.id); return !(p.settings && EXP.KINDS[p.settings.exp]); },
  on(kid) { return !!kid && V2.on(kid) && EXP.of(kid) !== 'classic'; },
  cur() { return (typeof S !== 'undefined' && S && S.v2 && S.v2.exp) || null; },
  set(kid, v) { const p = prof(kid.id); if (v === 'default') delete p.settings.exp; else if (EXP.KINDS[v]) p.settings.exp = v; else return; p.settings.expAt = LE.now(); save(); },
  // Synk: p.settings.exp/expAt följer motorvalets regel (senaste ändringen vinner) och p.v3.sc slås ihop som union – se mergeProfiles (04_sync.js)
  /* ---------- Dagens läge (bara motorns egna data) ---------- */
  today() { return LE2.dayIdx(LE.now()); },
  recsToday(p, m) { const d0 = EXP.today(); return V2.v2recs(p).filter(r => r.done && (!m || r.m === m) && LE2.dayIdx(r.t * 1000) === d0); },
  coreDone(p) { return EXP.recsToday(p, 'kor').length > 0; },
  flowsToday(p) { return EXP.recsToday(p, 'flow').length; },
  // Ny inlärning idag (första beviset på konceptet idag) – FLOW får aldrig ta in mer nytt än policyns gräns per dygn
  newToday(C, now) { const d = LE2.dayIdx(now); return Object.entries(C.L.c).filter(([id, c]) => c.fs && LE2.dayIdx(c.fs * 1000) === d && C.cat[id] && C.cat[id].kind !== 'deck').length; },
  flowPlan(kid, C, now, id) {
    const newCap = Math.max(0, C.pol.maxNew - EXP.newToday(C, now)); const n = Math.max(3, Math.round(V2.n(kid, C) * 0.6));
    const plan = LE.plan(kid, n, now, id, { newCap }).plan; plan.flow = true; plan.newCap = newCap; return plan;
  },
  peekFlow(kid) { return EXP.safe(() => { const C = LE.state(kid); return EXP.flowPlan(kid, C, LE.now()); }, 'peekFlow', []); },
  canFlow(kid) { const p = prof(kid.id); return EXP.flowsToday(p) < EXP.FLOW_MAX && EXP.peekFlow(kid).length > 0; },
  /* ---------- Planens presentation ---------- */
  STATION: { warm: ['Värm upp', '☀️'], minns: ['Minns', '🧠'], upptack: ['Upptäck', '🔎'], klura: ['Klura', '🧩'], revansch: ['Revansch', '💪'], utmaning: ['Utmaning', '🧗'], boss: ['Boss', '👑'] },
  stationOf(slot, C) { const c = C.L.c[slot.cid]; if (slot.role === 'boss') return 'boss'; if (slot.mode === 'challenge' || slot.role === 'challenge') return 'utmaning'; if (slot.role === 'revansch') return 'revansch'; if (slot.role === 'warmup') return 'warm'; if (slot.role === 'remember') return 'minns'; return !c || !c.n ? 'upptack' : 'klura'; },
  nameOf(kid, C, cid) { const d = C.cat[cid] || {}; return d.kind === 'kp' ? V2.skillName(kid, d.ref) : d.kind === 'deck' ? d.name : (V2.skillOf(kid, cid) || {}).short || d.name || ''; },
  summary(kid, plan0) {
    const C = LE.state(kid); const plan = plan0 || V2.peekPlan(kid).plan; const names = []; let rep = false; let rev = false;
    // Det som tränas: dagens fokus/nytt/prov först, sedan Revansch och Repetition som egna rader (inte tio kunskapspunkter)
    for (const s of plan) { if (s.role === 'boss') continue; if (s.role === 'remember' || s.role === 'warmup') { rep = true; continue; } if (s.role === 'revansch') { rev = true; continue; } const nm = EXP.nameOf(kid, C, s.cid); if (nm && !names.includes(nm)) names.push(nm); }
    const list = names.slice(0, 3); if (rev) list.push('Revansch'); if (rep) list.push('Repetition');
    const st = []; for (const s of plan) { const k = EXP.stationOf(s, C); if (!st.includes(k)) st.push(k); }
    return { n: plan.length, mins: V2.mins(plan.length), list, stations: st, light: !!plan.light, plan, C };
  },
  // Framsteg med betydelse (Grow/Achieve): motorns barnetiketter för koncept som barnet har övat. Inga procent.
  progress(kid) { const C = LE.state(kid); const now = LE.now(); const out = { 'Säker': 0, 'På väg': 0, 'Tränar': 0, 'Behöver repetition': 0 }; for (const [id, c] of Object.entries(C.L.c)) { const d = C.cat[id]; if (!d || d.active === false || d.kind === 'deck' || !c.n) continue; const l = LE2.childLabel(c, now, C.pol, C.L); if (l in out) out[l]++; } return out; },
  /* ---------- Startsidan ---------- */
  home(kid) {
    return EXP.safe(() => {
      const p = prof(kid.id); if (!LE.canStart(kid, p)) return V2.korBtn(kid);
      const e = EXP.of(kid); const welcome = EXP.welcome(kid);
      return welcome + (e === 'explore' ? EXP.exploreHome(kid, p) : e === 'grow' ? EXP.growHome(kid, p) : EXP.achieveHome(kid, p));
    }, 'home', V2.korBtn(kid));
  },
  go(kid, label, sub) { return `<button class="go-btn v3go" data-v2="kor"><div><div class="t">${esc(label)}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div><div class="arrow">${ICON.arrow}</div></button>`; },
  chips(stations) { return `<div class="stations" aria-label="Det här väntar">${stations.slice(0, 5).map(k => `<span class="station"><span aria-hidden="true">${EXP.STATION[k][1]}</span>${EXP.STATION[k][0]}</span>`).join('')}</div>`; },
  flowBtn(kid, label, cls = 'btn big wide') { return EXP.canFlow(kid) ? `<button class="${cls}" data-v2="flow">${esc(label)}</button>` : ''; },
  doneCard(kid, p, title, sub, flowLabel) {
    const canMore = EXP.canFlow(kid); const rest = EXP.flowsToday(p) >= EXP.FLOW_MAX;
    return `<section class="card pad-lg mission done stack" aria-label="${esc(title)}"><div class="mission-icon" aria-hidden="true">✅</div><div class="eyebrow">${esc(title)}</div>
      <div class="mission-sub">${sub}</div>
      ${canMore ? `<button class="btn big wide secondary" data-v2="flow">${esc(flowLabel)}</button>` : `<div class="muted">${rest ? 'Bra jobbat idag! Det du har övat sätter sig bäst om du vilar nu.' : 'Allt för idag är gjort.'}</div>`}</section>`;
  },
  exploreHome(kid, p) {
    if (EXP.coreDone(p)) return EXP.doneCard(kid, p, 'ÄVENTYRET KLART!', 'Du är klar för idag.', 'ETT ÄVENTYR TILL');
    const s = EXP.summary(kid);
    return `<section class="card pad-lg mission explore stack" aria-label="Dagens äventyr"><div class="eyebrow">DAGENS ÄVENTYR</div>
      <div class="mission-title">${s.n} små utmaningar</div><div class="muted">cirka ${s.mins} min</div>${EXP.chips(s.stations)}
      ${EXP.go(kid, LBL(kid).go.toUpperCase())}</section>`;
  },
  growHome(kid, p) {
    const m = V2.mission(kid); const label = LBL(kid).go.toUpperCase();
    if (EXP.coreDone(p)) return EXP.doneCard(kid, p, m ? 'DAGENS MISSION KLAR' : 'RUNDAN KLAR!', 'Du är klar för idag.', 'EN RUNDA TILL');
    const s = EXP.summary(kid); const pr = EXP.progress(kid); const C = s.C; const fb = LE2.felbokChild(C.L, C.pol, LE.now()); const todo = fb.items.filter(x => x.state === 'todo').length;
    const parts = [[pr['Säker'], 'säkra'], [pr['På väg'], 'på väg'], [pr['Tränar'] + pr['Behöver repetition'], 'tränar']].filter(x => x[0] > 0);   // bara lägen som finns – ingen "0 säkra"
    const prog = parts.length ? `<div class="progress-states" aria-label="Så långt har du kommit">${parts.map(([n, t]) => `<span><b>${n}</b> ${t}</span>`).join('')}</div>` : '';
    return `<section class="card pad-lg mission grow stack" aria-label="Dagens runda"><div class="eyebrow">${m ? `DAGENS MISSION · ${esc(m.e.title.toUpperCase())} · ${esc(fmtDate(m.e.date).toUpperCase())}` : 'DAGENS RUNDA'}</div>
      <div class="mission-title">${s.n} uppgifter · cirka ${s.mins} min</div>
      ${s.list.length ? `<div class="muted" style="font-size:.95rem">Idag: ${s.list.map(esc).join(' · ')}</div>` : ''}${prog}
      ${EXP.go(kid, label)}
      ${todo ? `<button class="link" data-v2="revansch" style="align-self:center">Hellre revansch först? · ${todo} ${todo === 1 ? 'sak' : 'saker'}</button>` : ''}</section>`;
  },
  goalOf(kid) {
    const p = prof(kid.id); const all = LE.exams(kid, p).map(e => ({ e, d: daysUntil(e.date) })).filter(x => x.d >= 0).sort((a, b) => a.d - b.d || (b.e.priority === 'high') - (a.e.priority === 'high') || (a.e.id < b.e.id ? -1 : 1));
    const now = all.find(x => x.d <= V2.MISSION_DAYS) || null;   // nästa mål: inom uppdragets horisont (samma som Study Mission)
    return { now, next: now ? all.find(x => x !== now && x.d <= 60) || null : null };   // "Sedan:" – bara en rad, aldrig en andra plan
  },
  isExam(e) { return e && (e.kind === 'exam' || /prov|förhör|test/i.test(e.title || '')); },
  achieveHome(kid, p) {
    const g = EXP.goalOf(kid); const m = g.now;
    const sedan = g.next ? `<div class="then">Sedan: <b>${esc(g.next.e.title.toUpperCase())}</b> · ${esc(fmtDate(g.next.e.date).toUpperCase())}</div>` : '';
    if (EXP.coreDone(p)) return EXP.doneCard(kid, p, 'DAGENS PLAN KLAR', 'Appen håller koll på resten.', m && EXP.isExam(m.e) ? 'FORTSÄTT MOT PROVET' : 'FORTSÄTT') + EXP.goalDetail(kid, m);
    const s = EXP.summary(kid);
    const head = m ? `<div class="eyebrow">NÄSTA MÅL</div><div class="goal-title">${esc(m.e.title.toUpperCase())}</div><div class="goal-date">${esc(fmtDate(m.e.date).toUpperCase())} · ${m.d === 0 ? 'idag' : m.d === 1 ? 'imorgon' : `om ${m.d} dagar`}</div>`
      : `<div class="eyebrow">DAGENS PLAN</div>${s.list[0] ? `<div class="goal-title">${esc(s.list[0].toUpperCase())}</div>` : ''}`;
    const list = m ? s.list : s.list.slice(1);   // utan prov: dagens starkaste mål är rubriken, resten listas under
    return `<section class="card pad-lg mission achieve stack" aria-label="Dagens plan">${head}
      ${list.length ? `<div class="train"><div class="eyebrow">${m ? 'DET HÄR TRÄNAR VI IDAG' : 'OCKSÅ IDAG'}</div><ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="muted">cirka ${s.mins} min</div>
      ${EXP.go(kid, LBL(kid).go.toUpperCase())}${sedan}</section>` + EXP.goalDetail(kid, m);
  },
  // Läget per område – hopfällt, med motorns tre lägen (aldrig procent). Testa mig är en sekundär knapp här.
  goalDetail(kid, m) {
    if (!m) return '';
    const C = LE.state(kid); const st = V2.examStatus(kid, m.e, C, LE.now()); const per = EXP.goalAreas(kid, m.e, C) || st.per;
    return `<details class="card goal-detail"><summary><b>Läget inför ${esc(m.e.title)}</b></summary>
      ${per.every(x => x.ready === 'För lite underlag') ? `<p class="muted" style="margin:8px 0">För lite underlag ännu. Kör några pass så syns det här vad som sitter.</p>` : `<div class="stack" style="gap:6px;margin-top:8px">${per.slice(0, 8).map(x => `<div class="row" style="justify-content:space-between;gap:8px"><span>${esc(x.name)}</span><span class="pill ${V2.READY_CLS[x.ready]}" style="font-size:.75rem">${V2.READY_TXT[x.ready]}</span></div>`).join('')}</div>`}
      <p class="muted" style="font-size:.85rem;margin:8px 0">Lägena bygger på hur det gått hittills – de säger inget om provresultatet.</p>
      <button class="btn ghost wide" data-v2="testa" data-exam="${esc(m.e.id)}">Testa mig</button></details>`;
  },
  /* Lärarens målområden (skoluppgiftens "goals", Golden case A/B): en rad per område med motorns läge (Bra koll / Öva lite mer / För lite
     underlag) över områdets koncept. Finns inga områden: null (då visas momenten som tidigare). */
  goalAreas(kid, e, C) {
    const w = e && e.work && typeof FAMILY !== 'undefined' ? FAMILY.workById(e.work) : null; const goals = (w && w.goals) || []; if (!goals.length) return null;
    const now = LE.now(); const agg = (r) => !r.length || r.every(v => v === 'För lite underlag') ? 'För lite underlag' : r.every(v => v === 'Bra koll') ? 'Bra koll' : 'Öva lite mer';
    return goals.map(g => { const cids = [...new Set([...(g.skills || []).flatMap(id => LE.cidsOfSkill(C, id)), ...(g.kps || []).filter(cid => C.cat[cid])])]; return { name: g.name, ready: agg(cids.map(cid => LE2.readiness(C.L.c[cid], now))), teacher: !!g.teacher }; });
  },
  welcome(kid) {
    return EXP.safe(() => {
      const p = prof(kid.id); const last = V2.lastAt(p); if (!last || (LE.now() - last) / LE2.DAY < LE2.CFG.session.absentWarmDays || V2.doneToday(p)) return '';
      // RETURN: motorn har verkligen justerat planen efter uppehållet (uppvärmning, återstart) – därför får texten säga det
      return `<div class="card row welcome" style="gap:12px"><div style="font-size:1.5rem" aria-hidden="true">👋</div><div class="grow"><div style="font-weight:800;font-family:var(--display)">Kul att du är tillbaka.</div><div class="muted" style="font-size:.95rem">Jag har justerat planen.</div></div></div>`;
    }, 'welcome', '');
  },
  /* ---------- Under passet ---------- */
  ACT: { num: ['SKRIV TALET', '✍️'], sort: ['SORTERA', '🗂️'], match: ['PARA IHOP', '🔗'], order: ['ORDNA', '🔢'], tap: ['TRYCK PÅ ORDET', '👆'], build: ['BYGG ORDET', '🧱'], paper: ['RÄKNA PÅ PAPPER', '✏️'], exampaper: ['PROVLÄGE · PAPPER', '✏️'], bosspaper: ['BOSS · PAPPER', '👑'] },
  // Upplevelsens etikett för uppgiften. Explore: aktiviteten. Achieve/Grow: rytmen UPPTÄCK · GÖR · HITTA FELET · MINNS · PROVLÄGE · BOSS.
  chipFor(item) {
    const V = S.v2; if (!V.exp || !item || item.cat === 'learn') return null;
    if (item.paper) return V.exam ? EXP.ACT.exampaper : item.spec && item.spec.role === 'boss' ? EXP.ACT.bosspaper : V.exp === 'explore' ? EXP.ACT.paper : ['GÖR · RÄKNA PÅ PAPPER', '✏️'];
    if (item.rhythm) return item.rhythm === 'spot' ? ['HITTA FELET', '🔍'] : ['BAKLÄNGES', '↩️'];
    if (V.exam || !item.spec) return null;
    const role = item.spec.role;
    if (['boss', 'revansch', 'remember', 'rescue'].includes(role) || item.spec.mode === 'challenge') return null;   // rollens egen etikett (MINNS, REVANSCH, BOSSEN …)
    const ui = EXP.uiOf(item); if (ui === 'num' && V.exp !== 'explore') return null; if (EXP.ACT[ui]) return EXP.ACT[ui];
    return null;
  },
  uiOf(item) { if (!item) return 'none'; if (item.cat === 'word') return 'word:' + item.kind; if (item.cat === 'learn') return 'learn'; if (item.paper) return 'paper'; if (item.build) return 'build'; if (item.type === 'sort' || item.type === 'match' || item.type === 'order') return item.type; if (item.ui === 'tap') return 'tap'; if (item.type === 'choicetext' || item.choices) return 'choice'; return item.type === 'text' ? 'type' : item.type || 'type'; },
  // Hur många textval i rad (Explore: aldrig fler än två när kunskapen finns som aktivitet)
  vary(V) { if (!V.exp || V.exp === 'achieve') return null; const q = S.queue.filter(x => x.cat !== 'learn'); let run = 0; for (let i = q.length - 1; i >= 0; i--) { const u = EXP.uiOf(q[i]); if (u === 'choice' || u === 'word:pick' || u === 'word:listen') run++; else break; } const last = q.length ? EXP.uiOf(q[q.length - 1]) : null; return { choiceRun: V.exp === 'explore' ? run : Math.max(0, run - 1), last, boost: V.exp === 'explore' ? 2.5 : 1.5 }; },   // Grow: högst tre textval i rad
  // Bygg ordet (Explore): eget svar med bokstavsbrickor i stället för tangentbord – för korta, enkla ord. Rättas med samma funktion.
  buildable(q) { if (q.type !== 'text' || !Array.isArray(q.answer)) return false; const w = String(q.display || q.answer[0] || '').trim(); return /^[a-zåäöéü]{2,9}$/i.test(w); },
  /* ---------- Papper och penna (Learning Recipe för matematik) ----------
     Moment där mellanled är värdefulla, från en viss nivå: flerstegsekvationer, parenteser, problemlösning, talföljdsformler, x².
     Rytmen: aldrig två pappersuppgifter i rad (utom Bossen), högst hälften av passet. Testa mig: de sista 2–3 uppgifterna. */
  PAPER: { forenkla: 1, blandat: 2, talfoljd: 2, ekvation: 1, problemekv: 1, andragrad: 2, multin: 3, problem: 2 },
  paperOk(q, skill) { const min = skill && EXP.PAPER[skill.id]; return !!min && (q.level || 1) >= min && (q.type === 'num' || q.type === 'expr') && !q.create && !q.v2check && (q.steps || []).length >= 2; },
  paperFor(V, q, spec, skill) {
    if (!V.exp || V.exp === 'explore' || !EXP.paperOk(q, skill)) return false;
    const done = S.queue.filter(x => x.paper).length;
    if (V.exam) return done < 3 && LER.progress(V.R).left <= 3;
    if (spec.mode === 'challenge' || ['remember', 'warmup', 'rescue', 'easy', 'readclose', 'revansch'].includes(spec.role) || spec.help === 'rescue' || spec.help === 'hint') return false;
    const last = S.queue.filter(x => x.cat !== 'learn').slice(-1)[0];
    if (last && last.paper && spec.role !== 'boss') return false;
    return done < Math.ceil((V.plan.length || 6) / 2);
  },
  /* Rytmen i Achieve/Grow-matte (brief §13): UPPTÄCK (löst exempel) · GÖR (papper) · HITTA FELET (digital analys) · BAKLÄNGES · MINNS.
     Hitta felet och Baklänges använder Utmaningslagrets befintliga generatorer och registreras som Utmaning: fördjupning som aldrig ändrar
     stadium, förfallodag eller Felboken (samma regel som 3H). Högst en av varje per pass, bara på moment som redan börjar sitta (stadium ≥ 2). */
  rhythmKind(V, spec, skill, c) {
    if (!V.exp || V.exp === 'explore' || V.exam || V.mode === 'revansch' || V.mode === 'readclose') return null;
    if (!skill || (skill.group || 'math') !== 'math' || typeof skill.gen !== 'function' || !c || c.st < 2) return null;
    if (spec.mode === 'challenge' || !['practice', 'focus'].includes(spec.role) || spec.help === 'rescue' || spec.help === 'hint') return null;
    const done = new Set(S.queue.filter(x => x.rhythm).map(x => x.rhythm)); const last = S.queue.filter(x => x.cat !== 'learn').slice(-1)[0];
    if (!done.has('spot') && last && last.paper) return 'spot';   // efter ett pappersproblem: analysera en annans lösning digitalt
    if (!done.has('reverse') && S.queue.filter(x => x.cat === 'math').length >= 2 && last && !last.paper && !last.rhythm) return 'reverse';   // baklänges: när passet är igång
    return null;
  },
  rhythmItem(kind, skill, lvl) {
    const want = kind === 'spot' ? ['spot'] : ['create', 'equation'];
    for (const k of kind === 'spot' ? [0] : /ekv/.test(skill.id) ? [3, 2] : [2]) { const q = CHG.make(skill, lvl, k); if (q && want.includes(q.challenge)) return q; }
    return null;
  },
  paperNote(q) { return `<div class="paper-note" role="note"><span aria-hidden="true">✏️</span><div><b>Räkna på papper.</b> Skriv uträkningen på ditt papper${S.v2 && S.v2.exam ? '' : ' – i lugn och ro'}. Skriv bara svaret här.</div></div>`; },
  paperFeedback(q, correct, raw) {
    const steps = (q.steps || []).map((s, i) => `<li>${safeHtml(s)}</li>`).join('');
    if (correct) return `<div class="feedback ok"><span style="font-size:1.4rem">✅</span><div><div class="big">Ditt svar stämmer.</div><div class="sub">Svar: <b>${esc(answerDisplay(q))}</b>. Jämför gärna din uträkning med lösningen.</div></div></div><details class="steps"><summary><b>Visa lösningen steg för steg</b></summary><ol>${steps}</ol></details>`;
    const pick = (q.steps || []).length >= 2 ? `<div class="selfcheck" role="group" aria-label="I vilket steg skilde det sig?"><div style="font-weight:700">I vilket steg skilde det sig? <span class="muted" style="font-weight:400">(frivilligt)</span></div><div class="row wrap" style="gap:8px;margin-top:6px">${q.steps.map((_, i) => `<button class="btn ghost sc" data-sc="${i + 1}">Steg ${i + 1}</button>`).join('')}<button class="btn ghost sc" data-sc="0">Vet inte</button></div></div>` : '';
    return `<div class="feedback no"><span style="font-size:1.4rem">✏️</span><div><div class="big">Svaret stämmer inte.</div><div class="sub">Rätt svar: <b>${esc(answerDisplay(q))}</b>${raw ? ` · Du skrev: ${esc(raw)}` : ''}</div></div></div><div class="steps"><div class="eyebrow">Jämför med din uträkning</div><ol>${steps}</ol></div>${pick}`;
  },
  // Barnets egen jämförelse: bara visning för föräldern ("Steg som barnet valde vid egen jämförelse"). Aldrig bevis, aldrig schemaläggning.
  selfCheck(el) {
    const q = S.queue[S.i]; if (!q || !q.paper || !q.spec) return; const p = prof(S.kid.id); const step = Number(el.dataset.sc) || 0;
    const v3 = p.v3 && p.v3.v === 1 ? p.v3 : { v: 1, sc: [] }; v3.sc = [...v3.sc.filter(x => !(x[0] === LE2.dayIdx(S.v2.start) && x[2] === V2.iid(q))), [LE2.dayIdx(S.v2.start), q.spec.cid, V2.iid(q), step, (q.steps || []).length]].slice(-40); p.v3 = v3; save();
    const box = el.closest('.selfcheck'); if (box) box.innerHTML = `<div class="muted">${step ? `Bra att jämföra. Titta extra på steg ${step} nästa gång.` : 'Okej! Lösningen finns kvar här ovanför.'}</div>`;
  },
  scList(kid) { const p = prof(kid.id); const C = LE.state(kid); return ((p.v3 && p.v3.sc) || []).slice(-8).reverse().map(x => ({ day: x[0], name: V2.cname(kid, C, x[1]), step: x[3], of: x[4] })); },
  /* ---------- Aktiviteter: sortera, para ihop, tryck i meningen, bygg ordet ---------- */
  body(q) {
    if (q.type === 'sort') { S.sort = { sel: null, placed: {} }; return `<div class="sortbox"><div class="sort-pool" id="sortPool">${q.items.map((t, i) => `<button class="stile" data-sitem="${i}" aria-pressed="false">${esc(t)}</button>`).join('')}</div><div class="sort-bins">${q.bins.map((b, i) => `<div class="sbin" data-sbin="${i}"><button class="sbin-h" data-sbin="${i}" aria-label="Lägg i ${esc(b)}">${esc(b)}</button><div class="sbin-items" id="sbin${i}" role="list" aria-label="${esc(b)}"></div></div>`).join('')}</div><p class="muted tip">Tryck på ett kort och sedan på rätt grupp. Fel grupp? Tryck på kortet igen.</p></div>`; }
    if (q.type === 'match') { const L = R.shuffle(q.pairs.map((x, i) => ({ i, t: x[0] }))); const Rr = R.shuffle(q.pairs.map((x, i) => ({ i, t: x[1] }))); S.match2 = { sel: null, done: new Set(), mistakes: 0 }; return `<div class="match-grid v3">${[['l', L], ['r', Rr]].map(([side, arr]) => `<div class="match-col">${arr.map(x => `<button class="mtile" data-m2="${side}" data-mi="${x.i}">${esc(x.t)}</button>`).join('')}</div>`).join('')}</div><p class="muted tip">Tryck på ett kort till vänster och sedan på det som hör ihop.</p>`; }
    return '';
  },
  tapBody(q) { return `<div class="tapline" role="group" aria-label="Meningen">${q.choices.map((c, i) => `<button class="tapword" data-choice="${i}">${esc(c)}</button>`).join(' ')}</div>`; },
  buildBody(q) {
    const w = String(q.display || q.answer[0]).trim(); const letters = w.split(''); const extra = 'aeiorstnlkm'.split('').filter(c => !w.toLowerCase().includes(c)); const pool = R.shuffle([...letters, ...R.shuffle(extra).slice(0, 2)]);
    S.build = { picked: [], tiles: pool };
    return `<div class="slots" id="bslots" aria-live="polite"><span class="muted" style="font-size:.9rem;align-self:center">Tryck på bokstäverna</span></div><div class="ltiles" id="btiles">${pool.map((c, i) => `<button class="ltile" data-btile="${i}">${esc(c)}</button>`).join('')}</div>`;
  },
  renderBuild() { const el = document.getElementById('bslots'); const B = S.build; el.innerHTML = B.picked.length ? B.picked.map(i => `<span class="ltile">${esc(B.tiles[i])}</span>`).join('') : `<span class="muted" style="font-size:.9rem;align-self:center">Tryck på bokstäverna</span>`; const sb = document.getElementById('submit'); if (sb) sb.disabled = !B.picked.length; },
  // Klick under en aktivitet. true = hanterat.
  onMath(e, q) {
    const t = e.target;
    if (q.type === 'sort' && S.sort) {
      const it = t.closest('[data-sitem]'); const bin = t.closest('[data-sbin]'); const X = S.sort;
      if (it) { if (it.classList.contains('placed')) { const pool = document.getElementById('sortPool'); delete X.placed[it.dataset.sitem]; it.classList.remove('placed'); delete it.dataset.bin; if (pool) pool.appendChild(it); pool && pool.classList.remove('empty'); const sb0 = document.getElementById('submit'); if (sb0) sb0.disabled = true; }   // ångra: tryck på ett placerat kort så går det tillbaka
        document.querySelectorAll('.stile.sel').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); }); X.sel = Number(it.dataset.sitem); it.classList.add('sel'); it.setAttribute('aria-pressed', 'true'); return true; }
      if (bin && X.sel != null) { const b = Number(bin.dataset.sbin); X.placed[X.sel] = b; const el = document.querySelector(`[data-sitem="${X.sel}"]`); if (el) { el.classList.remove('sel'); el.setAttribute('aria-pressed', 'false'); el.classList.add('placed'); el.dataset.bin = b; document.getElementById('sbin' + b).appendChild(el); } X.sel = null; beep('tick');
        const pool = document.getElementById('sortPool'); if (pool) pool.classList.toggle('empty', !pool.querySelector('.stile')); const sb = document.getElementById('submit'); if (sb) sb.disabled = Object.keys(X.placed).length !== q.items.length; return true; }
      if (bin) { toast('Tryck först på ett kort'); return true; }
    }
    if (q.type === 'match' && S.match2) {
      const mt = t.closest('[data-m2]'); if (!mt) return false; const M = S.match2; const side = mt.dataset.m2; const i = Number(mt.dataset.mi);
      if (!M.sel || M.sel.side === side) { document.querySelectorAll('.mtile.sel').forEach(x => x.classList.remove('sel')); M.sel = { side, i, el: mt }; mt.classList.add('sel'); return true; }
      if (M.sel.i === i) { mt.classList.add('done'); M.sel.el.classList.add('done'); M.sel.el.classList.remove('sel'); M.done.add(i); M.sel = null; beep('tick'); if (M.done.size === q.pairs.length) submitMath(); return true; }
      M.mistakes++; beep('no'); mt.classList.add('no'); const a = M.sel.el; a.classList.add('no'); a.classList.remove('sel'); M.sel = null; setTimeout(() => { mt.classList.remove('no'); a.classList.remove('no'); }, 450); return true;
    }
    if (q.build && S.build) {
      const bt = t.closest('[data-btile]'); if (bt && !bt.classList.contains('used')) { bt.classList.add('used'); S.build.picked.push(Number(bt.dataset.btile)); EXP.renderBuild(); return true; }
      if (t.closest('#undoBuild')) { const last = S.build.picked.pop(); if (last !== undefined) document.querySelector(`[data-btile="${last}"]`)?.classList.remove('used'); EXP.renderBuild(); return true; }
    }
    if (t.closest('[data-sc]')) { EXP.selfCheck(t.closest('[data-sc]')); return true; }
    return false;
  },
  raw(q) {
    if (q.type === 'sort') { const m = {}; for (const [i, b] of Object.entries((S.sort && S.sort.placed) || {})) m[q.items[i]] = q.bins[b]; return JSON.stringify(m); }
    if (q.type === 'match') return JSON.stringify({ done: S.match2 ? S.match2.done.size : 0, mistakes: S.match2 ? S.match2.mistakes : 0 });
    if (q.build) return (S.build ? S.build.picked.map(i => S.build.tiles[i]).join('') : '');
    return null;
  },
  // Visa rätt/fel på korten efter svaret (sortera) – barnet ser direkt var varje kort hörde hemma
  reveal(q, res) {
    if (q.type === 'sort') document.querySelectorAll('.stile').forEach(el => { const t = q.items[Number(el.dataset.sitem)]; el.disabled = true; el.classList.add(q.answer[t] === q.bins[Number(el.dataset.bin)] ? 'ok' : 'no'); });
    document.querySelectorAll('.sbin-h, .mtile, .ltile, #undoBuild').forEach(b => { b.disabled = true; }); document.querySelectorAll('#qcard .tip').forEach(x => x.remove());
    if (q.type === 'match' && res) return `<div class="sub">${res.mistakes ? `Alla par klara – ${res.mistakes === 1 ? 'ett försök' : res.mistakes + ' försök'} blev fel på vägen.` : 'Alla par rätt direkt!'}</div>`;
    return '';
  },
  /* ---------- KLAR (efter CORE och FLOW) ---------- */
  DELIGHT: { REMEMBERED: 'Du kom ihåg!', COMEBACK: 'Nu satt den. Den här typen var klurig tidigare.', MASTERY: 'Det här börjar sitta.', CHALLENGE: 'Du löste en svårare variant.', FOCUS: 'Dagens fokus klart!', CONSISTENCY: 'Tre plugg-dagar den här veckan!' },
  WD: ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'],
  backText(due, now) { const d = LE2.dayIdx(due) - LE2.dayIdx(now); return d <= 0 ? 'idag' : d === 1 ? 'imorgon' : d <= 6 ? `på ${EXP.WD[new Date(due).getDay()]}` : `om ${d} dagar`; },
  // "Det här behöver komma tillbaka" – koncept som var svåra i passet (eller nya), med motorns egen förfallodag
  comeBack(kid, V) {
    const C = V.C; const now = LE.now(); const out = []; const seen = new Set();
    for (const [cid, ok] of V.R.log.map(x => [x[0], x[2]])) { if (ok || seen.has(cid)) continue; seen.add(cid); const c = C.L.c[cid]; if (c && c.due && (C.cat[cid] || {}).kind !== 'deck') out.push({ name: EXP.nameOf(kid, C, cid), when: EXP.backText(c.due, now) }); }
    return out.slice(0, 2);
  },
  finish(kid, V, sum, won, extraCards) {
    const e = V.exp; const p = prof(kid.id); const flow = V.mode === 'flow';
    const g = e === 'achieve' ? EXP.goalOf(kid).now : null;
    const title = e === 'explore' ? 'ÄVENTYRET KLART!' : e === 'grow' ? (flow ? 'EXTRARUNDAN KLAR!' : 'RUNDAN KLAR!') : flow ? 'BLOCKET KLART' : 'DAGENS PLAN KLAR';
    const flowLabel = e === 'explore' ? 'ETT ÄVENTYR TILL' : e === 'grow' ? 'EN RUNDA TILL' : g && EXP.isExam(g.e) ? 'FORTSÄTT MOT PROVET' : 'FORTSÄTT';
    const kinds = []; for (const r of V.rewards) if (EXP.DELIGHT[r.k] && !kinds.includes(r.k)) kinds.push(r.k);
    const delights = kinds.slice(0, 3).map(k => `<div class="delight">${esc(EXP.DELIGHT[k])}</div>`).join('');
    const trail = e === 'explore' ? `<div class="trail done" aria-label="Det här gjorde du">${S.queue.slice(0, S.i + 1).map(x => `<span class="dot ok" aria-hidden="true">${(EXP.ACT[EXP.uiOf(x)] || EXP.ACT[x.paper ? 'paper' : ''] || [0, x.cat === 'learn' ? '🔎' : x.spec && x.spec.role === 'boss' ? '👑' : '⭐'])[1]}</span>`).join('')}</div>` : '';
    const back = e === 'explore' ? [] : EXP.comeBack(kid, V);
    const gems = V.rewards.reduce((a, r) => a + r.gems, 0);
    const canMore = EXP.canFlow(kid); const rested = EXP.flowsToday(p) >= EXP.FLOW_MAX;
    const fb = LE2.felbokChild(V.C.L, V.C.pol, LE.now()); const todo = fb.items.filter(x => x.state === 'todo').length;
    if (e === 'explore') confetti(40);
    render(`${topbar('Klart', 'home')}
    <div class="stack" style="margin-top:6px">
      <section class="card pad-lg summary-hero stack klar" style="gap:8px;text-align:center" aria-label="${esc(title)}">
        <div style="font-size:2rem" aria-hidden="true">${e === 'explore' ? '🗺️' : '✅'}</div>
        <div class="klar-title">${esc(title)}</div>
        ${e === 'achieve' && !flow ? '<div>Appen håller koll på resten.</div>' : ''}
        ${trail}
        ${e !== 'explore' ? `<div style="font-weight:700">${sum.ok} av ${sum.n} rätt</div>` : ''}
        ${(() => { const up = [...V.stageUps].filter(cid => ((V.C.L.c[cid] || {}).st || 0) >= 2).length; return up && e !== 'explore' ? `<div>${up === 1 ? 'Ett område' : `${up} områden`} sitter bättre nu</div>` : ''; })()}
        ${delights}${gems ? `<div>+${gems} 💎</div>` : ''}
      </section>
      ${back.length ? `<div class="card stack" style="gap:4px"><div class="eyebrow">Det här behöver komma tillbaka</div>${back.map(b => `<div>${esc(b.name)} – kommer tillbaka ${esc(b.when)}.</div>`).join('')}</div>` : ''}
      ${extraCards}
      ${canMore ? `<button class="btn big wide" data-v2="flow">${esc(flowLabel)}</button>` : `<div class="card muted" style="text-align:center">${rested ? 'Bra jobbat idag! Det du har övat sätter sig bäst om du vilar nu.' : 'Allt för idag är gjort.'}</div>`}
      ${e === 'grow' && todo && canMore ? `<button class="btn ghost wide" data-v2="revansch">Revansch i stället · ${todo} ${todo === 1 ? 'sak' : 'saker'}</button>` : ''}
      <button class="btn ${canMore ? 'ghost' : 'big'} wide" data-go="home">Klar för idag</button>
    </div>`);
  },
  /* ---------- Testa mig: rapport per målområde (aldrig en prognos) ---------- */
  examReport(kid, V) {
    const e = LE.exams(kid, prof(kid.id)).find(x => x.id === V.extra.examId); if (!e) return '';
    const C = V.C; const per = EXP.goalAreas(kid, e, C) || V2.examStatus(kid, e, C, LE.now()).per;
    return `<div class="card stack" style="gap:6px"><div class="eyebrow">Läget per område efter testet</div>${per.map(x => `<div class="row" style="justify-content:space-between;gap:8px"><span>${esc(x.name)}</span><span class="pill ${V2.READY_CLS[x.ready]}" style="font-size:.75rem">${V2.READY_TXT[x.ready]}</span></div>`).join('')}<p class="muted" style="font-size:.85rem">Det här är ett övningstest. Det säger vad Kör! ska öva på – inte vad du får på provet.</p></div>`;
  },
  /* ---------- Föräldraläget ---------- */
  parentCard(kid) {
    const p = prof(kid.id); const cur = EXP.of(kid); const def = EXP.isDefault(kid); const sc = EXP.scList(kid);
    return `<div class="card stack" style="gap:8px"><div class="eyebrow">Upplevelse för ${esc(kid.name)}</div>
      <div class="muted" style="font-size:.9rem">Samma Learning Engine – bara presentationen skiljer. ${def ? `Standard för åldern: <b>${EXP.KINDS[cur].name}</b>.` : `Vald av dig: <b>${EXP.KINDS[cur].name}</b>.`}</div>
      <div class="seg" role="group" aria-label="Upplevelse" style="flex-wrap:wrap">${Object.entries(EXP.KINDS).map(([k, x]) => `<button class="${k === cur ? 'on' : ''}" aria-pressed="${k === cur}" data-v2="exp" data-val="${k}">${esc(x.name)}</button>`).join('')}</div>
      <div class="muted" style="font-size:.85rem">${esc(EXP.KINDS[cur].desc)}</div>
      ${def ? '' : '<button class="link" data-v2="exp" data-val="default" style="align-self:flex-start">Återställ till standard för åldern</button>'}
      ${p.settings.engine === 'v1' ? '<div class="muted" style="font-size:.85rem">Barnet kör reservmotorn v1 – upplevelsen gäller först när v2 är på.</div>' : ''}
      ${sc.length ? `<div style="font-size:.9rem;margin-top:4px"><b>Steg som barnet valde vid egen jämförelse</b> (papper och penna)<div class="muted" style="font-size:.8rem">Barnets eget val när hen jämförde sin uträkning med lösningen. Inget bevis och ingen diagnos – appen har inte sett uträkningen.</div>${sc.map(x => `<div>${esc(x.name)}: ${x.step ? `steg ${Number(x.step)} av ${Number(x.of)}` : 'vet inte'}</div>`).join('')}</div>` : ''}
    </div>`;
  },
  // Skoluppgiftens luckor (saknade källor, okänt provformat) – visas för föräldern, aldrig för barnet
  missingCard(kid) {
    const work = typeof FAMILY !== 'undefined' ? FAMILY.workFor(kid.id) : []; const rows = work.filter(w => (w.missing || []).length);
    if (!rows.length) return '';
    return `<div class="card stack" style="gap:6px"><div class="eyebrow">Saknas i underlaget</div><div class="muted" style="font-size:.85rem">Det här har inte gått att granska. Appen hittar inte på något i stället – ge materialet till Claude när du har det.</div>${rows.map(w => `<div style="font-size:.9rem"><b>${esc(w.title)}</b><ul style="margin:4px 0 0;padding-left:20px">${w.missing.map(m => `<li>${esc(m.label)}${m.note ? ` <span class="muted">– ${esc(m.note)}</span>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>`;
  },
};
if (typeof module !== 'undefined') module.exports = EXP;
