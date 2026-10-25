/* ========= SO: Geografi åk 4 (Puls SO 4, s. 36–73) – kunskapsfrågor per lärmål ========= */
// Q: question, choices (first is correct), why (short explanation shown after answer)
const Q = (q, choices, why) => ({ q, choices, why });
const GEO4 = [
  { id: 'geo_kartor_forr', name: 'Kartor förr och nu', short: 'Kartor förr/nu', icon: '🗺️',
    read: `<p>För flera hundra år sedan ritades kartor <b>för hand</b>. Sjömän och upptäcktsresande mätte med kompass och sol och ritade det de såg, så kartorna blev ofta fel. Idag ritas kartor med <b>satellitbilder och GPS</b> och är mycket exakta.</p><p class="ex">Jorden är ett klot. En platt karta kan aldrig bli helt rätt – något måste töjas ut. Därför ser Grönland jättestort ut på många världskartor.</p><p>Olika kartor för olika saker: en <b>topografisk</b> karta visar hur landskapet ser ut (höjder, vatten, vägar). En <b>tematisk</b> karta visar en sak, t.ex. var folk bor eller hur klimatet är. En <b>jordglob</b> visar jorden i rätt form.</p>`,
    qs: [
      Q('Hur ritades kartor för flera hundra år sedan?', ['För hand, utifrån vad sjömän och upptäcktsresande såg och mätte', 'Med satellitbilder', 'Med drönare', 'Med datorprogram'], 'Förr fanns inga satelliter. Man mätte med kompass och ritade det man såg – och det blev ofta fel.'),
      Q('Hur ritas kartor idag?', ['Med satellitbilder och GPS-mätningar', 'Genom att gissa', 'Bara för hand', 'Genom att kopiera gamla kartor'], 'Satelliter fotograferar jorden och GPS mäter exakta lägen.'),
      Q('Varför kan en platt världskarta aldrig vara helt korrekt?', ['Jorden är rund och går inte att platta ut utan att något töjs', 'Kartritarna slarvar', 'Haven är för stora', 'Länderna flyttar på sig'], 'Prova att platta ut ett apelsinskal – det går sönder eller töjs. Samma sak med jordens yta.'),
      Q('Vad händer med Grönland på många platta världskartor?', ['Det ser mycket större ut än det egentligen är', 'Det försvinner', 'Det ser mindre ut', 'Det hamnar vid ekvatorn'], 'Nära polerna töjs kartan ut mest. Grönland är i verkligheten ungefär lika stort som Mexiko.'),
      Q('Vilken karta visar landskapet som det ser ut: höjder, vatten och vägar?', ['Topografisk karta', 'Tematisk karta', 'Tunnelbanekarta', 'Väderkarta'], 'Topografi betyder ungefär "platsbeskrivning".'),
      Q('En karta som visar en enda sak, t.ex. var människor bor eller klimatet, kallas …', ['Tematisk karta', 'Topografisk karta', 'Sjökort', 'Jordglob'], 'Tema = ämne. En tematisk karta har ett ämne.'),
      Q('Vad visar jorden i rätt form och med rätt storlek på länderna?', ['En jordglob', 'En platt världskarta', 'En stadskarta', 'En tematisk karta'], 'Globen är rund som jorden, så inget behöver töjas.'),
      Q('Vilken karta är bäst när du ska hitta en gata i en stad?', ['Stadskarta eller digital karta', 'Världskarta', 'Klimatkarta', 'Jordglob'], 'Ju mindre område kartan visar, desto fler detaljer får plats.'),
    ] },
  { id: 'geo_lasa_karta', name: 'Läsa en karta: tecken, färger och skala', short: 'Läsa karta', icon: '🔍',
    read: `<p><b>Karttecken</b> är små symboler för t.ex. kyrka, väg eller järnväg. <b>Teckenförklaringen</b> talar om vad de betyder. Färger: <b>blått</b> = vatten, <b>grönt</b> = skog, <b>gult</b> = åker och öppen mark, <b>brunt</b> på världskartor = högt land och berg.</p><p>Kartan visar både sådant som finns i naturen (sjöar, berg) och sådant som <b>människor bestämt</b> (gränser, län, kommuner).</p><p class="ex"><b>Skala</b> talar om hur mycket kartan är förminskad. 1:50 000 betyder att 1 cm på kartan är 50 000 cm = 500 m i verkligheten. 2 cm blir då 1 km.</p>`,
    qs: [
      Q('Vad kallas de små symbolerna på en karta som visar t.ex. kyrka eller järnväg?', ['Karttecken', 'Gradnät', 'Skala', 'Register'], 'Karttecknen förklaras i teckenförklaringen.'),
      Q('Vad betyder blå färg på en karta?', ['Vatten', 'Skog', 'Åker', 'Berg'], 'Sjöar, hav och älvar är blå.'),
      Q('Vad betyder grön färg på de flesta kartor?', ['Skog', 'Vatten', 'Stad', 'Öken'], 'Grönt = skog och grönområden.'),
      Q('Vad är ofta gult på en karta över Sverige?', ['Åkermark och öppen mark', 'Hav', 'Fjäll', 'Städer'], 'Gult brukar vara åkrar och ängar.'),
      Q('Vad visar brun färg på en världskarta?', ['Högt land och berg', 'Skog', 'Sjöar', 'Städer'], 'Ju mörkare brunt, desto högre.'),
      Q('Vad är en teckenförklaring?', ['En ruta som förklarar vad karttecknen betyder', 'En lista över länder', 'Ett rutnät på kartan', 'Kartans titel'], 'Hitta alltid teckenförklaringen först när du får en ny karta.'),
      Q('Vilket av detta finns INTE i naturen utan är något människor har bestämt?', ['Gränsen mellan två län', 'En sjö', 'Ett berg', 'En älv'], 'Gränser syns inte i naturen – de finns bara på kartan och i våra regler.'),
      Q('Vad talar skalan om?', ['Hur mycket kartan är förminskad jämfört med verkligheten', 'Hur gammal kartan är', 'Vilka färger som används', 'Vem som ritat kartan'], 'Skala 1:100 000 betyder att verkligheten är 100 000 gånger större än kartan.'),
      Q('Skala 1:100 000. Hur långt är 1 cm på kartan i verkligheten?', ['1 km', '100 m', '10 km', '1 m'], '1 cm · 100 000 = 100 000 cm = 1 000 m = 1 km.'),
      { num: true, q: 'Kartan har skala 1:50 000. Två byar ligger 4 cm från varandra på kartan. Hur många kilometer är det i verkligheten?', answer: 2, why: '4 cm · 50 000 = 200 000 cm = 2 000 m = 2 km.' },
      { num: true, q: 'Kartan har skala 1:100 000. Avståndet på kartan är 3 cm. Hur många kilometer är det i verkligheten?', answer: 3, why: '1 cm = 1 km i den här skalan, så 3 cm = 3 km.' },
      { num: true, q: 'Skala 1:10 000. På kartan är det 5 cm. Hur många meter i verkligheten?', answer: 500, why: '5 cm · 10 000 = 50 000 cm = 500 m.' },
      { num: true, q: 'Skala 1:200 000. På kartan är det 2 cm. Hur många kilometer i verkligheten?', answer: 4, why: '2 cm · 200 000 = 400 000 cm = 4 km.' },
    ] },
  { id: 'geo_hitta', name: 'Hitta en plats på kartan', short: 'Hitta plats', icon: '📍',
    read: `<p>I en kartbok finns ett <b>register</b> längst bak. Där står alla orter i bokstavsordning med sidnummer och ruta, t.ex. "Luleå 14 C3".</p><p><b>Gradnätet</b> är kartans rutnät. <b>Breddgrader</b> går runt jorden parallellt med ekvatorn (de talar om hur långt norrut eller söderut). <b>Längdgrader</b> går från pol till pol (öst–väst).</p><p class="ex">En digital karta (t.ex. i mobilen) kan också visa vägen dit och hur lång tid det tar.</p>`,
    qs: [
      Q('Var i kartboken hittar du en lista över alla orter?', ['I registret längst bak', 'På första sidan', 'I teckenförklaringen', 'På baksidan'], 'Registret är i bokstavsordning och anger sida och ruta.'),
      Q('Vad är gradnätet?', ['Rutnätet av linjer som hjälper dig att ange ett läge på kartan', 'Kartans färger', 'En lista över länder', 'Kartans skala'], 'Linjerna heter breddgrader och längdgrader.'),
      Q('Vilka linjer går runt jorden parallellt med ekvatorn?', ['Breddgrader', 'Längdgrader', 'Gränser', 'Höjdkurvor'], 'Breddgrader talar om hur långt norrut eller söderut en plats ligger.'),
      Q('Vilka linjer går från Nordpolen till Sydpolen?', ['Längdgrader', 'Breddgrader', 'Ekvatorn', 'Polcirkeln'], 'Längdgrader talar om hur långt österut eller västerut en plats ligger.'),
      Q('Registret säger "Luleå 14 C3". Vad betyder det?', ['Sidan 14, i rutan C3', 'Luleå har 14 invånare', 'Kartan har skala 1:14', 'Luleå ligger 14 km bort'], 'Siffran är sidan, bokstav + siffra är rutan i gradnätet.'),
      Q('Vad kan en digital karta göra som en papperskarta inte kan?', ['Visa vägen dit och hur lång tid det tar', 'Visa hav', 'Visa städer', 'Visa gränser'], 'Mobilen vet var du är (GPS) och kan räkna ut resvägen.'),
    ] },
  { id: 'geo_sverige_lage', name: 'Sveriges läge i världen', short: 'Sveriges läge', icon: '🌍',
    read: `<p>Sverige ligger i <b>Europa</b>, i <b>norra Europa</b>, på <b>norra halvklotet</b>. Tillsammans med Norge ligger Sverige på <b>Skandinaviska halvön</b>. Grannländer på land är <b>Norge</b> och <b>Finland</b>.</p><p class="ex"><b>Ekvatorn</b> är en tänkt linje runt jordens mitt. Den delar jorden i norra och södra halvklotet. Sverige ligger långt norr om ekvatorn.</p><p>Hav runt Sverige: <b>Östersjön</b> i öster, <b>Bottniska viken</b> i nordost, <b>Kattegatt</b> och <b>Skagerrak</b> i väster.</p>`,
    qs: [
      Q('På vilket halvklot ligger Sverige?', ['Norra halvklotet', 'Södra halvklotet', 'Både och', 'Inget halvklot'], 'Sverige ligger långt norr om ekvatorn.'),
      Q('I vilken världsdel ligger Sverige?', ['Europa', 'Asien', 'Nordamerika', 'Afrika'], 'Sverige ligger i norra Europa.'),
      Q('Vad är ekvatorn?', ['En tänkt linje runt jordens mitt som delar jorden i två halvklot', 'En flod i Afrika', 'Nordpolen', 'En bergskedja'], 'Vid ekvatorn är det varmt året runt.'),
      Q('Vilka två länder gränsar till Sverige på land?', ['Norge och Finland', 'Danmark och Tyskland', 'Norge och Ryssland', 'Finland och Estland'], 'Mot Danmark går gränsen i havet (och över Öresundsbron).'),
      Q('Vilken halvö ligger Sverige på?', ['Skandinaviska halvön', 'Iberiska halvön', 'Jylland', 'Balkanhalvön'], 'Sverige och Norge delar Skandinaviska halvön.'),
      Q('Vilket hav ligger öster om Sverige?', ['Östersjön', 'Atlanten', 'Medelhavet', 'Nordsjön'], 'Östersjön är ett bräckt innanhav – lite salt.'),
      Q('Vilka hav ligger väster om Sverige, mot Danmark och Norge?', ['Kattegatt och Skagerrak', 'Östersjön och Bottenviken', 'Medelhavet', 'Stilla havet'], 'Göteborg ligger vid Kattegatt.'),
      Q('Vilken del av Europa ligger Sverige i?', ['Norra Europa', 'Södra Europa', 'Östra Europa', 'Västra Europa'], 'Norden = Sverige, Norge, Danmark, Finland och Island.'),
    ] },
  { id: 'geo_indelning', name: 'Landsdelar, landskap, län och kommuner', short: 'Indelningar', icon: '🧩',
    read: `<p>Sverige delas in på flera sätt. Tre <b>landsdelar</b>: <b>Norrland</b> (störst, i norr), <b>Svealand</b> (mitten) och <b>Götaland</b> (söder). <b>25 landskap</b> är den gamla indelningen (Norrbotten, Lappland, Skåne, Småland, Gotland …). <b>21 län</b> styrs av länsstyrelsen. <b>290 kommuner</b> sköter skola, förskola, äldreomsorg, vatten och sopor. <b>Regionerna</b> ansvarar för sjukvården och bussar/tåg.</p><p class="ex">Luleå ligger i landskapet Norrbotten, i Norrbottens län, i landsdelen Norrland.</p>`,
    qs: [
      Q('Vilka är Sveriges tre landsdelar?', ['Götaland, Svealand och Norrland', 'Skåne, Småland och Norrland', 'Norrland, Lappland och Götaland', 'Svealand, Stockholm och Göteborg'], 'Från söder till norr: Götaland, Svealand, Norrland.'),
      Q('Vilken landsdel är störst till ytan?', ['Norrland', 'Svealand', 'Götaland', 'Alla är lika stora'], 'Norrland är ungefär hälften av hela Sverige.'),
      Q('I vilken landsdel ligger Luleå?', ['Norrland', 'Svealand', 'Götaland', 'Lappland'], 'Luleå ligger i Norrbotten, längst upp i Norrland.'),
      Q('I vilken landsdel ligger Stockholm?', ['Svealand', 'Götaland', 'Norrland', 'Skåne'], 'Stockholm ligger i landskapen Uppland och Södermanland, i Svealand.'),
      Q('I vilken landsdel ligger Göteborg och Malmö?', ['Götaland', 'Svealand', 'Norrland', 'Finland'], 'Hela södra Sverige är Götaland.'),
      Q('Hur många landskap finns det i Sverige?', ['25', '21', '290', '3'], '25 landskap, 21 län, 290 kommuner.'),
      Q('Hur många län finns det i Sverige?', ['21', '25', '290', '10'], 'Länen är den indelning staten använder. Varje län har en länsstyrelse.'),
      Q('Ungefär hur många kommuner finns det i Sverige?', ['290', '25', '21', '1 000'], 'Kommunerna är den minsta indelningen.'),
      Q('Vad ansvarar regionerna för?', ['Sjukvården och kollektivtrafiken', 'Skolorna', 'Soporna', 'Polisen'], 'Sjukhus och vårdcentraler sköts av regionen, t.ex. Region Norrbotten.'),
      Q('Vilket av detta är en uppgift för kommunen?', ['Skolor, förskolor och äldreomsorg', 'Sjukhus', 'Försvaret', 'Pass och körkort'], 'Kommunen sköter också vatten, sopor, gator och bibliotek.'),
      Q('Vem bestämmer i en kommun?', ['Politiker som valts i val (kommunfullmäktige)', 'Kungen', 'Rektorn', 'Polisen'], 'Vart fjärde år röstar invånarna fram kommunfullmäktige.'),
      Q('I vilket landskap ligger Luleå?', ['Norrbotten', 'Lappland', 'Västerbotten', 'Skåne'], 'Norrbotten är kustlandskapet; Lappland ligger i inlandet.'),
      Q('I vilket landskap ligger Malmö?', ['Skåne', 'Småland', 'Blekinge', 'Halland'], 'Skåne är Sveriges sydligaste landskap.'),
      Q('Vilket landskap är en ö i Östersjön?', ['Gotland', 'Öland', 'Skåne', 'Dalarna'], 'Gotland är både landskap, län och kommun. Öland är också en ö men hör till Kalmar län.'),
      Q('Vilket är Sveriges nordligaste och till ytan största landskap?', ['Lappland', 'Norrbotten', 'Jämtland', 'Dalarna'], 'Lappland är nästan en fjärdedel av Sverige.'),
    ] },
  { id: 'geo_befolkning', name: 'Var bor människor i Sverige?', short: 'Befolkning', icon: '🏙️',
    read: `<p>I Sverige bor ungefär <b>10,5 miljoner</b> människor. De flesta bor i <b>södra Sverige</b>, <b>längs kusterna</b> och i <b>städer</b>. De tre största städerna är <b>Stockholm, Göteborg och Malmö</b>.</p><p class="ex"><b>Norrlands inland</b> är glesbefolkat: kallt klimat, långa avstånd och färre jobb har gjort att få bor där. Vid kusten i Norrland, som i Luleå, bor det fler.</p>`,
    qs: [
      Q('Var bor de flesta människor i Sverige?', ['I södra Sverige, längs kusterna och i städer', 'I fjällen', 'I Norrlands inland', 'Jämnt spritt över hela landet'], 'Södra Sverige har mildare klimat och mer åkermark, och städerna växte där.'),
      Q('Vilka är Sveriges tre största städer?', ['Stockholm, Göteborg, Malmö', 'Stockholm, Luleå, Kiruna', 'Uppsala, Lund, Umeå', 'Göteborg, Malmö, Visby'], 'Stockholm är huvudstad och störst.'),
      Q('Ungefär hur många människor bor i Sverige?', ['Cirka 10,5 miljoner', 'Cirka 1 miljon', 'Cirka 50 miljoner', 'Cirka 100 000'], 'Sverige är stort till ytan men har ganska få invånare.'),
      Q('Vilken del av Sverige är mest glesbefolkad?', ['Norrlands inland', 'Skåne', 'Stockholmsområdet', 'Västkusten'], 'Glesbefolkad = få människor per kvadratkilometer.'),
      Q('Varför bor det få människor i Norrlands inland?', ['Kallt klimat, långa avstånd och färre jobb', 'Det är förbjudet att bo där', 'Det finns inga vägar', 'Marken är giftig'], 'Vid Norrlandskusten, t.ex. Luleå och Umeå, bor det däremot ganska många.'),
      Q('Vad betyder att ett område är tätbefolkat?', ['Många människor bor nära varandra', 'Det finns tät skog', 'Det är få människor', 'Det regnar mycket'], 'Motsatsen heter glesbefolkat.'),
    ] },
  { id: 'geo_klimat', name: 'Klimat och årstider', short: 'Klimat', icon: '🌡️',
    read: `<p><b>Väder</b> är hur det är just nu eller idag. <b>Klimat</b> är det vanliga vädret på en plats under många år.</p><p>Det är kallare i norr för att solen står lägre och värmer mindre, och vintern är längre. I norra Norrland, norr om <b>polcirkeln</b>, är det <b>midnattssol</b> på sommaren och <b>polarnatt</b> på vintern.</p><p class="ex"><b>Golfströmmen</b> är en varm havsström från Mexikanska golfen. Den värmer luften över Norden, så Sverige har mycket mildare klimat än andra platser lika långt norrut (t.ex. Alaska och Sibirien).</p>`,
    qs: [
      Q('Vad är skillnaden mellan väder och klimat?', ['Väder är just nu, klimat är det vanliga vädret under många år', 'De betyder samma sak', 'Klimat är bara regn', 'Väder är bara på sommaren'], 'Klimat är som ett medelvärde av vädret i 30 år.'),
      Q('Varför är det kallare i norra Sverige än i södra?', ['Solen står lägre och värmer mindre, och vintern är längre', 'Det finns mer skog', 'Det blåser mer', 'Det är närmare havet'], 'Ju närmare polerna, desto snedare träffar solstrålarna.'),
      Q('Vad är Golfströmmen?', ['En varm havsström som gör Sveriges klimat mildare', 'En kall vind från Norge', 'En älv i Norrland', 'En ö i Atlanten'], 'Utan Golfströmmen skulle Sverige vara lika kallt som Alaska.'),
      Q('Var kommer Golfströmmen ifrån?', ['Mexikanska golfen', 'Nordpolen', 'Östersjön', 'Medelhavet'], 'Den rinner över Atlanten upp mot Norden.'),
      Q('Var i Sverige är vintern längst?', ['I norra Sverige och fjällen', 'I Skåne', 'På Gotland', 'I Göteborg'], 'I fjällen kan snön ligga från oktober till maj.'),
      Q('Vad kallas det när solen inte går ner alls på sommaren?', ['Midnattssol', 'Polarnatt', 'Norrsken', 'Solförmörkelse'], 'Midnattssol finns norr om polcirkeln.'),
      Q('Vad kallas den tänkta linjen norr om vilken man kan se midnattssol?', ['Polcirkeln', 'Ekvatorn', 'Golfströmmen', 'Vändkretsen'], 'Polcirkeln går genom norra Norrland, strax norr om Luleå.'),
      Q('Hur många årstider har Sverige?', ['Fyra', 'Två', 'Tre', 'Sex'], 'Vår, sommar, höst och vinter – men i norr är vintern mycket längre.'),
    ] },
  { id: 'geo_naturtyper', name: 'Sveriges naturtyper', short: 'Naturtyper', icon: '🌲',
    read: `<p><b>Fjäll</b>: höga berg i nordväst, kalfjäll utan träd ovanför trädgränsen. Högsta berget är <b>Kebnekaise</b>. <b>Barrskog</b> (gran och tall) täcker mest av Norrland. <b>Lövskog</b> (ek, bok) finns i söder. <b>Slätter</b> med åkrar finns i Skåne och runt Vänern/Vättern. <b>Myrar</b> är våtmarker. <b>Skärgård</b> är kusten med tusentals öar, t.ex. utanför Stockholm och Luleå.</p><p class="ex">Största sjön är <b>Vänern</b>, näst störst <b>Vättern</b>.</p>`,
    qs: [
      Q('Vilken naturtyp finns i nordvästra Sverige med höga berg och kalfjäll?', ['Fjäll', 'Slätt', 'Lövskog', 'Skärgård'], 'Ovanför trädgränsen växer inga träd – det kallas kalfjäll.'),
      Q('Vilken skog täcker den största delen av Norrland?', ['Barrskog (gran och tall)', 'Lövskog (ek och bok)', 'Regnskog', 'Palmskog'], 'Barrträd klarar kyla och lång vinter.'),
      Q('Var i Sverige finns mest lövskog med ek och bok?', ['I södra Sverige', 'I fjällen', 'I Norrbotten', 'På kalfjället'], 'Lövträd trivs i det mildare klimatet i söder.'),
      Q('Vad kallas ett stort, platt område med åkrar?', ['Slätt', 'Fjäll', 'Myr', 'Skärgård'], 'Skåne är känt för sina slätter.'),
      Q('Vad är en myr?', ['En blöt våtmark med mossa', 'Ett högt berg', 'En stor sjö', 'En skog'], 'Myrar är vanliga i Norrland.'),
      Q('Vad kallas kusten med många öar, t.ex. utanför Stockholm och Luleå?', ['Skärgård', 'Slätt', 'Fjäll', 'Hed'], 'Luleå skärgård har över tusen öar.'),
      Q('Vilken är Sveriges största sjö?', ['Vänern', 'Vättern', 'Mälaren', 'Siljan'], 'Vänern är så stor att den är som ett innanhav. Vättern är näst störst.'),
      Q('Vilket är Sveriges högsta berg?', ['Kebnekaise', 'Åreskutan', 'Sarek', 'Kinnekulle'], 'Kebnekaise ligger i Lappland och är cirka 2 100 meter högt.'),
    ] },
  { id: 'geo_naturresurser', name: 'Naturresurser och råvaror', short: 'Naturresurser', icon: '⛏️',
    read: `<p>En <b>naturresurs</b> är något i naturen som vi människor har nytta av. En <b>råvara</b> är det vi tar från naturen för att tillverka saker.</p><p>Sveriges viktigaste naturresurser: <b>skog</b> (trä, papper, möbler, hus), <b>järnmalm</b> (bryts i Kiruna och Malmberget i Norrbotten, blir stål), <b>vattenkraft</b> (el från älvarna, t.ex. Luleälven), <b>åkermark</b> (mat, spannmål) och <b>fisk</b>.</p><p class="ex">Skogen, malmen och vattenkraften är en stor del av varför Sverige räknas som ett rikt land.</p>`,
    qs: [
      Q('Vad är en naturresurs?', ['Något i naturen som människor har nytta av', 'En maskin i en fabrik', 'Ett djur i skogen', 'En stad'], 'Skog, malm, vatten och åkermark är naturresurser.'),
      Q('Vad är en råvara?', ['Något vi tar från naturen för att tillverka saker', 'En färdig vara i affären', 'En sorts mat', 'En karta'], 'Timmer är råvara – möbeln är den färdiga varan.'),
      Q('Vad kan vi tillverka av skogen?', ['Papper, trä, möbler och hus', 'Stål och bilar', 'Glas', 'Plast'], 'Skogen är Sveriges viktigaste naturresurs.'),
      Q('Var i Sverige bryts mest järnmalm?', ['Kiruna och Malmberget i Norrbotten', 'Skåne', 'Gotland', 'Stockholm'], 'Malmen fraktas med tåg till Luleå och Narvik.'),
      Q('Vad tillverkar vi av järnmalm?', ['Stål', 'Papper', 'Bensin', 'Glas'], 'Stål används till bilar, broar och verktyg.'),
      Q('Vad får vi från vattenkraften i älvarna?', ['Elektricitet', 'Dricksvatten', 'Fisk', 'Papper'], 'Luleälven har flera stora kraftverk.'),
      Q('Vad får vi från åkermarken?', ['Mat, t.ex. spannmål och potatis', 'Stål', 'Elektricitet', 'Papper'], 'Mest åkermark finns i södra Sverige.'),
      Q('Vilken älv i Norrbotten ger mycket vattenkraft?', ['Luleälven', 'Göta älv', 'Dalälven', 'Nilen'], 'Luleälven är en av Sveriges viktigaste kraftälvar.'),
      Q('Vilket av detta är INTE en naturresurs?', ['En mobiltelefon', 'Skog', 'Järnmalm', 'Vatten'], 'Mobilen är tillverkad av råvaror – den är en färdig vara.'),
    ] },
  { id: 'geo_miljo', name: 'Miljö och hållbarhet', short: 'Miljö', icon: '♻️',
    read: `<p><b>Förnybara</b> naturresurser kan bildas igen: skog, vind, vatten, sol. <b>Icke förnybara</b> tar slut när vi använt dem: olja, kol, järnmalm.</p><p>Landskapet påverkas när vi använder resurser: gruvor ger stora hål (dagbrott), <b>kalhyggen</b> när skog avverkas, dammar som dämmer upp älvar.</p><p class="ex"><b>Hållbar utveckling</b> betyder att använda resurser så att de räcker till dem som lever efter oss. Vi kan återvinna, återanvända, spara energi och välja förnybar energi.</p>`,
    qs: [
      Q('Vad betyder att en naturresurs är förnybar?', ['Den kan bildas igen, t.ex. skog och vindkraft', 'Den tar slut', 'Den är dyr', 'Den finns bara i Sverige'], 'Skogen växer upp igen om vi planterar.'),
      Q('Vilken av dessa är en icke förnybar naturresurs?', ['Olja', 'Vind', 'Sol', 'Skog'], 'Olja bildades under miljontals år – när den är slut är den slut.'),
      Q('Vilken av dessa är en förnybar naturresurs?', ['Vattenkraft', 'Kol', 'Järnmalm', 'Olja'], 'Vattnet kommer tillbaka med regn och snö.'),
      Q('Hur påverkas landskapet av en gruva?', ['Det blir stora hål och högar av sten', 'Det växer mer skog', 'Det bildas nya sjöar med fisk', 'Ingenting händer'], 'I Kiruna har gruvan till och med gjort att staden måste flyttas.'),
      Q('Vad är ett kalhygge?', ['Ett område där all skog har huggits ner', 'En skog med bara granar', 'En äng', 'En myr'], 'Efter kalhygget planteras ny skog som tar 60–100 år att växa upp.'),
      Q('Vad betyder hållbar utveckling?', ['Att använda resurser så att de räcker till dem som lever efter oss', 'Att bygga hållbara hus', 'Att använda allt så fort som möjligt', 'Att aldrig använda naturen'], 'Vi lånar jorden av våra barn och barnbarn.'),
      Q('Vilket är ett bra sätt att hushålla med jordens resurser?', ['Återvinna och återanvända saker', 'Köpa nytt varje gång', 'Slänga mat', 'Lämna lampor tända'], 'Återvinning gör att råvaran kan användas igen.'),
      Q('Vilken energi är förnybar?', ['Vind- och solenergi', 'Kol', 'Olja', 'Naturgas'], 'Vinden och solen tar aldrig slut.'),
    ] },
];

