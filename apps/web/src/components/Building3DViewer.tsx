import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  formatNumber,
  LABELS,
  type BuildingModel3D,
  type BuildingModel3DPart,
  type CalculationResult,
  type PlanObjectResult,
  type Scenario
} from "../../../../packages/shared/src";
import { importModel3DApi } from "../lib/api";
import {
  buildPartsFromMeshNames,
  findPartForMeshName,
  normalizeBuildingModel3D
} from "../lib/buildingModel3d";
import {
  buildPreviewModelFromDraft,
  draftFromModel,
  type FootprintShapeDraft
} from "../lib/footprintShape";
import { FootprintShapeEditor } from "./FootprintShapeEditor";
import { GeoJsonMap } from "./GeoJsonMap";

interface LocalModelSource {
  fileName: string;
  format: "glb" | "gltf";
  data: ArrayBuffer | string;
}

interface Building3DViewerProps {
  scenario: Scenario | null;
  result: CalculationResult | null;
  onExplain: (traceKey: string) => void;
  onScenarioRefresh: () => Promise<unknown>;
}

const PART_COLORS: Record<BuildingModel3DPart["category"], string> = {
  volym: "#8d8b86",
  stomme: "#4f5a61",
  fasad: "#b7b1aa",
  tak: "#6d6257",
  grund: "#9f8971",
  garage: "#7b6a58",
  installationer: "#8fa29c",
  site: "#c9c1b7"
};

function canRenderWebGL() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }

  if (!window.WebGLRenderingContext) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function formatModelTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getPartTraceValue(result: CalculationResult | null, part?: BuildingModel3DPart | null) {
  if (!result || !part) {
    return undefined;
  }

  const topDriver = part.traceKey
    ? result.topDrivers.find((driver) => driver.traceKey === part.traceKey)
    : undefined;

  if (topDriver) {
    return topDriver.impactKgCo2e;
  }

  return undefined;
}

function summarizePart(part: BuildingModel3DPart | undefined, result: CalculationResult | null) {
  if (!part) {
    return "Välj en del för att se klimatkopplingen.";
  }

  const partValue = getPartTraceValue(result, part);

  if (partValue !== undefined) {
    return `${part.label} driver cirka ${formatNumber(partValue)} kg CO2e i den här körningen.`;
  }

  if (part.climateKgCo2e !== undefined) {
    return `${part.label} är satt till ${formatNumber(part.climateKgCo2e)} kg CO2e i metadata.`;
  }

  if (part.note) {
    return part.note;
  }

  return "Den här delen är kopplad till en klimatdrivare men saknar ännu ett explicit numeriskt värde.";
}

function getPlanObjectFallback(scenario: Scenario | null, result: CalculationResult | null): PlanObjectResult[] {
  if (!scenario) {
    return [];
  }

  if (result?.byPlanObject?.length) {
    return result.byPlanObject;
  }

  return scenario.planObjects
    .filter((planObject) => planObject.geometry)
    .map((planObject, index) => ({
      planObjectId: planObject.id,
      name: planObject.name,
      objectType: planObject.objectType,
      totalKgCo2e: 0,
      perM2KgCo2e: index + 1,
      dominantDriver: "GeoJSON-footprint",
      geometry: planObject.geometry
    }));
}

