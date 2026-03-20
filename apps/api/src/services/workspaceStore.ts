import { randomUUID } from "node:crypto";

import {
  type BenchmarkProfile,
  type CalculateRequest,
  type CreateProjectRequest,
  type CreateScenarioRequest,
  type CreateSessionRequest,
  type BuildingModel3D,
  type Organization,
  type PlanObject,
  type Project,
  type Scenario,
  type TargetProfile,
  type UserSession,
  type WorkspaceResponse,
  normalizeUrbanContext
} from "../../../../packages/shared/src";
import {
  getPersistenceMode,
  loadProjects,
  loadSession,
  resetPersistence,
  saveProjects,
  saveSession
} from "../lib/persistence";

const organizations: Organization[] = [
  {
    id: "stockholm-stad",
    name: "Stockholms stad",
    audience: "kommun",
    region: "Stockholm"
  },
  {
    id: "uppsala-kommun",
    name: "Uppsala kommun",
    audience: "kommun",
    region: "Uppsala"
  }
];

const benchmarkProfiles: BenchmarkProfile[] = [
  {
    id: "benchmark-stockholm-2026",
    organizationId: "stockholm-stad",
    name: "Stockholm kommunprofil 2026",
    sourceLabel: "Kommunal pilotprofil baserad på bundlade referensdata",
    version: "2026.1",
    updatedAt: "2026-03-01",
    applicability: "Tidiga kommunala jämförelser för Stockholm",
    normalPerM2KgCo2e: 680,
    targetPerM2KgCo2e: 520,
    normalPerPersonKgCo2e: 25500,
    targetPerPersonKgCo2e: 19000,
    normalPerHaKgCo2e: 6500000,
    targetPerHaKgCo2e: 5200000,
    defaultBtaPerResidentM2: 43,
    defaultBtaPerWorkerM2: 20,
    heatingFactorOverrides: {
      fjarrvarme: 0.058
    },
    districtHeatingTargetKgCo2ePerKwh: 0.04,
    notes: [
      "Profilen används som fallback för normalvärden och målvärden.",
      "Fjärrvärmefaktorn är justerad för Stockholmsspecifika antaganden."
    ]
  },
  {
    id: "benchmark-uppsala-2026",
    organizationId: "uppsala-kommun",
    name: "Uppsala kommunprofil 2026",
    sourceLabel: "Kommunal pilotprofil baserad på bundlade referensdata",
    version: "2026.1",
    updatedAt: "2026-03-01",
    applicability: "Tidiga kommunala jämförelser för Uppsala",
    normalPerM2KgCo2e: 650,
    targetPerM2KgCo2e: 500,
    normalPerPersonKgCo2e: 24500,
    targetPerPersonKgCo2e: 18500,
    normalPerHaKgCo2e: 6100000,
    targetPerHaKgCo2e: 5000000,
    defaultBtaPerResidentM2: 43,
    defaultBtaPerWorkerM2: 20,
    notes: ["Alternativ profil för jämförelser i Mälardalen."]
  }
];

const targetProfiles: TargetProfile[] = [
  {
    id: "target-stockholm-2030",
    organizationId: "stockholm-stad",
    name: "Stockholm målkurva 2030",
    targetYear: 2030,
    targetPerM2KgCo2e: 520,
    targetPerPersonKgCo2e: 19000,
    targetPerHaKgCo2e: 5200000,
    notes: ["Används för att visa gap till målvärde i resultatpanelen."]
  },
  {
    id: "target-uppsala-2030",
    organizationId: "uppsala-kommun",
    name: "Uppsala målkurva 2030",
    targetYear: 2030,
    targetPerM2KgCo2e: 500,
    targetPerPersonKgCo2e: 18500,
    targetPerHaKgCo2e: 5000000,
    notes: ["Exempelprofil för kommunjämförelser."]
  }
];

