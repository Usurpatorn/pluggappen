/* ========= Content: skills and question generators ========= */
const m = (s) => `<span class="m">${s}</span>`;
const NAMES = ['Mira', 'Noah', 'Elsa', 'Omar', 'Lova', 'Ali', 'Signe', 'Hugo', 'Lina', 'Elias'];

/* ---------------- ÅK 8 — Algebra ---------------- */

// A1: multiplicera in tal i parenteser
function genMultIn(level) {
  const v = 'x';
  let a, b, c, text, steps, answer, hint;
  if (level === 1) {
    a = R.int(2, 6); b = R.int(1, 6); c = R.int(1, 9);
    const plus = R.chance(0.7);
    const cc = plus ? c : -c;
    text = `Multiplicera in: ${m(`${a}(${T.lin(b, cc)})`)}`;
    answer = Poly.parse(`${a}*(${b}x+(${cc}))`);
    steps = [
      `Talet ${m(a)} utanför parentesen ska multipliceras med <b>varje</b> term inuti.`,
      `${m(`${a} · ${T.term(b, v)} = ${T.term(a * b, v)}`)}`,
      `${m(`${a} · ${T.paren(cc)} = ${T.n(a * cc)}`)}`,
      `Svar: ${m(Poly.format(answer))}`,
    ];
    hint = `Pilarna: ${a} gånger första termen, sedan ${a} gånger andra termen.`;
  } else if (level === 2) {
    a = R.int(2, 9) * R.sign(); b = R.int(1, 8); c = R.nonzero(-12, 12);
    text = `Multiplicera in: ${m(`${T.n(a)}(${T.lin(b, c)})`)}`;
    answer = Poly.parse(`(${a})*(${b}x+(${c}))`);
    steps = [
      `Multiplicera ${m(T.n(a))} med varje term i parentesen. Håll koll på tecknen!`,
      `${m(`${T.paren(a)} · ${T.term(b, v)} = ${T.term(a * b, v)}`)}`,
      `${m(`${T.paren(a)} · ${T.paren(c)} = ${T.n(a * c)}`)}  ${a < 0 && c < 0 ? '(minus gånger minus blir plus)' : a < 0 || c < 0 ? '(minus gånger plus blir minus)' : ''}`,
      `Svar: ${m(Poly.format(answer))}`,
    ];
    hint = a < 0 ? 'Ett negativt tal utanför byter tecken på alla termer inuti.' : 'Multiplicera med båda termerna, även den med minus.';
  } else {
    // variable outside or three terms or parenthesis last
    const variant = R.int(1, 4);
    if (variant === 4) {
      const [u, w] = R.pick([['a', 'b'], ['x', 'y'], ['p', 'q']]); a = R.int(2, 5); b = R.int(2, 6); c = R.nonzero(-7, 7);
      text = `Multiplicera in: ${m(`${a}${u}(${T.term(b, w)}${T.signed(c)})`)}`;
      answer = Poly.parse(`${a}${u}*(${b}${w}+(${c}))`);
      steps = [
        `${m(a + u)} står utanför och ska multipliceras med båda termerna.`,
        `${m(`${a}${u} · ${T.term(b, w)} = ${T.term(a * b, u + w)}`)} (talen multipliceras, bokstäverna skrivs ihop)`,
        `${m(`${a}${u} · ${T.paren(c)} = ${T.term(a * c, u)}`)}`,
        `Svar: ${m(Poly.format(answer))}`,
      ];
      hint = `Tal gånger tal, och ${u} · ${w} skrivs ${u}${w}.`;
      return { type: 'expr', variable: u, variables: [u, w], text, answer, steps, hint, level };
    }
    if (variant === 1) {
      b = R.int(2, 7); c = R.nonzero(-9, 9);
      text = `Multiplicera in: ${m(`x(${T.lin(b, c)})`)}`;
      answer = Poly.parse(`x*(${b}x+(${c}))`);
      steps = [
        `Här är det ${m('x')} som står utanför. ${m('x · x = x²')}.`,
        `${m(`x · ${T.term(b, v)} = ${T.term(b, 'x²')}`)}`,
        `${m(`x · ${T.paren(c)} = ${T.term(c, v)}`)}`,
        `Svar: ${m(Poly.format(answer))}`,
      ];
      hint = 'x gånger x blir x². x gånger ett tal blir ett x-uttryck.';
    } else if (variant === 2) {
      a = R.int(2, 6) * R.sign(); b = R.nonzero(-5, 5); c = R.nonzero(-7, 7); const d = R.nonzero(-9, 9);
      const inner = `${T.term(b, 'x²')}${T.signed(c, 'x')}${T.signed(d)}`;
      text = `Multiplicera in: ${m(`${T.n(a)}(${inner})`)}`;
      answer = Poly.parse(`(${a})*(${b}x^2+(${c})x+(${d}))`);
      steps = [
        `Tre termer i parentesen – ${m(T.n(a))} ska multipliceras med alla tre.`,
        `${m(`${T.paren(a)} · ${T.term(b, 'x²')} = ${T.term(a * b, 'x²')}`)}`,
        `${m(`${T.paren(a)} · ${T.term(c, v)} = ${T.term(a * c, v)}`)}`,
        `${m(`${T.paren(a)} · ${T.paren(d)} = ${T.n(a * d)}`)}`,
        `Svar: ${m(Poly.format(answer))}`,
      ];
      hint = 'Gör en term i taget. Tre termer inuti ger tre termer i svaret.';
    } else {
      a = R.int(2, 9); b = R.int(2, 9); c = R.nonzero(-10, 10);
      text = `Multiplicera in: ${m(`(${T.lin(b, c)}) · ${a}`)}`;
      answer = Poly.parse(`(${b}x+(${c}))*${a}`);
      steps = [
        `Talet står efter parentesen, men det spelar ingen roll – multiplicera ändå med varje term.`,
        `${m(`${T.term(b, v)} · ${a} = ${T.term(a * b, v)}`)}`,
        `${m(`${T.paren(c)} · ${a} = ${T.n(a * c)}`)}`,
        `Svar: ${m(Poly.format(answer))}`,
      ];
      hint = 'Ordningen spelar ingen roll vid multiplikation.';
    }
  }
  return { type: 'expr', variable: v, text, answer, steps, hint, level };
}

