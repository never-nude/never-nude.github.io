import * as THREE from "../vendor/three.module.js";

const BUILD = "BUILD0006";
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
  lineTag: $("lineTag"),
  socTag: $("socTag"),
  herdTag: $("herdTag"),
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
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hypot2(x, z) { return Math.sqrt(x*x + z*z); }
function rand(a, b) { return a + Math.random() * (b - a); }
function mix(a, b, t) { return a*(1-t) + b*t; }

// Gaussian-ish jitter
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

// ----- Genome (trait vector) -----
let genome = {
  speed: 1.0,
  efficiency: 1.0,
  digestion: 1.0,
  social: 0.55, // 0=loner predator vibe, 1=flock/packs vibe
};

let generation = 1;
let lastMutationName = "(none)";
let lastMutationTint = 0xc8dcff;

// ----- Lineage / phenotype tags (species + “breed”) -----
let lineage = {
  species: "A",        // "A" | "B" | "AB"
  breed: "Neutral",
  bodyColor: 0xffffff, // reflects breed/species
  morph: { tailLen: 1.0, nose: 1.0 },
};

function speciesDistance(a, b) {
  if (a === b) return 0;
  if (a === "AB" || b === "AB") return 0.5;
  return 1;
}
function offspringSpecies(a, b) {
  if (a === b) return a;
  if (a === "AB" || b === "AB") return "AB";
  return "AB";
}

function traitsString() {
  return `spd=${genome.speed.toFixed(2)} eff=${genome.efficiency.toFixed(2)} dig=${genome.digestion.toFixed(2)} soc=${genome.social.toFixed(2)}`;
}

// ----- Life stage -----
let maturity = 1.0; // adult start
function stageName(m) {
  if (m < 0.35) return "BABY";
  if (m < 0.85) return "JUVENILE";
  return "ADULT";
}
function stageScale(m) {
  return 0.55 + 0.45 * clamp(m, 0, 1);
}
function isAdult() { return maturity >= 0.92; }

// ----- Creature -----
const creature = {
  pos: new THREE.Vector3(0, 0.55, 0),
  vx: 0,
  vz: 0,
  energy: 60,
  alive: true,
};

// Visuals
const organism = new THREE.Group();
organism.position.copy(creature.pos);

// Body shows lineage (breed/species)
const bodyMat = new THREE.MeshStandardMaterial({ color: lineage.bodyColor, roughness: 0.35, metalness: 0.05 });
const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 18), bodyMat);
organism.add(body);

// Nose (small)
const noseMat = new THREE.MeshStandardMaterial({ color: 0x3c3c5a, roughness: 0.8, metalness: 0.0 });
const nose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), noseMat);
nose.position.set(0.42, 0.05, 0);
organism.add(nose);

// Tail shows mutation tint (so lineage color remains readable)
const tailMat = new THREE.MeshStandardMaterial({
  color: lastMutationTint,
  roughness: 0.9,
  metalness: 0.0,
  transparent: true,
  opacity: 0.85
});
const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 14), tailMat);
tail.rotation.z = Math.PI / 2;
tail.position.set(-0.85, 0, 0);
organism.add(tail);

scene.add(organism);

function applyPhenotype() {
  body.material.color.setHex(lineage.bodyColor);
  tail.material.color.setHex(lastMutationTint);

  // Simple morph knobs (visible but not noisy)
  tail.scale.set(1, lineage.morph.tailLen, 1);
  nose.scale.setScalar(lineage.morph.nose);
}

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

// Click raycast -> spawn food (disabled during overlay)
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

// ----- Social herd (boids) -----
const herd = []; // { mesh, vx, vz }
const HERD_N = 18;

let herdTime = 0;
let herdNearest = 999;
let socialComfort = 0;          // [-1..+1]
let socialBurnMulFactor = 1.0;  // multiplies energy burn

