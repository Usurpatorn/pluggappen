/* 3.6.1 ⚙ i föräldraläget: påminnelsernas senaste körning hämtas en gång per sidladdning – ingen ändlös hämta-rita-om-slinga när
   dokumentet saknas i molnet (404) eller nätet är borta. Riktiga appen i jsdom, SYNTETISK familj; hämtningen ersätts (inget nät). */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  try {
    for (const mode of ['404', 'offline', 'finns']) {
      const w = mkWin({ seed: 3, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); PA.rerender();
      const SYNC = PA.SYNC; const PUSH = w.eval('PUSH');
      try { Object.defineProperty(SYNC, 'active', { value: true, configurable: true, writable: true }); } catch (e) { SYNC.active = true; }
      // Hämtningen själv (nätet) ersätts: 404 och offline lämnar statusen tom, "finns" sätter den. Efter 20 anrop svarar den aldrig, så att en
      // slinga i appen avslutas och syns som ett fel i stället för att testet hänger.
      let fetches = 0; PUSH.loadStatus = () => { fetches++; if (fetches > 20) return new Promise(() => {}); if (mode === 'finns') PUSH.lastStatus = { at: 1, sent: 0 }; return Promise.resolve(); };
      let renders = 0; const V = w.eval('VIEWS'); const p0 = V.parent; V.parent = function () { renders++; return p0.apply(this, arguments); };
      w.eval("parentUnlocked = true; state.tab = 'settings'; go('parent')"); await sleep(300);
      ok(fetches === 1, `${mode}: påminnelseloggen hämtas en gång (${fetches})`);
      ok(renders <= (mode === 'finns' ? 2 : 1), `${mode}: ingen omritningsslinga (${renders} ritningar)`);
      if (mode === 'finns') ok(!!PUSH.lastStatus, 'finns: statusen kom fram och sidan ritades om med den');
      w.eval("go('parent')"); await sleep(100); ok(fetches === 1, `${mode}: ny visning av ⚙ hämtar inte igen samma sidladdning (${fetches})`);
    }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`);
  console.log(fails ? 'PARENT STATUS TEST FAILED' : 'PARENT STATUS TEST OK');
  process.exit(fails ? 1 : 0);
})();
