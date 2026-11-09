/* 3.7.5 Ägarens beslut: målets egen Kör (prov, läxa, glosförhör) ska kunna övas obegränsat – barnet ska kunna repetera hur mycket som
   helst, också kvällen före provet och när allt redan blivit rätt idag. Fyndet: efter några rundor stod "Inget mer som gör nytta idag"
   på provraden och det gick inte att öva mer. Riktiga appen i jsdom, SYNTETISKT innehåll, fast klocka.
   · raden erbjuder Kör efter varje runda (30 rundor, allt rätt) – aldrig "Inget mer som gör nytta idag"
   · varje runda har minst V2.MISSION_MIN uppgifter och bara målets innehåll
   · efter dygnets extrapass är rundorna utan poäng (oförändrade belöningsregler) */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, T_FIXED } = require('./le/childflow.js');
const { toStart, v2tools } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const isoIn = (days) => new Date(T_FIXED + days * DAY).toISOString().slice(0, 10);
const SHAPES = [
  ['prov med kunskapspunkter (åk 8)', { kid: 'k8', type: 'exam', kps: ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer'] }],
  ['prov med färdigheter (åk 8)', { kid: 'k8', type: 'exam', skills: ['multin', 'forenkla'] }],
  ['läxa (åk 4)', { kid: 'k4', type: 'homework', skills: ['mult'] }],
];

(async () => {
  try {
    for (const [name, sh] of SHAPES) for (const d of [1, 3, 5]) {
      const w = mkWin({ seed: 31 + d, fixedClock: true }); await sleep(30); const T = tools(w); const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); for (const k of ['k2', 'k4', 'k8']) PA.DB.profiles[k].exams = [];
      PA.FAMILY.applyContent({ v: 1, updatedAt: 1, packs: [], work: [{ id: 'g', title: 'Målet', date: isoIn(d), ...sh }] }); PA.rerender(); const D = v2tools(w, T);
      const kid = PA.KIDS.find(k => k.id === sh.kid); const open = () => { toStart(T); T.click(T.$(`[data-kid="${sh.kid}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
      const tag = `${name}, ${d} dygn`; open(); const go = T.$('.go-btn[data-v2="kor"]'); if (go) { T.click(go); D.run(() => true); }
      let rounds = 0, minN = Infinity, foreign = 0, poSeen = false;
      for (let r = 0; r < 30; r++) {
        open(); const btn = T.$('.upcoming [data-v2="mission"][data-exam="w:g"]');
        if (!btn) { const row = [...T.$('#app').querySelectorAll('.upcoming .up-row')].find(li => li.dataset.row === 'w:g'); ok(false, `${tag}: runda ${r + 1} erbjuder Kör (${row ? row.textContent.replace(/\s+/g, ' ').slice(0, 90) : 'ingen rad'})`); break; }
        if (/utan poäng/.test(btn.textContent)) poSeen = true;
        const e = PA.LE.exams(kid, PA.DB.profiles[sh.kid]).find(x => x.id === 'w:g'); const cids = new Set(PA.V2.examCidsActive(kid, e));
        T.click(btn); let n = 0, g = 0; while (PA.S && PA.S.v2 && T.$('#qcard') && g++ < 80) { const it = PA.S.queue[PA.S.i]; if (it.cat !== 'learn') { n++; if (it.spec && !cids.has(it.spec.cid)) foreign++; } D.answer(() => true); w.__advance(4000); }
        rounds++; minN = Math.min(minN, n); w.__advance(5 * 60000);
      }
      // Ägarens fall: efter dygnets extrapass bedömer Öva mer-regeln (EXP.useful) att inget mer gör nytta idag – målets egen Kör ska ändå stå kvar
      { const u0 = PA.EXP.useful; PA.EXP.useful = () => false; open(); const btn = T.$('.upcoming [data-v2="mission"][data-exam="w:g"]'); ok(!!btn && /utan poäng/.test(btn.textContent), `${tag}: Kör står kvar (utan poäng) också när Öva mer-regeln säger att inget mer gör nytta`); PA.EXP.useful = u0; }
      ok(rounds === 30, `${tag}: Kör erbjuds efter varje runda (${rounds} av 30, allt rätt)`);
      ok(minN >= 3 && minN >= Math.min(PA.V2.MISSION_MIN, 3), `${tag}: varje runda har uppgifter (kortaste ${minN})`);
      ok(foreign === 0, `${tag}: bara målets innehåll (${foreign} utanför)`);
      ok(poSeen, `${tag}: efter dygnets extrapass är rundorna utan poäng`);
      ok(!/Inget mer som gör nytta idag/.test((T.$('.upcoming') || {}).textContent || ''), `${tag}: raden säger aldrig "Inget mer som gör nytta idag"`);
    }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`);
  console.log(fails ? 'GOAL UNLIMITED TEST FAILED' : 'GOAL UNLIMITED TEST OK');
  process.exit(fails ? 1 : 0);
})();
