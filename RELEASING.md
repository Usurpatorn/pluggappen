# Bygg, test och release

## Källor och artefakt
- `src/` är den enda sanningen. `dist/index.html` byggs av `scripts/build.sh` och är **inte** incheckad.
- Bygget är reproducerbart: bygg-id = `v<VERSION> (<innehållshash av src>)`. Samma källor ⇒ byte-identisk `index.html`.
- Sajten publiceras av CI (GitHub Pages källa = GitHub Actions, variabel `PAGES_ACTIONS=true`). Det finns ingen `index.html` i repots rot.

## Lokalt
```
npm ci
npm run build        # → dist/
npm test             # hela sviten mot dist/ (≈30 s). Måste vara "ALLA TESTER GRÖNA".
git commit -am "…" && git push
```
Privat termlista för integritetstestet läggs i `tests/privacy_terms.local.json` (gitignorerad) – i CI via secret `PRIVACY_TERMS` (JSON-array).

## CI (`.github/workflows/ci.yml`)
1. `npm ci` → bygg → bygg igen och jämför byte för byte (reproducerbarhet)
2. hela testsviten (generatorer, synk, åtkomst, XSS, integritet, smoke) – ett rött test stoppar allt
3. kontroll att `index.html` i roten = bygget
4. artefakten `site-<bygg-id>` sparas 90 dagar
5. **Publicering** (bara när repo-variabeln `PAGES_ACTIONS` = `true` och Pages-källan är "GitHub Actions"): dist/ → Pages
6. **Release-tagg** `release-<VERSION>-<sha>` + GitHub Release med `index.html` bifogad

## Versionsnummer
- `VERSION` (semver). Höj patch för innehåll/buggfix, minor för nya moment eller funktioner, major för schemaändringar i barnens data.
- Visas i appen: Förälder → ⚙ → raden "Version v1.1.0 (hash)".

## Rollback
1. Actions → "CI – test, bygg, publicera" → **Run workflow** → `deploy_ref` = en tidigare release-tagg (t.ex. `release-1.1.0-53cee56`) eller commit.
2. CI bygger och testar den versionen och publicerar den (kräver `PAGES_ACTIONS`). Alternativt: `git revert` på main.

## Pages via Actions (inställt 2026-10-25)
Settings → Pages → Source: **GitHub Actions**; Settings → Secrets and variables → Actions → **Variables** → `PAGES_ACTIONS` = `true`.

## Testadress för en förhandsversion
Repo-variabeln `PREVIEW_REF` = en gren → workflowen "CI – test, bygg, publicera" (Run workflow, tomt `deploy_ref`) bygger grenen
med `PREVIEW=1` till `<sajten>/preview/`. Produktionen publiceras som vanligt. Misslyckas förhandsbygget publiceras produktionen ändå.
- Inget familjeinnehåll byggs in; enheten kopplas till familjen som en ny enhet och hämtar familjens data via den vanliga synken.
- Egen lagring (prefix) – produktionens data på samma enhet rörs inte. Ingen service worker, inga push-påminnelser.
- **Från 3.0.0 är testadressen förälderns testmiljö.** Peka den bara på en gren med "Testa som barnet" (`src/05i_testmode.js`).
  En gren utan det skriver riktiga bevis i barnens profiler (samma synk) – använd den inte för att testa som ett barn.
- **Testa som barnet:** Föräldraläge → barnet → *Testa som …* (valfritt: en annan upplevelse, bara i testet). Testet börjar från
  barnets riktiga läge (hämtas direkt), och sedan är lagringen en kopia i minnet för resten av sidans liv; under testet skickas inga
  skrivningar alls. *Avsluta testläge*, byta barn, ladda om, stänga eller gå bakåt = sidan laddas om och kopian finns inte längre;
  vid Avsluta jämförs den lagrade datan byte för byte med läget före testet. Går isoleringen inte att garantera startar testet inte.
- **Utanför testet** är testadressens barnprofiler en spegel: synken hämtar men laddar aldrig upp, en lokalt ändrad kopia ersätts av
  familjens data, startsidan visar inga barn och djuplänkar till barn öppnar inget. Nätverksskyddet i testsidan nekar alltid skrivningar
  till `families/…/profiles/…` (parkopplingen av själva enheten fungerar som vanligt). Prövas i `test_parent_test_mode.js`.
- Uppdatera testadressen efter nya commits på grenen: kör workflowen igen. Ta bort: radera variabeln och kör workflowen igen.

## Learning Engine v2 – skuggläge (från 1.2.0, Fas 3B)
- Källor: `src/05a_concepts.js` (konceptkatalog), `src/05b_engine2.js` (motorn, rena funktioner), `src/05c_shadow.js` (koppling + föräldradiagnostik).
- Barnen får **v1**. v2 loggar bevis från v1-svaren och sparar vad den skulle ha valt i `p.le` (i barnets profil, inom familjens lagring). Föräldraläget → barnet → **Motor v2**.
- Tester: `test_le_engine.js` (3A-reglerna + logg/synk/migrering), `test_le_sim.js` (simuleringsbaslinje ±1 p), `test_le_shadow.js` (skärmar och v1-data identiska med skuggan på/av), `test_le_sync.js` (flera enheter, Felboken-synk).
- K-13-omsimulering: `node tests/le/k13.js` (syntetiska elever, påverkar inte CI).
- Rollback: publicera `release-1.1.0-…` enligt ovan. 1.1.0 ignorerar `p.le` och behåller fältet orört; när 1.2.x publiceras igen slås loggen ihop som vanligt.

## 2.0.0 – Learning Engine v2 är produkten (från 2026-10-25)
- **v2 är standard för alla barn.** Ingen aktivering behövs: en profil utan val (`settings.engine` saknas) kör v2. Policy följer kursmallen: åk 2 → Yngre, åk 4 → Mellan, åk 8 → Äldre (kan överstyras i Motor v2).
- **v1 är reserven, per barn:** Föräldraläge → barnet → Motor v2 → **v1**. Sparas som `engine: 'v1'` + `engineAt` (synkas på senaste ändring; motstridiga val inom 10 min → v1). v1-datan uppdateras hela tiden även när v2 körs, så bytet förlorar inget. Tillbaka: tryck **v2**.
- **Fel i v2 stoppar aldrig barnet:** v2-lagret är skyddat; vid fel startar ett v1-pass och felet syns i Motor v2 ("Fel i skuggan"/v2-felräknare).
- **Nödrollback för alla:** Run workflow med `deploy_ref = release-1.2.0-8d06e53`. 1.2.0 kör v2-data utan fel och lämnar den orörd (`tests/test_le_downgrade.js`); publiceras 2.0.x igen fortsätter v2 där det slutade.
- Källor: `05b_engine2.js` (motor), `05e_runner.js` (passkörare), `05f_content2.js` (eget svar + Utmaningar), `05g_v2app.js` (barnupplevelse), `05c_shadow.js` (koppling, diagnostik). Rapport: "Learning Engine v2 Build and Release Report".
- Tester som skyddar övergången: `test_v1_regression` (reserven v1 = 1.2.0), `test_le_v2ui`, `test_le_content`, `test_le_migration`, `test_le_downgrade` (1.2.0 → 2.0.0 → 1.2.0 → 2.0.0), `test_le_deeplink`.

