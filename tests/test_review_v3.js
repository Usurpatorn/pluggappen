/* Experience v3 – regressionstester för den sista oberoende kodgranskningen (riktiga appen i jsdom, fast klocka, syntetisk familj).
   1  v1:s Felbok får inga sortera/para ihop-poster (v1 och 2.1.0 kan inte visa dem) – och gamla sådana poster filtreras bort
   2  efter "Visa hur man gör" på en pappersuppgift: aldrig "Svaret stämmer inte"
   3  FLOW är kortare än dagens CORE, varje dag, för alla tre upplevelser
   4  FLOW i provveckan håller motorns egen dagsgräns för nytt
   5  Hitta felet: felet hamnar i A, B och C
   7  uppgifts-id för algebrauttryck är oförändrade mot 2.1.0 (Felboken och statistiken hänger ihop över versioner)
   9  "Jag har justerat planen." bara när motorn faktiskt har startat om planen
   (6 och 8 – synk av "återställ" och självkontroller – prövas i test_exp_v3.js) */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), os = require('os');
const { mkWin, tools, FIX, rng, T_FIXED } = require('./le/childflow.js');
const { v2tools, toStart, setEngine } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const isoIn = (d) => new Date(T_FIXED + d * DAY).toISOString().slice(0, 10);
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const golden = () => { const f = path.join(os.tmpdir(), `g210-rv-${process.pid}.html`); fs.writeFileSync(f, zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'golden', 'pluggappen-2.1.0.html.gz')))); return f; };

