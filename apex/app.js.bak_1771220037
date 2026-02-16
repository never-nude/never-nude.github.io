import * as THREE from "../vendor/three.module.js";

const BUILD = "BUILD0036";
const PROJECT = "Apex";

const $ = (id) => document.getElementById(id);
const vParam = new URLSearchParams(location.search).get("v") ?? "(none)";

const ui = {
  path: $("path"),
  vtag: $("vtag"),
  rendererTag: $("rendererTag"),
  loadedAt: $("loadedAt"),
  genTag: $("genTag"),
  stageTag: $("stageTag"),
  lineTag: $("lineTag"),
  socTag: $("socTag"),
  herdTag: $("herdTag"),
  dietTag: $("dietTag"),
  ecoTag: $("ecoTag"),
  
  signalTag: $("signalTag"),
mateTag: $("mateTag"),
  traitsTag: $("traitsTag"),
  lastTag: $("lastTag"),
  status: $("status"),
  overlay: $("overlay"),
  overlayStats: $("overlayStats"),
  cards: $("cards"),
};

ui.vtag.textContent = vParam;
ui.loadedAt.textContent = new Date().toLocaleString();
ui.path.textContent = location.pathname;

const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
try { renderer.outputColorSpace = THREE.SRGBColorSpace; } catch {}
ui.rendererTag.textContent = `THREE r${THREE.REVISION}`;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 250);
const camOffset = new THREE.Vector3(0, 6.5, 10.5);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// Prevent page scroll from arrows/space
window.addEventListener("keydown", (e) => {
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
}, { passive: false });

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(6, 12, 7);
scene.add(sun);

// Grid proof
const grid = new THREE.GridHelper(200, 200, 0x2a3342, 0x1b2230);
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

// Invisible ground for raycast clicks
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshBasicMaterial({ visible: false })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Input
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add((e.key || "").toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete((e.key || "").toLowerCase()));

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hypot2(x, z) { return Math.sqrt(x*x + z*z); }
function rand(a, b) { return a + Math.random() * (b - a); }
function mix(a, b, t) { return a*(1-t) + b*t; }

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function mixHex(c1, c2, t) {
  const r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
  const r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
  const r = Math.round(mix(r1, r2, t));
  const g = Math.round(mix(g1, g2, t));
  const b = Math.round(mix(b1, b2, t));
  return (r<<16) | (g<<8) | b;
}

function pickWeighted(list) {
  let sum = 0;
  for (const it of list) sum += Math.max(0, it.w);
  if (sum <= 1e-9) return list[list.length - 1];
  let r = Math.random() * sum;
  for (const it of list) {
    r -= Math.max(0, it.w);
    if (r <= 0) return it;
  }
  return list[list.length - 1];
}

// ----- Genome -----
let genome = {
  speed: 1.0,
  efficiency: 1.0,
  plantDig: 1.0,
  meatDig: 1.0,
  social: 0.55,
};

let generation = 1;
let lastMutationName = "(none)";
let lastMutationTint = 0xc8dcff;

// ----- Lineage -----
let lineage = {
  species: "A",
  breed: "Neutral",
  bodyColor: 0xffffff,
  morph: { tailLen: 1.0, nose: 1.0 },
};

function speciesDistance(a, b) {
  if (a === b) return 0;
  if (a === "AB" || b === "AB") return 0.5;
  return 1;
}
function offspringSpecies(a, b) {
  if (a === b) return a;
  return "AB";
}

function traitsString() {
  return `spd=${genome.speed.toFixed(2)} eff=${genome.efficiency.toFixed(2)} pfl=${genome.plantDig.toFixed(2)} mea=${genome.meatDig.toFixed(2)} soc=${genome.social.toFixed(2)}`;
}

// ----- Life stage -----
let maturity = 1.0;
function stageName(m) {
  if (m < 0.35) return "BABY";
  if (m < 0.85) return "JUVENILE";
  return "ADULT";
}
function stageScale(m) { return 0.55 + 0.45 * clamp(m, 0, 1); }
function isAdult() { return maturity >= 0.92; }

// ----- Creature -----
const creature = { pos: new THREE.Vector3(0, 0.55, 0), vx: 0, vz: 0, energy: 60, alive: true };

// Visuals
const organism = new THREE.Group();
organism.position.copy(creature.pos);

const bodyMat = new THREE.MeshStandardMaterial({ color: lineage.bodyColor, roughness: 0.35, metalness: 0.05 });
const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 18), bodyMat);
organism.add(body);

const noseMat = new THREE.MeshStandardMaterial({ color: 0x3c3c5a, roughness: 0.8, metalness: 0.0 });
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), noseMat);
nose.position.set(0.42, 0.05, 0);
organism.add(nose);

const tailMat = new THREE.MeshStandardMaterial({
  color: lastMutationTint, roughness: 0.9, metalness: 0.0, transparent: true, opacity: 0.85
});
const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 14), tailMat);
tail.rotation.z = Math.PI / 2;
tail.position.set(-0.85, 0, 0);
organism.add(tail);

scene.add(organism);

function applyPhenotype() {
  body.material.color.setHex(lineage.bodyColor);
  tail.material.color.setHex(lastMutationTint);
  tail.scale.set(1, lineage.morph.tailLen, 1);
  nose.scale.setScalar(lineage.morph.nose);
}

// ----- Rings -----
const rings = [];
const ringGeom = new THREE.TorusGeometry(0.55, 0.04, 10, 48);
const ringMatPlant = new THREE.MeshBasicMaterial({ color: 0x78c8ff, transparent: true, opacity: 0.85 });
const ringMatEat   = new THREE.MeshBasicMaterial({ color: 0xffe68c, transparent: true, opacity: 0.95 });
const ringMatPrey  = new THREE.MeshBasicMaterial({ color: 0xff6677, transparent: true, opacity: 0.85 });

function spawnRing(x, z, kind="plant") {
  const base = kind === "eat" ? ringMatEat : (kind === "prey" ? ringMatPrey : ringMatPlant);
  const m = base.clone();
  const ring = new THREE.Mesh(ringGeom, m);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.03, z);
  scene.add(ring);
  rings.push({ mesh: ring, t: 0, eat: (kind === "eat") });
}

// ----- World time -----
let worldT = 0;

// ----- Telemetry -----
function newLifeStats() {
  return {
    t: 0,
    distance: 0,
    sprintT: 0,
    starvingT: 0,
    foodsEaten: 0,
    plantsEaten: 0,
    preyEaten: 0,
    energyGained: 0,
    energyFromPlants: 0,
    energyFromMeat: 0,
  };
}
let life = newLifeStats();


// ----- Courtship signal (BUILD0013) -----
// "Signal" = what your recent eating behavior communicates socially.
// It fades over time. Higher-quality meals produce stronger signal.
let lastMeal = { t: -9999, type: "none", grade: "(none)", value: 0, gained: 0 };
const SIGNAL_FADE_S = 25.0; // seconds until potency hits ~0

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function mealQuality01(value){
  // Values in this sim are roughly 10..36 (sprout..dart prey)
  return clamp01((value - 10) / 26);
}

function signalPotency01(nowT){
  const age = Math.max(0, nowT - lastMeal.t);
  return clamp01(1 - age / SIGNAL_FADE_S);
}

function signalStrength01(nowT){
  const p = signalPotency01(nowT);
  const q = mealQuality01(lastMeal.value);
  // Bias toward quality, but keep it nonzero for any fresh meal
  return p * (0.35 + 0.65 * q);
}

function dietFractions(){
  const p = life.plantsEaten;
  const m = life.preyEaten;
  const tot = Math.max(1e-6, p + m);
  return { plant: p / tot, meat: m / tot, balance: 1 - Math.abs((p - m) / tot) };
}

function signalText(nowT){
  const pot = signalPotency01(nowT);
  const q = mealQuality01(lastMeal.value);
  if (lastMeal.type === "none") return "none";
  return `${lastMeal.type}:${lastMeal.grade} q=${q.toFixed(2)} pot=${pot.toFixed(2)}`;
}

function mateSignalFactor(m, nowT){
  // Factor multiplies courting fill rate. Calibrated for obvious feel differences.
  const s = signalStrength01(nowT);
  const d = dietFractions();

  // Base: even with no signal, courting still works (just slower for Prime).
  let f = 1.0;

  if (m.trait === "verdant") {
    // Likes plant-heavy diet; boost if last meal was flora.
    const lastBonus = (lastMeal.type === "flora") ? (0.9 * s) : (-0.25 * s);
    f = 0.55 + 1.10 * d.plant + lastBonus;
  } else if (m.trait === "crimson") {
    // Likes meat-heavy diet; boost if last meal was fauna.
    const lastBonus = (lastMeal.type === "fauna") ? (0.9 * s) : (-0.25 * s);
    f = 0.55 + 1.10 * d.meat + lastBonus;
  } else if (m.trait === "prime") {
    // Likes high-quality signal + balanced diet (skill expression).
    f = 0.40 + 2.40 * s + 0.55 * d.balance;
  } else {
    f = 0.80 + 0.80 * s;
  }

  // Clamp to keep sane but still dramatic.
  return Math.max(0.35, Math.min(3.00, f));
}

function dietBias() {
  const p = life.plantsEaten;
  const m = life.preyEaten;
  return (m - p) / (p + m + 1);
}

function dietProfile() {
  const p = life.plantsEaten;
  const m = life.preyEaten;
  const t = p + m;
  if (t <= 0) return "omnivore";
  const pf = p / t;
  if (pf >= 0.70) return "herbivore";
  if (pf <= 0.30) return "carnivore";
  return "omnivore";
}

function ecoParams() {
  const bias = clamp(dietBias(), -1, 1);
  const scarPlant = clamp(-bias, 0, 1); // herbivore leaning => plants get scarcer/farther
  const scarPrey  = clamp(bias, 0, 1);  // carnivore leaning => prey get scarcer/farther

  const BASE_PLANT = 1.25;
  const BASE_PREY  = 3.00;

  const plantInterval = BASE_PLANT * (1 + scarPlant * 0.90) * (1 - scarPrey * 0.20);
  const preyInterval  = BASE_PREY  * (1 + scarPrey  * 0.90) * (1 - scarPlant * 0.20);

  const plantMinR = 3.0 + scarPlant * 3.0;
  const plantMaxR = 11.0 + scarPlant * 6.0;

  const preyMinR  = 5.0 + scarPrey * 3.0;
  const preyMaxR  = 12.0 + scarPrey * 6.0;

  const preySpeedMult = 1.0 + scarPrey * 0.25;
  const preyFearMult  = 1.0 + scarPrey * 0.30;
  const preyZigMult   = 1.0 + scarPrey * 0.25;

  return {
    bias, scarPlant, scarPrey,
    plantInterval, preyInterval,
    plantMinR, plantMaxR,
    preyMinR, preyMaxR,
    preySpeedMult, preyFearMult, preyZigMult,
  };
}

// ----- Food types & grades -----
const plants = []; // { mesh, value, grade }
const prey = [];   // { mesh, value, grade, vx, vz, turnT, wx, wz, seed, maxSpeed, fearR, fearForce, zig, drag, wander }

const plantGeom = new THREE.SphereGeometry(0.18, 16, 10);
const preyGeom  = new THREE.SphereGeometry(0.19, 18, 12);

const PLANT_GRADES = [
  { id: "sprout", w0: 0.60, value: 10, color: 0xa0ffaa, scale: 1.00, spawnBias: 0.0 },
  { id: "bloom",  w0: 0.30, value: 18, color: 0x7dff8d, scale: 1.10, spawnBias: 0.4 },
  { id: "fruit",  w0: 0.10, value: 30, color: 0xd7ff6a, scale: 1.20, spawnBias: 1.0 },
];

const PREY_GRADES = [
  { id: "slow",   w0: 0.55, value: 12, color: 0xff99aa, scale: 1.05, maxSpeed: 1.35, fearR: 4.3, fearForce: 8.5, zig: 2.2 },
  { id: "runner", w0: 0.35, value: 22, color: 0xff6677, scale: 0.95, maxSpeed: 2.25, fearR: 5.2, fearForce: 10.5, zig: 3.5 },
  { id: "dart",   w0: 0.10, value: 36, color: 0xff4455, scale: 0.85, maxSpeed: 3.05, fearR: 6.0, fearForce: 12.0, zig: 4.6 },
];

function pickPlantGrade(eco) {
  const s = eco.scarPlant;
  return pickWeighted(PLANT_GRADES.map(g => ({
    ...g,
    w: clamp(g.w0 + (g.spawnBias * 0.18 * s) - (1 - g.spawnBias) * 0.12 * s, 0.02, 0.95),
  })));
}

function pickPreyGrade(eco) {
  const s = eco.scarPrey;
  return pickWeighted(PREY_GRADES.map(g => ({
    ...g,
    w: clamp(g.w0 + (g.id === "dart" ? 0.15*s : 0) + (g.id === "runner" ? 0.10*s : 0) - (g.id === "slow" ? 0.22*s : 0), 0.02, 0.95),
  })));
}

function spawnPlantAt(x, z, grade=null) {
  const g = grade ?? PLANT_GRADES[0];
  const mat = new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.55, metalness: 0.0 });
  const mesh = new THREE.Mesh(plantGeom, mat);
  mesh.position.set(x, 0.18, z);
  mesh.scale.setScalar(g.scale);
  scene.add(mesh);
  plants.push({ mesh, value: g.value, grade: g.id });
  spawnRing(x, z, "plant");
}

function spawnPreyAt(x, z, grade=null, eco=null) {
  const g = grade ?? PREY_GRADES[0];
  const e = eco ?? ecoParams();

  const mat = new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.45, metalness: 0.0 });
  const mesh = new THREE.Mesh(preyGeom, mat);
  mesh.position.set(x, 0.19, z);
  mesh.scale.setScalar(g.scale);
  scene.add(mesh);

  prey.push({
    mesh,
    value: g.value,
    grade: g.id,
    vx: rand(-0.7, 0.7),
    vz: rand(-0.7, 0.7),
    turnT: rand(0.35, 0.95),
    wx: rand(-1, 1),
    wz: rand(-1, 1),
    seed: Math.random() * Math.PI * 2,
    maxSpeed: g.maxSpeed * e.preySpeedMult,
    fearR: g.fearR * e.preyFearMult,
    fearForce: g.fearForce * e.preyFearMult,
    zig: g.zig * e.preyZigMult,
    drag: 2.8,
    wander: 0.65,
  });
  spawnRing(x, z, "prey");
}

function spawnAroundPlayer(minR, maxR, fn) {
  const ang = Math.random() * Math.PI * 2;
  const r = rand(minR, maxR);
  const x = creature.pos.x + Math.cos(ang) * r;
  const z = creature.pos.z + Math.sin(ang) * r;
  fn(x, z);
}

// ----- Auto-spawner (D3) -----
const AUTO_SPAWN = true;
const PLANT_CAP = 28;
const PREY_CAP = 12;
let plantTimer = 0;
let preyTimer = 0;

// ----- Click spawn: flora only (debug) -----
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let draftOpen = false;

function clickSpawn(e) {
  if (draftOpen) return;
  const w = window.innerWidth, h = window.innerHeight;
  ndc.x = (e.clientX / Math.max(1, w)) * 2 - 1;
  ndc.y = -((e.clientY / Math.max(1, h)) * 2 - 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(ground, false)[0];
  if (hit) {
    const g = (e.altKey ? PLANT_GRADES[2] : PLANT_GRADES[0]); // Option/Alt => fruit
    spawnPlantAt(hit.point.x, hit.point.z, g);
  }
  flash = Math.max(flash, 1.0);
}
window.addEventListener("pointerdown", clickSpawn);

// ----- Eating (E) with bite-window ring -----
const EAT_R_PLANT = 0.95;
const EAT_R_PREY  = 1.35;
const EAT_SHOW_R  = 2.80;

let eatHint = "none"; // "flora" | "fauna" | "none"
let eatTarget = null; // { type, i, mesh, value, d, grade }

const targetRingGeom = new THREE.TorusGeometry(0.44, 0.05, 10, 48);
const targetRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 });
const targetRing = new THREE.Mesh(targetRingGeom, targetRingMat);
targetRing.rotation.x = Math.PI / 2;
targetRing.position.y = 0.03;
targetRing.visible = false;
scene.add(targetRing);

function eatRadiusFor(type) { return type === "fauna" ? EAT_R_PREY : EAT_R_PLANT; }
function ringColorFor(type) { return type === "fauna" ? 0xff6677 : 0xa0ffaa; }

function nearestEdible() {
  let best = null;
  let bestD2 = Infinity;

  for (let i = 0; i < plants.length; i++) {
    const p = plants[i];
    const dx = p.mesh.position.x - creature.pos.x;
    const dz = p.mesh.position.z - creature.pos.z;
    const d2 = dx*dx + dz*dz;
    if (d2 < bestD2) { bestD2 = d2; best = { type: "flora", i, mesh: p.mesh, value: p.value, grade: p.grade }; }
  }

  for (let i = 0; i < prey.length; i++) {
    const f = prey[i];
    const dx = f.mesh.position.x - creature.pos.x;
    const dz = f.mesh.position.z - creature.pos.z;
    const d2 = dx*dx + dz*dz;
    if (d2 < bestD2) { bestD2 = d2; best = { type: "fauna", i, mesh: f.mesh, value: f.value, grade: f.grade }; }
  }

  if (!best) return null;
  best.d = Math.sqrt(bestD2);
  return best;
}

function updateEatTarget(dt) {
  if (!creature.alive || draftOpen) {
    eatHint = "none";
    eatTarget = null;
    targetRing.visible = false;
    return;
  }

  const n = nearestEdible();
  if (!n || n.d > EAT_SHOW_R) {
    eatHint = "none";
    eatTarget = null;
    targetRing.visible = false;
    return;
  }

  eatTarget = n;

  const r = eatRadiusFor(n.type);
  const ready = n.d <= r;

  targetRing.visible = true;
  targetRing.position.x = n.mesh.position.x;
  targetRing.position.z = n.mesh.position.z;
  targetRing.material.color.setHex(ringColorFor(n.type));

  targetRing.material.opacity = ready ? 0.95 : 0.28;
  const pulse = ready ? (0.86 + 0.14 * Math.sin(worldT * 10.0)) : 1.0;
  const s = ready ? (1.12 * pulse) : 0.96;
  targetRing.scale.set(s, s, s);

  eatHint = ready ? n.type : "none";
}

function tryEat() {
  if (!creature.alive || draftOpen) return;

  const n = eatTarget || nearestEdible();
  if (!n) { flash = Math.max(flash, 0.25); return; }

  const r = eatRadiusFor(n.type);
  if (n.d > r) { flash = Math.max(flash, 0.25); return; }

  let gained = 0;

  if (n.type === "flora") {
    gained = n.value * genome.plantDig;
    scene.remove(plants[n.i].mesh);
    plants.splice(n.i, 1);
    life.plantsEaten += 1;
    life.energyFromPlants += gained;
  } else {
    gained = n.value * genome.meatDig;
    scene.remove(prey[n.i].mesh);
    prey.splice(n.i, 1);
    life.preyEaten += 1;
    life.energyFromMeat += gained;
  }

  lastMeal.t = worldT;
  lastMeal.type = n.type;
  lastMeal.grade = n.grade;
  lastMeal.value = n.value;
  lastMeal.gained = gained;

  creature.energy = clamp(creature.energy + gained, 0, 120);

  life.foodsEaten += 1;
  life.energyGained += gained;

  if (maturity < 1.0) maturity = clamp(maturity + gained * 0.0045, 0, 1);

  spawnRing(creature.pos.x, creature.pos.z, "eat");
  flash = Math.max(flash, 0.85);
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Space") tryEat();
});
// ----- Prey movement -----
const PREY_BOUNDS_R = 30;

