/* ========= Storage & profile model ========= */
const STORE_KEY = 'pluggappen.v1';
const DAYMS = 86400000;
const todayKey = (d = new Date()) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const addDays = (key, n) => { const d = new Date(key + 'T00:00:00'); d.setDate(d.getDate() + n); return todayKey(d); };
const weekKey = () => { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return todayKey(d); };
// Barnens standardvärden (prov, glosor, inställningar, tema) kommer från familjekonfigurationen – se 04a_family.js (kidDefaults).
const defaultProfile = (kidId) => { const kd = kidDefaults(kidId) || { settings: { focus: false, sprint: 8, timer: false, tts: true, goal: 10 }, decks: [], exams: [], paper: 'rutat' }; return { xp: 0, gems: 0, skills: {}, days: {}, streak: 0, lastDay: null, freezes: 1, freezeWeek: weekKey(), tests: [], cards: [], words: {}, decks: [], enabledDecks: [...kd.decks], exams: kd.exams.map(e => ({ ...e })), quests: null, pet: null, settings: { ...kd.settings }, badges: [], sessions: 0, perfect: 0, unlocked: [], paper: kd.paper, accent: null, blitz: {}, week: weekKey(), weekCorrect: 0, sprintsSinceBreak: 0, claimedAll: null }; };
let DB = { profiles: {}, settings: { pin: '1234', goals: {}, sound: true } };
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const parsed = JSON.parse(raw); DB = { ...DB, ...parsed, settings: { ...DB.settings, ...(parsed.settings || {}) } }; } } catch (e) { /* storage unavailable: run in memory */ }
  for (const k of KIDS) {
    const d = defaultProfile(k.id); const old = DB.profiles[k.id] || {};
    const p = { ...d, ...old, settings: { ...d.settings, ...(old.settings || {}) } };
    if (!old.exams) p.exams = d.exams; // v1 → v2
    if (!old.enabledDecks) p.enabledDecks = d.enabledDecks;
    if (!p.v5light) { p.v5light = true; if (p.settings.dark === true) p.settings.dark = false; }
    if (k.paper && !p.v4lulea) { p.v4lulea = true; if (!old.paper || old.paper === 'rutat' || old.paper === 'barca') p.paper = k.paper; }
    for (const cd of k.cfgDecks) { const i = p.decks.findIndex(x => x.id === cd.id); if (i >= 0) p.decks[i] = cd; else p.decks.push(cd); } // skolans glosor från familjekonfigurationen
    if (!p.v2es) { p.v2es = true; for (const id of d.enabledDecks) if (!p.enabledDecks.includes(id)) p.enabledDecks.push(id); }
    for (const id of d.enabledDecks) if (!p.enabledDecks.includes(id) && !(p.removedDefaults || []).includes(id)) p.enabledDecks.push(id);
    for (const e of d.exams) { const ex = p.exams.find(x => x.id === e.id); if (ex) { for (const id of e.skillIds) if (!ex.skillIds.includes(id)) ex.skillIds.push(id); } else if (!(p.removedDefaults || []).includes(e.id)) p.exams.push({ ...e, skillIds: [...e.skillIds], deckIds: [...e.deckIds] }); }
    if (DB.settings.goals && DB.settings.goals[k.id] && !old.settings) p.settings.goal = DB.settings.goals[k.id];
    // migrate v1 "egna kort" into a custom deck
    if (p.cards && p.cards.length) { p.decks.push({ id: 'custom_' + Date.now(), lang: 'sv', name: 'Egna kort', emoji: '🗂️', level: 1, builtin: false, words: p.cards.map((c, i) => ({ id: 'cc' + i + '_' + Date.now(), w: c.a, t: c.q, e: '' })) }); p.enabledDecks.push(p.decks[p.decks.length - 1].id); p.cards = []; }
    DB.profiles[k.id] = p;
    rollover(p);
  }
}
function rollover(p) {
  const today = todayKey(); const wk = weekKey();
  p.snapshots = p.snapshots || {};
  const snap = () => ({ skills: Object.fromEntries(Object.entries(p.skills).map(([id, s]) => [id, Math.round(s.m)])), learned: Object.values(p.words || {}).filter(w => w.box >= 3).length, xp: p.xp, at: Date.now() });
  if (p.week !== wk) { p.week = wk; p.weekCorrect = 0; p.snapshots[wk] = snap(); }
  if (!p.snapshots[wk]) p.snapshots[wk] = snap();
  const sk = Object.keys(p.snapshots).sort(); while (sk.length > 8) delete p.snapshots[sk.shift()];
  if (p.freezeWeek !== wk) { p.freezeWeek = wk; if (p.freezes < 1) p.freezes = 1; }
  if (p.lastDay && p.lastDay !== today && p.streak > 0) {
    const yesterday = addDays(today, -1);
    if (p.lastDay !== yesterday) {
      const gap = Math.round((new Date(today) - new Date(p.lastDay)) / DAYMS) - 1;
      if (gap === 1 && p.freezes > 0) { p.freezes--; p.lastDay = yesterday; p.frozeToday = today; } else p.streak = 0;
    }
  }
}
let saveTimer = null;
function save() {
  if (typeof V2 !== 'undefined' && V2.sandbox) return; // förälderns förhandsvisning av v2: inget sparas eller synkas
  const target = state.screen === 'parent' ? state.tab : state.kid;
  if (target && DB.profiles[target]) { const d = DB.profiles[target]; d.updatedAt = Date.now(); d.since = d.since || { xp: 0, gems: 0, days: {} }; if (d._lx != null) { d.since.xp += d.xp - d._lx; d.since.gems += d.gems - d._lg; } d._lx = d.xp; d._lg = d.gems; SYNC.schedulePush(target); }
  clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 150);
}
// Granskning H2: under förälderns förhandsvisning skrivs barnets RIKTIGA profil (ögonblicksbilden) – aldrig förhandsvisningens kopia.
function dbJSON() { const sb = typeof V2 !== 'undefined' && V2.sandbox; return sb ? JSON.stringify({ ...DB, profiles: { ...DB.profiles, [sb.kidId]: JSON.parse(sb.snap) } }) : JSON.stringify(DB); }
function flushSave() { clearTimeout(saveTimer); saveTimer = null; try { localStorage.setItem(STORE_KEY, dbJSON()); } catch (e) { /* ignore */ } }
const prof = (kidId) => DB.profiles[kidId];
const goalFor = (kidId) => prof(kidId).settings.goal || 10;
const allDecks = (p) => [...BUILTIN_DECKS, ...p.decks];
const enabledDecks = (p) => allDecks(p).filter(d => p.enabledDecks.includes(d.id));
const deckById = (p, id) => allDecks(p).find(d => d.id === id);

/* ========= Mastery model (math) ========= */
function skillState(p, id) { if (!p.skills[id]) p.skills[id] = { att: 0, cor: 0, streak: 0, m: 0, lvl: 1, last: 0, wrongRun: 0 }; return p.skills[id]; }
function bumpDay(p, correct, xp) {
  const d = todayKey(); const day = p.days[d] || (p.days[d] = { n: 0, c: 0, xp: 0, w: 0 });
  day.n++; if (correct) day.c++; day.xp += xp;
  p.since = p.since || { xp: 0, gems: 0, days: {} }; const sd = p.since.days[d] || (p.since.days[d] = { n: 0, c: 0, xp: 0 }); sd.n++; if (correct) sd.c++; sd.xp += xp;
  if (correct) { p.weekCorrect = (p.weekCorrect || 0) + 1; if (p.lastDay !== d) { p.streak = p.lastDay === addDays(d, -1) ? p.streak + 1 : 1; p.lastDay = d; } }
  const keys = Object.keys(p.days).sort(); while (keys.length > 90) delete p.days[keys.shift()];
}
function serializeQ(q) { const { type, text, answer, choices, steps, hint, level, variables, variable, fig, keys, model, items, display } = q; return { type, text, answer, choices, steps, hint, level, variables, variable, fig, keys, model, items, display }; }
function noteMistake(p, item) {
  p.mistakes = p.mistakes || [];
  const entry = item.cat === 'word' ? { id: 'w_' + item.word.id, at: Date.now(), cat: 'word', deckId: item.deck.id, wordId: item.word.id } : { id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), at: Date.now(), cat: 'math', skillId: item.skill.id, q: serializeQ(item) };
  const old = p.mistakes.find(x => x.id === entry.id);
  if (!old) { p.mistakes.push(entry); if (p.mistakes.length > 60) p.mistakes.shift(); } else old.at = Math.max(old.at || 0, entry.at); // ny miss på samma glosa: färskare tid så att synken inte tappar den
}
// Felboken: borttagning lämnar en gravsten (id → tid) så att synk mellan enheter inte återuppväcker lösta uppgifter.
function clearMistake(p, id) {
  p.mistakes = (p.mistakes || []).filter(x => x.id !== id);
  const at = Math.max(0, ...(p.mistakes || []).filter(x => x.id === id).map(x => x.at || 0));
  const c = { ...(p.mistakesCleared || {}), [id]: Math.max(Date.now(), at) }; const ids = Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, 300); p.mistakesCleared = Object.fromEntries(ids.map(k => [k, c[k]]));
}
function recordAnswer(kidId, skillId, correct, level, usedHelp) {
  const p = prof(kidId); const s = skillState(p, skillId); const kk = KIDS.find(k => k.id === kidId); const maxLvl = ((kk && [...kk.skills, ...(kk.v2skills || [])].find(x => x.id === skillId)) || {}).maxLvl || 3;
  s.att++; s.last = Date.now();
  let xp;
  if (correct) {
    s.cor++; s.streak++; s.wrongRun = 0;
    s.m = Math.min(100, s.m + (100 - s.m) * (0.12 + 0.05 * level));
    if (s.streak >= 4 && s.m >= 55 && s.lvl < maxLvl) { s.lvl++; s.streak = 0; }
    xp = 8 + 4 * level + (usedHelp ? 0 : 4);
  } else {
    s.streak = 0; s.wrongRun++;
    s.m = Math.max(0, s.m - s.m * 0.22 - 3);
    if (s.wrongRun >= 3 && s.lvl > 1) { s.lvl--; s.wrongRun = 0; }
    xp = 2;
  }
  p.xp += xp; bumpDay(p, correct, xp);
  if (correct) questEvent(p, 'correct', { skillId });
  save();
  return xp;
}
function recordWordAnswer(kidId, wid, correct) {
  const p = prof(kidId); recordWord(p, wid, correct);
  const xp = correct ? 7 : 1; p.xp += xp; bumpDay(p, correct, xp);
  const d = p.days[todayKey()]; d.w = (d.w || 0) + 1;
  questEvent(p, 'word', { correct });
  if (correct) questEvent(p, 'correct', { skillId: null });
  save(); return xp;
}
const levelOf = (xp) => Math.floor(Math.sqrt(xp / 60)) + 1;
const xpForLevel = (l) => 60 * (l - 1) * (l - 1);
const LEVEL_NAMES = ['Nybörjare', 'Räknare', 'Klurig', 'Taltämjare', 'Mattemagiker', 'Hjärnhjälte', 'Mästare', 'Stormästare', 'Legend'];
const levelName = (l) => LEVEL_NAMES[Math.min(l - 1, LEVEL_NAMES.length - 1)] + (l > LEVEL_NAMES.length ? ' ' + (l - LEVEL_NAMES.length + 1) : '');
const masteryClass = (mv) => (mv < 40 ? 'lo' : mv < 75 ? 'mid' : 'hi');
const masteryLabel = (s) => (!s || s.att === 0 ? 'Inte börjat' : s.m < 40 ? 'Övar' : s.m < 75 ? 'På väg' : 'Säker');

/* ========= Companion ========= */
const PETS = [
  { id: 'drake', name: 'Drake', stages: ['🥚', '🐣', '🦎', '🐲', '🐉'] },
  { id: 'rav', name: 'Räv', stages: ['🥚', '🐣', '🐾', '🦊', '🦊✨'] },
  { id: 'black', name: 'Bläckis', stages: ['🥚', '🐣', '🦑', '🐙', '🐙✨'] },
  { id: 'uggla', name: 'Uggla', stages: ['🥚', '🐣', '🐥', '🦉', '🦉✨'] },
  { id: 'enhorning', name: 'Enhörning', stages: ['🥚', '🐣', '🐴', '🦄', '🦄✨'], shop: true },
  { id: 'robot', name: 'Robot', stages: ['📦', '🔩', '⚙️', '🤖', '🤖✨'], shop: true },
  { id: 'panda', name: 'Panda', stages: ['🥚', '🐣', '🎋', '🐼', '🐼✨'], shop: true },
];
const petOf = (p) => PETS.find(x => x.id === p.pet) || PETS[0];
const petStage = (p) => { const l = levelOf(p.xp); return l <= 1 ? 0 : l <= 2 ? 1 : l <= 4 ? 2 : l <= 7 ? 3 : 4; };
const petEmoji = (p) => petOf(p).stages[petStage(p)];
function petMood(p) {
  const today = p.days[todayKey()]; const stage = petStage(p);
  if (stage === 0) return 'Ägget behöver XP för att kläckas. Kör ett pass!';
  if (!today || !today.c) return `${petOf(p).name} är hungrig på XP. Ett pass så blir den glad.`;
  if (today.c >= goalFor(p.kidId)) return `${petOf(p).name} är mätt och stolt. Dagens mål klart! 🎉`;
  return `${petOf(p).name} tuggar i sig XP. ${goalFor(p.kidId) - today.c} rätt kvar till dagens mål.`;
}

/* ========= Daily quests ========= */
function dailyQuests(kid) {
  const p = prof(kid.id); const d = todayKey();
  if (p.quests && p.quests.date === d) return p.quests.items;
  const goal = goalFor(kid.id);
  const weakest = kid.skills.map(s => ({ s, m: skillState(p, s.id).m, att: skillState(p, s.id).att })).sort((a, b) => a.m - b.m)[0].s;
  const items = [
    { id: 'q1', type: 'correct', icon: '✅', text: `Klara ${goal} rätt`, target: goal, progress: 0, done: false, claimed: false, reward: { xp: 20, gems: 5 } },
    { id: 'q2', type: 'skill', skillId: weakest.id, icon: weakest.icon, text: `5 rätt på ${weakest.short.toLowerCase()}`, target: 5, progress: 0, done: false, claimed: false, reward: { xp: 25, gems: 6 } },
  ];
  if (enabledDecks(p).length) items.push({ id: 'q3', type: 'word', icon: '🗣️', text: 'Öva 8 ord', target: 8, progress: 0, done: false, claimed: false, reward: { xp: 20, gems: 5 } });
  else items.push({ id: 'q3', type: 'perfect', icon: '🎯', text: 'En felfri sprint', target: 1, progress: 0, done: false, claimed: false, reward: { xp: 30, gems: 8 } });
  p.quests = { date: d, items }; save(); return items;
}
function questEvent(p, type, data) {
  if (!p.quests || p.quests.date !== todayKey()) return;
  for (const q of p.quests.items) {
    if (q.done) continue;
    if (q.type === 'correct' && type === 'correct') q.progress++;
    else if (q.type === 'skill' && type === 'correct' && data.skillId === q.skillId) q.progress++;
    else if (q.type === 'word' && type === 'word') q.progress++;
    else if (q.type === 'perfect' && type === 'perfect') q.progress++;
    if (q.progress >= q.target) { q.done = true; p.pendingQuest = true; }
  }
}
function claimQuest(kid, qid) {
  const p = prof(kid.id); const q = p.quests.items.find(x => x.id === qid); if (!q || !q.done || q.claimed) return;
  q.claimed = true; p.xp += q.reward.xp; p.gems += q.reward.gems;
  let bonus = 0;
  if (p.quests.items.every(x => x.claimed) && p.claimedAll !== todayKey()) { p.claimedAll = todayKey(); bonus = 15; p.gems += bonus; }
  save(); beep(bonus ? 'badge' : 'gem'); confetti(bonus ? 200 : 80);
  toast(bonus ? `Alla uppdrag klara! +${q.reward.xp} XP, +${q.reward.gems + bonus} 💎 (bonuskista!)` : `+${q.reward.xp} XP · +${q.reward.gems} 💎`);
}

/* ========= Shop ========= */
const SHOP = [
  { id: 'paper_lulea', kind: 'paper', value: 'lulea', e: '🏒', name: 'Isen', price: 0, free: true },
  { id: 'paper_prickar', kind: 'paper', value: 'prickar', e: '🔵', name: 'Prickigt papper', price: 25 },
  { id: 'paper_linjer', kind: 'paper', value: 'linjer', e: '📝', name: 'Linjerat papper', price: 25 },
  { id: 'paper_hav', kind: 'paper', value: 'hav', e: '🌊', name: 'Havet', price: 40 },
  { id: 'paper_skog', kind: 'paper', value: 'skog', e: '🌲', name: 'Skogen', price: 40 },
  { id: 'paper_rymd', kind: 'paper', value: 'rymd', e: '🌌', name: 'Rymden (mörkt)', price: 60 },
  { id: 'pet_enhorning', kind: 'pet', value: 'enhorning', e: '🦄', name: 'Enhörning', price: 50 },
  { id: 'pet_robot', kind: 'pet', value: 'robot', e: '🤖', name: 'Robot', price: 50 },
  { id: 'pet_panda', kind: 'pet', value: 'panda', e: '🐼', name: 'Panda', price: 50 },
  { id: 'freeze', kind: 'freeze', e: '🧊', name: 'Extra streakfrys', price: 20, repeat: true },
  { id: 'acc_lila', kind: 'accent', value: 'lila', e: '🟣', name: 'Lila färg', price: 30 },
  { id: 'acc_gron', kind: 'accent', value: 'gron', e: '🟢', name: 'Grön färg', price: 30 },
  { id: 'acc_rod', kind: 'accent', value: 'rod', e: '🔴', name: 'Röd färg', price: 30 },
];
const ACCENTS = { lila: ['#7a4fd1', '#ebe2fb', '#4b2b8f'], gron: ['#2e9e5b', '#dcf4e4', '#1b5e37'], rod: ['#d8463f', '#fbe1df', '#8d231e'] };

/* ========= Badges ========= */
const BADGES = [
  { id: 'first', e: '🌱', name: 'Första passet', test: (p) => p.sessions >= 1 },
  { id: 'streak3', e: '🔥', name: '3 dagar i rad', test: (p) => p.streak >= 3 },
  { id: 'streak7', e: '🏆', name: '7 dagar i rad', test: (p) => p.streak >= 7 },
  { id: 'streak30', e: '💎', name: '30 dagar i rad', test: (p) => p.streak >= 30 },
  { id: 'hundred', e: '💯', name: '100 rätt', test: (p) => Object.values(p.skills).reduce((a, s) => a + s.cor, 0) >= 100 },
  { id: 'master', e: '⭐', name: 'Säker på ett område', test: (p) => Object.values(p.skills).some(s => s.m >= 75) },
  { id: 'allmaster', e: '👑', name: 'Säker på allt', test: (p, kid) => kid.skills.every(s => (p.skills[s.id] || {}).m >= 75) },
  { id: 'level5', e: '🚀', name: 'Nivå 5', test: (p) => levelOf(p.xp) >= 5 },
  { id: 'perfect', e: '🎯', name: 'Felfri sprint', test: (p) => p.perfect >= 1 },
  { id: 'words50', e: '🗣️', name: '50 ord lärda', test: (p) => Object.values(p.words).filter(w => w.box >= 3).length >= 50 },
  { id: 'blitz', e: '⚡', name: 'Blixt: 15 på en minut', test: (p) => Object.values(p.blitz || {}).some(v => v >= 15) },
  { id: 'quests', e: '📜', name: 'Alla uppdrag en dag', test: (p) => !!p.claimedAll },
];
function checkBadges(kid) { const p = prof(kid.id); const won = []; for (const b of BADGES) if (!p.badges.includes(b.id) && b.test(p, kid)) { p.badges.push(b.id); won.push(b); } if (won.length) { p.gems += 10 * won.length; save(); } return won; }

