# Träning – från webbapp till native app

Överlämning från en tidigare session. Läs hela innan du börjar. Prata svenska med ägaren.

## Mål

Ägaren vill lansera appen i **App Store och Google Play** som en liten inkomst som bär sina
egna kostnader (inte en stor affär). **iOS först, sedan Android.**

- **Pris:** ca 49 kr/mån, årspris ca 399 kr, 14 dagars provperiod. Vänner gratis (styrs från adminsidan).
- **Coachens tak:** 2 USD per användare och månad (i dag `COACH_MONTHLY_CAP_USD`, standard 3). Lägre tak under provperioden kan läggas till senare.
- **Fasta kostnader** ca 7 000 kr/år (Apple Developer, Supabase Pro, ev. Vercel Pro, domän). Ca 20–30 betalande täcker dem.

## Beslut som är tagna

- **React Native med Expo**: en kodbas för iOS och Android, riktigt native gränssnitt.
  Ingen webbadress i appen och ingen Capacitor.
- **Logiken återanvänds** där det går (TypeScript i `src/lib/`: prognos, form, klädtips,
  matchning mot planen, challenger, mål, Supabase-anrop). Gränssnittet byggs om native,
  med samma design (lime-palett, ljust/mörkt läge, Phosphor-ikoner, segmenterade ringar).
- **Webbappen utvecklas inte vidare.** Den får finnas kvar för ägaren och vännerna tills
  native-appen är klar, sedan stängs den.
- **Ramadan-läget byggs bara i native-appen**, inte i webbappen.
- **Inloggning:** e-postkod + Sign in with Apple + Sign in with Google (Apple kräver
  Apple-inloggning när Google erbjuds). De personliga länkarna räcker inte för främlingar.
- **Språk:** svenska och engelska, valbart. All text i språkfiler från början; coachen
  svarar på valt språk.
- **Gränssnitt efter val:** löpning, gym eller båda (`profile.training_focus`). Bara gym →
  dölj löpflik, löpring, prognos, klädtips. Bara löpning → omvänt. Ändras under Profil.
- **Coachen bara träning och kost.** Vänligt nej utanför ämnet, inga diagnoser, hänvisa
  till vården, försiktig kring kost (inga extrema dieter, uppmärksam på tecken på
  ätstörning). Tydlig ansvarsfriskrivning: ersätter inte vård.
- **Ramadan-läge:** slås på av användaren själv (aldrig automatiskt). Datum via islamiska
  kalendern (`Intl`), gryning/solnedgång från vald plats (lokalt bibliotek, ingen extern
  tjänst; återanvänd väderplatsen). Coachen lägger pass före/efter iftar, sänker intensitet
  och volym, inga långpass eller intervaller mitt på fastedagen; råd om vätska, kost, sömn.
  Försiktiga standardval; sjuka, gravida och personer med diabetes ska rådas att prata med
  vården. Ramadan 2027 börjar ungefär i början av februari – helst klart till dess, men
  kvalitet före datum.
- **Sentry väntar** tills efter testerna (inget Apple-krav).
- **Begäran om betyg** i appen efter positiva ögonblick (medalj, stängda ringar).
- **Säljsida, support-e-post, integritetspolicy och villkor:** ägaren gör säljsidan i ett
  separat projekt och registrerar en support-adress. Policy och villkor kan ligga där.

## Öppna frågor att ta upp med ägaren

1. **Server:** behåll Next.js API på Vercel som backend för appen, eller flytta coach,
   synk, notiser och schemalagda jobb till Supabase (Edge Functions + schemalagda jobb)
   och slopa Vercel (sparar ca 2 600 kr/år). Kan göras efter lansering.
2. **Var koden ska ligga:** förslag `mobile/` i samma repo (delar `src/lib/`), alternativt
   eget repo.
3. **Ordningen i detalj** – ägaren vill ta det steg för steg. Föreslå en plan och vänta på OK.

## Apple-krav att inte glömma

Integritetspolicy-URL, support-URL/e-post, radera konto i appen, integritetsetiketter i
App Store, förklaring för Apple Hälsa-åtkomst, Sign in with Apple (eftersom Google finns),
köp i appen för prenumerationen (förslag: RevenueCat, gratis upp till en viss omsättning).

## Native-funktioner

- **Apple Hälsa (HealthKit)** direkt: ersätter intervals.icu + Companion för iPhone.
  intervals.icu blir valfritt tillval. Android: Health Connect.
- **Planen till Apple Watch** via WorkoutKit (iOS 17+): kräver en egen liten Expo-modul i
  Swift. I dag går planen via intervals.icu-kalendern (`src/lib/watchPlanSync.ts`,
  `src/lib/watchWorkout.ts`) – stegformatet där kan återanvändas som mall.
- **Pushnotiser** via Expo Notifications (APNs/FCM) i stället för webbpush.
- **Ägaren har Mac med Xcode** och testar på sin iPhone (Expo development build).
  Molnsessionen kan inte bygga eller köra iOS – förbered koden, ägaren bygger.

## Läget i dag

- Webbappen: Next.js 16 (App Router, `proxy.ts`, se `AGENTS.md`), React 19, Tailwind v4,
  shadcn/ui, Supabase (RLS överallt), Vercel. Produktion: https://traningsapp-ten.vercel.app
- **Supabase-projektet `yonnzfwmihvlrlnlcbpp` är PAUSAT** (pausat 18 nov 2026; kan
  återställas med ett klick i 90 dagar, alltså till ca 16 feb 2027). Återställ det innan
  något testas mot riktig data – fråga ägaren först, gratisplanen tillåter bara två aktiva
  projekt.
- Migrationer i `supabase/migrations/` (0001–0021). Nya tabeller **måste få uttryckliga
  GRANT** till `authenticated` (och `service_role` där servern läser) – projektet ger inga
  behörigheter automatiskt.
- Coach: `src/lib/coach/` (Haiku för chatt, Sonnet för veckoavstämning),
  instruktioner i `coach/instruktioner.md`, kostnadstak i `src/lib/coach/quota.ts`.
- Funktioner som finns: gymlogg, löpning med karta/splits, AI-coach + veckoplan, mål med
  milstolpar och medaljer, veckoringar och svit, rörelsecoach (kamera, MediaPipe),
  introduktion, inbjudningar via personliga länkar + adminsida, gruppchallenger,
  planen till klockan + Flytta, prognos och form, klädtips (Open-Meteo), pushnotiser.
- Hemligheter ligger i Vercel (bl.a. `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `INTERVALS_*`).

## Arbetssätt (ägarens önskemål)

- **Prata svenska.** Kort och tydligt.
- **Föreslå först, bygg sedan** när ägaren vill se upplägget (planer, design, story).
- **En funktion per branch och PR.** Ägaren testar och mergar själv ("Squash and merge").
  Merga inte själv och force-pusha inte.
- PR-beskrivning på svenska: vad, varför, hur det testats och vad som inte är testat.
- Be aldrig ägaren klistra in hemligheter i chatten.
- Visa inga kostnader i kronor för vanliga användare; bara ägaren ser kostnader.
