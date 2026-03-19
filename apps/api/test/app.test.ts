import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import {
  handleApiError,
  handleCalculateRequest,
  handleDataSourcesRequest,
  handleProjectCreateRequest,
  handleScenarioCreateRequest
} from "../src/app";

describe("api routes", () => {
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

  it("returns sources metadata", async () => {
    const response = createMockResponse();

    handleDataSourcesRequest({} as Request, response);

    expect(response.statusCode).toBe(200);
    expect((response.body as { stockholmProfile: string }).stockholmProfile).toBe(
      "Stockholm MVP 2026"
    );
    expect((response.body as { datasets: unknown[] }).datasets.length).toBeGreaterThan(1);
  });

  it("calculates climate impact for valid payload", async () => {
    const response = createMockResponse();

    await handleCalculateRequest(
      {
        body: {
          buildingType: "kontor",
          grossFloorAreaM2: 1000,
          buildYear: 1990,
          frameMaterial: "tra",
          energyStandard: "normal",
          heatingType: "fjarrvarme"
        }
      } as Request,
      response
    );

    expect(response.statusCode).toBe(200);
    expect(
      (response.body as { embodied: { totalKgCo2e: number } }).embodied.totalKgCo2e
    ).toBeGreaterThan(0);
    expect(
      (response.body as { operational: { annualKgCo2e: number } }).operational.annualKgCo2e
    ).toBeGreaterThan(0);
    expect((response.body as { assumptions: unknown[] }).assumptions).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Stockholmsprofil" })])
    );
  });

  it("returns validation errors for invalid payload", async () => {
    const response = createMockResponse();
    try {
      await handleCalculateRequest(
        {
          body: {
            buildingType: "villa",
            grossFloorAreaM2: -10
          }
        } as Request,
        response
      );
    } catch (error) {
      handleApiError(error as Error, {} as Request, response, vi.fn());
    }

    expect(response.statusCode).toBe(400);
    expect((response.body as { message: string }).message).toBe("Ogiltig indata");
  });

  it("creates a scenario immediately after creating a project through the API handlers", async () => {
    const projectResponse = createMockResponse();
    await handleProjectCreateRequest(
      {
        body: {
          organizationId: "stockholm-stad",
          name: "Kedjeprojekt"
        }
      } as Request,
      projectResponse
    );

    expect(projectResponse.statusCode).toBe(201);
    expect((projectResponse.body as { id: string }).id).toBeTruthy();

    const scenarioResponse = createMockResponse();
    await handleScenarioCreateRequest(
      {
        params: { projectId: (projectResponse.body as { id: string }).id },
        body: {
          name: "Kedjescenario",
          mode: "quick",
          quickInput: {
            buildingType: "kontor",
            grossFloorAreaM2: 1000,
            buildYear: 2030,
            frameMaterial: "betong",
            energyStandard: "normal",
            heatingType: "fjarrvarme"
          }
        }
      } as unknown as Request,
      scenarioResponse
    );

    expect(scenarioResponse.statusCode).toBe(201);
    expect((scenarioResponse.body as { projectId: string }).projectId).toBe(
      (projectResponse.body as { id: string }).id
    );
    expect((scenarioResponse.body as { name: string }).name).toBe("Kedjescenario");
  });
});
