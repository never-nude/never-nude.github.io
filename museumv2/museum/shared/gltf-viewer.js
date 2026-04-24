import { createViewerDefaults, renderViewerShell } from "./viewer-shell.js?v=20260424-1515";
import { createPedestalMesh, inferPedestalEnabled, resolveObjectPedestalRadius, resolvePedestalHeight } from "./pedestal.js";

const DEFAULT_PRIMARY_TIMEOUT_MS = 45000;
const DEFAULT_FALLBACK_TIMEOUT_MS = 30000;
const DEFAULT_TARGET_HEIGHT = 1.58;
const DEFAULT_MODEL_YAW = 0;
const AUTO_ROTATE_RESUME_DELAY_MS = 5000;
const DEFAULT_PRIMARY_LOADING_TEXT = "Loading high-fidelity source model...";
const DEFAULT_FALLBACK_LOADING_TEXT = "Loading optimized source model...";
const DEFAULT_SWITCH_LOADING_TEXT = "Primary source unavailable; switching to fallback model...";
const DEFAULT_DARK_STAGE = Object.freeze({
  background: 0x050505,
  hemiSky: 0xf7eadf,
  hemiGround: 0x050505,
  key: 0xffd7b8,
  fill: 0x93acd7,
  rim: 0xf6ecdf,
  bounce: 0x7b6044,
  pedestal: 0x171717
});
let threeModulesPromise = null;

function suggestedRoughness(piece, currentValue) {
  const medium = String(piece?.medium || "").toLowerCase();
  if (/bronze|brass|copper|metal|alloy/.test(medium)) {
    return Math.max(0.36, currentValue);
  }
  if (/terracotta|wood|oak|cedar|paint/.test(medium)) {
    return Math.max(0.48, currentValue);
  }
  return Math.max(0.54, currentValue);
}

function getThreeModules() {
  if (!threeModulesPromise) {
    threeModulesPromise = (async () => {
      const THREE = await import("https://esm.sh/three@0.161.0?bundle");
      const { OrbitControls } = await import("https://esm.sh/three@0.161.0/examples/jsm/controls/OrbitControls.js?bundle");
      const { GLTFLoader } = await import("https://esm.sh/three@0.161.0/examples/jsm/loaders/GLTFLoader.js?bundle");
      const { DRACOLoader } = await import("https://esm.sh/three@0.161.0/examples/jsm/loaders/DRACOLoader.js?bundle");
      const { RoomEnvironment } = await import("https://esm.sh/three@0.161.0/examples/jsm/environments/RoomEnvironment.js?bundle");
      return { THREE, OrbitControls, GLTFLoader, DRACOLoader, RoomEnvironment };
    })();
  }

  return threeModulesPromise;
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function normalizeUrls(urlOrUrls) {
  if (!urlOrUrls) return [];
  return Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
}

async function fetchModelByteLength(urlOrUrls) {
  const urls = normalizeUrls(urlOrUrls);
  if (!urls.length) return null;

  const lengths = await Promise.all(
    urls.map(async (url) => {
      try {
        const head = await fetch(url, { method: "HEAD" });
        if (!head.ok) return null;
        const len = Number(head.headers.get("content-length"));
        return Number.isFinite(len) && len > 0 ? len : null;
      } catch {
        return null;
      }
    })
  );

  const total = lengths.reduce((sum, value) => sum + (value || 0), 0);
  return total > 0 ? total : null;
}

function bootError(message, error) {
  console.error(error);
  if (!document.body.innerHTML.trim()) {
    document.body.textContent = message;
  }
}

function chooseInitialModelUrls(model, hasDistinctFallback) {
  const primaryUrls = normalizeUrls(model.primaryUrl || model.url);
  const fallbackUrls = normalizeUrls(model.fallbackUrl || model.primaryUrl || model.url);
  const fullQueryParam = model.fullQueryParam;
  const params = new URLSearchParams(window.location.search);

  if (fullQueryParam) {
    if (params.get(fullQueryParam) === "1") {
      return primaryUrls;
    }
  }

  if (params.get("preview") === "1" && hasDistinctFallback) {
    return fallbackUrls;
  }
  if (model.preferFallback && hasDistinctFallback) {
    return fallbackUrls;
  }
  if (window.matchMedia("(max-width: 820px)").matches && hasDistinctFallback) {
    return fallbackUrls;
  }

  return primaryUrls;
}

function loadMessageForUrls(piece, urls, primaryUrls, fallbackUrls) {
  const view = piece.view || {};
  const key = normalizeUrls(urls).join("|");
  if (key === normalizeUrls(fallbackUrls).join("|") && key !== normalizeUrls(primaryUrls).join("|")) {
    return view.fallbackLoadingText || DEFAULT_FALLBACK_LOADING_TEXT;
  }
  return view.primaryLoadingText || DEFAULT_PRIMARY_LOADING_TEXT;
}

function sameUrlSet(a, b) {
  const aa = normalizeUrls(a);
  const bb = normalizeUrls(b);
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

function triangleCountForObject(root) {
  let total = 0;
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    if (child.geometry.index) {
      total += child.geometry.index.count / 3;
      return;
    }
    const positions = child.geometry.getAttribute("position");
    if (positions) {
      total += positions.count / 3;
    }
  });
  return Math.round(total);
}