// A2: förenkla uttryck med parenteser
function genForenkla(level) {
  const v = 'x'; let text, steps, answer, hint;
  if (level === 1) {
    // a(bx+c) + dx + e   or  px + q + a(bx+c)
    const a = R.int(2, 5), b = R.int(1, 5), c = R.int(1, 8), d = R.int(1, 6), e = R.nonzero(-9, 9);
    text = `Förenkla: ${m(`${a}(${T.lin(b, c)})${T.signed(d, 'x')}${T.signed(e)}`)}`;
    answer = Poly.parse(`${a}*(${b}x+${c})+${d}x+(${e})`);
    steps = [
      `Multiplicera först in ${m(a)} i parentesen: ${m(`${a}(${T.lin(b, c)}) = ${T.lin(a * b, a * c)}`)}`,
      `Nu har vi: ${m(`${T.lin(a * b, a * c)}${T.signed(d, 'x')}${T.signed(e)}`)}`,
      `Samla x-termerna: ${m(`${T.term(a * b, v)}${T.signed(d, 'x')} = ${T.term(a * b + d, v)}`)}`,
      `Samla talen: ${m(`${a * c}${T.signed(e)} = ${T.n(a * c + e)}`)}`,
      `Svar: ${m(Poly.format(answer))}`,
    ];
    hint = 'Steg 1: multiplicera in. Steg 2: lägg ihop x-termer för sig och tal för sig.';
  } else if (level === 2) {
    const variant = R.int(1, 2);
    if (variant === 1) {
      // px + q − (rx + s)
      const p = R.int(3, 9), q = R.nonzero(-9, 9), r = R.int(1, p - 1), s = R.nonzero(-9, 9);
      text = `Förenkla: ${m(`${T.lin(p, q)} − (${T.lin(r, s)})`)}`;
      answer = Poly.parse(`${p}x+(${q})-(${r}x+(${s}))`);
      steps = [
        `Ett minustecken framför en parentes byter tecken på <b>allt</b> inuti när parentesen tas bort.`,
        `${m(`− (${T.lin(r, s)}) = ${T.term(-r, v)}${T.signed(-s)}`)}`,
        `Nu: ${m(`${T.lin(p, q)}${T.signed(-r, 'x')}${T.signed(-s)}`)}`,
        `x-termer: ${m(`${T.term(p, v)}${T.signed(-r, 'x')} = ${T.term(p - r, v)}`)}. Tal: ${m(`${T.n(q)}${T.signed(-s)} = ${T.n(q - s)}`)}`,
        `Svar: ${m(Poly.format(answer))}`,
      ];
      hint = 'Minus framför parentesen = byt tecken på båda termerna inuti.';
    } else {
      // a(bx+c) + d(ex+f)
      const a = R.int(2, 5), b = R.int(1, 5), c = R.nonzero(-6, 6), d = R.int(2, 5), e = R.int(1, 5), f = R.nonzero(-6, 6);
      text = `Förenkla: ${m(`${a}(${T.lin(b, c)}) + ${d}(${T.lin(e, f)})`)}`;
      answer = Poly.parse(`${a}*(${b}x+(${c}))+${d}*(${e}x+(${f}))`);
      steps = [
        `Multiplicera in i första parentesen: ${m(`${a}(${T.lin(b, c)}) = ${T.lin(a * b, a * c)}`)}`,
        `Multiplicera in i andra parentesen: ${m(`${d}(${T.lin(e, f)}) = ${T.lin(d * e, d * f)}`)}`,
        `Lägg ihop: ${m(`${T.lin(a * b, a * c)}${T.signed(d * e, 'x')}${T.signed(d * f)}`)}`,
        `x-termer: ${m(T.term(a * b + d * e, v))}. Tal: ${m(T.n(a * c + d * f))}`,
        `Svar: ${m(Poly.format(answer))}`,
      ];
      hint = 'Multiplicera in i båda parenteserna först, förenkla sedan.';
    }
  } else if (level === 2 && R.chance(0.35)) {
    // Bokens stil: (5a − 2b) + (a − b),  (2x − y) − (x − 3y),  8z − (z − 4) + 2
    const [u, w] = R.pick([['a', 'b'], ['x', 'y'], ['p', 'q']]);
    const minus = R.chance(0.5);
    const a = R.int(2, 7), b = R.nonzero(-5, 5), c = R.int(1, 4), d = R.nonzero(-5, 5);
    const inner1 = `${T.term(a, u)}${T.signed(b, w)}`, inner2 = `${T.term(c, u)}${T.signed(d, w)}`;
    const answer = Poly.parse(`(${a}${u}+(${b})${w})${minus ? '-' : '+'}(${c}${u}+(${d})${w})`);
    const steps = minus
      ? [`Minus framför parentesen: byt tecken på båda termerna när den tas bort.`, `${m(`${inner1} ${T.term(-c, u)}${T.signed(-d, w)}`)}`, `${u}-termer: ${m(T.term(a - c, u))}. ${w}-termer: ${m(T.term(b - d, w))}`, `Svar: ${m(Poly.format(answer))}`]
      : [`Plus framför parentesen: den kan tas bort rakt av.`, `${m(`${inner1}${T.signed(c, u)}${T.signed(d, w)}`)}`, `${u}-termer: ${m(T.term(a + c, u))}. ${w}-termer: ${m(T.term(b + d, w))}`, `Svar: ${m(Poly.format(answer))}`];
    return { type: 'expr', variable: u, variables: [u, w], text: `Förenkla: ${m(`(${inner1}) ${minus ? '−' : '+'} (${inner2})`)}`, answer, steps, hint: minus ? 'Minus framför parentes = byt tecken på allt inuti.' : 'Plus framför parentes = ta bara bort parentesen.', level };
  } else {
    const variant = R.int(1, 3);
    if (variant === 3) {
      // Bokens svåraste: 2a(b + 2) − 3a(1 − b)
      const [u, w] = R.pick([['a', 'b'], ['x', 'y']]);
      const a = R.int(2, 4), c = R.int(1, 4), d = R.int(2, 4), e = R.int(1, 4);
      const answer = Poly.parse(`${a}${u}*(${w}+${c})-${d}${u}*(${e}-${w})`);
      const steps = [
        `Första: ${m(`${a}${u}(${w} + ${c}) = ${a}${u}${w} + ${a * c}${u}`)}`,
        `Andra har minus framför: ${m(`−${d}${u}(${e} − ${w}) = −${d * e}${u} + ${d}${u}${w}`)}`,
        `Lägg ihop: ${m(`${a}${u}${w} + ${a * c}${u} − ${d * e}${u} + ${d}${u}${w}`)}`,
        `${u}${w}-termer: ${m(T.term(a + d, u + w))}. ${u}-termer: ${m(T.term(a * c - d * e, u))}`,
        `Svar: ${m(Poly.format(answer))}`,
      ];
      return { type: 'expr', variable: u, variables: [u, w], text: `Förenkla: ${m(`${a}${u}(${w} + ${c}) − ${d}${u}(${e} − ${w})`)}`, answer, steps, hint: `Multiplicera in i båda parenteserna. ${u} · ${w} = ${u}${w}. Samla sedan ${u}${w}-termer och ${u}-termer var för sig.`, level };
    }
    if (variant === 1) {
      // a(bx+c) − d(ex+f)
      const a = R.int(2, 6), b = R.int(2, 6), c = R.nonzero(-7, 7), d = R.int(2, 5), e = R.int(1, 5), f = R.nonzero(-7, 7);
      text = `Förenkla: ${m(`${a}(${T.lin(b, c)}) − ${d}(${T.lin(e, f)})`)}`;
      answer = Poly.parse(`${a}*(${b}x+(${c}))-${d}*(${e}x+(${f}))`);
      steps = [
        `Första parentesen: ${m(`${a}(${T.lin(b, c)}) = ${T.lin(a * b, a * c)}`)}`,
        `Andra parentesen har minus framför. Tänk ${m(`(−${d})(${T.lin(e, f)}) = ${T.lin(-d * e, -d * f)}`)}`,
        `Lägg ihop: ${m(`${T.lin(a * b, a * c)}${T.signed(-d * e, 'x')}${T.signed(-d * f)}`)}`,
        `x-termer: ${m(T.term(a * b - d * e, v))}. Tal: ${m(T.n(a * c - d * f))}`,
        `Svar: ${m(Poly.format(answer))}`,
      ];
      hint = 'Minus framför parentesen: multiplicera med ett negativt tal, så byter båda termerna tecken.';
    } else {
      // x(x+a) − b(x−c)  → x² + ...
      const a = R.nonzero(-6, 6), b = R.int(2, 6), c = R.nonzero(-6, 6);
      text = `Förenkla: ${m(`x(${T.lin(1, a)}) − ${b}(${T.lin(1, c)})`)}`;
      answer = Poly.parse(`x*(x+(${a}))-${b}*(x+(${c}))`);
      steps = [
        `${m(`x(${T.lin(1, a)}) = x²${T.signed(a, 'x')}`)}`,
        `${m(`− ${b}(${T.lin(1, c)}) = ${T.term(-b, v)}${T.signed(-b * c)}`)}`,
        `Lägg ihop: ${m(`x²${T.signed(a, 'x')}${T.signed(-b, 'x')}${T.signed(-b * c)}`)}`,
        `x-termer: ${m(T.term(a - b, v))}. x² finns bara en av. Tal: ${m(T.n(-b * c))}`,
        `Svar: ${m(Poly.format(answer))}`,
      ];
      hint = 'x · x = x². Samla sedan x-termerna och talen var för sig.';
    }
  }
  return { type: 'expr', variable: v, text, answer, steps, hint, level };
}

