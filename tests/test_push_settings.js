/* 3.7.1 Påminnelser är en inställning (ägarens önskemål): inget påminnelsekort på barnens startsidor; i ⚙ väljer föräldern vem den här
   enheten påminner – föräldern eller ett av barnen, högst en. Riktiga appen i jsdom, SYNTETISK familj; push och nät ersätts (inga notiser). */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { toStart, unlockParent } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  try {
    const w = mkWin({ seed: 5, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); PA.rerender();
    const PUSH = w.eval('PUSH'); const SYNC = PA.SYNC; const DB = PA.DB;
    PUSH.key = 'test-key'; SYNC.cfg = { projectId: 'demo', apiKey: 'k' }; let supported = true; PUSH.supported = () => supported; PUSH.loadStatus = async () => {};
    const calls = []; PUSH.enable = async (id) => { calls.push(['on', id]); DB.settings.push = { id: 'push_x', kid: id }; return { ok: true }; };
    PUSH.disable = async () => { calls.push(['off']); DB.settings.push = null; };
    const openKid = (id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
    const openSettings = () => { unlockParent(w, T); w.eval("state.tab = 'settings'; go('parent')"); };
    // Barnens startsidor: inget påminnelsekort i någon upplevelse, inte heller när enheten påminner just det barnet
    for (const k of PA.KIDS) { openKid(k.id); ok(!T.$('#app [data-push]') && !/Påminnelser/.test(T.$('#app').textContent), `${k.id}: inget påminnelsekort på startsidan`); }
    DB.settings.push = { id: 'push_x', kid: 'k8' }; openKid('k8'); ok(!T.$('#app [data-push]'), 'k8: inget kort ens när enheten påminner k8'); DB.settings.push = null;
    // ⚙: en rad för föräldern och en per barn, högst en på
    openSettings(); const sw = () => [...w.document.querySelectorAll('.push-set [data-push]')];
    ok(sw().length === 1 + PA.KIDS.length && sw()[0].dataset.push === 'parent' && PA.KIDS.every(k => sw().some(b => b.dataset.push === k.id)), `⚙: föräldern och varje barn (${sw().map(b => b.dataset.push).join(',')})`);
    ok(sw().every(b => b.getAttribute('role') === 'switch' && b.getAttribute('aria-checked') === 'false'), '⚙: alla av från början, role=switch');
    T.click(w.document.querySelector('.push-set [data-push="k4"]')); await sleep(20);
    ok(calls.length === 1 && calls[0][1] === 'k4' && sw().filter(b => b.classList.contains('on')).map(b => b.dataset.push).join() === 'k4', '⚙: slå på ett barn – bara det barnet är på');
    T.click(w.document.querySelector('.push-set [data-push="parent"]')); await sleep(20);
    ok(calls[1][1] === 'parent' && sw().filter(b => b.classList.contains('on')).map(b => b.dataset.push).join() === 'parent', '⚙: välja föräldern byter (högst en)');
    T.click(w.document.querySelector('.push-set [data-push="parent"]')); await sleep(20);
    ok(calls[2][0] === 'off' && !sw().some(b => b.classList.contains('on')), '⚙: tryck igen – av');
    // Utan stöd (t.ex. iPad utan hemskärmsapp): hjälptext i ⚙, inga knappar och inget på startsidan
    supported = false; openSettings(); ok(!w.document.querySelector('.push-set') && /Påminnelser på den här enheten/.test(T.$('#app').textContent) && !T.$('#app [data-push]'), 'utan stöd: hjälptext i ⚙, inga knappar');
    openKid('k8'); ok(!/Påminnelser/.test(T.$('#app').textContent), 'utan stöd: inget på barnets startsida');
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`);
  console.log(fails ? 'PUSH SETTINGS TEST FAILED' : 'PUSH SETTINGS TEST OK');
  process.exit(fails ? 1 : 0);
})();
