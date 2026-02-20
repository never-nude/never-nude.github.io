// MOVE_RESET_LAB_V1
(() => {
  const ACTIVATIONS_PER_TURN = 3;
  const MOVE_RANGE = { INF:1, ARC:1, SLG:2, SKR:2, CAV:3, GEN:3 };

  const $ = (id) => document.getElementById(id);
  const board = $("board");
  const selectedBox = $("selectedBox");
  const logBox = $("logBox");
  const truthBox = $("truthBox");
  const truthPill = $("truthPill");
  const turnPill = $("turnPill");
  const actPill = $("actPill");
  const statusEl = $("status");
  const endTurnBtn = $("endTurnBtn");
  const resetBtn = $("resetBtn");

  const key = (r,c) => `${r},${c}`;

  const state = {
    turnSide: "Blue",
    activationsUsed: 0,
    actedIds: new Set(),     // stable, keyed by unit.id
    selectedId: null,
    legalMoves: new Set(),   // keys
    units: [],               // mutable unit objects
    unitsById: new Map(),
    liveSet: new Set(),
    hexByKey: new Map(),
    layout: null,
    scenario: null
  };

  function log(msg) {
    const t = new Date().toLocaleTimeString();
    const lines = (logBox.textContent || "").split("\n").filter(Boolean);
    lines.unshift(`[${t}] ${msg}`);
    logBox.textContent = lines.slice(0, 14).join("\n");
  }

  function setStatus(msg, kind="") {
    statusEl.className = "status" + (kind ? " " + kind : "");
    statusEl.textContent = msg;
  }

  function updateTopbar() {
    turnPill.textContent = `Turn: ${state.turnSide}`;
    actPill.textContent = `Activations: ${state.activationsUsed}/${ACTIVATIONS_PER_TURN}`;
  }

  // Odd-r offset neighbors (pointy-top rows)
  const OFF_EVEN = [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]];
  const OFF_ODD  = [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]];
  function neighbors(r,c) {
    const offs = (r % 2 === 0) ? OFF_EVEN : OFF_ODD;
    const out = [];
    for (const [dr,dc] of offs) {
      const nr = r + dr, nc = c + dc;
      const k = key(nr,nc);
      if (state.liveSet.has(k)) out.push([nr,nc]);
    }
    return out;
  }

  function hexPoints(cx, cy, size) {
    const pts = [];
    for (let i=0; i<6; i++) {
      const a = (Math.PI/180) * (30 + i*60); // pointy-top
      const x = cx + size * Math.cos(a);
      const y = cy + size * Math.sin(a);
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return pts.join(" ");
  }

  function buildBoard() {
    board.innerHTML = "";
    state.hexByKey.clear();

    const hexSize = 22;
    const w = Math.sqrt(3) * hexSize;
    const vStep = 1.5 * hexSize;
    const padX = 40, padY = 40;

    for (const h of state.layout.hexes) {
      const r = h.r, c = h.c;
      const cx = padX + c*w + (r%2)*w/2;
      const cy = padY + r*vStep;

      const poly = document.createElementNS("http://www.w3.org/2000/svg","polygon");
      poly.setAttribute("points", hexPoints(cx, cy, hexSize));
      poly.setAttribute("class", "hex");
      poly.dataset.r = String(r);
      poly.dataset.c = String(c);
      board.appendChild(poly);
      state.hexByKey.set(key(r,c), poly);
    }

    // Click handling (hex clicks OR unit clicks)
    board.addEventListener("click", (e) => {
      const unitEl = e.target.closest("[data-unit-id]");
      if (unitEl) {
        selectUnit(unitEl.dataset.unitId);
        return;
      }
      const hexEl = e.target.closest("polygon[data-r][data-c]");
      if (!hexEl) return;

      if (!state.selectedId) return;
      const r = parseInt(hexEl.dataset.r, 10);
      const c = parseInt(hexEl.dataset.c, 10);
      tryMoveSelectedTo(r,c);
    });
  }

  function renderUnits() {
    // Remove old units (we'll re-add)
    // Keep hex polys intact.
    const olds = board.querySelectorAll("g.unit");
    olds.forEach(n => n.remove());

    const hexSize = 22;
    const w = Math.sqrt(3) * hexSize;
    const vStep = 1.5 * hexSize;
    const padX = 40, padY = 40;

    for (const u of state.units) {
      const cx = padX + u.c*w + (u.r%2)*w/2;
      const cy = padY + u.r*vStep;

      const g = document.createElementNS("http://www.w3.org/2000/svg","g");
      g.setAttribute("class", "unit");
      g.dataset.unitId = u.id;
      g.setAttribute("transform", `translate(${cx.toFixed(2)},${cy.toFixed(2)})`);

      // Simple shape by type
      let shape;
      if (u.type === "INF") {
        shape = document.createElementNS("http://www.w3.org/2000/svg","rect");
        shape.setAttribute("x","-14"); shape.setAttribute("y","-11");
        shape.setAttribute("width","28"); shape.setAttribute("height","22");
        shape.setAttribute("rx","5");
      } else if (u.type === "CAV") {
        shape = document.createElementNS("http://www.w3.org/2000/svg","polygon");
        shape.setAttribute("points","0,-13 13,0 0,13 -13,0");
      } else if (u.type === "ARC") {
        shape = document.createElementNS("http://www.w3.org/2000/svg","polygon");
        shape.setAttribute("points","0,-13 13,11 -13,11");
      } else if (u.type === "GEN") {
        shape = document.createElementNS("http://www.w3.org/2000/svg","circle");
        shape.setAttribute("r","13");
      } else { // SKR/SLG default
        shape = document.createElementNS("http://www.w3.org/2000/svg","circle");
        shape.setAttribute("r","12");
      }

      shape.setAttribute("class","unitShape");
      shape.setAttribute("fill", u.side === "Blue" ? "#dbeafe" : "#fee2e2");
      g.appendChild(shape);

      // UNIT_UI_STACK_V1 (type above, hp below)
      const tType = document.createElementNS("http://www.w3.org/2000/svg","text");
      tType.setAttribute("class","uText uType");
      tType.setAttribute("text-anchor","middle");
      tType.setAttribute("dominant-baseline","central");
      tType.setAttribute("y","-3");
      tType.textContent = `${u.type}`;
      g.appendChild(tType);

      const tHP = document.createElementNS("http://www.w3.org/2000/svg","text");
      tHP.setAttribute("class","uText uHP");
      tHP.setAttribute("text-anchor","middle");
      tHP.setAttribute("dominant-baseline","central");
      tHP.setAttribute("y","6");
      tHP.textContent = `${u.hp}`;
      g.appendChild(tHP);

      board.appendChild(g);
    }
  }

  function occupiedSet() {
    const occ = new Set();
    for (const u of state.units) occ.add(key(u.r,u.c));
    return occ;
  }

  function legalMovesFor(u) {
    const range = MOVE_RANGE[u.type] ?? 1;
    const start = key(u.r,u.c);
    const occ = occupiedSet();
    occ.delete(start);

    const q = [[u.r,u.c,0]];
    const visited = new Set([start]);
    const legal = new Set();

    while (q.length) {
      const [r,c,d] = q.shift();
      if (d === range) continue;
      for (const [nr,nc] of neighbors(r,c)) {
        const k = key(nr,nc);
        if (visited.has(k)) continue;
        if (occ.has(k)) continue; // blocked
        visited.add(k);
        legal.add(k);
        q.push([nr,nc,d+1]);
      }
    }
    return legal;
  }

  function clearHexHighlights() {
    for (const poly of state.hexByKey.values()) {
      poly.classList.remove("legal","sel");
    }
  }

  function selectUnit(unitId) {
    const u = state.unitsById.get(unitId);
    if (!u) return;

    state.selectedId = unitId;

    // Compute legal moves only if eligible this turn
    state.legalMoves = new Set();
    if (u.side !== state.turnSide) {
      setStatus("Not your turn for that unit.", "bad");
    } else if (state.activationsUsed >= ACTIVATIONS_PER_TURN) {
      setStatus("No activations left. End Turn.", "bad");
    } else if (state.actedIds.has(u.id)) {
      setStatus("This unit already acted this turn.", "bad");
    } else {
      state.legalMoves = legalMovesFor(u);
      setStatus("Select a highlighted hex to move.", "good");
    }

    renderSelectionPanel();
    renderHighlights();
  }

  function renderSelectionPanel() {
    const u = state.selectedId ? state.unitsById.get(state.selectedId) : null;
    if (!u) {
      selectedBox.textContent = "(none)";
      return;
    }
    const acted = state.actedIds.has(u.id) ? "YES" : "NO";
    const rng = MOVE_RANGE[u.type] ?? 1;
    selectedBox.textContent =
      `id: ${u.id}\n`+
      `side: ${u.side}\n`+
      `type: ${u.type}\n`+
      `hp: ${u.hp}/${u.maxHp}\n`+
      `acted this turn: ${acted}\n`+
      `move range: ${rng}\n`+
      `pos: (${u.r},${u.c})\n`+
      `legal moves: ${state.legalMoves.size}\n`;
  }

  function renderHighlights() {
    clearHexHighlights();

    const u = state.selectedId ? state.unitsById.get(state.selectedId) : null;
    if (u) {
      const k0 = key(u.r,u.c);
      const hex0 = state.hexByKey.get(k0);
      if (hex0) hex0.classList.add("sel");
    }

    for (const k of state.legalMoves) {
      const poly = state.hexByKey.get(k);
      if (poly) poly.classList.add("legal");
    }
  }

  function tryMoveSelectedTo(r,c) {
    const u = state.selectedId ? state.unitsById.get(state.selectedId) : null;
    if (!u) return;

    // HARD INVARIANTS (stop bleeding)
    if (u.side !== state.turnSide) { setStatus("Not your turn.", "bad"); return; }
    if (state.activationsUsed >= ACTIVATIONS_PER_TURN) { setStatus("No activations left. End Turn.", "bad"); return; }
    if (state.actedIds.has(u.id)) { setStatus("This unit already acted this turn.", "bad"); return; }

    const destKey = key(r,c);
    // Recompute legal moves right now (avoid stale)
    const legalNow = legalMovesFor(u);
    if (!legalNow.has(destKey)) { setStatus("Illegal destination.", "bad"); return; }

    // Apply move
    u.r = r; u.c = c;
    state.activationsUsed += 1;
    state.actedIds.add(u.id);

    log(`MOVE ${u.id} -> (${r},${c}) | activations ${state.activationsUsed}/${ACTIVATIONS_PER_TURN}`);
    updateTopbar();
    renderUnits();
    // Re-select the same unit to show it is now locked
    selectUnit(u.id);
  }

  function endTurn() {
    state.turnSide = (state.turnSide === "Blue") ? "Red" : "Blue";
    state.activationsUsed = 0;
    state.actedIds = new Set();
    state.legalMoves = new Set();
    setStatus(`Turn switched. Now: ${state.turnSide}`, "good");
    log(`END TURN -> ${state.turnSide}`);
    updateTopbar();
    renderHighlights();
    renderSelectionPanel();
  }

  function resetGame() {
    // Reload scenario units fresh
    const base = JSON.parse(JSON.stringify(state.scenario));
    state.units = base.units.map(u => ({
      id: u.id, side: u.side, type: u.type, quality: u.quality,
      hp: u.hp, maxHp: u.maxHp, r: u.r, c: u.c
    }));
    state.unitsById = new Map(state.units.map(u => [u.id, u]));
    state.turnSide = "Blue";
    state.activationsUsed = 0;
    state.actedIds = new Set();
    state.selectedId = null;
    state.legalMoves = new Set();

    renderUnits();
    clearHexHighlights();
    renderSelectionPanel();
    updateTopbar();
    setStatus("Reset complete. Blue to act.", "good");
    log("RESET");
  }

  async function boot() {
    // TRUTH (lab)
    const t = await fetch(`TRUTH.txt?ts=${Date.now()}`).then(r => r.text());
    truthBox.textContent = t.trim();
    const m = t.match(/^BUILD_ID=(.+)$/m);
    truthPill.textContent = m ? `Invictus G Lab • BUILD ${m[1].trim()}` : "Invictus G Lab";

    state.layout = await fetch(`board_layout.json?ts=${Date.now()}`).then(r => r.json());
    state.scenario = await fetch(`scenario.json?ts=${Date.now()}`).then(r => r.json());

    // Build liveSet
    state.liveSet = new Set(state.layout.hexes.map(h => key(h.r,h.c)));

    buildBoard();
    endTurnBtn.addEventListener("click", endTurn);
    resetBtn.addEventListener("click", resetGame);

    resetGame();
  }

  boot().catch(err => {
    console.error(err);
    setStatus("BOOT ERROR: " + (err && err.message ? err.message : String(err)), "bad");
  });
})();

// UNIT_UI_STACK_V1_PROOF

// UNIT_UI_PADDING_V2_PROOF
