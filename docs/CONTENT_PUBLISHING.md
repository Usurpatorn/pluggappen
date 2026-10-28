# Nyckelfri publicering av familjens skolmaterial (väg B)

**Mål:** föräldern ger Claude skolmaterial → Claude skapar och kontrollerar innehållet i ett **privat** GitHub-repo som en PR →
föräldern granskar och **mergar** (det är godkännandet) → en workflow publicerar till appen. Ingen nyckelfil finns någonstans,
föräldern kör inga kommandon och hanterar aldrig JSON i det löpande arbetet.

```
skolmaterial ──► Claude: Concept Packs + work.json ──► PR i privata repot ──► CI: kvalitetsgrind (ingen molnåtkomst)
                                                                                     │
                                            föräldern granskar sammanfattningen och mergar  (= godkännande)
                                                                                     │
      publish.yml (miljön "production", spärr PUBLISH_ENABLED) ◄─────────────────────┘
        1. kvalitetsgrind igen            4. läs tillbaka och jämför kontrollsumman
        2. kortlivat Google-token (WIF)   5. backup + publicerad version sparas på grenen "backups" (+ artefakt i 90 dygn)
        3. backup → skriv med konfliktskydd (stoppas om något ändrats emellan)
      rollback.yml: välj en backup → samma skydd → återställd version
```

## Vad som skapas – resurser och behörigheter

| Var | Vad | Behörighet | Varför |
|---|---|---|---|
| GitHub | Privat repo `Usurpatorn/pluggappen-content` | – | Familjens innehåll och dess historik. Aldrig i app-repot. |
| GitHub (privata repot) | Miljö `production`, bara grenen `main` får använda den | – | Google litar bara på jobb i den miljön. |
| GitHub (privata repot) | Ägarspärr i publicera-/rollback-workflowen | `pull-requests: read` | Grenskydd verkställs inte i privata repon på gratisplanen. Workflowen kontrollerar därför själv att ändringen är en PR som ägaren har mergat (rollback/manuell körning: bara ägaren). |
| GitHub (privata repot) | Secrets `FAMILY_CODE`, `PRIVACY_TERMS` | – | Var innehållet ska skrivas; namnkontroll. |
| GitHub (privata repot) | Miljövariabler `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`; **repovariabel** `PUBLISH_ENABLED` | – | Inloggning utan nyckel; spärr tills grinden är stängd. Spärren måste ligga på repo-nivå – jobbets villkor ser inte miljövariabler. |
| GitHub | Claude-appens åtkomst till det privata repot | läsa/skriva innehåll, öppna PR | Claude arbetar via PR – aldrig direkt på `main`, aldrig någon nyckel. |
| Google Cloud | Workload Identity-pool `github` + provider `pluggappen-content` | litar på GitHubs OIDC-token, villkor: repot `Usurpatorn/pluggappen-content`, grenen `main` | Byter GitHubs token mot ett kortlivat Google-token (10 min). |
| Google Cloud | Tjänstekonto `content-publisher` | `roles/datastore.user` på projektet | Läsa/skriva Firestore. **Obs:** rollen gäller hela projektets Firestore, inte bara `_content` – Google har ingen dokumentnivå i IAM. Begränsningen ligger i att bara den här workflowen kan använda kontot. |
| Google Cloud | Bindning på tjänstekontot | `roles/iam.workloadIdentityUser` för exakt `repo:Usurpatorn@10485475/pluggappen-content@1434576026:environment:production` | Bara jobb i miljön production i det privata repot kan låna kontot. GitHub skickar `sub` med fasta id-nummer för konto och repo (skyddar mot att någon tar över namnet). |
| Google Cloud | API:erna IAM Credentials och Security Token Service | – | Behövs för tokenbytet. |
| – | **Ingen** nyckelfil skapas för `content-publisher` | – | Inget som kan läcka. |

## Engångsinställningar (förälder, ca 20 minuter)

### 1. Skapa det privata repot (GitHub)
1. github.com → **New repository** → namn `pluggappen-content` → **Private** → skapa (tomt, utan README).
2. github.com → Settings → Applications → **Claude** (GitHub-appen) → Configure → lägg till `pluggappen-content` under *Repository access*.
3. Säg till Claude. Claude lägger in mallen (workflows, mappar, README) som en första PR som du mergar.

### 2. Google Cloud (i webbläsaren – Cloud Shell, inget installeras på datorn)
console.cloud.google.com → välj projektet **pluggappen** → ikonen **>_** (Activate Cloud Shell) uppe till höger → klistra in:

