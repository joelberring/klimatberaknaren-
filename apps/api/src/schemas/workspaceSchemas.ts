import { z } from "zod";

import {
  BUILDING_TYPES,
  ENERGY_STANDARDS,
  FOUNDATION_TYPES,
  FRAME_MATERIALS,
  HEATING_TYPES,
  INTERVENTION_TYPES,
  LAND_TYPES,
  OBJECT_TYPES,
  SCENARIO_MODES
} from "../../../../packages/shared/src";

const geometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()])
  }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1)
  }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(z.array(z.tuple([z.number(), z.number()])))).min(1)
  })
]);

export const sessionSchema = z.object({
  email: z.string().email(),
  organizationId: z.string().min(2)
});

export const projectSchema = z.object({
  organizationId: z.string().min(2),
  name: z.string().min(2).max(120),
  description: z.string().max(800).optional()
});

export const scenarioQuickInputSchema = z.object({
  buildingType: z.enum(BUILDING_TYPES),
  grossFloorAreaM2: z.number().positive().max(1_000_000),
  buildYear: z.number().int().min(1850).max(2100),
  frameMaterial: z.enum(FRAME_MATERIALS),
  energyStandard: z.enum(ENERGY_STANDARDS),
  heatingType: z.enum(HEATING_TYPES),
  specificEnergyUseKwhM2Year: z.number().positive().max(500).optional(),
  estimatedResidents: z.number().min(0).optional(),
  estimatedWorkers: z.number().min(0).optional(),
  siteAreaM2: z.number().positive().max(10_000_000).optional(),
  floorsAboveGround: z.number().int().min(1).max(200).optional(),
  buildingFootprintM2: z.number().positive().max(1_000_000).optional(),
  glazingRatioPct: z.number().min(0).max(100).optional(),
  parkingSpaces: z.number().min(0).max(100_000).optional(),
  landType: z.enum(LAND_TYPES).optional(),
  foundationType: z.enum(FOUNDATION_TYPES).optional(),
  siteLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180)
    })
    .optional(),
  transitOverrides: z
    .object({
      distanceToTransitStopM: z.number().min(0).max(100_000).optional(),
      distanceToRailStationM: z.number().min(0).max(100_000).optional(),
      departuresPerHour: z.number().min(0).max(120).optional()
    })
    .optional(),
  interventionType: z.enum(INTERVENTION_TYPES).optional(),
  existingBuilding: z
    .object({
      grossFloorAreaM2: z.number().positive().max(1_000_000),
      buildYear: z.number().int().min(1850).max(2100),
      frameMaterial: z.enum(FRAME_MATERIALS),
      energyStandard: z.enum(ENERGY_STANDARDS),
      specificEnergyUseKwhM2Year: z.number().positive().max(500).optional()
    })
    .optional(),
  retrofitDepth: z.enum(["light", "medium", "deep"]).optional(),
  retainedStructureSharePct: z.number().min(0).max(100).optional(),
  addedGrossFloorAreaM2: z.number().min(0).max(1_000_000).optional(),
  addedFloors: z.number().int().min(0).max(100).optional(),
  uValues: z
    .object({
      yttervagg: z.number().positive().max(2).optional(),
      tak: z.number().positive().max(2).optional(),
      fonster: z.number().positive().max(5).optional()
    })
    .optional()
});

export const scenarioSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(800).optional(),
  mode: z.enum(SCENARIO_MODES).optional(),
  quickInput: scenarioQuickInputSchema.optional()
});

export const duplicateScenarioSchema = z.object({
  name: z.string().min(2).max(120).optional()
});

export const scenarioCalculationSchema = z.object({
  quickInput: scenarioQuickInputSchema.optional()
});

const planObjectPropertySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  objectType: z.enum(OBJECT_TYPES).optional(),
  buildingType: z.enum(BUILDING_TYPES),
  grossFloorAreaM2: z.number().positive(),
  buildYear: z.number().int().min(1850).max(2100),
  frameMaterial: z.enum(FRAME_MATERIALS),
  energyStandard: z.enum(ENERGY_STANDARDS),
  heatingType: z.enum(HEATING_TYPES),
  areaHa: z.number().positive().optional(),
  residents: z.number().min(0).optional(),
  workers: z.number().min(0).optional(),
  specificEnergyUseKwhM2Year: z.number().positive().optional(),
  siteAreaM2: z.number().positive().optional(),
  floorsAboveGround: z.number().int().min(1).max(200).optional(),
  buildingFootprintM2: z.number().positive().optional(),
  glazingRatioPct: z.number().min(0).max(100).optional(),
  parkingSpaces: z.number().min(0).optional(),
  landType: z.enum(LAND_TYPES).optional(),
  foundationType: z.enum(FOUNDATION_TYPES).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  distanceToTransitStopM: z.number().min(0).optional(),
  distanceToRailStationM: z.number().min(0).optional(),
  departuresPerHour: z.number().min(0).optional(),
  siteLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180)
    })
    .optional(),
  transitOverrides: z
    .object({
      distanceToTransitStopM: z.number().min(0).max(100_000).optional(),
      distanceToRailStationM: z.number().min(0).max(100_000).optional(),
      departuresPerHour: z.number().min(0).max(120).optional()
    })
    .optional(),
  interventionType: z.enum(INTERVENTION_TYPES).optional(),
  existingGrossFloorAreaM2: z.number().positive().optional(),
  existingBuildYear: z.number().int().min(1850).max(2100).optional(),
  existingFrameMaterial: z.enum(FRAME_MATERIALS).optional(),
  existingEnergyStandard: z.enum(ENERGY_STANDARDS).optional(),
  existingSpecificEnergyUseKwhM2Year: z.number().positive().optional(),
  retainedStructureSharePct: z.number().min(0).max(100).optional(),
  addedGrossFloorAreaM2: z.number().min(0).optional(),
  addedFloors: z.number().int().min(0).max(100).optional(),
  retrofitDepth: z.enum(["light", "medium", "deep"]).optional()
});

export const geoJsonImportSchema = z.object({
  geojson: z.object({
    type: z.literal("FeatureCollection"),
    features: z.array(
      z.object({
        type: z.literal("Feature"),
        geometry: geometrySchema.nullable(),
        properties: z.record(z.string(), z.unknown()).pipe(planObjectPropertySchema)
      })
    )
  })
});

export const tabularImportSchema = z.object({
  format: z.enum(["csv", "json"]),
  content: z.string().optional(),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).optional()
});
