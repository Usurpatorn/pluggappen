# Förslag: lätt nivåjustering vid första start (inte byggt)

Status: **förslag**. Riktningen är godkänd av föräldern (2026-10-26), men det är inte implementerat. Det hålls separat från Experience v3. Underlag från felutredningen av provknappen (hotfix 2.1.1).

## Läget i dag (2.1.1)

- **Startkurs.** Utan historik börjar Äldre på kursmallens egen första kurs (åk 8). Yngre och Mellan börjar på lägsta nivån.
  Det här är ett **utgångsläge**, inte en verifierad placering. Ingenting i appen vet om barnet redan kan orden.
- **Igenkänning före produktion.** Ett nytt ord visas först som introduktionskort och sedan som flerval (`pick`). Barnet skriver
  ordet själv (`type`) först i låda 2.
- **Framsteg.** Rätt svar flyttar ordet en låda upp (1 → 3 → 7 → 14 → 30 dygn). Fel svar flyttar det två lådor ner.
- **Följd:** ett ord som barnet redan kan behöver minst tre rätta svar på minst fyra dygn innan det räknas som inlärt (låda 3).
  De två första svaren är flerval. Kända ord går alltså långsamt, och flervalen känns för lätta för den som redan kan orden.
- Ålder eller noll XP används inte som bevis för någon nivå. Inget betyg sätts på ett ord.

## Förslag (lätt, ingen obligatorisk diagnos)

1. **Produktion först för nya ord (Äldre).** Första gången ett nytt ord dyker upp får barnet frågan "Kan du redan det här? Skriv
   ordet." och en knapp "Jag vet inte än".
   - Rätt svar utan hjälp hoppar över introduktionen och de lätta flervalen. Ordet flyttas till låda 2 (åter om 3 dygn), **inte** till
     "inlärt". Ett enda rätt svar är inget bevis för långtidsminne. Ordet räknas som inlärt först efter en fördröjd hämtning en senare dag.
   - **Ordförståelse och stavning hålls isär** där innehållet tillåter det. Ett svar med litet stavfel (samma tolerans som i dag) visar
     att barnet förstår ordet: introduktionen hoppas över, men stavningen övas vidare, och ordet flyttas inte förbi låda 1.
     Kurser utan stavningskrav (`noSpell`) prövar bara förståelse, med flerval i stället för att skriva.
   - "Jag vet inte än" eller fel svar ger introduktionen som i dag. Ingen bestraffning: inget minus och ingen Felbok, och ordet hamnar
     inte efter andra nya ord.
   - Det använder befintliga lådor och befintlig rättning. Ingen ny motor behövs, och barnet tar sig snabbt igenom det som redan sitter.
2. **Förslag till föräldern, inte automatik.** Om till exempel 8 av de 10 första nya orden i en kurs klaras på första försöket
   visas ett förslag i föräldravyn: "Kursen verkar för lätt – börja på nästa?". Föräldern bestämmer, och inget byts tyst.
3. **Valbar startkurs per språk** i föräldravyn, för den som vet var barnet ligger.

Medvetet utelämnat: ett långt diagnostiskt test vid första start, automatisk nivåplacering och betyg per ord.

## Mätning innan beslut

- Andel nya ord som klaras på första försöket per barn och kurs. Den finns redan i loggen.
- Antal pass tills en kurs är "inlärd", före och efter förslag 1. Det mäts i simulering med syntetiska profiler, enligt samma
  regel som andra motorändringar.
