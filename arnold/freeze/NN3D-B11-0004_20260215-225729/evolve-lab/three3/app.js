import * as THREE from "../vendor/three.module.js";

const BUILD = "BUILD0003";
const PROJECT = "EVOLVE-LAB";

const $ = (id) => document.getElementById(id);

const vParam = new URLSearchParams(location.search).get("v") ?? "(none)";
$("vtag").textContent = vParam;
$("loadedAt").textContent = new Date().toLocaleString();
$("path").textContent = location.pathname;
$("rendererTag").textContent = `THREE r${THREE.REVISION}`;

const ui = {
  overlay: $("overlay"),
  overlayStats: $("overlayStats"),
  cards: $("cards"),
  status: $("status"),
  genTag: $("genTag"),
  traitsTag: $("traitsTag"),
  lastTag: $("lastTag"),
};

const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
try { renderer.outputColorSpace = THREE.SRGBColorSpace; } catch {}

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

// lights
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(6, 12, 7);
scene.add(sun);

// grid proof
const grid = new THREE.GridHelper(200, 200, 0x2a3342, 0x1b2230);
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

// ground for raycast clicks
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshBasicMaterial({ visible: false })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// input
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// ----- Genome (trait vector) -----
// These are intentionally few + meaningful so we don't fake it.
const genome = {
  speed: 1.0,       // affects accel + maxSpeed
  efficiency: 1.0,  // reduces energy burn
  digestion: 1.0,   // increases energy gain from food
};

let generation = 1;
let lastMutationName = "(none)";

function traitsString() {
  return `spd=${genome.speed.toFixed(2)} eff=${genome.efficiency.toFixed(2)} dig=${genome.digestion.toFixed(2)}`;
}

function updateHudTags() {
  ui.genTag.textContent = String(generation);
  ui.traitsTag.textContent = traitsString();
  ui.lastTag.textContent = lastMutationName;
}
updateHudTags();

// creature
const creature = { pos: new THREE.Vector3(0, 0.55, 0), vx: 0, vz: 0, energy: 60, alive: true };

const organism = new THREE.Group();
organism.position.copy(creature.pos);

// body
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 });
const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 18), bodyMat);
organism.add(body);

// nose (+X)
const nose = new THREE.Mesh(
  new THREE.SphereGeometry(0.14, 16, 10),
  new THREE.MeshStandardMaterial({ color: 0x3c3c5a, roughness: 0.8, metalness: 0.0 })
);
nose.position.set(0.42, 0.05, 0);
organism.add(nose);

// tail
const tail = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.06, 1.05, 14),
  new THREE.MeshStandardMaterial({ color: 0xc8dcff, roughness: 0.9, metalness: 0.0, transparent: true, opacity: 0.85 })
);
tail.rotation.z = Math.PI / 2;
tail.position.set(-0.85, 0, 0);
organism.add(tail);

scene.add(organism);

// food + rings
const foodGeom = new THREE.SphereGeometry(0.18, 16, 10);
const foodMat = new THREE.MeshStandardMaterial({ color: 0xa0ffaa, roughness: 0.55, metalness: 0.0 });
const foods = []; // { mesh, value }

const rings = []; // { mesh, t, eat }
const ringGeom = new THREE.TorusGeometry(0.55, 0.04, 10, 48);
const ringMatClick = new THREE.MeshBasicMaterial({ color: 0x78c8ff, transparent: true, opacity: 0.85 });
const ringMatEat   = new THREE.MeshBasicMaterial({ color: 0xffe68c, transparent: true, opacity: 0.95 });

function spawnRing(x, z, eat=false) {
  const m = (eat ? ringMatEat : ringMatClick).clone();
  const ring = new THREE.Mesh(ringGeom, m);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.03, z);
  scene.add(ring);
  rings.push({ mesh: ring, t: 0, eat });
}

function spawnFoodAt(x, z) {
  const mesh = new THREE.Mesh(foodGeom, foodMat);
  mesh.position.set(x, 0.18, z);
  scene.add(mesh);
  foods.push({ mesh, value: 18 });
  spawnRing(x, z, false);
}

// click raycast to ground (disabled during overlay)
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function clickSpawn(e) {
  if (draftOpen) return;
  if (e.target && e.target.closest && e.target.closest("#overlay")) return;

  const w = window.innerWidth, h = window.innerHeight;
  ndc.x = (e.clientX / Math.max(1, w)) * 2 - 1;
  ndc.y = -((e.clientY / Math.max(1, h)) * 2 - 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(ground, false)[0];
  if (hit) spawnFoodAt(hit.point.x, hit.point.z);

  flash = Math.max(flash, 1.0);
}
window.addEventListener("pointerdown", clickSpawn);

// reset
function resetWorld() {
  creature.pos.set(0, 0.55, 0);
  creature.vx = 0; creature.vz = 0;
  creature.energy = 60;
  creature.alive = true;
  body.material.color.set(0xffffff);

  for (const f of foods) scene.remove(f.mesh);
  foods.length = 0;

  for (const r of rings) scene.remove(r.mesh);
  rings.length = 0;

  reproReady = false;
  draftOpen = false;
  ui.overlay.classList.add("hidden");

  life = newLifeStats();
  updateHudTags();
}
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") resetWorld();
});