function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function normalizeScenario(scenario: Scenario): Scenario {
  let changed = false;

  const normalizeInput = (input?: CalculateRequest) => {
    if (!input) {
      return input;
    }

    const urbanContext = normalizeUrbanContext(input.urbanContext);
    if (urbanContext === input.urbanContext) {
      return input;
    }

    changed = true;
    return {
      ...input,
      urbanContext
    };
  };

  const quickInput = normalizeInput(scenario.quickInput);
  if (quickInput !== scenario.quickInput) {
    changed = true;
  }

  const planObjects = scenario.planObjects.map((planObject) => {
    const normalizedQuickInput = normalizeInput(planObject.quickInput) ?? planObject.quickInput;

    if (normalizedQuickInput === planObject.quickInput) {
      return planObject;
    }

    changed = true;
    return {
      ...planObject,
      quickInput: normalizedQuickInput
    };
  });

  const runs = (scenario.runs ?? []).map((run) => {
    const normalizedInputSnapshot = normalizeInput(run.inputSnapshot) ?? run.inputSnapshot;

    if (normalizedInputSnapshot === run.inputSnapshot) {
      return run;
    }

    changed = true;
    return {
      ...run,
      inputSnapshot: normalizedInputSnapshot
    };
  });

  if (!changed && runs.length > 0) {
    return {
      ...scenario,
      runs
    };
  }

  if (!changed && !scenario.latestResult) {
    return {
      ...scenario,
      runs
    };
  }

  if (!changed) {
    return {
      ...scenario,
      runs
    };
  }

  if (runs.length > 0) {
    return {
      ...scenario,
      quickInput,
      planObjects,
      runs
    };
  }

  if (!scenario.latestResult) {
    return {
      ...scenario,
      quickInput,
      planObjects,
      runs: []
    };
  }

  return {
    ...scenario,
    quickInput,
    planObjects,
    runs: [
      {
        id: `run-legacy-${scenario.id}`,
        scenarioId: scenario.id,
        createdAt: scenario.lastCalculatedAt ?? scenario.updatedAt ?? scenario.createdAt,
        result: scenario.latestResult,
        inputSnapshot: quickInput
      }
    ]
  };
}

async function loadNormalizedProjects() {
  const projects = await loadProjects();
  let changed = false;

  const normalizedProjects = projects.map((project) => {
    let projectChanged = false;
    const scenarios = project.scenarios.map((scenario) => {
      const normalizedScenario = normalizeScenario(scenario);
      if (normalizedScenario !== scenario) {
        projectChanged = true;
      }

      return normalizedScenario;
    });

    if (!projectChanged) {
      return project;
    }

    changed = true;
    return {
      ...project,
      scenarios
    };
  });

  if (changed) {
    await saveProjects(normalizedProjects);
  }

  return normalizedProjects;
}

function getFilteredProfiles<T extends { organizationId: string }>(
  profiles: T[],
  organizationId?: string
) {
  return organizationId
    ? profiles.filter((profile) => profile.organizationId === organizationId)
    : profiles;
}

function findScenario(projects: Project[], scenarioId: string) {
  for (const project of projects) {
    const scenario = project.scenarios.find((entry) => entry.id === scenarioId);
    if (scenario) {
      return { project, scenario };
    }
  }

  return null;
}

export function getOrganizations() {
  return organizations;
}

export function getPersistenceInfo() {
  return {
    mode: getPersistenceMode()
  };
}

export async function getWorkspace(organizationId?: string, sessionId?: string): Promise<WorkspaceResponse> {
  const [projects, session] = await Promise.all([
    loadNormalizedProjects(),
    sessionId ? loadSession(sessionId) : Promise.resolve(null)
  ]);

  const scopedOrganizationId = organizationId ?? session?.organizationId;

  return {
    session,
    organizations,
    projects: scopedOrganizationId
      ? projects.filter((project) => project.organizationId === scopedOrganizationId)
      : projects,
    benchmarkProfiles: getFilteredProfiles(benchmarkProfiles, scopedOrganizationId),
    targetProfiles: getFilteredProfiles(targetProfiles, scopedOrganizationId)
  };
}

export async function createSession(payload: CreateSessionRequest, sessionId: string) {
  const organization = organizations.find((entry) => entry.id === payload.organizationId);

  if (!organization) {
    throw new Error("Okänd organisation");
  }

  const session: UserSession = {
    email: payload.email,
    organizationId: organization.id,
    organizationName: organization.name
  };

  await saveSession(sessionId, session);
  return session;
}

