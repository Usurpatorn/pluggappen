/* ========= Open "förklara"-frågor: skriv ett svar, appen letar efter nyckelbegrepp ========= */
// keys: grupper av godkända formuleringar (stammar räcker: "golfström" matchar "Golfströmmen"). label = vad som visas om gruppen saknas.
const O = (q, keys, model, hint) => ({ q, keys: keys.map(k => (Array.isArray(k) ? { alts: k, label: k[0] } : k)), model, hint });
const OPEN = {
  // ---------- Geografi åk 4 ----------
  geo_kartor_forr: [
    O('Förklara varför en platt världskarta aldrig kan vara helt korrekt.', [['rund', 'klot', 'glob'], ['platt', 'platta ut'], ['töj', 'förvräng', 'större', 'fel']], 'Jorden är rund som ett klot. När man plattar ut en rund yta på ett papper måste något töjas ut, så vissa länder ser större ut än de är (t.ex. Grönland).', 'Tänk på formen på jorden – och vad som händer när man plattar ut ett apelsinskal.'),
    O('Beskriv skillnaden mellan hur kartor ritades förr och hur de ritas idag.', [['för hand', 'hand'], ['sjömän', 'upptäck', 'mätte', 'kompass'], ['satellit', 'gps', 'flyg']], 'Förr ritades kartor för hand av sjömän och upptäcktsresande som mätte och ritade det de såg, så de blev ofta fel. Idag ritas kartor med satellitbilder och GPS och blir mycket exakta.', 'Vem ritade förr, och vilken teknik använder man idag?'),
  ],
  geo_lasa_karta: [
    O('Förklara vad skala är och ge ett exempel på hur den används.', [['förminsk', 'mindre', 'verklighet'], ['1:', 'cm', 'km', 'meter']], 'Skalan talar om hur mycket kartan är förminskad jämfört med verkligheten. Skala 1:50 000 betyder att 1 cm på kartan är 50 000 cm, alltså 500 m, i verkligheten. Då kan man räkna ut avstånd.', 'Vad betyder siffrorna 1:50 000?'),
    O('Ge exempel på något som kartan visar som finns i verkligheten och något som människor har bestämt.', [['sjö', 'berg', 'älv', 'skog', 'hav', 'väg'], ['gräns', 'län', 'kommun', 'land']], 'I verkligheten finns t.ex. sjöar, berg och skogar. Gränser mellan länder, län och kommuner är sådant som människor har bestämt – de syns inte i naturen.', 'Vad kan du se om du står på platsen – och vad kan du inte se?'),
  ],
  geo_hitta: [
    O('Förklara hur du använder registret och gradnätet för att hitta en ort i en kartbok.', [['register', 'bokstavsordning', 'längst bak'], ['sida', 'sidnummer'], ['ruta', 'gradnät', 'bokstav', 'siffra']], 'I registret längst bak står orterna i bokstavsordning med sidnummer och en ruta, t.ex. Luleå 14 C3. Då slår man upp sidan 14 och letar i rutan C3 i gradnätet.', 'Var i boken letar du först, och vad säger koden du hittar?'),
  ],
  geo_sverige_lage: [
    O('Beskriv var Sverige ligger på världskartan. Använd begrepp som halvklot, världsdel och ekvatorn.', [['norra halvklot', 'norra'], ['europa'], ['ekvator', 'långt norr', 'norr om']], 'Sverige ligger i norra Europa på norra halvklotet, långt norr om ekvatorn. Tillsammans med Norge ligger det på Skandinaviska halvön.', 'Vilken världsdel, vilket halvklot och hur långt från ekvatorn?'),
  ],
  geo_indelning: [
    O('Berätta om Sveriges tre landsdelar och var de ligger.', [['götaland'], ['svealand'], ['norrland'], ['söder', 'norr', 'mitten', 'störst']], 'Sverige har tre landsdelar: Götaland i söder, Svealand i mitten och Norrland i norr. Norrland är störst till ytan men har färre invånare.', 'Nämn alla tre och säg var de ligger.'),
    O('Vad har kommunen ansvar för, och vad har regionen ansvar för?', [['skol', 'förskol', 'äldre', 'sop', 'vatten'], ['sjukvård', 'vård', 'sjukhus', 'kollektivtrafik', 'buss']], 'Kommunen sköter skolor, förskolor, äldreomsorg, vatten och sopor. Regionen ansvarar för sjukvården (sjukhus och vårdcentraler) och ofta bussar och tåg.', 'Tänk på vad som finns där du bor: skola, sopor, vårdcentral – vem sköter vad?'),
  ],
  geo_befolkning: [
    O('Beskriv var i Sverige de flesta människor bor och varför.', [['söder', 'södra'], ['kust', 'stad', 'städer'], ['klimat', 'jobb', 'åker', 'mild', 'varm']], 'De flesta bor i södra Sverige, längs kusterna och i städer som Stockholm, Göteborg och Malmö. Där är klimatet mildare, det finns mer åkermark och fler jobb. Norrlands inland är glesbefolkat.', 'Var är det tätt, var är det glest – och vad beror det på?'),
  ],
  geo_klimat: [
    O('Förklara skillnaden mellan väder och klimat.', [['väder', 'just nu', 'idag', 'dag'], ['klimat', 'många år', 'vanliga', 'lång tid', 'medel']], 'Väder är hur det är just nu eller idag – sol, regn, vind. Klimat är det vanliga vädret på en plats under många år.', 'Ett handlar om idag, det andra om många år.'),
    O('Beskriv hur Golfströmmen påverkar klimatet i Sverige.', [['varm'], ['havsström', 'ström'], ['mild', 'varmare'], ['mexikan', 'atlant']], 'Golfströmmen är en varm havsström som kommer från Mexikanska golfen över Atlanten. Den värmer luften över Norden, så Sverige får ett mycket mildare klimat än andra platser lika långt norrut.', 'Vad är Golfströmmen, var kommer den ifrån och vad gör den med vårt klimat?'),
  ],
  geo_naturtyper: [
    O('Beskriv två av Sveriges naturtyper och var i landet de finns.', [['fjäll', 'barrskog', 'lövskog', 'slätt', 'myr', 'skärgård'], ['norr', 'söder', 'väst', 'kust', 'skåne', 'norrland']], 'Till exempel fjäll: höga berg i nordvästra Sverige där det inte växer träd på toppen. Och barrskog: gran- och tallskog som täcker större delen av Norrland. Slätter med åkrar finns i Skåne, skärgård längs kusterna.', 'Nämn naturtypen, hur den ser ut och var den finns.'),
  ],
  geo_naturresurser: [
    O('Ge exempel på tre naturresurser i Sverige och vad vi använder dem till.', [['skog'], ['malm', 'järn'], ['vatten', 'älv', 'el'], ['papper', 'stål', 'trä', 'hus', 'el']], 'Skog ger trä, papper och hus. Järnmalm från Kiruna och Malmberget blir stål. Vattenkraft i älvarna ger elektricitet. Åkermark ger mat.', 'Tre saker vi hämtar från naturen – och vad blir det av dem?'),
  ],
  geo_miljo: [
    O('Förklara skillnaden mellan förnybara och icke förnybara naturresurser. Ge exempel.', [['förnybar', 'bildas igen', 'växer', 'tar inte slut'], ['icke', 'tar slut', 'slut'], ['skog', 'vind', 'sol', 'vatten'], ['olja', 'kol', 'malm', 'gas']], 'Förnybara resurser kan bildas igen, t.ex. skog, vind, sol och vatten. Icke förnybara tar slut när vi använt dem, t.ex. olja, kol och järnmalm.', 'Vilka kommer tillbaka och vilka tar slut?'),
    O('Ge förslag på hur vi människor kan hushålla med jordens resurser.', [['återvinn', 'återanvänd', 'sopsorter'], ['spara', 'energi', 'släck', 'cykla'], ['förnybar', 'sol', 'vind', 'köp mindre', 'laga']], 'Vi kan återvinna och återanvända saker, spara energi, välja förnybar energi som sol och vind, köpa färre nya saker och laga det som går sönder.', 'Minst två konkreta saker man kan göra hemma.'),
  ],
  // ---------- Kemi åk 8 ----------
  kemi_syror: [
    O('Förklara med kemins begrepp vad som gör en lösning sur.', [['vätejon', 'h+', 'h⁺'], ['ph', 'under 7', 'lågt'], ['avger', 'löses', 'vatten']], 'En syra avger vätejoner (H⁺) när den löses i vatten. Det är vätejonerna som gör lösningen sur, och ju fler vätejoner desto lägre pH (under 7).', 'Vilken jon? Vad händer med pH?'),
    O('Ge exempel på tre syror vi träffar på i vardagen och var de finns.', [['citron', 'ättik', 'kolsyra', 'mjölksyra', 'saltsyra', 'askorbin'], ['läsk', 'vinäger', 'citrus', 'mage', 'frukt', 'fil', 'yoghurt']], 'Citronsyra i citrusfrukter, ättiksyra i vinäger, kolsyra i läsk, mjölksyra i filmjölk och saltsyra i magsäcken.', 'Tänk på kylskåpet och på kroppen.'),
  ],
  kemi_baser: [
    O('Förklara vad som gör en lösning basisk och ge två exempel på baser i vardagen.', [['hydroxid', 'oh-', 'oh⁻'], ['ph', 'över 7', 'högt'], ['tvål', 'rengöring', 'lut', 'ammoniak', 'bakpulver', 'bikarbonat', 'propplös']], 'En basisk lösning innehåller många hydroxidjoner (OH⁻) och har pH över 7. Exempel: natriumhydroxid (lut) i propplösare, ammoniak i fönsterputs, bikarbonat i bakpulver, tvål.', 'Vilken jon? Och vad finns under diskbänken?'),
  ],
  kemi_ph: [
    O('Förklara vad pH-skalan visar och vad som menas med att den är logaritmisk.', [['vätejon', 'surt', 'basisk'], ['0', '14', '7', 'neutral'], ['10 gånger', 'tio gånger', 'logaritm']], 'pH-skalan går från 0 till 14 och visar hur många vätejoner en lösning har: under 7 surt, 7 neutralt, över 7 basiskt. Varje steg betyder 10 gånger fler eller färre vätejoner – pH 3 är 100 gånger surare än pH 5.', 'Vad mäter den, var är neutralt, och hur mycket skiljer ett steg?'),
    O('Vad är en indikator? Ge ett exempel och beskriv vilka färger den ger.', [['färg', 'byter färg', 'visar'], ['btb', 'lackmus', 'fenolftalein', 'rödkål', 'ph-papper'], ['gul', 'grön', 'blå', 'röd', 'rosa', 'färglös']], 'En indikator är ett ämne som byter färg beroende på pH. BTB är gul i sur lösning, grön i neutral och blå i basisk. Fenolftalein är färglös i surt och rosa i basiskt.', 'Vad gör indikatorn och vilka färger får den?'),
  ],
  kemi_starka: [
    O('Förklara skillnaden mellan en stark och en svag syra.', [['alla', 'fullständig', 'helt'], ['del', 'några', 'delvis'], ['vätejon', 'joner', 'protolys']], 'I en stark syra avger alla syramolekyler sina vätejoner i vatten (t.ex. saltsyra). I en svag syra avger bara en del av molekylerna sina vätejoner (t.ex. ättiksyra).', 'Hur många av molekylerna avger sina vätejoner?'),
    O('Förklara skillnaden mellan koncentrerad och utspädd syra. Är det samma sak som stark och svag?', [['mycket', 'lite', 'mängd', 'per liter'], ['vatten'], ['inte samma', 'olika', 'nej']], 'Koncentrerad betyder mycket syra och lite vatten, utspädd betyder lite syra och mycket vatten – det handlar om mängd. Stark/svag handlar i stället om hur stor del av molekylerna som avger vätejoner. Det är inte samma sak: en utspädd stark syra kan ha högre pH än en koncentrerad svag.', 'Mängd eller egenskap?'),
  ],
  kemi_neutral: [
    O('Förklara vad som händer vid en neutralisation och skriv ett exempel med ord eller formler.', [['syra'], ['bas'], ['salt'], ['vatten'], ['hcl', 'naoh', 'nacl', 'saltsyra', 'natriumhydroxid', 'natriumklorid']], 'När en syra och en bas blandas bildar vätejonerna och hydroxidjonerna vatten, och resten av jonerna bildar ett salt: syra + bas → salt + vatten. Exempel: HCl + NaOH → NaCl + H₂O.', 'Vad går in, vad kommer ut? Ta med ett exempel.'),
    O('Förklara vad ett salt är med kemins begrepp.', [['jon'], ['positiv', 'negativ', 'laddade'], ['kristall', 'mönster', 'regelbunden'], ['metall', 'natrium', 'klorid']], 'Ett salt är en jonförening: positiva joner (ofta en metall, t.ex. natrium) och negativa joner (t.ex. klorid) som hålls ihop av att laddningarna drar i varandra, ordnade i ett regelbundet mönster – en kristall.', 'Vilka delar består saltet av och hur sitter de ihop?'),
  ],
  kemi_vardag: [
    O('Ge exempel på tre jonföreningar (salter) och hur vi använder dem i vardagen.', [['natriumklorid', 'koksalt', 'bordssalt'], ['bikarbonat', 'bakpulver', 'kalk', 'kalciumkarbonat', 'fluorid', 'nitrat', 'gödsel', 'vägsalt'], ['mat', 'baka', 'tandkräm', 'gödsel', 'väg', 'bygg']], 'Natriumklorid (koksalt) till mat och vägsalt, natriumvätekarbonat i bakpulver och mot halsbränna, kalciumkarbonat i kalksten och tandkräm, natriumfluorid i tandkräm, kaliumnitrat som gödsel.', 'Köket, badrummet och trädgården är bra ställen att leta på.'),
  ],
  kemi_kropp_natur: [
    O('Beskriv vilka konsekvenser ett förändrat pH-värde kan få i naturen.', [['försur', 'surt regn'], ['fisk', 'dör', 'djur', 'korall'], ['svavel', 'kväve', 'koldioxid', 'avgas', 'utsläpp'], ['kalk', 'minska utsläpp']], 'Utsläpp av svaveldioxid och kväveoxider ger surt regn som försurar sjöar och mark: fiskar och andra djur dör, näring lakas ur marken och giftiga metaller frigörs. Haven försuras av koldioxid, vilket skadar koraller och skaldjur. Motåtgärder är att minska utsläppen och kalka sjöar.', 'Vad händer med sjöar, mark och hav – och varför?'),
    O('Beskriv hur pH påverkar kroppen – ge två exempel.', [['mage', 'magsäck', 'saltsyra'], ['tand', 'emalj', 'karies', '5,5'], ['blod', '7,4'], ['läsk', 'socker', 'syra']], 'Magsäcken har pH 1–2 av saltsyra som bryter ner maten. Tandemaljen löses upp när pH i munnen går under 5,5, t.ex. av läsk och syra från bakterier – då bildas karies. Blodet måste hålla pH 7,4.', 'Magen, tänderna, blodet – vad gäller där?'),
    O('Beskriv hur saltet vi äter kan påverka vår hälsa.', [['blodtryck', 'högt'], ['hjärt', 'kärl', 'stroke', 'njur'], ['6 gram', 'tesked', 'mindre', 'för mycket']], 'För mycket salt (natriumklorid) höjer blodtrycket, vilket på sikt ökar risken för hjärt- och kärlsjukdomar. Rekommendationen är max cirka 6 gram per dag, ungefär en tesked.', 'Vad händer i kroppen och hur mycket är lagom?'),
  ],
  kemi_saker: [
    O('Förklara varför regeln "SIV" är viktig i labbet.', [['syra i vatten', 'syran i vattnet', 'siv'], ['stänk', 'koka', 'värme', 'frät'], ['aldrig tvärtom', 'inte vatten i syra']], 'SIV betyder Syra I Vatten: man häller alltid syran i vattnet, aldrig tvärtom. Blandningen blir mycket varm, och häller man vatten i koncentrerad syra kan det koka och stänka frätande syra.', 'Vad står bokstäverna för och vad kan hända annars?'),
    O('Nämn tre frågor du ska ställa för att vara källkritisk när du söker information om kemi.', [['vem'], ['varför', 'syfte', 'sälja'], ['när', 'gammal', 'aktuell'], ['andra källor', 'jämför', 'stämmer']], 'Vem står bakom källan? Varför finns den – för att informera, sälja eller påverka? När skrevs den? Stämmer uppgifterna med andra oberoende källor?', 'Vem, varför, när – och en till.'),
  ],
};

