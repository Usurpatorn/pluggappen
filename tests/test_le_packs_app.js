/* 2.1 i appen: Concept Packs → kunskapspunkter i motorn, Kör! och Testa mig med paketfrågor, formkod i bevisen, migrering av gamla
   bevis (deterministisk, idempotent, inga borttagna data), v1-reserven och rollback till publicerade 2.0.0 och tillbaka.
   SYNTETISK familj (testfixturen). */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const { mkWin, tools, FIX, rng } = require('./le/childflow.js');
const { v2tools, setEngine, toStart } = require('./le/v2driver.js');
const trnd = rng((Number(process.env.SEED) || 2101) + 1);
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const OLD = path.join(require('os').tmpdir(), 'pluggappen-2.0.0-' + process.pid + '.html');
fs.writeFileSync(OLD, zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'golden/pluggappen-2.0.0.html.gz'))));
const dump = (w) => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
const openKid = (T, id) => { toStart(T); T.click(T.$(`[data-kid="${id}"]`)); if (T.$('[data-pet]')) T.click(T.$('[data-pet]')); };
const finish = () => { try { fs.unlinkSync(OLD); } catch (e) { /* ignore */ } console.log(`\n${checks} kontroller, ${fails} fel`); console.log(fails ? 'LE PACKS APP TEST FAILED' : 'LE PACKS APP TEST OK'); process.exit(fails ? 1 : 0); };
const KP = 'k:kemi8-syror-baser/';

