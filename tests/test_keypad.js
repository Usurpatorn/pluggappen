/* Uttrycksknappsatsen (beslut 9 i v3-granskningen): siffrorna 1–0 i ordning på en egen rad i ALLA lägen – v1/Klassisk och v3.
   Tidigare låg Klassisk/v1 i ordningen 7 8 9 4 5 6 1 2 3 0 i samma rutnät som x, +, − och ⌫, så siffrorna blandades med tecknen.
   Bara presentationen: svaret, rättningen och vad som sparas är oförändrade (v1-referensen innehåller ingen uttrycksuppgift och är
   därför oförändrad – kontrolleras av test_v1_regression). */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const keysOf = (T) => { const rows = [...T.$('#qcard').querySelectorAll('.keys')]; return rows.map(r => [...r.querySelectorAll('[data-key]')].map(b => b.dataset.key)); };
(async () => {
  try {
    for (const mode of ['v1', 'klassisk']) { const v2 = mode === 'klassisk';
      const w = mkWin({ seed: 5, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load();
      const p = PA().DB.profiles.k8; p.settings = { ...(p.settings || {}), ...(v2 ? { exp: 'classic' } : { engine: 'v1' }) }; PA().save(); PA().LE.invalidate && PA().LE.invalidate('k8'); PA().rerender();
      toStart(T); T.click(T.$('[data-kid="k8"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]'));
      const b = T.$('[data-skill="forenkla"]') || T.$('[data-skill="multin"]'); ok(!!b, `${v2 ? 'Klassisk v2' : 'v1'}: övningsknapp för ett algebramoment finns`); if (!b) continue;
      T.click(b); let seen = 0, g = 0;
      while (PA().S && T.$('#qcard') && g++ < 30 && seen < 3) { const it = PA().S.queue[PA().S.i];
        if (it && it.type === 'expr') { seen++; const rows = keysOf(T); const digits = rows.flat().filter(k => /^\d$/.test(k));
          ok(digits.join('') === '1234567890', `${v2 ? 'Klassisk v2' : 'v1'}: siffrorna i ordning 1–0 (${digits.join('')})`);
          ok(rows[0] && rows[0].every(k => /^\d$/.test(k)) && rows[0].length === 10, `${v2 ? 'Klassisk v2' : 'v1'}: siffrorna på egen rad, inga tecken emellan`);
          ok(rows.slice(1).flat().some(k => k.trim() === '+') && rows.slice(1).flat().includes('⌫'), `${v2 ? 'Klassisk v2' : 'v1'}: tecknen och sudd finns kvar på raden under`);
          // knapparna skriver fortfarande i svarsfältet
          const inp = T.$('#ans'); inp.value = ''; T.click(T.$('[data-key="1"]')); T.click(T.$('[data-key="0"]')); ok(inp.value === '10', `${v2 ? 'Klassisk v2' : 'v1'}: knapparna skriver i svarsfältet (${inp.value})`); inp.value = '';
        }
        if (T.$('[data-choice]')) T.click(T.$('[data-choice]')); else { if (T.$('#ans')) T.$('#ans').value = '1'; if (T.$('#submit')) T.click(T.$('#submit')); }
        if (T.$('#next')) T.click(T.$('#next')); w.__advance(2000); }
      ok(v2 ? PA().V2.on(PA().KIDS.find(k => k.id === 'k8')) && PA().EXP.of(PA().KIDS.find(k => k.id === 'k8')) === 'classic' : !PA().V2.on(PA().KIDS.find(k => k.id === 'k8')), `läget är ${mode}`);
      ok(seen > 0, `${v2 ? 'Klassisk v2' : 'v1'}: en uttrycksuppgift prövades (${seen})`);
    }
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'KEYPAD TEST FAILED' : 'KEYPAD TEST OK'); process.exit(fails ? 1 : 0);
})();
