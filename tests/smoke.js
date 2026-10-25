const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../dist/pluggappen.html', 'utf8');
const dom = new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(win) { win.scrollTo = () => {}; win.matchMedia = () => ({ matches: false, addEventListener() {} }); } });
const { window } = dom; const { document } = window;
const errors = [];
window.addEventListener('error', (e) => errors.push(e.message));
window.matchMedia = window.matchMedia || (() => ({ matches: false }));
window.HTMLCanvasElement.prototype.getContext = () => ({ scale() {}, clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillRect() {} });
window.scrollTo = () => {};
const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const click = (el) => { if (!el) throw new Error('click on null'); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); };
const txt = () => $('#app').textContent.replace(/\s+/g, ' ').trim();
const assert = (c, m) => { if (!c) { console.log('ASSERT FAIL:', m, '\n   ', txt().slice(0, 400)); process.exitCode = 1; } };
const PA = () => window.PA;
const answerCurrent = () => {
  const S = PA().S; const item = S.queue[S.i];
  if (item.cat === 'math') {
    if (item.type === 'choicetext') { click($(`[data-choice="${item.answer}"]`)); }
    else if (item.type === 'open') { $('#ans').value = item.model; click($('#submit')); }
    else if (item.type === 'order') { for (let k = 0; k < item.items.length; k++) click($(`[data-otile="${k}"]`)); click($('#submit')); }
    else if (item.choices) { click($(`[data-choice="${item.answer}"]`)); if ($('#submit') && !$('#next')) click($('#submit')); }
    else { const ans = item.type === 'expr' ? PA().Poly.format(item.answer) : item.type === 'num' ? String(item.answer) : item.answer[0]; $('#ans').value = ans; click($('#submit')); }
  } else if (item.kind === 'intro') { /* just next */ }
  else if (item.kind === 'pick' || item.kind === 'listen') click($(`[data-wchoice="${item.correctId}"]`));
  else if (item.kind === 'match') { for (const pr of item.pairs) { click($(`[data-mside="l"][data-mid="${pr.id}"]`)); click($(`[data-mside="r"][data-mid="${pr.id}"]`)); } }
  else if (item.kind === 'spell') { for (const ch of item.target.replace(/\s/g, '')) { const tile = $$('[data-tile]').find(t => !t.classList.contains('used') && t.textContent === ch); click(tile); } click($('#submit')); }
  else if (item.kind === 'type') { $('#ans').value = item.word.w; click($('#submit')); }
  assert($('#next'), 'next button after answer kind=' + (item.kind || item.type));
  click($('#next'));
};
const runSession = (max = 40) => { let n = 0; while (PA().S && PA().S.i < PA().S.queue.length && $('#qcard') && n++ < max) { const before = PA().S.i; answerCurrent(); if (PA().S && PA().S.i === before && $('#qcard')) { console.log('STUCK on', PA().S.queue[PA().S.i].type || PA().S.queue[PA().S.i].kind); break; } } };

