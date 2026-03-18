import fs from "node:fs";
import path from "node:path";

import { buildScbDatasetManifestEntry, normalizeScbEnergyDataset } from "../src/services/scbNormalizer";

const rawInputPath = path.resolve(process.cwd(), "apps/api/data/raw/scb-energy-stockholm.json");
const outputPath = path.resolve(process.cwd(), "apps/api/data/reference/scb-energy-normalized.json");
const manifestPath = path.resolve(process.cwd(), "apps/api/data/reference/scb-refresh-manifest.json");

function run() {
  const raw = JSON.parse(fs.readFileSync(rawInputPath, "utf-8"));
  const normalized = normalizeScbEnergyDataset(raw);

  fs.writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`);
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), dataset: buildScbDatasetManifestEntry(normalized.updatedAt) }, null, 2)}\n`
  );

  console.log(`Skrev normaliserad SCB-data till ${outputPath}`);
}

run();

