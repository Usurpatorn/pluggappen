/* ========= Svenska åk 2–3 (mallen åk 2) – generatorer med oändlig variation + textbanker ========= */
// Alla uppgifter följer samma form som matten: { type, text, answer, choices, steps, hint, level, fig }

const SV = {};
const svSpeak = (word) => (typeof TTS !== 'undefined' && TTS.ok ? `<div class="listen-box"><button class="speak-btn big" data-speak="${word}" data-lang="sv" aria-label="Lyssna">🔊</button><button class="pill" data-speak="${word}" data-lang="sv" data-rate="0.6">🐢 Långsamt</button></div>` : '');
const svRead = (html) => `<div class="readbox">${html}</div>`;
const uniq = (arr) => [...new Set(arr)];

/* ---------- Stavning: dubbelteckning, ng-, sj-, tj- och j-ljud ---------- */
// [rätt, fel-varianter…, nivå]
SV.STAV = [
  ['katt', ['kat', 'kattt'], 1], ['hatt', ['hat'], 1], ['boll', ['bol'], 1], ['sommar', ['somar'], 1], ['vatten', ['vaten'], 1], ['hoppa', ['hopa'], 1], ['glass', ['glas'], 1],
  ['buss', ['bus'], 1], ['mamma', ['mama'], 1], ['pappa', ['papa'], 1], ['kall', ['kal'], 1], ['full', ['ful'], 1], ['natt', ['nat'], 1], ['sitta', ['sita'], 1], ['äpple', ['äple', 'eple'], 1],
  ['ring', ['rinng', 'rin'], 1], ['säng', ['sängg', 'sänng'], 1], ['många', ['mångga', 'monga'], 1], ['finger', ['fingger'], 2], ['pengar', ['penggar'], 2], ['sjunga', ['sunga', 'sjungga'], 2],
  ['skjorta', ['sjorta', 'schorta'], 2], ['stjärna', ['sjärna', 'skjärna'], 2], ['skön', ['sjön', 'schön'], 2], ['sju', ['sjuu', 'shu'], 2], ['sked', ['skjed', 'sjed'], 2], ['skinka', ['sjinka'], 2],
  ['kjol', ['tjol', 'kjoll'], 2], ['tjock', ['kjock', 'tjok'], 2], ['kyckling', ['kykling', 'tjyckling'], 2], ['köpa', ['tjöpa', 'köppa'], 2], ['kedja', ['tjedja', 'kedia'], 2],
  ['hjärta', ['järta', 'hjerta'], 2], ['hjälpa', ['jälpa', 'hjelpa'], 2], ['gjorde', ['jorde', 'gorde'], 2], ['ljus', ['jus', 'lius'], 2], ['djur', ['jur', 'djuur'], 2], ['hjul', ['jul', 'hjull'], 2],
  ['ledsen', ['lessen', 'ledsn'], 3], ['bäst', ['best', 'bäss'], 3], ['värld', ['väld', 'värd'], 3], ['sällan', ['sälan', 'sellan'], 3], ['tycker', ['tyker', 'tycer'], 3], ['också', ['oxå', 'också'], 3],
  ['mycket', ['myket', 'mycet'], 3], ['nästan', ['nestan', 'nässtan'], 3], ['dricka', ['drika', 'dricker'], 3], ['bröd', ['brö', 'bröd '], 3], ['tänka', ['tenka', 'tängka'], 3], ['hälsa', ['helsa', 'hällsa'], 3],
  ['chans', ['sjans', 'schans'], 3], ['chokl ad'.replace(' ', ''), ['sjoklad', 'schoklad'], 3], ['sjuksköterska', ['sjukskötterska', 'sjukskjöterska'], 3], ['skillnad', ['skilnad', 'skjillnad'], 3],
  ['gärna', ['järna', 'gerna'], 3], ['genast', ['jenast', 'gennast'], 3], ['ängel', ['engel', 'änggel'], 3], ['bygga', ['byga', 'byggga'], 3],
];
SV.genStavning = (level) => {
  const pool = SV.STAV.filter(w => w[2] <= level);
  const [word, wrongs] = R.pick(pool);
  const mode = R.pick(level === 1 ? ['pick', 'pick', 'dictate'] : ['pick', 'dictate', 'dictate', 'gap']);
  const why = (w) => /([a-zåäö])\1/.test(w) ? `Kort vokal → dubbelteckna konsonanten: <b>${w}</b>.` : /ng/.test(w) ? `Ng-ljudet stavas med <b>ng</b>: <b>${w}</b>.` : /^(sj|skj|stj|sk[eiyäö]|sch|ch)/.test(w) ? `Sj-ljudet kan stavas sj, skj, stj eller sk framför e, i, y, ä, ö: <b>${w}</b>.` : /^(tj|k[eiyäö])/.test(w) ? `Tj-ljudet stavas tj eller k framför e, i, y, ä, ö: <b>${w}</b>.` : /^(hj|gj|lj|dj|g[eiyäö])/.test(w) ? `J-ljudet kan stavas hj, gj, lj, dj eller g: <b>${w}</b>.` : `Rätt stavning: <b>${w}</b>.`;
  if (mode === 'pick') {
    const choices = R.shuffle(uniq([word, ...wrongs]).slice(0, 3));
    return { type: 'choicetext', text: 'Vilket ord är rätt stavat?', choices, answer: choices.indexOf(word), steps: [why(word)], hint: 'Säg ordet långsamt. Är vokalen kort eller lång?', level, fig: svSpeak(word) };
  }
  if (mode === 'gap') {
    // ta bort den kritiska delen
    const m = word.match(/([a-zåäö])\1|ng|^(sj|skj|stj|sch|ch|tj|hj|gj|lj|dj|sk|k|g)/);
    const part = m ? m[0] : word.slice(0, 2); const idx = word.indexOf(part);
    const gapped = word.slice(0, idx) + '_'.repeat(part.length) + word.slice(idx + part.length);
    return { type: 'text', text: `Vilka bokstäver saknas? <b>${gapped}</b>`, answer: [part, word], display: word, steps: [why(word)], hint: `Hela ordet är ${word.length} bokstäver. Lyssna igen.`, level, fig: svSpeak(word) };
  }
  return { type: 'text', text: 'Lyssna och skriv ordet.', answer: [word], steps: [why(word)], hint: `Ordet börjar på <b>${word[0]}</b> och har ${word.length} bokstäver.`, level, fig: svSpeak(word) };
};