function solveLinear3x3(matrix, vector) {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivotIndex = 0; pivotIndex < 3; pivotIndex += 1) {
    let pivotRow = pivotIndex;
    for (let row = pivotIndex + 1; row < 3; row += 1) {
      if (Math.abs(augmented[row][pivotIndex]) > Math.abs(augmented[pivotRow][pivotIndex])) {
        pivotRow = row;
      }
    }

    const pivotValue = augmented[pivotRow][pivotIndex];
    if (Math.abs(pivotValue) < 1e-8) {
      return null;
    }

    if (pivotRow !== pivotIndex) {
      [augmented[pivotIndex], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivotIndex]];
    }

    for (let row = pivotIndex + 1; row < 3; row += 1) {
      const factor = augmented[row][pivotIndex] / augmented[pivotIndex][pivotIndex];
      for (let column = pivotIndex; column < 4; column += 1) {
        augmented[row][column] -= augmented[pivotIndex][column] * factor;
      }
    }
  }

  const solution = [0, 0, 0];
  for (let row = 2; row >= 0; row -= 1) {
    let value = augmented[row][3];
    for (let column = row + 1; column < 3; column += 1) {
      value -= augmented[row][column] * solution[column];
    }
    solution[row] = value / augmented[row][row];
  }

  return solution;
}

function fitBottomPlaneNormal(points, THREE) {
  if (points.length < 3) return null;

  let sumXX = 0;
  let sumXZ = 0;
  let sumX = 0;
  let sumZZ = 0;
  let sumZ = 0;
  let sumXY = 0;
  let sumZY = 0;
  let sumY = 0;

  for (const point of points) {
    const { x, y, z } = point;
    sumXX += x * x;
    sumXZ += x * z;
    sumX += x;
    sumZZ += z * z;
    sumZ += z;
    sumXY += x * y;
    sumZY += z * y;
    sumY += y;
  }

  const coefficients = solveLinear3x3(
    [
      [sumXX, sumXZ, sumX],
      [sumXZ, sumZZ, sumZ],
      [sumX, sumZ, points.length]
    ],
    [sumXY, sumZY, sumY]
  );

  if (!coefficients) return null;

  const [a, b] = coefficients;
  const normal = new THREE.Vector3(-a, 1, -b).normalize();
  if (normal.y < 0) {
    normal.multiplyScalar(-1);
  }
  return normal;
}

