/* Fas 3B – flera enheter (jsdom, dist/index.html, molnet mockat):
   1. Felboken v1: två enheter som får olika fel offline behåller BÅDAS fel efter synk (tidigare skrev den lokala listan över).
      Klarade poster återuppstår inte (gravstenar), men samma glosa som missas igen senare kommer tillbaka.
   2. v2-bevisloggen: union på enhet:löpnummer, samma härledda tillstånd på båda enheterna, skuggposter från båda.
   3. En äldre app som skriver över profilen med inaktuell logg kan inte krympa loggen – nästa nya enhet återställer den. */
'use strict';
const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../dist/index.html', 'utf8').replace(/<script src=[^>]+><\/script>/, '');
const FIX = require('./test_fixture_family.json');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const cloud = {}; let serverClock = Date.UTC(2026, 9, 25, 12);
const mkFetch = () => async (url, opts = {}) => {
  const path = url.split('/documents/')[1].split('?')[0];
  if (!opts.method) { if (!cloud[path]) return { status: 404, ok: false }; return { status: 200, ok: true, json: async () => cloud[path] }; }
  if (opts.method === 'DELETE') { delete cloud[path]; return { status: 200, ok: true, json: async () => ({}) }; }
  serverClock += 1000; cloud[path] = { ...JSON.parse(opts.body), updateTime: new Date(serverClock).toISOString() }; return { status: 200, ok: true, json: async () => cloud[path] };
};
function device(name) {
  const dom = new JSDOM('<!doctype html>' + html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://plugg.example/' });
  const w = dom.window; w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false }); w.HTMLCanvasElement.prototype.getContext = () => null; w.fetch = mkFetch();
  for (const sc of [...w.document.querySelectorAll('script')]) if (sc.textContent.trim()) w.eval(sc.textContent);
  w.__name = name; return w;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function T(w) {
  const $ = (s) => w.document.querySelector(s); const click = (el) => { if (!el) throw new Error('click on null on ' + w.__name); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  let k = 0;
  const answer = (wrongEvery) => { const S = w.PA.S; const item = S.queue[S.i]; k++; const wrong = k % wrongEvery === 0;
    if (item.cat === 'math') {
      if (item.type === 'choicetext' || item.choices) { const el = wrong ? [...w.document.querySelectorAll('[data-choice]')].find(b => b.dataset.choice !== String(item.answer)) : $(`[data-choice="${item.answer}"]`); click(el || $(`[data-choice="${item.answer}"]`)); if ($('#submit') && !$('#next')) click($('#submit')); }
      else if (item.type === 'order') { for (let i = 0; i < item.items.length; i++) click($(`[data-otile="${i}"]`)); click($('#submit')); }
      else if (item.type === 'open') { $('#ans').value = item.model; click($('#submit')); }
      else { $('#ans').value = wrong ? '987654' : item.type === 'num' ? String(item.answer) : item.type === 'expr' ? w.PA.Poly.format(item.answer) : item.answer[0]; click($('#submit')); }
    } else if (item.kind === 'pick' || item.kind === 'listen') click($(`[data-wchoice="${wrong ? item.choices.find(c => c.id !== item.correctId).id : item.correctId}"]`));
    else if (item.kind === 'match') { for (const pr of item.pairs) { click($(`[data-mside="l"][data-mid="${pr.id}"]`)); click($(`[data-mside="r"][data-mid="${pr.id}"]`)); } }
    else if (item.kind === 'spell') { for (const ch of item.target.replace(/\s/g, '')) { const tile = [...w.document.querySelectorAll('[data-tile]')].find(t => !t.classList.contains('used') && t.textContent === ch); click(tile); } click($('#submit')); }
    else if (item.kind === 'type') { $('#ans').value = item.word.w; click($('#submit')); }
    else if (item.kind === 'speak') { click($('#skipSpeak')); return; }
    click($('#next')); };
  const run = (wrongEvery = 3) => { let n = 0; while (w.PA.S && w.PA.S.i < w.PA.S.queue.length && $('#qcard') && n++ < 40) answer(wrongEvery); };
  return { $, click, run };
}
const keys = (le) => new Set(le.log.map(e => e[1] + ':' + e[2]));
(async () => {
  try {
    const A = device('telefon'); await sleep(30);
    A.PA.DB.settings.family = 'le-fam-1'; A.PA.FAMILY.apply(FIX); A.PA.load(); await A.PA.FAMILY.push(); A.PA.rerender(); await A.PA.SYNC.refreshAll();
    const a = T(A); a.click(a.$('[data-kid="k2"]')); a.click(a.$('[data-pet="uggla"]')); a.click(a.$('[data-subj="math"]')); a.click(a.$('[data-skill="plus20"]')); a.run(3); a.click(a.$('[data-go="home"]'));
    A.PA.save(); await sleep(1800);
    const B = device('ipad'); B.PA.DB.settings.family = 'le-fam-1'; await B.PA.FAMILY.pull(); B.PA.load(); await B.PA.SYNC.refreshAll();
    ok(B.PA.DB.profiles.k2.le && B.PA.DB.profiles.k2.le.log.length === A.PA.DB.profiles.k2.le.log.length, 'B received A’s evidence log');
    const devA = A.PA.LE.dev(), devB = B.PA.LE.dev(); ok(devA !== devB, 'devices have distinct ids');
    // offline på båda: olika moment, olika fel
    const b = T(B); B.PA.rerender(); b.click(b.$('[data-kid="k2"]')); b.click(b.$('[data-subj="math"]')); b.click(b.$('[data-skill="minus20"]')); b.run(2); b.click(b.$('[data-go="home"]')); B.PA.save(); B.PA.SYNC.pending.clear(); clearTimeout(B.PA.SYNC.pushTimer);
    a.click(a.$('[data-subj="math"]')); a.click(a.$('[data-skill="tal100"]')); a.run(2); a.click(a.$('[data-go="home"]')); A.PA.save(); A.PA.SYNC.pending.clear(); clearTimeout(A.PA.SYNC.pushTimer);
    const mA = new Set((A.PA.DB.profiles.k2.mistakes || []).map(m => m.id)), mB = new Set((B.PA.DB.profiles.k2.mistakes || []).map(m => m.id));
    ok([...mA].some(x => !mB.has(x)) && [...mB].some(x => !mA.has(x)), 'precondition: devices have different Felboken entries');
    // B laddar upp först, sedan slår A ihop (lokala ändringar) och laddar upp, sedan hämtar B
    await B.PA.SYNC.push('k2'); await A.PA.SYNC.refresh('k2'); await sleep(1800); await B.PA.SYNC.refresh('k2'); await sleep(50);
    const pa = A.PA.DB.profiles.k2, pb = B.PA.DB.profiles.k2;
    const unionIds = new Set([...mA, ...mB]); const fa = new Set(pa.mistakes.map(m => m.id)), fb = new Set(pb.mistakes.map(m => m.id));
    ok([...unionIds].every(x => fa.has(x)), `Felboken bug fixed: merged profile on A keeps both devices’ entries (${fa.size}/${unionIds.size})`);
    ok([...unionIds].every(x => fb.has(x)), 'and B sees the same union after pulling');
    // v2-loggen: union + samma härledda tillstånd
    const kid = (w) => w.PA.KIDS.find(k => k.id === 'k2');
    ok(keys(pa.le).size === keys(pb.le).size && [...keys(pa.le)].every(x => keys(pb.le).has(x)), `evidence logs identical on both devices (${pa.le.log.length} events)`);
    ok(pa.le.log.some(e => e[1] === devA) && pa.le.log.some(e => e[1] === devB), 'log contains events from both devices');
    ok(A.PA.LE2.stable(A.PA.LE.state(kid(A)).L.c) === B.PA.LE2.stable(B.PA.LE.state(kid(B)).L.c), 'derived concept state identical on both devices');
    ok(pa.le.shadow.length === pb.le.shadow.length && pa.le.shadow.length >= 3, `shadow records from both devices merged (${pa.le.shadow.length})`);
    ok(A.PA.LE.errors.length === 0 && B.PA.LE.errors.length === 0, 'no shadow errors on either device');
    // klarad Felboks-post återuppstår inte; ny miss senare kommer tillbaka
    const victim = pa.mistakes.find(m => m.cat === 'math'); const before = pb.mistakes.length;
    A.PA.setKid('k2'); A.PA.DB.profiles.k2.mistakes = pa.mistakes; // (samma objekt)
    // simulera att A klarar posten i Felboken (samma kod som appen använder)
    A.eval(`clearMistake(PA.DB.profiles.k2, ${JSON.stringify(victim.id)}); PA.save();`); await sleep(1800);
    B.PA.DB.profiles.k2.xp += 1; B.PA.setKid('k2'); B.PA.save(); B.PA.SYNC.pending.clear(); clearTimeout(B.PA.SYNC.pushTimer); // B har lokala ändringar och den gamla posten kvar
    await B.PA.SYNC.refresh('k2'); ok(!B.PA.DB.profiles.k2.mistakes.some(m => m.id === victim.id) && B.PA.DB.profiles.k2.mistakes.length === before - 1, 'cleared Felboken entry does not come back from the other device');
    const wm = { id: 'w_testord', at: Date.now() + 5000, cat: 'word', deckId: 'es_djur', wordId: 'testord' }; B.PA.DB.profiles.k2.mistakesCleared = { ...(B.PA.DB.profiles.k2.mistakesCleared || {}), w_testord: Date.now() - 60000 }; B.PA.DB.profiles.k2.mistakes.push(wm);
    const merged = B.eval('mergeProfiles')(B.PA.DB.profiles.k2, A.PA.DB.profiles.k2); ok(merged.mistakes.some(m => m.id === 'w_testord'), 'a word missed again after being cleared comes back (newer than its tombstone)');
    ok(merged.mistakes.length <= 60 && Object.keys(merged.mistakesCleared || {}).length <= 300, 'Felboken and tombstones stay bounded');
    // äldre app skriver över molnet med inaktuell logg → loggen kan inte krympa
    await sleep(1800); B.PA.SYNC.pending.clear(); clearTimeout(B.PA.SYNC.pushTimer); // låt väntande uppladdningar bli klara först
    const full = A.PA.DB.profiles.k2.le.log.length; const doc = cloud['families/le-fam-1/profiles/k2']; const prof = JSON.parse(doc.fields.json.stringValue);
    prof.le = { ...prof.le, log: prof.le.log.slice(0, 5) }; doc.fields.json.stringValue = JSON.stringify(prof); doc.fields.updatedAt.integerValue = String(Date.now() + 100000);
    A.PA.SYNC.pending.clear(); clearTimeout(A.PA.SYNC.pushTimer); A.PA.DB.profiles.k2.updatedAt = A.PA.DB.profiles.k2.syncedAt; // A har inga lokala ändringar
    await A.PA.SYNC.refresh('k2'); await sleep(1800);
    ok(A.PA.DB.profiles.k2.le.log.length === full, 'stale overwrite by an older app cannot shrink the local log');
    const mid = JSON.parse(cloud['families/le-fam-1/profiles/k2'].fields.json.stringValue); ok(mid.le.log.length === 5 && A.PA.DB.profiles.k2.updatedAt > A.PA.DB.profiles.k2.syncedAt, 'no extra immediate upload (no race with another device); marked for the next normal save');
    A.PA.setKid('k2'); A.PA.save(); await sleep(1800);
    const after = JSON.parse(cloud['families/le-fam-1/profiles/k2'].fields.json.stringValue); ok(after.le.log.length === full, 'the next normal save pushes the full log back to the cloud');
    ok(typeof A.PA.LE.skewMs === 'number' && !('skew' in A.PA.DB.profiles.k2.le) && A.PA.DB.profiles.k2.le.srv > 0, 'device clock offset kept on the device (not synced into the profile); server time anchor recorded');
    console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE SYNC TEST FAILED' : 'LE SYNC TEST OK'); process.exit(fails ? 1 : 0);
  } catch (e) { console.log('EXC', e.stack); process.exit(1); }
})();