/* ---------- Ordklasser ---------- */
SV.SUBST = ['hund', 'bil', 'skola', 'bok', 'sol', 'stol', 'flicka', 'pojke', 'äpple', 'hus', 'katt', 'cykel', 'blomma', 'tröja', 'fisk', 'tåg', 'lärare', 'mamma', 'skog', 'boll'];
SV.VERB = ['springer', 'hoppar', 'läser', 'sover', 'äter', 'skrattar', 'simmar', 'sjunger', 'ritar', 'cyklar', 'leker', 'bakar', 'gråter', 'klättrar', 'dansar', 'skriver', 'tittar', 'dricker', 'bygger', 'städar'];
SV.ADJ = ['röd', 'stor', 'glad', 'liten', 'snabb', 'varm', 'mjuk', 'hög', 'kall', 'söt', 'gammal', 'tung', 'ljus', 'arg', 'trött', 'blöt', 'lång', 'tyst', 'vacker', 'hungrig'];
SV.MENINGAR = [
  ['Den lilla hunden springer i parken.', { subst: ['hunden', 'parken'], verb: ['springer'], adj: ['lilla'] }],
  ['Mamma bakar goda bullar.', { subst: ['Mamma', 'bullar'], verb: ['bakar'], adj: ['goda'] }],
  ['Katten sover på den varma stolen.', { subst: ['Katten', 'stolen'], verb: ['sover'], adj: ['varma'] }],
  ['Pojken läser en spännande bok.', { subst: ['Pojken', 'bok'], verb: ['läser'], adj: ['spännande'] }],
  ['Fåglarna sjunger i den gröna skogen.', { subst: ['Fåglarna', 'skogen'], verb: ['sjunger'], adj: ['gröna'] }],
  ['Mira ritar en stor sol.', { subst: ['Mira', 'sol'], verb: ['ritar'], adj: ['stor'] }],
  ['Den snabba bilen kör på vägen.', { subst: ['bilen', 'vägen'], verb: ['kör'], adj: ['snabba'] }],
  ['Barnen leker med en röd boll.', { subst: ['Barnen', 'boll'], verb: ['leker'], adj: ['röd'] }],
  ['Läraren skriver på tavlan.', { subst: ['Läraren', 'tavlan'], verb: ['skriver'], adj: [] }],
  ['Den trötta björnen sover hela vintern.', { subst: ['björnen', 'vintern'], verb: ['sover'], adj: ['trötta'] }],
];
const KLASS = { subst: 'substantiv', verb: 'verb', adj: 'adjektiv' };
const KLASS_WHY = { subst: 'Substantiv är namn på saker, djur, människor och platser – man kan sätta <b>en</b> eller <b>ett</b> framför.', verb: 'Verb är något man <b>gör</b> eller något som händer – man kan sätta <b>att</b> framför.', adj: 'Adjektiv beskriver <b>hur</b> något är – man kan sätta <b>är</b> framför: "är röd".' };
SV.genOrdklass = (level) => {
  const kinds = ['subst', 'verb', 'adj'];
  if (level === 1 || (level === 2 && R.chance(0.5))) {
    const k = R.pick(kinds); const bank = { subst: SV.SUBST, verb: SV.VERB, adj: SV.ADJ };
    const correct = R.pick(bank[k]); const others = kinds.filter(x => x !== k).map(x => R.pick(bank[x]));
    const choices = R.shuffle([correct, ...others]);
    return { type: 'choicetext', text: `Vilket ord är ett <b>${KLASS[k]}</b>?`, choices, answer: choices.indexOf(correct), steps: [KLASS_WHY[k]], hint: k === 'verb' ? 'Vilket ord kan man göra?' : k === 'adj' ? 'Vilket ord beskriver hur något är?' : 'Vilket ord kan man sätta en/ett framför?', level };
  }
  if (level === 2) {
    const k = R.pick(kinds); const bank = { subst: SV.SUBST, verb: SV.VERB, adj: SV.ADJ }; const w = R.pick(bank[k]);
    const choices = R.shuffle(['substantiv', 'verb', 'adjektiv']);
    return { type: 'choicetext', text: `Vilken ordklass tillhör ordet <b>${w}</b>?`, choices, answer: choices.indexOf(KLASS[k]), steps: [KLASS_WHY[k]], hint: 'Testa: "en/ett …", "att …" eller "är …". Vilket passar?', level };
  }
  const [sent, parts] = R.pick(SV.MENINGAR); const k = R.pick(kinds.filter(x => parts[x].length));
  const words = sent.replace(/[.!?]/g, '').split(' ');
  const correct = parts[k][0]; const wrong = R.shuffle(words.filter(w => !parts[k].includes(w) && !['Den', 'en', 'på', 'i', 'med', 'hela'].includes(w))).slice(0, 3);
  const choices = R.shuffle([correct, ...wrong]);
  return { type: 'choicetext', text: `Hitta ett <b>${KLASS[k]}</b> i meningen:<br><i>${sent}</i>`, choices, answer: choices.indexOf(correct), steps: [KLASS_WHY[k]], hint: k === 'verb' ? 'Vad gör någon i meningen?' : k === 'adj' ? 'Vilket ord beskriver hur något är?' : 'Vem eller vad handlar meningen om?', level };
};