// ----- Telemetry (life stats) -----
function newLifeStats() {
  return {
    t: 0,
    distance: 0,
    sprintT: 0,
    starvingT: 0,
    foodsEaten: 0,
    energyGained: 0,
  };
}
let life = newLifeStats();

// reproduction gating
let reproReady = false;
let draftOpen = false;

// undeniable input flash
let flash = 0;

// simulation helpers
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function hypot2(x,z){ return Math.sqrt(x*x+z*z); }

function derivedParams() {
  // These are the “rules of the universe” the genome plugs into.
  // Few knobs, but they matter.
  const speed = genome.speed;
  const eff = genome.efficiency;
  const dig = genome.digestion;

  const accel = 8.0 * speed;
  const maxSpeed = 4.2 * speed;

  // Energy model: efficiency reduces all burn.
  const burnMul = 1.0 / eff;

  // Digestion increases food value.
  const foodMul = dig;

  return { accel, maxSpeed, burnMul, foodMul };
}

// ----- Mutation draft (data-driven recommendation) -----
function pickRecommendationFromTelemetry() {
  // Three simple “bottleneck scores”
  const hungerScore = life.starvingT + Math.max(0, 6 - life.foodsEaten) * 0.6;
  const speedScore  = life.sprintT + (life.distance * 0.05);
  const wasteScore  = Math.max(0, life.t - life.foodsEaten * 2.0); // rough “inefficiency” proxy

  if (hungerScore >= speedScore && hungerScore >= wasteScore) return "digestion";
  if (speedScore >= wasteScore) return "speed";
  return "efficiency";
}

function mutationCards() {
  // Cards are stable; the *recommendation* is data-driven.
  // This avoids “we wrote a million branches.”
  return [
    {
      id: "speed",
      name: "Swift Strain",
      meta: "+Speed  (faster accel/max)\n-Tradeoff: slightly less efficient",
      apply: () => { genome.speed *= 1.12; genome.efficiency *= 0.96; },
      tint: 0x78c8ff,
    },
    {
      id: "digestion",
      name: "Gut Flora Bloom",
      meta: "+Digestion  (more energy per food)\n-Tradeoff: slightly slower",
      apply: () => { genome.digestion *= 1.15; genome.speed *= 0.97; },
      tint: 0xa0ffaa,
    },
    {
      id: "efficiency",
      name: "Frugal Cells",
      meta: "+Efficiency  (less energy burn)\n-Tradeoff: slightly less digestion",
      apply: () => { genome.efficiency *= 1.15; genome.digestion *= 0.97; },
      tint: 0xffe68c,
    },
  ];
}