const w = mkWin({ seed: 2101, fixedClock: true }); const T = tools(w);
setTimeout(() => { try {
  T.PA().FAMILY.apply(FIX); T.PA().load(); T.PA().rerender(); const PA = T.PA(); const D = v2tools(w, T);
  const kid = PA.KIDS.find(k => k.id === 'k8');
  // ---- Katalog
  const C0 = PA.LE.state(kid);
  const kpIds = Object.keys(C0.cat).filter(id => id.startsWith(KP));
  ok(kpIds.length >= 15, `åk 8 får kemins kunskapspunkter (${kpIds.length})`);
  ok(C0.cat['s:kemi_syror'] && C0.cat['s:kemi_syror'].active === false && Object.keys(C0.cat['s:kemi_syror'].route || {}).length > 20, 'kemimomentet vilar och leder gamla frågor vidare');
  ok(C0.cat['s:ekvation'] && C0.cat['s:ekvation'].active !== false, 'matte utan paket är oförändrad (moment = koncept)');
  ok(kpIds.every(id => C0.cat[id].depth), 'alla kemipunkter har fördjupande former (djupgrinden gäller)');
  ok(PA.LE.cidsOfSkill(C0, 'kemi_ph').length === 2 && PA.LE.cidsOfSkill(C0, 'ekvation')[0] === 's:ekvation', 'moment → koncept: paketets punkter resp. momentet självt');
  // ---- Migrering av ett gammalt bevis (2.0-format på momentkonceptet) → kunskapspunkt
  const p = PA.DB.profiles.k8; PA.LE.state(kid);
  const old = PA.LECAT.itemId({ type: 'choicetext', text: 'Vilka joner gör en lösning sur?', choices: ['Vätejoner, H⁺', 'x'], answer: 0 });
  const unknown = 'izzzzzz';
  const t0 = Date.now() - 3 * 86400000;
  p.le.log.push(PA.LE2.encodeEv({ t: t0, dev: 'old', seq: 1, cid: 's:kemi_syror', ok: true, kind: 'mc', k: 4, help: 'none', ctx: 'first', item: old, sess: 'old:1', lvl: 1 }));
  p.le.log.push(PA.LE2.encodeEv({ t: t0 + 1000, dev: 'old', seq: 2, cid: 's:kemi_syror', ok: false, kind: 'mc', k: 4, help: 'none', ctx: 'first', item: unknown, sess: 'old:1', lvl: 1 }));
  p.le.seqs = { ...(p.le.seqs || {}), old: 2 };
  PA.LE.invalidate('k8'); const C1 = PA.LE.state(kid);
  ok(C1.L.c[KP + 'syra-kanne'] && C1.L.c[KP + 'syra-kanne'].n === 1 && C1.L.c[KP + 'syra-kanne'].st === 1, 'gammal fråga → rätt kunskapspunkt (stadium 1, inte mer)');
  ok(C1.L.c['s:kemi_syror'] && C1.L.c['s:kemi_syror'].n === 1, 'okänd gammal fråga ligger kvar på momentet (läsbar, ingen gissning)');
  ok(p.le.log.some(e => e[3] === 's:kemi_syror'), 'loggen är orörd – originalets koncept-id finns kvar (rollback)');
  const s1 = PA.LE2.stable(C1.L); PA.LE.invalidate('k8'); const s2 = PA.LE2.stable(PA.LE.state(kid).L);
  ok(s1 === s2, 'migreringen är deterministisk och idempotent (samma tillstånd vid ny omspelning)');
  const inflated = Object.entries(C1.L.c).filter(([id, c]) => id.startsWith(KP) && c.st > 1);
  ok(inflated.length === 0, 'ingen uppblåst kunskap: ett gammalt rätt svar ger högst stadium 1');
  // ---- Kör! med paketfrågor i flera dagar
  openKid(T, 'k8'); const forms = new Set(); let kpItems = 0;
  for (let d = 0; d < 8; d++) {
    T.click(T.$('[data-v2="kor"]') || T.$('[data-v2="extra"]'));
    let n = 0; while (PA.S && PA.S.v2 && T.$('#qcard') && n++ < 60) { const it = PA.S.queue[PA.S.i]; if (it && it.kp) { kpItems++; forms.add(it.form); ok(it.skill && it.text && (it.type !== 'choicetext' || it.choices.length >= 3), 'paketfråga är komplett'); } D.answer((x) => trnd() < 0.25); if (w.__advance) w.__advance(4000); }
    ok(/Bra jobbat|KLART/i.test(T.$('#app').textContent), `dag ${d + 1}: passet avslutas med KLAR`);
    toStart(T); w.__advance(86400000); openKid(T, 'k8');
  }
  ok(kpItems >= 8, `Kör! ställer paketfrågor (${kpItems})`);
  ok(forms.size >= 3, 'flera frågeformer i passen: ' + [...forms].join(', '));
  const evs = p.le.log.filter(e => typeof e[19] === 'string'); ok(evs.length >= 5, `bevisen bär formkod (${evs.length})`);
  ok(evs.every(e => 'rcvlmxaes'.includes(e[19])), 'formkoderna är giltiga');
  ok(PA.LE.errors.length === 0, 'inga fel i v2-lagret: ' + JSON.stringify(PA.LE.errors.slice(-3)));
  // ---- Testa mig (provet i fixturen gäller kemin): kunskapspunkter, ingen hjälp, resultat
  const C2 = PA.LE.state(kid); const card = T.$('[data-v2="testa"][data-exam="kemi4"]'); ok(card, 'provkortet för kemin finns');
  const cardTxt = T.$('#app').textContent; ok(/Syror/.test(cardTxt) && !/Vad som gör en lösning sur/.test(cardTxt), 'provkortet visar moment (Syror), inte enskilda kunskapspunkter');
  if (card) { T.click(card); const plan = PA.S.v2.plan; ok(plan.length > 0 && plan.every(s => s.cid.startsWith(KP)), 'Testa mig prövar kemins kunskapspunkter'); D.run(() => trnd() < 0.3); ok(/Testa mig/.test(T.$('#app').textContent), 'Testa mig ger resultat'); }
  ok(PA.LE.errors.length === 0, 'inga fel efter Testa mig');
  // ---- v1-reserven fungerar med paketen på plats
  setEngine(w, T, 'k8', 'v1'); openKid(T, 'k8'); ok(T.$('[data-rec]') && !T.$('[data-v2="kor"]'), 'v1: barnet får v1-startsidan');
  T.click(T.$('[data-rec]')); T.run(); ok(/Resultat|Klart|Bra|rätt/i.test(T.$('#app').textContent), 'v1: ett pass går att köra');
  T.click(T.$('[data-go="home"]')); T.click(T.$('[data-subj="no"]')); const ks = T.$('[data-skill="kemi_syror"]'); ok(ks, 'v1: kemimomentet finns kvar för manuell övning');
  if (ks) { T.click(ks); T.run(); } setEngine(w, T, 'k8', 'v2');
  PA.LE.invalidate('k8'); const C3 = PA.LE.state(kid); ok(Object.entries(C3.L.c).some(([id, c]) => id.startsWith(KP) && c.n > 0), 'v1-övning på kemin leds till kunskapspunkter i v2');
  PA.flushSave(); const logN = p.le.log.length;
  // ---- Rollback: publicerade 2.0.0 med 2.1-data, och tillbaka
  const wO = mkWin({ seed: 31, fixedClock: true, storage: dump(w), file: OLD }); const TO = tools(wO);
  setTimeout(() => { try {
    ok(/v2\.0\.0/.test(wO.PLUGG_BUILD || ''), '2.0.0 laddad: ' + wO.PLUGG_BUILD);
    TO.PA().FAMILY.apply(FIX); TO.PA().load(); TO.PA().rerender(); openKid(TO, 'k8'); const DO = v2tools(wO, TO);
    ok(TO.$('[data-v2="kor"]'), '2.0.0: v2 fortsätter på 2.1-data');
    TO.click(TO.$('[data-v2="kor"]') || TO.$('[data-v2="extra"]')); DO.run(false); ok(/Bra jobbat|KLART/i.test(TO.$('#app').textContent), '2.0.0: ett pass fungerar');
    const pO = TO.PA().DB.profiles.k8; ok(TO.PA().LE.errors.length === 0, '2.0.0: inga fel med 2.1-data: ' + JSON.stringify(TO.PA().LE.errors.slice(-2)));
    ok(pO.le.log.length >= logN && pO.le.log.some(e => typeof e[19] === 'string'), '2.0.0: 2.1-bevisen ligger kvar orörda');
    TO.PA().flushSave();
    const wB = mkWin({ seed: 32, fixedClock: true, storage: dump(wO) }); const TB = tools(wB);
    setTimeout(() => { try {
      TB.PA().FAMILY.apply(FIX); TB.PA().load(); TB.PA().rerender(); openKid(TB, 'k8'); const DB2 = v2tools(wB, TB);
      TB.click(TB.$('[data-v2="kor"]') || TB.$('[data-v2="extra"]')); DB2.run(false); ok(/Bra jobbat|KLART/i.test(TB.$('#app').textContent), 'tillbaka i 2.1: passet fungerar');
      const Cb = TB.PA().LE.state(TB.PA().KIDS.find(k => k.id === 'k8')); ok(Object.entries(Cb.L.c).some(([id, c]) => id.startsWith(KP) && c.n > 0), 'tillbaka i 2.1: kunskapspunkterna har kvar sina bevis');
      ok(TB.PA().LE.errors.length === 0, 'tillbaka i 2.1: inga fel');
    } catch (e) { fails++; console.log('EXC', e.stack); } finish(); }, 50);
  } catch (e) { fails++; console.log('EXC', e.stack); finish(); } }, 50);
} catch (e) { fails++; console.log('EXC', e.stack); finish(); } }, 50);
