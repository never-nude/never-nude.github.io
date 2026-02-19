(function(){
  const $ = (sel) => document.querySelector(sel);
  const build = window.AD_ARMA_BUILD_ID || "UNKNOWN";
  const port = Number(window.location.port) || 9981;

  // Base-path hardening:
  // works on:
  // - http://127.0.0.1:9981/
  // - https://www.digitalbrain.live/ad-arma/
  // - https://www.digitalbrain.live/ad-arma (no slash)
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

  // Hex geometry
  const SIZE = 28;
  const SQRT3 = Math.sqrt(3);
  const toPixel = (q, r) => ({ x: SQRT3 * SIZE * (q + r/2), y: 1.5 * SIZE * r });

  const state = {
    meta: { build, port, base: BASE, feature: "SCENARIO_TOOLS_V0_TYPE5_LOCKED_BASEPATH" },
    board: {
      rowCounts: ROW_COUNTS,
      rows: ROWS,
      total: TOTAL,
      cells: [],
      viewBox: "0 0 10 10",
      selectedCellId: null,
      selectedUnitId: null,
      midX: null,
    },
    scenarios: {
      index: [],
      loadedId: null,
      loadedLabel: null,
    },
    units: [],
    nextUnitId: 1,
    ui: {
      editMode: true,
      tool: "place",
      side: "Blue",
      type: "Infantry",
      quality: "Regular",
      pings: 0,
    }
  };
  window.AD_ARMA_STATE = state;

  function stamp(){ return new Date().toISOString(); }
  function log(msg){
    const el = $("#log");
    el.textContent = (el.textContent ? el.textContent + "\n" : "") + msg;
  }

  function sanityScripts(){
    const srcs = Array.from(document.querySelectorAll("script[src]"))
      .map(s => s.getAttribute("src") || "");
    const ok = (src) => /(?:^|\/)build\.js(\?|$)/.test(src) || /(?:^|\/)main\.js(\?|$)/.test(src);
    const bad = srcs.filter(s => s && !ok(s));
    if (bad.length){
      log(`[sanity] WARNING unexpected scripts loaded: ${bad.join(", ")}`);
    }else{
      log("[sanity] scripts OK");
    }
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

        minX = Math.min(minX, x - SIZE);
        maxX = Math.max(maxX, x + SIZE);
        minY = Math.min(minY, y - SIZE);
        maxY = Math.max(maxY, y + SIZE);

        cells.push({
          id: `${q},${r}`,
          q, r,
          rowIndex: row,
          colIndex: i,
          x, y,
          points: hexPoints(x,y,SIZE),
        });
      }
    }

    state.board.midX = (minX + maxX) / 2;
    const margin = SIZE * 1.4;
    const vbX = (minX - margin);
    const vbY = (minY - margin);
    const vbW = (maxX - minX) + margin*2;
    const vbH = (maxY - minY) + margin*2;

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

  function typeLetter(t){
    if (t === "Infantry") return "I";
    if (t === "Cavalry")  return "C";
    if (t === "Slingers") return "S";
    if (t === "Archers")  return "A";
    if (t === "General")  return "G";
    return "?";
  }
  function qualLetter(q){
    if (q === "Green") return "G";
    if (q === "Regular") return "R";
    if (q === "Veteran") return "V";
    return "?";
  }

  function placeOrUpdateUnit(q,r){
    const existing = unitAt(q,r);
    if (existing){
      existing.side = state.ui.side;
      existing.type = state.ui.type;
      existing.quality = state.ui.quality;
      state.board.selectedUnitId = existing.id;
      log(`[edit] updated unit ${existing.id} at ${q},${r} -> ${existing.side} ${existing.type} ${existing.quality}`);
      return;
    }
    const u = {
      id: `u${state.nextUnitId++}`,
      q, r,
      side: state.ui.side,
      type: state.ui.type,
      quality: state.ui.quality,
    };
    state.units.push(u);
    state.board.selectedUnitId = u.id;
    log(`[edit] placed unit ${u.id} at ${q},${r} -> ${u.side} ${u.type} ${u.quality}`);
  }

  function eraseUnit(q,r){
    const before = state.units.length;
    state.units = state.units.filter(u => !(u.q === q && u.r === r));
    if (state.units.length !== before){
      log(`[edit] erased unit at ${q},${r}`);
      if (state.board.selectedUnitId){
        const still = state.units.some(u => u.id === state.board.selectedUnitId);
        if (!still) state.board.selectedUnitId = null;
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
      parts.push(
        `<polygon class="${cls}" data-cell-id="${c.id}" points="${c.points}" vector-effect="non-scaling-stroke">` +
          `<title>q=${c.q} r=${c.r} row=${c.rowIndex} col=${c.colIndex}</title>` +
        `</polygon>`
      );
    }
    parts.push("</g>");

    parts.push('<g id="units">');
    for (const u of state.units){
      const cell = cellById(`${u.q},${u.r}`);
      if (!cell) continue;
      const isSel = (u.id === selUnit);
      const clsSide = (u.side === "Red") ? "unitRed" : "unitBlue";
      const cls = isSel ? "unitSelected" : "";
      const rTok = (u.type === "General") ? 16 : 14;

      parts.push(
        `<g data-unit-id="${u.id}" transform="translate(${cell.x.toFixed(2)} ${cell.y.toFixed(2)})" class="${cls}">` +
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
    $("#loadedScenario").textContent = state.scenarios.loadedLabel || "none";

    const selectedText = selCell ? selCell : "none";
    $("#selected").textContent = selectedText;

    const scen = state.scenarios.loadedLabel ? ` scenario=${state.scenarios.loadedLabel}` : " scenario=none";
    $("#boardMeta").textContent =
      `board: rows=${ROWS} total=${state.board.cells.length} (expected 157) midX=${state.board.midX.toFixed(2)} units=${state.units.length}${scen} selected=${selectedText}`;
  }

  async function loadTruth(){
    try{
      const res = await fetch(url(`TRUTH.txt?ts=${Date.now()}`), { cache: "no-store" });
      const txt = await res.text();
      $("#truth").textContent = txt.trim();
      log(`[truth] loaded @ ${stamp()} (base=${BASE})`);
    }catch(e){
      $("#truth").textContent = "TRUTH fetch failed";
      log(`[truth] ERROR @ ${stamp()}: ${String(e)}`);
    }
  }

  async function loadScenarioIndex(){
    const sel = $("#scenarioSel");
    sel.innerHTML = `<option>loading…</option>`;
    try{
      const res = await fetch(url(`scenarios/index.json?ts=${Date.now()}`), { cache: "no-store" });
      if (!res.ok) throw new Error(`index fetch status ${res.status}`);
      const arr = await res.json();
      if (!Array.isArray(arr) || !arr.length) throw new Error("index json empty or not array");
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
      log(`[scenario] ERROR loading index: ${String(e)}`);
    }
  }

  async function loadScenarioById(id){
    const entry = state.scenarios.index.find(x => x.id === id);
    if (!entry){ log(`[scenario] missing id=${id}`); return; }
    try{
      const res = await fetch(url(`scenarios/${entry.file}?ts=${Date.now()}`), { cache: "no-store" });
      if (!res.ok) throw new Error(`scenario fetch status ${res.status}`);
      const data = await res.json();

      // Apply
      state.units = [];
      state.nextUnitId = 1;
      for (const u of (data.units || [])){
        if (!u) continue;
        if (!UNIT_TYPES.includes(u.type)) continue;
        if (!QUALS.includes(u.quality)) continue;
        state.units.push({
          id: `u${state.nextUnitId++}`,
          q: Number(u.q),
          r: Number(u.r),
          side: (u.side === "Red") ? "Red" : "Blue",
          type: u.type,
          quality: u.quality,
        });
      }
      state.scenarios.loadedId = entry.id;
      state.scenarios.loadedLabel = entry.label || entry.id;

      log(`[scenario] loaded ${state.scenarios.loadedLabel} units=${state.units.length}`);
      renderBoard();
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

  function init(){
    $("#build").textContent = `Ad Arma v2 — BUILD ${build} — PORT ${port}`;

    // Truth toggle
    let truthOpen = false;
    $("#truthToggle").addEventListener("click", () => {
      truthOpen = !truthOpen;
      $("#truth").style.display = truthOpen ? "block" : "none";
      $("#truthToggle").textContent = truthOpen ? "Truth ▾" : "Truth ▸";
    });

    buildBoard();
    sanityScripts();
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
      console.log(`[Ad Arma v2] ping #${state.ui.pings} build ${build}`);
    });

    $("#loadScenario").addEventListener("click", () => {
      const id = $("#scenarioSel").value;
      if (id) loadScenarioById(id);
    });

    loadTruth();
    loadScenarioIndex();
    log(`[boot] init @ ${stamp()} (build ${build}, base=${BASE})`);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();