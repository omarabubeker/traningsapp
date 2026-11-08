# Implementationsplan – personlig träningsapp med AI-coach

Status: **godkänd 2026-11-08.**

Beslut:
- Datakälla: **A1 via intervals.icu**, med A2 (FIT/GPX-uppladdning) som reserv. Ingen Strava-koppling.
- Klocka: **Apple Watch Series 11**. Den kan inte synka direkt till intervals.icu, så vägen blir Apple Watch → Apple Hälsa → iOS-appen *Intervals.icu Companion* (gratis att ladda ner, har köp i appen) → intervals.icu → vår app. Reserv: *HealthFit* (engångsköp). Att synken är gratis verifieras innan etapp 2.
- Inloggning med e-postkod (OTP).
- Coach-instruktioner: Claude skriver ett utkast i etapp 3 om inga egna finns.
Datum: 2026-11-08

---

## 0. Två saker som måste avgöras först

### A. Stravas villkor krockar med briefen (se fråga 4)
Enligt flera källor (jag kunde inte läsa strava.com direkt, se fråga 4) gäller sedan 2024–2026:
1. **Data från Stravas API får inte användas i AI-modeller eller "liknande tillämpningar"**, och från 2026 omfattar det enligt en analys även AI-svar som bygger på Strava-data.
2. **Sedan 1 juni 2026 krävs en betald Strava-prenumeration** (cirka 11,99 USD/mån eller 79,99 USD/år) för att få API-åtkomst på Standard-nivå, även för en enanvändarapp.

Det betyder att "Strava → Claude-coach" sannolikt **bryter mot villkoren**, och att Strava-vägen inte är gratis om du inte redan har Strava-prenumeration.

**Alternativ:**

| Alternativ | Gratis? | AI-tillåtet? | Automatiskt? | Kommentar |
|---|---|---|---|---|
| **A1. intervals.icu** som källa, med klockan synkad *direkt* dit (Garmin, Coros, Suunto, Polar, Wahoo) | Ja | Ja, egen API-nyckel och egna data | Ja. Klockan → intervals.icu → vår app (webhook om intervals.icu erbjuder det för personliga nycklar, annars hämtning när appen öppnas + daglig cron; verifieras i etapp 2) | **Min rekommendation.** OBS: pass som kommit in *via Strava* till intervals.icu får inte hämtas ut via API, så klockan måste synka direkt. |
| A2. Ladda upp FIT/GPX-fil manuellt i appen | Ja | Ja | Nej, en knapptryckning per pass | Enkel reserv som fungerar oavsett klocka. |
| A3. Strava som i briefen | Bara med Strava-prenumeration | Nej / oklart | Ja | Kräver att coachen *inte* får Strava-data, och då försvinner poängen. |
| A4. Garmin Connect Developer Program direkt | Ja | Ja | Ja | Kräver ansökan som företag och godkänns sällan för privatpersoner. |

→ **Vilken klocka har du, och har du redan Strava-prenumeration?** Etapp 2 beskrivs nedan för A1 + A2, och samma upplägg (webhook, ändringar och raderingar, historikimport, rate limits) gäller även A3 om du väljer den.

### B. Coach-instruktionerna saknas
Avsnittet "Mina coach-instruktioner" i briefen innehåller fortfarande platshållaren. Klistra in dem, så lägger jag dem i `coach/instruktioner.md` i etapp 3.

---

## 1. Stack och gratistjänster (fråga 1)

