import * as THREE from "../vendor/three.module.js";

const BUILD = "BUILD0004";
const PROJECT = "EVOLVE-LAB";

const $ = (id) => document.getElementById(id);
const vParam = new URLSearchParams(location.search).get("v") ?? "(none)";

const ui = {
  path: $("path"),
  vtag: $("vtag"),
  rendererTag: $("rendererTag"),
  loadedAt: $("loadedAt"),
  genTag: $("genTag"),
  stageTag: $("stageTag"),
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

// prevent page scroll from arrows/space
window.addEventListener("keydown", (e) => {
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
}, { passive: false });

// lights
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(6, 12, 7);
scene.add(sun);

// grid (perspective proof)
const grid = new THREE.GridHelper(200, 200, 0x2a3342, 0x1b2230);
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

// invisible ground for raycast clicks
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshBasicMaterial({ visible: false })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// ----- Input -----
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// ----- Genome (trait vector) -----
const genome = {
  speed: 1.0,
  efficiency: 1.0,
  digestion: 1.0,
};
let generation = 1;
let lastMutationName = "(none)";

// ----- Life stage -----
let maturity = 1.0; // start adult; after reproduction becomes baby (0.0)
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function stageName(m) {
  if (m < 0.35) return "BABY";
  if (m < 0.85) return "JUVENILE";
  return "ADULT";
}
function stageScale(m) {
  return 0.55 + 0.45 * clamp(m, 0, 1);
}
function isAdult() {
  return maturity >= 0.92;
}
function traitsString() {
  return `spd=${genome.speed.toFixed(2)} eff=${genome.efficiency.toFixed(2)} dig=${genome.digestion.toFixed(2)}`;
}

// ----- Creature -----
const creature = {
  pos: new THREE.Vector3(0, 0.55, 0),
  vx: 0,
  vz: 0,
  energy: 60,
  alive: true,
};

// visuals
const organism = new THREE.Group();
organism.position.copy(creature.pos);

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 });
const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 18), bodyMat);
organism.add(body);

const nose = new THREE.Mesh(
  new THREE.SphereGeometry(0.14, 16, 10),
  new THREE.MeshStandardMaterial({ color: 0x3c3c5a, roughness: 0.8, metalness: 0.0 })
);
nose.position.set(0.42, 0.05, 0);
organism.add(nose);

const tail = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.06, 1.05, 14),
  new THREE.MeshStandardMaterial({ color: 0xc8dcff, roughness: 0.9, metalness: 0.0, transparent: true, opacity: 0.85 })
);
tail.rotation.z = Math.PI / 2;
tail.position.set(-0.85, 0, 0);
organism.add(tail);

scene.add(organism);

// ----- Food + rings -----
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

// click raycast -> spawn food
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
  if (hit) spawnFoodAt(hit.point.x, hit.point.z);

  flash = Math.max(flash, 1.0);
}
window.addEventListener("pointerdown", clickSpawn);

// ----- Telemetry -----
function newLifeStats() {
  return { t: 0, distance: 0, sprintT: 0, starvingT: 0, foodsEaten: 0, energyGained: 0 };
}
let life = newLifeStats();

// ----- Mate system -----
let mate = null;         // { mesh, vx, vz, state, bondT, heartCd }
let mateStatus = "none"; // HUD string
let babyPreview = null;
const babyPreviewPos = new THREE.Vector3();

function spawnMate() {
  const geom = new THREE.SphereGeometry(0.48, 28, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff77aa, roughness: 0.35, metalness: 0.02 });
  const mesh = new THREE.Mesh(geom, mat);

  const ang = Math.random() * Math.PI * 2;
  const dist = 9 + Math.random() * 5;
  mesh.position.set(
    creature.pos.x + Math.cos(ang) * dist,
    0.48,
    creature.pos.z + Math.sin(ang) * dist
  );

  scene.add(mesh);
  mate = { mesh, vx: 0, vz: 0, state: "approaching", bondT: 0, heartCd: 0 };
  mateStatus = "approaching";
  flash = Math.max(flash, 0.8);
}

// hearts (silly + undeniable)
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

function rand(a,b){ return a + Math.random() * (b-a); }

function spawnHeartsAt(x, z, count=6) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: heartTex,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
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

function beginMating() {
  // spawn baby preview next to pair (visual cue)
  babyPreviewPos.set(creature.pos.x + 0.9, 0.35, creature.pos.z + 0.8);

  const babyGeom = new THREE.SphereGeometry(0.33, 22, 14);
  const babyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.0 });
  babyPreview = new THREE.Mesh(babyGeom, babyMat);
  babyPreview.position.copy(babyPreviewPos);
  scene.add(babyPreview);

  openDraft();
}

function abortMating() {
  if (babyPreview) { scene.remove(babyPreview); babyPreview = null; }
  if (mate) { scene.remove(mate.mesh); mate = null; }
  mateStatus = "none";
  closeDraft();
  flash = Math.max(flash, 0.6);
}

