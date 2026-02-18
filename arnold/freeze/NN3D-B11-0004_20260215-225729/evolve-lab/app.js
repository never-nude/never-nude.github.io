const BUILD = "BUILD0001";
const PROJECT = "EVOLVE-LAB";
const $ = (id) => document.getElementById(id);

const vParam = new URLSearchParams(location.search).get("v") ?? "(none)";
$("vtag").textContent = vParam;
$("loadedAt").textContent = new Date().toLocaleString();
$("path").textContent = location.pathname;

const canvas = $("c");
const ctx = canvas.getContext("2d", { alpha: false });

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// input
const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
const pointer = { x: W * 0.5, y: H * 0.5, down: false };
window.addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener("pointerdown", () => { pointer.down = true; });
window.addEventListener("pointerup", () => { pointer.down = false; });

const creature = { x: W*0.5, y: H*0.5, vx: 0, vy: 0, r: 14, energy: 60, alive: true };
const foods = [];
const rings = [];
function spawnFood(x, y) { foods.push({ x, y, r: 6, value: 18 }); rings.push({ x, y, t: 0 }); }
window.addEventListener("pointerdown", (e) => spawnFood(e.clientX, e.clientY));

let screenFlash = 0;
window.addEventListener("pointerdown", () => { screenFlash = 1.0; });

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function hypot(x,y){ return Math.sqrt(x*x+y*y); }

let last = performance.now();
let fps = 0;

function update(dt) {
  creature.x = clamp(creature.x, 0, W);
  creature.y = clamp(creature.y, 0, H);
  if (!creature.alive) return;

  const up = keys.has("w") || keys.has("arrowup");
  const dn = keys.has("s") || keys.has("arrowdown");
  const lf = keys.has("a") || keys.has("arrowleft");
  const rt = keys.has("d") || keys.has("arrowright");

  const ax = (rt ? 1 : 0) - (lf ? 1 : 0);
  const ay = (dn ? 1 : 0) - (up ? 1 : 0);

  const sprint = pointer.down;
  const accel = sprint ? 900 : 620;
  const maxSpeed = sprint ? 420 : 260;
  const drag = sprint ? 7.0 : 9.5;

  creature.vx += ax * accel * dt;
  creature.vy += ay * accel * dt;
  creature.vx -= creature.vx * drag * dt;
  creature.vy -= creature.vy * drag * dt;

  const sp = hypot(creature.vx, creature.vy);
  if (sp > maxSpeed) {
    creature.vx = (creature.vx / sp) * maxSpeed;
    creature.vy = (creature.vy / sp) * maxSpeed;
  }

  creature.x += creature.vx * dt;
  creature.y += creature.vy * dt;

  creature.energy -= (0.020 + (sprint ? 0.030 : 0.0)) * sp * dt;
  creature.energy -= 0.30 * dt;

  for (let i = foods.length - 1; i >= 0; i--) {
    const f = foods[i];
    const d = hypot(f.x - creature.x, f.y - creature.y);
    if (d < creature.r + f.r + 6) {
      creature.energy += f.value;
      foods.splice(i, 1);
      rings.push({ x: f.x, y: f.y, t: 0, eat: true });
      screenFlash = Math.max(screenFlash, 0.6);
    }
  }

  creature.energy = clamp(creature.energy, 0, 120);
  if (creature.energy <= 0.01) creature.alive = false;

  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 0.6) rings.splice(i, 1); }
  screenFlash = Math.max(0, screenFlash - dt * 2.2);

  $("status").textContent =
    `STATUS: ${PROJECT} ${BUILD} | v=${vParam} | fps=${fps.toFixed(0)} | ` +
    `energy=${creature.energy.toFixed(1)} | foods=${foods.length} | alive=${creature.alive ? "yes" : "NO (energy=0)"}`;
}

function draw() {
  const flash = screenFlash;
  const base = 8 + Math.floor(40 * flash);
  ctx.fillStyle = `rgb(${base},${base+2},${base+8})`;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  const grid = 48;
  ctx.beginPath();
  for (let x = 0; x <= W; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += grid) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.globalAlpha = 1;

  for (const f of foods) {
    ctx.beginPath();
    ctx.fillStyle = "rgb(160, 255, 170)";
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const r of rings) {
    const p = r.t / 0.6;
    const radius = 10 + p * 90;
    const alpha = (1 - p) * (r.eat ? 0.9 : 0.75);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.strokeStyle = r.eat ? "rgb(255, 230, 140)" : "rgb(120, 200, 255)";
    ctx.lineWidth = r.eat ? 4 : 3;
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(creature.x, creature.y);
  const ang = Math.atan2(creature.vy, creature.vx);
  ctx.rotate(isFinite(ang) ? ang : 0);

  ctx.beginPath();
  ctx.fillStyle = creature.alive ? "rgb(255, 255, 255)" : "rgb(160, 160, 160)";
  ctx.arc(0, 0, creature.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "rgb(60, 60, 90)";
  ctx.arc(creature.r * 0.62, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.strokeStyle = "rgb(200, 220, 255)";
  ctx.lineWidth = 4;
  ctx.moveTo(-creature.r * 0.6, 0);
  ctx.lineTo(-creature.r * 1.6, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();

  const barW = 240, barH = 14;
  const x = 12, y = H - 12 - barH - 44;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = "rgb(120, 220, 255)";
  ctx.fillRect(x, y, barW * (creature.energy / 120), barH);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.strokeRect(x, y, barW, barH);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.fillText(`${PROJECT} ${BUILD}`, x, y - 10);
}

function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps = fps * 0.9 + (1 / Math.max(1e-6, dt)) * 0.1;
  update(dt);
  draw();
  requestAnimationFrame(step);
}
requestAnimationFrame(step);