## 2.1.0 – Kunskap i många former + grunden för Study Mission
- **Concept Packs** (`content/packs/*.json`, spec `docs/CONCEPT_PACKS.md`) byggs in som `PACK_DATA` och ingår i bygg-hashen. Ett
  moment med paket blir *kunskapspunkter* `k:<paket>/<punkt>`; det gamla momentkonceptet vilar och leder gamla frågor vidare
  vid omspelning (loggen ändras aldrig). Kvalitetsgrind: `tests/test_packs.js` (`node scripts/content.mjs check`). Id-lås:
  `content/ids.lock.json` (`node scripts/content.mjs lock` när nya punkter släpps).
- **Regler 3I.2** (formmedvetna bevis): formkod i bevisets index 19; djupgrind vid stadium 4 med frågor från stadium 3. Kravet är
  djupbevis från **två olika dygn** (`dpn ≥ 2`) **och** minst 2 poäng (`dp`: +1 flerval, +2 eget svar/ordning, högst en gång per dygn,
  bara rätt utan hjälp och första försöket i passet); "Säker" kräver detsamma. 3I.1 lät ett enda dygn med eget svar/ordning räcka –
  rättat i release-kontrollen (`test_le_forms.js` 4b). 2.0.0 ignorerar fälten. Simulering: `tests/le/forms.js` (syntetiska elever).
- **Skrivskydd för `_content`:** `firestore.rules` nekar alla appklienter (medlemmar och övergångsvägen) att skapa/ändra
  `profiles/_content`; bara servicekontot skriver. **Reglerna publiceras manuellt** i Firebase-konsolen (Firestore → Regler) – de
  följer inte med CI. Kontrollera i Regel-lekplatsen att `update` på `families/<familj>/profiles/_content` som inloggad medlem nekas.
- **Familjens innehåll** (`profiles/_content`): skoluppgifter och privata paket, skrivs av Claude med
  `scripts/content.mjs bundle/deploy` (kräver `FAMILY_CODE` + `FIREBASE_SERVICE_ACCOUNT`, aldrig i repot). Appen läser, tvättar och
  validerar (`FAMILY.cleanContent`) och sparar en lokal kopia. Flöde: `docs/CONTENT_WORKFLOW.md`.
- **Study Mission-grunden:** uppdragsrubrik på Kör!-knappen (närmaste prov inom 28 dygn), lärarens frågor i Testa mig, lugn
  återkomst ("Välkommen tillbaka." / "Det här är viktigast idag"). Presentation ovanpå Smart Kör! – ingen ny schemaläggare.
- **Innehållshälsa:** "Den här frågan är konstig" sparar `dygn|uppgift|punkt` i `p.le.qr` (union vid synk, gallras). Flaggor
  bara i Motor v2. Innehållet ändras aldrig automatiskt.
- **Läs upp** (Yngre, enhetens talsyntes, behörighet per fråga) och rikare `former`/`brak2` för åk 2 (bara v2, `src/02k`).
- Tester: `test_packs`, `test_le_forms`, `test_le_packs_app` (inkl. rollback mot `tests/golden/pluggappen-2.0.0.html.gz`),
  `test_readaloud`, `test_gen2`, `test_study_mission`, `test_review21`, `test_content_facts`, `test_recipes`; `test_auth` (skrivskydd `_content`).
- **Rollback:** Run workflow med `deploy_ref = release-2.0.0-6ca2933`. 2.0.0 kör 2.1-data utan fel: kunskapspunkternas bevis
  ligger kvar orörda (2.0.0 ser dem som vilande okända koncept), `qr` och formkoder bärs vidare. Publiceras 2.1.x igen fortsätter
  allt där det slutade. Per barn finns fortfarande v1-reserven.

## 3.0.0 – Experience v3 (från 2026-10-27)
- **Upplevelse per barn ovanpå samma motor:** Explore (Yngre), Grow (Mellan), Achieve (Äldre) som standard efter kursmallens
  åldersgrupp. Föräldraläge → barnet → Motor v2 → Upplevelse kan överstyra per barn (synkas på senaste ändring, `exp`/`expAt`).
  Ingen migrering: bevis, stadier, Felboken och belöningar ändras inte av släppet.
- Nytt i barnens data: `p.v3.sc` (barnets egna stegval vid jämförelse med lösningen, bara visning, högst 40, union vid synk) – därav major.
- **Reserver, från snabbast:** 1) **Klassisk** per barn (Upplevelse → Klassisk = 2.1-presentationen, samma motor och data);
  2) **v1** per barn (Motor v2 → v1); 3) **rollback för alla:** Run workflow med `deploy_ref = release-2.1.1-96f81e3`. 2.1.1 läser
  och bevarar v3-data (`test_exp_v3` del 5 mot `tests/golden/pluggappen-2.1.1.html.gz`); publiceras 3.0.x igen fortsätter allt där det slutade.
- FLOW: högst 3 block per dygn (oförändrat; underlag för en senare ändring i release-rapporten).
- Tester som skyddar släppet: `test_exp_v3`, `test_ux_v3`, `test_promise_exec`, `test_golden_cases`, `test_golden_explore`,
  `test_keypad`, `test_preview`, `test_review_v3`, `test_v1_regression`; integritetskontroll av varje commit (`scripts/privacy-history.mjs`).

## 3.1.0 – Bara prov och läxor (från 2026-10-27)
- **Förälderns val per barn:** Föräldraläge → barnet → Motor v2 → *Vad Kör! tränar*: **Allt** (standard, som förut) eller **Bara prov
  och läxor**. Sparas som `settings.scope = 'exams' | 'all'` + `scopeAt` (synkas på senaste ändringen, som upplevelsen).
- På: Kör! och FLOW tränar bara inlagda prov och läxor inom 28 dygn – samma motor och regler, begränsad med planerarens egen `only`
  (som provträningen 2.1.1). Hemmet visar ett ärligt kort när inget finns ("Inga prov eller läxor just nu", "… inte inlagt ännu",
  "Inget att öva idag"); Öva på egen hand och Testa mig finns kvar. Gäller v2/v3 (alla upplevelser och Klassisk), inte reservmotorn v1.
- Hemmets plan och FLOW-förhandsvisningen räknas med samma klocka som när passet startar (`LE.sessClock`).
- Rollback: 3.0.1 (`release-3.0.1-85e4353`) och 2.1.1 ignorerar `scope` och behåller fältet. Test: `test_scope_exams.js`.
- 3.1.1: Felboken och Revansch för barnet följer valet (bara provens/läxornas saker; föräldrans vyer visar allt), och ett barn med
  valet får inget allmänt v1-pass som reserv (före första synken eller vid fel i v2) – ett meddelande i stället.