function createMassingRoot(draft: FootprintShapeDraft) {
  const shape = new THREE.Shape();

  draft.points.forEach((point, index) => {
    if (index === 0) {
      shape.moveTo(point.x, point.y);
      return;
    }

    shape.lineTo(point.x, point.y);
  });
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(draft.heightMeters, 0.1),
    bevelEnabled: false
  });
  geometry.center();

  const material = new THREE.MeshStandardMaterial({
    color: PART_COLORS.volym,
    roughness: 0.92,
    metalness: 0.02
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.partId = "part-volym";
  mesh.position.y = draft.heightMeters / 2;

  const outline = new THREE.EdgesGeometry(geometry);
  const line = new THREE.LineSegments(
    outline,
    new THREE.LineBasicMaterial({ color: "#414141", transparent: true, opacity: 0.75 })
  );
  mesh.add(line);

  const root = new THREE.Group();
  root.add(mesh);
  return root;
}

export function Building3DViewer({
  scenario,
  result,
  onExplain,
  onScenarioRefresh
}: Building3DViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const modelRootRef = useRef<THREE.Group | null>(null);
  const meshLookupRef = useRef(new Map<string, BuildingModel3DPart>());

  const [modelSource, setModelSource] = useState<LocalModelSource | null>(null);
  const [localMetadata, setLocalMetadata] = useState<BuildingModel3D | null>(
    scenario?.buildingModel3D ?? null
  );
  const [derivedMetadata, setDerivedMetadata] = useState<BuildingModel3D | null>(null);
  const [manualDraft, setManualDraft] = useState<FootprintShapeDraft>(() =>
    draftFromModel(scenario?.buildingModel3D ?? null)
  );
  const [manualDraftTouched, setManualDraftTouched] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [selectedPart, setSelectedPart] = useState<BuildingModel3DPart | null>(null);
  const [status, setStatus] = useState<string>("Ladda en GLB eller GLTF för att visa modellen.");
  const [error, setError] = useState<string | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [webglSupported] = useState(() => canRenderWebGL());

  useEffect(() => {
    setLocalMetadata(scenario?.buildingModel3D ?? null);
    setDerivedMetadata(null);
    setManualDraft(draftFromModel(scenario?.buildingModel3D ?? null));
    setManualDraftTouched(false);
    setModelSource(null);
    setSelectedPartId("");
    setSelectedPart(null);
    setError(null);
    setStatus("Ladda en GLB eller GLTF för att visa modellen.");
  }, [scenario?.id]);

  useEffect(() => {
    if (scenario?.buildingModel3D) {
      setLocalMetadata(scenario.buildingModel3D);
    }
  }, [scenario?.buildingModel3D]);

  useEffect(() => {
    if (!manualDraftTouched) {
      setManualDraft(draftFromModel(localMetadata ?? scenario?.buildingModel3D ?? null));
    }
  }, [localMetadata, manualDraftTouched, scenario?.buildingModel3D]);

  const activeMetadata = derivedMetadata ?? localMetadata ?? scenario?.buildingModel3D ?? null;
  const activeParts = useMemo(
    () => activeMetadata?.parts ?? buildPartsFromMeshNames([]),
    [activeMetadata]
  );
  const footprintPlanObjects = useMemo(
    () => getPlanObjectFallback(scenario, result),
    [scenario, result]
  );

  useEffect(() => {
    if (!webglSupported || !mountRef.current) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f5f5f2");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(8, 6, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mountRef.current.clientWidth, Math.max(420, mountRef.current.clientHeight || 420));
    renderer.domElement.className = "model3d-canvas";
    mountRef.current.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.2, 0);
    controls.update();
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight("#ffffff", 1.8);
    const directional = new THREE.DirectionalLight("#ffffff", 1.9);
    directional.position.set(4, 8, 6);
    scene.add(ambient);
    scene.add(directional);
    scene.add(new THREE.GridHelper(18, 18, "#444444", "#bbbbbb"));

    const resizeObserver = new ResizeObserver(() => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) {
        return;
      }

      const width = mountRef.current.clientWidth;
      const height = Math.max(420, mountRef.current.clientHeight || 420);
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    });

    resizeObserver.observe(mountRef.current);

    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    const handlePointerDown = (event: MouseEvent) => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) {
        return;
      }

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(pointerRef.current, cameraRef.current);
      const intersections = raycasterRef.current.intersectObjects(scene.children, true);
      const hit = intersections.find((intersection: THREE.Intersection<THREE.Object3D>) => {
        const mesh = intersection.object as THREE.Mesh;
        return Boolean(mesh.userData?.partId);
      });

      if (!hit) {
        return;
      }

      const mesh = hit.object as THREE.Mesh;
      const part = meshLookupRef.current.get(mesh.uuid);

      if (part) {
        setSelectedPartId(part.id);
        setSelectedPart(part);
        if (part.traceKey) {
          onExplain(part.traceKey);
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.replaceChildren();
      }
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      meshLookupRef.current.clear();
      modelRootRef.current = null;
    };
  }, [onExplain, webglSupported]);

  useEffect(() => {
    if (!modelSource) {
      setDerivedMetadata(null);
      setStatus("Ladda en GLB eller GLTF för att visa modellen.");
      return;
    }

    const loader = new GLTFLoader();
    const importedAt = new Date().toISOString();

    const createLoadedModel = (meshNames: string[]) => ({
      id: `model-${modelSource.fileName}-${importedAt}`,
      name: modelSource.fileName.replace(/\.(glb|gltf)$/i, "") || "3D-modell",
      sourceFormat: modelSource.format,
      sourceFileName: modelSource.fileName,
      importedAt,
      parts: buildPartsFromMeshNames(meshNames),
      notes: ["Härledd från uppladdad modellfil."]
    });

    const data = modelSource.data;
    const onLoad = (gltf: GLTF) => {
      const scene = gltf.scene;

      const meshNames: string[] = [];
      scene.traverse((object: THREE.Object3D) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          meshNames.push(mesh.name || mesh.uuid);
        }
      });

      setDerivedMetadata(createLoadedModel(meshNames));
      setStatus(`${modelSource.fileName} laddad med ${meshNames.length} mesh-delar.`);

      if (sceneRef.current) {
        if (modelRootRef.current) {
          sceneRef.current.remove(modelRootRef.current);
        }

        const root = scene;
        root.traverse((object: THREE.Object3D) => {
          if ((object as THREE.Mesh).isMesh) {
            const mesh = object as THREE.Mesh;
            mesh.material = Array.isArray(mesh.material)
              ? mesh.material.map((material) => material.clone())
              : mesh.material.clone();
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        modelRootRef.current = root;
        sceneRef.current.add(root);
      }
    };

    const onError = (reason: unknown) => {
      const message = reason instanceof Error ? reason.message : "Modellen kunde inte tolkas.";
      setError(message);
      setStatus("Det gick inte att läsa modellfilen.");
    };

    try {
      if (typeof data === "string") {
        loader.parse(data, "", onLoad, onError);
      } else {
        loader.parse(data, "", onLoad, onError);
      }
    } catch (exception) {
      onError(exception);
    }
  }, [modelSource]);

  useEffect(() => {
    if (!webglSupported || modelSource || !sceneRef.current) {
      return;
    }

    const displayDraft = manualDraftTouched
      ? manualDraft
      : draftFromModel(localMetadata ?? scenario?.buildingModel3D ?? null);
    const previewModel = buildPreviewModelFromDraft(
      displayDraft,
      localMetadata ?? scenario?.buildingModel3D ?? null
    );
    setDerivedMetadata(previewModel);
    setStatus(
      `Förhandsvisar en manuell ${displayDraft.mode === "rectangle" ? "rektangel" : "polygon"} med ${displayDraft.points.length} hörn.`
    );

    if (sceneRef.current && modelRootRef.current) {
      sceneRef.current.remove(modelRootRef.current);
    }

    const root = createMassingRoot(displayDraft);
    modelRootRef.current = root;
    sceneRef.current.add(root);

    const resolvedParts = previewModel.parts;
    const nextLookup = new Map<string, BuildingModel3DPart>();
    root.traverse((object: THREE.Object3D) => {
      if (!(object as THREE.Mesh).isMesh) {
        return;
      }

      const mesh = object as THREE.Mesh;
      const part = findPartForMeshName(resolvedParts, mesh.name || mesh.uuid) ?? resolvedParts[0];
      if (part) {
        nextLookup.set(mesh.uuid, part);
        mesh.userData.partId = part.id;
      }
    });
    meshLookupRef.current = nextLookup;

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 1);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (camera && controls) {
      const distance = maxDimension * 1.9;
      camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
      camera.near = Math.max(0.1, distance / 100);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
    }

    return () => {
      if (sceneRef.current && modelRootRef.current === root) {
        sceneRef.current.remove(root);
      }
    };
  }, [localMetadata, manualDraft, manualDraftTouched, modelSource, scenario?.buildingModel3D, webglSupported]);

  useEffect(() => {
    if (activeParts.length === 0) {
      setSelectedPartId("");
      setSelectedPart(null);
      return;
    }

    const nextPart = activeParts.find((part) => part.id === selectedPartId) ?? activeParts[0];
    if (nextPart.id !== selectedPartId) {
      setSelectedPartId(nextPart.id);
    }
    setSelectedPart(nextPart);
  }, [activeParts, selectedPartId]);

  useEffect(() => {
    if (!sceneRef.current || !modelRootRef.current) {
      return;
    }

    const resolvedParts = activeParts;
    const nextLookup = new Map<string, BuildingModel3DPart>();

    modelRootRef.current.traverse((object: THREE.Object3D) => {
      if (!(object as THREE.Mesh).isMesh) {
        return;
      }

      const mesh = object as THREE.Mesh;
      const part = findPartForMeshName(resolvedParts, mesh.name || mesh.uuid);
      if (part) {
        nextLookup.set(mesh.uuid, part);
        mesh.userData.partId = part.id;
      }

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material: THREE.Material) => {
        if ("color" in material) {
          const baseColor = part ? PART_COLORS[part.category] : "#8f8b84";
          (material as THREE.MeshStandardMaterial).color = new THREE.Color(baseColor);
          (material as THREE.MeshStandardMaterial).roughness = 0.95;
          (material as THREE.MeshStandardMaterial).metalness = 0.02;
          (material as THREE.MeshStandardMaterial).emissive = new THREE.Color("#111111");
          (material as THREE.MeshStandardMaterial).emissiveIntensity =
            selectedPartId && part?.id === selectedPartId ? 0.25 : 0.03;
        }
      });
    });

    meshLookupRef.current = nextLookup;

    const box = new THREE.Box3().setFromObject(modelRootRef.current);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 1);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (camera && controls) {
      const distance = maxDimension * 1.9;
      camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
      camera.near = Math.max(0.1, distance / 100);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
    }
  }, [activeParts, selectedPartId]);

  useEffect(() => {
    if (!modelRootRef.current || !sceneRef.current) {
      return;
    }

    modelRootRef.current.traverse((object: THREE.Object3D) => {
      if (!(object as THREE.Mesh).isMesh) {
        return;
      }

      const mesh = object as THREE.Mesh;
      const part = meshLookupRef.current.get(mesh.uuid);
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material: THREE.Material) => {
        if ("emissive" in material) {
          const active = selectedPartId && part?.id === selectedPartId;
          (material as THREE.MeshStandardMaterial).emissive.set(active ? "#ba8b12" : "#111111");
          (material as THREE.MeshStandardMaterial).emissiveIntensity = active ? 0.5 : 0.04;
        }
      });
    });
  }, [selectedPartId]);

  const resolvedPart = activeParts.find((part) => part.id === selectedPartId) ?? selectedPart ?? undefined;
  const partSummary = summarizePart(resolvedPart, result);

  async function handleModelFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const format = file.name.toLowerCase().endsWith(".glb") ? "glb" : "gltf";
    const data = format === "glb" ? await file.arrayBuffer() : await file.text();
    setModelSource({
      fileName: file.name,
      format,
      data
    });
    setSelectedPartId("");
    setSelectedPart(null);
  }

  async function handleMetadataFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    if (!scenario) {
      setError("Välj ett scenario innan du sparar metadata.");
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      const normalized = normalizeBuildingModel3D({
        ...raw,
        importedAt: raw.importedAt ?? new Date().toISOString(),
        sourceFormat:
          typeof raw.sourceFormat === "string"
            ? raw.sourceFormat
            : modelSource?.format ?? "gltf",
        sourceFileName: modelSource?.fileName ?? raw.sourceFileName
      });

      setSavingMetadata(true);
      const response = await importModel3DApi(scenario.id, { model: normalized });
      setLocalMetadata(response.model);
      setManualDraftTouched(false);
      await onScenarioRefresh();
      setStatus(`${response.model.name} sparad som scenario-metadata.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Metadata kunde inte läsas.");
    } finally {
      setSavingMetadata(false);
      event.target.value = "";
    }
  }

  async function handleManualShapeSave() {
    setError(null);
    if (!scenario) {
      setError("Välj ett scenario innan du sparar formen.");
      return;
    }

    try {
      const model = buildPreviewModelFromDraft(manualDraft, localMetadata ?? scenario?.buildingModel3D ?? null);
      setSavingMetadata(true);
      const response = await importModel3DApi(scenario.id, { model });
      setLocalMetadata(response.model);
      setDerivedMetadata(response.model);
      setManualDraftTouched(false);
      await onScenarioRefresh();
      setStatus(`${response.model.name} sparad från den manuella formredigeraren.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Formen kunde inte sparas.");
    } finally {
      setSavingMetadata(false);
    }
  }

  return (
    <section className="panel panel-soft building3d-panel">
      <div className="section-heading">
        <p className="eyebrow">3D-modell</p>
        <h3>GeoJSON + GLB/GLTF med klickbar klimat-attribution</h3>
      </div>
      <p className="microcopy">
        Ladda en modellfil för att rotera huset, eller rita formen direkt i footprint-editorn nedan.
        Varje del kan mappas till stomme, fasad, tak, grund, garage eller installationer och kopplas
        till samma klimatspår som resultatmodulen använder.
      </p>

      <FootprintShapeEditor
        value={manualDraft}
        onChange={(next) => {
          setManualDraftTouched(true);
          setManualDraft(next);
        }}
        onSave={handleManualShapeSave}
        saving={savingMetadata}
        disabled={!scenario}
      />

      <div className="three-upload-grid">
        <label>
          3D-modellfil
          <input type="file" accept=".glb,.gltf" onChange={handleModelFileChange} />
        </label>
        <label>
          Klimatmetadata JSON
          <input type="file" accept=".json" onChange={handleMetadataFileChange} />
        </label>
        <div className="inline-panel">
          <strong>Status</strong>
          <span>{status}</span>
          <span>{webglSupported ? "WebGL-stöd finns i den här miljön." : "WebGL saknas, så vi visar 2D-fallback."}</span>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="building3d-layout">
        {webglSupported ? (
          <div className="building3d-viewport">
            <div ref={mountRef} className="building3d-canvas-host" />
            <div className="building3d-caption">
              <strong>{modelSource?.fileName ?? activeMetadata?.name ?? "Manuell byggnadsvolym"}</strong>
              <span>
                {activeMetadata ? `${activeMetadata.parts.length} del${activeMetadata.parts.length === 1 ? "" : "ar"} i metadata` : "Auto-detekterade delar"}
              </span>
              <span>{activeMetadata?.importedAt ? formatModelTime(activeMetadata.importedAt) : "Inte sparad än"}</span>
            </div>
          </div>
        ) : (
          <div className="building3d-fallback">
            <GeoJsonMap planObjects={footprintPlanObjects} />
            <p className="microcopy">
              När du laddar en GLB/GLTF-fil visas modellen här. Tills dess använder vi scenariots GeoJSON-footprint som lägesstöd.
            </p>
          </div>
        )}

        <aside className="building3d-inspector">
          <div className="section-heading">
            <p className="eyebrow">Vald del</p>
            <h4>{resolvedPart ? resolvedPart.label : "Ingen vald del"}</h4>
          </div>
          <p className="microcopy">{partSummary}</p>
          {resolvedPart ? (
            <div className="inline-panel">
              <strong>{LABELS.model3DPartCategory[resolvedPart.category]}</strong>
              <span>Mesh-namn: {resolvedPart.meshNames.join(", ") || "Auto"}</span>
              <span>
                Klimatspår: {resolvedPart.traceKey ?? "Ingen koppling ännu"}
              </span>
              {resolvedPart.climateKgCo2e !== undefined ? (
                <span>{formatNumber(resolvedPart.climateKgCo2e)} kg CO2e i metadata</span>
              ) : null}
            </div>
          ) : null}

          <div className="insight-list building3d-part-list">
            {activeParts.map((part) => (
              <button
                key={part.id}
                type="button"
                className={`list-button building3d-part-button ${
                  selectedPartId === part.id ? "list-button-active" : ""
                }`}
                onClick={() => {
                  setSelectedPartId(part.id);
                  setSelectedPart(part);
                  if (part.traceKey) {
                    onExplain(part.traceKey);
                  }
                }}
              >
                <strong>{part.label}</strong>
                <span>
                  {LABELS.model3DPartCategory[part.category]}{" "}
                  {part.climateKgCo2e !== undefined ? `• ${formatNumber(part.climateKgCo2e)} kg CO2e` : ""}
                </span>
              </button>
            ))}
          </div>

          <div className="building3d-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setModelSource(null);
                setDerivedMetadata(null);
                setSelectedPartId("");
                setSelectedPart(null);
                setStatus("Ladda en GLB eller GLTF för att visa modellen.");
              }}
            >
              Rensa lokal modell
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onScenarioRefresh()}
              disabled={savingMetadata}
            >
              {savingMetadata ? "Sparar..." : "Uppdatera scenario"}
            </button>
          </div>

          <p className="microcopy">
            GeoJSON-fallbacken visar footprint, medan 3D-vyn används för att förstå formfaktor och klimatposter per byggnadsdel.
          </p>
        </aside>
      </div>
    </section>
  );
}