const herdGeom = new THREE.SphereGeometry(0.32, 18, 12);
const herdMatBase = new THREE.MeshStandardMaterial({ color: 0xdfe6f2, roughness: 0.75, metalness: 0.0 });

function clearHerd() {
  for (const b of herd) scene.remove(b.mesh);
  herd.length = 0;
}

function spawnHerd() {
  clearHerd();
  for (let i = 0; i < HERD_N; i++) {
    const m = herdMatBase.clone();
    // tiny per-member tint so they feel like individuals
    const tint = mixHex(0xdfe6f2, 0xa0ffaa, Math.random() * 0.12);
    m.color.setHex(tint);

    const mesh = new THREE.Mesh(herdGeom, m);
    const ang = Math.random() * Math.PI * 2;
    const dist = 7 + Math.random() * 7;
    mesh.position.set(Math.cos(ang) * dist, 0.32, Math.sin(ang) * dist);
    scene.add(mesh);

    herd.push({
      mesh,
      vx: rand(-1.2, 1.2),
      vz: rand(-1.2, 1.2),
    });
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
  // near=1 when inside 0m, near=0 when >=6m away
  const near = clamp(1 - nearestDist / 6.0, 0, 1);

  // pref=-1 loner, +1 social
  const pref = (genome.social - 0.5) * 2;

  // comfort: social creatures feel better near; loners feel better far.
  const comfort = clamp(pref * (near * 2 - 1), -1, 1);

  // Convert comfort into a small but noticeable burn multiplier.
  // comfort +1 => burn ~ 0.88x ; comfort -1 => burn ~ 1.12x
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
  const attract = clamp((genome.social - 0.65) / 0.35, 0, 1); // only when pretty social

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
        // push away strongly when too close
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

      // Weights tuned for visible flocking without exploding.
      ax += sepX * 2.2;
      az += sepZ * 2.2;

      ax += (alignX - bi.vx) * 0.55;
      az += (alignZ - bi.vz) * 0.55;

      ax += cohX * 0.22;
      az += cohZ * 0.22;
    }

    // Gentle wander goal
    ax += (goalX - px) * 0.05;
    az += (goalZ - pz) * 0.05;

    // Soft bounds (keep herd in a reasonable radius)
    const r2 = px*px + pz*pz;
    if (r2 > 28*28) {
      ax += (-px) * 0.08;
      az += (-pz) * 0.08;
    }

    // Player influence:
    // - loner => herd flees strongly
    // - social => herd tolerates you; very social => mild attraction (you can "join")
    const dxp = creature.pos.x - px;
    const dzp = creature.pos.z - pz;
    const dp2 = dxp*dxp + dzp*dzp;
    const fleeR = 8.0;
    if (dp2 < fleeR * fleeR) {
      const dp = Math.sqrt(dp2) || 1e-6;
      const t = 1 - (dp / fleeR);
      const awayX = -dxp / dp;
      const awayZ = -dzp / dp;

      // Flee scales with (1-social)
      ax += awayX * (fear * (8.0 * t));
      az += awayZ * (fear * (8.0 * t));

      // Attraction only when social is high
      ax += (dxp / dp) * (attract * (2.2 * t));
      az += (dzp / dp) * (attract * (2.2 * t));
    }

    // Integrate
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

    if (sp > 0.05) {
      bi.mesh.rotation.y = Math.atan2(-bi.vz, bi.vx);
    }
  }
}

// Quick debug: [ and ] adjust sociability so the effect is undeniable
window.addEventListener("keydown", (e) => {
  if (draftOpen) return;
  if (e.repeat) return;
  if (e.key === "[") {
    genome.social = clamp(genome.social - 0.05, 0, 1);
    flash = Math.max(flash, 0.65);
  }
  if (e.key === "]") {
    genome.social = clamp(genome.social + 0.05, 0, 1);
    flash = Math.max(flash, 0.65);
  }
});

// ----- Hearts (cute + undeniable) -----
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

// ----- Mate choice system (B1) -----
const mates = []; // mate objects
let mateStatus = "none";
let selectedMate = null;

