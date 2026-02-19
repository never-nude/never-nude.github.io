import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const BUILD_ID = "1771460549";

const buildEl = document.getElementById("build");
const hudEl = document.getElementById("hud");

function hud(msg, isError = false) {
  hudEl.textContent = msg;
  hudEl.classList.toggle("error", isError);
}

buildEl.textContent = `model • AAL viewer • BUILD ${BUILD_ID}`;
hud(`BUILD ${BUILD_ID}: booting…`);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 1000);
camera.position.set(0, 1.2, 2.2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.2, 0);
controls.update();

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(2, 3, 2);
scene.add(dir);

// MNI(mm) -> three.js coords
const SCALE = 0.01;
function mniToThree([x, y, z]) {
  return new THREE.Vector3(x * SCALE, z * SCALE, -y * SCALE);
}

const GRAPH_URL = `./assets/aal_graph.json?v=${BUILD_ID}`;
const HULL_URL  = `./assets/brain_hull.obj?v=${BUILD_ID}`;

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

  const group = new THREE.Group();
  group.add(obj);

  // Basis transform: X'=x, Y'=z, Z'=-y
  const basis = new THREE.Matrix4().set(
    1,  0,  0, 0,
    0,  0,  1, 0,
    0, -1,  0, 0,
    0,  0,  0, 1
  );
  group.applyMatrix4(basis);
  group.scale.setScalar(SCALE);
  scene.add(group);
}

function addGraph(graph) {
  const nodes = graph.nodes;
  const edges = graph.edges;

  const sphereGeo = new THREE.SphereGeometry(0.018, 16, 16);
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0x66ccff });
  const nodeMesh = new THREE.InstancedMesh(sphereGeo, sphereMat, nodes.length);
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

  const EDGE_THRESHOLD = 0.08;
  const kept = edges.filter(e => (e.weight_norm ?? 0) >= EDGE_THRESHOLD);

  const positions = new Float32Array(kept.length * 2 * 3);
  for (let k = 0; k < kept.length; k++) {
    const e = kept[k];
    const a = mniToThree(nodes[e.source].mni_mm);
    const b = mniToThree(nodes[e.target].mni_mm);
    const base = k * 6;
    positions[base + 0] = a.x; positions[base + 1] = a.y; positions[base + 2] = a.z;
    positions[base + 3] = b.x; positions[base + 4] = b.y; positions[base + 5] = b.z;
  }

  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
  scene.add(new THREE.LineSegments(edgeGeo, edgeMat));

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  addEventListener("pointermove", (ev) => {
    mouse.x = (ev.clientX / innerWidth) * 2 - 1;
    mouse.y = -(ev.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(nodeMesh);
    if (hits.length) {
      const id = hits[0].instanceId;
      const n = nodes[id];
      hud(`BUILD ${BUILD_ID}\n${n.name}  (atlas id ${n.id})\nNodes: ${nodes.length} • Edges shown: ${kept.length}`);
    } else {
      hud(`BUILD ${BUILD_ID}\nNodes: ${nodes.length} • Edges shown: ${kept.length}\nHover a node to see label`);
    }
  });

  hud(`BUILD ${BUILD_ID}\nNodes: ${nodes.length} • Edges shown: ${kept.length}\nHover a node to see label`);
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

(async () => {
  try {
    hud(`BUILD ${BUILD_ID}: loading graph…`);
    const graph = await loadGraph();
    addGraph(graph);

    hud(`BUILD ${BUILD_ID}: graph OK (${graph.nodes.length} nodes)\nLoading hull…`);
    try {
      const hullObj = await loadHullObj();
      addHull(hullObj);
      hud(`BUILD ${BUILD_ID}: hull OK\nHover a node to see label`);
    } catch (e) {
      console.warn("Hull load failed:", e);
      hud(`BUILD ${BUILD_ID}: hull load failed (graph still OK)\nHover a node to see label`);
    }
  } catch (e) {
    console.error(e);
    hud(`BUILD ${BUILD_ID}: ERROR\n${e.message}`, true);
  }
})();
