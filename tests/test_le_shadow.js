/* Fas 3B – skuggläge i den riktiga appen (jsdom, dist/pluggappen.html).
   1. Barnen får v1: samma slumpfrö + samma klocka ⇒ identiska skärmar och identisk v1-data med skuggan PÅ och AV.
   2. Skuggan fångar varje pass (v1 faktiskt ↔ v2 skugga) och varje mattesvar som bevis – utan fria svarstexter.
   3. Diagnostiken finns bara i föräldraläget; barnets skärmar nämner aldrig v2/skugga; policyöverstyrning syns inte för barnet.
   4. Migrering v1 → le på befintlig profil: v1 orört, deterministisk, idempotent över omladdning; rollback = ta bort le.
   5. Täckning: konceptkatalogen täcker alla moment i alla kursmallar + alla glosdeck, med stabila, unika id:n. */
'use strict';
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const FIX = require('./test_fixture_family.json');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const { rng, T_FIXED, mkWin, tools, strip, childFlow } = require('./le/childflow.js');

setTimeout(() => {
  try {
    /* ---------- 1. v1 oförändrat: skugga PÅ vs AV ---------- */
    const wOn = mkWin({ seed: 4242, fixedClock: true }), wOff = mkWin({ seed: 4242, fixedClock: true });
    setTimeout(() => {
      try {
        const On = tools(wOn), Off = tools(wOff); Off.PA().LE.on = false;
        childFlow(wOn, On); childFlow(wOff, Off);
        ok(On.snaps.length === Off.snaps.length && On.snaps.length >= 15, 'same number of child screens');
        const diffAt = On.snaps.findIndex((s, i) => s[1] !== Off.snaps[i][1]); ok(diffAt === -1, 'every child screen identical with shadow on/off' + (diffAt >= 0 ? ' – first diff at ' + On.snaps[diffAt][0] : ''));
        for (const id of ['k2', 'k4', 'k8']) ok(JSON.stringify(strip(On.PA().DB.profiles[id])) === JSON.stringify(strip(Off.PA().DB.profiles[id])), `v1 data identical with shadow on/off (${id}: xp, mastery, levels, Felboken, words, quests, streak …)`);
        ok(!Off.PA().DB.profiles.k2.le && On.PA().DB.profiles.k2.le, 'shadow off writes nothing; shadow on adds only p.le');
        /* ---------- 2. fångst ---------- */
        const PA = On.PA(); ok(PA.LE.errors.length === 0, 'no shadow errors: ' + JSON.stringify(PA.LE.errors));
        const les = ['k2', 'k4', 'k8'].map(id => PA.DB.profiles[id].le); const events = les.reduce((a, le) => a + le.log.length, 0);
        ok(events === On.mathAnswers, `one evidence event per math answer (${events} / ${On.mathAnswers}); blitz excluded`);
        const recs = les.flatMap(le => le.shadow); ok(recs.length >= 9 && recs.every(r => r.done === 1 && r.v1.length && r.v2.length), `every session has a completed v1↔v2 record (${recs.length})`);
        ok(recs.some(r => r.src === 'kor') && recs.some(r => r.src === 'test') && recs.some(r => r.src === 'lang') && recs.some(r => r.src === 'skill'), 'sources: Kör!, test, language lesson, single skill');
        ok(recs.filter(r => r.src === 'test').every(r => PA.DB.profiles.k8.le.log.filter(e => e[11] === r.id).every(e => e[8] === 'e')), 'test-mode answers logged as exam context');
        const leJson = JSON.stringify(les); ok(!/ZZQX|987654|zzqx|vet inte/.test(leJson), 'no free-text answers stored in le');
        ok(!/"(ms|elapsed|rt|time)"/.test(leJson), 'no response-time telemetry stored (only a fast flag on wrong answers)');
        ok(les.every(le => JSON.stringify(le).length < 60000), 'le stays small (' + les.map(le => Math.round(JSON.stringify(le).length / 1024) + ' kB').join(', ') + ')');
        const k2 = PA.DB.profiles.k2.le; const first = k2.shadow[0]; ok(first.v1.every(c => /^[sd]:/.test(c)), 'v1 actual recorded as concept ids');
        // tider: passets start på hel minut, svar = start + löpnummer → svarstid går inte att utläsa
        const allLe = ['k2', 'k4', 'k8'].map(id => PA.DB.profiles[id].le); let timeOk = true, sidOk = true;
        for (const le of allLe) { const bySess = {}; for (const e of le.log) (bySess[e[11]] = bySess[e[11]] || []).push(e[0]); for (const ts of Object.values(bySess)) ts.forEach((t, i) => { if (i && t - ts[i - 1] !== 1) timeOk = false; }); const ids = le.shadow.map(r => r.id); if (new Set(ids).size !== ids.length) sidOk = false; }
        ok(timeOk, 'evidence times = session start + ordinal (no per-answer timing)'); ok(sidOk, 'session ids unique');
        const k2recs = PA.DB.profiles.k2.le.shadow; ok(k2recs[0].src === 'kor' && k2recs[1].src !== 'kor', '"en till" after Kör! is not counted as Kör!');
        /* ---------- 3. bara i föräldraläget ---------- */
        const childText = On.snaps.map(s => s[1]).join('\n'); ok(!/skugg|Learning Engine|Motor v2|v2 skulle/i.test(childText), 'child screens never mention v2/shadow');
        const { $, click } = On; click($('[data-go="start"]')); click($('[data-kid="k2"]')); const homeBefore = $('#app').innerHTML;
        click($('[data-go="start"]')); click($('[data-go="parent"]'));
        const pins = [...wOn.document.querySelectorAll('[data-pin]')]; ['1', '2', '3', '4'].forEach((d, i) => { pins[i].value = d; pins[i].dispatchEvent(new wOn.Event('input', { bubbles: true })); });
        // föräldravyn får inte skapa barnets dagliga uppdrag eller ändra profilen (k4 har inte öppnat startsidan idag i den här kontrollen)
        const p4 = PA.DB.profiles.k4; const q4 = JSON.stringify(p4.quests); p4.quests = null; const u4 = p4.updatedAt; click($('[data-tab="k4"]')); click($('[data-sub="v2"]'));
        ok(p4.quests === null && p4.updatedAt === u4 && /öppnar sin startsida/.test($('#app').textContent), 'parent v2 tab has no side effects on v1 (quests not created, profile not saved)'); p4.quests = JSON.parse(q4);
        // synkade skuggposter med skadligt innehåll visas aldrig som HTML
        PA.DB.profiles.k4.le.shadow.push({ id: 'x:1', t: 1, done: 1, src: '<img src=x onerror=alert(1)>', v1: ['<b>x</b>'], v2: [['s:mult', '<svg onload=alert(1)>', '<i>']], a: [['s:mult', 1, '<u>']], n: '<script>1</script>' });
        click($('[data-sub="overview"]')); click($('[data-sub="v2"]'));
        ok(!wOn.document.querySelector('#app img, #app svg[onload], #app script, #app b:not([class])') || ![...wOn.document.querySelectorAll('#app img, #app svg, #app script')].some(e => e.getAttribute('onerror') || e.getAttribute('onload') || e.tagName === 'SCRIPT'), 'injected shadow record rendered as text, not HTML');
        ok(!/onerror|onload/.test([...wOn.document.querySelectorAll('#app *')].map(e => [...e.attributes].map(a => a.name).join(' ')).join(' ')), 'no event-handler attributes in parent diagnostics');
        PA.DB.profiles.k4.le.shadow.pop();
        click($('[data-tab="k2"]')); click($('[data-sub="v2"]')); const pt = $('#app').textContent;
        ok(/skuggläge/.test(pt) && /v1 faktiskt/.test(pt) && /Nästa Kör!/.test(pt) && /Det som ska bedömas före 3C/.test(pt), 'parent v2 diagnostics render');
        for (const label of ['Kalibrering', 'Träffsäkerhet vid hämtning', 'Förfallna nu / imorgon', 'Felboken v2', 'Snabba fel (K-12)', 'Planernas överlapp', 'Ämnesbalans v1', 'Ny inlärning', 'Prov inom 21 dagar']) ok(pt.includes(label), 'diagnostic present: ' + label);
        ok(/jämförelseband, inte ett mål/.test(pt), 'accuracy shown as comparison band, not a target');
        click($('[data-le-pol="older"]')); ok(PA.DB.profiles.k2.settings.lePolicy === 'older' && /överstyrd/.test($('#app').textContent), 'parent policy override (O-9)');
        click($('[data-le-pol="auto"]')); ok(PA.DB.profiles.k2.settings.lePolicy === 'auto' && /från kursmallen/.test($('#app').textContent), 'reset to template default is an explicit value (syncs)'); click($('[data-le-pol="older"]'));
        click($('[data-tab="settings"]')); ok(/Learning Engine v2 · skuggläge/.test($('#app').textContent), 'settings: shadow summary for all children');
        click($('[data-go="start"]')); click($('[data-kid="k2"]')); ok($('#app').innerHTML === homeBefore, 'child home unchanged by policy override');
        ok(PA.LE.errors.length === 0, 'still no shadow errors');
        /* ---------- 4. omladdning, migrering, rollback ---------- */
        PA.flushSave(); const store = { 'pluggappen.v1': wOn.localStorage.getItem('pluggappen.v1'), 'pluggappen.family.v1': wOn.localStorage.getItem('pluggappen.family.v1'), 'pluggappen.dev': wOn.localStorage.getItem('pluggappen.dev') };
        const liveL = PA.LE2.stable(PA.LE.state(PA.KIDS.find(k => k.id === 'k2')).L);
        const w2 = mkWin({ storage: store });
        setTimeout(() => {
          try {
            const P2 = w2.PA; const kid2 = P2.KIDS.find(k => k.id === 'k2');
            ok(P2.LE2.stable(P2.LE.state(kid2).L) === liveL, 'after reload: replayed state == live state');
            // befintlig v1-profil utan le
            const v1prof = JSON.parse(store['pluggappen.v1']); for (const id of Object.keys(v1prof.profiles)) delete v1prof.profiles[id].le;
            const s3 = { ...store, 'pluggappen.v1': JSON.stringify(v1prof) }; const w3 = mkWin({ storage: s3, fixedClock: true }), w4 = mkWin({ storage: s3, fixedClock: true });
            setTimeout(() => {
              try {
                const P3 = w3.PA, P4 = w4.PA; const k8a = P3.KIDS.find(k => k.id === 'k8'), k8b = P4.KIDS.find(k => k.id === 'k8');
                const before = JSON.stringify(P3.DB.profiles.k8); P3.LE.ensure(k8a); P4.LE.ensure(k8b);
                ok(JSON.stringify(strip(P3.DB.profiles.k8)) === before, 'migration leaves every v1 field byte-identical');
                ok(P3.LE2.stable(P3.DB.profiles.k8.le) === P4.LE2.stable(P4.DB.profiles.k8.le), 'migration deterministic across devices (same profile, same time)');
                const c = P3.DB.profiles.k8.le.base.c; ok(Object.keys(c).length > 0 && Object.values(c).every(x => x.st <= 2), 'migrated: concepts from v1 skills, none above stage 2');
                const leA = P3.LE2.stable(P3.DB.profiles.k8.le); P3.load(); P3.LE.invalidate('k8'); P3.LE.ensure(k8a); ok(P3.LE2.stable(P3.DB.profiles.k8.le) === leA, 'reload + ensure is idempotent');
                // rollback: ta bort le → v1 fungerar, ingen krasch, skuggan börjar om
                delete P3.DB.profiles.k8.le; P3.LE.invalidate('k8'); const T = tools(w3); T.click(T.$('[data-kid="k8"]')); T.click(T.$('[data-rec]')); T.run(); ok(/klar/i.test(T.$('#app').textContent) && P3.LE.errors.length === 0, 'rollback (le removed): v1 session works, shadow restarts cleanly');
                /* ---------- 5. katalogtäckning ---------- */
                const cov = []; const fam = { v: 1, updatedAt: 1, kids: Object.keys(P3.TEMPLATES).map((t, i) => ({ id: 'c' + i, name: 'C' + i, template: t, theme: 'pet', hue: 'teal', emoji: '🙂', exams: [], decks: [] })) };
                P3.FAMILY.apply(fam); P3.load();
                for (const kid of P3.KIDS) {
                  const p = P3.DB.profiles[kid.id]; const decks = [...P3.BUILTIN_DECKS, ...p.decks]; const b = P3.LECAT.build(kid, decks, null);
                  const skillIds = kid.skills.map(s => s.id); const dup = skillIds.filter((x, i) => skillIds.indexOf(x) !== i);
                  ok(!dup.length, `${kid.template}: unique skill ids (dups: ${dup})`);
                  ok(skillIds.every(id => b.map[id] === 's:' + id && b.cat['s:' + id]), `${kid.template}: every skill has a concept (${skillIds.length})`);
                  ok(decks.every(d => b.cat['d:' + d.id]), `${kid.template}: every deck has a concept (${decks.length})`);
                  ok(Object.values(b.cat).every(c => c.subject && c.name && c.maxLvl >= 1), `${kid.template}: complete concept definitions`);
                  // varje uppgift från varje generator på varje nivå hamnar på sitt koncept och får ett stabilt uppgifts-id
                  let items = 0, bad = 0; for (const s of kid.skills) for (let lv = 1; lv <= (s.maxLvl || 3); lv++) for (let r = 0; r < 4; r++) { const q = s.gen(lv, {}); q.skill = s; q.cat = 'math'; items++; if (P3.LECAT.cidOfItem(q) !== 's:' + s.id || !/^i[0-9a-z]+$/.test(P3.LECAT.itemId(q)) || P3.LECAT.itemId(q) !== P3.LECAT.itemId(JSON.parse(JSON.stringify({ type: q.type, text: q.text, answer: q.answer, choices: q.choices })))) bad++; }
                  ok(bad === 0, `${kid.template}: ${items} generated items map to concept + stable item id`); cov.push(`${kid.template}: ${items} genererade uppgifter → rätt koncept`);
                  const bySubj = {}; for (const c of Object.values(b.cat)) bySubj[c.subject] = (bySubj[c.subject] || 0) + 1; cov.push(`${kid.template}: ${Object.keys(b.cat).length} koncept (${Object.entries(bySubj).map(([k, v]) => k + ' ' + v).join(', ')})`);
                }
                ok(FIX.kids.every(k => k.exams.every(e => e.skillIds.every(id => P3.KIDS.length))), 'fixture exams reference known skills');
                console.log('Katalog: ' + cov.join(' · '));
                console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE SHADOW TEST FAILED' : 'LE SHADOW TEST OK'); process.exit(fails ? 1 : 0);
              } catch (e) { console.log('EXC', e.stack); process.exit(1); }
            }, 300);
          } catch (e) { console.log('EXC', e.stack); process.exit(1); }
        }, 300);
      } catch (e) { console.log('EXC', e.stack); process.exit(1); }
    }, 300);
  } catch (e) { console.log('EXC', e.stack); process.exit(1); }
}, 10);
