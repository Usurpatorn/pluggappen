/* 3.7.2 Glosförhör: målets Kör övar ALLA glosor (ägarens fynd: "Inför glosförhör" gav en enda fråga). Riktiga appen i jsdom, SYNTETISK familj,
   fast klocka. Motorn ser glosboken som ett koncept – i målets egen träning får varje ord som inte sitter (box < 3) eller är förfallet en egen
   plats, ett fel ord kommer tillbaka en gång i samma pass, och raden erbjuder Kör så länge något ord inte sitter.
   1. första rundan: varje ord i glosboken en gång (tills taket), aldrig samma ord två gånger utom ett omförsök
   2. ett fel ord kommer tillbaka en gång senare i passet – och bara en gång
   3. samma kväll: fel ord igen; ett rätt ord väntar till sin box-dag (Leitner); dag för dag tills allt sitter; därefter kort repetition
   4. Testa mig för glosförhöret och dagens Kör! är oförändrade (glosboken är fortfarande ett koncept i motorn) */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, T_FIXED } = require('./le/childflow.js');
const { toStart, v2tools } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const isoIn = (days) => new Date(T_FIXED + days * DAY).toISOString().slice(0, 10);
const CONTENT = { v: 1, updatedAt: 1, packs: [], work: [{ id: 'syn-glos', kid: 'k4', type: 'vocab', title: 'Glosförhör: djur', date: isoIn(5), decks: ['en_djur'] }] };
const GID = 'w:syn-glos';