function mateLabel(m) {
  return `${m.breed}[${m.species}]`;
}

function makeMateCandidate({ species, breed, color, genomeBias, morphBias, slot }) {
  const geom = new THREE.SphereGeometry(0.48, 28, 16);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.02 });
  const mesh = new THREE.Mesh(geom, mat);

  const ang = Math.random() * Math.PI * 2;
  const dist = 9 + Math.random() * 5;
  mesh.position.set(
    creature.pos.x + Math.cos(ang) * dist,
    0.48,
    creature.pos.z + Math.sin(ang) * dist
  );

  // genome biases make mate choice meaningful
  const g = {
    speed:      clamp(1.0 + (genomeBias.speed ?? 0) + randn()*0.04, 0.70, 1.60),
    efficiency: clamp(1.0 + (genomeBias.efficiency ?? 0) + randn()*0.04, 0.70, 1.60),
    digestion:  clamp(1.0 + (genomeBias.digestion ?? 0) + randn()*0.04, 0.70, 1.60),
    social:     clamp(0.55 + (genomeBias.social ?? 0) + randn()*0.06, 0.00, 1.00),
  };

  const morph = {
    tailLen: clamp(1.0 + (morphBias.tailLen ?? 0) + randn()*0.06, 0.70, 1.55),
    nose:    clamp(1.0 + (morphBias.nose ?? 0)    + randn()*0.05, 0.75, 1.40),
  };

  scene.add(mesh);

  return {
    mesh, species, breed, color,
    genome: g,
    morph,
    slot,
    state: "approaching", // approaching -> offering -> bonding -> done OR shame
    vx: 0, vz: 0,
    offerT: 0,
    bondT: 0,
    heartCd: 0,
    shameT: 0,
    shameSeed: Math.random() * Math.PI * 2,
    shameSign: Math.random() < 0.5 ? -1 : 1,
    dead: false,
  };
}

function spawnMateCandidates() {
  if (mates.length > 0) return;

  const mA = makeMateCandidate({
    species: "A",
    breed: "Azure",
    color: 0x66aaff,
    genomeBias: { speed: +0.12, efficiency: -0.05, digestion: -0.02, social: +0.18 }, // pack-runner vibe
    morphBias: { tailLen: +0.18, nose: +0.02 },
    slot: 0,
  });

  const mB = makeMateCandidate({
    species: "B",
    breed: "Amber",
    color: 0xffaa55,
    genomeBias: { speed: -0.04, efficiency: +0.03, digestion: +0.14, social: -0.22 }, // loner forager vibe
    morphBias: { tailLen: -0.02, nose: -0.02 },
    slot: 1,
  });

  mates.push(mA, mB);
  mateStatus = `candidates: ${mateLabel(mA)} / ${mateLabel(mB)}`;
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

  // Auto-reject the other candidate (cute shame zigzag)
  for (const other of mates) {
    if (other !== m && !other.dead) setShame(other);
  }

  mateStatus = `bonding with ${mateLabel(m)}`;
  flash = Math.max(flash, 0.9);
}

function rejectNearest() {
  let m = nearestMate(mm => mm.state === "offering");
  if (!m) m = nearestMate(mm => mm.state === "approaching");
  if (!m) return;

  setShame(m);

  if (selectedMate === m) selectedMate = null;
  mateStatus = `rejected ${mateLabel(m)} (zigzag shame)`;
}