function updatePrey(dt) {
  for (let i = 0; i < prey.length; i++) {
    const f = prey[i];

    f.turnT -= dt;
    if (f.turnT <= 0) {
      f.turnT = rand(0.35, 0.95);
      f.wx = rand(-1, 1);
      f.wz = rand(-1, 1);
    }

    let ax = f.wx * f.wander;
    let az = f.wz * f.wander;

    const dx = f.mesh.position.x - creature.pos.x;
    const dz = f.mesh.position.z - creature.pos.z;
    const d2 = dx*dx + dz*dz;

    if (d2 < f.fearR * f.fearR) {
      const d = Math.sqrt(d2) || 1e-6;
      const t = 1 - (d / f.fearR);

      ax += (dx / d) * (f.fearForce * t);
      az += (dz / d) * (f.fearForce * t);

      const px = -(dz / d);
      const pz = (dx / d);
      const zig = Math.sin(worldT * 12.0 + f.seed + i * 0.9) * (f.zig * t);
      ax += px * zig;
      az += pz * zig;
    }

    const bx = f.mesh.position.x - creature.pos.x;
    const bz = f.mesh.position.z - creature.pos.z;
    const br2 = bx*bx + bz*bz;
    if (br2 > PREY_BOUNDS_R * PREY_BOUNDS_R) {
      ax += (-bx) * 0.06;
      az += (-bz) * 0.06;
    }

    f.vx += ax * dt;
    f.vz += az * dt;

    f.vx -= f.vx * f.drag * dt;
    f.vz -= f.vz * f.drag * dt;

    const sp = Math.sqrt(f.vx*f.vx + f.vz*f.vz);
    if (sp > f.maxSpeed) {
      f.vx = (f.vx / sp) * f.maxSpeed;
      f.vz = (f.vz / sp) * f.maxSpeed;
    }

    f.mesh.position.x += f.vx * dt;
    f.mesh.position.z += f.vz * dt;
    f.mesh.position.y = 0.19;
  }
}

// ----- Social herd (boids) -----
const herd = []; // { mesh, vx, vz }
const HERD_N = 18;

let herdTime = 0;
let herdNearest = 999;
let socialComfort = 0;
let socialBurnMulFactor = 1.0;

const herdGeom = new THREE.SphereGeometry(0.32, 18, 12);
const herdMatBase = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 });

function clearHerd() {
  for (const b of herd) scene.remove(b.mesh);
  herd.length = 0;
}
function spawnHerd() {
  clearHerd();
  for (let i = 0; i < HERD_N; i++) {
    const m = herdMatBase.clone();
    m.color.setHex(0xffffff);
    const mesh = new THREE.Mesh(herdGeom, m);
    const ang = Math.random() * Math.PI * 2;
    const dist = 7 + Math.random() * 7;
    mesh.position.set(Math.cos(ang) * dist, 0.32, Math.sin(ang) * dist);
    scene.add(mesh);
    herd.push({ mesh, vx: rand(-1.2, 1.2), vz: rand(-1.2, 1.2) });
  }
}

function measureHerdNearest(pos) {
  if (herd.length === 0) return 999;
  let best = 999;
  for (const b of herd) {
    const dx = b.mesh.position.x - pos.x;
    const dz = b.mesh.position.z - pos.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < best) best = d;
  }
  return best;
}

function computeSocialFactors(nearestDist) {
  const near = clamp(1 - nearestDist / 6.0, 0, 1);
  const pref = (genome.social - 0.5) * 2;
  const comfort = clamp(pref * (near * 2 - 1), -1, 1);
  const factor = clamp(1 - comfort * 0.12, 0.82, 1.22);
  return { comfort, near, factor };
}

function updateHerd(dt) {
  herdTime += dt;

  const neighborR = 4.2;
  const sepR = 1.1;

  const maxSpeed = 3.6;
  const accel = 10.0;
  const drag = 2.4;

  const goalX = Math.sin(herdTime * 0.13) * 12;
  const goalZ = Math.cos(herdTime * 0.11) * 12;

  const fear = clamp(1 - genome.social, 0, 1);
  const attract = clamp((genome.social - 0.65) / 0.35, 0, 1);

  for (let i = 0; i < herd.length; i++) {
    const bi = herd[i];
    const px = bi.mesh.position.x;
    const pz = bi.mesh.position.z;

    let sepX = 0, sepZ = 0;
    let alignX = 0, alignZ = 0;
    let cohX = 0, cohZ = 0;
    let n = 0;

    for (let j = 0; j < herd.length; j++) {
      if (i === j) continue;
      const bj = herd[j];

      const dx = bj.mesh.position.x - px;
      const dz = bj.mesh.position.z - pz;
      const d2 = dx*dx + dz*dz;
      if (d2 > neighborR * neighborR) continue;

      const d = Math.sqrt(d2) || 1e-6;
      n += 1;

      alignX += bj.vx;
      alignZ += bj.vz;

      cohX += bj.mesh.position.x;
      cohZ += bj.mesh.position.z;

      if (d < sepR) {
        const inv = 1.0 / (d2 + 0.06);
        sepX -= dx * inv;
        sepZ -= dz * inv;
      }
    }

    let ax = 0, az = 0;

    if (n > 0) {
      alignX /= n; alignZ /= n;
      cohX = (cohX / n) - px;
      cohZ = (cohZ / n) - pz;

      ax += sepX * 2.2;
      az += sepZ * 2.2;

      ax += (alignX - bi.vx) * 0.55;
      az += (alignZ - bi.vz) * 0.55;

      ax += cohX * 0.22;
      az += cohZ * 0.22;
    }

    ax += (goalX - px) * 0.05;
    az += (goalZ - pz) * 0.05;

    const r2 = px*px + pz*pz;
    if (r2 > 28*28) {
      ax += (-px) * 0.08;
      az += (-pz) * 0.08;
    }

    const dxp = creature.pos.x - px;
    const dzp = creature.pos.z - pz;
    const dp2 = dxp*dxp + dzp*dzp;
    const fleeR = 8.0;
    if (dp2 < fleeR * fleeR) {
      const dp = Math.sqrt(dp2) || 1e-6;
      const t = 1 - (dp / fleeR);
      const awayX = -dxp / dp;
      const awayZ = -dzp / dp;

      ax += awayX * (fear * (8.0 * t));
      az += awayZ * (fear * (8.0 * t));

      ax += (dxp / dp) * (attract * (2.2 * t));
      az += (dzp / dp) * (attract * (2.2 * t));
    }

    bi.vx += ax * accel * dt;
    bi.vz += az * accel * dt;

    bi.vx -= bi.vx * drag * dt;
    bi.vz -= bi.vz * drag * dt;

    const sp = hypot2(bi.vx, bi.vz);
    if (sp > maxSpeed) {
      bi.vx = (bi.vx / sp) * maxSpeed;
      bi.vz = (bi.vz / sp) * maxSpeed;
    }

    bi.mesh.position.x += bi.vx * dt;
    bi.mesh.position.z += bi.vz * dt;
    bi.mesh.position.y = 0.32;
  }
}

window.addEventListener("keydown", (e) => {
  if (draftOpen) return;
  if (e.repeat) return;
  if (e.key === "[") { genome.social = clamp(genome.social - 0.05, 0, 1); flash = Math.max(flash, 0.65); }
  if (e.key === "]") { genome.social = clamp(genome.social + 0.05, 0, 1); flash = Math.max(flash, 0.65); }
});

// ----- Hearts -----
function makeHeartTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const g = c.getContext("2d");
  g.clearRect(0,0,128,128);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "96px system-ui";
  g.fillStyle = "rgba(255, 90, 150, 1)";
  g.fillText("♥", 64, 74);
  const tex = new THREE.CanvasTexture(c);
  try { tex.colorSpace = THREE.SRGBColorSpace; } catch {}
  return tex;
}
const heartTex = makeHeartTexture();
const hearts = []; // { sprite, t, life, vy, vx, vz, rot }

function spawnHeartsAt(x, z, count=6) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: heartTex, transparent: true, opacity: 1, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.set(x + rand(-0.45,0.45), 1.2 + rand(0,0.2), z + rand(-0.45,0.45));
    const sc = 0.42 + rand(0,0.22);
    s.scale.set(sc, sc, sc);
    scene.add(s);
    hearts.push({
      sprite: s,
      t: 0,
      life: 0.9 + rand(0,0.5),
      vy: 1.0 + rand(0,0.9),
      vx: rand(-0.25,0.25),
      vz: rand(-0.25,0.25),
      rot: rand(-2.4, 2.4),
    });
  }
}

// ----- Mate choice system (two candidates + glyphs; BUILD0016) -----
const mates = [];
let mateStatus = "none";
let mateSummary = "";
let selectedMate = null;

// If BUILD0013 signal exists, use it; else fall back.
function safeMateSignalFactor(m) {
  try { if (typeof mateSignalFactor === "function") return mateSignalFactor(m, worldT); } catch (e) {}
  return 1.0;
}

// Wordless trait glyph (3 spokes above each mate):
// green = flora offer, red = fauna offer, blue = chase offer.
const glyphRingGeom = new THREE.TorusGeometry(0.38, 0.03, 8, 48);
const glyphBarGeom = new THREE.BoxGeometry(0.10, 0.06, 0.68);
// Anchor bars so they extend outward from center
glyphBarGeom.translate(0, 0, 0.34);

function offer01(v, denom) { return clamp(0.5 + (v - 1.0) / denom, 0, 1); }
function barScale01(v) { return 0.25 + 1.25 * clamp(v, 0, 1); }

function updateMateGlyph(m, dist) {
  if (!m.glyph) return;

  // Upright billboard (rotate around Y only)
  const dx = camera.position.x - m.mesh.position.x;
  const dz = camera.position.z - m.mesh.position.z;
  m.glyph.rotation.y = Math.atan2(dx, dz);

  const near = clamp(1.0 - dist / 12.0, 0.0, 1.0);
  const stateBoost =
    (m.state === "offering") ? 1.00 :
    (m.state === "courting") ? 0.92 :
    (m.state === "approaching") ? 0.72 :
    0.55;

  const a = (0.18 + 0.82 * near) * stateBoost;
  m.glyph.scale.setScalar(0.92 + 0.22 * near);

  // Per-mate materials => safe to animate opacity
  m.glyphRing.material.opacity = 0.10 * a;
  m.glyphHub.material.opacity  = 0.22 * a;
  m.glyphPlant.material.opacity = 0.90 * a;
  m.glyphMeat.material.opacity  = 0.90 * a;
  m.glyphChase.material.opacity = 0.90 * a;
}

function traitTag(trait) {
  if (trait === "verdant") return "pfl↑";
  if (trait === "crimson") return "mea↑";
  return "?";
}
function mateLabel(m) { return `${m.breed}[${m.species}] ${traitTag(m.trait)}`; }

const mateAuraGeom = new THREE.TorusGeometry(0.72, 0.06, 10, 48);
const badgeLeafGeom = new THREE.OctahedronGeometry(0.22, 0);
const badgeSpikeGeom = new THREE.ConeGeometry(0.16, 0.48, 14);

function makeGlyph() {
  const glyph = new THREE.Group();
  glyph.position.set(0, 1.22, 0);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 });
  const ring = new THREE.Mesh(glyphRingGeom, ringMat);
  ring.rotation.x = Math.PI / 2;
  glyph.add(ring);

  const hubMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 });
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), hubMat);
  glyph.add(hub);

  const plantMat = new THREE.MeshBasicMaterial({ color: 0x55ff88, transparent: true, opacity: 0.0 });
  const meatMat  = new THREE.MeshBasicMaterial({ color: 0xff6677, transparent: true, opacity: 0.0 });
  const chaseMat = new THREE.MeshBasicMaterial({ color: 0x78c8ff, transparent: true, opacity: 0.0 });

  const plant = new THREE.Mesh(glyphBarGeom, plantMat);
  const meat  = new THREE.Mesh(glyphBarGeom, meatMat);
  const chase = new THREE.Mesh(glyphBarGeom, chaseMat);

  plant.rotation.y = 0.0;
  meat.rotation.y  = (Math.PI * 2) / 3;
  chase.rotation.y = -(Math.PI * 2) / 3;

  glyph.add(plant);
  glyph.add(meat);
  glyph.add(chase);

  return { glyph, ring, hub, plant, meat, chase };
}

function makeMateVisual(color, trait) {
  const group = new THREE.Group();

  const bodyGeom = new THREE.SphereGeometry(0.48, 28, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.02 });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  group.add(body);

  let badge = null;
  if (trait === "verdant") {
    const m = new THREE.MeshStandardMaterial({ color: 0x55ff88, roughness: 0.35, metalness: 0.0 });
    badge = new THREE.Mesh(badgeLeafGeom, m);
    badge.position.set(0, 0.74, 0);
  } else if (trait === "crimson") {
    const m = new THREE.MeshStandardMaterial({ color: 0xff4455, roughness: 0.35, metalness: 0.05 });
    badge = new THREE.Mesh(badgeSpikeGeom, m);
    badge.rotation.x = Math.PI;
    badge.position.set(0, 0.82, 0);
  }
  if (badge) group.add(badge);

  const auraColor = mixHex(color, 0xffffff, 0.55);
  const auraMat = new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.0 });
  const aura = new THREE.Mesh(mateAuraGeom, auraMat);
  aura.rotation.x = Math.PI / 2;
  aura.position.y = -0.45;
  group.add(aura);

  const g = makeGlyph();
  group.add(g.glyph);

  return {
    group, aura,
    glyph: g.glyph,
    glyphRing: g.ring,
    glyphHub: g.hub,
    glyphPlant: g.plant,
    glyphMeat: g.meat,
    glyphChase: g.chase,
  };
}

function makeMateCandidate({ species, breed, color, trait, desirability, genomeBias, morphBias, slot }) {
  const vis = makeMateVisual(color, trait);
  const group = vis.group;

  const ang = Math.random() * Math.PI * 2;
  const dist = 9 + Math.random() * 5 + desirability * 2.0;
  group.position.set(
    creature.pos.x + Math.cos(ang) * dist,
    0.48,
    creature.pos.z + Math.sin(ang) * dist
  );

  const g = {
    speed:      clamp(1.0 + (genomeBias.speed ?? 0) + randn()*0.04, 0.70, 1.70),
    efficiency: clamp(1.0 + (genomeBias.efficiency ?? 0) + randn()*0.04, 0.70, 1.70),
    plantDig:   clamp(1.0 + (genomeBias.plantDig ?? 0) + randn()*0.05, 0.60, 1.95),
    meatDig:    clamp(1.0 + (genomeBias.meatDig ?? 0) + randn()*0.05, 0.60, 1.95),
    social:     clamp(0.55 + (genomeBias.social ?? 0) + randn()*0.06, 0.00, 1.00),
  };

  const morph = {
    tailLen: clamp(1.0 + (morphBias.tailLen ?? 0) + randn()*0.06, 0.70, 1.55),
    nose:    clamp(1.0 + (morphBias.nose ?? 0)    + randn()*0.05, 0.75, 1.40),
  };

  // Apply visible glyph scaling (calibrated for legibility)
  const offerPlant = offer01(g.plantDig, 0.35);
  const offerMeat  = offer01(g.meatDig,  0.35);
  const offerChase = offer01(g.speed,    0.12);

  vis.glyphPlant.scale.z = barScale01(offerPlant);
  vis.glyphMeat.scale.z  = barScale01(offerMeat);
  vis.glyphChase.scale.z = barScale01(offerChase);

  const attractReq = 0.75 + desirability * 1.25;

  scene.add(group);

  return {
    mesh: group,
    aura: vis.aura,

    glyph: vis.glyph,
    glyphRing: vis.glyphRing,
    glyphHub: vis.glyphHub,
    glyphPlant: vis.glyphPlant,
    glyphMeat: vis.glyphMeat,
    glyphChase: vis.glyphChase,
    offers: { plant: offerPlant, meat: offerMeat, chase: offerChase },

    species, breed, color, trait,
    desirability,
    attract: 0,
    attractReq,
    genome: g, morph, slot,

    state: "approaching", // approaching -> courting -> offering -> bonding -> shame
    vx: 0, vz: 0,
    offerT: 0,
    bondT: 0,
    heartCd: 0,
    shameT: 0,
    seed: Math.random() * Math.PI * 2,
    shameSign: Math.random() < 0.5 ? -1 : 1,
    dead: false,
  };
}

function updateMateSummary() {
  mateSummary = mates.filter(m => !m.dead).map(m => `${m.breed}(${traitTag(m.trait)})`).join(" / ");
}

function spawnMateCandidates() {
  if (mates.length > 0) return;

  const verdant = makeMateCandidate({
    species: "A",
    breed: "Verdant",
    color: 0x55ff88,
    trait: "verdant",
    desirability: 0.25,
    genomeBias: { plantDig: +0.26, meatDig: -0.10, efficiency: +0.06, social: +0.06 },
    morphBias: { tailLen: +0.10, nose: +0.04 },
    slot: 0,
  });

  const crimson = makeMateCandidate({
    species: "B",
    breed: "Crimson",
    color: 0xff6677,
    trait: "crimson",
    desirability: 0.25,
    genomeBias: { meatDig: +0.26, plantDig: -0.10, speed: +0.06, social: -0.08 },
    morphBias: { tailLen: -0.02, nose: -0.02 },
    slot: 1,
  });

  mates.push(verdant, crimson);
  updateMateSummary();
  mateStatus = `candidates: ${mateSummary}`;
  flash = Math.max(flash, 0.9);
}

function offeringTarget(slot) {
  const ang = (slot === 0) ? +0.85 : -0.85;
  const r = 1.35;
  return new THREE.Vector3(
    creature.pos.x + Math.cos(ang) * r,
    0.48,
    creature.pos.z + Math.sin(ang) * r
  );
}

function setShame(m) {
  if (!m || m.dead) return;
  if (m.state === "shame") return;
  m.state = "shame";
  m.shameT = 0;
  m.offerT = 0;
  flash = Math.max(flash, 0.45);
}

