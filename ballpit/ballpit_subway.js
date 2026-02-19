import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';


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
 VTA: "Ventral Tegmental Area",};

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
const DATA_VERSION = 'ballpit-url1';
const BUILD_ID = `BALLPIT-BALLPITURL1-${new Date().toISOString()}`;

const el = {
  build: document.getElementById('buildId'),
  stim: document.getElementById('stimulusName'),
  nodeCount: document.getElementById('nodeCount'),
  edgeCount: document.getElementById('edgeCount'),
  lineCount: document.getElementById('lineCount'),
  trainCount: document.getElementById('trainCount'),
  hover: document.getElementById('hoverName'),
};

el.build.textContent = BUILD_ID;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setClearColor(0x060b12, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x060b12, 320, 1400);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
camera.position.set(0, 0, 420);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 0.85);
key.position.set(1, 1.2, 1).multiplyScalar(400);
scene.add(key);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(999, 999);

let currentStim = 'rest';
const STIMS = ['rest','visual','motor','auditory'];

const nodeMeshes = [];
const nodeByVal = new Map();   // aal_value -> {val,label,net,hub,pos,color}
const meshByVal = new Map();   // aal_value -> mesh

const stimGroups = new Map();  // stim -> { group, trains, edgeCount, lineCount }

function norm(s) {
  return (s || '').toString().trim().toLowerCase();
}

// Heuristics: good enough for v1; replace later with a proper network atlas if you want.
const VIS = ['calcarine','cuneus','lingual','fusiform','occipital'];
const MOT = ['precentral','postcentral','supp_motor','paracentral','rolandic'];
const AUD = ['heschl','temporal_sup','temporal_mid','temporal_inf','supra_temporal','insula','superior_temporal'];
const HUB = ['thalamus','precuneus','cingulum','hippocampus','parahippocampal','angular'];

function netOf(label) {
  const l = norm(label);
  if (VIS.some(k => l.includes(k))) return 'visual';
  if (MOT.some(k => l.includes(k))) return 'motor';
  if (AUD.some(k => l.includes(k))) return 'auditory';
  return 'rest';
}
function isHub(label) {
  const l = norm(label);
  return HUB.some(k => l.includes(k));
}

function getXYZ(r) {
  // robust centroid getter (handles different schemas)
  for (const key of ['mni_xyz','mni','xyz','coord','coords','center','centroid','centroid_mni']) {
    const v = r[key];
    if (!v) continue;
    if (Array.isArray(v) && v.length === 3) return new THREE.Vector3(+v[0], +v[1], +v[2]);
    if (typeof v === 'object' && 'x' in v && 'y' in v && 'z' in v) return new THREE.Vector3(+v.x, +v.y, +v.z);
  }
  // deterministic fallback
  const seed = (parseInt(r.aal_value || 0, 10) * 10007 + 1337) >>> 0;
  let x = seed;
  const rnd = () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296;
  return new THREE.Vector3((rnd()*2-1)*60, (rnd()*2-1)*80, (rnd()*2-1)*60);
}

function seededColor(val) {
  // golden-ratio-ish hue walk for stable distinct colors
  const h = ( (val * 0.61803398875) % 1 + 1 ) % 1;
  const c = new THREE.Color();
  c.setHSL(h, 0.62, 0.56);
  return c;
}

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize, { passive: true });

canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
}, { passive: true });

function setActiveButton(stim) {
  document.querySelectorAll('button[data-stim]').forEach(b => {
    b.classList.toggle('active', b.dataset.stim === stim);
  });
}

document.querySelectorAll('button[data-stim]').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.stim;
    if (!STIMS.includes(next) || next === currentStim) return;
    setStimulus(next);
  });
});

async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.json();
}

