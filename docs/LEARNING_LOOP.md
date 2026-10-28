# Product Learning Loop v1 – privata observationer (3.7)

Status: **byggt, av som standard**. Inget samlas in förrän föräldern slår på det per barn (⚙ → Observationer). Molnlagringen kräver
nya Firestore-regler (`match /obs/{doc}`). De är förberedda och prövade i emulatorn men **inte publicerade**. Tills ägaren publicerar
dem stannar allt på enheten.

Syftet: att föräldern, och Claude när föräldern själv delar en export, ska kunna se **hur** appen används innan beslut tas om fler
ändringar. Det är inte ett telemetrisystem, ingen extern tjänst, ingen AI i appen och inga automatiska ändringar.

## 1. Inventering: vad som redan finns

| Källa | Innehåll | Räckvidd | Synkas |
|---|---|---|---|
| `p.le.shadow` (passposter) | id, starttid, läge (`kor`, `flow`, `more`, `mission`, `exam` …), planen (koncept, roll, varför), inlämnade svar `[koncept, rätt, sammanhang]`, `done`, `po` (övning utan poäng), `mx` | **senaste 40 passen** | ja (profilen) |
| `p.le.log` / koncepttillstånd `c.ev` | bevis per svar (tid, rätt, form, hjälp, sammanhang), stadium, förfallodag | loggen packas efter 14 dygn; `c.ev` bara de **12 senaste** per koncept | ja |
| Felboken, `p.tests` | fel att ta revansch på; Testa mig-resultat (30 senaste) | begränsad | ja |
| `LE.errors` | tekniska fel i v2 | bara i minnet, 20 st, försvinner vid omladdning | nej |
| `S.usedHelp`, uppläsning | ledtråd, lösning eller uppläsning på aktuell uppgift | bara under passet | nej |

## 2. Varje mått: finns, kan härledas, kräver ny händelse eller går inte att mäta

| Mått | Klassning | Hur |
|---|---|---|
| Pass startade per läge | **finns** (40 senaste) → **ny händelse `ss`** för 30 dygn | `le.shadow` räcker inte för 30 dygn vid flera pass per dag |
| Uttryckligen avslutat pass | **finns** (`done`) → `se` med `o: 'done'` | samma skäl |
| Uttryckligen lämnat pass | **ny händelse** `se` med `o: 'exit'` | tryck på Tillbaka eller hem under passet |
| Okänt utfall | **härleds**: `ss` utan `se` | kallas aldrig "avbrutet": appen kan ha stängts, laddats om eller enheten somnat |
| Uppgift visad och inlämnad | inlämnad **finns** i `rec.a` (utan form) → **ny** `it` med form; visad men inte inlämnad **härleds** vid utgång (`p − a`) | |
| Hjälp och uppläsning | **ny** (flagga på `it`) | ledtråd, lösning, Rescue, uppläsning |
| Erbjudande att fortsätta och val | **ny** `of` och `sl` | erbjudanden räknas när uppsättningen knappar ändras, inte vid varje omritning |
| Aktivitetsmix, fel och hjälp per form | **härleds** ur `it` | |
| Målens pass och uppehåll | **härleds** ur `ss.g` (målpass) och dagar med händelser | |
| Målets täckning (vilka områden som påbörjats) | **finns** i motorns tillstånd (`V2.examStatus`) | exporten tar inte med det (läget visas redan i appen) |
| Tekniskt fel | **ny** `er` | bara var felet uppstod och felets typ, aldrig meddelandet |
| App- och innehållsversion | **ny** på `ss` (`b`, `c`) | |
| Aktiv tid per pass | **ny**, grov (`am`: intervallet `<5`, `5-15`, `15-30` eller `>30` minuter i förgrunden) | märks `u` (osäker) om ett obrutet intervall är över 20 minuter |
| Svarstid per uppgift | **mäts inte** | CLAUDE.md: ingen svarstid. Hastighet tolkas aldrig som förmåga, fokus eller motivation |
| Varför ett pass slutade, känslor, orsak | **går inte att mäta** | |
| Klassiska pass och glospass (v1) | **mäts inte i v1** | bara Learning Engine v2-pass observeras |

## 3. Händelser (schema 1)

Alla: `i` (unikt: enhet-sidladdning-löpnummer, så två flikar på samma enhet aldrig krockar), `y` (typ), `t` (sekunder), `k`
(pseudonym `p` + 12 hex). Grundfälten skrivs sist och kan aldrig skrivas över av händelsens egna fält.

| `y` | Fält | När |
|---|---|---|
| `ss` | `s` pass-id, `m` läge, `x` upplevelse, `po`, `g` mål-id (provträning/Testa mig), `n` planens längd, `b` bygge, `c` innehållsversion | v2-pass startar |
| `it` | `s`, `q` löpnummer i passet, `c` koncept, `f` form (mc, type, sort …), `ok`, `h` hjälp (`n`/`h` ledtråd/`s` lösning/`r` Rescue), `r` uppläsning, `x` sammanhang, `v` bilduppgift. `t` är **passets starttid**, inte svarets | svar lämnat |
| `se` | `s`, `o` (`done`/`exit`), `a` inlämnade, `p` visade, `am` aktiv tid som intervall, `tq` (`fg`/`u`) | slut eller uttrycklig utgång |
| `of` | `w` (`home`/`klar`), `bt` knappar → antal, `s` | erbjudandet ändras efter dagens pass |
| `sl` | `w` (`rad`/`klar`/`hem`/`annat`), `a` (kor, flow, ovamer, mission, testa, revansch), `cd` dagens pass klart | tryck |
| `er` | `w` plats, `n` feltyp | tekniskt fel (högst 20 per dygn) |

