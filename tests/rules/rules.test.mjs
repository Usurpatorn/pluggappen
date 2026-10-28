/* Firestore-reglerna mot Googles egen regelmotor (Firestore-emulatorn) – inte en handskriven spegel.
   Körs i CI (jobbet "Firestore-regler i emulatorn"): firebase emulators:exec --only firestore "node tests/rules/rules.test.mjs"
   Syntetiska familjer och enheter – inga riktiga id:n, koder eller namn.
   - FAM_LONG (≥ 6 tecken): övergångsvägen (legacyGrace) är öppen fram till 2026-11-09 – emulatorn använder verklig tid.
   - FAM_SHORT (< 6 tecken): övergångsvägen gäller aldrig – motsvarar läget efter 2026-11-09.
   RULES_FILE väljer regelfil (standard firestore.rules). EXPECT anger vilka kända hål den filen har, så att samma fall visar i den
   riktiga motorn vad varje ändring stänger:
   - EXPECT=v20: reglerna i 2.0.0 – alla medlemmar och övergångsvägen kunde både läsa och skriva _content.
   - EXPECT=v21: reglerna i 2.1.0 (release-kontrollen) – skrivning stängd, men övergångsvägen kunde fortfarande LÄSA _content.
   - (inget): nuvarande regler – inga kända hål för _content. */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { readFileSync, appendFileSync } from 'node:fs';

const RULES_FILE = process.env.RULES_FILE || 'firestore.rules';
const MODE = process.env.EXPECT || 'new'; const OLD = MODE !== 'new';
const readHole = (fam) => MODE !== 'new' && fam === FAM_LONG;      // v20 + v21: övergångsvägen läser _content
const writeHole = MODE === 'v20';                                     // v20: medlemmar skriver _content
const FAM_LONG = 'famsynthetic01', FAM_SHORT = 'fam1', FAM_OTHER = 'famother002';
const CODE = 'synthetic-join-code-001';
// Ett fel som stoppar testet (t.ex. regler som inte kompilerar) syns som en anteckning i CI – inte bara som "exit code 1"
const die = (e) => { const m = String(e && (e.stack || e.message) || e).replace(/\s+/g, ' ').slice(0, 900); console.error(m); if (process.env.GITHUB_ACTIONS) console.log(`::error title=Firestore-regler (${process.env.EXPECT || 'new'}) stoppade::${m}`); process.exit(1); };
process.on('unhandledRejection', die); process.on('uncaughtException', die);
const env = await initializeTestEnvironment({ projectId: 'demo-pluggappen', firestore: { rules: readFileSync(RULES_FILE, 'utf8'), host: '127.0.0.1', port: 8080 } });

