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
  ROLE: { warmup: 'W', remember: 'R', revansch: 'V', focus: 'F', practice: 'P', boss: 'B' },
  ROLE_TXT: { W: 'Uppvärmning', R: 'Kommer du ihåg?', V: 'Revansch', F: 'Dagens fokus', P: 'Övning', B: 'Bossen' },
  POLICY_TXT: { younger: 'Yngre', middle: 'Mellan', older: 'Äldre' },
  guard(fn, where) { if (!LE.on) return undefined; try { return fn(); } catch (e) { LE.errors.push({ where, msg: String(e && e.message || e).slice(0, 120), t: Date.now() }); if (LE.errors.length > 20) LE.errors.shift(); return undefined; } },
  dev() {
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
    const decks = allDecks(p); const key = kid.skills.map(s => s.id).join(',') + '|' + decks.map(d => d.id).join(',');
    const C = LE.C[kid.id]; if (C && C.catKey === key) return { cat: C.cat, map: C.map, key };
    const b = LECAT.build(kid, decks, typeof OPEN !== 'undefined' ? OPEN : null); return { cat: b.cat, map: b.map, key };
  },
  // Härlett tillstånd (bas + logg → L), cachat per barn. Migrerar v1 → le första gången (deterministiskt, v1 orört).
  state(kid) {
    const p = prof(kid.id); const { cat, map, key } = LE.catFor(kid, p); const pn = LE.policyName(kid, p); const pol = LE2.POLICIES[pn];
    if (p.le && p.le.v !== 2) throw new Error('okänd le-version ' + p.le.v); // skriv aldrig över en senare fas data (rollback)
    if (!p.le) p.le = LE2.migrateV1(p, cat, map, Date.now(), pol);
    let C = LE.C[kid.id];
    if (!C || C.ref !== p.le || C.n !== p.le.log.length || C.pn !== pn || C.catKey !== key) {
      C = LE.C[kid.id] = { ref: p.le, n: p.le.log.length, pn, pol, cat, map, catKey: key, L: LE2.replay(p.le.log, cat, pol, p.le.base) };
    }
    return C;
  },
  invalidate(kidId) { delete LE.C[kidId]; },
  ensure(kid) { return LE.guard(() => LE.state(kid).ref, 'ensure'); },
  mergeLE(a, b) { try { return LE2.mergeLE(a, b); } catch (e) { LE.errors.push({ where: 'merge', msg: String(e.message).slice(0, 120), t: Date.now() }); return a || b; } },
  // serverMs: dokumentets updateTime. fresh = svaret på vår egen uppladdning (≈ serverns "nu") → mät klockavvikelse.
  anchor(kidId, serverMs, fresh) { LE.guard(() => { if (!serverMs) return; if (fresh) { LE.skewMs = Date.now() - serverMs; try { localStorage.setItem('pluggappen.skew', String(LE.skewMs)); } catch (e) { /* ignore */ } } const p = prof(kidId); if (p && p.le) p.le.srv = Math.max(p.le.srv || 0, serverMs); }, 'anchor'); },
  srcOf(S, hint) { const o = S.opts || {}; if (o.bonus) return 'bonus'; if (hint === 'kor') return 'kor'; if (S.mode === 'test') return 'test'; if (S.mode === 'felbok') return 'felbok'; if (o.wordsOnly || (o.deckIds && o.deckIds.length && !(o.skillIds || []).length)) return 'lang'; if ((o.skillIds || []).length === 1) return 'skill'; return 'mix'; },
  // Planeringskontext från verkliga data (prov, senaste passens ämnen, glosor att repetera)
  ctx(kid, p, C, now, exclId) {
    const exams = (p.exams || []).filter(e => e.date && daysUntil(e.date) >= 0).map(e => ({ at: new Date(e.date + 'T08:00:00').getTime(), concepts: [...(e.skillIds || []).map(LECAT.skillCid), ...(e.deckIds || []).map(LECAT.deckCid)] }));
    const recs = (p.le.shadow || []).filter(r => r.id !== exclId);
    const flat = recs.slice(-2).flatMap(r => [...new Set((r.v1 || []).map(cid => (C.cat[cid] || {}).subject || 'lang'))]);
    const share = {}; for (const s of flat) share[s] = (share[s] || 0) + 1 / flat.length;
    const decks = {}; const nextNew = {};
    for (const d of allDecks(p)) { const id = LECAT.deckCid(d.id); if (!C.cat[id]) continue; if (!(p.enabledDecks || []).includes(d.id)) { decks[id] = { due: 0, nw: 0 }; continue; } let due = 0, nw = 0, seen = 0; for (const w of d.words) { const s = p.words[w.id]; if (!s) nw++; else { seen++; if (s.due <= now) due++; } } decks[id] = { due, nw, seen, level: d.level || 1, lang: d.lang };
      // Nya ord: bara EN kurs per språk räknas som "nytt" – den påbörjade, annars den med lägst nivå (som v1:s språkflöde). Annars översvämmas planen av orörda kurser.
      if (nw > 0) { const cur = nextNew[d.lang]; const better = !cur || (seen > 0) - (cur.seen > 0) > 0 || ((seen > 0) === (cur.seen > 0) && ((d.level || 1) < cur.level || ((d.level || 1) === cur.level && id < cur.id))); if (better) nextNew[d.lang] = { id, seen, level: d.level || 1 }; } }
    const keepNew = new Set(Object.values(nextNew).map(x => x.id)); for (const [id, ds] of Object.entries(decks)) if (!keepNew.has(id)) ds.nw = 0;
    const today = LE2.dayIdx(now); const last = recs.length ? recs[recs.length - 1].t * 1000 : null;
    return { exams, recentSubjectShare: share, subjectCount: new Set(Object.values(C.cat).filter(c => c.kind === 'skill' || (decks[c.id] && (decks[c.id].due || decks[c.id].nw))).map(c => c.subject)).size, dueDoneToday: C.L.dd && C.L.dd.d === today ? C.L.dd.n : 0, lastSessionAt: last, decks };
  },
  // Avaktiverade glosdeck ska inte planeras (v1 visar dem inte heller)
  activeCat(C, p) { const on = new Set((p.enabledDecks || []).map(LECAT.deckCid)); const out = {}; for (const [id, d] of Object.entries(C.cat)) if (d.kind !== 'deck' || on.has(id)) out[id] = d; return out; },
  plan(kid, n, now, exclId) {
    const p = prof(kid.id); const C = LE.state(kid); const ctx = LE.ctx(kid, p, C, now, exclId);
    const plan = LE2.planSession(C.L, LE.activeCat(C, p), now, ctx, C.pol, { n });
    return { plan, ctx, C };
  },
  whyKey(s) { if (s.role === 'boss') return 'boss'; const top = Object.entries(s.parts || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0]; return top ? top[0] : 'maintenance'; },
  sessionStart(S) {
    LE.guard(() => {
      const hint = LE.nextSrc; LE.nextSrc = null;
      if (!S || !S.kid) return; const kid = S.kid; const p = prof(kid.id); if (!LE.canStart(kid, p)) return; const C = LE.state(kid);
      // Passets tid: avrundad till minut; monoton mot motorns klocka (utom om den ligger orimligt långt fram – då vinner verklig tid)
      const real = Math.floor(LE.now() / 60000) * 60000; const last = C.L.clock.last || 0;
      const now = last && last < real + 6 * 3600000 ? Math.max(real, Math.floor(last / 1000) * 1000 + 1000) : real;
      const dev = LE.dev(); const sseq = ((p.le.seqs || {})[dev] || 0) + 1; p.le.seqs = { ...(p.le.seqs || {}), [dev]: sseq }; const id = dev + ':' + sseq;
      const v1 = S.queue.map(LECAT.cidOfItem).map(x => x || '?');
      const recs = p.le.shadow || []; const lastAt = recs.length ? recs[recs.length - 1].t * 1000 : null;
      const restart = !!(lastAt && (now - lastAt) / LE2.DAY > 10);
      const { plan, ctx } = LE.plan(kid, Math.max(1, Math.min(S.queue.length, 18)), now, id);
      const exC = new Set(ctx.exams.filter(e => (e.at - now) / LE2.DAY <= 21).flatMap(e => e.concepts));
      const L = C.L; const vis = LE2.felbokVisible(L).length; const due = Object.entries(L.c).filter(([cid, c]) => C.cat[cid] && c.n > 0 && c.due <= now).length;
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
      const cid = LECAT.skillCid(q.skill.id); if (!C.cat[cid]) return;
      const kind = q.type === 'choicetext' || q.choices ? 'mc' : q.type === 'order' ? 'order' : q.type === 'open' ? 'open' : 'free';
      const ctx = S.mode === 'test' ? 'exam' : S.i >= sx.n0 ? 'retry' : sx.seen[cid] ? 'repeat' : 'first';
      const help = S.revealed ? 'solution' : S.usedHelp ? 'hint' : 'none';
      const fast = !correct && LE._shownAt > 0 && (Date.now() - LE._shownAt) < (LE.FAST_MS[kind] || 2500);
      const dev = LE.dev(); const seq = ((p.le.seqs || {})[dev] || 0) + 1;
      const t = sx.start + 1000 * (++sx.k); // passets start + löpnummer: ordning bevaras, svarstid går inte att utläsa
      const ev = { t, dev, seq, cid, ok: !!correct, kind, k: kind === 'mc' ? ((q.choices || []).length || 3) : 0, help, ctx, item: LECAT.itemId(q), fast, sess: sx.id, lvl: q.level || 1, restart: sx.restart };
      p.le.seqs = { ...(p.le.seqs || {}), [dev]: seq }; p.le.log.push(LE2.encodeEv(ev));
      LE2.apply(C.L, C.cat, ev, C.pol); C.n = p.le.log.length;
      sx.seen[cid] = 1; sx.rec.a.push([cid, correct ? 1 : 0, ctx[0]]);
    }, 'observe');
  },
  sessionEnd(S) {
    LE.guard(() => {
      if (!S || !S._le) return; const p = prof(S.kid.id); const rec = (p.le.shadow || []).find(r => r.id === S._le.id) || S._le.rec;
      let wn = 0, wc = 0; S.queue.forEach((q, i) => { if (q.cat === 'word' && i < S.results.length && q.kind !== 'intro') { wn++; if (S.results[i]) wc++; } });
      rec.w = [wn, wc]; rec.done = 1; rec.n = S.results.length;
      const extra = S.queue.slice(S._le.n0).map(LECAT.cidOfItem).map(x => x || '?'); if (extra.length) rec.x = extra.slice(0, 12); // omförsök som v1 lade till under passet
      const C = LE.state(S.kid); if (LE2.compact(p.le, C.cat, C.pol, Date.now())) LE.invalidate(S.kid.id);
      // Storleksskydd: le får aldrig närma sig dokumentgränsen (1 MiB). Normalt ~30–70 kB.
      if (JSON.stringify(p.le).length > 250000) { p.le.shadow = p.le.shadow.slice(-15); LE.invalidate(S.kid.id); }
    }, 'sessionEnd');
  },

  /* ---------- Föräldradiagnostik ---------- */
  report(kid) {
    if (!LE.canStart(kid, prof(kid.id))) throw new Error('väntar på första synken med molnet');
    const p = prof(kid.id); const C = LE.state(kid); const L = C.L; const now = Date.now(); const pol = C.pol; const D = L.d || {};
    const cat = LE.activeCat(C, p); const recs = (Array.isArray(p.le.shadow) ? p.le.shadow : []).map(LE.cleanRec); const done = recs.filter(r => r.done);
    const pct = (a) => a && a[0] ? Math.round(a[1] / a[0] * 100) : null;
    const concepts = Object.entries(cat).filter(([, d]) => d.kind === 'skill').map(([cid, d]) => { const c = L.c[cid]; return { cid, name: d.name, subject: d.subject, st: c ? c.st : null, n: c ? c.n : 0, lvl: c ? c.lvl : null, due: c && c.n ? c.due : null, fb: c && c.fb ? c.fb.s : null, label: LE2.childLabel(c, now, pol, L), ready: LE2.readiness(c, now) }; });
    const overdue = concepts.filter(c => c.due && c.due <= now).length; const tomorrow = concepts.filter(c => c.due && c.due > now && c.due <= LE2.dayStart(now) + 2 * LE2.DAY).length;
    const fbd = LE2.felbokDisplay(L, pol); const wins = LE2.felbokRecentWins(L, now);
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
    return { weekDays, kid, p, C, L, pol, now, D, concepts, overdue, tomorrow, fbd, wins, fbStates, cmp, recs, done, v1Subj, v2Subj, newSlots, lastNew, unseen, exRecs, exV1, exV2, sessAcc, days, subjPerSess, v2SubjPerSess, checks, pct, avg,
      size: JSON.stringify(p.le).length, logN: p.le.log.length, folded: p.le.folded || 0, ready: checks.every(c => c[1]) };
  },
  // Skuggposter kommer via synk från andra enheter → normaliseras innan de visas (bara kända koder, tal som tal).
  cleanRec(r) {
    const num = (x) => (Number.isFinite(+x) ? +x : 0); const arr = (x) => (Array.isArray(x) ? x : []); const cid = (x) => (typeof x === 'string' ? x.slice(0, 64) : '?');
    const ROLES = new Set(Object.values(LE.ROLE)); const WHY = new Set(['due', 'fb', 'exam', 'weak', 'new', 'focus', 'maintenance', 'boss']); const SRC = new Set(['kor', 'skill', 'mix', 'lang', 'felbok', 'test', 'bonus']);
    r = r || {};
    return { id: String(r.id || '').slice(0, 40), t: num(r.t), src: SRC.has(r.src) ? r.src : 'mix', v1: arr(r.v1).map(cid), v2: arr(r.v2).map(x => [cid(arr(x)[0]), ROLES.has(arr(x)[1]) ? x[1] : '?', WHY.has(arr(x)[2]) ? x[2] : 'maintenance']),
      a: arr(r.a).map(x => [cid(arr(x)[0]), arr(x)[1] ? 1 : 0, ['f', 'p', 'r', 'e'].includes(arr(x)[2]) ? x[2] : 'f']), ex: Array.isArray(r.ex) ? [num(r.ex[0]), num(r.ex[1])] : null, light: r.light ? 1 : 0, rst: r.rst ? 1 : 0, n: num(r.n), done: r.done ? 1 : 0 };
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
      <p style="font-size:.95rem">${esc(kid.name)} får <b>v1</b> precis som förut. v2 räknar i bakgrunden på samma svar och visar här vad den <i>skulle</i> ha valt. Inget här syns för barnet, och inget skickas utanför familjens lagring.</p>
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
