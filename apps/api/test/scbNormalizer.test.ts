import { describe, expect, it } from "vitest";

import {
  buildScbDatasetManifestEntry,
  normalizeScbEnergyDataset
} from "../src/services/scbNormalizer";

describe("normalizeScbEnergyDataset", () => {
  it("converts SCB rows into a key/value lookup", () => {
    const normalized = normalizeScbEnergyDataset({
      title: "SCB Energi Stockholm",
      updated: "2026-03-01",
      data: [
        { key: ["smahus"], values: ["152,5"] },
        { key: ["kontor"], values: ["138"] }
      ]
    });

    expect(normalized.values).toEqual({
      smahus: 152.5,
      kontor: 138
    });
  });

  it("creates a manifest entry for generated data", () => {
    expect(buildScbDatasetManifestEntry("2026-03-01")).toEqual({
      dataset: "scb-energy-benchmarks",
      version: "2026-03-01",
      updatedAt: "2026-03-01",
      sourceIds: ["scb-statistikdatabasen", "energimyndigheten"],
      status: "active"
    });
  });
});

