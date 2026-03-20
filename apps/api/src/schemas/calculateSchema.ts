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
  PARKING_STRUCTURE_TYPES,
  URBAN_CONTEXTS,
  normalizeUrbanContext
} from "../../../../packages/shared/src";

const urbanContextSchema = z.preprocess((value) => normalizeUrbanContext(value), z.enum(URBAN_CONTEXTS));

const existingBuildingSchema = z.object({
  grossFloorAreaM2: z.number().positive().max(1_000_000),
  buildYear: z.number().int().min(1850).max(2100),
  frameMaterial: z.enum(FRAME_MATERIALS),
  energyStandard: z.enum(ENERGY_STANDARDS),
  specificEnergyUseKwhM2Year: z.number().positive().max(500).optional()
});

export const calculateSchema = z.object({
  buildingType: z.enum(BUILDING_TYPES),
  grossFloorAreaM2: z.number().positive().max(1_000_000),
  buildYear: z.number().int().min(1850).max(2100),
  frameMaterial: z.enum(FRAME_MATERIALS),
  energyStandard: z.enum(ENERGY_STANDARDS),
  heatingType: z.enum(HEATING_TYPES),
  buildingForm: z.enum(BUILDING_FORMS).optional(),
  urbanContext: urbanContextSchema.optional(),
  specificEnergyUseKwhM2Year: z.number().positive().max(500).optional(),
  estimatedResidents: z.number().min(0).max(1_000_000).optional(),
  estimatedWorkers: z.number().min(0).max(1_000_000).optional(),
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
  transitOverrides: z
    .object({
      distanceToTransitStopM: z.number().min(0).max(100_000).optional(),
      distanceToRailStationM: z.number().min(0).max(100_000).optional(),
      departuresPerHour: z.number().min(0).max(120).optional()
    })
    .optional(),
  interventionType: z.enum(INTERVENTION_TYPES).optional(),
  existingBuilding: existingBuildingSchema.optional(),
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