// A3: blandade uppgifter med algebraiska uttryck
function genBlandat(level) {
  const v = 'x';
  const variant = level === 1 ? R.pick(['varde', 'liketerms', 'ord']) : level === 2 ? R.pick(['varde2', 'ord2', 'omkrets', 'liketerms2']) : R.pick(['varde3', 'area', 'ord3', 'ekv']);
  const n1 = R.pick(NAMES); let n2 = R.pick(NAMES); while (n2 === n1) n2 = R.pick(NAMES);
  switch (variant) {
    case 'varde': {
      const a = R.int(2, 9), b = R.nonzero(-9, 9), x = R.int(2, 9);
      const ans = a * x + b;
      return { type: 'num', text: `Beräkna värdet av ${m(T.lin(a, b))} när ${m(`x = ${x}`)}`, answer: ans, level,
        steps: [`Byt ut ${m('x')} mot ${m(x)}: ${m(`${a} · ${x}${T.signed(b)}`)}`, `${m(`${a} · ${x} = ${a * x}`)}`, `${m(`${a * x}${T.signed(b)} = ${ans}`)}`],
        hint: `Sätt in ${x} istället för x och räkna ut.` };
    }
    case 'varde2': {
      const a = R.int(2, 6), b = R.nonzero(-6, 6), c = R.int(2, 9), x = R.int(2, 8);
      const ans = a * (x + b) + c;
      return { type: 'num', text: `Beräkna värdet av ${m(`${a}(${T.lin(1, b)})${T.signed(c)}`)} när ${m(`x = ${x}`)}`, answer: ans, level,
        steps: [`Byt ut ${m('x')} mot ${m(x)}: ${m(`${a}(${x}${T.signed(b)})${T.signed(c)}`)}`, `Räkna parentesen först: ${m(`${x}${T.signed(b)} = ${x + b}`)}`, `${m(`${a} · ${T.paren(x + b)} = ${a * (x + b)}`)}`, `${m(`${a * (x + b)}${T.signed(c)} = ${ans}`)}`],
        hint: 'Sätt in värdet, räkna parentesen först, multiplicera sedan.' };
    }
    case 'varde3': {
      const a = R.int(2, 4), b = R.nonzero(-5, 5), x = R.int(-4, 6);
      const ans = a * x * x + b * x;
      return { type: 'num', text: `Beräkna värdet av ${m(`${T.term(a, 'x²')}${T.signed(b, 'x')}`)} när ${m(`x = ${T.n(x)}`)}`, answer: ans, level,
        steps: [`${m('x²')} betyder ${m('x · x')}: ${m(`${T.paren(x)} · ${T.paren(x)} = ${x * x}`)}`, `${m(`${a} · ${x * x} = ${a * x * x}`)}`, `${m(`${T.paren(b)} · ${T.paren(x)} = ${T.n(b * x)}`)}`, `${m(`${a * x * x}${T.signed(b * x)} = ${T.n(ans)}`)}`],
        hint: 'Räkna x² först (x gånger x). Negativt tal i kvadrat blir positivt.' };
    }
    case 'liketerms': {
      const a = R.int(2, 8), b = R.nonzero(-9, 9), c = R.int(1, 7), d = R.nonzero(-9, 9);
      const answer = Poly.parse(`${a}x+(${b})+${c}x+(${d})`);
      return { type: 'expr', variable: v, text: `Förenkla: ${m(`${T.lin(a, b)}${T.signed(c, 'x')}${T.signed(d)}`)}`, answer, level,
        steps: [`Termer med ${m('x')} hör ihop, tal hör ihop.`, `${m(`${T.term(a, v)}${T.signed(c, 'x')} = ${T.term(a + c, v)}`)}`, `${m(`${T.n(b)}${T.signed(d)} = ${T.n(b + d)}`)}`, `Svar: ${m(Poly.format(answer))}`],
        hint: 'Stryk under x-termerna med en färg och talen med en annan.' };
    }
    case 'liketerms2': {
      const a = R.int(2, 6), b = R.nonzero(-9, 9), c = R.nonzero(-7, 7), d = R.nonzero(-9, 9), e = R.int(1, 5);
      const answer = Poly.parse(`${a}x^2+(${b})x+(${c})+(${d})x+${e}x^2`);
      return { type: 'expr', variable: v, text: `Förenkla: ${m(`${T.term(a, 'x²')}${T.signed(b, 'x')}${T.signed(c)}${T.signed(d, 'x')}${T.signed(e, 'x²')}`)}`, answer, level,
        steps: [`Tre sorters termer: ${m('x²')}, ${m('x')} och tal. De kan bara läggas ihop med sin egen sort.`, `${m(`${T.term(a, 'x²')}${T.signed(e, 'x²')} = ${T.term(a + e, 'x²')}`)}`, `${m(`${T.term(b, v)}${T.signed(d, 'x')} = ${T.term(b + d, v)}`)}`, `Talet ${m(T.n(c))} är ensamt.`, `Svar: ${m(Poly.format(answer))}`],
        hint: 'x² och x är olika sorter – blanda inte ihop dem.' };
    }
    case 'ord': {
      const k = R.int(2, 15);
      const answer = Poly.parse(`2x+${k}`);
      return { type: 'expr', variable: v, text: `${n1} har ${m('x')} kr. ${n2} har ${k} kr mer än ${n1}. Skriv ett uttryck för hur mycket pengar de har <b>tillsammans</b>.`, answer, level,
        steps: [`${n1}: ${m('x')} kr`, `${n2}: ${m(`x + ${k}`)} kr`, `Tillsammans: ${m(`x + (x + ${k}) = 2x + ${k}`)}`],
        hint: `${n2} har x + ${k}. Lägg ihop bådas pengar.` };
    }
    case 'ord2': {
      const k = R.int(2, 5), c = R.int(3, 20);
      const answer = Poly.parse(`${k}x-${c}`);
      return { type: 'expr', variable: v, text: `${n1} är ${m('x')} år. ${n2} är ${k} gånger så gammal som ${n1}, minus ${c} år. Skriv ett uttryck för ${n2}s ålder.`, answer, level,
        steps: [`${k} gånger ${m('x')} är ${m(T.term(k, v))}`, `Minus ${c}: ${m(`${k}x − ${c}`)}`],
        hint: '"gånger så gammal" betyder multiplicera.' };
    }
    case 'ord3': {
      const p = R.int(5, 25), q = R.int(2, 6);
      const answer = Poly.parse(`${p}x+${q * p}`);
      return { type: 'expr', variable: v, text: `En biljett kostar ${p} kr. ${n1} köper ${m('x')} biljetter till sig och sina kompisar, och dessutom ${q} extra biljetter. Skriv ett uttryck för vad allt kostar. <i>Förenkla svaret.</i>`, answer, level,
        steps: [`Antal biljetter: ${m(`x + ${q}`)}`, `Kostnad: ${m(`${p}(x + ${q})`)}`, `Multiplicera in: ${m(`${p}x + ${p * q}`)}`],
        hint: `Hur många biljetter blir det totalt? Multiplicera med priset.` };
    }
    case 'omkrets': {
      const a = R.int(2, 9);
      const answer = Poly.parse(`4x+${2 * a}`);
      return { type: 'expr', variable: v, text: `En rektangel har sidorna ${m('x')} cm och ${m(`x + ${a}`)} cm. Skriv ett förenklat uttryck för rektangelns <b>omkrets</b>.`, answer, level,
        steps: [`Omkrets = alla fyra sidor: ${m(`x + (x + ${a}) + x + (x + ${a})`)}`, `Eller ${m(`2 · x + 2 · (x + ${a}) = 2x + 2x + ${2 * a}`)}`, `Svar: ${m(`4x + ${2 * a}`)}`],
        hint: 'Rektangeln har två korta och två långa sidor.' };
    }
    case 'area': {
      const a = R.int(2, 9);
      const answer = Poly.parse(`x^2+${a}x`);
      return { type: 'expr', variable: v, text: `En rektangel har sidorna ${m('x')} cm och ${m(`x + ${a}`)} cm. Skriv ett förenklat uttryck för rektangelns <b>area</b>.`, answer, level,
        steps: [`Area = längd · bredd: ${m(`x(x + ${a})`)}`, `Multiplicera in: ${m(`x · x + x · ${a} = x² + ${a}x`)}`],
        hint: 'Area = sida gånger sida. Multiplicera sedan in x i parentesen.' };
    }
    case 'ekv': {
      const a = R.int(2, 6), x = R.int(2, 9), b = R.nonzero(-9, 9);
      const rhs = a * x + b;
      return { type: 'num', text: `Lös ekvationen ${m(`${T.lin(a, b)} = ${T.n(rhs)}`)}. Vad är ${m('x')}?`, answer: x, level,
        steps: [`Flytta talet: ${m(`${a}x = ${T.n(rhs)}${T.signed(-b)} = ${a * x}`)}`, `Dela med ${a}: ${m(`x = ${a * x} / ${a} = ${x}`)}`],
        hint: 'Gör samma sak på båda sidor: ta bort talet först, dela sedan.' };
    }
  }
}

// A4: talföljder – uttryck och formel
function genTalfoljd(level) {
  const v = 'n';
  const d = level === 1 ? R.int(2, 5) : level === 2 ? R.int(2, 9) : R.pick([2, 3, 4, 5, 6, 7, 8, 9, -2, -3, -5]);
  const first = level === 3 ? R.int(1, 40) : R.int(1, 12);
  const b = first - d; // formula d·n + b
  const terms = [1, 2, 3, 4].map(n => d * n + b);
  const seq = terms.map(T.n).join(', ') + ', …';
  const variant = level === 1 ? R.pick(['next', 'next', 'nth10']) : level === 2 ? R.pick(['formula', 'nth', 'formula']) : R.pick(['formula', 'figur', 'given']);
  const formulaStr = T.lin(d, b, v);
  const steps = [
    `<b>Differens:</b> ${m(`${T.n(terms[1])} − ${T.paren(terms[0])} = ${T.n(d)}`)}`,
    `<b>Variabelterm:</b> differensen gånger n → ${m(T.term(d, 'n'))}`,
    `<b>Sifferterm:</b> n = 1 ger ${m(`${T.n(d)} · 1 = ${T.n(d)}`)}, men första talet är ${m(T.n(first))}. ${m(`${T.n(first)} − ${T.paren(d)} = ${T.n(b)}`)}`,
    `<b>Uttryck:</b> ${m(formulaStr)}`,
    `Kontroll med n = 2: ${m(`${T.n(d)} · 2${T.signed(b)} = ${T.n(terms[1])}`)} ✓`,
  ];
  if (variant === 'next') {
    return { type: 'num', text: `Vilket tal kommer härnäst i talföljden ${m(seq)}?`, answer: d * 5 + b, level, hint: `Hur mycket ökar talen varje steg?`,
      steps: [`Talen ökar med ${m(T.n(d))} varje gång.`, `${m(`${T.n(terms[3])}${T.signed(d)} = ${T.n(d * 5 + b)}`)}`], choices: T.choices(d * 5 + b, 4, d) };
  }
  if (variant === 'nth10') {
    return { type: 'num', text: `Talföljd: ${m(seq)}. Vilket är tal nummer 10?`, answer: d * 10 + b, level, hint: 'Hitta formeln först, sätt sedan in n = 10.',
      steps: [...steps, `Tal nummer 10: ${m(`${T.n(d)} · 10${T.signed(b)} = ${T.n(d * 10 + b)}`)}`] };
  }
  if (variant === 'nth') {
    const k = R.pick([12, 15, 20, 25, 50, 100]);
    return { type: 'num', text: `Talföljd: ${m(seq)}. Vilket är tal nummer ${k}?`, answer: d * k + b, level, hint: `Hitta formeln för tal nummer n, sätt in n = ${k}.`,
      steps: [...steps, `Tal nummer ${k}: ${m(`${T.n(d)} · ${k}${T.signed(b)} = ${T.n(d * k + b)}`)}`] };
  }
  if (variant === 'figur') {
    const base = R.int(1, 4), per = R.int(2, 5);
    const answer = Poly.parse(`${per}n+${base}`);
    return { type: 'expr', variable: v, text: `Ett mönster byggs av stickor. Figur 1 har ${per + base} stickor, figur 2 har ${2 * per + base} och figur 3 har ${3 * per + base}. Skriv ett uttryck för antalet stickor i figur ${m('n')}.`, answer, level,
      hint: 'Differens = hur många stickor läggs till per figur? Sifferterm = vad fattas för figur 1?',
      steps: [`<b>Differens:</b> ${m(`${2 * per + base} − ${per + base} = ${per}`)} stickor per figur.`, `<b>Variabelterm:</b> ${m(`${per}n`)}`, `<b>Sifferterm:</b> figur 1 har ${per + base}, och ${m(`${per} · 1 = ${per}`)}, så ${m(base)} till.`, `<b>Uttryck:</b> ${m(`${per}n + ${base}`)}`] };
  }
  if (variant === 'given') {
    const k = R.int(5, 12);
    const text = `Tal nummer ${m('n')} i en talföljd ges av formeln ${m(formulaStr)}. Beräkna tal nummer ${k}.`;
    return { type: 'num', text, answer: d * k + b, level, hint: `Byt ut n mot ${k}.`, steps: [`Sätt in ${m(`n = ${k}`)}: ${m(`${T.n(d)} · ${k}${T.signed(b)}`)}`, `${m(`= ${T.n(d * k)}${T.signed(b)} = ${T.n(d * k + b)}`)}`] };
  }
  // formula
  const answer = Poly.parse(`${d}n+(${b})`);
  return { type: 'expr', variable: v, text: `Talföljd: ${m(seq)}. Skriv ett uttryck för tal nummer ${m('n')}.`, answer, level, hint: 'Skillnaden mellan talen blir talet framför n. Justera sedan så att n = 1 ger första talet.', steps };
}


