import {
  type GeoJsonGeometry,
  type PlanObject,
  type ScenarioImportTabularRequest
} from "../../../../packages/shared/src";

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeNumber(value: unknown, field: string) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Ogiltigt numeriskt värde för ${field}`);
  }

  return parsed;
}

function getGeometryCentroid(geometry?: GeoJsonGeometry) {
  if (!geometry) {
    return undefined;
  }

  if (geometry.type === "Point") {
    return {
      lat: geometry.coordinates[1],
      lon: geometry.coordinates[0]
    };
  }

  const points =
    geometry.type === "Polygon"
      ? geometry.coordinates.flat()
      : geometry.coordinates.flat(2);

  if (points.length === 0) {
    return undefined;
  }

  const sums = points.reduce(
    (accumulator, point) => ({
      lon: accumulator.lon + point[0],
      lat: accumulator.lat + point[1]
    }),
    {
      lon: 0,
      lat: 0
    }
  );

  return {
    lat: sums.lat / points.length,
    lon: sums.lon / points.length
  };
}

function toPlanObject(
  properties: Record<string, unknown>,
  geometry?: GeoJsonGeometry
): PlanObject {
  const name = normalizeString(properties.name);
  const objectId = normalizeString(properties.id) || `import-${name.toLowerCase().replace(/\s+/g, "-")}`;

  if (!name) {
    throw new Error("Varje planobjekt måste ha ett namn");
  }

  const siteLocation =
    properties.siteLocation &&
    typeof properties.siteLocation === "object" &&
    "lat" in properties.siteLocation &&
    "lon" in properties.siteLocation
      ? {
          lat: normalizeNumber(
            (properties.siteLocation as { lat: unknown }).lat,
            "siteLocation.lat"
          ),
          lon: normalizeNumber(
            (properties.siteLocation as { lon: unknown }).lon,
            "siteLocation.lon"
          )
        }
      : properties.lat !== undefined && properties.lon !== undefined
        ? {
            lat: normalizeNumber(properties.lat, "lat"),
            lon: normalizeNumber(properties.lon, "lon")
          }
        : getGeometryCentroid(geometry);

  return {
    id: objectId,
    name,
    objectType: (normalizeString(properties.objectType) || "byggnad") as PlanObject["objectType"],
    grossFloorAreaM2: normalizeNumber(properties.grossFloorAreaM2, "grossFloorAreaM2"),
    areaHa:
      properties.areaHa !== undefined ? normalizeNumber(properties.areaHa, "areaHa") : undefined,
    residents:
      properties.residents !== undefined
        ? normalizeNumber(properties.residents, "residents")
        : undefined,
    workers:
      properties.workers !== undefined ? normalizeNumber(properties.workers, "workers") : undefined,
    geometry,
    metadata: {
      imported: true
    },
    quickInput: {
      buildingType: normalizeString(properties.buildingType) as PlanObject["quickInput"]["buildingType"],
      grossFloorAreaM2: normalizeNumber(properties.grossFloorAreaM2, "grossFloorAreaM2"),
      buildYear: normalizeNumber(properties.buildYear, "buildYear"),
      frameMaterial: normalizeString(properties.frameMaterial) as PlanObject["quickInput"]["frameMaterial"],
      energyStandard: normalizeString(properties.energyStandard) as PlanObject["quickInput"]["energyStandard"],
      heatingType: normalizeString(properties.heatingType) as PlanObject["quickInput"]["heatingType"],
      buildingForm:
        properties.buildingForm !== undefined
          ? (normalizeString(properties.buildingForm) as PlanObject["quickInput"]["buildingForm"])
          : undefined,
      urbanContext:
        properties.urbanContext !== undefined
          ? (normalizeString(properties.urbanContext) as PlanObject["quickInput"]["urbanContext"])
          : undefined,
      siteAreaM2:
        properties.siteAreaM2 !== undefined
          ? normalizeNumber(properties.siteAreaM2, "siteAreaM2")
          : undefined,
      floorsAboveGround:
        properties.floorsAboveGround !== undefined
          ? normalizeNumber(properties.floorsAboveGround, "floorsAboveGround")
          : undefined,
      buildingFootprintM2:
        properties.buildingFootprintM2 !== undefined
          ? normalizeNumber(properties.buildingFootprintM2, "buildingFootprintM2")
          : undefined,
      glazingRatioPct:
        properties.glazingRatioPct !== undefined
          ? normalizeNumber(properties.glazingRatioPct, "glazingRatioPct")
          : undefined,
      parkingSpaces:
        properties.parkingSpaces !== undefined
          ? normalizeNumber(properties.parkingSpaces, "parkingSpaces")
          : undefined,
      parkingStructureType:
        properties.parkingStructureType !== undefined
          ? (normalizeString(properties.parkingStructureType) as PlanObject["quickInput"]["parkingStructureType"])
          : undefined,
      parkingGarageFloors:
        properties.parkingGarageFloors !== undefined
          ? normalizeNumber(properties.parkingGarageFloors, "parkingGarageFloors")
          : undefined,
      landType:
        properties.landType !== undefined
          ? normalizeString(properties.landType) as PlanObject["quickInput"]["landType"]
          : undefined,
      groundCondition:
        properties.groundCondition !== undefined
          ? (normalizeString(properties.groundCondition) as PlanObject["quickInput"]["groundCondition"])
          : undefined,
      foundationType:
        properties.foundationType !== undefined
          ? normalizeString(properties.foundationType) as PlanObject["quickInput"]["foundationType"]
          : undefined,
      siteLocation,
      transitOverrides:
        properties.distanceToTransitStopM !== undefined ||
        properties.distanceToRailStationM !== undefined ||
        properties.departuresPerHour !== undefined
          ? {
              distanceToTransitStopM:
                properties.distanceToTransitStopM !== undefined
                  ? normalizeNumber(
                      properties.distanceToTransitStopM,
                      "distanceToTransitStopM"
                    )
                  : undefined,
              distanceToRailStationM:
                properties.distanceToRailStationM !== undefined
                  ? normalizeNumber(
                      properties.distanceToRailStationM,
                      "distanceToRailStationM"
                    )
                  : undefined,
              departuresPerHour:
                properties.departuresPerHour !== undefined
                  ? normalizeNumber(properties.departuresPerHour, "departuresPerHour")
                  : undefined
            }
          : undefined,
      interventionType:
        properties.interventionType !== undefined
          ? normalizeString(properties.interventionType) as PlanObject["quickInput"]["interventionType"]
          : undefined,
      existingBuilding:
        properties.existingGrossFloorAreaM2 !== undefined &&
        properties.existingBuildYear !== undefined &&
        properties.existingFrameMaterial !== undefined &&
        properties.existingEnergyStandard !== undefined
          ? {
              grossFloorAreaM2: normalizeNumber(
                properties.existingGrossFloorAreaM2,
                "existingGrossFloorAreaM2"
              ),
              buildYear: normalizeNumber(properties.existingBuildYear, "existingBuildYear"),
              frameMaterial: normalizeString(
                properties.existingFrameMaterial
              ) as PlanObject["quickInput"]["frameMaterial"],
              energyStandard: normalizeString(
                properties.existingEnergyStandard
              ) as PlanObject["quickInput"]["energyStandard"],
              specificEnergyUseKwhM2Year:
                properties.existingSpecificEnergyUseKwhM2Year !== undefined
                  ? normalizeNumber(
                      properties.existingSpecificEnergyUseKwhM2Year,
                      "existingSpecificEnergyUseKwhM2Year"
                    )
                  : undefined
            }
          : undefined,
      retainedStructureSharePct:
        properties.retainedStructureSharePct !== undefined
          ? normalizeNumber(properties.retainedStructureSharePct, "retainedStructureSharePct")
          : undefined,
      addedGrossFloorAreaM2:
        properties.addedGrossFloorAreaM2 !== undefined
          ? normalizeNumber(properties.addedGrossFloorAreaM2, "addedGrossFloorAreaM2")
          : undefined,
      addedFloors:
        properties.addedFloors !== undefined
          ? normalizeNumber(properties.addedFloors, "addedFloors")
          : undefined,
      retrofitDepth:
        properties.retrofitDepth !== undefined
          ? normalizeString(properties.retrofitDepth) as NonNullable<
              PlanObject["quickInput"]["retrofitDepth"]
            >
          : undefined,
      specificEnergyUseKwhM2Year:
        properties.specificEnergyUseKwhM2Year !== undefined
          ? normalizeNumber(
              properties.specificEnergyUseKwhM2Year,
              "specificEnergyUseKwhM2Year"
            )
          : undefined
    }
  };
}

function parseCsv(content: string) {
  const [headerLine, ...rows] = content.split(/\r?\n/).filter(Boolean);

  if (!headerLine) {
    throw new Error("CSV-innehållet är tomt");
  }

  const headers = headerLine.split(",").map((column) => column.trim());

  return rows.map((row) => {
    const cells = row.split(",");
    return headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = cells[index]?.trim() ?? "";
      return accumulator;
    }, {});
  });
}

export function importGeoJsonFeatures(
  features: Array<{ properties: Record<string, unknown>; geometry: GeoJsonGeometry | null }>
) {
  const seenIds = new Set<string>();
  const warnings: string[] = [];
  const planObjects: PlanObject[] = [];

  for (const feature of features) {
    if (!feature.geometry) {
      warnings.push("Ett planobjekt saknade geometri och hoppades över.");
      continue;
    }

    const planObject = toPlanObject(feature.properties, feature.geometry);

    if (seenIds.has(planObject.id)) {
      throw new Error(`Dubblett på planobjekt-ID: ${planObject.id}`);
    }

    seenIds.add(planObject.id);
    planObjects.push(planObject);
  }

  return { planObjects, warnings };
}

export function importTabularRows(payload: ScenarioImportTabularRequest) {
  const rows =
    payload.format === "json"
      ? payload.rows ?? []
      : parseCsv(payload.content ?? "").map((row) => row as Record<string, string | number>);

  const seenIds = new Set<string>();
  const planObjects = rows.map((row, index) => {
    const planObject = toPlanObject(
      {
        id: row.id ?? `row-${index + 1}`,
        name: row.name,
        objectType: row.objectType ?? "byggnad",
        buildingType: row.buildingType,
        grossFloorAreaM2: row.grossFloorAreaM2,
        buildYear: row.buildYear,
        frameMaterial: row.frameMaterial,
        energyStandard: row.energyStandard,
        heatingType: row.heatingType,
        residents: row.residents,
        workers: row.workers,
        areaHa: row.areaHa,
        specificEnergyUseKwhM2Year: row.specificEnergyUseKwhM2Year,
        siteAreaM2: row.siteAreaM2,
        floorsAboveGround: row.floorsAboveGround,
        buildingFootprintM2: row.buildingFootprintM2,
        glazingRatioPct: row.glazingRatioPct,
        parkingSpaces: row.parkingSpaces,
        parkingStructureType: row.parkingStructureType,
        parkingGarageFloors: row.parkingGarageFloors,
        landType: row.landType,
        groundCondition: row.groundCondition,
        foundationType: row.foundationType,
        lat: row.lat,
        lon: row.lon,
        distanceToTransitStopM: row.distanceToTransitStopM,
        distanceToRailStationM: row.distanceToRailStationM,
        departuresPerHour: row.departuresPerHour,
        interventionType: row.interventionType,
        existingGrossFloorAreaM2: row.existingGrossFloorAreaM2,
        existingBuildYear: row.existingBuildYear,
        existingFrameMaterial: row.existingFrameMaterial,
        existingEnergyStandard: row.existingEnergyStandard,
        existingSpecificEnergyUseKwhM2Year: row.existingSpecificEnergyUseKwhM2Year,
        retainedStructureSharePct: row.retainedStructureSharePct,
        addedGrossFloorAreaM2: row.addedGrossFloorAreaM2,
        addedFloors: row.addedFloors,
        retrofitDepth: row.retrofitDepth
      },
      undefined
    );

    if (seenIds.has(planObject.id)) {
      throw new Error(`Dubblett på planobjekt-ID: ${planObject.id}`);
    }

    seenIds.add(planObject.id);
    return planObject;
  });

  return {
    planObjects,
    warnings: payload.format === "csv" ? ["CSV-import saknar geometri och visas därför utan kartpolygoner."] : []
  };
}
