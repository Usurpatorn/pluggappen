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
const FOOT = /(Dagens pass|Nästa extrapass) övar/;
const footCheck = (T, kidId) => { const PA = T.PA(); const kid = PA.KIDS.find(k => k.id === kidId); const p = PA.DB.profiles[kidId]; const done = PA.EXP.coreDone(p);
  const plan = done ? (PA.EXP.canFlow(kid) ? PA.EXP.peekFlow(kid) : []) : PA.V2.peekPlan(kid).plan; const pre = done ? 'Nästa extrapass' : 'Dagens pass';
  const all = PA.EXP.upcoming(kid); const withC = all.filter(x => PA.V2.examCidsActive(kid, x.e).length); const inP = withC.filter(x => { const c = new Set(PA.V2.examCidsActive(kid, x.e)); return plan.some(s => c.has(s.cid)); });
  const t = (T.$('.upcoming') || {}).textContent || '';
  if (!plan.length || !withC.length) return !FOOT.test(t);
  if (!inP.length) return t.includes(pre + ' övar annat.');
  if (inP.length === all.length) return t.includes(`${pre} övar inför ${inP.length > 1 ? 'alla de här' : 'det här'}.`);
  return t.includes(`${pre} övar inför ${inP.length > 1 ? inP.length + ' av dem' : 'ett av dem'}.`); };
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
    { const PA = T.PA(); const kid = PA.KIDS.find(k => k.id === 'k8'); const ex = PA.LE.exams(kid, PA.DB.profiles.k8); const lis = [...T.$('#app').querySelectorAll('.upcoming .up-row')];
      const bad = lis.filter(li => [...li.querySelectorAll('[data-exam]')].some(bt => (ex.find(e => e.id === bt.dataset.exam) || {}).title !== li.querySelector('.up-title').textContent));
      ok(!bad.length && lis.filter(li => li.querySelector('[data-exam]')).length === 2, `k8: varje rads knappar hör till just den raden (${lis.length} rader, fel: ${bad.length})`);
      const ori = lis.find(li => /orientering/.test(li.textContent)); ok(ori && !ori.querySelector('button') && !ori.querySelector('details'), 'k8: inga knappar och inget läge för ett mål utan innehåll i appen');
      // 3.6 Läget per mål: hopfällt i varje rad med innehåll, samma lägen som motorn (aldrig procent), och inget separat "Läget inför" för samma mål
      const sts = [...T.$('#app').querySelectorAll('.upcoming details.up-state')]; ok(sts.length === 2 && sts.every(d => !d.open && d.closest('.up-row').querySelector('[data-v2="testa"]')), `k8: läget finns för båda målen med innehåll, hopfällt (${sts.length})`);
      const okSum = sts.every(d => { const e = ex.find(x => x.id === d.dataset.goal); const C = PA.LE.state(kid); const per = PA.EXP.goalAreas(kid, e, C) || PA.V2.examStatus(kid, e, C, PA.LE.now()).per; const sum = d.querySelector('summary').textContent;
        return per.every(x => x.ready === 'För lite underlag') ? /för lite underlag ännu/.test(sum) : ['Bra koll', 'Öva lite mer'].every(r => { const n = per.filter(x => x.ready === r).length; return !n || sum.includes(`${n} ${r.toLowerCase()}`); }); });
      ok(okSum && !/%/.test(card(T).textContent), 'k8: sammanfattningen räknar motorns lägen, inga procent');
      ok(!sts.some(d => T.$(`details.goal-detail`) && T.$('details.goal-detail').textContent.includes((ex.find(x => x.id === d.dataset.goal) || {}).title)), 'k8: inget separat "Läget inför" för ett mål som redan har sitt läge i kortet');
      ok(/de säger inget om provresultatet/.test(card(T).textContent), 'k8: lägena sägs inte vara en prognos'); }
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
      const b = await boot(c8); openKid(b.T, 'k8'); ok(/Dagens pass övar inför det här\./.test(card(b.T).textContent) && footCheck(b.T, 'k8'), `ett prov om 8 dygn i dagens plan: "övar inför det här" (${card(b.T).textContent.replace(/\s+/g, ' ').slice(-80)})`);
      // 3.6: Kör och Testa mig per mål – startar målets egen träning respektive Testa mig för just det målet
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
    { const b = await boot(null); b.T.PA().DB.profiles.k8.exams = [{ id: 'x2', title: 'Prov" autofocus onfocus="window.__pwn=1" x="', date: isoIn(10), skillIds: ['multin'], deckIds: [] }]; b.T.PA().save(); b.T.PA().LE.invalidate('k8'); openKid(b.T, 'k8');
      const bts = [...card(b.T).querySelectorAll('button')]; ok(bts.length >= 2 && bts.every(bt => !bt.hasAttribute('onfocus') && !bt.hasAttribute('autofocus') && /Prov" autofocus/.test(bt.getAttribute('aria-label') || '')), 'titeln i knapparnas namn kan inte bryta sig ut ur attributet'); }
    // Granskning P2-2/P3-3: mål längre bort än motorns horisont lovas inte – och med "Bara prov och läxor" säger korten samma sak
    { const c3 = { ...CONTENT, work: [{ id: 'syn-langre', kid: 'k8', type: 'exam', title: 'Prov långt fram', date: isoIn(40), skills: ['multin'] }] };
      const b = await boot(c3); openKid(b.T, 'k8'); const t = card(b.T) ? card(b.T).textContent : '';
      ok(/om 40 dagar/.test(t) && footCheck(b.T, 'k8') && !/övar inför (alla de här|det här)/.test(t), `långt fram: foten säger vad dagens plan gör (${t.replace(/\s+/g, ' ').slice(-90)})`);
      const p = b.T.PA().DB.profiles.k8; p.settings.scope = 'exams'; p.settings.scopeAt = b.w.Date.now(); b.T.PA().save(); openKid(b.T, 'k8'); const t2 = b.T.$('#app').textContent.replace(/\s+/g, ' ');
      ok(!FOOT.test((b.T.$('.upcoming') || {}).textContent || '') && /Kör/.test(t2), `Bara prov och läxor utan plan: kortet lovar inget om dagens pass`); }
    { const c4 = { ...CONTENT, work: [{ id: 'n1', kid: 'k8', type: 'exam', title: 'Nära prov', date: isoIn(5), skills: ['multin'] }, { id: 'n2', kid: 'k8', type: 'exam', title: 'Senare prov', date: isoIn(35), skills: ['forenkla'] }] };
      const b = await boot(c4); openKid(b.T, 'k8'); ok(footCheck(b.T, 'k8'), `ett nära och ett långt fram: foten stämmer med planen (${card(b.T).textContent.replace(/\s+/g, ' ').slice(-90)})`); }
    // Granskning P2-1: före första synken (synk på, ingen hämtning, ingen motor) rör kortet inte motorns tillstånd
    for (const [id, title, scope] of [['k8', 'achieve'], ['k4', 'grow'], ['k2', 'explore'], ['k8', 'achieve + Bara prov och läxor', true], ['k4', 'grow + Bara prov och läxor', true]]) {
      const c5 = { ...CONTENT, work: [{ id: 'cs-' + id, kid: id, type: 'exam', title: 'Prov', date: isoIn(10), skills: ['multin'] }] };
      const b = await boot(c5); const PA = b.T.PA(); delete PA.DB.profiles[id].le; PA.LE.invalidate(id); if (scope) { PA.DB.profiles[id].settings.scope = 'exams'; PA.DB.profiles[id].settings.scopeAt = b.w.Date.now(); }
      try { Object.defineProperty(PA.SYNC, 'active', { value: true, configurable: true, writable: true }); } catch (e) { PA.SYNC.active = true; } PA.SYNC.lastPull = {};
      openKid(b.T, id); ok(!PA.DB.profiles[id].le, `${title}: kortet skapar inte motorns tillstånd före första synken`);
      ok(card(b.T) && !/Kör|Testa mig|inte inlagt|Läget/.test(card(b.T).textContent) && !card(b.T).querySelector('button, details'), `${title}: före första synken bara listan, inga knappar, inga löften`); }
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
      const consistent = () => !(b.T.$('.upcoming [data-v2="mission"]') && /inget mer som gör nytta att öva i appen idag/i.test(b.T.$('#app').textContent));
      ok(consistent(), 'efter dygnets extrapass: startkortet säger inte "inget mer" när en rad erbjuder Kör (samma regel)');
      ok(!/Dagens pass/.test(t) && (!FOOT.test(t) || PA.EXP.canFlow(kid)), `efter dygnets pass och extrapass: foten talar inte om "Dagens pass" och bara om ett extrapass som erbjuds (${t.replace(/\s+/g, ' ').slice(-80)})`);
      ok(!!go, `efter dygnets extrapass med fel kvar: Kör på raden erbjuds (${t.replace(/\s+/g, ' ').slice(-90)})`);
      if (go) { ok(/utan poäng/.test(go.textContent) && /utan poäng/.test(go.getAttribute('aria-label') || ''), `efter dygnets extrapass: "utan poäng" syns (${go.textContent.trim()})`);
        const r0 = JSON.stringify({ xp: PA.DB.profiles.k8.xp, gems: PA.DB.profiles.k8.gems }); b.T.click(go); ok(PA.S.v2.po === true, 'Kör på raden efter dygnets extrapass är övning utan poäng'); D.run(() => false);
        ok(JSON.stringify({ xp: PA.DB.profiles.k8.xp, gems: PA.DB.profiles.k8.gems }) === r0, 'inga XP eller diamanter'); }
      else ok(/Inget mer som gör nytta idag|Inget att öva just nu/.test(t), `efter dygnets extrapass: ärlig text när inget gör nytta (${t.replace(/\s+/g, ' ').slice(-90)})`);
      let n = 0; openKid(b.T, 'k8'); while (b.T.$('.upcoming [data-v2="mission"]') && n < 25) { b.T.click(b.T.$('.upcoming [data-v2="mission"]')); D.run(() => false); n++; openKid(b.T, 'k8'); }
      ok(n < 25 && /Inget mer som gör nytta idag|Inget att öva just nu/.test(card(b.T).textContent), `Kör på raden tar slut när inget gör nytta – ingen ändlös upprepning (${n} block)`);
      ok(consistent() && !b.T.$('[data-v2="mission"]'), 'när inget gör nytta: ingen knapp någonstans och samma besked på hela skärmen'); }
    // Granskning P2-B: när dagens pass är klart talar foten om nästa extrapass (bara medan det erbjuds), aldrig om "Dagens pass"
    for (const [id, exp] of [['k8', 'achieve'], ['k4', 'grow'], ['k2', 'explore']]) {
      const c10 = { ...CONTENT, work: [{ id: 'fd-' + id, kid: id, type: 'exam', title: 'Prov', date: isoIn(6), skills: ['multin'] }] };
      const b = await boot(c10); const { v2tools } = require('./le/v2driver.js'); const D = v2tools(b.w, b.T); const PA = b.T.PA(); const kid = PA.KIDS.find(k => k.id === id);
      openKid(b.T, id); ok(footCheck(b.T, id), `${exp}: före dagens pass stämmer foten`); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); D.run(() => false); openKid(b.T, id);
      const t1 = (card(b.T) || {}).textContent || ''; ok(PA.EXP.coreDone(PA.DB.profiles[id]) && !/Dagens pass/.test(t1) && footCheck(b.T, id), `${exp}: dagens pass klart – foten om nästa extrapass eller ingen (${t1.replace(/\s+/g, ' ').slice(-70)})`);
      let f = 0; while (PA.EXP.canFlow(kid) && f++ < 5) { PA.V2.start(kid, 'flow'); D.run(() => false); } openKid(b.T, id);
      const t2 = (card(b.T) || {}).textContent || ''; ok(!PA.EXP.canFlow(kid) && !FOOT.test(t2), `${exp}: inga fler extrapass – ingen fot (${t2.replace(/\s+/g, ' ').slice(-70)})`); }
    // Granskning P2-A (fixturen ur test_ova_mer.js): efter dygnets extrapass säger hela skärmen samma sak – erbjuder en rad Kör, så
    // erbjuder startkortet "Öva mer inför" ett mål (inte "inget mer som gör nytta"), och tvärtom
    { const OM = { v: 1, updatedAt: 1, packs: [], work: [
        { id: 'syn-alg', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(12), skills: ['multin', 'forenkla', 'blandat', 'talfoljd', 'ekvation'] },
        { id: 'syn-kemi', kid: 'k8', type: 'exam', title: 'Kemiprov', date: isoIn(20), kps: ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer', 'k:kemi8-syror-baser/neutralisation'] }] };
      const w2 = mkWin({ seed: 31, fixedClock: true }); await sleep(40); const T2 = tools(w2); T2.PA().FAMILY.apply(FIX); T2.PA().load(); T2.PA().FAMILY.applyContent(OM); T2.PA().rerender();
      const { v2tools } = require('./le/v2driver.js'); const D = v2tools(w2, T2); const $ = T2.$, click = T2.click;
      for (let d = 0; d < 2; d++) { openKid(T2, 'k8'); click($('.go-btn[data-v2="kor"]')); D.run((it) => it.cat !== 'learn' && D.log.items % 4 === 0); w2.__advance(DAY); }
      openKid(T2, 'k8'); let wk = 0; click($('.go-btn[data-v2="kor"]')); D.run((it) => it.cat !== 'learn' && (++wk % 2 === 0));
      let f = 0; click($('[data-go="home"]')); while ($('[data-v2="flow"]') && f++ < 5) { click($('[data-v2="flow"]')); D.run((it) => it.cat !== 'learn' && (++wk % 2 === 0)); click($('[data-go="home"]')); }
      openKid(T2, 'k8'); let n = 0;
      while (n < 8) { const row = !!$('.upcoming [data-v2="mission"]'); const top = $('.mission [data-v2="mission"], .mission [data-v2="ovamer"]'); const none = /inget mer som gör nytta att öva i appen idag/i.test($('#app').textContent);
        ok(row ? !!top && !none : true, `steg ${n}: en rad erbjuder Kör – startkortet erbjuder också övning och säger inte "inget mer" (${top ? top.textContent.trim().slice(0, 40) : 'ingen'})`);
        if (!top) break; click(top); D.run(() => false); n++; openKid(T2, 'k8'); }
      ok(n < 8 && !$('[data-v2="mission"]') && /inget mer som gör nytta/i.test($('#app').textContent), `till slut: inget mer någonstans, samma besked (${n} block)`); }
    // Granskning P1-A: "aldrig sett" i provträningens spärr för nytt = som V2.newToday (n > 0 eller fs; glosdäck räknas inte) –
    // ett glosförhör och v1-migrerade koncept får sin träning även när dygnets gräns är nådd
    { const b = await boot(null); const PA = b.T.PA(); const p = PA.DB.profiles.k8; const kid = PA.KIDS.find(k => k.id === 'k8'); const dk = (p.enabledDecks || [])[0];
      p.exams = [{ id: 'gl', title: 'Glosförhör', date: isoIn(6), skillIds: [], deckIds: [dk], weight: 'minor' }]; PA.save(); PA.LE.invalidate('k8'); const { v2tools } = require('./le/v2driver.js'); const D = v2tools(b.w, b.T);
      for (let d = 0; d < 2; d++) { openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); D.run(() => false); PA.V2.start(kid, 'mission', { examId: 'gl' }); if (PA.S && PA.S.v2) D.run(() => false); b.w.__advance(DAY); }
      const C = PA.LE.state(kid); const orig = PA.V2.newCapToday; PA.V2.newCapToday = () => 0; const pl = PA.V2.plan(kid, 'mission', C, PA.LE.now(), null, { examId: 'gl' }); PA.V2.newCapToday = orig;
      ok(pl.length > 0 && pl.some(x => x.cid === 'd:' + dk), `glosförhör: glosorna övas även när dygnets gräns för nytt är nådd (${pl.map(x => x.role + ':' + x.cid).join(' ')})`);
      openKid(b.T, 'k8'); const sum = (b.T.$('.upcoming details.up-state summary') || {}).textContent || '';
      ok(/\d+ öva lite mer/.test(sum) || /\d+ bra koll/.test(sum), `Läget räknar lägena när det finns underlag (${sum.trim()})`); }
    { const b = await boot({ ...CONTENT, work: [{ id: 'mg', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(12), skills: ['multin', 'forenkla', 'blandat'] }] }); const PA = b.T.PA(); const p = PA.DB.profiles.k8; const kid = PA.KIDS.find(k => k.id === 'k8');
      delete p.le; p.skills = p.skills || {}; for (const sk of ['multin', 'forenkla', 'blandat']) p.skills[sk] = { lvl: 2, att: 12, cor: 10, m: 80, last: b.w.Date.now() - 5 * DAY }; PA.save(); PA.LE.invalidate('k8');
      const C = PA.LE.state(kid); const migr = Object.entries(C.L.c).filter(([c, x]) => x.n > 0 && !x.fs).map(([c]) => c);
      const base = (cap) => { const o = PA.V2.newCapToday; PA.V2.newCapToday = () => cap; const r = PA.V2.plan(kid, 'mission', C, PA.LE.now(), null, { examId: 'w:mg' }); PA.V2.newCapToday = o; return r; };
      const p0 = base(0); ok(migr.length > 0 && p0.length > 0 && p0.every(x => migr.includes(x.cid) || (C.L.c[x.cid] && C.L.c[x.cid].fs)), `v1-migrerade koncept räknas som sedda: provträningen finns även vid nådd gräns (${p0.length} platser, ${migr.length} migrerade)`); }
    // Granskning P1-B: kvällen före ett prov ger motorn inget extrapass – då ingen Kör på raden heller, inga belöningar för upprepning, samma besked
    { const b = await boot({ ...CONTENT, work: [{ id: 'e1', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(4), skills: ['multin', 'forenkla', 'blandat'] }] }); const PA = b.T.PA(); const kid = PA.KIDS.find(k => k.id === 'k8'); const p = PA.DB.profiles.k8;
      const { v2tools } = require('./le/v2driver.js'); const D = v2tools(b.w, b.T);
      for (let d = 0; d < 3; d++) { openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); D.run(() => D.log.items % 3 === 0); b.w.__advance(DAY); }
      openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); D.run(() => false); openKid(b.T, 'k8');
      const none = /inget mer som gör nytta att öva i appen idag/i.test(b.T.$('#app').textContent); const row = b.T.$('.upcoming [data-v2="mission"]');
      ok(!(none && row), `kvällen före: startkortet och raderna säger samma sak (inget mer: ${none}, Kör på raden: ${!!row})`);
      if (!PA.EXP.canFlow(kid)) ok(!row && /Inget mer som gör nytta idag/.test(card(b.T).textContent), 'inget extrapass idag: ingen Kör på raden, ärlig text'); }
    // ... också när målets träning skulle göra nytta (allt fel i dagens pass): inget extrapass idag betyder ingen Kör på raden
    { const b = await boot({ ...CONTENT, work: [{ id: 'e2', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(4), skills: ['multin', 'forenkla', 'blandat'] }] }); const PA = b.T.PA(); const kid = PA.KIDS.find(k => k.id === 'k8');
      const { v2tools } = require('./le/v2driver.js'); const D = v2tools(b.w, b.T);
      for (let d = 0; d < 3; d++) { openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); D.run(() => D.log.items % 3 === 0); b.w.__advance(DAY); }
      openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); D.run(() => true); openKid(b.T, 'k8');
      const mp = PA.V2.plan(kid, 'mission', PA.LE.state(kid), PA.LE.now(), null, { examId: 'w:e2' }); const row = b.T.$('.upcoming [data-v2="mission"]'); const none = /inget mer som gör nytta att öva i appen idag/i.test(b.T.$('#app').textContent);
      ok(!PA.EXP.canFlow(kid) && mp.length && PA.EXP.useful(mp, kid), `förutsättning: inget extrapass idag men målets träning skulle göra nytta (canFlow ${PA.EXP.canFlow(kid)}, plan ${mp.length})`);
      ok(!row && !(none && row), `kvällen före, fel kvar: ingen Kör på raden – samma besked som startkortet (Kör: ${!!row})`); }
    // Efter dagens pass med extrapass kvar: Kör på raden bara när målets träning gör nytta (ingen belönad upprepning). EXP.useful styrs här
    // för att pröva just regeln: före dagens pass påverkar den inte raderna, efter dagens pass tar den bort Kör
    { const b = await boot({ ...CONTENT, work: [{ id: 'u1', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(10), skills: ['multin', 'forenkla', 'blandat'] }, { id: 'u2', kid: 'k8', type: 'exam', title: 'Kemiprov', date: isoIn(14), kps: ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer'] }] });
      const PA = b.T.PA(); const kid = PA.KIDS.find(k => k.id === 'k8'); const { v2tools } = require('./le/v2driver.js'); const D = v2tools(b.w, b.T); const u0 = PA.EXP.useful;
      openKid(b.T, 'k8'); PA.EXP.useful = () => false; PA.rerender(); openKid(b.T, 'k8'); const before = b.T.$('#app').querySelectorAll('.upcoming [data-v2="mission"]').length; PA.EXP.useful = u0;
      b.T.click(b.T.$('.go-btn[data-v2="kor"]')); D.run(() => false); openKid(b.T, 'k8'); const flow = PA.EXP.canFlow(kid);
      PA.EXP.useful = () => false; openKid(b.T, 'k8'); const after = b.T.$('#app').querySelectorAll('.upcoming [data-v2="mission"]').length; const txtA = card(b.T).textContent; PA.EXP.useful = u0;
      ok(before > 0, `före dagens pass: Kör på raderna som "Öva inför provet" (${before})`);
      ok(PA.EXP.coreDone(PA.DB.profiles.k8) && after === 0 && /Inget mer som gör nytta idag/.test(txtA), `efter dagens pass (extrapass kvar: ${flow}): ingen Kör när träningen inte gör nytta (${after})`); }
    // Positiv väg (granskning N11): efter dagens pass, med extrapass kvar och träning som gör nytta (fel i dagens pass), erbjuder raden Kör – utan stubbar
    { const b = await boot({ ...CONTENT, work: [{ id: 'pz', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(10), skills: ['multin', 'forenkla', 'blandat'] }] }); const PA = b.T.PA(); const kid = PA.KIDS.find(k => k.id === 'k8');
      const { v2tools } = require('./le/v2driver.js'); const D = v2tools(b.w, b.T); openKid(b.T, 'k8'); b.T.click(b.T.$('.go-btn[data-v2="kor"]')); D.run(() => true); openKid(b.T, 'k8');
      const mp = PA.V2.plan(kid, 'mission', PA.LE.state(kid), PA.LE.now(), null, { examId: 'w:pz' }); const go = b.T.$('.upcoming [data-v2="mission"]');
      ok(PA.EXP.coreDone(PA.DB.profiles.k8) && PA.EXP.canFlow(kid) && mp.length && PA.EXP.useful(mp, kid), `förutsättning: dagens pass klart, extrapass kvar, målets träning gör nytta (canFlow ${PA.EXP.canFlow(kid)}, plan ${mp.length})`);
      ok(!!go && !/utan poäng/.test(go.textContent), `efter dagens pass med nytta kvar: Kör på raden erbjuds (med poäng, ett av dygnets extrapass) (${go ? go.textContent.trim() : 'ingen'})`); }
    // Granskning P2-C: "Bara prov och läxor" med ett mål längre bort än fyra veckor – startkortet och raden säger samma sak
    { const b = await boot({ ...CONTENT, work: [{ id: 'far', kid: 'k8', type: 'exam', title: 'Prov långt fram', date: isoIn(40), skills: ['multin'] }] }); const p = b.T.PA().DB.profiles.k8;
      p.settings.scope = 'exams'; p.settings.scopeAt = b.w.Date.now(); b.T.PA().save(); openKid(b.T, 'k8'); const t = b.T.$('#app').textContent.replace(/\s+/g, ' ');
      ok(!!b.T.$('.upcoming [data-v2="mission"]') && /fyra veckor före/.test(t) && /Kör på raden/.test(t), `Bara prov och läxor: startkortet förklarar att man kan börja med Kör på raden (${t.slice(0, 160)})`);
      // när raden inte längre erbjuder Kör ("Inget mer som gör nytta idag") hänvisar startkortet inte dit
      const { v2tools } = require('./le/v2driver.js'); const D = v2tools(b.w, b.T); let n = 0; while (b.T.$('.upcoming [data-v2="mission"]') && n++ < 12) { b.T.click(b.T.$('.upcoming [data-v2="mission"]')); D.run(() => false); openKid(b.T, 'k8'); }
      const t2 = b.T.$('#app').textContent.replace(/\s+/g, ' ');
      ok(n < 12 && !b.T.$('.upcoming [data-v2="mission"]') && /fyra veckor före/.test(t2) && !/Kör på raden/.test(t2), `Bara prov och läxor, raden slut: ingen hänvisning till Kör på raden (${n} block; ${t2.slice(0, 140)})`); }
    // Granskning P3-1: grow – inget separat "Läget inför" för ett mål som redan har en rad (även "inte inlagt")
    { const b = await boot({ ...CONTENT, work: [{ id: 'g46', kid: 'k4', type: 'vocab', title: 'Glosor v46', date: isoIn(3) }] }); openKid(b.T, 'k4');
      ok(card(b.T) && !b.T.$('details.goal-detail'), 'grow: målet har en rad i Kommande – inget separat "Läget inför"'); }
    // Granskning P3-2: Testa mig-knappens data-exam tvättas
    { const b = await boot(null); b.T.PA().DB.profiles.k8.exams = [{ id: 'q"x', title: 'Prov', date: isoIn(10), skillIds: ['multin'], deckIds: [] }]; b.T.PA().save(); b.T.PA().LE.invalidate('k8'); openKid(b.T, 'k8');
      const te = card(b.T) && card(b.T).querySelector('[data-v2="testa"]'); ok(te && te.dataset.exam === 'q"x', `data-exam med citattecken tvättas (${te && te.dataset.exam})`); }
    void w;
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'KOMMANDE TEST FAILED' : 'KOMMANDE TEST OK'); process.exit(fails ? 1 : 0);
})();
