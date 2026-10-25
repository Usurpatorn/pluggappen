const { Poly, R, T } = require('../src/01_math.js');
global.Poly = Poly; global.R = R; global.T = T;
const { TEMPLATES } = require('../src/02_content.js'); const KIDS = Object.entries(TEMPLATES).map(([id, t]) => ({ id, skills: t.skills }));

const strip = (s) => s.replace(/<[^>]+>/g, '');
let fails = 0, total = 0;
const fail = (msg, q) => { fails++; if (fails < 25) console.log('FAIL', msg, '\n  ', strip(q.text), '\n  ', q.type === 'expr' ? Poly.format(q.answer) : q.answer, '\n  ', q.steps.map(strip).join(' | ')); };

for (const kid of KIDS) for (const sk of kid.skills) for (let level = 1; level <= 3; level++) {
  const seenTexts = new Set();
  for (let i = 0; i < 400; i++) {
    total++;
    let q;
    try { q = sk.gen(level); } catch (e) { fails++; console.log('THROW', kid.id, sk.id, level, e.message); continue; }
    if (!q) { fail('no q ' + sk.id, { text: '', steps: [], type: 'num' }); continue; }
    const blob = strip(q.text) + ' ' + q.steps.map(strip).join(' ') + ' ' + (q.hint || '');
    if (/NaN|undefined|null|\[object/.test(blob)) fail('bad token ' + sk.id, q);
    if (!q.steps || !q.steps.length) fail('no steps ' + sk.id, q);
    seenTexts.add(strip(q.text));
    if (q.type === 'expr') {
      if (!q.answer || typeof q.answer !== 'object') { fail('expr no answer', q); continue; }
      // verify text vs answer for direct simplification tasks
      const t = strip(q.text);
      const mm = t.match(/^(?:Multiplicera in|Förenkla): (.+)$/);
      if (mm) {
        const parsed = Poly.tryParse(mm[1].replace(/·/g, '*'));
        if (!parsed) fail('unparseable text ' + sk.id, q);
        else if (!Poly.equal(parsed, q.answer)) fail('text≠answer ' + sk.id, q);
      }
      // answer should be expressed in the declared variable only
      const fmt = Poly.format(q.answer);
      if (/[a-z]/.test(fmt.replace(new RegExp('[' + (q.variables || [q.variable]).join('') + ']', 'g'), ''))) fail('wrong var', q);
      // round trip
      const rt = Poly.tryParse(fmt);
      if (!rt || !Poly.equal(rt, q.answer)) fail('roundtrip ' + fmt, q);
    } else if (q.type === 'num') {
      if (typeof q.answer !== 'number' || !Number.isFinite(q.answer) || !Number.isInteger(q.answer)) fail('num answer ' + sk.id, q);
      if (q.choices) { if (!q.choices.includes(q.answer)) fail('choices missing answer', q); if (new Set(q.choices).size !== q.choices.length) fail('dup choices', q); if (q.choices.length < 3) fail('few choices', q); }
      // Verify arithmetic for simple "a op b = ?" texts
      const t = strip(q.text).replace(/−/g, '-').replace(/·/g, '*');
      const mm = t.match(/^(\d+) ([+\-*/]) (\d+) = \?$/);
      if (mm) { const a = +mm[1], b = +mm[3]; const r = mm[2] === '+' ? a + b : mm[2] === '-' ? a - b : mm[2] === '*' ? a * b : a / b; if (r !== q.answer) fail('arith', q); }
      if (kid.id === 'ak2' && q.answer < 0) fail('negative answer in ak2', q);
    } else if (q.type === 'text') {
      if (!Array.isArray(q.answer) || !q.answer.length) fail('text answer', q);
    } else fail('unknown type', q);
  }
  console.log(kid.id, sk.id, 'L' + level, 'unique texts:', seenTexts.size);
}

// parser spot checks
const checks = [
  ['6x+15', '15+6x', true], ['2x^2+3x', '3x+2x²', true], ['-2x+8', '8-2x', true], ['4x+10', '2x+2(x+5)', true],
  ['x²+5x', 'x(x+5)', true], ['3n+1', '1+3n', true], ['6x+15', '6x+16', false], ['2x', 'x+x', true], ['x', '1x', true], ['-x', '0-x', true],
];
for (const [a, b, exp] of checks) { const r = Poly.equal(Poly.parse(a), Poly.parse(b)); if (r !== exp) { fails++; console.log('PARSER FAIL', a, b, r); } }
console.log(Poly.format(Poly.parse('3x^2 - 2x + 5')), Poly.format(Poly.parse('-x+1')), Poly.format(Poly.parse('2x+(-3)')));
console.log('isSimplified', Poly.isSimplified('6x+15', Poly.parse('6x+15')), Poly.isSimplified('3(2x+5)', Poly.parse('6x+15')), Poly.isSimplified('2x+4x+15', Poly.parse('6x+15')));
console.log('total', total, 'fails', fails);
process.exit(fails ? 1 : 0);
