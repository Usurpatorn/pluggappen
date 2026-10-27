/* 3.1.2 – Bossens variation (ägarens beslut 27 oktober, efter test som Explore-barnet: sortera → Bossen sorterade samma kort igen).
   Princip: Bossen får träna samma kunskapspunkt, men tar helst en ANNAN aktivitet och ett annat faktum än uppgiften omedelbart före –
   bara bland giltiga varianter av samma punkt, inom samma nivågräns och samma format som motorn bad om. Finns inget sådant: annat
   faktum i samma aktivitet; finns inte heller det: som förut. Motorn (planen, vilken punkt Bossen tränar, bevisreglerna) är orörd.
   Prövas:
   1. annan aktivitet (och annat faktum) efter föregående när ett giltigt alternativ finns – och att felet fanns förut
   2. ingen nivåhöjning (aldrig över gränsen som gällde innan)
   3. inget formatbyte som försvagar det motorn bad om (fritt minne / djup)
   4. rätt reserv när alternativ saknas (samma som förut, aldrig null)
   5. samma kunskapspunkt och samma plan (motorn orörd) – i riktiga Explore-pass, flera dygn, inga upprepningar kvar */
'use strict';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js'); const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
(async () => {
  try {
    const w = mkWin({ seed: 3, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load();
    const P = PA().PACKS; const DEPTH = P.DEPTH;
    const fkOf = (v) => v.key.split('|').slice(0, 2).join('|');
    // alla kunskapspunkter för Yngre/Mellan med minst två aktiviteter (ui) bland Bossens varianter
    const kps = Object.keys(P.REG.kp);
    let tested = 0, hadRepeat = 0, fallbackTested = 0, formatTested = 0;
    for (const pol of ['younger', 'middle']) for (const cid of kps) {
      const all = P.variants(cid, pol); if (all.length < 2) continue;
      for (const L of [1, 2]) {
        const stretch = { choiceRun: 0, actAfter: 1, boost: 4, stretch: true };
        // föregående uppgift: en aktivitet (inte textval) på samma punkt
        const prev = P.question(cid, { lvl: L, pol, rnd: rng(7), vary: { choiceRun: 1, actAfter: 1, boost: 4 } }); if (!prev || prev.ui === 'choice') continue;
        const prevVary = { ...stretch, last: prev.ui, boss: true, prevKp: cid, prevFk: prev.fk, prevUi: prev.ui };
        const okPool = all.filter(v => v.ui !== 'choice' && v.ui !== 'type' && v.lvl <= L + 1);   // Explore-Bossens urval (oförändrat)
        const altExists = okPool.some(v => v.ui !== prev.ui && fkOf(v) !== prev.fk);
        const maxBefore = Math.max(...(okPool.length ? okPool : all).map(v => v.lvl), L + 1);
        for (let s = 1; s <= 12; s++) {
          const before = P.question(cid, { lvl: L, pol, rnd: rng(100 + s), vary: { ...stretch, last: prev.ui } });   // som förut (utan föregående-info)
          const boss = P.question(cid, { lvl: L, pol, rnd: rng(100 + s), vary: prevVary });
          if (!boss) { ok(false, `${cid} L${L}: Bossen fick ingen fråga`); continue; }
          tested++; if (before && before.ui === prev.ui && before.fk === prev.fk) hadRepeat++;
          ok(boss.kp === cid, `${cid}: samma kunskapspunkt`);
          ok(boss.level <= maxBefore, `${cid} L${L}: ingen nivåhöjning (${boss.level} ≤ ${maxBefore})`);
          if (altExists) ok(boss.ui !== prev.ui && boss.fk !== prev.fk, `${cid} L${L} s${s}: annan aktivitet och annat faktum när det finns (${prev.ui}/${prev.fk} → ${boss.ui}/${boss.fk})`);
          else { fallbackTested++; ok(!(okPool.some(v => fkOf(v) !== prev.fk)) || boss.fk !== prev.fk, `${cid} L${L}: utan annan aktivitet – annat faktum om det finns`); }
        }
        // 3. formatet motorn bad om gäller fortfarande (fritt minne / djup)
        for (const format of ['recall', 'depth']) { const has = all.some(v => (format === 'recall' ? v.form === 'recall' : DEPTH.has(v.form)) && v.lvl <= L + 1 && v.ui !== 'choice' && v.ui !== 'type'); if (!has) continue;
          for (let s = 1; s <= 4; s++) { const b = P.question(cid, { lvl: L, pol, format, rnd: rng(300 + s), vary: { ...prevVary } }); if (!b) continue; formatTested++;
            ok(format === 'recall' ? b.form === 'recall' : DEPTH.has(b.form), `${cid} L${L}: formatet ${format} behålls (${b.form})`); } }
      }
    }
    ok(tested > 50, `prövade ${tested} Boss-frågor`);
    ok(hadRepeat > 0, `felet fanns förut: ${hadRepeat} av ${tested} Boss-frågor upprepade aktivitet och faktum utan ändringen`);
    ok(formatTested > 0, `formatskyddet prövat ${formatTested} gånger`);
    // 4. reserv: en punkt där bara en variant finns – samma fråga som förut, aldrig null
    { let one = null; for (const cid of kps) { const v = P.variants(cid, 'younger'); if (v.length === 1 && v[0].ui !== 'choice') { one = cid; break; } }
      if (!one) for (const cid of kps) { const v = P.variants(cid, 'younger'); if (v.length === 1) { one = cid; break; } }
      if (one) { const prev = P.question(one, { lvl: 1, pol: 'younger', rnd: rng(9) }); const vary = { choiceRun: 0, actAfter: 1, boost: 4, stretch: true, last: prev.ui, boss: true, prevKp: one, prevFk: prev.fk, prevUi: prev.ui };
        const a = P.question(one, { lvl: 1, pol: 'younger', rnd: rng(11), vary }); const b = P.question(one, { lvl: 1, pol: 'younger', rnd: rng(11), vary: { choiceRun: 0, actAfter: 1, boost: 4, stretch: true, last: prev.ui } });
        ok(a && b && a.text === b.text && a.ui === b.ui, `reserv utan alternativ: samma fråga som förut (${one})`); fallbackTested++; }
      ok(fallbackTested > 0, `reserven prövad ${fallbackTested} gånger`); }

    // 5. riktiga Explore-pass (Yngre, 14 dygn): Bossen tränar motorns punkt (planen orörd), och tar aldrig samma aktivitet + samma faktum
    //    som uppgiften precis före när ett alternativ fanns
    { const w2 = mkWin({ seed: 21, fixedClock: true }); await sleep(40); const T2 = tools(w2); const PA2 = T2.PA; PA2().FAMILY.apply(FIX); PA2().load(); PA2().rerender(); const D = v2tools(w2, T2); const r = rng(21);
      let bosses = 0, sameKp = 0, repeats = 0, planOk = 0;
      for (let d = 0; d < 14; d++) {
        for (let blk = 0; blk < 3; blk++) {
          toStart(T2); T2.click(T2.$('[data-kid="k2"]')); if (T2.$('[data-pet]')) T2.click(T2.$('[data-pet]'));
          const go = blk === 0 ? (T2.$('.go-btn[data-v2="kor"]') || T2.$('[data-v2="kor"]')) : T2.$('[data-v2="flow"]'); if (!go) break; T2.click(go);
          const V = PA2().S.v2; const bossSpec = V.plan.find(s => s.role === 'boss');
          let n = 0; while (PA2().S && PA2().S.v2 && T2.$('#qcard') && n++ < 60) {
            const S = PA2().S; const it = S.queue[S.i];
            if (it.spec && it.spec.role === 'boss' && it.cat !== 'learn' && it.kp) { bosses++; const prevs = S.queue.slice(0, S.i).filter(x => x.cat !== 'learn'); const pv = prevs[prevs.length - 1];
              if (bossSpec && it.spec.cid === bossSpec.cid) planOk++;
              if (pv && pv.kp === it.kp) { sameKp++; const alt = PA2().PACKS.variants(it.kp, 'younger').some(v => v.ui !== 'choice' && v.ui !== 'type' && v.ui !== pv.ui && v.key.split('|').slice(0, 2).join('|') !== pv.fk && v.lvl <= (it.spec.lvl || 1) + 1);
                if (alt && it.ui === pv.ui && it.fk === pv.fk) repeats++; } }
            D.answer(() => r() < 0.3); w2.__advance(4000);
          }
        }
        w2.__advance(DAY);
      }
      console.log(`  · Explore 14 dygn: ${bosses} Boss-frågor ur paket, ${sameKp} på samma punkt som uppgiften före, ${repeats} upprepningar när alternativ fanns`);
      ok(bosses > 5, `Bossar prövade i riktiga pass (${bosses})`);
      ok(planOk > 0, 'Bossen tränar motorns valda punkt (planens Boss-plats)');
      ok(repeats === 0, `ingen Boss upprepar aktivitet och faktum direkt efter samma punkt när ett alternativ finns (${repeats})`); }
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'BOSS VARIETY TEST FAILED' : 'BOSS VARIETY TEST OK'); process.exit(fails ? 1 : 0);
})();