| Del | Val | Gratisnivåns begränsningar som berör oss |
|---|---|---|
| Ramverk | **Next.js (App Router) + TypeScript + Tailwind** | – |
| Hosting | **Vercel Hobby** | Bara icke-kommersiellt bruk (ok här). Serverless-funktioner har tidsgräns (sekunder upp till någon minut), så coachsvar streamas. **Cron högst en gång per dygn.** En förhandsgranskningslänk per PR ingår. |
| Databas och inloggning | **Supabase Free** (region eu-north-1 Stockholm) | 500 MB databas och 1 GB fillagring, gott och väl. **Projektet pausas efter 7 dagar utan trafik**: en daglig Vercel-cron pingar det. **Inga automatiska backuper** på gratisnivån, så jag lägger in JSON-export i Inställningar. Max 2 gratisprojekt. |
| PWA | Eget `manifest.webmanifest`, ikoner, enkel service worker | iOS: ingen bakgrundssynk. Push fungerar bara för PWA på hemskärmen och behövs inte nu. |
| Karta | **Leaflet + OpenStreetMap-rutor** | OSM:s policy för rutor tillåter låg, personlig användning med attribution. |
| Grafer | **Recharts** | – |
| AI | **Claude API** (`@anthropic-ai/sdk`) | Enda kostnaden. Förbetalda krediter med månadsgräns i Console. |
| Träningsdata | **intervals.icu API** (+ FIT/GPX-uppladdning), alternativt Strava | Se avsnitt 0. |

Avvikelser från förslaget i briefen:
- **Inloggning med 6-siffrig e-postkod (OTP) i stället för magisk länk.** På iPhone öppnas en magisk länk i Safari, inte i hemskärmsappen, och de har *separata* inloggningar. En kod som du skriver in direkt i appen löser det. Det är samma Supabase-funktion, bara en annan mall.
- Datakällan, se avsnitt 0.

## 2. Datamodell (fråga 2)

Alla tabeller har `user_id` och Row Level Security (`user_id = auth.uid()`). Hemligheter som tokens och API-nycklar läses bara på servern.

```
profile            user_id PK, height_cm, birth_date, resting_hr, max_hr,
                   goals text, injuries text, updated_at
weight_entries     id, user_id, measured_on date, weight_kg

exercises          id, user_id, name, muscle_group, is_bodyweight, archived
gym_sessions       id, user_id, started_at, ended_at, notes, plan_item_id?
gym_sets           id, session_id, exercise_id, set_no, reps, weight_kg,
                   rpe?, is_warmup, created_at
  → "förra gången": senaste gym_session med samma exercise_id, dess set

activities         id, user_id, source ('intervals'|'strava'|'file'),
                   external_id (unik per källa), sport_type, start_time,
                   name, distance_m, moving_time_s, elapsed_time_s,
                   avg_hr, max_hr, elevation_gain_m, avg_pace_s_per_km,
                   load (TRIMP/träningsbelastning), splits jsonb,
                   polyline text, deleted_at?, source_updated_at
activity_streams   activity_id PK, hr int[], pace/velocity real[],
                   altitude real[], distance real[]    (för grafer, inte för coachen)
source_connections user_id, provider, athlete_id, credentials (krypterade
                   AES-GCM med nyckel i env), expires_at, scope
sync_jobs          id, provider, external_id, action (create|update|delete|
                   backfill), status, attempts, run_after, error

plans              id, user_id, week_start date, status (active|archived),
                   summary text, rationale text, model, created_at
plan_items         id, plan_id, date, kind (run|gym|rest|other), title,
                   description, target jsonb  (t.ex. {km, pace, zon} eller
                   [{övning, set, reps, vikt}]),
                   status (planned|done|partial|missed|moved),
                   activity_id?, gym_session_id?

coach_threads      id, user_id, title, created_at
coach_messages     id, thread_id, role, content, model,
                   input_tokens, cache_read_tokens, cache_write_tokens,
                   output_tokens, cost_usd, created_at
coach_memory       id, user_id, kind (advice|plan_decision|feedback|
                   injury_note|preference), content, importance 1–3,
                   valid_until?, source_message_id?, archived, created_at
weekly_reviews     id, user_id, week_start, summary, plan_id, cost_usd
```

Veckobelastning (`weekly_load`) är en **SQL-vy** som räknas fram ur activities och gym_sets: km, tid, antal pass, tid i pulszoner eller TRIMP, gymvolym (set × reps × kg) per muskelgrupp. Den lagras alltså inte dubbelt.

## 3. Sammanfattning till coachen och kostnad (fråga 3)

**Principen: servern räknar, Claude resonerar.** Ingen rådata skickas. Sammanfattningen byggs med vanlig kod (inget AI-anrop) och skickas som kompakt text:

