/* 2.1I: regressionstester för fynden i den oberoende kodgranskningen av 2.1. SYNTETISK familj (testfixturen), påhittat innehåll.
   H1 XSS via privata paket · H2 Felboken på ett vilande moment · H3 kompaktering + rollback · H4 privat innehåll efter familjebyte/radering
   M5 privat paket med inbyggt id · M6 upprepade djupmissar · M7 borttagna koncept som last · L8 cache · L9 robusthet. */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const { mkWin, tools, FIX } = require('./le/childflow.js');
const { v2tools, toStart } = require('./le/v2driver.js');
const E = require('../src/05b_engine2.js');
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const DAY = 86400000;
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };

// ---- M6 + M7: rena motorregler
{
  const pol = E.POLICIES.older; const cat = { 'k:a/b': { id: 'k:a/b', kind: 'kp', subject: 'no', maxLvl: 3, recall: false, depth: true } };
  const L = E.newLE(); let t = Date.UTC(2026, 9, 1, 10); let seq = 0;
  const ev = (tt, okk, form) => ({ t: tt, dev: 'd', seq: ++seq, cid: 'k:a/b', ok: okk, kind: 'mc', k: 4, help: 'none', ctx: 'first', item: 'i' + seq, sess: 'd:' + seq, lvl: 1, form });
  for (const g of [0, 1, 2, 4, 8, 16, 30]) { t += g * DAY; E.apply(L, cat, ev(t, true, 'm'), pol); }
  const c = L.c['k:a/b']; ok(c.st >= 4 && E.depthOk(c), `uppbyggnad: stadium ${c.st}, djup ${c.dp}`);
  const st0 = c.st; for (let d = 0; d < 5; d++) { t += 3 * DAY; E.apply(L, cat, ev(t, false, 'm'), pol); }
  ok(c.st === st0, 'djupmissar räknas fortfarande inte som glömt (inget stadiefall)');
  ok(!E.depthOk(c), `M6: upprepade djupmissar tar bort "Säker" (djup ${c.dp})`);
  const I = E.insights(L, cat, t + DAY, pol); ok(!I.strengths.includes('k:a/b'), 'M6: föräldern ser inte punkten som styrka');
  const L2 = E.newLE(); E.apply(L2, { 'k:x/y': { id: 'k:x/y', kind: 'kp', subject: 'no', maxLvl: 3 } }, { t, dev: 'd', seq: 1, cid: 'k:x/y', ok: true, kind: 'mc', k: 4, help: 'none', ctx: 'first', item: 'i1', sess: 's1', lvl: 1 }, pol);
  ok(E.learningLoad(L2, {}, t) === 0 && E.learningLoad(L2, { 'k:x/y': { id: 'k:x/y', kind: 'kp' } }, t) === 1, 'M7: ett koncept som inte längre finns i katalogen räknas inte som inlärningslast');
  // L9: markeringar från en enhet med fel klocka
  const le = { qr: [] }; ok(E.reportItem(le, 20750, 'iabc', 'k:a/b') && !E.reportItem(le, 20800, 'idef', 'k:a/b') === false, 'markering sparas');
  ok(E.pruneQr(['20750|ia|k:a/b', '29000|ib|k:a/b'], 20750).length === 1, 'L9: en markering långt fram i tiden (fel klocka) tas bort när dygnet är känt');
}

