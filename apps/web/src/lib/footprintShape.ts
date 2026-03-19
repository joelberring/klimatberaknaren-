import { LABELS, type BuildingModel3D, type BuildingModel3DPart, type GeoJsonPolygon } from "../../../../packages/shared/src";

export interface FootprintPoint {
  x: number;
  y: number;
}

export type FootprintShapeMode = "rectangle" | "polygon";

export interface FootprintShapeDraft {
  mode: FootprintShapeMode;
  widthMeters: number;
  depthMeters: number;
  heightMeters: number;
  points: FootprintPoint[];
}

export interface FootprintMetrics {
  areaM2: number;
  perimeterM: number;
  formFactor: number;
}

const DEFAULT_WIDTH_METERS = 24;
const DEFAULT_DEPTH_METERS = 16;
const DEFAULT_HEIGHT_METERS = 12;

function createDefaultPart(): BuildingModel3DPart {
  return {
    id: "part-volym",
    label: LABELS.model3DPartCategory.volym,
    category: "volym",
    meshNames: [],
    traceKey: "embodied.total",
    note: "Manuellt inmatad byggnadsvolym."
  };
}

export function createRectanglePoints(widthMeters = DEFAULT_WIDTH_METERS, depthMeters = DEFAULT_DEPTH_METERS) {
  const halfWidth = widthMeters / 2;
  const halfDepth = depthMeters / 2;

  return [
    { x: -halfWidth, y: -halfDepth },
    { x: halfWidth, y: -halfDepth },
    { x: halfWidth, y: halfDepth },
    { x: -halfWidth, y: halfDepth }
  ];
}

export function createDefaultFootprintDraft(): FootprintShapeDraft {
  return {
    mode: "rectangle",
    widthMeters: DEFAULT_WIDTH_METERS,
    depthMeters: DEFAULT_DEPTH_METERS,
    heightMeters: DEFAULT_HEIGHT_METERS,
    points: createRectanglePoints()
  };
}

export function getFootprintBounds(points: FootprintPoint[]) {
  if (points.length === 0) {
    return {
      minX: -DEFAULT_WIDTH_METERS / 2,
      minY: -DEFAULT_DEPTH_METERS / 2,
      maxX: DEFAULT_WIDTH_METERS / 2,
      maxY: DEFAULT_DEPTH_METERS / 2,
      width: DEFAULT_WIDTH_METERS,
      height: DEFAULT_DEPTH_METERS
    };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 0.1),
    height: Math.max(maxY - minY, 0.1)
  };
}

export function getFootprintMetrics(points: FootprintPoint[], heightMeters: number): FootprintMetrics {
  if (points.length < 3) {
    return {
      areaM2: 0,
      perimeterM: 0,
      formFactor: 0
    };
  }

  let areaAccumulator = 0;
  let perimeterAccumulator = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    areaAccumulator += current.x * next.y - next.x * current.y;
    perimeterAccumulator += Math.hypot(next.x - current.x, next.y - current.y);
  }

  const areaM2 = Math.abs(areaAccumulator) / 2;
  const perimeterM = perimeterAccumulator;
  const volumeM3 = areaM2 * Math.max(heightMeters, 0.1);
  const envelopeAreaM2 = perimeterM * Math.max(heightMeters, 0.1) + areaM2 * 2;

  return {
    areaM2,
    perimeterM,
    formFactor: volumeM3 > 0 ? envelopeAreaM2 / volumeM3 : 0
  };
}

export function setDraftSize(
  draft: FootprintShapeDraft,
  widthMeters: number,
  depthMeters: number
): FootprintShapeDraft {
  const next = {
    ...draft,
    widthMeters: Math.max(widthMeters, 0.1),
    depthMeters: Math.max(depthMeters, 0.1)
  };

  if (draft.mode === "rectangle") {
    const bounds = getFootprintBounds(draft.points);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    next.points = createRectanglePoints(next.widthMeters, next.depthMeters).map((point) => ({
      x: point.x + centerX,
      y: point.y + centerY
    }));
  }

  return next;
}

export function setDraftHeight(draft: FootprintShapeDraft, heightMeters: number): FootprintShapeDraft {
  return {
    ...draft,
    heightMeters: Math.max(heightMeters, 0.1)
  };
}

export function rectangleDraftFromPoints(
  points: FootprintPoint[],
  heightMeters = DEFAULT_HEIGHT_METERS
): FootprintShapeDraft {
  const bounds = getFootprintBounds(points);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    mode: "rectangle",
    widthMeters: bounds.width,
    depthMeters: bounds.height,
    heightMeters,
    points: createRectanglePoints(bounds.width, bounds.height).map((point) => ({
      x: point.x + centerX,
      y: point.y + centerY
    }))
  };
}

export function polygonDraftFromPoints(
  points: FootprintPoint[],
  heightMeters = DEFAULT_HEIGHT_METERS
): FootprintShapeDraft {
  const bounds = getFootprintBounds(points);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    mode: "polygon",
    widthMeters: bounds.width,
    depthMeters: bounds.height,
    heightMeters,
    points: points.map((point) => ({
      x: point.x - centerX,
      y: point.y - centerY
    }))
  };
}

