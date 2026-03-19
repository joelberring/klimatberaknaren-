import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const fetchMock = vi.fn();
let workspacePayload: TestWorkspacePayload;

interface TestSession {
  email: string;
  organizationId: string;
  organizationName: string;
}

interface TestScenario {
  id: string;
  projectId: string;
  name: string;
  mode: string;
  planObjects: unknown[];
  runs: Array<{
    id: string;
    scenarioId: string;
    createdAt: string;
    result: ReturnType<typeof createResult>;
    inputSnapshot?: Record<string, unknown>;
  }>;
  createdAt: string;
  updatedAt: string;
  lastCalculatedAt?: string;
  quickInput?: Record<string, unknown>;
  latestResult?: ReturnType<typeof createResult>;
}

interface TestProject {
  id: string;
  organizationId: string;
  name: string;
  scenarios: TestScenario[];
  createdAt: string;
  updatedAt: string;
}

interface TestWorkspacePayload {
  session: TestSession | null;
  organizations: Array<{
    id: string;
    name: string;
    audience: string;
    region: string;
  }>;
  projects: TestProject[];
  benchmarkProfiles: Array<Record<string, unknown>>;
  targetProfiles: Array<Record<string, unknown>>;
}

function createResult(overrides: Record<string, unknown> = {}) {
  return {
    embodied: {
      totalKgCo2e: 210000,
      breakdown: [
        {
          key: "frame",
          label: "Stomme",
          valueKgCo2e: 120000,
          unit: "kgCO2e"
        }
      ]
    },
    operational: {
      annualKgCo2e: 5800,
      lifetimeKgCo2e: 290000,
      breakdown: [
        {
          key: "heating",
          label: "Uppvärmning",
          valueKgCo2e: 5100,
          unit: "kgCO2e"
        }
      ]
    },
      mobility: {
        annualKgCo2e: 3200,
        lifetimeKgCo2e: 160000,
        breakdown: [
        {
          key: "car",
          label: "Bilresor",
          valueKgCo2e: 1800,
          unit: "kgCO2e",
          traceKey: "mobility.car"
        }
        ],
        inputs: {
          accessibilityBand: "medium",
          urbanContext: "urban",
          distanceToTransitStopM: 350,
          distanceToRailStationM: 900,
          departuresPerHour: 10,
          source: "siteLocation"
      }
    },
    assumptions: [
      {
        label: "Byggnadslivslängd",
        value: "50 år"
      }
    ],
    sources: [
      {
        id: "scb-statistikdatabasen",
        title: "Statistikdatabasen",
        publisher: "SCB",
        license: "CC0 1.0",
        url: "https://example.com"
      }
    ],
    uncertaintyRangePct: 20,
    totals: {
      label: "Totalt klimatutsläpp",
      value: 500000,
      unit: "kg CO2e",
      traceKey: "totals"
    },
    perM2: {
      label: "Klimatutsläpp per m2",
      value: 500,
      unit: "kg CO2e/m2",
      traceKey: "perM2"
    },
    perPerson: {
      label: "Klimatutsläpp per person",
      value: 18000,
      unit: "kg CO2e/person",
      traceKey: "perPerson"
    },
    perHa: {
      label: "Klimatutsläpp per hektar",
      value: 4200000,
      unit: "kg CO2e/ha",
      traceKey: "perHa"
    },
    population: {
      residents: 20,
      workers: 8,
      totalPeople: 28,
      source: "estimated"
    },
    vsBenchmark: [
      {
        metric: "perM2",
        label: "Per m2",
        referenceLabel: "Normalvärde",
        actualValue: 500,
        referenceValue: 680,
        delta: -180,
        deltaPct: -26,
        status: "below",
        unit: "kg CO2e",
        traceKey: "benchmark.perM2.normal"
      }
    ],
    vsTarget: [
      {
        metric: "perM2",
        label: "Per m2",
        referenceLabel: "Målvärde",
        actualValue: 500,
        referenceValue: 520,
        delta: -20,
        deltaPct: -4,
        status: "below",
        unit: "kg CO2e",
        traceKey: "benchmark.perM2.target"
      }
    ],
    topDrivers: [
      {
        key: "frame",
        label: "Stomme",
        category: "embodied",
        impactKgCo2e: 120000,
        sharePct: 24,
        explanation: "Stor andel av uppförandets klimatpåverkan.",
        traceKey: "embodied.frame"
      }
    ],
    recommendedActions: [
      {
        id: "frame",
        title: "Minska stommens klimatavtryck",
        description: "Testa trä eller hybrid.",
        expectedImpact: "high",
        lever: "stommaterial",
        traceKey: "action.frame"
      }
    ],
    explanations: [
      {
        id: "exp-totals",
        traceKey: "totals",
        title: "Totalt klimatutsläpp",
        summary: "Summerar embodied och drift över livslängd.",
        formulaText: "embodied + drift",
        calculationSteps: ["210 000 + 290 000 = 500 000"],
        inputs: [
          {
            key: "grossFloorAreaM2",
            label: "Bruttoarea",
            value: "1000 m2",
            source: "user"
          }
        ],
        defaultsApplied: [],
        evidence: [
          {
            methodId: "method-embodied-standard",
            sourceId: "scb-statistikdatabasen",
            evidenceType: "standard",
            title: "Metod",
            publisher: "SCB",
            url: "https://example.com",
            citationShort: "Testkälla",
            versionOrYear: "2026"
          }
        ],
        limitations: ["Schablon"]
      },
      {
        id: "exp-frame",
        traceKey: "embodied.frame",
        title: "Stomme",
        summary: "Stompost",
        formulaText: "area x faktor",
        calculationSteps: ["1000 x 120 = 120 000"],
        inputs: [
          {
            key: "frameMaterial",
            label: "Stommaterial",
            value: "Betong",
            source: "user"
          }
        ],
        defaultsApplied: [],
        evidence: [
          {
            methodId: "method-embodied-standard",
            sourceId: "scb-statistikdatabasen",
            evidenceType: "standard",
            title: "Metod",
            publisher: "SCB",
            url: "https://example.com",
            citationShort: "Testkälla",
            versionOrYear: "2026"
          }
        ],
        limitations: ["Schablon"]
      },
      {
        id: "exp-mobility",
        traceKey: "mobility.total",
        title: "Mobilitetslivscykel",
        summary: "Resprofil",
        formulaText: "personer x resor",
        calculationSteps: ["28 personer x profil = 3 200 kg CO2e/år"],
        inputs: [
          {
            key: "accessibilityBand",
            label: "Tillgänglighetsband",
            value: "medium",
            source: "derived"
          }
        ],
        defaultsApplied: [],
        evidence: [
          {
            methodId: "method-mobility-accessibility",
            sourceId: "scb-statistikdatabasen",
            evidenceType: "official-statistic",
            title: "Mobilitet",
            publisher: "SCB",
            url: "https://example.com",
            citationShort: "Testkälla",
            versionOrYear: "2026"
          }
        ],
        limitations: ["Proxy"]
      },
      {
        id: "exp-action",
        traceKey: "action.frame",
        title: "Minska stommens klimatavtryck",
        summary: "Åtgärdsregel",
        formulaText: "regelbaserat stöd",
        calculationSteps: ["Testa trä eller hybrid"],
        inputs: [],
        defaultsApplied: [],
        evidence: [
          {
            methodId: "method-embodied-standard",
            sourceId: "scb-statistikdatabasen",
            evidenceType: "research",
            title: "Metod",
            publisher: "SCB",
            url: "https://example.com",
            citationShort: "Testkälla",
            versionOrYear: "2026"
          }
        ],
        limitations: ["Schablon"]
      }
    ],
    explanationIndex: {
      totals: ["exp-totals"],
      "embodied.frame": ["exp-frame"],
      "mobility.total": ["exp-mobility"],
      "action.frame": ["exp-action"],
      perM2: ["exp-totals"],
      perPerson: ["exp-totals"],
      perHa: ["exp-totals"],
      "benchmark.perM2.normal": ["exp-totals"],
      "benchmark.perM2.target": ["exp-totals"]
    },
    ...overrides
  };
}

