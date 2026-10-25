/* ========= Grundkurser matte: mallarna åk 4 och åk 2 ========= */
const timeStr = (h, mm) => `${h}:${String(mm).padStart(2, '0')}`;
const timeAnswers = (h, mm) => { const a = [timeStr(h, mm), timeStr(h % 12 === 0 ? 12 : h % 12, mm), `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, timeStr(h, mm).replace(':', '.'), timeStr(h % 12 === 0 ? 12 : h % 12, mm).replace(':', '.')]; if (h >= 12 && h % 12 !== 0) a.push(timeStr(h - 12, mm)); return [...new Set(a)]; };

/* ---- Åk 4: bråk ---- */
function genBrak(level) {
  const n1 = R.pick(NAMES);
  if (level === 1) {
    const variant = R.int(1, 3);
    if (variant === 1) { const d = R.pick([4, 6, 8, 10]), n = R.int(1, d - 1); return { type: 'text', fig: VIS.pie(n, d), text: `Pizzan är delad i ${d} lika stora bitar. Hur stor del är <b>färgad</b>? Skriv som bråk, t.ex. 2/5.`, answer: [`${n}/${d}`], display: `${n}/${d}`, level, steps: [`Nämnaren (talet under strecket) = antal bitar totalt: ${d}.`, `Täljaren (talet över strecket) = antal bitar man tagit: ${n}.`, `Svar: ${m(`${n}/${d}`)}`], hint: 'Antal bitar totalt hamnar under strecket.' }; }
    if (variant === 2) { const [a, b] = R.pick([[2, 3], [2, 4], [3, 4], [2, 5], [3, 5], [4, 8], [2, 8]]); const first = R.chance(0.5); const ch = first ? [`1/${a}`, `1/${b}`] : [`1/${b}`, `1/${a}`]; return { type: 'choicetext', text: `Vilket bråk är <b>störst</b>?`, choices: ch, answer: ch.indexOf(`1/${a}`), level, steps: [`Ju fler delar man delar något i, desto mindre blir varje del.`, `1/${a} betyder att hela delas i ${a} delar, 1/${b} i ${b} delar.`, `Alltså är ${m(`1/${a}`)} större än ${m(`1/${b}`)}.`], hint: 'Tänk på en pizza: en bit av tre eller en bit av fem – vilken är störst?' }; }
    const d = R.pick([2, 4, 5, 10]), total = d * R.int(2, 6); return { type: 'num', fig: VIS.bar(1, d), text: `Hur mycket är ${m(`1/${d}`)} av ${total}?`, answer: total / d, level, steps: [`${m(`1/${d}`)} av något betyder dela i ${d} lika delar.`, `${m(`${total} / ${d} = ${total / d}`)}`], hint: `Dela ${total} med ${d}.`, choices: T.choices(total / d, 4, 3) };
  }
  if (level === 2) {
    const variant = R.int(1, 3);
    if (variant === 1) { const d = R.pick([3, 4, 5, 6, 8, 10]), n = R.int(2, d - 1), total = d * R.int(2, 8); return { type: 'num', text: `Hur mycket är ${m(`${n}/${d}`)} av ${total}?`, answer: n * total / d, level, steps: [`Räkna först ut 1/${d}: ${m(`${total} / ${d} = ${total / d}`)}`, `Ta sedan ${n} sådana: ${m(`${n} · ${total / d} = ${n * total / d}`)}`], hint: `Först 1/${d}, sedan gånger ${n}.` }; }
    if (variant === 2) { const d = R.pick([4, 6, 8, 10]), a = R.int(1, d - 2), b = R.int(1, d - 1 - a); const sum = a + b; return { type: 'text', text: `Räkna ut ${m(`${a}/${d} + ${b}/${d}`)}. Skriv svaret som bråk.`, answer: [`${sum}/${d}`, ...(sum === d ? ['1', '1/1'] : []), ...simplifyAlts(sum, d)], display: `${sum}/${d}`, level, steps: [`Samma nämnare – lägg bara ihop täljarna.`, `${m(`${a} + ${b} = ${sum}`)}, nämnaren är kvar: ${m(`${sum}/${d}`)}`, ...(simplifyAlts(sum, d).length ? [`Kan förenklas till ${m(simplifyAlts(sum, d)[0])}.`] : [])], hint: 'Nämnaren ändras inte när nämnarna är lika.' }; }
    const pairs = [[2, 4, '1/2'], [3, 6, '1/2'], [2, 6, '1/3'], [2, 8, '1/4'], [4, 8, '1/2'], [5, 10, '1/2'], [3, 9, '1/3'], [6, 8, '3/4'], [4, 6, '2/3'], [2, 10, '1/5']]; const [n, d, simp] = R.pick(pairs); return { type: 'text', text: `Skriv ${m(`${n}/${d}`)} i enklaste form.`, answer: [simp], display: simp, level, steps: [`Hitta ett tal som både ${n} och ${d} kan delas med.`, `${m(`${n}/${d} = ${simp}`)}`], hint: `Kan du dela både ${n} och ${d} med samma tal?` };
  }
  const variant = R.int(1, 2);
  if (variant === 1) { const total = R.pick([12, 20, 24, 30, 36, 40, 60]), d = R.pick([3, 4, 5, 6].filter(x => total % x === 0)), n = R.int(1, d - 1); const part = n * total / d; return { type: 'num', text: `I en klass går ${total} elever. ${m(`${n}/${d}`)} av dem åker buss till skolan. Hur många åker buss?`, answer: part, level, steps: [`1/${d} av ${total}: ${m(`${total} / ${d} = ${total / d}`)}`, `${n}/${d}: ${m(`${n} · ${total / d} = ${part}`)}`], hint: `Dela först med ${d}, multiplicera sedan med ${n}.` }; }
  const [a, b] = R.pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [1, 10], [3, 10], [7, 10]]); const dec = (a / b).toString().replace('.', ','); return { type: 'text', text: `Skriv ${m(`${a}/${b}`)} som decimaltal.`, answer: [dec, dec.replace(',', '.'), dec.replace('0,', ',')], display: dec, level, steps: [`${m(`${a}/${b}`)} = ${a} delat med ${b}.`, `Tänk tiondelar eller hundradelar: ${m(`${a}/${b} = ${dec}`)}`], hint: '1/2 = 0,5 · 1/4 = 0,25 · 1/5 = 0,2 · 1/10 = 0,1' };
}
function simplifyAlts(n, d) { const g = gcd(n, d); if (g === 1 || n === d) return []; return [`${n / g}/${d / g}`]; }
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/* ---- Åk 4: geometri (omkrets & area) ---- */
function genGeometri(level) {
  if (level === 1) { const square = R.chance(0.4); if (square) { const s = R.int(2, 12); return { type: 'num', fig: VIS.rect(s, s), text: `En kvadrat har sidan ${s} cm. Hur stor är omkretsen? (svara i cm)`, answer: 4 * s, level, steps: [`Omkrets = alla sidor ihop. En kvadrat har fyra lika sidor.`, `${m(`4 · ${s} = ${4 * s}`)} cm`], hint: 'Fyra sidor som alla är lika långa.' }; } const a = R.int(2, 12), b = R.int(2, 12); return { type: 'num', fig: VIS.rect(a, b), text: `En rektangel är ${a} cm lång och ${b} cm bred. Hur stor är omkretsen? (svara i cm)`, answer: 2 * (a + b), level, steps: [`Omkrets = runt hela figuren: ${m(`${a} + ${b} + ${a} + ${b}`)}`, `${m(`2 · ${a} + 2 · ${b} = ${2 * a} + ${2 * b} = ${2 * (a + b)}`)} cm`], hint: 'Två långa och två korta sidor.' }; }
  if (level === 2) { const a = R.int(2, 12), b = R.int(2, 12); return { type: 'num', fig: VIS.rect(a, b, { grid: true }), text: `En rektangel är ${a} cm lång och ${b} cm bred. Hur stor är arean? (svara i cm²)`, answer: a * b, level, steps: [`Area = hur många rutor som får plats inuti: längd · bredd.`, `${m(`${a} · ${b} = ${a * b}`)} cm²`], hint: 'Area = längd gånger bredd.' }; }
  const variant = R.int(1, 2);
  if (variant === 1) { const a = R.int(3, 15), b = R.int(2, 12); const omk = 2 * (a + b); return { type: 'num', text: `En rektangel har omkretsen ${omk} cm. Den ena sidan är ${a} cm. Hur lång är den andra sidan? (svara i cm)`, answer: b, level, steps: [`Två sidor är ${a} cm: ${m(`2 · ${a} = ${2 * a}`)}`, `Det som är kvar av omkretsen delas på de två andra sidorna: ${m(`${omk} − ${2 * a} = ${omk - 2 * a}`)}, ${m(`${omk - 2 * a} / 2 = ${b}`)} cm`], hint: 'Ta bort de två kända sidorna från omkretsen, dela resten på två.' }; }
  const s = R.int(3, 12); return { type: 'num', text: `En kvadrat har arean ${s * s} cm². Hur lång är en sida? (svara i cm)`, answer: s, level, steps: [`Area = sida · sida. Vilket tal gånger sig självt blir ${s * s}?`, `${m(`${s} · ${s} = ${s * s}`)}, så sidan är ${m(s)} cm`], hint: 'Vilket tal gånger sig självt?' };
}

/* ---- Åk 4: enheter ---- */
function genEnheter(level) {
  const fmt = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
  const ask = (text, ans, steps, hint) => ({ type: 'num', text, answer: ans, level, steps, hint });
  if (level === 1) {
    const v = R.pick([['m', 'cm', 100, R.int(1, 9)], ['km', 'm', 1000, R.int(1, 9)], ['kg', 'g', 1000, R.int(1, 9)], ['l', 'dl', 10, R.int(1, 9)], ['dm', 'cm', 10, R.int(1, 9)]]);
    const [from, to, f, n] = v; return ask(`${n} ${from} = ? ${to}`, n * f, [`1 ${from} = ${f} ${to}`, `${m(`${n} · ${f} = ${n * f}`)} ${to}`], `1 ${from} är ${f} ${to}.`);
  }
  if (level === 2) {
    const v = R.pick([['cm', 'm', 100, R.int(2, 9) * 100 + R.pick([0, 50])], ['m', 'km', 1000, R.int(1, 9) * 1000 + R.pick([0, 500])], ['g', 'kg', 1000, R.int(1, 9) * 1000 + R.pick([0, 500])], ['dl', 'l', 10, R.int(1, 9) * 10 + R.pick([0, 5])], ['min', 'h', 60, R.int(1, 4) * 60 + R.pick([0, 30])]]);
    const [from, to, f, n] = v; const ans = n / f; return { type: 'num', text: `${n} ${from} = ? ${to}${Number.isInteger(ans) ? '' : ' (decimaltal, t.ex. 2,5)'}`, answer: ans, level, steps: [`${f} ${from} = 1 ${to}`, `${m(`${n} / ${f} = ${fmt(ans)}`)} ${to}`], hint: `Dela med ${f}.` };
  }
  const variant = R.int(1, 2);
  if (variant === 1) { const a = R.int(1, 3), b = R.int(1, 9) * 100 + R.pick([0, 50]); return ask(`${a} km och ${b} m = ? m`, a * 1000 + b, [`${a} km = ${a * 1000} m`, `${m(`${a * 1000} + ${b} = ${a * 1000 + b}`)} m`], 'Gör om kilometrarna till meter först.'); }
  const kg = R.int(1, 4), g = R.int(1, 9) * 100; return { type: 'num', text: `Ett paket väger ${kg} kg och ${g} g. Hur många kilogram är det? (decimaltal)`, answer: kg + g / 1000, level, steps: [`${g} g = ${fmt(g / 1000)} kg`, `${m(`${kg} + ${fmt(g / 1000)} = ${fmt(kg + g / 1000)}`)} kg`], hint: '1000 g = 1 kg, så 500 g = 0,5 kg.' };
}

/* ---- Åk 4: klockan och tid ---- */
function genKlockan(level) {
  if (level === 1) {
    const h = R.int(1, 11), mm = R.pick([0, 15, 30, 45]); const words = { 0: `klockan ${h}`, 15: `kvart över ${h}`, 30: `halv ${h + 1}`, 45: `kvart i ${h + 1}` };
    const ans = timeAnswers(h, mm); if (R.chance(0.5)) return { type: 'text', fig: VIS.clock(h, mm), text: `Vad är klockan? Skriv digitalt (t.ex. 4:15).`, answer: ans, display: timeStr(h, mm), level, steps: [`Den korta visaren pekar på ${h}${mm ? ' (lite förbi)' : ''}, den långa på ${mm === 0 ? '12 (hel)' : mm === 15 ? '3 (kvart över)' : mm === 30 ? '6 (halv)' : '9 (kvart i)'}.`, `Svar: ${m(timeStr(h, mm))}`], hint: 'Kort visare = timme, lång visare = minuter.' };
    return { type: 'text', text: `Hur skriver du "${words[mm]}" på en digital klocka? (t.ex. 4:15)`, answer: ans, display: timeStr(h, mm), level, steps: [`Hel = :00, kvart över = :15, halv = :30 (men timmen innan!), kvart i = :45 (timmen innan).`, `Svar: ${m(timeStr(h, mm))}`], hint: '"Halv fyra" betyder 3:30 – en halvtimme kvar till fyra.' };
  }
  if (level === 2) {
    const h = R.int(8, 20), mm = R.pick([0, 10, 15, 20, 30, 40, 45, 50]), add = R.pick([15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90]);
    const total = h * 60 + mm + add; const h2 = Math.floor(total / 60) % 24, m2 = total % 60;
    return { type: 'text', text: `Klockan är ${timeStr(h, mm)}. Vad är klockan om ${add} minuter? (t.ex. 14:35)`, answer: timeAnswers(h2, m2), display: timeStr(h2, m2), level, steps: [add >= 60 ? `${add} min = ${Math.floor(add / 60)} h ${add % 60} min` : `Räkna först upp till nästa hela timme: ${60 - mm} min.`, `${timeStr(h, mm)} + ${add} min = ${m(timeStr(h2, m2))}`], hint: 'Hoppa först till närmaste hela timme, lägg sedan på resten.' };
  }
  const h1 = R.int(7, 18), m1 = R.pick([0, 10, 15, 20, 30, 40, 45, 50]); let diff = R.pick([25, 35, 40, 50, 65, 70, 85, 95, 110, 130]); const total = h1 * 60 + m1 + diff; const h2 = Math.floor(total / 60), m2 = total % 60;
  return { type: 'num', text: `Lektionen börjar ${timeStr(h1, m1)} och slutar ${timeStr(h2, m2)}. Hur många minuter varar den?`, answer: diff, level, steps: [`Från ${timeStr(h1, m1)} till ${timeStr(h1 + 1, m1)} är 60 min.`, `Räkna timmar och minuter var för sig och lägg ihop: ${m(`${diff}`)} min`], hint: 'Räkna hela timmar först, sedan minuterna som är kvar.' };
}

/* ---- Åk 2: klockan ---- */
function genKlockan2(level) {
  if (level === 1) { const h = R.int(1, 12); const mm = R.pick([0, 30]); const correct = mm === 0 ? `Klockan är ${h}` : `Klockan är halv ${h === 12 ? 1 : h + 1}`; const wrong = R.shuffle([`Klockan är halv ${h}`, `Klockan är ${h === 12 ? 1 : h + 1}`, `Klockan är kvart över ${h}`, mm === 0 ? `Klockan är halv ${h === 12 ? 1 : h + 1}` : `Klockan är ${h}`]).filter(x => x !== correct).slice(0, 3); const ch = R.shuffle([correct, ...wrong]); return { type: 'choicetext', fig: VIS.clock(h, mm), text: `Vad är klockan?`, choices: ch, answer: ch.indexOf(correct), level, steps: [mm === 0 ? `:00 betyder hel timme – klockan är ${h}.` : `:30 betyder halv – och man säger halv till nästa timme: halv ${h === 12 ? 1 : h + 1}.`], hint: mm === 30 ? 'Halv = en halvtimme kvar till nästa timme.' : 'Noll minuter = hel timme.' }; }
  if (level === 2) { const h = R.int(1, 12), mm = R.pick([15, 45]); const correct = mm === 15 ? `kvart över ${h}` : `kvart i ${h === 12 ? 1 : h + 1}`; const ch = R.shuffle([correct, mm === 15 ? `kvart i ${h}` : `kvart över ${h}`, `halv ${h === 12 ? 1 : h + 1}`, `klockan ${h}`]); return { type: 'choicetext', fig: VIS.clock(h, mm), text: `Vad är klockan?`, choices: ch, answer: ch.indexOf(correct), level, steps: [`:15 = kvart över (en kvart har gått). :45 = kvart i (en kvart kvar till nästa timme).`, `Svar: ${correct}`], hint: ':15 är kvart över, :45 är kvart i nästa timme.' }; }
  const h = R.int(1, 10), add = R.pick([1, 2]); return { type: 'text', text: `Klockan är ${timeStr(h, 0)}. Vad är klockan om ${add === 1 ? 'en timme' : 'två timmar'}? (t.ex. 5:00)`, answer: timeAnswers(h + add, 0), display: timeStr(h + add, 0), level, steps: [`En timme framåt = timtalet ökar med ett.`, `${timeStr(h, 0)} + ${add} h = ${m(timeStr(h + add, 0))}`], hint: 'Räkna timmarna framåt.' };
}

/* ---- Åk 2: pengar ---- */
function genPengar(level) {
  const n1 = R.pick(NAMES);
  if (level === 1) { const coins = { 1: R.int(0, 4), 5: R.int(0, 3), 10: R.int(0, 3) }; const total = coins[1] + 5 * coins[5] + 10 * coins[10] || 7; const parts = Object.entries(coins).filter(([, c]) => c > 0).map(([v, c]) => `${c} st ${v}-kron${c > 1 ? 'or' : 'a'}`); if (!parts.length) { coins[5] = 1; coins[1] = 2; parts.push('1 st 5-krona', '2 st 1-kronor'); } const t = coins[1] + 5 * coins[5] + 10 * coins[10]; return { type: 'num', fig: VIS.coins(coins), text: `${n1} har de här mynten. Hur många kronor är det?`, answer: t, level, steps: [`Räkna tiorna först: ${10 * coins[10]} kr. Sedan femmorna: ${5 * coins[5]} kr. Sedan enkronorna: ${coins[1]} kr.`, `${m(`${10 * coins[10]} + ${5 * coins[5]} + ${coins[1]} = ${t}`)} kr`], hint: 'Börja med de största mynten.', choices: T.choices(t, 4, 3) }; }
  if (level === 2) { const price = R.int(6, 19), pay = 20; return { type: 'num', text: `${n1} köper en glass för ${price} kr och betalar med en 20-lapp. Hur mycket får ${n1} tillbaka?`, answer: pay - price, level, steps: [`Räkna från ${price} upp till ${pay}.`, `${m(`${pay} − ${price} = ${pay - price}`)} kr`], hint: `Hur många kronor fattas från ${price} till 20?`, choices: T.choices(pay - price, 4, 2) }; }
  const a = R.int(12, 45), b = R.int(10, 40), pay = R.pick([50, 100]); const sum = a + b; if (sum > pay) return genPengar(level); return { type: 'num', text: `${n1} köper en bok för ${a} kr och pennor för ${b} kr och betalar med en ${pay}-lapp. Hur mycket får ${n1} tillbaka?`, answer: pay - sum, level, steps: [`Vad kostar allt? ${m(`${a} + ${b} = ${sum}`)} kr`, `Tillbaka: ${m(`${pay} − ${sum} = ${pay - sum}`)} kr`], hint: 'Lägg först ihop priserna.' };
}

/* ---- Åk 2: former ---- */
function genFormer(level) {
  const shapes = [['triangel', 3, 3], ['kvadrat', 4, 4], ['rektangel', 4, 4], ['femhörning', 5, 5], ['sexhörning', 6, 6]];
  if (level === 1) { const [name, corners] = R.pick(shapes.slice(0, 3)); return { type: 'num', fig: VIS.shape(name), text: `Hur många hörn har den här figuren (en ${name})?`, answer: corners, level, steps: [`En ${name} har ${corners} hörn och ${corners} sidor.`], hint: 'Räkna "spetsarna".', choices: T.choices(corners, 4, 2).filter(x => x > 0) }; }
  if (level === 2) { const qs = [['Vilken form har fyra lika långa sidor och fyra räta hörn?', 'kvadrat', ['rektangel', 'triangel', 'cirkel']], ['Vilken form har tre sidor?', 'triangel', ['kvadrat', 'rektangel', 'cirkel']], ['Vilken form har inga hörn alls?', 'cirkel', ['kvadrat', 'triangel', 'rektangel']], ['Vilken form har två långa och två korta sidor?', 'rektangel', ['kvadrat', 'triangel', 'cirkel']]]; const [q, c, w] = R.pick(qs); const ch = R.shuffle([c, ...w]); return { type: 'choicetext', text: q, choices: ch, answer: ch.indexOf(c), level, steps: [`Svar: ${c}.`], hint: 'Tänk på hur figuren ser ut – rita den i luften!' }; }
  const [name, , sides] = R.pick(shapes); const k = R.int(2, 4); return { type: 'num', text: `Du ritar ${k} ${name === 'triangel' ? 'trianglar' : name === 'kvadrat' ? 'kvadrater' : name === 'rektangel' ? 'rektanglar' : name === 'femhörning' ? 'femhörningar' : 'sexhörningar'}. Hur många sidor ritar du totalt?`, answer: k * sides, level, steps: [`En ${name} har ${sides} sidor.`, `${m(`${k} · ${sides} = ${k * sides}`)} sidor`], hint: `Varje ${name} har ${sides} sidor. Lägg ihop.` };
}

/* ---- Åk 2: talraden ---- */
function genTalrad(level) {
  if (level === 1) { const variant = R.int(1, 2); if (variant === 1) { const n = R.int(10, 98); const after = R.chance(0.5); const lo = Math.max(0, n - 5), hi = lo + 10; return { type: 'num', fig: VIS.numberLine(lo, hi, 1, [{ value: n, label: String(n) }, { value: after ? n + 1 : n - 1, label: '?', color: 'var(--warn)' }]), text: `Vilket tal kommer ${after ? 'efter' : 'före'} ${m(n)}?`, answer: after ? n + 1 : n - 1, level, steps: [`${after ? 'Ett steg framåt' : 'Ett steg bakåt'} på talraden: ${m(after ? n + 1 : n - 1)}`], hint: after ? 'Räkna ett steg uppåt.' : 'Räkna ett steg bakåt.', choices: T.choices(after ? n + 1 : n - 1, 4, 2) }; } const a = R.int(10, 99); let b = R.int(10, 99); while (b === a) b = R.int(10, 99); const big = Math.max(a, b); const ch = [String(a), String(b)]; return { type: 'choicetext', text: `Vilket tal är <b>störst</b>?`, choices: ch, answer: ch.indexOf(String(big)), level, steps: [`Jämför tiotalen först: ${Math.floor(a / 10)} och ${Math.floor(b / 10)}.${Math.floor(a / 10) === Math.floor(b / 10) ? ' Lika – jämför då entalen.' : ''}`, `${m(big)} är störst.`], hint: 'Titta på tiotalssiffran först.' }; }
  if (level === 2) { const step = R.pick([2, 5, 10]); const start = step === 10 ? R.int(1, 5) * 10 : step === 5 ? R.int(1, 10) * 5 : R.int(1, 20) * 2; const seq = [start, start + step, start + 2 * step, start + 3 * step]; return { type: 'num', text: `Fortsätt mönstret: ${m(seq.join(', ') + ', ?')}`, answer: start + 4 * step, level, steps: [`Talen ökar med ${step} varje gång.`, `${m(`${seq[3]} + ${step} = ${start + 4 * step}`)}`], hint: `Hur mycket ökar det varje gång?`, choices: T.choices(start + 4 * step, 4, step) }; }
  const variant = R.int(1, 2); if (variant === 1) { const n = R.int(11, 97); const lo = Math.max(0, n - 5), hi = lo + 10; return { type: 'num', fig: VIS.numberLine(lo, hi, 1, [{ value: n - 1, label: String(n - 1) }, { value: n + 1, label: String(n + 1) }, { value: n, label: '?', color: 'var(--warn)' }]), text: `Vilket tal ligger mitt emellan ${m(n - 1)} och ${m(n + 1)}?`, answer: n, level, steps: [`Talet som kommer efter ${n - 1} och före ${n + 1}: ${m(n)}`], hint: 'Räkna ett steg från det mindre talet.', choices: T.choices(n, 4, 2) }; }
  const n = R.int(21, 99); const tens = Math.floor(n / 10), ones = n % 10; return { type: 'num', text: `Talet ${m(n)} har ${tens} tiotal och ${ones} ental. Vad händer om du lägger till ett tiotal? Vilket tal får du?`, answer: n + 10, level, steps: [`Ett tiotal = 10. ${m(`${n} + 10 = ${n + 10}`)}`, `Tiotalssiffran ökar med 1, entalen är kvar.`], hint: 'Lägg till 10.' };
}

const METHOD_MORE = {
  brak: `<p>Ett <b>bråk</b> visar en del av något. Talet under strecket (<b>nämnaren</b>) säger hur många lika delar det hela är delat i. Talet över (<b>täljaren</b>) säger hur många delar vi menar.</p><p class="ex">${m('3/8')} av en pizza = pizzan är delad i 8 bitar och vi har 3.</p><p>Ju fler delar, desto mindre bit: ${m('1/3')} är större än ${m('1/5')}. "${m('1/4')} av 20" = dela 20 i 4 delar = 5. "${m('3/4')} av 20" = 3 · 5 = 15.</p>`,
  geometri: `<p><b>Omkrets</b> = sträckan runt hela figuren (alla sidor ihop). <b>Area</b> = ytan inuti, räknas i cm² (rutor).</p><p class="ex">Rektangel 5 cm × 3 cm: omkrets ${m('5 + 3 + 5 + 3 = 16')} cm, area ${m('5 · 3 = 15')} cm²</p>`,
  enheter: `<p>1 km = 1000 m · 1 m = 100 cm · 1 dm = 10 cm · 1 kg = 1000 g · 1 l = 10 dl · 1 h = 60 min</p><p class="ex">Till mindre enhet: multiplicera (3 m = 300 cm). Till större enhet: dividera (250 cm = 2,5 m).</p>`,
  klockan: `<p>Kvart över = :15 · Halv = :30 (men man säger timmen <b>som kommer</b>: halv fyra = 3:30) · Kvart i = :45 (kvart i fyra = 3:45).</p><p class="ex">Framåt i tiden: hoppa till nästa hela timme först. 14:40 + 35 min: 20 min till 15:00, sedan 15 min till = 15:15.</p>`,
  klockan2: `<p>När den långa visaren pekar rakt upp är det <b>hel</b> timme. Pekar den rakt ner är det <b>halv</b> – och då säger man nästa timme: halv tre = 2:30.</p><p class="ex">Kvart över = :15, kvart i = :45 (kvart i tre = 2:45).</p>`,
  pengar: `<p>Räkna de största mynten först: tior, sedan femmor, sedan enkronor.</p><p class="ex">Växel: räkna uppåt från priset till det du betalade. Glass 13 kr, betalar 20: från 13 till 20 är 7 kr tillbaka.</p>`,
  former: `<p>Triangel: 3 hörn, 3 sidor. Kvadrat: 4 lika sidor. Rektangel: 4 sidor, två långa och två korta. Cirkel: inga hörn alls.</p>`,
  talrad: `<p>Talraden går 0, 1, 2 … 100. Efter 39 kommer 40. Jämför tal genom att titta på tiotalen först: 74 är större än 47 för 7 tiotal är mer än 4.</p><p class="ex">Mönster: 5, 10, 15 … ökar med 5 varje gång.</p>`,
};
const MORE_SKILLS = {
  ak4: [
    { id: 'brak', name: 'Bråk', short: 'Bråk', icon: '½', gen: genBrak, method: METHOD_MORE.brak },
    { id: 'geometri', name: 'Omkrets och area', short: 'Geometri', icon: '▭', gen: genGeometri, method: METHOD_MORE.geometri },
    { id: 'enheter', name: 'Enheter: längd, vikt, volym', short: 'Enheter', icon: '📏', gen: genEnheter, method: METHOD_MORE.enheter },
    { id: 'klockan', name: 'Klockan och tid', short: 'Klockan', icon: '🕒', gen: genKlockan, method: METHOD_MORE.klockan },
  ],
  ak2: [
    { id: 'klockan2', name: 'Klockan: hel, halv, kvart', short: 'Klockan', icon: '🕒', gen: genKlockan2, method: METHOD_MORE.klockan2 },
    { id: 'pengar', name: 'Räkna med pengar', short: 'Pengar', icon: '🪙', gen: genPengar, method: METHOD_MORE.pengar },
    { id: 'former', name: 'Former och hörn', short: 'Former', icon: '△', gen: genFormer, method: METHOD_MORE.former },
    { id: 'talrad', name: 'Talraden till 100', short: 'Talraden', icon: '↔', gen: genTalrad, method: METHOD_MORE.talrad },
  ],
};
if (typeof module !== 'undefined') module.exports = { MORE_SKILLS };
