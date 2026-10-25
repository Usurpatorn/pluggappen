/* Kvalitetsgrind för Concept Packs (2.1). Körs i CI för varje inbyggt paket (content/packs/*.json) och kan köras för familjens
   privata paket: node tests/test_packs.js --dir <mapp>. Ett fel i en faktafråga lärs in hållbart – därför är grinden sträng:
   - schema, referenser, källor (provenance) och stabila id:n (content/ids.lock.json)
   - VARJE variant byggs med flera slumpfrön och kontrolleras: unika alternativ, rätt svar inte bland felalternativen, alias inte bland
     felalternativen, inget felalternativ som en annan variant med samma fråga räknar som rätt (tvetydighet), deterministisk rättning
     (rätt svar → rätt, varje fel → fel, egna svar: alias godkänns, felalternativ underkänns), textlängd efter åldersprofil, tillåten HTML
   - variation per kunskapspunkt (olika frågor, olika former, eget svar eller djupform) – svagt innehåll rapporteras uttryckligen
   - migrering: varje fråga i den gamla v1-banken för ett moment med paket leds till en kunskapspunkt
   - uppläsning: läsförståelse (text att läsa) får aldrig läsas upp */
'use strict';
process.env.TZ = 'Europe/Stockholm';
const fs = require('fs'); const path = require('path');
global.LECAT = require('../src/05a_concepts.js');
const PACKS = require('../src/05d_packs.js'); global.PACKS = PACKS;
const args = process.argv.slice(2); const dirArg = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : null; const priv = !!dirArg;
const DIR = dirArg ? path.resolve(dirArg) : path.join(__dirname, '..', 'content', 'packs');
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
let fails = 0, checks = 0; const weak = []; const fail = (m) => { fails++; if (fails <= 60) console.log('FAIL', m); }; const ok = (c, m) => { checks++; if (!c) fail(m); };
const TPL_POL = { ak2: 'younger', ak4: 'middle', ak8: 'older' };
const packs = [];
for (const f of files) {
  let pk; try { pk = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { fail(`${f}: ogiltig JSON: ${e.message}`); continue; }
  const errs = PACKS.validate(pk, { private: priv }); for (const e of errs) fail(`${f}: ${e}`); checks++;
  ok(f === pk.id + '.json', `${f}: filnamnet ska vara <id>.json`);
  for (const t of pk.templates || []) ok((pk.policies || []).includes(TPL_POL[t]), `${pk.id}: mall ${t} kräver policy ${TPL_POL[t]}`);
  if (!errs.length) { PACKS.register(priv ? PACKS.cleanPack(pk) : pk, { private: priv }); packs.push(pk); }
}
ok(new Set(packs.map(p => p.id)).size === packs.length, 'paket-id:n är unika');
// Moment-id:n får inte krocka mellan paket (ett moment hör till ett paket)
{ const seen = {}; for (const p of packs) for (const s of p.skills) { ok(!seen[s.id] || seen[s.id] === p.id, `moment ${s.id} finns i både ${seen[s.id]} och ${p.id}`); seen[s.id] = p.id; } }

const { strip, normT } = PACKS; const norm = PACKS.key;
const tagOk = (h) => { const bad = String(h || '').match(/<\/?([a-z0-9]+)[^>]*>/gi) || []; return bad.every(t => PACKS.ALLOWED_TAGS.test(t.replace(/^<\/?/, '').replace(/[\s>].*$/, '')) && !/\son\w+=|javascript:/i.test(t)); };
const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const checkQ = (q, ctx, pol, correctByText) => {
  ok(q && q.text && strip(q.text).trim(), `${ctx}: frågetext saknas`); if (!q) return;
  ok(['choicetext', 'text', 'num', 'order'].includes(q.type), `${ctx}: okänd typ ${q.type}`);
  ok(tagOk(q.text) && (q.steps || []).every(tagOk) && tagOk(q.fig), `${ctx}: otillåten HTML`);
  ok((q.steps || []).some(s => strip(s).trim()), `${ctx}: förklaring saknas`);
  ok(q.hint, `${ctx}: ledtråd saknas`);
  const lim = PACKS.TEXT[pol];
  ok(PACKS.words(q.text).length <= lim.qWords, `${ctx}: frågan har ${PACKS.words(q.text).length} ord (max ${lim.qWords} för ${pol})`);
  if (pol === 'younger') ok(PACKS.words(q.text).every(w => w.replace(/[^\p{L}]/gu, '').length <= lim.word), `${ctx}: för långt ord för yngre`);
  if (q.type === 'choicetext') {
    ok(Array.isArray(q.choices) && q.choices.length >= 3 && q.choices.length <= (q.ordered ? 10 : 5), `${ctx}: ${q.choices && q.choices.length} alternativ`);
    const n = q.choices.map(q.cs ? (x) => strip(x).replace(/\s+/g, ' ').trim() : norm); ok(new Set(n).size === n.length, `${ctx}: dubbla alternativ: ${q.choices.join(' | ')}`);
    ok(q.answer >= 0 && q.answer < q.choices.length, `${ctx}: svarsindex utanför`);
    for (const c of q.choices) { ok(c.length <= lim.choice, `${ctx}: alternativet "${c.slice(0, 40)}…" är ${c.length} tecken (max ${lim.choice})`); ok(tagOk(c), `${ctx}: HTML i alternativ`); }
    const amb = correctByText.get(norm(q.text)) || new Set();
    q.choices.forEach((c, i) => { if (i !== q.answer && !q.ordered && !q.cs) ok(!amb.has(norm(c)), `${ctx}: tvetydigt – "${c}" är rätt svar på samma fråga i en annan variant: ${strip(q.text).slice(0, 80)}`); });
  } else if (q.type === 'text') {
    ok(Array.isArray(q.answer) && q.answer.length && q.answer.every(a => normT(a)), `${ctx}: godkända svar saknas`);
    for (const a of q.answer) ok(PACKS.check(q, a).status === 'correct', `${ctx}: godkänt svar "${a}" underkänns`);
    ok(PACKS.check(q, '').status === 'empty', `${ctx}: tomt svar`);
    for (const p of (q.accept && q.accept.pool) || []) ok(PACKS.check(q, p).status !== 'correct', `${ctx}: felalternativ "${p}" godkänns som eget svar`);
  } else if (q.type === 'num') ok(Number.isFinite(q.answer), `${ctx}: talsvar saknas`);
  else if (q.type === 'order') { ok(Array.isArray(q.items) && q.items.length >= 3 && new Set(q.items.map(norm)).size === q.items.length, `${ctx}: ordningsled`); }
  if (q.fig && /readbox/.test(q.fig)) ok(q.speak === false, `${ctx}: lästext får inte läsas upp`);
};

const cats = {};
for (const pk of packs) for (const pol of pk.policies) for (const kp of pk.kps) {
  const cid = PACKS.cidOf(pk.id, kp.id); const vs = PACKS.variants(cid, pol);
  // Rätta svar per frågetext över ALLA varianter (för tvetydighetskontrollen)
  const correctByText = new Map();
  for (const v of vs) for (const sd of SEEDS.slice(0, 3)) { const q = PACKS.buildVariant(cid, v, PACKS.seeded(sd), pol); if (q && q.type === 'choicetext') { const k = norm(q.text); (correctByText.get(k) || correctByText.set(k, new Set()).get(k)).add(norm(q.choices[q.answer])); } }
  const ids = new Set(); const forms = new Set(); const facts = new Set();
  for (const v of vs) {
    for (const sd of SEEDS) {
      const q = PACKS.buildVariant(cid, v, PACKS.seeded(sd), pol);
      const ctx = `${pk.id}/${kp.id} [${pol}] ${v.form}:${v.key.split('|').slice(-3).join('|')}`;
      if (!q) { fail(`${ctx}: varianten gick inte att bygga (för få felalternativ?)`); break; }
      checkQ(q, ctx, pol, correctByText);
      ids.add(LECAT.itemId(q)); forms.add(v.form); facts.add(v.key.split('|')[1]);
    }
  }
  cats[cid] = { ids: ids.size, forms: [...forms], facts: facts.size };
  const minVar = pol === 'younger' ? 4 : 6;
  if (!vs.length) { fail(`${pk.id}/${kp.id} [${pol}]: inga frågor för policyn`); continue; }
  const hasDepth = [...forms].some(f => PACKS.DEPTH.has(f)); const hasRecall = forms.has('recall');
  ok(hasDepth || hasRecall, `${pk.id}/${kp.id} [${pol}]: bara igenkänning – kunskapspunkten behöver eget svar eller en fördjupande form`);
  if (pol !== 'younger') ok(hasDepth, `${pk.id}/${kp.id} [${pol}]: saknar fördjupande form (samband, hitta felet, orsak, tillämpning, förklaring eller flerstegs)`);
  if (ids.size < minVar) fail(`${pk.id}/${kp.id} [${pol}]: bara ${ids.size} olika frågor (minst ${minVar})`);
  if (ids.size < minVar * 2 || forms.size < 3 || facts.size < 4) weak.push(`${pk.id}/${kp.id} [${pol}]: ${ids.size} frågor, ${facts.size} fakta, former: ${[...forms].join(', ')}`);
  // Generatorn måste alltid ge något för varje format och nivå (annars hoppar passet över platsen)
  for (const format of ['any', 'recall', 'depth']) for (const lvl of [1, 2, 3]) { const q = PACKS.question(cid, { lvl, format, pol, rnd: PACKS.seeded(lvl * 7), itemId: LECAT.itemId }); ok(q, `${pk.id}/${kp.id} [${pol}] ${format}@${lvl}: ingen fråga`); }
}

// Stabila koncept-id:n: varje id som någon gång släppts måste finnas kvar (eller pensioneras uttryckligen i paketets "retired")
if (!priv) {
  const lockFile = path.join(__dirname, '..', 'content', 'ids.lock.json');
  const lock = fs.existsSync(lockFile) ? JSON.parse(fs.readFileSync(lockFile, 'utf8')) : { concepts: [] };
  const now = new Set(packs.flatMap(p => p.kps.map(k => PACKS.cidOf(p.id, k.id)))); const retired = new Set(packs.flatMap(p => Object.keys(p.retired || {}).map(k => PACKS.cidOf(p.id, k))));
  for (const id of lock.concepts) ok(now.has(id) || retired.has(id), `koncept-id ${id} har försvunnit (pensionera det i paketets "retired" i stället – annars tappar barnen bevis)`);
  for (const id of now) ok(lock.concepts.includes(id), `koncept-id ${id} saknas i content/ids.lock.json – kör: node scripts/content.mjs lock`);
}

// Migrering: varje gammal v1-fråga i ett moment med paket ska ledas till en kunskapspunkt
if (!priv) {
  const { loadLegacyBanks } = require('./lib/legacy.js'); const LB = loadLegacyBanks();
  for (const pk of packs) for (const s of pk.skills.filter(x => x.existing)) for (const t of pk.templates) {
    const kid = { id: 't', template: t, skills: [{ id: s.id, name: s.id }] };
    const ce = PACKS.catalogEntries(kid, { id: s.id }, TPL_POL[t], LECAT.itemId); ok(ce, `${pk.id}: ${s.id} gav ingen katalog`); if (!ce) continue;
    const rows = LB.rowsFor(s.id); ok(rows.length > 0, `${s.id}: hittade inga gamla frågor att leda om`);
    for (const [type, text, ans] of rows) ok(ce.route[PACKS.legacyId(type, text, ans)], `${s.id}: gammal fråga leds inte till någon kunskapspunkt: ${text.slice(0, 70)}`);
    // och samma id-beräkning som appen (LECAT.itemId på frågeobjektet)
    for (const [type, text, ans] of rows.slice(0, 3)) { const q = type === 'choicetext' ? { type, text, choices: [ans, 'x'], answer: 0 } : type === 'order' ? { type, text, items: [ans], answer: [ans] } : { type, text, answer: type === 'num' ? Number(ans) : ans }; ok(LECAT.itemId(q) === PACKS.legacyId(type, text, ans), `${s.id}: legacy-id stämmer inte med appens itemId för "${text.slice(0, 40)}"`); }
  }
}

// Learning Recipes: stadiet styr aktiviteten (NY → igenkänning/sortering, SÄKER → koppla/tillämpa/hitta felet) – i genomsnitt över alla punkter
{ let newRec = 0, newN = 0, secDepth = 0, secN = 0;
  for (const pk of packs) for (const pol of pk.policies) for (const kp of pk.kps) { const cid = PACKS.cidOf(pk.id, kp.id); const r = PACKS.seeded(11);
    for (let i = 0; i < 12; i++) { const a = PACKS.question(cid, { lvl: 1, format: 'any', pol, rnd: r, stage: { n: 0, st: 0 } }); if (a) { newN++; if (['recognition', 'relationship'].includes(a.form)) newRec++; }
      const b = PACKS.question(cid, { lvl: 3, format: 'any', pol, rnd: r, stage: { n: 9, st: 4 } }); if (b) { secN++; if (PACKS.DEPTH.has(b.form)) secDepth++; } } }
  ok(newRec / newN >= 0.7, `recept NY: ${Math.round(newRec / newN * 100)} % igenkänning/sortering (minst 70 %)`);
  ok(secDepth / secN >= 0.6, `recept SÄKER: ${Math.round(secDepth / secN * 100)} % fördjupande former (minst 60 %)`);
  console.log(`Recept: NY ${Math.round(newRec / newN * 100)} % igenkänning/sortering · SÄKER ${Math.round(secDepth / secN * 100)} % fördjupning`);
  for (const pk of packs) for (const kp of pk.kps) ok(PACKS.TYPES.includes(PACKS.typeOf(kp)), `${pk.id}/${kp.id}: kunskapstyp`);
}
const n = Object.keys(cats).length; const tot = Object.values(cats).reduce((a, c) => a + c.ids, 0);
console.log(`${packs.length} paket · ${n} kunskapspunkter×policy · ${tot} olika frågor`);
if (weak.length) { console.log(`Svagt innehåll (${weak.length}) – rapporteras, inte fel:`); for (const w of weak.slice(0, 40)) console.log('  · ' + w); }
console.log(fails ? `PACKS TEST FAILED (${fails} av ${checks})` : `PACKS TEST OK – ${checks} kontroller`); process.exit(fails ? 1 : 0);