// A5: ekvationer (§2.5–2.6) – svaret kontrolleras med VL = HL som i boken
function genEkvation(level) {
  const v = R.pick(level === 1 ? ['x'] : ['x', 'a', 'z', 'b']);
  const vlhl = (lhs, rhs, x) => `Kontroll: V.L. = ${m(lhs)} = ${m(rhs)} = H.L. ✓ (${v} = ${x})`;
  if (level === 1) {
    const a = R.int(2, 9), x = R.int(2, 12), b = R.nonzero(-15, 15); const rhs = a * x + b;
    return { type: 'num', text: `Lös ekvationen ${m(`${T.lin(a, b, v)} = ${T.n(rhs)}`)}`, answer: x, level, variable: v,
      steps: [`Gör samma sak på båda sidor. Ta bort ${m(T.n(b))}: ${m(`${a}${v}${T.signed(b)}${T.signed(-b)} = ${T.n(rhs)}${T.signed(-b)}`)}`, `${m(`${a}${v} = ${a * x}`)}`, `Dela båda sidor med ${a}: ${m(`${v} = ${x}`)}`, vlhl(`${a} · ${x}${T.signed(b)}`, T.n(rhs), x)],
      hint: `Flytta talet först (gör motsatt räknesätt på båda sidor), dela sedan med ${a}.` };
  }
  if (level === 2) {
    // ax + b = cx + d, with variable on both sides (4z + z + 3 = 10 + 2z + 8 style)
    const x = R.int(2, 10), c = R.int(1, 5), a = c + R.int(1, 5), b = R.nonzero(-12, 12); const d = a * x + b - c * x;
    const variant = R.int(1, 2);
    if (variant === 1) {
      return { type: 'num', text: `Lös ekvationen ${m(`${T.lin(a, b, v)} = ${T.lin(c, d, v)}`)}`, answer: x, level, variable: v,
        steps: [`Samla ${v}-termerna på en sida: ta bort ${m(T.term(c, v))} från båda sidor → ${m(`${T.term(a - c, v)}${T.signed(b)} = ${T.n(d)}`)}`, `Ta bort ${m(T.n(b))} från båda sidor → ${m(`${T.term(a - c, v)} = ${T.n(d - b)}`)}`, `Dela med ${a - c}: ${m(`${v} = ${x}`)}`, vlhl(`${a} · ${x}${T.signed(b)}`, `${T.n(a * x + b)}`, x) + `, H.L. = ${m(`${c} · ${x}${T.signed(d)} = ${T.n(c * x + d)}`)}`],
        hint: `Få alla ${v} på ena sidan och alla tal på andra. Gör alltid samma sak på båda sidor.` };
    }
    // 4z + z + 3 = 10 + 2z + 8
    const p1 = R.int(2, 5), p2 = R.int(1, 3), k1 = R.int(1, 9), q1 = R.int(1, 3), k2 = R.int(1, 9);
    const lhsCoef = p1 + p2, rhsCoef = q1; const xx = R.int(2, 9); const rhsConst = (lhsCoef - rhsCoef) * xx + k1; // ensure integer solution
    const k2b = rhsConst - k2;
    return { type: 'num', text: `Lös ekvationen ${m(`${p1}${v} + ${p2}${v} + ${k1} = ${k2}${T.signed(q1, v)}${T.signed(k2b)}`)}`, answer: xx, level, variable: v,
      steps: [`Förenkla båda sidor först: V.L. ${m(`${lhsCoef}${v} + ${k1}`)}, H.L. ${m(`${T.lin(q1, rhsConst, v)}`)}`, `Ta bort ${m(T.term(q1, v))} från båda sidor: ${m(`${T.term(lhsCoef - q1, v)} + ${k1} = ${rhsConst}`)}`, `Ta bort ${k1}: ${m(`${T.term(lhsCoef - q1, v)} = ${rhsConst - k1}`)}`, `Dela med ${lhsCoef - q1}: ${m(`${v} = ${xx}`)}`, vlhl(`${p1} · ${xx} + ${p2} · ${xx} + ${k1}`, `${lhsCoef * xx + k1}`, xx)],
      hint: 'Förenkla varje sida för sig först (slå ihop lika termer). Samla sedan variablerna på en sida.' };
  }
  // level 3: ekvationer med parenteser (§2.6)
  const variant = R.int(1, 3);
  if (variant === 1) {
    // 11 = 9a − (5a + 1)
    const c = R.int(1, 4), a = c + R.int(2, 6), k = R.int(1, 6), x = R.int(2, 9); const lhs = (a - c) * x - k;
    return { type: 'num', text: `Lös ekvationen ${m(`${T.n(lhs)} = ${a}${v} − (${c}${v} + ${k})`)}`, answer: x, level, variable: v,
      steps: [`Minus framför parentesen – byt tecken inuti: ${m(`${T.n(lhs)} = ${a}${v} − ${c}${v} − ${k}`)}`, `Förenkla H.L.: ${m(`${T.n(lhs)} = ${T.term(a - c, v)} − ${k}`)}`, `Lägg till ${k} på båda sidor: ${m(`${lhs + k} = ${T.term(a - c, v)}`)}`, `Dela med ${a - c}: ${m(`${v} = ${x}`)}`, vlhl(`${a} · ${x} − (${c} · ${x} + ${k})`, `${a * x} − ${c * x + k} = ${T.n(lhs)}`, x)],
      hint: 'Ta bort parentesen först (byt tecken eftersom det står minus framför), förenkla sedan.' };
  }
  if (variant === 2) {
    // 5b − (2 + 3b) + 3 = 17
    const c = R.int(1, 4), a = c + R.int(1, 5), k = R.int(1, 5), e = R.int(1, 6), x = R.int(2, 9); const rhs = (a - c) * x - k + e;
    return { type: 'num', text: `Lös ekvationen ${m(`${a}${v} − (${k} + ${c}${v}) + ${e} = ${rhs}`)}`, answer: x, level, variable: v,
      steps: [`Byt tecken i parentesen: ${m(`${a}${v} − ${k} − ${c}${v} + ${e} = ${rhs}`)}`, `Förenkla V.L.: ${m(`${T.term(a - c, v)}${T.signed(e - k)} = ${rhs}`)}`, `Flytta talet: ${m(`${T.term(a - c, v)} = ${rhs - (e - k)}`)}`, `Dela med ${a - c}: ${m(`${v} = ${x}`)}`, vlhl(`${a} · ${x} − (${k} + ${c} · ${x}) + ${e}`, `${a * x} − ${k + c * x} + ${e} = ${rhs}`, x)],
      hint: 'Parentesen har minus framför: båda termerna inuti byter tecken.' };
  }
  // 4(x − 3) = 46 − 6(3 + x)
  const a = R.int(2, 5), b = R.int(1, 5), d = R.int(2, 6), e = R.int(1, 5), x = R.int(2, 8); const k = a * (x - b) + d * (e + x);
  return { type: 'num', text: `Lös ekvationen ${m(`${a}(${v} − ${b}) = ${k} − ${d}(${e} + ${v})`)}`, answer: x, level, variable: v,
    steps: [`Multiplicera in på båda sidor: ${m(`${a}${v} − ${a * b} = ${k} − ${d * e} − ${d}${v}`)}`, `Förenkla H.L.: ${m(`${a}${v} − ${a * b} = ${k - d * e} − ${d}${v}`)}`, `Lägg till ${m(`${d}${v}`)} på båda sidor: ${m(`${a + d}${v} − ${a * b} = ${k - d * e}`)}`, `Lägg till ${a * b}: ${m(`${a + d}${v} = ${k - d * e + a * b}`)}`, `Dela med ${a + d}: ${m(`${v} = ${x}`)}`, vlhl(`${a}(${x} − ${b})`, `${a * (x - b)}`, x) + `, H.L. = ${m(`${k} − ${d}(${e} + ${x}) = ${k} − ${d * (e + x)} = ${a * (x - b)}`)}`],
    hint: 'Multiplicera in i båda parenteserna först. Samla sedan variablerna på en sida.' };
}