/* ---------- Motsatsord ---------- */
SV.MOTSATS = [
  ['stor', 'liten', 1], ['varm', 'kall', 1], ['glad', 'ledsen', 1], ['snabb', 'långsam', 1], ['ljus', 'mörk', 1], ['dag', 'natt', 1], ['upp', 'ner', 1], ['hög', 'låg', 1], ['gammal', 'ung', 1], ['tung', 'lätt', 1],
  ['öppen', 'stängd', 2], ['torr', 'blöt', 2], ['full', 'tom', 2], ['rik', 'fattig', 2], ['stark', 'svag', 2], ['hård', 'mjuk', 2], ['bred', 'smal', 2], ['tjock', 'tunn', 2], ['början', 'slut', 2], ['vinter', 'sommar', 2],
  ['modig', 'feg', 3], ['vild', 'tam', 3], ['sann', 'falsk', 3], ['vän', 'fiende', 3], ['lugn', 'orolig', 3], ['dyr', 'billig', 3], ['ren', 'smutsig', 3], ['skarp', 'slö', 3], ['frisk', 'sjuk', 3], ['tyst', 'högljudd', 3],
];
SV.genMotsats = (level) => {
  const pool = SV.MOTSATS.filter(p => p[2] <= level); const [a, b] = R.shuffle(R.pick(pool).slice(0, 2));
  if (level < 3 || R.chance(0.4)) {
    const wrong = R.shuffle(pool.filter(p => p[0] !== a && p[1] !== a).map(p => R.pick([p[0], p[1]]))).slice(0, 3);
    const choices = R.shuffle([b, ...wrong]);
    return { type: 'choicetext', text: `Vad är motsatsen till <b>${a}</b>?`, choices, answer: choices.indexOf(b), steps: [`<b>${a}</b> och <b>${b}</b> är motsatsord – de betyder tvärtom.`], hint: 'Tänk: om något inte är ' + a + ', vad är det då?', level };
  }
  return { type: 'text', text: `Skriv motsatsen till <b>${a}</b>.`, answer: [b], steps: [`<b>${a}</b> – <b>${b}</b>.`], hint: `Ordet börjar på <b>${b[0]}</b>.`, level };
};

/* ---------- Synonymer ---------- */
SV.SYN = [
  [['glad', 'lycklig', 'nöjd'], 1], [['stor', 'enorm', 'jättestor'], 1], [['liten', 'pytteliten', 'mini'], 1], [['snabb', 'kvick', 'rask'], 1], [['fin', 'vacker', 'snygg'], 1], [['börja', 'starta', 'sätta igång'], 1],
  [['prata', 'tala', 'snacka'], 2], [['titta', 'kika', 'se'], 2], [['springa', 'rusa', 'jogga'], 2], [['arg', 'ilsken', 'sur'], 2], [['rädd', 'skraj', 'skrämd'], 2], [['kall', 'kylig', 'iskall'], 2], [['smart', 'klok', 'klyftig'], 2],
  [['trött', 'sömnig', 'utmattad'], 3], [['svår', 'knepig', 'krånglig'], 3], [['gammal', 'åldrig', 'antik'], 3], [['konstig', 'märklig', 'underlig'], 3], [['skratta', 'fnissa', 'gapskratta'], 3], [['äta', 'mumsa', 'käka'], 3],
];
SV.genSynonym = (level) => {
  const pool = SV.SYN.filter(p => p[1] <= level); const group = R.pick(pool)[0]; const [a, b] = R.shuffle(group).slice(0, 2);
  const wrong = R.shuffle(pool.filter(p => p[0] !== group).map(p => R.pick(p[0]))).slice(0, 3);
  const choices = R.shuffle([b, ...wrong]);
  return { type: 'choicetext', text: `Vilket ord betyder nästan samma sak som <b>${a}</b>?`, choices, answer: choices.indexOf(b), steps: [`<b>${a}</b> och <b>${b}</b> är synonymer – ord som betyder ungefär samma sak.`], hint: 'Byt ut ordet i en mening – vilket passar lika bra?', level };
};

/* ---------- Sammansatta ord ---------- */
SV.SAMMANSATT = [
  ['fot', 'boll', 1], ['sol', 'sken', 1], ['snö', 'gubbe', 1], ['tand', 'borste', 1], ['hus', 'djur', 1], ['is', 'glass', 1], ['bok', 'hylla', 1], ['regn', 'båge', 1], ['jul', 'gran', 1], ['bil', 'väg', 1],
  ['skol', 'gård', 2], ['sim', 'hall', 2], ['sov', 'rum', 2], ['frukost', 'bord', 2], ['hund', 'koppel', 2], ['vatten', 'kanna', 2], ['fjäril', 'håv', 2], ['lek', 'park', 2], ['natt', 'lampa', 2], ['sommar', 'lov', 2],
  ['ishockey', 'klubba', 3], ['brand', 'bil', 3], ['sjuk', 'hus', 3], ['födelse', 'dag', 3], ['kyl', 'skåp', 3], ['tvätt', 'maskin', 3], ['jord', 'gubbe', 3], ['hand', 'duk', 3], ['tid', 'ning', 3], ['bad', 'strand', 3],
];
SV.genSammansatt = (level) => {
  const pool = SV.SAMMANSATT.filter(p => p[2] <= level); const [a, b] = R.pick(pool); const word = a + b;
  const mode = R.pick(level === 1 ? ['join', 'join', 'split'] : ['join', 'split', 'split']);
  if (mode === 'join') return { type: 'text', text: `Sätt ihop orden till ett ord: <b>${a}</b> + <b>${b}</b> = ?`, answer: [word], steps: [`<b>${a}</b> + <b>${b}</b> = <b>${word}</b>. Ett sammansatt ord är två ord som blir ett.`], hint: 'Skriv orden direkt efter varandra utan mellanslag.', level };
  const wrongs = R.shuffle(pool.filter(p => p[0] !== a).map(p => `${p[0]} + ${R.chance(0.5) ? b : p[1]}`)).slice(0, 3);
  const correct = `${a} + ${b}`; const choices = R.shuffle([correct, ...wrongs]);
  return { type: 'choicetext', text: `Vilka två ord bildar <b>${word}</b>?`, choices, answer: choices.indexOf(correct), steps: [`<b>${word}</b> = <b>${a}</b> + <b>${b}</b>.`], hint: 'Var kan du dela ordet så att båda delarna är riktiga ord?', level };
};