function nearestMate(filterFn) {
  let best = null;
  let bestD = Infinity;
  for (const m of mates) {
    if (m.dead) continue;
    if (!filterFn(m)) continue;
    const dx = m.mesh.position.x - creature.pos.x;
    const dz = m.mesh.position.z - creature.pos.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

function acceptNearestOffering() {
  const m = nearestMate(mm => mm.state === "offering");
  if (!m) return;

  selectedMate = m;
  m.state = "bonding";
  m.bondT = 0;
  m.heartCd = 0;

  for (const other of mates) {
    if (other !== m && !other.dead) setShame(other);
  }

  mateStatus = `bonding with ${mateLabel(m)}`;
  flash = Math.max(flash, 0.9);
}

function rejectNearest() {
  let m = nearestMate(mm => mm.state === "offering");
  if (!m) m = nearestMate(mm => mm.state === "courting");
  if (!m) m = nearestMate(mm => mm.state === "approaching");
  if (!m) return;

  setShame(m);
  if (selectedMate === m) selectedMate = null;
  mateStatus = `rejected ${mateLabel(m)} (shame zigzag)`;
}

function updateMate(m, dt) {
  if (m.dead) return;

  const mx = m.mesh.position.x;
  const mz = m.mesh.position.z;
  const dx = creature.pos.x - mx;
  const dz = creature.pos.z - mz;
  const dist = Math.sqrt(dx*dx + dz*dz);

  updateMateGlyph(m, dist);

  m.aura.material.opacity = 0.0;

  if (m.state === "approaching") {
    const dirx = dist > 1e-6 ? dx / dist : 0;
    const dirz = dist > 1e-6 ? dz / dist : 0;

    const mateAccel = 10.0;
    const mateDrag = 5.5;
    const mateMax = 4.4;

    m.vx += dirx * mateAccel * dt;
    m.vz += dirz * mateAccel * dt;

    m.vx -= m.vx * mateDrag * dt;
    m.vz -= m.vz * mateDrag * dt;

    const sp = Math.sqrt(m.vx*m.vx + m.vz*m.vz);
    if (sp > mateMax) {
      m.vx = (m.vx / sp) * mateMax;
      m.vz = (m.vz / sp) * mateMax;
    }

    m.mesh.position.x += m.vx * dt;
    m.mesh.position.z += m.vz * dt;

    if (dist < 2.45) {
      m.state = "courting";
      m.attract = 0;
      m.vx = 0; m.vz = 0;
      flash = Math.max(flash, 0.6);
    }

  } else if (m.state === "courting") {
    const r = 1.55 + m.desirability * 0.35;
    const w = 1.35 + m.desirability * 0.25;
    const a = worldT * w + m.seed + (m.slot * 1.1);

    const tx = creature.pos.x + Math.cos(a) * r;
    const tz = creature.pos.z + Math.sin(a) * r;

    m.mesh.position.x += (tx - m.mesh.position.x) * (6.0 * dt);
    m.mesh.position.z += (tz - m.mesh.position.z) * (6.0 * dt);
    m.mesh.position.y = 0.48 + Math.sin(worldT * 6.0 + m.seed) * 0.02;

    const sprinting = keys.has("shift");
    const cs = Math.sqrt(creature.vx*creature.vx + creature.vz*creature.vz);
    const calm = (!sprinting && cs < 2.2);

    const inRange = dist < (r + 0.85);

    if (calm && inRange) {
      m.attract += dt * safeMateSignalFactor(m);
    } else {
      m.attract -= dt * 0.55;
    }
    m.attract = clamp(m.attract, 0, m.attractReq);

    const p = clamp(m.attract / Math.max(0.001, m.attractReq), 0, 1);
    m.aura.material.opacity = 0.20 + 0.65 * p;
    const s = 1.0 + 0.35 * p;
    m.aura.scale.set(s, s, s);

    if (m.attract >= m.attractReq) {
      m.state = "offering";
      m.offerT = 0;
      flash = Math.max(flash, 0.8);
    }

  } else if (m.state === "offering") {
    m.offerT += dt;
    const t = offeringTarget(m.slot);
    m.mesh.position.x += (t.x - m.mesh.position.x) * (6.0 * dt);
    m.mesh.position.z += (t.z - m.mesh.position.z) * (6.0 * dt);
    m.mesh.position.y = 0.48 + Math.sin(m.offerT * 6.0) * 0.03;

    const pulse = 1.05 + 0.06 * Math.sin(worldT * 10.0 + m.seed);
    m.aura.material.opacity = 0.70;
    m.aura.scale.set(pulse, pulse, pulse);

  } else if (m.state === "bonding") {
    m.bondT += dt;
    m.heartCd -= dt;

    m.mesh.position.x += dx * 0.9 * dt;
    m.mesh.position.z += dz * 0.9 * dt;
    m.mesh.position.y = 0.48;

    if (m.heartCd <= 0) {
      m.heartCd = 0.15;
      spawnHeartsAt((creature.pos.x + m.mesh.position.x) * 0.5, (creature.pos.z + m.mesh.position.z) * 0.5, 4);
    }

    if (m.bondT >= 1.05) {
      spawnHeartsAt(creature.pos.x, creature.pos.z, 10);
      beginMatingWith(m);
    }

  } else if (m.state === "shame") {
    m.shameT += dt;

    const awayX = mx - creature.pos.x;
    const awayZ = mz - creature.pos.z;
    const awayD = Math.sqrt(awayX*awayX + awayZ*awayZ) || 1;

    const ax = awayX / awayD;
    const az = awayZ / awayD;

    const px = -az;
    const pz = ax;

    const speed = 6.2;
    const zig = Math.sin(m.shameT * 10.0 + m.seed) * 1.1 * m.shameSign;

    m.mesh.position.x += (ax * speed + px * zig) * dt;
    m.mesh.position.z += (az * speed + pz * zig) * dt;
    m.mesh.position.y = 0.48 + Math.sin(m.shameT * 12.0) * 0.04;

    const p = clamp(m.shameT / 1.4, 0, 1);
    const sc = 1.0 - 0.35 * p;
    m.mesh.scale.set(sc, sc, sc);

    if (m.shameT > 1.6 || awayD > 18) {
      scene.remove(m.mesh);
      m.dead = true;
    }
  }
}

function computeMateStatus() {
  updateMateSummary();

  const ready = creature.alive && isAdult() && creature.energy >= 110 && mates.length === 0 && !draftOpen;
  if (mates.length === 0) return ready ? "ready (C to call)" : "none";

  const offeringCount = mates.filter(m => m.state === "offering").length;
  const bonding = mates.some(m => m.state === "bonding");

  const courting = nearestMate(mm => mm.state === "courting");
  const courtingPct = courting
    ? ` | courting ${courting.breed} ${Math.floor((courting.attract / courting.attractReq) * 100)}% sig×${safeMateSignalFactor(courting).toFixed(2)}`
    : "";

  if (bonding) return `bonding ♥ (mutation next) | ${mateSummary}`;
  if (offeringCount > 0) return `offering: C accept / X reject | ${mateSummary}`;
  return `courting/approaching | ${mateSummary}${courtingPct}`;
}


// ----- Recombination + mutation draft -----
let pendingOffspring = null;
let babyPreview = null;
const babyPreviewPos = new THREE.Vector3();

function recombineGenome(g1, g2, dist) {
  const sigma = 0.02 + 0.07 * dist;
  return {
    speed:      clamp((g1.speed + g2.speed) * 0.5 + randn() * sigma, 0.65, 1.75),
    efficiency: clamp((g1.efficiency + g2.efficiency) * 0.5 + randn() * sigma, 0.65, 1.75),
    plantDig:   clamp((g1.plantDig + g2.plantDig) * 0.5 + randn() * (sigma * 0.9), 0.60, 1.90),
    meatDig:    clamp((g1.meatDig + g2.meatDig) * 0.5 + randn() * (sigma * 0.9), 0.60, 1.90),
    social:     clamp((g1.social + g2.social) * 0.5 + randn() * (sigma * 0.9), 0.00, 1.00),
  };
}

function mixMorph(m1, m2, dist) {
  const sigma = 0.03 + 0.05 * dist;
  return {
    tailLen: clamp((m1.tailLen + m2.tailLen) * 0.5 + randn()*sigma, 0.70, 1.55),
    nose:    clamp((m1.nose + m2.nose) * 0.5 + randn()*sigma, 0.75, 1.40),
  };
}

function pickRecommendationFromTelemetry() {
  const hungerScore = life.starvingT + Math.max(0, 6 - life.foodsEaten) * 0.6;
  const speedScore  = life.sprintT + (life.distance * 0.05);
  const wasteScore  = Math.max(0, life.t - life.foodsEaten * 2.0);
  if (hungerScore >= speedScore && hungerScore >= wasteScore) return "diet";
  if (speedScore >= wasteScore) return "speed";
  return "efficiency";
}

function mutationCards() {
  const profile = dietProfile();

  let dietName = "Omnivore Flex";
  let dietMeta = "+Plant +Meat digestion (balanced)\n-Tradeoff: slightly less efficient";
  let dietTint = 0xd6a0ff;
  let dietApply = (g) => { g.plantDig *= 1.08; g.meatDig *= 1.08; g.efficiency *= 0.96; };

  if (profile === "herbivore") {
    dietName = "Herbivore Gut";
    dietMeta = "++Plant digestion\n-Tradeoff: less meat digestion";
    dietTint = 0xa0ffaa;
    dietApply = (g) => { g.plantDig *= 1.18; g.meatDig *= 0.90; };
  } else if (profile === "carnivore") {
    dietName = "Carnivore Enzymes";
    dietMeta = "++Meat digestion\n-Tradeoff: less plant digestion";
    dietTint = 0xff6677;
    dietApply = (g) => { g.meatDig *= 1.18; g.plantDig *= 0.90; };
  }

  return [
    {
      id: "speed",
      name: "Swift Strain",
      meta: "+Speed  (faster accel/max)\n-Tradeoff: slightly less efficient",
      apply: (g) => { g.speed *= 1.12; g.efficiency *= 0.96; },
      tint: 0x78c8ff,
    },
    {
      id: "diet",
      name: dietName,
      meta: dietMeta,
      apply: dietApply,
      tint: dietTint,
    },
    {
      id: "efficiency",
      name: "Frugal Cells",
      meta: "+Efficiency  (less energy burn)\n-Tradeoff: slightly less digestion",
      apply: (g) => { g.efficiency *= 1.15; g.plantDig *= 0.97; g.meatDig *= 0.97; },
      tint: 0xffe68c,
    },
  ];
}

function openDraftWithStats(mateInfo) {
  draftOpen = true;
  ui.overlay.classList.remove("hidden");

  const rec = pickRecommendationFromTelemetry();
  const cards = mutationCards();

  const hybridText = mateInfo.cross > 0.25 ? "YES (higher variance)" : "no";
  ui.overlayStats.textContent =
    `Chosen mate: ${mateInfo.label}\n` +
    `Hybrid cross: ${hybridText}\n` +
    `Diet profile: ${dietProfile().toUpperCase()}\n\n` +
    `Telemetry (parent gen):\n` +
    `  timeAlive=${life.t.toFixed(1)}s\n` +
    `  distance=${life.distance.toFixed(1)}\n` +
    `  sprintTime=${life.sprintT.toFixed(1)}s\n` +
    `  starvingTime=${life.starvingT.toFixed(1)}s\n` +
    `  plantsEaten=${life.plantsEaten}  meatEaten=${life.preyEaten}\n` +
    `  energyPlants=${life.energyFromPlants.toFixed(1)}  energyMeat=${life.energyFromMeat.toFixed(1)}\n\n` +
    `Recommended: ${rec.toUpperCase()} (based on what actually limited you)`;

  ui.cards.innerHTML = "";
  cards.forEach((c, idx) => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.type = "button";
    btn.innerHTML =
      `<div class="name">${idx+1}. ${c.name}</div>` +
      `<div class="meta">${c.meta.replaceAll("\n","<br>")}</div>` +
      (c.id === rec ? `<div class="tag">RECOMMENDED</div>` : `<div class="tag">OPTION</div>`);
    btn.addEventListener("click", () => chooseMutation(idx));
    ui.cards.appendChild(btn);
  });
}

function closeDraft() {
  draftOpen = false;
  ui.overlay.classList.add("hidden");
}

function abortMating() {
  if (babyPreview) { scene.remove(babyPreview); babyPreview = null; }
  pendingOffspring = null;
  closeDraft();

  for (const m of mates) if (!m.dead) setShame(m);
  selectedMate = null;

  mateStatus = "aborted";
  flash = Math.max(flash, 0.6);
}

window.addEventListener("keydown", (e) => {
  if (!draftOpen) return;
  if (e.key === "1") chooseMutation(0);
  if (e.key === "2") chooseMutation(1);
  if (e.key === "3") chooseMutation(2);
  if (e.key === "Escape") abortMating();
});

function beginMatingWith(m) {
  if (draftOpen) return;

  const dist = speciesDistance(lineage.species, m.species);
  const childSpecies = offspringSpecies(lineage.species, m.species);
  const childColor = mixHex(lineage.bodyColor, m.color, 0.55);
  const childMorph = mixMorph(lineage.morph, m.morph, dist);
  const childGenome = recombineGenome(genome, m.genome, dist);

  pendingOffspring = {
    genome: childGenome,
    lineage: { species: childSpecies, breed: `${lineage.breed}×${m.breed}`, bodyColor: childColor, morph: childMorph },
    mateInfo: { label: mateLabel(m), cross: dist },
  };

  babyPreviewPos.set(creature.pos.x + 0.9, 0.35, creature.pos.z + 0.8);
  const babyGeom = new THREE.SphereGeometry(0.33, 22, 14);
  const babyMat = new THREE.MeshStandardMaterial({ color: childColor, roughness: 0.45, metalness: 0.0 });
  babyPreview = new THREE.Mesh(babyGeom, babyMat);
  babyPreview.position.copy(babyPreviewPos);
  scene.add(babyPreview);

  scene.remove(m.mesh);
  m.dead = true;

  openDraftWithStats(pendingOffspring.mateInfo);
}

function chooseMutation(idx) {
  const cards = mutationCards();
  const c = cards[idx];
  if (!c || !pendingOffspring) return;

  const g = { ...pendingOffspring.genome };
  c.apply(g);

  g.speed = clamp(g.speed, 0.60, 1.90);
  g.efficiency = clamp(g.efficiency, 0.60, 1.90);
  g.plantDig = clamp(g.plantDig, 0.60, 1.90);
  g.meatDig = clamp(g.meatDig, 0.60, 1.90);
  g.social = clamp(g.social, 0.00, 1.00);

  genome = g;
  lineage = pendingOffspring.lineage;

  lastMutationName = c.name;
  lastMutationTint = c.tint;

  generation += 1;
  maturity = 0.0;
  creature.pos.set(babyPreviewPos.x, 0.55, babyPreviewPos.z);
  creature.vx = 0; creature.vz = 0;
  creature.energy = 55;
  creature.alive = true;

  if (babyPreview) { scene.remove(babyPreview); babyPreview = null; }
  pendingOffspring = null;
  closeDraft();

  life = newLifeStats();

  for (const m of mates) if (!m.dead) setShame(m);
  selectedMate = null;

  flash = Math.max(flash, 1.0);
  applyPhenotype();
  updateHud();
}

// ----- Reset -----
function resetWorld() {
  creature.pos.set(0, 0.55, 0);
  creature.vx = 0; creature.vz = 0;
  creature.energy = 60;
  creature.alive = true;

  genome = { speed: 1.0, efficiency: 1.0, plantDig: 1.0, meatDig: 1.0, social: 0.55 };
  generation = 1;
  maturity = 1.0;
  lastMutationName = "(none)";
  lastMutationTint = 0xc8dcff;

  lineage = { species: "A", breed: "Neutral", bodyColor: 0xffffff, morph: { tailLen: 1.0, nose: 1.0 } };

  for (const p of plants) scene.remove(p.mesh);
  plants.length = 0;

  for (const f of prey) scene.remove(f.mesh);
  prey.length = 0;

  for (const r of rings) scene.remove(r.mesh);
  rings.length = 0;

  for (const h of hearts) scene.remove(h.sprite);
  hearts.length = 0;

  for (const m of mates) if (!m.dead) scene.remove(m.mesh);
  mates.length = 0;

  if (babyPreview) { scene.remove(babyPreview); babyPreview = null; }
  pendingOffspring = null;
  selectedMate = null;

  mateStatus = "none";
  closeDraft();
  flash = 0;

  life = newLifeStats();
  plantTimer = 0;
  preyTimer = 0;

  spawnHerd();

  // Seed initial world (balanced)
  const eco = ecoParams();
  for (let i = 0; i < 10; i++) {
    const g = pickPlantGrade(eco);
    const minR = eco.plantMinR + g.spawnBias * 2.0;
    const maxR = eco.plantMaxR + g.spawnBias * 4.0;
    spawnAroundPlayer(minR, maxR, (x,z)=>spawnPlantAt(x,z,g));
  }
  for (let i = 0; i < 4; i++) {
    const g = pickPreyGrade(eco);
    const extra = (g.id === "dart" ? 2.0 : g.id === "runner" ? 1.0 : 0.0);
    spawnAroundPlayer(eco.preyMinR + extra, eco.preyMaxR + extra*2.0, (x,z)=>spawnPreyAt(x,z,g,eco));
  }

  updateHud();
}

window.addEventListener("keydown", (e) => {
  if ((e.key || "").toLowerCase() === "r") resetWorld();
});

// ----- Derived movement params -----
function derivedParams() {
  const g = stageScale(maturity);
  const accel = 16.0 * genome.speed * g;
  const maxSpeed = 6.0 * genome.speed * g;

  const burnMul = (1.0 / genome.efficiency) * socialBurnMulFactor;
  return { accel, maxSpeed, burnMul };
}

// ----- HUD -----
function updateHud() {
  ui.genTag.textContent = String(generation);
  ui.stageTag.textContent = `${stageName(maturity)} (${Math.round(maturity * 100)}%)`;
  ui.lineTag.textContent = `${lineage.species} | ${lineage.breed}`;

  herdNearest = measureHerdNearest(creature.pos);
  ({ comfort: socialComfort, factor: socialBurnMulFactor } = computeSocialFactors(herdNearest));

  const comfortTxt = `${socialComfort >= 0 ? "+" : ""}${socialComfort.toFixed(2)}`;
  ui.socTag.textContent = `${genome.social.toFixed(2)} comfort=${comfortTxt} burn×${socialBurnMulFactor.toFixed(2)}`;

  const nearTxt = herdNearest > 98 ? "∞" : herdNearest.toFixed(1);
  ui.herdTag.textContent = `n=${herd.length} nearest=${nearTxt}`;

  const eco = ecoParams();
  ui.dietTag.textContent = `${dietProfile()}  bias=${eco.bias.toFixed(2)}`;
  ui.ecoTag.textContent = `pflInt=${eco.plantInterval.toFixed(2)}s pflR=${eco.plantMinR.toFixed(1)}–${eco.plantMaxR.toFixed(1)} | pryInt=${eco.preyInterval.toFixed(2)}s pryR=${eco.preyMinR.toFixed(1)}–${eco.preyMaxR.toFixed(1)}`;

  
  if (ui.signalTag) ui.signalTag.textContent = signalText(worldT);
ui.traitsTag.textContent = traitsString();
  ui.lastTag.textContent = lastMutationName;
  mateStatus = computeMateStatus();
  ui.mateTag.textContent = mateStatus;
}

// ----- Key handlers for mate actions -----
window.addEventListener("keydown", (e) => {
  if (draftOpen) return;
  if (e.repeat) return;

  const k = (e.key || "").toLowerCase();
  if (k !== "c" && k !== "x") return;

  const reproReady = creature.alive && isAdult() && creature.energy >= 110 && mates.filter(m=>!m.dead).length === 0;

  if (k === "c") {
    const offering = nearestMate(mm => mm.state === "offering");
    if (offering) { acceptNearestOffering(); return; }
    if (reproReady) { spawnMateCandidates(); return; }
  }

  if (k === "x") rejectNearest();
});

// ----- Main loop -----
let frameLast = performance.now();
let fps = 0;
let flash = 0;

function update(dt) {
  worldT += dt;

  const eco = ecoParams();

  if (!draftOpen && AUTO_SPAWN) {
    plantTimer += dt;
    if (plantTimer >= eco.plantInterval) {
      plantTimer = 0;
      if (plants.length < PLANT_CAP) {
        const g = pickPlantGrade(eco);
        const minR = eco.plantMinR + g.spawnBias * 2.0;
        const maxR = eco.plantMaxR + g.spawnBias * 4.0;
        spawnAroundPlayer(minR, maxR, (x,z)=>spawnPlantAt(x,z,g));
      }
    }

    preyTimer += dt;
    if (preyTimer >= eco.preyInterval) {
      preyTimer = 0;
      if (prey.length < PREY_CAP) {
        const g = pickPreyGrade(eco);
        const extra = (g.id === "dart" ? 2.0 : g.id === "runner" ? 1.0 : 0.0);
        spawnAroundPlayer(eco.preyMinR + extra, eco.preyMaxR + extra*2.0, (x,z)=>spawnPreyAt(x,z,g,eco));
      }
    }
  }

  const { accel, maxSpeed, burnMul } = derivedParams();

  const up = keys.has("w") || keys.has("arrowup");
  const dn = keys.has("s") || keys.has("arrowdown");
  const lf = keys.has("a") || keys.has("arrowleft");
  const rt = keys.has("d") || keys.has("arrowright");

  const ax = (rt ? 1 : 0) - (lf ? 1 : 0);
  const az = (dn ? 1 : 0) - (up ? 1 : 0);

  const locked = draftOpen || (selectedMate && selectedMate.state === "bonding");
  const sprint = keys.has("shift") && creature.alive && !locked;

  const sprintMul = sprint ? 1.65 : 1.0;
  const drag = sprint ? 4.0 : 6.0;

  const prevX = creature.pos.x;
  const prevZ = creature.pos.z;

  if (creature.alive && !locked) {
    creature.vx += ax * accel * dt;
    creature.vz += az * accel * dt;

    creature.vx -= creature.vx * drag * dt;
    creature.vz -= creature.vz * drag * dt;

    const sp = hypot2(creature.vx, creature.vz);
    const maxSp = maxSpeed * sprintMul;
    if (sp > maxSp) {
      creature.vx = (creature.vx / sp) * maxSp;
      creature.vz = (creature.vz / sp) * maxSp;
    }

    creature.pos.x += creature.vx * dt;
    creature.pos.z += creature.vz * dt;

    const sp2 = hypot2(creature.vx, creature.vz);
    const moveBurn = (0.22 + (sprint ? 0.30 : 0.0)) * sp2 * dt * burnMul;
    const baseBurn = 0.35 * dt * burnMul;
    creature.energy -= (moveBurn + baseBurn);

    life.t += dt;
    if (sprint) life.sprintT += dt;

    const dx = creature.pos.x - prevX;
    const dz = creature.pos.z - prevZ;
    life.distance += Math.sqrt(dx*dx + dz*dz);

    if (creature.energy < 25) life.starvingT += dt;

    creature.energy = clamp(creature.energy, 0, 120);
    if (creature.energy <= 0.01) {
      creature.alive = false;
      body.material.color.set(0xa0a0a0);
    }

    const sp3 = hypot2(creature.vx, creature.vz);
    if (sp3 > 0.05) organism.rotation.y = Math.atan2(-creature.vz, creature.vx);
  }

  updatePrey(dt);
  updateHerd(dt);

  for (const m of mates) updateMate(m, dt);
  for (let i = mates.length - 1; i >= 0; i--) if (mates[i].dead) mates.splice(i, 1);

  const ready = creature.alive && isAdult() && creature.energy >= 110 && mates.length === 0 && !draftOpen;
  if (mates.length === 0) mateStatus = ready ? "ready (C to call)" : "none";
  else {
    const offeringCount = mates.filter(m => m.state === "offering").length;
    const bonding = mates.some(m => m.state === "bonding");
    if (bonding) mateStatus = `bonding ♥ (mutation next)`;
    else if (offeringCount > 0) mateStatus = `offering: C accept / X reject`;
    else mateStatus = `approaching (${mates.length})`;
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    const p = r.t / 0.6;
    const s = 1.0 + p * 6.0;
    r.mesh.scale.set(s, s, s);
    r.mesh.material.opacity = (1 - p) * (r.eat ? 0.95 : 0.85);
    if (r.t > 0.6) {
      scene.remove(r.mesh);
      rings.splice(i, 1);
    }
  }

  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.t += dt;
    h.sprite.position.y += h.vy * dt;
    h.sprite.position.x += h.vx * dt;
    h.sprite.position.z += h.vz * dt;
    h.sprite.material.opacity = Math.max(0, 1 - (h.t / h.life));
    h.sprite.material.rotation += h.rot * dt;
    if (h.t >= h.life) {
      scene.remove(h.sprite);
      h.sprite.material.dispose();
      hearts.splice(i, 1);
    }
  }

  updateEatTarget(dt);

  flash = Math.max(0, flash - dt * 2.2);

  organism.scale.setScalar(stageScale(maturity));

  camera.position.copy(creature.pos).add(camOffset);
  camera.lookAt(creature.pos.x, 0.35, creature.pos.z);

  applyPhenotype();
  updateHud();

  const state =
    !creature.alive ? "DEAD (R to reset)" :
    draftOpen ? "MUTATION DRAFT (1/2/3)" :
    (mates.length > 0 ? "mate choice active" : "roam / eat / herd / hunt");

  ui.status.textContent =
    `STATUS: ${PROJECT} ${BUILD} | v=${vParam} | fps=${fps.toFixed(0)} | gen=${generation} | ` +
    `stage=${stageName(maturity)} | energy=${creature.energy.toFixed(1)} | ` +
    `flora=${plants.length}/${PLANT_CAP} fauna=${prey.length}/${PREY_CAP} | ` +
    `eat=${eatHint} | diet=${dietProfile()} | mate=${mateStatus} | ${state}`;
}

