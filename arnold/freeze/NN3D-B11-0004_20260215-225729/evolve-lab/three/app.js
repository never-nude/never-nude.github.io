import * as THREE from "../vendor/three.module.js";

const BUILD = "BUILD0002";
const PROJECT = "EVOLVE-LAB";

const $ = (id) => document.getElementById(id);

const vParam = new URLSearchParams(location.search).get("v") ?? "(none)";
$("vtag").textContent = vParam;
$("loadedAt").textContent = new Date().toLocaleString();
$("path").textContent = location.pathname;
$("rendererTag").textContent = `THREE r${THREE.REVISION}`;

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

// grid = perspective proof
const grid = new THREE.GridHelper(200, 200, 0x2a3342, 0x1b2230);
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

// ground for raycasting
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

// creature
const creature = { pos: new THREE.Vector3(0, 0.55, 0), vx: 0, vz: 0, energy: 60, alive: true };

const organism = new THREE.Group();
organism.position.copy(creature.pos);

// body
const body = new THREE.Mesh(
  new THREE.SphereGeometry(0.55, 32, 18),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 })
);
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

// click raycast to ground
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function clickSpawn(e) {
  const w = window.innerWidth, h = window.innerHeight;
  ndc.x = (e.clientX / Math.max(1, w)) * 2 - 1;
  ndc.y = -((e.clientY / Math.max(1, h)) * 2 - 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(ground, false)[0];
  if (hit) spawnFoodAt(hit.point.x, hit.point.z);
}
window.addEventListener("pointerdown", clickSpawn);

// undeniable input flash
let flash = 0;
window.addEventListener("pointerdown", () => { flash = Math.max(flash, 1.0); });

// reset
function reset() {
  creature.pos.set(0, 0.55, 0);
  creature.vx = 0; creature.vz = 0;
  creature.energy = 60;
  creature.alive = true;
  body.material.color.set(0xffffff);

  for (const f of foods) scene.remove(f.mesh);
  foods.length = 0;

  for (const r of rings) scene.remove(r.mesh);
  rings.length = 0;

  flash = 0;
}
window.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r") reset(); });

// sim
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function hypot2(x,z){ return Math.sqrt(x*x+z*z); }

let last = performance.now();
let fps = 0;

function update(dt) {
  const up = keys.has("w") || keys.has("arrowup");
  const dn = keys.has("s") || keys.has("arrowdown");
  const lf = keys.has("a") || keys.has("arrowleft");
  const rt = keys.has("d") || keys.has("arrowright");

  const ax = (rt ? 1 : 0) - (lf ? 1 : 0);
  const az = (dn ? 1 : 0) - (up ? 1 : 0);

  const sprint = keys.has("shift") && creature.alive;
  const accel = sprint ? 12.0 : 8.0;
  const maxSpeed = sprint ? 7.0 : 4.2;
  const drag = sprint ? 4.0 : 6.0;

  if (creature.alive) {
    creature.vx += ax * accel * dt;
    creature.vz += az * accel * dt;

    creature.vx -= creature.vx * drag * dt;
    creature.vz -= creature.vz * drag * dt;

    const sp = hypot2(creature.vx, creature.vz);
    if (sp > maxSpeed) {
      creature.vx = (creature.vx / sp) * maxSpeed;
      creature.vz = (creature.vz / sp) * maxSpeed;
    }

    creature.pos.x += creature.vx * dt;
    creature.pos.z += creature.vz * dt;

    // energy: motion + baseline (sprint costs more)
    creature.energy -= (0.22 + (sprint ? 0.25 : 0.0)) * sp * dt;
    creature.energy -= 0.35 * dt;
    creature.energy = clamp(creature.energy, 0, 120);

    if (creature.energy <= 0.01) {
      creature.alive = false;
      body.material.color.set(0xa0a0a0);
    }

    // eat
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      const dx = f.mesh.position.x - creature.pos.x;
      const dz = f.mesh.position.z - creature.pos.z;
      if ((dx*dx + dz*dz) < (0.75*0.75)) {
        creature.energy = clamp(creature.energy + f.value, 0, 120);
        scene.remove(f.mesh);
        foods.splice(i, 1);
        spawnRing(creature.pos.x, creature.pos.z, true);
        flash = Math.max(flash, 0.7);
      }
    }

    // face velocity (nose is +X)
    const sp2 = hypot2(creature.vx, creature.vz);
    if (sp2 > 0.05) organism.rotation.y = Math.atan2(-creature.vz, creature.vx);
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

  $("status").textContent =
    `STATUS: ${PROJECT} ${BUILD} (THREE r${THREE.REVISION}) | v=${vParam} | fps=${fps.toFixed(0)} | ` +
    `energy=${creature.energy.toFixed(1)} | foods=${foods.length} | alive=${creature.alive ? "yes" : "NO"} | sprint=SHIFT`;
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

reset();
requestAnimationFrame(step);