function openDraft() {
  draftOpen = true;
  ui.overlay.classList.remove("hidden");

  const rec = pickRecommendationFromTelemetry();
  const cards = mutationCards();

  ui.overlayStats.textContent =
    `Telemetry (this generation):\n` +
    `  timeAlive=${life.t.toFixed(1)}s\n` +
    `  distance=${life.distance.toFixed(1)}\n` +
    `  sprintTime=${life.sprintT.toFixed(1)}s\n` +
    `  starvingTime=${life.starvingT.toFixed(1)}s\n` +
    `  foodsEaten=${life.foodsEaten}\n\n` +
    `Recommended: ${rec.toUpperCase()} (based on what actually limited you)`;

  ui.cards.innerHTML = "";
  cards.forEach((c, idx) => {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.type = "button";
    btn.dataset.idx = String(idx);
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

function chooseMutation(idx) {
  const cards = mutationCards();
  const c = cards[idx];
  if (!c) return;

  // apply
  c.apply();
  lastMutationName = c.name;

  // visible feedback: tint the body briefly toward mutation color
  body.material.color.setHex(c.tint);
  flash = Math.max(flash, 0.9);

  // new generation
  generation += 1;
  reproReady = false;
  closeDraft();

  // reset life stats + some world state (kept simple on purpose)
  life = newLifeStats();
  creature.energy = 60;
  creature.alive = true;

  updateHudTags();
}

// keyboard controls for reproduction / mutation picking
window.addEventListener("keydown", (e) => {
  if (draftOpen) {
    if (e.key === "1") chooseMutation(0);
    if (e.key === "2") chooseMutation(1);
    if (e.key === "3") chooseMutation(2);
    if (e.key === "Escape") closeDraft();
    return;
  }

  if (e.code === "Space" && reproReady) {
    openDraft();
  }
});

// ----- Main loop -----
let last = performance.now();
let fps = 0;

function update(dt) {
  const { accel, maxSpeed, burnMul, foodMul } = derivedParams();

  const up = keys.has("w") || keys.has("arrowup");
  const dn = keys.has("s") || keys.has("arrowdown");
  const lf = keys.has("a") || keys.has("arrowleft");
  const rt = keys.has("d") || keys.has("arrowright");

  const ax = (rt ? 1 : 0) - (lf ? 1 : 0);
  const az = (dn ? 1 : 0) - (up ? 1 : 0);

  const sprint = keys.has("shift") && creature.alive && !draftOpen;
  const sprintMul = sprint ? 1.65 : 1.0;

  const drag = sprint ? 4.0 : 6.0;
  const maxSp = maxSpeed * sprintMul;

  const prevX = creature.pos.x;
  const prevZ = creature.pos.z;

  if (creature.alive && !draftOpen) {
    creature.vx += ax * accel * dt;
    creature.vz += az * accel * dt;

    creature.vx -= creature.vx * drag * dt;
    creature.vz -= creature.vz * drag * dt;

    const sp = hypot2(creature.vx, creature.vz);
    if (sp > maxSp) {
      creature.vx = (creature.vx / sp) * maxSp;
      creature.vz = (creature.vz / sp) * maxSp;
    }

    creature.pos.x += creature.vx * dt;
    creature.pos.z += creature.vz * dt;

    // energy burn (efficiency reduces burn)
    const sp2 = hypot2(creature.vx, creature.vz);
    const moveBurn = (0.22 + (sprint ? 0.30 : 0.0)) * sp2 * dt * burnMul;
    const baseBurn = 0.35 * dt * burnMul;
    creature.energy -= (moveBurn + baseBurn);

    // telemetry
    life.t += dt;
    if (sprint) life.sprintT += dt;

    const dx = creature.pos.x - prevX;
    const dz = creature.pos.z - prevZ;
    const d = Math.sqrt(dx*dx + dz*dz);
    life.distance += d;

    if (creature.energy < 25) life.starvingT += dt;

    creature.energy = clamp(creature.energy, 0, 120);
    if (creature.energy <= 0.01) {
      creature.alive = false;
      body.material.color.set(0xa0a0a0);
    }

    // eat foods
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      const dx2 = f.mesh.position.x - creature.pos.x;
      const dz2 = f.mesh.position.z - creature.pos.z;
      if ((dx2*dx2 + dz2*dz2) < (0.75*0.75)) {
        const gained = f.value * foodMul;
        creature.energy = clamp(creature.energy + gained, 0, 120);
        life.foodsEaten += 1;
        life.energyGained += gained;

        scene.remove(f.mesh);
        foods.splice(i, 1);
        spawnRing(creature.pos.x, creature.pos.z, true);
        flash = Math.max(flash, 0.7);
      }
    }

    // face velocity
    const sp3 = hypot2(creature.vx, creature.vz);
    if (sp3 > 0.05) organism.rotation.y = Math.atan2(-creature.vz, creature.vx);
  }

  // rings
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

  flash = Math.max(0, flash - dt * 2.2);

  // camera follow
  camera.position.copy(creature.pos).add(camOffset);
  camera.lookAt(creature.pos.x, 0.35, creature.pos.z);

  // reproduction readiness
  if (!draftOpen && creature.alive && !reproReady && creature.energy >= 110) {
    reproReady = true;
    flash = Math.max(flash, 0.9);
  }

  const state = !creature.alive ? "DEAD (R to reset)" :
                draftOpen ? "MUTATION DRAFT (1/2/3)" :
                reproReady ? "REPRO READY (Space)" :
                "roam / eat / learn";

  ui.status.textContent =
    `STATUS: ${PROJECT} ${BUILD} | v=${vParam} | fps=${fps.toFixed(0)} | gen=${generation} | ` +
    `energy=${creature.energy.toFixed(1)} | foods=${foods.length} | ${state}`;
}

function draw() {
  const base = 0x07090d;
  const boost = Math.floor(0x20 * flash);
  const r = ((base >> 16) & 255) + boost;
  const g = ((base >> 8) & 255) + boost;
  const b = (base & 255) + boost;
  renderer.setClearColor((clamp(r,0,255)<<16) | (clamp(g,0,255)<<8) | clamp(b,0,255), 1);

  organism.position.copy(creature.pos);
  renderer.render(scene, camera);
}

function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps = fps * 0.9 + (1 / Math.max(1e-6, dt)) * 0.1;

  update(dt);
  draw();
  requestAnimationFrame(step);
}

resetWorld();
requestAnimationFrame(step);
