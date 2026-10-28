/* ========= Learning Engine v2 – barnets upplevelse (Fas 3C–3H, AV som standard) =========
   Från 2.0.0 är v2 PRODUKTEN: på för alla barn som standard. v1 är reserven: föräldern väljer v1 per barn i fliken "Motor v2"
   (p.settings.engine === 'v1'). Med v1 vald körs ingenting här – barnet får v1 exakt som i 1.2.0 (tests/test_v1_regression.js).
   - Smart Kör!: motorn (LE2.planSession) väljer, passköraren (LER) styr ordning, omförsök, Rescue Loop, LÄR och Bossen.
   - v1:s egna data (mastery, nivå, glosboxar, v1-Felboken, XP, uppdrag) uppdateras som förut → v2 kan stängas av när som helst (rollback).
   - Belöningar använder bara befintlig XP och ädelstenar. En markör per belöning (LE2.rewardOnce) → ingen dubbelbelöning efter synk.
   - Inga felräknare, inga syskonjämförelser, ingen AI-rättning. */
const V2 = {
  sandbox: null,
  lastReasons: {},   // föräldradiagnostik: senaste passets motorbeslut (i minnet, inte i lagringen)   // förälderns förhandsvisning: { kidId, snap } – inget sparas eller synkas medan den pågår
  // 2.1: en annan sorts uppgift syns med en liten etikett (samma gränssnitt) – bara för fördjupande former
  FORM_CHIP: { mistake: ['HITTA FELET', '🔍'], relationship: ['KOPPLA', '🔗'], cause: ['ORSAK OCH VERKAN', '💭'], application: ['ANVÄND DET', '🛠️'], explanation: ['FÖRKLARA', '💡'], multistep: ['FLERA STEG', '🧗'] },
  ROLE_CHIP: { intro: ['UPPTÄCK', '🔎'], warmup: ['UPPVÄRMNING', '☀️'], remember: ['KOMMER DU IHÅG?', '🧠'], focus: ['DAGENS FOKUS', '🎯'], revansch: ['REVANSCH!', '💪'], boss: ['BOSSEN', '👑'], rescue: ['Vi tar det tillsammans', '🤝'], easy: ['', ''], retry: ['NY CHANS', '🔁'], challenge: ['UTMANING', '🧩'], practice: ['', ''], teach: ['LÄR', '💡'], readclose: ['MINNS DU?', '🙈'], testa: ['', ''] },
  READY_TXT: { 'Bra koll': 'BRA KOLL', 'Öva lite mer': 'ÖVA LITE MER', 'För lite underlag': 'FÖR LITE UNDERLAG' },
  READY_CLS: { 'Bra koll': 'good', 'Öva lite mer': 'warn', 'För lite underlag': '' },
  // v2 bara om föräldern slagit på den – och aldrig på data från en okänd (senare) version: då körs v1 och le lämnas orört (rollback-skydd)
  // v2 om inte föräldern valt v1 – och aldrig på data från en okänd (senare) version: då körs v1 och le lämnas orört (rollback-skydd)
  engineOf(p) { return p && p.settings && p.settings.engine === 'v1' ? 'v1' : 'v2'; },
  on(kid) { if (!kid) return false; const p = prof(kid.id); if (!p || (p.le && p.le.v !== 2)) return false; if (V2.sandbox) return V2.sandbox.kidId === kid.id; return V2.engineOf(p) === 'v2'; },
  fail(where, e) { LE.errors.push({ where: 'v2:' + where, msg: String(e && e.message || e).slice(0, 120), t: Date.now() }); if (LE.errors.length > 20) LE.errors.shift(); },
  safe(fn, where, fb) { try { return fn(); } catch (e) { V2.fail(where, e); return fb; } },
  mins(n) { return Math.max(2, Math.round(n * 0.6)); },
  n(kid, C) { const p = prof(kid.id); const pol = C.pol; return p.settings.focus ? Math.max(3, Math.min(pol.n, p.settings.sprint || pol.n)) : pol.n; },
  v2recs(p) { return ((p.le && p.le.shadow) || []).filter(r => r.e === 2); },
  doneToday(p) { const d0 = LE2.dayIdx(LE.now()); return V2.v2recs(p).some(r => r.done && r.m !== 'exam' && r.m !== 'mission' && LE2.dayIdx(r.t * 1000) === d0); },   // provträning är inte dagens pass
  missionToday(p) { const d0 = LE2.dayIdx(LE.now()); return V2.v2recs(p).some(r => r.m === 'mission' && LE2.dayIdx(r.t * 1000) === d0); },
  weekDays(p) { const wk = weekKey(); return Object.entries(p.days || {}).filter(([k, d]) => k >= wk && d.n > 0).length; },
  lastAt(p) { const recs = (p.le && p.le.shadow) || []; return recs.length ? recs[recs.length - 1].t * 1000 : (p.lastDay ? new Date(p.lastDay + 'T12:00:00').getTime() : null); },
  skillOf(kid, cid) { if (cid && cid.startsWith('k:')) { const e = PACKS.info(cid); return e ? PACKS.skillFor(kid, e.kp.skill) : null; } return [...kid.skills, ...(kid.v2skills || [])].find(s => LECAT.skillCid(s.id) === cid); },
  skillName(kid, skillId) { const s = PACKS.skillFor(kid, skillId); return s ? (s.short || s.name) : skillId; },
  deckOf(p, cid) { return allDecks(p).find(d => LECAT.deckCid(d.id) === cid); },
  // 3.3: kortnamn som bara är en symbol (t.ex. "x²") visas med ord i v2-vyerna; v1 och lagringen är orörda
  READABLE: { 'x²': 'Enkla andragradsekvationer' },
  readable(s) { return V2.READABLE[s] || s; },
  cname(kid, C, cid) { return V2.readable((C.cat[cid] || {}).name || cid); },
  /* ---------- Startsidan ---------- */
  // 3.0.1: samma klocka som KÖR (V2.start: LE.sessClock) – annars kunde något som blev aktuellt inom samma minut synas på hemmet men inte i passet
  peekPlan(kid) { const C = LE.state(kid); const now = LE.sessClock(C); const { plan } = LE.plan(kid, V2.n(kid, C), now); return { plan, C, now }; },
  korBtn(kid) {
    return V2.safe(() => {
      { const sc = V2.scopeCard(kid); if (sc) return sc; }
      const p = prof(kid.id); if (!LE.canStart(kid, p)) return `<button class="go-btn" data-v2="kor"><div><div class="t">${LBL(kid).go}</div><div class="s">Hämtar det senaste …</div></div><div class="arrow">${ICON.arrow}</div></button>`;
      const { plan } = V2.peekPlan(kid);
      if (plan.light && V2.doneToday(p)) return `<div class="card pad-lg stack" style="gap:6px;text-align:center"><div style="font-size:1.6rem">✅</div><div style="font-weight:800;font-family:var(--display);font-size:1.15rem">Bra jobbat. Du är klar för idag.</div><button class="link" data-v2="extra" style="align-self:center">Öva extra</button></div>`;
      const n = plan.length; const mi = V2.missionInfo(kid); const m = mi && mi.m;
      // 2.2 Study Mission: samma Smart Kör!-pass – rubriken visar uppdraget (provet närmast) och dagens tid. Ingen egen schemaläggning.
      // Hotfix 2.1.1: rubriken får bara nämna provet när passet faktiskt innehåller provets områden – och säger hur stor del
      // ("3 av 5 inför provet"). Annars den vanliga Kör!-rubriken; provträningen startas uttryckligen på provkortet.
      const k = m ? V2.missionShare(plan, mi.cids) : null;
      if (m && k.n > 0) return `<button class="go-btn mission" data-v2="kor"><div><div class="s" style="font-weight:800;letter-spacing:.06em">${esc(m.e.title.toUpperCase())} · ${esc(fmtDate(m.e.date).toUpperCase())}</div><div class="t">IDAG ${V2.mins(n)} minuter</div><div class="s">${k.n === k.of ? 'Allt inför provet' : `${k.n} av ${k.of} uppgifter inför provet`} · ${esc(LBL(kid).go.toUpperCase())}</div></div><div class="arrow">${ICON.arrow}</div></button>`;
      return `<button class="go-btn" data-v2="kor"><div><div class="t">${LBL(kid).go}</div><div class="s">${n} uppgifter · cirka ${V2.mins(n)} minuter</div></div><div class="arrow">${ICON.arrow}</div></button>`;
    }, 'korBtn', `<button class="go-btn" data-v2="kor"><div><div class="t">${LBL(kid).go}</div></div><div class="arrow">${ICON.arrow}</div></button>`);
  },
  /* Hotfix 2.1.1: uppdragets prov och de av provets koncept som finns i barnets katalog (tomt = provet saknar kopplingar) */
  missionInfo(kid) { const m = V2.mission(kid); if (!m) return null; return { m, cids: V2.examCidsActive(kid, m.e) }; },
  examCidsActive(kid, e) { const C = LE.state(kid); const cat = LE.activeCat(C, prof(kid.id)); return LE.examCids(C, e).filter(cid => cat[cid] && cat[cid].active !== false).concat((e.deckIds || []).map(LECAT.deckCid).filter(cid => cat[cid])); },
  // Hur många av passets uppgifter (utom Bossen) som hör till provet
  // Provträningen följer dygnets gräns för nytt: bara det som är kvar av policyns maxNew efter dagens tidigare pass
  newToday(C, now) { const d = LE2.dayIdx(now); return Object.entries(C.L.c).filter(([id, c]) => c.fs && LE2.dayIdx(c.fs * 1000) === d && C.cat[id] && C.cat[id].kind !== 'deck').length; },
  // Dygnets gräns för nytt: policyns gräns – eller motorns egen lägre gräns för dagen (t.ex. provveckan), sparad av dygnets första pass (rec.mx)
  newCapToday(C, now, p) { const d = LE2.dayIdx(now); let cap = C.pol.maxNew; if (p) for (const r of V2.v2recs(p)) if (typeof r.mx === 'number' && LE2.dayIdx(r.t * 1000) === d) cap = Math.min(cap, r.mx); return Math.max(0, cap - V2.newToday(C, now)); },
  missionShare(plan, cids) { const set = new Set(cids); const slots = plan.filter(s => s.role !== 'boss'); return { n: slots.filter(s => set.has(s.cid)).length, of: slots.length }; },
  /* 2.2: uppdraget = närmaste prov/läxa/glosförhör med datum inom MISSION_DAYS (familjens skoluppgifter eller förälderns prov) */
  MISSION_DAYS: 28,
  // 3.1: "Bara prov och läxor" – förälderns val per barn (settings.scope = 'exams' | 'all', synkas på senaste ändring)
  scopeOn(p) { return !!(p && p.settings && p.settings.scope === 'exams' && V2.engineOf(p) === 'v2'); },
  // Hemmet när "Bara prov och läxor" inte har något att öva: ett ärligt kort i stället för en knapp som startar något annat.
  scopeCard(kid) {
    const p = prof(kid.id); if (!V2.scopeOn(p) || (typeof EXP !== 'undefined' && EXP.on(kid) && EXP.coreDone(p))) return '';
    const pl = V2.peekPlan(kid).plan; if (!pl.scopeEmpty) return '';
    // Proven/läxorna inom horisonten: de med inlagda områden (det som tränas) och de utan (säg det ärligt, inte "inget prov")
    const win = LE.exams(kid, p).map(e => ({ e, d: daysUntil(e.date) })).filter(x => x.d >= 0 && x.d <= V2.MISSION_DAYS).sort((a, b) => a.d - b.d);
    const mapped = win.filter(x => V2.examCidsActive(kid, x.e).length); const unm = win.filter(x => !V2.examCidsActive(kid, x.e).length);
    const T = (e) => String((e && e.title) || 'provet'); const kindOf = (e) => (typeof EXP !== 'undefined' && EXP.isExam(e) ? 'Provets' : 'Läxans');
    const g = mapped[0] || null;
    const head = pl.scopeEmpty === 'idle' ? 'INGET ATT ÖVA IDAG' : unm.length ? `${esc(T(unm[0].e).toUpperCase())} · INTE INLAGT ÄNNU` : 'INGA PROV ELLER LÄXOR JUST NU';
    const txt = pl.scopeEmpty === 'idle' ? `Allt inför ${esc(T(g && g.e))} är övat för idag. Kom tillbaka imorgon.`
      : unm.length ? `${kindOf(unm[0].e)} områden är inte inlagda i appen ännu. När de läggs in börjar Kör! med dem.`
      : LE.exams(kid, p).some(e => { const d = daysUntil(e.date); return d > V2.MISSION_DAYS && d <= 60 && V2.examCidsActive(kid, e).length; }) ? 'Kör! börjar öva inför ett prov eller en läxa fyra veckor före. Vill du börja redan nu: tryck Kör på raden under Kommande prov och läxor.'   // 3.6: samma besked som raderna i Kommande
      : 'Kör! tränar bara inlagda prov och läxor. När något läggs in börjar du här.';
    const more = pl.scopeEmpty === 'idle' && unm.length ? `<div class="muted" style="font-size:.9rem">${unm.map(x => esc(T(x.e))).join(', ')}: områdena är inte inlagda i appen ännu.</div>` : '';
    return `<section class="card pad-lg mission stack" aria-label="${esc(head)}"><div class="eyebrow">${head}</div><div style="font-size:1rem">${txt}</div>${more}${g ? `<button class="btn ghost wide" data-v2="testa" data-exam="${esc(g.e.id)}">Testa mig</button>` : ''}</section>`;
  },
  // Felboken för barnet: med "Bara prov och läxor" bara det som hör till proven/läxorna (samma begränsning som Kör!) – inga gamla
  // glosfel eller annat i Revansch. Föräldrans vyer visar allt.
  felbok(kid, C, now) { const fb = LE2.felbokChild(C.L, C.pol, now); const sc = V2.scopeCids(kid, prof(kid.id)); if (!sc) return fb; const set = new Set(sc); return { ...fb, items: fb.items.filter(x => set.has(x.cid)), wins: (fb.wins || []).filter(c => set.has(typeof c === 'string' ? c : c && c.cid)) }; },
  scopeCids(kid, p) { if (!V2.scopeOn(p)) return null; const out = new Set(); for (const e of LE.exams(kid, p)) { const d = daysUntil(e.date); if (!(d >= 0 && d <= V2.MISSION_DAYS)) continue; for (const c of V2.examCidsActive(kid, e)) out.add(c); } return [...out]; },
  mission(kid) {
    const p = prof(kid.id); const list = LE.exams(kid, p).map(e => ({ e, d: daysUntil(e.date) })).filter(x => x.d >= 0 && x.d <= V2.MISSION_DAYS);
    list.sort((a, b) => a.d - b.d || (b.e.priority === 'high') - (a.e.priority === 'high') || (a.e.id < b.e.id ? -1 : 1)); return list[0] || null;
  },
  // Återkomst efter uppehåll: ingen skuld, inga missade dagar – bara en lugn start och (med ett uppdrag) det viktigaste idag
  welcome(kid) {
    return V2.safe(() => {
      const p = prof(kid.id); const last = V2.lastAt(p); if (!last || (LE.now() - last) / LE2.DAY < LE2.CFG.session.absentWarmDays || V2.doneToday(p)) return '';
      const m = V2.mission(kid); let top = '';
      if (m) { const C = LE.state(kid); const inExam = new Set(LE.examCids(C, m.e)); const { plan } = V2.peekPlan(kid); const names = [...new Set(plan.filter(x => inExam.has(x.cid)).map(x => { const d = C.cat[x.cid] || {}; return d.kind === 'kp' ? V2.skillName(kid, d.ref) : d.kind === 'deck' ? d.name : (V2.skillOf(kid, x.cid) || {}).short || d.name; }).filter(Boolean))].slice(0, 2); if (names.length) top = `<div style="font-size:.9rem;margin-top:4px"><b>Det här är viktigast idag:</b> ${names.map(esc).join(' och ')}.</div>`; }
      return `<div class="card row" style="gap:12px;border:2px solid var(--acc)"><div style="font-size:1.6rem">👋</div><div class="grow"><div style="font-weight:800;font-family:var(--display)">Välkommen tillbaka.</div><div class="muted" style="font-size:.9rem">Vi börjar lugnt med sådant du redan kan.</div>${top}</div></div>`;
    }, 'welcome', '');
  },
  weekPill(p) { const n = V2.weekDays(p); if (!n) return ''; return `<span class="pill ${n >= 3 ? 'good' : ''}">Pluggat ${n} ${n === 1 ? 'dag' : 'dagar'} den här veckan</span>`; },
  felbokCard(kid) {
    return V2.safe(() => {
      const p = prof(kid.id); if (!p.le || !LE.canStart(kid, p)) return '';
      const C = LE.state(kid); const fb = V2.felbok(kid, C, LE.now()); const todo = fb.items.filter(x => x.state === 'todo').length;
      if (!fb.items.length && !fb.wins.length) return '';
      const sub = fb.items.length ? `${todo ? `${todo} att ta revansch på` : 'Rättat idag – kommer tillbaka imorgon'}${fb.more ? ' · fler väntar' : ''}` : `Revansch klar på ${fb.wins.length} ${fb.wins.length === 1 ? 'sak' : 'saker'} 🎉`;
      return `<button class="card tap row" data-v2="felbok" style="gap:12px"><div class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--acc-soft);display:grid;place-items:center;font-size:1.3rem">📕</div><div class="grow"><div style="font-weight:800;font-family:var(--display)">Felboken</div><div class="muted" style="font-size:.9rem">${sub}</div></div><span class="chev">›</span></button>`;
    }, 'felbokCard', '');
  },
  deckReady(p, d) { if (!d) return 'För lite underlag'; const pr = deckProgress(p, d); return pr.pct >= 80 ? 'Bra koll' : pr.learned || d.words.some(w => p.words[w.id]) ? 'Öva lite mer' : 'För lite underlag'; },
  examStatus(kid, e, C, now) {
    const p = prof(kid.id); const ex = { at: new Date(e.date + 'T08:00:00').getTime(), concepts: LE.examCids(C, e) };
    const s = LE2.examStatus(C.L, C.cat, ex, now, C.pol);
    // 2.1: kunskapspunkter visas samlade per moment (barnet ser "Syror", inte tio punkter)
    const groups = new Map(); for (const x of s.per) { const d = C.cat[x.cid] || {}; const key = d.kind === 'kp' ? 's:' + d.ref : x.cid; const g = groups.get(key) || { name: d.kind === 'kp' ? V2.skillName(kid, d.ref) : V2.cname(kid, C, x.cid), r: [] }; g.r.push(x.ready); groups.set(key, g); }
    const agg = (r) => r.every(v => v === 'Bra koll') ? 'Bra koll' : r.every(v => v === 'För lite underlag') ? 'För lite underlag' : 'Öva lite mer';
    const per = [...[...groups.values()].map(g => ({ name: g.name, ready: agg(g.r) })), ...(e.deckIds || []).map(id => deckById(p, id)).filter(Boolean).map(d => ({ name: d.name, ready: V2.deckReady(p, d) }))];
    return { per, ready: per.length > 0 && per.every(x => x.ready === 'Bra koll') };
  },
  examCards(kid) {
    return V2.safe(() => {
      const p = prof(kid.id); if (!p.le || !LE.canStart(kid, p)) return '';
      const C = LE.state(kid); const now = LE.now();
      return LE.exams(kid, p).filter(e => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date)).map(e => {
        const days = daysUntil(e.date); const st = V2.examStatus(kid, e, C, now); const shown = st.per.slice(0, 6);
        // Hotfix 2.1.1: knappen startar provets egen träning (bara provets koncept) – och finns bara när provet har kopplade områden
        const cids = V2.examCidsActive(kid, e); const mp = cids.length ? V2.safe(() => V2.plan(kid, 'mission', C, now, null, { examId: e.id }), 'missionPeek', []) : [];
        const msg = V2.scopeOn(prof(kid.id)) && !V2.peekPlan(kid).plan.length ? 'Inget att öva inför provet idag – kom tillbaka imorgon.' : st.ready ? 'Bra koll på det som övats. Kör! fortsätter repetera – och vila gärna dagen före.' : days <= 1 ? 'Lugnt och kort idag.' : 'Kör! väljer det som gör mest nytta inför provet.';   // v3 (ärlig intelligens): inga påståenden som motorn inte kan backa upp
        return `<div class="card pad-lg exam stack" style="gap:12px">
        <div class="row"><div class="grow"><div class="eyebrow">${esc(e.title)} · ${fmtDate(e.date)}</div><div class="days">${days > 0 ? days : 'Idag'}</div><div style="opacity:.85">${days > 1 ? 'dagar kvar' : days === 1 ? 'dag kvar' : 'Lycka till!'}</div></div></div>
        ${st.per.length && st.per.every(x => x.ready === 'För lite underlag') ? `<div style="font-size:.95rem;opacity:.9">${st.per.length} områden på provet. Kör några pass så ser du här vad som sitter.</div>` : `<div class="stack" style="gap:6px">${shown.map(x => `<div class="row" style="justify-content:space-between;gap:8px"><span style="font-weight:700">${esc(x.name)}</span><span class="pill ${V2.READY_CLS[x.ready]}" style="font-size:.75rem">${V2.READY_TXT[x.ready]}</span></div>`).join('')}${st.per.length > shown.length ? `<div style="opacity:.8;font-size:.85rem">+ ${st.per.length - shown.length} till</div>` : ''}</div>`}
        <div style="font-size:.9rem;opacity:.9">${msg}</div>
        ${cids.length && !mp.length ? `<div style="font-size:.9rem;opacity:.9">Just nu finns inget att öva just för provet – inget är förfallet och inget nytt tas in idag.${V2.scopeOn(prof(kid.id)) ? '' : ' Kör! fortsätter med det viktigaste.'}</div><div class="row"><button class="btn ghost grow" data-v2="testa" data-exam="${esc(e.id)}">Testa mig</button></div>` : ''}
        ${cids.length && mp.length ? `<div class="row"><button class="btn grow" data-v2="mission" data-exam="${esc(e.id)}">Öva inför provet · cirka ${V2.mins(Math.max(1, mp.length))} minuter</button><button class="btn ghost" data-v2="testa" data-exam="${esc(e.id)}">Testa mig</button></div>`
          : `<div style="font-size:.9rem;opacity:.9">Provets områden är inte inlagda i appen ännu, så det finns inget att öva just för det här provet. Be en vuxen lägga in vad provet handlar om.</div>`}
      </div>`; }).join('');
    }, 'examCards', '');
  },
  /* ---------- Felboken 2.0 ---------- */
  felbokView(kid) {
    const p = prof(kid.id); const C = LE.state(kid); const now = LE.now(); const fb = V2.felbok(kid, C, now);
    const todo = fb.items.filter(x => x.state === 'todo');
    render(`${topbar('Felboken', 'home')}
    <div class="stack" style="margin-top:6px">
      <div class="card stack" style="gap:6px"><div class="eyebrow">Det här tar vi revansch på</div><p class="muted" style="font-size:.9rem">Fel är bra – det är så hjärnan lär sig. Du får nya uppgifter om samma sak.</p>
        ${fb.items.length ? `<div class="breakdown">${fb.items.map(x => `<div class="r"><div><div style="font-weight:700">${esc(V2.cname(kid, C, x.cid))}</div><div class="muted" style="font-size:.85rem">${x.state === 'corrected' ? 'Rättat idag – kommer tillbaka imorgon för att sätta sig' : 'Redo för revansch'}</div></div><span>${x.state === 'corrected' ? '⏳' : '💪'}</span></div>`).join('')}</div>${fb.more ? '<div class="muted" style="font-size:.9rem">Fler väntar – de kommer när de här sitter.</div>' : ''}` : '<p>Inget att ta revansch på just nu. 🎉</p>'}
      </div>
      ${fb.wins.length ? `<div class="card stack" style="gap:6px"><div class="eyebrow">Revansch klar</div>${fb.wins.slice(0, 5).map(cid => `<div class="row" style="gap:8px"><span>✅</span><b>${esc(V2.cname(kid, C, cid))}</b></div>`).join('')}</div>` : ''}
      ${todo.length ? `<button class="btn big wide" data-v2="revansch">Revansch! · ${todo.length} ${todo.length === 1 ? 'sak' : 'saker'}</button>` : ''}
      <button class="btn ghost wide" data-go="home">Till startsidan</button>
    </div>`);
  },
  /* ---------- Pass ---------- */
  plan(kid, mode, C, now, id, extra = {}) {
    const p = prof(kid.id); const pol = C.pol; const cat = LE.activeCat(C, p);
    if (mode === 'revansch') { const fb = V2.felbok(kid, C, now); const plan = fb.items.filter(x => x.state === 'todo').map(x => ({ cid: x.cid, role: 'revansch', why: LE2.WHY_TEXT.fb })); plan.maxItems = pol.maxItems; return plan; }
    if (mode === 'exam') {
      const e = LE.exams(kid, p).find(x => x.id === extra.examId); if (!e) return [];
      // 2.1: provets kunskapspunkter – de svagaste först, sedan roterande per dygn så att olika punkter prövas från gång till gång
      const day = LE2.dayIdx(now); const cids = LE.examCids(C, e).filter(cid => cat[cid]).sort((a, b) => ((C.L.c[a] || {}).st || 0) - ((C.L.c[b] || {}).st || 0) || (LE2.hash(a + day) < LE2.hash(b + day) ? -1 : 1));
      const per = cids.length <= 4 ? 2 : 1; const plan = [];
      for (let r = 0; r < per; r++) for (const cid of cids) plan.push({ cid, role: 'testa', why: 'Testa mig' });
      for (const id2 of (e.deckIds || [])) { const d = deckById(p, id2); if (d && !d.noSpell && cat[LECAT.deckCid(id2)]) for (let r = 0; r < Math.min(4, d.words.length); r++) plan.push({ cid: LECAT.deckCid(id2), role: 'testa', why: 'Testa mig' }); }   // granskning M3: ett glosförhör = flera ord
      const out = plan.slice(0, 12); out.maxItems = out.length; return out;
    }
    if (mode === 'flow' || mode === 'more') return EXP.flowPlan(kid, C, now, id);   // 3.4: Öva mer = samma plan som FLOW (dygnets gräns för nytt), utan poäng   // Experience v3: frivilligt extrablock – samma motor, kortare, dygnets gräns för nytt
    // Hotfix 2.1.1: "Öva inför provet" – samma motor och samma regler (förfallet, nytt inom dygnets gräns, Revansch), men bara provets koncept
    if (mode === 'mission') { const e = LE.exams(kid, p).find(x => x.id === extra.examId); if (!e) return []; const cids = V2.examCidsActive(kid, e); if (!cids.length) return []; const plan0 = LE.plan(kid, V2.n(kid, C), now, id, { only: cids, newCap: V2.newCapToday(C, now, EXP.on(kid) ? p : null) }).plan; const set = new Set(cids);
      // Granskning: bara provets koncept (även Bossen), och inget pass alls när inget av provet går att öva just nu (t.ex. kvällen före provet
      // med opåbörjade områden) – då visas en ärlig text i stället för en knapp som startar något annat
      // 3.6 rättelse (dygnets gräns för nytt): motorn kan planera ett aldrig sett provkoncept som "fokus" (provet närmar sig) trots att
      // dygnets gräns för nytt är nådd. Provträningen tar därför in högst så många nya koncept som gränsen tillåter – resten väntar till imorgon.
      const capN = V2.newCapToday(C, now, EXP.on(kid) ? p : null); const fresh = new Set();
      const plan = plan0.filter(s => set.has(s.cid)).filter(s => { const c = C.L.c[s.cid]; if ((C.cat[s.cid] || {}).kind === 'deck' || (c && (c.fs || c.n > 0))) return true;   /* sett = som V2.newToday och motorn (n > 0; v1-migrerade har inget fs); glosdäck räknas inte in i gränsen */ if (fresh.has(s.cid)) return true; if (fresh.size < capN) { fresh.add(s.cid); return true; } return false; });
      if (!plan.some(s => s.role !== 'boss')) return [];
      Object.assign(plan, { light: plan0.light, restart: plan0.restart, maxItems: plan0.maxItems, maxNew: plan0.maxNew, examDays: plan0.examDays, only: set, examId: e.id }); return plan; }
    if (mode === 'readclose') { const cids = LE.cidsOfSkill(C, extra.skillId); if (!cids.length) return []; const start = Math.floor(Math.random() * cids.length); const plan = [0, 1, 2].map(i => ({ cid: cids[(start + i) % cids.length], role: 'readclose', why: 'läst, stängt – minns du?' })); plan.maxItems = 3; return plan; }
    // v3 (granskning M2) och 2.1.1: ett nytt Kör! efter dagens CORE eller efter provträning samma dag får bara det som är kvar av dygnets gräns för nytt
    const later = (EXP.on(kid) && EXP.coreDone(p)) || V2.missionToday(p);
    return LE.plan(kid, V2.n(kid, C), now, id, later ? { newCap: V2.newCapToday(C, now, EXP.on(kid) ? p : null) } : {}).plan;
  },
  start(kid, mode = 'kor', extra = {}) {
    const p = prof(kid.id);
    // Bara prov och läxor: inget allmänt v1-pass i stället (varken före första synken eller vid ett fel i v2)
    if (!LE.canStart(kid, p)) { if (mode === 'kor' && !V2.scopeOn(p)) { S = null; return startSession(kid, recommendSprint(kid).opts); } toast('Hämtar det senaste från molnet – försök igen om en stund'); return; }   // barnet blockeras aldrig: v1-pass tills första synken är klar
    const C = LE.state(kid); const now = LE.sessClock(C); const { id: id0 } = LE.newSessId(p); const id = mode === 'flow' || mode === 'more' ? id0 + 'f' : mode === 'mission' ? id0 + 'm' : id0;   // FLOW och provträning märks i id:t (motorn räknar dem inte i svält-skyddet)
    const plan = V2.plan(kid, mode, C, now, id, extra);
    if (!plan.length) { toast(mode === 'revansch' ? 'Inget att ta revansch på just nu' : 'Inget att öva just nu'); return go('home'); }
    const exam = mode === 'exam';
    const cat0 = LE.activeCat(C, p); const cat = plan.only ? Object.fromEntries(Object.entries(cat0).filter(([cid]) => plan.only.has(cid))) : cat0;   // provträning: lätta uppgifter och Bossen bara ur provet
    const R = LER.create(C.L, cat, plan, C.pol, { sessId: id, mode: exam ? 'exam' : 'practice', maxItems: plan.maxItems });
    const rec = { id, t: Math.round(now / 1000), src: 'v2', e: 2, m: mode, mode: 'v2', v1: [], v2: plan.map(s => [s.cid, LE.ROLE[s.role] || '?', LE.whyKey(s)]), light: plan.light ? 1 : 0, rst: plan.restart ? 1 : 0, pol: C.pn, a: [], w: [0, 0], done: 0 };
    const po = typeof EXP !== 'undefined' && EXP.practiceOnly(kid, mode); if (po) rec.po = 1;   // 3.4 fas D: övning utan belöning (äldre versioner ignorerar fältet)
    if (typeof plan.maxNew === 'number' && V2.newToday(C, now) === 0) rec.mx = plan.maxNew;   // dygnets första pass: motorns egen gräns för nytt idag (FLOW/provträning håller den)
    p.le.shadow = [...(p.le.shadow || []), rec].slice(-LE2.SHADOW_MAX);
    S = { kid, mode: 'v2', opts: { v2: mode, ...extra }, queue: [], i: 0, results: [], xp: 0, usedHelp: false, retried: false, startedAt: Date.now(), streak: 0, revealed: false, answered: false, examId: extra.examId, deadline: null, chain: null,
      v2: { R, C, id, mode, exam, start: now, k: 0, plan, planN: plan.length, light: !!plan.light, restart: !!plan.restart, rewards: [], answers: [], seen: new Set(), stageUps: new Set(), fbBefore: LE2.felbokVisible(C.L, now).length, extra, exp: EXP.on(kid) ? EXP.of(kid) : null, calm: !!plan.restart, po } };
    save();
    state.screen = 'practice';
    if (!V2.advance()) return V2.finish();
    VIEWS.practice(); beep('start');
  },
  // Gör om nästa spec från passköraren till riktiga uppgifter i S.queue. false = passet är slut.
  advance() {
    const V = S.v2;
    for (let guard = 0; guard < 30; guard++) {
      if (S.i < S.queue.length) return true;
      const spec = V2.safe(() => LER.peek(V.R, V.C.L), 'peek', null); if (!spec) return false;
      const items = V2.safe(() => V2.materialize(spec), 'materialize', []);
      if (!items.length) { V.R.i++; continue; }   // inget innehåll för konceptet just nu → hoppa över utan att registrera något
      S.queue.push(...items);
    }
    return false;
  },
  pickItem(kid, skill, lvl, avoid, gen) {
    let q = null;
    let fresh = false; for (let j = 0; j < 20; j++) { q = gen(); if (!avoid.has(LECAT.itemId(q))) { fresh = true; break; } }   // små faktabanker: fler försök innan en tidigare uppgift används igen
    if (!fresh && q) q = { ...q, onlyVariant: true };   // granskning L7: banken har inget annat – Felboken får verifiera med samma fråga efter några dygn
    return q;
  },
  materialize(spec) {
    const V = S.v2; const kid = S.kid; const p = prof(kid.id); const L = V.C.L; const pol = V.C.pol; const c = L.c[spec.cid];
    if (spec.kind === 'deck') {
      const d = V2.deckOf(p, spec.cid); if (!d || !d.words.length) return [];
      const now = Date.now(); const byDue = d.words.filter(w => p.words[w.id] && p.words[w.id].due <= now && !V.seen.has(w.id)).sort((a, b) => p.words[a.id].due - p.words[b.id].due);
      const fresh = d.words.filter(w => !p.words[w.id] && !V.seen.has(w.id)); const known = d.words.filter(w => p.words[w.id] && !V.seen.has(w.id));
      const w = V.exam ? R.pick(d.words) : byDue[0] || fresh[0] || (known.length ? R.pick(known) : R.pick(d.words)); V.seen.add(w.id);
      const isNewWord = !p.words[w.id];   // granskning M7: kontrollera FÖRE wordState (som skapar posten)
      const box = isNewWord ? 0 : wordState(p, w.id).box; const kind = V.exam ? 'type' : d.noSpell || box < 2 ? (d.lang === 'sv' ? 'pickRev' : 'pick') : 'type';
      const out = []; if (!V.exam && isNewWord) out.push({ kind: 'intro', deck: d, word: w, title: 'Nytt ord', cat: 'word', spec });
      out.push({ ...makeWordExercise(d, w, kind), deck: d, cat: 'word', spec, _slotEnd: true }); return out;
    }
    const skill = V2.skillOf(kid, spec.cid); if (!skill) return [];
    if (spec.mode === 'teach') return [{ cat: 'learn', spec, skill, ex: V2.teachExample(skill, spec) }];
    const avoid = new Set([...((c && c.items) || []).slice(-4), ...((c && c.fb && c.fb.items) || []), ...V.seen]);
    // 2.1: kunskapspunkt ur ett Concept Pack – generatorn väljer form efter motorns behov (eget svar, djup, utmaning) och nivå
    if ((V.C.cat[spec.cid] || {}).kind === 'kp') {
      if (V.exam) { const tq = V2.teacherQ(kid, spec.cid); if (tq) { V.seen.add(V2.iid(tq)); return [{ ...tq, skill, cat: 'math', level: tq.level, spec, _slotEnd: true }]; } }
      const fmt = V.exam ? 'any' : spec.role === 'readclose' ? 'recall' : spec.format === 'recall' || spec.format === 'depth' ? spec.format : 'any';
      const stage = V.exam ? null : { n: c ? c.n : 0, st: c ? c.st : 0 };   // Learning Recipe: stadiet styr aktiviteten (inte i Testa mig)
      const ask = () => PACKS.question(spec.cid, { lvl: spec.lvl, format: fmt, pol: pol.name, avoid, rnd: Math.random, challenge: spec.mode === 'challenge', itemId: LECAT.itemId, stage, exam: V.exam, vary: V.exam ? null : EXP.vary(V, spec) });
      let q = ask();
      // v3 (UX-granskning): samma faktum ska inte komma tillbaka samma dag i en annan form (t.ex. först flerval, sedan som Boss i eget svar).
      // Bara valet av variant – formatet och nivån som motorn bad om gäller. Finns ingen annan variant: samma faktum hellre än ingen uppgift.
      if (V.exp && !V.exam) { const dk = EXP.dayFacts(kid); for (let t = 0; t < 4 && q && q.fk && dk.has(q.fk); t++) { avoid.add(LECAT.itemId(q)); const q2 = ask(); const fits = q2 && !q2.onlyVariant && (fmt !== 'recall' || q2.form === 'recall') && (fmt !== 'depth' || PACKS.DEPTH.has(q2.form)) && (q2.level || 1) <= Math.max(q.level || 1, spec.lvl || 1); if (!fits) break; q = q2; } if (q && q.fk) dk.add(q.fk); }   // bytet tas bara när varianten har samma format och nivå (verifieringspass)
      if (!q && spec.mode === 'challenge') q = PACKS.question(spec.cid, { lvl: 3, format: 'depth', pol: pol.name, avoid, rnd: Math.random, itemId: LECAT.itemId });
      if (!q) return [];
      q = { ...q, skill, cat: 'math', level: q.level || spec.lvl };
      if (V.exp === 'explore' && !V.exam && spec.format !== 'recall' && EXP.buildable(q) && !(q.accept && q.accept.exact)) q.build = true;   // v3: bygg ordet med brickor (samma rättning) – aldrig när motorn ber om eget svar eller stavningen är själva frågan (brickorna avslöjar t.ex. dubbelteckning – verifieringspass)
      V.seen.add(V2.iid(q)); return [{ ...q, spec, _slotEnd: true }];
    }
    let q;
    // v3-rytm: Hitta felet / Baklänges som fördjupning (registreras som Utmaning – ändrar aldrig grundkunskapens stadium)
    const rk = EXP.rhythmKind(V, spec, skill, c); if (rk) { const rq = EXP.rhythmItem(rk, skill, spec.lvl); if (rq) { V.seen.add(V2.iid(rq)); return [{ ...rq, skill, cat: 'math', level: rq.level || spec.lvl, rhythm: rk, fcode: rk === 'spot' ? 'm' : 'v', spec: { ...spec, rhythm: rk }, _slotEnd: true }]; } }   // granskning: rytmen är riktig övning av momentet → vanligt bevis (form: hitta felet / baklänges), inte en Utmaning utan bevis
    if (spec.mode === 'challenge') q = CHG.make(skill, spec.lvl, (c && c.ch && c.ch.n) || 0, { young: pol.name === 'younger' });   // annars: vanlig uppgift på högsta nivån, märkt UTMANING
    // Fria textsvar (nyckelordsrättning) används aldrig i v2 – rättningen är inte tillräckligt säker för att styra stadier och Felboken (3E).
    const genNoOpen = () => { let q1 = null; for (let lv = spec.lvl; lv >= 1 && (!q1 || q1.type === 'open'); lv--) for (let j = 0; j < 4 && (!q1 || q1.type === 'open'); j++) q1 = makeQuestion(kid, skill, lv, { noOpen: true, v2: true }); return q1; };
    if (!q) q = V2.pickItem(kid, skill, spec.lvl, avoid, genNoOpen);
    if (q && q.type === 'open') return [];   // inget annat finns för momentet på någon nivå → hoppa över platsen
    q = { ...q, skill, cat: 'math', level: q.level || spec.lvl };
    // 3E: aktiv hämtning – eget svar när flerval inte längre räcker som bevis (stadium ≥ policyns flervalsgräns)
    const wantRecall = spec.format === 'recall' || (!V.exam && c && c.st >= pol.mcMaxStage && !['warmup', 'rescue', 'easy'].includes(spec.role) && spec.mode !== 'challenge') || spec.role === 'readclose';
    if (wantRecall && q.type === 'choicetext' && !q.challenge) {
      // Sök en uppgift i banken som säkert kan bli eget svar (annars flerval – motorn kräver då två fördröjda träffar per stadium)
      let r = RECALL.convert(q); for (let j = 0; !r && j < 6; j++) { const q2 = V2.safe(() => makeQuestion(kid, skill, spec.lvl, { noOpen: true, v2: true }), 'recallGen', null); if (q2 && !avoid.has(LECAT.itemId(q2))) { r = RECALL.convert(q2); if (r) q = { ...q2, skill, cat: 'math', level: q2.level || spec.lvl }; } }
      // samma fråga som eget svar = samma uppgift (id från flervalsoriginalet) → Felbokens "annan uppgift"-regel och variationen gäller frågan, inte formen
      if (r) q = { ...r, skill, cat: 'math', level: q.level, baseId: LECAT.itemId(q) };
    }
    else if (wantRecall && q.choices && (q.type === 'num' || q.type === 'expr')) q = { ...q, choices: undefined };
    // v3 papper och penna: appen väljer uppgiften, barnet räknar på papper och skriver bara svaret (rättas som vanligt)
    if (EXP.paperFor(V, q, spec, skill)) q = { ...q, choices: undefined, paper: true };
    // v3 Explore: efter ett textval (som för paketens aktiviteter) blir ett taluppdrag "skriv talet" med sifferknappar i stället för fler knappar att välja bland
    else if (V.exp === 'explore' && !V.exam && q.type === 'num' && q.choices && !['warmup', 'rescue', 'easy'].includes(spec.role) && spec.help !== 'rescue' && (EXP.vary(V) || {}).choiceRun >= 1) q = { ...q, choices: undefined, keypad: true };
    V.seen.add(V2.iid(q));
    return [{ ...q, spec, _slotEnd: true }];
  },
  iid(q) { return q.baseId || LECAT.itemId(q); },
  /* 2.2 Study Mission: lärarens egna frågor (ur skoluppgiften, källtrogna) används i Testa mig för provet de hör till. Bara frågor som kan
     rättas säkert: flerval (rätt svar + minst två felaktiga alternativ) eller kort eget svar (typed, högst tre ord). Varje fråga en gång per
     pass och bara på en av sina kunskapspunkter. Rättningen är deterministisk; ingen AI-rättning. */
  teacherQs(kid, examId) {
    const e = LE.exams(kid, prof(kid.id)).find(x => x.id === examId); const w = e && e.work && typeof FAMILY !== 'undefined' ? FAMILY.workById(e.work) : null;
    return ((w && w.teacherQs) || []).filter(t => t.a && t.kps.length && (t.not.length >= 2 || (t.typed && t.a.trim().split(/\s+/).length <= 3)));
  },
  teacherQ(kid, cid) {
    const V = S.v2; V.tqUsed = V.tqUsed || new Set();
    const t = V2.teacherQs(kid, V.extra.examId).find(x => x.kps.includes(cid) && !V.tqUsed.has(x.n + '|' + x.q)); if (!t) return null; V.tqUsed.add(t.n + '|' + t.q);
    const why = `Lärarens fråga${t.n ? ' ' + esc(t.n) : ''}: rätt svar är <b>${esc(t.a)}</b>.`;
    const q = t.not.length >= 2 ? PACKS.mc(esc(t.q), t.a, t.not.slice(0, 3), [], why, Math.random, { alias: t.alias }) : PACKS.typed(esc(t.q), [t.a, ...t.alias], why, { pool: t.not });   // alternativen escapas när de ritas
    return { ...q, level: 2, teacher: { n: t.n }, kp: cid };
  },
  visualSolution(q) {
    if (typeof ASSETS === 'undefined') return null; const S0 = (id, alt) => ASSETS.slot(id, alt);
    if (q.choiceAssets) return { fig: S0(q.choiceAssets[q.answer], 'Rätt bild'), answer: 'bilden ovan' };
    if (q.type === 'sort' && q.itemAssets) return { fig: q.bins.map(b => `<div><b>${esc(b)}</b> ${q.items.map((t, i) => (q.answer[t] === b ? S0(q.itemAssets[i], b) : '')).join('')}</div>`).join(''), answer: 'se bilderna ovan' };
    if (q.type === 'match' && q.pairAssets) return { fig: q.pairs.map((x, i) => `<div>${S0(q.pairAssets[i], x[1])} <b>${esc(x[1])}</b></div>`).join(''), answer: 'se bilderna ovan' };
    return { fig: q.fig, answer: answerDisplay(q) };
  },
  teachExample(skill, spec) {
    if (spec.cid && spec.cid.startsWith('k:')) {   // 2.1: kunskapspunktens förklaring + senaste felet (eller ett löst exempel)
      const t = PACKS.teach(spec.cid, S.v2.C.pol.name); if (t && spec.role === 'intro') return { intro: { name: t.name, explain: t.explain }, text: '', steps: [], answer: '' }; const last = [...S.queue].reverse().find(x => x.cat === 'math' && x.kp === spec.cid);
      const q = last || (t && t.q); if (!t) return null;
      const vis = q && q.vid ? V2.visualSolution(q) : null;   // 3.5: bilduppgifter visar lösningen med bilderna, aldrig bara etiketter som "Bild 3"
      return { text: q ? q.text : t.name, fig: vis ? vis.fig : q && q.fig, answer: vis ? vis.answer : q ? answerDisplay(q) : '', steps: [`<b>${esc(t.name)}</b>: ${t.explain}`, ...t.mistakes.map(m => `Vanligt fel: <i>${m.wrong}</i> – ${m.right}`)], fromFail: !!last };
    }
    // Senaste felet på konceptet i passet (Rescue) – annars ett nytt löst exempel
    const last = [...S.queue].reverse().find(x => x.cat === 'math' && x.skill && x.skill.id === skill.id);
    const q = last || V2.safe(() => makeQuestion(S.kid, skill, Math.max(1, (spec.lvl || 2) - 1), { noOpen: true }), 'teachEx', null);
    return q ? { text: q.text, fig: q.fig, answer: answerDisplay(q), steps: q.steps || [], fromFail: !!last } : null;
  },
  /* ---------- 2.1 Läs upp ----------
     Uppläsningen används för att ta bort onödigt läsmotstånd – aldrig när läsningen själv är det som övas (läsförståelse, lästexter).
     Behörighet per fråga (q.speak från paketet, momentets readAloud) och per moment. Enhetens egen talsyntes (ingen extern tjänst).
     Yngre: en tydlig knapp "Läs upp" som läser frågan och svarsalternativen. Övriga: den vanliga högtalarikonen. Finns ingen röst: ingen knapp. */
  READ_OFF: new Set(['sv_lasa', 'sv4_lasa', 'sv8_lasa']),
  canSpeak(q) { if (typeof TTS === 'undefined' || !TTS.ok || !q) return false; if (q.speak === false) return false; const sk = q.skill || {}; if (sk.readAloud === false || V2.READ_OFF.has(sk.id)) return false; if (q.fig && /readbox|listen-box|svread/i.test(q.fig)) return false; return true; },
  sayText(q) { const t = RECALL.strip(q.text).replace(/\s+/g, ' ').trim();
    if (q.type === 'sort') return `${t} … ${q.items.join(', ')}. Grupperna är: ${q.bins.join(' och ')}.`;
    if (q.type === 'match') return `${t} … ${q.pairs.map(x => x[0]).join(', ')}. Och: ${q.pairs.map(x => x[1]).join(', ')}.`; const ch = q.type === 'choicetext' && Array.isArray(q.choices) ? q.choices.map(c => RECALL.strip(c).trim()) : null; return ch ? `${t} … ${ch.slice(0, -1).join(', ')} eller ${ch[ch.length - 1]}?` : t; },
  speakBtn(q, p) {
    if (!V2.canSpeak(q)) return '';
    if (S.v2.C.pol.name === 'younger') return `<button class="btn ghost" data-speak="${esc(V2.sayText(q))}" data-lang="sv" style="min-height:${S.v2.exp ? 48 : 36}px;padding:0 12px" aria-label="Läs upp frågan">${S.v2.exp ? `<span class="ic" aria-hidden="true">${ICON.speaker}</span>` : '🔊'} Läs upp</button>`;
    return p.settings.tts ? `<button class="icon-btn" data-speak="${esc(q.text.replace(/<[^>]+>/g, ''))}" data-lang="sv"${S.v2.exp && q.challenge === 'spot' ? '' : ' data-highlight="1"'} style="width:${S.v2.exp ? 44 : 36}px;height:${S.v2.exp ? 44 : 36}px" aria-label="Läs upp">${ICON.speaker}</button>` : '';
  },
  /* ---------- Visning under passet ---------- */
  // v3 (slutverifieringen): planerade uppgifter som faktiskt återstår i passkörarens kö (utan Ny chans/Rescue/extra lätta), högst så många
  // som passets tak (maxItems) rymmer – motorns omförsök kan korta passet, och då krymper siffran ärligt i stället för att lova för mycket.
  // Bossplatsen räknas som planerad. Har motorn ingen Boss att ge när passet når dit hoppas den över, och KLAR säger "Bossen väntar nästa gång".
  plannedLeft() { const R = S.v2.R; const left = R.queue.slice(R.i).filter(x => x.mode !== 'teach' && !EXP.EXTRA.has(x.role)).length; return Math.max(0, Math.min(left, R.maxItems - R.answered)); },
  total() { if (S.v2.exp && !S.v2.exam) return Math.max(1, EXP.done() + V2.plannedLeft()); const pr = LER.progress(S.v2.R); return Math.max(S.queue.length, S.i + Math.max(1, pr.left)); },
  // v3: räknaren följer den planerade längden – omförsök och Rescue är "Ny chans" utan nummer (mållinjen flyttar sig inte)
  num() { if (!(S.v2.exp && !S.v2.exam)) return S.i + 1; const it = S.queue[S.i]; return EXP.isExtra(it) ? (it.spec.role === 'easy' ? 'Extra' : 'Ny chans') : Math.min(V2.total(), EXP.done() + 1); },
  // Anropas efter svaret (passköraren har redan gått vidare): finns det något kvar i planen är det "Nästa", inte "Visa resultat"
  // (granskning v3: Bossen kom efter en knapp som sa "Visa resultat")
  hasNext() { const pr = LER.progress(S.v2.R); return S.i + 1 < S.queue.length || pr.left > 0; },
  // 3.0.1: glosor i ett v3-pass heter efter ämnet ("Engelska glosor"), inte efter glosbokens namn – det såg ut som en annan övning än Kör!
  wordTitle(deck) { const L = (typeof LANGS !== 'undefined' && LANGS[deck && deck.lang]) || null; return !L ? 'Glosor' : deck.lang === 'sv' ? 'Svenska ord' : L.name + ' glosor'; },
  title(item) { return S.v2.exam ? 'Testa mig' : S.v2.mode === 'more' ? 'Öva mer' : S.v2.mode === 'mission' ? 'Inför ' + esc((LE.exams(S.kid, prof(S.kid.id)).find(e => e.id === S.v2.extra.examId) || {}).title || 'provet') : S.v2.mode === 'revansch' && !S.v2.exp ? 'Revansch' :S.v2.mode === 'readclose' ? 'Minns du?' : item.cat === 'word' ? esc(S.v2.exp && S.v2.exp !== 'classic' ? V2.wordTitle(item.deck) : item.deck.name) : item.skill && S.v2.exp === 'explore' ? ({ math: 'Matte', sv: 'Svenska', en: 'Engelska', no: 'NO', so: 'SO' })[item.skill.group || 'math'] || 'Äventyret' : item.skill ? esc(item.skill.short || item.skill.name) : 'Kör!'; },   // Explore: ämnet, inte momentets interna namn (UX)
  // v3: N kvar = planerade uppgifter; en Ny chans/Rescue syns som extra och tar inga planerade platser
  topRight() { const pr = LER.progress(S.v2.R); if (S.v2.exp && !S.v2.exam) { const it = S.queue[S.i]; const extra = EXP.isExtra(it); const left = extra ? Math.min(V2.plannedLeft(), Math.max(0, S.v2.R.maxItems - S.v2.R.answered - 1)) : V2.plannedLeft(); return `<span class="left-count">${left ? `${left} kvar` : 'Snart klart'}</span>`; }   /* 3.3 slutpasset: Ny chans/Rescue/Extra syns i kortets etikett – räknaren säger bara vad som är kvar av planen */ return S.v2.exam ? `<span class="pill">Inga ledtrådar · svar efteråt</span>` : `<span class="left-count">${Math.max(0, pr.left)} kvar</span>`; },
  progressBar() { const tot = V2.total();
    if (S.v2.exp && !S.v2.exam) { const d = EXP.done();   // v3: planerade platser; ingen röd historik för fel svar
      if (S.v2.exp === 'explore') return `<div class="trail" role="progressbar" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${d}" aria-label="Äventyret">${Array.from({ length: tot }, (_, i) => `<span class="dot ${i < d ? 'ok' : i === d ? 'cur' : ''}" aria-hidden="true">${i === tot - 1 ? '👑' : ''}</span>`).join('')}</div>`;
      const bar = `<div class="progress v3" role="progressbar" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${d}" aria-label="Passet: ${d} av ${tot} klara">${Array.from({ length: tot }, (_, i) => `<i class="${i < d ? 'done' : i === d ? 'cur' : ''}"></i>`).join('')}</div>`;
      return S.v2.exp === 'grow' ? `<div class="progress-row">${bar}<span class="pg-end" aria-hidden="true">🏁</span></div>` : bar; }   /* 3.3 slutpasset: Grow – rundan har en mållinje */ return `<div class="progress">${Array.from({ length: tot }, (_, i) => `<i class="${i < S.i ? (S.v2.exam ? (S.v2.exp ? 'done' : 'ok') : S.results[i] === false ? 'no' : 'ok') : i === S.i ? 'cur' : ''}"></i>`).join('')}</div>`; },
  chip(item) {
    if (item && item.teacher && S.v2.exam) return `<div class="row" style="justify-content:center"><span class="pill acc" style="font-weight:800;letter-spacing:.04em"><span aria-hidden="true">📝</span> LÄRARENS FRÅGA${item.teacher.n ? ' ' + esc(item.teacher.n) : ''}</span></div>`;
    const xc = S.v2.exp ? EXP.chipFor(item) : null; if (xc) return `<div class="row" style="justify-content:center"><span class="pill acc act-chip" style="font-weight:800;letter-spacing:.04em"><span aria-hidden="true">${xc[1]}</span> ${xc[0]}</span></div>`;
    if (!item || !item.spec || S.v2.exam) return '';
    const s = item.spec; const key = item.cat === 'learn' ? (s.role === 'rescue' ? 'rescue' : s.role === 'intro' ? 'intro' : 'teach') : s.mode === 'challenge' ? 'challenge' : s.role;
    const formChip = item.cat === 'math' && item.form && ['focus', 'practice', 'remember', 'warmup', 'easy'].includes(s.role) ? V2.FORM_CHIP[item.form] : null;
    let [txt, ic] = formChip || V2.ROLE_CHIP[key] || ['', ''];
    let why = '';
    if (S.v2.exp) {   /* 3.3 slutpasset: en etikett per läge, samma skrivsätt och ikon som på startsidan (bara text) */
      const x = S.v2.exp; const V3 = { rescue: x === 'achieve' ? ['STEG FÖR STEG', '🧭'] : ['VI TAR DET TILLSAMMANS', '🤝'], revansch: ['REVANSCH', '💪'], warmup: ['VÄRM UPP', '☀️'], challenge: x === 'grow' ? ['UTMANING · NÄSTA NIVÅ', '🧗'] : ['UTMANING', '🧗'], teach: ['KORT FÖRKLARING', '💡'], easy: ['EXTRA', '➕'] };
      if ((!formChip || key === 'easy' || key === 'challenge') && V3[key]) [txt, ic] = V3[key]; if (formChip && item.form === 'multistep' && key !== 'easy' && key !== 'challenge') ic = '🪜';   /* Utmaningen och Extra är lägen – de går före formen */
      if (key === 'revansch') { if (S.v2.revFirst == null) S.v2.revFirst = S.i; if (S.v2.revFirst === S.i) why = `<div class="role-why">${x === 'grow' ? 'Returmatch: den här var klurig förut.' : x === 'achieve' ? 'Det här gick fel förut – nu en ny fråga om samma sak.' : 'Den här var klurig förut. Nu tar du revansch!'}</div>`; }   /* vad Revansch betyder – en gång per pass */
    }
    if (!txt) return '';
    return `<div class="row" style="justify-content:center"><span class="pill acc act-chip role-${esc(key)}" style="font-weight:800;letter-spacing:.04em"><span aria-hidden="true">${ic}</span> ${txt}</span></div>${why}`;
  },
  teachBody(item) {
    const ex = item.ex; const rescue = item.spec.role === 'rescue'; const intro = item.spec.role === 'intro'; const s = item.skill;
    const say = typeof TTS !== 'undefined' && TTS.ok && S.v2.C.pol.name === 'younger' && s.readAloud !== false && !V2.READ_OFF.has(s.id) && ex && ex.intro ? `<button class="btn ghost" data-speak="${esc(RECALL.strip(ex.intro.name + '. ' + ex.intro.explain))}" data-lang="sv" style="min-height:36px">${S.v2.exp ? `<span class="ic" aria-hidden="true">${ICON.speaker}</span>` : '🔊'} Läs upp</button>` : '';
    if (intro && ex && ex.intro) return `${S.v2.exp ? '<div class="learn-ic" aria-hidden="true">🔎</div>' : '<div class="eyebrow">Något nytt</div>'}<h3 class="learn-title" style="margin:6px 0">${esc(ex.intro.name)}</h3><p style="font-size:1.05rem">${safeHtml(ex.intro.explain)}</p>${say}${s.method ? `<details class="sketch"><summary>${S.v2.exp ? `<span class="ic" aria-hidden="true">${ICON.book}</span>` : '📖'} Läs mer om ${esc(s.short || s.name)}</summary><div class="method" style="margin-top:8px">${safeHtml(s.method)}</div></details>` : ''}<button class="btn big wide" data-v2="teachok">${S.v2.exp ? 'Nu provar jag →' : 'Jag är redo →'}</button>`;
    return `${S.v2.exp ? '' : `<div class="eyebrow">${rescue ? 'Vi tar det tillsammans' : 'En kort förklaring först'}</div>`}
      ${ex ? `<div class="steps"><div class="eyebrow">${ex.fromFail ? 'Uppgiften du nyss fick' : 'Exempel'}</div>${ex.fig ? `<div class="figwrap">${safeHtml(ex.fig)}</div>` : ''}<div style="font-weight:700;margin:6px 0">${safeHtml(ex.text)}</div>${S.v2.exp && ex.steps.length === 1 ? `<p style="margin:4px 0 0">${safeHtml(ex.steps[0])}</p>` : `<ol>${ex.steps.map(st => `<li>${safeHtml(st)}</li>`).join('')}</ol>`}${S.v2.exp && /^\s*(<[^>]+>\s*)*Svar\s*:/i.test(String(ex.steps[ex.steps.length - 1] || '')) ? '' : `<p style="margin-top:8px">Svar: <b>${esc(ex.answer)}</b></p>`}</div>` : ''}
      ${s.method ? `<details class="sketch"><summary>${S.v2.exp ? `<span class="ic" aria-hidden="true">${ICON.book}</span>` : '📖'} Läs mer om ${esc(s.short || s.name)}</summary><div class="method" style="margin-top:8px">${safeHtml(s.method)}</div></details>` : ''}
      ${S.v2.exp && ex && V2.sayOk(s, { skill: s, text: ex.text, fig: ex.fig, speak: ex.speak }) ? `<button class="btn ghost fb-say" data-speak="${esc(RECALL.strip([ex.text, ...(ex.steps || []), 'Svar: ' + ex.answer].join('. ')))}" data-lang="sv" aria-label="Läs upp förklaringen"><span class="ic" aria-hidden="true">${ICON.speaker}</span> Läs upp</button>` : ''}
      <button class="btn big wide" data-v2="teachok">${rescue ? 'Nu provar vi tillsammans →' : 'Jag är redo – nu provar jag →'}</button>`;
  },
  // 3.3: uppläsning av återkoppling och förklaringar – inte när läsningen själv prövas (samma regler som frågan), bara med enhetens röst
  sayOk(skill, q) { if (typeof TTS === 'undefined' || !TTS.ok || S.v2.exam) return false; if (q ? !V2.canSpeak(q) : (skill && (skill.readAloud === false || V2.READ_OFF.has(skill.id)))) return false; return S.v2.C.pol.name === 'younger' || !!prof(S.kid.id).settings.tts; },
  afterRender(item) {
    const fb0 = document.getElementById('fb'); if (fb0) { fb0.setAttribute('aria-live', 'polite'); fb0.setAttribute('role', 'status'); }   // granskning L13
    if (item && item.cat === 'learn') { setTimeout(() => document.querySelector('[data-v2="teachok"]')?.focus({ preventScroll: true }), 50); return; }
    if (!item || item.cat !== 'math' || !item.spec || S.v2.exam) return;
    const h = item.spec.help; const fb = document.getElementById('fb'); if (!fb) return;
    if (h === 'rescue') {
      // 3.3 slutpasset: etiketten står redan ovanför kortet, och kom barnet direkt från Rescue-förklaringen har det just läst första steget –
      // då räcker ledtråden. Utan ledtråd visas alltid första steget (hjälpen är densamma, bara utan upprepning).
      const prev = S.queue[S.i - 1]; const justRead = !!(S.v2.exp && item.hint && prev && prev.cat === 'learn' && prev.spec && prev.spec.role === 'rescue');
      fb.innerHTML = S.v2.exp ? `<div class="hint">${item.hint ? `<span aria-hidden="true">💡</span> ${safeHtml(item.hint)}` : ''}${item.steps && item.steps[0] && !justRead ? `${item.hint ? '<br>' : ''}<b>Första steget:</b> ${safeHtml(item.steps[0])}` : ''}</div>`
        : `<div class="hint">🤝 Vi gör den tillsammans. ${item.hint ? safeHtml(item.hint) : ''}${item.steps && item.steps[0] ? `<br><b>Första steget:</b> ${safeHtml(item.steps[0])}` : ''}</div>`;
      if (S.v2.exp && !fb.textContent.trim()) fb.innerHTML = '';
      document.getElementById('hintBtn')?.remove(); }
    else if (h === 'hint' && item.hint) { fb.innerHTML = `<div class="hint">💡 ${safeHtml(item.hint)}</div>`; document.getElementById('hintBtn')?.remove(); }
  },
  teachDone() { const item = S.queue[S.i]; if (!item || item.cat !== 'learn') return; LER.answered(S.v2.R, S.v2.C.L, item.spec, true); S.results.push(null); nextQuestion(); },
  // Granskning M6: Utmaningen ger XP men ändrar aldrig v1:s mastery/nivå eller v1-Felboken (som rollback bygger på)
  challengeXp(correct) { const p = prof(S.kid.id); const xp = EXP.poActive() ? 0 : correct ? 14 : 2; p.xp += xp; bumpDay(p, correct, xp); if (correct) questEvent(p, 'correct', { skillId: null }); save(); return xp; },
  check(q, raw) { return q.v2check === 'recall' ? RECALL.check(q, raw) : q.v2check === 'create' ? CHG.check(q, raw) : q.v2check === 'pack' ? PACKS.check(q, raw) : checkAnswer(q, raw); },
  /* ---------- Svar → bevis ---------- */
  // v3 (granskning H1/H2): sortera, para ihop och bygg ordet går att lösa genom att pröva sig fram eller känna igen – de räknas som
  // flerval (k = gissningsgrad). Då kan de aldrig ensamma lyfta ett koncept förbi flervalsgränsen eller ge "Säker".
  kindOf(q) { return q.type === 'choicetext' || q.choices || q.type === 'sort' || q.type === 'match' || q.build ? 'mc' : q.type === 'order' ? 'order' : q.type === 'open' ? 'open' : 'free'; },
  observe(q, correct) {
    return V2.safe(() => {
      const V = S.v2; const spec = q.spec; if (!spec) return null; const kid = S.kid; const p = prof(kid.id); const C = V.C;
      const kind = V2.kindOf(q); const fast = !correct && LE._shownAt > 0 && (Date.now() - LE._shownAt) < (LE.FAST_MS[kind] || 2500);
      const help = V.exam ? 'none' : spec.help === 'rescue' ? 'rescue' : S.revealed ? 'solution' : (S.usedHelp || spec.help === 'hint') ? 'hint' : 'none';
      const dev = LE.dev(); const seq = ((p.le.seqs || {})[dev] || 0) + 1; p.le.seqs = { ...(p.le.seqs || {}), [dev]: seq };
      const ev = { t: V.start + 1000 * (++V.k), dev, seq, cid: spec.cid, ok: !!correct, kind, k: kind === 'mc' ? ((q.choices || []).length || q.k || (q.build ? 4 : 3)) : 0, help, ctx: spec.ctx || 'first', item: V2.iid(q), fast, sess: V.id, lvl: q.level || spec.lvl || 1, restart: V.restart,
        role: spec.code || undefined, stretch: !!spec.stretch, onlyVariant: !!q.onlyVariant, mode: spec.mode === 'challenge' ? 'challenge' : V.exam ? 'testa' : V.mode === 'readclose' ? 'readclose' : undefined, form: q.fcode || undefined, med: q.paper ? 'p' : undefined };
      const last = C.L.clock.last || 0; p.le.log.push(LE2.encodeEv(ev)); const res = LE2.apply(C.L, C.cat, ev, C.pol); C.n = p.le.log.length; LE.rebuildIfLate(p, C, ev.t, last);
      if (res.diff && res.diff.after && res.diff.after.st > res.diff.before.st) V.stageUps.add(spec.cid);
      // Förklaring för föräldern (bara i minnet, sparas aldrig): vad ändrades och varför
      (V2.lastReasons[kid.id] = V2.lastReasons[kid.id] || []).push({ cid: spec.cid, ok: !!correct, role: spec.role, reasons: (res.reasons || []).slice(0, 3) }); if (V2.lastReasons[kid.id].length > 30) V2.lastReasons[kid.id].shift();
      V.rewards.push(...V2.grant(p, res.rewards || [], spec.cid));
      const evs = LER.answered(V.R, C.L, spec, correct);
      const rec = (p.le.shadow || []).find(r => r.id === V.id); if (rec) { rec.a.push([spec.cid, correct ? 1 : 0, (spec.ctx || 'first')[0]]); rec.v1.push(spec.cid); }
      save(); return evs;
    }, 'observe', null);
  },
  observeWord(ex, correct) {
    V2.safe(() => { const V = S.v2; if (!ex.spec || !ex._slotEnd) return; LER.answered(V.R, V.C.L, ex.spec, correct); const p = prof(S.kid.id); const rec = (p.le.shadow || []).find(r => r.id === V.id); if (rec) { rec.v1.push(ex.spec.cid); rec.w[0]++; if (correct) rec.w[1]++; } }, 'observeWord');
  },
  REWARD_TXT: { REMEMBERED: 'Du kom ihåg!', COMEBACK: 'Revansch klar!', CHALLENGE: 'Utmaning klarad!', MASTERY: 'Sitter säkert!', FOCUS: 'Dagens fokus klart!', CONSISTENCY: 'Tre plugg-dagar den här veckan!' },
  grant(p, list, cid) {
    const V = S.v2; const day = LE2.dayIdx(V.start); const out = []; if (V.po) return out;   // 3.4: övning utan poäng – inga belöningar (och inget förbrukas i belöningsliggaren)
    for (const rw of list) {
      const key = rw === 'REMEMBERED' ? `REM:${day}:${cid}` : rw === 'COMEBACK' ? `CB:${day}:${cid}` : rw === 'CHALLENGE' ? `CH:${day}` : rw === 'MASTERY' ? `MA:${cid}` : rw === 'FOCUS' ? `FO:${day}` : rw === 'CONSISTENCY' ? `CO:${7 * Math.floor((day + 3) / 7) - 3}` : null;   // måndagen i passets vecka (dygn räknat från 1970-01-01, en torsdag)
      if (!key || !LE2.rewardOnce(p.le, key, day)) continue;
      const a = LE2.CFG.reward[rw] || {}; if (a.xp) { p.xp += a.xp; S.xp += a.xp; } if (a.gems) p.gems += a.gems;
      out.push({ k: rw, xp: a.xp || 0, gems: a.gems || 0 });
    }
    return out;
  },
  // Kort rad i svarsrutan: belöning eller Rescue. Inga felräknare.
  feedbackExtra(evs, before, q) {
    const add = S.v2.rewards.slice(before); const pts = !(S.v2.exp === 'explore' || S.v2.exp === 'achieve'); const parts = add.map(r => pts ? `${V2.REWARD_TXT[r.k]} ${r.xp ? `+${r.xp} XP` : ''}${r.gems ? `+${r.gems} 💎` : ''}` : V2.REWARD_TXT[r.k]);   // v3 Explore/Achieve: inga poäng i svarsrutan (Explore: inga poäng; Achieve: kompetensen är belöningen) – XP räknas som förut
    if ((evs || []).some(e => e.type === 'rescue' || e.type === 'defer')) S.v2.calm = true;   // v3 lugn presentation: motorns egen signal, ingen egen algoritm
    if ((evs || []).some(e => e.type === 'rescue')) parts.push('🤝 Vi tar det tillsammans – nästa kort hjälper dig.');
    if ((evs || []).some(e => e.type === 'defer')) parts.push('Vi sparar den här till ett annat pass. Bra kämpat!');
    const fb = document.getElementById('fb'); if (!fb) return;
    if (parts.length) fb.insertAdjacentHTML('beforeend', `<div class="hint" style="margin-top:8px">${parts.join('<br>')}</div>`);
    if (S.v2.exp && q && V2.sayOk(q.skill, q)) { const f = fb.querySelector('.feedback'); if (f) f.insertAdjacentHTML('afterend', `<button class="btn ghost fb-say" data-speak-fb="1" aria-label="Läs upp återkopplingen"><span class="ic" aria-hidden="true">${ICON.speaker}</span> Läs upp</button>`); }
    if (q && q.spec && !S.v2.exam) fb.insertAdjacentHTML('beforeend', `<div style="text-align:right;margin-top:6px"><button class="link" data-v2="qr" style="font-size:.8rem;opacity:.75">Den här frågan är konstig</button></div>`);
  },
  /* 2.1 Innehållshälsa: barnet kan markera en fråga som konstig. Sparar bara dygn + uppgifts-id + kunskapspunkt (ingen fritext, ingen tid).
     Påverkar varken bevis, stadier eller vad som visas – föräldern ser markeringen i Motor v2 och innehållet ändras bara i en ny paketversion. */
  reportQ(el) {
    const q = S.queue[S.i]; if (!q || !q.spec) return; const p = prof(S.kid.id);
    LE2.reportItem(p.le, LE2.dayIdx(S.v2.start), V2.iid(q), q.spec.cid); save();
    el.outerHTML = `<span class="muted" style="font-size:.8rem">Tack! En vuxen tittar på frågan.</span>`;
  },
  examAnswered(q, correct, raw) {
    const V = S.v2; const your = q.cat === 'word' ? raw : q.type === 'choicetext' ? (q.choices || [])[S.selected] : q.choices ? T.n(Number(S.selected)) : q.type === 'order' ? 'din ordning' : q.type === 'sort' ? 'din sortering' : q.type === 'match' ? 'dina par' : raw;
    V.answers.push({ text: q.cat === 'word' ? String(q.prompt || q.word.t) : q.text, html: q.cat !== 'word', your: your == null ? '' : String(your), correct: q.cat === 'word' ? q.word.w : answerDisplay(q), ok: !!correct, isError: q.isError === true, spot: q.challenge === 'spot', falseChal: q.challenge === 'false', paper: !!q.paper, steps: q.cat === 'word' ? [`${esc(q.word.w)} = ${esc(q.word.t)}`] : (q.steps || []), lvl: q.level || 1 , fig: q.vassets && q.fig ? q.vassets[0] : undefined, vsol: q.vid && (q.type === 'sort' || q.type === 'match') ? V2.visualSolution(q).fig : undefined, yourA: q.choiceAssets ? q.choiceAssets[S.selected] : undefined, correctA: q.choiceAssets ? q.choiceAssets[q.answer] : undefined});
    nextQuestion();
  },
  /* ---------- Slut på passet ---------- */
  finish() {
    const V = S.v2; const kid = S.kid; const p = prof(kid.id); const C = V.C; const sum = LER.summary(V.R);
    V2.safe(() => {
      p.sessions++; p.sprintsSinceBreak = (p.sprintsSinceBreak || 0) + 1; if (sum.n >= 5 && sum.ok === sum.n && !V.po) { p.perfect = (p.perfect || 0) + 1; questEvent(p, 'perfect', {}); }
      const focusOk = V.R.log.some(x => x[1] === 'F' && x[2] === 1); const extra = [];
      if (focusOk) extra.push('FOCUS'); if (V2.weekDays(p) >= LE2.CFG.reward.CONSISTENCY.days) extra.push('CONSISTENCY');
      if (!V.exam) V.rewards.push(...V2.grant(p, extra, null));
      const rec = (p.le.shadow || []).find(r => r.id === V.id); if (rec) { rec.done = 1; rec.n = sum.n; }
      if (V.exam) { const parts = { E: [0, 0], C: [0, 0], A: [0, 0] }; for (const a of V.answers) { const k = a.lvl >= 3 ? 'A' : a.lvl === 2 ? 'C' : 'E'; parts[k][0]++; if (a.ok) parts[k][1]++; } const r = (k) => parts[k][0] ? parts[k][1] / parts[k][0] : 0;
        const ind = r('E') < 0.6 ? 'Ännu inte E' : parts.C[0] && r('C') >= 0.5 ? (parts.A[0] && r('A') >= 0.5 ? 'A' : 'C') : 'E';
        p.tests.push({ date: todayKey(), examId: V.extra.examId, score: V.answers.filter(a => a.ok).length, total: V.answers.length, ms: Date.now() - S.startedAt, v2: 1, ind }); if (p.tests.length > 30) p.tests.shift(); }
      LE.housekeep(kid);
    }, 'finish');
    save(); V.ended = true;   // 3.4: övningsblockets spärr gäller bara blocket (inte senare köp, synk eller nollställning)
    const won = V.po ? [] : (V2.safe(() => checkBadges(kid), 'badges', []) || []);
    if (V.exam) return V2.examResult(won);
    const next = V2.safe(() => V2.peekPlan(kid).plan, 'nextPlan', null);
    const klar = V.light || !!(next && (next.light || next.scopeEmpty || !next.length));   // 3.1: inget "Ett pass till" när dagens plan är tom
    const fbNow = V2.safe(() => LE2.felbokVisible(C.L, LE.now()).length, 'fb', 0); const newFb = Math.max(0, fbNow - V.fbBefore); const cap = LE2.DECISIONS.O8_felbokDisplay[C.pol.name] || 5;
    const quests = dailyQuests(kid); const claimable = quests.filter(q => q.done && !q.claimed);
    const young = C.pol.name === 'younger'; const gems = V.rewards.reduce((a, r) => a + r.gems, 0);
    if (V.exp && V.mode !== 'readclose') {   // Experience v3: KLAR → frivillig FLOW
      beep(won.length ? 'badge' : 'win');
      // 3.3 slutpasset: allt som hände utöver passet som samma slags rad – ikon, vad det är, en kort förklaring
      const row = (ic, t, sub) => `<div class="card klar-row"><span class="kr-i" aria-hidden="true">${ic}</span><div class="kr-t"><b>${t}</b>${sub ? `<div class="kr-s">${sub}</div>` : ''}</div></div>`;
      const cards = `${won.length ? row(esc(won[0].e), 'Nytt märke', esc(won.map(b => b.name).join(', '))) : ''}
      ${EXP.autoClaim(kid, claimable, row)}
      ${newFb ? row(V.exp === 'achieve' ? '📕' : '💪', V.exp === 'achieve' ? 'Sparat i Felboken' : 'Revansch en annan dag', `${newFb > cap ? 'Några saker' : newFb === 1 ? 'En sak' : `${newFb} saker`} ${V.exp === 'achieve' ? 'sparades i Felboken – revansch ett annat pass.' : 'att ta revansch på en annan dag.'}`) : ''}`;   // v3: inga lösa trådar på KLAR – uppdragen hämtas automatiskt
      return EXP.finish(kid, V, sum, won, cards);
    }
    if (won.length) beep('badge'); else beep('win'); if (klar && young) confetti(60);
    render(`${topbar('Klart', 'home')}
    <div class="stack" style="margin-top:6px">
      <div class="card pad-lg summary-hero stack" style="gap:8px;text-align:center">
        <div style="font-size:2rem">${klar ? '✅' : '🎉'}</div>
        <div class="eyebrow">KLART!</div>
        <div style="font-weight:800;font-family:var(--display);font-size:1.3rem">${klar ? 'Bra jobbat. Du är klar för idag.' : 'Bra jobbat!'}</div>
        <div style="font-weight:700">${sum.ok} av ${sum.n} rätt</div>
        ${V.stageUps.size ? `<div>${V.stageUps.size === 1 ? 'Ett område' : `${V.stageUps.size} områden`} blev säkrare${young ? ' ⭐' : ''}</div>` : ''}
        ${V.rewards.some(r => r.k === 'COMEBACK') ? '<div>Du tog revansch på något som var svårt</div>' : ''}
        ${gems ? `<div>+${gems} 💎</div>` : ''}
        ${V.restart ? '<div class="muted" style="font-size:.9rem">Skönt att vara igång igen!</div>' : ''}
        <div class="muted" style="font-size:.9rem">${klar ? (young ? 'Nästa pass: imorgon.' : 'Nästa pass: imorgon – då sitter det bättre.') : `Cirka ${Math.max(1, Math.round((Date.now() - S.startedAt) / 60000))} min${S.xp ? ` · +${S.xp} XP` : ''}`}</div>
      </div>
      ${V.rewards.length ? `<div class="card stack" style="gap:6px"><div class="eyebrow">Det här gick bra</div>${V.rewards.map(r => `<div class="row" style="justify-content:space-between"><span>${V2.REWARD_TXT[r.k]}</span><b>${r.xp ? `+${r.xp} XP` : ''}${r.gems ? ` +${r.gems} 💎` : ''}</b></div>`).join('')}</div>` : ''}
      ${newFb ? `<div class="card row" style="gap:10px"><span style="font-size:1.3rem">📕</span><div class="grow muted" style="font-size:.9rem">${newFb > cap ? 'Några saker' : newFb === 1 ? 'En sak' : `${newFb} saker`} hamnade i Felboken – revansch ett annat pass.</div></div>` : ''}
      ${claimable.length ? `<div class="card" style="border:2px solid var(--good)"><div class="eyebrow">Uppdrag klart!</div>${claimable.map(q => `<div class="quest done"><div class="qi">✅</div><div class="grow"><div class="qt">${esc(q.text)}</div><div class="qp">+${q.reward.xp} XP, +${q.reward.gems} 💎</div></div><button class="btn claim" data-claim="${q.id}">Hämta</button></div>`).join('')}</div>` : ''}
      ${won.length ? `<div class="card" style="border:2px solid var(--acc)"><div class="eyebrow">Nytt märke! +${10 * won.length} 💎</div><div class="badge-row" style="margin-top:8px">${won.map(b => `<span class="badge"><span class="e">${b.e}</span>${b.name}</span>`).join('')}</div></div>` : ''}
      ${V.mode === 'readclose' ? `<button class="btn big wide" data-method="${esc(V.extra.skillId)}">Öppna texten igen och jämför</button>` : ''}
      ${klar ? `<button class="btn big wide" data-go="home">Till startsidan</button><button class="link" data-v2="extra" style="align-self:center">Öva extra</button>`
        : `<button class="btn big wide" data-v2="kor">Ett pass till</button><button class="btn ghost wide" data-go="home">Till startsidan</button>`}
    </div>`);
  },
  // 3.5: provets bilduppgifter som inte kunde visas (bilderna saknas eller är skadade på enheten) – sägs ärligt, ersätts aldrig av text
  visMissing(V) { try { if (typeof ASSETS === 'undefined') return false; const cids = new Set((V.plan || []).map(s => s.cid)); for (const pid of PACKS.REG.priv) { const pk = PACKS.REG.packs[pid]; for (const it of (pk && Array.isArray(pk.visual) ? pk.visual : [])) { const kps = it.form === 'match' ? it.kps || [] : [it.kp]; if (it.form !== 'match' && kps.some(k => cids.has(PACKS.cidOf(pid, k))) && !ASSETS.allReady(PACKS.vAssets(pk, it))) return true; } } } catch (e) { /* ignore */ } return false; },
  examResult(won) {
    const V = S.v2; const ok = V.answers.filter(a => a.ok).length; const n = V.answers.length;
    beep(won.length ? 'badge' : 'win');
    render(`${topbar('Testa mig', 'home')}
    <div class="stack" style="margin-top:6px">
    ${V.po ? '<div class="muted" style="font-size:.9rem">Dagens första Testa mig gav poäng – den här omgången är bara för att se läget.</div>' : ''}
    ${V2.visMissing(V) ? '<div class="card muted" style="font-size:.95rem">Bilduppgifterna kunde inte visas på den här enheten och var inte med i testet. De kommer med när bilderna har laddats.</div>' : ''}
      ${V.exp ? (() => { const f = EXP.examFocus(S.kid, V); return `<div class="card pad-lg summary-hero stack exam-hero" style="gap:6px"><div class="eyebrow">Testa mig${f.title ? ' · ' + esc(f.title) : ''}</div>
        <div class="exam-head">${ok === n ? 'Alla svar stämde den här gången.' : 'Bra att du testade. Nu vet appen vad du ska öva på.'}</div>${f.more.length ? `<div class="exam-focus">Öva mer: <b>${f.more.map(esc).join(', ')}</b></div>` : ''}</div>`; })()
      : `<div class="card pad-lg summary-hero stack" style="gap:6px;text-align:center"><div class="eyebrow">Testa mig · ${fmtTime(Date.now() - S.startedAt)}</div><div class="big">${ok}/${n}</div>
        <p style="font-weight:700">${ok === n ? 'Allt rätt – du har koll!' : ok / Math.max(1, n) >= 0.7 ? 'Bra! Kolla igenom de du missade.' : 'Bra att du testade – nu vet vi vad Kör! ska öva på.'}</p></div>`}
      ${V.exp ? EXP.examReport(S.kid, V) : ''}
      <div class="card exam-list"><div class="eyebrow" style="margin-bottom:8px">Svar och förklaringar</div>
        ${V.answers.map((a, i) => `<details style="padding:8px 0;border-top:1px solid var(--line)" ${a.ok ? '' : 'open'}><summary style="cursor:pointer"><b>${i + 1}.</b> ${V.exp ? `<span class="sdot ${a.ok ? 'ok' : 'todo'}" role="img" aria-label="${a.ok ? 'Stämde' : 'Öva mer'}"></span>` : a.ok ? '✅' : '🔁'} <span class="muted" style="font-size:.9rem">${esc(RECALL.strip(a.text).slice(0, 70))}${RECALL.strip(a.text).length > 70 ? '…' : ''}</span></summary>
          <div style="margin-top:6px">${a.html ? safeHtml(a.text) : esc(a.text)}</div>${a.fig && typeof ASSETS !== 'undefined' ? `<div class="figwrap">${ASSETS.slot(a.fig, 'Bilden i uppgiften')}</div>` : ''}${a.vsol ? `<div class="figwrap vans">${safeHtml(a.vsol)}</div>` : ''}
          <div style="margin-top:4px;font-size:.95rem">${a.paper ? '✏️ På papper · ' : ''}${a.isError ? (a.ok ? `Du hittade felet: <s>${esc(a.correct)}</s> – det påståendet stämmer inte.` : `Ditt val: <b>${esc(a.your || '–')}</b>${a.your ? ' – det stämmer, men det var inte felet' : ''}. Felet var: <s>${esc(a.correct)}</s> (stämmer inte).`) : a.falseChal ? (a.ok ? `Du hittade felet: <b>${esc(a.correct)}</b> stämmer inte.` : `Ditt val: <b>${esc(a.your || '–')}</b>${a.your ? ' – det stämmer, men det var inte felet' : ''}. Felet var: <b>${esc(a.correct)}</b> (stämmer inte).`) : a.spot && !a.ok ? `Ditt val: <b>${esc(a.your || '–')}</b> – den lösningen stämmer. Felet fanns i: <b>${esc(a.correct)}</b>.` : a.correctA && typeof ASSETS !== 'undefined' ? `<span class="vans">Ditt svar: ${a.yourA ? ASSETS.slot(a.yourA, 'Din bild') : '–'} · Rätt svar: ${ASSETS.slot(a.correctA, 'Rätt bild')}</span>` : `Ditt svar: <b>${esc(a.your || '–')}</b> · Rätt svar: <b>${esc(a.correct)}</b>`}${a.paper ? `<div class="muted" style="font-size:.85rem">${a.ok ? 'Ditt svar stämmer.' : 'Svaret stämmer inte.'} Jämför din uträkning med lösningen – appen har bara sett svaret.</div>` : ''}</div>
          ${a.steps.length ? `<div class="steps" style="margin-top:6px"><ol>${a.steps.map(st => `<li>${safeHtml(st)}</li>`).join('')}</ol></div>` : ''}</details>`).join('')}
      </div>
      <button class="btn big wide" data-v2="kor">Öva på det som behövs</button>
      <button class="btn ghost wide" data-go="home">Till startsidan</button>
    </div>`);
  },
  /* ---------- Knappar ---------- */
  click(el, kid) {
    const a = el.dataset.v2;
    if (a === 'teachok') return V2.teachDone();
    if (a === 'qr') return V2.safe(() => V2.reportQ(el), 'report');
    if (a === 'endPreview') return V2.endPreview();
    if (a === 'engine' || a === 'engineAsk' || a === 'preview' || a === 'exp' || a === 'scope') return V2.parentClick(a, el);
    if (!kid) return;
    // Ett oväntat fel i v2 får aldrig stoppa barnet: logga och kör v1:s Kör! i stället
    const ok = V2.safe(() => { V2.act(a, el, kid); return true; }, 'click:' + a, false);
    if (!ok) { S = null; if ((a === 'kor' || a === 'extra' || a === 'flow') && !(kid && V2.scopeOn(prof(kid.id)))) { state.screen = 'home'; return startSession(kid, recommendSprint(kid).opts); } toast('Det gick inte att öppna just nu'); return go('home'); }
  },
  act(a, el, kid) {
    if (a === 'kor' || a === 'extra') return V2.start(kid, 'kor');
    if (a === 'flow') return V2.start(kid, 'flow');
    if (a === 'ovamer') return V2.start(kid, 'more');
    if (a === 'felbok') return V2.felbokView(kid);
    if (a === 'revansch') return V2.start(kid, 'revansch');
    if (a === 'testa') return V2.start(kid, 'exam', { examId: el.dataset.exam });
    if (a === 'mission') return V2.start(kid, 'mission', { examId: el.dataset.exam });
    if (a === 'rc') return V2.start(kid, 'readclose', { skillId: el.dataset.skill });
  },
  /* ---------- Förälder ---------- */
  REC_TXT(r, name) {
    const list = (cs) => (cs || []).map(name).map(esc).join(' och ');
    if (r.k === 'exam') return `Provet om ${r.days} ${r.days === 1 ? 'dag' : 'dagar'}: korta Kör!-pass (cirka ${r.minutes} min) räcker. ${r.concepts.length ? `Mest nytta: ${list(r.concepts.slice(0, 3))}.` : ''}`;
    if (r.k === 'rescue') return `${list(r.concepts)} har behövt extra stöd flera gånger. Sitt gärna med en stund och prata om hur man tänker.`;
    if (r.k === 'practise') return `Öva ${list(r.concepts)} några dagar i rad, cirka ${r.minutes} min.`;
    if (r.k === 'due') return `Det finns en del att repetera. Ett pass om dagen (cirka ${r.minutes} min) tar ner det i lugn takt.`;
    if (r.k === 'return') return 'Ett kort pass på 5 minuter är en bra omstart – appen börjar med sådant som sitter.';
    if (r.k === 'depth') return 'Det mesta sitter. Utmaningarna ger fördjupning – fortsätt gärna med korta pass.';
    return `Fortsätt som nu: ett kort pass om dagen (cirka ${r.minutes} min).`;
  },
  // 3.4 flera mål: storleken styr bromsen (bara ett STÖRRE mål bromsar annat nytt). Standard: prov = större, läxförhör/glosförhör = mindre,
  // inlagt prov utan typ = större (som före 3.4). Föräldern kan ändra inlagda prov här; skoluppgifter ändras i skoluppgiften (weight).
  sizeOf(e) { const major = LE.isMajor(e); return { major, txt: major ? 'Större (prov)' : 'Mindre (förhör eller läxa)', why: e.weight ? 'ditt val' : (e.kind === 'homework' || e.kind === 'vocab') ? 'standard för läxa och förhör' : 'standard för prov' }; },
  // 3.4 fas C: täckningsrisken för föräldern – ärligt, utan prognos från gles historik. Regeln är densamma som planerarens täckningstryck:
  // fler osedda områden än dagar kvar före provets sista tre dagar (då tar appen inte in nytt för provet).
  goalsCard(kid) {
    return V2.safe(() => {
      const p = prof(kid.id); if (!p.le || !LE.canStart(kid, p)) return ''; const C = LE.state(kid);
      const list = LE.exams(kid, p).map(e => ({ e, d: daysUntil(e.date) })).filter(x => x.d >= 0 && x.d <= 60).sort((a, b) => a.d - b.d || (a.e.id < b.e.id ? -1 : 1)); if (!list.length) return '';
      const seen = (cid) => !!(C.L.c[cid] && C.L.c[cid].n > 0); const allUn = new Set();   // totalen räknar ett gemensamt område en gång
      const rows = list.map(({ e, d }) => {
        const cids = V2.examCidsActive(kid, e).filter(cid => !(C.cat[cid] && C.cat[cid].kind === 'deck')); const un = cids.filter(cid => !seen(cid)).length; cids.filter(cid => !seen(cid)).forEach(c => allUn.add(c));
        const sz = V2.sizeOf(e); const room = Math.max(0, d - (sz.major ? 3 : 1)); const own = (p.exams || []).some(x => x.id === e.id);
        const cov = !cids.length ? `<div class="muted" style="font-size:.9rem">Områdena är inte inlagda i appen – appen kan inte förbereda för det här.</div>`
          : !un ? `<div style="font-size:.9rem">Alla ${cids.length} områden är påbörjade i appen.</div>`
          : un > room ? `<div class="hint" style="font-size:.9rem"><b>Risk:</b> ${un} av ${cids.length} områden är inte påbörjade, och det är ${room} ${room === 1 ? 'dag' : 'dagar'} kvar innan ${sz.major ? 'provets sista tre dagar' : 'sista dagen'} (då tar appen inte in nytt för det). Allt hinner kanske inte introduceras i appen – särskilt om några dagar blir utan pass. Överväg att prioritera eller öva en del på annat sätt.</div>`
          : `<div style="font-size:.9rem">${un} av ${cids.length} områden är inte påbörjade än · ${room} ${room === 1 ? 'dag' : 'dagar'} kvar innan ${sz.major ? 'provets sista tre dagar' : 'sista dagen'}.</div>`;
        const btn = own ? `<button class="btn ghost" style="min-height:36px;padding:0 10px" data-ex-weight="${esc(e.id)}">Ändra till ${sz.major ? 'mindre' : 'större'}</button>` : '';
        return `<div class="stack" style="gap:4px;padding:8px 0;border-top:1px solid var(--line)"><div class="row" style="justify-content:space-between;gap:8px"><b>${esc(e.title)}</b><span class="muted" style="font-size:.85rem">${esc(fmtDate(e.date))} · ${d === 0 ? 'idag' : d === 1 ? 'imorgon' : `om ${d} dagar`}</span></div>
          <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><span style="font-size:.9rem">${sz.txt} · <span class="muted">${sz.why}${own ? '' : ' · ändras i skoluppgiften'}</span></span>${btn}</div>${cov}</div>`;
      });
      return `<div class="card stack" style="gap:6px"><div class="eyebrow">${esc(kid.name)} · mål och täckning</div>
        <div class="muted" style="font-size:.85rem">Bara ett större mål bromsar annat nytt veckan före. Ett mindre mål får egen tid men stoppar inte förberedelsen för andra prov.</div>
        ${rows.join('')}
        ${list.length > 1 && allUn.size ? `<div class="muted" style="font-size:.85rem">Totalt ${allUn.size} områden som inte är påbörjade, i ${list.length} mål. Appen planerar om från dagens läge varje gång – missade dagar räknas inte som skuld.</div>` : ''}
        <div class="muted" style="font-size:.8rem">Påbörjat betyder övat i appen, inte att det sitter. Inget här är en prognos för provresultatet.</div></div>`;
    }, 'goalsCard', '');
  },
  insightsCard(kid) {
    return V2.safe(() => {
      const p = prof(kid.id); if (!p.le) return ''; const C = LE.state(kid); const now = LE.now(); const ctx = LE.ctx(kid, p, C, now);
      const last = V2.lastAt(p); const I = LE2.insights(C.L, C.cat, now, C.pol, { exams: ctx.exams, daysSinceActive: last ? Math.floor((now - last) / LE2.DAY) : 99 });
      const name = (cid) => V2.cname(kid, C, cid);
      const li = (arr) => arr.length ? arr.slice(0, 3).map(cid => `<li>${esc(name(cid))}</li>`).join('') : '<li class="muted">För lite underlag än</li>';
      const tests = p.tests.filter(t => t.v2).slice(-3).reverse();
      return `<div class="card stack" style="gap:8px;border-left:3px solid var(--acc)"><div class="eyebrow">${esc(kid.name)} · insikter</div>
        <div><div class="eyebrow">STYRKOR</div><ul style="margin:4px 0 0;padding-left:20px">${li(I.strengths)}</ul></div>
        <div><div class="eyebrow">BEHÖVER ÖVAS</div><ul style="margin:4px 0 0;padding-left:20px">${li(I.practise)}</ul></div>
        <div><div class="eyebrow">REKOMMENDERAT NÄSTA STEG</div><ol style="margin:4px 0 0;padding-left:20px">${I.recs.slice(0, 3).map(r => `<li>${V2.REC_TXT(r, name)}</li>`).join('')}</ol></div>
        ${I.temporary.length ? `<div class="muted" style="font-size:.85rem">Tillfälligt fel idag på något som brukar sitta: ${I.temporary.slice(0, 3).map(name).map(esc).join(', ')} – inget att oroa sig för.</div>` : ''}
        ${tests.length ? `<div style="font-size:.9rem"><b>Testa mig</b> ${tests.map(t => `<div>${esc(/^\d{4}-\d\d-\d\d$/.test(String(t.date)) ? fmtDate(t.date) : t.date)} · ${esc(LE.exams(kid, p).find(e => e.id === t.examId)?.title || '')}: ${Number(t.score)} rätt av ${Number(t.total)} · övningsindikation ${esc(t.ind || '–')}</div>`).join('')}<div class="muted" style="font-size:.8rem">Övningsindikationen (E/C/A) är bara ett övningsresultat för dig som förälder – ingen betygsprognos. Barnet ser den inte.</div></div>` : ''}
      </div>`;
    }, 'insights', '');
  },
  // §6: för varje vald uppgift – vad, varför, varför nu, roll, vad ett svar ändrar, när den kan komma tillbaka, varför nivån är som den är
  // 2.1 Innehållshälsa (bara föräldern): flaggade frågor + text att ge Claude. Ingenting ändras automatiskt.
  healthCard(kid) {
    return V2.safe(() => {
      const h = LE.health(kid); if (!h.items.length) return `<div class="card"><h3 style="margin:0 0 4px">Innehållshälsa</h3><div class="muted" style="font-size:.9rem">Inga frågor flaggade. Barnet kan trycka på "Den här frågan är konstig" efter ett svar.</div></div>`;
      return `<div class="card stack" style="gap:8px"><h3 style="margin:0">Innehållshälsa</h3>
        <div class="muted" style="font-size:.85rem">Signaler – inte domar. Ingenting ändras automatiskt: ge texten nedan till Claude, som granskar frågan och släpper en rättad version.</div>
        ${h.items.slice(0, 12).map(x => `<div style="font-size:.9rem;border-top:1px solid var(--line);padding-top:6px"><b>${esc(x.name)}</b>${x.text ? ` · <span class="muted">${esc(x.text)}</span>` : ''}<div style="font-size:.8rem">${x.flags.map(f => `<span class="pill" style="font-size:.72rem;margin:2px 4px 0 0">${esc(LE.HEALTH_TXT[f])}</span>`).join('')} <span class="muted">${x.ok}/${x.n} rätt</span></div></div>`).join('')}
        ${h.items.length > 12 ? `<div class="muted" style="font-size:.85rem">+ ${h.items.length - 12} till</div>` : ''}
        <details><summary style="cursor:pointer;font-weight:700">Text till Claude</summary><textarea readonly rows="6" style="width:100%;font-size:.75rem;margin-top:6px">${esc(LE.healthText(kid, h))}</textarea></details>
      </div>`;
    }, 'healthCard', '');
  },
  explainCard(kid) {
    return V2.safe(() => {
      const p = prof(kid.id); if (!p.le) return ''; const C = LE.state(kid); const now = LE.now(); const { plan } = LE.plan(kid, V2.n(kid, C), now); const pol = C.pol; const L = C.L;
      const d = (ms) => { const x = Math.round(ms / LE2.DAY); return x === 0 ? 'idag' : x > 0 ? `om ${x} d` : `för ${-x} d sedan`; };
      const rows = plan.map(s => { const c = L.c[s.cid]; const def = C.cat[s.cid] || {}; const st = c ? c.st : 0; const I1 = LE2.intervalDays(Math.min(6, st + 1), pol, L);
        const now1 = !c || !c.n ? 'aldrig övat' : c.fb && c.fb.s !== 'resolved' ? `i Felboken (${LE.FB_TXT[c.fb.s] || c.fb.s})` : c.due ? `förfaller ${d(c.due - now)}` : '–';
        const change = def.kind === 'deck' ? 'glosornas egna boxar (Leitner) uppdateras' : s.mode === 'challenge' ? 'bara fördjupning – grundkunskapen påverkas inte' : `rätt utan hjälp → ${c && c.lastOk && (now - c.lastOk) / LE2.DAY < LE2.CFG.early * LE2.intervalDays(st, pol, L) ? 'för tidigt för att höja stadiet' : `stadium ${st} → ${Math.min(6, st + 1)}`}; fel → ${st >= 2 ? 'sänks max ett steg, ny chans i passet' : 'ny variant i passet, Felboken om det upprepas'}`;
        const back = def.kind === 'deck' ? 'enligt ordens boxar' : s.mode === 'challenge' ? 'ett senare pass' : `vid rätt: om cirka ${I1} d · vid fel: imorgon`;
        const lvl = c ? `nivå ${c.lvl}${c.lvlDir === 1 ? ' (höjd efter flera rätt i rad på olika uppgifter)' : c.lvlDir === -1 ? ' (sänkt efter fel i rad)' : ''}` : 'nivå 1 (nytt)';
        return `<div class="r"><div><div style="font-weight:700">${esc(V2.ROLE_CHIP[s.mode === 'challenge' ? 'challenge' : s.role] ? (V2.ROLE_CHIP[s.mode === 'challenge' ? 'challenge' : s.role][0] || 'ÖVNING') : s.role)} · ${esc(def.name || s.cid)}</div>
          <div class="muted" style="font-size:.85rem">Varför: ${esc(s.why || '')}${s.P ? ` (poäng ${Number(s.P)})` : ''} · Varför nu: ${esc(now1)}<br>Svaret ändrar: ${esc(change)}<br>Tillbaka: ${esc(back)} · ${esc(lvl)}</div></div></div>`; }).join('');
      const last = (V2.lastReasons[kid.id] || []).slice(-8).reverse();
      return `<div class="card stack" style="gap:8px"><div class="eyebrow">Nästa Kör! – varför just detta (bara för förälder)</div>${plan.light ? '<div class="muted" style="font-size:.9rem">KLAR-läge: inget mer är särskilt värdefullt idag – kort pass.</div>' : ''}<div class="breakdown">${rows}</div>
        ${last.length ? `<div class="eyebrow" style="margin-top:6px">Senaste svaren på den här enheten – vad motorn gjorde</div>${last.map(x => `<div style="font-size:.85rem;padding:3px 0;border-top:1px solid var(--line)">${x.ok ? '✅' : '🔁'} <b>${esc(V2.cname(kid, C, x.cid))}</b>: ${x.reasons.map(esc).join(' · ') || '–'}</div>`).join('')}` : ''}</div>`;
    }, 'explain', '');
  },
  engineCard(kid) {
    const p = prof(kid.id); const on = V2.engineOf(p) === 'v2'; const ask = state.v2ask === kid.id;
    return `<div class="card stack" style="gap:8px;border:2px solid ${on ? 'var(--good)' : 'var(--line)'}"><div class="eyebrow">Motor för ${esc(kid.name)}</div>
      <div class="toggle"><div><div class="tl">${on ? 'Learning Engine v2 (standard)' : 'v1 (reserv)'}</div><div class="td">${on ? 'Smart Kör!, Felboken 2.0, Testa mig och Rescue. v1:s data uppdateras samtidigt – välj v1 om något inte fungerar, och byt tillbaka när som helst.' : `${esc(kid.name)} kör reservmotorn v1. v2 räknar i skuggläge och kan slås på igen direkt.`}</div></div><div class="seg" role="group" aria-label="Motor"><button class="${on ? '' : 'on'}" aria-pressed="${!on}" data-v2="engine" data-val="v1">v1</button><button class="${on ? 'on' : ''}" aria-pressed="${on}" data-v2="engineAsk" data-val="v2">v2</button></div></div>
      ${ask && !on ? `<div class="feedback warn"><span>⚠️</span><div><div class="big">Slå på v2 igen för ${esc(kid.name)}?</div><div class="sub">Gäller bara ${esc(kid.name)}, på alla enheter efter synk. v1 finns kvar och kan väljas igen direkt.</div><div class="row" style="margin-top:8px;gap:8px"><button class="btn" data-v2="engine" data-val="v2">Ja, slå på v2</button><button class="btn ghost" data-v2="engine" data-val="cancel">Avbryt</button></div></div></div>` : ''}
      ${on ? '' : `<button class="btn ghost" data-v2="preview">👀 Förhandsvisa v2 som ${esc(kid.name)} (ändrar ingenting)</button>`}
    </div>${V2.safe(() => EXP.parentCard(kid) + EXP.missingCard(kid), 'expParent', '')}`;
  },
  parentClick(a, el) {
    const kid = kidById(state.tab); if (!kid) return;
    if (a === 'engineAsk') { state.v2ask = kid.id; return VIEWS.parent(); }
    if (a === 'engine') { const v = el.dataset.val; state.v2ask = null; if (v === 'v2' || v === 'v1') { const p = prof(kid.id); p.settings.engine = v; p.settings.engineAt = LE.now(); /* serverkorrigerad tid */ LE.invalidate(kid.id); save(); toast(v === 'v2' ? `v2 på för ${kid.name}` : `${kid.name} kör v1`); } return VIEWS.parent(); }
    if (a === 'preview') return V2.startPreview(kid);
    if (a === 'scope') { const p = prof(kid.id); p.settings.scope = el.dataset.val === 'exams' ? 'exams' : 'all'; p.settings.scopeAt = LE.now(); LE.invalidate(kid.id); save(); toast(p.settings.scope === 'exams' ? `Bara prov och läxor för ${kid.name}` : `${kid.name}: Kör! tränar allt`); return VIEWS.parent(); }
    if (a === 'exp') { EXP.set(kid, el.dataset.val); LE.invalidate(kid.id); toast(el.dataset.val === 'default' ? 'Standard för åldern' : `${(EXP.KINDS[el.dataset.val] || {}).name || ''} för ${kid.name}`); return VIEWS.parent(); }
  },
  // Förälderns förhandsvisning: hela barnflödet med v2 på en kopia. Inget sparas, inget synkas; allt återställs när den avslutas.
  startPreview(kid) {
    flushSave(); if (typeof SYNC !== 'undefined' && SYNC.pending) SYNC.pending.delete(kid.id);   // granskning H2: riktiga läget sparat, ingen väntande uppladdning
    V2.sandbox = { kidId: kid.id, snap: JSON.stringify(DB.profiles[kid.id]), tab: state.tab };
    LE.invalidate(kid.id); state.kid = kid.id; go('home');
  },
  restoreSandbox() {
    const sb = V2.sandbox; if (!sb) return null; V2.sandbox = null; if (S && S.timer) clearInterval(S.timer); S = null;
    DB.profiles[sb.kidId] = JSON.parse(sb.snap); LE.invalidate(sb.kidId); delete V2.lastReasons[sb.kidId]; state.tab = sb.tab;
    const rp = DB.profiles[sb.kidId]; if (typeof SYNC !== 'undefined' && (rp.updatedAt || 0) > (rp.syncedAt || 0)) SYNC.schedulePush(sb.kidId);   // riktiga osynkade ändringar laddas upp igen
    return sb;
  },
  endPreview() { const sb = V2.restoreSandbox(); state.kid = null; if (sb) state.tab = sb.tab; go(sb ? 'parent' : 'start'); },
  previewBar() { return V2.sandbox ? `<div class="card row" style="gap:8px;background:var(--warn-soft,#fff3d6);border:2px solid var(--warn)"><div class="grow" style="font-size:.9rem"><b>Förhandsvisning av v2</b> – inget sparas.</div><button class="btn ghost" data-v2="endPreview" style="min-height:36px">Avsluta</button></div>` : ''; },
};
if (typeof module !== 'undefined') module.exports = V2;