1. **Profil** (~200 tokens): ålder, vikt och trend, vilo- och maxpuls, pulszoner, mål, skador.
2. **Senaste 6 veckorna, en rad per vecka** (~300 tokens): km, löptid, antal pass, andel lätt/hårt, snittpuls, gymvolym, belastning jämfört med 4-veckorssnittet (akut/kronisk kvot).
3. **Senaste 14 dagarna, en rad per pass** (~600 tokens): "tis 4/11 löp 8,2 km 5:31/km puls 148 (Z2), +60 hm" och "tor 6/11 gym: knäböj 3×5 80 kg (+2,5), …".
4. **Plan mot utfört för innevarande och förra veckan** (~250 tokens): genomfört, missat, ändrat.
5. **Minne** (~400 tokens): aktiva råd och beslut, återkopplingar från de senaste 14 dagarna och skadenoteringar, valda efter vikt och aktualitet (max ~15 poster).
6. **Flaggor som koden räknar fram**: t.ex. "volym +35 % mot snitt", "2 missade pass", "snittpuls på lätta pass +6 slag på 2 veckor", "återkoppling: trött".

Totalt cirka 2 000 tokens träningskontext.

**Prompt caching:** ordningen är `system = [instruktioner.md (+ säkerhetsregler)] + [profil]` med cachepunkt, därefter träningssammanfattningen med en andra cachepunkt (ändras högst när ett nytt pass kommer in) och sist samtalet. På de nya modellerna cachas allt från 512 tokens.

**Modeller:**
- Vanlig chatt: **Claude Haiku 5.5** (0,10 / 0,50 USD per miljon tokens in/ut), max cirka 800 tokens per svar.
- Veckoavstämning: **Claude Sonnet 5.5** (2 / 10 USD per miljon tokens). Opus 5.5 (4 / 20 USD) går att välja i inställningarna.
- Minnesextraktion efter varje samtal: Haiku, med strukturerad JSON-utdata.

**Uppskattning** (instruktioner ~1 500 tokens, kontext ~2 000, samtalshistorik ~1 500):

| Anrop | In | Ut | Ca kostnad |
|---|---|---|---|
| Chattfråga (Haiku) | ~5 000 (varav ~3 000 cachade) | ~600 inkl. resonemang | **≈ 0,0008 USD (< 1 öre)** |
| Minnesextraktion (Haiku) | ~2 000 | ~200 | ≈ 0,0003 USD |
| Veckoavstämning (Sonnet) | ~10 000 | ~3 000 | **≈ 0,05 USD (~50 öre)** |
| Veckoavstämning (Opus) | ~10 000 | ~3 000 | ≈ 0,10 USD |

**Per månad** med 100 frågor och 4 avstämningar: cirka **0,3 USD (≈ 3 kr)**, och under 1 USD även med tung användning. Varje svar loggar `usage` från API:et, och Inställningar visar den verkliga summan per månad. En hård spärr (t.ex. 5 USD/mån) ställer du dessutom in i Claude Console.

## 4. Stravas API-villkor och Claude (fråga 4)

**Kort svar: nej, troligen inte.** Jag kunde inte läsa Stravas egna sidor från den här miljön (strava.com är blockerad i sessionens nätverk), så slutsatsen bygger på sekundära källor:
- API-avtalet från 11 nov 2024 förbjuder att data hämtad via API:et används i "artificial intelligence models or other similar applications". Samma avtal begränsar dessutom visning till användaren själv. Det senare är ok här.
- I uppdateringen juni 2026 stramades det åt ytterligare. Utvecklare som använder Strava-data i AI uppmanas att sluta och begära skriftligt besked från Strava, och enligt en analys omfattas även AI-utdata som bygger på Strava-data.
- Från 1 juni 2026 (för befintliga utvecklare 30 juni) krävs Strava-prenumeration för Standard-åtkomst. Nya appar får 1 atlet och kan utökas till 10 utan granskning.