// "Sätt i ordning": items i rätt ordning
const ORDERS = {
  kemi_neutral: [
    { q: 'Sätt stegen i rätt ordning för att neutralisera en syra i labbet.', items: ['Mät upp syran i en bägare', 'Tillsätt några droppar indikator (BTB) – lösningen blir gul', 'Droppa i bas lite i taget och rör om', 'Stanna när färgen slår om till grön – lösningen är neutral', 'Nu finns ett salt löst i vattnet'], why: 'Indikatorn visar när pH når 7. Då har vätejonerna och hydroxidjonerna bildat vatten och resten är salt.' },
    { q: 'Sätt stegen i rätt ordning: vad händer när saltsyra och natriumhydroxid blandas?', items: ['Saltsyran bidrar med vätejoner (H⁺) och kloridjoner (Cl⁻)', 'Natriumhydroxiden bidrar med natriumjoner (Na⁺) och hydroxidjoner (OH⁻)', 'H⁺ och OH⁻ slår sig ihop och bildar vatten (H₂O)', 'Na⁺ och Cl⁻ blir kvar i lösningen', 'När vattnet avdunstar bildas saltkristaller av natriumklorid'], why: 'Syra + bas → salt + vatten. HCl + NaOH → NaCl + H₂O.' },
  ],
  kemi_ph: [
    { q: 'Ordna lösningarna från surast till mest basisk.', items: ['Magsyra (pH 1–2)', 'Läsk (pH 2–3)', 'Rent vatten (pH 7)', 'Blod (pH 7,4)', 'Tvålvatten (pH 9–10)', 'Propplösare (pH 13–14)'], why: 'Lågt pH = surt, 7 = neutralt, högt pH = basiskt.' },
  ],
  kemi_saker: [
    { q: 'Du har fått syra på handen. Sätt stegen i rätt ordning.', items: ['Säg till läraren direkt', 'Skölj med rikligt med vatten i flera minuter', 'Ta av smycken eller kläder som fått syra på sig', 'Låt någon kontrollera huden – sök vård om det svider eller blir rött'], why: 'Vatten späder ut syran snabbt. Säg alltid till en vuxen först.' },
  ],
  geo_lasa_karta: [
    { q: 'Sätt stegen i rätt ordning för att räkna ut ett avstånd med skalan 1:50 000.', items: ['Mät avståndet på kartan med linjal, t.ex. 4 cm', 'Multiplicera med skalans tal: 4 · 50 000 = 200 000 cm', 'Gör om till meter: 200 000 cm = 2 000 m', 'Gör om till kilometer: 2 000 m = 2 km'], why: 'Skalan säger hur många gånger större verkligheten är. Räkna i cm först, gör sedan om till meter och kilometer.' },
  ],
  geo_hitta: [
    { q: 'Sätt stegen i rätt ordning för att hitta Luleå i kartboken.', items: ['Slå upp registret längst bak i boken', 'Leta upp Luleå i bokstavsordning', 'Läs av koden, t.ex. "14 C3"', 'Bläddra till sidan 14', 'Leta i rutan C3 i gradnätet'], why: 'Registret ger sida och ruta, gradnätet leder dig rätt på sidan.' },
  ],
  geo_naturresurser: [
    { q: 'Sätt stegen i rätt ordning: från malm i berget till stål.', items: ['Järnmalm bryts i gruvan i Kiruna', 'Malmen krossas och görs till pellets', 'Pellets fraktas med tåg till hamnen i Luleå eller Narvik', 'I stålverket smälts malmen och blir stål', 'Stålet blir bilar, broar och verktyg'], why: 'Råvara → förädling → färdig vara. Luleå har både hamn och stålverk.' },
  ],
  geo_miljo: [
    { q: 'Sätt händelserna i rätt ordning när en sjö försuras.', items: ['Fabriker och bilar släpper ut svaveldioxid och kväveoxider', 'Gaserna löser sig i regnvattnet och det blir surt regn', 'Regnet rinner ner i sjön och sänker pH', 'Rom och yngel dör, sedan fiskarna', 'Sjön kalkas för att höja pH igen'], why: 'Kalkning hjälper tillfälligt – det viktigaste är att minska utsläppen.' },
  ],
};
function makeOrderQuestion(topicId, level) {
  const list = ORDERS[topicId]; if (!list || !list.length) return null;
  const o = R.pick(list);
  return { type: 'order', text: o.q, items: o.items.slice(), steps: [`<b>Rätt ordning:</b><ol style="margin:6px 0 0;padding-left:20px">${o.items.map(i => `<li>${i}</li>`).join('')}</ol>`, o.why], hint: 'Vad måste hända först för att nästa steg ska vara möjligt?', level, answer: o.items };
}
const normOpen = (s) => s.toLowerCase().replace(/[^a-z0-9åäöé⁺⁻+:,\s]/g, ' ').replace(/\s+/g, ' ');
function checkOpen(q, raw) {
  const a = normOpen(raw || '');
  if (a.trim().length < 3) return { status: 'empty' };
  const hit = [], miss = [];
  for (const k of q.keys) { if (k.alts.some(alt => a.includes(normOpen(alt).trim()))) hit.push(k); else miss.push(k); }
  const score = hit.length / q.keys.length;
  const need = q.keys.length <= 2 ? 1 : Math.ceil(q.keys.length * 0.6);
  return { status: hit.length >= need ? 'correct' : 'wrong', hit, miss, score };
}
function makeOpenQuestion(topicId, level) {
  const list = OPEN[topicId]; if (!list || !list.length) return null;
  const q = R.pick(list);
  return { type: 'open', text: q.q, keys: q.keys, model: q.model, hint: q.hint, steps: [`<b>Exempel på fullständigt svar:</b> ${q.model}`], level, answer: q.model };
}
if (typeof module !== 'undefined') module.exports = { OPEN, ORDERS, checkOpen, makeOpenQuestion, makeOrderQuestion };
