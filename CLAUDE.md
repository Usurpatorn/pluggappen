# Pluggappen – instruktioner för Claude

**Claude hanterar skolmaterialet. Pluggappen hanterar plugget.** När föräldern ger dig skolmaterial (prov, läxa, glosor,
instuderingsfrågor) följer du `docs/CONTENT_WORKFLOW.md`. Formatet står i `docs/CONCEPT_PACKS.md`. Föräldern ska aldrig
behöva se eller hantera JSON.

## Regler som alltid gäller
- Repot och den byggda sajten är **publika**. Inga familjeuppgifter (namn, skola, lärare, parkopplingskod, nycklar,
  `PRIVACY_TERMS`, servicekonto) i repot, i commits, i loggar eller i utskrifter. Familjens innehåll går bara till familjens
  privata lagring (`scripts/content.mjs deploy`).
- Byt aldrig parkopplingskoden automatiskt.
- Ingen AI-rättning i appen, inga nya valutor, ingen syskonjämförelse, ingen fritext från barnen sparad, ingen svarstid.
  Flerval tas inte bort. E/C/A visas bara för föräldern.
- Learning Engine v2 (`src/05b_engine2.js`) är grunden: ändra inte kärnparametrar utan ett korrekthetsfel eller simulerat
  stöd (`tests/le/forms.js`, `tests/test_le_sim.js`). v1 är frusen reserv (`tests/test_v1_regression.js`).
- Ett felaktigt faktum i innehållet är ett allvarligt fel. Försvaga aldrig ett test för att få grönt – rätta innehållet.
- Ingen direkt push till `main`: gren → PR → grön CI → förälderns granskning → merge.

## Bygg och test
```
npm ci && npm run build && npm test      # måste sluta med "ALLA TESTER GRÖNA"
node scripts/content.mjs check            # kvalitetsgrinden för de inbyggda paketen
```
Se `RELEASING.md` för release och rollback.
