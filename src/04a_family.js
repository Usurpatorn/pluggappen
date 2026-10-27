/* ========= Familjekonfiguration (privat) =========
   Allt som är specifikt för EN familj – barnens namn, vilken kursmall de följer, tema, prov, skolans glosor,
   lärarens kommentar – ligger här, inte i den publika koden. Konfigurationen sparas som dokumentet `_config`
   i familjens egen molnlagring och cachas lokalt så att appen fungerar offline.
   Form:
   { v: 1, updatedAt: <ms>, kids: [ { id, name, template: 'ak8'|'ak4'|'ak2', theme: 'teen'|'sport'|'pet', hue, emoji, paper,
       exams: [{ id, title, date, skillIds, deckIds }], decks: [{ id, lang, name, emoji, level, words: [[w, t, e], …] }],
       note: { title, lines: [..] } } ] } */
const FAMILY = {
  KEY: 'pluggappen.family.v1',
  cfg: null,
  THEMES: { teen: 'Tonåring (utan figurer)', sport: 'Sport (Luleå Hockey-kort)', pet: 'Följeslagare' },
  loadLocal() { try { const raw = localStorage.getItem(FAMILY.KEY); if (raw) { const c = JSON.parse(raw); if (FAMILY.valid(c)) FAMILY.cfg = c; } } catch (e) { /* ignore */ } },
  saveLocal() { try { if (FAMILY.cfg) localStorage.setItem(FAMILY.KEY, JSON.stringify(FAMILY.cfg)); else localStorage.removeItem(FAMILY.KEY); } catch (e) { /* ignore */ } },
  valid(c) {
    if (!c || typeof c !== 'object' || !Array.isArray(c.kids)) return false;
    return c.kids.every(k => k && typeof k.id === 'string' && /^[a-z0-9_-]{1,24}$/.test(k.id) && typeof k.name === 'string' && k.name.trim().length >= 1 && k.name.length <= 30 && TEMPLATES[k.template]);
  },
  // Normalise + fill defaults; strips unknown keys so the config can never carry executable content.
  clean(c) {
    const str = (v, max) => (typeof v === 'string' ? v.replace(/[<>]/g, '').slice(0, max) : '');
    return { v: 1, updatedAt: Number(c.updatedAt) || Date.now(), appName: str(c.appName, 40) || undefined, kids: c.kids.map(k => ({
      id: k.id, name: str(k.name, 30).trim(), template: k.template, theme: ['teen', 'sport', 'pet'].includes(k.theme) ? k.theme : 'pet',
      hue: ['teal', 'orange', 'pink', 'slate', 'blaugrana', 'rod'].includes(k.hue) ? k.hue : 'teal', emoji: str(k.emoji, 4) || '🙂', paper: str(k.paper, 20) || null,
      exams: (Array.isArray(k.exams) ? k.exams : []).map(e => ({ id: str(e.id, 40), title: str(e.title, 60), date: str(e.date, 10), skillIds: (e.skillIds || []).filter(x => typeof x === 'string').slice(0, 60), deckIds: (e.deckIds || []).filter(x => typeof x === 'string').slice(0, 30) })).filter(e => e.id && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date)),
      decks: (Array.isArray(k.decks) ? k.decks : []).map(d => ({ id: str(d.id, 40), lang: ['en', 'es', 'sv', 'de', 'fr'].includes(d.lang) ? d.lang : 'en', name: str(d.name, 60), emoji: str(d.emoji, 4) || '📘', level: [1, 2, 3].includes(d.level) ? d.level : 2, words: (Array.isArray(d.words) ? d.words : []).slice(0, 200).map(w => [str(w[0], 60), str(w[1], 60), str(w[2], 4)]).filter(w => w[0] && w[1]) })).filter(d => d.id && d.name && d.words.length),
      note: k.note && typeof k.note === 'object' ? { title: str(k.note.title, 60), lines: (Array.isArray(k.note.lines) ? k.note.lines : []).slice(0, 12).map(l => str(l, 200)).filter(Boolean) } : null,
    })) };
  },
  apply(c) { FAMILY.cfg = FAMILY.clean(c); FAMILY.saveLocal(); buildKids(); try { document.title = (FAMILY.cfg.appName || 'Pluggapp'); } catch (e) { /* no DOM */ } },
  async pull() {
    if (!SYNC.active) return false;
    try {
      const r = await SYNC.fetch(SYNC.url('_config'), { cache: 'no-store' }); if (!r.ok) return false;
      const doc = await r.json(); const remote = JSON.parse(doc.fields?.json?.stringValue || 'null');
      if (!FAMILY.valid(remote)) return false;
      if (!FAMILY.cfg || (remote.updatedAt || 0) > (FAMILY.cfg.updatedAt || 0)) { FAMILY.apply(remote); return true; }
      if (typeof SYNC.pv === 'function' && SYNC.pv() && JSON.stringify(remote) !== JSON.stringify(FAMILY.cfg)) { FAMILY.apply(remote); return true; }   // testadressen: familjens inställningar gäller alltid (spegel)
    } catch (e) { /* offline – keep local */ }
    return false;
  },
  async push() {
    if (!SYNC.active || !FAMILY.cfg) return false;
    const body = { fields: { json: { stringValue: JSON.stringify(FAMILY.cfg) }, updatedAt: { integerValue: String(FAMILY.cfg.updatedAt) }, kid: { stringValue: 'config' } } };
    try { const r = await SYNC.fetch(SYNC.url('_config'), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.ok; } catch (e) { return false; }
  },
  // Parent: import a config JSON (pasted). Returns { ok, msg }.
  async importJson(text) {
    let c; try { c = JSON.parse(text); } catch (e) { return { ok: false, msg: 'Det där är inte giltig JSON.' }; }
    if (!FAMILY.valid(c)) return { ok: false, msg: 'Konfigurationen saknar barn, eller har ett okänt mall-id (ak8, ak4, ak2).' };
    c.updatedAt = Date.now(); FAMILY.apply(c); load(); const pushed = await FAMILY.push();
    return { ok: true, msg: pushed ? `${FAMILY.cfg.kids.length} barn inlästa och sparade i molnet.` : `${FAMILY.cfg.kids.length} barn inlästa (sparas i molnet när synken är igång).` };
  },
  exportJson() { return JSON.stringify(FAMILY.cfg, null, 2); },
  update(mut) { if (!FAMILY.cfg) return; mut(FAMILY.cfg); FAMILY.cfg.updatedAt = Date.now(); FAMILY.apply(FAMILY.cfg); load(); FAMILY.push(); },
  /* ---------- 2.1: familjens privata innehåll (_content) – skrivs av Claude via scripts/content.mjs, läses av appen ----------
     { v: 1, updatedAt, packs: [Concept Pack, …] (från lärarmaterial), work: [skoluppgift, …] }. Appen skriver aldrig dokumentet.
     Allt valideras och HTML tvättas (bara enkla taggar utan attribut) innan något används. */
  CONTENT_KEY: 'pluggappen.content.v1',
  content: null,
  WORK_TYPES: ['exam', 'homework', 'vocab', 'practice'],
  cleanContent(c) {
    if (!c || typeof c !== 'object' || c.v !== 1) return null;
    const str = (v, max) => (typeof v === 'string' ? v.replace(/[<>]/g, '').slice(0, max) : '');
    // Källhänvisning (dokumentets etikett, sida, bild, frågenummer, avsnitt) – aldrig personnamn; samma fält som i paketen
    const src = (x) => { if (!x || typeof x !== 'object') return undefined; const o = {}; for (const k of ['ref', 'section', 'note']) if (typeof x[k] === 'string' && x[k]) o[k] = str(x[k], 80); for (const k of ['page', 'slide', 'q']) if (Number.isInteger(x[k]) || (typeof x[k] === 'string' && /^[0-9a-z.\-]{1,12}$/i.test(x[k]))) o[k] = x[k]; return Object.keys(o).length ? o : undefined; };
    const ids = (a, max, re) => (Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && re.test(x)).slice(0, max);
    const obj = (x) => x && typeof x === 'object' && !Array.isArray(x);   // granskning 2.1 (L9): en trasig post stoppar inte resten
    // Ett privat paket får aldrig ta ett inbyggt pakets id (granskning M5: då försvann det inbyggda paketet vid nästa uppdatering)
    const pub = new Set(Object.keys(PACKS.REG.packs).filter(id => !PACKS.REG.priv.has(id)));
    const packs = (Array.isArray(c.packs) ? c.packs : []).slice(0, 60).filter(obj).map(pk => PACKS.cleanPack(pk)).filter(pk => pk && !pub.has(pk.id) && !PACKS.validate(pk, { private: true }).length);
    const work = (Array.isArray(c.work) ? c.work : []).filter(obj).slice(0, 80).map(w => ({
      id: str(w.id, 40), kid: str(w.kid, 24), type: FAMILY.WORK_TYPES.includes(w.type) ? w.type : 'practice', title: str(w.title, 60), subject: str(w.subject, 30),
      date: /^\d{4}-\d{2}-\d{2}$/.test(w.date || '') ? w.date : '', packs: ids(w.packs, 20, /^[a-z0-9-]{2,48}$/), kps: ids(w.kps, 200, /^k:[a-z0-9-]{2,48}\/[a-z0-9-]{2,48}$/),
      skills: ids(w.skills, 60, /^[a-z0-9_]{2,40}$/), decks: ids(w.decks, 30, /^[A-Za-z0-9_-]{1,40}$/), priority: w.priority === 'high' ? 'high' : 'normal', weight: w.weight === 'major' || w.weight === 'minor' ? w.weight : undefined,   /* 3.4: förälderns val av storlek (valfritt) */
      teacherQs: (Array.isArray(w.teacherQs) ? w.teacherQs : []).filter(obj).slice(0, 80).map(t => ({ n: str(String(t.n || ''), 12), q: str(t.q, 400), a: str(t.a, 200), alias: (Array.isArray(t.alias) ? t.alias : []).map(x => str(x, 80)).filter(Boolean).slice(0, 8), not: (Array.isArray(t.not) ? t.not : []).map(x => str(x, 200)).filter(x => x && ![t.a, ...(Array.isArray(t.alias) ? t.alias : [])].some(a => typeof a === 'string' && a.trim().toLowerCase() === x.trim().toLowerCase())).slice(0, 5), kps: ids(t.kps, 8, /^k:[a-z0-9-]{2,48}\/[a-z0-9-]{2,48}$/), typed: !!t.typed, src: src(t.src) })).filter(t => t.q),
      src: src(w.src),
      // Experience v3 (tillägg, äldre versioner ignorerar dem): lärarens målområden (Testa mig rapporterar per område), lärarens betoning
      // (högre prioritet i planen via motorns befintliga fokusvikt) och luckor i underlaget (visas för föräldern – appen hittar aldrig på).
      goals: (Array.isArray(w.goals) ? w.goals : []).filter(obj).slice(0, 20).map(g => ({ id: str(g.id, 40), name: str(g.name, 60), skills: ids(g.skills, 20, /^[a-z0-9_]{2,40}$/), kps: ids(g.kps, 60, /^k:[a-z0-9-]{2,48}\/[a-z0-9-]{2,48}$/), teacher: !!g.teacher })).filter(g => g.id && g.name && (g.skills.length || g.kps.length)),
      focus: obj(w.focus) ? { skills: ids(w.focus.skills, 20, /^[a-z0-9_]{2,40}$/), kps: ids(w.focus.kps, 100, /^k:[a-z0-9-]{2,48}\/[a-z0-9-]{2,48}$/) } : { skills: [], kps: [] },
      missing: (Array.isArray(w.missing) ? w.missing : []).filter(obj).slice(0, 20).map(m => ({ label: str(m.label, 80), kind: ['pdf', 'book', 'format', 'video', 'lab', 'questions', 'other'].includes(m.kind) ? m.kind : 'other', note: str(m.note, 120) })).filter(m => m.label),
    })).filter(w => w.id && w.kid && w.title);
    // 3.5 privata bilder: manifestet (id → oföränderlig revision). Bilderna själva hämtas separat och kontrolleras (src/05j_assets.js).
    const assets = typeof ASSETS !== 'undefined' ? ASSETS.clean(c.assets) : [];
    return { v: 1, updatedAt: Number(c.updatedAt) || 0, packs, work, assets };
  },
  applyContent(c) {
    const cl = FAMILY.cleanContent(c); FAMILY.content = cl;
    if (typeof ASSETS !== 'undefined') { ASSETS.setManifest((cl && cl.assets) || []); ASSETS.loadLocal(); }
    PACKS.clearPrivate(); for (const pk of (cl && cl.packs) || []) PACKS.register(pk, { private: true });
    try { if (cl) localStorage.setItem(FAMILY.CONTENT_KEY, JSON.stringify({ ...cl, fam: FAMILY.famId() })); } catch (e) { /* ignore */ }
    buildKids(); if (typeof LE !== 'undefined') LE.C = {};
  },
  // Granskning 2.1 (H4): den lokala kopian hör till EN familj – byter enheten familj (eller familjen raderas) används den aldrig igen
  famId() { return typeof DB !== 'undefined' && DB.settings ? String(DB.settings.family || '') : ''; },
  loadContentLocal() { try { const raw = localStorage.getItem(FAMILY.CONTENT_KEY); if (!raw) return; const c = JSON.parse(raw); if ((c.fam || '') !== FAMILY.famId()) return FAMILY.clearContent(); FAMILY.applyContent(c); } catch (e) { /* ignore */ } },
  clearContent() { FAMILY.content = null; PACKS.clearPrivate(); if (typeof ASSETS !== 'undefined') { ASSETS.setManifest([]); ASSETS.clearLocal(); } try { localStorage.removeItem(FAMILY.CONTENT_KEY); } catch (e) { /* ignore */ } buildKids(); if (typeof LE !== 'undefined') LE.C = {}; },
  async pullContent() {
    if (!SYNC.active) return false;
    try {
      const r = await SYNC.fetch(SYNC.url('_content'), { cache: 'no-store' }); if (r.status === 404) { if (FAMILY.content) { FAMILY.clearContent(); return true; } return false; } if (!r.ok) return false;
      const doc = await r.json(); const remote = JSON.parse(doc.fields?.json?.stringValue || 'null'); if (!remote) return false;
      let changed = false; if (!FAMILY.content || (remote.updatedAt || 0) !== (FAMILY.content.updatedAt || 0)) { FAMILY.applyContent(remote); changed = true; }
      if (typeof ASSETS !== 'undefined' && Object.keys(ASSETS.man).length && (await ASSETS.pull()) > 0) changed = true;   // 3.5: bilder som saknas lokalt
      return changed;
    } catch (e) { /* offline – behåll lokalt */ }
    return false;
  },
  workFor(kidId) { return ((FAMILY.content && FAMILY.content.work) || []).filter(w => w.kid === kidId); },
  workById(id) { return ((FAMILY.content && FAMILY.content.work) || []).find(w => w.id === id) || null; },
};
// Bygger KIDS (det appen jobbar med) av mall + familjekonfiguration. Idempotent.
function buildKids() {
  KIDS.length = 0;
  if (!FAMILY.cfg) return;
  for (const c of FAMILY.cfg.kids) {
    const tpl = TEMPLATES[c.template];
    const skills = [...tpl.skills, ...(MORE_SKILLS[c.template] || []), ...(SO_SKILLS[c.template] || []), ...(typeof SV_SKILLS !== 'undefined' ? SV_SKILLS[c.template] || [] : []), ...(typeof NASO_SKILLS !== 'undefined' ? NASO_SKILLS[c.template] || [] : [])];
    skills.forEach(s => { if (!s.group) s.group = 'math'; });
    // 2.1: nya moment ur Concept Packs (bara v2) och skoluppgifter från familjens privata innehåll
    const v2skills = typeof PACKS !== 'undefined' ? PACKS.newSkillsFor({ id: c.id, template: c.template }) : [];
    const work = FAMILY.workFor(c.id);
    // Lärarens frågor räknas in i provets kunskapspunkter (en fråga kan pröva flera punkter; en punkt kan prövas av flera frågor)
    const workExams = work.filter(w => w.date && w.type !== 'practice').map(w => ({ id: 'w:' + w.id, title: w.title, date: w.date, skillIds: w.skills.slice(), deckIds: w.decks.slice(), kps: [...new Set([...w.kps, ...w.teacherQs.flatMap(t => t.kps)])], work: w.id, kind: w.type, priority: w.priority, weight: w.weight }));
    const focusCids = [...new Set([...work.filter(w => w.type === 'practice').flatMap(w => w.kps), ...work.flatMap(w => (w.focus && w.focus.kps) || [])])];
    const focusSkills = [...new Set(work.flatMap(w => (w.focus && w.focus.skills) || []))];   // v3: lärarens betoning → motorns befintliga fokusvikt
    KIDS.push({ id: c.id, name: c.name, grade: tpl.grade, emoji: c.emoji, hue: c.hue, theme: c.theme, teen: c.theme === 'teen', template: c.template, note: c.note, paper: c.paper, cfgDecks: c.decks.map(deckFromConfig), cfgExams: c.exams, skills, v2skills, workExams, focusCids, focusSkills });
  }
}
// Standardvärden per barn: mallens inställningar + familjens prov och glosor.
const kidDefaults = (kidId) => { const k = KIDS.find(x => x.id === kidId); if (!k) return null; const tpl = TEMPLATES[k.template]; return { settings: { ...tpl.defaults }, decks: [...tpl.decks, ...k.cfgDecks.map(d => d.id)], exams: k.cfgExams.map(e => ({ ...e, skillIds: [...e.skillIds], deckIds: [...e.deckIds] })), paper: k.paper || 'rutat' }; };
if (typeof module !== 'undefined') module.exports = { FAMILY, buildKids, kidDefaults };