/* ---------- Bokstavsordning ---------- */
SV.genAbc = (level) => {
  const bank = uniq([...SV.SUBST, ...SV.ADJ, 'apa', 'banan', 'citron', 'delfin', 'elefant', 'fisk', 'giraff', 'hare', 'igelkott', 'jordgubbe', 'kanin', 'lejon', 'mus', 'noshörning', 'orm', 'panda', 'räv', 'sköldpadda', 'tiger', 'uggla', 'val', 'zebra', 'älg', 'örn']);
  let words;
  if (level === 1) { words = []; const used = new Set(); for (const w of R.shuffle(bank)) { if (!used.has(w[0])) { used.add(w[0]); words.push(w); } if (words.length === 4) break; } }
  else if (level === 2) { const byFirst = {}; bank.forEach(w => (byFirst[w[0]] = byFirst[w[0]] || []).push(w)); const groups = Object.values(byFirst).filter(g => g.length >= 2); const g = R.pick(groups); words = uniq([...R.shuffle(g).slice(0, 2), ...R.shuffle(bank.filter(w => w[0] !== g[0][0])).slice(0, 3)]); }
  else { const byFirst = {}; bank.forEach(w => (byFirst[w[0]] = byFirst[w[0]] || []).push(w)); const groups = Object.values(byFirst).filter(g => g.length >= 3); const g = R.pick(groups); words = uniq([...R.shuffle(g).slice(0, 3), ...R.shuffle(bank.filter(w => w[0] !== g[0][0])).slice(0, 3)]); }
  const sorted = words.slice().sort((x, y) => x.localeCompare(y, 'sv'));
  return { type: 'order', text: 'Sätt orden i bokstavsordning (som i en ordbok):', items: sorted, answer: sorted, steps: [`<b>Rätt ordning:</b> ${sorted.join(', ')}.`, level > 1 ? 'Börjar två ord på samma bokstav? Titta på <b>andra</b> bokstaven.' : 'Alfabetet: a b c d e f g h i j k l m n o p q r s t u v w x y z å ä ö.'], hint: 'Sjung alfabetet tyst för dig själv.', level };
};

/* ---------- Meningar: ordföljd, stor bokstav och skiljetecken ---------- */
SV.MENING_ORD = [
  ['Jag', 'gillar', 'glass', '.'], ['Hunden', 'skäller', 'på', 'katten', '.'], ['Vad', 'heter', 'du', '?'], ['Vi', 'åker', 'till', 'skolan', '.'], ['Vill', 'du', 'leka', 'med', 'mig', '?'],
  ['Solen', 'skiner', 'idag', '.'], ['Mormor', 'bakar', 'bullar', 'på', 'lördag', '.'], ['Var', 'bor', 'din', 'kompis', '?'], ['Elsa', 'läser', 'en', 'rolig', 'bok', '.'], ['Vilken', 'fin', 'teckning', '!'],
  ['Imorgon', 'ska', 'vi', 'bada', '.'], ['Hur', 'gammal', 'är', 'du', '?'], ['Den', 'röda', 'bilen', 'är', 'snabb', '.'], ['Titta', 'på', 'den', 'stora', 'elefanten', '!'], ['Pappa', 'lagar', 'mat', 'i', 'köket', '.'],
];
SV.SKILJE = [
  ['Vad heter du?', ['Vad heter du.', 'Vad heter du!', 'vad heter du?']], ['Jag har en hund.', ['jag har en hund.', 'Jag har en hund?', 'Jag har en hund']], ['Hjälp, det brinner!', ['Hjälp, det brinner.', 'hjälp det brinner!', 'Hjälp, det brinner?']],
  ['Vill du ha en kaka?', ['Vill du ha en kaka.', 'vill du ha en kaka?', 'Vill du ha en kaka!']], ['Omar bor i Umeå.', ['omar bor i umeå.', 'Omar bor i umeå.', 'Omar bor i Umeå?']], ['Vilken fin hund!', ['Vilken fin hund.', 'vilken fin hund!', 'Vilken fin hund?']],
  ['Hur många år är du?', ['Hur många år är du.', 'hur många år är du?', 'Hur många år är du!']], ['Vi reser till Spanien i sommar.', ['Vi reser till spanien i sommar.', 'vi reser till Spanien i sommar.', 'Vi reser till Spanien i sommar?']],
  ['Akta dig!', ['Akta dig.', 'akta dig!', 'Akta dig?']], ['Idag är det måndag.', ['Idag är det Måndag.', 'idag är det måndag.', 'Idag är det måndag?']],
];
SV.genMening = (level) => {
  if (level === 1 || R.chance(0.5)) {
    const [correct, wrongs] = R.pick(SV.SKILJE); const choices = R.shuffle([correct, ...wrongs.slice(0, level === 1 ? 2 : 3)]);
    return { type: 'choicetext', text: 'Vilken mening är rätt skriven?', choices, answer: choices.indexOf(correct), steps: ['En mening börjar med <b>stor bokstav</b>. Namn på personer och platser har också stor bokstav.', 'Frågor slutar med <b>?</b>, utrop med <b>!</b> och vanliga meningar med <b>.</b>'], hint: 'Kolla första bokstaven och tecknet på slutet.', level };
  }
  const w = R.pick(SV.MENING_ORD.filter(s => level >= 3 || s.length <= 5)); const punct = w[w.length - 1]; const words = w.slice(0, -1);
  const items = words.map((x, i) => (i === words.length - 1 ? x + punct : x));
  return { type: 'order', text: 'Sätt orden i rätt ordning så att det blir en mening:', items, answer: items, steps: [`<b>${items.join(' ')}</b>`, 'Ordet med stor bokstav står först, och ordet med skiljetecken står sist.'], hint: 'Vilket ord har stor bokstav? Det ska stå först.', level };
};

