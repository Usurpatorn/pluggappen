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
const SPLIT = ['num', 'expr', 'choice', 'paper', 'reverse', 'type', 'tap'];
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
    /* feedbacken granskas i samma ögonblick som drivaren trycker Nästa (då är svaret rättat och kortet kvar) */
    let klars = 0, revKlar = 0; let cur = null; const fbSeen = { bossMoment: 0, mistake: 0, why: 0, boss: 0, bossPraise: 0, wrongExplore: 0, aligned: 0, match: 0 };
    const snap = () => { if (!cur || !T.$('#qcard') || (T.$('#submit') && !T.$('#next') && !T.$('#fb .feedback'))) return;   /* drivarens andra försök (samma i 3.2.2) */
      const { id, it } = cur; cur = null; const fbEl = T.$('#qcard #fb'); if (it.cat === 'learn' || !fbEl) return;
      const fb = norm(fbEl.textContent); const ok1 = !!T.$('#fb .feedback.ok'); const no1 = !!T.$('#fb .feedback.no');
      ok(fb.length > 0, `${id}: feedback hamnar i kortet (${it.cat}/${it.kind || it.type})`); if (id === 'k8') ok(!/\bi rad\b/.test(fb), 'Achieve: inget "N i rad" i berömmet');
      if (it.spec && it.spec.role === 'boss' && ok1 && it.cat !== 'word' && !it.paper && !['sort', 'match', 'order', 'open'].includes(it.type)) { fbSeen.boss++; if (/👑|Bossuppgiften klar/.test(fb)) fbSeen.bossPraise++; }
      if (it.type === 'match' && no1) ok(!!fbEl.querySelector('.feedback.no.almost'), `${id}: Para ihop "Nästan" får gul kant, inte röd`);
      if (it.spec && it.spec.role === 'boss' && ok1) { fbSeen.bossMoment++; ok(T.$('#qcard').classList.contains('boss-won'), `${id}: en klarad Boss får sitt ögonblick`); }
      if (it.type === 'order' && no1) { const li = [...fbEl.querySelectorAll('.order-correct li')].map(x => norm(x.textContent)); ok(li.length === it.items.length && li.every((t, k) => t === norm(String(it.items[k]).replace(/<[^>]+>/g, ''))), `${id}: Ordna visar rätt ordning efter ett fel`); }
      if (it.form === 'mistake' && it.type === 'choicetext' && (ok1 || no1)) { fbSeen.mistake++; ok(!/Rätt svar:/.test(fb) && !!fbEl.querySelector(".feedback s"), `${id}: "hitta felet"-fråga: felet visas överstruket, aldrig som "Rätt svar" (${it.type}/${it.paper ? "papper" : ""} ${fb.slice(0, 90)})`); }
      if (id === 'k4' && ok1) ok(!w.document.querySelector('.xp-pop'), 'Grow: XP flyger inte över framstegsstapeln');
      if (id === 'k2' && no1) { fbSeen.wrongExplore++; ok(!/Du svarade/.test(fb), 'Explore: fel svar upprepar inte barnets svar'); const st = fbEl.querySelector('.steps'); if (st && it.cat === 'math') { fbSeen.why++; ok(st.matches('details.steps.why') && !st.open, 'Explore: förklaringen ligger bakom "Visa varför"'); } }
      if (it.type === 'match' && T.$('.match-grid.v3')) { fbSeen.match++; const cols = [...w.document.querySelectorAll('.match-grid.v3 .match-col')]; const L = [...cols[0].children].map(x => x.dataset.mi), Rr = [...cols[1].children].map(x => x.dataset.mi);
        if (cols[0].parentElement.classList.contains('paired')) { fbSeen.aligned++; ok(L.join() === Rr.join(), `${id}: klara par står på samma rad`); } }
      ok(w.document.getElementById('confetti') ? w.document.getElementById('confetti').classList.contains('hidden') || ok1 : true, `${id}: inga konfetti över ett fel svar`); };
    const T2 = { ...T, $: (sel) => { if (sel === '#next') snap(); return T.$(sel); } }; const DS = v2tools(w, T2);
    for (const id of ['k2', 'k4', 'k8']) {
      for (let d = 0; d < 5; d++) { openKid(T, id); const go = T.$('.go-btn[data-v2="kor"]'); if (!go) { w.__advance(DAY); continue; } T.click(go);
        let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 60) { checkCard(id); cur = { id, it: PA().S.queue[PA().S.i] }; DS.answer(() => r() < 0.25); w.__advance(3000); }
        /* KLAR: tiden står kvar i knappens text (skärmläsare + löftestestet), på egen rad visuellt */
        const flow = T.$('[data-v2="flow"]'); if (flow) { ok(/ · cirka \d+ min$/.test(norm(flow.textContent).replace(/\s·\s/, ' · ')), `${id}: FLOW-knappen säger "· cirka N min" (${norm(flow.textContent)})`);
          ok(!!flow.querySelector('.btn-sub'), `${id}: tiden på egen rad`); }
        const klar = T.$('.klar'); if (klar) { ok(!DISHONEST.test(norm(klar.textContent)), `${id}: KLAR utan löften/procent`); klars++;
          /* 3.3: samma KLAR-komposition i alla tre: märke, rubrik, EN mening, högst tre chips, sedan fortsätt/klar för idag, sist det som kommer tillbaka */
          ok(!!klar.querySelector('.klar-mark') && klar.querySelectorAll('.klar-title').length === 1 && klar.querySelectorAll('.klar-lead').length === 1, `${id}: KLAR har märke, en rubrik och en mening`);
          if (id === 'k4') ok(!!klar.querySelector('.klar-level') && /Nivå \d+/.test(norm(klar.textContent)) && /\d+ XP till nivå \d+/.test(norm(klar.textContent)), 'Grow-KLAR visar nivån och vad som är kvar till nästa');
          ok(klar.querySelectorAll('.klar-chips > div').length <= 3 && !/\d+ av \d+ rätt/.test(norm(klar.textContent)), `${id}: KLAR utan statistik, högst tre chips`);
          const order = [...w.document.querySelectorAll('.klar, [data-v2="flow"], [data-v2="kor"], [data-go="home"], .klar-back')].filter(x => !x.closest('.topbar')).map(x => x.matches('.klar') ? 'k' : x.matches('.klar-back') ? 'b' : x.matches('[data-go="home"]') ? 'h' : 'f');
          ok(order[0] === 'k' && order.indexOf('h') > 0 && (order.indexOf('b') === -1 || order.indexOf('b') > order.indexOf('h')), `${id}: KLAR-ordning rubrik → fortsätt → klar för idag → resten (${order.join('')})`); }
        w.__advance(DAY); } }
    console.log(`  "hitta felet"-frågor: ${fbSeen.mistake}`); ok(fbSeen.mistake > 0, '"hitta felet"-frågor prövade');
    console.log(`  Explore "Visa varför": ${fbSeen.why}`); ok(fbSeen.why > 0, 'Explore: "Visa varför" prövad');
    console.log(`  feedback: Boss ${fbSeen.bossPraise}/${fbSeen.boss} med Boss-beröm, Explore fel ${fbSeen.wrongExplore}, par ${fbSeen.aligned}/${fbSeen.match} i rad`);
    ok(fbSeen.boss === 0 || fbSeen.bossPraise === fbSeen.boss, 'en klarad Boss märks i berömmet'); ok(fbSeen.match === 0 || fbSeen.aligned >= 1, 'para ihop: paren ställs i rad när alla är klara');
    console.log(`  ${items} uppgifter, formspråk: ${Object.entries(modes).map(([k, v]) => k + ' ' + v).join(', ')}; två rutor i ${splitSeen}`);
    ok(items > 40 && splitSeen > 5 && Object.keys(modes).length >= 5, 'många uppgifter och flera formspråk prövade');

    /* 2b. Ordna och Para ihop börjar aldrig färdiglösta (även när blandningen råkar ge ursprungsordningen) */
    { const Rm = PA().R; const sh0 = Rm.shuffle; Rm.shuffle = (a) => a.slice();
      try { openKid(T, 'k8'); if (!T.$('.go-btn[data-v2="kor"]')) { w.__advance(DAY); openKid(T, 'k8'); } T.click(T.$('.go-btn[data-v2="kor"]')); const qo = { type: 'order', items: ['a', 'b', 'c', 'd'], text: 'Ordna', answer: [], skill: kidOf('k8').skills[0], steps: [] }; PA().mathBody(qo, kidOf('k8'), false);
        ok(!PA().S.order.shuffled.every((x, k) => x.i === k), 'ordna: aldrig redan i rätt ordning');
        const html = PA().EXP.body({ type: 'match', pairs: [['a', '1'], ['b', '2'], ['c', '3']] }); const dv = w.document.createElement('div'); dv.innerHTML = html; const cols = dv.querySelectorAll('.match-col');
        ok([...cols[0].children].map(x => x.dataset.mi).join() !== [...cols[1].children].map(x => x.dataset.mi).join(), 'para ihop: paren står aldrig redan på samma rad'); }
      finally { Rm.shuffle = sh0; } }
    /* 2c. +0 XP visas aldrig */
    { const n0 = w.document.querySelectorAll('.xp-pop').length; PA().xpPop(0); ok(w.document.querySelectorAll('.xp-pop').length === n0, 'ingen "+0 XP"'); }
    /* 3. Hitta felet: lösningskort med bokstav, samma val och samma rättning */
    const inject = (kind) => { openKid(T, 'k8'); if (!T.$('.go-btn[data-v2="kor"]')) { w.__advance(DAY); openKid(T, 'k8'); } T.click(T.$('.go-btn[data-v2="kor"]')); const S = PA().S; const it = S.queue[S.i]; const kid = kidOf('k8'); const sk = kid.skills.find(s => s.id === 'forenkla') || kid.skills[0];
      const q = PA().EXP.rhythmItem(kind, sk, 2); if (!q) return null; S.queue[S.i] = { ...q, skill: sk, cat: 'math', level: q.level || 2, rhythm: kind, fcode: kind === 'spot' ? 'm' : 'v', spec: { ...(it.spec || {}), role: 'focus', rhythm: kind }, _slotEnd: true };   /* som planeraren (05g_v2app.js) */ PA().rerender(); return S.queue[S.i]; };
    let spots = 0; { const pk = PA().DB.profiles.k8; pk.settings = { ...(pk.settings || {}), tts: true }; } const tts0 = PA().TTS.ok; try { Object.defineProperty(PA().TTS, 'ok', { value: true, configurable: true, writable: true }); } catch (e) { /* som förut */ }
    for (let t = 0; t < 4; t++) { const q = inject('spot'); if (!q) { ok(false, 'Hitta felet kunde skapas'); break; }
      const qc = T.$('#qcard'); ok(qc.dataset.mode === 'spot' && !qc.classList.contains('split'), 'Hitta felet: eget formspråk, ingen tvåruta');
      const sols = [...doc.querySelectorAll('#choices .spot-sol')]; ok(sols.length === q.choices.length && sols.length >= 2, `Hitta felet: ett kort per lösning (${sols.length})`);
      ok(sols.every((b, i) => b.dataset.choice === String(i) && b.getAttribute('aria-label').startsWith(q.choices[i] + ': ')), 'Hitta felet: varje kort har val-index och skärmläsartext');
      ok(sols.every(b => b.querySelector('.sol-l') && b.querySelector('.sol-b') && norm(b.querySelector('.sol-b').textContent).length > 3), 'Hitta felet: bokstav + lösningens rader');
      ok(!!T.$('#qtext') && !/<div style="margin:6px 0">/.test(T.$('#qtext').innerHTML) && !/svar:/.test(T.$('#qtext').textContent), 'Hitta felet: lösningarna står i korten, inte i frågetexten');
      const rowsTxt = q.text.split('<div style="margin:6px 0">').slice(1).map(x => norm(x.replace(/<[^>]+>/g, ' ')).replace(/^[A-C]\. /, ''));
      ok(sols.every((b, i) => norm(b.getAttribute('aria-label')).includes(rowsTxt[i].slice(0, 20))), 'Hitta felet: skärmläsaren hör hela lösningen (inte bara "Lösning A")');
      const sp = T.$('#qcard [data-speak]'); if (sp) { spots++; ok(!sp.hasAttribute('data-highlight') && rowsTxt.every(t => norm(sp.dataset.speak).includes(t.slice(0, 20))), 'Hitta felet: Läs upp läser alla tre lösningarna'); }
      const right = q.bad; const pick = t % 2 ? (right + 1) % sols.length : right; const n0 = PA().S.results.length; T.click(sols[pick]);
      const fb = norm(T.$('#fb').textContent); ok(t % 2 ? T.$('#fb .feedback.no') || /inte|fel/i.test(fb) : T.$('#fb .feedback.ok'), `Hitta felet: ${t % 2 ? 'fel' : 'rätt'} val rättas som förut (${fb.slice(0, 60)})`);
      ok(PA().S.results.length === n0 + 1 && PA().S.results[n0] === !(t % 2), 'Hitta felet: ett resultat, rätt värde'); }

    try { Object.defineProperty(PA().TTS, 'ok', { value: tts0, configurable: true, writable: true }); } catch (e) { /* som förut */ }
    console.log(`  Hitta felet: Läs upp prövad ${spots} gånger`); ok(spots > 0, 'Hitta felet: Läs upp prövad');
    /* 3b. "Hitta felet"-frågor: bara när svaret ÄR felet (variant false/err) visas det överstruket; annars "Rätt svar" som vanligt */
    { const P = PA().PACKS; const rnd = rng(9); let isErr = 0, notErr = 0, wrongFlag = 0; const sample = { err: null, plain: null };
      for (const pol of ['older', 'middle', 'younger']) for (const cid of Object.keys(P.REG.kp)) for (const v of P.variants(cid, pol)) { if (v.form !== 'mistake') continue;
        const dir = v.key.split('|').pop(); const q = P.buildVariant(cid, v, rnd, pol); if (!q) continue; const should = dir === 'false' || dir === 'err';
        if (!!q.isError !== should) wrongFlag++; if (should) { isErr++; if (!sample.err && Array.isArray(q.choices) && q.ui !== 'tap') sample.err = q; } else { notErr++; if (!sample.plain && Array.isArray(q.choices) && q.ui !== 'tap') sample.plain = q; } }
      console.log(`  "hitta felet"-varianter: ${isErr} där svaret är felet, ${notErr} andra med formen mistake, ${wrongFlag} fel märkta`);
      ok(wrongFlag === 0 && isErr > 0 && notErr > 0, 'isError sätts exakt för varianterna false/err');
      for (const [kind, q0] of Object.entries(sample)) { if (!q0) { ok(false, 'exempel ' + kind); continue; } for (const wrong of [false, true]) {
        openKid(T, 'k8'); if (!T.$('.go-btn[data-v2="kor"]')) { w.__advance(DAY); openKid(T, 'k8'); } T.click(T.$('.go-btn[data-v2="kor"]'));
        const S = PA().S; const it = S.queue[S.i]; const kid = kidOf('k8'); S.queue[S.i] = { ...q0, skill: kid.skills[0], cat: 'math', level: 2, spec: { ...(it.spec || {}), role: 'focus' }, _slotEnd: true }; PA().rerender();
        const right = q0.answer; const pick = wrong ? (right + 1) % q0.choices.length : right; T.click(T.$(`#choices [data-choice="${pick}"], [data-choice="${pick}"]`)); if (T.$('#submit') && !T.$('#next')) T.click(T.$('#submit'));
        const fbEl = T.$('#fb'); const fbt = norm(fbEl.textContent); const struck = fbEl.querySelector('.feedback s');
        if (kind === 'err') ok(!!struck && !/Rätt svar:/.test(fbt) && norm(struck.textContent) === norm(q0.choices[right]), `svaret är felet (${wrong ? 'fel' : 'rätt'} val): felet överstruket`);
        else { ok(!struck, `vanlig mistake-fråga (${wrong ? 'fel' : 'rätt'} val): rätt svar stryks aldrig (${fbt.slice(0, 60)})`); if (wrong) ok(/Rätt svar:/.test(fbt), 'vanlig mistake-fråga: "Rätt svar" som vanligt'); }
        ok(!!T.$('#qcard').dataset.iserr === (kind === 'err'), 'data-iserr bara när svaret är felet'); } } }
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

    ok(klars >= 6, `KLAR prövad i alla upplevelser (${klars})`); ok(fbSeen.bossMoment > 0, 'Boss-ögonblicket prövat');
    /* 5b. Grow-hemmet: barnets ord för lägena, en rad om skoluppgiften, ingen hockeyposition */
    { toStart(T); openKid(T, 'k4'); const h = T.$('.mission.grow'); if (h) { const ht = norm(h.textContent);
        ok(!/\b(RW|LW|C|D|G)\b/.test(norm((T.$('.ident') || { textContent: '' }).textContent)), 'Grow: inga obegripliga förkortningar (RW)');
        ok(T.$('.grow-prog') ? /Dina områden/.test(ht) && /(sitter|på väg|övar)/.test(ht) && !/säkra|tränar/.test(ht) : true, 'Grow: stapeln förklaras med barnets ord');
        ok(h.querySelectorAll('.goal-row').length <= 1 && !/Dagens runda övar annat\./.test(ht), 'Grow: skoluppgiften på högst en rad'); }
      else ok(!!T.$('.mission.done'), 'Grow-hemmet finns'); }
    /* 5b2. Grow: barnets ord motsvarar motorns lägen exakt; läsbart namn = momentets eget namn */
    { w.__advance(DAY); const pr = { 'Säker': 3, 'På väg': 5, 'Tränar': 2, 'Behöver repetition': 1 }; const pg0 = PA().EXP.progress; PA().EXP.progress = () => pr;   /* olika tal för varje läge, så att en förväxling syns */
      toStart(T); openKid(T, 'k4'); PA().EXP.progress = pg0; const st = T.$('.progress-states'); ok(!!st, 'Grow-hemmet visar Dina områden');
      if (st) { const num = (cls) => { const el = st.querySelector('.' + cls + ' b'); return el ? +el.textContent : 0; };
        ok(num('p-skra') === pr['Säker'] && num('p-pvg') === pr['På väg'] && num('p-trnar') === pr['Tränar'] + pr['Behöver repetition'], `Grow: sitter/på väg/övar = motorns Säker/På väg/Tränar+Behöver repetition (${num('p-skra')}/${num('p-pvg')}/${num('p-trnar')})`);
        ok(/sitter/.test((st.querySelector('.p-skra') || { textContent: 'sitter' }).textContent) && /övar/.test((st.querySelector('.p-trnar') || { textContent: 'övar' }).textContent), 'Grow: rätt ord vid rätt läge'); }
      const sk = kidOf('k8').skills.find(x => x.id === 'andragrad'); ok(!sk || PA().V2.readable(sk.short) === sk.name, 'läsbart namn för "x²" = momentets eget namn'); }
    /* 5b3. Ordna: efter ett fel visas den sanna ordningen (index som rättningen använder), inte i Testa mig */
    { openKid(T, 'k8'); if (!T.$('.go-btn[data-v2="kor"]')) { w.__advance(DAY); openKid(T, 'k8'); } T.click(T.$('.go-btn[data-v2="kor"]'));
      const S = PA().S; const it = S.queue[S.i]; const items = ['Först', 'Sedan', 'Därefter', 'Sist'];
      S.queue[S.i] = { type: 'order', text: 'Ordna stegen.', items, steps: ['Det här är ordningen.'], skill: kidOf('k8').skills[0], cat: 'math', level: 2, spec: { ...(it.spec || {}), role: 'focus' }, _slotEnd: true }; PA().rerender();
      const order = PA().S.order.shuffled.map(x => x.i); const wrong = [order.find(i => i === 1), order.find(i => i === 0), 2, 3];
      for (const i of wrong) T.click(T.$(`[data-otile="${i}"]`)); if (T.$('#submit')) T.click(T.$('#submit'));
      const li = [...w.document.querySelectorAll('#fb .order-correct li')].map(x => norm(x.textContent));
      ok(JSON.stringify(li) === JSON.stringify(items), `Ordna: rätt ordning efter ett fel (${li.join(' > ')})`);
      ok(!!w.document.querySelector('#fb details.steps.why') || !w.document.querySelector('#fb .steps'), 'Ordna: förklaringen ett tryck bort (ingen dubbel ordning)'); }
    /* 5b4. KLAR efter Revansch före dagens plan säger inte "dagens runda" */
    for (const id of ['k4', 'k2']) { w.__advance(DAY); openKid(T, id); if (T.$('.go-btn[data-v2="kor"]')) { T.click(T.$('.go-btn[data-v2="kor"]')); D.run(() => true); }   /* ett pass med fel → saker att ta revansch på */
      w.__advance(DAY); openKid(T, id); const rb = T.$('[data-v2="revansch"]'); if (!rb || !T.$('.go-btn[data-v2="kor"]')) continue;
      T.click(rb); let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 30) { D.answer(() => r() < 0.3); w.__advance(2000); }
      const kl = T.$('.klar'); if (kl) { revKlar++; ok(!/dagens (runda|äventyr)/.test(norm(kl.textContent)) || !T.$('[data-v2="kor"]'), `${id}: KLAR efter Revansch lovar inte att dagens plan är klar`); } }
    ok(revKlar > 0, 'KLAR efter Revansch prövad');
    /* 5c. Föräldraläget: naturliga ord, ingen lös tid, läsbara områdesnamn */
    { toStart(T); const pb = T.$('[data-go="parent"]'); if (pb) { T.click(pb); const pins = [...w.document.querySelectorAll('[data-pin]')]; ['1', '2', '3', '4'].forEach((d, i) => { if (pins[i]) { pins[i].value = d; pins[i].dispatchEvent(new w.Event('input', { bubbles: true })); } });
        const pt = norm(T.$('#app').textContent); ok(/Översikt/.test(pt), 'föräldraläget öppnas');
        ok(!/Uppgifter \/ rätt/.test(pt) && !/\b0:00\b/.test(pt) && !/\d+\/\d+ · övningsindikation/.test(pt), 'förälder: "N rätt av M", ingen lös 0:00');
        ok(!/(^|[\s:·(])x²([\s·–),]|$)/.test(pt), 'förälder: områdesnamn i ord, inte "x²"');
        ok(/Testläge – inget sparas/.test(pt) || !T.$('.tm-card'), 'förälder: Testa som barnet säger "inget sparas"'); } else ok(false, 'föräldraknappen finns'); }
    /* 6. Testa mig: lugnt resultat per mål – inga ✅/🔁, inget betyg, inga procent */
    { openKid(T, 'k8'); const tb = T.$('[data-v2="testa"]'); if (tb) { T.click(tb); let g = 0; while (PA().S && PA().S.v2 && T.$('#qcard') && g++ < 40) { ok(T.$('#qcard').dataset.exam === '1', 'Testa mig: data-exam'); ok(!w.document.querySelector('.progress i.ok, .progress i.no'), 'Testa mig: framstegsstapeln avslöjar inte rätt/fel'); D.answer(() => r() < 0.4); }
        const res = norm(T.$('#app').textContent); ok(!!T.$('.exam-hero'), 'Testa mig: resultatets rubrik'); ok(!/[✅🔁]/u.test(res), 'Testa mig: inga bocka/kryss-ikoner i v3');
        ok(!/\b\d+\s*\/\s*\d+\b/.test(res) && !DISHONEST.test(res), 'Testa mig: inget "5/7", inga procent eller löften'); ok(!/\d+ av \d+ svar stämde/.test(res) && /Öva mer|Alla svar stämde|vad du ska öva på/.test(res), 'Testa mig: resultatet leder med vad som ska övas, inte ett antal'); }
      else ok(false, 'Testa mig finns för Äldre i fixturen'); }
  } catch (e) { fails++; console.log('FAIL exception', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`); console.log(fails ? 'UX 3.3 TEST FAILED' : 'UX 3.3 TEST OK'); process.exit(fails ? 1 : 0);
})();
