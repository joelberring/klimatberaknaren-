import express from "express";

import { handleApiError, handleScenarioCreateRequest } from "../../../../apps/api/src/app";

function routeGuard(handler: express.Handler): express.Handler {
  return (request, response, next) => {
    try {
      Promise.resolve(handler(request, response, next)).catch(next);
    } catch (error) {
      next(error);
    }
  };
}

function getProjectId(request: express.Request) {
  const fromParams = typeof request.params?.projectId === "string" ? request.params.projectId : "";
  if (fromParams) {
    return fromParams;
  }

  const source = request.originalUrl ?? request.url ?? "";
  const match = source.match(/\/api\/projects\/([^/]+)\/scenarios(?:\?.*)?$/);
  return match?.[1] ?? "";
}

const app = express();

app.use(express.json({ limit: "2mb" }));

app.post(
  ["/", "/api/projects/:projectId/scenarios"],
  (request, _response, next) => {
    request.params = {
      ...(request.params ?? {}),
      projectId: getProjectId(request)
    };
    next();
  },
  routeGuard(handleScenarioCreateRequest)
);

app.use(handleApiError);

export default app;
