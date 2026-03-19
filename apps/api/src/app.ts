import { randomUUID } from "node:crypto";

import cors from "cors";
import express from "express";
import { ZodError } from "zod";

import type { BuildingModel3D, GeoJsonGeometry } from "../../../packages/shared/src";
import { getBoverketAdapterStatus } from "./adapters/boverket";
import { calculateSchema } from "./schemas/calculateSchema";
import {
  duplicateScenarioSchema,
  geoJsonImportSchema,
  projectSchema,
  model3dImportSchema,
  scenarioCalculationSchema,
  scenarioSchema,
  sessionSchema,
  tabularImportSchema
} from "./schemas/workspaceSchemas";
import { importGeoJsonFeatures, importTabularRows } from "./services/imports";
import { calculateClimateImpact } from "./services/calculator";
import { getDataSourcesResponse } from "./services/dataSources";
import { calculateScenarioResult, compareScenarios } from "./services/scenarioEngine";
import {
  appendScenarioPlanObjects,
  createProject,
  deleteProject,
  createScenario,
  deleteScenario,
  createSession,
  duplicateScenario,
  getBenchmarkProfile,
  getBenchmarkProfilesForOrganization,
  getProject,
  getScenario,
  getTargetProfile,
  getPersistenceInfo,
  getWorkspace,
  listProjects,
  saveScenarioResult,
  saveScenarioModel3D,
  updateScenarioQuickInput
} from "./services/workspaceStore";

const PILOT_SESSION_COOKIE = "pilot_session_id";

function routeGuard(handler: express.Handler): express.Handler {
  return (request, response, next) => {
    try {
      Promise.resolve(handler(request, response, next)).catch(next);
    } catch (error) {
      next(error);
    }
  };
}

function getStringParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getRouteParam(request: express.Request, key: string) {
  const param = request.params?.[key];
  if (typeof param === "string" && param.length > 0) {
    return param;
  }

  const queryValue = (request.query as Record<string, unknown>)[key];
  if (Array.isArray(queryValue)) {
    return typeof queryValue[0] === "string" ? queryValue[0] : "";
  }

  return typeof queryValue === "string" ? queryValue : "";
}

