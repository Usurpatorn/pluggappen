# Family Platform, fas 1: barnbunden enhet (plan – inte implementerad)

Status: **plan och testmatris**. Inget här är byggt. Det startas först efter ett separat godkännande, efter programmet
"Experience 3.3 och studieberedskap".

> **Läget i dag (gäller tills den här fasen är driftsatt):** varje enhet som har parkopplats med familjens kod är medlem i hela familjen.
> Den kan läsa och skriva **alla** barnens profiler. Rollen (`kid`/`parent`) väljer enheten själv när den går med.
> Att startsidan i 3.3 inte visar syskonens nivå, XP och streak är **presentation, inte isolering**.

## 1. Mål
Ett barns enhet kan bara läsa och skriva det egna barnets data. Det ska **servern** se till (Firestore-reglerna), inte appen.
Föräldern äger familjen och bestämmer vilka enheter som hör till vilket barn.

## 2. Nuvarande modell (det som ändras)
| Del | I dag | Problem |
|---|---|---|
| Inloggning | Anonym Firebase Auth per enhet (`04b_auth.js`) | Ingen identitet för föräldern utöver enheten |
| Medlemskap | `members/{uid}` skapas av enheten själv med rätt `joinCode`; `role` väljs fritt (`validMember`) | **Självtilldelad föräldraroll** |
| Profiler | `profiles/{kidId}`: läs och skriv om `isMember()` | **Alla barn är synliga** för alla enheter |
| Privat innehåll | `profiles/_content`: läs om medlem, skrivs bara av servicekontot | Hela familjens skoluppgifter syns på varje enhet |
| Övergång | `legacyGrace()` till 2026-11-09 (gammal familjekod utan inloggning) | Upphör av sig själv. Den nya fasen ska inte förlänga den |

## 3. Krav (från ägaren)
1. Betrodd föräldraägare.
2. Föräldern skapar och hanterar barn.
3. Föräldern godkänner varje barnenhet.
4. En barnenhet är bunden till ett barn.
5. Läs- och skrivomfång upprätthålls av servern.
6. Ingen kan själv ge sig föräldrarollen.
7. Återkallelse och återställning.
8. Uttryckligt undantag för en delad enhet.
9. Den nuvarande familjen flyttas över utan att offline-framsteg går förlorade.

## 4. Föreslagen design
### 4.1 Föräldern
- **Föräldraidentitet:** Firebase Auth med ett riktigt konto, till exempel e-postlänk eller Google, på föräldrarnas enheter. Den anonyma
  identiteten räcker inte för ägarskap. *Kräver att ägaren slår på en inloggningsmetod i Firebase-konsolen. Det är gratis för de här
  metoderna, men verifiera mot aktuell dokumentation före beslut.*
- `families/{fam}/meta/owners/{uid}`: skapas bara av servern eller vid familjens första bootstrap av ett inloggat konto som inte är
  anonymt. Därefter kan bara en ägare lägga till en ägare.
- Reglerna kontrollerar `request.auth.token.firebase.sign_in_provider != 'anonymous'` för allt som kräver föräldern.

### 4.2 Barnenheter
- Parkoppling i två steg:
  1. Barnenheten (anonym) skapar `pairRequests/{uid}` med en kort engångskod som visas på skärmen. Ingen åtkomst till data.
  2. Föräldern ser förfrågan och väljer barn. Föräldern skriver `members/{uid} = { role: 'kid', kid: '<kidId>', approvedBy, approvedAt }`.
- Reglerna:
  - `members/{uid}` får **bara skapas eller ändras av en ägare**. Enheten kan inte skriva sitt eget medlemskap, och därför inte heller sin roll.
  - `profiles/{kidId}`: läs och skriv om `isOwner()` **eller** `member.role == 'kid' && member.kid == kidId`.
  - `profiles/_content`: delas upp per barn (`content/{kidId}`), eller filtreras per barn vid publicering. Barnenheten läser bara sitt eget.
  - `meta/info`, `members`, `push_*`: barnenheten läser bara sitt eget medlemsdokument.
- **Delad enhet (undantag):** `role: 'shared'` med en uttrycklig lista `kids: [...]`, satt av föräldern. Föräldravyn visar varningen
  "Den här enheten ser flera barn". Den ger aldrig föräldrarätt.

