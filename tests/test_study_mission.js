/* 2.1F–H / 2.2-grunden: familjens privata innehåll (_content) med skoluppgifter, lärarens frågor i Testa mig, uppdragsrubriken på
   startsidan (KEMIPROV · DATUM / IDAG N minuter / KÖR), lugn återkomst utan skuld, och innehållshälsa ("Den här frågan är konstig" +
   föräldraflaggor). Allt med en PÅHITTAD skoluppgift och SYNTETISK familj – inga riktiga familjeuppgifter. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { v2tools, classic, setEngine, toStart, unlockParent } = require('./le/v2driver.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const OLD = path.join(require('os').tmpdir(), 'pluggappen-2.0.0-sm-' + process.pid + '.html');
fs.writeFileSync(OLD, zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'golden/pluggappen-2.0.0.html.gz'))));
const dump = (w) => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const finish = () => { try { fs.unlinkSync(OLD); } catch (e) { /* ignore */ } console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'STUDY MISSION TEST FAILED' : 'STUDY MISSION TEST OK'); process.exit(fails ? 1 : 0); };
const KP = 'k:kemi8-syror-baser/';

// Påhittad skoluppgift (fiktiv lärare, fiktivt kapitel). Fixturens klocka: 2026-10-25 → provet om 26 dygn.
const CONTENT = {
  v: 1, updatedAt: 1001,
  packs: [],
  work: [
    { id: 'kemi-test-nov', kid: 'k8', type: 'exam', title: 'Kemiprov', subject: 'kemi', date: '2026-11-20', priority: 'high', src: { ref: 'Instuderingsfrågor kapitel 3', page: 2 },
      kps: [KP + 'syra-kanne', KP + 'bas-kanne'],
      teacherQs: [
        { n: '1', q: 'Vilka joner gör en lösning sur?', a: 'vätejoner', not: ['hydroxidjoner', 'kloridjoner', 'natriumjoner'], kps: [KP + 'syra-kanne'], src: { ref: 'Instuderingsfrågor kapitel 3', q: 1 } },
        { n: '2b', q: 'Vilket pH har en neutral lösning?', a: '7', alias: ['pH 7'], typed: true, kps: [KP + 'ph-skalan'], src: { ref: 'Instuderingsfrågor kapitel 3', q: '2b' } },
        { n: '4', q: 'Förklara varför man häller syra i vatten och inte tvärtom.', kps: [KP + 'labbsakerhet'] },   // ingen säker rättning → används inte
        { n: '5<script>', q: 'Vad heter jonen OH⁻? <img src=x onerror=alert(1)>', a: 'hydroxidjon', not: ['vätejon', 'oxidjon'], kps: [KP + 'bas-kanne'], src: { ref: 'x', page: '<b>' } },
      ] },
    { id: 'gammal', kid: 'k8', type: 'exam', title: 'Gammalt prov', subject: 'kemi', date: '2026-09-01', kps: [KP + 'salter'] },
    { id: 'ova-ph', kid: 'k8', type: 'practice', title: 'Öva pH', subject: 'kemi', kps: [KP + 'ph-skalan'] },
    { id: 'okand', kid: 'k99', type: 'exam', title: 'Fel barn', date: '2026-11-01', kps: [KP + 'salter'] },
  ],
};

