function qualityOutline(q) {
  const s = String(q || "Regular").toLowerCase();
  if (s.startsWith("g")) return { color: "rgba(48,209,88,0.95)", w: 3 };   // Green
  if (s.startsWith("v")) return { color: "rgba(255,193,7,0.95)", w: 4 };   // Veteran
  return { color: "rgba(230,230,230,0.55)", w: 2 };                        // Regular
}

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
    legalMoves: new Set(),
    legalAttacks: new Map(),   // key -> target unit id   // keys
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

    // HAMMERFALL_V1: unit clicks can become attacks when a friendly is selected
    board.addEventListener("click", (e) => {
      const unitEl = e.target.closest("[data-unit-id]");
      if (unitEl) {
        const clickedId = unitEl.dataset.unitId;

        // If we have a selected friendly, and clicked is an attackable enemy, attack.
        if (state.selectedId) {
          const a = state.unitsById.get(state.selectedId);
          const t = state.unitsById.get(clickedId);
          if (a && t && a.side === state.turnSide && t.side !== a.side) {
            const k = key(t.r, t.c);
            if (state.legalAttacks && state.legalAttacks.get(k) === t.id) {
              tryAttackSelectedOn(t.id);
              return;
            }
          }
        }

        selectUnit(clickedId);
        return;
      }

      const hexEl = e.target.closest("polygon[data-r][data-c]");
      if (!hexEl) return;
      if (!state.selectedId) return;

      const r = parseInt(hexEl.dataset.r, 10);
      const c = parseInt(hexEl.dataset.c, 10);
      const k = key(r,c);

      if (state.legalAttacks && state.legalAttacks.has(k)) {
        tryAttackSelectedOn(state.legalAttacks.get(k));
        return;
      }

      tryMoveSelectedTo(r,c);
    });
  }



  function renderUnits() {
    // UNIT_UI_PADDING_V3 (single-owner token rendering)
    // Remove old units (we'll re-add)
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

      // QUALITY_DATASET_V1
      // Normalize quality strings so CSS selectors stay stable
      const qRaw = (u.quality || "Regular").toString().toLowerCase();
      let q = "Regular";
      if (qRaw.startsWith("g")) q = "Green";
      else if (qRaw.startsWith("v")) q = "Veteran";
      g.dataset.quality = q;

      g.setAttribute("transform", `translate(${cx.toFixed(2)},${cy.toFixed(2)})`);

      // Slightly larger shapes for breathing room
      let shape;
      if (u.type === "INF") {
        shape = document.createElementNS("http://www.w3.org/2000/svg","rect");
        shape.setAttribute("x","-15"); shape.setAttribute("y","-12");
        shape.setAttribute("width","30"); shape.setAttribute("height","24");
        shape.setAttribute("rx","5");
      } else if (u.type === "CAV") {
        shape = document.createElementNS("http://www.w3.org/2000/svg","polygon");
        shape.setAttribute("points","0,-15 15,0 0,15 -15,0");
      } else if (u.type === "ARC") {
        shape = document.createElementNS("http://www.w3.org/2000/svg","polygon");
        shape.setAttribute("points","0,-15 15,12 -15,12");
      } else if (u.type === "GEN") {
        // GEN_STAR_V1
        shape = document.createElementNS("http://www.w3.org/2000/svg","polygon");
        shape.setAttribute("points","0.0,-16.1 4.0,-5.6 15.3,-5.0 6.6,2.2 9.4,13.0 0.0,6.9 -9.4,13.0 -6.6,2.2 -15.3,-5.0 -4.0,-5.6");
} else {
        shape = document.createElementNS("http://www.w3.org/2000/svg","circle");
        shape.setAttribute("r","13"); // SKR/SLG etc
      }

      shape.setAttribute("class","unitShape");
      shape.setAttribute("fill", u.side === "Blue" ? "#dbeafe" : "#fee2e2");
      g.appendChild(shape);

      // Two-line label (type above, hp below) with more margin
      const tType = document.createElementNS("http://www.w3.org/2000/svg","text");
      tType.setAttribute("class","uText uType");
      tType.setAttribute("text-anchor","middle");
      tType.setAttribute("dominant-baseline","central");
      tType.setAttribute("y", u.type === "GEN" ? "-4" : (u.type === "ARC" ? "-2" : "-5"));
tType.textContent = `${u.type}`;
      g.appendChild(tType);

      const tHP = document.createElementNS("http://www.w3.org/2000/svg","text");
      tHP.setAttribute("class","uText uHP");
      tHP.setAttribute("text-anchor","middle");
      tHP.setAttribute("dominant-baseline","central");
      tHP.setAttribute("y", u.type === "GEN" ? "4" : "7");
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
    // ENGAGEMENT_LOCK_V1_MOVES_GUARD
    if (adjacentEnemiesFor(u).size > 0) return new Set();

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
      poly.classList.remove("legal","sel","atk");
    }
  }



  function selectUnit(unitId) {
    const u = state.unitsById.get(unitId);
    if (!u) return;

    state.selectedId = unitId;
    state.legalMoves = new Set();
    state.legalAttacks = new Map();

    if (u.side !== state.turnSide) {
      setStatus("Not your turn for that unit.", "bad");
    } else if (state.activationsUsed >= ACTIVATIONS_PER_TURN) {
      setStatus("No activations left. End Turn.", "bad");
    } else if (state.actedIds.has(u.id)) {
      setStatus("This unit already acted this turn.", "bad");
    } else {
      const adj = adjacentEnemiesFor(u);
      if (adj.size > 0) {
        // Hard lock: no voluntary retreat/move while engaged.
        state.legalMoves = new Set();
        state.legalAttacks = adj; // adjacent only
        setStatus("Engaged: attack only (no voluntary retreat).", "good");
      } else {
        state.legalMoves = legalMovesFor(u);
        state.legalAttacks = attackablesFor(u);
        if (state.legalAttacks.size > 0) setStatus("Move (blue) or attack (red).", "good");
        else setStatus("Select a highlighted hex to move.", "good");
      }
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
    const adjN = adjacentEnemiesFor(u).size;
    const engaged = adjN > 0 ? "YES" : "NO";
    const atkN = state.legalAttacks ? state.legalAttacks.size : 0;

    selectedBox.textContent =
      `id: ${u.id}\n`+
      `side: ${u.side}\n`+
      `type: ${u.type}\n`+
      `quality: ${u.quality}\n`+
      `hp: ${u.hp}/${u.maxHp}\n`+
      `acted this turn: ${acted}\n`+
      `engaged: ${engaged} (adjacent enemies: ${adjN})\n`+
      `move range: ${rng}\n`+
      `attackable targets: ${atkN}\n`+
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

    if (state.legalAttacks) {
      for (const k of state.legalAttacks.keys()) {
        const poly = state.hexByKey.get(k);
        if (poly) poly.classList.add("atk");
      }
    }
  }



  
    // IMPETUS_V1: combat + retreats (hits: 5-6, retreats: 4; blocked retreat => +1 HP per blocked step)
  // IMPETUS_V1_PROOF

  const ATTACK_DICE = { INF:3, CAV:3, SKR:2, SLG:2, ARC:2, GEN:1 };

  function unitAt(r,c) {
    for (const u of state.units) {
      if (u.r === r && u.c === c) return u;
    }
    return null;
  }

  
  // ENGAGEMENT_LOCK_V1: adjacency = contact. No voluntary break-away.
  function adjacentEnemiesFor(u) {
    const m = new Map(); // hexKey -> targetId
    for (const [nr,nc] of neighbors(u.r,u.c)) {
      const t = unitAt(nr,nc);
      if (t && t.side !== u.side) m.set(key(nr,nc), t.id);
    }
    return m;
  }

function attackablesFor(u) {
    const m = new Map(); // hexKey -> targetId
    for (const [nr,nc] of neighbors(u.r,u.c)) {
      const t = unitAt(nr,nc);
      if (t && t.side !== u.side) m.set(key(nr,nc), t.id);
    }
    return m;
  }

  // Odd-r offset -> cube coords for real hex distance
  function oddrToCube(r,c) {
    const x = c - ((r - (r & 1)) / 2);
    const z = r;
    const y = -x - z;
    return {x,y,z};
  }
  function hexDist(r1,c1,r2,c2) {
    const a = oddrToCube(r1,c1);
    const b = oddrToCube(r2,c2);
    return (Math.abs(a.x-b.x) + Math.abs(a.y-b.y) + Math.abs(a.z-b.z)) / 2;
  }

  function chooseRetreatHex(attacker, defender) {
    const occ = new Set(state.units.map(u => key(u.r,u.c)));
    occ.delete(key(defender.r, defender.c));

    let best = null;
    let bestD = -1;

    for (const [nr,nc] of neighbors(defender.r, defender.c)) {
      const k = key(nr,nc);
      if (occ.has(k)) continue;
      const d = hexDist(attacker.r, attacker.c, nr, nc);
      if (d > bestD) { bestD = d; best = [nr,nc]; }
    }
    return best; // may be null
  }

  function applyRetreats(attacker, defender, retreatCount) {
    let moved = 0;
    let blocked = 0;

    for (let i=0; i<retreatCount; i++) {
      const dest = chooseRetreatHex(attacker, defender);
      if (!dest) { blocked += 1; continue; }
      defender.r = dest[0];
      defender.c = dest[1];
      moved += 1;
    }
    return {moved, blocked};
  }

  function rollCombat(attackerType, diceN) {
    const rolls = [];
    let hits = 0;
    let retreats = 0;

    for (let i=0; i<diceN; i++) {
      const d = 1 + Math.floor(Math.random() * 6);
      rolls.push(d);

      if (attackerType === "GEN") {
        // GEN: only a 6 is a hit; no retreat pressure (keeps it faithful to "only hits on 6")
        if (d === 6) hits += 1;
      } else {
        if (d >= 5) hits += 1;
        else if (d === 4) retreats += 1;
      }
    }
    return {rolls, hits, retreats};
  }

  function tryAttackSelectedOn(targetId) {
    const attacker = state.selectedId ? state.unitsById.get(state.selectedId) : null;
    const defender = state.unitsById.get(targetId);
    if (!attacker || !defender) return;

    // Hard invariants (stop bleeding)
    if (attacker.side !== state.turnSide) { setStatus("Not your turn.", "bad"); return; }
    if (state.activationsUsed >= ACTIVATIONS_PER_TURN) { setStatus("No activations left. End Turn.", "bad"); return; }
    if (state.actedIds.has(attacker.id)) { setStatus("This unit already acted this turn.", "bad"); return; }
    if (defender.side === attacker.side) { setStatus("Can't attack friendly.", "bad"); return; }

    // Recompute adjacency (avoid stale UI)
    const atkMap = attackablesFor(attacker);
    const k = key(defender.r, defender.c);
    if (!atkMap.has(k) || atkMap.get(k) !== defender.id) {
      setStatus("Target not attackable (must be adjacent).", "bad");
      return;
    }

    const diceN = ATTACK_DICE[attacker.type] ?? 2;
    const {rolls, hits, retreats} = rollCombat(attacker.type, diceN);

    // Spend activation regardless of result
    state.activationsUsed += 1;
    state.actedIds.add(attacker.id);

    const hp0 = defender.hp;

    // Apply hits first
    defender.hp = Math.max(0, defender.hp - hits);

    // Apply retreats (and blocked-retreat damage) if still alive
    let moved = 0, blocked = 0;
    if (defender.hp > 0 && retreats > 0) {
      const rr = applyRetreats(attacker, defender, retreats);
      moved = rr.moved;
      blocked = rr.blocked;
      if (blocked > 0) defender.hp = Math.max(0, defender.hp - blocked);
    }

    log(`ATTACK ${attacker.id}(${attacker.type}) -> ${defender.id}(${defender.type}) dice=${diceN} rolls=[${rolls.join(",")}] hits=${hits} retreats=${retreats} moved=${moved} blocked=${blocked} HP ${hp0}->${defender.hp}`);

    // Kill check
    if (defender.hp <= 0) {
      log(`KILL ${defender.id}`);
      state.units = state.units.filter(u => u.id !== defender.id);
      state.unitsById.delete(defender.id);
      if (state.selectedId === defender.id) state.selectedId = attacker.id;
    }

    updateTopbar();
    renderUnits();
    selectUnit(attacker.id); // re-select to show lockout this turn
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
    state.legalAttacks = new Map();
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
    state.legalAttacks = new Map();

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

// UNIT_UI_PADDING_V3_PROOF

// GEN_STAR_V1_PROOF

// QUALITY_OUTLINE_V1_PROOF

// GEN_HP_CENTER_V1_PROOF

// GEN_ARC_LABEL_LOWER_V1_PROOF

// GEN_LABEL_DOWN_V2_PROOF

// HAMMERFALL_V1_PROOF

// ENGAGEMENT_LOCK_V1_PROOF