**Oklart:** om "personligt bruk av egna data" undantas. Inget jag hittat säger det, och ordalydelsen verkar vara generell. Om du vill ha Strava: läs `strava.com/legal/api` och `strava.com/legal/api_policy` själv, eller fråga developers@strava.com skriftligt. Därför rekommenderar jag **A1 (intervals.icu, klockan synkad direkt) + A2 (filuppladdning)**. Då är det dina egna data från klockan, utan Stravas villkor emellan.

## 5. Vad du behöver göra själv (fråga 5)

**GitHub (nu):** GitHub-kopplingen i den här sessionen har ogiltig token, så jag kunde inte skapa repot. Koppla om på https://claude.ai/connect-github, och skapa sedan antingen ett tomt privat repo `traningsapp` själv eller låt mig göra det i en ny session.

**Supabase**
1. supabase.com → New project, region *North EU (Stockholm)*, spara databaslösenordet.
2. Project Settings → API: kopiera `URL`, `anon key` och `service_role key` (den sista är hemlig och läggs bara i Vercel).
3. Authentication → Providers → Email: aktivera, och ändra mallen "Magic Link" till att visa `{{ .Token }}` (koden).
4. Efter att du loggat in första gången: Authentication → Settings → stäng av "Allow new users to sign up". Appen har dessutom en `ALLOWED_EMAIL`-spärr.
5. Authentication → URL Configuration: Site URL = din Vercel-domän.
6. Migreringarna kör jag som SQL-filer (`supabase/migrations`). Du klistrar in dem i SQL Editor, eller ger mig databas-URL:en som Vercel-variabel.

**Vercel**
1. vercel.com → logga in med GitHub → Add New Project → välj repot.
2. Settings → Environment Variables: lägg in värdena från `.env.example` (Production + Preview).
3. Varje PR får automatiskt en testlänk. Det är den du testar på.

**Claude Console**
1. platform.claude.com → skapa konto → Billing: köp krediter (minsta belopp, t.ex. 5 USD).
2. Limits: sätt en månadsgräns, t.ex. 5 USD.
3. API Keys → skapa nyckel → lägg in som `ANTHROPIC_API_KEY` i Vercel.

**intervals.icu (om A1)**
1. Skapa gratiskonto, koppla klockan *direkt* (Settings → Connections → Garmin/Coros/…), inte via Strava.
2. Settings → Developer Settings → generera API-nyckel och notera ditt atlet-id (`i12345`).
3. Lägg in dem som Vercel-variabler. Webhooken konfigurerar vi i etapp 2.

**Strava (om A3)**
1. Kontrollera att du har prenumeration.
2. strava.com/settings/api → skapa app, Authorization Callback Domain = produktionsdomänen på Vercel. **Strava tillåter bara en domän**, så OAuth fungerar bara på produktion, inte på testlänkar.
3. Kopiera Client ID och Secret till Vercel. Webhook-prenumerationen skapar jag med ett skript.

**iPhone:** öppna produktionslänken i Safari → Dela → "Lägg till på hemskärmen".

## 6. Risker och oklarheter (fråga 6)

1. **Stravas villkor och kostnad**: avsnitt 0 och 4. Störst.
2. **Coach-instruktionerna saknas**: behövs till etapp 3.
3. **iOS och magisk länk**: löses med e-postkod (se 1).
4. **Gymmet saknar ofta täckning**: loggade set sparas först lokalt i en kö och synkas när nätet finns. Föreslås ingå i etapp 1.
5. **Supabase pausas eller saknar backup**: daglig ping och export-knapp.
6. **Hälsodata hos tredje part**: Supabase (EU) och Anthropic (USA) lagrar puls, vikt och skador. Det är ok för eget bruk, men bra att veta. Anthropic tränar inte på API-data som standard.
7. **Maxpuls**: ange uppmätt maxpuls om du kan. Formler (220 − ålder) kan slå fel med ±10 slag och påverkar alla zoner.
8. **Testlänkar och inloggning**: Supabase-redirect behöver tillåta `*.vercel.app` för dina preview-domäner (gäller bara om vi använder länk; med kod slipper vi det).
9. **Coachen är inte vården**: säkerhetsregler hårdkodas *utöver* din redigerbara instruktionsfil, så att de inte kan redigeras bort av misstag. Vid smärta, yrsel, bröstsmärta, svimning eller andningsbesvär hänvisar den till 1177/112 och föreslår ingen träning.
10. **Vercel Hobby-cron** går bara en gång per dygn. Det räcker (webhooks sköter realtid), men historikimporten görs i omgångar via en knapp med förloppsindikator.