const w = mkWin({ seed: 2201, fixedClock: true }); const T = tools(w);
setTimeout(() => { try {
  const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); classic(T); PA.rerender(); const D = v2tools(w, T);
  // ---- 1) _content: tvätt och validering
  const cl = PA.FAMILY.cleanContent(CONTENT);
  ok(cl && cl.work.length === 4, 'skoluppgifterna läses (även för okänt barn – men de används aldrig)');
  ok(PA.FAMILY.cleanContent({ v: 2, work: [] }) === null && PA.FAMILY.cleanContent(null) === null, 'okänd version eller tomt → ignoreras');
  const xq = cl.work[0].teacherQs[3]; ok(!/[<>]/.test(xq.n + xq.q) && !(xq.src && xq.src.page), 'lärarfrågornas text tvättas (inga taggar) och ogiltiga källfält tas bort');
  ok(cl.work[0].teacherQs[0].src && cl.work[0].teacherQs[0].src.q === 1 && cl.work[0].src.page === 2, 'källhänvisningen (dokument, sida, frågenummer) följer med');
  ok(JSON.stringify(cl).indexOf('onerror') < 0 || !/<img/.test(JSON.stringify(cl)), 'ingen HTML i skoluppgifterna');
  // privat paket med skadlig HTML: tvättas, eller avvisas om det inte klarar valideringen
  const pub = JSON.parse(JSON.stringify(PA.PACKS.REG.packs['sv2-stava-och-meningar']));
  const priv = { ...pub, id: 'privat-test', title: 'Privat test', skills: pub.skills.map(s => ({ ...s, id: 'pt_' + s.id.slice(4) })), kps: pub.kps.map(k => ({ ...k, id: 'pt-' + k.id, skill: 'pt_' + k.skill.slice(4), requires: undefined })), legacy: [] };
  priv.kps[0] = { ...priv.kps[0], explain: 'Kort vokal <img src=x onerror=alert(1)><script>x()</script><b>två</b> konsonanter.' };
  const clp = PA.FAMILY.cleanContent({ v: 1, updatedAt: 5, packs: [priv], work: [] });
  ok(clp.packs.length === 1 && !/<img|<script|onerror/.test(JSON.stringify(clp.packs[0])) && /<b>två<\/b>/.test(clp.packs[0].kps[0].explain), 'privat paket: farlig HTML tas bort, enkla taggar finns kvar');
  ok(PA.FAMILY.cleanContent({ v: 1, packs: [{ ...priv, kps: [{ id: 'X Y', skill: 'nope' }] }], work: [] }).packs.length === 0, 'privat paket som inte klarar kvalitetsgrinden används inte');
  // ---- 2) Appen läser innehållet
  PA.FAMILY.applyContent(CONTENT); PA.rerender();
  const kid = PA.KIDS.find(k => k.id === 'k8');
  ok(kid.workExams.some(e => e.id === 'w:kemi-test-nov') && kid.workExams.find(e => e.id === 'w:kemi-test-nov').kps.includes(KP + 'ph-skalan'), 'skoluppgiften blir ett prov; lärarfrågornas kunskapspunkter räknas in');
  ok(!PA.KIDS.some(k => (k.workExams || []).some(e => e.id === 'w:okand')), 'uppgift för okänt barn används inte');
  ok(kid.focusCids.includes(KP + 'ph-skalan'), 'övningsuppgift → fokus i Smart Kör!');
  ok(JSON.parse(w.localStorage.getItem('pluggappen.content.v1')).updatedAt === 1001, 'innehållet sparas lokalt (fungerar offline)');
  // ---- 3) Uppdragsrubriken på startsidan
  openKid(T, 'k8');
  const m = PA.V2.mission(kid); ok(m && m.e.id === 'w:kemi-test-nov' && m.d === 26, 'uppdraget = närmaste provet inom 28 dygn (inte det passerade)');
  const go = T.$('.go-btn[data-v2="kor"]'); const goTxt = go ? go.textContent.replace(/\s+/g, ' ').trim() : '';
  // 2.1.1: provrubriken bara när passet har provets områden – och då med andelen ("1 av 3 uppgifter inför provet"); annars vanligt Kör!
  { const sh = PA.V2.missionShare(PA.V2.peekPlan(kid).plan, PA.V2.examCidsActive(kid, m.e));
    ok(sh.n > 0 ? new RegExp(`^KEMIPROV · 20 NOVEMBER\\s*IDAG \\d+ minuter\\s*${sh.n === sh.of ? 'Allt inför provet' : sh.n + ' av ' + sh.of + ' uppgifter inför provet'} · KÖR`).test(goTxt) : /^Kör!?\s*\d+ uppgifter · cirka/.test(goTxt), 'startknappen: KEMIPROV · 20 NOVEMBER / IDAG N minuter / andel inför provet / KÖR – ' + goTxt); }
  ok(!/skuld|missat|ligger efter|\d+ dagar sedan/i.test(T.$('#app').textContent), 'inga skuld- eller eftersläpningstexter');
  ok(T.$('[data-v2="testa"][data-exam="w:kemi-test-nov"]'), 'provkortet med Testa mig finns för skoluppgiften');
  // ---- 4) Testa mig med lärarens frågor
  const tqs = PA.V2.teacherQs(kid, 'w:kemi-test-nov'); ok(tqs.length === 3 && !tqs.some(t => t.n === '4'), 'bara lärarfrågor som kan rättas säkert används (förklara-frågan utan facit utesluts)');
  T.click(T.$('[data-v2="testa"][data-exam="w:kemi-test-nov"]'));
  ok(PA.S && PA.S.v2 && PA.S.v2.exam, 'Testa mig startar');
  const seenT = []; let n = 0, chipOk = 0;
  while (PA.S && PA.S.v2 && T.$('#qcard') && n++ < 30) { const it = PA.S.queue[PA.S.i]; if (it.teacher) { seenT.push(it.teacher.n); if (/LÄRARENS FRÅGA/.test(T.$('#app').textContent)) chipOk++; } D.answer(false); w.__advance(3000); }
  ok(seenT.length >= 2 && new Set(seenT).size === seenT.length, `lärarens frågor i Testa mig, varje en gång (${seenT.join(', ')})`);
  ok(chipOk === seenT.length, 'märkta "LÄRARENS FRÅGA"');
  ok(/Testa mig/.test(T.$('#app').textContent) && !T.$('#app img, #app script, #app [onerror]'), 'resultat visas, ingen injicerad HTML');
  const p = PA.DB.profiles.k8; const last = p.tests[p.tests.length - 1]; ok(last && last.examId === 'w:kemi-test-nov' && last.score === last.total, 'Testa mig: rätt svar rättas som rätt (deterministiskt)');
  ok(p.le.log.filter(e => e[14] === 't').length >= n - 1, 'svaren blir Testa mig-bevis');
  // typat lärarsvar: alias och stavning rättas deterministiskt
  const tq = { n: 'x', q: 'Vilket pH har en neutral lösning?', a: '7', alias: ['pH 7'], typed: true, not: [], kps: [KP + 'ph-skalan'] };
  const qT = PA.PACKS.typed(tq.q, [tq.a, ...tq.alias], '', { pool: tq.not }); ok(PA.PACKS.check(qT, 'pH 7').status === 'correct' && PA.PACKS.check(qT, '8').status !== 'correct', 'eget svar på lärarfråga: alias godkänns, fel svar underkänns');
  // ---- 5) Innehållshälsa: barnets markering
  openKid(T, 'k8'); T.click(T.$('[data-v2="kor"]') || T.$('[data-v2="extra"]'));
  let rep = null; n = 0;
  while (PA.S && PA.S.v2 && T.$('#qcard') && n++ < 40) {
    const it = PA.S.queue[PA.S.i]; const isQ = it.cat === 'math' && (it.choices || ['choicetext', 'num', 'text', 'order'].includes(it.type));
    if (isQ) {
      if (!rep) { // svara och markera
        const before = PA.S.i; if (it.type === 'choicetext' || it.choices) T.click(T.$(`[data-choice="${it.answer}"]`)); else if (it.type === 'order') { it.items.forEach((_, i) => T.click(T.$(`[data-otile="${i}"]`))); T.click(T.$('#submit')); } else { T.$('#ans').value = it.type === 'num' ? String(it.answer) : (it.answer && it.answer[0]) || ''; T.click(T.$('#submit')); }
        if (T.$('#submit') && !T.$('#next') && PA.S.i === before) T.click(T.$('#submit'));
        const b = T.$('[data-v2="qr"]'); ok(b && /Den här frågan är konstig/.test(b.textContent), 'efter svaret: "Den här frågan är konstig"');
        if (b) { T.click(b); rep = it; ok(/Tack!/.test(T.$('#fb').textContent) && !T.$('[data-v2="qr"]'), 'tack-text, knappen försvinner'); }
        T.click(T.$('#next')); w.__advance(3000); continue;
      }
    }
    D.answer(false); w.__advance(3000);
  }
  const qr = p.le.qr || []; ok(qr.length === 1 && /^\d+\|i[0-9a-z]+\|(k|s):/.test(qr[0]), 'markeringen sparar bara dygn|uppgift|kunskapspunkt: ' + qr[0]);
  ok(rep && qr[0].split('|')[1] === PA.V2.iid(rep), 'rätt uppgift markerad');
  ok(!PA.LE2.reportItem(p.le, Number(qr[0].split('|')[0]), qr[0].split('|')[1], qr[0].split('|')[2]), 'samma uppgift samma dygn räknas en gång');
  ok(!PA.LE2.reportItem(p.le, 1, 'i<x>', 'k:a/b') && !PA.LE2.reportItem(p.le, 1, 'iabc', 'fri text här'), 'markering med ogiltiga tecken avvisas (ingen fritext)');
  // markering påverkar inte motorn
  const st1 = PA.LE2.stable(PA.LE.state(kid).L); PA.LE.invalidate('k8'); ok(PA.LE2.stable(PA.LE.state(kid).L) === st1, 'markeringen ändrar inga bevis eller stadier');
  // ---- 6) Synk: union, kommutativ, idempotent, gallring
  const a = { ...p.le, qr: ['20380|iaa|k:x/y', '20381|ibb|k:x/y'] }; const b = { ...p.le, qr: ['20381|ibb|k:x/y', '20382|icc|k:x/z'] };
  const ab = PA.LE2.mergeLE(a, b), ba = PA.LE2.mergeLE(b, a); ok(JSON.stringify(ab.qr) === JSON.stringify(ba.qr) && ab.qr.length === 3, 'två enheters markeringar förenas (kommutativt)');
  ok(JSON.stringify(PA.LE2.mergeLE(ab, ab).qr) === JSON.stringify(ab.qr), 'sammanslagningen är idempotent');
  const many = Array.from({ length: 400 }, (_, i) => `${20000 + i}|i${i.toString(36)}|k:x/y`); const pr = PA.LE2.pruneQr(many); ok(pr.length <= PA.LE2.QR_MAX && pr.every(k => Number(k.split('|')[0]) >= 20399 - PA.LE2.QR_DAYS), 'markeringarna gallras på ålder och antal');
  // ---- 7) Föräldern ser flaggorna (bara i Motor v2)
  ok(!/Innehållshälsa/.test(T.$('#app').textContent), 'barnet ser aldrig flaggorna');
  // syntetiska bevis: en fråga fel varje gång medan resten av punkten går bra → "avviker"; markerad två dygn → "flera gånger"
  const kp0 = KP + 'syra-exempel'; const bad = 'ibadbad1'; let seq = 9000; const t0 = Date.now() - 6 * 86400000;
  const ev = (item, okk, kind, dd) => p.le.log.push(PA.LE2.encodeEv({ t: t0 + dd * 3600000 + seq * 1000, dev: 'syn', seq: ++seq, cid: kp0, ok: okk, kind, k: kind === 'mc' ? 4 : 0, help: 'none', ctx: 'first', item, sess: 'syn:1', lvl: 1 }));
  for (let i = 0; i < 4; i++) ev(bad, false, 'mc', i); for (let i = 0; i < 6; i++) ev('igood' + i, true, i % 2 ? 'free' : 'mc', i);
  p.le.seqs = { ...(p.le.seqs || {}), syn: seq }; const today = Number(qr[0].split('|')[0]); PA.LE2.reportItem(p.le, today - 3, bad, kp0); PA.LE2.reportItem(p.le, today - 1, bad, kp0); PA.LE.invalidate('k8');
  const H = PA.LE.health(kid); const hb = H.items.find(x => x.item === bad);
  ok(hb && hb.flags.includes('reported2') && hb.flags.includes('odd') && hb.flags.includes('hard'), 'flaggor: rapporterad flera gånger, fel nästan varje gång, avviker från resten – ' + (hb && hb.flags));
  ok(H.items[0].item === bad, 'flera gånger rapporterad kommer först');
  ok(H.items.some(x => x.item === qr[0].split('|')[1] && x.flags.includes('reported') && x.text), 'den markerade riktiga frågan syns med sin text');
  const txt = PA.LE.healthText(kid); ok(!/Åttan|k8/.test(txt) && /kemi8-syror-baser\/syra-exempel/.test(txt), 'texten till Claude: innehållets id och signal, inga namn');
  unlockParent(w, T); T.click(T.$('[data-tab="k8"]')); T.click(T.$('[data-sub="v2"]'));
  ok(/Innehållshälsa/.test(T.$('#app').textContent) && /Rapporterad flera gånger/.test(T.$('#app').textContent) && T.$('textarea[readonly]'), 'Motor v2: innehållshälsa med flaggor och text till Claude');
  ok(/Ingenting ändras automatiskt/.test(T.$('#app').textContent), 'föräldern får veta att innehållet aldrig ändras automatiskt');
  // ---- 8) Återkomst efter uppehåll (8 dygn > motorns gräns på 7): lugn start, det viktigaste idag, ingen skuld
  toStart(T); w.__advance(8 * 86400000); openKid(T, 'k8');
  const app = T.$('#app').textContent;
  ok(/Välkommen tillbaka\./.test(app) && /Det här är viktigast idag:/.test(app), 'återkomst: "Välkommen tillbaka." + "Det här är viktigast idag"');
  ok(!/missade|ligger efter|att ta igen|\d+ dagar sedan/i.test(app), 'ingen straffande eftersläpning');
  ok(PA.V2.mission(kid).d === 18, 'uppdraget räknas om automatiskt (18 dygn kvar)');
  // ---- 9) v1-reserven: ingen uppdragsrubrik, ingen markering, inget fel
  setEngine(w, T, 'k8', 'v1'); openKid(T, 'k8'); ok(!/KEMIPROV ·/.test(T.$('#app').textContent) && T.$('[data-rec]'), 'v1: oförändrad startsida');
  setEngine(w, T, 'k8', 'v2');
  ok(PA.LE.errors.length === 0, 'inga fel i v2-lagret: ' + JSON.stringify(PA.LE.errors.slice(-3)));
  PA.flushSave();
  // ---- 10) Rollback till publicerade 2.0.0 med markeringar och skoluppgifter i lagret, och tillbaka
  const qrBefore = JSON.stringify(p.le.qr);
  const wO = mkWin({ seed: 41, fixedClock: true, storage: dump(w), file: OLD }); const TO = tools(wO);
  setTimeout(() => { try {
    TO.PA().FAMILY.apply(FIX); TO.PA().load(); classic(TO); TO.PA().rerender(); wO.__advance(8 * 86400000); openKid(TO, 'k8'); const DO = v2tools(wO, TO);
    TO.click(TO.$('[data-v2="kor"]') || TO.$('[data-v2="extra"]')); DO.run(false); ok(/Bra jobbat|KLART/i.test(TO.$('#app').textContent), '2.0.0: passet fungerar med 2.1-data');
    ok(TO.PA().LE.errors.length === 0, '2.0.0: inga fel'); const pO = TO.PA().DB.profiles.k8; ok(JSON.stringify(pO.le.qr) === qrBefore, '2.0.0 bär markeringarna orörda vidare');
    TO.PA().flushSave();
    const wB = mkWin({ seed: 42, fixedClock: true, storage: dump(wO) }); const TB = tools(wB);
    setTimeout(() => { try {
      TB.PA().FAMILY.apply(FIX); TB.PA().load(); classic(TB); TB.PA().rerender(); wB.__advance(8 * 86400000); openKid(TB, 'k8');
      ok(/KEMIPROV ·/.test(TB.$('#app').textContent), 'tillbaka i 2.1: skoluppgiften finns kvar (lokalt sparat innehåll)');
      ok(TB.PA().LE.health(TB.PA().KIDS.find(k => k.id === 'k8')).items.some(x => x.flags.includes('reported2')), 'tillbaka i 2.1: flaggorna finns kvar');
      ok(TB.PA().LE.errors.length === 0, 'tillbaka i 2.1: inga fel');
    } catch (e) { fails++; console.log('EXC', e.stack); } finish(); }, 50);
  } catch (e) { fails++; console.log('EXC', e.stack); finish(); } }, 50);
} catch (e) { fails++; console.log('EXC', e.stack); finish(); } }, 50);
