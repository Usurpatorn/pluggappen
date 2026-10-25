// Input-safety test: inject markup into every persisted/user-controlled string and assert nothing executable renders.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../dist/pluggappen.html', 'utf8');
const dom = new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(win) { win.scrollTo = () => {}; win.matchMedia = () => ({ matches: false, addEventListener() {} }); } });
const w = dom.window; const d = w.document; w.matchMedia = w.matchMedia || (() => ({ matches: false })); w.scrollTo = () => {}; w.HTMLCanvasElement.prototype.getContext = () => ({ scale() {}, clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {} });
w.__pwned = 0; const PAY = '<img src=x onerror="window.__pwned++"><script>window.__pwned++</script><svg onload="window.__pwned++"><a href="javascript:window.__pwned++">x</a>';
const $ = (s) => d.querySelector(s); const click = (el) => el && el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
let fails = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const noExec = (label) => { const bad = [...d.querySelectorAll('#app [onerror],#app [onload],#app script,#app a[href^="javascript"]')]; check(bad.length === 0 && w.__pwned === 0, `${label}: no executable markup (${bad.length} bad nodes, pwned=${w.__pwned})`); };
setTimeout(() => {
  const fix = JSON.parse(JSON.stringify(require('./test_fixture_family.json')));
  fix.appName = 'Evil ' + PAY; fix.kids[0].name = 'Nisse' + PAY; fix.kids[0].emoji = PAY; fix.kids[0].note = { title: 'T' + PAY, lines: ['L' + PAY] };
  fix.kids[1].decks[0].name = 'Deck' + PAY; fix.kids[1].decks[0].words[0] = ['word' + PAY, 'ord' + PAY, PAY]; fix.kids[1].exams[0].title = 'Exam' + PAY;
  w.PA.FAMILY.apply(fix); w.PA.load(); w.PA.rerender(); noExec('start screen with poisoned config');
  click($('[data-kid="k8"]')); noExec('home (name, note)');
  click($('[data-go="start"]')); click($('[data-kid="k4"]')); noExec('home k4 (exam title)');
  click($('[data-subj="lang"]')); noExec('language tab (deck name)');
  click($('[data-deck="cfg_test"]')); for (let i = 0; i < 6; i++) { click($('#next')); } noExec('lesson cards (poisoned words)');
  // Felboken: poisoned stored question
  const p = w.PA.DB.profiles.k4; p.mistakes = [{ id: 'm_x', at: Date.now(), cat: 'math', skillId: 'mult', q: { type: 'num', text: 'Q' + PAY, answer: 4, steps: ['S' + PAY], hint: 'H' + PAY, fig: '<svg onload="window.__pwned++"><circle r="3"/></svg>' + PAY, level: 1 } }];
  w.PA.save(); click($('[data-go="home"]')); click($('[data-act="felbok"]')); noExec('Felboken replay (poisoned stored question)');
  $('#ans') && ($('#ans').value = '1'); click($('#submit')); noExec('Felboken feedback with steps/hint');
  // parent: deck editor with poisoned deck name/words
  click($('[data-go="home"]')); click($('[data-go="start"]')); click($('[data-go="parent"]')); const pins = [...d.querySelectorAll('[data-pin]')]; ['1', '2', '3', '4'].forEach((x, i) => { pins[i].value = x; pins[i].dispatchEvent(new w.Event('input', { bubbles: true })); });
  click($('[data-tab="k4"]')); click($('[data-sub="decks"]')); noExec('parent deck list'); click($('[data-sub="exams"]')); noExec('parent exam list'); click($('[data-tab="settings"]')); noExec('parent settings (family card)');
  console.log(fails ? `XSS TEST FAILED (${fails})` : 'XSS TEST OK'); process.exit(fails ? 1 : 0);
}, 400);