function updateMate(m, dt) {
  if (m.dead) return;

  const mx = m.mesh.position.x;
  const mz = m.mesh.position.z;
  const dx = creature.pos.x - mx;
  const dz = creature.pos.z - mz;
  const dist = Math.sqrt(dx*dx + dz*dz);

  if (m.state === "approaching") {
    // steer toward player
    const dirx = dist > 1e-6 ? dx / dist : 0;
    const dirz = dist > 1e-6 ? dz / dist : 0;

    const mateAccel = 10.0;
    const mateDrag = 5.5;
    const mateMax = 4.4;

    m.vx += dirx * mateAccel * dt;
    m.vz += dirz * mateAccel * dt;

    m.vx -= m.vx * mateDrag * dt;
    m.vz -= m.vz * mateDrag * dt;

    const sp = hypot2(m.vx, m.vz);
    if (sp > mateMax) {
      m.vx = (m.vx / sp) * mateMax;
      m.vz = (m.vz / sp) * mateMax;
    }

    m.mesh.position.x += m.vx * dt;
    m.mesh.position.z += m.vz * dt;

    if (dist < 1.55) {
      m.state = "offering";
      m.offerT = 0;
      m.vx = 0; m.vz = 0;
      flash = Math.max(flash, 0.7);
    }

  } else if (m.state === "offering") {
    m.offerT += dt;

    const t = offeringTarget(m.slot);
    m.mesh.position.x += (t.x - m.mesh.position.x) * (6.0 * dt);
    m.mesh.position.z += (t.z - m.mesh.position.z) * (6.0 * dt);
    m.mesh.position.y = 0.48 + Math.sin(m.offerT * 6.0) * 0.03;

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
    const zig = Math.sin(m.shameT * 10.0 + m.shameSeed) * 1.1 * m.shameSign;

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

// ----- Recombination (you + mate) + mutation draft -----
let pendingOffspring = null; // { genome, lineage, mateInfo }
let babyPreview = null;
const babyPreviewPos = new THREE.Vector3();

function recombineGenome(g1, g2, dist) {
  const sigma = 0.02 + 0.07 * dist; // cross-species => higher variance
  const out = {
    speed:      clamp((g1.speed + g2.speed) * 0.5 + randn() * sigma, 0.65, 1.75),
    efficiency: clamp((g1.efficiency + g2.efficiency) * 0.5 + randn() * sigma, 0.65, 1.75),
    digestion:  clamp((g1.digestion + g2.digestion) * 0.5 + randn() * sigma, 0.65, 1.75),
    social:     clamp((g1.social + g2.social) * 0.5 + randn() * (sigma * 0.9), 0.00, 1.00),
  };
  return out;
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
      apply: (g) => { g.speed *= 1.12; g.efficiency *= 0.96; },
      tint: 0x78c8ff,
    },
    {
      id: "digestion",
      name: "Gut Flora Bloom",
      meta: "+Digestion  (more energy per food)\n-Tradeoff: slightly slower",
      apply: (g) => { g.digestion *= 1.15; g.speed *= 0.97; },
      tint: 0xa0ffaa,
    },
    {
      id: "efficiency",
      name: "Frugal Cells",
      meta: "+Efficiency  (less energy burn)\n-Tradeoff: slightly less digestion",
      apply: (g) => { g.efficiency *= 1.15; g.digestion *= 0.97; },
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
    `Hybrid cross: ${hybridText}\n\n` +
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

  // clamp after mutation
  g.speed = clamp(g.speed, 0.60, 1.90);
  g.efficiency = clamp(g.efficiency, 0.60, 1.90);
  g.digestion = clamp(g.digestion, 0.60, 1.90);
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

  genome = { speed: 1.0, efficiency: 1.0, digestion: 1.0, social: 0.55 };
  generation = 1;
  maturity = 1.0;
  lastMutationName = "(none)";
  lastMutationTint = 0xc8dcff;

  lineage = { species: "A", breed: "Neutral", bodyColor: 0xffffff, morph: { tailLen: 1.0, nose: 1.0 } };

  for (const f of foods) scene.remove(f.mesh);
  foods.length = 0;

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

  spawnHerd();
  herdNearest = measureHerdNearest(creature.pos);
  ({ comfort: socialComfort, factor: socialBurnMulFactor } = computeSocialFactors(herdNearest));

  applyPhenotype();
  updateHud();
}

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") resetWorld();
});

