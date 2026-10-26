# Innehållsflödet – Claude hanterar skolmaterialet, Pluggappen hanterar plugget

**Föräldern ska aldrig behöva förstå eller hantera det interna formatet.** Föräldern ger Claude materialet (ett foto av
instuderingsfrågorna, en PDF, en PowerPoint, en länk, "kemiprov 20 november, kapitel 3") och säger vilket barn det gäller.
Claude gör resten och svarar med en kort sammanfattning: vad som lades in, vad som är osäkert och när det syns i appen.

Pluggappen innehåller ingen uppladdning, ingen OCR, ingen AI-generering och ingen redigering av innehåll. All tolkning av
material sker här, hos Claude, med granskning innan något släpps.

## Ansvar
| Vem | Ansvar |
|---|---|
| Claude | innehållet: tolka material, skriva Concept Packs och skoluppgifter, kvalitetsgrind, faktagranskning, släpp |
| Pluggappen | inlärning, planering, genomförande (Smart Kör!, Felboken, Testa mig, repetition) |
| Föräldraläget | kontroll och diagnostik (motor v1/v2, policy, innehållshälsa) |
| Barnet | i första hand **KÖR!** |

## Mall för ett innehållsuppdrag

1. **Granska källorna.** Läs allt material. Notera för varje del: dokumentets etikett (utan personnamn), sida, bild,
   frågenummer, avsnitt. Skilj på lärarens frågor (ska bevaras ordagrant) och förklarande text.
2. **Klargör uppdraget.** Barn, typ (prov/läxa/glosor/övning), datum, omfattning. Fråga bara om det som inte går att utläsa
   och som skulle ändra resultatet (t.ex. vilket barn, vilket datum). Annars: rimligaste tolkningen, och säg vilken.
3. **Kartlägg kunskapspunkter.** Återanvänd befintliga punkter (`node scripts/content.mjs stats`, `content/packs/`) innan nya
   skapas. En lärarfråga ≠ en punkt. Bestäm kunskapstyp per punkt.
4. **Skriv innehållet** enligt `docs/CONCEPT_PACKS.md`: förklaring, fakta i flera slag (så att alla stadier får aktiviteter),
   missuppfattningar, samband, källor. Åldersanpassa språket efter policyn. Lärarfrågorna i `work.json` med facit och
   felalternativ när de kan rättas säkert – annars utan facit (de styr då bara vilka punkter som prövas).
5. **Kvalitetsgrind.** `node scripts/content.mjs check <mapp>/packs` och `node scripts/content.mjs bundle <mapp> <ut.json>`
   (validerar även skoluppgifterna: kända punkter, rättningsbara lärarfrågor, inga namn ur den privata termlistan).
   Rött = rätta innehållet, aldrig testet.
6. **Oberoende faktagranskning.** En separat granskare (en agent som inte skrev innehållet) kontrollerar sakuppgifter, språk
   och grammatik, ålder, tvetydighet, felalternativ (inget får vara "också rätt"), formmatchning, källor och utmaningar.
   Åtgärda allt. Ett felaktigt faktum blir varaktigt inlärt – det är ett allvarligt fel.
7. **Kontrollerat släpp.**
   - Allmän kursplanekunskap (utan familjedata) → `content/packs/`, `node scripts/content.mjs lock`, PR med CI.
   - Familjens material → **bara** familjens privata lagring, via det privata innehållsrepot (väg B, vald av föräldern 2026-10-26):
     Claude lägger paket och `work.json` i `content/` som en PR; CI kör kvalitetsgrinden; föräldern mergar (= godkännande);
     workflowen publicerar nyckelfritt med backup, konfliktskydd, återläsning och rollback. Se `docs/CONTENT_PUBLISHING.md`.
   - **Vem som får skriva:** `_content` är skrivskyddat för alla appklienter (`firestore.rules`). Bara tjänstekontot
     `content-publisher` skriver – och det kan bara lånas av publiceringsworkflowen i miljön `production` (ingen nyckelfil finns).
     Claude har aldrig några nycklar och ber aldrig om dem i chatten. `deploy` med en nyckelfil finns kvar som reserv men används inte.
   - Inget verkligt skolmaterial publiceras förrän spärren `PUBLISH_ENABLED` har slagits på av föräldern.
8. **Rapportera kort** till föräldern: vad som finns i appen nu (t.ex. "Kemiprovet 20 november: 14 kunskapspunkter, 9 av
   lärarens frågor i Testa mig"), vad som var osäkert, och vad barnet ser ("KEMIPROV · 20 NOVEMBER / IDAG 8 minuter / KÖR").

## Uppföljning
- **Innehållshälsa:** barnet kan trycka "Den här frågan är konstig". Föräldern ser flaggorna i Föräldraläge → barnet →
  Motor v2 → *Innehållshälsa*, med en färdig text att klistra in hos Claude. Claude granskar frågan, höjer `rev` och släpper en
  rättad version. Appen ändrar aldrig innehåll av sig själv.
- **Ändrade planer** (provet flyttas, ett kapitel stryks): uppdatera `work.json` och släpp igen. Appen planerar om
  automatiskt – ingen skuld, ingen eftersläpning.

## Säkerhet och integritet
- Repot är publikt: inga namn, skolor, lärare, koder eller nycklar i repot eller i den publika bygget.
- Barnets svar sparas aldrig som fritext; ingen svarstid; ingen extern analys.
- Rättningen är deterministisk. Ingen AI-rättning i appen.
