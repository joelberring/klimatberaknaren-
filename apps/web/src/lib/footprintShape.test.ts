import { describe, expect, it } from "vitest";

import { draftFromModel, insertCorner, buildPreviewModelFromDraft, createDefaultFootprintDraft, getFootprintMetrics } from "./footprintShape";

describe("footprintShape helpers", () => {
  it("creates a default rectangle with sensible metrics", () => {
    const draft = createDefaultFootprintDraft();
    const metrics = getFootprintMetrics(draft.points, draft.heightMeters);

    expect(draft.points).toHaveLength(4);
    expect(metrics.areaM2).toBeGreaterThan(0);
    expect(metrics.formFactor).toBeGreaterThan(0);
  });

  it("inserts a new corner on the longest edge", () => {
    const { points, insertedIndex } = insertCorner(createDefaultFootprintDraft().points);

    expect(points).toHaveLength(5);
    expect(points.some((point) => point.x === 0)).toBe(true);
    expect(insertedIndex).toBeGreaterThanOrEqual(0);
  });

  it("builds a preview model from the draft footprint", () => {
    const draft = createDefaultFootprintDraft();
    const model = buildPreviewModelFromDraft(draft, {
      id: "model-1",
      name: "Manuell modell",
      sourceFormat: "gltf",
      importedAt: "2026-03-18T10:00:00.000Z",
      parts: []
    } as never);

    expect(model.heightMeters).toBe(draft.heightMeters);
    expect(model.footprint?.type).toBe("Polygon");
    expect(model.parts).toHaveLength(1);
  });

  it("normalizes a polygon model into an editable draft", () => {
    const draft = draftFromModel({
      id: "model-2",
      name: "Polygonmodell",
      sourceFormat: "gltf",
      importedAt: "2026-03-18T10:00:00.000Z",
      footprint: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 4],
            [0, 4],
            [0, 0]
          ]
        ]
      },
      parts: []
    } as never);

    expect(draft.mode).toBe("rectangle");
    expect(draft.widthMeters).toBe(10);
    expect(draft.depthMeters).toBe(4);
  });
});
