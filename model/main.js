import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const BUILD_ID = "1771474447";

// ---------- UI ----------
const buildEl = document.getElementById("build");
const hudEl = document.getElementById("hud");

const ui = {
  toggleEdges: document.getElementById("toggleEdges"),
  toggleHull:  document.getElementById("toggleHull"),
  toggleAuto:  document.getElementById("toggleAuto"),
  btnReset:    document.getElementById("btnReset"),
  edgeThresh:  document.getElementById("edgeThresh"),
  edgeVal:     document.getElementById("edgeVal"),
};

function hud(msg, isError = false) {
  hudEl.textContent = msg;
  hudEl.classList.toggle("error", isError);
}

buildEl.textContent = `model • AAL viewer • BUILD ${BUILD_ID}`;

// ---------- State ----------
const state = {
  edgesOn: true,
  hullOn: true,
  autoRotate: false,
  edgeThreshold: 0.08,
};

// ---------- Scene ----------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 1000);
camera.position.set(0, 1.2, 2.2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 0.7;
controls.target.set(0, 0.2, 0);
controls.update();
controls.saveState();

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(2, 3, 2);
scene.add(dir);

// ---------- Coordinate mapping ----------
const SCALE = 0.01; // 1 unit = 100mm
function mniToThree([x, y, z]) {
  return new THREE.Vector3(x * SCALE, z * SCALE, -y * SCALE);
}

// Cache-bust assets (OBJLoader doesn't give us fetch cache controls)
const GRAPH_URL = `./assets/aal_graph.json?v=${BUILD_ID}`;
const HULL_URL  = `./assets/brain_hull.obj?v=${BUILD_ID}`;

// ---------- Graph/Hull refs ----------
let graph = null;
let nodeMesh = null;
let hullGroup = null;
let edgeLines = null;
let edgesShown = 0;
let hoveredIdx = null;

// ---------- HUD render ----------
function renderHud() {
  if (!graph) {
    hud(`BUILD ${BUILD_ID}\nLoading…`);
    return;
  }

  const base =
`BUILD ${BUILD_ID}
Nodes: ${graph.nodes.length} • Edges shown: ${edgesShown}
Edge threshold: ${state.edgeThreshold.toFixed(2)}
Edges: ${state.edgesOn ? "ON" : "OFF"} • Hull: ${state.hullOn ? "ON" : "OFF"} • Auto: ${state.autoRotate ? "ON" : "OFF"}
Use panel (top-right)`;

  if (hoveredIdx !== null) {
    const n = graph.nodes[hoveredIdx];
    hud(`${base}\n\n${n.name}  (atlas id ${n.id})`);
  } else {
    hud(base);
  }
}

// ---------- Edges rebuild ----------
function rebuildEdges() {
  if (!graph) return;

  // Remove old edges
  if (edgeLines) {
    scene.remove(edgeLines);
    edgeLines.geometry.dispose();
    edgeLines.material.dispose();
    edgeLines = null;
  }

  if (!state.edgesOn) {
    edgesShown = 0;
    renderHud();
    return;
  }

  const nodes = graph.nodes;
  const edges = graph.edges;

  const kept = edges.filter(e => (e.weight_norm ?? 0) >= state.edgeThreshold);
  edgesShown = kept.length;

  const positions = new Float32Array(kept.length * 2 * 3);

  for (let k = 0; k < kept.length; k++) {
    const e = kept[k];
    const a = mniToThree(nodes[e.source].mni_mm);
    const b = mniToThree(nodes[e.target].mni_mm);
    const base = k * 6;
    positions[base + 0] = a.x; positions[base + 1] = a.y; positions[base + 2] = a.z;
    positions[base + 3] = b.x; positions[base + 4] = b.y; positions[base + 5] = b.z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
  edgeLines = new THREE.LineSegments(geo, mat);
  scene.add(edgeLines);

  renderHud();
}

// ---------- Loaders ----------
async function loadGraph() {
  const r = await fetch(GRAPH_URL, { cache: "no-store" });
  if (!r.ok) throw new Error(`aal_graph.json HTTP ${r.status}`);
  return await r.json();
}

async function loadHullObj() {
  const loader = new OBJLoader();
  return await loader.loadAsync(HULL_URL);
}

function addHull(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
        roughness: 0.85,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
    }
  });

  hullGroup = new THREE.Group();
  hullGroup.add(obj);

  // Basis transform: X'=x, Y'=z, Z'=-y
  const basis = new THREE.Matrix4().set(
    1,  0,  0, 0,
    0,  0,  1, 0,
    0, -1,  0, 0,
    0,  0,  0, 1
  );
  hullGroup.applyMatrix4(basis);
  hullGroup.scale.setScalar(SCALE);
  hullGroup.visible = state.hullOn;

  scene.add(hullGroup);
}

