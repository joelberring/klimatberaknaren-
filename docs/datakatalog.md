# Datakatalog

## Aktiva referensdata i MVP

| Dataset | Fil | Syfte | Status |
| --- | --- | --- | --- |
| Building typologies | `apps/api/data/reference/building-typologies.json` | Schabloner för stomvolym och kompletterande embodied-poster | Aktiv |
| Energy benchmarks | `apps/api/data/reference/energy-benchmarks.json` | Typiska energinivåer per byggnadstyp och standard | Aktiv |
| Emissions factors | `apps/api/data/reference/emissions.json` | Materialfaktorer, värmefaktorer och bas-U-värden | Aktiv |
| Mobility reference | `apps/api/data/reference/mobility-reference.json` | Transitnärhet, färdmedelsprofiler och emissionsfaktorer för mobilitetsdelen | Aktiv |
| Retrofit reference | `apps/api/data/reference/retrofit-reference.json` | Schabloner för ombyggnad och påbyggnad | Aktiv |
| Standard profiles | `apps/api/data/reference/standard-profiles.json` | Screeningprofiler för t.ex. Miljöbyggnad och BREEAM-SE | Aktiv |
| Dataset manifest | `apps/api/data/reference/dataset-manifest.json` | Versionsinfo för visning i API/UI | Aktiv |
| Source catalog | `apps/api/data/reference/source-catalog.json` | Källor, licenser och noteringar | Aktiv |

## Rådata och ingest

| Fil | Syfte |
| --- | --- |
| `apps/api/data/raw/scb-energy-stockholm.json` | Exempel på rå SCB-liknande energidata |
| `apps/api/scripts/refresh-scb-data.ts` | Normaliserar rådata till ett internt JSON-format |

## Licens- och källstatus

- SCB: behandlas som öppen statistik med CC0-liknande användning i MVP-underlaget
- Energimyndigheten: offentliga energitabeller och publikationer
- SMHI: används som underlag för Stockholm-profil, inte live i runtime
- Boverket ED-API: adapter definierad men ej aktiv som produktionskälla i MVP
- Stockholms stad: källkatalog finns för framtida geokoppling, men inte i kritiskt användarflöde

## Uppdateringsfrekvens

- Referensdata i repo: versionsstyrt och manuellt uppdaterat
- SCB-refresh-script: körs vid behov eller i framtida schemalagd pipeline
- `GET /api/data-sources`: visar aktuell versionsmetadata från manifestet