- 3.1.1 (testadressen): den riktiga appen startar aldrig på `/preview/` (t.ex. ur offline-kopian), service workern serverar
  aldrig testadressen ur cachen och byter aldrig en testflik mot appen, och CI publicerar testadressen bara från en gren med
  "Testa som barnet" och dess skydd (testet körs och sidan kontrolleras – annars publiceras produktionen utan testadress).
- 3.1.2: med Bara prov och läxor och ett enda prov i fönstret räknas Bossen som provuppgift (hemmet sa "3 av 4 uppgifter inför provet" fast allt var provet).
- 3.1.2: Bossen på samma kunskapspunkt som uppgiften precis före tar helst en annan aktivitet och ett annat faktum (inte sortera → samma
  sortering igen) – bara bland giltiga varianter, inom samma nivågräns och format; annars som förut; aldrig ett svagare minnesprov än utan variationen. Motorn orörd. Test: `test_boss_variety.js`.

## 3.2.0 – Testa som barnet i föräldraläget (från 2026-10-27)
- **Föräldraläge → barnet → Testa som …** finns nu i den vanliga appen (inte bara på testadressen). Samma isolering: lagringen slås om
  till en kopia i minnet (oåterkalleligt för sidan) och nätverksskyddet nekar alla skrivningar under testet; avsluta, byta barn,
  ladda om, bakåt = sidan laddas om och kopian finns inte. Utanför testet är appen som förut (samma nycklar, samma nätverk).
- Före testet hämtas och slås väntande ändringar ihop med familjens data och laddas upp villkorat på den hämtade versionen; går det inte (t.ex. utan nät) startar testet inte. Påminnelser och synkkod finns inte under testet.
- Testadressen finns kvar (samma funktion, egen lagring) men behövs inte längre för att testa som ett barn.
- Rollback: `release-3.1.2-ec2651c` (eller tidigare 3.1.x). Test: `test_parent_test_mode_prod.js`, `test_parent_test_mode.js`.


## 3.2.1 – Visuell kvalitetsgrind (från 2026-10-27)
- Bara utseende (CSS och knappklasser), ingen logik: KLAR har en enda fylld knapp (nästa runda / fortsätt mot provet), "Klar för idag"
  är en kontur; beröm visas i grönt (rött betyder bara fel); siffrorna på väg/tränar i textfärg; långa ord bryts i sorteringslådor;
  klara par syns tydligare; jämn radbrytning i knappar; iPad (≥768 px) får större målrubrik och KÖR-knapp; låga skärmar en kompaktare
  pappersnotis. Rollback: `release-3.2.0-3e2a6d2`.
## 3.2.2 – Synkens integritet (2026-10-27)
- **Varje skrivning av en barnprofil är villkorad** på den serverversion enheten senast slog ihop eller själv skrev (basen) (`currentDocument.updateTime`, eller
  `currentDocument.exists=false` för en ny profil). Har en annan enhet hunnit skriva nekar Firestore; enheten hämtar, slår ihop och
  försöker igen (högst tre gånger per omgång, sedan nya omgångar efter 5 s, 15 s, 60 s, 120 s – och direkt när nätet kommer tillbaka
  eller appen visas igen). Okänd version → hämta först. Ingen blind skrivning av en hel profil.
- **Kön tappar aldrig:** ett barn lämnar uppladdningskön först när skrivningen bekräftats.
- **Trevägssammanslagning** mot den senast kända serverversionen (`DB.syncBase` – bara på enheten, aldrig i profilen): det som inte
  ändrats på enheten tas från familjens data, även raderade prov, egna ordlistor och avstängda ordlistor. Bevislogg, XP, ord, Felboken
  m.m. slås ihop som förut. Saknas basen (första gången efter uppdateringen) gäller den tidigare sammanslagningen.
- **Serverns tid avgör** om en version redan finns på enheten – aldrig enheternas klockor. Ett sent svar med en äldre version ignoreras.
- **Förlorat svar:** en skrivning som kom fram fast svaret gick förlorat känns igen (`DB.syncSent`) – inget räknas två gånger.
- Basen gäller bara samma familj och bara när profilens `syncedAt` är basens version; en helt synkad profil blir sin egen bas innan den
  första ändringen.
- Test: `test_sync_integrity.js` (fall A–M och återgång), `tests/rules/sync_precondition.test.mjs` (Firestore-emulatorn i CI).
- Rollback: föregående release-tagg. Profilernas format är oförändrat; en äldre version ignorerar `DB.syncBase` (men skriver då åter
  utan villkor).
## 3.3.0 – World-Class Experience (2026-10-27)
- **Bara presentation.** Inga ändringar i Learning Engine, planering, bevis, rättning, synk, Testa som barnet, lagring eller
  profilformat. Nya krokar för CSS: `html[data-exp=explore|grow|achieve|classic]` och `#qcard[data-mode][data-role][data-exam]`
  (från `EXP.modeOf`). På liggande iPad flyttas uppgiftskortets befintliga element till två rutor (`.q-main`/`.q-side`,
  `display: contents` på mindre skärmar) – inga nya element, samma id:n och händelser.
- Explore: äventyrskort med husdjur och stationer med ikoner; sekundära saker samlade i ett hopfällt block. Grow: framstegsstapel
  (säkra/på väg/tränar), mörk startknapp när lagfärgen är röd (rött betyder bara fel). Achieve: mål → datum → idag → tid → KÖR,
  sedan "Sedan: …"; tid och andel på egen rad.
- Aktiviteterna har eget formspråk (sortera, para ihop, ordna, tryck, upptäck, papper, Hitta felet som lösningskort med bokstav,
  Baklänges med målpanel, Boss, Revansch). Feedback: lugn fel-ruta med röd kant, "Visa varför" i Explore, XP-chip i Grow som inte
  täcker nästa fråga, ingen "N i rad" i Achieve. KLAR: eget slut per upplevelse, tiden på egen rad i knappen.
- Testa mig: neutral framstegsstapel (avslöjar inte rätt/fel), resultat per mål ("Öva mer: …", "N av M svar stämde"), inga ✅/🔁.
- iPad (≥768 px) bredare kort och större text; liggande (≥1100 px) hem i två spalter och uppgifter i två rutor. Långa ord bryts.
  `prefers-reduced-motion` stänger av rörelser.
- Granskningarnas åtgärder: rött betyder bara fel (lagets röda färg blir marinblå accent i v3, ett köpt accentfärgsval vinner
  fortfarande), Ordna/Para ihop börjar aldrig färdiglösta (rättning oförändrad; tidigare kunde en blandning råka ge facit),
  klara par ställs på samma rad, inga konfetti över ett fel svar, klarad Boss märks, Hitta felet läses upp i sin helhet och
  skärmläsaren hör varje lösning, KLAR visar knapparna först.