/* ========= Audio & effects ========= */
let audioCtx = null, audioUnlocked = false;
// iOS/iPadOS: ljud får bara startas efter ett tryck, och Web Audio tystas av ljudlöst läge tills ett <audio>-element spelats. Låser upp båda vid första trycket.
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (!audioUnlocked) {
      audioUnlocked = true;
      const b = audioCtx.createBuffer(1, 1, 22050), src = audioCtx.createBufferSource(); src.buffer = b; src.connect(audioCtx.destination); src.start(0);
      const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA='); a.setAttribute('playsinline', ''); a.volume = 0.01; const pr = a.play(); if (pr && pr.catch) pr.catch(() => {});
    }
  } catch (e) { /* no audio */ }
}
['touchend', 'pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { passive: true, capture: true }));
let SFX = null; // master chain: voices → delay (air) + compressor → destination
function sfxChain() {
  if (SFX) return SFX; const c = audioCtx;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.12;
  const master = c.createGain(); master.gain.value = 0.9; comp.connect(master).connect(c.destination);
  const dry = c.createGain(); dry.gain.value = 1; dry.connect(comp);
  const delay = c.createDelay(0.5); delay.delayTime.value = 0.11; const fb = c.createGain(); fb.gain.value = 0.28; const wet = c.createGain(); wet.gain.value = 0.16;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  dry.connect(delay); delay.connect(lp).connect(fb).connect(delay); lp.connect(wet).connect(comp);
  return (SFX = { in: dry });
}
// tone: one note with attack/decay envelope. opts: type, gain, a (attack), d (decay), slide (end freq), detune
function tone(f, t, dur, o = {}) {
  const c = audioCtx, osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || 'triangle'; osc.frequency.setValueAtTime(f, t); if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur); if (o.detune) osc.detune.value = o.detune;
  const a = o.a || 0.008, peak = o.gain || 0.18;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(sfxChain().in); osc.start(t); osc.stop(t + dur + 0.02);
}
// noise burst through a filter (clicks, whooshes, thuds)
function noise(t, dur, o = {}) {
  const c = audioCtx, n = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 2000, t); if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur); f.Q.value = o.q || 1;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.1, t + (o.a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxChain().in); src.start(t); src.stop(t + dur + 0.02);
}
const NOTE = (semi) => 440 * Math.pow(2, (semi - 9) / 12); // semitones from C4 (0 = C4)
/* Ljudspråk: dur-ackord för framgång, stigande tonhöjd ju längre kombo, mjuka (aldrig straffande) fel, glittriga ädelstenar. */
function beep(kind, n = 0) {
  if (!DB.settings.sound) return;
  try {
    unlockAudio(); const t = audioCtx.currentTime + 0.01;
    if (kind === 'ok') {
      const up = Math.min(7, Math.max(0, n - 1)); // kombo: varje rätt i rad lyfter en halvton (max en kvint)
      tone(NOTE(12 + up), t, 0.16, { type: 'sine', gain: 0.22 }); tone(NOTE(16 + up), t + 0.07, 0.22, { type: 'triangle', gain: 0.2 }); tone(NOTE(28 + up), t + 0.07, 0.12, { type: 'sine', gain: 0.06 });
      noise(t, 0.03, { f: 5000, gain: 0.05 });
      if (n && n % 5 === 0) [0, 0.06, 0.12, 0.18].forEach((dt, i) => tone(NOTE(24 + [0, 4, 7, 12][i]), t + 0.12 + dt, 0.3, { type: 'sine', gain: 0.1 })); // var femte i rad: glitter
    } else if (kind === 'no') {
      noise(t, 0.09, { type: 'lowpass', f: 400, gain: 0.12, a: 0.002 }); tone(NOTE(-5), t, 0.22, { type: 'sine', gain: 0.12, slide: NOTE(-8) }); tone(NOTE(3), t + 0.02, 0.18, { type: 'triangle', gain: 0.05, slide: NOTE(0) });
    } else if (kind === 'tick') {
      noise(t, 0.025, { f: 3500, q: 2, gain: 0.12, a: 0.001 }); tone(NOTE(24), t, 0.05, { type: 'sine', gain: 0.06 });
    } else if (kind === 'gem') {
      [0, 0.09].forEach((dt, i) => { tone(NOTE(31 + i * 5), t + dt, 0.25, { type: 'sine', gain: 0.14, slide: NOTE(36 + i * 5) }); tone(NOTE(43 + i * 5), t + dt, 0.18, { type: 'sine', gain: 0.05 }); });
      noise(t, 0.04, { f: 8000, gain: 0.04 });
    } else if (kind === 'badge') {
      noise(t, 0.35, { f: 600, slide: 6000, gain: 0.07, a: 0.2 }); [0, 4, 7, 12].forEach((s, i) => tone(NOTE(12 + s), t + i * 0.05, 0.6, { type: 'triangle', gain: 0.13 })); [0, 4, 7, 12].forEach((s, i) => tone(NOTE(24 + s), t + 0.25 + i * 0.05, 0.7, { type: 'sine', gain: 0.1 }));
    } else if (kind === 'perfect') {
      noise(t, 0.4, { f: 500, slide: 7000, gain: 0.08, a: 0.25 });
      const mel = [[0, 0], [4, 0.1], [7, 0.2], [12, 0.3], [7, 0.45], [12, 0.55], [16, 0.7], [19, 0.9]]; mel.forEach(([s, dt]) => { tone(NOTE(12 + s), t + dt, 0.35, { type: 'triangle', gain: 0.16 }); tone(NOTE(24 + s), t + dt, 0.3, { type: 'sine', gain: 0.07, detune: 6 }); });
      [0, 4, 7, 12].forEach(s => tone(NOTE(s), t + 0.9, 1.1, { type: 'sine', gain: 0.09, a: 0.05 }));
    } else if (kind === 'start') {
      noise(t, 0.3, { f: 400, slide: 4000, gain: 0.08, a: 0.15 }); tone(NOTE(7), t + 0.1, 0.25, { type: 'sine', gain: 0.1, slide: NOTE(19) });
    } else { // 'win': kort fanfar
      noise(t, 0.25, { f: 700, slide: 5000, gain: 0.06, a: 0.15 });
      [[0, 0], [4, 0.09], [7, 0.18], [12, 0.3]].forEach(([s, dt]) => { tone(NOTE(12 + s), t + dt, 0.4, { type: 'triangle', gain: 0.16 }); tone(NOTE(24 + s), t + dt, 0.25, { type: 'sine', gain: 0.07, detune: 5 }); });
      [0, 4, 7].forEach(s => tone(NOTE(s), t + 0.3, 0.8, { type: 'sine', gain: 0.08, a: 0.04 }));
    }
  } catch (e) { /* no audio */ }
  try { if (navigator.vibrate) navigator.vibrate(kind === 'no' ? [60, 40, 60] : kind === 'tick' ? 10 : 20); } catch (e) { /* no haptics */ }
}
function confetti(n = 120) {
  const c = document.getElementById('confetti'); if (!c) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = c.getContext('2d'); if (!ctx) return; c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
  c.classList.remove('hidden');
  const colors = [getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(), '#f5c33b', '#4fc98c', '#ef7a69', '#6c8cff'];
  const parts = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, r: 4 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6, va: (Math.random() - .5) * .3 }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += .45; p.vx *= .99; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); ctx.restore(); }
    if (++frames < 110) requestAnimationFrame(tick); else { ctx.clearRect(0, 0, innerWidth, innerHeight); c.classList.add('hidden'); }
  })();
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }
function xpPop(n) { const d = document.createElement('div'); d.className = 'xp-pop'; d.textContent = `+${n} XP`; document.body.appendChild(d); setTimeout(() => d.remove(), 1100); }

/* ========= Sync code (move progress between phone and tablet) ========= */
function encodeProfile(kidId) {
  const p = prof(kidId); const payload = JSON.stringify({ k: kidId, t: Date.now(), p });
  try { if (window.LZString) return 'PA2.' + LZString.compressToEncodedURIComponent(payload); } catch (e) { /* fall through */ }
  return 'PA1.' + btoa(unescape(encodeURIComponent(payload)));
}
function decodeProfile(code) {
  code = (code || '').trim();
  try {
    let json;
    if (code.startsWith('PA2.')) json = LZString.decompressFromEncodedURIComponent(code.slice(4));
    else if (code.startsWith('PA1.')) json = decodeURIComponent(escape(atob(code.slice(4))));
    else json = decodeURIComponent(escape(atob(code)));
    const obj = JSON.parse(json);
    if (obj && obj.p && typeof obj.p.xp === 'number') return obj;
    if (obj && typeof obj.xp === 'number') return { k: null, t: null, p: obj };
  } catch (e) { /* bad code */ }
  return null;
}
const activityScore = (p) => Object.values(p.days || {}).reduce((a, d) => a + d.n, 0) + Object.values(p.words || {}).reduce((a, w) => a + w.seen, 0);

/* ========= Icons (inline SVG, no emoji in chrome) ========= */
const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  speaker: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  gem: '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21L8 9l4-6 4 6-4 12"/></svg>',
  flame: '<svg viewBox="0 0 24 24"><path d="M12 22c4.4 0 8-3.2 8-7.5 0-3.4-2.4-5.7-4-8-.4 2-1.3 3-2.5 3.5C14 7 13 4 10.5 2 11 6 7 7.5 5.5 10.5 4 13.3 4 14.5 4 14.5 4 18.8 7.6 22 12 22z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
  sync: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 01-15.5 6.3L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0115.5-6.3L21 8"/><path d="M21 3v5h-5"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
};

