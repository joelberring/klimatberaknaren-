import type {
  BenchmarkProfile,
  CalculateRequest,
  CalculationResult,
  CreateProjectRequest,
  CreateScenarioRequest,
  CreateSessionRequest,
  DataSourcesResponse,
  Project,
  ScenarioComparison,
  ScenarioImportResponse,
  UserSession,
  WorkspaceResponse
} from "../../../../packages/shared/src";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message ?? "Ett fel uppstod vid API-anropet");
  }

  return response.json() as Promise<T>;
}

function jsonRequest(url: string, body?: unknown, method = "POST") {
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function fetchDataSources() {
  return parseJson<DataSourcesResponse>(
    await fetch("/api/data-sources", { credentials: "same-origin" })
  );
}

export async function fetchWorkspace(organizationId?: string) {
  const suffix = organizationId ? `?organizationId=${organizationId}` : "";
  return parseJson<WorkspaceResponse>(
    await fetch(`/api/workspace${suffix}`, { credentials: "same-origin" })
  );
}

export async function loginSession(payload: CreateSessionRequest) {
  return parseJson<UserSession>(await jsonRequest("/api/session/login", payload));
}

export async function createProjectApi(payload: CreateProjectRequest) {
  return parseJson<Project>(await jsonRequest("/api/projects", payload));
}

export async function createScenarioApi(projectId: string, payload: CreateScenarioRequest) {
  return parseJson<Project["scenarios"][number]>(
    await jsonRequest(`/api/projects/${projectId}/scenarios`, payload)
  );
}

export async function duplicateScenarioApi(projectId: string, scenarioId: string, name?: string) {
  return parseJson<Project["scenarios"][number]>(
    await jsonRequest(`/api/projects/${projectId}/scenarios/${scenarioId}/duplicate`, { name })
  );
}

export async function calculateClimateImpact(payload: CalculateRequest) {
  return parseJson<CalculationResult>(await jsonRequest("/api/calculate", payload));
}

export async function calculateScenarioApi(scenarioId: string, quickInput?: CalculateRequest) {
  return parseJson<{ scenario: Project["scenarios"][number]; result: CalculationResult }>(
    await jsonRequest(`/api/scenarios/${scenarioId}/calculate`, {
      quickInput
    })
  );
}

export async function compareScenariosApi(
  projectId: string,
  baseScenarioId: string,
  candidateScenarioId: string
) {
  return parseJson<ScenarioComparison>(
    await fetch(`/api/projects/${projectId}/compare?base=${baseScenarioId}&candidate=${candidateScenarioId}`, {
      credentials: "same-origin"
    })
  );
}

export async function importGeoJsonApi(scenarioId: string, geojson: unknown) {
  return parseJson<ScenarioImportResponse>(
    await jsonRequest(`/api/scenarios/${scenarioId}/imports/geojson`, {
      geojson
    })
  );
}

export async function importTabularApi(
  scenarioId: string,
  payload: { format: "csv" | "json"; content?: string; rows?: Array<Record<string, string | number>> }
) {
  return parseJson<ScenarioImportResponse>(
    await jsonRequest(`/api/scenarios/${scenarioId}/imports/tabular`, payload)
  );
}

export async function fetchBenchmarkProfiles(organizationId: string) {
  return parseJson<BenchmarkProfile[]>(
    await fetch(`/api/benchmark-profiles/${organizationId}`, {
      credentials: "same-origin"
    })
  );
}