## 7. Filstruktur

```
traningsapp/
├─ PLAN.md  README.md  .env.example
├─ coach/
│  └─ instruktioner.md          ← din redigerbara coachprompt
├─ supabase/migrations/*.sql
├─ public/  manifest.webmanifest, icons/, sw.js
└─ src/
   ├─ app/
   │  ├─ login/                 e-postkod
   │  ├─ (app)/
   │  │  ├─ page.tsx            översikt: veckans pass och plan
   │  │  ├─ gym/                pågående pass, historik, övningar
   │  │  ├─ lopning/[id]/       detaljer, splits, karta
   │  │  ├─ coach/              chatt, veckoavstämning
   │  │  ├─ plan/               veckoplan
   │  │  ├─ profil/             profil och vikthistorik
   │  │  └─ installningar/      kopplingar, förbrukning, export
   │  └─ api/
   │     ├─ sync/intervals/     webhook och import  (eller strava/)
   │     ├─ upload/             FIT/GPX
   │     ├─ coach/chat/         streamat svar
   │     ├─ coach/weekly/       veckoavstämning
   │     └─ cron/daily/         ping, synkjobb, städning
   ├─ components/               knappar, stegräknare för vikt/reps, kort
   └─ lib/
      ├─ supabase/  auth.ts
      ├─ sync/      klient, mappning, rate limit, kö
      ├─ coach/     summary.ts  memory.ts  prompt.ts  pricing.ts  safety.ts
      └─ training/  zoner, belastning, e1RM
```

## 8. Etapper (en branch och en PR per etapp, med stopp efter varje)

**Etapp 1 – Grund** (`etapp-1-grund`)
Next.js-projekt, Tailwind med mörkt tema, PWA (manifest, ikoner, standalone, safe-area för notch), Supabase-auth med e-postkod och allowlist, migreringar för profil, vikt, övningar och gym. Sidor: Profil (med vikthistorik och liten graf), Gym (starta pass → välj övning → stora +/–-knappar för vikt och reps → "Spara set". Förra gångens set visas överst, föregående sets värden förifylls, offline-kö), Översikt (veckans pass). Även `.env.example` och README med setup.

**Etapp 2 – Synk av löppass** (`etapp-2-synk`)
Koppling till vald källa, krypterad lagring av nycklar och tokens (med förnyelse vid OAuth), webhook som svarar direkt och hämtar detaljer i bakgrunden (distans, tid, tempo, puls, höjdmeter, splits, rutt), hantering av ändrade och raderade pass, engångsimport av historik i omgångar, rate limit-hantering (läser rate-limit-headers, backoff, jobbkö). FIT/GPX-uppladdning som reserv. Löppass syns i översikten.

**Etapp 3 – Coach** (`etapp-3-coach`)
`coach/instruktioner.md` + säkerhetsregler, sammanfattningsmotor, chatt med streaming (Haiku), minnesextraktion och minnesvy där du kan ta bort och redigera, snabbknappar för återkoppling ("Trött i dag", "Knät ok"…), veckoavstämning (Sonnet) som skriver en strukturerad plan till `plans` och `plan_items`, plan mot utfört och belastningsflaggor, planvy, förbrukning per månad i Inställningar.

**Etapp 4 – Karta och finputs** (`etapp-4-karta-grafer`)
Leaflet-karta per löppass, grafer (veckovolym, tempo och puls över tid, e1RM och toppset per övning), finputs på design, laddtillstånd, haptik och animationer, Lighthouse-genomgång för PWA och prestanda.

---

**Det jag behöver från dig för att börja:**
1. Godkännande av planen, eller ändringar.
2. Val av datakälla (A1/A2/A3), och vilken klocka du har.
3. Koppla om GitHub (eller skapa repot), så pushar jag planen och startar etapp 1.
4. Dina coach-instruktioner (behövs först i etapp 3).