export async function createProject(payload: CreateProjectRequest) {
  const projects = await loadNormalizedProjects();
  const timestamp = new Date().toISOString();
  const project: Project = {
    id: createId("project"),
    organizationId: payload.organizationId,
    name: payload.name,
    description: payload.description,
    scenarios: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  projects.unshift(project);
  await saveProjects(projects);
  return project;
}

export async function deleteProject(projectId: string) {
  const projects = await loadNormalizedProjects();
  const index = projects.findIndex((entry) => entry.id === projectId);

  if (index === -1) {
    throw new Error("Projektet hittades inte");
  }

  const [removedProject] = projects.splice(index, 1);
  await saveProjects(projects);
  return removedProject;
}

export async function listProjects(organizationId?: string) {
  const projects = await loadNormalizedProjects();
  return organizationId
    ? projects.filter((project) => project.organizationId === organizationId)
    : projects;
}

export async function getProject(projectId: string) {
  const projects = await loadNormalizedProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function getScenario(scenarioId: string) {
  const projects = await loadNormalizedProjects();
  return findScenario(projects, scenarioId);
}

export async function createScenario(projectId: string, payload: CreateScenarioRequest) {
  const projects = await loadNormalizedProjects();
  const project = projects.find((entry) => entry.id === projectId);

  if (!project) {
    throw new Error("Projektet hittades inte");
  }

  const timestamp = new Date().toISOString();
  const scenario: Scenario = {
    id: createId("scenario"),
    projectId,
    name: payload.name,
    description: payload.description,
    mode: payload.mode ?? "quick",
    quickInput: payload.quickInput,
    planObjects: [],
    runs: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  project.scenarios.push(scenario);
  project.updatedAt = timestamp;
  await saveProjects(projects);
  return scenario;
}

export async function deleteScenario(projectId: string, scenarioId: string) {
  const projects = await loadNormalizedProjects();
  const project = projects.find((entry) => entry.id === projectId);

  if (!project) {
    throw new Error("Projektet hittades inte");
  }

  const index = project.scenarios.findIndex((scenario) => scenario.id === scenarioId);

  if (index === -1) {
    throw new Error("Scenariot hittades inte");
  }

  const [removedScenario] = project.scenarios.splice(index, 1);
  project.updatedAt = new Date().toISOString();
  await saveProjects(projects);
  return removedScenario;
}

export async function duplicateScenario(projectId: string, scenarioId: string, name?: string) {
  const projects = await loadNormalizedProjects();
  const project = projects.find((entry) => entry.id === projectId);
  const baseScenario = project?.scenarios.find((scenario) => scenario.id === scenarioId);

  if (!project || !baseScenario) {
    throw new Error("Scenariot hittades inte");
  }

  const timestamp = new Date().toISOString();
  const scenarioCloneId = createId("scenario");
  const clone: Scenario = {
    ...structuredClone(baseScenario),
    id: scenarioCloneId,
    runs: baseScenario.runs.map((run) => ({
      ...structuredClone(run),
      id: createId("run"),
      scenarioId: scenarioCloneId
    })),
    name: name ?? `${baseScenario.name} kopia`,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  project.scenarios.push(clone);
  project.updatedAt = timestamp;
  await saveProjects(projects);
  return clone;
}

export async function updateScenarioQuickInput(
  scenarioId: string,
  quickInput: Scenario["quickInput"]
) {
  const projects = await loadNormalizedProjects();
  const match = findScenario(projects, scenarioId);

  if (!match) {
    throw new Error("Scenariot hittades inte");
  }

  match.scenario.quickInput = quickInput;
  match.scenario.updatedAt = new Date().toISOString();
  await saveProjects(projects);
  return match.scenario;
}

export async function appendScenarioPlanObjects(scenarioId: string, planObjects: PlanObject[]) {
  const projects = await loadNormalizedProjects();
  const match = findScenario(projects, scenarioId);

  if (!match) {
    throw new Error("Scenariot hittades inte");
  }

  match.scenario.mode = "plan";
  match.scenario.planObjects = [...match.scenario.planObjects, ...planObjects];
  match.scenario.updatedAt = new Date().toISOString();
  await saveProjects(projects);
  return match.scenario;
}

export async function saveScenarioResult(
  scenarioId: string,
  result: Scenario["latestResult"],
  inputSnapshot?: CalculateRequest
) {
  const projects = await loadNormalizedProjects();
  const match = findScenario(projects, scenarioId);

  if (!match) {
    throw new Error("Scenariot hittades inte");
  }

  const timestamp = new Date().toISOString();
  if (result) {
    match.scenario.runs.push({
      id: createId("run"),
      scenarioId,
      createdAt: timestamp,
      result,
      inputSnapshot:
        inputSnapshot ?? (match.scenario.mode === "quick" ? match.scenario.quickInput : undefined)
    });
  }

  match.scenario.latestResult = result;
  match.scenario.lastCalculatedAt = timestamp;
  match.scenario.updatedAt = timestamp;
  await saveProjects(projects);
  return match.scenario;
}

export async function saveScenarioModel3D(scenarioId: string, model: BuildingModel3D) {
  const projects = await loadNormalizedProjects();
  const match = findScenario(projects, scenarioId);

  if (!match) {
    throw new Error("Scenariot hittades inte");
  }

  match.scenario.buildingModel3D = model;
  match.scenario.updatedAt = new Date().toISOString();
  await saveProjects(projects);
  return match.scenario;
}

export function getBenchmarkProfile(organizationId: string) {
  return benchmarkProfiles.find((profile) => profile.organizationId === organizationId);
}

export function getTargetProfile(organizationId: string) {
  return targetProfiles.find((profile) => profile.organizationId === organizationId);
}

export function getBenchmarkProfilesForOrganization(organizationId: string) {
  return benchmarkProfiles.filter((profile) => profile.organizationId === organizationId);
}

export async function resetWorkspaceStore() {
  await resetPersistence();
}