function collectBottomPlaneNormal(root, THREE, options = {}) {
  const sampledPoints = [];
  let vertexCount = 0;

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const positions = child.geometry.getAttribute("position");
    if (!positions) return;
    vertexCount += positions.count;
  });

  if (vertexCount < 3) return null;

  const maxSamples = options.maxSamples ?? 18000;
  const stride = Math.max(1, Math.ceil(vertexCount / maxSamples));
  const temp = new THREE.Vector3();
  let sampledIndex = 0;
  let minY = Infinity;
  let maxY = -Infinity;

  root.updateMatrixWorld(true);

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const positions = child.geometry.getAttribute("position");
    if (!positions) return;

    for (let index = 0; index < positions.count; index += 1) {
      if (sampledIndex % stride !== 0) {
        sampledIndex += 1;
        continue;
      }

      sampledIndex += 1;
      temp.fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld);
      sampledPoints.push({ x: temp.x, y: temp.y, z: temp.z });
      minY = Math.min(minY, temp.y);
      maxY = Math.max(maxY, temp.y);
    }
  });

  if (sampledPoints.length < 3) return null;

  const height = Math.max(maxY - minY, 1e-6);
  const sortedY = sampledPoints.map((point) => point.y).sort((a, b) => a - b);
  const percentile = options.bottomPercentile ?? 0.015;
  const percentileIndex = Math.min(sortedY.length - 1, Math.floor(sortedY.length * percentile));
  const bottomStart = sortedY[percentileIndex];
  const bottomRatio = options.bottomRatio ?? 0.04;
  const threshold = bottomStart + height * bottomRatio;
  const bottomPoints = sampledPoints.filter((point) => point.y <= threshold);

  return fitBottomPlaneNormal(bottomPoints, THREE);
}