function addNodes(g) {
  const nodes = g.nodes;

  const sphereGeo = new THREE.SphereGeometry(0.018, 16, 16);
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0x66ccff });

  nodeMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, nodes.length);
  nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  const c = new THREE.Color();

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    dummy.position.copy(mniToThree(n.mni_mm));

    const s = 0.7 + 0.6 * Math.sqrt(n.volume_mm3 / 20000);
    dummy.scale.setScalar(THREE.MathUtils.clamp(s, 0.6, 1.8));

    dummy.updateMatrix();
    nodeMesh.setMatrixAt(i, dummy.matrix);

    if (n.hemisphere === "L") c.setHex(0xff7aa2);
    else if (n.hemisphere === "R") c.setHex(0x7ad7ff);
    else c.setHex(0xd6d6d6);
    nodeMesh.setColorAt(i, c);
  }
  nodeMesh.instanceColor.needsUpdate = true;

  scene.add(nodeMesh);

  // Hover raycast
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  addEventListener("pointermove", (ev) => {
    mouse.x = (ev.clientX / innerWidth) * 2 - 1;
    mouse.y = -(ev.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(nodeMesh);
    if (hits.length) hoveredIdx = hits[0].instanceId;
    else hoveredIdx = null;

    renderHud();
  });
}

// ---------- UI wiring ----------
function syncUI() {
  ui.toggleEdges.checked = state.edgesOn;
  ui.toggleHull.checked  = state.hullOn;
  ui.toggleAuto.checked  = state.autoRotate;
  ui.edgeThresh.value    = String(state.edgeThreshold);
  ui.edgeVal.textContent = state.edgeThreshold.toFixed(2);
}

ui.toggleEdges.addEventListener("change", () => {
  state.edgesOn = ui.toggleEdges.checked;
  rebuildEdges();
});

ui.toggleHull.addEventListener("change", () => {
  state.hullOn = ui.toggleHull.checked;
  if (hullGroup) hullGroup.visible = state.hullOn;
  renderHud();
});

ui.toggleAuto.addEventListener("change", () => {
  state.autoRotate = ui.toggleAuto.checked;
  controls.autoRotate = state.autoRotate;
  renderHud();
});

ui.edgeThresh.addEventListener("input", () => {
  state.edgeThreshold = parseFloat(ui.edgeThresh.value);
  ui.edgeVal.textContent = state.edgeThreshold.toFixed(2);
  rebuildEdges();
});

ui.btnReset.addEventListener("click", () => {
  controls.reset();
  renderHud();
});

syncUI();
renderHud();

// ---------- Render loop ----------
function animate() {
  requestAnimationFrame(animate);
  controls.autoRotate = state.autoRotate;
  controls.update();
  renderer.render(scene, camera);
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Boot ----------
(async () => {
  try {
    hud(`BUILD ${BUILD_ID}\nLoading graph…`);
    graph = await loadGraph();

    addNodes(graph);
    rebuildEdges();

    hud(`BUILD ${BUILD_ID}\nGraph OK (${graph.nodes.length} nodes)\nLoading hull…`);
    try {
      const hullObj = await loadHullObj();
      addHull(hullObj);
    } catch (e) {
      console.warn("Hull load failed:", e);
    }

    renderHud();
  } catch (e) {
    console.error(e);
    hud(`BUILD ${BUILD_ID}\nERROR\n${e.message}`, true);
  }
})();
