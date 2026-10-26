# Concept Packs – internt innehållsformat (pluggPackVersion 1)

> **Det här är ett internt kontrakt mellan Claude och appen.** Föräldern ser aldrig JSON, laddar aldrig upp filer och redigerar
> aldrig innehåll i appen. Claude läser skolmaterialet, skriver paketen, kör kvalitetsgrinden och släpper dem
> (se `docs/CONTENT_WORKFLOW.md`). Appen gör om paketen till frågor, planerar och följer upp.

Ett Concept Pack beskriver **kunskap, inte frågor**. Motorn följer *kunskapspunkter*; generatorn (`src/05d_packs.js`) gör om
varje fakta till flera frågeformer som rättas deterministiskt. "Upprepa kunskapen, inte frågan."

- **Inbyggda paket** (allmän kursplanekunskap, Lgr22): `content/packs/*.json` → byggs in i appen som `PACK_DATA`.
- **Familjens paket och skoluppgifter** (från lärarmaterial): familjens privata lagring, dokumentet `_content`. Aldrig i repot.

## 1. Paketet

| Fält | Krav | Betydelse |
|---|---|---|
| `pluggPackVersion` | `1` | Formatversion. En ny version kräver ändring i appen. |
| `id` | `a-z0-9-`, 2–48 tecken, unikt | Paketets identitet. Ändras aldrig. |
| `title`, `topic` | text | Visas för föräldern (titel) och barnet (ämnesrad i metodsidan). |
| `subject` | `math` `sv` `en` `no` `so` | Ämnesgrupp (styr ikon/flik). Ett moment kan överstyra med `group`. |
| `grades` | `[från, till]` | Årskurser innehållet är skrivet för. |
| `policies` | `younger` / `middle` / `older` | Åldersanpassning: vilka former och textlängder som gäller (§5). |
| `templates` | t.ex. `["ak8"]` | Inbyggda paket: vilka kursmallar som får paketet. Privata paket: `templates` eller `kids`. |
| `kids` | barn-id:n | Endast privata paket. |
| `rev` | heltal ≥ 1 | Höjs vid varje ändring av innehållet (rättning, ny fakta). |
| `sources` | lista | `{ id, label, kind }`, kind ∈ `lgr22 book pdf pptx docx paper questions web own image`. **Inga personnamn** i label. |
| `skills` | lista | Moment (§2). |
| `kps` | lista | Kunskapspunkter (§3). |
| `legacy` | `[kp, typ, text, svar]` | Gamla frågebankens frågor → kunskapspunkt (migrering, §7). |
| `teacherQs` | lista | Lärarens frågor i paketet (samma form som i skoluppgifter, §8). |
| `retired` | `{ kpId: "orsak" }` | Pensionerade kunskapspunkter (id får aldrig bara försvinna, §7). |

## 2. Moment (`skills`)
`{ id, existing: true }` kopplar paketet till ett befintligt moment i kursmallen (momentet blir en vilande samlingsnod och dess
gamla frågor leds till kunskapspunkterna). Ett **nytt** moment: `{ id, name, short, icon, group?, read?, readAloud? }` – visas
bara i v2 (v1 är frusen reserv). `read` är metodsidan (enkel HTML). `readAloud: false` för moment där läsningen själv övas.

## 3. Kunskapspunkter (`kps`)
Kunskapspunkten är **det motorn följer** (stadium, Felbok, repetition). En lärarfråga är inte en kunskapspunkt: en fråga kan
pröva flera punkter, och en punkt prövas av många frågor. Riktmärke ≈ 25 punkter per faktamoment – en vägledning, inte en kvot.

| Fält | Betydelse |
|---|---|
| `id`, `skill`, `name` | Identitet (stabil för alltid), moment, namn som föräldern ser. |
| `explain` | Kort förklaring – UPPTÄCK-kortet, LÄR, Rescue och "varför" efter svar. Måste stå på egen hand. |
| `type` | Kunskapstyp (§6). Saknas den härleds den ur faktaslagen. |
| `facts` | Minst en fakta (§4). |
| `mistakes` | `[{ wrong, right }]` – vanliga missuppfattningar (visas i Rescue). |
| `requires` | Punkter som bör sitta först (förkunskap). |
| `related` | `[{ kp, how }]` – samband ("motsats", "mäts med" …) för KOPPLA-aktiviteter. |
| `src` | Källhänvisningar `[{ ref, page?, pages?, slide?, slides?, q?, section?, note? }]` – `ref` måste finnas i `sources`. |

## 4. Fakta och de former de blir

Varje fakta har `k` (slag) och valfritt `lvl` 1–3 (djup), `form` (överstyr formen), `ages` (endast dessa policyer),
`not_forms`, `why` (förklaring efter svar), `src`, `ch: true` (utmaning), `speak: false` (läses aldrig upp).

