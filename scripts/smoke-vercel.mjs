const baseUrl = process.env.PREVIEW_URL ?? process.env.VERCEL_URL;

if (!baseUrl) {
  console.error("Set PREVIEW_URL or VERCEL_URL before running the smoke test.");
  process.exit(1);
}

const origin = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

async function requestJson(path, init) {
  const response = await fetch(`${origin}${path}`, init);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
  }

  return { response, body };
}

const health = (await requestJson("/api/health")).body;
const loginResponse = await requestJson("/api/session/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: "planerare@stockholm.se",
    organizationId: "stockholm-stad"
  })
});
const cookieHeader = loginResponse.response.headers.get("set-cookie")?.split(";")[0] ?? "";
const authHeaders = cookieHeader ? { Cookie: cookieHeader } : {};

const workspace = (await requestJson("/api/workspace", { headers: authHeaders })).body;

const project = (
  await requestJson("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify({
      organizationId: "stockholm-stad",
      name: "Vercel smoke project"
    })
  })
).body;

const workspaceAfterProject = (
  await requestJson("/api/workspace", { headers: authHeaders })
).body;

if (!workspaceAfterProject.projects?.some((entry) => entry.id === project.id)) {
  throw new Error("Created project did not persist to workspace.");
}

const scenario = (
  await requestJson(`/api/project-scenarios?projectId=${encodeURIComponent(project.id)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify({
      name: "Smoke scenario",
      mode: "quick",
      quickInput: {
        buildingType: "kontor",
        grossFloorAreaM2: 1000,
        buildYear: 2030,
        frameMaterial: "betong",
        energyStandard: "normal",
        heatingType: "fjarrvarme"
      }
    })
  })
).body;

const calculation = (
  await requestJson(`/api/scenario-calculate?scenarioId=${encodeURIComponent(scenario.id)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify({
      quickInput: {
        buildingType: "kontor",
        grossFloorAreaM2: 1000,
        buildYear: 2030,
        frameMaterial: "tra",
        energyStandard: "modern",
        heatingType: "fjarrvarme"
      }
    })
  })
).body;

const importResponse = (
  await requestJson(`/api/scenario-import-tabular?scenarioId=${encodeURIComponent(scenario.id)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify({
      format: "json",
      rows: [
        {
          id: "smoke-building-1",
          name: "Smoke byggnad 1",
          buildingType: "kontor",
          grossFloorAreaM2: 1000,
          buildYear: 2030,
          frameMaterial: "betong",
          energyStandard: "normal",
          heatingType: "fjarrvarme"
        }
      ]
    })
  })
).body;

const deletedScenario = (
  await requestJson(
    `/api/scenario-delete?projectId=${encodeURIComponent(project.id)}&scenarioId=${encodeURIComponent(scenario.id)}`,
    {
      method: "DELETE",
      headers: authHeaders
    }
  )
).body;

const deletedProject = (
  await requestJson(`/api/project-delete?projectId=${encodeURIComponent(project.id)}`, {
    method: "DELETE",
    headers: authHeaders
  })
).body;

const workspaceAfterCleanup = (await requestJson("/api/workspace", { headers: authHeaders })).body;

if (workspaceAfterCleanup.projects?.some((entry) => entry.id === project.id)) {
  throw new Error("Project still exists after cleanup.");
}

console.log(
  JSON.stringify(
    {
      health,
      login: loginResponse.body,
      workspaceSession: workspace.session,
      workspaceAfterProject: workspaceAfterProject.projects?.length ?? null,
      project: project.id,
      scenario: scenario.id,
      importResponse: importResponse.importedCount,
      deletedScenario: deletedScenario.id,
      deletedProject: deletedProject.id,
      workspaceAfterCleanup: workspaceAfterCleanup.projects?.length ?? null,
      totals: calculation.totals,
      runCount: calculation.scenario.runs?.length ?? 0,
      persistence: health.persistence
    },
    null,
    2
  )
);
