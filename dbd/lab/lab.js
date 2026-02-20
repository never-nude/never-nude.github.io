/*
  DBD Lab (Scenario pipeline + editor MVP)
  - Load a DBD-157 board template
  - Paint terrain, place units (no stacking)
  - Export/Import scenario JSON (strict-ish validation)
  - Truth badge always visible
*/

const BOARD_FILES = {
  "DBD-157-v1": "../board_157_v1.json",
  "DBD-157-PASS-v1": "../board_157_pass_v1.json",
  "DBD-157-CORRIDOR-v1": "../board_157_corridor_v1.json",
};

const TERRAIN_TYPES = ["CLEAR", "WOODS", "ROUGH", "HILL", "WATER"];
const UNIT_TYPES = ["INF", "CAV", "SKR", "ARC", "GEN"];
const QUALITIES = ["GREEN", "REGULAR", "VETERAN"];
const SIDES = ["BLUE", "RED"];

const BASE_HP = { INF: 5, CAV: 4, SKR: 3, ARC: 3, GEN: 6 };
const QMOD = { GREEN: -1, REGULAR: 0, VETERAN: 1 };

function maxHp(type, quality) {
  return (BASE_HP[type] ?? 1) + (QMOD[quality] ?? 0);
}

function nowIsoShort() {
  const d = new Date();
  return d.toISOString().replace("T", " ").replace("Z", "Z");
}

const BUILD = nowIsoShort();

const elTruth = document.getElementById("truth");
const elStage = document.getElementById("stage");
const elBoard = document.getElementById("boardSelect");
const elMode = document.getElementById("modeSelect");
const elShowIds = document.getElementById("showIds");

const elNew = document.getElementById("newBtn");
const elExport = document.getElementById("exportBtn");
const elImport = document.getElementById("importBtn");
const elValidate = document.getElementById("validateBtn");
const elCopy = document.getElementById("copyBtn");

const elTerrainControls = document.getElementById("terrainControls");
const elUnitControls = document.getElementById("unitControls");

const elTerrainSelect = document.getElementById("terrainSelect");
const elSide = document.getElementById("sideSelect");
const elType = document.getElementById("typeSelect");
const elQuality = document.getElementById("qualitySelect");
const elHpPlace = document.getElementById("hpPlace");

const elSelection = document.getElementById("selectionInfo");
const elDeleteUnit = document.getElementById("deleteUnitBtn");
const elHpEdit = document.getElementById("hpEdit");
const elApplyHp = document.getElementById("applyHpBtn");

const elJson = document.getElementById("jsonBox");
const elErrors = document.getElementById("errors");

let mode = "EDIT";      // EDIT | PLAY
let tool = "INSPECT";   // INSPECT | TERRAIN | UNIT

let board = null;
let hexById = new Map();
let polyById = new Map();
let labelById = new Map();
let posById = new Map();
let unitsLayer = null;
let unitElByHex = new Map();

let selectedHex = null;     // number
let selectedUnitId = null;  // string

function defaultScenario(boardId) {
  return {
    schema: "dbd-scn-0.1",
    board: boardId,
    standardsToWin: 6,
    terrain: {},  // { "73": "HILL", ... }
    units: [],    // [{id,side,type,quality,hp,hex}]
    turn: { side: "BLUE", turnNumber: 1, activationsLeft: 3 },
  };
}

let scenario = defaultScenario(elBoard.value);

function setErrors(lines) {
  elErrors.textContent = (lines && lines.length) ? lines.join("\n") : "";
}

function setTruth(lines) {
  elTruth.textContent = lines.join("\n");
}

function setShowIds(on) {
  for (const t of labelById.values()) t.style.display = on ? "block" : "none";
}

