/* ========= Algebra engine: multivariate polynomials, parser, formatting ========= */
const Poly = (() => {
  // monomial key: "" for constant, "x" , "x^2", "x*y" (vars sorted)
  const monoFromVars = (vars) => {
    const names = Object.keys(vars).filter(v => vars[v] !== 0).sort();
    return names.map(v => vars[v] === 1 ? v : v + '^' + vars[v]).join('*');
  };
  const varsFromMono = (key) => {
    const o = {};
    if (!key) return o;
    key.split('*').forEach(p => { const [v, e] = p.split('^'); o[v] = e ? +e : 1; });
    return o;
  };
  const clean = (p) => { for (const k in p) if (Math.abs(p[k]) < 1e-9) delete p[k]; return p; };
  const num = (n) => clean({ '': n });
  const variable = (v) => ({ [v]: 1 });
  const add = (a, b) => { const r = { ...a }; for (const k in b) r[k] = (r[k] || 0) + b[k]; return clean(r); };
  const neg = (a) => { const r = {}; for (const k in a) r[k] = -a[k]; return r; };
  const sub = (a, b) => add(a, neg(b));
  const mul = (a, b) => {
    const r = {};
    for (const ka in a) for (const kb in b) {
      const va = varsFromMono(ka), vb = varsFromMono(kb);
      for (const v in vb) va[v] = (va[v] || 0) + vb[v];
      const k = monoFromVars(va);
      r[k] = (r[k] || 0) + a[ka] * b[kb];
    }
    return clean(r);
  };
  const isConst = (a) => Object.keys(a).every(k => k === '');
  const constVal = (a) => a[''] || 0;
  const pow = (a, n) => { if (!Number.isInteger(n) || n < 0 || n > 6) throw new Error('exp'); let r = num(1); for (let i = 0; i < n; i++) r = mul(r, a); return r; };
  const div = (a, b) => { if (!isConst(b) || constVal(b) === 0) throw new Error('div'); const c = constVal(b); const r = {}; for (const k in a) r[k] = a[k] / c; return clean(r); };
  const equal = (a, b) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (Math.abs((a[k] || 0) - (b[k] || 0)) > 1e-6) return false;
    return true;
  };
  const degree = (key) => { const v = varsFromMono(key); return Object.values(v).reduce((s, e) => s + e, 0); };
  const evalAt = (a, env) => { let s = 0; for (const k in a) { let t = a[k]; const v = varsFromMono(k); for (const n in v) t *= Math.pow(env[n] ?? 0, v[n]); s += t; } return s; };
  const SUP = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶' };
  const fmtNum = (n) => { const r = Math.round(n * 1000) / 1000; return String(r).replace('.', ','); };
  const monoStr = (key) => { const v = varsFromMono(key); return Object.keys(v).sort().map(n => n + (v[n] === 1 ? '' : (SUP[v[n]] || '^' + v[n]))).join(''); };
  // Format as a readable Swedish-style expression: 3x² − 2x + 5
  const format = (a, opts = {}) => {
    const keys = Object.keys(a).filter(k => Math.abs(a[k]) > 1e-9);
    if (!keys.length) return '0';
    keys.sort((x, y) => degree(y) - degree(x) || x.localeCompare(y));
    let out = '';
    keys.forEach((k, i) => {
      const c = a[k];
      const abs = Math.abs(c);
      const sign = c < 0 ? '−' : '+';
      let body = k === '' ? fmtNum(abs) : ((abs === 1 ? '' : fmtNum(abs)) + monoStr(k));
      if (i === 0) out += (c < 0 ? '−' : '') + body;
      else out += ' ' + sign + ' ' + body;
    });
    return out;
  };
  // Plain-ASCII canonical form for comparisons/tests: 3x^2-2x+5
  const ascii = (a) => format(a).replace(/−/g, '-').replace(/ /g, '').replace(/²/g, '^2').replace(/³/g, '^3');

  /* ---------- Parser ---------- */
  const tokenize = (s) => {
    s = s.replace(/−|–|—/g, '-').replace(/·|×|\*\*/g, '*').replace(/:/g, '/').replace(/,/g, '.').replace(/\s+/g, '');
    s = s.replace(/²/g, '^2').replace(/³/g, '^3');
    const toks = []; let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/[0-9.]/.test(ch)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; toks.push({ t: 'num', v: parseFloat(s.slice(i, j)) }); i = j; continue; }
      if (/[a-zA-ZåäöÅÄÖ]/.test(ch)) { toks.push({ t: 'var', v: ch }); i++; continue; }
      if ('+-*/^()'.includes(ch)) { toks.push({ t: ch }); i++; continue; }
      throw new Error('tecken');
    }
    return toks;
  };
  const parse = (s) => {
    const toks = tokenize(s); let p = 0;
    const peek = () => toks[p]; const next = () => toks[p++];
    const startsAtom = (t) => t && (t.t === 'num' || t.t === 'var' || t.t === '(');
    function expr() {
      let v = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) { const op = next().t; const r = term(); v = op === '+' ? add(v, r) : sub(v, r); }
      return v;
    }
    function term() {
      let v = factor();
      for (;;) {
        const t = peek();
        if (t && (t.t === '*' || t.t === '/')) { next(); const r = factor(); v = t.t === '*' ? mul(v, r) : div(v, r); }
        else if (startsAtom(t)) { const r = factor(); v = mul(v, r); } // implicit multiplication
        else break;
      }
      return v;
    }
    function factor() {
      const t = peek();
      if (t && t.t === '-') { next(); return neg(factor()); }
      if (t && t.t === '+') { next(); return factor(); }
      return power();
    }
    function power() {
      let base = atom();
      if (peek() && peek().t === '^') { next(); const e = atom(); if (!isConst(e)) throw new Error('exp'); base = pow(base, constVal(e)); }
      return base;
    }
    function atom() {
      const t = next();
      if (!t) throw new Error('slut');
      if (t.t === 'num') return num(t.v);
      if (t.t === 'var') return variable(t.v);
      if (t.t === '(') { const v = expr(); const c = next(); if (!c || c.t !== ')') throw new Error('paren'); return v; }
      throw new Error('tecken');
    }
    const v = expr();
    if (p !== toks.length) throw new Error('rest');
    return v;
  };
  const tryParse = (s) => { try { if (!s || !s.trim()) return null; return parse(s); } catch (e) { return null; } };
  // Is the student's answer written in simplest form? (no repeated monomials, no parentheses, no '*')
  const isSimplified = (s, target) => {
    const t = s.replace(/−|–/g, '-').replace(/\s+/g, '');
    if (/[()*/^]/.test(t.replace(/\^2|\^3|²|³/g, ''))) return false;
    // count terms
    const terms = t.replace(/^-/, '').split(/[+-]/).filter(Boolean);
    const targetTerms = Object.keys(target).filter(k => Math.abs(target[k]) > 1e-9).length;
    return terms.length === targetTerms;
  };
  return { num, variable, add, sub, mul, neg, pow, div, equal, format, ascii, parse, tryParse, isSimplified, evalAt, fmtNum, isConst, constVal };
})();