/* ---------- Böjning: plural och tempus ---------- */
SV.PLURAL = [['bil', 'bilar'], ['hund', 'hundar'], ['flicka', 'flickor'], ['skola', 'skolor'], ['katt', 'katter'], ['bok', 'böcker'], ['hus', 'hus'], ['äpple', 'äpplen'], ['stol', 'stolar'], ['blomma', 'blommor'], ['mus', 'möss'], ['fot', 'fötter'], ['hand', 'händer'], ['barn', 'barn'], ['träd', 'träd'], ['tand', 'tänder'], ['man', 'män'], ['öga', 'ögon'], ['öra', 'öron'], ['gås', 'gäss']];
SV.TEMPUS = [['springer', 'sprang', 'har sprungit'], ['äter', 'åt', 'har ätit'], ['sover', 'sov', 'har sovit'], ['läser', 'läste', 'har läst'], ['hoppar', 'hoppade', 'har hoppat'], ['skriver', 'skrev', 'har skrivit'], ['dricker', 'drack', 'har druckit'], ['går', 'gick', 'har gått'], ['ser', 'såg', 'har sett'], ['sitter', 'satt', 'har suttit'], ['simmar', 'simmade', 'har simmat'], ['leker', 'lekte', 'har lekt'], ['kommer', 'kom', 'har kommit'], ['får', 'fick', 'har fått'], ['ger', 'gav', 'har gett'], ['säger', 'sa', 'har sagt']];
SV.genBojning = (level) => {
  if (level === 1 || (level === 2 && R.chance(0.5))) {
    const [one, many] = R.pick(SV.PLURAL);
    if (level === 1) { const wrongs = R.shuffle(SV.PLURAL.filter(p => p[0] !== one).map(p => p[1])).slice(0, 3); const choices = R.shuffle([many, ...wrongs]); return { type: 'choicetext', text: `En <b>${one}</b> – flera …?`, choices, answer: choices.indexOf(many), steps: [`En ${one}, flera <b>${many}</b>.`], hint: 'Säg "flera …" högt. Vad låter rätt?', level }; }
    return { type: 'text', text: `En <b>${one}</b> – flera …? Skriv ordet.`, answer: [many], steps: [`En ${one}, flera <b>${many}</b>.`], hint: many === one ? 'Vissa ord ser likadana ut i flertal!' : `Ordet börjar på <b>${many.slice(0, 2)}</b>.`, level };
  }
  const [nu, da, har] = R.pick(SV.TEMPUS);
  if (level === 2 || R.chance(0.6)) return { type: 'text', text: `Idag <b>${nu}</b> jag. Igår … jag. Skriv ordet som saknas.`, answer: [da], steps: [`Idag ${nu}, igår <b>${da}</b>. Det kallas dåtid (preteritum).`], hint: `Ordet börjar på <b>${da.slice(0, 2)}</b>.`, level };
  return { type: 'text', text: `Idag <b>${nu}</b> jag. Jag <b>har</b> … Skriv ordet som saknas.`, answer: [har.replace('har ', ''), har], display: har, steps: [`Idag ${nu}, jag <b>${har}</b>.`], hint: `Ordet börjar på <b>${har.replace('har ', '').slice(0, 2)}</b>.`, level };
};

