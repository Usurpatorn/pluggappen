/* 3.7.2/3.7.4 Glosförhör: målets Kör övar ALLA glosor – varje runda (ägarens fynd: "Inför glosförhör" gav en enda fråga, sedan fyra).
   Riktiga appen i jsdom, SYNTETISK familj, fast klocka. Motorn ser glosboken som ett koncept – i målets egen träning får varje ord en egen
   plats i varje runda, ett fel ord kommer tillbaka en gång i samma pass, och raden erbjuder alltid Kör (obegränsat, ägarens beslut).
   1. första rundan: varje ord i glosboken en gång (tills taket), aldrig samma ord två gånger utom ett omförsök
   2. ett fel ord kommer tillbaka en gång senare i passet – och bara en gång
   3. varje ny runda (samma kväll och senare dagar) tar alla ord igen, förfallna och nya först; efter dagens pass finns Kör kvar
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

    /* 3. Varje ny runda tar alla ord – samma kväll och senare dagar, före och efter dagens pass; förfallna och nya först */
    let rounds = 1; let firstDue = true; let allEvery = true;
    for (let day = 0; day < 4; day++) { for (let r0 = 0; r0 < 2; r0++) { openKid(); const b = rowKor(); ok(!!b, `dag ${day} runda ${r0 + 1}: Kör finns alltid på raden`); if (!b) break;
        const due = new Set(PA.V2.deckDue(p(), deck).map(x => x.id)); T.click(b); const r = play(new Set([deck.words[(day + r0) % N].id])); rounds++; const firstAsked = r.filter(a => !a.retry);
        if (new Set(firstAsked.map(a => a.id)).size !== Math.min(N, PA.V2.DECK_MAX)) allEvery = false; if (due.size && firstAsked.length && !due.has(firstAsked[0].id)) firstDue = false; }
      if (day === 1) { openKid(); const go = T.$('.go-btn[data-v2="kor"]'); if (go) { T.click(go); D.run(() => false); } openKid(); ok(!!rowKor(), 'efter dagens pass: Kör för glosförhöret finns kvar (obegränsat)'); }
      w.__advance(DAY); }
    ok(allEvery, `varje runda tog alla ${Math.min(N, PA.V2.DECK_MAX)} ord (${rounds} rundor)`);
    ok(firstDue, 'varje runda börjar med ett förfallet eller nytt ord när sådana finns');
    const planAll = PA.V2.plan(kid, 'mission', PA.LE.state(kid), PA.LE.now(), 'y', { examId: GID }); ok(planAll.filter(s => s.cid === 'd:en_djur').length === Math.min(N, PA.V2.DECK_MAX) && PA.EXP.useful(planAll, kid), 'planen: alla ord, och den räknas alltid som att göra nytta');

    /* 4. Testa mig och dagens Kör! oförändrade */
    const tp = PA.V2.plan(kid, 'exam', PA.LE.state(kid), PA.LE.now(), 'z', { examId: GID }).filter(s => s.cid === 'd:en_djur'); ok(tp.length === Math.min(4, N), `Testa mig: som förut (${tp.length} ord)`);
    w.__advance(DAY); const kp = PA.V2.peekPlan(kid).plan.filter(s => s.cid === 'd:en_djur'); ok(kp.length <= 2, `dagens Kör!: glosboken är fortfarande ett koncept i motorn (${kp.length} platser)`);
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`);
  console.log(fails ? 'GLOSOR MISSION TEST FAILED' : 'GLOSOR MISSION TEST OK');
  process.exit(fails ? 1 : 0);
})();