**Samlas aldrig:** namn, e-post, familjekod, skrivna svar, ljud, bild, video, skärm, klickspår, diagnoser, känslor, svarstid,
skoldokument eller bildinnehåll.

**Ingen svarstid går att räkna fram:** `it` bär passets starttid och ett löpnummer, aldrig när svaret lämnades, och passets aktiva tid är
bara ett grovt intervall. **Id i fri text** (mål och koncept) sparas bara om de är korta tekniska id (`a–z 0–9 : _ / . -`, högst 80
tecken). Annars ersätts de med `h` + 12 hex av en hash, så en titel eller ett namn som råkat hamna i ett id följer aldrig med.

## 4. Arkitektur och integritet

- **Av som standard.** `settings.obs = { on, onAt, days, daysAt, salt, saltAt, purge, at }` per barn. Det synkas med profilen och slås
  ihop fält för fält (`SYNC.mergeObs`), så en enhet med gamla inställningar aldrig kan slå på igen eller ångra en radering:
  - `on` och `days`: den senaste ändringen av just det fältet vinner (`onAt`, `daysAt`);
  - `salt`: det äldsta vinner, så pseudonymen är densamma på alla enheter;
  - `purge`: den senaste raderingen vinner alltid.
- **Pseudonym:** `p` + sha256(slumpat salt + barnets id), 12 hex. Den är **inte anonym**:
  - saltet ligger i barnets profil och kan läsas av varje parkopplad enhet (och, fram till 2026-11-09, via övergångsvägen för gammal kod
    med familjekoden), så den som har appen kan koppla pseudonymen till barnet;
  - pass-id (`s`) innehåller enhetens id och är samma som i passposterna (`le.shadow`), så händelserna går att koppla till profilens
    passhistorik.
- **Aldrig från testlägen:** Testa som barnet (`TM`), förälderns förhandsvisning, testadressen, `navigator.webdriver` (automatiserade
  webbläsare) och `PLUGG_NO_OBS`. I testläget skriver modulen inte ens till lagringen. Testet bevisar att lagringen är byte för byte
  orörd.
- **Skild från lärandet:** modulen lindar in appens funktioner (`V2.start`, `observe`, `finish`, `fail`, `VIEWS.home`) och läser bara.
  Allt ligger i try/catch: ett fel här stoppar aldrig ett pass, en belöning eller synken. Testet visar att profilen är identisk med
  observationer på och av.
- **Lokal kö** (`pluggappen.obs.v1`, per enhet och familj): högst 3 000 händelser och 400 000 tecken.
  - Uppladdade händelser tas bort först.
  - Ej uppladdade som faller bort räknas per pseudonym (`drop`) och syns bara i den profilens export.
  - Byts familjen börjar kön om. En annan flik som skriver kön får den här fliken att läsa om den (`storage`-händelsen).
- **Moln** (`families/{familj}/obs/{pseudonym}-{enhet}-{sidladdning}{nr}`): en sats per pseudonym och dag, högst 250 händelser.
  - De skrivs vid passets slut, vid start och när nätet kommer tillbaka – aldrig per tryck. Högst 3 satser per tillfälle.
  - Satserna är oföränderliga och skapas med `exists=false`. En sats som skickas om har samma id. Innan den skickas om läses den:
    finns den (200) räknas den som skickad, saknas den (404) skapas den, och 403 betyder att molnet stängs av till nästa start.
    Exporten tar också bort dubbletter på händelse-id och sorterar på tid.
  - Svarar molnet 403 (reglerna inte publicerade) stannar allt lokalt till nästa start.
  - Testa som barnet, förälderns förhandsvisning och testadressen gör inga anrop alls till observationslagringen.
- **Vem kan läsa i molnet:** varje parkopplad enhet i familjen. Det är **inte** ett föräldraskydd. Föräldrarollen väljs i dag av enheten
  själv (se `docs/PLAN_FAMILY_PLATFORM.md`). Exporten finns bara i föräldraläget (PIN-koden), men det är inget serverskydd.
- **Lagringstid:** 30 dygn som standard; 14 eller 7 kan väljas.
  - **Lokalt** rensas vid start och sedan högst en gång i minuten när något registreras.
  - **I molnet** rensas bara när en föräldraenhet öppnar ⚙ (en gång per sidladdning), exporterar eller raderar – och bara om enheten har
    hämtat alla barnens profiler (annars kan dess salt och raderingstider vara inaktuella, och då rensas inget).
  - En sats med okänd pseudonym (t.ex. ett barn som tagits bort) rensas först efter den yttersta gränsen, 30 dygn.
  - Det finns **ingen** schemalagd rensning på servern. Öppnar ingen förälder ⚙ ligger satser kvar i molnet längre, men exporten tar
    aldrig med något utanför lagringstiden eller från före en radering.