function draw() {
  const base = 0x07090d;
  const boost = Math.floor(0x20 * flash);
  const r = ((base >> 16) & 255) + boost;
  const g = ((base >> 8) & 255) + boost;
  const b = (base & 255) + boost;
  renderer.setClearColor(0x06070b, 1);

  organism.position.copy(creature.pos);
  renderer.render(scene, camera);
}

function step(now) {
  const dt = Math.min(0.05, (now - frameLast) / 1000);
  frameLast = now;

  const inst = 1 / Math.max(1e-6, dt);
  fps = fps * 0.9 + inst * 0.1;

  update(dt);
  draw();
  requestAnimationFrame(step);
}

resetWorld();
requestAnimationFrame(step);


// ----- Lineage slots (BUILD0036_DARK1) -----
// Polishes truthfulness: lineage overlay reads gen/stage/diet from the SAME HUD tags the player sees.
// Uses events dispatched by index.html (lineageKeys):
//   emerge_lineage_toggle
//   emerge_lineage_close
//   emerge_lineage_save {slot}
//   emerge_lineage_load {slot}

(() => {
  if (window.__emerge_lineage_installed) return;
  window.__emerge_lineage_installed = true;

  const LIN_N = 3;
  const PREFIX = "emerge_slot_";

  let open = false;
  let msg = "";
  let active = null;

  const el = document.getElementById("lineage");
  const nowEl = document.getElementById("lineageNow");
  const slotsEl = document.getElementById("lineageSlots");

  if (!el || !nowEl || !slotsEl) {
    console.warn("Lineage UI missing in index.html");
    return;
  }

  const fmt2 = (x) => (typeof x === "number" && isFinite(x)) ? x.toFixed(2) : "—";
  const nowStr = (ms) => { try { return new Date(ms).toLocaleString(); } catch(e) { return String(ms); } };

  const hudText = (id) => {
    const n = document.getElementById(id);
    if (!n) return null;
    const t = (n.textContent || "").trim();
    return t ? t : null;
  };

  function hudState(){
    // These IDs exist in your HUD build box. This is the most honest source.
    return {
      genText:   hudText("genTag"),
      stageText: hudText("stageTag"),
      dietText:  hudText("dietTag"),
      lineText:  hudText("lineTag"),
    };
  }

  function safeGenome(){ try { return (typeof genome !== "undefined" && genome) ? genome : null; } catch(e) { return null; } }
  function safeMorph(){  try { return (typeof morph  !== "undefined" && morph)  ? morph  : null; } catch(e) { return null; } }
  function safeEnergy(){ try { return (typeof creature !== "undefined" && creature && typeof creature.energy === "number") ? creature.energy : null; } catch(e){ return null; } }

  function parseIntOrNull(s){
    if (!s) return null;
    const m = String(s).match(/^\s*(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : null;
  }

  function trySetGen(n){
    try { if (typeof gen !== "undefined") gen = n; } catch(e) {}
    try { if (typeof creature !== "undefined" && creature) creature.gen = n; } catch(e) {}
    try { if (typeof world !== "undefined" && world) world.gen = n; } catch(e) {}
    try { if (typeof lineage !== "undefined" && lineage) lineage.gen = n; } catch(e) {}
  }

  function snapshot(){
    const h = hudState();
    const g = safeGenome() || {};
    const m = safeMorph() || {};

    const genNum = parseIntOrNull(h.genText);

    return {
      t: Date.now(),
      genText: h.genText,
      genNum,
      stageText: h.stageText,
      dietText: h.dietText,
      lineText: h.lineText,
      energy: safeEnergy(),
      genome: {
        speed: g.speed, efficiency: g.efficiency,
        plantDig: g.plantDig, meatDig: g.meatDig,
        social: g.social
      },
      morph: {
        tailLen: m.tailLen,
        nose: m.nose
      }
    };
  }

  function key(i){ return PREFIX + i; }

  function read(i){
    try {
      const raw = localStorage.getItem(key(i));
      return raw ? JSON.parse(raw) : null;
    } catch(e) {
      return null;
    }
  }

  function write(i, s){
    localStorage.setItem(key(i), JSON.stringify(s));
  }

  function apply(s){
    if (!s) return;
    try { if (typeof resetWorld === "function") resetWorld(); } catch(e) {}

    try {
      const g = safeGenome();
      if (g && s.genome) Object.assign(g, s.genome);

      const m = safeMorph();
      if (m && s.morph) Object.assign(m, s.morph);

      if (typeof s.energy === "number" && typeof creature !== "undefined" && creature) {
        creature.energy = s.energy;
      }

      if (typeof s.genNum === "number") {
        trySetGen(s.genNum);
      }
    } catch(e) {
      console.warn("lineage apply error:", e);
    }
  }

  function setOpen(v){
    open = !!v;
    el.classList.toggle("hidden", !open);
    render();
  }

  function render(){
    const h = hudState();
    const s = snapshot();
    const g = s.genome || {};

    const genT = h.genText || s.genText || "?";
    const stgT = h.stageText || s.stageText || "?";
    const dietT = h.dietText || s.dietText || "?";

    nowEl.textContent =
      `CURRENT | gen=${genT} | stage=${stgT} | diet=${dietT} | energy=${fmt2(s.energy)} | ` +
      `spd=${fmt2(g.speed)} eff=${fmt2(g.efficiency)} pfl=${fmt2(g.plantDig)} mea=${fmt2(g.meatDig)} soc=${fmt2(g.social)}` +
      (msg ? `\n${msg}` : "");

    let html = "";
    for (let i = 1; i <= LIN_N; i++){
      const sl = read(i);
      if (!sl || !sl.genome){
        html += `
          <button class="card" data-slot="${i}">
            <div><b>SLOT ${i}</b> — empty</div>
            <div style="opacity:.75;margin-top:6px;">Shift+${i} save • ${i} load</div>
          </button>
        `;
        continue;
      }
      const gg = sl.genome || {};
      const head = `SLOT ${i}` + (active === i ? " (active)" : "");
      const gtxt = sl.genText || (typeof sl.genNum === "number" ? String(sl.genNum) : "?");
      const line1 = `Gen ${gtxt} • ${sl.stageText || "stage ?"} • diet ${sl.dietText || "?"} • saved ${nowStr(sl.t)}`;
      const line2 = `spd ${fmt2(gg.speed)} • eff ${fmt2(gg.efficiency)} • pfl ${fmt2(gg.plantDig)} • mea ${fmt2(gg.meatDig)} • soc ${fmt2(gg.social)}`;
      html += `
        <button class="card" data-slot="${i}">
          <div><b>${head}</b></div>
          <div style="opacity:.85;margin-top:6px;">${line1}</div>
          <div style="opacity:.85;margin-top:6px;">${line2}</div>
          <div style="opacity:.65;margin-top:8px;">Click load • Shift-click save</div>
        </button>
      `;
    }
    slotsEl.innerHTML = html;
  }

  function toggle(){
    // Avoid interfering with mutation draft if it exists
    try { if (typeof draftOpen !== "undefined" && draftOpen) return; } catch(e) {}
    msg = "";
    setOpen(!open);
    try { if (typeof flash !== "undefined") flash = Math.max(flash, 0.65); } catch(e) {}
  }

  function save(i){
    try {
      const s = snapshot();
      write(i, s);
      active = i;
      msg = `Saved slot ${i}`;
    } catch(e) {
      msg = "Save failed (localStorage blocked?)";
    }
    render();
  }

  function load(i){
    const s = read(i);
    if (!s){
      msg = `Slot ${i} empty`;
      render();
      return;
    }
    active = i;
    apply(s);
    msg = `Loaded slot ${i}`;
    render();
  }

  // Click support
  slotsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-slot]");
    if (!btn) return;
    const i = parseInt(btn.getAttribute("data-slot"), 10);
    if (!isFinite(i) || i < 1 || i > LIN_N) return;
    if (e.shiftKey) save(i);
    else load(i);
  });

  // Custom events from early key dispatcher
  window.addEventListener("emerge_lineage_toggle", () => toggle());
  window.addEventListener("emerge_lineage_close",  () => setOpen(false));
  window.addEventListener("emerge_lineage_save",   (ev) => { const i = ev.detail && ev.detail.slot; if (i) save(i); });
  window.addEventListener("emerge_lineage_load",   (ev) => { const i = ev.detail && ev.detail.slot; if (i) load(i); });

  setOpen(false);
})();


// ----- Epochs (BUILD0023) -----
// Adds PRESSURE (0..1). Keys: [ decrease pressure, ] increase pressure.
// Pressure expands Meadow radius, reduces flora, increases grazers.
(() => {
  if (window.__emerge_epochs_installed) return;
  window.__emerge_epochs_installed = true;

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  if (typeof window.__emerge_pressure !== "number") window.__emerge_pressure = 0.0;

  const EPOCHS = [
    { name:"Nursery", radius:16, plantsN:26, preyN:8,  fruitChance:0.18, preyW:[0.78,0.22,0.00], grazerN:1 },
    { name:"Meadow",  radius:26, plantsN:16, preyN:14, fruitChance:0.10, preyW:[0.55,0.35,0.10],
      patchN:3, patchR:5.0, preyNearPatch:0.72, grazerN:4 }
  ];

  let epoch = 0;
  const epochEl = document.getElementById("epochTag");
  const statusEl = document.getElementById("status");

  function setPressureLabel(){
    if (!statusEl) return;
    const p = clamp01(window.__emerge_pressure || 0);
    statusEl.setAttribute("data-press", p.toFixed(2));
  }

  function setEpochLabel(e){
    if (!epochEl) return;
    const extra = e.patchN ? `, p=${e.patchN}` : "";
    epochEl.textContent = `${e.name} (r=${e.radius}${extra})`;
    if (statusEl) statusEl.setAttribute("data-epoch", e.name);
  }

  function randDisc(r){
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d };
  }

  function randAround(cx, cz, r){
    const o = randDisc(r);
    return { x: cx + o.x, z: cz + o.z };
  }

  function clearList(arr){
    if (!arr || !Array.isArray(arr)) return;
    for (const o of arr) {
      const node =
        (o && o.mesh && o.mesh.isObject3D) ? o.mesh :
        (o && o.group && o.group.isObject3D) ? o.group :
        (o && o.obj && o.obj.isObject3D) ? o.obj :
        (o && o.isObject3D) ? o :
        null;
      if (node) {
        try { if (node.parent) node.parent.remove(node); else if (typeof scene !== "undefined") scene.remove(node); } catch(e) {}
      }
    }
    arr.length = 0;
  }

  function pickWeightedIndex(w){
    const s = w[0] + w[1] + w[2];
    const r = Math.random() * s;
    if (r < w[0]) return 0;
    if (r < w[0] + w[1]) return 1;
    return 2;
  }

  function plantGrade(e){
    if (typeof PLANT_GRADES === "undefined" || !PLANT_GRADES || !PLANT_GRADES.length) return null;
    const fruitIx = Math.min(2, PLANT_GRADES.length - 1);
    return (Math.random() < e.fruitChance) ? PLANT_GRADES[fruitIx] : PLANT_GRADES[0];
  }

  function preyGrade(e){
    if (typeof PREY_GRADES === "undefined" || !PREY_GRADES || !PREY_GRADES.length) return null;
    const ix = Math.min(pickWeightedIndex(e.preyW), PREY_GRADES.length - 1);
    return PREY_GRADES[ix];
  }

  function applyPressure(base){
    const p = clamp01(window.__emerge_pressure || 0);
    const e = { ...base, pressure:p };

    if (e.name === "Meadow") {
      e.radius  = Math.round(base.radius * (1 + 0.35 * p));
      e.plantsN = Math.max(8,  Math.round(base.plantsN * (1 - 0.55 * p)));
      e.preyN   = Math.max(8,  Math.round(base.preyN   * (1 - 0.10 * p)));
      e.grazerN = Math.max(0,  Math.round(base.grazerN + (3 * p)));
      e.patchR  = base.patchR * (1 - 0.10 * p);
    } else {
      e.grazerN = Math.max(0,  Math.round(base.grazerN + (1 * p)));
    }
    return e;
  }

  function reseed(){
    try { if (typeof plants !== "undefined") clearList(plants); } catch(e) {}
    try { if (typeof prey   !== "undefined") clearList(prey); } catch(e) {}

    const base = EPOCHS[epoch];
    const e = applyPressure(base);
    window.__emerge_epochCfg = e;

    const canPlant = (typeof spawnPlantAt === "function");
    const canPrey  = (typeof spawnPreyAt === "function");

    const centers = [];
    if (e.patchN){
      for (let i = 0; i < e.patchN; i++){
        const c = randDisc(e.radius * 0.75);
        centers.push(c);
      }
    }
    window.__emerge_patchCenters = centers;

    if (canPlant && canPrey){
      for (let i = 0; i < e.plantsN; i++){
        let p = randDisc(e.radius);
        if (centers.length){
          const c = centers[Math.floor(Math.random() * centers.length)];
          p = randAround(c.x, c.z, e.patchR);
        }
        const g = plantGrade(e);
        if (g) spawnPlantAt(p.x, p.z, g);
      }

      for (let i = 0; i < e.preyN; i++){
        let p = randDisc(e.radius);
        if (centers.length && Math.random() < (e.preyNearPatch ?? 0.7)){
          const c = centers[Math.floor(Math.random() * centers.length)];
          p = randAround(c.x, c.z, e.patchR * 1.7);
        }
        const g = preyGrade(e);
        if (g) spawnPreyAt(p.x, p.z, g);
      }

      try {
        if (typeof window.__emerge_spawnGrazers === "function") {
          window.__emerge_spawnGrazers(e, centers);
        }
      } catch(_) {}
    }

    window.__emerge_epoch = epoch;
    window.__emerge_epochName = e.name;

    setEpochLabel(e);
    setPressureLabel();
    try { if (typeof flash !== "undefined") flash = Math.max(flash, 1.0); } catch(e) {}
  }

  function nextEpoch(){
    epoch = (epoch + 1) % EPOCHS.length;
    reseed();
  }

  function overlaysOpen(){
    const lin = document.getElementById("lineage");
    if (lin && !lin.classList.contains("hidden")) return true;
    try { if (typeof draftOpen !== "undefined" && draftOpen) return true; } catch(_) {}
    return false;
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (overlaysOpen()) return;

    if (e.code === "KeyM") {
      nextEpoch();
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }

    if (e.code === "BracketLeft" || e.code === "BracketRight") {
      const delta = (e.code === "BracketRight") ? 0.10 : -0.10;
      window.__emerge_pressure = clamp01((window.__emerge_pressure || 0) + delta);
      reseed();
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }
  }, true);

  setPressureLabel();
  setTimeout(() => reseed(), 60);
})();

