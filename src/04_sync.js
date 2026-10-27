/* ========= Cloud sync (only active in the self-hosted build with window.PLUGG_SYNC set) =========
   Data model: one Firestore document per child: families/{familyCode}/profiles/{kidId}
   fields: json (stringValue = the profile), updatedAt (integerValue, ms).
   3.2.1 (synkens integritet): en skrivning är ALLTID villkorad på den version enheten senast hämtade (currentDocument.updateTime /
   exists=false). Har någon annan hunnit skriva nekar servern; enheten hämtar, slår ihop och försöker igen (högst tre gånger per
   omgång, sedan nya omgångar med växande paus). Ingen blind skrivning av en hel profil över nyare data. Sammanslagningen är
   trevägs mot den senast kända serverversionen (DB.syncBase: kontrollsummor per fält och id-listor), så att en ändring eller
   radering på en annan enhet inte skrivs över av en enhet som inte rört just det. Inget tas ur kön förrän skrivningen bekräftats.
   All requests go through SYNC.fetch, which adds the device's Firebase ID token when AUTH is available (see 04b_auth.js). */
// Fält som bara beskriver synken (ingår inte i trevägsjämförelsen)
const SYNC_META = new Set(['syncedAt', 'updatedAt', 'since', '_lx', '_lg']);
const SYNC = {
  fetch(url, opts) { return (typeof AUTH !== 'undefined' && AUTH.ready) ? AUTH.fetch(url, opts) : fetch(url, opts); },
  cfg: (typeof window !== 'undefined' && window.PLUGG_SYNC && window.PLUGG_SYNC.projectId && window.PLUGG_SYNC.apiKey) ? window.PLUGG_SYNC : null,
  get family() { return (DB.settings.family || '').trim(); },
  get active() { return !!(SYNC.cfg && SYNC.family) && !(typeof TM !== 'undefined' && TM.on); },   // Testa som barnet: ingen synk alls under testet
  // Testadressen (<sajten>/preview/, scripts/build.sh): förälderns testmiljö. Barnprofilerna där är en spegel av familjens data –
  // den hämtar men laddar aldrig upp (nätverksskyddet i testsidan nekar dessutom varje skrivning till profiles/).
  pv() { return typeof window !== 'undefined' && window.PLUGG_PREVIEW === true && window.__PV_LS === true; },
  status: 'off', lastError: null, pushTimer: null, pending: new Set(), lastPull: {}, docTime: {}, busy: false, again: false, retryN: 0, retryTimer: null,
  url(kidId) { return `https://firestore.googleapis.com/v1/projects/${SYNC.cfg.projectId}/databases/(default)/documents/families/${encodeURIComponent(SYNC.family)}/profiles/${kidId}?key=${SYNC.cfg.apiKey}`; },
  async pull(kidId) {
    if (!SYNC.active) return null;
    try {
      const r = await SYNC.fetch(SYNC.url(kidId), { cache: 'no-store' });
      if (r.status === 404) { SYNC.status = 'ok'; SYNC.docTime[kidId] = false; return null; }   // docTime: dokumentets version vid senaste hämtningen (false = finns inte)
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const doc = await r.json(); SYNC.docTime[kidId] = doc.updateTime || null; const json = doc.fields?.json?.stringValue; const updatedAt = Number(doc.fields?.updatedAt?.integerValue || 0);
      if (!json) return null;
      SYNC.status = 'ok'; SYNC.lastError = null;
      return { profile: JSON.parse(json), updatedAt, updateTime: doc.updateTime || null, serverTime: doc.updateTime ? Date.parse(doc.updateTime) : 0 };
    } catch (e) { SYNC.status = 'error'; SYNC.lastError = e.message; return null; }
  },
  // Villkorad skrivning. pre = den version skrivningen gäller (standard: den senast hämtade); okänd version → ingen skrivning.
  // Svar: true (skrivet), 'conflict' (dokumentet har ändrats/versionen okänd – hämta, slå ihop, försök igen) eller false (fel/utan nät).
  async push(kidId, pre) {
    if (SYNC.pv()) return false;   // testadressen laddar aldrig upp barnens data
    if (typeof V2 !== 'undefined' && V2.sandbox && V2.sandbox.kidId === kidId) return; // granskning H2: förhandsvisningen laddas aldrig upp
    if (!SYNC.active) return false;
    if (pre === undefined) pre = SYNC.docTime[kidId];
    if (pre === undefined || pre === null) return 'conflict';   // aldrig en blind skrivning: hämta först
    const p = prof(kidId); const updatedAt = p.updatedAt || Date.now(); const sentJson = JSON.stringify(p); const sent = JSON.parse(sentJson);
    try {
      const body = { fields: { json: { stringValue: sentJson }, updatedAt: { integerValue: String(updatedAt) }, kid: { stringValue: kidId } } };
      const cond = pre === false ? '&currentDocument.exists=false' : '&currentDocument.updateTime=' + encodeURIComponent(pre);
      const r = await SYNC.fetch(SYNC.url(kidId) + '&mask.fieldPaths=updatedAt' + cond, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) {
        let st = ''; try { const j = await r.json(); st = (j && j.error && j.error.status) || ''; } catch (e) { /* inget svar */ }
        if (r.status === 409 || r.status === 412 || ((r.status === 400 || r.status === 404) && /FAILED_PRECONDITION|NOT_FOUND|ALREADY_EXISTS|ABORTED/.test(st))) { delete SYNC.docTime[kidId]; SYNC.status = 'ok'; return 'conflict'; }
        throw new Error('HTTP ' + r.status);
      }
      SYNC.status = 'ok'; SYNC.lastError = null;
      const q = prof(kidId);   // profilen kan ha ersatts (hämtning) eller ändrats under skrivningen
      if (q === p && (q.updatedAt || 0) === updatedAt) { q.syncedAt = updatedAt; q.since = { xp: 0, gems: 0, days: {} }; q._lx = q.xp; q._lg = q.gems; }
      else if (q === p) { q.syncedAt = updatedAt; const s0 = sent.since || {}, s1 = q.since || {}; const days = {};
        for (const [k, d] of Object.entries(s1.days || {})) { const o = (s0.days || {})[k] || {}; const n = { n: (d.n || 0) - (o.n || 0), c: (d.c || 0) - (o.c || 0), xp: (d.xp || 0) - (o.xp || 0) }; if (n.n > 0 || n.c > 0 || n.xp > 0) days[k] = n; }
        q.since = { xp: Math.max(0, (s1.xp || 0) - (s0.xp || 0)), gems: (s1.gems || 0) - (s0.gems || 0), days }; }   // ändrat under tiden: bara det som skickats räknas som synkat
      let doc = null; try { doc = await r.json(); } catch (e) { /* inget svar */ }
      SYNC.setBase(kidId, sent, doc && doc.updateTime); try { localStorage.setItem(STORE_KEY, dbJSON()); } catch (e) { /* ignore */ }
      try { if (doc && doc.updateTime) { SYNC.docTime[kidId] = doc.updateTime; if (typeof LE !== 'undefined') LE.anchor(kidId, Date.parse(doc.updateTime), true); } else delete SYNC.docTime[kidId]; } catch (e) { delete SYNC.docTime[kidId]; }
      return true;
    } catch (e) { SYNC.status = 'error'; SYNC.lastError = e.message; return false; }
  },
  dirty(kidId) { const q = prof(kidId); return !!(q && (q.updatedAt || 0) > (q.syncedAt || 0)); },
  // Hämta → slå ihop → villkorad skrivning, högst tre försök. true = inget kvar att skriva.
  async sync1(kidId) {
    for (let i = 0; i < 3; i++) {
      if (i > 0 || SYNC.docTime[kidId] === undefined || SYNC.docTime[kidId] === null) { await SYNC.refresh(kidId, true); if (SYNC.status !== 'ok' || SYNC.docTime[kidId] === undefined) return false; }
      if (!SYNC.dirty(kidId) && SYNC.docTime[kidId] !== false) return true;   // (finns inte i familjens data än: skapas)
      const r = await SYNC.push(kidId); if (r === true) { if (!SYNC.dirty(kidId)) return true; i = -1; continue; }   // ändrat under skrivningen: en omgång till
      if (r !== 'conflict') return false;
    }
    return false;
  },
  // Kör kön: en i taget. Ett id lämnar kön först när skrivningen bekräftats (eller inget finns att skriva).
  flush() {
    if (SYNC.busy) { SYNC.again = true; return SYNC.busyP; }
    if (!SYNC.active || SYNC.pv() || !SYNC.pending.size) return Promise.resolve();
    clearTimeout(SYNC.pushTimer); SYNC.busy = true;
    SYNC.busyP = (async () => {
      let failed = false;
      try {
        do { SYNC.again = false; failed = false;
          for (const id of [...SYNC.pending]) { if (!SYNC.active) break; const ok = await SYNC.sync1(id); if (ok && !SYNC.dirty(id)) SYNC.pending.delete(id); else if (!ok) failed = true; }
        } while (SYNC.again && !failed && SYNC.pending.size);
      } finally { SYNC.busy = false; }
      if (SYNC.pending.size) SYNC.retryLater(failed); else { SYNC.retryN = 0; clearTimeout(SYNC.retryTimer); }
      SYNC.render();
    })();
    return SYNC.busyP;
  },
  retryLater(failed) { clearTimeout(SYNC.retryTimer); const waits = [5000, 15000, 60000, 120000]; const ms = failed ? waits[Math.min(SYNC.retryN++, waits.length - 1)] : 1500; SYNC.retryTimer = setTimeout(() => SYNC.flush(), ms); },
  schedulePush(kidId) { if (!SYNC.active || !kidId || SYNC.pv()) return; SYNC.pending.add(kidId); clearTimeout(SYNC.pushTimer); SYNC.pushTimer = setTimeout(() => SYNC.flush(), 1500); },
  // Senast kända serverversion per barn (trevägssammanslagning): kontrollsummor per fält och inställning, id-listor för det som kan raderas.
  hash(v) { const s = JSON.stringify(v === undefined ? null : v); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + ':' + s.length; },
  snap(p) { if (!p) return null; const h = {}; for (const [k, v] of Object.entries(p)) if (!SYNC_META.has(k)) h[k] = SYNC.hash(v); const s = {}; for (const [k, v] of Object.entries(p.settings || {})) s[k] = SYNC.hash(v);
    const ids = (arr) => (arr || []).map(x => x && typeof x === 'object' ? x.id : x).filter(x => x != null);
    const per = (arr) => Object.fromEntries((arr || []).filter(x => x && x.id != null).map(x => [x.id, SYNC.hash(x)]));
    return { v: 1, h, s, exams: per(p.exams), decks: per(p.decks), enabledDecks: ids(p.enabledDecks), removedDefaults: ids(p.removedDefaults) }; },
  setBase(kidId, p, t) { if (!DB.syncBase || typeof DB.syncBase !== 'object') DB.syncBase = {}; const b = SYNC.snap(p); if (b) b.t = t || null; DB.syncBase[kidId] = b; },
  baseOf(kidId) { const b = DB.syncBase && DB.syncBase[kidId]; return b && b.v === 1 ? b : null; },
  // Pull remote for a kid and merge into local. Returns true if local changed.
  async refresh(kidId, inFlush) {   // inFlush: anropad av kön (som själv skriver) – lägg inte till i kön igen
    if (typeof V2 !== 'undefined' && V2.sandbox && V2.sandbox.kidId === kidId) return false; // förälderns förhandsvisning pågår
    const remote = await SYNC.pull(kidId); SYNC.lastPull[kidId] = Date.now();
    if (typeof V2 !== 'undefined' && V2.sandbox && V2.sandbox.kidId === kidId) return false; // förhandsvisningen startade medan hämtningen pågick
    if (SYNC.pv()) return remote && !(typeof TM !== 'undefined' && TM.on) ? SYNC.mirror(kidId, remote, true) : false;   // testadressen: familjens data gäller alltid
    if (!remote) { if (!inFlush && SYNC.active && SYNC.status === 'ok') SYNC.schedulePush(kidId); return false; }
    const local = prof(kidId); const base = SYNC.baseOf(kidId);
    // Tombstone: a parent deleted this child's data on another device → reset here instead of re-uploading our copy.
    if (remote.profile.resetAt && remote.profile.resetAt > (local.resetAt || 0)) { const fresh = { ...defaultProfile(kidId), resetAt: remote.profile.resetAt, syncedAt: remote.updatedAt, updatedAt: remote.updatedAt }; fresh._lx = fresh.xp; fresh._lg = fresh.gems; DB.profiles[kidId] = fresh; rollover(fresh); SYNC.setBase(kidId, remote.profile, remote.updateTime); try { localStorage.setItem(STORE_KEY, dbJSON()); } catch (e) { /* ignore */ } return true; }
    // Har vi redan den här versionen? Med en känd serverversion avgör serverns tid (updateTime) – aldrig enheternas klockor, som kan gå fel.
    const localChanged = (local.updatedAt || 0) > (local.syncedAt || 0);
    if (base && base.t && remote.updateTime ? base.t === remote.updateTime : (local.syncedAt || 0) >= remote.updatedAt) { if (!base && !localChanged) { SYNC.setBase(kidId, remote.profile, remote.updateTime); try { localStorage.setItem(STORE_KEY, dbJSON()); } catch (e) { /* ignore */ } } return false; }
    const merged = localChanged ? mergeProfiles(local, remote.profile, base) : { ...defaultProfile(kidId), ...remote.profile, since: { xp: 0, gems: 0, days: {} } };
    // Fas 3B: v2-bevisloggen slås alltid ihop (union), även när lokalt inte ändrats – skyddar mot att en äldre app skrivit över den.
    let leRestored = false;
    if (!localChanged && (local.le || remote.profile.le) && typeof LE !== 'undefined') { merged.le = LE.mergeLE(local.le, remote.profile.le); leRestored = !!(merged.le && (merged.le.log || []).length > ((remote.profile.le || {}).log || []).length); }
    // leRestored: markera bara som lokalt ändrad – laddas upp vid nästa vanliga sparning (ingen extra uppladdning som kan krocka med en annan enhet)
    merged.syncedAt = remote.updatedAt; merged.updatedAt = localChanged ? Math.max(Date.now(), remote.updatedAt + 1) : leRestored ? Math.max(Date.now(), remote.updatedAt + 1) : remote.updatedAt; merged._lx = merged.xp; merged._lg = merged.gems;
    DB.profiles[kidId] = merged; rollover(merged); SYNC.setBase(kidId, remote.profile, remote.updateTime);
    try { localStorage.setItem(STORE_KEY, dbJSON()); } catch (e) { /* ignore */ }
    if (typeof LE !== 'undefined') { LE.invalidate(kidId); if (remote.serverTime) LE.anchor(kidId, remote.serverTime); }
    if (localChanged && !inFlush) SYNC.schedulePush(kidId);
    return true;
  },
  // Testadressen: ersätt den lokala kopian med familjens data (ingen sammanslagning – inget lokalt får bli kvar eller laddas upp).
  // lazy: hoppa över när kopian redan är exakt den versionen och inte ändrats lokalt.
  mirror(kidId, remote, lazy) {
    const local = prof(kidId);
    const clean = local && (local.updatedAt || 0) <= (local.syncedAt || 0);
    if (lazy && clean && (local.syncedAt || 0) >= remote.updatedAt) return false;   // redan den versionen (eller nyare: ett sent svar rullar aldrig tillbaka)
    const m = { ...defaultProfile(kidId), ...remote.profile, since: { xp: 0, gems: 0, days: {} } }; m.syncedAt = remote.updatedAt; m.updatedAt = remote.updatedAt; m._lx = m.xp; m._lg = m.gems;
    DB.profiles[kidId] = m; rollover(m); try { localStorage.setItem(STORE_KEY, dbJSON()); } catch (e) { /* ignore */ }
    if (typeof LE !== 'undefined') { LE.invalidate(kidId); if (remote.serverTime) LE.anchor(kidId, remote.serverTime); }
    return true;
  },
  async refreshAll() { let changed = false; for (const k of KIDS) if (await SYNC.refresh(k.id)) changed = true; SYNC.render(); return changed; },
  render() { const el = document.getElementById('syncState'); if (el) el.innerHTML = SYNC.badge(); },
  badge() {
    if (!SYNC.cfg) return '';
    if (!SYNC.family) return `<span class="pill warn">Synk: ingen familjekod</span>`;
    return SYNC.status === 'error' ? `<span class="pill bad" title="${esc(SYNC.lastError || '')}">Synk: fel – sparar lokalt</span>` : SYNC.pending.size ? `<span class="pill">Synkar…</span>` : `<span class="pill good">Synk på</span>`;
  },
};
// a = enhetens profil (med osynkade ändringar), b = familjens data. base (3.2.1) = senast kända serverversion: det som inte ändrats
// här sedan dess tas från familjens data (även raderingar). Utan base: som förut (inget kan försvinna, men en radering kan komma tillbaka).
const MERGED_KEYS = new Set(['xp', 'gems', 'streak', 'lastDay', 'freezes', 'sessions', 'perfect', 'skills', 'words', 'days', 'weekCorrect', 'resetAt', 'badges', 'unlocked', 'decks', 'exams', 'enabledDecks', 'removedDefaults', 'tests', 'blitz', 'quests', 'settings', 'mistakes', 'mistakesCleared', 'v3', 'le']);
function mergeProfiles(a, b, base) {
  const out = { ...defaultProfile(a.kidId || b.kidId || 'x'), ...b, ...a };
  const since = a.since || { xp: 0, gems: 0, days: {} };
  out.xp = Math.max((b.xp || 0) + (since.xp || 0), a.xp || 0); out.gems = Math.max((b.gems || 0) + (since.gems || 0), 0); out.streak = Math.max(a.streak || 0, b.streak || 0);
  out.lastDay = [a.lastDay, b.lastDay].filter(Boolean).sort().pop() || null;
  out.freezes = Math.max(a.freezes || 0, b.freezes || 0); out.sessions = Math.max(a.sessions || 0, b.sessions || 0); out.perfect = Math.max(a.perfect || 0, b.perfect || 0);
  out.skills = { ...(b.skills || {}) }; for (const [id, s] of Object.entries(a.skills || {})) { const o = out.skills[id]; out.skills[id] = !o || s.att >= o.att ? s : o; }
  out.words = { ...(b.words || {}) }; for (const [id, w] of Object.entries(a.words || {})) { const o = out.words[id]; out.words[id] = !o || w.seen >= o.seen ? w : o; }
  out.days = { ...(b.days || {}) }; for (const [k, d] of Object.entries(a.days || {})) { const o = out.days[k]; const sd = (since.days || {})[k]; out.days[k] = !o ? d : sd ? { n: o.n + sd.n, c: o.c + sd.c, xp: o.xp + sd.xp, w: Math.max(o.w || 0, d.w || 0) } : { n: Math.max(o.n, d.n), c: Math.max(o.c, d.c), xp: Math.max(o.xp, d.xp), w: Math.max(o.w || 0, d.w || 0) }; }
  const wk = weekKey(); out.weekCorrect = Object.entries(out.days).filter(([k]) => k >= wk).reduce((acc, [, d]) => acc + d.c, 0);
  out.since = since; out.resetAt = Math.max(a.resetAt || 0, b.resetAt || 0) || undefined;
  out.badges = [...new Set([...(a.badges || []), ...(b.badges || [])])]; out.unlocked = [...new Set([...(a.unlocked || []), ...(b.unlocked || [])])];
  const byId = (arr) => Object.fromEntries((arr || []).map(x => [x.id, x]));
  out.decks = Object.values({ ...byId(b.decks), ...byId(a.decks) }); out.exams = Object.values({ ...byId(b.exams), ...byId(a.exams) });
  if (base) for (const key of ['exams', 'decks']) {   // trevägs per post: raderat på någon sida → borta; oförändrat här → familjens version
    const bh = base[key] && typeof base[key] === 'object' && !Array.isArray(base[key]) ? base[key] : {}; const A = byId(a[key]), B = byId(b[key]);
    out[key] = out[key].filter(x => !(x.id in bh && (!(x.id in A) || !(x.id in B)))).map(x => x.id in A && x.id in B && SYNC.hash(A[x.id]) === bh[x.id] ? B[x.id] : x);
  }
  out.enabledDecks = [...new Set([...(a.enabledDecks || []), ...(b.enabledDecks || [])])].filter(id => !(a.removedDefaults || []).includes(id) && !(b.removedDefaults || []).includes(id));
  out.removedDefaults = [...new Set([...(a.removedDefaults || []), ...(b.removedDefaults || [])])];
  if (base) {   // trevägs mängd: med om båda har den, eller om den lagts till på en sida (inte fanns i basen); borttagen på en sida → borta
    const set3 = (key) => { const A = new Set(a[key] || []), B = new Set(b[key] || []), O = new Set(base[key] || []); return [...new Set([...(b[key] || []), ...(a[key] || [])])].filter(x => (A.has(x) && B.has(x)) || (A.has(x) && !O.has(x)) || (B.has(x) && !O.has(x))); };
    out.removedDefaults = set3('removedDefaults'); out.enabledDecks = set3('enabledDecks').filter(id => !out.removedDefaults.includes(id));
  }
  out.tests = [...(a.tests || []), ...(b.tests || [])].filter((t, i, arr) => arr.findIndex(x => x.date === t.date && x.score === t.score && x.ms === t.ms) === i).sort((x, y) => x.date.localeCompare(y.date)).slice(-30);
  out.blitz = { ...(b.blitz || {}) }; for (const [k, v] of Object.entries(a.blitz || {})) out.blitz[k] = Math.max(v, out.blitz[k] || 0);
  const q = [a.quests, b.quests].filter(Boolean).sort((x, y) => (x.date || '').localeCompare(y.date || '')).pop(); out.quests = q || null;
  if (a.quests && b.quests && a.quests.date === b.quests.date) out.quests = { date: a.quests.date, items: a.quests.items.map((it, i) => { const o = b.quests.items[i]; return !o ? it : { ...it, progress: Math.max(it.progress, o.progress), done: it.done || o.done, claimed: it.claimed || o.claimed }; }) };
  out.pet = a.pet || b.pet; out.settings = { ...(b.settings || {}), ...(a.settings || {}) };
  if (base) {   // trevägs per inställning och per övrigt fält: oförändrat här sedan basen → familjens värde (även borttaget)
    const sa = a.settings || {}, sb = b.settings || {}, none = SYNC.hash(undefined);
    for (const k of new Set([...Object.keys(sa), ...Object.keys(sb)])) if (SYNC.hash(sa[k]) === ((base.s || {})[k] || none)) { if (sb[k] === undefined) delete out.settings[k]; else out.settings[k] = sb[k]; }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (MERGED_KEYS.has(k) || SYNC_META.has(k)) continue; if (SYNC.hash(a[k]) === ((base.h || {})[k] || none)) { if (b[k] === undefined) delete out[k]; else out[k] = b[k]; } }
  }
  // Granskning H1: förälderns motorval och policy följer SENASTE ändringen (egen tidsstämpel), inte "lokal enhet vinner" –
  // annars kunde en barnenhet med osynkade ändringar slå på v2 igen efter att föräldern stängt av den.
  // v3: upplevelsen (Explore/Grow/Achieve/Klassisk, settings.exp/expAt) följer samma regel.
  for (const k of ['engine', 'lePolicy', 'exp', 'scope']) { const sa = a.settings || {}, sb = b.settings || {}; if ((sb[k + 'At'] || 0) > (sa[k + 'At'] || 0)) { if (sb[k] === undefined) delete out.settings[k]; else out.settings[k] = sb[k]; out.settings[k + 'At'] = sb[k + 'At']; } }
  // Två motorval inom tio minuter som säger olika (t.ex. en förälderenhet vars klocka går fel): välj det säkra läget v1.
  { const sa = a.settings || {}, sb = b.settings || {}; if (sa.engineAt && sb.engineAt && sa.engine !== sb.engine && Math.abs(sa.engineAt - sb.engineAt) < 600000) { out.settings.engine = 'v1'; out.settings.engineAt = Math.max(sa.engineAt, sb.engineAt); } }
  // Felboken (v1): union av båda enheternas poster minus det som klarats (gravstenar). Tidigare skrev den lokala listan över den andra.
  const cleared = { ...(b.mistakesCleared || {}) }; for (const [id, t] of Object.entries(a.mistakesCleared || {})) cleared[id] = Math.max(cleared[id] || 0, t);
  const keep = Object.keys(cleared).sort((x, y) => cleared[y] - cleared[x]).slice(0, 300); const cl = Object.fromEntries(keep.map(k => [k, cleared[k]]));
  const mm = new Map(); for (const x of [...(b.mistakes || []), ...(a.mistakes || [])]) { const o = mm.get(x.id); if (!o || (x.at || 0) > (o.at || 0)) mm.set(x.id, x); }
  out.mistakes = [...mm.values()].filter(x => !((cl[x.id] || 0) >= (x.at || 0))).sort((x, y) => (x.at || 0) - (y.at || 0) || (x.id < y.id ? -1 : 1)).slice(-60);
  if (Object.keys(cl).length) out.mistakesCleared = cl; else delete out.mistakesCleared;
  // Fas 3B: v2-bevislogg (union på enhet:löpnummer, deterministisk bas)
  // Experience v3: barnets egna stegval vid jämförelse med lösningen (bara visning) – union på dygn|koncept|uppgift, högst 40
  if (a.v3 || b.v3) { const m = new Map(); for (const x of [...((b.v3 && b.v3.sc) || []), ...((a.v3 && a.v3.sc) || [])]) if (Array.isArray(x) && x.length >= 4) { const k = x[0] + '|' + x[1] + '|' + x[2]; const o = m.get(k); if (!o || JSON.stringify(x) > JSON.stringify(o)) m.set(k, x); } out.v3 = { v: 1, sc: [...m.values()].sort((x, y) => x[0] - y[0] || (String(x[1]) + x[2] < String(y[1]) + y[2] ? -1 : 1)).slice(-40) }; }   // deterministisk ordning på alla enheter; samma nyckel: deterministiskt val (granskning)
  if (a.le || b.le) out.le = typeof LE !== 'undefined' ? LE.mergeLE(a.le, b.le) : (a.le || b.le);
  return out;
}
// 3.2.1: nätet tillbaka eller appen visas igen → det som väntar i kön skrivs (hämta → slå ihop → villkorad skrivning)
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('online', () => { if (SYNC.pending.size) SYNC.flush(); });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && SYNC.pending.size) SYNC.flush(); });
}