function hexPolygonPoints(cx, cy, size) {
  // Pointy-top hex
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function bfsConnected(hexes) {
  if (!hexes.length) return false;
  const neigh = new Map(hexes.map(h => [h.id, h.neighbors || []]));
  const start = hexes[0].id;
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    for (const nxt of (neigh.get(cur) || [])) {
      if (!seen.has(nxt)) { seen.add(nxt); q.push(nxt); }
    }
  }
  return seen.size === hexes.length;
}

function clearHexClasses(id) {
  const poly = polyById.get(id);
  if (!poly) return;
  poly.classList.remove("selected", "neighbor", "t-WOODS", "t-ROUGH", "t-HILL", "t-WATER");
}

function applyTerrainClass(id, terrain) {
  const poly = polyById.get(id);
  if (!poly) return;
  poly.classList.remove("t-WOODS", "t-ROUGH", "t-HILL", "t-WATER");
  if (terrain && terrain !== "CLEAR") {
    poly.classList.add(`t-${terrain}`);
  }
}

function renderTerrain() {
  for (const [id] of polyById) applyTerrainClass(id, "CLEAR");
  for (const [k, v] of Object.entries(scenario.terrain || {})) {
    const id = Number(k);
    if (Number.isFinite(id)) applyTerrainClass(id, v);
  }
}

function renderUnits() {
  if (!unitsLayer) return;
  unitsLayer.innerHTML = "";
  unitElByHex.clear();

  for (const u of scenario.units) {
    const p = posById.get(u.hex);
    if (!p) continue;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("data-unit-id", u.id);

    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", p.cx.toFixed(2));
    c.setAttribute("cy", p.cy.toFixed(2));
    c.setAttribute("r", "12");
    c.classList.add("unitCircle");
    c.classList.add(u.side === "RED" ? "red" : "blue");

    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", p.cx.toFixed(2));
    t.setAttribute("y", (p.cy + 3).toFixed(2));
    t.classList.add("unitText");
    t.textContent = u.type;

    const hp = document.createElementNS("http://www.w3.org/2000/svg", "text");
    hp.setAttribute("x", p.cx.toFixed(2));
    hp.setAttribute("y", (p.cy + 16).toFixed(2));
    hp.classList.add("unitHp");
    hp.textContent = String(u.hp);

    g.appendChild(c);
    g.appendChild(t);
    g.appendChild(hp);
    unitsLayer.appendChild(g);
    unitElByHex.set(u.hex, g);
  }
}

function unitAtHex(hexId) {
  return scenario.units.find(u => u.hex === hexId) || null;
}

function computeStats() {
  let bCount = 0, rCount = 0, bHp = 0, rHp = 0;
  for (const u of scenario.units) {
    if (u.side === "BLUE") { bCount++; bHp += u.hp; }
    else { rCount++; rHp += u.hp; }
  }
  return { bCount, rCount, bHp, rHp };
}

function updateTruth() {
  if (!board) {
    setTruth([`BUILD ${BUILD}`, "board: (loading)", "…"]);
    return;
  }

  const degs = board.hexes.map(h => (h.neighbors || []).length);
  const minDeg = Math.min(...degs);
  const maxDeg = Math.max(...degs);
  const connected = bfsConnected(board.hexes);
  const s = computeStats();

  setTruth([
    `BUILD ${BUILD}`,
    `mode: ${mode} | tool: ${tool}`,
    `scenario: ${scenario.schema} | board: ${scenario.board}`,
    `hexCount: field ${board.hexCount} | computed ${board.hexes.length}`,
    `degree(min,max): (${minDeg}, ${maxDeg}) | connected: ${connected ? "YES" : "NO"}`,
    `BLUE units ${s.bCount} | HP ${s.bHp}     RED units ${s.rCount} | HP ${s.rHp}`
  ]);
}

function clearSelectionStyles() {
  for (const poly of polyById.values()) poly.classList.remove("selected", "neighbor");
}

