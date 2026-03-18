import type { DataSourcesResponse } from "../../../../packages/shared/src";

export interface RawScbValue {
  key: [string];
  values: [string];
}

export interface RawScbDataset {
  title: string;
  updated: string;
  data: RawScbValue[];
}

export interface NormalizedScbDataset {
  dataset: string;
  updatedAt: string;
  values: Record<string, number>;
}

export function normalizeScbEnergyDataset(raw: RawScbDataset): NormalizedScbDataset {
  const values = raw.data.reduce<Record<string, number>>((accumulator, row) => {
    const [buildingType] = row.key;
    const [value] = row.values;
    accumulator[buildingType] = Number(value.replace(",", "."));
    return accumulator;
  }, {});

  return {
    dataset: raw.title,
    updatedAt: raw.updated,
    values
  };
}

export function buildScbDatasetManifestEntry(updatedAt: string): DataSourcesResponse["datasets"][number] {
  return {
    dataset: "scb-energy-benchmarks",
    version: updatedAt,
    updatedAt,
    sourceIds: ["scb-statistikdatabasen", "energimyndigheten"],
    status: "active"
  };
}
