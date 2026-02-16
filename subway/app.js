import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BUILD_ID = `M0-${new Date().toISOString()}`;
document.getElementById('buildId').textContent = BUILD_ID;

// ---------- Three.js baseline ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
camera.position.set(2.2, 1.2, 2.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

scene.add(new THREE.AxesHelper(1.2));

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(2, 3, 2);
scene.add(dir);

// “Brain-ish” shell (ellipsoid)
const shellGeo = new THREE.SphereGeometry(1.0, 64, 64);
shellGeo.scale(1.15, 0.90, 1.05);
const shellMat = new THREE.MeshStandardMaterial({
  color: 0xdddddd,
  transparent: true,
  opacity: 0.10,
  roughness: 0.9,
  metalness: 0.0,
});
const shell = new THREE.Mesh(shellGeo, shellMat);
scene.add(shell);

// ---------- Placeholder regions (nodes) ----------
function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color);
  };
  const r = f(0), g = f(8), b = f(4);
  return (r << 16) + (g << 8) + b;
}

function randomPointInEllipsoid() {
  while (true) {
    const x = (Math.random() * 2 - 1) * 1.05;
    const y = (Math.random() * 2 - 1) * 0.80;
    const z = (Math.random() * 2 - 1) * 0.95;
    const v = (x*x)/(1.05*1.05) + (y*y)/(0.80*0.80) + (z*z)/(0.95*0.95);
    if (v <= 1) return new THREE.Vector3(x, y, z);
  }
}

const nodes = [];
const nodeGeo = new THREE.SphereGeometry(0.035, 18, 18);

for (let i = 0; i < 22; i++) {
  const hue = (i * 360 / 22) % 360;
  const colorHex = hslToHex(hue, 0.70, 0.55);
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6, metalness: 0.0 });

  const mesh = new THREE.Mesh(nodeGeo, mat);
  mesh.position.copy(randomPointInEllipsoid());

  const name = `Placeholder_${String(i + 1).padStart(2, '0')}`;
  mesh.userData = { name, idx: i, colorHex };
  scene.add(mesh);

  nodes.push(mesh);
}

document.getElementById('nodeCount').textContent = String(nodes.length);

// ---------- “Subway” pathways ----------
function makeCurve(a, b, lift = 0.25) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const outward = mid.clone().normalize().multiplyScalar(lift);
  const c1 = a.clone().lerp(mid, 0.55).add(outward);
  const c2 = b.clone().lerp(mid, 0.55).add(outward);
  return new THREE.CatmullRomCurve3([a, c1, c2, b]);
}

function makeEdge(aIdx, bIdx, colorHex) {
  const a = nodes[aIdx].position;
  const b = nodes[bIdx].position;
  const curve = makeCurve(a, b, 0.22);

  const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.012, 8, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.7,
    metalness: 0.0,
    transparent: true,
    opacity: 0.60,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);

  const trainGeo = new THREE.SphereGeometry(0.022, 16, 16);
  const trainMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.2,
    metalness: 0.0,
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: 0.35,
  });
  const train = new THREE.Mesh(trainGeo, trainMat);

  return {
    aIdx, bIdx,
    curve,
    tube,
    train,
    speed: 0.12 + Math.random() * 0.22,
    phase: Math.random(),
  };
}

function groupEdges(pairs, colorHex) {
  const g = new THREE.Group();
  const edges = pairs.map(([a,b]) => {
    const e = makeEdge(a, b, colorHex);
    g.add(e.tube);
    g.add(e.train);
    return e;
  });
  return { group: g, edges };
}

const stimuli = {
  rest: groupEdges([[0,1],[2,3],[4,5],[6,7],[8,9],[10,11]], 0x66ccff),
  visual: groupEdges([[0,4],[4,8],[8,12],[12,16],[16,20]], 0xffcc66),
  motor: groupEdges([[1,5],[5,9],[9,13],[13,17],[17,21]], 0x99ff99),
  auditory: groupEdges([[2,6],[6,10],[10,14],[14,18]], 0xff99cc),
};

for (const k of Object.keys(stimuli)) {
  stimuli[k].group.visible = false;
  scene.add(stimuli[k].group);
}

let currentStim = 'rest';
stimuli[currentStim].group.visible = true;
document.getElementById('stimulusName').textContent = currentStim;

// Buttons
const buttons = [...document.querySelectorAll('button[data-stim]')];
function setActiveButton(name) {
  buttons.forEach(b => b.classList.toggle('active', b.dataset.stim === name));
}
setActiveButton(currentStim);

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    const next = btn.dataset.stim;
    if (!stimuli[next] || next === currentStim) return;

    stimuli[currentStim].group.visible = false;
    currentStim = next;
    stimuli[currentStim].group.visible = true;

    document.getElementById('stimulusName').textContent = currentStim;
    setActiveButton(currentStim);
  });
});

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
window.addEventListener('resize', resize);

const clock = new THREE.Clock();

function tick() {
  resize();
  controls.update();

  const t = clock.getElapsedTime();
  const { edges } = stimuli[currentStim];

  for (const e of edges) {
    const u = (t * e.speed + e.phase) % 1;
    e.train.position.copy(e.curve.getPointAt(u));
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Truth probe
window.__BRAIN_SUBWAY_M0__ = {
  BUILD_ID,
  nodes: nodes.map(n => ({ name: n.userData.name, pos: n.position.toArray() })),
  currentStim: () => currentStim,
};
