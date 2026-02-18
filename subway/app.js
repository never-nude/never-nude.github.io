import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BUILD_ID = `BALLPIT-CONN1-${new Date().toISOString()}`;
document.getElementById('buildId').textContent = BUILD_ID;

const DATA_VERSION = 'ballpit5';
const AAL_URL  = `./data/aal_regions.json?v=${DATA_VERSION}`;
const STIM_URL = `./data/stimuli.json?v=${DATA_VERSION}`;
const CONN_URL = `./data/connectome_edges.json?v=${DATA_VERSION}`;

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
hud.tracksInfo.textContent = 'loading…';
hud.edgeCount.textContent = '—';

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

function makeEdge(aIdx, bIdx, color, wNorm = 0.5) {
  const a = nodes[aIdx].position;
  const b = nodes[bIdx].position;
  const curve = makeCurve(a, b, 0.22);

  const radius = 0.006 + 0.016 * wNorm;
  const opacity = 0.22 + 0.62 * wNorm;
  const speed = 0.06 + 0.30 * wNorm;

  const tubeGeo = new THREE.TubeGeometry(curve, 48, radius, 8, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.0,
    transparent: true,
    opacity,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);

  const trainR = 0.014 + 0.012 * wNorm;
  const trainGeo = new THREE.SphereGeometry(trainR, 16, 16);
  const trainMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.2,
    metalness: 0.0,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.25 + 0.45 * wNorm,
  });
  const train = new THREE.Mesh(trainGeo, trainMat);

  return { aIdx, bIdx, curve, tube, train, speed, phase: Math.random() };
}

function groupEdgesWeighted(pairsW, color) {
  const g = new THREE.Group();
  const ws = pairsW.map(e => e.w);
  const wMin = Math.min(...ws, 0);
  const wMax = Math.max(...ws, 1);
  const denom = (wMax - wMin) || 1;

  const edges = [];
  for (const e of pairsW) {
    const wNorm = (e.w - wMin) / denom;
    const ed = makeEdge(e.aIdx, e.bIdx, color, wNorm);
    g.add(ed.tube);
    g.add(ed.train);
    edges.push(ed);
  }
  return { group: g, edges };
}

async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Fetch failed ${r.status} for ${url}`);
  return await r.json();
}

// ---------- Data state ----------
let atlas = null;
let regions = [];
let nodes = [];
let stimuli = {};
let currentStim = 'rest';
let aalToNodeIndex = new Map();
let connectome = null;

// ---------- Build nodes ----------
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

  aalToNodeIndex = new Map();
  for (let i = 0; i < regionsIn.length; i++) {
    aalToNodeIndex.set(Number(regionsIn[i].aal_value), i);
  }

  controls.target.set(0, 0, 0);
  controls.update();
  return meshes;
}

// ---------- Build connectome-driven stimuli ----------
function selectEdgesForLine(line, maxEdges) {
  const stops = Array.isArray(line?.stops) ? line.stops : [];
  const idxs = [];
  for (const v of stops) {
    const idx = aalToNodeIndex.get(Number(v));
    if (idx != null) idxs.push(idx);
  }
  const set = new Set(idxs);
  if (set.size < 2) return [];

  // Filter precomputed connectome edges
  const out = [];
  for (const e of connectome.edges) {
    const aIdx = aalToNodeIndex.get(e[0]);
    const bIdx = aalToNodeIndex.get(e[1]);
    if (aIdx == null || bIdx == null) continue;
    if (set.has(aIdx) && set.has(bIdx)) {
      out.push({ aIdx, bIdx, w: e[2] });
    }
  }

  out.sort((x,y) => y.w - x.w);
  return out.slice(0, maxEdges);
}

function buildStimuliFromSpec(spec) {
  const out = {};
  const stimSpec = spec?.stimuli || {};

  const stimNames = Object.keys(stimSpec);
  const totalLines = stimNames.reduce((acc, k) => acc + (Array.isArray(stimSpec[k]?.lines) ? stimSpec[k].lines.length : 0), 0);

  hud.tracksInfo.textContent = `stimuli.json (${stimNames.length} stims, ${totalLines} lines) + connectome (${connectome.n_edges} edges)`;

  for (const stimName of stimNames) {
    const s = stimSpec[stimName] || {};
    const color = new THREE.Color(s.color || '#ffffff');
    const lines = Array.isArray(s.lines) ? s.lines : [];

    const maxStimEdges = Number.isFinite(s.max_edges) ? Math.max(6, s.max_edges) : 48;
    const perLine = Math.max(6, Math.floor(maxStimEdges / Math.max(1, lines.length)));

    const chosen = [];
    const seen = new Set();

    for (const line of lines) {
      const maxEdges = Number.isFinite(line?.max_edges) ? Math.max(4, line.max_edges) : perLine;
      const edges = selectEdgesForLine(line, maxEdges);

      for (const e of edges) {
        const a = Math.min(e.aIdx, e.bIdx);
        const b = Math.max(e.aIdx, e.bIdx);
        const key = `${a}-${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        chosen.push(e);
      }
    }

    // Fallback: if connectome produces nothing, make a minimal chain
    if (chosen.length === 0) {
      const stopsAll = [];
      for (const line of lines) {
        const stops = Array.isArray(line?.stops) ? line.stops : [];
        for (const v of stops) {
          const idx = aalToNodeIndex.get(Number(v));
          if (idx != null) stopsAll.push(idx);
        }
      }
      const uniq = [...new Set(stopsAll)];
      for (let i = 0; i < uniq.length - 1; i++) {
        chosen.push({ aIdx: uniq[i], bIdx: uniq[i+1], w: 0.5 });
      }
    }

    const g = groupEdgesWeighted(chosen, color);
    g.group.visible = false;
    scene.add(g.group);
    out[stimName] = g;
  }

  return out;
}

function setStim(name) {
  if (!stimuli[name]) return;
  if (stimuli[currentStim]) stimuli[currentStim].group.visible = false;
  currentStim = name;
  stimuli[currentStim].group.visible = true;
  hud.stimulusName.textContent = currentStim;
  hud.edgeCount.textContent = String(stimuli[currentStim]?.edges?.length ?? 0);
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
    const aal = await loadJSON(AAL_URL);
    atlas = aal.atlas;
    regions = aal.regions;

    hud.atlasName.textContent = `AAL ${atlas.version}`;
    hud.nodeCount.textContent = String(regions.length);

    nodes = buildNodesFromRegions(regions);

    const stimSpec = await loadJSON(STIM_URL);
    connectome = await loadJSON(CONN_URL);

    stimuli = buildStimuliFromSpec(stimSpec);
    setStim('rest');
    tick();

    window.__BALLPIT__ = {
      BUILD_ID,
      atlas,
      regionCount: regions.length,
      stimURL: STIM_URL,
      connURL: CONN_URL,
      currentStim: () => currentStim,
    };
  } catch (err) {
    console.error(err);
    hud.nodeCount.textContent = 'ERROR';
    hud.hoverName.textContent = String(err?.message || err);
    hud.atlasName.textContent = 'load failed';
    hud.tracksInfo.textContent = 'load failed';
  }
})();
