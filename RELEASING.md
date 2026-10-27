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


## 3.2.2 – Synkens integritet (utkast, 2026-10-27)
- **Varje skrivning av en barnprofil är villkorad** på den version enheten senast hämtade (`currentDocument.updateTime`, eller
  `currentDocument.exists=false` för en ny profil). Har en annan enhet hunnit skriva nekar Firestore; enheten hämtar, slår ihop och
  försöker igen (högst tre gånger per omgång, sedan nya omgångar efter 5 s, 15 s, 60 s, 120 s – och direkt när nätet kommer tillbaka
  eller appen visas igen). Okänd version → hämta först. Ingen blind skrivning av en hel profil.
- **Kön tappar aldrig:** ett barn lämnar uppladdningskön först när skrivningen bekräftats.
- **Trevägssammanslagning** mot den senast kända serverversionen (`DB.syncBase` – bara på enheten, aldrig i profilen): det som inte
  ändrats på enheten tas från familjens data, även raderade prov, egna ordlistor och avstängda ordlistor. Bevislogg, XP, ord, Felboken
  m.m. slås ihop som förut. Saknas basen (första gången efter uppdateringen) gäller den tidigare sammanslagningen.
- **Serverns tid avgör** om en version redan finns på enheten – aldrig enheternas klockor.
- Test: `test_sync_integrity.js` (fall A–H och återgång), `tests/rules/sync_precondition.test.mjs` (Firestore-emulatorn i CI).
- Rollback: föregående release-tagg. Profilernas format är oförändrat; en äldre version ignorerar `DB.syncBase` (men skriver då åter
  utan villkor).