- **Gäller alla lägen (även Klassisk/v1), med avsikt:** kontrast för ej tagna märken (WCAG AA), `html{overflow-x:clip}` med
  `.stack{grid-template-columns:minmax(0,1fr)}` (breda flikar vidgade tidigare hela kolumnen och gav sidledsscroll),
  scrollbara flikrader, `lang="sv"` och svensk avstavning i den fristående varianten, `--ink-2` i mörkt läge. Övriga 3.3-regler är
  avgränsade till `:root:not([data-exp="classic"])`. I Klassiskt syns dessutom några nya klassnamn utan egen stil (`act-chip`,
  `learn-title`, `exam-list`), en kvarliggande +XP-flygare tas bort när nästa fråga visas, och flikknapparna krymper inte. Klassiskt läge behåller sin text om tom provträning.
- Sista passet (ägarens beslut (a)): Grows hem med barnets ord för lägena ("sitter / på väg / övar"), skoluppgiften på
  en rad och utan hockeyposition; ett gemensamt KLAR (märke, rubrik, en mening, högst tre chips från verkligt läge,
  fortsätt, Klar för idag – utan statistik); ett kort Boss-ögonblick (gyllene ring) och ett lugnt KLAR-avslut (ringen sluts),
  båda av med `prefers-reduced-motion`; iPad stående med lugn vertikal placering och större mattetext; Sortera med
  instruktionen först, jämna kort och lådor som växer; Ordna visar rätt ordning efter ett fel; föräldraläget säger
  "20 rätt av 25", visar inte provtid och skriver "Enkla andragradsekvationer" i stället för "x²" (v1:s föräldravy oförändrad).
- Granskningarnas sista åtgärder: rubrikraden har en egen yta; Nästa ligger kvar längst ned efter svaret (aldrig före svaret –
  då täckte den alternativ och lådor); iPad stående toppjusterad med fast avstånd; Hitta felet i en spalt på stående iPad;
  tre korta talalternativ på en rad; "Visa hur" pekar ut rätt alternativ ("Välj det"); ett ensamt förklaringssteg utan "1.";
  Achieve: lugnare beröm och "Steg för steg" i stället för "Vi tar det tillsammans"; Para ihop "Nästan" med gul kant; KLAR säger
  "dagens runda/äventyr" bara efter dagens plan; Grow-KLAR visar nivån och XP kvar; Testa mig-resultatet leder med vad som
  ska övas (inget "N av M"); grammatik "1 färgad" (02k).
- Slutpasset (ägarens beslut (a), presentation och text):
  - **Ett svarssätt för flerval i v3:** ett tryck på ett alternativ svarar – också för tal (förut tryck + Svara utom för Yngre).
    Undantag med en knapp, eftersom svaret byggs av flera tryck: sortera, para ihop, ordna, bygg ordet, skrivna svar, knappsats
    och papper. Rättning och bevis är desamma; Klassiskt är oförändrat. Ett tryck mindre gör att ett snabbt fel oftare räknas
    som snabbt (motorns befintliga `fast`-regel, oförändrad).
  - **Knappsatsen under knappraden** (`#keypad`, samma knappar flyttade): Svara direkt under svaret; efter svaret döljs knapparna.
    Svara/Nästa hamnar aldrig under kanten på 375×667, inte heller med telefonens tangentbord uppe (mätt i Chromium).
  - **En etikett per läge:** rollen står på kortet (NY CHANS, VI TAR DET TILLSAMMANS, STEG FÖR STEG, EXTRA), räknaren säger bara
    "N kvar" ("Snart klart" under en extra uppgift när planen är slut); förklaringskorten upprepar inte etiketten; Rescue efter
    förklaringen visar bara ledtråden (utan ledtråd: första steget som förut); Revansch förklaras en gång per pass; rubriken i ett
    Revansch-pass är ämnet. Samma ord och ikoner som på startsidan (VÄRM UPP, 🧗 UTMANING).
  - **Grow:** mållinje 🏁 i förloppet, "UTMANING · NÄSTA NIVÅ", "Returmatch: den här var klurig förut.", "Slutsignal" på KLAR,
    "Dina N områden".
  - **KLAR:** Explore – följeslagaren hoppar till i märket och stigen är hela stjärnor; Achieve – planen som en rad
    ("Alla N uppgifter gjorda" / "N av M"), inte i extrapass; chips är text; märke, uppdrag och Felboken som samma slags rad.
  - **iPad stående:** större uppgift, svar och knappar; kortet i övre tredjedelen, förloppet överst. **Föräldraläget** i två
    spalter på iPad (barn, flikar och Testa som barnet till vänster) för barn med v2 – v1:s föräldravy är oförändrad.
  - **Små etiketter** minst 12 px (nivå), lägen i Testa mig/provkort 13 px. **Styrknappar** (Ledtråd, Jag fattar inte, Läs upp,
    Kladdyta, Läs mer) med linjeikoner i v3; karaktär och glädje (stationer, roller, KLAR) är kvar som emoji.
- **Fas A (ägarbeslut 2026-10-27, stänger 3.3):**
  - "Vilket påstående är fel?" (paketens false/err-varianter och Utmaningen "Vilket påstående är FEL?") och Hitta felet: det man valde i stället är SANT – märks "Stämmer" (aldrig rött) och texten säger
    "Det du valde stämmer – det var inte felet. Felet var: … (stämmer inte)". Gäller alla v2-upplevelser inklusive Klassisk och
    Testa mig-resultatet. Inget nytt sparat fält: svaren i Testa mig finns bara i minnet under passet; bevisen är orörda.
  - Testa mig: ett tryck väljer (går att ändra), Svara lämnar in – för tal och påståenden (ord prövas i Testa mig som skrivna svar;
    ordflervalets välj + Svara finns som skydd men nås inte i dag). Ingen återkoppling under testet.
  - Läs upp på återkoppling och förklaringskort (enhetens röst; Yngre alltid, övriga med Uppläsning på) – aldrig när läsningen
    själv prövas (samma regel som frågan: `V2.canSpeak`).
  - Startsidan: barnkorten visar namn, klass och figur (följeslagaren i sin fullvuxna form, inte dess stadium) – inte syskonens nivå, streak eller dagens antal. Det är INTE
    serverisolering: alla enheter i familjen kan fortfarande läsa hela familjens data tills Family Platform (barnbunden enhet) är
    driftsatt. v1-referensen är omgjord från samma 1.2.0-bygge med samma normalisering av startsidan; allt annat är oförändrat.
  - Nästa täcker aldrig återkopplingen (rullningen lämnar plats för den fasta knappraden, även för ord); när ett byggt svar
    (sortera, ordna, bygg) är klart rullas Svara fram; låg telefon: mindre figur och uppläsning som ikon. Förälderns flikar på
    telefon i två rader (v2-barn). Lägespiller med läsbar kontrast (alla lägen).
  - Nytt CI-jobb **Layout och tillgänglighet i Chromium** (`tests/browser/layout.js`, Playwright + axe-core, fyra storlekar) –
    krävs före publicering och release-tagg.