// A6: problemlösning med ekvationer (§2.7) – "Antag att talet är x"
function genProblemEkv(level) {
  const n1 = R.pick(NAMES); let n2 = R.pick(NAMES); while (n2 === n1) n2 = R.pick(NAMES);
  const variant = level === 1 ? R.pick(['tal', 'tal2']) : level === 2 ? R.pick(['askar', 'alder', 'rektangel']) : R.pick(['procent', 'tvatal', 'biljetter']);
  switch (variant) {
    case 'tal': { const a = R.int(2, 9), x = R.int(2, 12), b = R.int(1, 20); const r = a * x - b; return { type: 'num', text: `Ett tal multipliceras med ${a}. Sedan subtraherar vi ${b} och får ${r}. Vilket är talet?`, answer: x, level, steps: [`Antag att talet är ${m('x')}.`, `Ekvation: ${m(`${a}x − ${b} = ${r}`)}`, `${m(`${a}x = ${r} + ${b} = ${a * x}`)}`, `${m(`x = ${x}`)}`, `Kontroll: ${m(`${a} · ${x} − ${b} = ${r}`)} ✓`], hint: 'Kalla talet x och skriv upp vad som händer med det som en ekvation.' }; }
    case 'tal2': { const a = R.int(2, 6), x = R.int(3, 15), b = R.int(2, 25); const r = a * (x + b); return { type: 'num', text: `${n1} tänker på ett tal, adderar ${b} och multiplicerar summan med ${a}. Resultatet blir ${r}. Vilket tal tänkte ${n1} på?`, answer: x, level, steps: [`Antag att talet är ${m('x')}. Ekvation: ${m(`${a}(x + ${b}) = ${r}`)}`, `Dela med ${a}: ${m(`x + ${b} = ${r / a}`)}`, `${m(`x = ${r / a} − ${b} = ${x}`)}`, `Kontroll: ${m(`${a}(${x} + ${b}) = ${a} · ${x + b} = ${r}`)} ✓`], hint: '"Adderar och sedan multiplicerar summan" = parentes: a(x + b).' }; }
    case 'askar': { const x = R.int(5, 30), k = R.int(2, 4), extra = R.int(1, 9); const total = x + k * x + extra; return { type: 'num', text: `I ask A finns ${m('x')} stickor. I ask B finns ${k} gånger så många. Dessutom ligger ${extra} stickor på bordet. Sammanlagt är det ${total} stickor. Hur många stickor finns i ask A?`, answer: x, level, steps: [`Ask A: ${m('x')}, ask B: ${m(`${k}x`)}, bordet: ${extra}.`, `Ekvation: ${m(`x + ${k}x + ${extra} = ${total}`)}`, `${m(`${k + 1}x + ${extra} = ${total}`)} → ${m(`${k + 1}x = ${total - extra}`)}`, `${m(`x = ${x}`)}`, `Kontroll: ${m(`${x} + ${k * x} + ${extra} = ${total}`)} ✓`], hint: 'Skriv ett uttryck för varje ask, lägg ihop allt och sätt lika med totalen.' }; }
    case 'alder': { const x = R.int(8, 16), d = R.int(2, 6), k = 2; const total = x + k * x + d; return { type: 'num', text: `${n2} är ${k === 2 ? 'dubbelt' : k + ' gånger'} så gammal som ${n1}, plus ${d} år. Tillsammans är de ${total} år. Hur gammal är ${n1}?`, answer: x, level, steps: [`Antag att ${n1} är ${m('x')} år. Då är ${n2} ${m(`${k}x + ${d}`)} år.`, `Ekvation: ${m(`x + ${k}x + ${d} = ${total}`)}`, `${m(`${k + 1}x = ${total - d}`)} → ${m(`x = ${x}`)}`, `Kontroll: ${m(`${x} + (${k} · ${x} + ${d}) = ${total}`)} ✓`], hint: `Kalla ${n1}s ålder x och skriv ${n2}s ålder med x.` }; }
    case 'rektangel': { const x = R.int(3, 12), d = R.int(1, 8); const omk = 2 * x + 2 * (x + d); return { type: 'num', text: `En rektangel har bredden ${m('x')} cm och längden ${m(`x + ${d}`)} cm. Omkretsen är ${omk} cm. Hur bred är rektangeln?`, answer: x, level, steps: [`Omkrets = alla sidor: ${m(`x + (x + ${d}) + x + (x + ${d}) = ${omk}`)}`, `Förenkla: ${m(`4x + ${2 * d} = ${omk}`)}`, `${m(`4x = ${omk - 2 * d}`)} → ${m(`x = ${x}`)}`, `Kontroll: ${m(`2 · ${x} + 2 · ${x + d} = ${omk}`)} ✓`], hint: 'Teckna omkretsen med x, förenkla, sätt lika med omkretsen.' }; }
    case 'procent': { const pct = R.pick([10, 20, 25, 30, 40, 50]), x = R.int(5, 30) * 20; const part = pct / 100 * x; return { type: 'num', text: `${pct} % av eleverna på en skola spelar fotboll. Det är ${part} elever. Hur många elever går på skolan?`, answer: x, level, steps: [`Antag att skolan har ${m('x')} elever. ${pct} % = ${m(String(pct / 100).replace('.', ','))}`, `Ekvation: ${m(`${String(pct / 100).replace('.', ',')}x = ${part}`)}`, `Dela med ${String(pct / 100).replace('.', ',')}: ${m(`x = ${x}`)}`, `Kontroll: ${m(`${String(pct / 100).replace('.', ',')} · ${x} = ${part}`)} ✓`], hint: `Skriv procenten som decimaltal (${pct} % = ${String(pct / 100).replace('.', ',')}) och sätt upp ekvationen.` }; }
    case 'tvatal': { const x = R.int(5, 30), k = R.int(2, 4), a = R.int(10, 60); const b = k * x - (x + a); const sign = b >= 0 ? '−' : '+'; return { type: 'num', text: `Två tal. Det större talet är ${k} gånger så stort som det mindre. Om du adderar ${a} till det mindre talet får du samma sak som om du ${b >= 0 ? 'subtraherar ' + b + ' från' : 'adderar ' + (-b) + ' till'} det större. Vilket är det mindre talet?`, answer: x, level, steps: [`Antag att det mindre talet är ${m('x')}. Det större är ${m(`${k}x`)}.`, `Ekvation: ${m(`x + ${a} = ${k}x ${sign} ${Math.abs(b)}`)}`, `Ta bort ${m('x')} från båda sidor: ${m(`${a} = ${k - 1}x ${sign} ${Math.abs(b)}`)}`, `${m(`${a + b} = ${k - 1}x`)} → ${m(`x = ${x}`)}`, `Kontroll: ${m(`${x} + ${a} = ${x + a}`)} och ${m(`${k} · ${x} ${sign} ${Math.abs(b)} = ${x + a}`)} ✓`], hint: 'Kalla det mindre talet x. Det större blir då k · x. Sätt de två uttrycken lika.' }; }
    default: { const p = R.int(20, 90), x = R.int(2, 9), extra = R.int(10, 60); const total = p * x + extra; return { type: 'num', text: `${n1} köper biljetter för ${p} kr styck och betalar dessutom ${extra} kr i avgift. Totalt betalar ${n1} ${total} kr. Hur många biljetter köpte ${n1}?`, answer: x, level, steps: [`Antag ${m('x')} biljetter. Ekvation: ${m(`${p}x + ${extra} = ${total}`)}`, `${m(`${p}x = ${total - extra}`)}`, `${m(`x = ${x}`)}`, `Kontroll: ${m(`${p} · ${x} + ${extra} = ${total}`)} ✓`], hint: 'Pris gånger antal plus avgiften = totalen.' }; }
  }
}

// A7: enkla andragradsekvationer (§2.8) – x² = 25 har två lösningar
function genAndragrad(level) {
  const x = R.int(2, level === 1 ? 10 : 12);
  if (level === 1) {
    return { type: 'num', text: `Lös ekvationen ${m(`x² = ${x * x}`)}. Ekvationen har två lösningar – skriv den <b>positiva</b>.`, answer: x, level,
      steps: [`Vilket tal gånger sig självt blir ${x * x}? ${m(`${x} · ${x} = ${x * x}`)}`, `Men även ${m(`(−${x}) · (−${x}) = ${x * x}`)}!`, `Lösningar: ${m(`x = ${x}`)} eller ${m(`x = −${x}`)} (skrivs ${m(`x = ±${x}`)})`],
      hint: 'Dra kvadratroten ur båda sidor. Glöm inte att det finns en negativ lösning också.' };
  }
  if (level === 2) {
    const k = R.int(1, 30);
    const variant = R.int(1, 2);
    if (variant === 1) return { type: 'num', text: `Lös ekvationen ${m(`x² − ${k} = ${x * x - k}`)}. Skriv den positiva lösningen.`, answer: x, level, steps: [`Lägg till ${k} på båda sidor: ${m(`x² = ${x * x}`)}`, `${m(`x = ±${x}`)}`, `Kontroll: ${m(`${x}² − ${k} = ${x * x - k}`)} ✓`], hint: 'Få x² ensamt först, dra sedan roten ur.' };
    const a = R.int(2, 5); return { type: 'num', text: `Lös ekvationen ${m(`${a}x² = ${a * x * x}`)}. Skriv den positiva lösningen.`, answer: x, level, steps: [`Dela båda sidor med ${a}: ${m(`x² = ${x * x}`)}`, `${m(`x = ±${x}`)}`, `Kontroll: ${m(`${a} · ${x}² = ${a} · ${x * x} = ${a * x * x}`)} ✓`], hint: 'Dela med talet framför x² först.' };
  }
  const a = R.int(2, 4), k = R.int(1, 20);
  return { type: 'num', text: `Lös ekvationen ${m(`${a}x² + ${k} = ${a * x * x + k}`)}. Skriv den positiva lösningen.`, answer: x, level,
    steps: [`Ta bort ${k}: ${m(`${a}x² = ${a * x * x}`)}`, `Dela med ${a}: ${m(`x² = ${x * x}`)}`, `${m(`x = ±${x}`)}`, `Kontroll: ${m(`${a} · ${x * x} + ${k} = ${a * x * x + k}`)} ✓`],
    hint: 'Samma ordning som vanliga ekvationer: ta bort talet, dela med talet framför x², dra roten ur.' };
}