// ----- Mutation draft (data-driven recommendation) -----
function pickRecommendationFromTelemetry() {
  const hungerScore = life.starvingT + Math.max(0, 6 - life.foodsEaten) * 0.6;
  const speedScore  = life.sprintT + (life.distance * 0.05);
  const wasteScore  = Math.max(0, life.t - life.foodsEaten * 2.0);
  if (hungerScore >= speedScore && hungerScore >= wasteScore) return "digestion";
  if (speedScore >= wasteScore) return "speed";
  return "efficiency";
}

function mutationCards() {
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
    `Telemetry (parent generation):\n` +
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

  c.apply();
  lastMutationName = c.name;

  // visible feedback
  body.material.color.setHex(c.tint);
  flash = Math.max(flash, 0.9);

  // take over the baby: "you become the offspring"
  generation += 1;
  maturity = 0.0;

  creature.pos.set(babyPreviewPos.x, 0.55, babyPreviewPos.z);
  creature.vx = 0; creature.vz = 0;
  creature.energy = 55;
  creature.alive = true;

  // clear mating actors
  if (babyPreview) { scene.remove(babyPreview); babyPreview = null; }
  if (mate) { scene.remove(mate.mesh); mate = null; }
  mateStatus = "none";

  // new generation telemetry
  life = newLifeStats();

  closeDraft();
  updateHud();
}

window.addEventListener("keydown", (e) => {
  if (draftOpen) {
    if (e.key === "1") chooseMutation(0);
    if (e.key === "2") chooseMutation(1);
    if (e.key === "3") chooseMutation(2);
    if (e.key === "Escape") abortMating();
    return;
  }
});

// reset
function resetWorld() {
  creature.pos.set(0, 0.55, 0);
  creature.vx = 0; creature.vz = 0;
  creature.energy = 60;
  creature.alive = true;

  genome.speed = 1.0;
  genome.efficiency = 1.0;
  genome.digestion = 1.0;

  generation = 1;
  maturity = 1.0;
  lastMutationName = "(none)";
  body.material.color.set(0xffffff);

  for (const f of foods) scene.remove(f.mesh);
  foods.length = 0;
  for (const r of rings) scene.remove(r.mesh);
  rings.length = 0;

  for (const h of hearts) scene.remove(h.sprite);
  hearts.length = 0;

  if (babyPreview) { scene.remove(babyPreview); babyPreview = null; }
  if (mate) { scene.remove(mate.mesh); mate = null; }
  mateStatus = "none";

  life = newLifeStats();
  closeDraft();
  flash = 0;

  updateHud();
}

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") resetWorld();
});

// ----- Sim helpers -----
function hypot2(x,z){ return Math.sqrt(x*x + z*z); }

function derivedParams() {
  const speed = genome.speed;
  const eff = genome.efficiency;
  const dig = genome.digestion;

  // growth affects real movement (baby -> juvenile -> adult)
  const g = stageScale(maturity);

  const accel = 8.0 * speed * g;
  const maxSpeed = 4.2 * speed * g;

  const burnMul = 1.0 / eff;
  const foodMul = dig;

  return { accel, maxSpeed, burnMul, foodMul, g };
}

function updateHud() {
  ui.genTag.textContent = String(generation);

  const st = stageName(maturity);
  ui.stageTag.textContent = `${st} (${Math.round(maturity * 100)}%)`;

  ui.mateTag.textContent = mateStatus;

  ui.traitsTag.textContent = traitsString();
  ui.lastTag.textContent = lastMutationName;
}

// ----- Main loop -----
let last = performance.now();
let fps = 0;
let flash = 0;

