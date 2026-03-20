import { z } from "zod";

import {
  BUILDING_TYPES,
  BUILDING_FORMS,
  ENERGY_STANDARDS,
  GROUND_CONDITIONS,
  FOUNDATION_TYPES,
  FRAME_MATERIALS,
  HEATING_TYPES,
  INTERVENTION_TYPES,
  LAND_TYPES,
  MODEL3D_PART_CATEGORIES,
  MODEL3D_SOURCE_FORMATS,
  OBJECT_TYPES,
  PARKING_STRUCTURE_TYPES,
  PROXY_PROFILES,
  SCENARIO_MODES,
  URBAN_CONTEXTS,
  normalizeUrbanContext
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

const model3dPartSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.enum(MODEL3D_PART_CATEGORIES),
  meshNames: z.array(z.string().min(1)).default([]),
  traceKey: z.string().min(1).optional(),
  climateKgCo2e: z.number().min(0).optional(),
  shareOfTotalPct: z.number().min(0).max(100).optional(),
  note: z.string().max(300).optional()
});

const urbanContextSchema = z.preprocess((value) => normalizeUrbanContext(value), z.enum(URBAN_CONTEXTS));

export const model3dImportSchema = z.object({
  model: z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    sourceFormat: z.enum(MODEL3D_SOURCE_FORMATS),
    sourceFileName: z.string().max(260).optional(),
    importedAt: z.string().datetime().optional(),
    georeference: z
      .object({
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180)
      })
      .optional(),
    footprint: geometrySchema.optional(),
    heightMeters: z.number().positive().max(10_000).optional(),
    scaleMetersPerUnit: z.number().positive().max(1000).optional(),
    rotationDegrees: z.number().min(-360).max(360).optional(),
    parts: z.array(model3dPartSchema).min(1),
    notes: z.array(z.string().max(500)).default([])
  })
});

export const sessionSchema = z.object({
  email: z.string().email(),
  organizationId: z.string().min(2)
});

export const scenarioAccessSchema = z.object({
  code: z.string().min(1)
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
  buildingForm: z.enum(BUILDING_FORMS).optional(),
  urbanContext: urbanContextSchema.optional(),
  proxyProfile: z.enum(PROXY_PROFILES).optional(),
  specificEnergyUseKwhM2Year: z.number().positive().max(500).optional(),
  estimatedResidents: z.number().min(0).optional(),
  estimatedWorkers: z.number().min(0).optional(),
  siteAreaM2: z.number().positive().max(10_000_000).optional(),
  floorsAboveGround: z.number().int().min(1).max(200).optional(),
  basementFloors: z.number().int().min(1).max(20).optional(),
  buildingFootprintM2: z.number().positive().max(1_000_000).optional(),
  glazingRatioPct: z.number().min(0).max(100).optional(),
  parkingSpaces: z.number().min(0).max(100_000).optional(),
  parkingStructureType: z.enum(PARKING_STRUCTURE_TYPES).optional(),
  parkingGarageFloors: z.number().int().min(1).max(20).optional(),
  landType: z.enum(LAND_TYPES).optional(),
  groundCondition: z.enum(GROUND_CONDITIONS).optional(),
  foundationType: z.enum(FOUNDATION_TYPES).optional(),
  siteLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180)
    })
    .optional(),
  distanceToServiceM: z.number().min(0).max(100_000).optional(),
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
  buildingForm: z.enum(BUILDING_FORMS).optional(),
  urbanContext: urbanContextSchema.optional(),
  proxyProfile: z.enum(PROXY_PROFILES).optional(),
  areaHa: z.number().positive().optional(),
  residents: z.number().min(0).optional(),
  workers: z.number().min(0).optional(),
  specificEnergyUseKwhM2Year: z.number().positive().optional(),
  siteAreaM2: z.number().positive().optional(),
  floorsAboveGround: z.number().int().min(1).max(200).optional(),
  basementFloors: z.number().int().min(1).max(20).optional(),
  buildingFootprintM2: z.number().positive().optional(),
  glazingRatioPct: z.number().min(0).max(100).optional(),
  parkingSpaces: z.number().min(0).optional(),
  parkingStructureType: z.enum(PARKING_STRUCTURE_TYPES).optional(),
  parkingGarageFloors: z.number().int().min(1).max(20).optional(),
  landType: z.enum(LAND_TYPES).optional(),
  groundCondition: z.enum(GROUND_CONDITIONS).optional(),
  foundationType: z.enum(FOUNDATION_TYPES).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  distanceToServiceM: z.number().min(0).optional(),
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
