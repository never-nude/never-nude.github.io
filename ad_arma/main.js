(function(){
  const $ = (sel) => document.querySelector(sel);
  const build = window.AD_ARMA_BUILD_ID || "UNKNOWN";
  const port = Number(window.location.port) || 9981;

  const ROW_COUNTS = [12,13,14,15,16,17,16,15,14,13,12];
  const ROWS = ROW_COUNTS.length;

  const SIZE = 28;
  const SQRT3 = Math.sqrt(3);
  const toPixel = (q, r) => ({ x: SQRT3 * SIZE * (q + r/2), y: 1.5 * SIZE * r });

  const state = {
    meta: { build, port, feature: "SCENARIO_LOADING_V0" },
    board: { rowCounts: ROW_COUNTS, rows: ROWS, cells: [], viewBox: "0 0 10 10", selectedCellId: null, selectedUnitId: null, midX: null },
    units: [],
    nextUnitId: 1,
    scenarios: { index: [], loadedId: null, loadedLabel: null },
    ui: { editMode: true, tool: "place", side: "Blue", type: "Infantry", quality: "Regular", pings: 0 }
  };
  window.AD_ARMA_STATE = state;

  function stamp(){ return new Date().toISOString(); }
  function log(msg){
    const el = $("#log");
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + msg;
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
    const rOffset = Math.floor(ROWS/2);
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;

    for (let row=0; row<ROWS; row++){
      const r = row - rOffset;
      const count = ROW_COUNTS[row];

      let qMin = -((r + (count - 1)) / 2);
      if (!Number.isInteger(qMin)) qMin = Math.round(qMin);

      for (let i=0;i<count;i++){
        const q = qMin + i;
        const {x,y} = toPixel(q,r);
        minX = Math.min(minX, x - SIZE); maxX = Math.max(maxX, x + SIZE);
        minY = Math.min(minY, y - SIZE); maxY = Math.max(maxY, y + SIZE);
        cells.push({ id: `${q},${r}`, q, r, rowIndex: row, colIndex: i, x, y, points: hexPoints(x,y,SIZE) });
      }
    }
    state.board.midX = (minX + maxX)/2;

    const margin = SIZE * 1.4;
    const vbX = (minX - margin), vbY = (minY - margin);
    const vbW = (maxX - minX) + margin*2, vbH = (maxY - minY) + margin*2;

    state.board.cells = cells;
    state.board.viewBox = `${vbX.toFixed(2)} ${vbY.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}`;
    log(`[board] built rows=${ROWS} total=${cells.length} midX=${state.board.midX.toFixed(2)} rowCounts=[${ROW_COUNTS.join(",")}]`);
  }

  function cellById(id){
    const [qs, rs] = String(id).split(",");
    const q = Number(qs), r = Number(rs);
    return state.board.cells.find(c => c.q === q && c.r === r) || null;
  }
  function unitAt(q,r){ return state.units.find(u => u.q === q && u.r === r) || null; }
  function normalizeType(t){
    t = String(t || "").trim();
    // Legacy + aliases
    if (t === "Missiles" || t === "Missile" || t === "Slinger" || t === "Sling") return "Slingers";
    if (t === "Archer" || t === "Bow") return "Archers";
    if (t === "Gen" || t === "Commander") return "General";
    if (t === "Cav") return "Cavalry";
    if (t === "Inf") return "Infantry";
    // Canonical
    if (t === "Infantry" || t === "Cavalry" || t === "Slingers" || t === "Archers" || t === "General") return t;
    return t || "Infantry";
  }

  function typeLetter(type){
    const tt = normalizeType(type);
    if (tt === "Infantry") return "I";
    if (tt === "Cavalry") return "C";
    if (tt === "Slingers") return "S";
    if (tt === "Archers") return "A";
    if (tt === "General") return "★";
    return "?";
  }
  function qualLetter(q){ return q==="Green" ? "G" : q==="Regular" ? "R" : q==="Veteran" ? "V" : "?"; }

  function placeOrUpdateUnit(q,r){
    const existing = unitAt(q,r);
    if (existing){
      existing.side = state.ui.side;
      existing.type = normalizeType(state.ui.type);
      existing.quality = state.ui.quality;
      state.board.selectedUnitId = existing.id;
      log(`[edit] updated unit ${existing.id} at ${q},${r} -> ${existing.side} ${existing.type} ${existing.quality}`);
      return;
    }
    const u = { id: `u${state.nextUnitId++}`, q, r, side: state.ui.side, type: normalizeType(state.ui.type), quality: state.ui.quality };
    state.units.push(u);
    state.board.selectedUnitId = u.id;
    log(`[edit] placed unit ${u.id} at ${q},${r} -> ${u.side} ${u.type} ${u.quality}`);
  }

  function eraseUnit(q,r){
    const before = state.units.length;
    state.units = state.units.filter(u => !(u.q === q && u.r === r));
    if (state.units.length !== before){
      log(`[edit] erased unit at ${q},${r}`);
      if (state.board.selectedUnitId && !state.units.some(u => u.id === state.board.selectedUnitId)){
        state.board.selectedUnitId = null;
      }
    }
  }

  function renderBoard(){
    const svg = $("#board");
    svg.setAttribute("viewBox", state.board.viewBox);

    const selCell = state.board.selectedCellId;
    const selUnit = state.board.selectedUnitId;

    const parts = [];
    parts.push('<g id="hexes">');
    for (const c of state.board.cells){
      const cls = (c.id === selCell) ? "hex selected" : "hex";
      parts.push(`<polygon class="${cls}" data-cell-id="${c.id}" points="${c.points}" vector-effect="non-scaling-stroke"></polygon>`);
    }
    parts.push("</g>");

    parts.push('<g id="units">');
    for (const u of state.units){
      const cell = cellById(`${u.q},${u.r}`);
      if (!cell) continue;
      const isSel = (u.id === selUnit);
      const clsSide = (u.side === "Red") ? "unitRed" : "unitBlue";
      const cls = isSel ? "unitSelected" : "";
      const rTok = 14;
      parts.push(
        `<g data-unit-id="${u.id}" transform="translate(${cell.x.toFixed(2)} ${cell.y.toFixed(2)})" class="${cls}">` +
          `<circle class="unitCircle ${clsSide}" r="${rTok}"></circle>` +
          `<text class="unitTextMain" y="-2">${typeLetter(u.type)}</text>` +
          `<text class="unitTextQual" y="11">${qualLetter(u.quality)}</text>` +
        `</g>`
      );
    }
    parts.push("</g>");

    svg.innerHTML = parts.join("");
    $("#unitCount").textContent = String(state.units.length);

    const selectedText = selCell ? selCell : "none";
    $("#selected").textContent = selectedText;

    const scen = state.scenarios.loadedLabel ? ` scenario=${state.scenarios.loadedLabel}` : "";
    $("#boardMeta").textContent =
      `board: rows=${ROWS} total=${state.board.cells.length} (expected 157) midX=${state.board.midX.toFixed(2)} units=${state.units.length}${scen} selected=${selectedText}`;

    $("#scenarioLoaded").textContent = state.scenarios.loadedLabel || "none";
  }

  async function loadTruth(){
    try{
      const res = await fetch(`TRUTH.txt?ts=${Date.now()}`, { cache: "no-store" });
      const txt = await res.text();
      $("#truth").textContent = txt.trim();
      log(`[truth] loaded @ ${stamp()}`);
    }catch(e){
      $("#truth").textContent = "TRUTH fetch failed";
      log(`[truth] ERROR @ ${stamp()}: ${String(e)}`);
    }
  }

  function syncUIFromControls(){
    state.ui.editMode = $("#editMode").checked;
    state.ui.tool = document.querySelector('input[name="tool"]:checked')?.value || "place";
    state.ui.side = $("#sideSel").value;
    state.ui.type = $("#typeSel").value;
    state.ui.quality = $("#qualSel").value;
  }

  function populateScenarioSelect(list){
    const sel = $("#scenarioSel");
    sel.innerHTML = "";
    for (const s of list){
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      sel.appendChild(opt);
    }
    // default to demo_lines if present (more visible than empty)
    if (list.some(s => s.id === "demo_lines")) sel.value = "demo_lines";
  }

  async function loadScenarioIndex(){
    try{
      const res = await fetch(`scenarios/_index.json?ts=${Date.now()}`, { cache: "no-store" });
      const list = await res.json();
      if (!Array.isArray(list)) throw new Error("scenario index is not an array");
      state.scenarios.index = list;
      populateScenarioSelect(list);
      log(`[scenario] index loaded (${list.length})`);
    }catch(e){
      state.scenarios.index = [];
      const sel = $("#scenarioSel");
      sel.innerHTML = `<option value="">(no scenarios)</option>`;
      log(`[scenario] ERROR loading index: ${String(e)}`);
    }
  }

  function applyScenario(scen){
    const units = Array.isArray(scen.units) ? scen.units : [];
    state.units = units.map((u, i) => ({
      id: `u${i+1}`,
      q: Number(u.q),
      r: Number(u.r),
      side: (u.side === "Red") ? "Red" : "Blue",
      type: (u.type === "Cavalry" || u.type === "Missiles" || u.type === "Infantry") ? u.type : "Infantry",
      quality: (u.quality === "Green" || u.quality === "Regular" || u.quality === "Veteran") ? u.quality : "Regular",
    }));
    state.nextUnitId = state.units.length + 1;

    state.board.selectedCellId = null;
    state.board.selectedUnitId = null;

    state.scenarios.loadedId = scen.id || null;
    state.scenarios.loadedLabel = scen.label || scen.id || "unknown";

    log(`[scenario] loaded: ${state.scenarios.loadedLabel} units=${state.units.length}`);
    renderBoard();
  }

  async function loadScenarioById(id){
    const hit = state.scenarios.index.find(s => s.id === id);
    if (!hit){
      log(`[scenario] not found in index: ${id}`);
      return;
    }
    try{
      const res = await fetch(`scenarios/${hit.file}?ts=${Date.now()}`, { cache: "no-store" });
      const scen = await res.json();
      applyScenario(scen);
    }catch(e){
      log(`[scenario] ERROR loading ${id}: ${String(e)}`);
    }
  }

  function init(){
    // Build badge is the truth probe in the UI
    $("#build").textContent = `Ad Arma v2 — BUILD ${build} — PORT ${port}`;
    $("#tagline").textContent = "Instrument for thinking in formations.";

    buildBoard();
    syncUIFromControls();
    renderBoard();

    $("#controls").addEventListener("change", () => {
      syncUIFromControls();
      log(`[ui] edit=${state.ui.editMode} tool=${state.ui.tool} side=${state.ui.side} type=${state.ui.type} qual=${state.ui.quality}`);
    });

    $("#board").addEventListener("click", (e) => {
      const unitG = e.target.closest("g[data-unit-id]");
      if (unitG){
        const uid = unitG.getAttribute("data-unit-id");
        state.board.selectedUnitId = uid;
        const u = state.units.find(x => x.id === uid);
        if (u) state.board.selectedCellId = `${u.q},${u.r}`;
        renderBoard();
        log(`[select] unit ${uid} @ ${stamp()}`);
        return;
      }

      const poly = e.target.closest("polygon[data-cell-id]");
      if (!poly){
        state.board.selectedCellId = null;
        state.board.selectedUnitId = null;
        renderBoard();
        log(`[select] cleared @ ${stamp()}`);
        return;
      }

      const id = poly.getAttribute("data-cell-id");
      state.board.selectedCellId = id;

      const [qs, rs] = id.split(",");
      const q = Number(qs), r = Number(rs);

      syncUIFromControls();
      if (state.ui.editMode){
        if (state.ui.tool === "place") placeOrUpdateUnit(q,r);
        if (state.ui.tool === "erase") eraseUnit(q,r);
      }

      renderBoard();
      log(`[select] cell ${id} @ ${stamp()}`);
    });

    $("#ping").addEventListener("click", () => {
      state.ui.pings += 1;
      $("#pings").textContent = String(state.ui.pings);
      log(`[ping] #${state.ui.pings} @ ${stamp()} (build ${build})`);
    });

    $("#loadScenario").addEventListener("click", () => {
      const id = $("#scenarioSel").value;
      if (id) loadScenarioById(id);
    });

    loadTruth();
    loadScenarioIndex();
    log(`[boot] init @ ${stamp()} (build ${build})`);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();