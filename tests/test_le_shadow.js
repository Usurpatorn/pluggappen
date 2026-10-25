/* Fas 3B – skuggläge i den riktiga appen (jsdom, dist/pluggappen.html).
   1. Barnen får v1: samma slumpfrö + samma klocka ⇒ identiska skärmar och identisk v1-data med skuggan PÅ och AV.
   2. Skuggan fångar varje pass (v1 faktiskt ↔ v2 skugga) och varje mattesvar som bevis – utan fria svarstexter.
   3. Diagnostiken finns bara i föräldraläget; barnets skärmar nämner aldrig v2/skugga; policyöverstyrning syns inte för barnet.
   4. Migrering v1 → le på befintlig profil: v1 orört, deterministisk, idempotent över omladdning; rollback = ta bort le.
   5. Täckning: konceptkatalogen täcker alla moment i alla kursmallar + alla glosdeck, med stabila, unika id:n. */
'use strict';
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../dist/pluggappen.html'), 'utf8');
const FIX = require('./test_fixture_family.json');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const T_FIXED = Date.UTC(2026, 9, 25, 15, 0, 0);
function mkWin({ seed = 0, fixedClock = false, storage = null } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(win) {
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
const strip = (p) => { const o = JSON.parse(JSON.stringify(p)); delete o.le; return o; };
const childFlow = (w, T) => {
  const { $, click, PA, snap, run } = T;
  PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); snap('start');
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

setTimeout(() => {
  try {
    /* ---------- 1. v1 oförändrat: skugga PÅ vs AV ---------- */
    const wOn = mkWin({ seed: 4242, fixedClock: true }), wOff = mkWin({ seed: 4242, fixedClock: true });
    setTimeout(() => {
      try {
        const On = tools(wOn), Off = tools(wOff); Off.PA().LE.on = false;
        childFlow(wOn, On); childFlow(wOff, Off);
        ok(On.snaps.length === Off.snaps.length && On.snaps.length >= 15, 'same number of child screens');
        const diffAt = On.snaps.findIndex((s, i) => s[1] !== Off.snaps[i][1]); ok(diffAt === -1, 'every child screen identical with shadow on/off' + (diffAt >= 0 ? ' – first diff at ' + On.snaps[diffAt][0] : ''));
        for (const id of ['k2', 'k4', 'k8']) ok(JSON.stringify(strip(On.PA().DB.profiles[id])) === JSON.stringify(strip(Off.PA().DB.profiles[id])), `v1 data identical with shadow on/off (${id}: xp, mastery, levels, Felboken, words, quests, streak …)`);
        ok(!Off.PA().DB.profiles.k2.le && On.PA().DB.profiles.k2.le, 'shadow off writes nothing; shadow on adds only p.le');
        /* ---------- 2. fångst ---------- */
        const PA = On.PA(); ok(PA.LE.errors.length === 0, 'no shadow errors: ' + JSON.stringify(PA.LE.errors));
        const les = ['k2', 'k4', 'k8'].map(id => PA.DB.profiles[id].le); const events = les.reduce((a, le) => a + le.log.length, 0);
        ok(events === On.mathAnswers, `one evidence event per math answer (${events} / ${On.mathAnswers}); blitz excluded`);
        const recs = les.flatMap(le => le.shadow); ok(recs.length >= 9 && recs.every(r => r.done === 1 && r.v1.length && r.v2.length), `every session has a completed v1↔v2 record (${recs.length})`);
        ok(recs.some(r => r.src === 'kor') && recs.some(r => r.src === 'test') && recs.some(r => r.src === 'lang') && recs.some(r => r.src === 'skill'), 'sources: Kör!, test, language lesson, single skill');
        ok(recs.filter(r => r.src === 'test').every(r => PA.DB.profiles.k8.le.log.filter(e => e[11] === r.id).every(e => e[8] === 'e')), 'test-mode answers logged as exam context');
        const leJson = JSON.stringify(les); ok(!/ZZQX|987654|zzqx|vet inte/.test(leJson), 'no free-text answers stored in le');
        ok(!/"(ms|elapsed|rt|time)"/.test(leJson), 'no response-time telemetry stored (only a fast flag on wrong answers)');
        ok(les.every(le => JSON.stringify(le).length < 60000), 'le stays small (' + les.map(le => Math.round(JSON.stringify(le).length / 1024) + ' kB').join(', ') + ')');
        const k2 = PA.DB.profiles.k2.le; const first = k2.shadow[0]; ok(first.v1.every(c => /^[sd]:/.test(c)), 'v1 actual recorded as concept ids');
        /* ---------- 3. bara i föräldraläget ---------- */
        const childText = On.snaps.map(s => s[1]).join('\n'); ok(!/skugg|Learning Engine|Motor v2|v2 skulle/i.test(childText), 'child screens never mention v2/shadow');
        const { $, click } = On; click($('[data-go="start"]')); click($('[data-kid="k2"]')); const homeBefore = $('#app').innerHTML;
        click($('[data-go="start"]')); click($('[data-go="parent"]'));
        const pins = [...wOn.document.querySelectorAll('[data-pin]')]; ['1', '2', '3', '4'].forEach((d, i) => { pins[i].value = d; pins[i].dispatchEvent(new wOn.Event('input', { bubbles: true })); });
        click($('[data-tab="k2"]')); click($('[data-sub="v2"]')); const pt = $('#app').textContent;
        ok(/skuggläge/.test(pt) && /v1 faktiskt/.test(pt) && /Nästa Kör!/.test(pt) && /Det som ska bedömas före 3C/.test(pt), 'parent v2 diagnostics render');
        for (const label of ['Kalibrering', 'Träffsäkerhet vid hämtning', 'Förfallna nu / imorgon', 'Felboken v2', 'Snabba fel (K-12)', 'Planernas överlapp', 'Ämnesbalans v1', 'Ny inlärning', 'Prov inom 21 dagar']) ok(pt.includes(label), 'diagnostic present: ' + label);
        ok(/jämförelseband, inte ett mål/.test(pt), 'accuracy shown as comparison band, not a target');
        click($('[data-le-pol="older"]')); ok(PA.DB.profiles.k2.settings.lePolicy === 'older' && /överstyrd/.test($('#app').textContent), 'parent policy override (O-9)');
        click($('[data-tab="settings"]')); ok(/Learning Engine v2 · skuggläge/.test($('#app').textContent), 'settings: shadow summary for all children');
        click($('[data-go="start"]')); click($('[data-kid="k2"]')); ok($('#app').innerHTML === homeBefore, 'child home unchanged by policy override');
        ok(PA.LE.errors.length === 0, 'still no shadow errors');
        /* ---------- 4. omladdning, migrering, rollback ---------- */
        PA.flushSave(); const store = { 'pluggappen.v1': wOn.localStorage.getItem('pluggappen.v1'), 'pluggappen.family.v1': wOn.localStorage.getItem('pluggappen.family.v1'), 'pluggappen.dev': wOn.localStorage.getItem('pluggappen.dev') };
        const liveL = PA.LE2.stable(PA.LE.state(PA.KIDS.find(k => k.id === 'k2')).L);
        const w2 = mkWin({ storage: store });
        setTimeout(() => {
          try {
            const P2 = w2.PA; const kid2 = P2.KIDS.find(k => k.id === 'k2');
            ok(P2.LE2.stable(P2.LE.state(kid2).L) === liveL, 'after reload: replayed state == live state');
            // befintlig v1-profil utan le
            const v1prof = JSON.parse(store['pluggappen.v1']); for (const id of Object.keys(v1prof.profiles)) delete v1prof.profiles[id].le;
            const s3 = { ...store, 'pluggappen.v1': JSON.stringify(v1prof) }; const w3 = mkWin({ storage: s3, fixedClock: true }), w4 = mkWin({ storage: s3, fixedClock: true });
            setTimeout(() => {
              try {
                const P3 = w3.PA, P4 = w4.PA; const k8a = P3.KIDS.find(k => k.id === 'k8'), k8b = P4.KIDS.find(k => k.id === 'k8');
                const before = JSON.stringify(P3.DB.profiles.k8); P3.LE.ensure(k8a); P4.LE.ensure(k8b);
                ok(JSON.stringify(strip(P3.DB.profiles.k8)) === before, 'migration leaves every v1 field byte-identical');
                ok(P3.LE2.stable(P3.DB.profiles.k8.le) === P4.LE2.stable(P4.DB.profiles.k8.le), 'migration deterministic across devices (same profile, same time)');
                const c = P3.DB.profiles.k8.le.base.c; ok(Object.keys(c).length > 0 && Object.values(c).every(x => x.st <= 2), 'migrated: concepts from v1 skills, none above stage 2');
                const leA = P3.LE2.stable(P3.DB.profiles.k8.le); P3.load(); P3.LE.invalidate('k8'); P3.LE.ensure(k8a); ok(P3.LE2.stable(P3.DB.profiles.k8.le) === leA, 'reload + ensure is idempotent');
                // rollback: ta bort le → v1 fungerar, ingen krasch, skuggan börjar om
                delete P3.DB.profiles.k8.le; P3.LE.invalidate('k8'); const T = tools(w3); T.click(T.$('[data-kid="k8"]')); T.click(T.$('[data-rec]')); T.run(); ok(/klar/i.test(T.$('#app').textContent) && P3.LE.errors.length === 0, 'rollback (le removed): v1 session works, shadow restarts cleanly');
                /* ---------- 5. katalogtäckning ---------- */
                const cov = []; const fam = { v: 1, updatedAt: 1, kids: Object.keys(P3.TEMPLATES).map((t, i) => ({ id: 'c' + i, name: 'C' + i, template: t, theme: 'pet', hue: 'teal', emoji: '🙂', exams: [], decks: [] })) };
                P3.FAMILY.apply(fam); P3.load();
                for (const kid of P3.KIDS) {
                  const p = P3.DB.profiles[kid.id]; const decks = [...P3.BUILTIN_DECKS, ...p.decks]; const b = P3.LECAT.build(kid, decks, null);
                  const skillIds = kid.skills.map(s => s.id); const dup = skillIds.filter((x, i) => skillIds.indexOf(x) !== i);
                  ok(!dup.length, `${kid.template}: unique skill ids (dups: ${dup})`);
                  ok(skillIds.every(id => b.map[id] === 's:' + id && b.cat['s:' + id]), `${kid.template}: every skill has a concept (${skillIds.length})`);
                  ok(decks.every(d => b.cat['d:' + d.id]), `${kid.template}: every deck has a concept (${decks.length})`);
                  ok(Object.values(b.cat).every(c => c.subject && c.name && c.maxLvl >= 1), `${kid.template}: complete concept definitions`);
                  // varje uppgift från varje generator på varje nivå hamnar på sitt koncept och får ett stabilt uppgifts-id
                  let items = 0, bad = 0; for (const s of kid.skills) for (let lv = 1; lv <= (s.maxLvl || 3); lv++) for (let r = 0; r < 4; r++) { const q = s.gen(lv, {}); q.skill = s; q.cat = 'math'; items++; if (P3.LECAT.cidOfItem(q) !== 's:' + s.id || !/^i[0-9a-z]+$/.test(P3.LECAT.itemId(q)) || P3.LECAT.itemId(q) !== P3.LECAT.itemId(JSON.parse(JSON.stringify({ type: q.type, text: q.text })))) bad++; }
                  ok(bad === 0, `${kid.template}: ${items} generated items map to concept + stable item id`); cov.push(`${kid.template}: ${items} genererade uppgifter → rätt koncept`);
                  const bySubj = {}; for (const c of Object.values(b.cat)) bySubj[c.subject] = (bySubj[c.subject] || 0) + 1; cov.push(`${kid.template}: ${Object.keys(b.cat).length} koncept (${Object.entries(bySubj).map(([k, v]) => k + ' ' + v).join(', ')})`);
                }
                ok(FIX.kids.every(k => k.exams.every(e => e.skillIds.every(id => P3.KIDS.length))), 'fixture exams reference known skills');
                console.log('Katalog: ' + cov.join(' · '));
                console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE SHADOW TEST FAILED' : 'LE SHADOW TEST OK'); process.exit(fails ? 1 : 0);
              } catch (e) { console.log('EXC', e.stack); process.exit(1); }
            }, 300);
          } catch (e) { console.log('EXC', e.stack); process.exit(1); }
        }, 300);
      } catch (e) { console.log('EXC', e.stack); process.exit(1); }
    }, 300);
  } catch (e) { console.log('EXC', e.stack); process.exit(1); }
}, 10);
