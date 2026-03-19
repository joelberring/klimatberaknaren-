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

const scenario = (
  await requestJson(`/api/projects/${project.id}/scenarios`, {
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
  await requestJson(`/api/scenarios/${scenario.id}/calculate`, {
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

console.log(
  JSON.stringify(
    {
      health,
      login: loginResponse.body,
      workspaceSession: workspace.session,
      project: project.id,
      scenario: scenario.id,
      totals: calculation.totals,
      runCount: calculation.scenario.runs?.length ?? 0,
      persistence: health.persistence
    },
    null,
    2
  )
);