| `k` | Obligatoriskt | Blir |
|---|---|---|
| `term` | `term`, `q` (+ `not`, `alias`, `def`, `notDef`, `rq`, `cls`) | igenkänning (flerval), eget svar (om termen är kort), omvänd (vad betyder …) |
| `qa` | `q`, `a`, `not` (≥ 2) (+ `alias`, `recall`, `cs`, `exact`) | flerval i angiven form; eget svar om `recall: true` och svaret är kort |
| `pairs` | `items` (≥ 3 par), `q` med `{a}`/`{b}` (+ `rq`, `pq`, `recallB`, `mq`, `match: false`, `par: false` – inget "vilket par hör ihop" eller PARA IHOP när paren kan lösas med bokstavsjämförelse) | a→b, b→a, "vilket par hör ihop" (KOPPLA), omvandla själv; **PARA IHOP** (v3) när alla vänster- och högerled är unika |
| `group` | `groups` (≥ 2, `q` + `items` ≥ 2, ev. `odd`, `label`) (+ `sq`, `sort: false`) | vilken hör till gruppen, "vilken hör inte hit"; **SORTERA** (v3) när alla grupper har `label` (≤ 28 tecken, unika, inget led i två grupper) |
| `order` | `q`, `items` (≥ 3) (+ `gapq`, `gap: false`) | ordningsuppgift; saknad länk (≥ 5 led, grannarna visas aldrig som alternativ) |
| `stmt` | `s` (sant), `f` (falska, ≥ 1) | vilket stämmer; HITTA FELET (vilket är fel); **STÄMMER DET?** (v3, sortera två sanna och två falska ur punktens påståenden, kräver ≥ 2 `stmt`; stäng av med `kp.tf: false`) |
| `num` | `q`, `a` (tal) (+ `unit`) | beräkning i flera steg |
| `pick` | `text`, `ask`, `a` (ett ord i meningen) | peka ut ordet (ordklass, satsdel …) |
| `fix` | `bad`, `good`, `err`, `fix` | vilket ord är fel; skriv ordet rätt; vilken mening är rätt |
| `read` | `text`, `qs` (`q`, `a`, `not` ≥ 2) | läsförståelse med texten synlig (läses aldrig upp) |

**Experience v3 – aktiviteter (samma kunskap, samma rättning):** SORTERA och STÄMMER DET? blir `type: 'sort'`, PARA IHOP
blir `type: 'match'` – båda rättas deterministiskt (allt på rätt plats / alla par utan fel), loggas som strukturerat svar (som
ordning) och har fasta omgångar så att uppgiftens id inte ändras med slumpen. `pick`/`fix` visas som TRYCK PÅ ORDET i meningen.
Korta egna svar kan för Yngre byggas av bokstavsbrickor (BYGG ORDET). Para ihop används aldrig i Testa mig (återkoppling par för par).

**Former:** recognition (r) · recall (c) · reverse (v) · relationship (l) · mistake (m) · cause (x) · application (a) ·
explanation (e) · multistep (s). Challenge är inte en form utan en markering (`ch` eller nivå 3 + djupform) och hålls
separat i motorn. Formkoden sparas i varje bevis (index 19).

**Djup:** `lvl` sätter golvet; formen höjer (`recognition` 1, `recall`/`reverse`/`relationship`/`mistake`/`cause` 2,
`application`/`explanation`/`multistep` 3).

**Felalternativ:** författade (`not`) först, sedan paketets pool i nivåer (samma punkt → samma moment → hela paketet; Yngre
bara samma moment). Alias räknas aldrig som fel. `cs: true` när skiftläget är själva frågan (stor bokstav).

## 5. Åldersanpassning (policy)

| Policy | Former | Frågetext / alternativ / längsta ord |
|---|---|---|
| younger (åk 1–3) | recognition, recall, relationship, mistake | 22 ord / 48 tecken / 16 bokstäver |
| middle (åk 4–6) | alla utom explanation | 34 / 80 / 22 |
| older (åk 7–9) | alla | 48 / 120 / 26 |

## 6. Kunskapstyp och Learning Recipes
`type` ∈ `fact term classification sequence cause language concept procedure`. Receptet = kunskapstyp × stadium × policy:
NY → UPPTÄCK-kort + igenkänning · LÄR SIG (stadium 0–1) → stöttad övning · ÖVAR (2) → eget svar och görande ·
SÄKER (≥ 3) → koppla, tillämpa, hitta felet, utmaning · SENARE → motorns fördröjda hämtning med eget svar.
Typens signaturaktiviteter väger ×1,5. Variation har alltid ett skäl – aldrig slumpad rotation.

## 7. Stabilitet och migrering
- Koncept-id: `k:<paket>/<punkt>`. **Ett släppt id tas aldrig bort** – `content/ids.lock.json` (CI kontrollerar). Byt namn = ny
  punkt + `retired` för den gamla; bevisen på det gamla id:t ligger kvar läsbara (vilande) och förs **inte** över (ingen
  uppblåst kunskap).
