/* ========= Enhetsidentitet och familjemedlemskap =========
   Varje enhet loggar in anonymt i Firebase (ingen e-post, inget lösenord) och får ett stabilt uid.
   En familj har   meta/info      { joinCode, createdAt, rotatedAt }
                   members/{uid}  { role: 'kid'|'parent', device, joinedAt, lastSeen, code }
   Parkoppling = enheten visar upp familjens aktuella parkopplingskod EN gång och blir medlem.
   Därefter styr Firestore-reglerna: bara medlemmar läser/skriver familjens profiler. Koden sparas inte på enheten.
   Föräldern kan byta kod (gamla länkar slutar fungera för NYA enheter) och ta bort enheter.
   Övergång: en enhet med gammal familjekod startar familjen med joinCode = den gamla koden och går med automatiskt. */
const AUTH = {
  KEY: 'pluggappen.auth.v1',
  st: null, // { uid, idToken, refreshToken, exp }
  denied: false,
  get ready() { return !!(SYNC.cfg && AUTH.st && AUTH.st.idToken); },
  get uid() { return AUTH.st ? AUTH.st.uid : null; },
  load() { try { const raw = localStorage.getItem(AUTH.KEY); if (raw) AUTH.st = JSON.parse(raw); } catch (e) { /* ignore */ } },
  save() { try { if (AUTH.st) localStorage.setItem(AUTH.KEY, JSON.stringify(AUTH.st)); else localStorage.removeItem(AUTH.KEY); } catch (e) { /* ignore */ } },
  async signIn() {
    if (!SYNC.cfg) return false;
    if (AUTH.st && AUTH.st.refreshToken) return AUTH.ensureToken();
    try {
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${SYNC.cfg.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
      if (!r.ok) throw new Error('signUp HTTP ' + r.status);
      const j = await r.json(); AUTH.st = { uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (Number(j.expiresIn) - 60) * 1000 }; AUTH.save(); return true;
    } catch (e) { AUTH.lastError = e.message; return false; }
  },
  async ensureToken() {
    if (!AUTH.st || !AUTH.st.refreshToken) return false;
    if (AUTH.st.idToken && Date.now() < AUTH.st.exp) return true;
    try {
      const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${SYNC.cfg.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: AUTH.st.refreshToken }) });
      if (!r.ok) { if (r.status === 400) { AUTH.st = null; AUTH.save(); return AUTH.signIn(); } throw new Error('token HTTP ' + r.status); }
      const j = await r.json(); AUTH.st = { uid: j.user_id, idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + (Number(j.expires_in) - 60) * 1000 }; AUTH.save(); return true;
    } catch (e) { AUTH.lastError = e.message; return !!AUTH.st.idToken; }
  },
  async fetch(url, opts = {}) {
    await AUTH.ensureToken();
    const headers = { ...(opts.headers || {}) }; if (AUTH.st && AUTH.st.idToken) headers.Authorization = 'Bearer ' + AUTH.st.idToken;
    const r = await fetch(url, { ...opts, headers });
    if (r.status === 403 || r.status === 401) AUTH.denied = true; else if (r.ok) AUTH.denied = false;
    return r;
  },
  // ---- familj / medlemskap ----
  base() { return `https://firestore.googleapis.com/v1/projects/${SYNC.cfg.projectId}/databases/(default)/documents/families/${encodeURIComponent(SYNC.family)}`; },
  doc(path) { return `${AUTH.base()}/${path}?key=${SYNC.cfg.apiKey}`; },
  deviceLabel() { const ua = navigator.userAgent; const dev = /iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'Dator'; return `${dev}${window.navigator.standalone || matchMedia('(display-mode: standalone)').matches ? ' · hemskärm' : ' · webbläsare'}`; },
  get member() { return DB.settings.member && DB.settings.member.fam === SYNC.family ? DB.settings.member : null; },
  newCode() { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; const buf = new Uint32Array(16); crypto.getRandomValues(buf); for (const n of buf) s += a[n % a.length]; return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16); },
  // Gå med i familjen med en parkopplingskod. role: 'kid' | 'parent'. Returnerar { ok, msg }.
  async join(code, role) {
    if (!SYNC.active) return { ok: false, msg: 'Ingen familj vald.' };
    if (!(await AUTH.signIn())) return { ok: false, msg: 'Kunde inte skapa enhetsidentitet (nät?).' };
    const uid = AUTH.uid; const fields = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) }])) });
    // redan medlem?
    try { const r = await AUTH.fetch(AUTH.doc('members/' + uid)); if (r.ok) { DB.settings.member = { fam: SYNC.family, uid, role: (await r.json()).fields?.role?.stringValue || role, joinedAt: Date.now() }; save(); return { ok: true, msg: 'Enheten är redan parkopplad.' }; } } catch (e) { /* fortsätt */ }
    code = (code || '').trim();
    if (!code) return { ok: false, msg: 'Parkopplingskod saknas.' };
    // Finns familjen? En icke-medlem får 403 oavsett om dokumentet finns, så vi försöker alltid starta familjen:
    // create tillåts bara om meta/info saknas (reglerna), annars 403 → familjen finns redan och koden prövas nedan.
    try { await AUTH.fetch(AUTH.doc('meta/info'), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields({ joinCode: code, createdAt: Date.now() })) }); } catch (e) { return { ok: false, msg: 'Nätverksfel.' }; }
    const r2 = await AUTH.fetch(AUTH.doc('members/' + uid), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields({ role, device: AUTH.deviceLabel().slice(0, 60), joinedAt: Date.now(), lastSeen: Date.now(), code })) });
    if (!r2.ok) return { ok: false, msg: r2.status === 403 ? 'Fel parkopplingskod – eller så har föräldern bytt kod.' : 'Kunde inte parkoppla (' + r2.status + ').' };
    DB.settings.member = { fam: SYNC.family, uid, role, joinedAt: Date.now() }; DB.settings.joinCode = null; save();
    return { ok: true, msg: 'Enheten är parkopplad.' };
  },
  async touch() { // lastSeen högst en gång per dygn
    const m = AUTH.member; if (!m || !AUTH.ready) return; const today = todayKey(); if (m.seen === today) return;
    try { await AUTH.fetch(AUTH.doc('members/' + m.uid) + '&updateMask.fieldPaths=lastSeen&updateMask.fieldPaths=device', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { lastSeen: { integerValue: String(Date.now()) }, device: { stringValue: AUTH.deviceLabel().slice(0, 60) } } }) }); m.seen = today; save(); } catch (e) { /* ignore */ }
  },
  async listMembers() {
    try { const r = await AUTH.fetch(`${AUTH.base()}/members?key=${SYNC.cfg.apiKey}&pageSize=50`); if (!r.ok) return null; const j = await r.json(); return (j.documents || []).map(d => ({ uid: d.name.split('/').pop(), role: d.fields?.role?.stringValue || 'kid', device: d.fields?.device?.stringValue || '', joinedAt: Number(d.fields?.joinedAt?.integerValue || 0), lastSeen: Number(d.fields?.lastSeen?.integerValue || 0) })); } catch (e) { return null; }
  },
  async removeMember(uid) { try { const r = await AUTH.fetch(AUTH.doc('members/' + uid), { method: 'DELETE' }); return r.ok; } catch (e) { return false; } },
  async setRole(uid, role) { try { const r = await AUTH.fetch(AUTH.doc('members/' + uid) + '&updateMask.fieldPaths=role', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { role: { stringValue: role } } }) }); if (r.ok && uid === AUTH.uid && DB.settings.member) { DB.settings.member.role = role; save(); } return r.ok; } catch (e) { return false; } },
  async getJoinCode() { try { const r = await AUTH.fetch(AUTH.doc('meta/info')); if (!r.ok) return null; return (await r.json()).fields?.joinCode?.stringValue || null; } catch (e) { return null; } },
  async rotateCode() { const code = AUTH.newCode(); try { const r = await AUTH.fetch(AUTH.doc('meta/info') + '&updateMask.fieldPaths=joinCode&updateMask.fieldPaths=rotatedAt', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { joinCode: { stringValue: code }, rotatedAt: { integerValue: String(Date.now()) } } }) }); return r.ok ? code : null; } catch (e) { return null; } },
  pairLink(code) { return location.origin + location.pathname + '#fam-' + SYNC.family + (code ? '.' + code : ''); },
  // Tolka en parkopplingssträng: "familj.kod" eller gammal "familjekod" (då är koden = familjen).
  parsePair(str) { const s = (str || '').trim().replace(/[^a-zA-Z0-9\-.]/g, ''); if (!s) return null; const i = s.indexOf('.'); return i > 0 ? { fam: s.slice(0, i), code: s.slice(i + 1) } : { fam: s, code: s }; },
};
if (typeof module !== 'undefined') module.exports = { AUTH };
