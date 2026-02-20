/*
  DBD Lab (Scenario pipeline + editor MVP)
  Play mode (v0.1): melee-only combat + retreats + standards.

  Rules implemented (subset):
  - Turns alternate; 3 activations per turn
  - Mapped to scenario.turn.{side,turnNumber,activationsLeft}
  - Melee attack: adjacent only
  - Dice legend: 5–6 HIT, 4 RETREAT, 1–3 MISS
  - Flanking (melee): if defender adjacent to 2+ enemies, attacker +1 die
  - Cover (melee): defender in WOODS/ROUGH => attacker -1 die (min 1)
  - Retreat resilience (quality/support) cancels retreats (per DBD_RULES_v0_1.md)
  - Retreat steps: defender chooses an adjacent hex that increases distance from attacker
    - Cannot retreat into occupied hex or WATER
    - Blocked retreat step => +1 HIT
  - Standards:
    - Destroy unit => +1
    - Destroy general => +2
    - When a side reaches standardsToWin => GAME OVER
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
const MELEE_DICE = { INF: 2, CAV: 2, SKR: 1, ARC: 1, GEN: 1 };

function maxHp(type, quality) {
  return (BASE_HP[type] ?? 1) + (QMOD[quality] ?? 0);
}

function nowIsoShort() {
  const d = new Date();
  return d.toISOString().replace("T", " ").replace("Z", "Z");
}

const BUILD = nowIsoShort();

// DOM
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

const elTurnSide = document.getElementById("turnSide");
const elActsLeft = document.getElementById("actsLeft");
const elScoreLine = document.getElementById("scoreLine");
const elEndTurn = document.getElementById("endTurnBtn");
const elResetScore = document.getElementById("resetScoreBtn");
const elClearLog = document.getElementById("clearLogBtn");
const elCombatLog = document.getElementById("combatLog");

// State
let mode = "EDIT";      // EDIT | PLAY
let tool = "INSPECT";   // INSPECT | TERRAIN | UNIT

let board = null;
let hexById = new Map();
let polyById = new Map();
let labelById = new Map();
let posById = new Map();
let unitsLayer = null;

let selectedHex = null;     // number
let selectedUnitId = null;  // string

let phase = "NORMAL";       // NORMAL | RETREAT
let retreatCtx = null;      // { defenderId, attackerHex, attackerSide, stepsRemaining, distMap, optionsSet }

let gameOver = false;
let winner = null;

let logLines = ["(log starts here)"];

// Scenario
function ensureMeta(scn) {
  if (!scn.meta || typeof scn.meta !== "object" || Array.isArray(scn.meta)) scn.meta = {};
  if (!scn.meta.score || typeof scn.meta.score !== "object" || Array.isArray(scn.meta.score)) {
    scn.meta.score = { BLUE: 0, RED: 0 };
  }
  if (!Number.isInteger(scn.meta.score.BLUE)) scn.meta.score.BLUE = 0;
  if (!Number.isInteger(scn.meta.score.RED)) scn.meta.score.RED = 0;
  return scn;
}

function defaultScenario(boardId) {
  return ensureMeta({
    schema: "dbd-scn-0.1",
    board: boardId,
    standardsToWin: 6,
    terrain: {},  // { "73": "HILL", ... }
    units: [],    // [{id,side,type,quality,hp,hex}]
    turn: { side: "BLUE", turnNumber: 1, activationsLeft: 3 },
    meta: { score: { BLUE: 0, RED: 0 } }
  });
}

let scenario = defaultScenario(elBoard.value);

// Utilities
function setErrors(lines) {
  elErrors.textContent = (lines && lines.length) ? lines.join("\n") : "";
}

function setTruth(lines) {
  elTruth.textContent = lines.join("\n");
}

function pushLog(line) {
  const stamp = new Date().toLocaleTimeString();
  logLines.push(`${stamp}  ${line}`);
  if (logLines.length > 200) logLines = logLines.slice(-200);
  elCombatLog.textContent = logLines.join("\n");
  elCombatLog.scrollTop = elCombatLog.scrollHeight;
}

function clearLog() {
  logLines = ["(log cleared)"];
  elCombatLog.textContent = logLines.join("\n");
}

function getScore(side) {
  ensureMeta(scenario);
  return scenario.meta.score[side] ?? 0;
}

function setScore(side, val) {
  ensureMeta(scenario);
  scenario.meta.score[side] = val;
}

function addScore(side, pts) {
  setScore(side, getScore(side) + pts);
}

function otherSide(side) {
  return side === "BLUE" ? "RED" : "BLUE";
}

function clampInt(n, lo, hi) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function terrainAt(hexId) {
  return scenario.terrain[String(hexId)] || "CLEAR";
}

function isPassable(hexId) {
  return terrainAt(hexId) !== "WATER";
}

function neighborsOf(hexId) {
  const h = hexById.get(hexId);
  return (h && h.neighbors) ? h.neighbors : [];
}

function unitAtHex(hexId) {
  return scenario.units.find(u => u.hex === hexId) || null;
}

function unitById(uid) {
  return scenario.units.find(u => u.id === uid) || null;
}

function isAdjacent(a, b) {
  return neighborsOf(a).includes(b);
}

function occupiedSet() {
  const s = new Set();
  for (const u of scenario.units) s.add(u.hex);
  return s;
}

function computeStats() {
  let bCount = 0, rCount = 0, bHp = 0, rHp = 0;
  for (const u of scenario.units) {
    if (u.side === "BLUE") { bCount++; bHp += u.hp; }
    else { rCount++; rHp += u.hp; }
  }
  return { bCount, rCount, bHp, rHp };
}

function updatePlayHUD() {
  elTurnSide.textContent = scenario.turn.side;
  elActsLeft.textContent = String(scenario.turn.activationsLeft);
  elScoreLine.textContent = `BLUE ${getScore("BLUE")} / RED ${getScore("RED")} (to win ${scenario.standardsToWin})`;
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

  const top = [
    `BUILD ${BUILD}`,
    `mode: ${mode} | tool: ${tool} | phase: ${phase}${gameOver ? " | GAME OVER" : ""}`,
    `scenario: ${scenario.schema} | board: ${scenario.board}`,
    `turn: ${scenario.turn.side} #${scenario.turn.turnNumber} | activationsLeft: ${scenario.turn.activationsLeft}`,
    `standards: BLUE ${getScore("BLUE")} / RED ${getScore("RED")} (to win ${scenario.standardsToWin})`,
    `hexCount: field ${board.hexCount} | computed ${board.hexes.length} | degree(min,max): (${minDeg}, ${maxDeg}) | connected: ${connected ? "YES" : "NO"}`,
    `BLUE units ${s.bCount} | HP ${s.bHp}     RED units ${s.rCount} | HP ${s.rHp}`
  ];

  if (gameOver && winner) top.push(`WINNER: ${winner}`);
  setTruth(top);
  updatePlayHUD();
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

// SVG helpers
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

function setShowIds(on) {
  for (const t of labelById.values()) t.style.display = on ? "block" : "none";
}

function clearSelectionStyles() {
  for (const poly of polyById.values()) poly.classList.remove("selected", "neighbor");
}

function clearActionHighlights() {
  for (const poly of polyById.values()) poly.classList.remove("attackable", "retreatable");
}

function applyTerrainClass(id, terrain) {
  const poly = polyById.get(id);
  if (!poly) return;
  poly.classList.remove("t-WOODS", "t-ROUGH", "t-HILL", "t-WATER");
  if (terrain && terrain !== "CLEAR") poly.classList.add(`t-${terrain}`);
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
  }
}

// Selection info
function supportCount(defender) {
  let n = 0;
  for (const nid of neighborsOf(defender.hex)) {
    const u = unitAtHex(nid);
    if (u && u.side === defender.side) n++;
  }
  return n;
}

function adjacentFriendlyGeneral(defender) {
  for (const nid of neighborsOf(defender.hex)) {
    const u = unitAtHex(nid);
    if (u && u.side === defender.side && u.type === "GEN") return true;
  }
  return false;
}

function retreatCancelCount(defender, retreats) {
  if (retreats <= 0) return 0;

  const sup = supportCount(defender);
  const adjGen = adjacentFriendlyGeneral(defender);

  if (defender.quality === "GREEN") {
    return (sup >= 2 || adjGen) ? 1 : 0;
  }

  if (defender.quality === "REGULAR") {
    return (sup >= 1 || adjGen) ? 1 : 0;
  }

  if (defender.quality === "VETERAN") {
    let c = 1;
    if (sup >= 1 || adjGen) c = 2;
    return Math.min(c, 2);
  }

  return 0;
}

function attackTargetsFor(attacker) {
  // Adjacent enemies only (melee)
  const out = [];
  for (const nid of neighborsOf(attacker.hex)) {
    const u = unitAtHex(nid);
    if (u && u.side !== attacker.side) out.push(nid);
  }
  return out;
}

function canActNow() {
  return mode === "PLAY" && !gameOver && phase === "NORMAL" && scenario.turn.activationsLeft > 0;
}

function refreshHighlights() {
  clearActionHighlights();
  clearSelectionStyles();

  if (selectedHex == null) return;

  const poly = polyById.get(selectedHex);
  if (poly) poly.classList.add("selected");

  const hx = hexById.get(selectedHex);
  const neighbors = (hx && hx.neighbors) ? hx.neighbors : [];
  for (const nid of neighbors) {
    const p = polyById.get(nid);
    if (p) p.classList.add("neighbor");
  }

  if (mode === "PLAY" && phase === "NORMAL") {
    const attacker = unitAtHex(selectedHex);
    if (attacker && attacker.side === scenario.turn.side && canActNow()) {
      for (const tid of attackTargetsFor(attacker)) {
        const tp = polyById.get(tid);
        if (tp) tp.classList.add("attackable");
      }
    }
  }

  if (mode === "PLAY" && phase === "RETREAT" && retreatCtx && retreatCtx.optionsSet) {
    for (const hid of retreatCtx.optionsSet) {
      const p = polyById.get(hid);
      if (p) p.classList.add("retreatable");
    }
  }
}

function applySelection(hexId) {
  selectedHex = hexId;
  const u = unitAtHex(hexId);
  selectedUnitId = u ? u.id : null;

  // Edit-only actions disabled while in Play
  const editEnabled = (mode === "EDIT");
  elDeleteUnit.disabled = !(editEnabled && !!u);
  elApplyHp.disabled = !(editEnabled && !!u);

  const neighbors = neighborsOf(hexId);
  const terrain = terrainAt(hexId);

  const lines = [];
  lines.push(`Hex: ${hexId}`);
  lines.push(`Terrain: ${terrain}`);
  lines.push(`Neighbors: [${neighbors.join(", ")}]`);

  if (u) {
    const mhp = maxHp(u.type, u.quality);

    // engaged = adjacent enemy
    let engaged = false;
    for (const nid of neighbors) {
      const nu = unitAtHex(nid);
      if (nu && nu.side !== u.side) { engaged = true; break; }
    }

    lines.push("");
    lines.push(`Unit: ${u.id}`);
    lines.push(`  side: ${u.side}`);
    lines.push(`  type: ${u.type}`);
    lines.push(`  quality: ${u.quality}`);
    lines.push(`  hp: ${u.hp} / ${mhp}`);
    lines.push(`  engaged: ${engaged ? "YES" : "NO"}`);

    if (mode === "PLAY") {
      lines.push("");
      lines.push(`Play:`);
      lines.push(`  current turn: ${scenario.turn.side}`);
      lines.push(`  activationsLeft: ${scenario.turn.activationsLeft}`);
      if (gameOver) lines.push(`  GAME OVER — winner: ${winner || "?"}`);

      if (u.side === scenario.turn.side && canActNow()) {
        const targets = attackTargetsFor(u);
        lines.push(`  attack targets (adjacent enemies): [${targets.join(", ")}]`);
        lines.push(`  attack by clicking a red-outlined enemy hex`);
      } else if (u.side !== scenario.turn.side) {
        lines.push(`  (not your turn for this unit)`);
      } else if (scenario.turn.activationsLeft <= 0) {
        lines.push(`  (no activations left — end turn)`);
      }
    }

    elHpEdit.value = String(u.hp);
    elHpEdit.min = "1";
    elHpEdit.max = String(mhp);
  } else {
    lines.push("");
    lines.push("(no unit)");
    elHpEdit.value = "1";
    elHpEdit.min = "1";
    elHpEdit.max = "20";
  }

  elSelection.textContent = lines.join("\n");
  refreshHighlights();
  updateTruth();
}

// Edit helpers
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

function syncHpPlace() {
  const type = elType.value;
  const q = elQuality.value;
  const mhp = maxHp(type, q);
  elHpPlace.value = String(mhp);
  elHpPlace.min = "1";
  elHpPlace.max = String(mhp);
}

function updateToolUI() {
  const editMode = (mode === "EDIT");
  elTerrainControls.classList.toggle("hidden", tool !== "TERRAIN" || !editMode);
  elUnitControls.classList.toggle("hidden", tool !== "UNIT" || !editMode);

  // Disable edit-only buttons when not editing
  elDeleteUnit.disabled = !(editMode && !!unitAtHex(selectedHex ?? -1));
  elApplyHp.disabled = !(editMode && !!unitAtHex(selectedHex ?? -1));
}

function setMode(newMode) {
  mode = newMode;

  if (mode === "PLAY") {
    tool = "INSPECT"; // no sneaky editing in play
    // If starting play for first time, announce turn
    pushLog(`--- PLAY mode: Turn ${scenario.turn.turnNumber} (${scenario.turn.side}), activations ${scenario.turn.activationsLeft} ---`);
  } else {
    phase = "NORMAL";
    retreatCtx = null;
    gameOver = false;
    winner = null;
  }

  updateToolUI();
  refreshHighlights();
  updateTruth();
}

function setTool(newTool) {
  tool = newTool;
  updateToolUI();
  updateTruth();
}

// Validation / import / export
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

  // meta (optional)
  if ("meta" in obj) {
    if (!obj.meta || typeof obj.meta !== "object" || Array.isArray(obj.meta)) errs.push("meta must be an object if present");
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

function exportScenario() {
  setErrors([]);
  ensureMeta(scenario);
  const out = {
    schema: scenario.schema,
    board: scenario.board,
    standardsToWin: scenario.standardsToWin,
    terrain: scenario.terrain,
    units: scenario.units,
    turn: scenario.turn,
    meta: scenario.meta
  };
  elJson.value = JSON.stringify(out, null, 2);
  pushLog("Exported scenario JSON.");
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
  if (errs.length) { setErrors(errs); return; }

  ensureMeta(parsed);

  // Load board if needed
  const targetBoard = parsed.board;
  if (scenario.board !== targetBoard) {
    elBoard.value = targetBoard;
    await loadBoard(targetBoard, { keepScenario: true });
  }

  scenario = parsed;
  ensureMeta(scenario);

  // Reset transient play state
  phase = "NORMAL";
  retreatCtx = null;
  gameOver = false;
  winner = null;

  renderTerrain();
  renderUnits();
  selectedHex = null;
  selectedUnitId = null;
  elSelection.textContent = "Imported scenario. Click a hex to inspect.";
  updateToolUI();
  refreshHighlights();
  updateTruth();
  pushLog("Imported scenario JSON.");
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
    setErrors([`Copied ${(elJson.value || "").length} chars to clipboard.`]);
  } catch (e) {
    setErrors([`Clipboard copy failed. (Normal in some settings.)`, `You can still manually copy from the text box.`]);
  }
}

function newScenario() {
  scenario = defaultScenario(elBoard.value);

  phase = "NORMAL";
  retreatCtx = null;
  gameOver = false;
  winner = null;

  renderTerrain();
  renderUnits();
  selectedHex = null;
  selectedUnitId = null;
  elSelection.textContent = "New scenario. Choose a tool and click hexes.";
  setErrors([]);
  elJson.value = "";

  updateToolUI();
  refreshHighlights();
  updateTruth();
  pushLog("New scenario created.");
}

// Combat core
function distancesFrom(startHex) {
  // BFS distances on the board graph
  const dist = new Map();
  const q = [startHex];
  dist.set(startHex, 0);

  while (q.length) {
    const cur = q.shift();
    const d = dist.get(cur);
    for (const nxt of neighborsOf(cur)) {
      if (!dist.has(nxt)) {
        dist.set(nxt, d + 1);
        q.push(nxt);
      }
    }
  }
  return dist;
}

function isFlanked(defender) {
  let enemies = 0;
  for (const nid of neighborsOf(defender.hex)) {
    const u = unitAtHex(nid);
    if (u && u.side !== defender.side) enemies++;
  }
  return enemies >= 2;
}

function meleeDiceCount(attacker, defender) {
  let dice = MELEE_DICE[attacker.type] ?? 1;

  // Flanking bonus (melee)
  if (isFlanked(defender)) dice += 1;

  // Cover penalty (melee)
  const terr = terrainAt(defender.hex);
  if (terr === "WOODS" || terr === "ROUGH") dice -= 1;

  return Math.max(1, dice);
}

function rollDice(n) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * 6));
  return rolls;
}

function analyzeRolls(rolls) {
  let hits = 0, retreats = 0;
  for (const r of rolls) {
    if (r >= 5) hits++;
    else if (r === 4) retreats++;
  }
  return { hits, retreats };
}

function destroyUnit(defender, attackerSide, reason) {
  const pts = defender.type === "GEN" ? 2 : 1;
  scenario.units = scenario.units.filter(u => u.id !== defender.id);
  addScore(attackerSide, pts);
  pushLog(`${reason} DESTROYED: ${defender.side} ${defender.type}(${defender.id}) => ${attackerSide} +${pts} standard(s).`);
  renderUnits();
  checkVictory();
}

function checkVictory() {
  const goal = scenario.standardsToWin;
  const b = getScore("BLUE");
  const r = getScore("RED");
  if (!gameOver && (b >= goal || r >= goal)) {
    gameOver = true;
    winner = (b >= goal) ? "BLUE" : "RED";
    pushLog(`=== GAME OVER: ${winner} reaches ${goal} standards ===`);
  }
}

function beginRetreat(defenderId, attackerHex, attackerSide, steps) {
  phase = "RETREAT";
  retreatCtx = {
    defenderId,
    attackerHex,
    attackerSide,
    stepsRemaining: steps,
    distMap: distancesFrom(attackerHex),
    optionsSet: new Set()
  };

  const def = unitById(defenderId);
  if (!def) {
    // Defender vanished (destroyed); abort retreat
    phase = "NORMAL";
    retreatCtx = null;
    refreshHighlights();
    updateTruth();
    return;
  }

  pushLog(`RETREAT: ${def.side} ${def.type}(${def.id}) must retreat ${steps} step(s) away from attacker @${attackerHex}. Defender chooses.`);
  stepRetreatOrAuto();
}

function computeRetreatOptions(defender, distMap, occ) {
  const opts = [];
  const curD = distMap.get(defender.hex);
  if (curD == null) return opts;

  for (const nid of neighborsOf(defender.hex)) {
    if (!isPassable(nid)) continue;
    if (occ.has(nid)) continue;
    const nd = distMap.get(nid);
    if (nd == null) continue;
    if (nd > curD) opts.push(nid);
  }
  return opts;
}

function stepRetreatOrAuto() {
  if (!retreatCtx) return;

  const def = unitById(retreatCtx.defenderId);
  if (!def) {
    phase = "NORMAL";
    retreatCtx = null;
    refreshHighlights();
    updateTruth();
    return;
  }

  if (retreatCtx.stepsRemaining <= 0) {
    phase = "NORMAL";
    retreatCtx = null;
    pushLog("RETREAT complete.");
    renderUnits();
    refreshHighlights();
    updateTruth();
    return;
  }

  const occ = occupiedSet();
  // Defender itself occupies its hex; allow staying there implicitly
  occ.delete(def.hex);

  const opts = computeRetreatOptions(def, retreatCtx.distMap, occ);
  retreatCtx.optionsSet = new Set(opts);

  if (!opts.length) {
    // Blocked retreat step => +1 hit
    def.hp -= 1;
    pushLog(`RETREAT blocked: no legal hex. ${def.side} ${def.type}(${def.id}) takes +1 HIT (hp now ${def.hp}/${maxHp(def.type, def.quality)}).`);
    retreatCtx.stepsRemaining -= 1;

    if (def.hp <= 0) {
      destroyUnit(def, retreatCtx.attackerSide, "Blocked retreat");
      phase = "NORMAL";
      retreatCtx = null;
      refreshHighlights();
      updateTruth();
      return;
    }

    // Continue to next step (still blocked possible)
    stepRetreatOrAuto();
    refreshHighlights();
    updateTruth();
    return;
  }

  // Need player choice
  pushLog(`Choose retreat hex (${retreatCtx.stepsRemaining} left): [${opts.join(", ")}]`);
  refreshHighlights();
  updateTruth();
}

function handleRetreatClick(hexId) {
  if (!retreatCtx) return;

  const def = unitById(retreatCtx.defenderId);
  if (!def) {
    phase = "NORMAL";
    retreatCtx = null;
    refreshHighlights();
    updateTruth();
    return;
  }

  if (!retreatCtx.optionsSet || !retreatCtx.optionsSet.has(hexId)) {
    setErrors([`RETREAT: click a cyan-highlighted hex. (You clicked ${hexId}.)`]);
    return;
  }

  // Move defender
  const from = def.hex;
  def.hex = hexId;
  retreatCtx.stepsRemaining -= 1;
  pushLog(`RETREAT step: ${def.side} ${def.type}(${def.id}) ${from} -> ${hexId}.`);

  renderUnits();
  applySelection(def.hex); // keep selection on defender during retreat
  stepRetreatOrAuto();
}

// Main click handler
function onHexClick(hexId) {
  setErrors([]);

  if (!board) return;

  // PLAY mode logic first
  if (mode === "PLAY") {
    if (gameOver) {
      applySelection(hexId);
      setErrors([`GAME OVER (${winner || "?"}). Use New Scenario or Reset Score to continue.`]);
      return;
    }

    if (phase === "RETREAT") {
      handleRetreatClick(hexId);
      return;
    }

    // If current selection is an active attacker and clicked hex is an adjacent enemy => attack
    if (selectedHex != null) {
      const attacker = unitAtHex(selectedHex);
      const defender = unitAtHex(hexId);

      if (attacker && defender &&
          attacker.side === scenario.turn.side &&
          defender.side !== attacker.side &&
          canActNow() &&
          isAdjacent(attacker.hex, defender.hex)) {

        // spend activation up front (activation is the attack)
        scenario.turn.activationsLeft -= 1;

        const dice = meleeDiceCount(attacker, defender);
        const rolls = rollDice(dice);
        const { hits, retreats } = analyzeRolls(rolls);

        pushLog(`${attacker.side} ${attacker.type}(${attacker.id}) attacks ${defender.side} ${defender.type}(${defender.id}) @${defender.hex} :: dice=${dice} rolls=[${rolls.join(",")}] => hits=${hits}, retreats=${retreats}`);

        let remRetreats = retreats;

        // Cancel retreats (quality/support)
        const cancels = retreatCancelCount(defender, remRetreats);
        if (cancels > 0) {
          remRetreats = Math.max(0, remRetreats - cancels);
          pushLog(`Defender cancels ${cancels} retreat(s) (quality/support). Retreats remaining=${remRetreats}.`);
        }

        // Apply hits
        if (hits > 0) {
          defender.hp -= hits;
          pushLog(`Hits applied: ${defender.side} ${defender.type}(${defender.id}) hp now ${defender.hp}/${maxHp(defender.type, defender.quality)}.`);
        } else {
          pushLog(`No hits.`);
        }

        if (defender.hp <= 0) {
          destroyUnit(defender, attacker.side, "Combat");
          // After destruction, clear selection to avoid pointing at dead unit
          selectedHex = null;
          selectedUnitId = null;
          elSelection.textContent = "Choose a unit.";
          clearSelectionStyles();
          clearActionHighlights();
          updateTruth();
          if (scenario.turn.activationsLeft <= 0) pushLog("No activations left. Press End Turn.");
          return;
        }

        // Apply retreats
        renderUnits();

        if (remRetreats > 0) {
          beginRetreat(defender.id, attacker.hex, attacker.side, remRetreats);
          // During retreat phase we keep selection on defender
          applySelection(defender.hex);
          if (scenario.turn.activationsLeft <= 0) pushLog("No activations left (after this activation completes). Press End Turn.");
          return;
        }

        // No retreats: action ends
        applySelection(defender.hex);
        updateTruth();
        if (scenario.turn.activationsLeft <= 0) pushLog("No activations left. Press End Turn.");
        return;
      }
    }

    // Otherwise: just select
    applySelection(hexId);
    return;
  }

  // EDIT mode
  applySelection(hexId);

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
    if (existing) return; // no stacking; selection only

    const side = elSide.value;
    const type = elType.value;
    const quality = elQuality.value;
    if (!SIDES.includes(side) || !UNIT_TYPES.includes(type) || !QUALITIES.includes(quality)) return;

    const mhp = maxHp(type, quality);
    const hpWanted = clampInt(elHpPlace.value, 1, mhp);

    const unit = { id: nextUnitId(side, type), side, type, quality, hp: hpWanted, hex: hexId };
    scenario.units.push(unit);

    renderUnits();
    applySelection(hexId);
    updateTruth();
    return;
  }
}

// Turn controls
function endTurn() {
  setErrors([]);

  if (mode !== "PLAY") {
    setErrors(["End Turn only applies in Play mode."]);
    return;
  }

  if (phase === "RETREAT") {
    setErrors(["Cannot end turn during retreat. Finish the retreat steps first."]);
    return;
  }

  if (gameOver) {
    setErrors([`GAME OVER (${winner || "?"}). Use New Scenario or Reset Score.`]);
    return;
  }

  scenario.turn.side = otherSide(scenario.turn.side);
  scenario.turn.turnNumber += 1;
  scenario.turn.activationsLeft = 3;

  selectedHex = null;
  selectedUnitId = null;
  elSelection.textContent = "Choose a unit.";

  clearSelectionStyles();
  clearActionHighlights();

  pushLog(`--- Turn ${scenario.turn.turnNumber}: ${scenario.turn.side} (activations 3) ---`);
  updateTruth();
}

function resetScore() {
  ensureMeta(scenario);
  scenario.meta.score.BLUE = 0;
  scenario.meta.score.RED = 0;
  gameOver = false;
  winner = null;
  pushLog("Score reset.");
  updateTruth();
}

// Board loading + rendering
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

  if (!opts.keepScenario) {
    scenario = defaultScenario(boardId);
    elJson.value = "";
  } else {
    scenario.board = boardId;
  }

  // Reset transient play state on board load
  phase = "NORMAL";
  retreatCtx = null;
  gameOver = false;
  winner = null;

  renderBoard();
  renderTerrain();
  renderUnits();

  selectedHex = null;
  selectedUnitId = null;
  elSelection.textContent = "Click a hex to inspect.";

  updateToolUI();
  refreshHighlights();
  updateTruth();

  pushLog(`Loaded board ${boardId}.`);
}

function renderBoard() {
  // Layout constants (match viewer)
  const size = 18;
  const unitX = (Math.sqrt(3) / 2) * size; // one x2 step
  const unitY = 1.5 * size;                // row step
  const pad = 24;

  posById.clear();
  polyById.clear();
  labelById.clear();

  // bounds
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

  unitsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  unitsLayer.classList.add("unitsLayer");
  svg.appendChild(unitsLayer);

  elStage.appendChild(svg);
  setShowIds(elShowIds.checked);
}

// Edit actions
function deleteSelectedUnit() {
  if (mode !== "EDIT") return;
  if (selectedHex == null) return;
  const u = unitAtHex(selectedHex);
  if (!u) return;
  scenario.units = scenario.units.filter(x => x.id !== u.id);
  renderUnits();
  applySelection(selectedHex);
  updateTruth();
}

function applyHpToSelected() {
  if (mode !== "EDIT") return;
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

// Wire UI
for (const r of document.querySelectorAll('input[name="tool"]')) {
  r.addEventListener("change", () => setTool(r.value));
}

elMode.addEventListener("change", () => setMode(elMode.value));
elBoard.addEventListener("change", () => loadBoard(elBoard.value, { keepScenario: false }));
elShowIds.addEventListener("change", () => { setShowIds(elShowIds.checked); });

elNew.addEventListener("click", () => newScenario());
elExport.addEventListener("click", () => exportScenario());
elImport.addEventListener("click", () => importScenario());
elValidate.addEventListener("click", () => validateCurrent());
elCopy.addEventListener("click", () => copyJson());

elType.addEventListener("change", () => syncHpPlace());
elQuality.addEventListener("change", () => syncHpPlace());

elDeleteUnit.addEventListener("click", () => deleteSelectedUnit());
elApplyHp.addEventListener("click", () => applyHpToSelected());

elEndTurn.addEventListener("click", () => endTurn());
elResetScore.addEventListener("click", () => resetScore());
elClearLog.addEventListener("click", () => clearLog());

// Init
function init() {
  syncHpPlace();
  setMode("EDIT");
  setTool("INSPECT");
  loadBoard(elBoard.value, { keepScenario: false });
}

init();