/* ---------- Läsförståelse ---------- */
SV.TEXTER = [
  { lvl: 1, title: 'Kaninen Pelle', text: 'Pelle är en vit kanin med långa öron. Han bor i en bur i trädgården. Varje morgon får han en morot och lite hö. På kvällen hoppar han runt på gräsmattan. Pelle gillar inte regn. Då gömmer han sig i sitt lilla hus.', qs: [['Vilken färg har Pelle?', ['Vit', 'Brun', 'Svart', 'Grå']], ['Vad får Pelle varje morgon?', ['En morot och hö', 'En kaka', 'Fisk', 'Bröd']], ['Vad gör Pelle när det regnar?', ['Gömmer sig i sitt hus', 'Hoppar på gräsmattan', 'Sover i buren', 'Äter morötter']]] },
  { lvl: 1, title: 'Till simhallen', text: 'På lördag åker Sara och hennes pappa till simhallen. Sara har en blå baddräkt och en gul badmössa. I simhallen finns en stor bassäng och en rutschkana. Sara åker rutschkanan fem gånger. Sedan köper pappa varm choklad i kafét.', qs: [['När åker Sara till simhallen?', ['På lördag', 'På måndag', 'På söndag', 'På fredag']], ['Vilken färg har badmössan?', ['Gul', 'Blå', 'Röd', 'Grön']], ['Hur många gånger åker Sara rutschkanan?', ['Fem', 'Tre', 'Två', 'Tio']], ['Vad köper pappa i kafét?', ['Varm choklad', 'Glass', 'Bullar', 'Saft']]] },
  { lvl: 1, title: 'Snö!', text: 'När Alex vaknade var allt vitt. Det hade snöat hela natten. Alex tog på sig overallen, vantarna och mössan. Ute byggde han en snögubbe med sin storasyster. Snögubben fick en morot till näsa och två kottar till ögon.', qs: [['Vad hade hänt under natten?', ['Det hade snöat', 'Det hade regnat', 'Det hade blåst', 'Det hade åskat']], ['Vem byggde Alex snögubben med?', ['Sin storasyster', 'Sin pappa', 'Sin kompis', 'Sin hund']], ['Vad fick snögubben till näsa?', ['En morot', 'En kotte', 'En sten', 'En pinne']]] },
  { lvl: 2, title: 'Bibliotekets hemlighet', text: 'Nära skolan ligger ett gammalt bibliotek. Längst in, bakom hyllan med sagoböcker, finns en liten dörr som nästan ingen känner till. Maja upptäckte den en regnig tisdag. Bakom dörren fanns ett rum fullt av gamla kartor. På en av kartorna var ett kryss ritat med röd penna. "Det måste vara en skatt", viskade Maja. Hon bestämde sig för att komma tillbaka nästa dag med sin kompis Noah.', qs: [['Var finns den lilla dörren?', ['Bakom hyllan med sagoböcker', 'Vid ingången', 'I källaren', 'Bakom lärarens bord']], ['Vilken dag hittade Maja dörren?', ['En tisdag', 'En lördag', 'En måndag', 'En fredag']], ['Vad fanns i rummet?', ['Gamla kartor', 'Guldmynt', 'Leksaker', 'Gamla böcker']], ['Vad tänker Maja göra?', ['Komma tillbaka med Noah', 'Berätta för läraren', 'Ta med kartan hem', 'Glömma alltihop']]] },
  { lvl: 2, title: 'Igelkotten', text: 'Igelkotten är ett litet djur med taggar på ryggen. Taggarna skyddar den mot rävar och andra fiender. När igelkotten blir rädd rullar den ihop sig till en boll. Igelkottar äter insekter, sniglar och maskar. På hösten äter den extra mycket, för hela vintern sover den i en hög av löv. Det kallas att gå i ide.', qs: [['Vad gör igelkotten när den blir rädd?', ['Rullar ihop sig till en boll', 'Springer iväg', 'Klättrar upp i ett träd', 'Gräver ner sig']], ['Vad äter igelkottar?', ['Insekter, sniglar och maskar', 'Gräs och löv', 'Bär och frukt', 'Fisk']], ['Varför äter igelkotten mycket på hösten?', ['Den ska sova hela vintern', 'Den ska flytta söderut', 'Den ska få ungar', 'Den fryser']], ['Vad betyder "gå i ide"?', ['Sova hela vintern', 'Leta mat', 'Bygga bo', 'Byta taggar']]] },
  { lvl: 2, title: 'Fotbollsmatchen', text: 'Det var sista matchen för säsongen. Lisas lag låg under med 1–2 och det var bara två minuter kvar. Lisa fick bollen vid mittlinjen. Hon sprang förbi en försvarare, sedan en till. Målvakten kom ut mot henne. Lisa sköt lågt i hörnet – mål! 2–2. Publiken jublade. Matchen slutade oavgjort, men Lisa kände sig som en vinnare.', qs: [['Hur låg Lisas lag innan hennes mål?', ['Under med 1–2', 'Över med 2–1', '0–0', 'Under med 0–3']], ['Hur många försvarare sprang Lisa förbi?', ['Två', 'En', 'Tre', 'Ingen']], ['Hur slutade matchen?', ['Oavgjort 2–2', 'Lisas lag vann', 'Lisas lag förlorade', '3–2']], ['Varför kände sig Lisa som en vinnare?', ['Hon gjorde ett viktigt mål', 'Laget vann', 'Hon fick en medalj', 'Tränaren berömde henne']]] },
  { lvl: 3, title: 'Resan till månen', text: 'År 1969 landade människor på månen för första gången. Rymdfarkosten hette Apollo 11 och astronauterna var tre: Neil Armstrong, Buzz Aldrin och Michael Collins. Bara två av dem gick ner på månens yta – Collins stannade kvar i farkosten som kretsade runt månen. Resan tog ungefär tre dagar åt varje håll. På månen finns ingen luft, så astronauterna hade rymddräkter med syrgas. Fotspåren de lämnade finns kvar än idag, eftersom det inte blåser på månen.', qs: [['Vilket år landade människor på månen första gången?', ['1969', '1999', '1950', '2001']], ['Hur många astronauter gick ner på månens yta?', ['Två', 'Tre', 'En', 'Fyra']], ['Varför behövde astronauterna syrgas?', ['Det finns ingen luft på månen', 'Det var kallt', 'De skulle sova', 'Rymddräkterna var tunga']], ['Varför finns fotspåren kvar?', ['Det blåser inte på månen', 'De är gjorda av metall', 'Månen är gjord av sten', 'Astronauterna målade dem']]] },
  { lvl: 3, title: 'Den gamla klockan', text: 'På vinden hos farmor stod en gammal klocka som hade stannat för länge sedan. Elias torkade bort dammet och såg att visarna pekade på kvart över tre. "Den stannade samma dag som din farfar och jag gifte oss", sa farmor och log. Elias hittade en nyckel på klockans baksida. Han vred försiktigt tre varv. Plötsligt började klockan ticka igen. Farmor fick tårar i ögonen, men hon såg glad ut.', qs: [['Var stod klockan?', ['På vinden hos farmor', 'I köket', 'I farmors sovrum', 'I källaren']], ['Vilken tid visade klockan?', ['Kvart över tre', 'Halv tre', 'Kvart i tre', 'Klockan tre']], ['Hur fick Elias igång klockan?', ['Han vred nyckeln tre varv', 'Han bytte batteri', 'Han skakade den', 'Han ringde en klockmakare']], ['Varför fick farmor tårar i ögonen?', ['Hon blev rörd och glad', 'Hon var ledsen att klockan gick', 'Hon fick damm i ögonen', 'Hon var arg på Elias']]] },
  { lvl: 3, title: 'Allemansrätten', text: 'I Sverige har vi något som kallas allemansrätten. Den betyder att alla får vara i naturen, även på mark som någon annan äger. Du får plocka bär, svamp och blommor, tälta en natt och bada i sjöar. Men det finns regler: du får inte gå nära någons hus, inte bryta grenar från levande träd och inte lämna skräp efter dig. Man brukar säga: inte störa, inte förstöra.', qs: [['Vad betyder allemansrätten?', ['Alla får vara i naturen', 'Alla får bygga hus i skogen', 'Alla äger skogen', 'Bara barn får vara i skogen']], ['Vilket av detta får du göra?', ['Plocka bär och svamp', 'Bryta grenar från levande träd', 'Lämna skräp', 'Gå in i någons trädgård']], ['Hur länge får man tälta på samma plats?', ['En natt', 'En vecka', 'En månad', 'Hur länge som helst']], ['Vilken regel sammanfattar allemansrätten?', ['Inte störa, inte förstöra', 'Alltid fråga först', 'Bara på dagen', 'Ta med allt du hittar']]] },
];
SV.genLasa = (level) => {
  const pool = SV.TEXTER.filter(t => t.lvl <= level && t.lvl >= Math.max(1, level - 1)); const t = R.pick(pool); const [q, ch] = R.pick(t.qs);
  const correct = ch[0]; const choices = R.shuffle(ch.slice());
  return { type: 'choicetext', text: q, choices, answer: choices.indexOf(correct), steps: [`Svaret står i texten: <b>${correct}</b>.`], hint: 'Läs texten en gång till och leta efter orden i frågan.', level, fig: svRead(`<div class="row" style="justify-content:space-between;align-items:center"><div class="eyebrow">${t.title}</div>${typeof TTS !== 'undefined' && TTS.ok ? `<button class="pill" data-speak="${esc(t.text)}" data-lang="sv" data-rate="0.85">🔊 Lyssna</button>` : ''}</div><p>${t.text}</p>`) };
};

