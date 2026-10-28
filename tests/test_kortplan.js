/* 3.6.1 Dagens plan skild från nästa deadline (ägarens fynd: rubriken var läxförhöret, passet började med algebra).
   Riktiga appen i jsdom, SYNTETISK familj och skoluppgifter, fast klocka. Motorns val och ordning är orörda – det här prövar att
   startkortet beskriver precis det pass som Kör! startar:
   1. rubrikens mål är inte passets första ämne → kortet säger NÄSTA DEADLINE för målet och DAGENS PLAN för passet, och planens rubrik
      börjar med det ämne passet faktiskt börjar med
   2. den visade fördelningen ("N ämne · … · 1 bossuppgift") = det faktiska passet, räknat på de uppgifter som spelas
   3. den visade startordningen = första aktiviteten
   4. Kör på en målrad startar bara målets träning – också Boss, Rescue och omförsök
   5. inget användbart innehåll kvar → ingen Kör-hänvisning som lovar något
   6. rätt ord för målet: "inför läxförhöret", aldrig "inför provet" för ett läxförhör */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX, T_FIXED } = require('./le/childflow.js');
const { toStart, v2tools } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const DAY = 86400000;
const isoIn = (days) => new Date(T_FIXED + days * DAY).toISOString().slice(0, 10);
const KEMI = ['k:kemi8-syror-baser/ph-skalan', 'k:kemi8-syror-baser/indikatorer'];
const CONTENT = { v: 1, updatedAt: 1, packs: [], work: [
  { id: 'syn-lxf', kid: 'k8', type: 'homework', title: 'Läxförhör kemi', date: isoIn(16), kps: KEMI },
  { id: 'syn-alg', kid: 'k8', type: 'exam', title: 'Algebraprov', date: isoIn(21), skills: ['multin', 'forenkla', 'blandat'] },
  { id: 'syn-tom', kid: 'k8', type: 'homework', title: 'Läxförhör historia', date: isoIn(30) },
] };
async function boot(content, exp) { const w = mkWin({ seed: 7, fixedClock: true }); await sleep(40); const T = tools(w); const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); for (const k of ['k2', 'k4', 'k8']) PA.DB.profiles[k].exams = []; if (content) PA.FAMILY.applyContent(content); if (exp) PA.EXP.set(PA.KIDS.find(k => k.id === 'k8'), exp); PA.rerender(); return { w, T, PA }; }
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/* Spela passet och räkna det som faktiskt kommer: första aktiviteten och en post per plats (slutet av platsen, inte extra stöd) */
function play(b, D, wrongFn) {
  const { PA } = b; const kid = PA.KIDS.find(k => k.id === 'k8'); const C = PA.LE.state(kid); const seen = []; const slots = []; let n = 0;
  while (PA.S && PA.S.v2 && b.T.$('#qcard') && n++ < 80) {
    const q = PA.S.queue[PA.S.i]; if (q && q.spec && q.spec.cid) { seen.push({ cid: q.spec.cid, role: q.spec.role }); if (q._slotEnd && !PA.EXP.isExtra(q)) slots.push({ cid: q.spec.cid, role: q.spec.role }); }
    D.answer(wrongFn); if (b.w.__advance) b.w.__advance(4000);
  }
  return { seen, slots, label: (cid) => PA.EXP.subjLabel(kid, C, cid) };
}

