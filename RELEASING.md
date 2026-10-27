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

