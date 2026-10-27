/* 3.1.2 – Bossens variation (ägarens beslut 27 oktober, efter test som Explore-barnet: sortera → Bossen sorterade nästan samma kort igen).
   Princip: Bossen får träna samma kunskapspunkt, men tar helst ett ANNAT faktum och en ANNAN aktivitet än uppgiften omedelbart före.
   Genomförande: bara ORDNINGEN bland kandidaterna ändras (samma kandidater, samma nivå- och formatgränser, samma reserver), i tur:
   annat faktum + annan aktivitet → annat faktum, samma aktivitet → samma faktum, annan aktivitet → samma faktum och aktivitet.
   "Faktum" = grunden: sorteringsomgångar (.sort0/.sort1) och par (.par) av samma grupp delar kort och räknas som samma faktum.
   Prövas (oberoende granskning: jämför mot beteendet utan ändringen, med samma slump och samma "nyss sett"):
   1. annat faktum och annan aktivitet när ett sådant alternativ finns – och att felet fanns förut
   2. ingen nivåhöjning: håller det gamla valet nivågränsen gör det nya det också
   3. inget formatbyte: uppfyller det gamla valet formatet motorn bad om (fritt minne/djup) gör det nya det också; och – även när motorn
      bad om vilket format som helst – aldrig ett svagare minnesprov: inte igenkänning i stället för eget svar/djup, ingen lägre nivå
      (variationen tar bara alternativ som är minst lika starka; finns bara svagare behålls det starkare valet)
   4. reserv: syntetiska punkter (en variant; flera varianter av samma faktum i samma aktivitet) → exakt samma fråga som förut;
      allt "nyss sett" → samma reservkedja som förut
   5. samma kunskapspunkt i appen (varje Boss i riktiga pass tränar exakt motorns punkt); motorns plan orörd; i riktiga pass
      (Explore, Grow, Achieve) delar Bossen inga kort med uppgiften före när ett annat faktum fanns
   Den andra oberoende granskningen prövade testerna med mutationer: Bossen till en annan punkt, omvänd reservordning och utan
   skyddet mot svagare minnesprov – alla tre fångas. */
