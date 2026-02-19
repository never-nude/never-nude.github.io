const $ = (sel) => document.querySelector(sel);

async function fetchText(path) {
  const r = await fetch(path + "?ts=" + Date.now(), { cache: "no-store" });
  return await r.text();
}
async function fetchJSON(path) {
  const r = await fetch(path + "?ts=" + Date.now(), { cache: "no-store" });
  return await r.json();
}

const SIDE_FILL = { Blue: "#2563eb", Red: "#dc2626" };
const QUALITY_SHORT = { Green: "G", Regular: "R", Veteran: "V" };

// TEXT_SCALE_0_72: shrink on-token text by 28%
const TEXT_SCALE = 0.72;

// GENERALS_V1: HP=5; attack=adjacent only; 1d6 hit on 6; morale radius default 3
const DEFAULT_MORALE_RADIUS = 3;

const key = (r, c) => `${r},${c}`;

function oddrToCube(r, c) {
  const x = c - ((r - (r & 1)) / 2);
  const z = r;
  const y = -x - z;
  return { x, y, z };
}
function cubeDist(a, b) {
  return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2;
}
function hexDist(r1, c1, r2, c2) {
  return cubeDist(oddrToCube(r1, c1), oddrToCube(r2, c2));
}

function setupGame(layout, scenario) {
  const canvas = $("#hexCanvas");
  const ctx = canvas.getContext("2d");

  const hoverEl = $("#hoverInfo");
  const auraEl  = $("#auraInfo");
  const selEl   = $("#selectedInfo");

  $("#scenarioName").textContent = scenario?.name || "—";
  $("#unitCount").textContent = String(scenario?.units?.length ?? 0);

  const units = Array.isArray(scenario?.units) ? scenario.units : [];
  const unitByHex = new Map();
  for (const u of units) unitByHex.set(key(u.r, u.c), u);

  let selectedId = null;
  let hover = null;
  let drawn = [];
  let gLast = null;

  // computed only when selection changes
  let auraSet = null;  // Set<"r,c">
  let auraSide = null;

  function computeGeometry() {
    const cols = layout.cols;
    const rows = layout.rows;
    const dpr = window.devicePixelRatio || 1;

    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const margin = 18;
    const sqrt3 = Math.sqrt(3);

    const sW = (W - margin * 2) / ((cols + 0.5) * sqrt3);
    const sH = (H - margin * 2) / (1.5 * rows + 0.5);
    const s = Math.max(6, Math.min(30, Math.min(sW, sH)));

    const hexW = sqrt3 * s;
    const vStep = 1.5 * s;

    const boardW = (cols + 0.5) * hexW;
    const boardH = (rows - 1) * vStep + 2 * s;

    const offsetX = Math.max(margin, (W - boardW) / 2);
    const offsetY = Math.max(margin, (H - boardH) / 2);

    return { W, H, s, hexW, vStep, offsetX, offsetY };
  }

  function centerOf(r, c, g) {
    const cx = g.offsetX + (c * g.hexW) + ((r % 2) * g.hexW / 2) + g.hexW / 2;
    const cy = g.offsetY + (r * g.vStep) + g.s;
    return { cx, cy };
  }

  function hexPath(cx, cy, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30);
      const x = cx + s * Math.cos(ang);
      const y = cy + s * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function isGeneral(u) {
    return !!u && (u.type === "GEN" || u.isGeneral === true);
  }

  function computeAuraForSelected() {
    auraSet = null;
    auraSide = null;
    auraEl.textContent = "";

    if (!selectedId) return;
    const u = units.find(x => x.id === selectedId);
    if (!u || !isGeneral(u)) return;

    const radius = (typeof u.moraleRadius === "number") ? u.moraleRadius : DEFAULT_MORALE_RADIUS;
    auraSide = u.side;
    auraEl.textContent = `aura: ${radius}`;

    const set = new Set();
    for (const h of layout.hexes) {
      if (hexDist(u.r, u.c, h.r, h.c) <= radius) set.add(key(h.r, h.c));
    }
    auraSet = set;
  }

  function updateSelectedPanel() {
    if (!selectedId) {
      selEl.textContent = "Selected: —\n(click a unit token)";
      auraSet = null; auraSide = null; auraEl.textContent = "";
      return;
    }

    const u = units.find(x => x.id === selectedId);
    if (!u) {
      selectedId = null;
      selEl.textContent = "Selected: —\n(click a unit token)";
      auraSet = null; auraSide = null; auraEl.textContent = "";
      return;
    }

    const lines = [
      "Selected",
      `ID: ${u.id}`,
      `Side: ${u.side}`,
      `Type: ${u.type}`,
      `Quality: ${u.quality ?? "—"}`,
      `HP: ${u.hp}/${u.maxHp}`,
      `Hex: row ${u.r}, col ${u.c}`,
    ];

    if (isGeneral(u)) {
      const radius = (typeof u.moraleRadius === "number") ? u.moraleRadius : DEFAULT_MORALE_RADIUS;
      const atk = u.attack || {};
      const hitOn = Array.isArray(atk.hitOn) ? atk.hitOn.join(",") : "6";
      lines.push(`Morale radius: ${radius}`);
      lines.push(`Attack: adjacent | 1d6 | hit on ${hitOn}`);
      lines.push(`(attack rule recorded; combat not active yet)`);
    }

    selEl.textContent = lines.join("\n");
    computeAuraForSelected();
  }

  function drawUnitToken(u, g) {
  // TOKEN_UI_V5_SHAPE_ABBR_HP: type=shape+abbr, hp=center, quality=outline style FONT_SCALE_0_432
  const { cx, cy } = centerOf(u.r, u.c, g);
  const R = g.s * 0.82;
  const isSel = (selectedId === u.id);

  // 28% smaller text (same shrink you requested)
  const S = 0.432; // 40% smaller (0.72 * 0.6)
const tUp = String(u.type || "").toUpperCase();
  const MAP = {
    "INF":"INF","INFANTRY":"INF",
    "CAV":"CAV","CAVALRY":"CAV",
    "SKR":"SKR","SKIRMISHER":"SKR","SKIRMISHERS":"SKR",
    "ARC":"ARC","ARCHER":"ARC","ARCHERS":"ARC",
    "SLG":"SLG","SLINGER":"SLG","SLINGERS":"SLG",
    "GEN":"GEN","GENERAL":"GEN","GENERALS":"GEN"
  };
  const abbr = MAP[tUp] || tUp.replace(/[^A-Z]/g,"").slice(0,3) || "???";

  function roundedRectPath(x, y, w, h, r) {
    const rr = Math.max(2, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function starPath(cx, cy, spikes, outerR, innerR) {
    ctx.beginPath();
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
  }

  function makePath() {
    if (abbr === "INF") {
      roundedRectPath(cx - R*0.78, cy - R*0.58, R*1.56, R*1.16, R*0.22);
      return;
    }
    if (abbr === "CAV") {
      ctx.beginPath();
      ctx.moveTo(cx, cy - R*0.88);
      ctx.lineTo(cx + R*0.88, cy);
      ctx.lineTo(cx, cy + R*0.88);
      ctx.lineTo(cx - R*0.88, cy);
      ctx.closePath();
      return;
    }
    if (abbr === "SKR" || abbr === "SLG") {
      ctx.beginPath();
      ctx.moveTo(cx, cy - R*0.92);
      ctx.lineTo(cx + R*0.86, cy + R*0.80);
      ctx.lineTo(cx - R*0.86, cy + R*0.80);
      ctx.closePath();
      return;
    }
    if (abbr === "GEN") {
      starPath(cx, cy, 5, R*0.92, R*0.42);
      return;
    }
    // ARC + fallback
    ctx.beginPath();
    ctx.arc(cx, cy, R*0.82, 0, Math.PI * 2);
    ctx.closePath();
  }

  // fill
  makePath();
  ctx.fillStyle = SIDE_FILL[u.side] || "#666";
  ctx.fill();

  // quality outline style (this is the "Green/Reg/Vet status" display)
  const q = (u.quality || "Regular");
  ctx.save();
  if (q === "Green") {
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 2;
  } else if (q === "Veteran") {
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
  } else {
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
  }
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  makePath();
  ctx.stroke();
  ctx.restore();

  // selection outline
  if (isSel) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111111";
    makePath();
    ctx.stroke();
    ctx.restore();
  }

  // text: abbr (small) + HP (big)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";

  const abFont = Math.max(4, Math.round(g.s * 0.38 * S));
const hpFont = Math.max(5, Math.round(g.s * 0.84 * S));
ctx.font = `800 ${abFont}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New"`;
  ctx.fillText(abbr, cx, cy - R * 0.30);

  ctx.font = `900 ${hpFont}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
  ctx.fillText(String(u.hp), cx, cy + R * 0.20);
}



  function render() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const g = computeGeometry();
    gLast = g;

    ctx.clearRect(0, 0, g.W, g.H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, g.W, g.H);

    drawn = layout.hexes.map(({ r, c }) => {
      const { cx, cy } = centerOf(r, c, g);
      return { r, c, cx, cy };
    });

    const auraFill =
      auraSide === "Red" ? "rgba(220,38,38,0.14)" :
      auraSide === "Blue" ? "rgba(37,99,235,0.14)" :
      null;

    // hexes
    ctx.lineWidth = 1;
    for (const h of drawn) {
      const isHover = hover && (hover.r === h.r) && (hover.c === h.c);
      const inAura = auraSet && auraSet.has(key(h.r, h.c));

      hexPath(h.cx, h.cy, g.s);
      let fill = "#f7f7f7";
      if (inAura && auraFill) fill = auraFill;
      if (isHover) fill = "#e6f2ff";

      ctx.fillStyle = fill;
      ctx.strokeStyle = isHover ? "#2563eb" : "#b0b0b0";
      ctx.fill();
      ctx.stroke();
    }

    // units
    for (const u of units) drawUnitToken(u, g);

    ctx.fillStyle = "#666";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText(`Diadem: generals + aura (select GEN)`, 12, g.H - 12);
  }

  function pickHex(mx, my) {
    if (!gLast || drawn.length === 0) return null;

    let best = null;
    let bestD = Infinity;
    for (const h of drawn) {
      const dx = mx - h.cx;
      const dy = my - h.cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = h; }
    }
    const thresh = (gLast.s * 1.08) * (gLast.s * 1.08);
    return (best && bestD <= thresh) ? best : null;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    render();
  }

  canvas.addEventListener("mousemove", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;

    const h = pickHex(mx, my);
    const changed = (!hover && h) || (hover && !h) || (hover && h && (hover.r !== h.r || hover.c !== h.c));
    if (!changed) return;

    hover = h;
    hoverEl.textContent = hover ? `hover: row ${hover.r}, col ${hover.c}` : "hover: —";
    render();
  });

  canvas.addEventListener("mouseleave", () => {
    hover = null;
    hoverEl.textContent = "hover: —";
    render();
  });

  canvas.addEventListener("click", (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;

    const h = pickHex(mx, my);
    if (!h) {
      selectedId = null;
      updateSelectedPanel();
      render();
      return;
    }

    const u = unitByHex.get(key(h.r, h.c));
    selectedId = u ? u.id : null;
    updateSelectedPanel();
    render();
  });

  window.addEventListener("resize", resize);

  hoverEl.textContent = "hover: —";
  updateSelectedPanel();
  resize();
}

async function main() {
  try {
    const truth = (await fetchText("TRUTH.txt")).trim();
    $("#truth").textContent = truth || "(TRUTH empty)";
  } catch {
    $("#truth").textContent = "TRUTH.txt failed to load";
  }

  const layout = await fetchJSON("board_layout.json");
  const scenario = await fetchJSON("scenario.json");
  setupGame(layout, scenario);
}

main();
