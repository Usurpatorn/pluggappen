/* 3.3 World-Class Experience – regressionstester för presentationslagret (riktiga appen i jsdom, fast klocka, syntetisk familj).
   3.3 ändrar bara utseende: CSS-krokar (html[data-exp], #qcard[data-mode|data-role|data-exam]), två rutor på liggande iPad (samma
   element flyttas, inga nya), Hitta felet som lösningskort, Baklänges med målpanel, ett lugnare Testa mig-resultat och tydligare
   KLAR-knappar. Testerna visar att krokarna stämmer med uppgiften, att flytten inte tappar eller dubblerar något, att rättningen är
   densamma och att löftena (cirka N min, N av M uppgifter inför provet) står kvar ordagrant i texten. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js');
const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const SPLIT = ['num', 'expr', 'choice', 'paper', 'reverse', 'text', 'tap'];
const SIDE = ['inputArea', 'fb', 'actions', 'explainBtn', 'sketch'];
const DISHONEST = /Du är redo|kommer (att )?klara provet|Du kan detta|\b\d{1,3}\s?%|räcker inför provet|lösning(en)? är korrekt|Provberedskap/i;

(async () => {
  try {
    const w = mkWin({ seed: 21, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA; PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T); const r = rng(5);
    const doc = w.document; const kidOf = (id) => PA().KIDS.find(k => k.id === id);

    /* 1. html[data-exp] följer barnets upplevelse (Klassisk = classic), och ingen annan logik bryr sig om attributet */
    for (const k of PA().KIDS) { openKid(T, k.id); const want = PA().EXP.on(k) ? PA().EXP.of(k) : 'classic';
      ok(doc.documentElement.getAttribute('data-exp') === want, `${k.id}: html[data-exp]=${doc.documentElement.getAttribute('data-exp')} (väntat ${want})`); }

    /* 2. Varje uppgift: data-mode = EXP.modeOf, två rutor utan förlust/dubbletter, Svara/Nästa finns kvar i kortet */
    const modes = {}; let splitSeen = 0, items = 0;
    const checkCard = (id) => { const S = PA().S; const it = S.queue[S.i]; const qc = T.$('#qcard'); if (!qc || !S.v2 || !S.v2.exp) return; items++;
      const m = PA().EXP.modeOf(it); modes[m.mode] = (modes[m.mode] || 0) + 1;
      ok(qc.dataset.mode === m.mode, `${id}: #qcard[data-mode]=${qc.dataset.mode} (väntat ${m.mode})`);
      ok((qc.dataset.role || '') === (m.role || ''), `${id}: #qcard[data-role]=${qc.dataset.role} (väntat ${m.role || ''})`);
      ok(!!qc.dataset.exam === !!S.v2.exam, `${id}: data-exam bara i Testa mig`);
      const ids = [...doc.querySelectorAll('[id]')].map(e => e.id); ok(ids.length === new Set(ids).size, `${id}: inga dubblerade id:n (${ids.filter((x, i) => ids.indexOf(x) !== i).join(',')})`);
      if (qc.classList.contains('split')) { splitSeen++; ok(SPLIT.includes(m.mode), `${id}: två rutor bara för ${SPLIT.join('/')} (${m.mode})`);
        const panes = [...qc.children]; ok(panes.length === 2 && panes.every(p => p.classList.contains('q-pane')), `${id}: kortet har exakt två rutor`);
        const side = qc.querySelector('.q-side'), main = qc.querySelector('.q-main');
        ok(side && main && main.children.length > 0 && side.children.length > 0, `${id}: båda rutorna har innehåll`);
        ok([...side.children].every(c => SIDE.includes(c.id)), `${id}: svarsrutan har bara svar/feedback/knappar`);
        ok([...main.children].every(c => !SIDE.includes(c.id)), `${id}: uppgiftsrutan har inga svarselement`);
        ok(!!qc.querySelector('#fb') && !!qc.querySelector('#actions'), `${id}: #fb och #actions finns kvar i kortet`); }
      else ok(![...qc.children].some(c => c.classList.contains('q-pane')), `${id}: inga tomma rutor för ${m.mode}`); };
    for (const id of ['k2', 'k4', 'k8']) {
      for (let d = 0; d < 5; d++) { openKid(T, id); const go = T.$('.go-btn[data-v2="kor"]'); if (!go) { w.__advance(DAY); continue; } T.click(go);
        let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 60) { checkCard(id); const S = PA().S; const it = S.queue[S.i]; const i0 = S.i; D.answer(() => r() < 0.25);
          // efter svaret: samma kort, rättningen gjord, feedback i kortet
          if (PA().S && PA().S.i === i0 && T.$('#qcard') && it.cat !== 'learn') { ok(!!T.$('#qcard #fb'), `${id}: feedback hamnar i kortet`);
            if (id === 'k8') ok(!/\bi rad\b/.test(norm(T.$('#fb').textContent)), 'Achieve: inget "N i rad" i berömmet'); }
          w.__advance(3000); D.next && D.next(); }
        /* KLAR: tiden står kvar i knappens text (skärmläsare + löftestestet), på egen rad visuellt */
        const flow = T.$('[data-v2="flow"]'); if (flow) { ok(/ · cirka \d+ min$/.test(norm(flow.textContent).replace(/\s·\s/, ' · ')), `${id}: FLOW-knappen säger "· cirka N min" (${norm(flow.textContent)})`);
          ok(!!flow.querySelector('.btn-sub'), `${id}: tiden på egen rad`); }
        const klar = T.$('.klar'); if (klar) ok(!DISHONEST.test(norm(klar.textContent)), `${id}: KLAR utan löften/procent`);
        w.__advance(DAY); } }
    console.log(`  ${items} uppgifter, formspråk: ${Object.entries(modes).map(([k, v]) => k + ' ' + v).join(', ')}; två rutor i ${splitSeen}`);
    ok(items > 40 && splitSeen > 5 && Object.keys(modes).length >= 5, 'många uppgifter och flera formspråk prövade');

    /* 3. Hitta felet: lösningskort med bokstav, samma val och samma rättning */
    const inject = (kind) => { openKid(T, 'k8'); if (!T.$('.go-btn[data-v2="kor"]')) { w.__advance(DAY); openKid(T, 'k8'); } T.click(T.$('.go-btn[data-v2="kor"]')); const S = PA().S; const it = S.queue[S.i]; const kid = kidOf('k8'); const sk = kid.skills.find(s => s.id === 'forenkla') || kid.skills[0];
      const q = PA().EXP.rhythmItem(kind, sk, 2); if (!q) return null; S.queue[S.i] = { ...q, skill: sk, cat: 'math', level: q.level || 2, rhythm: kind, fcode: kind === 'spot' ? 'm' : 'v', spec: { ...(it.spec || {}), role: 'focus', rhythm: kind }, _slotEnd: true };   /* som planeraren (05g_v2app.js) */ PA().rerender(); return S.queue[S.i]; };
    for (let t = 0; t < 4; t++) { const q = inject('spot'); if (!q) { ok(false, 'Hitta felet kunde skapas'); break; }
      const qc = T.$('#qcard'); ok(qc.dataset.mode === 'spot' && !qc.classList.contains('split'), 'Hitta felet: eget formspråk, ingen tvåruta');
      const sols = [...doc.querySelectorAll('#choices .spot-sol')]; ok(sols.length === q.choices.length && sols.length >= 2, `Hitta felet: ett kort per lösning (${sols.length})`);
      ok(sols.every((b, i) => b.dataset.choice === String(i) && b.getAttribute('aria-label') === q.choices[i]), 'Hitta felet: varje kort har val-index och skärmläsartext');
      ok(sols.every(b => b.querySelector('.sol-l') && b.querySelector('.sol-b') && norm(b.querySelector('.sol-b').textContent).length > 3), 'Hitta felet: bokstav + lösningens rader');
      ok(!/<div style="margin:6px 0">/.test(T.$('.qtext') ? T.$('.qtext').innerHTML : ''), 'Hitta felet: lösningarna står i korten, inte i frågetexten');
      const right = q.bad; const pick = t % 2 ? (right + 1) % sols.length : right; const n0 = PA().S.results.length; T.click(sols[pick]);
      const fb = norm(T.$('#fb').textContent); ok(t % 2 ? T.$('#fb .feedback.no') || /inte|fel/i.test(fb) : T.$('#fb .feedback.ok'), `Hitta felet: ${t % 2 ? 'fel' : 'rätt'} val rättas som förut (${fb.slice(0, 60)})`);
      ok(PA().S.results.length === n0 + 1 && PA().S.results[n0] === !(t % 2), 'Hitta felet: ett resultat, rätt värde'); }

    /* 4. Baklänges: målet syns, samma rättning */
    for (let t = 0; t < 3; t++) { const q = inject('reverse'); if (!q) { ok(false, 'Baklänges kunde skapas'); break; }
      const tgt = T.$('.rev-target'); ok(!!tgt, 'Baklänges: målpanelen finns');
      const want = q.create === 'equation' ? 'x = ' + q.solution : PA().Poly.format(q.answer); ok(tgt && norm(tgt.textContent).includes(norm(want)), `Baklänges: målet "${want}" står i panelen`);
      ok(T.$('#qcard').dataset.mode === 'reverse', 'Baklänges: eget formspråk');
      const n0 = PA().S.results.length; D.answer(() => t === 1); ok(PA().S.results[n0] === (t !== 1), `Baklänges: ${t === 1 ? 'fel' : 'rätt'} uppgift rättas som förut`); }

    /* syntetiskt prov om 8 dygn på moment Äldre redan övat (som test_ux_v3.js) – ger provrubrik, andel och Testa mig */
    { const p = PA().DB.profiles.k8; const C = PA().LE.state(kidOf('k8')); const seenSk = Object.keys(C.L.c).filter(c => c.startsWith('s:') && C.L.c[c].n).map(c => c.slice(2));
      p.exams = [{ id: 'e33', title: 'Matteprov', date: new Date(PA().LE.now() + 8 * DAY).toISOString().slice(0, 10), skillIds: seenSk.slice(0, 3), deckIds: [] }]; PA().save(); PA().LE.invalidate('k8');
      ok(seenSk.length >= 1, 'Äldre har övat matte i testet'); }
    /* 5. Achieve-hemmet: tid och andel ordagrant, inga procent */
    { toStart(T); openKid(T, 'k8'); const kid = kidOf('k8'); const home = norm(T.$('#app').textContent); const meta = T.$('.plan-meta'); ok(meta || T.$('.mission.done'), 'Achieve-hemmet visar planens tid (eller dagens plan klar)');
      if (meta) { const s = PA().EXP.summary(kid); ok(norm(meta.querySelector('.mins').textContent) === `cirka ${s.mins} min`, `Achieve: "cirka N min" = planen (${norm(meta.textContent)})`);
        const sh = meta.querySelector('.share'); if (sh) ok(/^(Allt inför provet|\d+ av \d+ uppgifter inför provet)$/.test(norm(sh.textContent)), 'Achieve: andelen inför provet står kvar'); }
      ok(!DISHONEST.test(home), 'Achieve-hem: inga löften eller procent'); }

    /* 6. Testa mig: lugnt resultat per mål – inga ✅/🔁, inget betyg, inga procent */
    { openKid(T, 'k8'); const tb = T.$('[data-v2="testa"]'); if (tb) { T.click(tb); let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 40) { ok(T.$('#qcard').dataset.exam === '1', 'Testa mig: data-exam'); D.answer(() => r() < 0.4); }
        const res = norm(T.$('#app').textContent); ok(!!T.$('.exam-hero'), 'Testa mig: resultatets rubrik'); ok(!/[✅🔁]/u.test(res), 'Testa mig: inga bocka/kryss-ikoner i v3');
        ok(!/\b\d+\s*\/\s*\d+\b/.test(res) && !DISHONEST.test(res), 'Testa mig: inget "5/7", inga procent eller löften'); ok(/svar stämde/.test(res), 'Testa mig: antalet sägs som "N av M svar stämde"'); }
      else ok(false, 'Testa mig finns för Äldre i fixturen'); }
  } catch (e) { fails++; console.log('FAIL exception', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`); console.log(fails ? 'UX 3.3 TEST FAILED' : 'UX 3.3 TEST OK'); process.exit(fails ? 1 : 0);
})();