/* ========= Rendering helpers ========= */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// HTML-sanering för genererat/lagrat innehåll (frågetext, lösningssteg, figurer, Felboken). Tillåter bara ofarliga taggar,
// tar bort on*-attribut och javascript:/data:-länkar. Används som skyddslager även om innehållet kommer från appens egna generatorer.
const SAFE_TAGS = new Set(['B', 'I', 'U', 'EM', 'STRONG', 'BR', 'P', 'OL', 'UL', 'LI', 'SPAN', 'SUP', 'SUB', 'SMALL', 'DIV', 'BUTTON', 'SVG', 'G', 'PATH', 'CIRCLE', 'RECT', 'LINE', 'TEXT', 'TSPAN', 'POLYGON', 'POLYLINE', 'ELLIPSE', 'DEFS', 'CLIPPATH', 'USE', 'TITLE']);
function safeHtml(html) {
  if (html == null) return ''; html = String(html); if (!/[<&]/.test(html)) return html;
  try {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const walk = (node) => { for (const el of [...node.children]) { if (!SAFE_TAGS.has(el.tagName.toUpperCase())) { el.replaceWith(doc.createTextNode(el.textContent)); continue; } for (const a of [...el.attributes]) { const n = a.name.toLowerCase(); if (n.startsWith('on') || (['href', 'src', 'xlink:href', 'formaction', 'action'].includes(n) && !/^\s*(#|\.|\/|https?:)/i.test(a.value)) || (n === 'style' && /url\(|expression|javascript/i.test(a.value))) el.removeAttribute(a.name); } walk(el); } };
    walk(doc.body); return doc.body.innerHTML;
  } catch (e) { return esc(html); }
}
const app = document.getElementById('app');
let state = { screen: 'start', kid: null };
function applyLook(kid) {
  const root = document.documentElement;
  root.setAttribute('data-hue', kid ? kid.hue : 'slate');
  const p = kid ? prof(kid.id) : null;
  root.setAttribute('data-paper', p ? (p.paper || 'rutat') : 'rutat');
  root.style.removeProperty('--acc'); root.style.removeProperty('--acc-soft'); root.style.removeProperty('--acc-ink');
  if (p && p.accent && ACCENTS[p.accent]) { const [a, s, i] = ACCENTS[p.accent]; root.style.setProperty('--acc', a); root.style.setProperty('--acc-soft', s); root.style.setProperty('--acc-ink', i); }
  document.body.classList.toggle('focus', !!(p && p.settings.focus));
  root.setAttribute('data-font', p && p.settings.font === 'lexend' ? 'lexend' : 'standard'); root.setAttribute('data-size', p && p.settings.textsize === 'large' ? 'large' : 'normal');
  // Ljust är standard överallt; mörkt bara om barnet valt det. null = följ telefonen.
  if (p && p.settings.dark === true) root.setAttribute('data-theme', 'dark'); else if (p && p.settings.dark === null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', 'light');
}
function render(html) { app.innerHTML = (typeof V2 !== 'undefined' && V2.sandbox ? V2.previewBar() : '') + html; window.scrollTo({ top: 0 }); }
function kidById(id) { return KIDS.find(k => k.id === id); }
// Appens namn kommer från familjekonfigurationen (t.ex. "Familjen Xs Pluggapp"); utan konfiguration heter den bara Pluggapp.
function appName() { return (FAMILY.cfg && FAMILY.cfg.appName) || 'Pluggapp'; }
function logoHtml() { const n = appName(); const i = n.lastIndexOf(' '); return i > 0 ? `${esc(n.slice(0, i))} <span>${esc(n.slice(i + 1))}</span>` : `<span>${esc(n)}</span>`; }
function go(screen, extra = {}) { if (S && S.timer) clearInterval(S.timer); if (typeof V2 !== 'undefined' && V2.sandbox && (screen === 'start' || screen === 'parent')) V2.restoreSandbox(); state = { ...state, screen, ...extra }; if (screen === 'start' || screen === 'parent') { state.kid = null; applyLook(null); } else applyLook(kidById(state.kid)); VIEWS[screen](); }
function topbar(title, back, right = '') { return `<div class="topbar"><button class="icon-btn" data-go="${back}" aria-label="Tillbaka">${ICON.back}</button><div class="title grow">${title}</div>${right}</div>`; }
function daysUntil(dateStr) { const d = new Date(dateStr + 'T00:00:00'); const now = new Date(); now.setHours(0, 0, 0, 0); return Math.round((d - now) / DAYMS); }
const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
const fmtTime = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const speakBtn = (text, lang, cls = '') => (TTS.ok ? `<button class="speak-btn ${cls}" data-speak="${esc(text)}" data-lang="${lang}" aria-label="Lyssna">${ICON.speaker}</button>` : '');
const isTeen = (kid) => !!kid.teen;
const isSport = (kid) => kid.theme === 'sport';
const SPORT_LEVELS = ['Knatte', 'U12', 'J18', 'HockeyAllsvenskan', 'SHL', 'Slutspel', 'Landslaget', 'NHL', 'Legend'];
const LBL = (kid) => isSport(kid)
  ? { go: 'Spela match', unit: 'uppgifter', done: 'Matchen klar', quests: 'Dagens matchplan', week: 'Veckans serie', streakWord: 'matcher i rad', again: 'En period till', test: 'Slutspel (prov)' }
  : { go: 'Kör', unit: 'uppgifter', done: 'Sprinten klar', quests: 'Dagens uppdrag', week: 'Veckans utmaning', streakWord: 'dagar i rad', again: 'En sprint till', test: 'Provläge' };
const TEEN_LEVELS = ['Rookie', 'Starter', 'Solid', 'Skarp', 'Pro', 'Elite', 'Mästare', 'Stormästare', 'Legend'];
const levelNameFor = (kid, l) => { const arr = isTeen(kid) ? TEEN_LEVELS : isSport(kid) ? SPORT_LEVELS : null; return arr ? (arr[Math.min(l - 1, arr.length - 1)] + (l > arr.length ? ' ' + (l - arr.length + 1) : '')) : levelName(l); };

/* ========= Views ========= */
const VIEWS = {};

VIEWS.start = () => {
  if (!KIDS.length) {
    return render(`
  <div class="start-hero stack" style="gap:6px"><div class="logo">${logoHtml()}</div><p class="muted">Appen är inte kopplad till någon familj ännu.</p></div>
  <div class="stack" style="margin-top:14px">
    ${SYNC.cfg ? `<div class="card stack" style="gap:10px"><div class="eyebrow">Koppla till familjen</div><p class="muted" style="font-size:.95rem">${SYNC.family ? 'Enheten har en familjekod men inga familjeinställningar har hämtats ännu. Kontrollera nätet och försök igen, eller läs in inställningarna i föräldraläget.' : 'Skriv in familjekoden du fått av en förälder, eller öppna länken som skickats till dig.'}</p>
      ${SYNC.family ? '' : `<div class="field"><label for="pairCode">Familjekod</label><input id="pairCode" autocapitalize="off" autocomplete="off" placeholder="kod"></div>`}
      <div class="row"><button class="btn grow" data-act="${SYNC.family ? 'retryFamily' : 'pairFamily'}">${SYNC.family ? 'Försök igen' : 'Koppla'}</button></div><div id="syncState">${SYNC.badge()}</div></div>` : `<div class="card"><p class="muted">Den här versionen saknar molnkoppling. Läs in familjeinställningar i föräldraläget.</p></div>`}
    <button class="link" data-go="parent" style="align-self:center;margin-top:8px">Förälder</button>
  </div>`);
  }
  render(`
  <div class="start-hero stack" style="gap:6px">
    <div class="logo">${logoHtml()}</div>
    <p class="muted">Vem ska plugga?</p>
  </div>
  <div class="stack" style="margin-top:14px">
    ${KIDS.map(k => { const p = prof(k.id); const lvl = levelOf(p.xp); const today = p.days[todayKey()] || { c: 0 }; return `
    <button class="card tap kid-card" data-kid="${k.id}" data-hue="${k.hue}">
      <div class="avatar">${isTeen(k) ? k.name[0] : isSport(k) ? '🏒' : (p.pet ? petEmoji(p) : k.emoji)}</div>
      <div class="grow">
        <div class="name">${esc(k.name)}</div>
        <div class="meta">${k.grade} · Nivå ${lvl} ${levelNameFor(k, lvl)}</div>
        <div class="row" style="margin-top:6px;gap:6px">${p.streak > 0 ? `<span class="pill">🔥 ${p.streak} dag${p.streak > 1 ? 'ar' : ''}</span>` : ''}<span class="pill ${today.c >= goalFor(k.id) ? 'good' : ''}">${today.c}/${goalFor(k.id)} idag</span></div>
      </div>
      <span class="chev">›</span>
    </button>`; }).join('')}
  </div>
  <div class="footer-links"><button data-go="parent">Förälder</button></div>
  <div style="text-align:center;margin-top:10px" id="syncState">${SYNC.badge()}</div>`);
};

VIEWS.petpick = () => {
  const kid = kidById(state.kid);
  render(`${topbar('Välj din följeslagare', 'start')}
  <div class="stack" style="margin-top:6px">
    <div class="card pad-lg" style="text-align:center"><h2>Hej ${esc(kid.name)}! 👋</h2><p class="muted" style="margin-top:6px">Välj ett ägg. Det kläcks och växer när du samlar XP genom att plugga.</p></div>
    <div class="pet-grid">${PETS.filter(x => !x.shop).map(x => `<button class="card tap pet-opt" data-pet="${x.id}"><div class="pe">${x.stages[3]}</div><div class="pn">${x.name}</div></button>`).join('')}</div>
    <p class="muted" style="text-align:center;font-size:.9rem">Fler finns i butiken när du har samlat ädelstenar 💎</p>
  </div>`);
};

function recommendSprint(kid) {
  const p = prof(kid.id); const n = p.settings.sprint;
  const exam = p.exams.filter(e => daysUntil(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (exam && daysUntil(exam.date) <= 30 && exam.skillIds.length) return { label: `Provträning · ${exam.title}`, opts: { skillIds: exam.skillIds, deckIds: exam.deckIds, n } };
  const quests = dailyQuests(kid); const open = quests.filter(q => !q.done);
  if (open.some(q => q.type === 'skill')) { const q = open.find(x => x.type === 'skill'); return { label: `Uppdrag: ${q.text}`, opts: { skillIds: [q.skillId], n } }; }
  if (open.some(q => q.type === 'word') && enabledDecks(p).length) return { label: 'Uppdrag: öva ord', opts: { deckIds: enabledDecks(p).map(d => d.id), n, wordsOnly: true } };
  return { label: 'Dagens blandning', opts: { skillIds: kid.skills.map(s => s.id), deckIds: enabledDecks(p).map(d => d.id), n } };
}

VIEWS.home = () => {
  if (!state.subj) { try { state.subj = localStorage.getItem('pluggappen.subj.' + state.kid) || 'math'; } catch (e) { state.subj = 'math'; } }
  const kid = kidById(state.kid); const p = prof(kid.id); p.kidId = kid.id; const v2 = V2.on(kid);
  if (!p.pet) { if (isTeen(kid) || isSport(kid)) { p.pet = 'none'; save(); } else return VIEWS.petpick(); }
  const lvl = levelOf(p.xp); const next = xpForLevel(lvl + 1); const prev = xpForLevel(lvl); const pct = Math.round(((p.xp - prev) / (next - prev)) * 100);
  const today = p.days[todayKey()] || { c: 0, n: 0 }; const goal = goalFor(kid.id);
  const quests = dailyQuests(kid); const rec = recommendSprint(kid);
  const decks = enabledDecks(p);
  const weekTarget = kid.template === 'ak2' ? 40 : 60;
  const examCards = p.exams.filter(e => daysUntil(e.date) >= -1).sort((a, b) => a.date.localeCompare(b.date)).map(e => {
    const days = daysUntil(e.date);
    const ms = e.skillIds.map(id => skillState(p, id).m); const dps = e.deckIds.map(id => deckById(p, id)).filter(Boolean).map(d => deckProgress(p, d).pct);
    const all = [...ms, ...dps]; const ready = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;
    const lastTest = p.tests.filter(t => t.examId === e.id).slice(-1)[0];
    return `<div class="card pad-lg exam stack" style="gap:12px">
      <div class="row"><div class="grow"><div class="eyebrow">${esc(e.title)} · ${fmtDate(e.date)}</div><div class="days">${days > 0 ? days : days === 0 ? 'Idag' : '✓'}</div><div style="opacity:.85">${days > 1 ? 'dagar kvar' : days === 1 ? 'dag kvar' : days === 0 ? 'Lycka till!' : 'Provet är gjort'}</div></div>
      <div class="ring" style="--p:${ready};--card:#1d2433;--soft:rgba(255,255,255,.15);--acc:#fff"><b style="color:#fff">${ready}%</b></div></div>
      <div class="ready"><div style="font-weight:700">Provberedskap ${ready}%</div><div style="font-size:.9rem;opacity:.9">${ready < 40 ? 'Börja med den stora knappen – den väljer det du behöver mest.' : ready < 75 ? 'Bra på väg. Öva de områden som är gula och röda.' : 'Du är redo. Kör provläget för att bekräfta!'}${lastTest ? ` Senaste provträning: ${lastTest.score}/${lastTest.total}${lastTest.grade ? ` (${lastTest.grade})` : ''}.` : ''}</div></div>
      <div class="row"><button class="btn grow" data-test="${e.id}">${LBL(kid).test} · E/C/A</button><button class="btn ghost" data-plan="${e.id}">Plan</button></div>
    </div>`; }).join('');
  render(`
  ${topbar(esc(kid.name), 'start', `<span class="pill ${p.streak ? 'warn' : ''}" title="Dagar i rad">${ICON.flame} ${p.streak}</span><button class="pill" data-go="shop" style="min-height:36px"><span class="gem">${ICON.gem} ${p.gems}</span></button><button class="icon-btn" data-go="sync" aria-label="Synka enheter" title="Synka telefon och iPad">${ICON.sync}</button><button class="icon-btn" data-act="sound" aria-label="Ljud">${DB.settings.sound ? ICON.speaker : ICON.mute}</button>`)}
  <div class="stack" style="margin-top:6px">
    ${isSport(kid) ? `<div class="player-card lulea"><div><div class="rating">${lvl}</div><div class="pos">${['C', 'LW', 'RW', 'D', 'G'][lvl % 5]}</div></div><div class="grow" style="position:relative"><div class="pname">${esc(kid.name)}</div><div class="ptitle">${levelNameFor(kid, lvl)} · ${p.xp} poäng</div><div class="pstats"><div><b>${p.streak}</b>${LBL(kid).streakWord}</div><div><b>${today.c}/${goal}</b>mål idag</div><div><b>${p.weekCorrect || 0}</b>rätt i veckan</div></div><div class="xpbar"><i style="width:${pct}%"></i></div><div style="font-size:.75rem;opacity:.8;margin-top:4px">${next - p.xp} poäng till ${levelNameFor(kid, lvl + 1)}</div></div></div>` : `<div class="card stack" style="gap:12px">
      <div class="hero">${isTeen(kid) ? `<div class="rank">${lvl}<small>nivå</small></div>` : `<div class="pet">${petEmoji(p)}<span class="lvl">${lvl}</span></div>`}
        <div class="grow"><div class="eyebrow">${levelNameFor(kid, lvl)} · ${p.xp} XP</div><div class="mood" style="margin:4px 0 8px">${isTeen(kid) ? (today.c >= goal ? 'Dagens mål klart. Allt över det är bonus.' : today.c ? `${goal - today.c} rätt kvar till dagens mål.` : `${p.streak && !v2 ? `Håll streaken vid liv – ` : ''}en sprint på fem räcker idag.`) : petMood(p)}</div><div class="xpbar"><i style="width:${pct}%"></i></div><div class="muted" style="font-size:.8rem;margin-top:4px">${next - p.xp} XP till nivå ${lvl + 1}</div></div></div>
      <div class="row" style="gap:8px">${v2 && !p.streak ? '' : `<span class="pill">${p.streak} dag${p.streak === 1 ? '' : 'ar'} i rad</span>`}${v2 ? V2.weekPill(p) : `<span class="pill" title="Streakfrys räddar din streak om du missar en dag">${p.freezes} frys</span>`}<span class="pill ${today.c >= goal ? 'good' : ''}">${today.c}/${goal} idag</span></div>
    </div>`}
    ${v2 ? V2.welcome(kid) + (isSport(kid) ? `<div class="row" style="justify-content:center">${V2.weekPill(p)}</div>` : '') + V2.korBtn(kid) : `<button class="go-btn" data-rec="1"><div><div class="t">${LBL(kid).go}</div><div class="s">${esc(rec.label)} · ${rec.opts.n} ${LBL(kid).unit} · ~${Math.ceil(rec.opts.n * 0.5)} min</div></div><div class="arrow">${ICON.arrow}</div></button>`}
    <div class="card">
      <div class="section-h"><h3>${LBL(kid).quests}</h3><span class="muted" style="font-size:.85rem">${quests.filter(q => q.claimed).length}/${quests.length} klara</span></div>
      ${quests.map(q => `<div class="quest ${q.done ? 'done' : ''}"><div class="qi">${q.done ? '✅' : q.icon}</div><div class="grow"><div class="qt">${esc(q.text)}</div><div class="qp">${q.claimed ? `Klart · +${q.reward.xp} XP, +${q.reward.gems} 💎` : `${Math.min(q.progress, q.target)}/${q.target} · ${q.reward.xp} XP + ${q.reward.gems} 💎`}</div>${q.claimed ? '' : `<div class="mastery hi" style="margin-top:4px"><i style="width:${Math.min(100, Math.round(q.progress / q.target * 100))}%"></i></div>`}</div>${q.done && !q.claimed ? `<button class="btn claim" data-claim="${q.id}">Hämta</button>` : ''}</div>`).join('')}
      <div class="week" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line)"><div class="grow"><div class="qt" style="font-weight:700;font-size:.95rem">${LBL(kid).week}: ${weekTarget} rätt</div><div class="mastery mid" style="margin-top:4px"><i style="width:${Math.min(100, Math.round((p.weekCorrect || 0) / weekTarget * 100))}%"></i></div></div><span class="m">${p.weekCorrect || 0}/${weekTarget}</span></div>
    </div>
    ${v2 ? V2.examCards(kid) : examCards}
    ${PUSH.card(kid.id, 'kid')}
    ${v2 ? V2.felbokCard(kid) : (p.mistakes || []).length ? `<button class="card tap row" data-act="felbok" style="gap:12px"><div class="ic" style="width:44px;height:44px;border-radius:12px;background:var(--bad-soft);color:var(--bad);display:grid;place-items:center;font-size:1.3rem">📕</div><div class="grow"><div style="font-weight:800;font-family:var(--display)">Felboken · ${p.mistakes.length} ${p.mistakes.length === 1 ? 'uppgift' : 'uppgifter'}</div><div class="muted" style="font-size:.9rem">Allt du svarat fel på. Klara dem för att tömma boken.</div></div><span class="chev">›</span></button>` : ''}
    ${(() => {
      const shown = v2 ? [...kid.skills, ...(kid.v2skills || [])] : kid.skills;   // 2.1: nya moment ur Concept Packs bara i v2 (v1 är frusen reserv)
      const subjects = [['math', 'Matte', '🔢'], ['sv', 'Svenska', '📖'], ['en', 'Engelska', '🇬🇧'], ['no', 'NO', '🔬'], ['so', 'SO', '🌍'], ['lang', 'Språk', '🗣️']].filter(([g]) => g === 'lang' || shown.some(s => (s.group || 'math') === g));
      const cur = subjects.some(([g]) => g === state.subj) ? state.subj : subjects[0][0];
      const avg = (g) => { const list = shown.filter(s => (s.group || 'math') === g); return list.length ? Math.round(list.reduce((a, s) => a + skillState(p, s.id).m, 0) / list.length) : 0; };
      const tabs = `<div class="subj-tabs" role="tablist">${subjects.map(([g, label, icon]) => `<button class="subj ${g === cur ? 'on' : ''}" role="tab" data-subj="${g}"><span class="si">${icon}</span><span class="sl">${label}</span>${g !== 'lang' ? `<span class="sp"><i style="width:${avg(g)}%"></i></span>` : ''}</button>`).join('')}</div>`;
      if (cur === 'lang') return `<div class="subject-wrap">${tabs}${decks.length ? `<div style="margin-top:12px">
      <div class="section-h"><h3>Språk & glosor</h3><button class="link" data-go="courses">Alla kurser</button></div>
      <button class="go-btn" data-langpass="1" style="margin-bottom:10px;background:var(--ink);box-shadow:var(--shadow)"><div><div class="t">Starta språkpass</div><div class="s">Lektion efter lektion – nya ord, repetition och svårare övningar i ett flöde. Sluta när du vill.</div></div><div class="arrow">${ICON.arrow}</div></button>
      <div class="deck-grid">${decks.map(d => { const pr = deckProgress(p, d); return `<button class="card tap deck" data-deck="${d.id}"><span class="flag">${LANGS[d.lang]?.flag || '🗂️'}</span><div class="de">${d.emoji}</div><div class="dn">${esc(d.name)}</div><div class="dm">${pr.nw === d.words.length ? `${d.words.length} nya ord` : pr.due ? `${pr.due} att repetera` : `${pr.learned}/${d.words.length} lärda`}</div><div class="mastery hi"><i style="width:${Math.max(2, pr.pct)}%"></i></div></button>`; }).join('')}</div>
    </div>` : `<div class="card row"><div class="grow"><b>Språk & glosor</b><div class="muted" style="font-size:.9rem">Spanska, engelska eller egna glosor.</div></div><button class="btn secondary" data-go="courses">Välj kurser</button></div>`}}</div>`;
      const g = cur; const label = subjects.find(x => x[0] === g)[1];
      return `<div class="subject-wrap">${tabs}
      <div class="section-h"><h3>${label}</h3>${g === 'math' ? `<button class="link" data-go="blitz">Blixtläge</button>` : `<span class="muted" style="font-size:.85rem">${shown.filter(s => (s.group || 'math') === g).length} moment</span>`}</div>
      <div class="skill-list">
        ${shown.filter(s => (s.group || 'math') === g).map(s => { const st = skillState(p, s.id); const mv = Math.round(st.m); return `
        <div class="card" style="padding:12px 14px">
          <div class="skill">
            <div class="ic">${s.icon}</div>
            <div class="grow" style="min-width:0">
              <div class="nm">${esc(s.name)}</div>
              <div class="sub"><span>${masteryLabel(st)}</span><span>·</span><span class="lvl-dots" title="Svårighet">${Array.from({ length: s.maxLvl || 3 }, (_, i) => i + 1).map(i => `<i class="${i <= st.lvl ? 'on' : ''}"></i>`).join('')}</span>${st.att ? `<span>· ${st.cor}/${st.att} rätt</span>` : ''}</div>
              <div class="mastery ${masteryClass(mv)}"><i style="width:${Math.max(2, mv)}%"></i></div>
            </div>
            <div class="stack" style="gap:6px"><button class="btn secondary" style="min-height:40px;padding:0 14px" data-skill="${s.id}">Öva</button><button class="btn ghost" style="min-height:34px;padding:0 10px;font-size:.9rem" data-method="${s.id}">${g === 'math' ? 'Så gör man' : 'Läs på'}</button></div>
          </div>
        </div>`; }).join('')}
      </div></div>`;
    })()}
    ${kid.note && kid.note.lines.length ? `<div class="card teacher"><div class="eyebrow">${esc(kid.note.title || 'Kommentar från skolan')}</div><ul style="margin-top:6px">${kid.note.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}
    <div>
      <div class="eyebrow" style="margin-bottom:8px">Märken · ${p.badges.length}/${BADGES.length}</div>
      <div class="badge-row">${BADGES.map(b => `<span class="badge ${p.badges.includes(b.id) ? '' : 'off'}"><span class="e">${b.e}</span>${b.name}</span>`).join('')}</div>
    </div>
  </div>`);
};

VIEWS.sync = () => {
  const kid = kidById(state.kid); const p = prof(kid.id);
  render(`${topbar('Synka enheter', 'home')}
  <div class="stack" style="margin-top:6px">
    <div class="card pad-lg stack" style="gap:10px"><h2>Samma framsteg på telefon och iPad</h2><p class="muted">Framstegen sparas på den enhet du använder. För att flytta dem: kopiera koden här, öppna appen på den andra enheten och klistra in. På iPhone och iPad med samma Apple-ID räcker det att kopiera på den ena och trycka Klistra in på den andra.</p>
      <div class="row"><button class="btn grow" data-act="syncCopy">Kopiera synk-kod</button><button class="btn ghost grow" data-act="syncPaste">Klistra in kod</button></div>
      <div id="syncArea"></div>
      <p class="muted" style="font-size:.85rem">Senast aktiv här: ${p.lastDay ? fmtDate(p.lastDay) : 'ingen aktivitet än'} · ${p.xp} XP · ${activityScore(p)} övningar.</p></div>
  </div>`);
};

VIEWS.courses = () => {
  const kid = kidById(state.kid); const p = prof(kid.id);
  const groups = [['es', 'Spanska 🇪🇸'], ['en', 'Engelska 🇬🇧'], ['sv', 'Egna glosor 🗂️']];
  render(`${topbar('Kurser', 'home')}
  <div class="stack" style="margin-top:6px">
    <p class="muted">Tryck på en kurs för att lägga till eller ta bort den från din startsida. Föräldrar kan lägga in egna glosläxor i föräldraläget.</p>
    ${groups.map(([lang, label]) => { const ds = allDecks(p).filter(d => d.lang === lang || (lang === 'sv' && !d.builtin)); if (!ds.length) return ''; return `<div><div class="eyebrow" style="margin-bottom:8px">${label}</div><div class="deck-grid">${ds.map(d => { const on = p.enabledDecks.includes(d.id); const pr = deckProgress(p, d); return `<button class="card tap deck ${on ? '' : 'locked'}" data-toggle-deck="${d.id}"><span class="flag">${on ? '✅' : '➕'}</span><div class="de">${d.emoji}</div><div class="dn">${esc(d.name)}</div><div class="dm">${d.words.length} ord · nivå ${d.level}${pr.learned ? ` · ${pr.learned} lärda` : ''}</div></button>`; }).join('')}</div></div>`; }).join('')}
  </div>`);
};

VIEWS.method = () => {
  const kid = kidById(state.kid); const s = skillById(kid, state.skillId);
  render(`${topbar(esc(s.name), 'home')}
  <div class="stack" style="margin-top:6px">
    <div class="card pad-lg method"><div class="eyebrow" style="margin-bottom:8px">${(s.group || 'math') === 'math' ? 'Så gör man' : 'Läs på'}</div>${s.lgr ? `<p class="muted" style="font-size:.85rem;margin:0 0 10px"><b>Lgr22 · åk 1–3:</b> <i>${s.lgr}</i></p>` : ''}${s.method}</div>
    ${V2.on(kid) ? `<button class="btn big wide" data-v2="rc" data-skill="${s.id}">🙈 Stäng texten och testa dig själv</button><p class="muted" style="font-size:.85rem;text-align:center;margin-top:-4px">Läs, stäng, försök minnas – sedan jämför du. Det är så kunskap fastnar.</p><button class="btn ghost wide" data-skill="${s.id}">Öva på det här</button>` : `<button class="btn big wide" data-skill="${s.id}">Öva på det här</button>`}
  </div>`);
};

VIEWS.plan = () => {
  const kid = kidById(state.kid); const p = prof(kid.id); const e = p.exams.find(x => x.id === state.examId);
  const days = daysUntil(e.date); const items = [...e.skillIds.map(id => ({ kind: 'skill', id, name: kid.skills.find(s => s.id === id)?.short || id, m: skillState(p, id).m })), ...e.deckIds.map(id => deckById(p, id)).filter(Boolean).map(d => ({ kind: 'deck', id: d.id, name: d.name, m: deckProgress(p, d).pct }))];
  const sorted = items.slice().sort((a, b) => a.m - b.m);
  const rows = []; const n = Math.min(14, Math.max(1, days)); for (let i = 0; i < n; i++) { const a = sorted[i % sorted.length], b = sorted[(i + 1) % sorted.length]; rows.push({ date: addDays(todayKey(), i), items: a === b ? [a] : [a, b] }); }
  render(`${topbar('Provplan', 'home')}
  <div class="stack" style="margin-top:6px">
    <div class="card pad-lg"><div class="eyebrow">${esc(e.title)}</div><h2 style="margin-top:4px">${days > 0 ? `${days} dagar kvar` : days === 0 ? 'Provet är idag' : 'Provet är gjort'}</h2><p class="muted" style="margin-top:6px">Planen föreslår 1–2 korta sprintar per dag och börjar med det som är svagast just nu. Den räknas om varje gång du övar.</p></div>
    <div class="card"><div class="eyebrow" style="margin-bottom:8px">Status per område</div><div class="breakdown">${items.map(it => `<div class="r"><div><div style="font-weight:700">${esc(it.name)}</div><div class="mastery ${masteryClass(it.m)}"><i style="width:${Math.max(2, Math.round(it.m))}%"></i></div></div><span class="m">${Math.round(it.m)}%</span></div>`).join('')}</div></div>
    ${days > 0 ? `<div class="card"><div class="eyebrow" style="margin-bottom:8px">Kommande dagar</div>${rows.map((r, i) => `<div class="plan-day ${i === 0 ? 'today' : ''}"><div class="d">${i === 0 ? 'Idag' : new Date(r.date + 'T00:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric' })}</div><div class="row" style="gap:6px">${r.items.map(it => `<button class="pill acc" style="min-height:34px" data-${it.kind}="${it.id}">${esc(it.name)} ${it.kind === 'skill' ? `· ${p.settings.sprint} st` : ''}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
    <button class="btn big wide" data-test="${e.id}">📝 Kör provläge</button>
  </div>`);
};

VIEWS.shop = () => {
  const kid = kidById(state.kid); const p = prof(kid.id);
  const owned = (it) => it.free ? true : it.kind === 'paper' ? (p.unlocked.includes(it.id) || (it.value === 'rutat')) : it.kind === 'pet' ? p.unlocked.includes(it.id) : it.kind === 'accent' ? p.unlocked.includes(it.id) : false;
  const active = (it) => (it.kind === 'paper' && p.paper === it.value) || (it.kind === 'pet' && p.pet === it.value) || (it.kind === 'accent' && p.accent === it.value);
  const basePets = PETS.filter(x => !x.shop);
  render(`${topbar('Butiken', 'home', `<span class="pill"><span class="gem">${ICON.gem} ${p.gems}</span></span>`)}
  <div class="stack" style="margin-top:6px">
    <p class="muted">Ädelstenar får du av dagliga uppdrag och nya märken. Köp nya papper, färger och följeslagare.</p>
    ${isTeen(kid) || isSport(kid) ? '' : `<div><div class="eyebrow" style="margin-bottom:8px">Följeslagare</div><div class="shop-grid">
      ${basePets.map(x => `<button class="card tap shop-item ${p.pet === x.id ? 'owned' : ''}" data-buy="pet_${x.id}"><div class="se">${x.stages[3]}</div><div class="sn">${x.name}</div><div class="sp muted">${p.pet === x.id ? 'Vald' : 'Byt'}</div></button>`).join('')}
      ${SHOP.filter(i => i.kind === 'pet').map(it => `<button class="card tap shop-item ${active(it) ? 'owned' : ''}" data-buy="${it.id}"><div class="se">${it.e}</div><div class="sn">${it.name}</div><div class="sp ${owned(it) ? 'muted' : 'gem'}">${active(it) ? 'Vald' : owned(it) ? 'Byt' : `💎 ${it.price}`}</div></button>`).join('')}
    </div></div>`}
    <div><div class="eyebrow" style="margin-bottom:8px">Tema</div><div class="shop-grid">
      <button class="card tap shop-item ${p.settings.dark ? 'owned' : ''}" data-buy="theme_dark"><div class="se">🌙</div><div class="sn">Mörkt</div><div class="sp muted">${p.settings.dark ? 'Valt' : 'Byt'}</div></button>
      <button class="card tap shop-item ${p.settings.dark === false || p.settings.dark === undefined ? 'owned' : ''}" data-buy="theme_light"><div class="se">☀️</div><div class="sn">Ljust</div><div class="sp muted">${p.settings.dark === false ? 'Valt' : 'Byt'}</div></button>
      <button class="card tap shop-item ${p.settings.dark === null ? 'owned' : ''}" data-buy="theme_auto"><div class="se">◐</div><div class="sn">Som telefonen</div><div class="sp muted">${p.settings.dark == null ? 'Valt' : 'Byt'}</div></button>
    </div></div>
    <div><div class="eyebrow" style="margin-bottom:8px">Papper</div><div class="shop-grid">
      <button class="card tap shop-item ${p.paper === 'rutat' ? 'owned' : ''}" data-buy="paper_rutat"><div class="se">🟦</div><div class="sn">Rutat papper</div><div class="sp muted">${p.paper === 'rutat' ? 'Valt' : 'Byt'}</div></button>
      ${SHOP.filter(i => i.kind === 'paper').map(it => `<button class="card tap shop-item ${active(it) ? 'owned' : ''}" data-buy="${it.id}"><div class="se">${it.e}</div><div class="sn">${it.name}</div><div class="sp ${owned(it) ? 'muted' : 'gem'}">${active(it) ? 'Valt' : owned(it) ? 'Byt' : `💎 ${it.price}`}</div></button>`).join('')}
    </div></div>
    <div><div class="eyebrow" style="margin-bottom:8px">Färg</div><div class="shop-grid">
      <button class="card tap shop-item ${!p.accent ? 'owned' : ''}" data-buy="acc_default"><div class="se">${kid.hue === 'orange' ? '🟠' : kid.hue === 'pink' ? '🩷' : '🩵'}</div><div class="sn">Min färg</div><div class="sp muted">${!p.accent ? 'Vald' : 'Byt'}</div></button>
      ${SHOP.filter(i => i.kind === 'accent').map(it => `<button class="card tap shop-item ${active(it) ? 'owned' : ''}" data-buy="${it.id}"><div class="se">${it.e}</div><div class="sn">${it.name}</div><div class="sp ${owned(it) ? 'muted' : 'gem'}">${active(it) ? 'Vald' : owned(it) ? 'Byt' : `💎 ${it.price}`}</div></button>`).join('')}
    </div></div>
    <div><div class="eyebrow" style="margin-bottom:8px">Läsbarhet</div><div class="shop-grid">
      <button class="card tap shop-item ${p.settings.font === 'lexend' ? 'owned' : ''}" data-buy="font_toggle"><div class="se">Aa</div><div class="sn">Läsvänligt typsnitt</div><div class="sp muted">${p.settings.font === 'lexend' ? 'På' : 'Av'}</div></button>
      <button class="card tap shop-item ${p.settings.textsize === 'large' ? 'owned' : ''}" data-buy="size_toggle"><div class="se" style="font-size:2.8rem">A</div><div class="sn">Större text</div><div class="sp muted">${p.settings.textsize === 'large' ? 'På' : 'Av'}</div></button>
    </div></div>
    <div><div class="eyebrow" style="margin-bottom:8px">Annat</div><div class="shop-grid">${SHOP.filter(i => i.kind === 'freeze').map(it => `<button class="card tap shop-item" data-buy="${it.id}"><div class="se">${it.e}</div><div class="sn">${it.name}</div><div class="sp gem">💎 ${it.price} · du har ${p.freezes}</div></button>`).join('')}</div></div>
  </div>`);
};
function buy(kid, id) {
  const p = prof(kid.id);
  if (id === 'paper_rutat') { p.paper = 'rutat'; save(); applyLook(kid); return VIEWS.shop(); }
  if (id === 'acc_default') { p.accent = null; save(); applyLook(kid); return VIEWS.shop(); }
  if (id === 'font_toggle') { p.settings.font = p.settings.font === 'lexend' ? 'standard' : 'lexend'; save(); applyLook(kid); return VIEWS.shop(); }
  if (id === 'size_toggle') { p.settings.textsize = p.settings.textsize === 'large' ? 'normal' : 'large'; save(); applyLook(kid); return VIEWS.shop(); }
  if (id.startsWith('theme_')) { p.settings.dark = id === 'theme_dark' ? true : id === 'theme_light' ? false : null; save(); applyLook(kid); return VIEWS.shop(); }
  const base = PETS.find(x => !x.shop && 'pet_' + x.id === id); if (base) { p.pet = base.id; save(); toast(`${base.name} följer med dig nu`); return VIEWS.shop(); }
  const it = SHOP.find(x => x.id === id); if (!it) return;
  const owned = p.unlocked.includes(it.id) || it.free;
  if (!owned || it.repeat) { if (p.gems < it.price) { beep('no'); return toast(`Du behöver ${it.price - p.gems} 💎 till`); } p.gems -= it.price; if (!it.repeat) p.unlocked.push(it.id); }
  if (it.kind === 'paper') p.paper = it.value; if (it.kind === 'pet') p.pet = it.value; if (it.kind === 'accent') p.accent = it.value; if (it.kind === 'freeze') p.freezes++;
  save(); beep('gem'); applyLook(kid); toast(owned && !it.repeat ? 'Bytt!' : `Köpt: ${it.name}`); VIEWS.shop();
}

/* ========= Language flow: choose the next deck so a session can run for an hour ========= */
function virtualMixDeck(p, lang) {
  const ds = enabledDecks(p).filter(d => d.lang === lang); const words = ds.flatMap(d => d.words);
  return { id: 'mix_' + lang, lang, name: `Blandad repetition · ${LANGS[lang]?.name || ''}`.trim(), emoji: '🔁', level: 9, builtin: true, noSpell: ds.every(d => d.noSpell), words };
}
function nextDeckAfter(kid, currentId) {
  const p = prof(kid.id); const now = Date.now();
  const cur = deckById(p, currentId);
  const work = (d) => d.words.filter(w => !p.words[w.id] || p.words[w.id].due <= now).length;
  if (cur && work(cur) >= 4) return { deck: cur, reason: `${work(cur)} ord kvar att öva i ${cur.name}` };
  const lang = cur ? cur.lang : null;
  const sameLang = enabledDecks(p).filter(d => d.id !== currentId && (!lang || d.lang === lang)).sort((a, b) => a.level - b.level || deckProgress(p, a).pct - deckProgress(p, b).pct);
  const withWork = sameLang.find(d => work(d) >= 3);
  if (withWork) return { deck: withWork, reason: work(withWork) === d_new(p, withWork) ? `${work(withWork)} nya ord` : `${work(withWork)} ord att öva` };
  const other = enabledDecks(p).filter(d => d.id !== currentId && lang && d.lang !== lang).sort((a, b) => a.level - b.level).find(d => work(d) >= 3);
  if (other) return { deck: other, reason: `${work(other)} ord att öva` };
  if (lang) { const mix = virtualMixDeck(p, lang); if (mix.words.length >= 8) return { deck: mix, reason: 'alla ord är repeterade för idag – nu blandat på tid' }; }
  return null;
}
const d_new = (p, d) => d.words.filter(w => !p.words[w.id]).length;

/* ========= Sessions (sprints, lessons, tests) ========= */
let S = null;
function pickSkills(kid, ids, n) {
  const p = prof(kid.id); const out = [];
  const pool = ids.map(id => skillById(kid, id)).filter(Boolean);
  if (!pool.length) return out;
  if (pool.length === 1) return Array(n).fill(pool[0]);
  const weights = pool.map(s => { const st = skillState(p, s.id); const stale = Math.min(3, (Date.now() - st.last) / DAYMS); return 20 + (100 - st.m) + stale * 10 + (s.focus ? 10 : 0); });
  let last = null, run = 0;
  for (let i = 0; i < n; i++) {
    const total = weights.reduce((a, b) => a + b, 0); let r = Math.random() * total; let chosen = pool[0];
    for (let j = 0; j < pool.length; j++) { r -= weights[j]; if (r <= 0) { chosen = pool[j]; break; } }
    if (chosen === last && run >= 2) chosen = pool[(pool.indexOf(chosen) + 1) % pool.length];
    run = chosen === last ? run + 1 : 1; last = chosen; out.push(chosen);
  }
  return out;
}
const skillById = (kid, id) => kid.skills.find(s => s.id === id) || (kid.v2skills || []).find(s => s.id === id);
function makeQuestion(kid, skill, levelOverride, genOpts) {
  const st = skillState(prof(kid.id), skill.id); const lvl = levelOverride || st.lvl;
  let q = skill.gen(lvl, genOpts || {});
  if (!genOpts?.noOpen && ['ekvation', 'forenkla', 'problemekv'].includes(skill.id) && q.steps && q.steps.length >= 4 && R.chance(0.15)) {
    const items = q.steps.slice(0, -1).map(st => st.replace(/^<b>[^<]*<\/b>\s*/, ''));
    q = { type: 'order', text: `Sätt lösningens steg i rätt ordning:<br><span class="muted" style="font-size:1rem">${q.text}</span>`, items, answer: items, steps: [`<b>Rätt ordning:</b><ol style="margin:6px 0 0;padding-left:20px">${items.map(i => `<li>${i}</li>`).join('')}</ol>`], hint: 'Vad måste göras först? Oftast: ta bort parenteser, förenkla, samla, dela.', level: lvl };
  }
  q.skill = skill; q.level = lvl; q.cat = 'math'; return q;
}
function startSession(kid, opts) {
  const p = prof(kid.id); const n = opts.n || p.settings.sprint;
  let queue = [];
  if (opts.mode === 'felbok') {
    const list = R.shuffle((p.mistakes || []).slice()).slice(0, opts.n || 10);
    for (const mi of list) {
      if (mi.cat === 'word') { const d = deckById(p, mi.deckId); const w = d && d.words.find(x => x.id === mi.wordId); if (d && w) queue.push({ ...makeWordExercise(d, w, R.pick(['pick', 'type'])), cat: 'word' }); }
      else { const sk = skillById(kid, mi.skillId); if (sk) queue.push({ ...mi.q, skill: sk, cat: 'math', mistakeId: mi.id }); }
    }
    if (!queue.length) { toast('Felboken är tom!'); return go('home'); }
  } else if (opts.mode === 'test') {
    const exam = p.exams.find(e => e.id === opts.examId);
    const skills = exam.skillIds.map(id => skillById(kid, id)).filter(Boolean);
    const mathSkills = skills.filter(s => (s.group || 'math') === 'math'), quizSkills = skills.filter(s => (s.group || 'math') !== 'math');
    const decks = exam.deckIds.map(id => deckById(p, id)).filter(Boolean);
    const parts = (mathSkills.length ? 1 : 0) + (quizSkills.length ? 1 : 0) + (decks.length ? 1 : 0);
    const pickFrom = (arr, n) => { const out = []; const focus = arr.filter(s => s.focus); for (let i = 0; i < n; i++) out.push(focus.length && i % 2 === 0 ? focus[(i / 2) % focus.length] : arr[i % arr.length]); return R.shuffle(out); };
    if (mathSkills.length) {
      const scale = parts > 1 ? 0.6 : 1;
      pickFrom(mathSkills, Math.round(6 * scale)).forEach(sk => queue.push({ ...makeQuestion(kid, sk, 1), part: 'E' }));
      pickFrom(mathSkills, Math.round(5 * scale)).forEach(sk => queue.push({ ...makeQuestion(kid, sk, 2), part: 'C' }));
      pickFrom(mathSkills, Math.round(4 * scale)).forEach(sk => queue.push({ ...makeQuestion(kid, sk, 3), part: 'A' }));
    }
    if (quizSkills.length) {
      const scale = parts > 1 ? 0.6 : 1;
      pickFrom(quizSkills, Math.round(8 * scale)).forEach(sk => queue.push({ ...makeQuestion(kid, sk, 1, { noOpen: true }), part: 'E' }));
      const withOpen = quizSkills.filter(sk => OPEN[sk.id] && OPEN[sk.id].length);
      R.shuffle(withOpen).slice(0, Math.round(4 * scale)).forEach(sk => { const oq = makeOpenQuestion(sk.id, 2); if (oq) { oq.skill = sk; oq.cat = 'math'; oq.part = 'C'; queue.push(oq); } });
    }
    if (decks.length) {
      const wordN = parts > 1 ? 6 : 12; const words = [];
      let di = 0; while (words.length < wordN && di < decks.length * 3) { const d = decks[di % decks.length]; di++; const ws = R.shuffle(d.words).slice(0, Math.ceil(wordN / decks.length)); for (const w of ws) { const box = wordState(p, w.id).box; const kind = d.lang === 'sv' ? (box >= 2 ? 'type' : 'pickRev') : d.noSpell ? R.pick(['pick', 'pickRev']) : box >= 2 ? R.pick(['type', 'spell', 'pickRev']) : R.pick(['pick', 'spell']); words.push({ ...makeWordExercise(d, w, kind), cat: 'word', part: kind === 'type' ? 'C' : 'E' }); } }
      queue.push(...R.shuffle(words).slice(0, wordN));
    }
    if (!queue.length) queue = pickSkills(kid, kid.skills.map(s => s.id), 12).map(sk => ({ ...makeQuestion(kid, sk), part: 'E' }));
    // E-delen först, sedan C, sedan A – som ett riktigt prov
    const order = { E: 0, C: 1, A: 2 }; queue.sort((a, b) => order[a.part] - order[b.part]);
    opts = { ...opts, timeLimit: Math.max(10, Math.round(queue.length * 2.5)) * 60000 };
  } else if (opts.deckIds && opts.deckIds.length && (opts.wordsOnly || !opts.skillIds || !opts.skillIds.length)) {
    const deck = opts.deck || (opts.deckIds.length === 1 ? deckById(p, opts.deckIds[0]) : deckById(p, R.pick(opts.deckIds)));
    const isMix = deck.id.startsWith('mix_');
    queue = buildLesson(p, deck, Math.max(n, 12), isMix ? { newWords: 0 } : {}).map(x => ({ ...x, cat: 'word', deck }));
    opts = { ...opts, deck, chain: true };
  } else {
    const mathN = opts.deckIds && opts.deckIds.length ? Math.ceil(n * 0.6) : n;
    queue = pickSkills(kid, opts.skillIds, mathN).map(sk => makeQuestion(kid, sk));
    if (opts.deckIds && opts.deckIds.length) { const deck = deckById(p, R.pick(opts.deckIds)); const words = buildLesson(p, deck, n - mathN, { noMatch: true, newWords: 1 }).map(x => ({ ...x, cat: 'word' })); queue = [...queue, ...words.filter(w => w.kind === 'intro'), ...R.shuffle([...words.filter(w => w.kind !== 'intro')])]; }
  }
  const chain = opts.chainStats || null;
  S = { kid, mode: opts.mode || 'practice', opts, queue, i: 0, results: [], xp: 0, usedHelp: false, retried: false, startedAt: Date.now(), streak: 0, revealed: false, answered: false, examId: opts.examId, deadline: opts.mode === 'test' ? Date.now() + opts.timeLimit : null, chain: chain ? { ...chain, lessons: chain.lessons + 1 } : (opts.chain ? { start: Date.now(), lessons: 1, items: 0, correct: 0, xp: 0 } : null) };
  LE.sessionStart(S); // Fas 3B: skuggläge – sparar v1 faktiskt + vad v2 skulle ha valt
  state.screen = 'practice'; VIEWS.practice(); if (!opts.chainStats && !opts.bonus) beep('start');
  if (S.mode === 'test' || p.settings.timer) S.timer = setInterval(() => { const el = document.getElementById('timer'); if (!el) return; if (S.deadline) { const left = S.deadline - Date.now(); el.textContent = fmtTime(left) + ' kvar'; if (left <= 0) { clearInterval(S.timer); toast('Tiden är ute – provet rättas'); while (S.results.length < S.queue.length) S.results.push(false); finishSession(); } } else el.textContent = fmtTime(Date.now() - S.startedAt); }, 1000);
}

VIEWS.practice = () => {
  const item = S.queue[S.i]; const kid = S.kid; const p = prof(kid.id);
  const isTest = S.mode === 'test' || !!(S.v2 && S.v2.exam); const focus = p.settings.focus;
  const title = S.v2 ? V2.title(item) : isTest ? 'Provläge' : S.mode === 'felbok' ? 'Felboken' : item.cat === 'word' ? esc(item.deck.name) : esc(item.skill.short || item.skill.name);
  const left = S.queue.length - S.i;
  const right = S.v2 ? V2.topRight() : isTest ? `<span class="timer" id="timer">${fmtTime(S.deadline - Date.now())} kvar</span>` : S.opts.bonus ? `<span class="pill warn">2× XP</span>` : p.settings.timer ? `<span class="timer" id="timer">${fmtTime(Date.now() - S.startedAt)}</span>` : focus ? `<span class="left-count">${left} kvar</span>` : `<span class="pill acc">${S.xp} XP</span>`;
  let body;
  if (item.cat === 'learn') body = V2.teachBody(item);
  else if (item.cat === 'word') body = wordBody(item);
  else body = mathBody(item, kid, isTest);
  render(`
  ${topbar(title, 'home', right)}
  <div class="stack" style="margin-top:6px">
    ${S.v2 ? V2.progressBar() + V2.chip(item) : `<div class="progress">${S.queue.map((_, i) => `<i class="${i < S.i ? (S.results[i] ? 'ok' : 'no') : i === S.i ? 'cur' : ''}"></i>`).join('')}</div>`}
    <div class="card pad-lg stack" id="qcard" style="gap:16px">${body}</div>
  </div>`);
  initSketch();
  const input = document.getElementById('ans');
  if (input && kid.template !== 'ak2' && !(item.cat === 'math' && item.type === 'num' && kid.template === 'ak4' && focus)) setTimeout(() => input.focus({ preventScroll: true }), 50);
  if (input && input.tagName !== 'TEXTAREA') input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('submit')?.click(); } });
  if (item.cat === 'word' && (item.kind === 'intro' || item.kind === 'listen' || (item.kind === 'pick' && item.speak)) && p.settings.tts) setTimeout(() => TTS.speak(item.word.w, item.deck.lang), 250);
  if (S.v2) V2.afterRender(item);
  LE.shown(S);
};
function mathBody(q, kid, isTest) {
  const vars = q.variables || [q.variable];
  if (q.type === 'order') S.order = { picked: [], shuffled: R.shuffle(q.items.map((t, i) => ({ t, i }))) };
  const inputHtml = q.type === 'order'
    ? `<div class="slots order-slots" id="orderSlots"><span class="muted" style="font-size:.9rem;align-self:center">Tryck på stegen i rätt ordning</span></div><div class="order-pool" id="orderPool">${S.order.shuffled.map(o => `<button class="otile" data-otile="${o.i}">${o.t}</button>`).join('')}</div>`
    : q.type === 'open'
    ? `<textarea class="answer-input" id="ans" rows="4" style="text-align:left;font-family:var(--body);font-weight:400;font-size:1.05rem;min-height:110px;resize:vertical" placeholder="Skriv med egna ord, som på ett prov. Få med de viktiga begreppen."></textarea><p class="muted" style="font-size:.85rem;margin-top:6px">Appen letar efter ${q.keys.length} nyckelbegrepp i ditt svar.</p>`
    : q.type === 'choicetext'
    ? `<div class="wchoices" id="choices">${q.choices.map((c, i) => `<button class="wchoice" data-choice="${i}"><span>${esc(c)}</span></button>`).join('')}</div>`
    : q.choices
    ? `<div class="choices" id="choices">${q.choices.map(c => `<button class="choice" data-choice="${c}">${T.n(c)}</button>`).join('')}</div>`
    : q.type === 'expr'
      ? `<input class="answer-input" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="t.ex. ${q.variable === 'n' ? '3n + 1' : vars.length > 1 ? `6${vars[0]}${vars[1]} + 9${vars[0]}` : '6x + 15'}" aria-label="Ditt svar">
         <div class="keys" style="margin-top:8px">
           ${['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'].map(k => `<button class="key" data-key="${k}">${k}</button>`).join('')}
           ${vars.map(v => `<button class="key acc" data-key="${v}">${v}</button>`).join('')}${vars.length === 1 ? `<button class="key acc" data-key="${q.variable}²">${q.variable}²</button>` : ''}
           ${q.eq ? '<button class="key" data-key=" = ">=</button>' : ''}<button class="key" data-key=" + ">+</button><button class="key" data-key=" − ">−</button><button class="key" data-key="(">(</button><button class="key" data-key=")">)</button><button class="key wide" data-key="⌫">⌫</button>
         </div>`
      : q.type === 'num'
        ? `<input class="answer-input" id="ans" inputmode="${q.answer < 0 ? 'text' : Number.isInteger(q.answer) ? 'numeric' : 'decimal'}" autocomplete="off" placeholder="${Number.isInteger(q.answer) ? '?' : 't.ex. 2,5'}" aria-label="Ditt svar">
           ${kid.template === 'ak2' || q.answer < 0 ? `<div class="keys" style="margin-top:8px;grid-template-columns:repeat(6,1fr)">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(k => `<button class="key" data-key="${k}">${k}</button>`).join('')}<button class="key" data-key="−">−</button><button class="key" data-key="⌫">⌫</button></div>` : ''}`
        : `<input class="answer-input" id="ans" autocomplete="off" autocapitalize="off" placeholder="Skriv svaret" aria-label="Ditt svar">`;
  const p = prof(kid.id);
  return `<div class="row" style="justify-content:space-between"><span class="eyebrow">Uppgift ${S.i + 1} av ${S.v2 ? V2.total() : S.queue.length}${isTest && q.part ? ` · ${q.part}-nivå` : ''}${!isTest && !p.settings.focus ? ` · ${esc(q.skill.short || '')}` : ''}</span><span class="row" style="gap:8px">${TTS.ok && p.settings.tts ? `<button class="icon-btn" data-speak="${esc(q.text.replace(/<[^>]+>/g, ''))}" data-lang="sv" data-highlight="1" style="width:36px;height:36px" aria-label="Läs upp">${ICON.speaker}</button>` : ''}<span class="lvl-dots" aria-label="Svårighet ${q.level}">${[1, 2, 3].map(i => `<i class="${i <= q.level ? 'on' : ''}"></i>`).join('')}</span></span></div>
      ${q.fig ? `<div class="figwrap">${safeHtml(q.fig)}</div>` : ''}
      <div class="question" id="qtext">${safeHtml(q.text)}</div>
      <div id="inputArea">${inputHtml}</div>
      <div id="fb"></div>
      <div class="row" id="actions">
        <button class="btn grow" id="submit" ${q.choices || q.type === 'choicetext' || q.type === 'order' ? 'disabled' : ''}>Svara</button>
        ${q.type === 'order' ? `<button class="btn ghost" id="undoOrder">⌫</button>` : ''}
        ${isTest ? '' : `<button class="btn ghost" id="hintBtn">💡 Ledtråd</button>`}
      </div>
      ${isTest ? '' : `<button class="btn ghost wide" id="explainBtn" style="border-style:dashed">🤔 Jag fattar inte – visa hur man gör</button>`}
      ${q.type !== 'choicetext' && q.type !== 'order' && q.type !== 'open' && (q.skill.group || 'math') === 'math' ? `<details class="sketch" id="sketch"><summary>✏️ Kladdyta – räkna här innan du svarar</summary><div class="sketch-wrap"><canvas id="sketchCanvas" width="600" height="320"></canvas><div class="row" style="margin-top:6px"><button class="btn ghost" style="min-height:36px" id="sketchClear">Rensa</button><span class="muted" style="font-size:.85rem">Rita med fingret. Kladden sparas inte.</span></div></div></details>` : ''}`;
}
function initSketch() {
  const det = document.getElementById('sketch'); const cv = document.getElementById('sketchCanvas'); if (!det || !cv) return;
  const ctx = cv.getContext('2d'); if (!ctx) return; let drawing = false, last = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1d2433';
  cv.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); e.preventDefault(); });
  cv.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; e.preventDefault(); });
  const stop = () => { drawing = false; }; cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
  document.getElementById('sketchClear')?.addEventListener('click', () => ctx.clearRect(0, 0, cv.width, cv.height));
}
function wordBody(ex) {
  const lang = ex.deck.lang; const head = `<div class="row" style="justify-content:space-between"><span class="eyebrow">${S.i + 1} av ${S.v2 ? V2.total() : S.queue.length} · ${esc(ex.title || 'Nytt ord')}</span><span>${LANGS[lang]?.flag || ''}</span></div>`;
  if (ex.kind === 'intro') { const sv = lang === 'sv'; return `${head}<div class="word-card"><div class="eyebrow">${sv ? 'Nytt kort' : 'Nytt ord'}</div><div class="we">${ex.word.e || '✨'}</div><div class="ww">${esc(sv ? ex.word.t : ex.word.w)}</div><div class="wt">${esc(sv ? ex.word.w : ex.word.t)}</div>${sv ? '' : speakBtn(ex.word.w, lang)}</div><div class="row" id="actions"><button class="btn grow big" id="next">Jag har sett det → </button></div>`; }
  if (ex.kind === 'pick') return `${head}<div class="word-card"><div class="we" style="font-size:${ex.promptEmoji ? '3.6rem' : '0'}">${ex.promptEmoji}</div><div class="ww">${esc(ex.prompt)}</div>${ex.speak ? speakBtn(ex.word.w, lang) : ''}</div><div class="wchoices">${ex.choices.map(c => `<button class="wchoice" data-wchoice="${c.id}">${c.e ? `<span class="ce">${esc(c.e)}</span>` : ''}<span>${esc(c.label)}</span></button>`).join('')}</div><div id="fb"></div><div class="row" id="actions"></div>`;
  if (ex.kind === 'listen') return `${head}<div class="word-card"><div class="eyebrow">Tryck och lyssna</div>${speakBtn(ex.word.w, lang, 'big')}<button class="pill" data-speak="${esc(ex.word.w)}" data-lang="${lang}" data-rate="0.6">🐢 Långsamt</button></div><div class="wchoices">${ex.choices.map(c => `<button class="wchoice" data-wchoice="${c.id}"><span>${esc(c.label)}</span></button>`).join('')}</div><div id="fb"></div><div class="row" id="actions"></div>`;
  if (ex.kind === 'match') {
    S.match = { left: R.shuffle(ex.pairs.map(w => ({ id: w.id, label: w.w }))), right: R.shuffle(ex.pairs.map(w => ({ id: w.id, label: w.t }))), done: new Set(), sel: null, mistakes: 0, firstTry: new Set(ex.pairs.map(w => w.id)) };
    return `${head}<p style="text-align:center;font-weight:700">Para ihop ${LANGS[lang]?.name.toLowerCase() || 'orden'} med svenska</p><div class="match-grid"><div class="match-col">${S.match.left.map(t => `<button class="mtile" data-mside="l" data-mid="${t.id}">${esc(t.label)}</button>`).join('')}</div><div class="match-col">${S.match.right.map(t => `<button class="mtile" data-mside="r" data-mid="${t.id}">${esc(t.label)}</button>`).join('')}</div></div><div id="fb"></div><div class="row" id="actions"></div>`;
  }
  if (ex.kind === 'speak') return `${head}<div class="word-card"><div class="we">${ex.word.e || '🗣️'}</div><div class="ww">${esc(ex.word.w)}</div><div class="wt">${esc(ex.word.t)}</div><div class="row" style="justify-content:center;gap:10px">${speakBtn(ex.word.w, lang)}<button class="speak-btn big" id="micBtn" aria-label="Säg ordet" style="background:var(--acc);color:#fff">${ICON.mic}</button></div><div class="muted" id="micStatus">Tryck på mikrofonen och säg ordet</div></div><div id="fb"></div><div class="row" id="actions"><button class="btn ghost grow" id="skipSpeak">Hoppa över</button></div>`;
  if (ex.kind === 'spell') { S.spell = { picked: [] }; return `${head}<div class="prompt-row"><span class="pe">${ex.promptEmoji}</span><span>${esc(ex.prompt)}</span></div><div class="slots" id="slots"><span class="muted" style="font-size:.9rem;align-self:center">Tryck på bokstäverna</span></div><div class="ltiles" id="ltiles">${ex.tiles.map(t => `<button class="ltile" data-tile="${t.i}">${esc(t.c)}</button>`).join('')}</div><div id="fb"></div><div class="row" id="actions"><button class="btn grow" id="submit" disabled>Svara</button><button class="btn ghost" id="undoTile">⌫</button></div>`; }
  // type
  return `${head}<div class="prompt-row"><span class="pe">${ex.promptEmoji}</span><span>${esc(ex.prompt)}</span></div><input class="answer-input" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Skriv på ${LANGS[lang]?.name.toLowerCase()}" aria-label="Ditt svar"><div id="fb"></div><div class="row" id="actions"><button class="btn grow" id="submit">Svara</button>${S.v2 && S.v2.exam ? '' : `<button class="btn ghost" id="hintBtn">💡</button>`}</div>`;
}

function onPractice(e) {
  const item = S.queue[S.i]; const t = e.target;
  if (item && item.cat === 'learn') return;
  if (t.closest('#next')) { if (item.cat === 'word' && item.kind === 'intro' && !S.answered) { S.answered = true; S.results.push(true); } return nextQuestion(); }
  if (S.answered) return;
  if (item.cat === 'math') return onMath(e, item);
  const ex = item;
  const wc = t.closest('[data-wchoice]');
  if (wc) { const id = wc.dataset.wchoice; const correct = id === ex.correctId; document.querySelectorAll('.wchoice').forEach(b => { b.disabled = true; if (b.dataset.wchoice === ex.correctId) b.classList.add('ok'); else if (b.dataset.wchoice === id) b.classList.add('no'); }); return finishWord(ex, correct, ex.kind === 'pick' && ex.rev ? ex.word.w : null); }
  const mt = t.closest('[data-mid]');
  if (mt && S.match) {
    const side = mt.dataset.mside, id = mt.dataset.mid; const M = S.match;
    if (M.sel && M.sel.side === side) { document.querySelectorAll('.mtile.sel').forEach(x => x.classList.remove('sel')); M.sel = { side, id, el: mt }; mt.classList.add('sel'); return; }
    if (!M.sel) { M.sel = { side, id, el: mt }; mt.classList.add('sel'); return; }
    if (M.sel.id === id) { M.sel.el.classList.add('done'); mt.classList.add('done'); M.sel.el.classList.remove('sel'); M.done.add(id); M.sel = null; beep('tick'); if (M.firstTry.has(id)) recordWordAnswer(S.kid.id, id, true); if (M.done.size === ex.pairs.length) { S.answered = true; const ok = M.mistakes <= 1; S.results.push(ok); S.xp += ok ? 10 : 4; document.getElementById('fb').innerHTML = `<div class="feedback ok"><span>🎉</span><div><div class="big">Alla par klara!</div><div class="sub">${M.mistakes === 0 ? 'Utan ett enda fel.' : `${M.mistakes} fel på vägen.`}</div></div></div>`; document.getElementById('actions').innerHTML = `<button class="btn grow" id="next">Nästa →</button>`; } return; }
    M.mistakes++; M.firstTry.delete(id); M.firstTry.delete(M.sel.id); recordWordAnswer(S.kid.id, id, false); beep('no'); mt.classList.add('no'); M.sel.el.classList.add('no'); const a = M.sel.el; M.sel.el.classList.remove('sel'); M.sel = null; setTimeout(() => { mt.classList.remove('no'); a.classList.remove('no'); }, 450); return;
  }
  const tile = t.closest('[data-tile]');
  if (tile && S.spell) { tile.classList.add('used'); S.spell.picked.push({ i: tile.dataset.tile, c: tile.textContent }); renderSlots(); return; }
  if (t.closest('#undoTile') && S.spell) { const last = S.spell.picked.pop(); if (last) document.querySelector(`[data-tile="${last.i}"]`)?.classList.remove('used'); renderSlots(); return; }
  if (t.closest('#micBtn') && ex.kind === 'speak') { startListening(ex); return; }
  if (t.closest('#skipSpeak') && ex.kind === 'speak') { S.answered = true; S.results.push(true); return nextQuestion(); }
  if (t.closest('#hintBtn') && ex.kind === 'type') { S.usedHelp = true; document.getElementById('fb').innerHTML = `<div class="hint">💡 ${esc(ex.word.w.length)} tecken, börjar på <b>${esc(ex.word.w[0])}</b>${ex.word.w.includes(' ') ? ` och har ${ex.word.w.split(' ').length} ord` : ''}.</div>`; t.closest('#hintBtn').disabled = true; return; }
  if (t.closest('#submit')) {
    const raw = ex.kind === 'spell' ? S.spell.picked.map(x => x.c).join('') : document.getElementById('ans').value;
    const res = checkWordAnswer(ex, raw);
    if (res.status === 'empty') return toast('Skriv ett svar först');
    const input = document.getElementById('ans'); if (input) input.disabled = true;
    return finishWord(ex, res.status === 'correct', null, res.note);
  }
}
function speakHighlight(el, lang) {
  if (!el || !TTS.ok) return;
  if (!el.dataset.wrapped) { // wrap text nodes' words in spans once
    const walk = (node) => { [...node.childNodes].forEach(ch => { if (ch.nodeType === 3 && ch.textContent.trim()) { const frag = document.createDocumentFragment(); ch.textContent.split(/(\s+)/).forEach(part => { if (part.trim()) { const sp = document.createElement('span'); sp.className = 'w'; sp.textContent = part; frag.appendChild(sp); } else frag.appendChild(document.createTextNode(part)); }); node.replaceChild(frag, ch); } else if (ch.nodeType === 1) walk(ch); }); };
    walk(el); el.dataset.wrapped = '1';
  }
  const spans = [...el.querySelectorAll('span.w')]; const text = spans.map(s => s.textContent).join(' ');
  const starts = []; let pos = 0; spans.forEach(s => { starts.push(pos); pos += s.textContent.length + 1; });
  try {
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); const code = LANGS[lang]?.tts || 'sv-SE'; u.lang = code; u.rate = 0.95;
    const v = TTS.voices.find(x => x.lang === code) || TTS.voices.find(x => x.lang.startsWith(code.slice(0, 2))); if (v) u.voice = v;
    u.onboundary = (ev) => { if (ev.name && ev.name !== 'word') return; let idx = 0; for (let i = 0; i < starts.length; i++) if (starts[i] <= ev.charIndex) idx = i; spans.forEach((s, i) => s.classList.toggle('hl', i === idx)); };
    u.onend = () => spans.forEach(s => s.classList.remove('hl'));
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
function startListening(ex) {
  if (!SR) return toast('Taligenkänning saknas i den här webbläsaren');
  const status = document.getElementById('micStatus'); const btn = document.getElementById('micBtn');
  try { speechSynthesis?.cancel(); } catch (e) { /* ignore */ }
  const rec = new SR(); rec.lang = LANGS[ex.deck.lang]?.tts || 'en-GB'; rec.interimResults = false; rec.maxAlternatives = 5;
  status.textContent = 'Lyssnar…'; btn.classList.add('listening');
  rec.onresult = (ev) => {
    const alts = [...ev.results[0]].map(r => r.transcript); const target = normLoose(coreWord(ex.word.w)); const tw = target.split(' ');
    const best = alts.map(a => { const na = normLoose(a); const hit = tw.filter(w => na.includes(w)).length; return { a, score: hit / tw.length, exact: na === target || na.includes(target) }; }).sort((x, y) => y.score - x.score)[0];
    const ok = best && (best.exact || best.score >= 0.6 || (tw.length === 1 && levenshtein(normLoose(best.a), target) <= 1));
    status.innerHTML = `Jag hörde: <b>${esc(best ? best.a : '…')}</b>`;
    if (ok) finishWord(ex, true, null, 'Bra uttal!');
    else { S.speakTries = (S.speakTries || 0) + 1; beep('no'); if (S.speakTries >= 2) { finishWord(ex, false); } else status.innerHTML += ' – försök igen, lyssna först på ordet.'; }
  };
  rec.onerror = () => { status.textContent = 'Det gick inte att lyssna. Prova igen eller hoppa över.'; btn.classList.remove('listening'); };
  rec.onend = () => btn.classList.remove('listening');
  try { rec.start(); } catch (e) { status.textContent = 'Kunde inte starta mikrofonen.'; }
}
function renderSlots() { const el = document.getElementById('slots'); el.innerHTML = S.spell.picked.length ? S.spell.picked.map(x => `<span class="ltile">${esc(x.c)}</span>`).join('') : `<span class="muted" style="font-size:.9rem;align-self:center">Tryck på bokstäverna</span>`; document.getElementById('submit').disabled = !S.spell.picked.length; }
function finishWord(ex, correct, revealForeign, note) {
  S.answered = true;
  const xp = recordWordAnswer(S.kid.id, ex.word.id, correct);
  if (S.mode === 'felbok') { const p = prof(S.kid.id); if (correct) { clearMistake(p, 'w_' + ex.word.id); save(); } }
  else if (!correct) { noteMistake(prof(S.kid.id), ex); save(); }
  if (correct) { S.streak++; } else S.streak = 0;
  S.xp += xp; S.results.push(correct);
  if (S.v2) { V2.observeWord(ex, correct); if (S.v2.exam) return V2.examAnswered(ex, correct, document.getElementById('ans')?.value || ''); }
  const fb = document.getElementById('fb');
  if (correct) { beep('ok', S.streak); xpPop(xp); fb.innerHTML = `<div class="feedback ok"><span style="font-size:1.4rem">✅</span><div><div class="big">${R.pick(['¡Muy bien!', 'Rätt!', 'Snyggt!', 'Perfekt!', 'Boom!'])}</div><div class="sub">${esc(ex.word.w)} = ${esc(ex.word.t)}${note ? `<br>${note}` : ''}</div></div></div>`; }
  else { beep('no'); fb.innerHTML = `<div class="feedback no"><span style="font-size:1.4rem">❌</span><div><div class="big">Inte riktigt</div><div class="sub"><b>${esc(ex.word.w)}</b> = ${esc(ex.word.t)}. Ordet kommer tillbaka snart.</div></div></div>`; if (!correct && S.mode === 'practice' && !S.v2 && S.queue.length < 18) S.queue.push({ ...makeWordExercise(ex.deck, ex.word, 'pick'), cat: 'word' }); }
  if (TTS.ok && prof(S.kid.id).settings.tts) TTS.speak(ex.word.w, ex.deck.lang);
  document.querySelectorAll('.ltile, #undoTile').forEach(b => b.disabled = true);
  document.getElementById('actions').innerHTML = `<button class="btn grow" id="next">${(S.v2 ? V2.hasNext() : S.i + 1 < S.queue.length) ? 'Nästa →' : 'Visa resultat'}</button>`;
  document.getElementById('next').focus({ preventScroll: true });
}
function renderOrder() { const el = document.getElementById('orderSlots'); const O = S.order; el.innerHTML = O.picked.length ? O.picked.map((i, n) => `<div class="otile picked"><span class="onum">${n + 1}</span>${S.queue[S.i].items[i]}</div>`).join('') : `<span class="muted" style="font-size:.9rem;align-self:center">Tryck på stegen i rätt ordning</span>`; document.getElementById('submit').disabled = O.picked.length !== S.queue[S.i].items.length; }
function onMath(e, q) {
  const ot = e.target.closest('[data-otile]');
  if (ot && S.order) { ot.classList.add('used'); S.order.picked.push(Number(ot.dataset.otile)); renderOrder(); return; }
  if (e.target.closest('#undoOrder') && S.order) { const last = S.order.picked.pop(); if (last !== undefined) document.querySelector(`[data-otile="${last}"]`)?.classList.remove('used'); renderOrder(); return; }
  const key = e.target.closest('[data-key]'); const input = document.getElementById('ans');
  if (key && input) { const k = key.dataset.key; if (k === '⌫') input.value = input.value.trimEnd().slice(0, -1).trimEnd(); else input.value = (input.value + k).replace(/\s{2,}/g, ' '); input.focus({ preventScroll: true }); return; }
  const ch = e.target.closest('[data-choice]');
  if (ch) { document.querySelectorAll('.choice, .wchoice').forEach(c => c.classList.remove('sel')); ch.classList.add('sel'); S.selected = Number(ch.dataset.choice); document.getElementById('submit').disabled = false; if (S.kid.template === 'ak2' || prof(S.kid.id).settings.focus || q.type === 'choicetext') document.getElementById('submit').click(); return; }
  if (e.target.closest('#hintBtn')) { S.usedHelp = true; document.getElementById('fb').innerHTML = `<div class="hint">💡 ${safeHtml(q.hint)}</div>`; e.target.closest('#hintBtn').disabled = true; return; }
  if (e.target.closest('#explainBtn')) { S.usedHelp = true; showSteps(q, true); return; }
  if (e.target.closest('#submit')) { submitMath(); }
}
function showSteps(q, reveal) {
  const el = document.getElementById('fb');
  const stepsHtml = `<div class="steps"><div class="eyebrow">Så här löser du den</div><ol>${q.steps.map(s => `<li>${safeHtml(s)}</li>`).join('')}</ol>${reveal && !S.answered ? `<p style="margin-top:10px" class="muted">Svaret är <b>${esc(answerDisplay(q))}</b>. Skriv in det så går vi vidare – nästa gång klarar du det själv!</p>` : ''}</div>`;
  const existing = el.querySelector('.steps'); if (existing) existing.remove();
  el.insertAdjacentHTML('beforeend', stepsHtml);
  if (reveal) { S.revealed = true; const b = document.getElementById('explainBtn'); if (b) b.disabled = true; }
  el.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}
function normalizeText(s) { return s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, ''); }
function checkAnswer(q, raw) {
  const s = (raw || '').trim();
  if (!s) return { status: 'empty' };
  if (q.type === 'choicetext') return { status: Number(s) === q.answer ? 'correct' : 'wrong' };
  if (q.type === 'open') return checkOpen(q, s);
  if (q.type === 'order') { const picked = S.order ? S.order.picked : []; if (picked.length !== q.items.length) return { status: 'empty' }; const ok = picked.every((idx, n) => idx === n); const firstWrong = picked.findIndex((idx, n) => idx !== n); return { status: ok ? 'correct' : 'wrong', firstWrong }; }
  if (q.type === 'num') { const n = parseFloat(s.replace(/−|–/g, '-').replace(',', '.').replace(/\s/g, '')); if (!Number.isFinite(n)) return { status: 'invalid', msg: 'Skriv ett tal.' }; return { status: Math.abs(n - q.answer) < 1e-6 ? 'correct' : 'wrong' }; }
  if (q.type === 'expr') { const p = Poly.tryParse(s); if (!p) return { status: 'invalid', msg: 'Jag förstår inte uttrycket. Skriv t.ex. 6x + 15 eller 2x² − 3x.' }; if (!Poly.equal(p, q.answer)) return { status: 'wrong' }; if (!Poly.isSimplified(s, q.answer)) return { status: 'unsimplified' }; return { status: 'correct' }; }
  const norm = normalizeText(s); return { status: q.answer.some(a => normalizeText(a) === norm) ? 'correct' : 'wrong' };
}
const answerDisplay = (q) => q.type === 'expr' ? Poly.format(q.answer) : q.type === 'num' ? T.n(q.answer) : q.type === 'choicetext' ? q.choices[q.answer] : q.type === 'open' ? q.model : q.type === 'order' ? 'se ordningen nedan' : (q.display || q.answer[0]);
function submitMath() {
  const q = S.queue[S.i]; const input = document.getElementById('ans');
  const raw = q.type === 'order' ? 'order' : q.choices || q.type === 'choicetext' ? (S.selected === undefined ? '' : String(S.selected)) : input.value;
  const res = (q.v2check ? V2.check : checkAnswer)(q, raw); const fb = document.getElementById('fb');
  if (res.status === 'empty') { toast(q.type === 'order' ? 'Placera alla steg först' : 'Skriv ett svar först'); return; }
  if (res.status === 'invalid') { fb.innerHTML = `<div class="feedback warn"><span>✍️</span><div><div class="big">Hmm</div><div class="sub">${res.msg}</div></div></div>`; document.getElementById('qcard').classList.add('shake'); setTimeout(() => document.getElementById('qcard')?.classList.remove('shake'), 400); return; }
  if (res.status === 'unsimplified' && !S.retried && !(S.v2 && S.v2.exam)) { S.retried = true; fb.innerHTML = `<div class="feedback warn"><span>🧐</span><div><div class="big">Nästan!</div><div class="sub">Värdet stämmer, men uttrycket ska förenklas färdigt. Multiplicera in och slå ihop lika termer.</div></div></div>`; return; }
  const correct = res.status === 'correct' && !S.revealed;
  S.answered = true; const isTest = S.mode === 'test';
  const v2ch = !!(S.v2 && q.spec && q.spec.mode === 'challenge'); const v2help = !!(S.v2 && q.spec && q.spec.help && q.spec.help !== 'none');
  let xp = v2ch ? V2.challengeXp(correct) : recordAnswer(S.kid.id, q.skill.id, correct, q.level, S.usedHelp || isTest || v2help);   // granskning M6/L6
  LE.observe(S, q, correct); // Fas 3B: skuggläge – loggar bevis, påverkar inte v1
  if (S.mode === 'felbok') { const p = prof(S.kid.id); if (correct) { clearMistake(p, q.mistakeId); save(); } }
  else if (!correct && !v2ch) { noteMistake(prof(S.kid.id), q); save(); }
  if (correct) { S.streak++; if (S.streak >= 3) { const b = Math.min(10, S.streak * 2); xp += b; prof(S.kid.id).xp += b; save(); } } else S.streak = 0;
  S.xp += xp; S.results.push(correct);
  let v2evs = null; const v2rw = S.v2 ? S.v2.rewards.length : 0;
  if (S.v2) { v2evs = V2.observe(q, correct); if (S.v2.exam) return V2.examAnswered(q, correct, raw); }
  if (q.choices || q.type === 'choicetext') document.querySelectorAll('.choice, .wchoice').forEach(c => { const v = Number(c.dataset.choice); if (v === q.answer) c.classList.add('ok'); else if (v === S.selected) c.classList.add('no'); c.disabled = true; });
  if (input) input.disabled = true;
  const praise = R.pick(['Snyggt!', 'Rätt!', 'Perfekt!', 'Så ska det se ut!', 'Boom!', 'Exakt!']);
  if (q.type === 'order') {
    document.querySelectorAll('.otile').forEach(b => b.disabled = true); document.getElementById('undoOrder')?.remove();
    document.querySelectorAll('#orderSlots .otile').forEach((el, n) => el.classList.add(S.order.picked[n] === n ? 'ok' : 'no'));
    if (correct) { beep('ok', S.streak); xpPop(xp); fb.innerHTML = `<div class="feedback ok"><span style="font-size:1.4rem">✅</span><div><div class="big">Rätt ordning!</div><div class="sub">Alla ${q.items.length} steg på rätt plats.</div></div></div>`; }
    else { beep('no'); fb.innerHTML = `<div class="feedback no"><span style="font-size:1.4rem">❌</span><div><div class="big">Inte riktigt</div><div class="sub">Första felet är på plats ${res.firstWrong + 1}.</div></div></div>`; if (!isTest) showSteps(q, false); }
  }
  else if (q.type === 'open') {
    const hitTxt = res.hit?.length ? `Du fick med: ${res.hit.map(k => `<b>${esc(k.label)}</b>`).join(', ')}.` : 'Inget av nyckelbegreppen hittades.';
    const missTxt = res.miss?.length ? ` Saknas: ${res.miss.map(k => `<b>${esc(k.label)}</b>`).join(', ')}.` : '';
    if (correct) { beep('ok', S.streak); xpPop(xp); fb.innerHTML = `<div class="feedback ok"><span style="font-size:1.4rem">✅</span><div><div class="big">${res.miss?.length ? 'Bra svar!' : 'Fullständigt svar!'}</div><div class="sub">${hitTxt}${missTxt}</div></div></div>`; }
    else { beep('no'); fb.innerHTML = `<div class="feedback no"><span style="font-size:1.4rem">✍️</span><div><div class="big">Svaret behöver mer</div><div class="sub">${hitTxt}${missTxt}</div></div></div>`; }
    if (!isTest || !correct) showSteps(q, false);
  }
  else if (correct) { beep('ok', S.streak); xpPop(xp); fb.innerHTML = `<div class="feedback ok"><span style="font-size:1.4rem">✅</span><div><div class="big">${praise}${S.streak >= 3 ? ` ${S.streak} i rad 🔥` : ''}</div><div class="sub">${esc(answerDisplay(q))}${res.note ? `<br>${res.note}` : ''}</div></div></div>`; }
  else if (S.revealed) { fb.innerHTML = `<div class="feedback warn"><span style="font-size:1.4rem">👀</span><div><div class="big">Nu vet du hur man gör</div><div class="sub">Du får en liknande uppgift igen om en stund.</div></div></div>`; }
  else { beep('no'); fb.innerHTML = `<div class="feedback no"><span style="font-size:1.4rem">❌</span><div><div class="big">Inte riktigt</div><div class="sub">Rätt svar: <b>${esc(answerDisplay(q))}</b>${q.choices || q.type === 'choicetext' || !raw ? '' : ` · Du svarade: ${esc(raw)}`}</div></div></div>`; if (!isTest) showSteps(q, false); }
  document.getElementById('hintBtn')?.remove(); document.getElementById('explainBtn')?.remove();
  if (S.v2) V2.feedbackExtra(v2evs, v2rw);
  document.getElementById('actions').innerHTML = `<button class="btn grow" id="next">${(S.v2 ? V2.hasNext() : S.i + 1 < S.queue.length) ? 'Nästa →' : 'Visa resultat'}</button>${!correct && !isTest ? `<button class="btn ghost" id="stepsBtn2">Visa lösning</button>` : ''}`;
  document.getElementById('stepsBtn2')?.addEventListener('click', () => showSteps(q, false));
  document.getElementById('next').focus({ preventScroll: true });
}
function nextQuestion() {
  const cur = S.queue[S.i];
  if (cur.cat === 'math' && !S.results[S.i] && S.mode === 'practice' && S.queue.length < 18) S.queue.push(makeQuestion(S.kid, cur.skill, cur.level));
  S.i++; S.usedHelp = false; S.retried = false; S.revealed = false; S.answered = false; S.selected = undefined; S.match = null; S.spell = null; S.order = null;
  if (S.v2 && !V2.advance()) return finishSession();
  if (S.i >= S.queue.length) return finishSession();
  VIEWS.practice();
}
function finishSession() {
  clearInterval(S.timer);
  if (S.v2) return V2.finish();
  LE.sessionEnd(S); // Fas 3B: skuggläge
  const p = prof(S.kid.id); p.sessions++; p.sprintsSinceBreak = (p.sprintsSinceBreak || 0) + 1;
  const n = S.results.length, c = S.results.filter(Boolean).length;
  const scored = S.queue.filter(q => !(q.cat === 'word' && q.kind === 'intro')).length;
  if (c === n && scored >= 5) { p.perfect = (p.perfect || 0) + 1; questEvent(p, 'perfect', {}); }
  let grade = null, partRows = '';
  if (S.mode === 'test') {
    const by = {}; S.queue.forEach((q, i) => { const k = q.cat === 'word' ? 'ord' : q.skill.id; by[k] = by[k] || { c: 0, n: 0 }; by[k].n++; if (S.results[i]) by[k].c++; });
    const parts = { E: { c: 0, n: 0 }, C: { c: 0, n: 0 }, A: { c: 0, n: 0 } }; S.queue.forEach((q, i) => { const pt = parts[q.part || 'E']; pt.n++; if (S.results[i]) pt.c++; });
    const ratio = (pt) => (pt.n ? pt.c / pt.n : 0);
    grade = ratio(parts.E) < 0.6 ? 'Ännu inte E' : parts.C.n && ratio(parts.C) >= 0.5 ? (parts.A.n && ratio(parts.A) >= 0.5 ? 'A' : 'C') : 'E';
    partRows = Object.entries(parts).filter(([, pt]) => pt.n).map(([k, pt]) => `<div class="r"><div><div style="font-weight:700">${k}-nivå</div><div class="mastery ${ratio(pt) < .5 ? 'lo' : ratio(pt) < .8 ? 'mid' : 'hi'}"><i style="width:${Math.round(ratio(pt) * 100)}%"></i></div></div><span class="m">${pt.c}/${pt.n}</span></div>`).join('');
    p.tests.push({ date: todayKey(), examId: S.examId, score: c, total: n, ms: Date.now() - S.startedAt, by, grade }); if (p.tests.length > 30) p.tests.shift();
  }
  save();
  const won = checkBadges(S.kid);
  const pct = Math.round(c / n * 100);
  if (won.length) beep('badge'); else if (pct === 100) beep('perfect'); else if (pct >= 70) beep('win'); if (pct >= 70) confetti(pct === 100 ? 220 : 120);
  const by = {}; S.queue.forEach((q, i) => { const k = q.cat === 'word' ? 'ord' : q.skill.id; by[k] = by[k] || { name: q.cat === 'word' ? q.deck.name : (q.skill.short || q.skill.name), c: 0, n: 0 }; by[k].n++; if (S.results[i]) by[k].c++; });
  const msg = pct === 100 ? 'Felfritt! Helt otroligt.' : pct >= 80 ? 'Riktigt starkt pass!' : pct >= 60 ? 'Bra jobbat – du är på väg.' : pct >= 40 ? 'Det här sätter sig. Kör ett pass till imorgon.' : 'Tufft område. Kolla "Så gör man" och testa igen.';
  const quests = dailyQuests(S.kid); const claimable = quests.filter(q => q.done && !q.claimed);
  const needBreak = p.settings.focus && p.sprintsSinceBreak >= 2;
  if (S.opts.bonus) { p.xp += S.xp; save(); }
  const offerBonus = !S.chain && S.mode === 'practice' && !S.opts.bonus && !needBreak && R.chance(0.2);
  let chainHtml = '';
  if (S.chain) {
    S.chain.items += n; S.chain.correct += c; S.chain.xp += S.xp;
    const nx = nextDeckAfter(S.kid, S.opts.deck?.id);
    const mins = Math.max(1, Math.round((Date.now() - S.chain.start) / 60000));
    chainHtml = `<div class="card stack" style="gap:10px;border:2px solid var(--acc)">
      <div class="row" style="justify-content:space-between"><div class="eyebrow">Språkpass · ${mins} min · ${S.chain.lessons} lektion${S.chain.lessons > 1 ? 'er' : ''}</div><span class="pill acc">${S.chain.correct}/${S.chain.items} rätt · +${S.chain.xp} XP</span></div>
      ${nx ? `<div><div style="font-weight:800;font-family:var(--display);font-size:1.1rem">Nästa: ${nx.deck.emoji} ${esc(nx.deck.name)}</div><div class="muted" style="font-size:.9rem">${esc(nx.reason)}</div></div>
      <button class="btn big wide" data-chain-next="${nx.deck.id}">Fortsätt →</button>` : `<div class="muted">Alla ord är klara för idag – nya repetitioner dyker upp imorgon när minnet behöver dem.</div>`}
    </div>`;
  }
  render(`${topbar(S.mode === 'test' ? 'Provresultat' : 'Resultat', 'home')}
  <div class="stack" style="margin-top:6px">
    <div class="card pad-lg summary-hero stack" style="gap:6px">
      <div class="eyebrow">${S.mode === 'test' ? `Provläge · ${fmtTime(Date.now() - S.startedAt)}` : S.mode === 'felbok' ? `Felboken · ${(p.mistakes || []).length} kvar` : LBL(S.kid).done}</div>
      <div class="big">${c}/${n}</div>
      ${grade ? `<div class="row" style="justify-content:center;gap:8px"><span class="pill ${grade === 'Ännu inte E' ? 'bad' : grade === 'E' ? 'warn' : 'good'}" style="font-size:1rem;padding:6px 14px">Indikation: ${grade}</span></div><p class="muted" style="font-size:.85rem">Indikationen bygger på att E-nivån kräver minst 60 % rätt och C/A minst hälften rätt på respektive del. Lärarens prov kan vikta annorlunda.</p>` : ''}
      <p style="font-weight:700">${msg}</p>
      <div class="row" style="justify-content:center;gap:8px;margin-top:6px"><span class="pill acc">+${S.xp} XP</span><span class="pill">${pct}% rätt</span>${p.streak ? `<span class="pill">🔥 ${p.streak} dagar</span>` : ''}</div>
    </div>
    ${chainHtml}
    ${claimable.length ? `<div class="card" style="border:2px solid var(--good)"><div class="eyebrow">Uppdrag klart!</div>${claimable.map(q => `<div class="quest done"><div class="qi">✅</div><div class="grow"><div class="qt">${esc(q.text)}</div><div class="qp">+${q.reward.xp} XP, +${q.reward.gems} 💎</div></div><button class="btn claim" data-claim="${q.id}">Hämta</button></div>`).join('')}</div>` : ''}
    ${won.length ? `<div class="card" style="border:2px solid var(--acc)"><div class="eyebrow">Nytt märke! +${10 * won.length} 💎</div><div class="badge-row" style="margin-top:8px">${won.map(b => `<span class="badge"><span class="e">${b.e}</span>${b.name}</span>`).join('')}</div></div>` : ''}
    ${partRows ? `<div class="card"><div class="eyebrow" style="margin-bottom:8px">Per nivå</div><div class="breakdown">${partRows}</div></div>` : ''}
    ${Object.keys(by).length > 1 ? `<div class="card"><div class="eyebrow" style="margin-bottom:8px">Per område</div><div class="breakdown">${Object.values(by).map(b => `<div class="r"><div><div style="font-weight:700">${esc(b.name)}</div><div class="mastery ${b.c / b.n < .5 ? 'lo' : b.c / b.n < .8 ? 'mid' : 'hi'}"><i style="width:${Math.round(b.c / b.n * 100)}%"></i></div></div><span class="m">${b.c}/${b.n}</span></div>`).join('')}</div></div>` : ''}
    ${S.mode === 'practice' && S.queue.some(q => q.cat === 'math') ? `<div class="card" id="rateCard"><div class="eyebrow" style="margin-bottom:8px">Hur kändes det?</div><div class="row"><button class="btn ghost grow" data-rate="easy">😎 Lätt</button><button class="btn ghost grow" data-rate="ok">🙂 Lagom</button><button class="btn ghost grow" data-rate="hard">😓 Svårt</button></div><p class="muted" style="font-size:.85rem;margin-top:6px">Lätt höjer svårigheten nästa gång, svårt sänker den.</p></div>` : ''}
    ${S.opts.bonus ? `<div class="card" style="border:2px solid var(--warn);text-align:center"><b>Bonussprint: dubbel XP!</b> <span class="muted">+${S.xp} XP extra</span></div>` : ''}
    ${offerBonus ? `<button class="btn big wide" style="background:var(--warn);box-shadow:none" data-act="bonus">⚡ Bonussprint – dubbel XP i 5 uppgifter</button>` : ''}
    ${S.chain ? '' : needBreak ? `<button class="btn big wide" style="background:var(--warn);box-shadow:none" data-go="break">Ta en kort paus (2 min)</button><button class="btn ghost wide" data-act="again">Nej, en till</button>` : `<button class="btn ${offerBonus ? 'ghost' : 'big'} wide" data-act="again">${LBL(S.kid).again}</button>`}
    <button class="btn ghost wide" data-go="home">Till startsidan</button>
  </div>`);
}

VIEWS.break = () => {
  const p = prof(state.kid); p.sprintsSinceBreak = 0; save();
  let left = 120; const ideas = R.shuffle(['Res dig och sträck på armarna mot taket', '10 upphopp', 'Drick ett glas vatten', 'Titta ut genom fönstret på något långt bort i 20 sekunder', 'Gå en runda i huset', 'Andas in på 4, håll 4, ut på 6 – tre gånger', 'Skaka loss i armar och ben']).slice(0, 3);
  render(`${topbar('Paus', 'home')}
  <div class="stack" style="margin-top:6px"><div class="card pad-lg break-card"><div class="eyebrow">Hjärnan sparar bättre efter en paus</div><div class="big" id="breakTimer">2:00</div><div class="break-ideas">${ideas.map(i => `<div>${i}</div>`).join('')}</div><button class="btn big wide" id="breakDone" data-act="again">Jag är redo – kör igen ▶</button><button class="btn ghost wide" data-go="home">Till startsidan</button></div></div>`);
  if (S) S.timer = setInterval(() => { left--; const el = document.getElementById('breakTimer'); if (!el) return clearInterval(S.timer); el.textContent = fmtTime(left * 1000); if (left <= 0) { clearInterval(S.timer); beep('win'); el.textContent = 'Klart!'; } }, 1000);
};

/* ========= Blitz mode (60 s) ========= */
let B = null;
VIEWS.blitz = () => {
  const kid = kidById(state.kid); const p = prof(kid.id);
  render(`${topbar('Blixtläge ⚡', 'home')}
  <div class="stack" style="margin-top:6px">
    <div class="card pad-lg" style="text-align:center"><h2>60 sekunder. Så många rätt du kan.</h2><p class="muted" style="margin-top:6px">Snabba svar med knappar. Fel kostar 2 sekunder. Rekord ger märke!</p></div>
    <div class="skill-list">${kid.skills.filter(s => (s.group || 'math') === 'math' && s.id !== 'andragrad').map(s => `<button class="card tap skill" data-blitz="${s.id}"><div class="ic">${s.icon}</div><div class="grow"><div class="nm">${esc(s.short)}</div><div class="sub">Rekord: ${p.blitz[s.id] || 0}</div></div><span class="chev">›</span></button>`).join('')}</div>
  </div>`);
};
function startBlitz(kid, skillId) {
  const skill = kid.skills.find(s => s.id === skillId);
  B = { kid, skill, score: 0, wrong: 0, end: Date.now() + 60000, q: null, done: false };
  nextBlitzQ(); B.timer = setInterval(() => { const left = B.end - Date.now(); const bar = document.getElementById('bbar'); const tm = document.getElementById('btime'); if (bar) bar.style.width = Math.max(0, left / 600) + '%'; if (tm) tm.textContent = Math.ceil(left / 1000) + ' s'; if (left <= 0) endBlitz(); }, 250);
}
function nextBlitzQ() {
  let q, guard = 0; const lvl = Math.max(1, Math.min(2, skillState(prof(B.kid.id), B.skill.id).lvl));
  do { q = B.skill.gen(lvl, { noOpen: true }); } while (q.type !== 'num' && guard++ < 15);
  if (q.type !== 'num') { q = null; }
  if (!q) { toast('Det här området passar inte för blixt'); return go('blitz'); }
  if (!q.choices) q.choices = T.choices(q.answer, 4, 3);
  B.q = q; state.screen = 'blitzplay';
  render(`${topbar('Blixt ⚡', 'blitz', `<span class="timer" id="btime">${Math.ceil((B.end - Date.now()) / 1000)} s</span>`)}
  <div class="stack" style="margin-top:6px"><div class="blitz-bar"><i id="bbar" style="width:${Math.max(0, (B.end - Date.now()) / 600)}%"></i></div><div class="blitz-score">${B.score}</div>
  <div class="card pad-lg stack" style="gap:16px"><div class="question" style="text-align:center">${q.text}</div><div class="choices">${q.choices.map(c => `<button class="choice" data-bchoice="${c}">${T.n(c)}</button>`).join('')}</div></div></div>`);
}
function endBlitz() {
  clearInterval(B.timer); if (B.done) return; B.done = true;
  const p = prof(B.kid.id); const best = p.blitz[B.skill.id] || 0; const record = B.score > best; if (record) p.blitz[B.skill.id] = B.score;
  const xp = B.score * 3; p.xp += xp; p.gems += Math.floor(B.score / 5); save(); const won = checkBadges(B.kid);
  if (won.length) beep('badge'); else if (B.score >= 10) beep('win'); if (B.score >= 10) confetti();
  render(`${topbar('Blixt ⚡', 'blitz')}<div class="stack" style="margin-top:6px"><div class="card pad-lg summary-hero stack" style="gap:6px"><div class="eyebrow">${esc(B.skill.name)}</div><div class="big">${B.score}</div><p style="font-weight:700">${record ? 'Nytt rekord! 🏆' : `Rekord: ${best}`}</p><div class="row" style="justify-content:center;gap:8px"><span class="pill acc">+${xp} XP</span><span class="pill">+${Math.floor(B.score / 5)} 💎</span><span class="pill">${B.wrong} fel</span></div></div>
  ${won.length ? `<div class="card" style="border:2px solid var(--acc)"><div class="eyebrow">Nytt märke!</div><div class="badge-row" style="margin-top:8px">${won.map(b => `<span class="badge"><span class="e">${b.e}</span>${b.name}</span>`).join('')}</div></div>` : ''}
  <button class="btn big wide" data-blitz="${B.skill.id}">⚡ Igen</button><button class="btn ghost wide" data-go="home">Till startsidan</button></div>`);
}

/* ========= Parent ========= */
let parentUnlocked = false;
VIEWS.parent = () => {
  if (!parentUnlocked) {
    render(`${topbar('Föräldraläge', 'start')}
    <div class="stack" style="margin-top:20px"><div class="card pad-lg stack" style="text-align:center;gap:14px"><h2>Ange kod</h2><p class="muted">Fyra siffror. Standardkoden är 1234 – byt den under ⚙.</p>
      <div class="pin">${[0, 1, 2, 3].map(i => `<input inputmode="numeric" maxlength="1" data-pin="${i}" aria-label="Siffra ${i + 1}">`).join('')}</div><p class="muted" id="pinMsg" style="min-height:1.4em"></p></div></div>`);
    const inputs = [...document.querySelectorAll('[data-pin]')]; inputs[0].focus();
    inputs.forEach((inp, i) => inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(-1); if (inp.value && i < 3) inputs[i + 1].focus(); const code = inputs.map(x => x.value).join(''); if (code.length === 4) { if (code === DB.settings.pin) { parentUnlocked = true; state.tab = state.tab || (KIDS[0] ? KIDS[0].id : 'settings'); VIEWS.parent(); } else { document.getElementById('pinMsg').textContent = 'Fel kod'; inputs.forEach(x => x.value = ''); inputs[0].focus(); } } }));
    inputs.forEach((inp, i) => inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus(); }));
    return;
  }
  const tab = state.tab || (KIDS[0] ? KIDS[0].id : 'settings'); const kid = kidById(tab);
  const sub = state.sub || 'overview';
  if (tab === 'settings' && SYNC.active && !PUSH.lastStatus) PUSH.loadStatus().then(() => { if (state.screen === 'parent' && state.tab === 'settings') VIEWS.parent(); });
  let body = '';
  if (kid) {
    const p = prof(kid.id);
    const subTabs = [['overview', 'Översikt'], ['exams', 'Prov'], ['decks', 'Glosor'], ['settings', 'Inställningar'], ['v2', 'Motor v2']];
    body = `<div class="seg" style="width:100%;display:flex">${subTabs.map(([id, l]) => `<button class="${sub === id ? 'on' : ''}" style="flex:1" data-sub="${id}">${l}</button>`).join('')}</div>`;
    if (sub === 'overview') body += parentOverview(kid, p);
    else if (sub === 'exams') body += parentExams(kid, p);
    else if (sub === 'decks') body += parentDecks(kid, p);
    else if (sub === 'v2') body += V2.engineCard(kid) + (V2.engineOf(p) === 'v2' ? V2.insightsCard(kid) + V2.explainCard(kid) : '') + LE.view(kid);
    else body += parentSettings(kid, p);
  } else {
    body = `<div class="card stack" style="gap:12px"><div class="eyebrow">Inställningar</div>
      <label class="row" style="justify-content:space-between"><span>Byt kod (4 siffror)</span><input id="newPin" inputmode="numeric" maxlength="4" class="answer-input" style="width:120px;min-height:44px;font-size:1.2rem" value="${esc(DB.settings.pin)}"></label>
      <div class="toggle"><div><div class="tl">Ljud</div><div class="td">Pling vid rätt/fel</div></div><button class="switch ${DB.settings.sound ? 'on' : ''}" data-act="toggleSound" aria-label="Ljud"></button></div>
      <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><button class="btn ghost" data-act="testSound">Testa ljud</button><span class="muted" style="font-size:.85rem" id="soundState">${typeof window !== 'undefined' && window.PLUGG_BUILD ? 'Version ' + window.PLUGG_BUILD : ''}</span></div>
      <button class="btn secondary" data-act="savePin">Spara kod</button></div>
      ${familyCard()}
      ${LE.summaryCard()}
      ${SYNC.cfg ? `${syncCard()}${PUSH.card('parent', 'parent')}${deleteCard()}` : ''}
      <div class="card stack" style="gap:8px"><div class="eyebrow">Så fungerar appen</div>
      <p style="font-size:.95rem"><b>Kör! (Learning Engine v2):</b> appen håller koll på vad varje barn kan och när det behöver repeteras. Kör! sätter ihop ett kort pass: något att minnas, dagens fokus, revansch på det som gick fel och ibland en utmaning. Fel blir Felboken – en ny fråga om samma sak ett annat pass. När inget mer är värdefullt säger appen "Du är klar för idag". Om något inte fungerar: välj v1 per barn under barnet → Motor v2.</p>
      <p style="font-size:.95rem"><b>Matte (v1):</b> alla uppgifter slumpas – obegränsat med övning. Svårigheten höjs efter fyra rätt i rad och sänks efter tre fel. "Kör!" väljer det barnet behöver mest: prov inom 30 dagar, annars dagens uppdrag. Fel svar återkommer senare i sprinten.</p>
      <p style="font-size:.95rem"><b>Språk:</b> ord repeteras med spaced repetition (boxar 0–5, intervall 1–30 dagar). En lektion blandar nya ord, välj rätt, lyssna, para ihop, bygg ordet och skriv. Uppläsningen använder telefonens egen röst.</p>
      <p style="font-size:.95rem"><b>Fokusläge</b> (för den som lätt tappar fokus): korta sprintar, en sak i taget på skärmen, "N kvar" i stället för poäng, pauspåminnelse efter två sprintar, svar med ett tryck när det går. Slås på per barn under Inställningar.</p>
      <p style="font-size:.95rem"><b>Motivation:</b> följeslagare som växer med XP, tre dagliga uppdrag, ädelstenar och butik, streak med frys, veckoutmaning, märken och blixtläge.</p>
      <p style="font-size:.95rem" class="muted">Framsteg sparas på barnets enhet. Flytta med kod under Översikt.</p></div>`;
  }
  render(`${topbar('Föräldraläge', 'start')}
  <div class="stack" style="margin-top:6px">
    <div class="tabs">${KIDS.map(k => `<button class="${tab === k.id ? 'on' : ''}" data-tab="${k.id}">${esc(k.name)}</button>`).join('')}<button class="${tab === 'settings' ? 'on' : ''}" data-tab="settings">⚙</button></div>
    ${body}
  </div>`);
};
function parentOverview(kid, p) {
  if (V2.on(kid)) return V2.insightsCard(kid) + parentOverviewV1(kid, p);
  return parentOverviewV1(kid, p);
}
function parentOverviewV1(kid, p) {
  const lvl = levelOf(p.xp);
  const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = todayKey(d); days.push({ k, ...(p.days[k] || { n: 0, c: 0, xp: 0 }), lbl: d.toLocaleDateString('sv-SE', { weekday: 'short' }).slice(0, 2) }); }
  const maxN = Math.max(1, ...days.map(d => d.n));
  const totalAtt = Object.values(p.skills).reduce((a, s) => a + s.att, 0), totalCor = Object.values(p.skills).reduce((a, s) => a + s.cor, 0);
  const weak = kid.skills.map(s => ({ s, st: skillState(p, s.id) })).filter(x => x.st.att > 0).sort((a, b) => a.st.m - b.st.m).slice(0, 2);
  const words = Object.entries(p.words); const learned = words.filter(([, w]) => w.box >= 3).length;
  const weakWords = words.filter(([, w]) => w.wrong >= 2 && w.box < 3).map(([id, w]) => ({ id, w, word: allDecks(p).flatMap(d => d.words).find(x => x.id === id) })).filter(x => x.word).slice(0, 8);
  const wk = weekKey(); const snap = (p.snapshots || {})[wk] || { skills: {}, learned: 0, xp: 0 };
  const weekDays = Object.entries(p.days).filter(([k]) => k >= wk); const activeDays = weekDays.filter(([, d]) => d.n > 0).length; const weekN = weekDays.reduce((a, [, d]) => a + d.n, 0), weekC = weekDays.reduce((a, [, d]) => a + d.c, 0);
  const deltas = kid.skills.map(s => ({ s, from: snap.skills[s.id] ?? 0, to: Math.round(skillState(p, s.id).m) })).filter(x => x.to !== x.from || skillState(p, x.s.id).att).sort((a, b) => (b.to - b.from) - (a.to - a.from));
  const ups = deltas.filter(x => x.to - x.from >= 5).slice(0, 3), downs = deltas.filter(x => x.to - x.from <= -5).slice(0, 2);
  const stale = kid.skills.filter(s => { const st = skillState(p, s.id); return st.att > 0 && st.m < 60 && Date.now() - st.last > 5 * DAYMS; }).slice(0, 3);
  const lastActiveDays = p.lastDay ? Math.round((new Date(todayKey()) - new Date(p.lastDay)) / DAYMS) : null;
  const learnedNow = Object.values(p.words).filter(w => w.box >= 3).length;
  const weekly = `<div class="card stack" style="gap:8px;border-left:3px solid var(--acc)"><div class="eyebrow">Veckan hittills · ${new Date(wk + 'T00:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} →</div>
      ${lastActiveDays !== null && lastActiveDays >= 3 ? `<div class="feedback warn" style="padding:10px 12px"><span>⚠️</span><div class="sub">${esc(kid.name)} har inte övat på ${lastActiveDays} dagar.</div></div>` : ''}
      <div class="kv"><span>Aktiva dagar</span><b>${activeDays} av ${Math.min(7, Math.round((new Date(todayKey()) - new Date(wk)) / DAYMS) + 1)}</b><span>Uppgifter / rätt</span><b>${weekN} / ${weekC}${weekN ? ` (${Math.round(weekC / weekN * 100)} %)` : ''}</b><span>XP den här veckan</span><b>+${p.xp - (snap.xp || 0)}</b>${learnedNow - (snap.learned || 0) ? `<span>Nya ord som sitter</span><b>+${learnedNow - (snap.learned || 0)}</b>` : ''}</div>
      ${ups.length ? `<div style="font-size:.95rem">📈 Starkast framåt: ${ups.map(x => `<b>${esc(x.s.short)}</b> ${x.from} → ${x.to} %`).join(', ')}</div>` : ''}
      ${downs.length ? `<div style="font-size:.95rem">📉 Backat: ${downs.map(x => `<b>${esc(x.s.short)}</b> ${x.from} → ${x.to} %`).join(', ')}</div>` : ''}
      ${stale.length ? `<div style="font-size:.95rem">⏳ Står still (inte övat på 5+ dagar): ${stale.map(x => `<b>${esc(x.short)}</b>`).join(', ')}</div>` : ''}
      ${!ups.length && !downs.length && !weekN ? `<div class="muted">Ingen aktivitet den här veckan än.</div>` : ''}
    </div>`;
  return `
    ${weekly}
    <div class="card stack" style="gap:10px">
      <div class="row"><div class="avatar" style="width:48px;height:48px;font-size:1.5rem;border-radius:14px">${p.pet ? petEmoji(p) : kid.emoji}</div><div class="grow"><h2>${esc(kid.name)}</h2><div class="muted">${kid.grade} · Nivå ${lvl} ${levelName(lvl)} · ${p.xp} XP · 💎 ${p.gems}</div></div></div>
      <div class="kv"><span>Matteuppgifter</span><b>${totalAtt} (${totalAtt ? Math.round(totalCor / totalAtt * 100) : 0}% rätt)</b><span>Ord lärda</span><b>${learned} av ${words.length} övade</b><span>Dagar i rad</span><b>${p.streak} (${p.freezes} frys)</b><span>Sprintar</span><b>${p.sessions}</b><span>Denna vecka</span><b>${p.weekCorrect || 0} rätt</b></div>
      ${weak.length ? `<div class="hint" style="font-size:.95rem">🎯 Behöver mest träning: <b>${weak.map(w => esc(w.s.name)).join('</b> och <b>')}</b></div>` : `<div class="muted">Inga mattepass ännu.</div>`}
    </div>
    <div class="card"><div class="eyebrow" style="margin-bottom:10px">Senaste 14 dagarna · uppgifter per dag</div><div class="days">${days.map(d => `<i class="${d.n ? '' : 'zero'}" style="height:${Math.max(3, Math.round(d.n / maxN * 100))}%" title="${d.k}: ${d.c}/${d.n} rätt"></i>`).join('')}</div><div class="days-lbl">${days.map(d => `<span>${d.lbl}</span>`).join('')}</div></div>
    <div class="card"><div class="eyebrow" style="margin-bottom:10px">Matteområden</div><div class="skill-list">${kid.skills.map(s => { const st = skillState(p, s.id); const mv = Math.round(st.m); return `<div><div class="row" style="justify-content:space-between"><b>${esc(s.name)}</b><span class="pill ${mv < 40 ? (st.att ? 'bad' : '') : mv < 75 ? 'warn' : 'good'}">${masteryLabel(st)} · nivå ${st.lvl}</span></div><div class="mastery ${masteryClass(mv)}"><i style="width:${Math.max(2, mv)}%"></i></div><div class="muted" style="font-size:.85rem;margin-top:3px">${st.att ? `${st.cor}/${st.att} rätt · senast ${new Date(st.last).toLocaleDateString('sv-SE')}` : 'Inte övat än'}</div></div>`; }).join('')}</div></div>
    ${enabledDecks(p).length ? `<div class="card"><div class="eyebrow" style="margin-bottom:10px">Språk</div><div class="wordlist">${enabledDecks(p).map(d => { const pr = deckProgress(p, d); return `<div><span>${d.emoji} ${esc(d.name)}</span><b>${pr.learned}/${d.words.length} lärda${pr.due ? ` · ${pr.due} att repetera` : ''}</b></div>`; }).join('')}</div>${weakWords.length ? `<div class="eyebrow" style="margin:12px 0 6px">Ord som är svåra</div><div class="wordlist">${weakWords.map(x => `<div><span>${esc(x.word.w)} = ${esc(x.word.t)}</span><span class="boxes">${[0, 1, 2, 3, 4].map(i => `<i class="${i < x.w.box ? 'on' : ''}"></i>`).join('')}</span></div>`).join('')}</div>` : ''}</div>` : ''}
    ${p.tests.length ? `<div class="card"><div class="eyebrow" style="margin-bottom:8px">Provträningar</div>${p.tests.slice(-6).reverse().map(t => `<div class="row" style="justify-content:space-between;padding:4px 0"><span>${t.date} · ${esc(p.exams.find(e => e.id === t.examId)?.title || '')} · ${fmtTime(t.ms)}</span><b>${t.score}/${t.total}${t.grade ? ` · ${t.grade}` : ''}</b></div>`).join('')}</div>` : ''}
    <div class="card stack" style="gap:10px"><div class="eyebrow">Flytta framsteg</div><p class="muted" style="font-size:.95rem">Framstegen sparas på den här enheten. Kopiera koden och klistra in på en annan enhet för att flytta ${esc(kid.name)}s framsteg.</p>
      <div class="row"><button class="btn ghost" data-act="export">Kopiera kod</button><button class="btn ghost" data-act="import">Klistra in kod</button><button class="btn ghost danger" data-act="reset">Nollställ</button></div><div id="ioArea"></div></div>`;
}
function parentExams(kid, p) {
  const skillChecks = kid.skills.map(s => `<label class="check"><input type="checkbox" name="ex_skill" value="${s.id}" ${(s.group || 'math') === 'math' ? 'checked' : ''}><span>${(s.group || 'math') === 'math' ? '' : (s.subject || '') + ': '}${esc(s.short)}</span></label>`).join('');
  const deckChecks = enabledDecks(p).map(d => `<label class="check"><input type="checkbox" name="ex_deck" value="${d.id}"><span>${d.emoji} ${esc(d.name)}</span></label>`).join('');
  return `
    ${p.exams.length ? `<div class="card"><div class="eyebrow" style="margin-bottom:8px">Inlagda prov</div>${p.exams.sort((a, b) => a.date.localeCompare(b.date)).map(e => `<div class="row" style="justify-content:space-between;padding:6px 0;border-top:1px solid var(--line)"><div><b>${esc(e.title)}</b><div class="muted" style="font-size:.85rem">${fmtDate(e.date)} · ${daysUntil(e.date)} dagar · ${[...e.skillIds.map(id => kid.skills.find(s => s.id === id)?.short), ...e.deckIds.map(id => deckById(p, id)?.name)].filter(Boolean).join(', ')}</div></div><button class="btn ghost danger" style="min-height:36px;padding:0 10px" data-del-exam="${e.id}">Ta bort</button></div>`).join('')}</div>` : ''}
    <div class="card stack" style="gap:12px"><div class="eyebrow">Lägg till prov eller läxförhör</div>
      <div class="field"><label for="exTitle">Vad</label><input id="exTitle" placeholder="t.ex. Prov 13 Geometri, Glosförhör v.46"></div>
      <div class="field"><label for="exDate">Datum</label><input id="exDate" type="date" value="${addDays(todayKey(), 7)}"></div>
      <div class="field"><label>Områden som ingår</label><div class="checks" id="exSkills">${skillChecks}</div></div>
      ${deckChecks ? `<div class="field"><label>Glosor som ingår</label><div class="checks" id="exDecks">${deckChecks}</div></div>` : ''}
      <button class="btn secondary" data-act="addExam">Lägg till</button>
      <p class="muted" style="font-size:.9rem">Provet får nedräkning, provberedskap, provplan och provläge på ${esc(kid.name)}s startsida. Behöver provet ett nytt matteområde som inte finns i appen (t.ex. geometri eller procent)? Be Claude lägga till det.</p></div>`;
}
function parentDecks(kid, p) {
  return `
    <div class="card stack" style="gap:10px"><div class="eyebrow">Kurser på ${esc(kid.name)}s startsida</div><div class="checks">${allDecks(p).map(d => `<button class="check ${p.enabledDecks.includes(d.id) ? 'on' : ''}" data-toggle-deck="${d.id}">${LANGS[d.lang]?.flag || '🗂️'} ${esc(d.name)}</button>`).join('')}</div></div>
    ${p.decks.length ? `<div class="card"><div class="eyebrow" style="margin-bottom:8px">Egna glosläxor</div>${p.decks.map(d => `<div class="row" style="justify-content:space-between;padding:6px 0;border-top:1px solid var(--line)"><div><b>${d.emoji} ${esc(d.name)}</b><div class="muted" style="font-size:.85rem">${d.words.length} ord · ${LANGS[d.lang]?.name || 'Egna'}</div></div><div class="row"><button class="btn ghost" style="min-height:36px;padding:0 10px" data-edit-deck="${d.id}">Ändra</button><button class="btn ghost danger" style="min-height:36px;padding:0 10px" data-del-deck="${d.id}">Ta bort</button></div></div>`).join('')}</div>` : ''}
    <div class="card stack" style="gap:12px"><div class="eyebrow">${state.editDeck ? 'Ändra glosläxa' : 'Ny glosläxa'}</div>
      <div class="field"><label for="dkName">Namn</label><input id="dkName" placeholder="t.ex. Engelska v.44" value="${esc(state.editDeck?.name || '')}"></div>
      <div class="field"><label for="dkLang">Språk (styr uppläsning och övningstyper)</label><select id="dkLang">${[['en', 'Engelska'], ['es', 'Spanska'], ['sv', 'Svenska / fakta (ingen stavning)']].map(([v, l]) => `<option value="${v}" ${(state.editDeck?.lang || (kid.template === 'ak2' ? 'es' : 'en')) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label for="dkWords">Ord – en rad per ord: <code>främmande ord = svenska</code>. Valfri emoji sist: <code>dog = hund = 🐶</code></label><textarea class="cards" id="dkWords" placeholder="dog = hund = 🐶
cat = katt
Vilket år startade andra världskriget? = 1939">${esc((state.editDeck?.words || []).map(w => `${w.w} = ${w.t}${w.e ? ' = ' + w.e : ''}`).join('\n'))}</textarea></div>
      <div class="row"><button class="btn secondary" data-act="saveDeck">${state.editDeck ? 'Spara ändringar' : 'Skapa glosläxa'}</button>${state.editDeck ? `<button class="btn ghost" data-act="cancelEdit">Avbryt</button>` : ''}</div>
      <p class="muted" style="font-size:.9rem">Varje glosläxa blir automatiskt lektioner med nya ord, välj rätt, lyssna, para ihop, bygg ordet och skriv – och repeteras tills orden sitter. Du kan också skicka en bild på glosläxan till Claude så läggs den in.</p></div>`;
}
function parentSettings(kid, p) {
  const s = p.settings;
  const tg = (key, label, desc) => `<div class="toggle"><div><div class="tl">${label}</div><div class="td">${desc}</div></div><button class="switch ${s[key] ? 'on' : ''}" data-setting="${key}" aria-label="${label}"></button></div>`;
  return `<div class="card">
    ${tg('focus', 'Fokusläge', 'Korta sprintar, en sak i taget, "N kvar" i stället för poäng, pauspåminnelse, svar med ett tryck. Bra för den som har svårt att hålla fokus länge.')}
    ${tg('tts', 'Uppläsning', 'Läs upp ord och uppgifter med telefonens röst (bra för yngre barn och språk).')}
    ${tg('timer', 'Visa tid', 'Visar en klocka under sprintar. Av = mindre stress.')}
    ${tg('dark', 'Mörkt tema', 'Mörk bakgrund i appen (barnet kan också byta i butiken).')}
    <div class="toggle"><div><div class="tl">Läsvänligt typsnitt</div><div class="td">Lexend – jämnare bokstäver, lättare att läsa vid dyslexi.</div></div><button class="switch ${s.font === 'lexend' ? 'on' : ''}" data-setting-val="font:${s.font === 'lexend' ? 'standard' : 'lexend'}" aria-label="Läsvänligt typsnitt"></button></div>
    <div class="toggle"><div><div class="tl">Större text</div><div class="td">Lite större bokstäver i hela appen.</div></div><button class="switch ${s.textsize === 'large' ? 'on' : ''}" data-setting-val="textsize:${s.textsize === 'large' ? 'normal' : 'large'}" aria-label="Större text"></button></div>
    <div class="toggle"><div><div class="tl">Sprintlängd</div><div class="td">Antal uppgifter per sprint</div></div><div class="seg">${[5, 8, 10, 15].map(n => `<button class="${s.sprint === n ? 'on' : ''}" data-sprint="${n}">${n}</button>`).join('')}</div></div>
    <div class="toggle"><div><div class="tl">Dagligt mål</div><div class="td">Rätt svar per dag</div></div><div class="seg">${[5, 8, 10, 15, 20].map(n => `<button class="${s.goal === n ? 'on' : ''}" data-goal="${n}">${n}</button>`).join('')}</div></div>
  </div>
  <div class="card stack" style="gap:8px"><div class="eyebrow">Tips för fokus</div><p style="font-size:.95rem">Håll sprintarna korta (5) och fira att sprinten är klar, inte poängen. Samma tid varje dag (direkt efter mellanmålet) bygger vanan. Låt barnet välja uppdrag själv – autonomi ökar motivationen. Pausen efter två sprintar är inte slöseri, den gör att hjärnan hinner lagra.</p></div>`;
}


/* ========= Parent: family configuration (names, templates, themes – private, synced as _config) ========= */
const HUES = [['teal', 'Turkos'], ['orange', 'Orange'], ['pink', 'Rosa'], ['slate', 'Grå'], ['rod', 'Röd']];
function familyCard() {
  const kids = FAMILY.cfg ? FAMILY.cfg.kids : [];
  const row = (k) => `<div class="card stack" style="gap:8px;padding:12px" data-kidrow="${esc(k.id)}">
      <div class="row" style="gap:8px"><input class="answer-input grow" data-f="name" value="${esc(k.name)}" maxlength="30" placeholder="Namn" style="min-height:44px;font-size:1rem;text-align:left"><input class="answer-input" data-f="emoji" value="${esc(k.emoji || '')}" maxlength="4" style="width:64px;min-height:44px;font-size:1.2rem" aria-label="Emoji"></div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select data-f="template" class="answer-input" style="min-height:44px;font-size:.95rem">${Object.entries(TEMPLATES).map(([id, t]) => `<option value="${id}" ${k.template === id ? 'selected' : ''}>Kurs ${t.label}</option>`).join('')}</select>
        <select data-f="theme" class="answer-input" style="min-height:44px;font-size:.95rem">${Object.entries(FAMILY.THEMES).map(([id, t]) => `<option value="${id}" ${k.theme === id ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <select data-f="hue" class="answer-input" style="min-height:44px;font-size:.95rem">${HUES.map(([id, t]) => `<option value="${id}" ${k.hue === id ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </div>
      <div class="row" style="justify-content:space-between"><span class="muted" style="font-size:.85rem">id: ${esc(k.id)}${k.decks.length ? ` · ${k.decks.length} egna glosor` : ''}${k.exams.length ? ` · ${k.exams.length} prov` : ''}</span><button class="link" data-act="removeKid" data-id="${esc(k.id)}" style="color:var(--bad)">Ta bort ur familjen</button></div>
    </div>`;
  return `<div class="card stack" style="gap:10px"><div class="eyebrow">Familj</div>
    <p class="muted" style="font-size:.95rem">Barnens namn, kurs och tema sparas i familjens privata inställningar – inte i appens kod. Alla enheter hämtar dem automatiskt.</p>
    ${kids.map(row).join('') || '<p class="muted">Inga barn ännu. Lägg till ett barn eller läs in en konfiguration.</p>'}
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn secondary" data-act="saveFamilyCfg">Spara familj</button><button class="btn ghost" data-act="addKid">Lägg till barn</button><button class="btn ghost" data-act="toggleCfgJson">Läs in / exportera</button></div>
    <div id="cfgJsonWrap" class="stack hidden" style="gap:8px"><textarea id="cfgJson" rows="6" class="answer-input" style="font-size:.8rem;text-align:left;font-family:ui-monospace,monospace" placeholder='{"kids":[{"id":"…","name":"…","template":"ak4"}]}'>${FAMILY.cfg ? esc(FAMILY.exportJson()) : ''}</textarea><div class="row" style="gap:8px"><button class="btn secondary" data-act="importCfg">Läs in</button><button class="btn ghost" data-act="copyCfg">Kopiera</button></div></div>
  </div>`;
}
function readFamilyRows() {
  const rows = [...document.querySelectorAll('[data-kidrow]')];
  return rows.map(r => { const old = FAMILY.cfg.kids.find(k => k.id === r.dataset.kidrow) || {}; const g = (f) => r.querySelector(`[data-f="${f}"]`)?.value; return { ...old, id: r.dataset.kidrow, name: (g('name') || '').trim(), emoji: g('emoji') || '🙂', template: g('template'), theme: g('theme'), hue: g('hue') }; });
}


/* ========= Parent: sync / devices / deletion ========= */
function syncCard() {
  const m = AUTH.member;
  if (!m) return `<div class="card stack" style="gap:10px"><div class="eyebrow">Synk mellan enheter</div>
    <p class="muted" style="font-size:.95rem">Den här enheten är inte kopplad till familjen. Skriv in parkopplingskoden (från en kopplad förälderenhet) – eller en ny kod för att starta en familj.</p>
    <div class="field"><label for="famCode">Parkopplingskod</label><input id="famCode" value="${esc(DB.settings.family ? DB.settings.family + (DB.settings.joinCode && DB.settings.joinCode !== DB.settings.family ? '.' + DB.settings.joinCode : '') : '')}" placeholder="familj.kod" autocapitalize="off" autocomplete="off"></div>
    <div class="row"><button class="btn secondary" data-act="saveFamily">Koppla som förälder</button></div>
    ${AUTH.lastJoin ? `<p class="muted" style="font-size:.85rem;color:var(--bad)">${esc(AUTH.lastJoin)}</p>` : ''}<div id="syncState">${SYNC.badge()}</div></div>`;
  setTimeout(() => AUTH.listMembers().then(list => { const el = document.getElementById('memberList'); if (!el) return; if (!list) { el.innerHTML = '<p class="muted">Kunde inte hämta enheter.</p>'; return; } el.innerHTML = list.length ? list.sort((x, y) => y.lastSeen - x.lastSeen).map(d => `<div class="row" style="justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line)"><div class="grow" style="min-width:0"><div style="font-weight:700">${esc(d.device || 'Enhet')}${d.uid === AUTH.uid ? ' <span class="pill good" style="font-size:.75rem">den här</span>' : ''}</div><div class="muted" style="font-size:.8rem">${d.role === 'parent' ? 'Förälder' : 'Barn'} · senast ${d.lastSeen ? fmtDate(new Date(d.lastSeen).toISOString().slice(0, 10)) : '–'}</div></div><div class="row" style="gap:6px"><button class="link" data-act="setRole" data-uid="${esc(d.uid)}" data-role="${d.role === 'parent' ? 'kid' : 'parent'}">${d.role === 'parent' ? 'Gör till barn' : 'Gör till förälder'}</button><button class="link" data-act="removeMember" data-uid="${esc(d.uid)}" style="color:var(--bad)">Ta bort</button></div></div>`).join('') : '<p class="muted">Inga enheter.</p>'; }), 0);
  return `<div class="card stack" style="gap:10px"><div class="eyebrow">Synk mellan enheter</div>
    <p class="muted" style="font-size:.95rem">Bara parkopplade enheter kan läsa familjens data. Koppla en ny enhet genom att öppna parkopplingslänken på den – eller skriv in koden där. Byt kod om länken hamnat fel; redan kopplade enheter påverkas inte.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn secondary" data-act="copyFamLink">Kopiera parkopplingslänk</button><button class="btn ghost" data-act="rotateCode">Byt parkopplingskod</button></div>
    <div><div class="eyebrow" style="margin-bottom:4px">Kopplade enheter</div><div id="memberList"><p class="muted">Hämtar…</p></div></div>
    <div id="syncState">${SYNC.badge()}${AUTH.denied ? ' <span class="pill bad">Åtkomst nekad – enheten kan ha tagits bort</span>' : ''}</div></div>`;
}
function deleteCard() {
  if (!AUTH.member) return '';
  return `<div class="card stack" style="gap:8px"><div class="eyebrow">Radera data</div>
    <p class="muted" style="font-size:.95rem">Raderar framsteg i molnet och på den här enheten. Andra kopplade enheter nollställs när de synkar nästa gång.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap">${KIDS.map(k => `<button class="btn ghost" data-act="deleteKidData" data-id="${esc(k.id)}">Radera ${esc(k.name)}s framsteg</button>`).join('')}</div>
    <button class="btn ghost" data-act="deleteFamilyData" style="color:var(--bad);border-color:var(--bad)">Radera all familjedata i molnet</button></div>`;
}
// Tombstone: skriver en tom profil med resetAt så att alla enheter nollställer i stället för att ladda upp sin kopia.
async function deleteKidData(kidId) {
  const now = Date.now(); const fresh = { ...defaultProfile(kidId), resetAt: now, updatedAt: now, syncedAt: now }; fresh._lx = 0; fresh._lg = 0;
  DB.profiles[kidId] = fresh; try { localStorage.setItem(STORE_KEY, dbJSON()); } catch (e) { /* ignore */ }
  if (!SYNC.active) return false;
  try { const body = { fields: { json: { stringValue: JSON.stringify(fresh) }, updatedAt: { integerValue: String(now) }, kid: { stringValue: kidId } } }; const r = await SYNC.fetch(SYNC.url(kidId), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.ok; } catch (e) { return false; }
}
async function deleteFamilyData() {
  let n = 0; const del = async (url) => { try { const r = await SYNC.fetch(url, { method: 'DELETE' }); if (r.ok) n++; } catch (e) { /* ignore */ } };
  try { const r = await SYNC.fetch(`${AUTH.base()}/profiles?key=${SYNC.cfg.apiKey}&pageSize=100`); if (r.ok) { const j = await r.json(); for (const d of j.documents || []) await del(`https://firestore.googleapis.com/v1/${d.name}?key=${SYNC.cfg.apiKey}`); } } catch (e) { /* ignore */ }
  const members = await AUTH.listMembers() || []; for (const m of members) if (m.uid !== AUTH.uid) await del(AUTH.doc('members/' + m.uid));
  await del(AUTH.doc('meta/info')); await del(AUTH.doc('members/' + AUTH.uid));
  // lokalt: koppla bort och glöm familjen
  for (const k of KIDS) DB.profiles[k.id] = defaultProfile(k.id);
  DB.settings.family = ''; DB.settings.member = null; DB.settings.joinCode = null; DB.settings.push = null; FAMILY.cfg = null; FAMILY.saveLocal(); buildKids();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { /* ignore */ }
  return n;
}

/* ========= Event delegation ========= */
app.addEventListener('click', (e) => {
  const t = e.target;
  const sp = t.closest('[data-speak]'); if (sp) { if (sp.dataset.highlight) speakHighlight(document.getElementById('qtext'), sp.dataset.lang); else TTS.speak(sp.dataset.speak, sp.dataset.lang, sp.dataset.rate ? Number(sp.dataset.rate) : 0.9); return; }
  const goBtn = t.closest('[data-go]'); if (goBtn) { const dest = goBtn.dataset.go; if (B && B.timer) clearInterval(B.timer); if (dest === 'home' && !state.kid) return go('start'); return go(dest); }
  const kidBtn = t.closest('[data-kid]'); if (kidBtn) { state.kid = kidBtn.dataset.kid; state.subj = null; go('home'); if (SYNC.active && Date.now() - (SYNC.lastPull[state.kid] || 0) > 20000) SYNC.refresh(state.kid).then(ch => { if (ch && state.screen === 'home') VIEWS.home(); }); return; }
  const petBtn = t.closest('[data-pet]'); if (petBtn) { const p = prof(state.kid); p.pet = petBtn.dataset.pet; save(); confetti(); return go('home'); }
  const kid = state.kid ? kidById(state.kid) : null;
  const v2Btn = t.closest('[data-v2]'); if (v2Btn) return V2.click(v2Btn, kid);
  const skillBtn = t.closest('[data-skill]'); if (skillBtn && kid) return startSession(kid, { skillIds: [skillBtn.dataset.skill] });
  const deckBtn = t.closest('[data-deck]'); if (deckBtn && kid) return startSession(kid, { deckIds: [deckBtn.dataset.deck], wordsOnly: true, n: 12 });
  const chainBtn = t.closest('[data-chain-next]'); if (chainBtn && kid && S) { const id = chainBtn.dataset.chainNext; const deck = id.startsWith('mix_') ? virtualMixDeck(prof(kid.id), id.slice(4)) : deckById(prof(kid.id), id); return startSession(kid, { deckIds: [deck.id], deck, wordsOnly: true, n: 12, chainStats: S.chain }); }
  const langPass = t.closest('[data-langpass]'); if (langPass && kid) { const nx = nextDeckAfter(kid, null) || { deck: enabledDecks(prof(kid.id))[0] }; return startSession(kid, { deckIds: [nx.deck.id], deck: nx.deck, wordsOnly: true, n: 12 }); }
  const recBtn = t.closest('[data-rec]'); if (recBtn && kid) { LE.nextSrc = 'kor'; return startSession(kid, recommendSprint(kid).opts); }
  const testBtn = t.closest('[data-test]'); if (testBtn && kid) return startSession(kid, { mode: 'test', examId: testBtn.dataset.test });
  const planBtn = t.closest('[data-plan]'); if (planBtn && kid) return go('plan', { examId: planBtn.dataset.plan });
  const methodBtn = t.closest('[data-method]'); if (methodBtn && kid) return go('method', { skillId: methodBtn.dataset.method });
  const subjBtn = t.closest('[data-subj]'); if (subjBtn) { state.subj = subjBtn.dataset.subj; try { localStorage.setItem('pluggappen.subj.' + state.kid, state.subj); } catch (e) { /* ignore */ } const y = window.scrollY; VIEWS.home(); window.scrollTo?.(0, y); return; }
  const rateBtn = t.closest('[data-rate]'); if (rateBtn && S) { const p = prof(S.kid.id); const ids = [...new Set(S.queue.filter(q => q.cat === 'math').map(q => q.skill.id))]; const r = rateBtn.dataset.rate; ids.forEach(id => { const st = skillState(p, id); const acc = S.queue.map((q, i) => q.skill?.id === id ? S.results[i] : null).filter(x => x !== null); const okRate = acc.length ? acc.filter(Boolean).length / acc.length : 0; if (r === 'easy' && okRate >= 0.6 && st.lvl < ((S.kid.skills.find(x => x.id === id) || {}).maxLvl || 3)) st.lvl++; if (r === 'hard' && st.lvl > 1) st.lvl--; st.streak = 0; }); save(); document.getElementById('rateCard').innerHTML = `<div class="muted">${r === 'easy' ? 'Tack – nästa sprint blir lite svårare.' : r === 'hard' ? 'Tack – nästa sprint blir lite lättare.' : 'Tack – vi håller den här nivån.'}</div>`; return; }
  const claimBtn = t.closest('[data-claim]'); if (claimBtn && kid) { claimQuest(kid, claimBtn.dataset.claim); return state.screen === 'home' ? VIEWS.home() : claimBtn.closest('.quest').remove(); }
  const buyBtn = t.closest('[data-buy]'); if (buyBtn && kid) return buy(kid, buyBtn.dataset.buy);
  const blitzBtn = t.closest('[data-blitz]'); if (blitzBtn && kid) return startBlitz(kid, blitzBtn.dataset.blitz);
  const bch = t.closest('[data-bchoice]'); if (bch && B && !B.done) { const v = Number(bch.dataset.bchoice); if (v === B.q.answer) { B.score++; beep('tick'); recordAnswer(B.kid.id, B.skill.id, true, B.q.level, true); } else { B.wrong++; B.end -= 2000; beep('no'); bch.classList.add('no'); return setTimeout(() => { if (!B.done) nextBlitzQ(); }, 350); } return nextBlitzQ(); }
  const togDeck = t.closest('[data-toggle-deck]'); if (togDeck) { const pid = state.screen === 'parent' ? state.tab : state.kid; const p = prof(pid); const id = togDeck.dataset.toggleDeck; if (p.enabledDecks.includes(id)) { p.enabledDecks = p.enabledDecks.filter(x => x !== id); p.removedDefaults = [...(p.removedDefaults || []), id]; } else { p.enabledDecks = [...p.enabledDecks, id]; p.removedDefaults = (p.removedDefaults || []).filter(x => x !== id); } save(); return state.screen === 'parent' ? VIEWS.parent() : VIEWS.courses(); }
  const tabBtn = t.closest('[data-tab]'); if (tabBtn) { state.tab = tabBtn.dataset.tab; state.sub = 'overview'; state.editDeck = null; return VIEWS.parent(); }
  const subBtn = t.closest('[data-sub]'); if (subBtn) { state.sub = subBtn.dataset.sub; return VIEWS.parent(); }
  const lePol = t.closest('[data-le-pol]'); if (lePol && state.screen === 'parent' && kidById(state.tab)) { const p = prof(state.tab); p.settings.lePolicy = lePol.dataset.lePol || 'auto'; p.settings.lePolicyAt = LE.now(); LE.invalidate(state.tab); save(); return VIEWS.parent(); }
  const pushBtn = t.closest('[data-push]'); if (pushBtn) { const kidId = pushBtn.dataset.push; const cur = PUSH.current(); if (cur && cur.kid === kidId) { PUSH.disable().then(() => { toast('Påminnelser av'); state.screen === 'parent' ? VIEWS.parent() : VIEWS.home(); }); } else { toast('Slår på…'); PUSH.enable(kidId).then(r => { toast(r.ok ? 'Påminnelser på' : r.msg); state.screen === 'parent' ? VIEWS.parent() : VIEWS.home(); }); } return; }
  const setVal = t.closest('[data-setting-val]'); if (setVal) { const [k, v] = setVal.dataset.settingVal.split(':'); const p = prof(state.tab); p.settings[k] = v; save(); return VIEWS.parent(); }
  const setBtn = t.closest('[data-setting]'); if (setBtn) { const p = prof(state.tab); p.settings[setBtn.dataset.setting] = !p.settings[setBtn.dataset.setting]; save(); return VIEWS.parent(); }
  const sprBtn = t.closest('[data-sprint]'); if (sprBtn) { prof(state.tab).settings.sprint = Number(sprBtn.dataset.sprint); save(); return VIEWS.parent(); }
  const goalBtn = t.closest('[data-goal]'); if (goalBtn) { prof(state.tab).settings.goal = Number(goalBtn.dataset.goal); save(); return VIEWS.parent(); }
  const delExam = t.closest('[data-del-exam]'); if (delExam) { const p = prof(state.tab); p.exams = p.exams.filter(x => x.id !== delExam.dataset.delExam); p.removedDefaults = [...(p.removedDefaults || []), delExam.dataset.delExam]; save(); return VIEWS.parent(); }
  const delDeck = t.closest('[data-del-deck]'); if (delDeck) { const p = prof(state.tab); const id = delDeck.dataset.delDeck; p.decks = p.decks.filter(x => x.id !== id); p.enabledDecks = p.enabledDecks.filter(x => x !== id); save(); return VIEWS.parent(); }
  const editDeck = t.closest('[data-edit-deck]'); if (editDeck) { state.editDeck = prof(state.tab).decks.find(d => d.id === editDeck.dataset.editDeck); VIEWS.parent(); document.getElementById('dkName')?.scrollIntoView?.({ behavior: 'smooth' }); return; }
  const act = t.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'felbok') return startSession(kid, { mode: 'felbok', n: Math.min(10, (prof(kid.id).mistakes || []).length) });
    if (a === 'bonus') { if (!S) return go('home'); return startSession(S.kid, { ...S.opts, n: 5, bonus: true, chainStats: undefined }); }
    if (a === 'again') { if (!S) return go('home'); if (S.mode === 'test') return startSession(S.kid, { mode: 'test', examId: S.examId }); if (S.mode === 'felbok') return (prof(S.kid.id).mistakes || []).length ? startSession(S.kid, { mode: 'felbok', n: 10 }) : go('home'); return startSession(S.kid, S.opts); }
    if (a === 'testSound') { const on = DB.settings.sound; DB.settings.sound = true; beep('perfect'); DB.settings.sound = on; const el = document.getElementById('soundState'); if (el) el.textContent = `Ljud ${on ? 'på' : 'AV'} · ctx ${audioCtx ? audioCtx.state : 'saknas'} · ${window.navigator.standalone ? 'hemskärm' : 'webbläsare'} · ${window.PLUGG_BUILD || ''}`; return; }
    if (a === 'sound' || a === 'toggleSound') { DB.settings.sound = !DB.settings.sound; save(); return a === 'sound' ? VIEWS.home() : VIEWS.parent(); }
    if (a === 'saveFamily') { const pr = AUTH.parsePair(document.getElementById('famCode').value); if (!pr || pr.fam.length < 6) return toast('Minst 6 tecken, bara bokstäver, siffror, bindestreck och punkt'); DB.settings.family = pr.fam; DB.settings.joinCode = pr.code; DB.settings.member = null; save(); toast('Kopplar…'); ensureMembership().then(ok => { if (!ok) return toast(AUTH.lastJoin || 'Kunde inte koppla'); return FAMILY.pull().then(() => { load(); return SYNC.refreshAll(); }).then(() => toast('Enheten är parkopplad som förälder')); }).then(() => VIEWS.parent()); return; }
    if (a === 'saveFamilyCfg') { if (!FAMILY.cfg) FAMILY.cfg = { v: 1, updatedAt: Date.now(), kids: [] }; const kids = readFamilyRows(); if (kids.some(k => !k.name)) return toast('Alla barn behöver ett namn'); FAMILY.update(c => { c.kids = kids; }); toast('Familjen sparad'); return VIEWS.parent(); }
    if (a === 'addKid') { if (!FAMILY.cfg) { FAMILY.cfg = { v: 1, updatedAt: Date.now(), kids: [] }; } const kids = readFamilyRows(); let id = 'barn' + (kids.length + 1); while (kids.some(k => k.id === id)) id += 'x'; FAMILY.update(c => { c.kids = [...kids, { id, name: '', template: 'ak4', theme: 'pet', hue: 'teal', emoji: '🙂', exams: [], decks: [] }]; }); return VIEWS.parent(); }
    if (a === 'removeKid') { const id = t.dataset.id; const k = FAMILY.cfg?.kids.find(x => x.id === id); if (!k) return; if (!confirm(`Ta bort ${k.name} ur familjen?\n\nBarnet försvinner från startsidan på alla enheter. Framstegen raderas INTE – de ligger kvar i molnet tills du raderar dem under "Radera data".`)) return; FAMILY.update(c => { c.kids = c.kids.filter(x => x.id !== id); }); toast(`${k.name} borttagen`); return VIEWS.parent(); }
    if (a === 'toggleCfgJson') { document.getElementById('cfgJsonWrap')?.classList.toggle('hidden'); return; }
    if (a === 'importCfg') { const txt = document.getElementById('cfgJson')?.value || ''; FAMILY.importJson(txt).then(r => { toast(r.msg); if (r.ok) VIEWS.parent(); }); return; }
    if (a === 'copyCfg') { const txt = FAMILY.cfg ? FAMILY.exportJson() : ''; navigator.clipboard?.writeText(txt).then(() => toast('Kopierat')).catch(() => toast('Kunde inte kopiera')); return; }
    if (a === 'pairFamily') { const pr = AUTH.parsePair(document.getElementById('pairCode')?.value || ''); if (!pr || pr.fam.length < 6) return toast('Koden är för kort'); DB.settings.family = pr.fam; DB.settings.joinCode = pr.code; save(); toast('Kopplar…'); ensureMembership().then(ok => { if (!ok) { toast(AUTH.lastJoin || 'Kunde inte koppla'); DB.settings.family = ''; save(); return VIEWS.start(); } return FAMILY.pull().then(got => { load(); if (!got) toast('Kopplad – men familjen saknar inställningar. Läs in dem i föräldraläget.'); VIEWS.start(); SYNC.refreshAll(); }); }); return; }
    if (a === 'retryFamily') { toast('Hämtar…'); ensureMembership().then(() => FAMILY.pull()).then(ok => { load(); if (!ok) toast(AUTH.lastJoin || 'Inga familjeinställningar hittades'); VIEWS.start(); SYNC.refreshAll(); }); return; }
    if (a === 'copyFamLink') { AUTH.getJoinCode().then(code => { if (!code) return toast('Kunde inte hämta parkopplingskoden'); const link = AUTH.pairLink(code); navigator.clipboard?.writeText(link).then(() => toast('Parkopplingslänk kopierad – öppna den på barnets enhet')).catch(() => prompt('Parkopplingslänk:', link)); }); return; }
    if (a === 'rotateCode') { if (!confirm('Byta parkopplingskod?\n\nEnheter som redan är kopplade fortsätter fungera. Gamla länkar slutar fungera för nya enheter.')) return; AUTH.rotateCode().then(code => { if (!code) return toast('Kunde inte byta kod'); toast('Ny kod skapad'); const link = AUTH.pairLink(code); navigator.clipboard?.writeText(link).then(() => toast('Ny parkopplingslänk kopierad')).catch(() => prompt('Ny parkopplingslänk:', link)); VIEWS.parent(); }); return; }
    if (a === 'removeMember') { const uid = t.dataset.uid; const own = uid === AUTH.uid; if (!confirm(own ? 'Koppla bort DEN HÄR enheten från familjen? Du måste parkoppla igen för att synka.' : 'Ta bort enheten från familjen? Den slutar synka och kan inte längre läsa familjens data.')) return; AUTH.removeMember(uid).then(ok => { if (!ok) return toast('Kunde inte ta bort'); if (own) { DB.settings.member = null; save(); } toast('Enheten borttagen'); VIEWS.parent(); }); return; }
    if (a === 'setRole') { AUTH.setRole(t.dataset.uid, t.dataset.role).then(ok => { toast(ok ? 'Roll ändrad' : 'Kunde inte ändra roll'); VIEWS.parent(); }); return; }
    if (a === 'deleteKidData') { const kid = kidById(t.dataset.id); if (!kid) return; const typed = prompt(`Radera ALLA framsteg för ${kid.name} (XP, nivåer, ord, prov, Felboken) på alla enheter?\n\nSkriv barnets namn för att bekräfta:`); if (typed === null) return; if (typed.trim().toLowerCase() !== kid.name.trim().toLowerCase()) return toast('Namnet stämde inte – inget raderades'); deleteKidData(kid.id).then(ok => { toast(ok ? `${kid.name}s data raderad` : 'Raderat lokalt – molnet kunde inte nås'); VIEWS.parent(); }); return; }
    if (a === 'deleteFamilyData') { const typed = prompt('Radera HELA familjens molndata (alla barns framsteg, inställningar, enheter, påminnelser)? Detta går inte att ångra.\n\nSkriv RADERA för att bekräfta:'); if (typed === null) return; if (typed.trim() !== 'RADERA') return toast('Inget raderades'); deleteFamilyData().then(n => { toast(`Familjens molndata raderad (${n} dokument). Appen är nu frånkopplad.`); go('start'); }); return; }
    if (a === 'savePin') { const v = document.getElementById('newPin').value.replace(/\D/g, ''); if (v.length !== 4) return toast('Koden ska vara 4 siffror'); DB.settings.pin = v; save(); toast('Sparat'); return VIEWS.parent(); }
    if (a === 'addExam') { const p = prof(state.tab); const title = document.getElementById('exTitle').value.trim(); const date = document.getElementById('exDate').value; if (!title || !date) return toast('Fyll i vad och datum'); const skillIds = [...document.querySelectorAll('input[name=ex_skill]:checked')].map(x => x.value); const deckIds = [...document.querySelectorAll('input[name=ex_deck]:checked')].map(x => x.value); p.exams.push({ id: 'ex' + Date.now(), title, date, skillIds, deckIds }); save(); toast('Provet är inlagt'); return VIEWS.parent(); }
    if (a === 'saveDeck') { const p = prof(state.tab); const name = document.getElementById('dkName').value.trim(); const lang = document.getElementById('dkLang').value; const lines = document.getElementById('dkWords').value.split('\n').map(l => l.trim()).filter(Boolean); const words = []; for (const l of lines) { const parts = l.split('=').map(x => x.trim()); if (parts.length >= 2 && parts[0] && parts[1]) words.push({ id: 'w' + Date.now() + '_' + words.length, w: parts[0], t: parts[1], e: parts[2] || '' }); } if (!name || !words.length) return toast('Ge läxan ett namn och minst ett ord'); if (state.editDeck) { const d = p.decks.find(x => x.id === state.editDeck.id); const keep = new Map(d.words.map(w => [w.w.toLowerCase(), w.id])); words.forEach(w => { if (keep.has(w.w.toLowerCase())) w.id = keep.get(w.w.toLowerCase()); }); Object.assign(d, { name, lang, words, noSpell: lang === 'sv' }); state.editDeck = null; } else { const deck = { id: 'custom_' + Date.now(), lang, name, emoji: lang === 'es' ? '🇪🇸' : lang === 'en' ? '🇬🇧' : '🗂️', level: 1, builtin: false, noSpell: lang === 'sv', words }; p.decks.push(deck); p.enabledDecks.push(deck.id); } save(); toast(`${words.length} ord sparade`); return VIEWS.parent(); }
    if (a === 'cancelEdit') { state.editDeck = null; return VIEWS.parent(); }
    if (a === 'syncCopy') { const code = encodeProfile(state.kid); const area = document.getElementById('syncArea'); area.innerHTML = `<textarea class="cards" id="syncTa" readonly style="min-height:80px;font-size:.8rem">${code}</textarea><p class="muted" style="font-size:.9rem;margin-top:6px" id="syncMsg">Koden är markerad.</p>`; const ta = document.getElementById('syncTa'); ta.focus(); ta.select(); navigator.clipboard?.writeText(code).then(() => { document.getElementById('syncMsg').textContent = 'Kopierad! Öppna appen på den andra enheten, tryck på synk-ikonen och välj Klistra in kod.'; }).catch(() => {}); return; }
    if (a === 'syncPaste') { const area = document.getElementById('syncArea'); area.innerHTML = `<textarea class="cards" id="syncTa" placeholder="Klistra in koden här" style="min-height:80px;font-size:.8rem"></textarea><button class="btn secondary" style="margin-top:8px" id="doSync">Läs in</button><div id="syncMsg"></div>`; try { navigator.clipboard?.readText?.().then(t => { if (decodeProfile(t)) document.getElementById('syncTa').value = t.trim(); }).catch(() => {}); } catch (e) { /* no clipboard read */ } document.getElementById('doSync').addEventListener('click', () => { const obj = decodeProfile(document.getElementById('syncTa').value); if (!obj) return toast('Koden gick inte att läsa'); if (obj.k && obj.k !== state.kid) return toast(`Den här koden är ${kidById(obj.k)?.name || 'någon annans'} – välj rätt profil först`); const here = prof(state.kid); const incoming = obj.p; const warn = activityScore(here) > activityScore(incoming); document.getElementById('syncMsg').innerHTML = `<div class="feedback ${warn ? 'warn' : 'ok'}" style="margin-top:8px"><span>${warn ? '⚠️' : '✅'}</span><div><div class="big">${warn ? 'Koden har mindre framsteg än den här enheten' : 'Koden ser bra ut'}</div><div class="sub">Koden: ${incoming.xp} XP, ${activityScore(incoming)} övningar${obj.t ? ', från ' + new Date(obj.t).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : ''}. Här: ${here.xp} XP, ${activityScore(here)} övningar. Det som finns här ersätts.</div><div class="row" style="margin-top:8px"><button class="btn" style="min-height:40px" id="confirmSync">Ersätt och läs in</button></div></div></div>`; document.getElementById('confirmSync').addEventListener('click', () => { DB.profiles[state.kid] = { ...defaultProfile(state.kid), ...incoming }; save(); applyLook(kidById(state.kid)); toast('Framstegen är inlästa'); go('home'); }); }); return; }
    if (a === 'export') { const code = encodeProfile(state.tab); const area = document.getElementById('ioArea'); area.innerHTML = `<textarea class="cards" id="ioTa" readonly style="min-height:90px">${code}</textarea><p class="muted" style="font-size:.9rem;margin-top:6px">Koden är markerad – kopiera den.</p>`; const ta = document.getElementById('ioTa'); ta.focus(); ta.select(); navigator.clipboard?.writeText(code).then(() => toast('Kod kopierad')).catch(() => {}); return; }
    if (a === 'import') { const area = document.getElementById('ioArea'); area.innerHTML = `<textarea class="cards" id="ioTa" placeholder="Klistra in koden här" style="min-height:90px"></textarea><button class="btn secondary" style="margin-top:8px" id="doImport">Läs in</button>`; document.getElementById('doImport').addEventListener('click', () => { const obj = decodeProfile(document.getElementById('ioTa').value); if (!obj) return toast('Koden gick inte att läsa'); DB.profiles[state.tab] = { ...defaultProfile(state.tab), ...obj.p }; save(); toast('Framsteg inlästa'); VIEWS.parent(); }); return; }
    if (a === 'reset') { const area = document.getElementById('ioArea'); area.innerHTML = `<div class="feedback warn"><span>⚠️</span><div><div class="big">Nollställa ${kidById(state.tab).name}s framsteg?</div><div class="sub">Det går inte att ångra.</div><div class="row" style="margin-top:8px"><button class="btn" style="background:var(--bad);box-shadow:none;min-height:40px" id="doReset">Ja, nollställ</button><button class="btn ghost" style="min-height:40px" id="noReset">Avbryt</button></div></div></div>`; document.getElementById('doReset').addEventListener('click', () => { DB.profiles[state.tab] = defaultProfile(state.tab); save(); toast('Nollställt'); VIEWS.parent(); }); document.getElementById('noReset').addEventListener('click', () => { area.innerHTML = ''; }); return; }
  }
  if (state.screen === 'practice') onPractice(e);
});

/* ========= Boot ========= */
// Ser till att enheten är inloggad och medlem i familjen. Gamla enheter (bara familjekod) går med automatiskt med koden = familjekoden.
async function ensureMembership() {
  if (!SYNC.active) return false;
  if (AUTH.member) { await AUTH.signIn(); AUTH.touch(); return true; }
  const role = DB.settings.push && DB.settings.push.kid === 'parent' ? 'parent' : 'kid';
  const code = DB.settings.joinCode || SYNC.family; // legacy: koden är familjekoden
  const r = await AUTH.join(code, role);
  if (!r.ok) { AUTH.lastJoin = r.msg; }
  return r.ok;
}
function boot(snap) {
  FAMILY.loadLocal(); buildKids(); FAMILY.loadContentLocal();   // 2.1: familjens privata innehåll (paket + skoluppgifter) från förra synken
  load(); TTS.init();
  try { window.claude?.hot?.snapshot?.(() => ({ screen: state.screen, kid: state.kid })); } catch (e) { /* no hot */ }
  let h = (location.hash || '').replace('#', '');
  if (h.startsWith('fam-') && SYNC.cfg) { const pr = AUTH.parsePair(h.slice(4)); if (pr) { DB.settings.family = pr.fam; DB.settings.joinCode = pr.code; try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { /* ignore */ } } h = ''; }
  if (SYNC.cfg && SYNC.family) { try { history.replaceState(null, '', location.pathname + '#fam-' + SYNC.family); } catch (e) { /* ignore */ } } // bara familje-id i adressfältet – aldrig parkopplingskoden
  AUTH.load();
  if (SYNC.active) { ensureMembership().then(() => FAMILY.pull()).then((cfgChanged) => FAMILY.pullContent().then(cc => cfgChanged || cc, () => cfgChanged)).then((cfgChanged) => { if (cfgChanged) { load(); if (state.screen === 'start') VIEWS.start(); } return SYNC.refreshAll(); }).then((changed) => { if (state.screen === 'start' || (changed && state.screen === 'home')) VIEWS[state.screen](); }); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && SYNC.active && state.screen !== 'practice' && state.screen !== 'blitzplay') SYNC.refreshAll().then((changed) => { if (changed && VIEWS[state.screen]) VIEWS[state.screen](); }); }); }
  const [hk, hact] = h.split('-');
  if (snap && snap.kid && kidById(snap.kid)) { state.kid = snap.kid; go('home'); }
  else if (kidById(hk) && hact === 'kor') { state.kid = hk; applyLook(kidById(hk)); const kid = kidById(hk); const p = prof(hk); if (!p.pet) { p.pet = isTeen(kid) || isSport(kid) ? 'none' : PETS[0].id; save(); } if (V2.on(kid)) { go('home'); V2.click({ dataset: { v2: 'kor' } }, kid); } else { LE.nextSrc = 'kor'; startSession(kid, recommendSprint(kid).opts); } }
  else if (kidById(hk) && hact === 'sprak') { state.kid = hk; applyLook(kidById(hk)); const kid = kidById(hk); const nx = nextDeckAfter(kid, null); if (nx) startSession(kid, { deckIds: [nx.deck.id], deck: nx.deck, wordsOnly: true, n: 12 }); else go('home'); }
  else if (kidById(h)) { state.kid = h; go('home'); }
  else if (h === 'foralder') go('parent');
  else go('start');
}
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? null);
window.PA = { LE, LE2, LECAT, LER, V2, RECALL, CHG, checkAnswer, answerDisplay, makeQuestion, mergeProfiles, get S() { return S; }, get DB() { return DB; }, get B() { return B; }, Poly, KIDS, TEMPLATES, FAMILY, AUTH, deleteKidData, deleteFamilyData, buildKids, load, flushSave, rerender: () => VIEWS[state.screen] && VIEWS[state.screen](), BUILTIN_DECKS, SYNC, save, setKid: (id) => { state.kid = id; }, version: '3.0' };
