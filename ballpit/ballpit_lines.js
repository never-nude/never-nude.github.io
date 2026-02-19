import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';


/* PRETTY_REGION_LABELS_V1
   Display-only: keeps raw IDs for joins; only prettifies what humans see.
*/
const __AAL_ABBREV__ = {
  Sup:  "Superior",
  Inf:  "Inferior",
  Mid:  "Middle",
  Med:  "Medial",
  Ant:  "Anterior",
  Post: "Posterior",
  Orb:  "Orbital",
  Oper: "Opercular",
  Tri:  "Triangular",
};

function __prettyRegionLabel__(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (!s || s === "none") return s;
  if (s.startsWith("ERROR")) return s;

  // Preserve trailing "(rest)" / "(visual)" etc, but format nicer.
  let suffix = "";
  const m = s.match(/^(.*?)(\s*\([^)]*\))$/);
  if (m) { s = m[1].trim(); suffix = m[2]; }

  const sufCore = suffix.replace(/[()]/g, "").trim().toLowerCase();
  if (sufCore in {rest:1, visual:1, motor:1, auditory:1}) {
    suffix = " · " + sufCore;
  }

  // Hemisphere suffix
  let hemi = "";
  if (s.endsWith("_L")) { hemi = "Left";  s = s.slice(0, -2); }
  else if (s.endsWith("_R")) { hemi = "Right"; s = s.slice(0, -2); }

  // Tokenize on underscores and expand common AAL abbrevs.
  const toks = s.split("_").filter(Boolean).map(t => __AAL_ABBREV__[t] || t);
  let out = toks.join(" ");

  if (hemi) out = out + " (" + hemi + ")";
  return (out + suffix).trim();
}

function __attachPrettyHover__() {
  const hoverEl = document.getElementById("hoverName");
  if (!hoverEl) return;

  let inObs = false;
  const obs = new MutationObserver(() => {
    if (inObs) return;
    inObs = true;
    try {
      const v = hoverEl.textContent || "";
      const p = __prettyRegionLabel__(v);
      if (p && p !== v) hoverEl.textContent = p;
    } finally {
      inObs = false;
    }
  });

  obs.observe(hoverEl, { childList: true, characterData: true, subtree: true });

  // normalize initial value
  const v0 = hoverEl.textContent || "";
  const p0 = __prettyRegionLabel__(v0);
  if (p0 && p0 !== v0) hoverEl.textContent = p0;
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", __attachPrettyHover__);
} else {
  __attachPrettyHover__();
}
const VERSION = 'lines2';
const BUILD_ID = `BALLPIT-LINES2-${new Date().toISOString()}`;
const STIMS = ['rest','visual','motor','auditory'];

const UI = {
  buildId: document.getElementById('buildId'),
  stimName: document.getElementById('stimName'),
  nodeCount: document.getElementById('nodeCount'),
  lineCount: document.getElementById('lineCount'),
  trainCount: document.getElementById('trainCount'),
  hoverName: document.getElementById('hoverName'),
  statusLine: document.getElementById('statusLine'),
  buttons: Array.from(document.querySelectorAll('#hud button[data-stim]'))
};

UI.buildId.textContent = `build ${BUILD_ID}`;

function setStatus(msg) { UI.statusLine.textContent = msg || ''; }

function normLabel(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function seededRand(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

function getCoord(r) {
  // Prefer real coordinates if present
  const tryArr = (v) => Array.isArray(v) && v.length >= 3 ? [Number(v[0]), Number(v[1]), Number(v[2])] : null;

  // NOTE: center_mm is the big one in your file
  return (
    tryArr(r?.center_mm) ||
    tryArr(r?.centerMm) ||
    tryArr(r?.centroid_mm) ||
    tryArr(r?.centroidMm) ||
    tryArr(r?.mni_xyz) ||
    tryArr(r?.xyz) ||
    tryArr(r?.mni) ||
    tryArr(r?.coord) ||
    tryArr(r?.coords) ||
    (r && typeof r === 'object' && r.center && typeof r.center === 'object' && 'x' in r.center ? [Number(r.center.x), Number(r.center.y), Number(r.center.z)] : null) ||
    null
  );
}

function colorForValue(v) {
  const h = ((v * 0.61803398875) % 1 + 1) % 1;
  const c = new THREE.Color();
  c.setHSL(h, 0.62, 0.56);
  return c;
}

async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x05070b, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070b, 8, 28);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 200);
camera.position.set(0, 0, 10);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const key = new THREE.DirectionalLight(0xffffff, 0.85);
key.position.set(3, 4, 5);
scene.add(key);

