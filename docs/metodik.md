# Metodik

## Översikt

MVP:n använder en heuristisk modell. Syftet är att ge transparenta, jämförbara uppskattningar i tidiga skeden, inte att ersätta en fullständig bygg-LCA.

## Embodied klimatpåverkan

Beräkningen kombinerar:

- bruttoarea
- vald byggnadstyp
- valt stommaterial
- schabloniserad stomvolym per kvadratmeter
- materialfaktor i `kg CO2e / m3`

Utöver stommen läggs tre kategorier till som areabaserade schabloner:

- grund och bjälklag
- klimatskal
- installationer och interiörer

## Driftutsläpp

Driftmodellen utgår från:

- specifik energianvändning från användaren, eller
- lookup-tabell per byggnadstyp och energistandard

Energin delas mellan uppvärmning och fastighetsel beroende på uppvärmningssätt. Årsutsläpp multipliceras sedan med:

- lokal emissionsfaktor för uppvärmning
- elnätsfaktor för elandel

Livscykelresultatet beräknas med en fast livslängd på `50 år`.

## U-värdesjustering

Om användaren anger U-värden justeras energibehovet relativt en basprofil. Justeringen viktar:

- yttervägg 40 %
- tak 25 %
- fönster 35 %

Justeringsfaktorn begränsas till intervallet `0,8x` till `1,2x` för att undvika orimliga utslag i MVP:n.

## Osäkerhet

Resultatet visas med ett schablonmässigt osäkerhetsintervall på `±20 %`. Intervallen används bara i presentationen och påverkar inte grundberäkningen.

