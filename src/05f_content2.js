/* ========= Learning Engine v2 – innehåll för aktiv hämtning (3E) och Utmaning (3H) =========
   Allt är deterministisk rättning – ingen AI bedömer barnets svar.
   RECALL: gör om en flervalsfråga med kort svar till ett eget svar ("skriv svaret"). Godkänner små stavfel bara när svaret ligger
           närmare rätt svar än alla felalternativ, och kärnord (unika för rätt svar) räcker för svar med flera ord.
   CHG:    Utmaningar byggda av befintliga generatorer och faktabanker – djup före fart: hitta felet, kombinera två steg,
           skriv ett eget uttryck/en egen ekvation, ordna lösningssteg, "vilket påstående är FEL?". */
const RECALL = (() => {
  'use strict';
  const strip = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const norm = (s) => strip(s).normalize('NFC').toLowerCase().replace(/[.,!?;:"'”“()[\]…]/g, ' ').replace(/−|–/g, '-').replace(/\s+/g, ' ').trim().replace(/^(en|ett|att|den|det) /, '');
  function lev(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[b.length];
  }
  const tolOf = (w) => (w.length >= 9 ? 2 : w.length >= 5 ? 1 : 0);
  // Frågor som bara går att besvara med alternativen framför sig (välj bland, negation, stavning, jämförelse) görs aldrig om.
  const NEEDS_OPTIONS = /\b(vilket|vilken|vilka)\s+(ord|mening|meningar|tal|bråk|alternativ|påstående|av|figur|bild|två)\b|hitta (ett|en)\b|\binte\b|\bfel\b|stavat|störst|minst|rimmar|stämmer|sant|falskt/i;
  function convert(q) {
    if (!q || q.type !== 'choicetext' || !Array.isArray(q.choices) || typeof q.answer !== 'number') return null;
    const correct = q.choices[q.answer]; if (typeof correct !== 'string') return null;
    if (NEEDS_OPTIONS.test(strip(q.text))) return null;
    // Granskning M5: svar med alternativ eller förklaring ("Natriumklorid, NaCl", "x (y)", "a/b", "a eller b") görs inte om –
    // annars krävdes alla delar och ett rätt svar ("natriumklorid") underkändes.
    if (/[,(/;]|\beller\b/i.test(correct)) return null;
    const c = norm(correct); const words = c.split(' ');
    if (!c || c.length > 28 || words.length > 3) return null;
    const numeric = /^-?\d+([.,]\d+)?$/.test(c);
    if (/\d/.test(c) && !numeric) return null;
    const distract = q.choices.filter((_, i) => i !== q.answer).map(norm);
    if (distract.some(d => d === c || (!numeric && lev(d, c) <= tolOf(c)))) return null;   // alternativen ligger för nära varandra för säker rättning
    const qWords = new Set(norm(q.text).split(' '));
    const dWords = new Set(distract.flatMap(d => d.split(' ')));
    const keys = numeric ? [] : words.filter(w => w.length >= 4 && !qWords.has(w) && !dWords.has(w));
    const dKeys = numeric ? [] : distract.map(d => d.split(' ').filter(w => w.length >= 4 && !qWords.has(w) && !words.includes(w)));
    return { ...q, type: 'recall', choices: undefined, answer: [correct], display: correct, accept: { c, distract, keys, dKeys, numeric }, v2check: 'recall', recallFrom: 'mc',
      hint: q.hint, text: q.text };
  }
  function check(q, raw) {
    const s = norm(raw); if (!s) return { status: 'empty' };
    const A = q.accept; if (!A) return { status: s === norm(q.display) ? 'correct' : 'wrong' };
    if (A.numeric) { const t = s.replace(/\s+/g, ''); if (!/^-?\d+([.,]\d+)?$/.test(t)) return /\d/.test(t) ? { status: 'wrong' } : { status: 'invalid', msg: 'Skriv ett tal.' }; return { status: Math.abs(parseFloat(t.replace(',', '.')) - parseFloat(A.c.replace(',', '.'))) < 1e-9 ? 'correct' : 'wrong' }; }   // granskning M5: hela svaret måste vara ett tal ("7 eller 14" är fel)
    if (s === A.c) return { status: 'correct' };
    const d0 = lev(s, A.c); const dMin = Math.min(Infinity, ...A.distract.map(d => lev(s, d)));
    if (d0 <= tolOf(A.c) && d0 < dMin) return { status: 'correct', note: `Rätt stavat: <b>${q.display.replace(/[<>&]/g, '')}</b>` };
    const sw = s.split(' '); const has = (k) => sw.some(w => lev(w, k) <= tolOf(k));
    if (A.keys.length && A.keys.every(has) && !A.dKeys.some(ks => ks.length && ks.some(has))) return { status: 'correct', note: `Hela svaret: <b>${q.display.replace(/[<>&]/g, '')}</b>` };
    return { status: 'wrong' };
  }
  return { convert, check, norm, lev, strip, NEEDS_OPTIONS };
})();

const CHG = (() => {
  'use strict';
  const P = () => (typeof Poly !== 'undefined' ? Poly : null);
  const plainLen = (q) => RECALL.strip(q.text).replace(/\s+/g, ' ').trim().length;
  const L3 = ['A', 'B', 'C'];
  const disp = (q, ans) => (q.type === 'expr' ? P().format(ans) : typeof T !== 'undefined' ? T.n(ans) : String(ans));
  const sameAns = (q, a, b) => (q.type === 'expr' ? P().equal(a, b) : Math.abs(a - b) < 1e-9);
  // Ett troligt räknefel: ±1/±2 i talet, eller fel konstant/koefficient i uttrycket. Aldrig samma värde som rätt svar.
  function perturb(q, k) {
    if (q.type === 'num') { const d = [1, -1, 2, -2, 10, -10][k % 6]; const w = Number.isInteger(q.answer) ? q.answer + d : Math.round((q.answer + d / 10) * 1000) / 1000; return w === q.answer ? q.answer + 3 : w; }
    const v = q.variable || 'x'; const Pp = P(); const tries = [Pp.add(q.answer, Pp.num(1)), Pp.sub(q.answer, Pp.num(2)), Pp.add(q.answer, Pp.variable(v)), Pp.sub(q.answer, Pp.variable(v))];
    for (let j = 0; j < tries.length; j++) { const w = tries[(k + j) % tries.length]; if (!Pp.equal(w, q.answer)) return w; }
    return Pp.add(q.answer, Pp.num(3));
  }
  function candidates(gen, lvl, n, ok) { const out = []; const seen = new Set(); for (let i = 0; i < n * 6 && out.length < n; i++) { let q; try { q = gen(lvl); } catch (e) { continue; } if (!q || !ok(q)) continue; const key = RECALL.strip(q.text); if (seen.has(key)) continue; seen.add(key); out.push(q); } return out; }
  const isShortNum = (q) => q.type === 'num' && !q.fig && Number.isFinite(q.answer) && plainLen(q) <= 110;
  const isShortExpr = (q) => q.type === 'expr' && !q.fig && q.answer && plainLen(q) <= 110;

  const MATH = {
    // Hitta felet: tre lösta uppgifter, en har ett räknefel
    spot(skill, lvl, k) {
      const qs = candidates(skill.gen, lvl, 3, (q) => isShortNum(q) || isShortExpr(q)); if (qs.length < 3) return null;
      const bad = k % 3; const shown = qs.map((q, i) => (i === bad ? perturb(q, k) : q.answer));
      const rows = qs.map((q, i) => `<div style="margin:6px 0"><b>${L3[i]}.</b> ${q.text}<br>→ svar: <b>${disp(q, shown[i])}</b></div>`).join('');
      return { type: 'choicetext', text: `<b>Hitta felet!</b> En av lösningarna har fel svar. Vilken?${rows}`, choices: L3.map(x => `Lösning ${x}`), answer: bad,
        steps: [`Lösning ${L3[bad]} är fel – rätt svar är <b>${disp(qs[bad], qs[bad].answer)}</b>.`, ...(qs[bad].steps || [])], hint: '', base: qs, shown, bad, challenge: 'spot' };
    },
    // Två steg i ett: lös båda, kombinera svaren
    combine(skill, lvl) {
      const qs = candidates(skill.gen, lvl, 2, isShortNum); if (qs.length < 2) return null;
      const ans = Math.round((qs[0].answer + qs[1].answer) * 1e6) / 1e6;
      return { type: 'num', text: `<b>Dubbelsteg:</b> lös båda och lägg ihop svaren.<div style="margin:6px 0"><b>1.</b> ${qs[0].text}</div><div style="margin:6px 0"><b>2.</b> ${qs[1].text}</div>Vad blir svar 1 + svar 2?`,
        answer: ans, steps: [`Svar 1 = ${disp(qs[0], qs[0].answer)}`, ...(qs[0].steps || []).slice(-1), `Svar 2 = ${disp(qs[1], qs[1].answer)}`, ...(qs[1].steps || []).slice(-1), `Summa: ${disp(qs[0], ans)}`], hint: '', base: qs, challenge: 'combine' };
    },
    // Baklänges: skriv ett eget uttryck med parentes som blir det här när man förenklar
    create(skill, lvl) {
      const qs = candidates(skill.gen, lvl, 1, (q) => isShortExpr(q) && !P().isConst(q.answer)); if (!qs.length) return null; const q = qs[0]; const v = q.variable || 'x'; const Pp = P();
      const rest = Pp.sub(q.answer, Pp.mul(Pp.num(2), Pp.add(Pp.variable(v), Pp.num(1)))); const model = `2(${v} + 1)${Pp.isConst(rest) && Pp.constVal(rest) === 0 ? '' : ` + (${Pp.format(rest)})`}`;
      return { type: 'expr', variable: q.variable, variables: q.variables, text: `<b>Baklänges:</b> skriv ett eget uttryck <b>med en parentes som multipliceras</b> (t.ex. 3(…)) som blir <b>${Pp.format(q.answer)}</b> när man förenklar.`,
        answer: q.answer, model, display: model, create: 'expr', v2check: 'create', steps: [`Ett exempel: ${model}`, `Multiplicera in och förenkla – då blir det ${Pp.format(q.answer)}. Många svar är rätt!`], hint: '', challenge: 'create' };
    },
    // Baklänges: hitta på en ekvation som har en viss lösning
    equation(skill, lvl) {
      if (!/ekv/.test(skill.id)) return null;
      const qs = candidates(skill.gen, lvl, 1, (q) => q.type === 'num' && Number.isInteger(q.answer) && Math.abs(q.answer) <= 30); if (!qs.length) return null; const x = qs[0].answer;
      const model = `2(x + 1) = ${2 * (x + 1)}`;
      return { type: 'expr', variable: 'x', text: `<b>Baklänges:</b> hitta på en egen ekvation med <b>x</b> på båda sidor eller med parentes – som har lösningen <b>x = ${x}</b>.`, answer: P().num(x), solution: x, model, display: model, create: 'equation', v2check: 'create', eq: true,
        steps: [`Ett exempel: ${model}. Sätt in x = ${x}: 2 · (${x} + 1) = ${2 * (x + 1)}. ✓`, 'Kolla alltid din ekvation genom att sätta in lösningen.'], hint: '', challenge: 'equation' };
    },
    // Ordna lösningsstegen
    order(skill, lvl) {
      const qs = candidates(skill.gen, lvl, 1, (q) => Array.isArray(q.steps) && q.steps.length >= 4 && (q.type === 'expr' || q.type === 'num')); if (!qs.length) return null; const q = qs[0];
      const items = q.steps.slice(0, -1).map(st => String(st).replace(/^<b>[^<]*<\/b>\s*/, '')); if (new Set(items).size !== items.length) return null;
      return { type: 'order', text: `<b>Lösningskedjan:</b> sätt stegen i rätt ordning.<br><span class="muted" style="font-size:1rem">${q.text}</span>`, items, answer: items, steps: [`<b>Rätt ordning:</b><ol style="margin:6px 0 0;padding-left:20px">${items.map(i => `<li>${i}</li>`).join('')}</ol>`], hint: '', challenge: 'order' };
    },
  };
  // Faktabanker: vilket påstående är FEL? (tre frågor ur banken, en med ett felalternativ som svar)
  function falseStatement(skill, lvl, k) {
    const qs = candidates(skill.gen, lvl, 3, (q) => q.type === 'choicetext' && !q.fig && Array.isArray(q.choices) && q.choices.length >= 2 && !RECALL.NEEDS_OPTIONS.test(RECALL.strip(q.text)) && plainLen(q) <= 140); if (qs.length < 3) return null;
    const bad = k % 3; const shownIdx = qs.map((q, i) => (i === bad ? q.choices.findIndex((_, j) => j !== q.answer) : q.answer));
    const rows = qs.map((q, i) => `<div style="margin:6px 0"><b>${L3[i]}.</b> ${q.text} → <b>${RECALL.strip(q.choices[shownIdx[i]]).replace(/[<>&]/g, '')}</b></div>`).join('');
    return { type: 'choicetext', text: `<b>Vilket påstående är FEL?</b>${rows}`, choices: L3.map(x => `Påstående ${x}`), answer: bad,
      steps: [`${L3[bad]} är fel – rätt svar är <b>${RECALL.strip(qs[bad].choices[qs[bad].answer]).replace(/[<>&]/g, '')}</b>.`, ...(qs[bad].steps || [])], hint: '', base: qs, shownIdx, bad, challenge: 'false' };
  }
  const MATH_ORDER = ['spot', 'combine', 'create', 'equation', 'order'];
  /* Bygg en Utmaning för ett moment. k = hur många utmaningar barnet gjort i momentet (ger växling mellan typerna). Null om inget passar. */
  // opts.young: yngre barn får bara korta mattebaserade utmaningar (dubbelsteg, hitta felet) – inga lästunga påståendelistor
  function make(skill, lvl, k = 0, opts = {}) {
    if (!skill || typeof skill.gen !== 'function') return null;
    const math = (skill.group || 'math') === 'math';
    const kinds = opts.young ? (math ? ['combine', 'spot'] : []) : math ? MATH_ORDER : ['false'];
    if (!kinds.length) return null;
    for (let j = 0; j < kinds.length; j++) {
      const kind = kinds[(k + j) % kinds.length];
      const q = kind === 'false' ? falseStatement(skill, lvl, k) : MATH[kind](skill, lvl, k);
      if (q) { q.level = lvl; return q; }
    }
    const f = math && !opts.young ? falseStatement(skill, lvl, k) : null; if (f) f.level = lvl; return f;
  }
  // Rättning av egna uttryck/ekvationer (deterministisk, Poly)
  const MULT_PAREN = /(?:[\dA-Za-zåäö)²³]|−|-)\s*\(/;
  function check(q, raw) {
    const s = String(raw || '').trim(); if (!s) return { status: 'empty' };
    const Pp = P();
    if (q.create === 'expr') {
      const p = Pp.tryParse(s); if (!p) return { status: 'invalid', msg: 'Jag förstår inte uttrycket. Skriv t.ex. 3(2x + 5).' };
      if (!Pp.equal(p, q.answer)) return { status: 'wrong' };
      if (!MULT_PAREN.test(s.replace(/\s+/g, ''))) return { status: 'invalid', msg: 'Rätt värde – men använd en parentes som multipliceras, t.ex. 3(…) eller x(…).' };
      return { status: 'correct' };
    }
    if (q.create === 'equation') {
      const parts = s.split('='); if (parts.length !== 2) return { status: 'invalid', msg: 'Skriv en ekvation med ett likhetstecken, t.ex. 2(x + 1) = 8.' };
      const a = Pp.tryParse(parts[0]), b = Pp.tryParse(parts[1]); if (!a || !b) return { status: 'invalid', msg: 'Jag förstår inte ekvationen.' };
      const d = Pp.sub(a, b); const keys = Object.keys(d);
      if (keys.some(key => key !== '' && key !== 'x')) return { status: 'invalid', msg: 'Använd bara x och tal.' };
      if (!d.x) return { status: 'wrong' };   // ingen eller oändligt många lösningar
      const x = -(d[''] || 0) / d.x; if (Math.abs(x - q.solution) > 1e-9) return { status: 'wrong' };
      const hard = /x[^=]*=.*x|x.*=[^=]*x/.test(s) || MULT_PAREN.test(s.replace(/\s+/g, ''));
      if (!hard) return { status: 'invalid', msg: 'Rätt lösning! Gör den lite klurigare: x på båda sidor eller en parentes.' };
      return { status: 'correct' };
    }
    return { status: 'wrong' };
  }
  return { make, check, MATH_ORDER, perturb, MULT_PAREN };
})();
if (typeof module !== 'undefined') module.exports = { RECALL, CHG };
