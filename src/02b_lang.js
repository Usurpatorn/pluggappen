/* ========= Language learning: decks, spaced repetition, exercise generation ========= */
const LANGS = { es: { name: 'Spanska', flag: '🇪🇸', tts: 'es-ES' }, en: { name: 'Engelska', flag: '🇬🇧', tts: 'en-GB' }, sv: { name: 'Svenska', flag: '🇸🇪', tts: 'sv-SE' } };
// deck: { id, lang, name, emoji, level, words: [{ id, w (foreign), t (swedish), e (emoji) }], noSpell }
const mkDeck = (id, lang, name, emoji, level, rows, opts = {}) => ({ id, lang, name, emoji, level, builtin: true, ...opts, words: rows.map((r, i) => ({ id: id + '_' + i, w: r[0], t: r[1], e: r[2] || '' })) });

// Familjens egna/skolans glosor ligger inte här utan i familjekonfigurationen (FAMILY.kids[].decks) och byggs med deckFromConfig().
const deckFromConfig = (d) => ({ id: d.id, lang: d.lang || 'en', name: d.name, emoji: d.emoji || '📘', level: d.level || 2, builtin: false, fromConfig: true, words: d.words.map((r, i) => ({ id: d.id + '_' + i, w: r[0], t: r[1], e: r[2] || '' })) });
const BUILTIN_DECKS = [
  // ---------- Spanska (nybörjare, lågstadiet) ----------
  mkDeck('es_halsa', 'es', 'Hälsa och säg hej', '👋', 1, [
    ['hola', 'hej', '👋'], ['adiós', 'hej då', '🚪'], ['buenos días', 'god morgon', '🌅'], ['buenas noches', 'god natt', '🌙'], ['gracias', 'tack', '🙏'],
    ['por favor', 'snälla', '🤲'], ['sí', 'ja', '✅'], ['no', 'nej', '❌'], ['¿cómo estás?', 'hur mår du?', '🙂'], ['muy bien', 'mycket bra', '👍'],
    ['me llamo', 'jag heter', '🏷️'], ['amigo', 'kompis', '🧑‍🤝‍🧑'],
  ]),
  mkDeck('es_siffror', 'es', 'Siffror 1–10', '🔢', 1, [
    ['uno', 'ett', '1️⃣'], ['dos', 'två', '2️⃣'], ['tres', 'tre', '3️⃣'], ['cuatro', 'fyra', '4️⃣'], ['cinco', 'fem', '5️⃣'],
    ['seis', 'sex', '6️⃣'], ['siete', 'sju', '7️⃣'], ['ocho', 'åtta', '8️⃣'], ['nueve', 'nio', '9️⃣'], ['diez', 'tio', '🔟'],
  ]),
  mkDeck('es_farger', 'es', 'Färger', '🎨', 1, [
    ['rojo', 'röd', '🔴'], ['azul', 'blå', '🔵'], ['verde', 'grön', '🟢'], ['amarillo', 'gul', '🟡'], ['naranja', 'orange', '🟠'],
    ['rosa', 'rosa', '🌸'], ['blanco', 'vit', '⬜'], ['negro', 'svart', '⬛'], ['morado', 'lila', '🟣'], ['marrón', 'brun', '🟤'],
  ]),
  mkDeck('es_djur', 'es', 'Djur', '🐾', 1, [
    ['el perro', 'hunden', '🐶'], ['el gato', 'katten', '🐱'], ['el caballo', 'hästen', '🐴'], ['la vaca', 'kon', '🐮'], ['el pájaro', 'fågeln', '🐦'],
    ['el pez', 'fisken', '🐟'], ['el conejo', 'kaninen', '🐰'], ['el ratón', 'musen', '🐭'], ['la mariposa', 'fjärilen', '🦋'], ['el león', 'lejonet', '🦁'],
    ['el elefante', 'elefanten', '🐘'], ['la rana', 'grodan', '🐸'],
  ]),
  mkDeck('es_familj', 'es', 'Familjen', '👨‍👩‍👧‍👦', 1, [
    ['la madre', 'mamman', '👩'], ['el padre', 'pappan', '👨'], ['la hermana', 'systern', '👧'], ['el hermano', 'brodern', '👦'], ['la abuela', 'mormor/farmor', '👵'],
    ['el abuelo', 'morfar/farfar', '👴'], ['la familia', 'familjen', '👨‍👩‍👧‍👦'], ['el bebé', 'bebisen', '👶'],
  ]),
  mkDeck('es_mat', 'es', 'Mat och dryck', '🍎', 1, [
    ['la manzana', 'äpplet', '🍎'], ['el plátano', 'bananen', '🍌'], ['el pan', 'brödet', '🍞'], ['la leche', 'mjölken', '🥛'], ['el agua', 'vattnet', '💧'],
    ['el queso', 'osten', '🧀'], ['el helado', 'glassen', '🍦'], ['la pizza', 'pizzan', '🍕'], ['la fresa', 'jordgubben', '🍓'], ['el huevo', 'ägget', '🥚'],
    ['la zanahoria', 'moroten', '🥕'], ['el chocolate', 'chokladen', '🍫'],
  ]),
  mkDeck('es_kropp', 'es', 'Kroppen', '🫶', 2, [
    ['la cabeza', 'huvudet', '🙂'], ['la mano', 'handen', '✋'], ['el pie', 'foten', '🦶'], ['el ojo', 'ögat', '👁️'], ['la boca', 'munnen', '👄'],
    ['la nariz', 'näsan', '👃'], ['la oreja', 'örat', '👂'], ['el pelo', 'håret', '💇'],
  ]),
  mkDeck('es_skola', 'es', 'I skolan', '🏫', 2, [
    ['el libro', 'boken', '📖'], ['el lápiz', 'pennan', '✏️'], ['la mochila', 'ryggsäcken', '🎒'], ['la escuela', 'skolan', '🏫'], ['la profesora', 'läraren', '👩‍🏫'],
    ['la mesa', 'bordet', '🪑'], ['la silla', 'stolen', '💺'], ['el papel', 'papperet', '📄'],
  ]),
  mkDeck('es_klader', 'es', 'Kläder', '👕', 2, [
    ['la camiseta', 't-shirten', '👕'], ['los pantalones', 'byxorna', '👖'], ['los zapatos', 'skorna', '👟'], ['el vestido', 'klänningen', '👗'], ['el sombrero', 'hatten', '🎩'],
    ['la chaqueta', 'jackan', '🧥'], ['los calcetines', 'strumporna', '🧦'], ['la bufanda', 'halsduken', '🧣'],
  ]),
  mkDeck('es_kanslor', 'es', 'Hur mår du?', '😊', 2, [
    ['feliz', 'glad', '😊'], ['triste', 'ledsen', '😢'], ['cansado', 'trött', '😴'], ['enfadado', 'arg', '😠'], ['grande', 'stor', '🐘'],
    ['pequeño', 'liten', '🐭'], ['rápido', 'snabb', '🐆'], ['lento', 'långsam', '🐢'],
  ]),
  mkDeck('es_fraser', 'es', 'Små meningar', '💬', 3, [
    ['Me gusta el helado.', 'Jag gillar glass.', '🍦'], ['Tengo un perro.', 'Jag har en hund.', '🐶'], ['¿Dónde está el baño?', 'Var är toaletten?', '🚻'], ['Tengo ocho años.', 'Jag är åtta år.', '🎂'],
    ['Quiero agua.', 'Jag vill ha vatten.', '💧'], ['Vamos a jugar.', 'Vi leker.', '🎲'], ['Está lloviendo.', 'Det regnar.', '🌧️'], ['Hace sol.', 'Det är sol.', '☀️'],
  ], { noSpell: true }),
  // ---------- Engelska åk 4 ----------
  mkDeck('en_djur', 'en', 'Animals', '🐾', 1, [
    ['dog', 'hund', '🐶'], ['cat', 'katt', '🐱'], ['horse', 'häst', '🐴'], ['cow', 'ko', '🐮'], ['bird', 'fågel', '🐦'], ['fish', 'fisk', '🐟'],
    ['rabbit', 'kanin', '🐰'], ['mouse', 'mus', '🐭'], ['sheep', 'får', '🐑'], ['pig', 'gris', '🐷'], ['bear', 'björn', '🐻'], ['owl', 'uggla', '🦉'],
  ]),
  mkDeck('en_mat', 'en', 'Food', '🍔', 1, [
    ['apple', 'äpple', '🍎'], ['bread', 'bröd', '🍞'], ['cheese', 'ost', '🧀'], ['milk', 'mjölk', '🥛'], ['water', 'vatten', '💧'], ['egg', 'ägg', '🥚'],
    ['chicken', 'kyckling', '🍗'], ['potato', 'potatis', '🥔'], ['strawberry', 'jordgubbe', '🍓'], ['ice cream', 'glass', '🍦'], ['carrot', 'morot', '🥕'], ['soup', 'soppa', '🍲'],
  ]),
  mkDeck('en_hem', 'en', 'At home', '🏠', 1, [
    ['house', 'hus', '🏠'], ['kitchen', 'kök', '🍳'], ['bedroom', 'sovrum', '🛏️'], ['bathroom', 'badrum', '🛁'], ['window', 'fönster', '🪟'], ['door', 'dörr', '🚪'],
    ['table', 'bord', '🪑'], ['chair', 'stol', '💺'], ['garden', 'trädgård', '🌳'], ['key', 'nyckel', '🔑'],
  ]),
  mkDeck('en_skola', 'en', 'School', '🏫', 1, [
    ['school', 'skola', '🏫'], ['teacher', 'lärare', '👩‍🏫'], ['book', 'bok', '📖'], ['pencil', 'penna', '✏️'], ['ruler', 'linjal', '📏'], ['bag', 'väska', '🎒'],
    ['homework', 'läxa', '📝'], ['break', 'rast', '⚽'], ['friend', 'vän', '🧑‍🤝‍🧑'], ['classroom', 'klassrum', '🚪'],
  ]),
  mkDeck('en_vader', 'en', 'Weather and seasons', '🌦️', 2, [
    ['sunny', 'soligt', '☀️'], ['rainy', 'regnigt', '🌧️'], ['cloudy', 'molnigt', '☁️'], ['windy', 'blåsigt', '🌬️'], ['snow', 'snö', '❄️'], ['cold', 'kallt', '🥶'],
    ['warm', 'varmt', '🌡️'], ['spring', 'vår', '🌷'], ['summer', 'sommar', '🏖️'], ['autumn', 'höst', '🍂'], ['winter', 'vinter', '⛄'],
  ]),
  mkDeck('en_verb', 'en', 'Things we do', '🏃', 2, [
    ['run', 'springa', '🏃'], ['jump', 'hoppa', '🦘'], ['swim', 'simma', '🏊'], ['read', 'läsa', '📖'], ['write', 'skriva', '✍️'], ['eat', 'äta', '🍽️'],
    ['drink', 'dricka', '🥤'], ['sleep', 'sova', '😴'], ['play', 'leka', '🎲'], ['sing', 'sjunga', '🎤'], ['draw', 'rita', '🖍️'], ['listen', 'lyssna', '👂'],
  ]),
  mkDeck('en_tid', 'en', 'Days and time', '📅', 2, [
    ['Monday', 'måndag', '📅'], ['Tuesday', 'tisdag', '📅'], ['Wednesday', 'onsdag', '📅'], ['Thursday', 'torsdag', '📅'], ['Friday', 'fredag', '📅'],
    ['Saturday', 'lördag', '🎉'], ['Sunday', 'söndag', '☀️'], ['today', 'idag', '📍'], ['tomorrow', 'imorgon', '➡️'], ['yesterday', 'igår', '⬅️'], ['week', 'vecka', '🗓️'],
  ]),
  mkDeck('en_fraser', 'en', 'Useful sentences', '💬', 3, [
    ['What is your name?', 'Vad heter du?', '🏷️'], ['How old are you?', 'Hur gammal är du?', '🎂'], ['I like football.', 'Jag gillar fotboll.', '⚽'], ['Where do you live?', 'Var bor du?', '🏠'],
    ['Can I have some water, please?', 'Kan jag få lite vatten, tack?', '💧'], ['I have two brothers.', 'Jag har två bröder.', '👦👦'], ['It is raining.', 'Det regnar.', '🌧️'], ['See you tomorrow!', 'Vi ses imorgon!', '👋'],
  ], { noSpell: true }),
  // ---------- Engelska åk 8 ----------
  mkDeck('en8_verb', 'en', 'Irregular verbs', '🔁', 3, [
    ['go – went – gone', 'gå', '🚶'], ['see – saw – seen', 'se', '👀'], ['take – took – taken', 'ta', '🤲'], ['write – wrote – written', 'skriva', '✍️'], ['eat – ate – eaten', 'äta', '🍽️'],
    ['speak – spoke – spoken', 'tala', '🗣️'], ['buy – bought – bought', 'köpa', '🛒'], ['think – thought – thought', 'tänka', '💭'], ['bring – brought – brought', 'ta med', '🎁'], ['catch – caught – caught', 'fånga', '🥎'],
    ['drive – drove – driven', 'köra', '🚗'], ['fly – flew – flown', 'flyga', '✈️'], ['know – knew – known', 'veta', '🧠'], ['break – broke – broken', 'gå sönder', '💔'], ['choose – chose – chosen', 'välja', '☑️'],
    ['forget – forgot – forgotten', 'glömma', '🤷'], ['begin – began – begun', 'börja', '▶️'], ['swim – swam – swum', 'simma', '🏊'], ['wear – wore – worn', 'ha på sig', '👕'], ['teach – taught – taught', 'lära ut', '👩‍🏫'],
  ], { noSpell: true, noListenPick: true }),
  mkDeck('en8_ord', 'en', 'Vocabulary builder', '📚', 3, [
    ['although', 'fastän', '🤔'], ['however', 'emellertid', '↔️'], ['therefore', 'därför', '➡️'], ['environment', 'miljö', '🌍'], ['experience', 'erfarenhet', '🎓'],
    ['decision', 'beslut', '⚖️'], ['opportunity', 'möjlighet', '🚪'], ['responsibility', 'ansvar', '🧭'], ['improve', 'förbättra', '📈'], ['describe', 'beskriva', '🖊️'],
    ['compare', 'jämföra', '⚖️'], ['suggest', 'föreslå', '💡'], ['argue', 'argumentera', '🗣️'], ['neighbourhood', 'grannskap', '🏘️'], ['knowledge', 'kunskap', '🧠'],
    ['society', 'samhälle', '🏙️'], ['achieve', 'uppnå', '🏆'], ['prefer', 'föredra', '👍'], ['explain', 'förklara', '🧑‍🏫'], ['receive', 'ta emot', '📩'],
  ], { noListenPick: true }),
];