// ----- Derived movement params -----
function derivedParams() {
  const g = stageScale(maturity);
  const accel = 8.0 * genome.speed * g;
  const maxSpeed = 4.2 * genome.speed * g;

  const burnMul = (1.0 / genome.efficiency) * socialBurnMulFactor;
  const foodMul = genome.digestion;

  return { accel, maxSpeed, burnMul, foodMul };
}

// ----- HUD -----
function updateHud() {
  ui.genTag.textContent = String(generation);
  ui.stageTag.textContent = `${stageName(maturity)} (${Math.round(maturity * 100)}%)`;

  ui.lineTag.textContent = `${lineage.species} | ${lineage.breed}`;

  const comfortTxt = `${socialComfort >= 0 ? "+" : ""}${socialComfort.toFixed(2)}`;
  ui.socTag.textContent = `${genome.social.toFixed(2)}  comfort=${comfortTxt}  burn×${socialBurnMulFactor.toFixed(2)}`;

  const nearTxt = herdNearest > 98 ? "∞" : herdNearest.toFixed(1);
  ui.herdTag.textContent = `n=${herd.length}  nearest=${nearTxt}`;

  ui.traitsTag.textContent = traitsString();
  ui.lastTag.textContent = lastMutationName;
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
    if (offering) {
      acceptNearestOffering();
      return;
    }
    if (reproReady) {
      spawnMateCandidates();
      return;
    }
  }

  if (k === "x") {
    rejectNearest();
  }
});

// ----- Main loop -----
let frameLast = performance.now();
let fps = 0;
let flash = 0;

function update(dt) {
  // Social comfort based on current herd proximity (used for energy burn)
  herdNearest = measureHerdNearest(creature.pos);
  ({ comfort: socialComfort, factor: socialBurnMulFactor } = computeSocialFactors(herdNearest));

  const { accel, maxSpeed, burnMul, foodMul } = derivedParams();

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

  // Update mates
  for (const m of mates) updateMate(m, dt);
  for (let i = mates.length - 1; i >= 0; i--) {
    if (mates[i].dead) mates.splice(i, 1);
  }

  // Mate status
  const ready = creature.alive && isAdult() && creature.energy >= 110 && mates.length === 0 && !draftOpen;
  if (mates.length === 0) mateStatus = ready ? "ready (C to call)" : "none";
  else {
    const offeringCount = mates.filter(m => m.state === "offering").length;
    const bonding = mates.some(m => m.state === "bonding");
    if (bonding) mateStatus = `bonding ♥ (mutation next)`;
    else if (offeringCount > 0) mateStatus = `offering: C accept / X reject`;
    else mateStatus = `approaching (${mates.length})`;
  }

  // Update herd (after movement so they react to where you ended up)
  updateHerd(dt);

  // Refresh comfort for HUD after herd movement (doesn't affect this frame's burn)
  herdNearest = measureHerdNearest(creature.pos);
  ({ comfort: socialComfort, factor: socialBurnMulFactor } = computeSocialFactors(herdNearest));

  // Animate rings
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

  // Animate hearts
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

  // growth visuals
  organism.scale.setScalar(stageScale(maturity));

  // camera follow (world-fixed offset for now; behind-pivot is next option)
  camera.position.copy(creature.pos).add(camOffset);
  camera.lookAt(creature.pos.x, 0.35, creature.pos.z);

  applyPhenotype();
  updateHud();

  const state =
    !creature.alive ? "DEAD (R to reset)" :
    draftOpen ? "MUTATION DRAFT (1/2/3)" :
    (mates.length > 0 ? "mate choice active" : "roam / eat / herd");

  ui.status.textContent =
    `STATUS: ${PROJECT} ${BUILD} | v=${vParam} | fps=${fps.toFixed(0)} | gen=${generation} | ` +
    `stage=${stageName(maturity)} | energy=${creature.energy.toFixed(1)} | foods=${foods.length} | mate=${mateStatus} | ${state}`;
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
