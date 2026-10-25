/* 2.1I: regressionstester för sakfel som den oberoende innehållsgranskningen hittade. Ett felaktigt faktum i ett system med varaktig
   inlärning är ett allvarligt fel – därför får det aldrig komma tillbaka. Varje rad: en formulering som inte får finnas, eller ett faktum som
   måste stå kvar. Kontrollen går över all text i de inbyggda paketen (frågor, svar, felalternativ, förklaringar, metodsidor). */
'use strict';
const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '../content/packs');
const packs = Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => { const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return [p.id, p]; }));
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const text = (id) => JSON.stringify({ ...packs[id], legacy: undefined });   // legacy = gamla frågebankens text, bara för id-koppling
const kp = (id, k) => packs[id].kps.find(x => x.id === k);
const NEVER = [
  ['kemi8-syror-baser', 'Alla börjar med H', 'ättiksyra CH₃COOH börjar inte med H'],
  ['kemi8-syror-baser', /(?<!minst )lika frätande som starka syror/, 'starka baser är MINST lika frätande'],
  ['kemi8-syror-baser', 'avger ALLA sina vätejoner', 'svavelsyrans andra vätejon avges inte helt'],
  ['kemi8-syror-baser', 'Syra och socker sänker pH', 'socker sänker inte pH själv – bakterierna bildar syra'],
  ['kemi8-syror-baser', 'känns halt mellan fingrarna', 'lär inte ut att testa kemikalier med fingrarna'],
  ['kemi8-syror-baser', '"Kolsyra", "I läsk"', 'läsk innehåller också citronsyra och fosforsyra'],
  ['kemi8-syror-baser', '"Natriumfluorid", "Tandkräm"', 'kalciumkarbonat finns också i tandkräm'],
  ['kemi8-syror-baser', 'Vid tillverkning av såpa', 'både KOH och NaOH används till såpa/tvål'],
  ['kemi8-syror-baser', 'magkatarr', 'magkatarr och halsbränna är olika saker'],
  ['geo4-sverige-och-kartan', 'en del av Småland', 'Öland är ett eget landskap'],
  ['geo4-sverige-och-kartan', 'i Norrbotten"', 'Kiruna och Malmberget ligger i landskapet Lappland'],
  ['geo4-sverige-och-kartan', '["Danmark", "Söder"]', 'Danmark ligger söder OCH sydväst – "Väster" kan också vara rätt'],
  ['geo4-sverige-och-kartan', 'brun (på en världskarta)', 'blanda inte terrängkartans och höjdkartans färger'],
  ['geo4-sverige-och-kartan', 'skeppas med tåg', 'skeppa = med fartyg'],
  ['naso2-var-varld', 'En nyckel', 'de flesta nycklar dras inte till en magnet (mässing)'],
  ['naso2-var-varld', '"haren"', 'bara skogsharen blir vit på vintern'],
  ['naso2-var-varld', '"På trottoaren"', 'små barn får cykla på trottoaren när det inte finns cykelbana'],
  ['naso2-var-varld', 'En suddgummi', 'det heter ett suddgummi'],
  ['naso2-var-varld', '"Amerika"', 'sju världsdelar: Nordamerika och Sydamerika'],
  ['sv2-stava-och-meningar', 'Ordet med stor bokstav kommer först', 'namn har också stor bokstav mitt i meningen'],
  ['sv2-stava-och-meningar', 'Vilket ord har två konsonanter?', 'sol och bil har också två konsonanter'],
  ['sv2-stava-och-meningar', '"En mening slutar med punkt."', 'en mening kan sluta med ? eller !'],
  ['sv2-stava-och-meningar', 'schu', 'sch är en riktig stavning av sj-ljudet (dusch)'],
  ['sv4-sprak-och-lasning', 'Hon heter Ludde', 'husdjur kallas ofta han/hon – "den" är inte det enda rätta'],
  ['sv4-sprak-och-lasning', '"Du har en hund?"', 'en fråga kan ha påståendeordföljd i talspråk'],
  ['sv4-sprak-och-lasning', '"början", "slutet"', '"slut" är också ett rätt svar'],
  ['sv4-sprak-och-lasning', 'Ordet med stor bokstav står först', 'namn har också stor bokstav'],
  ['sv8-sprak-och-lasning', '"Vart tog nycklarna vägen?"', 'både var och vart godtas med "ta vägen"'],
  ['sv8-sprak-och-lasning', '"Maja borstade hennes tänder."', 'utan "egna" kan hennes syfta på någon annan'],
];
for (const [id, bad, why] of NEVER) ok(!(bad instanceof RegExp ? bad.test(text(id)) : text(id).includes(bad)), `${id}: "${bad}" får inte finnas – ${why}`);
// Fakta som måste stå kvar
const lab = kp('kemi8-syror-baser', 'labbsakerhet').facts.find(f => f.k === 'order');
ok(lab && /^Skölj genast/.test(lab.items[0]) && lab.items.some(s => /15 minuter/.test(s)), 'syra på huden: skölj först, och länge (15 minuter)');
ok(/rosa när pH är över cirka 8/.test(kp('kemi8-syror-baser', 'indikatorer').explain), 'fenolftalein: färglös även i svagt basisk lösning');
const neut = kp('kemi8-syror-baser', 'neutralisation').facts.filter(f => f.k === 'order'); ok(neut.every(f => f.items.length <= 4 || f.gap !== false), 'neutralisationens ordningsfråga har bara steg med en entydig ordning');
ok(text('geo4-sverige-och-kartan').includes('Sveriges största ö'), 'Gotland är Sveriges största ö (Öland är också ett landskap)');
ok(/skogsharen/.test(kp('naso2-var-varld', 'djurliv').explain), 'skogsharen byter till vit päls');
console.log(`${checks} kontroller, ${fails} fel`); console.log(fails ? 'CONTENT FACTS TEST FAILED' : 'CONTENT FACTS TEST OK'); process.exit(fails ? 1 : 0);