/* ---------- Spaced repetition (Leitner boxes 0–5) ---------- */
const BOX_DAYS = [0, 1, 3, 7, 14, 30];
const DAY = 86400000;
function wordState(p, wid) { return p.words[wid] || (p.words[wid] = { box: 0, due: 0, seen: 0, cor: 0, wrong: 0, last: 0 }); }
function recordWord(p, wid, correct) {
  const s = wordState(p, wid); s.seen++; s.last = Date.now();
  if (correct) { s.cor++; s.box = Math.min(5, s.box + 1); } else { s.wrong++; s.box = Math.max(0, s.box - 2); }
  s.due = Date.now() + BOX_DAYS[s.box] * DAY;
}
const deckProgress = (p, deck) => { const n = deck.words.length; if (!n) return { pct: 0, learned: 0, due: 0, nw: 0 }; let sum = 0, learned = 0, due = 0, nw = 0; for (const w of deck.words) { const s = p.words[w.id]; if (!s) { nw++; continue; } sum += s.box; if (s.box >= 3) learned++; if (s.due <= Date.now()) due++; } return { pct: Math.round(sum / (5 * n) * 100), learned, due, nw }; };

/* ---------- Helpers ---------- */
const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normWord = (s) => s.toLowerCase().replace(/[¿¡?!.,;:]/g, '').replace(/\s+/g, ' ').trim();
const normLoose = (s) => stripAccents(normWord(s));
const coreWord = (w) => w.replace(/^(el|la|los|las|un|una|the|a|an)\s+/i, ''); // for spelling tiles
function distractors(deck, word, n, field) {
  const pool = R.shuffle(deck.words.filter(w => w.id !== word.id && normLoose(w[field]) !== normLoose(word[field])));
  const out = []; const seen = new Set([normLoose(word[field])]);
  for (const w of pool) { const k = normLoose(w[field]); if (!seen.has(k)) { seen.add(k); out.push(w); if (out.length === n) break; } }
  return out;
}

