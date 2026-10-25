/* Fas 3E + 3H – innehåll för aktiv hämtning och Utmaning. Allt är deterministisk rättning (ingen AI).
   1. RECALL: flerval → eget svar bara när det är säkert; rätt svar godkänns, varje felalternativ underkänns, små stavfel bara när de ligger närmast rätt svar.
   2. CHG: varje Utmaning i varje moment i alla kursmallar har ett verifierat rätt svar (kontrolleras mot den underliggande uppgiftens egen rättning).
   3. Utmaningarna går att spela i appen (v2-pass) och påverkar inte grundkunskapen (stadium, nivå, förfallodag, Felbok).
   4. Innehållsrevision: variation per moment och andel uppgifter som kan bli eget svar (rapport + golv). */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { v2tools } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 40) console.log('FAIL', m); } };
const w = mkWin({ seed: 31337, fixedClock: true }); const T = tools(w);
setTimeout(() => {
  try {
    const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); PA.rerender();
    const { RECALL, CHG, checkAnswer, answerDisplay, Poly, LECAT } = PA;
    const skills = []; const seen = new Set(); for (const k of PA.KIDS) for (const s of k.skills) if (!seen.has(s.id)) { seen.add(s.id); skills.push({ s, kid: k }); }
    ok(skills.length >= 60, `moment i alla kursmallar: ${skills.length}`);
    /* ---------- 1. RECALL ---------- */
    let conv = 0, mcTotal = 0, typoTests = 0; const recallBy = {};
    const typo = (s) => { const i = Math.floor(s.length / 2); return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2); };
    for (const { s } of skills) for (let lv = 1; lv <= (s.maxLvl || 3); lv++) for (let r = 0; r < 12; r++) {
      let q; try { q = s.gen(lv, {}); } catch (e) { continue; } if (q.type !== 'choicetext') continue; mcTotal++;
      const rq = RECALL.convert(q); const by = recallBy[s.id] = recallBy[s.id] || [0, 0]; by[1]++;
      if (!rq) continue; conv++; by[0]++;
      ok(RECALL.check(rq, q.choices[q.answer]).status === 'correct', `${s.id}: rätt svar godkänns (${q.choices[q.answer]})`);
      ok(RECALL.check(rq, '   ').status === 'empty', `${s.id}: tomt svar = tomt`);
      for (const [i, c] of q.choices.entries()) if (i !== q.answer && RECALL.norm(c) !== RECALL.norm(q.choices[q.answer])) ok(RECALL.check(rq, c).status !== 'correct', `${s.id}: felalternativet "${c}" underkänns (rätt: ${q.choices[q.answer]})`);
      const c0 = RECALL.norm(q.choices[q.answer]);
      if (c0.length >= 6 && !rq.accept.numeric) { typoTests++; const t = typo(c0); const closer = RECALL.lev(t, c0) < Math.min(...rq.accept.distract.map(d => RECALL.lev(t, d))); ok((RECALL.check(rq, t).status === 'correct') === (closer && RECALL.lev(t, c0) <= (c0.length >= 9 ? 2 : 1)), `${s.id}: litet stavfel "${t}" hanteras konsekvent`); }
      ok(!RECALL.NEEDS_OPTIONS.test(RECALL.strip(q.text)), `${s.id}: frågor som kräver alternativen görs aldrig om`);
    }
    ok(conv > 100 && conv / mcTotal > 0.25, `RECALL: ${conv} av ${mcTotal} flervalsfrågor kan bli eget svar (${Math.round(conv / mcTotal * 100)} %), ${typoTests} stavfelsprov`);
    // negationer och "vilket ord"-frågor görs aldrig om
    ok(RECALL.convert({ type: 'choicetext', text: 'Vilket av detta finns INTE i naturen?', choices: ['Gräns', 'Sjö'], answer: 0 }) === null, 'negationsfråga görs inte om');
    ok(RECALL.convert({ type: 'choicetext', text: 'Vilket ord är rätt stavat?', choices: ['hoppa', 'hopa'], answer: 0 }) === null, 'stavningsval görs inte om');
    ok(RECALL.convert({ type: 'choicetext', text: 'Vad betyder blå färg på en karta?', choices: ['Vatten', 'Skog', 'Åker', 'Berg'], answer: 0 }) !== null, 'enkel faktafråga görs om');
    const tq = RECALL.convert({ type: 'choicetext', text: 'Vilken karta visar landskapet som det ser ut?', choices: ['Topografisk karta', 'Tematisk karta', 'Sjökort', 'Jordglob'], answer: 0 });
    ok(tq && RECALL.check(tq, 'topografisk').status === 'correct' && RECALL.check(tq, 'topografsk').status === 'correct' && RECALL.check(tq, 'tematisk').status === 'wrong' && RECALL.check(tq, 'karta').status === 'wrong', 'kärnord: "topografisk" räcker, "karta" eller felalternativets kärnord gör det inte');
    // Granskning M5: svar med alternativ görs inte om; tal måste vara hela svaret
    ok(RECALL.convert({ type: 'choicetext', text: 'Vad är det kemiska namnet på vanligt koksalt?', choices: ['Natriumklorid, NaCl', 'Kaliumklorid', 'Natriumkarbonat'], answer: 0 }) === null, 'M5: "Natriumklorid, NaCl" görs inte om till eget svar');
    { const nq = RECALL.convert({ type: 'choicetext', text: 'Hur många ytor har en kub?', choices: ['6', '8', '4', '12'], answer: 0 }); ok(nq && RECALL.check(nq, '6').status === 'correct' && RECALL.check(nq, '6 eller 8').status === 'wrong' && RECALL.check(nq, '6/10').status === 'wrong' && RECALL.check(nq, ' 6 ').status === 'correct' && RECALL.check(nq, '6,0').status === 'correct' && RECALL.check(nq, '6.0').status === 'correct' && RECALL.check(nq, '6 ytor').status === 'correct' && RECALL.check(nq, 'sex').status === 'invalid', 'M5: "6 eller 8" och "6/10" är fel; "6", "6,0", "6.0" och "6 ytor" är rätt'); }
    // 3E: uppgifts-id innehåller rätt svar → samma frågetext med olika svar ger olika id
    ok(LECAT.itemId({ type: 'choicetext', text: 'Vilket ord är rätt stavat?', choices: ['hoppa', 'hopa'], answer: 0 }) !== LECAT.itemId({ type: 'choicetext', text: 'Vilket ord är rätt stavat?', choices: ['kasta', 'kassta'], answer: 0 }), 'uppgifts-id skiljer på olika rätta svar');
    /* ---------- 2. CHG ---------- */
    const kinds = {}; let made = 0, none = 0; const noneList = [];
    const disp = (q, a) => (q.type === 'expr' ? Poly.format(a) : a < 0 ? '−' + Poly.fmtNum(-a) : Poly.fmtNum(a));
    for (const { s } of skills) {
      let any = false;
      for (let k = 0; k < 10; k++) {
        const lv = s.maxLvl || 3; const q = CHG.make(s, lv, k); if (!q) continue; any = true; made++; kinds[q.challenge] = (kinds[q.challenge] || 0) + 1;
        const tag = `${s.id} #${k} ${q.challenge}`;
        ok(!/undefined|NaN|\[object/.test(q.text + JSON.stringify(q.steps || [])), `${tag}: ingen trasig text`);
        ok(q.level === lv && Array.isArray(q.steps) && q.steps.length >= 1, `${tag}: nivå och förklaring finns`);
        if (q.challenge === 'spot') {
          ok(q.answer === q.bad && q.choices.length === 3, `${tag}: svaret pekar på den felaktiga lösningen`);
          q.base.forEach((b, i) => { const st = checkAnswer(b, disp(b, q.shown[i])).status; ok(i === q.bad ? st === 'wrong' : st === 'correct', `${tag}: lösning ${i} är ${i === q.bad ? 'fel' : 'rätt'} enligt uppgiftens egen rättning (${st}, visat ${disp(b, q.shown[i])})`); });
        } else if (q.challenge === 'combine') {
          ok(Math.abs(q.answer - (q.base[0].answer + q.base[1].answer)) < 1e-6 && checkAnswer(q, String(q.answer).replace('.', ',')).status === 'correct', `${tag}: summan stämmer`);
        } else if (q.challenge === 'create') {
          ok(CHG.check(q, q.model).status === 'correct', `${tag}: exempelsvaret "${q.model}" godkänns`);
          ok(CHG.check(q, Poly.format(q.answer)).status !== 'correct', `${tag}: färdigförenklat svar utan parentes godkänns inte`);
          ok(CHG.check(q, '(' + Poly.format(q.answer) + ')').status !== 'correct', `${tag}: bara en yttre parentes räcker inte`);
          ok(CHG.check(q, '2(' + Poly.format(Poly.add(q.answer, Poly.num(1))) + ')').status === 'wrong', `${tag}: fel värde underkänns`);
          ok(CHG.check(q, '3(' + Poly.format(q.answer) + ') − 2(' + Poly.format(q.answer) + ')').status === 'correct', `${tag}: annat rätt uttryck godkänns`);
        } else if (q.challenge === 'equation') {
          const x = q.solution; ok(CHG.check(q, q.model).status === 'correct', `${tag}: exempelekvationen godkänns`);
          ok(CHG.check(q, `3(x − 1) = ${3 * (x - 1)}`).status === 'correct', `${tag}: egen ekvation med parentes godkänns`);
          ok(CHG.check(q, `2x + 1 = x + ${x + 1}`).status === 'correct', `${tag}: x på båda sidor godkänns`);
          ok(CHG.check(q, `x = ${x}`).status !== 'correct', `${tag}: "x = ${x}" är för enkelt`);
          ok(CHG.check(q, `2(x + 1) = ${2 * (x + 1) + 1}`).status === 'wrong', `${tag}: fel lösning underkänns`);
          ok(CHG.check(q, `2(x + 1) = 2x + 2`).status === 'wrong', `${tag}: identitet (oändligt många lösningar) underkänns`);
        } else if (q.challenge === 'order') {
          ok(new Set(q.items).size === q.items.length && q.items.length >= 3, `${tag}: unika steg`);
        } else if (q.challenge === 'false') {
          ok(q.answer === q.bad, `${tag}: svaret pekar på det falska påståendet`);
          q.base.forEach((b, i) => ok(i === q.bad ? q.shownIdx[i] !== b.answer : q.shownIdx[i] === b.answer, `${tag}: påstående ${i} är ${i === q.bad ? 'falskt' : 'sant'} enligt faktabanken`));
        }
      }
      if (!any) { none++; noneList.push(s.id); }
    }
    ok(made >= skills.length * 5, `Utmaningar: ${made} skapade · typer ${JSON.stringify(kinds)}`);
    ok(['spot', 'combine', 'create', 'equation', 'order', 'false'].every(k => kinds[k] > 0), 'alla utmaningstyper förekommer');
    { let bad = 0, n = 0; for (const { s } of skills) for (let k = 0; k < 4; k++) { const q = CHG.make(s, s.maxLvl || 3, k, { young: true }); if (q) { n++; if (!['combine', 'spot'].includes(q.challenge)) bad++; } else if ((s.group || 'math') !== 'math') continue; }
      ok(bad === 0 && n > 0, `yngre: bara korta matteutmaningar (dubbelsteg/hitta felet), ${n} skapade`); }
    ok(none <= Math.ceil(skills.length * 0.15), `moment utan Utmaning: ${none} (${noneList.join(', ')}) – motorn erbjuder då inga utmaningar där`);
    /* ---------- 4. Innehållsrevision (rapport) ---------- */
    const lowVar = []; const audit = [];
    for (const { s } of skills) { const ids = new Set(); for (let lv = 1; lv <= (s.maxLvl || 3); lv++) for (let r = 0; r < 15; r++) { try { ids.add(LECAT.itemId(s.gen(lv, {}))); } catch (e) { /* ignore */ } } if (ids.size < 6) lowVar.push(`${s.id}(${ids.size})`); const rb = recallBy[s.id]; audit.push([s.id, ids.size, rb ? `${rb[0]}/${rb[1]}` : 'eget svar']); }
    ok(lowVar.length <= Math.ceil(skills.length * 0.1), `låg variation (< 6 olika av 45): ${lowVar.join(', ') || 'inga'}`);
    const weakRecall = Object.entries(recallBy).filter(([, [a, b]]) => b >= 6 && a === 0).map(([id]) => id);
    console.log(`Innehållsrevision: ${skills.length} moment · låg variation: ${lowVar.join(', ') || 'inga'} · flerval utan eget-svar-variant: ${weakRecall.length} (${weakRecall.join(', ')})`);
    /* ---------- 3. Utmaningar i appen ---------- */
    const k8 = PA.KIDS.find(k => k.id === 'k8'); const p = PA.DB.profiles.k8; p.settings.engine = 'v2';
    T.click(T.$('[data-kid="k8"]')); PA.V2.start(k8, 'kor'); const S = PA.S; const C = S.v2.C;
    const chSkills = ['forenkla', 'ekvation', 'multin', 'kemi_syror', 'talfoljd', 'problemekv'].filter(id => k8.skills.some(s => s.id === id));
    const before = JSON.stringify(chSkills.map(id => { const c = C.L.c['s:' + id]; return c ? [c.st, c.lvl, c.due, c.fb] : null; }));
    const v1Before = JSON.stringify(chSkills.map(id => p.skills[id] || null)); const v1Fb = (p.mistakes || []).length;
    S.queue.length = 0; S.i = 0; S.v2.R.queue = chSkills.flatMap(id => [0, 1].map(() => ({ cid: 's:' + id, role: 'challenge', mode: 'challenge', why: 'fördjupning' }))); S.v2.R.i = 0; S.v2.R.maxItems = 99;
    PA.V2.advance(); PA.rerender(); const D = v2tools(w, T); D.run(false, 40);
    const chEv = p.le.log.filter(e => e[14] === 'c'); ok(chEv.length === chSkills.length * 2, `utmaningar spelade i appen: ${chEv.length}`);
    ok(chEv.every(e => e[4] === 1), 'alla utmaningar klarade med rätt svar via gränssnittet (spot/kombinera/skapa/ekvation/ordna/falskt)');
    const after = JSON.stringify(chSkills.map(id => { const c = PA.LE.state(k8).L.c['s:' + id]; return c ? [c.st, c.lvl, c.due, c.fb] : null; }));
    ok(before === after, 'utmaningar ändrar inte stadium, nivå, förfallodag eller Felbok');
    ok(JSON.stringify(chSkills.map(id => p.skills[id] || null)) === v1Before && (p.mistakes || []).length === v1Fb, 'M6: utmaningar ändrar inte heller v1:s mastery, nivå eller v1-Felboken (rollback)');
    // M6: en MISSLYCKAD utmaning rör inte v1 heller
    { PA.V2.start(k8, 'kor'); const S2 = PA.S; S2.queue.length = 0; S2.i = 0; S2.v2.R.queue = [{ cid: 's:forenkla', role: 'challenge', mode: 'challenge', why: 'fördjupning' }]; S2.v2.R.i = 0; PA.V2.advance(); PA.rerender();
      const sk0 = JSON.stringify(p.skills.forenkla || null), mi0 = (p.mistakes || []).length; v2tools(w, T).run(true, 3);
      ok(JSON.stringify(p.skills.forenkla || null) === sk0 && (p.mistakes || []).length === mi0, 'M6: misslyckad utmaning sänker inte v1-mastery och hamnar inte i v1-Felboken'); }
    ok(p.le.rw && p.le.rw.filter(k => k.startsWith('CH:')).length === 1, 'CHALLENGE-belöning högst en gång per pass');
    ok(PA.LE.errors.length === 0, 'inga fel: ' + JSON.stringify(PA.LE.errors));
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE CONTENT TEST FAILED' : 'LE CONTENT TEST OK'); process.exit(fails ? 1 : 0);
}, 50);