- **Radera:**
  - på den här enheten direkt;
  - på andra enheter efter synk (`settings.obs.purge`: händelser till och med den tiden släpps);
  - i molnet direkt, eller vid nästa start om enheten är utan nät (`purgeQ`, prövas igen). Ett försök senare tar bara bort satser vars
    senaste händelse är från före raderingen, aldrig nya;
  - ”Radera familjens data” och ”Radera barnets data” i föräldraläget tar också bort observationerna i molnet och på enheten.
- **Av:** inget nytt sparas. Ej uppladdade händelser släpps på alla enheter efter synk. Uppladdade ligger kvar tills lagringstiden gått
  ut eller föräldern raderar.
- **Inga** offentliga exporter, loggar eller CI-artefakter med riktig användning. Testerna använder syntetiska barn.

### Regler (förberedda, inte publicerade)

```
match /obs/{doc} {
  allow get, delete: if isMember() && doc.matches('^p[0-9a-f]{12}-[a-z0-9]{8}-[0-9]{1,9}$');
  allow list: if isMember();
  allow create: if isMember() && doc.matches('^p[0-9a-f]{12}-[a-z0-9]{8}-[0-9]{1,9}$')
    && request.resource.data.keys().hasOnly(['json', 'n', 't', 'k', 'v'])
    && request.resource.data.json is string && request.resource.data.json.size() < 150000
    && request.resource.data.n is int && request.resource.data.n >= 1 && request.resource.data.n <= 400
    && request.resource.data.t is int && request.resource.data.v is int
    && request.resource.data.k is string && request.resource.data.k == doc.split('-')[0];
  allow update: if false;
}
```

Emulatorn: `tests/rules/rules.test.mjs`. Den prövar:
- att medlemmar skapar, läser, listar och raderar;
- att oinloggade, icke-medlemmar och en annan familj nekas att läsa, lista, skapa och radera;
- att ändring nekas, också när en befintlig sats skickas om;
- att fel id, okänt fält, `k` som inte stämmer med id, för många händelser och för stor sats nekas.

Övergångsvägen (gammal kod utan inloggning) gäller inte här.

## 5. Export

⚙ → Observationer → Från/Till → Exportera. Det ger en JSON-fil, och den lämnar enheten bara om föräldern själv delar den. Före
exporten laddas köade händelser upp och molnet rensas. Exporten tar bara med händelser inom varje barns lagringstid och efter en
radering, oavsett vad som råkar ligga kvar i molnet.

- **Sammanfattning per profil, aldrig mellan syskon:**
  - observationsdagar;
  - pass (startade / avslutade / lämnade / okänt utfall) och pass per läge;
  - erbjudanden och val efter dagens pass;
  - inlämnade uppgifter och visade men inte inlämnade;
  - aktivitetsmix med rätt, hjälp och uppläsning per form;
  - koncept med flest fel, med antal försök som nämnare;
  - målpass och dagar;
  - uppehåll på två dagar eller mer;
  - tekniska fel;
  - grov aktiv tid (antal pass per intervall);
  - app- och innehållsversioner.
- **Förbehåll**, alltid med: pseudonymt men inte anonymt; utforskande; inget orsakssamband; okänt utfall kallas inte avbrutet; bara v2.
  Dessutom om händelser föll bort, och om bara den här enheten var med.
- **Valfritt:** de enskilda händelserna, utan interna fält.

Exempel med syntetiska data: `tests/obs_example_export.json`, genererat av `tests/test_obs.js`.

## 6. Analysmall (för Claude, bara när ägaren delar en export)

Använd den här mallen ordagrant när en export analyseras:

> Analysera bifogade export från Pluggappen. Den är pseudonym och gäller få barn och få dagar.
> **A. Verifierade observationer:** bara det som står i exporten, med antal och nämnare (t.ex. "3 av 11 erbjudanden valdes").
> Jämför aldrig syskon, och jämför bara en profil med sig själv.
> **B. Saknad data och urval:** okänt utfall, enheter som inte laddat upp, bortfallna händelser, v1-pass som inte syns, kort period.
> **C. Andra förklaringar:** minst två för varje mönster (t.ex. skoldag, trött, enheten delad, appen uppdaterad mitt i).
> **D. Hypoteser:** tydligt skilda från fakta. Inga påståenden om orsak, bättre lärande eller motivation.
> **E. Minsta nästa steg:** en undersökning eller en liten ändring – inte en omgörning.
> **F. Kräver det simulering (motorn) eller säkerhets- och integritetsgranskning?**
> **G. Ägarens godkännande** före varje ändring eller release. Inga experiment på barnen utan ägarens beslut, och inga automatiska
> ändringar av svårighet, recept eller planerare.

## 7. Det här är inte med i v1

Skuggplanerare, automatiska ändringar, extern analys, AI i appen, observation av v1- och glospass, mätning av svarstid och föräldraskydd
i molnet (det kommer med Family Platform).