'use strict';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js'); const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const rootOf = (k) => { const [a, b = ''] = String(k || '').split('|'); return a + '|' + b.split('.')[0]; };
const keyFk = (v) => v.key.split('|').slice(0, 2).join('|');
const cardsOf = (q) => q.type === 'sort' ? q.items : q.type === 'match' ? (q.pairs || []).map(p => p.l || p[0]) : [q.text];
(async () => {
  try {
    const w = mkWin({ seed: 3, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load();
    const P = PA().PACKS; const DEPTH = P.DEPTH; const kps = Object.keys(P.REG.kp);
    const fmtOk = (q, format) => format === 'recall' ? q.form === 'recall' : format === 'depth' ? DEPTH.has(q.form) : true;
    let weakOnly = 0, weakCases = 0, reserveCases = 0, n = 0, oldRepeat = 0, newRepeat = 0, altCases = 0, fallbackSame = 0, levelCases = 0, formatCases = 0;
    for (const pol of ['younger', 'middle', 'older']) for (const cid of kps) {
      const all = P.variants(cid, pol); if (all.length < 2) continue;
      for (const L of [1, 2]) for (const stretch of [true, false]) {
        const baseVary = stretch ? { choiceRun: 0, actAfter: 1, boost: 4, stretch: true } : { choiceRun: 0, boost: 1, depthBoss: true };
        const prev = P.question(cid, { lvl: L, pol, rnd: rng(7), vary: { choiceRun: 1, actAfter: 1, boost: 4 } }); if (!prev) continue;
        const bossVary = { ...baseVary, last: prev.ui, boss: true, prevKp: cid, prevFk: prev.fk, prevUi: prev.ui };
        for (const format of ['any', 'recall', 'depth']) for (const avoidMode of ['none', 'others']) {
          // "nyss sett": inget, eller alla varianter med annat faktum (tvingar reservkedjan; standard-id = frågans text)
          const avoid = avoidMode === 'others' ? new Set(all.filter(v => rootOf(keyFk(v)) !== rootOf(prev.fk)).map(v => { const q = P.buildVariant(cid, v, rng(1), pol); return q ? q.text : null; }).filter(Boolean)) : undefined;
          for (let s = 1; s <= 3; s++) {
            const args = { lvl: L, pol, format, avoid };
            const old = P.question(cid, { ...args, rnd: rng(1000 + s), vary: { ...baseVary, last: prev.ui } });
            const neu = P.question(cid, { ...args, rnd: rng(1000 + s), vary: bossVary });
            if (!old || !neu) { ok(!!old === !!neu, `${cid}: samma tillgång till fråga som förut`); continue; }
            n++; ok(neu.kp === cid, `${cid}: samma kunskapspunkt`);
            const lim = stretch ? L + 1 : L; if (old.level <= lim) { levelCases++; ok(neu.level <= lim, `${cid} L${L} ${format}: ingen nivåhöjning (${old.level} → ${neu.level}, gräns ${lim})`); }
            if (fmtOk(old, format) && format !== 'any') { formatCases++; ok(fmtOk(neu, format), `${cid} L${L}: formatet ${format} behålls (${old.form} → ${neu.form})`); }
            // 3b (granskning: även när motorn bad om "vilket format som helst"): aldrig ett svagare minnesprov för variationens skull –
            // inte igenkänning i stället för eget svar/djup, inte under både motorns nivå och det gamla valets nivå
            if (avoidMode === 'none') { weakCases++; ok(!(neu.form === 'recognition' && old.form !== 'recognition'), `${cid} L${L} ${format}: inte igenkänning i stället för ${old.form}`);
              ok(neu.level >= Math.min(old.level, L), `${cid} L${L} ${format}: ingen lägre nivå (${old.level} → ${neu.level})`); }
            const sameRoot = (q) => rootOf(q.fk) === rootOf(prev.fk);
            if (sameRoot(old) && old.ui === prev.ui) oldRepeat++; if (sameRoot(neu) && neu.ui === prev.ui) newRepeat++;
            // fanns ett annat faktum bland de kandidater det gamla valet drogs ur? (utan "nyss sett": varje val kommer ur kandidaterna –
            // samla dem genom att dra med 25 olika slumpfrön som förut)
            if (avoidMode === 'none' && s === 1) { const O = []; for (let t = 0; t < 25; t++) { const trace = {}; const q = P.question(cid, { ...args, trace, rnd: rng(5000 + t), vary: { ...baseVary, last: prev.ui } }); if (q && trace.tier === 'pool') O.push(q); }   // bara val ur de ordinarie kandidaterna
              // jämför per slumpfrö med det val som gjordes utan ändringen: bara alternativ som inte är ett svagare minnesprov än det räknas
              // (inte igenkänning i stället för eget svar/djup, inte under både motorns nivå och det valets nivå – granskning 3.1.2)
              for (let t = 0; t < 6; t++) { const ot = P.question(cid, { ...args, rnd: rng(7000 + t), vary: { ...baseVary, last: prev.ui } }); if (!ot) continue;
                const fair = (q) => !(q.form === 'recognition' && ot.form !== 'recognition') && q.level >= Math.min(ot.level, L);
                const tr2 = {}; const q = P.question(cid, { ...args, trace: tr2, rnd: rng(7000 + t), vary: bossVary });
                if (O.some(x => !sameRoot(x) && fair(x))) { altCases++; ok(q && tr2.tier === 'pool' && !sameRoot(q), `${cid} L${L} ${format}: annat faktum när ett sådant finns bland kandidaterna (${prev.fk} → ${q && q.fk})`); }
                if (O.some(x => !sameRoot(x) && x.ui !== prev.ui && fair(x))) ok(q && q.ui !== prev.ui, `${cid} L${L} ${format}: och annan aktivitet när en sådan finns (${prev.ui} → ${q && q.ui})`);
                if (O.some(x => !sameRoot(x)) && !O.some(x => !sameRoot(x) && fair(x))) weakOnly++; } }
            if (avoidMode === 'others') { const to = {}; const o2 = P.question(cid, { ...args, trace: to, rnd: rng(1000 + s), vary: { ...baseVary, last: prev.ui } }); if (o2 && to.tier !== 'pool') { reserveCases++; const tn = {}; const n2 = P.question(cid, { ...args, trace: tn, rnd: rng(1000 + s), vary: bossVary }); ok(n2 && tn.tier === to.tier, `${cid}: allt annat nyss sett – samma reservled som förut (${to.tier} → ${tn.tier})`); } }   // samma led = samma nivå- och formatregler (slumpdragningen kan skilja)
            if (!all.some(v => rootOf(keyFk(v)) !== rootOf(prev.fk) || v.ui !== prev.ui)) { fallbackSame++; ok(old.text === neu.text, `${cid}: inget alternativ – samma fråga som förut`); }
          }
        }
      }
    }
    console.log(`  · ${n} Boss-frågor jämförda: samma faktum + samma aktivitet som uppgiften före – förut ${oldRepeat}, nu ${newRepeat}; ${altCases} fall med alternativ, ${levelCases} nivå-, ${formatCases} formatfall, ${fallbackSame} utan alternativ, ${weakOnly} där bara svagare alternativ fanns (behåller det starkare)`);
    ok(n > 300 && altCases > 100 && levelCases > 100 && formatCases > 20 && weakCases > 100, 'tillräckligt många fall prövade');
    ok(oldRepeat > 0, `felet fanns förut (${oldRepeat})`);
    ok(reserveCases > 50, `reservkedjan prövad ${reserveCases} gånger`);
    ok(newRepeat < oldRepeat, `färre upprepningar (${oldRepeat} → ${newRepeat}; kvar bara där inget annat faktum finns bland kandidaterna eller allt annat är nyss sett)`);
    // 4. reserv (granskning: kontrollen kördes aldrig – ingen punkt i paketen har bara en variant): syntetiska punkter i ett eget paket,
    //    en med en enda variant och en där alla varianter är samma faktum i samma aktivitet. Bossen ska då få exakt samma fråga som förut.
    { const pk = Object.values(P.REG.packs).find(p => p.kps.some(k => k.facts.some(f => f.k === 'term' && f.def === undefined)));
      const c = JSON.parse(JSON.stringify(pk)); c.id = 'syntet-reserv'; delete c.legacy;
      const kp = c.kps.find(k => k.facts.some(f => f.k === 'term' && f.def === undefined)); const f = kp.facts.find(f => f.k === 'term' && f.def === undefined); f.recall = false;
      const kp1 = { ...kp, id: kp.id + '-en', facts: [f] }; const kp2 = { ...kp, id: kp.id + '-tva', facts: [{ ...f, def: 'en syntetisk förklaring av ordet', notDef: ['fel ett', 'fel två', 'fel tre'] }] };
      c.kps = [kp1, kp2]; c.skills = c.skills.filter(s => s.id === kp.skill);
      ok(P.register(c), 'syntetiskt reservpaket registrerat');
      const cids = Object.keys(P.REG.kp).filter(x => x.includes('syntet-reserv'));
      const polOf = {}; for (const cid of cids) polOf[cid] = ['younger', 'middle', 'older'].reduce((b, p) => P.variants(cid, p).length > P.variants(cid, b).length ? p : b, 'younger');
      const nv = cids.map(cid => P.variants(cid, polOf[cid]).length);
      for (const cid of cids) { const vs = P.variants(cid, polOf[cid]); ok(vs.every(v => rootOf(keyFk(v)) === rootOf(keyFk(vs[0])) && v.ui === vs[0].ui), `reserv: ${cid} – alla varianter samma faktum och aktivitet`); }
      ok(cids.length === 2 && nv.includes(1) && nv.some(x => x >= 2), `reserv: en punkt med en variant och en med flera av samma faktum och aktivitet (${nv})`);
      for (const cid of cids) for (const L of [1, 2]) for (let s = 1; s <= 10; s++) {
        const prev = P.question(cid, { lvl: L, pol: polOf[cid], rnd: rng(9 + s) }); if (!prev) continue;
        const baseVary = { choiceRun: 0, actAfter: 1, boost: 4, stretch: true };
        const a = P.question(cid, { lvl: L, pol: polOf[cid], rnd: rng(300 + s), vary: { ...baseVary, last: prev.ui } });
        const b = P.question(cid, { lvl: L, pol: polOf[cid], rnd: rng(300 + s), vary: { ...baseVary, last: prev.ui, boss: true, prevKp: cid, prevFk: prev.fk, prevUi: prev.ui } });
        fallbackSame++; ok(a && b && a.text === b.text && a.form === b.form && a.level === b.level, `reserv: inget alternativ – exakt samma fråga som förut (${cid} L${L})`);
      }
      ok(fallbackSame >= 20, `reserven prövad (${fallbackSame})`);
      delete P.REG.packs['syntet-reserv']; P.register(Object.values(P.REG.packs)[0]); }   // städa (bygger om registret)

    // 5. riktiga pass: Explore (Yngre) och Achieve (Äldre), 12 dygn, CORE + 2 FLOW per dygn, flera frön
    for (const [kid, exp] of [['k2', 'explore'], ['k8', 'achieve'], ['k4', 'grow']]) {
      let kpSame = 0, bosses = 0, sameKp = 0, overlap = 0, overlapAvoidable = 0, planOk = 0, planN = 0;
      for (const seed of [21, 33, 47]) {
        const w2 = mkWin({ seed, fixedClock: true }); await sleep(30); const T2 = tools(w2); const PA2 = T2.PA; PA2().FAMILY.apply(FIX); PA2().load(); PA2().rerender(); const D = v2tools(w2, T2); const r = rng(seed);
        // fånga Bossens frågeanrop (samma argument som appen använde, inklusive "nyss sett") för att kunna pröva om ett annat faktum fanns
        const PK = PA2().PACKS; const q0 = PK.question; let lastBossCall = null; PK.question = function (cid, opts) { const res = q0.call(this, cid, opts); if (opts && opts.vary && opts.vary.boss) lastBossCall = { cid, opts, res }; return res; };
        for (let d = 0; d < 12; d++) {
          for (let blk = 0; blk < 3; blk++) {
            toStart(T2); T2.click(T2.$(`[data-kid="${kid}"]`)); if (T2.$('[data-pet]')) T2.click(T2.$('[data-pet]'));
            const go = blk === 0 ? T2.$('[data-v2="kor"]') : T2.$('[data-v2="flow"]'); if (!go) break;
            const peek = blk === 0 ? PA2().V2.peekPlan(PA2().KIDS.find(k => k.id === kid)).plan.map(s => s.cid + s.role) : null; T2.click(go);
            if (peek) { planN++; if (JSON.stringify(PA2().S.v2.plan.map(s => s.cid + s.role)) === JSON.stringify(peek)) planOk++; }
            let m = 0; while (PA2().S && PA2().S.v2 && T2.$('#qcard') && m++ < 60) {
              const S = PA2().S; const it = S.queue[S.i];
              if (it.spec && it.spec.role === 'boss' && it.cat !== 'learn' && it.kp) { bosses++; if (it.kp === it.spec.cid && (!lastBossCall || lastBossCall.cid === it.spec.cid) && (!it.fk || String(it.fk).split('|')[0] === String(it.spec.cid).split('/').pop())) kpSame++; const prevs = S.queue.slice(0, S.i).filter(x => x.cat !== 'learn'); const pv = prevs[prevs.length - 1];
                if (pv && pv.kp === it.kp) { sameKp++; const a = cardsOf(pv), b = cardsOf(it); const shared = b.filter(x => a.includes(x)).length;
                  if (rootOf(pv.fk) === rootOf(it.fk) || (a.length > 1 && shared * 2 >= b.length)) { overlap++;
                    // fanns ett annat faktum bland de ordinarie kandidaterna (med samma "nyss sett")? då skulle det ha valts
                    if (lastBossCall && lastBossCall.cid === it.kp) { for (let t = 0; t < 12; t++) { const trace = {}; const q = q0.call(PK, it.kp, { ...lastBossCall.opts, trace, rnd: rng(900 + t) }); if (q && trace.tier === 'pool' && rootOf(q.fk) !== rootOf(pv.fk)) { overlapAvoidable++; break; } } } } } }
              D.answer(() => r() < 0.3); w2.__advance(4000);
            }
          }
          w2.__advance(DAY);
        }
      }
      console.log(`  · ${exp}: ${bosses} Bossar ur paket, ${sameKp} på samma punkt som uppgiften före, ${overlap} med samma faktum/kort (${overlapAvoidable} där ett annat faktum fanns bland kandidaterna)`);
      ok(planOk === planN, `${exp}: motorns plan orörd – KÖR startar den visade planen (${planOk}/${planN})`);
      ok(bosses > 3, `${exp}: Bossar prövade (${bosses})`);
      ok(kpSame === bosses, `${exp}: Bossen tränar exakt den kunskapspunkt motorn valde – etikett och innehåll (faktumets nyckel) (${kpSame}/${bosses})`);   // granskning: kontrollen i appen, inte bara i question()
      ok(overlapAvoidable === 0, `${exp}: Bossen delar aldrig kort med uppgiften före när ett annat faktum fanns bland kandidaterna (${overlapAvoidable}; ${overlap} av ${sameKp} där inget annat fanns eller allt annat var nyss sett)`);
    }
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'BOSS VARIETY TEST FAILED' : 'BOSS VARIETY TEST OK'); process.exit(fails ? 1 : 0);
})();
