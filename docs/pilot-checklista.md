# Pilotchecklista

## Innan publicering

- Säkerställ att `DATABASE_URL` eller `POSTGRES_URL` är satt i Vercel-projektet.
- Sätt `ALLOWED_ORIGIN` till pilotdomänen.
- Aktivera Vercel Deployment Protection eller motsvarande lösenordsskydd för piloten.
- Bekräfta kontaktperson, versionsdatum och pilotmål.

## Innehåll i piloten

- Tydlig pilottext i gränssnittet
- Metod- och datakällesidor tillgängliga från appen
- Integritetsnotis: inga personuppgifter utöver enkel pilotkontext
- Tydlig disclaimer om screeningnivå och att appen inte ersätter full LCA eller certifiering

## Verifiering

- `npm run build`
- `npm run test`
- `npm run typecheck`
- `PREVIEW_URL=https://din-preview.vercel.app npm run smoke:vercel`

## Godkännandepunkter

- Projekt och scenarier finns kvar efter omladdning
- `/api/data-sources` visar komplett metod- och källmetadata
- Import av GeoJSON och tabellformat fungerar i previewmiljön
- Snabbkalkyl och scenarioflöde fungerar på samma domän
