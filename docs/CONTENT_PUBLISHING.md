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