function buildBrainShell(bounds) {
  const size = new THREE.Vector3().subVectors(bounds.max, bounds.min);
  const radius = Math.max(size.x, size.y, size.z) * 0.55;

  const geom = new THREE.SphereGeometry(radius, 64, 64);
  // squish a bit into a brain-ish ellipsoid
  geom.scale(1.0, 1.15, 0.95);

  const mat = new THREE.MeshPhongMaterial({
    color: 0x1b2430,
    transparent: true,
    opacity: 0.22,
    shininess: 20,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, 0, 0);
  return mesh;
}

function weightedChoice(rng, items) {
  // items: [[w, value], ...]
  let sum = 0;
  for (const [w] of items) sum += Math.max(0, w);
  if (sum <= 0) return items[Math.floor(rng() * items.length)]?.[1];
  let t = rng() * sum;
  for (const [w, v] of items) {
    t -= Math.max(0, w);
    if (t <= 0) return v;
  }
  return items[items.length - 1][1];
}

function makeRNG(seedStr) {
  // tiny xorshift-ish RNG, deterministic per stim
  let x = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    x ^= seedStr.charCodeAt(i);
    x = Math.imul(x, 16777619) >>> 0;
  }
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

function buildStimulusGroup(stim, allEdges) {
  const group = new THREE.Group();
  group.name = `stim_${stim}`;

  // Node eligibility rules:
  // - rest: everyone
  // - others: that net + hubs
  const eligible = new Set();
  for (const [val, n] of nodeByVal.entries()) {
    if (stim === 'rest') eligible.add(val);
    else if (n.net === stim || n.hub) eligible.add(val);
  }

  // Edge eligibility + selection
  const MAX_EDGES = (stim === 'rest') ? 900 : 420;

  const scored = [];
  for (const e of allEdges) {
    const a = e[0], b = e[1], w = +e[2];
    if (!eligible.has(a) || !eligible.has(b)) continue;

    const na = nodeByVal.get(a), nb = nodeByVal.get(b);
    if (!na || !nb) continue;

    // For non-rest, prefer within-stim edges, but allow hub bridges.
    let ok = true;
    if (stim !== 'rest') {
      const within = (na.net === stim && nb.net === stim);
      const bridge = (na.net === stim && nb.hub) || (nb.net === stim && na.hub) || (na.hub && nb.hub);
      ok = within || bridge;
    }
    if (!ok) continue;

    scored.push([w, a, b]);
  }

  scored.sort((x,y) => y[0] - x[0]);
  const picked = scored.slice(0, MAX_EDGES);
  const edgeCount = picked.length;

  // adjacency for random walks
  const adj = new Map(); // val -> [[w, nbr], ...]
  const addAdj = (u, v, w) => {
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u).push([w, v]);
  };
  for (const [w, a, b] of picked) {
    addAdj(a, b, w);
    addAdj(b, a, w);
  }

  // pick line starts from high-degree nodes
  const deg = [];
  for (const [v, arr] of adj.entries()) {
    const s = arr.reduce((acc, [w]) => acc + w, 0);
    deg.push([s, v]);
  }
  deg.sort((x,y) => y[0] - x[0]);
  const topStarts = deg.slice(0, Math.min(30, deg.length)).map(x => x[1]);

  const rng = makeRNG(`ballpit_${DATA_VERSION}_${stim}`);
  const N_LINES = (stim === 'rest') ? 10 : 8;
  const LEN = (stim === 'rest') ? 9 : 8;

  const trains = [];

  const tubeRadius = (stim === 'rest') ? 0.9 : 1.05;
  const tubeSegs = 80;

  for (let li = 0; li < N_LINES; li++) {
    if (topStarts.length === 0) break;

    let cur = topStarts[Math.floor(rng() * topStarts.length)];
    const path = [cur];

    for (let k = 0; k < LEN - 1; k++) {
      const nbrs = adj.get(cur);
      if (!nbrs || nbrs.length === 0) break;
      // avoid immediate backtracking when possible
      const prev = path.length >= 2 ? path[path.length-2] : null;
      const options = nbrs.filter(([w, v]) => v !== prev);
      const choicePool = options.length ? options : nbrs;
      const nxt = weightedChoice(rng, choicePool);
      if (nxt == null) break;
      path.push(nxt);
      cur = nxt;
    }

    if (path.length < 4) continue;

    const pts = path.map(v => nodeByVal.get(v).pos.clone());
    // slight per-line offset so multiple tubes don't perfectly overlap
    const jitter = new THREE.Vector3((rng()*2-1)*3.0, (rng()*2-1)*3.0, (rng()*2-1)*3.0);
    for (const p of pts) p.add(jitter);

    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const geom = new THREE.TubeGeometry(curve, tubeSegs, tubeRadius, 8, false);

    // color per line: seeded + slight stim flavor
    const baseHue = (rng() + (stim === 'visual' ? 0.58 : stim === 'motor' ? 0.32 : stim === 'auditory' ? 0.80 : 0.10)) % 1;
    const col = new THREE.Color().setHSL(baseHue, 0.70, 0.55);

    const mat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: (stim === 'rest') ? 0.55 : 0.70,
    });

    const tube = new THREE.Mesh(geom, mat);
    group.add(tube);

    // train
    const trainGeom = new THREE.SphereGeometry(2.0, 16, 16);
    const trainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: col.clone().multiplyScalar(0.6),
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.1,
    });
    const train = new THREE.Mesh(trainGeom, trainMat);

    const t0 = rng();
    train.position.copy(curve.getPointAt(t0));
    group.add(train);

    trains.push({
      mesh: train,
      curve,
      t: t0,
      speed: (stim === 'rest' ? 0.035 : 0.05) * (0.75 + rng() * 0.6),
    });
  }

  return {
    group,
    trains,
    edgeCount,
    lineCount: group.children.filter(o => o.type === 'Mesh').length - trains.length,
  };
}

