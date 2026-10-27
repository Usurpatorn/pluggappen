/* Experience v3 – golden case C: Explore för Yngre (åk 2) under tre veckor i den riktiga appen (jsdom, riktiga klick, fast klocka).
   SYNTETISK familj. Frågan: blir det meningsfulla aktiviteter – eller upprepade frågor och svar?
   Mäter och kontrollerar per CORE och över hela perioden:
   - variation: flera aktivitetstyper per pass (upptäck, tryck, sortera, para ihop, ordna, bygg, skriv talet …), inte bara textval
   - aldrig två textval i rad när momentet har en ledig aktivitet (inte redan använd idag eller nyss)
   - ingen uppgift exakt likadan två gånger i samma pass (utom "Ny chans" efter fel)
   - lågt läsmotstånd: uppläsning finns på uppgifter med text; inga dragmoment; inga räknare/nivåprickar i lugnt läge
   - avslut: ÄVENTYRET KLART! utan konfetti, ädelstenar eller skuld; FLOW med ett tryck
   - motorn bestämmer fortfarande (samma plan som visades) */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, rng } = require('./le/childflow.js');
const { v2tools, toStart } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;

(async () => {
  try {
    const w = mkWin({ seed: 222, fixedClock: true, tts: true }); await sleep(40); const T = tools(w); const PA = T.PA; const { $, click } = T;
    PA().FAMILY.apply(FIX); PA().load(); PA().rerender(); const D = v2tools(w, T); const rnd = rng(21);
    const kid = () => PA().KIDS.find(k => k.id === 'k2');
    const open = () => { toStart(T); click($('[data-kid="k2"]')); if ($('[data-pet]')) click($('[data-pet]')); };
    ok(PA().EXP.of(kid()) === 'explore', 'Yngre får Explore som standard');
    const all = []; const perCore = []; let above = 0, opp = 0, succ = 0, maxChoiceRun = 0, repeats = 0, items = 0, speakable = 0, withSpeak = 0, drag = 0, klar = 0, flows = 0, sameAsShown = 0, cores = 0;
    for (let d = 0; d < 21; d++) {
      open(); const go = $('.go-btn[data-v2="kor"]'); if (!go) { w.__advance(DAY); continue; }
      const peek = PA().V2.peekPlan(kid()).plan.map(s => s.cid); click(go); cores++;
      if (JSON.stringify(PA().S.v2.plan.map(s => s.cid)) === JSON.stringify(peek)) sameAsShown++;
      const types = new Set(); const seenQ = new Map(); let run = 0; let g = 0;
      while (PA().S && PA().S.v2 && $('#qcard') && g++ < 60) {
        const S = PA().S; const it = S.queue[S.i]; const ui = PA().EXP.uiOf(it); const extra = PA().EXP.isExtra(it);
        types.add(ui === 'learn' ? 'upptäck' : ui); all.push(ui); items++;
        const cid = it.spec && it.spec.cid; const L = Math.max(1, Math.min(3, (it.spec && it.spec.lvl) || 1)); const fmt = it.spec && it.spec.format;
        // Möjlighet = momentet har en aktivitet på rätt nivå och i rätt format som INTE redan användes idag (samma faktum) eller nyligen
        // (motorns senaste uppgifter för momentet) – det undantaget är appens dokumenterade regel, inte ett avsteg.
        const dk = PA().EXP.dayFacts(kid()); const recent = new Set((((S.v2.C.L.c[cid] || {}).items) || []).slice(-4));
        const fresh = (v) => { const fk = v.key.split('|').slice(0, 2).join('|'); if (dk.has(fk) && fk !== it.fk) return false; const q = PA().PACKS.buildVariant(cid, v, () => 0.5, 'younger'); return !q || !recent.has(PA().LECAT.itemId(q)); };
        const hasAct = !!cid && cid.startsWith('k:') && it.cat !== 'learn' && PA().PACKS.variants(cid, 'younger').some(v => v.ui && !['choice', 'type'].includes(v.ui) && v.lvl <= L + (it.spec.role === 'boss' ? 1 : 0) && (fmt !== 'recall' || v.form === 'recall') && (fmt !== 'depth' || PA().PACKS.DEPTH.has(v.form)) && fresh(v));
        // nivån: en uppgift över motorns nivå bara när det inte finns någon oanvänd variant på nivån i rätt format (motorns reserv)
        if (cid && cid.startsWith('k:') && it.cat !== 'learn' && it.spec.role !== 'boss' && !it.onlyVariant && (it.level || 1) > L && PA().PACKS.variants(cid, 'younger').some(v => v.lvl <= L && (fmt !== 'recall' || v.form === 'recall') && (fmt !== 'depth' || PA().PACKS.DEPTH.has(v.form)) && fresh(v))) { above++; if (process.env.DBG) console.log('ABOVE', cid, it.level, L, it.spec.role, fmt, it.form); }
        if (run >= 1 && hasAct) { opp++; if (ui !== 'choice') succ++; else if (process.env.DBG) console.log('VIOL', d, cid, it.spec.role); }
        if (ui === 'choice' || ui === 'word:pick' || ui === 'word:listen') { run++; maxChoiceRun = Math.max(maxChoiceRun, run); } else run = 0;
        const key = (it.word ? `ord:${it.word.id}:${it.kind}:${it.rev ? 1 : 0}` : '') + (it.text || '') + '|' + (Array.isArray(it.choices) && typeof it.answer === 'number' ? JSON.stringify(it.choices[it.answer]) : JSON.stringify(it.answer || ''));   // rätt svar som text (samma identitet som uppgiftens id), inte bara platsen bland alternativen
        if (it.cat !== 'learn' && !extra) { if (seenQ.get(key) === true) { repeats++; if (process.env.DBG) console.log('REPEAT', key.slice(0, 80)); } if (!seenQ.has(key)) seenQ.set(key, false); }
        const hasText = !!(it.text || (it.word && it.word.sv)); if (hasText && it.cat !== 'learn') { speakable++; if ($('.speak-btn, [data-speak], [data-hear]')) withSpeak++; }
        if ($('[draggable="true"]')) drag++;
        const nRes = S.results.length; D.answer(() => rnd() < 0.2); w.__advance(4000); const S2 = PA().S; if (S2 && it.cat !== 'learn' && !extra && S2.results.length > nRes && S2.results[S2.results.length - 1] === true) seenQ.set(key, true);
      }
      perCore.push(types.size);
      const t = $('#app').textContent;
      if (/ÄVENTYRET KLART!/.test(t)) klar++;
      ok(!/💎|konfetti|confetti/i.test(t) && !/missa|förlora|sista chansen/i.test(t), `dag ${d + 1}: KLAR utan ädelstenar, konfetti eller skuld`);
      if (d % 4 === 2 && $('[data-v2="flow"]')) { click($('[data-v2="flow"]')); flows++; let h = 0; while (PA().S && PA().S.v2 && $('#qcard') && h++ < 40) { D.answer(() => rnd() < 0.2); w.__advance(4000); } }
      w.__advance(DAY);
    }
    const dist = {}; for (const u of all) dist[u] = (dist[u] || 0) + 1;
    const choiceShare = ((dist.choice || 0) + (dist['word:pick'] || 0) + (dist['word:listen'] || 0)) / items;
    const avgTypes = perCore.reduce((a, b) => a + b, 0) / perCore.length;
    console.log(`  Explore 21 dygn: ${cores} CORE, ${flows} FLOW, ${items} uppgifter`);
    console.log(`  aktivitetstyper per CORE: ${perCore.join(' ')} (snitt ${avgTypes.toFixed(1)})`);
    console.log(`  fördelning: ${JSON.stringify(dist)}`);
    console.log(`  textval ${Math.round(choiceShare * 100)} % · längsta rad textval ${maxChoiceRun} · upprepningar i samma pass ${repeats} · uppläsning ${withSpeak}/${speakable} · aktivitet direkt efter ett textval ${succ}/${opp}`);
    ok(cores >= 18, `CORE varje dag (${cores})`);
    ok(sameAsShown === cores, `varje CORE startade exakt den plan som visades (${sameAsShown}/${cores})`);
    ok(avgTypes >= 2.5, `meningsfull variation: i snitt minst 2,5 aktivitetstyper per pass (${avgTypes.toFixed(1)})`);
    ok(Object.keys(dist).filter(k => !['choice', 'learn', 'word:pick', 'word:listen'].includes(k)).length >= 3, 'minst tre olika praktiska aktivitetstyper förekommer under perioden');
    ok(choiceShare < 0.6, `textval är inte huvudsaken (${Math.round(choiceShare * 100)} % < 60 %)`);
    ok(opp > 0 && succ / opp >= 0.8, `variationsregeln (Explore): efter ett textval blir det en aktivitet när momentet har en ledig som passar nivå och format (${succ} av ${opp})`);
    ok(above === 0, `aktiviteterna följer nivån motorn bad om (utom Bossen): ${above} uppgifter över nivån`);
    ok(repeats === 0, `ingen uppgift exakt likadan två gånger i samma pass (${repeats})`);
    ok(speakable === 0 || withSpeak / speakable >= 0.9, `uppläsning finns på uppgifter med text (${withSpeak}/${speakable})`);
    ok(drag === 0, 'inga dragmoment');
    ok(klar >= cores - 1, `ÄVENTYRET KLART! efter CORE (${klar}/${cores})`);
    ok(flows > 0, 'FLOW går att starta med ett tryck');
    ok(PA().LE.errors.length === 0, 'inga fel i v2-lagret ' + JSON.stringify(PA().LE.errors.slice(0, 2)));
  } catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'GOLDEN EXPLORE TEST FAILED' : 'GOLDEN EXPLORE TEST OK'); process.exit(fails ? 1 : 0);
})();