- Tillgänglighet: axe-core (WCAG 2.1 A/AA) 0 fynd på 24 skärmar i 375, 390, 820 och 1180 px.
- Test: `test_ux33.js` och `test_ux33_final.js` (krokar = uppgiften, två rutor utan förlust/dubbletter, Hitta felet/Baklänges rättas som förut, löftena
  ordagrant, lugnt Testa mig). Rollback: `release-3.2.2-1544484` (profilformatet är oförändrat, så rollback kräver ingen migrering; enda innehållsskillnaden i lagrad data är grammatikrättelsen "1 färgad" i stegtext som v1-Felboken kopierar).

## 3.4.0 – Flera mål och oregelbundet plugg (gren `le-multigoal`, bygger på 3.3)
- **Problemet (återskapat och kvar som test):** det närmaste målet, oavsett storlek, satte provveckans broms på ny inlärning i hela
  planen. Ett litet förhör kunde därför stoppa nytt i ett större prov fem dygn senare och i ett tredje prov ännu senare.
  `tests/test_le_multigoal.js` ger 26 av 79 kontroller fel mot 3.3-bygget (`LE_HTML=<bygge>`) och är grönt på 3.4.
- **Reglerna nu (`LE2.planSession`, `LE.isMajor`, CFG.exam):**
  - **Bara ett större mål** (prov) bromsar ny inlärning i hela planen: inget nytt dagen före eller på provdagen, sedan stegvis
    veckan före.
  - **Ett mindre mål** (läxförhör eller glosförhör) väger 0,6 i prioriteten. Dess sista dygn tas inga osedda koncept in som bara hör
    till det målet. De sista tre dygnen går minst en tredjedel av passet till det (ett större prov får hälften).
  - **Standard utan storlek:** `exam` och prov som lagts in i appen utan typ räknas som större, alltså som före 3.4.
    `homework`/`vocab` räknas som mindre.
  - **Förälderns val** gäller före standarden:
    - i appen: Prov → Storlek när provet läggs in, och Översikt → mål och täckning → Ändra. Valet sparas på provet och synkas
      som en ändring av det.
    - skoluppgifter: fältet `weight` via det privata innehållsflödet.
  - **Aldrig fler räknade nya koncept per pass än policyn** (yngre 1, mellan 2, äldre 3) eller dygnets rest (`newCap`). Prövat på
    6 000 slumpade planer i den oberoende granskningen, med 0 avvikelser (3.3 hade 193).
  - **Ett ensamt prov** (inget annat mål) har exakt 3.3:s provveckoregel: högst ett nytt per pass 4–7 dygn före, prövat för alla tre
    policyer.
  - **Veckan före ett större prov när flera mål pågår:** annat nytt bromsas, men provets egna osedda koncept får introduceras inom
    policyns gräns. Utan det tog andra mål provets enda plats.
  - **Täckningstryck:** ett *annat* mål med fler osedda koncept än dygn kvar innan sina tre sista får +1 nytt per pass under provets
    vecka, inom policyns gräns. Det gäller aldrig vid överlast och aldrig det närmaste provets egna koncept.
  - **Målrättvisa:** ett större prov inom 14 dygn vars övade koncept inte setts på 3 dygn, när ett annat mål ligger närmare, får
    ett av dem i passet. Det är alltid repetition, aldrig nytt. Ett ensamt prov påverkas inte, så säsongerna är oförändrade.
  - **Gemensamma koncept** är ett koncept i motorn med samma bevis och belöningar. Förhörets sista dygn stoppar inte ett koncept som
    också hör till ett senare prov.
  - **Rättelse (M8, utökad efter granskningen):** ett osett koncept vars förkunskap saknas kom förut in via provets vikt utan att
    räknas som nytt. Ett större provs sista tre dygn räknas det nu som nytt, så regeln "inget nytt, utom vid svält" gäller allt osett.
    4–7 dygn före ett prov är det oförändrat från 3.3. Det är en känd begränsning, som gäller också med flera mål: ett osett koncept
    utan förkunskap kan då komma utöver gränsen, i samma takt som i 3.3. Ett ensamt provs plan är byte-identisk med 3.3, vilket
    granskningen prövade på 1 685 planer.
  - `others` räknar varje kommande mål, också ett avlägset eller ett utan områden. Ett ensamt prov plus ett sådant mål får alltså
    flermålsreglerna, fortfarande inom gränsen.
  - **Rättelse:** 3.3 kunde krascha (`subject` på ett odefinierat koncept) när planen för Yngre blev tom 2–3 dygn före ett prov.
    Felet fångades av appens skydd.
  - **Rättelse:** en tom plan fick en Boss utan koncept. Nu blir ingen Boss skapad, och hemmet säger ärligt att det inte finns något
    att köra, i stället för att visa en KÖR-knapp som inte startar något.
- **Hemmets rubrik** är målet som dagens plan tränar mest (lika antal → det närmaste), inte bara det närmaste datumet. Om det andra
  målet kommer tidigare står det "Före det:".
- **Föräldern: mål och täckning** (Översikt, v2). För varje mål visas:
  - storleken och varför den gäller (standard eller förälderns val);
  - hur många områden som är påbörjade i appen;
  - en **risk** när fler områden är opåbörjade än det finns dygn kvar innan målets dygn utan nytt (större prov: de sista tre;
    mindre: det sista).

  Planerarens täckningstryck använder en närliggande regel (minst lika många osedda som dygn före de sista tre). "Områden" i kortet
  är appens kunskapspunkter och moment, och totalen räknar ett gemensamt område en gång. Kortet ger ingen prognos, inga procent och
  ingen skuld.
- **Jämförelse** med samma fixturer och frön (4 frön × rätt-andel 0,7/0,85, syntetiska datum: mindre förhör dag 17, större prov dag 22
  och dag 30). Siffran är antal koncept introducerade före datum:

  | Mål | 3.3 | 3.4 |
  |---|---|---|
  | förhör (14 koncept) | 11,3 | 10,4 |
  | algebra (7) | 5,3 | 6,8 |
  | kemi (19) | 7,3 | 7,4 |

  (Siffrorna är oförändrade efter granskningens rättelser.)

  - Kemi: tillbakahämtning ett senare dygn 6,4 → 7,4. Ett uppehåll på fem dygn eller mer före provet förekom i 2 av 8 körningar
    och förekommer nu i 0 av 8.
  - Inget koncept tog mer än ett stadiesteg samma dygn, och inget nytt koncept nådde stadium 2 samma dygn (0 i båda byggena).
    Högst 4 nya koncept per dygn i båda byggena.
  - Kontroll (bara algebra och kemi): algebra 7,0 → 7,0, kemi 13,8 → 12,3. Skillnaden kommer från M8-rättelsen: inget osett de sista
    tre dygnen före algebraprovet (granskaren mätte −0,75 av det första −1,0 till M8 på dygnet före).
  - Den bindande gränsen är inlärningstakten (ungefär ett nytt koncept per dag när mycket pågår). Det är därför risken visas för
    föräldern i stället för att barnet överbelastas.
