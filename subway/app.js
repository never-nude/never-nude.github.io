import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BUILD_ID = `BALLPIT-AAL-${new Date().toISOString()}`;
document.getElementById('buildId').textContent = BUILD_ID;

const DATA_VERSION = 'ballpit1';
const AAL_URL = `./data/aal_regions.json?v=${DATA_VERSION}`;

const hud = {
  nodeCount: document.getElementById('nodeCount'),
  stimulusName: document.getElementById('stimulusName'),
  hoverName: document.getElementById('hoverName'),
  atlasName: document.getElementById('atlasName'),
};

hud.nodeCount.textContent = 'loading…';
hud.hoverName.textContent = '—';
hud.atlasName.textContent = '—';

// ---------- Three.js baseline ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
camera.position.set(2.2, 1.2, 2.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(2, 3, 2);
scene.add(dir);

// Brain-ish shell
const shellGeo = new THREE.SphereGeometry(1.0, 64, 64);
const shellMat = new THREE.MeshStandardMaterial({
  color: 0xdddddd,
  transparent: true,
  opacity: 0.10,
  roughness: 0.9,
  metalness: 0.0,
});
const shell = new THREE.Mesh(shellGeo, shellMat);
scene.add(shell);

// ---------- Hover picking ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(999, 999);
let hovered = null;

window.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  pointer.set(x, y);
});

// ---------- Utilities ----------
function fitTransform(points, targetRadius = 1.0) {
  const min = new THREE.Vector3(+Infinity, +Infinity, +Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of points) { min.min(p); max.max(p); }
  const size = max.clone().sub(min);
  const center = min.clone().add(max).multiplyScalar(0.5);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? (targetRadius * 2.0) / maxDim : 1;
  return { size, center, scale };
}

function colorForIndex(i) {
  const hue = (i * 137.508) % 360;
  const c = new THREE.Color();
  c.setHSL(hue / 360, 0.65, 0.55);
  return c;
}

function makeCurve(a, b, lift = 0.25) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const outward = mid.clone().normalize().multiplyScalar(lift);
  const c1 = a.clone().lerp(mid, 0.55).add(outward);
  const c2 = b.clone().lerp(mid, 0.55).add(outward);
  return new THREE.CatmullRomCurve3([a, c1, c2, b]);
}

function makeEdge(aIdx, bIdx, color) {
  const a = nodes[aIdx].position;
  const b = nodes[bIdx].position;
  const curve = makeCurve(a, b, 0.22);

  const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.010, 8, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.0,
    transparent: true,
    opacity: 0.60,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);

  const trainGeo = new THREE.SphereGeometry(0.018, 16, 16);
  const trainMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.2,
    metalness: 0.0,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.35,
  });
  const train = new THREE.Mesh(trainGeo, trainMat);

  return { aIdx, bIdx, curve, tube, train, speed: 0.10 + Math.random() * 0.20, phase: Math.random() };
}

function groupEdges(pairs, color) {
  const g = new THREE.Group();
  const edges = pairs.map(([a, b]) => {
    const e = makeEdge(a, b, color);
    g.add(e.tube);
    g.add(e.train);
    return e;
  });
  return { group: g, edges };
}

function pickByKeywords(regions, keywords, limit = 14) {
  const ks = keywords.map(k => k.toLowerCase());
  const hits = [];
  for (let i = 0; i < regions.length; i++) {
    const name = (regions[i].label || '').toLowerCase();
    if (ks.some(k => name.includes(k))) hits.push(i);
  }
  hits.sort((a, b) => (regions[a].label || '').localeCompare(regions[b].label || ''));
  return hits.slice(0, limit);
}

function chainPairsFromIndices(indices) {
  if (indices.length < 2) return [];
  const unused = indices.slice();
  const order = [unused.shift()];

  while (unused.length) {
    const last = order[order.length - 1];
    let bestJ = 0;
    let bestD = Infinity;
    for (let j = 0; j < unused.length; j++) {
      const d = nodes[last].position.distanceTo(nodes[unused[j]].position);
      if (d < bestD) { bestD = d; bestJ = j; }
    }
    order.push(unused.splice(bestJ, 1)[0]);
  }

  const pairs = [];
  for (let i = 0; i < order.length - 1; i++) pairs.push([order[i], order[i + 1]]);
  return pairs;
}

// ---------- Load AAL + build nodes ----------
let atlas = null;
let regions = [];
let nodes = [];
let stimuli = {};
let currentStim = 'rest';

