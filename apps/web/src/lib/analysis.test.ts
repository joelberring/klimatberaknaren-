import { describe, expect, it } from "vitest";

import type { CalculateRequest, CalculationResult } from "../../../../packages/shared/src";
import { buildMobilityFactorRows } from "./analysis";

describe("analysis", () => {
  it("shows service proximity as a separate mobility factor", () => {
    const snapshot = {
      buildingType: "flerbostadshus",
      urbanContext: "stockholm_innerstad",
      parkingSpaces: 0,
      distanceToServiceM: 150,
      transitOverrides: {
        distanceToTransitStopM: 250,
        distanceToRailStationM: 700,
        departuresPerHour: 12
      }
    } as unknown as CalculateRequest;

    const result = {
      mobility: {
        annualKgCo2e: 1200,
        lifetimeKgCo2e: 60000,
        breakdown: [],
        inputs: {
          accessibilityBand: "high",
          urbanContext: "stockholm_innerstad",
          distanceToTransitStopM: 250,
          distanceToRailStationM: 700,
          departuresPerHour: 12,
          distanceToServiceM: 150,
          source: "siteLocation"
        }
      },
      population: {
        totalPeople: 30
      }
    } as unknown as CalculationResult;

    const rows = buildMobilityFactorRows(snapshot, result);
    const serviceRow = rows.find((row) => row.id === "serviceAccess");

    expect(serviceRow).toBeTruthy();
    expect(serviceRow?.value).toBe("150 m");
    expect(serviceRow?.direction).toBe("transit");
  });
});