- **Mutationsprövat:** 15 av 15 egna mutationer fångas. Granskarens egna mutationer: 9 fångades och 7 missades först. Efter
  rättelserna finns tester för policyns gräns i alla tre policyer, ett ensamt prov, de sista tre dygnen och `weight` på skoluppgifter.
  Andelen för ett mindre mål (0,34), repetitionsandelen och Revansch-gränsen dagen före är inställningar som inte prövas var för sig.
- **Kända begränsningar:**
  - en storleksändring kan gå förlorad i en synk utan gemensam bas när den andra enheten har en egen väntande ändring av samma prov
    (provets objekt vinner som helhet, som för alla provändringar sedan tidigare);
  - ett större prov utan inlagda områden bromsar fortfarande annat nytt veckan före (som i 3.3).
  - ett koncept som planen tar två gånger räknas två gånger mot gränsen (som i 3.3), vilket ger något färre nya än gränsen.
- **Rollback:** 3.3-bygget. Det tillagda fältet `weight` på prov ignoreras av äldre versioner, som då räknar alla mål som större
  (beteendet före 3.4). Inget annat i profilen ändras.

## 3.4.0 (del 2) – Öva mer: belöningar har tak, lärandet inte (gren `le-more`, bygger på `le-multigoal`)
- **Efter dygnets belönade extrablock** visar hemmet och KLAR först "Bra jobbat idag! Det du har övat sätter sig bäst om du vilar
  nu." Extrablocken är FLOW och provträning tillsammans, högst `FLOW_MAX` = 3. Därefter kan barnet frivilligt välja:
  - **Öva mer**: samma plan som FLOW och dygnets gräns för nytt;
  - **Öva mer inför <mål>**: provträning som alltid håller sig inom målet, också Boss, Rescue och omförsök.

  Båda märks "utan poäng" och erbjuds **bara när planen gör nytta**: något nytt inom dygnets gräns, något som inte blivit rätt idag,
  en Utmaning, eller något som fortfarande lärs in (stadium ≤ 1) och har färre än tre rätt idag. "Rätt idag" räknas ur bevisen, inte
  ur `lastOk`, som bara sätts vid kvalificerande svar. Utan det kunde samma block erbjudas gång på gång (andra granskningen). Annars visar appen ärligt "Det finns
  inget mer som gör nytta att öva i appen idag …" och en befintlig resurs om målet har en. Ingen utfyllnad.
- **Utan poäng, vid källan:** under ett övningsblock (`S.v2.po`) ger svaren inga XP, och dagens uppdrag, svitbonusen, Utmaningens
  XP, motorns belöningar, märken och felfritt pass räknas inte. Spärren gäller bara i övningsskärmen och slutar när blocket är slut
  (`V.ended`). Ett avbrutet block spärrar alltså inte senare.
  - Ingenting återställs i efterhand. Första versionen återställde allt till blockets start vid varje sparning, vilket enligt den
    oberoende granskningen kunde ge gratis köp, sudda ut belöningar från en annan enhet och ångra en nollställning.
  - Motorns belöningsliggare förbrukas inte.
- **Testa mig:** dagens första omgång ger poäng. Följande omgångar samma dygn är utan poäng, och resultatet säger det.
- **Lärandet:** svaren blir bevis som vanligt, och fel hanteras med Felboken och motorns sänkning. Motorns regler gäller: högst ett
  stadiesteg per dygn, flerval samma dygn räknas inte två gånger, och kalibreringen tar inte med samma dygn. Passposten är
  `po:1` (`m:'more'` eller `'mission'`).
- **Ingen autostart och tydlig slutpunkt:** "Klar för idag" efter varje block. Prövat med riktig väntan.
- **Två enheter offline:** Öva mer ger inga XP- eller diamantdelta. Efter sammanslagning finns bara de belönade blocken, och båda
  enheternas övningsposter finns kvar.
- **Simulering** (`tests/le/matrix.js`, långa pass med KÖR, 3 FLOW och 2 Öva mer varje dygn): se programrapporten. Samma-dygnssteg
  0, och dygnets gräns för nytt håller.
- **Tester och mutationer:** `tests/test_ova_mer.js` (101 kontroller) täcker k8, k4 och k2, två enheter, köp, synk och uppdrag efter
  ett block, gemensam gräns för extrablock, Testa mig och ärligt slut. Granskarens och egna mutationer fångas, utom räknaren för felfritt pass (ett märke som delas ut en gång). Det gäller också ett
  avbrutet block, granskarens fall med upprepning (k4, frö 41) och hemmet när provträningar använt dygnets extrablock.
- **Känt:** märkesräknarna (rätt totalt, säker på ett område) räknar också övning. Ett sådant märke kan alltså nås något tidigare.
  Varje märke ges en gång.
- **Kvar utanför v3:** Klassiskt läge och v1 har sina gamla regler för extra pass.
- **Rollback:** del 1 eller 3.3.
  - 3.3 räknar bara `m:'flow'` och visar "vila nu" efter tre FLOW.
  - Passposterna `more`/`po` påverkar inte 3.3.

## 3.5.0 – Privata bilder (gren `private-images`, ombaserad på 3.4.0)
- **Bara familjens privata lagring:** `families/{familj}/assets/{sha256}`.
  - Läses bara av familjens medlemmar (`firestore.rules`). Ingen appklient får skriva.
  - Inga offentliga länkar. Inga bilder i repot, bygget eller CI.
  - `_content.assets` är manifestet. Innehållet hänvisar till id:n, aldrig till HTML.
- **Appen** (`src/05j_assets.js`) kontrollerar varje bild innan den visas: typ ur filens byte (PNG/JPEG), högst 200 000 byte och
  1024 × 1024, upplösning ur bildens huvud och sha256 = revision.
  - En bilduppgift (`pack.visual`) byggs bara när **alla** dess bilder är hela. Annars finns den inte. Den blir aldrig en
    textuppgift utan bild.
  - Alt-texten skrivs av appen och är neutral. Bilden sätts in via DOM, och textens tvätt är oförändrad.
  - Testa mig utan bilder säger ärligt att bilduppgifterna inte var med.
  - Cache per familj. Den töms vid familjebyte och bortkoppling. En redan nedladdad kopia kan inte raderas på distans.
- **Former:** bild → text, text → bild, skriv namnet, para ihop (inte i Testa mig) och sortera. Flerval räknas enligt motorns
  befintliga regel och blir aldrig ensamt säker kunskap.
- **Äldre klienter** läser inte `visual`. Paketet godtas och textuppgifterna är byte-identiska, så ingen versionsspärr behövs.
  - CI prövar 1.2.0–2.1.1 (referensbyggena i `tests/golden`).
  - 3.3 är prövat lokalt (`OLD33=<bygge>`), också av granskaren.
