# Klimatberäknaren

Svensk MVP för att uppskatta `embodied` klimatpåverkan och driftutsläpp för byggnader i Stockholm. Projektet består av:

- `apps/api`: Node.js + Express + TypeScript
- `apps/web`: React + TypeScript + Vite
- `packages/shared`: delade typer, etiketter och konstanter

## Kom igång

```bash
npm install
cp .env.example .env
npm run dev:api
npm run dev:web
```

API:t startar på `http://localhost:8080` och webbappen på `http://localhost:5173`.

## Vercel-pilot

Appen är förberedd för Vercel med:

- statisk frontend från `apps/web/dist`
- serverless API via `api/[...route].ts`
- samma relativa `/api/...`-anrop i frontend
- stöd för uthållig lagring via `DATABASE_URL` eller `POSTGRES_URL`

### Enklaste sättet att få uthållig lagring

1. Öppna ditt projekt i Vercel.
2. Lägg till en storage-integration från Marketplace, till exempel Neon eller Supabase.
3. Låt Vercel injicera databaskopplingen som miljövariabel, eller klistra in den själv som `DATABASE_URL`.
4. Deploya om så att den nya miljövariabeln gäller för nästa deployment.

För Supabase bör du använda **pooler transaction mode** för serverless-funktioner. För Vercel gäller att nya miljövariabler bara används i nya deploymentar.

### Rekommenderade miljövariabler

```bash
DATABASE_URL=postgres://...
ALLOWED_ORIGIN=https://din-pilot.vercel.app
BOVERKET_ED_API_ENABLED=false
```

`ALLOWED_ORIGIN` kan lämnas tom i lokal utveckling. För pilot på Vercel bör den peka på pilotdomänen.

### Deployflöde

```bash
npm run build
npm run test
npm run typecheck
npm run smoke:vercel
```

För preview/prod-smoke används:

```bash
PREVIEW_URL=https://din-preview.vercel.app npm run smoke:vercel
```

Smoke-testet verifierar både `/api/health` och ett riktigt kalkylanrop.

## Viktiga script

```bash
npm run build
npm run test
npm run typecheck
```

För att regenerera normaliserad SCB-data:

```bash
npx tsx apps/api/scripts/refresh-scb-data.ts
```

## MVP-omfång

- Anonym kalkylator utan inloggning
- Schablonbaserad beräkningsmotor för Stockholm
- Resultat för embodied klimatpåverkan, driftutsläpp per år och över 50 år
- Tydliga antaganden, osäkerhetsintervall och källredovisning

## Struktur

```text
apps/
  api/
  web/
packages/
  shared/
docs/
```

## Dokumentation

- [Metodik](./docs/metodik.md)
- [Datakatalog](./docs/datakatalog.md)
- [Användarguide](./docs/anvandarguide.md)
- [Pilotchecklista](./docs/pilot-checklista.md)