(async () => {
  try {
    /* 1–3: kortet mot det pass som spelas, flera dygn i följd (motorn väljer olika ordning olika dagar) */
    { const b = await boot(CONTENT); const { PA, T } = b; const D = v2tools(b.w, T); const kid = PA.KIDS.find(k => k.id === 'k8');
      let mismatchSeen = 0, mixedSeen = 0, blockSeen = 0;
      for (let day = 0; day < 6; day++) {
        openKid(T, 'k8'); const card = T.$('.mission.achieve'); ok(!!card, `dag ${day}: Achieve-kortet finns`); if (!card) break;
        const txt = norm(card.textContent); const plan = PA.V2.peekPlan(kid).plan; const C = PA.LE.state(kid); const parts = PA.EXP.planParts(kid, C, plan);
        const dlSec = card.querySelector('.deadline'); const title = norm((card.querySelector('.goal-title') || {}).textContent);
        // NÄSTA DEADLINE: närmaste målet, i en egen liten del – aldrig planens rubrik
        ok(!!dlSec && /^NÄSTA DEADLINE/.test(norm(dlSec.textContent)) && norm(dlSec.textContent).includes('Läxförhör kemi'), `dag ${day}: NÄSTA DEADLINE visar läxförhöret`);
        ok(!/LÄXFÖRHÖR|ALGEBRAPROV/.test(title) && !/NÄSTA MÅL/.test(txt), `dag ${day}: planens rubrik är ämnen, inte ett mål ("${title}")`);
        ok(!dlSec || !dlSec.querySelector('.goal-title'), `dag ${day}: deadline-delen har ingen stor rubrik`);
        ok(/DAGENS PLAN/.test(txt) && txt.indexOf('NÄSTA DEADLINE') < txt.indexOf('DAGENS PLAN'), `dag ${day}: deadline ovanför dagens plan, skilda`);
        // Rätt ord för ett läxförhör
        ok(!/inför provet/.test(norm(dlSec && dlSec.textContent)), `dag ${day}: läxförhöret kallas aldrig "provet"`);
        const sh = PA.EXP.examShare(kid, PA.EXP.goalOf(kid, plan).all.find(x => x.e.id === 'w:syn-lxf'), plan);
        if (sh.n > 0) ok(norm(dlSec.textContent).includes(sh.n === sh.of ? 'Allt inför läxförhöret' : `${sh.n} av ${sh.of} uppgifter inför läxförhöret`), `dag ${day}: andelen med målets ord (${sh.n} av ${sh.of})`);
        const split = norm((card.querySelector('.plan-meta .split') || {}).textContent); const lis = [...card.querySelectorAll('.train li')].map(li => li.dataset.subj);
        ok(new RegExp(`^${plan.length} uppgift(er)? · cirka \\d+ min`).test(norm((card.querySelector('.plan-meta .mins') || {}).textContent)), `dag ${day}: antal uppgifter = planens längd`);
        // Spela passet från samma Kör-knapp
        T.click(T.$('.mission.achieve [data-v2="kor"]')); ok(PA.S && PA.S.v2 && PA.S.v2.mode === 'kor', `dag ${day}: Kör startar dagens plan`);
        let k = 0; const r = play(b, D, (it) => it.cat !== 'learn' && day % 2 === 1 && (++k % 3 === 0));
        const first = r.seen[0] && r.label(r.seen[0].cid);
        // 3. startordningen: första ämnet i listan och i rubriken = första aktivitetens ämne (Bossen spelas sist)
        ok(first && lis[0] === first, `dag ${day}: listan börjar med det ämne passet börjar med (${lis[0]} / ${first})`);
        ok(first && title.startsWith(first.toUpperCase()), `dag ${day}: rubriken börjar med passets första ämne (${title} / ${first})`);
        // 2. fördelningen = det faktiska passet
        const act = {}; let boss = 0; for (const s of r.slots) { if (s.role === 'boss') boss++; else act[r.label(s.cid)] = (act[r.label(s.cid)] || 0) + 1; }
        const shown = {}; let shownBoss = 0; for (const part of split.split(' · ')) { const m = part.match(/^(\d+) (.+)$/); if (!m) continue; if (/^bossuppgift/.test(m[2])) shownBoss = +m[1]; else shown[m[2]] = +m[1]; }
        ok(JSON.stringify(Object.entries(act).sort()) === JSON.stringify(Object.entries(shown).sort()) && boss === shownBoss, `dag ${day}: visad fördelning "${split}" = spelad ${JSON.stringify(act)} + ${boss} boss`);
        ok(r.slots.length === plan.length, `dag ${day}: lika många spelade platser som "N uppgifter" (${r.slots.length}/${plan.length})`);
        // Ordningstexten säger bara "Först …, sedan …" när ämnena verkligen kommer i block
        const seq = r.slots.filter(s => s.role !== 'boss').map(s => r.label(s.cid)); const runs = seq.filter((x, i) => i === 0 || seq[i - 1] !== x).length; const groups = new Set(seq).size;
        if (groups > 1) { if (runs === groups) { blockSeen++; ok(/Först /.test(txt), `dag ${day}: ämnen i block → "Först … sedan …"`); } else { mixedSeen++; ok(/Ämnena blandas i passet\. Det börjar med /.test(txt) && !/Först /.test(txt), `dag ${day}: blandat pass sägs vara blandat`); } }
        const dlCids = new Set(PA.V2.examCidsActive(kid, PA.LE.exams(kid, PA.DB.profiles.k8).find(e => e.id === 'w:syn-lxf')));
        if (r.seen[0] && !dlCids.has(r.seen[0].cid)) mismatchSeen++;
        ok(JSON.stringify(parts.groups.map(g => g.label)) === JSON.stringify(lis.slice(0, 4)), `dag ${day}: listan = planens ämnen i ordning`);
        b.w.__advance(DAY);
      }
      // Fallet som ägaren såg måste ha prövats: passet började med något annat än deadlinens mål
      ok(mismatchSeen > 0, `minst ett dygn där passet börjar med annat än nästa deadline (${mismatchSeen})`);
      console.log(`  dygn där passet börjar med annat än deadlinen: ${mismatchSeen} · blandade: ${mixedSeen} · i block: ${blockSeen}`);
    }

    /* 4. Kör på målraden: bara målets koncept, också Boss, Rescue och omförsök (allt fel → stöd och omförsök) */
    { const b = await boot(CONTENT); const { PA, T } = b; const D = v2tools(b.w, T); const kid = PA.KIDS.find(k => k.id === 'k8');
      for (const id of ['w:syn-lxf', 'w:syn-alg']) {
        openKid(T, 'k8'); const btn = T.$(`.upcoming [data-v2="mission"][data-exam="${id}"]`); ok(!!btn, `${id}: Kör på raden finns`); if (!btn) continue;
        const cids = new Set(PA.V2.examCidsActive(kid, PA.LE.exams(kid, PA.DB.profiles.k8).find(e => e.id === id)));
        T.click(btn); ok(PA.S && PA.S.v2 && PA.S.v2.mode === 'mission' && PA.S.v2.extra.examId === id, `${id}: startar målets träning`);
        const r = play(b, D, (it) => it.cat !== 'learn'); const roles = new Set(r.seen.map(s => s.role));
        ok(r.seen.length > 0 && r.seen.every(s => cids.has(s.cid)), `${id}: varje aktivitet hör till målet (${r.seen.filter(s => !cids.has(s.cid)).map(s => s.cid).join(',')})`);
        ok([...roles].some(x => ['rescue', 'retry', 'easy'].includes(x)), `${id}: stöd/omförsök förekom och höll sig inom målet (${[...roles].join(',')})`);
      }
    }

    /* 5. Inget användbart innehåll: mål utan innehåll → ingen Kör-knapp för det, ärlig text; deadline-knappen bara när den gör nytta */
    { const c = { ...CONTENT, work: [{ id: 'syn-tom', kid: 'k8', type: 'homework', title: 'Läxförhör historia', date: isoIn(5) }, CONTENT.work[1]] };
      const b = await boot(c); const { PA, T } = b; openKid(T, 'k8'); const card = T.$('.mission.achieve'); const t = norm(card && card.textContent);
      ok(/NÄSTA DEADLINE ?Läxförhör historia/.test(t) && /Läxförhörets områden är inte inlagda i appen ännu/.test(t) && !/Provets/.test(t), 'mål utan innehåll: ärlig text under deadline');
      ok(!T.$('[data-v2="mission"][data-exam="w:syn-tom"]') && !/Öva inför läxförhöret/.test(t), 'mål utan innehåll: ingen Kör/Öva-knapp');
      // Deadlinens egen knapp syns bara när målets plan har något som gör nytta (samma regel som raderna)
      const kid = PA.KIDS.find(k => k.id === 'k8'); for (const bt of [...T.$('#app').querySelectorAll('.mission.achieve [data-v2="mission"]')]) { const g = PA.EXP.goalOf(kid, null).all.find(x => x.e.id === bt.dataset.exam); ok(g && PA.EXP.goalPractice(kid, g.e).ok, `deadlinens knapp ${bt.dataset.exam} gör nytta`); }
    }

    /* 6. Ordet för målet i alla lägen */
    { const b = await boot(CONTENT); const { PA } = b; const N = (e) => PA.EXP.noun(e);
      ok(N({ kind: 'homework', title: 'Läxförhör kemi' }) === 'läxförhöret' && N({ kind: 'exam', title: 'Algebraprov' }) === 'provet' && N({ kind: 'vocab', title: 'Glosor v46' }) === 'glosförhöret', 'noun: typ går före titel');
      ok(N({ title: 'Glosförhör v.46' }) === 'glosförhöret' && N({ title: 'Prov 5 Geometri' }) === 'provet' && N({ title: 'Läxförhör orientering' }) === 'läxförhöret' && N({ title: 'Uppsats' }) === 'uppgiften', 'noun: förälderns egna mål efter titel');
      ok(PA.EXP.shareText({ n: 4, of: 9 }, { kind: 'homework' }) === '4 av 9 uppgifter inför läxförhöret' && PA.EXP.shareText({ n: 3, of: 3 }, { kind: 'exam' }) === 'Allt inför provet', 'shareText med målets ord');
    }
  } catch (e) { fails++; console.log('FAIL undantag', e && e.stack || e); }
  console.log(`${checks} kontroller, ${fails} fel`);
  console.log(fails ? 'KORTPLAN TEST FAILED' : 'KORTPLAN TEST OK');
  process.exit(fails ? 1 : 0);
})();
