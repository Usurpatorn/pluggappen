/* Delad testhjälp: kör appen i jsdom med fast slumpfrö och fast klocka, och ett helt barnflöde (används av skuggtest och v1-regression). */
'use strict';
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const FIX = require('../test_fixture_family.json');
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T_FIXED = Date.UTC(2026, 9, 25, 15, 0, 0);
function mkWin({ seed = 0, fixedClock = false, storage = null, file, url = 'https://example.org/' } = {}) {
  const html = fs.readFileSync(file || path.join(__dirname, '../../dist/pluggappen.html'), 'utf8');
  const dom = new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`, { runScripts: 'dangerously', pretendToBeVisual: true, url, beforeParse(win) {
    win.scrollTo = () => {}; win.matchMedia = () => ({ matches: false, addEventListener() {} }); win.HTMLCanvasElement.prototype.getContext = () => null;
    if (seed) win.Math.random = rng(seed);
    if (fixedClock) { const RD = win.Date; let now = T_FIXED; class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } } win.Date = FD; win.__advance = (ms) => { now += ms; }; }
    if (storage) for (const [k, v] of Object.entries(storage)) win.localStorage.setItem(k, v);
  } });
  return dom.window;
}
const tools = (w) => {
  const $ = (s) => w.document.querySelector(s); const click = (el) => { if (!el) throw new Error('click on null'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  const PA = () => w.PA; const snaps = []; let mathAnswers = 0; let k = 0;
  const snap = (label) => snaps.push([label, $('#app').innerHTML]);
  const answer = () => {
    const S = PA().S; const item = S.queue[S.i]; k++; const wrong = k % 3 === 0;
    if (item.cat === 'math') {
      mathAnswers++;
      if (k % 7 === 0 && $('#hintBtn')) click($('#hintBtn'));
      if (item.type === 'choicetext' || item.choices) { const el = wrong ? [...w.document.querySelectorAll('[data-choice]')].find(b => b.dataset.choice !== String(item.answer)) : $(`[data-choice="${item.answer}"]`); click(el || $(`[data-choice="${item.answer}"]`)); if ($('#submit') && !$('#next')) click($('#submit')); }
      else if (item.type === 'order') { const idx = item.items.map((_, i) => i); if (wrong && idx.length > 1) [idx[0], idx[1]] = [idx[1], idx[0]]; for (const i of idx) click($(`[data-otile="${i}"]`)); click($('#submit')); }
      else if (item.type === 'open') { $('#ans').value = wrong ? 'ZZQX123 vet inte' : item.model; click($('#submit')); }
      else { $('#ans').value = wrong ? 'ZZQX123' : item.type === 'expr' ? PA().Poly.format(item.answer) : item.type === 'num' ? String(item.answer) : item.answer[0]; click($('#submit')); if (!$('#next') && $('#submit')) { $('#ans').value = '987654'; click($('#submit')); } }
    } else if (item.kind === 'pick' || item.kind === 'listen') click($(`[data-wchoice="${wrong ? item.choices.find(c => c.id !== item.correctId).id : item.correctId}"]`));
    else if (item.kind === 'match') { for (const pr of item.pairs) { click($(`[data-mside="l"][data-mid="${pr.id}"]`)); click($(`[data-mside="r"][data-mid="${pr.id}"]`)); } }
    else if (item.kind === 'spell') { for (const ch of item.target.replace(/\s/g, '')) { const tile = [...w.document.querySelectorAll('[data-tile]')].find(t => !t.classList.contains('used') && t.textContent === ch); click(tile); } click($('#submit')); }
    else if (item.kind === 'type') { $('#ans').value = wrong ? 'zzqx' : item.word.w; click($('#submit')); }
    else if (item.kind === 'speak') { click($('#skipSpeak')); return; }
    if (!$('#next')) throw new Error('no next for ' + (item.kind || item.type)); click($('#next'));
  };
  const run = (max = 40) => { let n = 0; while (PA().S && PA().S.i < PA().S.queue.length && $('#qcard') && n++ < max) { answer(); if (w.__advance) w.__advance(4000); } };
  return { $, click, PA, snap, snaps, run, get mathAnswers() { return mathAnswers; } };
};
// v1-flöden: från 2.0.0 är v2 standard, så v1-referensflödet väljer reservmotorn v1 uttryckligen. Valet (settings.engine/engineAt)
// räknas inte till v1-datan som jämförs med 1.2.0.
const strip = (p) => { const o = JSON.parse(JSON.stringify(p)); delete o.le; if (o.settings) { delete o.settings.engine; delete o.settings.engineAt; } return o; };
const useV1 = (PA) => { for (const id of Object.keys(PA.DB.profiles)) PA.DB.profiles[id].settings.engine = 'v1'; };
const childFlow = (w, T) => {
  const { $, click, PA, snap, run } = T;
  PA().FAMILY.apply(FIX); PA().load(); useV1(PA()); PA().rerender(); snap('start');
  click($('[data-kid="k2"]')); click($('[data-pet="uggla"]')); snap('k2 home');
  click($('[data-rec]')); snap('k2 kör start'); run(); snap('k2 kör summary');
  click($('[data-act="again"]')); run(); snap('k2 again summary');
  click($('[data-go="home"]')); snap('k2 home 2');
  if ($('[data-act="felbok"]')) { click($('[data-act="felbok"]')); run(); snap('k2 felbok summary'); click($('[data-go="home"]')); }
  click($('[data-subj="sv"]')); click($('[data-skill="sv_stavning"]')); run(); snap('k2 svenska'); click($('[data-go="home"]'));
  click($('[data-subj="lang"]')); click($('[data-deck="es_siffror"]')); run(); snap('k2 lesson'); click($('[data-go="home"]'));
  click($('[data-go="start"]')); click($('[data-kid="k8"]')); snap('k8 home');
  click($('[data-rec]')); run(); snap('k8 kör'); click($('[data-go="home"]'));
  click($('[data-test="alg12"]')); run(); snap('k8 test'); click($('[data-go="home"]'));
  click($('[data-subj="math"]')); click($('[data-skill="ekvation"]')); run(); snap('k8 ekvation'); click($('[data-go="home"]'));
  click($('[data-go="blitz"]')); click($('[data-blitz="talfoljd"]')); for (let i = 0; i < 4; i++) { const q = PA().B.q; click($(`[data-bchoice="${q.answer}"]`)); } snap('k8 blitz'); click($('[data-go="blitz"]')); click($('[data-go="home"]'));
  click($('[data-go="start"]')); click($('[data-kid="k4"]')); if ($('[data-pet="uggla"]')) click($('[data-pet="uggla"]')); click($('[data-rec]')); run(); snap('k4 kör'); click($('[data-go="home"]')); snap('k4 home');
};


// Föräldrasidor (utan ⚙ – där står versionsnumret)
const parentFlow = (w, T) => {
  const { $, click, snap } = T;
  click($('[data-go="start"]')); click($('[data-go="parent"]'));
  const pins = [...w.document.querySelectorAll('[data-pin]')]; ['1', '2', '3', '4'].forEach((d, i) => { pins[i].value = d; pins[i].dispatchEvent(new w.Event('input', { bubbles: true })); });
  for (const kid of ['k2', 'k4', 'k8']) { click($(`[data-tab="${kid}"]`)); snap('parent ' + kid + ' overview'); for (const sub of ['exams', 'decks', 'settings']) { click($(`[data-sub="${sub}"]`)); snap(`parent ${kid} ${sub}`); } }
  click($('[data-go="start"]')); snap('start after parent');
};
module.exports = { rng, T_FIXED, mkWin, tools, strip, useV1, childFlow, parentFlow, FIX };
