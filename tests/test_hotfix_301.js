/* Hotfix 3.0.1 – ägarens fynd i produktionen: Achieve-hemmet lovade provet ("Det här tränar vi idag: …") och KÖR började med en
   glosrepetition vars rubrik var glosbokens namn – det såg ut som en annan övning än passet. Nu:
   · glosor i ett v3-pass har ämnet som rubrik ("Engelska glosor"), Klassisk/v1 som förut (glosbokens namn)
   · hemmet säger vad som repeteras ("Repetition: engelska glosor") och sätter det först när passet börjar med det
   Klassisk (2.1-presentationen) är oförändrad – skyddas av 2.1-sviternas skärmjämförelser (test_exam_cta, test_cta_paths m.fl.).
   Hemmets plan räknas med samma klocka som KÖR (LE.sessClock): annars kunde något som blev aktuellt inom samma minut synas på hemmet men
   inte i passet (hittat av det här testet).
   Riktiga appen i jsdom, SYNTETISK familj (testfixturen), fast klocka. Motorn och planen är oförändrade (bara text). */
'use strict';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js'); const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000; const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
(async () => {
  let found = 0, foundExam = 0, classicSeen = 0, firstWord = 0;
  for (const seed of [3, 7, 11, 19, 23, 29, 31, 37, 41, 43]) {
    const w = mkWin({ seed, fixedClock: true }); await sleep(40); const T = tools(w); const { $, click, PA } = T; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T); const r = rng(seed);
    const kid = () => PA().KIDS.find(k => k.id === 'k8'); const p = () => PA().DB.profiles.k8;
    const iso = (d) => new Date(w.Date.now() + d * DAY).toISOString().slice(0, 10);
    const open = () => { toStart(T); click($('[data-kid="k8"]')); if ($('[data-pet]')) click($('[data-pet]')); };
    for (let d = 0; d < 14; d++) {
      if (d === 4) { p().exams = [{ id: 'e1', title: 'Algebraprov', date: iso(14), skillIds: ['forenkla', 'ekvation', 'multin', 'blandat'], deckIds: [] }]; PA().save(); PA().LE.invalidate('k8'); }
      open(); const plan = PA().V2.peekPlan(kid()).plan; const C = PA().LE.state(kid()); const first = plan[0];
      const deckFirst = first && (first.role === 'remember' || first.role === 'warmup') && (C.cat[first.cid] || {}).kind === 'deck';
      const card = norm(($('section.mission') || {}).textContent);
      const go = $('.go-btn[data-v2="kor"]') || $('[data-v2="kor"]'); if (!go) { w.__advance(DAY); continue; }
      if (deckFirst) {
        found++; const exam = /NÄSTA DEADLINE/.test(card) && /inför provet i dagens plan/.test(card); if (exam) foundExam++;   // 3.6.1: provet i dagens plan står som deadline med andel
        const li0 = $('section.mission .train li'); const ttl = norm(($('section.mission .goal-title') || {}).textContent);
        ok(li0 && /^(engelska|spanska) glosor$/.test(li0.dataset.subj) && /\(repetition\)/.test(li0.textContent) && /^(ENGELSKA|SPANSKA) GLOSOR/.test(ttl), `seed ${seed} dag ${d}: hemmet säger vad som repeteras, och att passet börjar där (${card.slice(0, 160)})`);
        if (exam) ok(li0 && /glosor/.test(li0.dataset.subj) && card.indexOf('NÄSTA DEADLINE') < card.indexOf('DAGENS PLAN'), `seed ${seed} dag ${d}: med prov i passet står glosrepetitionen ändå först i dagens plan (${card.slice(0, 200)})`);
        click(go); const it = PA().S.queue[PA().S.i]; const title = norm($('.topbar .title').textContent);
        if (it.cat === 'word') { firstWord++;
          ok(/^(Engelska|Spanska) glosor$/.test(title) && !title.includes(it.deck.name), `seed ${seed} dag ${d}: passets första uppgift (glosor) har ämnet som rubrik, inte glosbokens namn (${title})`);
          ok(/Kommer du ihåg/i.test(norm($('#app').textContent)), `seed ${seed} dag ${d}: märkt som repetition`); }
        const words = []; let g2 = 0; while (PA().S && PA().S.v2 && $('#qcard') && g2++ < 60) { const q = PA().S.queue[PA().S.i]; if (q.cat === 'word') words.push(norm($('.topbar .title').textContent)); D.answer(() => r() < 0.3); w.__advance(4000); }
        ok(words.length > 0 && words.every(t => /^(Engelska|Spanska) glosor$/.test(t)), `seed ${seed} dag ${d}: glosorna som hemmet lovade kom i passet, med ämnesrubrik (${words.join(', ') || 'inga'})`);
      } else { click(go); D.run(() => r() < 0.3, 60); }
      w.__advance(DAY);
    }
    // Klassisk (2.1-presentationen) är oförändrad: glosbokens namn som förut
    PA().EXP.set(kid(), 'classic'); PA().save();
    for (let d = 0; d < 10 && !classicSeen; d++) { open(); const go = $('.go-btn[data-v2="kor"]') || $('[data-v2="kor"]'); if (!go) { w.__advance(DAY); continue; } click(go);
      let g = 0; while (PA().S && PA().S.v2 && $('#qcard') && g++ < 60) { const q = PA().S.queue[PA().S.i]; if (q.cat === 'word' && !classicSeen) { classicSeen++; ok(norm($('.topbar .title').textContent) === q.deck.name, 'Klassisk: glosbokens namn som rubrik (oförändrat)'); } D.answer(() => r() < 0.3); w.__advance(4000); } w.__advance(DAY); }
  }
  ok(found >= 2, `fallet (passet börjar med glosrepetition) prövades ${found} gånger`);
  ok(firstWord >= 1, `glosor som första uppgift prövades ${firstWord} gånger`);
  ok(foundExam >= 1, `med provrubrik prövades ${foundExam} gånger`);
  console.log(`  · glosrepetition först: ${found} (med prov ${foundExam}), Klassisk med glosor: ${classicSeen}`);
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'HOTFIX 3.0.1 TEST FAILED' : 'HOTFIX 3.0.1 TEST OK'); process.exit(fails ? 1 : 0);
})();
