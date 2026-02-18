import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BUILD_ID = `BALLPIT-AAL3-${new Date().toISOString()}`;
document.getElementById('buildId').textContent = BUILD_ID;

const DATA_VERSION = 'ballpit3';
const AAL_URL = `./data/aal_regions.json?v=${DATA_VERSION}`;
const STIM_URL = `./data/stimuli.json?v=${DATA_VERSION}`;

const hud = {
  nodeCount: document.getElementById('nodeCount'),
  stimulusName: document.getElementById('stimulusName'),
  hoverName: document.getElementById('hoverName'),
  atlasName: document.getElementById('atlasName'),
  tracksInfo: document.getElementById('tracksInfo'),
  edgeCount: document.getElementById('edgeCount'),
};

hud.nodeCount.textContent = 'loading…';
hud.hoverName.textContent = '—';
hud.atlasName.textContent = '—';
if (hud.tracksInfo) hud.tracksInfo.textContent = 'loading…';
if (hud.edgeCount) hud.edgeCount.textContent = '—';

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

// Greedy “subway route” through chosen nodes (for unordered stop sets)
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

function pairsFromStops(stopIndices, ordered=false) {
  const idxs = stopIndices.filter(i => Number.isInteger(i));
  if (idxs.length < 2) return [];
  if (ordered) {
    const pairs = [];
    for (let i = 0; i < idxs.length - 1; i++) pairs.push([idxs[i], idxs[i+1]]);
    return pairs;
  }
  return chainPairsFromIndices(idxs);
}

// ---------- Load data ----------
let atlas = null;
let regions = [];
let nodes = [];
let stimuli = {};
let currentStim = 'rest';

// map aal_value -> node index
let aalToNodeIndex = new Map();

async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${url}`);
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

  // mapping
  aalToNodeIndex = new Map();
  for (let i = 0; i < regionsIn.length; i++) {
    const v = Number(regionsIn[i].aal_value);
    if (Number.isFinite(v)) aalToNodeIndex.set(v, i);
  }

  controls.target.set(0, 0, 0);
  controls.update();
  return meshes;
}

function buildStimuliFromSpec(spec) {
  const out = {};
  const missing = {};

  const stimSpec = spec?.stimuli || {};
  for (const stimName of Object.keys(stimSpec)) {
    const s = stimSpec[stimName] || {};
    const color = new THREE.Color(s.color || '#ffffff');
    const lines = Array.isArray(s.lines) ? s.lines : [];

    let pairsAll = [];
    for (const line of lines) {
      // edges optional: list of [aal_value, aal_value]
      if (Array.isArray(line?.edges)) {
        for (const e of line.edges) {
          if (!Array.isArray(e) || e.length !== 2) continue;
          const aVal = Number(e[0]), bVal = Number(e[1]);
          const aIdx = aalToNodeIndex.get(aVal);
          const bIdx = aalToNodeIndex.get(bVal);
          if (aIdx == null || bIdx == null) {
            missing[stimName] = missing[stimName] || [];
            missing[stimName].push([aVal, bVal]);
            continue;
          }
          pairsAll.push([aIdx, bIdx]);
        }
        continue;
      }

      // stops: list of aal_value
      const stops = Array.isArray(line?.stops) ? line.stops : [];
      const ordered = !!line?.ordered;

      const idxs = [];
      for (const v of stops) {
        const aVal = Number(v);
        const idx = aalToNodeIndex.get(aVal);
        if (idx == null) {
          missing[stimName] = missing[stimName] || [];
          missing[stimName].push(aVal);
          continue;
        }
        idxs.push(idx);
      }

      pairsAll = pairsAll.concat(pairsFromStops(idxs, ordered));
    }

    out[stimName] = groupEdges(pairsAll, color);
    out[stimName].group.visible = false;
    scene.add(out[stimName].group);
  }

  // HUD truth probe
  const stimCount = Object.keys(out).length;
  const lineCount = Object.values(stimSpec).reduce((acc, s) => acc + (Array.isArray(s?.lines) ? s.lines.length : 0), 0);
  if (hud.tracksInfo) hud.tracksInfo.textContent = `stimuli.json (${stimCount} stims, ${lineCount} lines)`;

  if (Object.keys(missing).length) {
    console.warn("Missing stops/edges in stimuli.json:", missing);
  }

  return out;
}

function setStim(name) {
  if (!stimuli[name]) return;
  if (stimuli[currentStim]) stimuli[currentStim].group.visible = false;
  currentStim = name;
  stimuli[currentStim].group.visible = true;
  hud.stimulusName.textContent = currentStim;
  setActiveButton(currentStim);
  if (hud.edgeCount) hud.edgeCount.textContent = String(stimuli[currentStim]?.edges?.length ?? 0);
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
    const aal = await loadJSON(AAL_URL);
    atlas = aal.atlas;
    regions = aal.regions;

    hud.atlasName.textContent = `AAL ${atlas.version}`;
    hud.nodeCount.textContent = String(regions.length);

    nodes = buildNodesFromRegions(regions);

    // Tracks from file
    const stimSpec = await loadJSON(STIM_URL);
    stimuli = buildStimuliFromSpec(stimSpec);

    // Default
    setStim('rest');

    tick();

    window.__BALLPIT__ = {
      BUILD_ID,
      atlas,
      regionCount: regions.length,
      stimURL: STIM_URL,
      currentStim: () => currentStim,
    };
  } catch (err) {
    console.error(err);
    hud.nodeCount.textContent = 'ERROR';
    hud.hoverName.textContent = String(err?.message || err);
    hud.atlasName.textContent = 'load failed';
    if (hud.tracksInfo) hud.tracksInfo.textContent = 'load failed';
  }
})();
