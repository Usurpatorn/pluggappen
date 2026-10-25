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
