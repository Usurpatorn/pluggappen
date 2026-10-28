/* ========= 3.7 Product Learning Loop v1: privata observationer – AV tills föräldern slår på dem (per barn) =========
   Syfte: att föräldern (och, när föräldern själv delar en export, Claude) ska kunna se hur appen faktiskt används – utan att lärandet,
   belöningarna eller schemat påverkas. Se docs/LEARNING_LOOP.md.
   · Återanvänder det som redan finns (passposterna le.shadow, bevisloggen, Felboken) i exporten; nya händelser bara där inget finns:
     pass startat (ss), uppgift visad och inlämnad (it), uttrycklig avslutning eller utgång (se), erbjudande och val att fortsätta
     (of/sl) och tekniskt fel (er). Hjälp och uppläsning är flaggor på uppgiften.
   · Inga namn, ingen e-post, ingen familjekod, inga skrivna svar, inget ljud eller bild, inga klickspår, inga diagnoser, ingen svarstid.
     Profilen anges med en pseudonym (sha256 av ett slumpat salt och barnets id) – pseudonym, inte anonym.
   · Testa som barnet, förälderns förhandsvisning, testadressen och automatiserade webbläsare registreras aldrig.
   · Allt sker bakom try/catch: ett fel här stoppar aldrig lärandet eller synken.
   · Lokalt: en begränsad kö i den här enhetens lagring (högst MAX_EV händelser och MAX_CHARS tecken). Moln (när reglerna för
     families/{familj}/obs/{doc} är publicerade): små oföränderliga satser, skrivs vid passets slut – aldrig per tryck.
   · Lagringstid: högst 30 dygn (kan sänkas). Rensning sker lokalt vid varje start och registrering; i molnet när en föräldraenhet öppnar
     korten Observationer eller exporterar/raderar. Det finns ingen schemalagd rensning på servern. */