// Soft hull
const hullGeo = new THREE.SphereGeometry(3.2, 64, 64);
hullGeo.scale(1.05, 1.25, 0.95);
const hullMat = new THREE.MeshStandardMaterial({
  color: 0x101827,
  roughness: 0.9,
  metalness: 0.0,
  transparent: true,
  opacity: 0.28,
  depthWrite: false
});
scene.add(new THREE.Mesh(hullGeo, hullMat));

const nodeGroup = new THREE.Group();
scene.add(nodeGroup);

const lineGroups = new Map(); // stim -> group
const trainsByStim = new Map(); // stim -> train objects

for (const s of STIMS) {
  const g = new THREE.Group();
  g.visible = (s === 'rest');
  scene.add(g);
  lineGroups.set(s, g);
  trainsByStim.set(s, []);
}

let currentStim = 'rest';
function setActiveButton(stim) {
  UI.buttons.forEach(b => b.classList.toggle('active', b.dataset.stim === stim));
}
function setStimulus(stim, nodesUsedSet) {
  currentStim = stim;
  UI.stimName.textContent = stim;
  setActiveButton(stim);

  for (const s of STIMS) {
    lineGroups.get(s).visible = (s === stim);
    for (const t of trainsByStim.get(s)) t.mesh.visible = (s === stim);
  }

  // Highlight nodes used in this stim
  if (nodesUsedSet) {
    nodeGroup.children.forEach(m => {
      const used = nodesUsedSet.has(m.userData.key);
      m.material.opacity = used ? 0.95 : 0.10;
      m.scale.setScalar(used ? 1.25 : 0.85);
    });
  }
}

const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2(999, 999);

renderer.domElement.addEventListener('pointermove', (ev) => {
  const r = renderer.domElement.getBoundingClientRect();
  mouseNDC.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  mouseNDC.y = -(((ev.clientY - r.top) / r.height) * 2 - 1);
}, { passive: true });

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}, { passive: true });

function tubeForCurve(curve, colorHex) {
  const geom = new THREE.TubeGeometry(curve, 240, 0.06, 10, false);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.65,
    metalness: 0.05,
    transparent: true,
    opacity: 0.62
  });
  return new THREE.Mesh(geom, mat);
}

function makeTrain(colorHex) {
  const geom = new THREE.SphereGeometry(0.10, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(colorHex).multiplyScalar(0.55),
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.1
  });
  return new THREE.Mesh(geom, mat);
}

function layoutPositions(regions) {
  // Build raw coords (fallback = deterministic)
  const pts = [];
  for (const r of regions) {
    const lab = r?.label ?? r?.name ?? r?.region ?? r?.roi ?? '';
    const key = normLabel(lab);
    const val = Number(r?.aal_value ?? 0);
    let c = getCoord(r);

    if (!c) {
      const rnd = seededRand((val * 10007 + 1337) >>> 0);
      c = [(rnd()*2-1)*60, (rnd()*2-1)*80, (rnd()*2-1)*60];
    }
    pts.push({ r, key, label: String(lab), val, c });
  }

  // Normalize to fit ellipsoid-ish space
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for (const p of pts) {
    const [x,y,z] = p.c;
    if (x<minX) minX=x; if (y<minY) minY=y; if (z<minZ) minZ=z;
    if (x>maxX) maxX=x; if (y>maxY) maxY=y; if (z>maxZ) maxZ=z;
  }
  const dx = Math.max(1e-6, maxX-minX);
  const dy = Math.max(1e-6, maxY-minY);
  const dz = Math.max(1e-6, maxZ-minZ);

  const rx=2.85, ry=3.55, rz=2.65;

  for (const p of pts) {
    const [x,y,z] = p.c;
    const nx = ((x - minX) / dx) * 2 - 1;
    const ny = ((y - minY) / dy) * 2 - 1;
    const nz = ((z - minZ) / dz) * 2 - 1;
    p.pos = new THREE.Vector3(nx*rx, ny*ry, nz*rz);
  }
  return pts;
}

