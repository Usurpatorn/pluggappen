const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../dist/pluggappen.html', 'utf8');
const dom = new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(win) { win.scrollTo = () => {}; win.matchMedia = () => ({ matches: false, addEventListener() {} }); } });
const w = dom.window; w.matchMedia = w.matchMedia || (() => ({ matches: false })); w.scrollTo = () => {};
setTimeout(() => {
  w.PA.FAMILY.apply(require('./test_fixture_family.json')); w.PA.load();
  const kid = w.PA.KIDS.find(k => k.id === 'k2'); let fails = 0, n = 0; const seen = {};
  const fail = (m, q) => { if (fails++ < 15) console.log('FAIL', m, JSON.stringify(q).slice(0, 220)); };
  for (const s of kid.skills) { const max = s.maxLvl || 3; seen[s.id] = new Set();
    for (let lvl = 1; lvl <= max; lvl++) for (let i = 0; i < 300; i++) { let q; try { q = s.gen(lvl); } catch (e) { fail(s.id + ' threw ' + e.message, { lvl }); continue; } n++; seen[s.id].add(q.type);
      if (!q || !q.text) { fail(s.id + ' no text', q); continue; }
      if (/undefined|NaN|\[object/.test(JSON.stringify(q))) fail(s.id + ' undefined/NaN', q);
      if (q.type === 'choicetext') { if (!Array.isArray(q.choices) || q.choices.length < 2 || q.answer < 0 || q.answer >= q.choices.length) fail(s.id + ' bad choicetext', q); if (new Set(q.choices.map(String)).size !== q.choices.length) fail(s.id + ' dup choices', q); }
      else if (q.type === 'num') { if (!Number.isInteger(q.answer) || q.answer < 0) fail(s.id + ' bad num', q); if (q.choices && (!q.choices.includes(q.answer) || new Set(q.choices).size !== q.choices.length)) fail(s.id + ' bad num choices', q); }
      else if (q.type === 'text') { if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some(a => typeof a !== 'string' || !a)) fail(s.id + ' bad text', q); }
      else if (q.type === 'order') { if (!Array.isArray(q.items) || q.items.length < 3 || new Set(q.items).size !== q.items.length) fail(s.id + ' bad order', q); }
      else fail(s.id + ' unknown type ' + q.type, q);
      if (!q.steps || !q.steps.length) fail(s.id + ' no steps', q);
    } }
  console.log('skills', kid.skills.length, 'questions', n, 'fails', fails); console.log(Object.entries(seen).map(([k, v]) => k + ':' + [...v].join('/')).join('  '));
  process.exit(fails ? 1 : 0);
}, 400);