// ----- Grazers (BUILD0022) -----
// Competitor herbivores that seek and consume flora (green spheres).
// NEW: flee from the player when close + can be eaten with Space if caught.
(() => {
  if (window.__emerge_grazers_installed) return;
  window.__emerge_grazers_installed = true;

  const statusEl = document.getElementById("status");
  if (statusEl && !statusEl.getAttribute("data-grazers")) statusEl.setAttribute("data-grazers", "0");

  const grazers = [];
  window.grazers = grazers;

  const FLEE_R   = 2.4;   // start fleeing when player is this close
  const FLEE_SPD = 1.85;  // flee speed (should be catchable with sprint)
  const EAT_R    = 0.95;  // distance needed to eat grazer with Space
  const GRAZE_SPD= 1.18;  // normal seek speed

  function getNode(o){
    return (o && o.mesh && o.mesh.isObject3D) ? o.mesh :
           (o && o.group && o.group.isObject3D) ? o.group :
           (o && o.obj && o.obj.isObject3D) ? o.obj :
           (o && o.isObject3D) ? o :
           null;
  }

  function removeNode(o){
    const node = getNode(o);
    if (!node) return;
    try { if (node.parent) node.parent.remove(node); else if (typeof scene !== "undefined") scene.remove(node); } catch(e) {}
  }

  function clearGrazers(){
    for (const g of grazers){
      if (g && g.mesh) {
        try { if (g.mesh.parent) g.mesh.parent.remove(g.mesh); else if (typeof scene !== "undefined") scene.remove(g.mesh); } catch(e) {}
      }
    }
    grazers.length = 0;
    if (statusEl) statusEl.setAttribute("data-grazers", "0");
  }

  function updateStatus(){
    if (!statusEl) return;
    statusEl.setAttribute("data-grazers", String(grazers.length));
  }

  function randDisc(r){
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d };
  }

  function randAround(cx, cz, r){
    const o = randDisc(r);
    return { x: cx + o.x, z: cz + o.z };
  }

  function spawnGrazerAt(x, z){
    try {
      if (typeof THREE === "undefined" || typeof scene === "undefined") return;

      const geo = new THREE.SphereGeometry(0.34, 18, 14);
      const mat = new THREE.MeshStandardMaterial({ color: 0xF2E36E, roughness: 0.55, metalness: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.34, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      grazers.push({
        mesh,
        target: -1,
        cooldown: 0,
        wanderT: 0,
        wanderA: Math.random() * Math.PI * 2
      });
    } catch(e) {}
  }

  function findNearestPlant(x, z){
    try {
      if (typeof plants === "undefined" || !plants || plants.length === 0) return -1;
      let best = -1;
      let bestD = 1e18;
      for (let i = 0; i < plants.length; i++){
        const n = getNode(plants[i]);
        if (!n) continue;
        const dx = n.position.x - x;
        const dz = n.position.z - z;
        const d2 = dx*dx + dz*dz;
        if (d2 < bestD){
          bestD = d2;
          best = i;
        }
      }
      return best;
    } catch(e) {
      return -1;
    }
  }

  function consumePlant(ix){
    try {
      if (typeof plants === "undefined" || !plants) return;
      if (ix < 0 || ix >= plants.length) return;

      const p = plants[ix];
      removeNode(p);
      plants.splice(ix, 1);
    } catch(e) {}
  }

  // --- Player position detection (robust): controls.target OR find the "rod" rig in the scene ---
  let playerNode = null;
  let lastScanMs = 0;

  function dims(geo){
    if (!geo) return null;
    try { if (!geo.boundingBox && geo.computeBoundingBox) geo.computeBoundingBox(); } catch(_) {}
    const bb = geo.boundingBox;
    if (!bb) return null;
    return { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z };
  }

  function isRodMesh(m){
    if (!m || !m.isMesh || !m.geometry) return false;
    const d = dims(m.geometry);
    if (!d) return false;
    const a = Math.abs(d.x), b = Math.abs(d.y), c = Math.abs(d.z);
    const mx = Math.max(a,b,c), mn = Math.min(a,b,c);
    return mx > 0.45 && mn > 0.02 && (mx / (mn || 1)) > 4.0;
  }

  function isSphereish(m){
    if (!m || !m.isMesh || !m.geometry) return false;
    const d = dims(m.geometry);
    if (!d) return false;
    const a = Math.abs(d.x), b = Math.abs(d.y), c = Math.abs(d.z);
    const mx = Math.max(a,b,c), mn = Math.min(a,b,c);
    return mx > 0.30 && (mx / (mn || 1)) < 1.35;
  }

  function findPlayerNodeByRod(){
    if (typeof scene === "undefined" || !scene) return null;

    let rod = null;
    scene.traverse((o) => { if (!rod && isRodMesh(o)) rod = o; });
    if (!rod) return null;

    let top = rod;
    while (top.parent && top.parent !== scene) top = top.parent;

    let sphereFound = false;
    top.traverse((o) => { if (!sphereFound && isSphereish(o)) sphereFound = true; });
    if (!sphereFound) return null;

    window.__emerge_playerNode = top;
    return top;
  }

  function getPlayerXZ(){
    // 1) controls.target is often the follow point
    try {
      if (typeof controls !== "undefined" && controls && controls.target) {
        return { x: controls.target.x, z: controls.target.z };
      }
    } catch(_) {}
    try {
      if (window.controls && window.controls.target) {
        return { x: window.controls.target.x, z: window.controls.target.z };
      }
    } catch(_) {}

    // 2) cached node
    if (playerNode && playerNode.isObject3D) return { x: playerNode.position.x, z: playerNode.position.z };

    // 3) scan occasionally
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    if (now - lastScanMs < 800) return null;
    lastScanMs = now;

    playerNode = (window.__emerge_playerNode && window.__emerge_playerNode.isObject3D) ? window.__emerge_playerNode : findPlayerNodeByRod();
    if (playerNode && playerNode.isObject3D) return { x: playerNode.position.x, z: playerNode.position.z };
    return null;
  }

  // Called by epoch reseed
  window.__emerge_spawnGrazers = (epochCfg, centers) => {
    clearGrazers();

    const n = (epochCfg && typeof epochCfg.grazerN === "number") ? epochCfg.grazerN : 0;
    const r = (epochCfg && typeof epochCfg.radius === "number") ? epochCfg.radius : 18;
    const patchR = (epochCfg && typeof epochCfg.patchR === "number") ? epochCfg.patchR : 4.5;

    for (let i = 0; i < n; i++){
      let p = randDisc(r * 0.80);
      if (centers && centers.length){
        const c = centers[Math.floor(Math.random() * centers.length)];
        p = randAround(c.x, c.z, patchR * 1.5);
      }
      spawnGrazerAt(p.x, p.z);
    }

    updateStatus();
  };

  // Eat grazers with Space (only if close; otherwise let normal eat logic run)
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code !== "Space") return;

    // Don't eat while overlays are open
    const lin = document.getElementById("lineage");
    if (lin && !lin.classList.contains("hidden")) return;
    try { if (typeof draftOpen !== "undefined" && draftOpen) return; } catch(_) {}

    const p = getPlayerXZ();
    if (!p) return;

    let best = -1;
    let bestD = 1e18;
    for (let i = 0; i < grazers.length; i++){
      const g = grazers[i];
      if (!g || !g.mesh) continue;
      const dx = g.mesh.position.x - p.x;
      const dz = g.mesh.position.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD){
        bestD = d;
        best = i;
      }
    }

    if (best >= 0 && bestD <= EAT_R){
      const g = grazers[best];
      let ex=0, ez=0;
      try { ex = g.mesh.position.x; ez = g.mesh.position.z; } catch(_) {}
      try { if (g && g.mesh && g.mesh.parent) g.mesh.parent.remove(g.mesh); } catch(_) {}
      grazers.splice(best, 1);
      updateStatus();

      try { if (window.__emerge_eatFX) window.__emerge_eatFX(ex, ez, "grazer"); } catch(_) {}
      try { if (window.__emerge_setEatStatus) window.__emerge_setEatStatus("OK:grazer"); } catch(_) {}

      // Visible truth probe: flash/pulse
      try { if (typeof flash !== "undefined") flash = Math.max(flash, 0.9); } catch(_) {}

      // Energy bump (best-effort; if energy isn't in scope, it simply won't change)
      try { if (typeof energy === "number") energy = energy + 18; } catch(_) {}

      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // Fixed timestep update
  let last = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

  function clampToEpoch(g){
    try {
      const cfg = window.__emerge_epochCfg;
      const R = (cfg && typeof cfg.radius === "number") ? cfg.radius : 26;
      const x = g.mesh.position.x;
      const z = g.mesh.position.z;
      const d = Math.hypot(x, z);
      if (d > R * 0.98){
        const s = (R * 0.98) / (d || 1);
        g.mesh.position.x = x * s;
        g.mesh.position.z = z * s;
      }
    } catch(_) {}
  }

  function step(){
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.max(0.010, Math.min(0.050, dt));

    if (!grazers.length) { updateStatus(); return; }
    updateStatus();

    // Compute player once per tick
    const p = getPlayerXZ();

    for (const g of grazers){
      if (!g || !g.mesh) continue;

      g.cooldown = Math.max(0, g.cooldown - dt);

      // Flee from player if close
      if (p){
        const dxp = g.mesh.position.x - p.x;
        const dzp = g.mesh.position.z - p.z;
        const dp = Math.hypot(dxp, dzp);
        if (dp < FLEE_R){
          const ux = dxp / (dp || 1);
          const uz = dzp / (dp || 1);
          g.mesh.position.x += ux * FLEE_SPD * dt;
          g.mesh.position.z += uz * FLEE_SPD * dt;
          g.target = -1;
          clampToEpoch(g);
          continue;
        }
      }

      // Acquire target plant if missing/stale
      if (g.target < 0 || (typeof plants === "undefined") || !plants || g.target >= plants.length || !getNode(plants[g.target])){
        g.target = findNearestPlant(g.mesh.position.x, g.mesh.position.z);
      }

      if (g.target >= 0 && typeof plants !== "undefined" && plants && g.target < plants.length){
        const pn = getNode(plants[g.target]);
        if (!pn) { g.target = -1; continue; }

        const dx = pn.position.x - g.mesh.position.x;
        const dz = pn.position.z - g.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        // Eat plant
        if (dist < 0.55 && g.cooldown <= 0){
          consumePlant(g.target);
          g.target = -1;
          g.cooldown = 1.05;

          // Tiny pulse so eating is undeniable
          try { g.mesh.scale.set(1.18, 1.18, 1.18); } catch(_) {}
          setTimeout(() => { try { if (g.mesh) g.mesh.scale.set(1,1,1); } catch(_) {} }, 120);
          continue;
        }

        // Move toward plant
        const ux = dx / (dist || 1);
        const uz = dz / (dist || 1);
        g.mesh.position.x += ux * GRAZE_SPD * dt;
        g.mesh.position.z += uz * GRAZE_SPD * dt;
        clampToEpoch(g);

      } else {
        // Wander
        g.wanderT -= dt;
        if (g.wanderT <= 0){
          g.wanderT = 1.2 + Math.random() * 1.8;
          g.wanderA = Math.random() * Math.PI * 2;
        }
        const spd = 0.55;
        g.mesh.position.x += Math.cos(g.wanderA) * spd * dt;
        g.mesh.position.z += Math.sin(g.wanderA) * spd * dt;
        clampToEpoch(g);
      }
    }
  }

  setInterval(step, 33);
})();



// ----- Herd Boon (BUILD0024) -----
// Symbiosis: near the sheep herd you get a small “rest” benefit.
// Visible truth probe: a ground ring under the player + status data-herd=ON.
// Mechanical effect: gentle energy regen up to a soft cap while herd=ON.
(() => {
  if (window.__emerge_herdboon_installed) return;
  window.__emerge_herdboon_installed = true;

  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.setAttribute("data-herd", "off");

  const BOON_R = 6.0;          // distance to nearest sheep to activate boon
  const REGEN_PER_S = 2.0;     // energy per second while boon is ON
  const SOFT_CAP_FRAC = 0.82;  // regen stops above (cap * frac)

  function getNode(o){
    return (o && o.mesh && o.mesh.isObject3D) ? o.mesh :
           (o && o.group && o.group.isObject3D) ? o.group :
           (o && o.obj && o.obj.isObject3D) ? o.obj :
           (o && o.isObject3D) ? o :
           null;
  }

  function getPlayerXZ(){
    try {
      if (typeof controls !== "undefined" && controls && controls.target) return { x: controls.target.x, z: controls.target.z };
    } catch(_) {}
    try {
      if (window.controls && window.controls.target) return { x: window.controls.target.x, z: window.controls.target.z };
    } catch(_) {}
    try {
      if (window.__emerge_playerNode && window.__emerge_playerNode.isObject3D) {
        return { x: window.__emerge_playerNode.position.x, z: window.__emerge_playerNode.position.z };
      }
    } catch(_) {}
    return null;
  }

  function getHerdArray(){
    const cands = [window.herd, window.flock, window.sheep];
    for (const a of cands) {
      if (Array.isArray(a) && a.length) return a;
    }
    return null;
  }

  // Visual ring (under player)
  let ring = null;
  function ensureRing(){
    if (ring || typeof THREE === "undefined" || typeof scene === "undefined") return;
    const geo = new THREE.RingGeometry(1.0, 1.45, 48);
    const mat = new THREE.MeshBasicMaterial({ color: 0x66CCFF, transparent: true, opacity: 0.30, side: THREE.DoubleSide });
    ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;
    scene.add(ring);
  }

  function getEnergyCap(){
    let cap = 120;
    try { if (typeof ENERGY_MAX === "number") cap = ENERGY_MAX; } catch(_) {}
    try { if (typeof energyMax === "number") cap = energyMax; } catch(_) {}
    // If nothing else, keep 120.
    return cap;
  }

  let last = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

  function step(){
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.max(0.010, Math.min(0.050, dt));

    ensureRing();

    const p = getPlayerXZ();
    const herd = getHerdArray();

    let nearest = 1e9;
    if (p && herd){
      for (const h of herd){
        const n = getNode(h);
        if (!n) continue;
        const dx = n.position.x - p.x;
        const dz = n.position.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < nearest) nearest = d;
      }
    }

    const on = (nearest < BOON_R);
    if (statusEl) statusEl.setAttribute("data-herd", on ? "ON" : "off");

    if (ring && p){
      ring.visible = on;
      ring.position.x = p.x;
      ring.position.z = p.z;
      // Slight proximity pulse (more obvious when really close)
      const k = Math.max(0, Math.min(1, (BOON_R - nearest) / BOON_R));
      ring.scale.setScalar(1.0 + 0.25 * k);
      ring.material.opacity = 0.18 + 0.26 * k;
    }

    // Mechanical: regen up to a soft cap
    if (on) {
      try {
        if (typeof energy === "number") {
          const cap = getEnergyCap();
          const soft = cap * SOFT_CAP_FRAC;
          if (energy < soft) energy = Math.min(soft, energy + REGEN_PER_S * dt);
        }
      } catch(_) {}
    }
  }

  setInterval(step, 33);
})();