function update(dt) {
  const { accel, maxSpeed, burnMul, foodMul } = derivedParams();

  const up = keys.has("w") || keys.has("arrowup");
  const dn = keys.has("s") || keys.has("arrowdown");
  const lf = keys.has("a") || keys.has("arrowleft");
  const rt = keys.has("d") || keys.has("arrowright");

  const ax = (rt ? 1 : 0) - (lf ? 1 : 0);
  const az = (dn ? 1 : 0) - (up ? 1 : 0);

  const sprint = keys.has("shift") && creature.alive && !draftOpen && !(mate && mate.state === "bonding");
  const sprintMul = sprint ? 1.65 : 1.0;
  const drag = sprint ? 4.0 : 6.0;

  const locked = draftOpen || (mate && mate.state === "bonding");

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
    const d = Math.sqrt(dx*dx + dz*dz);
    life.distance += d;

    if (creature.energy < 25) life.starvingT += dt;

    creature.energy = clamp(creature.energy, 0, 120);
    if (creature.energy <= 0.01) {
      creature.alive = false;
      body.material.color.set(0xa0a0a0);
    }

    // eat foods + grow if young
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      const dx2 = f.mesh.position.x - creature.pos.x;
      const dz2 = f.mesh.position.z - creature.pos.z;
      if ((dx2*dx2 + dz2*dz2) < (0.75*0.75)) {
        const gained = f.value * foodMul;
        creature.energy = clamp(creature.energy + gained, 0, 120);

        life.foodsEaten += 1;
        life.energyGained += gained;

        // baby/juvenile growth is driven by nutrition
        if (maturity < 1.0) maturity = clamp(maturity + gained * 0.0045, 0, 1);

        scene.remove(f.mesh);
        foods.splice(i, 1);
        spawnRing(creature.pos.x, creature.pos.z, true);
        flash = Math.max(flash, 0.7);
      }
    }

    // face velocity (+X)
    const sp3 = hypot2(creature.vx, creature.vz);
    if (sp3 > 0.05) organism.rotation.y = Math.atan2(-creature.vz, creature.vx);
  }

  // mate update
  const reproReady = creature.alive && isAdult() && creature.energy >= 110 && !draftOpen && !mate;
  if (reproReady) mateStatus = "ready (C to call)";
  if (!reproReady && !mate) mateStatus = "none";

  if (mate) {
    const mx = mate.mesh.position.x;
    const mz = mate.mesh.position.z;
    const dx = creature.pos.x - mx;
    const dz = creature.pos.z - mz;
    const dist = Math.sqrt(dx*dx + dz*dz);

    if (mate.state === "approaching") {
      mateStatus = `approaching (${dist.toFixed(1)}m)`;

      const dirx = dist > 1e-6 ? dx / dist : 0;
      const dirz = dist > 1e-6 ? dz / dist : 0;

      const mateAccel = 10.0;
      const mateDrag = 5.5;
      const mateMax = 4.4;

      mate.vx += dirx * mateAccel * dt;
      mate.vz += dirz * mateAccel * dt;

      mate.vx -= mate.vx * mateDrag * dt;
      mate.vz -= mate.vz * mateDrag * dt;

      const sp = hypot2(mate.vx, mate.vz);
      if (sp > mateMax) {
        mate.vx = (mate.vx / sp) * mateMax;
        mate.vz = (mate.vz / sp) * mateMax;
      }

      mate.mesh.position.x += mate.vx * dt;
      mate.mesh.position.z += mate.vz * dt;

      // begin bonding when close enough
      if (dist < 1.25) {
        mate.state = "bonding";
        mate.bondT = 0;
        mate.heartCd = 0;
        flash = Math.max(flash, 0.9);
      }
    } else if (mate.state === "bonding") {
      mateStatus = "bonding ♥";
      mate.bondT += dt;
      mate.heartCd -= dt;

      // keep mate close
      mate.mesh.position.x += dx * 0.9 * dt;
      mate.mesh.position.z += dz * 0.9 * dt;

      if (mate.heartCd <= 0) {
        mate.heartCd = 0.15;
        spawnHeartsAt((creature.pos.x + mate.mesh.position.x) * 0.5, (creature.pos.z + mate.mesh.position.z) * 0.5, 4);
      }

      if (mate.bondT >= 1.05) {
        mate.state = "done";
        spawnHeartsAt(creature.pos.x, creature.pos.z, 8);
        beginMating();
      }
    } else if (mate.state === "done") {
      mateStatus = "mated (choose mutation)";
    }
  }

  // animate rings
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

  // animate hearts
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

  flash = Math.max(0, flash - dt * 2.2);

  // grow/shrink visuals
  const s = stageScale(maturity);
  organism.scale.setScalar(s);

  // camera follow
  camera.position.copy(creature.pos).add(camOffset);
  camera.lookAt(creature.pos.x, 0.35, creature.pos.z);

  updateHud();

  const st = stageName(maturity);
  const state =
    !creature.alive ? "DEAD (R to reset)" :
    draftOpen ? "MUTATION DRAFT (1/2/3)" :
    (mate && mate.state === "bonding") ? "MATING…" :
    "roam / eat / grow";

  ui.status.textContent =
    `STATUS: ${PROJECT} ${BUILD} | v=${vParam} | fps=${fps.toFixed(0)} | gen=${generation} | ` +
    `stage=${st} | energy=${creature.energy.toFixed(1)} | foods=${foods.length} | mate=${mateStatus} | ${state}`;
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

let frameLast = performance.now();
function step(now) {
  const dt = Math.min(0.05, (now - frameLast) / 1000);
  frameLast = now;

  // fps smoothing
  const inst = 1 / Math.max(1e-6, dt);
  fps = fps * 0.9 + inst * 0.1;

  update(dt);
  draw();
  requestAnimationFrame(step);
}

resetWorld();
requestAnimationFrame(step);

// Call mate: press C once (Spacebar avoided)
window.addEventListener("keydown", (e) => {
  if (draftOpen) return;
  if (e.repeat) return;
  if ((e.key || "").toLowerCase() !== "c") return;

  const reproReady = creature.alive && isAdult() && creature.energy >= 110 && !mate;
  if (reproReady) spawnMate();
});
