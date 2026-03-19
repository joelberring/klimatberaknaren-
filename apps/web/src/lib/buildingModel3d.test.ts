import { describe, expect, it } from "vitest";

import {
  buildPartsFromMeshNames,
  findPartForMeshName,
  normalizeBuildingModel3D
} from "./buildingModel3d";

describe("buildingModel3d helpers", () => {
  it("normalizes metadata and keeps mesh attribution intact", () => {
    const model = normalizeBuildingModel3D({
      id: "model-1",
      name: "Husmodell",
      sourceFormat: "glb",
      sourceFileName: "house.glb",
      importedAt: "2026-03-18T10:00:00.000Z",
      heightMeters: 14,
      parts: [
        {
          id: "part-1",
          label: "Stomme",
          category: "stomme",
          meshNames: ["frame", "core"],
          traceKey: "embodied.frame",
          climateKgCo2e: 120000
        }
      ],
      notes: ["Test"]
    });

    expect(model.sourceFormat).toBe("glb");
    expect(model.heightMeters).toBe(14);
    expect(model.parts[0].label).toBe("Stomme");
    expect(model.parts[0].meshNames).toEqual(["frame", "core"]);
    expect(model.parts[0].traceKey).toBe("embodied.frame");
  });

  it("derives parts from mesh names and matches them to the right category", () => {
    const parts = buildPartsFromMeshNames(["frame_main", "roof_shell", "garage_box"]);

    expect(parts.map((part) => part.category)).toEqual(["stomme", "tak", "garage"]);
    expect(findPartForMeshName(parts, "roof_shell")?.category).toBe("tak");
    expect(findPartForMeshName(parts, "garage_box")?.traceKey).toBe("site.parking");
  });
});
