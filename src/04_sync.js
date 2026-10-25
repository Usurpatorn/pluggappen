/* ========= Cloud sync (only active in the self-hosted build with window.PLUGG_SYNC set) =========
   Data model: one Firestore document per child: families/{familyCode}/profiles/{kidId}
   fields: json (stringValue = the profile), updatedAt (integerValue, ms). Last-writer-wins with field-level merge.
   All requests go through SYNC.fetch, which adds the device's Firebase ID token when AUTH is available (see 04b_auth.js). */
const SYNC = {
  fetch(url, opts) { return (typeof AUTH !== 'undefined' && AUTH.ready) ? AUTH.fetch(url, opts) : fetch(url, opts); },
  cfg: (typeof window !== 'undefined' && window.PLUGG_SYNC && window.PLUGG_SYNC.projectId && window.PLUGG_SYNC.apiKey) ? window.PLUGG_SYNC : null,
  get family() { return (DB.settings.family || '').trim(); },
  get active() { return !!(SYNC.cfg && SYNC.family); },
  status: 'off', lastError: null, pushTimer: null, pending: new Set(), lastPull: {},
  url(kidId) { return `https://firestore.googleapis.com/v1/projects/${SYNC.cfg.projectId}/databases/(default)/documents/families/${encodeURIComponent(SYNC.family)}/profiles/${kidId}?key=${SYNC.cfg.apiKey}`; },
  async pull(kidId) {
    if (!SYNC.active) return null;
    try {
      const r = await SYNC.fetch(SYNC.url(kidId), { cache: 'no-store' });
      if (r.status === 404) { SYNC.status = 'ok'; return null; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const doc = await r.json(); const json = doc.fields?.json?.stringValue; const updatedAt = Number(doc.fields?.updatedAt?.integerValue || 0);
      if (!json) return null;
      SYNC.status = 'ok'; SYNC.lastError = null;
      return { profile: JSON.parse(json), updatedAt };
    } catch (e) { SYNC.status = 'error'; SYNC.lastError = e.message; return null; }
  },
  async push(kidId) {
    if (!SYNC.active) return false;
    const p = prof(kidId); const updatedAt = p.updatedAt || Date.now();
    try {
      const body = { fields: { json: { stringValue: JSON.stringify(p) }, updatedAt: { integerValue: String(updatedAt) }, kid: { stringValue: kidId } } };
      const r = await SYNC.fetch(SYNC.url(kidId), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      SYNC.status = 'ok'; SYNC.lastError = null; p.syncedAt = updatedAt; p.since = { xp: 0, gems: 0, days: {} }; p._lx = p.xp; p._lg = p.gems; return true;
    } catch (e) { SYNC.status = 'error'; SYNC.lastError = e.message; return false; }
  },
  schedulePush(kidId) { if (!SYNC.active || !kidId) return; SYNC.pending.add(kidId); clearTimeout(SYNC.pushTimer); SYNC.pushTimer = setTimeout(async () => { const ids = [...SYNC.pending]; SYNC.pending.clear(); for (const id of ids) await SYNC.push(id); SYNC.render(); }, 1500); },
  // Pull remote for a kid and merge into local. Returns true if local changed.
  async refresh(kidId) {
    const remote = await SYNC.pull(kidId); SYNC.lastPull[kidId] = Date.now();
    if (!remote) { if (SYNC.active && SYNC.status === 'ok') SYNC.schedulePush(kidId); return false; }
    const local = prof(kidId);
    // Tombstone: a parent deleted this child's data on another device → reset here instead of re-uploading our copy.
    if (remote.profile.resetAt && remote.profile.resetAt > (local.resetAt || 0)) { const fresh = { ...defaultProfile(kidId), resetAt: remote.profile.resetAt, syncedAt: remote.updatedAt, updatedAt: remote.updatedAt }; fresh._lx = fresh.xp; fresh._lg = fresh.gems; DB.profiles[kidId] = fresh; rollover(fresh); try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { /* ignore */ } return true; }
    if ((local.syncedAt || 0) >= remote.updatedAt) return false; // we already have this version
    const localChanged = (local.updatedAt || 0) > (local.syncedAt || 0);
    const merged = localChanged ? mergeProfiles(local, remote.profile) : { ...defaultProfile(kidId), ...remote.profile, since: { xp: 0, gems: 0, days: {} } };
    merged.syncedAt = remote.updatedAt; merged.updatedAt = localChanged ? Date.now() : remote.updatedAt; merged._lx = merged.xp; merged._lg = merged.gems;
    DB.profiles[kidId] = merged; rollover(merged);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { /* ignore */ }
    if (localChanged) SYNC.schedulePush(kidId);
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
function mergeProfiles(a, b) {
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
  out.enabledDecks = [...new Set([...(a.enabledDecks || []), ...(b.enabledDecks || [])])].filter(id => !(a.removedDefaults || []).includes(id) && !(b.removedDefaults || []).includes(id));
  out.removedDefaults = [...new Set([...(a.removedDefaults || []), ...(b.removedDefaults || [])])];
  out.tests = [...(a.tests || []), ...(b.tests || [])].filter((t, i, arr) => arr.findIndex(x => x.date === t.date && x.score === t.score && x.ms === t.ms) === i).sort((x, y) => x.date.localeCompare(y.date)).slice(-30);
  out.blitz = { ...(b.blitz || {}) }; for (const [k, v] of Object.entries(a.blitz || {})) out.blitz[k] = Math.max(v, out.blitz[k] || 0);
  const q = [a.quests, b.quests].filter(Boolean).sort((x, y) => (x.date || '').localeCompare(y.date || '')).pop(); out.quests = q || null;
  if (a.quests && b.quests && a.quests.date === b.quests.date) out.quests = { date: a.quests.date, items: a.quests.items.map((it, i) => { const o = b.quests.items[i]; return !o ? it : { ...it, progress: Math.max(it.progress, o.progress), done: it.done || o.done, claimed: it.claimed || o.claimed }; }) };
  out.pet = a.pet || b.pet; out.settings = { ...(b.settings || {}), ...(a.settings || {}) };
  return out;
}
