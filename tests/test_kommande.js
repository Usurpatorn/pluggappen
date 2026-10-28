/* 3.6 Kommande prov och läxor på barnets startsida (riktiga appen i jsdom, SYNTETISK familj och skoluppgifter, fast klocka).
   · alla tre upplevelser: kortet visas när barnet har kommande mål, i datumordning, med typ, datum och "om X dagar"
   · bara barnets egna mål – aldrig ett syskons
   · passerade mål och mål längre bort än 60 dygn visas inte; inget kort utan mål
   · ärlighet: ett mål utan innehåll i appen sägs vara "inte inlagt i appen ännu", och kortet lovar inte att Kör! övar det
   · inga betyg (E/C/A), inga procent, ingen jämförelse
   · kortet ligger direkt under dagens kort, före "Läget inför" */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, T_FIXED } = require('./le/childflow.js');
const { toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const isoIn = (days) => new Date(T_FIXED + days * DAY).toISOString().slice(0, 10);
const CONTENT = { v: 1, updatedAt: 1, packs: [], work: [
  { id: 'syn-kemi', kid: 'k8', type: 'exam', title: 'Kemiprov', date: isoIn(20), kps: ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer'] },
  { id: 'syn-alg', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(12), skills: ['multin', 'forenkla', 'blandat'] },
  { id: 'syn-ori', kid: 'k8', type: 'homework', title: 'Läxförhör orientering', date: isoIn(7) },
  { id: 'syn-gammalt', kid: 'k8', type: 'exam', title: 'Gammalt prov', date: isoIn(-3), skills: ['multin'] },
  { id: 'syn-langt', kid: 'k8', type: 'exam', title: 'Långt bort', date: isoIn(90), skills: ['multin'] },
  { id: 'syn-glosor', kid: 'k4', type: 'vocab', title: 'Glosor vecka 46', date: isoIn(2) },
  { id: 'syn-ma4', kid: 'k4', type: 'exam', title: 'Matteprov', date: isoIn(9), skills: ['multin'] },
] };
async function boot(content) { const w = mkWin({ seed: 7, fixedClock: true }); await sleep(40); const T = tools(w); T.PA().FAMILY.apply(FIX); T.PA().load(); for (const k of ['k2', 'k4', 'k8']) T.PA().DB.profiles[k].exams = []; if (content) T.PA().FAMILY.applyContent(content); T.PA().rerender(); return { w, T }; }
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const card = (T) => T.$('.upcoming');
const rows = (T) => [...T.$('#app').querySelectorAll('.upcoming .up-row')].map(li => li.textContent.replace(/\s+/g, ' ').trim());

(async () => {
  try {
    const { w, T } = await boot(CONTENT);
    // Åttan: tre kommande mål i datumordning, inte det passerade, inte det 90 dygn bort
    openKid(T, 'k8'); const r8 = rows(T);
    ok(card(T) && r8.length === 3, `k8: tre kommande mål (${r8.length})`);
    ok(/Läxförhör orientering/.test(r8[0]) && /Algebraprov/.test(r8[1]) && /Kemiprov/.test(r8[2]), 'k8: datumordning');
    ok(/^Läxa/.test(r8[0]) && /^Prov/.test(r8[1]), 'k8: typ (läxa/prov)');
    ok(/om 7 dagar/.test(r8[0]) && /om 12 dagar/.test(r8[1]) && /om 20 dagar/.test(r8[2]), 'k8: om X dagar');
    ok(!r8.some(x => /Gammalt prov|Långt bort/.test(x)), 'k8: passerat och > 60 dygn visas inte');
    ok(/inte inlagt i appen ännu/.test(r8[0]) && !/inte inlagt/.test(r8[1] + r8[2]), 'k8: målet utan innehåll sägs ärligt sakna innehåll');
    ok(/Kör! övar inför det som finns i appen/.test(card(T).textContent) && !/fördelar övningen mellan dem/.test(card(T).textContent), 'k8: inget löfte om det som saknas');
    ok(!/Glosor|Matteprov/.test(card(T).textContent), 'k8: inga syskonmål');
    ok(!/\b[ECA]\b\s*(-nivå|nivå)|betyg|%/.test(card(T).textContent), 'k8: inga betyg eller procent');
    { const all = [...T.$('#app').querySelectorAll('.mission, .upcoming, .goal-detail')].map(x => x.classList.contains('upcoming') ? 'U' : x.classList.contains('goal-detail') ? 'G' : 'M').join('');
      ok(/^MU/.test(all) && (!/G/.test(all) || all.indexOf('U') < all.indexOf('G')), `k8: direkt under dagens kort, före Läget inför (${all})`); }
    ok((T.$('#app').innerHTML.match(/class="card upcoming/g) || []).length === 1, 'k8: kortet visas en gång');
    // Fyran: glosor (typ vocab) och prov, inga mål från Åttan
    openKid(T, 'k4'); const r4 = rows(T);
    ok(r4.length === 2 && /^Glosor/.test(r4[0]) && /om 2 dagar/.test(r4[0]) && /^Prov/.test(r4[1]), `k4: glosor och prov (${r4.join(' | ')})`);
    ok(!/Algebraprov|Kemiprov|orientering/.test(card(T).textContent), 'k4: inga syskonmål');
    ok(T.$('.upcoming .up-row.soon') && /Glosor/.test(T.$('.upcoming .up-row.soon').textContent), 'k4: nära mål (≤ 3 dygn) markeras');
    // Tvåan: inga mål – inget kort
    openKid(T, 'k2'); ok(!card(T), 'k2: inget kort utan mål');
    // idag / imorgon
    { const c2 = { ...CONTENT, work: [{ id: 'syn-idag', kid: 'k8', type: 'exam', title: 'Prov idag', date: isoIn(0), skills: ['multin'] }, { id: 'syn-imorgon', kid: 'k8', type: 'homework', title: 'Läxa imorgon', date: isoIn(1), skills: ['multin'] }] };
      const b = await boot(c2); openKid(b.T, 'k8'); const r = rows(b.T); ok(/idag/.test(r[0] || '') && /imorgon/.test(r[1] || ''), `idag/imorgon (${r.join(' | ')})`);
      ok(/fördelar övningen mellan dem/.test(card(b.T).textContent), 'alla mål i appen: Kör! fördelar övningen'); }
    // Föräldern lägger in ett eget prov (utan typ) i profilen: det syns som prov
    { const b = await boot(null); b.T.PA().DB.profiles.k8.exams = [{ id: 'eget', title: 'Eget prov', date: isoIn(5), skillIds: ['multin'], deckIds: [] }]; b.T.PA().save(); b.T.PA().LE.invalidate('k8'); openKid(b.T, 'k8'); const r = rows(b.T);
      ok(r.length === 1 && /^Prov/.test(r[0]) && /Eget prov/.test(r[0]), `eget inlagt prov visas (${r.join(' | ')})`); }
    void w;
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'KOMMANDE TEST FAILED' : 'KOMMANDE TEST OK'); process.exit(fails ? 1 : 0);
})();
