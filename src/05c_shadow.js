/* ========= Learning Engine v2 – skuggläge (Fas 3B) =========
   Kopplar motorn (LE2) till appen UTAN att ändra barnets upplevelse:
   - v1 väljer fortfarande alla uppgifter, all mastery, Felboken, belöningar och Kör!.
   - LE loggar bevis från v1-svaren, räknar fram vad v2 SKULLE ha valt och sparar en begränsad jämförelse (v1 faktiskt ↔ v2 skugga).
   - Allt ligger i barnets profil (p.le) inom familjens egen lagring. Ingen export, inga fria svarstexter, ingen svarstid:
     bevisens tid = passets start (avrundad till minut) + löpnummer i passet, så tiden mellan två svar går inte att utläsa. Bara en snabb-flagga på fel svar.
   - Varje anrop är skyddat: ett fel här får aldrig påverka v1 (räknas i LE.errors och visas i föräldradiagnostiken).
   - Diagnostiken visas bara i föräldraläget. */
const LE = {
  on: true, errors: [], C: {}, _shownAt: 0, _dev: null, nextSrc: null, skewMs: null,
  FAST_MS: { mc: 1500, free: 2500, order: 3000, open: 4000 },   // under detta + fel svar → snabb-flagga (svag signal, K-12)
  ROLE: { warmup: 'W', remember: 'R', revansch: 'V', focus: 'F', practice: 'P', boss: 'B', challenge: 'C', rescue: 'X', easy: 'E', retry: 'T', readclose: 'Q', testa: 'S' },
  ROLE_TXT: { W: 'Uppvärmning', R: 'Kommer du ihåg?', V: 'Revansch', F: 'Dagens fokus', P: 'Övning', B: 'Bossen', C: 'Utmaning', X: 'Rescue', E: 'Lättare', T: 'Ny chans', Q: 'Läs–stäng–minns', S: 'Testa mig' },
  POLICY_TXT: { younger: 'Yngre', middle: 'Mellan', older: 'Äldre' },
  guard(fn, where) { if (!LE.on) return undefined; try { return fn(); } catch (e) { LE.errors.push({ where, msg: String(e && e.message || e).slice(0, 120), t: Date.now() }); if (LE.errors.length > 20) LE.errors.shift(); return undefined; } },
  // Förhandsvisningen (förälder) får ett eget enhets-id: dess löpnummer kan aldrig krocka med barnets riktiga bevis (granskning H2)
  dev() { const b = LE.devBase(); return typeof TM !== 'undefined' && TM.on ? b + '~t' : typeof V2 !== 'undefined' && V2.sandbox ? b + '~p' : b; },   // ~t: Testa som barnet (sparas aldrig)
  devBase() {
    if (LE._dev) return LE._dev; let d = null;
    try { d = localStorage.getItem('pluggappen.dev'); } catch (e) { /* ignore */ }
    if (!d) { try { const b = new Uint8Array(8); crypto.getRandomValues(b); d = [...b].map(x => (x % 36).toString(36)).join(''); } catch (e) { d = (Date.now().toString(36) + (typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000).toString(36) : '')).slice(-10); } try { localStorage.setItem('pluggappen.dev', d); } catch (e) { /* ignore */ } }
    return (LE._dev = d);
  },
  templatePolicy(kid) { return { ak2: 'younger', ak4: 'middle', ak8: 'older' }[kid.template] || 'middle'; },
  policyName(kid, p) { const o = p.settings && p.settings.lePolicy; return LE2.POLICIES[o] ? o : LE.templatePolicy(kid); }, // 'auto' (eller saknas) = kursmallen
  overridden(p) { return !!(p.settings && LE2.POLICIES[p.settings.lePolicy]); },
  // Enhetens klockavvikelse mot servern (mäts vid uppladdning). Lagras på enheten, aldrig i profilen. >2 min ⇒ bevisens tid korrigeras.
  skew() { if (LE.skewMs == null) { try { LE.skewMs = Number(localStorage.getItem('pluggappen.skew')) || 0; } catch (e) { LE.skewMs = 0; } } return LE.skewMs; },
  now() { const s = LE.skew(); return Date.now() - (Math.abs(s) > 120000 ? s : 0); },
  // Migrera inte från en kanske inaktuell profil innan första synken mot molnet är gjord (när synk är på).
  canStart(kid, p) { return !!(p.le || !(typeof SYNC !== 'undefined' && SYNC.active) || SYNC.lastPull[kid.id]); },
  catFor(kid, p) {
    const decks = allDecks(p); const pn = LE.policyName(kid, p);
    const key = [...kid.skills, ...(kid.v2skills || [])].map(s => s.id).join(',') + '|' + decks.map(d => d.id).join(',') + '|' + pn + '|' + (typeof PACKS !== 'undefined' ? PACKS.regKey() : '');
    const C = LE.C[kid.id]; if (C && C.catKey === key) return { cat: C.cat, map: C.map, kpsOf: C.kpsOf, key };
    const b = LECAT.build(kid, decks, typeof OPEN !== 'undefined' ? OPEN : null, pn); return { cat: b.cat, map: b.map, kpsOf: b.kpsOf || {}, key };
  },
  // 2.1: ett moments koncept i motorn – kunskapspunkterna om momentet har ett Concept Pack, annars momentet självt
  cidsOfSkill(C, skillId) { const k = (C.kpsOf || {})[skillId]; return k && k.length ? k.filter(cid => C.cat[cid]) : (C.cat[LECAT.skillCid(skillId)] ? [LECAT.skillCid(skillId)] : []); },
  // 2.1: prov = familjens/förälderns prov i profilen + skoluppgifter med datum från familjens privata innehåll (ändras aldrig i profilen)
  exams(kid, p) { const rm = p.removedDefaults || []; return [...(p.exams || []), ...((kid && kid.workExams) || []).filter(w => !rm.includes(w.id) && !(p.exams || []).some(x => x.id === w.id))]; },
  examCids(C, e) { return [...new Set([...(e.skillIds || []).flatMap(id => LE.cidsOfSkill(C, id)), ...(e.kps || []).filter(cid => C.cat[cid])])]; },
  // Härlett tillstånd (bas + logg → L), cachat per barn. Migrerar v1 → le första gången (deterministiskt, v1 orört).
  state(kid) {
    const p = prof(kid.id); const { cat, map, kpsOf, key } = LE.catFor(kid, p); const pn = LE.policyName(kid, p); const pol = LE2.POLICIES[pn];
    if (p.le && p.le.v !== 2) throw new Error('okänd le-version ' + p.le.v); // skriv aldrig över en senare fas data (rollback)
    if (!p.le) p.le = LE2.migrateV1(p, cat, map, LE.now(), pol);   // granskning H3d: serverkorrigerad tid
    let C = LE.C[kid.id];
    if (!C || C.ref !== p.le || C.n !== p.le.log.length || C.pn !== pn || C.catKey !== key) {
      C = LE.C[kid.id] = { ref: p.le, n: p.le.log.length, pn, pol, cat, map, kpsOf, catKey: key, L: LE2.replay(p.le.log, cat, pol, p.le.base) };
    }
    return C;
  },
  invalidate(kidId) { delete LE.C[kidId]; },
  // Passets tid: avrundad till minut; monoton mot motorns klocka så att loggens ordning = tidsordning (samma tillstånd före och efter synk).
  // Undantag: ligger motorns klocka mer än 14 dygn före enhetens (t.ex. en enhet med klockan inställd på fel år har synkat) vinner verklig tid.
  // En enhet vars klocka går efter (upp till 14 dygn) fortsätter alltså framåt från senaste bevis. Serverns klockavvikelse (skew) rättar båda fallen efter synk.
  // Granskning H3: tillbaka till 3B:s lilla gräns (6 h). En enhet med klockan långt fram kan inte längre dra alla enheter in i framtiden;
  // en enhet som går efter mer än 6 h stämplar sin riktiga tid och tillståndet byggs då om i tidsordning (rebuildIfLate).
  sessClock(C) { const real = Math.floor(LE.now() / 60000) * 60000; const last = C.L.clock.last || 0; return last && last < real + 6 * 3600000 ? Math.max(real, Math.floor(last / 1000) * 1000 + 1000) : real; },
  // En händelse äldre än senaste kända → bygg om tillståndet i tidsordning PÅ SAMMA objekt (passköraren håller en referens), så live = omspelning.
  rebuildIfLate(p, C, t, last) { if (!(t < last)) return; const fresh = LE2.replay(p.le.log, C.cat, C.pol, p.le.base); for (const k of Object.keys(C.L)) delete C.L[k]; Object.assign(C.L, fresh); C.n = p.le.log.length; },
  newSessId(p) { const dev = LE.dev(); const sseq = ((p.le.seqs || {})[dev] || 0) + 1; p.le.seqs = { ...(p.le.seqs || {}), [dev]: sseq }; return { id: dev + ':' + sseq, dev }; },
  // Efter ett pass: packa loggen och håll le långt under dokumentgränsen (1 MiB). Normalt ~30–70 kB.
  housekeep(kid) { const p = prof(kid.id); const C = LE.state(kid); if (LE2.compact(p.le, C.cat, C.pol, LE.now())) LE.invalidate(kid.id); if (JSON.stringify(p.le).length > 250000) { p.le.shadow = p.le.shadow.slice(-15); LE.invalidate(kid.id); } },
  ensure(kid) { return LE.guard(() => LE.state(kid).ref, 'ensure'); },
  mergeLE(a, b) { try { return LE2.mergeLE(a, b); } catch (e) { LE.errors.push({ where: 'merge', msg: String(e.message).slice(0, 120), t: Date.now() }); return a || b; } },
  // serverMs: dokumentets updateTime. fresh = svaret på vår egen uppladdning (≈ serverns "nu") → mät klockavvikelse.
  anchor(kidId, serverMs, fresh) { LE.guard(() => { if (!serverMs) return; if (fresh) { LE.skewMs = Date.now() - serverMs; try { localStorage.setItem('pluggappen.skew', String(LE.skewMs)); } catch (e) { /* ignore */ } } const p = prof(kidId); if (p && p.le) p.le.srv = Math.max(p.le.srv || 0, serverMs); }, 'anchor'); },
  srcOf(S, hint) { const o = S.opts || {}; if (o.bonus) return 'bonus'; if (hint === 'kor') return 'kor'; if (S.mode === 'test') return 'test'; if (S.mode === 'felbok') return 'felbok'; if (o.wordsOnly || (o.deckIds && o.deckIds.length && !(o.skillIds || []).length)) return 'lang'; if ((o.skillIds || []).length === 1) return 'skill'; return 'mix'; },
  // Planeringskontext från verkliga data (prov, senaste passens ämnen, glosor att repetera)
  ctx(kid, p, C, now, exclId) {
    const exams = LE.exams(kid, p).filter(e => e.date && daysUntil(e.date) >= 0).map(e => ({ at: new Date(e.date + 'T08:00:00').getTime(), concepts: [...LE.examCids(C, e), ...(e.deckIds || []).map(LECAT.deckCid)] }));
    const recs = (p.le.shadow || []).filter(r => r.id !== exclId);
    const flat = recs.slice(-2).flatMap(r => [...new Set((r.v1 || []).map(cid => (C.cat[cid] || {}).subject || 'lang'))]);
    const share = {}; for (const s of flat) share[s] = (share[s] || 0) + 1 / flat.length;
    const decks = {}; const nextNew = {};
    const tplDecks = ((typeof TEMPLATES !== 'undefined' && TEMPLATES[kid.template]) || {}).decks || []; const tplOrder = (deckId) => { const i = tplDecks.indexOf(deckId); return i < 0 ? 1000 : i; };
    for (const d of allDecks(p)) { const id = LECAT.deckCid(d.id); if (!C.cat[id]) continue; if (!(p.enabledDecks || []).includes(d.id)) { decks[id] = { due: 0, nw: 0 }; continue; } let due = 0, nw = 0, seen = 0; for (const w of d.words) { const s = p.words[w.id]; if (!s) nw++; else { seen++; if (s.due <= now) due++; } } decks[id] = { due, nw, seen, level: d.level || 1, lang: d.lang };
      // Nya ord: bara EN kurs per språk räknas som "nytt" – den påbörjade, annars den med lägst nivå (som v1:s språkflöde). Annars översvämmas planen av orörda kurser.
      // Hotfix 2.1.1: Äldre börjar inte på den lättaste kursen bara för att historik saknas. Utan påbörjad kurs följer Äldre kursmallens
      // egen ordning (åk 8: "Irregular verbs"/"Vocabulary builder" före "Animals"; spanska från början av sin progression). Yngre och
      // Mellan: oförändrat (lägst nivå först). En påbörjad kurs går alltid först.
      const lv = d.level || 1; const ord = C.pol && C.pol.name === 'older' ? tplOrder(d.id) : null;
      if (nw > 0) { const cur = nextNew[d.lang]; const better = !cur || (seen > 0) - (cur.seen > 0) > 0 || ((seen > 0) === (cur.seen > 0) && (ord != null ? (ord < cur.ord || (ord === cur.ord && id < cur.id)) : (lv < cur.level || (lv === cur.level && id < cur.id)))); if (better) nextNew[d.lang] = { id, seen, level: lv, ord }; } }
    const keepNew = new Set(Object.values(nextNew).map(x => x.id)); for (const [id, ds] of Object.entries(decks)) if (!keepNew.has(id)) ds.nw = 0;
    const today = LE2.dayIdx(now); const last = recs.length ? recs[recs.length - 1].t * 1000 : null;
    return { exams, recentSubjectShare: share, subjectCount: new Set(Object.values(C.cat).filter(c => ((c.kind === 'skill' || c.kind === 'kp') && c.active !== false) || (decks[c.id] && (decks[c.id].due || decks[c.id].nw))).map(c => c.subject)).size, dueDoneToday: C.L.dd && C.L.dd.d === today ? C.L.dd.n : 0, lastSessionAt: last, decks };
  },
  // Avaktiverade glosdeck ska inte planeras (v1 visar dem inte heller)
  activeCat(C, p) { const on = new Set((p.enabledDecks || []).map(LECAT.deckCid)); const out = {}; for (const [id, d] of Object.entries(C.cat)) if (d.kind !== 'deck' || on.has(id)) out[id] = d; return out; },
  plan(kid, n, now, exclId, opts = {}) {
    const p = prof(kid.id); const C = LE.state(kid); const ctx = LE.ctx(kid, p, C, now, exclId);
    // 3.1 "Bara prov och läxor" (förälderns val per barn): Kör! och FLOW tränar bara inlagda prov och läxor inom uppdragets horisont –
    // samma motor och samma regler, begränsad med motorns egen only (som provträningen 2.1.1). Provträningen anger sin egen (snävare) only.
    const sc = !opts.only && typeof V2 !== 'undefined' && V2.scopeCids ? V2.scopeCids(kid, p) : null;
    if (sc && !sc.length) { const e = []; e.scopeEmpty = 'none'; return { plan: e, ctx, C }; }
    const plan0 = LE2.planSession(C.L, LE.activeCat(C, p), now, ctx, C.pol, { ...opts, ...(sc ? { only: sc } : {}), n, sessionNo: C.L.sessN || 0 });   // granskning L1: Utmaning var annat pass · opts.newCap (FLOW, provträning) · opts.only (provträning, 2.1.1)
    if (!sc) return { plan: plan0, ctx, C };
    const set = new Set(sc); const plan = plan0.filter(s => set.has(s.cid)); for (const k of Object.keys(plan0)) if (!/^\d+$/.test(k)) plan[k] = plan0[k];
    plan.only = set; if (!plan.some(s => s.role !== 'boss')) { const e = []; e.scopeEmpty = 'idle'; return { plan: e, ctx, C }; }   // bara provets saker – även Bossen; inget att öva idag = inget pass
    return { plan, ctx, C };
  },
  whyKey(s) { if (s.role === 'boss') return 'boss'; const top = Object.entries(s.parts || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0]; return top ? top[0] : 'maintenance'; },
  sessionStart(S) {
    LE.guard(() => {
      const hint = LE.nextSrc; LE.nextSrc = null;
      if (!S || !S.kid) return; const kid = S.kid; const p = prof(kid.id); if (!LE.canStart(kid, p)) return; const C = LE.state(kid);
      const now = LE.sessClock(C); const { id } = LE.newSessId(p);
      const v1 = S.queue.map(LECAT.cidOfItem).map(x => x || '?');
      const recs = p.le.shadow || []; const lastAt = recs.length ? recs[recs.length - 1].t * 1000 : null;
      const restart = !!(lastAt && (now - lastAt) / LE2.DAY > 10);
      const { plan, ctx } = LE.plan(kid, Math.max(1, Math.min(S.queue.length, 18)), now, id);
      const exC = new Set(ctx.exams.filter(e => (e.at - now) / LE2.DAY <= 21).flatMap(e => e.concepts));
      const L = C.L; const vis = LE2.felbokVisible(L, now).length; const due = Object.entries(L.c).filter(([cid, c]) => C.cat[cid] && c.n > 0 && c.due <= now).length;
      const rec = { id, t: Math.round(now / 1000), src: LE.srcOf(S, hint), mode: S.mode, v1, v2: plan.map(s => [s.cid, LE.ROLE[s.role] || '?', LE.whyKey(s)]), light: plan.light ? 1 : 0, rst: restart ? 1 : 0, pol: C.pn,
        iv: L.ivMult || 1, fbo: vis, fb1: (p.mistakes || []).length, due, ex: exC.size ? [v1.filter(c => exC.has(c)).length, plan.filter(s => exC.has(s.cid)).length] : null, a: [], w: [0, 0], done: 0 };
      p.le.shadow = [...(p.le.shadow || []), rec].slice(-LE2.SHADOW_MAX);
      S._le = { id, n0: S.queue.length, seen: {}, restart, rec, start: now, k: 0 };
    }, 'sessionStart');
  },
  shown(S) { if (S) LE._shownAt = Date.now(); },
  observe(S, q, correct) {
    LE.guard(() => {
      if (!S || !S._le || !q || q.cat !== 'math' || !q.skill) return;
      const kid = S.kid; const p = prof(kid.id); const C = LE.state(kid); const sx = S._le;
      // 2.1: en paketfråga (q.kp) loggas direkt på sin kunskapspunkt; gamla frågor loggas på momentet och leds vidare vid omspelningen
      const cid = q.kp && C.cat[q.kp] && C.cat[q.kp].kind === 'kp' ? q.kp : LECAT.skillCid(q.skill.id); if (!C.cat[cid]) return;
      const kind = q.type === 'choicetext' || q.choices ? 'mc' : q.type === 'order' ? 'order' : q.type === 'open' ? 'open' : 'free';
      const ctx = S.mode === 'test' ? 'exam' : S.i >= sx.n0 ? 'retry' : sx.seen[cid] ? 'repeat' : 'first';
      const help = S.revealed ? 'solution' : S.usedHelp ? 'hint' : 'none';
      const fast = !correct && LE._shownAt > 0 && (Date.now() - LE._shownAt) < (LE.FAST_MS[kind] || 2500);
      const dev = LE.dev(); const seq = ((p.le.seqs || {})[dev] || 0) + 1;
      const t = sx.start + 1000 * (++sx.k); // passets start + löpnummer: ordning bevaras, svarstid går inte att utläsa
      const ev = { t, dev, seq, cid, ok: !!correct, kind, k: kind === 'mc' ? ((q.choices || []).length || 3) : 0, help, ctx, item: LECAT.itemId(q), fast, sess: sx.id, lvl: q.level || 1, restart: sx.restart };
      p.le.seqs = { ...(p.le.seqs || {}), [dev]: seq }; p.le.log.push(LE2.encodeEv(ev));
      const last = C.L.clock.last || 0; LE2.apply(C.L, C.cat, ev, C.pol); C.n = p.le.log.length; LE.rebuildIfLate(p, C, ev.t, last);
      sx.seen[cid] = 1; sx.rec.a.push([cid, correct ? 1 : 0, ctx[0]]);
    }, 'observe');
  },
  sessionEnd(S) {
    LE.guard(() => {
      if (!S || !S._le) return; const p = prof(S.kid.id); const rec = (p.le.shadow || []).find(r => r.id === S._le.id) || S._le.rec;
      let wn = 0, wc = 0; S.queue.forEach((q, i) => { if (q.cat === 'word' && i < S.results.length && q.kind !== 'intro') { wn++; if (S.results[i]) wc++; } });
      rec.w = [wn, wc]; rec.done = 1; rec.n = S.results.length;
      const extra = S.queue.slice(S._le.n0).map(LECAT.cidOfItem).map(x => x || '?'); if (extra.length) rec.x = extra.slice(0, 12); // omförsök som v1 lade till under passet
      LE.housekeep(S.kid);
    }, 'sessionEnd');
  },

  /* ---------- Föräldradiagnostik ---------- */
  /* 2.1 Innehållshälsa – bara för föräldern (Motor v2). Härleds ur bevisloggen (som redan finns) och barnets markeringar (le.qr).
     Inget nytt sparas, ingenting ändras automatiskt: flaggorna är underlag för en granskning (av Claude) – innehållet ändras bara via en ny
     paketversion. Signaler per uppgift: rätt direkt varje gång (flerval), fel nästan varje gång, avviker från resten av kunskapspunkten,
     flervalet lurar fast eget svar går bra (vi sparar inte vilket alternativ som valdes – därför bara en indirekt signal), rapporterad. */
  HEALTH_TXT: { reported: 'Rapporterad av barnet', reported2: 'Rapporterad flera gånger', easy: 'Rätt direkt varje gång (flerval) – avslöjar alternativen svaret?', hard: 'Fel nästan varje gång', odd: 'Avviker – resten av kunskapspunkten går bra', distractor: 'Flervalet lurar fast eget svar går bra – kontrollera alternativen' },
  health(kid) {
    const p = prof(kid.id); if (!p.le) return { items: [], reports: 0 };
    const C = LE.state(kid); const cat = C.cat; const items = new Map(); const per = new Map();
    const route = (e) => { const d = cat[e.cid]; return (d && d.route && d.route[e.item]) || e.cid; };
    for (const raw of p.le.log || []) {
      const e = Array.isArray(raw) ? LE2.decodeEv(raw) : raw; if (!e || !e.item || e.mode === 'challenge') continue;
      const cid = route(e); const it = items.get(e.item) || { item: e.item, cid, n: 0, ok: 0, first: 0, firstOk: 0, mc: 0, mcBad: 0, rep: 0 }; items.set(e.item, it);
      it.n++; if (e.ok) it.ok++; if (e.help === 'none' && e.ctx === 'first') { it.first++; if (e.ok) it.firstOk++; } if (e.kind === 'mc') { it.mc++; if (!e.ok) it.mcBad++; }
      const c = per.get(cid) || { n: 0, ok: 0, rn: 0, rok: 0 }; per.set(cid, c); c.n++; if (e.ok) c.ok++; if (e.kind !== 'mc') { c.rn++; if (e.ok) c.rok++; }
    }
    // markeringar från en enhet med fel klocka (mer än en vecka fram) räknas inte
    const today = LE2.dayIdx(LE.now()); const repDays = new Map(); for (const k of (p.le.qr || []).filter(k => Number(k.split('|')[0]) <= today + 7)) { const [d, item, cid] = k.split('|'); const r = repDays.get(item) || { days: new Set(), cid }; r.days.add(d); repDays.set(item, r); }
    for (const [item, r] of repDays) { const it = items.get(item) || { item, cid: r.cid, n: 0, ok: 0, first: 0, firstOk: 0, mc: 0, mcBad: 0 }; it.rep = r.days.size; items.set(item, it); }
    const out = [];
    for (const it of items.values()) {
      const c = per.get(it.cid) || { n: 0, ok: 0, rn: 0, rok: 0 }; const on = c.n - it.n, ook = c.ok - it.ok; const flags = [];
      if (it.rep >= 2) flags.push('reported2'); else if (it.rep) flags.push('reported');
      if (it.mc >= 6 && it.first >= 6 && it.firstOk === it.first && it.ok === it.n) flags.push('easy');
      if (it.n >= 4 && it.ok / it.n <= 0.25) flags.push('hard');
      if (it.n - it.ok >= 3 && it.ok / it.n <= 0.34 && on >= 5 && ook / on >= 0.8) flags.push('odd');
      if (it.mcBad >= 3 && c.rn >= 3 && c.rok / c.rn >= 0.75) flags.push('distractor');
      if (!flags.length) continue;
      const d = cat[it.cid] || {}; const f = typeof PACKS !== 'undefined' ? PACKS.findItem(it.item, C.pol.name, LECAT.itemId, kid) : null;
      out.push({ item: it.item, cid: it.cid, name: d.name || it.cid, flags, n: it.n, ok: it.ok, rep: it.rep || 0, text: f ? f.text : '', form: f ? f.form : '', pack: f ? f.pack : (d.pack || ''), kp: f ? f.kp : (d.kp || '') });
    }
    const w = (x) => (x.flags.includes('reported2') ? 0 : x.flags.includes('reported') ? 1 : x.flags.includes('odd') ? 2 : x.flags.includes('distractor') ? 3 : x.flags.includes('hard') ? 4 : 5);
    out.sort((a, b) => w(a) - w(b) || b.n - a.n || (a.item < b.item ? -1 : 1));
    return { items: out.slice(0, 40), reports: (p.le.qr || []).length };
  },
  // Text att klistra in hos Claude: inga namn, bara innehållets id, form och signal
  healthText(kid, h0) {
    const h = h0 || LE.health(kid); const pol = LE.policyName(kid, prof(kid.id));
    return [`Innehållshälsa (${pol}) – ${h.items.length} flaggade frågor`, ...h.items.map(x => `- ${x.pack ? x.pack + '/' + x.kp : x.cid} · ${x.item}${x.form ? ' · ' + x.form : ''} · ${x.flags.map(f => LE.HEALTH_TXT[f]).join('; ')} · ${x.ok}/${x.n} rätt${x.text ? ` · "${x.text}"` : ''}`)].join('\n');
  },
  report(kid) {
    if (!LE.canStart(kid, prof(kid.id))) throw new Error('väntar på första synken med molnet');
    const p = prof(kid.id); const C = LE.state(kid); const L = C.L; const now = Date.now(); const pol = C.pol; const D = L.d || {};
    const cat = LE.activeCat(C, p); const all = (Array.isArray(p.le.shadow) ? p.le.shadow : []).map(LE.cleanRec); const v2done = all.filter(r => r.e === 2 && r.done).length; const recs = all.filter(r => r.e !== 2); const done = recs.filter(r => r.done);
    const pct = (a) => a && a[0] ? Math.round(a[1] / a[0] * 100) : null;
    const concepts = Object.entries(cat).filter(([, d]) => (d.kind === 'skill' || d.kind === 'kp') && d.active !== false).map(([cid, d]) => { const c = L.c[cid]; return { cid, name: d.name, subject: d.subject, st: c ? c.st : null, n: c ? c.n : 0, lvl: c ? c.lvl : null, due: c && c.n ? c.due : null, fb: c && c.fb ? c.fb.s : null, label: LE2.childLabel(c, now, pol, L), ready: LE2.readiness(c, now) }; });
    const overdue = concepts.filter(c => c.due && c.due <= now).length; const tomorrow = concepts.filter(c => c.due && c.due > now && c.due <= LE2.dayStart(now) + 2 * LE2.DAY).length;
    const fbd = LE2.felbokDisplay(L, pol, now); const wins = LE2.felbokRecentWins(L, now);
    const fbStates = {}; for (const c of Object.values(L.c)) if (c.fb) fbStates[c.fb.s] = (fbStates[c.fb.s] || 0) + 1;
    // jämförelse per pass
    const cmp = done.map(r => { const a = new Set(r.v1.filter(x => x !== '?')), b = new Set(r.v2.map(x => x[0])); const inter = [...a].filter(x => b.has(x)).length; const uni = new Set([...a, ...b]).size;
      const v2val = r.v2.filter(x => ['due', 'fb', 'exam'].includes(x[2])).map(x => x[0]); const cov = v2val.length ? v2val.filter(x => a.has(x)).length / v2val.length : null;
      const first = r.a.filter(x => x[2] === 'f' || x[2] === 'e'); return { r, overlap: uni ? inter / uni : 1, coverage: cov, acc: first.length ? first.filter(x => x[1]).length / first.length : null, nFirst: first.length }; });
    const avg = (arr) => { const v = arr.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
    const subj = (list) => { const o = {}; for (const cid of list) { const s = (C.cat[cid] || {}).subject || 'lang'; o[s] = (o[s] || 0) + 1; } const n = list.length || 1; return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / n])); };
    const v1Subj = subj(done.flatMap(r => r.v1.filter(x => x !== '?'))), v2Subj = subj(done.flatMap(r => r.v2.map(x => x[0])));
    const newSlots = done.filter(r => r.v2.some(x => x[2] === 'new')).length;
    const lastNew = Math.max(0, ...Object.values(L.c).map(c => c.fs || 0)); const unseen = concepts.filter(c => !c.n).length;
    const exRecs = done.filter(r => r.ex); const exV1 = exRecs.reduce((s, r) => s + r.ex[0], 0) / Math.max(1, exRecs.reduce((s, r) => s + r.v1.length, 0)); const exV2 = exRecs.reduce((s, r) => s + r.ex[1], 0) / Math.max(1, exRecs.reduce((s, r) => s + r.v2.length, 0));
    const sessAcc = cmp.filter(x => x.acc != null);
    const days = Math.floor((now - (p.le.migratedAt || now)) / LE2.DAY);
    // O-3: veckokonsekvens (dagar med övning den här veckan) bredvid streak – underlag inför 3F
    const wk = weekKey(); const weekDays = Object.entries(p.days || {}).filter(([k, d]) => k >= wk && d.n > 0).length;
    const subjPerSess = avg(done.map(r => new Set(r.v1.map(c => (C.cat[c] || {}).subject || 'lang')).size)), v2SubjPerSess = avg(done.map(r => new Set(r.v2.map(x => (C.cat[x[0]] || {}).subject || 'lang')).size));
    const checks = [
      ['Minst 14 dagars observation', days >= LE2.DECISIONS.O7_shadowExit.minDays, `${days} dagar`],
      ['Minst 10 avslutade pass i skugga', done.length >= 10, `${done.length} pass`],
      ['Minst 20 fördröjda hämtningar (kalibrering, träffsäkerhet)', (D.ret || [0])[0] >= 20, `${(D.ret || [0])[0]} st`],
      ['Minst 5 uppföljningar efter snabba fel och 5 efter långsamma (K-12)', (D.fw || [0])[0] >= 5 && (D.sw || [0])[0] >= 5, `${(D.fw || [0])[0]} / ${(D.sw || [0])[0]}`],
      ['Minst 3 Kör!-pass att jämföra planer på', done.filter(r => r.src === 'kor').length >= 3, `${done.filter(r => r.src === 'kor').length} st`],
    ];
    return { v2done, weekDays, kid, p, C, L, pol, now, D, concepts, overdue, tomorrow, fbd, wins, fbStates, cmp, recs, done, v1Subj, v2Subj, newSlots, lastNew, unseen, exRecs, exV1, exV2, sessAcc, days, subjPerSess, v2SubjPerSess, checks, pct, avg,
      size: JSON.stringify(p.le).length, logN: p.le.log.length, folded: p.le.folded || 0, ready: checks.every(c => c[1]) };
  },
  // Skuggposter kommer via synk från andra enheter → normaliseras innan de visas (bara kända koder, tal som tal).
  cleanRec(r) {
    const num = (x) => (Number.isFinite(+x) ? +x : 0); const arr = (x) => (Array.isArray(x) ? x : []); const cid = (x) => (typeof x === 'string' ? x.slice(0, 64) : '?');
    const ROLES = new Set(Object.values(LE.ROLE)); const WHY = new Set(['due', 'fb', 'exam', 'weak', 'new', 'focus', 'maintenance', 'boss']); const SRC = new Set(['kor', 'skill', 'mix', 'lang', 'felbok', 'test', 'bonus', 'v2']);
    r = r || {};
    return { id: String(r.id || '').slice(0, 40), t: num(r.t), src: SRC.has(r.src) ? r.src : 'mix', v1: arr(r.v1).map(cid), v2: arr(r.v2).map(x => [cid(arr(x)[0]), ROLES.has(arr(x)[1]) ? x[1] : '?', WHY.has(arr(x)[2]) ? x[2] : 'maintenance']),
      a: arr(r.a).map(x => [cid(arr(x)[0]), arr(x)[1] ? 1 : 0, ['f', 'p', 'r', 'e'].includes(arr(x)[2]) ? x[2] : 'f']), ex: Array.isArray(r.ex) ? [num(r.ex[0]), num(r.ex[1])] : null, light: r.light ? 1 : 0, rst: r.rst ? 1 : 0, n: num(r.n), done: r.done ? 1 : 0, e: r.e === 2 ? 2 : 0 };
  },
  FB_TXT: { open: 'öppen', corrected: 'rättad', verified: 'verifierad', resolved: 'löst', awaiting: 'väntar' },
  pctTxt(x) { return x == null ? '–' : Math.round(x * 100) + ' %'; },
  subjTxt(o) { return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${LECAT.SUBJECT[k] || k} ${Math.round(v * 100)} %`).join(' · ') || '–'; },
  view(kid) { return LE.guard(() => LE.viewInner(kid), 'view') || `<div class="card"><p class="muted">Skuggdiagnostiken kunde inte visas${LE.on ? ` (${esc((LE.errors.slice(-1)[0] || {}).msg || 'okänt fel')})` : ''}. Barnets app påverkas inte.</p></div>`; },
  viewInner(kid) {
    const R = LE.guard(() => LE.report(kid), 'report'); if (!R) return `<div class="card"><p class="muted">Skuggdiagnostiken kunde inte räknas fram (${esc((LE.errors.slice(-1)[0] || {}).msg || 'okänt fel')}). Barnets app påverkas inte.</p></div>`;
    const { p, C, L, pol, D } = R; const T = LE.pctTxt; const name = (cid) => esc((C.cat[cid] || {}).name || cid);
    const nextN = p.settings.sprint || pol.n; const nx = LE.guard(() => LE.plan(kid, nextN, Date.now()), 'plan');
    // v1:s förslag läses bara om dagens uppdrag redan finns – annars skulle föräldravyn skapa barnets uppdrag (sidoeffekt i v1)
    const v1rec = p.quests && p.quests.date === todayKey() ? LE.guard(() => recommendSprint(kid), 'rec') : null;
    const polRow = Object.keys(LE2.POLICIES).map(k => `<button class="${C.pn === k ? 'on' : ''}" data-le-pol="${k}">${LE.POLICY_TXT[k]}</button>`).join('');
    const kv = (rows) => `<div class="kv">${rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div>`;
    const ret = D.ret || [0, 0], retDue = D.retDue || [0, 0], retEarly = D.retEarly || [0, 0], fw = D.fw || [0, 0], sw = D.sw || [0, 0];
    const lastCmp = R.cmp.slice(-8).reverse();
    return `
    <div class="card stack" style="gap:8px;border-left:3px solid var(--acc)"><div class="eyebrow">Learning Engine v2 · skuggläge</div>
      <p style="font-size:.95rem">${V2.engineOf(p) === 'v2' ? `${esc(kid.name)} har <b>v2</b> påslagen (${R.v2done} v2-pass hittills). Jämförelsen nedan gäller pass som körts med v1-urval (t.ex. "Öva" på ett enskilt moment).` : `${esc(kid.name)} får <b>v1</b> precis som förut. v2 räknar i bakgrunden på samma svar och visar här vad den <i>skulle</i> ha valt.`} Inget här syns för barnet, och inget skickas utanför familjens lagring.</p>
      ${kv([['Skugga sedan', p.le.migratedAt ? new Date(p.le.migratedAt).toLocaleDateString('sv-SE') + ` (${R.days} d)` : '–'], ['Pass jämförda', `${R.done.length} avslutade · ${R.recs.length - R.done.length} avbrutna`], ['Bevis i loggen', `${R.logN}${R.folded ? ` (+${R.folded} inbakade)` : ''}`], ['Lagring', `${Math.round(R.size / 1024)} kB`], ['Fel i skuggan', LE.errors.length ? `${LE.errors.length} (${esc(LE.errors.slice(-1)[0].where)})` : '0']])}
    </div>
    <div class="card stack" style="gap:8px"><div class="eyebrow">Upplevelsepolicy (O-9)</div>
      <div class="toggle"><div><div class="tl">${LE.POLICY_TXT[C.pn]}${LE.overridden(p) ? ' · överstyrd' : ' · från kursmallen'}</div><div class="td">Styr bara v2-skuggan i 3B. Visas aldrig för barnet.</div></div><div class="seg">${polRow}</div></div>
      ${LE.overridden(p) ? `<button class="link" data-le-pol="auto">Återställ till kursmallens standard (${LE.POLICY_TXT[LE.templatePolicy(kid)]})</button>` : ''}
      ${kv([['Pass / max inkl. omförsök', `${pol.n} / ${pol.maxItems}`], ['Ämnen per pass', `≤ ${pol.maxSubjects}`], ['Nya koncept per pass', `≤ ${pol.maxNew}`], ['Repetitioner per dag', `≤ ${pol.dueCap}`], ['Intervall', `×${pol.intervalMult} · personlig ×${L.ivMult || 1}`], ['Flerval lyfter till', `stadium ${pol.mcMaxStage}`], ['Faktiskt (v1): ämnen per pass', R.subjPerSess == null ? '–' : R.subjPerSess.toFixed(1)], ['v2 skulle ha haft', R.v2SubjPerSess == null ? '–' : R.v2SubjPerSess.toFixed(1)]])}
    </div>
    <div class="card stack" style="gap:8px"><div class="eyebrow">Nästa Kör! – v1 nu ↔ v2 skugga</div>
      <div style="font-size:.95rem"><b>v1 (det barnet får):</b> ${v1rec ? `${esc(v1rec.label)} · ${Number(v1rec.opts.n) || '–'} uppgifter, slumpas ur ${(v1rec.opts.skillIds || []).length} moment${(v1rec.opts.deckIds || []).length ? ' + glosor' : ''}.` : 'v1 bestämmer dagens Kör! när barnet öppnar sin startsida idag.'}</div>
      ${nx ? `<div style="font-size:.95rem"><b>v2 skulle välja${nx.plan.light ? ' (KLAR-regeln: kort pass, sedan diskret "Öva extra")' : ''}${nx.plan.restart ? ' (återstart efter uppehåll)' : ''}:</b></div>
      <div class="breakdown">${nx.plan.map(s => `<div class="r"><div><div style="font-weight:700">${LE.ROLE_TXT[LE.ROLE[s.role]]} · ${name(s.cid)}</div><div class="muted" style="font-size:.85rem">${esc(s.why)}${s.P ? ` · P ${s.P} (${Object.entries(s.parts || {}).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}</div></div></div>`).join('')}</div>` : '<div class="muted">–</div>'}
    </div>
    <div class="card stack" style="gap:8px"><div class="eyebrow">Det som ska bedömas före 3C (O-7)</div>
      ${kv([
        ['Kalibrering', `×${L.ivMult || 1} (gräns 0,5–1,4) · senaste ${(L.rs || []).length} hämtningar ${T((L.rs || []).length ? (L.rs || []).reduce((a, b) => a + b, 0) / L.rs.length : null)} rätt`],
        ['Träffsäkerhet vid hämtning', `${T(ret[0] ? ret[1] / ret[0] : null)} av ${ret[0]} · förfallna ${T(retDue[0] ? retDue[1] / retDue[0] : null)} (${retDue[0]}) · tidiga ${T(retEarly[0] ? retEarly[1] / retEarly[0] : null)} (${retEarly[0]})`],
        ['Förfallna nu / imorgon', `${R.overdue} / ${R.tomorrow} (tak ${pol.dueCap} per dag)`],
        ['Felboken v2 (dold)', `${R.fbd.total} öppna/rättade → skulle visa ${R.fbd.shown.length}${R.fbd.more ? ` + "${R.fbd.more} fler väntar"` : ''} · ${(R.fbStates.verified || 0)} verifierade · ${(R.fbStates.resolved || 0)} lösta · klarade senaste 7 d: ${R.wins.length}`],
        ['Felboken v1 (det barnet ser)', `${(p.mistakes || []).length} uppgifter`],
        ['Snabba fel (K-12)', `${D.fastWrong || 0} av ${D.wrong || 0} fel · rätt nästa gång: snabba ${T(fw[0] ? fw[1] / fw[0] : null)} (${fw[0]}) · långsamma ${T(sw[0] ? sw[1] / sw[0] : null)} (${sw[0]})`],
        ['Planernas överlapp v1↔v2', `${T(R.avg(R.cmp.map(x => x.overlap)))} · v1 täckte ${T(R.avg(R.cmp.map(x => x.coverage)))} av det v2 såg som förfallet/Felbok/prov`],
        ['Ämnesbalans v1', LE.subjTxt(R.v1Subj)], ['Ämnesbalans v2', LE.subjTxt(R.v2Subj)],
        ['Ny inlärning', `${R.newSlots} av ${R.done.length} v2-planer hade nytt · ${R.unseen} moment aldrig övade · senaste nya ${R.lastNew ? new Date(R.lastNew * 1000).toLocaleDateString('sv-SE') : '–'}`],
        ['Prov inom 21 dagar', R.exRecs.length ? `${R.exRecs.length} pass · provandel v1 ${T(R.exV1)} · v2 ${T(R.exV2)}` : 'inget prov under perioden'],
        ['Flerval / eget svar som lyfte stadium', `${D.mcAdv || 0} / ${D.freeAdv || 0}`],
        ['Övningsdagar den här veckan (O-3)', `${R.weekDays} · streak ${p.streak || 0} (oförändrad i 3B)`],
        ['KLAR-regeln (O-6)', `${R.done.filter(r => r.light).length} av ${R.done.length} pass hade varit korta "klart för idag"-pass`],
      ])}
      <p class="muted" style="font-size:.85rem">Träffsäkerhet 70–85 % är ett jämförelseband, inte ett mål – nyinlärning får ligga under, repetition över.</p>
      <div class="breakdown">${R.checks.map(([t, ok, v]) => `<div class="r"><div><div style="font-weight:700">${ok ? '✅' : '⏳'} ${t}</div></div><span class="m">${v}</span></div>`).join('')}</div>
      <div style="font-weight:700">${R.ready ? 'Underlaget räcker för en 3C-bedömning för det här barnet.' : 'Underlaget räcker inte än – fortsätt i skuggläge.'}</div>
    </div>
    <div class="card"><div class="eyebrow" style="margin-bottom:8px">Senaste passen – v1 faktiskt ↔ v2 skugga</div>
      ${lastCmp.length ? lastCmp.map(x => { const r = x.r; const v1c = {}; for (const c of r.v1) v1c[c] = (v1c[c] || 0) + 1; return `<div style="padding:8px 0;border-top:1px solid var(--line);font-size:.9rem"><div><b>${new Date(r.t * 1000).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b> · ${esc({ kor: 'Kör!', skill: 'Ett moment', mix: 'Blandat', lang: 'Glosor', felbok: 'Felboken', test: 'Provläge', bonus: 'Bonus' }[r.src] || r.src)} · ${r.n || r.v1.length} uppg. · första försök ${T(x.acc)} · överlapp ${T(x.overlap)}${r.light ? ' · KLAR-läge' : ''}${r.rst ? ' · återstart' : ''}</div>
        <div class="muted">v1: ${Object.entries(v1c).map(([c, k]) => `${name(c)}${k > 1 ? ' ×' + k : ''}`).join(', ')}</div>
        <div class="muted">v2: ${r.v2.map(s => `${esc(s[1])}:${name(s[0])}`).join(', ')}</div></div>`; }).join('') : '<p class="muted">Inga pass i skuggläge än. De dyker upp här efter nästa övning.</p>'}
    </div>
    <div class="card"><div class="eyebrow" style="margin-bottom:8px">Koncept – v2:s bild (barnet ser fortfarande v1)</div>
      <div class="breakdown">${R.concepts.filter(c => c.n).sort((a, b) => (a.st - b.st) || (a.name < b.name ? -1 : 1)).map(c => `<div class="r"><div><div style="font-weight:700">${esc(c.name)} <span class="muted" style="font-weight:400">· ${esc(LECAT.SUBJECT[c.subject] || c.subject)}</span></div><div class="muted" style="font-size:.85rem">stadium ${Number(c.st)} · nivå ${Number(c.lvl)} · ${Number(c.n)} bevis · förfaller ${c.due ? new Date(c.due).toLocaleDateString('sv-SE') : '–'}${c.fb ? ` · Felbok: ${LE.FB_TXT[c.fb] || '?'}` : ''}</div></div><span class="m">${esc(c.ready)}</span></div>`).join('') || '<p class="muted">Inga koncept med bevis än.</p>'}</div>
      <p class="muted" style="font-size:.85rem;margin-top:6px">Bra koll / Öva lite mer / För lite underlag är så provberedskap kommer att visas för barnet i 3G (O-5). E/C/A visas bara för förälder och är ett övningsresultat, inte en betygsprognos.</p>
    </div>`;
  },
  summaryCard() { return LE.guard(() => LE.summaryInner(), 'summaryCard') || ''; },
  summaryInner() {
    const reps = KIDS.map(k => [k, LE.guard(() => LE.report(k), 'summary')]);
    const rows = reps.map(([k, R]) => { return R ? `<div class="r"><div><div style="font-weight:700">${esc(k.name)} · ${LE.POLICY_TXT[R.C.pn]}</div><div class="muted" style="font-size:.85rem">${R.days} d · ${R.done.length} pass · ${(R.D.ret || [0])[0]} hämtningar · ${R.checks.filter(c => c[1]).length}/${R.checks.length} villkor</div></div><span class="m">${R.ready ? '✅' : '⏳'}</span></div>` : ''; }).join('');
    const all = reps.length && reps.every(([, R]) => R && R.ready);
    return `<div class="card stack" style="gap:8px"><div class="eyebrow">Learning Engine v2 · skuggläge (Fas 3B)</div><p class="muted" style="font-size:.9rem">Barnen får v1. Detaljer per barn under fliken "Motor v2". 3C bedöms först när underlag finns för alla barn – inte bara efter två veckor.</p><div class="breakdown">${rows || '<p class="muted">Inga barn.</p>'}</div><div style="font-weight:700">${all ? 'Underlag finns för alla barn.' : 'Underlaget räcker inte än för alla barn.'}</div></div>`;
  },
};
