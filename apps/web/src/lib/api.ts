import type {
  BuildingModel3D,
  BenchmarkProfile,
  CalculateRequest,
  CalculationResult,
  CreateProjectRequest,
  CreateScenarioRequest,
  CreateSessionRequest,
  DataSourcesResponse,
  Project,
  ScenarioImportModel3DResponse,
  ScenarioComparison,
  ScenarioImportResponse,
  UserSession,
  WorkspaceResponse
} from "../../../../packages/shared/src";

export interface ApiHealthResponse {
  ok: boolean;
  boverketAdapterEnabled: boolean;
  persistence: {
    mode: string;
  };
}

export interface ScenarioAccessStatusResponse {
  unlocked: boolean;
}

async function parseJson<T>(response: Response, requestLabel: string): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(async () => {
      const text = await response.text().catch(() => "");
      return text ? { message: text } : {};
    });
    const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
    const message =
      typeof errorBody?.message === "string" && errorBody.message.trim().length
        ? errorBody.message
        : "Ett fel uppstod vid API-anropet";
    const kind = typeof errorBody?.kind === "string" && errorBody.kind.trim().length ? ` [${errorBody.kind}]` : "";
    throw new Error(`${requestLabel} (${status}): ${message}${kind}`);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
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
    await fetch("/api/data-sources", { credentials: "same-origin" }),
    "GET /api/data-sources"
  );
}

export async function fetchHealth() {
  return parseJson<ApiHealthResponse>(
    await fetch("/api/health", { credentials: "same-origin" }),
    "GET /api/health"
  );
}

export async function fetchWorkspace(organizationId?: string) {
  const suffix = organizationId ? `?organizationId=${organizationId}` : "";
  return parseJson<WorkspaceResponse>(
    await fetch(`/api/workspace${suffix}`, { credentials: "same-origin" }),
    "GET /api/workspace"
  );
}

export async function loginSession(payload: CreateSessionRequest) {
  return parseJson<UserSession>(await jsonRequest("/api/session/login", payload), "POST /api/session/login");
}

export async function fetchScenarioAccessStatus() {
  return parseJson<ScenarioAccessStatusResponse>(
    await fetch("/api/scenario-access/status", { credentials: "same-origin" }),
    "GET /api/scenario-access/status"
  );
}

export async function unlockScenarioAccess(payload: { code: string }) {
  return parseJson<void>(await jsonRequest("/api/scenario-access", payload), "POST /api/scenario-access");
}

export async function createProjectApi(payload: CreateProjectRequest) {
  return parseJson<Project>(await jsonRequest("/api/projects", payload), "POST /api/projects");
}

export async function deleteProjectApi(projectId: string) {
  return parseJson<Project>(
    await fetch(`/api/project-delete?projectId=${encodeURIComponent(projectId)}`, {
      method: "DELETE",
      credentials: "same-origin"
    }),
    `DELETE /api/project-delete`
  );
}

export async function createScenarioApi(projectId: string, payload: CreateScenarioRequest) {
  return parseJson<Project["scenarios"][number]>(
    await jsonRequest(`/api/project-scenarios?projectId=${encodeURIComponent(projectId)}`, payload),
    `POST /api/project-scenarios`
  );
}

export async function deleteScenarioApi(projectId: string, scenarioId: string) {
  return parseJson<Project["scenarios"][number]>(
    await fetch(
      `/api/scenario-delete?projectId=${encodeURIComponent(projectId)}&scenarioId=${encodeURIComponent(scenarioId)}`,
      {
        method: "DELETE",
        credentials: "same-origin"
      }
    ),
    `DELETE /api/scenario-delete`
  );
}

export async function duplicateScenarioApi(projectId: string, scenarioId: string, name?: string) {
  return parseJson<Project["scenarios"][number]>(
    await jsonRequest(
      `/api/scenario-duplicate?projectId=${encodeURIComponent(projectId)}&scenarioId=${encodeURIComponent(scenarioId)}`,
      { name }
    ),
    `POST /api/scenario-duplicate`
  );
}

export async function calculateClimateImpact(payload: CalculateRequest) {
  return parseJson<CalculationResult>(await jsonRequest("/api/calculate", payload), "POST /api/calculate");
}

export async function calculateScenarioApi(scenarioId: string, quickInput?: CalculateRequest) {
  return parseJson<{ scenario: Project["scenarios"][number]; result: CalculationResult }>(
    await jsonRequest(`/api/scenario-calculate?scenarioId=${encodeURIComponent(scenarioId)}`, {
      quickInput
    }),
    `POST /api/scenario-calculate`
  );
}

export async function compareScenariosApi(
  projectId: string,
  baseScenarioId: string,
  candidateScenarioId: string
) {
  return parseJson<ScenarioComparison>(
    await fetch(
      `/api/project-compare?projectId=${encodeURIComponent(projectId)}&base=${encodeURIComponent(baseScenarioId)}&candidate=${encodeURIComponent(candidateScenarioId)}`,
      {
      credentials: "same-origin"
      }
    ),
    `GET /api/project-compare`
  );
}

export async function importGeoJsonApi(scenarioId: string, geojson: unknown) {
  return parseJson<ScenarioImportResponse>(
    await jsonRequest(`/api/scenario-import-geojson?scenarioId=${encodeURIComponent(scenarioId)}`, {
      geojson
    }),
    `POST /api/scenario-import-geojson`
  );
}

export async function importTabularApi(
  scenarioId: string,
  payload: { format: "csv" | "json"; content?: string; rows?: Array<Record<string, string | number>> }
) {
  return parseJson<ScenarioImportResponse>(
    await jsonRequest(`/api/scenario-import-tabular?scenarioId=${encodeURIComponent(scenarioId)}`, payload),
    `POST /api/scenario-import-tabular`
  );
}

export async function importModel3DApi(
  scenarioId: string,
  payload: { model: BuildingModel3D }
) {
  return parseJson<ScenarioImportModel3DResponse>(
    await jsonRequest(`/api/scenario-import-model3d?scenarioId=${encodeURIComponent(scenarioId)}`, payload),
    `POST /api/scenario-import-model3d`
  );
}

export async function fetchBenchmarkProfiles(organizationId: string) {
  return parseJson<BenchmarkProfile[]>(
    await fetch(`/api/benchmark-profiles?organizationId=${encodeURIComponent(organizationId)}`, {
      credentials: "same-origin"
    }),
    `GET /api/benchmark-profiles`
  );
}