// ----- Stragglers + Sheep Eat + Eat FX (BUILD0036_DARK1) -----
// Fixes phantom orange rings, makes straggler sheep edible, adds eat feedback pulse.
(() => {
  if (window.__emerge_eatfix_installed) return;
  window.__emerge_eatfix_installed = true;

  const statusEl = document.getElementById("status");
  const setAttr = (k,v) => { try { if (statusEl) statusEl.setAttribute(k, v); } catch(_){} };

  // --- Eat status helper (bottom bar shows eat=...) ---
  let eatClearTimer = 0;
  window.__emerge_setEatStatus = (msg) => {
    try { if (statusEl) statusEl.setAttribute("data-eat", msg); } catch(_) {}
    try { if (eatClearTimer) clearTimeout(eatClearTimer); } catch(_) {}
    eatClearTimer = setTimeout(() => {
      try { if (statusEl) statusEl.setAttribute("data-eat", ""); } catch(_) {}
    }, 900);
  };
  if (statusEl && !statusEl.getAttribute("data-eat")) statusEl.setAttribute("data-eat", "");

  // --- Eat FX pulse (visible, wordless confirmation) ---
  const pulses = [];
  let pulseTimer = 0;

  function ensurePulseRunner(){
    if (pulseTimer) return;
    pulseTimer = setInterval(() => {
      if (!pulses.length) return;
      const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      for (let i = pulses.length - 1; i >= 0; i--){
        const p = pulses[i];
        const age = (now - p.t0) / 1000;
        const k = Math.min(1, age / 0.32);
        try {
          p.mesh.scale.setScalar(1.0 + 2.1 * k);
          p.mesh.material.opacity = (1.0 - k) * 0.85;
        } catch(_) {}
        if (age >= 0.34){
          try { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); else if (typeof scene !== "undefined") scene.remove(p.mesh); } catch(_) {}
          pulses.splice(i, 1);
        }
      }
    }, 33);
  }

  window.__emerge_eatFX = (x, z, kind) => {
    try {
      if (typeof THREE === "undefined" || typeof scene === "undefined" || !scene) return;
      const color =
        (kind === "sheep")  ? 0xFFFFFF :
        (kind === "grazer") ? 0xF2E36E :
        0x66CCFF;

      const geo = new THREE.RingGeometry(0.28, 0.42, 28);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        depthTest: false, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = "__emerge_eatPulse";
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.05, z);
      scene.add(mesh);
      pulses.push({ mesh, t0: (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now() });
      ensurePulseRunner();

      try { if (typeof flash !== "undefined") flash = Math.max(flash, 0.85); } catch(_) {}
    } catch(_) {}
  };

  // --- Stragglers + herd sensing ---
  const BOON_R = 6.0;
  const EAT_R  = 1.05;

  const STRAG_NEIGHBOR_R = 3.2;
  const SAFE_NEIGHBOR_R  = 2.2;
  const STRAG_MULT = 0.55;
  const HERD_MULT  = 1.25;
  const REFRESH_MS = 500;

  const clamp01 = (x)=>Math.max(0, Math.min(1, x));

  function sphereRadius(m){
    try{
      if (m.geometry){
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        const r = m.geometry.boundingSphere ? m.geometry.boundingSphere.radius : 1;
        const s = m.scale ? Math.max(m.scale.x, m.scale.y, m.scale.z) : 1;
        return r * s;
      }
    }catch(_){}
    return 1;
  }

  function collectWhiteMeshes(){
    const found = [];
    try{
      if (typeof scene === "undefined" || !scene || !scene.traverse) return found;
      scene.traverse((o)=>{
        if (!o || !o.isMesh) return;
        if (o.name && o.name.startsWith("__emerge")) return;
        if (o.userData && o.userData.__eaten) return;
        const mat = o.material;
        const c = mat && mat.color;
        if (!c) return;
        // white-ish (for sheep + player)
        if (c.r > 0.75 && c.g > 0.75 && c.b > 0.75) found.push(o);
      });
    }catch(_){}
    return found;
  }

  function getPlayerXZ(){
    try{ if (typeof controls !== "undefined" && controls && controls.target) return {x:controls.target.x, z:controls.target.z}; }catch(_){}
    try{ if (typeof camera !== "undefined" && camera && camera.position) return {x:camera.position.x, z:camera.position.z}; }catch(_){}
    return null;
  }

  function overlaysOpen(){
    const lin = document.getElementById("lineage");
    if (lin && !lin.classList.contains("hidden")) return true;
    try { if (typeof draftOpen !== "undefined" && draftOpen) return true; } catch(_) {}
    return false;
  }

  let sheep = [];
  let lastRefresh = 0;
  const stragSet = new Set();
  const prev = new Map();

  // Visuals
  let herdRing = null;
  const ringBySheep = new Map(); // sheepMesh -> ringMesh

  function ensureHerdRing(){
    if (herdRing || typeof THREE === "undefined" || typeof scene === "undefined" || !scene) return;
    const geo = new THREE.RingGeometry(1.9, 2.7, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00FFFF, transparent: true, opacity: 0.70, side: THREE.DoubleSide,
      depthTest: false, depthWrite: false
    });
    herdRing = new THREE.Mesh(geo, mat);
    herdRing.name = "__emerge_herdRing";
    herdRing.rotation.x = -Math.PI/2;
    herdRing.position.y = 0.03;
    herdRing.visible = false;
    scene.add(herdRing);
  }

  function ensureStragRing(){
    if (typeof THREE === "undefined" || typeof scene === "undefined" || !scene) return null;
    const geo = new THREE.RingGeometry(0.35, 0.48, 28);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xFFAA33, transparent: true, opacity: 0.78, side: THREE.DoubleSide,
      depthTest: false, depthWrite: false
    });
    const r = new THREE.Mesh(geo, mat);
    r.name = "__emerge_stragRing";
    r.rotation.x = -Math.PI/2;
    r.position.y = 0.03;
    r.visible = false;
    scene.add(r);
    return r;
  }

  function refreshSheep(){
    const whites = collectWhiteMeshes();
    if (!whites.length){
      sheep = [];
      setAttr("data-sheep","0");
      return;
    }
    // Largest white sphere = player; rest = sheep
    let largest = whites[0];
    let maxR = sphereRadius(largest);
    for (const w of whites){
      const r = sphereRadius(w);
      if (r > maxR){ maxR = r; largest = w; }
    }
    sheep = whites.filter(w => w !== largest);
    setAttr("data-sheep", String(sheep.length));
  }

  function ringHygiene(aliveSet){
    // hide all rings by default; remove orphans
    for (const [k, ring] of ringBySheep.entries()){
      if (ring) ring.visible = false;
      if (!aliveSet.has(k) || (k.userData && k.userData.__eaten)){
        try { if (ring && ring.parent) ring.parent.remove(ring); } catch(_) {}
        ringBySheep.delete(k);
        prev.delete(k);
        stragSet.delete(k);
      }
    }
  }

  // Eat straggler sheep with Space (only if isolated + close)
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code !== "Space") return;
    if (overlaysOpen()) return;

    const p = getPlayerXZ();
    if (!p) return;

    // Find nearest sheep in range
    let nearest = null;
    let nearestD = 1e9;
    let nearestIsStrag = false;

    for (const s of sheep){
      if (!s || (s.userData && s.userData.__eaten)) continue;
      const dx = s.position.x - p.x;
      const dz = s.position.z - p.z;
      const d  = Math.hypot(dx, dz);
      if (d < nearestD){
        nearestD = d;
        nearest = s;
        nearestIsStrag = stragSet.has(s);
      }
    }

    if (nearest && nearestD <= EAT_R && nearestIsStrag){
      const x = nearest.position.x;
      const z = nearest.position.z;

      try { window.__emerge_eatFX && window.__emerge_eatFX(x, z, "sheep"); } catch(_) {}
      try { window.__emerge_setEatStatus && window.__emerge_setEatStatus("OK:sheep"); } catch(_) {}

      // Mark eaten (don’t rely on deleting from unknown herd arrays)
      try { nearest.userData.__eaten = true; } catch(_) {}
      try { nearest.visible = false; } catch(_) {}
      try { nearest.position.y = -999; } catch(_) {}

      // Energy bump (best-effort)
      try { if (typeof energy === "number") energy = energy + 30; } catch(_) {}
      try { if (typeof window.energy === "number") window.energy = window.energy + 30; } catch(_) {}

      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    // Helpful feedback: you’re close to sheep but it’s protected by the herd
    if (nearest && nearestD <= EAT_R && !nearestIsStrag){
      try { window.__emerge_setEatStatus && window.__emerge_setEatStatus("BLOCKED:herd"); } catch(_) {}
      // do NOT prevent default — let other eat handlers (plants/grazers) run
    }
  }, true);

  let last = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

  function tick(){
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    if (now - lastRefresh > REFRESH_MS){
      lastRefresh = now;
      refreshSheep();
    }

    ensureHerdRing();

    const p = getPlayerXZ();
    const alive = new Set(sheep.filter(s => s && !(s.userData && s.userData.__eaten)));

    ringHygiene(alive);
    stragSet.clear();

    // Herd proximity -> herd=ON + cyan ring
    let nearest = 1e9;
    if (p && sheep.length){
      for (const s of sheep){
        if (!alive.has(s)) continue;
        const dx = s.position.x - p.x;
        const dz = s.position.z - p.z;
        const d  = Math.hypot(dx, dz);
        if (d < nearest) nearest = d;
      }
    }
    const herdOn = (p && alive.size && nearest < BOON_R);
    setAttr("data-herd", herdOn ? "ON" : "off");
    setAttr("data-hnear", (p && alive.size) ? nearest.toFixed(1) : "?");

    if (herdRing && p){
      herdRing.visible = herdOn;
      herdRing.position.x = p.x;
      herdRing.position.z = p.z;
      if (alive.size){
        const k = clamp01((BOON_R - nearest) / BOON_R);
        herdRing.material.opacity = herdOn ? (0.35 + 0.35*k) : 0.0;
        herdRing.scale.setScalar(1.0 + 0.25*k);
      }
    }

    // Straggler classification + motion scaling
    let stragCount = 0;
    const nodes = Array.from(alive);
    const n = nodes.length;

    if (n >= 2){
      const nn = new Array(n).fill(1e9);
      for (let i=0;i<n;i++){
        for (let j=i+1;j<n;j++){
          const dx = nodes[j].position.x - nodes[i].position.x;
          const dz = nodes[j].position.z - nodes[i].position.z;
          const d  = Math.hypot(dx, dz);
          if (d < nn[i]) nn[i] = d;
          if (d < nn[j]) nn[j] = d;
        }
      }

      for (let i=0;i<n;i++){
        const s = nodes[i];
        const near = nn[i];

        const isStrag = (near > STRAG_NEIGHBOR_R);
        const isTight = (near < SAFE_NEIGHBOR_R);

        if (isStrag){
          stragSet.add(s);
          stragCount += 1;

          let ring = ringBySheep.get(s);
          if (!ring){
            ring = ensureStragRing();
            if (ring) ringBySheep.set(s, ring);
          }
          if (ring){
            ring.visible = true;
            ring.position.x = s.position.x;
            ring.position.z = s.position.z;
          }
        }

        const pv = prev.get(s);
        if (pv){
          const dx = s.position.x - pv.x;
          const dz = s.position.z - pv.z;
          let mult = 1.0;
          if (isStrag) mult = STRAG_MULT;
          else if (isTight) mult = HERD_MULT;
          s.position.x = pv.x + dx * mult;
          s.position.z = pv.z + dz * mult;
        }
        prev.set(s, {x:s.position.x, z:s.position.z});
      }
    } else {
      // If we can’t classify, ensure no rings show.
      for (const r of ringBySheep.values()){
        if (r) r.visible = false;
      }
    }

    setAttr("data-strag", String(stragCount));
  }

  // init truth probes
  setAttr("data-sheep","0");
  setAttr("data-strag","0");
  setAttr("data-hnear","?");
  setAttr("data-herd","off");

  setInterval(tick, 33);
})();



// ----- Predators (BUILD0036_DARK1) -----
// One red predator competes with you by hunting yellow grazers.
// Truth probes: status shows pred=<count> and pk=<pred kills>.
(() => {
  if (window.__emerge_predators_installed) return;
  window.__emerge_predators_installed = true;

  const statusEl = document.getElementById("status");
  const setAttr = (k,v) => { try { if (statusEl) statusEl.setAttribute(k, v); } catch(_){} };

  const predators = [];
  window.predators = predators;

  let killCount = 0;

  function updateStatus(){
    setAttr("data-pred", String(predators.length));
    setAttr("data-pk", String(killCount));
  }

  if (statusEl){
    if (!statusEl.getAttribute("data-pred")) statusEl.setAttribute("data-pred","0");
    if (!statusEl.getAttribute("data-pk")) statusEl.setAttribute("data-pk","0");
  }

  function getCfg(){
    try { return window.__emerge_epochCfg || null; } catch(_) { return null; }
  }

  function randDisc(r){
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d };
  }

  function randAround(cx, cz, r){
    const o = randDisc(r);
    return { x: cx + o.x, z: cz + o.z };
  }

  function clampToRadius(mesh, R){
    const x = mesh.position.x, z = mesh.position.z;
    const d = Math.hypot(x, z);
    if (d > R * 0.98){
      const s = (R * 0.98) / (d || 1);
      mesh.position.x = x * s;
      mesh.position.z = z * s;
    }
  }

  function grazerMeshOf(g){
    if (!g) return null;
    if (g.isObject3D) return g;
    if (g.mesh && g.mesh.isObject3D) return g.mesh;
    return null;
  }

  function findNearestGrazer(x, z){
    const arr = window.grazers;
    if (!Array.isArray(arr) || arr.length === 0) return -1;

    let best = -1;
    let bestD = 1e18;
    for (let i = 0; i < arr.length; i++){
      const m = grazerMeshOf(arr[i]);
      if (!m) continue;
      const dx = m.position.x - x;
      const dz = m.position.z - z;
      const d2 = dx*dx + dz*dz;
      if (d2 < bestD){
        bestD = d2;
        best = i;
      }
    }
    return best;
  }

  // Red pulse when predator eats
  function predPulse(x, z){
    try {
      if (typeof THREE === "undefined" || typeof scene === "undefined" || !scene) return;
      const geo = new THREE.RingGeometry(0.28, 0.42, 28);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xD43A3A, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        depthTest: false, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = "__emerge_predPulse";
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.05, z);
      scene.add(mesh);

      const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      const timer = setInterval(() => {
        const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        const age = (now - t0) / 1000;
        const k = Math.min(1, age / 0.28);
        try {
          mesh.scale.setScalar(1.0 + 2.0 * k);
          mesh.material.opacity = (1.0 - k) * 0.85;
        } catch(_) {}
        if (age >= 0.30){
          clearInterval(timer);
          try { if (mesh.parent) mesh.parent.remove(mesh); else scene.remove(mesh); } catch(_) {}
        }
      }, 33);
    } catch(_) {}
  }

  function removeGrazer(ix){
    const arr = window.grazers;
    if (!Array.isArray(arr)) return false;
    if (ix < 0 || ix >= arr.length) return false;

    const m = grazerMeshOf(arr[ix]);
    if (m){
      const x = m.position.x;
      const z = m.position.z;
      try { if (m.parent) m.parent.remove(m); else if (typeof scene !== "undefined") scene.remove(m); } catch(_) {}
      arr.splice(ix, 1);
      killCount += 1;
      updateStatus();
      predPulse(x, z);
      return true;
    }

    // If we can’t resolve mesh, still remove entry to avoid dead targets
    arr.splice(ix, 1);
    updateStatus();
    return true;
  }

  function clearPredators(){
    for (const p of predators){
      if (p && p.mesh){
        try { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); else if (typeof scene !== "undefined") scene.remove(p.mesh); } catch(_) {}
      }
    }
    predators.length = 0;
    updateStatus();
  }

  function spawnPredatorAt(x, z){
    try {
      if (typeof THREE === "undefined" || typeof scene === "undefined" || !scene) return;
      const geo = new THREE.SphereGeometry(0.44, 20, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xD43A3A, roughness: 0.55, metalness: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = "__emerge_predator";
      mesh.position.set(x, 0.44, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      predators.push({ mesh, target:-1, cooldown:0, wanderT:0, wanderA: Math.random() * Math.PI * 2 });
    } catch(_) {}
  }

  // Respawn predators whenever epoch/pressure changes
  let lastKey = "";
  function reseed(){
    const cfg = getCfg();
    clearPredators();

    if (!cfg || cfg.name !== "Meadow") { updateStatus(); return; }

    const R = (typeof cfg.radius === "number") ? cfg.radius : 26;
    const p = (typeof cfg.pressure === "number") ? cfg.pressure : 0;
    const n = Math.max(1, Math.round(1 + 1 * p)); // 1..2 predators as pressure rises

    const centers = window.__emerge_patchCenters;
    for (let i=0;i<n;i++){
      let pos = randDisc(R * 0.70);
      if (Array.isArray(centers) && centers.length){
        const c = centers[Math.floor(Math.random() * centers.length)];
        pos = randAround(c.x, c.z, 6.0);
      }
      spawnPredatorAt(pos.x, pos.z);
    }
    updateStatus();
  }

  setInterval(() => {
    const cfg = getCfg();
    const key = cfg ? `${cfg.name}|${cfg.radius}|${cfg.pressure}` : "none";
    if (key !== lastKey){
      lastKey = key;
      reseed();
    }
  }, 250);

  // Main predator update
  let last = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  setInterval(() => {
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.max(0.010, Math.min(0.050, dt));

    updateStatus();
    if (!predators.length) return;

    const cfg = getCfg();
    const R = (cfg && typeof cfg.radius === "number") ? cfg.radius : 26;

    for (const p of predators){
      if (!p || !p.mesh) continue;

      p.cooldown = Math.max(0, p.cooldown - dt);

      // acquire/validate target
      const arr = window.grazers;
      if (!Array.isArray(arr) || arr.length === 0){
        p.target = -1;
      } else if (p.target < 0 || p.target >= arr.length || !grazerMeshOf(arr[p.target])){
        p.target = findNearestGrazer(p.mesh.position.x, p.mesh.position.z);
      }

      if (p.target >= 0 && Array.isArray(arr) && p.target < arr.length){
        const gm = grazerMeshOf(arr[p.target]);
        if (!gm){ p.target = -1; continue; }

        const dx = gm.position.x - p.mesh.position.x;
        const dz = gm.position.z - p.mesh.position.z;
        const dist = Math.hypot(dx, dz);

        // eat
        if (dist < 0.62 && p.cooldown <= 0){
          removeGrazer(p.target);
          p.target = -1;
          p.cooldown = 0.85;
          continue;
        }

        // chase
        const spd = 1.55;
        const ux = dx / (dist || 1);
        const uz = dz / (dist || 1);
        p.mesh.position.x += ux * spd * dt;
        p.mesh.position.z += uz * spd * dt;
        clampToRadius(p.mesh, R);

      } else {
        // wander
        p.wanderT -= dt;
        if (p.wanderT <= 0){
          p.wanderT = 1.0 + Math.random() * 2.0;
          p.wanderA = Math.random() * Math.PI * 2;
        }
        const spd = 0.55;
        p.mesh.position.x += Math.cos(p.wanderA) * spd * dt;
        p.mesh.position.z += Math.sin(p.wanderA) * spd * dt;
        clampToRadius(p.mesh, R);
      }
    }
  }, 33);

  // initial seed
  setTimeout(reseed, 250);
})();