- **Rättelser efter den oberoende säkerhetsgranskningen:**
  - **Felboken i v1:** en fel besvarad bilduppgift hamnar aldrig i v1:s Felbok, som bara sparar text och därför skulle visa uppgiften
    utan bild.
  - **Visning:** förklaringskortet och Testa mig-resultatet visar lösningen med bilderna (sortera och para ihop också).
  - **Hämtning:** en hämtning där allt redan fanns låste tidigare kommande hämtningar. Det är rättat.
  - **Rensning:** bilder som inte längre finns i manifestet rensas ur minnet och cachen.
  - **Validering:**
    - ärvda egenskaper godtas inte som bildtyp;
    - etiketterna i para ihop blandas;
    - kvalitetsgrinden stoppar dubblerade bild-id:n, symboliska länkar, fler än 200 bilder och bilduppgifter som ligger direkt i
      paketet.
- **Kända begränsningar:**
  - Bildens namn syns som `data-asset` i sidans kod, men inte för hjälpmedel. Använd därför neutrala namn i manifestet om namnet
    vore svaret.
  - Ursprung och rätt att använda finns bara i det privata repot, inte i lagringen.
  - Cachen delar webbläsarens lagringsutrymme med framstegen. Den har ett tak, 1,5 miljoner tecken.
- **Publicering:**
  - Ordningen: `bundle` (kontroll) → `fetch` → `assets` (oföränderliga revisioner, kan köras om) → `verify-assets` →
    `publish --expect` (vägrar om en refererad bild saknas) → `verify`.
  - `restore` gör samma kontroll. Bilder raderas aldrig av verktygen.
  - Prövat i emulatorn (`tests/rules/publish.test.mjs`) och för åtkomst (`tests/rules/rules.test.mjs`).
- **Regler:** de nya `firestore.rules` (bara blocket `match /assets/{rev}`) är **publicerade i produktion av ägaren**, efter
  granskning och Rules Playground-fallen A–E (medlem läser: tillåtet; oinloggad, icke-medlem, annan familj och skrivning: nekat;
  befintlig profilläsning: tillåten). Appen ändrar inte regler.
- **Ägarsteg:**
  - ~~publicera de nya reglerna (Firebase-konsolen)~~ – klart;
  - merga och släpp appen;
  - lägg till stegen `assets`/`verify-assets` i det privata repots publicering (förberett i innehålls-PR:en).

  Inga nya molnresurser, ingen ny IAM och ingen ny nyckel behövs.
- **Arkitektur:** Firestore `assets/{sha256}` är den pragmatiska lösningen för en familj, inte automatiskt slutarkitekturen för
  School Packs. Se `docs/CONTENT_PUBLISHING.md` (”När Firebase Storage behövs”). Ingen Storage, ingen fakturering och ingen ny IAM
  har skapats.
- **Rollback:** 3.4-bygget (`release-3.4.0-f286ba6`) eller 3.3-bygget (`release-3.3.0-4ca940f`). Äldre appar ignorerar `visual` och `assets`. Reglerna kan ligga kvar, eftersom de bara lägger
  till en läsväg för medlemmar.

## 3.6.0 – Kommande prov och läxor på barnets startsida
- **Ägarens önskemål:** barnet ska själv se alla kommande prov och läxor och förstå varför det pluggar. Startsidan visade bara nästa
  mål och en rad "Sedan".
- **Kortet "Kommande prov och läxor"** ligger direkt under dagens kort, före "Läget inför", i alla tre upplevelserna.
  - Alla barnets mål de närmaste 60 dygnen, i datumordning, högst sex (resten som "och N till").
  - Typ (Prov, Läxa, Glosor), datum och "idag", "imorgon" eller "om X dagar". Mål inom tre dygn markeras.
  - Bara barnets egna mål (samma källa som planen). Inga betyg, inga procent, ingen jämförelse.
  - **Ärligt:** ett mål vars områden inte finns i appen får texten "inte inlagt i appen ännu", och kortet lovar då inte att Kör! övar
    det.
  - Inget kort när barnet inte har några kommande mål.
- **Kör och Testa mig per mål** (ägarens andra önskemål): varje rad med innehåll i appen har två knappar.
  - **"Kör · N min"** övar bara det målet. Det är samma läge som den befintliga "Öva inför provet" (`mission`): bara målets
    koncept, dygnets gräns för nytt, och det räknas som ett av dygnets extrapass.
  - **"Testa mig"** prövar om det sitter. Det är samma prov som i "Läget inför", med en belönad omgång per dygn.
  - **En regel** (`EXP.goalPractice`) för radernas Kör och startkortets "Öva mer inför". Före dagens pass gäller som för "Öva inför
    provet". Efter dagens pass erbjuds Kör bara när målets träning gör nytta (`EXP.useful`), och efter dygnets belönade extrapass
    står det "utan poäng".
  - När motorn inte ger något extrapass idag (t.ex. kvällen före ett prov) erbjuds ingen Kör alls. Då säger raden, precis som
    startkortet, "Inget mer som gör nytta idag".
  - Inget att öva: "Inget att öva just nu". Ingen utfyllnad, ingen ändlös upprepning och ingen belönad upprepning.
  - Startkortet erbjuder "Öva mer inför" för det första målet där träningen gör nytta. Skärmen säger därför aldrig "inget mer som
    gör nytta" samtidigt som en rad erbjuder Kör.
  - Före första synken och för mål utan innehåll finns inga knappar.
- **Läget per mål i samma rad** (ägarens tredje önskemål): varje rad med innehåll har ett hopfällt "Läget".
  - Sammanfattningen säger till exempel "2 bra koll · 1 öva lite mer" eller "för lite underlag ännu".
  - Utfällt visar det motorns läge per område, aldrig procent. Det är samma källa som det tidigare kortet "Läget inför"
    (`V2.examStatus`/`EXP.goalAreas`).
  - Kortet säger en gång att lägena inte är en prognos.
  - Det separata kortet "Läget inför" visas inte för ett mål som har en rad i Kommande (`EXP.goalDetailUnless`).
- **Foten säger vad nästa pass på startsidan faktiskt övar.** Den räknar på samma plan som startkortets rubrik (`EXP.examShare`).
  - Före dagens pass: "Dagens pass övar inför …".
  - Efter dagens pass: "Nästa extrapass övar inför …", men bara medan ett extrapass erbjuds.
  - Utan plan finns ingen fot.
- **"Bara prov och läxor"** med mål längre bort än fyra veckor: startkortet säger att Kör! börjar fyra veckor före.
  - Hänvisningen "tryck Kör på raden" visas bara när en sådan rad faktiskt erbjuder Kör (`EXP.goalPractice`).
  - När raden säger "Inget mer som gör nytta idag" hänvisar startkortet inte dit.
- **Före första synken** rör kortet inte motorns tillstånd. Det visar då bara listan, utan knappar, läge eller löften.
  - `LE.canStart` gäller också kortet "Läget inför" i grow-upplevelsen.
  - Det kortet kunde redan i 3.5 migrera en kanske inaktuell profil före första synken.