/* ---------------- ÅK 4 ---------------- */
function genMult(level) {
  let a, b;
  if (level === 1) { a = R.int(2, 5); b = R.int(2, 10); }
  else if (level === 2) { a = R.int(6, 9); b = R.int(3, 10); }
  else { const kind = R.int(1, 3); if (kind === 1) { a = R.int(11, 12); b = R.int(3, 12); } else if (kind === 2) { a = R.int(2, 9); b = R.int(2, 9) * 10; } else { a = R.int(2, 9); b = R.int(2, 9) * 100; } }
  if (R.chance(0.5)) [a, b] = [b, a];
  const ans = a * b;
  const steps = [];
  if (b >= 10 && b % 10 === 0 && b <= 900) { const base = b / (b >= 100 ? 100 : 10); steps.push(`${m(`${a} · ${base} = ${a * base}`)}`, `Lägg på ${b >= 100 ? 'två nollor' : 'en nolla'}: ${m(`${a} · ${b} = ${ans}`)}`); }
  else if (a === 11 || b === 11) { const o = a === 11 ? b : a; steps.push(`${m(`11 · ${o} = 10 · ${o} + ${o} = ${10 * o} + ${o} = ${ans}`)}`); }
  else if (a === 12 || b === 12) { const o = a === 12 ? b : a; steps.push(`${m(`12 · ${o} = 10 · ${o} + 2 · ${o} = ${10 * o} + ${2 * o} = ${ans}`)}`); }
  else { const small = Math.min(a, b), big = Math.max(a, b); steps.push(`${m(`${small} · ${big}`)} är ${small} stycken ${big}:or.`, `${m(Array(small).fill(big).join(' + ') + ' = ' + ans)}`); if (big === 9) steps.push(`Knep för 9:an: ${m(`10 · ${small} − ${small} = ${ans}`)}`); }
  return { type: 'num', text: `${m(`${a} · ${b}`)} = ?`, answer: ans, level, steps, hint: level === 3 ? 'Dela upp: räkna med tiotal först.' : 'Tänk på tabellen – eller räkna med upprepad addition.', choices: level === 1 ? T.choices(ans, 4, Math.max(a, b)) : undefined };
}
function genDiv(level) {
  let b, q;
  if (level === 1) { b = R.int(2, 5); q = R.int(2, 10); }
  else if (level === 2) { b = R.int(6, 9); q = R.int(2, 10); }
  else { b = R.int(2, 9); q = R.int(2, 9) * 10; }
  const a = b * q;
  return { type: 'num', text: `${m(`${a} / ${b}`)} = ?`, answer: q, level,
    steps: [`Fråga: "${b} gånger <b>vad</b> blir ${a}?"`, `${m(`${b} · ${q} = ${a}`)}, så ${m(`${a} / ${b} = ${q}`)}`],
    hint: `Tänk baklänges: ${b} gånger något = ${a}.`, choices: level === 1 ? T.choices(q, 4, 3) : undefined };
}
function genAddSub(level) {
  const add = R.chance(0.5);
  let a, b;
  if (level === 1) { a = R.int(20, 99); b = R.int(10, 99); }
  else if (level === 2) { a = R.int(100, 999); b = R.int(10, 999); }
  else { a = R.int(1000, 9999); b = R.int(100, 9999); }
  if (!add && b > a) [a, b] = [b, a];
  const ans = add ? a + b : a - b;
  const steps = add
    ? [`Dela upp det andra talet: ${m(`${a} + ${b}`)}`, ...(b >= 100 ? [`${m(`${a} + ${Math.floor(b / 100) * 100} = ${a + Math.floor(b / 100) * 100}`)}`] : []), `${m(`${a + Math.floor(b / 100) * 100} + ${Math.floor((b % 100) / 10) * 10} = ${a + Math.floor(b / 100) * 100 + Math.floor((b % 100) / 10) * 10}`)}`, `${m(`${a + Math.floor(b / 100) * 100 + Math.floor((b % 100) / 10) * 10} + ${b % 10} = ${ans}`)}`]
    : [`Dela upp det du tar bort: ${m(`${a} − ${b}`)}`, ...(b >= 100 ? [`${m(`${a} − ${Math.floor(b / 100) * 100} = ${a - Math.floor(b / 100) * 100}`)}`] : []), `${m(`${a - Math.floor(b / 100) * 100} − ${Math.floor((b % 100) / 10) * 10} = ${a - Math.floor(b / 100) * 100 - Math.floor((b % 100) / 10) * 10}`)}`, `${m(`${a - Math.floor(b / 100) * 100 - Math.floor((b % 100) / 10) * 10} − ${b % 10} = ${ans}`)}`];
  return { type: 'num', text: `${m(`${a} ${add ? '+' : '−'} ${b}`)} = ?`, answer: ans, level, steps, hint: add ? 'Lägg till hundratal, sedan tiotal, sedan ental.' : 'Ta bort hundratal, sedan tiotal, sedan ental.' };
}
function genProblem(level) {
  const n1 = R.pick(NAMES);
  const variants = level === 1 ? ['kop', 'dela'] : level === 2 ? ['kop2', 'kvar', 'tid'] : ['tva', 'kvar2', 'genomsnitt'];
  const vnt = R.pick(variants);
  switch (vnt) {
    case 'kop': { const p = R.int(5, 25), k = R.int(2, 6); return { type: 'num', text: `En påse popcorn kostar ${p} kr. ${n1} köper ${k} påsar. Hur mycket kostar det?`, answer: p * k, level, steps: [`${k} påsar à ${p} kr: ${m(`${k} · ${p} = ${p * k}`)} kr`], hint: 'Antal gånger priset.' }; }
    case 'dela': { const k = R.int(3, 6), per = R.int(3, 9); return { type: 'num', text: `${k} kompisar delar lika på ${k * per} kulor. Hur många får var och en?`, answer: per, level, steps: [`${m(`${k * per} / ${k} = ${per}`)}`], hint: 'Dela totalen med antalet kompisar.' }; }
    case 'kop2': { const p = R.int(12, 45), k = R.int(3, 6), extra = R.int(5, 30); return { type: 'num', text: `${n1} köper ${k} biobiljetter för ${p} kr styck och en popcorn för ${extra} kr. Hur mycket betalar ${n1} totalt?`, answer: p * k + extra, level, steps: [`Biljetter: ${m(`${k} · ${p} = ${p * k}`)} kr`, `Plus popcorn: ${m(`${p * k} + ${extra} = ${p * k + extra}`)} kr`], hint: 'Räkna biljetterna först, lägg sedan till popcornen.' }; }
    case 'kvar': { const start = R.int(100, 500), spend = R.int(20, 90); return { type: 'num', text: `${n1} har ${start} kr och köper en bok för ${spend} kr. Hur mycket har ${n1} kvar?`, answer: start - spend, level, steps: [`${m(`${start} − ${spend} = ${start - spend}`)} kr`], hint: 'Kvar = det du hade minus det du betalade.' }; }
    case 'tid': { const start = R.int(8, 11), mins = R.pick([15, 30, 45]), dur = R.pick([40, 50, 75, 90]); const total = start * 60 + mins + dur; const h = Math.floor(total / 60), mm = total % 60; return { type: 'text', text: `Filmen börjar ${start}:${String(mins).padStart(2, '0')} och är ${dur} minuter lång. När slutar den? (svara t.ex. 10:35)`, answer: [`${h}:${String(mm).padStart(2, '0')}`, `${h}.${String(mm).padStart(2, '0')}`, `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`], display: `${h}:${String(mm).padStart(2, '0')}`, level, steps: [`${dur} minuter = ${Math.floor(dur / 60)} timme och ${dur % 60} minuter.`, `${start}:${String(mins).padStart(2, '0')} + ${dur} min = ${h}:${String(mm).padStart(2, '0')}`], hint: 'Dela upp minuterna: först hela timmar, sedan resten.' }; }
    case 'tva': { const a = R.int(3, 8), pa = R.int(10, 30), b = R.int(2, 6), pb = R.int(5, 20); return { type: 'num', text: `${n1} köper ${a} pennor för ${pa} kr styck och ${b} suddgummin för ${pb} kr styck. Vad kostar allt?`, answer: a * pa + b * pb, level, steps: [`Pennor: ${m(`${a} · ${pa} = ${a * pa}`)}`, `Suddgummin: ${m(`${b} · ${pb} = ${b * pb}`)}`, `Totalt: ${m(`${a * pa} + ${b * pb} = ${a * pa + b * pb}`)} kr`], hint: 'Räkna varje sort för sig, lägg sedan ihop.' }; }
    case 'kvar2': { const have = R.int(200, 600), p = R.int(15, 40), k = R.int(3, 8); return { type: 'num', text: `${n1} har ${have} kr och köper ${k} glassar för ${p} kr styck. Hur mycket har ${n1} kvar?`, answer: have - p * k, level, steps: [`Glassarna kostar ${m(`${k} · ${p} = ${p * k}`)} kr`, `Kvar: ${m(`${have} − ${p * k} = ${have - p * k}`)} kr`], hint: 'Räkna först ut vad glassarna kostar.' }; }
    default: { const k = R.int(3, 5), avg = R.int(5, 20); const vals = []; let sum = 0; for (let i = 0; i < k - 1; i++) { const x = avg + R.int(-3, 3); vals.push(x); sum += x; } vals.push(avg * k - sum); return { type: 'num', text: `${n1} fick ${vals.join(', ')} poäng på ${k} prov. Hur många poäng fick ${n1} <b>sammanlagt</b>?`, answer: avg * k, level, steps: [`${m(vals.join(' + ') + ' = ' + avg * k)}`], hint: 'Lägg ihop alla poäng.' }; }
  }
}

