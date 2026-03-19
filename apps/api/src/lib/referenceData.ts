import buildingTypologies from "../../data/reference/building-typologies.json";
import datasetManifest from "../../data/reference/dataset-manifest.json";
import emissions from "../../data/reference/emissions.json";
import energyBenchmarks from "../../data/reference/energy-benchmarks.json";
import methodCatalog from "../../data/reference/method-catalog.json";
import mobilityReference from "../../data/reference/mobility-reference.json";
import retrofitReference from "../../data/reference/retrofit-reference.json";
import sourceCatalog from "../../data/reference/source-catalog.json";
import standardProfiles from "../../data/reference/standard-profiles.json";

import type {
  DataSourcesResponse,
  MethodCatalogEntry,
  StandardProfile,
  SourceReference
} from "../../../../packages/shared/src";

interface TypologyRecord {
  displayName: string;
  frameVolumeM3PerM2: Record<string, number>;
  supplementaryKgCo2ePerM2: Record<string, number>;
}

interface EnergyBenchmarkRecord {
  displayName: string;
  standards: Record<string, number>;
}

interface EmissionsRecord {
  materialFactorsKgCo2ePerM3: Record<string, number>;
  heatingProfiles: Record<
    string,
    {
      heatingSharePct: number;
      heatingFactorKgCo2ePerKwh: number;
      electricityFactorKgCo2ePerKwh: number;
    }
  >;
  baselineUValues: Record<string, number>;
  defaultFloors: Record<string, number>;
  defaultGlazingRatioPct: Record<string, number>;
  foundationMultipliers: Record<string, number>;
  foundationGroundMultipliers: Record<string, number>;
  landUseFactorsKgCo2ePerM2: Record<string, number>;
  parkingKgCo2ePerSpace: number;
  parkingStructureMultipliers: Record<string, number>;
  parkingStructureFloorStepMultipliers: Record<string, number>;
}

export interface MobilityReferenceRecord {
  accessibilityBands: Record<
    "high" | "medium" | "low",
    {
      maxTransitStopM: number;
      maxRailStationM: number;
      minDeparturesPerHour: number;
    }
  >;
  transitNodes: Array<{
    id: string;
    name: string;
    type: "rail" | "transit";
    lat: number;
    lon: number;
    departuresPerHour: number;
  }>;
  annualTripsPerPersonByUse: Record<string, number>;
  avgTripLengthKmByMode: Record<string, number>;
  emissionFactorsKgCo2ePerPkm: Record<string, number>;
  modeShareProfiles: Record<
    string,
    Record<
      "high" | "medium" | "low",
      {
        transit: number;
        car: number;
        walkCycle: number;
      }
    >
  >;
  serviceTripShareByUse: Record<string, number>;
  parkingCarShareAdjustmentPerSpacePerPerson: number;
}

export interface RetrofitReferenceRecord {
  embodiedMultiplierByDepth: Record<string, number>;
  operationalImprovementPctByDepth: Record<string, number>;
  retainedStructureFloorPct: number;
  ombyggnadFoundationReuseFactor: number;
  pabyggnadFoundationFactor: number;
  pabyggnadReinforcementKgCo2ePerAddedM2: number;
  avoidedNewbuildCreditShare: number;
}

interface DatasetManifestRecord {
  stockholmProfile: string;
  datasets: DataSourcesResponse["datasets"];
}

const cache = {
  typologies: buildingTypologies as Record<string, TypologyRecord>,
  energyBenchmarks: energyBenchmarks as Record<string, EnergyBenchmarkRecord>,
  emissions: emissions as EmissionsRecord,
  mobilityReference: mobilityReference as MobilityReferenceRecord,
  retrofitReference: retrofitReference as RetrofitReferenceRecord,
  datasetManifest: datasetManifest as DatasetManifestRecord,
  sourceCatalog: sourceCatalog as SourceReference[],
  methodCatalog: methodCatalog as MethodCatalogEntry[],
  standardProfiles: standardProfiles as StandardProfile[]
};

export function getReferenceData() {
  return cache;
}

export function getDataSourcesCatalog(): DataSourcesResponse {
  return {
    stockholmProfile: cache.datasetManifest.stockholmProfile,
    datasets: cache.datasetManifest.datasets,
    sources: cache.sourceCatalog,
    methodCatalog: cache.methodCatalog,
    standardProfiles: cache.standardProfiles
  };
}