- **Rättelse, dygnets gräns för nytt i provträningen:** motorn kunde planera ett aldrig sett provkoncept som "fokus" ("provet närmar
  sig") trots att dygnets gräns för nytt var nådd. `V2.plan('mission')` tar nu in högst så många nya koncept som gränsen tillåter.
  - Felet fanns redan i 3.4/3.5 men nåddes inte av testerna.
  - "Sett" betyder `n > 0` eller `fs`, som i `V2.newToday` och motorn. Koncept som migrerats från v1 har inget `fs`.
  - Glosdäck räknas inte in i gränsen, precis som i `V2.newToday`.
  - Verifierat mot 3.5.0 med fixturen ur `test_ova_mer.js` (sex frön, provträning för båda målen efter dagens pass och
    extrapass): 3.5.0 går över gränsen med ett koncept i alla sex. 3.6 går aldrig över.
  - Dagens pass (motorns 3.4-regel M8) kan som förut ta in aldrig sedda provkoncept utöver `pol.maxNew`. Det gäller koncept vars
    förkunskaper inte sitter, så länge provet ligger mer än tre dygn bort.
    - I matrisen blev det högst ett över, alltså 4 per dygn för de äldre.
    - Det är en observation, inte en garanti: syntetiska planer kan ge fler.
    - Det är oförändrat och inte en del av den här rättelsen; motorn ändras bara med simuleringsstöd.
  - Grenen i `test_ova_mer.js` som prövar "Öva mer inför" efter dygnets extrapass körs nu (106 kontroller, tidigare 101) och
    fångar felet. Den letar efter knappen i dagens kort (`.mission`), eftersom radens egna knappar prövas i `test_kommande.js`.
  - Motorns kärna är orörd; spärren ligger i appens planlager.
- **Före första synken med "Bara prov och läxor":** startkortet byggde motorns tillstånd före spärren för första synken. Felet fanns
  sedan 3.1. Spärren (`LE.canStart`) gäller nu i `V2.scopeCard` självt (alla upplevelser, också klassisk), så kortet Kommande visar bara listan också i det läget.
- **Typ och kontrast:**
  - Ett mindre prov som föräldern lagt in utan typ (läx- eller glosförhör) heter "Förhör".
  - Etiketter och knappar har kontrast på alla papper, färger och accenter (axe).
  - `role="list"`.
- `test_exp_v3.js` letar efter det hopfällda läget där det nu ligger: `details.goal-detail` eller kortets `details.up-state`.
- **Motorns kärna är orörd.** Belöningarna och synken är oförändrade. Knapparna startar befintliga lägen.
- **Test:** `tests/test_kommande.js` (88 kontroller). Webbläsartestet (axe, ingen sidledsscroll) går över startsidan i alla storlekar.
- **Dokumentation:** `docs/CONTENT_PUBLISHING.md` säger nu att en framtida Storage-lösning ska läsa genom reglerna och aldrig dela ut
  nedladdningslänkar (anmärkning från granskningen av 3.5).
- **Rollback:** 3.5.0-bygget.

## 3.6.1 – Dagens plan skild från nästa deadline (Achieve)
- **Ägarens fynd:** startkortet hade läxförhöret som rubrik ("NÄSTA MÅL · LÄXFÖRHÖR ORIENTERING", "Det här tränar vi idag:
  Orienteringsbegrepp"), men passet började med algebra. Motorn blandar målen och lägger ett ämne som väntat länge tidigt; kortet
  grupperade målets moment först.
- **Ägarens beslut:** motorns val av innehåll **och** ordning behålls. Bara presentationen ändras, och bara i Achieve-kortet.
  - **NÄSTA DEADLINE:** det närmaste målet på en liten rad (titel, datum, "om N dagar") med andelen i dagens plan: "4 av 9
    uppgifter inför läxförhöret i dagens plan", "Dagens plan övar annat" eller "Läxförhörets områden är inte inlagda i appen ännu".
    Det är inte längre kortets stora rubrik.
  - **DAGENS PLAN:** rubriken är ämnena i den ordning de först kommer i passet ("MATTE + ORIENTERING"), sedan "9 uppgifter ·
    cirka 10 min" och fördelningen ("4 matte · 4 orientering · 1 bossuppgift"). Bossen väljs under passet bland det som gått bra
    och räknas därför för sig, inte som ett ämne.
  - **Det här tränar vi idag:** områdena per ämne, ämnena i passets ordning. "Först matte, sedan orientering." bara när ämnena
    verkligen kommer i block; annars "Ämnena blandas i passet. Det börjar med matte."
  - **Ett Kör** för den blandade planen. Kör på varje rad i Kommande startar som förut bara målets träning (också Boss, Rescue och
    omförsök). Deadlinens egen knapp visas bara när dagens plan inte övar målet och målets träning har något som gör nytta.
- **Rätt ord för målet** (`EXP.noun`): "inför läxförhöret", "inför glosförhöret", "inför provet" – typen går före titeln, och
  förälderns egna mål känns igen på titeln. Gäller andelen, "Öva inför …", "FORTSÄTT MOT …", KLAR-chipet och "… områden är inte
  inlagda". Ett läxförhör kallades tidigare "provet".
- **Ämnesnamn** (`EXP.subjLabel`): paketets ämne ("orientering", "kemi"), glosor efter språk, inbyggd matte som "matte".
- **Grow och Explore** ändras inte utom ordet för målet. Grow-kortets rubrik "DAGENS MISSION · <mål>" har samma inramning; det är
  noterat för ägaren och inte ändrat (ingen bred UI-iteration).
- **Motorns kärna är orörd.** Planen, ordningen, belöningarna och synken är oförändrade; `test_promise_exec.js` visar fortfarande
  att knappen startar det kortet lovar.
- **Test:** `tests/test_kortplan.js` (103 kontroller). Kortet jämförs med det pass som faktiskt spelas, sex dygn i följd:
  rubrikens mål är inte passets första ämne (fem av sex dygn), visad fördelning = spelade platser, visad startordning = första
  aktiviteten, "Först … sedan" bara för block. Målradens Kör håller sig inom målet också med stöd och omförsök. Mål utan innehåll
  ger ingen Kör-hänvisning. Befintliga test som läste den gamla rubriken ("NÄSTA MÅL", "Också idag") läser nu den nya.
- **Rättelse som följer med:** ⚙ i föräldraläget hämtade påminnelsernas senaste körning igen vid varje omritning när dokumentet saknades
  i molnet eller nätet var borta – en ändlös hämta-rita-om-slinga så länge ⚙ var öppet (fanns sedan 1.1.0, hittad av
  observationstestet i 3.7). Nu hämtas den en gång per sidladdning och sidan ritas om bara när något kom. `tests/test_parent_status.js`
  (10 kontroller; den gamla raden ger 6 fel).
- **Rollback:** 3.6.0-bygget.