// ----- Prey Tiers (BUILD0036_DARK1) -----
// Fixes: guarantees at least one p2 exists, adds halo glyph for p2, and makes tiers more visually distinct.
// Debug: T = force tiers (recolor 3 existing prey if spawn function unavailable).
(() => {
  if (window.__emerge_preytiers_installed) return;
  window.__emerge_preytiers_installed = true;

  const statusEl = document.getElementById("status");
  const setAttr = (k,v) => { try { if (statusEl) statusEl.setAttribute(k, v); } catch(_){} };

  // More distinct palette. p2 is deep maroon + glowing halo glyph.
  const TIERS = [
    { id:0, label:"p0", color:0xFFC0C0, spdMult:0.92, energy:10, glyph:"dot"  },
    { id:1, label:"p1", color:0xFF3B3B, spdMult:1.12, energy:18, glyph:"cone" },
    { id:2, label:"p2", color:0x3B0016, spdMult:1.45, energy:34, glyph:"halo" },
  ];
  const DEFAULT_W = [0.55, 0.30, 0.15];

  function overlaysOpen(){
    const lin = document.getElementById("lineage");
    if (lin && !lin.classList.contains("hidden")) return true;
    const ov = document.getElementById("overlay");
    if (ov && !ov.classList.contains("hidden")) return true;
    return false;
  }

  function getPlayerXZ(){
    try { if (typeof controls !== "undefined" && controls && controls.target) return {x:controls.target.x, z:controls.target.z}; } catch(_) {}
    try { if (typeof player !== "undefined" && player && player.position) return {x:player.position.x, z:player.position.z}; } catch(_) {}
    return null;
  }

  function getPreyArray(){
    try { if (typeof prey !== "undefined" && Array.isArray(prey)) return prey; } catch(_) {}
    if (Array.isArray(window.prey)) return window.prey;
    return null;
  }

  function getNode(o){
    return (o && o.mesh && o.mesh.isObject3D) ? o.mesh :
           (o && o.group && o.group.isObject3D) ? o.group :
           (o && o.obj && o.obj.isObject3D) ? o.obj :
           (o && o.isObject3D) ? o :
           null;
  }

  function firstMesh(n){
    if (!n) return null;
    if (n.isMesh) return n;
    let m = null;
    try { n.traverse((o)=>{ if (!m && o && o.isMesh) m = o; }); } catch(_) {}
    return m;
  }

  function pickWeighted(w){
    const a=w[0]||0,b=w[1]||0,c=w[2]||0;
    const s=a+b+c;
    const r=Math.random()*s;
    if (r<a) return 0;
    if (r<a+b) return 1;
    return 2;
  }

  function applyTierAppearance(m, ix){
    const tier = TIERS[ix];

    // base color + emissive
    try {
      const mat = m.material;
      if (mat && mat.color && mat.color.setHex) mat.color.setHex(tier.color);
      if (mat && mat.emissive && mat.emissive.setHex) mat.emissive.setHex(tier.color);
      if (mat && typeof mat.emissiveIntensity === "number"){
        mat.emissiveIntensity = (ix === 2) ? 0.90 : (ix === 1) ? 0.22 : 0.12;
      }
    } catch(_) {}

    // subtle size cue
    try {
      if (!m.userData) m.userData = {};
      if (!m.userData.__preyScaled){
        const s = (ix === 0) ? 0.96 : (ix === 1) ? 1.04 : 1.12;
        m.scale.multiplyScalar(s);
        m.userData.__preyScaled = true;
      }
    } catch(_) {}

    // glyph (no words): dot / cone / halo
    try {
      if (typeof THREE === "undefined") return;
      if (!m.userData) m.userData = {};
      if (m.userData.__preyGlyph) return;

      let geo = null;
      if (tier.glyph === "dot")  geo = new THREE.SphereGeometry(0.06, 10, 10);
      if (tier.glyph === "cone") geo = new THREE.ConeGeometry(0.08, 0.14, 10);
      if (tier.glyph === "halo") geo = new THREE.TorusGeometry(0.14, 0.035, 10, 18);

      if (!geo) return;

      const mat = new THREE.MeshBasicMaterial({
        color: tier.color,
        transparent: true,
        opacity: (ix === 2) ? 0.95 : 0.75,
        depthTest: false,
        depthWrite: false
      });

      const g = new THREE.Mesh(geo, mat);
      g.name = "__emerge_preyGlyph";
      g.position.set(0, (ix === 2) ? 0.52 : 0.45, 0);
      g.rotation.x = (tier.glyph === "halo") ? Math.PI/2 : 0;
      m.add(g);
      m.userData.__preyGlyph = g;
    } catch(_) {}
  }

  function assignTier(obj, forcedIx){
    const n = getNode(obj);
    const m = firstMesh(n);
    if (!m) return -1;

    try {
      if (!m.userData) m.userData = {};
      if (typeof forcedIx === "number"){
        m.userData.__preyTier = forcedIx;
        applyTierAppearance(m, forcedIx);
        return forcedIx;
      }
      if (typeof m.userData.__preyTier === "number"){
        applyTierAppearance(m, m.userData.__preyTier);
        return m.userData.__preyTier;
      }
    } catch(_) {}

    // Try grade mapping if available
    let ix = -1;
    try {
      const g = obj && (obj.grade || obj.g || (obj.meta && obj.meta.grade));
      if (typeof PREY_GRADES !== "undefined" && Array.isArray(PREY_GRADES) && g){
        const j = PREY_GRADES.indexOf(g);
        if (j >= 0) ix = Math.min(2, j);
      }
    } catch(_) {}

    if (ix < 0){
      let w = DEFAULT_W;
      try {
        const cfg = window.__emerge_epochCfg;
        if (cfg && Array.isArray(cfg.preyW) && cfg.preyW.length >= 3) w = cfg.preyW;
      } catch(_) {}
      ix = pickWeighted(w);
    }

    try { if (!m.userData) m.userData = {}; m.userData.__preyTier = ix; } catch(_) {}
    applyTierAppearance(m, ix);
    return ix;
  }

  // Eat prey with Space (tier energy + colored pulse via existing fx if present)
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code !== "Space") return;
    if (overlaysOpen()) return;

    const arr = getPreyArray();
    if (!arr || !arr.length) return;

    const p = getPlayerXZ();
    if (!p) return;

    const EAT_R = 1.05;

    let best = -1, bestD = 1e9, bestMesh = null;

    for (let i=0;i<arr.length;i++){
      const m = firstMesh(getNode(arr[i]));
      if (!m) continue;
      if (m.userData && m.userData.__eaten) continue;

      const dx = m.position.x - p.x;
      const dz = m.position.z - p.z;
      const d  = Math.hypot(dx, dz);
      if (d < bestD){ bestD=d; best=i; bestMesh=m; }
    }

    if (best >= 0 && bestD <= EAT_R && bestMesh){
      const tierIx = assignTier(arr[best]);
      const tier = TIERS[Math.max(0, Math.min(2, tierIx))];

      const x = bestMesh.position.x;
      const z = bestMesh.position.z;

      try { if (!bestMesh.userData) bestMesh.userData = {}; bestMesh.userData.__eaten = true; } catch(_) {}
      try { bestMesh.visible = false; } catch(_) {}
      try { bestMesh.position.y = -999; } catch(_) {}
      try { if (bestMesh.parent) bestMesh.parent.remove(bestMesh); } catch(_) {}

      try { arr.splice(best, 1); } catch(_) {}

      // energy bump (best-effort)
      try { if (typeof energy === "number") energy = energy + tier.energy; } catch(_) {}
      try { if (typeof window.energy === "number") window.energy = window.energy + tier.energy; } catch(_) {}

      try { if (window.__emerge_setEatStatus) window.__emerge_setEatStatus(`OK:${tier.label}(+${tier.energy})`); } catch(_) {}
      try { if (window.__emerge_eatFX) window.__emerge_eatFX(x, z, `prey${tier.id}`); } catch(_) {}

      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // Maintain tiers: speed scaling + counters, and GUARANTEE at least one p2
  const prev = new Map();

  setInterval(() => {
    const arr = getPreyArray();
    if (!arr) return;

    let c0=0,c1=0,c2=0;
    const meshes = [];

    for (const o of arr){
      const m = firstMesh(getNode(o));
      if (!m) continue;
      if (m.userData && m.userData.__eaten) continue;

      const ix = assignTier(o);
      if (ix === 0) c0++; else if (ix === 1) c1++; else c2++;
      meshes.push({o, m, ix});

      const pv = prev.get(m);
      if (pv){
        const dx = m.position.x - pv.x;
        const dz = m.position.z - pv.z;

        let press = 0;
        try { press = (window.__emerge_epochCfg && typeof window.__emerge_epochCfg.pressure === "number") ? window.__emerge_epochCfg.pressure : 0; } catch(_) {}

        let mult = TIERS[ix].spdMult;
        if (ix === 2) mult = mult * (1.0 + 0.20 * press);

        m.position.x = pv.x + dx * mult;
        m.position.z = pv.z + dz * mult;
      }
      prev.set(m, {x:m.position.x, z:m.position.z});
    }

    // Guarantee: if no p2 exists but we have prey, promote one to p2 (visual proof + gameplay variety)
    if (c2 === 0 && meshes.length > 0){
      const pick = meshes[Math.floor(Math.random()*meshes.length)];
      try {
        assignTier(pick.o, 2);
        c2 = 1;
        if (pick.ix === 0) c0 = Math.max(0, c0-1);
        if (pick.ix === 1) c1 = Math.max(0, c1-1);
      } catch(_) {}
    }

    setAttr("data-p0", String(c0));
    setAttr("data-p1", String(c1));
    setAttr("data-p2", String(c2));
  }, 60);

  // Debug: T = force tiers (spawn if possible; otherwise recolor 3 existing prey to p0/p1/p2)
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (overlaysOpen()) return;
    if (e.code !== "KeyT") return;

    const p = getPlayerXZ();
    const arr = getPreyArray();

     
  }, true);
  // Debug: T = force tiers (spawn if possible; otherwise recolor 3 existing prey to p0/p1/p2)
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (overlaysOpen()) return;
    if (e.code !== "KeyT") return;

    const p = getPlayerXZ();
    const arr = getPreyArray();

    try {
      if (p && typeof spawnPreyAt === "function" && typeof PREY_GRADES !== "undefined" && Array.isArray(PREY_GRADES) && PREY_GRADES.length >= 3){
        spawnPreyAt(p.x + 1.8, p.z + 0.0, PREY_GRADES[0]);
        spawnPreyAt(p.x + 1.8, p.z + 1.8, PREY_GRADES[1]);
        spawnPreyAt(p.x + 0.0, p.z + 1.8, PREY_GRADES[2]);
        try { if (window.__emerge_setEatStatus) window.__emerge_setEatStatus("T:spawn tiers"); } catch(_) {}
      } else if (arr && arr.length >= 3) {
        assignTier(arr[0], 0);
        assignTier(arr[1], 1);
        assignTier(arr[2], 2);
        try { if (window.__emerge_setEatStatus) window.__emerge_setEatStatus("T:force tiers"); } catch(_) {}
      }
    } catch(_) {}

    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

})();



// ----- Apex HUD toggle + ring purge (BUILD0036_DARK1) -----
// H: toggle HUD overlay (keeps bottom status). K: purge small ring artifacts (keeps big herd ring).
(() => {
  if (window.__emerge_ui_apex_installed) return;
  window.__emerge_ui_apex_installed = true;

  const statusEl = document.getElementById("status");
  const body = document.body;

  function setHudAttr(){
    try { if (statusEl) statusEl.setAttribute("data-hud", body.classList.contains("hudOff") ? "off" : "on"); } catch(_) {}
  }

  function inIgnoreRoot(el){
    const ov = document.getElementById("overlay");
    const lin = document.getElementById("lineage");
    try {
      if (ov && ov.contains(el)) return true;
      if (lin && lin.contains(el)) return true;
    } catch(_) {}
    return false;
  }

  function markHudElements(){
    const patterns = [
      /\bWASD\b/i, /\bShift\b/i, /\bSpace\b/i, /\bcall\b/i, /\breject\b/i,
      /\bmigrate\b/i, /\bLINEA\b/i, /\bTRAITS\b/i, /\bBUILD\b/i, /\bRENDER\b/i,
      /\bEPOCH\b/i, /\bSTATUS\b/i
    ];

    const els = Array.from(document.querySelectorAll("body *"));
    for (const el of els){
      if (!(el instanceof HTMLElement)) continue;
      if (el.id === "status") continue;              // keep bottom bar always
      if (el.id === "hudToggleBtn") continue;        // keep the toggle
      if (inIgnoreRoot(el)) continue;                // don't hide mutation/lineage overlays

      const cs = window.getComputedStyle(el);
      if (cs.position !== "absolute" && cs.position !== "fixed") continue;

      const txt = (el.innerText || "").trim();
      if (!txt) continue;
      if (txt.length > 3000) continue;

      if (patterns.some(re => re.test(txt))){
        el.dataset.hud = "1";
      }
    }
  }

  function ensureBtn(){
    if (document.getElementById("hudToggleBtn")) return;
    const btn = document.createElement("button");
    btn.id = "hudToggleBtn";
    btn.type = "button";
    btn.textContent = "HUD on";
    btn.addEventListener("click", () => toggleHud());
    document.body.appendChild(btn);
  }

  function toggleHud(){
    body.classList.toggle("hudOff");
    const off = body.classList.contains("hudOff");
    const btn = document.getElementById("hudToggleBtn");
    if (btn) btn.textContent = off ? "HUD off" : "HUD on";
    setHudAttr();
    try { if (window.__emerge_setEatStatus) window.__emerge_setEatStatus(off ? "HUD:off" : "HUD:on"); } catch(_) {}
  }

  function purgeSmallRings(){
    try {
      if (typeof scene === "undefined" || !scene || !scene.traverse) return 0;
      let n = 0;
      const kill = [];
      scene.traverse((o) => {
        if (!o || !o.isMesh) return;
        const g = o.geometry;
        if (!g || g.type !== "RingGeometry") return;

        // keep big rings (herd zone etc)
        const sx = Math.max(o.scale.x || 1, o.scale.z || 1);
        if (sx >= 4.0) return;

        kill.push(o);
      });
      for (const o of kill){
        try { if (o.parent) o.parent.remove(o); else scene.remove(o); } catch(_) {}
        n++;
      }
      return n;
    } catch(_) { return 0; }
  }

  ensureBtn();
  markHudElements();
  setHudAttr();

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    if (e.code === "KeyH"){
      toggleHud();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    if (e.code === "KeyK"){
      const n = purgeSmallRings();
      try { if (window.__emerge_setEatStatus) window.__emerge_setEatStatus(`rings:${n}`); } catch(_) {}
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
  }, true);
})();



