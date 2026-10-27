/* 3.3 Fas A – korrekthet och användbarhet (riktiga appen i jsdom, fast klocka, syntetisk familj).
   1. "Vilket påstående är fel?": det man valde i stället är SANT – det märks "Stämmer", aldrig rött, och texten säger
      "det du valde stämmer – det var inte felet". Felet märks "stämmer inte". Gäller alla v2-upplevelser och Testa mig-resultatet.
   2. Testa mig: ett tryck väljer, Svara lämnar in (inget feltryck räknas); ingen rätt/fel-färg eller återkoppling under testet.
   3. Läs upp på återkoppling och förklaringar – inte när läsningen själv prövas.
   4. Startsidan: inga syskonjämförelser (nivå, streak, dagens antal) – bara det som behövs för att välja sig själv. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js');
const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

(async () => {
  try {
    const w = mkWin({ seed: 31, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T);
    const doc = w.document; const kidOf = (id) => PA().KIDS.find(k => k.id === id);
    // ett "vilket är fel?"-exempel ur paketen (svaret är det felaktiga påståendet)
    const P = PA().PACKS; const rnd = rng(9); let q0 = null;
    for (const pol of ['older', 'middle', 'younger']) for (const cid of Object.keys(P.REG.kp)) for (const v of P.variants(cid, pol)) { if (q0 || v.form !== 'mistake') continue; const dir = v.key.split('|').pop(); if (dir !== 'false') continue; const q = P.buildVariant(cid, v, rnd, pol); if (q && q.isError === true && Array.isArray(q.choices) && q.ui !== 'tap') q0 = q; }
    ok(!!q0, 'ett "vilket är fel?"-exempel finns');
    const inject = (kidId, exp) => { if (exp) PA().EXP.set(kidOf(kidId), exp); openKid(T, kidId); if (!T.$('.go-btn[data-v2="kor"]') && !T.$('[data-v2="kor"]')) { w.__advance(DAY); openKid(T, kidId); } T.click(T.$('.go-btn[data-v2="kor"]') || T.$('[data-v2="kor"]'));
      let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && PA().S.queue[PA().S.i].cat !== 'math' && g++ < 10) { D.answer(() => false); w.__advance(4000); }
      const S = PA().S; const it = S.queue[S.i]; S.queue[S.i] = { ...q0, skill: kidOf(kidId).skills[0], cat: 'math', level: 2, spec: { ...(it.spec || {}), role: 'focus', help: 'none' }, _slotEnd: true }; PA().rerender(); return S; };
    /* 1. övning: fel val (ett sant påstående) och rätt val (felet) i alla v2-upplevelser och Klassisk */
    for (const [kidId, exp] of [['k8', 'achieve'], ['k4', 'grow'], ['k2', 'explore'], ['k8', 'classic']]) for (const wrong of [true, false]) {
      inject(kidId, exp); const right = q0.answer; const pick = wrong ? (right + 1) % q0.choices.length : right;
      T.click(T.$(`[data-choice="${pick}"]`)); if (T.$('#submit') && !T.$('#next')) T.click(T.$('#submit'));
      const picked = T.$(`[data-choice="${pick}"]`), answer = T.$(`[data-choice="${right}"]`); const fbt = norm((T.$('#fb .feedback') || {}).textContent);
      if (wrong) { ok(picked.classList.contains('true-pick') && !picked.classList.contains('no'), `${exp}: det sanna påståendet man valde är aldrig rött (${picked.className})`);
        ok(!doc.querySelector('#qcard :is(.choice, .wchoice, .tapword).no'), `${exp}: inget rött alternativ i ett "vilket är fel?"-svar`);
        ok(/Det du valde stämmer – det var inte felet/.test(fbt) && /Felet var:/.test(fbt) && !/Rätt svar:/.test(fbt), `${exp}: texten skiljer "fel val" från "falskt påstående" (${fbt.slice(0, 90)})`); }
      else ok(/Du hittade felet/.test(fbt) && /stämmer inte/.test(fbt), `${exp}: rätt val – felet sägs vara det som inte stämmer (${fbt.slice(0, 80)})`);
      ok(answer.classList.contains('ok') && (exp === 'classic' || T.$('#qcard').dataset.iserr === '1'), `${exp}: felet är märkt som svaret`);
      if (T.$('#next')) T.click(T.$('#next')); w.__advance(4000); toStart(T); }
    PA().EXP.set(kidOf('k8'), 'achieve');

    /* 2. Testa mig: välj, ändra, lämna in – ingen återkoppling, inget feltryck räknas; resultatet säger samma sak som övningen */
    { const p = PA().DB.profiles.k8; const C = PA().LE.state(kidOf('k8')); const seen = Object.keys(C.L.c).filter(c => c.startsWith('s:') && C.L.c[c].n).map(c => c.slice(2));
      p.exams = [{ id: 'ea', title: 'Matteprov', date: new Date(PA().LE.now() + 8 * DAY).toISOString().slice(0, 10), skillIds: seen.slice(0, 3).length ? seen.slice(0, 3) : kidOf('k8').skills.slice(0, 2).map(s => s.id), deckIds: [] }]; PA().save(); PA().LE.invalidate('k8'); }
    openKid(T, 'k8'); ok(!!T.$('[data-v2="testa"]'), 'Testa mig finns'); T.click(T.$('[data-v2="testa"]'));
    { const S = PA().S; ok(!!(S && S.v2 && S.v2.exam), 'Testa mig startade'); const it = S.queue[S.i]; S.queue[S.i] = { ...q0, skill: kidOf('k8').skills[0], cat: 'math', level: 2, spec: { ...(it.spec || {}), help: 'none' }, _slotEnd: true }; PA().rerender();
      const right = q0.answer; const wrongPick = (right + 1) % q0.choices.length; const before = S.i;
      T.click(T.$(`[data-choice="${right}"]`)); ok(PA().S.i === before && !!T.$('#submit') && !T.$('#submit').disabled, 'Testa mig: ett tryck väljer, lämnar inte in');
      T.click(T.$(`[data-choice="${wrongPick}"]`)); ok(PA().S.i === before && T.$(`[data-choice="${wrongPick}"]`).classList.contains('sel') && !T.$(`[data-choice="${right}"]`).classList.contains('sel'), 'Testa mig: valet går att ändra');
      ok(!doc.querySelector('#qcard .ok, #qcard .no, #qcard .true-pick, #fb .feedback'), 'Testa mig: ingen rätt/fel-färg eller återkoppling innan Svara');
      T.click(T.$('#submit')); ok(PA().S.i === before + 1 || !T.$('#qcard'), 'Testa mig: Svara lämnar in');
      ok(PA().S.v2.answers[PA().S.v2.answers.length - 1].ok === false, 'Testa mig: det inlämnade (ändrade) valet räknas');
      let n = 0, taps = 0, words = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && n++ < 40) { const cur = PA().S.queue[PA().S.i]; const b4 = PA().S.i;
        const ch = T.$('#qcard [data-choice], #qcard [data-wchoice]'); if (ch) { taps++; if (ch.dataset.wchoice != null) words++; T.click(ch); ok(PA().S.i === b4 && !doc.querySelector('#qcard .ok, #qcard .no'), `Testa mig: tryck utan inlämning (${cur.cat}/${cur.type || cur.kind})`); T.click(T.$('#submit')); ok(PA().S.i !== b4 || !T.$('#qcard'), 'Testa mig: Svara lämnar in'); }
        else D.answer(() => false); }
      console.log(`  Testa mig: ${taps} flerval prövade (${words} ord)`);
      const res = norm(T.$('#app').textContent); ok(/det stämmer, men det var inte felet/.test(res) && /Felet var:/.test(res), 'Testa mig-resultatet: fel val av ett sant påstående sägs som det är'); }

    /* 3. Läs upp återkopplingen (Yngre, enhetens röst) – inte för läsförståelse */
    { const spoken = []; const tts = PA().TTS; try { Object.defineProperty(tts, 'ok', { value: true, configurable: true, writable: true }); } catch (e) { tts.ok = true; } const sp0 = tts.speak; tts.speak = (t) => spoken.push(String(t));
      let shown = 0, readOff = 0;
      for (let d = 0; d < 3; d++) { openKid(T, 'k2'); const b = T.$('.go-btn[data-v2="kor"]') || T.$('[data-v2="flow"]'); if (!b) { w.__advance(DAY); continue; } T.click(b); let g = 0;
        while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 40) { const it = PA().S.queue[PA().S.i];
          if (it.cat === 'learn') { const tb = it.spec.role === 'intro' ? T.$('#qcard [data-speak]') : T.$('#qcard .fb-say'); if (it.skill && (it.skill.readAloud === false || PA().V2.READ_OFF.has(it.skill.id))) ok(!tb, 'förklaringskort i läsförståelse: ingen uppläsning'); else if (it.ex) ok(!!tb && (it.spec.role === 'intro' || /Svar:/.test(tb.dataset.speak || '')), `förklaringskortet kan läsas upp (${it.spec.role})`); D.answer(() => false); w.__advance(4000); continue; }
          const T2 = { ...T, click: (el) => { if (el && el.id === 'next') return; T.click(el); } }; const D2 = v2tools(w, T2); try { D2.answer(() => true); } catch (e) { /* Nästa hålls kvar */ }
          const btn = T.$('#fb .fb-say'); const canRead = PA().V2.canSpeak(it);
          if (it.cat === 'math' && T.$('#fb .feedback')) { if (canRead) { shown++; ok(!!btn, `återkopplingen kan läsas upp (${it.skill && it.skill.id})`); if (btn) { const n0 = spoken.length; T.click(btn); ok(spoken.length === n0 + 1 && spoken[n0].includes(norm(T.$('#fb .feedback .big').textContent)), 'uppläsningen läser det som står i återkopplingen'); } } else { readOff++; ok(!btn, 'läsförståelse: ingen uppläsning av återkopplingen'); } }
          if (T.$('#next')) T.click(T.$('#next')); w.__advance(4000); }
        w.__advance(DAY); }
      // riktat: samma fråga i ett moment där läsningen prövas → ingen uppläsning av återkopplingen
      { openKid(T, 'k2'); const b = T.$('.go-btn[data-v2="kor"]') || T.$('[data-v2="flow"]'); if (!b) { w.__advance(DAY); openKid(T, 'k2'); } T.click(T.$('.go-btn[data-v2="kor"]') || T.$('[data-v2="flow"]'));
        let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && PA().S.queue[PA().S.i].cat !== 'math' && g++ < 10) { D.answer(() => false); w.__advance(4000); }
        const S = PA().S; const it = S.queue[S.i]; S.queue[S.i] = { ...it, skill: { ...it.skill, id: 'sv_lasa', readAloud: false } }; PA().rerender();
        const T2 = { ...T, click: (el) => { if (el && el.id === 'next') return; T.click(el); } }; try { v2tools(w, T2).answer(() => true); } catch (e) { /* Nästa hålls kvar */ }
        readOff++; ok(!!T.$('#fb .feedback') && !T.$('#fb .fb-say'), 'läsförståelse (riktat): ingen uppläsning av återkopplingen'); toStart(T); }
      tts.speak = sp0; console.log(`  Läs upp: ${shown} återkopplingar med knapp, ${readOff} utan (läsning prövas)`); ok(shown > 3 && readOff > 0, 'uppläsning av återkoppling prövad, också där den inte ska finnas'); }

    /* 4. Startsidan: inga syskonjämförelser */
    toStart(T); const cards = [...doc.querySelectorAll('.kid-card')]; ok(cards.length === 3, 'tre barnkort');
    for (const c of cards) { const t = norm(c.textContent); ok(!/Nivå|🔥|idag|XP|💎/.test(t) && !c.querySelector('.pill'), `barnkortet visar bara namn och klass (${t})`); }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'FAS A TEST FAILED' : 'FAS A TEST OK'); process.exit(fails ? 1 : 0);
})();