- `legacy`: gamla frågans id (`'i' + fnv(typ|text|svar)`) → kunskapspunkt. Omdirigeringen sker vid omspelning – loggen ändras
  aldrig, så 2.0.0 kan läsa samma data (rollback). En okänd gammal fråga stannar på momentet.
- `rev` höjs vid ändring. Frågans id följer texten: en rättad fråga är en ny uppgift (Felboken släpper den gamla).
- En olöst Felboks-post på ett vilande moment (från 2.0) håller kvar bevisen på momentet tills posten är löst – annars kunde Revansch
  aldrig verifiera den. Därefter leds bevisen till kunskapspunkterna igen.
- Kompaktering: bevis på vilande moment bakas inte in i basen (basen räknas med 2.1-katalogen). Loggen får då växa till 900 bevis
  (`LOG_HARD_PIN`) innan allt bakas in som förut. Gräns: efter ungefär tre månaders daglig användning ser en återställd 2.0 de äldsta
  bevisen från 2.0-tiden som kunskapspunkter (okända för 2.0) i stället för på momentet. Omvänt: kompakterar 2.0 efter en rollback ligger de
  bevisen kvar på momentet, och kunskapspunkterna börjar om – ingen uppblåst kunskap, men UPPTÄCK kan visas för sådant barnet kan.
- Ett privat paket får aldrig ha ett inbyggt pakets id (avvisas av appen och av `content.mjs bundle`).
- Med motor v2 kommer även manuell övning ("Öva") på ett moment med paket från paketets granskade frågor. v1-reserven använder den gamla
  frågebanken oförändrad.

## 8. Skoluppgifter och lärarens frågor (bara privat, `_content.work`)
```json
{ "id": "kemi-nov", "kid": "<barn-id>", "type": "exam|homework|vocab|practice", "title": "Kemiprov", "subject": "kemi",
  "date": "ÅÅÅÅ-MM-DD", "priority": "high|normal", "packs": ["…"], "kps": ["k:paket/punkt"], "skills": [], "decks": [],
  "src": { "ref": "Instuderingsfrågor kap. 3", "page": 2 },
  "teacherQs": [ { "n": "3b", "q": "Lärarens fråga, ordagrant", "a": "facit", "alias": [], "not": ["fel", "fel"],
                   "typed": false, "kps": ["k:paket/punkt"], "src": { "ref": "…", "q": "3b" } } ] }
```
- `exam`/`homework`/`vocab` med datum → prov i appen (uppdragsrubrik, Testa mig, Smart Kör! prioriterar). `practice` → fokus.
- Lärarfrågor bevaras källtroget och kopplas till kunskapspunkter. I Testa mig används bara de som kan rättas säkert:
  flerval (`a` + minst två `not`) eller kort eget svar (`typed`, högst tre ord). Övriga påverkar bara vilka punkter som prövas.
- Inga personnamn – varken barnets, lärarens eller andras – i titlar, frågor eller källor.
- **Experience v3 (tillägg, ignoreras av äldre versioner):**
  `"goals": [{ "id", "name", "skills": [], "kps": [], "teacher": true }]` – lärarens målområden; Testa mig rapporterar
  Bra koll / Öva lite mer / För lite underlag per område (aldrig en prognos).
  `"focus": { "skills": [], "kps": [] }` – lärarens betoning → motorns befintliga fokusvikt (introduceras först).
  `"missing": [{ "label", "kind": "pdf|book|format|video|lab|questions|other", "note" }]` – luckor i underlaget; visas för
  föräldern, aldrig för barnet, och appen hittar aldrig på innehåll i stället.
  Kvalitetsgrinden kräver att målområden och betoning ligger inom skoluppgiftens egna `skills`/`kps` (ingen påhittad omfattning).

## 9. Kvalitetsgrind (CI: `tests/test_packs.js`, lokalt `node scripts/content.mjs check [mapp]`)
Varje variant × 10 frö: unika alternativ, inget tvetydigt rätt svar, rättningen godkänner facit och underkänner varje
felalternativ, textgränser, giltig HTML, förklaring och ledtråd finns; variation per punkt; djup- och eget-svar-krav;
generatortäckning; id-låset; legacy-täckning; recepten (NY ≥ 70 % igenkänning, SÄKER ≥ 60 % djup); kunskapstyp. Grinden
ersätter **inte** faktagranskningen: varje paket granskas oberoende (sakfel, språk, ålder, tvetydighet, felalternativ,
formmatchning, källor, utmaningens giltighet) innan det släpps. Ett felaktigt faktum i ett system med varaktig inlärning
är ett allvarligt fel. Försvaga aldrig ett test för att få grönt.