(async () => {
  try {
    /* 1. v1:s Felbok och v3-aktiviteter */
    { const w = mkWin({ seed: 31, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T);
      let actWrong = 0; for (let d = 0; d < 6; d++) { openKid(T, 'k2'); T.click(T.$('.go-btn[data-v2="kor"]')); D.run((it) => { const a = it.type === 'sort' || it.type === 'match'; if (a) actWrong++; return a; }); w.__advance(DAY); }
      const ms = PA().DB.profiles.k2.mistakes || [];
      ok(actWrong > 0, `1: barnet svarade fel på sortera/para ihop (${actWrong} gånger)`);
      ok(!ms.some(m => m.q && (m.q.type === 'sort' || m.q.type === 'match')), '1: v1:s Felbok får inga sortera/para ihop-poster');
      // gamla poster (från en tidigare v3-version) filtreras bort i v1:s Felbok
      PA().DB.profiles.k2.mistakes = [...ms, { id: 'm_x', at: Date.now(), cat: 'math', skillId: (PA().KIDS.find(k => k.id === 'k2').skills[0] || {}).id, q: { type: 'sort', text: 'Sortera' } }]; PA().save();
      setEngine(w, T, 'k2', 'v1'); openKid(T, 'k2'); const errs = []; w.addEventListener('error', e => errs.push(e.message));
      const fb = T.$('[data-act="felbok"]'); if (fb) { try { T.click(fb); } catch (e) { errs.push(e.message); } }
      ok(errs.length === 0 && !(PA().S && PA().S.mode === 'felbok' && PA().S.queue.some(q => q.type === 'sort' || q.type === 'match')), '1: v1:s Felbok öppnas utan fel och visar inga sortera/para ihop ' + JSON.stringify(errs));
      toStart(T); setEngine(w, T, 'k2', 'v2'); }

    /* 2. Pappersuppgift efter "Visa hur man gör" */
    { const w = mkWin({ seed: 3, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load();
      PA().FAMILY.applyContent({ v: 1, updatedAt: 1, packs: [], work: [{ id: 'a', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(40), skills: ['multin', 'forenkla', 'ekvation', 'problemekv'], focus: { skills: ['multin', 'forenkla', 'ekvation', 'problemekv'] } }] });
      PA().rerender(); const D = v2tools(w, T); let tested = false;
      for (let d = 0; d < 25 && !tested; d++) { openKid(T, 'k8'); if (!T.$('.go-btn[data-v2="kor"]')) { w.__advance(DAY); continue; } T.click(T.$('.go-btn[data-v2="kor"]'));
        let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 40) { const it = PA().S.queue[PA().S.i];
          if (it.paper && !tested && T.$('#explainBtn')) { tested = true; T.click(T.$('#explainBtn')); const ans = it.type === 'expr' ? PA().Poly.format(it.answer) : String(it.answer).replace('.', ','); T.$('#ans').value = ans; T.click(T.$('#submit'));
            const fbt = T.$('#fb').textContent.replace(/\s+/g, ' ');
            ok(!/Svaret stämmer inte/.test(fbt) && /Nu vet du hur man gör/.test(fbt) && !T.$('.selfcheck'), `2: efter "Visa hur man gör" – ingen motsägelse ("${fbt.slice(0, 60)}")`); T.click(T.$('#next')); continue; }
          D.answer(() => false); w.__advance(4000); }
        w.__advance(DAY); }
      ok(tested, '2: en pappersuppgift med "Visa hur man gör" prövades'); }

    /* 3. FLOW kortare än CORE */
    for (const id of ['k2', 'k4', 'k8']) { const w = mkWin({ seed: 11, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T); const r = rng(3); const rows = []; let bad = 0;
      for (let d = 0; d < 12; d++) { openKid(T, id); T.click(T.$('.go-btn[data-v2="kor"]')); const core = PA().S.v2.plan.length; D.run(() => r() < 0.2);
        if (T.$('[data-v2="flow"]')) { T.click(T.$('[data-v2="flow"]')); const fl = PA().S.v2.plan.length; if (core >= 3 && fl >= core) bad++; rows.push(`${core}/${fl}`); D.run(() => r() < 0.2); } w.__advance(DAY); }
      console.log(`  ${id} CORE/FLOW: ${rows.join(' ')}`); ok(rows.length > 5 && bad === 0, `3: ${id}: FLOW kortare än dagens CORE varje dag (${bad} avvikelser)`); }

    /* 4. FLOW i provveckan: motorns egen dagsgräns för nytt */
    for (const [kidId, days] of [['k4', 5], ['k8', 5]]) { const w = mkWin({ seed: 7, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load();
      PA().FAMILY.applyContent({ v: 1, updatedAt: 1, packs: [], work: [{ id: 'syn', kid: kidId, type: 'exam', title: 'Kemiprov', date: isoIn(days), kps: ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer', 'k:kemi8-syror-baser/neutralisation'], skills: kidId === 'k8' ? ['ekvation', 'andragrad', 'talfoljd'] : [] }] });
      PA().rerender(); const D = v2tools(w, T); const kid = PA().KIDS.find(k => k.id === kidId); const C = () => PA().LE.state(kid);
      openKid(T, kidId); T.click(T.$('.go-btn[data-v2="kor"]')); const dayCap = PA().S.v2.plan.maxNew; D.run(false); const afterCore = PA().EXP.newToday(C(), PA().LE.now()); T.click(T.$('[data-go="home"]'));
      let flows = 0; while (T.$('[data-v2="flow"]') && flows < 3) { T.click(T.$('[data-v2="flow"]')); D.run(false); flows++; T.click(T.$('[data-go="home"]')); }
      const nNew = PA().EXP.newToday(C(), PA().LE.now());
      ok(typeof dayCap === 'number' && nNew - afterCore <= Math.max(0, dayCap - afterCore), `4: ${kidId}, prov om ${days} dygn: ${flows} FLOW tar inte in mer nytt än vad som återstår av motorns dagsgräns (CORE ${afterCore}, efter FLOW ${nNew}, gräns ${dayCap})`); }

    /* 5. Hitta felet: A, B och C */
    { const w = mkWin({ seed: 3 }); await sleep(40); const PA = w.PA; PA.FAMILY.apply(FIX); PA.load(); const k = PA.KIDS.find(x => x.id === 'k8'); const pos = {};
      for (const sid of ['forenkla', 'ekvation', 'multin']) { const sk = k.skills.find(s => s.id === sid); if (!sk) continue; for (let i = 0; i < 40; i++) { const q = PA.EXP.rhythmItem('spot', sk, 2); if (q) pos[q.answer] = (pos[q.answer] || 0) + 1; } }
      console.log('  Hitta felet – rätt svar per position:', JSON.stringify(pos)); ok([0, 1, 2].every(i => (pos[i] || 0) > 5), '5: Hitta felet – felet hamnar i A, B och C'); }

    /* 7. Uppgifts-id för algebrauttryck oförändrade mot 2.1.0 */
    { const q = { type: 'expr', text: 'Förenkla 2(x + 3)', answer: { x: 2, '': 6 } };
      const w = mkWin({ seed: 1 }); await sleep(40); const a = tools(w).PA().LECAT.itemId(q);
      const f = golden(); const w2 = mkWin({ seed: 1, file: f }); await sleep(60); const b = tools(w2).PA().LECAT.itemId(q); fs.unlinkSync(f);
      ok(a === b, `7: uppgifts-id för algebrauttryck är detsamma som i 2.1.0 (${a} / ${b})`);
      const s1 = { type: 'sort', text: 'Sortera', answer: { a: 0, b: 1 } }, s2 = { type: 'sort', text: 'Sortera', answer: { a: 1, b: 0 } };
      ok(tools(w).PA().LECAT.itemId(s1) !== tools(w).PA().LECAT.itemId(s2), '7: två olika sorteringar får olika id'); }

    /* 9. "Jag har justerat planen." bara vid motorns återstart */
    { const w = mkWin({ seed: 5, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T);
      for (let d = 0; d < 3; d++) { openKid(T, 'k8'); T.click(T.$('.go-btn[data-v2="kor"]')); D.run(false); w.__advance(DAY); }
      for (const gap of [8, 13]) { w.__advance(gap * DAY); openKid(T, 'k8'); const t = T.$('#app').textContent; const plan = PA().V2.peekPlan(PA().KIDS.find(k => k.id === 'k8')).plan;
        ok(/Kul att du är tillbaka/.test(t), `9: ${gap} dygns uppehåll: hälsningen visas`);
        ok(/Jag har justerat planen/.test(t) === !!plan.restart, `9: ${gap} dygns uppehåll: "Jag har justerat planen" ⇔ motorns återstart (${!!plan.restart})`);
        T.click(T.$('.go-btn[data-v2="kor"]')); D.run(false); } }
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'REVIEW V3 TEST FAILED' : 'REVIEW V3 TEST OK'); process.exit(fails ? 1 : 0);
})();