function createRun(
  id: string,
  scenarioId: string,
  result: ReturnType<typeof createResult>,
  createdAt: string,
  inputSnapshot?: Record<string, unknown>
) {
  return {
    id,
    scenarioId,
    createdAt,
    result,
    inputSnapshot
  };
}

describe("App", () => {
  beforeEach(() => {
    workspacePayload = {
      session: null,
      organizations: [
        {
          id: "stockholm-stad",
          name: "Stockholms stad",
          audience: "kommun",
          region: "Stockholm"
        }
      ],
      projects: [],
      benchmarkProfiles: [
        {
          id: "benchmark-stockholm-2026",
          organizationId: "stockholm-stad",
          name: "Stockholm kommunprofil 2026",
          sourceLabel: "Kommunal pilotprofil",
          version: "2026.1",
          updatedAt: "2026-03-01",
          applicability: "Tidiga kommunala jämförelser för Stockholm",
          normalPerM2KgCo2e: 680,
          targetPerM2KgCo2e: 520,
          normalPerPersonKgCo2e: 25500,
          targetPerPersonKgCo2e: 19000,
          defaultBtaPerResidentM2: 43,
          defaultBtaPerWorkerM2: 20,
          notes: []
        },
        {
          id: "benchmark-uppsala-2026",
          organizationId: "uppsala-kommun",
          name: "Uppsala kommunprofil 2026",
          sourceLabel: "Kommunal pilotprofil",
          version: "2026.1",
          updatedAt: "2026-03-01",
          applicability: "Tidiga kommunala jämförelser för Uppsala",
          normalPerM2KgCo2e: 650,
          targetPerM2KgCo2e: 500,
          normalPerPersonKgCo2e: 24000,
          targetPerPersonKgCo2e: 18000,
          defaultBtaPerResidentM2: 43,
          defaultBtaPerWorkerM2: 20,
          notes: []
        }
      ],
      targetProfiles: []
    };

    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url === "/api/data-sources") {
        return new Response(
          JSON.stringify({
            stockholmProfile: "Stockholm MVP 2026",
            datasets: [
              {
                dataset: "energy-benchmarks",
                version: "2026.03",
                updatedAt: "2026-03-18",
                sourceIds: ["scb-statistikdatabasen"],
                status: "active"
              },
              {
                dataset: "standard-profiles",
                version: "2026.03",
                updatedAt: "2026-03-18",
                sourceIds: ["scb-statistikdatabasen"],
                status: "active"
              }
            ],
            sources: [
              {
                id: "scb-statistikdatabasen",
                title: "Statistikdatabasen",
                publisher: "SCB",
                license: "CC0 1.0",
                url: "https://example.com",
                note: "Används som primär källa"
              }
            ],
            methodCatalog: [
              {
                id: "method-embodied-standard",
                sourceId: "scb-statistikdatabasen",
                evidenceType: "standard",
                title: "Metod",
                publisher: "SCB",
                url: "https://example.com",
                citationShort: "Testkälla",
                appliesTo: ["totals"],
                versionOrYear: "2026"
              }
            ],
            standardProfiles: [
              {
                id: "miljobyggnad-nybyggnad-4.1-silver",
                scheme: "miljobyggnad",
                version: "4.1",
                level: "Silver",
                label: "Miljöbyggnad Nybyggnad 4.1 Silver",
                summary: "Screeningprofil",
                sourceIds: ["scb-statistikdatabasen"],
                applicableBuildingTypes: [
                  "smahus",
                  "flerbostadshus",
                  "kontor",
                  "skola",
                  "handel"
                ],
                applicableInterventions: ["nybyggnad", "ombyggnad", "pabyggnad"],
                metrics: {
                  perM2: 560,
                  perPerson: 21000,
                  perHa: 5600000
                },
                notes: []
              },
              {
                id: "breeam-se-v6-excellent",
                scheme: "breeam-se",
                version: "6.0",
                level: "Excellent",
                label: "BREEAM-SE v6 Excellent",
                summary: "Screeningprofil",
                sourceIds: ["scb-statistikdatabasen"],
                applicableBuildingTypes: ["kontor", "skola", "handel", "flerbostadshus"],
                applicableInterventions: ["nybyggnad", "ombyggnad", "pabyggnad"],
                metrics: {
                  perM2: 525,
                  perPerson: 19500,
                  perHa: 5250000
                },
                notes: []
              }
            ]
          })
        );
      }

      if (url.startsWith("/api/workspace")) {
        return new Response(JSON.stringify(workspacePayload));
      }

      if (url === "/api/calculate" && method === "POST") {
        return new Response(JSON.stringify(createResult()));
      }

      if (url === "/api/session/login" && method === "POST") {
        workspacePayload = {
          ...workspacePayload,
          session: {
            email: "planerare@stockholm.se",
            organizationId: "stockholm-stad",
            organizationName: "Stockholms stad"
          }
        };
        return new Response(
          JSON.stringify(workspacePayload.session)
        );
      }

      if (url === "/api/projects" && method === "POST") {
        const project = {
          id: "project-1",
          organizationId: "stockholm-stad",
          name: "Ny stadsdel 2040",
          scenarios: [],
          createdAt: "2026-03-18T00:00:00.000Z",
          updatedAt: "2026-03-18T00:00:00.000Z"
        };
        workspacePayload = {
          ...workspacePayload,
          projects: [project]
        };
        return new Response(JSON.stringify(project));
      }

      if (url === "/api/projects/project-1/scenarios" && method === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const scenario: TestScenario = {
          id: "scenario-1",
          projectId: "project-1",
          name: String(body.name ?? "Täthet A"),
          mode: "quick",
          planObjects: [],
          runs: [],
          createdAt: "2026-03-18T00:00:00.000Z",
          updatedAt: "2026-03-18T00:00:00.000Z"
        };

        workspacePayload = {
          ...workspacePayload,
          projects: [
            {
              ...workspacePayload.projects[0],
              scenarios: [scenario]
            }
          ]
        };

        return new Response(JSON.stringify(scenario));
      }

      if (url === "/api/scenarios/scenario-1/calculate" && method === "POST") {
        const project = workspacePayload.projects[0];
        const currentScenario = project?.scenarios[0];
        const runIndex = (currentScenario?.runs?.length ?? 0) + 1;
        const result =
          runIndex === 1
            ? createResult()
            : createResult({
                totals: {
                  label: "Totalt klimatutsläpp",
                  value: 470000,
                  unit: "kg CO2e",
                  traceKey: "totals"
                },
                perM2: {
                  label: "Klimatutsläpp per m2",
                  value: 470,
                  unit: "kg CO2e/m2",
                  traceKey: "perM2"
                }
              });
        const run = createRun(
          `run-${runIndex}`,
          "scenario-1",
          result,
          runIndex === 1 ? "2026-03-18T09:00:00.000Z" : "2026-03-18T10:00:00.000Z",
          {
            buildingType: "kontor",
            grossFloorAreaM2: 1200,
            buildYear: 2030,
            frameMaterial: "betong",
            energyStandard: "normal",
            heatingType: "fjarrvarme"
          }
        );

        const scenario = {
          ...currentScenario,
          latestResult: result,
          runs: [...(currentScenario?.runs ?? []), run],
          lastCalculatedAt: run.createdAt
        };
        workspacePayload = {
          ...workspacePayload,
          projects: [
            {
              ...project,
              scenarios: [scenario]
            }
          ]
        };

        return new Response(JSON.stringify({ scenario, result }));
      }

      if (url === "/api/scenarios/scenario-1/imports/tabular" && method === "POST") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const rows = Array.isArray(body.rows) ? body.rows : [];
        const importedPlanObjects = rows.map((row: Record<string, unknown>, index: number) => ({
          id: String(row.id ?? `import-${index + 1}`),
          name: String(row.name ?? `Byggnad ${index + 1}`),
          objectType: (row.objectType ?? "byggnad") as string,
          grossFloorAreaM2: Number(row.grossFloorAreaM2 ?? 0),
          quickInput: {
            buildingType: row.buildingType ?? "flerbostadshus",
            grossFloorAreaM2: Number(row.grossFloorAreaM2 ?? 0),
            buildYear: Number(row.buildYear ?? 2032),
            frameMaterial: row.frameMaterial ?? "betong",
            energyStandard: row.energyStandard ?? "normal",
            heatingType: row.heatingType ?? "fjarrvarme",
            buildingForm: row.buildingForm ?? "normal",
            urbanContext: row.urbanContext ?? "urban",
            siteAreaM2: row.siteAreaM2 !== undefined ? Number(row.siteAreaM2) : undefined,
            floorsAboveGround:
              row.floorsAboveGround !== undefined ? Number(row.floorsAboveGround) : undefined,
            buildingFootprintM2:
              row.buildingFootprintM2 !== undefined ? Number(row.buildingFootprintM2) : undefined,
            glazingRatioPct:
              row.glazingRatioPct !== undefined ? Number(row.glazingRatioPct) : undefined,
            parkingSpaces:
              row.parkingSpaces !== undefined ? Number(row.parkingSpaces) : undefined,
            parkingStructureType: row.parkingStructureType ?? "none",
            parkingGarageFloors:
              row.parkingGarageFloors !== undefined ? Number(row.parkingGarageFloors) : undefined,
            landType: row.landType,
            groundCondition: row.groundCondition ?? "normal_mark",
            foundationType: row.foundationType,
            siteLocation:
              row.lat !== undefined && row.lon !== undefined
                ? { lat: Number(row.lat), lon: Number(row.lon) }
                : undefined,
            transitOverrides:
              row.distanceToTransitStopM !== undefined ||
              row.distanceToRailStationM !== undefined ||
              row.departuresPerHour !== undefined
                ? {
                    distanceToTransitStopM:
                      row.distanceToTransitStopM !== undefined
                        ? Number(row.distanceToTransitStopM)
                        : undefined,
                    distanceToRailStationM:
                      row.distanceToRailStationM !== undefined
                        ? Number(row.distanceToRailStationM)
                        : undefined,
                    departuresPerHour:
                      row.departuresPerHour !== undefined ? Number(row.departuresPerHour) : undefined
                  }
                : undefined,
            interventionType: row.interventionType,
            existingBuilding:
              row.existingGrossFloorAreaM2 !== undefined &&
              row.existingBuildYear !== undefined &&
              row.existingFrameMaterial !== undefined &&
              row.existingEnergyStandard !== undefined
                ? {
                    grossFloorAreaM2: Number(row.existingGrossFloorAreaM2),
                    buildYear: Number(row.existingBuildYear),
                    frameMaterial: row.existingFrameMaterial,
                    energyStandard: row.existingEnergyStandard,
                    specificEnergyUseKwhM2Year:
                      row.existingSpecificEnergyUseKwhM2Year !== undefined
                        ? Number(row.existingSpecificEnergyUseKwhM2Year)
                        : undefined
                  }
                : undefined,
            retainedStructureSharePct:
              row.retainedStructureSharePct !== undefined
                ? Number(row.retainedStructureSharePct)
                : undefined,
            addedGrossFloorAreaM2:
              row.addedGrossFloorAreaM2 !== undefined ? Number(row.addedGrossFloorAreaM2) : undefined,
            addedFloors: row.addedFloors !== undefined ? Number(row.addedFloors) : undefined,
            retrofitDepth: row.retrofitDepth
          }
        }));

        const project = workspacePayload.projects[0];
        const currentScenario = project?.scenarios[0];
        const scenario = currentScenario
          ? {
              ...currentScenario,
              mode: "plan",
              planObjects: [...currentScenario.planObjects, ...importedPlanObjects],
              updatedAt: "2026-03-18T10:30:00.000Z"
            }
          : currentScenario;

        if (project && scenario) {
          workspacePayload = {
            ...workspacePayload,
            projects: [
              {
                ...project,
                scenarios: [scenario]
              }
            ]
          };
        }

        return new Response(
          JSON.stringify({
            importedCount: importedPlanObjects.length,
            scenario,
            warnings: []
          })
        );
      }

      return new Response(JSON.stringify({ message: `Unhandled ${method} ${url}` }), {
        status: 500
      });
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
  });

  it("shows validation error when required numeric fields are missing in quick mode", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /beräkna klimatpåverkan/i }));

    expect(
      await screen.findByText(/ange en giltig bruttoarea i kvadratmeter/i)
    ).toBeInTheDocument();
  });

  it("runs the quick calculator and renders totals plus source metadata", async () => {
    render(<App />);

    await userEvent.type(screen.getByLabelText(/^Bruttoarea$/i), "1000");
    await userEvent.type(screen.getByLabelText(/^Byggår$/i), "2005");
    await userEvent.click(screen.getByRole("button", { name: /beräkna klimatpåverkan/i }));

    expect(await screen.findByText(/resultat för snabbkalkyl/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /statistikdatabasen/i })).toHaveAttribute(
      "href",
      "https://example.com"
    );
  });

  it("opens the workspace, creates a project and scenario, then shows benchmarked scenario results", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /öppna arbetsyta/i }));
    await userEvent.type(screen.getByPlaceholderText(/ny stadsdel 2040/i), "Ny stadsdel 2040");
    await userEvent.click(screen.getByRole("button", { name: /skapa projekt/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/ny stadsdel 2040/i).length).toBeGreaterThan(0);
    });

    await userEvent.type(screen.getByPlaceholderText(/tät struktur a/i), "Täthet A");
    await userEvent.click(screen.getByRole("button", { name: /skapa scenario/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/täthet a/i).length).toBeGreaterThan(0);
    });

    const areaInputs = screen.getAllByLabelText(/^Bruttoarea$/i);
    const yearInputs = screen.getAllByLabelText(/^Byggår$/i);

    await userEvent.type(areaInputs[0], "1200");
    await userEvent.type(yearInputs[0], "2030");
    await userEvent.click(screen.getByRole("button", { name: /beräkna scenario/i }));
    await userEvent.click(screen.getByRole("button", { name: /beräkna scenario/i }));

    expect(await screen.findByText(/kommunalt scenarioresultat/i)).toBeInTheDocument();
    expect(screen.getByText(/benchmarkstatus och referenser/i)).toBeInTheDocument();
    expect(screen.getByText(/jämför två sparade körningar/i)).toBeInTheDocument();
    expect(screen.getByText(/trend och fördelning/i)).toBeInTheDocument();
    expect(screen.getByText(/geojson \+ glb\/gltf med klickbar klimat-attribution/i)).toBeInTheDocument();
    expect(screen.getAllByText(/normal/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/minska stommens klimatavtryck/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /visa analys/i }));
    expect(await screen.findByText(/separat analysvy/i)).toBeInTheDocument();
  });

  it("lets the user draft and import multiple buildings from the table editor", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /öppna arbetsyta/i }));
    await userEvent.type(screen.getByPlaceholderText(/ny stadsdel 2040/i), "Tabellprojekt");
    await userEvent.click(screen.getByRole("button", { name: /skapa projekt/i }));
    await userEvent.type(screen.getByPlaceholderText(/tät struktur a/i), "Tabellscenario");
    await userEvent.click(screen.getByRole("button", { name: /skapa scenario/i }));

    await screen.findByText(/flera byggnader i samma scenario/i);
    await userEvent.click(screen.getByRole("button", { name: /duplicera första/i }));
    await userEvent.click(screen.getByRole("button", { name: /importera till scenario/i }));

    expect(await screen.findByText("Tabellscenario 1", { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/kopia/i)).toBeInTheDocument();
    expect(screen.getByText(/planobjektläge/i)).toBeInTheDocument();
  });

  it("renders a multi-scenario comparison board with benchmark toggles", async () => {
    workspacePayload = {
      ...workspacePayload,
      projects: [
        {
          id: "project-compare",
          organizationId: "stockholm-stad",
          name: "Jämförelseprojekt",
          createdAt: "2026-03-18T00:00:00.000Z",
          updatedAt: "2026-03-18T00:00:00.000Z",
          scenarios: [
            {
              id: "scenario-a",
              projectId: "project-compare",
              name: "Variant A",
              mode: "quick",
              planObjects: [],
              runs: [
                createRun(
                  "run-a1",
                  "scenario-a",
                  createResult({
                    totals: {
                      label: "Totalt klimatutsläpp",
                      value: 520000,
                      unit: "kg CO2e",
                      traceKey: "totals"
                    },
                    perM2: {
                      label: "Klimatutsläpp per m2",
                      value: 520,
                      unit: "kg CO2e/m2",
                      traceKey: "perM2"
                    }
                  }),
                  "2026-03-18T08:00:00.000Z",
                  {
                    buildingType: "kontor",
                    interventionType: "nybyggnad"
                  }
                ),
                createRun(
                  "run-a2",
                  "scenario-a",
                  createResult(),
                  "2026-03-18T09:00:00.000Z",
                  {
                    buildingType: "kontor",
                    interventionType: "nybyggnad"
                  }
                )
              ],
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
              lastCalculatedAt: "2026-03-18T09:00:00.000Z",
              latestResult: createResult()
            },
            {
              id: "scenario-b",
              projectId: "project-compare",
              name: "Variant B",
              mode: "quick",
              planObjects: [],
              runs: [
                createRun(
                  "run-b1",
                  "scenario-b",
                  createResult({
                    totals: {
                      label: "Totalt klimatutsläpp",
                      value: 460000,
                      unit: "kg CO2e",
                      traceKey: "totals"
                    },
                    perM2: {
                      label: "Klimatutsläpp per m2",
                      value: 460,
                      unit: "kg CO2e/m2",
                      traceKey: "perM2"
                    }
                  }),
                  "2026-03-18T09:30:00.000Z",
                  {
                    buildingType: "kontor",
                    interventionType: "nybyggnad"
                  }
                )
              ],
              createdAt: "2026-03-18T00:00:00.000Z",
              updatedAt: "2026-03-18T00:00:00.000Z",
              lastCalculatedAt: "2026-03-18T09:30:00.000Z",
              latestResult: createResult({
                totals: {
                  label: "Totalt klimatutsläpp",
                  value: 460000,
                  unit: "kg CO2e",
                  traceKey: "totals"
                },
                perM2: {
                  label: "Klimatutsläpp per m2",
                  value: 460,
                  unit: "kg CO2e/m2",
                  traceKey: "perM2"
                }
              })
            }
          ]
        }
      ]
    };

    render(<App />);

    expect(
      await screen.findByText(/flera varianter mot flera benchmarkprofiler/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/variant a/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/variant b/i).length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole("button", { name: /uppsala kommunprofil 2026/i })[0]);
    await userEvent.click(
      screen.getAllByRole("button", { name: /miljöbyggnad nybyggnad 4.1 silver/i })[0]
    );

    expect(screen.getByText(/uppsala kommunprofil 2026 • normalvärde/i)).toBeInTheDocument();
    expect(screen.getAllByText(/miljöbyggnad nybyggnad 4.1 silver/i).length).toBeGreaterThan(0);
  });
});
