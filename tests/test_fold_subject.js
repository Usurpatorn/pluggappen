/* 3.7.2 Ägarens fynd: under "Öva på egen hand" stängdes hela delen när barnet valde ett ämne. Riktiga appen i jsdom, SYNTETISK familj.
   I alla tre upplevelserna: öppna delen, välj ämne → delen är fortfarande öppen och visar det valda ämnet; en stängd del öppnas inte av sig själv. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  try {
    const w = mkWin({ seed: 3, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); PA.rerender();
    for (const id of ['k2', 'k4', 'k8']) {
      const kid = PA.KIDS.find(k => k.id === id); const exp = PA.EXP.of(kid);
      toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]'));
      const fold = () => [...T.$('#app').querySelectorAll('details.more-fold')].find(d => /Öva på egen hand/.test((d.querySelector('summary') || {}).textContent || '')); if (!fold()) { ok(false, `${id} (${exp}): delen "Öva på egen hand" finns`); continue; }
      fold().open = true; const subs = [...fold().querySelectorAll('[data-subj]')]; ok(subs.length >= 2, `${id} (${exp}): minst två ämnen (${subs.length})`); if (subs.length < 2) continue;
      const target = subs[subs.length - 1].dataset.subj; T.click(subs[subs.length - 1]);
      ok(fold() && fold().open, `${id} (${exp}): delen är fortfarande öppen efter ämnesbyte`);
      ok(fold() && fold().querySelector(`[data-subj="${target}"].on, [data-subj="${target}"][aria-pressed="true"], [data-subj="${target}"].active, [data-subj="${target}"].sel`) || (PA.DB && w.eval('state.subj') === target), `${id} (${exp}): det valda ämnet visas (${target})`);
      fold().open = false; T.click(fold().querySelector('[data-subj]') || T.$('[data-subj]')); ok(fold() && !fold().open, `${id} (${exp}): en stängd del öppnas inte av sig själv`);
    }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`);
  console.log(fails ? 'FOLD SUBJECT TEST FAILED' : 'FOLD SUBJECT TEST OK');
  process.exit(fails ? 1 : 0);
})();
