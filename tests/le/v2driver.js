/* Testdrivare för v2-barnflödet i jsdom: svarar på alla uppgiftstyper (rätt eller fel), LÄR-kort, glosor och Testa mig. */
'use strict';
function v2tools(w, T) {
  const { $, click, PA } = T;
  const log = { items: 0, learn: 0, rescueLearn: 0, chips: new Set(), types: {}, exam: 0, feedbackInExam: 0, hintInExam: 0, recall: 0, challenge: 0 };
  const correctValue = (item) => {
    const P = PA().Poly;
    if (item.type === 'recall') return item.display;
    if (item.create === 'equation') return item.model;
    if (item.create === 'expr') return item.model;
    if (item.type === 'expr') return P.format(item.answer);
    if (item.type === 'num') return String(item.answer).replace('.', ',');
    if (item.type === 'open') return item.model;
    return (item.answer && item.answer[0]) || '';
  };
  const wrongValue = (item) => (item.type === 'recall' ? 'zzqx' : item.create === 'equation' ? 'x = 987654' : item.type === 'open' ? 'vet inte' : '987654');
  // wrong: bool eller funktion(item) → bool
  function answer(wrongFn) {
    const S = PA().S; const item = S.queue[S.i]; const exam = !!S.v2.exam; log.items++;
    const chip = $('#app .pill.acc'); if (chip && !exam) log.chips.add(chip.textContent.trim());
    if (exam) { if ($('#hintBtn') || $('#explainBtn')) log.hintInExam++; }
    if (item.cat === 'learn') { log.learn++; if (item.spec.role === 'rescue') log.rescueLearn++; click($('[data-v2="teachok"]')); return; }
    const wrong = typeof wrongFn === 'function' ? wrongFn(item) : !!wrongFn;
    const tk = item.cat === 'word' ? 'word:' + item.kind : item.paper ? 'paper' : item.build ? 'build' : item.ui === 'tap' ? 'tap' : item.type; log.types[tk] = (log.types[tk] || 0) + 1;
    if (item.type === 'recall') log.recall++; if (item.challenge || (item.spec && item.spec.mode === 'challenge')) log.challenge++;
    const before = S.i;
    if (item.cat === 'word') {
      if (item.kind === 'intro') { click($('#next')); return; }
      if (item.kind === 'pick' || item.kind === 'listen') click($(`[data-wchoice="${wrong ? item.choices.find(c => c.id !== item.correctId).id : item.correctId}"]`));
      else if (item.kind === 'type') { $('#ans').value = wrong ? 'zzqx' : item.word.w; click($('#submit')); }
      else if (item.kind === 'spell') { for (const ch of item.target.replace(/\s/g, '')) { const tile = [...w.document.querySelectorAll('[data-tile]')].find(t => !t.classList.contains('used') && t.textContent === ch); click(tile); } click($('#submit')); }
      else throw new Error('ordtyp ' + item.kind);
    } else if (item.type === 'sort') {   // v3: tryck på kortet, sedan på gruppen (fel: första kortet i fel grupp)
      item.items.forEach((t, i) => { const right = item.bins.indexOf(item.answer[t]); const b = wrong && i === 0 ? (right + 1) % item.bins.length : right; click($(`[data-sitem="${i}"]`)); click($(`[data-sbin="${b}"]`)); }); click($('#submit'));
    } else if (item.type === 'match') {   // v3: para ihop (fel: ett felpar först)
      if (wrong) { click($('[data-m2="l"][data-mi="0"]')); click($('[data-m2="r"][data-mi="1"]')); }
      for (let i = 0; i < item.pairs.length; i++) { click($(`[data-m2="l"][data-mi="${i}"]`)); click($(`[data-m2="r"][data-mi="${i}"]`)); }
    } else if (item.build) {   // v3: bygg ordet med brickor
      const target = wrong ? 'zz' : correctValue(item); const used = new Set();
      for (const ch of target) { const tile = [...w.document.querySelectorAll('[data-btile]')].find(t => !used.has(t) && !t.classList.contains('used') && t.textContent === ch); if (tile) { used.add(tile); click(tile); } else if (wrong) { const any = [...w.document.querySelectorAll('[data-btile]')].find(t => !t.classList.contains('used')); if (any) click(any); } }
      if ($('#submit') && $('#submit').disabled) click($('[data-btile]:not(.used)')); click($('#submit'));
    } else if (item.type === 'choicetext' || item.choices) {
      const el = wrong ? [...w.document.querySelectorAll('[data-choice]')].find(b => b.dataset.choice !== String(item.answer)) : $(`[data-choice="${item.answer}"]`);
      click(el || $(`[data-choice="${item.answer}"]`)); if ($('#submit') && !$('#next') && PA().S && PA().S.i === before) click($('#submit'));
    } else if (item.type === 'order') { const idx = item.items.map((_, i) => i); if (wrong && idx.length > 1) [idx[0], idx[1]] = [idx[1], idx[0]]; for (const i of idx) click($(`[data-otile="${i}"]`)); click($('#submit')); }
    else { $('#ans').value = wrong ? wrongValue(item) : correctValue(item); click($('#submit')); if (!$('#next') && PA().S && PA().S.i === before && $('#submit')) { $('#ans').value = '987654'; click($('#submit')); } }
    if (exam) { if ($('#fb .feedback')) log.feedbackInExam++; if (PA().S && PA().S.i === before && PA().S.v2) throw new Error('Testa mig gick inte vidare'); return; }
    if (!$('#next')) throw new Error('ingen Nästa-knapp för ' + (item.kind || item.type) + ' · ' + ($('#fb') ? $('#fb').textContent.slice(0, 80) : ''));
    click($('#next'));
  }
  function run(wrongFn = false, max = 60) { let n = 0; while (PA().S && PA().S.v2 && $('#qcard') && n++ < max) { answer(wrongFn); if (w.__advance) w.__advance(4000); } return n; }
  return { answer, run, log };
}
function toStart(T) { const { $, click } = T; for (let i = 0; i < 4 && !$('[data-go="parent"]'); i++) { const b = $('[data-v2="endPreview"]') || $('[data-go="start"]') || $('[data-go="home"]'); if (!b) break; click(b); } }
function unlockParent(w, T) { const { $, click } = T; toStart(T); click($('[data-go="parent"]')); const pins = [...w.document.querySelectorAll('[data-pin]')]; if (pins.length) ['1', '2', '3', '4'].forEach((d, i) => { pins[i].value = d; pins[i].dispatchEvent(new w.Event('input', { bubbles: true })); }); }
function setEngine(w, T, kidId, v) { const { $, click } = T; unlockParent(w, T); click($(`[data-tab="${kidId}"]`)); click($('[data-sub="v2"]'));
  if (v === 'v1') click($('[data-v2="engine"][data-val="v1"]')); else if ($('[data-v2="engineAsk"][aria-pressed="false"]')) { click($('[data-v2="engineAsk"]')); click($('[data-v2="engine"][data-val="v2"]')); } toStart(T); }
// v2 är standard från 2.0.0 – enableV2 ser bara till att barnet inte står på v1
function enableV2(w, T, kidId) { setEngine(w, T, kidId, 'v2'); }
/* Experience v3: 2.1-sviterna prövar 2.1-presentationen, som i v3 finns kvar som upplevelsen "Klassisk (2.1)" (förälderns val och
   reserven). classic() väljer den för alla barn – samma sak som föräldern gör i Motor v2-fliken. v3-upplevelserna prövas i test_exp_v3.js.
   Äldre byggen (1.2.0/2.0.0/2.1.0) saknar EXP – då görs inget. */
function classic(T) { const PA = T.PA(); if (!PA.EXP) return; for (const k of PA.KIDS) PA.EXP.set(k, 'classic'); }
module.exports = { v2tools, unlockParent, enableV2, setEngine, toStart, classic };