/* ---------- Rim ---------- */
SV.RIM = [['hus', 'mus', 'ljus', 'grus'], ['katt', 'hatt', 'natt', 'skatt'], ['bil', 'fil', 'pil', 'mil'], ['sol', 'stol', 'kjol', 'fiol'], ['boll', 'troll', 'koll', 'moll'], ['hund', 'rund', 'stund', 'lund'], ['bok', 'kok', 'krok', 'tok'], ['ko', 'sko', 'bro', 'ro'], ['tåg', 'våg', 'låg', 'såg'], ['glass', 'pass', 'lass', 'kass'], ['räv', 'väv', 'säv', 'näv'], ['snö', 'sjö', 'ö', 'hö'], ['apa', 'gapa', 'skapa', 'tapa'], ['fisk', 'disk', 'frisk', 'risk'], ['bord', 'ord', 'jord', 'nord']];
SV.genRim = (level) => {
  const g = R.pick(SV.RIM); const [a, b] = R.shuffle(g).slice(0, 2);
  const wrong = R.shuffle(SV.RIM.filter(x => x !== g).map(x => R.pick(x))).slice(0, 3);
  if (level >= 2 && R.chance(0.5)) return { type: 'text', text: `Skriv ett ord som rimmar på <b>${a}</b>.`, answer: g.filter(x => x !== a), display: g.filter(x => x !== a).join(' / '), steps: [`Ord som rimmar på ${a}: <b>${g.filter(x => x !== a).join(', ')}</b>.`], hint: 'Ord som rimmar slutar likadant.', level };
  const choices = R.shuffle([b, ...wrong]);
  return { type: 'choicetext', text: `Vilket ord rimmar på <b>${a}</b>?`, choices, answer: choices.indexOf(b), steps: [`<b>${a}</b> och <b>${b}</b> slutar likadant – de rimmar.`], hint: 'Säg orden högt. Vilka låter lika på slutet?', level };
};