function applyStimulusToNodes(stim) {
  for (const n of nodeMeshes) {
    const d = nodeByVal.get(n.userData.val);
    const active = (stim === 'rest') ? true : (d.net === stim || d.hub);
    const targetScale = active ? 1.15 : 0.80;
    n.scale.setScalar(targetScale);
    n.material.opacity = active ? 0.95 : 0.14;
  }
}

function setStimulus(stim) {
  currentStim = stim;
  if (el.stim) el.stim.textContent = stim;
  setActiveButton(stim);

  for (const [k, g] of stimGroups.entries()) {
    g.group.visible = (k === stim);
  }

  const g = stimGroups.get(stim);
  el.edgeCount.textContent = g ? String(g.edgeCount) : '?';
  el.lineCount.textContent = g ? String(g.lineCount) : '?';
  el.trainCount.textContent = g ? String(g.trains.length) : '?';

  applyStimulusToNodes(stim);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  // hover
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(nodeMeshes, false);
  if (hits.length) {
    const val = hits[0].object.userData.val;
    const d = nodeByVal.get(val);
    el.hover.textContent = d ? `${d.label} (${d.net}${d.hub ? ', hub' : ''})` : String(val);
  } else {
    el.hover.textContent = 'none';
  }

  // trains update only for visible group
  for (const [k, g] of stimGroups.entries()) {
    if (!g.group.visible) continue;
    for (const t of g.trains) {
      t.t = (t.t + t.speed * dt) % 1;
      t.mesh.position.copy(t.curve.getPointAt(t.t));
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();

(async function main() {
  resize();

  const regionsURL = `./data/aal_regions.json?v=${DATA_VERSION}`;
  const connectomeURL = `./data/connectome_edges.json?v=${DATA_VERSION}`;

  const [regionsData, connData] = await Promise.all([
    loadJSON(regionsURL),
    loadJSON(connectomeURL),
  ]);

  const regions = regionsData.regions || regionsData;
  const edgesAll = connData.edges || [];

  // Build nodes (and bounds)
  const bounds = { min: new THREE.Vector3(+1e9, +1e9, +1e9), max: new THREE.Vector3(-1e9, -1e9, -1e9) };

  for (const r of regions) {
    const val = parseInt(r.aal_value, 10);
    const label = r.label || r.name || `aal_${val}`;
    const pos = getXYZ(r);

    bounds.min.min(pos);
    bounds.max.max(pos);

    const net = netOf(label);
    const hub = isHub(label);
    const color = seededColor(val);

    nodeByVal.set(val, { val, label, net, hub, pos, color });
  }

  el.nodeCount.textContent = String(nodeByVal.size);

  // Shell
  const shell = buildBrainShell(bounds);
  scene.add(shell);

  // Nodes
  const nodeGeom = new THREE.SphereGeometry(1.55, 16, 16);
  for (const [val, d] of nodeByVal.entries()) {
    const mat = new THREE.MeshStandardMaterial({
      color: d.color,
      transparent: true,
      opacity: 0.95,
      roughness: 0.45,
      metalness: 0.1,
    });
    const m = new THREE.Mesh(nodeGeom, mat);
    m.position.copy(d.pos);
    m.userData = { val };
    scene.add(m);
    nodeMeshes.push(m);
    meshByVal.set(val, m);
  }

  // Build stimulus groups
  for (const stim of STIMS) {
    const g = buildStimulusGroup(stim, edgesAll);
    g.group.visible = false;
    scene.add(g.group);
    stimGroups.set(stim, g);
  }

  setStimulus('rest');
  animate();
})().catch(err => {
  console.error(err);
  el.hover.textContent = 'ERROR (check console)';
});
