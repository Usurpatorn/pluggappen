/* 3.3 slutpasset – presentation och text, ingen logik (riktiga appen i jsdom, fast klocka, syntetisk familj).
   1. Ett svarssätt för flerval i v3: ett tryck på ett alternativ svarar (ingen Svara-knapp). Klassisk är oförändrad.
   2. Knappsatsen ligger under knappraden: Svara direkt under svaret, knapparna under; efter svaret döljs knappsatsen.
   3. En etikett per läge: rollen står på kortet, räknaren säger bara "N kvar", inga dubbla rubriker i förklaringskorten,
      Revansch förklaras en gång per pass, Rescue upprepar inte förklaringen barnet just läst (ledtråden räcker).
   4. Grow: rundan har en mållinje, "Dina N områden" stämmer med siffrorna.
   5. KLAR: Explore – hel stjärnstig och följeslagaren; Grow – slutsignal; Achieve – planen som en rad som stämmer med passet;
      chips utan ikoner (utom 💎); det som hände utöver passet som samma slags rad.
   6. Föräldraläget: barn, flikar och Testa som barnet i en egen spalt (två spalter på iPad med CSS), det valda i den andra.
   Rättning, bevis och plan prövas av de andra sviterna – här bara att presentationen säger samma sak som läget. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { v2tools, toStart, unlockParent } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const EMOJI = /\p{Extended_Pictographic}/u;

(async () => {
  try {
    const w = mkWin({ seed: 21, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender();
    let holdNext = false; const D = v2tools(w, { ...T, click: (el) => { if (holdNext && el && el.id === 'next') { holdNext = false; return; } T.click(el); } });   // stannar på återkopplingen när testet vill se den
    const doc = w.document; const C = { chal: 0, tap: 0, keypad: 0, rescueHint: 0, revWhy: 0, revItems: 0, klar: { explore: 0, grow: 0, achieve: 0 }, rows: 0, learnV3: 0, pet: 0, growFlag: 0 };
    let rr = 7; const rnd = () => { rr = (rr * 1103515245 + 12345) & 0x7fffffff; return rr / 0x7fffffff; };
    for (let d = 0; d < 6; d++) {
      for (const id of ['k2', 'k4', 'k8']) for (const btn of ['.go-btn[data-v2="kor"]', '[data-v2="flow"]', '[data-v2="revansch"]']) {
        openKid(T, id); if (!T.$(btn)) continue; T.click(T.$(btn)); const exp = PA().S && PA().S.v2 && PA().S.v2.exp; let g = 0, whyN = 0, prev = null;
        while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 80) {
          const S = PA().S; const it = S.queue[S.i]; const exam = !!S.v2.exam; const wrong = rnd() < 0.3;
          // 3. etiketter
          const chips = [...doc.querySelectorAll('.act-chip')]; ok(chips.length <= 1, `${id}: högst en etikett på kortet (${chips.map(c => norm(c.textContent)).join(' | ')})`);
          const lc = norm((T.$('.left-count') || {}).textContent); if (!exam) ok((/^\d+ kvar$/.test(lc) && lc !== '0 kvar') || lc === 'Snart klart', `${id}: räknaren säger bara "N kvar" (eller "Snart klart" när inget planerat är kvar): "${lc}" (${it.cat}/${it.spec && it.spec.role})`);
          if (it.cat === 'learn') { C.learnV3++; const eb = [...doc.querySelectorAll('#qcard .eyebrow')].map(e => norm(e.textContent));
            ok(!eb.some(t => /^(Vi tar det tillsammans|Steg för steg|En kort förklaring först|Något nytt)$/i.test(t)), `${id}: förklaringskortet upprepar inte etiketten (${eb.join(' | ')})`); }
          const why = T.$('.role-why'); if (why) { whyN++; C.revWhy++; ok(it.spec && it.spec.role === 'revansch', `${id}: Revansch-förklaringen bara på en Revansch-uppgift`); }
          if (it.spec && it.spec.role === 'revansch') C.revItems++;
          if (it.spec && it.spec.mode === 'challenge' && !exam && !it.paper && !it.rhythm) { C.chal++; ok(chips.length === 1 && /UTMANING/.test(chips[0].textContent) && (exp !== 'grow' || /NÄSTA NIVÅ/.test(chips[0].textContent)), `${id}: Utmaningen syns som Utmaning (${chips.map(c => norm(c.textContent))})`); }
          if (exp === 'grow' && !exam) { ok(!!T.$('.progress-row .pg-end'), `${id}: Grow-rundan har en mållinje`); C.growFlag++; }
          // 3. Rescue: ledtråden räcker när barnet just läst förklaringen
          if (it.cat === 'math' && it.spec && it.spec.help === 'rescue' && !exam) { const fbt = norm((T.$('#fb .hint') || {}).textContent); const justRead = !!(prev && prev.cat === 'learn' && prev.spec && prev.spec.role === 'rescue');
            if (justRead && it.hint) { C.rescueHint++; ok(!/Första steget/.test(fbt) && fbt.length > 0, `${id}: Rescue efter förklaringen – bara ledtråden ("${fbt.slice(0, 60)}")`); }
            else if (it.steps && it.steps[0]) ok(/Första steget/.test(fbt), `${id}: Rescue utan nyss läst förklaring visar första steget`); }
          // 2. knappsatsen under knappraden
          const kp = T.$('#keypad');
          if (kp) { C.keypad++; const act = T.$('#actions'), sub = T.$('#submit'), key = kp.querySelector('[data-key]');
            ok(!doc.querySelector('#inputArea .keys'), `${id}: inga knappar kvar i svarsrutan`);
            ok(act && (act.compareDocumentPosition(kp) & 4), `${id}: knappsatsen ligger efter knappraden`);
            ok(sub && key && (sub.compareDocumentPosition(key) & 4), `${id}: Svara ligger före knapparna`); }
          // 1. ett tryck på ett alternativ svarar (v3, inte sortera/para ihop/ordna/bygg)
          const single = it.cat === 'math' && !it.build && !['sort', 'match', 'order'].includes(it.type) && (it.type === 'choicetext' || Array.isArray(it.choices));
          if (single) { C.tap++; ok(!T.$('#submit'), `${id}: ingen Svara-knapp vid flerval (${it.type})`); const before = S.i;
            const el = wrong ? [...doc.querySelectorAll('[data-choice]')].find(b => b.dataset.choice !== String(it.answer)) : T.$(`[data-choice="${it.answer}"]`); T.click(el || T.$(`[data-choice="${it.answer}"]`));
            ok(exam ? (PA().S && PA().S.i !== before) || !PA().S.v2 || !T.$('#qcard') : !!T.$('#next'), `${id}: ett tryck svarade (${it.type})`);
            if (!exam && T.$('#next')) T.click(T.$('#next')); prev = it; w.__advance(4000); continue; }
          holdNext = !!(kp && !exam); D.answer(() => wrong);
          if (kp && !exam) { ok(!!T.$('#next') && [...doc.querySelectorAll('#keypad .keys')].every(k => k.hidden || k.style.display === 'none'), `${id}: knappsatsen döljs efter svaret, Nästa finns`); holdNext = false; if (T.$('#next')) T.click(T.$('#next')); }
          prev = it; w.__advance(4000);
        }
        ok(whyN <= 1, `${id}: Revansch förklaras högst en gång per pass (${whyN})`);
        // 5. KLAR
        const klar = T.$('.klar'); if (!klar) continue; const e = [...klar.classList].find(c => /^klar-(explore|grow|achieve)$/.test(c)); if (!e) continue; const ex = e.slice(5); C.klar[ex]++;
        const chipT = [...klar.querySelectorAll('.klar-chips > div')].map(c => norm(c.textContent)); ok(chipT.length <= 3 && chipT.every(t => !EMOJI.test(t.replace('💎', ''))), `${id}: KLAR-chips är text (${chipT.join(' | ')})`);
        if (ex === 'explore') { const dots = [...klar.querySelectorAll('.klar-path .dot')]; const slots = +((klar.querySelector('.klar-path').getAttribute('aria-label') || '').match(/(\d+) saker/) || [])[1]; ok(dots.length > 0 && dots.length === slots && dots.every(x => x.classList.contains('ok') && /⭐|👑/.test(x.textContent)), `${id}: hel stjärnstig, en stjärna per klar uppgift (${dots.length} / ${slots})`);
          const pet = PA().DB.profiles[id].pet; if (pet && pet !== 'none') { C.pet++; const km = norm((klar.querySelector('.klar-mark.has-pet .km-e') || {}).textContent); ok(!!km && !/🗺️/.test(km), `${id}: följeslagaren är med på KLAR (${km})`); }
          else ok(!klar.querySelector('.has-pet'), `${id}: ingen följeslagare – kartan`); }
        if (ex === 'grow') ok(norm((klar.querySelector('.klar-eyebrow') || {}).textContent) === 'Slutsignal' && !!klar.querySelector('.klar-level'), `${id}: Grow-KLAR med slutsignal och nivå`);
        if (ex === 'achieve' && btn.includes('flow')) ok(!klar.querySelector('.klar-plan'), `${id}: extrapasset har ingen planrad`);
        else if (ex === 'achieve') { const pl = klar.querySelector('.klar-plan .progress'); const m = pl && (pl.getAttribute('aria-label') || '').match(/^(\d+) av (\d+) uppgifter gjorda$/); const segs = pl ? pl.children.length : 0; const done = pl ? pl.querySelectorAll('i.done').length : -1; const cap = norm((klar.querySelector('.klar-plan .kp-s') || {}).textContent);
          ok(!!m && +m[2] === segs && +m[1] === done && (done === segs ? cap === `Alla ${segs} uppgifter gjorda` : cap === `${done} av ${segs} uppgifter gjorda`), `${id}: Achieve-KLAR – planen stämmer (${pl && pl.getAttribute('aria-label')} / ${cap})`);
          ok(!klar.querySelector('.km-e'), `${id}: Achieve-KLAR utan figur`);
          const saved = /sparas till nästa gång|Bossen väntar/.test(norm(klar.textContent)); if (done < segs) ok(saved, `${id}: Achieve-KLAR – det som inte hanns säger varför`); }
        const loose = [...doc.querySelectorAll('.stack > .card.muted')].filter(c => /^Uppdrag klart:/.test(norm(c.textContent))); ok(loose.length === 0, `${id}: uppdragen är en riktig rad, inte en grå lapp`);
        C.rows += doc.querySelectorAll('.klar-row').length;
        doc.querySelectorAll('.klar-row').forEach(r => ok(!!r.querySelector('.kr-i') && !!r.querySelector('.kr-t b'), `${id}: KLAR-rad med ikon och rubrik`));
      }
      w.__advance(DAY);
    }
    // 4. Grow: Dina N områden – N är summan av siffrorna
    openKid(T, 'k4'); { const gp = T.$('.grow-prog'); if (gp) { const n = +(norm(gp.querySelector('.gp-head').textContent).match(/^Dina (\d+) områden$/i) || [])[1]; const sum = [...gp.querySelectorAll('.progress-states b')].reduce((a, b) => a + +b.textContent, 0);
      ok(n > 0 && n === sum, `Grow: "Dina ${n} områden" = ${sum}`); } else ok(false, 'Grow-hemmet visar Dina områden'); }
    console.log(`  utmaningar ${C.chal}, flerval med ett tryck ${C.tap}, knappsats ${C.keypad}, LÄR-kort ${C.learnV3}, Rescue med bara ledtråd ${C.rescueHint}, Revansch-uppgifter ${C.revItems} (förklarade ${C.revWhy}), Grow-mållinje ${C.growFlag}, KLAR ${JSON.stringify(C.klar)}, följeslagare ${C.pet}, KLAR-rader ${C.rows}`);
    ok(C.tap > 20 && C.keypad > 5 && C.learnV3 > 5 && C.revItems > 0 && C.revWhy > 0 && C.klar.explore > 2 && C.klar.grow > 2 && C.klar.achieve > 2 && C.rows > 0, 'tillräckligt mycket prövat');

    // 1c. Riktat: flerval med tal i Grow och Achieve (ovanligt i passen) – ett tryck svarar, ingen Svara-knapp
    for (const [kid, sk] of [['k4', 'mult'], ['k8', 'talfoljd']]) { openKid(T, kid); if (!T.$('.go-btn[data-v2="kor"]')) { ok(false, `${kid}: inget pass att pröva i`); continue; } T.click(T.$('.go-btn[data-v2="kor"]'));
      let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && PA().S.queue[PA().S.i].cat !== 'math' && g++ < 10) { D.answer(() => false); w.__advance(4000); }
      const S = PA().S; const k = PA().KIDS.find(x => x.id === kid); const s = k.skills.find(x => x.id === sk); let q = null; for (let i = 0; i < 60 && !(q && Array.isArray(q.choices) && q.type !== 'choicetext'); i++) q = PA().makeQuestion(k, s, 1 + (i % 3));
      ok(!!(q && q.choices), `${kid}: ett flerval med tal att pröva`); if (!q || !S || !S.v2) continue;
      const cur = S.queue[S.i]; S.queue[S.i] = { ...q, cat: 'math', spec: cur.spec, _slotEnd: cur._slotEnd }; PA().rerender();
      ok(!T.$('#submit') && doc.querySelectorAll('#qcard [data-choice]').length === q.choices.length, `${kid}: flerval med tal utan Svara-knapp`);
      T.click(T.$(`[data-choice="${q.choices.find(c => String(c) !== String(q.answer))}"]`)); ok(!!T.$('#next') && /feedback/.test((T.$('#fb') || {}).innerHTML || ''), `${kid}: ett tryck på ett tal svarade`); toStart(T); }
    // 1b. Klassisk är oförändrad: flerval med tal har kvar Svara (utom Yngre/fokus, som i 2.1)
    { const w2 = mkWin({ seed: 5, fixedClock: true }); await sleep(40); const T2 = tools(w2); const P2 = T2.PA; P2().FAMILY.apply(FIX); P2().load(); P2().rerender(); const D2 = v2tools(w2, T2);
      for (const k of P2().KIDS) P2().EXP.set(k, 'classic'); let seen = 0;
      for (let d = 0; d < 10 && seen < 5; d++) for (const kk of ['k4', 'k8']) { openKid(T2, kk); if (T2.$('[data-v2="kor"]')) { T2.click(T2.$('[data-v2="kor"]')); let g = 0; while (P2().S && P2().S.v2 && T2.$('#qcard') && g++ < 60) { const it = P2().S.queue[P2().S.i]; if (it.cat === 'math' && Array.isArray(it.choices) && it.type !== 'choicetext' && !it.build) { seen++; ok(!!T2.$('#submit'), 'Klassisk: flerval med tal har kvar Svara'); ok(!T2.$('#keypad'), 'Klassisk: knappsatsen flyttas inte'); } D2.answer(() => false); w2.__advance(4000); } } if (kk === 'k8') w2.__advance(DAY); }
      ok(seen > 0, 'Klassisk: flerval med tal prövat'); console.log(`  Klassisk: ${seen} flerval med tal prövade`); }

    // 6. Föräldraläget: navigeringen i en egen spalt för v2-barn – barn, flikar, Testa som barnet; det valda i den andra
    if (PA().TM) PA().TM.available = () => true;   // bara för att se var kortet hamnar – själva testläget prövas i test_parent_test_mode.js
    unlockParent(w, T);
    for (const k of PA().KIDS) { T.click(T.$(`[data-tab="${k.id}"]`)); const lay = T.$('.p-layout'); ok(!!lay, `${k.id}: föräldraläget har navigering och innehåll`);
      if (!lay) continue; const nav = lay.querySelector('.p-nav'), main = lay.querySelector('.p-main');
      ok(nav && nav.querySelector('.tabs [data-tab]') && nav.querySelectorAll('[data-sub]').length === 5, `${k.id}: barn och flikar i navigeringen`);
      ok(main && main.children.length > 0 && !main.querySelector('[data-tab], [data-sub]'), `${k.id}: det valda i innehållet`);
      const tm = doc.querySelector('.tm-card'); ok(!PA().TM || !!tm, `${k.id}: Testa som barnet finns i översikten`); if (tm) ok(nav.contains(tm) && /Testläge – inget sparas/i.test(norm(tm.textContent)), `${k.id}: Testa som barnet i navigeringen, med "inget sparas"`);
      const order = [...doc.querySelectorAll('.tabs, .seg.p-sub, .tm-card, .p-main')]; ok(order.every((e, i) => !i || (order[i - 1].compareDocumentPosition(e) & 4)), `${k.id}: samma ordning som förut på telefon (barn, flikar, Testa som barnet, innehåll)`);
      T.click(T.$('[data-sub="exams"]')); ok(!T.$('.p-nav .tm-card') && !!T.$('.p-main .card'), `${k.id}: Prov-fliken – innehållet i den andra spalten`); T.click(T.$('[data-sub="overview"]')); }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'UX 3.3 FINAL TEST FAILED' : 'UX 3.3 FINAL TEST OK'); process.exit(fails ? 1 : 0);
})();
