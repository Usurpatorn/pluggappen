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

await env.cleanup();
const head = `Firestore-regler i emulatorn (${RULES_FILE}${OLD ? ', förväntar kända hål i ' + MODE : ''}): ${results.length - fails} av ${results.length} som förväntat`;
console.log(head); for (const r of results) console.log('  ' + r);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${head}\n\n${results.map(r => '- ' + r).join('\n')}\n\n`);
if (process.env.GITHUB_ACTIONS) console.log(`::${fails ? 'error' : 'notice'} title=Firestore-regler (${MODE})::${head}${fails ? ' | ' + results.filter(r => r.startsWith('FAIL')).join(' | ').slice(0, 900) : ''}`);
process.exit(fails ? 1 : 0);