```bash
PROJECT=pluggappen
REPO=Usurpatorn/pluggappen-content
NUM=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project $PROJECT
gcloud iam workload-identity-pools create github --project $PROJECT --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc pluggappen-content --project $PROJECT --location global \
  --workload-identity-pool github --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository == '$REPO' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts create content-publisher --project $PROJECT --display-name "Pluggappen: publicera skolmaterial (nyckelfri)"
gcloud projects add-iam-policy-binding $PROJECT --member "serviceAccount:content-publisher@$PROJECT.iam.gserviceaccount.com" --role roles/datastore.user --condition None
gcloud iam service-accounts add-iam-policy-binding content-publisher@$PROJECT.iam.gserviceaccount.com --project $PROJECT \
  --role roles/iam.workloadIdentityUser \
  --member "principal://iam.googleapis.com/projects/$NUM/locations/global/workloadIdentityPools/github/subject/repo:Usurpatorn@10485475/pluggappen-content@1434576026:environment:production"
echo "WIF_PROVIDER = projects/$NUM/locations/global/workloadIdentityPools/github/providers/pluggappen-content"
echo "WIF_SERVICE_ACCOUNT = content-publisher@$PROJECT.iam.gserviceaccount.com"
```
Spara de två sista raderna (de är inte hemliga). Skapa **ingen** nyckel för `content-publisher`.

> **Identiteten (`sub`).** GitHub skickar `repo:<ägare>@<ägar-id>/<repo>@<repo-id>:environment:production`, inte bara namnen. Ger
> inloggningen `iam.serviceAccounts.getAccessToken denied` trots att bindningen finns: läs av `sub` i workflowen och bind exakt det värdet.

### 3. Inställningar i det privata repot (GitHub → pluggappen-content → Settings)
1. **Environments** → New environment `production` → *Deployment branches and tags*: **Selected branches** → `main`.
   (*Required reviewers* finns inte för privata repon på gratisplanen – din merge är godkännandet, och ägarspärren ser till det.)
2. **Secrets and variables → Actions → Secrets:** `FAMILY_CODE` (samma värde som i app-repot), `PRIVACY_TERMS` (samma som i app-repot).
3. **Miljövariabler** (i `production`): `WIF_PROVIDER` och `WIF_SERVICE_ACCOUNT` (från steg 2).
4. **Repovariabel** (Settings → Secrets and variables → Actions → *Variables* → *Repository variables*): `PUBLISH_ENABLED` = `false`.
   Den måste ligga på repo-nivå: jobbets villkor (`if`) läses innan jobbet går in i miljön och ser inte miljövariabler.
5. Grenskydd för `main` verkställs inte i privata repon på gratisplanen. I stället har publicera- och rollback-workflowen en
   **ägarspärr**: bara en PR som repots ägare har mergat publiceras, och bara ägaren kan starta rollback eller en manuell körning.

### 4. Slå på publiceringen – först när grinden är stängd
Förutsättningar (från säkerhetsarbetet): produktionsreglerna publicerade och verifierade i Rules Playground, den exponerade
adminnyckeln borttagen, PR med reglerna mergad. Då: sätt `PUBLISH_ENABLED` = `true`. Den första riktiga publiceringen
föregås av en provpublicering med ett tomt innehåll (`{ v: 1, packs: [], work: [] }`) – repot börjar tomt, så det räcker att
köra *Publicera till appen* manuellt. Den visar att inloggning, backup, konfliktskydd och återläsning fungerar mot produktion
utan att något skolmaterial lämnar repot.

## Det löpande arbetet
1. Du ger Claude materialet (foto, PDF, PowerPoint, länk) och säger vilket barn och vilket prov det gäller.
2. Claude skriver innehållet, kör kvalitetsgrinden och den oberoende faktagranskningen och öppnar en PR med en kort sammanfattning:
   vad som finns i appen, vad som är osäkert, vad som saknas.
3. Du läser sammanfattningen och **mergar**. Publiceringen sker automatiskt (eller efter ditt "Approve" om du valde det).
4. Något blev fel? Actions → **Återställ (rollback)** → välj backupfilen från sammanfattningen → Run.

## Skydd
- Ingen nyckelfil; Google-tokenet lever i 10 minuter och kan bara fås av en workflow i miljön `production` på `main`.
- Konfliktskydd: skrivningen avbryts om `_content` har ändrats sedan backupen (inget skrivs över i blindo).
- Återläsning: efter skrivningen läses dokumentet tillbaka och jämförs byte för byte (sha256).
- Backup före varje skrivning och rollback (grenen `backups` + artefakt i 90 dygn).
- Appklienter kan aldrig skriva `_content` (firestore.rules, verifierat i emulatorn och i Rules Playground).
- Utskrifterna i loggarna innehåller aldrig innehållet, familjekoden eller token.
- Prövat i CI mot Googles Firestore-emulator: `tests/rules/publish.test.mjs`.

## Privata bilder (3.5)
Bilder ur familjens material, till exempel karttecken, publiceras med samma flöde. De hamnar **aldrig** i app-repot, bygget eller
publika CI-artefakter.