### 4.3 Återkallelse och återställning
- Föräldern tar bort `members/{uid}`. Enhetens nästa läsning eller skrivning nekas av servern. **Kopior som redan finns offline på
  enheten raderas inte på distans.** Appen tömmer sin lokala kopia när den upptäcker att åtkomsten är nekad, men det går inte att
  lova för en enhet som är avstängd eller aldrig kommer online igen.
- Förlorad föräldraenhet: en annan ägare kan logga in med kontot. Utan någon ägare finns en dokumenterad återställning via
  servicekontot (ägaren kör den, ingen nyckel i chatten).

### 4.4 Migrering av den nuvarande familjen
1. **Release N (bakåtkompatibel):** appen förstår de nya fälten och skriver ännu inget nytt. Reglerna är oförändrade.
2. Föräldern loggar in med kontot och blir ägare (bootstrap: ett konto som inte är anonymt och är medlem med `role: 'parent'`
   i dag blir ägare **en gång**, och sedan stängs vägen).
3. Föräldern godkänner varje befintlig enhet till rätt barn i en lista över enheterna (namn, senast sedd). Inget gissas automatiskt.
4. **Release N+1 (regler):** de nya reglerna driftsätts. Enheter som inte godkänts nekas och visar "Be en förälder godkänna enheten".
   Deras lokala data finns kvar.
5. **Offline-framsteg:** en enhet som varit offline och sedan godkänns synkar som vanligt med 3.2.2-synkens trevägssammanslagning.
   En nekad enhet behåller sina lokala framsteg tills den godkänns. Den skriver dem aldrig till ett annat barn.

## 5. Testmatris (emulatorn: `tests/rules/`, och jsdom: flera enheter)
| # | Fall | Väntat |
|---|---|---|
| R1 | Anonym enhet utan medlemskap läser `profiles/k2` | nekas |
| R2 | Barnenhet bunden till k2 läser och skriver `profiles/k2` | tillåts |
| R3 | Barnenhet bunden till k2 läser `profiles/k4` | **nekas** |
| R4 | Barnenhet bunden till k2 skriver `profiles/k4` | **nekas** |
| R5 | Barnenhet skapar eller ändrar sitt eget `members/{uid}` (roll, barn) | **nekas** |
| R6 | Anonym enhet försöker bli ägare | nekas |
| R7 | Ägare godkänner en `pairRequest` till k4 | tillåts; enheten läser k4 |
| R8 | Ägare tar bort en enhet; enheten läser igen | nekas; appen tömmer den lokala kopian och säger varför |
| R9 | Delad enhet med `kids: [k2, k4]` | k2 och k4 tillåts, k8 nekas, ingen föräldrarätt |
| R10 | Barnenhet läser privat innehåll för ett annat barn | nekas |
| R11 | En annan familjs ägare läser den här familjen | nekas |
| R12 | Gamla vägen `legacyGrace` efter 2026-11-09 | nekas (oförändrat) |
| M1 | Migrering: alla befintliga enheter godkänns, ingen profil ändras byte för byte | identiska profiler före och efter |
| M2 | En enhet med osynkade pass offline godkänns efter regelbytet | passen kommer fram, inga dubbla belöningar |
| M3 | En enhet som inte godkänts startar | barnet kan öva lokalt; inget skrivs till molnet; tydlig text |
| M4 | Rollback av app-releasen med nya regler kvar | gamla appen nekas för andra barn men fungerar för sitt eget (eller: regler återställs först – ordningen dokumenteras) |
| T1 | Testa som barnet på föräldraenheten | läser i minnet, skriver aldrig (oförändrat) |
| T2 | Push-prenumerationer per barn | barnenheten ser bara sina egna |

## 6. Utanför fas 1
Inkorg, onboarding av en annan familj, nya föräldrafunktioner och att barnet ser sin egen historik på flera enheter (utöver
synken i dag).

## 7. Ägarbeslut som krävs före start
- Inloggningsmetod för föräldrarna.
- Om privat innehåll ska delas per barn i lagringen (rekommenderas) eller filtreras.
- Ordningen mellan regelbytet och app-releasen, och hur länge den gamla appversionen ska stödjas.
- Vilka enheter som är delade.