const METHOD_SV = {
  stavning: `<p><b>Dubbelteckning:</b> när vokalen är kort skriver vi två konsonanter: ka<b>tt</b>, bo<b>ll</b>, so<b>mm</b>ar. Lång vokal → en konsonant: h<b>at</b>, b<b>ol</b>.</p><p><b>Ng-ljudet</b> stavas ng: ri<b>ng</b>, sä<b>ng</b>.</p><p><b>Sj-ljudet</b> kan stavas sj (sju), skj (skjorta), stj (stjärna) eller sk framför e, i, y, ä, ö (sked, skön).</p><p><b>Tj-ljudet</b> stavas tj (tjock) eller k framför e, i, y, ä, ö (kjol, köpa, kyckling).</p><p><b>J-ljudet</b> kan stavas j, hj (hjärta), gj (gjorde), lj (ljus), dj (djur).</p>`,
  ordklass: `<p>Ord kan sorteras i <b>ordklasser</b>:</p><ul><li><b>Substantiv</b> – namn på saker, djur, människor, platser. Test: sätt <b>en</b> eller <b>ett</b> framför: <i>en hund, ett hus</i>.</li><li><b>Verb</b> – något man gör eller något som händer. Test: sätt <b>att</b> framför: <i>att springa, att sova</i>.</li><li><b>Adjektiv</b> – beskriver hur något är. Test: sätt <b>är</b> framför: <i>är röd, är stor</i>.</li></ul>`,
  motsats: `<p><b>Motsatsord</b> betyder tvärtom: stor – liten, varm – kall, glad – ledsen.</p><p>Knep: "Om något inte är <i>stort</i>, vad är det då?"</p>`,
  synonym: `<p><b>Synonymer</b> är ord som betyder nästan samma sak: glad – lycklig – nöjd. Med synonymer blir texter mer spännande att läsa.</p><p>Test: byt ut ordet i en mening. Passar det nya ordet lika bra?</p>`,
  sammansatt: `<p>Ett <b>sammansatt ord</b> är två (eller fler) ord som sätts ihop till ett: fot + boll = <b>fotboll</b>.</p><p>Det sista ordet bestämmer vad det är: en <i>fotboll</i> är en boll, en <i>bollfot</i> skulle vara en fot!</p><p>Ibland läggs ett <b>s</b> in: födelse + dag = födelse<b>s</b>dag.</p>`,
  abc: `<p>I en ordbok eller ett register står orden i <b>bokstavsordning</b>: a b c d e f g h i j k l m n o p q r s t u v w x y z å ä ö.</p><p>Om två ord börjar på samma bokstav tittar du på <b>andra</b> bokstaven, sedan tredje, och så vidare: <i>bil</i> kommer före <i>bok</i> eftersom i kommer före o.</p>`,
  mening: `<p>En mening börjar med <b>stor bokstav</b> och slutar med ett <b>skiljetecken</b>:</p><ul><li><b>.</b> punkt – vanlig mening: <i>Jag har en hund.</i></li><li><b>?</b> frågetecken – fråga: <i>Vad heter du?</i></li><li><b>!</b> utropstecken – utrop: <i>Akta dig!</i></li></ul><p>Namn på personer, platser och länder har alltid stor bokstav: <i>Mira, Umeå, Sverige</i>. Veckodagar och månader har liten bokstav på svenska.</p>`,
  bojning: `<p><b>Flertal (plural):</b> en bil – flera bil<b>ar</b>, en flicka – flera flick<b>or</b>, en katt – flera katt<b>er</b>, ett äpple – flera äppl<b>en</b>. Vissa ord ändras helt: en mus – flera möss. Och några ser likadana ut: ett hus – flera hus.</p><p><b>Tidsform (tempus):</b> idag <i>springer</i> jag (nutid), igår <i>sprang</i> jag (dåtid), jag <i>har sprungit</i> (har-form).</p>`,
  lasa: `<p>Så läser du för att förstå:</p><ol><li>Läs rubriken – vad tror du texten handlar om?</li><li>Läs hela texten en gång.</li><li>Läs frågan. Leta efter samma ord i texten.</li><li>Läs meningen runt omkring – där finns oftast svaret.</li></ol><p>Tryck på högtalaren om du vill höra texten uppläst.</p>`,
  rim: `<p>Ord som <b>rimmar</b> slutar likadant: hus – mus – ljus. Rim gör det lättare att komma ihåg ramsor, sånger och dikter.</p>`,
};

const SV_SKILLS = {
  ak2: [
    { id: 'sv_stavning', name: 'Stavning', short: 'Stavning', icon: '✏️', group: 'sv', subject: 'Svenska', gen: SV.genStavning, method: METHOD_SV.stavning },
    { id: 'sv_lasa', name: 'Läsförståelse', short: 'Läsa', icon: '📖', group: 'sv', subject: 'Svenska', gen: SV.genLasa, method: METHOD_SV.lasa },
    { id: 'sv_ordklass', name: 'Ordklasser', short: 'Ordklasser', icon: '🏷️', group: 'sv', subject: 'Svenska', gen: SV.genOrdklass, method: METHOD_SV.ordklass },
    { id: 'sv_mening', name: 'Meningar och skiljetecken', short: 'Meningar', icon: '❗', group: 'sv', subject: 'Svenska', gen: SV.genMening, method: METHOD_SV.mening },
    { id: 'sv_motsats', name: 'Motsatsord', short: 'Motsatser', icon: '↔️', group: 'sv', subject: 'Svenska', gen: SV.genMotsats, method: METHOD_SV.motsats },
    { id: 'sv_synonym', name: 'Synonymer', short: 'Synonymer', icon: '🟰', group: 'sv', subject: 'Svenska', gen: SV.genSynonym, method: METHOD_SV.synonym },
    { id: 'sv_sammansatt', name: 'Sammansatta ord', short: 'Sammansatta', icon: '🧩', group: 'sv', subject: 'Svenska', gen: SV.genSammansatt, method: METHOD_SV.sammansatt },
    { id: 'sv_bojning', name: 'Flertal och tidsformer', short: 'Böjning', icon: '🔁', group: 'sv', subject: 'Svenska', gen: SV.genBojning, method: METHOD_SV.bojning },
    { id: 'sv_abc', name: 'Bokstavsordning', short: 'ABC', icon: '🔤', group: 'sv', subject: 'Svenska', gen: SV.genAbc, method: METHOD_SV.abc },
    { id: 'sv_rim', name: 'Rim', short: 'Rim', icon: '🎵', group: 'sv', subject: 'Svenska', gen: SV.genRim, method: METHOD_SV.rim },
  ],
};
if (typeof module !== 'undefined') module.exports = { SV, SV_SKILLS };