const results = []; let fails = 0;
async function check(name, expectOk, fn) {
  let ok;
  try { await (expectOk ? assertSucceeds(fn()) : assertFails(fn())); ok = true; } catch (e) { ok = false; }
  if (!ok) fails++;
  results.push(`${ok ? 'ok  ' : 'FAIL'} ${name} (förväntat: ${expectOk ? 'tillåtet' : 'nekat'})`);
}
const profile = (json = '{"xp":1}') => ({ json, updatedAt: Date.now(), kid: 'k1' });
const content = (tag) => ({ json: JSON.stringify({ v: 1, packs: [], work: [{ id: tag, kid: 'k1', type: 'exam', title: 'syntetiskt prov' }] }), updatedAt: Date.now() });

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const fam of [FAM_LONG, FAM_SHORT, FAM_OTHER]) {
      await setDoc(doc(db, `families/${fam}/meta/info`), { joinCode: CODE, createdAt: 1 });
      await setDoc(doc(db, `families/${fam}/profiles/_content`), content('original'));
      await setDoc(doc(db, `families/${fam}/profiles/k1`), profile());
    }
    for (const fam of [FAM_LONG, FAM_SHORT]) {
      await setDoc(doc(db, `families/${fam}/members/kidDevice`), { role: 'kid', device: 'barnets platta', joinedAt: 1 });
      await setDoc(doc(db, `families/${fam}/members/parentDevice`), { role: 'parent', device: 'förälderns telefon', joinedAt: 1 });
    }
    await setDoc(doc(db, `families/${FAM_OTHER}/members/otherFamilyDevice`), { role: 'parent', device: 'annan familj', joinedAt: 1 });
  });
}
// En Firestore-instans per identitet (en batch får bara innehålla referenser från sin egen instans).
const DBS = {}; const as = (uid) => DBS[uid || '-'] || (DBS[uid || '-'] = (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore());
// withSecurityRulesDisabled returnerar inget värde – läs därför in i en variabel.
async function adminRead(path) { let data = null; await env.withSecurityRulesDisabled(async (ctx) => { const s = await getDoc(doc(ctx.firestore(), path)); data = s.exists() ? s.data() : null; }); return data; }

await seed();
for (const fam of [FAM_SHORT, FAM_LONG]) {
  const label = fam === FAM_LONG ? 'familj med övergångsväg öppen' : 'familj utan övergångsväg';
  const C = `families/${fam}/profiles/_content`;
  // --- läsa privat innehåll
  await check(`[${label}] oinloggad kan inte läsa _content`, readHole(fam), () => getDoc(doc(as(null), C)));
  await check(`[${label}] inloggad icke-medlem kan inte läsa _content`, readHole(fam), () => getDoc(doc(as('stranger'), C)));
  await check(`[${label}] medlem i en annan familj kan inte läsa _content`, readHole(fam), () => getDoc(doc(as('otherFamilyDevice'), C)));
  await check(`[${label}] familjens medlem (barnenhet) kan läsa _content`, true, () => getDoc(doc(as('kidDevice'), C)));
  await check(`[${label}] familjens medlem (förälder) kan läsa _content`, true, () => getDoc(doc(as('parentDevice'), C)));
  // --- skriva privat innehåll
  await check(`[${label}] barnenhet kan inte ändra _content`, writeHole, () => updateDoc(doc(as('kidDevice'), C), content('falskt')));
  await check(`[${label}] barnenhet kan inte skriva över _content med set`, writeHole, () => setDoc(doc(as('kidDevice'), C), content('falskt')));
  await check(`[${label}] förälderenhet kan inte ändra _content`, writeHole, () => updateDoc(doc(as('parentDevice'), C), content('falskt')));
  await check(`[${label}] förälderenhet kan inte skriva över _content med set`, writeHole, () => setDoc(doc(as('parentDevice'), C), content('falskt')));
  await check(`[${label}] övergångsvägen (oinloggad) kan inte skriva _content`, writeHole && fam === FAM_LONG, () => setDoc(doc(as(null), C), content('falskt')));
  await check(`[${label}] medlem i en annan familj kan inte skriva _content`, writeHole && fam === FAM_LONG, () => setDoc(doc(as('otherFamilyDevice'), C), content('falskt')));
  // --- indirekt: en batch med en vanlig profil + _content nekas helt; vanliga profilskrivningar rör inte _content
  await check(`[${label}] batch (profil + _content) nekas i sin helhet`, writeHole, () => { const b = writeBatch(as('kidDevice')); b.set(doc(as('kidDevice'), `families/${fam}/profiles/k1`), profile('{"xp":2}')); b.set(doc(as('kidDevice'), C), content('falskt')); return b.commit(); });
  await check(`[${label}] kontroll: batch med bara en vanlig profil tillåts`, true, () => { const b = writeBatch(as('kidDevice')); b.set(doc(as('kidDevice'), `families/${fam}/profiles/k1`), profile('{"xp":5}')); return b.commit(); });
  await check(`[${label}] underdokument under _content nekas`, false, () => setDoc(doc(as('kidDevice'), `${C}/rev/1`), content('falskt')));
  await check(`[${label}] framtida revisionssamling nekas för appklienter`, false, () => setDoc(doc(as('parentDevice'), `families/${fam}/content_rev/r1`), content('falskt')));
  // --- vanlig profilsynk fungerar som förut
  await check(`[${label}] medlem kan synka en profil`, true, () => setDoc(doc(as('kidDevice'), `families/${fam}/profiles/k1`), profile('{"xp":3}')));
  await check(`[${label}] profil med otillåtna fält nekas`, false, () => setDoc(doc(as('kidDevice'), `families/${fam}/profiles/k1`), { ...profile(), extra: 1 }));
  await check(`[${label}] icke-medlem kan bara synka en profil under övergången (avsiktligt till 2026-11-09)`, fam === FAM_LONG, () => setDoc(doc(as('stranger'), `families/${fam}/profiles/k1`), profile('{"xp":4}')));
  // --- _content är orört efter alla nekade skrivförsök
  if (!writeHole) { const cur = await adminRead(C);
    results.push(`${cur && cur.json.includes('original') ? 'ok  ' : 'FAIL'} [${label}] _content har kvar originalinnehållet efter försöken`); if (!(cur && cur.json.includes('original'))) fails++; }
  // --- radering
  await check(`[${label}] barnenhet kan inte radera _content`, false, () => deleteDoc(doc(as('kidDevice'), C)));
  await check(`[${label}] oinloggad kan inte radera _content`, false, () => deleteDoc(doc(as(null), C)));
  await check(`[${label}] förälder kan radera _content (radera familjens data)`, true, () => deleteDoc(doc(as('parentDevice'), C)));
}
await seed();
await check('känd begränsning (dokumenteras, inte stängd i 2.1): enhet med koden kan själv registrera sig som förälder', true,
  () => setDoc(doc(as('newDevice'), `families/${FAM_SHORT}/members/newDevice`), { role: 'parent', device: 'ny enhet', joinedAt: 2, code: CODE }));
await check('känd begränsning: barnenhet kan skriva ett syskons profil', true, () => setDoc(doc(as('kidDevice'), `families/${FAM_SHORT}/profiles/k2`), profile()));
await check('enhet utan rätt kod kan inte gå med', false, () => setDoc(doc(as('intruder'), `families/${FAM_SHORT}/members/intruder`), { role: 'kid', device: 'x', joinedAt: 2, code: 'fel-kod' }));

// 3.5 privata bilder: families/{fam}/assets/{rev} – bara familjens medlemmar läser, ingen appklient skriver. Syntetisk bild (inte en riktig).
if (!OLD) {
  await seed();
  const REV = 'a'.repeat(64), REV2 = 'b'.repeat(64); const asset = { b64: 'iVBORw0KGgo=', mime: 'image/png', bytes: 8, w: 1, h: 1 };
  await env.withSecurityRulesDisabled(async (ctx) => { const db = ctx.firestore(); for (const fam of [FAM_SHORT, FAM_LONG, FAM_OTHER]) await setDoc(doc(db, `families/${fam}/assets/${REV}`), asset); });   // en instans per kontext
  for (const fam of [FAM_SHORT, FAM_LONG]) {
    const A = `families/${fam}/assets/${REV}`; const label = fam === FAM_LONG ? 'familj med övergångsväg öppen' : 'familj utan övergångsväg';
    await check(`[${label}] oinloggad kan inte läsa en privat bild (inte heller via övergångsvägen)`, false, () => getDoc(doc(as(null), A)));
    await check(`[${label}] inloggad icke-medlem kan inte läsa en privat bild`, false, () => getDoc(doc(as('stranger'), A)));
    await check(`[${label}] en annan familjs enhet kan inte läsa den här familjens bild`, false, () => getDoc(doc(as('otherFamilyDevice'), A)));
    await check(`[${label}] barnets enhet (medlem) läser familjens bild`, true, () => getDoc(doc(as('kidDevice'), A)));
    await check(`[${label}] förälderns enhet (medlem) läser familjens bild`, true, () => getDoc(doc(as('parentDevice'), A)));
    await check(`[${label}] en medlem kan inte skriva en bild`, false, () => setDoc(doc(as('parentDevice'), `families/${fam}/assets/${REV2}`), asset));
    await check(`[${label}] en medlem kan inte skriva över en bild`, false, () => setDoc(doc(as('kidDevice'), A), { ...asset, b64: 'AAAA' }));
    await check(`[${label}] en förälder kan inte radera en bild (rollback kan behöva den)`, false, () => deleteDoc(doc(as('parentDevice'), A)));
    await check(`[${label}] ett dokument-id som inte är en sha256 läses inte`, false, () => getDoc(doc(as('kidDevice'), `families/${fam}/assets/inte-en-hash`)));
  }
  await check('den andra familjens enhet läser sin egen bild', true, () => getDoc(doc(as('otherFamilyDevice'), `families/${FAM_OTHER}/assets/${REV}`)));
  await check('den andra familjens enhet kan inte läsa en bild i en familj där den inte är medlem', false, () => getDoc(doc(as('otherFamilyDevice'), `families/${FAM_SHORT}/assets/${REV}`)));
}
// 3.7 observationer: families/{fam}/obs/{pseudonym-enhet-nr} – medlemmar skapar/läser/raderar, ingen ändrar; syntetiska satser
if (!OLD) {
  const K = 'p' + 'a1'.repeat(6), ID = `${K}-abcd1234-1`, ID2 = `${K}-abcd1234-2`; const batch = (n = 1) => ({ json: JSON.stringify([{ i: 'abcd1234-1', y: 'ss', t: 1, k: K }]), n, t: Date.now(), k: K, v: 1 });
  for (const fam of [FAM_SHORT, FAM_LONG]) {
    const label = fam === FAM_LONG ? 'familj med övergångsväg öppen' : 'familj utan övergångsväg'; const P = (id) => `families/${fam}/obs/${id}`;
    await check(`[${label}] oinloggad kan inte skapa en observationssats (inte heller via övergångsvägen)`, false, () => setDoc(doc(as(null), P(ID)), batch()));
    await check(`[${label}] inloggad icke-medlem kan inte skapa en observationssats`, false, () => setDoc(doc(as('stranger'), P(ID)), batch()));
    await check(`[${label}] barnets enhet (medlem) skapar en observationssats`, true, () => setDoc(doc(as('kidDevice'), P(ID)), batch()));
    await check(`[${label}] en medlem kan inte ändra en sats (oföränderlig)`, false, () => setDoc(doc(as('kidDevice'), P(ID)), batch(2)));
    await check(`[${label}] förälderns enhet läser satsen`, true, () => getDoc(doc(as('parentDevice'), P(ID))));
    await check(`[${label}] oinloggad kan inte läsa satsen`, false, () => getDoc(doc(as(null), P(ID))));
    await check(`[${label}] en annan familjs enhet kan inte läsa satsen`, false, () => getDoc(doc(as('otherFamilyDevice'), P(ID))));
    await check(`[${label}] en annan familjs enhet kan inte radera satsen`, false, () => deleteDoc(doc(as('otherFamilyDevice'), P(ID))));
    await check(`[${label}] fel dokument-id nekas`, false, () => setDoc(doc(as('kidDevice'), P('fel-id')), batch()));
    await check(`[${label}] okänt fält nekas`, false, () => setDoc(doc(as('kidDevice'), P(ID2)), { ...batch(), namn: 'x' }));
    await check(`[${label}] pseudonymen i id:t måste stämma med fältet k`, false, () => setDoc(doc(as('kidDevice'), P(ID2)), { ...batch(), k: 'p' + 'b2'.repeat(6) }));
    await check(`[${label}] för stor sats nekas`, false, () => setDoc(doc(as('kidDevice'), P(ID2)), { ...batch(), json: 'x'.repeat(150001) }));
    await check(`[${label}] för många händelser nekas`, false, () => setDoc(doc(as('kidDevice'), P(ID2)), batch(401)));
    await check(`[${label}] en medlem raderar satsen (lagringstid och radering)`, true, () => deleteDoc(doc(as('parentDevice'), P(ID))));
  }
}
await env.cleanup();
const head = `Firestore-regler i emulatorn (${RULES_FILE}${OLD ? ', förväntar kända hål i ' + MODE : ''}): ${results.length - fails} av ${results.length} som förväntat`;
console.log(head); for (const r of results) console.log('  ' + r);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${head}\n\n${results.map(r => '- ' + r).join('\n')}\n\n`);
if (process.env.GITHUB_ACTIONS) console.log(`::${fails ? 'error' : 'notice'} title=Firestore-regler (${MODE})::${head}${fails ? ' | ' + results.filter(r => r.startsWith('FAIL')).join(' | ').slice(0, 900) : ''}`);
process.exit(fails ? 1 : 0);
