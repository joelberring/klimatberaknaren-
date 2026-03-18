import type { PlanObjectResult } from "../../../../packages/shared/src";

interface GeoJsonMapProps {
  planObjects: PlanObjectResult[];
}

function flattenCoordinates(item: PlanObjectResult) {
  if (!item.geometry) {
    return [];
  }

  if (item.geometry.type === "Polygon") {
    return item.geometry.coordinates.flat();
  }

  if (item.geometry.type === "MultiPolygon") {
    return item.geometry.coordinates.flat(2);
  }

  if (item.geometry.type === "Point") {
    return [item.geometry.coordinates];
  }

  return [];
}

export function GeoJsonMap({ planObjects }: GeoJsonMapProps) {
  const drawableObjects = planObjects.filter((item) => item.geometry);

  if (drawableObjects.length === 0) {
    return (
      <section className="panel panel-soft">
        <div className="section-heading">
          <p className="eyebrow">Kartvy</p>
          <h3>Ingen geometri uppladdad ännu</h3>
        </div>
        <p className="microcopy">
          Importera GeoJSON för att se planobjekt färgsatta efter utsläppsintensitet.
        </p>
      </section>
    );
  }

  const points = drawableObjects.flatMap((item) => flattenCoordinates(item));
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const highestIntensity = Math.max(...drawableObjects.map((item) => item.perM2KgCo2e), 1);

  function projectPoint(point: [number, number]) {
    const x = ((point[0] - minX) / width) * 100;
    const y = 100 - ((point[1] - minY) / height) * 100;
    return `${x},${y}`;
  }

  function fillColor(perM2KgCo2e: number) {
    const ratio = perM2KgCo2e / highestIntensity;
    const green = Math.round(150 - ratio * 65);
    const red = Math.round(70 + ratio * 130);
    return `rgb(${red}, ${green}, 110)`;
  }

  return (
    <section className="panel panel-soft">
      <div className="section-heading">
        <p className="eyebrow">Kartvy</p>
        <h3>Planobjekt med utsläppsintensitet</h3>
      </div>
      <svg className="mini-map" viewBox="0 0 100 100" role="img" aria-label="Kartvy över planobjekt">
        {drawableObjects.map((item) => {
          if (!item.geometry) {
            return null;
          }

          if (item.geometry.type === "Point") {
            const [x, y] = item.geometry.coordinates;
            return (
              <circle
                key={item.planObjectId}
                cx={((x - minX) / width) * 100}
                cy={100 - ((y - minY) / height) * 100}
                r={2.8}
                fill={fillColor(item.perM2KgCo2e)}
              />
            );
          }

          const rings =
            item.geometry.type === "Polygon"
              ? item.geometry.coordinates
              : item.geometry.coordinates.flat();

          return rings.map((ring, index) => (
            <polygon
              key={`${item.planObjectId}-${index}`}
              points={ring.map((point) => projectPoint(point as [number, number])).join(" ")}
              fill={fillColor(item.perM2KgCo2e)}
              stroke="rgba(23, 23, 23, 0.35)"
              strokeWidth={0.6}
            />
          ));
        })}
      </svg>
      <div className="map-legend">
        <span>Lägre intensitet</span>
        <div className="map-gradient" aria-hidden="true" />
        <span>Högre intensitet</span>
      </div>
    </section>
  );
}
