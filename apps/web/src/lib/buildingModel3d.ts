import {
  LABELS,
  type BuildingModel3D,
  type BuildingModel3DPart,
  type GeoJsonGeometry,
  type Model3DPartCategory,
  type Model3DSourceFormat
} from "../../../../packages/shared/src";

const CATEGORY_KEYWORDS: Array<{
  category: Model3DPartCategory;
  keywords: string[];
}> = [
  { category: "garage", keywords: ["garage", "parking", "parkering", "p-b", "pgarage"] },
  { category: "grund", keywords: ["grund", "foundation", "footing", "basement", "kallare"] },
  { category: "tak", keywords: ["tak", "roof", "cover", "top"] },
  { category: "fasad", keywords: ["fasad", "facade", "wall", "envelope", "skin"] },
  { category: "stomme", keywords: ["stomme", "frame", "struct", "column", "beam", "core"] },
  {
    category: "installationer",
    keywords: ["hvac", "vent", "installation", "pipe", "duct", "el", "mech"]
  },
  { category: "site", keywords: ["site", "yard", "tomt", "landscape", "terrain"] },
  { category: "volym", keywords: [] }
];

const TRACE_KEY_LOOKUP: Record<Model3DPartCategory, string> = {
  volym: "embodied.total",
  stomme: "embodied.frame",
  fasad: "embodied.envelope",
  tak: "embodied.envelope",
  grund: "site.foundation",
  garage: "site.parking",
  installationer: "operational.systems",
  site: "site.context"
};

function capitalizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)\p{L}/gu, (match) => match.toUpperCase());
}

