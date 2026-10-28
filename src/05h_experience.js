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
  set(kid, v) { const p = prof(kid.id); if (v === 'default') p.settings.exp = 'default'; else if (EXP.KINDS[v]) p.settings.exp = v; else return; p.settings.expAt = LE.now(); save(); },   // 'default' sparas (tas inte bort): annars kunde synken återställa ett äldre val (granskning)
  // Synk: p.settings.exp/expAt följer motorvalets regel (senaste ändringen vinner) och p.v3.sc slås ihop som union – se mergeProfiles (04_sync.js)
  /* ---------- Dagens läge (bara motorns egna data) ---------- */
  today() { return LE2.dayIdx(LE.now()); },
  recsToday(p, m) { const d0 = EXP.today(); return V2.v2recs(p).filter(r => r.done && (!m || r.m === m) && LE2.dayIdx(r.t * 1000) === d0); },
  coreDone(p) { return EXP.recsToday(p, 'kor').length > 0; },
  flowsToday(p) { const d0 = EXP.today(); return V2.v2recs(p).filter(r => r.m === 'flow' && LE2.dayIdx(r.t * 1000) === d0).length; },   // påbörjade räknas (granskning L1)
  // FLOW ger ingen XP för koncept som redan övats tidigare idag (granskning M6) – extrablocket ska inte löna sig för upprepning
  flowXp(q, xp) { try { if (!S.v2 || S.v2.mode !== 'flow' || !q.spec || !xp) return xp; const c = S.v2.C.L.c[q.spec.cid]; if (c && c.lastSeen && LE2.dayIdx(c.lastSeen) === LE2.dayIdx(LE.now()) && c.lastSeen < S.v2.start) { const p = prof(S.kid.id); p.xp = Math.max(0, p.xp - xp); const d = todayKey(); for (const day of [p.days && p.days[d], p.since && p.since.days && p.since.days[d]]) if (day) day.xp = Math.max(0, (day.xp || 0) - xp); return 0; } } catch (e) { /* ignore */ } return xp; },
  // Ny inlärning idag (första beviset på konceptet idag) – FLOW får aldrig ta in mer nytt än policyns gräns per dygn
  dayFacts(kid) { const d = LE2.dayIdx(LE.now()); const m = EXP._df || (EXP._df = {}); if (!m[kid.id] || m[kid.id].d !== d) m[kid.id] = { d, s: new Set() }; return m[kid.id].s; },   // bara i minnet
  newToday(C, now) { const d = LE2.dayIdx(now); return Object.entries(C.L.c).filter(([id, c]) => c.fs && LE2.dayIdx(c.fs * 1000) === d && C.cat[id] && C.cat[id].kind !== 'deck').length; },
  flowPlan(kid, C, now, id) {
    const p = prof(kid.id); const newCap = V2.newCapToday(C, now, p);
    // FLOW är kortare än dagens CORE (granskning: policyns längd räckte inte – CORE kan vara 3–5 uppgifter)
    const d0 = LE2.dayIdx(now); const core = V2.v2recs(p).filter(r => r.m === 'kor' && LE2.dayIdx(r.t * 1000) === d0).slice(-1)[0]; const coreN = core && core.v2 ? core.v2.length : 0;
    if (coreN && coreN <= 2) return [];   // dagens CORE var mycket kort (t.ex. dagen före provet): inget extrablock som är lika långt (verifieringspass)
    const base = Math.round(V2.n(kid, C) * 0.6); const n = coreN ? Math.max(2, Math.min(base, coreN - 1)) : Math.max(3, base);
    let plan = LE.plan(kid, n, now, id, { newCap }).plan;
    // Motorns pass har en minsta längd per policy; FLOW visar bara början av planen (samma ordning, Bossen sist) så att extrablocket
    // alltid är kortare än CORE. Inget läggs till – bara färre uppgifter.
    if (plan.length > n) { const boss = plan.find(x => x.role === 'boss'); const keep = plan.filter(x => x !== boss).slice(0, boss ? n - 1 : n); const meta = plan; plan = boss ? [...keep, boss] : keep; for (const k of Object.keys(meta)) if (!/^\d+$/.test(k)) plan[k] = meta[k]; plan.maxItems = Math.min(meta.maxItems || n + 2, n + 2); }   // alla planens egenskaper följer med – även only (3.1 Bara prov och läxor; granskning: FLOW tappade begränsningen)
    plan.flow = true; plan.newCap = newCap; return plan;
  },
  peekFlow(kid) { return EXP.safe(() => { const C = LE.state(kid); return EXP.flowPlan(kid, C, LE.sessClock(C)); }, 'peekFlow', []); },   // 3.1: samma klocka som när FLOW startar
  flowMins(kid) { return EXP.mins(EXP.peekFlow(kid), kid); },
  // "cirka N min": samma uppskattning som Kör! (0,6 min per uppgift) + en extra minut per trolig pappersuppgift (räknas på papper tar längre tid)
  mins(plan, kid) { const C = LE.state(kid); const paper = (EXP.of(kid) !== 'explore') ? plan.filter(s => ['focus', 'practice', 'boss'].includes(s.role) && EXP.PAPER[((C.cat[s.cid] || {}).ref) || '']).length : 0; return V2.mins(plan.length) + Math.min(paper, Math.ceil(plan.length / 2)); },
  canFlow(kid) { const p = prof(kid.id); return EXP.flowsToday(p) < EXP.FLOW_MAX && EXP.extraDone(p) < EXP.FLOW_MAX && EXP.peekFlow(kid).length > 0; },   // 3.4: dygnets belönade extrablock = FLOW + provträning, högst FLOW_MAX
  /* 3.4 fas D – "BELÖNINGAR HAR TAK, LÄRANDET INTE". Efter dagens belönade extrablock (FLOW_MAX FLOW, eller provträning när dygnets
     FLOW_MAX extrablock är använda) erbjuds frivillig "Öva mer": samma motor, samma plan som FLOW, dygnets gräns för nytt, högst ett
     stadiesteg per dygn – men inga XP, diamanter, märken, uppdrag eller belöningsrader. Ingenting startar av sig självt, och efter varje
     block finns en tydlig slutpunkt. Passposten märks po:1 (övning). Fel och Rescue hanteras som vanligt (Felboken, motorns bevis). */
  extraDone(p) { const d0 = EXP.today(); return V2.v2recs(p).filter(r => (r.m === 'flow' || r.m === 'mission' || r.m === 'more') && LE2.dayIdx(r.t * 1000) === d0).length; },
  // Gör planen nytta? Minst en uppgift (utom Bossen) på något som inte redan blivit rätt idag – annars är det bara upprepning (granskning)
  // Nytta: nytt (inom dygnets gräns), inte rätt idag, en Utmaning (fördjupning) – eller något som fortfarande lärs in (stadium ≤ 1) och
  // har färre än tre rätt idag (varierad övning). Det som redan sitter och redan blivit rätt idag är bara upprepning.
  useful(plan, kid) { try { const C = LE.state(kid); const d0 = LE2.dayIdx(LE.now()); return (plan || []).some(s => s.role !== 'boss' && (() => { if (s.role === 'challenge') return true; const c = C.L.c[s.cid]; if (!c || !c.n) return true; const okToday = (c.ev || []).filter(e => e[1] === 1 && LE2.dayIdx(e[0] * 1000) === d0).length; return okToday === 0 || (c.st <= 1 && okToday < 3); })()); } catch (e) { return false; } },   // granskning: räknar rätt svar idag ur bevisen (lastOk sätts bara vid kvalificerande svar)
  canMore(kid) { const p = prof(kid.id); return EXP.on(kid) && EXP.coreDone(p) && (EXP.flowsToday(p) >= EXP.FLOW_MAX || EXP.extraDone(p) >= EXP.FLOW_MAX) && EXP.useful(EXP.peekFlow(kid), kid); },
  practiceOnly(kid, mode) { const p = prof(kid.id); return EXP.on(kid) && (mode === 'more' || ((mode === 'mission' || mode === 'flow') && EXP.extraDone(p) >= EXP.FLOW_MAX) || (mode === 'exam' && EXP.examsToday(p) >= 1)); },
  examsToday(p) { const d0 = EXP.today(); return V2.v2recs(p).filter(r => r.m === 'exam' && r.done && LE2.dayIdx(r.t * 1000) === d0).length; },   // Testa mig: en belönad omgång per dygn
  // Ett övningsblock pågår (Öva mer, eller provträning efter dygnets tre extrablock): inga poäng vid källan. Slutar gälla när passet är slut.
  poActive() { return typeof S !== 'undefined' && !!S && !!S.v2 && S.v2.po === true && !S.v2.ended && typeof state !== 'undefined' && state.screen === 'practice'; },   // ett avbrutet block spärrar inte senare (granskning)
  // Befintliga externa resurser för målets moment (t.ex. kemins Begreppa-filmer) – inget genereras
  resources(kid, e) { try { if (!e || typeof BEGREPPA === 'undefined') return []; const out = []; const sk = [...new Set([...(e.skillIds || []), ...(e.kps || []).map(cid => { const i = typeof PACKS !== 'undefined' && PACKS.info(cid); return i && i.kp && i.kp.skill; }).filter(Boolean)])]; for (const id of sk) for (const [t, u] of (BEGREPPA[id] || [])) if (/^https:\/\//.test(u) && !out.some(x => x.u === u)) out.push({ t, u }); return out.slice(0, 3); } catch (e2) { return []; } },
  // När det inte finns något mer som gör nytta: säg det ärligt (och visa en befintlig resurs om målet har en) – ingen utfyllnad
  enoughText(kid, m) {
    const res = m ? EXP.resources(kid, m.e) : [];
    return `<div class="card muted stack" style="text-align:center;gap:6px"><div>Det finns inget mer som gör nytta att öva i appen idag. Det du har övat sätter sig bäst med vila – imorgon finns nytt.</div>${res.length ? `<div style="font-size:.9rem">Vill du hellre titta på något? ${res.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.t)}</a>`).join(' · ')}</div>` : ''}</div>`;
  },
  // Efter dagens belönade block: vila först, och frivilligt "Öva mer" (allmänt eller mot ett mål) – båda utan poäng
  moreBtns(kid, m) {
    const btns = [];
    if (EXP.canMore(kid)) btns.push(`<button class="btn wide secondary btn-2l" data-v2="ovamer">Öva mer<span class="btn-sub"><span class="sep"> · </span>utan poäng, cirka ${EXP.flowMins(kid)} min</span></button>`);
    // 3.6: samma regel som Kör på raderna i Kommande (EXP.goalPractice) – först målet m, annars nästa kommande mål där träningen gör nytta
    { const cand = [m, ...EXP.upcoming(kid).slice(0, EXP.UPCOMING_MAX)].filter((x, i, a) => x && V2.examCidsActive(kid, x.e).length && a.findIndex(y => y && y.e.id === x.e.id) === i); let hit = null, mp = [];
      for (const x of cand) { const g = EXP.goalPractice(kid, x.e); if (g.ok && EXP.useful(g.mp, kid)) { hit = x; mp = g.mp; break; } }
      if (hit) { m = hit; btns.push(`<button class="btn wide ghost btn-2l" data-v2="mission" data-exam="${esc(m.e.id)}">Öva mer inför ${esc(m.e.title)}<span class="btn-sub"><span class="sep"> · </span>${EXP.practiceOnly(kid, 'mission') ? 'utan poäng, ' : ''}cirka ${EXP.mins(mp, kid)} min</span></button>`); } }
    return btns.join('');
  },
  /* ---------- Planens presentation ---------- */
  STATION: { warm: ['Värm upp', '☀️'], minns: ['Minns', '🧠'], upptack: ['Upptäck', '🔎'], klura: ['Klura', '🧩'], revansch: ['Revansch', '💪'], utmaning: ['Utmaning', '🧗'], boss: ['Boss', '👑'] },
  stationOf(slot, C) { const c = C.L.c[slot.cid]; if (slot.role === 'boss') return 'boss'; if (slot.mode === 'challenge' || slot.role === 'challenge') return 'utmaning'; if (slot.role === 'revansch') return 'revansch'; if (slot.role === 'warmup') return 'warm'; if (slot.role === 'remember') return 'minns'; return !c || !c.n ? 'upptack' : 'klura'; },
  nameOf(kid, C, cid) { const d = C.cat[cid] || {}; return d.kind === 'kp' ? V2.skillName(kid, d.ref) : d.kind === 'deck' ? d.name : V2.readable((V2.skillOf(kid, cid) || {}).short || d.name || ''); },
  repLabel(kid, C, items) { const langs = []; for (const x of items) { const d = C.cat[x.cid] || {}; if (d.kind !== 'deck') continue; const dk = (typeof deckById === 'function' && deckById(prof(kid.id), d.ref)) || null; const L = dk && typeof LANGS !== 'undefined' && LANGS[dk.lang]; const n = L ? (dk.lang === 'sv' ? 'svenska ord' : L.name.toLowerCase() + ' glosor') : 'glosor'; if (!langs.includes(n)) langs.push(n); } return langs.length ? 'Repetition: ' + langs.join(', ') : 'Repetition'; },
  summary(kid, plan0) {
    const C = LE.state(kid); const plan = plan0 || V2.peekPlan(kid).plan; const names = []; let rep = false; let rev = false;
    // Det som tränas: dagens fokus/nytt/prov först, sedan Revansch och Repetition som egna rader (inte tio kunskapspunkter)
    for (const s of plan) { if (s.role === 'boss') continue; if (s.role === 'remember' || s.role === 'warmup') { rep = true; continue; } if (s.role === 'revansch') { rev = true; continue; } const nm = EXP.nameOf(kid, C, s.cid); if (nm && !names.includes(nm)) names.push(nm); }
    const list = names.slice(0, 3); if (rev) list.push('Revansch'); if (rep) list.push(EXP.repLabel(kid, C, plan.filter(x => x.role === 'remember' || x.role === 'warmup')));
    const st = []; for (const s of plan) { const k = EXP.stationOf(s, C); if (!st.includes(k)) st.push(k); }
    // Achieve: dela upp i det som hör till nästa prov och det som också övas idag (med momentens fulla namn)
    const g = EXP.goalOf(kid, plan).now; const inExam = new Set(g ? LE.examCids(C, g.e) : []); const ex = [], also = [];
    const fullName = (cid) => { const d = C.cat[cid] || {}; return d.kind === 'kp' ? (PACKS.skillFor(kid, d.ref) || {}).name || EXP.nameOf(kid, C, cid) : d.kind === 'skill' ? ((V2.skillOf(kid, cid) || {}).name || d.name) : EXP.nameOf(kid, C, cid); };
    // UX-granskning: provets moment syns även när de kommer som repetition, Revansch eller Boss ("Repetition: Parenteser") – annars sa
    // rubriken "algebra" medan listan bara visade annat
    const PFX = { remember: 'Repetition', warmup: 'Repetition', revansch: 'Revansch', boss: 'Boss' };
    for (const s0 of plan) { const nm = fullName(s0.cid); if (!nm) continue; const exam = inExam.has(s0.cid);
      if (PFX[s0.role]) { if (exam) { const t = PFX[s0.role] + ': ' + nm; if (!ex.includes(t) && !ex.includes(nm)) ex.push(t); } continue; }
      const arr = exam ? ex : also; if (!ex.includes(nm) && !also.includes(nm)) arr.push(nm); }
    // 3.0.1: Repetition säger vad som repeteras när det är glosor ("Repetition: engelska glosor"), och står först när passet börjar
    // med den – annars lovade kortet "algebra" och passet började med något som såg ut som en annan övning (ägarens fynd)
    const repS = plan.filter(x => (x.role === 'remember' || x.role === 'warmup') && !inExam.has(x.cid));
    if (repS.length) { const lbl = EXP.repLabel(kid, C, repS); if (plan[0] && repS.includes(plan[0])) also.unshift(lbl); else also.push(lbl); }
    if (plan.some(x => x.role === 'revansch' && !inExam.has(x.cid))) also.push('Revansch');
    return { n: plan.length, mins: EXP.mins(plan, kid), list, exList: ex.slice(0, 4), alsoList: also.slice(0, 3), stations: st, light: !!plan.light, plan, C };
  },
  /* 3.6.1 (ägarens fynd): dagens plan visas i den ordning passet faktiskt startar, grupperad per ämne, med fördelningen – skild från nästa
     deadline. Motorns val av innehåll och ordning är orörda; det här är bara presentationen av samma plan som Kör! startar. */
  SUBJ: { math: 'matte', sv: 'svenska', no: 'NO', so: 'SO', lang: 'språk', en: 'engelska' },
  low(t) { t = String(t || '').trim(); return t.length > 1 && t[1] === t[1].toLowerCase() ? t[0].toLowerCase() + t.slice(1) : t; },
  subjLabel(kid, C, cid) {
    const d = C.cat[cid] || {};
    if (d.kind === 'deck') { const r = EXP.repLabel(kid, C, [{ cid }]); return r.replace(/^Repetition: /, '') === 'Repetition' ? 'glosor' : r.replace(/^Repetition: /, ''); }
    const pk = d.kind === 'kp' && typeof PACKS !== 'undefined' && PACKS.REG && PACKS.REG.packs[d.pack]; if (pk && pk.topic) return EXP.low(pk.topic);
    const sk = d.kind === 'skill' ? V2.skillOf(kid, cid) : null; if (sk && sk.pack && sk.subject) return EXP.low(sk.subject);
    return EXP.SUBJ[d.subject] || EXP.low(d.subject) || 'övrigt';
  },
  // Planens delar: ämnen i den ordning de först dyker upp, områden per ämne, antal uppgifter per ämne. Bossen väljs under passet bland det
  // som gått bra och räknas därför för sig ("1 bossuppgift"), aldrig som ett visst ämne.
  planParts(kid, C, plan) {
    const fullName = (cid) => { const d = C.cat[cid] || {}; return d.kind === 'kp' ? (PACKS.skillFor(kid, d.ref) || {}).name || EXP.nameOf(kid, C, cid) : d.kind === 'skill' ? ((V2.skillOf(kid, cid) || {}).name || d.name) : EXP.nameOf(kid, C, cid); };
    const REP = new Set(['remember', 'warmup']); const groups = []; const seq = []; let boss = 0;
    for (const s of plan) {
      if (s.role === 'boss') { boss++; continue; }
      const lbl = EXP.subjLabel(kid, C, s.cid); seq.push(lbl); let g = groups.find(x => x.label === lbl); if (!g) groups.push(g = { label: lbl, n: 0, areas: [] }); g.n++;
      const nm = fullName(s.cid); if (!nm) continue; let a = g.areas.find(x => x.name === nm); if (!a) g.areas.push(a = { name: nm, roles: new Set() }); a.roles.add(s.role);
    }
    for (const g of groups) g.items = g.areas.map(a => a.name + ([...a.roles].every(r => REP.has(r)) ? ' (repetition)' : [...a.roles].every(r => r === 'revansch') ? ' (revansch)' : ''));
    const runs = seq.filter((x, i) => i === 0 || seq[i - 1] !== x); const blocks = runs.length === groups.length;
    return { groups, seq, boss, blocks, first: seq[0] || null };
  },
  planTitle(parts) { const ls = parts.groups.map(g => g.label); const t = ls.length > 3 ? ls.slice(0, 2).join(' + ') + ` + ${ls.length - 2} till` : ls.join(' + '); return t ? t[0].toUpperCase() + t.slice(1) : ''; },
  splitText(parts) { return [...parts.groups.map(g => `${g.n} ${g.label}`), ...(parts.boss ? [`${parts.boss} ${parts.boss === 1 ? 'bossuppgift' : 'bossuppgifter'}`] : [])].join(' · '); },
  orderText(parts) { if (parts.groups.length < 2) return ''; const ls = parts.groups.map(g => g.label); return parts.blocks ? `Först ${ls[0]}, sedan ${ls.slice(1).join(', sedan ')}.` : `Ämnena blandas i passet. Det börjar med ${parts.first}.`; },
  // Framsteg med betydelse (Grow/Achieve): motorns barnetiketter för koncept som barnet har övat. Inga procent.
  progress(kid) { const C = LE.state(kid); const now = LE.now(); const out = { 'Säker': 0, 'På väg': 0, 'Tränar': 0, 'Behöver repetition': 0 }; for (const [id, c] of Object.entries(C.L.c)) { const d = C.cat[id]; if (!d || d.active === false || d.kind === 'deck' || !c.n) continue; const l = LE2.childLabel(c, now, C.pol, C.L); if (l in out) out[l]++; } return out; },
  /* ---------- Startsidan ---------- */
  home(kid) {
    return EXP.safe(() => {
      const p = prof(kid.id); if (!LE.canStart(kid, p)) return V2.korBtn(kid);
      const e = EXP.of(kid); const welcome = EXP.welcome(kid);
      { const sc = V2.scopeCard(kid); if (sc) return sc; }   // 3.1: Bara prov och läxor – inget att öva
      return welcome + (e === 'explore' ? EXP.exploreHome(kid, p) : e === 'grow' ? EXP.growHome(kid, p) : EXP.achieveHome(kid, p));
    }, 'home', V2.korBtn(kid));
  },
  go(kid, label, sub) { return `<button class="go-btn v3go" data-v2="kor"><div><div class="t">${esc(label)}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div><div class="arrow">${ICON.arrow}</div></button>`; },
  chips(stations) { return `<div class="stations" aria-label="Det här väntar">${stations.slice(0, 5).map(k => `<span class="station st-${k}"><span class="si" aria-hidden="true">${EXP.STATION[k][1]}</span><span class="sl">${EXP.STATION[k][0]}</span></span>`).join('')}</div>`; },
  flowBtn(kid, label, cls = 'btn big wide') { return EXP.canFlow(kid) ? `<button class="${cls}" data-v2="flow">${esc(label)}</button>` : ''; },
  doneCard(kid, p, title, sub, flowLabel) {
    const canMore = EXP.canFlow(kid); const rest = EXP.flowsToday(p) >= EXP.FLOW_MAX || EXP.extraDone(p) >= EXP.FLOW_MAX;
    return `<section class="card pad-lg mission done stack" aria-label="${esc(title)}"><div class="mission-icon" aria-hidden="true">✅</div><div class="eyebrow">${esc(title)}</div>
      <div class="mission-sub">${sub}</div>
      ${canMore ? `<button class="btn big wide secondary btn-2l" data-v2="flow">${esc(flowLabel)}<span class="btn-sub"><span class="sep"> · </span>cirka ${EXP.flowMins(kid)} min</span></button>` : (() => { const m = EXP.goalOf(kid, null).now; const more = rest ? EXP.moreBtns(kid, m) : ''; return `<div class="muted">${rest ? 'Bra jobbat idag! Det du har övat sätter sig bäst om du vilar nu.' : 'Allt för idag är gjort.'}</div>${more || (rest || !EXP.peekFlow(kid).length ? EXP.enoughText(kid, m).replace('class="card muted stack"', 'class="muted stack"') : '')}`; })()}</section>`;
  },
  // 3.4: en tom plan (t.ex. kvällen före ett prov utan något sett att repetera) får ingen KÖR-knapp som inte startar något och inga "0 uppgifter"
  emptyCard(kid, title, extra = '') {
    const ds = LE.exams(kid, prof(kid.id)).filter(e => LE.isMajor(e)).map(e => daysUntil(e.date)).filter(d => d >= 0 && d <= 1); const eve = ds.length > 0;
    return `<section class="card pad-lg mission empty stack" aria-label="${esc(title)}"><div class="eyebrow">${esc(title)}</div>
      <div class="mission-sub">${eve ? (Math.min(...ds) === 0 ? 'På provdagen' : 'Dagen före ett prov') + ' tar Kör! inte in något nytt – och inget väntar på repetition idag.' : 'Kör! har inget som gör nytta just nu.'}</div>
      <div class="muted">Vila gärna, eller öva på egen hand nedanför.</div>${extra}</section>`;
  },
  exploreHome(kid, p) {
    if (EXP.coreDone(p)) return EXP.doneCard(kid, p, 'ÄVENTYRET KLART!', 'Du är klar för idag.', 'ETT ÄVENTYR TILL');
    const s = EXP.summary(kid);
    if (!s.n) return EXP.emptyCard(kid, 'DAGENS ÄVENTYR');
    const pet = p.pet && p.pet !== 'none' && typeof petEmoji === 'function' ? `<div class="hero-pet" aria-hidden="true">${petEmoji(p)}</div>` : '';   // 3.3: följeslagaren hör hemma i äventyret
    return `<section class="card pad-lg mission explore stack" aria-label="Dagens äventyr">${pet}<div class="eyebrow">DAGENS ÄVENTYR</div>
      <div class="mission-title">${s.n} små utmaningar</div><div class="muted">cirka ${s.mins} min${s.list.filter(x => x !== 'Repetition' && x !== 'Revansch').length ? ` · ${s.list.filter(x => x !== 'Repetition' && x !== 'Revansch').slice(0, 2).map(esc).join(' och ')}` : ''}</div>${EXP.chips(s.stations)}
      ${EXP.go(kid, LBL(kid).go.toUpperCase())}</section>`;
  },
  growHome(kid, p) {
    const m = V2.mission(kid); const label = LBL(kid).go.toUpperCase();
    if (EXP.coreDone(p)) return EXP.doneCard(kid, p, 'RUNDAN KLAR!', 'Du är klar för idag.', 'EN RUNDA TILL');
    const s0 = EXP.summary(kid); if (!s0.n) return EXP.emptyCard(kid, 'DAGENS RUNDA');
    const s = s0; const sh = EXP.examShare(kid, m, s.plan); const ex = m && sh.n > 0; const pr = EXP.progress(kid); const C = s.C; const fb = V2.felbok(kid, C, LE.now()); const todo = fb.items.filter(x => x.state === 'todo').length;
    // 3.3: motorns tre lägen med barnets ord – "sitter", "på väg", "övar" – och en rubrik som säger vad stapeln är
    const parts = [[pr['Säker'], 'sitter', 'skra'], [pr['På väg'], 'på väg', 'pvg'], [pr['Tränar'] + pr['Behöver repetition'], 'övar', 'trnar']].filter(x => x[0] > 0);   // bara lägen som finns – ingen "0 sitter"
    const tot3 = parts.reduce((a, x) => a + x[0], 0);
    const prog = parts.length ? `<div class="grow-prog"><div class="gp-head">Dina ${tot3} områden</div><div class="pbar3" aria-hidden="true">${parts.map(([n, t, c]) => `<i class="p-${c}" style="flex:${n}"></i>`).join('')}</div><div class="progress-states" aria-label="Dina ${tot3} områden: ${parts.map(([n, t]) => `${n} ${t}`).join(', ')}">${parts.map(([n, t, c]) => `<span class="p-${c}"><i class="dot" aria-hidden="true"></i><b>${n}</b> ${t}</span>`).join('')}</div></div>` : '';
    // 3.3: skoluppgiften på en rad (knappen bara när det finns något att öva just nu)
    const mb = m && !ex ? EXP.missionBtn(kid, m, 'btn wide secondary') : ''; const mbBtn = /<button/.test(mb);
    const goalRow = m && !ex ? `<div class="goal-row"><span aria-hidden="true">📅</span> ${EXP.isExam(m.e) ? 'Nästa prov' : 'Nästa uppgift'}: <b>${esc(m.e.title)}</b> · ${esc(fmtDate(m.e.date))}${V2.examCidsActive(kid, m.e).length ? ' – dagens runda övar annat' : ' – områdena är inte inlagda i appen ännu'}</div>${mbBtn ? mb : ''}` : '';
    return `<section class="card pad-lg mission grow stack" aria-label="Dagens runda"><div class="eyebrow">${ex ? `DAGENS MISSION · ${esc(m.e.title.toUpperCase())} · ${esc(fmtDate(m.e.date).toUpperCase())}` : 'DAGENS RUNDA'}</div>
      <div class="mission-title">${s.n} uppgifter · cirka ${s.mins} min</div>${ex ? `<div class="muted" style="font-size:.95rem">${esc(EXP.shareText(sh, m.e))}</div>` : ''}
      ${s.list.length ? `<div class="muted" style="font-size:.95rem">Idag: ${s.list.map(esc).join(' · ')}</div>` : ''}${prog}
      ${EXP.go(kid, label)}
      ${goalRow}
      ${todo ? `<button class="btn ghost wide" data-v2="revansch">Hellre revansch först? · ${todo} ${todo === 1 ? 'sak' : 'saker'}</button>` : ''}</section>`;
  },
  goalOf(kid, plan) {
    const p = prof(kid.id); const all = LE.exams(kid, p).map(e => ({ e, d: daysUntil(e.date) })).filter(x => x.d >= 0).sort((a, b) => a.d - b.d || (b.e.priority === 'high') - (a.e.priority === 'high') || (a.e.id < b.e.id ? -1 : 1));
    // 3.4 flera mål: rubriken är målet som dagens plan faktiskt tränar mest (lika → närmast), inte bara det närmaste datumet
    const win = all.filter(x => x.d <= V2.MISSION_DAYS); let now = win[0] || null;
    if (plan && win.length > 1) { let best = null, bn = 0; for (const x of win) { const n = EXP.examShare(kid, x, plan).n; if (n > bn) { bn = n; best = x; } } if (best) now = best; }
    return { now, next: now ? all.find(x => x !== now && x.d <= 60) || null : null, all };   // "Sedan:" – bara en rad, aldrig en andra plan
  },
  isExam(e) { return e && (e.kind === 'exam' || /prov|förhör|test/i.test(e.title || '')); },
  /* Hotfix 2.1.1-principen i v3: en provmärkt knapp startar ett pass som verkligen innehåller provets områden. examShare räknar hur
     stor del av en plan som hör till provet; missionBtn erbjuder provets egen träning (bara provets koncept) – eller säger ärligt att
     provets områden inte är inlagda ännu. Inget tyst utbyte mot annat innehåll. */
  // v3: "N av M": M = alla platser (samma antal som passets räknare "Uppgift 1 av M", UX-granskning); N räknar inte Bossen. Klassisk: som 2.1.1.
  examShare(kid, m, plan) { if (!m) return { cids: [], n: 0, of: 0 }; const cids = V2.examCidsActive(kid, m.e); const set = new Set(cids); const pl = plan || []; const bossIn = !!(pl.only && [...pl.only].every(c => set.has(c))); return { cids, n: pl.filter(s => (s.role !== 'boss' || bossIn) && set.has(s.cid)).length, of: pl.length }; },   // Bossens plats väljs om under passet och räknas därför inte som prov – utom med Bara prov och läxor och bara det här provet (3.1.2): då väljs den om bland provets områden och räknas. Passets längd gäller alltid.
  mostly(sh) { return sh.n > 0 && sh.n * 2 >= sh.of; },   // "MOT PROVET" på FLOW-knappen bara när minst hälften av extrapasset hör till provet (granskning)
  // 3.6.1: rätt ord för målet – "inför läxförhöret" för ett läxförhör, inte "inför provet"
  noun(e) { const k = e && e.kind; const t = String((e && e.title) || ''); return k === 'exam' ? 'provet' : k === 'homework' ? 'läxförhöret' : k === 'vocab' ? 'glosförhöret' : /läxförhör/i.test(t) ? 'läxförhöret' : /glos/i.test(t) ? 'glosförhöret' : /prov|test/i.test(t) ? 'provet' : /förhör/i.test(t) ? 'förhöret' : 'uppgiften'; },
  nounGen(e) { const w = EXP.noun(e) + 's'; return w[0].toUpperCase() + w.slice(1); },   // "Läxförhörets områden"
  shareText(sh, e) { const w = e ? EXP.noun(e) : 'provet'; return sh.n === sh.of ? `Allt inför ${w}` : `${sh.n} av ${sh.of} uppgifter inför ${w}`; },
  missionBtn(kid, m, cls = 'btn big wide secondary') {
    if (!m) return ''; const cids = V2.examCidsActive(kid, m.e);
    if (!cids.length) return `<div class="muted" style="font-size:.95rem">${EXP.nounGen(m.e)} områden är inte inlagda i appen ännu – Kör! övar annat under tiden.</div>`;   // UX: ingen uppgift till barnet (föräldern ser luckan i sin vy)
    const mp = EXP.safe(() => V2.plan(kid, 'mission', LE.state(kid), LE.now(), null, { examId: m.e.id }), 'missionPeek', []);
    const lbl = EXP.isExam(m.e) ? 'Öva inför ' + EXP.noun(m.e) : 'Öva på ' + m.e.title;
    return mp.length ? `<button class="${cls}" data-v2="mission" data-exam="${esc(m.e.id)}">${esc(lbl)} · cirka ${EXP.mins(mp, kid)} min</button>`
      : `<div class="muted" style="font-size:.95rem">Inget behöver övas för ${EXP.noun(m.e)} just nu – appen tar det när det är dags.</div>`;
  },
  achieveHome(kid, p) {
    const plan0 = V2.peekPlan(kid).plan; const g = EXP.coreDone(p) ? EXP.goalOf(kid, EXP.peekFlow(kid)) : EXP.goalOf(kid, plan0); const m = g.now;
    const sedan = g.next ? `<div class="then">${m && g.next.d < m.d ? 'Före det' : 'Sedan'}: <b>${esc(g.next.e.title.toUpperCase())}</b> · <span class="nw">${esc(fmtDate(g.next.e.date).toUpperCase())}</span></div>` : '';
    if (EXP.coreDone(p)) { const fsh = EXP.examShare(kid, m, EXP.peekFlow(kid)); return EXP.doneCard(kid, p, 'DAGENS PLAN KLAR', 'Appen håller koll på resten.', m && EXP.isExam(m.e) && EXP.mostly(fsh) ? 'FORTSÄTT MOT ' + EXP.noun(m.e).toUpperCase() : 'FORTSÄTT') + (() => { const u = EXP.upcomingSafe(kid); return u + EXP.goalDetailUnless(kid, m, u); })(); }
    const s = EXP.summary(kid, plan0); if (!s.n) return EXP.emptyCard(kid, 'DAGENS PLAN', sedan) + (() => { const u = EXP.upcomingSafe(kid); return u + EXP.goalDetailUnless(kid, m, u); })();
    // 3.6.1 (ägarens beslut): NÄSTA DEADLINE (närmaste målet, litet) skilt från DAGENS PLAN (hela passet, i passets egen ordning per ämne,
    // med fördelningen). Rubriken lovar aldrig att passet består av målet; andelen säger hur mycket som hör dit, med målets eget ord.
    const dl = (g.all || []).find(x => x.d <= EXP.UPCOMING_DAYS) || null; const after = dl ? (g.all || []).find(x => x !== dl && x.d <= EXP.UPCOMING_DAYS) || null : null;
    const dsh = EXP.examShare(kid, dl, s.plan); const dlIn = !!dl && dsh.n > 0; const hasC = !!dl && V2.examCidsActive(kid, dl.e).length > 0;
    const dlWhen = dl ? `${esc(fmtDate(dl.e.date))} · ${dl.d === 0 ? 'idag' : dl.d === 1 ? 'imorgon' : `om ${dl.d} dagar`}` : '';
    const parts = EXP.planParts(kid, s.C, s.plan); const ord = EXP.orderText(parts);
    const deadline = dl ? `<div class="deadline"><div class="eyebrow">NÄSTA DEADLINE</div><div class="dl-line"><b>${esc(dl.e.title)}</b> · ${dlWhen}</div>
      <div class="dl-share muted">${dlIn ? `<span class="share">${esc(EXP.shareText(dsh, dl.e))}</span> i dagens plan` : hasC ? 'Dagens plan övar annat.' : `${EXP.nounGen(dl.e)} områden är inte inlagda i appen ännu.`}</div></div>` : '';
    const sedan2 = after ? `<div class="then">Sedan: <b>${esc(after.e.title.toUpperCase())}</b> · <span class="nw">${esc(fmtDate(after.e.date).toUpperCase())}</span></div>` : '';
    return `<section class="card pad-lg mission achieve stack" aria-label="Dagens plan">${deadline}
      <div class="eyebrow">DAGENS PLAN</div><div class="goal-title">${esc(EXP.planTitle(parts).toUpperCase())}</div>
      <div class="plan-meta"><span class="mins">${s.n} ${s.n === 1 ? 'uppgift' : 'uppgifter'} · cirka ${s.mins} min</span><span class="split">${esc(EXP.splitText(parts))}</span></div>
      ${parts.groups.length ? `<div class="train"><div class="eyebrow">DET HÄR TRÄNAR VI IDAG</div><ul>${parts.groups.slice(0, 4).map(gr => `<li data-subj="${esc(gr.label)}"><b>${esc(gr.label[0].toUpperCase() + gr.label.slice(1))}:</b> ${gr.items.slice(0, 4).map(esc).join(' · ')}${gr.items.length > 4 ? ` · +${gr.items.length - 4}` : ''}</li>`).join('')}</ul>${ord ? `<div class="muted order">${esc(ord)}</div>` : ''}</div>` : ''}
      ${EXP.go(kid, LBL(kid).go.toUpperCase())}${dl && !dlIn && hasC ? EXP.missionBtn(kid, dl) : ''}${sedan2}</section>` + (() => { const u = EXP.upcomingSafe(kid); return u + EXP.goalDetailUnless(kid, m, u); })();
  },
  /* 3.6: målets egen träning ("Kör" på en rad i Kommande, "Öva mer inför" efter dygnets extrapass) – EN regel för båda, så att skärmen
     aldrig säger emot sig själv (granskning P2-A): planen för målet, och efter dygnets belönade extrapass bara när den gör nytta. */
  // Efter dagens pass (granskning P1-B): bara när det gör nytta, och inte alls när motorn inte ger något extrapass idag (t.ex. kvällen före ett
  // prov) – då säger startkortet "Allt för idag är gjort … inget mer som gör nytta", och raderna säger samma sak.
  goalPractice(kid, e, C, now) { const mp = EXP.safe(() => V2.plan(kid, 'mission', C || LE.state(kid), now || LE.now(), null, { examId: e.id }), 'goalPeek', []); const p = prof(kid.id);
    const po = EXP.on(kid) && EXP.practiceOnly(kid, 'mission'); const done = EXP.on(kid) && EXP.coreDone(p); const rest = EXP.flowsToday(p) >= EXP.FLOW_MAX || EXP.extraDone(p) >= EXP.FLOW_MAX;
    const blocked = done && !rest && !po && !EXP.canFlow(kid); const needUseful = po || done;
    return { mp, po, ok: mp.length > 0 && !blocked && (!needUseful || EXP.useful(mp, kid)) }; },
  /* 3.6 Kommande: barnet ser alla sina kommande prov och läxor på en gång (ägarens önskemål) – i datumordning, med "om X dagar".
     Bara barnets egna mål (samma LE.exams som planen), inget om resultat, inga betyg, ingen jämförelse. Visas bara när det finns något. */
  UPCOMING_DAYS: 60, UPCOMING_MAX: 6,
  upcoming(kid) { return (EXP.goalOf(kid, null).all || []).filter(x => x.d <= EXP.UPCOMING_DAYS); },
  upcomingSafe(kid) { return EXP.safe(() => EXP.upcomingCard(kid), 'upcoming', ''); },   // direkt under hjältekortet: före "Läget inför"
  upcomingCard(kid) {
    const all = EXP.upcoming(kid); if (!all.length) return '';
    const rel = (d) => (d === 0 ? 'idag' : d === 1 ? 'imorgon' : `om ${d} dagar`);
    // Typ: skoluppgifternas typ (FAMILY.WORK_TYPES); ett prov som föräldern lagt in utan typ är "Förhör" när det är mindre (läx- eller glosförhör)
    const kindOf = (e) => (e.kind === 'homework' ? 'Läxa' : e.kind === 'vocab' ? 'Glosor' : LE.isMajor(e) ? 'Prov' : 'Förhör');
    // Granskning P2-1: före första synken får kortet inte röra motorns tillstånd (LE.state skulle migrera en kanske inaktuell profil) – då bara listan
    const can = LE.canStart(kid, prof(kid.id));
    const has = can ? (e) => V2.examCidsActive(kid, e).length > 0 : () => true;
    // Ärligt: foten säger vad nästa pass på startsidan faktiskt övar – samma plan och samma räkning som startkortets rubrik (EXP.examShare).
    // Före dagens pass: "Dagens pass". Efter det: "Nästa extrapass", bara medan ett sådant erbjuds (EXP.canFlow) – annars ingen fot (granskning P2-B).
    // Mål utan innehåll räknas aldrig; utan plan (t.ex. "Bara prov och läxor" utan mål inom fyra veckor) ingen fot.
    const done = can && EXP.coreDone(prof(kid.id)); const pre = done ? 'Nästa extrapass' : 'Dagens pass';
    const plan = !can ? [] : done ? (EXP.canFlow(kid) ? EXP.peekFlow(kid) : []) : EXP.safe(() => V2.peekPlan(kid).plan, 'upPlan', []);
    const inPlan = can ? all.filter(x => has(x.e) && EXP.examShare(kid, x, plan).n > 0).length : 0; const withC = all.filter(x => has(x.e)).length;
    const foot = !can || !withC || !plan.length ? '' : !inPlan ? `${pre} övar annat. Kör på en rad övar bara det målet.`
      : inPlan === all.length ? `${pre} övar inför ${inPlan > 1 ? 'alla de här' : 'det här'}.`
      : `${pre} övar inför ${inPlan > 1 ? `${inPlan} av dem` : 'ett av dem'}. Kör på en rad övar bara det målet.`;
    /* 3.6 Kör och Testa mig per mål (ägarens önskemål): "Kör" övar bara det målet – samma läge som "Öva inför provet" (V2.plan 'mission':
       bara målets koncept, dygnets gräns för nytt, räknas som ett av dygnets extrapass, utan poäng efter dygnets tak). "Testa mig" prövar
       om det sitter – samma prov som i "Läget inför" (en belönad omgång per dygn). Inga knappar före första synken eller för mål utan
       innehåll i appen; när inget av målet går att öva just nu säger raden det i stället för en knapp som inte gör något. */
    const C = can ? LE.state(kid) : null; const now = LE.now();
    // Efter dygnets belönade extrapass gäller Öva mer-reglerna – samma regel som "Öva mer inför" (EXP.goalPractice): bara när det gör nytta, och det sägs att det är utan poäng
    const acts = (e) => { if (!can || !has(e)) return ''; const { mp, po, ok } = EXP.goalPractice(kid, e, C, now); const n = ok ? EXP.mins(mp, kid) : 0;
      return `<div class="up-acts">${ok ? `<button class="btn secondary up-go" data-v2="mission" data-exam="${esc(e.id)}" aria-label="Kör bara ${esc(e.title)}, ${po ? 'utan poäng, ' : ''}cirka ${n} minuter">Kör<span class="up-min" aria-hidden="true"> · ${po ? 'utan poäng · ' : ''}${n} min</span></button>` : `<span class="up-none">${mp.length ? 'Inget mer som gör nytta idag' : 'Inget att öva just nu'}</span>`}<button class="btn ghost up-test" data-v2="testa" data-exam="${esc(e.id)}" aria-label="Testa mig på ${esc(e.title)}">Testa mig</button></div>`; };
    /* 3.6 Läget per mål (ägarens tredje önskemål): "Läget inför" för VARJE mål i samma rad – hopfällt, med motorns lägen per område (aldrig
       procent), samma källa som det tidigare kortet "Läget inför" (V2.examStatus / EXP.goalAreas). Sammanfattningen räknar bara lägena. */
    const state = (e) => { if (!can || !has(e)) return ''; const st = V2.examStatus(kid, e, C, now); const per = EXP.goalAreas(kid, e, C) || st.per; if (!per.length) return '';
      const thin = per.every(x => x.ready === 'För lite underlag'); const cnt = (r) => per.filter(x => x.ready === r).length;
      const sum = thin ? 'för lite underlag ännu' : [['Bra koll', 'bra koll'], ['Öva lite mer', 'öva lite mer'], ['För lite underlag', 'för lite underlag']].filter(([r]) => cnt(r)).map(([r, t]) => `${cnt(r)} ${t}`).join(' · ');
      return `<details class="up-state" data-goal="${esc(e.id)}"><summary><b>Läget</b> <span class="up-sum">· ${sum}</span></summary>${thin ? '<p class="muted" style="margin:6px 0 0;font-size:.9rem">Kör några pass så syns det här vad som sitter.</p>' : `<div class="stack" style="gap:6px;margin-top:6px">${per.slice(0, 8).map(x => `<div class="row" style="justify-content:space-between;gap:8px"><span>${esc(x.name)}</span><span class="pill ${V2.READY_CLS[x.ready]}" style="font-size:.75rem">${V2.READY_TXT[x.ready]}</span></div>`).join('')}</div>`}</details>`; };
    let anyState = false;
    const rows = all.slice(0, EXP.UPCOMING_MAX).map(({ e, d }) => { const k = kindOf(e); const sh = state(e); if (sh) anyState = true; return `<li class="up-row${d <= 3 ? ' soon' : ''}" data-row="${esc(e.id)}"><span class="up-kind k-${k === 'Prov' ? 'ex' : 'hw'}">${k}</span><span class="up-title">${esc(e.title)}</span><span class="up-when"><span class="nw">${esc(fmtDate(e.date))}</span> · <b class="nw">${rel(d)}</b>${has(e) ? '' : ' · inte inlagt i appen ännu'}</span>${acts(e)}${sh}</li>`; }).join('');
    const more = all.length > EXP.UPCOMING_MAX ? `<div class="muted" style="font-size:.9rem">och ${all.length - EXP.UPCOMING_MAX} till längre fram</div>` : '';
    return `<section class="card upcoming stack" aria-label="Kommande prov och läxor"><div class="eyebrow">KOMMANDE PROV OCH LÄXOR</div><ul class="up-list" role="list">${rows}</ul>${more}${foot ? `<div class="muted" style="font-size:.9rem">${foot}</div>` : ''}${anyState ? '<div class="muted" style="font-size:.85rem">Lägena bygger på hur det gått hittills – de säger inget om provresultatet.</div>' : ''}</section>`;
  },
  // Läget per område – hopfällt, med motorns tre lägen (aldrig procent). Testa mig är en sekundär knapp här.
  // 3.6: kortet Kommande visar läget för varje mål – då behövs inte det separata kortet för samma mål
  goalDetailUnless(kid, m, html) { return m && html && html.includes(`data-row="${esc(m.e.id)}"`) ? '' : EXP.goalDetail(kid, m); },   // målet har en rad i kortet (med läge, eller "inte inlagt") – inget separat kort
  goalDetail(kid, m) {
    if (!m) return '';
    const C = LE.state(kid); const st = V2.examStatus(kid, m.e, C, LE.now()); const per = EXP.goalAreas(kid, m.e, C) || st.per;
    return `<details class="card goal-detail"><summary><b>Läget inför ${esc(m.e.title)}</b></summary>
      ${per.every(x => x.ready === 'För lite underlag') ? `<p class="muted" style="margin:8px 0">För lite underlag ännu. Kör några pass så syns det här vad som sitter.</p>` : `<div class="stack" style="gap:6px;margin-top:8px">${per.slice(0, 8).map(x => `<div class="row" style="justify-content:space-between;gap:8px"><span>${esc(x.name)}</span><span class="pill ${V2.READY_CLS[x.ready]}" style="font-size:.75rem">${V2.READY_TXT[x.ready]}</span></div>`).join('')}</div>`}
      <p class="muted" style="font-size:.85rem;margin:8px 0">Lägena bygger på hur det gått hittills – de säger inget om provresultatet.</p>
      ${V2.examCidsActive(kid, m.e).length ? `<button class="btn ghost wide" data-v2="testa" data-exam="${esc(m.e.id)}">Testa mig</button>` : ''}</details>`;
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
      // RETURN: "Jag har justerat planen." bara när motorn verkligen har gjort det (återstart efter långt uppehåll) – granskning: annars bara hälsningen
      const adj = !!(V2.peekPlan(kid).plan || {}).restart;
      return `<div class="card row welcome" style="gap:12px"><div style="font-size:1.5rem" aria-hidden="true">👋</div><div class="grow"><div style="font-weight:800;font-family:var(--display)">Kul att du är tillbaka.</div>${adj ? '<div class="muted" style="font-size:.95rem">Jag har justerat planen.</div>' : ''}</div></div>`;
    }, 'welcome', '');
  },
  /* ---------- Under passet ---------- */
  ACT: { num: ['SKRIV TALET', '✍️'], sort: ['SORTERA', '🗂️'], match: ['PARA IHOP', '🔗'], order: ['ORDNA', '🔢'], tap: ['TRYCK PÅ ORDET', '👆'], build: ['BYGG ORDET', '🧱'], paper: ['RÄKNA PÅ PAPPER', '✏️'], exampaper: ['PROVLÄGE · PAPPER', '✏️'], bosspaper: ['BOSS · PAPPER', '👑'] },
  // Upplevelsens etikett för uppgiften. Explore: aktiviteten. Achieve/Grow: rytmen UPPTÄCK · GÖR · HITTA FELET · MINNS · PROVLÄGE · BOSS.
  chipFor(item) {
    const V = S.v2; if (!V.exp || !item || item.cat === 'learn') return null;
    if (item.paper && !V.exam && item.spec && EXP.EXTRA.has(item.spec.role)) return null;   /* 3.3 slutpasset: Ny chans/Rescue/Extra visar rollen – papperet står i kortet */
    if (item.paper) return V.exam ? EXP.ACT.exampaper : item.spec && item.spec.role === 'boss' ? EXP.ACT.bosspaper : V.exp === 'explore' ? EXP.ACT.paper : ['RÄKNA PÅ PAPPER', '✏️'];
    if (item.rhythm) return item.rhythm === 'spot' ? ['HITTA FELET', '🔍'] : ['BAKLÄNGES', '↩️'];
    if (V.exam || !item.spec) return null;
    const role = item.spec.role;
    if (['boss', 'revansch', 'remember', 'rescue', 'retry', 'easy'].includes(role) || item.spec.mode === 'challenge') return null;   /* 3.3 slutpasset: Ny chans/Extra syns alltid som rollen */   // rollens egen etikett (MINNS, REVANSCH, BOSSEN …)
    const ui = EXP.uiOf(item); if (ui === 'num' && V.exp !== 'explore') return null; if (EXP.ACT[ui]) return EXP.ACT[ui];
    return null;
  },
  // 3.3: vilken aktivitet och roll kortet har – bara för formspråket (CSS), aldrig för rättning eller plan
  modeOf(item) {
    if (!item) return { mode: 'none' };
    const ch = item.challenge; const mode = item.cat === 'learn' ? 'learn' : item.paper ? 'paper' : item.rhythm === 'spot' || ch === 'spot' ? 'spot' : item.rhythm === 'reverse' || ch === 'create' || ch === 'equation' ? 'reverse' : String(EXP.uiOf(item)).replace(/[^a-z:]/g, '').replace(':', '-');
    const s = item.spec || {}; const role = s.role === 'boss' ? 'boss' : s.mode === 'challenge' ? 'challenge' : ['revansch', 'remember', 'rescue', 'retry', 'warmup', 'intro', 'teach', 'readclose'].includes(s.role) ? s.role : '';
    return { mode, role };
  },
  EXTRA: new Set(['retry', 'rescue', 'easy']),
  isExtra(it) { return !!(it && it.spec && EXP.EXTRA.has(it.spec.role)); },
  // Hur många av passets planerade platser som är klara (omförsök, Rescue och LÄR-kort räknas inte)
  done() { let n = 0; for (let i = 0; i < S.i; i++) { const x = S.queue[i]; if (x && x._slotEnd && !EXP.isExtra(x)) n++; } return n; },
  uiOf(item) { if (!item) return 'none'; if (item.cat === 'word') return 'word:' + item.kind; if (item.cat === 'learn') return 'learn'; if (item.paper) return 'paper'; if (item.build) return 'build'; if (item.type === 'sort' || item.type === 'match' || item.type === 'order') return item.type; if (item.ui === 'tap') return 'tap'; if (item.type === 'choicetext' || item.choices) return 'choice'; return item.type === 'text' ? 'type' : item.type || 'type'; },
  // Hur många textval i rad (Explore: aldrig fler än två när kunskapen finns som aktivitet)
  // 3.1.2: Bossen (alla v3-lägen, även Achieve) får veta uppgiften precis före – så tar den helst ett annat faktum/en annan aktivitet
  vary(V, spec) { if (!V.exp) return null; const lastQ = S.queue.filter(x => x.cat !== 'learn').slice(-1)[0] || null; const prevOf = { boss: !!spec && spec.role === 'boss', prevKp: lastQ && lastQ.kp || null, prevFk: lastQ && lastQ.fk || null, prevUi: lastQ && lastQ.ui || null };
    if (V.exp === 'achieve') return spec && spec.role === 'boss' ? { choiceRun: 0, boost: 1, depthBoss: true, ...prevOf } : null; const q = S.queue.filter(x => x.cat !== 'learn'); let run = 0; for (let i = q.length - 1; i >= 0; i--) { const u = EXP.uiOf(q[i]); if (u === 'choice' || u === 'word:pick' || u === 'word:listen') run++; else break; } const last = q.length ? EXP.uiOf(q[q.length - 1]) : null; const pv = q.length ? q[q.length - 1] : null; return { boss: !!spec && spec.role === 'boss', prevKp: pv && pv.kp || null, prevFk: pv && pv.fk || null, prevUi: pv && pv.ui || null, choiceRun: V.exp === 'explore' ? run : Math.max(0, run - 1), actAfter: V.exp === 'explore' ? 1 : 2, last, boost: V.exp === 'explore' ? 4 : 1.5, stretch: V.exp === 'explore' && !!spec && spec.role === 'boss', depthBoss: V.exp === 'grow' && !!spec && spec.role === 'boss' }; },   // Explore-Bossen: gärna en aktivitet (Bossen får vara en nivå svårare)   // Grow: högst tre textval i rad
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
     Hitta felet och Baklänges använder Utmaningslagrets befintliga generatorer men registreras som VANLIGT bevis för momentet (form
     "hitta felet" m / "baklänges" v): det är riktig övning av momentet, och som Utmaning tog de bevis från passet (granskning). Hitta felet är
     flerval (k = 3, gissningsgrad räknas). Högst en av varje per pass, bara på moment som redan börjar sitta (stadium ≥ 2). */
  rhythmKind(V, spec, skill, c) {
    if (!V.exp || V.exp === 'explore' || V.exam || V.mode === 'revansch' || V.mode === 'readclose') return null;
    if (!skill || (skill.group || 'math') !== 'math' || typeof skill.gen !== 'function' || !c || c.st < 2) return null;
    // I FLOW får även en repetition av något som redan hämtats tidigare idag bli analys (ingen fördröjd hämtning går förlorad – den är gjord)
    const lastEv = (c.ev || []).slice(-1)[0]; const doneToday = !!lastEv && LE2.dayIdx(lastEv[0] * 1000) === LE2.dayIdx(LE.now()) && lastEv[0] * 1000 < V.start;   // granskning: senaste riktiga svaret (Utmaningar räknas inte)
    // Bossen är passets sträckuppgift: att analysera en lösning eller räkna baklänges är just en sådan (ingen hämtning ersätts)
    if (spec.mode === 'challenge' || !(['practice', 'focus', 'boss'].includes(spec.role) || (V.mode === 'flow' && spec.role === 'remember' && doneToday)) || spec.help === 'rescue' || spec.help === 'hint') return null;
    const done = new Set(S.queue.filter(x => x.rhythm).map(x => x.rhythm)); const last = S.queue.filter(x => x.cat !== 'learn').slice(-1)[0];
    if (!done.has('spot') && S.queue.some(x => x.paper) && last && !last.rhythm) return 'spot';   // efter ett pappersproblem i passet: analysera en annans lösning digitalt
    if (!done.has('reverse') && S.queue.filter(x => x.cat === 'math').length >= 2 && last && !last.paper && !last.rhythm) return 'reverse';   // baklänges: när passet är igång
    return null;
  },
  rhythmItem(kind, skill, lvl) {
    const want = kind === 'spot' ? ['spot'] : ['create', 'equation'];
    // spot: felet hamnar i A, B eller C och är av olika slag (granskning: det var alltid A). k väljer också Utmaningens sort (k % 5 = 0 → Hitta felet).
    for (const k of kind === 'spot' ? [5 * Math.floor(Math.random() * 6)] : /ekv/.test(skill.id) ? [3, 2] : [2]) { const q = CHG.make(skill, lvl, k); if (q && want.includes(q.challenge)) return q; }
    return null;
  },
  paperNote(q) { if (S.v2) { if (S.v2.paperFirst == null) S.v2.paperFirst = S.i; if (S.v2.paperFirst !== S.i) return `<div class="paper-note short" role="note"><span aria-hidden="true">✏️</span><div><b>Räkna på papper</b> – skriv bara svaret här.</div></div>`; }   // 3.3: hela förklaringen bara första gången i passet
    return `<div class="paper-note" role="note"><span aria-hidden="true">✏️</span><div><b>Räkna på papper.</b> Skriv uträkningen på ditt papper${S.v2 && S.v2.exam ? '' : ' – i lugn och ro'}. Skriv bara svaret här.</div></div>`; },
  paperFeedback(q, correct, raw) {
    // UX: alternativ ("Eller …"), kontroll och svar får inget eget stegnummer – numren stämmer med knapparna "Steg N"
    const ALT = /^\s*(<[^>]+>\s*)*(Eller|Kontroll|Svar)/i; const steps = (q.steps || []).map((s, i) => ALT.test(String(s)) ? `<li style="list-style:none;margin-left:-1em" class="muted">${safeHtml(s)}</li>` : `<li value="${i + 1}">${safeHtml(s)}</li>`).join('');
    if (correct) return `<div class="feedback ok"><span style="font-size:1.4rem">✅</span><div><div class="big">Ditt svar stämmer.</div><div class="sub">Svar: <b>${esc(answerDisplay(q))}</b>. Jämför gärna din uträkning med lösningen.</div></div></div><details class="steps"><summary><b>Visa lösningen steg för steg</b></summary><ol>${steps}</ol></details>`;
    const pick = (q.steps || []).length >= 2 ? `<div class="selfcheck" role="group" aria-label="I vilket steg skilde det sig?"><div style="font-weight:700">I vilket steg skilde det sig? <span class="muted" style="font-weight:400">(frivilligt)</span></div><div class="row row-wrap" style="gap:8px;margin-top:6px">${q.steps.map((st, i) => /^\s*(<[^>]+>\s*)*(Eller|Kontroll|Svar)/i.test(String(st)) ? '' : `<button class="btn ghost sc" data-sc="${i + 1}">Steg ${i + 1}</button>`).join('')}<button class="btn ghost sc" data-sc="0">Vet inte</button></div></div>` : '';
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
    if (q.type === 'sort') { S.sort = { sel: null, placed: {} }; return `<div class="sortbox"><div class="sort-pool" id="sortPool">${q.items.map((t, i) => `<button class="stile${q.itemAssets ? ' vtile' : ''}" data-sitem="${i}" aria-pressed="false">${q.itemAssets && typeof ASSETS !== 'undefined' ? ASSETS.slot(q.itemAssets[i], t) : ''}${esc(t)}</button>`).join('')}</div><div class="sort-bins">${q.bins.map((b, i) => `<div class="sbin" data-sbin="${i}"><button class="sbin-h" data-sbin="${i}" aria-label="Lägg i ${esc(b)}">${esc(b)}</button><div class="sbin-items" id="sbin${i}" role="list" aria-label="${esc(b)}"></div></div>`).join('')}</div><p class="muted tip sort-tip">Tryck på ett kort och sedan på rätt grupp. Fel grupp? Tryck på kortet igen.</p></div>`; }
    if (q.type === 'match') { const L = R.shuffle(q.pairs.map((x, i) => ({ i, t: x[0] }))); let Rr = R.shuffle(q.pairs.map((x, i) => ({ i, t: x[1] }))); if (S.v2 && S.v2.exp && Rr.length > 1 && Rr.every((x, k) => x.i === L[k].i)) Rr = [...Rr.slice(1), Rr[0]];   /* 3.3: aldrig färdigparat på samma rad (det vore gratis) – ingen extra slump */ S.match2 = { sel: null, done: new Set(), mistakes: 0 }; return `<div class="match-grid v3">${[['l', L], ['r', Rr]].map(([side, arr]) => `<div class="match-col">${arr.map(x => `<button class="mtile${side === 'l' && q.pairAssets ? ' vtile' : ''}" data-m2="${side}" data-mi="${x.i}">${side === 'l' && q.pairAssets && typeof ASSETS !== 'undefined' ? ASSETS.slot(q.pairAssets[x.i], x.t) : ''}${esc(x.t)}</button>`).join('')}</div>`).join('')}</div><p class="muted tip">Tryck på ett kort till vänster och sedan på det som hör ihop.</p>`; }
    return '';
  },
  // 3.3: när alla par är klara står varje par på samma rad (bara visning – rättningen är redan gjord per par)
  alignPairs() { const cols = document.querySelectorAll('.match-grid.v3 .match-col'); if (cols.length !== 2) return; [...cols[0].children].forEach(l => { const r = cols[1].querySelector(`[data-mi="${l.dataset.mi}"]`); if (r) cols[1].appendChild(r); }); cols[0].parentElement.classList.add('paired'); },
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
      if (it) { EXP.hear(q, it.textContent); if (it.classList.contains('placed')) { const pool = document.getElementById('sortPool'); delete X.placed[it.dataset.sitem]; it.classList.remove('placed'); delete it.dataset.bin; if (pool) pool.appendChild(it); pool && pool.classList.remove('empty'); const sb0 = document.getElementById('submit'); if (sb0) sb0.disabled = true; }   // ångra: tryck på ett placerat kort så går det tillbaka
        document.querySelectorAll('.stile.sel').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); }); X.sel = Number(it.dataset.sitem); it.classList.add('sel'); it.setAttribute('aria-pressed', 'true'); return true; }
      if (bin && X.sel != null) { const b = Number(bin.dataset.sbin); X.placed[X.sel] = b; const el = document.querySelector(`[data-sitem="${X.sel}"]`); if (el) { el.classList.remove('sel'); el.setAttribute('aria-pressed', 'false'); el.classList.add('placed'); el.dataset.bin = b; document.getElementById('sbin' + b).appendChild(el); } X.sel = null; beep('tick');
        const pool = document.getElementById('sortPool'); if (pool) pool.classList.toggle('empty', !pool.querySelector('.stile')); const sb = document.getElementById('submit'); if (sb) sb.disabled = Object.keys(X.placed).length !== q.items.length; return true; }
      if (bin) { toast('Tryck först på ett kort'); return true; }
    }
    if (q.type === 'match' && S.match2) {
      const mt = t.closest('[data-m2]'); if (!mt) return false; const M = S.match2; const side = mt.dataset.m2; const i = Number(mt.dataset.mi);
      EXP.hear(q, mt.textContent); if (!M.sel || M.sel.side === side) { document.querySelectorAll('.mtile.sel').forEach(x => x.classList.remove('sel')); M.sel = { side, i, el: mt }; mt.classList.add('sel'); return true; }
      if (M.sel.i === i) { mt.classList.add('done'); M.sel.el.classList.add('done'); M.sel.el.classList.remove('sel'); M.done.add(i); M.sel = null; beep('tick'); if (M.done.size === q.pairs.length) { if (S.v2 && S.v2.exp) EXP.alignPairs(); submitMath(); } return true; }
      M.mistakes++; beep('no'); mt.classList.add('no'); const a = M.sel.el; a.classList.add('no'); a.classList.remove('sel'); M.sel = null; setTimeout(() => { mt.classList.remove('no'); a.classList.remove('no'); }, 450); return true;
    }
    if (q.build && S.build) {
      const bt = t.closest('[data-btile]'); if (bt && !bt.classList.contains('used')) { bt.classList.add('used'); S.build.picked.push(Number(bt.dataset.btile)); EXP.renderBuild(); return true; }
      if (t.closest('#undoBuild')) { const last = S.build.picked.pop(); if (last !== undefined) document.querySelector(`[data-btile="${last}"]`)?.classList.remove('used'); EXP.renderBuild(); return true; }
    }
    if (t.closest('[data-sc]')) { EXP.selfCheck(t.closest('[data-sc]')); return true; }
    return false;
  },
  // Explore: ett tryck på ett kort läser upp det (Yngre, när uppläsning är tillåten för frågan) – ingen läsning krävs för att välja
  hear(q, text) { try { if (S.v2 && S.v2.exp === 'explore' && S.v2.C.pol.name === 'younger' && V2.canSpeak(q) && text) TTS.speak(String(text).trim(), 'sv'); } catch (e) { /* ingen röst */ } },
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
    if (q.type === 'match' && res) return `<div class="sub">${res.mistakes ? `Alla par klara – ${res.mistakes === 1 ? 'ett försök' : res.mistakes + ' försök'} blev fel på vägen.` : 'Inga fel på vägen.'}</div>`;
    return '';
  },
  /* ---------- KLAR (efter CORE och FLOW) ---------- */
  DELIGHT_CHIP: { REMEMBERED: 'Du kom ihåg', COMEBACK: 'Revansch tagen', MASTERY: 'Börjar sitta', CHALLENGE: 'Svårare variant', FOCUS: 'Fokus klart', CONSISTENCY: '3 plugg-dagar' },   // 3.3: korta chips på KLAR (samma händelser)
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
    const g = e === 'achieve' ? EXP.goalOf(kid, V.plan).now : null;
    const mission = V.mode === 'mission';   // provets egen träning (2.1.1) är inte dagens plan
    // Granskning: efter provträning, Revansch o.d. FÖRE dagens plan erbjuds dagens plan – inte FLOW (FLOW kommer bara efter CORE)
    const corePending = V.mode !== 'kor' && !flow && !EXP.coreDone(p) && V2.safe(() => V2.peekPlan(kid).plan.length > 0, 'corePending', false);   // 3.1: ingen Kör!-knapp som inte startar något
    const po = !!V.po;   // 3.4 fas D: övningsblock utan poäng
    const title = po ? 'ÖVNINGEN KLAR' : e === 'explore' ? 'ÄVENTYRET KLART!' : mission ? 'PROVTRÄNINGEN KLAR' : e === 'grow' ? (flow ? 'EXTRARUNDAN KLAR!' : 'RUNDAN KLAR!') : flow ? 'EXTRAPASSET KLART' : V.mode === 'kor' ? 'DAGENS PLAN KLAR' : 'PASSET KLART';
    const flowLabel = e === 'explore' ? 'ETT ÄVENTYR TILL' : e === 'grow' ? 'EN RUNDA TILL' : g && EXP.isExam(g.e) && EXP.mostly(EXP.examShare(kid, g, EXP.peekFlow(kid))) ? 'FORTSÄTT MOT PROVET' : 'FORTSÄTT';
    const kinds = []; for (const r of V.rewards) if (EXP.DELIGHT[r.k] && !kinds.includes(r.k)) kinds.push(r.k);
    const trail = e === 'explore' ? `<div class="trail done klar-path" role="img" aria-label="Det här gjorde du: ${S.queue.slice(0, S.i + 1).filter(x => x._slotEnd).length} saker">${S.queue.slice(0, S.i + 1).filter(x => x._slotEnd).map((x, n) => `<span class="dot ok${x.spec && x.spec.role === 'boss' ? ' crown' : ''}" style="--i:${n}" aria-hidden="true">${x.spec && x.spec.role === 'boss' ? '👑' : '⭐'}</span>`).join('')}</div>` : '';   /* 3.3 slutpasset: en hel stig av stjärnor – inga halvtonade steg */
    // UX: Explore-hemmet visade 👑 (Grow/Achieve: N kvar räknade Bossen) – blev passet kortare (motorns Rescue/uppskjutning) sägs det, i stället för att kronan bara försvinner
    const bossLater = V.plan.some(x => x.role === 'boss') && !S.queue.some(x => x.spec && x.spec.role === 'boss') ? `<div class="muted">${e === 'explore' ? '👑 ' : ''}Bossen väntar nästa gång.</div>` : '';
    // Slutverifieringen: motorns omförsök och Rescue ryms inom passets tak – då kan planerade uppgifter bli kvar. Det sägs rakt ut (de
    // kommer tillbaka i en senare plan; motorn har inte räknat dem som gjorda).
    const playedPlan = S.queue.slice(0, S.i + 1).filter(x => x._slotEnd && !EXP.isExtra(x) && x.spec && x.spec.role !== 'boss').length; const missed = Math.max(0, V.plan.filter(x => x.role !== 'boss').length - playedPlan);
    const savedLater = missed && !flow ? `<div class="muted">${missed === 1 ? 'En uppgift' : `${missed} uppgifter`} från planen sparas till nästa gång.</div>` : '';   // alla v3-lägen (slutverifieringen: räknaren räknar Bossen som planerad)
    const back = e === 'explore' ? [] : EXP.comeBack(kid, V);
    const gems = V.rewards.reduce((a, r) => a + r.gems, 0);
    const canMore = !corePending && EXP.canFlow(kid); const rested = EXP.flowsToday(p) >= EXP.FLOW_MAX || EXP.extraDone(p) >= EXP.FLOW_MAX;
    const moreHtml = !corePending && !canMore && rested ? EXP.moreBtns(kid, mission ? (EXP.goalOf(kid, null).all || []).find(x => x.e.id === (V.extra || {}).examId) || g || EXP.goalOf(kid, null).now : g || EXP.goalOf(kid, null).now) : '';
    const fb = V2.felbok(kid, V.C, LE.now()); const todo = fb.items.filter(x => x.state === 'todo').length;
    render(`${topbar('Klart', 'home')}
    <div class="stack" style="margin-top:6px">
      <section class="card pad-lg summary-hero stack klar klar-${e}" style="gap:10px" aria-label="${esc(title)}">${(() => {
        // 3.3: ett KLAR för alla tre upplevelser – märke, rubrik, EN mening, högst tre chips som bygger på verkligt läge
        const up = e === 'explore' ? 0 : [...V.stageUps].filter(cid => ((V.C.L.c[cid] || {}).st || 0) >= 2).length;
        const sh = e === 'achieve' && g && EXP.isExam(g.e) ? EXP.safe(() => EXP.examShare(kid, g, V.plan), 'klarShare', { n: 0 }) : { n: 0 };
        const bossWon = S.queue.slice(0, S.i + 1).some((x, i) => x.spec && x.spec.role === 'boss' && S.results[i] === true);
        const lead = po ? 'Bra övat! Extraövning ger inga poäng – den är bara för att lära.' : e === 'achieve' && !mission ? 'Appen håller koll på resten.' : e === 'explore' && flow ? 'Ett äventyr till – klart!' : up ? `${up === 1 ? 'Ett område' : `${up} områden`} blev starkare.` : V.mode === 'revansch' ? 'Revanschen är gjord.' : mission ? 'Provträningen är gjord.' : flow ? (e === 'grow' ? 'Extrarundan är gjord.' : 'Extrapasset är gjort.') : V.mode !== 'kor' ? 'Passet är gjort.' : e === 'explore' ? 'Du klarade dagens äventyr.' : e === 'grow' ? 'Du klarade dagens runda.' : 'Passet är gjort.';   // "dagens runda/äventyr" bara när det verkligen var dagens plan
        const chips = [];
        if (bossWon) chips.push(e === 'achieve' ? 'Bossuppgiften klar' : 'Bossen klarad');   /* 3.3 slutpasset: chips är text – samma form överallt */
        if (sh.n > 0) chips.push(`${sh.n} ${sh.n === 1 ? 'uppgift' : 'uppgifter'} inför ${EXP.noun(g.e)}`);
        if (up && e === 'achieve' && V.mode === 'kor') chips.push(`${up === 1 ? 'Ett område' : `${up} områden`} starkare`);
        for (const k of kinds) chips.push(EXP.DELIGHT_CHIP[k] || EXP.DELIGHT[k]);
        if (gems && e === 'grow') chips.push(`+${gems} 💎`);
        const mark = e === 'achieve' ? '<path class="tick" d="M15 25l6 6 12-13"/>' : '';
        // 3.3 slutpasset: Explore – följeslagaren gläds (ett hopp); Grow – slutsignalen; Achieve – lugn bock och planen som en hel rad
        const pet = e === 'explore' && p.pet && p.pet !== 'none' && typeof petEmoji === 'function' ? petEmoji(p) : '';
        const planN = V.plan.length; const planDone = Math.min(planN, S.queue.slice(0, S.i + 1).filter(x => x._slotEnd && !EXP.isExtra(x)).length);
        const planBar = e === 'achieve' && planN > 0 && !flow ? `<div class="klar-plan"><div class="progress v3" role="img" aria-label="${planDone} av ${planN} uppgifter gjorda">${Array.from({ length: planN }, (_, i) => `<i class="${i < planDone ? 'done' : ''}" style="--i:${i}"></i>`).join('')}</div><div class="kp-s">${planDone === planN ? `Alla ${planN} uppgifter gjorda` : `${planDone} av ${planN} uppgifter gjorda`}</div></div>` : '';
        return `<div class="klar-mark${pet ? ' has-pet' : ''}" aria-hidden="true"><svg viewBox="0 0 48 48"><circle class="ring" cx="24" cy="24" r="21"/>${mark}</svg>${e === 'achieve' ? '' : `<span class="km-e">${pet || (e === 'explore' ? '🗺️' : '🏁')}</span>`}${pet ? '<span class="km-spark">✨</span>' : ''}</div>
        ${e === 'grow' ? '<div class="klar-eyebrow">Slutsignal</div>' : ''}<div class="klar-title">${esc(title)}</div>
        <div class="klar-lead">${esc(lead)}</div>${trail}${planBar}${(!flow && bossLater) || savedLater ? `<div class="klar-note">${flow ? '' : bossLater}${savedLater}</div>` : ''}
        ${e === 'grow' ? (() => { const lv = levelOf(p.xp), a0 = 60 * (lv - 1) ** 2, a1 = 60 * lv ** 2; const pct = Math.max(0, Math.min(100, Math.round((p.xp - a0) / (a1 - a0) * 100))); return `<div class="klar-level"><div class="kl-t">Nivå ${lv}${typeof levelNameFor === 'function' ? ' · ' + esc(levelNameFor(kid, lv)) : ''}</div><div class="xpbar"><i style="width:${pct}%"></i></div><div class="kl-s">${a1 - p.xp} XP till nivå ${lv + 1}</div></div>`; })() : ''}
        ${chips.length ? `<div class="klar-chips">${chips.slice(0, 3).map(c => `<div>${esc(c)}</div>`).join('')}</div>` : ''}`; })()}
      </section>
      ${corePending ? `<button class="btn big wide btn-2l klar-up" data-v2="kor">Till dagens plan<span class="btn-sub"><span class="sep"> · </span>cirka ${EXP.mins(V2.peekPlan(kid).plan, kid)} min</span></button>` : canMore ? `<button class="btn big wide btn-2l" data-v2="flow">${esc(flowLabel)}<span class="btn-sub"><span class="sep"> · </span>cirka ${EXP.flowMins(kid)} min</span></button>` : `<div class="card muted" style="text-align:center">${rested ? 'Bra jobbat idag! Det du har övat sätter sig bäst om du vilar nu.' : 'Allt för idag är gjort.'}</div>${moreHtml || (rested || !EXP.peekFlow(kid).length ? EXP.enoughText(kid, g || EXP.goalOf(kid, null).now) : '')}`}
      ${e === 'grow' && todo && canMore ? `<button class="btn ghost wide" data-v2="revansch">Revansch i stället · ${todo} ${todo === 1 ? 'sak' : 'saker'}</button>` : ''}
      <button class="btn big wide ${canMore || corePending ? 'ghost' : ''}" data-go="home">${corePending ? 'Till startsidan' : 'Klar för idag'}</button>
      ${back.length ? `<div class="card stack klar-back" style="gap:4px"><div class="eyebrow">Appen tar fram det här igen</div>${back.map(b => `<div>${esc(b.name)} – ${b.when === 'idag' ? 'i ett senare pass' : esc(b.when)}.</div>`).join('')}</div>` : ''}
      ${extraCards}
    </div>`);
  },
  // Avklarade dagsuppdrag hämtas automatiskt på KLAR (samma belöning som knappen "Hämta" – utan att barnet måste göra något mer)
  autoClaim(kid, list, row) {
    if (!list.length) return ''; const p = prof(kid.id);
    for (const q of list) { const it = p.quests.items.find(x => x.id === q.id); if (!it || !it.done || it.claimed) continue; it.claimed = true; p.xp += it.reward.xp; p.gems += it.reward.gems; }
    if (p.quests.items.every(x => x.claimed) && p.claimedAll !== todayKey()) { p.claimedAll = todayKey(); p.gems += 15; }
    save(); return row ? row('✅', list.length === 1 ? 'Uppdrag klart' : `${list.length} uppdrag klara`, list.map(q => esc(q.text)).join(' · ')) : `<div class="card muted" style="font-size:.9rem">Uppdrag klart: ${list.map(q => esc(q.text)).join(' · ')}</div>`;
  },
  /* ---------- Testa mig: rapport per målområde (aldrig en prognos) ---------- */
  examReport(kid, V) {
    const e = LE.exams(kid, prof(kid.id)).find(x => x.id === V.extra.examId); if (!e) return '';
    const C = V.C; const per = EXP.goalAreas(kid, e, C) || V2.examStatus(kid, e, C, LE.now()).per;
    return `<div class="card stack" style="gap:6px"><div class="eyebrow">Läget per område efter testet</div>${per.map(x => `<div class="row" style="justify-content:space-between;gap:8px"><span>${esc(x.name)}</span><span class="pill ${V2.READY_CLS[x.ready]}" style="font-size:.75rem">${V2.READY_TXT[x.ready]}</span></div>`).join('')}<p class="muted" style="font-size:.85rem">Det här är ett övningstest. Det visar vad appen ska öva på med dig – inte vad du får på provet.</p></div>`;
  },
  // 3.3: områden att öva mer på efter Testa mig (samma lägen som rapporten – ingen procent, ingen prognos)
  examFocus(kid, V) { return EXP.safe(() => { const e = LE.exams(kid, prof(kid.id)).find(x => x.id === V.extra.examId); if (!e) return { title: '', more: [] }; const per = EXP.goalAreas(kid, e, V.C) || V2.examStatus(kid, e, V.C, LE.now()).per; return { title: e.title, more: per.filter(x => x.ready === 'Öva lite mer').map(x => x.name) }; }, 'examFocus', { title: '', more: [] }); },
  /* ---------- Föräldraläget ---------- */
  parentCard(kid) {
    const p = prof(kid.id); const cur = EXP.of(kid); const def = EXP.isDefault(kid); const sc = EXP.scList(kid);
    return `<div class="card stack" style="gap:8px"><div class="eyebrow">Upplevelse för ${esc(kid.name)}</div>
      <div class="muted" style="font-size:.9rem">Samma inlärningsmotor – bara presentationen skiljer. ${def ? `Standard för åldern: <b>${EXP.KINDS[cur].name}</b>.` : `Vald av dig: <b>${EXP.KINDS[cur].name}</b>.`}</div>
      <div class="seg" role="group" aria-label="Upplevelse" style="flex-wrap:wrap">${Object.entries(EXP.KINDS).map(([k, x]) => `<button class="${k === cur ? 'on' : ''}" aria-pressed="${k === cur}" data-v2="exp" data-val="${k}">${esc(x.name)}</button>`).join('')}</div>
      <div class="muted" style="font-size:.85rem">${esc(EXP.KINDS[cur].desc)}</div>
      ${def ? '' : '<button class="link" data-v2="exp" data-val="default" style="align-self:flex-start">Återställ till standard för åldern</button>'}
      <div class="eyebrow" style="margin-top:6px">Vad Kör! tränar</div>
      <div class="seg" role="group" aria-label="Vad Kör! tränar">${[['all', 'Allt'], ['exams', 'Bara prov och läxor']].map(([k, l]) => { const on = (p.settings.scope === 'exams' ? 'exams' : 'all') === k; return `<button class="${on ? 'on' : ''}" aria-pressed="${on}" data-v2="scope" data-val="${k}">${l}</button>`; }).join('')}</div>
      <div class="muted" style="font-size:.85rem">${p.settings.scope === 'exams' ? `Kör! och extrapassen tränar bara prov och läxor som är inlagda och ligger inom fyra veckor. Finns inget visar appen det, och Öva på egen hand finns kvar.` : 'Kör! tränar allt barnet har: prov och läxor väger tyngst när de närmar sig, och resten repeteras så att det sitter.'}</div>
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