/* ---------------- ÅK 2 ---------------- */
function genPlus20(level) {
  let a, b;
  if (level === 1) { a = R.int(1, 9); b = R.int(1, 10 - a); }
  else if (level === 2) { a = R.int(2, 9); b = R.int(11 - a, 9); } // tiotalsövergång
  else { a = R.int(5, 15); b = R.int(2, 20 - a); }
  const ans = a + b;
  const steps = ans > 10 && a < 10 && b < 10 ? [`Fyll upp till 10 först: ${m(`${a} + ${10 - a} = 10`)}`, `Sedan resten: ${m(`10 + ${b - (10 - a)} = ${ans}`)}`] : [`${m(`${a} + ${b} = ${ans}`)}`];
  return { type: 'num', text: `${m(`${a} + ${b}`)} = ?`, answer: ans, level, steps, hint: ans > 10 ? 'Räkna först upp till 10.' : 'Räkna på fingrarna om du vill!', choices: T.choices(ans, 4, 2) };
}
function genMinus20(level) {
  let a, b;
  if (level === 1) { a = R.int(2, 10); b = R.int(1, a - 1); }
  else if (level === 2) { a = R.int(11, 18); b = R.int(a - 9, 9); } // över tiotalet
  else { a = R.int(11, 20); b = R.int(2, a - 1); }
  const ans = a - b;
  const steps = a > 10 && ans < 10 ? [`Ta bort ner till 10 först: ${m(`${a} − ${a - 10} = 10`)}`, `Ta bort resten: ${m(`10 − ${b - (a - 10)} = ${ans}`)}`] : [`${m(`${a} − ${b} = ${ans}`)}`];
  return { type: 'num', text: `${m(`${a} − ${b}`)} = ?`, answer: ans, level, steps, hint: 'Räkna ner till 10 först.', choices: T.choices(ans, 4, 2) };
}
function genTal100(level) {
  const add = R.chance(0.5); let a, b;
  if (level === 1) { a = R.int(1, 9) * 10; b = R.int(1, 9) * 10; }
  else if (level === 2) { a = R.int(21, 89); b = R.int(1, 9); }
  else { a = R.int(21, 89); b = R.int(10, 99); }
  if (add && a + b > 100) { b = 100 - a; if (b <= 0) b = 10; }
  if (!add && b > a) [a, b] = [b, a];
  const ans = add ? a + b : a - b;
  const steps = level === 1 ? [`Tänk i tiotal: ${a / 10} ${add ? '+' : '−'} ${b / 10} = ${ans / 10}, alltså ${m(ans)}`] : level === 2 ? [`${m(`${a} ${add ? '+' : '−'} ${b} = ${ans}`)}`] : [`Tiotalen först: ${m(`${a} ${add ? '+' : '−'} ${Math.floor(b / 10) * 10} = ${add ? a + Math.floor(b / 10) * 10 : a - Math.floor(b / 10) * 10}`)}`, `Sedan entalen: ${m(`${add ? a + Math.floor(b / 10) * 10 : a - Math.floor(b / 10) * 10} ${add ? '+' : '−'} ${b % 10} = ${ans}`)}`];
  return { type: 'num', text: `${m(`${a} ${add ? '+' : '−'} ${b}`)} = ?`, answer: ans, level, steps, hint: 'Räkna tiotalen först, sedan entalen.', choices: level < 3 ? T.choices(ans, 4, 10) : undefined };
}
function genDubbelt(level) {
  const half = R.chance(0.5);
  const base = level === 1 ? R.int(1, 10) : level === 2 ? R.int(5, 25) : R.int(10, 50);
  if (half) { const n = base * 2; return { type: 'num', text: `Hälften av ${m(n)} är?`, answer: base, level, steps: [`Hälften = dela i två lika delar.`, `${m(`${base} + ${base} = ${n}`)}, så hälften av ${n} är ${m(base)}`], hint: 'Vilket tal plus sig självt blir detta?', choices: T.choices(base, 4, 2) }; }
  return { type: 'num', text: `Dubbelt så mycket som ${m(base)} är?`, answer: base * 2, level, steps: [`Dubbelt = samma tal en gång till.`, `${m(`${base} + ${base} = ${base * 2}`)}`], hint: 'Lägg ihop talet med sig självt.', choices: T.choices(base * 2, 4, 2) };
}
function genTabell(level) {
  const table = level === 1 ? R.pick([2, 10]) : level === 2 ? R.pick([2, 5, 10]) : R.pick([2, 3, 4, 5, 10]);
  const k = R.int(1, 10);
  const ans = table * k;
  const steps = [`${m(`${k} · ${table}`)} betyder ${k} stycken ${table}:or.`, `${m(Array(k).fill(table).join(' + ') + ' = ' + ans)}`];
  if (table === 10) steps.push('Tians tabell: sätt en nolla efter talet!');
  if (table === 5) steps.push('Femmans tabell: slutar alltid på 5 eller 0.');
  return { type: 'num', text: `${m(`${k} · ${table}`)} = ?`, answer: ans, level, steps, hint: `Hoppa ${table} i taget: ${Array.from({ length: Math.min(k, 4) }, (_, i) => table * (i + 1)).join(', ')} …`, choices: T.choices(ans, 4, table) };
}
function genSaknas(level) {
  const add = R.chance(0.6);
  let a, b, total;
  if (level === 1) { total = R.int(5, 10); a = R.int(1, total - 1); b = total - a; }
  else if (level === 2) { total = R.int(11, 20); a = R.int(2, total - 2); b = total - a; }
  else { total = R.int(20, 100); a = R.int(5, total - 5); b = total - a; }
  if (add) return { type: 'num', text: `${m(`${a} + ▢ = ${total}`)} Vilket tal ska stå i rutan?`, answer: b, level, steps: [`Hur mycket fattas från ${a} upp till ${total}?`, `${m(`${total} − ${a} = ${b}`)}`], hint: `Räkna uppåt från ${a} tills du kommer till ${total}.`, choices: T.choices(b, 4, 2) };
  return { type: 'num', text: `${m(`${total} − ▢ = ${a}`)} Vilket tal ska stå i rutan?`, answer: b, level, steps: [`Hur mycket tog vi bort från ${total} för att hamna på ${a}?`, `${m(`${total} − ${a} = ${b}`)}`], hint: `Skillnaden mellan ${total} och ${a}.`, choices: T.choices(b, 4, 2) };
}

