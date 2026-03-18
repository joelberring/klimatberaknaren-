import { randomUUID } from "node:crypto";

import {
  type BenchmarkProfile,
  type CreateProjectRequest,
  type CreateScenarioRequest,
  type CreateSessionRequest,
  type Organization,
  type PlanObject,
  type Project,
  type Scenario,
  type TargetProfile,
  type UserSession,
  type WorkspaceResponse
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
    loadProjects(),
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
  const projects = await loadProjects();
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

export async function listProjects(organizationId?: string) {
  const projects = await loadProjects();
  return organizationId
    ? projects.filter((project) => project.organizationId === organizationId)
    : projects;
}

export async function getProject(projectId: string) {
  const projects = await loadProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function getScenario(scenarioId: string) {
  const projects = await loadProjects();
  return findScenario(projects, scenarioId);
}

export async function createScenario(projectId: string, payload: CreateScenarioRequest) {
  const projects = await loadProjects();
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
    createdAt: timestamp,
    updatedAt: timestamp
  };

  project.scenarios.push(scenario);
  project.updatedAt = timestamp;
  await saveProjects(projects);
  return scenario;
}

export async function duplicateScenario(projectId: string, scenarioId: string, name?: string) {
  const projects = await loadProjects();
  const project = projects.find((entry) => entry.id === projectId);
  const baseScenario = project?.scenarios.find((scenario) => scenario.id === scenarioId);

  if (!project || !baseScenario) {
    throw new Error("Scenariot hittades inte");
  }

  const timestamp = new Date().toISOString();
  const clone: Scenario = {
    ...structuredClone(baseScenario),
    id: createId("scenario"),
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
  const projects = await loadProjects();
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
  const projects = await loadProjects();
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

export async function saveScenarioResult(scenarioId: string, result: Scenario["latestResult"]) {
  const projects = await loadProjects();
  const match = findScenario(projects, scenarioId);

  if (!match) {
    throw new Error("Scenariot hittades inte");
  }

  match.scenario.latestResult = result;
  match.scenario.lastCalculatedAt = new Date().toISOString();
  match.scenario.updatedAt = match.scenario.lastCalculatedAt;
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