setTimeout(() => {
  try {
    assert(txt().includes('inte kopplad'), 'unpaired start screen');
    PA().FAMILY.apply(require('./test_fixture_family.json')); PA().load(); PA().rerender();
    assert(txt().includes('Vem ska plugga'), 'start');
    click($('[data-kid="k8"]'));
    assert(txt().includes('Dagens uppdrag') && txt().includes('Prov 3 Algebra') && txt().includes('Kemiprov') && txt().includes('Kemi') && txt().includes('Lärarens kommentar'), 'k8 home: ' );
    assert(document.documentElement.getAttribute('data-theme') === 'light', 'light default');
    // answerCurrent must handle choicetext

    assert(document.body.classList.contains('focus'), 'focus mode on for k8');
    // Kör! → exam-driven sprint of 5
    click($('[data-rec]'));
    assert($('#qcard') && PA().S.queue.length === 5, 'sprint 5: ' + (PA().S && PA().S.queue.length));
    assert(txt().includes('kvar'), 'focus shows N kvar');
    runSession();
    assert(txt().includes('Sprinten klar'), 'summary');
    click($('[data-act="again"]')); runSession();
    assert(txt().includes('Ta en kort paus'), 'break suggested after 2 sprints');
    click($('[data-go="break"]')); assert(txt().includes('2:00'), 'break screen');
    click($('[data-go="home"]'));
    // quests: q2 skill quest may be done (5 correct on weakest) → claim
    const claim = $('[data-claim]'); if (claim) { click(claim); assert(PA().DB.profiles.k8.gems > 0, 'gems after claim'); }
    // plan + test
    click($('[data-plan="alg12"]')); assert(txt().includes('Provplan') && txt().includes('Kommande dagar'), 'plan');
    click($('[data-test="alg12"]')); assert(txt().includes('Provläge') && PA().S.queue.length === 15 && txt().includes('kvar') && !txt().includes('NaN'), 'test 15');
    runSession(); assert(txt().includes('Provresultat') && txt().includes('15/15') && txt().includes('Indikation: A'), 'test result');
    click($('[data-go="home"]'));
    assert(txt().includes('Senaste provträning: 15/15 (A)'), 'home shows test');
    // language lesson: enable spanish deck for k8 via courses
    click($('[data-subj="lang"]')); click($('[data-go="courses"]')); assert(txt().includes('Spanska'), 'courses');
    click($('[data-toggle-deck="es_djur"]')); click($('[data-toggle-deck="es_djur"]')); assert(PA().DB.profiles.k8.enabledDecks.includes('es_djur'), 'deck enabled');
    click($('[data-go="home"]'));
    click($('[data-deck="es_djur"]'));
    const kinds = PA().S.queue.map(q => q.kind); assert(kinds.includes('intro') && kinds.includes('pick'), 'lesson kinds ' + kinds.join(','));
    runSession(); assert(txt().includes('Sprinten klar'), 'lesson summary');
    // run several lessons so words advance into spell/type exercises
    for (let r = 0; r < 4; r++) { click($('[data-chain-next]') || $('[data-act="again"]')); runSession(); }
    const seen = new Set(); // replay once more and record kinds
    click($('[data-chain-next]') || $('[data-act="again"]')); PA().S.queue.forEach(q => seen.add(q.kind)); runSession();
    console.log('exercise kinds seen in later lesson:', [...seen].join(','));
    const wp = PA().DB.profiles.k8.words; assert(Object.values(wp).some(w => w.box >= 2), 'word boxes advance');
    click($('[data-go="home"]'));
    // shop
    PA().DB.profiles.k8.gems = 100; click($('[data-go="shop"]')); assert(txt().includes('Butiken'), 'shop');
    click($('[data-buy="paper_hav"]')); assert(PA().DB.profiles.k8.paper === 'hav' && PA().DB.profiles.k8.gems === 60, 'bought paper');
    assert(document.documentElement.getAttribute('data-paper') === 'hav', 'paper applied');
    assert(!$('[data-buy="pet_robot"]'), 'no pets for teen');
    // kemi quiz sprint
    click($('[data-go="home"]')); click($('[data-subj="no"]')); click($('[data-skill="kemi_ph"]')); assert(['choicetext', 'num', 'open', 'order'].includes(PA().S.queue[0].type), 'kemi question type ' + PA().S.queue[0].type); runSession(); assert(txt().includes('Sprinten klar'), 'kemi summary');
    click($('[data-go="home"]')); click($('[data-test="kemi4"]')); assert(PA().S.queue.length >= 10 && PA().S.queue.every(q => q.skill.group === 'no') && PA().S.queue.some(q => q.type === 'open'), 'kemi test with open: ' + PA().S.queue.map(q => q.type).join(',')); runSession(); assert(txt().includes('Provresultat'), 'kemi result');
    click($('[data-go="home"]')); click($('[data-subj="math"]')); click($('[data-skill="ekvation"]')); runSession(); click($('[data-go="home"]'));
    // blitz
    click($('[data-go="blitz"]')); click($('[data-blitz="talfoljd"]'));
    assert(PA().B && $('[data-bchoice]'), 'blitz started');
    for (let i = 0; i < 6; i++) { const q = PA().B.q; click($(`[data-bchoice="${q.answer}"]`)); }
    assert(PA().B.score === 6, 'blitz score ' + PA().B.score);
    click($('[data-go="blitz"]')); click($('[data-go="home"]'));
    // k2: spanish lesson with choices and spell
    click($('[data-go="start"]')); click($('[data-kid="k2"]')); click($('[data-pet="uggla"]'));
    click($('[data-subj="lang"]')); assert(txt().includes('Hälsa och säg hej'), 'k2 decks');
    click($('[data-subj="sv"]')); assert(txt().includes('Stavning') && txt().includes('Läsförståelse'), 'k2 svenska tab'); click($('[data-skill="sv_stavning"]')); runSession(); assert(txt().includes('Sprinten klar'), 'svenska sprint');
    click($('[data-go="home"]')); click($('[data-subj="no"]')); click($('[data-skill="no_djur"]')); runSession(); assert(txt().includes('Sprinten klar'), 'no sprint'); click($('[data-go="home"]')); click($('[data-subj="lang"]'));
    click($('[data-deck="es_siffror"]')); runSession(); assert(txt().includes('Sprinten klar'), 'k2 lesson');
    click($('[data-go="home"]')); click($('[data-rec]')); runSession(); assert(txt().includes('Sprinten klar'), 'k2 mixed sprint');
    // parent: add exam + deck for k4
    click($('[data-go="home"]')); click($('[data-go="start"]')); click($('[data-go="parent"]'));
    const pins = $$('[data-pin]'); ['1', '2', '3', '4'].forEach((d, i) => { pins[i].value = d; pins[i].dispatchEvent(new window.Event('input', { bubbles: true })); });
    click($('[data-tab="k4"]')); click($('[data-sub="exams"]'));
    $('#exTitle').value = 'Glosförhör v.45'; $('#exDate').value = '2026-11-05';
    click($('[data-act="addExam"]')); assert(PA().DB.profiles.k4.exams.some(e => e.title === 'Glosförhör v.45') && PA().DB.profiles.k4.exams.length === 2, 'exam added (config exam + new one)');
    click($('[data-sub="decks"]'));
    $('#dkName').value = 'Engelska v.44'; $('#dkWords').value = 'dog = hund = 🐶\ncat = katt\nhouse = hus\nblue = blå\ngreen = grön';
    click($('[data-act="saveDeck"]')); const fd = PA().DB.profiles.k4.decks.filter(d => !d.fromConfig); assert(fd.length === 1 && fd[0].words.length === 5 && fd[0].words[0].e === '🐶', 'deck saved');
    click($('[data-sub="settings"]')); click($('[data-setting="focus"]')); assert(PA().DB.profiles.k4.settings.focus === true, 'focus toggled');
    click($('[data-sprint="5"]')); assert(PA().DB.profiles.k4.settings.sprint === 5, 'sprint set');
    // k4 plays the custom deck
    click($('[data-go="start"]')); click($('[data-kid="k4"]'));
    click($('[data-subj="lang"]')); assert(txt().includes('Glosförhör v.45') && txt().includes('Engelska v.44') && txt().includes('Testglosor'), 'k4 home shows exam, deck and config deck');
    click($('[data-deck="' + fd[0].id + '"]')); runSession(); assert(txt().includes('Sprinten klar') || txt().includes('Matchen klar'), 'custom deck lesson');
    click($('[data-go="home"]')); click($('[data-test="gloso1"]')); assert(PA().S.queue.length === 12 && PA().S.queue.every(q => q.cat === 'word'), 'kates day test is words: ' + PA().S.queue.map(q => q.cat).join(',')); runSession(); assert(txt().includes('Provresultat'), 'kates result');
    click($('[data-go="home"]')); click($('[data-subj="so"]')); assert(txt().includes('SO') && txt().includes('Läs på'), 'k4 SO section'); click($('[data-method="geo_klimat"]')); assert(txt().includes('Golfströmmen'), 'read page'); click($('[data-skill="geo_klimat"]')); runSession(); assert(txt().includes('Sprinten klar') || txt().includes('Matchen klar'), 'geo sprint');
    // persistence: reload
    PA().flushSave(); const saved = window.localStorage.getItem('pluggappen.v1'); assert(saved && JSON.parse(saved).profiles.k4.decks.some(d => d.name === 'Engelska v.44') && JSON.parse(saved).profiles.k4.exams.some(e => e.title === 'Glosförhör v.45'), 'persisted');
    console.log('errors:', errors);
    console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE OK');
  } catch (e) { console.log('EXC', e.stack); console.log(txt().slice(0, 300)); process.exitCode = 1; }
}, 400);