// ----- Predators hunt sheep (BUILD0036_DARK1) -----
// Adds a competing predator that hunts flock sheep; leaves meat drops you can steal.
// Space: eat meat drops (and isolated sheep only). Pred kills increment pk.
(() => {
  if (window.__apex_predators_installed) return;
  window.__apex_predators_installed = true;

  const statusEl = document.getElementById("status");
  const setAttr = (k,v)=>{ try { if (statusEl) statusEl.setAttribute(k, v); } catch(_){} };

  function overlaysOpen(){
    const lin = document.getElementById("lineage");
    if (lin && !lin.classList.contains("hidden")) return true;
    const ov = document.getElementById("overlay");
    if (ov && !ov.classList.contains("hidden")) return true;
    return false;
  }

  function getPlayerXZ(){
    try { if (typeof controls !== "undefined" && controls && controls.target) return {x:controls.target.x, z:controls.target.z}; } catch(_) {}
    try { if (typeof player !== "undefined" && player && player.position) return {x:player.position.x, z:player.position.z}; } catch(_) {}
    return null;
  }

  function firstMesh(n){
    if (!n) return null;
    if (n.isMesh) return n;
    let m=null;
    try { n.traverse((o)=>{ if (!m && o && o.isMesh) m=o; }); } catch(_) {}
    return m;
  }

  function getSheepMeshes(){
    // Prefer explicit sheep array if it exists
    const candidates = [];
    try {
      const arr =
        (typeof sheep !== "undefined" && Array.isArray(sheep)) ? sheep :
        (Array.isArray(window.sheep) ? window.sheep :
         Array.isArray(window.__emerge_sheep) ? window.__emerge_sheep :
         Array.isArray(window.__apex_sheep) ? window.__apex_sheep :
         null);

      if (arr){
        for (const o of arr){
          const m = firstMesh(o && (o.mesh || o.obj || o.group || o));
          if (m) candidates.push(m);
        }
      }
    } catch(_) {}

    if (candidates.length) return candidates;

    // Fallback: scan for small white spheres (exclude player sphere near player xz)
    const p = getPlayerXZ();
    const out = [];
    try {
      if (typeof scene === "undefined" || !scene || !scene.traverse) return out;
      scene.traverse((o)=>{
        if (!o || !o.isMesh) return;
        const g = o.geometry;
        if (!g || g.type !== "SphereGeometry") return;
        const mat = o.material;
        if (!mat || !mat.color || !mat.color.getHex) return;

        const c = mat.color.getHex();
        const r=(c>>16)&255, gg=(c>>8)&255, b=c&255;
        if (!(r>220 && gg>220 && b>220)) return;

        // size heuristic: sheep smaller than player
        const s = Math.max(o.scale.x||1, o.scale.y||1, o.scale.z||1);
        if (s > 0.90) return;

        if (p){
          const dx=o.position.x - p.x;
          const dz=o.position.z - p.z;
          if (Math.hypot(dx,dz) < 0.60) return;
        }
        out.push(o);
      });
    } catch(_) {}
    return out;
  }

  const meat = [];      // {mesh, ttl, value}
  const predators = []; // {mesh, vx, vz, eatT}
  const fx = [];        // {mesh, ttl, ttl0}

  function spawnFxRing(x,z,color=0xFF8A00, r0=0.35, r1=0.55, ttl=0.55){
    if (typeof THREE === "undefined" || typeof scene === "undefined") return;
    const geo = new THREE.RingGeometry(r0, r1, 28);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent:true, opacity:0.70,
      side:THREE.DoubleSide, depthTest:false, depthWrite:false
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI/2;
    ring.position.set(x, 0.02, z);
    ring.userData.__apex_fx = true;
    scene.add(ring);
    fx.push({mesh:ring, ttl, ttl0:ttl});
  }

  function spawnMeat(x,z,value=22){
    if (typeof THREE === "undefined" || typeof scene === "undefined") return null;
    const geo = new THREE.SphereGeometry(0.16, 14, 14);
    const mat = new THREE.MeshBasicMaterial({color:0xB00018, transparent:true, opacity:0.92});
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0.16, z);
    m.userData.__apex_meat = true;
    scene.add(m);

    // small ground cue
    try {
      const rg = new THREE.RingGeometry(0.20, 0.28, 24);
      const rm = new THREE.MeshBasicMaterial({color:0xFF8A00, transparent:true, opacity:0.60, side:THREE.DoubleSide, depthTest:false});
      const ring = new THREE.Mesh(rg, rm);
      ring.rotation.x = -Math.PI/2;
      ring.position.y = 0.01;
      ring.userData.__apex_fx = true;
      m.add(ring);
    } catch(_) {}

    
    meat.push({mesh:m, ttl:6.0, value});
    return m;
  }

  function spawnPredatorNearHerd(){
    if (typeof THREE === "undefined" || typeof scene === "undefined") return null;

    const sheep = getSheepMeshes()
    let x=0, z=0;
    if (sheep.length){
      for (const s of sheep){ x += s.position.x; z += s.position.z; }
      x /= sheep.length; z /= sheep.length;
      x += (Math.random()*2-1)*6;
      z += (Math.random()*2-1)*6;
    } else {
      const p = getPlayerXZ();
      x = p ? p.x + 6 : 0;
      z = p ? p.z + 6 : 0;
    }

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 16),
      new THREE.MeshStandardMaterial({color:0xC7A20A, emissive:0x553300, emissiveIntensity:0.35, roughness:0.6, metalness:0.1})
    );
    body.position.set(x, 0.26, z);
    body.userData.__apex_pred = true;

    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.10, 0.22, 12),
      new THREE.MeshBasicMaterial({color:0xFF8A00, transparent:true, opacity:0.85, depthTest:false})
    );
    spike.position.y = 0.55;
    spike.rotation.x = Math.PI;
    body.add(spike);

    scene.add(body);
    predators.push({mesh:body, vx:0, vz:0, eatT:0});
    return body;
  }

  function neighborCount(sheep, i, rad){
    const a = sheep[i];
    let n=0;
    for (let j=0;j<sheep.length;j++){
      if (j===i) continue;
      const b = sheep[j];
      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      if (dx*dx + dz*dz <= rad*rad) n++;
    }
    return n;
  }

  function pickStraggler(predPos, sheep){
    let best=null, bestScore=-1e9;
    const rad = 1.25;
    for (let i=0;i<sheep.length;i++){
      const s = sheep[i];
      if (!s || !s.position) continue;
      if (s.userData && s.userData.__apex_dead) continue;

      const neigh = neighborCount(sheep, i, rad);
      const iso = 1.0 / (neigh + 1.0);

      const dx = s.position.x - predPos.x;
      const dz = s.position.z - predPos.z;
      const d = Math.hypot(dx, dz);

      const score = iso*6.0 - d*0.06;
      if (score > bestScore){ bestScore = score; best = s; }
    }
    return best;
  }

  function markDead(mesh){
    try { if (!mesh.userData) mesh.userData = {}; mesh.userData.__apex_dead = true; } catch(_) {}
    try { mesh.visible = false; } catch(_) {}
    try { mesh.position.y = -999; } catch(_) {}
    // NOTE: don't force-remove from parent; leaving it avoids breaking unknown upstream arrays
  }

  // Space: eat meat drops (priority), else eat isolated sheep only (neigh<=1)
  window.addEventListener("keydown", (e)=>{
    if (e.repeat) return;
    if (e.code !== "Space") return;
    if (overlaysOpen()) return;

    const p = getPlayerXZ();
    if (!p) return;

    // meat first
    const EAT_R = 1.10;
    let best=-1, bestD=1e9;
    for (let i=0;i<meat.length;i++){
      const m = meat[i].mesh;
      if (!m || !m.position) continue;
      const d = Math.hypot(m.position.x - p.x, m.position.z - p.z);
      if (d < bestD){ bestD=d; best=i; }
    }
    if (best>=0 && bestD <= EAT_R){
      const item = meat[best]
      const val = item.value || 18;

      try { if (typeof energy === "number") energy += val; } catch(_) {}
      try { if (typeof window.energy === "number") window.energy += val; } catch(_) {}

      try { item.mesh.visible = false; item.mesh.position.y = -999; } catch(_) {}
      meat.splice(best,1);

      setAttr("data-eat", `meat(+${val})`);
      spawnFxRing(p.x, p.z, 0xFF3B3B, 0.28, 0.48, 0.45);

      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    // straggler sheep
    const sheep = getSheepMeshes();
    if (!sheep.length) return;

    let si=-1, sd=1e9;
    for (let i=0;i<sheep.length;i++){
      const s = sheep[i];
      if (!s || !s.position) continue;
      if (s.userData && s.userData.__apex_dead) continue;
      const d = Math.hypot(s.position.x - p.x, s.position.z - p.z);
      if (d < sd){ sd=d; si=i; }
    }

    if (si>=0 && sd <= 0.95){
      const neigh = neighborCount(sheep, si, 1.25);
      if (neigh <= 1){
        markDead(sheep[si]);
        const val = 16;

        try { if (typeof energy === "number") energy += val; } catch(_) {}
        try { if (typeof window.energy === "number") window.energy += val; } catch(_) {}

        setAttr("data-eat", `sheep(+${val})`);
        spawnFxRing(p.x, p.z, 0xFFFFFF, 0.26, 0.44, 0.45);

        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
  }, true);

  let pk = 0;

  function tick(){
    if (typeof scene === "undefined" || typeof THREE === "undefined") return;

    // ensure predator exists
    if (predators.length === 0){
      spawnPredatorNearHerd();
    }

    // fx decay
    for (let i=fx.length-1; i>=0; i--){
      const f = fx[i];
      f.ttl -= 0.06;
      const m = f.mesh;
      if (m && m.material){
        const a = Math.max(0, f.ttl / f.ttl0);
        m.material.opacity = 0.70 * a;
        m.scale.multiplyScalar(1.03);
      }
      if (f.ttl <= 0){
        try { if (m && m.parent) m.parent.remove(m); } catch(_) {}
        fx.splice(i,1);
      }
    }

    // meat decay
    for (let i=meat.length-1; i>=0; i--){
      meat[i].ttl -= 0.06;
      if (meat[i].ttl <= 0){
        try {
          const m = meat[i].mesh;
          if (m){ m.visible = false; m.position.y = -999; }
        } catch(_) {}
        meat.splice(i,1);
      }
    }

    const sheep = getSheepMeshes();

    for (const p of predators){
      const m = p.mesh;
      if (!m || !m.position) continue;

      if (p.eatT > 0){
        p.eatT -= 0.06;
        // predator consumes nearby meat if you don't steal it
        for (let i=meat.length-1; i>=0; i--){
          const md = meat[i].mesh;
          if (!md) continue;
          const d2 = (md.position.x - m.position.x)**2 + (md.position.z - m.position.z)**2;
          if (d2 <= 1.1*1.1){
            try { md.visible = false; md.position.y = -999; } catch(_) {}
            meat.splice(i,1);
            break;
          }
        }
        continue;
      }

      let target = null;
      if (sheep.length){
        target = pickStraggler(m.position, sheep);
      }

      if (target && target.position){
        const dx = target.position.x - m.position.x;
        const dz = target.position.z - m.position.z;
        const d = Math.hypot(dx, dz) || 1.0;

        const spd = 0.09; // calibrated to catch stragglers
        m.position.x += (dx/d) * spd;
        m.position.z += (dz/d) * spd;

        if (d <= 0.55){
          markDead(target);
          pk += 1;

          spawnMeat(target.position.x, target.position.z, 22)
          spawnFxRing(target.position.x, target.position.z, 0xFF8A00, 0.55, 0.85, 0.55)

          p.eatT = 1.3;
        }
      } else {
        // roam
        p.vx += (Math.random()*2-1) * 0.01;
        p.vz += (Math.random()*2-1) * 0.01;
        const vmax = 0.05;
        p.vx = Math.max(-vmax, Math.min(vmax, p.vx));
        p.vz = Math.max(-vmax, Math.min(vmax, p.vz));
        m.position.x += p.vx;
        m.position.z += p.vz;
      }
    }

    setAttr("data-pred", String(predators.length));
    setAttr("data-pk", String(pk));
  }

  setInterval(tick, 60);
})();



// ----- Metabolic Scaling + Trophic Shift (BUILD0036_DARK1) -----
// Baby→Juvenile→Adult changes what food is *efficient* (not what is allowed).
// Implementation is post-hoc: we watch data-eat "(+N)" and adjust energy delta to match diet factor.
// Also adds extra baseline drain that grows with maturity and pressure.
(() => {
  if (window.__apex_trophic_installed) return;
  window.__apex_trophic_installed = true;

  const statusEl = document.getElementById("status");
  if (!statusEl) return;

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // Persistent within session
  if (typeof window.__apex_xp !== "number") window.__apex_xp = 0;

  function getPressure(){
    try {
      const cfg = window.__emerge_epochCfg;
      if (cfg && typeof cfg.pressure === "number") return cfg.pressure;
    } catch(_) {}
    return 0;
  }

  function energyRef(){
    // energy is usually a module-scope number in your build; fall back to window.energy.
    try { if (typeof energy === "number") return { get:()=>energy, set:(v)=>{ energy=v; } }; } catch(_) {}
    try { if (typeof window.energy === "number") return { get:()=>window.energy, set:(v)=>{ window.energy=v; } }; } catch(_) {}
    return null;
  }

  function recompute(){
    const xp = (typeof window.__apex_xp === "number") ? window.__apex_xp : 0;

    // 0..1 maturity. Tune divisor to control how long it takes to "grow".
    const mass = clamp01(xp / 240.0);
    const stage = (mass < 0.34) ? "baby" : (mass < 0.67) ? "juv" : "adult";

    // ideal tier is continuous 0..2, shown as p0.0..p2.0
    const ideal = 2.0 * mass;

    window.__apex_mass  = mass;
    window.__apex_stage = stage;
    window.__apex_ideal = ideal;

    try {
      statusEl.setAttribute("data-stage", stage);
      statusEl.setAttribute("data-mass", mass.toFixed(2));
      statusEl.setAttribute("data-diet", "p" + ideal.toFixed(1));
    } catch(_) {}
  }

  recompute();

  // Extra baseline drain (additive on top of whatever the core game already does)
  let last = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  setInterval(() => {
    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.max(0.010, Math.min(0.080, dt));

    recompute();

    const e = energyRef();
    if (!e) return;

    const mass = (typeof window.__apex_mass === "number") ? window.__apex_mass : 0;
    const press = getPressure();

    // Calibrated so baby barely feels it; adult in high pressure definitely feels it.
    let extraDrain = (0.08 + 0.38 * mass) * (1.0 + 0.60 * press);

    const cur = e.get();
    if (typeof cur === "number" && isFinite(cur)){
      e.set(Math.max(0, cur - extraDrain * dt));
    }
  }, 100);

  // Trophic shift: adjust energy gain based on tier vs ideal
  let lastMsg = "";
  const obs = new MutationObserver(() => {
    const msg = statusEl.getAttribute("data-eat") || "";
    if (!msg) return;
    if (msg === lastMsg) return;
    lastMsg = msg;

    // Avoid re-processing our own annotated messages
    if (msg.indexOf("→") !== -1) return;

    const m = msg.match(/\(\+(\d+)\)/);
    if (!m) return;

    const base = parseInt(m[1], 10);
    if (!(base > 0)) return;

    // Determine tier from message shape
    let tier = null;
    if (msg.indexOf("p0") !== -1) tier = 0;
    else if (msg.indexOf("p1") !== -1) tier = 1;
    else if (msg.indexOf("p2") !== -1) tier = 2;
    else if (msg.indexOf("meat") !== -1) tier = 1;
    else if (msg.indexOf("sheep") !== -1) tier = 1;
    else if (msg.indexOf("grazer") !== -1) tier = 0;
    else if (msg.indexOf("plant") !== -1) tier = 0;

    if (tier === null) return;

    const mass = (typeof window.__apex_mass === "number") ? window.__apex_mass : 0;
    const ideal = 2.0 * mass; // 0..2 continuous
    const dist = Math.abs(tier - ideal);

    // Factor: best near ideal, worse far away. Clamp keeps it sane.
    let f = 1.20 - 0.35 * dist;        // dist 0 => 1.20 ; dist 2 => 0.50
    f = Math.max(0.30, Math.min(1.30, f));

    const adj = Math.max(1, Math.round(base * f));
    const delta = adj - base;

    // Apply the difference after-the-fact (core eat already added base)
    const e = energyRef();
    if (e && delta !== 0){
      const cur = e.get();
      if (typeof cur === "number" && isFinite(cur)){
        e.set(cur + delta);
      }
    }

    // XP increases with *effective* nutrition
    window.__apex_xp = (typeof window.__apex_xp === "number" ? window.__apex_xp : 0) + adj;
    recompute();

    // Annotate message so you can SEE the trophic factor working
    try {
      const annotated = msg.replace(/\(\+\d+\)/, "(+" + base + "→+" + adj + ")");
      statusEl.setAttribute("data-eat", annotated);
    } catch(_) {}
  });

  obs.observe(statusEl, { attributes:true, attributeFilter:["data-eat"] });

  // Initialize attrs so CSS shows something immediately
  try {
    if (!statusEl.getAttribute("data-stage")) statusEl.setAttribute("data-stage","baby");
    if (!statusEl.getAttribute("data-diet"))  statusEl.setAttribute("data-diet","p0.0");
    if (!statusEl.getAttribute("data-mass"))  statusEl.setAttribute("data-mass","0.00");
  } catch(_) {}
})();



// ----- Simple Biome + Bright Sky (BUILD0036_DARK1) -----
// Purpose: brighten the background + give a simple biome feel (sky + fog + hemi light + sun).
// Undo: press B to toggle biome on/off instantly (no rebuild needed).
(() => {
  if (window.__apex_biome_installed) return;
  window.__apex_biome_installed = true;

  let enabled = true;
  let inited = false;
  let hemi = null;
  let sun  = null;
  let orig = { bg:null, fog:null, clearHex:null, exposure:null };

  function getEpochName(){
    try {
      const cfg = window.__emerge_epochCfg;
      if (cfg && typeof cfg.name === "string") return cfg.name;
    } catch(_) {}
    return "";
  }

  function ensure(){
    try{
      if (typeof THREE === "undefined") return false;
      if (typeof scene === "undefined" || !scene) return false;

      if (!inited){
        orig.bg = scene.background || null;
        orig.fog = scene.fog || null;

        try {
          if (typeof renderer !== "undefined" && renderer && renderer.getClearColor){
            const c = renderer.getClearColor(new THREE.Color());
            orig.clearHex = c.getHex();
          }
          if (typeof renderer !== "undefined" && renderer && typeof renderer.toneMappingExposure === "number"){
            orig.exposure = renderer.toneMappingExposure;
          }
        } catch(_) {}

        // Hemisphere light = instant “outdoor” feel
        hemi = new THREE.HemisphereLight(0xEAF6FF, 0x3F5B2B, 0.95);
        hemi.name = "__apex_hemi";
        scene.add(hemi);

        // Sun light
        sun = new THREE.DirectionalLight(0xFFE6B3, 0.85);
        sun.name = "__apex_sun";
        sun.position.set(18, 30, 10);
        sun.castShadow = false
        scene.add(sun);

        inited = true;
      }
      return true;
    }catch(_){
      return false;
    }
  }

  function apply(){
    if (!ensure()) return;

    if (!enabled){
      try { scene.background = orig.bg; } catch(_) {}
      try { scene.fog = orig.fog; } catch(_) {}
      try { if (hemi) hemi.visible = false; if (sun) sun.visible = false; } catch(_) {}
      try {
        if (typeof renderer !== "undefined" && renderer && typeof orig.clearHex === "number" && renderer.setClearColor){
          renderer.setClearColor(orig.clearHex, 1);
        }
        if (typeof renderer !== "undefined" && renderer && typeof orig.exposure === "number"){
          renderer.toneMappingExposure = orig.exposure;
        }
      } catch(_) {}
      return;
    }

    try { if (hemi) hemi.visible = true; if (sun) sun.visible = true; } catch(_) {}

    const epoch = getEpochName();
    // Default: bright sky
    let sky = 0xCFEFFF;
    let fog = 0xCFEFFF;
    let ground = 0x4D7C3A;

    // Tiny “biome” differences by epoch name (best-effort)
    if (/nursery/i.test(epoch)){
      sky = 0xFFF1D6;
      fog = 0xFFF1D6;
      ground = 0x8A9C6B;
    } else if (/meadow/i.test(epoch)){
      sky = 0xBFE9FF;
      fog = 0xBFE9FF;
      ground = 0x3F7A43;
    }

    try { scene.background = new THREE.Color(0x06070b); } catch(_) {}
    try { scene.fog = new THREE.Fog(0x06070b, 10, 80); } catch(_) {}

    try {
      if (hemi){
        hemi.color.setHex(sky);
        hemi.groundColor.setHex(ground);
        hemi.intensity = 1.05;
      }
      if (sun){
        sun.color.setHex(0xFFE6B3);
        sun.intensity = 0.95;
      }
    } catch(_) {}

    try {
      if (typeof renderer !== "undefined" && renderer && renderer.setClearColor){
        renderer.setClearColor(sky, 1);
      }
      if (typeof renderer !== "undefined" && renderer && typeof renderer.toneMappingExposure === "number"){
        renderer.toneMappingExposure = 1.06;
      }
    } catch(_) {}
  }

  // Apply periodically (handles epoch switches)
  setInterval(apply, 250);
  setTimeout(apply, 250);

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code !== "KeyB") return;
    enabled = !enabled;
    try { if (window.__emerge_setEatStatus) window.__emerge_setEatStatus(enabled ? "biome:on" : "biome:off"); } catch(_) {}
    apply();
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
})();



// ----- PRESSURE MINIHUD (BUILD0036_DARK1) -----
// Toggle: V (Vitals). This reads from existing on-screen text (instrumentation only).
(() => {
  if (window.__apex_vitals_installed) return;
  window.__apex_vitals_installed = true;

  let visible = true;

  const el = document.createElement("div");
  el.id = "__apex_vitals";
  el.style.cssText = [
    "position:fixed",
    "right:12px",
    "bottom:56px",
    "z-index:9999",
    "font:12px ui-monospace, Menlo, monospace",
    "color:#e8eef2",
    "background:rgba(0,0,0,0.35)",
    "border:1px solid rgba(255,255,255,0.12)",
    "border-radius:10px",
    "padding:10px",
    "min-width:240px",
    "white-space:pre",
    "pointer-events:none",
    "backdrop-filter: blur(6px)"
  ].join(";");
  document.body.appendChild(el);

  function getNum(re, text, fallback=0) {
    const m = text.match(re);
    if (!m) return fallback;
    const v = parseFloat(m[1]);
    return Number.isFinite(v) ? v : fallback;
  }
  function getStr(re, text, fallback="") {
    const m = text.match(re);
    return m ? m[1] : fallback;
  }
  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }
  function bar(label, v, max=1) {
    const pct = clamp01(max === 0 ? 0 : v / max);
    const n = Math.round(pct * 10);
    return `${label.padEnd(6)} [${"█".repeat(n)}${"░".repeat(10-n)}] ${(pct*100).toFixed(0)}%`;
  }

  function tick() {
    if (!visible) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";

    const text = document.body ? document.body.innerText : "";
    const energy = getNum(/energy=([0-9.]+)/, text, NaN);
    const press  = getNum(/press=([0-9.]+)/, text, 0);
    const bias   = getNum(/bias=([0-9.]+)/,  text, 0);

    const diet  = getStr(/DIET([A-Za-z]+)/, text, getStr(/diet=([a-z]+)/, text, ""));
    const epoch = getStr(/epoch=([A-Za-z]+)/, text, getStr(/EPOCH([A-Za-z]+)/, text, ""));
    const stage = getStr(/stage=([A-Za-z]+)/, text, getStr(/STAGE([A-Za-z]+)/, text, ""));
    const gen   = getStr(/gen=([0-9]+)/, text, getStr(/GEN([0-9]+)/, text, ""));

    const lines = [];
    lines.push("APEX  VITALS");
    lines.push(`gen ${gen || "?"}  stage ${stage || "?"}  epoch ${epoch || "?"}`);
    if (Number.isFinite(energy)) lines.push(`energy ${energy.toFixed(1)}`);
    lines.push(bar("press", press, 1));
    lines.push(bar("bias",  bias,  1));
    if (diet) lines.push(`diet  ${diet}`);
    lines.push("V toggle");
    el.textContent = lines.join("\n");
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "KeyV") {
      visible = !visible;
      tick();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  setInterval(tick, 200);
  setTimeout(tick, 250);
})();



// DARK MODE CLAMP (BUILD0036_DARK1)
// Last-word clamp (wins if something later re-brightens the scene)
try {
  if (typeof renderer !== "undefined" && renderer?.setClearColor) renderer.setClearColor(0x06070b, 1);
  if (typeof scene !== "undefined" && scene) {
    scene.background = new THREE.Color(0x06070b);
    if (scene.fog && scene.fog.color) scene.fog.color.set(0x06070b);
  }
} catch (e) {}