async function loadAAL() {
  const r = await fetch(AAL_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${AAL_URL}`);
  return await r.json();
}

function buildNodesFromRegions(regionsIn) {
  const pts = regionsIn.map(r => new THREE.Vector3(r.center_mm[0], r.center_mm[1], r.center_mm[2]));
  const tf = fitTransform(pts, 1.0);

  const worldSize = tf.size.clone().multiplyScalar(tf.scale);
  shell.scale.set(
    (worldSize.x / 2) * 1.18,
    (worldSize.y / 2) * 1.18,
    (worldSize.z / 2) * 1.18
  );

  const vols = regionsIn.map(r => r.volume_mm3 || 0);
  const vMin = Math.min(...vols);
  const vMax = Math.max(...vols);
  const denom = (vMax - vMin) || 1;

  const baseR = 0.010;
  const geo = new THREE.SphereGeometry(1.0, 18, 18);

  const meshes = [];
  for (let i = 0; i < regionsIn.length; i++) {
    const reg = regionsIn[i];
    const p = new THREE.Vector3(reg.center_mm[0], reg.center_mm[1], reg.center_mm[2]);
    p.sub(tf.center).multiplyScalar(tf.scale);

    const normV = ((reg.volume_mm3 || 0) - vMin) / denom;
    const r = baseR * (0.8 + 0.9 * normV);

    const color = colorForIndex(i);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.0 });

    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(r);
    m.position.copy(p);
    m.userData = { regIndex: i, ...reg };
    scene.add(m);
    meshes.push(m);
  }

  controls.target.set(0, 0, 0);
  controls.update();
  return meshes;
}

function buildStimuli() {
  const visualIdx = pickByKeywords(regions, ['calcarine', 'cuneus', 'lingual', 'occipital', 'fusiform'], 14);
  const motorIdx  = pickByKeywords(regions, ['precentral', 'postcentral', 'supp', 'paracentral', 'rolandic'], 14);
  const audIdx    = pickByKeywords(regions, ['heschl', 'temporal_sup', 'temporal', 'insula', 'rolandic_oper'], 14);
  const restIdx   = pickByKeywords(regions, ['precuneus', 'cingulum', 'angular', 'frontal_med', 'parietal_inf'], 14);

  const fallback = (n = 12) => Array.from({ length: Math.min(n, nodes.length) }, (_, i) => i);

  const restPairs   = chainPairsFromIndices(restIdx.length >= 2 ? restIdx : fallback(12));
  const visualPairs = chainPairsFromIndices(visualIdx.length >= 2 ? visualIdx : fallback(12));
  const motorPairs  = chainPairsFromIndices(motorIdx.length >= 2 ? motorIdx : fallback(12));
  const audPairs    = chainPairsFromIndices(audIdx.length >= 2 ? audIdx : fallback(12));

  const make = (pairs, hex) => groupEdges(pairs, new THREE.Color(hex));

  const stim = {
    rest:     make(restPairs,   0x66ccff),
    visual:   make(visualPairs, 0xffcc66),
    motor:    make(motorPairs,  0x99ff99),
    auditory: make(audPairs,    0xff99cc),
  };

  for (const k of Object.keys(stim)) {
    stim[k].group.visible = false;
    scene.add(stim[k].group);
  }

  return stim;
}

function setStim(name) {
  if (!stimuli[name]) return;
  if (stimuli[currentStim]) stimuli[currentStim].group.visible = false;
  currentStim = name;
  stimuli[currentStim].group.visible = true;
  hud.stimulusName.textContent = currentStim;
  setActiveButton(currentStim);
}

// Buttons
const buttons = [...document.querySelectorAll('button[data-stim]')];
function setActiveButton(name) {
  buttons.forEach(b => b.classList.toggle('active', b.dataset.stim === name));
}
buttons.forEach(btn => btn.addEventListener('click', () => setStim(btn.dataset.stim)));

// ---------- Render loop ----------
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const dpr = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

const clock = new THREE.Clock();

function updateHover() {
  if (!nodes.length) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(nodes, false);
  if (hits.length) {
    const m = hits[0].object;
    if (hovered !== m) {
      hovered = m;
      hud.hoverName.textContent = m.userData.label || '—';
    }
  } else {
    if (hovered !== null) {
      hovered = null;
      hud.hoverName.textContent = '—';
    }
  }
}

function tick() {
  resize();
  controls.update();
  updateHover();

  const t = clock.getElapsedTime();
  const s = stimuli[currentStim];
  if (s) {
    for (const e of s.edges) {
      const u = (t * e.speed + e.phase) % 1;
      e.train.position.copy(e.curve.getPointAt(u));
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ---------- Boot ----------
(async function boot() {
  try {
    const data = await loadAAL();
    atlas = data.atlas;
    regions = data.regions;

    hud.atlasName.textContent = `AAL ${atlas.version}`;
    hud.nodeCount.textContent = String(regions.length);

    nodes = buildNodesFromRegions(regions);
    stimuli = buildStimuli();
    setStim('rest');

    tick();

    window.__BALLPIT__ = {
      BUILD_ID,
      atlas,
      regionCount: regions.length,
      sampleLabels: regions.slice(0, 10).map(r => r.label),
      currentStim: () => currentStim,
    };
  } catch (err) {
    console.error(err);
    hud.nodeCount.textContent = 'ERROR';
    hud.hoverName.textContent = String(err?.message || err);
    hud.atlasName.textContent = 'AAL (load failed)';
  }
})();
