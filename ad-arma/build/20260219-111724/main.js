(function(){
  const $ = (sel) => document.querySelector(sel);
  const build = window.AD_ARMA_BUILD_ID || "UNKNOWN";
  const port  = Number(window.location.port) || 9981;

  function computeBasePath(){
    let p = window.location.pathname || "/";
    if (p.endsWith("/")) return p;
    const last = p.split("/").pop() || "";
    if (last.includes(".")) return p.replace(/[^/]*$/, "");
    return p + "/";
  }
  const BASE = computeBasePath();
  const url = (rel) => BASE + String(rel).replace(/^\/+/, "");

  const ROW_COUNTS = [12,13,14,15,16,17,16,15,14,13,12];
  const ROWS = ROW_COUNTS.length;
  const TOTAL = ROW_COUNTS.reduce((a,b)=>a+b,0);

  const UNIT_TYPES = ["Cavalry","Infantry","Slingers","Archers","General"];
  const QUALS = ["Green","Regular","Veteran"];
  const SIDES = ["Blue","Red"];

  // Hex axial neighbors
  const DIRS = [
    {dq: 1, dr: 0}, {dq: 1, dr:-1}, {dq: 0, dr:-1},
    {dq:-1, dr: 0}, {dq:-1, dr: 1}, {dq: 0, dr: 1},
  ];

  // Geometry
  const SIZE = 28;
  const SQRT3 = Math.sqrt(3);
  const toPixel = (q, r) => ({ x: SQRT3 * SIZE * (q + r/2), y: 1.5 * SIZE * r });

  const state = {
    meta: { build, port, base: BASE, feature: "PLAY_MOVEMENT_V0" },
    board: {
      rowCounts: ROW_COUNTS,
      rows: ROWS,
      total: TOTAL,
      cells: [],
      cellMap: new Map(),
      viewBox: "0 0 10 10",
      selectedCellId: null,
      selectedUnitId: null,
      midX: null,
    },
    scenarios: { index: [], loadedId: null, loadedLabel: null },
    units: [],
    nextUnitId: 1,
    turn: {
      side: "Blue",
      activationLimit: 3,
      activationsUsed: 0,
      movedUnitIds: [],
    },
    ui: {
      editMode: true,
      tool: "place",
      side: "Blue",
      type: "Infantry",
      quality: "Regular",
      pings: 0,
      reachableIds: [],
    }
  };
  window.AD_ARMA_STATE = state;

  function stamp(){ return new Date().toISOString(); }
  function log(msg){
    const el = $("#log");
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + msg;
  }

  function updateHUD(){
    $("#modeLabel").textContent = state.ui.editMode ? "Edit" : "Play";
    $("#turnSide").textContent = state.turn.side;
    $("#actsUsed").textContent = String(state.turn.activationsUsed);
    $("#actsLimit").textContent = String(state.turn.activationLimit);
    $("#endTurn").disabled = state.ui.editMode;
  }

  function hexPoints(cx, cy, s){
    const pts = [];
    for (let i=0;i<6;i++){
      const angle = (Math.PI/180) * (60*i - 30);
      pts.push(`${(cx + s*Math.cos(angle)).toFixed(2)},${(cy + s*Math.sin(angle)).toFixed(2)}`);
    }
    return pts.join(" ");
  }

  function buildBoard(){
    const cells = [];
    const map = new Map();
    const rOffset = Math.floor(ROWS/2);
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;

    for (let row=0; row<ROWS; row++){
      const r = row - rOffset;
      const count = ROW_COUNTS[row];

      // Symmetry for this row-count pattern
      let qMin = -((r + (count - 1)) / 2);
      if (!Number.isInteger(qMin)) qMin = Math.round(qMin);

      for (let i=0;i<count;i++){
        const q = qMin + i;
        const {x,y} = toPixel(q,r);

        minX = Math.min(minX, x - SIZE);
        maxX = Math.max(maxX, x + SIZE);
        minY = Math.min(minY, y - SIZE);
        maxY = Math.max(maxY, y + SIZE);

        const cell = {
          id: `${q},${r}`,
          q, r,
          rowIndex: row,
          colIndex: i,
          x, y,
          points: hexPoints(x,y,SIZE),
        };
        cells.push(cell);
        map.set(cell.id, cell);
      }
    }

    state.board.midX = (minX + maxX) / 2;
    const margin = SIZE * 1.4;
    const vbX = (minX - margin);
    const vbY = (minY - margin);
    const vbW = (maxX - minX) + margin*2;
    const vbH = (maxY - minY) + margin*2;

    state.board.cells = cells;
    state.board.cellMap = map;
    state.board.viewBox = `${vbX.toFixed(2)} ${vbY.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}`;

    log(`[board] rows=${ROWS} total=${cells.length} (expected 157)`);
  }

  function cellExists(q,r){ return state.board.cellMap.has(`${q},${r}`); }
  function cellById(id){ return state.board.cellMap.get(id) || null; }

  function unitAt(q,r){
    return state.units.find(u => u.q === q && u.r === r) || null;
  }
  function unitById(id){
    return state.units.find(u => u.id === id) || null;
  }

  function typeLetter(t){
    if (t === "Infantry") return "I";
    if (t === "Cavalry")  return "C";
    if (t === "Slingers") return "S";
    if (t === "Archers")  return "A";
    if (t === "General")  return "G";
    // accept older synonym
    if (t === "Missiles") return "S";
    return "?";
  }
  function qualLetter(q){
    if (q === "Green") return "G";
    if (q === "Regular") return "R";
    if (q === "Veteran") return "V";
    return "?";
  }

  function movePointsFor(u){
    if (u.type === "Cavalry") return 2;
    return 1; // Infantry/Slingers/Archers/General
  }

  function movedSet(){ return new Set(state.turn.movedUnitIds); }
  function reachableSet(){ return new Set(state.ui.reachableIds); }

  function clearReachable(){ state.ui.reachableIds = []; }

  function computeReachableForUnit(u){
    const mp = movePointsFor(u);
    const startId = `${u.q},${u.r}`;

    const occ = new Set(state.units.map(x => `${x.q},${x.r}`));
    const visited = new Set([startId]);
    const out = new Set();

    const q = [];
    q.push({q:u.q, r:u.r, d:0});

    while (q.length){
      const cur = q.shift();
      if (cur.d >= mp) continue;

      for (const dir of DIRS){
        const nq = cur.q + dir.dq;
        const nr = cur.r + dir.dr;
        const nid = `${nq},${nr}`;
        if (visited.has(nid)) continue;
        visited.add(nid);

        if (!cellExists(nq,nr)) continue;
        if (occ.has(nid) && nid !== startId) continue; // cannot enter/through occupied

        out.add(nid);
        q.push({q:nq, r:nr, d:cur.d + 1});
      }
    }

    return Array.from(out);
  }

  function renderBoard(){
    const svg = $("#board");
    svg.setAttribute("viewBox", state.board.viewBox);

    const selCell = state.board.selectedCellId;
    const selUnit = state.board.selectedUnitId;
    const reach = reachableSet();
    const moved = movedSet();

    const parts = [];
    parts.push('<g id="hexes">');
    for (const c of state.board.cells){
      let cls = "hex";
      if (reach.has(c.id)) cls += " reachable";
      if (c.id === selCell) cls += " selected";
      parts.push(
        `<polygon class="${cls}" data-cell-id="${c.id}" points="${c.points}" vector-effect="non-scaling-stroke"></polygon>`
      );
    }
    parts.push("</g>");

    parts.push('<g id="units">');
    for (const u of state.units){
      const cell = cellById(`${u.q},${u.r}`);
      if (!cell) continue;

      const isSel = (u.id === selUnit);
      const clsSide = (u.side === "Red") ? "unitRed" : "unitBlue";

      const gcls = [];
      if (isSel) gcls.push("unitSelected");
      if (!state.ui.editMode && u.side === state.turn.side && moved.has(u.id)) gcls.push("unitMoved");

      const rTok = (u.type === "General") ? 16 : 14;

      parts.push(
        `<g data-unit-id="${u.id}" transform="translate(${cell.x.toFixed(2)} ${cell.y.toFixed(2)})" class="${gcls.join(" ")}">` +
          `<circle class="unitCircle ${clsSide}" r="${rTok}"></circle>` +
          `<text class="unitTextMain" y="-2">${typeLetter(u.type)}</text>` +
          `<text class="unitTextQual" y="11">${qualLetter(u.quality)}</text>` +
          `<title>${u.side} ${u.type} ${u.quality} (${u.id})</title>` +
        `</g>`
      );
    }
    parts.push("</g>");

    svg.innerHTML = parts.join("");

    $("#unitCount").textContent = String(state.units.length);
    $("#selected").textContent = selCell || "none";
    $("#loadedScenario").textContent = state.scenarios.loadedLabel || "none";
    $("#boardMeta").textContent =
      `board: rows=${ROWS} total=${state.board.cells.length} (expected 157) units=${state.units.length} base=${BASE}`;
  }

  async function loadTruth(){
    try{
      const res = await fetch(url(`TRUTH.txt?ts=${Date.now()}`), { cache: "no-store" });
      $("#truth").textContent = (await res.text()).trim();
      log(`[truth] ok @ ${stamp()}`);
    }catch(e){
      $("#truth").textContent = "TRUTH fetch failed";
      log(`[truth] ERROR: ${String(e)}`);
    }
  }

  async function loadScenarioIndex(){
    const sel = $("#scenarioSel");
    sel.innerHTML = `<option>loading…</option>`;
    try{
      const res = await fetch(url(`scenarios/index.json?ts=${Date.now()}`), { cache: "no-store" });
      if (!res.ok) throw new Error(`index status ${res.status}`);
      const arr = await res.json();
      if (!Array.isArray(arr) || !arr.length) throw new Error("index json empty/not array");
      state.scenarios.index = arr;

      sel.innerHTML = "";
      for (const s of arr){
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.label || s.id;
        sel.appendChild(opt);
      }
      log(`[scenario] index loaded (${arr.length})`);
    }catch(e){
      state.scenarios.index = [];
      sel.innerHTML = `<option value="">scenario index missing</option>`;
      log(`[scenario] ERROR index: ${String(e)}`);
    }
  }

  function normalizeUnit(u){
    const q = Number(u.q), r = Number(u.r);
    if (!Number.isFinite(q) || !Number.isFinite(r)) return None;
  }

  async function loadScenarioById(id){
    const entry = state.scenarios.index.find(x => x.id === id);
    if (!entry){ log(`[scenario] missing id=${id}`); return; }
    try{
      const res = await fetch(url(`scenarios/${entry.file}?ts=${Date.now()}`), { cache: "no-store" });
      if (!res.ok) throw new Error(`scenario status ${res.status}`);
      const data = await res.json();

      state.units = [];
      state.nextUnitId = 1;

      const unitsRaw = Array.isArray(data.units) ? data.units : [];
      for (const u of unitsRaw){
        if (!u) continue;
        const q = Number(u.q), r = Number(u.r);
        const side = (u.side === "Red") ? "Red" : "Blue";
        const type = UNIT_TYPES.includes(u.type) ? u.type : (u.type === "Missiles" ? "Slingers" : "Infantry");
        const quality = QUALS.includes(u.quality) ? u.quality : "Regular";
        if (!Number.isFinite(q) || !Number.isFinite(r)) continue;
        if (!cellExists(q,r)) continue;
        state.units.push({ id:`u${state.nextUnitId++}`, q, r, side, type, quality });
      }

      state.scenarios.loadedId = entry.id;
      state.scenarios.loadedLabel = entry.label || entry.id;

      // Reset turn state (important for legibility)
      state.turn.side = "Blue";
      state.turn.activationsUsed = 0;
      state.turn.movedUnitIds = [];
      state.board.selectedCellId = null;
      state.board.selectedUnitId = null;
      clearReachable();

      log(`[scenario] loaded ${state.scenarios.loadedLabel} units=${state.units.length}`);
      renderBoard();
      updateHUD();
    }catch(e){
      log(`[scenario] ERROR loading ${id}: ${String(e)}`);
    }
  }

  function syncUIFromControls(){
    state.ui.editMode = $("#editMode").checked;
    state.ui.tool = document.querySelector('input[name="tool"]:checked')?.value || "place";
    state.ui.side = $("#sideSel").value;
    state.ui.type = $("#typeSel").value;
    state.ui.quality = $("#qualSel").value;
  }

  function placeOrUpdateUnit(q,r){
    const existing = unitAt(q,r);
    if (existing){
      existing.side = state.ui.side;
      existing.type = state.ui.type;
      existing.quality = state.ui.quality;
      state.board.selectedUnitId = existing.id;
      log(`[edit] updated ${existing.id} @ ${q},${r} -> ${existing.side} ${existing.type} ${existing.quality}`);
      return;
    }
    const u = { id:`u${state.nextUnitId++}`, q, r, side: state.ui.side, type: state.ui.type, quality: state.ui.quality };
    state.units.push(u);
    state.board.selectedUnitId = u.id;
    log(`[edit] placed ${u.id} @ ${q},${r} -> ${u.side} ${u.type} ${u.quality}`);
  }

  function eraseUnit(q,r){
    const before = state.units.length;
    state.units = state.units.filter(u => !(u.q===q && u.r===r));
    if (state.units.length !== before){
      log(`[edit] erased unit @ ${q},${r}`);
      if (state.board.selectedUnitId){
        const still = state.units.some(u => u.id === state.board.selectedUnitId);
        if (!still) state.board.selectedUnitId = null;
      }
    }
  }

  function selectUnitForPlay(u){
    state.board.selectedUnitId = u.id;
    state.board.selectedCellId = `${u.q},${u.r}`;

    const moved = movedSet();
    const canAct = (u.side === state.turn.side) &&
                   (!moved.has(u.id)) &&
                   (state.turn.activationsUsed < state.turn.activationLimit);

    if (canAct){
      state.ui.reachableIds = computeReachableForUnit(u);
      log(`[play] selected ${u.id} ${u.side} ${u.type} mp=${movePointsFor(u)} reachable=${state.ui.reachableIds.length}`);
    }else{
      clearReachable();
      if (u.side !== state.turn.side) log(`[play] selected enemy unit (turn=${state.turn.side})`);
      else if (moved.has(u.id)) log(`[play] ${u.id} already moved this turn`);
      else log(`[play] no activations left`);
    }
  }

  function tryMoveSelectedTo(q,r){
    const u = unitById(state.board.selectedUnitId);
    if (!u) return;

    const targetId = `${q},${r}`;
    const reach = reachableSet();
    if (!reach.has(targetId)){
      log(`[play] not reachable: ${targetId}`);
      return;
    }
    if (unitAt(q,r)){
      log(`[play] blocked: occupied ${targetId}`);
      return;
    }
    if (u.side !== state.turn.side){
      log(`[play] not your turn (turn=${state.turn.side})`);
      return;
    }
    if (state.turn.activationsUsed >= state.turn.activationLimit){
      log(`[play] no activations left`);
      return;
    }
    const moved = movedSet();
    if (moved.has(u.id)){
      log(`[play] ${u.id} already moved`);
      return;
    }

    u.q = q; u.r = r;
    state.turn.activationsUsed += 1;
    state.turn.movedUnitIds = state.turn.movedUnitIds.concat([u.id]);

    state.board.selectedCellId = targetId;
    clearReachable();

    log(`[play] moved ${u.id} -> ${targetId} (acts ${state.turn.activationsUsed}/${state.turn.activationLimit})`);
    renderBoard();
    updateHUD();
  }

  function endTurn(){
    state.turn.side = (state.turn.side === "Blue") ? "Red" : "Blue";
    state.turn.activationsUsed = 0;
    state.turn.movedUnitIds = [];
    clearReachable();
    state.board.selectedUnitId = null;
    state.board.selectedCellId = null;
    log(`[turn] now ${state.turn.side}`);
    renderBoard();
    updateHUD();
  }

  function init(){
    $("#build").textContent = `Ad Arma v2 — BUILD ${build} — PORT ${port}`;

    let truthOpen = false;
    $("#truthToggle").addEventListener("click", () => {
      truthOpen = !truthOpen;
      $("#truth").style.display = truthOpen ? "block" : "none";
      $("#truthToggle").textContent = truthOpen ? "Truth ▾" : "Truth ▸";
    });

    buildBoard();
    syncUIFromControls();
    renderBoard();
    updateHUD();

    $("#controls").addEventListener("change", () => {
      syncUIFromControls();
      clearReachable();
      renderBoard();
      updateHUD();
    });

    $("#board").addEventListener("click", (e) => {
      syncUIFromControls();

      const unitG = e.target.closest("g[data-unit-id]");
      if (unitG){
        const uid = unitG.getAttribute("data-unit-id");
        const u = unitById(uid);
        if (!u) return;

        if (state.ui.editMode){
          // In edit mode, clicking the token behaves like clicking its cell
          state.board.selectedCellId = `${u.q},${u.r}`;
          if (state.ui.tool === "erase") eraseUnit(u.q,u.r);
          if (state.ui.tool === "place") placeOrUpdateUnit(u.q,u.r);
          renderBoard(); updateHUD();
          return;
        }

        // Play mode selection
        selectUnitForPlay(u);
        renderBoard(); updateHUD();
        return;
      }

      const poly = e.target.closest("polygon[data-cell-id]");
      if (!poly){
        state.board.selectedCellId = null;
        state.board.selectedUnitId = null;
        clearReachable();
        renderBoard(); updateHUD();
        return;
      }

      const id = poly.getAttribute("data-cell-id");
      const [qs, rs] = id.split(",");
      const q = Number(qs), r = Number(rs);

      state.board.selectedCellId = id;

      if (state.ui.editMode){
        if (state.ui.tool === "place") placeOrUpdateUnit(q,r);
        if (state.ui.tool === "erase") eraseUnit(q,r);
        renderBoard(); updateHUD();
        return;
      }

      // Play mode: if clicking empty reachable cell, move
      const clickedUnit = unitAt(q,r);
      if (clickedUnit){
        selectUnitForPlay(clickedUnit);
        renderBoard(); updateHUD();
        return;
      }

      // empty cell
      if (state.board.selectedUnitId){
        tryMoveSelectedTo(q,r);
        return;
      }else{
        clearReachable();
        renderBoard(); updateHUD();
      }
    });

    $("#ping").addEventListener("click", () => {
      state.ui.pings += 1;
      $("#pings").textContent = String(state.ui.pings);
      log(`[ping] #${state.ui.pings} @ ${stamp()} build=${build}`);
    });

    $("#loadScenario").addEventListener("click", () => {
      const id = $("#scenarioSel").value;
      if (id) loadScenarioById(id);
    });

    $("#endTurn").addEventListener("click", endTurn);

    loadTruth();
    loadScenarioIndex();
    log(`[boot] init @ ${stamp()} base=${BASE}`);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();