import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";

import { formatNumber } from "../../../../packages/shared/src";
import {
  createDefaultFootprintDraft,
  createRectanglePoints,
  getFootprintBounds,
  getFootprintMetrics,
  insertCorner,
  movePoint,
  removeCorner,
  setDraftHeight,
  setDraftSize,
  translatePoints,
  type FootprintPoint,
  type FootprintShapeDraft
} from "../lib/footprintShape";

interface FootprintShapeEditorProps {
  value: FootprintShapeDraft;
  onChange: (next: FootprintShapeDraft) => void;
  onSave: () => void;
  saving?: boolean;
  disabled?: boolean;
}

interface DragState {
  kind: "corner" | "shape";
  index?: number;
  startX: number;
  startY: number;
  points: FootprintPoint[];
  viewBox: {
    minX: number;
    minY: number;
    width: number;
    height: number;
  };
}

function pointString(points: FootprintPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

const FOOTPRINT_CANVAS_VIEWBOX = {
  minX: -60,
  minY: -42,
  width: 120,
  height: 84
};

export function FootprintShapeEditor({
  value,
  onChange,
  onSave,
  saving = false,
  disabled = false
}: FootprintShapeEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const bounds = useMemo(() => getFootprintBounds(value.points), [value.points]);
  const metrics = useMemo(
    () => getFootprintMetrics(value.points, value.heightMeters),
    [value.points, value.heightMeters]
  );
  const viewBox = FOOTPRINT_CANVAS_VIEWBOX;

  const recalcSelection = (nextPoints: FootprintPoint[]) => {
    if (selectedPointIndex === null || selectedPointIndex < nextPoints.length) {
      return;
    }

    setSelectedPointIndex(null);
  };

  const commitPoints = (nextPoints: FootprintPoint[], mode = value.mode) => {
    const nextBounds = getFootprintBounds(nextPoints);
    onChange({
      ...value,
      mode,
      points: nextPoints,
      widthMeters: nextBounds.width,
      depthMeters: nextBounds.height
    });
    recalcSelection(nextPoints);
  };

  const updateDraftFromPointer = (pointerEvent: PointerEvent, sourceViewBox = viewBox) => {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }

    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    return {
      x: sourceViewBox.minX + ((pointerEvent.clientX - rect.left) / rect.width) * sourceViewBox.width,
      y: sourceViewBox.minY + ((pointerEvent.clientY - rect.top) / rect.height) * sourceViewBox.height
    };
  };

  const handlePointerMove = (pointerEvent: PointerEvent) => {
    if (!dragState) {
      return;
    }

    const point = updateDraftFromPointer(pointerEvent, dragState.viewBox);
    if (!point) {
      return;
    }

    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;

    if (dragState.kind === "shape") {
      commitPoints(translatePoints(dragState.points, deltaX, deltaY), value.mode);
      return;
    }

    if (dragState.kind === "corner" && typeof dragState.index === "number") {
      const nextPoints = movePoint(
        dragState.points,
        dragState.index,
        {
          x: dragState.points[dragState.index].x + deltaX,
          y: dragState.points[dragState.index].y + deltaY
        },
        value.mode
      );
      commitPoints(nextPoints, value.mode);
    }
  };

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      handlePointerMove(event);
    };

    const handleWindowPointerUp = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
    };
  }, [dragState]);

  const handleCornerPointerDown = (index: number, event: ReactPointerEvent<SVGElement>) => {
    if (disabled) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    const point = updateDraftFromPointer(event.nativeEvent);
    if (!point) {
      return;
    }

    setSelectedPointIndex(index);
    setDragState({
      kind: "corner",
      index,
      startX: point.x,
      startY: point.y,
      points: value.points.map((entry) => ({ ...entry })),
      viewBox
    });
  };

  const handleShapePointerDown = (event: ReactPointerEvent<SVGElement>) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    const point = updateDraftFromPointer(event.nativeEvent);
    if (!point) {
      return;
    }

    setDragState({
      kind: "shape",
      startX: point.x,
      startY: point.y,
      points: value.points.map((entry) => ({ ...entry })),
      viewBox
    });
  };

  const handleRectangleMode = () => {
    if (disabled) {
      return;
    }

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    onChange({
      ...value,
      mode: "rectangle",
      points: createRectanglePoints(value.widthMeters, value.depthMeters).map((point) => ({
        x: point.x + centerX,
        y: point.y + centerY
      }))
    });
    setSelectedPointIndex(null);
  };

  const handlePolygonMode = () => {
    if (disabled) {
      return;
    }

    onChange({
      ...value,
      mode: "polygon"
    });
  };

  const handleAddCorner = () => {
    if (disabled) {
      return;
    }

    const next = insertCorner(value.points);
    commitPoints(next.points, "polygon");
    setSelectedPointIndex(next.insertedIndex);
  };

  const handleRemoveCorner = () => {
    if (disabled || selectedPointIndex === null) {
      return;
    }

    const nextPoints = removeCorner(value.points, selectedPointIndex);
    commitPoints(nextPoints, value.mode);
    setSelectedPointIndex(null);
  };

  const handleReset = () => {
    if (disabled) {
      return;
    }

    onChange(createDefaultFootprintDraft());
    setSelectedPointIndex(null);
    setDragState(null);
  };

  const adjustRectangleSize = (widthDelta: number, depthDelta: number) => {
    if (disabled || value.mode !== "rectangle") {
      return;
    }

    onChange(
      setDraftSize(value, value.widthMeters + widthDelta, value.depthMeters + depthDelta)
    );
  };

  return (
    <section className="panel panel-soft footprint-editor">
      <div className="section-heading">
        <p className="eyebrow">Formredigering</p>
        <h4>Byggnaden kan ritas manuellt</h4>
      </div>
      <p className="microcopy">
        Ange mått direkt, dra i rektangeln för att flytta den, eller växla till polygonläge för att
        lägga till hörn och få en mer exakt formfaktor. Ritytan är låst i en fast skala så att
        dragning och storleksändringar blir lätta att se direkt i vyn.
      </p>

      <div className="footprint-toolbar">
        <button
          type="button"
          className={`ghost-button ${value.mode === "rectangle" ? "ghost-button-active" : ""}`}
          onClick={handleRectangleMode}
          disabled={disabled}
        >
          Rektangel
        </button>
        <button
          type="button"
          className={`ghost-button ${value.mode === "polygon" ? "ghost-button-active" : ""}`}
          onClick={handlePolygonMode}
          disabled={disabled}
        >
          Polygon
        </button>
        <button type="button" className="ghost-button" onClick={handleAddCorner} disabled={disabled}>
          Lägg till hörn
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={handleRemoveCorner}
          disabled={disabled || selectedPointIndex === null}
        >
          Ta bort hörn
        </button>
        <button type="button" className="ghost-button" onClick={handleReset} disabled={disabled}>
          Återställ
        </button>
      </div>

      <div className="footprint-grid">
        <label>
          Bredd
          <input
            type="number"
            min="0"
            step="0.1"
            value={value.widthMeters}
            onChange={(event) => onChange(setDraftSize(value, Number(event.target.value), value.depthMeters))}
            disabled={disabled || value.mode !== "rectangle"}
          />
        </label>
        <label>
          Djup
          <input
            type="number"
            min="0"
            step="0.1"
            value={value.depthMeters}
            onChange={(event) => onChange(setDraftSize(value, value.widthMeters, Number(event.target.value)))}
            disabled={disabled || value.mode !== "rectangle"}
          />
        </label>
        <label>
          Höjd
          <input
            type="number"
            min="0"
            step="0.1"
            value={value.heightMeters}
            onChange={(event) => onChange(setDraftHeight(value, Number(event.target.value)))}
            disabled={disabled}
          />
        </label>
        <div className="inline-panel">
          <strong>Formfaktor</strong>
          <span>{metrics.formFactor > 0 ? `${formatNumber(metrics.formFactor, 2)} 1/m` : "0 1/m"}</span>
          <span>{formatNumber(metrics.areaM2, 1)} m2 footprint</span>
        </div>
      </div>

      {value.mode === "rectangle" ? (
        <div className="footprint-stepper-row" aria-label="Snabbjustering av rektangelform">
          <span>Snabbjustera:</span>
          <button type="button" className="ghost-button ghost-button-small" onClick={() => adjustRectangleSize(-1, 0)} disabled={disabled}>
            Bredd −1 m
          </button>
          <button type="button" className="ghost-button ghost-button-small" onClick={() => adjustRectangleSize(1, 0)} disabled={disabled}>
            Bredd +1 m
          </button>
          <button type="button" className="ghost-button ghost-button-small" onClick={() => adjustRectangleSize(0, -1)} disabled={disabled}>
            Djup −1 m
          </button>
          <button type="button" className="ghost-button ghost-button-small" onClick={() => adjustRectangleSize(0, 1)} disabled={disabled}>
            Djup +1 m
          </button>
        </div>
      ) : null}

      {value.mode === "polygon" ? (
        <p className="microcopy">
          Polygonläge: bredd {formatNumber(value.widthMeters, 1)} m, djup {formatNumber(value.depthMeters, 1)} m.
        </p>
      ) : (
        <p className="microcopy">Rektangelläget är låst till fyra hörn och kan flyttas eller skalas med musen.</p>
      )}

      <div className="footprint-canvas-shell">
        <svg
          ref={svgRef}
          className="footprint-canvas"
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label="Redigerbar footprint"
        >
          <defs>
            <pattern id="footprint-grid" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M 4 0 L 0 0 0 4" fill="none" stroke="#d8d8d3" strokeWidth="0.15" />
            </pattern>
          </defs>
          <rect
            x={viewBox.minX}
            y={viewBox.minY}
            width={viewBox.width}
            height={viewBox.height}
            fill="url(#footprint-grid)"
          />
          {value.mode === "rectangle" ? (
            <rect
              x={bounds.minX}
              y={bounds.minY}
              width={bounds.width}
              height={bounds.height}
              className="footprint-hit-area"
              onPointerDown={handleShapePointerDown}
            />
          ) : null}
          <polygon
            points={pointString(value.points)}
            className="footprint-shape"
            onPointerDown={handleShapePointerDown}
          />
          {value.points.map((point, index) => (
            <g key={`${index}-${point.x}-${point.y}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="1.1"
                className={`footprint-handle-hit ${
                  selectedPointIndex === index ? "footprint-handle-hit-active" : ""
                }`}
                onPointerDown={(event) => handleCornerPointerDown(index, event)}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="0.45"
                className={`footprint-handle ${
                  selectedPointIndex === index ? "footprint-handle-active" : ""
                }`}
                onPointerDown={(event) => handleCornerPointerDown(index, event)}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="inline-panel">
        <strong>Geometri</strong>
        <span>Area {formatNumber(metrics.areaM2, 1)} m2</span>
        <span>Omkrets {formatNumber(metrics.perimeterM, 1)} m</span>
        <span>Höjd {formatNumber(value.heightMeters, 1)} m</span>
      </div>

      <div className="building3d-actions">
        <button type="button" className="ghost-button" onClick={onSave} disabled={disabled || saving}>
          {saving ? "Sparar..." : "Spara form"}
        </button>
      </div>
    </section>
  );
}