**Lagring.** Varje bild ligger som ett eget dokument i familjens Firestore: `families/{familj}/assets/{sha256}`, med fälten
`{ b64, mime, bytes, w, h }`.
- `_content.assets` är manifestet: `[{ id: "paket/namn", rev, mime, w, h, bytes }]`.
- Revisionen är bildens sha256. Ett dokument skrivs därför aldrig om: en ändrad bild får en ny revision.
- **Inga nya molnresurser, ingen ny behörighet:** tjänstekontot `content-publisher` har redan `roles/datastore.user` och skriver
  dokumenten som `_content`.
- **Ingen ny kostnad i praktiken.** Firestores gratisnivå är 1 GiB lagrat, 50 000 läsningar och 20 000 skrivningar per dygn
  (verifierat mot Googles dokumentation, se nedan). Ett 30-tal bilder på några kB läses en gång per enhet och cachas sedan.

**Åtkomst** styrs av `firestore.rules`, `match /assets/{rev}`:
- bara familjens medlemmar läser;
- ingen appklient skriver eller raderar;
- övergångsvägen gäller inte.

Det finns inga offentliga länkar. Emulatortestet `tests/rules/rules.test.mjs` visar att oinloggade, icke-medlemmar och en annan
familj nekas, och att barnets och förälderns enheter får läsa.

**Ordning vid publicering** (`scripts/content.mjs`):
1. `bundle` – bilderna kontrolleras (PNG/JPEG ur filens byte, högst 200 000 byte och 1024 × 1024, sha256 mot manifestet, ursprung
   och rätt att använda). Bilduppgifterna kontrolleras med appens egen regel. Ut kommer `_content.json` (bara manifestet) och
   `_content.assets.json` (bilderna).
2. `fetch` – backup.
3. `assets` – laddar upp nya revisioner, bara som nya dokument. En revision som redan finns kontrolleras och hoppas över, så steget
   kan köras om.
4. `verify-assets` – varje bild som innehållet hänvisar till läses tillbaka och kontrolleras.
5. `publish --expect` – vägrar (kod 4) om någon refererad bild saknas eller är skadad. Därför pekar aktivt innehåll aldrig på en
   saknad bild.
6. `verify` – återläsning.

`restore` (rollback) gör samma kontroll.

**Lagringstid och rensning.** Verktygen raderar aldrig bilder, eftersom en rollback kan behöva äldre revisioner. Gamla revisioner
som ingen backup längre hänvisar till kan föräldern ta bort för hand i Firebase-konsolen. Det är frivilligt, och utrymmet är
försumbart.

**I appen** (`src/05j_assets.js`):
- varje bild kontrolleras igen (typ, storlek, upplösning och sha256) innan den visas;
- en uppgift visas bara när alla dess bilder är hela, och den blir aldrig en textuppgift utan bild;
- alt-texten skrivs av appen och är neutral, så den avslöjar aldrig svaret;
- bilderna cachas i enhetens lokala lagring, knutet till familjen.

Cachen töms vid familjebyte och när enheten kopplas bort. **En kopia som redan finns på en enhet kan inte raderas på distans**
(till exempel på en avstängd eller borttappad enhet).

Delad enhet: alla profiler på enheten tillhör samma familj och ser samma bilder, precis som resten av familjens innehåll. Separation
per barn kommer först med Family Platform.

**När Firebase Storage behövs.** Firestore `assets/{sha256}` är den pragmatiska lösningen för **en familj** med några tiotal små
bilder: inga nya resurser, samma behörighet och samma tjänstekonto som resten av innehållet. Det är inte automatiskt
slutarkitekturen för School Packs. Firebase Storage (med egna `storage.rules`) bör ersätta eller komplettera den när något av detta
gäller:
- **fler familjer**, eller innehåll som delas mellan familjer eller en hel klass – då ska en bild lagras en gång och läsrätten
  styras per paket, inte kopieras in i varje familj;
- **större bilder** (fotografier, skannade sidor) som närmar sig dokumentgränsen på 1 MiB, eller annat än PNG/JPEG (ljud, PDF);
- **många bilder per familj**, där base64 i dokument kostar läsningar och lokalt lagringsutrymme i onödan;
- behov av **CDN-cache, nedladdning med token eller automatisk livscykel** för gamla revisioner.

Ett byte kräver ett eget beslut: Storage-bucket, fakturering (Blaze), regler, IAM för publiceringen och en flytt av manifestet så att
`rev` fortfarande är sha256 (appens kontroll är oförändrad). Inget av detta är skapat.

**Ägarsteg innan bilder kan användas:**
1. ~~Publicera de nya `firestore.rules`~~ – **klart**: publicerade av ägaren efter granskning och Rules Playground (en medlem får
   läsa `families/<familj>/assets/<64 hex>`, oinloggad, icke-medlem och annan familj nekas, ingen skrivning).
2. Merga app-PR:en och release.
3. Lägg in stegen `assets` och `verify-assets` i publiceringsworkflowen i det privata repot. Det är förberett i innehålls-PR:en.

Källa för kvoterna: [Firestore – quotas and limits](https://docs.cloud.google.com/firestore/quotas).
