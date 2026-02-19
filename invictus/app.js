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
const key = (r, c) => `${r},${c}`;

// TOKEN_UI: shape + 3-letter abbr + HP + quality outline
// Font is 40% smaller than prior baseline: SCALE = 0.432
const TOKEN_TEXT_SCALE = 0.432;

// Movement milestone E
const ACTIVATIONS_PER_TURN = 3;
const MOVE_RANGE = { INF:2, ARC:2, GEN:2, CAV:3, SKR:3, SLG:3 };

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

// odd-r neighbor list (must match board generation)
function neighbors6(r, c) {
  if (r % 2 === 0) {
    return [
      [r, c-1], [r, c+1],
      [r-1, c-1], [r-1, c],
      [r+1, c-1], [r+1, c],
    ];
  } else {
    return [
      [r, c-1], [r, c+1],
      [r-1, c], [r-1, c+1],
      [r+1, c], [r+1, c+1],
    ];
  }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function setupGame(layout, scenario) {
  const canvas = $("#hexCanvas");
  const ctx = canvas.getContext("2d");

  const hoverEl  = $("#hoverInfo");
  const auraEl   = $("#auraInfo");
  const statusEl = $("#statusLine");

  const turnEl   = $("#turnSide");
  const actsEl   = $("#actsUsed");

  const selEl    = $("#selectedInfo");
  const endBtn   = $("#endTurnBtn");
  const resetBtn = $("#resetBtn");

  $("#scenarioName").textContent = scenario?.name || "—";

  const liveSet = new Set(layout.hexes.map(h => key(h.r, h.c)));

  // State
  const initialUnits = Array.isArray(scenario?.units) ? scenario.units : [];

  // UNITCOUNT_DYNAMIC
  const uc = document.querySelector('#unitCount');
  if (uc) uc.textContent = String(initialUnits.length);

  let units = deepClone(initialUnits);

  // UNITCOUNT_PATCH
  const ucEl = document.querySelector('#unitCount');
  if (ucEl) ucEl.textContent = String(units.length);


  let turnSide = "Blue";
  let activationsUsed = 0;

  let selectedId = null;
  let hover = null;

  // derived per-render
  let drawn = [];
  let gLast = null;

  // overlays
  let auraSet = null;      // Set<"r,c">
  let auraSide = null;     // "Blue"/"Red"/null
  let moveSet = null;      // Set<"r,c"> reachable, empty

  function unitById(id) {
    return units.find(u => u.id === id) || null;
  }
  function unitAt(r, c) {
    for (const u of units) if (u.r === r && u.c === c) return u;
    return null;
  }
  function occupiedSet(exceptId=null) {
    const s = new Set();
    for (const u of units) {
      if (exceptId && u.id === exceptId) continue;
      s.add(key(u.r, u.c));
    }
    return s;
  }

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
    return !!u && String(u.type).toUpperCase() === "GEN";
  }

  function computeAuraForSelected() {
    auraSet = null;
    auraSide = null;
    auraEl.textContent = "";

    const u = selectedId ? unitById(selectedId) : null;
    if (!u || !isGeneral(u)) return;

    const radius = (typeof u.moraleRadius === "number") ? u.moraleRadius : 3;
    auraSide = u.side;
    auraEl.textContent = `aura: ${radius}`;

    const set = new Set();
    for (const h of layout.hexes) {
      if (hexDist(u.r, u.c, h.r, h.c) <= radius) set.add(key(h.r, h.c));
    }
    auraSet = set;
  }

  function computeMoveSetForSelected() {
    moveSet = null;

    const u = selectedId ? unitById(selectedId) : null;
    if (!u) return;

    // Only preview moves for current side, and only if you have activations left
    if (u.side !== turnSide) return;
    if (activationsUsed >= ACTIVATIONS_PER_TURN) return;

    const t = String(u.type).toUpperCase();
    const range = MOVE_RANGE[t] ?? 2;

    const blocked = occupiedSet(u.id);

    const seen = new Set([key(u.r, u.c)]);
    const reachable = new Set();

    // BFS: queue items [r,c,dist]
    const q = [[u.r, u.c, 0]];
    while (q.length) {
      const [r, c, d] = q.shift();
      if (d === range) continue;

      for (const [nr, nc] of neighbors6(r, c)) {
        const k = key(nr, nc);
        if (seen.has(k)) continue;
        seen.add(k);

        if (!liveSet.has(k)) continue;         // must be on board
        if (blocked.has(k)) continue;          // cannot enter or pass through units

        reachable.add(k);
        q.push([nr, nc, d + 1]);
      }
    }

    moveSet = reachable;
  }

  function updateTopLeft() {
    turnEl.textContent = turnSide;
    actsEl.textContent = `${activationsUsed}/${ACTIVATIONS_PER_TURN}`;
  }

  function setStatus(msg) {
    statusEl.textContent = msg || "";
  }

  function updateSelectedPanel() {
    if (!selectedId) {
      selEl.textContent = "Selected: —\n(click a unit)";
      return;
    }
    const u = unitById(selectedId);
    if (!u) {
      selectedId = null;
      selEl.textContent = "Selected: —\n(click a unit)";
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
      const radius = (typeof u.moraleRadius === "number") ? u.moraleRadius : 3;
      lines.push(`Morale radius: ${radius}`);
      lines.push(`Attack: adjacent | 1d6 | hit on 6 (recorded only)`);
    }

    lines.push("");
    lines.push(`Turn: ${turnSide}`);
    lines.push(`Activations: ${activationsUsed}/${ACTIVATIONS_PER_TURN}`);

    selEl.textContent = lines.join("\n");
  }

  function abbrFor(u) {
    const tUp = String(u.type || "").toUpperCase();
    const MAP = { INF:"INF", CAV:"CAV", SKR:"SKR", ARC:"ARC", SLG:"SLG", GEN:"GEN" };
    return MAP[tUp] || (tUp.replace(/[^A-Z]/g,"").slice(0,3) || "???");
  }

  function drawUnitToken(u, g) {
    // TOKEN_UI_V5_SHAPE_ABBR_HP + 40% smaller text
    const { cx, cy } = centerOf(u.r, u.c, g);
    const R = g.s * 0.82;
    const isSel = (selectedId === u.id);

    const abbr = abbrFor(u);

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
      ctx.beginPath();
      ctx.arc(cx, cy, R*0.82, 0, Math.PI * 2);
      ctx.closePath();
    }

    // fill
    makePath();
    ctx.fillStyle = SIDE_FILL[u.side] || "#666";
    ctx.fill();

    // quality outline style
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

    // text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";

    const abFont = Math.max(4, Math.round(g.s * 0.38 * TOKEN_TEXT_SCALE));
    const hpFont = Math.max(5, Math.round(g.s * 0.84 * TOKEN_TEXT_SCALE));

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
      const k = key(h.r, h.c);
      const isHover = hover && (hover.r === h.r) && (hover.c === h.c);
      const inAura = auraSet && auraSet.has(k);

      hexPath(h.cx, h.cy, g.s);

      let fill = "#f7f7f7";
      if (inAura && auraFill) fill = auraFill;
      if (isHover) fill = "#e6f2ff";

      ctx.fillStyle = fill;
      ctx.strokeStyle = isHover ? "#2563eb" : "#b0b0b0";
      ctx.fill();
      ctx.stroke();

      // movement preview (blue dashed outline)
      if (moveSet && moveSet.has(k)) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(37,99,235,0.95)";
        hexPath(h.cx, h.cy, g.s);
        ctx.stroke();
        ctx.restore();
      }
    }

    // units
    for (const u of units) drawUnitToken(u, g);

    ctx.fillStyle = "#666";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    ctx.fillText(`Echelon: move + activations (no combat yet)`, 12, g.H - 12);
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

  function refreshDerivedAndUI() {
    computeAuraForSelected();
    computeMoveSetForSelected();
    updateTopLeft();
    updateSelectedPanel();
    render();
  }

  function tryMoveSelectedTo(r, c) {
    const u = selectedId ? unitById(selectedId) : null;
    if (!u) return;

    const k = key(r, c);
    if (!moveSet || !moveSet.has(k)) return;

    if (u.side !== turnSide) {
      setStatus("Not your turn.");
      return;
    }
    if (activationsUsed >= ACTIVATIONS_PER_TURN) {
      setStatus("No activations left. End Turn.");
      return;
    }
    if (unitAt(r, c)) {
      setStatus("Destination occupied.");
      return;
    }

    const from = `(${u.r},${u.c})`;
    u.r = r; u.c = c;
    activationsUsed += 1;
    setStatus(`Moved ${u.id} ${from} -> (${r},${c})`);

    // After moving, keep selection and refresh
    refreshDerivedAndUI();
  }

  function endTurn() {
    turnSide = (turnSide === "Blue") ? "Red" : "Blue";
    activationsUsed = 0;
    selectedId = null;
    hover = null;
    setStatus(`Turn: ${turnSide}`);
    refreshDerivedAndUI();
  }

  function resetGame() {
    units = deepClone(initialUnits);
    turnSide = "Blue";
    activationsUsed = 0;
    selectedId = null;
    hover = null;
    setStatus("Reset.");
    refreshDerivedAndUI();
  }

  // Events
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
    if (!h) return;

    // If clicked a legal move hex, move
    if (moveSet && moveSet.has(key(h.r, h.c))) {
      tryMoveSelectedTo(h.r, h.c);
      return;
    }

    // Otherwise selection behavior
    const u = unitAt(h.r, h.c);
    selectedId = u ? u.id : null;
    setStatus(u ? `Selected ${u.id}` : "");
    refreshDerivedAndUI();
  });

  endBtn.addEventListener("click", endTurn);
  resetBtn.addEventListener("click", resetGame);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    refreshDerivedAndUI();
  }
  window.addEventListener("resize", resize);

  // init
  hoverEl.textContent = "hover: —";
  setStatus("Echelon ready.");
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

// MOVEMENT_V1 marker for proof
main();