function stableId(prefix: string, value: string, index: number) {
  return `${prefix}-${index + 1}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

export function inferModelPartCategory(value: string): Model3DPartCategory {
  const lower = value.toLowerCase();

  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some((keyword) => lower.includes(keyword))) {
      return entry.category;
    }
  }

  return "volym";
}

export function inferModelPartTraceKey(
  label: string,
  category: Model3DPartCategory
): string | undefined {
  const lower = label.toLowerCase();

  if (lower.includes("garage") || lower.includes("parking") || lower.includes("parkering")) {
    return "site.parking";
  }

  if (lower.includes("grund") || lower.includes("foundation") || lower.includes("källare")) {
    return "site.foundation";
  }

  if (lower.includes("tak") || lower.includes("roof")) {
    return "embodied.envelope";
  }

  if (lower.includes("fasad") || lower.includes("wall") || lower.includes("envelope")) {
    return "embodied.envelope";
  }

  if (lower.includes("stomme") || lower.includes("frame") || lower.includes("core")) {
    return "embodied.frame";
  }

  if (lower.includes("vent") || lower.includes("hvac") || lower.includes("installation")) {
    return "operational.systems";
  }

  return TRACE_KEY_LOOKUP[category];
}

export function buildPartsFromMeshNames(meshNames: string[]): BuildingModel3DPart[] {
  if (meshNames.length === 0) {
    return [
      {
        id: "part-volym",
        label: LABELS.model3DPartCategory.volym,
        category: "volym",
        meshNames: [],
        traceKey: TRACE_KEY_LOOKUP.volym,
        note: "Ingen mesh hittades ännu, så modellen visas som en generell volym."
      }
    ];
  }

  return meshNames.map((meshName, index) => {
    const category = inferModelPartCategory(meshName);
    const label = capitalizeLabel(meshName);
    return {
      id: stableId("part", meshName, index),
      label,
      category,
      meshNames: [meshName],
      traceKey: inferModelPartTraceKey(meshName, category),
      note: `Härledd från mesh-namnet "${meshName}".`
    };
  });
}

export function meshNameMatchesPart(meshName: string, part: BuildingModel3DPart) {
  const normalizedMeshName = meshName.toLowerCase();
  const normalizedPartNames = [part.label, part.id, ...part.meshNames].map((value) =>
    value.toLowerCase()
  );

  return normalizedPartNames.some((value) => normalizedMeshName.includes(value) || value.includes(normalizedMeshName));
}

export function findPartForMeshName(parts: BuildingModel3DPart[], meshName: string) {
  return (
    parts.find((part) => meshNameMatchesPart(meshName, part)) ??
    parts.find((part) => inferModelPartCategory(meshName) === part.category) ??
    parts[0]
  );
}

function normalizeGeometry(value: unknown): GeoJsonGeometry | undefined {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return undefined;
  }

  const geometry = value as GeoJsonGeometry;
  if (geometry.type === "Point" || geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return geometry;
  }

  return undefined;
}

export function normalizeBuildingModel3D(input: unknown): BuildingModel3D {
  if (!input || typeof input !== "object") {
    throw new Error("Ogiltigt 3D-modellinnehåll");
  }

  const model = input as Partial<BuildingModel3D> & {
    sourceFormat?: Model3DSourceFormat | string;
  };

  const parts = Array.isArray(model.parts) ? model.parts : [];

  return {
    id: typeof model.id === "string" && model.id.trim() ? model.id.trim() : `model-${Date.now()}`,
    name: typeof model.name === "string" && model.name.trim() ? model.name.trim() : "3D-modell",
    sourceFormat:
      typeof model.sourceFormat === "string" && model.sourceFormat.toLowerCase() === "glb"
        ? "glb"
        : "gltf",
    sourceFileName:
      typeof model.sourceFileName === "string" && model.sourceFileName.trim()
        ? model.sourceFileName.trim()
        : undefined,
    importedAt:
      typeof model.importedAt === "string" && model.importedAt.trim()
        ? model.importedAt
        : new Date().toISOString(),
    georeference:
      model.georeference &&
      typeof model.georeference === "object" &&
      "lat" in model.georeference &&
      "lon" in model.georeference
        ? {
            lat: Number((model.georeference as { lat: unknown }).lat),
            lon: Number((model.georeference as { lon: unknown }).lon)
          }
        : undefined,
    footprint: normalizeGeometry(model.footprint),
    heightMeters:
      typeof model.heightMeters === "number" && Number.isFinite(model.heightMeters)
        ? model.heightMeters
        : undefined,
    scaleMetersPerUnit:
      typeof model.scaleMetersPerUnit === "number" && Number.isFinite(model.scaleMetersPerUnit)
        ? model.scaleMetersPerUnit
        : undefined,
    rotationDegrees:
      typeof model.rotationDegrees === "number" && Number.isFinite(model.rotationDegrees)
        ? model.rotationDegrees
        : undefined,
    parts:
      parts.length > 0
        ? parts.map((part, index) => {
            const meshNames = Array.isArray(part.meshNames)
              ? part.meshNames.filter((meshName): meshName is string => typeof meshName === "string")
              : [];

            return {
              id:
                typeof part.id === "string" && part.id.trim()
                  ? part.id.trim()
                  : stableId("part", part.label ?? "del", index),
              label:
                typeof part.label === "string" && part.label.trim()
                  ? part.label.trim()
                  : `Del ${index + 1}`,
              category:
                part.category &&
                typeof part.category === "string" &&
                part.category in LABELS.model3DPartCategory
                  ? (part.category as Model3DPartCategory)
                  : inferModelPartCategory(part.label ?? ""),
              meshNames,
              traceKey:
                typeof part.traceKey === "string" && part.traceKey.trim()
                  ? part.traceKey.trim()
                  : inferModelPartTraceKey(part.label ?? "", inferModelPartCategory(part.label ?? "")),
              climateKgCo2e:
                typeof part.climateKgCo2e === "number" && Number.isFinite(part.climateKgCo2e)
                  ? part.climateKgCo2e
                  : undefined,
              shareOfTotalPct:
                typeof part.shareOfTotalPct === "number" && Number.isFinite(part.shareOfTotalPct)
                  ? part.shareOfTotalPct
                  : undefined,
              note:
                typeof part.note === "string" && part.note.trim() ? part.note.trim() : undefined
            };
          })
        : buildPartsFromMeshNames([]),
    notes: Array.isArray(model.notes)
      ? model.notes.filter((note): note is string => typeof note === "string")
      : []
  };
}

export function getPartLabel(part: BuildingModel3DPart) {
  return LABELS.model3DPartCategory[part.category] ?? part.label;
}