/* ========= Random helpers ========= */
const R = {
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  nonzero: (a, b) => { let v = 0; while (v === 0) v = R.int(a, b); return v; },
  sign: () => (Math.random() < 0.5 ? -1 : 1),
  chance: (p) => Math.random() < p,
};

// helpers for writing readable algebra in question texts
const T = {
  // "3x", "x", "−2x"
  term: (c, v) => { if (c === 0) return '0'; const a = Math.abs(c); return (c < 0 ? '−' : '') + (a === 1 ? '' : Poly.fmtNum(a)) + v; },
  // signed term for continuing an expression: " + 3x" / " − 3x"
  signed: (c, v = '') => { if (c === 0) return ''; const a = Math.abs(c); const body = v ? ((a === 1 ? '' : Poly.fmtNum(a)) + v) : Poly.fmtNum(a); return (c < 0 ? ' − ' : ' + ') + body; },
  // linear "ax + b" with proper signs
  lin: (a, b, v = 'x') => { if (a === 0) return Poly.fmtNum(b); let s = T.term(a, v); if (b !== 0) s += T.signed(b); return s; },
  n: (n) => (n < 0 ? '−' + Poly.fmtNum(-n) : Poly.fmtNum(n)),
  paren: (n) => (n < 0 ? '(−' + Poly.fmtNum(-n) + ')' : Poly.fmtNum(n)),
  // Make numeric choices around correct answer
  choices: (correct, count = 4, spread = 3) => {
    const set = new Set([correct]);
    let guard = 0;
    while (set.size < count && guard++ < 100) {
      let d = R.nonzero(-spread, spread);
      if (Math.abs(correct) > 20 && R.chance(0.5)) d *= 10;
      const v = correct + d;
      if (v >= 0 || correct < 0) set.add(v);
    }
    return R.shuffle([...set]);
  },
};

if (typeof module !== 'undefined') module.exports = { Poly, R, T };
