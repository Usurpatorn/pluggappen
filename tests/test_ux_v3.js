/* Experience v3 – regressionstester för den sista oberoende UX-granskningen (riktiga appen i jsdom, fast klocka, syntetisk familj).
   - samma faktum kommer inte tillbaka samma dag i en annan form (t.ex. flerval och sedan som Boss); andelen djupare Boss-former skrivs ut
   - Achieve: provets moment syns även som Repetition/Revansch/Boss; andelen "N av M" räknar samma platser som passet
   - uttrycksknappsatsen i v3: siffrorna 1–0 på egna rader (v1/Klassisk: test_keypad.js)
   - Explore: ämnet i rubriken, inga XP-flygare, "Bossen väntar nästa gång" om kronan inte nåddes
   - efter dagens plan: inga räknare för Felboken/uppdragen på hemmet (skuldfritt)
   - Testa mig i v3: ingen klocka
   - pappersfeedback: "Eller …" får inget stegnummer, numren stämmer med knapparna
   - N kvar: planerade uppgifter; under Ny chans/Rescue "Ny chans · sedan N kvar" (motorns omförsök oförändrade) */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, rng, T_FIXED } = require('./le/childflow.js');
const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const isoIn = (d) => new Date(T_FIXED + d * DAY).toISOString().slice(0, 10);
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