(async () => {
  try {
    const w = mkWin({ seed: 11, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); for (const k of ['k2', 'k4', 'k8']) PA.DB.profiles[k].exams = [];
    PA.FAMILY.applyContent(CONTENT); PA.rerender(); const D = v2tools(w, T);
    const kid = PA.KIDS.find(k => k.id === 'k4'); const p = () => PA.DB.profiles.k4; const deck = PA.V2.deckOf(p(), 'd:en_djur') || null;
    const openKid = () => { toStart(T); T.click(T.$('[data-kid="k4"]')); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
    ok(!!deck && deck.words.length >= 8, `syntetisk glosbok finns (${deck && deck.words.length} ord)`); if (!deck) throw new Error('ingen glosbok');
    const N = deck.words.length; const learned = () => deck.words.filter(x => (p().words[x.id] || {}).box >= 3).length;
    // Spela ett pass och logga vilka ord som frågades (bara övningar, inte "Nytt ord"-kort)
    const play = (wrongIds = new Set()) => { const asked = []; let n = 0; while (PA.S && PA.S.v2 && T.$('#qcard') && n++ < 120) { const it = PA.S.queue[PA.S.i]; const wrong = it.cat === 'word' && it.kind !== 'intro' && wrongIds.has(it.word.id) && !asked.some(a => a.id === it.word.id && a.wrong); if (it.cat === 'word' && it.kind !== 'intro') asked.push({ id: it.word.id, wrong, retry: !!(it.spec && it.spec.wid) }); D.answer(() => wrong); w.__advance(4000); } return asked; };
    const rowKor = () => T.$(`.upcoming [data-v2="mission"][data-exam="${GID}"]`);

    /* 1–2. Första rundan: alla ord, ett fel ord kommer tillbaka en gång */
    openKid(); ok(!!rowKor(), 'glosförhöret har Kör på raden');
    const plan1 = PA.V2.plan(kid, 'mission', PA.LE.state(kid), PA.LE.now(), 'x', { examId: GID }); const dslots = plan1.filter(s => s.cid === 'd:en_djur').length;
    ok(dslots === Math.min(N, PA.V2.DECK_MAX), `planen har en plats per ord som inte sitter (${dslots} av ${N})`);
    const wrongId = deck.words[2].id; T.click(rowKor()); ok(PA.S && PA.S.v2 && PA.S.v2.mode === 'mission', 'Kör på raden startar glosförhörets träning');
    const r1 = play(new Set([wrongId])); const first = r1.filter(a => !a.retry);
    ok(new Set(first.map(a => a.id)).size === first.length && first.length === Math.min(N, PA.V2.DECK_MAX), `första rundan: varje ord en gång (${first.length} frågor, ${new Set(first.map(a => a.id)).size} olika)`);
    const again = r1.filter(a => a.retry); ok(again.length === 1 && again[0].id === wrongId && r1.findIndex(a => a.retry) > r1.findIndex(a => a.id === wrongId), `det felaktiga ordet kommer tillbaka en gång senare (${again.length})`);
    ok(r1.length <= Math.min(N, PA.V2.DECK_MAX) + 1, `inga fler omförsök än ett per fel ord (${r1.length})`);

    /* 3. Samma kväll: nästa runda tar bara orden som blev fel (förfallna); ett ord som blev rätt väntar till sin box-dag. Dag för dag
       tills allt sitter (box 3) – varje runda börjar med ett nytt eller förfallet ord. */
    openKid(); { const due = new Set(PA.V2.deckDue(p(), deck).map(x => x.id)); ok(due.size === 1 && due.has(wrongId) || due.size === 0, `samma kväll: bara det felaktiga ordet är förfallet (${[...due].length})`);
      const pl2 = PA.V2.plan(kid, 'mission', PA.LE.state(kid), PA.LE.now(), 'q', { examId: GID }).filter(s => s.cid === 'd:en_djur'); ok(pl2.length === (due.size || Math.min(N, 6)), `samma kväll: runda 2 = förfallna ord, annars kort repetition (${pl2.length})`); }
    let rounds = 1; let firstAskedDue = true; let days = 0;
    while (learned() < N && days < 10) { let r0 = 0; while (rowKor() && r0 < 4 && PA.V2.deckDue(p(), deck).length) { const dueBefore = new Set(PA.V2.deckDue(p(), deck).map(x => x.id)); T.click(rowKor()); const r = play(); rounds++; r0++; if (r.length && !dueBefore.has(r[0].id)) firstAskedDue = false; openKid(); }
      w.__advance(DAY); days++; openKid(); }
    console.log('  rundor', rounds, 'dagar', days, 'första', r1.length, 'dslots', dslots);
    ok(learned() === N, `alla ord sitter efter ${days} dagar och ${rounds} rundor (${learned()} av ${N})`);
    ok(firstAskedDue, 'varje runda börjar med ett nytt eller förfallet ord');
    const planAll = PA.V2.plan(kid, 'mission', PA.LE.state(kid), PA.LE.now(), 'y', { examId: GID }); const planDone = planAll.filter(s => s.cid === 'd:en_djur');
    ok(planDone.length === Math.min(N, 6) && planDone.every(s => s.role === 'remember'), `allt sitter: bara en kort repetition (${planDone.length})`);
    const g = PA.EXP.goalOf(kid, null).all.find(x => x.e.id === GID); ok(g && !PA.EXP.useful(planAll, kid), 'allt sitter: glosförhörets träning räknas inte som "gör nytta" efter dagens pass');

    /* 3b. Efter dagens pass: raden erbjuder Kör så länge något ord är nytt eller förfallet – ett ord som blev rätt idag väntar till sin
       box-dag. Så tar det slut samma kväll även när vartannat svar blir fel, och kommer tillbaka nästa dag. */
    { const w2 = mkWin({ seed: 12, fixedClock: true }); await sleep(40); const T2 = tools(w2); const P2 = T2.PA(); P2.FAMILY.apply(FIX); P2.load(); for (const k of ['k2', 'k4', 'k8']) P2.DB.profiles[k].exams = []; P2.FAMILY.applyContent(CONTENT); P2.rerender(); const D2 = v2tools(w2, T2);
      const open2 = () => { toStart(T2); T2.click(T2.$('[data-kid="k4"]')); if (T2.$('[data-pet]')) T2.click(T2.$('[data-pet]')); };
      open2(); T2.click(T2.$('.go-btn[data-v2="kor"]')); D2.run(() => false); open2();
      let rounds = 0; let k = 0; while (T2.$(`.upcoming [data-v2="mission"][data-exam="${GID}"]`) && rounds < 15) { T2.click(T2.$(`.upcoming [data-v2="mission"][data-exam="${GID}"]`)); D2.run((it) => it.cat === 'word' && it.kind !== 'intro' && (++k % 2 === 0)); rounds++; open2(); }
      const k4 = P2.KIDS.find(x => x.id === 'k4'); const d2 = P2.V2.deckOf(P2.DB.profiles.k4, 'd:en_djur');
      ok(rounds > 0 && rounds < 15 && P2.V2.deckDue(P2.DB.profiles.k4, d2).length === 0, `efter dagens pass, vartannat svar fel: raden tar slut samma kväll (${rounds} rundor)`);
      ok(/Inget mer som gör nytta|inget mer som gör nytta/.test(T2.$('#app').textContent), 'då säger appen ärligt att inget mer gör nytta idag');
      w2.__advance(DAY); open2(); ok(!!T2.$(`.upcoming [data-v2="mission"][data-exam="${GID}"]`) || !T2.$('.go-btn[data-v2="kor"]') === false, 'nästa dag: glosorna kan övas igen'); }

    /* 4. Testa mig och dagens Kör! oförändrade */
    const tp = PA.V2.plan(kid, 'exam', PA.LE.state(kid), PA.LE.now(), 'z', { examId: GID }).filter(s => s.cid === 'd:en_djur'); ok(tp.length === Math.min(4, N), `Testa mig: som förut (${tp.length} ord)`);
    w.__advance(DAY); const kp = PA.V2.peekPlan(kid).plan.filter(s => s.cid === 'd:en_djur'); ok(kp.length <= 2, `dagens Kör!: glosboken är fortfarande ett koncept i motorn (${kp.length} platser)`);
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`);
  console.log(fails ? 'GLOSOR MISSION TEST FAILED' : 'GLOSOR MISSION TEST OK');
  process.exit(fails ? 1 : 0);
})();
