const baseUrl = process.env.PREVIEW_URL ?? process.env.VERCEL_URL;

if (!baseUrl) {
  console.error("Set PREVIEW_URL or VERCEL_URL before running the smoke test.");
  process.exit(1);
}

const origin = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

async function parseJson(response) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
  }

  return body;
}

const health = await parseJson(await fetch(`${origin}/api/health`));
const calculation = await parseJson(
  await fetch(`${origin}/api/calculate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      buildingType: "kontor",
      grossFloorAreaM2: 1000,
      buildYear: 2030,
      frameMaterial: "tra",
      energyStandard: "modern",
      heatingType: "fjarrvarme"
    })
  })
);

console.log(
  JSON.stringify(
    {
      health,
      totals: calculation.totals,
      persistence: health.persistence
    },
    null,
    2
  )
);
