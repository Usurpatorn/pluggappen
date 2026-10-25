/* ========= NO och SO åk 1–3 (mallen åk 2) – enligt Lgr22 centralt innehåll ========= */
// Q(fråga, [rätt, fel…], förklaring)  ·  O(fråga, [rätt ordning], förklaring) = sätt i ordning
const QN = (q, choices, why) => ({ q, choices, why });
const ON = (q, items, why) => ({ order: true, q, items, why });

const NO2 = [
  { id: 'no_arstider', name: 'Årstider, månader och dygnet', short: 'Årstider', icon: '🍂', lgr: 'Årstidsväxlingar i naturen. Hur man känner igen årstider. Dygnet och månadernas namn.',
    read: `<p>Året har <b>fyra årstider</b>: vår, sommar, höst och vinter. På <b>våren</b> smälter snön, fåglarna kommer tillbaka och träden får knoppar. På <b>sommaren</b> är det varmt och ljust nästan hela dygnet i Luleå. På <b>hösten</b> blir löven gula och röda och faller av, och många fåglar flyttar söderut. På <b>vintern</b> är det kallt, mörkt och snö.</p><p>Året har <b>12 månader</b>: januari, februari, mars, april, maj, juni, juli, augusti, september, oktober, november, december. En vecka har 7 dagar och ett dygn har 24 timmar.</p>`,
    qs: [
      QN('Hur många årstider finns det?', ['Fyra', 'Tre', 'Två', 'Tolv'], 'Vår, sommar, höst och vinter.'),
      QN('Vilken årstid faller löven av träden?', ['Hösten', 'Våren', 'Sommaren', 'Vintern'], 'På hösten blir löven gula och röda innan de faller.'),
      QN('Vad händer på våren?', ['Snön smälter och fåglarna kommer tillbaka', 'Löven faller', 'Det blir mörkt och kallt', 'Björnen går i ide'], 'Våren är när naturen vaknar.'),
      QN('Hur många månader har ett år?', ['12', '10', '7', '24'], 'Januari till december – tolv månader.'),
      QN('Vilken månad kommer efter mars?', ['April', 'Maj', 'Februari', 'Juni'], 'Januari, februari, mars, april …'),
      QN('Vilken är årets första månad?', ['Januari', 'December', 'Mars', 'Augusti'], 'Nyår firas 1 januari.'),
      QN('Hur många dagar har en vecka?', ['7', '5', '10', '12'], 'Måndag till söndag.'),
      QN('Hur många timmar har ett dygn?', ['24', '12', '60', '7'], 'Ett dygn = en dag och en natt = 24 timmar.'),
      QN('Varför är det ljust nästan hela natten i Luleå på sommaren?', ['Luleå ligger långt norrut, nära polcirkeln', 'Solen är större på sommaren', 'Det finns många lampor', 'Det är alltid ljust på sommaren överallt'], 'Ju längre norrut, desto ljusare sommarnätter – midnattssol.'),
      QN('Vilka månader är vintermånader i Sverige?', ['December, januari, februari', 'Juni, juli, augusti', 'Mars, april, maj', 'September, oktober, november'], 'Vintern är december–februari.'),
      ON('Sätt månaderna i rätt ordning:', ['januari', 'februari', 'mars', 'april'], 'Årets fyra första månader.'),
      ON('Sätt månaderna i rätt ordning:', ['september', 'oktober', 'november', 'december'], 'Årets fyra sista månader.'),
      ON('Sätt veckodagarna i rätt ordning:', ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag'], 'Veckan börjar på måndag.'),
      ON('Sätt årstiderna i ordning, börja med våren:', ['vår', 'sommar', 'höst', 'vinter'], 'Efter vintern kommer våren igen.'),
    ] },
  { id: 'no_djur', name: 'Djur och växter i närmiljön', short: 'Djur & växter', icon: '🦔', lgr: 'Djur och växter i närmiljön och hur de kan sorteras och grupperas. Enkla näringskedjor och livscykler.',
    read: `<p>Djur kan sorteras i grupper. <b>Däggdjur</b> har päls och ungarna diar mjölk (hund, älg, människa). <b>Fåglar</b> har fjädrar och lägger ägg. <b>Fiskar</b> andas med gälar och lever i vatten. <b>Insekter</b> har sex ben och kroppen i tre delar (myra, bi, fjäril). <b>Kräldjur</b> som ormar och ödlor har fjäll, <b>groddjur</b> som grodor börjar livet i vatten.</p><p>En <b>näringskedja</b> visar vem som äter vem: gräs → hare → räv. Växter är alltid först, för de gör sin egen mat av solljus. En <b>livscykel</b> visar hur ett djur växer: ägg → larv → puppa → fjäril.</p><p>På vintern <b>sover</b> björnen och igelkotten, flyttfåglarna <b>flyttar</b> söderut, och haren byter till <b>vit päls</b>.</p>`,
    qs: [
      QN('Vilken djurgrupp har päls och diar sina ungar?', ['Däggdjur', 'Fåglar', 'Fiskar', 'Insekter'], 'Däggdjur = djur som ger di (mjölk).'),
      QN('Hur många ben har en insekt?', ['Sex', 'Fyra', 'Åtta', 'Två'], 'Spindlar har åtta ben – de är inte insekter!'),
      QN('Vilket djur är en fågel?', ['Talgoxe', 'Fladdermus', 'Groda', 'Fjäril'], 'Fåglar har fjädrar. Fladdermusen är ett däggdjur som kan flyga.'),
      QN('Vad har fiskar för att andas under vatten?', ['Gälar', 'Lungor', 'Näsa', 'Fenor'], 'Gälarna tar upp syre ur vattnet.'),
      QN('Vilket djur är ett däggdjur?', ['Älg', 'Gädda', 'Humla', 'Orm'], 'Älgen har päls och ungarna diar.'),
      QN('Vad kommer alltid först i en näringskedja?', ['En växt', 'Ett rovdjur', 'Människan', 'En insekt'], 'Växter gör sin egen näring av solljus – allt annat äter växter eller djur som ätit växter.'),
      QN('Vad gör björnen på vintern?', ['Sover i ide', 'Flyttar söderut', 'Byter färg', 'Simmar i havet'], 'Björnen äter mycket på hösten och sover sedan hela vintern.'),
      QN('Varför byter haren till vit päls på vintern?', ['För att inte synas i snön', 'För att det är fint', 'För att hålla värmen', 'För att springa fortare'], 'Vit päls i snö = kamouflage mot räven.'),
      QN('Vad gör flyttfåglar på hösten?', ['Flyger söderut där det finns mat', 'Sover i ide', 'Bygger bo', 'Lägger ägg'], 'Till exempel tranan och svalan flyttar.'),
      QN('Vad behöver en växt för att växa?', ['Vatten, ljus och näring', 'Bara vatten', 'Mörker', 'Kött'], 'Växter gör näring av solljus, vatten och luft.'),
      QN('Vilka delar har en blomma?', ['Rot, stjälk, blad och blomma', 'Ben, mage och huvud', 'Gälar och fenor', 'Päls och svans'], 'Roten suger upp vatten, stjälken bär upp, bladen fångar ljus.'),
      QN('Vad är ett rovdjur?', ['Ett djur som äter andra djur', 'Ett djur som äter gräs', 'Ett djur som sover på vintern', 'Ett djur som lever i vatten'], 'Räv, varg och lo är rovdjur.'),
      ON('Sätt fjärilens livscykel i rätt ordning:', ['ägg', 'larv', 'puppa', 'fjäril'], 'Larven äter, förpuppas och blir en fjäril.'),
      ON('Sätt näringskedjan i rätt ordning (vem äts av vem):', ['gräs', 'hare', 'räv'], 'Växten först, sedan växtätaren, sist rovdjuret.'),
      ON('Sätt grodans livscykel i rätt ordning:', ['ägg (rom)', 'grodyngel', 'liten groda med ben', 'vuxen groda'], 'Grodan börjar livet i vatten.'),
    ] },
  { id: 'no_kroppen', name: 'Kroppen och sinnena', short: 'Kroppen', icon: '🫀', lgr: 'Människans kroppsdelar, deras namn och funktion. Människans upplevelser av ljus, ljud, temperatur, smak och doft med hjälp av olika sinnen.',
    read: `<p>Vi har <b>fem sinnen</b>: syn (ögonen), hörsel (öronen), lukt (näsan), smak (tungan) och känsel (huden).</p><p>Inuti kroppen finns <b>skelettet</b> som håller oss uppe, <b>musklerna</b> som gör att vi kan röra oss, <b>hjärtat</b> som pumpar blod, <b>lungorna</b> som vi andas med, <b>magen</b> som bryter ner maten och <b>hjärnan</b> som styr allt.</p><p>För att må bra behöver kroppen sömn, bra mat, rörelse och vatten.</p>`,
    qs: [
      QN('Hur många sinnen har människan?', ['Fem', 'Tre', 'Två', 'Tio'], 'Syn, hörsel, lukt, smak och känsel.'),
      QN('Vilket sinne använder du med tungan?', ['Smak', 'Lukt', 'Hörsel', 'Känsel'], 'Tungan känner sött, salt, surt, beskt och umami.'),
      QN('Vad gör hjärtat?', ['Pumpar runt blodet i kroppen', 'Bryter ner maten', 'Styr tankarna', 'Hjälper oss andas'], 'Hjärtat slår ungefär 80 gånger i minuten när du vilar.'),
      QN('Vad andas vi med?', ['Lungorna', 'Magen', 'Hjärtat', 'Skelettet'], 'Lungorna tar upp syre ur luften.'),
      QN('Vad håller kroppen uppe?', ['Skelettet', 'Huden', 'Blodet', 'Håret'], 'Skelettet har över 200 ben.'),
      QN('Vilket organ styr hela kroppen?', ['Hjärnan', 'Magen', 'Hjärtat', 'Njurarna'], 'Hjärnan skickar signaler genom nerverna.'),
      QN('Med vilket sinne känner du att något är varmt?', ['Känsel', 'Syn', 'Smak', 'Hörsel'], 'Känseln sitter i huden.'),
      QN('Vad gör musklerna?', ['Gör att vi kan röra oss', 'Pumpar blod', 'Smakar maten', 'Ser ljus'], 'Musklerna drar i skelettet.'),
      QN('Varför behöver vi sova?', ['Kroppen och hjärnan vilar och växer', 'För att bli hungriga', 'För att se bättre', 'Det behöver vi inte'], 'Barn behöver 9–11 timmars sömn.'),
      QN('Var bryts maten ner?', ['I magen och tarmarna', 'I lungorna', 'I hjärtat', 'I skelettet'], 'Näringen går sedan ut i blodet.'),
      QN('Vilket sinne använder du när du lyssnar på musik?', ['Hörsel', 'Syn', 'Lukt', 'Smak'], 'Örat fångar upp ljudvågor.'),
      QN('Vad händer med pulsen när du springer?', ['Den blir snabbare', 'Den blir långsammare', 'Den stannar', 'Inget'], 'Musklerna behöver mer syre, så hjärtat pumpar fortare.'),
    ] },
  { id: 'no_vatten', name: 'Vatten, luft och väder', short: 'Vatten & väder', icon: '💧', lgr: 'Vattnets olika former: fast, flytande och gas. Övergångar mellan formerna: avdunstning, kokning, kondensering, smältning och stelning. Luftens egenskaper. Vattnets kretslopp.',
    read: `<p>Vatten finns i <b>tre former</b>: <b>fast</b> (is), <b>flytande</b> (vatten) och <b>gas</b> (vattenånga). När is blir varm <b>smälter</b> den. När vatten blir kallt <b>fryser</b> (stelnar) det – vid 0 grader. När vatten kokar vid 100 grader blir det <b>ånga</b>. Ånga som kyls ner blir vattendroppar igen – det kallas <b>kondensera</b> (som imma på ett kallt glas).</p><p><b>Vattnets kretslopp:</b> solen värmer havet → vatten avdunstar och stiger som ånga → ångan kyls och blir moln → regn eller snö faller → vattnet rinner i bäckar och älvar tillbaka till havet.</p><p><b>Luft</b> finns överallt fast vi inte ser den. Luft tar plats (blås upp en ballong!) och väger lite. Vind är luft som rör sig.</p>`,
    qs: [
      QN('Vilka tre former kan vatten ha?', ['Fast, flytande och gas', 'Kall, varm och het', 'Salt, sött och surt', 'Hav, sjö och älv'], 'Is, vatten och vattenånga.'),
      QN('Vad kallas vatten i fast form?', ['Is', 'Ånga', 'Regn', 'Dimma'], 'Vid 0 grader fryser vatten till is.'),
      QN('Vad händer när is blir varm?', ['Den smälter', 'Den fryser', 'Den kokar', 'Den försvinner'], 'Smälta = fast blir flytande.'),
      QN('Vid vilken temperatur fryser vatten?', ['0 grader', '100 grader', '10 grader', '−100 grader'], 'Under 0 grader är vatten is.'),
      QN('Vid vilken temperatur kokar vatten?', ['100 grader', '0 grader', '50 grader', '1000 grader'], 'Då blir vattnet till ånga.'),
      QN('Vad kallas det när ånga blir till vattendroppar?', ['Kondensera', 'Smälta', 'Frysa', 'Koka'], 'Som när badrumsspegeln blir immig.'),
      QN('Varför blir det imma på ett glas med kall saft?', ['Vattenånga i luften kyls mot glaset och blir droppar', 'Saften läcker ut', 'Glaset svettas', 'Det regnar inne'], 'Kondens!'),
      QN('Vad är ett moln?', ['Små vattendroppar eller iskristaller i luften', 'Rök', 'Bomull', 'Ånga som är varm'], 'Molnen bildas när vattenånga kyls ner högt upp.'),
      QN('Vad är vind?', ['Luft som rör sig', 'Vatten som rör sig', 'Ljud', 'Kall ånga'], 'Vind är luft i rörelse.'),
      QN('Vad händer med en pöl på en varm sommardag?', ['Vattnet avdunstar och blir ånga', 'Vattnet fryser', 'Vattnet blir salt', 'Inget'], 'Avdunsta = flytande blir gas utan att koka.'),
      QN('Tar luft plats?', ['Ja – blås upp en ballong så ser du', 'Nej, luft är ingenting', 'Bara på vintern', 'Bara utomhus'], 'Luft är en gas som tar plats och väger lite.'),
      QN('Var kommer regnet ifrån?', ['Från moln där vattendroppar blivit tunga', 'Från havet direkt', 'Från solen', 'Från berg'], 'Dropparna i molnet slås ihop, blir tunga och faller.'),
      ON('Sätt vattnets kretslopp i rätt ordning:', ['solen värmer havet', 'vatten avdunstar och stiger', 'ångan kyls och blir moln', 'regn faller', 'vattnet rinner tillbaka till havet'], 'Sedan börjar det om – ett kretslopp.'),
      ON('Sätt i ordning från kallast till varmast:', ['is', 'kallt vatten', 'varmt vatten', 'ånga'], 'Ju varmare, desto snabbare rör sig vattnets små delar.'),
    ] },
  { id: 'no_rymden', name: 'Jorden, solen och månen', short: 'Rymden', icon: '🌙', lgr: 'Jordens, solens och månens rörelser i förhållande till varandra. Månens olika faser. Stjärnbilder och stjärnhimlens utseende vid olika tider på året.',
    read: `<p><b>Jorden</b> är en planet som snurrar runt sig själv ett varv per <b>dygn</b> – det är därför vi har dag och natt. Samtidigt går jorden runt <b>solen</b> – ett varv tar ett <b>år</b>. Solen är en <b>stjärna</b>, ett enormt klot av het gas som ger oss ljus och värme.</p><p><b>Månen</b> går runt jorden på ungefär en månad. Månen lyser inte själv – den speglar solens ljus. Därför ser den olika ut: <b>nymåne</b> (osynlig), <b>halvmåne</b>, <b>fullmåne</b>. Det kallas månens faser.</p><p>I vårt <b>solsystem</b> finns åtta planeter: Merkurius, Venus, Jorden, Mars, Jupiter, Saturnus, Uranus och Neptunus. På natthimlen kan vi se <b>stjärnbilder</b> som Karlavagnen.</p>`,
    qs: [
      QN('Varför har vi dag och natt?', ['Jorden snurrar runt sig själv', 'Solen slocknar på natten', 'Månen skymmer solen', 'Molnen täcker solen'], 'Den sida som är vänd mot solen har dag.'),
      QN('Hur lång tid tar det för jorden att gå ett varv runt solen?', ['Ett år', 'Ett dygn', 'En månad', 'En vecka'], 'Därför är ett år 365 dagar.'),
      QN('Vad är solen?', ['En stjärna', 'En planet', 'En måne', 'En komet'], 'Solen är vår närmaste stjärna.'),
      QN('Varför lyser månen?', ['Den speglar solens ljus', 'Den brinner', 'Den har lampor', 'Den är gjord av guld'], 'Månen har inget eget ljus.'),
      QN('Vad går månen runt?', ['Jorden', 'Solen', 'Mars', 'Inget'], 'Ett varv tar ungefär en månad.'),
      QN('Vad kallas det när hela månen syns rund och lysande?', ['Fullmåne', 'Nymåne', 'Halvmåne', 'Månförmörkelse'], 'Då är hela den solbelysta sidan vänd mot oss.'),
      QN('Hur många planeter finns det i vårt solsystem?', ['Åtta', 'Fem', 'Tio', 'Tolv'], 'Merkurius, Venus, Jorden, Mars, Jupiter, Saturnus, Uranus, Neptunus.'),
      QN('Vilken planet är närmast solen?', ['Merkurius', 'Jorden', 'Mars', 'Jupiter'], 'Merkurius är liten och mycket het.'),
      QN('Vilken planet kallas den röda planeten?', ['Mars', 'Venus', 'Jupiter', 'Saturnus'], 'Marken på Mars innehåller rost som gör den röd.'),
      QN('Vilken är den största planeten?', ['Jupiter', 'Jorden', 'Mars', 'Merkurius'], 'Jupiter är så stor att 1 300 jordklot skulle få plats i den.'),
      QN('Vad är Karlavagnen?', ['En stjärnbild', 'En planet', 'En måne', 'En raket'], 'Sju stjärnor som ser ut som en vagn.'),
      QN('Vad är det som gör att vi har årstider?', ['Jorden lutar lite när den går runt solen', 'Solen flyttar sig', 'Månen täcker solen', 'Jorden snurrar fortare på sommaren'], 'När vår del av jorden lutar mot solen är det sommar.'),
      ON('Sätt planeterna i ordning från solen:', ['Merkurius', 'Venus', 'Jorden', 'Mars'], 'De fyra innersta planeterna.'),
      ON('Sätt i storleksordning, minst först:', ['månen', 'jorden', 'solen'], 'Solen är över 100 gånger bredare än jorden.'),
    ] },
  { id: 'no_material', name: 'Material, kraft och ljus', short: 'Material & kraft', icon: '🧲', lgr: 'Materials egenskaper och hur material och föremål kan sorteras. Balans, tyngdpunkt och jämvikt. Friktion. Magneter. Ljusets egenskaper och skuggor. Hur ljud uppstår.',
    read: `<p>Saker är gjorda av olika <b>material</b>: trä, metall, plast, glas, papper, tyg. Material har olika <b>egenskaper</b>: hårt eller mjukt, tungt eller lätt, flyter eller sjunker, leder värme eller inte. <b>Magneter</b> drar till sig järn, men inte trä eller plast.</p><p><b>Friktion</b> är motståndet när saker gnids mot varandra. Lite friktion = halt (is, skridskor). Mycket friktion = greppar (gummisulor). <b>Tyngdpunkt</b> och <b>balans</b>: ett torn välter om tyngdpunkten hamnar utanför foten.</p><p><b>Ljus</b> går rakt fram. När något står i vägen blir det en <b>skugga</b>. <b>Ljud</b> uppstår när något <b>vibrerar</b> (darrar), som en gitarrsträng. Ljudet färdas genom luften till örat.</p>`,
    qs: [
      QN('Vilket material drar en magnet till sig?', ['Järn', 'Trä', 'Plast', 'Papper'], 'Magneter drar bara till sig vissa metaller, framför allt järn.'),
      QN('Varför är det halt på is?', ['Isen har väldigt lite friktion', 'Isen är mjuk', 'Isen är varm', 'Isen är gjord av glas'], 'Friktion = hur mycket det tar emot.'),
      QN('Vad händer med en skugga när ljuset kommer från sidan?', ['Den blir lång', 'Den försvinner', 'Den blir rund', 'Den blir ljus'], 'På morgonen och kvällen är skuggorna långa.'),
      QN('Hur uppstår ljud?', ['Något vibrerar', 'Något lyser', 'Något blir varmt', 'Något blir vått'], 'Känn på halsen när du pratar – det vibrerar!'),
      QN('Vilket material flyter på vatten?', ['Trä', 'Sten', 'Järn', 'Glas'], 'Trä är lättare än vatten.'),
      QN('Vad gör att ett högt torn av klossar välter?', ['Tyngdpunkten hamnar utanför foten', 'Klossarna är för färgglada', 'Det blåser', 'Klossarna är för lätta'], 'Bred bas och tyngd längst ner ger bra balans.'),
      QN('Varför har gymnastikskor gummisulor?', ['Gummi ger mycket friktion så man inte halkar', 'Gummi är billigt', 'Gummi ser fint ut', 'Gummi är tungt'], 'Mer friktion = bättre grepp.'),
      QN('Vad behövs för att det ska bli en skugga?', ['Ljus och något som står i vägen', 'Bara mörker', 'Vatten', 'Vind'], 'Ljuset går rakt fram och stoppas av föremålet.'),
      QN('Vilket material är genomskinligt?', ['Glas', 'Trä', 'Metall', 'Tyg'], 'Ljuset går igenom glaset.'),
      QN('Hur kan vi sortera skräp för återvinning?', ['Efter material: papper, plast, glas, metall', 'Efter färg', 'Efter storlek', 'Man kan inte sortera skräp'], 'Återvinning sparar på jordens resurser.'),
      QN('Vad händer med ljudet när något vibrerar snabbare?', ['Tonen blir ljusare (högre)', 'Tonen blir mörkare', 'Det blir tyst', 'Ljudet blir blått'], 'En kort, spänd sträng vibrerar snabbt och låter ljust.'),
      QN('Vilket material leder värme bäst?', ['Metall', 'Trä', 'Ull', 'Plast'], 'Därför blir en metallsked varm i den heta soppan.'),
    ] },
];

const SO2 = [
  { id: 'so_karta', name: 'Kartan, väderstreck och Sverige', short: 'Kartan', icon: '🧭', lgr: 'Rumsuppfattning med hjälp av mentala kartor och fysiska kartor över närområdet och Sverige. Väderstreck. Namn och läge på Sveriges landskap, Nordens länder, världsdelarna och världshaven.',
    read: `<p>En <b>karta</b> är en bild av marken sedd uppifrån. De fyra <b>väderstrecken</b> är <b>norr</b> (uppåt på kartan), <b>söder</b> (nedåt), <b>öster</b> (höger) och <b>väster</b> (vänster). En <b>kompass</b> pekar alltid mot norr.</p><p><b>Sverige</b> ligger i <b>Norden</b> tillsammans med Norge, Danmark, Finland och Island. Sveriges huvudstad är <b>Stockholm</b>. Luleå ligger i landskapet <b>Norrbotten</b>, långt upp i norr. Sverige är indelat i 25 landskap. Världen har sju <b>världsdelar</b>: Europa, Asien, Afrika, Nordamerika, Sydamerika, Oceanien och Antarktis.</p>`,
    qs: [
      QN('Vilket väderstreck är uppåt på en karta?', ['Norr', 'Söder', 'Öster', 'Väster'], 'Norr är nästan alltid uppåt.'),
      QN('Vilket väderstreck är till höger på kartan?', ['Öster', 'Väster', 'Norr', 'Söder'], 'Solen går upp i öster.'),
      QN('Vart pekar en kompass?', ['Mot norr', 'Mot söder', 'Mot solen', 'Mot hemmet'], 'Kompassnålen är en magnet som pekar mot norr.'),
      QN('Vad heter Sveriges huvudstad?', ['Stockholm', 'Göteborg', 'Luleå', 'Oslo'], 'Där finns riksdagen och kungen.'),
      QN('I vilket landskap ligger Luleå?', ['Norrbotten', 'Skåne', 'Lappland', 'Västerbotten'], 'Norrbotten är Sveriges nordligaste kustlandskap.'),
      QN('Vilka länder tillhör Norden?', ['Sverige, Norge, Danmark, Finland och Island', 'Sverige, Tyskland och Polen', 'Sverige, Spanien och Italien', 'Bara Sverige'], 'Norden = de nordiska länderna.'),
      QN('Vilket land ligger väster om Sverige?', ['Norge', 'Finland', 'Danmark', 'Ryssland'], 'Norge delar en lång gräns med Sverige i väster.'),
      QN('Vilket land ligger öster om Sverige, på andra sidan Bottenviken?', ['Finland', 'Norge', 'Danmark', 'Island'], 'Från Luleå är det nära till Finland.'),
      QN('I vilken världsdel ligger Sverige?', ['Europa', 'Asien', 'Afrika', 'Nordamerika'], 'Europa är en av sju världsdelar.'),
      QN('Hur många världsdelar finns det?', ['Sju', 'Fem', 'Tre', 'Tio'], 'Europa, Asien, Afrika, Nordamerika, Sydamerika, Oceanien, Antarktis.'),
      QN('Vad kallas den stora, öppna ytan av salt vatten mellan världsdelarna?', ['Hav', 'Sjö', 'Älv', 'Bäck'], 'Till exempel Atlanten och Stilla havet.'),
      QN('Vad visar blått på en karta?', ['Vatten', 'Skog', 'Berg', 'Städer'], 'Sjöar, hav och älvar.'),
      QN('Om du går mot norr från Luleå, vad kommer du till så småningom?', ['Lappland och fjällen', 'Stockholm', 'Danmark', 'Göteborg'], 'Norr om Norrbotten ligger Lappland och sedan Norge.'),
      ON('Sätt i ordning från norr till söder:', ['Luleå', 'Umeå', 'Stockholm', 'Malmö'], 'Luleå ligger längst norrut, Malmö längst söderut.'),
    ] },
  { id: 'so_trafik', name: 'Trafik och säkerhet', short: 'Trafik', icon: '🚦', lgr: 'Trafikregler och hur man beter sig i trafiken på ett säkert sätt.',
    read: `<p>I trafiken gäller regler för att ingen ska skadas. Som <b>fotgängare</b> går du på trottoaren eller, om det inte finns någon, på vägens <b>vänstra</b> sida så att du ser bilarna som kommer emot dig. Du går över gatan vid ett <b>övergångsställe</b>: stanna, titta åt vänster, höger och vänster igen, och gå först när det är fritt. Rött ljus = stanna, grönt = gå.</p><p>På <b>cykel</b> ska du ha <b>hjälm</b> (lag tills man fyllt 15), och cykeln ska ha lampor och <b>reflexer</b>. Cyklister kör på vägens <b>högra</b> sida. <b>Reflexer</b> gör att bilar ser dig i mörkret – utan reflex syns du först på 20–30 meter, med reflex på över 100 meter. I bilen ska alla ha <b>bälte</b>.</p>`,
    qs: [
      QN('Vilken sida ska du gå på om det inte finns trottoar?', ['Vänster sida, mot trafiken', 'Höger sida', 'Mitt på vägen', 'Det spelar ingen roll'], 'Då ser du bilarna som kommer emot dig.'),
      QN('Vad betyder rött ljus för fotgängare?', ['Stanna och vänta', 'Spring fort', 'Gå', 'Titta åt höger'], 'Vänta tills det blir grönt.'),
      QN('Vad ska du ha på huvudet när du cyklar?', ['Hjälm', 'Mössa', 'Keps', 'Inget'], 'Lag för alla under 15 år – och smart för alla.'),
      QN('Vilken sida cyklar man på?', ['Höger sida', 'Vänster sida', 'Mitt på vägen', 'På trottoaren'], 'Cykeln är ett fordon och följer högertrafik.'),
      QN('Varför ska du ha reflexer i mörkret?', ['Bilförare ser dig mycket tidigare', 'De är fina', 'De lyser upp vägen', 'De håller värmen'], 'Med reflex syns du på över 100 meters håll.'),
      QN('Hur gör du innan du går över ett övergångsställe?', ['Stannar och tittar vänster, höger, vänster', 'Springer snabbt', 'Tittar på mobilen', 'Blundar'], 'Gå först när det är fritt, och gå – spring inte.'),
      QN('Vad ska alla i bilen ha på sig?', ['Bilbälte', 'Hjälm', 'Reflex', 'Mössa'], 'Bältet håller fast dig om bilen bromsar hårt.'),
      QN('Vad betyder en skylt med en gående person i en blå cirkel?', ['Gångbana – här ska fotgängare gå', 'Förbjudet att gå', 'Här får bilar köra', 'Cykelbana'], 'Blå runda skyltar är påbud – det man ska göra.'),
      QN('Vad betyder en trekantig skylt med röd kant?', ['Varning', 'Stopp', 'Parkering', 'Gå här'], 'Trekant med röd kant = var uppmärksam, här finns en fara.'),
      QN('Vad betyder en rund skylt med röd kant?', ['Förbud – det är inte tillåtet', 'Varning', 'Här får man göra det', 'Information'], 'Till exempel förbjudet att cykla.'),
      QN('När får en cykel saknas lampor?', ['Aldrig i mörker', 'Alltid', 'På sommaren', 'När man har hjälm'], 'Vit lampa fram, röd lampa bak när det är mörkt.'),
      QN('Vad gör du om bollen rullar ut i gatan?', ['Stannar och tittar innan du hämtar den', 'Springer efter den direkt', 'Ropar på bollen', 'Kastar en till'], 'Bilarna hinner inte stanna om du springer ut.'),
    ] },
  { id: 'so_samhalle', name: 'Regler, demokrati och pengar', short: 'Samhället', icon: '🏛️', lgr: 'Normer och regler i elevernas vardag. Demokratiska beslut i klassen (klassråd). Pengars användning och värde. Barnets rättigheter enligt barnkonventionen. Yrken och verksamheter i närområdet.',
    read: `<p>Överallt finns <b>regler</b>: i familjen, i skolan, i trafiken och i lagar som gäller alla i Sverige. Regler finns för att vi ska vara snälla och säkra tillsammans.</p><p><b>Demokrati</b> betyder att alla får vara med och bestämma. I klassen har ni <b>klassråd</b> där ni <b>röstar</b> – det förslag som får flest röster vinner. I Sverige väljer vuxna vilka som ska sitta i <b>riksdagen</b> och bestämma lagar.</p><p><b>Barnkonventionen</b> är regler som säger att alla barn har rätt att gå i skolan, att vara trygga, att säga vad de tycker, att leka och att vila. <b>Pengar</b> används för att köpa saker. Vuxna får lön när de arbetar. Olika <b>yrken</b> behövs i ett samhälle: lärare, läkare, brandman, polis, busschaufför, bagare.</p>`,
    qs: [
      QN('Vad betyder demokrati?', ['Att alla får vara med och bestämma', 'Att en person bestämmer allt', 'Att ingen bestämmer', 'Att bara vuxna får prata'], 'Demos = folk, krati = styre.'),
      QN('Hur fattar man beslut på ett klassråd?', ['Alla får säga sitt och sedan röstar man', 'Läraren bestämmer', 'Den som skriker högst vinner', 'Man singlar slant'], 'Förslaget med flest röster vinner.'),
      QN('Varför finns det regler?', ['För att alla ska vara trygga och må bra tillsammans', 'För att vuxna gillar regler', 'För att det ska vara tråkigt', 'Ingen vet'], 'Regler skyddar oss och gör det rättvist.'),
      QN('Vad är barnkonventionen?', ['Regler om alla barns rättigheter', 'En bok med sagor', 'En skola', 'En lek'], 'Den gäller alla barn i hela världen och är lag i Sverige.'),
      QN('Vilket är en rättighet alla barn har enligt barnkonventionen?', ['Att gå i skolan', 'Att äta godis varje dag', 'Att köra bil', 'Att bestämma över vuxna'], 'Även rätt till trygghet, lek, vila och att säga sin åsikt.'),
      QN('Vad får vuxna när de arbetar?', ['Lön', 'Betyg', 'Medalj', 'Presenter'], 'Lön är pengar för arbetet.'),
      QN('Vad heter Sveriges valuta (pengar)?', ['Kronor', 'Euro', 'Dollar', 'Pund'], '1 krona = 100 öre.'),
      QN('Vem släcker bränder?', ['Brandmän', 'Poliser', 'Läkare', 'Bagare'], 'Ring 112 om det brinner.'),
      QN('Vilket nummer ringer du vid en olycka?', ['112', '911', '123', '100'], 'SOS Alarm svarar på 112 i hela Sverige.'),
      QN('Vem bestämmer lagarna i Sverige?', ['Riksdagen', 'Kungen', 'Polisen', 'Lärarna'], 'Riksdagen väljs av folket vart fjärde år.'),
      QN('Vad är en kompromiss?', ['Att båda ger med sig lite så alla blir nöjda', 'Att en vinner allt', 'Att man slåss', 'Att man går hem'], 'Bra när man inte tycker lika.'),
      QN('Vad betyder det att vara källkritisk?', ['Att fundera på om det man läser eller hör är sant', 'Att läsa allt', 'Att tro på allt', 'Att kritisera kompisar'], 'Vem säger det? Hur vet de det? Kan jag kolla på ett annat ställe?'),
    ] },
  { id: 'so_hogtider', name: 'Högtider, traditioner och förr i tiden', short: 'Förr & högtider', icon: '🕯️', lgr: 'Kristendomens roll i skolan och på hemorten förr i tiden. Religioner och platser för religionsutövning i närområdet. Några högtider, symboler och berättelser inom kristendom, islam och judendom. Hemortens historia och livet förr.',
    read: `<p><b>Högtider</b> är dagar vi firar. Många svenska högtider kommer från <b>kristendomen</b>: <b>jul</b> (Jesus föds), <b>påsk</b> (Jesus dör och uppstår) och <b>lucia</b> den 13 december. <b>Midsommar</b> firar sommaren med stång och dans.</p><p>I Sverige finns många <b>religioner</b>. Kristna går till <b>kyrkan</b>, muslimer till <b>moskén</b> och judar till <b>synagogan</b>. Inom <b>islam</b> fastar man under <b>ramadan</b> och firar <b>eid</b>. Inom <b>judendomen</b> firar man <b>chanukka</b> med ljus.</p><p><b>Förr i tiden</b> fanns inga bilar, datorer eller elektricitet. Barn i Luleå för 100 år sedan gick till skolan till fots, skrev på griffeltavla och många hjälpte till med djur och fiske. Vi kan lära oss om förr genom gamla <b>foton</b>, <b>föremål</b> och genom att <b>fråga äldre</b> människor.</p>`,
    qs: [
      QN('Vad firar man på julen inom kristendomen?', ['Att Jesus föddes', 'Att det är vinter', 'Att skolan slutar', 'Att Jesus uppstod'], 'Julen firas den 24–25 december.'),
      QN('Vad firar kristna på påsken?', ['Att Jesus dog och uppstod', 'Att Jesus föddes', 'Att det är vår', 'Att ägg är goda'], 'Påsken är kristendomens viktigaste högtid.'),
      QN('Vilket datum är lucia?', ['13 december', '24 december', '1 januari', '6 juni'], 'Lucia går med ljus i håret i den mörkaste tiden.'),
      QN('Var går muslimer för att be?', ['Moskén', 'Kyrkan', 'Synagogan', 'Templet'], 'Moskén är islams gudstjänstlokal.'),
      QN('Vad heter judarnas gudstjänstlokal?', ['Synagogan', 'Kyrkan', 'Moskén', 'Skolan'], 'Där läser man ur Toran.'),
      QN('Vad är ramadan?', ['En månad då muslimer fastar på dagen', 'En jullek', 'En stad', 'En maträtt'], 'Efter ramadan firas eid med fest och mat.'),
      QN('När firas midsommar?', ['I juni', 'I december', 'I mars', 'I oktober'], 'Nära årets längsta dag.'),
      QN('Vad är en tradition?', ['Något man gör på samma sätt år efter år', 'En ny uppfinning', 'En sorts mat', 'En bok'], 'Till exempel att äta semla på fettisdagen.'),
      QN('Hur kan vi ta reda på hur det var förr i tiden?', ['Gamla foton, föremål och äldre människors berättelser', 'Gissa', 'Titta på nya filmer', 'Det går inte'], 'Det kallas historiska källor.'),
      QN('Vad skrev barn på i skolan för 100 år sedan?', ['Griffeltavla', 'Dator', 'Surfplatta', 'Mobil'], 'En liten tavla av skiffer som man skrev på med en griffel.'),
      QN('Vilket av detta fanns INTE för 100 år sedan?', ['Internet', 'Hästar', 'Båtar', 'Kyrkor'], 'Internet kom på 1990-talet.'),
      QN('Vad är en symbol för kristendomen?', ['Korset', 'Halvmånen', 'Davidsstjärnan', 'Hjulet'], 'Halvmånen förknippas med islam och Davidsstjärnan med judendomen.'),
      ON('Sätt i ordning, äldst först:', ['hästdroska', 'ångtåg', 'bil', 'rymdraket'], 'Hur människor rest genom historien.'),
      ON('Sätt årets högtider i ordning, börja från januari:', ['påsk', 'midsommar', 'lucia', 'jul'], 'Påsk på våren, midsommar i juni, lucia 13 december, jul 24 december.'),
    ] },
];

// Generator: 75 % flervalsfråga, 25 % sätt-i-ordning (när ämnet har sådana), undviker upprepning
const recentNS = {};
function makeNaSoGen(topic) {
  return function gen(level, opts = {}) {
    const recent = recentNS[topic.id] || (recentNS[topic.id] = []);
    const orders = topic.qs.filter(q => q.order); const plain = topic.qs.filter(q => !q.order);
    if (!opts.noOpen && orders.length && R.chance(level >= 2 ? 0.3 : 0.2)) {
      const o = R.pick(orders);
      return { type: 'order', text: o.q, items: o.items.slice(), answer: o.items, steps: [`<b>Rätt ordning:</b> ${o.items.join(' → ')}`, o.why], hint: 'Vad kommer först?', level };
    }
    let pool = plain.filter(q => !recent.includes(q)); if (!pool.length) { recent.length = 0; pool = plain.slice(); }
    const item = R.pick(pool); recent.push(item); if (recent.length > Math.max(3, plain.length - 2)) recent.shift();
    const correct = item.choices[0]; const choices = R.shuffle(item.choices.slice(0, level === 1 ? 3 : 4));
    return { type: 'choicetext', text: item.q, choices, answer: choices.indexOf(correct), steps: [item.why], hint: 'Läs på-sidan har svaret. Ett alternativ passar bäst.', level };
  };
}
const lgrTag = (t, subj) => `<div class="eyebrow" style="margin-bottom:6px">Lgr22 · ${subj} åk 1–3</div><p class="muted" style="font-size:.9rem;margin:0 0 10px"><i>${t.lgr}</i></p>`;
const NASO_SKILLS = {
  ak2: [
    ...NO2.map(t => ({ id: t.id, name: t.name, short: t.short, icon: t.icon, group: 'no', subject: 'NO', gen: makeNaSoGen(t), method: lgrTag(t, 'NO') + t.read })),
    ...SO2.map(t => ({ id: t.id, name: t.name, short: t.short, icon: t.icon, group: 'so', subject: 'SO', gen: makeNaSoGen(t), method: lgrTag(t, 'SO') + t.read })),
  ],
};
if (typeof module !== 'undefined') module.exports = { NO2, SO2, NASO_SKILLS };
