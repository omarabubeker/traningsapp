# Träning

Personlig träningsapp (PWA) med gymlogg, löppass från klockan och AI-coach.
Se [PLAN.md](PLAN.md) för helheten och etapperna.

**Etapp 3:** AI-coach – chatt (Claude Haiku 5.5), minne, veckoavstämning med plan
(Claude Sonnet 5.5), plan mot utfört och förbrukning. Instruktionerna finns i
[`coach/instruktioner.md`](coach/instruktioner.md) – redigera fritt.

**Etapp 2:** löppass från klockan (Apple Watch → Apple Hälsa → Intervals.icu Companion →
intervals.icu → appen), engångsimport av Apple Hälsa-export, splits och veckovolym.

**Etapp 1:** inloggning (e-post + lösenord), profil med vikthistorik, gymlogg
med "förra gången" och offlinekö, veckoöversikt, PWA (hemskärm, mörkt läge).

## Kom igång (en gång)

### 1. Supabase
1. [supabase.com](https://supabase.com) → **New project**, region *Europe* (projektet ligger i eu-central-1, Frankfurt).
2. **SQL Editor** → klistra in och kör `supabase/migrations/0001_etapp1_grund.sql`.
3. **Authentication → Users → Add user → Create new user**: din e-post och ett starkt
   lösenord (spara i lösenordshanteraren), kryssa i **Auto Confirm User**.
4. **Authentication → Sign In / Providers**: stäng av **Allow new users to sign up**.
5. **Connect** (överst) → **App Frameworks** → **Next.js**: kopiera URL och publishable/anon key.

> Inloggning sker med e-post + lösenord, så ingen e-post behöver skickas. Appen spärrar
> dessutom alla adresser utom `ALLOWED_EMAIL`.

### 2. Vercel
1. [vercel.com](https://vercel.com) → logga in med GitHub → **Add New → Project** → välj `traningsapp`.
2. **Environment Variables** (för *Production* och *Preview*), se `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `ALLOWED_EMAIL`
3. **Deploy.** Varje pull request får därefter en egen testlänk.

### Etapp 2: databas och klockan
1. Supabase → **SQL Editor** → kör `supabase/migrations/0002_etapp2_lopning.sql`.
2. Vercel → miljövariablerna `INTERVALS_API_KEY` och `INTERVALS_ATHLETE_ID` (med "i").
3. I appen: **Profil → Inställningar → Synka**, och **Importera export.zip** för historiken.

### Etapp 3: coachen
1. Supabase → **SQL Editor** → kör `supabase/migrations/0003_etapp3_coach.sql`.
2. Vercel → `ANTHROPIC_API_KEY` (Production och Preview).
3. Sätt en månadsgräns i Claude Console (Limits).

### 3. iPhone
Öppna adressen i Safari → **Dela** → **Lägg till på hemskärmen**. Logga in i appen
från hemskärmen (inloggningen i Safari och i hemskärmsappen är separata på iOS);
lösenordet kan fyllas i med Face ID.

## Utveckling lokalt
```bash
cp .env.example .env.local   # fyll i värdena
npm install
npm run dev
```

## Struktur
- `src/app/(app)/` – inloggade sidor: översikt, gym, profil
- `src/app/login/` – inloggning (server actions, allowlist)
- `src/lib/gymQueue.ts` – offlinekö för gymset
- `src/lib/intervals.ts`, `src/app/api/sync/` – synk mot intervals.icu
- `src/lib/appleHealth.ts` – strömmande läsning av Apple Hälsa-export i webbläsaren
- `src/lib/running.ts` – splits, rutt, tempo (testas med `npm test`)
- `coach/instruktioner.md` – coachens grundinstruktioner
- `src/lib/coach/` – sammanfattning till coachen, minne, säkerhetsregler, prissättning
- `src/app/api/coach/` – chatt (strömmande) och veckoavstämning
- `src/proxy.ts` – sessionsförnyelse och inloggningsskydd
- `supabase/migrations/` – databas med Row Level Security
- `public/sw.js`, `src/app/manifest.ts` – PWA