/* ---------- Exercise generation ----------
   kinds: intro (new word card), pick (foreign→swedish or swedish→foreign, 4 choices), listen (hear foreign → pick written foreign),
          match (5 pairs), spell (letter tiles), type (write foreign) */
function buildLesson(p, deck, n = 10, opts = {}) {
  const now = Date.now();
  const due = deck.words.filter(w => p.words[w.id] && p.words[w.id].due <= now);
  const fresh = deck.words.filter(w => !p.words[w.id]);
  const notDue = deck.words.filter(w => p.words[w.id] && p.words[w.id].due > now);
  const newCount = Math.min(fresh.length, opts.newWords ?? (due.length >= 6 ? 2 : 4));
  const newWords = R.shuffle(fresh).slice(0, newCount);
  let practice = R.shuffle(due).slice(0, Math.max(0, n - newCount * 2));
  // top up with weakest not-due words so a lesson always has content
  if (practice.length + newWords.length * 2 < n) practice = practice.concat(R.shuffle(notDue).sort((a, b) => wordState(p, a.id).box - wordState(p, b.id).box).slice(0, n - practice.length - newWords.length * 2));
  const items = [];
  for (const w of newWords) { items.push({ kind: 'intro', word: w, deck }); }
  const pool = [...newWords, ...practice];
  const exKinds = [];
  for (const w of pool) {
    const box = wordState(p, w.id).box;
    let options;
    if (deck.lang === 'sv') { options = ['pickRev']; if (box >= 2) options.push('type'); } // fact cards: question → answer
    else {
      options = ['pick'];
      if (!deck.noListenPick && TTS.has(deck.lang)) options.push('listen');
      if (box >= 1 && !deck.noSpell) options.push('spell');
      if (box >= 1 && !deck.noListenPick && typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition) && !opts.noSpeak) options.push('speak');
      if (box >= 3 && !deck.noSpell) options.push('type');
      if (box >= 2) options.push('pickRev');
    }
    exKinds.push({ word: w, kind: R.pick(options) });
  }
  // one match block if enough words
  if (pool.length >= 5 && !opts.noMatch) { const pairs = R.shuffle(pool).slice(0, 5); items.push({ kind: 'match', pairs, deck }); }
  for (const { word, kind } of R.shuffle(exKinds)) items.push(makeWordExercise(deck, word, kind));
  // new words: introduce first, quiz later – keep intros at the start, rest shuffled
  const intros = items.filter(i => i.kind === 'intro'); const rest = items.filter(i => i.kind !== 'intro');
  return [...intros, ...rest];
}
function makeWordExercise(deck, word, kind) {
  if (kind === 'pick' || kind === 'pickRev') {
    const rev = kind === 'pickRev';
    const field = rev ? 'w' : 't'; // choices field
    const ds = distractors(deck, word, 3, field);
    const choices = R.shuffle([word, ...ds]).map(w => ({ id: w.id, label: w[field], e: rev ? '' : w.e }));
    return { kind: 'pick', deck, word, rev, prompt: rev ? word.t : word.w, promptEmoji: rev ? word.e : '', speak: !rev, choices, correctId: word.id, title: rev ? `Vad heter det på ${LANGS[deck.lang].name.toLowerCase()}?` : 'Vad betyder ordet?' };
  }
  if (kind === 'speak') return { kind: 'speak', deck, word, title: 'Säg ordet' };
  if (kind === 'listen') {
    const ds = distractors(deck, word, 3, 'w');
    return { kind: 'listen', deck, word, choices: R.shuffle([word, ...ds]).map(w => ({ id: w.id, label: w.w })), correctId: word.id, title: 'Lyssna och välj det du hör' };
  }
  if (kind === 'spell') {
    const target = coreWord(word.w);
    const letters = [...target.replace(/\s+/g, '')];
    const alphabet = deck.lang === 'es' ? 'abcdefghijlmnoprstuvz' : 'abcdefghiklmnoprstuwy';
    const extra = []; while (extra.length < Math.min(3, Math.max(2, Math.round(letters.length / 3)))) { const c = alphabet[R.int(0, alphabet.length - 1)]; extra.push(c); }
    return { kind: 'spell', deck, word, target, tiles: R.shuffle([...letters, ...extra]).map((c, i) => ({ c, i })), prompt: word.t, promptEmoji: word.e, title: 'Bygg ordet' };
  }
  // type
  return { kind: 'type', deck, word, prompt: word.t, promptEmoji: word.e, title: `Skriv på ${LANGS[deck.lang].name.toLowerCase()}` };
}
function checkWordAnswer(ex, raw) {
  const target = ex.kind === 'spell' ? ex.target : ex.word.w;
  const a = normWord(raw || ''), t = normWord(target);
  if (!a) return { status: 'empty' };
  if (a === t || normWord(coreWord(raw)) === normWord(coreWord(target))) return { status: 'correct' };
  if (normLoose(a) === normLoose(t) || normLoose(coreWord(a)) === normLoose(coreWord(t))) return { status: 'correct', note: `Nästan exakt – glöm inte accenten: <b>${target}</b>` };
  // typo tolerance for long words (1 edit)
  if (t.length >= 6 && levenshtein(normLoose(a), normLoose(t)) === 1) return { status: 'correct', note: `Ett litet stavfel – rätt är <b>${target}</b>` };
  return { status: 'wrong' };
}
function levenshtein(a, b) { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }

/* ---------- Text to speech ---------- */
const TTS = {
  ok: typeof window !== 'undefined' && 'speechSynthesis' in window,
  voices: [],
  init() { if (!TTS.ok) return; try { TTS.voices = speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { TTS.voices = speechSynthesis.getVoices(); }; } catch (e) { TTS.ok = false; } },
  has(lang) { return TTS.ok; },
  speak(text, lang, rate = 0.9) {
    if (!TTS.ok || !text) return false;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, '')); const code = LANGS[lang]?.tts || lang || 'sv-SE';
      u.lang = code; u.rate = rate;
      const v = TTS.voices.find(v => v.lang === code) || TTS.voices.find(v => v.lang.startsWith(code.slice(0, 2)));
      if (v) u.voice = v;
      speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  },
};

if (typeof module !== 'undefined') module.exports = { BUILTIN_DECKS, LANGS, buildLesson, makeWordExercise, checkWordAnswer, wordState, recordWord, deckProgress, normWord, TTS };