const w = mkWin({ seed: 2121, fixedClock: true }); const T = tools(w);
setTimeout(() => { try {
  const PA = T.PA(); PA.FAMILY.apply(FIX); PA.load(); PA.rerender(); const D = v2tools(w, T); const LE2 = PA.LE2;
  const kid = PA.KIDS.find(k => k.id === 'k8'); const p = PA.DB.profiles.k8;
  // ---- H1: XSS genom privata paket (otäckta taggar, ikon och metodsida)
  const pub = JSON.parse(JSON.stringify(PA.PACKS.REG.packs['sv2-stava-och-meningar']));
  const evil = { ...pub, id: 'privat-xss', title: 'X', templates: ['ak8'], policies: ['older'], legacy: [],
    skills: pub.skills.map((s, i) => ({ ...s, id: 'px_' + i, name: 'Namn<img src=x onerror=window.__pwn=1 ', short: 'K<svg onload=window.__pwn=2 ', icon: '<img src=x onerror=window.__pwn=3 ', read: '<p>Läs</p><svg onload=window.__pwn=4 <b>fet</b>' })),
    kps: pub.kps.map(k => ({ ...k, id: 'px-' + k.id, skill: 'px_' + pub.skills.findIndex(s => s.id === k.skill), requires: undefined, explain: 'Förklaring <img src=x onerror=window.__pwn=5 ' })) };
  PA.FAMILY.applyContent({ v: 1, updatedAt: 7, packs: [evil], work: [] });
  const k8 = PA.KIDS.find(k => k.id === 'k8'); ok(k8.v2skills.some(s => s.id === 'px_0'), 'det privata paketet används (efter tvätt)');
  ok(!/<img|<svg/i.test(JSON.stringify(PA.PACKS.REG.packs['privat-xss'])), 'H1: inga img/svg-taggar kvar efter tvätt (även otäckta)');
  openKid(T, 'k8'); const subj = T.$('[data-subj="sv"]'); if (subj) T.click(subj);
  ok(!w.document.querySelector('#app img[onerror], #app svg[onload], #app [onerror], #app [onload]'), 'H1: startsidan har inga injicerade element');
  const sk = T.$('[data-method="px_0"]') || T.$('[data-read="px_0"]'); if (sk) T.click(sk);
  ok(!w.document.querySelector('#app [onerror], #app [onload]') && !w.__pwn, 'H1: inget skript körs');
  PA.FAMILY.applyContent({ v: 1, updatedAt: 8, packs: [], work: [] });
  // ---- M5: privat paket med ett inbyggt pakets id
  const dupe = { ...JSON.parse(JSON.stringify(PA.PACKS.REG.packs['kemi8-syror-baser'])), rev: 99 };
  const cl = PA.FAMILY.cleanContent({ v: 1, updatedAt: 9, packs: [dupe], work: [] }); ok(cl.packs.length === 0, 'M5: ett privat paket med inbyggt id avvisas');
  ok(!PA.PACKS.register(dupe, { private: true }) && PA.PACKS.REG.packs['kemi8-syror-baser'].rev !== 99, 'M5: registret vägrar också');
  PA.PACKS.clearPrivate(); ok(PA.PACKS.REG.packs['kemi8-syror-baser'] && Object.keys(PA.PACKS.REG.kp).some(c => c.startsWith('k:kemi8')), 'M5: det inbyggda paketet finns kvar');
  // ---- L9: trasiga poster stoppar inte resten; lärarfrågans felalternativ får inte vara facit
  const cl2 = PA.FAMILY.cleanContent({ v: 1, updatedAt: 10, packs: [null, 5], work: [null, { id: 'ok1', kid: 'k8', type: 'exam', title: 'Prov', date: '2026-11-20', kps: [], teacherQs: [null, { n: '1', q: 'Fråga?', a: 'Svar', not: ['svar', 'Fel1'], kps: ['k:kemi8-syror-baser/salter'] }] }] });
  ok(cl2 && cl2.work.length === 1 && cl2.work[0].teacherQs.length === 1, 'L9: null-poster hoppas över, resten används');
  ok(cl2.work[0].teacherQs[0].not.length === 1, 'L9: ett felalternativ som är lika med facit tas bort (frågan blir då inte flerval)');
  // ---- H4: privat innehåll hör till en familj
  PA.FAMILY.applyContent({ v: 1, updatedAt: 11, packs: [], work: [{ id: 'x1', kid: 'k8', type: 'exam', title: 'Prov', date: '2026-11-20', kps: ['k:kemi8-syror-baser/salter'] }] });
  ok(JSON.parse(w.localStorage.getItem('pluggappen.content.v1')).fam === String(PA.DB.settings.family || ''), 'H4: den lokala kopian märks med familjen');
  PA.DB.settings.family = 'annanfamilj'; PA.FAMILY.loadContentLocal();
  ok(PA.FAMILY.content === null && !w.localStorage.getItem('pluggappen.content.v1') && !PA.KIDS.some(k => (k.workExams || []).length), 'H4: en annan familj på enheten får aldrig se innehållet');
  PA.DB.settings.family = ''; PA.FAMILY.applyContent({ v: 1, updatedAt: 12, packs: [], work: [] }); PA.FAMILY.clearContent();
  ok(PA.FAMILY.content === null && !w.localStorage.getItem('pluggappen.content.v1'), 'H4: radering tar bort innehållet');
  // ---- H2: Felboken på ett vilande moment (från 2.0) kan lösas med Revansch
  PA.LE.state(kid); const C = PA.LE.state(kid); const route = C.cat['s:kemi_syror'].route;
  const D0 = Date.now() - 6 * DAY; const ENC = (t, seq, okk, item) => LE2.encodeEv({ t, dev: 'old', seq, cid: 's:kemi_syror', ok: okk, kind: 'mc', k: 4, help: 'none', ctx: 'first', item, sess: 'old:' + seq, lvl: 1 });
  p.le.log.push(ENC(D0, 1, true, 'iunknown1'), ENC(D0 + 3 * DAY, 2, false, 'iunknown2')); p.le.seqs = { ...(p.le.seqs || {}), old: 2 };
  PA.LE.invalidate('k8'); let L = PA.LE.state(kid).L; ok(L.c['s:kemi_syror'].fb && L.c['s:kemi_syror'].fb.s === 'open' && !route.iunknown2, 'H2: en Felboks-post på det vilande momentet (okänd gammal fråga)');
  let solved = false;
  for (let d = 0; d < 8 && !solved; d++) {
    w.__advance(DAY); openKid(T, 'k8'); if (T.$('[data-v2="felbok"]')) T.click(T.$('[data-v2="felbok"]'));
    const rb = T.$('[data-v2="revansch"]'); if (rb) { T.click(rb); let n = 0; while (PA.S && PA.S.v2 && T.$('#qcard') && n++ < 30) { D.answer(false); w.__advance(4000); } }
    PA.LE.invalidate('k8'); L = PA.LE.state(kid).L; const s = L.c['s:kemi_syror'].fb && L.c['s:kemi_syror'].fb.s; solved = !s || s === 'resolved' || s === 'verified';
    toStart(T);
  }
  ok(solved, 'H2: Revansch löser Felboks-posten på det vilande momentet: ' + JSON.stringify(L.c['s:kemi_syror'].fb));
  ok(PA.LE.errors.length === 0, 'inga fel i v2-lagret: ' + JSON.stringify(PA.LE.errors.slice(-2)));
  // ---- H3: kompaktering bakar inte in bevis på vilande moment i onödan (rollback till 2.0 tappar inget)
  const cat21 = PA.LE.state(kid).cat; const polO = PA.LE.state(kid).pol;
  const cat20 = JSON.parse(JSON.stringify(cat21)); for (const id of Object.keys(cat20)) { if (id.startsWith('k:')) delete cat20[id]; else { delete cat20[id].route; if (cat20[id].active === false) delete cat20[id].active; } }
  const items = Object.keys(cat21['s:kemi_syror'].route).slice(0, 6); const now = Date.now(); const log = []; let seq = 0;
  const KD = new Set([100, 99, 97, 93, 85, 69, 40]);
  for (let d = 100; d >= 1; d--) for (let j = 0; j < 4; j++) { seq++; const kemi = j === 0 && KD.has(d); log.push(LE2.encodeEv({ t: now - d * DAY + j * 60000, dev: 'd20', seq, cid: kemi ? 's:kemi_syror' : 's:ekvation', ok: true, kind: 'free', k: 0, help: 'none', ctx: 'first', item: kemi ? items.at(d % items.length) : 'ie' + (seq % 7), sess: 'd20:' + d, lvl: 1 })); }
  const le = { v: 2, base: LE2.newLE(), t0: 0, folded: 0, log: log.slice(), seqs: { d20: seq }, shadow: [] };
  const A = LE2.replay(le.log, cat20, polO, le.base); const le21 = JSON.parse(JSON.stringify(le)); LE2.compact(le21, cat21, polO, now);
  const B = LE2.replay(le21.log, cat20, polO, le21.base); const sk20 = (X) => { const c = X.c['s:kemi_syror'] || {}; return `${c.st}/${c.n}`; };
  ok(sk20(A) === sk20(B), `H3: 2.0 ser samma kemibevis före och efter 2.1:s kompaktering (${sk20(A)} / ${sk20(B)})`);
  ok(le21.log.every(e => e[0] * 1000 > (le21.t0 || 0)), 'H3: basens tidsgräns ligger före alla bevis i loggen (2.0:s sammanslagning kastar inget)');
  ok(le21.log.length <= LE2.LOG_HARD_PIN, 'H3: loggen har fortfarande ett tak');
  // över taket: allt bakas in som förut (dokumenterad gräns), utan fel
  const big = { ...JSON.parse(JSON.stringify(le)), log: [...log, ...Array.from({ length: 600 }, (_, i) => LE2.encodeEv({ t: now - 2 * DAY + i * 1000, dev: 'd21', seq: i + 1, cid: 's:ekvation', ok: true, kind: 'free', k: 0, help: 'none', ctx: 'first', item: 'ix' + (i % 9), sess: 'd21:' + Math.floor(i / 10), lvl: 1 }))] };
  ok(LE2.compact(big, cat21, polO, now) && big.log.length <= LE2.LOG_HARD_PIN, 'H3: över taket kompakteras loggen ändå');
  // ---- L8: cache – samma frågeindex återanvänds per barn och policy
  const t1 = Date.now(); for (let i = 0; i < 6; i++) PA.PACKS.findItem('izzz', ['older', 'middle', 'younger'][i % 3], PA.LECAT.itemId, PA.KIDS[i % PA.KIDS.length]);
  ok(Date.now() - t1 < 2000, 'L8: frågeindexet byggs inte om för varje barn');
} catch (e) { fails++; console.log('EXC', e.stack); }
  console.log(`${checks} kontroller, ${fails} fel`); console.log(fails ? 'REVIEW 2.1 TEST FAILED' : 'REVIEW 2.1 TEST OK'); process.exit(fails ? 1 : 0);
}, 50);