function applySelection(hexId) {
  selectedHex = hexId;
  const u = unitAtHex(hexId);
  selectedUnitId = u ? u.id : null;

  clearSelectionStyles();

  const poly = polyById.get(hexId);
  if (poly) poly.classList.add("selected");

  const hx = hexById.get(hexId);
  const neighbors = (hx && hx.neighbors) ? hx.neighbors : [];
  for (const nid of neighbors) {
    const p = polyById.get(nid);
    if (p) p.classList.add("neighbor");
  }

  // Engaged info (adjacent enemy)
  let engaged = false;
  if (u) {
    for (const nid of neighbors) {
      const nu = unitAtHex(nid);
      if (nu && nu.side !== u.side) { engaged = true; break; }
    }
  }

  const terrain = scenario.terrain[String(hexId)] || "CLEAR";
  const lines = [];
  lines.push(`Hex: ${hexId}`);
  lines.push(`Terrain: ${terrain}`);
  lines.push(`Neighbors: [${neighbors.join(", ")}]`);

  if (u) {
    const mhp = maxHp(u.type, u.quality);
    lines.push("");
    lines.push(`Unit: ${u.id}`);
    lines.push(`  side: ${u.side}`);
    lines.push(`  type: ${u.type}`);
    lines.push(`  quality: ${u.quality}`);
    lines.push(`  hp: ${u.hp} / ${mhp}`);
    lines.push(`  engaged: ${engaged ? "YES" : "NO"}`);

    elDeleteUnit.disabled = false;
    elApplyHp.disabled = false;
    elHpEdit.value = String(u.hp);
    elHpEdit.min = "1";
    elHpEdit.max = String(mhp);
  } else {
    lines.push("");
    lines.push("(no unit)");
    elDeleteUnit.disabled = true;
    elApplyHp.disabled = true;
    elHpEdit.value = "1";
    elHpEdit.min = "1";
    elHpEdit.max = "20";
  }

  elSelection.textContent = lines.join("\n");
}

function nextUnitId(side, type) {
  const prefix = `${side[0]}_${type}_`;
  let maxN = 0;
  for (const u of scenario.units) {
    if (typeof u.id === "string" && u.id.startsWith(prefix)) {
      const rest = u.id.slice(prefix.length);
      const n = Number(rest);
      if (Number.isFinite(n)) maxN = Math.max(maxN, n);
    }
  }
  return `${prefix}${maxN + 1}`;
}

function clampInt(n, lo, hi) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function onHexClick(hexId) {
  setErrors([]);
  applySelection(hexId);

  if (mode !== "EDIT") return;

  if (tool === "TERRAIN") {
    const t = elTerrainSelect.value;
    if (!TERRAIN_TYPES.includes(t)) return;

    if (t === "CLEAR") delete scenario.terrain[String(hexId)];
    else scenario.terrain[String(hexId)] = t;

    applyTerrainClass(hexId, t);
    updateTruth();
    return;
  }

  if (tool === "UNIT") {
    const existing = unitAtHex(hexId);
    if (existing) {
      // No stacking; selecting is the only action on occupied hex
      return;
    }

    const side = elSide.value;
    const type = elType.value;
    const quality = elQuality.value;
    if (!SIDES.includes(side) || !UNIT_TYPES.includes(type) || !QUALITIES.includes(quality)) return;

    const mhp = maxHp(type, quality);
    const hpWanted = clampInt(elHpPlace.value, 1, mhp);

    const unit = {
      id: nextUnitId(side, type),
      side,
      type,
      quality,
      hp: hpWanted,
      hex: hexId,
    };

    scenario.units.push(unit);
    renderUnits();
    applySelection(hexId);
    updateTruth();
    return;
  }
}