export function draftFromModel(model?: BuildingModel3D | null): FootprintShapeDraft {
  if (!model?.footprint || model.footprint.type !== "Polygon" || !model.footprint.coordinates[0]) {
    return createDefaultFootprintDraft();
  }

  const ring = model.footprint.coordinates[0]
    .slice(0, -1)
    .map(([x, y]) => ({
      x,
      y
    }));

  if (ring.length < 3) {
    return createDefaultFootprintDraft();
  }

  const bounds = getFootprintBounds(ring);
  const centered = ring.map((point) => ({
    x: point.x - (bounds.minX + bounds.maxX) / 2,
    y: point.y - (bounds.minY + bounds.maxY) / 2
  }));

  return {
    mode: ring.length === 4 ? "rectangle" : "polygon",
    widthMeters: bounds.width,
    depthMeters: bounds.height,
    heightMeters: model.heightMeters ?? DEFAULT_HEIGHT_METERS,
    points: centered
  };
}

export function pointsToPolygon(points: FootprintPoint[]): GeoJsonPolygon {
  const closedRing = points.map((point) => [point.x, point.y] as [number, number]);
  if (closedRing.length > 0) {
    const [firstX, firstY] = closedRing[0];
    closedRing.push([firstX, firstY]);
  }

  return {
    type: "Polygon",
    coordinates: [closedRing]
  };
}

export function movePoint(
  points: FootprintPoint[],
  index: number,
  nextPoint: FootprintPoint,
  mode: FootprintShapeMode
) {
  if (index < 0 || index >= points.length) {
    return points;
  }

  if (mode === "rectangle" && points.length >= 4) {
    const opposite = points[(index + 2) % points.length];
    const minX = Math.min(opposite.x, nextPoint.x);
    const maxX = Math.max(opposite.x, nextPoint.x);
    const minY = Math.min(opposite.y, nextPoint.y);
    const maxY = Math.max(opposite.y, nextPoint.y);

    return createRectanglePoints(maxX - minX, maxY - minY).map((point) => ({
      x: point.x + (minX + maxX) / 2,
      y: point.y + (minY + maxY) / 2
    }));
  }

  return points.map((point, pointIndex) => (pointIndex === index ? nextPoint : point));
}

export function translatePoints(points: FootprintPoint[], deltaX: number, deltaY: number) {
  return points.map((point) => ({
    x: point.x + deltaX,
    y: point.y + deltaY
  }));
}

export function insertCorner(points: FootprintPoint[]) {
  if (points.length < 2) {
    return {
      points: createDefaultFootprintDraft().points,
      insertedIndex: 0
    };
  }

  let insertIndex = 0;
  let longestDistance = -Infinity;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const distance = Math.hypot(next.x - current.x, next.y - current.y);

    if (distance > longestDistance) {
      longestDistance = distance;
      insertIndex = index;
    }
  }

  const current = points[insertIndex];
  const next = points[(insertIndex + 1) % points.length];
  const midpoint = {
    x: (current.x + next.x) / 2,
    y: (current.y + next.y) / 2
  };

  const nextPoints = points.slice();
  nextPoints.splice(insertIndex + 1, 0, midpoint);
  return {
    points: nextPoints,
    insertedIndex: insertIndex + 1
  };
}

export function removeCorner(points: FootprintPoint[], index: number) {
  if (points.length <= 3 || index < 0 || index >= points.length) {
    return points;
  }

  const nextPoints = points.slice();
  nextPoints.splice(index, 1);
  return nextPoints;
}

export function buildPreviewModelFromDraft(
  draft: FootprintShapeDraft,
  baseModel?: BuildingModel3D | null
): BuildingModel3D {
  const importedAt = baseModel?.importedAt ?? new Date().toISOString();
  const metrics = getFootprintMetrics(draft.points, draft.heightMeters);
  const notes = [
    ...(baseModel?.notes ?? []),
    `Manuellt inmatad ${draft.mode === "rectangle" ? "rektangel" : "polygon"} med formfaktor ${metrics.formFactor ? metrics.formFactor.toFixed(2) : "okänd"}.`
  ].filter((value, index, array) => array.indexOf(value) === index);

  return {
    id: baseModel?.id ?? `manual-model-${Date.now()}`,
    name: baseModel?.name ?? "Manuell byggnadsform",
    sourceFormat: baseModel?.sourceFormat ?? "gltf",
    sourceFileName: baseModel?.sourceFileName ?? "manuell-form",
    importedAt,
    georeference: baseModel?.georeference,
    footprint: pointsToPolygon(draft.points),
    heightMeters: draft.heightMeters,
    scaleMetersPerUnit: baseModel?.scaleMetersPerUnit,
    rotationDegrees: baseModel?.rotationDegrees,
    parts: [createDefaultPart()],
    notes
  };
}

export function summarizeFootprint(draft: FootprintShapeDraft) {
  const metrics = getFootprintMetrics(draft.points, draft.heightMeters);
  return {
    ...metrics
  };
}
