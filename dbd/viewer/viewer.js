/* DBD Board Viewer (Calibration) */

const BOARD_FILES = {
  "DBD-157-v1": "../board_157_v1.json",
  "DBD-157-PASS-v1": "../board_157_pass_v1.json",
  "DBD-157-CORRIDOR-v1": "../board_157_corridor_v1.json",
};

const elTruth = document.getElementById("truth");
const elStage = document.getElementById("stage");
const elSelect = document.getElementById("boardSelect");
const elShowIds = document.getElementById("showIds");
const elReload = document.getElementById("reloadBtn");
const elSelection = document.getElementById("selection");

let current = {
  boardId: null,
  data: null,
  svg: null,
  polyById: new Map(),
  labelById: new Map(),
  selectedId: null,
};

function qs(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function setTruth(lines) {
  elTruth.textContent = lines.join("\n");
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
  const neigh = new Map(hexes.map(h => [h.id, h.neighbors]));
  const start = hexes[0].id;
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    const ns = neigh.get(cur) || [];
    for (const nxt of ns) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        q.push(nxt);
      }
    }
  }
  return seen.size === hexes.length;
}

function clearSelectionStyles() {
  for (const poly of current.polyById.values()) {
    poly.classList.remove("selected", "neighbor");
  }
}

function applySelection(id) {
  current.selectedId = id;
  clearSelectionStyles();

  const h = current.data.hexes.find(x => x.id === id);
  if (!h) return;

  const poly = current.polyById.get(id);
  if (poly) poly.classList.add("selected");

  const neighbors = h.neighbors || [];
  for (const nid of neighbors) {
    const p = current.polyById.get(nid);
    if (p) p.classList.add("neighbor");
  }

  elSelection.textContent =
    `Selected: ${id}  (row ${h.row}, col ${h.col})   Neighbors: [${neighbors.join(", ")}]`;
}

function render(board) {
  current.data = board;
  current.polyById.clear();
  current.labelById.clear();
  current.selectedId = null;

  // Layout constants
  const size = 18;
  const unitX = (Math.sqrt(3) / 2) * size; // one x2 step
  const unitY = 1.5 * size;                // row step
  const pad = 24;

  // Compute positions + bounds
  const pos = new Map();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const h of board.hexes) {
    const cx = pad + h.x2 * unitX;
    const cy = pad + h.row * unitY;
    pos.set(h.id, { cx, cy });

    minX = Math.min(minX, cx - size);
    minY = Math.min(minY, cy - size);
    maxX = Math.max(maxX, cx + size);
    maxY = Math.max(maxY, cy + size);
  }

  const width = (maxX - minX) + pad;
  const height = (maxY - minY) + pad;

  // Build SVG
  elStage.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `${minX - 12} ${minY - 12} ${width + 24} ${height + 24}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `DBD board ${board.boardId}`);

  // Draw hexes
  for (const h of board.hexes) {
    const { cx, cy } = pos.get(h.id);

    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", hexPolygonPoints(cx, cy, size));
    poly.classList.add("hex");
    poly.dataset.id = String(h.id);

    poly.addEventListener("click", () => applySelection(h.id));

    svg.appendChild(poly);
    current.polyById.set(h.id, poly);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", cx.toFixed(2));
    label.setAttribute("y", (cy + 3).toFixed(2));
    label.setAttribute("text-anchor", "middle");
    label.classList.add("hexlabel");
    label.textContent = String(h.id);
    svg.appendChild(label);
    current.labelById.set(h.id, label);
  }

  current.svg = svg;
  elStage.appendChild(svg);

  // Show/hide labels
  setShowIds(elShowIds.checked);

  // Truth badge
  const degs = board.hexes.map(h => (h.neighbors || []).length);
  const minDeg = Math.min(...degs);
  const maxDeg = Math.max(...degs);
  const connected = bfsConnected(board.hexes);

  setTruth([
    `viewer: dbd/viewer (calibration)`,
    `boardId: ${board.boardId}`,
    `hexCount field: ${board.hexCount} | computed: ${board.hexes.length}`,
    `degree(min,max): (${minDeg}, ${maxDeg})`,
    `connected: ${connected ? "YES" : "NO"}`
  ]);

  elSelection.textContent = "Click a hex to inspect neighbors.";
}

function setShowIds(on) {
  for (const t of current.labelById.values()) {
    t.style.display = on ? "block" : "none";
  }
}

async function loadBoard(boardId) {
  const file = BOARD_FILES[boardId];
  if (!file) {
    setTruth([`ERROR: no file mapping for boardId '${boardId}'`]);
    return;
  }
  const cb = Date.now();
  setTruth([`Loading ${boardId} …`, `file: ${file}`, `cb: ${cb}`]);

  const res = await fetch(`${file}?cb=${cb}`, { cache: "no-store" });
  if (!res.ok) {
    setTruth([`ERROR: fetch failed`, `${res.status} ${res.statusText}`, `url: ${res.url}`]);
    return;
  }
  const board = await res.json();
  render(board);
}

function init() {
  const urlBoard = qs("board");
  if (urlBoard && BOARD_FILES[urlBoard]) {
    elSelect.value = urlBoard;
  }

  elReload.addEventListener("click", () => loadBoard(elSelect.value));
  elSelect.addEventListener("change", () => loadBoard(elSelect.value));
  elShowIds.addEventListener("change", () => setShowIds(elShowIds.checked));

  loadBoard(elSelect.value);
}

init();