/* ---------------- Skill catalogue ---------------- */
const METHOD = {
  multin: `<p>När ett tal står utanför en parentes ska det multipliceras med <b>varje</b> term inuti. Rita gärna pilar från talet till varje term.</p>
<p class="ex">${m('3(2x + 5) = 3 · 2x + 3 · 5 = 6x + 15')}</p>
<p>Tecknen är det vanligaste felet. Negativt tal utanför byter tecken på allt inuti:</p>
<p class="ex">${m('−2(x − 4) = −2x + 8')}</p>
<p>Står x utanför blir ${m('x · x = x²')}:</p>
<p class="ex">${m('x(3x + 2) = 3x² + 2x')}</p>`,
  forenkla: `<p>Två steg, alltid i samma ordning:</p>
<ol><li>Multiplicera in i alla parenteser.</li><li>Samla lika termer: x-termer för sig, tal för sig (och x² för sig).</li></ol>
<p class="ex">${m('2(x + 3) + 4x − 1 = 2x + 6 + 4x − 1 = 6x + 5')}</p>
<p>Ett minustecken framför en parentes byter tecken på <b>alla</b> termer inuti:</p>
<p class="ex">${m('7x − (3x − 2) = 7x − 3x + 2 = 4x + 2')}</p>`,
  blandat: `<p><b>Värdet av ett uttryck:</b> byt ut bokstaven mot talet och räkna. Parenteser först, sedan gånger, sedan plus och minus.</p>
<p class="ex">${m('3x + 2 när x = 4: 3 · 4 + 2 = 14')}</p>
<p><b>Skriva uttryck från text:</b> "3 mer än x" = ${m('x + 3')}, "dubbelt så mycket som x" = ${m('2x')}, "tillsammans" = lägg ihop.</p>
<p><b>Omkrets</b> = alla sidor ihop. <b>Area</b> = sida · sida.</p>
<p class="ex">Sidor x och x + 2: omkrets ${m('4x + 4')}, area ${m('x² + 2x')}</p>`,
  talfoljd: `<p>I en talföljd där det ökar lika mycket varje gång är <b>skillnaden</b> talet framför n.</p>
<p class="ex">4, 7, 10, 13 … ökar med 3 → formeln börjar ${m('3n')}</p>
<p>${m('3 · 1 = 3')}, men första talet är 4. Så vi behöver +1:</p>
<p class="ex">Tal nummer n: ${m('3n + 1')}. Kontroll: n = 2 ger 3 · 2 + 1 = 7 ✓</p>
<p>Tal nummer 100? Sätt in n = 100: ${m('3 · 100 + 1 = 301')}</p>`,
  ekvation: `<p>En ekvation är en likhet med ett obekant tal. Lös den genom att göra <b>samma sak på båda sidor</b> tills x står ensamt.</p>
<ol><li>Ta bort parenteser (minus framför = byt tecken).</li><li>Förenkla varje sida.</li><li>Samla x-termerna på en sida och talen på den andra.</li><li>Dela med talet framför x.</li><li><b>Kontrollera</b>: räkna ut V.L. och H.L. med ditt x – de ska bli lika.</li></ol>
<p class="ex">${m('4x − 15 = 49 → 4x = 64 → x = 16')}. Kontroll: V.L. = 4 · 16 − 15 = 49 = H.L. ✓</p>
<p class="ex">${m('11 = 9a − (5a + 1) → 11 = 4a − 1 → 12 = 4a → a = 3')}</p>`,
  problemekv: `<p>Så här löser du textuppgifter med ekvation:</p>
<ol><li><b>Antag</b> att det du söker är ${m('x')}. Skriv upp det!</li><li>Skriv de andra sakerna med hjälp av x ("dubbelt så många" = 2x, "3 fler" = x + 3).</li><li>Ställ upp ekvationen utifrån texten.</li><li>Lös den.</li><li>Kontrollera mot texten och svara med ord.</li></ol>
<p class="ex">"Ett tal multipliceras med 6, sedan subtraherar vi 9 och får 15." Antag talet x: ${m('6x − 9 = 15 → 6x = 24 → x = 4')}. Svar: Talet är 4.</p>
<p class="ex">"30 % av eleverna är 156 elever. Hur många går på skolan?" ${m('0,3x = 156 → x = 520')}</p>`,
  andragrad: `<p>En <b>andragradsekvation</b> har ${m('x²')}. De enkla löser du genom att få ${m('x²')} ensamt och dra kvadratroten ur.</p>
<p class="ex">${m('x² = 25 → x = 5 eller x = −5')}, eftersom både ${m('5 · 5')} och ${m('(−5) · (−5)')} blir 25. Skrivs ${m('x = ±5')}.</p>
<p>Två lösningar – glöm aldrig den negativa!</p>
<p class="ex">${m('2x² + 3 = 53 → 2x² = 50 → x² = 25 → x = ±5')}</p>`,
  mult: `<p>Multiplikation är upprepad addition: ${m('4 · 6 = 6 + 6 + 6 + 6 = 24')}.</p><p>Knep: 9:ans tabell = 10 gånger talet minus talet. 11 · 7 = 70 + 7. Med nollor: räkna utan nollan och sätt tillbaka den sedan: ${m('6 · 40 = 240')}.</p>`,
  div: `<p>Division är multiplikation baklänges. ${m('56 / 8')}: "8 gånger vad blir 56?" – 7!</p><p>Kan du tabellen kan du divisionen.</p>`,
  addsub: `<p>Dela upp talet du lägger till eller tar bort: hundratal, tiotal, ental – i tur och ordning.</p><p class="ex">${m('347 + 285: 347 + 200 = 547, + 80 = 627, + 5 = 632')}</p>`,
  problem: `<p>Läs frågan två gånger. Fråga dig: vad vet jag? Vad frågas det efter? Räkna ett steg i taget och skriv ner delsvaren.</p>`,
  plus20: `<p>Är summan mer än 10? Fyll upp till 10 först. ${m('7 + 5 = 7 + 3 + 2 = 12')}</p>`,
  minus20: `<p>Gå ner till 10 först. ${m('14 − 6 = 14 − 4 − 2 = 8')}</p>`,
  tal100: `<p>Tiotal först, sedan ental. ${m('43 + 25 = 43 + 20 + 5 = 68')}</p>`,
  dubbelt: `<p>Dubbelt = talet två gånger. Hälften = dela i två lika delar. ${m('Dubbelt så mycket som 7 är 14. Hälften av 14 är 7.')}</p>`,
  tabell: `<p>Tvåans tabell: alla jämna tal. Femmans: slutar på 5 eller 0. Tians: sätt en nolla efter.</p>`,
  saknas: `<p>Tänk "hur långt är det från det ena talet till det andra?". ${m('6 + ▢ = 10: från 6 till 10 är det 4.')}</p>`,
};

/* ---------------- Kursmallar (generiska – inga personuppgifter här) ----------------
   Vilka barn som finns, vad de heter och vilken mall de följer ligger i familjens privata konfiguration (FAMILY),
   som laddas från familjens egna molnlagring efter parkoppling. KIDS byggs vid start av buildKids(). */
const TEMPLATES = {
  ak8: { label: 'Åk 8', grade: 'Åk 8', defaults: { focus: true, sprint: 5, timer: false, tts: true, goal: 10 }, decks: ['en8_verb', 'en8_ord', 'es_halsa', 'es_siffror', 'es_farger', 'es_djur', 'es_familj', 'es_mat', 'es_kropp', 'es_skola', 'es_klader', 'es_kanslor', 'es_fraser', 'en_djur', 'en_mat', 'en_hem'],
    skills: [
      { id: 'multin', name: 'Multiplicera in i parenteser', short: 'Parenteser', icon: '✕', gen: genMultIn, method: METHOD.multin, focus: true },
      { id: 'forenkla', name: 'Förenkla uttryck med parenteser', short: 'Förenkla', icon: '≡', gen: genForenkla, method: METHOD.forenkla, focus: true },
      { id: 'blandat', name: 'Blandade uppgifter med uttryck', short: 'Blandat', icon: '⚙', gen: genBlandat, method: METHOD.blandat, focus: true },
      { id: 'talfoljd', name: 'Uttryck och formel för talföljd', short: 'Talföljder', icon: '…', gen: genTalfoljd, method: METHOD.talfoljd, focus: true },
      { id: 'ekvation', name: 'Ekvationer (även med parenteser)', short: 'Ekvationer', icon: '=', gen: genEkvation, method: METHOD.ekvation },
      { id: 'problemekv', name: 'Problemlösning med ekvationer', short: 'Problem', icon: '💬', gen: genProblemEkv, method: METHOD.problemekv },
      { id: 'andragrad', name: 'Enkla andragradsekvationer', short: 'x²', icon: '²', gen: genAndragrad, method: METHOD.andragrad },
    ] },
  ak4: { label: 'Åk 4', grade: 'Åk 4', defaults: { focus: false, sprint: 10, timer: false, tts: true, goal: 10 }, decks: ['en_djur', 'en_mat', 'en_hem', 'en_skola', 'en_vader', 'en_verb', 'en_tid', 'en_fraser', 'es_halsa', 'es_siffror', 'es_farger', 'es_djur', 'es_familj', 'es_mat', 'es_kropp', 'es_skola', 'es_klader', 'es_kanslor', 'es_fraser'],
    skills: [
      { id: 'mult', name: 'Multiplikation', short: 'Gånger', icon: '·', gen: genMult, method: METHOD.mult },
      { id: 'div', name: 'Division', short: 'Delat', icon: '/', gen: genDiv, method: METHOD.div },
      { id: 'addsub', name: 'Plus och minus med stora tal', short: 'Plus & minus', icon: '±', gen: genAddSub, method: METHOD.addsub },
      { id: 'problem', name: 'Problemlösning', short: 'Problem', icon: '?', gen: genProblem, method: METHOD.problem },
    ] },
  ak2: { label: 'Åk 2', grade: 'Åk 2', defaults: { focus: false, sprint: 8, timer: false, tts: true, goal: 8 }, decks: ['es_halsa', 'es_siffror', 'es_farger', 'es_djur', 'es_familj', 'es_mat', 'es_kropp', 'es_skola', 'es_klader', 'es_kanslor', 'es_fraser', 'en_djur', 'en_mat', 'en_hem'],
    skills: [
      { id: 'plus20', name: 'Plus upp till 20', short: 'Plus', icon: '+', gen: genPlus20, method: METHOD.plus20 },
      { id: 'minus20', name: 'Minus upp till 20', short: 'Minus', icon: '−', gen: genMinus20, method: METHOD.minus20 },
      { id: 'tal100', name: 'Räkna till 100', short: 'Till 100', icon: '💯', gen: genTal100, method: METHOD.tal100 },
      { id: 'dubbelt', name: 'Dubbelt och hälften', short: 'Dubbelt', icon: '⇄', gen: genDubbelt, method: METHOD.dubbelt },
      { id: 'tabell', name: 'Tabellerna 2, 5 och 10', short: 'Tabeller', icon: '×', gen: genTabell, method: METHOD.tabell },
      { id: 'saknas', name: 'Vilket tal saknas?', short: 'Saknas', icon: '▢', gen: genSaknas, method: METHOD.saknas },
    ] },
};
// Fylls av buildKids(FAMILY) vid start – tom tills familjen är parkopplad.
const KIDS = [];

if (typeof module !== 'undefined') module.exports = { KIDS, TEMPLATES, m };
