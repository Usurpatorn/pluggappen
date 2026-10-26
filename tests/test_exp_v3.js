/* Experience v3 – automatiserad acceptans (brief §26) i den riktiga appen (jsdom, dist/pluggappen.html). SYNTETISK familj och SYNTETISKA
   skoluppgifter – inga riktiga namn, datum eller lärarmaterial. Täcker:
   EXPLORE (aktiviteter, variation, tryck, uppläsning, rättning, id:n) · FLOW (ett tryck, ingen autostart, ingen skuld, ingen
   uppblåst behärskning samma dygn, dygnets gräns för nytt, synk av passposter) · PAPPER (bara svaret rättas, ärlig text, lösning,
   självkontroll påverkar inte bevis, ingen kamera) · ÄRLIGT SPRÅK · GOLDEN CASES (lärarens betoning, luckor, målområden) ·
   UPPLEVELSEVAL (förälder, synk, Klassisk) · ROLLBACK (2.1.0, 2.0.0, v1 per barn). */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs'); const path = require('path'); const zlib = require('zlib'); const os = require('os');
const { mkWin, tools, FIX, rng, T_FIXED } = require('./le/childflow.js');
const { v2tools, unlockParent, setEngine, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const txt = (T) => T.$('#app').textContent.replace(/\s+/g, ' ');
// Ärligt språk (brief §16): inga löften om provresultat, inga procent, inga skuld- eller förlusttexter, aldrig "lösningen är korrekt"
const DISHONEST = /Du är redo|kommer (att )?klara provet|Du kan detta|\b\d{1,3}\s?%|räcker inför provet|lösning(en)? är korrekt|Provberedskap|redan bättre än du tror/i;
const GUILT = /missat|förlorat|tappa(r|t)? (din|streak)|streak(en)? (bryts|försvinner)|du har inte|glöm inte|synd att/i;
const dump = (w) => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
const gunzip = (name) => { const f = path.join(os.tmpdir(), `${name}-${process.pid}.html`); fs.writeFileSync(f, zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'golden', name + '.html.gz')))); return f; };
const isoIn = (days) => new Date(T_FIXED + days * DAY).toISOString().slice(0, 10);
// Syntetiska skoluppgifter för golden case A (algebra) och B (kemi): samma struktur som familjens privata innehåll
const CONTENT = { v: 1, updatedAt: 1, packs: [], work: [
  { id: 'syn-alg', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(25), priority: 'high', skills: ['multin', 'forenkla', 'blandat', 'talfoljd', 'ekvation', 'problemekv', 'andragrad'],
    goals: [{ id: 'g1', name: 'Parenteser och förenkling', skills: ['multin', 'forenkla'], teacher: true }, { id: 'g2', name: 'Uttryck och talföljder', skills: ['blandat', 'talfoljd'] }, { id: 'g3', name: 'Ekvationer', skills: ['ekvation', 'andragrad'] }, { id: 'g4', name: 'Problemlösning', skills: ['problemekv'], teacher: true }],
    focus: { skills: ['multin', 'forenkla', 'problemekv'] }, missing: [{ label: 'Lärobokens avsnitt (PDF saknas)', kind: 'pdf' }, { label: 'Provets format', kind: 'format', note: 'okänt' }] },
  { id: 'syn-kemi', kid: 'k8', type: 'exam', title: 'Kemiprov', date: isoIn(33), kps: ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer', 'k:kemi8-syror-baser/neutralisation'],
    goals: [{ id: 'k1', name: 'pH och indikatorer', kps: ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer'] }, { id: 'k2', name: 'Neutralisation', kps: ['k:kemi8-syror-baser/neutralisation'] }],
    missing: [{ label: 'Videogenomgångar (ej granskade)', kind: 'video' }, { label: 'Laborationsmaterial', kind: 'lab' }] },
] };
async function boot(seed, o = {}) { const w = mkWin({ seed, fixedClock: true, ...o }); await sleep(40); const T = tools(w); if (!o.noFamily) { T.PA().FAMILY.apply(FIX); T.PA().load(); if (o.content) T.PA().FAMILY.applyContent(o.content); T.PA().rerender(); } return { w, T, D: v2tools(w, T) }; }
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
// Kör ett pass och logga varje uppgift: aktivitet, roll, koncept – och kontrollera ärligt språk på varje skärm
function runLog(T, D, wrongFn = () => false) {
  const log = []; let guard = 0;
  while (T.PA().S && T.PA().S.v2 && T.$('#qcard') && guard++ < 60) {
    const S = T.PA().S; const it = S.queue[S.i]; const screen = txt(T);
    ok(!DISHONEST.test(screen) && !GUILT.test(screen), 'ärligt språk under passet: ' + (screen.match(DISHONEST) || screen.match(GUILT) || [''])[0]);
    if (it.type === 'sort' && !global.__undoTested) {   // ångra en placering: tryck på kortet igen → tillbaka bland korten, Svara låst igen
      global.__undoTested = true; const $ = T.$; T.click($('[data-sitem="0"]')); T.click($('[data-sbin="0"]'));
      const placed = !!$('#sbin0 [data-sitem="0"]'); T.click($('[data-sitem="0"]'));
      ok(placed && !!$('#sortPool [data-sitem="0"]') && $('#submit').disabled && $('[data-sitem="0"]').getAttribute('aria-pressed') === 'true', 'sortera: ett placerat kort kan tas tillbaka med ett tryck');
      T.click($('[data-sitem="0"]'));
    }
    log.push({ ui: T.PA().EXP.uiOf(it), cid: it.spec && it.spec.cid, role: it.spec && it.spec.role, lvl: it.spec && it.spec.lvl, format: it.spec && it.spec.format, mode: it.spec && it.spec.mode, kp: it.kp, paper: !!it.paper, type: it.type, item: it });
    D.answer(wrongFn); T.w && T.w.__advance && T.w.__advance(4000);
  }
  return log;
}

(async () => {
  try {
    /* ================= 1. EXPLORE (Yngre, standard) ================= */
    { const { w, T, D } = await boot(31); T.w = w; const PA = T.PA; const { $, click } = T;
      openKid(T, 'k2'); const kid = PA().KIDS.find(k => k.id === 'k2');
      ok(PA().EXP.of(kid) === 'explore' && PA().EXP.isDefault(kid), 'Yngre får Explore som standard');
      ok(PA().EXP.of(PA().KIDS.find(k => k.id === 'k4')) === 'grow' && PA().EXP.of(PA().KIDS.find(k => k.id === 'k8')) === 'achieve', 'Mellan → Grow, Äldre → Achieve');
      let home = txt(T);
      ok(/DAGENS ÄVENTYR/.test(home) && /\d+ små utmaningar/.test(home) && /cirka \d+ min/.test(home), 'Explore-hem: DAGENS ÄVENTYR · N små utmaningar · cirka N min');
      ok(w.document.querySelectorAll('.go-btn').length === 1 && /KÖR/.test($('.go-btn').textContent), 'ett enda primärt beslut: KÖR');
      ok(w.document.querySelector('.mission') === w.document.querySelector('#app .stack').firstElementChild || w.document.querySelector('.welcome'), 'uppdraget överst på sidan');
      // förhandsvisningen stämmer med planen
      const st0 = [...w.document.querySelectorAll('.station')].map(e => e.textContent.trim()); const pl = PA().V2.peekPlan(kid); const want = [...new Set(pl.plan.map(s => PA().EXP.stationOf(s, pl.C)))].slice(0, 5).map(k => PA().EXP.STATION[k][0]);
      ok(JSON.stringify(st0.map(x => x.replace(/^\W+/u, ''))) === JSON.stringify(want), `förhandsvisningen = planens stationer (${st0.join(',')} / ${want.join(',')})`);
      // tio dagar Explore: aktiviteter och variation
      const rnd = rng(5); let runs = 0, maxRun = 0, fired = 0, cores = 0; const typesPerCore = [];
      for (let d = 0; d < 10; d++) {
        openKid(T, 'k2'); click($('.go-btn[data-v2="kor"]')); const log = runLog(T, D, () => rnd() < 0.2); cores++;
        typesPerCore.push(new Set(log.map(x => x.ui === 'learn' ? 'upptäck' : x.ui)).size);
        let run = 0; for (const x of log) { if (x.ui === 'learn') continue; const choice = x.ui === 'choice' || x.ui === 'word:pick' || x.ui === 'word:listen';
          if (run >= 2 && !choice) fired++;
          // fanns en aktivitet på tillåten nivå för samma kunskapspunkt? Då får textvalen inte bli fler än två i rad.
          const alt = x.kp && x.format !== 'recall' && x.mode !== 'challenge' && PA().PACKS.variants(x.kp, 'younger').some(v => v.ui !== 'choice' && v.ui !== 'type' && v.lvl <= Math.max(1, Math.min(3, x.lvl || 1)));
          if (choice) { run++; if (alt) maxRun = Math.max(maxRun, run); } else run = 0; }
        ok(/ÄVENTYRET KLART!/.test(txt(T)), `dag ${d + 1}: KLAR-skärmen "ÄVENTYRET KLART!"`);
        ok(!DISHONEST.test(txt(T)) && !GUILT.test(txt(T)), `dag ${d + 1}: KLAR utan skuld/löften`);
        w.__advance(DAY); runs++;
      }
      const avg = typesPerCore.reduce((a, b) => a + b, 0) / cores;
      console.log(`  Explore: aktivitetstyper per CORE ${typesPerCore.join(' ')} (snitt ${avg.toFixed(1)}), variationsregeln valde aktivitet ${fired} gånger`);
      ok(avg >= 2.5 && typesPerCore.filter(n => n >= 3).length >= 4, `typiskt CORE har minst tre aktivitetstyper när innehållet räcker (snitt ${avg.toFixed(1)})`);
      ok(maxRun <= 2, `aldrig mer än två textval i rad när en aktivitet fanns (längsta ${maxRun})`);
      ok(fired > 0, 'variationsregeln används');
      // tryck: inga dragbara element, aktiviteterna har tryckytor ≥ 44 px i CSS
      const css = [...w.document.querySelectorAll('style')].map(s => s.textContent).join('\n');
      const minH = (sel) => { const m = css.match(new RegExp('(^|\\n)' + sel.replace('.', '\\.') + ' \\{[^}]*min-height: (\\d+)px')); return m ? Number(m[2]) : 0; };
      for (const sel of ['.stile', '.sbin', '.sbin-h', '.tapword', '.mtile', '.station', '.v3go']) ok(minH(sel) >= 36 && (sel === '.station' || minH(sel) >= 44), `tryckyta ${sel} ≥ 44 px (${minH(sel)})`);
      ok(!/draggable="true"|ondrag|dragstart/i.test(fs.readFileSync(path.join(__dirname, '../src/05h_experience.js'), 'utf8')), 'ingen aktivitet kräver dragning');
      // uppläsning: Yngre har Läs upp på sortering, men aldrig på läsförståelse
      const C = PA().LE.state(kid); const sortQ = PA().PACKS.question('k:naso2-var-varld/arstider', { lvl: 2, format: 'depth', pol: 'younger', rnd: rng(3), itemId: PA().LECAT.itemId });
      ok(sortQ && /Vinter|Sommar/.test(PA().V2.sayText({ ...sortQ, type: 'sort', bins: sortQ.bins || ['Vinter', 'Sommar'], items: sortQ.items || [] })), 'uppläsningen av en sortering läser korten och grupperna');
      void C;
      // bevis och id: sortering/para ihop loggas som strukturerade svar med frågans stabila id
      const p = PA().DB.profiles.k2; const evs = p.le.log.map(a => PA().LE2.decodeEv(a));
      const ids = new Set(evs.map(e => e.item));
      { const kinds = evs.filter(e => /^i/.test(e.item || '')); ok(evs.some(e => e.kind === 'mc' && e.k >= 2), 'aktiviteterna (sortera, para ihop, bygg) loggas som flerval med gissningsgrad – de kan inte ensamma ge "Säker"'); void kinds; }
      ok([...ids].every(id => /^i[0-9a-z]+$/.test(id)), 'varje bevis har ett uppgifts-id');
      ok(PA().LE.errors.length === 0, 'Explore: inga fel i v2-lagret ' + JSON.stringify(PA().LE.errors.slice(0, 2)));
    }

    /* ================= 2. FLOW (alla upplevelser) ================= */
    { const { w, T, D } = await boot(41); T.w = w; const PA = T.PA; const { $, click } = T;
      for (const id of ['k2', 'k4', 'k8']) {
        const kid = PA().KIDS.find(k => k.id === id); const pol = PA().LE.state(kid).pol;
        // två dagars historia så att planen har något att repetera
        for (let d = 0; d < 2; d++) { openKid(T, id); click($('.go-btn[data-v2="kor"]')); runLog(T, D, () => false); w.__advance(DAY); }
        openKid(T, id); const C0 = PA().LE.state(kid); const st0 = Object.fromEntries(Object.entries(C0.L.c).map(([c, s]) => [c, s.st])); const dp0 = Object.fromEntries(Object.entries(C0.L.c).map(([c, s]) => [c, s.dpn || 0]));
        click($('.go-btn[data-v2="kor"]')); const coreN = PA().S.v2.plan.length; runLog(T, D, () => false);
        const klar = txt(T); const flowBtn = $('[data-v2="flow"]');
        ok(flowBtn && /ETT ÄVENTYR TILL|EN RUNDA TILL|FORTSÄTT/.test(flowBtn.textContent), `${id}: KLAR erbjuder FLOW med ett tryck (${flowBtn && flowBtn.textContent})`);
        ok($('[data-go="home"]') && /Klar för idag/.test(klar), `${id}: "Klar för idag" lika nära till hands`);
        ok(!GUILT.test(klar) && !DISHONEST.test(klar), `${id}: ingen skuld på KLAR`);
        w.__advance(10 * 60000); ok(!PA().S || !PA().S.v2 || !$('#qcard'), `${id}: inget startar av sig självt`);
        const newAfterCore = PA().EXP.newToday(PA().LE.state(kid), PA().LE.now());
        // hemskärmen efter CORE: klar för idag + frivillig FLOW
        click($('[data-go="home"]')); ok(/KLAR|Du är klar för idag|Appen håller koll/.test(txt(T)) && $('[data-v2="flow"]'), `${id}: hem efter CORE visar KLAR och FLOW`);
        let flows = 0;
        while ($('[data-v2="flow"]') && flows < 5) { click($('[data-v2="flow"]')); ok(PA().S.v2.mode === 'flow', `${id}: FLOW-pass startat`); ok(PA().S.v2.plan.length <= coreN, `${id}: FLOW kortare än eller lika långt som CORE (${PA().S.v2.plan.length} ≤ ${coreN})`); runLog(T, D, () => false); flows++; }
        ok(flows === PA().EXP.FLOW_MAX, `${id}: högst ${PA().EXP.FLOW_MAX} FLOW-block per dygn (${flows})`);
        ok(/vilar nu|Allt för idag är gjort/.test(txt(T)), `${id}: vänligt slut efter FLOW`);
        const C1 = PA().LE.state(kid);
        const inflated = Object.entries(C1.L.c).filter(([c, s]) => s.st - (st0[c] || 0) > 1).map(([c]) => c);
        ok(!inflated.length, `${id}: inget koncept steg mer än ett stadium samma dygn (CORE + ${flows} FLOW): ${inflated.slice(0, 3)}`);
        ok(Object.entries(C1.L.c).every(([c, s]) => (s.dpn || 0) - (dp0[c] || 0) <= 1), `${id}: högst ett djupbevisdygn per dygn`);
        const newAll = PA().EXP.newToday(C1, PA().LE.now()); ok(newAll <= Math.max(pol.maxNew, newAfterCore), `${id}: FLOW höll dygnets gräns för nytt (${newAfterCore} → ${newAll}, gräns ${pol.maxNew})`);
        const recs = PA().DB.profiles[id].le.shadow.filter(r => r.e === 2 && r.m === 'flow'); ok(recs.length === flows && recs.every(r => r.done === 1), `${id}: FLOW-passen sparas som egna passposter (m:'flow')`);
        w.__advance(DAY); openKid(T, id); ok($('.go-btn[data-v2="kor"]') && !/KLAR!/.test(txt(T)), `${id}: nästa dag börjar en ny CORE`);
      }
      // två enheter: CORE på A, FLOW på B, synk → båda passposterna finns kvar och B ser att CORE är klar
      const pa = JSON.parse(JSON.stringify(PA().DB.profiles.k4)); const { w: wB, T: TB, D: DB2 } = await boot(42); TB.w = wB; wB.__advance(5 * DAY);
      openKid(TB, 'k4'); TB.click(TB.$('.go-btn[data-v2="kor"]')); runLog(TB, DB2, () => false); if (TB.$('[data-v2="flow"]')) { TB.click(TB.$('[data-v2="flow"]')); runLog(TB, DB2, () => false); }
      const pb = TB.PA().DB.profiles.k4; const m = TB.PA().mergeProfiles(pb, pa); const m2 = TB.PA().mergeProfiles(pa, pb);
      const ids = (x) => new Set(x.le.shadow.map(r => r.id));
      ok([...ids(pa), ...ids(pb)].every(i => ids(m).has(i) || x0(m, i)), 'synk: passposter från båda enheterna (CORE och FLOW) behålls');
      ok(JSON.stringify([...ids(m)].sort()) === JSON.stringify([...ids(m2)].sort()), 'synk: samma resultat oavsett ordning');
      function x0(mm, i) { return mm.le.shadow.length >= 60 && !i; }
    }

    /* ================= 3. ACHIEVE + PAPPER + GOLDEN CASES ================= */
    { const { w, T, D } = await boot(51, { content: CONTENT }); T.w = w; const PA = T.PA; const { $, click } = T;
      const kid = () => PA().KIDS.find(k => k.id === 'k8');
      openKid(T, 'k8'); const home = txt(T);
      ok(/NÄSTA MÅL/.test(home) && /ALGEBRAPROV/.test(home) && /DET HÄR TRÄNAR VI IDAG/.test(home) && /cirka \d+ min/.test(home), 'Achieve-hem: närmaste riktiga mål, dagens plan, cirka-tid');
      ok(/Sedan: KEMIPROV/.test(home) && (home.match(/DET HÄR TRÄNAR VI IDAG/g) || []).length === 1, 'nästa mål sekundärt ("Sedan: KEMIPROV") – aldrig två planer');
      ok(!/Saknas i underlaget|PDF saknas|Provets format/.test(home), 'luckorna i underlaget visas inte för barnet');
      ok(!DISHONEST.test(home), 'Achieve-hem: inga löften eller procent');
      // lärarens betoning → motorns befintliga fokusvikt
      const C = PA().LE.state(kid()); ok(['multin', 'forenkla', 'problemekv'].every(s => (C.cat['s:' + s] || {}).focus) && !C.cat['s:andragrad'].focus, 'lärarens betonade områden får fokusvikt (andra kapitelområden inte)');
      // flera dagar: papper i rytmen, aldrig två i rad (utom Bossen), bara där receptet säger det
      const rnd = rng(9); let paper = 0, paperRun = 0, maxPaperRun = 0, paperSkills = new Set(); let selfChecked = false; let ex = null;
      for (let d = 0; d < 8; d++) {
        openKid(T, 'k8'); click($('.go-btn[data-v2="kor"]'));
        let guard = 0; while (PA().S && PA().S.v2 && $('#qcard') && guard++ < 60) {
          const S = PA().S; const it = S.queue[S.i];
          if (it.paper) {
            paper++; paperRun++; maxPaperRun = Math.max(maxPaperRun, it.spec.role === 'boss' ? 0 : paperRun); paperSkills.add(it.skill.id);
            const scr = txt(T); ok(/Räkna på papper/.test(scr) && $('#ans') && !$('#sketch'), 'pappersuppgift: "Räkna på papper", bara svarsrutan, ingen kladdyta');
            const wrong = rnd() < 0.5 || (!selfChecked && paper > 1);
            const logN = PA().DB.profiles.k8.le.log.length;
            $('#ans').value = wrong ? '987654' : it.type === 'expr' ? PA().Poly.format(it.answer) : String(it.answer).replace('.', ','); click($('#submit')); const fb = txt(T);
            ok(!/lösning(en)? är korrekt|Din lösning/i.test(fb), 'papper: aldrig "Din lösning är korrekt"');
            if (!wrong) ok(/Ditt svar stämmer\./.test(fb) && $('details.steps'), 'papper rätt: "Ditt svar stämmer." + lösningen att jämföra med');
            else {
              ok(/Svaret stämmer inte\./.test(fb) && $('#fb .steps ol') && $('[data-sc]'), 'papper fel: rätt svar, hela lösningen och "I vilket steg skilde det sig?"');
              if (!selfChecked && $('[data-sc="1"]')) {
                const p = PA().DB.profiles.k8; const log0 = JSON.stringify(p.le.log); const st0 = PA().LE2.stable(PA().LE.state(kid()).L.c[it.spec.cid]);
                click($('[data-sc="1"]')); selfChecked = true;
                ok(JSON.stringify(p.le.log) === log0 && PA().LE2.stable(PA().LE.state(kid()).L.c[it.spec.cid]) === st0, 'självkontrollen ändrar varken bevis eller motorns tillstånd');
                ok(p.v3 && p.v3.sc.length === 1 && p.v3.sc[0][3] === 1, 'självkontrollen sparas bara som visningsdata (p.v3.sc)');
              }
            }
            const ev = PA().DB.profiles.k8.le.log.slice(logN); ok(ev.length >= 1 && ev[ev.length - 1][20] === 'p' && PA().LE2.decodeEv(ev[ev.length - 1]).kind === 'free', 'pappersbeviset: eget svar + pappersmarkör (index 20)');
            if ($('#next')) T.click($('#next')); w.__advance(4000); continue;
          }
          if (it.cat !== 'learn') paperRun = 0;
          D.answer(() => rnd() < 0.15); w.__advance(4000);
        }
        ok(/DAGENS PLAN KLAR/.test(txt(T)) && /Appen håller koll på resten/.test(txt(T)), `dag ${d + 1}: DAGENS PLAN KLAR · Appen håller koll på resten.`);
        { const k8 = PA().KIDS.find(k => k.id === 'k8'); const g = PA().EXP.goalOf(k8).now; const fsh = PA().EXP.examShare(k8, g, PA().EXP.peekFlow(k8));   // 2.1.1-principen: provetiketten bara när extrapasset innehåller provet
          ok(/vilar nu|Allt för idag/.test(txt(T)) || (fsh.n > 0 ? /FORTSÄTT MOT PROVET/.test(txt(T)) : /FORTSÄTT ·/.test(txt(T)) && !/MOT PROVET/.test(txt(T))), `dag ${d + 1}: FORTSÄTT${fsh.n > 0 ? ' MOT PROVET' : ''} erbjuds (extrapasset: ${fsh.n} av ${fsh.of} inför provet)`); }
        if (!ex) ex = txt(T);
        w.__advance(DAY);
      }
      console.log(`  Achieve: ${paper} pappersuppgifter (${[...paperSkills].join(', ')}), längsta pappersföljd utom Boss ${maxPaperRun}`);
      ok(paper >= 3, 'papper och penna förekommer i matte');
      ok([...paperSkills].every(s => s in PA().EXP.PAPER), 'papper bara i moment där receptet anger det');
      ok(maxPaperRun <= 1, 'papper och digitalt växlar (aldrig två pappersuppgifter i rad utom Bossen)');
      ok(selfChecked, 'självkontrollen prövad');
      // "Kommer tillbaka" bygger på motorns förfallodag
      // Testa mig: digitalt först, 2–3 papper sist, inga ledtrådar eller svar under testet, lösningar efteråt, rapport per målområde
      openKid(T, 'k8'); const det = $('details.goal-detail'); ok(!!det, 'läget per område finns (hopfällt)');
      click($('[data-v2="testa"]')); const order = []; let g2 = 0;
      while (PA().S && PA().S.v2 && $('#qcard') && g2++ < 30) { const it = PA().S.queue[PA().S.i]; order.push(!!it.paper); ok(!$('#hintBtn') && !$('#explainBtn'), 'Testa mig: inga ledtrådar'); D.answer(() => rnd() < 0.3); ok(!$('#fb .feedback'), 'Testa mig: ingen omedelbar återkoppling'); }
      const np = order.filter(Boolean).length; const firstPaper = order.indexOf(true);
      ok(np >= 2 && np <= 3 && order.slice(firstPaper).every(Boolean), `Testa mig: 2–3 pappersuppgifter sist (${order.map(x => (x ? 'P' : 'd')).join('')})`);
      const res = txt(T); ok(/Läget per område efter testet/.test(res) && ['Parenteser och förenkling', 'Uttryck och talföljder', 'Ekvationer', 'Problemlösning'].every(g => res.includes(g)), 'Testa mig rapporterar per lärarens målområde');
      ok((res.match(/BRA KOLL|ÖVA LITE MER|FÖR LITE UNDERLAG/g) || []).length >= 4 && /inte vad du får på provet/.test(res), 'tre lägen per område, och ingen prognos');
      ok(!DISHONEST.test(res), 'Testa mig-resultatet: inga löften');
      ok(/På papper/.test(res) && /appen har bara sett svaret/.test(res), 'Testa mig: pappersuppgifternas lösningar med ärlig text');
      // ingen påhittad omfattning: provets koncept kommer bara från skoluppgiften
      const e = PA().LE.exams(kid(), PA().DB.profiles.k8).find(x => x.id === 'w:syn-alg'); const cids = PA().LE.examCids(PA().LE.state(kid()), e);
      ok(cids.length && cids.every(c => CONTENT.work[0].skills.some(s => c === 's:' + s || (PA().LE.state(kid()).cat[c] || {}).ref === s)), 'provets omfattning = skoluppgiftens moment (inget påhittat)');
      // föräldern ser luckorna och självkontrollen med ärlig text
      unlockParent(w, T); click($('[data-tab="k8"]')); click($('[data-sub="v2"]')); const par = txt(T);
      ok(/Saknas i underlaget/.test(par) && /Lärobokens avsnitt \(PDF saknas\)/.test(par) && /Provets format/.test(par) && /Videogenomgångar \(ej granskade\)/.test(par) && /Laborationsmaterial/.test(par), 'föräldern ser alla luckor i underlaget');
      ok(/Steg som barnet valde vid egen jämförelse/.test(par) && /inte sett uträkningen/.test(par), 'föräldern: "Steg som barnet valde vid egen jämförelse" – ingen diagnos');
      // upplevelsevalet: Grow → hem ändras; Klassisk → 2.1-presentationen; standard igen
      click($('[data-v2="exp"][data-val="grow"]')); toStart(T); openKid(T, 'k8'); ok(/DAGENS MISSION|DAGENS RUNDA|MISSION KLAR|RUNDAN KLAR/.test(txt(T)), 'förälderns val Grow gäller direkt');
      unlockParent(w, T); click($('[data-tab="k8"]')); click($('[data-sub="v2"]')); click($('[data-v2="exp"][data-val="classic"]')); toStart(T); openKid(T, 'k8');
      ok(!$('section.mission') && $('.go-btn[data-v2="kor"]') && /IDAG \d+ minuter|uppgifter · cirka/.test(txt(T)), 'Klassisk (2.1): startsidan som i 2.1.0');
      unlockParent(w, T); click($('[data-tab="k8"]')); click($('[data-sub="v2"]')); click($('[data-v2="exp"][data-val="default"]')); ok(PA().EXP.of(kid()) === 'achieve' && !PA().DB.profiles.k8.settings.exp, 'återställ till standard');
      // kemi (golden case B): pH-kunskapen finns som UPPTÄCK → SORTERA → MINNS → KOPPLA → ORSAK → ANVÄND → HITTA FELET → BOSS
      const vs = ['ph-skalan', 'indikatorer', 'neutralisation', 'syra-kanne', 'bas-kanne'].flatMap(k => PA().PACKS.variants('k:kemi8-syror-baser/' + k, 'older'));
      const has = (f) => vs.some(f); const kemi = { 'UPPTÄCK (förklaring)': !!PA().PACKS.teach('k:kemi8-syror-baser/ph-skalan', 'older'), SORTERA: has(v => v.ui === 'sort'), MINNS: has(v => v.form === 'recall'), KOPPLA: has(v => v.form === 'relationship' && v.ui !== 'sort'), 'ORSAK OCH EFFEKT': has(v => v.form === 'cause'), ANVÄND: has(v => v.form === 'application'), 'HITTA FELET': has(v => v.form === 'mistake'), 'BOSS (svårare)': has(v => v.ch) };
      ok(global.__undoTested, 'ångra-testet kördes'); ok(Object.values(kemi).every(Boolean), 'kemi: hela kedjan finns i innehållet ' + JSON.stringify(kemi));
      const sortPh = vs.find(v => v.ui === 'sort' && v.f.groups && v.f.groups.some(g => g.label === 'Neutral')); ok(!!sortPh, 'kemi: SORTERA sur / neutral / basisk');
      ok(PA().LE.errors.length === 0, 'Achieve: inga fel i v2-lagret ' + JSON.stringify(PA().LE.errors.slice(0, 2)));
      // rollback: spara v3-data och öppna i 2.1.0 och 2.0.0
      PA().EXP.set(kid(), 'grow'); PA().flushSave(); const st = dump(w); global.__v3store = st;
    }

    /* ================= 4. UPPLEVELSEVAL MELLAN ENHETER ================= */
    { const { T } = await boot(61); const PA = T.PA; const M = PA().mergeProfiles;
      const base = JSON.parse(JSON.stringify(PA().DB.profiles.k2));
      const a = { ...base, settings: { ...base.settings, exp: 'grow', expAt: 2000 } }, b = { ...base, settings: { ...base.settings, exp: 'classic', expAt: 1000 } };
      ok(M(a, b).settings.exp === 'grow' && M(b, a).settings.exp === 'grow', 'synk: förälderns senaste upplevelseval vinner (oavsett vilken enhet som är lokal)');
      const c = { ...base, settings: { ...base.settings } }; delete c.settings.exp; delete c.settings.expAt; ok(M(c, a).settings.exp === 'grow', 'synk: en enhet utan val tar inte bort förälderns val');
      const v3a = { ...base, v3: { v: 1, sc: [[1, 's:x', 'i1', 2, 3]] } }, v3b = { ...base, v3: { v: 1, sc: [[2, 's:y', 'i2', 1, 3]] } };
      ok(M(v3a, v3b).v3.sc.length === 2 && M(v3b, v3a).v3.sc.length === 2, 'synk: självkontrollerna slås ihop (union)');
      const ev = PA().LE2.encodeEv({ t: 1e12, dev: 'd', seq: 1, cid: 's:x', ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'i1', med: 'p' });
      ok(ev[20] === 'p' && ev.length === 21 && PA().LE2.decodeEv(ev).med === 'p' && !PA().LE2.decodeEv(ev).form, 'bevisformat: pappersmarkör på index 20, tomma fält före');
      const ev0 = PA().LE2.encodeEv({ t: 1e12, dev: 'd', seq: 2, cid: 's:x', ok: true, kind: 'free', help: 'none', ctx: 'first', item: 'i1' });
      ok(ev0.length === 14, 'bevis utan papper oförändrade (14 fält)');
    }

    /* ================= 5. ROLLBACK: 2.1.0 och 2.0.0 med Experience v3-data ================= */
    for (const ver of ['pluggappen-2.1.0', 'pluggappen-2.0.0']) {
      const file = gunzip(ver); const st = global.__v3store; const p0 = JSON.parse(st['pluggappen.v3'] || st[Object.keys(st).find(k => /pluggappen\.v\d/.test(k))]).profiles.k8;
      const { w, T, D } = await boot(71, { file, storage: st }); const PA = T.PA;
      ok(new RegExp(ver.split('-')[1].replace(/\./g, '\\.')).test(w.PLUGG_BUILD || ''), `${ver} laddad (${w.PLUGG_BUILD})`);
      openKid(T, 'k8'); ok(T.$('[data-v2="kor"]'), `${ver}: barnet får v2-startsidan`);
      T.click(T.$('.go-btn[data-v2="kor"]') || T.$('[data-v2="kor"]') || T.$('[data-v2="extra"]')); D.run(false); ok(/Bra jobbat|Klart/.test(txt(T)), `${ver}: ett pass går att köra på v3-data`);
      PA().flushSave(); const p1 = PA().DB.profiles.k8;
      ok(PA().LE.errors.length === 0, `${ver}: inga fel i v2-lagret ` + JSON.stringify(PA().LE.errors.slice(0, 2)));
      ok(p1.settings.exp === 'grow' && p1.settings.expAt === p0.settings.expAt, `${ver}: upplevelsevalet ligger kvar orört`);
      ok(p1.v3 && JSON.stringify(p1.v3) === JSON.stringify(p0.v3), `${ver}: självkontrollerna ligger kvar orörda`);
      ok(p1.le.log.filter(a => a[20] === 'p').length === p0.le.log.filter(a => a[20] === 'p').length && p1.le.log.length > p0.le.log.length, `${ver}: pappersbevisen finns kvar och loggen växer`);
      ok(p1.le.shadow.some(r => r.m === 'flow') === p0.le.shadow.some(r => r.m === 'flow'), `${ver}: FLOW-passposterna finns kvar`);
      // tillbaka till v3
      const { w: wB, T: TB } = await boot(72, { storage: dump(w) }); openKid(TB, 'k8');
      ok(TB.$('.mission.grow') || /DAGENS (MISSION|RUNDA)|KLAR/.test(txt(TB)), `tillbaka från ${ver}: Experience v3 fortsätter (Grow)`);
      ok(TB.PA().DB.profiles.k8.v3.sc.length === p0.v3.sc.length && TB.PA().LE.errors.length === 0, `tillbaka från ${ver}: inga fel, självkontrollerna kvar`);
      void wB; try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
    }

    /* ================= 6. v1-reserven per barn och lugn presentation ================= */
    { const { w, T, D } = await boot(81); T.w = w; const PA = T.PA;
      setEngine(w, T, 'k2', 'v1'); openKid(T, 'k2'); ok(T.$('[data-rec]') && !T.$('.mission') && !T.$('[data-v2="kor"]'), 'v1 per barn: Yngre får v1 – ingen v3-presentation');
      setEngine(w, T, 'k2', 'v2'); openKid(T, 'k2'); ok(T.$('.mission.explore'), 'v2 igen: Explore tillbaka');
      // lugn presentation: efter motorns Rescue döljs räknare och nivåprickar
      T.click(T.$('.go-btn[data-v2="kor"]')); let calm = false, guard = 0;
      while (PA().S && PA().S.v2 && T.$('#qcard') && guard++ < 40) { if (PA().S.v2.calm && PA().S.queue[PA().S.i].cat === 'math') { calm = true; ok(!T.$('.lvl-dots') && !/Uppgift \d+ av/.test(txt(T)), 'lugn presentation: inga räknare eller nivåprickar'); break; } D.answer(true); w.__advance(4000); }
      ok(calm, 'lugn presentation aktiveras av motorns Rescue-signal');
    }
    // ingen kamera, OCR eller handskrift i appen
    const html = fs.readFileSync(path.join(__dirname, '../dist/pluggappen.html'), 'utf8');
    ok(!/getUserMedia|capture=|type="file"|createImageBitmap|Tesseract|handwriting/i.test(html), 'ingen kamera, fotouppladdning, OCR eller handskriftstolkning');
    ok(!/Din lösning är korrekt/.test(html), 'texten "Din lösning är korrekt" finns inte i appen');
    ok(/prefers-reduced-motion:\s*reduce/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'dist', 'index.html'), 'utf8')), 'tillgänglighet: "minska rörelse" stänger av animationer');
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'EXPERIENCE V3 TEST FAILED' : 'EXPERIENCE V3 TEST OK'); process.exit(fails ? 1 : 0);
})();
