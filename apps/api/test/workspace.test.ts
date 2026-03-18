import type { Request, Response } from "express";
import { beforeEach, describe, expect, it } from "vitest";

import {
  handleBenchmarkProfilesRequest,
  handleProjectCreateRequest,
  handleScenarioCalculateRequest,
  handleScenarioCompareRequest,
  handleScenarioCreateRequest,
  handleScenarioGeoJsonImportRequest,
  handleSessionLogin,
  handleWorkspaceRequest
} from "../src/app";
import { resetWorkspaceStore } from "../src/services/workspaceStore";

function createMockResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    }
  };

  return response as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  };
}

describe("workspace flows", () => {
  beforeEach(() => {
    return resetWorkspaceStore();
  });

  it("creates a session, project and scenario, then calculates a benchmarked result", async () => {
    const sessionResponse = createMockResponse();
    await handleSessionLogin(
      {
        body: {
          email: "planerare@stockholm.se",
          organizationId: "stockholm-stad"
        }
      } as Request,
      sessionResponse
    );

    const workspaceAfterLogin = createMockResponse();
    await handleWorkspaceRequest(
      {
        headers: {
          cookie: sessionResponse.headers["Set-Cookie"]
        }
      } as unknown as Request,
      workspaceAfterLogin
    );

    const projectResponse = createMockResponse();
    await handleProjectCreateRequest(
      {
        body: {
          organizationId: "stockholm-stad",
          name: "Program Flemingsberg"
        }
      } as Request,
      projectResponse
    );

    const scenarioResponse = createMockResponse();
    await handleScenarioCreateRequest(
      {
        params: { projectId: (projectResponse.body as { id: string }).id },
        body: {
          name: "Täthet A",
          mode: "quick",
          quickInput: {
            buildingType: "kontor",
            grossFloorAreaM2: 1200,
            buildYear: 2030,
            frameMaterial: "betong",
            energyStandard: "normal",
            heatingType: "fjarrvarme"
          }
        }
      } as unknown as Request,
      scenarioResponse
    );

    const calculationResponse = createMockResponse();
    await handleScenarioCalculateRequest(
      {
        params: { scenarioId: (scenarioResponse.body as { id: string }).id },
        body: {}
      } as unknown as Request,
      calculationResponse
    );

    const body = calculationResponse.body as {
      result: { vsBenchmark: Array<{ metric: string }>; recommendedActions: unknown[] };
    };

    expect(calculationResponse.statusCode).toBe(200);
    expect((workspaceAfterLogin.body as { session: { organizationId: string } }).session.organizationId).toBe(
      "stockholm-stad"
    );
    expect(body.result.vsBenchmark).toEqual(
      expect.arrayContaining([expect.objectContaining({ metric: "perM2" })])
    );
    expect(body.result.recommendedActions.length).toBeGreaterThan(0);
  });

  it("imports GeoJSON plan objects and compares two calculated scenarios", async () => {
    const projectResponse = createMockResponse();
    await handleProjectCreateRequest(
      {
        body: {
          organizationId: "stockholm-stad",
          name: "Ny stadsdel"
        }
      } as Request,
      projectResponse
    );

    const projectId = (projectResponse.body as { id: string }).id;

    const baseScenarioResponse = createMockResponse();
    await handleScenarioCreateRequest(
      {
        params: { projectId },
        body: {
          name: "Bas",
          mode: "plan"
        }
      } as unknown as Request,
      baseScenarioResponse
    );

    const candidateScenarioResponse = createMockResponse();
    await handleScenarioCreateRequest(
      {
        params: { projectId },
        body: {
          name: "Förbättrad"
        }
      } as unknown as Request,
      candidateScenarioResponse
    );

    const baseScenarioId = (baseScenarioResponse.body as { id: string }).id;
    const candidateScenarioId = (candidateScenarioResponse.body as { id: string }).id;

    const importResponse = createMockResponse();
    await handleScenarioGeoJsonImportRequest(
      {
        params: { scenarioId: baseScenarioId },
        body: {
          geojson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [0, 0],
                      [0, 10],
                      [10, 10],
                      [10, 0],
                      [0, 0]
                    ]
                  ]
                },
                properties: {
                  id: "k1",
                  name: "Kvarter 1",
                  objectType: "byggnad",
                  buildingType: "flerbostadshus",
                  grossFloorAreaM2: 2400,
                  buildYear: 2031,
                  frameMaterial: "betong",
                  energyStandard: "normal",
                  heatingType: "fjarrvarme",
                  residents: 56,
                  siteAreaM2: 6000,
                  parkingSpaces: 18,
                  landType: "gronyta",
                  foundationType: "palar"
                }
              }
            ]
          }
        }
      } as unknown as Request,
      importResponse
    );

    const improvedImportResponse = createMockResponse();
    await handleScenarioGeoJsonImportRequest(
      {
        params: { scenarioId: candidateScenarioId },
        body: {
          geojson: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [0, 0],
                      [0, 10],
                      [10, 10],
                      [10, 0],
                      [0, 0]
                    ]
                  ]
                },
                properties: {
                  id: "k1b",
                  name: "Kvarter 1",
                  objectType: "byggnad",
                  buildingType: "flerbostadshus",
                  grossFloorAreaM2: 2400,
                  buildYear: 2031,
                  frameMaterial: "tra",
                  energyStandard: "modern",
                  heatingType: "fjarrvarme",
                  residents: 56,
                  siteAreaM2: 6000,
                  parkingSpaces: 8,
                  landType: "tidigare_bebyggd",
                  foundationType: "platta_pa_mark"
                }
              }
            ]
          }
        }
      } as unknown as Request,
      improvedImportResponse
    );

    await handleScenarioCalculateRequest(
      {
        params: { scenarioId: baseScenarioId },
        body: {}
      } as unknown as Request,
      createMockResponse()
    );

    await handleScenarioCalculateRequest(
      {
        params: { scenarioId: candidateScenarioId },
        body: {}
      } as unknown as Request,
      createMockResponse()
    );

    const compareResponse = createMockResponse();
    await handleScenarioCompareRequest(
      {
        params: { projectId },
        query: {
          base: baseScenarioId,
          candidate: candidateScenarioId
        }
      } as unknown as Request,
      compareResponse
    );

    const comparison = compareResponse.body as {
      metrics: Array<{ metric: string; delta: number }>;
      changedDrivers: unknown[];
    };

    expect(importResponse.statusCode).toBe(201);
    expect(compareResponse.statusCode).toBe(200);
    expect(comparison.metrics).toEqual(
      expect.arrayContaining([expect.objectContaining({ metric: "total" })])
    );
    expect(comparison.metrics).toEqual(
      expect.arrayContaining([expect.objectContaining({ metric: "perHa" })])
    );
    expect(comparison.changedDrivers.length).toBeGreaterThan(0);
  });

  it("returns workspace and benchmark profiles for an organization", async () => {
    const workspaceResponse = createMockResponse();
    await handleWorkspaceRequest(
      {
        query: {
          organizationId: "stockholm-stad"
        }
      } as unknown as Request,
      workspaceResponse
    );

    const benchmarkResponse = createMockResponse();
    handleBenchmarkProfilesRequest(
      {
        params: {
          organizationId: "stockholm-stad"
        }
      } as unknown as Request,
      benchmarkResponse
    );

    expect((workspaceResponse.body as { organizations: unknown[] }).organizations.length).toBe(2);
    expect((benchmarkResponse.body as unknown[]).length).toBeGreaterThan(0);
  });
});