const recentQ = {};
function makeSoGen(topic) {
  return function gen(level, opts = {}) {
    if (!opts.noOpen && typeof makeOrderQuestion === 'function' && R.chance(0.15)) { const oq = makeOrderQuestion(topic.id, level); if (oq) return oq; }
    if (!opts.noOpen && typeof makeOpenQuestion === 'function' && R.chance(level >= 2 ? 0.4 : 0.25)) { const oq = makeOpenQuestion(topic.id, level); if (oq) return oq; }
    const recent = recentQ[topic.id] || (recentQ[topic.id] = []);
    let pool = topic.qs.filter(q => !recent.includes(q));
    if (!pool.length) { recent.length = 0; pool = topic.qs.slice(); }
    const item = R.pick(pool); recent.push(item); if (recent.length > Math.max(3, topic.qs.length - 2)) recent.shift();
    if (item.num) return { type: 'num', text: item.q, answer: item.answer, steps: [item.why], hint: 'Multiplicera centimetrarna på kartan med skalans tal. 100 cm = 1 m, 1 000 m = 1 km.', level };
    const correct = item.choices[0];
    const choices = R.shuffle(item.choices.slice());
    return { type: 'choicetext', text: item.q, choices, answer: choices.indexOf(correct), steps: [item.why], hint: 'Tänk efter vad kapitlet handlade om – ett alternativ passar bäst.', level };
  };
}
const SO_SKILLS = {
  ak4: GEO4.map(t => ({ id: t.id, name: t.name, short: t.short, icon: t.icon, group: 'so', subject: 'Geografi', gen: makeSoGen(t), method: `<div class="eyebrow" style="margin-bottom:6px">Puls SO 4 · s. 36–73</div>${t.read}` })),
};
if (typeof module !== 'undefined') module.exports = { GEO4, SO_SKILLS };