function validateScenario(obj) {
  const errs = [];

  if (!obj || typeof obj !== "object") {
    errs.push("Scenario is not an object.");
    return errs;
  }

  if (obj.schema !== "dbd-scn-0.1") errs.push(`schema must be "dbd-scn-0.1" (got ${JSON.stringify(obj.schema)})`);

  if (typeof obj.board !== "string" || !obj.board.startsWith("DBD-")) errs.push("board must be a string like 'DBD-157-v1'");
  if (obj.board && !BOARD_FILES[obj.board]) errs.push(`Unsupported boardId '${obj.board}' (lab knows: ${Object.keys(BOARD_FILES).join(", ")})`);

  if (!Number.isInteger(obj.standardsToWin) || obj.standardsToWin < 1 || obj.standardsToWin > 20) {
    errs.push("standardsToWin must be integer 1..20");
  }

  // Terrain
  const terr = obj.terrain;
  if (!terr || typeof terr !== "object" || Array.isArray(terr)) errs.push("terrain must be an object map: { '73': 'HILL', ... }");
  else {
    for (const [k, v] of Object.entries(terr)) {
      const id = Number(k);
      if (!Number.isInteger(id) || id < 0 || id > 156) errs.push(`terrain key out of range 0..156: ${k}`);
      if (!TERRAIN_TYPES.includes(v)) errs.push(`terrain value invalid at ${k}: ${JSON.stringify(v)}`);
    }
  }

  // Units
  if (!Array.isArray(obj.units)) errs.push("units must be an array");
  else {
    const usedHex = new Set();
    const usedId = new Set();
    for (const u of obj.units) {
      if (!u || typeof u !== "object") { errs.push("units contains a non-object"); continue; }

      const req = ["id","side","type","quality","hp","hex"];
      for (const r of req) if (!(r in u)) errs.push(`unit missing field '${r}': ${JSON.stringify(u)}`);

      if (typeof u.id !== "string" || !u.id.length) errs.push(`unit.id must be non-empty string (got ${JSON.stringify(u.id)})`);
      if (typeof u.id === "string") {
        if (usedId.has(u.id)) errs.push(`duplicate unit.id: ${u.id}`);
        usedId.add(u.id);
      }

      if (!SIDES.includes(u.side)) errs.push(`unit.side invalid: ${JSON.stringify(u.side)}`);
      if (!UNIT_TYPES.includes(u.type)) errs.push(`unit.type invalid: ${JSON.stringify(u.type)}`);
      if (!QUALITIES.includes(u.quality)) errs.push(`unit.quality invalid: ${JSON.stringify(u.quality)}`);

      if (!Number.isInteger(u.hex) || u.hex < 0 || u.hex > 156) errs.push(`unit.hex out of range 0..156: ${JSON.stringify(u.hex)}`);
      else {
        if (usedHex.has(u.hex)) errs.push(`stacking detected: multiple units on hex ${u.hex}`);
        usedHex.add(u.hex);
      }

      const mhp = maxHp(u.type, u.quality);
      if (!Number.isInteger(u.hp) || u.hp < 1 || u.hp > mhp) errs.push(`unit.hp invalid for ${u.id || "(no id)"}: ${u.hp} (max ${mhp})`);
    }
  }

  // Turn
  const t = obj.turn;
  if (!t || typeof t !== "object") errs.push("turn must be an object");
  else {
    if (!SIDES.includes(t.side)) errs.push(`turn.side invalid: ${JSON.stringify(t.side)}`);
    if (!Number.isInteger(t.turnNumber) || t.turnNumber < 1) errs.push("turn.turnNumber must be integer >= 1");
    if (!Number.isInteger(t.activationsLeft) || t.activationsLeft < 0 || t.activationsLeft > 3) errs.push("turn.activationsLeft must be integer 0..3");
  }

  return errs;
}

