/* 2.1 Läs upp: behörighet per fråga (NO/SO ja, läsförståelse nej), tydlig knapp för Yngre som läser fråga + alternativ, enhetens
   egen talsyntes (ingen extern tjänst), och ingen knapp alls när talsyntes saknas. SYNTETISK familj. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const FIX = require('./test_fixture_family.json'); const { v2tools, classic, toStart } = require('./le/v2driver.js'); const { tools } = require('./le/childflow.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const spoken = [];
function win(withTts) {
  const html = fs.readFileSync(path.join(__dirname, '../dist/pluggappen.html'), 'utf8');
  return new JSDOM(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w) {
    w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false, addEventListener() {} }); w.HTMLCanvasElement.prototype.getContext = () => null;
    let a = 77; w.Math.random = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    if (withTts) { w.speechSynthesis = { getVoices: () => [{ lang: 'sv-SE', name: 'Alva' }], speak: (u) => spoken.push(u.text), cancel() {}, onvoiceschanged: null }; w.SpeechSynthesisUtterance = function (t) { this.text = t; }; }
    w.fetch = () => Promise.reject(new Error('offline i testet'));   // inget nätverk – och ingen extern taltjänst
  } }).window;
}
const w = win(true); const T = tools(w);
setTimeout(() => { try {
  const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); classic(T); PA.rerender(); const D = v2tools(w, T);
  // 1) Behörighet per fråga
  const k2 = PA.KIDS.find(k => k.id === 'k2'); const k8 = PA.KIDS.find(k => k.id === 'k8');
  const lasa = k2.skills.find(s => s.id === 'sv_lasa'); const qL = PA.makeQuestion(k2, lasa, 2, { noOpen: true }); ok(!PA.V2.canSpeak({ ...qL, skill: lasa }), 'läsförståelse (sv_lasa): ingen uppläsning');
  const P = PA.PACKS; const cidNo = Object.keys(P.REG.kp).find(c => c.startsWith('k:naso2-var-varld/djurgrupper'));
  const qNo = P.question(cidNo, { lvl: 1, pol: 'younger', rnd: P.seeded(1) }); ok(PA.V2.canSpeak({ ...qNo, skill: P.skillFor(k2, 'no_djur') }), 'NO-fråga: uppläsning tillåten');
  const cidRead = Object.keys(P.REG.kp).find(c => c.startsWith('k:sv8-sprak-och-lasning/las-fakta'));
  const qR = P.question(cidRead, { lvl: 2, pol: 'older', rnd: P.seeded(2) }); ok(qR.speak === false && !PA.V2.canSpeak({ ...qR, skill: P.skillFor(k8, 'sv8_lasa') }), 'lästext i paket: aldrig uppläsning');
  ok(/eller/.test(PA.V2.sayText(qNo)) && qNo.choices.every(c => PA.V2.sayText(qNo).includes(PA.RECALL.strip(c).trim())), 'Läs upp läser frågan och alla alternativ');
  // 2) Yngre i ett pass: tydlig "Läs upp"-knapp på en behörig fråga, och klick → enhetens talsyntes
  toStart(T); T.click(T.$('[data-kid="k2"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]'));
  let shown = 0, clicked = 0, blocked = 0;
  for (let d = 0; d < 3; d++) {
    T.click(T.$('[data-v2="kor"]') || T.$('[data-v2="extra"]'));
    let n = 0; while (PA.S && PA.S.v2 && T.$('#qcard') && n++ < 40) {
      const it = PA.S.queue[PA.S.i]; const btn = [...w.document.querySelectorAll('[data-speak]')].find(b => /Läs upp/.test(b.textContent));
      if (it.cat === 'math') { if (PA.V2.canSpeak(it)) { if (btn) { shown++; const before = spoken.length; T.click(btn); if (spoken.length > before) clicked++; } } else { if (!btn) blocked++; else ok(false, 'knapp på en fråga där läsningen övas: ' + it.skill.id); } }
      D.answer(false); if (w.__advance) w.__advance(4000);
    }
    toStart(T); T.click(T.$('[data-kid="k2"]'));
  }
  ok(shown >= 3 && clicked === shown, `Yngre: "Läs upp" på behöriga frågor (${shown}) och den läser upp (${clicked})`);
  // 3) Äldre: ingen stor knapp (bara den vanliga ikonen)
  toStart(T); T.click(T.$('[data-kid="k8"]')); T.click(T.$('[data-v2="kor"]') || T.$('[data-v2="extra"]'));
  ok(![...w.document.querySelectorAll('[data-speak]')].some(b => /Läs upp/.test(b.textContent)), 'Äldre: ingen "Läs upp"-knapp i texten');
} catch (e) { fails++; console.log('EXC', e.stack); }
  // 4) Utan talsyntes: ingen knapp, inga fel
  const w2 = win(false); const T2 = tools(w2);
  setTimeout(() => { try {
    T2.PA().FAMILY.apply(FIX); T2.PA().load(); classic(T2); T2.PA().rerender(); toStart(T2); T2.click(T2.$('[data-kid="k2"]')); if (T2.$('[data-pet]')) T2.click(T2.$('[data-pet]'));
    T2.click(T2.$('[data-v2="kor"]')); ok(!T2.$('[data-speak]') || ![...w2.document.querySelectorAll('[data-speak]')].some(b => /Läs upp/.test(b.textContent)), 'utan talsyntes: ingen Läs upp-knapp');
    ok(T2.PA().LE.errors.length === 0, 'utan talsyntes: inga fel');
  } catch (e) { fails++; console.log('EXC', e.stack); }
    console.log(`${checks} kontroller, ${fails} fel`); console.log(fails ? 'READ-ALOUD TEST FAILED' : 'READ-ALOUD TEST OK'); process.exit(fails ? 1 : 0); }, 50);
}, 50);