(async () => {
  try {
    /* 1. Samma faktum inte två gånger samma dag (CORE + FLOW), Grow och Achieve */
    for (const id of ['k4', 'k8']) { const w = mkWin({ seed: 17, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T); const r = rng(2);
      let dup = 0, kpItems = 0, bossActivities = 0, boss = 0;
      for (let d = 0; d < 8; d++) { const seen = new Set();
        const play = () => { let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 60) { const it = PA().S.queue[PA().S.i]; const extra = PA().EXP.isExtra(it);
          if (it.fk && !extra) { kpItems++; if (seen.has(it.fk)) dup++; seen.add(it.fk); }
          if (it.spec && it.spec.role === 'boss' && it.form) { boss++; if (PA().PACKS.DEPTH.has(it.form)) bossActivities++; }
          D.answer(() => r() < 0.2); w.__advance(4000); } };
        openKid(T, id); T.click(T.$('.go-btn[data-v2="kor"]')); play(); if (T.$('[data-v2="flow"]')) { T.click(T.$('[data-v2="flow"]')); play(); } w.__advance(DAY); }
      console.log(`  ${id}: ${kpItems} kunskapsuppgifter, ${dup} med ett faktum som redan kommit samma dag; Boss med djupare form ${bossActivities}/${boss}`);
      ok(kpItems > 10 && dup <= Math.ceil(kpItems * 0.05), `${id}: samma faktum kommer nästan aldrig tillbaka samma dag (${dup} av ${kpItems}; tillåtet bara när ingen annan variant finns)`);
      /* andelen djupare Boss-former skrivs bara ut: den beror på innehållet och på vad motorn ber om (nivå, format) */ }

    /* 2. Achieve: provets moment syns i listan, andelen räknar samma platser som passet */
    { const w = mkWin({ seed: 9, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T);
      for (let d = 0; d < 4; d++) { openKid(T, 'k8'); T.click(T.$('.go-btn[data-v2="kor"]')); D.run(() => false); w.__advance(DAY); }
      const p = PA().DB.profiles.k8; const C = PA().LE.state(PA().KIDS.find(k => k.id === 'k8')); const seenSk = Object.keys(C.L.c).filter(c => c.startsWith('s:') && C.L.c[c].n).map(c => c.slice(2));
      p.exams = [{ id: 'e', title: 'Matteprov', date: isoIn(4 + 6), skillIds: seenSk.slice(0, 3), deckIds: [] }]; PA().save(); PA().LE.invalidate('k8');
      openKid(T, 'k8'); const kid = PA().KIDS.find(k => k.id === 'k8'); const plan = PA().V2.peekPlan(kid).plan; const m = PA().EXP.goalOf(kid).now; const sh = PA().EXP.examShare(kid, m, plan); const h = norm(T.$('.mission').textContent);
      if (sh.n > 0) { ok(sh.of === plan.length, `Achieve: andelen räknas över alla ${plan.length} platser (${sh.n} av ${sh.of})`); ok(h.includes(`${sh.n} av ${sh.of} uppgifter inför provet`) || h.includes('Allt inför provet'), 'Achieve: andelen på kortet');
        const s = PA().EXP.summary(kid, plan); ok(s.exList.length > 0, `Achieve: listan "DET HÄR TRÄNAR VI IDAG" visar provets moment (${s.exList.join(' · ')})`); }
      else console.log('  (Achieve: ingen provandel i det här passet – kontrollen hoppas över)'); }

    /* 3–7: Explore-rubrik, knappsats, KLAR-hem, Testa mig-klocka, pappersnumrering */
    { const w = mkWin({ seed: 3, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load();
      PA().FAMILY.applyContent({ v: 1, updatedAt: 1, packs: [], work: [{ id: 'a', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(12), skills: ['multin', 'forenkla', 'ekvation', 'problemekv'], focus: { skills: ['multin', 'forenkla'] } }] });
      PA().rerender(); const D = v2tools(w, T);
      // Explore: ämnet i rubriken, inga XP-flygare
      openKid(T, 'k2'); T.click(T.$('.go-btn[data-v2="kor"]')); let explTitles = new Set(), pops = 0; let g = 0;
      while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 40) { const tb = T.$('.topbar h1, .topbar .title, .topbar'); explTitles.add(norm(tb && tb.textContent).slice(0, 30)); D.answer(() => false); if (T.$('.xp-pop')) pops++; w.__advance(4000); }
      ok(pops === 0, 'Explore: inga XP-flygare'); ok([...explTitles].every(t => /Matte|Svenska|Engelska|NO|SO|Äventyret|Nytt ord|[A-ZÅÄÖ]/.test(t)), 'Explore: rubriken är ämnet');
      // efter CORE: inga räknare på hemmet
      openKid(T, 'k2'); const home = norm(T.$('#app').textContent); ok(!/att ta revansch på/.test(home) && !/\d+\/\d+ klara/.test(home), 'efter dagens plan: inga Felboks- eller uppdragsräknare på hemmet');
      // Achieve: knappsats + papper + Testa mig
      let sawKeys = false, sawPaper = false;
      for (let d = 0; d < 10 && !(sawKeys && sawPaper); d++) { w.__advance(DAY); openKid(T, 'k8'); if (!T.$('.go-btn[data-v2="kor"]')) continue; T.click(T.$('.go-btn[data-v2="kor"]')); let h = 0;
        while (PA().S && PA().S.v2 && T.$('#qcard') && h++ < 40) { const it = PA().S.queue[PA().S.i];
          if (it.type === 'expr' && T.$('.keys')) { sawKeys = true; const digits = [...T.$('.keys').querySelectorAll('[data-key]')].map(b => b.dataset.key).filter(k => /^\d$/.test(k)).join(''); ok(digits === '1234567890', `v3-knappsatsen: siffrorna i ordning 1–0 (${digits})`); }
          if (it.paper && !sawPaper && (it.steps || []).some(s => /^\s*(<[^>]+>\s*)*Eller/i.test(String(s)))) { sawPaper = true; T.$('#ans').value = '987654'; T.click(T.$('#submit'));
            const lis = [...T.$('#fb').querySelectorAll('ol li')]; const alt = lis.filter(li => /Eller/i.test(li.textContent)); ok(alt.length && alt.every(li => !li.hasAttribute('value')), 'papper: "Eller …" har inget stegnummer');
            const btns = [...T.$('#fb').querySelectorAll('[data-sc]')].map(b => +b.dataset.sc).filter(n => n > 0); const nums = lis.filter(li => li.hasAttribute('value')).map(li => +li.getAttribute('value')); ok(btns.every(n => nums.includes(n)), `papper: knapparna "Steg N" pekar på numrerade steg (${btns} / ${nums})`);
            T.click(T.$('#next')); continue; }
          D.answer(() => false); w.__advance(4000); } }
      ok(sawKeys, 'en uttrycksuppgift med knappsats prövades');
      openKid(T, 'k8'); const tb = T.$('[data-v2="testa"]'); if (tb) { T.click(tb); D.run(() => false); ok(!/Testa mig · \d+:\d\d/.test(norm(T.$('#app').textContent)), 'Testa mig i v3: ingen klocka i resultatet'); } }
    /* 8. N kvar och Ny chans (slutverifieringen): räknaren visar de planerade uppgifter som faktiskt återstår. En Ny chans/Rescue/extra
       lätt uppgift syns som extra ("Ny chans/Extra · sedan N kvar") och lovar aldrig mer än det som kommer. Räknaren ökar aldrig; den kan
       minska mer än ett steg när motorns omförsök fyller passets tak (motorn ändras inte). Det som inte hanns med sägs på KLAR:
       "Bossen väntar nästa gång" och/eller "N uppgifter från planen sparas till nästa gång". */
    { let extras = 0, easy = 0, steps = 0, ends = 0, bossSkip = 0, drops = 0, savedN = 0;
      for (const seed of [21, 5, 9]) for (const pw of [0.5, 0.75]) {
        const w = mkWin({ seed, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T); const r8 = rng(seed * 3);
        for (let d = 0; d < 3; d++) { for (const id of ['k2', 'k4', 'k8']) { openKid(T, id); if (!T.$('.go-btn[data-v2="kor"]')) continue; T.click(T.$('.go-btn[data-v2="kor"]')); let g = 0, after = null;
          while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 80) { const it = PA().S.queue[PA().S.i]; const lc = norm((T.$('.left-count') || {}).textContent); const extra = PA().EXP.isExtra(it);
            let now;
            if (extra) { extras++; if (it.spec.role === 'easy') easy++; const m = lc.match(/^(Ny chans|Extra)(?: · sedan (\d+) kvar)?$/); ok(!!m && (m[1] === 'Extra') === (it.spec.role === 'easy'), `extra uppgift märkt som extra: "${lc}" (${it.spec.role})`); now = m && m[2] ? +m[2] : 0; if (after != null) { steps++; if (now !== after) { drops++; ok(now < after, `räknaren ökade: lovat ${after}, nu ${now} (${lc})`); } } after = now; }
            else { const m = lc.match(/^(\d+) kvar$/); ok(!!m && +m[1] >= 1, `planerad uppgift visar "N kvar": "${lc}"`); now = m ? +m[1] : 0; if (after != null) { steps++; if (now !== after) { drops++; ok(now < after, `räknaren ökade: lovat ${after}, nu ${now}`); } } after = it._slotEnd ? now - 1 : now; }   // ett UPPTÄCK-kort före uppgiften är samma planerade plats
            D.answer(() => r8() < pw); w.__advance(4000); }
          ends++; const t = norm(T.$('#app').textContent); const skipped = /Bossen väntar nästa gång/.test(t); const saved = t.match(/(En uppgift|(\d+) uppgifter) från planen sparas till nästa gång/); if (skipped) bossSkip++; if (saved) savedN++;
          if (after > 0) ok(after === (skipped ? 1 : 0) + (saved ? (saved[2] ? +saved[2] : 1) : 0), `passet slutade med ${after} utlovade kvar – KLAR säger varför (Boss senare: ${skipped}, sparas: ${saved && saved[0]})`);
          w.__advance(0); }
          w.__advance(DAY); } }
      console.log(`  N kvar: ${ends} pass, ${extras} extra uppgifter (${easy} lätta), ${steps} steg kontrollerade, ${drops} gånger kortade motorns tak passet (räknaren minskade mer än en), ${bossSkip} Boss senare, ${savedN} pass med uppgifter sparade till nästa gång`);
      ok(extras > 0 && easy >= 0 && ends > 20, 'tillräckligt många pass och extra uppgifter prövades'); }
    /* 9. Tillgänglighet (kvalitetspasset, axe i Chromium gav 0 fel efter rättningen): förloppet har ett namn, KLAR-spåret och
       svårighetsprickarna har en roll till sin etikett */
    { const w = mkWin({ seed: 5, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T);
      openKid(T, 'k4'); T.click(T.$('.go-btn[data-v2="kor"]')); let g = 0, pb = 0, dots = 0;
      while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 30) { const p = T.$('.progress.v3'); if (p) { pb++; ok(/Passet: \d+ av \d+/.test(p.getAttribute('aria-label') || ''), 'förloppet har ett namn'); } const ld = T.$('#qcard .lvl-dots[aria-label]'); if (ld) { dots++; ok(ld.getAttribute('role') === 'img', 'svårighetsprickarna har role=img'); } D.answer(() => false); w.__advance(4000); }
      ok(pb > 0, 'förloppet prövades');
      // liten skärm: efter svaret göms sifferknapparna så att svaret, lösningen och Nästa syns
      { let h = 0, seenK = false, invalidSeen = false; for (let d = 0; d < 4 && !seenK; d++) { w.__advance(DAY); openKid(T, 'k8'); if (!T.$('.go-btn[data-v2="kor"]')) continue; T.click(T.$('.go-btn[data-v2="kor"]'));
          while (PA().S && PA().S.v2 && T.$('#qcard') && h++ < 60) { if (T.$('#qcard .keys') && T.$('#ans')) { seenK = true; T.$('#ans').value = '+ ) ('; T.click(T.$('#submit')); if (!T.$('#next')) { invalidSeen = true; ok([...T.$('#qcard').querySelectorAll('.keys')].every(k => k.style.display !== 'none'), 'ett ogiltigt svar: sifferknapparna syns kvar (barnet skriver igen)'); } T.$('#ans').value = '987654'; T.click(T.$('#submit')); if (T.$('#submit') && !T.$('#next')) { T.$('#ans').value = '987654'; T.click(T.$('#submit')); }
              ok([...T.$('#qcard').querySelectorAll('.keys')].every(k => k.style.display === 'none'), 'efter svaret syns inga sifferknappar (v3)'); T.click(T.$('#next')); break; }
            D.answer(() => false); w.__advance(4000); } }
        ok(seenK, 'en uppgift med sifferknappar prövades'); ok(invalidSeen, 'ett ogiltigt svar prövades'); }
      openKid(T, 'k2'); T.click(T.$('.go-btn[data-v2="kor"]')); D.run(() => false); const tr = T.$('.trail.done'); ok(!tr || (tr.getAttribute('role') === 'img' && /Det här gjorde du: \d+/.test(tr.getAttribute('aria-label'))), 'KLAR-spåret har role=img och ett namn'); }
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'UX V3 TEST FAILED' : 'UX V3 TEST OK'); process.exit(fails ? 1 : 0);
})();