async function loadBoard(boardId, opts = {}) {
  const file = BOARD_FILES[boardId];
  if (!file) {
    setErrors([`No board mapping for '${boardId}'.`]);
    return;
  }

  const cb = Date.now();
  setTruth([`BUILD ${BUILD}`, `Loading ${boardId}…`, `file: ${file}`, `cb: ${cb}`]);
  setErrors([]);

  const res = await fetch(`${file}?cb=${cb}`, { cache: "no-store" });
  if (!res.ok) {
    setErrors([`Fetch failed: ${res.status} ${res.statusText}`, `url: ${res.url}`]);
    return;
  }

  const data = await res.json();
  if (!data || !Array.isArray(data.hexes) || data.hexes.length !== 157) {
    setErrors([`Board JSON malformed or not 157 hexes.`]);
    return;
  }

  board = data;
  hexById = new Map(board.hexes.map(h => [h.id, h]));

  // Switching boards resets scenario unless opts.keepScenario is true
  if (!opts.keepScenario) {
    scenario = defaultScenario(boardId);
    elJson.value = "";
  } else {
    scenario.board = boardId;
  }

  renderBoard();
  renderTerrain();
  renderUnits();
  updateTruth();

  // Keep selection on reset: clear selection
  selectedHex = null;
  selectedUnitId = null;
  elSelection.textContent = "Nothing selected.";
  elDeleteUnit.disabled = true;
  elApplyHp.disabled = true;
}

function renderBoard() {
  // Layout constants (match viewer for consistency)
  const size = 18;
  const unitX = (Math.sqrt(3) / 2) * size; // one x2 step
  const unitY = 1.5 * size;                // row step
  const pad = 24;

  posById.clear();
  polyById.clear();
  labelById.clear();

  // Compute positions + bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const h of board.hexes) {
    const cx = pad + h.x2 * unitX;
    const cy = pad + h.row * unitY;
    posById.set(h.id, { cx, cy });

    minX = Math.min(minX, cx - size);
    minY = Math.min(minY, cy - size);
    maxX = Math.max(maxX, cx + size);
    maxY = Math.max(maxY, cy + size);
  }

  const width = (maxX - minX) + pad;
  const height = (maxY - minY) + pad;

  elStage.innerHTML = "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `${minX - 12} ${minY - 12} ${width + 24} ${height + 24}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `DBD board ${board.boardId}`);

  // Hex layer
  for (const h of board.hexes) {
    const { cx, cy } = posById.get(h.id);

    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", hexPolygonPoints(cx, cy, size));
    poly.classList.add("hex");
    poly.dataset.id = String(h.id);

    poly.addEventListener("click", () => onHexClick(h.id));

    svg.appendChild(poly);
    polyById.set(h.id, poly);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", cx.toFixed(2));
    label.setAttribute("y", (cy + 3).toFixed(2));
    label.setAttribute("text-anchor", "middle");
    label.classList.add("hexlabel");
    label.textContent = String(h.id);

    svg.appendChild(label);
    labelById.set(h.id, label);
  }

  // Units layer (pointer-events none)
  unitsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  unitsLayer.classList.add("unitsLayer");
  svg.appendChild(unitsLayer);

  elStage.appendChild(svg);

  setShowIds(elShowIds.checked);
}

function updateToolUI() {
  elTerrainControls.classList.toggle("hidden", tool !== "TERRAIN" || mode !== "EDIT");
  elUnitControls.classList.toggle("hidden", tool !== "UNIT" || mode !== "EDIT");
}

function syncHpPlace() {
  const type = elType.value;
  const q = elQuality.value;
  const mhp = maxHp(type, q);
  elHpPlace.value = String(mhp);
  elHpPlace.min = "1";
  elHpPlace.max = String(mhp);
}

function setMode(newMode) {
  mode = newMode;
  updateToolUI();
  updateTruth();
}

function setTool(newTool) {
  tool = newTool;
  updateToolUI();
  updateTruth();
}

function exportScenario() {
  setErrors([]);
  const out = {
    schema: scenario.schema,
    board: scenario.board,
    standardsToWin: scenario.standardsToWin,
    terrain: scenario.terrain,
    units: scenario.units,
    turn: scenario.turn,
  };
  elJson.value = JSON.stringify(out, null, 2);
}