(async function main() {
  setStatus('loading…');

  const ts = Date.now();
  const aal = await loadJSON(`./data/aal_regions.json?v=${ts}`);
  const regions = Array.isArray(aal) ? aal : (aal.regions ?? aal.nodes ?? aal.labels ?? []);

  if (!regions.length) throw new Error('No regions found in aal_regions.json');

  const pts = layoutPositions(regions);

  // Build lookup
  const byKey = new Map();
  for (const p of pts) byKey.set(p.key, p);

  // Nodes
  const nodeGeom = new THREE.SphereGeometry(0.075, 16, 16);
  for (const p of pts) {
    const mat = new THREE.MeshStandardMaterial({
      color: colorForValue(p.val || 0),
      roughness: 0.6,
      metalness: 0.0,
      transparent: true,
      opacity: 0.10
    });
    const m = new THREE.Mesh(nodeGeom, mat);
    m.position.copy(p.pos);
    m.userData = { key: p.key, label: p.label };
    nodeGroup.add(m);
  }
  UI.nodeCount.textContent = String(nodeGroup.children.length);

  // Lines spec
  const spec = await loadJSON(`./data/lines2.json?v=${ts}`);
  const lines = spec.lines ?? [];

  // Color palette for lines
  const palette = [0x8ab4f8,0xf28b82,0x81c995,0xfdd663,0xd7aefb,0x78d9ec,0xf6aea9,0xa7ffeb];
  let colorIdx = 0;

  // Build per-stim used node sets
  const usedByStim = new Map();
  for (const s of STIMS) usedByStim.set(s, new Set());

  let totalLinesBuilt = 0;
  let totalTrainsBuilt = 0;
  let missingCount = 0;

  for (const ln of lines) {
    const stim = ln.stimulus;
    if (!lineGroups.has(stim)) continue;

    const stops = Array.isArray(ln.stops) ? ln.stops : [];
    const ptsLine = [];
    for (const stop of stops) {
      const k = normLabel(stop);
      const p = byKey.get(k);
      if (!p) { missingCount++; continue; }
      ptsLine.push(p.pos.clone());
      usedByStim.get(stim).add(k);
    }

    if (ptsLine.length < 3) continue;

    const curve = new THREE.CatmullRomCurve3(ptsLine, false, 'catmullrom', 0.5);
    const col = palette[colorIdx % palette.length]; colorIdx++;

    const tube = tubeForCurve(curve, col);
    lineGroups.get(stim).add(tube);
    totalLinesBuilt++;

    const nTrains = Math.max(0, Number(ln.trains ?? 0));
    for (let i = 0; i < nTrains; i++) {
      const train = makeTrain(col);
      const t0 = (i / Math.max(1, nTrains)) % 1;
      train.position.copy(curve.getPointAt(t0));
      train.visible = (stim === 'rest');
      scene.add(train);

      trainsByStim.get(stim).push({
        mesh: train,
        curve,
        t: t0,
        speed: 0.04 + 0.03 * Math.random()
      });
      totalTrainsBuilt++;
    }
  }

  setStatus(`lines built: ${totalLinesBuilt}, trains: ${totalTrainsBuilt}, missing stops skipped: ${missingCount}`);

  function applyStim(stim) {
    const used = usedByStim.get(stim) || new Set();
    UI.lineCount.textContent = String(lineGroups.get(stim).children.length);
    UI.trainCount.textContent = String(trainsByStim.get(stim).length);
    setStimulus(stim, used);
  }

  // Buttons
  UI.buttons.forEach(btn => {
    btn.addEventListener('click', () => applyStim(btn.dataset.stim));
  });

  applyStim('rest');

  // Animation loop
  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());

    // hover
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(nodeGroup.children, false);
    UI.hoverName.textContent = hits.length ? (hits[0].object.userData.label || 'Unknown') : 'none';

    // trains update for current stim only
    for (const t of trainsByStim.get(currentStim)) {
      t.t = (t.t + t.speed * dt) % 1;
      t.mesh.position.copy(t.curve.getPointAt(t.t));
    }

    controls.update();
    renderer.render(scene, camera);
  }
  tick();
})().catch(err => {
  console.error(err);
  setStatus(`ERROR: ${err?.message || err}`);
  UI.hoverName.textContent = 'ERROR (see console)';
});
