# Pluggapp

En lokal-först pluggapp för grundskolan: matte (åk 2, åk 4, åk 8/algebra), svenska, NO/SO, kemi, geografi, spanska och engelska.
Vanilla JavaScript, en enda HTML-fil, installeras som webbapp på telefon/surfplatta.

- Allt innehåll (uppgiftsgeneratorer, frågebanker, metodsidor) är generiskt och ligger i koden.
- Allt som rör en specifik familj – barnens namn, kurs, tema, prov, skolans glosor – ligger i familjens **privata konfiguration** i Firestore och läses in efter parkoppling. Inget sådant finns i detta repo.
- Framsteg synkas mellan en familjs enheter via Firestore. Åtkomst styrs av `firestore.rules`.
- Påminnelser skickas av `.github/workflows/reminders.yml` (web-push).

Lärmotor v2 är standard från 2.0.0 (v1 finns kvar som reserv per barn). Från 2.1 beskrivs kunskapen i Concept Packs
(`content/packs/`, `docs/CONCEPT_PACKS.md`) som appen gör om till många frågeformer. Familjens eget skolmaterial tolkas av
Claude och läggs i familjens privata lagring – aldrig i repot (`docs/CONTENT_WORKFLOW.md`).

Publiceras via GitHub Pages. Källkod i `src/`, tester i `tests/`, bygge med `npm run build` (→ `dist/`). Se `RELEASING.md` för bygg-, test- och releaseprocessen.
