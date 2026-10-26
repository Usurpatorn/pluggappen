/* 2.1: rikare generatorer för små mattebanker åk 2 (former, bråk) – bara v2 (gen2). Varje fråga: giltigt svar, unika alternativ,
   rätt svar godkänns, och klart fler olika frågor än i 2.0 på de låga nivåerna. v1 (gen) är oförändrad (test_v1_regression). */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, FIX } = require('./le/childflow.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 20) console.log('FAIL', m); } };
const w = mkWin({ seed: 31 });
setTimeout(() => { try {
  const PA = w.PA; PA.FAMILY.apply(FIX); PA.load(); const kid = PA.KIDS.find(k => k.id === 'k2');
  for (const id of ['former', 'brak2']) { const s = kid.skills.find(x => x.id === id); ok(typeof s.gen2 === 'function', `${id}: gen2 finns`);
    for (let l = 1; l <= 4; l++) { const v1 = new Set(), v2 = new Set();
      for (let i = 0; i < 500; i++) {
        const q = PA.makeQuestion(kid, s, l, { noOpen: true, v2: true }); v2.add(PA.LECAT.itemId(q)); v1.add(PA.LECAT.itemId(PA.makeQuestion(kid, s, l, { noOpen: true })));
        ok(q.text && q.steps && q.steps.length && q.hint !== undefined, `${id}@${l}: text, förklaring`);
        if (q.type === 'choicetext') { ok(q.choices.length >= 3 && new Set(q.choices).size === q.choices.length && q.answer >= 0, `${id}@${l}: alternativ ${q.choices.join('|')}`); ok(PA.checkAnswer(q, String(q.answer)).status === 'correct', `${id}@${l}: rätt svar godkänns`); }
        else if (q.type === 'num') { ok(Number.isFinite(q.answer), `${id}@${l}: talsvar ${q.text}`); ok(PA.checkAnswer(q, String(q.answer)).status === 'correct', `${id}@${l}: rätt tal godkänns`); if (q.choices) ok(q.choices.includes(q.answer) && new Set(q.choices).size === q.choices.length, `${id}@${l}: talalternativ`); }
      }
      if (l <= 3 && id === 'former' || l === 1) ok(v2.size >= Math.max(10, v1.size * 2), `${id} nivå ${l}: ${v2.size} olika frågor i v2 (2.0: ${v1.size})`);
      console.log(`${id} nivå ${l}: v1 ${v1.size} · v2 ${v2.size}`);
    } }
} catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(fails ? `GEN2 TEST FAILED (${fails} av ${checks})` : `GEN2 TEST OK – ${checks} kontroller`); process.exit(fails ? 1 : 0); }, 50);