var OBS = {   // var (inte const): föräldravyn kan fråga typeof OBS även före den här filen körts
  V: 1, KEY: 'pluggappen.obs.v1', MAX_EV: 3000, MAX_CHARS: 400000, BATCH: 250, MAX_BATCHES: 3, DAYS: [7, 14, 30], DAYS_DEFAULT: 30, ERR_PER_DAY: 20,
  q: null, cur: null, cloudOff: false, busy: false, installed: false, offerSeen: {},
  DOC_RE: /^p[0-9a-f]{12}-[a-z0-9]{8}-[0-9]{1,9}$/,
  /* ---------- samtycke och undantag ---------- */
  cfg(p) { const o = p && p.settings && p.settings.obs; return o && typeof o === 'object' ? o : null; },
  days(p) { const o = OBS.cfg(p); const d = o && Number(o.days); return OBS.DAYS.includes(d) ? d : OBS.DAYS_DEFAULT; },
  // Aldrig: Testa som barnet, förhandsvisningen, testadressen, automatiserade webbläsare (skärmdumpar, layouttest)
  excluded() {
    try {
      if (typeof TM !== 'undefined' && (TM.on || TM.starting || TM.preview)) return 'tm';
      if (typeof V2 !== 'undefined' && V2.sandbox) return 'preview';
      if (typeof window !== 'undefined' && (window.PLUGG_PREVIEW === true || window.PLUGG_NO_OBS === true)) return 'preview';
      if (typeof navigator !== 'undefined' && navigator.webdriver === true) return 'automation';
    } catch (e) { return 'error'; }
    return '';
  },
  on(kid) { if (!kid) return false; const p = typeof prof === 'function' ? prof(kid.id) : null; const o = OBS.cfg(p); return !!(o && o.on === true && /^[0-9a-f]{16,64}$/.test(String(o.salt || ''))) && !OBS.excluded(); },
  pseud(kid) { const o = OBS.cfg(prof(kid.id)); const s = `${o.salt}:${kid.id}`; return 'p' + OBS.hex(s).slice(0, 12); },
  hex(str) { const b = unescape(encodeURIComponent(String(str))); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return ASSETS.sha256(u); },   // UTF-8 utan TextEncoder (finns inte överallt)
  // Slump för enhets-id och salt: crypto när det finns. Aldrig Math.random – den styr appens egna val (frö i testerna) och får inte påverkas.
  rnd(n) { const a = new Uint8Array(n); let okc = false; try { if (typeof crypto !== 'undefined' && crypto.getRandomValues) { crypto.getRandomValues(a); okc = true; } } catch (e) { okc = false; }
    if (!okc) { let x = (Date.now() ^ ((OBS._rc = (OBS._rc || 0) + 1) * 0x9e3779b1)) >>> 0; for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; a[i] = x >>> 24; } }
    return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); },
  /* ---------- lokal kö ---------- */
  load() {
    if (OBS.q) return OBS.q;
    let q = null; try { q = JSON.parse(localStorage.getItem(OBS.KEY) || 'null'); } catch (e) { q = null; }
    const fam = typeof FAMILY !== 'undefined' ? FAMILY.famId() : '';
    if (!q || q.v !== OBS.V || !Array.isArray(q.ev) || q.fam !== fam) q = { v: OBS.V, fam, dev: (q && q.dev) || OBS.rnd(4), seq: 0, bseq: 0, ev: [], drop: 0, purgeQ: [] };   // annan familj: börja om (inget följer med)
    if (!/^[a-z0-9]{8}$/.test(q.dev)) q.dev = OBS.rnd(4);
    q.purgeQ = Array.isArray(q.purgeQ) ? q.purgeQ.slice(-20) : []; OBS.q = q; return q;
  },
  save() { const q = OBS.q; if (!q || OBS.excluded()) return;   // testläget skriver aldrig (lagringen ska vara byte för byte orörd)
    try { localStorage.setItem(OBS.KEY, JSON.stringify(q)); } catch (e) { OBS.trim(q, true); try { localStorage.setItem(OBS.KEY, JSON.stringify(q)); } catch (e2) { /* fullt: kön finns kvar i minnet */ } } },
  // Gränser: äldst först, redan uppladdade före ej uppladdade; varje borttagen ej uppladdad händelse räknas (syns i exporten)
  trim(q, hard) {
    const max = hard ? Math.floor(OBS.MAX_EV / 2) : OBS.MAX_EV; let over = q.ev.length - max;
    const size = () => JSON.stringify(q.ev).length;
    if (over > 0 || size() > OBS.MAX_CHARS) {
      const up = q.ev.filter(e => e._u); const rm = new Set(up.slice(0, Math.max(over, Math.ceil(up.length / 4))).map(e => e.i)); q.ev = q.ev.filter(e => !rm.has(e.i));
      while (q.ev.length > max || (q.ev.length && size() > OBS.MAX_CHARS)) { const e = q.ev.shift(); if (!e._u) q.drop = (q.drop || 0) + 1; }
    }
  },
  // Lagringstid och radering: per profil (pseudonym) – händelser äldre än lagringstiden, eller före en radering, tas bort
  prune(now) {
    const q = OBS.load(); const t = Math.round((now || Date.now()) / 1000); const rules = {};
    for (const kid of (typeof KIDS !== 'undefined' ? KIDS : [])) { const p = prof(kid.id); const o = OBS.cfg(p); if (!o || !o.salt) continue; const k = OBS.pseud(kid); rules[k] = { min: t - OBS.days(p) * 86400, purge: Math.round((Number(o.purge) || 0) / 1000), off: o.on !== true }; }
    const n0 = q.ev.length;
    q.ev = q.ev.filter(e => { const r = rules[e.k]; if (!r) return false; if (e.t < r.min || e.t <= r.purge) return false; if (r.off && !e._u) return false; return true; });   // avstängt: ej uppladdade släpps (laddas aldrig upp)
    if (q.ev.length !== n0) OBS.save(); return n0 - q.ev.length;
  },
  /* ---------- registrering ---------- */
  ctx() { return { b: String((typeof window !== 'undefined' && window.PLUGG_BUILD) || '').slice(0, 40), c: (typeof FAMILY !== 'undefined' && FAMILY.content && Number(FAMILY.content.updatedAt)) || 0 }; },
  record(kid, y, data) {
    try {
      if (!OBS.on(kid)) return null;
      const q = OBS.load(); const now = Date.now(); q.seq = (q.seq || 0) + 1;
      const ev = { ...data, i: `${q.dev}-${q.seq}`, y, t: Math.round(now / 1000), k: OBS.pseud(kid) };   // grundfälten sist: kan aldrig skrivas över
      q.ev.push(ev); OBS.trim(q, false); OBS.save(); return ev;
    } catch (e) { return null; }
  },
  // Pass: start, uppgift, slut. Bara Learning Engine v2-pass (S.v2) observeras i v1 av observationerna.
  sessionStart() {
    try {
      if (typeof S === 'undefined' || !S || !S.v2 || !S.kid || !OBS.on(S.kid)) { OBS.cur = null; return; }
      const V = S.v2; const vis = OBS.visible();
      OBS.cur = { sid: V.id, kid: S.kid, act: 0, t0: vis ? Date.now() : null, gapMax: 0, sub: 0, flags: { h: 0, r: 0 }, done: false };
      OBS.record(S.kid, 'ss', { s: V.id, m: String(V.mode || ''), x: String(V.exp || 'classic'), po: V.po ? 1 : 0, g: V.extra && V.extra.examId ? String(V.extra.examId).slice(0, 60) : undefined, n: V.planN || 0, ...OBS.ctx() });
    } catch (e) { /* ignore */ }
  },
  item(q, correct) {
    try {
      const c = OBS.cur; if (!c || typeof S === 'undefined' || !S || !S.v2 || S.v2.id !== c.sid) return;
      const spec = q && q.spec; if (!spec) return; c.sub++;
      const kind = typeof V2 !== 'undefined' && V2.kindOf ? V2.kindOf(q) : (q.type || q.kind || '');
      const help = S.v2.exam ? 'n' : spec.help === 'rescue' ? 'r' : S.revealed ? 's' : (S.usedHelp || spec.help === 'hint') ? 'h' : 'n';
      OBS.record(c.kid, 'it', { s: c.sid, c: String(spec.cid).slice(0, 80), f: String(kind).slice(0, 16), ok: correct ? 1 : 0, h: help, r: c.flags.r ? 1 : 0, x: String(spec.ctx || 'first').slice(0, 1), v: q.vid ? 1 : 0 });
      c.flags = { h: 0, r: 0 };
    } catch (e) { /* ignore */ }
  },
  sessionEnd(outcome) {
    try {
      const c = OBS.cur; if (!c || c.done) return; c.done = true; OBS.tick();
      const shown = c.sub + (outcome === 'exit' && typeof document !== 'undefined' && document.getElementById('qcard') && S && !S.answered ? 1 : 0);
      const tq = c.gapMax > 20 * 60000 ? 'u' : 'fg';   // u: osäker (ett obrutet intervall över 20 min – enheten kan ha legat i bakgrunden utan signal)
      OBS.record(c.kid, 'se', { s: c.sid, o: outcome, a: c.sub, p: shown, am: Math.round(c.act / 60000), tq });
      OBS.cur = null; OBS.flushSoon();
    } catch (e) { /* ignore */ }
  },
  visible() { try { return typeof document === 'undefined' || document.visibilityState !== 'hidden'; } catch (e) { return true; } },
  tick() { const c = OBS.cur; if (!c || c.t0 == null) return; const d = Math.max(0, Date.now() - c.t0); c.act += d; c.gapMax = Math.max(c.gapMax, d); c.t0 = Date.now(); },
  onVisibility() { try { const c = OBS.cur; if (!c) return; if (OBS.visible()) { if (c.t0 == null) c.t0 = Date.now(); } else { OBS.tick(); c.t0 = null; } } catch (e) { /* ignore */ } },
  // Erbjudanden att fortsätta efter dagens pass (startsidan och KLAR): en händelse när uppsättningen ändras (inte vid varje omritning)
  offers(where) {
    try {
      const kid = typeof state !== 'undefined' && state.kid && typeof kidById === 'function' ? kidById(state.kid) : null; if (!kid || !OBS.on(kid)) return;
      const p = prof(kid.id); const core = typeof EXP !== 'undefined' && EXP.on(kid) && EXP.coreDone(p); if (where === 'home' && !core) return;
      const app = document.getElementById('app'); if (!app) return; const k = {};
      const add = (sel, name) => { const n = app.querySelectorAll(sel).length; if (n) k[name] = n; };
      add('[data-v2="flow"]', 'flow'); add('[data-v2="ovamer"]', 'ovamer'); add('.upcoming [data-v2="mission"]', 'rad');
      { const n = [...app.querySelectorAll('[data-v2="mission"]')].filter(b => !b.closest('.upcoming')).length; if (n) k.mission = n; }
      if (!Object.keys(k).length) k.inget = 1;
      const sid = where === 'klar' && S && S.v2 ? S.v2.id : ''; const day = new Date().toDateString(); const sig = `${kid.id}|${where}|${sid}|${day}|${JSON.stringify(k)}`;
      if (OBS.offerSeen[sig]) return; OBS.offerSeen[sig] = 1; OBS.record(kid, 'of', { w: where, s: sid || undefined, bt: k });
    } catch (e) { /* ignore */ }
  },
  KINDS: new Set(['kor', 'flow', 'ovamer', 'mission', 'testa', 'revansch', 'extra']),
  onClick(e) {
    try {
      const t = e.target; if (!t || !t.closest) return;
      const c = OBS.cur;
      if (c && (t.closest('#hintBtn') || t.closest('#explainBtn'))) c.flags.h = 1;
      if (c && (t.closest('[data-speak]') || t.closest('[data-speak-fb]'))) c.flags.r = 1;
      const pr = typeof state !== 'undefined' && state.screen === 'practice' && typeof S !== 'undefined' && S && S.v2;
      if (c && pr && !S.v2.ended && (t.closest('[data-go]') || t.closest('[data-tm-exit]'))) OBS.sessionEnd('exit');   // uttryckligen lämnat passet
      const b = t.closest('[data-v2]'); if (!b) return; const kind = b.dataset.v2; if (!OBS.KINDS.has(kind)) return;
      const kid = typeof state !== 'undefined' && state.kid && typeof kidById === 'function' ? kidById(state.kid) : null; if (!kid || !OBS.on(kid)) return;
      const where = b.closest('.upcoming') ? 'rad' : pr && S.v2.ended ? 'klar' : state.screen === 'home' ? 'hem' : 'annat';
      const core = typeof EXP !== 'undefined' && EXP.on(kid) && EXP.coreDone(prof(kid.id));
      OBS.record(kid, 'sl', { w: where, a: kind === 'extra' ? 'kor' : kind, cd: core ? 1 : 0 });
    } catch (e2) { /* ignore */ }
  },
  error(where, e) {
    try {
      const kid = typeof S !== 'undefined' && S && S.kid ? S.kid : (typeof state !== 'undefined' && state.kid && typeof kidById === 'function' ? kidById(state.kid) : null); if (!kid || !OBS.on(kid)) return;
      const day = new Date().toDateString(); OBS.errN = OBS.errN && OBS.errN.day === day ? OBS.errN : { day, n: 0 }; if (OBS.errN.n++ >= OBS.ERR_PER_DAY) return;
      const w = String(where || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 40); const n = String((e && e.name) || 'Error').replace(/[^a-zA-Z]/g, '').slice(0, 24);
      OBS.record(kid, 'er', { w, n });   // aldrig felmeddelandet (kan innehålla text ur innehållet)
    } catch (e2) { /* ignore */ }
  },
  /* ---------- moln: små oföränderliga satser (families/{familj}/obs/{pseudonym}-{enhet}-{nr}) ---------- */
  cloudOk() { try { return typeof SYNC !== 'undefined' && SYNC.active && !SYNC.pv() && !OBS.excluded() && !OBS.cloudOff && !!SYNC.cfg; } catch (e) { return false; } },
  docBase() { return `projects/${SYNC.cfg.projectId}/databases/(default)/documents/families/${SYNC.family}/obs`; },
  docUrl(id) { return `https://firestore.googleapis.com/v1/projects/${SYNC.cfg.projectId}/databases/(default)/documents/families/${encodeURIComponent(SYNC.family)}/obs${id ? '/' + id : ''}?key=${SYNC.cfg.apiKey}`; },
  flushSoon() { try { clearTimeout(OBS._ft); OBS._ft = setTimeout(() => { OBS.flush(); }, 1500); } catch (e) { /* ignore */ } },
  async flush() {
    if (OBS.busy || !OBS.cloudOk()) return 0; OBS.busy = true; let sent = 0;
    try {
      await OBS.purgeRetry(); OBS.prune();
      const q = OBS.load(); let nb = 0;
      while (nb < OBS.MAX_BATCHES) {
        // en sats = en profil; en sats som redan fått ett id skickas om med SAMMA id (idempotent: finns den redan räknas den som skickad)
        const pend = q.ev.filter(e => !e._u); if (!pend.length) break;
        const bid = pend.find(e => e._b) ? pend.find(e => e._b)._b : null; let batch;
        if (bid) batch = q.ev.filter(e => e._b === bid && !e._u);
        else { const k = pend[0].k; q.bseq = (q.bseq || 0) + 1; const id = `${k}-${q.dev}-${q.bseq}`; batch = pend.filter(e => e.k === k).slice(0, OBS.BATCH); for (const e of batch) e._b = id; OBS.save(); }
        const id = batch[0]._b; if (!OBS.DOC_RE.test(id)) { for (const e of batch) delete e._b; break; }
        const clean = batch.map(({ _u, _b, ...e }) => e);
        const body = { writes: [{ update: { name: `${OBS.docBase()}/${id}`, fields: { json: { stringValue: JSON.stringify(clean) }, n: { integerValue: String(clean.length) }, t: { integerValue: String(Date.now()) }, k: { stringValue: batch[0].k }, v: { integerValue: String(OBS.V) } } }, currentDocument: { exists: false } }] };
        let r; try { r = await SYNC.fetch(SYNC.commitUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) { break; }   // utan nät: försök igen senare
        let st = ''; if (!r.ok) { try { st = JSON.stringify(await r.json()); } catch (e) { st = ''; } }
        if (r.ok || /ALREADY_EXISTS/.test(st) || r.status === 409) { for (const e of batch) { e._u = 1; delete e._b; } sent += batch.length; OBS.save(); nb++; continue; }
        if (r.status === 403 || /PERMISSION_DENIED/.test(st)) { OBS.cloudOff = true; break; }   // reglerna är inte publicerade (eller enheten är inte medlem): allt stannar lokalt
        break;
      }
    } catch (e) { /* ignore */ } finally { OBS.busy = false; }
    return sent;
  },
  async listCloud() { try { return await OBS.listCloud0(); } catch (e) { return null; } },   // utan nät: null (inget kastas vidare)
  async listCloud0() {
    if (!OBS.cloudOk()) return null; const out = []; let tok = '';
    for (let i = 0; i < 20; i++) {
      const r = await SYNC.fetch(OBS.docUrl('') + `&pageSize=300${tok ? '&pageToken=' + encodeURIComponent(tok) : ''}`, { cache: 'no-store' });
      if (r.status === 403) { OBS.cloudOff = true; return null; } if (!r.ok) return null; const j = await r.json();
      for (const d of j.documents || []) { const id = String(d.name || '').split('/').pop(); if (!OBS.DOC_RE.test(id)) continue; const f = d.fields || {}; let ev = []; try { ev = JSON.parse((f.json && f.json.stringValue) || '[]'); } catch (e) { ev = []; } out.push({ id, k: (f.k && f.k.stringValue) || id.slice(0, 13), t: Number((f.t && f.t.integerValue) || 0), ev: Array.isArray(ev) ? ev : [] }); }
      tok = j.nextPageToken || ''; if (!tok) break;
    }
    return out;
  },
  async delCloud(id) { if (!OBS.DOC_RE.test(id)) return false; try { const r = await SYNC.fetch(OBS.docUrl(id), { method: 'DELETE' }); return r.ok || r.status === 404; } catch (e) { return false; } },
  // Molnrensning: satser vars senaste händelse är äldre än lagringstiden, eller som skapats före en radering. Körs bara här (ingen schemaläggning).
  async cleanupCloud() {
    const docs = await OBS.listCloud(); if (!docs) return { ok: false, removed: 0 };
    const now = Math.round(Date.now() / 1000); const rules = {};
    for (const kid of KIDS) { const p = prof(kid.id); const o = OBS.cfg(p); if (!o || !o.salt) continue; rules[OBS.pseud(kid)] = { min: now - OBS.days(p) * 86400, purge: Math.round((Number(o.purge) || 0) / 1000) }; }
    let removed = 0;
    for (const d of docs) { const r = rules[d.k]; const last = Math.max(0, ...d.ev.map(e => Number(e.t) || 0)); if (!r || last < r.min || last <= r.purge) { try { if (await OBS.delCloud(d.id)) removed++; } catch (e) { /* nästa gång */ } } }
    return { ok: true, removed };
  },
  // Radera allt för valda barn: lokalt direkt, på andra enheter efter synk (settings.obs.purge), i molnet nu – eller vid nästa start om det inte gick
  async purge(kids) {
    const q = OBS.load(); const now = Date.now(); const ks = [];
    for (const kid of kids) { const p = prof(kid.id); const o = OBS.cfg(p) || {}; if (!o.salt) continue; ks.push(OBS.pseud(kid)); p.settings.obs = { ...o, purge: now, at: now }; p.settings.obsAt = now; }
    q.ev = q.ev.filter(e => !ks.includes(e.k)); for (const k of ks) q.purgeQ.push({ k, until: Math.round(now / 1000) }); OBS.save(); if (typeof save === 'function') save();
    await OBS.purgeRetry(); return ks.length;
  },
  async purgeRetry() {
    const q = OBS.load(); if (!q.purgeQ.length || !OBS.cloudOk()) return false;
    const docs = await OBS.listCloud(); if (!docs) return false; const left = [];
    for (const job of q.purgeQ) { let fail = false; for (const d of docs.filter(x => x.k === job.k)) { try { if (!(await OBS.delCloud(d.id))) fail = true; } catch (e) { fail = true; } } if (fail) left.push(job); }
    q.purgeQ = left; OBS.save(); return !left.length;
  },
  /* ---------- export (bara på förälderns uttryckliga begäran) ---------- */
  dedup(list) { const m = new Map(); for (const e of list) if (e && typeof e.i === 'string' && !m.has(e.i)) { const { _u, _b, ...x } = e; m.set(e.i, x); } return [...m.values()].sort((a, b) => a.t - b.t || (a.i < b.i ? -1 : 1)); },
  /* Sammanfattning per profil (aldrig mellan syskon). Alla tal har sin nämnare; inget tolkas. */
  summarize(events, opts = {}) {
    const from = opts.from || 0, to = opts.to || 4102444800; const ev = OBS.dedup(events).filter(e => e.t >= from && e.t <= to);
    const by = {}; for (const e of ev) (by[e.k] = by[e.k] || []).push(e);
    const day = (t) => { const d = new Date(t * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const profiles = {};
    for (const [k, list] of Object.entries(by)) {
      const ss = list.filter(e => e.y === 'ss'), se = list.filter(e => e.y === 'se'), it = list.filter(e => e.y === 'it');
      const endBy = new Map(se.map(e => [e.s, e])); const days = [...new Set(list.map(e => day(e.t)))].sort();
      const sess = { started: ss.length, completed: ss.filter(s => (endBy.get(s.s) || {}).o === 'done').length, exited: ss.filter(s => (endBy.get(s.s) || {}).o === 'exit').length };
      sess.outcomeUnknown = sess.started - sess.completed - sess.exited;
      const modes = {}; for (const s of ss) modes[s.m] = (modes[s.m] || 0) + 1;
      const offers = list.filter(e => e.y === 'of'), sels = list.filter(e => e.y === 'sl');
      const offerN = { hem: offers.filter(o => o.w === 'home' && !(o.bt || {}).inget).length, klar: offers.filter(o => o.w === 'klar' && !(o.bt || {}).inget).length, ingetAttErbjuda: offers.filter(o => (o.bt || {}).inget).length };
      const selAfterCore = {}; for (const s of sels.filter(x => x.cd)) selAfterCore[s.a] = (selAfterCore[s.a] || 0) + 1;
      const mix = {}; for (const e of it) { const m = mix[e.f] = mix[e.f] || { n: 0, ratt: 0, hjalp: 0, upplasning: 0 }; m.n++; if (e.ok) m.ratt++; if (e.h !== 'n') m.hjalp++; if (e.r) m.upplasning++; }
      const wrong = {}; for (const e of it.filter(x => !x.ok)) wrong[e.c] = (wrong[e.c] || 0) + 1;
      const goals = {}; for (const s of ss.filter(x => x.g)) { const g = goals[s.g] = goals[s.g] || { pass: 0, dagar: new Set() }; g.pass++; g.dagar.add(day(s.t)); }
      const gaps = []; for (let i = 1; i < days.length; i++) { const d = Math.round((Date.parse(days[i]) - Date.parse(days[i - 1])) / 864e5) - 1; if (d >= 2) gaps.push({ fran: days[i - 1], till: days[i], dagarUtan: d }); }
      const errs = {}; for (const e of list.filter(x => x.y === 'er')) errs[e.w] = (errs[e.w] || 0) + 1;
      const am = se.filter(e => e.tq === 'fg').map(e => e.am);
      profiles[k] = {
        observationsdagar: days.length, forstaDag: days[0] || null, sistaDag: days[days.length - 1] || null,
        pass: sess, passPerLage: modes,
        fortsattning: { erbjudanden: offerN, valEfterDagensPass: selAfterCore, notering: 'Ett erbjudande registreras när uppsättningen knappar ändras, inte vid varje visning. Val räknas per tryck.' },
        uppgifter: { inlamnade: it.length, visadeMenInteInlamnade: Math.max(0, se.reduce((a, e) => a + (e.p - e.a), 0)), perAktivitet: mix },
        felPerKoncept: Object.fromEntries(Object.entries(wrong).sort((a, b) => b[1] - a[1]).slice(0, 15)),
        malPass: Object.fromEntries(Object.entries(goals).map(([g, v]) => [g, { pass: v.pass, dagar: v.dagar.size }])),
        uppehall: gaps,
        tekniskaFel: errs,
        aktivTidMinuter: { pass: am.length, summa: am.reduce((a, b) => a + b, 0), notering: 'Bara tid med appen i förgrunden, avrundad per pass. Pass där tiden är osäker räknas inte. Säger inget om fokus, förmåga eller motivation.' },
        versioner: { app: [...new Set(ss.map(s => s.b).filter(Boolean))], innehall: [...new Set(ss.map(s => s.c).filter(Boolean))] },
      };
    }
    const caveats = ['Pseudonymt, inte anonymt: den som har enheten och appen kan koppla pseudonymen till barnet.', 'Få pass och få dagar: mönster är utforskande, inte bevis.', 'Inget i exporten visar orsak, bättre lärande eller motivation.', 'Pass utan slut-händelse har okänt utfall (appen stängd, sidan omladdad, enheten avstängd) – de räknas aldrig som avbrutna.', 'Bara Learning Engine v2-pass observeras; glosor och klassiska pass syns inte här.'];
    if (opts.drop) caveats.push(`${opts.drop} händelser föll bort ur den lokala kön (gränsen för lagring) innan de laddades upp.`);
    if (opts.localOnly) caveats.push('Molnet var inte tillgängligt (reglerna inte publicerade eller ingen anslutning): bara den här enhetens händelser är med.');
    return { schema: OBS.V, skapad: new Date().toISOString().slice(0, 10), fran: day(from), till: day(to), profiler: profiles, forbehall: caveats };
  },
  async exportData(kids, fromDay, toDay, detail) {
    const from = Math.round(Date.parse(fromDay + 'T00:00:00') / 1000), to = Math.round(Date.parse(toDay + 'T23:59:59') / 1000);
    const ks = new Set(kids.filter(k => OBS.cfg(prof(k.id)) && OBS.cfg(prof(k.id)).salt).map(k => OBS.pseud(k)));
    const q = OBS.load(); OBS.prune(); let cloud = null; try { await OBS.flush(); cloud = await OBS.listCloud(); } catch (e) { cloud = null; }
    const all = [...q.ev, ...((cloud || []).flatMap(d => d.ev))].filter(e => ks.has(e.k));
    const sum = OBS.summarize(all, { from, to, drop: q.drop || 0, localOnly: !cloud });
    const out = { ...sum, analysmall: 'Se docs/LEARNING_LOOP.md, avsnitt "Analysmall" – fakta med nämnare, saknad data, alternativa förklaringar, hypoteser, minsta nästa steg, simulering/säkerhetsgranskning, ägarens godkännande.' };
    if (detail) out.handelser = OBS.dedup(all).filter(e => e.t >= from && e.t <= to);
    return out;
  },
  download(obj, name) { try { const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return true; } catch (e) { return false; } },
  /* ---------- föräldrakortet (⚙) ---------- */
  card() {
    try {
      if (typeof TM !== 'undefined' && TM.preview) return '';
      const rows = KIDS.map(k => { const p = prof(k.id); const o = OBS.cfg(p) || {}; const on = o.on === true; return `<div class="toggle"><div><div class="tl">${esc(k.name)}</div><div class="td">${on ? `På · sparas i ${OBS.days(p)} dygn` : 'Av'}</div></div><button class="switch ${on ? 'on' : ''}" data-obs="toggle" data-obs-kid="${esc(k.id)}" aria-label="Observationer för ${esc(k.name)}"></button></div>`; }).join('');
      const anyOn = KIDS.some(k => (OBS.cfg(prof(k.id)) || {}).on === true); const d0 = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10), d1 = new Date().toISOString().slice(0, 10);
      const q = OBS.q || (() => { try { return JSON.parse(localStorage.getItem(OBS.KEY) || 'null'); } catch (e) { return null; } })();
      const local = q && Array.isArray(q.ev) ? q.ev.length : 0; const unsent = q && Array.isArray(q.ev) ? q.ev.filter(e => !e._u).length : 0;
      const days = KIDS.length ? OBS.days(prof(KIDS[0].id)) : OBS.DAYS_DEFAULT;
      return `<div class="card stack obs-card" style="gap:10px"><div class="eyebrow">Observationer (privat, av som standard)</div>
        <p style="font-size:.95rem">Om du slår på det sparar appen <b>hur</b> den används: när ett pass startar och slutar, vilka sorters uppgifter som lämnas in och om de blev rätt, om hjälp eller uppläsning användes, vad appen erbjöd efter dagens pass och vad som valdes, och tekniska fel. Det påverkar aldrig lärandet, poängen eller schemat.</p>
        <p style="font-size:.9rem" class="muted">Sparas <b>inte</b>: namn, e-post, familjekod, vad barnet skriver, ljud, bild, klickspår, svarstid eller tolkningar av känslor och förmåga. Barnet anges med en pseudonym – det är <b>inte</b> anonymt. Testa som barnet och testversionen sparas aldrig.</p>
        <p style="font-size:.9rem" class="muted"><b>Vem kan läsa:</b> varje enhet som är parkopplad med familjen (inte bara föräldern – appen har ännu ingen föräldraspärr i molnet). <b>Lagring:</b> först på enheten; i familjens privata lagring när reglerna för det är publicerade. <b>Rensning:</b> på enheten vid varje start; i molnet när en föräldraenhet öppnar det här kortet, exporterar eller raderar – det finns ingen automatisk rensning på servern. Claude ser bara det du själv exporterar och delar.</p>
        ${rows}
        <label class="row" style="justify-content:space-between;gap:8px"><span>Spara i</span><select data-obs="days" class="answer-input" style="width:auto;min-height:44px;font-size:1rem;padding:0 10px">${OBS.DAYS.map(d => `<option value="${d}" ${d === days ? 'selected' : ''}>${d} dygn</option>`).join('')}</select></label>
        <div class="muted" style="font-size:.85rem">På den här enheten: ${local} händelser${unsent ? `, ${unsent} väntar på uppladdning` : ''}${OBS.cloudOff ? ' (molnet nekade – reglerna för observationer är inte publicerade)' : ''}.</div>
        ${anyOn || local ? `<div class="stack" style="gap:6px"><div class="row" style="gap:8px;flex-wrap:wrap"><label>Från <input type="date" data-obs-from value="${d0}" class="answer-input" style="width:auto;min-height:44px;font-size:1rem;padding:0 10px"></label><label>Till <input type="date" data-obs-to value="${d1}" class="answer-input" style="width:auto;min-height:44px;font-size:1rem;padding:0 10px"></label></div>
        <label style="display:flex;gap:10px;align-items:center;min-height:44px"><input type="checkbox" data-obs-detail style="width:22px;height:22px;flex:none"> <span>Ta med enskilda händelser (annars bara sammanfattning)</span></label>
        <button class="btn secondary" data-obs="export">Exportera (fil)</button></div>` : ''}
        ${OBS.askDel ? `<div class="feedback warn"><span>⚠️</span><div><div class="big">Radera alla observationer?</div><div class="sub">På den här enheten nu, på de andra efter synk och i familjens lagring nu (eller vid nästa start om det inte går nu).</div><div class="row" style="gap:8px;margin-top:8px"><button class="btn" data-obs="delyes">Ja, radera</button><button class="btn ghost" data-obs="delno">Avbryt</button></div></div></div>` : `<button class="btn ghost" data-obs="del">Radera alla observationer</button>`}
        ${OBS.note ? `<div class="muted" role="status" style="font-size:.85rem">${esc(OBS.note)}</div>` : ''}</div>`;
    } catch (e) { return ''; }
  },
  async parentClick(el) {
    const a = el.dataset.obs; OBS.note = '';
    if (a === 'toggle') { const kid = kidById(el.dataset.obsKid); if (!kid) return; const p = prof(kid.id); const o = OBS.cfg(p) || {}; const now = Date.now(); p.settings.obs = { ...o, on: o.on !== true, salt: o.salt || OBS.rnd(16), days: OBS.days(p), at: now }; p.settings.obsAt = now; if (typeof save === 'function') save(); OBS.prune(); OBS.note = p.settings.obs.on ? `Observationer på för ${kid.name}.` : `Av för ${kid.name}. Inget nytt sparas, och det som inte laddats upp släpps.`; }
    else if (a === 'del') OBS.askDel = true;
    else if (a === 'delno') OBS.askDel = false;
    else if (a === 'delyes') { OBS.askDel = false; const n = await OBS.purge(KIDS); OBS.note = `Raderat för ${n} ${n === 1 ? 'barn' : 'barn'} på den här enheten${OBS.load().purgeQ.length ? ' – i molnet görs det när enheten är ansluten' : ''}.`; }
    else if (a === 'export') { const f = document.querySelector('[data-obs-from]'), t = document.querySelector('[data-obs-to]'), d = document.querySelector('[data-obs-detail]'); const from = (f && f.value) || new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10), to = (t && t.value) || new Date().toISOString().slice(0, 10);
      const out = await OBS.exportData(KIDS, from, to, !!(d && d.checked)); OBS.lastExport = out; OBS.note = OBS.download(out, `pluggappen-observationer-${from}-${to}.json`) ? 'Exporten är sparad som fil. Dela den bara om du själv vill.' : 'Exporten kunde inte sparas som fil på den här enheten.'; }
    if (typeof VIEWS !== 'undefined' && state.screen === 'parent') VIEWS.parent();
  },
  onChange(e) { try { const el = e.target; if (el && el.dataset && el.dataset.obs === 'days') { const d = Number(el.value); if (!OBS.DAYS.includes(d)) return; const now = Date.now(); for (const k of KIDS) { const p = prof(k.id); const o = OBS.cfg(p); if (o) { p.settings.obs = { ...o, days: d, at: now }; p.settings.obsAt = now; } } if (typeof save === 'function') save(); OBS.prune(); OBS.note = `Sparas i högst ${d} dygn.`; if (state.screen === 'parent') VIEWS.parent(); } } catch (e2) { /* ignore */ } },
  /* ---------- koppling till appen (bara omslag – appens egna funktioner ändras inte) ---------- */
  install() {
    if (OBS.installed || typeof V2 === 'undefined') return; OBS.installed = true;
    const wrap = (obj, name, after) => { const f = obj && obj[name]; if (typeof f !== 'function') return; obj[name] = function (...a) { const r = f.apply(this, a); try { after.apply(this, [r, ...a]); } catch (e) { /* ignore */ } return r; }; };
    const start0 = V2.start;   // ett nytt pass = ett nytt S.v2-objekt (pass-id kan vara lika mellan barn: räknaren är per profil)
    V2.start = function (...a) { const pre = typeof S !== 'undefined' && S ? S.v2 : null; const r = start0.apply(this, a); try { if (S && S.v2 && S.v2 !== pre) OBS.sessionStart(); } catch (e) { /* ignore */ } return r; };
    wrap(V2, 'observe', (r, q, correct) => OBS.item(q, correct));
    wrap(V2, 'observeWord', (r, ex, correct) => { if (ex && ex.spec && ex._slotEnd) OBS.item(ex, correct); });
    const fin0 = V2.finish; V2.finish = function (...a) { const c = OBS.cur; const r = fin0.apply(this, a); try { if (c && !c.done) OBS.sessionEnd('done'); OBS.offers('klar'); } catch (e) { /* ignore */ } return r; };
    wrap(V2, 'fail', (r, where, e) => OBS.error(where, e));
    if (typeof VIEWS !== 'undefined') wrap(VIEWS, 'home', () => OBS.offers('home'));
    if (typeof VIEWS !== 'undefined' && typeof VIEWS.parent === 'function') wrap(VIEWS, 'parent', () => { if (state.tab === 'settings' && !OBS._clean) { OBS._clean = true; OBS.cleanupCloud().catch(() => {}); } });
    try { document.addEventListener('click', OBS.onClick, true); document.addEventListener('change', OBS.onChange, true); document.addEventListener('visibilitychange', OBS.onVisibility);
      document.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('[data-obs]'); if (b && b.tagName === 'BUTTON') { e.stopPropagation(); OBS.parentClick(b); } }, true);
      window.addEventListener('online', () => OBS.flushSoon()); } catch (e) { /* ignore */ }
    try { OBS.prune(); setTimeout(() => OBS.flush(), 5000); } catch (e) { /* ignore */ }
  },
};
if (typeof module !== 'undefined') module.exports = { OBS };
OBS.install();