function getCookieValue(request: express.Request, key: string) {
  const cookieHeader = request.headers?.cookie ?? "";
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`));

  return value ? decodeURIComponent(value.slice(key.length + 1)) : null;
}

function ensurePilotSessionId(request: express.Request, response: express.Response) {
  const existing = getCookieValue(request, PILOT_SESSION_COOKIE);

  if (existing) {
    return existing;
  }

  const sessionId = randomUUID();
  response.setHeader(
    "Set-Cookie",
    `${PILOT_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }; Max-Age=${60 * 60 * 24 * 30}`
  );

  return sessionId;
}

function logWorkspaceMutation(
  action: string,
  details: Record<string, string | number | boolean | null | undefined>
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.info(
    `[api:${action}] ${JSON.stringify({
      ...details,
      persistence: getPersistenceInfo().mode
    })}`
  );
}

export function handleHealthRequest(_request: express.Request, response: express.Response) {
  response.json({
    ok: true,
    boverketAdapterEnabled: getBoverketAdapterStatus(),
    persistence: getPersistenceInfo()
  });
}

export async function handleWorkspaceRequest(request: express.Request, response: express.Response) {
  const organizationId =
    typeof request.query?.organizationId === "string" ? request.query.organizationId : undefined;
  const sessionId = getCookieValue(request, PILOT_SESSION_COOKIE) ?? undefined;
  response.json(await getWorkspace(organizationId, sessionId));
}

export async function handleSessionLogin(request: express.Request, response: express.Response) {
  const payload = sessionSchema.parse(request.body);
  const sessionId = ensurePilotSessionId(request, response);
  response.status(201).json(await createSession(payload, sessionId));
}

export function handleDataSourcesRequest(_request: express.Request, response: express.Response) {
  response.json(getDataSourcesResponse());
}

export async function handleCalculateRequest(request: express.Request, response: express.Response) {
  const payload = calculateSchema.parse(request.body);
  const sessionId = getCookieValue(request, PILOT_SESSION_COOKIE) ?? undefined;
  const workspace = await getWorkspace(undefined, sessionId);
  const benchmarkProfile = workspace.session
    ? getBenchmarkProfile(workspace.session.organizationId)
    : undefined;
  const targetProfile = workspace.session
    ? getTargetProfile(workspace.session.organizationId)
    : undefined;

  response.json(
    calculateClimateImpact(payload, {
      benchmarkProfile,
      targetProfile
    })
  );
}

export async function handleProjectsListRequest(
  request: express.Request,
  response: express.Response
) {
  const organizationId =
    typeof request.query?.organizationId === "string" ? request.query.organizationId : undefined;
  response.json(await listProjects(organizationId));
}

export async function handleProjectCreateRequest(
  request: express.Request,
  response: express.Response
) {
  const payload = projectSchema.parse(request.body);
  const project = await createProject(payload);
  logWorkspaceMutation("project:create", {
    organizationId: payload.organizationId,
    projectId: project.id
  });
  response.status(201).json(project);
}

export async function handleProjectDeleteRequest(
  request: express.Request,
  response: express.Response
) {
  const project = await deleteProject(getRouteParam(request, "projectId"));
  logWorkspaceMutation("project:delete", {
    projectId: project.id,
    organizationId: project.organizationId
  });
  response.json(project);
}

export async function handleProjectDetailRequest(
  request: express.Request,
  response: express.Response
) {
  const project = await getProject(getRouteParam(request, "projectId"));

  if (!project) {
    throw new Error("Projektet hittades inte");
  }

  response.json(project);
}

export async function handleScenarioCreateRequest(
  request: express.Request,
  response: express.Response
) {
  const payload = scenarioSchema.parse(request.body);
  const projectId = getRouteParam(request, "projectId");
  const scenario = await createScenario(projectId, payload);
  const project = await getProject(projectId);
  logWorkspaceMutation("scenario:create", {
    projectId,
    scenarioId: scenario.id,
    organizationId: project?.organizationId ?? null
  });
  response.status(201).json(scenario);
}

export async function handleScenarioDeleteRequest(
  request: express.Request,
  response: express.Response
) {
  const projectId = getRouteParam(request, "projectId");
  const scenarioId = getRouteParam(request, "scenarioId");
  const removedScenario = await deleteScenario(projectId, scenarioId);
  const project = await getProject(projectId);
  logWorkspaceMutation("scenario:delete", {
    projectId,
    scenarioId,
    organizationId: project?.organizationId ?? null
  });
  response.json(removedScenario);
}

export async function handleScenarioDuplicateRequest(
  request: express.Request,
  response: express.Response
) {
  const payload = duplicateScenarioSchema.parse(request.body);
  const projectId = getRouteParam(request, "projectId");
  const scenarioId = getRouteParam(request, "scenarioId");
  response
    .status(201)
    .json(
      await duplicateScenario(
        projectId,
        scenarioId,
        payload.name
      )
    );
}

export async function handleScenarioCalculateRequest(
  request: express.Request,
  response: express.Response
) {
  const payload = scenarioCalculationSchema.parse(request.body);
  const scenarioId = getRouteParam(request, "scenarioId");
  const match = await getScenario(scenarioId);

  if (!match) {
    throw new Error("Scenariot hittades inte");
  }

  if (payload.quickInput) {
    await updateScenarioQuickInput(match.scenario.id, payload.quickInput);
    match.scenario.quickInput = payload.quickInput;
  }

  const benchmarkProfile = getBenchmarkProfile(match.project.organizationId);
  const targetProfile = getTargetProfile(match.project.organizationId);
  const result = calculateScenarioResult(match.scenario, benchmarkProfile, targetProfile);
  const scenario = await saveScenarioResult(match.scenario.id, result, payload.quickInput);
  logWorkspaceMutation("scenario:calculate", {
    projectId: match.project.id,
    scenarioId,
    organizationId: match.project.organizationId
  });

  response.json({
    scenario,
    result
  });
}

export async function handleScenarioResultRequest(
  request: express.Request,
  response: express.Response
) {
  const match = await getScenario(getRouteParam(request, "scenarioId"));

  if (!match) {
    throw new Error("Scenariot hittades inte");
  }

  response.json(match.scenario.latestResult ?? null);
}

export async function handleScenarioGeoJsonImportRequest(
  request: express.Request,
  response: express.Response
) {
  const payload = geoJsonImportSchema.parse(request.body);
  const scenarioId = getRouteParam(request, "scenarioId");
  const features = payload.geojson.features as Array<{
    properties: Record<string, unknown>;
    geometry: GeoJsonGeometry | null;
  }>;
  const { planObjects, warnings } = importGeoJsonFeatures(features);
  const scenario = await appendScenarioPlanObjects(
    scenarioId,
    planObjects
  );
  const match = await getScenario(scenarioId);
  logWorkspaceMutation("scenario:import:geojson", {
    projectId: match?.project.id ?? null,
    scenarioId,
    organizationId: match?.project.organizationId ?? null,
    importedCount: planObjects.length
  });

  response.status(201).json({
    importedCount: planObjects.length,
    scenario,
    warnings
  });
}

export async function handleScenarioTabularImportRequest(
  request: express.Request,
  response: express.Response
) {
  const payload = tabularImportSchema.parse(request.body);
  const scenarioId = getRouteParam(request, "scenarioId");
  const { planObjects, warnings } = importTabularRows(payload);
  const scenario = await appendScenarioPlanObjects(scenarioId, planObjects);
  const match = await getScenario(scenarioId);
  logWorkspaceMutation("scenario:import:tabular", {
    projectId: match?.project.id ?? null,
    scenarioId,
    organizationId: match?.project.organizationId ?? null,
    importedCount: planObjects.length
  });

  response.status(201).json({
    importedCount: planObjects.length,
    scenario,
    warnings
  });
}

export async function handleScenarioModel3DImportRequest(
  request: express.Request,
  response: express.Response
) {
  const payload = model3dImportSchema.parse(request.body);
  const scenarioId = getRouteParam(request, "scenarioId");
  const model: BuildingModel3D = {
    ...payload.model,
    importedAt: payload.model.importedAt ?? new Date().toISOString(),
    footprint: payload.model.footprint ? (payload.model.footprint as GeoJsonGeometry) : undefined
  };
  const scenario = await saveScenarioModel3D(scenarioId, model);
  const match = await getScenario(scenarioId);
  logWorkspaceMutation("scenario:import:model3d", {
    projectId: match?.project.id ?? null,
    scenarioId,
    organizationId: match?.project.organizationId ?? null,
    importedCount: model.parts.length
  });

  response.status(201).json({
    scenario,
    model
  });
}

export async function handleScenarioCompareRequest(
  request: express.Request,
  response: express.Response
) {
  const project = await getProject(getRouteParam(request, "projectId"));
  const baseScenarioId = String(request.query.base ?? request.body?.base ?? "");
  const candidateScenarioId = String(request.query.candidate ?? request.body?.candidate ?? "");

  if (!project) {
    throw new Error("Projektet hittades inte");
  }

  response.json(compareScenarios(project, baseScenarioId, candidateScenarioId));
}

export function handleBenchmarkProfilesRequest(
  request: express.Request,
  response: express.Response
) {
  response.json(getBenchmarkProfilesForOrganization(getRouteParam(request, "organizationId")));
}

export function handleApiError(
  error: Error,
  _request: express.Request,
  response: express.Response,
  _next: express.NextFunction
) {
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: "Ogiltig indata",
      kind: "validation_error",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  if (error.message.includes("hittades inte")) {
    return response.status(404).json({
      message: error.message,
      kind: "not_found"
    });
  }

  if (error.message) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[api:error]", error.message);
    }

    return response.status(400).json({
      message: error.message,
      kind: "request_error"
    });
  }

  if (process.env.NODE_ENV !== "test") {
    console.error("[api:error]", error);
  }

  return response.status(500).json({
    message: "Ett oväntat fel uppstod",
    kind: "server_error"
  });
}

export function createApp() {
  const app = express();
  const allowedOrigin = process.env.ALLOWED_ORIGIN;

  app.use(
    cors({
      origin: allowedOrigin ? [allowedOrigin] : true,
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use((request, response, next) => {
    const startedAt = Date.now();

    response.on("finish", () => {
      if (process.env.NODE_ENV === "test") {
        return;
      }

      console.info(
        `[api] ${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`
      );
    });

    next();
  });

  app.get("/api/health", handleHealthRequest);
  app.get("/api/workspace", routeGuard(handleWorkspaceRequest));
  app.post("/api/session/login", routeGuard(handleSessionLogin));
  app.get("/api/data-sources", routeGuard(handleDataSourcesRequest));
  app.post("/api/calculate", routeGuard(handleCalculateRequest));
  app.get("/api/projects", routeGuard(handleProjectsListRequest));
  app.post("/api/projects", routeGuard(handleProjectCreateRequest));
  app.get("/api/project-detail", routeGuard(handleProjectDetailRequest));
  app.delete("/api/project-delete", routeGuard(handleProjectDeleteRequest));
  app.post("/api/project-scenarios", routeGuard(handleScenarioCreateRequest));
  app.delete("/api/scenario-delete", routeGuard(handleScenarioDeleteRequest));
  app.post("/api/scenario-duplicate", routeGuard(handleScenarioDuplicateRequest));
  app.post("/api/scenario-calculate", routeGuard(handleScenarioCalculateRequest));
  app.get("/api/scenario-results", routeGuard(handleScenarioResultRequest));
  app.post("/api/scenario-import-geojson", routeGuard(handleScenarioGeoJsonImportRequest));
  app.post("/api/scenario-import-tabular", routeGuard(handleScenarioTabularImportRequest));
  app.post("/api/scenario-import-model3d", routeGuard(handleScenarioModel3DImportRequest));
  app.get("/api/project-compare", routeGuard(handleScenarioCompareRequest));
  app.get("/api/benchmark-profiles", routeGuard(handleBenchmarkProfilesRequest));
  app.delete("/api/projects/:projectId", routeGuard(handleProjectDeleteRequest));
  app.get("/api/projects/:projectId", routeGuard(handleProjectDetailRequest));
  app.post("/api/projects/:projectId/scenarios", routeGuard(handleScenarioCreateRequest));
  app.delete(
    "/api/projects/:projectId/scenarios/:scenarioId",
    routeGuard(handleScenarioDeleteRequest)
  );
  app.post(
    "/api/projects/:projectId/scenarios/:scenarioId/duplicate",
    routeGuard(handleScenarioDuplicateRequest)
  );
  app.post("/api/scenarios/:scenarioId/calculate", routeGuard(handleScenarioCalculateRequest));
  app.get("/api/scenarios/:scenarioId/results", routeGuard(handleScenarioResultRequest));
  app.post(
    "/api/scenarios/:scenarioId/imports/geojson",
    routeGuard(handleScenarioGeoJsonImportRequest)
  );
  app.post(
    "/api/scenarios/:scenarioId/imports/tabular",
    routeGuard(handleScenarioTabularImportRequest)
  );
  app.post(
    "/api/scenarios/:scenarioId/imports/model3d",
    routeGuard(handleScenarioModel3DImportRequest)
  );
  app.get("/api/projects/:projectId/compare", routeGuard(handleScenarioCompareRequest));
  app.get(
    "/api/benchmark-profiles/:organizationId",
    routeGuard(handleBenchmarkProfilesRequest)
  );
  app.use(handleApiError);

  return app;
}