async function importScenario() {
  setErrors([]);
  let parsed;
  try {
    parsed = JSON.parse(elJson.value);
  } catch (e) {
    setErrors([`JSON parse error: ${e.message}`]);
    return;
  }

  const errs = validateScenario(parsed);
  if (errs.length) {
    setErrors(errs);
    return;
  }

  // Ensure board loaded, but keep scenario when switching for import
  const targetBoard = parsed.board;
  if (scenario.board !== targetBoard) {
    elBoard.value = targetBoard;
    await loadBoard(targetBoard, { keepScenario: true });
  }

  // Apply imported scenario
  scenario = parsed;

  // Re-render
  renderTerrain();
  renderUnits();
  updateTruth();

  selectedHex = null;
  selectedUnitId = null;
  elSelection.textContent = "Imported scenario. Click a hex to inspect.";
  elDeleteUnit.disabled = true;
  elApplyHp.disabled = true;
}

function validateCurrent() {
  const errs = validateScenario(scenario);
  if (errs.length) setErrors(errs);
  else setErrors([`OK: scenario valid (${scenario.units.length} units, ${Object.keys(scenario.terrain).length} terrain entries)`]);
}

async function copyJson() {
  setErrors([]);
  try {
    await navigator.clipboard.writeText(elJson.value || "");
    setErrors([`Copied ${ (elJson.value || "").length } chars to clipboard.`]);
  } catch (e) {
    setErrors([`Clipboard copy failed. (This is normal in some settings.)`, `You can still manually copy from the text box.`]);
  }
}

function newScenario() {
  scenario = defaultScenario(elBoard.value);
  renderTerrain();
  renderUnits();
  updateTruth();
  setErrors([]);
  elJson.value = "";
  selectedHex = null;
  selectedUnitId = null;
  elSelection.textContent = "New scenario. Choose a tool and click hexes.";
  elDeleteUnit.disabled = true;
  elApplyHp.disabled = true;
}

function deleteSelectedUnit() {
  if (selectedHex == null) return;
  const u = unitAtHex(selectedHex);
  if (!u) return;
  scenario.units = scenario.units.filter(x => x.id !== u.id);
  renderUnits();
  applySelection(selectedHex);
  updateTruth();
}

function applyHpToSelected() {
  if (selectedHex == null) return;
  const u = unitAtHex(selectedHex);
  if (!u) return;

  const mhp = maxHp(u.type, u.quality);
  const newHp = clampInt(elHpEdit.value, 1, mhp);
  u.hp = newHp;

  renderUnits();
  applySelection(selectedHex);
  updateTruth();
}

// Tool radio listeners
for (const r of document.querySelectorAll('input[name="tool"]')) {
  r.addEventListener("change", () => setTool(r.value));
}

// Mode + board
elMode.addEventListener("change", () => setMode(elMode.value));
elBoard.addEventListener("change", () => loadBoard(elBoard.value, { keepScenario: false }));

// show IDs
elShowIds.addEventListener("change", () => setShowIds(elShowIds.checked));

// Buttons
elNew.addEventListener("click", () => newScenario());
elExport.addEventListener("click", () => exportScenario());
elImport.addEventListener("click", () => importScenario());
elValidate.addEventListener("click", () => validateCurrent());
elCopy.addEventListener("click", () => copyJson());

// Unit controls: keep hpPlace in sync with type/quality
elType.addEventListener("change", () => syncHpPlace());
elQuality.addEventListener("change", () => syncHpPlace());

// Selection buttons
elDeleteUnit.addEventListener("click", () => deleteSelectedUnit());
elApplyHp.addEventListener("click", () => applyHpToSelected());

function init() {
  syncHpPlace();
  setMode("EDIT");
  setTool("INSPECT");
  loadBoard(elBoard.value, { keepScenario: false });
}

init();