export async function initGltfMuseumPage(piece) {
  const defaults = createViewerDefaults(piece.defaults);
  defaults.rough = suggestedRoughness(piece, defaults.rough);
  const model = piece.model || {};
  const sceneConfig = piece.scene || {};
  const primaryUrls = normalizeUrls(model.primaryUrl || model.url);
  const fallbackUrls = normalizeUrls(model.fallbackUrl || model.primaryUrl || model.url);
  const hasDistinctFallback = !sameUrlSet(primaryUrls, fallbackUrls);
  const initialUrls = chooseInitialModelUrls(model, hasDistinctFallback);
  const initialLoadingText = loadMessageForUrls(piece, initialUrls, primaryUrls, fallbackUrls);

  const ui = renderViewerShell({
    pageTitle: piece.pageTitle,
    viewerTitle: piece.viewerTitle,
    subtitle: piece.subtitle,
    medium: piece.medium,
    dimensions: piece.dimensions,
    location: piece.location,
    locationLabel: piece.locationLabel,
    region: piece.region,
    period: piece.period,
    gallery: piece.gallery,
    scanSource: piece.scan_source || piece.lobbyMeta,
    meshFormat: piece.mesh_format,
    source: piece.source,
    statsLoading: initialLoadingText,
    loadingText: initialLoadingText,
    defaults,
    controlsHint: piece.controlsHint,
    relatedWorks: piece.relatedWorks,
    prevPiece: piece.prevPiece,
    nextPiece: piece.nextPiece,
    downloadHref: normalizeUrls(primaryUrls)[0] || "",
    downloadLabel: piece.mesh_format ? `Download ${piece.mesh_format}` : "Download Model"
  });

  ui.setDefaults();

  const primaryTimeoutMs = piece.timeouts?.primaryMs || DEFAULT_PRIMARY_TIMEOUT_MS;
  const fallbackTimeoutMs = piece.timeouts?.fallbackMs || DEFAULT_FALLBACK_TIMEOUT_MS;
  const searchParams = new URLSearchParams(window.location.search);
  const embedMode = searchParams.get("embed") || searchParams.get("mode") || "";
  const isHeroEmbed = embedMode === "hero";
  const isPreviewMode = isHeroEmbed || searchParams.get("preview") === "1";
  const stagePalette = DEFAULT_DARK_STAGE;
  const exposureBoost = 0;
  const defaultYaw = sceneConfig.defaultYaw ?? DEFAULT_MODEL_YAW;
  const rotateX = sceneConfig.rotateX ?? 0;
  const rotateY = sceneConfig.rotateY ?? 0;
  const rotateZ = sceneConfig.rotateZ ?? 0;
  const verticalOffset = sceneConfig.verticalOffset ?? 0;
  const autoLevel = sceneConfig.autoLevel ?? false;
  const targetHeight = sceneConfig.targetHeight ?? DEFAULT_TARGET_HEIGHT;
  const showPedestal = !isPreviewMode && inferPedestalEnabled(piece, sceneConfig);
  const pedestalHeight = showPedestal ? resolvePedestalHeight(sceneConfig, targetHeight) : 0.004;
  const focusYRatio = sceneConfig.focusYRatio ?? 0.57;
  const stage = ui.stage;
  const stats = ui.stats;
  const isChecked = (id) => document.getElementById(id)?.checked ?? Boolean(defaults[id]);

  try {
    const { THREE, OrbitControls, GLTFLoader, DRACOLoader, RoomEnvironment } = await getThreeModules();
    const isMobileRender = window.matchMedia("(max-width: 820px)").matches;
    let modelUrlsInUse = initialUrls;

    const setLoadingState = (message) => {
      stats.textContent = message;
      ui.setLoadingState(message);
    };

    setLoadingState(initialLoadingText);

    let modelByteLength = await fetchModelByteLength(modelUrlsInUse);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isPreviewMode ? 1 : isMobileRender ? 1.15 : 1.8));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.setClearColor(stagePalette.background, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = defaults.exposure + exposureBoost;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(44, stage.clientWidth / stage.clientHeight, 0.01, 120);
    camera.position.set(2.3, 1.6, defaults.zoom);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;

    const hemi = new THREE.HemisphereLight(stagePalette.hemiSky, stagePalette.hemiGround, 0.42);
    scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.14);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(stagePalette.key, defaults.lightPower);
    keyLight.castShadow = true;
    const shadowMapSize = isPreviewMode ? 768 : isMobileRender ? 1024 : 1536;
    keyLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -3.2;
    keyLight.shadow.camera.right = 3.2;
    keyLight.shadow.camera.top = 3.2;
    keyLight.shadow.camera.bottom = -3.2;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(stagePalette.fill, defaults.lightPower * 0.4);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(stagePalette.rim, defaults.lightPower * 0.62);
    scene.add(rimLight);

    const bounceLight = new THREE.PointLight(stagePalette.bounce, defaults.lightPower * 0.16, 10, 2);
    bounceLight.position.set(0.0, 0.72, 1.1);
    scene.add(bounceLight);

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: isPreviewMode ? 0.18 : 0.28 })
    );
    shadowPlane.rotation.x = -Math.PI * 0.5;
    shadowPlane.position.y = 0.001;
    shadowPlane.receiveShadow = sceneConfig.receiveFloorShadow ?? true;
    scene.add(shadowPlane);

    const contactDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: isPreviewMode ? 0.08 : 0.12 })
    );
    contactDisc.rotation.x = -Math.PI * 0.5;
    contactDisc.position.y = 0.002;
    scene.add(contactDisc);

    let sculpture = null;
    let focusY = 1.0;
    const trackedMaterials = [];

    function rememberMaterial(material) {
      if (!material || trackedMaterials.some((entry) => entry.material === material)) return;
      trackedMaterials.push({
        material,
        roughness: typeof material.roughness === "number" ? material.roughness : null,
        wireframe: !!material.wireframe
      });
    }

    try {
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
      loader.setDRACOLoader(dracoLoader);
      let models = null;
      const startUrls = modelUrlsInUse;
      const startTimeout = sameUrlSet(startUrls, primaryUrls) ? primaryTimeoutMs : fallbackTimeoutMs;

      try {
        models = await Promise.all(
          normalizeUrls(startUrls).map((url) => withTimeout(loader.loadAsync(url), startTimeout, "glTF load"))
        );
      } catch (error) {
        if (hasDistinctFallback && !sameUrlSet(startUrls, fallbackUrls)) {
          modelUrlsInUse = fallbackUrls;
          modelByteLength = await fetchModelByteLength(modelUrlsInUse);
          setLoadingState(piece.view?.fallbackSwitchText || DEFAULT_SWITCH_LOADING_TEXT);
          models = await Promise.all(
            normalizeUrls(fallbackUrls).map((url) => withTimeout(loader.loadAsync(url), fallbackTimeoutMs, "Fallback glTF load"))
          );
        } else {
          throw error;
        }
      }

      const rawGroup = new THREE.Group();
      for (const gltf of models) {
        const root = gltf.scene || gltf.scenes?.[0];
        if (root) {
          rawGroup.add(root);
        }
      }

      const pruneNodeNames = (sceneConfig.pruneNodeNames || []).map((name) => String(name).toLowerCase());
      if (pruneNodeNames.length) {
        const nodesToRemove = [];
        rawGroup.traverse((child) => {
          const name = child?.name?.toLowerCase?.() || "";
          if (!name) return;
          if (pruneNodeNames.some((needle) => name.includes(needle))) {
            nodesToRemove.push(child);
          }
        });
        for (const child of nodesToRemove) {
          if (child.parent) {
            child.parent.remove(child);
          }
        }
      }

      rawGroup.rotation.set(rotateX, rotateY, rotateZ);
      rawGroup.updateMatrixWorld(true);

      if (autoLevel) {
        const bottomNormal = collectBottomPlaneNormal(rawGroup, THREE, {
          maxSamples: sceneConfig.autoLevelMaxSamples,
          bottomPercentile: sceneConfig.autoLevelBottomPercentile,
          bottomRatio: sceneConfig.autoLevelBottomRatio
        });
        if (bottomNormal) {
          const levelQuaternion = new THREE.Quaternion().setFromUnitVectors(bottomNormal, new THREE.Vector3(0, 1, 0));
          rawGroup.applyQuaternion(levelQuaternion);
          rawGroup.updateMatrixWorld(true);
        }
      }

      rawGroup.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;

        if (Array.isArray(child.material)) {
          child.material.forEach(rememberMaterial);
        } else {
          rememberMaterial(child.material);
        }
      });

      const rawBox = new THREE.Box3().setFromObject(rawGroup);
      const size = rawBox.getSize(new THREE.Vector3());
      const center = rawBox.getCenter(new THREE.Vector3());

      const wrapper = new THREE.Group();
      rawGroup.position.set(-center.x, -rawBox.min.y, -center.z);
      wrapper.add(rawGroup);

      sculpture = wrapper;
      const scale = targetHeight / size.y;
      const shadowRadius = Math.max(1.1, Math.max(size.x, size.z) * scale * 0.66);
      contactDisc.scale.setScalar(shadowRadius);
      if (showPedestal) {
        scene.add(
          createPedestalMesh(
            THREE,
            resolveObjectPedestalRadius(rawGroup, rawBox, scale, THREE, sceneConfig),
            pedestalHeight,
            {
              ...sceneConfig,
              pedestalColor: sceneConfig.pedestalColor ?? stagePalette.pedestal
            }
          )
        );
      }
      sculpture.scale.setScalar(scale);
      sculpture.rotation.y = defaultYaw;
      sculpture.position.y = pedestalHeight + verticalOffset;
      scene.add(sculpture);

      focusY = pedestalHeight + verticalOffset + targetHeight * focusYRatio;

      const triCount = triangleCountForObject(rawGroup);
      const sizeLabel = modelByteLength ? `${(modelByteLength / (1024 * 1024)).toFixed(1)} MB GLB` : "High-fidelity GLB";
      const fidelityLabel = hasDistinctFallback && sameUrlSet(modelUrlsInUse, fallbackUrls) ? " (fallback)" : "";
      stats.textContent = `${triCount.toLocaleString()} triangles | ${sizeLabel}${fidelityLabel}`;

      ui.clearLoading();
      stage.appendChild(renderer.domElement);
      dracoLoader.dispose();
    } catch (error) {
      stats.textContent = "Failed to load source model.";
      ui.setLoadingState(`Model load error: ${error.message}`, {
        state: "error",
        title: "Unable to load this source model"
      });
      return;
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.55;
    controls.maxDistance = 8.0;
    controls.maxPolarAngle = Math.PI * 0.64;
    let lastInteractionAt = performance.now();
    const mobileQuery = window.matchMedia("(max-width: 820px)");
    let isMobileLayout = mobileQuery.matches;

    function zoomWithMobileOffset() {
      return ui.n("zoom") + (isMobileLayout ? 0.85 : 0.0);
    }

    function applyDefaultView() {
      const mobileTargetLift = isMobileLayout ? 0.22 : 0.0;
      controls.target.set(0, focusY + mobileTargetLift, 0);
      const viewVector = isMobileLayout
        ? new THREE.Vector3(...(sceneConfig.mobileViewVector || [1.1, 0.45, 2.2]))
        : new THREE.Vector3(...(sceneConfig.defaultViewVector || [1.8, 0.72, 1.85]));
      camera.position.copy(controls.target.clone().add(viewVector.normalize().multiplyScalar(defaults.zoom + (isMobileLayout ? 0.85 : 0.0))));
      controls.update();
    }

    function updateLight() {
      const angle = THREE.MathUtils.degToRad(ui.n("lightAngle"));
      keyLight.position.set(-Math.cos(angle) * 3.1, 4.6, Math.sin(angle) * 3.0);
      fillLight.position.set(Math.cos(angle + Math.PI * 0.55) * 3.8, 2.0, Math.sin(angle + Math.PI * 0.55) * 3.5);
      rimLight.position.set(Math.cos(angle + Math.PI) * 2.6, 3.3, Math.sin(angle + Math.PI) * 2.6);

      const power = ui.n("lightPower");
      const multi = isChecked("multiLight");

      keyLight.intensity = power;
      fillLight.intensity = multi ? power * 0.4 : 0;
      rimLight.intensity = multi ? power * 0.62 : 0;
      bounceLight.intensity = multi ? power * 0.16 : 0;
    }

    function updateCameraDistance() {
      const distance = zoomWithMobileOffset();
      const direction = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target.clone().addScaledVector(direction, distance));
    }

    function updateLook() {
      const roughnessValue = ui.n("rough");
      renderer.toneMappingExposure = ui.n("exposure") + exposureBoost;

      for (const entry of trackedMaterials) {
        const { material, roughness, wireframe } = entry;
        if (roughness !== null) {
          material.roughness = Math.max(0, Math.min(1, roughnessValue));
        }
        material.wireframe = isChecked("wire") ? true : wireframe;
        material.needsUpdate = true;
      }
    }

    applyDefaultView();

    ui.bindControls({
      onRangeInput: (id) => {
        if (id === "zoom") {
          updateCameraDistance();
        }
        if (id === "lightAngle" || id === "lightPower") {
          updateLight();
        }
        if (id === "exposure" || id === "rough") {
          updateLook();
        }
      },
      onCheckboxChange: () => {
        controls.enabled = isChecked("canManipulate");
        updateLight();
        updateLook();
      },
      onFront: () => {
        camera.position.set(0.0, focusY + (isMobileLayout ? 0.35 : 0.2), zoomWithMobileOffset());
        controls.target.set(0, focusY + (isMobileLayout ? 0.22 : 0.0), 0);
        controls.update();
      },
      onReset: () => {
        ui.setDefaults();
        if (sculpture) {
          sculpture.rotation.y = defaultYaw;
        }
        applyDefaultView();
        updateLight();
        updateLook();
      }
    });

    updateLight();
    updateLook();
    controls.enabled = defaults.canManipulate;
    const noteInteraction = () => {
      lastInteractionAt = performance.now();
      ui.registerActivity?.();
    };
    controls.addEventListener("start", noteInteraction);
    renderer.domElement.addEventListener("pointerdown", noteInteraction, { passive: true });
    renderer.domElement.addEventListener("wheel", noteInteraction, { passive: true });
    renderer.domElement.addEventListener("touchstart", noteInteraction, { passive: true });

    const clock = new THREE.Clock();

    function render() {
      const dt = clock.getDelta();

      if (sculpture && isChecked("autoRotate") && performance.now() - lastInteractionAt > AUTO_ROTATE_RESUME_DELAY_MS) {
        sculpture.rotation.y += dt * ui.n("spin");
      }

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }

    render();

    const onResize = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      const nextMobile = mobileQuery.matches;
      if (nextMobile !== isMobileLayout) {
        isMobileLayout = nextMobile;
        applyDefaultView();
      } else {
        updateCameraDistance();
      }
    };

    window.addEventListener("resize", onResize);
  } catch (error) {
    bootError("Failed to initialize glTF viewer.", error);
    if (stats) {
      stats.textContent = "Failed to load 3D engine modules.";
    }
    ui.setLoadingState(`Module load error: ${error.message}`, {
      state: "error",
      title: "Viewer startup failed"
    });
  }
}
