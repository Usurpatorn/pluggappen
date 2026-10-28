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
/* Foten ska stämma med dagens plan (oberoende räknat: planens koncept mot målets aktiva koncept) */
const footCheck = (T, kidId) => { const PA = T.PA(); const kid = PA.KIDS.find(k => k.id === kidId); const p = PA.DB.profiles[kidId]; const plan = PA.EXP.coreDone(p) ? PA.EXP.peekFlow(kid) : PA.V2.peekPlan(kid).plan;
  const all = PA.EXP.upcoming(kid); const withC = all.filter(x => PA.V2.examCidsActive(kid, x.e).length); const inP = withC.filter(x => { const c = new Set(PA.V2.examCidsActive(kid, x.e)); return plan.some(s => c.has(s.cid)); });
  const t = (T.$('.upcoming') || {}).textContent || '';
  if (!plan.length || !withC.length) return !/Dagens Kör!/.test(t);
  if (!inP.length) return /Dagens Kör! övar annat idag/.test(t);
  if (inP.length === all.length) return /Dagens Kör! övar inför (alla de här|det här)\./.test(t);
  return new RegExp(`Dagens Kör! övar idag inför ${inP.length > 1 ? inP.length + ' av dem' : 'ett av dem'}\\.`).test(t); };
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
    ok(footCheck(T, 'k8') && !/övar inför alla de här/.test(card(T).textContent), `k8: foten stämmer med dagens plan och lovar inget om det som saknas (${card(T).textContent.replace(/\s+/g, ' ').slice(-90)})`);
    ok(T.$('.upcoming ul[role="list"]'), 'k8: listan behåller sin listsemantik (role=list)');
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
      ok(footCheck(b.T, 'k8'), `idag + imorgon: foten stämmer med planen (${card(b.T).textContent.replace(/\s+/g, ' ').slice(-80)})`); }
    { const c8 = { ...CONTENT, work: [{ id: 'a1', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(8), skills: ['multin', 'forenkla', 'blandat'] }] };
      const b = await boot(c8); openKid(b.T, 'k8'); ok(/Dagens Kör! övar inför det här\./.test(card(b.T).textContent) && footCheck(b.T, 'k8'), `ett prov om 8 dygn i dagens plan: "övar inför det här" (${card(b.T).textContent.replace(/\s+/g, ' ').slice(-80)})`);
      // 3.7: Kör och Testa mig per mål – startar målets egen träning respektive Testa mig för just det målet
      const go = b.T.$('.upcoming [data-v2="mission"][data-exam="w:a1"]'); const te = b.T.$('.upcoming [data-v2="testa"][data-exam="w:a1"]');
      ok(go && /^Kör/.test(go.textContent.trim()) && /min/.test(go.textContent) && te && /Testa mig/.test(te.textContent), 'raden har Kör (med minuter) och Testa mig');
      ok(go && /^Kör bara Algebraprov/.test(go.getAttribute('aria-label') || '') && /^Testa mig på Algebraprov/.test(te.getAttribute('aria-label') || ''), 'knapparnas namn börjar med den synliga texten och säger målet');
      const PA = b.T.PA(); const kid = PA.KIDS.find(k => k.id === 'k8'); const cids = new Set(PA.V2.examCidsActive(kid, PA.LE.exams(kid, PA.DB.profiles.k8).find(e => e.id === 'w:a1')));
      b.T.click(go); ok(PA.S && PA.S.v2 && PA.S.v2.mode === 'mission' && PA.S.v2.extra.examId === 'w:a1' && PA.S.queue.filter(q => q.spec && q.spec.cid).length > 0 && PA.S.queue.every(q => !(q.spec && q.spec.cid) || cids.has(q.spec.cid)), `Kör på raden: bara målets koncept (${PA.S && PA.S.v2 && PA.S.v2.mode})`);
      openKid(b.T, 'k8'); b.T.click(b.T.$('.upcoming [data-v2="testa"][data-exam="w:a1"]')); ok(PA.S && PA.S.v2 && PA.S.v2.exam && PA.S.v2.extra.examId === 'w:a1', 'Testa mig på raden: provet för just det målet'); }
    // Föräldern lägger in ett eget prov (utan typ) i profilen: det syns som prov
    { const b = await boot(null); b.T.PA().DB.profiles.k8.exams = [{ id: 'eget', title: 'Eget prov', date: isoIn(5), skillIds: ['multin'], deckIds: [] }]; b.T.PA().save(); b.T.PA().LE.invalidate('k8'); openKid(b.T, 'k8'); const r = rows(b.T);
      ok(r.length === 1 && /^Prov/.test(r[0]) && /Eget prov/.test(r[0]), `eget inlagt prov visas (${r.join(' | ')})`); }
    // Granskning P2-3: ett läx- eller glosförhör som föräldern lagt in (mindre, utan typ) heter Förhör – inte Prov
    { const b = await boot(null); b.T.PA().DB.profiles.k8.exams = [{ id: 'f1', title: 'Glosförhör v.46', date: isoIn(4), weight: 'minor', skillIds: ['multin'], deckIds: [] }, { id: 'f2', title: 'Stort prov', date: isoIn(6), weight: 'major', skillIds: ['multin'], deckIds: [] }]; b.T.PA().save(); b.T.PA().LE.invalidate('k8'); openKid(b.T, 'k8'); const r = rows(b.T);
      ok(/^Förhör/.test(r[0] || '') && /^Prov/.test(r[1] || ''), `mindre förhör utan typ = Förhör, större = Prov (${r.join(' | ')})`); }
    // Granskning P3-1: titeln tvättas (förälderns egna prov sparas som de skrivs)
    { const b = await boot(null); b.T.PA().DB.profiles.k8.exams = [{ id: 'x1', title: '<img src=x onerror="window.__pwn=1">Prov', date: isoIn(3), skillIds: ['multin'], deckIds: [] }]; b.T.PA().save(); b.T.PA().LE.invalidate('k8'); openKid(b.T, 'k8');
      ok(card(b.T) && !card(b.T).querySelector('img') && /<img/.test(card(b.T).textContent) && !b.w.__pwn, 'titeln visas som text, inte som HTML'); }
    // Granskning P2-2/P3-3: mål längre bort än motorns horisont lovas inte – och med "Bara prov och läxor" säger korten samma sak
    { const c3 = { ...CONTENT, work: [{ id: 'syn-langre', kid: 'k8', type: 'exam', title: 'Prov långt fram', date: isoIn(40), skills: ['multin'] }] };
      const b = await boot(c3); openKid(b.T, 'k8'); const t = card(b.T) ? card(b.T).textContent : '';
      ok(/om 40 dagar/.test(t) && footCheck(b.T, 'k8') && !/övar inför (alla de här|det här)/.test(t), `långt fram: foten säger vad dagens plan gör (${t.replace(/\s+/g, ' ').slice(-90)})`);
      const p = b.T.PA().DB.profiles.k8; p.settings.scope = 'exams'; p.settings.scopeAt = b.w.Date.now(); b.T.PA().save(); openKid(b.T, 'k8'); const t2 = b.T.$('#app').textContent.replace(/\s+/g, ' ');
      ok(!/Dagens Kör!/.test((b.T.$('.upcoming') || {}).textContent || '') && /Kör/.test(t2), `Bara prov och läxor utan plan: kortet lovar inget om dagens Kör!`); }
    { const c4 = { ...CONTENT, work: [{ id: 'n1', kid: 'k8', type: 'exam', title: 'Nära prov', date: isoIn(5), skills: ['multin'] }, { id: 'n2', kid: 'k8', type: 'exam', title: 'Senare prov', date: isoIn(35), skills: ['forenkla'] }] };
      const b = await boot(c4); openKid(b.T, 'k8'); ok(footCheck(b.T, 'k8'), `ett nära och ett långt fram: foten stämmer med planen (${card(b.T).textContent.replace(/\s+/g, ' ').slice(-90)})`); }
    // Granskning P2-1: före första synken (synk på, ingen hämtning, ingen motor) rör kortet inte motorns tillstånd
    for (const [id, title] of [['k8', 'achieve'], ['k4', 'grow'], ['k2', 'explore']]) {
      const c5 = { ...CONTENT, work: [{ id: 'cs-' + id, kid: id, type: 'exam', title: 'Prov', date: isoIn(10), skills: ['multin'] }] };
      const b = await boot(c5); const PA = b.T.PA(); delete PA.DB.profiles[id].le; PA.LE.invalidate(id);
      try { Object.defineProperty(PA.SYNC, 'active', { value: true, configurable: true, writable: true }); } catch (e) { PA.SYNC.active = true; } PA.SYNC.lastPull = {};
      openKid(b.T, id); ok(!PA.DB.profiles[id].le, `${title}: kortet skapar inte motorns tillstånd före första synken`);
      ok(card(b.T) && !/Kör|Testa mig|inte inlagt/.test(card(b.T).textContent) && !card(b.T).querySelector('button'), `${title}: före första synken bara listan, inga knappar, inga löften`); }
    // Granskning P3-4: ordningen i grow och explore, och "och N till"
    for (const [id, exp] of [['k4', 'grow'], ['k2', 'explore']]) {
      const c6 = { ...CONTENT, work: [{ id: 'o-' + id, kid: id, type: 'exam', title: 'Prov', date: isoIn(5), skills: ['multin'] }] };
      const b = await boot(c6); openKid(b.T, id); const all = [...b.T.$('#app').querySelectorAll('.mission, .upcoming, .goal-detail')].map(x => x.classList.contains('upcoming') ? 'U' : x.classList.contains('goal-detail') ? 'G' : 'M').join('');
      ok(/^MU/.test(all) && (!/G/.test(all) || all.indexOf('U') < all.indexOf('G')), `${exp}: under dagens kort, före Läget inför (${all})`); }
    { const c7 = { ...CONTENT, work: Array.from({ length: 8 }, (_, i) => ({ id: 'm' + i, kid: 'k8', type: 'homework', title: 'Läxa ' + (i + 1), date: isoIn(2 + i * 3) })) };
      const b = await boot(c7); openKid(b.T, 'k8'); ok(rows(b.T).length === 6 && /och 2 till längre fram/.test(card(b.T).textContent), 'högst sex rader och "och 2 till längre fram"'); }
    // (D.run(() => false) = allt rätt, som i test_ova_mer.js)
    // Efter dygnets belönade extrapass: Kör på raden följer Öva mer-reglerna – "utan poäng" synligt, inga belöningar, och bara när det gör nytta
    { const c9 = { ...CONTENT, work: [{ id: 'p1', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(8), skills: ['multin', 'forenkla', 'blandat', 'talfoljd', 'ekvation'] }] };
      const b = await boot(c9); const PA = b.T.PA(); const kid = PA.KIDS.find(k => k.id === 'k8'); const { v2tools } = require('./le/v2driver.js'); const D = v2tools(b.w, b.T);
      const wrong = () => true;   // allt fel i dygnets pass: inget av målet har blivit rätt idag, så målets träning gör nytta (EXP.useful)
      openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); D.run(wrong);
      for (let i = 0; i < 3; i++) { PA.V2.start(kid, 'mission', { examId: 'w:p1' }); if (PA.S && PA.S.v2) D.run(wrong); }
      openKid(b.T, 'k8'); const go = b.T.$('.upcoming [data-v2="mission"]'); const t = card(b.T).textContent;
      ok(!!go, `efter dygnets extrapass med fel kvar: Kör på raden erbjuds (${t.replace(/\s+/g, ' ').slice(-90)})`);
      if (go) { ok(/utan poäng/.test(go.textContent) && /utan poäng/.test(go.getAttribute('aria-label') || ''), `efter dygnets extrapass: "utan poäng" syns (${go.textContent.trim()})`);
        const r0 = JSON.stringify({ xp: PA.DB.profiles.k8.xp, gems: PA.DB.profiles.k8.gems }); b.T.click(go); ok(PA.S.v2.po === true, 'Kör på raden efter dygnets extrapass är övning utan poäng'); D.run(() => false);
        ok(JSON.stringify({ xp: PA.DB.profiles.k8.xp, gems: PA.DB.profiles.k8.gems }) === r0, 'inga XP eller diamanter'); }
      else ok(/Inget mer som gör nytta idag|Inget att öva just nu/.test(t), `efter dygnets extrapass: ärlig text när inget gör nytta (${t.replace(/\s+/g, ' ').slice(-90)})`);
      let n = 0; openKid(b.T, 'k8'); while (b.T.$('.upcoming [data-v2="mission"]') && n < 25) { b.T.click(b.T.$('.upcoming [data-v2="mission"]')); D.run(() => false); n++; openKid(b.T, 'k8'); }
      ok(n < 25 && /Inget mer som gör nytta idag|Inget att öva just nu/.test(card(b.T).textContent), `Kör på raden tar slut när inget gör nytta – ingen ändlös upprepning (${n} block)`); }
    void w;
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'KOMMANDE TEST FAILED' : 'KOMMANDE TEST OK'); process.exit(fails ? 1 : 0);
})();
