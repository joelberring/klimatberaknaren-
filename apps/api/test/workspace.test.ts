import type { Request, Response } from "express";
import { beforeEach, describe, expect, it } from "vitest";

import {
  handleBenchmarkProfilesRequest,
  handleProjectCreateRequest,
  handleScenarioCalculateRequest,
  handleScenarioCompareRequest,
  handleScenarioCreateRequest,
  handleScenarioModel3DImportRequest,
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

    const modelImportResponse = createMockResponse();
    await handleScenarioModel3DImportRequest(
      {
        params: { scenarioId: (scenarioResponse.body as { id: string }).id },
        body: {
          model: {
            id: "model-1",
            name: "Husmodell",
            sourceFormat: "gltf",
            importedAt: "2026-03-18T08:30:00.000Z",
            parts: [
              {
                id: "part-1",
                label: "Stomme",
                category: "stomme",
                meshNames: ["frame"]
              }
            ],
            notes: []
          }
        }
      } as unknown as Request,
      modelImportResponse
    );

    const calculationResponse = createMockResponse();
    await handleScenarioCalculateRequest(
      {
        params: { scenarioId: (scenarioResponse.body as { id: string }).id },
        body: {}
      } as unknown as Request,
      calculationResponse
    );

    const secondCalculationResponse = createMockResponse();
    await handleScenarioCalculateRequest(
      {
        params: { scenarioId: (scenarioResponse.body as { id: string }).id },
        body: {}
      } as unknown as Request,
      secondCalculationResponse
    );

    const body = calculationResponse.body as {
      result: { vsBenchmark: Array<{ metric: string }>; recommendedActions: unknown[] };
      scenario: {
        runs: Array<{ scenarioId: string }>;
        latestResult: unknown;
        buildingModel3D?: { parts: Array<{ label: string }> };
      };
    };
    const secondBody = secondCalculationResponse.body as {
      scenario: {
        runs: Array<{ scenarioId: string }>;
        latestResult: unknown;
      };
    };

    const workspaceAfterCalculation = createMockResponse();
    await handleWorkspaceRequest(
      {
        query: {
          organizationId: "stockholm-stad"
        }
      } as unknown as Request,
      workspaceAfterCalculation
    );

    expect(calculationResponse.statusCode).toBe(200);
    expect((workspaceAfterLogin.body as { session: { organizationId: string } }).session.organizationId).toBe(
      "stockholm-stad"
    );
    expect(body.scenario.runs).toHaveLength(1);
    expect(body.scenario.runs[0].scenarioId).toBe((scenarioResponse.body as { id: string }).id);
    expect(body.scenario.latestResult).toBeTruthy();
    expect(secondBody.scenario.runs).toHaveLength(2);
    expect(secondBody.scenario.latestResult).toBeTruthy();
    expect((modelImportResponse.body as { model: { parts: Array<{ label: string }> } }).model.parts[0].label).toBe(
      "Stomme"
    );
    expect(body.result.vsBenchmark).toEqual(
      expect.arrayContaining([expect.objectContaining({ metric: "perM2" })])
    );
    expect(body.result.recommendedActions.length).toBeGreaterThan(0);
    expect(
      (
        workspaceAfterCalculation.body as {
          projects: Array<{ scenarios: Array<{ runs: unknown[]; buildingModel3D?: unknown }> }>;
        }
      ).projects[0].scenarios[0].runs
    ).toHaveLength(2);
    expect(
      (
        workspaceAfterCalculation.body as {
          projects: Array<{ scenarios: Array<{ buildingModel3D?: { parts: Array<{ label: string }> } }> }>;
        }
      ).projects[0].scenarios[0].buildingModel3D?.parts[0].label
    ).toBe("Stomme");
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
